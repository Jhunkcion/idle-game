/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — quests.js : procedural quest generation & tracking
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;

EH.Quests = (function () {

  function rewardFor(st, lv) {
    const r = EH.QREWARD(lv);
    return r;
  }

  /* ── generate a quest from a giver ─────────────────────────── */
  function generate(st, npc) {
    const lv = Math.max(1, st.player.level);
    const tpl = EH.rollPool(EH.QTPL.map(t => {
      let w = t.w;
      if (t.k === "build") w = EH.buildOrder.some(b => !EH.Build.count(st, b)) ? t.w * 2.2 : 0;
      if (t.k === "boss") w = (st.dungeon.maxFloor >= 5 || lv >= 6) ? t.w : 0;
      if (t.k === "social") w = st.npcs.length > 3 ? t.w : 0;
      if (t.k === "explore") w = st.dungeon.maxFloor >= 2 ? t.w * 1.3 : t.w * 0.4;
      return { v: t, w };
    })).v;
    if (!tpl) return null;
    const q = {
      id: EH.uid("q"), type: tpl.k, giver: npc.id, giverName: npc.name,
      day: st.time.day, state: "offered", have: 0, need: 1, label: "", desc: "",
      reward: rewardFor(st, lv), ttl: 8
    };
    if (tpl.k === "slay") {
      const floor = EH.clamp(Math.round(st.dungeon.maxFloor || 1), 1, 40);
      const pool = EH.monsForFloor(floor);
      const mon = EH.pick(pool.length ? pool : EH.MON);
      q.need = EH.clamp(Math.round((4 + lv * 1.6) * (mon.hp > 60 ? 0.6 : 1)), 3, 40);
      q.target = { kind: "slay", id: mon.id };
      q.label = tpl.n(mon, q.need);
      q.desc = tpl.d(mon, q.need) + ` (Floor ${Math.max(1, mon.fl[0])}–${mon.fl[1]})`;
    } else if (tpl.k === "gather") {
      const res = EH.pick([{ n: "Wood", k: "wood" }, { n: "Stone", k: "stone" }, { n: "Ore", k: "ore" }, { n: "Food", k: "food" }]);
      q.need = Math.round((18 + lv * 9) * (res.k === "ore" ? 0.55 : 1));
      q.target = { kind: "gather", id: res.k };
      q.label = tpl.n(res, q.need);
      q.desc = tpl.d(res, q.need);
      q.consume = true;
    } else if (tpl.k === "deliver") {
      const others = st.npcs.filter(n => n.id !== npc.id);
      const t = EH.pick(others.length ? others : [npc]);
      q.target = { kind: "deliver", id: t.id };
      q.need = 1;
      q.label = tpl.n(t.name.split(" ")[0]);
      q.desc = tpl.d(t.name.split(" ")[0]);
      q.reward.gold = Math.round(q.reward.gold * 0.7);
      q.reward.rep = (t.id, q.reward.rep + 8);
    } else if (tpl.k === "explore") {
      const f = Math.max(2, (st.dungeon.maxFloor || 1) + EH.randint(1, 2));
      q.need = f; q.target = { kind: "explore", id: f };
      q.label = tpl.n(f); q.desc = tpl.d(f);
      q.exact = true;
    } else if (tpl.k === "build") {
      const missing = EH.buildOrder.filter(b => !EH.Build.count(st, b) && (!EH.BUILD[b].req || EH.Build.count(st, EH.BUILD[b].req)));
      const type = EH.pick(missing.length ? missing : ["house", "torch", "warehouse"]);
      q.need = 1; q.target = { kind: "build", id: type };
      q.label = tpl.n(EH.BUILD[type].n); q.desc = tpl.d(EH.BUILD[type].n);
      q.reward.gold = Math.round(q.reward.gold * 1.5 + EH.BUILD[type].cost.gold * 0.6);
    } else if (tpl.k === "boss") {
      const fl = Math.max(5, Math.ceil(((st.dungeon.maxFloor || 1) + 4) / 5) * 5);
      const b = EH.bossForFloor(fl) || EH.BOSS[0];
      q.need = 1; q.target = { kind: "boss", id: b.n };
      q.label = tpl.n(b.n); q.desc = tpl.d(b.n) + ` (Floor ${fl})`;
      q.reward.gold *= 3; q.reward.xp *= 3; q.reward.item = true;
    } else if (tpl.k === "social") {
      const a = EH.pick(st.npcs), b2 = EH.pick(st.npcs.filter(n => n !== a));
      if (!b2) return null;
      EH.NPCs.rel(a, b2.id, -30, st); EH.NPCs.rel(b2, a.id, -30, st);
      q.target = { kind: "social", id: a.id, id2: b2.id };
      q.need = 1;
      q.label = tpl.n(a.name.split(" ")[0], b2.name.split(" ")[0]);
      q.desc = tpl.d(a.name.split(" ")[0], b2.name.split(" ")[0]);
      q.reward.gold = Math.round(q.reward.gold * 0.5);
    }
    q.title = q.label;
    return q;
  }

  /* ── accept / complete ─────────────────────────────────────── */
  function accept(st, q) {
    if (st.quests.active.length >= 6) { EH.toast("Journal full (6 quests)"); return false; }
    q.state = "active"; q.dayTaken = st.time.day;
    st.quests.active.push(q);
    const g = EH.NPCs.byId(st, q.giver); if (g) g.quest = q;
    EH.log(`Quest accepted: <b>${q.title}</b> — from ${q.giverName}.`, "gold");
    if (q.type === "gather") refreshGather(st, q);
    EH.bus.emit("quest:accept", q);
    return true;
  }
  function refreshGather(st, q) { q.have = Math.min(q.need, st.res[q.target.id] || 0); }

  function complete(st, q) {
    const g = EH.NPCs.byId(st, q.giver);
    const R = q.reward;
    // gather quests hand the goods over
    if (q.type === "gather" && q.consume) {
      if ((st.res[q.target.id] || 0) < q.need) return false;
      st.res[q.target.id] -= q.need;
    }
    st.res.gold += R.gold;
    st.stats.goldEarned += R.gold;
    EH.Combat.gainXp(st, R.xp);
    if (R.res) for (const k in R.res) EH.Build.addRes(st, k, R.res[k]);
    let itemTxt = "";
    if (R.item) {
      const it = EH.Items.makeEquip(st.player.level + EH.randint(0, 2), { mf: 40, luck: st.derived.s.lck, rarity: EH.rollPool([{ v: 1, w: 55 }, { v: 2, w: 30 }, { v: 3, w: 12 }, { v: 4, w: 3 }]).v });
      if (EH.Items.add(st.player.inv, it, st.player.cap)) itemTxt = ` and <b class="r-${it.rar}">${it.name}</b>`;
    }
    if (g) {
      EH.NPCs.addRelP(g, R.rep, st);
      EH.NPCs.say(g, EH.pick(["You've done Emberhold a service.", "I knew I could count on you.", "The hold remembers this, Warden.", "That's a weight off my mind."]), 4);
      g.quest = null;
    }
    const i = st.quests.active.indexOf(q); if (i >= 0) st.quests.active.splice(i, 1);
    st.quests.done.push({ id: q.id, title: q.title, day: st.time.day, by: q.giverName });
    if (st.quests.done.length > 60) st.quests.done.shift();
    st.stats.quests++;
    EH.log(`<b class="good">Quest complete: ${q.title}</b> — ${EH.fmt(R.gold)}g, ${EH.fmt(R.xp)} xp${itemTxt}, +${R.rep} reputation with ${q.giverName}.`, "good");
    EH.toast("QUEST COMPLETE");
    EH.bus.emit("quest:done", q);
    return true;
  }

  /* ── progress hooks ────────────────────────────────────────── */
  function progress(st, kind, id, amount, exact) {
    for (const q of st.quests.active.slice()) {
      if (q.target.kind !== kind) continue;
      if (q.target.id !== id && !(kind === "slay" && q.target.id === id)) continue;
      if (exact) {
        if (kind === "explore") { q.have = Math.max(q.have, id >= q.need ? q.need : q.have); if (id >= q.need) q.have = q.need; }
        continue;
      }
      q.have = Math.min(q.need, q.have + (amount || 1));
      if (q.have >= q.need && q.state === "active") {
        q.state = "ready";
        EH.log(`Quest ready to turn in: <b>${q.title}</b> — return to ${q.giverName}.`, "gold");
        EH.toast("Quest ready: " + q.title);
        const g = EH.NPCs.byId(st, q.giver); if (g) g.quest = q;
      }
    }
  }
  function checkBuild(st, type) {
    for (const q of st.quests.active) {
      if (q.target.kind === "build" && q.target.id === type) {
        q.have = q.need;
        if (q.state === "active") { q.state = "ready"; EH.log(`Quest ready: <b>${q.title}</b> — return to ${q.giverName}.`, "gold"); const g = EH.NPCs.byId(st, q.giver); if (g) g.quest = q; }
      }
    }
  }
  function checkLevel() { }
  function checkSocial(st) {
    for (const q of st.quests.active) {
      if (q.target.kind !== "social") continue;
      const a = EH.NPCs.byId(st, q.target.id), b = EH.NPCs.byId(st, q.target.id2);
      if (a && b && EH.NPCs.relBetween(a, b) >= 5) {
        q.have = q.need; q.state = "ready";
        EH.log(`${a.name} and ${b.name} have made peace. Quest ready: <b>${q.title}</b>`, "good");
        const g = EH.NPCs.byId(st, q.giver); if (g) g.quest = q;
      }
    }
  }
  function checkDeliver(st, npcId) {
    for (const q of st.quests.active) {
      if (q.target.kind === "deliver" && q.target.id === npcId) {
        q.have = q.need; q.state = "ready";
        const g = EH.NPCs.byId(st, q.giver); if (g) g.quest = q;
        EH.log(`Package delivered. Quest ready: <b>${q.title}</b>`, "good");
      }
    }
  }

  /* ── daily: expire & offer new ─────────────────────────────── */
  function daily(st) {
    for (let i = st.quests.board.length - 1; i >= 0; i--) {
      const q = st.quests.board[i];
      if (st.time.day - q.day > q.ttl) st.quests.board.splice(i, 1);
    }
    // refresh board quests
    while (st.quests.board.length < 3) {
      const g = EH.pick(st.npcs.filter(n => !n.dead));
      if (!g) break;
      const q = generate(st, g);
      if (q) { q.state = "board"; st.quests.board.push(q); }
      else break;
    }
    // NPC-offered quests
    for (const n of st.npcs) {
      if (n.dead || n.quest) continue;
      if (!n.questHub && !EH.chance(0.30)) continue;
      const q = generate(st, n);
      if (q) { n.quest = q; q.state = "offered"; }
    }
    checkSocial(st);
  }

  function takeFromBoard(st, q) {
    const i = st.quests.board.indexOf(q); if (i < 0) return false;
    st.quests.board.splice(i, 1);
    return accept(st, q);
  }

  function abandon(st, q) {
    const i = st.quests.active.indexOf(q); if (i >= 0) st.quests.active.splice(i, 1);
    const g = EH.NPCs.byId(st, q.giver); if (g && g.quest === q) g.quest = null;
    EH.log(`Quest abandoned: ${q.title}`);
  }

  /* ── gather quests track your stockpile ────────────────────── */
  function update(st, dt) {
    for (const q of st.quests.active) if (q.type === "gather") refreshGather(st, q);
    st.questTick = (st.questTick || 0) + dt;
    if (st.questTick > 2) { st.questTick = 0; checkSocial(st); }
  }

  return { generate, accept, complete, progress, checkBuild, checkLevel, checkSocial, checkDeliver, daily, takeFromBoard, abandon, update, rewardFor };
})();
