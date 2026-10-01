import { notFound } from "next/navigation";
import { StudioClient } from "./studio-client";

export const metadata = { title: "_unLABS · Hero Studio" };

/** Dev-only photo studio for the hero characters (never shipped in production builds). */
export default function StudioPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <StudioClient />;
}
