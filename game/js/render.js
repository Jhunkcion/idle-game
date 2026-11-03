/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — render.js : isometric canvas renderer, lighting, weather
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;

/* ══════════════════════════════════════════════════════════════
   FLOATING TEXT (DOM overlay, projected from world space)
   ══════════════════════════════════════════════════════════════ */
EH.Float = (function () {
  let host = null;
  const bubbles = new Map();
  function init() { host = document.getElementById("floaters"); }
  function world(wx, wy, text, cls) {
    if (!host) return;
    const s = EH.Render.project(wx, wy);
    if (!s) return;
    const d = EH.el("div", "fl " + (cls || ""), EH.esc(text));
    d.style.left = s.x + "px"; d.style.top = s.y + "px";
    d.style.fontSize = (cls === "crit" ? 12 : 10) + "px";
    host.appendChild(d);
    setTimeout(() => d.remove(), 1050);
    if (host.childElementCount > 60) host.firstChild.remove();
  }
  function bubble(npc, text) {
    if (!host) return;
    let d = bubbles.get(npc.id);
    if (!d) { d = EH.el("div", "fl bubble"); host.appendChild(d); bubbles.set(npc.id, d); }
    d.textContent = text;
    d.style.animation = "none"; void d.offsetWidth; d.style.animation = "";
  }
  function sync(st) {
    if (!host) return;
    for (const [id, d] of bubbles) {
      const n = st.npcs.find(x => x.id === id);
      if (!n || !n.bubble || n.inside || n.bubbleT <= 0 || st.map.kind !== "town") { d.remove(); bubbles.delete(id); continue; }
      const s = EH.Render.project(n.x, n.y - 1.5);
      if (!s) { d.remove(); bubbles.delete(id); continue; }
      d.style.left = s.x + "px"; d.style.top = s.y + "px";
      d.style.fontSize = "9px";
    }
  }
  return { init, world, bubble, sync, bubbles };
})();

/* ══════════════════════════════════════════════════════════════
   PARTICLES
   ══════════════════════════════════════════════════════════════ */
EH.Part = (function () {
  const list = [];
  function burst(wx, wy, color, n) {
    for (let i = 0; i < (n || 12); i++) {
      const a = EH.rand(0, EH.TAU), s = EH.rand(10, 60);
      list.push({ x: wx, y: wy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: EH.rand(0.3, 0.8), c: color, g: 90 });
    }
  }
  function update(dt) { for (let i = list.length - 1; i >= 0; i--) { const p = list[i]; p.t -= dt; if (p.t <= 0) { list.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt / EH.CFG.TW * 2; p.y += p.vy * dt / EH.CFG.TH * 2; } }
  function draw(ctx) { for (const p of list) { const s = EH.Render.project(p.x, p.y); if (!s) continue; ctx.globalAlpha = EH.clamp(p.t * 2, 0, 1); ctx.fillStyle = p.c; ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2); } ctx.globalAlpha = 1; }
  return { burst, update, draw, list };
})();

/* ══════════════════════════════════════════════════════════════
   RENDERER
   ══════════════════════════════════════════════════════════════ */
EH.Render = (function () {
  let cv, ctx, lc, lx;
  let VW = EH.CFG.VW, VH = EH.CFG.VH, scale = 2;
  let camX = 0, camY = 0;
  let shakeT = 0, shakeMag = 0;
  const rain = [];
  let rainInit = false;
  let flashT = 0;

  function init() {
    cv = document.getElementById("cv");
    ctx = cv.getContext("2d", { alpha: false });
    lc = document.createElement("canvas"); lc.width = VW; lc.height = VH;
    lx = lc.getContext("2d");
    EH.Float.init();
    resize();
    window.addEventListener("resize", resize);
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    let k = Math.min(w / VW, h / VH);
    scale = k >= 1 ? Math.max(1, Math.floor(k)) : k;
    cv.width = Math.round(VW * scale); cv.height = Math.round(VH * scale);
    cv.style.width = cv.width + "px"; cv.style.height = cv.height + "px";
    cv.style.left = ((w - cv.width) / 2) + "px";
    cv.style.top = ((h - cv.height) / 2) + "px";
    cv.style.position = "absolute";
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // keep the DOM floater layer locked to the canvas so world-space
    // coordinates line up (it is drawn in the 480x270 internal space)
    const fl = document.getElementById("floaters");
    if (fl) {
      fl.style.left = cv.style.left; fl.style.top = cv.style.top;
      fl.style.right = "auto"; fl.style.bottom = "auto";
      fl.style.width = VW + "px"; fl.style.height = VH + "px";
      fl.style.transformOrigin = "0 0";
      fl.style.transform = "scale(" + scale + ")";
    }
  }

  /* ── projection ────────────────────────────────────────────── */
  const TW = EH.CFG.TW, TH = EH.CFG.TH;
  function project(wx, wy) {
    const sx = (wx - wy) * (TW / 2) + camX;
    const sy = (wx + wy) * (TH / 2) + camY;
    if (sx < -80 || sy < -120 || sx > VW + 80 || sy > VH + 120) return null;
    return { x: Math.round(sx), y: Math.round(sy) };
  }
  function projectRaw(wx, wy) { return { x: (wx - wy) * (TW / 2) + camX, y: (wx + wy) * (TH / 2) + camY }; }
  function unproject(sx, sy) {
    const x = sx - camX, y = sy - camY;
    return { x: (y / (TH / 2) + x / (TW / 2)) / 2, y: (y / (TH / 2) - x / (TW / 2)) / 2 };
  }
  function shake(m) { shakeMag = Math.max(shakeMag, m || 3); shakeT = 0.22; }

  /* ── camera ────────────────────────────────────────────────── */
  function updateCam(st, dt) {
    const p = st.player;
    const tx = VW / 2 - (p.x - p.y) * (TW / 2);
    const ty = VH / 2 - (p.x + p.y) * (TH / 2) + 12;
    const k = 1 - Math.pow(0.0015, dt);
    camX = EH.lerp(camX, tx, k); camY = EH.lerp(camY, ty, k);
    if (shakeT > 0) { shakeT -= dt; const m = shakeMag * (shakeT / 0.22); camX += EH.rand(-m, m); camY += EH.rand(-m, m); if (shakeT <= 0) shakeMag = 0; }
  }
  function snapCam(st) {
    const p = st.player;
    camX = VW / 2 - (p.x - p.y) * (TW / 2);
    camY = VH / 2 - (p.x + p.y) * (TH / 2) + 12;
  }

  /* ══════════════════════════════════════════════════════════
     MAIN DRAW
     ══════════════════════════════════════════════════════════ */
  function draw(st, dt) {
    if (!cv) return;
    updateCam(st, dt);
    const map = st.map, tod = st.tod, W = EH.WEATHER[st.weather] || EH.WEATHER.clear;
    const dungeon = map.kind === "dungeon";

    // sky / backdrop
    if (dungeon) { ctx.fillStyle = "#0a0807"; }
    else {
      const sky = EH.mix(EH.hex2rgb("#8ec8e8"), EH.hex2rgb("#0a0e1e"), EH.clamp(tod.dark * 1.35, 0, 1));
      ctx.fillStyle = EH.rgb2css(sky);
    }
    ctx.fillRect(0, 0, VW, VH);

    // ── depth-bucketed actors ──
    const buckets = new Map();
    const put = (d, o) => { let a = buckets.get(d); if (!a) { a = []; buckets.set(d, a); } a.push(o); };

    if (!dungeon) {
      for (const b of st.buildings) put((b.x + b.w - 1) + (b.y + b.h - 1), { k: "b", o: b });
    }
    const actors = [];
    const vis = (e) => {
      const s = projectRaw(e.x, e.y);
      return s.x > -60 && s.x < VW + 60 && s.y > -80 && s.y < VH + 80;
    };
    if (dungeon) {
      for (const m of st.mons) { if (!m.dead && vis(m) && EH.seenAt(map, Math.round(m.x), Math.round(m.y))) actors.push({ k: "m", o: m }); }
    } else {
      for (const n of st.npcs) if (!n.dead && !n.inside && vis(n)) actors.push({ k: "n", o: n });
    }
    for (const c of st.companions) if (c.active && c.hp > 0 && vis(c)) actors.push({ k: "c", o: c });
    for (const p of st.pets) if (p.active && vis(p)) actors.push({ k: "p", o: p });
    actors.push({ k: "pl", o: st.player });
    for (const a of actors) put(Math.round(a.o.x + a.o.y), a);

    // ── tile pass (painter's order, one diagonal at a time) ──
    const S = map.w + map.h;
    const lights = [];
    const chestAt = dungeon ? new Map(st.dmap.chests.map(c => [c.x + "," + c.y, c])) : null;
    for (let s = 0; s < S; s++) {
      const x0 = Math.max(0, s - map.h + 1), x1 = Math.min(map.w - 1, s);
      for (let x = x0; x <= x1; x++) {
        const y = s - x;
        if (y < 0 || y >= map.h) continue;
        const sp = project(x, y);
        if (!sp) continue;
        const id = map.t[map.i(x, y)];
        const seen = dungeon ? map.seen[map.i(x, y)] : 1;
        if (dungeon && !seen) {
          ctx.fillStyle = "#08070a";
          ctx.fillRect(sp.x - TW / 2, sp.y - TH / 2, TW, TH);
          continue;
        }
        const def = EH.tileDef(id);
        const v = map.v[map.i(x, y)];
        // walls get a raised side face
        if (def.kind === "x") {
          const hgt = dungeon ? 14 : 10;
          ctx.drawImage(EH.Art.wallSide(id, v, hgt), sp.x - TW / 2, sp.y - TH / 2);
        } else {
          const anim = def.anim ? Math.floor(st.time.real * 3) % 4 : v;
          ctx.drawImage(EH.Art.tile(id, anim), sp.x - TW / 2, sp.y - TH / 2);
        }
        // objects on the tile
        if (def.obj) {
          const o = def.obj === "chest" ? null : def.obj;
          if (o) {
            const spr = EH.Art.obj(o, v, { season: st.time.season, c: def.pal });
            ctx.drawImage(spr, sp.x - 16, sp.y + TH / 2 - 48);
          }
        }
        // chests & portals & dungeon stairs
        if (dungeon) {
          const ch = chestAt ? chestAt.get(x + "," + y) : null;
          if (ch && !ch.opened) ctx.drawImage(EH.Art.obj("chest", 0, { opened: ch.opened }), sp.x - 16, sp.y + TH / 2 - 48);
          if (id === EH.T.DSTAIRS) ctx.drawImage(EH.Art.obj("stairs", 0), sp.x - 16, sp.y + TH / 2 - 48);
          if (id === EH.T.DPORTAL) ctx.drawImage(EH.Art.obj("portal", 0, { t: st.time.real }), sp.x - 16, sp.y + TH / 2 - 48);
          if (id === EH.T.SLAVA) lights.push({ x: x + 0.5, y: y + 0.5, r: 2.4, c: [255, 130, 50], a: 0.8 });
        } else if (id === EH.T.DPORTAL) {
          ctx.drawImage(EH.Art.obj("portal", 0, { t: st.time.real }), sp.x - 16, sp.y + TH / 2 - 48);
          lights.push({ x: x + 0.5, y: y + 0.5, r: 3.2, c: [150, 100, 240], a: 0.85 });
        }
      }
      // actors standing on this diagonal are drawn after its tiles
      const bk = buckets.get(s);
      if (bk) for (const a of bk) {
        if (a.k === "b") drawBuilding(ctx, a.o, st);
        else drawActor(ctx, a, st);
      }
    }
    // any actors beyond the last tile row
    for (let s = S; s < S + 6; s++) { const bk = buckets.get(s); if (bk) for (const a of bk) { if (a.k === "b") drawBuilding(ctx, a.o, st); else drawActor(ctx, a, st); } }

    EH.Part.update(dt);
    EH.Part.draw(ctx);

    // ── lights from buildings ──
    if (!dungeon) {
      for (const b of st.buildings) {
        const B = EH.BUILD[b.type];
        if (!b.done || !B.light) continue;
        const c = EH.Build.centre(b);
        const col = b.type === "forge" ? [255, 140, 50] : b.type === "monument" ? [255, 170, 80] : [255, 210, 140];
        lights.push({ x: c.x, y: c.y, r: 3.4 * B.light, c: col, a: 0.9 });
      }
      for (const n of st.npcs) {
        if (!n.inside && EH.isNight(st.time.hourF) && n.look && n.look.weapon === "lantern") lights.push({ x: n.x, y: n.y, r: 2.4, c: [255, 200, 120], a: 0.7 });
      }
    }
    // player light
    lights.push({ x: st.player.x, y: st.player.y, r: st.derived.light, c: [255, 235, 190], a: 1 });
    for (const c of st.companions) if (c.active) lights.push({ x: c.x, y: c.y, r: 1.8, c: [255, 220, 170], a: 0.5 });

    drawLighting(ctx, lights, tod, dungeon, st);

    // ── weather ──
    if (!dungeon && W.part) drawWeather(ctx, W, dt, st);

    // ── lightning flash ──
    if (W.flash && !dungeon) {
      if (flashT > 0) flashT -= dt;
      else if (EH.chance(dt * 0.08)) flashT = 0.18;
      if (flashT > 0) { ctx.fillStyle = `rgba(220,230,255,${0.35 * (flashT / 0.18)})`; ctx.fillRect(0, 0, VW, VH); }
    }
    // vignette
    const g = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.42, VW / 2, VH / 2, VH * 0.95);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${dungeon ? 0.62 : 0.34})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);

    EH.Float.sync(st);
  }

  /* ── lighting pass ─────────────────────────────────────────── */
  function drawLighting(ctx, lights, tod, dungeon, st) {
    let dark = dungeon ? 0.90 : tod.dark;
    const W = EH.WEATHER[st.weather] || EH.WEATHER.clear;
    if (!dungeon) dark = EH.clamp(dark + W.dark, 0, 0.95);
    const amb = dungeon ? [12, 10, 18] : tod.amb;
    lx.clearRect(0, 0, VW, VH);
    lx.globalCompositeOperation = "source-over";
    lx.fillStyle = EH.rgba(amb, dark);
    lx.fillRect(0, 0, VW, VH);
    lx.globalCompositeOperation = "destination-out";
    for (const L of lights) {
      const p = projectRaw(L.x, L.y);
      if (p.x < -120 || p.x > VW + 120 || p.y < -120 || p.y > VH + 120) continue;
      const rx = L.r * TW / 2, ry = L.r * TH / 2 * 1.35;
      const gr = lx.createRadialGradient(0, 0, 0, 0, 0, 1);
      gr.addColorStop(0, `rgba(0,0,0,${L.a})`);
      gr.addColorStop(0.45, `rgba(0,0,0,${L.a * 0.55})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      lx.save(); lx.translate(p.x, p.y); lx.scale(rx, ry);
      lx.fillStyle = gr; lx.beginPath(); lx.arc(0, 0, 1, 0, EH.TAU); lx.fill(); lx.restore();
    }
    lx.globalCompositeOperation = "source-over";
    ctx.drawImage(lc, 0, 0, VW, VH);
    // warm glow additively for the biggest lights
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const L of lights) {
      if (L.a < 0.75) continue;
      const p = projectRaw(L.x, L.y);
      if (p.x < -100 || p.x > VW + 100 || p.y < -100 || p.y > VH + 100) continue;
      const rx = L.r * TW / 2 * 0.7, ry = L.r * TH / 2;
      const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(rx, ry));
      gr.addColorStop(0, EH.rgba(L.c, 0.20 * dark * 1.6));
      gr.addColorStop(1, EH.rgba(L.c, 0));
      ctx.fillStyle = gr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, ry / rx); ctx.beginPath(); ctx.arc(0, 0, rx, 0, EH.TAU); ctx.fill(); ctx.restore();
    }
    ctx.restore();
  }

  /* ── weather particles ─────────────────────────────────────── */
  function initWeather() {
    rain.length = 0;
    for (let i = 0; i < 220; i++) rain.push({ x: EH.rand(-40, VW + 40), y: EH.rand(-20, VH), s: EH.rand(0.6, 1.5), v: EH.rand(180, 320) });
    rainInit = true;
  }
  function drawWeather(ctx, W, dt, st) {
    if (!rainInit) initWeather();
    if (W.part === "rain") {
      ctx.strokeStyle = "rgba(180,205,235,.42)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const p of rain) {
        p.y += p.v * dt * p.s; p.x -= p.v * 0.22 * dt * p.s;
        if (p.y > VH) { p.y = -10; p.x = EH.rand(-40, VW + 60); }
        if (p.x < -40) p.x = VW + 20;
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 2 * p.s, p.y + 7 * p.s);
      }
      ctx.stroke();
    } else if (W.part === "snow") {
      ctx.fillStyle = "rgba(240,248,255,.75)";
      for (const p of rain) {
        p.y += p.v * 0.22 * dt * p.s; p.x += Math.sin((p.y + p.s * 100) * 0.03) * 14 * dt;
        if (p.y > VH) { p.y = -6; p.x = EH.rand(-40, VW + 40); }
        ctx.fillRect(p.x | 0, p.y | 0, p.s > 1.1 ? 2 : 1, p.s > 1.1 ? 2 : 1);
      }
    } else if (W.part === "fog") {
      ctx.fillStyle = "rgba(200,210,220,.16)";
      for (let i = 0; i < 5; i++) {
        const y = (i / 5) * VH + Math.sin(st.time.real * 0.15 + i) * 12;
        ctx.fillRect(0, y, VW, VH / 6);
      }
    }
  }

  /* ── buildings ─────────────────────────────────────────────── */
  function drawBuilding(ctx, b, st) {
    const B = EH.BUILD[b.type]; if (!B) return;
    const c = { x: b.x + (b.w - 1) / 2, y: b.y + (b.h - 1) / 2 };
    const p = projectRaw(c.x, c.y);
    const night = EH.isNight(st.time.hourF);
    const spr = EH.Art.building(B.shape, B.roof, B.wall, b.lvl, { done: b.done, night });
    ctx.drawImage(spr, Math.round(p.x - 32), Math.round(p.y + TH / 2 - 52));
    if (!b.done) {
      // construction progress bar
      const w = 22, pr = EH.clamp(1 - b.t / b.tmax, 0, 1);
      ctx.fillStyle = "#1a1410"; ctx.fillRect(p.x - w / 2, p.y - 40, w, 4);
      ctx.fillStyle = "#c8a05a"; ctx.fillRect(p.x - w / 2 + 1, p.y - 39, (w - 2) * pr, 2);
      ctx.fillStyle = "#1a1410"; ctx.fillRect(p.x - 5, p.y - 48, 10, 6);
      ctx.fillStyle = "#f0c05a"; ctx.font = "5px monospace"; ctx.fillText("BUILD", p.x - 4.5, p.y - 43.5);
    }
    if (b.hp < 100) { ctx.fillStyle = "#1a1410"; ctx.fillRect(p.x - 11, p.y - 34, 22, 3); ctx.fillStyle = "#d8452f"; ctx.fillRect(p.x - 10, p.y - 33, 20 * b.hp / 100, 1); }
    // service marker
    if (B.svc && b.done) {
      const icon = B.svc === "shop" ? "coin" : B.svc === "craft" ? "anvil" : B.svc === "heal" ? "potion" : B.svc === "pets" ? "egg" : B.svc === "research" ? "book" : B.svc === "guards" ? "shield" : "star";
      ctx.globalAlpha = 0.9 + Math.sin(st.time.real * 3) * 0.1;
      ctx.drawImage(EH.Art.icon(icon, B.svc === "shop" ? "#f0c05a" : "#c8a05a"), Math.round(p.x - 6), Math.round(p.y - 56 + Math.sin(st.time.real * 2) * 1.2), 12, 12);
      ctx.globalAlpha = 1;
    }
  }

  /* ── characters / monsters / pets ──────────────────────────── */
  function drawActor(ctx, a, st) {
    const e = a.o;
    const p = projectRaw(e.x, e.y);
    const sx = Math.round(p.x), sy = Math.round(p.y + TH / 2);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath(); ctx.ellipse(sx, sy - 1, 5, 2.4, 0, 0, EH.TAU); ctx.fill();

    if (a.k === "m") {
      const spr = EH.Art.monster(e.body, e.c, e.hurtT > 0 ? 1 : e.frame, { big: e.boss, weapon: true });
      const k = e.boss ? 2.2 : e.elite ? 1.3 : 1;
      ctx.save();
      if (e.hurtT > 0) { ctx.globalCompositeOperation = "source-over"; }
      ctx.translate(sx, sy);
      if (e.flip) ctx.scale(-1, 1);
      ctx.drawImage(spr, Math.round(-10 * k), Math.round((-19 - (e.fly ? 6 + Math.sin(st.time.real * 4) * 2 : 0)) * k), Math.round(20 * k), Math.round(20 * k));
      ctx.restore();
      if (e.hurtT > 0) { ctx.save(); ctx.globalAlpha = 0.55; ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "#ff8060"; ctx.beginPath(); ctx.ellipse(sx, sy - 8 * k, 7 * k, 9 * k, 0, 0, EH.TAU); ctx.fill(); ctx.restore(); }
      if (e.elite || e.boss) {
        const w = e.boss ? 30 : 16;
        ctx.fillStyle = "#1a1410"; ctx.fillRect(sx - w / 2, sy - (e.boss ? 34 : 24), w, 3);
        ctx.fillStyle = e.boss ? "#e0933a" : "#a85ce0"; ctx.fillRect(sx - w / 2 + 1, sy - (e.boss ? 33 : 23), (w - 2) * EH.clamp(e.hp / e.hpMax, 0, 1), 1);
        if (e.boss) {
          ctx.fillStyle = "#f0c05a"; ctx.font = "bold 5px monospace"; ctx.textAlign = "center";
          ctx.fillText(e.name.toUpperCase(), sx, sy - 37); ctx.textAlign = "left";
        }
      }
      if (e.statuses.length) {
        let i = 0;
        for (const s of e.statuses) {
          ctx.fillStyle = s.k === "burn" ? "#e06a20" : s.k === "poison" ? "#7ec850" : s.k === "root" ? "#c8a05a" : "#8ef0d8";
          ctx.fillRect(sx + 8, sy - 16 + i * 3, 2, 2); i++;
        }
      }
      return;
    }

    // humanoid-ish actors
    let look = e.look || e, spr = null;
    if (a.k === "p") spr = EH.Art.pet(e.body, e.c, e.frame, e.fly);
    else spr = EH.Art.humanoid(look);

    if (a.k === "p") {
      ctx.save(); ctx.translate(sx, sy - (e.fly ? 5 + Math.sin(st.time.real * 5) * 2 : 0));
      if (e.flip) ctx.scale(-1, 1);
      ctx.drawImage(spr, -7, -12, 14, 12); ctx.restore();
      if (e.hp !== undefined && e.hp < e.hpMax) { ctx.fillStyle = "#1a1410"; ctx.fillRect(sx - 7, sy - 17, 14, 2); ctx.fillStyle = "#7ec850"; ctx.fillRect(sx - 6, sy - 16, 12 * e.hp / e.hpMax, 1); }
      return;
    }

    const set = spr[e.dir] || spr.front;
    const walking = e.moving || (e.path && e.path.length);
    const fi = walking ? (1 + (Math.floor(e.anim || 0) % 2)) : 0;
    const frame = set[fi] || set[0];
    const atk = (a.k === "pl" && st.player.atkAnim > 0) || (a.k === "c" && (e.atkAnim || 0) > 0);
    ctx.save();
    ctx.translate(sx, sy);
    if (e.flip) ctx.scale(-1, 1);
    if (atk) ctx.translate(EH.sign(e.flip ? -1 : 1) * 1, 0);
    ctx.drawImage(frame, -8, -23, 16, 24);
    ctx.restore();
    // hurt flash
    if (e.hurtT > 0) { ctx.save(); ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = "#ff9070"; ctx.fillRect(sx - 6, sy - 22, 12, 22); ctx.restore(); }
    // player marker
    if (a.k === "pl") {
      ctx.fillStyle = "rgba(240,192,90,.85)";
      const yy = sy - 28 + Math.sin(st.time.real * 3) * 1.2;
      ctx.beginPath(); ctx.moveTo(sx, yy + 4); ctx.lineTo(sx - 3, yy); ctx.lineTo(sx + 3, yy); ctx.closePath(); ctx.fill();
      if (st.player.ward) { ctx.strokeStyle = "rgba(142,240,216,.5)"; ctx.beginPath(); ctx.ellipse(sx, sy - 11, 8, 12, 0, 0, EH.TAU); ctx.stroke(); }
      if (st.player.guard) { ctx.strokeStyle = "rgba(240,192,90,.5)"; ctx.beginPath(); ctx.ellipse(sx, sy - 11, 9, 13, 0, 0, EH.TAU); ctx.stroke(); }
    }
    // name plates for NPCs when close
    if (a.k === "n") {
      const d = EH.dist(e.x, e.y, st.player.x, st.player.y);
      if (d < 7) {
        ctx.font = "5px monospace"; ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,.7)"; ctx.fillText(e.name, sx + 0.6, sy - 25.4);
        ctx.fillStyle = e.quest ? (e.quest.state === "ready" ? "#7ec850" : "#f0c05a") : "#d8cbb0";
        ctx.fillText(e.name, sx, sy - 26);
        if (e.quest) {
          const sym = e.quest.state === "ready" ? "?" : "!";
          ctx.fillStyle = e.quest.state === "ready" ? "#7ec850" : "#f0c05a";
          ctx.font = "bold 8px monospace";
          ctx.fillText(sym, sx, sy - 32 + Math.sin(st.time.real * 4) * 1.2);
        }
        ctx.textAlign = "left";
      }
    }
    if (a.k === "c") {
      ctx.fillStyle = "#1a1410"; ctx.fillRect(sx - 8, sy - 27, 16, 2);
      ctx.fillStyle = "#d8452f"; ctx.fillRect(sx - 7, sy - 26, 14 * EH.clamp(e.hp / e.hpMax, 0, 1), 1);
      ctx.font = "5px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#c8d8e8"; ctx.fillText(e.name.split(" ")[0], sx, sy - 29); ctx.textAlign = "left";
    }
  }

  return { init, resize, draw, project, projectRaw, unproject, shake, snapCam, get scale() { return scale; }, get ctx() { return ctx; }, VW, VH };
})();

/* ── screen shake + level flash shims used by other modules ───── */
EH.shake = m => EH.Render.shake(m);
EH.toast = function (text) {
  const host = document.getElementById("toast");
  if (!host) return;
  const d = EH.el("div", "toast", EH.esc(text));
  host.appendChild(d);
  setTimeout(() => d.remove(), 2900);
};
EH.flashLevel = function () {
  const gv = document.getElementById("gameview");
  if (!gv) return;
  const d = EH.el("div", "lvlup", "LEVEL UP");
  gv.appendChild(d);
  setTimeout(() => d.remove(), 2300);
};
