"use client";

import { useCallback } from "react";
import {
  CONTROL_ACTIONS,
  labelForCode,
  useSettings,
  type ControlAction,
  type Controls,
} from "@/lib/world/settings";

/**
 * Key placeholders in UI copy: `{key:<ControlAction>}` renders the key the
 * player currently has bound (e.g. `{key:journal}` → "J"), so help texts,
 * tips and the handbook never show a stale default after rebinding.
 */
const KEY_TOKEN = /\{key:([A-Za-z]+)\}/g;

function isAction(name: string): name is ControlAction {
  return (CONTROL_ACTIONS as readonly string[]).includes(name);
}

/** Replace every `{key:action}` token with the current key label. Unknown actions stay as-is. */
export function withKeys(text: string, controls: Readonly<Controls>): string {
  return text.replace(KEY_TOKEN, (token, name: string) =>
    isAction(name) ? labelForCode(controls[name]) : token,
  );
}

/** Hook form of {@link withKeys}, bound to the live settings. */
export function useKeyText(): (text: string) => string {
  const [settings] = useSettings();
  const controls = settings.controls;
  return useCallback((text: string) => withKeys(text, controls), [controls]);
}
