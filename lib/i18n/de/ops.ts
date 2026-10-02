/**
 * German translations — area "ops": the surveillance station, Jade's
 * routines and habits, the task schedule, bot duties / service / upgrades
 * and Jade's idle life (lib/world/ops/, content/bot-duties.ts,
 * components/world/ops/; docs/OPS.md).
 * Key = exact English source string from `tr("…")`.
 */
export const DE_OPS: Record<string, string> = {
  // Bot duties (content/bot-duties.ts)
  "Signal patrol": "Signalstreife",
  "Walks the rooms of its level, counts the days and sweeps the dust off what nobody uses.":
    "Geht die Räume seiner Ebene ab, zählt die Tage und fegt den Staub von dem, was niemand benutzt.",
  "Void transmission": "Übertragung aus der Leere",
  "Listens to the void and drops what it hears — when it wants to.":
    "Lauscht in die Leere und lässt fallen, was es hört — wenn es will.",
  "Verify research chains": "Forschungsketten prüfen",
  "Checks the Nexus research chain and clears the cycle for the next run.":
    "Prüft die Forschungskette des Nexus und gibt den Zyklus für den nächsten Lauf frei.",
  "Lost item recovery": "Fundsachen bergen",
  "Tracks down the missing parts of a picked-over spot so it can be searched again.":
    "Spürt die fehlenden Teile einer abgesuchten Stelle auf, damit man sie wieder durchsuchen kann.",
  "Terminal macro": "Terminal-Makro",
  "Runs one of Jade's routines for her, step by step, as a terminal macro.":
    "Führt eine von Jades Routinen für sie aus, Schritt für Schritt, als Terminal-Makro.",
  "Optimisation review": "Optimierungsprüfung",
  "Reviews every agent and plans their maintenance — all bots wear less.":
    "Prüft jeden Agenten und plant seine Wartung — alle Bots verschleißen weniger.",
  "Surveillance watch": "Überwachungsschicht",
  "Runs the surveillance station: sweeps every camera and reports what needs attention.":
    "Betreibt die Überwachungsstation: schwenkt jede Kamera durch und meldet, was Aufmerksamkeit braucht.",
  "Greenhouse crawl": "Gewächshausrunde",
  "Crawls the green rooms: waters the plants and harvests the algae tanks when they overflow.":
    "Kriecht durch die grünen Räume: gießt die Pflanzen und erntet die Algenbecken, wenn sie überwuchern.",
  "Catalogue the archive": "Archiv katalogisieren",
  "Files the day's finds and notes — Jade thinks more clearly for a while.":
    "Legt die Funde und Notizen des Tages ab — Jade denkt eine Weile klarer.",
  "Coordinate the agents": "Agenten koordinieren",
  "Synchronises the bot network: for a while every duty runs faster.":
    "Synchronisiert das Bot-Netz: eine Weile läuft jede Aufgabe schneller.",
  "Goes to the service station of its level: cleaned, oiled, calibrated — wear back to zero.":
    "Fährt zur Servicestation seiner Ebene: gereinigt, geölt, kalibriert — Verschleiß wieder auf null.",

  // Bot rules (ops/bots.ts)
  "Unknown duty.": "Unbekannte Aufgabe.",
  "still dormant.": "schläft noch.",
  "serviced at its dock — wear back to zero.":
    "an seinem Dock gewartet — Verschleiß wieder auf null.",
  "worn out — needs its service dock first.": "verschlissen — muss erst an sein Service-Dock.",
  "patrolled {n} rooms and swept the dust.": "hat {n} Räume abgegangen und den Staub gefegt.",
  "listened to the void. Nothing.": "hat in die Leere gelauscht. Nichts.",
  "dropped what it heard: {item}.": "hat fallen lassen, was es gehört hat: {item}.",
  "no Nexus online to verify.": "kein Nexus online zum Prüfen.",
  "verified the research chain — the next cycle is ready.":
    "hat die Forschungskette geprüft — der nächste Zyklus ist bereit.",
  "found nothing missing.": "hat nichts Fehlendes gefunden.",
  "tracked down the parts of {name}.": "hat die Teile von {name} aufgespürt.",
  "no routine to run.": "keine Routine zum Ausführen.",
  "ran “{name}” ({done}/{total}).": "hat „{name}“ ausgeführt ({done}/{total}).",
  "reviewed every agent — their wear is down by {n}.":
    "hat jeden Agenten geprüft — ihr Verschleiß sinkt um {n}.",
  "all cameras quiet.": "alle Kameras ruhig.",
  "watered the green rooms and harvested {n} glow algae.":
    "hat die grünen Räume gegossen und {n} Leuchtalgen geerntet.",
  "watered the green rooms.": "hat die grünen Räume gegossen.",
  "catalogued the day's finds — Jade thinks more clearly.":
    "hat die Funde des Tages katalogisiert — Jade denkt klarer.",
  "synchronised the agents — every duty runs faster for a while.":
    "hat die Agenten synchronisiert — eine Weile läuft jede Aufgabe schneller.",
  "{room}: plants need water": "{room}: Pflanzen brauchen Wasser",
  "{room}: dusty": "{room}: verstaubt",
  "{room}: algae overflowing": "{room}: Algen wuchern über",
  "{bot}: needs service": "{bot}: braucht Wartung",
  "fully upgraded.": "voll aufgerüstet.",
  "missing materials for the upgrade.": "es fehlen Materialien für das Upgrade.",
  "upgraded to level {n}.": "auf Stufe {n} aufgerüstet.",

  // Routines (ops/routines.ts)
  "Take: {name}": "Nehmen: {name}",
  "Read: {name}": "Lesen: {name}",
  "Solve: {name}": "Lösen: {name}",
  "Craft: {name}": "Herstellen: {name}",
  "Build: {name}": "Bauen: {name}",
  "Use: {name}": "Benutzen: {name}",
  "Switch: {name}": "Schalten: {name}",
  "Fly the drone": "Drohne fliegen",
  "Run a research cycle": "Forschungszyklus starten",
  "Link {a} → {b}": "Verbinden {a} → {b}",
  "Unlink {a} → {b}": "Trennen {a} → {b}",
  "not solved yet": "noch nicht gelöst",
  "recipe unknown": "Rezept unbekannt",
  "missing ingredients": "Zutaten fehlen",
  "unknown device": "unbekanntes Gerät",
  "already complete": "schon fertig",
  resting: "ruht",

  // Algae harvest (decor-actions.ts)
  "The tank had overgrown — the algae spilled over the rim. I harvest {n} glow algae.":
    "Das Becken ist zugewuchert — die Algen quellen über den Rand. Ich ernte {n} Leuchtalgen.",

  // Idle life, toasts
  "You were away for hours — Jade went to bed.":
    "Du warst stundenlang weg — Jade ist ins Bett gegangen.",
  "While you were away Jade went to her quarters to train.":
    "Während du weg warst, ist Jade zum Trainieren in ihr Quartier gegangen.",
  "While you were away Jade went to her quarters to read.":
    "Während du weg warst, ist Jade zum Lesen in ihr Quartier gegangen.",
  "Jade: {text}": "Jade: {text}",
  "Jade remembers: “{name}” — she will finish it herself next time (Surveillance → Routines).":
    "Jade merkt sich: „{name}“ — nächstes Mal macht sie es selbst fertig (Überwachung → Routinen).",
  "Jade finishes the habit “{name}” ({done}/{total}).":
    "Jade erledigt die Gewohnheit „{name}“ ({done}/{total}).",

  // Panel
  "Surveillance Station": "Überwachungsstation",
  "Every room, every routine, every bot": "Jeder Raum, jede Routine, jeder Bot",
  Cameras: "Kameras",
  Routines: "Routinen",
  "Camera feed: {room}": "Kamerabild: {room}",
  "No signal — nobody has been on this level yet.":
    "Kein Signal — auf dieser Ebene war noch niemand.",
  "Needs attention": "Braucht Aufmerksamkeit",
  "All cameras quiet.": "Alle Kameras ruhig.",
  once: "einmal",
  "every 5 min": "alle 5 Min.",
  "every 15 min": "alle 15 Min.",
  "every 30 min": "alle 30 Min.",
  "every hour": "jede Stunde",
  recorded: "aufgezeichnet",
  habit: "Gewohnheit",
  combined: "kombiniert",
  "Jade ran the routine: {done}/{total} steps.":
    "Jade hat die Routine ausgeführt: {done}/{total} Schritte.",
  "Record a routine": "Routine aufzeichnen",
  "Recording — {n} steps so far. Play on; close this panel.":
    "Aufnahme läuft — bisher {n} Schritte. Spiel weiter; schließ dieses Fenster.",
  "Routine name": "Name der Routine",
  "Routine {n}": "Routine {n}",
  "Jade memorised “{name}”.": "Jade hat sich „{name}“ gemerkt.",
  "Stop & keep": "Stopp & behalten",
  "Jade notes every step you take. Do something three times and she knows it by heart.":
    "Jade merkt sich jeden Schritt. Mach etwas dreimal, und sie kann es auswendig.",
  "● Record": "● Aufnehmen",
  "No routines yet.": "Noch keine Routinen.",
  "Select for combining": "Zum Kombinieren auswählen",
  "{n} steps": "{n} Schritte",
  "{n}× used": "{n}× benutzt",
  Run: "Ausführen",
  "Habit: Jade finishes it herself when you start it":
    "Gewohnheit: Jade macht es selbst fertig, wenn du damit anfängst",
  "Auto on": "Auto an",
  "Auto off": "Auto aus",
  Forget: "Vergessen",
  "Name of the combination": "Name der Kombination",
  "These routines cannot be combined.": "Diese Routinen lassen sich nicht kombinieren.",
  "Combined: “{name}”.": "Kombiniert: „{name}“.",
  "Combine {n} in this order": "{n} in dieser Reihenfolge kombinieren",
  "Last steps": "Letzte Schritte",
  "That task cannot be planned.": "Diese Aufgabe lässt sich nicht planen.",
  "Tasks run on the play clock, highest priority first — one per agent at a time. During a long pause Jade works off her own queue before she rests.":
    "Aufgaben laufen nach der Spieluhr, höchste Priorität zuerst — pro Agent eine nach der anderen. In einer langen Pause arbeitet Jade erst ihre eigene Liste ab, bevor sie sich ausruht.",
  "Nothing planned.": "Nichts geplant.",
  due: "fällig",
  "in {t}": "in {t}",
  "Lower priority": "Priorität senken",
  "Raise priority": "Priorität erhöhen",
  Now: "Jetzt",
  Hold: "Anhalten",
  Remove: "Entfernen",
  Task: "Aufgabe",
  "— record a routine first —": "— erst eine Routine aufzeichnen —",
  Routine: "Routine",
  "— which routine —": "— welche Routine —",
  Repeat: "Wiederholen",
  Plan: "Planen",
  "{n} runs": "{n} Einsätze",
  dormant: "schlafend",
  Wear: "Verschleiß",
  "Upgrade to {n}:": "Upgrade auf {n}:",
  Upgrade: "Aufrüsten",
};
