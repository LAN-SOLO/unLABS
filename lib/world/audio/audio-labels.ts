/**
 * Player-visible names for the round-7 audio options: style-switch mode,
 * song length, footwear sets, floor surfaces and variation passes
 * (settings, studio). German: lib/i18n/de/audio-v2.ts (surface names that
 * already existed live in lib/i18n/de/studio.ts).
 */
import { tr } from "@/lib/i18n";
import type { VaryKind } from "@/lib/world/audio/songs/arrange";
import type { Surface } from "@/lib/world/audio/sfx";
import type {
  Footwear,
  FootstepMode,
  MusicSwitchMode,
  SongLength,
} from "@/lib/world/audio/songs/styles";

export const SWITCH_LABEL: Readonly<Record<MusicSwitchMode, string>> = {
  now: tr("switch::Right away"),
  afterSong: tr("switch::After the song"),
};

export const LENGTH_LABEL: Readonly<Record<SongLength, string>> = {
  standard: tr("length::Standard (as composed)"),
  long: tr("length::Long (~10 min)"),
  epic: tr("length::Epic (20+ min)"),
};

export const FOOTWEAR_LABEL: Readonly<Record<Footwear, string>> = {
  boot: tr("shoe::Work boots"),
  sneaker: tr("shoe::Sneakers"),
  rubber: tr("shoe::Rubber boots"),
  magnetic: tr("shoe::Magnetic boots"),
  slipper: tr("shoe::Slippers"),
  clog: tr("shoe::Clogs"),
  skate: tr("shoe::Roller skates"),
};

export const FOOTSTEP_MODE_LABEL: Readonly<Record<FootstepMode, string>> = {
  auto: tr("shoe::Auto (by shoes)"),
  ...FOOTWEAR_LABEL,
};

export const SURFACE_LABEL: Readonly<Record<Surface, string>> = {
  metal: tr("surface::Metal"),
  grate: tr("surface::Grating"),
  concrete: tr("surface::Concrete"),
  tile: tr("surface::Tiles"),
  carpet: tr("surface::Carpet"),
  wood: tr("surface::Wood"),
  water: tr("surface::Puddle"),
  glass: tr("surface::Broken glass"),
  rubber: tr("surface::Rubber mat"),
  gravel: tr("surface::Gravel"),
  ice: tr("surface::Ice"),
  cable: tr("surface::Cables"),
  paper: tr("surface::Paper"),
};

export const VARY_LABEL: Readonly<Record<VaryKind, string>> = {
  breakdown: tr("pass::Breakdown"),
  lift: tr("pass::Lift"),
  sparse: tr("pass::Sparse"),
  counter: tr("pass::Counter-melody"),
  drumless: tr("pass::Drums out"),
  bridge: tr("pass::Bridge"),
  shift: tr("pass::Key shift"),
};
