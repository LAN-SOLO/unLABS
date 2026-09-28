import { describe, expect, it } from "vitest";

import { parseMintKeypair } from "@/lib/solana/mintKeypair";

const validArray = Array.from({ length: 64 }, (_, i) => i % 256);

describe("parseMintKeypair", () => {
  it("parses a solana-keygen style 64-byte JSON array", () => {
    const result = parseMintKeypair(JSON.stringify(validArray));
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toHaveLength(64);
    expect(result?.[1]).toBe(1);
  });

  it("returns null for unset or empty input", () => {
    expect(parseMintKeypair(undefined)).toBeNull();
    expect(parseMintKeypair("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseMintKeypair("[1,2,3")).toBeNull();
    expect(parseMintKeypair("not-json")).toBeNull();
  });

  it("returns null for wrong length", () => {
    expect(parseMintKeypair(JSON.stringify(validArray.slice(0, 32)))).toBeNull();
    expect(parseMintKeypair(JSON.stringify([...validArray, 0]))).toBeNull();
  });

  it("returns null for out-of-range or non-integer bytes", () => {
    expect(parseMintKeypair(JSON.stringify([...validArray.slice(0, 63), 256]))).toBeNull();
    expect(parseMintKeypair(JSON.stringify([...validArray.slice(0, 63), -1]))).toBeNull();
    expect(parseMintKeypair(JSON.stringify([...validArray.slice(0, 63), 1.5]))).toBeNull();
    expect(parseMintKeypair(JSON.stringify([...validArray.slice(0, 63), "7"]))).toBeNull();
  });
});
