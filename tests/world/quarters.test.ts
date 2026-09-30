import { describe, expect, it } from "vitest";
import { interiorFor, interiorReport } from "@/lib/world/content/interior";
import { PROPS, roomAt } from "@/lib/world/content/map";
import { PC_PROP } from "@/lib/world/content/quarters";
import { DECOR_ACTION_BY_ID, PROP_VARIANT_DECOR } from "@/lib/world/content/decor-actions";
import { initialState } from "@/lib/world/game";
import { addMemo, boardPlace, PIN_DECOR } from "@/lib/world/memos";
import { DECOR_BY_ID, decorVisual } from "@/lib/world/models/decor";
import {
  drawScreen,
  NOTE_CARD_COLORS,
  pinnedCards,
  screenInfo,
  shortNoteTitle,
  type ScreenCtx,
} from "@/lib/world/screen-content";
import type { ScreenSpec } from "@/lib/world/models/anim";

function stubCtx(): ScreenCtx & { fills: string[] } {
  const ctx = {
    fills: [] as string[],
    fillStyle: "#000",
    globalAlpha: 1,
    fillRect() {
      ctx.fills.push(String(ctx.fillStyle));
    },
  };
  return ctx;
}

const jadeq = () => interiorFor(4).filter((p) => p.id.startsWith("decor:jadeq:"));

describe("Jade's Quarters — refurnished", () => {
  it("places every authored piece of her room (nothing dropped)", () => {
    const dropped = interiorReport(4).dropped.filter((d) => d.startsWith("jadeq:"));
    expect(dropped).toEqual([]);
    const decors = new Set(jadeq().map((p) => p.decor));
    for (const d of [
      "study_desk",
      "cork_board_live",
      "armchair",
      "floor_lamp",
      "book_stack",
      "wardrobe",
      "photo_wall",
    ])
      expect(decors, d).toContain(d);
  });

  it("keeps the archive's placement ids stable", () => {
    const at = new Map(jadeq().map((p) => [p.id, p.decor]));
    expect(at.get("decor:jadeq:a0")).toBe("bookshelf_jade");
    expect(at.get("decor:jadeq:a2")).toBe("star_chart");
    expect(at.get("decor:jadeq:a6")).toBe("filing_cabinet");
  });

  it("has her computer as an interactable prop in her room", () => {
    const pc = PROPS.find((p) => p.id === PC_PROP);
    expect(pc).toBeDefined();
    expect(roomAt(pc!.floor, pc!.x, pc!.z)?.id).toBe("jadeq");
    expect(PROP_VARIANT_DECOR[pc!.variant ?? ""]).toBe("jade_workstation");
    expect(decorVisual("jade_workstation")?.screens?.length).toBe(2);
  });

  it("gives the new furniture flavour actions", () => {
    expect(DECOR_ACTION_BY_ID.get("wardrobe")).toBeDefined();
    expect(DECOR_ACTION_BY_ID.get("armchair@jadeq")?.room).toBe("jadeq");
    expect(DECOR_ACTION_BY_ID.get("photo_wall")).toBeDefined();
  });
});

describe("live pinboards", () => {
  it("cork_board_live is a pin board with a 'notes' screen that needs no power", () => {
    expect(PIN_DECOR.has("cork_board_live")).toBe(true);
    expect(DECOR_BY_ID.get("cork_board_live")?.wall).toBe(true);
    const sp = decorVisual("cork_board_live")?.screens?.[0];
    expect(sp?.content).toBe("notes");
    expect(sp?.requiresPower).toBe(false);
  });

  it("hangs one in her room and one on the residential corridor", () => {
    const live = interiorFor(4).filter((p) => p.decor === "cork_board_live");
    const rooms = new Set(live.map((p) => p.id.split(":")[1]));
    expect(rooms).toContain("jadeq");
    expect(rooms).toContain("wohnflur");
  });

  it("shows the memos pinned to that very placement, oldest first", () => {
    const s = initialState();
    const board = jadeq().find((p) => p.decor === "cork_board_live")!;
    const other = "decor:wohnflur:a13";
    s.playTime = 10;
    addMemo(s, { title: "Cerulean frequency notes", text: "x", place: boardPlace(board.id) });
    s.playTime = 20;
    addMemo(s, { title: "Coffee", text: "y", place: boardPlace(board.id) });
    addMemo(s, { title: "Elsewhere", text: "z", place: boardPlace(other) });
    addMemo(s, { title: "In my head", text: "w" });
    const cards = pinnedCards(s, board.id);
    expect(cards.map((c) => c.title)).toEqual(["Cerulean", "Coffee"]);
    const info = screenInfo(s, undefined, "jadeq", new Date(0), board.id);
    expect(info.pinned?.length).toBe(2);
    expect(screenInfo(s, undefined, "jadeq", new Date(0)).pinned).toBeUndefined();
  });

  it("shortens titles to one or two words", () => {
    expect(shortNoteTitle("  Resonance   at 4.2 Hz ")).toBe("Resonance at");
    expect(shortNoteTitle("Superconductivity measurements")).toBe("Superconductivit");
    expect(shortNoteTitle("")).toBe("");
  });
});

describe("notes screen", () => {
  const spec: ScreenSpec = {
    center: [6, 5, 1],
    w: 5,
    h: 4,
    normal: "+z",
    content: "notes",
    requiresPower: false,
  };

  it("draws coloured cards for pinned memos and a hint when empty", () => {
    const s = initialState();
    const board = "decor:jadeq:a16";
    for (let i = 0; i < 9; i++) {
      s.playTime = i;
      addMemo(s, {
        title: `Memo ${i}`,
        text: "t",
        place: boardPlace(board),
        source: { kind: i % 2 ? "insight" : "custom" },
      });
    }
    for (const [w, h] of [
      [32, 24],
      [80, 64],
      [160, 96],
    ] as const) {
      const full = stubCtx();
      drawScreen(full, w, h, spec, screenInfo(s, undefined, "jadeq", new Date(0), board), 1.5);
      expect(full.fills).toContain(NOTE_CARD_COLORS[0]);
      expect(full.globalAlpha).toBe(1);
      const empty = stubCtx();
      drawScreen(empty, w, h, spec, screenInfo(s, undefined, "jadeq", new Date(0), "x"), 1.5);
      expect(empty.fills).not.toContain(NOTE_CARD_COLORS[3]);
    }
    const big = stubCtx();
    drawScreen(big, 160, 96, spec, screenInfo(s, undefined, "jadeq", new Date(0), board), 1.5);
    expect(big.fills).toContain(NOTE_CARD_COLORS[3]); // insight cards are blue
  });
});
