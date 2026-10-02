/**
 * German translations — area "doors": door styles and locking mechanisms,
 * the lock system (interface, modes, access log) and the data-center
 * airlock (lib/world/doors/, components/world/doors/; docs/DOORS.md).
 * Key = exact English source string from `tr("…")`.
 */
export const DE_DOORS: Record<string, string> = {
  // Lock rules
  "There is no door here.": "Hier ist keine Tür.",
  "Airlock doors cannot be held open — the interlock refuses.":
    "Schleusentüren lassen sich nicht offen halten — die Verriegelung verweigert es.",
  "Sealed. The mechanism locks and stays locked.":
    "Versiegelt. Die Mechanik verriegelt und bleibt verriegelt.",
  "Held open.": "Wird offen gehalten.",
  "Back to automatic.": "Wieder automatisch.",
  "Airlock — outer door": "Schleuse — Außentür",
  "Airlock — inner door": "Schleuse — Innentür",
  "Keypad: enter the code.": "Tastenfeld: Code eingeben.",
  // Shapes
  "sliding pair": "Schiebetür, zweiflügelig",
  "staggered four-leaf": "Vierflügelig, versetzt",
  "swing pair": "Pendeltür, zweiflügelig",
  "roll-up shutter": "Rolltor",
  // Mechanisms
  "Throw bolts": "Schubriegel",
  "Vault wheel": "Tresorrad",
  "Jamb clamps": "Zargenklammern",
  "Drop pins": "Fallbolzen",
  "Magnetic seal": "Magnetverschluss",
  "Cross bar": "Querbalken",
  "Cam latch": "Nockenverschluss",
  "Hydraulic pistons": "Hydraulikkolben",
  "Steel bolts shoot across the meeting edge and pull back into the leaf.":
    "Stahlriegel schießen über die Stoßkante und ziehen sich ins Türblatt zurück.",
  "A wheel turns the lugs into the frame — a quarter turn locks, a quarter turn frees.":
    "Ein Rad dreht die Zapfen in den Rahmen — eine Vierteldrehung verriegelt, eine Vierteldrehung gibt frei.",
  "Clamps on both jambs swing over the leaves and press them into the seal.":
    "Klammern an beiden Zargen schwenken über die Flügel und pressen sie in die Dichtung.",
  "Pins drop from the header into the leaves; they lift before the door moves.":
    "Bolzen fallen aus dem Sturz in die Flügel; sie heben sich, bevor die Tür fährt.",
  "Electromagnets hold the leaves together. When the strip goes dark, it is free.":
    "Elektromagnete halten die Flügel zusammen. Wird der Streifen dunkel, ist sie frei.",
  "A bar drops across both leaves into its brackets and swings up to release.":
    "Ein Balken fällt quer über beide Flügel in seine Halter und schwenkt zum Öffnen hoch.",
  "Cam discs on the meeting edge turn their hooks into each other.":
    "Nockenscheiben an der Stoßkante drehen ihre Haken ineinander.",
  "Hydraulic rams press the leaves shut and retract with a hiss.":
    "Hydraulikstempel pressen die Flügel zu und fahren zischend zurück.",
  // Focus label, toast
  "Lock interface": "Schließ-Interface",
  sealed: "versiegelt",
  "held open": "offen gehalten",
  automatic: "automatisch",
  "MCP: Decontamination complete. The data center stays clean — dust has no business in there.":
    "MCP: Dekontamination abgeschlossen. Das Rechenzentrum bleibt sauber — Staub hat da drin nichts verloren.",
  // Door panel
  Locked: "Verriegelt",
  Sealed: "Versiegelt",
  "Held open": "Offen gehalten",
  Automatic: "Automatisch",
  "Lock interface · {id}": "Schließ-Interface · {id}",
  "Locking mechanism": "Schließmechanik",
  Mode: "Modus",
  "Hold open": "Offen halten",
  Seal: "Versiegeln",
  "Enter code": "Code eingeben",
  "The two doors never open together. Step into the chamber: the doors seal, steam blows for {steam} s, the extraction pulls steam and dust through the floor grate for {extract} s, then the far door releases. The data center stays free of dust.":
    "Die beiden Türen öffnen nie gleichzeitig. Tritt in die Kammer: Die Türen versiegeln, {steam} s lang strömt Dampf, die Absaugung zieht {extract} s lang Dampf und Staub durch das Bodengitter, dann gibt die andere Tür frei. Das Rechenzentrum bleibt staubfrei.",
  "Cycle: steam": "Zyklus: Dampf",
  "Cycle: extraction": "Zyklus: Absaugung",
  "Cycle: released": "Zyklus: freigegeben",
  Ready: "Bereit",
  "{n} cycles": "{n} Zyklen",
  "Access log": "Zugangsprotokoll",
  "Never opened.": "Nie geöffnet.",
  "Opened {n}× · last {m} min ago.": "{n}× geöffnet · zuletzt vor {m} Min.",
  // Station tab
  Doors: "Türen",
  "The lock system: every door has its own mechanism and an interface on its jamb. Sealed doors stay shut until you open them here or at the door.":
    "Die Schließanlage: Jede Tür hat ihre eigene Mechanik und ein Interface an der Zarge. Versiegelte Türen bleiben zu, bis du sie hier oder an der Tür öffnest.",
  "{n}× opened": "{n}× geöffnet",
};
