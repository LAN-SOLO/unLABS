"use client";

import dynamic from "next/dynamic";

const HeroStudio = dynamic(
  () => import("@/components/world/hero/HeroStudio").then((m) => m.HeroStudio),
  {
    ssr: false,
  },
);

export function StudioClient() {
  return <HeroStudio />;
}
