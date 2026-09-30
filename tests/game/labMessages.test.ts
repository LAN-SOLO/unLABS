import { describe, expect, it } from "vitest";
import {
  LAB_BODY_MAX,
  LAB_POST_MAX,
  LAB_SUBJECT_MAX,
  appendAttachment,
  charLength,
  cleanLine,
  cleanText,
  countUnread,
  excerpt,
  isDraftError,
  isUuid,
  isValidUsername,
  mapLabError,
  messageAge,
  normalizeUsername,
  quoteReply,
  remaining,
  replySubject,
  toMessageView,
  toPostView,
  unwrapLabRow,
  validateMessage,
  validatePost,
} from "@/lib/game/labMessages";

const ME = "11111111-1111-1111-1111-111111111111";
const YOU = "22222222-2222-2222-2222-222222222222";

describe("text normalisation", () => {
  it("normalises line endings and strips control characters", () => {
    expect(cleanText("  a\r\nb\rc\u0001\u0007d\t \n")).toBe("a\nb\ncd");
    expect(cleanText(42)).toBe("");
    expect(cleanLine(" hello\n\n  world ")).toBe("hello world");
  });

  it("normalises usernames", () => {
    expect(normalizeUsername("  @Damien ")).toBe("Damien");
    expect(normalizeUsername(null)).toBe("");
    expect(isValidUsername("jade_l-2")).toBe(true);
    expect(isValidUsername("bad name")).toBe(false);
    expect(isValidUsername("x".repeat(33))).toBe(false);
    expect(isValidUsername("")).toBe(false);
  });

  it("recognises uuids", () => {
    expect(isUuid(ME)).toBe(true);
    expect(isUuid("nope")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });

  it("counts code points like the database", () => {
    expect(charLength("äö😀")).toBe(3);
    expect(remaining("abc", 5)).toBe(2);
  });
});

describe("validateMessage", () => {
  const ok = { to: "@damien", subject: " Coffee\nmachine ", body: " It hums.\r\n " };

  it("accepts and normalises a valid draft", () => {
    expect(validateMessage(ok)).toEqual({
      ok: true,
      value: { to: "damien", subject: "Coffee machine", body: "It hums." },
    });
  });

  it("rejects in the same order as the RPC", () => {
    expect(validateMessage({ ...ok, to: " " })).toEqual({ ok: false, error: "recipient_required" });
    expect(validateMessage({ ...ok, to: "no way" })).toEqual({
      ok: false,
      error: "recipient_not_found",
    });
    expect(validateMessage({ ...ok, subject: "\n" })).toEqual({
      ok: false,
      error: "empty_subject",
    });
    expect(validateMessage({ ...ok, subject: "s".repeat(LAB_SUBJECT_MAX + 1) })).toEqual({
      ok: false,
      error: "subject_too_long",
    });
    expect(validateMessage({ ...ok, body: "\u0001 " })).toEqual({ ok: false, error: "empty_body" });
    expect(validateMessage({ ...ok, body: "b".repeat(LAB_BODY_MAX + 1) })).toEqual({
      ok: false,
      error: "body_too_long",
    });
  });

  it("accepts exactly the limits", () => {
    const r = validateMessage({
      to: "x",
      subject: "s".repeat(LAB_SUBJECT_MAX),
      body: "b".repeat(LAB_BODY_MAX),
    });
    expect(r.ok).toBe(true);
  });
});

describe("validatePost", () => {
  it("checks length after trimming", () => {
    expect(validatePost("  hi  ")).toEqual({ ok: true, value: "hi" });
    expect(validatePost("   ")).toEqual({ ok: false, error: "empty_body" });
    expect(validatePost("p".repeat(LAB_POST_MAX)).ok).toBe(true);
    expect(validatePost("p".repeat(LAB_POST_MAX + 1))).toEqual({
      ok: false,
      error: "body_too_long",
    });
    expect(validatePost(undefined)).toEqual({ ok: false, error: "empty_body" });
  });
});

describe("error mapping", () => {
  it("maps known codes, unauthorized and unknown messages", () => {
    expect(mapLabError("rate_limited")).toBe("rate_limited");
    expect(mapLabError("already_reported")).toBe("already_reported");
    expect(mapLabError("unauthorized")).toBe("not_authenticated");
    expect(mapLabError("something new")).toBe("rpc_failed");
    expect(mapLabError(null, "read_failed")).toBe("read_failed");
  });

  it("flags draft errors", () => {
    expect(isDraftError("body_too_long")).toBe(true);
    expect(isDraftError("recipient_not_found")).toBe(true);
    expect(isDraftError("rate_limited")).toBe(false);
    expect(isDraftError("offline")).toBe(false);
  });

  it("unwraps RPC rows", () => {
    expect(unwrapLabRow<{ success: boolean }>([{ success: true }])).toEqual({ success: true });
    expect(unwrapLabRow([])).toBeNull();
    expect(unwrapLabRow(null)).toBeNull();
  });
});

describe("views", () => {
  const row = {
    id: "m1",
    sender_id: YOU,
    sender_name: "Damien",
    recipient_name: "jade_l",
    subject: "Hi",
    body: "Fridge.",
    created_at: "2026-09-29T10:00:00Z",
    read_at: null,
  };

  it("shapes messages and counts unread incoming ones", () => {
    const inc = toMessageView(row, ME);
    expect(inc).toMatchObject({ from: "Damien", to: "jade_l", read: false, outgoing: false });
    const out = toMessageView({ ...row, id: "m2", sender_id: ME }, ME);
    expect(out.outgoing).toBe(true);
    const read = toMessageView({ ...row, id: "m3", read_at: "2026-09-29T11:00:00Z" }, ME);
    expect(countUnread([inc, out, read])).toBe(1);
  });

  it("shapes posts", () => {
    const p = {
      id: "p1",
      author_id: ME,
      author_name: "jade_l",
      body: "Coffee is a reagent.",
      created_at: "2026-09-29T10:00:00Z",
      expires_at: "2026-10-29T10:00:00Z",
      hidden: false,
    };
    expect(toPostView(p, ME, new Set())).toMatchObject({ mine: true, reportedByMe: false });
    expect(toPostView(p, YOU, new Set(["p1"]))).toMatchObject({ mine: false, reportedByMe: true });
  });
});

describe("formatting", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");

  it("computes coarse ages", () => {
    expect(messageAge("2026-09-29T11:59:30Z", now)).toEqual({ unit: "now", n: 0 });
    expect(messageAge("2026-09-29T11:15:00Z", now)).toEqual({ unit: "min", n: 45 });
    expect(messageAge("2026-09-29T07:00:00Z", now)).toEqual({ unit: "h", n: 5 });
    expect(messageAge("2026-09-26T12:00:00Z", now)).toEqual({ unit: "d", n: 3 });
    expect(messageAge("garbage", now)).toEqual({ unit: "now", n: 0 });
    expect(messageAge("2026-09-29T13:00:00Z", now)).toEqual({ unit: "now", n: 0 });
  });

  it("builds reply subjects without stacking", () => {
    expect(replySubject("Hi")).toBe("Re: Hi");
    expect(replySubject("RE: re: Hi")).toBe("Re: Hi");
    expect(charLength(replySubject("x".repeat(LAB_SUBJECT_MAX)))).toBe(LAB_SUBJECT_MAX);
  });

  it("quotes replies within the body limit", () => {
    expect(quoteReply("a\nb", "Damien wrote:")).toBe("\n\nDamien wrote:\n> a\n> b");
    expect(charLength(quoteReply("z".repeat(LAB_BODY_MAX), "h"))).toBe(LAB_BODY_MAX);
  });

  it("appends attachments only when they fit", () => {
    expect(appendAttachment("", "Note", "text")).toBe("[Note]\ntext");
    expect(appendAttachment("Hello  \n", "Note", "text")).toBe("Hello\n\n[Note]\ntext");
    expect(appendAttachment("x".repeat(10), "T", "y", 12)).toBeNull();
  });

  it("makes excerpts", () => {
    expect(excerpt("first line\nsecond")).toBe("first line");
    expect(excerpt("abcdefghij", 5)).toBe("abcd…");
  });
});
