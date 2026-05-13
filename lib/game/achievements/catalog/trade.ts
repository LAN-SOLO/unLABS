/**
 * Trade branch achievements.
 *
 * "Novice Trader" tracks lifetime _unSC spent. The concrete Marketplace
 * isn't in scope for MVP, so this lands on the _unSC spent via crafting
 * burns + research spends. Gives an early economy-side win regardless of
 * on-chain marketplace readiness.
 */

import type { Achievement } from "../types";

const NOVICE_TRADER_T1: Achievement = {
  id: "trade.novice.t1",
  title: "Novice Trader",
  description: "Spend 50 _unSC in total. Burn, build, or research — it all counts.",
  branch: "trade",
  tier: 1,
  target: 50,
  unit: "_unSC spent",
  reward: {
    unsc: 10,
    flag: "ach_trade_novice_t1",
    description: "+10 _unSC",
  },
  evaluate: (s) => s.totalSpent,
};

const MARKET_MAVEN_T2: Achievement = {
  id: "trade.novice.t2",
  title: "Market Maven",
  description: "Spend 150 _unSC total. Research is where most of it ends up.",
  branch: "trade",
  tier: 2,
  target: 150,
  unit: "_unSC spent",
  reward: {
    unsc: 25,
    flag: "ach_trade_novice_t2",
    description: "+25 _unSC",
  },
  available: (flags) => flags.ach_trade_novice_t1 === true,
  evaluate: (s) => s.totalSpent,
};

const GALACTIC_TYCOON_T3: Achievement = {
  id: "trade.novice.t3",
  title: "Galactic Tycoon",
  description: "Spend 500 _unSC total. The reserve notices you, eventually.",
  branch: "trade",
  tier: 3,
  target: 500,
  unit: "_unSC spent",
  reward: {
    unsc: 60,
    flag: "ach_trade_novice_t3",
    description: "+60 _unSC",
  },
  available: (flags) => flags.ach_trade_novice_t2 === true,
  evaluate: (s) => s.totalSpent,
};

export const TRADE_ACHIEVEMENTS: Achievement[] = [
  NOVICE_TRADER_T1,
  MARKET_MAVEN_T2,
  GALACTIC_TYCOON_T3,
];
