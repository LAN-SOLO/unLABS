import type { DeviceFirmwareEntry } from "./types";

// ── Import all firmware.json files ────────────────────────

// Tier 1
import CDC_FW from "@/devices/tier-1/CDC-001_Crystal-Data-Cache/firmware.json";
import BAT_FW from "@/devices/tier-1/BAT-001_Battery-Pack/firmware.json";
import BTK_FW from "@/devices/tier-1/BTK-001_Basic-Toolkit/firmware.json";
import CLK_FW from "@/devices/tier-1/CLK-001_Lab-Clock/firmware.json";
import CPU_FW from "@/devices/tier-1/CPU-001_CPU-Monitor/firmware.json";
import ECR_FW from "@/devices/tier-1/ECR-001_Echo-Recorder/firmware.json";
import MEM_FW from "@/devices/tier-1/MEM-001_Memory-Monitor/firmware.json";
import MSC_FW from "@/devices/tier-1/MSC-001_Material-Scanner/firmware.json";
import NET_FW from "@/devices/tier-1/NET-001_Network-Monitor/firmware.json";
import PWB_FW from "@/devices/tier-1/PWB-001_Portable-Workbench/firmware.json";
import RMG_FW from "@/devices/tier-1/RMG-001_Resource-Magnet/firmware.json";
import SPK_FW from "@/devices/tier-1/SPK-001_Narrow-Speaker/firmware.json";
import TMP_FW from "@/devices/tier-1/TMP-001_Temperature-Monitor/firmware.json";
import VNT_FW from "@/devices/tier-1/VNT-001_Ventilation-System/firmware.json";
import ATK_FW from "@/devices/tier-1/ATK-001_Abstractum-Tank/firmware.json";
import PWD_FW from "@/devices/tier-1/PWD-001_Power-Display-Panel/firmware.json";
import PWR_FW from "@/devices/tier-1/PWR-001_Power-Management-System/firmware.json";
import THM_FW from "@/devices/tier-1/THM-001_Thermal-Manager/firmware.json";
import VLT_FW from "@/devices/tier-1/VLT-001_Volt-Meter-Display/firmware.json";

// Tier 2
import AND_FW from "@/devices/tier-2/AND-001_Anomaly-Detector/firmware.json";
import DGN_FW from "@/devices/tier-2/DGN-001_Diagnostics-Console/firmware.json";
import DIM_FW from "@/devices/tier-2/DIM-001_Dimension-Monitor/firmware.json";
import EXD_FW from "@/devices/tier-2/EXD-001_Explorer-Drone/firmware.json";
import HMS_FW from "@/devices/tier-2/HMS-001_Handmade-Synthesizer/firmware.json";
import INT_FW from "@/devices/tier-2/INT-001_Interpolator/firmware.json";
import LCT_FW from "@/devices/tier-2/LCT-001_Precision-Laser/firmware.json";
import P3D_FW from "@/devices/tier-2/P3D-001_3D-Fabricator/firmware.json";
import QCP_FW from "@/devices/tier-2/QCP-001_Quantum-Compass/firmware.json";
import UEC_FW from "@/devices/tier-2/UEC-001_Unstable-Energy-Core/firmware.json";
import OSC_FW from "@/devices/tier-2/OSC-001_Oscilloscope-Array/firmware.json";

// Tier 3
import AIC_FW from "@/devices/tier-3/AIC-001_AI-Assistant-Core/firmware.json";
import EMC_FW from "@/devices/tier-3/EMC-001_Exotic-Matter-Containment/firmware.json";
import MFR_FW from "@/devices/tier-3/MFR-001_Microfusion-Reactor/firmware.json";
import QAN_FW from "@/devices/tier-3/QAN-001_Quantum-Analyzer/firmware.json";
import QSM_FW from "@/devices/tier-3/QSM-001_Quantum-State-Monitor/firmware.json";
import SCA_FW from "@/devices/tier-3/SCA-001_Supercomputer-Array/firmware.json";
import TLP_FW from "@/devices/tier-3/TLP-001_Teleport-Pad/firmware.json";

// ── Build registry ────────────────────────────────────────

const ALL_FIRMWARE = [
  CDC_FW,
  BAT_FW,
  BTK_FW,
  CLK_FW,
  CPU_FW,
  ECR_FW,
  MEM_FW,
  MSC_FW,
  NET_FW,
  PWB_FW,
  RMG_FW,
  SPK_FW,
  TMP_FW,
  VNT_FW,
  ATK_FW,
  PWD_FW,
  PWR_FW,
  THM_FW,
  VLT_FW,
  AND_FW,
  DGN_FW,
  DIM_FW,
  EXD_FW,
  HMS_FW,
  INT_FW,
  LCT_FW,
  P3D_FW,
  QCP_FW,
  UEC_FW,
  OSC_FW,
  AIC_FW,
  EMC_FW,
  MFR_FW,
  QAN_FW,
  QSM_FW,
  SCA_FW,
  TLP_FW,
] as unknown as DeviceFirmwareEntry[];

export const FIRMWARE_REGISTRY: Map<string, DeviceFirmwareEntry> = new Map(
  ALL_FIRMWARE.map((entry) => [entry.device_id, entry]),
);

export function getDeviceFirmware(deviceId: string): DeviceFirmwareEntry | undefined {
  return FIRMWARE_REGISTRY.get(deviceId);
}

export function getAllDeviceIds(): string[] {
  return Array.from(FIRMWARE_REGISTRY.keys());
}

export function getDevicesWithUpdates(): string[] {
  return Array.from(FIRMWARE_REGISTRY.entries())
    .filter(([, entry]) => entry.update !== undefined)
    .map(([id]) => id);
}
