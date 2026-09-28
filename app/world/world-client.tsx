"use client";

import dynamic from "next/dynamic";
import { useEffect, useSyncExternalStore } from "react";
import { isEmbeddedFrame, requestCloseTerminal } from "@/lib/terminal/embed";

const LabWorld = dynamic(() => import("@/components/world/LabWorld").then((m) => m.LabWorld), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#07080b]" />,
});

const noopSubscribe = (): (() => void) => () => {};

export function WorldClient() {
  // Framed = reached from inside the terminal overlay (a link or command
  // that navigated to /world). Never nest the world in itself: close the
  // overlay instead, the world is already running underneath.
  const framed = useSyncExternalStore(noopSubscribe, isEmbeddedFrame, () => false);
  useEffect(() => {
    if (framed) requestCloseTerminal();
  }, [framed]);
  if (framed) return <div className="fixed inset-0 bg-[#07080b]" />;
  return <LabWorld />;
}
