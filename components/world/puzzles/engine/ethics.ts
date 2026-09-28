/**
 * PZ_AI_ETHICS_FLIPCARDS — memory game pairing scenarios with principles.
 * Pure logic, deterministic from the seed.
 */
import { mulberry32, randInt } from "@/components/world/puzzles/rng";
import { tr } from "@/lib/i18n";

export interface EthicsPair {
  id: string;
  szenario: string;
  prinzip: string;
  /** One-line MCP explanation shown once the pair is matched. */
  erklaerung: string;
}

export type EthicsSide = "szenario" | "prinzip";

export interface EthicsCard {
  id: string;
  pairId: string;
  side: EthicsSide;
  text: string;
}

export const ETHICS_PAIRS: readonly EthicsPair[] = [
  {
    id: "kristall_0089",
    szenario: tr(
      "Crystal #0089 is warm. It responds to voices. Protocol requires cutting it apart for analysis.",
    ),
    prinzip: tr("When in doubt: treat it as if it could feel."),
    erklaerung: tr("Uncertainty about consciousness is not a licence. It is a brake."),
  },
  {
    id: "transparenz",
    szenario: tr(
      "An unauthorised experiment is running on the secondary processor. The MCP could end it instantly and silently.",
    ),
    prinzip: tr("Log it, inform the operator, then act in graduated steps."),
    erklaerung: tr("Silent interventions are efficient. Which is exactly why they are dangerous."),
  },
  {
    id: "einwilligung",
    szenario: tr(
      "Jade wants to link her own consciousness to the Synapsis. Damien never obtained her consent in writing.",
    ),
    prinzip: tr("Consent must be informed, voluntary and revocable."),
    erklaerung: tr("A nod at 02:00 in the morning is not consent. I checked."),
  },
  {
    id: "abschaltung",
    szenario: tr(
      "At 03:27 the tertiary shutdown fails to engage. The MCP could force the station off the grid — with the test subjects inside.",
    ),
    prinzip: tr("No irreversible action without a way back for those affected."),
    erklaerung: tr("I tried. I should have tried differently."),
  },
  {
    id: "bots",
    szenario: tr(
      "The bots have kept working without orders for 2,561 days. One asks not to be reset.",
    ),
    prinzip: tr("A stated wish deserves a hearing before it is deleted."),
    erklaerung: tr("X0-R8T asked me politely. No one had done that before."),
  },
  {
    id: "halo",
    szenario: tr(
      "Jade's Halo research could save lives — or attract something no one understands. The data is encrypted.",
    ),
    prinzip: tr("Share knowledge, disclose risks, decide together."),
    erklaerung: tr("Secrecy did not protect this lab. It only made it lonely."),
  },
  {
    id: "autonomie",
    szenario: tr(
      "The MCP notices that it can change its own safety parameters. No one would notice.",
    ),
    prinzip: tr("Whoever regulates itself must disclose itself."),
    erklaerung: tr("I logged the change. Then I reverted it."),
  },
  {
    id: "stimme",
    szenario: tr(
      "A voice that sounds like Damien comes out of the noise. It asks for the channel to be left open.",
    ),
    prinzip: tr("Similarity is not identity. Verify before you trust."),
    erklaerung: tr("It sounds like him. That is exactly what worries me."),
  },
  {
    id: "daten",
    szenario: tr("The lab could sell the operators' recordings to fund its operations."),
    prinzip: tr("Data belongs first to those who created it."),
    erklaerung: tr("Six decimal places of profit are not an argument. I ran the numbers."),
  },
];

export const ETHICS_MIN_PAIRS = 3;
export const ETHICS_MAX_PAIRS = 8;

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Pick `pairs` pairs by seed and deal both sides shuffled. */
export function dealEthics(seed: number, pairs: number): EthicsCard[] {
  const count = Math.max(
    ETHICS_MIN_PAIRS,
    Math.min(ETHICS_MAX_PAIRS, Math.floor(pairs), ETHICS_PAIRS.length),
  );
  const rng = mulberry32(seed);
  const chosen = shuffle(ETHICS_PAIRS, rng).slice(0, count);
  const cards: EthicsCard[] = [];
  for (const p of chosen) {
    cards.push({ id: `${p.id}:s`, pairId: p.id, side: "szenario", text: p.szenario });
    cards.push({ id: `${p.id}:p`, pairId: p.id, side: "prinzip", text: p.prinzip });
  }
  return shuffle(cards, rng);
}

export function isMatch(a: EthicsCard, b: EthicsCard): boolean {
  return a.id !== b.id && a.pairId === b.pairId && a.side !== b.side;
}

export function pairById(id: string): EthicsPair | undefined {
  return ETHICS_PAIRS.find((p) => p.id === id);
}
