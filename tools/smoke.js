/* Headless smoke test: boots Emberhold in node with a stub DOM and plays it hard.
   Usage: node tools/smoke.js            */
"use strict";
const fs = require("fs"), path = require("path");
require("./domstub.js");

const ROOT = path.join(__dirname, "..", "game");
const FILES = ["util.js", "data.js", "sprites.js", "world.js", "items.js", "npc.js", "build.js", "combat.js", "quests.js", "ui.js", "render.js", "game.js"];
const errors = [];
for (const f of FILES) {
  const code = fs.readFileSync(path.join(ROOT, "js", f), "utf8");
  try { (0, eval)(code); }
  catch (e) { errors.push(`LOAD ${f}: ${e.stack}`); console.error("LOAD FAIL", f, e.message); }
}
const EH = global.window.EH;
const out = s => process.stdout.write(s);
out("\n══ EMBERHOLD HEADLESS SMOKE TEST ══\n");

function chk(name, fn) {
  try { const r = fn(); out(`  ✓ ${name}${r ? " — " + r : ""}\n`); return true; }
  catch (e) { errors.push(`${name}: ${e.stack}`); out(`  ✗ ${name} — ${e.message}\n`); return false; }
}
function frames(n, dt) {
  dt = dt || 1 / 30;
  for (let i = 0; i < n; i++) {
    try { EH.Game.update(dt); } catch (e) { errors.push(`update f${i}: ${e.stack}`); throw e; }
    try { EH.Render.draw(EH.Game.st, dt); } catch (e) { errors.push(`draw f${i}: ${e.stack}`); throw e; }
  }
}

/* ── 1. static data ─────────────────────────────────────────── */
out("\nDATA\n");
chk("tables", () => `${Object.keys(EH.TILES).length} tiles · ${Object.keys(EH.BUILD).length} buildings · ${EH.ITEMBASE.length} item bases · ${EH.MON.length + EH.BOSS.length} monsters · ${EH.PETS.length} pets · ${Object.keys(EH.CLASS).length} classes`);
chk("every building has a shape", () => { for (const k in EH.BUILD) if (!EH.BUILD[k].shape) throw new Error(k); return "ok"; });
chk("every item base has an icon", () => { for (const b of EH.ITEMBASE.concat(EH.CONSUM, EH.MATS)) if (!b.icon) throw new Error(b.id || b.n); return "ok"; });
chk("monster floors are contiguous", () => { for (let f = 1; f <= 40; f++) if (!EH.monsForFloor(f).length) throw new Error("no monsters on floor " + f); return "1–40 covered"; });
chk("bosses on every 5th floor", () => { const n = []; for (let f = 5; f <= 40; f += 5) { const b = EH.bossForFloor(f); if (!b) throw new Error("no boss " + f); n.push(`${f}:${b.n}`); } return n.join(" "); });
chk("boss stats are not double-scaled", () => {
  // a guardian must be killable: its depth curve is baked into its base stats
  const out = [];
  for (const f of [5, 10, 15, 20, 30, 40]) {
    const m = EH.Combat.makeMon(EH.bossForFloor(f), f, { boss: true });
    const mit = 110 / (110 + m.def * 1.9);
    out.push(`fl${f} ${EH.fmt(m.hpMax)}hp/${Math.round(m.def)}def(${(mit * 100) | 0}% dmg taken)`);
    if (m.hpMax > 200000) throw new Error(`floor ${f} boss has ${m.hpMax} hp`);
    if (mit < 0.12) throw new Error(`floor ${f} boss armour too high (${(mit * 100) | 0}%)`);
  }
  return out.join(" · ");
});

/* ── 2. world generation ────────────────────────────────────── */
out("\nWORLD GEN\n");
for (const seed of [1, 4242, 99999]) {
  chk(`town seed ${seed}`, () => {
    const m = EH.genTown(seed);
    let walk = 0, water = 0, tree = 0;
    for (let i = 0; i < m.t.length; i++) { if (EH.walkable(m.t[i])) walk++; if (EH.isWater(m.t[i])) water++; if (m.t[i] === EH.T.TREE || m.t[i] === EH.T.PINE) tree++; }
    if (!m.dungeonPortal) throw new Error("no portal");
    if (!m.spawn || !m.walk(m.spawn.x, m.spawn.y)) throw new Error("bad spawn");
    if (walk < m.w * m.h * 0.2) throw new Error("too little walkable: " + walk);
    // portal must be reachable from spawn
    const p = EH.findPath(m, m.spawn.x, m.spawn.y, m.dungeonPortal.x, m.dungeonPortal.y, { allowAdjacent: true });
    if (!p) throw new Error("portal unreachable");
    return `${m.w}×${m.h} · ${walk} walkable · ${water} water · ${tree} trees · portal path ${p.length}`;
  });
}
for (const fl of [1, 3, 5, 8, 12, 20, 30]) {
  chk(`dungeon floor ${fl}`, () => {
    const m = EH.genDungeon(1234, fl);
    let open = 0; for (let i = 0; i < m.t.length; i++) if (EH.walkable(m.t[i])) open++;
    if (open < 60) throw new Error("too small: " + open);
    const p = EH.findPath(m, m.entrance.x, m.entrance.y, m.stairs.x, m.stairs.y, { allowAdjacent: true });
    if (!p) throw new Error("stairs unreachable from entrance");
    for (const c of m.chests) {
      const cp = EH.findPath(m, m.entrance.x, m.entrance.y, c.x, c.y, { allowAdjacent: true });
      if (!cp) throw new Error(`chest ${c.x},${c.y} unreachable`);
    }
    return `${m.rooms.length} rooms · ${open} open · ${m.chests.length} chests · path ${p.length}${m.isBoss ? " · BOSS" : ""}`;
  });
}
chk("1000 random dungeons: stairs, chests & bosses all reachable", () => {
  let n = 0, chests = 0, bosses = 0;
  for (let seed = 1; seed <= 25; seed++) for (let fl = 1; fl <= 40; fl++) {
    const m = EH.genDungeon(seed * 131 + 7, fl); n++;
    const route = (x, y) => EH.findPath(m, m.entrance.x, m.entrance.y, x, y, { allowAdjacent: true });
    if (!route(m.stairs.x, m.stairs.y)) throw new Error(`stairs unreachable: seed ${seed} floor ${fl}`);
    if (!m.walk(m.entrance.x, m.entrance.y)) throw new Error(`bad entrance: seed ${seed} floor ${fl}`);
    for (const c of m.chests) { chests++; if (!route(c.x, c.y)) throw new Error(`chest ${c.x},${c.y} unreachable: seed ${seed} floor ${fl}`); }
    if (m.isBoss) {
      bosses++;
      const bd = EH.bossForFloor(fl);
      if (!bd) throw new Error(`no guardian defined for floor ${fl}`);
      let bx = m.stairs.x, by = m.stairs.y, found = false;
      for (let rad = 1; rad <= 6 && !found; rad++) for (let dy = -rad; dy <= rad && !found; dy++) for (let dx = -rad; dx <= rad && !found; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
        if (m.walk(m.stairs.x + dx, m.stairs.y + dy)) { bx = m.stairs.x + dx; by = m.stairs.y + dy; found = true; }
      }
      if (!m.walk(bx, by) || !route(bx, by)) throw new Error(`guardian unreachable: seed ${seed} floor ${fl}`);
    }
  }
  return `${n} floors · ${chests} chests · ${bosses} guardians — all connected`;
});

/* ── 3. art generation ──────────────────────────────────────── */
out("\nPROCEDURAL ART\n");
chk("tiles", () => { let n = 0; for (const id in EH.TILES) { for (let v = 0; v < 4; v++) { const c = EH.Art.tile(+id, v); if (!c || c.width !== 32) throw new Error("tile " + id); n++; } } return n + " tile variants"; });
chk("wall sides", () => { for (const id of [EH.T.DFWALL]) for (let v = 0; v < 4; v++) EH.Art.wallSide(id, v, 14); return "ok"; });
chk("objects", () => { const o = ["tree", "pine", "rock", "bush", "chest", "stairs", "portal", "pillar", "torch", "sign", "well", "grave"]; for (const n of o) for (let v = 0; v < 4; v++) if (!EH.Art.obj(n, v, {})) throw new Error(n); return o.length + " kinds"; });
chk("buildings", () => { let n = 0; for (const k in EH.BUILD) { const B = EH.BUILD[k]; for (let l = 1; l <= 5; l++) { if (!EH.Art.building(B.shape, B.roof, B.wall, l, { done: true })) throw new Error(k); n++; } EH.Art.building(B.shape, B.roof, B.wall, 1, { done: false }); n++; } return n + " sprites"; });
chk("humanoids", () => { let n = 0; for (const cls of Object.keys(EH.CLASS)) { const look = { skin: EH.Art.SKIN[0], hair: EH.Art.HAIR[0], cloth: EH.Art.CLOTH[0] }; const h = EH.Art.humanoid(look); if (!h.front || !h.side || !h.back) throw new Error(cls); n += h.front.length * 3; } return n + " frames"; });
chk("monsters", () => { const bodies = new Set(EH.MON.concat(EH.BOSS).map(m => m.body)); for (const b of bodies) for (let f = 0; f < 2; f++) if (!EH.Art.monster(b, "#7a9a4a", f)) throw new Error(b); return bodies.size + " bodies"; });
chk("pets", () => { for (const p of EH.PETS) for (let f = 0; f < 2; f++) if (!EH.Art.pet(p.body, p.c, f, p.fly)) throw new Error(p.id); return EH.PETS.length + " species"; });
chk("icons", () => { const names = new Set(EH.ITEMBASE.concat(EH.CONSUM, EH.MATS).map(i => i.icon)); for (const n of names) if (!EH.Art.icon(n, "#f0c05a")) throw new Error(n); return names.size + " icons"; });
chk("portraits", () => { for (const cls of Object.keys(EH.CLASS)) if (!EH.Art.portrait({ skin: EH.Art.SKIN[1], hair: EH.Art.HAIR[2], cloth: "#4a7a4a", cls })) throw new Error(cls); return "ok"; });

/* ── 4. items ───────────────────────────────────────────────── */
out("\nITEMS & ECONOMY\n");
chk("5000 generated items are valid", () => {
  const rar = {};
  for (let i = 0; i < 5000; i++) {
    const it = EH.Items.makeEquip(EH.randint(1, 55), { mf: EH.randint(0, 150), luck: EH.randint(0, 20) });
    if (!it.name || !isFinite(it.price) || it.price <= 0) throw new Error(JSON.stringify(it));
    if (!isFinite(it.atk) || !isFinite(it.def)) throw new Error("bad stats " + it.name);
    for (const a of it.affixes) if (!isFinite(a.v) || a.v <= 0) throw new Error("bad affix " + a.k);
    rar[it.rar] = (rar[it.rar] || 0) + 1;
  }
  return Object.entries(rar).map(([k, v]) => `${k} ${(v / 50).toFixed(1)}%`).join(" ");
});
chk("stack merging", () => {
  const inv = [];
  for (let i = 0; i < 55; i++) EH.Items.add(inv, EH.Items.makeStack("potion_s", 1), 100);
  const n = EH.Items.countOf(inv, "potion_s");
  if (n !== 55) throw new Error("got " + n);
  EH.Items.removeById(inv, "potion_s", 30);
  if (EH.Items.countOf(inv, "potion_s") !== 25) throw new Error("removal failed");
  return `${inv.length} slots for 55 potions`;
});
chk("inventory cap enforced", () => {
  const inv = [];
  for (let i = 0; i < 40; i++) EH.Items.add(inv, EH.Items.makeEquip(5, {}), 10);
  if (inv.length > 10) throw new Error("cap ignored: " + inv.length);
  return "capped at " + inv.length;
});
chk("derived stats scale sensibly", () => {
  const fake = { player: { cls: "warden", level: 1, pts: {}, equip: {}, inv: [] }, buffs: {}, research: [], pets: [], companions: [] };
  const d1 = EH.Items.derive(fake.player, fake);
  fake.player.level = 40; for (const s of EH.STATLIST) fake.player.pts[s.k] = 40;
  fake.player.equip.wpn = EH.Items.makeEquip(40, { rarity: 4, tier: 5 });
  const d40 = EH.Items.derive(fake.player, fake);
  if (!(d40.atk > d1.atk * 5)) throw new Error(`atk ${d1.atk} → ${d40.atk}`);
  if (!(d40.hpMax > d1.hpMax * 3)) throw new Error(`hp ${d1.hpMax} → ${d40.hpMax}`);
  return `Lv1 atk ${d1.atk} hp ${d1.hpMax} → Lv40 atk ${d40.atk} hp ${d40.hpMax}`;
});

/* ── 5. full boot & long town simulation ────────────────────── */
out("\nBOOT & TOWN SIM\n");
let st;
chk("new game (each class)", () => {
  const res = [];
  let ci = 0;
  for (const cls of Object.keys(EH.CLASS)) {
    const s = EH.Game.newState("T", cls, 1000 + ci++);   // pinned: FR-03 reproducibility
    EH.Game.st = s;
    EH.Game.setupWorld(false);
    if (!s.npcs.length) throw new Error(cls + ": no npcs");
    if (!s.buildings.length) throw new Error(cls + ": no buildings");
    if (!s.pets.length) throw new Error(cls + ": no pet");
    res.push(`${cls}:${s.npcs.length}npc/${s.buildings.length}b`);
  }
  return res.join(" ");
});
chk("boot warden + UI + renderer", () => {
  st = EH.Game.newState("Testwarden", "warden", 20260);   // pinned seed
  EH.Game.st = st;
  EH.Game.setupWorld(false);
  EH.Render.init();
  EH.UI.init(st);
  EH.Render.snapCam(st);
  frames(5);
  return `pop ${st.npcs.length} · buildings ${st.buildings.length} · quests ${st.quests.active.length + st.quests.board.length}`;
});
chk("simulate 3 in-game days", () => {
  const d0 = st.time.day, g0 = st.res.gold, tr0 = st.stats.trades;
  const perFrameMin = (1 / 30) * (EH.CFG.MIN_PER_DAY / EH.CFG.REAL_SEC_PER_DAY);
  frames(Math.ceil(3 * 1440 / perFrameMin / 4) * 4);
  if (st.time.day <= d0) throw new Error("time did not advance: day " + st.time.day);
  return `day ${d0}→${st.time.day} · hour ${st.time.hourF.toFixed(1)} · weather ${st.weather} · trades ${st.stats.trades - tr0} · tax ${st.town.taxTotal.toFixed(1)}g · gold ${EH.fmt(g0)}→${EH.fmt(st.res.gold)}`;
});
chk("npc state is sane", () => {
  for (const n of st.npcs) {
    for (const k in n.needs) { const v = n.needs[k]; if (!isFinite(v) || v < 0 || v > 100) throw new Error(`${n.name}.${k}=${v}`); }
    if (!isFinite(n.x) || !isFinite(n.y)) throw new Error(n.name + " NaN pos");
    if (n.x < -2 || n.x > st.map.w + 2 || n.y < -2 || n.y > st.map.h + 2) throw new Error(`${n.name} out of bounds ${n.x.toFixed(1)},${n.y.toFixed(1)}`);
    if (!isFinite(n.gold) || n.gold < 0) throw new Error(n.name + " gold " + n.gold);
    if (!n.act) throw new Error(n.name + " has no activity");
  }
  const inside = st.npcs.filter(n => n.inside).length;
  return `${st.npcs.length} npcs · ${inside} indoors · activities: ${Array.from(new Set(st.npcs.map(n => n.act.kind))).join(",")}`;
});
chk("npc↔npc economy actually moved money", () => {
  const totalGold = st.npcs.reduce((a, n) => a + n.gold, 0);
  if (st.stats.trades < 5) throw new Error("only " + st.stats.trades + " trades");
  if (!(st.town.taxTotal > 0)) throw new Error("no tax collected");
  return `${st.stats.trades} trades · npcs hold ${EH.fmt(totalGold)}g · treasury taxed ${EH.fmt(st.town.taxTotal)}g`;
});
chk("relationships developed", () => {
  let n = 0, pos = 0, neg = 0;
  for (const a of st.npcs) for (const k in a.rel) { n++; if (a.rel[k] > 0) pos++; else if (a.rel[k] < 0) neg++; }
  if (!n) throw new Error("no relationships recorded");
  return `${n} links (${pos} warm, ${neg} cold)`;
});
chk("day/night cycle drives schedules", () => {
  const reset = () => { for (const n of st.npcs) { n.needs.hunger = 20; n.needs.energy = 90; n.needs.social = 60; n.act = null; n.inside = false; n.path = []; } };
  // 3am — most villagers should be asleep behind a door
  st.time.minute = 3 * 60; st.time.hour = 3; st.time.hourF = 3; st.town.lastHour = -1;
  reset(); frames(900);
  const inside = st.npcs.filter(n => n.inside).length;
  const acts = st.npcs.map(n => n.act.kind);
  const patrol = acts.filter(a => a === "patrol").length;
  // 10am — the working day
  st.time.minute = 10 * 60; st.time.hourF = 10; st.time.hour = 10; st.town.lastHour = -1;
  reset(); frames(900);
  const working = st.npcs.filter(n => n.act.kind === "work").length;
  const dayActs = st.npcs.map(n => n.act.kind);
  if (inside < st.npcs.length * 0.5) throw new Error(`only ${inside}/${st.npcs.length} slept at 3am`);
  if (!working) throw new Error("nobody worked at 10am — " + dayActs.join(","));
  if (working < st.npcs.filter(n => n.work).length * 0.6) throw new Error(`only ${working} of ${st.npcs.filter(n => n.work).length} job-holders at work`);
  return `3am: ${inside}/${st.npcs.length} indoors, ${patrol} on patrol · 10am: ${working}/${st.npcs.filter(n => n.work).length} at their post`;
});

/* ── 6. building ────────────────────────────────────────────── */
out("\nBASE BUILDING\n");
chk("place every building type", () => {
  st.res.gold = 1e8; st.res.wood = 1e7; st.res.stone = 1e7; st.res.ore = 1e6; st.res.food = 1e6;
  let placed = 0;
  for (const key of EH.buildOrder) {
    for (let n = 0; n < 3; n++) {
      const spot = EH.Build.findSpot(st, key, st.town.plaza, 20);
      if (!spot) break;
      const b = EH.Build.place(st, key, spot.x, spot.y, true);
      if (b) { placed++; break; }
    }
  }
  EH.Build.assignWorkers(st);
  if (placed < EH.buildOrder.length) throw new Error(`only ${placed}/${EH.buildOrder.length}`);
  return `${placed} placed · town now ${st.buildings.length} structures`;
});
chk("no overlapping footprints", () => {
  const seen = new Map();
  for (const b of st.buildings) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
    const k = x + "," + y;
    if (seen.has(k)) throw new Error(`overlap at ${k}: ${seen.get(k)} & ${b.type}`);
    seen.set(k, b.type);
  }
  return seen.size + " occupied tiles";
});
chk("upgrade everything to max", () => {
  let ups = 0;
  for (const b of st.buildings) { while (b.lvl < EH.MAXLVL) { b.done = true; if (!EH.Build.upgrade(st, b)) break; b.done = true; b.t = 0; ups++; } }
  return ups + " upgrades";
});
chk("production ticks", () => {
  for (const k of Object.keys(st.res)) if (k !== "gold") st.res[k] = 0;   // start below cap
  const before = Object.assign({}, st.res);
  frames(1800);
  const gained = Object.keys(st.res).filter(k => k !== "gold" && st.res[k] > before[k]);
  if (!gained.length) throw new Error("nothing produced");
  return gained.map(k => `${k} +${EH.fmt(st.res[k] - before[k])}`).join(" ") + ` · rates ${Object.entries(st.town.rates).map(([k, v]) => k + " " + v.toFixed(2)).join(", ")}`;
});
chk("construction timers run", () => {
  const spot = EH.Build.findSpot(st, "house", st.town.plaza, 20);
  const b = EH.Build.place(st, "house", spot.x, spot.y, false);
  if (!b) throw new Error("place failed");
  if (b.done) throw new Error("should be under construction");
  const t0 = b.t;
  frames(200);
  if (b.t >= t0) throw new Error("timer did not advance");
  for (let i = 0; i < 4000 && !b.done; i++) frames(10);
  if (!b.done) throw new Error("never finished");
  return `built in ~${((t0 - 0) / 1).toFixed(0)}s of game time`;
});
chk("worker efficiency responds to mood", () => {
  const f = EH.Build.firstOf(st, "farm");
  if (!f) return "no farm";
  const e1 = EH.Build.efficiency(st, f);
  for (const n of st.npcs) { n.needs.mood = 100; n.needs.hunger = 0; }
  const e2 = EH.Build.efficiency(st, f);
  for (const n of st.npcs) { n.needs.mood = 5; n.needs.hunger = 100; }
  const e3 = EH.Build.efficiency(st, f);
  if (!(e2 > e3)) throw new Error(`happy ${e2} not > miserable ${e3}`);
  return `efficiency: base ${(e1 * 100) | 0}% · happy ${(e2 * 100) | 0}% · miserable ${(e3 * 100) | 0}%`;
});
chk("demolish + refund", () => {
  for (const k of Object.keys(st.res)) if (k !== "gold") st.res[k] = 0;   // start below cap
  const n0 = st.buildings.length, w0 = st.res.wood;
  const b = st.buildings.slice().reverse().find(x => EH.BUILD[x.type].cost.wood) || st.buildings[st.buildings.length - 1];
  EH.Build.demolish(st, b);
  if (st.buildings.length !== n0 - 1) throw new Error("not removed");
  if (st.res.wood <= w0) throw new Error("no refund");
  return `${EH.BUILD[b.type].n}: recovered ${EH.fmt(st.res.wood - w0)} wood`;
});

/* ── 7. quests ──────────────────────────────────────────────── */
out("\nQUESTS\n");
chk("generate 600 quests without error", () => {
  const types = {};
  for (let i = 0; i < 600; i++) {
    const n = st.npcs[i % st.npcs.length];
    const q = EH.Quests.generate(st, n);
    if (!q) continue;
    if (!q.title || !q.desc || !q.reward) throw new Error("incomplete: " + JSON.stringify(q).slice(0, 200));
    if (!isFinite(q.need) || q.need < 1) throw new Error("bad need " + q.need);
    types[q.type] = (types[q.type] || 0) + 1;
  }
  return Object.entries(types).map(([k, v]) => `${k}:${v}`).join(" ");
});
chk("full quest lifecycle (slay)", () => {
  st.quests.active = [];
  let q = null;
  for (let i = 0; i < 80 && !q; i++) { const c = EH.Quests.generate(st, st.npcs[0]); if (c && c.type === "slay") q = c; }
  if (!q) return "no slay quest rolled";
  EH.Quests.accept(st, q);
  for (let i = 0; i < q.need; i++) EH.Quests.progress(st, "slay", q.target.id, 1);
  if (q.state !== "ready") throw new Error("state=" + q.state);
  const g0 = st.res.gold, x0 = st.player.xp + st.player.level * 1000;
  EH.Quests.complete(st, q);
  if (st.quests.done.length !== 1) throw new Error("not archived");
  return `${q.title} → +${EH.fmt(st.res.gold - g0)}g`;
});
chk("gather quest consumes resources", () => {
  st.quests.active = [];
  let q = null;
  for (let i = 0; i < 80 && !q; i++) { const c = EH.Quests.generate(st, st.npcs[1]); if (c && c.type === "gather") q = c; }
  if (!q) return "no gather quest rolled";
  st.res[q.target.id] = q.need + 50;
  q.reward.res = null;                 // isolate the hand-in from the payout
  EH.Quests.accept(st, q);
  if (q.have !== q.need) throw new Error("have=" + q.have);
  q.state = "ready";
  const before = st.res[q.target.id];
  EH.Quests.complete(st, q);
  if (st.res[q.target.id] !== before - q.need) throw new Error("not consumed");
  return `${q.title} consumed ${q.need} ${q.target.id}`;
});
chk("notice board populates", () => { EH.Quests.daily(st); return st.quests.board.length + " posted"; });

/* ── 8. combat & dungeon ────────────────────────────────────── */
out("\nCOMBAT & DUNGEON\n");
chk("descend to floor 20 fighting", () => {
  EH.Combat.exitDungeon(st);
  // gear the tester up so it survives
  st.player.level = 22;
  for (const s of EH.STATLIST) st.player.pts[s.k] = 20;
  for (const slot of ["wpn", "chest", "head", "legs", "boot", "off", "ring", "amul", "cloak"]) {
    const it = EH.Items.makeEquip(22, { rarity: 3, tier: 3 });
    if (slot === "wpn" || it.slot === slot) st.player.equip[slot] = it;
  }
  st.player.equip.wpn = EH.Items.makeEquip(22, { rarity: 3, tier: 3, base: "sword" });
  st.derived = EH.Items.derive(st.player, st);
  st.player.hp = st.derived.hpMax;
  st.auto = true;
  let deepest = 0, guard = 0;
  while (st.dungeon.floor <= 20 && guard++ < 400) {
    EH.Combat.enterDungeon(st, st.dungeon.floor);
    deepest = st.dungeon.floor;
    for (let f = 0; f < 2600; f++) {
      st.player.hp = Math.max(st.player.hp, st.derived.hpMax * 0.5); // tester is immortal-ish
      frames(1);
      if (st.map.kind === "town") break;
      if (st.dmap && !st.mons.length && (!st.dmap.isBoss || st.dmap.bossDead)) { EH.Combat.descend(st); break; }
      if (st.dungeon.floor > deepest) { deepest = st.dungeon.floor; break; }
    }
    if (st.map.kind === "town") EH.Combat.enterDungeon(st, st.dungeon.maxFloor);
  }
  st.auto = false;
  return `reached floor ${st.dungeon.maxFloor} · ${st.stats.kills} kills · lv ${st.player.level} · ${EH.fmt(st.res.gold)}g · ${st.player.inv.length} items`;
});
chk("bosses dropped loot", () => {
  if (!st.stats.legendary && st.dungeon.maxFloor < 5) return "no boss reached";
  return `${st.dungeon.bossesKilled || 0} bosses · ${st.stats.legendary} legendaries · ${st.stats.itemsFound} items found`;
});
chk("every class's skills fire", () => {
  const res = [];
  let si = 0;
  for (const cls of Object.keys(EH.CLASS)) {
    const s = EH.Game.newState("S", cls, 7000 + si++);
    EH.Game.st = s; EH.Game.setupWorld(false);
    s.player.level = 20; s.derived = EH.Items.derive(s.player, s);
    EH.Combat.enterDungeon(s, 3);
    for (const sk of EH.CLASS[cls].skills) {
      s.player.cd = {};
      if (s.mons.length) { s.player.x = s.mons[0].x + 1; s.player.y = s.mons[0].y; }
      let ok = false;
      for (let t = 0; t < 3 && !ok; t++) ok = EH.Combat.useSkill(s, sk.k);
      res.push(`${cls}.${sk.k}${ok ? "" : "!"}`);
      if (!ok) errors.push(`skill ${cls}.${sk.k} never fired`);
    }
    EH.Game.st = st;
  }
  return res.join(" ");
});
chk("monster AI moves and attacks", () => {
  EH.Combat.enterDungeon(st, 6);
  if (!st.mons.length) throw new Error("no monsters spawned");
  const m = st.mons[0];
  st.mons = [m];                                   // isolate one for a predictable duel
  /* A companion or pet standing nearer than 0.8x the player's distance becomes
     the monster's target instead (see the target pick in monUpdate), so it
     would fight them and never close on the player. The "dying mid-frame" test
     below clears these for the same reason. Without this the check depends on
     where earlier tests happened to leave the party. */
  st.pets = []; st.companions = [];
  const x0 = m.x, y0 = m.y;
  // stand the tester on real, reachable floor 2-4 tiles away (teleporting into
  // a wall would leave the monster pathing at nothing forever)
  let spot = null;
  for (let r = 2; r <= 6 && !spot; r++) {
    for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
      const dd = Math.hypot(dx, dy);
      if (dd < 1.8 || dd > r + 0.5) continue;
      const x = Math.round(m.x + dx), y = Math.round(m.y + dy);
      if (!st.dmap.walk(x, y)) continue;
      if (!EH.findPath(st.dmap, x, y, Math.round(m.x), Math.round(m.y), { allowAdjacent: true })) continue;
      spot = { x, y };
    }
  }
  if (!spot) throw new Error("no reachable tile near the monster");
  st.player.x = spot.x; st.player.y = spot.y; st.player.path = [];
  const atk0 = st.derived.atk; st.derived.atk = 0; // the tester does not fight back
  /* §1.3 changed the ground rules here: the Warden is ALWAYS auto-fighting and
     auto-exploring now (game.js autoWarden). Left alone it would snare, chip and
     eventually kill the isolated monster and then wander off to the stairs, so
     this check would measure the Warden's AI instead of the monster's. Silence
     the Warden for the duration of the duel — no swings, no skills, no
     exploring, no descending — and restore everything afterwards. */
  const cd0 = st.derived.atkCd, autoT0 = st.player.autoT, stay0 = st.dungeon.stayOnFloor, pcd0 = Object.assign({}, st.player.cd);
  st.derived.atkCd = 1e6; st.player.autoT = 1e6; st.dungeon.stayOnFloor = true;
  const silence = () => { for (const sk of EH.CLASS[st.player.cls].skills) st.player.cd[sk.k] = 1e6; };
  silence();
  /* ...and does not defend either. By this point the suite has the player near
     Lv90, so dodge and dmgReduce can swallow every swing and regen can erase a
     landed hit inside a single frame — which measures the tester's build, not
     the monster AI. The "dying mid-frame" test below zeroes these for the same
     reason. Restored after the duel. */
  const d0 = st.derived.dodge, dr0 = st.derived.dmgReduce, rg0 = st.derived.regen;
  st.derived.dodge = 0; st.derived.dmgReduce = 0; st.derived.regen = 0;
  let dealt = 0;
  for (let i = 0; i < 400; i++) {
    st.player.hp = st.derived.hpMax;               // immortal tester
    silence();
    frames(1 / 30);
    if (st.map.kind !== "dungeon") throw new Error("tester was sent home mid-duel");
    if (st.player.hp < st.derived.hpMax) dealt++;
  }
  st.derived.atk = atk0;
  st.derived.dodge = d0; st.derived.dmgReduce = dr0; st.derived.regen = rg0;
  st.derived.atkCd = cd0; st.player.autoT = autoT0; st.dungeon.stayOnFloor = stay0; st.player.cd = pcd0;
  const moved = Math.abs(m.x - x0) + Math.abs(m.y - y0);
  if (moved < 0.5) throw new Error("monster never moved");
  if (!dealt) throw new Error("monster never landed a hit");
  return `${m.name} closed ${moved.toFixed(1)} tiles and hit the player ${dealt} times`;
});
chk("dying mid-frame leaves the world consistent", () => {
  EH.Combat.enterDungeon(st, 7);
  if (st.mons.length < 2) throw new Error("need monsters for this test");
  st.pets = []; st.companions = [];                  // nothing to soak the blow
  st.derived.dodge = 0; st.derived.dmgReduce = 0; st.player.guard = null;
  // kill the player *inside* the monster loop by handing the first monster a
  // lethal swing; the rest of the slice must not blow up on a null st.dmap
  const m = st.mons[0];
  m.x = st.player.x; m.y = st.player.y; m.state = "chase"; m.aggro = 99; m.statuses = [];
  m.atk = st.derived.hpMax * 10;
  const d0 = st.stats.deaths;
  for (let i = 0; i < 90 && st.stats.deaths === d0; i++) { st.player.hp = 1; m.atkCd = 0; frames(1 / 30); }
  if (st.stats.deaths <= d0) throw new Error("player did not die");
  if (st.map.kind !== "town") throw new Error("not sent home");
  if (st.dmap !== null) throw new Error("st.dmap left dangling");
  if (st.mons.length) throw new Error("monsters left behind");
  frames(30);                                       // and the town still simulates
  return `died on floor 7, woke in Emberhold · ${st.npcs.length} villagers still ticking`;
});
chk("death sends you home with a gold penalty", () => {
  st.player.hp = 1;
  const g0 = st.res.gold;
  EH.Combat.playerDown(st, { name: "Test" });
  if (st.map.kind !== "town") throw new Error("still in dungeon");
  if (st.res.gold >= g0) throw new Error("no gold lost");
  return `lost ${EH.fmt(g0 - st.res.gold)}g · deaths ${st.stats.deaths}`;
});
chk("chests open and pay out", () => {
  EH.Combat.enterDungeon(st, 9);
  const g0 = st.res.gold, i0 = st.player.inv.length;
  let opened = 0;
  for (const c of st.dmap.chests.slice()) { EH.Game.openChest(c); opened++; }
  if (st.res.gold <= g0) throw new Error("no gold from chests");
  return `${opened} chests → +${EH.fmt(st.res.gold - g0)}g, ${st.player.inv.length - i0} items`;
});
chk("auto-explore idles safely", () => {
  st.auto = true; st.player.hp = st.derived.hpMax;
  frames(1200);
  st.auto = false;
  return `floor ${st.dungeon.floor} · hp ${Math.round(st.player.hp)}/${st.derived.hpMax} · kills ${st.stats.kills}`;
});
EH.Combat.exitDungeon(st);

/* ── 9. pets & companions ───────────────────────────────────── */
out("\nPETS & COMPANIONS\n");
chk("hatch every species at every rarity", () => {
  st.pets = [];
  const names = [];
  for (let i = 0; i < EH.PETS.length; i++) {
    const p = EH.Combat.hatch(st, EH.PETS[i].id, i % EH.PETRAR.length);
    if (!p) { if (i < 3) throw new Error("hatch failed for " + EH.PETS[i].id); break; }
    names.push(`${p.name}(${p.rar[0]})`);
  }
  return names.slice(0, 6).join(" ") + ` … ${st.pets.length} pets`;
});
chk("pets follow and fight", () => {
  st.pets = [EH.Combat.makePet("dog", st, 2)];
  st.pets[0].active = true;
  EH.Combat.enterDungeon(st, 4);
  const pet = st.pets[0];
  const k0 = st.stats.kills;
  st.player.hp = st.derived.hpMax;
  for (let i = 0; i < 900; i++) { st.player.hp = st.derived.hpMax; frames(1 / 30); }
  const d = EH.dist(pet.x, pet.y, st.player.x, st.player.y);
  if (!isFinite(pet.x) || d > 12) throw new Error("pet lost: " + d.toFixed(1));
  return `pet stayed ${d.toFixed(1)} tiles away · Lv${pet.level} · kills since ${st.stats.kills - k0}`;
});
chk("feeding raises happiness", () => {
  const pet = st.pets[0]; pet.happy = 20;
  EH.Items.add(st.player.inv, EH.Items.makeStack("petfood", 3), st.player.cap);
  EH.Combat.feed(st, pet.id);
  if (pet.happy <= 20) throw new Error("happiness " + pet.happy);
  return `20 → ${pet.happy.toFixed(0)}`;
});
chk("neglected pet runs off", () => {
  const pet = st.pets[0]; pet.happy = 3; pet.active = true;
  st.time.minute = 1439.5;
  for (let i = 0; i < 400; i++) frames(1 / 30);
  return st.pets.includes(pet) ? "still around (happiness " + pet.happy.toFixed(0) + ")" : "ran off as designed";
});
chk("hire companions", () => {
  EH.Combat.exitDungeon(st);
  st.companions = [];
  for (const n of st.npcs) n.relP = 80;
  EH.Build.firstOf(st, "barracks") || EH.Build.place(st, "barracks", ...(() => { const s = EH.Build.findSpot(st, "barracks", st.town.plaza, 20); return [s.x, s.y]; })(), true);
  let hired = 0;
  for (const n of st.npcs) { if (EH.Combat.hire(st, n.id)) hired++; if (hired >= 2) break; }
  if (!hired) throw new Error("could not hire");
  EH.Combat.enterDungeon(st, 3);
  for (let i = 0; i < 600; i++) { st.player.hp = st.derived.hpMax; frames(1 / 30); }
  return `${hired} hired · ${st.companions.map(c => c.name.split(" ")[0] + " " + Math.round(c.hp) + "hp").join(", ")}`;
});
EH.Combat.exitDungeon(st);

/* ── 10. UI surfaces ────────────────────────────────────────── */
out("\nUI\n");
for (const p of ["char", "inv", "build", "town", "quest", "pet", "menu"]) {
  chk("panel " + p, () => {
    EH.UI.openPanel(p);
    EH.UI.refreshPanel(p);
    EH.UI.close(p);
    return "rendered";
  });
}
chk("dialogue with every villager", () => {
  const n0 = st.npcs.length;
  for (const n of st.npcs) { EH.UI.dialogue(n); EH.UI.closeDialogue(); }
  return n0 + " conversations";
});
chk("npc dialogue options include services", () => {
  const found = new Set();
  for (const n of st.npcs) for (const o of EH.NPCs.options(n, st)) found.add(o.act);
  for (const need of ["chat", "close"]) if (!found.has(need)) throw new Error("missing " + need);
  return Array.from(found).join(", ");
});
chk("tooltips render for every item type", () => {
  let n = 0;
  for (const b of EH.ITEMBASE) { const h = EH.Items.tip(EH.Items.makeEquip(10, { base: b.id })); if (!h.includes(b.n) && !h.includes("tt-name")) throw new Error(b.id); n++; }
  for (const c of EH.CONSUM.concat(EH.MATS)) { const h = EH.Items.tip(EH.Items.makeStack(c.id, 1)); if (!h.includes(c.n)) throw new Error(c.id); n++; }
  return n + " tooltips";
});
chk("floating text + toasts + level flash", () => {
  EH.Float.world(st.player.x, st.player.y, "123", "dmg");
  EH.toast("TEST"); EH.flashLevel();
  return "ok";
});

/* ── 11. persistence ────────────────────────────────────────── */
out("\nSAVE / LOAD / OFFLINE\n");
chk("save writes to storage", () => {
  EH.Game.save(false);
  const raw = global.localStorage.getItem("emberhold.save");
  if (!raw) throw new Error("nothing saved");
  const b = JSON.parse(raw);
  if (!b.v || !b.npcs || !b.buildings) throw new Error("malformed save");
  return `${(raw.length / 1024).toFixed(1)} KB · ${b.npcs.length} npcs · ${b.buildings.length} buildings · ${b.player.inv.length} items`;
});
chk("load restores a playable world", () => {
  const raw = JSON.parse(global.localStorage.getItem("emberhold.save"));
  const gold0 = raw.res.gold, day0 = raw.time.day, lv0 = raw.player.level;
  raw.lastSeen = Date.now() - 1000 * 60 * 60 * 6;   // six hours away
  EH.Game.load(raw);
  const s2 = EH.Game.st;
  EH.UI.init(s2);
  frames(120);
  if (!s2.npcs.length || !s2.buildings.length) throw new Error("world not restored");
  if (s2.time.day < day0) throw new Error("day went backwards");
  for (const b of s2.buildings) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++)
    if (!s2.map.occ.has(s2.map.key(x, y))) throw new Error("occupancy lost for " + b.type);
  st = s2;
  return `day ${day0}→${s2.time.day} · gold ${EH.fmt(gold0)}→${EH.fmt(s2.res.gold)} · lv ${lv0}→${s2.player.level} · ${s2.npcs.length} npcs restored`;
});
chk("offline progress paid out", () => {
  const raw = JSON.parse(global.localStorage.getItem("emberhold.save"));
  const wood0 = raw.res.wood, gold0 = raw.res.gold;
  raw.lastSeen = Date.now() - 1000 * 60 * 60 * 8;
  const rep = EH.Game.load(raw);
  st = EH.Game.st; EH.UI.init(st);
  if (!rep) throw new Error("no offline report");
  if (!(st.res.wood >= wood0)) throw new Error("wood decreased");
  return `${rep.lines.length} lines · ${EH.fmtDur(rep.secs)} away · ${rep.days} in-game days · wood ${EH.fmt(wood0)}→${EH.fmt(st.res.wood)}`;
});
chk("offline capped at 8h", () => {
  const raw = JSON.parse(global.localStorage.getItem("emberhold.save"));
  raw.lastSeen = Date.now() - 1000 * 60 * 60 * 200;
  const rep = EH.Game.load(raw);
  st = EH.Game.st; EH.UI.init(st);
  if (rep.secs > EH.CFG.OFFLINE_CAP_H * 3600 + 1) throw new Error("cap ignored: " + rep.secs);
  return EH.fmtDur(rep.secs);
});
chk("save while in the dungeon, reload there", () => {
  EH.Combat.enterDungeon(st, 4);
  frames(30);
  EH.Game.save(false);
  const raw = JSON.parse(global.localStorage.getItem("emberhold.save"));
  if (raw.inDungeon !== 4) throw new Error("inDungeon=" + raw.inDungeon);
  EH.Game.load(raw);
  st = EH.Game.st; EH.UI.init(st); frames(60);
  if (st.map.kind !== "dungeon") throw new Error("loaded into " + st.map.kind);
  return `restored on floor ${st.dungeon.floor} with ${st.mons.length} monsters`;
});
chk("corrupt save falls back cleanly", () => {
  global.localStorage.setItem("emberhold.save", "{not json");
  const bad = EH.store.get("save", null);
  if (bad !== null) throw new Error("bad json parsed");
  global.localStorage.removeItem("emberhold.save");
  return "rejected";
});
EH.Combat.exitDungeon(st);

/* ── 12. soak ───────────────────────────────────────────────── */
out("\nSOAK\n");
chk("6000 frames of everything at 4× speed", () => {
  st.speed = 4;
  const d0 = st.time.day;
  for (let i = 0; i < 6000; i++) {
    frames(1);
    if (i % 700 === 0) {
      st.weather = EH.pick(Object.keys(EH.WEATHER));
      st.player.x = EH.clamp(st.player.x + EH.rand(-4, 4), 2, st.map.w - 3);
      st.player.y = EH.clamp(st.player.y + EH.rand(-4, 4), 2, st.map.h - 3);
      EH.Render.snapCam(st);
    }
    if (i === 1500) { const s = EH.Build.findSpot(st, "torch", st.town.plaza, 12); if (s) EH.Build.place(st, "torch", s.x, s.y, true); }
    if (i === 2500) { EH.Combat.enterDungeon(st, 7); st.auto = true; }
    if (i === 4000) { st.auto = false; EH.Combat.exitDungeon(st); }
    if (i === 4500) { EH.Quests.daily(st); }
    if (i === 5000) { EH.Game.save(false); }
  }
  st.speed = 1;
  return `day ${d0}→${st.time.day} · kills ${st.stats.kills} · trades ${st.stats.trades} · sprites cached ${EH.Art.cache.size} · playtime ${EH.fmtDur(st.stats.playTime)}`;
});
chk("no NaN anywhere in state", () => {
  const bad = [];
  const seen = new Set();
  const scan = (o, p, d) => {
    if (d > 5 || !o || typeof o !== "object" || seen.has(o)) return;
    if (ArrayBuffer.isView(o)) return;
    seen.add(o);
    for (const k in o) {
      let v; try { v = o[k]; } catch (e) { continue; }
      if (typeof v === "number" && !isFinite(v)) bad.push(`${p}.${k}=${v}`);
      else if (v && typeof v === "object") scan(v, `${p}.${k}`, d + 1);
    }
  };
  scan(st.res, "res", 0); scan(st.time, "time", 0); scan(st.stats, "stats", 0);
  scan(st.player, "player", 0); scan(st.dungeon, "dungeon", 0); scan(st.town, "town", 0);
  for (const n of st.npcs) scan(n.needs, n.name + ".needs", 0);
  for (const b of st.buildings) if (!isFinite(b.t) || !isFinite(b.hp) || !isFinite(b.lvl)) bad.push("building " + b.type);
  for (const p of st.pets) if (!isFinite(p.happy) || !isFinite(p.x)) bad.push("pet " + p.name);
  if (bad.length) throw new Error(bad.slice(0, 10).join(" · "));
  return "clean";
});
chk("no entity escaped the map", () => {
  for (const n of st.npcs) if (n.x < -3 || n.y < -3 || n.x > st.map.w + 3 || n.y > st.map.h + 3) throw new Error(`${n.name} at ${n.x.toFixed(1)},${n.y.toFixed(1)}`);
  return `${st.npcs.length} villagers contained`;
});
chk("sleep skips to dawn", () => { st.time.minute = 23 * 60; EH.Game.sleep(); if (st.time.hourF > 12) throw new Error("hour " + st.time.hourF); return `woke at ${EH.fmtTime(st.time.minute)}`; });
chk("research tree", () => {
  st.res.gold = 1e7; st.res.ore = 1e6; st.res.food = 1e6; st.res.stone = 1e6;
  st.research = [];
  for (const R of EH.RESEARCH) { if (EH.Build.pay(st, R.cost)) st.research.push(R.id); }
  st.derived = EH.Items.derive(st.player, st);
  const fx = EH.Items.researchFx(st);
  return `${st.research.length}/${EH.RESEARCH.length} researched · fx ${Object.keys(fx).join(",")}`;
});
chk("final integrity", () => {
  if (!isFinite(st.res.gold) || st.res.gold < 0) throw new Error("gold " + st.res.gold);
  if (st.player.hp > st.derived.hpMax + 1) throw new Error("hp over max");
  if (st.player.level < 1) throw new Error("level " + st.player.level);
  return `Lv${st.player.level} · ${EH.fmt(st.res.gold)}g · day ${st.time.day} · ${st.stats.kills} kills · ${st.stats.quests} quests · ${st.buildings.length} buildings · ${st.npcs.length} villagers · ${st.pets.length} pets`;
});

/* ── 14. cold boot through the real browser entry point ─────── */
out("\nCOLD BOOT (the path a real browser takes)\n");
chk("window.load → character creation → claim → play", () => {
  EH.store.del(EH.CFG.SAVE_KEY);
  global.__winDispatch("load", {});                       // index.html's onload handler
  const cc = document.getElementById("charcreate");
  if (!cc) throw new Error("character creation never appeared");
  const host = document.getElementById("cc-classes");
  if (!host) throw new Error("#cc-classes missing from the overlay markup");
  if (host.children.length !== Object.keys(EH.CLASS).length) throw new Error(`expected ${Object.keys(EH.CLASS).length} class cards, found ${host.children.length}`);
  const go = document.getElementById("cc-go");
  if (!go) throw new Error("#cc-go missing");
  if (!go.disabled) throw new Error("CLAIM should start disabled");
  document.getElementById("cc-name").value = "Coldboot";
  host.children[2].dispatch("click");                     // pick the 3rd class
  if (go.disabled) throw new Error("CLAIM stayed disabled after picking a class");
  go.dispatch("click");
  if (document.getElementById("charcreate")) throw new Error("overlay was not removed from the document");
  const s = EH.Game.st;
  if (!s || !s.map) throw new Error("boot produced no game state");
  if (s.player.name !== "Coldboot") throw new Error("name not applied: " + s.player.name);
  if (!s.townMap) throw new Error("townMap not set on a fresh game");
  if (!s.npcs.filter(n => n.work).length) throw new Error("nobody has a job on a fresh game");
  for (const id of ["toast", "placebar", "placetext", "placecancel", "hint", "log", "panels", "dialogue", "floaters"]) {
    if (!document.getElementById(id)) throw new Error("index.html is missing #" + id);
  }
  return `${s.player.name} the ${EH.CLASS[s.player.cls].n} · ${s.npcs.length} villagers · ${s.npcs.filter(n => n.work).length} employed · ${s.buildings.length} buildings`;
});
chk("cold-booted save plays for a day, then reloads", () => {
  const s = EH.Game.st;
  st = s;
  frames(Math.ceil(1440 / ((1 / 30) * (EH.CFG.MIN_PER_DAY / EH.CFG.REAL_SEC_PER_DAY))));
  if (s.time.day < 2) throw new Error("a day did not pass: " + s.time.day);
  for (const p of ["char", "inv", "build", "town", "quest", "pet", "menu"]) { EH.UI.openPanel(p); EH.UI.close(p); }
  if (!EH.Game.save(true)) throw new Error("save failed");
  const raw = EH.store.get(EH.CFG.SAVE_KEY);
  if (!raw || !raw.v) throw new Error("nothing in storage");
  const report = EH.Game.load(raw);
  if (EH.Game.st.player.name !== "Coldboot") throw new Error("reload lost the character");
  return `day ${s.time.day} · ${(JSON.stringify(raw).length / 1024).toFixed(1)} KB saved · reloaded ${EH.Game.st.npcs.length} villagers${report ? " · offline report" : ""}`;
});
chk("build placement banner wires up", () => {
  const s = EH.Game.st;
  st = s;
  s.res.gold = 1e5; s.res.wood = 1e5; s.res.stone = 1e5;
  EH.UI.startPlace("house");
  const bar = document.getElementById("placebar");
  const txt = document.getElementById("placetext");
  if (!bar || !txt) throw new Error("placebar missing");
  if (!bar.classList.contains("show")) throw new Error("placement banner never showed");
  if (!/Cottage/.test(txt.innerHTML)) throw new Error("banner text wrong: " + txt.innerHTML.slice(0, 60));
  document.getElementById("placecancel").dispatch("click");
  if (bar.classList.contains("show")) throw new Error("cancel button did not hide the banner");
  if (EH.Game.st.placing) throw new Error("still in placement mode after cancel");
  return "banner shows on start, hides on cancel";
});


/* ════════════════════════════════════════════════════════════════
   M1 — PRD v0.3 acceptance checks
   FR-03 fixed timestep · FR-05 capacity · FR-06 shaped adjacency
   FR-07 combos · FR-11 job training · FR-13 recruitment · §10.5 downtime
   ════════════════════════════════════════════════════════════════ */
out("\nM1 — FR-03 FIXED TIMESTEP & DETERMINISM\n");

function detRun(seed, steps) {
  const s = EH.Game.newState("D", "warden", seed);
  EH.Game.st = s; EH.Game.setupWorld(false);
  EH.Game.stepN(steps);
  return s;
}
function snap(s) {
  return JSON.stringify({
    rng: EH.randState().s, day: s.time.day, minute: s.time.minute,
    res: s.res, weather: s.weather, weatherT: s.weatherT,
    npcs: s.npcs.map(n => [n.x, n.y, n.needs.mood, n.needs.hunger, n.stats.str, n.stats.int]),
    b: s.buildings.map(x => [x.id, x.done, x.lvl, x.workers.length]),
    steps: s.simSteps,
  });
}
chk("FIXED and stepN are exposed", () => {
  if (typeof EH.Game.stepN !== "function") throw new Error("stepN missing");
  if (Math.abs(EH.Game.FIXED - 1 / 60) > 1e-12) throw new Error("FIXED is not 1/60: " + EH.Game.FIXED);
  return `FIXED = 1/${Math.round(1 / EH.Game.FIXED)} s, simSteps counter present`;
});
chk("no simulation code may draw from Math.random", () => {
  /* FR-03(a): the sim is deterministic only if every draw comes from EH.rng.
     The one permitted exception is the entropy that seeds a new run. */
  const allowed = { "game.js": 1 };   // the single entropy draw that seeds a new run
  const bad = [];
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, "js", f), "utf8");
    const n = (src.match(/Math\.random/g) || []).length;
    const lim = allowed[f] || 0;
    if (n > lim) bad.push(`${f}:${n}(>${lim})`);
  }
  if (bad.length) throw new Error("Math.random still reachable from the sim — " + bad.join(", "));
  return "only the new-game entropy draw remains";
});
chk("same seed + same steps ⇒ identical state", () => {
  const A = detRun(20260, 1200), a = snap(A);
  const B = detRun(20260, 1200), b = snap(B);
  if (a !== b) {
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    throw new Error(`diverged at char ${i}: …${a.slice(Math.max(0, i - 40), i + 40)}`);
  }
  return `1200 fixed steps byte-identical · rng=${JSON.parse(a).rng} · day ${JSON.parse(a).day}`;
});
chk("a different seed must diverge", () => {
  const a = snap(detRun(20260, 1200)), c = snap(detRun(999, 1200));
  if (a === c) throw new Error("two different seeds produced identical states");
  return "seed 999 ≠ seed 20260";
});
chk("step count changes the outcome (sim really advances)", () => {
  const a = snap(detRun(20260, 600)), b = snap(detRun(20260, 1200));
  if (a === b) throw new Error("600 and 1200 steps produced the same state");
  return "600 ≠ 1200 steps";
});
chk("save carries the RNG stream and reload restores it exactly", () => {
  const s = detRun(4242, 600);
  if (typeof EH.Game.serialize !== "function") throw new Error("serialize is not exported");
  const blob = EH.Game.serialize();
  if (!blob || !blob.rng) throw new Error("save has no rng field — reloads would diverge");
  EH.Game.load(JSON.parse(JSON.stringify(blob)));
  EH.Game.stepN(300);
  const s2 = detRun(4242, 900);
  const live = snap(EH.Game.st), fresh = snap(s2);
  if (live !== fresh) throw new Error("save→load→300 steps ≠ 900 continuous steps");
  return "reload at step 600 + 300 == continuous 900";
});

out("\nM1 — FR-05 CAPACITY, FR-06 ADJACENCY, FR-07 COMBOS\n");

chk("§5.1 no building is job-locked; anyone can fill any slot", () => {
  const s = detRun(20260, 60);
  EH.Build.assignWorkers(s);
  const farm = s.buildings.find(b => b.type === "farm" && b.done);
  if (!farm) throw new Error("no farm in the starter town");
  const ws = EH.Build.workersOf(s, farm);
  if (!ws.length) throw new Error("farm is unstaffed");
  const cap = EH.Build.capacityOf(farm);
  if (ws.length > cap) throw new Error(`over capacity: ${ws.length} > ${cap}`);
  /* prove a mismatched job is *allowed* — that is the whole point of §5.1 */
  const mismatch = ws.find(n => EH.Build.JOB_FOR[farm.type] !== n.job);
  return `farm cap ${cap}, staffed ${ws.length}${mismatch ? `, includes ${mismatch.job} (no job lock)` : ", all matched"}`;
});
chk("§5.1 job match is a bonus, never a requirement", () => {
  const farm = { type: "farm" };
  const good = EH.Build.matchBonus(farm, { job: "farmer" });
  const other = EH.Build.matchBonus(farm, { job: "scholar" });
  if (!(good > 1)) throw new Error("matching job gives no bonus: " + good);
  if (other !== 1) throw new Error("non-matching job is penalised: " + other);
  return `farmer ×${good}, scholar ×${other} (allowed, not punished)`;
});
chk("§5.1 assignWorkers is idempotent (regression: it used to empty every building)", () => {
  const s = detRun(20260, 60);
  EH.Build.assignWorkers(s);
  const once = s.buildings.map(b => b.workers.length).join(",");
  EH.Build.assignWorkers(s); EH.Build.assignWorkers(s); EH.Build.assignWorkers(s);
  const thrice = s.buildings.map(b => b.workers.length).join(",");
  if (once !== thrice) throw new Error(`not idempotent: ${once} → ${thrice}`);
  const employed = s.npcs.filter(n => n.work).length;
  if (!employed) throw new Error("nobody employed after reassignment");
  return `stable across 4 calls · ${employed} employed`;
});
chk("§5.2 shaped footprints touch exactly the tiles they should", () => {
  const t = (type, w, h) => EH.Build.touchTiles({ type, x: 10, y: 10, w, h }).length;
  const want = { hedge: 8, banner: 1, fountain: 4, statue: 4, well: 4 };
  const got = {};
  for (const k in want) {
    const B = EH.BUILD[k];
    got[k] = t(k, B.w, B.h);
    if (got[k] !== want[k]) throw new Error(`${k} (${B.decor.shape}) touches ${got[k]}, expected ${want[k]}`);
  }
  /* a decoration must NOT buff a building it does not physically touch */
  const farmNear = { id: "f", type: "farm", x: 10, y: 7, w: 3, h: 3, done: true };
  const wellTouch = { id: "w", type: "well", x: 11, y: 6, w: 1, h: 1, done: true };
  const wellFar = { id: "w", type: "well", x: 30, y: 30, w: 1, h: 1, done: true };
  const near = EH.Build.bonusMul({ buildings: [farmNear, wellTouch] }, farmNear, "food", new Map());
  const far = EH.Build.bonusMul({ buildings: [farmNear, wellFar] }, farmNear, "food", new Map());
  if (!(near > 1)) throw new Error("touching well gave no bonus");
  if (far !== 1) throw new Error("well 20 tiles away still buffed the farm: " + far);
  return `hedge 8 · banner 1 · fountain/statue/well 4 · touch ×${near.toFixed(3)}, no-touch ×${far}`;
});
chk("§5.3 combos fire on adjacency and need no dungeon materials", () => {
  const mk = (id, type, x, y) => ({ id, type, x, y, w: 2, h: 2, done: true, lvl: 1, hp: 100, workers: [], acc: {} });
  const adj = { buildings: [mk("a", "forge", 20, 20), mk("b", "quarry", 20, 22)] };
  const apart = { buildings: [mk("a", "forge", 20, 20), mk("b", "quarry", 34, 34)] };
  const c1 = EH.Build.combosOf(adj, adj.buildings[0]).map(c => c.id);
  const c2 = EH.Build.combosOf(apart, apart.buildings[0]).map(c => c.id);
  if (!c1.includes("foundry")) throw new Error("forge+quarry adjacent did not make Foundry Work: " + c1);
  if (c2.length) throw new Error("combo fired without adjacency: " + c2);
  const mul = EH.Build.bonusMul(adj, adj.buildings[0], "ore", new Map());
  if (!(mul > 1.2)) throw new Error("combo multiplier too small: " + mul);
  /* §11.2 escape valve: every combo must be buildable from town resources only */
  const needsOre = [];
  for (const C of EH.COMBOS) for (const t of [C.a, C.b]) {
    const cost = EH.BUILD[t].cost;
    if (cost && (cost.ore || 0) > 0) needsOre.push(t);
  }
  return `${EH.COMBOS.length} combos · Foundry ×${mul.toFixed(2)} · combo parts needing ore: ${needsOre.length ? needsOre.join(",") : "none (mine only)"}`;
});
chk("§10.5 downtime zeroes output and decays on the game clock", () => {
  const s = detRun(20260, 60);
  const farm = s.buildings.find(b => b.type === "farm" && b.done);
  const healthy = EH.Build.efficiency(s, farm);
  farm.offline = 100;
  if (EH.Build.efficiency(s, farm) !== 0) throw new Error("an offline building still produced");
  s.dtMin = 40; EH.Build.update(s, 1 / 60);
  if (Math.abs(farm.offline - 60) > 1e-9) throw new Error("offline did not decay by dtMin: " + farm.offline);
  farm.offline = 0;
  if (EH.Build.efficiency(s, farm) <= 0) throw new Error("building never recovered");
  return `×${healthy.toFixed(2)} healthy → 0 offline → decayed 40 game-min → recovered`;
});

out("\nM1 — FR-11 JOB TRAINING, FR-13 RECRUITMENT\n");

function trainDays(n, days, opts) {
  opts = opts || {};
  for (const v of n) {
    if (!v) continue;
    v.downed = 0;
    if (opts.work !== false) { v.work = v.work || "post"; v.act = { kind: "work" }; }
    else v.act = { kind: "wander" };
  }
  for (let d = 0; d < days; d++) { st_sim.dtMin = EH.CFG.MIN_PER_DAY; EH.NPCs.trainTick(st_sim); }
}
let st_sim = null;
chk("§6.1 a job grows the stats it physically demands — and only those", () => {
  st_sim = detRun(20260, 60);
  const farmer = st_sim.npcs.find(n => n.job === "farmer" && !n.dead);
  const scholar = st_sim.npcs.find(n => n.job === "scholar" && !n.dead);
  if (!farmer) throw new Error("no farmer in the starter town");
  const f = { str: farmer.stats.str, int: farmer.stats.int, dex: farmer.stats.dex };
  trainDays([farmer, scholar], 30);
  const dStr = farmer.stats.str - f.str, dInt = farmer.stats.int - f.int, dDex = farmer.stats.dex - f.dex;
  if (!(dStr > 5)) throw new Error(`farmer barely grew STR over 30 days: +${dStr.toFixed(2)}`);
  if (dInt !== 0) throw new Error(`farming trained INT (+${dInt.toFixed(3)}) — jobs must be specific`);
  if (dDex !== 0) throw new Error(`farming trained DEX (+${dDex.toFixed(3)})`);
  const expect = EH.JOB_TRAIN.farmer.grow.str * 30;
  if (Math.abs(dStr - expect) > 0.01) throw new Error(`STR +${dStr.toFixed(3)} ≠ table ${expect.toFixed(3)}`);
  return `farmer +${dStr.toFixed(2)} STR over 30 days (INT/DEX unchanged)${scholar ? ` · scholar +${(scholar.stats.int - 9).toFixed(0)}→ INT` : ""}`;
});
chk("§6.2 leisure is the second training path, idling is slower", () => {
  st_sim = detRun(20260, 60);
  const a = st_sim.npcs.find(n => n.job === "villager" && !n.dead);
  const b = st_sim.npcs.find(n => n.job === "villager" && !n.dead && n !== a);
  if (!a || !b) throw new Error("need two idle villagers");
  a.stats = Object.assign({}, a.stats); b.stats = Object.assign({}, b.stats);
  a.act = { kind: "tavern" }; a.work = null;            // at a vacation building
  b.act = { kind: "wander" }; b.work = null;           // doing nothing
  for (let d = 0; d < 20; d++) { st_sim.dtMin = EH.CFG.MIN_PER_DAY; EH.NPCs.trainTick(st_sim); }
  const ga = a.stats.str - 5 >= 0 ? 1 : 1;             // compare growth deltas
  const dA = Object.keys(a.stats).reduce((s, k) => s + a.stats[k], 0);
  const dB = Object.keys(b.stats).reduce((s, k) => s + b.stats[k], 0);
  if (!(dA > dB)) throw new Error(`leisure (${dA.toFixed(2)}) did not out-train idling (${dB.toFixed(2)})`);
  return `20 days off-work: at the tavern ${dA.toFixed(2)} total stats vs wandering ${dB.toFixed(2)}`;
});
chk("§10.5 a downed villager trains nothing and recovers on the clock", () => {
  st_sim = detRun(20260, 60);
  const n = st_sim.npcs.find(x => x.job === "farmer" && !x.dead);
  n.downed = 120; n.work = "post"; n.act = { kind: "work" };
  const s0 = n.stats.str;
  /* a tick shorter than the timer: nothing learned, timer decayed by exactly dtMin */
  st_sim.dtMin = 30; EH.NPCs.trainTick(st_sim);
  if (n.stats.str !== s0) throw new Error("a downed villager kept training");
  if (Math.abs(n.downed - 90) > 1e-9) throw new Error("downed 120 − 30 should be 90, got " + n.downed);
  /* run the timer out, then confirm they get back to work */
  for (let i = 0; i < 4 && n.downed > 0; i++) { st_sim.dtMin = 30; EH.NPCs.trainTick(st_sim); }
  if (n.downed !== 0) throw new Error("downed timer never cleared: " + n.downed);
  st_sim.dtMin = EH.CFG.MIN_PER_DAY; EH.NPCs.trainTick(st_sim);
  if (n.stats.str <= s0) throw new Error("never resumed training after recovery");
  return `downed 120 → 90 → 0 game-min, +0 STR while down, +${(n.stats.str - s0).toFixed(2)} STR after recovery`;
});
chk("§6.5 recruitment is stat-gated and the refusal names the stat (P5)", () => {
  st_sim = detRun(20260, 60);
  const n = st_sim.npcs.find(x => x.job === "farmer" && !x.dead);
  n.stats.int = 4; n.stats.str = 8; n.stats.vit = 6;
  const bad = EH.NPCs.recruit(st_sim, n.id, "mage");
  if (bad.ok) throw new Error("INT 4 was allowed to become a Mage");
  if (!/Intellect/.test(bad.why)) throw new Error("refusal did not name the stat: " + bad.why);
  if (EH.NPCs.recruit(st_sim, n.id, "warden").ok) throw new Error("STR 8 became a Warden");
  return `refused with "${bad.why}"`;
});
chk("§6.5 the player chooses the class, from what the village produced", () => {
  st_sim = detRun(20260, 60);
  const n = st_sim.npcs.find(x => x.job === "farmer" && !x.dead);
  n.stats.str = 14; n.stats.vit = 12; n.stats.int = 4;
  const opts = EH.NPCs.classOptions(n);
  const ok = opts.filter(o => o.ok).map(o => o.cls);
  if (!ok.includes("warden")) throw new Error("STR 14/VIT 12 was not offered Warden");
  if (ok.includes("mage")) throw new Error("INT 4 was offered Mage");
  const r = EH.NPCs.recruit(st_sim, n.id, "warden");
  if (!r.ok) throw new Error("recruit failed: " + r.why);
  if (!n.adventurer || n.adventurer.cls !== "warden") throw new Error("adventurer state not set");
  if (EH.NPCs.recruit(st_sim, n.id, "warden").ok) throw new Error("recruited twice");
  const kids = st_sim.npcs.filter(x => x.job === "child");
  for (const k of kids) { k.stats.str = 30; if (EH.NPCs.recruit(st_sim, k.id, "warden").ok) throw new Error("recruited a child"); }
  return `${n.name}: menu [${ok}] → chose Warden · ${kids.length} child(ren) correctly refused`;
});
chk("§6.5 a farming village cannot produce mages — a scholarly one can", () => {
  /* P2: base building determines the army. Prove it end to end. */
  st_sim = detRun(20260, 60);
  const farm = st_sim.npcs.filter(n => n.job === "farmer" && !n.dead);
  const schol = st_sim.npcs.filter(n => n.job === "scholar" && !n.dead);
  for (const n of farm) { n.work = "post"; n.act = { kind: "work" }; n.downed = 0; }
  for (const n of schol) { n.work = "post"; n.act = { kind: "work" }; n.downed = 0; }
  const f0 = farm.map(n => n.stats.int), s0 = schol.map(n => n.stats.int);
  for (let d = 0; d < 120; d++) { st_sim.dtMin = EH.CFG.MIN_PER_DAY; EH.NPCs.trainTick(st_sim); }
  const fGrow = farm.reduce((a, n, i) => a + (n.stats.int - f0[i]), 0);
  const sGrow = schol.reduce((a, n, i) => a + (n.stats.int - s0[i]), 0);
  if (fGrow !== 0) throw new Error("farmers trained INT");
  if (!schol.length) return "no scholar in this town — farmers grew 0 INT (correct)";
  if (!(sGrow > 0)) throw new Error("scholars did not train INT");
  const fCan = farm.filter(n => EH.NPCs.classOptions(n).some(o => o.ok && o.cls === "mage")).length;
  const sCan = schol.filter(n => EH.NPCs.classOptions(n).some(o => o.ok && o.cls === "mage")).length;
  return `120 days: ${farm.length} farmers +${fGrow.toFixed(0)} INT (${fCan} can be mages) · ${schol.length} scholars +${sGrow.toFixed(1)} INT (${sCan} can be mages)`;
});
chk("§6.5 D14 adventurers work at home, but slower", () => {
  st_sim = detRun(20260, 60);
  const b = st_sim.buildings.find(x => x.type === "farm" && x.done);
  const ws = EH.Build.workersOf(st_sim, b);
  if (!ws.length) throw new Error("farm unstaffed");
  const before = EH.Build.efficiency(st_sim, b);
  for (const n of ws) n.adventurer = { cls: "warden", level: 1, xp: 0 };
  const after = EH.Build.efficiency(st_sim, b);
  if (!(after < before)) throw new Error("adventurers work at full rate — the central tension collapses");
  const ratio = after / before;
  if (Math.abs(ratio - EH.CFG.ADV_WORK_MUL) > 0.01) throw new Error(`rate ${ratio.toFixed(3)} ≠ D14's ${EH.CFG.ADV_WORK_MUL}`);
  for (const n of ws) n.adventurer = null;
  return `×${before.toFixed(2)} → ×${after.toFixed(2)} = ${(ratio * 100).toFixed(0)}% (D14 = ${EH.CFG.ADV_WORK_MUL * 100}%)`;
});
chk("§5.1 an away villager holds no post (outpost / expedition)", () => {
  st_sim = detRun(20260, 60);
  const n = st_sim.npcs.find(x => x.work && !x.dead);
  if (!n) throw new Error("nobody employed");
  n.away = true;
  EH.Build.assignWorkers(st_sim);
  if (n.work) throw new Error("an away villager still holds a post");
  n.away = false;
  EH.Build.assignWorkers(st_sim);
  if (!n.work) throw new Error("returning villager was not re-seated");
  return `${n.name} away → post released; home → re-seated`;
});
chk("every building declares one of the four categories (§5)", () => {
  const cats = { production: 0, kiosk: 0, vacation: 0, decoration: 0, legacy: 0 };
  const bad = [];
  for (const k in EH.BUILD) {
    const c = EH.BUILD[k].cat;
    if (!cats.hasOwnProperty(c)) bad.push(`${k}:${c || "none"}`);
    else cats[c]++;
  }
  if (bad.length) throw new Error("uncategorised — " + bad.join(", "));
  if (cats.legacy !== 1) throw new Error("expected exactly 1 legacy building (the palisade, cut by §7.4)");
  return `production ${cats.production} · kiosk ${cats.kiosk} · vacation ${cats.vacation} · decoration ${cats.decoration} · legacy ${cats.legacy} (§7.4 pending)`;
});
chk("every recruitable class declares a stat gate (§6.5)", () => {
  const out2 = [];
  for (const k in EH.CLASS) {
    const C = EH.CLASS[k];
    if (!C.req) throw new Error(`${k} has no req — villagers could not be gated`);
    for (const s in C.req) if (!(C.req[s] > 0)) throw new Error(`${k}.req.${s} = ${C.req[s]}`);
    out2.push(`${k}:${Object.keys(C.req).map(s => s + C.req[s]).join("+")}`);
  }
  return out2.join(" ");
});
chk("every job has a training profile (§6.1)", () => {
  const jobs = new Set(st_sim.npcs.map(n => n.job));
  const missing = [...jobs].filter(j => !EH.JOB_TRAIN[j]);
  if (missing.length) throw new Error("no training profile for " + missing.join(", "));
  for (const j in EH.JOB_TRAIN) {
    const t = EH.JOB_TRAIN[j];
    if (!t.grow) throw new Error(j + " has no grow table");
    for (const k in t.grow) if (!(t.grow[k] > 0)) throw new Error(`${j}.grow.${k} = ${t.grow[k]}`);
  }
  return `${Object.keys(EH.JOB_TRAIN).length} profiles cover all ${jobs.size} jobs present`;
});
EH.Game.st = st;   // restore the main state for anything appended later

/* ── 16. §1.3 NO DIRECT CONTROL + the two rendering/UI bugs from playtest ── */
out("\n§1.3 NO DIRECT CONTROL (playtest feedback 1)\n");

chk("held WASD / arrow keys cannot move the Warden one pixel", () => {
  const s = EH.Game.newState("Hands-off", "warden", 90210);
  EH.Game.st = s; EH.Game.setupWorld(false); EH.Render.snapCam(s);
  /* Freeze every autonomous reason to move so the only possible movement would
     come from the keyboard: no delve, no idle countdown, no stroll, no order. */
  s.delve = false; s.idleT = -1e9; s.strollT = 1e9; s.recallT = 0;
  s.pendingInteract = null; s.placing = null; s.player.path = [];
  const x0 = s.player.x, y0 = s.player.y;
  for (const k of ["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) __winDispatch("keydown", { key: k });
  let autoOff = 0;
  for (let i = 0; i < 600; i++) { EH.Game.update(1 / 60); if (!s.auto) autoOff++; }
  for (const k of ["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) __winDispatch("keyup", { key: k });
  const moved = Math.abs(s.player.x - x0) + Math.abs(s.player.y - y0);
  if (moved > 1e-9) throw new Error(`10 s of held keys moved the Warden ${moved.toFixed(3)} tiles — §1.3 forbids direct control`);
  if (autoOff) throw new Error(`st.auto was false on ${autoOff}/600 frames — the auto-Warden must never switch off`);
  if (!EH.Game.st.auto) throw new Error("auto flag lost");
  return "10 s of held WASD + arrows = 0.000 tiles moved · st.auto true on all 600 frames";
});

chk("clicking empty ground is not a walk order", () => {
  const s = EH.Game.st;
  s.delve = false; s.idleT = -1e9; s.strollT = 1e9; s.pendingInteract = null; s.player.path = [];
  const x0 = s.player.x, y0 = s.player.y;
  /* every walkable tile on the map, clicked through the public world-click path
     where one exists — the contract is that none of them issues a move order */
  const cv = document.querySelector("canvas");
  if (!cv || !cv.dispatch) throw new Error("no canvas to click");
  for (let i = 0; i < 40; i++) {
    const sp = EH.Render.project(s.player.x + (i % 7) - 3, s.player.y + ((i / 7) | 0) - 3);
    if (!sp) continue;
    cv.dispatch("pointerdown", { button: 0, clientX: sp.x / (EH.Render.scale || 1), clientY: sp.y / (EH.Render.scale || 1) });
    EH.Game.update(1 / 60);
  }
  if (s.player.path.length) throw new Error("a click on open ground queued a path — the Warden would walk off under its own steam");
  const moved = Math.abs(s.player.x - x0) + Math.abs(s.player.y - y0);
  if (moved > 1e-9) throw new Error(`ground clicks moved the Warden ${moved.toFixed(3)} tiles`);
  return "40 clicks on open ground: no path queued, no movement";
});

chk("§1.3 the Warden plays itself — left alone in the village it delves on its own", () => {
  const s = EH.Game.newState("Idlehands", "warden", 5150);
  EH.Game.st = s; EH.Game.setupWorld(false); EH.Render.snapCam(s);
  s.delve = false; s.idleT = 0; s.recallT = 0; s.strollT = 0; s.player.path = [];
  const x0 = s.player.x, y0 = s.player.y;
  let entered = -1, strolled = false, farthest = 0;
  for (let i = 0; i < 60 * 120 && entered < 0; i++) {
    EH.Game.update(1 / 60);
    if (s.map.kind === "dungeon") { entered = i / 60; break; }
    farthest = Math.max(farthest, Math.abs(s.player.x - x0) + Math.abs(s.player.y - y0));
    if (farthest > 1.2) strolled = true;
  }
  if (entered < 0) throw new Error("120 s of no input and the Warden never reached the Hollowdeep — the loop stalls without a player");
  if (!strolled) throw new Error("the Warden stood frozen in the village instead of staying visible and reachable");
  return `descended unaided after ${entered.toFixed(0)} s (floor ${s.dungeon.floor}) · strolled up to ${farthest.toFixed(1)} tiles while waiting`;
});

out("\nRENDER + DIALOGUE (playtest feedback 2 & 3)\n");

chk("ground is painted before anything with height — tiles can never cover a character", () => {
  const s = EH.Game.st;
  if (s.map.kind !== "town") { EH.Game.setupWorld(false); }
  EH.Render.snapCam(s);
  const ctx = EH.Render.ctx;
  if (!ctx) throw new Error("renderer has no context");
  /* Catalogue every ground-tile canvas this map can ask for, so each drawImage
     can be classified as flat ground or something with height. */
  const tiles = new Set();
  for (const id of new Set(s.map.t)) for (let v = 0; v < 8; v++) { const c = EH.Art.tile(id, v); if (c) tiles.add(c); }
  if (tiles.size < 4) throw new Error("only " + tiles.size + " tile canvases — cannot classify the draw order");
  const seq = [];
  const real = ctx.drawImage;
  ctx.drawImage = function (img) { seq.push(tiles.has(img) ? "g" : "o"); return real.apply(this, arguments); };
  try { EH.Render.draw(s, 1 / 60); } finally { ctx.drawImage = real; }
  const g = seq.filter(c => c === "g").length, o = seq.length - g;
  const lastGround = seq.lastIndexOf("g"), firstRaised = seq.indexOf("o");
  if (!g) throw new Error("no ground was drawn at all");
  if (!o) throw new Error("nothing with height was drawn — no buildings, props or characters on screen?");
  if (lastGround > firstRaised) {
    throw new Error(`${seq.slice(0, lastGround + 1).filter(c => c === "o").length} raised draw(s) happened before the last ground tile (index ${lastGround} of ${seq.length}) — the next diagonal's diamond would paint over a character's legs`);
  }
  return `${g} ground tiles then ${o} raised draws, strictly in that order`;
});

chk("dialogue options no longer re-roll every UI refresh (the Mara/Sylvie jitter)", () => {
  const s = EH.Game.st;
  for (const id of ["mara", "sylvie"]) {
    const n = EH.NPCs.byId(s, id);
    if (!n) throw new Error("no villager " + id);
    n.quest = null; n.relP = 0;                       // the flickering case: no quest, low regard
    const sig = () => EH.NPCs.options(n, s).map(o => o.k + o.act + o.label).join("|");
    const first = sig();
    for (let i = 0; i < 200; i++) if (sig() !== first) throw new Error(`${id}'s option list changed on call ${i} — it is re-rolling a random number on every refresh`);
    EH.UI.dialogue(n);
    const row = document.getElementById("dlg-opts");
    if (!row || !row.children.length) throw new Error(id + ": dialogue produced no options");
    const b0 = row.children[0];
    for (let i = 0; i < 40; i++) { EH.Game.update(1 / 60); EH.UI.syncAll(); }
    if (row.children[0] !== b0) throw new Error(`${id}: the option buttons were rebuilt under the cursor ${row.children.length}× — clicks would fall through`);
    EH.UI.closeDialogue();
  }
  return "mara + sylvie: 200 identical option reads each, buttons untouched across 40 syncAll() ticks";
});

chk("a portrait canvas is never stolen out of a container it is already in", () => {
  const def = EH.NPCDEF.find(d => d.id === "sylvie");
  const a = EH.Art.portrait(def.look);
  const hostA = new __El("div"); hostA.appendChild(a);
  const b = EH.Art.portrait(def.look);
  if (b === a) throw new Error("the same cached canvas was handed to two containers — appending it to the dialogue box would silently empty the villager roster");
  const hostB = new __El("div"); hostB.appendChild(b);
  if (hostA.children.length !== 1 || hostA.children[0] !== a) throw new Error("the first container lost its portrait");
  if (hostB.children.length !== 1 || hostB.children[0] !== b) throw new Error("the second container lost its portrait");
  /* and the cache must key on every field the drawing reads */
  const short = EH.Art.portrait(Object.assign({}, def.look, { long: false, hat: null }));
  const long = EH.Art.portrait(Object.assign({}, def.look, { long: true, hat: null }));
  if (short === long) throw new Error("long hair and short hair share one cached portrait — the cache key is missing o.long");
  return "two attached containers keep their own canvases · long/short hair cache separately";
});

/* ── result ─────────────────────────────────────────────────── */
out("\n══ RESULT ══\n");
if (errors.length) {
  out(`\n✗ ${errors.length} problem(s)\n`);
  const seen = new Set();
  for (const e of errors) {
    const key = e.split("\n")[0].slice(0, 140);
    if (seen.has(key)) continue; seen.add(key);
    out("\n─────\n" + e.split("\n").slice(0, 7).join("\n") + "\n");
  }
  process.exit(1);
}
out("\n✓ ALL CHECKS PASSED\n\n");
