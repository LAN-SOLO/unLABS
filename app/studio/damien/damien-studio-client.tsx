"use client";

import dynamic from "next/dynamic";

const DamienStudio = dynamic(
  () => import("@/components/world/hero/DamienStudio").then((m) => m.DamienStudio),
  { ssr: false },
);

export function DamienStudioClient() {
  return <DamienStudio />;
}
