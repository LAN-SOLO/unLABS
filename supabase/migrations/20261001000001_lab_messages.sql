-- ============================================================
-- Lab messages + public lab board (Lab World, Jade's computer)
-- ============================================================
-- Player-to-player messaging for the Lab World PC:
--
--   lab_messages       — direct messages (sender → recipient). Each side
--                        deletes independently; when both sides deleted,
--                        the row is removed for good.
--   lab_board_posts    — the public lab board: short posts (≤ 280 chars)
--                        that expire after 30 days. Soft-deleted by the
--                        author (the row stays so rate limits hold).
--   lab_board_reports  — one report per user and post; a post with
--                        ≥ 3 reports is hidden automatically.
--
-- Same pattern as the marketplace (20260812000003): SELECT-only RLS for
-- clients, every mutation is a SECURITY DEFINER RPC keyed on auth.uid()
-- (no user id parameter to spoof). Rate limits live in the RPCs and are
-- serialised per user with a transaction-scoped advisory lock, so two
-- concurrent calls cannot both slip under the limit.
--
-- profiles is only readable by its owner, so display names are
-- snapshotted into the rows at write time (sender_name, recipient_name,
-- author_name) instead of being joined at read time.
--
-- Error codes returned in error_message (mirrored in lib/game/labMessages.ts):
--   unauthorized, recipient_required, recipient_not_found, self_message,
--   empty_subject, subject_too_long, empty_body, body_too_long,
--   rate_limited, daily_limit, not_found, not_author, own_post,
--   already_reported

-- ── Tables ────────────────────────────────────────────────────

create table if not exists public.lab_messages (
  id                uuid primary key default gen_random_uuid(),
  sender_id         uuid not null references auth.users(id) on delete cascade,
  recipient_id      uuid not null references auth.users(id) on delete cascade,
  sender_name       text not null check (char_length(sender_name) between 1 and 40),
  recipient_name    text not null check (char_length(recipient_name) between 1 and 40),
  subject           text not null check (char_length(subject) between 1 and 80),
  body              text not null check (char_length(body) between 1 and 2000),
  created_at        timestamptz not null default now(),
  read_at           timestamptz,
  sender_deleted    boolean not null default false,
  recipient_deleted boolean not null default false,
  constraint lab_messages_not_self check (sender_id <> recipient_id)
);

create index if not exists idx_lab_messages_inbox
  on public.lab_messages(recipient_id, created_at desc)
  where not recipient_deleted;
create index if not exists idx_lab_messages_sent
  on public.lab_messages(sender_id, created_at desc);
create index if not exists idx_lab_messages_unread
  on public.lab_messages(recipient_id)
  where read_at is null and not recipient_deleted;

create table if not exists public.lab_board_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references auth.users(id) on delete cascade,
  author_name  text not null check (char_length(author_name) between 1 and 40),
  body         text not null check (char_length(body) between 1 and 280),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '30 days'),
  hidden       boolean not null default false,
  report_count integer not null default 0 check (report_count >= 0),
  deleted_at   timestamptz
);

create index if not exists idx_lab_board_visible
  on public.lab_board_posts(created_at desc)
  where not hidden and deleted_at is null;
create index if not exists idx_lab_board_author
  on public.lab_board_posts(author_id, created_at desc);

create table if not exists public.lab_board_reports (
  post_id     uuid not null references public.lab_board_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

create index if not exists idx_lab_board_reports_reporter
  on public.lab_board_reports(reporter_id, created_at desc);

-- ── RLS: reads only ──────────────────────────────────────────

alter table public.lab_messages enable row level security;
alter table public.lab_board_posts enable row level security;
alter table public.lab_board_reports enable row level security;

drop policy if exists "Users read their own lab messages" on public.lab_messages;
create policy "Users read their own lab messages"
  on public.lab_messages
  for select
  to authenticated
  using (
    (sender_id = (select auth.uid()) and not sender_deleted)
    or (recipient_id = (select auth.uid()) and not recipient_deleted)
  );

drop policy if exists "Authenticated users read the lab board" on public.lab_board_posts;
create policy "Authenticated users read the lab board"
  on public.lab_board_posts
  for select
  to authenticated
  using (
    deleted_at is null
    and expires_at > now()
    and (not hidden or author_id = (select auth.uid()))
  );

drop policy if exists "Users read their own board reports" on public.lab_board_reports;
create policy "Users read their own board reports"
  on public.lab_board_reports
  for select
  to authenticated
  using (reporter_id = (select auth.uid()));

-- No client write policies: RPCs only. Revoke the default table
-- privileges on top of that (defence in depth).
revoke insert, update, delete on public.lab_messages from anon, authenticated;
revoke insert, update, delete on public.lab_board_posts from anon, authenticated;
revoke insert, update, delete on public.lab_board_reports from anon, authenticated;
revoke select on public.lab_messages from anon;
revoke select on public.lab_board_posts from anon;
revoke select on public.lab_board_reports from anon;

-- ── Helpers ──────────────────────────────────────────────────

-- Display name of the calling user, snapshotted into rows.
create or replace function public.lab_display_name(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select left(
    coalesce(
      (select nullif(btrim(username), '') from profiles where id = p_uid),
      (select nullif(btrim(regexp_replace(display_name, '[[:cntrl:]]', '', 'g')), '')
         from profiles where id = p_uid),
      'lab-' || left(p_uid::text, 8)
    ),
    40
  );
$$;

-- Normalise user text: CRLF → LF, drop control characters except LF/TAB.
create or replace function public.lab_clean_text(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select btrim(
    regexp_replace(
      replace(replace(coalesce(p_text, ''), E'\r\n', E'\n'), E'\r', E'\n'),
      E'[\\x01-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]', '', 'g'
    )
  );
$$;

-- ── send_lab_message ─────────────────────────────────────────

create or replace function public.send_lab_message(
  p_to_username text,
  p_subject     text,
  p_body        text
)
returns table (success boolean, message_id uuid, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_to        text := btrim(coalesce(p_to_username, ''));
  v_subject   text;
  v_body      text;
  v_rid       uuid;
  v_rname     text;
  v_matches   integer;
  v_id        uuid;
begin
  if v_uid is null then
    return query select false, null::uuid, 'unauthorized'::text; return;
  end if;

  if left(v_to, 1) = '@' then
    v_to := btrim(substr(v_to, 2));
  end if;
  if v_to = '' then
    return query select false, null::uuid, 'recipient_required'::text; return;
  end if;
  if char_length(v_to) > 32 or v_to !~ '^[A-Za-z0-9_-]+$' then
    return query select false, null::uuid, 'recipient_not_found'::text; return;
  end if;

  -- Subject: single line.
  v_subject := btrim(regexp_replace(public.lab_clean_text(p_subject), E'\\s+', ' ', 'g'));
  if v_subject = '' then
    return query select false, null::uuid, 'empty_subject'::text; return;
  end if;
  if char_length(v_subject) > 80 then
    return query select false, null::uuid, 'subject_too_long'::text; return;
  end if;

  v_body := public.lab_clean_text(p_body);
  if v_body = '' then
    return query select false, null::uuid, 'empty_body'::text; return;
  end if;
  if char_length(v_body) > 2000 then
    return query select false, null::uuid, 'body_too_long'::text; return;
  end if;

  -- Recipient: exact username first, then a unique case-insensitive match.
  select id, username into v_rid, v_rname from profiles where username = v_to;
  if not found then
    select count(*) into v_matches from profiles where lower(username) = lower(v_to);
    if v_matches = 1 then
      select id, username into v_rid, v_rname from profiles where lower(username) = lower(v_to);
    end if;
  end if;
  if v_rid is null then
    return query select false, null::uuid, 'recipient_not_found'::text; return;
  end if;
  if v_rid = v_uid then
    return query select false, null::uuid, 'self_message'::text; return;
  end if;

  -- Rate limit (serialised per sender).
  perform pg_advisory_xact_lock(hashtext('lab_messages:' || v_uid::text));
  if exists (
    select 1 from lab_messages
     where sender_id = v_uid and created_at > now() - interval '20 seconds'
  ) then
    return query select false, null::uuid, 'rate_limited'::text; return;
  end if;
  if (
    select count(*) from lab_messages
     where sender_id = v_uid and created_at > now() - interval '1 day'
  ) >= 50 then
    return query select false, null::uuid, 'daily_limit'::text; return;
  end if;

  insert into lab_messages (sender_id, recipient_id, sender_name, recipient_name, subject, body)
  values (v_uid, v_rid, public.lab_display_name(v_uid), left(v_rname, 40), v_subject, v_body)
  returning id into v_id;

  return query select true, v_id, null::text;
end;
$$;

-- ── mark_lab_message_read ────────────────────────────────────

create or replace function public.mark_lab_message_read(p_message_id uuid)
returns table (success boolean, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return query select false, 'unauthorized'::text; return;
  end if;

  update lab_messages
     set read_at = coalesce(read_at, now())
   where id = p_message_id
     and recipient_id = v_uid
     and not recipient_deleted;
  if not found then
    return query select false, 'not_found'::text; return;
  end if;

  return query select true, null::text;
end;
$$;

-- ── delete_lab_message (per side) ────────────────────────────

create or replace function public.delete_lab_message(p_message_id uuid)
returns table (success boolean, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row lab_messages%rowtype;
begin
  if v_uid is null then
    return query select false, 'unauthorized'::text; return;
  end if;

  select * into v_row from lab_messages where id = p_message_id for update;
  if not found
     or not (
       (v_row.sender_id = v_uid and not v_row.sender_deleted)
       or (v_row.recipient_id = v_uid and not v_row.recipient_deleted)
     ) then
    return query select false, 'not_found'::text; return;
  end if;

  if v_row.sender_id = v_uid then
    v_row.sender_deleted := true;
  end if;
  if v_row.recipient_id = v_uid then
    v_row.recipient_deleted := true;
  end if;

  if v_row.sender_deleted and v_row.recipient_deleted then
    delete from lab_messages where id = p_message_id;
  else
    update lab_messages
       set sender_deleted = v_row.sender_deleted,
           recipient_deleted = v_row.recipient_deleted
     where id = p_message_id;
  end if;

  return query select true, null::text;
end;
$$;

-- ── post_lab_board ───────────────────────────────────────────

create or replace function public.post_lab_board(p_body text)
returns table (success boolean, post_id uuid, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_body text;
  v_id   uuid;
begin
  if v_uid is null then
    return query select false, null::uuid, 'unauthorized'::text; return;
  end if;

  v_body := public.lab_clean_text(p_body);
  if v_body = '' then
    return query select false, null::uuid, 'empty_body'::text; return;
  end if;
  if char_length(v_body) > 280 then
    return query select false, null::uuid, 'body_too_long'::text; return;
  end if;

  -- Rate limit (serialised per author; soft-deleted posts still count).
  perform pg_advisory_xact_lock(hashtext('lab_board:' || v_uid::text));
  if exists (
    select 1 from lab_board_posts
     where author_id = v_uid and created_at > now() - interval '60 seconds'
  ) then
    return query select false, null::uuid, 'rate_limited'::text; return;
  end if;
  if (
    select count(*) from lab_board_posts
     where author_id = v_uid and created_at > now() - interval '1 day'
  ) >= 10 then
    return query select false, null::uuid, 'daily_limit'::text; return;
  end if;

  insert into lab_board_posts (author_id, author_name, body)
  values (v_uid, public.lab_display_name(v_uid), v_body)
  returning id into v_id;

  return query select true, v_id, null::text;
end;
$$;

-- ── delete_lab_board_post (own posts) ────────────────────────

create or replace function public.delete_lab_board_post(p_post_id uuid)
returns table (success boolean, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_author uuid;
begin
  if v_uid is null then
    return query select false, 'unauthorized'::text; return;
  end if;

  select author_id into v_author
    from lab_board_posts
   where id = p_post_id and deleted_at is null
     for update;
  if not found then
    return query select false, 'not_found'::text; return;
  end if;
  if v_author <> v_uid then
    return query select false, 'not_author'::text; return;
  end if;

  update lab_board_posts set deleted_at = now() where id = p_post_id;
  return query select true, null::text;
end;
$$;

-- ── report_lab_board_post ────────────────────────────────────

create or replace function public.report_lab_board_post(p_post_id uuid)
returns table (success boolean, hidden boolean, error_message text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_post   lab_board_posts%rowtype;
  v_count  integer;
begin
  if v_uid is null then
    return query select false, false, 'unauthorized'::text; return;
  end if;

  select * into v_post
    from lab_board_posts
   where id = p_post_id
     and deleted_at is null
     and expires_at > now()
     for update;
  if not found or v_post.hidden then
    return query select false, false, 'not_found'::text; return;
  end if;
  if v_post.author_id = v_uid then
    return query select false, false, 'own_post'::text; return;
  end if;
  if exists (
    select 1 from lab_board_reports where post_id = p_post_id and reporter_id = v_uid
  ) then
    return query select false, false, 'already_reported'::text; return;
  end if;

  perform pg_advisory_xact_lock(hashtext('lab_report:' || v_uid::text));
  if (
    select count(*) from lab_board_reports
     where reporter_id = v_uid and created_at > now() - interval '1 day'
  ) >= 20 then
    return query select false, false, 'daily_limit'::text; return;
  end if;

  insert into lab_board_reports (post_id, reporter_id) values (p_post_id, v_uid)
  on conflict do nothing;
  if not found then
    return query select false, false, 'already_reported'::text; return;
  end if;

  select count(*) into v_count from lab_board_reports where post_id = p_post_id;
  update lab_board_posts
     set report_count = v_count,
         hidden = v_count >= 3
   where id = p_post_id;

  return query select true, v_count >= 3, null::text;
end;
$$;

-- ── Grants ───────────────────────────────────────────────────

revoke all on function public.lab_display_name(uuid) from public, anon, authenticated;
revoke all on function public.send_lab_message(text, text, text) from public, anon;
revoke all on function public.mark_lab_message_read(uuid) from public, anon;
revoke all on function public.delete_lab_message(uuid) from public, anon;
revoke all on function public.post_lab_board(text) from public, anon;
revoke all on function public.delete_lab_board_post(uuid) from public, anon;
revoke all on function public.report_lab_board_post(uuid) from public, anon;

grant execute on function public.send_lab_message(text, text, text) to authenticated;
grant execute on function public.mark_lab_message_read(uuid) to authenticated;
grant execute on function public.delete_lab_message(uuid) to authenticated;
grant execute on function public.post_lab_board(text) to authenticated;
grant execute on function public.delete_lab_board_post(uuid) to authenticated;
grant execute on function public.report_lab_board_post(uuid) to authenticated;
