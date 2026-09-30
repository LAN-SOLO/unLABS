export { AudioSystem, DEFAULT_VOLUMES } from "@/lib/world/audio/engine";
export type {
  AudioSystemOptions,
  BusVolumes,
  PlayOptions,
  StepOptions,
} from "@/lib/world/audio/engine";
export {
  FOOTSTEP_GAIN,
  SFX_NAMES,
  SURFACES,
  semitones,
  surfaceForTheme,
} from "@/lib/world/audio/sfx";
export type { BusName, SfxName, Surface } from "@/lib/world/audio/sfx";
export {
  AMBIENCE_KINDS,
  BROWNOUT_SAG_CENTS,
  HUM_CATEGORIES,
  MAX_DEVICE_HUMS,
  SAFE_ROOM_THEMES,
  ambienceFor,
  humCategory,
  humTargets,
  selectHums,
} from "@/lib/world/audio/ambience";
export type {
  AmbienceKind,
  DeviceEmitter,
  DeviceHumSource,
  HumCategory,
} from "@/lib/world/audio/ambience";
export { deviceEmitters, deviceLoad } from "@/lib/world/audio/emitters";
export type { EmitterPower } from "@/lib/world/audio/emitters";
export {
  HANDSHAKE_DEGREES,
  MUSIC_SCENES,
  STING_KINDS,
  floorDarkness,
  stingNotes,
} from "@/lib/world/audio/music";
export type { MusicScene, MusicState, StingKind } from "@/lib/world/audio/music";
export { REVERB_SIZES, reverbFor } from "@/lib/world/audio/reverb";
export type { ReverbSize, ReverbSpec } from "@/lib/world/audio/reverb";
export { VOICE_IDS, speakerPitch, speechPlan, voiceFor } from "@/lib/world/audio/voice";
export type { VoiceId } from "@/lib/world/audio/voice";
export { FootstepClock, StepTracker } from "@/lib/world/audio/footsteps";
export type { StepEvent } from "@/lib/world/audio/footsteps";
export {
  FOOTWEAR_SETS,
  MOTION_LAYER_KINDS,
  renderMotion,
  renderStep,
} from "@/lib/world/audio/footfall";
export type { Footwear, MotionLayerKind, StepKind } from "@/lib/world/audio/footfall";
export { activeAudio, registerActiveAudio } from "@/lib/world/audio/active";
