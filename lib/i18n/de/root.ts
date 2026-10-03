/** German translations — area "root" (Root-Labor, docs/ROOT-LAB.md). Key = exact English source string from `tr("…")`. */
export const DE_ROOT: Record<string, string> = {
  // bridge.ts / big terminal
  "root: unknown command. “root help” lists them.":
    "root: unbekannter Befehl. „root help“ listet sie auf.",
  "{via}: {what}": "{via}: {what}",
  "Storage full or blocked. The change is lost.":
    "Speicher voll oder gesperrt. Die Änderung ist verloren.",
  "Main Console · {cmd}": "Hauptkonsole · {cmd}",
  "── root · the lab's system layer · ring {n} ({name}) ──":
    "── root · die Systemebene des Labors · Ring {n} ({name}) ──",
  "Room terminals know the same commands. Details: man <command> there.":
    "Die Raumterminals kennen dieselben Befehle. Details: dort man <Befehl>.",
  "labor root <command>    System layer: su, sysctl, fw, cron, profile …":
    "labor root <Befehl>     Systemebene: su, sysctl, fw, cron, profile …",
  "Root lab: tune the lab world's system (sysctl, firmware, cron, profiles)":
    "Root-Labor: das System der Laborwelt tunen (sysctl, Firmware, cron, Profile)",
  "root [help | su | sysctl … | fw … | sensors | cron … | profile … | audit | rescue]":
    "root [help | su | sysctl … | fw … | sensors | cron … | profile … | audit | rescue]",
  "cron #{id}: {what}": "cron #{id}: {what}",

  // access.ts
  "MCP> Diagnostics confirm you are not a fault. I am adding jade to wheel. Do not make me regret it.":
    "MCP> Die Diagnose bestätigt: Sie sind kein Fehler. Ich nehme jade in wheel auf. Lassen Sie mich das nicht bereuen.",
  "MCP> You can see clock, memory and heat now. Then you may touch them. Root granted.":
    "MCP> Sie sehen jetzt Takt, Speicher und Wärme. Dann dürfen Sie sie auch anfassen. Root gewährt.",
  "MCP> The Supercomputer Array has compiled you a kernel. Ring 0. There is no one above you now, Dr. Lawrence. Not even me.":
    "MCP> Das Supercomputer-Array hat Ihnen einen Kernel kompiliert. Ring 0. Über Ihnen ist jetzt niemand mehr, Dr. Lawrence. Nicht einmal ich.",
  "ring {n} first": "erst Ring {n}",
  "log into {n} room terminals ({have} so far)": "an {n} Raumterminals anmelden (bisher {have})",
  "{name} ({id}) online": "{name} ({id}) online",

  // shell.ts — rings
  "{what}: permission denied (needs ring {n} · {name}).":
    "{what}: Zugriff verweigert (braucht Ring {n} · {name}).",
  "“su” shows what the MCP wants before it hands over the next ring.":
    "„su“ zeigt, was der MCP sehen will, bevor er den nächsten Ring herausgibt.",
  "su: unknown ring. Rings: operator, wheel, root, kernel (0–3).":
    "su: unbekannter Ring. Ringe: operator, wheel, root, kernel (0–3).",
  "su: already kernel. There is nothing above ring 0.":
    "su: bereits kernel. Über Ring 0 gibt es nichts.",
  "su: already {name}.": "su: bereits {name}.",
  "Dropped to {name}. Credentials kept — “su” climbs back.":
    "Auf {name} gewechselt. Die Rechte bleiben — „su“ steigt wieder auf.",
  "su: one ring at a time. Next: {name}.": "su: ein Ring nach dem anderen. Als Nächstes: {name}.",
  "MCP> Ring {n} ({name}) denied. What I still need to see:":
    "MCP> Ring {n} ({name}) verweigert. Was ich noch sehen muss:",
  "Ring {n} · {name}. “help” lists what is new.": "Ring {n} · {name}. „help“ zeigt, was neu ist.",

  // sysctl
  "sysctl · {n} tunables · * = changed · load = kernel watts on the MCP-000":
    "sysctl · {n} Stellgrößen · * = geändert · Last = Kernel-Watt am MCP-000",
  "Kernel load: {w} W · “sysctl <key>” explains one · “sysctl <key>=<value>” sets it":
    "Kernel-Last: {w} W · „sysctl <Schlüssel>“ erklärt · „sysctl <Schlüssel>=<Wert>“ setzt",
  "Syntax: sysctl reset <key|all>": "Syntax: sysctl reset <Schlüssel|all>",
  "sysctl: nothing to reset.": "sysctl: nichts zurückzusetzen.",
  "{n} tunable(s) back to their rating.": "{n} Stellgröße(n) zurück auf Nennwert.",
  "sysctl: unknown key “{key}”. “sysctl -a” lists them.":
    "sysctl: unbekannter Schlüssel „{key}“. „sysctl -a“ listet alle.",
  "Did you mean: {keys}": "Meinten Sie: {keys}",
  "  default {def} · ring {r}+ may set {lo}…{hi} · ring 3 (kernel) {klo}…{khi}":
    "  Standard {def} · ab Ring {r}: {lo}…{hi} · Ring 3 (kernel): {klo}…{khi}",
  "sysctl: “{v}” is not a number.": "sysctl: „{v}“ ist keine Zahl.",
  "sysctl: {key} must stay within {lo}…{hi} {unit} at ring {n}.":
    "sysctl: {key} muss auf Ring {n} zwischen {lo}…{hi} {unit} bleiben.",
  "Ring 3 (kernel) widens it to {lo}…{hi}.": "Ring 3 (kernel) erweitert auf {lo}…{hi}.",
  "  kernel load +{w} W on the MCP-000": "  Kernel-Last +{w} W am MCP-000",

  // fw
  "TRIPPED (heat)": "ABGESCHALTET (Hitze)",
  "BROWNOUT (undervolted)": "BROWNOUT (Unterspannung)",
  "  heat {h} / limit {l} · stable up to {c} % clock at {v} % volt":
    "  Wärme {h} / Grenze {l} · stabil bis {c} % Takt bei {v} % Spannung",
  "  grid {g0} → {g1} W generated · {d0} → {d1} W demand · {status}":
    "  Netz {g0} → {g1} W erzeugt · {d0} → {d1} W Bedarf · {status}",
  "  ! below {c} % the firmware update features switch off":
    "  ! unter {c} % schalten sich die Firmware-Update-Funktionen ab",
  "  ! unstable: raise the voltage or lower the clock":
    "  ! instabil: Spannung erhöhen oder Takt senken",
  "  ! too hot: link it to a running THM-001 or lower clock/voltage":
    "  ! zu heiß: an einen laufenden THM-001 koppeln oder Takt/Spannung senken",
  "fw: no built device to tune yet.": "fw: noch kein gebautes Gerät zum Tunen.",
  "fw · firmware tuning · clock / voltage in % of rating · heat / limit · * = tuned":
    "fw · Firmware-Tuning · Takt / Spannung in % vom Nennwert · Wärme / Grenze · * = getunt",
  state: "Zustand",
  "“fw <ID>” details · “fw <ID> <clock> [volt] --dry” previews · profiles: {p}":
    "„fw <ID>“ Details · „fw <ID> <Takt> [Spannung] --dry“ Vorschau · Profile: {p}",
  "fw: unknown device “{id}”.": "fw: unbekanntes Gerät „{id}“.",
  "MCP> Hands off my core. Tune the kernel instead: sysctl.":
    "MCP> Finger weg von meinem Kern. Tunen Sie lieber den Kernel: sysctl.",
  "fw: {id} is not built.": "fw: {id} ist nicht gebaut.",
  "clock {c} % · voltage {v} % · {state}": "Takt {c} % · Spannung {v} % · {state}",
  "output rated {w} W · scales with the clock": "Nennleistung {w} W · skaliert mit dem Takt",
  "draw {w} W (rated {r} W) · scales with clock × voltage²":
    "Verbrauch {w} W (Nennwert {r} W) · skaliert mit Takt × Spannung²",
  "heat {h} / limit {l} · stable up to {c} % clock at this voltage":
    "Wärme {h} / Grenze {l} · stabil bis {c} % Takt bei dieser Spannung",
  "! below {c} % — firmware update features are off":
    "! unter {c} % — Firmware-Update-Funktionen sind aus",
  "Range at ring {n}: clock {c0}…{c1} % · voltage {v0}…{v1} %":
    "Bereich auf Ring {n}: Takt {c0}…{c1} % · Spannung {v0}…{v1} %",
  "Tuning needs ring 2 (root).": "Tunen braucht Ring 2 (root).",
  "fw: {id} already runs at its rating.": "fw: {id} läuft bereits auf Nennwert.",
  "{id} back to 100 % / 100 %.": "{id} zurück auf 100 % / 100 %.",
  "fw: profiles are {p}.": "fw: Profile sind {p}.",
  "fw: no stable setting fits under the thermal limit.":
    "fw: keine stabile Einstellung passt unter die Wärmegrenze.",
  "Syntax: fw <ID> <clock %> [volt %] [--dry]  ·  fw <ID> clock=120 volt=110":
    "Syntax: fw <ID> <Takt %> [Spannung %] [--dry]  ·  fw <ID> clock=120 volt=110",
  "fw: ring {n} allows clock {c0}…{c1} % and voltage {v0}…{v1} %.":
    "fw: Ring {n} erlaubt Takt {c0}…{c1} % und Spannung {v0}…{v1} %.",
  "{head} · dry run, nothing flashed": "{head} · Probelauf, nichts geflasht",
  "{head} · flashed": "{head} · geflasht",

  // sensors
  "sensors · heat as clock × voltage, limit 120 alone · 150 on THM-001":
    "sensors · Wärme = Takt × Spannung, Grenze 120 allein · 150 am THM-001",
  "{n} more device(s) at their rating · heat 100":
    "{n} weitere(s) Gerät(e) auf Nennwert · Wärme 100",
  "Kernel load {w} W = sysctl {a} W + {n} governor(s) × {g} W":
    "Kernel-Last {w} W = sysctl {a} W + {n} Governor × {g} W",
  "Grid {gen} W / {load} W · {n} without supply": "Netz {gen} W / {load} W · {n} ohne Versorgung",

  // cron
  "cron: guard syntax is “when <metric><op><number> <command>”.":
    "cron: Bedingung lautet „when <Messwert><Op><Zahl> <Befehl>“.",
  "cron: metrics are {m}.": "cron: Messwerte sind {m}.",
  "cron: no command.": "cron: kein Befehl.",
  "cron: “{head}” cannot run unattended. Allowed: {h}.":
    "cron: „{head}“ kann nicht unbeaufsichtigt laufen. Erlaubt: {h}.",
  "crontab is empty.": "Die crontab ist leer.",
  "Example: cron add 30 when balance<0 profile load eco":
    "Beispiel: cron add 30 when balance<0 profile load eco",
  "crontab · {n}/{max} jobs · runs in play time": "crontab · {n}/{max} Jobs · läuft in Spielzeit",
  "  (last {t}s ago)": "  (zuletzt vor {t} s)",
  "cron: no job #{id}.": "cron: kein Job #{id}.",
  "Job #{id} removed.": "Job #{id} entfernt.",
  "Syntax: cron add <seconds> [when <metric><op><n>] <command>[; <command>]":
    "Syntax: cron add <Sekunden> [when <Messwert><Op><n>] <Befehl>[; <Befehl>]",
  "cron: at least every {n} s — the scheduler needs to breathe.":
    "cron: höchstens alle {n} s — der Scheduler muss atmen.",
  "cron: crontab full ({n} jobs). “cron rm <id>” first.":
    "cron: crontab voll ({n} Jobs). Erst „cron rm <id>“.",
  "cron: command too long.": "cron: Befehl zu lang.",
  "Job #{id} every {s} s as {ring}: {cmd}": "Job #{id} alle {s} s als {ring}: {cmd}",
  "Syntax: cron [list | add <seconds> <command> | rm <id>]":
    "Syntax: cron [list | add <Sekunden> <Befehl> | rm <id>]",

  // profile
  "{a} sysctl · {b} fw": "{a} sysctl · {b} fw",
  "No profiles. “profile save <name>” keeps the current tuning.":
    "Keine Profile. „profile save <Name>“ sichert das aktuelle Tuning.",
  "profiles · {n}/{max}": "Profile · {n}/{max}",
  "profile: names are a–z, 0–9, _ and - (max. 24).":
    "profile: Namen bestehen aus a–z, 0–9, _ und - (max. 24).",
  "profile: no profile “{name}”.": "profile: kein Profil „{name}“.",
  "Share code of “{name}”:": "Teilcode von „{name}“:",
  "profile: {n} profiles max. “profile rm <name>” first.":
    "profile: höchstens {n} Profile. Erst „profile rm <Name>“.",
  "Profile “{name}” saved.": "Profil „{name}“ gespeichert.",
  "Profile “{name}” loaded · {sum}": "Profil „{name}“ geladen · {sum}",
  "Profile “{name}” removed.": "Profil „{name}“ entfernt.",
  "profile: the share code is damaged.": "profile: der Teilcode ist beschädigt.",
  "Profile “{name}” imported · {sum} · “profile load {name}” applies it":
    "Profil „{name}“ importiert · {sum} · „profile load {name}“ wendet es an",
  "Syntax: profile [list | save|load|rm|show|export <name> | import <name> <code>]":
    "Syntax: profile [list | save|load|rm|show|export <Name> | import <Name> <Code>]",

  // audit / rescue
  "Audit trail is empty. Nothing has been changed yet.":
    "Das Audit-Protokoll ist leer. Noch wurde nichts geändert.",
  "audit · last {n} change(s) · play time": "audit · letzte {n} Änderung(en) · Spielzeit",
  "rescue: resets every tunable and every firmware curve to its rating ({n} change(s)).":
    "rescue: setzt jede Stellgröße und jede Firmware-Kurve auf Nennwert zurück ({n} Änderung(en)).",
  "Works at any ring. Profiles, cron and rings stay. Confirm with: rescue --yes":
    "Geht auf jedem Ring. Profile, cron und Ringe bleiben. Bestätigen mit: rescue --yes",
  "rescue: everything already runs at its rating.": "rescue: alles läuft bereits auf Nennwert.",
  "MCP> Factory curves restored. Whatever you were trying, the lab is breathing again.":
    "MCP> Werkskurven wiederhergestellt. Was immer Sie vorhatten — das Labor atmet wieder.",
  "su: not from cron.": "su: nicht aus cron.",
  "cron: not from cron.": "cron: nicht aus cron.",
  "rescue: not from cron.": "rescue: nicht aus cron.",
  "{cmd}: not a root command.": "{cmd}: kein root-Befehl.",

  // help lines
  "climb an access ring (operator → wheel → root → kernel)":
    "einen Zugriffsring aufsteigen (operator → wheel → root → kernel)",
  "su [operator|wheel|root|kernel]": "su [operator|wheel|root|kernel]",
  "the lab's tunables: power, research, drones, aging":
    "die Stellgrößen des Labors: Strom, Forschung, Drohnen, Alterung",
  "sysctl [-a | <key> | <key>=<value> | reset <key|all>]":
    "sysctl [-a | <Schlüssel> | <Schlüssel>=<Wert> | reset <Schlüssel|all>]",
  "firmware tuning: clock and voltage per device": "Firmware-Tuning: Takt und Spannung pro Gerät",
  "fw [list | <ID> | <ID> <clock> [volt] [--dry] | <ID> profile|autotune|reset]":
    "fw [list | <ID> | <ID> <Takt> [Spannung] [--dry] | <ID> profile|autotune|reset]",
  "heat, thermal limits and kernel load": "Wärme, Wärmegrenzen und Kernel-Last",
  "jobs that run on their own, with guards": "Jobs, die von selbst laufen, mit Bedingungen",
  "cron [list | add <s> [when <metric><op><n>] <cmd> | rm <id>]":
    "cron [list | add <s> [when <Messwert><Op><n>] <Befehl> | rm <id>]",
  "save, load and share whole tunings": "ganze Tunings sichern, laden und teilen",
  "profile [list | save|load|rm|show|export <name> | import <name> <code>]":
    "profile [list | save|load|rm|show|export <Name> | import <Name> <Code>]",
  "who changed what in the system, when": "wer wann was im System geändert hat",
  "audit [n]": "audit [n]",
  "factory curves for everything (safety net)": "Werkskurven für alles (Sicherheitsnetz)",

  // tunables
  "Nominal output of the Unstable Energy Core. Higher runs the core hotter.":
    "Nennleistung des Unstable Energy Core. Mehr lässt den Kern heißer laufen.",
  "Reactive-power compensation of PWD-001 fed back into the bus.":
    "Blindleistungskompensation des PWD-001, die zurück in den Bus fließt.",
  "Watts BAT-001 lends the grid. More buffer, more charge-controller load.":
    "Watt, die BAT-001 dem Netz leiht. Mehr Puffer, mehr Last am Laderegler.",
  "Seconds per research cycle. Shorter cycles keep the scheduler busy.":
    "Sekunden pro Forschungszyklus. Kürzere Zyklen beschäftigen den Scheduler.",
  "Extra research points per cycle from deeper analysis passes.":
    "Zusätzliche Forschungspunkte pro Zyklus durch tiefere Analysedurchläufe.",
  "Seconds between drone flights. Shorter turnarounds need route planning.":
    "Sekunden zwischen Drohnenflügen. Kürzere Wenden brauchen Routenplanung.",
  "Plant growth speed in lit, watered rooms (grow lights, nutrient pumps).":
    "Wachstumstempo der Pflanzen in hellen, gegossenen Räumen (Pflanzenlicht, Nährstoffpumpen).",
  "How fast dust settles in dry rooms. Cleaner air means running the filters.":
    "Wie schnell sich Staub in trockenen Räumen legt. Sauberere Luft heißt: Filter laufen lassen.",

  // terminal-lite
  "ring {n} · {name}": "Ring {n} · {name}",
  "usage: sudo <command>": "Aufruf: sudo <Befehl>",
  "Rings: 0 operator · 1 wheel (sudo, cron) · 2 root (firmware, power) · 3 kernel (wide ranges).":
    "Ringe: 0 operator · 1 wheel (sudo, cron) · 2 root (Firmware, Strom) · 3 kernel (weite Bereiche).",
  "Without an argument it climbs one ring — and lists what the MCP still needs to see.":
    "Ohne Argument steigt es einen Ring auf — und listet, was der MCP noch sehen muss.",
  "Every gameplay constant a root player may change. Each tweak adds kernel load (W on the MCP-000).":
    "Jede Spielkonstante, die ein Root-Spieler ändern darf. Jeder Eingriff kostet Kernel-Last (W am MCP-000).",
  "Example: sysctl research.cooldown=70": "Beispiel: sysctl research.cooldown=70",
  "Draw scales with clock × voltage², output with clock. Heat = clock × voltage must stay under its limit.":
    "Verbrauch skaliert mit Takt × Spannung², Leistung mit dem Takt. Wärme = Takt × Spannung muss unter der Grenze bleiben.",
  "An undervolted core browns out; below 90 % clock the update features switch off.":
    "Ein unterversorgter Kern bricht ein; unter 90 % Takt schalten sich die Update-Funktionen ab.",
  "Examples: fw UEC-001 115 108 --dry · fw AIC-001 autotune · fw VNT-001 profile eco":
    "Beispiele: fw UEC-001 115 108 --dry · fw AIC-001 autotune · fw VNT-001 profile eco",
  "Metrics for guards: gen, load, balance, starved, kload. Allowed commands: sysctl, fw, profile, switch.":
    "Messwerte für Bedingungen: gen, load, balance, starved, kload. Erlaubte Befehle: sysctl, fw, profile, switch.",
  "Share codes (UNR1-…) carry a tuning to another save; values are clamped to your ring.":
    "Teilcodes (UNR1-…) tragen ein Tuning in einen anderen Spielstand; Werte werden auf Ihren Ring begrenzt.",
  "Ring {n} · {name} · kernel load {w} W · {c} cron job(s)":
    "Ring {n} · {name} · Kernel-Last {w} W · {c} cron-Job(s)",
};
