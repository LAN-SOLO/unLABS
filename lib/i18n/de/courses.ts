/**
 * German translations — area "courses". Key = exact English source string from `tr("…")`.
 * Courses on Jade's computer (lib/world/content/courses.ts), study rules
 * (lib/world/courses.ts) and the perk effects in the rule files.
 */
export const DE_COURSES: Record<string, string> = {
  // Rules (courses.ts) and perk effects (game.ts, archive.ts)
  "Unknown course.": "Unbekannter Kurs.",
  "Finish the lessons first.": "Erst die Lektionen durcharbeiten.",
  "Not quite. Go over the lessons again.": "Nicht ganz. Geh die Lektionen noch einmal durch.",
  "Course completed — {title}": "Kurs abgeschlossen — {title}",
  "Second look: {gen} W generated, {demand} W drawn, margin {margin} W.":
    "Zweiter Blick: {gen} W erzeugt, {demand} W verbraucht, Reserve {margin} W.",
  "{message} You snatched 1× {name} off the bench in time.":
    "{message} Du hast 1× {name} gerade noch von der Werkbank gerissen.",
  "Nothing here — but something else in this room is worth a closer look.":
    "Hier ist nichts — aber etwas anderes in diesem Raum lohnt einen zweiten Blick.",

  // Power
  "Grid basics for the underground": "Netzgrundlagen für den Untergrund",
  "Why the lab browns out, and in which order it gives up.":
    "Warum dem Labor der Strom ausgeht und in welcher Reihenfolge es aufgibt.",
  "Generation minus demand is all that matters. Every consumer draws its full rated power while it runs.":
    "Erzeugung minus Verbrauch — nur das zählt. Jeder Verbraucher zieht im Betrieb seine volle Nennleistung.",
  "The grid serves the battery, the MCP, the power controller and the thermal manager first — everything else in a fixed order after them.":
    "Das Netz versorgt zuerst die Batterie, das MCP, die Stromverwaltung und den Thermomanager — alles andere danach in fester Reihenfolge.",
  "A consumer that does not fit is starved, not damaged. Switch something off and it comes back.":
    "Ein Verbraucher, der nicht mehr hineinpasst, bleibt ohne Strom, wird aber nicht beschädigt. Schalte etwas ab, und er kommt zurück.",
  "What happens to a device when the grid runs short?":
    "Was passiert mit einem Gerät, wenn das Netz knapp wird?",
  "It breaks": "Es geht kaputt",
  "It is starved until power is free": "Es bleibt ohne Strom, bis wieder etwas frei ist",
  "It explodes": "Es explodiert",
  "Which of these is served first?": "Welches davon wird zuerst versorgt?",
  "The 3D Fabricator": "Der 3D-Fabrikator",
  "The Explorer Drone": "Die Erkundungsdrohne",
  "The Battery Pack": "Der Akkupack",
  "Where the watts come from": "Woher die Watt kommen",
  "Core, battery, geothermal, fusion — and a display that pays for itself.":
    "Kern, Batterie, Erdwärme, Fusion — und eine Anzeige, die sich selbst bezahlt.",
  "The Unstable Energy Core delivers about 150 W. About, because its output wanders a little from day to day.":
    "Der instabile Energiekern liefert etwa 150 W. Etwa, weil seine Leistung von Tag zu Tag ein wenig schwankt.",
  "The Battery Pack draws nothing and adds a 40 W buffer the moment it is online — enough to keep the MCP alive on its own.":
    "Der Akkupack verbraucht nichts und bringt 40 W Puffer, sobald er online ist — genug, um das MCP allein am Leben zu halten.",
  "The geothermal tap gives 50 W once routed, and another 100 W at full load while the Power Management System is online.":
    "Der Erdwärme-Anschluss liefert 50 W, sobald er angeschlossen ist, und weitere 100 W unter Volllast, solange die Stromverwaltung online ist.",
  "The Power Display Panel adds 20 W of reactive power compensation; the Volt Meter fills in the core's daily dip.":
    "Die Stromanzeige bringt 20 W Blindleistungskompensation; das Voltmeter gleicht die tägliche Delle des Kerns aus.",
  "The Microfusion Reactor is the big one: 250 W, more with its fuel-autotune update.":
    "Der Mikrofusionsreaktor ist der Große: 250 W, mit seinem Update fuel-autotune mehr.",
  "How much buffer does the Battery Pack add?": "Wie viel Puffer bringt der Akkupack?",
  "10 W": "10 W",
  "40 W": "40 W",
  "150 W": "150 W",
  "What does the Volt Meter Display do for the grid?": "Was tut das Voltmeter für das Netz?",
  "It fills in the core's daily dip": "Es gleicht die tägliche Delle des Kerns aus",
  "It doubles the battery": "Es verdoppelt die Batterie",
  "Nothing, it only shows numbers": "Nichts, es zeigt nur Zahlen",
  "Priority circuits and cooling": "Vorrangkreise und Kühlung",
  "Telling the grid who matters — and keeping the heavy machines cool.":
    "Dem Netz sagen, wer wichtig ist — und die schweren Maschinen kühl halten.",
  "Devices linked to the Power Management System are served right after the grid's head, before everyone else.":
    "Geräte, die mit der Stromverwaltung verbunden sind, werden direkt nach der Spitze des Netzes versorgt — vor allen anderen.",
  "The PWR-001 hub takes six links; its fusion-sequencer update adds two more circuits.":
    "Der Hub PWR-001 nimmt sechs Verbindungen; sein Update fusion-sequencer bringt zwei weitere Kreise.",
  "Heavy tier-3 machines overheat without a running Thermal Manager. They do not break — they simply stay off.":
    "Schwere Tier-3-Maschinen überhitzen ohne laufenden Thermomanager. Sie gehen nicht kaputt — sie bleiben einfach aus.",
  "Machines linked to the Thermal Manager draw 10 % less; with its loop-balancer update, 20 % less.":
    "Maschinen am Thermomanager verbrauchen 10 % weniger; mit seinem Update loop-balancer 20 % weniger.",
  "What do heavy tier-3 machines need to run?": "Was brauchen schwere Tier-3-Maschinen zum Laufen?",
  "A running Thermal Manager": "Einen laufenden Thermomanager",
  "A full battery": "Eine volle Batterie",
  "A keypad code": "Einen Tastenfeld-Code",
  "How much less does a machine draw on the thermal loop (factory firmware)?":
    "Wie viel weniger verbraucht eine Maschine im Kühlkreis (Werksfirmware)?",
  "5 %": "5 %",
  "10 %": "10 %",
  "50 %": "50 %",

  // Building & fabrication
  "Frame, core, calibration": "Rahmen, Kern, Kalibrierung",
  "The three stages every device goes through.": "Die drei Stufen, die jedes Gerät durchläuft.",
  "Every device is built in three stages: frame, core, calibration. Each stage asks for parts with certain traits, not certain names.":
    "Jedes Gerät wird in drei Stufen gebaut: Rahmen, Kern, Kalibrierung. Jede Stufe verlangt Teile mit bestimmten Eigenschaften, nicht mit bestimmten Namen.",
  "Any part whose traits meet a requirement fits — a prototype of your own counts as much as a factory part.":
    "Jedes Teil, dessen Eigenschaften eine Anforderung erfüllen, passt — ein eigener Prototyp zählt so viel wie ein Werksteil.",
  "Blueprints are discovered, not bought: through insights, finished neighbours or a prototype that happens to resemble one.":
    "Baupläne werden entdeckt, nicht gekauft: durch Erkenntnisse, fertige Nachbargeräte oder einen Prototyp, der zufällig einem ähnelt.",
  "What does a build stage really ask for?": "Was verlangt eine Baustufe wirklich?",
  "A part with the right name": "Ein Teil mit dem richtigen Namen",
  "Parts with enough traits": "Teile mit genug Eigenschaften",
  Money: "Geld",
  "Which stage comes last?": "Welche Stufe kommt zuletzt?",
  "Salvage and scrap": "Bergen und Schrott",
  "Scrap piles, tools, and what grows back.": "Schrotthaufen, Werkzeug und was nachwächst.",
  "By hand a pile gives only its first stack. With the right tool online the rest comes out too.":
    "Von Hand gibt ein Haufen nur seinen ersten Stapel her. Mit dem richtigen Werkzeug online kommt auch der Rest heraus.",
  "Some piles refill over time. The Lab Clock's event scheduler brings refills sooner; the geothermal seep runs twice as fast with the Abstractum Tank.":
    "Manche Haufen füllen sich mit der Zeit wieder. Der Ereignisplaner der Laboruhr bringt das früher; die Erdwärme-Quelle läuft mit dem Abstractum-Tank doppelt so schnell.",
  "The Basic Toolkit takes things apart again — one part is usually lost, unless its torque profiles save a two-part assembly.":
    "Das Basis-Werkzeugset nimmt Dinge wieder auseinander — meist geht ein Teil verloren, außer seine Drehmomentprofile retten eine zweiteilige Baugruppe.",
  "What do you get from a pile by hand when it needs a tool?":
    "Was bekommst du von Hand aus einem Haufen, der Werkzeug braucht?",
  "Only its first stack": "Nur seinen ersten Stapel",
  "answer::Nothing": "Nichts",
  "Everything, but slower": "Alles, nur langsamer",
  "What usually happens when you take something apart?":
    "Was passiert meistens, wenn du etwas zerlegst?",
  "One part is lost": "Ein Teil geht verloren",
  "You get a bonus part": "Du bekommst ein Bonusteil",
  "perk::Scrap sense": "Schrottnase",
  "Every fourth pile you clear gives one part more.":
    "Jeder vierte Haufen, den du leerst, gibt ein Teil mehr.",
  "Printing parts": "Teile drucken",
  "The 3D Fabricator, filament and patterns.": "Der 3D-Fabrikator, Filament und Druckmuster.",
  "The 3D Fabricator prints any component you have held before — the pattern is remembered, not the part.":
    "Der 3D-Fabrikator druckt jedes Bauteil, das du schon einmal hattest — gemerkt wird das Muster, nicht das Teil.",
  "Every print needs one Base Alloy as filament.":
    "Jeder Druck braucht eine Basislegierung als Filament.",
  "With the purge-saver update every third print needs no filament at all.":
    "Mit dem Update purge-saver braucht jeder dritte Druck gar kein Filament.",
  "One-of-a-kind relics (the screwdriver, Crystal #0089, the anomalous core …) can be neither printed nor taken apart nor combined.":
    "Einzigartige Relikte (der Schraubendreher, Kristall #0089, der anomale Kern …) lassen sich weder drucken noch zerlegen noch kombinieren.",
  "What does one print cost?": "Was kostet ein Druck?",
  "1× Base Alloy": "1× Basislegierung",
  "50 W for an hour": "50 W für eine Stunde",
  "A prototype": "Einen Prototyp",
  "Which parts can be printed?": "Welche Teile lassen sich drucken?",
  "Anything, even relics": "Alles, sogar Relikte",
  "Components you have held before": "Bauteile, die du schon einmal hattest",
  "Only prototypes": "Nur Prototypen",

  // Combining
  "Workbench fundamentals": "Werkbank-Grundlagen",
  "Recipes, prototypes and why the same mix always gives the same thing.":
    "Rezepte, Prototypen und warum dieselbe Mischung immer dasselbe ergibt.",
  "Any two or more parts combine into something. A known recipe gives its product; anything else becomes a prototype.":
    "Zwei oder mehr Teile ergeben immer etwas. Ein bekanntes Rezept liefert sein Produkt; alles andere wird ein Prototyp.",
  "A plain workbench has three slots; with the Portable Workbench online you get six.":
    "Eine einfache Werkbank hat drei Plätze; mit der tragbaren Werkbank online sind es sechs.",
  "A prototype sums its inputs' traits with 20 % loss, adds synergies, then one emergent bonus seeded by the exact mix.":
    "Ein Prototyp summiert die Eigenschaften seiner Zutaten mit 20 % Verlust, addiert Synergien und dann einen emergenten Bonus, der von der genauen Mischung abhängt.",
  "The rules are deterministic: the same inputs always give the same result. Write good mixes down.":
    "Die Regeln sind deterministisch: dieselben Zutaten ergeben immer dasselbe. Schreib gute Mischungen auf.",
  "How many slots does the Portable Workbench give?":
    "Wie viele Plätze bietet die tragbare Werkbank?",
  Three: "Drei",
  Four: "Vier",
  Six: "Sechs",
  "Combining the same parts again gives …": "Dieselben Teile noch einmal kombiniert ergeben …",
  "Something random": "Etwas Zufälliges",
  "The same result": "Dasselbe Ergebnis",
  "Always slag": "Immer Schlacke",
  "How much of the inputs' traits is lost in a prototype?":
    "Wie viel der Eigenschaften geht in einem Prototyp verloren?",
  "20 %": "20 %",
  None: "Nichts",
  "Volatility, or: why the bench has scorch marks":
    "Volatilität, oder: warum die Werkbank Brandflecken hat",
  "Counting before combining. Mostly.": "Erst zählen, dann kombinieren. Meistens.",
  "Build your first prototype at a workbench.": "Bau deinen ersten Prototyp an einer Werkbank.",
  "Every part has a volatility. Add them up (times their count): above 12 the mix explodes into slag.":
    "Jedes Teil hat eine Volatilität. Zähl sie zusammen (mal ihrer Anzahl): über 12 explodiert die Mischung zu Schlacke.",
  "The first time a particular mix blows up, it may leave a small side product. The same explosion again leaves only slag.":
    "Wenn eine bestimmte Mischung zum ersten Mal explodiert, bleibt manchmal ein kleines Nebenprodukt. Dieselbe Explosion noch einmal hinterlässt nur Schlacke.",
  "A prototype's own volatility follows its wildest input; two hot inputs add one, a lot of heat (thermal 6+) takes one away.":
    "Die Volatilität eines Prototyps folgt seiner wildesten Zutat; zwei heiße Zutaten legen eins drauf, viel Wärme (Thermik 6+) nimmt eins weg.",
  "The Exotic Matter Containment's breach-guard catches one input part when a mix explodes.":
    "Der breach-guard der Exotische-Materie-Eindämmung fängt ein Teil auf, wenn eine Mischung explodiert.",
  "Above which summed volatility does a mix explode?":
    "Ab welcher summierten Volatilität explodiert eine Mischung?",
  "6": "6",
  "12": "12",
  "20": "20",
  "What calms a prototype's volatility?": "Was beruhigt die Volatilität eines Prototyps?",
  "Thermal 6 or more": "Thermik 6 oder mehr",
  "More inputs": "Mehr Zutaten",
  "Combining at night": "Nachts kombinieren",
  "perk::Catch reflex": "Fangreflex",
  "When a mix explodes and no containment field catches anything, you save one part.":
    "Wenn eine Mischung explodiert und kein Eindämmungsfeld etwas auffängt, rettest du ein Teil.",
  "Synergies and archetypes": "Synergien und Archetypen",
  "When two traits make a third, and when a prototype gets a name.":
    "Wenn zwei Eigenschaften eine dritte ergeben und ein Prototyp einen Namen bekommt.",
  "Build three prototypes first.": "Bau zuerst drei Prototypen.",
  "When two axes are both at 2 or more, a synergy adds a third: energy + signal gives data (modulation), optics + resonance gives quantum.":
    "Liegen zwei Achsen beide bei 2 oder mehr, fügt eine Synergie eine dritte hinzu: Energie + Signal ergibt Daten (Modulation), Optik + Resonanz ergibt Quanten.",
  "Thermal + mechanics gives energy, quantum + data gives signal, energy + quantum gives heat.":
    "Thermik + Mechanik ergibt Energie, Quanten + Daten ergibt Signal, Energie + Quanten ergibt Wärme.",
  "A prototype whose finished profile meets an archetype's rule gets its name, colour and property — its traits stay the same.":
    "Ein Prototyp, dessen fertiges Profil die Regel eines Archetyps erfüllt, bekommt dessen Namen, Farbe und Eigenschaft — seine Werte bleiben gleich.",
  "Example: quantum 6 and resonance 6 make a Halo Tuning Fork, which is not used up when tuning puzzles or opening hidden doors.":
    "Beispiel: Quanten 6 und Resonanz 6 ergeben eine Halo-Stimmgabel, die sich beim Stimmen von Rätseln oder Öffnen verborgener Türen nicht verbraucht.",
  "What does energy + signal give?": "Was ergibt Energie + Signal?",
  Data: "Daten",
  "What does an archetype change?": "Was ändert ein Archetyp?",
  "Name, colour and property — not the traits": "Name, Farbe und Eigenschaft — nicht die Werte",
  "Only the traits": "Nur die Werte",
  "Nothing at all": "Gar nichts",

  // Signals
  "Reading the needles": "Zeiger lesen",
  "Every device has something to say. Listen properly.":
    "Jedes Gerät hat etwas zu sagen. Hör richtig hin.",
  "Using an online device gives its live readout: monitors, clock, compass, power — each speaks for itself.":
    "Ein Gerät online zu benutzen, liefert seine Live-Messwerte: Monitore, Uhr, Kompass, Strom — jedes spricht für sich.",
  "The last readout of every device is kept in your knowledge panel. Useful numbers, filed automatically.":
    "Die letzten Messwerte jedes Geräts landen in deinem Wissenspanel. Nützliche Zahlen, automatisch abgelegt.",
  "Some devices react to what you already know: operating them with the right insight can reveal the next one.":
    "Manche Geräte reagieren auf das, was du schon weißt: Mit der richtigen Erkenntnis bedient, verraten sie die nächste.",
  "When does a device give a readout?": "Wann liefert ein Gerät Messwerte?",
  "When it is online and used": "Wenn es online ist und benutzt wird",
  "Only after a firmware update": "Nur nach einem Firmware-Update",
  Never: "Nie",
  "Where is the last readout kept?": "Wo werden die letzten Messwerte aufbewahrt?",
  Nowhere: "Nirgends",
  "In the knowledge panel": "Im Wissenspanel",
  "On a cork board": "An einer Pinnwand",
  "perk::Second look": "Zweiter Blick",
  "Every device readout gets one more line: the grid margin.":
    "Jede Geräteanzeige bekommt eine Zeile mehr: die Netzreserve.",
  "Tones, whispers and handshakes": "Töne, Flüstern und Handshakes",
  "Acoustics for people who work underground.": "Akustik für Leute, die unter der Erde arbeiten.",
  "The whisper in the Echo Recorder's noise is too quiet without the Narrow Speaker. Build SPK-001 first.":
    "Das Flüstern im Rauschen des Echo-Rekorders ist ohne den Schmalband-Lautsprecher zu leise. Bau zuerst SPK-001.",
  "The Handmade Synthesizer can play the four-tone handshake — once you know the four tones and a speaker can answer.":
    "Der handgebaute Synthesizer kann den Vier-Ton-Handshake spielen — sobald du die vier Töne kennst und ein Lautsprecher antworten kann.",
  "Which four tones? Damien's log #0512 knows. So does F1N-DR.":
    "Welche vier Töne? Damiens Log #0512 weiß es. F1N-DR auch.",
  "The Oscilloscope Array's trend dial and the Interpolator's prism are puzzles of patience, not of luck.":
    "Das Trendrad des Oszilloskop-Arrays und das Prisma des Interpolators sind Geduldsrätsel, keine Glücksspiele.",
  "What does the whisper in the noise need?": "Was braucht das Flüstern im Rauschen?",
  "The Narrow Speaker": "Den Schmalband-Lautsprecher",
  "More volume on the core": "Mehr Lautstärke am Kern",
  "A quiet night": "Eine ruhige Nacht",
  "Who knows the four tones?": "Wer kennt die vier Töne?",
  "B4-C0N": "B4-C0N",
  "Damien's log #0512 and F1N-DR": "Damiens Log #0512 und F1N-DR",
  Nobody: "Niemand",

  // Anomalies
  "Field notes on anomalies": "Feldnotizen zu Anomalien",
  "They are not faults. They are neighbours.": "Sie sind keine Fehler. Sie sind Nachbarn.",
  "The Anomaly Detector draws 15 W. It listens for what the lab should not contain.":
    "Der Anomalie-Detektor verbraucht 15 W. Er lauscht nach dem, was es im Labor nicht geben sollte.",
  "Once the Nexus has researched Anomaly Synthesis, 2× Halo Crystal Shard + 2× Energy Cell make an Anomalous Core — with the detector online.":
    "Sobald der Nexus die Anomalie-Synthese erforscht hat, ergeben 2× Halo-Kristallsplitter + 2× Energiezelle einen anomalen Kern — mit dem Detektor online.",
  "The Dimension Monitor's rift has no colours until you have heard who is speaking in it.":
    "Der Riss im Dimensionsmonitor hat keine Farben, bis du gehört hast, wer darin spricht.",
  "An Anomalous Core is one of a kind: it never goes on the workbench.":
    "Ein anomaler Kern ist einzigartig: Er kommt nie auf die Werkbank.",
  "What does the Anomalous Core recipe need online?":
    "Was muss für das Rezept des anomalen Kerns online sein?",
  "The Anomaly Detector": "Der Anomalie-Detektor",
  "The Lab Clock": "Die Laboruhr",
  "Can an Anomalous Core be combined?": "Lässt sich ein anomaler Kern kombinieren?",
  "Yes, like any part": "Ja, wie jedes Teil",
  "No, it is one of a kind": "Nein, er ist einzigartig",
  "The thin membrane": "Die dünne Membran",
  "Damien's theory, as far as anyone can follow it.":
    "Damiens Theorie, soweit man ihr folgen kann.",
  "Damien's notes treat the anomaly as something that listens — it reacts to what is played near it.":
    "Damiens Notizen behandeln die Anomalie wie etwas, das zuhört — sie reagiert auf das, was in ihrer Nähe gespielt wird.",
  "Tamed is not the same as understood. The core that remains still listens; it simply stopped fighting.":
    "Gezähmt heißt nicht verstanden. Der Kern, der bleibt, hört immer noch zu; er hat nur aufgehört, sich zu wehren.",
  "Where the membrane is thin, doors can open from the inside. Watch for walls that sound hollow.":
    "Wo die Membran dünn ist, können sich Türen von innen öffnen. Achte auf Wände, die hohl klingen.",
  "What does a tamed anomaly still do?": "Was tut eine gezähmte Anomalie noch?",
  Listen: "Zuhören",
  Explode: "Explodieren",
  "Where can doors open from the inside?": "Wo können sich Türen von innen öffnen?",
  "Where the membrane is thin": "Wo die Membran dünn ist",
  "Only in the kitchen": "Nur in der Küche",

  // Quantum physics
  "Quantum hardware for the hopeful": "Quanten-Hardware für Hoffnungsvolle",
  "Containment, state monitors and the teleport pad's electricity bill.":
    "Eindämmung, Zustandsmonitore und die Stromrechnung des Teleporters.",
  "The Exotic Matter Containment draws 40 W and needs a running Thermal Manager — like every heavy tier-3 machine.":
    "Die Exotische-Materie-Eindämmung verbraucht 40 W und braucht einen laufenden Thermomanager — wie jede schwere Tier-3-Maschine.",
  "The Quantum State Monitor draws 22 W; its lab update brings that down to 15 W.":
    "Der Quantenzustandsmonitor verbraucht 22 W; sein Labor-Update senkt das auf 15 W.",
  "The Teleport Pad is the hungriest machine in the lab: 100 W, or 60 W with its update.":
    "Das Teleporter-Pad ist die hungrigste Maschine im Labor: 100 W, mit Update 60 W.",
  "Quantum rarely comes from a single part: optics + resonance and signal + resonance both give quantum as a synergy.":
    "Quanten kommen selten aus einem einzigen Teil: Optik + Resonanz und Signal + Resonanz ergeben beide Quanten als Synergie.",
  "What do tier-3 machines like the containment need?":
    "Was brauchen Tier-3-Maschinen wie die Eindämmung?",
  "A keypad": "Ein Tastenfeld",
  "Which synergy gives quantum?": "Welche Synergie ergibt Quanten?",
  "Thermal + mechanics": "Thermik + Mechanik",
  "Optics + resonance": "Optik + Resonanz",
  "Energy + optics": "Energie + Optik",
  "The Halo is a state": "Der Halo ist ein Zustand",
  "Not a thing, not a place. Bring coffee.": "Kein Ding, kein Ort. Bring Kaffee mit.",
  "The margin notes H, A, L and O were never a signature. Together they are a key — and the Halo is what it opens: a state, not an object.":
    "Die Randnotizen H, A, L und O waren nie eine Unterschrift. Zusammen sind sie ein Schlüssel — und der Halo ist, was er öffnet: ein Zustand, kein Gegenstand.",
  "Crystal #0089 was broken into thirty slices and scattered through the lab. Each slice is a facet of the same record.":
    "Kristall #0089 wurde in dreißig Scheiben zerbrochen und im Labor verstreut. Jede Scheibe ist eine Facette derselben Aufzeichnung.",
  "A state can be measured, disturbed and prepared again. Damien's notes circle this idea for pages.":
    "Ein Zustand lässt sich messen, stören und wieder präparieren. Damiens Notizen kreisen seitenlang um diese Idee.",
  "Into how many slices was Crystal #0089 broken?":
    "In wie viele Scheiben wurde Kristall #0089 zerbrochen?",
  Thirty: "Dreißig",
  "What is the Halo, according to the notes?": "Was ist der Halo laut den Notizen?",
  "A state": "Ein Zustand",
  "A building": "Ein Gebäude",
  "A bot": "Ein Bot",

  // Systems & networks
  "Firmware without tears": "Firmware ohne Tränen",
  "Check, download, verify, flash, reboot.": "Prüfen, laden, verifizieren, flashen, neu starten.",
  "An update always runs the same way: check, download, verify, flash, reboot. Skip nothing.":
    "Ein Update läuft immer gleich: prüfen, laden, verifizieren, flashen, neu starten. Nichts überspringen.",
  "Preconditions: the installed version is at least the update's minimum, the checksum matches, the device is online and not busy.":
    "Voraussetzungen: Die installierte Version erreicht das Minimum des Updates, die Prüfsumme stimmt, das Gerät ist online und nicht beschäftigt.",
  "A rollback restores the factory image. Nothing is lost except the update's feature.":
    "Ein Rollback stellt das Werksabbild wieder her. Verloren geht nur die Funktion des Updates.",
  "Every lab update adds one feature: a faster drone, a bigger battery buffer, a cheaper printer, a quicker research cycle …":
    "Jedes Labor-Update bringt eine Funktion: eine schnellere Drohne, einen größeren Batteriepuffer, einen sparsameren Drucker, einen kürzeren Forschungszyklus …",
  "Which step comes right before flashing?": "Welcher Schritt kommt direkt vor dem Flashen?",
  Download: "Laden",
  Verify: "Verifizieren",
  Reboot: "Neustart",
  "What does a rollback restore?": "Was stellt ein Rollback wieder her?",
  "The factory image": "Das Werksabbild",
  "Yesterday's save": "Den Spielstand von gestern",
  "The power grid": "Das Stromnetz",
  "Hubs and links": "Hubs und Verbindungen",
  "Six buses, one cable salad.": "Sechs Busse, ein Kabelsalat.",
  "Six hubs, six buses: MCP (admin, 8 links), Network Monitor (data, 10), Power Management (power, 6), Thermal Manager (thermal, 6), Diagnostics (diag, 6), Supercomputer (compute, 4).":
    "Sechs Hubs, sechs Busse: MCP (Admin, 8 Verbindungen), Netzwerkmonitor (Daten, 10), Stromverwaltung (Strom, 6), Thermomanager (Thermik, 6), Diagnose (Diag, 6), Supercomputer (Rechnen, 4).",
  "The Network Monitor can mirror firmware images to linked devices once its fw-mirror feature is installed.":
    "Der Netzwerkmonitor kann Firmware-Abbilder an verbundene Geräte spiegeln, sobald seine Funktion fw-mirror installiert ist.",
  "Every online machine linked to the Supercomputer Array adds one research point per Nexus cycle.":
    "Jede laufende Maschine am Supercomputer-Array bringt einen Forschungspunkt pro Nexus-Zyklus.",
  "Which hub takes the most links?": "Welcher Hub nimmt die meisten Verbindungen?",
  "The MCP": "Das MCP",
  "The Network Monitor": "Der Netzwerkmonitor",
  "The Supercomputer Array": "Das Supercomputer-Array",
  "What does a machine on the compute mesh add?": "Was bringt eine Maschine im Rechenverbund?",
  "One research point per cycle": "Einen Forschungspunkt pro Zyklus",
  "A new blueprint": "Einen neuen Bauplan",
  "Research on the Nexus": "Forschung am Nexus",
  "Points, cycles and processes nobody knew yet.":
    "Punkte, Zyklen und Verfahren, die noch niemand kannte.",
  "Each Nexus cycle gives 5 research points; the next cycle is ready after 90 seconds.":
    "Jeder Nexus-Zyklus bringt 5 Forschungspunkte; der nächste ist nach 90 Sekunden bereit.",
  "Topics unlock at 5, 10 and 20 points: Slag Recovery, Synapsis Reconstruction, Anomaly Synthesis.":
    "Themen werden bei 5, 10 und 20 Punkten frei: Schlacke-Rückgewinnung, Synapsis-Rekonstruktion, Anomalie-Synthese.",
  "Research-gated recipes do nothing until their topic is done. The workbench tells you which one is missing.":
    "Forschungsgebundene Rezepte tun nichts, bis ihr Thema erforscht ist. Die Werkbank sagt dir, welches fehlt.",
  "The Nexus' prereq-chain update adds 2 points per cycle; an updated AI core shortens the cycle to 60 seconds.":
    "Das Nexus-Update prereq-chain bringt 2 Punkte pro Zyklus; ein aktualisierter KI-Kern verkürzt den Zyklus auf 60 Sekunden.",
  "How many points does one Nexus cycle give (factory)?":
    "Wie viele Punkte bringt ein Nexus-Zyklus (Werkszustand)?",
  "1": "1",
  "5": "5",
  "Which topic comes first?": "Welches Thema kommt zuerst?",
  "perk::Research notes": "Forschungsnotizen",
  "Your notes save the Nexus some work: +1 research point per cycle.":
    "Deine Notizen ersparen dem Nexus Arbeit: +1 Forschungspunkt pro Zyklus.",

  // People & bots
  "How to study": "Wie man lernt",
  "Damien's method, Jade's corrections.": "Damiens Methode, Jades Korrekturen.",
  "Write things down. Whatever you remember lands in your head; file it on your computer or pin it to a board when it gets crowded.":
    "Schreib Dinge auf. Was du dir merkst, landet in deinem Kopf; leg es auf dem Computer ab oder pinn es an ein Brett, wenn es voll wird.",
  "Damien asked why before how. Jade asks how, then checks why. Both methods pass the quiz.":
    "Damien fragte »warum« vor »wie«. Jade fragt »wie« und prüft dann »warum«. Beide Methoden bestehen die Prüfung.",
  "Short sessions work. The lessons wait for you; the lab does not.":
    "Kurze Einheiten funktionieren. Die Lektionen warten auf dich; das Labor nicht.",
  "Where can a memo be filed?": "Wo kann eine Notiz abgelegt werden?",
  "In your head, on your computer or on a board": "Im Kopf, auf dem Computer oder an einem Brett",
  "Only in the terminal": "Nur im Terminal",
  "Nowhere, memos are lost": "Nirgends, Notizen gehen verloren",
  "What did Damien ask first?": "Was fragte Damien zuerst?",
  How: "Wie",
  Why: "Warum",
  "When is lunch": "Wann es Mittagessen gibt",
  "perk::Speed reading": "Schnelllesen",
  "You study 25 % faster.": "Du lernst 25 % schneller.",
  "Waking the bots": "Bots wecken",
  "Every bot needs something. Usually not a hug.":
    "Jeder Bot braucht etwas. Meistens keine Umarmung.",
  "Learn why the bots went dark.": "Finde heraus, warum die Bots abgeschaltet wurden.",
  "A sleeping bot wakes with its missing part — or with a prototype whose traits match its profile.":
    "Ein schlafender Bot erwacht mit seinem fehlenden Teil — oder mit einem Prototyp, dessen Werte zu seinem Profil passen.",
  "X0-R8T wants signal 6 (an antenna). B4-C0N wants energy 7 (a battery cell). D3-C4D3 wants optics 6 (a lens).":
    "X0-R8T will Signal 6 (eine Antenne). B4-C0N will Energie 7 (eine Batteriezelle). D3-C4D3 will Optik 6 (eine Linse).",
  "L0G-1K wants data 7 and signal 2 (a control module); K2-LDR wants data 9 (two memory chips).":
    "L0G-1K will Daten 7 und Signal 2 (ein Steuermodul); K2-LDR will Daten 9 (zwei Speicherchips).",
  "Talk to them afterwards. Awake bots know things nobody wrote down.":
    "Rede danach mit ihnen. Wache Bots wissen Dinge, die niemand aufgeschrieben hat.",
  "What else wakes a bot besides its missing part?":
    "Was weckt einen Bot außer seinem fehlenden Teil?",
  "A prototype matching its profile": "Ein Prototyp, der zu seinem Profil passt",
  "Switching the lights off": "Das Licht ausschalten",
  "What does B4-C0N need?": "Was braucht B4-C0N?",
  "Optics 6": "Optik 6",
  "Energy 7": "Energie 7",
  "Data 9": "Daten 9",

  // Exploration
  "Archive method": "Archivmethode",
  "Reading, searching, and combining what you found.":
    "Lesen, durchsuchen und kombinieren, was du gefunden hast.",
  "Boards, posters, screens and notes are read. Lockers, vents, drawers and shelves can be searched — every one of them, empty or not.":
    "Tafeln, Poster, Bildschirme und Notizen werden gelesen. Spinde, Lüftungsgitter, Schubladen und Regale lassen sich durchsuchen — jedes davon, leer oder nicht.",
  "Finds come in five tiers: open, tucked away, hidden, well hidden, buried. The deeper, the more they count.":
    "Funde gibt es in fünf Stufen: offen, verstaut, versteckt, gut versteckt, vergraben. Je tiefer, desto mehr zählen sie.",
  "Some records only make sense together. When you have their parts, enter the answer at the archive console.":
    "Manche Aufzeichnungen ergeben nur zusammen Sinn. Wenn du ihre Teile hast, gib die Antwort an der Archivkonsole ein.",
  "An empty locker is information too. Note where you have already looked.":
    "Ein leerer Spind ist auch eine Information. Notier dir, wo du schon nachgesehen hast.",
  "How many archive tiers are there?": "Wie viele Archivstufen gibt es?",
  Five: "Fünf",
  Ten: "Zehn",
  "Where are combined records entered?": "Wo werden kombinierte Aufzeichnungen eingegeben?",
  "At the workbench": "An der Werkbank",
  "At the archive console": "An der Archivkonsole",
  "perk::Search sense": "Spürsinn",
  "An empty search tells you when another spot in the same room still hides something.":
    "Eine leere Durchsuchung verrät dir, wenn eine andere Stelle im selben Raum noch etwas verbirgt.",
  "Drone flight": "Drohnenflug",
  "Sending something small where you would rather not go.":
    "Etwas Kleines dorthin schicken, wo man selbst lieber nicht hingeht.",
  "The Explorer Drone draws 40 W and flies into the shaft. It needs 150 seconds to recharge between flights.":
    "Die Erkundungsdrohne verbraucht 40 W und fliegt in den Schacht. Zwischen zwei Flügen braucht sie 150 Sekunden zum Laden.",
  "The first flight maps the sealed shaft — after it, the emergency elevator goes down to Level −4.":
    "Der erste Flug kartiert den versiegelten Schacht — danach fährt der Notaufzug bis Ebene −4.",
  "Every flight brings back parts; its fast-return update shortens the recharge to 125 s.":
    "Jeder Flug bringt Teile mit; ihr Update fast-return verkürzt das Laden auf 125 s.",
  "What does the first drone flight unlock?": "Was schaltet der erste Drohnenflug frei?",
  "The elevator to Level −4": "Den Aufzug zu Ebene −4",
  "A new bot": "Einen neuen Bot",
  "How long does the drone recharge (factory)?": "Wie lange lädt die Drohne (Werkszustand)?",
  "30 s": "30 s",
  "150 s": "150 s",
  "One day": "Einen Tag",
  "perk::Planned routes": "Geplante Routen",
  "Pre-planned routes: the drone recharges 15 % faster.":
    "Vorgeplante Routen: Die Drohne lädt 15 % schneller.",

  // Body & rhythm
  "Food, water, sleep, fitness. The MCP is watching, gently.":
    "Essen, Wasser, Schlaf, Fitness. Das MCP schaut zu, behutsam.",
  "Visit the Living Quarters (Level +1) first.": "Besuche zuerst die Wohnräume (Ebene +1).",
  "Four needs: satiation, hydration, rest and fitness. They drift down slowly while you play; thirst fastest.":
    "Vier Bedürfnisse: Sättigung, Flüssigkeit, Erholung und Fitness. Sie sinken beim Spielen langsam; der Durst am schnellsten.",
  "Below 20 a need is low and you walk a little slower. Nothing breaks and nothing is lost.":
    "Unter 20 ist ein Bedürfnis niedrig, und du gehst etwas langsamer. Nichts geht kaputt, nichts geht verloren.",
  "Every need at 60 or more and fitness at 70 or more: balanced — you walk a little faster.":
    "Jedes Bedürfnis bei 60 oder mehr und Fitness bei 70 oder mehr: ausgeglichen — du gehst etwas schneller.",
  "Food and drink from the Neutro-Fridge restore 25 % more. Sleep only works below 90 rest, and the lab keeps running while you sleep.":
    "Essen und Trinken direkt aus dem Neutro-Kühlschrank bringen 25 % mehr. Schlafen geht nur unter 90 Erholung, und das Labor läuft weiter, während du schläfst.",
  "Which need drops fastest?": "Welches Bedürfnis sinkt am schnellsten?",
  Fitness: "Fitness",
  Hydration: "Flüssigkeit",
  Rest: "Erholung",
  "What does a low need do?": "Was bewirkt ein niedriges Bedürfnis?",
  "Jade walks a little slower": "Jade geht etwas langsamer",
  "You lose items": "Du verlierst Gegenstände",
  "Game over": "Spiel vorbei",
  "Straight from the fridge, food restores …": "Direkt aus dem Kühlschrank bringt Essen …",
  "25 % more": "25 % mehr",
  "the same": "gleich viel",
  less: "weniger",
  "perk::Steady rhythm": "Ruhiger Rhythmus",
  "Your needs drift down 10 % slower.": "Deine Bedürfnisse sinken 10 % langsamer.",
  "Training on the ergometer": "Training auf dem Ergometer",
  "Ten minutes, legs burning, head clear.": "Zehn Minuten, brennende Beine, klarer Kopf.",
  "Do one workout on the ergometer first.": "Trainiere zuerst einmal auf dem Ergometer.",
  "A workout gives +15 fitness and costs 5 hydration and 3 rest. Then catch your breath for 60 seconds.":
    "Ein Training bringt +15 Fitness und kostet 5 Flüssigkeit und 3 Erholung. Danach 60 Sekunden verschnaufen.",
  "A protein shake before the workout makes it count one and a half times.":
    "Ein Proteinshake vor dem Training lässt es anderthalbfach zählen.",
  "Training right after waking up counts as a morning workout. The MCP notices such things.":
    "Training direkt nach dem Aufwachen zählt als Frühsport. Das MCP bemerkt so etwas.",
  "How much fitness does a workout give (without a shake)?":
    "Wie viel Fitness bringt ein Training (ohne Shake)?",
  "+5": "+5",
  "+15": "+15",
  "+50": "+50",
  "What does the protein shake do?": "Was bewirkt der Proteinshake?",
  "The next workout counts one and a half times": "Das nächste Training zählt anderthalbfach",
  "It replaces sleep": "Er ersetzt den Schlaf",
  "perk::Good form": "Saubere Technik",
  "Workouts give 20 % more fitness.": "Training bringt 20 % mehr Fitness.",
};
