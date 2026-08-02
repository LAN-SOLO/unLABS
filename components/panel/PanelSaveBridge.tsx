"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import { useCDCManagerOptional } from "@/contexts/CDCManager";
import { useUECManagerOptional } from "@/contexts/UECManager";
import { useBATManagerOptional } from "@/contexts/BATManager";
import { useHMSManagerOptional } from "@/contexts/HMSManager";
import { useECRManagerOptional } from "@/contexts/ECRManager";
import { useIPLManagerOptional } from "@/contexts/IPLManager";
import { useMFRManagerOptional } from "@/contexts/MFRManager";
import { useAICManagerOptional } from "@/contexts/AICManager";
import { useVNTManagerOptional } from "@/contexts/VNTManager";
import { useSCAManagerOptional } from "@/contexts/SCAManager";
import { useEXDManagerOptional } from "@/contexts/EXDManager";
import { useQSMManagerOptional } from "@/contexts/QSMManager";
import { useEMCManagerOptional } from "@/contexts/EMCManager";
import { useQUAManagerOptional } from "@/contexts/QUAManager";
import { usePWBManagerOptional } from "@/contexts/PWBManager";
import { useBTKManagerOptional } from "@/contexts/BTKManager";
import { useRMGManagerOptional } from "@/contexts/RMGManager";
import { useMSCManagerOptional } from "@/contexts/MSCManager";
import { useNETManagerOptional } from "@/contexts/NETManager";
import { useTMPManagerOptional } from "@/contexts/TMPManager";
import { useDIMManagerOptional } from "@/contexts/DIMManager";
import { useCPUManagerOptional } from "@/contexts/CPUManager";
import { useCLKManagerOptional } from "@/contexts/CLKManager";
import { useMEMManagerOptional } from "@/contexts/MEMManager";
import { useANDManagerOptional } from "@/contexts/ANDManager";
import { useQCPManagerOptional } from "@/contexts/QCPManager";
import { useTLPManagerOptional } from "@/contexts/TLPManager";
import { useLCTManagerOptional } from "@/contexts/LCTManager";
import { useP3DManagerOptional } from "@/contexts/P3DManager";
import { useSPKManagerOptional } from "@/contexts/SPKManager";
import { useDGNManagerOptional } from "@/contexts/DGNManager";
import { useScrewButtonManagerOptional } from "@/contexts/ScrewButtonManager";
import { useFirmwareManagerOptional } from "@/contexts/FirmwareManager";
import { useResourceManagerOptional } from "@/contexts/ResourceManager";
import { useJournalOptional } from "@/contexts/JournalProvider";
import { buildPanelSaveData } from "@/lib/panel/buildPanelSaveData";
import { loadPanelState, savePanelState } from "@/lib/panel/panelState";

const AUTOSAVE_INTERVAL_MS = 20_000;

interface PanelSaveBridgeProps {
  /** The parent stores the save trigger here so components above the
   *  device-provider tree (e.g. SystemPowerManager) can request a save. */
  registerRef: MutableRefObject<(() => void) | null>;
}

/**
 * Persists panel-side device tweaks. Must be mounted BELOW every device
 * manager provider. Saves on a 20s interval, when the tab is hidden, on
 * unload, and on demand via `registerRef` (used by the panel power button).
 * Terminal-owned sections (filesystem/users/kernel/shell) are preserved by
 * merging over the previously stored blob.
 */
export function PanelSaveBridge({ registerRef }: PanelSaveBridgeProps) {
  const managers = {
    cdc: useCDCManagerOptional(),
    uec: useUECManagerOptional(),
    bat: useBATManagerOptional(),
    hms: useHMSManagerOptional(),
    ecr: useECRManagerOptional(),
    ipl: useIPLManagerOptional(),
    mfr: useMFRManagerOptional(),
    aic: useAICManagerOptional(),
    vnt: useVNTManagerOptional(),
    sca: useSCAManagerOptional(),
    exd: useEXDManagerOptional(),
    qsm: useQSMManagerOptional(),
    emc: useEMCManagerOptional(),
    qua: useQUAManagerOptional(),
    pwb: usePWBManagerOptional(),
    btk: useBTKManagerOptional(),
    rmg: useRMGManagerOptional(),
    msc: useMSCManagerOptional(),
    net: useNETManagerOptional(),
    tmp: useTMPManagerOptional(),
    dim: useDIMManagerOptional(),
    cpu: useCPUManagerOptional(),
    clk: useCLKManagerOptional(),
    mem: useMEMManagerOptional(),
    and: useANDManagerOptional(),
    qcp: useQCPManagerOptional(),
    tlp: useTLPManagerOptional(),
    lct: useLCTManagerOptional(),
    p3d: useP3DManagerOptional(),
    spk: useSPKManagerOptional(),
    dgn: useDGNManagerOptional(),
    screw: useScrewButtonManagerOptional(),
    firmware: useFirmwareManagerOptional(),
    resources: useResourceManagerOptional(),
    journal: useJournalOptional(),
  };

  // Keep the latest manager values readable from stable callbacks without
  // re-registering interval/listeners on every provider re-render.
  const managersRef = useRef(managers);
  managersRef.current = managers;

  useEffect(() => {
    const save = () => {
      const m = managersRef.current;
      try {
        const data = buildPanelSaveData(
          {
            cdc: m.cdc,
            uec: m.uec,
            bat: m.bat,
            hms: m.hms,
            ecr: m.ecr,
            ipl: m.ipl,
            mfr: m.mfr,
            aic: m.aic,
            vnt: m.vnt,
            sca: m.sca,
            exd: m.exd,
            qsm: m.qsm,
            emc: m.emc,
            qua: m.qua,
            pwb: m.pwb,
            btk: m.btk,
            rmg: m.rmg,
            msc: m.msc,
            net: m.net,
            tmp: m.tmp,
            dim: m.dim,
            cpu: m.cpu,
            clk: m.clk,
            mem: m.mem,
            and: m.and,
            qcp: m.qcp,
            tlp: m.tlp,
            lct: m.lct,
            p3d: m.p3d,
            spk: m.spk,
            dgn: m.dgn,
            screwButtons: m.screw?.getAllStates(),
          },
          {
            resources: m.resources?.toSaveData(),
            firmware: m.firmware?.toSaveData(),
            journal: m.journal?.journal.toJSON(),
          },
          loadPanelState(),
        );
        savePanelState(data);
      } catch {
        // A failed autosave must never break the panel.
      }
    };

    registerRef.current = save;

    const intervalId = setInterval(save, AUTOSAVE_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", save);

    return () => {
      registerRef.current = null;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", save);
      save();
    };
  }, [registerRef]);

  return null;
}
