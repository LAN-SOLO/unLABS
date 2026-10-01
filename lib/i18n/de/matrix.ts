/**
 * German translations — area "matrix": the Matrix Chamber (post-game slice
 * extraction from the ETH ledger, composer, mint preparation;
 * lib/world/matrix/, components/world/matrix/).
 * Key = exact English source string from `tr("…")`.
 */
export const DE_MATRIX: Record<string, string> = {
  "Matrix Chamber": "Matrix-Kammer",
  "Slices from the matrix of the Ethereum chain": "Slices aus der Matrix der Ethereum-Chain",
  "rarity::common": "gewöhnlich",
  "rarity::uncommon": "ungewöhnlich",
  "rarity::rare": "selten",
  "rarity::epic": "episch",
  "rarity::legendary": "legendär",
  // Rules
  "The chamber sleeps until every device in the lab is built.":
    "Die Kammer schläft, bis jedes Gerät im Labor gebaut ist.",
  "An extraction is already running.": "Es läuft bereits eine Extraktion.",
  "The ledger has no record of that day.": "Das Ledger kennt diesen Tag nicht.",
  "Field {n} needs {w} W on the grid.": "Feldstärke {n} braucht {w} W im Netz.",
  "Not enough materials for field {n}.": "Nicht genug Material für Feldstärke {n}.",
  "Crystal {n}": "Kristall {n}",
  "Matrix Chamber: a slice dissolved out of the matrix — {code} ({rarity}).":
    "Matrix-Kammer: Ein Slice hat sich aus der Matrix gelöst — {code} ({rarity}).",
  // Tabs
  "matrix::Extraction": "Extraktion",
  "matrix::Slices": "Slices",
  "matrix::Composer": "Komponist",
  "matrix::Mint": "Mint",
  "P02 pure": "P02 pure",
  "P03 RGB": "P03 RGB",
  "P01 mono": "P01 mono",
  "turns like the original capture": "dreht sich wie die Original-Capture",
  "stands still": "steht still",
  "turns, with gaps": "dreht sich, mit Lücken",
  "exotic — mixed slices": "exotisch — gemischte Slices",
  // Asleep
  "The chamber sleeps. Before Damien vanished, the researchers learned to pull slices out of the matrix of the Ethereum chain — the apparatus wakes only when the whole lab runs again.":
    "Die Kammer schläft. Bevor Damien verschwand, fanden die Forscher heraus, wie sich Slices aus der Matrix der Ethereum-Chain lösen lassen — die Apparatur erwacht erst, wenn das ganze Labor wieder läuft.",
  "{n} of {total} devices built": "{n} von {total} Geräten gebaut",
  // Extraction
  "Extraction running": "Extraktion läuft",
  "Tuned to {day} · field {n}. A slice is dissolving out of the matrix.":
    "Gestimmt auf {day} · Feldstärke {n}. Ein Slice löst sich aus der Matrix.",
  "Extraction progress": "Fortschritt der Extraktion",
  "Ready in {t} — keeps running while the game is closed.":
    "Fertig in {t} — läuft weiter, auch wenn das Spiel geschlossen ist.",
  "Materialising…": "Materialisiert…",
  "Started {a} · ends {b}": "Gestartet {a} · endet {b}",
  "Extraction aborted. The materials are lost.":
    "Extraktion abgebrochen. Das Material ist verloren.",
  Abort: "Abbrechen",
  "Ledger day": "Ledger-Tag",
  "Random day": "Zufälliger Tag",
  "Recorded {a} – {b}, {n} days. Source: {src}.":
    "Aufgezeichnet {a} – {b}, {n} Tage. Quelle: {src}.",
  Price: "Kurs",
  "no market yet": "noch kein Markt",
  "Block height": "Blockhöhe",
  Transactions: "Transaktionen",
  Fees: "Gebühren",
  Burned: "Verbrannt",
  "Chain state": "Chain-Zustand",
  "A monochrome day: every indicator stood at an extreme at once. At field 5 the mono line is within reach.":
    "Ein Monochrom-Tag: Alle Indikatoren standen gleichzeitig im Extrem. Mit Feldstärke 5 ist die Mono-Linie erreichbar.",
  "Monochrome days in the ledger ({n})": "Monochrom-Tage im Ledger ({n})",
  "Field strength": "Feldstärke",
  "Grid: {w} W": "Netz: {w} W",
  Materials: "Material",
  "What can dissolve": "Was sich lösen kann",
  "out of reach": "außer Reichweite",
  "Takes 2 to 24 hours of real time — the duration says nothing about the slice. The exact moment cannot be found again: which capture and position dissolves is random.":
    "Dauert 2 bis 24 Stunden echte Zeit — die Dauer sagt nichts über den Slice. Den genauen Zeitpunkt findet die Apparatur nie wieder: Welche Capture und Position sich löst, ist Zufall.",
  "The chamber hums. Tuned to {day}.": "Die Kammer summt. Gestimmt auf {day}.",
  "Start extraction": "Extraktion starten",
  // Slices
  Slice: "Slice",
  Rarity: "Seltenheit",
  "matrix::Line": "Linie",
  "matrix::Traits": "Merkmale",
  "field {n}": "Feldstärke {n}",
  Materialised: "Materialisiert",
  "No slices yet. Start an extraction and come back when it is done.":
    "Noch keine Slices. Starte eine Extraktion und komm zurück, wenn sie fertig ist.",
  // Composer
  "Edit crystal": "Kristall bearbeiten",
  "New crystal": "Neuer Kristall",
  "Position {n}": "Position {n}",
  "Free slices ({n})": "Freie Slices ({n})",
  "Pick a slice, then a position. Click a filled position to take its slice out.":
    "Wähle einen Slice, dann eine Position. Klick auf eine belegte Position nimmt den Slice wieder heraus.",
  "Auto-arrange": "Automatisch anordnen",
  "matrix::Clear": "Leeren",
  "Crystal name": "Name des Kristalls",
  "Crystal kept in the chamber: {name}": "Kristall in der Kammer abgelegt: {name}",
  "Keep crystal": "Kristall ablegen",
  "Chamber inventory": "Inventar der Kammer",
  "+ new crystal": "+ neuer Kristall",
  "Crystal taken apart. Its slices are free again.":
    "Kristall zerlegt. Seine Slices sind wieder frei.",
  "Take apart": "Zerlegen",
  // Mint
  "Matrix Chamber awake": "Matrix-Kammer erwacht",
  "Slices and crystals are made in the lab first. Later they can be minted as NFTs on the Solana devnet through the lab's uplink — with the right devices running and the chamber set to devnet. Mainnet opens only after the legal review.":
    "Slices und Kristalle entstehen zuerst im Labor. Später lassen sie sich über den Uplink des Labors als NFTs im Solana-Devnet minten — wenn die richtigen Geräte laufen und die Kammer auf Devnet steht. Mainnet öffnet erst nach der rechtlichen Prüfung.",
  Uplink: "Uplink",
  "{device} built and on": "{device} gebaut und an",
  "Network: Solana devnet": "Netzwerk: Solana-Devnet",
  "Mainnet: closed until the legal review": "Mainnet: geschlossen bis zur rechtlichen Prüfung",
  "Minting is being prepared: the server must verify every slice before it signs. The button opens once the server side and the marketplace are ready.":
    "Das Minten wird vorbereitet: Der Server muss jeden Slice prüfen, bevor er signiert. Der Knopf öffnet sich, sobald Serverseite und Marktplatz bereit sind.",
  "Mint on devnet": "Im Devnet minten",
  "Metadata preview: {name}": "Metadaten-Vorschau: {name}",
};
