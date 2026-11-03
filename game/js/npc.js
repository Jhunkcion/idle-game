/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — npc.js : the living town.
   Schedules, needs, relationships, N↔N trade simulation, dialogue,
   NPC-initiated interaction with the player.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;

/* ══════════════════════════════════════════════════════════════
   SHARED MOVEMENT (used by NPCs, companions, pets, player)
   ══════════════════════════════════════════════════════════════ */
EH.Mover = {
  setPath(e, map, tx, ty, opt) {
    opt = opt || {};
    const p = EH.findPath(map, e.x, e.y, tx, ty, { allowAdjacent: opt.adjacent, fly: opt.fly, maxNodes: opt.nodes });
    if (!p) { e.path = []; return false; }
    e.path = EH.smoothPath(map, p, opt.fly);
    e.goal = { x: tx, y: ty };
    return true;
  },
  tick(e, map, dt, speed, opt) {
    opt = opt || {};
    e.moving = false;
    if (!e.path || !e.path.length) { if (opt.idle) opt.idle(e); return false; }
    const nxt = e.path[0];
    let dx = nxt.x - e.x, dy = nxt.y - e.y;
    const d = Math.hypot(dx, dy);
    const step = speed * dt;
    if (d <= step || d < 0.001) {
      e.x = nxt.x; e.y = nxt.y; e.path.shift();
      if (!e.path.length) { e.moving = false; if (opt.arrive) opt.arrive(e); return true; }
    } else {
      e.x += dx / d * step; e.y += dy / d * step; e.moving = true;
    }
    if (e.moving) {
      // iso-facing: which screen direction are we heading?
      const sx = (dx - dy), sy = (dx + dy) * 0.5;
      e.dir = Math.abs(sy) > Math.abs(sx) ? (sy > 0 ? "front" : "back") : "side";
      e.flip = sx < 0;
      e.anim = (e.anim || 0) + dt * 7;
    }
    return e.moving;
  }
};

/* ══════════════════════════════════════════════════════════════
   HAND-AUTHORED VILLAGERS
   ══════════════════════════════════════════════════════════════ */
EH.NPCDEF = [
  { id: "bram", n: "Bram Ashdown", job: "elder", sex: "m", age: 62, traits: ["gruff", "pious"],
    look: { skin: "#d49a72", hair: "#c8c0b0", cloth: "#5a4a6a", pants: "#3a3a44", beard: true, hat: "wide", hatc: "#4a3a2a" },
    lines: ["The vale was quieter when I was a boy. I do not mean that fondly.", "You have your grandmother's stubbornness. She signed the deed, you know.", "Every warden before you went down those stairs. Only letters came back."],
    role: "Elder of Emberhold", questHub: true },
  { id: "mara", n: "Mara Loam", job: "farmer", sex: "f", age: 38, traits: ["cheerful", "hardy"],
    look: { skin: "#e8b48c", hair: "#a8742f", cloth: "#4a7a4a", pants: "#5a4a3a", hat: "wide", hatc: "#c8a05a", long: true },
    lines: ["Wheat's coming in fine — rain helped.", "Mind the crows. They've learned to fear nothing.", "I bake too much. Take some, would you?"],
    role: "Farmer", sells: ["bread", "wheat", "herb", "stew"] },
  { id: "dorn", n: "Dorn Ironhand", job: "blacksmith", sex: "m", age: 47, traits: ["gruff", "brave"],
    look: { skin: "#b87a52", hair: "#3a2a1a", cloth: "#6a4a3a", pants: "#2f2f38", beard: true, weapon: "hammer" },
    lines: ["Steel doesn't argue. That's why I prefer it.", "Bring me ore and I'll bring you an edge.", "Your blade's notched. Again."],
    role: "Blacksmith", svc: "craft" },
  { id: "pip", n: "Pip Kettleblack", job: "merchant", sex: "m", age: 31, traits: ["greedy", "nosy"],
    look: { skin: "#f0c8a0", hair: "#6a4a28", cloth: "#8c6a3a", pants: "#4a3a2a", hat: "cap", hatc: "#a8382a" },
    lines: ["Everything's for sale. Most things, anyway.", "I hear things. Coin loosens tongues, not just purses.", "For you? A discount. A small one."],
    role: "Merchant", svc: "shop" },
  { id: "lira", n: "Lira Winterbourne", job: "healer", sex: "f", age: 29, traits: ["pious", "generous"],
    look: { skin: "#e8b48c", hair: "#2a2a34", cloth: "#d8d2c0", pants: "#5a5a6a", long: true, hat: "hood", hatc: "#e8dcc0" },
    lines: ["Sit. Breathe. Let me see that arm.", "I hear the deep singing on quiet nights. I do not go near the crack.", "Take a potion. No — take two."],
    role: "Healer", svc: "heal", sells: ["potion_s", "potion_m", "herb", "elixir_str"] },
  { id: "rowan", n: "Rowan Greystone", job: "guard", sex: "m", age: 35, traits: ["brave", "gruff"],
    look: { skin: "#d49a72", hair: "#3a2a1a", cloth: "#4a5f7a", pants: "#2f2f38", helmet: true, helmetc: "#9aa0a8", weapon: "sword", plume: "#a8382a" },
    lines: ["Warden. The night watch reports nothing. That worries me more than something would.", "Give the word and my guards march with you into the Hollowdeep.", "Keep your shield up. Everything down there bites."],
    role: "Guard Captain", svc: "guards" },
  { id: "sylvie", n: "Sylvie Thistle", job: "bard", sex: "f", age: 24, traits: ["cheerful", "nosy"],
    look: { skin: "#f0c8a0", hair: "#8a3a2a", cloth: "#7a3a5a", pants: "#4a3a2a", long: true, hat: "cap", hatc: "#c8a04a" },
    lines: ["I'm writing a ballad about you. It's mostly rhyming 'Warden' with 'garden'.", "The tavern's loud tonight. Good loud.", "Songs keep the dark at the edges. That's not poetry, that's engineering."],
    role: "Bard", nightOwl: true },
  { id: "wren", n: "Wren Underhill", job: "wrangler", sex: "f", age: 41, traits: ["hardy", "cheerful"],
    look: { skin: "#b87a52", hair: "#4a3a5a", cloth: "#6a5a3a", pants: "#3a3a2a", hat: "hood", hatc: "#7a6a4a" },
    lines: ["Eggs. Don't ask me where. Ask me what hatches.", "A fed beast is a loyal beast. A hungry one is a fast one — away from you.", "That drake egg? Warm as a coal. It likes you already."],
    role: "Beast Wrangler", svc: "pets", sells: ["egg", "petfood"] },
  { id: "tobin", n: "Old Tobin", job: "scholar", sex: "m", age: 71, traits: ["nosy", "lazy"],
    look: { skin: "#d49a72", hair: "#c8c0b0", cloth: "#4a4a5a", pants: "#3a3a44", beard: true, hat: "pointy", hatc: "#3a3a5a" },
    lines: ["I have read every ledger this hold ever kept. The numbers stop on day four thousand and twelve.", "They didn't dig too deep. They dug toward something. There's a difference.", "Ale first, cosmology second."],
    role: "Scholar", svc: "research" },
  { id: "jessa", n: "Jessa Nettle", job: "child", sex: "f", age: 9, traits: ["cheerful", "nosy"],
    look: { skin: "#f0c8a0", hair: "#d8b050", cloth: "#c86a5a", pants: "#5a4a3a", long: true },
    lines: ["Are you really the Warden? You're shorter than the last one.", "I found a shiny stone by the crack. Mama took it away.", "Can I come to the dungeon? No? Worth asking."],
    role: "Village child", wanderer: true },
];

/* ══════════════════════════════════════════════════════════════
   NPC FACTORY
   ══════════════════════════════════════════════════════════════ */
EH.NPCs = (function () {

  function makeLook(r, sex) {
    const A = EH.Art;
    return {
      skin: r.pick(A.SKIN), hair: r.pick(A.HAIR), cloth: r.pick(A.CLOTH), pants: r.pick(A.PANTS),
      hat: r.chance(0.45) ? r.pick(["cap", "wide", "hood"]) : null,
      hatc: r.pick(A.CLOTH), long: sex === "f" && r.chance(0.6), beard: sex === "m" && r.chance(0.3),
      weapon: r.chance(0.3) ? r.pick(["basket", "mug", "lantern", "pick"]) : null,
    };
  }

  function baseStats(job, level, r) {
    const s = { str: 5, dex: 5, int: 5, vit: 5, per: 5, lck: 5 };
    const t = EH.JOB_TRAIN[job] || EH.JOB_TRAIN.villager;
    for (const k in t.base) s[k] = (s[k] || 0) + t.base[k];
    for (const k in s) s[k] += r.int(0, 2) + Math.floor((level || 1) * 0.5);
    return s;
  }

  /* ══════════════════════════════════════════════════════════════
     FR-11 §6.1 — JOB TRAINING
     Working a job grows the stats that job demands. `grow` is points per GAME
     DAY, so the rate is tied to the §10.5 clock. Villagers who are not working
     still train slowly, faster at a vacation building (§6.2 — the second
     training path, and what makes the leisure category load-bearing).
     ══════════════════════════════════════════════════════════════ */
  function atVacation(st, n) {
    const k = n.act && n.act.kind;
    if (k === "tavern" || k === "chapel") return true;
    for (const b of st.buildings) {
      const B = EH.BUILD[b.type];
      if (!b.done || !B || B.cat !== "vacation") continue;
      if (n.x >= b.x - 1 && n.x <= b.x + b.w && n.y >= b.y - 1 && n.y <= b.y + b.h) return true;
    }
    return false;
  }
  function trainRate(st, n) {
    if (n.downed > 0) return 0;                                   // incapacitated learns nothing
    if (n.work && n.act && n.act.kind === "work") return 1;        // on the job: full rate
    return atVacation(st, n) ? EH.CFG.LEISURE_TRAIN : EH.CFG.IDLE_TRAIN;
  }
  function trainTick(st) {
    const dayFrac = (st.dtMin || 0) / EH.CFG.MIN_PER_DAY;
    if (!(dayFrac > 0)) return;
    for (const n of st.npcs) {
      if (n.dead || !n.stats) continue;
      /* §10.5 — sample the downed state BEFORE decaying it. Otherwise a tick
         long enough to clear the timer would also train through it, and a
         one-day tick would let an incapacitated villager learn a full day.  */
      const wasDowned = n.downed > 0;
      if (wasDowned) n.downed = Math.max(0, n.downed - (st.dtMin || 0));
      const t = EH.JOB_TRAIN[n.job];
      if (!t || !t.grow) continue;
      if (wasDowned) continue;
      const mul = trainRate(st, n);
      if (mul <= 0) continue;
      for (const k in t.grow) {
        n.stats[k] = Math.min(EH.CFG.STAT_CAP, (n.stats[k] || 0) + t.grow[k] * dayFrac * mul);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     FR-13 §6.5 — RECRUITMENT
     Player-initiated, stat-gated, free class choice *within what the villager's
     stats allow*. Base building sets the menu; the player makes the choice.
     ══════════════════════════════════════════════════════════════ */
  function classOptions(n) {
    const out = [];
    for (const cid in EH.CLASS) {
      const C = EH.CLASS[cid];
      if (!C.req) continue;                     // classes with no req are player-only
      const missing = [];
      for (const k in C.req) {
        const have = (n.stats && n.stats[k]) || 0;
        if (have < C.req[k]) missing.push({ k, need: C.req[k], have: Math.floor(have * 10) / 10, short: Math.ceil((C.req[k] - have) * 10) / 10 });
      }
      out.push({ cls: cid, n: C.n, ok: missing.length === 0, missing });
    }
    return out;
  }
  function bestClass(n) {
    const ok = classOptions(n).filter(o => o.ok);
    return ok.length ? ok : null;
  }
  function recruit(st, id, cid) {
    const n = byId(st, id);
    if (!n) return { ok: false, why: "no such villager" };
    if (n.dead) return { ok: false, why: "dead" };
    if (n.job === "child") return { ok: false, why: "too young" };
    if (n.adventurer) return { ok: false, why: "already an adventurer" };
    const C = EH.CLASS[cid];
    if (!C || !C.req) return { ok: false, why: "no such recruitable class" };
    for (const k in C.req) {
      const have = (n.stats && n.stats[k]) || 0;
      /* P5 — the UI must always be able to say *why* the answer was no */
      if (have < C.req[k]) return { ok: false, why: `needs ${EH.STATNAME[k] || k} ${C.req[k]} (has ${Math.floor(have * 10) / 10})` };
    }
    n.adventurer = { cls: cid, level: 1, xp: 0 };
    n.role = C.n;
    EH.log(`<b>${n.name}</b> takes up the ${C.n}'s oath. The ${EH.JOB_TRAIN[n.job] ? n.job : "village"} loses a hand.`, "good");
    EH.bus.emit("npc:recruit", { npc: n, cls: cid });
    if (EH.Build && EH.Build.assignWorkers) EH.Build.assignWorkers(st);   // §5.1 capacity re-seat
    return { ok: true, npc: n, cls: cid };
  }
  function retire(st, id) {
    const n = byId(st, id);
    if (!n || !n.adventurer) return { ok: false, why: "not an adventurer" };
    n.adventurer = null; n.role = "Villager";
    EH.log(`<b>${n.name}</b> hangs up the gear and goes back to the ${n.job}.`);
    EH.bus.emit("npc:retire", n);
    if (EH.Build && EH.Build.assignWorkers) EH.Build.assignWorkers(st);
    return { ok: true };
  }
  function adventurers(st) { return st.npcs.filter(n => !n.dead && n.adventurer); }

  function create(def, st) {
    const r = EH.RNG((def.id || def.n || "").split("").reduce((a, c) => a + c.charCodeAt(0), 7) + st.seed);
    const npc = {
      id: def.id || EH.uid("npc"),
      name: def.n || (r.pick(def.sex === "f" ? EH.NAMES_F : EH.NAMES_M) + " " + r.pick(EH.NAMES_LAST)),
      job: def.job || "villager", role: def.role || "Villager",
      sex: def.sex || (r.chance(0.5) ? "m" : "f"),
      age: def.age || r.int(18, 66),
      traits: def.traits || r.shuffle(EH.TRAITS).slice(0, 2).map(t => t.k),
      look: def.look || makeLook(r, def.sex),
      lines: def.lines || [],
      home: def.home || null, work: def.work || null,
      gold: def.gold !== undefined ? def.gold : r.int(14, 70),
      inv: [], level: def.level || r.int(1, 4),
      /* FR-11 §6.1 — a villager's job grows the stats it physically demands.
         These stats are what gate adventurer recruitment (§6.5), which is why
         base building determines the army you can field.                    */
      stats: def.stats || baseStats(def.job || "villager", def.level || r.int(1, 4), r),
      adventurer: null,        // { cls, level, xp } once recruited — else null
      downed: 0,               // §10.5 game-minutes of incapacity remaining
      away: false,             // on expedition / at an outpost — cannot work home
      needs: { energy: r.range(50, 100), hunger: r.range(10, 55), social: r.range(30, 80), mood: r.range(45, 85) },
      rel: {}, relP: def.relP !== undefined ? def.relP : 0,
      x: st.map.spawn.x + r.range(-2, 2), y: st.map.spawn.y + r.range(-2, 2),
      dir: "front", flip: false, anim: 0, path: [], inside: false,
      act: null, actT: 0, wait: 0, bubble: null, bubbleT: 0,
      svc: def.svc || null, sells: def.sells || null, questHub: !!def.questHub,
      nightOwl: !!def.nightOwl, wanderer: !!def.wanderer,
      stall: null, stock: [], talkCount: 0, tradeCount: 0, wants: null,
      memory: [], greetDone: false,
    };
    npc.inv.push({ id: "bread", qty: r.int(1, 3) });
    return npc;
  }

  function spawnStarter(st) {
    st.npcs = [];
    for (const def of EH.NPCDEF) {
      const n = create(def, st);
      // assign home/work from placed starter buildings
      n.home = st.town.homes[def.id] || null;
      n.work = st.town.works[def.job] || st.town.works[def.id] || null;
      st.npcs.push(n);
    }
    // a few extra generated villagers
    for (let i = 0; i < 3; i++) st.npcs.push(create({ sex: EH.chance(0.5) ? "m" : "f", job: "villager" }, st));
    for (const n of st.npcs) { if (!n.home) n.home = EH.Build.firstOf(st, "house") || EH.Build.firstOf(st, "tavern"); }
    st.town.lastHour = -1;
  }

  function byId(st, id) { return st.npcs.find(n => n.id === id); }
  function byName(st, name) { return st.npcs.find(n => n.name === name); }
  function at(st, x, y, rad) {
    rad = rad || 1.6; let best = null, bd = rad * rad;
    for (const n of st.npcs) { if (n.inside) continue; const d = EH.dist2(n.x, n.y, x, y); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  function alive(st) { return st.npcs.filter(n => !n.dead); }
  function vendors(st) { return st.npcs.filter(n => n.svc === "shop" || n.job === "merchant" || n.sells); }

  /* ── relationships ─────────────────────────────────────────── */
  function rel(npc, otherId, delta, st) {
    if (npc.id === otherId) return;
    npc.rel[otherId] = EH.clamp((npc.rel[otherId] || 0) + delta, -100, 100);
  }
  function relBetween(a, b) { return ((a.rel[b.id] || 0) + (b.rel[a.id] || 0)) / 2; }
  function relTier(v) {
    return v <= -60 ? { n: "Enemy", c: "#e05a4a" } : v <= -20 ? { n: "Dislike", c: "#c88a5a" } :
      v < 20 ? { n: "Neutral", c: "#a89880" } : v < 50 ? { n: "Friendly", c: "#7ec850" } :
        v < 80 ? { n: "Close", c: "#4f8fe0" } : { n: "Devoted", c: "#e0933a" };
  }
  function relPlayer(npc) { return relTier(npc.relP); }
  function addRelP(npc, v, st, reason) {
    const before = npc.relP;
    npc.relP = EH.clamp(npc.relP + v, -100, 100);
    if (relTier(before).n !== relTier(npc.relP).n) {
      EH.log(`${npc.name} now regards you as <b>${relTier(npc.relP).n}</b>.`, "story");
      EH.toast(`${npc.name}: ${relTier(npc.relP).n}`);
    }
  }

  /* ── speech bubbles ────────────────────────────────────────── */
  function say(npc, text, dur) {
    npc.bubble = text; npc.bubbleT = dur || 3.4;
    EH.bus.emit("bubble", npc);
  }
  function remember(npc, text) {
    npc.memory.unshift({ t: text, day: EH.S.time.day, h: EH.S.time.hour });
    if (npc.memory.length > 12) npc.memory.pop();
  }

  /* ── schedules ─────────────────────────────────────────────── */
  function dest(npc, kind, st) {
    const map = st.map;
    if (kind === "home") {
      const b = npc.home ? EH.Build.get(st, npc.home) : null;
      if (b) return map.doorTile(b, npc.x, npc.y);
      return st.town.plaza;
    }
    if (kind === "work") {
      const b = npc.work ? EH.Build.get(st, npc.work) : null;
      if (b) {
        if (b.type === "farm") { // stand in the field
          return { x: b.x + 1, y: b.y + b.h + 1 > map.h - 2 ? b.y - 1 : b.y + b.h };
        }
        if (b.type === "market" && npc.stall) return npc.stall;
        return map.doorTile(b, st.town.plaza.x, st.town.plaza.y);
      }
      return st.town.plaza;
    }
    if (kind === "tavern") { const b = EH.Build.firstOf(st, "tavern"); return b ? map.doorTile(b, npc.x, npc.y) : st.town.plaza; }
    if (kind === "market") { const b = EH.Build.firstOf(st, "market"); return b ? map.doorTile(b, npc.x, npc.y) : st.town.plaza; }
    if (kind === "chapel") { const b = EH.Build.firstOf(st, "chapel"); return b ? map.doorTile(b, npc.x, npc.y) : st.town.plaza; }
    if (kind === "plaza") return { x: st.town.plaza.x + EH.randint(-2, 2), y: st.town.plaza.y + EH.randint(-2, 2) };
    return null;
  }

  function plan(npc, st) {
    const h = st.time.hourF;
    const night = EH.isNight(h);
    let kind = "wander", dur = 60;
    if (npc.job === "child") {
      kind = night ? "home" : (h >= 9 && h < 15 ? "plaza" : "home");
      dur = 40;
    } else if (npc.nightOwl) {
      if (h >= 2 && h < 9) kind = "home";
      else if (h >= 18 || h < 2) kind = "tavern";
      else kind = "wander";
      dur = 50;
    } else if (night) {
      // guards patrol at night; everyone else sleeps
      kind = (npc.job === "guard" && (st.time.day % 2 === (npc.id.charCodeAt(0) % 2))) ? "patrol" : "home";
      dur = 90;
    } else if (h < 7) kind = "home";
    else if (h < 12) kind = npc.work ? "work" : "wander";
    else if (h < 13.2) kind = "lunch";
    else if (h < 18) kind = npc.work ? "work" : "wander";
    else if (h < 20.5) kind = EH.chance(0.55) ? "tavern" : "social";
    else kind = "home";
    if (npc.needs.energy < 18 && !night) kind = "home";
    if (npc.needs.hunger > 78 && kind !== "home") kind = "lunch";
    if (npc.traits.includes("pious") && EH.chance(0.05) && !night) kind = "chapel";

    const d = kind === "wander" ? { x: EH.clamp(Math.round(npc.x + EH.randint(-7, 7)), 2, st.map.w - 3), y: EH.clamp(Math.round(npc.y + EH.randint(-7, 7)), 2, st.map.h - 3) }
      : kind === "patrol" ? { x: EH.clamp(st.town.plaza.x + EH.randint(-9, 9), 2, st.map.w - 3), y: EH.clamp(st.town.plaza.y + EH.randint(-9, 9), 2, st.map.h - 3) }
        : kind === "social" ? dest(npc, "plaza", st) : dest(npc, kind === "lunch" ? "market" : kind, st);

    npc.act = { kind, t: 0, dur, dest: d };
    npc.inside = false;
    if (!d || !st.map.inb(d.x, d.y) || !st.map.walk(d.x, d.y)) {
      const alt = st.map.randomFree();
      d.x = alt.x; d.y = alt.y;
    }
    EH.Mover.setPath(npc, st.map, d.x, d.y, { adjacent: true });
    // merchant goes behind their stall
    if (kind === "work" && npc.stall) EH.Mover.setPath(npc, st.map, npc.stall.x, npc.stall.y, { adjacent: true });
  }

  /* ── per-frame update ──────────────────────────────────────── */
  function update(npc, st, dt) {
    if (npc.dead) return;
    const map = st.map;
    if (map.kind !== "town") { npc.inside = true; return; }
    npc.inside = false;
    if (!npc.act) plan(npc, st);
    const a = npc.act; a.t += st.dtMin;

    if (a.kind === "home") {
      // walk to the door then go inside
      if (!npc.path.length && EH.dist(npc.x, npc.y, a.dest ? a.dest.x : npc.x, a.dest ? a.dest.y : npc.y) < 2.2) {
        npc.inside = true;
        npc.needs.energy = Math.min(100, npc.needs.energy + st.dtMin * (EH.isNight(st.time.hourF) ? 9 : 4));
      }
    } else if (a.kind === "work") {
      const b = npc.work ? EH.Build.get(st, npc.work) : null;
      if (b) b.workedBy = npc.id;
      if (npc.traits.includes("hardy")) npc.needs.energy -= st.dtMin * 0.12;
    } else if (a.kind === "lunch") {
      if (!npc.path.length && !a.ate) { eat(npc, st); a.ate = true; }
    } else if (a.kind === "social" || a.kind === "tavern") {
      npc.needs.social = Math.min(100, npc.needs.social + st.dtMin * 2.4);
      npc.needs.mood = Math.min(100, npc.needs.mood + st.dtMin * (a.kind === "tavern" ? 1.6 : 0.9));
      if (a.kind === "tavern" && EH.Build.firstOf(st, "tavern")) npc.needs.energy -= st.dtMin * 0.2;
    } else if (a.kind === "patrol") {
      npc.needs.energy -= st.dtMin * 0.3;
    }

    // needs decay — tuned so a villager needs roughly one meal, one night's
    // sleep and one good chat per in-game day (not one of each per hour)
    if (!npc.inside) npc.needs.energy = EH.clamp(npc.needs.energy - st.dtMin * 0.035, 0, 100);
    npc.needs.hunger = EH.clamp(npc.needs.hunger + st.dtMin * 0.055, 0, 100);
    npc.needs.social = EH.clamp(npc.needs.social - st.dtMin * 0.05, 0, 100);
    const comfort = EH.Town.morale(st);
    npc.needs.mood = EH.clamp(npc.needs.mood + st.dtMin * ((comfort - 50) / 90 - (npc.needs.hunger > 80 ? 0.5 : 0) - (npc.needs.energy < 20 ? 0.4 : 0)), 0, 100);

    // movement
    EH.Mover.tick(npc, map, dt, EH.CFG.NPC_SPD * (npc.job === "child" ? 1.25 : npc.needs.mood > 65 ? 1.08 : 1), {
      arrive: () => { npc.wait = EH.rand(1.2, 4.5); }
    });
    if (npc.wait > 0) { npc.wait -= dt; }

    // re-plan
    if (a.t >= a.dur || (a.dest && EH.dist(npc.x, npc.y, a.dest.x, a.dest.y) < 1.2 && a.t > a.dur * 0.4 && a.kind === "wander")) {
      if (a.kind !== "home" && a.kind !== "work" && a.kind !== "patrol" || a.t >= a.dur) plan(npc, st);
      else if (a.t >= a.dur) plan(npc, st);
    }
    if (a.kind === "home" && npc.inside && st.time.hourF >= 6.2 && st.time.hourF < 22) plan(npc, st);

    // ambient chatter + N↔N social
    npc.bubbleT = Math.max(0, npc.bubbleT - dt);
    if (npc.bubbleT <= 0) npc.bubble = null;
    if (!npc.inside && EH.chance(dt * 0.06)) socialTick(npc, st);

    // NPC approaches the player with news / a request
    if (!npc.inside && st.map.kind === "town") {
      const p = st.player;
      const d = EH.dist(npc.x, npc.y, p.x, p.y);
      if (d < 12) {
        if (!npc.greetDone && d < 4.5 && npc.relP > -10) { npc.greetDone = true; if (EH.chance(0.5)) say(npc, EH.pick(EH.GREET.day)); }
        if (npc.quest && npc.quest.state === "ready" && d < 2.4 && !npc.questPing) {
          npc.questPing = 3.5; say(npc, "You've done it! Come, let me see.");
        }
      }
      if (st.time.day > 1 && !npc.greetDone && d < 3) npc.greetDone = true;
    }
    if (npc.questPing > 0) npc.questPing -= dt;
  }

  function eat(npc, st) {
    const b = EH.Build.firstOf(st, "market") || EH.Build.firstOf(st, "tavern");
    npc.needs.hunger = Math.max(0, npc.needs.hunger - 65);
    npc.needs.mood = EH.clamp(npc.needs.mood + 6, 0, 100);
    if (b) {
      const cost = 6;
      if (npc.gold >= cost) {
        npc.gold -= cost;
        const owner = EH.NPCs.vendors(st)[0];
        if (owner && owner.id !== npc.id) { owner.gold += Math.round(cost * 0.9); st.res.gold += cost * taxRate(st); }
      }
    }
    if (EH.chance(0.18)) EH.log(`<span class="t">${EH.fmtTime(st.time.minute)}</span> ${npc.name} bought a meal at the ${b ? EH.BUILD[b.type].n.toLowerCase() : "plaza"}.`);
  }

  function socialTick(npc, st) {
    let other = null, bd = 2.2 * 2.2;
    for (const o of st.npcs) {
      if (o === npc || o.inside || o.dead) continue;
      const d = EH.dist2(npc.x, npc.y, o.x, o.y);
      if (d < bd) { bd = d; other = o; }
    }
    if (other) {
      const r = relBetween(npc, other);
      const delta = npc.needs.mood > 55 ? EH.rand(0.4, 1.6) : EH.rand(-0.6, 0.9);
      rel(npc, other.id, delta, st); rel(other, npc.id, delta, st);
      npc.needs.social = EH.clamp(npc.needs.social + 7, 0, 100);
      other.needs.social = EH.clamp(other.needs.social + 7, 0, 100);
      if (EH.chance(0.34)) {
        const topic = EH.pick(EH.GOSSIP);
        say(npc, EH.chance(0.5) ? topic.charAt(0).toUpperCase() + topic.slice(1) : `${other.name.split(" ")[0]} ${topic}`);
        if (EH.chance(0.3)) EH.log(`<span class="t">${EH.fmtTime(st.time.minute)}</span> ${npc.name} ${topic}`);
      }
      npc.wait = Math.max(npc.wait, 1.6); other.wait = Math.max(other.wait, 1.6);
      return;
    }
    // alone: mutter
    if (EH.chance(0.22)) {
      const pool = npc.act && npc.act.kind === "work" ? workMutter(npc) : EH.GREET[EH.isNight(st.time.hourF) ? "night" : "day"];
      say(npc, EH.pick(pool));
    }
  }
  function workMutter(npc) {
    const J = {
      farmer: ["Back-breaking work.", "Rain'd be welcome.", "These turnips won't dig themselves.", "Good soil this year."],
      blacksmith: ["Hot work.", "Needs more ore.", "Steady hands, steady steel.", "Another blade for the Warden."],
      merchant: ["Buy something, would you?", "Fresh stock, fresh coin.", "I could do with a bigger stall.", "Trade's slow today."],
      guard: ["Stay sharp.", "Quiet shift. Too quiet.", "Something's moving in the treeline.", "For the hold!"],
      healer: ["Herbs are drying nicely.", "Rest is also medicine.", "The chapel is cold at night.", "Let me bind that."],
      bard: ["La la— no, that's wrong.", "A verse about the deep, perhaps.", "This lute needs a new string.", "Everyone loves a hero's song."],
      wrangler: ["Easy now, easy.", "That one's got teeth.", "Good beast. Good beast!", "Eggs need warmth, not noise."],
      scholar: ["Fascinating. Alarming. Both.", "The numbers don't add up.", "Day four thousand and twelve...", "Ink first, theories second."],
      elder: ["This hold will outlast us all.", "I remember when the road ended here.", "Duty, Warden. Duty."],
      child: ["Wheee!", "I'm helping!", "Can I have a sweet?", "Look at me! Look!"],
    };
    return J[npc.job] || ["Hmm.", "Right then.", "Another day."];
  }

  /* ════════════════════════════════════════════════════════════
     HOURLY SIMULATION — needs, wages, and the N↔N market economy
     ════════════════════════════════════════════════════════════ */
  function taxRate(st) { return EH.CFG.TAX + (EH.Items.researchFx(st).tax || 0) + (EH.Town.morale(st) - 50) / 900; }

  function hourly(st) {
    const hour = st.time.hour;
    if (st.town.lastHour === hour) return;
    st.town.lastHour = hour;
    let trades = 0, taxGold = 0;
    const open = EH.isShopOpen(st.time.hourF);
    const vendorList = vendors(st).filter(v => open || v.job === "merchant");
    const supply = EH.Town.supply(st);

    for (const npc of st.npcs) {
      if (npc.dead) continue;
      if (npc.act && npc.act.kind === "home" && npc.inside) continue;
      // ── decide what this NPC wants to buy ──
      let wantId = null, wantQty = 1;
      if (npc.needs.hunger > 45) { wantId = EH.chance(0.7) ? "bread" : "stew"; wantQty = EH.chance(0.4) ? 2 : 1; }
      else if (npc.job === "blacksmith" && EH.chance(0.4)) wantId = "ironbar";
      else if (npc.job === "healer" && EH.chance(0.45)) wantId = "herb";
      else if (npc.job === "wrangler" && EH.chance(0.3)) wantId = "petfood";
      else if (npc.job === "bard" && EH.chance(0.3)) wantId = "stew";
      else if (EH.chance(0.10)) wantId = EH.pick(["herb", "bread", "pelt", "wheat"]);
      else if (EH.chance(0.06)) wantId = "potion_s";
      if (!wantId) continue;

      const def = EH.CONSUM.find(c => c.id === wantId) || EH.MATS.find(c => c.id === wantId);
      if (!def) continue;
      // ── pick a vendor (not themselves), prefer someone they like ──
      const cands = vendorList.filter(v => v.id !== npc.id);
      if (!cands.length) continue;
      cands.sort((a, b) => (npc.rel[b.id] || 0) - (npc.rel[a.id] || 0));
      const v = EH.chance(0.7) ? cands[0] : EH.pick(cands);

      // ── price: base × vendor personality × supply/demand × relationship discount ──
      const greedy = v.traits.includes("greedy") ? 1.16 : v.traits.includes("generous") ? 0.86 : 1;
      const friendDisc = 1 - Math.max(0, (npc.rel[v.id] || 0)) / 400;    // up to -25%
      const sd = supply[wantId] !== undefined ? EH.clamp(1.35 - supply[wantId] * 0.06, 0.7, 1.6) : 1;
      const unit = Math.max(1, Math.round(def.price * greedy * friendDisc * sd * (1 + st.time.day * 0.004)));
      const total = unit * wantQty;
      if (npc.gold < total) {
        if (npc.gold < unit) continue;
        wantQty = Math.floor(npc.gold / unit);
      }
      const cost = unit * wantQty;
      // ── execute the trade ──
      npc.gold -= cost;
      v.gold += Math.round(cost * (1 - taxRate(st)));
      const tax = cost * taxRate(st);
      st.res.gold += tax; taxGold += tax; st.town.taxTotal = (st.town.taxTotal || 0) + tax;
      st.town.demand[wantId] = (st.town.demand[wantId] || 0) + wantQty;
      const e = st.invNpc.find(x => x.id === wantId); if (e) e.qty = Math.max(0, e.qty - wantQty);
      const has = npc.inv.find(x => x.id === wantId);
      if (has) has.qty += wantQty; else npc.inv.push({ id: wantId, qty: wantQty });
      rel(npc, v.id, EH.rand(0.8, 2.4), st); rel(v, npc.id, EH.rand(0.4, 1.4), st);
      npc.needs.mood = EH.clamp(npc.needs.mood + 1.5, 0, 100);
      trades++; npc.tradeCount++; v.tradeCount++;
      st.stats.trades++;
      if (EH.chance(0.42)) {
        EH.log(`<span class="t">${EH.fmtTime(st.time.minute)}</span> ${npc.name} bought ${EH.plural(wantQty, def.n.replace(/s$/, ""))} from ${v.name} for ${EH.fmt(cost)}g <span class="gold">(+${tax.toFixed(1)}g tax)</span>`);
      }
      if (EH.chance(0.25) && !npc.inside) say(npc, EH.pick(["Pleasure doing business.", "Fair price.", "Too dear, but I needed it.", "Ta.", "Cheers."]), 2.6);
      if (v.gold > 400 && EH.chance(0.05)) EH.log(`${v.name} is getting rich. Consider a bigger stall.`, "good");
    }

    // ── wages, consumption, mood drift ──
    if (hour === 7) dailyTick(st);

    // ── relationship events between NPCs ──
    if (EH.chance(0.35)) npcEvent(st);

    if (trades) st.town.lastTrades = trades;
    return { trades, taxGold };
  }

  function npcEvent(st) {
    const a = EH.pick(st.npcs), b = EH.pick(st.npcs);
    if (!a || !b || a === b) return;
    const r = relBetween(a, b);
    const roll = EH.rng();
    if (r < -25 && roll < 0.5) {
      rel(a, b.id, -EH.rand(2, 7), st); rel(b, a.id, -EH.rand(2, 7), st);
      EH.log(`${a.name} argued with ${b.name} in the square. (-relationship)`, "bad");
      if (!a.inside) say(a, EH.pick(["Unbelievable.", "I've had enough of you.", "Typical."]));
    } else if (r > 40 && roll < 0.5) {
      rel(a, b.id, EH.rand(2, 6), st); rel(b, a.id, EH.rand(2, 6), st);
      const gift = EH.pick(["bread", "herb", "pelt"]);
      const def = EH.CONSUM.find(c => c.id === gift) || EH.MATS.find(c => c.id === gift);
      EH.log(`${a.name} gave ${b.name} ${def.n.toLowerCase()}. (+relationship)`, "good");
      if (!a.inside) say(a, "For you. Don't mention it.");
    } else if (roll < 0.18) {
      EH.log(`${a.name} and ${b.name} were seen walking to the ${EH.pick(["tavern", "chapel", "well", "market"])} together.`);
      rel(a, b.id, EH.rand(0.5, 2), st);
    }
  }

  function dailyTick(st) {
    const pop = st.npcs.filter(n => !n.dead).length;
    const wages = EH.CFG.WAGE_PER_DAY * pop * (1 + st.time.day * 0.01);
    const paid = Math.min(st.res.gold, wages);
    st.res.gold -= paid;
    for (const n of st.npcs) {
      if (paid >= wages) n.gold += EH.CFG.WAGE_PER_DAY;
      n.needs.hunger = EH.clamp(n.needs.hunger + 12, 0, 100);
      // food consumption
      const has = n.inv.find(x => x.id === "bread" || x.id === "stew");
      if (has) { has.qty--; if (has.qty <= 0) n.inv = n.inv.filter(e => e !== has); n.needs.hunger = Math.max(0, n.needs.hunger - 30); }
      else n.needs.mood = EH.clamp(n.needs.mood - 5, 0, 100);
      n.greetDone = false;
    }
    EH.log(`<b>Day ${st.time.day}.</b> Wages paid: ${EH.fmt(paid)}g to ${pop} villagers.`, "gold");
    if (paid < wages - 0.5) { EH.log("You couldn't cover everyone's wages. Morale suffers.", "bad"); for (const n of st.npcs) { n.needs.mood = EH.clamp(n.needs.mood - 8, 0, 100); addRelP(n, -1, st); } }
    st.town.supplySnapshot = EH.Town.supply(st);
  }

  /* ════════════════════════════════════════════════════════════
     DIALOGUE
     ════════════════════════════════════════════════════════════ */
  function greeting(npc, st) {
    const h = st.time.hourF, W = st.weather;
    const r = npc.relP, mood = npc.needs.mood;
    const pool = [];
    if (!npc.talkCount) pool.push(...EH.GREET.first);
    pool.push(...EH.GREET[EH.isNight(h) ? "night" : "day"]);
    if (W === "rain" || W === "storm") pool.push(...EH.GREET.rain, ...EH.GREET.rain);
    if (mood > 70 || r > 50) pool.push(...EH.GREET.happy, ...EH.GREET.happy);
    if (mood < 30 || r < -20) pool.push(...EH.GREET.sad, ...EH.GREET.sad);
    if (npc.job === "child") pool.push("Are you going down the stairs? Can I come? Please?");
    if (r > 70) pool.push(`I'd follow you into the dark, Warden. And I don't say that lightly.`);
    if (npc.lines.length && EH.chance(0.42)) pool.push(...npc.lines);
    if (st.dungeon.maxFloor >= 5 && EH.chance(0.2)) pool.push(`Floor five. They say the King sits there. They say he's still crowned.`);
    npc.talkCount++;
    return EH.pick(pool);
  }

  function options(npc, st) {
    const o = [];
    if (npc.quest) {
      if (npc.quest.state === "offered") o.push({ k: "quest", label: `"${npc.quest.title}" — tell me more.`, act: "accept" });
      else if (npc.quest.state === "active") o.push({ k: "quest", label: `About "${npc.quest.title}"...`, act: "progress" });
      else if (npc.quest.state === "ready") o.push({ k: "quest", label: `I've done it. "${npc.quest.title}".`, act: "complete" });
    } else if (npc.questHub || npc.relP > 15 || EH.chance(0.5)) {
      o.push({ k: "quest", label: "Any work that needs doing?", act: "request" });
    }
    if (npc.sells || npc.svc === "shop") o.push({ k: "shop", label: "Let's trade.", act: "shop" });
    if (npc.svc === "craft" && EH.Build.firstOf(st, "forge")) o.push({ k: "shop", label: "Use the forge.", act: "craft" });
    if (npc.svc === "heal") o.push({ k: "shop", label: "Heal me. (free)", act: "heal" }, { k: "shop", label: "Buy potions.", act: "healshop" });
    if (npc.svc === "guards") o.push({ k: "shop", label: "Hire companions.", act: "hire" });
    if (npc.svc === "pets") o.push({ k: "shop", label: "Show me the beasts.", act: "pets" });
    if (npc.svc === "research") o.push({ k: "shop", label: "What have you learned?", act: "research" });
    if (npc.svc === "tavern" || npc.job === "bard") o.push({ k: "shop", label: "Buy a round. (30g, +morale)", act: "round" });
    o.push({ k: "talk", label: "Just talking.", act: "chat" });
    if (npc.relP >= 20) o.push({ k: "talk", label: "Give a gift.", act: "gift" });
    if (npc.job === "guard" && npc.relP >= 30) o.push({ k: "talk", label: "March with me.", act: "companion" });
    o.push({ k: "close", label: "Farewell.", act: "close" });
    return o;
  }

  return { create, spawnStarter, byId, byName, at, alive, vendors, rel, relBetween, relTier, relPlayer, addRelP, say, remember, plan, update, hourly, taxRate, dailyTick, greeting, options, socialTick, workMutter, makeLook, eat,
    /* FR-11 job training + FR-13 recruitment (PRD §6.1, §6.5) */
    baseStats, trainTick, trainRate, atVacation, classOptions, bestClass, recruit, retire, adventurers };
})();

/* ══════════════════════════════════════════════════════════════
   TOWN-LEVEL QUERIES
   ══════════════════════════════════════════════════════════════ */
EH.Town = {
  morale(st) {
    let m = 50;
    m += EH.Build.count(st, "tavern") * 6 + EH.Build.count(st, "chapel") * 5 + EH.Build.count(st, "well") * 4;
    m += EH.Build.count(st, "market") * 3;
    const housed = st.npcs.filter(n => n.home && EH.Build.get(st, n.home)).length;
    m += (housed / Math.max(1, st.npcs.length)) * 14 - 8;
    if (st.res.food > 40) m += 6; if (st.res.food < 10) m -= 12;
    m += (st.player.level - 1) * 0.6;
    m += st.town.lanterns ? st.town.lanterns * 1.5 : 0;
    const avgMood = st.npcs.length ? st.npcs.reduce((a, n) => a + n.needs.mood, 0) / st.npcs.length : 50;
    m = EH.lerp(m, avgMood, 0.45);
    return EH.clamp(Math.round(m), 0, 100);
  },
  /* how much of each good the town holds — drives prices */
  supply(st) {
    const s = {};
    for (const n of st.npcs) for (const e of n.inv) s[e.id] = (s[e.id] || 0) + e.qty;
    for (const e of st.invNpc) s[e.id] = (s[e.id] || 0) + e.qty;
    return s;
  },
  price(st, def, npc) {
    const sup = EH.Town.supply(st);
    const sd = sup[def.id] !== undefined ? EH.clamp(1.35 - sup[def.id] * 0.06, 0.72, 1.55) : 1;
    const disc = npc ? 1 - Math.max(0, npc.relP) / 400 : 1;
    const pers = npc ? (npc.traits.includes("greedy") ? 1.14 : npc.traits.includes("generous") ? 0.88 : 1) : 1;
    return Math.max(1, Math.round(def.price * sd * disc * pers * (1 + st.time.day * 0.004)));
  },
  popCap(st) {
    let c = 3;
    for (const b of st.buildings) if (b.type === "house" && b.done) c += EH.BUILD.house.pop * b.lvl;
    if (EH.Build.firstOf(st, "tavern")) c += 1;
    return c;
  },
  defense(st) {
    let d = 0;
    for (const b of st.buildings) { if (!b.done) continue; const B = EH.BUILD[b.type]; if (B.defense) d += B.defense * b.lvl; }
    d += st.npcs.filter(n => n.job === "guard").length * 2;
    return Math.round(d);
  },
  tier(st) { return 1 + EH.Build.count(st, "monument"); },
};
