import { describe, expect, it } from "vitest";
import {
  DEFAULT_AFTER_LOGIN,
  EMBED_TERMINAL_PATH,
  isEmbedNext,
  loginUrlFor,
  nextOrDefault,
  sanitizeNext,
} from "@/lib/auth/next";

describe("sanitizeNext (post-login redirect whitelist)", () => {
  it("accepts the whitelisted relative paths", () => {
    expect(sanitizeNext("/world")).toBe("/world");
    expect(sanitizeNext("/terminal")).toBe("/terminal");
    expect(sanitizeNext("/terminal?embed=1")).toBe(EMBED_TERMINAL_PATH);
  });

  it("rebuilds the value instead of echoing it (drops extra query and hash)", () => {
    expect(sanitizeNext("/terminal?embed=1&x=<script>")).toBe(EMBED_TERMINAL_PATH);
    expect(sanitizeNext("/world?embed=1#frag")).toBe("/world");
    expect(sanitizeNext("/terminal?embed=0")).toBe("/terminal");
    expect(sanitizeNext("  /world  ")).toBe("/world");
  });

  it("rejects absolute, protocol-relative and tricky URLs", () => {
    for (const bad of [
      "https://evil.com/world",
      "//evil.com/world",
      "/\\evil.com",
      "\\\\evil.com",
      "javascript:alert(1)",
      "@evil.com",
      "/%2F%2Fevil.com",
      "/wor\nld",
      "world",
      "",
    ]) {
      expect(sanitizeNext(bad), bad).toBeNull();
    }
  });

  it("rejects paths outside the whitelist, incl. traversal and prefixes", () => {
    for (const bad of [
      "/",
      "/panel",
      "/lab",
      "/worldx",
      "/world/../panel",
      "/terminal/x",
      "/login",
    ]) {
      expect(sanitizeNext(bad), bad).toBeNull();
    }
    expect(sanitizeNext("/terminal/../world")).toBe("/world");
  });

  it("rejects non-strings and overlong values", () => {
    expect(sanitizeNext(null)).toBeNull();
    expect(sanitizeNext(undefined)).toBeNull();
    expect(sanitizeNext(42)).toBeNull();
    expect(sanitizeNext(`/world?${"a".repeat(300)}`)).toBeNull();
  });

  it("falls back to the default destination", () => {
    expect(nextOrDefault(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(nextOrDefault("//evil.com")).toBe("/world");
    expect(nextOrDefault("nope", "/terminal")).toBe("/terminal");
    expect(nextOrDefault("/terminal?embed=1")).toBe(EMBED_TERMINAL_PATH);
  });

  it("builds login URLs and detects the embedded terminal", () => {
    expect(loginUrlFor("/terminal?embed=1")).toBe("/login?next=%2Fterminal%3Fembed%3D1");
    expect(loginUrlFor("/world")).toBe("/login?next=%2Fworld");
    expect(loginUrlFor("https://evil.com")).toBe("/login");
    expect(isEmbedNext(EMBED_TERMINAL_PATH)).toBe(true);
    expect(isEmbedNext("/terminal")).toBe(false);
    expect(isEmbedNext(null)).toBe(false);
  });
});
