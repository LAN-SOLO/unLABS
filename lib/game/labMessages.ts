/**
 * Lab messages + lab board — pure helpers
 * =======================================
 *
 * TypeScript-side companions to the SECURITY DEFINER RPCs in
 * supabase/migrations/20261001000001_lab_messages.sql (`send_lab_message`,
 * `mark_lab_message_read`, `delete_lab_message`, `post_lab_board`,
 * `delete_lab_board_post`, `report_lab_board_post`). Everything here is pure
 * (no I/O, no i18n) so the server actions in app/(game)/actions/labMessages.ts
 * stay thin and the validation / error-mapping / formatting rules are unit
 * tested (tests/game/labMessages.test.ts). Player-visible texts for the codes
 * live in the UI (components/world/pc/MailApp.tsx, BoardApp.tsx).
 *
 * The TS checks mirror the DB checks so the UI can explain problems before a
 * round trip — the database stays the authority either way.
 */

// ── Limits (mirror the migration) ─────────────────────────────────────

export const LAB_SUBJECT_MAX = 80;
export const LAB_BODY_MAX = 2000;
export const LAB_POST_MAX = 280;
export const LAB_USERNAME_MAX = 32;
/** Seconds between two messages from one sender. */
export const LAB_MESSAGE_COOLDOWN_S = 20;
export const LAB_MESSAGES_PER_DAY = 50;
/** Seconds between two board posts from one author. */
export const LAB_POST_COOLDOWN_S = 60;
export const LAB_POSTS_PER_DAY = 10;
/** Reports after which a board post is hidden. */
export const LAB_REPORTS_TO_HIDE = 3;
/** Board posts expire after this many days. */
export const LAB_POST_TTL_DAYS = 30;
/** Page size of inbox / sent / board reads. */
export const LAB_LIST_LIMIT = 50;

const USERNAME_RE = /^[A-Za-z0-9_-]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Control characters except TAB (\x09) and LF (\x0A) — same set as lab_clean_text().
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// ── Error codes ───────────────────────────────────────────────────────

/** `error_message` values the RPCs can return. */
export const LAB_DB_ERRORS = [
  "unauthorized",
  "recipient_required",
  "recipient_not_found",
  "self_message",
  "empty_subject",
  "subject_too_long",
  "empty_body",
  "body_too_long",
  "rate_limited",
  "daily_limit",
  "not_found",
  "not_author",
  "own_post",
  "already_reported",
] as const;

export type LabDbError = (typeof LAB_DB_ERRORS)[number];

/** Every error code a lab-message server action can return. */
export type LabErrorCode =
  | LabDbError
  | "not_authenticated"
  | "invalid_id"
  | "read_failed"
  | "rpc_failed"
  | "rpc_no_row";

/** Client-side extra codes (a thrown server action = network / server down). */
export type LabClientError = LabErrorCode | "offline" | "desktop";

export type LabResult<T> = { ok: true; data: T } | { ok: false; error: LabErrorCode };

/**
 * Map a DB `error_message` onto a known code; anything unknown becomes the
 * fallback so new DB-side messages never leak as untyped strings.
 * `unauthorized` (no JWT) is reported as `not_authenticated`, like reads.
 */
export function mapLabError(
  message: string | null | undefined,
  fallback: LabErrorCode = "rpc_failed",
): LabErrorCode {
  if (message === "unauthorized") return "not_authenticated";
  return (LAB_DB_ERRORS as readonly string[]).includes(message ?? "")
    ? (message as LabDbError)
    : fallback;
}

/** Error codes the player can fix by editing the draft (keep the form open). */
export function isDraftError(code: LabClientError): boolean {
  return (
    code === "recipient_required" ||
    code === "recipient_not_found" ||
    code === "self_message" ||
    code === "empty_subject" ||
    code === "subject_too_long" ||
    code === "empty_body" ||
    code === "body_too_long"
  );
}

/**
 * RPCs declared `RETURNS TABLE` surface as an array of rows; each lab RPC
 * yields exactly one. Returns the first row or `null`.
 */
export function unwrapLabRow<T>(data: unknown): T | null {
  const rows = (Array.isArray(data) ? data : []) as T[];
  return rows[0] ?? null;
}

// ── Text normalisation ────────────────────────────────────────────────

/** CRLF/CR → LF, drop control characters (keeps TAB and LF), trim. */
export function cleanText(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(/\r\n?/g, "\n").replace(CONTROL_RE, "").trim();
}

/** One-line text: every whitespace run (incl. newlines) becomes one space. */
export function cleanLine(input: unknown): string {
  return cleanText(input).replace(/\s+/g, " ");
}

/** Username as typed ("@Damien " → "Damien"); "" when empty. */
export function normalizeUsername(input: unknown): string {
  const s = typeof input === "string" ? input.trim() : "";
  return (s.startsWith("@") ? s.slice(1) : s).trim();
}

export function isValidUsername(name: string): boolean {
  return name.length > 0 && name.length <= LAB_USERNAME_MAX && USERNAME_RE.test(name);
}

export function isUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

/** Length as the database counts it (code points, not UTF-16 units). */
export function charLength(s: string): number {
  return Array.from(s).length;
}

// ── Validation ────────────────────────────────────────────────────────

export interface MessageDraft {
  to: string;
  subject: string;
  body: string;
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: LabDbError };

/** Validate + normalise a message draft (same order of checks as the RPC). */
export function validateMessage(draft: {
  to: unknown;
  subject: unknown;
  body: unknown;
}): Validated<MessageDraft> {
  const to = normalizeUsername(draft.to);
  if (!to) return { ok: false, error: "recipient_required" };
  if (!isValidUsername(to)) return { ok: false, error: "recipient_not_found" };
  const subject = cleanLine(draft.subject);
  if (!subject) return { ok: false, error: "empty_subject" };
  if (charLength(subject) > LAB_SUBJECT_MAX) return { ok: false, error: "subject_too_long" };
  const body = cleanText(draft.body);
  if (!body) return { ok: false, error: "empty_body" };
  if (charLength(body) > LAB_BODY_MAX) return { ok: false, error: "body_too_long" };
  return { ok: true, value: { to, subject, body } };
}

/** Validate + normalise a board post. */
export function validatePost(body: unknown): Validated<string> {
  const text = cleanText(body);
  if (!text) return { ok: false, error: "empty_body" };
  if (charLength(text) > LAB_POST_MAX) return { ok: false, error: "body_too_long" };
  return { ok: true, value: text };
}

// ── Views (DB rows → client shapes) ───────────────────────────────────

export interface LabMessageView {
  id: string;
  /** Counterpart's name: the sender in the inbox, the recipient in "sent". */
  from: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** True when the viewer sent it. */
  outgoing: boolean;
}

export interface RawMessageRow {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_name: string;
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export function toMessageView(row: RawMessageRow, viewerId: string): LabMessageView {
  return {
    id: row.id,
    from: row.sender_name,
    to: row.recipient_name,
    subject: row.subject,
    body: row.body,
    createdAt: row.created_at,
    read: row.read_at !== null,
    outgoing: row.sender_id === viewerId,
  };
}

export interface LabPostView {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  expiresAt: string;
  mine: boolean;
  /** Only ever true for the author's own posts (RLS hides them from others). */
  hidden: boolean;
  reportedByMe: boolean;
}

export interface RawPostRow {
  id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  expires_at: string;
  hidden: boolean;
}

export function toPostView(
  row: RawPostRow,
  viewerId: string,
  reported: ReadonlySet<string>,
): LabPostView {
  return {
    id: row.id,
    author: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    mine: row.author_id === viewerId,
    hidden: row.hidden,
    reportedByMe: reported.has(row.id),
  };
}

export function countUnread(messages: readonly LabMessageView[]): number {
  return messages.reduce((n, m) => n + (!m.read && !m.outgoing ? 1 : 0), 0);
}

// ── Formatting ────────────────────────────────────────────────────────

export type AgeUnit = "now" | "min" | "h" | "d";

/** Coarse age of an ISO timestamp for "{n} min ago" style labels. */
export function messageAge(iso: string, nowMs: number): { unit: AgeUnit; n: number } {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return { unit: "now", n: 0 };
  const s = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (s < 60) return { unit: "now", n: 0 };
  if (s < 3600) return { unit: "min", n: Math.floor(s / 60) };
  if (s < 86400) return { unit: "h", n: Math.floor(s / 3600) };
  return { unit: "d", n: Math.floor(s / 86400) };
}

/** "Re: subject" without stacking prefixes, clipped to the subject limit. */
export function replySubject(subject: string): string {
  const base = cleanLine(subject).replace(/^(re:\s*)+/i, "");
  return clip(`Re: ${base}`, LAB_SUBJECT_MAX);
}

/**
 * Reply body: an empty line to type in, then `header` (already translated,
 * e.g. "damien wrote:") and the original quoted with "> ". The quote is cut
 * so the whole body stays within the limit.
 */
export function quoteReply(body: string, header: string): string {
  const quoted = cleanText(body)
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  return clip(`\n\n${header}\n${quoted}`, LAB_BODY_MAX);
}

/**
 * Append an attachment (a memo) to a body, separated by a blank line.
 * Returns null when it would not fit in `max` characters.
 */
export function appendAttachment(body: string, title: string, text: string, max = LAB_BODY_MAX) {
  const block = [`[${cleanLine(title)}]`, cleanText(text)].filter(Boolean).join("\n");
  const base = body.replace(/\s+$/, "");
  const next = base ? `${base}\n\n${block}` : block;
  return charLength(next) <= max ? next : null;
}

/** First line of a body, clipped (list previews). */
export function excerpt(body: string, max = 60): string {
  const line = cleanText(body).split("\n")[0] ?? "";
  return charLength(line) > max ? `${clip(line, max - 1)}…` : line;
}

/** Clip to `max` code points. */
export function clip(s: string, max: number): string {
  const cps = Array.from(s);
  return cps.length > max ? cps.slice(0, max).join("") : s;
}

/** Characters left before a limit (negative when over). */
export function remaining(s: string, max: number): number {
  return max - charLength(s);
}
