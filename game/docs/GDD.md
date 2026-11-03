# EMBERHOLD — Game Design Document
### An isometric pixel-art idle fantasy RPG with a living town

**Version:** 0.1 (vertical slice) · **Working title:** *Emberhold* · **Platform:** Web (HTML5 Canvas), engine-agnostic core design

---

## 1. High Concept

> You inherit a run-down frontier hamlet at the edge of a cursed dungeon. Build it up, recruit
> villagers with real jobs and real schedules, and dive into the dark for loot. While you're away —
> asleep, at work, exploring floor 12 — the town keeps running: the baker sells bread to the smith,
> the guard drinks at the tavern, the wheat grows, and the gold stacks up.

**One-line pitch:** *Rimworld's simulation + Diablo's loot + a Tamagotchi's "it lives while you're gone", in a 2D isometric pixel hamlet.*

**Core pillars**
1. **The world lives without you.** NPCs have needs, schedules, jobs, money, opinions of each other. You are a participant, not the axis.
2. **Two loops, one economy.** Town building (slow, idle, compound) and dungeon crawling (fast, active, risky) feed each other through a single currency/resource system.
3. **Idle is a feature, not a fallback.** Every system produces value with zero input; active play multiplies it, it never replaces it.
4. **Readable pixel art, deep numbers.** Charming 16px surface, spreadsheet-grade systems underneath (stats, affixes, upgrade curves).

---

## 2. Feature Pillars → Systems Map

| Your feature | System in Emberhold | Doc section |
|---|---|---|
| Isometric | Diamond tile renderer, 2:1 projection, depth-sorted sprites, chunked ground cache | §12 |
| Pixel | All art procedurally generated at runtime, nearest-neighbour upscale, limited palettes | §12 |
| Base building | 10 buildable structures, placement mode, construction timers, 5 upgrade levels, workers assigned | §6 |
| Stats | 5 primary stats, derived combat stats, level curve, allocatable points | §8 |
| Adventuring | Overworld → dungeon transition, expeditions | §9 |
| Quests | Procedural quest generator, 5 quest types, reputation rewards | §10 |
| Dungeon | Procedural floors, rooms/corridors, monster tiers, bosses, descent | §9 |
| NPC | 8+ hand-authored NPCs, generated extras, needs, memory, relationships | §5 |
| NPC stalls | Market stalls with rotating stock, per-NPC vendors, price fluctuation | §5.4, §7 |
| Equipment | 8 slots, 6 tiers, 5 rarities, random affixes, +N upgrades | §8.2 |
| Classes & jobs | 4 player classes + job advancement; NPC jobs (farmer, smith, merchant, guard, healer, bard, wrangler, scholar) | §8.1, §5.2 |
| Pets | Eggs, hatch, species, rarity, skills, feeding/happiness, combat pets | §11 |
| Daylight cycle | 24h clock, 4 time-of-day lighting stages, seasons, weather, NPC schedule driver | §4 |
| Currency | Gold + 4 resources, sources/sinks, NPC-owned money, taxes | §7 |
| Interactions (P↔N, N↔N, N↔P) | Dialogue tree, gossip, trading sim, relationship graph, NPC-initiated requests | §5.3–5.6 |
| Fantasy RPG theme | Setting, bestiary, item naming, class fantasy | §3, §9.3 |
| Idle | Offline progress, auto-expedition, auto-sell, automation buildings | §13 |

---

## 3. Setting & Tone

**Emberhold** sits in the Ashen Vale, a frontier valley beside the **Hollowdeep** — a dungeon that
breathes cold air from a crack in the hillside. A century ago it was a dwarven hold; something woke
beneath it. The last warden left you the deed, a rusty sword, and 200 gold.

Tone: **cozy-gothic**. Warm lantern light and bread smells on the surface; damp stone and eyes in the
dark below. Not grimdark — the horror is a backdrop to community-building. Think *Stardew* meets
*Darkest Dungeon*, with the difficulty dial set to "inviting".

**Seasons** (28 in-game days each): Spring (planting, +food), Summer (long days, +gold),
Autumn (harvest, +resources), Winter (short days, monsters +20% stronger, +heating cost).

---

## 4. Time: Daylight Cycle, Weather, Seasons

- **Clock:** 1 in-game minute = 0.5 real seconds at default speed (**1 day ≈ 12 real minutes**).
  Speed toggles: 1× / 2× / 4× / pause. Night can be skipped while in town (Sleep).
- **Lighting stages:** Night (00–05) deep blue, low visibility, lanterns matter. Dawn (05–08) amber.
  Day (08–17) neutral. Dusk (17–20) orange-magenta. Night falls again 20–24.
- **Consequence, not decoration:**
  - Shops **open 08:00–20:00**. Vendors sleep at night — you literally cannot buy at 3am.
  - Monsters are **stronger at night** (+15% HP/dmg in the dungeon); rare "Night-only" spawns.
  - Farms only produce during daylight; mines/lumber work any time.
  - Certain NPCs only appear at certain hours (the Bard at the tavern 18:00+, the Beggar at dawn).
- **Weather:** clear / overcast / rain / storm / fog / (winter) snow. Rolls every 4–10 in-game hours.
  Rain: +25% crop growth, −visibility, fire magic weakened. Storm: lightning can damage a building.
  Fog: monsters ambush at shorter range. Weather shows in the top bar and affects NPC dialogue.

---

## 5. NPCs — The Living Town

### 5.1 NPC data model
Every NPC is a full simulation agent:
```
{ id, name, portrait, age, personality[3 traits],
  job, home (building), workplace (building),
  hp, level, stats, inventory[], gold,
  needs { energy, hunger, social, mood },
  schedule [ {hourFrom, hourTo, activity, target} ],
  relationships { npcId: -100..100 },
  memory [ recent events ],
  opinionOfPlayer -100..100,
  state, path, targetTile, currentActivity }
```

### 5.2 Jobs
| Job | Workplace | Produces / does | Unlocked by |
|---|---|---|---|
| Farmer | Farm | Food | start |
| Lumberjack | Lumber Camp | Wood | start |
| Miner | Quarry/Mine | Stone, Ore | Quarry |
| Blacksmith | Forge | Crafts & upgrades gear, sells weapons/armor | Forge |
| Merchant | Market Stall | Buys/sells everything, sets prices | Market |
| Guard | Barracks | Patrols town, defends raids, **can be hired as companion** | Barracks |
| Healer | Chapel | Sells potions, revives companions, cures ailments | Chapel |
| Bard | Tavern | Raises town morale (global +XP buff while performing) | Tavern |
| Wrangler | Kennel | Sells pet eggs, trains pets | Kennel |
| Scholar | Library | Researches permanent passive upgrades | Library |

Population cap = sum of house capacity. Homeless NPCs sleep in the tavern, morale −.

### 5.3 Schedules (the daylight-cycle payoff)
Default template, shifted by job:
`00–06 sleep(home)` · `06–07 wake, walk to workplace` · `07–12 work` · `12–13 lunch at market/tavern`
· `13–18 work` · `18–20 socialize (tavern, plaza, stalls)` · `20–22 wander/home` · `22–00 sleep`

Guards override with shift work (one on night patrol). The Bard works nights. Farmers follow sunrise.
**Visible output:** you can stand in the plaza at 07:00 and watch the whole town walk to work.

### 5.4 Stalls & shops
- Market stalls are physical objects in the world; the merchant NPC walks to theirs and stands behind it.
- Each stall has **rotating stock** (rerolls at 06:00 daily, 6–10 items) and its **own price modifier**.
- Prices float with supply/demand: if the town has surplus wheat, bread is cheap; if the mine collapsed,
  iron is expensive. Player mass-selling depresses prices (anti-dump).
- Buying/selling is a real transfer: gold leaves the NPC, item changes hands. NPCs then *use* what they bought.

### 5.5 Interaction matrix
| | Player → NPC | NPC → NPC | NPC → Player |
|---|---|---|---|
| Talk | Dialogue tree, flavour lines by hour/weather/mood/relationship | Gossip bubbles, ambient chatter | They walk up and hail you |
| Trade | Buy/sell at stalls, barter with high relationship | **Simulated market economy** — they buy/sell from each other on their lunch break and at stalls | Offers you a deal, or asks you to buy their surplus |
| Gift | Give item → +relationship, unlocks dialogue | Give food to a hungry NPC → +relationship | Gives you a gift when relationship > 60 |
| Quest | Accept/turn in | Post requests on the notice board for each other | Approaches you with a request |
| Social | Recruit as companion, invite to feast | Friend/rival/romance arcs, grudges | Warns you, cheers you on, complains |
| Conflict | (future) duel, steal | Arguments, theft, bar brawls — visible events | Reports a crime to you (the warden) |

### 5.6 The N↔N economy sim (why it matters mechanically)
Every in-game hour the simulator runs:
1. Each off-duty NPC picks a need-driven purchase (food if hungry, tool if their job needs one, gift if in love).
2. They path to a stall, pay gold from *their own wallet*, receive the item.
3. The stall's owner NPC gains that gold, minus a **10% market tax → to the player's treasury**.
4. Relationship tick for anyone who interacted; an event line is written to the town log.

Result: **the town generates passive gold for you simply by existing**, and the event log becomes a
soap opera you can read while idle. *"Pip sold 2 bread to Mara for 6g (+0.6g tax)"*,
*"Dorn argued with Rowan about the well (-5 relationship)"*, *"Lira shared herbs with Pip (+3)"*.

Relationship tiers: −60 Enemy · −20 Dislike · 0 Neutral · 20 Friendly · 50 Close · 80 Devoted.
Each tier unlocks dialogue, discounts (up to −25%), gifts, and companion recruitment.

---

## 6. Base Building

### 6.1 Rules
- Grid placement on grass/dirt/sand; must connect to a road or plaza (walkability check).
- Cost in gold + resources. **Construction timer** (a villager must be free to build it, or pay gold to rush).
- Each building has **5 levels**; level raises output/capacity and changes the sprite (visually grows).
- Buildings can be damaged (storms, raids) and must be repaired.
- Demolish for 40% refund.

### 6.2 Building table (Lv1 values; +60% output/level)
| Building | Cost (Lv1) | Build time | Effect |
|---|---|---|---|
| House | 60g, 20 wood | 20s | +2 population cap |
| Farm | 80g, 30 wood | 30s | +0.6 food/min (daylight only) |
| Lumber Camp | 100g, 10 wood | 40s | +0.5 wood/min |
| Quarry | 120g, 40 wood | 50s | +0.4 stone/min |
| Mine | 250g, 60 wood, 40 stone | 90s | +0.25 ore/min |
| Forge | 200g, 50 wood, 40 stone | 60s | Unlocks crafting + gear upgrades |
| Market Stall | 150g, 40 wood | 45s | +1 vendor slot, +trade volume, taxes |
| Tavern | 180g, 60 wood, 20 stone | 60s | +morale, rumours (quest leads), recruit pool |
| Chapel | 220g, 50 wood, 60 stone | 75s | Potions, revival, +HP regen in town |
| Barracks | 300g, 80 wood, 80 stone | 90s | Companions, town defence rating |
| Kennel | 260g, 70 wood, 30 stone | 80s | Pet slots, egg shop |
| Library | 400g, 100 wood, 120 stone | 120s | Research tree (permanent passives) |
| Warden's Hall | 1500g, 300 wood, 400 stone, 100 ore | 300s | Town Tier 2: new NPCs, bigger map, raids |

**Town Tier** gates content: T1 (start) → T2 (Warden's Hall) → T3 (Monument) etc. Each tier raises
population cap, unlocks buildings, unlocks dungeon depth and NPC archetypes.

### 6.3 Workers
Buildings have worker slots. NPCs auto-assign to their job, but you can drag-assign in the Town panel.
Unstaffed buildings run at 35% output. Happy, well-fed, well-housed workers run at up to 130%.

---

## 7. Economy

**Currencies:** Gold (coin) · Wood · Stone · Food · Ore (+ late: Ember Shards from bosses).

| Source | Sink |
|---|---|
| Dungeon loot & monster gold | Building construction & upgrades |
| Selling items at stalls | Buying gear/potions/eggs |
| Market tax on NPC trades | NPC wages (paid daily, boosts morale) |
| Farm/mine production sold | Research (Library) |
| Quest rewards | Repairs, pet feeding, town feasts |
| Offline idle income | Ransom/bribes during raids |

**Balance targets:** Lv1–5 player earns ~40g/min active, ~8g/min idle. First House affordable in
~2 min; Forge in ~8 min; Warden's Hall ~3–4 hours of cumulative play. Gold inflation is controlled by
sinks scaling exponentially while income scales linearly-with-multipliers.

**Anti-idle-trap:** resources have soft caps (Warehouse level) so you must log in / build storage,
but never hard-lose progress.

---

## 8. Progression

### 8.1 Classes & Jobs
Choose at start (respec at the Library for gold):

| Class | Fantasy | Stats | Signature |
|---|---|---|---|
| **Warden** (warrior) | Front-line tank | STR/VIT | *Bulwark* — taunt, +defense aura for companions |
| **Ranger** | Mobile DPS | DEX/PER | *Volley* — hits all enemies in a line; +move speed |
| **Mage** | AoE glass cannon | INT | *Emberburst* — AoE, scales with spell power |
| **Merchant** | Economy build | LCK/INT | *Appraise* — +gold find, +rarity, can buy below market |

**Job advancement** at Lv 10 / 25 / 50 (requires a quest + materials):
Warden → Knight → Paladin → **Ashen Lord** · Ranger → Hunter → Sharpshooter → **Windwalker** ·
Mage → Adept → Elementalist → **Archmage of the Vale** · Merchant → Trader → Guildmaster → **Coin Sovereign**.
Each tier: +stat weights, a new active skill, a passive, and a visual change (cloak, crown, glow).

**Stats:** STR (melee dmg, carry) · DEX (crit, attack speed, dodge) · INT (spell power, XP gain) ·
VIT (HP, defense, regen) · PER (item find, trap detection, shop prices) · LCK (crit, rare drops, events).
+5 allocatable points per level.

### 8.2 Equipment
Slots: Weapon · Offhand · Head · Chest · Legs · Boots · Ring ×2 · Amulet · Cloak.
Tiers: Crude → Iron → Steel → Silver → Ember → Mythril.
Rarity: Common · Uncommon (+1 affix) · Rare (+2) · Epic (+3, name) · Legendary (+4, unique effect, flavour text).
Affix pool: +STR/DEX/INT/VIT, +crit%, +crit dmg, +life steal, +% gold find, +% item find, +move speed,
+damage vs beasts/undead, thorns, on-hit burn, +pet damage, +XP gain.
**Upgrading:** at the Forge, spend gold + ore for +1..+10; fail-safe (no downgrade), costs escalate.
**Sets:** e.g. *Ashen Lord's Regalia* (4pc: fire aura) — long-term chase.

### 8.3 Difficulty curve
Player level ≈ dungeon floor + 2. Monster stats scale ×1.18/floor; loot quality tiers shift up every 5 floors.
Bosses at floors 5, 10, 15… with unique drops (pet eggs, set pieces, Ember Shards).

---

## 9. Dungeons & Adventuring

### 9.1 Structure
Overworld (town + valley) → **Hollowdeep entrance** → floors 1..∞, each procedurally generated
(rooms + corridors, doors, chests, shrines, traps, a boss every 5th floor, stairs down).
Permadeath is off: you're **wounded** and carried home by guards, losing 10% gold and floor progress
for that run — but the floor stays "cleared" until you descend past it (checkpoint system).

### 9.2 Combat
Real-time, auto-attack in range, cooldown skills, click-to-focus, party of player + up to 3 companions + pets.
Damage = (weapon + stat×coef) × (1 + crit) × rarity × upgrade − enemy defense × 0.6.
Statuses: burn, poison, bleed, chill, stun, blind. Enemy AI: melee charge / ranged kite / caster / summoner / boss phases.

### 9.3 Bestiary (first 12)
Floors 1–5: Cave Slime, Rat Swarm, Goblin Scout, Bat. 6–10: Skeleton, Fungal Lurker, Imp, Stone Beetle.
11–15: Wraith, Goblin Shaman, Cave Troll, **Boss: The Hollow King**. Later: Ember Elemental, Mimic,
Night Stalker, Cultist, **Boss: Mother of Deep**.

### 9.4 Idle adventuring
- **Auto-Explore:** toggle in dungeon — the party fights, loots, sells trash, and descends automatically.
  You can watch or tab away.
- **Expedition:** send companions + pets on a timed run (30/60/180 min real time). Returns with a loot
  table roll, chance of injury, chance of finding an egg or a recruit. Fully offline-safe.
- **Offline:** production continues; dungeon auto-explore continues at 60% efficiency up to 8 hours.

---

## 10. Quests

**Generator** picks a template, an NPC requester, and scales targets to player level/town state:

| Type | Example | Reward |
|---|---|---|
| Slay | "Cull 12 Cave Slimes on floors 1–3" | gold, XP, rep |
| Gather | "Bring me 30 ore, the forge is cold" | resources, item |
| Craft | "Forge a Steel Sword for the guard captain" | rep, unlock recipe |
| Deliver | "Take this bread to Lira before dusk" | rep, gold, relationship |
| Explore | "Reach floor 5 and map it" | gold, XP, pet egg |
| Build | "Raise a Tavern — morale is dying" | gold, unlock NPC |
| Social | "Dorn and Rowan aren't speaking. Fix it." | relationship, unique item |

Also: **notice board** quests (NPC↔NPC requests you can take on), **daily bounties**,
**town crises** (raid, plague, famine — timed, fail = consequences), and a **main story chain**
(10 chapters about what woke beneath Hollowdeep).

Quest state machine: offered → accepted → in-progress → completable → done/failed. Tracked in a journal
with pins on the map and floating `!` / `?` markers over requesters.

---

## 11. Pets

- Acquired: eggs from the Wrangler, boss drops, quest rewards, wild taming (Ranger skill).
- Species: Dog, Cat, Fox, Boar, Wolf, Raven, Slime, Sprite, Drake, Golem. Rarity: Common → Mythic.
- Each has: level (gains XP from your kills), 1–3 skills, a **happiness** meter (feed, pet, rest).
- Roles: **Combat** (fights beside you), **Worker** (assigned to a building, +output, no combat),
  **Scout** (reveals dungeon map, finds secrets), **Merchant** (+gold find, carries more loot).
- Happiness < 20 → pet runs off (recoverable quest). Happiness 100 → +25% effect, unlocks evolution.
- Evolution at Lv 20/40 with materials: Fox → Ember Fox → Nine-Tailed Flame.

---

## 12. Art & Presentation

- Internal render resolution **480×270**, integer-scaled with `imageSmoothingEnabled = false`.
- Tile 32×16 iso diamond; characters ~12×16 px; buildings up to 32×32 px.
- Palette discipline: 32 colours per biome, shared shadow/highlight ramp, dithered gradients.
- Procedural sprite generation: character = base body + hair + top + legs + hat/weapon layers, palette-swapped.
  Keeps file size at zero assets and guarantees a consistent look across hundreds of generated NPCs/items.
- Animation: 2-frame walk bob, attack lunge, hurt flash (white), death dissolve, idle breathing.
- Lighting: time-of-day tint layer with `destination-out` punched holes for lanterns/torches/magic,
  plus a radial "player vision" cut at night. Rain/snow/fog particle overlays.
- UI: parchment-and-iron pixel chrome, 9-slice borders, hand-drawn icons, tooltip popups,
  damage numbers, floating dialogue bubbles over NPCs, scrolling town log.
- Audio (later): 6-track adaptive OST (town day/night, dungeon, boss, victory), chiptune SFX via WebAudio.

---

## 13. Idle & Retention Design

- **Offline progress** capped at 8h, computed from saved timestamp on load, with a "While you were away"
  summary screen (resources, gold, floors cleared, town events, quests finished).
- **Daily loop hooks:** stall stock reroll 06:00, daily bounty, NPC birthday, season change, raid roll.
- **Long-term hooks:** town tier, class advancement, pet evolution, item sets, bestiary compendium,
  research tree, achievement codex, endless dungeon leaderboard (local).
- **Respect the player:** no energy timers, no paywalls, no forced ads. Idle rewards are generous;
  active play is always strictly better but never mandatory.

---

## 14. Roadmap

**M0 — Vertical slice (this prototype — BUILT, see §17).** Iso renderer, day/night + weather +
seasons, town gen, 13 NPCs with schedules and a real N↔N market, 17 buildings, resource economy,
combat stats + equipment + inventory + affixes, 40-floor procedural dungeon with 8 guardians,
7-type quest generator, 10 pets, companions, research tree, save/load, offline income. → *Playable loop.*

**M1 — Feel.** Pathfinding polish, combat juice (screenshake, particles, sound), dialogue depth,
portraits, tutorialisation, balancing pass, mobile touch controls.

**M2 — Depth.** Class advancement, research tree, companions in combat, pet evolution, seasons,
raids/town crises, main story ch. 1–3, 30 items, 20 monsters.

**M3 — Content & release.** Full story, 4 biomes/dungeons, achievements, compendium, audio,
Electron/Tauri desktop + Capacitor mobile builds, Steam page.

**Stretch.** Mod support (data-driven items/NPCs), co-op town visiting, endless mode, editor.

---

## 15. Controls (prototype)

`WASD / Arrows` move · `Click` walk/attack · `E` interact · `Space` attack nearest ·
`B` build · `C` character · `I` inventory · `Q` quests · `P` pets · `T` town · `L` log ·
`F` toggle auto-explore · `Esc` close panels · `+ / −` game speed · `F5` save

---

## 16. Open Questions for You

1. **Perspective on the player character:** fixed Warden you control, or a "spirit of the hold" that
   can possess/switch between recruited heroes? (Affects save design & attachment.)
2. **Raid/damage pressure:** should the town ever *lose* things (buildings damaged, NPCs wounded/killed),
   or stay purely constructive and cozy?
3. **Combat weight:** more *Diablo* (active, kiting, build-crafting) or more *auto-battler* (set up party, watch)?
4. **Art direction:** chunky 16px (GBA-ish, this prototype) or finer 32px Hi-Bit (Octopath-ish)?
5. **Scope of romance/social sims:** keep it light (friendship) or full relationship arcs?
6. **Single-player web only**, or is multiplayer town-visiting a goal? (Changes architecture now.)

---

## 17. Prototype Build Notes (what is actually in this build)

**Tech.** Vanilla JS + Canvas 2D. No build step, no dependencies, no external assets — every sprite
is generated procedurally at runtime into an off-screen cache. 12 modules under `js/`, ~6.7k lines,
one global namespace (`EH`). Internal render resolution 480×270, integer-scaled to the window.
Iso tile 32×16. Saves go to `localStorage` (`emberhold.save`) with an autosave every 25s and on
tab-hide/unload.

**Content in the build**

| System | Count | Notes |
| --- | --- | --- |
| Tiles | 29 | ground / water / solid / dungeon-floor / dungeon-wall classes drive walkability |
| Buildings | 17 | each with 5 levels, cost curve, worker slots, footprint, placement rules |
| NPCs | 13 | jobs, schedules, needs (energy/hunger/social/mood), traits, memory, relationships |
| Classes | 4 | Warden · Ranger · Mage · Merchant, 3 active skills each (12 total) |
| Monsters | 14 + 8 guardians | floors 1–40, elites, night-only spawns, summons, ranged |
| Items | 24 bases | 5 rarities, prefix/suffix affixes, legendaries, consumables, materials, eggs |
| Pets | 10 | combat / merchant / scout / utility roles, 5 rarities, feeding & neglect |
| Quests | 7 generators | slay · gather · deliver · build · explore · social · boss |
| Research | 8 nodes | production, tax, vision, pet & companion damage, gold/item find |

**Verification.** `tools/smoke.js` boots the whole game headless against a stub DOM/canvas
(`tools/domstub.js`) and plays it: **88 assertions**, run repeatedly to shake out the
`Math.random`-driven paths. Coverage: data integrity, 3 town seeds, **1000 generated dungeon
floors** (every stair, chest and guardian proven reachable by the real A\*), guardian stat
sanity, all art generators, 5000 rolled items, every class's new game, a 3-day town simulation,
the N↔N economy, day/night schedules, placing and maxing all 17 buildings, 600 generated quests,
a full quest lifecycle, all 12 skills, monster AI, death (including dying *mid-frame*), chests,
auto-explore, pets, companions, all 7 UI panels, all 13 dialogues, tooltips, save/load/offline, a
6000-frame soak at 4× speed with NaN and out-of-bounds sweeps, and finally a **cold boot through
the real browser entry point** (`window.load` → character creation → claim → play a day → save →
reload). Run it with `node tools/smoke.js`.

The DOM stub parses the real `index.html` into a real element tree and returns `null` for ids that
do not exist, exactly like a browser. An earlier version auto-created any id it was asked for,
which quietly hid a hard crash (§17 bug list) — mocks that invent missing DOM are worse than no
mock at all.

**Bugs the harness caught (all fixed).**

1. Cross-file `const EH` redeclaration — every module after the first threw.
2. `rollPool()` returns the `{value, weight}` *entry*, not the value. Four callers used it raw,
   breaking weather rolls (a hard crash every in-game hour), quest generation, pet rarity and
   item rarity.
3. `player.statuses` was never initialised → every combat frame threw.
4. A `roofc` typo killed all 102 building sprites.
5. Dungeon decoration (water, lava, pillars) could seal chests and stairways behind themselves;
   a chest in a nook could also be unreachable while still counting as a valid auto-explore goal.
   Generation now flood-fills from the entrance, refuses any prop that strands the stairs or
   itself, and re-verifies the whole set at the end.
6. Guardians were **double-scaled** — the generic depth curve (`1.175^floor` HP, `1.13^floor`
   armour) was applied on top of their hand-tuned per-floor stats. The floor-20 boss ended up with
   ~21× HP *and* ~15× damage reduction, i.e. effectively unkillable. Guardians now use their
   authored numbers directly.
7. Floors 25–40 had no guardian defined, so `descend()` refused forever — a permanent soft-lock.
   Four new guardians plus a fail-safe that opens the stairs if a boss can't be produced.
8. Auto-explore never actually opened chests or took the stairs (both needed a manual `E` press),
   so the *idle* half of the loop did nothing. It now auto-interacts, and walks its goal list in
   priority order so one unreachable target can't deadlock it.
9. Fresh games assigned nobody a job, so the town produced nothing until the player built
   something new.
10. NPC needs saturated within a single in-game day (hunger maxed every ~4 hours), pinning the
    whole village in a permanent lunch/sleep loop. Retuned to roughly one meal, one night's sleep
    and one good chat per day.
11. The DOM floater layer wasn't aligned to the letterboxed canvas, so every damage number and
    speech bubble rendered in the wrong place.
12. `index.html` was missing `#toast`, `#placebar`, `#placetext` and `#placecancel` — pressing **B**
    to build threw on a null element, and toasts silently vanished.
13. Dying *inside* the monster update loop teleported the player home and nulled `st.dmap` while
    the loop was still iterating the old monster list, corrupting the frame. The loop now
    re-checks the map each step.

**Known limitations / not yet in.** No audio. No touch-specific controls (pointer events work, but
no on-screen stick). Town is never attacked — no raids yet (§16 Q2). Story is environmental only.
Balance is first-pass: the wage bill (~5g/villager/day, +1%/day) versus trade tax (~10%) means a
new Warden runs at a small net loss until they start questing or selling dungeon loot — intentional
pressure, but the numbers want a tuning pass with real players. Multiplayer is not architected for.
