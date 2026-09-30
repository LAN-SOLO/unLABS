/**
 * Desktop local operators: per-install passwords and the loopback-only
 * host check that blocks DNS rebinding against the bundled server.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_OPERATOR_PASSWORD,
  isLocalOperatorMode,
  localOperatorEmail,
  localOperatorPassword,
} from "@/lib/auth/localOperator";
import { isLoopbackHost } from "@/lib/auth/loopback";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("localOperatorPassword", () => {
  it("derives a stable, per-install password", () => {
    vi.stubEnv("LOCAL_OPERATOR_SECRET", "a".repeat(64));
    const a = localOperatorPassword("jade@unstablelabs.local");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(localOperatorPassword(" JADE@unstablelabs.local ")).toBe(a);
    expect(localOperatorPassword("damien@unstablelabs.local")).not.toBe(a);
    vi.stubEnv("LOCAL_OPERATOR_SECRET", "b".repeat(64));
    expect(localOperatorPassword("jade@unstablelabs.local")).not.toBe(a);
  });

  it("never falls back to the shared legacy password in production", () => {
    vi.stubEnv("LOCAL_OPERATOR_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(localOperatorPassword("jade@unstablelabs.local")).toBeNull();
    vi.stubEnv("NODE_ENV", "development");
    expect(localOperatorPassword("jade@unstablelabs.local")).toBe(LEGACY_OPERATOR_PASSWORD);
  });
});

describe("isLocalOperatorMode", () => {
  it("is off on a production web server", () => {
    vi.stubEnv("ELECTRON_RUN", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isLocalOperatorMode()).toBe(false);
    vi.stubEnv("ELECTRON_RUN", "true");
    expect(isLocalOperatorMode()).toBe(true);
  });
});

describe("localOperatorEmail", () => {
  it("normalises the username", () => {
    expect(localOperatorEmail("Jade Q.")).toBe("jadeq@unstablelabs.local");
  });
});

describe("isLoopbackHost", () => {
  it.each(["127.0.0.1:3000", "localhost:3000", "LOCALHOST", "[::1]:54321", "127.0.0.1"])(
    "accepts %s",
    (host) => expect(isLoopbackHost(host)).toBe(true),
  );
  it.each([
    null,
    "",
    "evil.example:3000",
    "127.0.0.1.evil.example",
    "localhost.evil.example:3000",
    "127.0.0.1:3000@evil.example",
  ])("rejects %s", (host) => expect(isLoopbackHost(host)).toBe(false));
});
