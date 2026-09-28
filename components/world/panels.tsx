/**
 * Lab-world panels. Split into components/world/panels/*; this module keeps
 * the original import path.
 */
export { announce, type WorldApi } from "@/components/world/panels/shared";
export {
  PrototypeUse,
  runPrototypeUse,
  type ProtoUseHandler,
} from "@/components/world/panels/prototype";
export { DevicePanel } from "@/components/world/panels/device";
export { WorkbenchPanel } from "@/components/world/panels/workbench";
export { InventoryPanel } from "@/components/world/panels/inventory";
export { JournalPanel } from "@/components/world/panels/journal";
export { PowerPanel } from "@/components/world/panels/power";
export {
  DialoguePanel,
  ElevatorPanel,
  ForgePanel,
  NotePanel,
} from "@/components/world/panels/misc";
