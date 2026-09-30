/**
 * Tab / page lifecycle of the audio engine: whatever order visibility,
 * gestures and the context's own promises arrive in, the context ends up
 * running when the page is visible (and unlocked) and suspended otherwise.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioSystem } from "@/lib/world/audio/engine";
import { mulberry32 } from "@/lib/world/audio/synth";

// ── A fake AudioContext whose suspend / resume promises the test settles ──

interface Pending {
  kind: "resume" | "suspend";
  settle: () => void;
  fail: () => void;
}

interface Ctl {
  ctx: AudioContext;
  pending: Pending[];
  /** Settle the oldest (or a chosen) pending call. */
  flush: (index?: number) => void;
  /** Settle everything, repeatedly, until nothing is pending. */
  flushAll: () => Promise<void>;
  setState: (s: string) => void;
  created: () => number;
  advance: (seconds: number) => void;
}

function fakeParam(): Record<string, unknown> {
  const p: Record<string, unknown> = { value: 0 };
  for (const m of [
    "setValueAtTime",
    "linearRampToValueAtTime",
    "exponentialRampToValueAtTime",
    "setTargetAtTime",
    "cancelScheduledValues",
  ])
    p[m] = () => p;
  return p;
}

function makeCtl(opts: { autoSettle?: boolean } = {}): Ctl {
  const pending: Pending[] = [];
  const listeners: (() => void)[] = [];
  const node = (): Record<string, unknown> => {
    const n: Record<string, unknown> = {
      connect: (to: unknown) => to,
      disconnect: () => undefined,
      start: () => undefined,
      stop: () => undefined,
      onended: null,
      type: "",
      buffer: null,
      loop: false,
    };
    for (const p of [
      "gain",
      "frequency",
      "detune",
      "Q",
      "pan",
      "delayTime",
      "threshold",
      "knee",
      "ratio",
    ])
      n[p] = fakeParam();
    return n;
  };
  const ctx: Record<string, unknown> = {
    state: "suspended",
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    addEventListener: (type: string, f: () => void) => {
      if (type === "statechange") listeners.push(f);
    },
    createBuffer: (channels: number, len: number) => {
      const data = Array.from({ length: channels }, () => new Float32Array(len));
      return { duration: len / 8000, length: len, getChannelData: (c: number) => data[c]! };
    },
    close: async () => {
      ctx.state = "closed";
    },
  };
  const call = (kind: "resume" | "suspend") =>
    new Promise<void>((resolve, reject) => {
      const p: Pending = {
        kind,
        settle: () => {
          ctx.state = kind === "resume" ? "running" : "suspended";
          resolve();
        },
        fail: () => reject(new Error("blocked")),
      };
      if (opts.autoSettle) p.settle();
      else pending.push(p);
    });
  ctx.resume = () => call("resume");
  ctx.suspend = () => call("suspend");
  for (const kind of [
    "Gain",
    "Oscillator",
    "BiquadFilter",
    "BufferSource",
    "StereoPanner",
    "Delay",
    "DynamicsCompressor",
  ])
    ctx[`create${kind}`] = node;
  let made = 0;
  const flush = (index = 0) => {
    const p = pending.splice(index, 1)[0];
    p?.settle();
  };
  return {
    ctx: ctx as unknown as AudioContext,
    pending,
    flush,
    flushAll: async () => {
      for (let i = 0; i < 50; i++) {
        await tick();
        if (!pending.length) {
          await tick();
          if (!pending.length) return;
        }
        while (pending.length) flush();
      }
    },
    setState: (s) => {
      ctx.state = s;
      for (const f of listeners) f();
    },
    created: () => {
      made++;
      return made;
    },
    advance: (seconds) => {
      ctx.currentTime = (ctx.currentTime as number) + seconds;
    },
  };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
});

describe("tab visibility race (the silent-after-alt-tab bug)", () => {
  it("returning before suspend() settles still ends running", async () => {
    const c = makeCtl();
    const audio = new AudioSystem({ createContext: () => c.ctx });
    const r = audio.resume();
    await c.flushAll();
    await r;
    expect(audio.running).toBe(true);
    // Hide: suspend() is issued but the browser has not settled it yet …
    const hide = audio.setHidden(true);
    await tick();
    expect(c.pending.map((p) => p.kind)).toEqual(["suspend"]);
    // … and the player is already back.
    const show = audio.setHidden(false);
    // Now the late suspend lands (the old code resumed nothing here → silence).
    c.flush();
    await c.flushAll();
    await Promise.all([hide, show]);
    expect(c.ctx.state).toBe("running");
    expect(audio.running).toBe(true);
    audio.dispose();
  });

  it("any order of hide / show / settle ends in the state of the last call", async () => {
    const rnd = mulberry32(42);
    for (let round = 0; round < 60; round++) {
      const c = makeCtl();
      const audio = new AudioSystem({ createContext: () => c.ctx });
      void audio.resume();
      await c.flushAll();
      let hidden = false;
      const ops: Promise<void>[] = [];
      for (let i = 0; i < 8; i++) {
        const r = rnd();
        if (r < 0.45) {
          hidden = !hidden;
          ops.push(audio.setHidden(hidden));
        } else if (r < 0.6) {
          ops.push(audio.resume());
        } else if (c.pending.length) {
          // Settle a random pending call (out of order).
          c.flush(Math.floor(rnd() * c.pending.length));
        }
        await tick();
      }
      await c.flushAll();
      await Promise.all(ops);
      expect(c.ctx.state, `round ${round}`).toBe(hidden ? "suspended" : "running");
      audio.dispose();
    }
  });

  it("a gesture while hidden only unlocks; showing the tab starts audio", async () => {
    const c = makeCtl({ autoSettle: true });
    let created = 0;
    const audio = new AudioSystem({
      createContext: () => {
        created++;
        return c.ctx;
      },
    });
    await audio.setHidden(true);
    await audio.resume();
    expect(created).toBe(0);
    expect(audio.isUnlocked).toBe(true);
    await audio.setHidden(false);
    expect(created).toBe(1);
    expect(audio.running).toBe(true);
    audio.dispose();
  });
});

describe("recovery", () => {
  it("a hung resume() times out; the watchdog brings the context back", async () => {
    vi.useFakeTimers();
    const c = makeCtl();
    const audio = new AudioSystem({ createContext: () => c.ctx });
    void audio.resume();
    // Nobody settles the resume(s): the lifecycle times out instead of hanging.
    await vi.advanceTimersByTimeAsync(2000);
    expect(audio.running).toBe(false);
    // The browser answers the next attempt.
    while (c.pending.length) c.flush();
    c.setState("suspended");
    await vi.advanceTimersByTimeAsync(1100);
    while (c.pending.length) c.flush();
    await vi.advanceTimersByTimeAsync(10);
    expect(audio.running).toBe(true);
    audio.dispose();
  });

  it("Safari's 'interrupted' state is resumed by the statechange hook / watchdog", async () => {
    vi.useFakeTimers();
    const c = makeCtl({ autoSettle: true });
    const audio = new AudioSystem({ createContext: () => c.ctx });
    await audio.resume();
    expect(audio.running).toBe(true);
    const before = audio.resumeCalls;
    c.setState("interrupted");
    await vi.advanceTimersByTimeAsync(1200);
    expect(c.ctx.state).toBe("running");
    expect(audio.resumeCalls).toBeGreaterThan(before);
    // While hidden an interruption stays suspended.
    await audio.setHidden(true);
    c.setState("interrupted");
    await vi.advanceTimersByTimeAsync(2500);
    expect(c.ctx.state).toBe("interrupted");
    await audio.setHidden(false);
    await vi.advanceTimersByTimeAsync(10);
    expect(c.ctx.state).toBe("running");
    audio.dispose();
  });

  it("the watchdog catches a missed visibilitychange via the page probe", async () => {
    vi.useFakeTimers();
    const c = makeCtl({ autoSettle: true });
    const audio = new AudioSystem({ createContext: () => c.ctx });
    const win = new EventTarget() as unknown as Window;
    const doc = Object.assign(new EventTarget(), { hidden: false }) as unknown as Document & {
      hidden: boolean;
    };
    const unbind = audio.bindPageLifecycle({ win, doc });
    await audio.resume();
    // The page went hidden and back without us hearing about it … then hidden for real.
    (doc as { hidden: boolean }).hidden = true;
    await vi.advanceTimersByTimeAsync(1100);
    expect(audio.isHidden).toBe(true);
    expect(c.ctx.state).toBe("suspended");
    (doc as { hidden: boolean }).hidden = false;
    await vi.advanceTimersByTimeAsync(1100);
    expect(c.ctx.state).toBe("running");
    unbind();
    audio.dispose();
  });
});

describe("page lifecycle binding", () => {
  it("wires gestures, visibility, bfcache and focus", async () => {
    const c = makeCtl({ autoSettle: true });
    const audio = new AudioSystem({ createContext: () => c.ctx });
    const win = new EventTarget() as unknown as Window;
    const doc = Object.assign(new EventTarget(), { hidden: false }) as unknown as Document;
    let gestures = 0;
    const unbind = audio.bindPageLifecycle({ win, doc, onGesture: () => gestures++ });
    const settle = async () => {
      for (let i = 0; i < 5; i++) await tick();
    };
    win.dispatchEvent(new Event("pointerdown"));
    await settle();
    expect(gestures).toBe(1);
    expect(audio.running).toBe(true);
    // Tab hidden → suspended; visible → running.
    (doc as { hidden: boolean }).hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(c.ctx.state).toBe("suspended");
    (doc as { hidden: boolean }).hidden = false;
    doc.dispatchEvent(new Event("visibilitychange"));
    await settle();
    expect(c.ctx.state).toBe("running");
    // bfcache: pagehide suspends, pageshow restores.
    win.dispatchEvent(new Event("pagehide"));
    await settle();
    expect(c.ctx.state).toBe("suspended");
    win.dispatchEvent(new Event("pageshow"));
    await settle();
    expect(c.ctx.state).toBe("running");
    // A context stopped behind our back comes back on focus.
    c.setState("suspended");
    win.dispatchEvent(new Event("focus"));
    await settle();
    expect(c.ctx.state).toBe("running");
    unbind();
    win.dispatchEvent(new Event("keydown"));
    expect(gestures).toBe(1);
    audio.dispose();
  });
});

describe("music after a suspend", () => {
  it("songs keep their place, never burst and move on after ending in the background", async () => {
    vi.useFakeTimers();
    const c = makeCtl({ autoSettle: true });
    const audio = new AudioSystem({ createContext: () => c.ctx });
    audio.setMusicPrefs({ length: "standard" });
    await audio.resume();
    audio.setMusicState({ floor: 0, progress: 0, tension: 0, style: "calm" });
    await vi.advanceTimersByTimeAsync(200);
    const first = audio.nowPlaying();
    expect(first?.song.genre).toBe("calm");
    // A throttled background tab: the audio clock runs on for 20 minutes while
    // no timers fire (the song ended long ago).
    c.advance(1200);
    let creations = 0;
    const orig = c.ctx.createOscillator.bind(c.ctx);
    (c.ctx as unknown as Record<string, unknown>).createOscillator = () => {
      creations++;
      return orig();
    };
    await vi.advanceTimersByTimeAsync(200);
    // No burst of a whole song's worth of notes: at most a few bars were scheduled.
    expect(creations).toBeLessThan(400);
    const next = audio.nowPlaying();
    expect(next).not.toBeNull();
    expect(next!.song.id).not.toBe(first!.song.id);
    // The new song starts now, not in the past.
    expect(next!.seconds).toBeLessThan(5);
    audio.dispose();
  });
});
