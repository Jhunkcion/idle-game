/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — items.js : generation, inventory, equipment, derived stats
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;
EH.Items = (function () {

  /* ── rarity roll ────────────────────────────────────────────── */
  function rollRarity(lv, mfBonus, luck) {
    const pool = EH.RARITY.map((r, i) => {
      let w = r.w;
      if (i > 0) w *= 1 + (mfBonus || 0) / 100 * 0.8 + (luck || 0) * 0.012 + lv * 0.006;
      return { v: i, w };
    });
    return EH.rollPool(pool).v;
  }
  function tierForLevel(lv) {
    let t = 0;
    for (let i = 0; i < EH.TIER.length; i++) if (lv >= EH.TIER[i].lv) t = i;
    return t;
  }

  /* ── create an equipment piece ──────────────────────────────── */
  function makeEquip(lv, opt) {
    opt = opt || {};
    lv = Math.max(1, Math.round(lv));
    const tier = opt.tier !== undefined ? opt.tier : tierForLevel(lv + EH.randint(-1, 2));
    const T = EH.TIER[EH.clamp(tier, 0, EH.TIER.length - 1)];
    const rarIdx = opt.rarity !== undefined ? opt.rarity : rollRarity(lv, opt.mf || 0, opt.luck || 0);
    const R = EH.RARITY[EH.clamp(rarIdx, 0, 4)];
    const bases = EH.ITEMBASE.filter(b => b.tier <= T.lv || opt.forceBase);
    const base = opt.base ? EH.ITEMBASE.find(b => b.id === opt.base) : EH.pick(bases.length ? bases : EH.ITEMBASE);
    const it = {
      uid: EH.uid("it"), eq: true, base: base.id, slot: base.slot, icon: base.icon,
      tier, rar: R.k, up: 0, lv, qty: 1,
      atk: 0, def: 0, sp: 0, spd: 1, affixes: [], stats: {},
      ranged: !!base.ranged, caster: !!base.caster, hands: base.hands || 1,
      atkspd: base.fast ? base.fast : base.slow ? base.slow : 1,
      light: base.light || 0,
    };
    const mul = T.mul * R.mul * (1 + lv * 0.035);
    it.atk = base.atk ? Math.max(1, Math.round(base.atk * mul)) : 0;
    it.def = base.def ? Math.max(0, Math.round(base.def * mul * 0.8)) : 0;
    it.sp = base.sp ? +(base.sp * (1 + tier * 0.12)).toFixed(2) : 0;
    it.spd = base.spd || 1;
    // affixes
    const used = new Set();
    for (let i = 0; i < R.aff; i++) {
      const a = EH.pick(EH.AFFIX.filter(a => !used.has(a.k)));
      if (!a) break;
      used.add(a.k);
      it.affixes.push({ k: a.k, n: a.n, v: Math.max(1, Math.round(a.g(lv) * (1 + tier * 0.1))) });
    }
    if (R.k === "epic" || R.k === "legendary") {
      const p = EH.pick(EH.PREFIX.filter(p => !it.pre || p.k !== it.pre));
      it.pre = p.k; it.preN = p.n;
      const fx = p.g();
      for (const k in fx) it.stats[k] = (it.stats[k] || 0) + fx[k];
    }
    if (R.k === "legendary") {
      const L = EH.pick(EH.LEGENDARY);
      it.leg = L.n; it.flav = L.flav;
      for (const k in L.fx) {
        if (k === "atkMul") it.atk = Math.round(it.atk * L.fx[k]);
        else if (k === "hpMul") it.hpMul = L.fx[k];
        else it.stats[k] = (it.stats[k] || 0) + L.fx[k];
      }
    }
    // name
    const core = T.n + " " + base.n;
    const suf = it.affixes.length ? " " + EH.pick(it.affixes).n : "";
    it.name = it.leg ? it.leg : (it.preN ? it.preN + " " : "") + core + suf;
    it.price = Math.round((14 + it.atk * 3.2 + it.def * 2.6) * T.mul * R.mul * (1 + lv * 0.08) + it.affixes.length * 22);
    it.c = R.c;
    return it;
  }

  /* ── stackable (consumable / material) ──────────────────────── */
  function makeStack(id, qty) {
    const def = EH.CONSUM.find(c => c.id === id) || EH.MATS.find(c => c.id === id);
    if (!def) return null;
    return {
      uid: EH.uid("st"), id, eq: false, qty: qty || 1, name: def.n, icon: def.icon, c: def.c || "#c8a05a",
      price: def.price, kind: def.kind, def, stack: def.stack || 99, flav: def.d
    };
  }

  /* ── inventory helpers ──────────────────────────────────────── */
  function add(inv, it, cap) {
    if (!it) return false;
    if (!it.eq) {
      const s = it.stack || 99;
      let left = it.qty;
      for (const e of inv) if (!e.eq && e.id === it.id && e.qty < s) {
        const room = s - e.qty, put = Math.min(room, left);
        e.qty += put; left -= put; if (left <= 0) return true;
      }
      while (left > 0) {
        if (cap && inv.length >= cap) return false;
        const e = Object.assign({}, it); e.uid = EH.uid("st"); e.qty = Math.min(left, s);
        inv.push(e); left -= e.qty;
      }
      return true;
    }
    if (cap && inv.length >= cap) return false;
    inv.push(it); return true;
  }
  function countOf(inv, id) { let n = 0; for (const e of inv) if (!e.eq && e.id === id) n += e.qty; return n; }
  function remove(inv, uid, qty) {
    const i = inv.findIndex(e => e.uid === uid); if (i < 0) return null;
    const e = inv[i];
    if (e.eq || !qty || qty >= e.qty) { inv.splice(i, 1); return e; }
    e.qty -= qty; const out = Object.assign({}, e); out.qty = qty; return out;
  }
  function removeById(inv, id, qty) {
    let left = qty;
    for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
      const e = inv[i]; if (e.eq || e.id !== id) continue;
      const take = Math.min(e.qty, left); e.qty -= take; left -= take;
      if (e.qty <= 0) inv.splice(i, 1);
    }
    return left <= 0;
  }
  function value(it) { return Math.round((it.price || 0) * (1 + (it.up || 0) * 0.35)); }

  /* ── tooltip HTML ───────────────────────────────────────────── */
  function tip(it) {
    if (!it) return "";
    const R = it.eq ? EH.RARITY.find(r => r.k === it.rar) : null;
    const cls = it.eq ? "r-" + it.rar : "";
    let h = `<div class="tt-name ${cls}">${EH.esc(it.name)}${it.up ? ` <span style="color:#f0c05a">+${it.up}</span>` : ""}</div>`;
    if (it.eq) {
      h += `<div class="tt-type">${EH.TIER[it.tier].n} · ${EH.SLOTS[it.slot]}${it.hands === 2 ? " · Two-handed" : ""}</div>`;
      if (it.atk) h += `<div class="tt-stat">⚔ Attack <b style="color:#f0d0a0">${it.atk}</b></div>`;
      if (it.def) h += `<div class="tt-stat">🛡 Defence <b style="color:#a0d0f0">${it.def}</b></div>`;
      if (it.sp > 0 && it.sp !== 1) h += `<div class="tt-stat">✦ Spell power <b style="color:#c8a0f0">×${it.sp}</b></div>`;
      if (it.spd !== 1) h += `<div class="tt-stat">➤ Speed <b>${Math.round((it.spd - 1) * 100) > 0 ? "+" : ""}${Math.round((it.spd - 1) * 100)}%</b></div>`;
      for (const k in it.stats) h += `<div class="tt-stat">${statLabel(k)} <b style="color:#f0d0a0">+${it.stats[k]}${pctStat(k) ? "%" : ""}</b></div>`;
      for (const a of it.affixes) h += `<div class="tt-aff">${affixLabel(a)} <b>+${a.v}${pctAffix(a.k) ? "%" : ""}</b></div>`;
      h += `<div class="tt-stat" style="color:#7d705c">Item level ${it.lv} · ${R.n}</div>`;
    } else {
      const d = it.def || {};
      h += `<div class="tt-type">${(d.kind || "material")}</div>`;
      if (d.heal) h += `<div class="tt-stat">✚ Restores <b style="color:#90e870">${d.heal}</b> HP</div>`;
      if (d.happy) h += `<div class="tt-stat">♥ Pet happiness <b style="color:#90e870">+${d.happy}</b></div>`;
      if (d.buff) h += `<div class="tt-stat">✦ +${d.amt} ${statLabel(d.buff).replace(/[<>b/]/g, "")} for ${EH.fmtDur(d.dur)}</div>`;
      if (d.fx) h += `<div class="tt-stat">✦ ${d.fx === "recall" ? "Return to Emberhold instantly" : "Identify an item"}</div>`;
      h += `<div class="tt-stat" style="color:#7d705c">Held: ${it.qty}</div>`;
    }
    if (it.flav) h += `<div class="tt-flav">${EH.esc(it.flav)}</div>`;
    h += `<div class="tt-val">Worth ${EH.fmtInt(value(it))} gold</div>`;
    return h;
  }
  const STATN = { str: "Strength", dex: "Dexterity", int: "Intellect", vit: "Vitality", per: "Perception", lck: "Luck" };
  const FXN = { crit: "Critical chance", critdmg: "Critical damage", hp: "Max HP", def: "Defence", leech: "Life steal", goldfind: "Gold find", itemfind: "Item find", speed: "Move speed", xpgain: "XP gain", burn: "Burn damage", petdmg: "Pet damage", atk: "Attack", spd: "Attack speed", regen: "HP regen", dmgReduce: "Damage taken", vision: "Vision", tax: "Market tax", compDmg: "Companion damage", potHeal: "Potion potency", prodFood: "Food output", prodOre: "Ore output", petSlot: "Pet slots", goldMul: "Gold gained" };
  function statLabel(k) { return STATN[k] || FXN[k] || k; }
  function pctStat(k) { return ["crit", "critdmg", "leech", "goldfind", "itemfind", "speed", "xpgain", "petdmg", "dmgReduce", "tax", "compDmg", "potHeal", "prodFood", "prodOre", "goldMul", "spd", "regen"].includes(k); }
  function pctAffix(k) { return pctStat(k); }
  function affixLabel(a) { return statLabel(a.k) === a.k ? a.n.replace(/^of /, "") : statLabel(a.k); }

  /* ══════════════════════════════════════════════════════════
     DERIVED STATS
     ══════════════════════════════════════════════════════════ */
  function derive(p, st) {
    st = st || EH.S;
    const C = EH.CLASS[p.cls] || EH.CLASS.warden;
    const lv = p.level;
    const s = { str: 0, dex: 0, int: 0, vit: 0, per: 0, lck: 0 };
    for (const k in s) s[k] = (C.base[k] || 0) + (C.grow[k] || 0) * (lv - 1) + (p.pts[k] || 0);
    const bonus = { crit: 0, critdmg: 0, hp: 0, def: 0, leech: 0, goldfind: 0, itemfind: 0, speed: 0, xpgain: 0, burn: 0, petdmg: 0, regen: 0, dmgReduce: 0, light: 0, atkspd: 0, atk: 0, spd: 1, sp: 1, vision: 0, potHeal: 0 };
    let wpn = null, off = null;
    for (const slot in p.equip) {
      const it = p.equip[slot]; if (!it) continue;
      if (slot === "wpn") wpn = it;
      if (slot === "off") off = it;
      bonus.atk += it.atk || 0;
      bonus.def += it.def || 0;
      bonus.hp += (it.stats.hp || 0);
      bonus.light += it.light || 0;
      if (it.sp) bonus.sp *= it.sp;
      if (it.spd && it.spd !== 1) bonus.spd *= it.spd;
      if (it.atkspd && it.atkspd !== 1) bonus.atkspd *= it.atkspd;
      if (it.hpMul) bonus.hpMul = (bonus.hpMul || 1) * it.hpMul;
      for (const k in s) if (it.stats[k]) s[k] += it.stats[k];
      for (const k in it.stats) if (bonus[k] !== undefined && k !== "hp" && k !== "atk" && k !== "def") bonus[k] += it.stats[k];
      for (const a of it.affixes) {
        if (s[a.k] !== undefined && !pctAffix(a.k)) s[a.k] += a.v;
        else if (a.k === "hp") bonus.hp += a.v;
        else if (a.k === "def") bonus.def += a.v;
        else if (bonus[a.k] !== undefined) bonus[a.k] += a.v;
      }
      const up = it.up || 0;
      if (up) { bonus.atk += Math.round((it.atk || 0) * up * 0.09); bonus.def += Math.round((it.def || 0) * up * 0.09); }
    }
    // buffs (elixirs, chapel, bard, research, pets)
    const B = st.buffs || {};
    for (const k in B) { const b = B[k]; if (b.t > 0) { if (s[k] !== undefined) s[k] += b.v; else if (bonus[k] !== undefined) bonus[k] += b.v; } }
    const rs = researchFx(st);
    for (const k in rs) { if (bonus[k] !== undefined) bonus[k] += rs[k]; }
    // pets
    for (const pet of (st.pets || [])) {
      if (pet.active !== false && pet.fx) for (const k in pet.fx) if (bonus[k] !== undefined) bonus[k] += pet.fx[k] * (1 + pet.level * 0.04);
    }
    // companions
    bonus.comp = (st.companions || []).filter(c => c.active).length;

    const isCaster = C.caster || (wpn && wpn.caster);
    const isRanged = C.ranged || (wpn && wpn.ranged);
    const primary = isCaster ? s.int : isRanged ? s.dex : s.str;
    const clsAtk = C.atk || 1;
    const baseAtk = (bonus.atk || 0) + (isCaster ? primary * 1.5 : primary * 1.15) + lv * 0.6;
    const hpMax = Math.round(((24 + s.vit * 7 + lv * 6) * (C.hp / 10) + bonus.hp) * (bonus.hpMul || 1));
    const def = Math.round(bonus.def + s.vit * 0.75 + lv * 0.35);
    const out = {
      s, lv, cls: p.cls, wpn, off, isCaster, isRanged,
      atk: Math.max(1, Math.round(baseAtk * clsAtk * bonus.sp)),
      atkRange: isRanged || isCaster ? 5.2 : 1.5,
      atkCd: Math.max(0.22, 1.05 / ((bonus.atkspd || 1) * (1 + s.dex * 0.012))),
      hpMax, def,
      crit: EH.clamp(4 + s.dex * 0.55 + bonus.crit + s.lck * 0.12, 0, 85),
      critdmg: 150 + s.lck * 2.2 + bonus.critdmg,
      dodge: EH.clamp(s.dex * 0.28, 0, 32),
      speed: EH.CFG.PLAYER_SPD * (bonus.spd || 1) * (1 + bonus.speed / 100) * (C.ranged ? 1.06 : 1),
      leech: bonus.leech, goldfind: 1 + (bonus.goldfind) / 100, itemfind: 1 + (bonus.itemfind) / 100,
      xpgain: 1 + (bonus.xpgain + s.int * 0.6) / 100, burn: bonus.burn, regen: 0.35 + s.vit * 0.05 + bonus.regen,
      dmgReduce: EH.clamp(bonus.dmgReduce, 0, 60), light: 2.6 + bonus.light, vision: 6.5 + (rs.vision || 0) + bonus.vision,
      petdmg: 1 + (bonus.petdmg + s.per * 0.5) / 100, potHeal: 1 + (bonus.potHeal || 0),
      carry: 40 + s.str * 3,
    };
    return out;
  }
  function researchFx(st) {
    const out = {};
    for (const id of (st.research || [])) {
      const R = EH.RESEARCH.find(r => r.id === id); if (!R) continue;
      for (const k in R.fx) {
        if (k === "tax") out.tax = (out.tax || 0) + R.fx[k];
        else if (k === "prodFood") out.prodFood = (out.prodFood || 0) + R.fx[k];
        else if (k === "prodOre") out.prodOre = (out.prodOre || 0) + R.fx[k];
        else if (k === "compDmg") out.compDmg = (out.compDmg || 0) + R.fx[k];
        else if (k === "petDmg") out.petdmg = (out.petdmg || 0) + R.fx[k] * 100;
        else if (k === "goldMul") out.goldfind = (out.goldfind || 0) + R.fx[k] * 100;
        else if (k === "potHeal") out.potHeal = (out.potHeal || 0) + R.fx[k] * 100;
        else out[k] = (out[k] || 0) + R.fx[k];
      }
    }
    return out;
  }

  /* ── equip / unequip ────────────────────────────────────────── */
  function equip(p, uid) {
    const i = p.inv.findIndex(e => e.uid === uid); if (i < 0) return null;
    const it = p.inv[i]; if (!it.eq) return null;
    const slot = it.slot;
    const prev = p.equip[slot];
    if (it.hands === 2 && p.equip.off && EH.ITEMBASE.find(b => b.id === p.equip.off.base)?.hands !== 2) {
      // two-hander puts the offhand back into the bag
      p.inv.push(p.equip.off); p.equip.off = null;
    }
    p.equip[slot] = it; p.inv.splice(i, 1);
    if (prev) p.inv.push(prev);
    if (slot === "wpn" && it.hands === 1 && p.equip.off === undefined) p.equip.off = null;
    return it;
  }
  function unequip(p, slot) {
    const it = p.equip[slot]; if (!it) return null;
    if (p.inv.length >= p.cap) return null;
    p.equip[slot] = null; p.inv.push(it); return it;
  }

  /* ── upgrade at the forge ───────────────────────────────────── */
  function upCost(it) {
    const u = (it.up || 0) + 1;
    return { gold: Math.round(40 * Math.pow(1.6, u - 1) + (it.atk || 0) * 3), ore: Math.max(1, Math.round(u * 1.6)) };
  }

  /* ── random loot table for a monster/floor ──────────────────── */
  function lootFor(mon, floor, st) {
    const p = st.player, D = derive(p, st);
    const out = { gold: 0, items: [] };
    const sc = EH.monScale(floor);
    out.gold = Math.round(EH.randint(mon.gold[0], mon.gold[1]) * sc * D.goldfind * (st.buffs.gold ? 1.1 : 1));
    const gearChance = (mon.gear || 0) * (1 + (D.itemfind - 1)) * (mon.boss ? 3 : 1);
    if (EH.chance(gearChance)) out.items.push(makeEquip(Math.max(1, floor + EH.randint(-1, 2)), { mf: (D.itemfind - 1) * 100, luck: D.s.lck, rarity: mon.legendary && EH.chance(mon.legendary) ? 4 : undefined }));
    for (const [id, ch] of (mon.drops || [])) {
      if (EH.chance(ch * (0.8 + D.itemfind * 0.3))) out.items.push(makeStack(id, EH.randint(1, mon.boss ? 4 : 2)));
    }
    if (mon.boss && EH.chance(0.55)) out.items.push(makeStack("egg", 1));
    return out;
  }
  function chestLoot(tier, floor, st) {
    const D = derive(st.player, st);
    const out = { gold: 0, items: [] };
    out.gold = Math.round((30 + floor * 22) * (1 + tier * 1.4) * D.goldfind);
    const n = 1 + tier + (EH.chance(0.35) ? 1 : 0);
    for (let i = 0; i < n; i++) {
      if (EH.chance(0.55)) out.items.push(makeEquip(floor + tier * 2 + EH.randint(0, 2), { mf: (D.itemfind - 1) * 100, luck: D.s.lck, rarity: tier >= 2 ? EH.randint(2, 4) : undefined }));
      else out.items.push(makeStack(EH.pick(EH.CONSUM.filter(c => c.kind !== "scroll")).id, EH.randint(1, 3)));
    }
    if (tier >= 1 && EH.chance(0.3)) out.items.push(makeStack(EH.pick(EH.MATS).id, EH.randint(2, 5)));
    return out;
  }

  return { makeEquip, makeStack, add, remove, removeById, countOf, value, tip, derive, equip, unequip, upCost, lootFor, chestLoot, researchFx, tierForLevel, rollRarity, statLabel, pctStat };
})();
