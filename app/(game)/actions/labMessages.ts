"use server";

/**
 * Lab messages + lab board server actions
 * =======================================
 *
 * Backend of the mail and board apps on Jade's computer in the Lab World
 * (components/world/pc/MailApp.tsx, BoardApp.tsx). The tables have
 * SELECT-only RLS; every mutation is a SECURITY DEFINER RPC keyed on
 * `auth.uid()` (supabase/migrations/20261001000001_lab_messages.sql), which
 * also enforces lengths, recipients and rate limits. The checks here only
 * fail fast — nothing from the client is trusted.
 *
 *   - listInbox / listSent        — own messages, newest first (+ unread count)
 *   - sendMessage                 — `send_lab_message(p_to_username, p_subject, p_body)`
 *   - markRead / deleteMessage    — `mark_lab_message_read`, `delete_lab_message` (per side)
 *   - listBoard                   — visible board posts (+ which ones I reported)
 *   - postBoard / deletePost      — `post_lab_board`, `delete_lab_board_post`
 *   - reportPost                  — `report_lab_board_post` (≥ 3 reports hide a post)
 *
 * Validation / error mapping / view shaping: lib/game/labMessages.ts.
 */

import { createClient } from "@/lib/supabase/server";
import {
  LAB_LIST_LIMIT,
  countUnread,
  isUuid,
  mapLabError,
  toMessageView,
  toPostView,
  unwrapLabRow,
  validateMessage,
  validatePost,
  type LabErrorCode,
  type LabMessageView,
  type LabPostView,
  type LabResult,
  type RawMessageRow,
  type RawPostRow,
} from "@/lib/game/labMessages";

const MESSAGE_SELECT =
  "id, sender_id, sender_name, recipient_name, subject, body, created_at, read_at";
const POST_SELECT = "id, author_id, author_name, body, created_at, expires_at, hidden";

function fail(error: LabErrorCode): { ok: false; error: LabErrorCode } {
  return { ok: false, error };
}

async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

/** Unwrap a `{success, error_message}` RPC row into a result. */
function rpcOutcome<R extends { success: boolean; error_message: string | null }>(
  data: unknown,
  error: unknown,
): { ok: true; row: R } | { ok: false; error: LabErrorCode } {
  if (error) return fail("rpc_failed");
  const row = unwrapLabRow<R>(data);
  if (!row) return fail("rpc_no_row");
  if (!row.success) return fail(mapLabError(row.error_message));
  return { ok: true, row };
}

// ── Messages ──────────────────────────────────────────────────────────

export interface MailboxData {
  messages: LabMessageView[];
  /** Unread messages in the inbox (0 for "sent"). */
  unread: number;
}

async function listMessages(box: "inbox" | "sent"): Promise<LabResult<MailboxData>> {
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");

  let query = supabase
    .from("lab_messages")
    .select(MESSAGE_SELECT)
    .order("created_at", { ascending: false })
    .limit(LAB_LIST_LIMIT);
  query =
    box === "inbox"
      ? query.eq("recipient_id", userId).eq("recipient_deleted", false)
      : query.eq("sender_id", userId).eq("sender_deleted", false);

  const { data, error } = await query;
  if (error) return fail("read_failed");
  const messages = ((data ?? []) as RawMessageRow[]).map((r) => toMessageView(r, userId));

  let unread = box === "inbox" ? countUnread(messages) : 0;
  if (box === "inbox" && messages.length >= LAB_LIST_LIMIT) {
    // More than one page: count the unread ones in the database.
    const { count } = await supabase
      .from("lab_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("recipient_deleted", false)
      .is("read_at", null);
    if (typeof count === "number") unread = count;
  }
  return { ok: true, data: { messages, unread } };
}

/** Messages to me, newest first. */
export async function listInbox(): Promise<LabResult<MailboxData>> {
  return listMessages("inbox");
}

/** Messages I sent, newest first. */
export async function listSent(): Promise<LabResult<MailboxData>> {
  return listMessages("sent");
}

/** Send a message to another player by username. */
export async function sendMessage(
  to: string,
  subject: string,
  body: string,
): Promise<LabResult<{ id: string }>> {
  const v = validateMessage({ to, subject, body });
  if (!v.ok) return fail(v.error);

  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");

  const { data, error } = await supabase.rpc("send_lab_message", {
    p_to_username: v.value.to,
    p_subject: v.value.subject,
    p_body: v.value.body,
  });
  const out = rpcOutcome<{
    success: boolean;
    message_id: string | null;
    error_message: string | null;
  }>(data, error);
  if (!out.ok) return out;
  if (!out.row.message_id) return fail("rpc_no_row");
  return { ok: true, data: { id: out.row.message_id } };
}

/** Mark one of my received messages as read (idempotent). */
export async function markRead(messageId: string): Promise<LabResult<null>> {
  if (!isUuid(messageId)) return fail("invalid_id");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { data, error } = await supabase.rpc("mark_lab_message_read", {
    p_message_id: messageId,
  });
  const out = rpcOutcome(data, error);
  return out.ok ? { ok: true, data: null } : out;
}

/** Delete a message from my side (inbox or sent); the other side keeps it. */
export async function deleteMessage(messageId: string): Promise<LabResult<null>> {
  if (!isUuid(messageId)) return fail("invalid_id");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { data, error } = await supabase.rpc("delete_lab_message", { p_message_id: messageId });
  const out = rpcOutcome(data, error);
  return out.ok ? { ok: true, data: null } : out;
}

// ── Board ─────────────────────────────────────────────────────────────

/** Visible board posts, newest first (own hidden posts included, flagged). */
export async function listBoard(): Promise<LabResult<{ posts: LabPostView[] }>> {
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");

  const { data, error } = await supabase
    .from("lab_board_posts")
    .select(POST_SELECT)
    .is("deleted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(LAB_LIST_LIMIT);
  if (error) return fail("read_failed");
  const rows = (data ?? []) as RawPostRow[];

  const reported = new Set<string>();
  const others = rows.filter((r) => r.author_id !== userId).map((r) => r.id);
  if (others.length > 0) {
    const { data: reps } = await supabase
      .from("lab_board_reports")
      .select("post_id")
      .eq("reporter_id", userId)
      .in("post_id", others);
    for (const r of reps ?? []) reported.add(r.post_id);
  }

  return { ok: true, data: { posts: rows.map((r) => toPostView(r, userId, reported)) } };
}

/** Post to the public lab board. */
export async function postBoard(body: string): Promise<LabResult<{ id: string }>> {
  const v = validatePost(body);
  if (!v.ok) return fail(v.error);
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { data, error } = await supabase.rpc("post_lab_board", { p_body: v.value });
  const out = rpcOutcome<{
    success: boolean;
    post_id: string | null;
    error_message: string | null;
  }>(data, error);
  if (!out.ok) return out;
  if (!out.row.post_id) return fail("rpc_no_row");
  return { ok: true, data: { id: out.row.post_id } };
}

/** Delete one of my own board posts. */
export async function deletePost(postId: string): Promise<LabResult<null>> {
  if (!isUuid(postId)) return fail("invalid_id");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { data, error } = await supabase.rpc("delete_lab_board_post", { p_post_id: postId });
  const out = rpcOutcome(data, error);
  return out.ok ? { ok: true, data: null } : out;
}

/** Report someone else's board post; `hidden` is true when this report hid it. */
export async function reportPost(postId: string): Promise<LabResult<{ hidden: boolean }>> {
  if (!isUuid(postId)) return fail("invalid_id");
  const { supabase, userId } = await session();
  if (!userId) return fail("not_authenticated");
  const { data, error } = await supabase.rpc("report_lab_board_post", { p_post_id: postId });
  const out = rpcOutcome<{
    success: boolean;
    hidden: boolean | null;
    error_message: string | null;
  }>(data, error);
  if (!out.ok) return out;
  return { ok: true, data: { hidden: out.row.hidden === true } };
}
