"""Pipeline configuration: shape profiles, surface bindings, per-model overrides."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]  # repo root (…/scripts/crystal/blender/crystal/config.py)
CONFIG_DIR = ROOT / "scripts" / "crystal" / "config"
# Machine-specific (absolute paths into the user's library): never committed.
LIBRARY_CATALOG = ROOT / ".crystal" / "library" / "catalog.json"
PUBLIC_DIR = ROOT / "public" / "crystal"

# Bump when the build changes its output for unchanged inputs (invalidates the cache).
PIPELINE_VERSION = 3


def _read(name: str) -> dict:
    p = CONFIG_DIR / name
    return json.loads(p.read_text()) if p.exists() else {}


@dataclass
class Config:
    profiles: dict
    surfaces: dict
    overrides: dict
    catalog: dict

    @staticmethod
    def load() -> "Config":
        catalog = json.loads(LIBRARY_CATALOG.read_text()) if LIBRARY_CATALOG.exists() else {"entries": {}}
        return Config(_read("profiles.json"), _read("surfaces.json"), _read("overrides.json"), catalog)

    def profile_for(self, model_id: str, family: str) -> tuple[str, dict]:
        ov = self.overrides.get("models", {}).get(model_id, {})
        name = ov.get("profile") or self.profiles["families"].get(family) or self.profiles["families"]["default"]
        prof = dict(self.profiles["profiles"][name])
        prof.update(ov.get("shape", {}))
        return name, prof

    def surface_for(self, color_name: str, mat_class: str, model_id: str = "") -> str:
        ov = self.overrides.get("models", {}).get(model_id, {}).get("surfaces", {})
        if color_name in ov:
            return ov[color_name]
        for rule in self.surfaces["bindings"]:
            if "class" in rule and rule["class"] != mat_class:
                continue
            if "match" in rule and not re.search(rule["match"], color_name):
                continue
            return rule["surface"]
        return "plastic"

    def surface(self, sid: str) -> dict:
        return self.surfaces["surfaces"][sid]

    def library_entry(self, sid: str) -> dict | None:
        ref = self.surfaces["surfaces"].get(sid, {}).get("library")
        if not ref:
            return None
        return self.catalog.get("entries", {}).get(ref)

    def save_surfaces(self) -> None:
        (CONFIG_DIR / "surfaces.json").write_text(json.dumps(self.surfaces, indent=2) + "\n")

    def save_profiles(self) -> None:
        (CONFIG_DIR / "profiles.json").write_text(json.dumps(self.profiles, indent=2) + "\n")

    def save_overrides(self) -> None:
        (CONFIG_DIR / "overrides.json").write_text(json.dumps(self.overrides, indent=2) + "\n")
