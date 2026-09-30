/**
 * German translations — area "menu": title screen, pause menu, settings
 * panel, save slots, credits, loading screen and menu lore
 * (components/world/menu/*). Key = exact English source string from `tr("…")`.
 */
export const DE_MENU: Record<string, string> = {
  // ── Title screen ──
  "Language / Sprache": "Sprache / Language",
  "Boot log": "Startprotokoll",
  Continue: "Fortsetzen",
  "no save": "kein Spielstand",
  "New Game": "Neues Spiel",
  "New Game+": "Neues Spiel+",
  "Achievements & knowledge carry over": "Erfolge & Wissen bleiben",
  Load: "Laden",
  Settings: "Einstellungen",
  Controls: "Steuerung",
  Credits: "Credits",
  "To the terminal": "Zum Terminal",
  Quit: "Beenden",
  "_unLAB main menu": "_unLAB Hauptmenü",
  "The Unstable Lab": "Das instabile Labor",
  "Main menu": "Hauptmenü",
  "↑ ↓ select · Enter confirm · Esc back": "↑ ↓ wählen · Eingabe bestätigen · Esc zurück",
  "Choose a save slot.": "Wähle einen Speicherplatz.",
  "Achievements, handbook knowledge and recipes carry over. Choose a save slot.":
    "Erfolge, Handbuch-Wissen und Rezepte bleiben. Wähle einen Speicherplatz.",
  "Choose a save.": "Spielstand wählen.",
  "Quit?": "Beenden?",
  "The lab keeps running without you. Your progress is saved.":
    "Das Labor läuft ohne dich weiter. Dein Fortschritt ist gespeichert.",

  // ── Pause menu ──
  Resume: "Fortsetzen",
  Save: "Speichern",
  Desktop: "Desktop",
  Pause: "Pause",
  "Playtime {time}": "Spielzeit {time}",
  "↑ ↓ select · Enter confirm · Esc resume": "↑ ↓ wählen · Eingabe bestätigen · Esc weiterspielen",
  "The game then continues in this slot.": "Das Spiel läuft danach in diesem Speicherplatz weiter.",
  "Saved: {slot}": "Gespeichert: {slot}",
  "Saving failed.": "Speichern fehlgeschlagen.",
  "Cold start with memories: achievements, handbook knowledge and recipes carry over, and so does a cup of coffee. Choose a save slot.":
    "Kaltstart mit Erinnerungen: Erfolge, Handbuch-Wissen und Rezepte bleiben, eine Tasse Kaffee auch. Wähle einen Speicherplatz.",
  "Back to the main menu?": "Zum Hauptmenü?",
  "Your progress has been saved automatically. You can continue at any time.":
    "Dein Fortschritt ist automatisch gespeichert. Du kannst jederzeit fortsetzen.",
  "Quit game?": "Spiel beenden?",
  "Your current progress is saved to your slot, then the window closes.":
    "Der aktuelle Stand wird in deinem Speicherplatz gesichert, dann schließt sich das Fenster.",

  // ── Settings panel ──
  Graphics: "Grafik",
  Camera: "Kamera",
  Audio: "Audio",
  Game: "Spiel",
  Accessibility: "Barrierefreiheit",
  Preview: "Vorschau",
  "Yellow = character, cyan = camera": "Gelb = Figur, Cyan = Kamera",
  "Cryo pod opened. Residual charge 0.3 %. Please do not panic.":
    "Kryokapsel geöffnet. Restladung 0,3 %. Bitte nicht erschrecken.",
  Alarm: "Alarm",
  Warning: "Warnung",
  Info: "Info",
  Anomaly: "Anomalie",
  "Status colours with the active filter": "Statusfarben mit aktivem Filter",
  Preset: "Voreinstellung",
  "Custom settings active": "Eigene Einstellungen aktiv",
  "Resolution scale": "Auflösungsfaktor",
  "Renderer pixel ratio (max. screen)": "Pixelverhältnis des Renderers (max. Bildschirm)",
  Shadows: "Schatten",
  "Bloom (glow)": "Bloom (Leuchten)",
  "Bloom strength": "Bloom-Stärke",
  "Particle density": "Partikeldichte",
  "Title screen diorama": "Titelbildschirm-Diorama",
  "Live 3D lab behind the main menu (off = flat backdrop)":
    "Lebendiges 3D-Labor hinter dem Hauptmenü (aus = flacher Hintergrund)",
  "Frame rate limit": "Bildrate begrenzen",
  unlimited: "unbegrenzt",
  "{n} fps": "{n} fps",
  "Show FPS": "FPS anzeigen",
  "Default zoom": "Standard-Zoom",
  "Smaller = closer": "Kleiner = näher dran",
  "Rotation speed": "Drehgeschwindigkeit",
  "Camera follow": "Kamera-Nachführung",
  "0 % = direct, 100 % = very soft": "0 % = direkt, 100 % = sehr weich",
  "Master volume": "Gesamtlautstärke",
  Music: "Musik",
  Effects: "Effekte",
  Ambience: "Atmosphäre",
  Interface: "Oberfläche",
  Voices: "Stimmen",
  Mute: "Stummschalten",
  "Test {channel}": "{channel} testen",
  "Test tone": "Probeton",
  "Reloads the game (progress is saved)": "Lädt das Spiel neu (Fortschritt wird gespeichert)",
  "Text speed": "Textgeschwindigkeit",
  Hints: "Hinweise",
  "Gentle tips when you are stuck": "Sanfte Tipps, wenn es nicht weitergeht",
  "Message duration": "Meldungsdauer",
  HUD: "HUD",
  "Compact folds the buttons into one menu; minimal keeps status, compass and map":
    "Kompakt faltet die Knöpfe in ein Menü; minimal zeigt nur Status, Kompass und Karte",
  "{n} s": "{n} s",
  Autosave: "Autosave",
  "Confirm delete/overwrite": "Nachfragen bei Löschen/Überschreiben",
  "Reduce flicker": "Flackern reduzieren",
  "No phosphor flicker, no flashes": "Kein Phosphorflimmern, keine Blitze",
  "Reduce motion": "Bewegung reduzieren",
  "Less animation in menus and camera": "Weniger Animation in Menüs und Kamera",
  "High-contrast focus ring": "Deutlicher Fokusrahmen",
  "Interface size": "Oberflächengröße",
  "Subtitle & dialogue size": "Untertitel- & Dialoggröße",
  "Text size in conversations, terminals and scenes":
    "Textgröße in Gesprächen, Terminals und Szenen",
  "You now have enough power to fail at more interesting things.":
    "Sie haben jetzt genug Strom, um an interessanteren Dingen zu scheitern.",
  "Colour vision deficiency": "Farbsehschwäche",
  "{key} is bound more than once: {actions}.": "{key} ist mehrfach belegt: {actions}.",
  "{key} (“{action}”) replaces the secondary key of “{loser}”.":
    "{key} (»{action}«) ersetzt die Zweittaste von »{loser}«.",
  "{key} (“{action}”) also controls the menus — in a menu the key acts there.":
    "{key} (»{action}«) steuert auch die Menüs — im Menü wirkt die Taste dort.",
  "{key} is reserved and cannot be bound.": "{key} ist reserviert und kann nicht belegt werden.",
  "{key} was bound to “{action}” — swapped: “{action}” is now on {newKey}.":
    "{key} war mit »{action}« belegt — getauscht: »{action}« liegt jetzt auf {newKey}.",
  "“{action}” was on {oldKey} and has been moved to {newKey}.":
    "»{action}« lag auf {oldKey} und wurde auf {newKey} verschoben.",
  "All keys reset to default.": "Alle Tasten auf Standard zurückgesetzt.",
  "Click a key, then press the new binding. Esc cancels. Keys that are already taken are swapped.":
    "Klicke auf eine Taste und drücke dann die neue Belegung. Esc bricht ab. Doppelt belegte Tasten werden getauscht.",
  Conflicts: "Konflikte",
  "Reset all keys": "Alle Tasten zurücksetzen",
  "Rebind {action}": "{action} neu belegen",
  "Key …": "Taste …",
  Default: "Standard",
  "Reset {action}": "{action} zurücksetzen",
  "Changes apply immediately.": "Änderungen gelten sofort.",
  Categories: "Kategorien",
  "Restore defaults": "Standard wiederherstellen",
  Done: "Fertig",
  "Restore defaults?": "Standard wiederherstellen?",
  "All values in “{tab}” will be reset to their defaults.":
    "Alle Werte im Bereich »{tab}« werden auf die Standardwerte zurückgesetzt.",
  Reset: "Zurücksetzen",

  // ── Save slots ──
  "Start here": "Hier starten",
  "↑ ↓ select · Enter load · Del delete · Esc back":
    "↑ ↓ wählen · Eingabe laden · Entf löschen · Esc zurück",
  "↑ ↓ select · Enter save · Del delete · Esc back":
    "↑ ↓ wählen · Eingabe speichern · Entf löschen · Esc zurück",
  "↑ ↓ select · Enter start here · Del delete · Esc back":
    "↑ ↓ wählen · Eingabe hier starten · Entf löschen · Esc zurück",
  "just now": "gerade eben",
  "{n} min ago": "vor {n} Min.",
  "{n} h ago": "vor {n} Std.",
  yesterday: "gestern",
  "{n} days ago": "vor {n} Tagen",
  "Save slots": "Speicherplätze",
  corrupted: "beschädigt",
  empty: "leer",
  active: "aktiv",
  "New Game+ · run {n}": "Neues Spiel+ · Durchlauf {n}",
  completed: "abgeschlossen",
  Floor: "Ebene",
  Room: "Raum",
  Playtime: "Spielzeit",
  Devices: "Geräte",
  Paths: "Wege",
  Slices: "Splitter",
  Bots: "Bots",
  "— corrupted — save unreadable. Overwrite or delete it.":
    "— beschädigt — Spielstand nicht lesbar. Überschreiben oder löschen.",
  "— empty —": "— leer —",
  Export: "Exportieren",
  Import: "Importieren",
  Delete: "Löschen",
  "Overwrite save?": "Spielstand überschreiben?",
  "{slot} already contains a save ({label}). It will be lost for good.":
    "{slot} enthält bereits einen Spielstand ({label}). Er geht unwiderruflich verloren.",
  Overwrite: "Überschreiben",
  "Delete save?": "Spielstand löschen?",
  "{slot} will be deleted permanently. Export it first if you want to keep it.":
    "{slot} wird endgültig gelöscht. Exportiere ihn vorher, wenn du ihn behalten willst.",
  "This save": "Dieser Spielstand",
  "Imported: {label} ({time}) · {n} outdated entries cleaned up":
    "Importiert: {label} ({time}) · {n} veraltete Einträge bereinigt",
  "Imported: {label} ({time})": "Importiert: {label} ({time})",
  "Export save": "Spielstand exportieren",
  "Import save": "Spielstand importieren",
  "Copy the code and keep it somewhere safe.": "Kopiere den Code und bewahre ihn sicher auf.",
  "Warning: the existing save in this slot will be replaced.":
    "Achtung: Der vorhandene Spielstand in diesem Platz wird ersetzt.",
  "Paste an exported save code.": "Füge einen exportierten Speichercode ein.",
  "Save code": "Speichercode",
  Copy: "Kopieren",
  "Copied to clipboard.": "In die Zwischenablage kopiert.",
  "Paste save code here …": "Speichercode hier einfügen …",
  "Paste save code": "Speichercode einfügen",

  // ── Credits / loading ──
  "Personnel file · Credits": "Personalakte · Abspann",
  "UnstableLabs underground facility · dormant for 2,561 days":
    "UnstableLabs Untergrundanlage · Ruhezeit 2.561 Tage",
  "End of transmission": "Ende der Übertragung",
  ">> Fast-forward": "» Vorlauf",
  "Hold Space: fast-forward · ↑ back": "Leertaste halten: Vorlauf · ↑ zurück",
  Skip: "Überspringen",
  "Powering up the lab …": "Labor wird hochgefahren …",
  Tip: "Tipp",

  // ── Lore: boot log ──
  "_unOS BIOS · UnstableLabs underground facility": "_unOS BIOS · UnstableLabs Untergrundanlage",
  "COLD START PROTOCOL … initiated": "COLD START PROTOCOL … eingeleitet",
  "Dormancy: 2,561 days": "Ruhezeit: 2.561 Tage",
  "Residual charge: 0.3 %": "Restladung: 0,3 %",
  "Geothermal borehole … no response": "Geothermie-Bohrung … keine Rückmeldung",
  "MCP-000 … responding (reluctantly)": "MCP-000 … antwortet (widerwillig)",
  "Cryo pod J. Lawrence … opened": "Kryokapsel J. Lawrence … geöffnet",
  "Searching for D. Fridge … no signal": "Suche nach D. Fridge … kein Signal",
  "Halo layer … noise. Or not.": "Halo-Ebene … Rauschen. Oder nicht.",
  "Ready.": "Bereit.",

  // ── Lore: quotes ──
  "The first law of the lab: energy before understanding. What you cannot see, you cannot study. Lay the power first, then ask questions.":
    "Das erste Gesetz des Labors: Energie kommt vor Verständnis. Was du nicht sehen kannst, kannst du nicht untersuchen. Erst den Strom legen, dann Fragen stellen.",
  "J.L. — note on the power line panel": "J.L. — Zettel am Energieleitungspanel",
  "Compression has edges. Edges sing. Tune the scope right and you can hear the Halo breathe.":
    "Kompression hat Kanten. Kanten singen. Wenn du das Scope richtig stimmst, hörst du den Halo atmen.",
  "J.L. — engraved in the anomaly scope": "J.L. — eingraviert im Anomalie-Scope",
  "Jade insists the anomalies are structured. I insist it is noise. We are both afraid the other one is right.":
    "Jade besteht darauf, dass die Anomalien strukturiert sind. Ich bestehe darauf, dass es Rauschen ist. Wir haben beide Angst, dass der andere recht hat.",
  "D.F. — lab log #0041": "D.F. — Laborlog #0041",
  "Every device is a question in physical form. The caliper asks: how precise is your intent? The coolant asks: how patient is your hand?":
    "Jedes Gerät ist eine Frage in physischer Form. Der Messschieber fragt: Wie präzise ist deine Absicht? Das Kühlmittel fragt: Wie geduldig ist deine Hand?",
  "J.L. — workbench drawer": "J.L. — Werkbankschublade",
  "Built five prototypes today. Three exploded. One works. One became something I did not design. The last one worries me.":
    "Heute fünf Prototypen gebaut. Drei explodiert. Einer funktioniert. Einer wurde etwas, das ich nicht entworfen habe. Der letzte macht mir Sorgen.",
  "D.F. — lab log #0107": "D.F. — Laborlog #0107",
  "When the surface goes under, this lab keeps running.":
    "Wenn die Oberfläche untergeht, läuft dieses Labor weiter.",
  "Geothermal core specification": "Spezifikation Geothermie-Kern",
  "It is not missing. It is inverted.": "Es fehlt nicht. Es ist invertiert.",
  "Jade Lawrence — Cottbus, around 3:00 a.m.": "Jade Lawrence — Cottbus, gegen 3:00 Uhr",
  "The Halo responds to intent. Not to command — to intent.":
    "Der Halo reagiert auf Absicht. Nicht auf Befehl — auf Absicht.",
  "Note from the test subject": "Notiz der Versuchsperson",
  "You hear music when instruments play. Do you question the frequency, or do you listen?":
    "Du hörst Musik, wenn Instrumente spielen. Hinterfragst du die Frequenz, oder hörst du zu?",
  "C8-BR41N — remote station [EXTERNAL]": "C8-BR41N — Gegenstelle [EXTERNAL]",
  "The anomalies are not mere computational artefacts. They feel … orchestrated.":
    "Die Anomalien sind nicht bloß Rechenartefakte. Sie wirken … orchestriert.",
  "Lawrence & Fridge — final expedition report": "Lawrence & Fridge — letzter Expeditionsbericht",
  "We have to continue our work where no one can find us.":
    "Wir müssen unsere Arbeit dort fortsetzen, wo man uns nicht finden kann.",
  "Jade Lawrence — blockchain summit": "Jade Lawrence — Blockchain-Gipfel",
  "The story is not written. It is compiled — from signals that were never meant to be found.":
    "Die Geschichte ist nicht geschrieben. Sie wird kompiliert — aus Signalen, die nie gefunden werden sollten.",
  "UnstableLabs archive": "UnstableLabs-Archiv",
  "You now have enough energy to fail at more interesting things.":
    "Du hast jetzt genug Energie, um an interessanteren Dingen zu scheitern.",
  "MCP — status message": "MCP — Statusmeldung",
  "Reward curiosity, punish nothing.": "Neugier belohnen, nichts bestrafen.",
  "Lab principle": "Laborprinzip",

  // ── Lore: loading tips ──
  "Devices are built in three stages: frame → core → calibration. Each stage needs its own parts.":
    "Geräte entstehen in drei Stufen: Rahmen → Kern → Kalibrierung. Jede Stufe braucht eigene Teile.",
  "Blueprints ask for properties, not names. What counts is the energy or the signal — not what the part is called.":
    "Baupläne verlangen Eigenschaften, keine Namen. Zählt die Energie oder das Signal — nicht, wie das Teil heißt.",
  "Volatility above 12 goes bang. Unstable mixtures explode at the workbench and leave slag behind.":
    "Volatilität über 12 knallt. Instabile Mischungen explodieren an der Werkbank und hinterlassen Schlacke.",
  "Cooling fins and thermal parts calm a mixture down. Give them a slot before you throw in quantum.":
    "Kühlrippen und thermische Bauteile beruhigen eine Mischung. Gib ihnen einen Platz, bevor du Quantum dazuwirfst.",
  "Keep an eye on the power grid ({key:power}): devices without power are just expensive furniture.":
    "Behalte das Energienetz im Blick ({key:power}): Geräte ohne Strom sind nur teure Möbel.",
  "Switch off consumers you do not need right now — free watts open up new floors.":
    "Schalte Verbraucher ab, die du gerade nicht brauchst — freie Watt öffnen neue Ebenen.",
  "The journal ({key:journal}) collects insights and the “paths to Damien”. Four paths, four endings.":
    "Das Journal ({key:journal}) sammelt Erkenntnisse und die »Wege zu Damien«. Vier Wege, vier Enden.",
  "{key:rotateLeft} and {key:rotateRight} rotate the camera. Some details hide behind a wall.":
    "{key:rotateLeft} und {key:rotateRight} drehen die Kamera. Manches Detail versteckt sich hinter einer Wand.",
  "Mouse wheel or {key:zoomIn} / {key:zoomOut} zooms. Getting closer pays off with crates and notes.":
    "Mausrad oder {key:zoomIn} / {key:zoomOut} zoomt. Näher heran lohnt sich bei Kisten und Notizen.",
  "{key:interact} (or Space) interacts with whatever is highlighted.":
    "{key:interact} (oder Leertaste) interagiert mit dem, was gerade hervorgehoben ist.",
  "The workbench ({key:workbench}) combines freely: not every recipe is written down somewhere.":
    "Die Werkbank ({key:workbench}) kombiniert frei: Nicht jedes Rezept steht irgendwo geschrieben.",
  "Failed combinations are data. Slag can often still be salvaged.":
    "Fehlgeschlagene Kombinationen sind Daten. Schlacke lässt sich oft noch zerlegen.",
  "Smoky rooms hide their finds until the ventilation is running.":
    "Rauchige Räume verbergen Fundstücke, bis die Lüftung läuft.",
  "Dark rooms stay dark until the right device lights them up.":
    "Dunkle Räume bleiben dunkel, bis das richtige Gerät sie beleuchtet.",
  "Reading notes pays off: door codes are rarely written on the door.":
    "Notizen lesen lohnt sich: Türcodes stehen selten auf der Tür.",
  "The elevator only goes to floors with enough power and clearance.":
    "Der Aufzug fährt nur auf Ebenen, für die genug Energie und Freigabe da sind.",
  "{key:pause} opens the pause menu: save, load, settings.":
    "{key:pause} öffnet das Pausenmenü: speichern, laden, Einstellungen.",
  "{key:quicksave} quicksaves, {key:quickload} loads the last quicksave.":
    "{key:quicksave} speichert schnell, {key:quickload} lädt den letzten Schnellspeicher.",
  "Talk to the bots. F1N-DR finds things, R3-TR0 remembers things.":
    "Sprich mit den Bots. F1N-DR findet Dinge, R3-TR0 erinnert sich an Dinge.",
  "Salvage spots refill over time. The lab recycles.":
    "Fundstellen füllen sich mit der Zeit wieder auf. Das Labor recycelt.",
  "Tools open locked salvage spots — some crates need more than bare hands.":
    "Werkzeuge öffnen verschlossene Fundstellen — manche Kiste braucht mehr als bloße Hände.",
  "Minigames at terminals and locks: stay calm, read the pattern, do not guess.":
    "Minispiele an Terminals und Schlössern: Ruhe bewahren, Muster lesen, nicht raten.",
  "The main console in the control room leads to the big _unOS terminal.":
    "Die Hauptkonsole im Kontrollraum führt zum großen _unOS-Terminal.",
  "Almost every key can be rebound under Settings → Controls.":
    "Fast alle Tasten lassen sich unter Einstellungen → Steuerung neu belegen.",
  "Too much flicker? Settings → Accessibility → Reduce flicker.":
    "Zu viel Flackern? Einstellungen → Barrierefreiheit → Flackern reduzieren.",
  "Hints ({key:help}) give you a gentle nudge when you are stuck.":
    "Hinweise ({key:help}) geben einen sanften Schubs, wenn du feststeckst.",

  // ── Lore: credits ──
  Leadership: "Leitung",
  "Bot staff": "Bot-Belegschaft",
  "Quantum architecture": "Quantenarchitektur",
  "Why-before-how": "Warum-vor-Wie",
  "Supervision (reluctant)": "Aufsicht (widerwillig)",
  "Salvage & lost property": "Bergung & Fundsachen",
  "Archive & memory": "Archiv & Erinnerung",
  "Signal fires": "Signalfeuer",
  "Neural protocols": "Neuronale Protokolle",
  "847 reply packets to no one": "847 Antwortpakete an niemanden",
  "Logic & proof": "Logik & Beweisführung",
  "Dust, systematically": "Staub, systematisch",
  Thermals: "Thermik",
  Infrastructure: "Infrastruktur",
  "Geothermal core": "Geothermie-Kern",
  "847 kW continuous output": "847 kW Dauerleistung",
  "Kernel, shell, patience": "Kernel, Shell, Geduld",
  "Halo layer": "Halo-Ebene",
  "non-Euclidean contribution": "nicht-euklidische Mitwirkung",
  "Special thanks": "Besonderer Dank",
  "to every prototype that exploded": "an alle Prototypen, die explodiert sind",
  "to the one that became something else": "an den einen, der etwas anderes wurde",
  "and to you, for listening.": "und an dich, fürs Zuhören.",
  Tools: "Werkzeuge",
  "Built with": "Entwickelt mit",
  Engine: "Engine",
  "© UnstableLabs · The Unstable Lab": "© UnstableLabs · Das instabile Labor",
  "Founding & leadership": "Gründung & Leitung",
  "Quantum architecture · Cambridge → Cottbus": "Quantenarchitektur · Cambridge → Cottbus",
  "Topological game theory · why-before-how": "Topologische Spieltheorie · Warum-vor-Wie",
  "Master Control Program · supervision (reluctant)":
    "Master Control Program · Aufsicht (widerwillig)",
  "Remote station · not invited, here anyway": "Gegenstelle · nicht eingeladen, trotzdem da",
  "Collective · name subject to revocation": "Kollektiv · Name auf Widerruf",
  "West corridor · counts days, finds things": "Westflur · zählt Tage, findet Dinge",
  "Signal lab · 847 reply packets to no one": "Signallabor · 847 Antwortpakete an niemanden",
  "Library · logic & proof": "Bibliothek · Logik & Beweisführung",
  "Supply corridor · lost parcels": "Versorgungsgang · verlorene Pakete",
  "Bot depot · green phosphor only": "Bot-Depot · nur grüner Phosphor",
  "Bot depot · optimism, battery-powered": "Bot-Depot · Optimismus, batteriebetrieben",
  "Observatory · renders the sky": "Observatorium · rendert den Himmel",
  "Radio room · crawls the lab network": "Funkraum · crawlt das Labornetz",
  "Archive · index & catalogue": "Archiv · Index & Katalog",
  "Hideout E−4 · neural protocols": "Versteck E−4 · Neuronale Protokolle",
  "everywhere · dust, systematically": "überall · Staub, systematisch",
  Departments: "Abteilungen",
  "_unOS kernel": "_unOS-Kernel",
  "Processes · memory · scheduler · /unproc": "Prozesse · Speicher · Scheduler · /unproc",
  "Voxel workshop": "Voxel-Werkstatt",
  "Grid · greedy mesher with AO · DDA rays · collision":
    "Gitter · Greedy-Mesher mit AO · DDA-Strahlen · Kollision",
  "Device construction": "Gerätebau",
  "38 devices + MCP-000 · frame → core → calibration":
    "38 Geräte + MCP-000 · Rahmen → Kern → Kalibrierung",
  "Deterministic combinations · prototypes · slag":
    "deterministische Kombinationen · Prototypen · Schlacke",
  "Geothermal core · consumers · shutdown plans": "Geothermie-Kern · Verbraucher · Abschaltpläne",
  "Puzzle lab": "Rätsellabor",
  "26 minigames at terminals and locks": "26 Minispiele an Terminals und Schlössern",
  "Sound studio": "Tonstudio",
  "Procedural web audio · music · ambience · voices":
    "prozedurales Web-Audio · Musik · Atmosphäre · Stimmen",
  Lighting: "Beleuchtung",
  "Key light per room · 14 roaming point lights · CRT pass":
    "Schlüssellicht pro Raum · 14 wandernde Punktlichter · CRT-Pass",
  Direction: "Regie",
  "Camera moves · scenes · four endings and a crystal":
    "Kamerafahrten · Szenen · vier Enden und ein Kristall",
  Archiving: "Archivierung",
  "3 save slots · autosave · New Game+": "3 Speicherplätze · Autosave · Neues Spiel+",
  "Lab archive (sources)": "Laborarchiv (Quellen)",
  "Archive 01": "Archiv 01",
  "Game design · core loop & specifications": "Spieldesign · Kernschleife & Spezifikationen",
  "Archive 02": "Archiv 02",
  "Tech trees · properties": "Technologiebäume · Eigenschaften",
  "Archive 03": "Archiv 03",
  "Achievements · discovery & validation": "Erfolge · Entdeckung & Validierung",
  "Archive 04": "Archiv 04",
  "Economy · production & tokens": "Ökonomie · Produktion & Token",
  "Archive 05": "Archiv 05",
  "Interfaces · terminal & style": "Schnittstellen · Terminal & Stil",
  "Archive 07": "Archiv 07",
  "Infrastructure · _unOS & schemas": "Infrastruktur · _unOS & Schemata",
  "Archive 09": "Archiv 09",
  "Narrative · founding legend, Halo experiment, bot origins":
    "Erzählung · Gründerlegende, Halo-Experiment, Bot-Ursprünge",
  "Device dossiers": "Gerätedossiers",
  "DEVICE-ID · firmware specification": "DEVICE-ID · Firmware-Spezifikation",
  "With thanks to": "Mit Dank an",
  "Assessment: “technically flawless”": "Gutachten: »technisch makellos«",
  "Neurology · the question that started it all": "Neurologie · die Frage, mit der alles begann",
  "The surface": "Die Oberfläche",
  "for 2,561 days of peace": "für 2.561 Tage Ruhe",
  // ── Beta-save links (BetaSaveDialog) + slot backups ──
  "Load test save?": "Test-Spielstand laden?",
  "A link from the _unLABS Beta Lab wants to load a save state.":
    "Ein Link aus dem _unLABS Beta Lab möchte einen Spielstand laden.",
  "Checking save code …": "Spielstand-Code wird geprüft …",
  "{n} outdated entries will be cleaned up.": "{n} veraltete Einträge werden bereinigt.",
  "Load into which slot?": "In welchen Speicherplatz laden?",
  "{slot} is not empty. Its current save is kept as a backup: Load → {slot} → Restore backup.":
    "{slot} ist belegt. Der bisherige Spielstand bleibt als Backup erhalten: Laden → {slot} → Backup wiederherstellen.",
  "Import & load": "Importieren & laden",
  "Restore backup": "Backup wiederherstellen",
  "Restore backup?": "Backup wiederherstellen?",
  "{slot} gets its previous save back ({label}). The current save becomes the backup, so you can switch back.":
    "{slot} bekommt seinen vorherigen Spielstand zurück ({label}). Der aktuelle Spielstand wird zum Backup, du kannst also zurückwechseln.",
  Restore: "Wiederherstellen",
};
