import { existsSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MerchShop, TitleScreen } from "@/components/world/menu";
import {
  MERCH_COLLECTIONS,
  MERCH_PRODUCTS,
  SIZES,
  SIZE_WIDTH_CM,
  COLOR_LABEL,
  catalogueDesigns,
  previewFile,
  productColors,
  productUrl,
} from "@/lib/world/merch";
import { GARMENTS, GARMENT_COLORS, INK_IDS, MOCKUP_COLORS } from "@/lib/world/merch-garments";
import { _resetSettingsCache } from "@/lib/world/settings";

beforeEach(() => {
  localStorage.clear();
  _resetSettingsCache();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

describe("merch catalogue", () => {
  it("has unique ids, a printed side, a collection and a sane price", () => {
    const ids = new Set<string>();
    for (const p of MERCH_PRODUCTS) {
      expect(ids.has(p.id), p.id).toBe(false);
      ids.add(p.id);
      expect(p.print.front || p.print.back, p.id).toBeTruthy();
      expect(
        MERCH_COLLECTIONS.some((c) => c.id === p.collection),
        p.id,
      ).toBe(true);
      expect(p.price, p.id).toBeGreaterThan(p.kind === "hoodie" ? 40 : 15);
      expect(productColors(p).length, p.id).toBeGreaterThan(0);
    }
    expect(MERCH_PRODUCTS.filter((p) => p.kind === "shirt").length).toBeGreaterThanOrEqual(15);
    expect(MERCH_PRODUCTS.filter((p) => p.kind === "hoodie").length).toBeGreaterThanOrEqual(6);
    expect(MERCH_PRODUCTS.filter((p) => p.kind === "kids").length).toBeGreaterThanOrEqual(4);
  });

  it("offers only garment colours of the product's ink sets, featured colour first", () => {
    for (const p of MERCH_PRODUCTS) {
      for (const c of productColors(p)) {
        expect(p.inks, `${p.id}: ${c.id}`).toContain(c.ink);
        if (p.kind === "kids") expect(c.kids, `${p.id}: ${c.id}`).toBe(true);
      }
      if (p.color) expect(productColors(p)[0]?.id, p.id).toBe(p.color);
    }
  });

  it("has coloured garments — shirts and hoodies — beyond black and white", () => {
    for (const ink of INK_IDS) {
      expect(
        GARMENT_COLORS.some((c) => c.ink === ink),
        ink,
      ).toBe(true);
      for (const id of MOCKUP_COLORS[ink])
        expect(GARMENT_COLORS.find((c) => c.id === id)?.ink, id).toBe(ink);
    }
    for (const c of GARMENT_COLORS) expect(COLOR_LABEL[c.id], c.id).toBeTruthy();
    const coloured = (k: string) =>
      MERCH_PRODUCTS.filter(
        (p) => p.kind === k && p.inks.includes("pop") && p.inks.includes("pastel"),
      );
    expect(coloured("shirt").length).toBeGreaterThanOrEqual(8);
    expect(coloured("hoodie").length).toBeGreaterThanOrEqual(5);
  });

  it("every motif has its rendered shop preview per ink set (node scripts/merch/render.ts)", () => {
    // render.ts only writes the ink sets a design declares, so this also checks
    // that no product offers a colour its motif was never drawn for.
    const dir = join(process.cwd(), "public/merch/designs");
    for (const d of catalogueDesigns())
      for (const ink of d.inks)
        expect(existsSync(join(dir, previewFile(d.id, ink))), `${d.id}/${ink}`).toBe(true);
  });

  it("size charts match the sizes and print areas fit on the garment", () => {
    for (const k of ["shirt", "hoodie", "kids"] as const) {
      expect(SIZE_WIDTH_CM[k].length).toBe(SIZES[k].length);
      const g = GARMENTS[k];
      for (const side of ["front", "back"] as const) {
        const a = g.print[side];
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x + a.w).toBeLessThanOrEqual(g.vw);
        expect(a.y + a.h).toBeLessThanOrEqual(g.vh);
      }
    }
  });

  it("has the bot squad drop: voxel-art bots on shirts, hoodies and kids tees", () => {
    const bots = MERCH_PRODUCTS.filter((p) => p.collection === "bots");
    expect(bots.filter((p) => p.kind === "shirt").length).toBeGreaterThanOrEqual(8);
    expect(bots.filter((p) => p.kind === "hoodie").length).toBeGreaterThanOrEqual(4);
    // Existing design ids stay referenced (the in-game wardrobe uses them).
    const designs = new Set(catalogueDesigns().map((d) => d.id));
    for (const id of [
      "logo-classic",
      "do-not-lick",
      "status-418",
      "bot-lineup",
      "residual-charge",
      "night-shift",
    ])
      expect(designs.has(id), id).toBe(true);
  });

  it("without a configured shop URL there is no order link", () => {
    expect(productUrl(MERCH_PRODUCTS[0]!, "black", "M")).toBe("");
  });
});

describe("merch shop UI", () => {
  it("lists products, filters by kind, opens a product and keeps a wishlist", () => {
    render(<MerchShop onClose={() => {}} />);
    expect(screen.getByText("_unLAB Classic")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Kids" }));
    expect(screen.queryByText("_unLAB Classic")).toBeNull();
    fireEvent.click(screen.getByText("Finder of Lost Socks"));
    expect(screen.getByText("Shop opens soon")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "122/128" }));
    expect(screen.getByText(/Size: 122\/128/)).toBeTruthy();
    fireEvent.click(screen.getByText("♡ Wishlist"));
    expect(JSON.parse(localStorage.getItem("unlabs.merch.wishlist.v1") ?? "[]")).toEqual([
      "kids-finder",
    ]);
    fireEvent.click(screen.getByText("← All products"));
    fireEvent.click(screen.getByRole("tab", { name: /Wishlist/ }));
    expect(screen.getByText("Finder of Lost Socks")).toBeTruthy();
  });

  it("is reachable from the title screen", () => {
    render(
      <TitleScreen
        onContinue={() => {}}
        onNewGame={() => {}}
        onLoad={() => {}}
        onTerminal={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Merch"));
    expect(screen.getByRole("dialog", { name: "Merch" })).toBeTruthy();
  });
});
