# Matrix Chamber — slices from the Ethereum matrix

> Before Damien vanished, the researchers learned to pull **slices** out of
> the matrix of the Ethereum chain, keyed by the state of the chain. The
> apparatus never found the exact moment again: every extraction dissolves
> a random slice — a random frame of a random released unETH capture.

The Matrix Chamber is the lab's post-game station. A player with the
fully built lab extracts slices (2–24 h of real time each), collects
them, composes crystals from them and keeps those crystals in the chamber.
Minting the slices and crystals as Solana **devnet** NFTs is
**prepared, not open yet**. This document records the rules, where the data
comes from, and the plan for minting and the marketplace.

Code: `lib/world/matrix/` (rules, pure) and `components/world/matrix/MatrixPanel.tsx`
(console). Tests: `tests/world/matrix/matrix-rules.test.ts`.

---

## 1. Data — only what happened

| Data           | File                                   | Source / refresh                                                                                                                                                         |
| -------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| unETH captures | `lib/world/content/uneth-release.json` | The 880 captures of the 2018-03-07 release lists (P01 mono 160 · P02 pure 630 · P03 RGB 90), exported from the research archive: `node scripts/uneth/export-release.mjs` |
| The ETH ledger | `lib/world/content/eth-history.json`   | One record per day from the genesis (2015-07-30) to the last complete day (Blockchair daily block aggregates): `node scripts/eth-history/fetch.mjs`                      |

No ID, trait or day is invented. Unreleased IDs (incl. every 8-bit ID) are
not in the pool. The ledger only covers the past: re-run the fetch script to
extend it to "now". Before the first exchange listing (2015-08-07) the price
is unknown (0), not guessed.

Per day: blocks, block height, transactions, gas used, ETH transferred,
implied USD price (USD value ÷ ETH value transferred), fees, ETH burned
(EIP-1559), average base fee.

### Chain state of a day (`matrix/history.ts`)

Each indicator is ranked against the **30 days before** that day (only the
past, as the chamber would have seen it then):

| Indicator  | From                     | Chain state                                                |
| ---------- | ------------------------ | ---------------------------------------------------------- |
| change     | log price return         | rotation CW (≥ 0) / CCW                                    |
| volatility | \|change\| rank          | tier T1–T5 (fifths); I/O state O (T1), I (T2–3), IO (T4–5) |
| load       | gas used rank            | era 16 / 32 / 64 bit (thirds)                              |
| —          | \|change\| < 0.5 %       | stasis S, else NOS                                         |
| activity   | transactions rank        | (monochrome condition)                                     |
| pressure   | fee per transaction rank | (monochrome condition)                                     |

**Monochrome day:** volatility, activity, pressure and load all in the top
tenth or all in the bottom tenth of their month at once — 21 days in the
whole history, among them the DAO hack (2016-06-17) and the March 2020
crash. Only such a day opens the mono line.

## 2. Extraction (`matrix/rules.ts`)

- **Wakes** when every device of the lab is built (`matrixAwake`, 39 incl. MCP).
- **Inputs:** a ledger day (any recorded day), a field strength 1–5 and
  materials (consumed at the start). The grid must deliver the field's
  watts when it starts.

| Field | Watts | Materials                                                            | Lines reachable                 |
| ----: | ----: | -------------------------------------------------------------------- | ------------------------------- |
|     1 |    60 | 1 Halo Crystal Shard                                                 | pure                            |
|     2 |    90 | 1 Halo Crystal Shard, 1 Energy Cell                                  | pure                            |
|     3 |   120 | 2 Halo Crystal Shards, 1 Energy Cell                                 | pure                            |
|     4 |   180 | 2 Halo Crystal Shards, 1 Energy Cell, 1 Exotic Matter                | pure, RGB                       |
|     5 |   250 | 2 Halo Crystal Shards, 2 Energy Cells, 1 Exotic Matter, 1 Antimatter | pure, RGB, mono (mono day only) |

All materials are renewable in the finished lab (rubble + lens → halo
crystal; EMC-001 exotic matter; QSM-001 antimatter).

- **Outcome:** line by weight (pure 1 · RGB 0.15 · mono 0.06, only reachable
  lines) → capture within the line weighted by resonance with the day's chain
  state (rotation +2, tier +2, I/O +1, era +1, stasis +1) → position 1–30
  uniform. Fixed by a seed at the start (`outcomeOf`), revealed at the end.
- **Duration:** uniform 2–24 h of **wall-clock** time (epoch ms in the save),
  independent of the outcome. Keeps running while the game is closed; the
  1-second world tick finishes it (`finishExtraction`) and toasts the slice.
- **Rarity:** mono (P01) legendary · RGB (P03) epic · pure (P02) T5 rare,
  T3–T4 uncommon, T1–T2 common. Example: #0001 (pure white T1) common,
  #0031 (RGB) epic, #0961 (mono) legendary.

## 3. Composer and the chamber's inventory

- A crystal is 30 positions, each a slice or empty. Position _i_ plays
  frame _i_ at 80 ms; a slice shows its capture turned by (pos − 1) · 6°.
- In capture order (one capture, every position) the crystal **turns** like
  the original; one position everywhere **stands still**; mixed captures or
  shuffled positions are **exotic** (`crystalMotion`).
- A slice sits in at most one crystal; taking a crystal apart frees its
  slices. Crystals are kept in the chamber (`WorldState.matrix.crystals`, slot
  lists only); the GIF is rendered on demand (`matrix/capture.ts`,
  `matrix/gif.ts`, 320², loop).

Save: `WorldState.matrix` (v8, `MIGRATIONS[7]`), sanitised by
`sanitizeMatrix` (unknown tokens, duplicate uids, double-placed slices and
jobs longer than 24 h are dropped).

## 4. Minting — prepared (`matrix/mint.ts`)

What exists now:

- **Device combination:** Crystal Data Cache (CDC-001) holds the slice
  data, Network Monitor (NET-001) carries it out, Quantum Analyzer
  (QAN-001) signs the provenance — built and switched on, chamber awake
  (`mintReadiness`). Network devnet only; mainnet closed (`MINT_NETWORKS`).
- **Metadata** (Metaplex JSON): slice name `SLC#0089-17`, symbol `UNSLC`,
  attributes from recorded data only — token, position, angle, phase, line,
  colour, tier, state, stasis, era, rotation, rarity, capture file name,
  ledger day, block height, monochrome flag, field. Crystals: symbol
  `UNITM`, P01…P30 attributes.
- The console's **Mint** tab shows the uplink checks and a metadata
  preview; the mint button is disabled.

What still has to be built (in this order):

1. **Server-authoritative extraction.** A local save can be edited and the
   clock moved, so nothing local may become an NFT. Start and finish move to
   a server action: the server picks the seed and the end time, stores the
   job (`matrix_jobs`), and on finish derives the slice itself
   (`outcomeOf` is pure and shared) → `matrix_slices` row owned by the
   player. The local chamber then mirrors the server. Offline play stays
   possible for local-only slices, which are marked "not mintable".
2. **Supabase schema** (migration): `matrix_jobs`, `matrix_slices` (token,
   pos, day, field, at, owner, mint_address, listed), `matrix_crystals` (30
   slot references). RLS: owners read their rows; all writes through
   `SECURITY DEFINER` RPCs (same pattern as `slice_merge` / `market_list`).
   Note: the older `crystals` / `slices` tables use other traits (9 spectrum
   colours) — the unETH slices get their own tables instead of overloading
   them.
3. **Devnet mint** via the existing path: `app/(game)/actions/nft.ts` guards
   (owned, unminted, unlisted, wallet linked) → `lib/solana/mintCrystalNft.ts`
   (umi `createNft`) → metadata route `/api/slice-metadata/[id]` serving
   `sliceMetadata` + the rendered PNG / GIF (uploaded once, URI stored).
4. **Legal review** — hard gate before `MINT_NETWORKS.mainnet` may become
   true. Not a code decision.

## 5. Marketplace — plan

Trading happens on an **external web marketplace**; the chamber / terminal
connects to it to list, buy and hand over slices and crystals.

- **Where:** a separate web app (own deploy, e.g. `market.unstablelabs…`),
  reading the same Supabase project. Public pages: browse by line / rarity /
  colour / ledger day, a slice's capture image, a crystal's GIF, provenance
  (ledger day, block height, extraction time), price history.
- **Connecting the device:** the console shows a pairing code (short-lived,
  server-issued); entering it on the web links the browser session to the
  player's account — the same ownership the game uses, no second login.
  The terminal gets a `market slices` command set (list / unlist / buy) on
  top of the existing `market_*` RPCs.
- **Settlement:** in-game currency (\_unSC) first, using the existing
  `market_list` / `market_buy` / fee-burn RPCs; minted (devnet) items carry
  their mint address and transfer on chain when sold. A listed slice cannot
  be placed in a crystal (and vice versa), mirroring `assert_slice_op_allowed`.
- **Open decisions:** domain and hosting of the web app; whether unminted
  slices may be traded at all; fees; whether crystals trade as a unit only.

## 6. Dev handles

`__lab.matrix.open()` · `wake()` (build every device) · `feed()` (field-5
materials) · `finishNow()` (end the running job).
