/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — game.js : state, loop, input, save/load, offline play
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;

EH.Game = (function () {
  let st = null, cv = null, running = false, last = 0;
  let uiAcc = 0, saveAcc = 0, hoverTile = null;
  const keys = {};

  /* ══════════════════════════════════════════════════════════
     NEW STATE
     ══════════════════════════════════════════════════════════ */
  function newState(name, cls, forcedSeed) {
    /* FR-03: a forced seed makes a run exactly reproducible — that is what lets
       the harness prove determinism and a bug report be replayed. The single
       unseeded draw below is the run's only source of entropy.               */
    const seed = (forcedSeed >>> 0) || ((Date.now() % 100000) + Math.floor(Math.random() * 90000));
    EH.seedRng(seed);
    const C = EH.CLASS[cls];
    const s = {
      v: 3, seed, name,
      speed: 1,
      time: { minute: 6 * 60 + 30, day: 1, season: 0, real: 0, dtMin: 0, hour: 6, hourF: 6.5 },
      weather: "clear", weatherT: EH.rand(3, 8), weatherDay: 1,
      tod: EH.todAt(6.5),
      res: { gold: 220, wood: 60, stone: 25, food: 40, ore: 0 },
      player: {
        name: name || "Warden", cls, level: 1, xp: 0, jobName: C.jobs[0].n,
        pts: {}, ptsLeft: 0, cap: 48, inv: [], equip: {}, cd: {},
        x: 0, y: 0, dir: "front", flip: false, anim: 0, atkAnim: 0, path: [], moving: false,
        hp: 100, hurtT: 0, statuses: [], look: lookFor(cls),
      },
      buildings: [], npcs: [], pets: [], companions: [], mons: [],
      town: { plaza: { x: 23, y: 23 }, homes: {}, works: {}, rates: {}, demand: {}, starter: [], taxTotal: 0, taxToday: 0, tradesToday: 0, lanterns: 0, lastHour: -1 },
      invNpc: [{ id: "bread", qty: 24 }, { id: "herb", qty: 10 }, { id: "wheat", qty: 18 }, { id: "pelt", qty: 6 }, { id: "potion_s", qty: 6 }],
      dungeon: { floor: 1, maxFloor: 1, cleared: 0, bossesKilled: 0, stayOnFloor: false },
      quests: { active: [], board: [], done: [] },
      research: [], buffs: {},
      stats: { kills: 0, goldEarned: 0, xp: 0, quests: 0, built: 0, itemsFound: 0, itemsSold: 0, legendary: 0, trades: 0, deaths: 0, playTime: 0, produced: {} },
      auto: false, placing: null, focus: null,
      map: null, dmap: null, prevMap: null, derived: null,
      createdAt: Date.now(), lastSeen: Date.now(),
    };
    // starter kit
    const kit = EH.Items.makeEquip(1, { base: cls === "mage" ? "staff" : cls === "ranger" ? "bow" : cls === "merchant" ? "dagger" : "sword", rarity: 0, tier: 0 });
    s.player.equip.wpn = kit;
    s.player.equip.chest = EH.Items.makeEquip(1, { base: "shirt", rarity: 0, tier: 0 });
    for (let i = 0; i < 3; i++) EH.Items.add(s.player.inv, EH.Items.makeStack("potion_s", 1), s.player.cap);
    EH.Items.add(s.player.inv, EH.Items.makeStack("bread", 4), s.player.cap);
    return s;
  }

  function lookFor(cls) {
    const A = EH.Art;
    const L = {
      warden: { skin: A.SKIN[1], hair: A.HAIR[0], cloth: "#8c3a2a", pants: "#3a3229", helmet: true, helmetc: "#9aa0a8", plume: "#c8402f", weapon: "sword", cloak: true, cloakc: "#6a2c2c" },
      ranger: { skin: A.SKIN[0], hair: A.HAIR[2], cloth: "#4a7a4a", pants: "#4a3a2a", hat: "hood", hatc: "#3d6829", weapon: "bow", cloak: true, cloakc: "#4a6a3a" },
      mage: { skin: A.SKIN[4], hair: A.HAIR[6], cloth: "#4a3a7a", pants: "#3a3229", hat: "pointy", hatc: "#5a4a9a", weapon: "staff" },
      merchant: { skin: A.SKIN[2], hair: A.HAIR[1], cloth: "#8c6a3a", pants: "#4a3a2a", hat: "cap", hatc: "#a8382a", weapon: "dagger", cloak: true, cloakc: "#8a6a3a" },
    };
    return L[cls] || L.warden;
  }

  /* ══════════════════════════════════════════════════════════
     BOOT
     ══════════════════════════════════════════════════════════ */
  function boot() {
    cv = document.getElementById("cv");
    EH.Render.init();
    const saved = EH.store.get(EH.CFG.SAVE_KEY);
    if (saved && saved.v) {
      try {
        const rep = load(saved);
        EH.UI.init(st);
        bindInput();
        EH.Render.snapCam(st);
        start();
        if (rep) setTimeout(() => EH.UI.offlineReport(rep), 500);
        EH.log("<b class='story'>You return to Emberhold.</b>", "story");
        return;
      } catch (e) { console.error("Load failed, starting fresh", e); }
    }
    charCreate();
  }

  function charCreate() {
    const d = EH.el("div");
    d.id = "charcreate";
    d.style.cssText = "position:absolute;inset:0;z-index:80;background:radial-gradient(ellipse at 50% 40%,#241c16,#0b0908);display:flex;align-items:center;justify-content:center;overflow:auto";
    d.innerHTML = `
      <div style="width:min(760px,94%);padding:18px 0 26px">
        <div style="text-align:center;margin-bottom:4px">
          <div style="font-size:26px;letter-spacing:8px;color:#f0c05a;font-weight:700;text-shadow:0 3px 0 #000,0 0 24px rgba(240,192,90,.35)">EMBERHOLD</div>
          <div style="font-size:10px;letter-spacing:3px;color:#8d7f6a;margin-top:4px">AN ISOMETRIC IDLE FANTASY RPG</div>
        </div>
        <div style="text-align:center;font-size:11px;color:#a89880;line-height:1.7;max-width:560px;margin:14px auto 18px;font-style:italic">
          The last warden left you a deed, a rusty blade and two hundred gold.<br>
          The hamlet is half-empty, the Hollowdeep is breathing, and the villagers are watching.
        </div>
        <div style="text-align:center;margin-bottom:14px">
          <input id="cc-name" maxlength="16" placeholder="Your name" value="Warden"
            style="font-family:var(--font);font-size:15px;padding:8px 14px;background:#1e1915;border:2px solid #4a4038;color:#f0c05a;text-align:center;letter-spacing:2px;box-shadow:0 0 0 2px #0d0a08;width:240px">
        </div>
        <div id="cc-classes" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px"></div>
        <div style="text-align:center;margin-top:16px">
          <button id="cc-go" class="btn gold" style="padding:11px 34px;font-size:13px;letter-spacing:2px" disabled>CLAIM THE HOLD</button>
        </div>
        <div style="text-align:center;font-size:9px;color:#5d5449;margin-top:14px;line-height:1.7">
          Everything you see is drawn by code at runtime — no image files.<br>
          Progress saves automatically to this browser.
        </div>
      </div>`;
    document.getElementById("gameview").appendChild(d);

    const host = d.querySelector("#cc-classes");
    let chosen = null;
    for (const key of Object.keys(EH.CLASS)) {
      const C = EH.CLASS[key];
      const card = EH.el("div");
      card.style.cssText = "background:#241e19;border:3px solid #4a4038;box-shadow:0 0 0 2px #0d0a08;padding:10px;cursor:pointer;text-align:center;transition:.12s";
      const pf = EH.el("div");
      pf.style.cssText = "width:56px;height:56px;margin:0 auto 6px;border:2px solid #4a4038;image-rendering:pixelated;overflow:hidden";
      pf.appendChild(EH.Art.portrait(Object.assign({ cls: key }, lookFor(key))));
      card.appendChild(pf);
      card.insertAdjacentHTML("beforeend", `
        <div style="font-size:14px;font-weight:700;color:${C.c};letter-spacing:1px">${C.n}</div>
        <div style="font-size:8.5px;color:#8d7f6a;letter-spacing:1px;margin-bottom:6px">${C.title.toUpperCase()}</div>
        <div style="font-size:9.5px;color:#a89880;line-height:1.5;min-height:52px">${C.desc}</div>
        <div style="font-size:8.5px;color:#7d705c;margin-top:5px;line-height:1.5">${EH.STATLIST.slice(0, 6).map(s => `${s.k.toUpperCase()} ${C.base[s.k]}`).join(" · ")}</div>
        <div style="font-size:8.5px;color:#c8a05a;margin-top:4px">${C.jobs.map(j => j.n).join(" → ")}</div>`);
      card.addEventListener("click", () => {
        chosen = key;
        Array.from(host.children).forEach(c => { c.style.borderColor = "#4a4038"; c.style.background = "#241e19"; });
        card.style.borderColor = C.c; card.style.background = "#2e2620";
        d.querySelector("#cc-go").disabled = false;
      });
      card.addEventListener("pointerenter", () => { if (chosen !== key) card.style.borderColor = "#6a5c4e"; });
      card.addEventListener("pointerleave", () => { if (chosen !== key) card.style.borderColor = "#4a4038"; });
      host.appendChild(card);
    }
    d.querySelector("#cc-go").addEventListener("click", () => {
      const nm = (d.querySelector("#cc-name").value || "Warden").trim().slice(0, 16) || "Warden";
      st = newState(nm, chosen);
      setupWorld(false);
      d.remove();
      EH.UI.init(st);
      bindInput();
      EH.Render.snapCam(st);
      start();
      intro();
    });
    d.querySelector("#cc-name").addEventListener("keydown", e => { if (e.key === "Enter" && chosen) d.querySelector("#cc-go").click(); });
  }

  function intro() {
    EH.log("<b class='story'>Day 1, Spring.</b> You stand in the plaza of Emberhold with a deed in your hand.", "story");
    EH.log("Bram Ashdown, the elder, is waiting by the well. He has work for you.", "story");
    EH.log("To the north-east, the crack in the hillside breathes cold air. That is the <b>Hollowdeep</b>.", "story");
    EH.toast("Welcome to Emberhold");
    setTimeout(() => EH.UI.hint('Press <kbd>E</kbd> near a villager to talk · <kbd>B</kbd> to build · click to walk'), 1200);
    const bram = EH.NPCs.byId(st, "bram");
    if (bram && !bram.quest) {
      const q = EH.Quests.generate(st, bram);
      if (q) { bram.quest = q; q.state = "offered"; }
    }
  }

  function setupWorld(isLoad) {
    st.map = EH.genTown(st.seed);
    st.townMap = st.map;
    EH.Build.setupTown(st);
    if (!isLoad) {
      EH.NPCs.spawnStarter(st);
      // re-link stalls now that NPCs exist
      for (const b of EH.Build.allOf(st, "market")) {
        const v = st.npcs.find(n => (n.job === "merchant" || n.svc === "shop") && !n.stall);
        if (v) { v.stall = { x: b.x, y: b.y + b.h }; v.work = b.id; }
      }
      EH.Build.assignWorkers(st);          // give the starter crew their posts
      // starting pet
      const pet = EH.Combat.makePet("dog", st, 0);
      pet.x = st.map.spawn.x + 1; pet.y = st.map.spawn.y + 1;
      st.pets.push(pet);
      st.player.x = st.map.spawn.x; st.player.y = st.map.spawn.y;
      EH.Quests.daily(st);
    } else {
      for (const n of st.npcs) { n.path = []; n.act = null; n.inside = false; }
      for (const b of EH.Build.allOf(st, "market")) {
        const v = st.npcs.find(n => (n.job === "merchant" || n.svc === "shop") && !n.stall);
        if (v) { v.stall = { x: b.x, y: b.y + b.h }; }
      }
    }
    st.derived = EH.Items.derive(st.player, st);
    st.player.hp = Math.min(st.player.hp || st.derived.hpMax, st.derived.hpMax);
    if (!st.player.hp) st.player.hp = st.derived.hpMax;
    st.tod = EH.todAt(st.time.hourF);
  }

  /* ══════════════════════════════════════════════════════════
     TIME / WEATHER
     ══════════════════════════════════════════════════════════ */
  function advanceTime(gameDt) {
    const t = st.time;
    t.real += gameDt;
    const minutesPerSec = EH.CFG.MIN_PER_DAY / EH.CFG.REAL_SEC_PER_DAY;
    t.dtMin = gameDt * minutesPerSec;
    t.minute += t.dtMin;
    while (t.minute >= EH.CFG.MIN_PER_DAY) { t.minute -= EH.CFG.MIN_PER_DAY; newDay(); }
    t.hourF = t.minute / 60;
    st.dtMin = t.dtMin;
    const h = Math.floor(t.hourF);
    if (h !== t.hour) { t.hour = h; EH.NPCs.hourly(st); st.town.tradesToday = st.stats.trades; }
    t.season = Math.floor((t.day - 1) / 28) % 4;
    st.tod = EH.todAt(t.hourF);
    // weather
    st.weatherT -= t.dtMin / 60;
    if (st.weatherT <= 0) {
      st.weatherT = EH.rand(4, 11);
      const pool = Object.keys(EH.WEATHER).map(k => {
        let w = EH.WEATHER[k].w;
        if (k === "snow" && t.season !== 3) w = 0;
        if (k === "snow" && t.season === 3) w = 34;
        if ((k === "rain" || k === "storm") && t.season === 3) w *= 0.4;
        if (k === "clear" && t.season === 0) w *= 0.8;
        return { v: k, w };
      }).filter(p => p.w > 0);
      const nw = EH.rollPool(pool).v;
      if (nw !== st.weather) {
        st.weather = nw;
        EH.log(`The weather turns: <b>${EH.WEATHER[nw].n.toLowerCase()}</b>.`);
      }
    }
  }
  function newDay() {
    st.time.day++;
    st.town.tradesToday = 0; st.town.taxToday = 0;
    st.town.lastHour = -1;
    EH.NPCs.dailyTick(st);
    EH.Quests.daily(st);
    // daily companion wages
    let wages = 0;
    for (const c of st.companions) wages += c.wage || 0;
    if (wages) { const paid = Math.min(st.res.gold, wages); st.res.gold -= paid; if (paid < wages) EH.log("You could not pay your companions. Some may leave.", "bad"); }
    // pet happiness decay
    for (const p of st.pets) {
      p.happy = EH.clamp(p.happy - (p.active ? 5 : 2.5), 0, 100);
      if (p.happy <= 0 && p.active) {
        EH.log(`<b class="bad">${p.name} ran off into the vale.</b> It was hungry and lonely.`, "bad");
        st.pets.splice(st.pets.indexOf(p), 1);
        st.derived = EH.Items.derive(st.player, st);
      } else if (p.happy < 25 && EH.chance(0.4)) EH.log(`${p.name} looks miserable. Feed it.`, "bad");
    }
    // storm damage
    if (st.weather === "storm" && EH.chance(0.25)) {
      const b = EH.pick(st.buildings.filter(x => x.done));
      if (b) { b.hp = Math.max(25, b.hp - EH.randint(8, 26)); EH.log(`Lightning struck the ${EH.BUILD[b.type].n}. It needs repair.`, "bad"); }
    }
    // NPC day reset
    for (const n of st.npcs) { n.greetDone = false; }
    st.lastSeen = Date.now();
    EH.log(`<b>Day ${st.time.day} · ${EH.SEASONS[st.time.season].n}.</b> ${EH.pick(["The vale wakes.", "Smoke rises from the chimneys.", "A cold wind off the hills.", "Birds in the pines.", "The Hollowdeep breathes.", "Someone is already at the well."])}`);
    if (st.time.day % 28 === 1 && st.time.day > 1) {
      EH.log(`<b class="story">The season turns to ${EH.SEASONS[st.time.season].n}.</b> ${EH.SEASONS[st.time.season].desc}`, "story");
      EH.toast("SEASON: " + EH.SEASONS[st.time.season].n.toUpperCase());
    }
  }

  /* ── buffs ─────────────────────────────────────────────────── */
  EH.buff = function (s, key, val, dur) {
    s.buffs[key] = { v: val, t: dur, max: dur };
    s.derived = EH.Items.derive(s.player, s);
  };
  function tickBuffs(dt) {
    let changed = false;
    for (const k in st.buffs) {
      st.buffs[k].t -= dt;
      if (st.buffs[k].t <= 0) { delete st.buffs[k]; changed = true; }
    }
    if (changed) st.derived = EH.Items.derive(st.player, st);
  }

  /* ══════════════════════════════════════════════════════════
     PLAYER MOVEMENT & INPUT
     ══════════════════════════════════════════════════════════ */
  function updatePlayer(dt) {
    const p = st.player, map = st.map, D = st.derived;
    p.hurtT = Math.max(0, (p.hurtT || 0) - dt);
    let mx = 0, my = 0;
    // screen-relative movement mapped onto the iso grid
    if (keys.left) mx -= 1; if (keys.right) mx += 1;
    if (keys.up) my -= 1; if (keys.down) my += 1;
    if (mx || my) {
      p.path = [];
      // iso: screen-right = (+x, -y)? screen right vector = (1,-1) normalised; screen down = (1,1)
      const gx = (mx + my) * 0.7071, gy = (my - mx) * 0.7071;
      const len = Math.hypot(gx, gy) || 1;
      const nx = p.x + gx / len * D.speed * dt, ny = p.y + gy / len * D.speed * dt;
      // axis-separated collision so you slide along walls
      if (map.walk(Math.round(nx), Math.round(p.y))) p.x = nx;
      if (map.walk(Math.round(p.x), Math.round(ny))) p.y = ny;
      p.x = EH.clamp(p.x, 0.4, map.w - 1.4); p.y = EH.clamp(p.y, 0.4, map.h - 1.4);
      p.moving = true;
      p.dir = Math.abs(my) > Math.abs(mx) ? (my > 0 ? "front" : "back") : "side";
      p.flip = mx < 0;
      p.anim += dt * 8;
    } else if (p.path && p.path.length) {
      EH.Mover.tick(p, map, dt, D.speed);
    } else p.moving = false;

    // fog reveal
    if (map.kind === "dungeon") EH.reveal(map, p.x, p.y, Math.round(D.vision));
    // tile effects
    const tid = map.get(Math.round(p.x), Math.round(p.y));
    const td = EH.tileDef(tid);
    if (td.dmg) { p.dmgAcc = (p.dmgAcc || 0) + dt; if (p.dmgAcc > 0.6) { p.dmgAcc = 0; EH.Combat.hurtPlayer(st, td.dmg * (1 + (st.dmap ? st.dmap.floor * 0.1 : 0))); } }
    // proximity prompts & triggers
    proximity(dt);
  }

  /* While auto-explore is on, the hero opens chests and takes the stairs
     by themselves — this is the idle half of the loop. */
  function autoInteract(dt) {
    if (!st || !st.auto || st.map.kind !== "dungeon") return;
    const m = st.map, p = st.player;
    st.autoIntT = (st.autoIntT || 0) - dt;
    if (st.autoIntT > 0) return;
    st.autoIntT = 0.3;
    const ch = m.chests.find(c => !c.opened && EH.dist(c.x, c.y, p.x, p.y) < 1.9);
    if (ch) { openChest(ch); return; }
    if (st.dungeon.stayOnFloor) return;
    if (EH.dist(p.x, p.y, m.stairs.x, m.stairs.y) < 2.0) {
      if (m.isBoss && !m.bossDead) return;
      if (!st.mons.length || EH.Combat.nearestMon(st, p.x, p.y, 9) == null) EH.Combat.descend(st);
    }
  }

  let lastHint = "";
  function proximity(dt) {
    const p = st.player, map = st.map;
    let h = "";
    if (map.kind === "town") {
      const n = EH.NPCs.at(st, p.x, p.y, 1.9);
      if (n) h = `<kbd>E</kbd> Speak with <b>${EH.esc(n.name)}</b>${n.quest ? (n.quest.state === "ready" ? " — <span style='color:#7ec850'>quest ready</span>" : " — <span style='color:#f0c05a'>quest</span>") : ""}`;
      const pk = map.dungeonPortal;
      if (pk && EH.dist(p.x, p.y, pk.x, pk.y) < 2.2 && !h) h = `<kbd>E</kbd> Descend into the <b>Hollowdeep</b> (floor ${st.dungeon.maxFloor})`;
    } else {
      const d = EH.dist(p.x, p.y, map.stairs.x, map.stairs.y);
      if (d < 1.8 && !h) {
        h = map.isBoss && !map.bossDead ? `Slay <b>${(EH.bossForFloor(map.floor) || {}).n || "the guardian"}</b> to open the way` : `<kbd>E</kbd> Descend to floor <b>${map.floor + 1}</b>`;
      }
      const ch = map.chests.find(c => !c.opened && EH.dist(c.x, c.y, p.x, p.y) < 1.6);
      if (ch && !h) h = `<kbd>E</kbd> Open the chest`;
      if (!h) {
        const m = EH.Combat.nearestMon(st, p.x, p.y, 3);
        if (m) h = `<kbd>Space</kbd> Attack <b>${EH.esc(m.name)}</b>${m.boss ? " — GUARDIAN" : ""}`;
      }
    }
    if (h !== lastHint) { lastHint = h; EH.UI.setHint(h); }
  }

  function interact() {
    const p = st.player, map = st.map;
    if (map.kind === "town") {
      const n = EH.NPCs.at(st, p.x, p.y, 2.2);
      if (n) { EH.UI.dialogue(n); if (n.quest && n.quest.state === "offered") EH.Quests.checkDeliver(st, n.id); return; }
      const pk = map.dungeonPortal;
      if (pk && EH.dist(p.x, p.y, pk.x, pk.y) < 2.6) { EH.Combat.enterDungeon(st, st.dungeon.maxFloor || 1); return; }
      EH.UI.hint("Nothing to interact with here.");
      return;
    }
    const ch = map.chests.find(c => !c.opened && EH.dist(c.x, c.y, p.x, p.y) < 1.9);
    if (ch) { openChest(ch); return; }
    if (EH.dist(p.x, p.y, map.stairs.x, map.stairs.y) < 2.0) {
      if (map.isBoss && !map.bossDead) { EH.toast("The guardian bars the way."); return; }
      EH.Combat.descend(st); return;
    }
    const m = EH.Combat.nearestMon(st, p.x, p.y, 3);
    if (m) { st.focus = m; EH.Combat.playerAttack(st, m, {}); return; }
  }

  function openChest(ch) {
    ch.opened = true;
    st.map.occ.delete(st.map.key(ch.x, ch.y));
    const csf = st.dungeon.floor;
    const cs = st.dungeon.chestState || (st.dungeon.chestState = {});
    (cs[csf] || (cs[csf] = {}))[ch.x + "," + ch.y] = 1;
    const loot = EH.Items.chestLoot(ch.tier, st.dungeon.floor, st);
    st.res.gold += loot.gold;
    st.stats.goldEarned += loot.gold;
    EH.Float.world(ch.x, ch.y - 0.6, "+" + EH.fmt(loot.gold) + "g", "gold");
    EH.log(`Opened a ${ch.tier === 2 ? "grand " : ch.tier === 1 ? "fine " : ""}chest: <b class="gold">${EH.fmt(loot.gold)}g</b>.`, "gold");
    for (const it of loot.items) {
      if (EH.Items.add(st.player.inv, it, st.player.cap)) {
        EH.log(`Found <b class="${it.eq ? "r-" + it.rar : ""}">${it.name}</b>${it.qty > 1 ? " ×" + it.qty : ""}`, it.eq && it.rar === "legendary" ? "epic" : "loot");
        st.stats.itemsFound++;
        if (it.eq && it.rar === "legendary") { EH.toast("LEGENDARY: " + it.name); st.stats.legendary++; }
        if (!it.eq && it.def && it.def.kind === "egg") EH.log("A <b class='epic'>Mystery Egg</b>! Wren will want to see this.", "epic");
      } else EH.log("Your pack is full — something was left in the chest.", "bad");
    }
    EH.Part.burst(ch.x, ch.y, "#f0c05a", 14);
    EH.Quests.progress(st, "explore", st.dungeon.floor, 1);
  }

  function bindInput() {
    window.addEventListener("keydown", e => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") keys.left = true;
      if (k === "arrowright" || k === "d") keys.right = true;
      if (k === "arrowup" || k === "w") keys.up = true;
      if (k === "arrowdown" || k === "s") keys.down = true;
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
    });
    window.addEventListener("keyup", e => {
      const k = e.key.toLowerCase();
      if (k === "arrowleft" || k === "a") keys.left = false;
      if (k === "arrowright" || k === "d") keys.right = false;
      if (k === "arrowup" || k === "w") keys.up = false;
      if (k === "arrowdown" || k === "s") keys.down = false;
    });
    window.addEventListener("blur", () => { keys.left = keys.right = keys.up = keys.down = false; });

    cv.addEventListener("pointermove", e => {
      const w = toWorld(e.clientX, e.clientY);
      hoverTile = w ? { x: Math.round(w.x), y: Math.round(w.y) } : null;
    });
    cv.addEventListener("pointerleave", () => hoverTile = null);
    cv.addEventListener("contextmenu", e => { e.preventDefault(); if (st.placing) EH.UI.cancelPlace(); });
    cv.addEventListener("pointerdown", e => {
      if (e.button === 2) { if (st.placing) EH.UI.cancelPlace(); return; }
      const w = toWorld(e.clientX, e.clientY);
      if (!w) return;
      if (st.placing) { tryPlace(Math.round(w.x), Math.round(w.y)); return; }
      clickWorld(w, e);
    });
  }
  function toWorld(cx, cy) {
    const r = cv.getBoundingClientRect();
    const sx = (cx - r.left) / r.width * EH.Render.VW;
    const sy = (cy - r.top) / r.height * EH.Render.VH;
    if (sx < 0 || sy < 0 || sx > EH.Render.VW || sy > EH.Render.VH) return null;
    return EH.Render.unproject(sx, sy);
  }
  function clickWorld(w, e) {
    const tx = Math.round(w.x), ty = Math.round(w.y);
    const map = st.map;
    // 1. monster?
    if (map.kind === "dungeon") {
      let best = null, bd = 1.3;
      for (const m of st.mons) { const d = EH.dist(m.x, m.y, w.x, w.y); if (d < bd) { bd = d; best = m; } }
      if (best) {
        st.focus = best;
        const D = st.derived;
        if (EH.dist(best.x, best.y, st.player.x, st.player.y) > D.atkRange) EH.Mover.setPath(st.player, map, Math.round(best.x), Math.round(best.y), { adjacent: true });
        return;
      }
      const ch = map.chests.find(c => !c.opened && EH.dist(c.x + 0.0, c.y + 0.0, w.x, w.y) < 1.0);
      if (ch) { EH.Mover.setPath(st.player, map, ch.x, ch.y, { adjacent: true }); st.pendingInteract = { kind: "chest", ref: ch }; return; }
      if (EH.dist(map.stairs.x, map.stairs.y, w.x, w.y) < 1.1) { EH.Mover.setPath(st.player, map, map.stairs.x, map.stairs.y, { adjacent: true }); st.pendingInteract = { kind: "stairs" }; return; }
    } else {
      let best = null, bd = 1.2;
      for (const n of st.npcs) { if (n.inside) continue; const d = EH.dist(n.x, n.y, w.x, w.y); if (d < bd) { bd = d; best = n; } }
      if (best) {
        EH.Mover.setPath(st.player, map, Math.round(best.x), Math.round(best.y), { adjacent: true });
        st.pendingInteract = { kind: "npc", ref: best };
        return;
      }
      const pk = map.dungeonPortal;
      if (pk && EH.dist(pk.x, pk.y, w.x, w.y) < 1.6) {
        EH.Mover.setPath(st.player, map, pk.x, pk.y, { adjacent: true });
        st.pendingInteract = { kind: "portal" };
        return;
      }
      const b = EH.Build.at(st, tx, ty);
      if (b && b.done) {
        const npc = st.npcs.find(n => !n.inside && EH.dist(n.x, n.y, b.x + b.w / 2, b.y + b.h / 2) < 4 && (n.work === b.id || EH.BUILD[b.type].svc === n.svc));
        if (npc) { EH.Mover.setPath(st.player, map, Math.round(npc.x), Math.round(npc.y), { adjacent: true }); st.pendingInteract = { kind: "npc", ref: npc }; return; }
        EH.Mover.setPath(st.player, map, tx, ty, { adjacent: true });
        st.pendingInteract = { kind: "build", ref: b };
        return;
      }
    }
    st.pendingInteract = null;
    if (map.walk(tx, ty)) EH.Mover.setPath(st.player, map, tx, ty);
  }
  function checkPending() {
    const pi = st.pendingInteract; if (!pi) return;
    const p = st.player;
    if (pi.kind === "npc") {
      if (EH.dist(p.x, p.y, pi.ref.x, pi.ref.y) < 2.1) { st.pendingInteract = null; EH.UI.dialogue(pi.ref); }
    } else if (pi.kind === "chest") {
      if (EH.dist(p.x, p.y, pi.ref.x, pi.ref.y) < 1.8) { st.pendingInteract = null; if (!pi.ref.opened) openChest(pi.ref); }
    } else if (pi.kind === "stairs") {
      if (EH.dist(p.x, p.y, st.map.stairs.x, st.map.stairs.y) < 2.0) { st.pendingInteract = null; interact(); }
    } else if (pi.kind === "portal") {
      const pk = st.map.dungeonPortal;
      if (pk && EH.dist(p.x, p.y, pk.x, pk.y) < 2.4) { st.pendingInteract = null; EH.Combat.enterDungeon(st, st.dungeon.maxFloor || 1); }
    } else if (pi.kind === "build") {
      const b = pi.ref, c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      if (EH.dist(p.x, p.y, c.x, c.y) < Math.max(b.w, b.h) + 1.4) {
        st.pendingInteract = null;
        const svc = EH.BUILD[b.type].svc;
        const npc = st.npcs.find(n => (n.svc === svc || (svc === "shop" && n.job === "merchant") || (svc === "craft" && n.job === "blacksmith") || (svc === "heal" && n.job === "healer") || (svc === "pets" && n.job === "wrangler") || (svc === "research" && n.job === "scholar") || (svc === "guards" && n.job === "guard")) && !n.dead && EH.dist(n.x, n.y, c.x, c.y) < 8);
        if (npc) EH.UI.dialogue(npc);
        else { EH.UI.hint(`The ${EH.BUILD[b.type].n} is unmanned. Assign a villager in the <b>TOWN</b> panel.`); EH.UI.openPanel("town"); }
      }
    }
    if (st.pendingInteract && st.pendingInteract.kind !== "npc" && !st.player.path.length) st.pendingInteract = null;
  }

  function tryPlace(x, y) {
    const type = st.placing; if (!type) return;
    const B = EH.BUILD[type];
    // centre the footprint on the cursor
    const bx = x - Math.floor(B.w / 2), by = y - Math.floor(B.h / 2);
    if (!st.map.canPlace(bx, by, B.w, B.h)) { EH.toast("Can't build there"); EH.shake(2); return; }
    if (!EH.Build.canAfford(st, B.cost)) { EH.toast("Not enough resources"); return; }
    const b = EH.Build.place(st, type, bx, by);
    if (b) {
      EH.Part.burst(bx + B.w / 2, by + B.h / 2, "#c8a05a", 10);
      if (!EH.SHIFT) EH.UI.cancelPlace();
    }
  }

  /* ══════════════════════════════════════════════════════════
     MAIN UPDATE
     ══════════════════════════════════════════════════════════ */
  function update(dt) {
    if (!st) return;
    const gameDt = dt * (st.speed || 0);
    st.stats.playTime += dt;
    if (gameDt > 0) {
      advanceTime(gameDt);
      tickBuffs(dt);
      EH.Build.update(st, gameDt);
      if (st.map.kind === "town") {
        for (const n of st.npcs) EH.NPCs.update(n, st, gameDt);
        EH.NPCs.trainTick(st);        // FR-11 §6.1 — jobs grow stats
      }
      if (st.map.kind === "dungeon") {
        // a death inside this loop teleports the player home and clears st.dmap,
        // so re-check the map before every step
        for (const m of st.mons.slice()) {
          if (st.map.kind !== "dungeon") break;
          EH.Combat.monUpdate(m, st, gameDt);
        }
        if (st.map.kind === "dungeon") EH.Combat.autoExplore(st, gameDt);
      }
      EH.Combat.playerCombat(st, gameDt);
      // companions and pets are town-safe, they follow you home
      for (const c of st.companions) EH.Combat.compUpdate(c, st, gameDt);
      for (const p of st.pets) EH.Combat.petUpdate(p, st, gameDt);
      // pets gain xp from your kills
      EH.Quests.update(st, dt);
    } else {
      st.time.real += dt;
      st.time.dtMin = 0;
    }
    updatePlayer(dt);
    checkPending();
    autoInteract(dt);

    // auto-sell trash while auto-exploring
    if (st.auto && st.map.kind === "dungeon") {
      st.autoSellAcc = (st.autoSellAcc || 0) + dt;
      if (st.autoSellAcc > 6) {
        st.autoSellAcc = 0;
        const p = st.player;
        if (p.inv.length > p.cap * 0.8) {
          let total = 0, n = 0;
          for (let i = p.inv.length - 1; i >= 0; i--) {
            const it = p.inv[i];
            if (it.eq && it.rar === "common") { total += Math.round(EH.Items.value(it) * 0.45); p.inv.splice(i, 1); n++; }
          }
          if (n) { st.res.gold += total; EH.log(`Auto-sold ${n} common items for <b class="gold">${EH.fmt(total)}g</b>.`, "gold"); }
        }
      }
      // pet xp from kills
      for (const pet of st.pets) if (pet.active && pet.role === "combat") EH.Combat.petGainXp(pet, dt * 0.7 * (1 + st.dungeon.floor * 0.1), st);
    }
    // passive pet xp when active
    for (const pet of st.pets) if (pet.active) EH.Combat.petGainXp(pet, dt * 0.16, st);

    // UI throttle
    uiAcc += dt;
    if (uiAcc > 0.12) { uiAcc = 0; EH.UI.syncAll(); }
    EH.UI.tickHint(dt);
    // autosave
    saveAcc += dt;
    if (saveAcc > EH.CFG.AUTOSAVE) { saveAcc = 0; save(false); }
  }

  /* ══════════════════════════════════════════════════════════
     FR-03 — FIXED TIMESTEP
     The simulation advances only in exact FIXED increments, so the same seed
     and the same inputs always produce the same state. Rendering is decoupled
     and may run at any rate. Without this, §9.4's "abstract result == live
     view" guarantee and §10.5's "nothing resolves offline" rule are both
     unenforceable (PRD §7.2).
     ══════════════════════════════════════════════════════════ */
  const FIXED = 1 / 60;        // one sim step, always
  const MAX_STEPS = 8;         // drop the backlog rather than spiral of death
  let acc = 0;

  function frame(ts) {
    if (!running) return;
    let dt = (ts - last) / 1000;
    last = ts;
    if (!(dt > 0)) dt = FIXED;                 // first frame / tab restore
    if (dt > FIXED * MAX_STEPS) dt = FIXED * MAX_STEPS;
    EH.fps.tick(dt);
    acc += dt;
    let steps = 0;
    while (acc >= FIXED && steps < MAX_STEPS) { update(FIXED); acc -= FIXED; steps++; }
    if (steps >= MAX_STEPS) acc = 0;           // frame took too long; abandon the debt
    st.simSteps = (st.simSteps || 0) + steps;
    EH.Render.draw(st, dt);
    drawOverlay();
    requestAnimationFrame(frame);
  }
  function start() { running = true; last = performance.now(); acc = 0; requestAnimationFrame(frame); }

  /* Run exactly n fixed steps. Used by the harness to prove determinism and by
     offline catch-up so fast-forward equals having been present. */
  function stepN(n) { for (let i = 0; i < n; i++) update(FIXED); st.simSteps = (st.simSteps || 0) + n; }

  /* ── build ghost + hover highlight ─────────────────────────── */
  function drawOverlay() {
    const ctx = EH.Render.ctx; if (!ctx) return;
    if (!st) return;
    if (st.placing && hoverTile) {
      const B = EH.BUILD[st.placing];
      const bx = hoverTile.x - Math.floor(B.w / 2), by = hoverTile.y - Math.floor(B.h / 2);
      const ok = st.map.canPlace(bx, by, B.w, B.h) && EH.Build.canAfford(st, B.cost);
      for (let y = by; y < by + B.h; y++) for (let x = bx; x < bx + B.w; x++) {
        const p = EH.Render.project(x, y); if (!p) continue;
        ctx.fillStyle = ok ? "rgba(126,200,80,.35)" : "rgba(224,90,74,.35)";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - EH.CFG.TH / 2); ctx.lineTo(p.x + EH.CFG.TW / 2, p.y);
        ctx.lineTo(p.x, p.y + EH.CFG.TH / 2); ctx.lineTo(p.x - EH.CFG.TW / 2, p.y);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = ok ? "rgba(126,200,80,.9)" : "rgba(224,90,74,.9)"; ctx.lineWidth = 1; ctx.stroke();
      }
      if (ok) {
        const c = { x: bx + (B.w - 1) / 2, y: by + (B.h - 1) / 2 };
        const p = EH.Render.projectRaw(c.x, c.y);
        ctx.globalAlpha = 0.6;
        ctx.drawImage(EH.Art.building(B.shape, B.roof, B.wall, 1, { done: true }), Math.round(p.x - 32), Math.round(p.y + EH.CFG.TH / 2 - 52));
        ctx.globalAlpha = 1;
      }
      return;
    }
    if (hoverTile && st.map.inb(hoverTile.x, hoverTile.y)) {
      const p = EH.Render.project(hoverTile.x, hoverTile.y);
      if (p) {
        ctx.strokeStyle = "rgba(240,192,90,.45)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - EH.CFG.TH / 2 + 0.5); ctx.lineTo(p.x + EH.CFG.TW / 2 - 0.5, p.y);
        ctx.lineTo(p.x, p.y + EH.CFG.TH / 2 - 0.5); ctx.lineTo(p.x - EH.CFG.TW / 2 + 0.5, p.y);
        ctx.closePath(); ctx.stroke();
      }
    }
    // buff icons
    let i = 0;
    for (const k in st.buffs) {
      const b = st.buffs[k];
      const x = EH.Render.VW - 20 - i * 18, y = 66;
      ctx.fillStyle = "rgba(18,14,11,.85)"; ctx.fillRect(x - 8, y - 8, 16, 16);
      ctx.strokeStyle = "#8a6a3a"; ctx.strokeRect(x - 8.5, y - 8.5, 17, 17);
      ctx.drawImage(EH.Art.icon("star", "#f0c05a"), x - 7, y - 7, 14, 14);
      ctx.fillStyle = "#f0c05a"; ctx.font = "5px monospace"; ctx.textAlign = "center";
      ctx.fillText(Math.ceil(b.t) + "s", x, y + 14);
      ctx.textAlign = "left";
      i++;
    }
    // fps (debug-ish, subtle)
    ctx.fillStyle = "rgba(120,110,95,.5)"; ctx.font = "5px monospace";
    ctx.fillText(Math.round(EH.fps.v) + " fps", 4, EH.Render.VH - 4);
  }

  /* ══════════════════════════════════════════════════════════
     SAVE / LOAD / OFFLINE
     ══════════════════════════════════════════════════════════ */
  function serialize() {
    const o = {
      v: 3, seed: st.seed, createdAt: st.createdAt, lastSeen: Date.now(),
      rng: EH.randState(),        // FR-03: without this, reloading diverges
      speed: 1,
      time: { minute: st.time.minute, day: st.time.day, season: st.time.season },
      weather: st.weather, weatherT: st.weatherT,
      res: st.res,
      player: Object.assign({}, st.player, { path: [], focus: null }),
      buildings: st.buildings,
      npcs: st.npcs.map(n => Object.assign({}, n, { path: [], act: null, bubble: null, inside: false })),
      pets: st.pets, companions: st.companions,
      town: { homes: st.town.homes, works: st.town.works, starter: st.town.starter, taxTotal: st.town.taxTotal, lanterns: st.town.lanterns, demand: st.town.demand },
      invNpc: st.invNpc,
      dungeon: st.dungeon,
      quests: st.quests,
      research: st.research, buffs: {},
      stats: st.stats,
      auto: false,
      chestState: st.dungeon.chestState || {},
      inDungeon: st.map.kind === "dungeon" ? st.dungeon.floor : 0,
    };
    delete o.player.path;
    return o;
  }
  function save(manual) {
    if (!st) return false;
    const o = serialize();
    const ok = EH.store.set(EH.CFG.SAVE_KEY, o);
    if (!ok) { if (manual) EH.toast("Save failed — storage unavailable"); return false; }
    if (manual) { EH.toast("Game saved"); EH.log("Progress saved."); }
    return ok;
  }
  function load(o) {
    st = o;
    /* FR-03 — restore the exact point in the random stream */
    if (st.rng) EH.restoreRand(st.rng); else EH.seedRng(st.seed);
    /* MR-07 — migrate saves written before §6.1/§6.5/§10.5 existed */
    for (const n of (st.npcs || [])) {
      if (!n.stats) n.stats = EH.NPCs.baseStats(n.job || "villager", n.level || 1, EH.RNG((n.id || "x").length + (st.seed || 1)));
      if (n.adventurer === undefined) n.adventurer = null;
      if (n.downed === undefined) n.downed = 0;
      if (n.away === undefined) n.away = false;
    }
    for (const b of (st.buildings || [])) if (b.offline === undefined) b.offline = 0;
    st.time.hour = Math.floor(st.time.minute / 60);
    st.time.hourF = st.time.minute / 60;
    st.time.real = 0; st.time.dtMin = 0;
    st.buffs = {};
    st.placing = null; st.focus = null; st.pendingInteract = null;
    st.mons = [];
    st.town = Object.assign({ plaza: { x: 23, y: 23 }, rates: { gold: 0, wood: 0, stone: 0, food: 0, ore: 0 }, tradesToday: 0, taxToday: 0, lastHour: -1, demand: {}, homes: {}, works: {}, starter: [], taxTotal: 0, lanterns: 0 }, st.town);
    for (const k of EH.RESKEYS) if (st.town.rates[k] === undefined) st.town.rates[k] = 0;
    for (const k of EH.RESKEYS) if (st.res[k] === undefined) st.res[k] = 0;
    st.stats = Object.assign({ kills: 0, goldEarned: 0, xp: 0, quests: 0, built: 0, itemsFound: 0, itemsSold: 0, legendary: 0, trades: 0, deaths: 0, playTime: 0, produced: {} }, st.stats);
    st.quests = Object.assign({ active: [], board: [], done: [] }, st.quests);
    st.dungeon = Object.assign({ floor: 1, maxFloor: 1, cleared: 0, bossesKilled: 0 }, st.dungeon);
    st.player = Object.assign({ cd: {}, cap: 48, equip: {}, pts: {}, ptsLeft: 0, inv: [] }, st.player);
    st.player.path = [];
    st.player.statuses = st.player.statuses || [];
    st.player.atkAnim = 0;
    st.player.look = st.player.look || lookFor(st.player.cls);
    st.companions = st.companions || [];
    st.pets = st.pets || [];
    st.invNpc = st.invNpc || [];
    st.research = st.research || [];

    // rebuild world
    st.map = EH.genTown(st.seed);
    st.townMap = st.map;
    st.prevMap = st.map;
    st.buildings = st.buildings || [];
    for (const b of st.buildings) { b.acc = b.acc || {}; b.workers = b.workers || []; st.map.occupy(b); }
    const pk = st.map.dungeonPortal;
    st.map.dungeonPortal = pk;
    // rebuild NPCs
    st.npcs = st.npcs || [];
    for (const n of st.npcs) { n.path = []; n.act = null; n.needs = n.needs || { energy: 80, hunger: 30, social: 50, mood: 60 }; n.rel = n.rel || {}; n.inv = n.inv || []; n.memory = n.memory || []; }

    // town plaza / spawn
    st.town.plaza = st.map.spawn ? { x: st.map.spawn.x, y: st.map.spawn.y } : st.town.plaza;
    EH.Build.assignWorkers(st);
    // re-link stalls
    for (const n of st.npcs) n.stall = null;
    for (const b of EH.Build.allOf(st, "market")) {
      const v = st.npcs.find(n => (n.job === "merchant" || n.svc === "shop") && !n.stall);
      if (v) { v.stall = { x: b.x, y: b.y + b.h }; if (!v.work) v.work = b.id; }
    }
    // make sure NPC positions are valid
    for (const n of st.npcs) {
      if (!st.map.walk(Math.round(n.x), Math.round(n.y))) {
        const f = st.map.randomFree(); n.x = f.x; n.y = f.y;
      }
    }
    if (!st.map.walk(Math.round(st.player.x), Math.round(st.player.y))) {
      st.player.x = st.map.spawn.x; st.player.y = st.map.spawn.y;
    }

    // offline progress
    const report = computeOffline(o);

    st.derived = EH.Items.derive(st.player, st);
    st.player.hp = EH.clamp(st.player.hp || st.derived.hpMax, 1, st.derived.hpMax);
    st.tod = EH.todAt(st.time.hourF);

    // re-enter the dungeon if that's where we were
    if (o.inDungeon && o.inDungeon > 0) {
      EH.Combat.enterDungeon(st, o.inDungeon);
      // restore chest states
      if (st.dungeon.chestState && st.dungeon.chestState[o.inDungeon]) {
        for (const c of st.dmap.chests) if (st.dungeon.chestState[o.inDungeon][c.x + "," + c.y]) { c.opened = true; st.dmap.occ.delete(st.dmap.key(c.x, c.y)); }
      }
    }
    EH.Quests.daily(st);
    return report;
  }

  function computeOffline(o) {
    const now = Date.now();
    const lastSeen = o.lastSeen || now;
    let secs = (now - lastSeen) / 1000;
    if (secs < 45) return null;
    secs = Math.min(secs, EH.CFG.OFFLINE_CAP_H * 3600);
    const eff = EH.CFG.OFFLINE_EFF;
    const minutes = secs * (EH.CFG.MIN_PER_DAY / EH.CFG.REAL_SEC_PER_DAY) * eff;
    const days = Math.floor(minutes / EH.CFG.MIN_PER_DAY);
    const lines = [];

    // production
    const before = Object.assign({}, st.res);
    const rs = EH.Items.researchFx(st);
    const season = EH.SEASONS[st.time.season];
    let totalRate = { wood: 0, stone: 0, food: 0, ore: 0 };
    for (const b of st.buildings) {
      if (!b.done || !EH.BUILD[b.type].prod) continue;
      const eff2 = EH.Build.efficiency(st, b) * Math.pow(1.6, b.lvl - 1);
      for (const k in EH.BUILD[b.type].prod) {
        let v = EH.BUILD[b.type].prod[k] * eff2;
        if (EH.BUILD[b.type].day) v *= 0.42;   // night portion averaged out
        if (b.type === "farm") v *= season.grow * (1 + (rs.prodFood || 0));
        if (b.type === "mine") v *= 1 + (rs.prodOre || 0);
        totalRate[k] += v;
      }
    }
    for (const k in totalRate) EH.Build.addRes(st, k, totalRate[k] * minutes);
    for (const r of EH.RES) {
      if (r.k === "gold") continue;
      const gained = (st.res[r.k] || 0) - (before[r.k] || 0);
      if (gained > 0.5) lines.push(`${r.n} <b>+${EH.fmt(gained)}</b>`);
    }
    // market tax + foot traffic
    const mk = EH.Build.count(st, "market");
    const pop = st.npcs.filter(n => !n.dead).length;
    const hours = minutes / 60 * 0.55;    // only trading hours
    const trades = Math.round(hours * pop * 0.34);
    const avgTrade = 9;
    const tax = trades * avgTrade * EH.NPCs.taxRate(st);
    const traffic = mk * 0.05 * hours * 60 * 0.42;
    st.res.gold += tax + traffic;
    st.town.taxTotal = (st.town.taxTotal || 0) + tax;
    st.stats.trades += trades;
    st.town.tradesToday = trades;
    if (trades) lines.push(`Villagers made <b>${EH.fmtInt(trades)}</b> trades — you collected <b>${EH.fmt(tax)}g</b> in tax`);
    if (traffic > 1) lines.push(`Market foot traffic <b>+${EH.fmt(traffic)}g</b>`);
    // wages
    const wages = EH.CFG.WAGE_PER_DAY * pop * days;
    if (wages > 0 && days > 0) {
      const paid = Math.min(st.res.gold, wages);
      st.res.gold -= paid;
      for (const n of st.npcs) n.gold += (paid / Math.max(1, pop)) * 0.9;
      lines.push(`Wages paid <b>-${EH.fmt(paid)}g</b> (${days} day${days === 1 ? "" : "s"})`);
    }
    // dungeon auto-explore while away
    if (o.auto && o.inDungeon) {
      const power = st.derived ? st.derived.atk : 20;
      const floors = Math.min(6, Math.floor(secs / 1500));
      if (floors > 0) {
        st.dungeon.maxFloor = Math.max(st.dungeon.maxFloor, o.inDungeon + floors);
        const g = Math.round(floors * (30 + st.dungeon.maxFloor * 25) * (st.derived ? st.derived.goldfind : 1));
        const xp = Math.round(floors * (40 + st.dungeon.maxFloor * 30));
        st.res.gold += g;
        st.stats.goldEarned += g;
        EH.Combat.gainXp(st, xp);
        lines.push(`Your expedition cleared <b>${floors}</b> floor${floors === 1 ? "" : "s"} — <b>${EH.fmt(g)}g</b>, ${EH.fmt(xp)} xp`);
      }
    }
    // needs drift + a couple of town events
    for (const n of st.npcs) {
      n.needs.energy = EH.clamp(85 - days * 4, 20, 100);
      n.needs.hunger = EH.clamp(n.needs.hunger + days * 12, 0, 100);
    }
    if (days > 0) {
      const ev = Math.min(4, days);
      for (let i = 0; i < ev; i++) {
        const a = EH.pick(st.npcs), b = EH.pick(st.npcs);
        if (a && b && a !== b) {
          EH.NPCs.rel(a, b.id, EH.rand(-4, 6), st); EH.NPCs.rel(b, a.id, EH.rand(-4, 6), st);
        }
      }
      lines.push(`${EH.plural(days, "day")} passed. The town went about its business.`);
    }
    // advance the clock
    st.time.minute += minutes % EH.CFG.MIN_PER_DAY;
    st.time.day += days;
    while (st.time.minute >= EH.CFG.MIN_PER_DAY) { st.time.minute -= EH.CFG.MIN_PER_DAY; }
    st.time.hour = Math.floor(st.time.minute / 60); st.time.hourF = st.time.minute / 60;
    st.time.season = Math.floor((st.time.day - 1) / 28) % 4;
    st.tod = EH.todAt(st.time.hourF);
    if (!lines.length) lines.push("Nothing much happened. The hold held.");
    return { secs, days, lines };
  }

  /* ── sleep ─────────────────────────────────────────────────── */
  function sleep() {
    if (st.map.kind !== "town") { EH.toast("Not safe to sleep here"); return; }
    const t = st.time;
    t.hourF = t.minute / 60; t.hour = Math.floor(t.hourF);
    const target = t.hourF < 6 ? 6.5 : 30.5;   // next 06:30
    let mins = (target - t.hourF) * 60;
    if (mins < 0) mins += 1440;
    const secs = mins / (EH.CFG.MIN_PER_DAY / EH.CFG.REAL_SEC_PER_DAY);
    // fast-forward
    const savedSpeed = st.speed;
    st.speed = 12;
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      advanceTime(secs / steps);
      for (const n of st.npcs) EH.NPCs.update(n, st, secs / steps);
      EH.Build.update(st, secs / steps);
    }
    st.speed = savedSpeed;
    st.player.hp = st.derived.hpMax;
    for (const c of st.companions) c.hp = c.hpMax;
    for (const n of st.npcs) n.needs.energy = 100;
    EH.log("You sleep in the Warden's house. <b class='good'>Dawn comes, and you are rested.</b>", "good");
    EH.toast("Rested — dawn breaks");
    EH.UI.syncAll();
  }

  return { boot, newState, save, load, serialize, sleep, interact, update, start, stepN, FIXED,
           get st() { return st; }, set st(v) { st = v; }, openChest, setupWorld };
})();

/* ── shift-key tracking for continuous building ──────────────── */
EH.SHIFT = false;
window.addEventListener("keydown", e => { if (e.key === "Shift") EH.SHIFT = true; });
window.addEventListener("keyup", e => { if (e.key === "Shift") EH.SHIFT = false; });
window.addEventListener("blur", () => { EH.SHIFT = false; });

window.addEventListener("load", () => {
  try { EH.Game.boot(); }
  catch (err) {
    console.error(err);
    const d = document.createElement("div");
    d.style.cssText = "position:fixed;inset:0;background:#1a120c;color:#e05a4a;font:13px monospace;padding:30px;z-index:999;overflow:auto";
    d.innerHTML = "<b>Emberhold failed to start.</b><pre style='color:#cbbb9c'>" + (err && err.stack ? err.stack : err) + "</pre>";
    document.body.appendChild(d);
  }
});
window.addEventListener("beforeunload", () => { if (EH.Game.st) EH.Game.save(false); });
document.addEventListener("visibilitychange", () => { if (document.hidden && EH.Game.st) EH.Game.save(false); });
