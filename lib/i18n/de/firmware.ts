/**
 * German translations — area "firmware": device firmware in the Lab World
 * (lib/world/firmware.ts, device-ops.ts, content/firmware.ts, the FIRMWARE
 * page of the device interface). Key = exact English source string.
 */
export const DE_FIRMWARE: Record<string, string> = {
  "No update known for this device.": "Für dieses Gerät ist kein Update bekannt.",
  "Already up to date.": "Bereits aktuell.",
  "The device is not complete.": "Das Gerät ist nicht fertig gebaut.",
  "The device must be online to be flashed.": "Das Gerät muss zum Flashen online sein.",
  "Needs at least version {version} installed.": "Braucht mindestens Version {version}.",
  "No image source: link the device to a network mirror.":
    "Keine Image-Quelle: Verbinde das Gerät mit einem Netzwerk-Spiegel.",
  "No image source: the MCP must administer this device.":
    "Keine Image-Quelle: Der MCP muss dieses Gerät verwalten.",
  "Update {version} ready.": "Update {version} bereit.",
  "Checksum mismatch — image rejected, nothing was written.":
    "Prüfsumme falsch — Image abgelehnt, nichts wurde geschrieben.",
  "{device}: firmware {version} flashed.": "{device}: Firmware {version} geflasht.",
  "{device} runs {version} — new: {feature}.": "{device} läuft mit {version} — neu: {feature}.",
  "The factory image is already installed.": "Das Werks-Image ist bereits installiert.",
  "{device}: rolled back to {version}.": "{device}: zurückgesetzt auf {version}.",
  "Factory image {version} restored.": "Werks-Image {version} wiederhergestellt.",
  "{device} firmware {version} or newer": "{device} mit Firmware {version} oder neuer",
  "fw::checking": "prüfen",
  "fw::downloading": "laden",
  "fw::verifying": "verifizieren",
  "fw::flashing": "flashen",
  "fw::rebooting": "neustarten",
  "fw {version}": "fw {version}",
  Version: "Version",
  "fw::Build": "Build",
  Checksum: "Prüfsumme",
  "Security patch": "Sicherheitspatch",
  Features: "Funktionen",
  "Update {version} installed": "Update {version} installiert",
  "Update {version} available": "Update {version} verfügbar",
  "Roll back to factory image": "Auf Werks-Image zurücksetzen",
  checksum: "Prüfsumme",
  "Image checksum": "Image-Prüfsumme",
  Flash: "Flashen",
  "Flash {version}": "{version} flashen",
  "Service image on board — enter its checksum to verify.":
    "Service-Image an Bord — gib seine Prüfsumme zur Verifikation ein.",
  // ── content/firmware.ts ──
  "Firmware mirror": "Firmware-Spiegel",
  "NET-001 mirrors update images for every device linked to it — a linked device can then be flashed over the network. The Explorer Drone's navigation needs this image too.":
    "NET-001 spiegelt Update-Images für jedes verbundene Gerät — ein verbundenes Gerät lässt sich dann über das Netz flashen. Auch die Navigation der Explorer Drone braucht dieses Image.",
  "Deep packet inspection: drone beacon telemetry is no longer dropped as noise.":
    "Tiefe Paketinspektion: Die Baken-Telemetrie der Drohne wird nicht mehr als Rauschen verworfen.",
  "Quiet mode": "Leisemodus",
  "The ventilation throttles its fans between gusts: 1.5 W instead of 4 W.":
    "Die Lüftung drosselt ihre Ventilatoren zwischen den Böen: 1,5 W statt 4 W.",
  "Quiet mode: fans idle between gusts (draw 4 W → 1.5 W).":
    "Leisemodus: Ventilatoren ruhen zwischen den Böen (Verbrauch 4 W → 1,5 W).",
  "Filter clog prediction. The filter is clogged. Predicted.":
    "Filterverstopfungsprognose. Der Filter ist verstopft. Vorhergesagt.",
  "Torque profiles": "Drehmomentprofile",
  "Gentle torque profiles for delicate assemblies: anything made of two parts comes apart without losing either.":
    "Sanfte Drehmomentprofile für empfindliche Baugruppen: Alles aus zwei Teilen geht auseinander, ohne dass eins verloren geht.",
  "New torque profiles: two-part assemblies are taken apart without loss.":
    "Neue Drehmomentprofile: Zweiteilige Baugruppen werden verlustfrei zerlegt.",
  "Tool wear estimation. The screwdriver is fine. The screwdriver has always been fine.":
    "Werkzeugverschleißschätzung. Dem Schraubendreher geht es gut. Dem Schraubendreher ging es immer gut.",
  "Adaptive focus": "Adaptiver Fokus",
  "The laser tracks the surface distance and wastes less beam: 40 W instead of 55 W.":
    "Der Laser folgt dem Oberflächenabstand und verschwendet weniger Strahl: 40 W statt 55 W.",
  "Adaptive beam focus with surface distance compensation (draw 55 W → 40 W).":
    "Adaptiver Strahlfokus mit Abstandsausgleich (Verbrauch 55 W → 40 W).",
  "Dual-sensor beam path interlock. Please keep your eyes where they are.":
    "Strahlweg-Verriegelung mit zwei Sensoren. Bitte behalten Sie Ihre Augen, wo sie sind.",
  "Fuel auto-tune": "Brennstoff-Autotuning",
  "The reactor tunes its fuel mixture continuously: 285 W instead of 250 W.":
    "Der Reaktor stimmt sein Brennstoffgemisch laufend ab: 285 W statt 250 W.",
  "Fuel mixture auto-tuning: +35 W sustained output.":
    "Brennstoffgemisch-Autotuning: +35 W Dauerleistung.",
  "Auto-SCRAM cascade under 100 ms. Previously: “eventually”.":
    "Auto-SCRAM-Kaskade unter 100 ms. Bisher: »irgendwann«.",
  "Fast return": "Schnelle Rückkehr",
  "Path optimisation in the shaft and a smarter charge cycle: the drone is ready again after 125 s instead of 150 s.":
    "Wegoptimierung im Schacht und ein klügerer Ladezyklus: Die Drohne ist nach 125 s statt 150 s wieder bereit.",
  "Obstacle avoidance and path optimisation in the shaft.":
    "Hindernisvermeidung und Wegoptimierung im Schacht.",
  "Charge cycle shortened: 150 s → 125 s between flights.":
    "Ladezyklus verkürzt: 150 s → 125 s zwischen den Flügen.",
  "Coil duty cycling": "Spulentaktung",
  "The magnet pulses its coils instead of holding them: 8 W instead of 10 W.":
    "Der Magnet pulst seine Spulen, statt sie zu halten: 8 W statt 10 W.",
  "Adaptive coil duty cycling (draw 10 W → 8 W).": "Adaptive Spulentaktung (Verbrauch 10 W → 8 W).",
  "Selective polarity. Paper clips are no longer a crystal component.":
    "Selektive Polarität. Büroklammern sind keine Kristallbauteile mehr.",
  "Batch scan": "Stapelscan",
  "The scanner sweeps every refilling source within reach at once: its readout names the ones that are full right now.":
    "Der Scanner erfasst alle nachfüllenden Quellen in Reichweite auf einmal: Seine Auslesung nennt die, die gerade voll sind.",
  "Batch analysis mode: the readout lists refilling sources ready to harvest.":
    "Stapelanalyse: Die Auslesung listet nachfüllende Quellen, die bereit zur Ernte sind.",
  "200+ new compound signatures. None of them is coffee.":
    "200+ neue Verbindungssignaturen. Keine davon ist Kaffee.",
  "Material scan: {n} refilling source(s) within reach.":
    "Materialscan: {n} nachfüllende Quelle(n) in Reichweite.",
  "Batch scan — ready to harvest: {list}.": "Stapelscan — bereit zur Ernte: {list}.",
  "Batch scan: every source is still refilling.": "Stapelscan: Jede Quelle füllt sich noch.",
  "Slice cache": "Scheiben-Cache",
  "Predictive cache warming: the cache's readout lists, per level, how many slices of Crystal #0089 are still missing.":
    "Vorausschauendes Cache-Vorwärmen: Die Auslesung des Caches zeigt pro Ebene, wie viele Scheiben von Kristall #0089 noch fehlen.",
  "Parallel slice lookups; the readout counts missing slices per level.":
    "Parallele Scheibenabfragen; die Auslesung zählt fehlende Scheiben pro Ebene.",
  "Fixed a race condition in auto-sync. The race was won by nobody.":
    "Race Condition im Auto-Sync behoben. Das Rennen hat niemand gewonnen.",
  "Adaptive charging": "Adaptives Laden",
  "Adaptive current profiles: the battery buffer adds 55 W to the grid instead of 40 W.":
    "Adaptive Stromprofile: Der Batteriepuffer gibt 55 W statt 40 W ins Netz.",
  "Adaptive current profiling: buffer +40 W → +55 W.":
    "Adaptive Stromprofile: Puffer +40 W → +55 W.",
  "Deep-discharge recovery. For the next time nobody comes back for seven years.":
    "Tiefentladungs-Erholung. Für das nächste Mal, wenn sieben Jahre lang niemand zurückkommt.",
  "Purge saver": "Spülsparer",
  "Less purge waste when switching material: every third print needs no Base Alloy.":
    "Weniger Spülabfall beim Materialwechsel: Jeder dritte Druck braucht keine Basislegierung.",
  "Multi-material switching with 60 % less purge waste: every third print is free.":
    "Materialwechsel mit 60 % weniger Spülabfall: Jeder dritte Druck ist gratis.",
  "Layer defect inspection. It found some. In the previous firmware.":
    "Schichtfehlerprüfung. Sie hat welche gefunden. In der vorigen Firmware.",
  "Self-optimising scheduler": "Selbstoptimierender Planer",
  "The AI core plans the Nexus research queue: while it is online, a research cycle takes 60 s instead of 90 s.":
    "Der KI-Kern plant die Forschungswarteschlange des Nexus: Solange er online ist, dauert ein Forschungszyklus 60 s statt 90 s.",
  "Self-optimising learning mode: Nexus research cycles every 60 s.":
    "Selbstoptimierender Lernmodus: Forschungszyklen des Nexus alle 60 s.",
  "Expanded context window. It now remembers what it was about to say. Mostly.":
    "Erweitertes Kontextfenster. Es weiß jetzt noch, was es gerade sagen wollte. Meistens.",
  "Leak trace": "Leckverfolgung",
  "The memory monitor traces unindexed records: its readout names a room that still holds an unread note.":
    "Der Speichermonitor verfolgt nicht indizierte Aufzeichnungen: Seine Auslesung nennt einen Raum, in dem noch eine ungelesene Notiz liegt.",
  "Leak detection with origin tracing: the readout points to unread notes.":
    "Leckerkennung mit Herkunftsverfolgung: Die Auslesung zeigt auf ungelesene Notizen.",
  "Page fault prediction. It predicts you will read this. It was right.":
    "Seitenfehlerprognose. Sie sagt voraus, dass du das liest. Sie hatte recht.",
  "Fusion start sequencer": "Fusions-Startsequenzer",
  "Load shedding for a fusion ignition — the Microfusion Reactor will not ignite without it. Also adds two priority circuits (8 instead of 6).":
    "Lastabwurf für eine Fusionszündung — ohne ihn zündet der Microfusion Reactor nicht. Dazu zwei weitere Vorrangkreise (8 statt 6).",
  "Fusion start sequencer: sheds load during an ignition (required by MFR-001).":
    "Fusions-Startsequenzer: wirft während einer Zündung Last ab (nötig für MFR-001).",
  "Two additional priority circuits.": "Zwei zusätzliche Vorrangkreise.",
  "Emergency cutoff no longer cuts off the emergency.":
    "Die Notabschaltung schaltet nicht mehr den Notfall ab.",
  "Prerequisite chains": "Voraussetzungsketten",
  "The Nexus sees which steps a topic really needs and skips the rest: +2 research points per cycle.":
    "Der Nexus sieht, welche Schritte ein Thema wirklich braucht, und überspringt den Rest: +2 Forschungspunkte pro Zyklus.",
  "Prerequisite-chain highlighting: +2 research points per cycle.":
    "Hervorhebung von Voraussetzungsketten: +2 Forschungspunkte pro Zyklus.",
  "Less graph jitter. The graph was nervous. Understandably.":
    "Weniger Graph-Zittern. Der Graph war nervös. Verständlicherweise.",
  "Event scheduler": "Ereignisplaner",
  "The clock schedules the lab's refill cycles: refilling sources come back 20 % sooner.":
    "Die Uhr plant die Nachfüllzyklen des Labors: Nachfüllende Quellen sind 20 % früher wieder da.",
  "Lab event scheduling: refill cycles 20 % shorter.":
    "Labor-Ereignisplanung: Nachfüllzyklen 20 % kürzer.",
  "Drift under 0.5 ppm. Day 2,561 is now exactly day 2,561.":
    "Drift unter 0,5 ppm. Tag 2.561 ist jetzt exakt Tag 2.561.",
  "Deep scan": "Tiefenscan",
  "Full device bus analysis: the console reports on every open blueprint (not just three) and on pending updates of its probed devices.":
    "Vollständige Geräte-Busanalyse: Die Konsole meldet sich zu jedem offenen Bauplan (nicht nur drei) und zu ausstehenden Updates ihrer sondierten Geräte.",
  "Deep-scan mode: findings for every open blueprint.":
    "Tiefenscan-Modus: Befunde für jeden offenen Bauplan.",
  "Firmware certificate checks for probed devices.":
    "Firmware-Zertifikatsprüfung für sondierte Geräte.",
  "Loop balancer": "Kreislaufausgleich",
  "Balanced cooling loops: linked machines draw 20 % less instead of 10 %.":
    "Ausgeglichene Kühlkreisläufe: Verbundene Maschinen ziehen 20 % statt 10 % weniger.",
  "Loop balancing across all cooling circuits (linked machines −20 % draw).":
    "Ausgleich über alle Kühlkreisläufe (verbundene Maschinen −20 % Verbrauch).",
  "Emergency cooling now asks before freezing the coffee.":
    "Die Notkühlung fragt jetzt, bevor sie den Kaffee einfriert.",
  "Pre-charge buffer": "Vorladepuffer",
  "The pad pre-charges its capacitors in the idle time: 60 W instead of 100 W.":
    "Das Pad lädt seine Kondensatoren in der Leerlaufzeit vor: 60 W statt 100 W.",
  "Energy buffer pre-charge mode (draw 100 W → 60 W).":
    "Energiepuffer-Vorlademodus (Verbrauch 100 W → 60 W).",
  "Destination cache. It remembers where you went. It will not tell anyone. Probably.":
    "Zielcache. Er merkt sich, wo du warst. Er erzählt es niemandem. Vermutlich.",
  "Breach guard": "Durchbruchschutz",
  "Triple-redundant containment: when a mix blows up on the workbench, one of its parts is caught and returned.":
    "Dreifach redundante Eindämmung: Wenn eine Mischung auf der Werkbank explodiert, wird eines ihrer Teile aufgefangen und zurückgegeben.",
  "Breach prediction: explosions spare one input part.":
    "Durchbruchprognose: Explosionen verschonen ein Eingangsteil.",
  "Particle trajectory prediction. The particles were not consulted.":
    "Teilchenbahnprognose. Die Teilchen wurden nicht gefragt.",
  "Collapse watch": "Kollapswache",
  "The simulator only re-measures qubits that are about to decohere: 15 W instead of 22 W.":
    "Der Simulator misst nur Qubits nach, die gleich dekohärieren: 15 W statt 22 W.",
  "Predictive decoherence warnings (draw 22 W → 15 W).":
    "Vorausschauende Dekohärenzwarnungen (Verbrauch 22 W → 15 W).",
  "Wave function display. It looks like soup. Quantum soup.":
    "Wellenfunktionsanzeige. Sieht aus wie Suppe. Quantensuppe.",
  // ── game.ts: firmware effects and readouts ──
  "{message} The containment field caught 1× {name}.":
    "{message} Das Eindämmungsfeld hat 1× {name} aufgefangen.",
  "{name} taken apart. The torque profiles saved every part.":
    "{name} zerlegt. Die Drehmomentprofile haben jedes Teil gerettet.",
  "{name} printed — purge saver: no filament used.":
    "{name} gedruckt — Spülsparer: kein Filament verbraucht.",
  "Crystal index: {n} of {total} slices of Crystal #0089 catalogued.":
    "Kristallindex: {n} von {total} Scheiben von Kristall #0089 katalogisiert.",
  "Slice cache — still missing: {list}.": "Scheiben-Cache — es fehlen noch: {list}.",
  "Slice cache: every slice is accounted for.": "Scheiben-Cache: Jede Scheibe ist erfasst.",
  "Service image {version} on board — its checksum is somewhere in the lab.":
    "Service-Image {version} an Bord — seine Prüfsumme steht irgendwo im Labor.",
  "Update {version} waiting on the network mirror (NET-001).":
    "Update {version} wartet auf dem Netzwerk-Spiegel (NET-001).",
  "Update {version} waiting in the MCP's device registry.":
    "Update {version} wartet im Geräteregister des MCP.",
  "Micro-fusion: {w} W. Auto-SCRAM armed. Cooling via THM-001.":
    "Mikrofusion: {w} W. Auto-SCRAM scharf. Kühlung über THM-001.",
  "Buffer storage: +{w} W reserve on the grid.": "Pufferspeicher: +{w} W Reserve im Netz.",
  "Leak trace: an unindexed record in {room} ({floor}).":
    "Leckverfolgung: eine nicht indizierte Aufzeichnung in {room} ({floor}).",
  "Leak trace: every reachable record is indexed.":
    "Leckverfolgung: Jede erreichbare Aufzeichnung ist indiziert.",
  // ── content/devices.ts: firmware gates ──
  "Without GPS the drone navigates by the lab network's beacons — and NET-001's factory firmware drops its telemetry as noise. Flash the Network Monitor's service image 2.2.0 (NET-001 → Firmware). The checksum label never made it onto the device; Jade stuck the spare strips somewhere draughty in the Outer Airlock.":
    "Ohne GPS navigiert die Drohne an den Baken des Labornetzes — und die Werks-Firmware von NET-001 verwirft ihre Telemetrie als Rauschen. Flashe das Service-Image 2.2.0 des Network Monitor (NET-001 → Firmware). Das Prüfsummen-Etikett hat es nie aufs Gerät geschafft; Jade hat die Ersatzstreifen irgendwo in der Außenschleuse verstaut, wo es zieht.",
  "Spinning up the rings takes a load-shedding start sequence the Power Management System does not know yet. The MCP holds update 1.1.0: add PWR-001 to the MCP's device registry (MCP → Links), then flash it (PWR-001 → Firmware).":
    "Um die Ringe hochzufahren, braucht es eine Startsequenz mit Lastabwurf, die das Power Management System noch nicht kennt. Der MCP hält Update 1.1.0 bereit: PWR-001 ins Geräteregister des MCP eintragen (MCP → Vernetzung), dann flashen (PWR-001 → Firmware).",
  "Adds a local firmware mirror for linked devices.":
    "Fügt einen lokalen Firmware-Spiegel für verbundene Geräte hinzu.",
  "Packet inspector no longer flags the MCP's sighs as malware.":
    "Der Paketinspektor meldet die Seufzer des MCP nicht mehr als Schadsoftware.",
};
