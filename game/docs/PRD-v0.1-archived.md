# EMBERHOLD — Product Requirements Document

| | |
|---|---|
| **Version** | 0.1 — DRAFT, awaiting sign-off |
| **Date** | 2026-11-02 |
| **Owner** | You (product) · Qwen (drafting, implementation) |
| **Companion docs** | `GDD.md` (systems design, §17 = prototype build notes) |
| **Status** | **No code will be written against this document until §17 is signed off.** |

> **How to read this.** §1–6 define the product. §7–10 define the MVP and how we'll know it works.
> §11–13 cover platform and the consequences of "Steam now, mobile later." §14 audits the existing
> 6,700-line prototype against these requirements so you can decide what to keep. §17 is the
> decision list — **that's the part I need from you.**
>
> Where I've made a judgement call rather than reported a fact, it's marked **[REC]**.
> Where a number is a target we're setting rather than a benchmark we've verified, it's marked
> **[TARGET]**.

---

## 1. Product Overview

**Emberhold** is a premium isometric pixel-art RPG in which you rebuild a failing hamlet while
delving the dungeon that is slowly killing it.

The pitch in one line:

> **RimWorld's living village, Moonlighter's shop-and-dungeon loop, and an idle layer — fused into
> one economy where each system is load-bearing for the other two.**

**Product type.** Premium (paid, one-time purchase). No IAP, no ads, no energy timers.
**Primary platform.** Steam (Windows, macOS, Linux).
**Secondary platform.** Mobile (iOS/Android), post-launch, gated on playtest results.
**Engine.** Decision D1 in §17 — currently JavaScript + Canvas 2D.

### 1.1 Why this product exists

Three things are true at once, and no shipped game does all three:

1. **Colony/village sims with emergent characters create the strongest word-of-mouth in the
   genre.** RimWorld has sold ~7.4M copies for ~$199M gross [2](https://gamalytic.com/game/294100),
   and the analysis of *why* consistently lands on the same thing: it is a story generator, and the
   characters are the reason people talk about it [1](https://blog.habrador.com/2019/06/why-rimworld-sold-more-than-1-million.html).
2. **Base + dungeon hybrids are proven blockbusters.** Cult of the Lamb sold ~1M copies in its
   first week and sits at ~5.1M lifetime for ~$68.8M gross
   [1](https://gamalytic.com/game/1313140)[2](https://www.reddit.com/r/Games/comments/y3ghys/cult_of_the_lamb_sold_1_million_copies_in_its/),
   peaking at ~61.8k concurrent players with ~150k Twitch viewers at launch
   [3](https://gameworldobserver.com/2022-08-12/cult-of-the-lamb-peaks-at-over-60k-concurrent-players-at-launch).
3. **The hybrids that disappoint do so because one half is a skin.** Moonlighter is the canonical
   example: it is remembered as a decent dungeon crawler whose shopkeeping — the stated selling
   point — was empty [1](https://www.reddit.com/r/gamingsuggestions/comments/caib37/moonlighter_recettear_both/).

Emberhold's bet is that (3) is a *design* failure, not a market failure. You chose "all three
pillars, nothing is scaffolding." That is the ambitious reading, and it is the one with a
defensible reason to exist. It is also the single biggest cost and risk in this project (§16, R1).

### 1.2 The non-negotiable design rule that follows from this

> **Every system must be a *cause* in the other two, not just a *consumer* of them.**

Concretely: the dungeon must be the only source of what the town needs to grow; the town must be
the only thing that makes deeper floors survivable; and the NPCs must be the mechanism by which
both are delivered — they are the miners, the smiths, the quest-givers, the companions and the
people whose opinion of you changes what they'll do. If any pillar can be ignored for 30 minutes
without consequence, it is scaffolding and the pitch is a lie.

This rule is the acceptance test for M1 (§10.2).

---

## 2. Audience

**Primary.** PC players, 25–45, who own RimWorld / Cult of the Lamb / Stardew Valley / Dungeon
Machina-likes and have 20+ hours to sink. They read patch notes. They tolerate — often enjoy —
systemic complexity, and they punish shallow systems hard in reviews.

**Secondary.** Idle/incremental players who want depth attached to the numbers. They are the
reason the offline-progression and auto-explore systems exist.

**Tertiary (post-launch).** Mobile players in short sessions. This audience is *not* designed for
at MVP, but it must not be *designed out* — see §13.

**Who this is not for.** Players expecting an action-RPG skill ceiling, or a narrative-driven RPG
with authored companions (Baldur's Gate 3 territory). We are not competing there and must not be
marketed there.

---

## 3. Design Pillars

| # | Pillar | What it means in practice | What it forbids |
|---|---|---|---|
| P1 | **The village is alive and it judges you** | Named NPCs with jobs, needs, schedules, relationships, memory. They trade with each other on a real market you tax. They talk about what you did. | Anonymous "worker units." Any NPC that exists only to vend. |
| P2 | **Depth is earned, not grinded** | Every floor demands something the town must have produced: better gear, potions, companions, research, light. Death costs you the descent, not the run. | Stat-check walls. Endless identical corridors. Grinding as the intended path. |
| P3 | **Idle is an accelerator, never a gate** | Auto-explore, offline progress, and a working town that runs without you are *conveniences that let a busy player keep progressing*. A watching player always outperforms an idle one. | Timers that block play. Anything that punishes being present. |

**Anti-pillars — explicitly not in this product.**
- No multiplayer at launch (Decision D5).
- No procedural *story*. Events are systemic; authored content is authored.
- No live-service monetisation. One price, plus optional DLC later.
- No photorealism, no 3D, no voice acting.

---

## 4. Core Loop

```
        ┌──────────────────────────────────────────────────────┐
        │                                                      │
        ▼                                                      │
   DELVE the Hollowdeep                                        │
   · loot, ore, embers, eggs                                   │
   · risk: death costs the descent + 10% gold                  │
        │                                                      │
        │  raw materials & gold                                │
        ▼                                                      │
   BUILD & EMPLOY Emberhold                                    │
   · houses → population → workers                             │
   · forge/library/barracks → gear, research, companions       │
        │                                                      │
        │  gear, potions, party, tech                          │
        ▼                                                      │
   SURVIVE DEEPER ──────────────────────────────────────────────┘

   NPCs ride the whole loop: they staff the buildings, buy and
   sell from each other (you tax it), hand out quests, join the
   party, and remember how you treated them.
```

**Session shapes the loop must serve:**
- **5 min** — collect overnight output, assign workers, send the hero auto-delving, close tab.
- **25 min** — one quest line: accept, prepare, delve a boss floor, return, spend, advance.
- **2 h** — a town tier-up: new buildings, new population, new research branch, story beat.

If the 5-minute shape doesn't work, P3 is broken. If the 25-minute shape doesn't work, P2 is
broken. If the 2-hour shape doesn't work, P1 is broken.

---

## 5. Competitive Reference

| Game | What we take | What we avoid |
|---|---|---|
| Cult of the Lamb | Base↔dungeon cadence; readable pixel art; the "one run feeds one build-up" rhythm | Its base is largely a resource funnel; ours must have social stakes |
| RimWorld | Characters as story generators; needs/mood/skills; emergent events | Its 40-hour onboarding cliff |
| Moonlighter | Shop economy tied to dungeon loot | Shallow non-combat half [1](https://www.reddit.com/r/gamingsuggestions/comments/caib37/moonlighter_recettear_both/) |
| Recettear | Pricing/haggling as a *game*, not a menu | Its combat is a chore between shop scenes |
| Loop Hero | Auto-battler readability; "watch it work" satisfaction | Passivity — our player must always have a better option than idling |
| Stardew Valley | Daily rhythm, gifting, seasonal feel | Its near-total absence of threat |

---

## 6. Product Requirements — MVP

Scope key: **P0** = in the MVP, non-negotiable. **P1** = required for 1.0, may follow the MVP.
**P2** = post-launch / nice-to-have. **CUT** = explicitly out.

### 6.1 Systems (P0)

| ID | Requirement | Acceptance criteria |
|---|---|---|
| FR-01 | Isometric pixel-art renderer, tile-based, procedurally generated art | Runs at a stable 60fps on a 2020 mid-range laptop at 1080p; zero external image assets |
| FR-02 | Day/night cycle, 4 seasons, ≥6 weather states | Weather measurably changes farm yield and monster spawn rates; a player can state the current conditions from the HUD |
| FR-03 | Town generation with roads, water, a plaza and a dungeon entrance | Entrance reachable from spawn on 100% of generated seeds (automated test) |
| FR-04 | ≥20 building types, 5 levels each, footprint placement, construction timers, demolition with partial refund | Every type placeable, upgradeable to max and demolishable without error on 100 seeds |
| FR-05 | Resource economy (gold, wood, stone, food, ore) with storage caps and production rates | Rates visible in UI; caps enforced; no resource can go negative or non-finite |
| FR-06 | ≥16 named NPCs with jobs, needs (energy/hunger/social/mood), daily schedules, homes and workplaces | At 03:00 ≥50% are indoors; at 10:00 ≥60% of job-holders are at their post |
| FR-07 | **NPC↔NPC market**: villagers buy from each other on an hourly tick; price responds to supply, relationship, greed; the player collects tax | Money demonstrably moves between NPCs; treasury tax accrues; no NPC can go negative |
| FR-08 | NPC↔player interaction: dialogue, shops, services (heal/craft/research/pets), gifting, relationship tiers that change available options | Every NPC reachable in dialogue; every service purchasable; relationship tier changes at least one option |
| FR-09 | 4 player classes with distinct stats, 3 active skills each, level/stat-point progression | All 12 skills fire and produce their documented effect |
| FR-10 | Equipment across ≥9 slots, 5 rarities, random affixes, legendaries, upgrade path | 5,000 generated items all have finite, in-range stats; rarity distribution matches design table ±20% |
| FR-11 | Procedural dungeon, ≥40 floors, ≥8 authored guardians, elites, fog of war | **Every** floor's stairs, chests and guardian proven reachable by the real pathfinder on 1,000 generated floors |
| FR-12 | Real-time combat with targeting, mitigation, crits, statuses, pets and companions | Monster AI closes distance and lands hits; death returns the player to town with a gold penalty |
| FR-13 | Auto-explore (idle delving) including opening chests and taking stairs | From floor 1, an untouched client reaches floor ≥20 without input |
| FR-14 | ≥7 quest generators plus an authored main questline | Generators never produce an impossible or unverifiable objective |
| FR-15 | ≥10 pets with functional (not cosmetic) roles | Each pet's effect is measurable in the sim |
| FR-16 | Research tree, ≥12 nodes | Every node has an observable effect |
| FR-17 | Save/load with schema versioning; offline progress with a cap; corrupt-save recovery | Round-trips identically; offline capped at 8h; corrupt saves fall back to a new game without throwing |
| FR-18 | Event log, HUD, tooltips, draggable panels, keyboard shortcuts | All 7 panels render; all item types produce a tooltip |

### 6.2 P1 — required for 1.0, may land after the MVP gate

| ID | Requirement |
|---|---|
| FR-20 | 4 distinct dungeon biomes with unique tiles, hazards, monsters and guardians |
| FR-21 | Authored main story, 3 chapters / ~25 quests, with an ending |
| FR-22 | Town crises / raids (subject to Decision D2) |
| FR-23 | Steamworks: achievements (≥25), cloud saves, trading cards |
| FR-24 | Full localisation-ready string extraction; ship EN + ≥2 languages |
| FR-25 | Gamepad support |
| FR-26 | Options: resolution, screen shake, colourblind palette, text scale, autosave interval |
| FR-27 | Compendium / achievements screen |
| FR-28 | Tutorialisation: a first 10 minutes that teaches the loop without a manual |

### 6.3 CUT from this release

Multiplayer and town-visiting · romance arcs · player-character possession/switching · voice
acting · mod tools (data format will be *mod-friendly*, but no editor) · console ports.

---

## 7. Content Targets

| Content | Prototype today | MVP target | 1.0 target |
|---|---|---|---|
| Playable classes | 4 | 4 | 6 |
| Buildings | 17 | 20 | 28 |
| Named NPCs | 13 | 16 | 24 |
| Dialogue nodes / NPC | ~6 pools | 25 | 60 |
| Monsters | 14 | 20 | 45 |
| Guardians | 8 | 8 | 16 |
| Dungeon floors | 40 | 40 | 60 (4 biomes) |
| Item bases | 24 | 30 | 70 |
| Pets | 10 | 10 | 18 |
| Research nodes | 8 | 12 | 28 |
| Quest types | 7 | 7 | 10 + authored line |
| Main story | none | none (MVP) | 3 chapters |
| **Target playtime** | — | **45–60 min demo** | **20–30 h main, 60 h+ completionist** |

---

## 8. Success Criteria

All figures are **[TARGET]** — hypotheses to validate, not industry benchmarks.

**MVP gate (§10.2), internal:** the three-pillar rule of §1.2 demonstrably holds; 3 outside
playtesters each complete a boss floor without being told how.

**Demo (Steam Next Fest):**
- Median demo session ≥ 25 min
- Demo → wishlist conversion ≥ 15%
- ≥ 300 qualitative feedback events triaged into the backlog

**Launch:**
- ≥ 7,000 wishlists at launch (the commonly cited floor for a viable indie first week — treat as a
  go/no-go signal, not a promise)
- ≥ 85% positive reviews in the first 30 days
- Median buyer playtime ≥ 6 h; ≥ 30% of buyers return for a 3rd session
- Refund rate ≤ 5%

**Mobile port gate (post-launch):** ≥ 60fps on a 3-year-old mid-tier Android device; median mobile
session ≥ 12 min; D7 retention ≥ 12%.

---

## 9. Business & Release

- **Price [REC]:** $22.99 at 1.0. Demo free. Launch discount 10%.
- **Release path [REC]:** Steam page live at M2 → demo at Next Fest → **Early Access for 6–9
  months** → 1.0. Early Access fits this design: a systems-heavy village sim improves with public
  balancing feedback, and RimWorld/Cult both benefited enormously from long public tails.
- **DLC (post-1.0):** new biome + chapter; cosmetic town packs. Never gameplay-essential.
- **Mobile [REC]:** premium, ~$6.99, no IAP. Only after the Steam version has ≥1,000 reviews and
  the playtest data says the loop survives short sessions.

---

## 10. Milestones & Exit Criteria

**M0 — Design lock.** *This document signed off (§17).* No code before this.

**M1 — Vertical slice (internal).** The §1.2 rule is proven. Exit: a 20-minute scripted playthrough
in which removing any one pillar makes the run unwinnable; automated test suite green.

**M2 — Steam page + Next Fest demo.** Exit: 45–60 min of content, tutorialised, running on the
target wrapper with Steamworks achievements stubbed in; page live; demo uploaded.

**M3 — Early Access.** Exit: ≥ 80% of P0 and ≥ 60% of P1 complete; crash-free sessions ≥ 99%;
localisation-extracted; save migration path proven across ≥3 versions.

**M4 — 1.0.** Exit: all P1; authored story complete; ≥ 25 achievements; 3 languages.

**M5 — Mobile port.** Exit: §8 mobile gate met. Only started after M4 + testing.

---

## 11. Platform Requirements — Steam (primary)

| ID | Requirement |
|---|---|
| PR-01 | Windows build is the shipped artifact; macOS and Linux are stretch for 1.0 |
| PR-02 | Steamworks via a supported wrapper: achievements, cloud save, overlay, rich presence |
| PR-03 | Cold start to playable in < 8 s on an HDD |
| PR-04 | Install size < 300 MB **[REC]** — a hard constraint if we ship Electron (~150–250 MB of which is the runtime) |
| PR-05 | Saves stored in the OS-standard user data directory, not browser storage, and mirrored to Steam Cloud |
| PR-06 | 60fps at 1080p and 1440p; correct behaviour from 720p to 4K and ultrawide |
| PR-07 | Full keyboard+mouse; gamepad at 1.0 (FR-25) |
| PR-08 | No network dependency for single-player |

---

## 12. Platform Requirements — Mobile (deferred, but binding *now*)

You want the port later. Porting later is only cheap if these constraints are respected from M1.
Each is a **now-decision**, not a later one:

| ID | Constraint | Why it must be decided now | Prototype status |
|---|---|---|---|
| MR-01 | **Input abstraction layer.** One module turns keyboard/mouse/touch/gamepad into game *intents*. Gameplay never reads a raw event. | Retrofitting this across 6,700 lines is a rewrite of every interaction | ❌ Input is bound ad hoc in `game.js`/`ui.js` |
| MR-02 | **No hover-only affordances.** Every tooltip/action must also work on tap and long-press. | Hover does not exist on touch | ❌ Tooltips are pointermove-driven |
| MR-03 | **≥44 px tap targets** for every interactive control | Retrofitting layouts is painful | ⚠️ Partially (hotbar is 42–46 px; needs audit) |
| MR-04 | **No right-click-only actions.** Every right-click must have a visible button equivalent. | Touch has no right-click | ✅ Fixed — placement has a visible CANCEL button |
| MR-05 | **Fixed internal resolution, letterboxed & integer-scaled** | Makes one render path work on every screen | ✅ 480×270 internal, integer scale |
| MR-06 | **UI anchored, not absolutely positioned per-pixel**; must reflow for portrait | Desktop-only layouts die on phones | ⚠️ Panels are draggable with absolute coords |
| MR-07 | **Portable, versioned save format** (plain JSON + schema version + migrations) | Saves must move desktop→cloud→mobile | ⚠️ JSON + version flag exists; no migration path |
| MR-08 | **Performance budget**: ≤1.5 ms/frame JS on a mid-tier phone; no per-frame allocation in hot loops | Sim + particles + 46×46 iso map must fit | ⚠️ Sprite caching done; GC pressure unmeasured |
| MR-09 | **All content in data, not code** (items, monsters, buildings, dialogue, quests) | Enables localisation, balancing and modding without touching logic | ⚠️ Centralised in `data.js`, but not externalised |
| MR-10 | **All strings externalised** | Localisation after the fact costs 3× more | ❌ Hardcoded English throughout |

**Honest read:** the prototype is *structurally* mobile-friendly (MR-04/05) but has four real
blockers (MR-01, MR-02, MR-07, MR-10). None are expensive if fixed at M1. All are expensive at M4.

---

## 13. Engine & Architecture — the decision that gates everything

Three viable paths. This is **Decision D1** in §17.

**Option A — Stay JavaScript/Canvas. Wrap for Steam. Capacitor for mobile later.**
- *Precedent:* Vampire Survivors was built in Phaser (JavaScript) and shipped on Steam in that
  form; Poncle only migrated to Unity afterwards, for performance and to unify console/mobile, and
  ran both builds in parallel on PC for a period
  [4](https://news.ycombinator.com/item?id=37918717)[5](https://www.rockpapershotgun.com/vampire-survivors-makes-its-full-leap-to-a-new-engine-next-month-bringing-better-performance-and-stability).
- Steamworks works from a browser context via `steamworks.js`, and Electron/NW.js are the wrappers
  officially supported by the main Steam distribution libraries
  [2](https://www.summerengine.com/make-great-games/threejs-game-on-steam)[3](https://www.webgamedev.com/publishing/desktop).
  Tauri is lighter but has known friction with `steamworks.js`
  [4](https://jslegenddev.substack.com/p/the-struggle-of-wrapping-a-javascript).
- **Cost:** lowest. **Risk:** install size (PR-04), performance ceiling, WebView variance on mobile.

**Option B — Port to Godot 4.**
- Native builds for desktop *and* mobile, tiny binaries, GodotSteam, a real editor for content.
- **Cost:** 4–8 weeks of rewrite before any new content. The procedural art and the sim logic both
  port cleanly (they are just drawing calls and data), so this is a translation, not a redesign.
- **Risk:** schedule; losing momentum; the "no external assets" identity survives but is less natural.

**Option C — Unity.** Broadest platform reach and the best mobile tooling; heaviest licensing and
runtime considerations; largest rewrite.

**[REC] Option A for M1→M3, with a hard revisit at M3.** Rationale: the fastest route to a *tested*
loop is the one that keeps the working prototype, and the VS precedent shows a JS build can carry a
Steam launch. But the revisit at M3 must be real, because MR-01/MR-08 are exactly the things that
decide whether the mobile port is a weekend or a quarter. Doing MR-01 (input abstraction) and MR-09
(content-as-data) *regardless* of engine choice keeps Option B open at low cost — that is the
hedged part of the recommendation, and it is not optional.

---

## 14. Existing Prototype — Disposition Audit

You asked to decide what to keep after reading this. Here is the material. **Nothing has been
changed in the codebase while writing this document.**

| Module | Lines | Maps to | Verdict **[REC]** |
|---|---|---|---|
| `js/util.js` — RNG, noise, math, storage, event bus | 162 | Cross-cutting | **KEEP.** Clean, engine-agnostic, ports anywhere |
| `js/data.js` — all content tables | 488 | FR-04…FR-16, MR-09 | **KEEP but externalise** to JSON. The *numbers* here are the most valuable asset in the repo — they are balance-tuned and test-verified |
| `js/sprites.js` — procedural pixel art | 809 | FR-01 | **KEEP.** 116 tile variants, 102 building sprites, 36 humanoid frames, 14 monster bodies, all cached. Genuinely distinctive |
| `js/world.js` — maps, A\*, generation | 375 | FR-03, FR-11 | **KEEP.** Verified across 1,000 generated floors |
| `js/items.js` — items, affixes, derived stats | 305 | FR-10 | **KEEP.** 5,000-item generation validated |
| `js/npc.js` — needs, schedules, market, relationships | 592 | FR-06…FR-08 | **KEEP.** This is pillar P1 and it works |
| `js/build.js` — placement, production, workers | 282 | FR-04, FR-05 | **KEEP** |
| `js/combat.js` — monsters, skills, pets, transitions | 673 | FR-09, FR-12, FR-15 | **KEEP** |
| `js/quests.js` — 7 generators | 223 | FR-14 | **KEEP** (authored story is net-new, FR-21) |
| `js/render.js` — iso renderer, lighting, weather | 478 | FR-01, MR-05 | **KEEP** |
| `js/ui.js` — panels, dialogue, shops, tooltips | 1,466 | FR-18, MR-02/03/06 | **REWORK.** Largest module and the least portable: hover tooltips, absolute-positioned draggable panels, no input abstraction |
| `js/game.js` — state, loop, input, save | 878 | FR-17, MR-01/07 | **REWORK.** Split into `state`, `loop`, `input` (MR-01) and `save` (MR-07 migrations) |
| `tools/smoke.js` + `tools/domstub.js` | — | All FR acceptance criteria | **KEEP — highest-value item in the repo.** 88 assertions that play the game headlessly, including 1,000-floor reachability proofs and a cold boot through the real entry point |

**Net:** ~5,000 of 6,700 lines carry over as-is; ~2,350 lines (ui.js, game.js) need restructuring
to satisfy §12. If Option B is ever chosen, `data.js` + `smoke.js` + the tuned numbers are what
survive intact — which is most of the project's accumulated knowledge.

**Current verified state:** 88/88 checks green, repeatedly. Every guardian floor 5–25 confirmed
killable and passable by a level-appropriate hero. Known open balance issue: past ~floor 25 the
monster curve outruns an unequipped hero, so gear progression needs a tuning pass (§16, R4).

---

## 15. Playtest & Metrics Plan

You said mobile comes "after further testing." This is what testing means concretely.

**Instrument before M2** (all local, opt-in, privacy-safe — no PII, no accounts):
- Session length, sessions per day, days retained
- Depth reached per session; death causes
- Buildings built by type and order; resources bottlenecked
- Time-to-first-boss-floor; time-to-first-death
- Which NPCs were spoken to / gifted / hired; which were ignored
- Idle-vs-active ratio (validates P3)
- Where players quit mid-session (the single most valuable number we can collect)

**Playtest protocol:**
- **Internal (M1):** 3 sessions, think-aloud, no instructions given. Success = they complete a boss
  floor and can *explain* the loop back to us.
- **Closed beta (M3):** 25–50 players via Steam Playtest. Survey at 30 min and 3 h.
- **Next Fest (M2):** public demo; watch median session length and the quit-point histogram.

**Balance authority [REC]:** the automated harness stays the source of truth for *correctness*;
human playtests decide *feel*. No balance change ships without a harness assertion attached to it —
this is what stopped the boss double-scaling bug (§16, R4) from surviving, and it should be policy.

---

## 16. Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | **"Nothing is scaffolding" triples content cost.** Three deep systems need three sets of content, art and balance | Fatal to schedule | High | One shared economy (§1.2) so systems multiply rather than add; hard scope gates at M1; cut breadth (biomes, monsters) before cutting depth |
| R2 | **Mobile port retrofitted too late** — MR-01/02/07/10 become a rewrite | Major | Medium-High | Do MR-01, MR-09 and MR-10 at M1 regardless of engine; revisit engine at M3 |
| R3 | **Idle mechanics read as "cheap web game" to premium Steam buyers** | Major | Medium | P3 as written: idle is convenience, never a gate. Market on the village, not the numbers |
| R4 | **Balance curve breaks in late game** (already observed past floor 25) | Moderate | High | Harness-driven tuning; publish a balance changelog in EA; add a difficulty slider |
| R5 | **Solo/small-team burnout across a 12–18 month premium arc** | Fatal | Medium | Early Access to share the load with the community; strict P0/P1 discipline |
| R6 | **Save-format churn invalidates player saves during EA** | Moderate | High | MR-07 migrations from the first EA build, never later |
| R7 | **Procedural art reads as "programmer art" in screenshots** | Moderate | Medium | Invest in palette/lighting/composition at M2; screenshots sell Steam pages |
| R8 | **Steamworks wrapper limits** (size, overlay, achievement edge cases) | Minor-Moderate | Medium | Validate the wrapper at M1 with a spike, not at M3 |

---

## 17. Decisions Required for Sign-off

Each needs a yes/no/alternative from you. **[REC]** is my recommendation.

| # | Decision | Options | **[REC]** |
|---|---|---|---|
| **D1** | Engine & wrapper (§13) | A: stay JS/Canvas + Electron/NW.js · B: port to Godot 4 · C: Unity | **A**, with MR-01 + MR-09 done at M1 and a hard engine revisit at M3 |
| **D2** | **Does the town ever lose things?** Raids, building damage, NPC injury/death | Yes (real stakes, contradicts "cozy") · No (purely constructive) · Yes but recoverable-only | **Yes but recoverable-only** — buildings can be damaged and repaired, NPCs can be wounded and healed, nothing is permanently lost. Gives P1 stakes without griefing an idle player |
| **D3** | **Player perspective** | Fixed Warden you control · A "spirit of the hold" that can possess/switch heroes | **Fixed Warden.** Cheaper, stronger attachment, cleaner save design. Switching heroes is a P2 idea |
| **D4** | **Combat weight** | Active (Diablo-like kiting/builds) · Auto-battler (set up, watch) · Both, switchable | **Both, switchable** — active play must outperform idle (P3), but auto-explore must be genuinely viable |
| **D5** | Multiplayer town-visiting | In scope · Out forever · Out for launch, architected for | **Out for launch, architected for** — no co-op code, but keep the sim deterministic and serialisable |
| **D6** | Romance / deep relationship arcs | Light friendship only · Full arcs | **Light friendship at 1.0.** Full arcs are a strong DLC candidate |
| **D7** | Art scale | Chunky 16px (current) · Finer 32px Hi-Bit | **Keep 16px.** It is what the procedural generator does well and it holds up at mobile resolutions |
| **D8** | Release path | Straight to 1.0 · Early Access | **Early Access** (6–9 months) |
| **D9** | Price | $14.99 / $19.99 / $22.99 / $24.99 | **$22.99** at 1.0; revisit after Next Fest wishlist data |
| **D10** | Disposition of the existing build (§14) | Keep & polish · Cut down · Reference only | **Keep & polish**, starting with the two rework modules (`ui.js`, `game.js`) |
| **D11** | MVP scope confirmation | §6.1 as written · trim · add | **As written.** If it must be trimmed, cut FR-16 (research) and FR-15 (pets) first — they are the two pillars that least affect the §1.2 rule |

### Sign-off

```
D1  ____   D2  ____   D3  ____   D4  ____   D5  ____   D6  ____
D7  ____   D8  ____   D9  ____   D10 ____   D11 ____

Approved to proceed to M1:  ____ / date ____
Notes:
```

---

## Appendix A — What changed since the GDD

`GDD.md` was written first and describes systems as designed. This PRD supersedes it on **scope,
priority, platform and process**. Where they disagree, this document wins. `GDD.md` §17 remains
the accurate record of what the prototype actually contains and which bugs the harness caught.

## Appendix B — Reproducing the prototype's verification

```
node tools/smoke.js      # 88 assertions, exits non-zero on any failure
```

Headless: no browser required. Parses the real `index.html` into a DOM tree so missing elements
fail loudly instead of being silently invented.
