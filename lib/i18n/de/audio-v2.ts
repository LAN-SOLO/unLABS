/**
 * German translations — area "audioV2". Key = exact English source string from `tr("…")`.
 * Audio round 7: music switch setting, song length, footstep sets, tab-visibility fix.
 */
export const DE_AUDIO_V2: Record<string, string> = {
  // Settings → Audio
  "Style change": "Stilwechsel",
  "switch::Right away": "Sofort",
  "switch::After the song": "Nach dem Stück",
  "Right away: a new style crossfades to a fitting song within about 1.5 seconds (a song that already fits keeps playing).":
    "Sofort: Ein neuer Stil blendet in etwa 1,5 Sekunden zu einem passenden Stück über (ein Stück, das schon passt, läuft weiter).",
  "After the song: the current piece always plays to its end, then the next one comes from the new style. The room never cuts a song short either.":
    "Nach dem Stück: Das laufende Stück spielt immer zu Ende, danach kommt das nächste aus dem neuen Stil. Auch ein Raumwechsel bricht kein Stück mehr ab.",
  "Now playing: {title} ({genre}) · {pos} / {total}":
    "Läuft gerade: {title} ({genre}) · {pos} / {total}",
  "Now playing: the generative score": "Läuft gerade: die generative Musik",
  "Switches after this song ({left} left) → {style}":
    "Wechselt nach diesem Stück (noch {left}) → {style}",
  "Next: {style}": "Als Nächstes: {style}",
  "Song length": "Stücklänge",
  "length::Standard (as composed)": "Standard (wie komponiert)",
  "length::Long (~10 min)": "Lang (~10 Min.)",
  "length::Epic (20+ min)": "Episch (20+ Min.)",
  "Long and epic add variation passes (breakdowns, solos, drums dropping out, a key shift) before the outro. Applies from the next song.":
    "Lang und episch fügen vor dem Schluss Variationsdurchgänge hinzu (Breakdowns, Soli, aussetzende Drums, ein Tonartwechsel). Gilt ab dem nächsten Stück.",
  Footsteps: "Schritte",
  "Auto uses the shoes Jade is wearing (and what jingles on her); a fixed set always sounds the same. Volume follows Effects.":
    "Automatisch nimmt die Schuhe, die Jade trägt (und was an ihr klimpert); ein festes Set klingt immer gleich. Die Lautstärke folgt den Effekten.",
  "shoe::Auto (by shoes)": "Automatisch (nach Schuhen)",
  "shoe::Work boots": "Arbeitsstiefel",
  "shoe::Sneakers": "Sneaker",
  "shoe::Rubber boots": "Gummistiefel",
  "shoe::Magnetic boots": "Magnetstiefel",
  "shoe::Slippers": "Hausschuhe",
  "shoe::Clogs": "Clogs",
  "shoe::Roller skates": "Rollschuhe",
  // Studio
  Footwear: "Schuhwerk",
  "♪ {title} · {genre} · {pos} / {total} · {pass}":
    "♪ {title} · {genre} · {pos} / {total} · {pass}",
  "surface::Puddle": "Pfütze",
  "surface::Broken glass": "Glasscherben",
  "surface::Rubber mat": "Gummimatte",
  "surface::Gravel": "Kies",
  "surface::Ice": "Eis",
  "surface::Cables": "Kabel",
  "surface::Paper": "Papier",
  "pass::Breakdown": "Breakdown",
  "pass::Lift": "Aufschwung",
  "pass::Sparse": "Ausgedünnt",
  "pass::Counter-melody": "Gegenstimme",
  "pass::Drums out": "Ohne Drums",
  "pass::Bridge": "Bridge",
  "pass::Key shift": "Tonartwechsel",
  "sfxgroup::Replicator": "Replikator",
};
