"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { labBootLines, labWorldActions } from "@/lib/terminal/labWorld";
import { labSyncActions } from "@/lib/terminal/labSync";
import { isEmbedLeaveCommand, isEmbeddedFrame, requestCloseTerminal } from "@/lib/terminal/embed";
import type {
  TerminalLine,
  TerminalState,
  CommandContext,
  DataFetchers,
  CDCDeviceActions,
  UECDeviceActions,
  BATDeviceActions,
  HMSDeviceActions,
  ECRDeviceActions,
  IPLDeviceActions,
  MFRDeviceActions,
  AICDeviceActions,
  VNTDeviceActions,
  SCADeviceActions,
  EXDDeviceActions,
  QSMDeviceActions,
  EMCDeviceActions,
  QUADeviceActions,
  PWBDeviceActions,
  BTKDeviceActions,
  RMGDeviceActions,
  MSCDeviceActions,
  NETDeviceActions,
  TMPDeviceActions,
  DIMDeviceActions,
  CPUDeviceActions,
  CLKDeviceActions,
  MEMDeviceActions,
  ANDDeviceActions,
  QCPDeviceActions,
  TLPDeviceActions,
  LCTDeviceActions,
  P3DDeviceActions,
  SPKDeviceActions,
  DGNDeviceActions,
  ScrewButtonDeviceActions,
  FilesystemActions,
  UserActions,
  ThemeActions,
  KernelActions,
  ShellActions,
  NetworkActions,
  JournalActions,
  CronActions,
  InitActions,
  ThermalDeviceActions,
} from "@/lib/terminal/types";
import { useThermalManagerOptional } from "@/contexts/ThermalManager";
import { executeCommand, getWelcomeMessage } from "@/lib/terminal/commands";
import { loadPanelState, savePanelState } from "@/lib/panel/panelState";
import { buildPanelSaveData } from "@/lib/panel/buildPanelSaveData";
import { isDeviceUnlocked as checkDeviceUnlocked } from "@/lib/game/devices/unlocks";
import {
  fetchBalance,
  fetchCrystals,
  fetchResearchProgress,
  fetchCommandHistory,
  fetchVolatility,
  logCommand,
} from "@/app/(game)/terminal/actions/data";
import {
  mintCrystal,
  fetchCrystalByName,
  renameCrystal,
} from "@/app/(game)/terminal/actions/crystals";

interface UseTerminalProps {
  userId: string;
  username: string | null;
  balance: number;
  cdcDeviceActions?: CDCDeviceActions;
  uecDeviceActions?: UECDeviceActions;
  batDeviceActions?: BATDeviceActions;
  hmsDeviceActions?: HMSDeviceActions;
  ecrDeviceActions?: ECRDeviceActions;
  iplDeviceActions?: IPLDeviceActions;
  mfrDeviceActions?: MFRDeviceActions;
  aicDeviceActions?: AICDeviceActions;
  vntDeviceActions?: VNTDeviceActions;
  scaDeviceActions?: SCADeviceActions;
  exdDeviceActions?: EXDDeviceActions;
  qsmDeviceActions?: QSMDeviceActions;
  emcDeviceActions?: EMCDeviceActions;
  quaDeviceActions?: QUADeviceActions;
  pwbDeviceActions?: PWBDeviceActions;
  btkDeviceActions?: BTKDeviceActions;
  rmgDeviceActions?: RMGDeviceActions;
  mscDeviceActions?: MSCDeviceActions;
  netDeviceActions?: NETDeviceActions;
  tmpDeviceActions?: TMPDeviceActions;
  dimDeviceActions?: DIMDeviceActions;
  cpuDeviceActions?: CPUDeviceActions;
  clkDeviceActions?: CLKDeviceActions;
  memDeviceActions?: MEMDeviceActions;
  andDeviceActions?: ANDDeviceActions;
  qcpDeviceActions?: QCPDeviceActions;
  tlpDeviceActions?: TLPDeviceActions;
  lctDeviceActions?: LCTDeviceActions;
  p3dDeviceActions?: P3DDeviceActions;
  spkDeviceActions?: SPKDeviceActions;
  dgnDeviceActions?: DGNDeviceActions;
  screwButtonDeviceActions?: ScrewButtonDeviceActions;
  resourceManagerActions?: import("@/contexts/ResourceManager").ResourceManagerActions;
  filesystemActions?: FilesystemActions;
  userActions?: UserActions;
  themeActions?: ThemeActions;
  systemPowerActions?: {
    scheduleShutdown: (seconds: number, scope?: "os" | "system") => void;
    scheduleReboot: (seconds: number, scope?: "os" | "system") => void;
    shutdownNow: (scope?: "os" | "system") => void;
    rebootNow: (scope?: "os" | "system") => void;
    cancelCountdown: () => void;
    getState: () => {
      systemState: string;
      countdownSeconds: number | null;
      countdownAction: string | null;
      powerScope: string | null;
    };
  };
  kernelActions?: KernelActions;
  shellActions?: ShellActions;
  networkActions?: NetworkActions;
  journalActions?: JournalActions;
  cronActions?: CronActions;
  initActions?: InitActions;
  firmwareActions?: import("@/lib/firmware/types").FirmwareActions;
  missionActions?: import("@/lib/terminal/types").MissionTerminalActions;
  resonanceActions?: import("@/lib/terminal/types").ResonanceTerminalActions;
  tutorialActions?: import("@/lib/terminal/types").TutorialTerminalActions;
  achievementActions?: import("@/lib/terminal/types").AchievementTerminalActions;
  dailyActions?: import("@/lib/terminal/types").DailyTerminalActions;
  prestigeActions?: { refresh: () => Promise<void> };
  researchActions?: import("@/lib/terminal/types").ResearchTerminalActions;
  nexusActions?: import("@/lib/terminal/types").NexusTerminalActions;
  questCommandActions?: import("@/lib/terminal/types").QuestCommandTerminalActions;
  questFlags?: Record<string, boolean>;
}

// Scrollback cap — keeps DOM size and re-render cost bounded during long
// sessions; old lines fall off the top like a real terminal.
const MAX_LINES = 2000;
const capLines = (lines: TerminalLine[]): TerminalLine[] =>
  lines.length > MAX_LINES ? lines.slice(lines.length - MAX_LINES) : lines;

export function useTerminal({
  userId,
  username,
  balance,
  cdcDeviceActions,
  uecDeviceActions,
  batDeviceActions,
  hmsDeviceActions,
  ecrDeviceActions,
  iplDeviceActions,
  mfrDeviceActions,
  aicDeviceActions,
  vntDeviceActions,
  scaDeviceActions,
  exdDeviceActions,
  qsmDeviceActions,
  emcDeviceActions,
  quaDeviceActions,
  pwbDeviceActions,
  btkDeviceActions,
  rmgDeviceActions,
  mscDeviceActions,
  netDeviceActions,
  tmpDeviceActions,
  dimDeviceActions,
  cpuDeviceActions,
  clkDeviceActions,
  memDeviceActions,
  andDeviceActions,
  qcpDeviceActions,
  tlpDeviceActions,
  lctDeviceActions,
  p3dDeviceActions,
  spkDeviceActions,
  dgnDeviceActions,
  screwButtonDeviceActions,
  resourceManagerActions,
  filesystemActions,
  userActions,
  themeActions,
  systemPowerActions,
  kernelActions,
  shellActions,
  networkActions,
  journalActions,
  cronActions,
  initActions,
  firmwareActions,
  missionActions,
  resonanceActions,
  tutorialActions,
  achievementActions,
  dailyActions,
  prestigeActions,
  researchActions,
  nexusActions,
  questCommandActions,
  questFlags,
}: UseTerminalProps) {
  const router = useRouter();
  const [state, setState] = useState<TerminalState>(() => {
    let savedHistory: string[] = [];
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("unlabs_cmd_history") : null;
      if (raw) savedHistory = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return {
      lines: [],
      history: savedHistory,
      historyIndex: -1,
      isTyping: false,
    };
  });

  const initializedRef = useRef(false);
  const idCounter = useRef(0);

  const generateId = useCallback(() => {
    idCounter.current += 1;
    return `line-${Date.now()}-${idCounter.current}`;
  }, []);

  const addLine = useCallback(
    (content: string, type: TerminalLine["type"] = "output") => {
      const line: TerminalLine = {
        id: generateId(),
        type,
        content,
        timestamp: new Date(),
      };
      setState((prev) => ({
        ...prev,
        lines: capLines([...prev.lines, line]),
      }));
    },
    [generateId],
  );

  const addLines = useCallback(
    (entries: { content: string; type: TerminalLine["type"] }[]) => {
      const now = new Date();
      const newLines: TerminalLine[] = entries.map((e) => ({
        id: generateId(),
        type: e.type,
        content: e.content,
        timestamp: now,
      }));
      setState((prev) => ({
        ...prev,
        lines: capLines([...prev.lines, ...newLines]),
      }));
    },
    [generateId],
  );

  const addOutput = useCallback(
    (content: string, type: TerminalLine["type"] = "output") => {
      addLine(content, type);
    },
    [addLine],
  );

  const clearScreen = useCallback(() => {
    setState((prev) => ({
      ...prev,
      lines: [],
    }));
  }, []);

  const setTyping = useCallback((typing: boolean) => {
    setState((prev) => ({
      ...prev,
      isTyping: typing,
    }));
  }, []);

  // Password input mode for su/sudo
  const [passwordMode, setPasswordMode] = useState(false);
  const pendingPasswordAction = useRef<{ command: "su"; target: string } | null>(null);

  // Prompt refresh trigger — incremented after commands that change user/cwd
  const [promptTick, setPromptTick] = useState(0);

  // App mode — when set, an interactive app takes over the terminal UI
  const [appMode, setAppMode] = useState<string | null>(null);
  const [appModeData, setAppModeData] = useState<Record<string, string> | null>(null);

  // Save all device state to localStorage
  const saveAllDeviceState = useCallback(() => {
    const data = buildPanelSaveData(
      {
        cdc: cdcDeviceActions?.getState(),
        uec: uecDeviceActions?.getState(),
        bat: batDeviceActions?.getState(),
        hms: hmsDeviceActions?.getState(),
        ecr: ecrDeviceActions?.getState(),
        ipl: iplDeviceActions?.getState(),
        mfr: mfrDeviceActions?.getState(),
        aic: aicDeviceActions?.getState(),
        vnt: vntDeviceActions?.getState(),
        sca: scaDeviceActions?.getState(),
        exd: exdDeviceActions?.getState(),
        qsm: qsmDeviceActions?.getState(),
        emc: emcDeviceActions?.getState(),
        qua: quaDeviceActions?.getState(),
        pwb: pwbDeviceActions?.getState(),
        btk: btkDeviceActions?.getState(),
        rmg: rmgDeviceActions?.getState(),
        msc: mscDeviceActions?.getState(),
        net: netDeviceActions?.getState(),
        tmp: tmpDeviceActions?.getState(),
        dim: dimDeviceActions?.getState(),
        cpu: cpuDeviceActions?.getState(),
        clk: clkDeviceActions?.getState(),
        mem: memDeviceActions?.getState(),
        and: andDeviceActions?.getState(),
        qcp: qcpDeviceActions?.getState(),
        tlp: tlpDeviceActions?.getState(),
        lct: lctDeviceActions?.getState(),
        p3d: p3dDeviceActions?.getState(),
        spk: spkDeviceActions?.getState(),
        dgn: dgnDeviceActions?.getState(),
        screwButtons: screwButtonDeviceActions?.getAllStates(),
      },
      {
        filesystem: filesystemActions?.toJSON(),
        users: userActions?.toJSON(),
        resources: resourceManagerActions?.toSaveData(),
        firmware: firmwareActions?.toSaveData(),
        journal: journalActions?.toSaveData(),
        kernel: kernelActions
          ? (() => {
              try {
                return kernelActions.toJSON();
              } catch {
                return undefined;
              }
            })()
          : undefined,
        shell: shellActions
          ? (() => {
              try {
                const env = shellActions.getAllEnv();
                const aliases = shellActions.listAliases();
                return {
                  config: { prompt: "\\u@_unLAB:\\w\\$", historySize: 500, aliases },
                  aliases: Object.entries(aliases),
                  env: Object.entries(env),
                };
              } catch {
                return undefined;
              }
            })()
          : undefined,
      },
      loadPanelState(),
    );

    savePanelState(data);
  }, [
    cdcDeviceActions,
    uecDeviceActions,
    batDeviceActions,
    hmsDeviceActions,
    ecrDeviceActions,
    iplDeviceActions,
    mfrDeviceActions,
    aicDeviceActions,
    vntDeviceActions,
    scaDeviceActions,
    qsmDeviceActions,
    emcDeviceActions,
    quaDeviceActions,
    pwbDeviceActions,
    btkDeviceActions,
    rmgDeviceActions,
    mscDeviceActions,
    netDeviceActions,
    tmpDeviceActions,
    dimDeviceActions,
    cpuDeviceActions,
    clkDeviceActions,
    memDeviceActions,
    andDeviceActions,
    qcpDeviceActions,
    tlpDeviceActions,
    lctDeviceActions,
    p3dDeviceActions,
    spkDeviceActions,
    screwButtonDeviceActions,
    kernelActions,
    shellActions,
    firmwareActions,
  ]);

  // ── Thermal subsystem adapter ─────────────────────────────────────
  // Optional: when the terminal is mounted outside a ThermalManagerProvider
  // (e.g. tests), this is `null` and the `thermal` command falls back to a
  // static catalog view.
  const thermal = useThermalManagerOptional();
  const thermalDeviceActions: ThermalDeviceActions | undefined = useMemo(() => {
    if (!thermal) return undefined;
    return {
      getState: () => ({
        panelTemperature: thermal.state.panelTemperature,
        ambientTemperature: thermal.state.ambientTemperature,
        chassisVolumeL: thermal.state.chassisVolumeL,
        chassisHeatCapacityJ: thermal.state.chassisHeatCapacityJ,
        totalHeatW: thermal.state.totalHeatW,
        totalCoolingW: thermal.state.totalCoolingW,
        netHeatW: thermal.state.netHeatW,
        overallStatus: thermal.state.overallStatus,
        isOverheating: thermal.state.isOverheating,
        performanceThrottle: thermal.state.performanceThrottle,
        autoMode: thermal.state.autoMode,
        zones: {
          cpu: { ...thermal.state.zones.cpu },
          gpu: { ...thermal.state.zones.gpu },
          panel: { ...thermal.state.zones.panel },
        },
        fans: {
          cpu: { ...thermal.state.fans.cpu },
          gpu: { ...thermal.state.fans.gpu },
        },
      }),
      listDevices: () =>
        thermal.listDevices().map((d) => ({
          id: d.id,
          name: d.name,
          load: d.load,
          heatOutput: d.heatOutput,
          volumeL: d.volumeL,
          heatCapacityJ: d.heatCapacityJ,
          temperature: d.temperature,
        })),
      getChassisInfo: thermal.getChassisInfo,
      setFanSpeed: thermal.setFanSpeed,
      setFanMode: thermal.setFanMode,
      toggleFan: thermal.toggleFan,
      setAutoMode: thermal.setAutoMode,
      emergencyCool: thermal.emergencyCool,
      registerDevice: thermal.registerDevice,
      updateDeviceLoad: thermal.updateDeviceLoad,
      getTemperatureColor: thermal.getTemperatureColor,
    };
  }, [thermal]);

  // Data fetchers for commands - memoized for stability
  const dataFetchers: DataFetchers = useMemo(
    () => ({
      fetchBalance,
      fetchCrystals,
      fetchResearchProgress,
      fetchCommandHistory,
      fetchVolatility,
      logCommand,
      mintCrystal,
      fetchCrystalByName,
      renameCrystal,
      // Panel state save
      saveAllDeviceState,
      // Device unlock check — drives terminal/UI gating. With a lab world save
      // the world decides (built there = physically present); without one the
      // terminal's quest flags do (see lib/terminal/labSync.ts).
      isDeviceUnlocked: (deviceId: string) =>
        labSyncActions.isPresent(deviceId) ?? checkDeviceUnlocked(deviceId, questFlags ?? {}),
      // Device actions for bidirectional sync
      cdcDevice: cdcDeviceActions,
      uecDevice: uecDeviceActions,
      batDevice: batDeviceActions,
      hmsDevice: hmsDeviceActions,
      ecrDevice: ecrDeviceActions,
      iplDevice: iplDeviceActions,
      mfrDevice: mfrDeviceActions,
      aicDevice: aicDeviceActions,
      vntDevice: vntDeviceActions,
      scaDevice: scaDeviceActions,
      exdDevice: exdDeviceActions,
      qsmDevice: qsmDeviceActions,
      emcDevice: emcDeviceActions,
      quaDevice: quaDeviceActions,
      pwbDevice: pwbDeviceActions,
      btkDevice: btkDeviceActions,
      rmgDevice: rmgDeviceActions,
      mscDevice: mscDeviceActions,
      netDevice: netDeviceActions,
      tmpDevice: tmpDeviceActions,
      dimDevice: dimDeviceActions,
      cpuDevice: cpuDeviceActions,
      clkDevice: clkDeviceActions,
      memDevice: memDeviceActions,
      andDevice: andDeviceActions,
      qcpDevice: qcpDeviceActions,
      tlpDevice: tlpDeviceActions,
      lctDevice: lctDeviceActions,
      p3dDevice: p3dDeviceActions,
      spkDevice: spkDeviceActions,
      dgnDevice: dgnDeviceActions,
      screwButtons: screwButtonDeviceActions,
      resourceManager: resourceManagerActions,
      filesystemActions,
      userActions,
      themeActions,
      systemPower: systemPowerActions,
      kernelActions,
      shellActions,
      networkActions,
      journalActions,
      cronActions,
      initActions,
      firmwareActions,
      thermalDevice: thermalDeviceActions,
      missionActions,
      resonanceActions,
      tutorialActions,
      achievementActions,
      dailyActions,
      prestigeActions,
      researchActions,
      nexusActions,
      questCommandActions,
      // Lab world bridge — module singleton, stable across renders.
      labWorldActions,
      // Lab world device/quest sync — module singleton, stable across renders.
      labSync: labSyncActions,
    }),
    [
      cdcDeviceActions,
      uecDeviceActions,
      batDeviceActions,
      hmsDeviceActions,
      ecrDeviceActions,
      iplDeviceActions,
      mfrDeviceActions,
      aicDeviceActions,
      vntDeviceActions,
      scaDeviceActions,
      exdDeviceActions,
      qsmDeviceActions,
      emcDeviceActions,
      quaDeviceActions,
      pwbDeviceActions,
      btkDeviceActions,
      rmgDeviceActions,
      mscDeviceActions,
      netDeviceActions,
      tmpDeviceActions,
      dimDeviceActions,
      cpuDeviceActions,
      clkDeviceActions,
      andDeviceActions,
      qcpDeviceActions,
      tlpDeviceActions,
      lctDeviceActions,
      p3dDeviceActions,
      spkDeviceActions,
      dgnDeviceActions,
      screwButtonDeviceActions,
      resourceManagerActions,
      saveAllDeviceState,
      filesystemActions,
      userActions,
      themeActions,
      systemPowerActions,
      kernelActions,
      shellActions,
      networkActions,
      journalActions,
      cronActions,
      initActions,
      firmwareActions,
      thermalDeviceActions,
      missionActions,
      resonanceActions,
      tutorialActions,
      achievementActions,
      dailyActions,
      prestigeActions,
      researchActions,
      nexusActions,
      questCommandActions,
      questFlags,
    ],
  );

  // Initialize with welcome message + returning player breadcrumbs
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const welcomeLines = getWelcomeMessage(username);
      welcomeLines.forEach((line) => {
        addLine(line, line.startsWith(">") ? "system" : "ascii");
      });

      // Lab world breadcrumb: where Jade stands in /world (active save slot).
      // Async (lazy bridge import); prints nothing without a world save.
      void labBootLines()
        .then((lines) => {
          if (!lines.length) return;
          addLine("", "output");
          for (const l of lines) addLine(l, "system");
        })
        .catch(() => {
          // The lab world is optional — never block the terminal boot.
        });

      // Returning player breadcrumbs (if mission system is available)
      if (missionActions) {
        const activeMissions = missionActions
          .getAllMissions()
          .filter((m) => m.status === "active" || m.status === "completed");
        if (activeMissions.length > 0) {
          addLine("", "output");
          for (const m of activeMissions) {
            addLine(
              `> Active mission: "${m.title}" \u2014 ${m.completedTaskCount}/${m.totalTaskCount} tasks complete.`,
              "system",
            );
          }
          addLine("> Type 'whatnext' for guidance.", "system");
          addLine("", "output");
        }
      }
    }
  }, [username, addLine, missionActions]);

  const processCommand = useCallback(
    async (input: string) => {
      // Handle password mode - input is the password for a pending su command
      if (passwordMode && pendingPasswordAction.current) {
        const action = pendingPasswordAction.current;
        pendingPasswordAction.current = null;
        setPasswordMode(false);

        // Show masked password line
        addLine(`Password: ${"*".repeat(input.length)}`, "input");

        if (action.command === "su") {
          const result = userActions?.su(action.target, input);
          if (result?.success) {
            addLine(`[su] ${result.message}`, "output");
            setPromptTick((t) => t + 1);
          } else {
            addLine(result?.message ?? "su: Authentication failure", "error");
          }
        }
        return;
      }

      // Add input line with prompt
      const currentPrompt = userActions?.whoami()
        ? (() => {
            const user = userActions.whoami();
            const cwd = filesystemActions?.getCwd() ?? "~";
            const home = userActions.getCurrentUser()?.home ?? "/unhome/operator";
            const displayCwd =
              cwd === home ? "~" : cwd.startsWith(home + "/") ? "~" + cwd.slice(home.length) : cwd;
            const suffix = user === "root" ? "#" : "$";
            return `${user}@_unLAB:${displayCwd}${suffix}`;
          })()
        : ">";
      addLine(`${currentPrompt} ${input}`, "input");

      // Add to history (persisted to localStorage)
      setState((prev) => {
        const newHistory = [input, ...prev.history.filter((h) => h !== input)].slice(0, 200);
        try {
          localStorage.setItem("unlabs_cmd_history", JSON.stringify(newHistory));
        } catch {
          /* ignore */
        }
        return { ...prev, history: newHistory, historyIndex: -1 };
      });

      // Intercept su commands to use password mode instead of cleartext args
      const parts = input.trim().split(/\s+/);
      const cmd = parts[0]?.toLowerCase();
      if ((cmd === "su" || cmd === "unsu") && parts[1] && parts[1] !== "root" && !parts[2]) {
        // Check if current user is root (no password needed)
        if (!userActions?.isRoot()) {
          pendingPasswordAction.current = { command: "su", target: parts[1] };
          setPasswordMode(true);
          return;
        }
      }

      // Inside the Lab World overlay, `back` / `exit` return to the lab
      // (the overlay closes) instead of doing nothing.
      if (isEmbeddedFrame()) {
        const switched =
          !!userActions && !userActions.isRoot() && userActions.whoami() !== "operator";
        if (isEmbedLeaveCommand(cmd, parts.slice(1), switched)) {
          addLine("[lab] Back to the lab…", "output");
          window.setTimeout(() => requestCloseTerminal(), 300);
          return;
        }
      }

      // Create command context
      const context: CommandContext = {
        userId,
        username,
        balance,
        addOutput,
        clearScreen,
        setTyping,
        data: dataFetchers,
        sessionHistory: state.history,
      };

      // Spawn kernel process for this command
      const kernelPid = kernelActions?.execCommand(cmd ?? input, parts.slice(1));

      // Execute command
      const result = await executeCommand(input, context);

      // Finish kernel process
      if (kernelPid !== undefined && kernelActions) {
        kernelActions.finishCommand(kernelPid, result.success ? 0 : 1);
      }

      // Report command to mission system for command-type objectives
      if (result.success && missionActions?.reportCommand) {
        missionActions.reportCommand(input);
      }

      // Report the base command name to the quest bridge. Only SUCCESSFUL
      // executions count (unlike the resonance feed below): command-triggered
      // quest steps model real, completed player actions, not typos or
      // failed invocations.
      if (result.success && cmd && questCommandActions?.reportCommand) {
        questCommandActions.reportCommand(cmd);
      }

      // A terminal power switch may just have completed a lab-driven quest
      // step (e.g. BAT/NET/MEM online → grid_online). Cached snapshot; no-op
      // without a world save.
      questCommandActions?.syncFlags?.(labSyncActions.questFlags());

      // Feed the resonance buffer with the normalized command line.
      // Deliberately not gated on success: hidden protocol invocations
      // (e.g. "qbridge sync", "kernel sync --deep") are rituals the shell
      // does not necessarily recognize as registered commands.
      resonanceActions?.pushCommandEvent(input.trim().replace(/\s+/g, " "));

      // Output results
      if (result.error) {
        addLine(result.error, "error");
      } else if (result.output) {
        addLines(result.output.map((line) => ({ content: line, type: "output" as const })));
      }

      // Handle panel access changes
      if (result.clearPanelAccess) {
        sessionStorage.removeItem("panel_access");
      }

      // Handle navigation if specified
      if (result.navigate) {
        // Grant secure panel access via server-side cookie
        if (result.navigate === "/panel") {
          import("@/app/(game)/terminal/actions/panel-access").then(({ grantPanelAccess }) =>
            grantPanelAccess(),
          );
        }
        setTimeout(() => {
          // Embedded in the Lab World overlay: "/world" means "close the
          // overlay" — navigating would nest the world inside itself.
          if (result.navigate === "/world" && requestCloseTerminal()) return;
          // Use window.location for reliable navigation in Electron builds
          // where Next.js client-side router can fail silently
          window.location.href = result.navigate!;
        }, 1500); // Delay to let user see the output
      }

      // Handle page refresh if specified (e.g., for reboot commands)
      if (result.refresh) {
        setTimeout(() => {
          window.location.reload();
        }, 1500); // Delay to let user see the output
      }

      // Handle app mode launch (e.g. Midnight Commander)
      if (result.appMode) {
        setAppMode(result.appMode);
        setAppModeData(result.appModeData ?? null);
      }

      // Refresh prompt after any command (user/cwd may have changed)
      setPromptTick((t) => t + 1);
    },
    [
      userId,
      username,
      balance,
      addLine,
      addLines,
      addOutput,
      clearScreen,
      setTyping,
      dataFetchers,
      router,
      passwordMode,
      userActions,
      filesystemActions,
      resonanceActions,
      questCommandActions,
    ],
  );

  const navigateHistory = useCallback(
    (direction: "up" | "down"): string => {
      let newIndex: number;

      if (direction === "up") {
        newIndex = Math.min(state.historyIndex + 1, state.history.length - 1);
      } else {
        newIndex = Math.max(state.historyIndex - 1, -1);
      }

      setState((prev) => ({
        ...prev,
        historyIndex: newIndex,
      }));

      return newIndex >= 0 ? state.history[newIndex] || "" : "";
    },
    [state.history, state.historyIndex],
  );

  const prompt = useMemo(() => {
    const user = userActions?.whoami() ?? username ?? "operator";
    const cwd = filesystemActions?.getCwd() ?? "~";
    const home = userActions?.getCurrentUser()?.home ?? "/unhome/operator";
    const displayCwd =
      cwd === home ? "~" : cwd.startsWith(home + "/") ? "~" + cwd.slice(home.length) : cwd;
    const suffix = user === "root" ? "#" : "$";
    return `${user}@_unLAB:${displayCwd}${suffix}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userActions, filesystemActions, username, promptTick]);

  const exitAppMode = useCallback(() => {
    setAppMode(null);
    setAppModeData(null);
  }, []);

  return {
    lines: state.lines,
    history: state.history,
    isTyping: state.isTyping,
    processCommand,
    navigateHistory,
    clearScreen,
    addOutput,
    prompt,
    passwordMode,
    appMode,
    appModeData,
    exitAppMode,
  };
}
