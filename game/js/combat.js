/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — combat.js : monsters, skills, damage, pets, companions
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;

EH.Combat = (function () {

  /* ══════════════════════════════════════════════════════════
     MONSTER FACTORY
     ══════════════════════════════════════════════════════════ */
  function makeMon(def, floor, opt) {
    opt = opt || {};
    const boss = !!opt.boss;
    // Guardians already carry hand-tuned per-floor stats, so they must NOT be
    // multiplied by the generic depth curve as well — that double-dipping made
    // the floor-20 boss take ~21x HP * ~15x armour and become unkillable.
    const sc = boss ? 1 : EH.monScale(floor);
    const dc = boss ? 1 : Math.pow(1.13, floor - 1);
    const night = opt.night ? 1.15 : 1;
    const elite = opt.elite;
    const m = {
      id: EH.uid("m"), mid: def.id, name: def.n, boss, elite: !!elite,
      hpMax: Math.round(def.hp * sc * night * (elite ? 2.6 : 1)),
      atk: def.atk * sc * night * (elite ? 1.5 : 1),
      def: def.def * dc * (elite ? 1.6 : 1),
      spd: def.spd * (elite ? 0.9 : 1), c: def.c, body: def.body,
      xp: Math.round(def.xp * sc * (elite ? 2.2 : 1)), gold: def.gold, drops: def.drops,
      gear: def.gear, legendary: def.legendary, ranged: def.ranged || 0, fly: !!def.fly,
      summon: def.summon, night: def.night,
      x: 0, y: 0, dir: "front", flip: false, anim: 0, frame: 0,
      state: "idle", atkCd: EH.rand(0.4, 1.4), wanderT: 0, home: null, aggro: 0,
      statuses: [], hurtT: 0, lvl: Math.max(1, Math.round(floor * 1.1)),
    };
    m.hp = m.hpMax;
    return m;
  }

  /* ── populate a dungeon floor ──────────────────────────────── */
  function spawnFloor(st) {
    const m = st.dmap, floor = m.floor;
    st.mons = [];
    const r = EH.RNG(st.seed + floor * 31);
    const pool = EH.monsForFloor(floor);
    if (!pool.length) pool.push(EH.MON[0]);
    const night = EH.isNight(st.time.hourF);
    const count = m.isBoss ? 4 + Math.floor(floor / 5) : 7 + Math.floor(floor * 1.25);
    const rooms = m.rooms.slice(1);
    for (let i = 0; i < count; i++) {
      const rm = rooms.length ? r.pick(rooms) : null;
      let x, y, tries = 0;
      do {
        x = rm ? r.int(rm.x, rm.x + rm.w - 1) : r.int(2, m.w - 3);
        y = rm ? r.int(rm.y, rm.y + rm.h - 1) : r.int(2, m.h - 3);
      } while ((!m.walk(x, y) || EH.dist(x, y, m.entrance.x, m.entrance.y) < 4) && tries++ < 60);
      if (tries > 55) continue;
      const def = r.pick(pool);
      if (def.night && !night && !r.chance(0.25)) continue;
      const mon = makeMon(def, floor, { night, elite: r.chance(0.07 + floor * 0.004) });
      mon.x = x; mon.y = y; mon.home = { x, y };
      st.mons.push(mon);
    }
    // boss
    if (m.isBoss) {
      const bd = EH.bossForFloor(floor);
      if (!bd) { m.bossDead = true; m.isBoss = false; }   // safety: never bar the stairs
      if (bd) {
        const boss = makeMon(bd, floor, { boss: true });
        // find standable ground in the guardian's chamber, near the stairs
        let bx = m.stairs.x, by = m.stairs.y, found = false;
        for (let rad = 1; rad <= 6 && !found; rad++) {
          for (let dy = -rad; dy <= rad && !found; dy++) for (let dx = -rad; dx <= rad && !found; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
            if (m.walk(m.stairs.x + dx, m.stairs.y + dy)) { bx = m.stairs.x + dx; by = m.stairs.y + dy; found = true; }
          }
        }
        boss.x = bx; boss.y = by;
        boss.home = { x: boss.x, y: boss.y };
        boss.name = bd.n;
        st.mons.push(boss);
        st.dmap.bossId = boss.id;
      }
    }
    // ambient spawns scale with depth
    st.dmap.spawned = true;
  }

  /* ══════════════════════════════════════════════════════════
     DAMAGE
     ══════════════════════════════════════════════════════════ */
  function mitigate(raw, def) { return Math.max(1, raw * (110 / (110 + def * 1.9))); }

  function hurtMon(mon, raw, st, opt) {
    opt = opt || {};
    const D = st.derived;
    let dmg = mitigate(raw, mon.def);
    let crit = false;
    if (opt.crit !== undefined) crit = opt.crit;
    else crit = EH.chance(D.crit / 100);
    if (crit) dmg *= D.critdmg / 100;
    dmg = Math.max(1, Math.round(dmg));
    mon.hp -= dmg;
    mon.hurtT = 0.18;
    mon.state = "chase"; mon.target = "player"; mon.aggro = 12;
    EH.Float.world(mon.x, mon.y - 0.4, (crit ? "" : "") + dmg, crit ? "crit" : "dmg");
    if (crit && EH.chance(0.5)) EH.Float.world(mon.x, mon.y - 0.8, "CRIT", "crit");
    if (D.leech > 0) {
      const heal = Math.round(dmg * D.leech / 100);
      if (heal > 0) healPlayer(st, heal, true);
    }
    if (D.burn > 0) addStatus(mon, "burn", D.burn, 4, st);
    if (mon.hp <= 0) killMon(mon, st, opt);
    return dmg;
  }

  function killMon(mon, st, opt) {
    if (mon.dead) return;
    mon.dead = true;
    const i = st.mons.indexOf(mon); if (i >= 0) st.mons.splice(i, 1);
    const D = st.derived;
    const sc = EH.monScale(st.dmap.floor);
    let gold = Math.round(EH.randint(mon.gold[0], mon.gold[1]) * sc * D.goldfind * (mon.boss ? 1.5 : 1));
    st.res.gold += gold;
    st.stats.goldEarned += gold;
    st.stats.kills++;
    EH.Float.world(mon.x, mon.y - 0.3, "+" + EH.fmt(gold) + "g", "gold");
    const xp = Math.round(mon.xp * D.xpgain);
    gainXp(st, xp);
    EH.Float.world(mon.x, mon.y - 0.7, "+" + EH.fmt(xp) + " xp", "xp");
    // drops
    const loot = EH.Items.lootFor(Object.assign({}, mon, { boss: mon.boss }), st.dmap.floor, st);
    for (const it of loot.items) {
      const added = EH.Items.add(st.player.inv, it, st.player.cap);
      if (!added) { EH.log("Your pack is full — " + it.name + " was left behind.", "bad"); continue; }
      const cls = it.eq ? "r-" + it.rar : "";
      const rar = it.eq ? EH.RARITY.find(r => r.k === it.rar) : null;
      EH.log(`Looted <b class="${cls}">${it.name}</b>${added === true ? "" : ""}`, rar && rar.aff >= 2 ? (it.rar === "legendary" ? "epic" : "loot") : "");
      EH.Float.world(mon.x, mon.y - 0.9, it.name, it.rar === "legendary" ? "crit" : "loot");
      if (it.rar === "legendary") { EH.toast("LEGENDARY: " + it.name); st.stats.legendary++; }
      st.stats.itemsFound++;
    }
    if (mon.boss) {
      EH.log(`<b class="epic">${mon.name} has fallen!</b> The way deeper is open.`, "epic");
      EH.toast(mon.name + " SLAIN");
      st.dmap.bossDead = true;
      st.dungeon.bossesKilled = (st.dungeon.bossesKilled || 0) + 1;
      EH.Quests.progress(st, "boss", mon.name, 1);
      for (const n of st.npcs) EH.NPCs.addRelP(n, 3, st);
    }
    EH.Quests.progress(st, "slay", mon.mid, 1);
    EH.Quests.progress(st, "slay", mon.name, 1);
    EH.bus.emit("kill", mon);
    // summon on death
    if (mon.summon && EH.chance(0.3) && st.mons.length < 40) {
      const def = EH.monById(mon.summon);
      if (def) { const s = makeMon(def, st.dmap.floor, {}); s.x = mon.x; s.y = mon.y; s.home = { x: s.x, y: s.y }; st.mons.push(s); }
    }
  }

  function addStatus(e, kind, val, dur, st) {
    const ex = e.statuses.find(s => s.k === kind);
    if (ex) { ex.t = Math.max(ex.t, dur); ex.v = Math.max(ex.v, val); return; }
    e.statuses.push({ k: kind, v: val, t: dur });
  }
  function tickStatuses(e, st, dt, isPlayer) {
    if (!e.statuses) e.statuses = [];
    for (let i = e.statuses.length - 1; i >= 0; i--) {
      const s = e.statuses[i];
      s.t -= dt;
      if (s.k === "burn" || s.k === "poison" || s.k === "bleed") {
        s.acc = (s.acc || 0) + dt;
        if (s.acc >= 1) {
          s.acc -= 1;
          const d = Math.max(1, Math.round(s.v));
          if (isPlayer) { st.player.hp -= d; EH.Float.world(st.player.x, st.player.y - 0.5, d, "dmg"); }
          else { e.hp -= d; e.hurtT = 0.12; EH.Float.world(e.x, e.y - 0.4, d, "dmg"); if (e.hp <= 0) killMon(e, st, {}); }
        }
      }
      if (s.t <= 0) e.statuses.splice(i, 1);
    }
  }
  const stunned = e => e.statuses.some(s => s.k === "stun" && s.t > 0);
  const rooted = e => e.statuses.some(s => s.k === "root" && s.t > 0);

  /* ══════════════════════════════════════════════════════════
     PLAYER
     ══════════════════════════════════════════════════════════ */
  function healPlayer(st, amt, quiet) {
    const p = st.player;
    const before = p.hp;
    p.hp = Math.min(st.derived.hpMax, p.hp + amt);
    if (!quiet && p.hp - before > 0.5) EH.Float.world(p.x, p.y - 0.5, "+" + Math.round(p.hp - before), "heal");
    return p.hp - before;
  }
  function hurtPlayer(st, raw, src) {
    const p = st.player, D = st.derived;
    if (EH.chance(D.dodge / 100)) { EH.Float.world(p.x, p.y - 0.6, "MISS", "heal"); return 0; }
    let dmg = mitigate(raw, D.def);
    if (D.dmgReduce) dmg *= 1 - D.dmgReduce / 100;
    if (p.guard && p.guard.t > 0) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg;
    p.hurtT = 0.2;
    EH.Float.world(p.x, p.y - 0.5, dmg, "dmg");
    EH.shake(3);
    if (p.hp <= 0) playerDown(st, src);
    return dmg;
  }
  function playerDown(st, src) {
    const p = st.player;
    p.hp = 0;
    const lost = Math.round(st.res.gold * 0.10);
    st.res.gold -= lost;
    EH.log(`<b class="bad">You have fallen${src ? " to " + src.name : ""}.</b> The guards drag you home. You lose ${EH.fmt(lost)} gold and your descent.`, "bad");
    EH.toast("YOU DIED");
    st.stats.deaths++;
    p.hp = Math.max(1, Math.round(st.derived.hpMax * 0.4));
    exitDungeon(st, true);
    for (const c of st.companions) c.hp = Math.max(1, c.hpMax * 0.3);
    for (const pet of st.pets) if (pet.hp !== undefined) pet.hp = Math.max(1, pet.hpMax * 0.4);
  }

  function gainXp(st, amt) {
    const p = st.player;
    p.xp += amt;
    st.stats.xp += amt;
    let ups = 0;
    while (p.xp >= EH.xpFor(p.level)) { p.xp -= EH.xpFor(p.level); p.level++; ups++; }
    if (ups) {
      p.ptsLeft += 5 * ups;
      st.derived = EH.Items.derive(p, st);
      p.hp = st.derived.hpMax;
      p.cap += 4 * ups;
      EH.log(`<b class="gold">LEVEL UP!</b> You are now level ${p.level}. +${5 * ups} stat points.`, "gold");
      EH.toast("LEVEL " + p.level);
      EH.flashLevel();
      EH.bus.emit("levelup", p.level);
      // class advancement notifications
      const C = EH.CLASS[p.cls];
      const job = C.jobs.filter(j => j.lvl <= p.level).pop();
      if (job && job.n !== p.jobName) {
        p.jobName = job.n;
        EH.log(`<b class="epic">You have advanced: ${job.n}.</b>`, "epic");
        EH.toast("ADVANCED: " + job.n);
      }
      EH.Quests.checkLevel(st, p.level);
    }
  }

  /* ── attack ────────────────────────────────────────────────── */
  function nearestMon(st, x, y, maxD) {
    let best = null, bd = (maxD || 99) * (maxD || 99);
    for (const m of st.mons) {
      if (m.dead) continue;
      const d = EH.dist2(m.x, m.y, x, y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }
  function playerAttack(st, mon, opt) {
    opt = opt || {};
    const p = st.player, D = st.derived;
    if (!mon || mon.dead) return 0;
    const raw = D.atk * (opt.mul || 1);
    const crit = opt.crit !== undefined ? opt.crit : undefined;
    const d = hurtMon(mon, raw, st, { crit });
    p.atkAnim = 0.22; p.atkDir = { x: EH.sign(mon.x - p.x), y: EH.sign(mon.y - p.y) };
    EH.shake(opt.big ? 5 : 2);
    return d;
  }

  /* ── skills ────────────────────────────────────────────────── */
  const SKILLS = {
    cleave(st) {
      const p = st.player; let n = 0;
      for (const m of st.mons.slice()) if (EH.dist(m.x, m.y, p.x, p.y) < 2.2) { playerAttack(st, m, { mul: 1.3, big: true }); n++; }
      if (!n) EH.Float.world(p.x, p.y - 1, "nothing in reach", "heal");
      return n > 0;
    },
    bulwark(st) { st.player.guard = { t: 6 }; EH.Float.world(st.player.x, st.player.y - 1, "BULWARK", "heal"); return true; },
    execute(st) {
      const m = st.focus && !st.focus.dead ? st.focus : nearestMon(st, st.player.x, st.player.y, st.derived.atkRange + 0.8);
      if (!m) return false;
      const mul = (m.hp / m.hpMax < 0.25) ? 3 : 1.15;
      playerAttack(st, m, { mul, big: true, crit: mul > 2 });
      return true;
    },
    volley(st) {
      const targets = st.mons.slice().sort((a, b) => EH.dist2(a.x, a.y, st.player.x, st.player.y) - EH.dist2(b.x, b.y, st.player.x, st.player.y)).slice(0, 3);
      if (!targets.length) return false;
      for (const t of targets) playerAttack(st, t, { mul: 0.85 });
      return true;
    },
    trap(st) {
      const m = st.focus && !st.focus.dead ? st.focus : nearestMon(st, st.player.x, st.player.y, 7);
      if (!m) return false;
      addStatus(m, "root", 0, 3, st); EH.Float.world(m.x, m.y - 0.8, "SNARED", "heal"); return true;
    },
    eagle(st) { EH.buff(st, "crit", 45, 5); EH.Float.world(st.player.x, st.player.y - 1, "EAGLE EYE", "crit"); return true; },
    bolt(st) {
      const m = st.focus && !st.focus.dead ? st.focus : nearestMon(st, st.player.x, st.player.y, st.derived.atkRange + 1);
      if (!m) return false;
      playerAttack(st, m, { mul: 1.6 }); addStatus(m, "burn", Math.round(st.derived.atk * 0.25), 4, st); return true;
    },
    burst(st) {
      let n = 0;
      for (const m of st.mons.slice()) if (EH.dist(m.x, m.y, st.player.x, st.player.y) < 3.4) { playerAttack(st, m, { mul: 1.25, big: true }); addStatus(m, "burn", Math.round(st.derived.atk * 0.4), 5, st); n++; }
      EH.shake(6); EH.Part.burst(st.player.x, st.player.y, "#e06a20", 22);
      return n > 0;
    },
    ward(st) { st.player.ward = { v: Math.round(st.derived.hpMax * 0.4), t: 8 }; EH.Float.world(st.player.x, st.player.y - 1, "WARD", "heal"); return true; },
    coinshot(st) {
      if (st.res.gold < 5) { EH.Float.world(st.player.x, st.player.y - 1, "no coin!", "dmg"); return false; }
      st.res.gold -= 5;
      const m = st.focus && !st.focus.dead ? st.focus : nearestMon(st, st.player.x, st.player.y, 6);
      if (!m) { st.res.gold += 5; return false; }
      playerAttack(st, m, { mul: 2.0, crit: true }); EH.Float.world(m.x, m.y - 1.1, "-5g", "gold"); return true;
    },
    appraise(st) { EH.buff(st, "itemfind", 60, 20); EH.Float.world(st.player.x, st.player.y - 1, "APPRAISE", "gold"); return true; },
    bribe(st) {
      const m = st.focus && !st.focus.dead ? st.focus : nearestMon(st, st.player.x, st.player.y, 5);
      if (!m || m.boss) return false;
      const cost = Math.round(m.hpMax * 0.6);
      if (st.res.gold < cost) { EH.Float.world(st.player.x, st.player.y - 1, "needs " + cost + "g", "dmg"); return false; }
      st.res.gold -= cost; m.fleeing = 8; EH.Float.world(m.x, m.y - 0.9, "BRIBED -" + cost + "g", "gold"); return true;
    },
  };
  function useSkill(st, key) {
    const p = st.player;
    const C = EH.CLASS[p.cls];
    const sk = C.skills.find(s => s.k === key);
    if (!sk) return false;
    if (p.level < sk.lvl) { EH.toast("Requires level " + sk.lvl); return false; }
    p.cd = p.cd || {};
    if ((p.cd[key] || 0) > 0) return false;
    const fn = SKILLS[key];
    if (!fn) return false;
    if (!fn(st)) return false;
    p.cd[key] = sk.cd;
    return true;
  }

  /* ══════════════════════════════════════════════════════════
     MONSTER AI
     ══════════════════════════════════════════════════════════ */
  function monUpdate(m, st, dt) {
    if (m.dead) return;
    // the player can die mid-frame, which sends them home and drops st.dmap
    if (!st.dmap || st.map.kind !== "dungeon") return;
    tickStatuses(m, st, dt, false);
    if (m.dead || !st.dmap || st.map.kind !== "dungeon") return;
    m.hurtT = Math.max(0, m.hurtT - dt);
    m.atkCd -= dt;
    m.anim += dt * 6;
    m.frame = Math.floor(m.anim) % 2;
    if (stunned(m)) return;

    const p = st.player;
    const map = st.dmap;
    const vision = 7.5 + (m.boss ? 4 : 0) + (EH.isNight(st.time.hourF) ? 1.5 : 0);
    const d = EH.dist(m.x, m.y, p.x, p.y);

    // pick nearest target among player, companions, pets
    let tx = p.x, ty = p.y, tgt = "player", td = d;
    for (const c of st.companions) {
      if (!c.active || c.hp <= 0) continue;
      const cd = EH.dist(m.x, m.y, c.x, c.y);
      if (cd < td * 0.8) { td = cd; tx = c.x; ty = c.y; tgt = c; }
    }
    for (const pet of st.pets) {
      if (!pet.active || pet.role !== "combat" || pet.hp <= 0) continue;
      const pd = EH.dist(m.x, m.y, pet.x, pet.y);
      if (pd < td * 0.7) { td = pd; tx = pet.x; ty = pet.y; tgt = pet; }
    }

    if (m.fleeing > 0) {
      m.fleeing -= dt;
      const ang = Math.atan2(m.y - p.y, m.x - p.x);
      const nx = EH.clamp(m.x + Math.cos(ang) * m.spd * dt, 1, map.w - 2);
      const ny = EH.clamp(m.y + Math.sin(ang) * m.spd * dt, 1, map.h - 2);
      if (map.walk(Math.round(nx), Math.round(ny), m.fly)) { m.x = nx; m.y = ny; }
      return;
    }
    if (td < vision) { m.state = "chase"; m.aggro = 8; }
    else if (m.aggro > 0) { m.aggro -= dt; }
    else m.state = "idle";

    const reach = m.ranged ? m.ranged : 1.05;
    if (m.state === "chase") {
      if (td > reach) {
        // simple steering with wall slide
        const ang = Math.atan2(ty - m.y, tx - m.x);
        let nx = m.x + Math.cos(ang) * m.spd * dt;
        let ny = m.y + Math.sin(ang) * m.spd * dt;
        if (map.walk(Math.round(nx), Math.round(ny), m.fly)) { m.x = nx; m.y = ny; }
        else if (map.walk(Math.round(nx), Math.round(m.y), m.fly)) m.x = nx;
        else if (map.walk(Math.round(m.x), Math.round(ny), m.fly)) m.y = ny;
        else { // hop around the corner
          const perp = ang + Math.PI / 2 * (m.id.charCodeAt(3) % 2 ? 1 : -1);
          const hx = m.x + Math.cos(perp) * m.spd * dt, hy = m.y + Math.sin(perp) * m.spd * dt;
          if (map.walk(Math.round(hx), Math.round(hy), m.fly)) { m.x = hx; m.y = hy; }
        }
        m.dir = Math.abs(ty - m.y) > Math.abs(tx - m.x) ? (ty > m.y ? "front" : "back") : "side";
        m.flip = tx < m.x;
      } else if (m.atkCd <= 0) {
        m.atkCd = m.boss ? 1.5 : 1.15;
        m.anim = 0;
        if (tgt === "player") hurtPlayer(st, m.atk, m);
        else {
          const def = tgt.def || 0;
          const dmg = Math.max(1, Math.round(mitigate(m.atk, def)));
          tgt.hp -= dmg;
          EH.Float.world(tgt.x, tgt.y - 0.5, dmg, "dmg");
          if (tgt.hp <= 0) {
            tgt.hp = 0;
            if (tgt.isPet) { EH.log(`${tgt.name} was knocked out and limps home.`, "bad"); tgt.active = false; tgt.hp = Math.round(tgt.hpMax * 0.5); }
            else EH.log(`${tgt.name} is down! Lira can revive them at the chapel.`, "bad");
          }
        }
        if (m.summon && EH.chance(0.12) && st.mons.length < 42) {
          const def2 = EH.monById(m.summon);
          if (def2) { const s = makeMon(def2, st.dmap.floor, {}); s.x = m.x + EH.rand(-1, 1); s.y = m.y + EH.rand(-1, 1); s.home = { x: s.x, y: s.y }; st.mons.push(s); }
        }
      }
    } else {
      // idle wander around home
      m.wanderT -= dt;
      if (m.wanderT <= 0) {
        m.wanderT = EH.rand(2.5, 6);
        const ang = EH.rand(0, EH.TAU), rr = EH.rand(0.6, 2.4);
        const nx = m.home ? m.home.x + Math.cos(ang) * rr : m.x, ny = m.home ? m.home.y + Math.sin(ang) * rr : m.y;
        if (map.walk(Math.round(nx), Math.round(ny), m.fly)) { m.wx = nx; m.wy = ny; } else { m.wx = m.x; m.wy = m.y; }
      }
      if (m.wx !== undefined) {
        const dx = m.wx - m.x, dy = m.wy - m.y, dd = Math.hypot(dx, dy);
        if (dd > 0.08) { m.x += dx / dd * m.spd * 0.4 * dt; m.y += dy / dd * m.spd * 0.4 * dt; m.dir = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "front" : "back") : "side"; m.flip = dx < 0; }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     PETS & COMPANIONS
     ══════════════════════════════════════════════════════════ */
  function petUpdate(pet, st, dt) {
    if (!pet.active) return;
    const p = st.player, map = st.map;
    pet.anim = (pet.anim || 0) + dt * 6; pet.frame = Math.floor(pet.anim) % 2;
    const d = EH.dist(pet.x, pet.y, p.x, p.y);
    // follow
    if (d > 1.6) {
      if (!pet.path || !pet.path.length || EH.chance(dt * 0.5)) {
        const ang = Math.atan2(p.y - pet.y, p.x - pet.x);
        pet.tx = EH.clamp(p.x - Math.cos(ang) * 1.2, 0, map.w - 1);
        pet.ty = EH.clamp(p.y - Math.sin(ang) * 1.2, 0, map.h - 1);
      }
      const dx = pet.tx - pet.x, dy = pet.ty - pet.y, dd = Math.hypot(dx, dy);
      if (dd > 0.05) {
        const sp = pet.spd * (d > 5 ? 1.7 : 1) * dt;
        const nx = pet.x + dx / dd * sp, ny = pet.y + dy / dd * sp;
        if (map.walk(Math.round(nx), Math.round(ny), pet.fly) || d > 7) { pet.x = nx; pet.y = ny; }
        pet.dir = Math.abs(dy) > Math.abs(dx) ? (dy > 0 ? "front" : "back") : "side";
        pet.flip = dx < 0;
      }
    }
    // combat pets attack
    if (pet.role === "combat" && st.map.kind === "dungeon") {
      pet.atkCd = (pet.atkCd || 0) - dt;
      const m = nearestMon(st, pet.x, pet.y, 2.2);
      if (m && pet.atkCd <= 0) {
        pet.atkCd = 1.5;
        const dmg = Math.max(1, Math.round(mitigate(pet.atk * st.derived.petdmg, m.def)));
        m.hp -= dmg; m.hurtT = 0.15; m.state = "chase"; m.aggro = 6;
        EH.Float.world(m.x, m.y - 0.3, dmg, "dmg");
        if (m.hp <= 0) killMon(m, st, {});
      }
    }
    // sprite heal
    if (pet.fx && pet.fx.regen) { pet.healAcc = (pet.healAcc || 0) + dt; if (pet.healAcc > 3) { pet.healAcc = 0; healPlayer(st, Math.round(st.derived.hpMax * 0.01 * pet.level * 0.3 + 1)); } }
    // pet xp
    pet.xpAcc = (pet.xpAcc || 0);
  }
  function petGainXp(pet, amt, st) {
    pet.xp += amt;
    while (pet.xp >= EH.petXpFor(pet.level)) {
      pet.xp -= EH.petXpFor(pet.level); pet.level++;
      pet.hpMax = Math.round(pet.baseHp * (1 + pet.level * 0.28) * pet.rarMul);
      pet.atk = Math.round(pet.baseAtk * (1 + pet.level * 0.3) * pet.rarMul);
      pet.hp = pet.hpMax;
      EH.log(`<b>${pet.name}</b> grew to level ${pet.level}!`, "good");
      EH.toast(pet.name + " Lv " + pet.level);
    }
  }

  function compUpdate(c, st, dt) {
    if (!c.active) return;
    const p = st.player, map = st.map;
    c.anim = (c.anim || 0) + dt * 6; c.frame = Math.floor(c.anim) % 2;
    const d = EH.dist(c.x, c.y, p.x, p.y);
    if (d > 1.8) {
      const ang = Math.atan2(p.y - c.y, p.x - c.x);
      const sp = c.spd * (d > 6 ? 1.8 : 1) * dt;
      const nx = c.x + Math.cos(ang) * sp, ny = c.y + Math.sin(ang) * sp;
      if (map.walk(Math.round(nx), Math.round(ny)) || d > 8) { c.x = nx; c.y = ny; }
      c.dir = Math.abs(Math.sin(ang)) > Math.abs(Math.cos(ang)) ? (ang > 0 && ang < Math.PI ? "front" : "back") : "side";
      c.flip = Math.cos(ang) < 0;
    }
    if (map.kind === "dungeon") {
      c.atkCd = (c.atkCd || 0) - dt;
      const m = nearestMon(st, c.x, c.y, 2.0);
      if (m && c.atkCd <= 0 && c.hp > 0) {
        c.atkCd = 1.35;
        const rs = EH.Items.researchFx(st);
        const dmg = Math.max(1, Math.round(mitigate(c.atk * (1 + (rs.compDmg || 0)), m.def)));
        m.hp -= dmg; m.hurtT = 0.15; m.state = "chase"; m.aggro = 6;
        EH.Float.world(m.x, m.y - 0.3, dmg, "dmg");
        if (m.hp <= 0) killMon(m, st, {});
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     PLAYER COMBAT LOOP (auto-attack + auto-explore)
     ══════════════════════════════════════════════════════════ */
  function playerCombat(st, dt) {
    const p = st.player, D = st.derived;
    p.atkCd = (p.atkCd || 0) - dt;
    p.atkAnim = Math.max(0, (p.atkAnim || 0) - dt);
    for (const k in (p.cd || {})) if (p.cd[k] > 0) p.cd[k] = Math.max(0, p.cd[k] - dt);
    if (p.guard) { p.guard.t -= dt; if (p.guard.t <= 0) p.guard = null; }
    if (p.ward) { p.ward.t -= dt; if (p.ward.t <= 0) p.ward = null; }
    tickStatuses(p, st, dt, true);
    // regen
    p.hp = Math.min(D.hpMax, p.hp + D.regen * dt * (st.map.kind === "town" ? 2.4 : 1));

    const focus = (st.focus && !st.focus.dead && EH.dist(st.focus.x, st.focus.y, p.x, p.y) < 20) ? st.focus : null;
    const target = focus || (st.auto ? nearestMon(st, p.x, p.y, 14) : nearestMon(st, p.x, p.y, D.atkRange + 0.35));
    if (target) {
      const d = EH.dist(target.x, target.y, p.x, p.y);
      if (d <= D.atkRange) {
        if (p.atkCd <= 0) { p.atkCd = D.atkCd; playerAttack(st, target, {}); }
      } else if (st.auto) {
        EH.Mover.setPath(p, st.map, Math.round(target.x), Math.round(target.y), { adjacent: true });
      }
    }
  }

  /* ── auto-explore: walk to stairs/chest/nearest monster ────── */
  function autoExplore(st, dt) {
    if (!st.auto) return;
    const p = st.player, m = st.dmap;
    if (!m) return;
    p.autoT = (p.autoT || 0) - dt;
    if (p.path && p.path.length) return;
    if (p.autoT > 0) return;
    p.autoT = 0.6;
    // priorities: boss > unopened chest > nearest monster > stairs.
    // Each candidate is tried in turn so one unreachable goal can never deadlock
    // the auto-explore loop.
    const goals = [];
    if (m.isBoss && !m.bossDead && m.bossId) {
      const b = st.mons.find(x => x.id === m.bossId);
      if (b) goals.push({ x: Math.round(b.x), y: Math.round(b.y) });
    }
    for (const c of m.chests) if (!c.opened) { goals.push({ x: c.x, y: c.y }); break; }
    const mon = nearestMon(st, p.x, p.y, 12);
    if (mon) goals.push({ x: Math.round(mon.x), y: Math.round(mon.y) });
    if (!st.dungeon.stayOnFloor) goals.push({ x: m.stairs.x, y: m.stairs.y });
    for (const g of goals) {
      if (EH.Mover.setPath(p, m, g.x, g.y, { adjacent: true })) break;
    }
  }

  /* ── dungeon transitions ───────────────────────────────────── */
  function enterDungeon(st, floor) {
    st.prevMap = st.map;
    st.dungeon.floor = floor || 1;
    st.dungeon.maxFloor = Math.max(st.dungeon.maxFloor || 1, st.dungeon.floor);
    st.dmap = EH.genDungeon(st.seed, st.dungeon.floor);
    st.map = st.dmap;
    st.player.x = st.dmap.entrance.x; st.player.y = st.dmap.entrance.y;
    st.player.path = [];
    for (const c of st.companions) if (c.active) { c.x = st.player.x + EH.rand(-1, 1); c.y = st.player.y + EH.rand(-1, 1); }
    for (const pet of st.pets) if (pet.active) { pet.x = st.player.x + EH.rand(-1, 1); pet.y = st.player.y + EH.rand(-1, 1); }
    EH.reveal(st.dmap, st.player.x, st.player.y, st.derived.vision);
    spawnFloor(st);
    EH.log(`<b class="story">You descend into the Hollowdeep — floor ${st.dungeon.floor}.</b>${st.dmap.isBoss ? " <b class=\"epic\">Something vast waits here.</b>" : ""}`);
    if (EH.chance(0.4)) EH.log(EH.pick(EH.LORE), "story");
    EH.bus.emit("map:dungeon", st.dungeon.floor);
    EH.Quests.progress(st, "explore", st.dungeon.floor, 0, true);
  }
  function descend(st) {
    if (st.dmap.isBoss && !st.dmap.bossDead) { EH.toast("Slay the guardian first."); return false; }
    const cleared = st.dungeon.floor;
    st.dungeon.cleared = Math.max(st.dungeon.cleared || 0, cleared);
    enterDungeon(st, cleared + 1);
    return true;
  }
  function exitDungeon(st, wounded) {
    st.map = st.townMap || st.prevMap || st.map;
    st.prevMap = st.map;
    st.dmap = null;
    st.mons = [];
    st.auto = false;
    st.focus = null;
    const k = st.map.dungeonPortal;
    st.player.x = k ? k.x + 1 : st.town.plaza.x; st.player.y = k ? k.y + 1 : st.town.plaza.y;
    st.player.path = [];
    for (const c of st.companions) if (c.active) { c.x = st.player.x + EH.rand(-1.5, 1.5); c.y = st.player.y + EH.rand(-1.5, 1.5); }
    for (const pet of st.pets) if (pet.active) { pet.x = st.player.x + EH.rand(-1, 1); pet.y = st.player.y + EH.rand(-1, 1); }
    EH.log(wounded ? "You wake in Emberhold, bruised and lighter of purse." : "You return to the surface. The vale air has never tasted better.", wounded ? "bad" : "good");
    EH.bus.emit("map:town");
    if (EH.UI) EH.UI.syncAll();
  }

  /* ── hire a companion ──────────────────────────────────────── */
  function hire(st, npcId) {
    const n = EH.NPCs.byId(st, npcId); if (!n) return null;
    if (st.companions.find(c => c.id === n.id)) return null;
    const max = 1 + EH.Build.count(st, "barracks");
    if (st.companions.filter(c => c.active).length >= max) { EH.toast("No room in the party (build a Barracks)"); return null; }
    const cost = 60 + n.level * 40;
    if (st.res.gold < cost) { EH.toast("Needs " + cost + " gold"); return null; }
    st.res.gold -= cost;
    const c = {
      id: n.id, name: n.name, look: n.look, job: n.job, level: n.level + Math.floor(st.player.level / 3),
      hpMax: Math.round(60 + n.level * 26 + st.player.level * 12),
      atk: Math.round(7 + n.level * 2.6 + st.player.level * 1.6),
      def: Math.round(2 + n.level * 1.1),
      spd: 3.0, x: st.player.x + 1, y: st.player.y + 1, active: true, dir: "front", frame: 0, anim: 0, atkCd: 0,
      wage: Math.round(8 + n.level * 2),
    };
    c.hp = c.hpMax;
    st.companions.push(c);
    n.isCompanion = true;
    EH.NPCs.addRelP(n, 6, st);
    EH.log(`<b>${n.name}</b> joins your party. (${cost}g hiring fee, ${c.wage}g/day wages)`, "good");
    return c;
  }
  function dismiss(st, id) {
    const i = st.companions.findIndex(c => c.id === id);
    if (i < 0) return;
    const c = st.companions[i];
    st.companions.splice(i, 1);
    const n = EH.NPCs.byId(st, id); if (n) n.isCompanion = false;
    EH.log(`${c.name} returns to the hold.`);
  }

  /* ── pets ──────────────────────────────────────────────────── */
  function makePet(speciesId, st, rarIdx) {
    const S = EH.petById(speciesId) || EH.pick(EH.PETS);
    if (rarIdx === undefined) rarIdx = EH.rollPool(EH.PETRAR.map((r, i) => ({ v: i, w: r.w }))).v;
    const rr = EH.PETRAR[EH.clamp(rarIdx, 0, EH.PETRAR.length - 1)];
    const pet = {
      id: EH.uid("pet"), sp: S.id, name: S.n, role: S.role, body: S.body, c: S.c, fly: !!S.fly,
      rar: rr.k, rarMul: rr.mul, rarC: rr.c, level: 1, xp: 0,
      baseHp: S.hp, baseAtk: S.atk, spd: S.spd, skill: S.skill, fx: S.fx ? Object.assign({}, S.fx) : null,
      happy: 70, active: true, x: st.player.x, y: st.player.y + 1, dir: "front", frame: 0, anim: 0, atkCd: 0, assign: null,
    };
    pet.hpMax = Math.round(S.hp * rr.mul); pet.hp = pet.hpMax;
    pet.atk = Math.round(S.atk * rr.mul);
    if (rr.k !== "common") pet.name = rr.n + " " + S.n;
    return pet;
  }
  function hatch(st, speciesId, rarIdx) {
    const max = 2 + (EH.Items.researchFx(st).petSlot || 0) + EH.Build.count(st, "kennel");
    if (st.pets.length >= max) { EH.toast("No room in the kennel (" + max + " pets)"); return null; }
    const pet = makePet(speciesId || EH.pick(EH.PETS).id, st, rarIdx);
    st.pets.push(pet);
    EH.log(`<b class="${pet.rar === "mythic" || pet.rar === "epic" ? "epic" : "good"}">${pet.name}</b> hatched! (${pet.role} · ${pet.rar})`, pet.rar === "common" ? "good" : "epic");
    EH.toast(pet.name + " hatched!");
    return pet;
  }
  function feed(st, petId) {
    const pet = st.pets.find(p => p.id === petId); if (!pet) return false;
    if (!EH.Items.removeById(st.player.inv, "petfood", 1)) { EH.toast("You need a Pet Treat"); return false; }
    pet.happy = Math.min(100, pet.happy + 25);
    petGainXp(pet, 12, st);
    EH.log(`${pet.name} enjoyed the treat. (happiness ${Math.round(pet.happy)})`, "good");
    return true;
  }

  return {
    makeMon, spawnFloor, hurtMon, killMon, hurtPlayer, healPlayer, gainXp, playerAttack,
    useSkill, SKILLS, monUpdate, petUpdate, compUpdate, playerCombat, autoExplore,
    enterDungeon, descend, exitDungeon, hire, dismiss, makePet, hatch, feed,
    nearestMon, addStatus, tickStatuses, petGainXp, mitigate, playerDown
  };
})();
