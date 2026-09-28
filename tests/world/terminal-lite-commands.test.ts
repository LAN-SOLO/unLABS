/**
 * Room terminals — the extended shell: roles, mail, locked files, relays and
 * codes through the regular game functions, man pages, history, completion
 * and the secret commands.
 */
import { describe, expect, it } from "vitest";
import { DEVICES } from "@/lib/world/content/devices";
import { NOTES } from "@/lib/world/content/map";
import { ROOM_TERMINALS, ROOM_TERMINAL_BY_ID } from "@/lib/world/content/terminals";
import { initialState, isOnline, isSwitchedOn, power } from "@/lib/world/game";
import {
  COMMANDS,
  applyTerminalEffects,
  codeMatches,
  completeInput,
  expandHistory,
  fileUnlockFlag,
  mailReadFlag,
  normalizeCode,
  runCommand,
  terminalBanner,
  unreadMail,
} from "@/lib/world/terminal-lite";
import type { WorldState } from "@/lib/world/types";

function buildAll(s: WorldState, ids: readonly string[]): void {
  for (const id of ids) {
    const d = DEVICES.find((x) => x.id === id)!;
    s.built[id] = d.stages.length;
    s.discovered[id] = true;
  }
}

function early(): WorldState {
  const s = initialState();
  s.flags.geo_routed = true;
  buildAll(s, ["MCP-000", "UEC-001", "BTK-001", "CLK-001", "VNT-001"]);
  return s;
}

function late(): WorldState {
  const s = early();
  buildAll(
    s,
    DEVICES.map((d) => d.id),
  );
  return s;
}

function run(s: WorldState, input: string, terminalId?: string) {
  return runCommand(s, input, terminalId ? { terminalId } : {});
}

function text(s: WorldState, input: string, terminalId?: string): string {
  return run(s, input, terminalId).lines.join("\n");
}

describe("terminal content", () => {
  it("every terminal has a distinct purpose, unique mail/file ids and a feed", () => {
    const purposes = new Set(ROOM_TERMINALS.map((t) => t.purpose));
    expect(purposes.size).toBe(ROOM_TERMINALS.length);
    const ids = new Set<string>();
    for (const t of ROOM_TERMINALS) {
      expect(t.feed?.length, t.id).toBeGreaterThan(0);
      expect((t.mail?.length ?? 0) + (t.files?.length ?? 0), t.id).toBeGreaterThan(0);
      for (const x of [...(t.mail ?? []), ...(t.files ?? [])]) {
        expect(ids.has(x.id), x.id).toBe(false);
        ids.add(x.id);
      }
      for (const f of t.files ?? []) if (f.code) expect(f.codeHint, f.id).toBeTruthy();
    }
    expect(ROOM_TERMINALS.filter((t) => t.caps?.includes("power")).length).toBeGreaterThan(1);
    expect(ROOM_TERMINALS.filter((t) => t.caps?.includes("signal")).length).toBeGreaterThan(1);
  });

  it("every command runs at every terminal in every phase without mutating the state", () => {
    for (const make of [initialState, early, late]) {
      const s = make();
      s.read[NOTES[0]!.id] = true;
      const before = JSON.stringify(s);
      for (const t of ROOM_TERMINALS)
        for (const c of COMMANDS)
          for (const args of ["", " 1", ` ${NOTES[0]!.id}`, " CLK-001 aus", " 0341"]) {
            const r = runCommand(s, `${c.name}${args}`, { terminalId: t.id, history: ["status"] });
            expect(Array.isArray(r.lines)).toBe(true);
          }
      expect(JSON.stringify(s)).toBe(before);
    }
  });

  it("banner names purpose, unread mail, locked files and access", () => {
    const s = early();
    const b = terminalBanner(s, "term_mcp").join("\n");
    expect(b).toContain(ROOM_TERMINAL_BY_ID.get("term_mcp")!.purpose);
    expect(b).toMatch(/Mail: \d+ unread/);
    expect(b).toContain("locked");
    expect(b).toContain("Relays (switch)");
    expect(terminalBanner(s, "term_kantine").join("\n")).not.toContain("Relays");
  });
});

describe("mail and files", () => {
  it("mail lists, reads and marks mail as read", () => {
    const s = early();
    const list = text(s, "mail", "term_sekundaer");
    expect(text(s, "post", "term_sekundaer")).toBe(list); // German alias
    expect(list).toContain("Tomorrow");
    expect(list).not.toContain("Recording in progress"); // needs ECR-001 online
    const unread = unreadMail(s, "term_sekundaer");
    const r = run(s, "mail 1", "term_sekundaer");
    expect(r.lines.join("\n")).toContain("I won't follow you");
    applyTerminalEffects(s, r.effects, "term_sekundaer");
    expect(s.flags[mailReadFlag("m_dam_morgen")]).toBe(true);
    expect(unreadMail(s, "term_sekundaer")).toBe(unread - 1);
    expect(text(s, "mail 99", "term_sekundaer")).toContain("not found");
    expect(text(s, "mail", "term_hangar")).toContain("Shaft");
  });

  it("locked files need the code from the notes", () => {
    const s = early();
    expect(text(s, "files", "term_archiv")).toContain("[locked]");
    expect(text(s, "dateien", "term_archiv")).toContain("[locked]"); // German alias
    expect(text(s, "cat sperrbestand.847", "term_archiv")).toContain("locked");
    expect(text(s, "unlock sperrbestand.847 848", "term_archiv")).toContain("denied");
    const ok = run(s, "unlock sperrbestand.847 847", "term_archiv");
    expect(ok.lines.join("\n")).toContain("Not chosen. Given.");
    applyTerminalEffects(s, ok.effects, "term_archiv");
    expect(s.flags[fileUnlockFlag("sperrbestand.847")]).toBe(true);
    expect(text(s, "cat sperrbestand.847", "term_archiv")).toContain("Not chosen");
    expect(text(s, "cat katalog.idx", "term_archiv")).toContain("A-089");
    // Codes are normalised: "03:27" works like "0327", "why before how" like "WHYBEFOREHOW".
    expect(text(s, "unlock diagnose_0327.dat 03:27", "term_mcp")).toContain("granted");
    expect(text(s, "entsperren brief_entwurf.txt why before how", "term_sekundaer")).toContain(
      "granted",
    );
    // Word codes also accept their English translation.
    expect(codeMatches("twice", "ZWEIMAL")).toBe(true);
    expect(codeMatches("zwei mal", "ZWEIMAL")).toBe(true);
    expect(codeMatches("thrice", "ZWEIMAL")).toBe(false);
    // Files belong to their terminal.
    expect(text(s, "cat katalog.idx", "term_mcp")).toContain("not found");
    expect(normalizeCode("0x-4f")).toBe("0X4F");
  });

  it("cat still reads notes", () => {
    const s = initialState();
    const n = NOTES[0]!;
    s.read[n.id] = true;
    expect(text(s, `cat ${n.id}`, "term_mcp")).toContain(n.title);
    expect(text(s, "notes", "term_mcp")).toContain(n.id);
    expect(text(s, "notizen", "term_mcp")).toContain(n.id);
  });
});

describe("actions through the game functions", () => {
  it("switch toggles a device like the panel, only at power terminals", () => {
    const s = early();
    expect(text(s, "switch VNT-001 off", "term_kantine")).toContain("no access");
    expect(text(s, "switch MCP-000 off", "term_mcp")).toContain("No.");
    s.discovered["QAN-001"] = true;
    expect(text(s, "switch QAN-001", "term_mcp")).toContain("not built");
    const r = run(s, "schalte vnt-001 aus", "term_mcp"); // German alias + mode
    expect(r.effects?.actions).toEqual([{ kind: "toggle", device: "VNT-001", on: false }]);
    expect(isSwitchedOn(s, "VNT-001")).toBe(true); // pure until applied
    const lines = applyTerminalEffects(s, r.effects, "term_mcp");
    expect(isSwitchedOn(s, "VNT-001")).toBe(false);
    expect(isOnline(s, "VNT-001")).toBe(false);
    expect(lines.join("\n")).toContain("VNT-001 OFF");
    expect(s.log.at(-1)?.text).toContain("Ventilation System switched off");
    expect(text(s, "switch VNT-001 off", "term_mcp")).toContain("already switched off");
    const on = run(s, "switch VNT-001", "term_mcp");
    applyTerminalEffects(s, on.effects, "term_mcp");
    expect(isOnline(s, "VNT-001")).toBe(true);
  });

  it("switching on into a brownout reports it", () => {
    const s = initialState();
    s.flags.geo_routed = true;
    buildAll(s, ["MCP-000", "P3D-001"]);
    s.switchedOn["P3D-001"] = false;
    const r = run(s, "switch P3D-001 on", "term_rechen");
    const lines = applyTerminalEffects(s, r.effects, "term_rechen").join("\n");
    expect(lines).toContain("brownout");
    expect(power(s).starved.some((x) => x.id === "P3D-001")).toBe(true);
  });

  it("signal resolves the same world puzzle as the main console", () => {
    const s = late();
    s.insights.vier_toene = 1;
    expect(text(s, "signal 3648", "term_kantine")).toContain("no access");
    const r = run(s, "signal 3-6-4-8", "term_signal");
    expect(r.effects?.actions).toEqual([{ kind: "signal", code: "3-6-4-8" }]);
    expect(s.puzzles.pz_tones).toBeFalsy();
    const lines = applyTerminalEffects(s, r.effects, "term_signal");
    expect(lines[0]).toBe("[ACCEPTED]");
    expect(lines.some((l) => l.startsWith("MCP> "))).toBe(true);
    expect(s.puzzles.pz_tones).toBe(true);
    expect(s.log.some((l) => l.text.includes("Signal Lab Console: signal 3648"))).toBe(true);
    const again = applyTerminalEffects(s, run(s, "signal 3648", "term_signal").effects);
    expect(again[0]).toBe("[ALREADY SOLVED]");
    const bad = applyTerminalEffects(s, run(s, "signal ZZZZ", "term_signal").effects);
    expect(bad[0]).toBe("[NO RECEIVER]");
  });

  it("only harmless flags are applied", () => {
    const s = initialState();
    applyTerminalEffects(s, { flags: ["deep_access", "terminal_x"] });
    expect(s.flags.deep_access).toBeUndefined();
    expect(s.flags.terminal_x).toBe(true);
  });
});

describe("readouts", () => {
  it("read, ping, top, uptime, crystal, puzzles", () => {
    const s = early();
    expect(text(s, "read clk-001")).toContain("Lab time");
    expect(text(s, "ablesen clk-001")).toBe(text(s, "read clk-001")); // German alias
    expect(text(s, "read QAN-001")).toContain("no known device");
    expect(text(s, "ping UEC-001")).toContain("0 % packet loss");
    s.switchedOn["CLK-001"] = false;
    expect(text(s, "ping CLK-001")).toContain("100 % packet loss");
    expect(text(s, "top")).toContain("uec-001d");
    expect(text(s, "uptime")).toMatch(/up 2,561 days/);
    const k = text(s, "crystal");
    expect(k).toContain("Slices");
    expect(k).toContain("Volatil.");
    expect(k).toContain("infrared");
    expect(text(s, "kristall")).toBe(k);
    expect(text(s, "puzzles", "term_mcp")).toContain("Solved lab-wide");
  });

  it("mcp answers questions from the world state", () => {
    const s = early();
    const out = text(s, "mcp wie ist der strom", "term_mcp");
    expect(out).toMatch(/^MCP> Generation/);
    expect(text(s, "mcp how is the power", "term_mcp")).toMatch(/^MCP> Generation/);
    expect(text(s, "mcp code", "term_mcp")).not.toContain("labor signal");
  });

  it("man pages, history and history expansion", () => {
    const s = initialState();
    const man = text(s, "man switch", "term_mcp");
    expect(man).toContain("SYNTAX");
    expect(man).toContain("Reactor Control Room");
    expect(man).toContain("schalte"); // German alias listed
    expect(text(s, "man schalte", "term_mcp")).toBe(man);
    expect(text(s, "man sudo")).toContain("No manual entry");
    expect(text(s, "man switch", "term_kantine")).toContain("No manual entry");
    const v = runCommand(s, "history", { history: ["status", "mail 1"] }).lines;
    expect(v).toEqual(["   1  status", "   2  mail 1"]);
    expect(runCommand(s, "verlauf", { history: ["status", "mail 1"] }).lines).toEqual(v);
    expect(expandHistory("!!", ["a", "b"])).toBe("b");
    expect(expandHistory("!1", ["a", "b"])).toBe("a");
    expect(expandHistory("!9", ["a"])).toBeNull();
    expect(expandHistory("status", [])).toBe("status");
  });

  it("help lists only what this terminal offers", () => {
    const s = initialState();
    expect(text(s, "help", "term_mcp")).toContain("switch");
    expect(text(s, "hilfe", "term_mcp")).toBe(text(s, "help", "term_mcp"));
    const k = text(s, "help", "term_kantine");
    expect(k).not.toContain("switch");
    expect(k).not.toContain("signal ");
    expect(k).toContain(ROOM_TERMINAL_BY_ID.get("term_kantine")!.purpose);
  });
});

describe("secrets and completion", () => {
  it("secret commands appear with their insight", () => {
    const s = initialState();
    expect(text(s, "unstables")).toContain("command not found");
    s.insights.unstables = 1;
    expect(text(s, "unstables")).toContain("[EXTERNAL]");
    expect(text(s, "cerulean")).toContain("command not found");
    expect(text(s, "damien")).toContain("Signal trace D.F.");
    expect(text(s, "zuhoeren")).toContain("Keep listening");
    s.insights.externe_stimme = 1;
    expect(text(s, "listen")).toContain("[EXTERNAL]");
    expect(text(s, "xyzzy")).toContain("1977");
    expect(text(s, "03:41")).toContain("03:41:22");
    expect(text(s, "make")).toContain("coffee");
    expect(text(s, "help")).not.toContain("xyzzy");
  });

  it("completes device ids, modes, man pages, files and respects capabilities", () => {
    const s = early();
    expect(completeInput(s, "switch vn", { terminalId: "term_mcp" }).value).toBe("switch VNT-001 ");
    expect(completeInput(s, "schalte vn", { terminalId: "term_mcp" }).value).toBe(
      "schalte VNT-001 ",
    );
    expect(completeInput(s, "switch VNT-001 o", { terminalId: "term_mcp" }).options).toEqual([
      "on",
      "off",
    ]);
    expect(completeInput(s, "read ue").value).toBe("read UEC-001 ");
    expect(completeInput(s, "ablesen ue").value).toBe("ablesen UEC-001 ");
    expect(completeInput(s, "man swi").value).toBe("man switch ");
    expect(completeInput(s, "cat sperr", { terminalId: "term_archiv" }).value).toBe(
      "cat sperrbestand.847 ",
    );
    expect(completeInput(s, "unlock ", { terminalId: "term_archiv" }).options).toEqual([
      "sperrbestand.847",
    ]);
    expect(completeInput(s, "sch", { terminalId: "term_kantine" }).options).toEqual([]);
    expect(completeInput(s, "swi", { terminalId: "term_kantine" }).options).toEqual([]);
    expect(completeInput(s, "swi", { terminalId: "term_mcp" }).value).toBe("switch ");
    expect(completeInput(s, "sch", { terminalId: "term_mcp" }).value).toBe("schalte ");
  });
});
