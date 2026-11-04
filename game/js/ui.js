/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — ui.js : panels, dialogue, shops, tooltips, HUD
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;

/* ── global log (buffered until UI is ready) ─────────────────── */
const _logBuf = [];
EH.log = function (html, cls) {
  const entry = { html, cls: cls || "", t: Date.now() };
  _logBuf.push(entry);
  if (_logBuf.length > 220) _logBuf.shift();
  if (EH.UI && EH.UI.ready) EH.UI.pushLog(entry);
};

EH.UI = (function () {
  let st = null, ready = false;
  const open = new Set();
  let tipEl, logEl, panelsEl;
  let currentNpc = null, shopMode = null;

  /* ══════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════ */
  function init(state) {
    st = state;
    tipEl = document.getElementById("tooltip");
    logEl = document.getElementById("log");
    panelsEl = document.getElementById("panels");
    ready = true;
    bindTop();
    bindBottom();
    bindKeys();
    bindLog();
    for (const e of _logBuf.splice(0)) pushLog(e);
    syncAll();
    buildResBar();
  }

  function bindTop() {
    document.querySelectorAll("#topbar .nav button").forEach(b => {
      b.addEventListener("click", () => toggle(b.dataset.panel));
    });
    document.querySelectorAll(".speedctl button").forEach(b => {
      b.addEventListener("click", () => setSpeed(+b.dataset.speed));
    });
  }
  function setSpeed(s) {
    st.speed = s;
    document.querySelectorAll(".speedctl button").forEach(b => b.classList.toggle("on", +b.dataset.speed === s));
    EH.log(s === 0 ? "Time paused." : `Time ×${s}.`);
  }
  function bindBottom() {
    document.querySelectorAll("#hotbar .hk").forEach(b => {
      b.addEventListener("click", () => hotbar(b.dataset.act));
    });
    document.getElementById("placecancel").addEventListener("click", () => cancelPlace());
  }
  function hotbar(act) {
    const p = st.player;
    if (act === "skill1") EH.Combat.useSkill(st, EH.CLASS[p.cls].skills[0].k);
    else if (act === "skill2") { const s = EH.CLASS[p.cls].skills.find(s => s.lvl <= p.level && s.k !== EH.CLASS[p.cls].skills[0].k); if (s) EH.Combat.useSkill(st, s.k); else EH.toast("No second skill yet"); }
    else if (act === "potion") usePotion();
    else if (act === "recall") { if (st.map.kind === "dungeon") EH.Combat.exitDungeon(st); else EH.toast("You're already home."); }
    else if (act === "delve") {
      if (st.map.kind === "dungeon") { EH.toast("Already in the Hollowdeep — R to recall"); return; }
      st.delve = true; st.idleT = 0; st.recallT = 0;
      EH.toast("The Warden sets out for the Hollowdeep"); syncAll();
    }
  }
  function usePotion() {
    const pots = st.player.inv.filter(e => !e.eq && e.kind === "potion").sort((a, b) => (a.def.heal || 0) - (b.def.heal || 0));
    if (!pots.length) { EH.toast("No potions"); return; }
    const p = pots[pots.length - 1];
    const heal = Math.round(p.def.heal * st.derived.potHeal);
    EH.Combat.healPlayer(st, heal);
    EH.Items.remove(st.player.inv, p.uid, 1);
    EH.Float.world(st.player.x, st.player.y - 1, "glug", "heal");
    syncAll();
  }

  function bindKeys() {
    window.addEventListener("keydown", e => {
      const k = e.key.toLowerCase();
      if (k === "escape") { if (st.placing) cancelPlace(); else if (currentNpc) closeDialogue(); else closeAll(); return; }
      if (document.activeElement && document.activeElement.tagName === "INPUT") return;
      const map = { c: "char", i: "inv", b: "build", t: "town", q: "quest", p: "pet", m: "menu", l: "logsize" };
      if (map[k]) { e.preventDefault(); if (map[k] === "logsize") toggleLog(); else toggle(map[k]); return; }
      if (k === "e") { e.preventDefault(); EH.Game.interact(); return; }
      if (k === " ") { e.preventDefault(); const m = EH.Combat.nearestMon(st, st.player.x, st.player.y, 4); if (m) { st.focus = m; EH.Combat.playerAttack(st, m, {}); } return; }
      if (k === "f") { e.preventDefault(); hotbar("delve"); return; }
      if (k === "r") { e.preventDefault(); hotbar("recall"); return; }
      if (k === "1") { hotbar("skill1"); return; }
      if (k === "2") { hotbar("skill2"); return; }
      if (k === "3") { hotbar("potion"); return; }
      if (k === "+" || k === "=") { setSpeed(Math.min(4, (st.speed || 1) * 2)); return; }
      if (k === "-" || k === "_") { setSpeed(Math.max(0, (st.speed || 1) / 2)); return; }
      if (k === "f5") { e.preventDefault(); EH.Game.save(true); return; }
    });
  }
  function bindLog() {
    const h = document.querySelector(".loghead");
    h.addEventListener("click", toggleLog);
  }
  function toggleLog() { logEl.classList.toggle("collapsed"); document.getElementById("logtoggle").textContent = logEl.classList.contains("collapsed") ? "+" : "–"; }

  function pushLog(e) {
    if (!logEl) return;
    const d = EH.el("div", e.cls, `<span class="t">${EH.fmtTime(st.time.minute)}</span> ${e.html}`);
    logEl.prepend(d);
    while (logEl.childElementCount > 90) logEl.lastChild.remove();
  }

  /* ══════════════════════════════════════════════════════════
     HUD SYNC
     ══════════════════════════════════════════════════════════ */
  function buildResBar() {
    const host = document.getElementById("ui-res");
    host.innerHTML = "";
    for (const r of EH.RES) {
      const d = EH.el("div", "res " + r.k);
      d.innerHTML = `<span class="ic"></span><span class="v">0</span><span class="rate"></span>`;
      d.querySelector(".ic").appendChild(EH.Art.resIcon(r.k));
      d.title = r.n;
      host.appendChild(d);
    }
  }
  function syncAll() {
    if (!ready) return;
    // clock
    document.getElementById("ui-clock").textContent = EH.fmtTime(st.time.minute);
    document.getElementById("ui-day").textContent = "Day " + st.time.day + " · " + st.tod.name;
    document.getElementById("ui-season").textContent = EH.SEASONS[st.time.season].n;
    document.getElementById("ui-weather").textContent = (EH.WEATHER[st.weather] || EH.WEATHER.clear).n;
    // resources
    const host = document.getElementById("ui-res");
    EH.RES.forEach((r, i) => {
      const d = host.children[i]; if (!d) return;
      const v = st.res[r.k] || 0;
      d.querySelector(".v").textContent = EH.fmt(v);
      const rate = (st.town.rates && st.town.rates[r.k]) || 0;
      const rel = d.querySelector(".rate");
      if (r.k === "gold") { rel.textContent = ""; }
      else {
        rel.textContent = rate ? (rate > 0 ? "+" : "") + rate.toFixed(1) + "/m" : "";
        rel.className = "rate" + (rate < 0 ? " neg" : "");
        const cap = EH.Build.capOf(st, r.k);
        d.title = `${r.n}: ${EH.fmtInt(v)} / ${r.k === "gold" ? "∞" : EH.fmtInt(cap)}  (${rate >= 0 ? "+" : ""}${rate.toFixed(2)}/min)`;
      }
    });
    // place
    document.getElementById("ui-placename").textContent = st.map.kind === "town" ? "Emberhold" : "Hollowdeep";
    document.getElementById("ui-placesub").textContent = st.map.kind === "town"
      ? `Tier ${EH.Town.tier(st)} · Pop ${st.npcs.filter(n => !n.dead).length}/${EH.Town.popCap(st)} · Morale ${EH.Town.morale(st)}`
      : `Floor ${st.dungeon.floor}${st.dmap && st.dmap.isBoss ? " · GUARDIAN" : ""} · ${st.mons.length} foes`;
    // vitals
    const p = st.player, D = st.derived;
    document.getElementById("v-name").textContent = p.name + " · " + (p.jobName || EH.CLASS[p.cls].n);
    document.getElementById("v-lvl").textContent = "Lv " + p.level;
    const hpEl = document.getElementById("v-hp"), hpT = document.getElementById("v-hpt");
    hpEl.style.width = EH.clamp(p.hp / D.hpMax * 100, 0, 100) + "%";
    hpT.textContent = Math.max(0, Math.ceil(p.hp)) + " / " + D.hpMax;
    const need = EH.xpFor(p.level);
    document.getElementById("v-xp").style.width = EH.clamp(p.xp / need * 100, 0, 100) + "%";
    document.getElementById("v-xpt").textContent = "XP " + EH.fmt(p.xp) + " / " + EH.fmt(need);
    // portrait
    const pf = document.getElementById("v-portrait");
    if (!pf.firstChild) pf.appendChild(EH.Art.portrait(portraitOpts(p)));
    // hotbar
    const pots = st.player.inv.filter(e => !e.eq && e.kind === "potion").reduce((a, e) => a + e.qty, 0);
    document.getElementById("hb-pot").textContent = pots;
    const C = EH.CLASS[p.cls];
    const hks = document.querySelectorAll("#hotbar .hk");
    hks[0].querySelector(".nm").textContent = C.skills[0].n;
    const s2 = C.skills.find(s => s.lvl <= p.level && s.k !== C.skills[0].k);
    hks[1].querySelector(".nm").textContent = s2 ? s2.n : "—";
    hks[1].classList.toggle("cd", !!s2 && (p.cd && p.cd[s2.k] > 0));
    hks[0].classList.toggle("cd", !!(p.cd && p.cd[C.skills[0].k] > 0));
    if (hks[4]) hks[4].classList.toggle("on", !!(st.delve || st.map.kind === "dungeon"));
    // party
    const pb = document.getElementById("partybox");
    pb.innerHTML = "";
    for (const pet of st.pets.filter(x => x.active)) {
      const d = EH.el("div", "pcard");
      d.title = `${pet.name} · Lv${pet.level} · ${pet.role}`;
      d.appendChild(EH.Art.pet(pet.body, pet.c, 0, pet.fly));
      d.querySelector("canvas").style.width = "100%"; d.querySelector("canvas").style.height = "100%";
      pb.appendChild(d);
    }
    for (const c of st.companions.filter(x => x.active)) {
      const d = EH.el("div", "pcard");
      d.title = `${c.name} · Lv${c.level} · ${c.job}`;
      const set = EH.Art.humanoid(c.look).front;
      const cv = set[0];
      const holder = EH.el("div"); holder.style.cssText = "width:100%;height:100%;display:flex;align-items:flex-end;justify-content:center";
      const c2 = document.createElement("canvas"); c2.width = 16; c2.height = 24;
      c2.getContext("2d").drawImage(cv, 0, 0);
      c2.style.cssText = "width:100%;height:100%;image-rendering:pixelated;object-fit:contain";
      holder.appendChild(c2); d.appendChild(holder);
      const bar = EH.el("div", "pb"); const fill = EH.el("i"); fill.style.width = EH.clamp(c.hp / c.hpMax * 100, 0, 100) + "%"; bar.appendChild(fill);
      d.appendChild(bar);
      const nm = EH.el("div", "pn", EH.esc(c.name.split(" ")[0])); d.appendChild(nm);
      pb.appendChild(d);
    }
    // quest markers count
    const qb = document.querySelector('.nav button[data-panel="quest"]');
    if (qb) {
      const n = st.quests.active.filter(q => q.state === "ready").length;
      qb.textContent = "QUESTS" + (n ? " (" + n + ")" : "");
      qb.style.color = n ? "#7ec850" : "";
    }
    // refresh open panels
    for (const name of Array.from(open)) refreshPanel(name);
    if (currentNpc) refreshDialogue();
  }
  function portraitOpts(p) {
    const C = EH.CLASS[p.cls];
    return Object.assign({ cls: p.cls }, p.look, {});
  }

  /* ══════════════════════════════════════════════════════════
     PANEL FRAMEWORK
     ══════════════════════════════════════════════════════════ */
  const SIZES = {
    char: { w: 420, h: 520 }, inv: { w: 440, h: 500 }, build: { w: 460, h: 520 },
    town: { w: 560, h: 540 }, quest: { w: 460, h: 480 }, pet: { w: 480, h: 500 }, menu: { w: 380, h: 420 },
  };
  const TITLES = { char: "CHARACTER", inv: "SATCHEL", build: "CONSTRUCTION", town: "EMBERHOLD", quest: "JOURNAL", pet: "BEASTS", menu: "MENU" };

  function toggle(name) {
    if (open.has(name)) close(name); else openPanel(name);
  }
  function openPanel(name) {
    if (name === "build" || name === "town") { close("build"); close("town"); }
    let el = document.getElementById("panel-" + name);
    if (!el) {
      el = EH.el("div", "panel center px");
      el.id = "panel-" + name;
      const s = SIZES[name] || { w: 420, h: 460 };
      el.style.width = Math.min(s.w, window.innerWidth - 20) + "px";
      el.style.height = Math.min(s.h, window.innerHeight - 130) + "px";
      el.innerHTML = `<div class="ph"><h2>${TITLES[name] || name}</h2><button class="x">✕</button></div><div class="pb2"></div>`;
      el.querySelector(".x").addEventListener("click", () => close(name));
      panelsEl.appendChild(el);
      makeDraggable(el);
    }
    el.classList.remove("hidden");
    open.add(name);
    document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("on", b.dataset.panel === name && open.has(name)));
    refreshPanel(name);
  }
  function close(name) {
    const el = document.getElementById("panel-" + name);
    if (el) el.classList.add("hidden");
    open.delete(name);
    document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("on", false));
  }
  function closeAll() { for (const n of Array.from(open)) close(n); }
  function makeDraggable(el) {
    const h = el.querySelector(".ph");
    let sx, sy, ox, oy, drag = false;
    h.addEventListener("pointerdown", e => {
      if (e.target.tagName === "BUTTON") return;
      drag = true; el.style.transform = ""; sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect(); ox = r.left; oy = r.top;
      el.style.left = ox + "px"; el.style.top = oy + "px"; el.style.transform = "none";
      h.setPointerCapture(e.pointerId);
    });
    h.addEventListener("pointermove", e => { if (!drag) return; el.style.left = (ox + e.clientX - sx) + "px"; el.style.top = (oy + e.clientY - sy) + "px"; });
    h.addEventListener("pointerup", () => drag = false);
    h.addEventListener("pointercancel", () => drag = false);
  }

  function refreshPanel(name) {
    const el = document.getElementById("panel-" + name);
    if (!el || el.classList.contains("hidden")) return;
    const body = el.querySelector(".pb2");
    const R = { char: charPanel, inv: invPanel, build: buildPanel, town: townPanel, quest: questPanel, pet: petPanel, menu: menuPanel }[name];
    if (R) { const sc = body.scrollTop; body.innerHTML = ""; R(body); body.scrollTop = sc; }
  }

  /* ══════════════════════════════════════════════════════════
     CHARACTER PANEL
     ══════════════════════════════════════════════════════════ */
  function charPanel(host) {
    const p = st.player, D = st.derived, C = EH.CLASS[p.cls];
    const head = EH.el("div", "sec");
    head.style.cssText = "display:flex;gap:12px;align-items:center";
    const pf = EH.el("div", "portrait"); pf.style.cssText = "width:72px;height:72px;flex:0 0 72px";
    pf.appendChild(EH.Art.portrait(portraitOpts(p)));
    const info = EH.el("div");
    const job = C.jobs.filter(j => j.lvl <= p.level).pop();
    info.innerHTML = `
      <div style="font-size:17px;color:var(--gold);font-weight:700;text-shadow:0 2px 0 #000">${EH.esc(p.name)}</div>
      <div style="font-size:11px;color:${C.c};font-weight:700;letter-spacing:1px">${C.n.toUpperCase()} · ${job ? job.n.toUpperCase() : ""}</div>
      <div style="font-size:10px;color:#8d7f6a;margin-top:3px">Level ${p.level} · ${EH.fmt(p.xp)}/${EH.fmt(EH.xpFor(p.level))} XP</div>
      <div style="font-size:10px;color:#8d7f6a">Stat points: <b style="color:${p.ptsLeft ? "#7ec850" : "#8d7f6a"}">${p.ptsLeft}</b></div>
      <div style="font-size:9.5px;color:#7d705c;margin-top:4px;font-style:italic;max-width:260px">${C.desc}</div>`;
    head.appendChild(pf); head.appendChild(info); host.appendChild(head);

    // advancement track
    const adv = EH.el("div", "sec");
    adv.innerHTML = `<h3>ADVANCEMENT</h3>`;
    const track = EH.el("div"); track.style.cssText = "display:flex;gap:4px;flex-wrap:wrap";
    for (const j of C.jobs) {
      const d = EH.el("div");
      d.style.cssText = `flex:1;min-width:80px;padding:5px;text-align:center;border:1px solid #332b25;background:#1e1915;font-size:9.5px;${j.lvl <= p.level ? "border-color:var(--gold2);color:var(--gold)" : "color:#5d5449"}`;
      d.innerHTML = `<b>${j.n}</b><br><span style="font-size:8px">Lv ${j.lvl}</span>`;
      track.appendChild(d);
    }
    adv.appendChild(track); host.appendChild(adv);

    // primary stats
    const s1 = EH.el("div", "sec");
    s1.innerHTML = `<h3>ATTRIBUTES</h3>`;
    const g = EH.el("div", "statgrid");
    for (const S of EH.STATLIST) {
      const v = D.s[S.k], base = C.base[S.k] + C.grow[S.k] * (p.level - 1) + (p.pts[S.k] || 0);
      const bonus = v - Math.round(base);
      const row = EH.el("div", "statline");
      row.innerHTML = `<span class="sn" title="${S.d}">${S.n}</span>
        <span class="sv">${Math.round(v)}${bonus > 0 ? `<span style="color:#7ec850;font-size:9px"> +${bonus}</span>` : ""}</span>`;
      const b = EH.el("button", null, "+");
      b.disabled = p.ptsLeft <= 0;
      b.addEventListener("click", () => { p.pts[S.k] = (p.pts[S.k] || 0) + 1; p.ptsLeft--; st.derived = EH.Items.derive(p, st); syncAll(); });
      b.title = S.d;
      row.appendChild(b);
      g.appendChild(row);
    }
    s1.appendChild(g); host.appendChild(s1);

    // derived
    const s2 = EH.el("div", "sec");
    s2.innerHTML = `<h3>COMBAT</h3>`;
    const rows = [
      ["Attack", Math.round(D.atk) + (D.isCaster ? " (spell)" : D.isRanged ? " (ranged)" : " (melee)")],
      ["Max HP", D.hpMax], ["Defence", D.def],
      ["Critical", D.crit.toFixed(1) + "%  (×" + (D.critdmg / 100).toFixed(2) + ")"],
      ["Dodge", D.dodge.toFixed(1) + "%"],
      ["Attack speed", (1 / D.atkCd).toFixed(2) + "/s"], ["Attack range", D.atkRange.toFixed(1)],
      ["Move speed", D.speed.toFixed(2)], ["HP regen", D.regen.toFixed(2) + "/s"],
      ["Life steal", D.leech + "%"], ["Gold find", Math.round((D.goldfind - 1) * 100) + "%"],
      ["Item find", Math.round((D.itemfind - 1) * 100) + "%"], ["XP gain", Math.round((D.xpgain - 1) * 100) + "%"],
      ["Vision", D.vision.toFixed(1) + (D.burn ? " · Burn " + D.burn : "")],
      ["Carry", Math.round(D.carry) + " / " + p.cap + " slots"],
    ];
    const g2 = EH.el("div", "statgrid");
    for (const [k, v] of rows) { const r = EH.el("div", "statline"); r.innerHTML = `<span class="sn">${k}</span><span class="sv">${v}</span>`; g2.appendChild(r); }
    s2.appendChild(g2); host.appendChild(s2);

    // equipment
    const s3 = EH.el("div", "sec");
    s3.innerHTML = `<h3>EQUIPMENT</h3>`;
    const pd = EH.el("div", "paperdoll");
    const layout = [["head", null, "amul"], ["wpn", "chest", "ring"], ["off", "legs", "ring2"], [null, "boot", "cloak"]];
    const usedRing = [];
    for (const rowL of layout) {
      for (let slot of rowL) {
        if (slot === "ring2") slot = "ring";
        const cell = EH.el("div", "slot" + (slot ? "" : " empty"));
        if (!slot) { pd.appendChild(cell); continue; }
        const it = p.equip[slot];
        const lbl = EH.el("div", "slotlabel", EH.SLOTS[slot] ? EH.SLOTS[slot].slice(0, 3).toUpperCase() : "");
        cell.appendChild(lbl);
        if (it) {
          cell.classList.add("r-" + it.rar, "eq");
          const c = EH.Art.icon(it.icon, it.c || "#c8c8d0", { up: it.up });
          cell.appendChild(c);
          cell.addEventListener("click", () => { EH.Items.unequip(p, slot); st.derived = EH.Items.derive(p, st); syncAll(); EH.log(`Unequipped ${it.name}.`); });
          hoverTip(cell, () => EH.Items.tip(it) + `<div class="tt-stat" style="color:#7d705c;margin-top:4px">Click to unequip</div>`);
        } else {
          cell.classList.add("empty");
        }
        pd.appendChild(cell);
      }
    }
    s3.appendChild(pd); host.appendChild(s3);

    // skills
    const s4 = EH.el("div", "sec");
    s4.innerHTML = `<h3>SKILLS</h3>`;
    for (const sk of C.skills) {
      const r = EH.el("div", "row");
      r.style.cssText = "display:block;padding:6px 8px;background:#1e1915;border:1px solid #332b25;margin-bottom:3px";
      const unlocked = p.level >= sk.lvl;
      r.innerHTML = `<div style="display:flex;gap:8px;align-items:center;${unlocked ? "" : "opacity:.45"}">
        <span class="ic"></span>
        <div style="flex:1"><b style="color:${unlocked ? "var(--gold)" : "#7d705c"}">${sk.n}</b>
        <span style="font-size:9px;color:#8d7f6a"> · ${sk.cd}s cooldown${unlocked ? "" : " · unlocks at Lv " + sk.lvl}</span>
        <div style="font-size:10px;color:#a89880;line-height:1.4;margin-top:2px">${sk.desc}</div></div></div>`;
      r.querySelector(".ic").appendChild(EH.Art.icon(sk.icon, unlocked ? C.c : "#5d5449"));
      s4.appendChild(r);
    }
    host.appendChild(s4);
  }

  /* ══════════════════════════════════════════════════════════
     INVENTORY
     ══════════════════════════════════════════════════════════ */
  let invTab = "all";
  function invPanel(host) {
    const p = st.player;
    const tabs = EH.el("div", "");
    tabs.style.cssText = "display:flex;gap:3px;margin-bottom:8px";
    for (const t of [["all", "All"], ["eq", "Gear"], ["use", "Consumables"], ["mat", "Materials"]]) {
      const b = EH.el("button", "btn sm" + (invTab === t[0] ? " gold" : ""), t[1]);
      b.addEventListener("click", () => { invTab = t[0]; refreshPanel("inv"); });
      tabs.appendChild(b);
    }
    const sell = EH.el("button", "btn sm", "Sell all common gear");
    sell.style.marginLeft = "auto";
    sell.addEventListener("click", () => {
      let total = 0, n = 0;
      for (let i = p.inv.length - 1; i >= 0; i--) {
        const it = p.inv[i];
        if (it.eq && (it.rar === "common" || it.rar === "uncommon")) {
          total += Math.round(EH.Items.value(it) * 0.5); p.inv.splice(i, 1); n++;
        }
      }
      if (!n) { EH.toast("Nothing to sell"); return; }
      st.res.gold += total;
      EH.log(`Sold ${n} items for <b class="gold">${EH.fmt(total)}g</b>.`, "gold");
      syncAll();
    });
    tabs.appendChild(sell);
    host.appendChild(tabs);

    const info = EH.el("div");
    info.style.cssText = "font-size:10px;color:#8d7f6a;margin-bottom:8px";
    info.textContent = `${p.inv.length} / ${p.cap} slots · Click an item to use or equip it, right-click to sell.`;
    host.appendChild(info);

    const g = EH.el("div", "grid");
    let shown = 0;
    for (const it of p.inv) {
      if (invTab === "eq" && !it.eq) continue;
      if (invTab === "use" && (it.eq || !["potion", "food", "buff", "scroll", "petfood"].includes(it.kind))) continue;
      if (invTab === "mat" && (it.eq || ["potion", "food", "buff", "scroll", "petfood"].includes(it.kind))) continue;
      shown++;
      const cell = EH.el("div", "slot" + (it.eq ? " r-" + it.rar : ""));
      cell.appendChild(EH.Art.icon(it.icon, it.c || "#c8a05a", { up: it.up }));
      if (it.qty > 1) cell.appendChild(EH.el("div", "q", it.qty));
      cell.addEventListener("click", () => useItem(it));
      cell.addEventListener("contextmenu", e => { e.preventDefault(); sellItem(it); });
      hoverTip(cell, () => EH.Items.tip(it) + `<div class="tt-stat" style="color:#7d705c;margin-top:4px">${it.eq ? "Click to equip · Right-click to sell" : "Click to use · Right-click to sell"}</div>`);
      g.appendChild(cell);
    }
    host.appendChild(g);
    if (!shown) host.appendChild(EH.el("div", null, `<div style="padding:30px;text-align:center;color:#5d5449;font-size:11px">Empty. Go down the stairs and come back rich.</div>`));
  }
  function useItem(it) {
    const p = st.player;
    if (it.eq) {
      EH.Items.equip(p, it.uid);
      st.derived = EH.Items.derive(p, st);
      EH.log(`Equipped <b class="r-${it.rar}">${it.name}</b>.`);
      syncAll(); return;
    }
    const d = it.def || {};
    if (d.kind === "potion" || d.kind === "food") {
      if (p.hp >= st.derived.hpMax && d.heal) { EH.toast("Already at full health"); return; }
      EH.Combat.healPlayer(st, Math.round(d.heal * (d.kind === "potion" ? st.derived.potHeal : 1)));
      EH.Items.remove(p.inv, it.uid, 1);
    } else if (d.kind === "buff") {
      EH.buff(st, d.buff, d.amt, d.dur);
      EH.Items.remove(p.inv, it.uid, 1);
      EH.log(`Used ${it.name}. +${d.amt} ${EH.Items.statLabel(d.buff)} for ${EH.fmtDur(d.dur)}.`, "good");
    } else if (d.kind === "petfood") {
      const pet = st.pets.find(x => x.active);
      if (!pet) { EH.toast("No active pet"); return; }
      EH.Combat.feed(st, pet.id);
    } else if (d.fx === "recall") {
      EH.Items.remove(p.inv, it.uid, 1);
      if (st.map.kind === "dungeon") EH.Combat.exitDungeon(st);
    } else if (d.kind === "egg") {
      EH.Items.remove(p.inv, it.uid, 1);
      EH.Combat.hatch(st);
    } else { EH.toast("You can't use that here."); return; }
    syncAll();
  }
  function sellItem(it) {
    const p = st.player;
    const price = Math.max(1, Math.round(EH.Items.value(it) * 0.5));
    EH.Items.remove(p.inv, it.uid, it.eq ? 1 : 1);
    st.res.gold += price;
    EH.log(`Sold ${it.name} for <b class="gold">${price}g</b>.`, "gold");
    syncAll();
  }

  /* ══════════════════════════════════════════════════════════
     BUILD PANEL
     ══════════════════════════════════════════════════════════ */
  let buildTab = "new";
  function buildPanel(host) {
    const tabs = EH.el("div");
    tabs.style.cssText = "display:flex;gap:3px;margin-bottom:8px";
    for (const t of [["new", "Build new"], ["exist", `Existing (${st.buildings.length})`]]) {
      const b = EH.el("button", "btn sm" + (buildTab === t[0] ? " gold" : ""), t[1]);
      b.addEventListener("click", () => { buildTab = t[0]; refreshPanel("build"); });
      tabs.appendChild(b);
    }
    host.appendChild(tabs);

    if (buildTab === "new") {
      const note = EH.el("div");
      note.style.cssText = "font-size:10px;color:#8d7f6a;margin-bottom:8px;line-height:1.5";
      note.innerHTML = `Population <b style="color:var(--gold)">${st.npcs.filter(n => !n.dead).length}/${EH.Town.popCap(st)}</b> · Storage caps: ${["wood", "stone", "food", "ore"].map(k => `${k} ${EH.fmtInt(EH.Build.capOf(st, k))}`).join(", ")}<br>Click a building, then click the ground to place it.`;
      host.appendChild(note);
      for (const key of EH.buildOrder) {
        const B = EH.BUILD[key];
        const locked = B.req && !EH.Build.count(st, B.req);
        const row = EH.el("div", "brow" + (locked ? " locked" : ""));
        const ic = EH.el("div");
        ic.appendChild(EH.Art.building(B.shape, B.roof, B.wall, 1, { done: true }));
        ic.firstChild.style.cssText = "width:34px;height:34px;image-rendering:pixelated;object-fit:contain;object-position:center bottom";
        row.appendChild(ic);
        const info = EH.el("div", "bi");
        info.innerHTML = `<div class="bn">${B.n} <span style="font-size:9px;color:#7d705c">${B.w}×${B.h}</span></div>
          <div class="bd">${locked ? `Requires a ${EH.BUILD[B.req].n}.` : B.desc}</div>
          <div class="bc">${EH.Build.affordText(st, B.cost)} · ${EH.fmtDur(B.time)}</div>`;
        row.appendChild(info);
        const go = EH.el("button", "btn sm" + (EH.Build.canAfford(st, B.cost) && !locked ? " gold" : ""), "Place");
        go.disabled = locked || !EH.Build.canAfford(st, B.cost);
        go.addEventListener("click", e => { e.stopPropagation(); startPlace(key); });
        row.appendChild(go);
        if (!locked) row.addEventListener("click", () => startPlace(key));
        host.appendChild(row);
      }
    } else {
      const sorted = st.buildings.slice().sort((a, b) => a.type.localeCompare(b.type) || a.y - b.y);
      for (const b of sorted) {
        const B = EH.BUILD[b.type];
        const row = EH.el("div", "brow");
        const ic = EH.el("div");
        ic.appendChild(EH.Art.building(B.shape, B.roof, B.wall, b.lvl, { done: b.done }));
        ic.firstChild.style.cssText = "width:34px;height:34px;image-rendering:pixelated;object-fit:contain;object-position:center bottom";
        row.appendChild(ic);
        const ws = EH.Build.workersOf(st, b);
        const eff = b.done ? EH.Build.efficiency(st, b) : 0;
        const info = EH.el("div", "bi");
        let sub = "";
        if (!b.done) sub = `Building… ${EH.fmtDur(b.t / Math.max(1, st.speed))} left`;
        else if (B.prod) sub = Object.keys(B.prod).map(k => `${k} +${(B.prod[k] * Math.pow(1.6, b.lvl - 1) * eff).toFixed(2)}/min`).join(", ");
        else if (B.svc) sub = `Service: ${B.svc}`;
        else if (B.pop) sub = `Houses ${B.pop * b.lvl}`;
        info.innerHTML = `<div class="bn">${b.name ? EH.esc(b.name) + " " : ""}${B.n} <span style="color:var(--gold2)">Lv ${b.lvl}</span>${b.hp < 100 ? ` <span style="color:#e05a4a">(${Math.round(b.hp)}% hp)</span>` : ""}</div>
          <div class="bd">${sub}${B.workers ? ` · Workers ${ws.length}/${B.workers} · Efficiency ${Math.round(eff * 100)}%` : ""}</div>`;
        row.appendChild(info);
        const btns = EH.el("div");
        btns.style.cssText = "display:flex;flex-direction:column;gap:3px";
        if (b.done && b.lvl < EH.MAXLVL) {
          const cost = EH.Build.costOf(b.type, b.lvl + 1);
          const up = EH.el("button", "btn sm" + (EH.Build.canAfford(st, cost) ? " gold" : ""), "Lv" + (b.lvl + 1));
          up.disabled = !EH.Build.canAfford(st, cost);
          up.title = "Cost: " + Object.entries(cost).map(([k, v]) => v + " " + k).join(", ");
          up.addEventListener("click", e => { e.stopPropagation(); EH.Build.upgrade(st, b); syncAll(); });
          btns.appendChild(up);
        }
        if (b.hp < 100) {
          const rp = EH.el("button", "btn sm green", "Fix");
          rp.addEventListener("click", e => { e.stopPropagation(); EH.Build.repair(st, b); syncAll(); });
          btns.appendChild(rp);
        }
        if (!st.town.starter.includes(b.id)) {
          const dm = EH.el("button", "btn sm red", "✕");
          dm.addEventListener("click", e => { e.stopPropagation(); if (confirm("Demolish " + B.n + "? You recover 40% of materials.")) { EH.Build.demolish(st, b); syncAll(); } });
          btns.appendChild(dm);
        }
        const loc = EH.el("button", "btn sm", "◎");
        loc.title = "Focus camera";
        loc.addEventListener("click", e => { e.stopPropagation(); st.player.path = []; EH.Render.snapCam(st); close("build"); });
        btns.appendChild(loc);
        row.appendChild(btns);
        host.appendChild(row);
      }
    }
  }

  function startPlace(type) {
    st.placing = type;
    close("build");
    const B = EH.BUILD[type];
    document.getElementById("placetext").innerHTML = `Placing <b style="color:var(--gold)">${B.n}</b> — click the ground. <span style="color:#8d7f6a">Right-click or Esc to cancel.</span>`;
    document.getElementById("placebar").classList.add("show");
  }
  function cancelPlace() {
    st.placing = null;
    document.getElementById("placebar").classList.remove("show");
  }

  /* ══════════════════════════════════════════════════════════
     TOWN PANEL
     ══════════════════════════════════════════════════════════ */
  let townTab = "overview";
  function townPanel(host) {
    const tabs = EH.el("div");
    tabs.style.cssText = "display:flex;gap:3px;margin-bottom:8px;flex-wrap:wrap";
    for (const t of [["overview", "Overview"], ["people", `People (${st.npcs.length})`], ["economy", "Economy"], ["research", "Research"]]) {
      const b = EH.el("button", "btn sm" + (townTab === t[0] ? " gold" : ""), t[1]);
      b.addEventListener("click", () => { townTab = t[0]; refreshPanel("town"); });
      tabs.appendChild(b);
    }
    host.appendChild(tabs);

    if (townTab === "overview") {
      const morale = EH.Town.morale(st);
      const rows = [
        ["Town tier", EH.Town.tier(st) + (EH.Build.count(st, "monument") ? "" : " — build an Ember Monument to advance")],
        ["Population", `${st.npcs.filter(n => !n.dead).length} / ${EH.Town.popCap(st)}`],
        ["Morale", `${morale}% — ${morale > 75 ? "thriving" : morale > 50 ? "content" : morale > 30 ? "uneasy" : "miserable"}`],
        ["Defence", EH.Town.defense(st)],
        ["Market tax", Math.round(EH.NPCs.taxRate(st) * 100) + "%"],
        ["Trades today", (st.town.tradesToday || 0) + ` (${EH.fmt(st.town.taxToday || 0)}g taxed)`],
        ["Season", EH.SEASONS[st.time.season].n + " — " + EH.SEASONS[st.time.season].desc],
        ["Deepest floor", st.dungeon.maxFloor || 1],
      ];
      const g = EH.el("div", "statgrid");
      for (const [k, v] of rows) { const r = EH.el("div", "statline"); r.innerHTML = `<span class="sn">${k}</span><span class="sv" style="font-size:10px">${v}</span>`; g.appendChild(r); }
      host.appendChild(g);
      // morale bar
      const mb = EH.el("div"); mb.style.cssText = "margin:10px 0";
      mb.innerHTML = `<div style="font-size:10px;color:#8d7f6a;margin-bottom:3px">MORALE</div>
        <div class="bar hp" style="height:14px"><i style="width:${morale}%;background:linear-gradient(180deg,#90c860,#4a8a30)"></i><b style="line-height:12px">${morale}%</b></div>`;
      host.appendChild(mb);
      // production
      const pr = EH.el("div", "sec");
      pr.innerHTML = `<h3>PRODUCTION (per in-game minute)</h3>`;
      const rates = st.town.rates || {};
      const pg = EH.el("div", "statgrid");
      for (const r of EH.RES) {
        const v = rates[r.k] || 0;
        const row = EH.el("div", "statline");
        row.innerHTML = `<span class="sn">${r.n}</span><span class="sv">${EH.fmt(st.res[r.k] || 0)} <span style="color:${v >= 0 ? "#7ec850" : "#e05a4a"};font-size:9px">${v ? (v > 0 ? "+" : "") + v.toFixed(2) : ""}</span></span>`;
        pg.appendChild(row);
      }
      pr.appendChild(pg); host.appendChild(pr);
      // buildings summary
      const bs = EH.el("div", "sec");
      bs.innerHTML = `<h3>STRUCTURES</h3>`;
      const counts = {};
      for (const b of st.buildings) counts[b.type] = (counts[b.type] || 0) + 1;
      const line = EH.el("div");
      line.style.cssText = "font-size:11px;line-height:1.9;color:var(--parch2)";
      line.innerHTML = Object.keys(counts).map(k => `${EH.BUILD[k].n} ×${counts[k]}${st.buildings.some(b => b.type === k && !b.done) ? " <span style='color:#c8a05a'>(building)</span>" : ""}`).join(" · ");
      bs.appendChild(line); host.appendChild(bs);
    }
    else if (townTab === "people") {
      for (const n of st.npcs) {
        const row = EH.el("div", "row");
        row.style.cssText = "display:flex;gap:8px;align-items:center;background:#1e1915;border:1px solid #332b25;margin-bottom:3px;padding:5px 7px";
        const pf = EH.el("div", "portrait");
        pf.style.cssText = "width:34px;height:34px;flex:0 0 34px";
        pf.appendChild(EH.Art.portrait(n.look));
        row.appendChild(pf);
        const info = EH.el("div"); info.style.flex = "1"; info.style.minWidth = "0";
        const rt = EH.NPCs.relPlayer(n);
        const work = n.work ? EH.Build.get(st, n.work) : null;
        info.innerHTML = `<div style="font-size:11.5px;font-weight:700;color:var(--parch)">${EH.esc(n.name)} <span style="font-size:9px;color:#8d7f6a;font-weight:400">${n.age} · ${n.sex === "f" ? "♀" : "♂"}</span></div>
          <div style="font-size:9.5px;color:#8d7f6a">${n.role}${work ? " · works at " + EH.BUILD[work.type].n : " · no post"}${n.isCompanion ? " · <b style='color:#7ec850'>in your party</b>" : ""}</div>
          <div style="font-size:9px;color:${rt.c}">${rt.n} (${Math.round(n.relP)}) · <span style="color:#8d7f6a">${n.traits.map(t => (EH.TRAITS.find(x => x.k === t) || {}).n || t).join(", ")}</span></div>`;
        row.appendChild(info);
        const needs = EH.el("div");
        needs.style.cssText = "width:78px;flex:0 0 78px";
        for (const [k, lbl, c] of [["energy", "EN", "#f0c05a"], ["hunger", "HU", "#e08a4a"], ["mood", "MO", "#7ec850"]]) {
          const v = Math.round(n.needs[k]);
          const d = EH.el("div");
          d.style.cssText = "display:flex;align-items:center;gap:3px;font-size:8px;color:#7d705c";
          d.innerHTML = `<span style="width:14px">${lbl}</span><span style="flex:1;height:4px;background:#1a1410;border:1px solid #000"><i style="display:block;height:100%;width:${v}%;background:${v < 25 ? "#e05a4a" : c}"></i></span>`;
          needs.appendChild(d);
        }
        row.appendChild(needs);
        const act = EH.el("div"); act.style.cssText = "font-size:8.5px;color:#7d705c;width:56px;text-align:right;flex:0 0 56px";
        act.textContent = n.inside ? "indoors" : (n.act ? n.act.kind : "—");
        row.appendChild(act);
        const talk = EH.el("button", "btn sm", "Talk");
        talk.addEventListener("click", () => { close("town"); EH.UI.dialogue(n); });
        row.appendChild(talk);
        hoverTip(row, () => {
          let h = `<div class="tt-name">${EH.esc(n.name)}</div><div class="tt-type">${n.role} · Level ${n.level}</div>`;
          h += `<div class="tt-stat">Purse: <b style="color:#f0c05a">${EH.fmt(n.gold)}g</b> · Trades: ${n.tradeCount}</div>`;
          h += `<div class="tt-stat">Carrying: ${n.inv.map(e => { const d = EH.CONSUM.find(c => c.id === e.id) || EH.MATS.find(c => c.id === e.id); return (d ? d.n : e.id) + " ×" + e.qty; }).join(", ") || "nothing"}</div>`;
          if (n.memory.length) h += `<div class="tt-flav">${n.memory.slice(0, 3).map(m => "· " + m.t).join("<br>")}</div>`;
          return h;
        });
        host.appendChild(row);
      }
    }
    else if (townTab === "economy") {
      const sup = EH.Town.supply(st);
      const sec = EH.el("div", "sec");
      sec.innerHTML = `<h3>MARKET PRICES (supply & demand)</h3>`;
      const note = EH.el("div");
      note.style.cssText = "font-size:10px;color:#8d7f6a;margin-bottom:8px;line-height:1.5";
      note.innerHTML = `Villagers trade with each other every hour. You collect <b style="color:var(--gold)">${Math.round(EH.NPCs.taxRate(st) * 100)}%</b> of every transaction as market tax.<br>Total taxed so far: <b style="color:var(--gold)">${EH.fmt(st.town.taxTotal || 0)}g</b> from <b>${EH.fmt(st.stats.trades)}</b> trades.`;
      sec.appendChild(note);
      const all = EH.CONSUM.concat(EH.MATS);
      const g = EH.el("div", "statgrid");
      for (const d of all) {
        const price = EH.Town.price(st, d);
        const ratio = price / d.price;
        const r = EH.el("div", "statline");
        r.innerHTML = `<span class="sn">${d.n} <span style="color:#5d5449">×${sup[d.id] || 0}</span></span>
          <span class="sv" style="color:${ratio > 1.15 ? "#e05a4a" : ratio < 0.9 ? "#7ec850" : "var(--gold)"}">${price}g ${ratio > 1.15 ? "▲" : ratio < 0.9 ? "▼" : ""}</span>`;
        g.appendChild(r);
      }
      sec.appendChild(g); host.appendChild(sec);
      const sec2 = EH.el("div", "sec");
      sec2.innerHTML = `<h3>HOLD LEDGER</h3>`;
      const g2 = EH.el("div", "statgrid");
      const ledger = [
        ["Treasury", EH.fmt(st.res.gold) + "g"],
        ["Total earned", EH.fmt(st.stats.goldEarned) + "g"],
        ["Wages (per day)", EH.fmt(EH.CFG.WAGE_PER_DAY * st.npcs.filter(n => !n.dead).length) + "g"],
        ["Market tax total", EH.fmt(st.town.taxTotal || 0) + "g"],
        ["Monster gold", EH.fmt((st.stats.goldEarned || 0) - (st.town.taxTotal || 0)) + "g"],
        ["Items sold", st.stats.itemsSold || 0],
      ];
      for (const [k, v] of ledger) { const r = EH.el("div", "statline"); r.innerHTML = `<span class="sn">${k}</span><span class="sv">${v}</span>`; g2.appendChild(r); }
      sec2.appendChild(g2); host.appendChild(sec2);
    }
    else if (townTab === "research") {
      const lib = EH.Build.firstOf(st, "library");
      if (!lib) {
        host.appendChild(EH.el("div", null, `<div style="padding:30px;text-align:center;color:#5d5449;font-size:11px;line-height:1.7">Build a <b style="color:var(--gold2)">Library</b> to begin research.<br>Old Tobin has been muttering about it for years.</div>`));
        return;
      }
      const note = EH.el("div");
      note.style.cssText = "font-size:10px;color:#8d7f6a;margin-bottom:8px";
      note.textContent = "Permanent upgrades for the whole hold. Research is instant once paid for.";
      host.appendChild(note);
      for (const R of EH.RESEARCH) {
        const done = (st.research || []).includes(R.id);
        const row = EH.el("div", "brow" + (done ? "" : EH.Build.canAfford(st, R.cost) ? "" : " locked"));
        const ic = EH.el("div"); ic.appendChild(EH.Art.icon("book", done ? "#7ec850" : "#8a7a5a")); ic.firstChild.style.cssText = "width:34px;height:34px;image-rendering:pixelated";
        row.appendChild(ic);
        const info = EH.el("div", "bi");
        info.innerHTML = `<div class="bn">${R.n} ${done ? '<span style="color:#7ec850">✓ RESEARCHED</span>' : ""}</div>
          <div class="bd">${R.d}</div>
          ${done ? "" : `<div class="bc">${EH.Build.affordText(st, R.cost)}</div>`}`;
        row.appendChild(info);
        if (!done) {
          const b = EH.el("button", "btn sm gold", "Research");
          b.disabled = !EH.Build.canAfford(st, R.cost);
          b.addEventListener("click", () => {
            if (!EH.Build.pay(st, R.cost)) return;
            st.research = st.research || []; st.research.push(R.id);
            st.derived = EH.Items.derive(st.player, st);
            EH.log(`<b class="good">Researched: ${R.n}</b> — ${R.d}`, "good");
            EH.toast(R.n + " researched");
            syncAll();
          });
          row.appendChild(b);
        }
        host.appendChild(row);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════
     QUEST PANEL
     ══════════════════════════════════════════════════════════ */
  function questPanel(host) {
    const sec = EH.el("div", "sec");
    sec.innerHTML = `<h3>ACTIVE (${st.quests.active.length}/6)</h3>`;
    if (!st.quests.active.length) sec.appendChild(EH.el("div", null, `<div style="padding:14px;color:#5d5449;font-size:11px">No active quests. Talk to the villagers — <b style="color:var(--gold2)">Bram</b> in the plaza always has work.</div>`));
    for (const q of st.quests.active) {
      const row = EH.el("div");
      row.style.cssText = "background:#1e1915;border:1px solid #332b25;border-left:4px solid " + (q.state === "ready" ? "#7ec850" : "#8a6a3a") + ";padding:7px 9px;margin-bottom:4px";
      const R = q.reward;
      row.innerHTML = `<div style="font-size:12px;font-weight:700;color:${q.state === "ready" ? "#7ec850" : "var(--parch)"}">${EH.esc(q.title)}</div>
        <div style="font-size:10px;color:#a89880;line-height:1.5;margin:3px 0">${EH.esc(q.desc || "")}</div>
        <div style="font-size:9.5px;color:#8d7f6a">From ${EH.esc(q.giverName)} · Progress <b style="color:var(--gold)">${q.have}/${q.need}</b>${q.state === "ready" ? " · <b style='color:#7ec850'>READY — return to " + EH.esc(q.giverName) + "</b>" : ""}</div>
        <div style="font-size:9.5px;color:#c8a05a;margin-top:2px">Reward: ${EH.fmt(R.gold)}g · ${EH.fmt(R.xp)} xp · +${R.rep} rep${R.item ? " · an item" : ""}${R.res ? " · " + Object.entries(R.res).map(([k, v]) => v + " " + k).join(", ") : ""}</div>
        <div class="bar xp" style="margin-top:4px"><i style="width:${EH.clamp(q.have / q.need * 100, 0, 100)}%"></i></div>`;
      const btns = EH.el("div"); btns.style.cssText = "display:flex;gap:4px;margin-top:5px";
      const g = EH.NPCs.byId(st, q.giver);
      if (g && q.state === "ready") {
        const b = EH.el("button", "btn sm green", "Turn in");
        b.addEventListener("click", () => { EH.Quests.complete(st, q); syncAll(); });
        btns.appendChild(b);
      } else if (g) {
        const b = EH.el("button", "btn sm", "Find " + g.name.split(" ")[0]);
        b.addEventListener("click", () => { focusEntity(g); close("quest"); });
        btns.appendChild(b);
      }
      const ab = EH.el("button", "btn sm red", "Abandon");
      ab.addEventListener("click", () => { EH.Quests.abandon(st, q); syncAll(); });
      btns.appendChild(ab);
      row.appendChild(btns);
      sec.appendChild(row);
    }
    host.appendChild(sec);

    if (st.quests.board.length) {
      const sec2 = EH.el("div", "sec");
      sec2.innerHTML = `<h3>NOTICE BOARD</h3>`;
      const note = EH.el("div");
      note.style.cssText = "font-size:9.5px;color:#7d705c;margin-bottom:6px";
      note.textContent = "Requests villagers posted for each other. Anyone may take them — including you.";
      sec2.appendChild(note);
      for (const q of st.quests.board) {
        const row = EH.el("div");
        row.style.cssText = "background:#1e1915;border:1px solid #332b25;padding:6px 8px;margin-bottom:3px;display:flex;gap:8px;align-items:center";
        row.innerHTML = `<div style="flex:1"><div style="font-size:11px;font-weight:700;color:var(--parch2)">${EH.esc(q.title)}</div>
          <div style="font-size:9px;color:#7d705c">posted by ${EH.esc(q.giverName)} · ${EH.fmt(q.reward.gold)}g · ${EH.fmt(q.reward.xp)} xp</div></div>`;
        const b = EH.el("button", "btn sm gold", "Take");
        b.addEventListener("click", () => { EH.Quests.takeFromBoard(st, q); syncAll(); });
        row.appendChild(b);
        sec2.appendChild(row);
      }
      host.appendChild(sec2);
    }

    const sec3 = EH.el("div", "sec");
    sec3.innerHTML = `<h3>COMPLETED (${st.quests.done.length})</h3>`;
    const list = EH.el("div");
    list.style.cssText = "font-size:10px;color:#7d705c;line-height:1.8;max-height:130px;overflow-y:auto";
    list.innerHTML = st.quests.done.slice().reverse().map(q => `Day ${q.day} · ${EH.esc(q.title)} <span style="color:#5d5449">(for ${EH.esc(q.by)})</span>`).join("<br>") || "None yet.";
    sec3.appendChild(list); host.appendChild(sec3);
  }
  function focusEntity(e) {
    st.player.path = [];
    EH.Mover.setPath(st.player, st.map, Math.round(e.x), Math.round(e.y), { adjacent: true });
    EH.toast("Walking to " + (e.name || "target"));
  }

  /* ══════════════════════════════════════════════════════════
     PET PANEL
     ══════════════════════════════════════════════════════════ */
  function petPanel(host) {
    const max = 2 + (EH.Items.researchFx(st).petSlot || 0) + EH.Build.count(st, "kennel");
    const note = EH.el("div");
    note.style.cssText = "font-size:10px;color:#8d7f6a;margin-bottom:8px;line-height:1.5";
    note.innerHTML = `<b style="color:var(--gold)">${st.pets.length}/${max}</b> beasts in the kennel. Active pets follow you; combat pets fight; workers boost a building; scouts and merchants give passive bonuses.<br>Feed them <b style="color:#c8a05a">Pet Treats</b> — a neglected beast runs off.`;
    host.appendChild(note);
    if (!st.pets.length) {
      host.appendChild(EH.el("div", null, `<div style="padding:26px;text-align:center;color:#5d5449;font-size:11px;line-height:1.8">No beasts yet.<br>Buy a <b style="color:var(--gold2)">Mystery Egg</b> from Wren at the Kennel,<br>find one in a dungeon chest, or take one from a boss.</div>`));
    }
    for (const pet of st.pets) {
      const row = EH.el("div", "brow");
      row.style.borderLeft = `4px solid ${pet.rarC}`;
      const ic = EH.el("div");
      const c = document.createElement("canvas"); c.width = 14; c.height = 12;
      c.getContext("2d").drawImage(EH.Art.pet(pet.body, pet.c, 0, pet.fly), 0, 0);
      c.style.cssText = "width:34px;height:34px;image-rendering:pixelated;object-fit:contain";
      ic.appendChild(c); row.appendChild(ic);
      const info = EH.el("div", "bi");
      info.innerHTML = `<div class="bn" style="color:${pet.rarC}">${EH.esc(pet.name)} <span style="font-size:10px;color:#8d7f6a">Lv ${pet.level}</span></div>
        <div class="bd">${pet.role.toUpperCase()} · ${EH.esc(pet.skill.n)}: ${EH.esc(pet.skill.d)}</div>
        <div class="bd" style="color:#a89880">HP ${Math.round(pet.hp)}/${pet.hpMax} · ATK ${pet.atk}${pet.fx ? " · " + Object.entries(pet.fx).map(([k, v]) => `${EH.Items.statLabel(k)} +${v}${EH.Items.pctStat(k) ? "%" : ""}`).join(", ") : ""}</div>
        <div class="bd">Happiness <span style="color:${pet.happy < 30 ? "#e05a4a" : pet.happy > 75 ? "#7ec850" : "#c8a05a"}">${Math.round(pet.happy)}%</span>
          <span style="display:inline-block;width:60px;height:4px;background:#1a1410;border:1px solid #000;vertical-align:middle"><i style="display:block;height:100%;width:${pet.happy}%;background:${pet.happy < 30 ? "#e05a4a" : "#7ec850"}"></i></span>
          · XP ${EH.fmt(pet.xp)}/${EH.fmt(EH.petXpFor(pet.level))}</div>`;
      row.appendChild(info);
      const btns = EH.el("div"); btns.style.cssText = "display:flex;flex-direction:column;gap:3px";
      const act = EH.el("button", "btn sm " + (pet.active ? "green" : ""), pet.active ? "Active" : "Release");
      act.addEventListener("click", e => {
        e.stopPropagation();
        const activeCount = st.pets.filter(p => p.active).length;
        if (!pet.active && activeCount >= max) { EH.toast("Kennel full (" + max + " active)"); return; }
        pet.active = !pet.active;
        if (pet.active) { pet.x = st.player.x + EH.rand(-1, 1); pet.y = st.player.y + EH.rand(-1, 1); }
        EH.log(`${pet.name} is now ${pet.active ? "at your side" : "resting in the kennel"}.`);
        st.derived = EH.Items.derive(st.player, st); syncAll();
      });
      btns.appendChild(act);
      const feed = EH.el("button", "btn sm", "Feed");
      feed.addEventListener("click", e => { e.stopPropagation(); EH.Combat.feed(st, pet.id); syncAll(); });
      btns.appendChild(feed);
      if (pet.role === "worker") {
        const targets = st.buildings.filter(b => b.done && EH.BUILD[b.type].workers);
        const sel = EH.el("select");
        sel.style.cssText = "font-family:var(--font);font-size:9px;background:#1e1915;color:var(--parch2);border:1px solid #332b25;padding:2px";
        sel.appendChild(new Option("— idle —", ""));
        for (const b of targets) sel.appendChild(new Option(EH.BUILD[b.type].n + " Lv" + b.lvl, b.id));
        sel.value = pet.assign || "";
        sel.addEventListener("change", e => { e.stopPropagation(); pet.assign = sel.value || null; EH.log(`${pet.name} assigned to ${pet.assign ? EH.BUILD[EH.Build.get(st, pet.assign).type].n : "no post"}.`); syncAll(); });
        btns.appendChild(sel);
      }
      const rel = EH.el("button", "btn sm red", "Free");
      rel.title = "Release into the wild";
      rel.addEventListener("click", e => {
        e.stopPropagation();
        if (!confirm("Release " + pet.name + " into the vale?")) return;
        st.pets.splice(st.pets.indexOf(pet), 1);
        EH.log(`${pet.name} trots off into the treeline. You feel worse about this than you expected.`, "bad");
        st.derived = EH.Items.derive(st.player, st); syncAll();
      });
      btns.appendChild(rel);
      row.appendChild(btns);
      host.appendChild(row);
    }
  }

  /* ══════════════════════════════════════════════════════════
     MENU
     ══════════════════════════════════════════════════════════ */
  function menuPanel(host) {
    const sec = EH.el("div", "sec");
    sec.innerHTML = `<h3>GAME</h3>`;
    const mk = (label, fn, cls, sub) => {
      const b = EH.el("button", "btn " + (cls || ""), label);
      b.style.cssText = "width:100%;margin-bottom:4px;text-align:left";
      b.addEventListener("click", fn);
      const w = EH.el("div"); w.style.marginBottom = "4px";
      w.appendChild(b);
      if (sub) w.appendChild(EH.el("div", null, `<div style="font-size:9px;color:#7d705c;margin:-2px 0 6px 2px">${sub}</div>`));
      sec.appendChild(w);
    };
    mk("Save now", () => EH.Game.save(true), "gold", "Autosaves every " + EH.CFG.AUTOSAVE + "s. Progress is kept in this browser.");
    mk("Sleep until dawn", () => { EH.Game.sleep(); close("menu"); }, "", "Skips the night. The town keeps working while you do.");
    mk("Enter the Hollowdeep", () => { close("menu"); EH.Combat.enterDungeon(st, st.dungeon.maxFloor || 1); }, "", "Descend to floor " + (st.dungeon.maxFloor || 1) + ".");
    sec.appendChild(EH.el("hr"));
    host.appendChild(sec);

    const sec2 = EH.el("div", "sec");
    sec2.innerHTML = `<h3>CONTROLS</h3>`;
    const keys = [["WASD / Arrows", "Pan the camera (the Warden stays put)"], ["Left click", "Talk · build · delve — an order, not a joystick"], ["E", "Talk to the nearest villager"], ["Space", "Strike the nearest foe"], ["1 / 2 / 3", "Skill · Skill · Potion"], ["F", "Send the Warden to the Hollowdeep"], ["R", "Recall to the village"], ["C I B T Q P", "Panels"], ["+ / −", "Game speed"], ["Esc", "Close"]];
    sec2.innerHTML += `<p style="font-size:10.5px;color:#a89880;line-height:1.5;margin:6px 0 0">You never steer the Warden directly. Movement, targeting and spell choice are the Warden's own — your levers are orders, gear, consumables and buildings.</p>`;
    const g = EH.el("div", "statgrid");
    for (const [k, v] of keys) { const r = EH.el("div", "statline"); r.innerHTML = `<span class="sn" style="color:var(--gold2);font-weight:700">${k}</span><span class="sv" style="font-weight:400;font-size:10px;color:#a89880">${v}</span>`; g.appendChild(r); }
    sec2.appendChild(g); host.appendChild(sec2);

    const sec3 = EH.el("div", "sec");
    sec3.innerHTML = `<h3>STATISTICS</h3>`;
    const g3 = EH.el("div", "statgrid");
    const S = st.stats;
    for (const [k, v] of [["Days survived", st.time.day], ["Monsters slain", EH.fmtInt(S.kills)], ["Gold earned", EH.fmt(S.goldEarned)], ["Deepest floor", st.dungeon.maxFloor || 1], ["Bosses slain", S.legendary ? st.dungeon.bossesKilled || 0 : st.dungeon.bossesKilled || 0], ["Quests done", S.quests], ["Buildings raised", S.built], ["Items found", S.itemsFound], ["Legendaries", S.legendary], ["Village trades", EH.fmtInt(S.trades)], ["Deaths", S.deaths], ["Play time", EH.fmtDur(S.playTime)]]) {
      const r = EH.el("div", "statline"); r.innerHTML = `<span class="sn">${k}</span><span class="sv">${v}</span>`; g3.appendChild(r);
    }
    sec3.appendChild(g3); host.appendChild(sec3);

    const sec4 = EH.el("div", "sec");
    sec4.innerHTML = `<h3>DANGER</h3>`;
    const b = EH.el("button", "btn red", "Abandon this hold (new game)");
    b.style.width = "100%";
    b.addEventListener("click", () => { if (confirm("Erase your save and start a new hold?")) { EH.store.del(EH.CFG.SAVE_KEY); location.reload(); } });
    sec4.appendChild(b);
    host.appendChild(sec4);

    const foot = EH.el("div");
    foot.style.cssText = "font-size:9px;color:#5d5449;text-align:center;margin-top:12px;line-height:1.6";
    foot.innerHTML = `EMBERHOLD — prototype vertical slice<br>All art generated procedurally at runtime. No image assets.`;
    host.appendChild(foot);
  }

  /* ══════════════════════════════════════════════════════════
     DIALOGUE + SHOPS
     ══════════════════════════════════════════════════════════ */
  function dialogue(npc) {
    currentNpc = npc;
    const d = document.getElementById("dialogue");
    d.classList.remove("hidden");
    d.innerHTML = `<div id="dlg-top">
        <div id="dlg-portrait"></div>
        <div id="dlg-body">
          <div id="dlg-name"></div><div id="dlg-role"></div>
          <div id="dlg-text"></div><div id="dlg-rel"></div>
        </div>
      </div>
      <div id="dlg-opts"></div>
      <div id="dlg-shop"></div>`;
    d.dataset.spoken = ""; d.dataset.optSig = "";   // stale state from the last villager
    document.getElementById("dlg-portrait").appendChild(EH.Art.portrait(npc.look));
    refreshDialogue(true);
    // step closer
    if (EH.dist(npc.x, npc.y, st.player.x, st.player.y) > 3) {
      EH.Mover.setPath(st.player, st.map, Math.round(npc.x), Math.round(npc.y), { adjacent: true });
    }
    npc.wait = 6;
  }
  function refreshDialogue(first) {
    const npc = currentNpc; if (!npc) return;
    const d = document.getElementById("dialogue");
    if (!d || d.classList.contains("hidden")) return;
    document.getElementById("dlg-name").textContent = npc.name;
    document.getElementById("dlg-role").textContent = npc.role + (npc.work ? " · " + (EH.Build.get(st, npc.work) ? EH.BUILD[EH.Build.get(st, npc.work).type].n : "") : "");
    const rt = EH.NPCs.relPlayer(npc);
    document.getElementById("dlg-rel").innerHTML = `Regard: <span style="color:${rt.c}">${rt.n} (${Math.round(npc.relP)})</span> · Purse: <b style="color:#f0c05a">${EH.fmt(npc.gold)}g</b> · Mood ${Math.round(npc.needs.mood)}% · ${npc.traits.map(t => (EH.TRAITS.find(x => x.k === t) || {}).n || t).join(", ")}`;
    if (first || !d.dataset.spoken) {
      document.getElementById("dlg-text").innerHTML = EH.esc(EH.NPCs.greeting(npc, st));
      d.dataset.spoken = "1";
    }
    /* syncAll() runs ~8×/s and lands here. Rebuilding the option buttons on
       every tick destroyed the element under the cursor (clicks fell through)
       and made the box visibly jitter, so rebuild only when the option list
       actually changed. */
    const opts = document.getElementById("dlg-opts");
    const list = EH.NPCs.options(npc, st);
    const sig = list.map(o => o.k + "|" + o.act + "|" + o.label).join("~");
    if (sig !== d.dataset.optSig) {
      d.dataset.optSig = sig;
      opts.innerHTML = "";
      for (const o of list) {
        const b = EH.el("button", o.k, EH.esc(o.label));
        b.addEventListener("click", () => doOption(o.act));
        opts.appendChild(b);
      }
    }
  }
  function setText(t) { const e = document.getElementById("dlg-text"); if (e) e.innerHTML = t; }
  function closeDialogue() {
    currentNpc = null; shopMode = null;
    const d = document.getElementById("dialogue");
    d.classList.add("hidden"); d.dataset.spoken = "";
    const s = document.getElementById("dlg-shop"); if (s) s.innerHTML = "";
  }
  function doOption(act) {
    const npc = currentNpc; if (!npc) return;
    const shopEl = document.getElementById("dlg-shop");
    if (act === "close") { EH.NPCs.say(npc, EH.pick(["Take care.", "Until next time.", "Mind the dark.", "Aye."]), 2.4); closeDialogue(); return; }
    if (act === "chat") {
      setText(EH.esc(EH.pick(npc.lines.length ? npc.lines.concat(EH.GREET.day) : EH.GREET.day)));
      EH.NPCs.addRelP(npc, 0.6, st);
      return;
    }
    if (act === "request" || act === "accept" || act === "progress" || act === "complete") return questOption(act, npc);
    if (act === "shop") { shopMode = "shop"; return renderShop(npc, shopEl); }
    if (act === "craft") { shopMode = "craft"; return renderCraft(npc, shopEl); }
    if (act === "heal") {
      const p = st.player;
      if (p.hp >= st.derived.hpMax) { setText("You're whole. Come back when you're not."); return; }
      p.hp = st.derived.hpMax;
      for (const c of st.companions) c.hp = c.hpMax;
      for (const pet of st.pets) if (pet.hp !== undefined) pet.hp = pet.hpMax;
      EH.NPCs.addRelP(npc, 2, st);
      setText("There. Whole again. Try not to make a habit of it.");
      EH.log("Lira mended your wounds. (free)", "good");
      syncAll(); return;
    }
    if (act === "healshop") { shopMode = "healshop"; return renderShop(npc, shopEl, EH.CONSUM.filter(c => ["potion", "buff", "food"].includes(c.kind))); }
    if (act === "hire") return renderHire(npc, shopEl);
    if (act === "pets") { shopMode = "pets"; return renderPets(npc, shopEl); }
    if (act === "research") { closeDialogue(); openPanel("town"); townTab = "research"; refreshPanel("town"); return; }
    if (act === "round") {
      if (st.res.gold < 30) { setText("Your purse is lighter than your thirst, Warden."); return; }
      st.res.gold -= 30;
      for (const n of st.npcs) { n.needs.mood = EH.clamp(n.needs.mood + 12, 0, 100); n.needs.social = EH.clamp(n.needs.social + 15, 0, 100); EH.NPCs.addRelP(n, 2, st); }
      st.town.moraleBonus = (st.town.moraleBonus || 0) + 4;
      EH.log("You bought a round for the whole tavern. <b class='good'>Morale rises.</b>", "good");
      EH.toast("A round for Emberhold!");
      setText("Ha! The hold drinks to the Warden!");
      syncAll(); return;
    }
    if (act === "gift") return renderGift(npc, shopEl);
    if (act === "companion") {
      const c = EH.Combat.hire(st, npc.id);
      if (c) { setText("My blade and my boots are yours, Warden. Let's go and make the dark regret it."); syncAll(); }
      return;
    }
  }
  function questOption(act, npc) {
    const q = npc.quest;
    if (act === "request") {
      if (!q) { setText(EH.pick(["Nothing today, Warden. The vale is quiet.", "Come back tomorrow — the board gets fresh paper at dawn.", "I've no work, but I've worries. That's the same thing, isn't it?"])); return; }
      setText(`<b style="color:var(--gold)">${EH.esc(q.title)}</b><br><span style="color:#cbbb9c">${EH.esc(q.desc)}</span><br><br><span style="font-size:10px;color:#c8a05a">Reward: ${EH.fmt(q.reward.gold)}g · ${EH.fmt(q.reward.xp)} xp · +${q.reward.rep} reputation${q.reward.item ? " · an item" : ""}${q.reward.res ? " · " + Object.entries(q.reward.res).map(([k, v]) => v + " " + k).join(", ") : ""}</span>`);
      const opts = document.getElementById("dlg-opts");
      opts.innerHTML = "";
      const y = EH.el("button", "quest", "I'll do it.");
      y.addEventListener("click", () => { EH.Quests.accept(st, q); setText(EH.pick(["Bless you, Warden.", "I knew I could ask.", "Don't dawdle.", "The hold thanks you."])); refreshDialogue(); syncAll(); });
      const n = EH.el("button", null, "Not right now.");
      n.addEventListener("click", () => { setText("Fair enough. It'll keep. Probably."); refreshDialogue(); });
      opts.appendChild(y); opts.appendChild(n);
      return;
    }
    if (act === "accept") {
      setText(`<b style="color:var(--gold)">${EH.esc(q.title)}</b><br><span style="color:#cbbb9c">${EH.esc(q.desc)}</span><br><br><span style="font-size:10px;color:#c8a05a">Reward: ${EH.fmt(q.reward.gold)}g · ${EH.fmt(q.reward.xp)} xp · +${q.reward.rep} rep</span>`);
      const opts = document.getElementById("dlg-opts");
      opts.innerHTML = "";
      const y = EH.el("button", "quest", "Accepted.");
      y.addEventListener("click", () => { EH.Quests.accept(st, q); setText("Good. Go on then."); refreshDialogue(); syncAll(); });
      opts.appendChild(y);
      const back = EH.el("button", null, "← Back"); back.addEventListener("click", () => refreshDialogue()); opts.appendChild(back);
      return;
    }
    if (act === "progress") {
      setText(`<b style="color:var(--gold)">${EH.esc(q.title)}</b><br><span style="color:#cbbb9c">Progress: ${q.have} / ${q.need}</span><br><span style="font-size:10px;color:#8d7f6a">${EH.esc(q.desc)}</span>`);
      const opts = document.getElementById("dlg-opts"); opts.innerHTML = "";
      const back = EH.el("button", null, "← Back"); back.addEventListener("click", () => refreshDialogue()); opts.appendChild(back);
      const ab = EH.el("button", null, "Abandon quest");
      ab.addEventListener("click", () => { EH.Quests.abandon(st, q); setText("...Right. I'll find someone else."); EH.NPCs.addRelP(npc, -6, st); refreshDialogue(); syncAll(); });
      opts.appendChild(ab);
      return;
    }
    if (act === "complete") {
      if (!EH.Quests.complete(st, q)) { setText("You haven't got everything yet."); return; }
      setText(EH.pick(["Done, and done. Here's what I promised.", "The hold owes you one, Warden.", "You've earned this.", "I'll not forget it."]));
      refreshDialogue(); syncAll();
      return;
    }
  }

  /* ── shops ─────────────────────────────────────────────────── */
  function stockOf(npc) {
    if (!npc.stock || !npc.stock.length || npc.stockDay !== st.time.day) {
      const pool = (npc.sells || []).slice();
      if (npc.svc === "shop" || npc.job === "merchant") pool.push(...EH.CONSUM.map(c => c.id), ...EH.MATS.map(m => m.id));
      npc.stock = [];
      const uniq = Array.from(new Set(pool));
      const n = EH.clamp(uniq.length, 0, 10);
      for (const id of EH.RNG(npc.id.length * 31 + st.time.day * 7).shuffle(uniq).slice(0, Math.max(3, n))) {
        const def = EH.CONSUM.find(c => c.id === id) || EH.MATS.find(m => m.id === id);
        if (!def) continue;
        npc.stock.push({ id, qty: EH.randint(3, 12) });
      }
      // merchants also sell generated gear
      if (npc.job === "merchant" || npc.svc === "shop") {
        const gn = 2 + Math.floor(st.time.day / 6);
        npc.stockGear = [];
        for (let i = 0; i < gn; i++) npc.stockGear.push(EH.Items.makeEquip(st.player.level + EH.randint(-1, 2), { mf: 20 }));
      } else if (npc.svc === "craft") {
        npc.stockGear = [];
        for (let i = 0; i < 4; i++) npc.stockGear.push(EH.Items.makeEquip(st.player.level + EH.randint(0, 2), {}));
      } else npc.stockGear = npc.stockGear || [];
      npc.stockDay = st.time.day;
    }
    return npc.stock;
  }

  function renderShop(npc, host, forced) {
    shopMode = "shop";
    host.className = "open"; host.innerHTML = "";
    const tabs = EH.el("div"); tabs.style.cssText = "display:flex;gap:3px;margin-bottom:6px";
    const mk = (l, on, fn) => { const b = EH.el("button", "btn sm" + (on ? " gold" : ""), l); b.addEventListener("click", fn); tabs.appendChild(b); };
    mk("Buy", !host.dataset.sell, () => { host.dataset.sell = ""; renderShop(npc, host, forced); });
    mk("Sell", !!host.dataset.sell, () => { host.dataset.sell = "1"; renderShop(npc, host, forced); });
    const back = EH.el("button", "btn sm", "← Back"); back.style.marginLeft = "auto";
    back.addEventListener("click", () => { host.className = ""; host.innerHTML = ""; refreshDialogue(); });
    tabs.appendChild(back);
    host.appendChild(tabs);

    if (!host.dataset.sell) {
      const stock = forced || stockOf(npc).map(s => EH.CONSUM.find(c => c.id === s.id) || EH.MATS.find(m => m.id === s.id)).filter(Boolean);
      const entries = forced ? forced.map(d => ({ def: d, qty: 99 })) : stockOf(npc).map(s => ({ def: (EH.CONSUM.find(c => c.id === s.id) || EH.MATS.find(m => m.id === s.id)), qty: s.qty })).filter(e => e.def);
      if (!entries.length) host.appendChild(EH.el("div", null, `<div style="color:#5d5449;font-size:10px;padding:8px">The stall is empty today. Come back at dawn.</div>`));
      for (const e of entries) {
        const price = EH.Town.price(st, e.def, npc);
        const row = EH.el("div", "shoprow");
        row.appendChild(EH.Art.icon(e.def.icon, e.def.c || "#c8a05a"));
        const si = EH.el("div", "si");
        si.innerHTML = `<div class="sn">${EH.esc(e.def.n)}</div><div class="sd">${e.def.kind || "material"} · stock ${e.qty}${price !== e.def.price ? ` · <span style="color:${price > e.def.price ? "#e05a4a" : "#7ec850"}">market ${price > e.def.price ? "high" : "low"}</span>` : ""}</div>`;
        row.appendChild(si);
        const pr = EH.el("div", "price" + (st.res.gold < price ? " no" : ""), EH.fmt(price) + "g");
        row.appendChild(pr);
        const b = EH.el("button", "btn sm gold", "Buy");
        b.disabled = st.res.gold < price || e.qty <= 0;
        b.addEventListener("click", () => {
          if (st.res.gold < price) return;
          const item = EH.Items.makeStack(e.def.id, 1);
          if (!EH.Items.add(st.player.inv, item, st.player.cap)) { EH.toast("Pack full"); return; }
          st.res.gold -= price; npc.gold += Math.round(price * (1 - EH.NPCs.taxRate(st)));
          st.town.taxTotal = (st.town.taxTotal || 0) + price * EH.NPCs.taxRate(st);
          const s = stockOf(npc).find(x => x.id === e.def.id); if (s) s.qty = Math.max(0, s.qty - 1);
          EH.log(`Bought ${e.def.n} from ${npc.name} for ${price}g.`);
          EH.NPCs.addRelP(npc, 0.4, st);
          syncAll(); renderShop(npc, host, forced);
        });
        row.appendChild(b);
        hoverTip(row, () => `<div class="tt-name">${EH.esc(e.def.n)}</div><div class="tt-type">${e.def.kind || "material"}</div>` +
          (e.def.heal ? `<div class="tt-stat">✚ Restores ${e.def.heal} HP</div>` : "") +
          (e.def.happy ? `<div class="tt-stat">♥ +${e.def.happy} pet happiness</div>` : "") +
          (e.def.buff ? `<div class="tt-stat">✦ +${e.def.amt} ${EH.Items.statLabel(e.def.buff)} for ${EH.fmtDur(e.def.dur)}</div>` : "") +
          `<div class="tt-val">Base ${e.def.price}g · Here ${price}g</div>`);
        host.appendChild(row);
      }
      // gear
      const gear = npc.stockGear || [];
      if (gear.length) {
        host.appendChild(EH.el("div", null, `<div style="font-size:9px;color:var(--gold2);letter-spacing:2px;margin:8px 0 4px;border-top:1px solid #332b25;padding-top:6px">EQUIPMENT</div>`));
        for (const it of gear) {
          if (it.sold) continue;
          const price = Math.round(EH.Items.value(it) * (npc.traits.includes("greedy") ? 1.18 : npc.traits.includes("generous") ? 0.88 : 1) * (1 - Math.max(0, npc.relP) / 500));
          const row = EH.el("div", "shoprow");
          row.appendChild(EH.Art.icon(it.icon, it.c));
          const si = EH.el("div", "si");
          si.innerHTML = `<div class="sn r-${it.rar}">${EH.esc(it.name)}</div><div class="sd">${EH.TIER[it.tier].n} ${EH.SLOTS[it.slot]}${it.atk ? " · ATK " + it.atk : ""}${it.def ? " · DEF " + it.def : ""}</div>`;
          row.appendChild(si);
          row.appendChild(EH.el("div", "price" + (st.res.gold < price ? " no" : ""), EH.fmt(price) + "g"));
          const b = EH.el("button", "btn sm gold", "Buy");
          b.disabled = st.res.gold < price;
          b.addEventListener("click", () => {
            if (st.res.gold < price) return;
            if (!EH.Items.add(st.player.inv, it, st.player.cap)) { EH.toast("Pack full"); return; }
            st.res.gold -= price; npc.gold += Math.round(price * 0.9); it.sold = true;
            EH.log(`Bought <b class="r-${it.rar}">${it.name}</b> for ${EH.fmt(price)}g.`, "loot");
            EH.NPCs.addRelP(npc, 1, st);
            syncAll(); renderShop(npc, host, forced);
          });
          row.appendChild(b);
          hoverTip(row, () => EH.Items.tip(it));
          host.appendChild(row);
        }
      }
    } else {
      // SELL
      const inv = st.player.inv;
      if (!inv.length) host.appendChild(EH.el("div", null, `<div style="color:#5d5449;font-size:10px;padding:8px">Nothing to sell.</div>`));
      for (const it of inv) {
        let price = Math.max(1, Math.round(EH.Items.value(it) * 0.5 * (npc.traits.includes("greedy") ? 0.85 : 1.05)));
        if (npc.job === "merchant") price = Math.round(price * 1.1);
        const row = EH.el("div", "shoprow");
        row.appendChild(EH.Art.icon(it.icon, it.c || "#c8a05a", { up: it.up }));
        const si = EH.el("div", "si");
        si.innerHTML = `<div class="sn ${it.eq ? "r-" + it.rar : ""}">${EH.esc(it.name)}${it.qty > 1 ? " ×" + it.qty : ""}</div><div class="sd">${it.eq ? EH.SLOTS[it.slot] : (it.kind || "material")}</div>`;
        row.appendChild(si);
        row.appendChild(EH.el("div", "price", EH.fmt(price) + "g"));
        const b = EH.el("button", "btn sm", "Sell 1");
        b.addEventListener("click", () => {
          EH.Items.remove(st.player.inv, it.uid, 1);
          st.res.gold += price; npc.gold -= Math.min(npc.gold, Math.round(price * 0.6));
          st.stats.itemsSold = (st.stats.itemsSold || 0) + 1;
          EH.log(`Sold ${it.name} for <b class="gold">${price}g</b>.`, "gold");
          syncAll(); renderShop(npc, host, forced);
        });
        row.appendChild(b);
        if (!it.eq && it.qty > 1) {
          const ba = EH.el("button", "btn sm", "All");
          ba.addEventListener("click", () => {
            const q = it.qty, tot = price * q;
            EH.Items.remove(st.player.inv, it.uid, q);
            st.res.gold += tot; st.stats.itemsSold = (st.stats.itemsSold || 0) + q;
            EH.log(`Sold ${q}× ${it.name} for <b class="gold">${EH.fmt(tot)}g</b>.`, "gold");
            syncAll(); renderShop(npc, host, forced);
          });
          row.appendChild(ba);
        }
        hoverTip(row, () => EH.Items.tip(it));
        host.appendChild(row);
      }
    }
  }

  /* ── forge: craft & upgrade ────────────────────────────────── */
  function renderCraft(npc, host) {
    host.className = "open"; host.innerHTML = "";
    const back = EH.el("button", "btn sm", "← Back");
    back.style.cssText = "margin-bottom:6px";
    back.addEventListener("click", () => { host.className = ""; host.innerHTML = ""; refreshDialogue(); });
    host.appendChild(back);

    host.appendChild(EH.el("div", null, `<div style="font-size:9px;color:var(--gold2);letter-spacing:2px;margin:6px 0 4px">UPGRADE EQUIPMENT (+ore, +gold)</div>`));
    const upgradable = [];
    for (const slot in st.player.equip) if (st.player.equip[slot]) upgradable.push(st.player.equip[slot]);
    for (const it of st.player.inv) if (it.eq) upgradable.push(it);
    if (!upgradable.length) host.appendChild(EH.el("div", null, `<div style="color:#5d5449;font-size:10px;padding:6px">You have no equipment to improve.</div>`));
    for (const it of upgradable) {
      if (it.up >= 10) continue;
      const cost = EH.Items.upCost(it);
      const row = EH.el("div", "shoprow");
      row.appendChild(EH.Art.icon(it.icon, it.c, { up: it.up }));
      const si = EH.el("div", "si");
      si.innerHTML = `<div class="sn r-${it.rar}">${EH.esc(it.name)}${it.up ? " +" + it.up : ""} → <b style="color:#f0c05a">+${it.up + 1}</b></div>
        <div class="sd">${it.atk ? "ATK " + it.atk + " → " + Math.round(it.atk * (1 + (it.up + 1) * 0.09)) : ""} ${it.def ? "DEF " + it.def + " → " + Math.round(it.def * (1 + (it.up + 1) * 0.09)) : ""}</div>`;
      row.appendChild(si);
      row.appendChild(EH.el("div", "price" + (st.res.gold < cost.gold || (st.res.ore || 0) < cost.ore ? " no" : ""), `${EH.fmt(cost.gold)}g · ${cost.ore} ore`));
      const b = EH.el("button", "btn sm gold", "Forge");
      b.disabled = st.res.gold < cost.gold || (st.res.ore || 0) < cost.ore;
      b.addEventListener("click", () => {
        if (!EH.Build.pay(st, cost)) return;
        it.up = (it.up || 0) + 1;
        st.derived = EH.Items.derive(st.player, st);
        EH.log(`${npc.name} hammered <b class="r-${it.rar}">${it.name}</b> to <b>+${it.up}</b>.`, "good");
        EH.toast(it.name + " +" + it.up);
        EH.NPCs.addRelP(npc, 1, st);
        syncAll(); renderCraft(npc, host);
      });
      row.appendChild(b);
      host.appendChild(row);
    }

    host.appendChild(EH.el("div", null, `<div style="font-size:9px;color:var(--gold2);letter-spacing:2px;margin:10px 0 4px;border-top:1px solid #332b25;padding-top:6px">CRAFT (spend ore & gold)</div>`));
    npc.stockGear = npc.stockGear || [];
    if (!npc.stockGear.length || npc.craftDay !== st.time.day) {
      npc.stockGear = [];
      for (let i = 0; i < 5; i++) npc.stockGear.push(EH.Items.makeEquip(st.player.level + EH.randint(0, 2), { mf: 25 }));
      npc.craftDay = st.time.day;
    }
    for (const it of npc.stockGear) {
      if (it.sold) continue;
      const cost = { gold: Math.round(EH.Items.value(it) * 0.8), ore: Math.max(2, Math.round(it.tier * 3 + it.lv * 0.4)) };
      const row = EH.el("div", "shoprow");
      row.appendChild(EH.Art.icon(it.icon, it.c));
      const si = EH.el("div", "si");
      si.innerHTML = `<div class="sn r-${it.rar}">${EH.esc(it.name)}</div><div class="sd">${EH.TIER[it.tier].n} ${EH.SLOTS[it.slot]}${it.atk ? " · ATK " + it.atk : ""}${it.def ? " · DEF " + it.def : ""}</div>`;
      row.appendChild(si);
      row.appendChild(EH.el("div", "price" + (!EH.Build.canAfford(st, cost) ? " no" : ""), `${EH.fmt(cost.gold)}g · ${cost.ore} ore`));
      const b = EH.el("button", "btn sm gold", "Craft");
      b.disabled = !EH.Build.canAfford(st, cost);
      b.addEventListener("click", () => {
        if (!EH.Build.pay(st, cost)) return;
        if (!EH.Items.add(st.player.inv, it, st.player.cap)) { EH.Build.refund(st, { type: "forge" }); EH.toast("Pack full"); return; }
        it.sold = true;
        EH.log(`Crafted <b class="r-${it.rar}">${it.name}</b>.`, "loot");
        syncAll(); renderCraft(npc, host);
      });
      row.appendChild(b);
      hoverTip(row, () => EH.Items.tip(it));
      host.appendChild(row);
    }
  }

  /* ── barracks: hire ────────────────────────────────────────── */
  function renderHire(npc, host) {
    host.className = "open"; host.innerHTML = "";
    const back = EH.el("button", "btn sm", "← Back");
    back.addEventListener("click", () => { host.className = ""; host.innerHTML = ""; refreshDialogue(); });
    host.appendChild(back);
    const max = 1 + EH.Build.count(st, "barracks");
    const cur = st.companions.filter(c => c.active).length;
    host.appendChild(EH.el("div", null, `<div style="font-size:10px;color:#8d7f6a;margin:6px 0">Party: <b style="color:var(--gold)">${cur}/${max}</b> — build more Barracks to field a larger company.</div>`));
    const guards = st.npcs.filter(n => n.job === "guard" || n.job === "elder" || (n.traits.includes("brave") && n.job !== "child"));
    if (!guards.length) host.appendChild(EH.el("div", null, `<div style="color:#5d5449;font-size:10px;padding:6px">No one here is willing to march into the dark.</div>`));
    for (const g of guards) {
      const inParty = st.companions.find(c => c.id === g.id);
      const cost = 60 + g.level * 40;
      const row = EH.el("div", "shoprow");
      const pf = EH.el("div"); pf.style.cssText = "width:28px;height:28px;flex:0 0 28px";
      pf.appendChild(EH.Art.portrait(g.look)); pf.firstChild.style.cssText = "width:28px;height:28px;image-rendering:pixelated";
      row.appendChild(pf);
      const si = EH.el("div", "si");
      si.innerHTML = `<div class="sn">${EH.esc(g.name)}</div><div class="sd">Lv ${g.level + Math.floor(st.player.level / 3)} · HP ${Math.round(60 + g.level * 26 + st.player.level * 12)} · ATK ${Math.round(7 + g.level * 2.6 + st.player.level * 1.6)} · wage ${Math.round(8 + g.level * 2)}g/day</div>`;
      row.appendChild(si);
      if (inParty) {
        const b = EH.el("button", "btn sm red", "Dismiss");
        b.addEventListener("click", () => { EH.Combat.dismiss(st, g.id); syncAll(); renderHire(npc, host); });
        row.appendChild(b);
      } else {
        row.appendChild(EH.el("div", "price" + (st.res.gold < cost ? " no" : ""), cost + "g"));
        const b = EH.el("button", "btn sm gold", "Hire");
        b.disabled = st.res.gold < cost || cur >= max || g.relP < 30;
        b.title = g.relP < 30 ? "Needs Friendly (30) regard" : "";
        b.addEventListener("click", () => { EH.Combat.hire(st, g.id); syncAll(); renderHire(npc, host); });
        row.appendChild(b);
      }
      host.appendChild(row);
    }
  }

  /* ── kennel: pet eggs ──────────────────────────────────────── */
  function renderPets(npc, host) {
    host.className = "open"; host.innerHTML = "";
    const back = EH.el("button", "btn sm", "← Back");
    back.addEventListener("click", () => { host.className = ""; host.innerHTML = ""; refreshDialogue(); });
    host.appendChild(back);
    host.appendChild(EH.el("div", null, `<div style="font-size:10px;color:#8d7f6a;margin:6px 0;line-height:1.5">Eggs hatch into a random beast of random rarity. Wren refuses to say where she gets them.</div>`));
    const eggs = [{ n: "Mystery Egg", price: 200, d: "Any beast, any rarity." }, { n: "Warm Egg", price: 900, d: "Guaranteed Rare or better." }, { n: "Ember Egg", price: 3200, d: "Guaranteed Epic or better. Smells of sulphur." }];
    eggs.forEach((e, i) => {
      const row = EH.el("div", "shoprow");
      row.appendChild(EH.Art.icon("egg", i === 2 ? "#e06a20" : i === 1 ? "#8ef0d8" : "#e8dcc0"));
      const si = EH.el("div", "si");
      si.innerHTML = `<div class="sn">${e.n}</div><div class="sd">${e.d}</div>`;
      row.appendChild(si);
      row.appendChild(EH.el("div", "price" + (st.res.gold < e.price ? " no" : ""), EH.fmt(e.price) + "g"));
      const b = EH.el("button", "btn sm gold", "Hatch");
      b.disabled = st.res.gold < e.price;
      b.addEventListener("click", () => {
        const max = 2 + (EH.Items.researchFx(st).petSlot || 0) + EH.Build.count(st, "kennel");
        if (st.pets.length >= max) { EH.toast("Kennel full (" + max + ")"); return; }
        st.res.gold -= e.price; npc.gold += Math.round(e.price * 0.9);
        const rar = i === 2 ? EH.randint(3, 4) : i === 1 ? EH.randint(2, 4) : undefined;
        EH.Combat.hatch(st, null, rar);
        EH.NPCs.addRelP(npc, 3, st);
        syncAll(); renderPets(npc, host);
      });
      row.appendChild(b);
      host.appendChild(row);
    });
    // pet food
    const pf = EH.MATS.find(m => m.id === "petfood") || EH.CONSUM.find(c => c.id === "petfood");
    if (pf) {
      const price = EH.Town.price(st, pf, npc);
      const row = EH.el("div", "shoprow");
      row.appendChild(EH.Art.icon(pf.icon, pf.c));
      row.appendChild(EH.el("div", "si", `<div class="sn">${pf.n}</div><div class="sd">+25 pet happiness</div>`));
      row.appendChild(EH.el("div", "price" + (st.res.gold < price ? " no" : ""), price + "g"));
      const b = EH.el("button", "btn sm gold", "Buy 5");
      b.disabled = st.res.gold < price * 5;
      b.addEventListener("click", () => {
        st.res.gold -= price * 5; npc.gold += Math.round(price * 4.5);
        EH.Items.add(st.player.inv, EH.Items.makeStack(pf.id, 5), st.player.cap);
        EH.log(`Bought 5 pet treats.`); syncAll(); renderPets(npc, host);
      });
      row.appendChild(b);
      host.appendChild(row);
    }
  }

  /* ── gifting ───────────────────────────────────────────────── */
  function renderGift(npc, host) {
    host.className = "open"; host.innerHTML = "";
    const back = EH.el("button", "btn sm", "← Back");
    back.addEventListener("click", () => { host.className = ""; host.innerHTML = ""; refreshDialogue(); });
    host.appendChild(back);
    host.appendChild(EH.el("div", null, `<div style="font-size:10px;color:#8d7f6a;margin:6px 0">Give something from your pack. Better gifts, warmer regard.</div>`));
    const giftable = st.player.inv.filter(e => !e.eq || e.rar !== "legendary");
    if (!giftable.length) host.appendChild(EH.el("div", null, `<div style="color:#5d5449;font-size:10px;padding:6px">Your pack is empty.</div>`));
    for (const it of giftable.slice(0, 24)) {
      const v = EH.Items.value(it);
      const gain = it.eq ? EH.clamp(Math.round(2 + v / 90), 2, 30) : EH.clamp(Math.round(1 + v / 40), 1, 12);
      const row = EH.el("div", "shoprow");
      row.appendChild(EH.Art.icon(it.icon, it.c || "#c8a05a", { up: it.up }));
      row.appendChild(EH.el("div", "si", `<div class="sn ${it.eq ? "r-" + it.rar : ""}">${EH.esc(it.name)}${it.qty > 1 ? " ×" + it.qty : ""}</div><div class="sd">worth ${EH.fmt(v)}g · <span style="color:#7ec850">+${gain} regard</span></div>`));
      const b = EH.el("button", "btn sm green", "Give");
      b.addEventListener("click", () => {
        EH.Items.remove(st.player.inv, it.uid, 1);
        EH.NPCs.addRelP(npc, gain, st);
        EH.NPCs.remember(npc, `The Warden gave me ${it.name} on day ${st.time.day}.`);
        EH.NPCs.say(npc, EH.pick([`A ${it.name}? For me?`, "You shouldn't have. Really.", "I'll not forget this.", "Well. That's kind."]), 4);
        setText(EH.pick(["Oh! For me? Thank you, Warden.", "That's… unexpectedly generous.", "I'll treasure it. Truly.", "You've made my day."]));
        EH.log(`Gave ${it.name} to ${npc.name}. (+${gain} regard)`, "good");
        syncAll(); renderGift(npc, host);
      });
      row.appendChild(b);
      host.appendChild(row);
    }
  }

  /* ══════════════════════════════════════════════════════════
     TOOLTIPS
     ══════════════════════════════════════════════════════════ */
  function hoverTip(el, fn) {
    el.addEventListener("pointerenter", e => {
      const html = typeof fn === "function" ? fn() : fn;
      if (!html) return;
      tipEl.innerHTML = html;
      tipEl.style.display = "block";
      moveTip(e);
    });
    el.addEventListener("pointermove", moveTip);
    el.addEventListener("pointerleave", () => { tipEl.style.display = "none"; });
  }
  function moveTip(e) {
    const pad = 14, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + w > window.innerWidth - 6) x = e.clientX - w - pad;
    if (y + h > window.innerHeight - 6) y = e.clientY - h - pad;
    tipEl.style.left = Math.max(4, x) + "px"; tipEl.style.top = Math.max(4, y) + "px";
  }

  /* ══════════════════════════════════════════════════════════
     HINT LINE + OFFLINE REPORT
     ══════════════════════════════════════════════════════════ */
  let hintT = 0;
  /* persistent prompt (driven by proximity) */
  function setHint(html) {
    const h = document.getElementById("hint"); if (!h) return;
    hintT = 0;
    if (html) { h.innerHTML = html; h.classList.add("show"); }
    else h.classList.remove("show");
  }
  /* timed toast-style hint */
  function hint(html, secs) {
    const h = document.getElementById("hint"); if (!h) return;
    h.innerHTML = html; h.classList.add("show"); hintT = secs || 3.4;
  }
  function tickHint(dt) { if (hintT > 0) { hintT -= dt; if (hintT <= 0) { const h = document.getElementById("hint"); if (h) h.classList.remove("show"); } } }

  function offlineReport(report) {
    const d = document.getElementById("offline");
    d.classList.remove("hidden");
    d.innerHTML = "";
    const box = EH.el("div", "box px");
    box.innerHTML = `<h2>WHILE YOU WERE AWAY</h2><div class="dur">${EH.fmtDur(report.secs)} of real time · ${report.days} in-game day${report.days === 1 ? "" : "s"}</div>`;
    const lines = EH.el("div", "lines");
    lines.innerHTML = report.lines.map(l => `<div>${l}</div>`).join("");
    box.appendChild(lines);
    const b = EH.el("button", "btn gold", "Return to Emberhold");
    b.style.cssText = "width:100%;padding:9px";
    b.addEventListener("click", () => d.classList.add("hidden"));
    box.appendChild(b);
    d.appendChild(box);
  }

  return {
    init, syncAll, openPanel, close, closeAll, toggle, refreshPanel, dialogue, closeDialogue,
    pushLog, hoverTip, hint, setHint, tickHint, offlineReport, cancelPlace, startPlace, focusEntity,
    usePotion, hotbar, get ready() { return ready; }, get npc() { return currentNpc; },
    set st(v) { st = v; }, get st() { return st; },
    panels: open,
  };
})();
