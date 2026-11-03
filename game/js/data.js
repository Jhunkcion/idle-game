/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — data.js : tiles, buildings, items, monsters, classes,
                         names, dialogue
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;

/* ══ PALETTES ═════════════════════════════════════════════════ */
EH.PAL = {
  grass:   ["#4a7c34", "#5c9440", "#3d6829", "#6ba84c"],
  dirt:    ["#8a6b45", "#7a5c3a", "#9c7b52"],
  path:    ["#b09a72", "#9c8663", "#c0aa82"],
  sand:    ["#dcc79a", "#cbb489", "#e8d6ab"],
  water:   ["#2f6f9e", "#3d85b8", "#255c86"],
  stone:   ["#7d7a72", "#6a675f", "#8f8c83", "#575449"],
  stoneD:  ["#4a463f", "#3d3a34", "#585449"],
  wood:    ["#8a5f35", "#6f4a28", "#a37444", "#5a3a1e"],
  roof:    ["#a8452f", "#8c3a26", "#c25a3e"],
  roofB:   ["#4a5f7a", "#3b4d63", "#5d7492"],
  roofG:   ["#5a7a4a", "#48633a", "#6d9059"],
  snow:    ["#e8eef4", "#d2dae4", "#f6fafc"],
  dungeon: ["#544c48", "#443d39", "#645b56"],
  dungW:   ["#2e2926", "#241f1d", "#3a3431"],
  gold:    ["#f0c05a", "#c89a34", "#ffe08a"],
  blood:   "#8a1f14",
};

/* ══ TILES ════════════════════════════════════════════════════ */
/* kind: g=ground  w=water  s=solid  f=floor(dungeon)  x=dungeon wall */
EH.T = {
  VOID: 0, GRASS: 1, GRASS2: 2, FLOWERS: 3, DIRT: 4, PATH: 5, ROAD: 6,
  SAND: 7, WATER: 8, DEEP: 9, STONE: 10, TREE: 11, PINE: 12, ROCK: 13,
  BUSH: 14, BRIDGE: 15, PLAZA: 16,
  DFLOOR: 20, DFWALL: 21, DFPILLAR: 22, DSTAIRS: 23, DCARPET: 24, DCHEST: 25, DPORTAL: 26,
  SFLOOR: 30, SWATER: 31, SLAVA: 32,
  SNOW: 40, ICE: 41
};
EH.TILES = {
  [EH.T.VOID]:    { n: "Void",      kind: "s", pal: ["#0b0908", "#0b0908", "#0b0908"] },
  [EH.T.GRASS]:   { n: "Grass",     kind: "g", pal: EH.PAL.grass },
  [EH.T.GRASS2]:  { n: "Grass",     kind: "g", pal: EH.PAL.grass },
  [EH.T.FLOWERS]: { n: "Meadow",    kind: "g", pal: EH.PAL.grass, deco: "flowers" },
  [EH.T.DIRT]:    { n: "Dirt",      kind: "g", pal: EH.PAL.dirt },
  [EH.T.PATH]:    { n: "Path",      kind: "g", pal: EH.PAL.path },
  [EH.T.ROAD]:    { n: "Road",      kind: "g", pal: EH.PAL.path },
  [EH.T.SAND]:    { n: "Sand",      kind: "g", pal: EH.PAL.sand },
  [EH.T.WATER]:   { n: "Water",     kind: "w", pal: EH.PAL.water, anim: true },
  [EH.T.DEEP]:    { n: "Deep water", kind: "w", pal: [EH.PAL.water[2], EH.PAL.water[0], "#1b4a70"], anim: true },
  [EH.T.STONE]:   { n: "Stone",     kind: "g", pal: EH.PAL.stone },
  [EH.T.TREE]:    { n: "Tree",      kind: "s", pal: EH.PAL.grass, obj: "tree" },
  [EH.T.PINE]:    { n: "Pine",      kind: "s", pal: EH.PAL.grass, obj: "pine" },
  [EH.T.ROCK]:    { n: "Boulder",   kind: "s", pal: EH.PAL.stone, obj: "rock" },
  [EH.T.BUSH]:    { n: "Bush",      kind: "g", pal: EH.PAL.grass, obj: "bush" },
  [EH.T.BRIDGE]:  { n: "Bridge",    kind: "g", pal: EH.PAL.wood },
  [EH.T.PLAZA]:   { n: "Plaza",     kind: "g", pal: EH.PAL.stone },
  [EH.T.DFLOOR]:  { n: "Stone",     kind: "f", pal: EH.PAL.dungeon },
  [EH.T.DFWALL]:  { n: "Wall",      kind: "x", pal: EH.PAL.dungW },
  [EH.T.DFPILLAR]:{ n: "Pillar",    kind: "x", pal: EH.PAL.dungW, obj: "pillar" },
  [EH.T.DSTAIRS]: { n: "Stairs",    kind: "f", pal: EH.PAL.dungeon, obj: "stairs" },
  [EH.T.DCARPET]: { n: "Carpet",    kind: "f", pal: ["#6a2c2c", "#7d3636", "#5a2424"] },
  [EH.T.DCHEST]:  { n: "Chest",     kind: "s", pal: EH.PAL.dungeon, obj: "chest" },
  [EH.T.DPORTAL]: { n: "Portal",    kind: "f", pal: EH.PAL.dungeon, obj: "portal" },
  [EH.T.SFLOOR]:  { n: "Cave",      kind: "f", pal: ["#4a4038", "#3d352e", "#574c42"] },
  [EH.T.SWATER]:  { n: "Cave pool", kind: "w", pal: ["#2a4f5a", "#356270", "#213f48"], anim: true },
  [EH.T.SLAVA]:   { n: "Lava",      kind: "w", pal: ["#c04a18", "#e07028", "#8a2f0e"], anim: true, dmg: 6 },
  [EH.T.SNOW]:    { n: "Snow",      kind: "g", pal: EH.PAL.snow },
  [EH.T.ICE]:     { n: "Ice",       kind: "g", pal: ["#b8d8e8", "#a4c8dc", "#cfe8f4"] },
};
EH.tileDef = id => EH.TILES[id] || EH.TILES[EH.T.VOID];
EH.isSolid = id => { const d = EH.tileDef(id); return d.kind === "s" || d.kind === "x"; };
EH.isWater = id => EH.tileDef(id).kind === "w";
EH.walkable = id => { const k = EH.tileDef(id).kind; return k === "g" || k === "f"; };

/* ══ SEASONS / WEATHER ════════════════════════════════════════ */
EH.SEASONS = [
  { n: "Spring", tint: [0.00, 0.03, 0.00], grow: 1.25, desc: "Planting season. Crops grow faster." },
  { n: "Summer", tint: [0.04, 0.02, -0.02], grow: 1.00, desc: "Long days. Trade flourishes." },
  { n: "Autumn", tint: [0.05, 0.00, -0.04], grow: 1.15, desc: "Harvest. Resource yields up." },
  { n: "Winter", tint: [-0.05, -0.02, 0.05], grow: 0.55, desc: "Short days. Monsters grow bold." },
];
EH.WEATHER = {
  clear:   { n: "Clear",     dark: 0.00, part: null,      w: 40 },
  overcast:{ n: "Overcast",  dark: 0.12, part: null,      w: 22 },
  rain:    { n: "Rain",      dark: 0.24, part: "rain",    w: 14 },
  storm:   { n: "Thunderstorm", dark: 0.34, part: "rain", w: 6, flash: true },
  fog:     { n: "Fog",       dark: 0.14, part: "fog",     w: 10 },
  snow:    { n: "Snow",      dark: 0.10, part: "snow",    w: 8 },
};

/* ══ TIME OF DAY ══════════════════════════════════════════════ */
/* keyframe: hour -> [tint rgb multiplier offset, darkness, ambient colour] */
EH.TOD = [
  { h: 0,  dark: 0.72, amb: "#1b2a52", name: "Night" },
  { h: 4,  dark: 0.72, amb: "#1b2a52", name: "Night" },
  { h: 5.5, dark: 0.50, amb: "#3a3560", name: "Pre-dawn" },
  { h: 7,  dark: 0.22, amb: "#c07a4a", name: "Dawn" },
  { h: 9,  dark: 0.03, amb: "#fff4e0", name: "Morning" },
  { h: 12, dark: 0.00, amb: "#ffffff", name: "Midday" },
  { h: 16, dark: 0.02, amb: "#fff6e6", name: "Afternoon" },
  { h: 18.5, dark: 0.18, amb: "#e08a4a", name: "Dusk" },
  { h: 20, dark: 0.42, amb: "#6a4a7a", name: "Twilight" },
  { h: 21.5, dark: 0.66, amb: "#22305a", name: "Night" },
  { h: 24, dark: 0.72, amb: "#1b2a52", name: "Night" },
];
EH.todAt = function (hour) {
  const T = EH.TOD;
  for (let i = 0; i < T.length - 1; i++) {
    if (hour >= T[i].h && hour <= T[i + 1].h) {
      const t = EH.smooth((hour - T[i].h) / (T[i + 1].h - T[i].h));
      return {
        dark: EH.lerp(T[i].dark, T[i + 1].dark, t),
        amb: EH.mix(EH.hex2rgb(T[i].amb), EH.hex2rgb(T[i + 1].amb), t),
        name: t < 0.5 ? T[i].name : T[i + 1].name
      };
    }
  }
  return { dark: T[0].dark, amb: EH.hex2rgb(T[0].amb), name: T[0].name };
};
EH.isNight = h => h < 5.5 || h >= 20.5;
EH.isShopOpen = h => h >= 8 && h < 20;

/* ══ RESOURCES ════════════════════════════════════════════════ */
EH.RES = [
  { k: "gold", n: "Gold", c: "#f0c05a" },
  { k: "wood", n: "Wood", c: "#a37444" },
  { k: "stone", n: "Stone", c: "#8f8c83" },
  { k: "food", n: "Food", c: "#7ec850" },
  { k: "ore", n: "Ore", c: "#7a9ad0" },
];
EH.RESKEYS = EH.RES.map(r => r.k);

/* ══ BUILDINGS ════════════════════════════════════════════════ */
/* prod: per in-game minute at Lv1 (×1.6 per level). day: daylight only. */
EH.BUILD = {
  house:    { cat: "production", n: "Cottage",        w: 2, h: 2, cost: { gold: 60, wood: 20 },            time: 20,  pop: 2,  desc: "Houses 2 villagers. Homeless folk sleep in the tavern and get grumpy.", roof: EH.PAL.roof, wall: EH.PAL.wood, shape: "house" },
  farm:     { cat: "production", n: "Farm",           w: 3, h: 3, cost: { gold: 80, wood: 30 },            time: 30,  prod: { food: 0.9 },  day: true, workers: 2, desc: "Wheat and turnips. Yields only in daylight; boosted by rain and season.", roof: EH.PAL.roofG, wall: EH.PAL.wood, shape: "farm" },
  lumber:   { cat: "production", n: "Lumber Camp",    w: 2, h: 2, cost: { gold: 100, wood: 10 },           time: 40,  prod: { wood: 0.7 },  workers: 2, desc: "Fells the vale's pines for timber.", roof: EH.PAL.roofB, wall: EH.PAL.wood, shape: "hut" },
  quarry:   { cat: "production", n: "Quarry",         w: 2, h: 2, cost: { gold: 120, wood: 40 },           time: 50,  prod: { stone: 0.55 }, workers: 2, desc: "Cut stone from the hillside.", roof: EH.PAL.stone, wall: EH.PAL.stone, shape: "quarry" },
  mine:     { cat: "production", n: "Mine",           w: 2, h: 2, cost: { gold: 250, wood: 60, stone: 40 }, time: 90, prod: { ore: 0.35 },  workers: 3, desc: "Deep shafts yielding iron ore. Works through the night.", roof: EH.PAL.wood, wall: EH.PAL.stone, shape: "mine", req: "quarry" },
  forge:    { cat: "production", n: "Forge",          w: 2, h: 2, cost: { gold: 200, wood: 50, stone: 40 }, time: 60, workers: 1, svc: "craft", desc: "Craft and upgrade equipment. Required for gear +N.", roof: EH.PAL.stone, wall: EH.PAL.stoneD, shape: "forge", light: 1.0 },
  market:   { cat: "kiosk", n: "Market Stall",   w: 2, h: 2, cost: { gold: 150, wood: 40 },           time: 45,  workers: 1, svc: "shop", desc: "A vendor stall. Generates trade — you collect a 10% market tax.", roof: "#c8a04a", wall: EH.PAL.wood, shape: "stall" },
  tavern:   { cat: "vacation", n: "Tavern",          w: 3, h: 2, cost: { gold: 180, wood: 60, stone: 20 }, time: 60, workers: 1, svc: "tavern", morale: 1, desc: "Ale, rumours and recruits. Raises town morale.", roof: EH.PAL.roofB, wall: EH.PAL.wood, shape: "tavern", light: 0.9 },
  chapel:   { cat: "vacation", n: "Chapel",         w: 2, h: 2, cost: { gold: 220, wood: 50, stone: 60 }, time: 75, workers: 1, svc: "heal", desc: "Potions, healing and revival of fallen companions.", roof: "#d8d2c0", wall: EH.PAL.stone, shape: "chapel", light: 0.7 },
  barracks: { cat: "production", n: "Barracks",       w: 3, h: 2, cost: { gold: 300, wood: 80, stone: 80 }, time: 90, workers: 2, svc: "guards", defense: 3, desc: "Trains guards. Hire them as dungeon companions; raises town defence.", roof: EH.PAL.stone, wall: EH.PAL.stone, shape: "barracks" },
  kennel:   { cat: "production", n: "Kennel",         w: 2, h: 2, cost: { gold: 260, wood: 70, stone: 30 }, time: 80, workers: 1, svc: "pets", desc: "The Wrangler sells pet eggs and trains your beasts.", roof: EH.PAL.roofG, wall: EH.PAL.wood, shape: "kennel" },
  library:  { cat: "production", n: "Library",        w: 2, h: 2, cost: { gold: 400, wood: 100, stone: 120 }, time: 120, workers: 1, svc: "research", desc: "Research permanent passive upgrades for the whole hold.", roof: EH.PAL.roofB, wall: EH.PAL.stone, shape: "library", light: 0.6, req: "forge" },
  warehouse:{ cat: "production", n: "Warehouse",      w: 2, h: 2, cost: { gold: 160, wood: 70, stone: 30 }, time: 50, storage: 500, desc: "Raises resource storage caps by 500.", roof: EH.PAL.wood, wall: EH.PAL.wood, shape: "warehouse" },
  well:     { cat: "decoration", n: "Well",           w: 1, h: 1, cost: { gold: 70, stone: 30 },           time: 20,  morale: 1, decor: { shape: "cross", mul: { food: 1.08, morale: 1.05 } }, desc: "Fresh water. +morale, and farmers work faster nearby.", roof: EH.PAL.stone, wall: EH.PAL.stone, shape: "well" },
  torch:    { cat: "decoration", n: "Lantern Post",   w: 1, h: 1, cost: { gold: 25, wood: 5 },             time: 6,   light: 1.3, decor: { shape: "single", mul: { morale: 1.04 } }, desc: "Lights the streets at night. NPCs feel safer; fewer accidents.", roof: EH.PAL.gold, wall: EH.PAL.wood, shape: "torch" },
  wall:     { cat: "legacy", n: "Palisade",       w: 1, h: 1, cost: { gold: 20, wood: 25 },            time: 8,   defense: 1, desc: "Defensive wall segment. Blocks raiders.", roof: EH.PAL.wood, wall: EH.PAL.wood, shape: "wallseg" },
  monument: { cat: "decoration", n: "Ember Monument", w: 2, h: 2, cost: { gold: 1500, wood: 300, stone: 400, ore: 100 }, time: 300, tier: 2, light: 1.6, morale: 3, desc: "TOWN TIER 2 — unlocks new NPCs, a bigger hold and deeper dungeon lore.", roof: EH.PAL.gold, wall: EH.PAL.stone, shape: "monument", req: "library" },
  /* §5.2 — a decoration buffs ONLY the tiles its shaped footprint physically
     touches. Deliberately stricter than Kairosoft's "8 surrounding tiles": it
     turns decoration into a spatial puzzle rather than a sprinkle.            */
  fountain: { n: "Fountain",     w: 2, h: 2, cat: "decoration", cost: { gold: 240, stone: 90 },          time: 55, decor: { shape: "cross", mul: { food: 1.12, morale: 1.08 } },        desc: "Centre-piece. Cross footprint: only the four tiles at the centre of each face.", roof: EH.PAL.stone, wall: EH.PAL.stone, shape: "well" },
  statue:   { n: "Hero Statue",  w: 2, h: 2, cat: "decoration", cost: { gold: 420, stone: 160, ore: 40 }, time: 95, decor: { shape: "L", dir: "nw", mul: { ore: 1.14, stone: 1.10 } }, desc: "L footprint: two faces meeting at a corner.", roof: EH.PAL.gold, wall: EH.PAL.stone, shape: "monument" },
  banner:   { n: "Guild Banner", w: 1, h: 1, cat: "decoration", cost: { gold: 130, wood: 35 },            time: 25, decor: { shape: "line", dir: "s", mul: { gold: 1.10 } },             desc: "Line footprint: buffs the single face it points at.", roof: "#c8452f", wall: EH.PAL.wood, shape: "torch" },
  hedge:    { n: "Hedge Row",    w: 1, h: 1, cat: "decoration", cost: { gold: 45, wood: 20 },             time: 12, decor: { shape: "single", mul: { wood: 1.07, morale: 1.03 } },       desc: "Cheapest filler. Single footprint: every tile it touches.", roof: EH.PAL.roofG, wall: EH.PAL.roofG, shape: "wallseg" },
};
/* §5.3 — adjacency combos. These cost NO dungeon materials, and that is the
   whole point: when a player is caught between the rank gate and the depth
   gate, reshuffling existing buildings is the guaranteed way out (§11.2).   */
EH.COMBOS = [
  { id: "foundry",     n: "Foundry Work",  a: "forge",     b: "quarry",    mul: { ore: 1.22 },               d: "Smithy beside the quarry: stone arrives hot." },
  { id: "harvest",     n: "Harvest Cycle", a: "farm",      b: "well",      mul: { food: 1.20 },              d: "Irrigation at the field's edge." },
  { id: "purify",      n: "Purification",  a: "chapel",    b: "tavern",    mul: { morale: 1.18 },            d: "Absolution, then a drink. Villagers recover faster." },
  { id: "trade",       n: "Trade Row",     a: "market",    b: "warehouse", mul: { gold: 1.24 },              d: "Goods stored beside goods sold." },
  { id: "scriptorium", n: "Scriptorium",   a: "library",   b: "chapel",    mul: { gold: 1.10, morale: 1.10 },d: "Scribes copy what the faithful request." },
  { id: "warband",     n: "Warband",       a: "barracks",  b: "forge",     mul: { ore: 1.15 },               d: "Drill, then refit. Arms the militia." },
  { id: "menagerie",   n: "Menagerie",     a: "kennel",    b: "farm",      mul: { food: 1.12 },              d: "Beasts work the fields alongside the villagers." },
  { id: "timberyard",  n: "Timberyard",    a: "lumber",    b: "warehouse", mul: { wood: 1.22 },              d: "Felled and stacked in one motion." },
  { id: "deepworks",   n: "Deepworks",     a: "mine",      b: "forge",     mul: { ore: 1.26 },               d: "Ore to the furnace before it cools." },
  { id: "marketday",   n: "Market Day",    a: "market",    b: "tavern",    mul: { gold: 1.18 },              d: "Shoppers spend where they can sit." },
];
EH.buildOrder = ["house", "fountain", "statue", "banner", "hedge", "farm", "lumber", "quarry", "warehouse", "well", "torch", "wall", "market", "forge", "tavern", "chapel", "mine", "barracks", "kennel", "library", "monument"];
EH.UP_COST = lv => ({ gold: Math.round(90 * Math.pow(2.05, lv)), wood: Math.round(30 * Math.pow(1.7, lv)), stone: Math.round(20 * Math.pow(1.7, lv)) });
EH.MAXLVL = 5;

/* ══ PLAYER CLASSES ═══════════════════════════════════════════ */
EH.CLASS = {
  warden: {
    n: "Warden", title: "Warden of Emberhold", c: "#d8452f",
    base: { str: 8, dex: 4, int: 3, vit: 8, per: 3, lck: 2 },
    req: { str: 12, vit: 10 },
    grow: { str: 2.4, dex: 1.1, int: 0.7, vit: 2.4, per: 0.8, lck: 0.6 },
    hp: 14, atk: 1.15, desc: "Front-line bulwark. High health, heavy blows, shields allies.",
    skills: [
      { k: "cleave", n: "Cleave", lvl: 1, cd: 5, cost: 0, desc: "Strike every adjacent foe for 130% damage.", icon: "axe" },
      { k: "bulwark", n: "Bulwark", lvl: 4, cd: 16, cost: 0, desc: "Halve incoming damage for 6s and taunt.", icon: "shield" },
      { k: "execute", n: "Execute", lvl: 9, cd: 11, cost: 0, desc: "Massive blow; triple damage below 25% HP.", icon: "sword" },
    ],
    jobs: [{ lvl: 1, n: "Warden" }, { lvl: 10, n: "Knight" }, { lvl: 25, n: "Paladin" }, { lvl: 50, n: "Ashen Lord" }]
  },
  ranger: {
    n: "Ranger", title: "Ranger of the Vale", c: "#7ec850",
    base: { str: 5, dex: 9, int: 3, vit: 5, per: 5, lck: 3 },
    req: { dex: 12, per: 9 },
    grow: { str: 1.2, dex: 2.6, int: 0.8, vit: 1.4, per: 1.6, lck: 1.0 },
    hp: 11, atk: 1.0, ranged: true, desc: "Mobile skirmisher. Crits, kiting, and better loot finds.",
    skills: [
      { k: "volley", n: "Volley", lvl: 1, cd: 6, cost: 0, desc: "Three quick arrows at the nearest foes.", icon: "bow" },
      { k: "trap", n: "Snare", lvl: 5, cd: 14, cost: 0, desc: "Root the target for 3s.", icon: "trap" },
      { k: "eagle", n: "Eagle Eye", lvl: 10, cd: 20, cost: 0, desc: "+100% crit chance for 5s.", icon: "eye" },
    ],
    jobs: [{ lvl: 1, n: "Ranger" }, { lvl: 10, n: "Hunter" }, { lvl: 25, n: "Sharpshooter" }, { lvl: 50, n: "Windwalker" }]
  },
  mage: {
    n: "Mage", title: "Mage of the Hollow", c: "#8e5cd8",
    base: { str: 2, dex: 4, int: 10, vit: 4, per: 4, lck: 3 },
    req: { int: 12 },
    grow: { str: 0.6, dex: 1.0, int: 2.8, vit: 1.1, per: 1.3, lck: 1.2 },
    hp: 9, atk: 1.25, caster: true, desc: "Glass cannon. Ember magic burns crowds to ash.",
    skills: [
      { k: "bolt", n: "Ember Bolt", lvl: 1, cd: 3.4, cost: 0, desc: "Hurl a bolt of fire for 160% spell damage.", icon: "fire" },
      { k: "burst", n: "Emberburst", lvl: 6, cd: 12, cost: 0, desc: "AoE explosion around you, applies burn.", icon: "burst" },
      { k: "ward", n: "Mana Ward", lvl: 11, cd: 22, cost: 0, desc: "Absorb damage equal to 40% max HP for 8s.", icon: "shield" },
    ],
    jobs: [{ lvl: 1, n: "Mage" }, { lvl: 10, n: "Adept" }, { lvl: 25, n: "Elementalist" }, { lvl: 50, n: "Archmage" }]
  },
  merchant: {
    n: "Merchant", title: "Coin of the Vale", c: "#f0c05a",
    base: { str: 4, dex: 5, int: 6, vit: 4, per: 6, lck: 8 },
    req: { lck: 11, per: 9 },
    grow: { str: 1.0, dex: 1.3, int: 1.6, vit: 1.1, per: 2.0, lck: 2.4 },
    hp: 10, atk: 0.9, desc: "Economy build. Far more gold and rarer loot; talks their way out of trouble.",
    skills: [
      { k: "coinshot", n: "Coin Shot", lvl: 1, cd: 4, cost: 0, desc: "Fling gold as a weapon — 200% dmg, costs 5g.", icon: "coin" },
      { k: "appraise", n: "Appraise", lvl: 5, cd: 18, cost: 0, desc: "Reveal and duplicate the next loot drop.", icon: "eye" },
      { k: "bribe", n: "Bribe", lvl: 10, cd: 25, cost: 0, desc: "Pay gold to make a foe flee instantly.", icon: "coin" },
    ],
    jobs: [{ lvl: 1, n: "Merchant" }, { lvl: 10, n: "Trader" }, { lvl: 25, n: "Guildmaster" }, { lvl: 50, n: "Coin Sovereign" }]
  },
};
/* ══ §6.1 JOB TRAINING — jobs are the training ground ══════════════
   A villager's job physically demands certain stats, so working it grows them.
   `grow` = stat points per GAME DAY of actual work. This table is why base
   building determines the army: a village of farms can only ever produce
   warriors, because only farmers grow STR.                                */
EH.JOB_TRAIN = {
  farmer:      { base: { str: 3 },         grow: { str: 0.26 },                                   d: "Hauling sacks is strength work." },
  lumberjack:  { base: { str: 2, vit: 2 }, grow: { str: 0.20, vit: 0.16 },                        d: "Felling and carrying." },
  quarrier:    { base: { str: 2, vit: 2 }, grow: { str: 0.18, vit: 0.20 },                        d: "Swinging and enduring." },
  miner:       { base: { str: 2, vit: 3 }, grow: { str: 0.16, vit: 0.24 },                        d: "Dark, heavy, relentless." },
  blacksmith:  { base: { str: 2, int: 1 }, grow: { str: 0.16, int: 0.14 },                        d: "Hammer and plan." },
  guard:       { base: { str: 3, vit: 2 }, grow: { str: 0.22, vit: 0.18 },                        d: "Drill all day." },
  merchant:    { base: { lck: 3, per: 1 }, grow: { lck: 0.24, per: 0.14 },                        d: "Reading a buyer." },
  bard:        { base: { per: 2, lck: 2 }, grow: { per: 0.22, lck: 0.16 },                        d: "Reading a room." },
  healer:      { base: { int: 2, per: 2 }, grow: { int: 0.20, per: 0.18 },                        d: "Diagnosis and dosage." },
  scholar:     { base: { int: 4 },         grow: { int: 0.30 },                                   d: "Nothing but study." },
  wrangler:    { base: { dex: 3, per: 1 }, grow: { dex: 0.26, per: 0.12 },                        d: "Quick hands, quicker beasts." },
  courier:     { base: { dex: 3 },         grow: { dex: 0.30 },                                   d: "Running the vale end to end." },
  cook:        { base: { per: 2, lck: 1 }, grow: { per: 0.20, lck: 0.16 },                        d: "Timing and tasting." },
  villager:    { base: {},                 grow: { str: 0.06, dex: 0.06, int: 0.06, vit: 0.06, per: 0.06, lck: 0.06 }, d: "Odd jobs teach a little of everything." },
  child:       { base: {},                 grow: { dex: 0.10, per: 0.08 },                        d: "Growing up." },
  elder:       { base: { per: 4, int: 3 }, grow: {},                                              d: "Retired. Wisdom, but no further growth." },
};
EH.STATLIST = [
  { k: "str", n: "Strength", d: "+melee damage, carry capacity" },
  { k: "dex", n: "Dexterity", d: "+crit chance, attack speed, dodge" },
  { k: "int", n: "Intellect", d: "+spell power, XP gain" },
  { k: "vit", n: "Vitality", d: "+max HP, defence, regeneration" },
  { k: "per", n: "Perception", d: "+item find, shop prices, trap sense" },
  { k: "lck", n: "Luck", d: "+crit damage, rare drops, good events" },
];
/* stat key -> display name, so every rule can explain itself in words (P5) */
EH.STATNAME = {}; for (const _s of EH.STATLIST) EH.STATNAME[_s.k] = _s.n;
EH.xpFor = lv => Math.round(45 * Math.pow(lv, 1.55) + 35 * lv);

/* ══ ITEM BASES ═══════════════════════════════════════════════ */
/* slot: wpn off head chest legs boot ring amul cloak */
EH.SLOTS = {
  wpn: "Weapon", off: "Off-hand", head: "Head", chest: "Chest",
  legs: "Legs", boot: "Boots", ring: "Ring", amul: "Amulet", cloak: "Cloak"
};
EH.TIER = [
  { n: "Crude",   mul: 1.00, lv: 1,  c: "#a89880" },
  { n: "Iron",    mul: 1.45, lv: 5,  c: "#c0c0c8" },
  { n: "Steel",   mul: 2.00, lv: 11, c: "#d8e0e8" },
  { n: "Silver",  mul: 2.80, lv: 19, c: "#e8f0ff" },
  { n: "Ember",   mul: 4.00, lv: 29, c: "#f0a050" },
  { n: "Mythril", mul: 6.00, lv: 42, c: "#8ef0d8" },
];
EH.RARITY = [
  { k: "common",    n: "Common",    w: 62, aff: 0, mul: 1.00, c: "#cbbb9c" },
  { k: "uncommon",  n: "Uncommon",  w: 24, aff: 1, mul: 1.22, c: "#7ec850" },
  { k: "rare",      n: "Rare",      w: 10, aff: 2, mul: 1.55, c: "#4f8fe0" },
  { k: "epic",      n: "Epic",      w: 3.4, aff: 3, mul: 2.00, c: "#a85ce0" },
  { k: "legendary", n: "Legendary", w: 0.6, aff: 4, mul: 2.80, c: "#e0933a" },
];
EH.ITEMBASE = [
  // weapons
  { id: "sword",  slot: "wpn", n: "Sword",        atk: 6,  tier: 0, hands: 1, type: "melee",  icon: "sword" },
  { id: "axe",    slot: "wpn", n: "Axe",          atk: 8,  tier: 0, hands: 1, type: "melee",  icon: "axe", slow: 0.85 },
  { id: "dagger", slot: "wpn", n: "Dagger",       atk: 4,  tier: 0, hands: 1, type: "melee",  icon: "dagger", fast: 1.5 },
  { id: "mace",   slot: "wpn", n: "Mace",         atk: 7,  tier: 1, hands: 1, type: "melee",  icon: "mace", slow: 0.8 },
  { id: "bow",    slot: "wpn", n: "Bow",          atk: 6,  tier: 0, hands: 2, type: "ranged", icon: "bow", ranged: true },
  { id: "staff",  slot: "wpn", n: "Staff",        atk: 5,  tier: 0, hands: 2, type: "magic",  icon: "staff", sp: 1.4, caster: true },
  { id: "wand",   slot: "wpn", n: "Wand",         atk: 4,  tier: 1, hands: 1, type: "magic",  icon: "wand", sp: 1.2, caster: true },
  // offhand
  { id: "shield", slot: "off", n: "Shield",       def: 5,  tier: 0, icon: "shield" },
  { id: "torch2", slot: "off", n: "Torch",        def: 0,  tier: 0, icon: "torch", light: 1.6 },
  { id: "tome",   slot: "off", n: "Tome",         def: 1,  tier: 1, icon: "book", sp: 1.2 },
  // armour
  { id: "cap",    slot: "head", n: "Cap",         def: 2,  tier: 0, icon: "cap" },
  { id: "helm",   slot: "head", n: "Helm",        def: 5,  tier: 1, icon: "helm" },
  { id: "hood",   slot: "head", n: "Hood",        def: 3,  tier: 0, icon: "hood", spd: 1.05 },
  { id: "shirt",  slot: "chest", n: "Shirt",      def: 3,  tier: 0, icon: "shirt" },
  { id: "mail",   slot: "chest", n: "Mail",       def: 8,  tier: 1, icon: "mail" },
  { id: "plate",  slot: "chest", n: "Plate",      def: 14, tier: 2, icon: "plate", spd: 0.93 },
  { id: "robe",   slot: "chest", n: "Robe",       def: 4,  tier: 0, icon: "robe", sp: 1.2 },
  { id: "pants",  slot: "legs", n: "Trousers",    def: 3,  tier: 0, icon: "pants" },
  { id: "greaves", slot: "legs", n: "Greaves",    def: 7,  tier: 1, icon: "greaves" },
  { id: "boots",  slot: "boot", n: "Boots",       def: 2,  tier: 0, icon: "boots", spd: 1.06 },
  { id: "sabaton", slot: "boot", n: "Sabatons",   def: 6,  tier: 1, icon: "sabaton" },
  { id: "ring",   slot: "ring", n: "Ring",        def: 0,  tier: 0, icon: "ring" },
  { id: "amulet", slot: "amul", n: "Amulet",      def: 1,  tier: 0, icon: "amulet" },
  { id: "cloak",  slot: "cloak", n: "Cloak",      def: 2,  tier: 0, icon: "cloak", spd: 1.03 },
];
EH.AFFIX = [
  { k: "str", n: "of Might",       g: lv => 1 + Math.round(lv * 0.55), stat: "str" },
  { k: "dex", n: "of Dexterity",   g: lv => 1 + Math.round(lv * 0.55), stat: "dex" },
  { k: "int", n: "of Insight",     g: lv => 1 + Math.round(lv * 0.55), stat: "int" },
  { k: "vit", n: "of Vitality",    g: lv => 1 + Math.round(lv * 0.55), stat: "vit" },
  { k: "per", n: "of the Owl",     g: lv => 1 + Math.round(lv * 0.5),  stat: "per" },
  { k: "lck", n: "of Fortune",     g: lv => 1 + Math.round(lv * 0.5),  stat: "lck" },
  { k: "crit", n: "of Precision",  g: lv => 1 + Math.round(lv * 0.4),  pct: "crit" },
  { k: "critdmg", n: "of Ruin",    g: lv => 4 + Math.round(lv * 1.6),  pct: "critdmg" },
  { k: "hp", n: "of the Bear",     g: lv => 6 + Math.round(lv * 3.4),  flat: "hp" },
  { k: "def", n: "of Iron Skin",   g: lv => 2 + Math.round(lv * 0.9),  flat: "def" },
  { k: "leech", n: "of the Leech", g: lv => 1 + Math.round(lv * 0.25), pct: "leech" },
  { k: "gold", n: "of Avarice",    g: lv => 2 + Math.round(lv * 1.2),  pct: "goldfind" },
  { k: "mf", n: "of Discovery",    g: lv => 2 + Math.round(lv * 1.0),  pct: "itemfind" },
  { k: "spd", n: "of the Wind",    g: () => 4 + EH.randint(0, 8), pct: "speed" },
  { k: "xp", n: "of Wisdom",       g: lv => 2 + Math.round(lv * 0.9),  pct: "xpgain" },
  { k: "burn", n: "of Cinders",    g: lv => 2 + Math.round(lv * 0.8),  flat: "burn" },
  { k: "pet", n: "of the Beast",   g: lv => 3 + Math.round(lv * 1.3),  pct: "petdmg" },
];
EH.PREFIX = [
  { k: "sturdy", n: "Sturdy", g: () => ({ def: EH.randint(2, 8) }) },
  { k: "keen", n: "Keen", g: () => ({ atk: EH.randint(2, 7), crit: EH.randint(1, 5) }) },
  { k: "brutal", n: "Brutal", g: () => ({ atk: EH.randint(3, 10), critdmg: EH.randint(5, 18) }) },
  { k: "gleaming", n: "Gleaming", g: () => ({ goldfind: EH.randint(4, 16) }) },
  { k: "ancient", n: "Ancient", g: () => ({ xpgain: EH.randint(4, 14), int: EH.randint(1, 6) }) },
  { k: "swift", n: "Swift", g: () => ({ speed: EH.randint(5, 14) }) },
  { k: "vicious", n: "Vicious", g: () => ({ atk: EH.randint(2, 9), leech: EH.randint(1, 5) }) },
];
EH.LEGENDARY = [
  { n: "Ashbringer", flav: "Forged in the hold's last fire. It remembers every warden.", fx: { atkMul: 1.5, burn: 12 } },
  { n: "Hollow Crown", flav: "Worn by the king beneath the hill. It whispers.", fx: { hpMul: 1.4, int: 12 } },
  { n: "Coin Sovereign's Ledger", flav: "Every debt in the vale is written here. Including yours.", fx: { goldfind: 90, lck: 15 } },
  { n: "Windwalker's Step", flav: "The wind does not touch the ground. Neither do you.", fx: { speed: 35, dex: 14 } },
  { n: "Emberheart", flav: "A shard of the thing that woke. Still warm.", fx: { hpMul: 1.6, leech: 8, burn: 20 } },
  { n: "Nine-Tailed Charm", flav: "Foxes follow you home now.", fx: { petdmg: 80, lck: 12 } },
];
/* consumables & materials */
EH.CONSUM = [
  { id: "potion_s", n: "Minor Healing Potion", kind: "potion", heal: 40, price: 25, icon: "potion", c: "#d8452f", stack: 20 },
  { id: "potion_m", n: "Healing Potion", kind: "potion", heal: 110, price: 70, icon: "potion", c: "#e05a4a", stack: 20 },
  { id: "potion_l", n: "Greater Healing Potion", kind: "potion", heal: 320, price: 210, icon: "potion", c: "#f07a6a", stack: 20 },
  { id: "elixir_str", n: "Elixir of Might", kind: "buff", buff: "str", amt: 6, dur: 180, price: 120, icon: "flask", c: "#c04a2f", stack: 10 },
  { id: "elixir_fort", n: "Elixir of Fortune", kind: "buff", buff: "lck", amt: 8, dur: 180, price: 150, icon: "flask", c: "#f0c05a", stack: 10 },
  { id: "bread", n: "Bread", kind: "food", heal: 18, price: 6, icon: "bread", c: "#c89a54", stack: 40 },
  { id: "stew", n: "Hearty Stew", kind: "food", heal: 60, price: 22, icon: "stew", c: "#a86a3a", stack: 30 },
  { id: "scroll_tp", n: "Scroll of Recall", kind: "scroll", fx: "recall", price: 90, icon: "scroll", c: "#d8d2c0", stack: 10 },
  { id: "scroll_id", n: "Scroll of Identify", kind: "scroll", fx: "identify", price: 40, icon: "scroll", c: "#a8c8e8", stack: 10 },
  { id: "petfood", n: "Pet Treat", kind: "petfood", happy: 25, price: 18, icon: "meat", c: "#a8553a", stack: 40 },
];
EH.MATS = [
  { id: "pelt", n: "Beast Pelt", price: 9, icon: "pelt", c: "#a8744a" },
  { id: "fang", n: "Wolf Fang", price: 14, icon: "fang", c: "#e0dcd0" },
  { id: "bone", n: "Bone Dust", price: 11, icon: "bone", c: "#d8d2c0" },
  { id: "slime", n: "Slime Core", price: 13, icon: "slime", c: "#7ec850" },
  { id: "ectoplasm", n: "Ectoplasm", price: 26, icon: "ecto", c: "#8ef0d8" },
  { id: "ember", n: "Ember Shard", price: 120, icon: "shard", c: "#f0703a" },
  { id: "ironbar", n: "Iron Bar", price: 34, icon: "bar", c: "#9aa0a8" },
  { id: "herb", n: "Vale Herb", price: 8, icon: "herb", c: "#5a9a3a" },
  { id: "wheat", n: "Wheat Sheaf", price: 5, icon: "wheat", c: "#d8c05a" },
  { id: "egg", n: "Mystery Egg", price: 200, icon: "egg", c: "#e8dcc0", kind: "egg" },
];

/* ══ BESTIARY ═════════════════════════════════════════════════ */
EH.MON = [
  { id: "slime",   n: "Cave Slime",   hp: 22,  atk: 4,  def: 1,  spd: 1.1, xp: 7,  gold: [2, 5],   fl: [1, 5],  c: "#6ab04a", body: "slime", drops: [["slime", 0.5]] },
  { id: "rat",     n: "Rat Swarm",    hp: 16,  atk: 5,  def: 0,  spd: 2.0, xp: 6,  gold: [1, 4],   fl: [1, 4],  c: "#8a6b45", body: "rat",   drops: [["pelt", 0.35]] },
  { id: "bat",     n: "Cave Bat",     hp: 14,  atk: 6,  def: 0,  spd: 2.6, xp: 8,  gold: [2, 6],   fl: [1, 7],  c: "#6a5a7a", body: "bat",   fly: true, drops: [["fang", 0.2]] },
  { id: "goblin",  n: "Goblin Scout", hp: 34,  atk: 8,  def: 2,  spd: 1.7, xp: 14, gold: [5, 12],  fl: [2, 9],  c: "#7a9a4a", body: "humanoid", drops: [["pelt", 0.2], ["ironbar", 0.12]], gear: 0.12 },
  { id: "fungus",  n: "Fungal Lurker", hp: 52, atk: 9,  def: 4,  spd: 0.7, xp: 19, gold: [6, 14],  fl: [4, 12], c: "#a87ac0", body: "fungus", drops: [["herb", 0.4], ["slime", 0.2]] },
  { id: "skeleton", n: "Skeleton",    hp: 46,  atk: 12, def: 3,  spd: 1.5, xp: 24, gold: [8, 18],  fl: [5, 14], c: "#d8d2c0", body: "humanoid", drops: [["bone", 0.45]], gear: 0.16 },
  { id: "beetle",  n: "Stone Beetle", hp: 78,  atk: 13, def: 9,  spd: 1.0, xp: 30, gold: [10, 22], fl: [6, 15], c: "#7a7268", body: "beetle", drops: [["ironbar", 0.25]] },
  { id: "imp",     n: "Ember Imp",    hp: 40,  atk: 17, def: 2,  spd: 2.2, xp: 32, gold: [12, 26], fl: [7, 16], c: "#e06a3a", body: "imp", ranged: 4, drops: [["ember", 0.08]] },
  { id: "wolf",    n: "Hollow Wolf",  hp: 62,  atk: 16, def: 4,  spd: 2.4, xp: 34, gold: [10, 24], fl: [8, 18], c: "#5a5a66", body: "beast", drops: [["pelt", 0.5], ["fang", 0.35]] },
  { id: "wraith",  n: "Wraith",       hp: 70,  atk: 22, def: 3,  spd: 1.8, xp: 48, gold: [18, 38], fl: [10, 22], c: "#8ef0d8", body: "wraith", fly: true, drops: [["ectoplasm", 0.4]] },
  { id: "shaman",  n: "Goblin Shaman", hp: 66, atk: 20, def: 5,  spd: 1.4, xp: 52, gold: [20, 42], fl: [11, 24], c: "#4a8a6a", body: "humanoid", ranged: 5, drops: [["herb", 0.4]], gear: 0.2, summon: "goblin" },
  { id: "troll",   n: "Cave Troll",   hp: 190, atk: 28, def: 12, spd: 1.0, xp: 95, gold: [40, 80], fl: [13, 28], c: "#6a8a4a", body: "troll", drops: [["pelt", 0.6], ["bone", 0.4]], gear: 0.22 },
  { id: "stalker", n: "Night Stalker", hp: 120, atk: 34, def: 7, spd: 2.8, xp: 110, gold: [45, 90], fl: [16, 34], c: "#3a2a4a", body: "beast", night: true, drops: [["ectoplasm", 0.4], ["fang", 0.5]] },
  { id: "cultist", n: "Deep Cultist", hp: 150, atk: 32, def: 9, spd: 1.6, xp: 130, gold: [55, 110], fl: [18, 40], c: "#7a2a3a", body: "humanoid", ranged: 5, drops: [["ember", 0.15]], gear: 0.28 },
];
EH.BOSS = [
  { id: "hollowking", n: "The Hollow King", hp: 900, atk: 34, def: 14, spd: 1.2, xp: 600, gold: [200, 340], fl: 5, c: "#c8a04a", body: "boss1", drops: [["ember", 1], ["egg", 0.5]], gear: 1, legendary: 0.25 },
  { id: "motherdeep", n: "Mother of Deep", hp: 2600, atk: 62, def: 24, spd: 1.0, xp: 1800, gold: [600, 1000], fl: 10, c: "#a85ce0", body: "boss2", drops: [["ember", 2], ["egg", 1]], gear: 1, legendary: 0.4, summon: "slime" },
  { id: "ashenlord",  n: "The Ashen Tyrant", hp: 7200, atk: 110, def: 44, spd: 1.4, xp: 5200, gold: [1800, 3000], fl: 15, c: "#e06a3a", body: "boss3", drops: [["ember", 4], ["egg", 1]], gear: 1, legendary: 0.6 },
  { id: "voidheart",  n: "Heart of the Void", hp: 20000, atk: 200, def: 80, spd: 1.1, xp: 16000, gold: [5000, 9000], fl: 20, c: "#3a2a5a", body: "boss4", drops: [["ember", 8]], gear: 1, legendary: 1 },
  { id: "glassthrone", n: "The Glass Throne", hp: 30000, atk: 265, def: 105, spd: 1.3, xp: 26000, gold: [9000, 15000], fl: 25, c: "#7ad8e0", body: "boss2", drops: [["ember", 10], ["egg", 1]], gear: 1, legendary: 1, summon: "wraith" },
  { id: "rotfather",  n: "Father of Rot",    hp: 45000, atk: 340, def: 135, spd: 0.9, xp: 40000, gold: [14000, 22000], fl: 30, c: "#8ab03a", body: "boss3", drops: [["ember", 14], ["egg", 1]], gear: 1, legendary: 1, summon: "fungus" },
  { id: "emberlich",  n: "The Ember Lich",   hp: 65000, atk: 430, def: 170, spd: 1.2, xp: 60000, gold: [22000, 34000], fl: 35, c: "#e0a03a", body: "boss1", drops: [["ember", 18]], gear: 1, legendary: 1, summon: "skeleton" },
  { id: "deepmother", n: "She Who Waits Below", hp: 90000, atk: 540, def: 215, spd: 1.0, xp: 90000, gold: [34000, 52000], fl: 40, c: "#c03a6a", body: "boss4", drops: [["ember", 24]], gear: 1, legendary: 1 },
];
EH.monById = id => EH.MON.find(m => m.id === id);
EH.bossById = id => EH.BOSS.find(m => m.id === id);
EH.bossForFloor = fl => EH.BOSS.filter(b => b.fl === fl)[0] || EH.BOSS[EH.BOSS.length - 1];
EH.monsForFloor = fl => EH.MON.filter(m => fl >= m.fl[0] && fl <= m.fl[1] + 2);
EH.monScale = fl => Math.pow(1.175, fl - 1);

/* ══ PETS ═════════════════════════════════════════════════════ */
EH.PETS = [
  { id: "dog",    n: "Hold Hound",   role: "combat",   atk: 5,  hp: 40,  spd: 2.4, c: "#a8744a", body: "dog",   skill: { n: "Maul", d: "Bites for 150% damage every 4s." } },
  { id: "cat",    n: "Ember Cat",    role: "merchant", atk: 4,  hp: 30,  spd: 2.8, c: "#4a4038", body: "cat",   skill: { n: "Purse Snatcher", d: "+18% gold find." }, fx: { goldfind: 18 } },
  { id: "fox",    n: "Vale Fox",     role: "scout",    atk: 5,  hp: 32,  spd: 3.0, c: "#d8703a", body: "fox",   skill: { n: "Sniff Out", d: "Reveals chests and stairs on the floor." }, fx: { itemfind: 15 } },
  { id: "boar",   n: "Tusked Boar",  role: "worker",   atk: 7,  hp: 60,  spd: 1.8, c: "#6a5240", body: "boar",  skill: { n: "Gore", d: "Charges, stunning the foe for 1.5s." } },
  { id: "wolf",   n: "Grey Wolf",    role: "combat",   atk: 9,  hp: 55,  spd: 2.8, c: "#7a7a86", body: "wolf",  skill: { n: "Pack Fury", d: "+8% attack speed per hit, stacking." } },
  { id: "raven",  n: "Ash Raven",    role: "scout",    atk: 4,  hp: 26,  spd: 3.2, c: "#2a2a34", body: "raven", skill: { n: "Carrion Call", d: "Loot flies to you automatically." }, fly: true },
  { id: "slimep", n: "Pet Slime",    role: "worker",   atk: 3,  hp: 70,  spd: 1.4, c: "#7ec850", body: "slime", skill: { n: "Absorb", d: "Eats 5% of damage you take." }, fx: { dmgReduce: 5 } },
  { id: "sprite", n: "Vale Sprite",  role: "merchant", atk: 3,  hp: 24,  spd: 2.6, c: "#8ef0d8", body: "sprite", skill: { n: "Mend", d: "Heals you for 1% HP every 3s." }, fly: true, fx: { regen: 1 } },
  { id: "drake",  n: "Cinder Drake", role: "combat",   atk: 14, hp: 90,  spd: 2.2, c: "#c04a2f", body: "drake", skill: { n: "Cinder Breath", d: "Burns foes in a cone." }, fly: true, rare: true },
  { id: "golem",  n: "Stone Golem",  role: "worker",   atk: 12, hp: 160, spd: 1.0, c: "#8f8c83", body: "golem", skill: { n: "Bulwark Body", d: "Taunts enemies, +15 defence." }, rare: true },
];
EH.petById = id => EH.PETS.find(p => p.id === id);
EH.PETRAR = [{ k: "common", n: "Common", w: 60, mul: 1, c: "#cbbb9c" }, { k: "uncommon", n: "Uncommon", w: 25, mul: 1.3, c: "#7ec850" }, { k: "rare", n: "Rare", w: 11, mul: 1.7, c: "#4f8fe0" }, { k: "epic", n: "Epic", w: 3.4, mul: 2.3, c: "#a85ce0" }, { k: "mythic", n: "Mythic", w: 0.6, mul: 3.4, c: "#e0933a" }];
EH.petXpFor = lv => Math.round(60 * Math.pow(lv, 1.5));

/* ══ NPC NAMES / TRAITS / LINES ═══════════════════════════════ */
EH.NAMES_M = ["Bram", "Dorn", "Rowan", "Aldric", "Cedric", "Ewan", "Garrick", "Halvard", "Ivo", "Jory", "Kellan", "Lucan", "Merek", "Osric", "Perrin", "Quill", "Sten", "Tobin", "Ulric", "Wendel", "Yorin", "Ambrose", "Fenwick", "Godwin"];
EH.NAMES_F = ["Mara", "Lira", "Sela", "Aveline", "Bryn", "Cira", "Della", "Elswyth", "Fenna", "Gwyn", "Hazel", "Isolde", "Jessa", "Katrin", "Linnet", "Morwenna", "Nessa", "Odile", "Perpetua", "Roswyn", "Sylvie", "Tamsin", "Ysolde"];
EH.NAMES_LAST = ["Ashdown", "Barrow", "Cinderwell", "Dunmore", "Emberly", "Farrow", "Greystone", "Hollow", "Ironhand", "Kettleblack", "Loam", "Mirefoot", "Nettle", "Oakenshield", "Pyne", "Quarry", "Rook", "Stonebridge", "Thistle", "Underhill", "Vale", "Winterbourne"];
EH.TRAITS = [
  { k: "cheerful", n: "Cheerful", d: "+social gain, better greetings" },
  { k: "gruff", n: "Gruff", d: "Slow to warm, loyal once won" },
  { k: "greedy", n: "Greedy", d: "Charges more, trades more often" },
  { k: "generous", n: "Generous", d: "Gives gifts, cheaper prices" },
  { k: "hardy", n: "Hardy", d: "Works longer, needs less sleep" },
  { k: "nervous", n: "Nervous", d: "Frightened at night, spreads rumours" },
  { k: "pious", n: "Pious", d: "Visits the chapel, blesses the hold" },
  { k: "nosy", n: "Nosy", d: "Gossips constantly — great intel" },
  { k: "brave", n: "Brave", d: "Better companion, joins raids" },
  { k: "lazy", n: "Lazy", d: "Works slower, naps often" },
];
EH.GREET = {
  day: ["Morning, Warden.", "Fine day for it.", "The vale's quiet today. Too quiet?", "Off to the Hollowdeep again?", "You look like you've seen a ghost.", "Bread's fresh, if you've coin.", "My back's killing me.", "They say the deep stairs go down forever.", "Warden! Good to see you above ground.", "Rain's coming, I can feel it in my knee."],
  night: ["Shouldn't you be abed?", "Careful — things walk the vale at night.", "I couldn't sleep. Something's scratching below.", "The lanterns keep the worst away.", "Night air's bad for the lungs and the soul.", "Don't go near the crack in the hill after dark."],
  happy: ["Best day in the vale in years!", "You've done Emberhold proud.", "I'd follow you into the dark, Warden.", "Ha! You're good for this town."],
  sad: ["I've nothing good to say today.", "This place is wearing me down.", "Don't ask.", "Sorry. Not in the mood."],
  rain: ["Wretched weather.", "Rain's good for the wheat, bad for my mood.", "Get inside, you'll catch your death."],
  first: ["You must be the new Warden. About time.", "Welcome to Emberhold. Mind the well.", "So you're the one who inherited the deed. My condolences."],
};
EH.GOSSIP = [
  "says the mine's producing less each week.",
  "reckons there's a door at the bottom of the Hollowdeep.",
  "heard singing from under the chapel. Twice.",
  "owes the merchant three gold and is avoiding him.",
  "says the old warden didn't die of natural causes.",
  "thinks the wolves are getting bolder.",
  "swears they saw lights on floor ten.",
  "wants to leave the vale. Everyone says that.",
  "baked too much bread again.",
  "is worried about the children near the crack.",
  "says you're doing a good job, Warden.",
  "claims the tavern ale is watered down.",
];
EH.RUMOUR = [
  "There's a chest on the next floor that isn't on any map.",
  "Silver-tier gear starts dropping around floor nineteen.",
  "Feed your pet and it fights harder. Neglect it and it runs off.",
  "Market tax is ten percent of every trade between villagers.",
  "The Forge can push gear to +10 if you have the ore.",
  "Guards from the Barracks will follow you into the deep.",
  "Sleeping skips the night — but the town keeps working while you do.",
  "Legendary items have names. Remember them.",
  "Rain makes crops grow a quarter faster.",
  "Some monsters only hunt at night. Some only fear the light.",
];

/* ══ DUNGEON LORE ═════════════════════════════════════════════ */
EH.LORE = [
  "Scratched into the wall: 'WE DUG TOO DEEP AND FOUND THE WARMTH.'",
  "A child's doll, petrified. It is facing the stairs down.",
  "Bones arranged in a spiral. Someone was patient here.",
  "The air is warmer the deeper you go. It shouldn't be.",
  "A dwarf-scribed ledger. The last entry reads: 'Day 4,012. It speaks with my wife's voice.'",
  "Lantern oil, still fresh. You are not the first down here tonight.",
  "A mural of a crowned figure descending into an eye.",
  "Someone has scratched tally marks. There are nine hundred of them.",
];

/* ══ QUEST TEMPLATES ══════════════════════════════════════════ */
EH.QTPL = [
  { k: "slay",    w: 30, n: (m, c) => `Cull ${c} ${m.n}${c > 1 ? "s" : ""}`, d: (m, c) => `The ${m.n.toLowerCase()}${c > 1 ? "s are" : " is"} thinning our herds and our nerve. Put down ${c} of them in the Hollowdeep.` },
  { k: "gather",  w: 22, n: (r, c) => `Collect ${c} ${r.n.toLowerCase()}`, d: (r, c) => `We're short on ${r.n.toLowerCase()}. Bring me ${c} and the work won't stall.` },
  { k: "deliver", w: 12, n: (t) => `Deliver to ${t}`, d: (t) => `Take this to ${t} before dusk. Don't open it, don't eat it, don't drop it.` },
  { k: "explore", w: 16, n: (f) => `Map floor ${f} of the Hollowdeep`, d: (f) => `Nobody's charted past floor ${f - 1}. Go down, walk it, come back alive.` },
  { k: "build",   w: 10, n: (b) => `Raise a ${b}`, d: (b) => `Emberhold needs a ${b.toLowerCase()}. Build it and the town will thank you.` },
  { k: "boss",    w: 8,  n: (b) => `Slay ${b}`, d: (b) => `${b} waits at the bottom. End it.` },
  { k: "social",  w: 6,  n: (a, b) => `Mend things between ${a} and ${b}`, d: (a, b) => `${a} and ${b} aren't speaking. Talk to both of them and fix it before it rots.` },
];
EH.QREWARD = lv => ({
  gold: Math.round(28 * lv + 18 * Math.pow(lv, 1.35)),
  xp: Math.round(30 * lv + 20 * Math.pow(lv, 1.35)),
  res: EH.chance(0.5) ? { [EH.pick(["wood", "stone", "food", "ore"])]: Math.round(12 + lv * 6) } : null,
  item: EH.chance(0.32 + lv * 0.006),
  rep: EH.randint(6, 14),
});

/* ══ RESEARCH (Library) ═══════════════════════════════════════ */
EH.RESEARCH = [
  { id: "agri",   n: "Crop Rotation",  cost: { gold: 400, food: 100 }, d: "+25% farm output", fx: { prodFood: 0.25 } },
  { id: "steel",  n: "Steel Smelting", cost: { gold: 600, ore: 120 },  d: "+20% ore output, unlock Steel crafting", fx: { prodOre: 0.20 } },
  { id: "ledger", n: "Double Ledger",  cost: { gold: 500 },            d: "Market tax 10% → 16%", fx: { tax: 0.06 } },
  { id: "drill",  n: "Combat Drill",   cost: { gold: 800, stone: 200 }, d: "Companions +30% damage", fx: { compDmg: 0.3 } },
  { id: "lantern", n: "Deep Lanterns", cost: { gold: 350, ore: 60 },   d: "See further in the dungeon", fx: { vision: 2 } },
  { id: "herb",   n: "Herbalism",      cost: { gold: 450, food: 80 },  d: "Potions heal 40% more", fx: { potHeal: 0.4 } },
  { id: "bank",   n: "Hold Bank",      cost: { gold: 1200 },           d: "+10% gold from all sources", fx: { goldMul: 0.1 } },
  { id: "beast",  n: "Beast Bond",     cost: { gold: 900, food: 200 }, d: "Pets +40% damage, +1 pet slot", fx: { petDmg: 0.4, petSlot: 1 } },
];

/* ══ MISC BALANCE ═════════════════════════════════════════════ */
EH.CFG = {
  TW: 32, TH: 16,               // iso tile size
  VW: 480, VH: 270,             // internal render resolution
  MIN_PER_DAY: 1440,
  REAL_SEC_PER_DAY: 720,        // 12 real minutes = 1 in-game day
  WAGE_PER_DAY: 6,              // gold per NPC per day
  TAX: 0.10,
  BASE_CAP: 600,                // resource storage
  OFFLINE_CAP_H: 8,
  OFFLINE_EFF: 0.6,
  PLAYER_SPD: 3.1,              // tiles/sec
  NPC_SPD: 1.6,
  MON_SPD_MUL: 1,
  RESPAWN_TOWN: 6,
  SAVE_KEY: "save",
  AUTOSAVE: 25,                 // real seconds
  MAP_TOWN: 46,

  /* ── PRD v0.3 §5.1/§6 tuning ─────────────────────────────── */
  MATCH_BONUS: 1.25,            // §5.1 job suits the building — never required, only better
  ADV_WORK_MUL: 0.65,           // §6.5 / D14: adventurers work at home, but slower
  LEISURE_TRAIN: 0.55,          // §6.2 vacation buildings are the second training path
  IDLE_TRAIN: 0.12,             // doing nothing still teaches a little
  STAT_CAP: 40,                 // hard ceiling so growth can never run away
  ADJ_CAP: 1.85,                // §5.2 total decoration multiplier ceiling
  COMBO_CAP: 2.20,              // §5.3 total combo multiplier ceiling
  MAP_DUNG: 34,
};
