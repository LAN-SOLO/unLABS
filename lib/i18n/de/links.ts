/**
 * German translations — area "links": device hubs and links (content/links.ts,
 * device-ops.ts, the LINKS page of the device interface).
 */
export const DE_LINKS: Record<string, string> = {
  "bus::Admin": "Verwaltung",
  "bus::Data": "Daten",
  "bus::Power": "Strom",
  "bus::Thermal": "Kühlung",
  "bus::Diagnostics": "Diagnose",
  "bus::Compute": "Rechenleistung",
  "Device registry": "Geräteregister",
  "The MCP administers linked devices: switch them from here, read their state, push firmware updates held in its registry.":
    "Der MCP verwaltet verbundene Geräte: von hier schalten, Zustand auslesen, Firmware-Updates aus seinem Register aufspielen.",
  "Network segments": "Netzwerksegmente",
  "Linked devices share data over the lab network: their readouts appear on NET-001, signal feeds reach other devices, and — once NET-001 runs its firmware mirror — update images are downloaded.":
    "Verbundene Geräte teilen Daten über das Labornetz: Ihre Auslesungen erscheinen auf NET-001, Signal-Feeds erreichen andere Geräte, und — sobald NET-001 seinen Firmware-Spiegel hat — werden Update-Images geladen.",
  "Priority circuits": "Vorrangkreise",
  "Linked consumers are served first when the grid runs short.":
    "Verbundene Verbraucher werden zuerst versorgt, wenn das Netz knapp wird.",
  "Cooling loops": "Kühlkreisläufe",
  "Linked machines are on a monitored cooling loop and draw 10 % less power while the Thermal Manager runs (20 % with its loop balancer).":
    "Verbundene Maschinen hängen an einem überwachten Kühlkreislauf und ziehen 10 % weniger Strom, solange der Thermal Manager läuft (20 % mit seinem Kreislaufausgleich).",
  "Diagnostic probes": "Diagnosesonden",
  "Linked devices report their health in the console's readout — no power, overheating, switched off — and, after a deep-scan update, their pending firmware.":
    "Verbundene Geräte melden ihren Zustand in der Auslesung der Konsole — kein Strom, Überhitzung, ausgeschaltet — und nach einem Tiefenscan-Update ihre ausstehende Firmware.",
  "Compute mesh": "Rechenverbund",
  "Linked machines on this level borrow the array's nodes for heavy calculations; their idle cycles add 1 research point per Nexus cycle each. The Teleport Pad's portal maths needs the AI core on the mesh.":
    "Verbundene Maschinen dieser Ebene leihen sich die Knoten des Arrays für schwere Berechnungen; ihre freien Zyklen bringen je 1 Forschungspunkt pro Nexus-Zyklus. Die Portalrechnung des Teleport Pads braucht den KI-Kern im Verbund.",
  "This device cannot link others.": "Dieses Gerät kann keine anderen verbinden.",
  "A hub cannot link itself.": "Ein Hub kann sich nicht selbst verbinden.",
  "The hub must be online.": "Der Hub muss online sein.",
  "Only complete devices can be linked.": "Nur fertige Geräte lassen sich verbinden.",
  "{hub} has no port for this device.": "{hub} hat keinen Anschluss für dieses Gerät.",
  "Already linked.": "Bereits verbunden.",
  "All {n} ports of {hub} are in use.": "Alle {n} Anschlüsse von {hub} sind belegt.",
  "Already on this bus via {hub}.": "Hängt bereits über {hub} an diesem Bus.",
  "Out of range — {hub} only reaches its own level.":
    "Außer Reichweite — {hub} erreicht nur die eigene Ebene.",
  "{device} linked to {hub}.": "{device} mit {hub} verbunden.",
  "{device} linked to {hub}": "{device} mit {hub} verbunden",
  "{device} linked.": "{device} verbunden.",
  "Not linked.": "Nicht verbunden.",
  "{device} unlinked from {hub}.": "{device} von {hub} getrennt.",
  "{device} unlinked.": "{device} getrennt.",
  "This hub cannot switch devices.": "Dieser Hub kann keine Geräte schalten.",
  "{device} switched on remotely.": "{device} aus der Ferne eingeschaltet.",
  "{device} switched off remotely.": "{device} aus der Ferne ausgeschaltet.",
  "Nothing linked yet.": "Noch nichts verbunden.",
  Off: "Aus",
  On: "An",
  Unlink: "Trennen",
  "Device to link": "Zu verbindendes Gerät",
  "— choose a device —": "— Gerät wählen —",
  Link: "Verbinden",
  "No device can be linked right now.": "Gerade lässt sich kein Gerät verbinden.",
  // ── game.ts: hub readouts ──
  "Remote {device}: {line}": "Fern {device}: {line}",
  "Remote {device}: online.": "Fern {device}: online.",
  "Probe {device}: healthy.": "Sonde {device}: in Ordnung.",
  "Probe {device}: overheating — the Thermal Manager must run.":
    "Sonde {device}: überhitzt — der Thermal Manager muss laufen.",
  "Probe {device}: no power — shed load or add generation.":
    "Sonde {device}: kein Strom — Last abwerfen oder Erzeugung ausbauen.",
  "Probe {device}: switched off.": "Sonde {device}: ausgeschaltet.",
  // ── content/devices.ts: link gates ──
  "The focus locks onto the Echo Recorder's feed — and that feed only travels over the network. Link the Echo Recorder to NET-001 (Network Monitor → Links).":
    "Der Fokus rastet auf den Feed des Echo Recorders ein — und der läuft nur über das Netz. Verbinde den Echo Recorder mit NET-001 (Network Monitor → Vernetzung).",
  "The portal needs its coordinates solved in real time — a job for the AI core with the whole array behind it. Link the AI Assistant Core to the Supercomputer Array (SCA-001 → Links).":
    "Das Portal braucht seine Koordinaten in Echtzeit gelöst — eine Aufgabe für den KI-Kern mit dem ganzen Array im Rücken. Verbinde den AI Assistant Core mit dem Supercomputer Array (SCA-001 → Vernetzung).",
};
