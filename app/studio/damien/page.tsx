import { notFound } from "next/navigation";
import { DamienStudioClient } from "./damien-studio-client";

export const metadata = { title: "_unLABS · Damien Studio" };

/** Dev-only studio for the veiled hero Damien (never shipped in production builds). */
export default function DamienStudioPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DamienStudioClient />;
}
