# EMBERHOLD — Product Requirements Document

| | |
|---|---|
| **Version** | **0.3 — COMPLETE. All decisions resolved; awaiting your signature (§18)** |
| **Date** | 2026-11-03 |
| **Owner** | You (product) · Qwen (drafting, implementation) |
| **Companion docs** | `GDD.md` (systems design, §17 = prototype build notes) · `PRD-v0.1-archived.md` (superseded draft) |
| **Status** | **No code will be written against this document until §18 is signed off.** |

> **What changed in v0.3.** All nine open decisions from v0.2 §18 are resolved and folded into the
> body of the document. Three are worth reading even if you read nothing else: **D12** chose a
> **Forward Outpost** over meta-unlock — a real scope increase, and the reason §8.4 exists; **D15**
> chose to leave the loss model gentle, which §10.5 now records together with its consequence and
> the specific lever to pull if it turns out wrong; and **D1/D8** confirmed the hedged JS engine path
> and Early Access.
>
> **What changed in v0.2.** The design conversation moved the product substantially. v0.1 framed
> Emberhold as three equal pillars (village / dungeon / idle). It is not that. **Base building is
> the product**; villagers and the dungeon are the two engines that feed it. v0.2 rewrites the
> pillars (§3), the loop (§4), and scope (§7), adds the Kairosoft-derived systems (§5–§6), the
> location-select system (§8), the dungeon and expedition model (§9), and the **Breach &
> Retaliation** system (§10). Price is corrected (§12). The decision list is new (§18).
>
> **Carried forward unchanged from v0.1:** competitive research (§4.1), Steam platform
> requirements (§13), mobile constraints MR-01…MR-10 (§14), the prototype disposition audit (§15),
> the playtest plan (§16).
>
> **Legend.** **[LOCKED]** = you decided this; it is not open. **[REC]** = my recommendation,
> still open for argument. **[TARGET]** = a number we are setting, not one we have verified.
> *(v0.2 also used **[ASSUMED]** for defaults chosen when a question was skipped. There are none
> left — each has since been confirmed or superseded.)*

---

## 1. Product Overview

**Emberhold** is a premium isometric pixel-art **village builder**. You choose a starting location,
raise a settlement, and the settlement produces the heroes who delve the dungeons beneath it. When
they fail, the dungeon comes to you.

The pitch in one line:

> **Your village is your character sheet.**

The longer version:

> ***Dungeon Village*'s systems, with villagers who are actually people.** Kairosoft proved the
> loop — build facilities, raise adventurers, send them down, spend the loot on more facilities.
> Kairosoft also famously refuses to explain any of it; their games live and die by wikis.
> Emberhold keeps the loop and makes every number on screen. And then it adds the thing Kairosoft
> never built: **a consequence.** Fail a dungeon and it opens a hole in your village.*

**Product type.** Premium (paid, one-time purchase). No IAP, no ads, no energy timers.
**Primary platform.** Steam (Windows, macOS, Linux).
**Secondary platform.** Mobile (iOS/Android), post-launch, gated on playtest results (§16).
**Engine.** Decision D1, §18 — currently JavaScript + Canvas 2D.

### 1.1 The hierarchy of systems

This ordering is the single most important sentence in the document. It resolves every scope
argument downstream.

```
        BASE BUILDING  ← the product. What you do. What you look at. What you optimise.
              ▲
              │  produces facilities, which produce stat growth,
              │  which produces recruitable adventurers
              │
        VILLAGERS      ← engine 1. Living people with jobs, needs, relationships.
              ▲
              │  adventurers delve, bring back materials,
              │  and failing them opens a Breach in your territory
              │
        THE DUNGEON    ← engine 2. The source of materials and the source of consequences.
```

Nothing in the dungeon or the villager layer exists for its own sake. Both exist to give base
building **inputs it cannot get elsewhere** and **consequences it cannot ignore**.

### 1.2 The non-negotiable design rule

> **Every system must be a *cause* in base building, not just a consumer of it.**

Concretely: the dungeon must be the only source of the materials that high-tier facilities need;
villager jobs must be the only source of the stats that make adventurers; and failure must land on
the village rather than on a score screen. If a system can be ignored for 30 minutes without the
village noticing, it is scaffolding and the pitch is a lie.

This is the acceptance test for M1 (§17.2).

### 1.3 The player never holds a joystick **[LOCKED]**

There is no directly controlled character. The player is the **Warden** — a steward figure who is
present in the fiction and never in the combat. Everything the player does is indirect:

| The player CAN | The player CANNOT |
|---|---|
| Place, upgrade, demolish and position buildings | Move any character directly |
| Give a villager equipment and consumables | Attack, block, dodge or target |
| Recruit a villager as an adventurer and choose their class | Steer a fight once it has begun |
| Issue an Expedition Order (depth, retreat condition, loot priority) | Control which building a villager visits for leisure |
| Open a live view of any fight at any time | — |
| Spend 2–3 command points during a village raid | — |

The reference points are Loop Hero and Backpack Battles: **set it up, watch it work, learn why it
failed, change the setup.** The satisfaction is in the preparation, and the live view exists to make
the preparation legible.

---

## 2. Audience

**Primary.** PC players, 25–45, who own Kairosoft games / RimWorld / Cult of the Lamb / Stardew
Valley and have 20+ hours to sink. They read patch notes, they build spreadsheets, and they punish
opaque systems hard in reviews.

**Secondary.** Idle/incremental players who want depth attached to the numbers, and auto-battler
players (Loop Hero, Backpack Battles, Despot's Game) who enjoy preparation-over-execution.

**Tertiary (post-launch).** Mobile players in short sessions. Not designed for at MVP, but must not
be designed *out* — see §14.

**Who this is not for.** Players expecting an action-RPG skill ceiling. There is no moment-to-moment
control and there never will be (§1.3). Marketing must not imply otherwise — that mismatch is how
 hybrids like Moonlighter end up with "the selling point was empty" as their top review.

---

## 3. Design Pillars

v0.1's "three equal pillars" framing is **withdrawn**. These are ordered.

| # | Pillar | What it means in practice | What it forbids |
|---|---|---|---|
| **P1** | **Building is the game** | The village map is the primary screen. Every other system exists to change what you can build or how well it runs. Progression is measured in facilities, adjacency combos and village rank. | A dungeon crawler with a town menu. Any UI that makes the village a submenu of the delving. |
| **P2** | **Your buildings decide who you can field** | Jobs train stats. Stats gate classes. So a village of farms can only ever produce warriors. To field a mage you must build and staff something that trains INT. | Classes available regardless of what you built. Any path to a strong party that does not run through construction. |
| **P3** | **Failure arrives at your front door** | Fail a dungeon and a Breach opens in your territory. Ignore it and it escalates into a Retaliation. The dungeon is not a separate place you visit; it is a neighbour. | Consequences that resolve off-screen into a score. Any raid that is a surprise. |
| **P4** | **Nothing is permanent, everything costs time** | Villagers are downed, never dead. Buildings go offline, never destroyed. A bad night costs you a day of your village, and a day of your village is genuinely expensive. | Permadeath. Building loss. Any state a player cannot recover from by playing. |
| **P5** | **Every number is on screen** | Kairosoft's opacity is the weakness we attack. Tooltips explain the full calculation. No hidden rolls, no wiki dependency. | Hidden modifiers. "Trust me" mechanics. Any rule a player cannot discover without a community wiki. |
| **P6** | **Idle is an accelerator, never a gate** | Offline catch-up, auto-expeditions and a village that runs without you are conveniences. A watching player always outperforms an idle one. | Timers that block play. Anything that punishes being present. |

**Anti-pillars — explicitly not in this product.**
- No multiplayer at launch (D5, carried from v0.1).
- No procedural *story*. Events are systemic; authored content is authored.
- No live-service monetisation. One price, plus optional DLC later.
- No photorealism, no 3D, no voice acting.
- **No tower defence.** Defence is people, not structures (§10.4).

---

## 4. Core Loop

```
   CHOOSE A LOCATION
   terrain · resources · starting villagers · signature dungeon
        │
        ▼
   BUILD FACILITIES ──────────────────────────────────────┐
   production · kiosk · vacation · decoration             │
        │                                                 │
        │ villagers work them; jobs train stats           │
        ▼                                                 │
   STAT GROWTH                                            │
   Farmer→STR  Miner→STR+GRIT  Courier→SPD  Scribe→INT    │
        │                                                 │
        │ stat crosses a class requirement                │
        ▼                                                 │
   RECRUIT AN ADVENTURER  (player choice: which class)    │
        │                                                 │
        │ they are now often absent                       │
        ▼                                                 │
   EXPEDITION ORDER → DELVE                               │
   target depth · retreat condition · loot priority       │
        │                                                 │
   ┌────┴─────────────────┐                               │
   │ SUCCEED              │ FAIL (boss loss)              │
   │ materials, depth     │                               │
   │ gate opens           │  a BREACH opens in your       │
   │                      │  territory — a spawned        │
   │                      │  dungeon, max 2 at once       │
   │                      │                               │
   │                      │  ignored, it escalates:       │
   │                      │  RETALIATION, 1 day's warning │
   │                      │                               │
   │                      │  defenders = whoever is home  │
   │                      │  loss = DOWNTIME              │
   │                      │  buildings offline, villagers │
   │                      │  downed, nothing destroyed    │
   └────┬─────────────────┴──────────┬────────────────────┘
        │                            │
        └──────→ spend on ───────────┘
                 more facilities
```

**The central tension, stated once:**

> Your adventurers are simultaneously your delving party, your entire defence, and your labour
> force. So the question every day is **who is home?**
>
> Send everyone deep for the big haul and the village is naked when the Breach opens. Keep them
> home and you cannot advance, cannot get materials, cannot rank up.

Everything else in this document serves that question.

**Session shapes the loop must serve:**
- **5 min** — collect overnight output, re-place one building, issue an expedition order, close.
- **25 min** — one full cycle: recruit, equip, delve a boss floor, deal with the Breach it opened.
- **2 h** — a village rank-up: new facility tier, new adjacency combo, a signature-dungeon push.

If the 5-minute shape fails, P6 is broken. If the 25-minute shape fails, P3 is broken. If the
2-hour shape fails, P1 is broken.

### 4.1 Competitive reference *(carried from v0.1, Kairosoft and Backpack Battles added)*

| Game | What we take | What we avoid |
|---|---|---|
| **Kairosoft *Dungeon Village* 1 & 2** | The whole spine: facilities that raise stats, adjacency bonuses, facility capacity, village rank gating unlocks, recruiting adventurers from your population | **Opacity.** Their games are unplayable-without-a-wiki. P5 exists purely to attack this |
| **Loop Hero** (~2M Steam, 1M mobile) | Set-up-and-watch; the player shapes the *conditions* of a fight, never the fight. Auto-battler legibility | Passivity — our player must always have a better option than idling |
| **Backpack Battles** (640k first month) | Preparation *is* the game; a demo can carry the whole pitch | Its single-run structure — ours is a persistent village |
| RimWorld (~7.4M, ~$199M) | Characters as story generators; needs, mood, relationships; emergent events | Its 40-hour onboarding cliff, and permadeath — P4 rejects it |
| Cult of the Lamb (~5.1M, ~$68.8M) | Base↔dungeon cadence; readable pixel art | Its base is largely a resource funnel with no social stakes |
| Moonlighter | Shop economy tied to dungeon loot | **The failure mode to fear.** A shallow non-combat half is why it is remembered as "the selling point was empty" |
| Recettear | Pricing/haggling as a game, not a menu | Its combat is a chore between shop scenes |
| Stardew Valley | Daily rhythm, gifting, seasonal feel | Its near-total absence of threat — P3 is our answer |

---

## 5. Buildings — the four categories **[LOCKED]**

Your taxonomy, unchanged. **There is no fifth category and there never will be** — defence is not a
building type (§10.4).

| Category | Function | Examples |
|---|---|---|
| **Production** | Outputs resources. Also the stat-training ground for whoever works there. | Farm, mine, quarry, lumberyard, apothecary garden, smithy, scriptorium |
| **Kiosk / Stall / Shop** | Where the villager↔villager market happens. The player taxes it. Also sells consumables to adventurers. | Market stall, general store, travelling cart, tavern counter |
| **Vacation** | Slowly raises stats. Also the recovery mechanic for downed villagers and offline buildings. | Bathhouse, gym, shrine, infirmary, tea house |
| **Decoration** | Buffs *only* the tiles it physically touches, via shaped footprints. | Fountain, statue, hedge, banner, flowerbed |

### 5.1 Capacity, not job-locks **[LOCKED]**

> **All characters can use all facilities. Nothing is bound by job or class.**

So a building does not *require* a farmer; it has a **capacity** — how many villagers can be inside
using it at once.

```
throughput  =  base_rate
             × occupancy_factor   (villagers present ÷ capacity)
             × match_bonus        (+% when a villager's job suits the building)
             × adjacency_bonus    (§5.2)
             × weather/season     (§9.4)
             × downtime_penalty   (0 while offline after a raid, §10.5)
```

- A scribe *can* farm. A farmer farms **better**.
- Duplicates of the same building add total capacity, in the *Dungeon Village 2* manner (an inn
  holding 4, a second inn holding 4 more).
- **Consequence worth stating:** the double-gate deadlock risk that v0.1 flagged is gone. You can
  never be stuck needing a job you do not have, because no building demands one.
- **Consequence worth designing for:** job-matching becomes an optimisation puzzle with a ceiling,
  not a hard requirement. Gentle, but with somewhere to go.

### 5.2 Decoration adjacency — shaped footprints **[LOCKED]**

Decorations buff **only the tiles they physically touch**, and the shape is directional:

| Shape | Touches | Use |
|---|---|---|
| Line (1×3) | tiles along one face | edge of a farm block |
| L | two faces at a corner | corner of a plaza |
| Cross | all four faces | centrepiece |
| Single | the 4 orthogonally adjacent tiles | filler |

This is deliberately stricter than Kairosoft's "8 surrounding tiles" rule, because a shaped footprint
turns decoration into a **spatial puzzle** rather than a sprinkle. It is also the mechanism the
Breach system reuses (§10.6), which is why it must be built generically from the start.

### 5.3 Adjacency combos are the escape valve **[LOCKED]**

Certain building pairs adjacent to each other produce a named **combo** with a bonus larger than the
sum of its parts (Smithy + Quarry = *Foundry Work*; Bathhouse + Shrine = *Purification*; Farm +
Barn = *Harvest Cycle*).

Design reason, not flavour: **combos cost no materials from the dungeon.** When a player is caught
between the rank gate and the depth gate (§11), reshuffling their existing buildings for combos is
always available and always helps. It is the guaranteed way out of a stall, and it must never be
removed or gated.

---

## 6. Villagers

Named, persistent, with jobs, needs, schedules, homes, relationships and memory. The prototype's
`npc.js` (592 lines: needs, schedules, market, relationships) already implements most of this and is
marked KEEP in §15.

### 6.1 Jobs train stats **[LOCKED]**

This is the load-bearing rule of the entire design. A villager's job grows the stats that job
physically demands, and those stats are what make them recruitable as adventurers.

| Job | Trains | Classes it unlocks |
|---|---|---|
| Farmer | STR | Warrior |
| Miner / Quarrier | STR, GRIT | Guardian |
| Woodcutter | STR, END | Berserker |
| Courier | SPD | Scout |
| Scribe / Clerk | INT | Mage |
| Herbalist | INT, WIS | Healer |
| Cook | WIS, LCK | Alchemist |
| Smith | STR, INT | Artificer |
| Stallkeeper | LCK, CHA | Broker |

**So your production layout determines your army.** A village of farms fields warriors. To field a
healer you must build an apothecary and staff it. This is P2, and it is the reason base building is
the product rather than the backdrop.

### 6.2 Vacation buildings are the second training path

A villager in a non-physical job still grows slowly at the gym, bathhouse and shrine. This keeps the
vacation category mechanically load-bearing rather than decorative — and it becomes essential under
§10.5, because those same buildings are what shorten a downed villager's recovery.

### 6.3 Leisure is needs-driven, not assigned **[LOCKED]**

The player never tells a villager to go relax. Villagers visit vacation buildings **on their own**,
driven by their own needs and mood. The player influences this only by building — which is exactly
the indirect-control contract of §1.3.

### 6.4 The villager↔villager market

Villagers buy from each other at kiosks on an hourly tick; price responds to supply, relationship
and greed; the player collects tax. Already implemented in the prototype (FR-07 in v0.1, retained).
It matters here because it makes kiosks a real category rather than a vending machine, and because a
villager's mood about their purchases feeds the needs system that drives leisure.

### 6.5 Adventurer recruitment **[LOCKED]**

- **Player-initiated.** A villager becomes an adventurer only when you choose it.
- **Stat-gated.** The player picks the class freely, **but only among classes whose stat
  requirement that villager meets.** A farmer with STR 14 may be a Warrior or a Guardian; they may
  not be a Mage, because nobody in a farming village has the INT.
- **Base building sets the menu, the player makes the choice.** Directional, not deterministic — this
  is strictly better than auto-assigning a class from the job, because it preserves the one lever the
  player is supposed to have.
- **Adventurers still work facilities when home, at a reduced rate [LOCKED — D14].** Rationale: at full
  rate, recruiting everyone is free and the central tension collapses; at zero rate, promotion is a
  cliff in a game that promises nothing permanent (P4). Reduced rate is the only option consistent
  with both. **[TARGET]** −35% effectiveness while holding an adventurer class.

**Balance rule that must not be broken:** *the shared dungeon pool must be clearable with any class
mix.* Classes are optimisations, never requirements. Otherwise a player who never built an
apothecary is soft-locked out of healing forever — a worse trap than any Breach.

---

## 7. Product Requirements — MVP

Scope key: **P0** = in the MVP, non-negotiable. **P1** = required for 1.0, may follow the MVP gate.
**P2** = post-launch. **CUT** = explicitly out.

Requirements marked ✅ are **already implemented and verified** in the prototype (88/88 smoke checks,
§15). They are listed because they must not regress.

### 7.1 Core systems (P0)

| ID | Requirement | Acceptance criteria | Status |
|---|---|---|---|
| FR-01 | Isometric pixel-art renderer, tile-based, procedurally generated art, zero external image assets | Stable 60fps at 1080p on a 2020 mid-range laptop | ✅ |
| FR-02 | Day/night, 4 seasons, ≥6 weather states, all feeding production rates | Weather and season measurably change throughput; conditions readable from the HUD at a glance | ✅ (rate coupling partial) |
| **FR-03** | **Fixed-timestep simulation** with deterministic, reproducible outcomes | Same seed + same inputs = byte-identical state after 6,000 frames; the abstract result of any fight equals what the live view would have shown; save/load and offline catch-up round-trip exactly | ❌ **P0 blocker** — see §7.2 |
| FR-04 | ≥20 building types across the four categories, 5 levels each, footprint placement, construction timers, demolition with partial refund | Every type placeable/upgradeable/demolishable without error on 100 seeds | ⚠️ 17 types, no category taxonomy |
| **FR-05** | **Facility capacity + occupancy** (§5.1): every building holds N villagers; throughput scales with occupancy and job-match bonus | Throughput formula matches §5.1 exactly and is fully shown in the tooltip (P5) | ❌ new |
| **FR-06** | **Shaped decoration adjacency** (§5.2) with line/L/cross/single footprints | A decoration buffs only physically touched tiles; footprint shape visible before placement | ❌ new |
| **FR-07** | **Adjacency combos** (§5.3), ≥8 named pairs, none requiring dungeon materials | Every combo is discoverable in-game without a wiki; combos are re-achievable after a total loss | ❌ new |
| FR-08 | Resource economy (gold, wood, stone, food, ore) with storage caps and visible production rates | Rates visible; caps enforced; no resource can go negative or non-finite | ✅ |
| FR-09 | ≥16 named villagers with jobs, needs, schedules, homes, relationships | At 03:00 ≥50% indoors; at 10:00 ≥60% of job-holders at their post | ✅ |
| FR-10 | Villager↔villager market on an hourly tick, with player tax | Money demonstrably moves between villagers; treasury tax accrues; no villager goes negative | ✅ |
| **FR-11** | **Job-driven stat growth** (§6.1) with per-job training rates | Each job measurably grows its documented stats; rates visible per villager | ❌ new |
| **FR-12** | **Needs-driven leisure** (§6.3): villagers choose to visit vacation buildings; those buildings raise stats and shorten downtime | No player assignment exists or is needed; visit frequency correlates with need levels | ⚠️ needs exist, leisure effect does not |
| **FR-13** | **Adventurer recruitment** (§6.5): player-initiated, stat-gated, free class choice within what stats allow | A villager who does not meet a class's requirement cannot be recruited into it; the reason is shown in the UI | ❌ new |
| FR-14 | Equipment across ≥9 slots, 5 rarities, random affixes, legendaries, upgrade path | 5,000 generated items all finite and in range; rarity distribution ±20% of the design table | ✅ |
| FR-15 | ≥8 classes with distinct stats, 3 active skills each, and a class-advance line | All skills fire and produce their documented effect; advancement requirements are visible | ⚠️ 4 classes, no advance line |
| **FR-16** | **Location select** (§8): 3 locations, each with distinct terrain, resource mix, starting villagers and signature dungeon | Each location is completable; no location can soft-lock the main progression | ❌ new |
| FR-17 | Procedural multi-floor dungeons, ≥40 floors, ≥8 authored guardians, elites, fog of war | **Every** floor's stairs, chests and guardian proven reachable by the real pathfinder on 1,000 generated floors | ✅ **proven** |
| **FR-18** | **Expedition Orders** (§9.2): target depth, retreat condition, loot priority, executed autonomously | An untouched client reaches floor ≥20 from floor 1; retreat before a boss always succeeds and always costs nothing | ⚠️ auto-explore exists, orders do not |
| FR-19 | Real-time auto-battler combat with targeting, mitigation, crits, statuses, pets, companions | Monster AI closes distance and lands hits; outcomes deterministic per FR-03 | ✅ |
| **FR-20** | **Switchable dungeon visibility** (§9.3): abstract sim + report by default, live isometric view on demand | Abstract result and live result are **identical** for the same seed (this is what FR-03 exists for) | ❌ new |
| **FR-21** | **Breach spawning** (§10.1–10.3): failure and natural events open Breaches in the territory, max 2, randomised floors | Cap enforced; a Breach never spawns on a building; a Breach is never deeper than the player's deepest reached floor | ❌ new |
| **FR-22** | **Retaliation raids** (§10.4–10.6): escalation, one-day warning, auto-battle resolution, downtime-only losses | No raid ever resolves while the game is closed; no villager ever dies; no building is ever destroyed; the warning is always visible ≥1 full day ahead | ❌ new |
| **FR-23** | **Live raid view with limited orders** (§10.4): watchable on demand, 2–3 command points | Command points are the *only* real-time input in the game; spending them changes the outcome measurably | ❌ new |
| **FR-24** | **Village rank / star progression** (§11.1) gating facility tiers | Every rank's requirements and rewards visible before they are met | ❌ new |
| FR-25 | ≥7 quest generators plus an authored opening | Generators never produce an impossible or unverifiable objective | ✅ |
| FR-26 | ≥10 pets with functional (not cosmetic) roles | Each pet's effect measurable in the sim | ✅ |
| FR-27 | Save/load with schema versioning, migrations, offline catch-up with a cap, corrupt-save recovery | Round-trips identically; offline capped at 8h; corrupt saves fall back to a new game without throwing | ⚠️ works, no migrations |
| FR-28 | Event log, HUD, tooltips, draggable panels, keyboard shortcuts, and **full-calculation tooltips** (P5) | Every number the sim uses is reachable from the UI within two clicks | ⚠️ panels exist, calculations not exposed |

### 7.2 FR-03 is the P0 blocker **[LOCKED]**

The simulation must run on a **fixed timestep** with deterministic, seeded outcomes. This is not a
polish item; three separate locked decisions are impossible without it:

1. **Switchable dungeon visibility (FR-20).** If the abstract sim and the live view can disagree,
   the player who opens the live view is playing a different game from the player who does not. They
   must be the same computation, rendered two ways.
2. **Breach generation and raid resolution (FR-21/22).** These are simulation events with combat
   outcomes. They must be reproducible or save/load breaks.
3. **Offline catch-up (FR-27).** Fast-forwarding 8 hours must produce the same state as having been
   present, or the idle pillar is a lie and players will find the seam.

The prototype currently runs variable-timestep. **This is the first thing that gets rebuilt, before
any new feature**, and it is why §17's M1 milestone is gated on it.

### 7.3 P1 — required for 1.0, may land after the MVP gate

| ID | Requirement |
|---|---|
| FR-30 | The remaining 3 locations (§8): Mere's End, Salt Reach, Frostholm |
| FR-31 | Breach adjacency effects — Blighted / Infused (§10.6) |
| FR-32 | **Forward Outpost** (§8.4): peaking a location lets you establish an outpost in another, staffed from home, opening that region's signature dungeon |
| FR-33 | 4 distinct dungeon biomes with unique tiles, hazards, monsters and guardians |
| FR-34 | Authored main story, 3 chapters / ~25 quests, with an ending |
| FR-35 | Steamworks: achievements (≥25), cloud saves, trading cards |
| FR-36 | Full localisation-ready string extraction; ship EN + ≥2 languages |
| FR-37 | Gamepad support |
| FR-38 | Options: resolution, screen shake, colourblind palette, text scale, autosave interval |
| FR-39 | Compendium showing every rule, combo and stat requirement in one place (P5 as a feature) |
| FR-40 | Tutorialisation: a first 10 minutes that teaches the loop without a manual |

### 7.4 CUT from this release

Multiplayer and village-visiting · romance arcs · **directly controlled player character** ·
**villager permadeath** · **building destruction** · **tower-defence structures (walls, gates,
turrets, barracks, traps)** · real-time monsters roaming the village map as the default raid
presentation · voice acting · mod tools (data format stays mod-friendly) · console ports.

Note that three of these cuts are *direct reversals of things discussed in this design
conversation*. They are recorded here so they do not creep back in silently.

---

## 8. Location Select **[LOCKED]**

A new village begins by choosing a location. **One choice → four consequences:** terrain, resource
mix, starting villagers, and which dungeon signature (and therefore which raid profile) you live
next to.

### 8.1 The six locations

Three ship at MVP; three are P1.

| | Location | Resources | Signature dungeon | Retaliation profile | Ships |
|---|---|---|---|---|---|
| 🟢 | **Vale** | food, fibre | Rootcellar (shallow, safe) | rare, weak — the tutorial | **MVP** |
| 🟢 | **Thornwood** | wood, herbs | Rootfang Warren | frequent, weak — pressure | **MVP** |
| 🟢 | **Greydelve** | stone, ore | The Hollow Seam | rare, severe — commitment | **MVP** |
| 🔵 | Mere's End | fish, reeds, water | The Drowned Stair | flooding, damages stores | P1 |
| 🔵 | Salt Reach | coin, salt, trade | The Toll Road | mercenaries — can be paid off | P1 |
| 🔵 | Frostholm | fur, iron, ice | The White Throat | blizzard siege, halts production | P1 |

The three MVP locations form a deliberate **risk triangle** — safe / frequent-but-weak /
rare-but-severe — so the choice is about temperament, not power.

**Starting villagers roll random jobs and classes [LOCKED]**, which means the location's resource
mix and your starting roster can disagree. That is intended: it is the first real problem the player
solves, and it makes each run's opening different.

### 8.2 The orthogonality rule **[LOCKED]**

No location may be strictly better than another. Every difference must be a **trade**, not an
advantage. Concretely:

- Every location has access to the **shared dungeon pool** (§9.1), which carries the entire main
  progression. Nobody is locked out of the game by their starting choice.
- Signature content is **horizontal, never vertical.** A location's unique material tier crafts
  unique *buildings* and cosmetics — never strictly-better weapons or armour.

The reason this rule exists: the moment one signature dungeon drops better swords, location select
becomes a min-max solver with one correct answer, and the other five become dead content that we
paid to build.

### 8.3 Availability and peaking **[LOCKED]**

- **All three MVP locations are free at village creation.**
- **Peaked (D13)** = village rank at maximum **and** that location's signature dungeon cleared. Two
  visible, checkable conditions — one drawn from each gate — rather than an opaque combined score,
  which would violate P5. Peaking means you engaged with both halves of the §11 interlock instead of
  turtling one of them.
- Peaking a location unlocks the right to establish a **Forward Outpost** in another (§8.4).

### 8.4 Forward Outpost — D12, **P1**

> You chose the outpost over meta-unlock. That is a real scope increase on what v0.2 assumed, and it
> is why FR-32 moved from trivial to medium. It is still far cheaper than a second village — and it
> is specified here in enough detail that the cheapness is deliberate rather than lucky.

Once a location is peaked you may establish an outpost in **one** other location. An outpost is not a
second village. It is deliberately thin:

| | Main village | Forward Outpost |
|---|---|---|
| Map | Full 46×46 isometric map | Small region, ~6–10 build slots **[TARGET]** |
| Population | Grows, housed, has needs | **None.** Staffed by villagers sent from home |
| Buildings | All four categories | Production and kiosk only |
| Village rank | Full star progression | **None** — inherits the home village's rank |
| Economy | Market, tax, storage | Produces a **daily shipment** sent home |
| Dungeon | Shared pool + local signature | **The host location's signature dungeon** |

**Why it is worth building.** The prize is §8.2's horizontal content. A Vale village that peaks can
open a Greydelve outpost and finally reach The Hollow Seam's unique material tier — and therefore
Greydelve's unique buildings. Signature content stops being "pick one per run" and becomes "earn the
others," which is a far stronger long-term pull. It does not breach the orthogonality rule, because
signature content is still never strictly better (§8.2).

**Why it costs much less than a second village.**
- No second population, so no second needs / schedules / relationships / market simulation — that is
  the expensive half of this genre and the outpost simply does not have it.
- No second rank track, so no second progression curve to balance.
- One extra region reusing `world.js`, one shipment rule, one screen-switch.

**The part I like most [REC]:** staffing the outpost reuses the existing tension instead of adding a
new one. Villagers assigned to it are **absent from home** — they do not work your facilities, and
they are not present when a Retaliation lands. So an outpost is another answer to *"who is home?"*
(§4), not a new question. It must never grow its own separate mechanic.

**Outposts can be raided [REC].** An undefended outpost goes offline on exactly the same downtime
model as the village (§10.5). Nothing is destroyed there either.

**Architecture note — binding at M1, built at M5.** The location/region system must be data-driven
from the start so an outpost is simply *a region with fewer slots and no population*, not a special
case. That costs nothing at M1 and a great deal if discovered at M5.

---

## 9. The Dungeon

### 9.1 Shared pool + one signature **[LOCKED]**

- **Shared pool** (3–4 dungeons): identical for every location, available to everyone, and the home
  of the **depth gate**. This is the main progression spine.
- **Signature dungeon**: one per location, with unique monsters, a unique boss and a unique material
  tier (§8.2 forbids unique *power*).

### 9.2 Multi-floor — already built and proven

This is not a new capability. The prototype generates `Hollowdeep — Depth N` procedurally, with a
boss floor every 5, and the smoke suite proves every chest and staircase reachable by the real
pathfinder across **1,000 generated floors × 25 seeds**. Floors 1–40+ exist today.

What is new is **who authorises the descent**.

### 9.3 Expedition Orders **[LOCKED]**

The player issues an order; the party executes it autonomously. Three parameters:

| Parameter | Meaning |
|---|---|
| **Target depth** | How far to push before turning back |
| **Retreat condition** | HP threshold, party-downed count, or "never retreat" |
| **Loot priority** | Materials vs gear vs gold — decides what gets carried when the pack is full |

Two rules that carry most of the design weight:

1. **Retreat is always free before the boss.** You can chip away at a dungeon forever without risk.
   This is the permanent escape valve — there is always a safe action available, which is what stops
   the interlocked gates (§11) from ever becoming a deadlock.
2. **The boss attempt is the commitment.** Failing a floor is a small consequence. Failing a boss is
   what opens a Breach (§10.1).

### 9.4 Visible on demand **[LOCKED]**

By default the dungeon is an **abstract simulation that produces a report.** At any time the player
can open a **live isometric view** of what is happening.

- Same computation either way — guaranteed by FR-03. Watching is never an advantage, only
  information.
- This is what makes the "who is home?" tension legible: you open the view to judge whether to recall
  the party because a Retaliation warning just fired.
- Weather and season affect monster spawn rates and production, and are always readable from the HUD.

### 9.5 Environmental coupling

Day/night, season and weather change farm yield, monster spawn rates and loot tables. Because
downtime is the cost of a raid (§10.5), **time of day becomes tactical**: a Retaliation at midnight
costs almost nothing (villagers asleep, buildings idle); one at harvest noon costs a full day. Players
will discover that pushing deep at night and being home by dawn is optimal. That is emergent strategy
from a rule already chosen, and it needs no extra build.

---

## 10. Breach & Retaliation — the consequence system

This is the differentiator. **Kairosoft has no defence and no consequence.** Their dungeons are a
place you visit; ours is a neighbour that objects.

### 10.1 Breaches

A **Breach** is a spawned dungeon mouth on your own village map, with randomised floors. Two origins,
same object, opposite valence:

| Origin | Feel | Behaviour |
|---|---|---|
| **Natural spawn** — "a sinkhole opened by the mill" | a gift | quiet, low tier, safe to ignore, rich materials |
| **Failure Breach** — your party died on a boss | a bill | angry, escalates, must be cleared |

Natural spawns exist so the player learns what a hole in the ground means **in peacetime**, before
the first time one is their fault.

### 10.2 Hard rules

| Rule | Value | Why |
|---|---|---|
| **Maximum concurrent Breaches [LOCKED]** | **2** | Your territory is finite and Breaches eat buildable land. A third failure makes an existing Breach deeper and angrier instead of opening a new one |
| **Removal [LOCKED]** | Clear **every floor**. No tribute, no decay | Full commitment — a Breach is a real objective with a known size |
| **Depth guarantee [LOCKED]** | A Breach is **never deeper than the deepest floor you have already stood on** | Airtight anti-softlock. You failed there, so access is proven; it is always theoretically clearable |
| **Incremental clearing [LOCKED]** | Cleared floors stay cleared across expeditions | A Breach you cannot beat yet is a Breach you can slowly strangle. Each cleared floor slows escalation and shrinks the wave |
| **Never spawns on a building** | Enforced at generation | A Breach must never destroy or strand your village layout |
| **Payoff** | Breach materials are **richer than the shared dungeons** | It was forced on you, so it should pay better. This is also what makes the controlled-burn strategy (§10.7) possible |

### 10.3 Escalation

An uncleared Breach escalates over time. At threshold it announces a **Retaliation** — a monster wave
assault on the village — **one full in-game day in advance**, with a visible countdown.

> **Never a surprise.** P5 again: the player must always be able to see it coming and read exactly
> how bad it will be.

### 10.4 Defence is people, not structures **[LOCKED]**

> **There are no walls, no gates, no towers, no barracks, no traps. Your adventurers are your
> defence.**

The four-category taxonomy survives completely untouched, and the buildings that win raids are ones
you already have: the training ground and bathhouse that raise stats, the smithy that makes their
gear, the infirmary that gets them back on their feet.

**Resolution.** Abstract auto-battle by default; **live isometric view on demand [LOCKED]** — the
same hybrid as the dungeon (§9.4), so one presentation rule covers the whole game.

**Limited orders [LOCKED].** During a raid the player holds **2–3 command points [TARGET]** to spend:

| Command | Effect |
|---|---|
| **Ring the bell** | Civilians flee to shelter and cannot be downed this wave |
| **Fire the stockpile** | Consumes stored ballista bolts/potions for a one-off effect |
| **Pull someone back** | Withdraw one adventurer from the line (usually to save them from being downed) |

This is the *only* real-time input in the game, and it is deliberately small: enough for clutch
moments, not enough to become a fight you play.

**And the best consequence of the whole system:** if your party is twelve floors underground when the
warning fires, your strongest people are not home. Recall them and you lose the expedition — or leave
them and let whoever remains hold the line.

### 10.5 Losses are downtime, never loss **[LOCKED]**

> **Villagers do not die — they are downed and cannot do anything for a period. Buildings are not
> destroyed — they become unusable for a period.**

Nothing in the game is permanently destroyable. A raid costs you **time**, which in a continuous-time
base builder where production is the engine is exactly the right currency: you fall behind, you never
lose what you built.

| Outcome | Buildings offline | Villagers downed |
|---|---|---|
| Held the line | — | — |
| Minor loss | ~3 game hours **[TARGET]** | ~4 game hours **[TARGET]** |
| Bad loss | ~8 game hours **[TARGET]** | ~12 game hours **[TARGET]** |
| Total rout | ~1 day **[TARGET]** | ~1 day **[TARGET]** |

#### What those numbers actually cost — D15/D17, resolved **[LOCKED]**

The prototype clock is `REAL_SEC_PER_DAY: 720` in `data.js`, so **one in-game day is 12 real
minutes.** The table above therefore reads:

| Outcome | Real-time cost |
|---|---|
| Minor loss | ~1.5 real minutes |
| Bad loss | ~4 real minutes |
| Total rout | **~12 real minutes** |

Related figures from the same constant, recorded because everything downstream is tuned against them:
the hourly market tick fires every **30 real seconds**, and the 8-hour offline cap (`OFFLINE_CAP_H`)
spans **40 in-game days**.

**You chose to leave this alone.** The reasoning is written down here so that nobody "fixes" it later
by accident: **downtime is not the punishment.** The real cost of failing a boss is

1. **the expedition** — its progress and its loot are gone, and the party comes home empty;
2. **the Breach** — still there, still escalating, and it **must** be cleared floor by floor before
   it ever stops (§10.2);
3. **compounding labour loss** — downed villagers on top of §6.5's already-reduced adventurer rate.

Downtime is the *visible* consequence, not the expensive one. That is consistent with P4 and with
Kairosoft's tone, and it is a deliberate choice rather than an unexamined default.

> ⚠️ **The known risk of this choice, stated plainly.** With a 12-minute day and nothing
> permanent, a total rout costs about twelve real minutes. Deliberately failing in order to farm rich
> Breach materials (§10.7) may therefore be strictly better than delving properly.
>
> **If playtesting shows that, the lever is §10.2's Breach material richness — not this table.**
> Raising downtime would punish exactly the players we are trying to keep; making the exploit less
> profitable is targeted. Note also that the exploit is already bounded: the cap of 2 Breaches, the
> must-clear rule and the 2-day immunity window mean it cannot be farmed indefinitely — every Breach
> you bait is a Breach you are obliged to clear.
>
> §16 adds the metric that detects this: how often players fail *deliberately*, and how early.

Recovery is shortened by vacation buildings (bathhouse, infirmary, shrine) — which is what makes
that category mechanically load-bearing rather than decorative, and closes the loop back to §6.2.

**Immunity window [LOCKED].** No further Retaliation for ~2 in-game days after one resolves, so a
village can never be chain-hit.

**Nothing resolves offline [LOCKED, non-negotiable].** The player returns to a *warning with a
countdown that starts then* — never to a village already raided. Coming back to a razed base is the
single most review-bombing thing an idle game can do. With P4 in place the damage would be
recoverable anyway, but the experience would still be unreadable, so the rule stands.

### 10.6 Breach adjacency — reusing §5.2 **[REC]**

Buildings touching a Breach receive **both**:

- **Blighted** — reduced output, reduced villager mood
- **Infused** — increased chance of rare material drops

So the player chooses *which* buildings sit next to the hole: the farm suffers, or the smithy
profits. This is the shaped-footprint system inverted, which means it costs almost nothing to build
and it feeds directly into the leisure-vs-production tension that is already the core decision.

### 10.7 The controlled-burn strategy **[REC, expected emergent play]**

Because Breach materials are the richest in the game, and because losses are only downtime, the
optimal high-level play is: **keep both Breach slots full, milk them for materials, and clear one
only when its escalation timer forces you to.** Then fail on purpose to open another.

We should not prevent this. We should make sure it is *legible* (P5) so players discover it, because
deliberately baiting invasions is exactly the kind of strategy that ends up in a wiki and a YouTube
video — and it is the strongest possible evidence that the system has depth.

---

## 11. Progression — two interlocked gates **[LOCKED]**

| Gate | Unlocks | Fed by |
|---|---|---|
| **Village rank (stars)** | Facility tiers, building types, capacity upgrades | Sustained income, population, facility count |
| **Dungeon depth** | Material tiers, equipment tiers, class advances | Expedition Orders, cleared floors |

They interlock: rank needs income, income needs facilities, facilities need materials, materials
need depth, depth needs strong adventurers, adventurers need stats, stats need facilities.

### 11.1 Village rank

Kairosoft-style stars. Each rank requires a combination of sustained treasury income, population,
and facilities built; each rank unlocks a facility tier. **All requirements and rewards must be
visible before they are met** (P5) — Kairosoft hides these behind a 70,000-income threshold that
players only learn from a wiki, and we are explicitly not doing that.

### 11.2 Why this cannot deadlock

Four escape valves, each independently sufficient:

1. **Retreat before a boss is always free** (§9.3) — there is always a safe action.
2. **No building is job-locked** (§5.1) — you can never be unable to staff something.
3. **Adjacency combos cost no dungeon materials** (§5.3) — reshuffling existing buildings always
   makes forward progress.
4. **A Breach is never deeper than you have already been** (§10.2) — the forced content is always
   theoretically clearable.

---

## 12. Business & Release

- **Price [LOCKED — D9]:** **$14.99 at Early Access → $17.99 at 1.0.** Demo free. Launch discount 10%.
  > v0.1 said $22.99. That was wrong, and it was wrong because v0.1 was positioning against
  > RimWorld and Cult of the Lamb. Positioned next to Kairosoft — whose games sit far lower and whose
  > audience has a strong price expectation — $22.99 reads as overpriced for a systems game with
  > procedurally generated art. $14.99–17.99 is the honest band. Revisit against Next Fest wishlist
  > data.
- **Release path [LOCKED — D8]:** Steam page live at M2 → demo at Next Fest → **Early Access 6–9 months** →
  1.0. Early Access suits this design specifically: a systems-heavy village builder with a
  downtime-based loss model needs public data to tune §10.5's numbers, and both RimWorld and Cult of
  the Lamb benefited enormously from long public tails.
- **DLC (post-1.0):** the three P1 locations (§8.1) are the natural first DLC or free expansion;
  cosmetic village packs thereafter. Never gameplay-essential.
- **Mobile [REC]:** premium, ~$6.99, no IAP. Only after the Steam version has ≥1,000 reviews and the
  playtest data says the loop survives short sessions. Loop Hero's 1M mobile downloads after ~2M on
  Steam is the precedent for this order.

---

## 13. Platform Requirements — Steam (primary) *(carried from v0.1)*

| ID | Requirement |
|---|---|
| PR-01 | Windows build is the shipped artifact; macOS and Linux are stretch for 1.0 |
| PR-02 | Steamworks via a supported wrapper: achievements, cloud save, overlay, rich presence |
| PR-03 | Cold start to playable in < 8 s on an HDD |
| PR-04 | Install size < 300 MB **[REC]** — a hard constraint if we ship Electron (~150–250 MB of which is runtime) |
| PR-05 | Saves in the OS-standard user data directory, not browser storage, mirrored to Steam Cloud |
| PR-06 | 60fps at 1080p and 1440p; correct behaviour 720p→4K and ultrawide |
| PR-07 | Full keyboard+mouse; gamepad at 1.0 (FR-37) |
| PR-08 | No network dependency for single-player |

**Engine (D1, carried).** Three paths: **A** stay JS/Canvas + Electron/NW.js wrapper · **B** port to
Godot 4 · **C** Unity. Vampire Survivors shipped on Steam as a Phaser/JS build and only migrated to
Unity afterwards, running both PC builds in parallel — so A is precedented. `steamworks.js` works
from a browser context; Electron/NW.js are the officially supported wrappers, Tauri has known
friction.

**[LOCKED — D1] Option A, hedged: stay JS/Canvas for M1→M3, with a hard revisit at M3** — and MR-01 (input abstraction) + MR-09
(content-as-data) done at M1 *regardless* of engine choice, which keeps B open at low cost.

---

## 14. Mobile Constraints — deferred, but binding *now* *(carried from v0.1)*

The port comes later. It is only cheap later if these are respected from M1. Each is a **now**
decision.

| ID | Constraint | Why now | Status |
|---|---|---|---|
| MR-01 | **Input abstraction layer** — one module turns keyboard/mouse/touch/gamepad into intents; gameplay never reads a raw event | Retrofitting across ~6,700 lines is a rewrite of every interaction | ❌ |
| MR-02 | **No hover-only affordances** — every tooltip/action works on tap and long-press | Hover does not exist on touch | ❌ |
| MR-03 | **≥44 px tap targets** on every interactive control | Retrofitting layouts is painful | ⚠️ partial |
| MR-04 | **No right-click-only actions** — every one has a visible button equivalent | Touch has no right-click | ✅ |
| MR-05 | **Fixed internal resolution, letterboxed, integer-scaled** | One render path for every screen | ✅ 480×270 |
| MR-06 | **UI anchored, not per-pixel absolute**; reflows for portrait | Desktop layouts die on phones | ⚠️ |
| MR-07 | **Portable, versioned save format** — JSON + schema version + migrations | Saves must move desktop→cloud→mobile | ⚠️ no migrations |
| MR-08 | **Perf budget** ≤1.5 ms/frame JS on mid-tier phone; no per-frame allocation in hot loops | Sim + particles + 46×46 iso map must fit | ⚠️ unmeasured |
| MR-09 | **All content in data, not code** | Localisation, balancing and modding without touching logic | ⚠️ |
| MR-10 | **All strings externalised** | Localisation after the fact costs 3× more | ❌ |

**v0.2 adds one:**

| MR-11 | **Fixed timestep is a mobile requirement, not just a correctness one** | Variable timestep behaves differently at 30fps vs 140fps. Without FR-03 the mobile port cannot reproduce desktop outcomes, and P4's "nothing resolves offline" guarantee becomes unenforceable | ❌ |

**Honest read:** the prototype is *structurally* mobile-friendly (MR-04/05) with four real blockers
(MR-01, MR-02, MR-07, MR-10). None are expensive at M1. All are expensive at M4.

---

## 15. Existing Prototype — Disposition Audit *(carried from v0.1, verdicts updated)*

**Nothing has been changed in the codebase during this design conversation.** Current verified state:
**88/88 smoke checks green, repeatedly**, including 1,000-floor reachability proofs and a cold boot
through the real entry point.

| Module | Lines | Now maps to | Verdict |
|---|---|---|---|
| `js/util.js` — RNG, noise, math, storage, event bus | 162 | FR-03, cross-cutting | **KEEP.** Clean, engine-agnostic. Will need a deterministic fixed-step driver added |
| `js/data.js` — all content tables | 488 | FR-04…FR-26, MR-09 | **KEEP but externalise** to JSON. The tuned *numbers* are the most valuable asset in the repo |
| `js/sprites.js` — procedural pixel art | 809 | FR-01 | **KEEP.** 116 tile variants, 102 building sprites, 36 humanoid frames, 14 monster bodies, all cached |
| `js/world.js` — maps, A\*, generation | 375 | FR-17, FR-21 | **KEEP.** Verified across 1,000 floors. Breach generation extends `genDungeon` |
| `js/items.js` — items, affixes, derived stats | 305 | FR-14 | **KEEP.** 5,000-item generation validated |
| `js/npc.js` — needs, schedules, market, relationships | 592 | FR-09…FR-13 | **KEEP, extend.** This is the villager engine and it works. Needs job→stat growth (§6.1) and recruitment (§6.5) added |
| `js/build.js` — placement, production, workers | 282 | FR-04…FR-07 | **KEEP, substantially extend.** Needs capacity/occupancy (§5.1), shaped adjacency (§5.2), combos (§5.3) |
| `js/combat.js` — monsters, skills, pets, transitions | 673 | FR-15, FR-19, FR-22 | **KEEP.** Raid resolution reuses the same auto-battle machinery |
| `js/quests.js` — 7 generators | 223 | FR-25 | **KEEP** (authored story is net-new) |
| `js/render.js` — iso renderer, lighting, weather | 478 | FR-01, FR-20, MR-05 | **KEEP.** Live raid view reuses the dungeon render path |
| `js/ui.js` — panels, dialogue, shops, tooltips | 1,466 | FR-28, MR-02/03/06 | **REWORK.** Largest and least portable: hover tooltips, absolute-positioned panels, no input abstraction. Also must carry the full-calculation tooltips P5 demands |
| `js/game.js` — state, loop, input, save | 878 | FR-03, FR-27, MR-01/07 | **REBUILD.** Split into `state` / `loop` (fixed timestep) / `input` (MR-01) / `save` (MR-07 migrations). This is where FR-03 lands |
| `tools/smoke.js` + `tools/domstub.js` | — | all acceptance criteria | **KEEP — highest-value item in the repo.** 88 assertions that play the game headlessly |

**Net:** ~5,000 of ~6,700 lines carry over; ~2,350 (`ui.js`, `game.js`) need restructuring. New work
concentrates in `build.js` and `npc.js` — both of which are *extensions* of working code rather than
rewrites, which is the good news in this table.

**Known open balance issue:** past ~floor 25 the monster curve outruns an unequipped hero, so gear
progression needs a tuning pass (R4).

---

## 16. Playtest & Metrics Plan *(carried from v0.1, extended)*

**Instrument before M2** (all local, opt-in, privacy-safe — no PII, no accounts):

- Session length, sessions per day, days retained
- **Which location is chosen, and whether players restart to try another** (validates §8's orthogonality rule — if one location dominates, the rule is broken)
- **Job-matching behaviour:** do players optimise villager placement, or ignore the bonus? (validates §5.1)
- **Recruitment decisions:** which villagers get promoted, and how long players deliberate (validates P2)
- **Breach handling:** time-to-clear, how often the escalation timer forces the issue, how often players fail *deliberately* (§10.7 — if this is common early, the payoff is too generous)
- **Command point usage:** which of the three raid commands is spent, and whether "ring the bell" dominates (if it does, the other two are badly priced)
- Depth reached per session; expedition retreat causes
- Buildings built by type and order; resources bottlenecked
- Idle-vs-active ratio (validates P6)
- **Where players quit mid-session — the single most valuable number we can collect**

**Playtest protocol:**
- **Internal (M1):** 3 sessions, think-aloud, no instructions. Success = they complete a boss floor,
  survive the resulting Retaliation, and can *explain the loop back to us*.
- **Closed beta (M3):** 25–50 players via Steam Playtest. Survey at 30 min and 3 h.
- **Next Fest (M2):** public demo; watch median session length and the quit-point histogram.

**Balance authority [REC]:** the automated harness remains the source of truth for *correctness*;
human playtests decide *feel*. No balance change ships without a harness assertion attached — this is
the policy that caught the boss double-scaling bug, and it should be permanent.

---

## 17. Milestones & Exit Criteria

**M0 — Design lock.** *This document signed off (§18).* No code before this.

**M1 — Foundation.** Fixed timestep (FR-03) + the four-category building system with capacity,
shaped adjacency and combos (FR-04…FR-07) + job-driven stat growth and recruitment (FR-11, FR-13)
+ **MR-01 input abstraction and MR-09 content-as-data** — mandatory under D1 regardless of how the
M3 engine revisit lands, and additionally MR-09 must make locations/regions data-driven so §8.4's
outpost is a config rather than a rewrite.
*Exit:* a 20-minute scripted village in which removing any one system makes the run stall; the §1.2
rule demonstrably holds; harness green. **Nothing in M2 or M3 starts until FR-03 is proven.**

**M2 — The loop closes.** Expedition Orders, one location, one shared dungeon, Breach spawning, one
Retaliation with downtime resolution. *Exit:* a player can fail a boss, get breached, lose a day of
village, recover, and clear it — and describe that as fair. Steam page live; 45–60 min demo uploaded.

**M3 — Content breadth.** 3 locations, shared dungeon pool, ≥8 classes with advance lines, rank
progression, live raid view with command points. *Exit:* ≥80% of P0 and ≥60% of P1 complete;
crash-free sessions ≥99%; save migration proven across ≥3 versions; **hard engine revisit (D1)**.

**M4 — Early Access.** All P0. *Exit:* the §16 instrumentation shows no location dominating and no
death-spiral pattern in the quit histogram.

**M5 — 1.0.** All P1: three more locations, **Forward Outpost (FR-32)**, biomes, authored story,
Steamworks, localisation, compendium.

**M6 — Mobile port.** Only after M5 + testing. *Exit:* §16 mobile gate met.

---

## 18. Decisions Required for Sign-off

Resolved decisions are recorded so they cannot be silently reopened.

### Resolved in this conversation **[LOCKED]**

| # | Decision | Outcome |
|---|---|---|
| — | What is the product? | **Base building.** Villagers and dungeon are engines feeding it (§1.1) |
| — | Reference frame | **Kairosoft *Dungeon Village* 1 & 2**, plus Loop Hero / Backpack Battles for the auto-battler |
| — | Player control | **None direct.** Equipment, consumables, class/job changes, Expedition Orders, 2–3 raid command points (§1.3) |
| — | Building taxonomy | **Four categories** — production, kiosk, vacation, decoration. No fifth (§5) |
| — | Facility staffing | **Capacity, not job-locks.** Anyone can work anything (§5.1) |
| — | Decoration adjacency | **Shaped footprints**, touching tiles only (§5.2) |
| — | Leisure | **Needs-driven.** Villagers choose; player only builds (§6.3) |
| — | Adventurer origin | **Recruited from within**, player-initiated, stat-gated, free class choice (§6.5) |
| — | Location ↔ dungeon | **Shared pool + one signature per location** (§9.1) |
| — | Location availability | **All free at start** (§8.3) |
| — | Multi-floor dungeons | **Yes — already built and proven** (§9.2) |
| — | Failure consequence | **Breach in your territory**, escalating to a Retaliation (§10) |
| — | Breach cap | **2** (§10.2) |
| — | Breach removal | **Must clear every floor.** No tribute, no decay (§10.2) |
| — | Defence structures | **None. Adventurers are the defence** (§10.4) |
| — | Raid presentation | **Hybrid** — abstract by default, live view on demand (§10.4) |
| — | Raid intervention | **Limited orders**, 2–3 command points (§10.4) |
| — | Villager death | **No. Downed for a period** (§10.5) |
| — | Building destruction | **No. Unusable for a period** (§10.5) |
| — | Progression spine | **Both gates interlocked**, four escape valves (§11) |
| — | Time model | **Continuous** real-time — day/night, seasons, weather, hourly market, offline catch-up |
| — | Timestep | **Fixed, deterministic** — P0 blocker (§7.2) |
| — | Platform order | **Steam first, mobile after testing** |
| D2 *(v0.1)* | Does the village lose things? | **Superseded** — recoverable downtime only. Nothing permanent |
| D3 *(v0.1)* | Player perspective | **Superseded** — no controlled avatar at all; the Warden is fiction, not a unit |
| D4 *(v0.1)* | Combat weight | **Superseded** — auto-battler always, with optional live view and limited raid orders |
| D5 *(v0.1)* | Multiplayer | **Out for launch, architected for** — keep the sim deterministic and serialisable |
| D6 *(v0.1)* | Romance arcs | **Light friendship at 1.0**; full arcs are a DLC candidate |
| D7 *(v0.1)* | Art scale | **Keep chunky 16px** — it is what the procedural generator does well and it holds at mobile resolutions |
| D10 *(v0.1)* | Prototype disposition | **Keep & polish**, starting with `game.js` (fixed timestep) and `ui.js` (input abstraction) |

### Resolved in this round (v0.3)

| # | Decision | **Outcome** | Where it landed |
|---|---|---|---|
| **D1** | Engine & wrapper | **Hedged A** — stay JS/Canvas + Electron/NW.js, MR-01 and MR-09 built at M1 regardless, hard revisit at M3 | §13, §17 M1 |
| **D8** | Release path | **Early Access**, 6–9 months | §12 |
| **D9** | Price | **$14.99 at EA → $17.99 at 1.0** | §12 |
| **D11** | MVP scope | **§7.1 as written**, with a corrected trim order (below) | §7 |
| **D12** | Expansion scope | **Forward Outpost** — *not* meta-unlock, *not* a second village. The one scope increase this round | **§8.4**, FR-32 |
| **D13** | "Peaked" definition | **Max village rank AND signature dungeon cleared** | §8.3 |
| **D14** | Adventurer labour | **Reduced rate while home, ~−35% [TARGET]** | §6.5 |
| **D15** | Downtime magnitudes | **Left as tableed.** Downtime is the visible cost, not the expensive one | §10.5 |
| **D16** | Breach adjacency | **Both, with an escalation taper** (below) | §10.6 |
| **D17** | Time scale *(new)* | **Unchanged — 1 in-game day = 12 real minutes.** Recorded as load-bearing since needs, market, seasons, downtime and offline catch-up are all tuned against it | §10.5 |

#### D11 — corrected trim order

v0.2 said "cut pets, then quest generators." **That was wrong and is superseded.** FR-25 and FR-26
are already built and passing, so cutting them costs removal work and loses content for zero savings.
If the MVP must shrink, cut from the unbuilt items in this order:

1. **FR-23** — live raid view + command points. This is *presentation*; FR-22's abstract resolution
   delivers the entire loop without it.
2. **FR-12's stat-gain half** — keep needs-driven leisure visits, defer leisure raising stats.
3. **FR-16 down from 3 locations to 2** — Vale + Greydelve (safest + most severe) still demonstrates
   the risk triangle.

**Never cut:** FR-03 (fixed timestep), FR-05 (capacity), FR-13 (recruitment), FR-21 (Breaches),
FR-22 (Retaliation). Removing any of those removes the product rather than trimming it.

#### D16 — the taper

Breach adjacency applies **Blighted** (−output, −mood) *and* **Infused** (+rare materials), but
**Blight scales up with the Breach's escalation level while Infusion stays flat.** A fresh Breach is
net-profitable to keep nearby — that is §10.7's controlled-burn strategy, and we want it to exist. An
old ignored Breach goes net-negative. Without the taper, keeping two Breaches forever would be
strictly optimal and the "must clear every floor" rule would become vestigial.

### Sign-off

```
D1  hedged JS/Canvas, revisit at M3          D8  Early Access
D9  $14.99 EA -> $17.99 at 1.0               D11 scope as written, trim order corrected
D12 Forward Outpost (P1)                     D13 max rank + signature dungeon cleared
D14 adventurers work at home, ~-35%          D15 downtime unchanged
D16 Blight + Infusion, with taper            D17 12 real minutes per in-game day
(v0.1's D2/D3/D4/D5/D6/D7/D10 all carried and superseded - see the table above)

Approved to proceed to M1:  APPROVED / 2026-11-03
Notes: signed by the product owner in-session ("create the game now").
       M1 begins with FR-03; per S17 nothing else starts until it is proven.
```

**There are no open decisions left in this document.** The only thing remaining before M1 is your
signature above. Per the standing rule, no game code has been written or modified against v0.2 or
v0.3 — the prototype is untouched and still 88/88 green.

---

## Appendix A — What changed since v0.1

| v0.1 said | v0.2 says | Why |
|---|---|---|
| Three equal pillars | **Base building is the product**; two engines feed it | Your correction, and it resolves every downstream scope argument |
| Price $22.99 | **$14.99–17.99** | v0.1 positioned against RimWorld/Cult. Next to Kairosoft, that price reads as overpriced |
| D2: buildings damaged & repaired | **Buildings go offline; nothing is destroyed** | Your call — losses are downtime, not loss |
| D2: NPCs wounded & healed | **Villagers downed, never dead** | Your call |
| D3: fixed Warden you control | **No controlled character at all** | Consistent with the indirect-control contract |
| D4: active + auto, switchable | **Auto always; live view is observation, not control** | Same computation either way (FR-03) |
| FR-22 (P1): "town crises/raids, subject to D2" | **P0 core system**, §10 in full | Raids moved from a maybe to the differentiator |
| No location select | **§8, 6 locations, 3 at MVP** | Your proposal |
| No Breach system | **§10, the differentiator** | Your proposal |
| No capacity system | **§5.1, P0** | Required by "no job binding" |
| Variable timestep (unstated) | **FR-03 fixed timestep, P0 blocker** | Three locked features are impossible without it |

### v0.2 → v0.3

| v0.2 said | v0.3 says | Why |
|---|---|---|
| D12 expansion **[ASSUMED]** meta-unlock | **Forward Outpost**, new §8.4, P1 | Your call. The one scope increase this round — but far cheaper than a second village, and it reuses the "who is home?" tension |
| D15 downtime table, real cost unstated | Table kept, **real-time cost stated**: a rout is ~12 real minutes | The clock is 12 real min/day. Recorded so the choice is deliberate, with the risk and the correct lever written down |
| *(not in the document)* | **D17 time scale** — 1 day = 12 real minutes, market ticks every 30 s, offline cap = 40 game days | Found while checking D15. Load-bearing for needs, market, seasons and downtime; it belonged in the PRD all along |
| D11 "cut pets then quests" | **Cut FR-23 first**, then FR-12's stat half, then a location | Pets and quest generators are already built and passing — cutting them saves nothing |
| D16 Blight + Infusion | **Both, with an escalation taper** | Stops "keep two Breaches forever" from being strictly optimal and making must-clear vestigial |
| Price, release, engine as **[REC]** | All three **[LOCKED]** | D9, D8, D1 confirmed |

`GDD.md` predates both drafts and describes systems as originally designed. **This PRD supersedes it
on scope, priority, platform and process.** Where they disagree, this document wins. `GDD.md` §17
remains the accurate record of what the prototype contains and which bugs the harness caught.

## Appendix B — Reproducing the prototype's verification

```
node tools/smoke.js      # 88 assertions, exits non-zero on any failure
```

Headless: no browser required. `tools/domstub.js` parses the real `index.html` into a DOM tree and
returns `null` for missing ids, so absent elements fail loudly instead of being silently invented.
Includes a 1,000-floor × 25-seed reachability proof, a 6,000-frame soak, and a cold boot through
`window.load`.

**These 88 checks are the regression floor for M1.** Any rewrite of `game.js` for the fixed timestep
must keep them green — that is the whole point of having written them first.

## Appendix C — M1 build log (2026-11-03)

M1 signed off and implemented. **No system was built before FR-03 was proven**, per §17.

### What shipped

| FR | System | Where |
|---|---|---|
| **FR-03** | Fixed timestep (1/60 s) with an accumulator and a step cap; seeded RNG routed through every sim draw; RNG stream persisted in the save; `stepN()` for exact fast-forward; forced-seed runs | `game.js` `frame`/`stepN`, `util.js` `seedRng`/`randState`/`restoreRand` |
| **FR-05** | Capacity instead of job-locks; job-match bonus; away-villagers release their post | `build.js` `assignWorkers`/`capacityOf`/`matchBonus` |
| **FR-06** | Shaped decoration footprints — single (8 tiles), line (1 face), L (2 faces), cross (face centres) — buffing only physically touched tiles | `build.js` `touchTiles`/`adjacencyOf` |
| **FR-07** | 10 named adjacency combos, none requiring dungeon materials | `data.js` `EH.COMBOS`, `build.js` `combosOf` |
| **FR-11** | 16 job-training profiles; stats grow per game day worked; leisure is the second path; downed villagers train nothing | `data.js` `EH.JOB_TRAIN`, `npc.js` `trainTick` |
| **FR-13** | Stat-gated recruitment, player-chosen class, refusals that name the missing stat | `npc.js` `classOptions`/`recruit`/`retire` |
| **§5** | All 21 buildings categorised: 10 production, 1 kiosk, 2 vacation, 7 decoration, 1 legacy | `data.js` `EH.BUILD` |
| **§10.5** | `offline` downtime field: zeroes output, decays on the game clock | `build.js` `efficiency`/`update` |
| **D14** | Adventurers work at home at 65% | `build.js` `efficiency` |

### Harness: 88 → 111 checks, all green, deterministic

23 checks added for the above. The suite is now **byte-reproducible** — every `newState` in it is
seeded, so a failure can be replayed exactly. That is FR-03 paying for itself immediately.

### Bugs the harness caught this round

1. **`assignWorkers` was not idempotent.** It cleared `b.workers` but never cleared `n.work`, then
   skipped any villager whose `n.work` still resolved — so a *second* call left every building
   unstaffed and production would have silently collapsed. Fixed by rebuilding both sides.
2. **Entity ids were unreproducible.** `EH.uid` used `Math.random` *and* a module counter that
   survived `newState`, so two runs in one process could never agree. Both are now seeded/reset.
3. **`EH.rollPool` fell back to `Math.random`** when no rng was passed — an unseeded escape hatch in
   the most-used random helper in the codebase. Now defaults to the seeded stream.
4. **The "L" footprint ignored compound directions.** `dir: "nw"` silently produced 2 tiles instead
   of 4, so the Hero Statue would have buffed half of what its tooltip claims.
5. **Downed villagers trained through their own recovery.** `trainTick` decayed the timer before
   sampling it, so a tick long enough to clear the timer also granted a full tick of training.
6. **A hardcoded well→farm bonus contradicted §5.2.** It applied within 8 tiles and double-dipped
   with the new adjacency system. Removed; wells now buff only via their cross footprint.
7. **Two harness bugs:** the monster-AI duel did not isolate pets/companions (they steal aggro) nor
   the tester's own dodge/dmgReduce/regen at ~Lv90; and the downed test sampled its "before" value
   after the tick had already zeroed it.

### Known gap carried into M2

`wall` (Palisade) is tagged `cat: "legacy"`. §7.4 cuts tower-defence structures and §10.4 makes
adventurers the only defence, so M2 must either repurpose it as decoration-terrain or remove it.
It is tagged rather than deleted because removing it now would break existing saves for no M1 gain.
