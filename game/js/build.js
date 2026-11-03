/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — build.js : construction, production, upgrades, town setup
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;

EH.Build = (function () {

  /* ── helpers ───────────────────────────────────────────────── */
  const get = (st, id) => st.buildings.find(b => b.id === id);
  const firstOf = (st, type, done) => st.buildings.find(b => b.type === type && (done === false ? true : b.done));
  const allOf = (st, type) => st.buildings.filter(b => b.type === type && b.done);
  const count = (st, type) => st.buildings.filter(b => b.type === type && b.done).length;
  const at = (st, x, y) => st.buildings.find(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);
  function centre(b) { return { x: b.x + b.w / 2 - 0.5, y: b.y + b.h / 2 - 0.5 }; }

  function costOf(type, lvl) {
    const B = EH.BUILD[type]; if (!B) return null;
    if (lvl === undefined || lvl <= 1) return Object.assign({}, B.cost);
    const u = EH.UP_COST(lvl - 1);
    return { gold: u.gold, wood: u.wood, stone: u.stone };
  }
  function canAfford(st, cost) {
    for (const k in cost) if ((st.res[k] || 0) < cost[k]) return false;
    return true;
  }
  function affordText(st, cost) {
    return Object.keys(cost).map(k => {
      const have = (st.res[k] || 0), need = cost[k];
      return `<span class="${have >= need ? "" : "no"}">${EH.fmt(need)} ${k}</span>`;
    }).join(" · ");
  }
  function pay(st, cost) {
    if (!canAfford(st, cost)) return false;
    for (const k in cost) st.res[k] -= cost[k];
    return true;
  }
  function refund(st, b) {
    const c = EH.BUILD[b.type].cost;
    for (const k in c) st.res[k] = Math.min(capOf(st, k), (st.res[k] || 0) + c[k] * 0.4);
  }

  function capOf(st, k) {
    if (k === "gold") return Infinity;
    let c = EH.CFG.BASE_CAP + st.player.level * 60;
    for (const b of st.buildings) if (b.type === "warehouse" && b.done) c += EH.BUILD.warehouse.storage * b.lvl;
    return c;
  }
  function addRes(st, k, v) {
    const cap = capOf(st, k);
    const before = st.res[k] || 0;
    st.res[k] = Math.min(cap, before + v);
    return st.res[k] - before;
  }

  /* ── placement search ──────────────────────────────────────── */
  function findSpot(st, type, near, rad) {
    const B = EH.BUILD[type];
    rad = rad || 9;
    const cands = [];
    for (let r = 0; r <= rad; r++) {
      for (let a = 0; a < 16; a++) {
        const ang = a / 16 * EH.TAU + r * 0.4;
        cands.push({ x: Math.round(near.x + Math.cos(ang) * r), y: Math.round(near.y + Math.sin(ang) * r), r });
      }
    }
    cands.sort((p, q) => p.r - q.r);
    for (const c of cands) if (st.map.canPlace(c.x, c.y, B.w, B.h)) return c;
    for (let y = 3; y < st.map.h - 4; y++) for (let x = 3; x < st.map.w - 4; x++)
      if (st.map.canPlace(x, y, B.w, B.h)) return { x, y };
    return null;
  }

  /* ── construct ─────────────────────────────────────────────── */
  function place(st, type, x, y, instant) {
    const B = EH.BUILD[type]; if (!B) return null;
    if (!st.map.canPlace(x, y, B.w, B.h)) return null;
    if (!instant && !canAfford(st, B.cost)) return null;
    if (!instant) pay(st, B.cost);
    const b = {
      id: EH.uid("b"), type, x, y, w: B.w, h: B.h, lvl: 1,
      done: !!instant, t: instant ? 0 : B.time, tmax: B.time,
      acc: {}, workers: [], hp: 100, builtDay: st.time.day
    };
    st.buildings.push(b);
    st.map.occupy(b);
    st.stats.built++;
    if (type === "torch") st.town.lanterns = (st.town.lanterns || 0) + 1;
    if (!instant) {
      EH.log(`Construction started: <b>${B.n}</b> (${EH.fmtDur(B.time)}).`);
      EH.bus.emit("build:start", b);
    } else {
      EH.log(`<b>${B.n}</b> stands ready.`, "good");
      EH.bus.emit("build:done", b);
    }
    // auto-assign a worker
    assignWorkers(st);
    EH.Quests.checkBuild(st, type);
    return b;
  }

  function upgrade(st, b) {
    if (!b || !b.done || b.lvl >= EH.MAXLVL) return false;
    const cost = costOf(b.type, b.lvl + 1);
    if (!canAfford(st, cost)) return false;
    pay(st, cost);
    b.done = false; b.t = EH.BUILD[b.type].time * (0.6 + b.lvl * 0.35); b.tmax = b.t; b.lvl++;
    EH.log(`Upgrading <b>${EH.BUILD[b.type].n}</b> to level ${b.lvl}.`);
    return true;
  }
  function demolish(st, b) {
    const i = st.buildings.indexOf(b); if (i < 0) return false;
    st.map.vacate(b); st.buildings.splice(i, 1); refund(st, b);
    for (const n of st.npcs) { if (n.home === b.id) n.home = null; if (n.work === b.id) { n.work = null; n.act = null; } }
    EH.log(`${EH.BUILD[b.type].n} demolished. 40% of materials recovered.`);
    return true;
  }
  function repair(st, b) {
    if (b.hp >= 100) return false;
    const need = Math.round((100 - b.hp) * 0.4);
    if (!canAfford(st, { wood: need, gold: need })) return false;
    pay(st, { wood: need, gold: need }); b.hp = 100;
    EH.log(`${EH.BUILD[b.type].n} repaired.`, "good");
    return true;
  }

  /* ── worker assignment ─────────────────────────────────────── */
  /* ══════════════════════════════════════════════════════════════
     FR-05 §5.1 — CAPACITY, NOT JOB-LOCKS
     No building requires any particular job. Every facility has a capacity
     (BUILD[type].workers) and any living adult may fill any free slot. A
     villager whose job *matches* still works better, so placement is an
     optimisation with a ceiling rather than a hard requirement — which is what
     removes the double-gate deadlock (PRD §11.2).

     This rewrite also fixes a latent bug: the previous version cleared
     b.workers but never cleared n.work, and then skipped any villager whose
     n.work still resolved — so a *second* call left every building unstaffed.
     ══════════════════════════════════════════════════════════════ */
  const JOB_FOR = { farm: "farmer", lumber: "lumberjack", quarry: "quarrier", mine: "miner", forge: "blacksmith", market: "merchant", tavern: "bard", chapel: "healer", barracks: "guard", kennel: "wrangler", library: "scholar" };

  function capacityOf(b) { const B = EH.BUILD[b.type]; return (B && B.workers) || 0; }
  function assignable(n) { return !!n && !n.dead && !n.away && n.job !== "elder" && n.job !== "child"; }
  function matchBonus(b, n) {
    if (!n) return 1;
    const want = JOB_FOR[b.type];
    return (want && n.job === want) ? EH.CFG.MATCH_BONUS : 1;
  }

  function assignWorkers(st) {
    for (const b of st.buildings) b.workers = [];
    for (const n of st.npcs) n.work = null;
    /* pass 1 — job-matched villagers take first pick of their own trade */
    for (const n of st.npcs) {
      if (!assignable(n)) continue;
      const want = Object.keys(JOB_FOR).find(k => JOB_FOR[k] === n.job);
      if (!want) continue;
      const b = st.buildings.find(x => x.type === want && x.done && x.workers.length < capacityOf(x));
      if (b) { b.workers.push(n.id); n.work = b.id; }
    }
    /* pass 2 — ANY remaining adult fills ANY free slot, regardless of job */
    for (const b of st.buildings) {
      if (!b.done) continue;
      const cap = capacityOf(b);
      while (cap && b.workers.length < cap) {
        const free = st.npcs.find(n => assignable(n) && !n.work);
        if (!free) break;
        b.workers.push(free.id); free.work = b.id;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     FR-06 §5.2 — SHAPED DECORATION FOOTPRINTS
     A decoration buffs ONLY the tiles it physically touches, and the shape is
     directional: single (whole perimeter), line (one face), L (two faces at a
     corner), cross (the centre tile of each face). Deliberately stricter than
     Kairosoft's "8 surrounding tiles" so decoration is a spatial puzzle.
     ══════════════════════════════════════════════════════════════ */
  function faceTiles(b, d) {
    const t = [];
    if (d === "n") for (let x = b.x; x < b.x + b.w; x++) t.push({ x, y: b.y - 1 });
    if (d === "s") for (let x = b.x; x < b.x + b.w; x++) t.push({ x, y: b.y + b.h });
    if (d === "w") for (let y = b.y; y < b.y + b.h; y++) t.push({ x: b.x - 1, y });
    if (d === "e") for (let y = b.y; y < b.y + b.h; y++) t.push({ x: b.x + b.w, y });
    return t;
  }
  function perimeterTiles(b) {
    const t = [];
    for (let x = b.x - 1; x <= b.x + b.w; x++) { t.push({ x, y: b.y - 1 }); t.push({ x, y: b.y + b.h }); }
    for (let y = b.y; y < b.y + b.h; y++) { t.push({ x: b.x - 1, y }); t.push({ x: b.x + b.w, y }); }
    return t;
  }
  function crossTiles(b) {
    const mx = b.x + Math.floor(b.w / 2), my = b.y + Math.floor(b.h / 2);
    return [{ x: mx, y: b.y - 1 }, { x: mx, y: b.y + b.h }, { x: b.x - 1, y: my }, { x: b.x + b.w, y: my }];
  }
  function touchTiles(b) {
    const D = EH.BUILD[b.type] && EH.BUILD[b.type].decor;
    const shape = (D && D.shape) || "single", dir = (D && D.dir) || "s";
    if (shape === "line") return faceTiles(b, dir.length === 2 ? dir[0] : dir);
    if (shape === "L") {
      /* a compound dir such as "nw" names the two faces that meet at a corner;
         a single dir falls back to that face plus its perpendicular.        */
      if (dir.length === 2) return faceTiles(b, dir[0]).concat(faceTiles(b, dir[1]));
      const second = (dir === "n" || dir === "s") ? "w" : "n";
      return faceTiles(b, dir).concat(faceTiles(b, second));
    }
    if (shape === "cross") return crossTiles(b);
    return perimeterTiles(b);
  }
  function covers(b, tiles) {
    for (const t of tiles) if (t.x >= b.x && t.x < b.x + b.w && t.y >= b.y && t.y < b.y + b.h) return true;
    return false;
  }
  /* every decoration whose footprint physically touches b */
  function adjacencyOf(st, b) {
    const mul = {}; const src = [];
    for (const d of st.buildings) {
      if (!d.done || d.id === b.id) continue;
      const D = EH.BUILD[d.type];
      if (!D || D.cat !== "decoration" || !D.decor) continue;
      if (!covers(b, touchTiles(d))) continue;
      src.push(D.n);
      for (const k in D.decor.mul) mul[k] = (mul[k] || 1) * D.decor.mul[k];
    }
    for (const k in mul) mul[k] = Math.min(mul[k], EH.CFG.ADJ_CAP);
    return { mul, src };
  }
  /* FR-07 §5.3 — adjacency combos. Two buildings touching = a named bonus.
     These cost no dungeon materials, which is the escape valve for §11.2. */
  function combosOf(st, b) {
    const out = [];
    for (const C of EH.COMBOS) {
      if (b.type !== C.a && b.type !== C.b) continue;
      const other = b.type === C.a ? C.b : C.a;
      const hit = st.buildings.some(o => o.done && o.id !== b.id && o.type === other &&
        covers(o, perimeterTiles(b)) || (o.done && o.id !== b.id && o.type === other && covers(b, perimeterTiles(o))));
      if (hit) out.push(C);
    }
    return out;
  }
  function bonusMul(st, b, res, cache) {
    let e = cache && cache.get(b.id);
    if (!e) { e = { adj: adjacencyOf(st, b), comb: combosOf(st, b) }; if (cache) cache.set(b.id, e); }
    let m = 1;
    if (e.adj.mul[res]) m *= e.adj.mul[res];
    for (const c of e.comb) if (c.mul[res]) m *= c.mul[res];
    return EH.clamp(m, 1, EH.CFG.COMBO_CAP);
  }
  function moraleBonus(st, b, cache) {
    let e = cache && cache.get(b.id);
    if (!e) { e = { adj: adjacencyOf(st, b), comb: combosOf(st, b) }; if (cache) cache.set(b.id, e); }
    let m = 1;
    if (e.adj.mul.morale) m *= e.adj.mul.morale;
    for (const c of e.comb) if (c.mul.morale) m *= c.mul.morale;
    return m;
  }
  function workersOf(st, b) {
    return b.workers.map(id => st.npcs.find(n => n.id === id)).filter(n => n && !n.dead);
  }
  function efficiency(st, b) {
    const B = EH.BUILD[b.type];
    const slots = B.workers || 0;
    const ws = workersOf(st, b);
    let e = slots ? (ws.length / slots) : 1;
    if (!slots) e = 0.35;
    e = EH.lerp(0.35, 1, EH.clamp(e, 0, 1));
    if (ws.length) {
      /* FR-05 job-match bonus — matching is an optimisation, never a requirement */
      e *= ws.reduce((a, n) => a + matchBonus(b, n), 0) / ws.length;
      /* D14 §6.5 — adventurers still work at home, but at a reduced rate */
      e *= ws.reduce((a, n) => a + (n.adventurer ? EH.CFG.ADV_WORK_MUL : 1), 0) / ws.length;
      const mood = ws.reduce((a, n) => a + n.needs.mood, 0) / ws.length;
      const hunger = ws.reduce((a, n) => a + n.needs.hunger, 0) / ws.length;
      e *= EH.lerp(0.75, 1.3, mood / 100) * EH.lerp(1.0, 0.72, hunger / 100);
      for (const n of ws) if (n.traits.includes("hardy")) e *= 1.1; else if (n.traits.includes("lazy")) e *= 0.88;
    }
    /* §10.5 downtime — a building knocked offline by a raid produces nothing */
    if (b.offline > 0) return 0;
    // pets assigned as workers
    for (const p of st.pets) if (p.role === "worker" && p.assign === b.id && p.active) e *= 1.12;
    /* NOTE: the old "well boosts any farm within 8 tiles" rule was removed.
       It contradicted §5.2 (decorations buff ONLY tiles they physically touch)
       and double-dipped with adjacencyOf(). Wells now buff via their cross
       footprint, which is stricter, legible and shown in the tooltip.      */
    e *= EH.Town.morale(st) / 62;
    return EH.clamp(e, 0.2, 1.6);
  }

  /* ── tick: construction + production ───────────────────────── */
  function update(st, dt) {
    const rs = EH.Items.researchFx(st);
    const season = EH.SEASONS[st.time.season];
    const W = EH.WEATHER[st.weather] || EH.WEATHER.clear;
    const night = EH.isNight(st.time.hourF);
    const rates = { gold: 0, wood: 0, stone: 0, food: 0, ore: 0 };

    const bcache = new Map();   // per-frame adjacency/combo cache
    for (const b of st.buildings) {
      const B = EH.BUILD[b.type];
      if (b.offline > 0) b.offline = Math.max(0, b.offline - st.dtMin);
      if (!b.done) {
        // villagers build faster if someone is on site
        const builder = workersOf(st, b).length || (st.npcs.some(n => !n.dead && n.act && n.act.kind === "work") ? 1 : 0);
        b.t -= dt * (1 + builder * 0.5) * st.speed;
        if (b.t <= 0) {
          b.done = true; b.t = 0;
          EH.log(`<b>${B.n}</b> finished.`, "good");
          EH.toast(B.n + " complete");
          EH.bus.emit("build:done", b);
          assignWorkers(st);
          EH.Quests.checkBuild(st, b.type);
        }
        continue;
      }
      if (!B.prod) continue;
      const eff = efficiency(st, b) * Math.pow(1.6, b.lvl - 1) * (b.hp / 100);
      for (const k in B.prod) {
        /* FR-06/FR-07 — shaped decoration adjacency + named combos */
        let v = B.prod[k] * eff * bonusMul(st, b, k, bcache);
        if (B.day && night) v = 0;
        if (b.type === "farm") { v *= season.grow; if (W.part === "rain") v *= 1.25; if (st.weather === "storm") v *= 0.8; v *= 1 + (rs.prodFood || 0); }
        if (b.type === "mine") v *= 1 + (rs.prodOre || 0);
        if (b.type === "quarry" && st.weather === "storm") v *= 0.7;
        b.acc[k] = (b.acc[k] || 0) + v * st.dtMin;
        rates[k] += v;
        while (b.acc[k] >= 1) {
          const whole = Math.floor(b.acc[k]);
          b.acc[k] -= whole;
          addRes(st, k, whole);
          st.stats.produced[k] = (st.stats.produced[k] || 0) + whole;
          if (EH.chance(0.10) && k !== "gold") EH.Float.world(b.x + b.w / 2, b.y + b.h / 2, "+" + whole + " " + k, "gold");
        }
      }
    }
    st.town.rates = rates;
    // passive gold from the market itself (foot traffic)
    const mk = count(st, "market");
    if (mk && !night) {
      const g = mk * 0.05 * (1 + EH.Town.morale(st) / 200) * (1 + (rs.goldMul || 0));
      st.res.gold += g * st.dtMin;
      rates.gold += g;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     STARTER TOWN LAYOUT
     ══════════════════════════════════════════════════════════════ */
  function setupTown(st) {
    const m = st.map, C = Math.floor(m.w / 2);
    st.town.plaza = { x: C, y: C };
    st.buildings = [];
    const put = (type, x, y, lvl, instant) => {
      const B = EH.BUILD[type];
      let px = x, py = y;
      if (!m.canPlace(px, py, B.w, B.h)) {
        const s = findSpot(st, type, { x, y }, 7);
        if (!s) return null;
        px = s.x; py = s.y;
      }
      const b = place(st, type, px, py, true);
      if (b) { b.lvl = lvl || 1; }
      return b;
    };
    const keep = put("house", C - 7, C + 5, 2);       // the Warden's house
    if (keep) keep.name = "Warden's House";
    const cottage = put("house", C - 9, C + 2, 1);
    const farm = put("farm", C + 5, C + 6, 1);
    const lumber = put("lumber", C - 11, C - 2, 1);
    const market = put("market", C + 3, C - 6, 1);
    const tavern = put("tavern", C - 6, C - 6, 1);
    const well = put("well", C + 1, C + 4, 1);
    const forge = put("forge", C + 7, C + 1, 1);
    const chapel = put("chapel", C - 4, C + 9, 1);

    // homes & workplaces for the authored villagers
    st.town.homes = {
      bram: keep && keep.id, mara: cottage && cottage.id, dorn: cottage && cottage.id,
      pip: tavern && tavern.id, lira: chapel && chapel.id, rowan: keep && keep.id,
      sylvie: tavern && tavern.id, wren: cottage && cottage.id, tobin: tavern && tavern.id,
      jessa: cottage && cottage.id,
    };
    st.town.works = {
      farmer: farm && farm.id, blacksmith: forge && forge.id, merchant: market && market.id,
      bard: tavern && tavern.id, healer: chapel && chapel.id, elder: null,
      guard: null, wrangler: null, scholar: null, child: null,
    };
    st.town.starter = [keep, cottage, farm, lumber, market, tavern, well, forge, chapel].filter(Boolean).map(b => b.id);

    // market stall positions for merchant NPCs
    for (const b of allOf(st, "market")) {
      const v = st.npcs.find(n => n.job === "merchant" && !n.stall);
      if (v) { v.stall = { x: b.x, y: b.y + b.h }; v.work = b.id; }
    }
    assignWorkers(st);
    return st.buildings;
  }

  return {
    get, firstOf, allOf, count, at, centre, costOf, canAfford, affordText, pay, refund,
    findSpot, place, upgrade, demolish, repair, assignWorkers, workersOf, efficiency,
    update, setupTown, capOf, addRes,
    /* FR-05/06/07 — §5.1 capacity, §5.2 shaped adjacency, §5.3 combos */
    capacityOf, assignable, matchBonus, faceTiles, perimeterTiles, crossTiles,
    touchTiles, covers, adjacencyOf, combosOf, bonusMul, moraleBonus, JOB_FOR
  };
})();
