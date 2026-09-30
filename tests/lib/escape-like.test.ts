import { describe, expect, it } from "vitest";

import { escapeLikePattern } from "@/lib/supabase/escapeLike";

describe("escapeLikePattern", () => {
  it("leaves plain names alone", () => {
    expect(escapeLikePattern("Crystal-01")).toBe("Crystal-01");
  });

  it("escapes LIKE and PostgREST wildcards", () => {
    expect(escapeLikePattern("%")).toBe("\\%");
    expect(escapeLikePattern("my_crystal")).toBe("my\\_crystal");
    expect(escapeLikePattern("a*b")).toBe("a\\*b");
    expect(escapeLikePattern("back\\slash")).toBe("back\\\\slash");
  });
});
