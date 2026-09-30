"use client";

import { useMemo, useState } from "react";
import { fmtNum } from "@/components/world/format";
import { CrtButton, MenuPanel } from "@/components/world/menu/shared";
import { tr } from "@/lib/i18n";
import {
  COLOR_LABEL,
  KIND_LABEL,
  KIND_SPEC,
  MERCH_COLLECTIONS,
  MERCH_PRODUCTS,
  SIZES,
  SIZE_WIDTH_CM,
  designPreview,
  productColors,
  productUrl,
  type MerchCollection,
  type MerchProduct,
} from "@/lib/world/merch";
import {
  GARMENTS,
  type GarmentColor,
  type GarmentKind,
  type PrintSide,
} from "@/lib/world/merch-garments";

const WISHLIST_KEY = "unlabs.merch.wishlist.v1";

function readWishlist(): string[] {
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeWishlist(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  } catch {
    // Private mode / blocked storage: the wishlist just is not remembered.
  }
}

function price(v: number): string {
  return tr("{price} €", { price: fmtNum(v, 2) });
}

const BADGE: Record<NonNullable<MerchProduct["badge"]>, { label: string; color: string }> = {
  new: { label: tr("merch::New"), color: "#00FFFF" },
  bestseller: { label: tr("Bestseller"), color: "#FFB800" },
  limited: { label: tr("Limited"), color: "#FF4FD8" },
};

/** Flat garment silhouette in the chosen colour with the motif on its print area. */
export function GarmentMockup({
  kind,
  color,
  design,
  side,
  className = "",
}: {
  kind: GarmentKind;
  color: GarmentColor;
  design: string | undefined;
  side: PrintSide;
  className?: string;
}) {
  const g = GARMENTS[kind];
  const p = g.print[side];
  const shade = color.light ? "#00000026" : "#00000080";
  const gid = `merch-shade-${kind}`;
  return (
    <svg viewBox={`0 0 ${g.vw} ${g.vh}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".28" />
          <stop offset=".25" stopColor="#000" stopOpacity="0" />
          <stop offset=".75" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".28" />
        </linearGradient>
      </defs>
      <path d={g.body} fill={color.hex} />
      <path d={g.body} fill={`url(#${gid})`} />
      <path d={side === "front" ? g.frontNeck : g.backNeck} fill={shade} />
      <path
        d={side === "front" ? g.details.front : g.details.back}
        fill="none"
        stroke={shade}
        strokeWidth={3}
        strokeLinecap="round"
      />
      {design && (
        <image
          href={designPreview(design, color)}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          preserveAspectRatio="xMidYMin meet"
        />
      )}
    </svg>
  );
}

type KindFilter = "all" | GarmentKind | "wishlist";

const KIND_TABS: readonly { id: KindFilter; label: string }[] = [
  { id: "all", label: tr("merch::All") },
  { id: "shirt", label: tr("T-shirts") },
  { id: "hoodie", label: tr("Hoodies") },
  { id: "kids", label: tr("Kids") },
  { id: "wishlist", label: tr("Wishlist") },
];

function firstSide(p: MerchProduct): PrintSide {
  return p.print.front ? "front" : "back";
}

function ProductCard({
  p,
  wished,
  onOpen,
}: {
  p: MerchProduct;
  wished: boolean;
  onOpen: () => void;
}) {
  const colors = productColors(p);
  const color = colors[0]!;
  const side = firstSide(p);
  const badge = p.badge ? BADGE[p.badge] : undefined;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex flex-col rounded-sm border border-[#33FF33]/20 bg-black/40 p-2 text-left transition-colors hover:border-[#FFB800]/70 hover:bg-[#FFB800]/5 focus-visible:outline-2 focus-visible:outline-[#00FFFF]"
    >
      {badge && (
        <span
          className="absolute top-2 left-2 z-10 rounded-sm border px-1.5 text-[9px] tracking-widest uppercase"
          style={{ color: badge.color, borderColor: `${badge.color}88` }}
        >
          {badge.label}
        </span>
      )}
      {wished && (
        <span
          className="absolute top-2 right-2 z-10 text-xs text-[#FF4FD8]"
          aria-label={tr("On your wishlist")}
        >
          ♥
        </span>
      )}
      <div className="aspect-square w-full rounded-sm bg-[#1b1d20] p-2">
        <GarmentMockup
          kind={p.kind}
          color={color}
          design={p.print[side]}
          side={side}
          className="h-full w-full transition-transform duration-200 group-hover:scale-[1.04]"
        />
      </div>
      <span className="mt-2 text-[10px] tracking-widest text-[#33FF33]/50 uppercase">
        {KIND_LABEL[p.kind]}
        {p.print.front && p.print.back ? ` · ${tr("front + back")}` : ""}
      </span>
      <span className="text-sm leading-tight text-[#d8ffd8]">{p.name}</span>
      <span className="mt-1 flex items-center justify-between gap-2">
        <span className="text-xs text-[#FFB800]">{price(p.price)}</span>
        <span
          className="flex items-center gap-0.5"
          title={tr("{n} colours", { n: colors.length })}
          aria-label={tr("{n} colours", { n: colors.length })}
        >
          {colors.slice(0, 6).map((c) => (
            <span
              key={c.id}
              className="h-2.5 w-2.5 rounded-full border border-white/20"
              style={{ background: c.hex }}
            />
          ))}
          {colors.length > 6 && (
            <span className="text-[9px] text-[#33FF33]/50">+{colors.length - 6}</span>
          )}
        </span>
      </span>
    </button>
  );
}

function ProductDetail({
  p,
  wished,
  onToggleWish,
  onBack,
}: {
  p: MerchProduct;
  wished: boolean;
  onToggleWish: () => void;
  onBack: () => void;
}) {
  const colors = productColors(p);
  const [colorId, setColorId] = useState(colors[0]!.id);
  const color = colors.find((c) => c.id === colorId) ?? colors[0]!;
  const [side, setSide] = useState<PrintSide>(firstSide(p));
  const sizes = SIZES[p.kind];
  const [size, setSize] = useState(sizes[Math.min(2, sizes.length - 1)]!);
  const width = SIZE_WIDTH_CM[p.kind][sizes.indexOf(size)];
  const spec = KIND_SPEC[p.kind];
  const url = productUrl(p, color.id, size);
  const both = !!(p.print.front && p.print.back);

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <div className="flex flex-col gap-2 md:w-1/2">
        <div className="relative aspect-square w-full rounded-sm border border-[#33FF33]/15 bg-[#1b1d20] p-4">
          <GarmentMockup
            kind={p.kind}
            color={color}
            design={p.print[side]}
            side={side}
            className="h-full w-full"
          />
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label={tr("Side")}>
          {(["front", "back"] as const).map((s) => (
            <CrtButton
              key={s}
              tone={side === s ? "amber" : "green"}
              role="radio"
              aria-checked={side === s}
              onClick={() => setSide(s)}
            >
              {s === "front" ? tr("garment::Front") : tr("garment::Back")}
              {!p.print[s] ? ` · ${tr("blank")}` : ""}
            </CrtButton>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:w-1/2">
        <div>
          <p className="text-[10px] tracking-widest text-[#33FF33]/50 uppercase">
            {KIND_LABEL[p.kind]} · {MERCH_COLLECTIONS.find((c) => c.id === p.collection)?.label}
          </p>
          <h3 className="text-lg leading-tight text-[#d8ffd8]">{p.name}</h3>
          <p className="mt-1 text-xl text-[#FFB800]">{price(p.price)}</p>
          <p className="text-[10px] text-[#33FF33]/40">
            {both ? tr("Printed front and back.") : tr("One-sided print.")}{" "}
            {tr("Recommended retail price incl. VAT, plus shipping.")}
          </p>
        </div>
        <p className="text-xs text-[#d8ffd8]/80">{p.blurb}</p>

        <div>
          <p className="mb-1 text-[10px] tracking-widest text-[#33FF33]/60 uppercase">
            {tr("Colour: {name}", { name: COLOR_LABEL[color.id] ?? color.name })}
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr("Colour")}>
            {colors.map((c) => (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={c.id === color.id}
                aria-label={COLOR_LABEL[c.id] ?? c.name}
                title={COLOR_LABEL[c.id] ?? c.name}
                onClick={() => setColorId(c.id)}
                className={`h-7 w-7 rounded-full border-2 focus-visible:outline-2 focus-visible:outline-[#00FFFF] ${c.id === color.id ? "border-[#FFB800]" : "border-[#33FF33]/25"}`}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[10px] tracking-widest text-[#33FF33]/60 uppercase">
            {tr("Size: {size}", { size })}
            {width ? ` · ${tr("{cm} cm chest width (flat)", { cm: fmtNum(width, 1) })}` : ""}
          </p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("Size")}>
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={s === size}
                onClick={() => setSize(s)}
                className={`min-w-10 rounded-sm border px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-[#00FFFF] ${s === size ? "border-[#FFB800] text-[#FFB800]" : "border-[#33FF33]/25 text-[#33FF33]/70 hover:border-[#33FF33]/60"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
          <dt className="text-[#33FF33]/50">{tr("Garment")}</dt>
          <dd className="text-[#d8ffd8]/80">{spec.model}</dd>
          <dt className="text-[#33FF33]/50">{tr("Material")}</dt>
          <dd className="text-[#d8ffd8]/80">{spec.material}</dd>
          <dt className="text-[#33FF33]/50">{tr("merch::Print")}</dt>
          <dd className="text-[#d8ffd8]/80">
            {tr("Direct-to-garment, printed on demand in Germany")}
          </dd>
        </dl>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm border border-[#FFB800] bg-[#FFB800]/15 px-4 py-2 text-xs tracking-widest text-[#FFB800] uppercase hover:bg-[#FFB800]/25 focus-visible:outline-2 focus-visible:outline-[#00FFFF]"
            >
              {tr("Order in the shop ↗")}
            </a>
          ) : (
            <span className="rounded-sm border border-dashed border-[#FFB800]/50 px-4 py-2 text-xs tracking-widest text-[#FFB800]/80 uppercase">
              {tr("Shop opens soon")}
            </span>
          )}
          <CrtButton tone={wished ? "red" : "cyan"} onClick={onToggleWish} aria-pressed={wished}>
            {wished ? tr("♥ On the wishlist") : tr("♡ Wishlist")}
          </CrtButton>
          <CrtButton tone="amber" onClick={onBack}>
            {tr("← All products")}
          </CrtButton>
        </div>
      </div>
    </div>
  );
}

/** The lab's merch shop: organic shirts, hoodies and kids' shirts. */
export function MerchShop({ onClose, z = 80 }: { onClose: () => void; z?: number }) {
  const [kind, setKind] = useState<KindFilter>("all");
  const [collection, setCollection] = useState<MerchCollection | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readWishlist(),
  );

  const toggleWish = (id: string) => {
    setWishlist((w) => {
      const next = w.includes(id) ? w.filter((x) => x !== id) : [...w, id];
      writeWishlist(next);
      return next;
    });
  };

  const products = useMemo(
    () =>
      MERCH_PRODUCTS.filter((p) =>
        kind === "wishlist" ? wishlist.includes(p.id) : kind === "all" || p.kind === kind,
      ).filter((p) => !collection || p.collection === collection),
    [kind, collection, wishlist],
  );
  const open = openId ? MERCH_PRODUCTS.find((p) => p.id === openId) : undefined;

  return (
    <MenuPanel
      title={tr("Merch")}
      subtitle={tr(
        "Organic shirts and hoodies straight from the lab — printed on demand, one piece at a time.",
      )}
      wide
      z={z}
      onClose={open ? () => setOpenId(null) : onClose}
    >
      {open ? (
        <ProductDetail
          key={open.id}
          p={open}
          wished={wishlist.includes(open.id)}
          onToggleWish={() => toggleWish(open.id)}
          onBack={() => setOpenId(null)}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={tr("Product type")}>
            {KIND_TABS.map((t) => (
              <CrtButton
                key={t.id}
                role="tab"
                aria-selected={kind === t.id}
                tone={kind === t.id ? "amber" : "green"}
                onClick={() => setKind(t.id)}
              >
                {t.label}
                {t.id === "wishlist" && wishlist.length ? ` (${wishlist.length})` : ""}
              </CrtButton>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label={tr("Collections")}>
            {MERCH_COLLECTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={collection === c.id}
                onClick={() => setCollection(collection === c.id ? null : c.id)}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] tracking-wider uppercase focus-visible:outline-2 focus-visible:outline-[#00FFFF] ${collection === c.id ? "border-[#00FFFF] text-[#00FFFF]" : "border-[#33FF33]/25 text-[#33FF33]/60 hover:text-[#33FF33]"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {products.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  wished={wishlist.includes(p.id)}
                  onOpen={() => setOpenId(p.id)}
                />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-[#33FF33]/50">
              {kind === "wishlist"
                ? tr("Your wishlist is empty. The MCP is not surprised.")
                : tr("Nothing here. The nothing is gluten-free.")}
            </p>
          )}
          <p className="text-[10px] text-[#33FF33]/40">
            {tr(
              "{n} products · 100 % organic cotton (Stanley/Stella) · printed on demand by Shirtigo, so nothing is overproduced.",
              { n: MERCH_PRODUCTS.length },
            )}
          </p>
        </div>
      )}
    </MenuPanel>
  );
}
