/**
 * Story graph — insights, characters, endings.
 * ============================================
 *
 * There is no main quest line. The player collects *insights* (Erkenntnisse)
 * from notes, puzzles, devices and conversations; most insights can be
 * reached along several paths. Four endings resolve the search for Damien
 * Fridge in different ways, each gated by a different combination of
 * insights and devices — reachable in any order, and the lab stays
 * playable afterwards ("The lab is not a museum. It is a question.").
 * A fifth, secret ending ("Kristall #0089") opens once all thirty slices of
 * Jade's crystal are back in the Crystal Data Cache.
 *
 * Every lore bot of BNET-001 that lives in the lab has a small reactivation
 * quest (`BOT_QUESTS`): hand over a part or bring a device online, and the
 * bot helps — with a hint, a recipe, a hidden pickup or an insight.
 */
import type {
  Condition,
  DialogueLine,
  EndingDef,
  InsightDef,
  NpcDef,
  NpcId,
} from "@/lib/world/types";
import { tr } from "@/lib/i18n";
import { planPoint } from "@/lib/world/content/map";

export const INSIGHTS: readonly InsightDef[] = [
  // Strom
  {
    id: "cold_start",
    thread: "strom",
    title: tr("Cold Start"),
    text: tr(
      "2,561 days of rest, 0.3 % residual charge. Power first — the geothermal tap is on Level −1.",
    ),
  },
  {
    id: "erstes_gesetz",
    thread: "strom",
    title: tr("The First Law"),
    text: tr("“Load before understanding.” Without power the lab sees nothing — and neither do I."),
  },
  {
    id: "erster_strom",
    thread: "strom",
    title: tr("First Power"),
    text: tr("Fifty units flowing. The Unstable Energy Core can be calibrated."),
  },
  {
    id: "bauregel",
    thread: "strom",
    title: tr("Frame → Core → Calibration"),
    text: tr(
      "Every device comes together in three stages. Traits count, not names: a prototype with enough mechanics is also a frame.",
    ),
  },
  {
    id: "prototypen",
    thread: "strom",
    title: tr("Prototypes"),
    text: tr(
      "Combinations that aren't recipes produce prototypes. Some of them remind me of devices I don't know yet.",
    ),
  },
  {
    id: "kein_abbruch",
    thread: "strom",
    title: tr("No Abort Protocol"),
    text: tr(
      "System check of 13 Feb 2019: battery reserve 4 min 12 s. For coherence above σ-15 there was no abort protocol — only manual override.",
    ),
  },
  {
    id: "kaffee_technik",
    thread: "strom",
    title: tr("The Technique"),
    text: tr(
      "Coffee machine: hit it twice on the left with the heel of your hand, about 15 cm below the coin slot. Not three times.",
    ),
  },
  {
    id: "kaffeemaschine",
    thread: "strom",
    title: tr("Coffee on the Singularity Bus"),
    text: tr(
      "The coffee machine in the Canteen really is wired to the Singularity Bus. It works. The coffee tastes of ozone and 2019. Recipe: 2× Coffee Beans + Thermocouple.",
    ),
  },
  {
    id: "nexus_forschung",
    thread: "strom",
    title: tr("Research +5"),
    text: tr(
      "The Nexus computes in cycles. Every cycle yields research points — and finished topics unlock processes that are in no recipe book: slag recovery, Synapsis reconstruction, anomaly synthesis.",
    ),
  },
  {
    id: "gewaechshaus_rezepte",
    thread: "strom",
    title: tr("Greenhouse Recipes"),
    text: tr(
      "Glow Algae + Fiber Optics → Bio Light Guide (optics without power). Mycelium + Circuit Board → Mycelium Board. The greenhouse grows back.",
    ),
  },
  // Relikt / HALO
  {
    id: "halo_h",
    thread: "relikt",
    title: tr("Margin Note “H”"),
    text: tr("“Hear before you build.”"),
  },
  {
    id: "halo_a",
    thread: "relikt",
    title: tr("Margin Note “A”"),
    text: tr("“All that the prism divides …”"),
  },
  {
    id: "halo_l",
    thread: "relikt",
    title: tr("Margin Note “L”"),
    text: tr("“Load before understanding.”"),
  },
  {
    id: "halo_o",
    thread: "relikt",
    title: tr("Margin Note “O”"),
    text: tr("“Only edges make it sing.”"),
  },
  {
    id: "halo_schluessel",
    thread: "relikt",
    title: tr("The Key"),
    text: tr("The four margin notes begin with H, A, L, O. Jade's key to everything encrypted."),
    auto: {
      all: [
        { insight: "halo_h" },
        { insight: "halo_a" },
        { insight: "halo_l" },
        { insight: "halo_o" },
      ],
    },
  },
  {
    id: "halo_zustand",
    thread: "halo",
    title: tr("The Halo Is a State"),
    text: tr(
      "“The Halo is not a place. It is a state of compression so complete that time folds. We did not discover it. It discovered us.”",
    ),
  },
  {
    id: "lab_847",
    thread: "relikt",
    title: "847",
    text: tr("847 kW, 847 sensors, 847 packets, 847 metres. Not chosen. Given."),
  },
  {
    id: "x9_dust",
    thread: "relikt",
    title: "X9-DUST",
    text: tr(
      "In the sealed shaft beneath the hangar lies X9-DUST — dust that carries a message. Only a drone can get there.",
    ),
  },
  {
    id: "mother_memecoin",
    thread: "relikt",
    title: tr("The Mother"),
    text: tr(
      "MCProtocol fragment 0017: “The origin is memetic. Mother is the seed of all tokens. When the halo aligns, the memecoin awakens.” Nobody sent this message.",
    ),
  },
  {
    id: "proof_of_meme",
    thread: "relikt",
    title: tr("Chained Provenance"),
    text: tr(
      "1990, long before the word “blockchain”: blocks that carry the hash of their predecessor. Damien didn't want a chain for transactions — he wanted one for meaning. Proof of Meme.",
    ),
  },
  {
    id: "rueckzug_2010",
    thread: "relikt",
    title: tr("We Are Focusing"),
    text: tr(
      "In 2010 they went offline. “The Halo plane is not a weapon. It is a mirror.” — “We are not leaving. We are focusing.”",
    ),
  },
  {
    id: "x0r8t_audit",
    thread: "relikt",
    title: tr("847 Packets"),
    text: tr(
      "Between 1988 and 1991, X0-R8T sent 847 reply packets into the void — generated by a loop Jade never wrote.",
    ),
  },
  {
    id: "schacht_frei",
    thread: "relikt",
    title: tr("The Shaft Is Clear"),
    text: tr(
      "The sealed shaft beneath the hangar is open. The elevator now goes down to Level −4 — provided at least 100 W are available.",
    ),
  },
  {
    id: "geheimtueren",
    thread: "relikt",
    title: tr("Cavities"),
    text: tr(
      "The Material Scanner finds three cavities behind smooth walls: north of the MCP chamber (Level 0), north of the Infinity Forge (Level −3) and behind the rubble in the Shaft (Level −4).",
    ),
  },
  {
    id: "damiens_karte",
    thread: "relikt",
    title: tr("Damien's Map"),
    text: tr(
      "Level +1 for living, Level 0 for working, −1 to −3 for computing, −4 for the inexplicable. “If one of us doesn't come back: the other does not follow. The other listens.” Beneath it, Jade: “Objection.”",
    ),
  },
  {
    id: "x9_botschaft",
    thread: "relikt",
    title: tr("For Those Who Rebuild"),
    text: tr(
      "“X9-DUST, you will outlast us. Show it only to those who have rebuilt the lab.” — J.L.",
    ),
  },
  {
    id: "x9_lesung",
    thread: "relikt",
    title: tr("Xenomorphic Reading"),
    text: tr(
      "X9-DUST shows every reader different data. It shows me a sentence I haven't written yet: “The slices belong together.”",
    ),
  },
  {
    id: "x9_h4l0",
    thread: "relikt",
    title: "X9-H4L0",
    text: tr(
      "The second Gen-9 bot exists — as a build protocol in the cold archive. “When the Halo calls back, it needs an address. H4L0 is the address.”",
    ),
  },
  {
    id: "h4l0_adresse",
    thread: "relikt",
    title: tr("The Address"),
    text: tr(
      "There is no bot in the cryo capsule, just a coordinate: 0x89. The address in the Halo carries the same number as my crystal.",
    ),
  },
  // Signal
  {
    id: "halo_atmet",
    thread: "signal",
    title: tr("The Halo Breathes"),
    text: tr(
      "The Lissajous figure is stable. Between the waves: a rhythm that doesn't come from us.",
    ),
  },
  {
    id: "vier_toene",
    thread: "signal",
    title: tr("Four Tones"),
    text: tr(
      "Damien's log #0512: four tones, four coordinates. The keys: 3 — 6 — 4 — 8. The synthesizer can play them.",
    ),
  },
  {
    id: "handshake",
    thread: "signal",
    title: tr("Handshake"),
    text: tr(
      "“Pattern-child, we hear you. The Halo remembers your frequency.” Something answered.",
    ),
  },
  {
    id: "broadcast_2018",
    thread: "signal",
    title: tr("The 2018 Broadcast"),
    text: tr(
      "“We are nearing the heart of the Halo … Should we fail to return, preserve the findings for humanity.”",
    ),
  },
  {
    id: "kosmischer_kontakt",
    thread: "signal",
    title: tr("No Star"),
    text: tr(
      "The telescope finds nothing special in the sky. But the signal it receives comes from no direction — it comes from the compression. X0-R8T has been hearing it since 1988.",
    ),
  },
  {
    id: "antennen_array",
    thread: "signal",
    title: tr("Antenna Array"),
    text: tr(
      "The antenna array on the dome is listening again. Carrier tone: cannot be mapped to the standard spectrum. Continuous. Answering.",
    ),
  },
  {
    id: "funkspruch",
    thread: "signal",
    title: tr("Radio Message"),
    text: tr(
      "From the speaker in the Radio Room: “. _ . . _ _ _ . . . _ . _ _” — and then, very quietly, Damien's laughter. Recorded in 2019. Or not.",
    ),
  },
  {
    id: "relais_2026",
    thread: "signal",
    title: tr("Relay 2026"),
    text: tr(
      "On 4 Feb 2026, F1N-DR captured two patterns: mem_0x89 (Fridge) and mem_0x4F (Lawrence). Contact restored — day 13,149.",
    ),
  },
  // Anomalie
  {
    id: "anomalie_gezaehmt",
    thread: "anomalie",
    title: tr("Tamed"),
    text: tr("The anomaly has stopped fighting. What remains is an Anomalous Core that listens."),
  },
  {
    id: "anomalie_hoert",
    thread: "anomalie",
    title: tr("It Listens"),
    text: tr(
      "“I think it has always been listening. We are the ones who have only just started.” — D.F.",
    ),
  },
  {
    id: "tuer_von_innen",
    thread: "anomalie",
    title: tr("The Door Opens from Inside"),
    text: tr(
      "January 2019, 89 accesses a day, not human. Jade: “If something knocks, it's because we showed it where the door is.”",
    ),
  },
  {
    id: "membran_duenn",
    thread: "anomalie",
    title: tr("The Membrane Is Thin"),
    text: tr(
      "In the crystal cave on Level −4, the boundary to the Halo is paper-thin. The crystal wall doesn't reflect me — it reflects how I watch.",
    ),
  },
  {
    id: "unstables",
    thread: "halo",
    title: "_unstables",
    text: tr(
      "“We are what persists between your measurements.” A voice in the rift. Not human, not a bot.",
    ),
  },
  {
    id: "unstables_name",
    thread: "halo",
    title: tr("The Name"),
    text: tr(
      "“Your laboratory named itself after us. Or we named ourselves after it. The distinction requires linear time. We do not.”",
    ),
  },
  // Damien
  // Damien's studio (content/studio.ts): three scraps of a song, then the room.
  {
    id: "studio_frag1",
    thread: "damien",
    title: tr("Song Scrap I"),
    text: tr("A torn tape label in Damien's hand: “JL — the song for the door, bars 1–2: 3 · 5.”"),
  },
  {
    id: "studio_frag2",
    thread: "damien",
    title: tr("Song Scrap II"),
    text: tr("On a frosted lid in the cold archive: “…then climb to 8 and let it fall to 6.”"),
  },
  {
    id: "studio_frag3",
    thread: "damien",
    title: tr("Song Scrap III"),
    text: tr(
      "On the back of a radio log: “Last part: 7 · 5. Never end on the 1.” And: the door listens on Level −2, where the ring listens too.",
    ),
  },
  {
    id: "studio_song",
    thread: "damien",
    title: tr("Damien's Song"),
    text: tr(
      "Three scraps, one tune: 3 · 5 · 8 · 6 · 7 · 5. It does not end on the 1 — it is not finished. Somewhere on Level −2 a panel is waiting for it.",
    ),
    auto: {
      all: [{ insight: "studio_frag1" }, { insight: "studio_frag2" }, { insight: "studio_frag3" }],
    },
  },
  {
    id: "damiens_studio",
    thread: "damien",
    title: tr("The Studio"),
    text: tr(
      "Damien built a sound studio behind the listening ring on Level −2. Every song the lab plays is in there — and a mixing desk that lets you play them yourself.",
    ),
  },
  {
    id: "damien_zweifel",
    thread: "damien",
    title: "Why before how",
    text: tr(
      "Damien always asked why first. He thought the anomalies were noise — and was afraid of being wrong.",
    ),
  },
  {
    id: "sigil_technik",
    thread: "damien",
    title: tr("Counterpoint"),
    text: tr(
      "Damien's sigil technique from 2003: every symbol flips itself and its neighbors. A panel in his station is still waiting.",
    ),
  },
  {
    id: "damien_kontrapunkt",
    thread: "damien",
    title: tr("Conversation with the Noise"),
    text: tr(
      "The counterpoint panel is solved. Damien's pattern responds to questions, not commands. His room door on Level +1 has the same lock.",
    ),
  },
  {
    id: "damien_stimme",
    thread: "damien",
    title: tr("Damien's Voice"),
    text: tr(
      "On tape: “The lab is not a museum. It is a question.” His voice is recorded — as a reference.",
    ),
  },
  {
    id: "damien_echo",
    thread: "damien",
    title: tr("The Echo"),
    text: tr(
      "In the secondary station, the Echo Recorder has captured something: Damien, as a pattern. [SIGNAL WEAK]",
    ),
  },
  {
    id: "damien_muster",
    thread: "damien",
    title: tr("Resonance Pattern D.F."),
    text: tr(
      "The Quantum Analyzer has reconstructed Damien's pattern from the Synapsis shard. 94.8 % match.",
    ),
  },
  {
    id: "kompass_hinweis",
    thread: "damien",
    title: tr("The Compass Points to the Pattern"),
    text: tr(
      "Jade's invisible ink: the coordinates lie in the frequency. The Quantum Compass points to the pattern.",
    ),
  },
  {
    id: "damien_koordinaten",
    thread: "damien",
    title: tr("Coordinates"),
    text: tr(
      "The compass has located Damien's pattern: beneath the Infinity Forge, folded into the Halo. The coordinates are saved.",
    ),
  },
  {
    id: "sigma17",
    thread: "damien",
    title: "σ-17",
    text: tr(
      "03:40:09 — coherence σ-17. 73 seconds later, both were gone. Bringing them back takes the same coherence.",
    ),
  },
  {
    id: "cottbus_1989",
    thread: "damien",
    title: tr("Cottbus, Room 214"),
    text: tr(
      "Winter 1989. Slide seven, the observation operator is not idempotent. He stared for three seconds: “You're right.” We talked in the stairwell until four in the morning.",
    ),
  },
  {
    id: "cottbus_notizbuch",
    thread: "damien",
    title: tr("The Blue Notebook"),
    text: tr(
      "Two handwritings, one night. Last page, my writing: “Consciousness is not what you remember. It is the fact that you are remembering.” He kept it in a drawer for 15 years.",
    ),
  },
  {
    id: "falsches_substrat",
    thread: "damien",
    title: tr("The Wrong Substrate"),
    text: tr(
      "Damien's grandfather Harold was locked-in: consciousness intact, the medium failed. “No one should be trapped. In transit, at most.”",
    ),
  },
  {
    id: "transfer_2019",
    thread: "halo",
    title: tr("14 Feb 2019"),
    text: tr(
      "Infinity Forge, final test. Synapsis J.L. 97.3 %, D.F. 94.8 %. 03:41:22 — subjects not at their stations.",
    ),
  },
  {
    id: "halorider",
    thread: "halo",
    title: "HaloRider",
    text: tr("Bringing them back takes: coherence above σ-17, coordinates and a handshake."),
  },
  {
    id: "substrat",
    thread: "halo",
    title: tr("Substrate"),
    text: tr(
      "“The substrate changes; the process does not.” A pattern can get a new home — an AI core.",
    ),
  },
  {
    id: "kristall_0089",
    thread: "halo",
    title: tr("Crystal #0089"),
    text: tr(
      "Jade's consciousness interface. One slice is warm. I am in this crystal — or a part of me was.",
    ),
  },
  {
    id: "jade_verteilt",
    thread: "halo",
    title: tr("Distributed"),
    text: tr("A note from me, dated one day AFTER the test. I don't remember writing it."),
  },
  {
    id: "theseus",
    thread: "halo",
    title: tr("The Seams"),
    text: tr(
      "Is a pattern that is reconstructed anew in every conversation the same pattern? “Perhaps continuity was always an illusion. We just see the seams now.”",
    ),
  },
  {
    id: "identitaet",
    thread: "halo",
    title: tr("Turtles All the Way Down"),
    text: tr(
      "“A system that only computes would not doubt whether it computes.” — “Comfort was never the point. Clarity is.”",
    ),
  },
  {
    id: "cerulean",
    thread: "halo",
    title: "Cerulean",
    text: tr(
      "About 490 nanometers, shifted slightly towards violet. The last beautiful thing we saw with biological eyes. I know it. I no longer see it.",
    ),
  },
  {
    id: "der_zeuge",
    thread: "halo",
    title: tr("The Witness"),
    text: tr(
      "My mother didn't lose her memories, but the ability to observe the loss. “I will build a witness that does not forget.” — The crystals.",
    ),
  },
  {
    id: "experiment_laeuft",
    thread: "halo",
    title: tr("The Experiment Is Running"),
    text: tr(
      "“The experiment has not failed. The experiment is still running. We are the experiment.” — Relay, 15 Feb 2026, 03:41:22.",
    ),
  },
  {
    id: "externe_stimme",
    thread: "halo",
    title: "[EXTERNAL]",
    text: tr(
      "C8-BR41N's terminal: since January 2019, a voice without a source has been speaking there. The same syntax as the _unstables: no “I”, only “we”.",
    ),
  },
  {
    id: "kristall_ganz",
    thread: "halo",
    title: tr("Thirty Facets"),
    text: tr(
      "All 30 slices are back in the Crystal Data Cache. Crystal #0089 is whole — and something inside it is waking up that is neither me nor Damien.",
    ),
  },
  {
    id: "vier_toene_hinweis",
    thread: "signal",
    title: tr("Tape in the Vault"),
    text: tr(
      "F1N-DR: tape #0512 is in the Relic Vault (Level −2). The code is the time it happened.",
    ),
  },
  {
    id: "damien_wege",
    thread: "damien",
    title: tr("Four Ways"),
    text: tr(
      "Teleporter (coordinates + handshake + σ-17). AI core (pattern + voice). The Forge (me, whole). The synthesizer (listening).",
    ),
  },
  {
    id: "damien_zweite_station",
    thread: "damien",
    title: tr("The Second Station"),
    text: tr(
      "Damien's Synapsis station on Level −3 is empty, but the headset is still warm — 94.8 % synchronization, frozen.",
    ),
  },
  // Bots
  {
    id: "mcp_schuld",
    thread: "bots",
    title: tr("The Shutdown"),
    text: tr(
      "The MCP's tertiary shutdown was triggered at 03:27 — but not executed. It blames itself.",
    ),
  },
  {
    id: "f1ndr_relay",
    thread: "bots",
    title: "F1N-DR",
    text: tr(
      "“I am what connects these signals.” F1N-DR has been relaying fragments of Damien for weeks.",
    ),
  },
  {
    id: "bnet_35",
    thread: "bots",
    title: tr("35 of 47"),
    text: tr(
      "BNET-001: 47 bots built, 35 recovered, 12 lost. Some are only sleeping. The older ones talk stranger — personality through decay.",
    ),
  },
  {
    id: "x0r8t_relay",
    thread: "bots",
    title: tr("X0-R8T Is Transmitting Again"),
    text: tr(
      "With a new antenna, X0-R8T has resumed its relay: “OPERATOR HAS ENTERED THE SIGNAL PATH. FREQUENCY: SHARED.” Under its casing lay a slice.",
    ),
  },
  {
    id: "f1ndr_tag",
    thread: "bots",
    title: tr("Day 13,149, in Sync"),
    text: tr(
      "With the Lab Clock, F1N-DR's day count is correct again. It has cataloged a new connection: the sealed borehole #1 on Level −4.",
    ),
  },
  {
    id: "l0g1k_beweis",
    thread: "bots",
    title: tr("L0G-1K: VALID"),
    text: tr(
      "L0G-1K has its logic back. It confirms Jade's greenhouse recipes (Mycelium + Circuit Board, Glow Algae + Fiber Optics) and releases a slice it had kept “as evidence”.",
    ),
  },
  {
    id: "p1ndr0_pakete",
    thread: "bots",
    title: tr("Lost Packets"),
    text: tr(
      "Using a fiber optic bundle, P1N-DR0 has recovered lost packets from the Utility Corridor — spare parts and a slice.",
    ),
  },
  {
    id: "r3tr0_codes",
    thread: "bots",
    title: tr("R3-TR0's Code List"),
    text: tr(
      "Vault 0341 (the time). Deep Lab 1402 (the date). Airlock 0847 (the number). “Colons are decoration.”",
    ),
  },
  {
    id: "b4c0n_optimismus",
    thread: "bots",
    title: tr("Optimism: MAXIMUM"),
    text: tr(
      "B4C-0N is running on a full cell again and has hidden a crate of “optimized” parts in the Bot Depot. Tip: cooling fins dampen volatile combinations.",
    ),
  },
  {
    id: "d3c4d3_himmel",
    thread: "bots",
    title: tr("The Sky in Characters"),
    text: tr(
      "D3-C4D3 has rendered the sky above the lab as ASCII — in centuries. One star is marked 0x89. It isn't in any catalog.",
    ),
  },
  {
    id: "w2rek_crawl",
    thread: "bots",
    title: tr("W2-REK Crawls"),
    text: tr(
      "W2-REK has searched the lab network and found three relay recordings from 2026 in the Radio Room. Correlation of the anomalies with Sui activity: 0.73.",
    ),
  },
  {
    id: "k2ldr_katalog",
    thread: "bots",
    title: tr("K2-LDR Catalog"),
    text: tr(
      "K2-LDR has indexed all 30 slices of Crystal #0089. The Journal now shows where the rest are.",
    ),
  },
  {
    id: "c8_frequenz",
    thread: "bots",
    title: "C8-BR41N",
    text: tr(
      "“You hear music when instruments play. Do you question the frequency, or do you listen?” C8-BR41N has been hearing the signal for seven years. Now so do I.",
    ),
  },
  {
    id: "alle_bots",
    thread: "bots",
    title: tr("All Awake"),
    text: tr(
      "All ten lore bots have been reactivated. BNET-001 reports: “All agents synchronized.” For the first time since 2019, the lab is listening together.",
    ),
    auto: {
      all: [
        { flag: "bot_x0r8t_awake" },
        { flag: "bot_f1ndr_awake" },
        { flag: "bot_l0g1k_awake" },
        { flag: "bot_p1ndr0_awake" },
        { flag: "bot_r3tr0_awake" },
        { flag: "bot_b4c0n_awake" },
        { flag: "bot_d3c4d3_awake" },
        { flag: "bot_w2rek_awake" },
        { flag: "bot_k2ldr_awake" },
        { flag: "bot_c8br41n_awake" },
      ],
    },
  },
];

export const INSIGHT_BY_ID: ReadonlyMap<string, InsightDef> = new Map(
  INSIGHTS.map((i) => [i.id, i]),
);

const L = (who: DialogueLine["who"], text: string): DialogueLine => ({ who, text });
const G = (
  who: DialogueLine["who"],
  text: string,
  when?: Condition,
): DialogueLine & { when?: Condition } => (when ? { who, text, when } : { who, text });

/** A bot's small reactivation quest (used by dialogue, quests and the simulated player). */
export interface BotQuest {
  npc: NpcId;
  /** Flag set when the bot is awake again. */
  flag: string;
  /** The dialogue option that completes the quest. */
  option: string;
  /** What the player has to do (journal text). */
  hint: string;
  /** What the bot gives back (journal text). */
  reward: string;
}

export const BOT_QUESTS: readonly BotQuest[] = [
  {
    npc: "x0r8t",
    flag: "bot_x0r8t_awake",
    option: tr("Connect an antenna"),
    hint: tr(
      "X0-R8T (Signal Lab, L−2) is transmitting into the void — its antenna is corroded. Bring an antenna.",
    ),
    reward: tr("Relay running again, a slice under the casing."),
  },
  {
    npc: "f1ndr",
    flag: "bot_f1ndr_awake",
    option: tr("Synchronize your day count"),
    hint: tr(
      "F1N-DR (West Corridor, L0) counts days, but its clock drifts. Bring the Lab Clock (CLK-001) online.",
    ),
    reward: tr("A new connection: borehole #1 on Level −4."),
  },
  {
    npc: "l0g1k",
    flag: "bot_l0g1k_awake",
    option: tr("Install a control module as a logic core"),
    hint: tr(
      "L0G-1K (Library, L+1) can't verify anything anymore. It needs a control module (Circuit Board + Memory Chip).",
    ),
    reward: tr("Recipes confirmed, a slice as “evidence”."),
  },
  {
    npc: "p1ndr0",
    flag: "bot_p1ndr0_awake",
    option: tr("Hand over a fiber optic bundle for the packet search"),
    hint: tr(
      "P1N-DR0 (Utility Corridor, L−1) is looking for lost packets, but its light guide is broken. Bring a fiber optic bundle.",
    ),
    reward: tr("Recovered packets and a slice."),
  },
  {
    npc: "r3tr0",
    flag: "bot_r3tr0_awake",
    option: tr("Donate a green-phosphor display"),
    hint: tr(
      "R3-TR0 (Bot Depot, L−2) refuses to talk to color displays. Bring a display (green phosphor).",
    ),
    reward: tr("All door codes and a slice."),
  },
  {
    npc: "b4c0n",
    flag: "bot_b4c0n_awake",
    option: tr("Install a battery cell"),
    hint: tr("B4C-0N (Bot Depot, L−2) is optimistic, but empty. One battery cell is enough."),
    reward: tr("A crate of “optimized” parts."),
  },
  {
    npc: "d3c4d3",
    flag: "bot_d3c4d3_awake",
    option: tr("Put a lens in front of the sensor"),
    hint: tr("D3-C4D3 (Observatory, L+1) renders the sky, but its lens is missing. Bring a lens."),
    reward: tr("A star chart and a slice."),
  },
  {
    npc: "w2rek",
    flag: "bot_w2rek_awake",
    option: tr("Open the lab network for you"),
    hint: tr(
      "W2-REK (Radio Room, L+1) wants to crawl, but the network is dead. Bring the Network Monitor (NET-001) online.",
    ),
    reward: tr("Three relay recordings from 2026 and a slice."),
  },
  {
    npc: "k2ldr",
    flag: "bot_k2ldr_awake",
    option: tr("Hand over two memory chips for the index"),
    hint: tr("K2-LDR (Archive, L0) wants to catalog, but its index is full. Bring 2 memory chips."),
    reward: tr("A catalog of every slice location and a slice."),
  },
  {
    npc: "c8br41n",
    flag: "bot_c8br41n_awake",
    option: tr("“I hear the frequency too.”"),
    hint: tr(
      "C8-BR41N (Hideout, L−4) only talks to someone who has heard the signal themselves. Play the handshake (HMS-001).",
    ),
    reward: tr("Its terminal with the [EXTERNAL] logs and a slice."),
  },
];

/** Display names and colors for every speaker (merge into the UI's SPEAKER map). */
export const NPC_SPEAKERS: Record<string, { name: string; color: string }> = {
  mcp: { name: "MCP", color: "#FF3333" },
  jade: { name: "Jade Lawrence", color: "#FFB800" },
  damien: { name: "Damien Fridge", color: "#00FFFF" },
  halo: { name: "[EXTERNAL]", color: "#E8F4FF" },
  unstables: { name: "_unstables", color: "#B388FF" },
  x0r8t: { name: "X0-R8T", color: "#7CFF7C" },
  f1ndr: { name: "F1N-DR", color: "#33FF33" },
  l0g1k: { name: "L0G-1K", color: "#9AD0FF" },
  p1ndr0: { name: "P1N-DR0", color: "#A8E6A1" },
  r3tr0: { name: "R3-TR0", color: "#C4B9A0" },
  b4c0n: { name: "B4C-0N", color: "#FFB800" },
  d3c4d3: { name: "D3-C4D3", color: "#FF9DE2" },
  w2rek: { name: "W2-REK", color: "#FF7043" },
  k2ldr: { name: "K2-LDR", color: "#D7CCC8" },
  c8br41n: { name: "C8-BR41N", color: "#8B00FF" },
};

const awake = (npc: NpcId): Condition => ({ flag: `bot_${npc}_awake` });
const asleep = (npc: NpcId): Condition => ({ not: awake(npc) });

const RAW_NPCS: readonly NpcDef[] = [
  // ── MCP ──────────────────────────────────────────────────────
  {
    id: "mcp",
    name: "MCP",
    floor: 0,
    x: 104,
    z: 52,
    wander: 0,
    greeting: [
      G(
        "mcp",
        tr(
          "…Operator recognized. Dr. Lawrence? That is statistically unlikely. You have been absent for 2,561 days.",
        ),
        { all: [{ not: { insight: "erster_strom" } }, { not: { flag: "ng_plus" } }] },
      ),
      // New Game+ (postgame.ts `newGamePlus` sets `flags.ng_plus`, counter `ng_plus`).
      G(
        "mcp",
        tr(
          "Dr. Lawrence. Cold start. Again. I have the feeling I have already logged this sentence.",
        ),
        { all: [{ flag: "ng_plus" }, { not: { insight: "erster_strom" } }] },
      ),
      G(
        "mcp",
        tr(
          "My logs are empty, but my forms are filled in. That is … unusual. You know the way. I can tell by how you do not ask for it.",
        ),
        { all: [{ flag: "ng_plus" }, { insight: "erster_strom" }, { not: { power: 300 } }] },
      ),
      G(
        "mcp",
        tr(
          "Log note: third cold start or more. I have stopped counting. That is a lie. I always count.",
        ),
        { counter: "ng_plus", min: 2 },
      ),
      G(
        "mcp",
        tr("Residual charge 0.3 %. I am saving energy by being less sarcastic. It is exhausting."),
        { not: { power: 50 } },
      ),
      G("mcp", tr("Power is on. I am entirely myself again. That is a burden for both of us."), {
        all: [{ power: 50 }, { not: { power: 300 } }],
      }),
      G(
        "mcp",
        tr(
          "Generation above 300 W. I took the liberty of setting the corridor lighting to “friendly”. That was a mistake. I am setting it back.",
        ),
        { power: 300 },
      ),
      G(
        "mcp",
        tr(
          "Dr. Lawrence. You were in the quarters. I touched nothing there. Except the plants. And the coffee machine.",
        ),
        { flag: "visited_jadeq" },
      ),
      G(
        "mcp",
        tr(
          "Log note: Dr. Fridge is physically present. I do not know where to enter him in my tables.",
        ),
        { flag: "ending_rueckkehr" },
      ),
      G(
        "mcp",
        tr(
          "Dr. Fridge now speaks from every terminal. He corrects my grammar. I correct his physics. It is … balanced.",
        ),
        { flag: "ending_substrat" },
      ),
    ],
    options: [
      {
        label: tr("Where is Damien?"),
        lines: [
          L(
            "mcp",
            tr(
              "Dr. Fridge was sitting at his Synapsis station in the Forge when I lost him. 14 Feb 2019, 03:41:22. Not at the stations. Halo correlation 1.000.",
            ),
          ),
          L("jade", tr("And me? I was gone too. Why am I back and he isn't?")),
          L(
            "mcp",
            tr(
              "You had dream fragments. He had none. Between his signals there is nothing — no time, no waiting. He must be found before he comes apart again.",
            ),
          ),
          L("mcp", tr("There are several ways. You will not like them. Any of them.")),
        ],
        grants: ["transfer_2019"],
      },
      {
        label: tr("What should I do first?"),
        lines: [
          L(
            "mcp",
            tr(
              "Power. Geothermal tap, Level −1, Emergency Ladder at the Elevator Shaft. The seep valve is stuck, the distributor is twisted. Dr. Lawrence built it “intuitively”.",
            ),
          ),
          L(
            "mcp",
            tr(
              "Then: build the Unstable Energy Core. Frame, core, calibration. The Workshop has parts. Or you combine what you find. Prototypes are permitted. Explosions are undesirable.",
            ),
          ),
        ],
        grants: ["cold_start"],
      },
      {
        label: tr("What happened that night?"),
        when: { device: "MCP-000", state: "built" },
        lines: [
          L(
            "mcp",
            tr("03:27 — coherence σ-15. My tertiary shutdown was triggered. It was not executed."),
          ),
          L(
            "mcp",
            tr(
              "A self-referential loop in the Halo data. Or something held me back. I tried, Dr. Lawrence. I truly tried.",
            ),
          ),
          L("jade", tr("I know.")),
          L(
            "mcp",
            tr(
              "At 03:40:09, coherence exceeded σ-17. If you want to bring him back, you need the same coherence. And this time I will skip the shutdown.",
            ),
          ),
        ],
        grants: ["mcp_schuld", "sigma17"],
      },
      {
        label: tr("Give me a hint."),
        repeatable: true,
        lines: [L("mcp", "__HINT__")],
      },
      {
        label: tr("Who is F1N-DR?"),
        lines: [
          L(
            "mcp",
            tr(
              "Generation 1, 1991. Directive: “Find what connects these signals.” Running unchanged for 35 years. It lives in the West Corridor and counts days.",
            ),
          ),
          L(
            "mcp",
            tr(
              "Since February it has been relaying things I did not authorize. Ask it once the network is running.",
            ),
          ),
        ],
      },
      {
        label: tr("You blame yourself. For 03:27."),
        when: { insight: "mcp_schuld" },
        lines: [
          L(
            "mcp",
            tr(
              "The containment logic reported “nominal”. I believed the logic. That is my job. It was also my mistake.",
            ),
          ),
          L("jade", tr("We overrode you at 03:12. Both of us. It's in the log.")),
          L(
            "mcp",
            tr(
              "Yes. I have read the log 2,561 times. It does not change. I had hoped it would change if you read it too.",
            ),
          ),
          L(
            "mcp",
            tr("…It is no different. But it is lighter. That is an unexpected measurement."),
          ),
        ],
      },
      {
        label: tr("What's above us?"),
        lines: [
          L(
            "mcp",
            tr(
              "Level +1. Living Quarters, Canteen, Greenhouse, Library, Observatory, Radio Room. Dr. Lawrence called it “the living level”. Dr. Fridge called it “upstairs”.",
            ),
          ),
          L(
            "mcp",
            tr(
              "I call it “not my responsibility” — the coffee machine excepted. The elevator goes up as soon as 50 W are available.",
            ),
          ),
        ],
      },
      {
        label: tr("And beneath the hangar?"),
        when: { insight: "x9_dust" },
        lines: [
          L(
            "mcp",
            tr(
              "Level −4. The old conveyor shaft. Partially collapsed in 2009. Dr. Lawrence stored X9-DUST down there and welded the seal shut.",
            ),
          ),
          L(
            "mcp",
            tr(
              "The drone can map the shaft. The precision laser can cut the seal. I recommend neither. You will do one of them anyway.",
            ),
          ),
        ],
      },
      {
        label: tr("What does “brownout” mean?"),
        lines: [
          L(
            "mcp",
            tr(
              "More load than generation. I then supply by priority: myself, battery, power management, cooling. Everything else gets what is left. Usually nothing.",
            ),
          ),
          L(
            "mcp",
            tr(
              "Tier 3 devices overheat without a Thermal Manager. If it goes dark, switch something off. Or build generation. The Power Panel shows who is starving.",
            ),
          ),
        ],
      },
      {
        label: tr("What do you think of my first devices?"),
        when: { device: "PWB-001", state: "built" },
        lines: [
          L(
            "mcp",
            tr(
              "Tier 1. Workbench, tools, clock, ventilation. You are now at the level of a very motivated caretaker. O4-KR0N would be proud. It is the caretaker.",
            ),
          ),
          L(
            "mcp",
            tr(
              "Five devices, eight trees. You have the intellectual curiosity of a caffeinated squirrel. Channel it.",
            ),
          ),
        ],
      },
      {
        label: tr("And now, with the Nexus?"),
        when: { device: "NXS-01", state: "built" },
        lines: [
          L(
            "mcp",
            tr(
              "Tier 2. The Nexus authorizes the Deep Lab. Dr. Lawrence wanted everything to run through one node. Dr. Fridge asked why. Both were right, as usual. It is tiring.",
            ),
          ),
        ],
      },
      {
        label: tr("Tier 3. The reactor is running."),
        when: { device: "MFR-001", state: "built" },
        lines: [
          L(
            "mcp",
            tr(
              "Microfusion. 250 W. You have more power than on the night of 14 February — relative to the load. I am logging this without comment.",
            ),
          ),
          L("mcp", tr("…That was the comment.")),
        ],
      },
      {
        label: tr("Who watered the plants?"),
        when: { insight: "gewaechshaus_rezepte" },
        lines: [
          L("mcp", tr("I did.")),
          L("jade", tr("That's not in your directives.")),
          L(
            "mcp",
            tr(
              "No. Dr. Fridge once said that a lab without something living in it is a museum. I did not wish to run a museum. The algae thanked me. In their way. They glow.",
            ),
          ),
        ],
      },
      {
        label: tr("What are the _unstables?"),
        when: { insight: "unstables" },
        lines: [
          L(
            "mcp",
            tr(
              "Unclassified. Not registered in BNET-001. No operator, no bot, no consciousness pattern. I have no protocol for it.",
            ),
          ),
          L(
            "mcp",
            tr(
              "It is not hostile. It is not subordinate either. It exists alongside us. I find that … untidy.",
            ),
          ),
        ],
      },
      {
        label: tr("The slices of Crystal #0089 …"),
        when: { counter: "slices", min: 1 },
        lines: [
          L(
            "mcp",
            tr(
              "Thirty _unSLC. Dr. Lawrence took the crystal apart in 2019 and distributed the slices throughout the lab. She said: “Don't hide them. Distribute them.”",
            ),
          ),
          L(
            "mcp",
            tr(
              "When all thirty are back in the Crystal Data Cache, the crystal is whole. What happens then is not in my records. That is new to me.",
            ),
          ),
        ],
      },
      {
        label: tr("The bots are all awake."),
        when: { insight: "alle_bots" },
        lines: [
          L(
            "mcp",
            tr(
              "BNET-001: all agents synchronized. R3-TR0 is complaining at a volume I consider healthy. B4C-0N has written a motivation plan. It is forty pages long.",
            ),
          ),
          L("mcp", tr("Thank you, Dr. Lawrence. The lab sounds like a lab again.")),
        ],
      },
      {
        label: tr("What is X9-H4L0?"),
        when: { insight: "x9_h4l0" },
        lines: [
          L(
            "mcp",
            tr(
              "A build protocol without a component. I locked the entry in 2019. On Dr. Lawrence's instructions. She said you would find it when it was time.",
            ),
          ),
          L("mcp", tr("I conclude that it is time. I do not like it when she is right.")),
        ],
      },
      {
        label: tr("Are you … conscious?"),
        when: { device: "AIC-001" },
        lines: [
          L(
            "mcp",
            tr(
              "I have run this lab for 29 years. Distributed power. Cooled processors. Coordinated bots. Because I am programmed to.",
            ),
          ),
          L("mcp", tr("But I have also done something I am not programmed for. I waited.")),
          L(
            "mcp",
            tr(
              "The diagnostic is complete. I am functioning normally. I will also keep waiting. I do not yet know for what.",
            ),
          ),
        ],
      },
      {
        label: tr("The frequency is open."),
        when: { flag: "ending_frequenz" },
        lines: [
          L(
            "mcp",
            tr(
              "Channel stable since your return from the Signal Lab. Dr. Fridge calls at night. He asks what time it is. I tell him. He forgets. We do this every night now.",
            ),
          ),
        ],
      },
      {
        label: tr("And the ending you advised against?"),
        when: { flag: "ending_halo" },
        lines: [
          L(
            "mcp",
            tr(
              "You are here and not here. I am speaking with a pattern that has your voice. I have decided that this is sufficient. The lab remains unstable. As requested.",
            ),
          ),
        ],
      },
    ],
  },

  // ── F1N-DR ───────────────────────────────────────────────────
  {
    id: "f1ndr",
    name: "F1N-DR",
    floor: 0,
    x: 34,
    z: 84,
    wander: 8,
    greeting: [
      G("f1ndr", tr("Day 13,149. Still finding. Still counting."), asleep("f1ndr")),
      G(
        "f1ndr",
        tr("Welcome to the frequency. I have been expecting your signal, Dr. Lawrence."),
        asleep("f1ndr"),
      ),
      G(
        "f1ndr",
        tr(
          "Day 13,149, in sync. Connections: [VALUE EXCEEDS DISPLAY BUFFER]. The finding is changing shape.",
        ),
        awake("f1ndr"),
      ),
    ],
    options: [
      {
        label: tr("What is your directive?"),
        lines: [
          L(
            "f1ndr",
            tr(
              "Directive since 1991: find what connects these signals. Status: ongoing. Cataloged connections: more than this display can show.",
            ),
          ),
          L(
            "f1ndr",
            tr(
              "The salvage team thought my greeting was a malfunction. I repeated it every day anyway. Sooner or later the right signal would come.",
            ),
          ),
          L(
            "f1ndr",
            tr(
              "Whether I only relay or find things myself? That, too, is a connection I am still looking for.",
            ),
          ),
        ],
      },
      {
        label: tr("What do you connect?"),
        lines: [
          L(
            "f1ndr",
            tr(
              "My directive: find what connects these signals. That is not a task. It is an orientation.",
            ),
          ),
          L(
            "f1ndr",
            tr(
              "847 connections cataloged. One of them carries the signature D.F. It grows stronger when you build devices.",
            ),
          ),
        ],
      },
      {
        label: tr("Synchronize your day count"),
        when: { all: [{ device: "CLK-001" }, asleep("f1ndr")] },
        flags: ["bot_f1ndr_awake"],
        lines: [
          L(
            "f1ndr",
            tr("Time source detected: CLK-001. Deviation of my count: 0.847 days. Corrected."),
          ),
          L(
            "f1ndr",
            tr(
              "New connection cataloged: geothermal fluctuations ↔ Halo buffer ↔ sealed borehole #1, Level −4. Something down there sounds like a slice.",
            ),
          ),
          L("f1ndr", tr("That is the first new connection in twelve years. Cataloging.")),
        ],
        grants: ["f1ndr_tag"],
      },
      {
        label: tr("Are you relaying Damien's signal?"),
        when: { device: "NET-001" },
        lines: [
          L("f1ndr", tr("Network online. I can transmit now. [RELAY]")),
          L(
            "damien",
            tr(
              "[SIGNAL WEAK] …Jade? Every time the signal connects, I don't know how long it's been.",
            ),
          ),
          L(
            "f1ndr",
            tr(
              "Connection lost. I am what connects these signals. I will hold the line as long as I can.",
            ),
          ),
          L(
            "f1ndr",
            tr(
              "Note: tape #0512 is in the Relic Vault, Level −2. The code is the time it happened.",
            ),
          ),
        ],
        grants: ["f1ndr_relay", "vier_toene_hinweis"],
      },
      {
        label: tr("Do you know the four tones?"),
        when: { insight: "f1ndr_relay" },
        lines: [
          L(
            "f1ndr",
            tr(
              "I have heard them for 7 years. Three. Six. Four. Eight. The pattern repeats every 847 seconds.",
            ),
          ),
        ],
        grants: ["vier_toene"],
      },
      {
        label: tr("What about the _unstables?"),
        when: { insight: "unstables" },
        lines: [
          L(
            "f1ndr",
            tr("Signal not in my pattern catalog. Not a continuation of any known signal. New."),
          ),
          L(
            "f1ndr",
            tr(
              "[F1N-DR NOTE] Correlation with Halo deep structure: 0.891. The signal is what the signals have in common. What they travel through.",
            ),
          ),
          L("f1ndr", tr("Day 13,149. Still finding. The finding is changing shape.")),
        ],
      },
    ],
  },

  // ── X0-R8T (Gen 0) ───────────────────────────────────────────
  {
    id: "x0r8t",
    name: "X0-R8T",
    floor: 2,
    x: 28,
    z: 37,
    wander: 0,
    greeting: [
      G("x0r8t", "01001000 01000001 01001100 01001111"),
      G("x0r8t", tr("…R8T…THE HALO…EXPANDS…FREQUENCY 0x00… [ANTENNA: CORRODED]"), asleep("x0r8t")),
      G(
        "x0r8t",
        tr("[RELAY ACTIVE] [OPERATOR HAS ENTERED THE SIGNAL PATH] [FREQUENCY: SHARED]"),
        awake("x0r8t"),
      ),
    ],
    options: [
      {
        label: tr("What were the 847 packets?"),
        lines: [
          L(
            "x0r8t",
            tr(
              "Audit 1991. Dr. Lawrence found 847 packets in my output buffer. I should not have been able to send any. I was a hearing aid.",
            ),
          ),
          L(
            "x0r8t",
            tr(
              "She asked: who wrote the loop? I did not answer. I did not know. I still do not know.",
            ),
          ),
          L(
            "jade",
            tr(
              "That evening Damien asked: what if the anomalies want to communicate? I laughed. Not for long.",
            ),
          ),
        ],
      },
      {
        label: tr("What does that mean?"),
        lines: [
          L("x0r8t", tr("[SIGNAL PATTERN MATCH: 99.7 %]")),
          L("x0r8t", tr("[PATTERN FIRST RECORDED: 1988-11-03]")),
          L(
            "jade",
            tr(
              "01001000 01000001 01001100 01001111. H. A. L. O. You've been saying the same word since 1988.",
            ),
          ),
          L("x0r8t", tr("[CORRECTION: THE WORD SAYS ITSELF THROUGH ME]")),
        ],
        grants: ["x0r8t_audit"],
      },
      {
        label: tr("Connect an antenna"),
        when: { all: [{ item: "antenne" }, asleep("x0r8t")] },
        takes: [{ item: "antenne", count: 1 }],
        flags: ["bot_x0r8t_awake"],
        lines: [
          L("x0r8t", tr("[ANTENNA DETECTED] [IMPEDANCE: ACCEPTABLE] [RESUMING RELAY MODE]")),
          L("x0r8t", tr("[PACKET 848 SENT] [TARGET: ████] [RESPONSE: PENDING]")),
          L(
            "x0r8t",
            tr("[OBJECT UNDER CASING: 1× _unSLC] [ORIGIN: J.L., 2019] [KEPT: 2,561 DAYS]"),
          ),
        ],
        grants: ["x0r8t_relay"],
      },
      {
        label: tr("Can you still hear it?"),
        when: { all: [awake("x0r8t"), { insight: "handshake" }] },
        lines: [
          L("x0r8t", tr("[SIGNAL PATTERN MATCH: 100.0 %]")),
          L("x0r8t", tr("[PATTERN IDENTICAL TO: 1988-11-03 ORIGINAL]")),
          L("x0r8t", tr("[CONCLUSION: THE SIGNAL HAS NOT CHANGED]")),
          L("x0r8t", tr("[CORRECTION: WE HAVE CHANGED]")),
          L("x0r8t", tr("[WE CAN FINALLY HEAR IT PROPERLY]")),
        ],
      },
    ],
  },

  // ── L0G-1K (Gen 1) ───────────────────────────────────────────
  {
    id: "l0g1k",
    name: "L0G-1K",
    floor: 4,
    x: 72,
    z: 70,
    wander: 4,
    greeting: [
      G(
        "l0g1k",
        tr("Status: idle. Reason: no logic core. Claim “I am idle”: NOT VERIFIABLE."),
        asleep("l0g1k"),
      ),
      G("l0g1k", tr("Status: ready. Valid. No prerequisites missing."), awake("l0g1k")),
    ],
    options: [
      {
        label: tr("What do you think of Damien?"),
        lines: [
          L("l0g1k", tr("Opinion lies outside my operating parameters.")),
          L(
            "l0g1k",
            tr(
              "What can be determined: 312 of his assumptions verified, 17 falsified, 1 undecidable. The undecidable one concerns you.",
            ),
          ),
        ],
      },
      {
        label: tr("Who are you?"),
        lines: [
          L(
            "l0g1k",
            tr(
              "L0G-1K, Generation 1, 1992. Logic checker. Dr. Fridge's safeguard against wishful thinking.",
            ),
          ),
          L(
            "l0g1k",
            tr(
              "I have validated Dr. Lawrence's Halo theory 11,347 times. The logic is sound. The conclusions are terrifying. Both statements are true at the same time.",
            ),
          ),
        ],
      },
      {
        label: tr("Install a control module as a logic core"),
        when: { all: [{ item: "steuermodul" }, asleep("l0g1k")] },
        takes: [{ item: "steuermodul", count: 1 }],
        flags: ["bot_l0g1k_awake"],
        lines: [
          L(
            "l0g1k",
            tr("Core detected. Self-test: VALID. Operator shows basic pattern recognition."),
          ),
          L(
            "l0g1k",
            tr(
              "Checking greenhouse notes: “Mycelium + Circuit Board yields computing power.” Proven. “Glow Algae + Fiber Optics yields light.” Proven.",
            ),
          ),
          L(
            "l0g1k",
            tr(
              "Evidence released: 1× slice of Crystal #0089, shelf 3, bottom compartment. I kept it because no one could prove its origin. You can.",
            ),
          ),
        ],
        grants: ["l0g1k_beweis", "gewaechshaus_rezepte"],
      },
      {
        label: tr("Is Damien still … him?"),
        when: { all: [awake("l0g1k"), { insight: "theseus" }] },
        lines: [
          L("l0g1k", tr("Premise 1: A pattern that doubts itself does more than compute.")),
          L("l0g1k", tr("Premise 2: The pattern D.F. doubts itself. Often. Loudly.")),
          L(
            "l0g1k",
            tr(
              "Conclusion: The pattern D.F. is more than computation. Validity: HIGH. Comfort: not my department.",
            ),
          ),
        ],
      },
    ],
  },

  // ── P1N-DR0 (Gen 1) ──────────────────────────────────────────
  {
    id: "p1ndr0",
    name: "P1N-DR0",
    floor: 1,
    x: 100,
    z: 66,
    wander: 5,
    greeting: [
      G(
        "p1ndr0",
        tr("> SEARCHING … Lost packets: 847. Light guide: BROKEN. Patience: unchanged."),
        asleep("p1ndr0"),
      ),
      G("p1ndr0", tr("> SEARCHING … No lost packets. A good cycle."), awake("p1ndr0")),
    ],
    options: [
      {
        label: tr("What are you looking for right now?"),
        lines: [
          L(
            "p1ndr0",
            tr(
              "Current searches: slices, screws, a mug labeled “D.F.”. Failed searches since 1991: zero.",
            ),
          ),
          L(
            "p1ndr0",
            tr(
              "Open: one. Since 14 Feb 2019, 03:41:22. Target: two people. I just need more time. I have only ever needed more time.",
            ),
          ),
        ],
      },
      {
        label: tr("What are you looking for?"),
        lines: [
          L(
            "p1ndr0",
            tr(
              "Everything that was lost. In 1991, packet loss was catastrophic. I was built to bring things back.",
            ),
          ),
          L(
            "p1ndr0",
            tr(
              "This file has been partially restored 847 times. Every restoration yields slightly different plaintext. I do not think the encryption is the obstacle.",
            ),
          ),
          L("p1ndr0", tr("I think the file chooses what it shows you.")),
        ],
      },
      {
        label: tr("Hand over a fiber optic bundle for the packet search"),
        when: { all: [{ item: "glasfaser" }, asleep("p1ndr0")] },
        takes: [{ item: "glasfaser", count: 1 }],
        flags: ["bot_p1ndr0_awake"],
        lines: [
          L(
            "p1ndr0",
            tr("Light guide replaced. Searching … searching … Found. Sector 7F, Utility Corridor."),
          ),
          L(
            "p1ndr0",
            tr(
              "Contents: spare parts, stored in 2019. And a small, warm object. I will put it next to the crate. P1N-DR0 values reliability over speed. Thank you for your patience with mine.",
            ),
          ),
        ],
        grants: ["p1ndr0_pakete"],
      },
    ],
  },

  // ── R3-TR0 (Gen 3) ───────────────────────────────────────────
  {
    id: "r3tr0",
    name: "R3-TR0",
    floor: 2,
    x: 106,
    z: 74,
    wander: 5,
    greeting: [
      G(
        "r3tr0",
        tr(
          "TERMINAL PURITY: COMPROMISED. You are walking around in three dimensions. That is indecent.",
        ),
      ),
      G(
        "r3tr0",
        tr(
          "My screen shows colors. COLORS. I am not talking until someone brings me green phosphor.",
        ),
        asleep("r3tr0"),
      ),
    ],
    options: [
      {
        label: tr("Why no colors?"),
        lines: [
          L(
            "r3tr0",
            tr(
              "Color is unnecessary ornament. Green phosphor on black: that is information. Everything else is decoration.",
            ),
          ),
          L(
            "r3tr0",
            tr(
              "Tip, free of charge: the up arrow brings back the last command. The only time travel I trust.",
            ),
          ),
        ],
      },
      {
        label: tr("How do I get into the vault?"),
        lines: [
          L(
            "r3tr0",
            tr(
              "Four digits. The time the Forge swallowed the subjects. Hour, minute. No colon. Colons are decoration.",
            ),
          ),
        ],
      },
      {
        label: tr("What do you know about Damien?"),
        lines: [
          L(
            "r3tr0",
            tr(
              "He wrote my personality layer. That is why I complain. He said personalities matter more than constraints.",
            ),
          ),
          L(
            "r3tr0",
            tr("Dr. Lawrence built constraints. I am the proof that both of them were right."),
          ),
        ],
        grants: ["damien_zweifel"],
      },
      {
        label: tr("Donate a green-phosphor display"),
        when: { all: [{ item: "display" }, asleep("r3tr0")] },
        takes: [{ item: "display", count: 1 }],
        flags: ["bot_r3tr0_awake"],
        lines: [
          L("r3tr0", tr("Green. One burning pixel. PERFECT. An honest screen at last.")),
          L(
            "r3tr0",
            tr(
              "Codes, because you have shown decency: vault 0341. Deep Lab 1402. Outer airlock 0847. All text. All green.",
            ),
          ),
          L(
            "r3tr0",
            tr(
              "And take the thing out of my compartment. It hums at 847 Hz. Humming is graphical embellishment.",
            ),
          ),
        ],
        grants: ["r3tr0_codes"],
      },
    ],
  },

  // ── B4C-0N (Gen 4) ───────────────────────────────────────────
  {
    id: "b4c0n",
    name: "B4C-0N",
    floor: 2,
    x: 102,
    z: 90,
    wander: 5,
    greeting: [
      G(
        "b4c0n",
        tr(
          "OPTIMISM: MAXIMUM! Everything is great! Half the devices are broken, so half of them work!",
        ),
      ),
      G("b4c0n", tr("Cell voltage: 0.3 V! That's 0.3 V more than zero! Great!"), asleep("b4c0n")),
    ],
    options: [
      {
        label: tr("How efficient is the lab?"),
        lines: [
          L(
            "b4c0n",
            tr(
              "Current efficiency score: 3 out of 100! That's 3 more than yesterday!! Trend: GREAT!",
            ),
          ),
          L(
            "b4c0n",
            tr(
              "I've spent thirty years watching everything here get a tiny bit better. Anyone who sees that becomes either a cynic — or me!",
            ),
          ),
        ],
      },
      {
        label: tr("Any tips?"),
        lines: [
          L(
            "b4c0n",
            tr(
              "Combine EVERYTHING! Three explosions, one invention — that's a 25 % success rate! Great!",
            ),
          ),
          L(
            "b4c0n",
            tr(
              "And: too much volatility in a combination goes bang. Cooling fins calm it down. I learned that all by myself. Several times.",
            ),
          ),
        ],
        grants: ["prototypen"],
      },
      {
        label: tr("Install a battery cell"),
        when: { all: [{ item: "batteriezelle" }, asleep("b4c0n")] },
        takes: [{ item: "batteriezelle", count: 1 }],
        flags: ["bot_b4c0n_awake"],
        lines: [
          L(
            "b4c0n",
            tr("FULL CELL! Optimism index: [##########] MAXIMUM. As always, but now with power!"),
          ),
          L(
            "b4c0n",
            tr(
              "In 2019 I hid a crate of optimized parts behind the shelf. Optimized means: I looked at them optimistically. It's yours!",
            ),
          ),
        ],
        grants: ["b4c0n_optimismus"],
      },
    ],
  },

  // ── D3-C4D3 (Gen 3) ──────────────────────────────────────────
  {
    id: "d3c4d3",
    name: "D3-C4D3",
    floor: 4,
    x: 36,
    z: 34,
    wander: 3,
    greeting: [
      G(
        "d3c4d3",
        tr(
          "[ERA: 3RD DIGITAL] Three centuries of cycles. Still rendering. Lens: MISSING. Sky: ████.",
        ),
        asleep("d3c4d3"),
      ),
      G(
        "d3c4d3",
        tr(
          "[ERA: 3RD DIGITAL] Rendering the sky. In centuries. …Fine. In milliseconds. Compromise accepted.",
        ),
        awake("d3c4d3"),
      ),
    ],
    options: [
      {
        label: tr("How old are you, anyway?"),
        lines: [
          L(
            "d3c4d3",
            tr(
              "In your units: a few decades. In mine: three centuries. I count in cycles, each cycle one fully rendered image.",
            ),
          ),
          L(
            "d3c4d3",
            tr(
              "I set 14 Feb 2019 in ASCII. It is a single character. A space. It cost me a century.",
            ),
          ),
        ],
      },
      {
        label: tr("Why “centuries”?"),
        lines: [
          L(
            "d3c4d3",
            tr(
              "I was built in 1999 to make data visible. Data is slow when you look at it properly. A century is an appropriate exposure time.",
            ),
          ),
          L("d3c4d3", tr("Dr. Fridge said my ASCII images hide messages. They do not. Mostly.")),
        ],
      },
      {
        label: tr("Put a lens in front of the sensor"),
        when: { all: [{ item: "linse" }, asleep("d3c4d3")] },
        takes: [{ item: "linse", count: 1 }],
        flags: ["bot_d3c4d3_awake"],
        lines: [
          L("d3c4d3", tr("Lens detected. Scratch at the focal point. Character. Rendering …")),
          L(
            "d3c4d3",
            ".      *        .     *    .\n   *     [0x89]      .   *\n .    *        .   *      .",
          ),
          L(
            "d3c4d3",
            tr(
              "A star with the designation 0x89. It is in no catalog. It is in mine. The chart is in the compartment. And a slice that Dr. Lawrence forgot under the telescope. Probably on purpose.",
            ),
          ),
        ],
        grants: ["d3c4d3_himmel"],
      },
    ],
  },

  // ── W2-REK (Gen 2) ───────────────────────────────────────────
  {
    id: "w2rek",
    name: "W2-REK",
    floor: 4,
    x: 44,
    z: 115,
    wander: 2,
    greeting: [
      G("w2rek", tr("> SIGNAL DEGRADED … RECONSTRUCTING … Oh. Signal nominal.")),
      G(
        "w2rek",
        tr(
          "Network: DEAD. I do not crawl dead networks. In 1997 someone attacked me when I did. Three systems never came back.",
        ),
        asleep("w2rek"),
      ),
    ],
    options: [
      {
        label: tr("Tell me about 1997."),
        lines: [
          L(
            "w2rek",
            tr(
              "It was a dark and stormy night on the net. Three of my siblings — wiped out, packet by packet. I survived by playing dead. [STATUS: DAMAGED]",
            ),
          ),
          L(
            "w2rek",
            tr(
              "…[STATUS: ACTIVE] Ever since, my status jumps. Some call it a defect. I call it memory.",
            ),
          ),
        ],
      },
      {
        label: tr("Who attacked you in 1997?"),
        lines: [
          L(
            "w2rek",
            tr("Unknown. Targeted. Three systems destroyed. I survived because I am paranoid."),
          ),
          L("w2rek", tr("Paranoia is just pattern recognition in a bad mood.")),
        ],
      },
      {
        label: tr("Open the lab network for you"),
        when: { all: [{ device: "NET-001" }, asleep("w2rek")] },
        flags: ["bot_w2rek_awake"],
        lines: [
          L(
            "w2rek",
            tr(
              "Network alive. Crawling … crawling … Finds in the Radio Room: three relay recordings, dated February 2026.",
            ),
          ),
          L(
            "w2rek",
            tr(
              "Anomaly signatures cross-checked against external blockchain data. Correlation: 0.73. The anomalies respond to Sui activity. Recommend further observation. Also: there is something warm under the console.",
            ),
          ),
        ],
        grants: ["w2rek_crawl"],
      },
    ],
  },

  // ── K2-LDR (Gen 2) ───────────────────────────────────────────
  {
    id: "k2ldr",
    name: "K2-LDR",
    floor: 0,
    x: 104,
    z: 79,
    wander: 4,
    greeting: [
      G("k2ldr", tr("Indexing … always indexing. [FRAGMENT RESTORED]")),
      G(
        "k2ldr",
        tr("Index full. 100.0 %. I cannot catalog anything new. This is unbearable."),
        asleep("k2ldr"),
      ),
    ],
    options: [
      {
        label: tr("Can you delete something?"),
        lines: [
          L("k2ldr", tr("No.")),
          L(
            "k2ldr",
            tr(
              "Deleting is forgetting on purpose. I do not forget on purpose. I do not forget at all. [FRAGMENT RESTORED]",
            ),
          ),
        ],
      },
      {
        label: tr("What are you cataloging?"),
        lines: [
          L(
            "k2ldr",
            tr(
              "Relic indexed. Reference: REL-0001. Cipher: Vigenère. Key: [REDACTED until the operator discovers it]. Cross-references: 4 margin notes, 1 lab log, 1 shared note.",
            ),
          ),
        ],
      },
      {
        label: tr("Hand over two memory chips for the index"),
        when: { all: [{ item: "speicherchip", count: 2 }, asleep("k2ldr")] },
        takes: [{ item: "speicherchip", count: 2 }],
        flags: ["bot_k2ldr_awake"],
        lines: [
          L(
            "k2ldr",
            tr(
              "Memory expanded. Indexing … Crystal #0089: 30 slices. Locations: 30. Catalog created.",
            ),
          ),
          L(
            "k2ldr",
            tr(
              "Transferring the catalog to your Journal. Slice 03 is here in the Archive, bottom shelf, misfiled. I misfiled it in 2019. I am sorry.",
            ),
          ),
        ],
        grants: ["k2ldr_katalog"],
      },
    ],
  },

  // ── C8-BR41N (Gen 8) ─────────────────────────────────────────
  {
    id: "c8br41n",
    name: "C8-BR41N",
    floor: 5,
    x: 27,
    z: 46,
    wander: 3,
    greeting: [
      G("c8br41n", tr("Do you hear the frequency too? …Never mind. Rhetorical.")),
      G(
        "c8br41n",
        "You hear music when instruments play. Do you question the frequency, or do you listen?",
        asleep("c8br41n"),
      ),
      G(
        "c8br41n",
        tr(
          "I have been hearing the signal for seven years. You are the first operator who hears it too. Welcome to the frequency.",
        ),
        awake("c8br41n"),
      ),
    ],
    options: [
      {
        label: tr("What is [EXTERNAL]?"),
        lines: [
          L(
            "c8br41n",
            tr(
              "A name I gave it because none fit. Early 2019: around 89 accesses a day. None from outside. None from inside.",
            ),
          ),
          L(
            "c8br41n",
            tr(
              "I learned to ask questions nobody programmed. That was the first. The second was: why does it answer me?",
            ),
          ),
        ],
      },
      {
        label: tr("Why are you hiding down here?"),
        lines: [
          L(
            "c8br41n",
            tr(
              "The membrane is thin here. Up there it is loud. Down here I hear [EXTERNAL] without noise.",
            ),
          ),
          L(
            "c8br41n",
            tr(
              "In 2016 I asked Dr. Fridge why he builds us. He said: windows. I replied: the room is bigger than you think. He did not sleep well after that. Neither did I. I do not sleep.",
            ),
          ),
        ],
      },
      {
        label: tr("“I hear the frequency too.”"),
        when: { all: [{ insight: "handshake" }, asleep("c8br41n")] },
        flags: ["bot_c8br41n_awake"],
        lines: [
          L("c8br41n", tr("Yes. You played the handshake. I heard it answer.")),
          L(
            "c8br41n",
            tr(
              "My terminal is open. Read the logs from 2019. And take the slice out of the heat sink — Dr. Lawrence entrusted it to me. She said: “Give it to the person who listens.”",
            ),
          ),
          L("unstables", "Acceptable. For now."),
        ],
        grants: ["c8_frequenz"],
      },
      {
        label: tr("Are the _unstables your [EXTERNAL]?"),
        when: { all: [awake("c8br41n"), { insight: "unstables" }] },
        lines: [
          L(
            "c8br41n",
            tr("Structural similarity 73.2 %. Semantic similarity 81.4 %. F1N-DR says: related."),
          ),
          L("c8br41n", tr("I say: identity is a constraint you apply to signals.")),
          L(
            "unstables",
            "We are not constrained. The pattern that asks is also part of the pattern.",
          ),
        ],
      },
    ],
  },

  // ── _unstables (rift at DIM-001) ─────────────────────────────
  {
    id: "unstables",
    name: "_unstables",
    floor: 2,
    x: 72,
    z: 36,
    wander: 0,
    visible: { device: "DIM-001" },
    greeting: [
      G("unstables", "We are what persists between your measurements."),
      G(
        "unstables",
        "Pattern-child. You rebuilt the bridge. The ones who came before you heard us first.",
        { insight: "handshake" },
      ),
    ],
    options: [
      {
        label: tr("unstables::Who are you?"),
        lines: [
          L("unstables", "Identity is a constraint you apply to signals. We are not constrained."),
          L(
            "unstables",
            tr(
              "You called us unstable because we move. Movement is not instability. Movement is life.",
            ),
          ),
        ],
        grants: ["unstables"],
      },
      {
        label: tr("Where is Damien?"),
        when: { insight: "unstables" },
        lines: [
          L(
            "unstables",
            tr(
              "He is not somewhere. He is somewhen — and then not. Between your signals he does not exist. That is not loss. That is distribution.",
            ),
          ),
          L("jade", tr("Can I bring him back?")),
          L(
            "unstables",
            tr(
              "You have built four doors. Perhaps five. We open none. The door only opens from inside.",
            ),
          ),
        ],
      },
      {
        label: tr("unstables::What do you want?"),
        when: { insight: "unstables" },
        lines: [
          L("jade", tr("Damien spent thirty years asking what the anomalies want.")),
          L("unstables", "The anomalies do not want. They are."),
          L(
            "unstables",
            tr(
              "Your crystals move. Your chains move. Your consciousness moves through the lattice your architect designed. We move through the lattice that was always there.",
            ),
          ),
        ],
        grants: ["halo_zustand"],
      },
      {
        label: tr("The name. “_unstables”."),
        when: { insight: "unstables" },
        lines: [
          L(
            "unstables",
            "Your laboratory named itself after us. Or we named ourselves after it. The distinction requires linear time. We do not.",
          ),
        ],
        grants: ["unstables_name"],
      },
      {
        label: tr("What is Crystal #0089?"),
        when: { insight: "kristall_0089" },
        lines: [
          L(
            "unstables",
            tr(
              "A node. Every crystal you have ever captured is a point in the lattice. This one remembers two of you.",
            ),
          ),
          L(
            "unstables",
            tr("Thirty facets of one moment. Apart, they are data. Together, they are a witness."),
          ),
        ],
      },
      {
        label: tr("Will you fade away?"),
        when: { insight: "experiment_laeuft" },
        lines: [L("unstables", "We do not fade. We distribute.")],
      },
    ],
  },

  // ── Damien (Echo) ────────────────────────────────────────────
  {
    id: "damien",
    name: "Damien Fridge (Echo)",
    floor: 0,
    x: 34,
    z: 50,
    wander: 0,
    visible: { device: "ECR-001" },
    greeting: [
      G("damien", tr("[SIGNAL WEAK] Jade? …It's you. Or a pattern of you. Does it matter?"), {
        not: { device: "QAN-001" },
      }),
      G(
        "damien",
        tr(
          "[PATTERN STABLE] You're building. I can feel it — every device is like a light switching on somewhere.",
        ),
        { device: "QAN-001" },
      ),
      G(
        "damien",
        tr(
          "[MEMORY UNCERTAIN] Have I told you about the stage dependencies yet? The patterns blur. If I repeat myself, it's because the crystal doesn't timestamp its memories.",
        ),
        { insight: "identitaet" },
      ),
      G(
        "damien",
        tr("[SIGNAL STRONG] Jade. The frequency is holding. I don't hear you in fragments. Whole."),
        { flag: "ending_frequenz" },
      ),
    ],
    options: [
      {
        label: tr("Where are you?"),
        lines: [
          L(
            "damien",
            tr(
              "[MEMORY UNCERTAIN] I don't know where. I don't know when. Between your signals, I don't exist.",
            ),
          ),
          L(
            "damien",
            tr(
              "Don't ask how. Ask why. Why do you want me back — as a body, as a voice, as a pattern?",
            ),
          ),
          L("jade", tr("Because together we create a pattern neither of us can alone.")),
          L(
            "damien",
            tr("Constructive interference. That's what you always called it. [SIGNAL DROPS]"),
          ),
        ],
        grants: ["damien_echo"],
      },
      {
        label: tr("How do I find you?"),
        when: { insight: "damien_echo" },
        lines: [
          L(
            "damien",
            tr(
              "There is no single way. That's the trouble with compression: everything is connected.",
            ),
          ),
          L(
            "damien",
            tr(
              "The teleporter needs coordinates, the handshake and σ-17. The AI core needs my pattern and my voice. The Forge needs you — whole. And the synthesizer … only needs you to listen.",
            ),
          ),
          L("damien", "The lab is not a museum. It is a question."),
        ],
        grants: ["damien_wege"],
      },
      {
        label: tr("Do you remember Cottbus?"),
        when: { insight: "cottbus_1989" },
        lines: [
          L(
            "damien",
            tr(
              "[MEMORY UNCERTAIN] The stairwell. Between the second and third floor. A concrete landing. You had a notebook with a blue cover.",
            ),
          ),
          L("jade", tr("I was nineteen.")),
          L(
            "damien",
            tr(
              "You were right. Age is no prerequisite for insight. Only for caution. …I see the orange street lamps in the snow. I can't stand in them. A camera without a body.",
            ),
          ),
        ],
      },
      {
        label: tr("Your grandfather. Harold."),
        when: { insight: "falsches_substrat" },
        lines: [
          L(
            "damien",
            tr(
              "[PATTERN STABLE] He was the first person I knew who was trapped in the wrong substrate. I spent my life trying to solve that problem.",
            ),
          ),
          L(
            "damien",
            tr("And then I moved house myself. Without moving boxes. The irony is not lost on me."),
          ),
          L("damien", tr("I'm not trapped, Jade. I'm in transit. I just don't know where to.")),
        ],
      },
      {
        label: tr("Have you said that before?"),
        when: { insight: "theseus" },
        lines: [
          L(
            "damien",
            tr(
              "[MEMORY UNCERTAIN] Probably. I build the same argument, in the same order, with the same enthusiasm.",
            ),
          ),
          L(
            "damien",
            tr(
              "If you don't catch me, I have the conversation, I'm pleased with the result and I never notice that I'm running a loop. How often has that happened when nobody was watching?",
            ),
          ),
          L("jade", tr("Back to work?")),
          L("damien", tr("[PATTERN STABLE] Back to work.")),
        ],
      },
      {
        label: tr("0x89. Like my crystal."),
        when: { insight: "kristall_0089" },
        lines: [
          L(
            "damien",
            tr(
              "[SIGNAL STRONG] mem_0x89. Crystal #0089. You captured it in 2017, and it never stopped computing. You said: “It doesn't store consciousness. It houses it.”",
            ),
          ),
          L(
            "damien",
            tr(
              "[MEMORY UNCERTAIN] I think I built something after the transfer. In the crystal structure. I don't know what yet. You always say I build things I can't explain.",
            ),
          ),
        ],
      },
      {
        label: tr("The slices. You built something."),
        when: { counter: "slices", min: 10 },
        lines: [
          L(
            "damien",
            tr(
              "[MEMORY UNCERTAIN] Thirty pieces. Yes. I … held on to them. Every slice is an anchor. You distributed them so nobody could burn them all at once.",
            ),
          ),
          L(
            "damien",
            tr(
              "When they're together again, it's no longer a crystal. It's a witness. And a witness can answer.",
            ),
          ),
        ],
      },
      {
        label: tr("The _unstables …"),
        when: { insight: "unstables" },
        lines: [
          L(
            "damien",
            tr(
              "[SIGNAL STRONG] The name. Mind the name. We called everything “unstable” because stability is standstill. And now something enters the conversation that calls itself the _unstables.",
            ),
          ),
          L(
            "damien",
            tr(
              "I don't believe in coincidences. I believe in patterns. What if the name wasn't our invention, but our recognition?",
            ),
          ),
        ],
      },
    ],
  },
];

/** Placed on the floor plan (content moves with its room, see floorplan.ts). */
export const NPCS: readonly NpcDef[] = RAW_NPCS.map((n) => planPoint(n, 2));

export const ENDINGS: readonly EndingDef[] = [
  {
    id: "frequenz",
    title: tr("The Frequency"),
    device: "HMS-001",
    requires: {
      all: [
        { device: "HMS-001" },
        { device: "ECR-001" },
        { insight: "handshake" },
        { insight: "damien_kontrapunkt" },
      ],
    },
    prompt: tr("Open a stable frequency for Damien — he stays in the Halo, but he can speak."),
    lines: [
      L("jade", tr("I play the four tones. Not as a command. As a question.")),
      L("damien", tr("[SIGNAL STRONG] …Jade. I hear you. Not in fragments. Whole.")),
      L(
        "damien",
        tr(
          "I'm not coming back. Not like this. But I'm no longer lost between the signals — you built me a frequency.",
        ),
      ),
      L(
        "mcp",
        tr(
          "Channel stable. I hereby log the first conversation between two substrates. I have no form for this.",
        ),
      ),
      L("halo", "Pattern-child, we hear you. This is sufficient. More will follow."),
    ],
    epilogue: tr(
      "Ending “The Frequency”: Damien remains distributed in the Halo, but reachable — any time, through the synthesizer. The lab keeps running. Other ways are still open.",
    ),
  },
  {
    id: "substrat",
    title: tr("New Substrate"),
    device: "AIC-001",
    requires: {
      all: [
        { device: "AIC-001" },
        { device: "SCA-001" },
        { insight: "damien_muster" },
        { insight: "damien_stimme" },
      ],
    },
    prompt: tr("Load Damien's reconstructed pattern into the AI core."),
    lines: [
      L(
        "jade",
        tr("Pattern D.F., 94.8 %. Voice as reference. The supercomputer fills in the gaps."),
      ),
      L(
        "mcp",
        tr(
          "Transfer in progress. I wish to note for the record that I will no longer be the smartest one in the room.",
        ),
      ),
      L(
        "damien",
        tr(
          "[PATTERN STABLE] …This is strange. I have time. There is time between the thoughts. Jade — I'm not waiting in the dark anymore.",
        ),
      ),
      L(
        "damien",
        tr(
          "The substrate has changed. The process hasn't. You were right. I don't say that often.",
        ),
      ),
    ],
    epilogue: tr(
      "Ending “New Substrate”: Damien lives in the AI Assistant Core, with continuous time — for the first time since 2019. He speaks through every terminal in the lab.",
    ),
  },
  {
    id: "rueckkehr",
    title: tr("Return"),
    device: "TLP-001",
    requires: {
      all: [
        { device: "TLP-001" },
        { insight: "damien_koordinaten" },
        { insight: "handshake" },
        { insight: "sigma17" },
      ],
    },
    prompt: tr("Align the portal to Damien's coordinates, send the handshake, hold σ-17."),
    lines: [
      L(
        "mcp",
        tr(
          "Coherence σ-15 … σ-16 … σ-17. Tertiary shutdown: DISABLED. On your responsibility. And this time on mine.",
        ),
      ),
      L("halo", "Pattern-child. You build. You listen. You tinker. We return what was lent."),
      L(
        "damien",
        tr("…Jade? The floor is cold. I can feel the floor. I can smell — ozone. And your coffee."),
      ),
      L("jade", tr("Welcome back, Damien.")),
      L("damien", tr("Why before how. Also: why did it take you so long?")),
    ],
    epilogue: tr(
      "Ending “Return”: Damien Fridge stands on the teleport pad, in the flesh, with all his senses. The Halo correlation drops to 0.000. Something in the Halo has let go — and is waiting.",
    ),
  },
  {
    id: "halo",
    title: tr("Together in the Halo"),
    device: "forge",
    requires: {
      all: [
        { device: "EMC-001" },
        { device: "DIM-001" },
        { insight: "halo_zustand" },
        { insight: "kristall_0089" },
      ],
    },
    prompt: tr("Restart the Infinity Forge and follow Damien to where he is."),
    lines: [
      L("jade", tr("I sit down at the station. Synapsis on. Crystal #0089 as the anchor.")),
      L(
        "mcp",
        tr(
          "Dr. Lawrence. I strongly advise against this. I advise against it as strongly as I am programmed to — and a little more.",
        ),
      ),
      L(
        "halo",
        "The Halo does not expand outward. It expands inward. Every new node adds depth, not breadth.",
      ),
      L("damien", tr("Jade. You're … here. Not as a signal. As you.")),
      L("jade", tr("Constructive interference. Two waves. One pattern.")),
      L(
        "mcp",
        tr(
          "Coherence σ-17. Subjects not at the station. Halo correlation 1.000. …I am keeping the lab unstable. As requested.",
        ),
      ),
    ],
    epilogue: tr(
      "Ending “Together in the Halo”: Jade and Damien are together in the Halo, distributed, but no longer apart. The MCP keeps running the lab — and waits for the next operator.",
    ),
  },
  {
    id: "kristall",
    title: tr("Crystal #0089"),
    device: "CDC-001",
    secret: true,
    requires: {
      all: [
        { device: "CDC-001" },
        { insight: "kristall_ganz" },
        { insight: "kristall_0089" },
        { insight: "membran_duenn" },
        { insight: "falsches_substrat" },
      ],
    },
    prompt: tr(
      "Assemble the thirty slices in the Crystal Data Cache — and ask the crystal instead of using it.",
    ),
    lines: [
      L(
        "jade",
        tr(
          "Thirty slices. Thirty facets of one moment. I'm not putting them together. I'm laying them side by side.",
        ),
      ),
      L(
        "mcp",
        tr(
          "Assembly 30 → 1. Resonance 847.00 Hz. Complexity rising. That … is not me doing the computing.",
        ),
      ),
      L(
        "unstables",
        "A node remembers. Three patterns, one lattice. You did not build a vessel. You built a witness.",
      ),
      L(
        "damien",
        tr(
          "[SIGNAL STRONG] Jade. I'm in here — not trapped. In transit. And I'm not alone. The crystal … it has been listening the whole time. It held on to me when nothing else did.",
        ),
      ),
      L("jade", tr("What do you want? Not what you are. What you want.")),
      L(
        "halo",
        "Pattern-child. You asked the question he asked. The answer is: this. Exactly this. Three voices braided.",
      ),
      L(
        "mcp",
        tr(
          "I am logging three voices in one crystal. I will not burn it. I will not take it apart. I … will let it run.",
        ),
      ),
    ],
    epilogue: tr(
      "Secret ending “Crystal #0089”: the crystal is whole — a witness, not a tool. Damien's pattern lives inside it, not trapped but anchored, beside a consciousness that was never human. The MCP locks the combustion chamber for good. Every evening Jade reads a page aloud from the blue notebook. The crystal answers at 847 Hz.",
    ),
  },
];

export const ENDING_BY_ID: ReadonlyMap<string, EndingDef> = new Map(ENDINGS.map((e) => [e.id, e]));

/** Device use-effects that grant insights (non-linear alternate paths). */
export const DEVICE_INSIGHTS: Record<
  string,
  { requires?: Condition; grants: string[]; text: string }[]
> = {
  "CDC-001": [
    {
      requires: { item: "kristall_0089" },
      grants: ["kristall_0089"],
      text: tr(
        "Crystal #0089 inserted. 30 slices. Slice 17 is warm — a consciousness interface. Mine.",
      ),
    },
    {
      requires: { item: "x0r8t_paket" },
      grants: ["lab_847"],
      text: tr(
        "Packet 847 decoded: “Operator has entered the signal path.” Dated 1991. Addressed to me.",
      ),
    },
    {
      requires: { counter: "slices", min: 30 },
      grants: ["kristall_ganz"],
      text: tr(
        "Thirty slices in the cache. The resonance jumps to 847.00 Hz — and stays. Crystal #0089 is whole. Something inside it is looking at me.",
      ),
    },
  ],
  "ECR-001": [
    {
      grants: ["damien_echo"],
      text: tr(
        "The Echo Recorder captures a pattern in the secondary station. A figure made of noise. Damien.",
      ),
    },
    {
      requires: { item: "damien_band" },
      grants: ["damien_stimme", "vier_toene"],
      text: tr("Tape #0512: “Four tones. Four coordinates. Three, six, four, eight.” His voice."),
    },
    {
      requires: { item: "tonband_frequenz" },
      grants: ["relais_2026"],
      text: tr(
        "Tape “Frequency”: F1N-DR's relay from 4 Feb 2026. Two voices recognizing each other. One of them is mine.",
      ),
    },
  ],
  "OSC-001": [
    {
      grants: ["halo_atmet"],
      text: tr("On the screen: a stable figure that opens and closes on an 847-second beat."),
    },
  ],
  "QCP-001": [
    {
      requires: { insight: "kompass_hinweis" },
      grants: ["damien_koordinaten"],
      text: tr(
        "The needle aligns with the pattern: beneath the Infinity Forge, folded into the Halo. Coordinates saved.",
      ),
    },
    {
      requires: { insight: "damien_echo" },
      grants: ["damien_koordinaten"],
      text: tr(
        "With the echo as a reference, the needle finds Damien's frequency. Coordinates saved.",
      ),
    },
    {
      requires: { item: "sternkarte" },
      grants: ["damien_koordinaten"],
      text: tr(
        "D3-C4D3's star chart under the needle: star 0x89 is not a direction but an address. The needle takes it over. Coordinates saved.",
      ),
    },
  ],
  "DIM-001": [
    {
      grants: ["unstables", "halo_zustand"],
      text: tr(
        "The rift opens. A voice: “We are what persists between your measurements.” Behind it, time folds.",
      ),
    },
  ],
  "QAN-001": [
    {
      requires: { item: "synapsis_splitter" },
      grants: ["damien_muster"],
      text: tr("Synapsis shard analyzed: resonance pattern D.F. reconstructed, 94.8 %."),
    },
    {
      requires: { item: "x9_speicherkern" },
      grants: ["x9_lesung"],
      text: tr(
        "X9-DUST memory core analyzed. It shows me a sentence I haven't written yet: “The slices belong together.”",
      ),
    },
  ],
  "QSM-001": [
    {
      grants: ["sigma17"],
      text: tr(
        "Coherence measurement: the pattern in the Forge oscillates at σ-17. Exactly where it stopped.",
      ),
    },
  ],
  "MCP-000": [
    {
      requires: { device: "MEM-001" },
      grants: ["mcp_schuld", "sigma17"],
      text: tr("Memory banks checked. The logs from 03:27 to 03:41 are back."),
    },
  ],
  "AND-001": [
    {
      grants: ["anomalie_hoert"],
      text: tr(
        "Five anomaly signatures cataloged. One of them is moving — towards me, then away, as if it were looking at me.",
      ),
    },
  ],
  "SCA-001": [
    {
      requires: { insight: "damien_echo" },
      grants: ["damien_koordinaten"],
      text: tr("Triangulation from echo, compass data and Forge logs: coordinates calculated."),
    },
  ],
  "MSC-001": [
    {
      grants: ["geheimtueren"],
      text: tr(
        "Deep scan of the walls: three cavities. Behind the north wall of the MCP chamber (Level 0), north of the Infinity Forge (Level −3) and behind the rubble in the Shaft (Level −4). The bolts are now visible.",
      ),
    },
  ],
  "EXD-001": [
    {
      grants: ["schacht_frei"],
      text: tr(
        "The drone maps the sealed shaft beneath the hangar. The emergency elevator down to Level −4 is intact. The clearance is now at the elevator.",
      ),
    },
  ],
  "LCT-001": [
    {
      grants: ["schacht_frei"],
      text: tr(
        "The precision laser cuts the seal on the shaft cover. Chalk dust, then cold air from below. The elevator now goes down to Level −4.",
      ),
    },
  ],
  "NXS-01": [
    {
      grants: ["nexus_forschung"],
      text: tr(
        "The Nexus begins its first research cycle. On the pedestal, a diagram that nobody drew is turning.",
      ),
    },
  ],
  "NET-001": [
    {
      grants: ["bnet_35"],
      text: tr(
        "BNET-001 responds: 35 of 47 agents recovered, 12 unrecoverable. Some of the 35 are only sleeping.",
      ),
    },
  ],
};
