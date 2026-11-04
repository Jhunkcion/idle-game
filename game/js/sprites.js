/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — sprites.js : 100% procedural pixel art.
   Every tile, character, monster, item icon and building is drawn at
   runtime into cached offscreen canvases. No image assets at all.
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;
EH.Art = (function () {
  const CACHE = new Map();
  const R = EH.rngA;

  /* ── primitives ───────────────────────────────────────────── */
  function mk(w, h) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const x = cv.getContext("2d");
    x.imageSmoothingEnabled = false;
    return { cv, x };
  }
  function px(x, i, j, w, h, c) { x.fillStyle = c; x.fillRect(i, j, w === undefined ? 1 : w, h === undefined ? 1 : h); }
  function shade(c, a) { return EH.shade(c, a); }
  function cached(key, w, h, fn) {
    let v = CACHE.get(key);
    if (v) return v;
    const o = mk(w, h); fn(o.x, o); v = o.cv; CACHE.set(key, v); return v;
  }

  /* ═══════════════════════════════════════════════════════════
     TILES  (32×16 iso diamond, optional object drawn separately)
     ═══════════════════════════════════════════════════════════ */
  function diamond(x, cx, cy, w, h, c) {
    x.fillStyle = c; x.beginPath();
    x.moveTo(cx, cy - h / 2); x.lineTo(cx + w / 2, cy);
    x.lineTo(cx, cy + h / 2); x.lineTo(cx - w / 2, cy);
    x.closePath(); x.fill();
  }
  function tile(id, variant) {
    const def = EH.tileDef(id);
    return cached("t" + id + "_" + variant, 32, 16, (x) => {
      const p = def.pal, r = EH.RNG(id * 977 + variant * 31 + 7);
      diamond(x, 16, 8, 32, 16, p[0]);
      // texture speckle
      const n = 26;
      for (let i = 0; i < n; i++) {
        const a = r() * EH.TAU, rad = Math.sqrt(r());
        const ox = Math.round(16 + Math.cos(a) * rad * 15), oy = Math.round(8 + Math.sin(a) * rad * 7);
        px(x, ox, oy, 1, 1, p[1 + Math.floor(r() * (p.length - 1))]);
      }
      if (def.deco === "flowers") {
        for (let i = 0; i < 5; i++) {
          const ox = 6 + Math.floor(r() * 20), oy = 4 + Math.floor(r() * 8);
          px(x, ox, oy, 1, 1, r() < 0.5 ? "#e8d050" : "#e07090");
          px(x, ox, oy + 1, 1, 1, "#3d6829");
        }
      }
      if (def.anim) { // water ripples
        for (let i = 0; i < 4; i++) {
          const oy = 3 + i * 3 + (variant % 2);
          for (let j = 0; j < 5; j++) px(x, 6 + j * 4 + (i % 2) * 2, oy, 2, 1, p[1]);
        }
      }
      if (id === EH.T.PATH || id === EH.T.ROAD) {
        for (let i = 0; i < 8; i++) px(x, 4 + Math.floor(r() * 24), 3 + Math.floor(r() * 10), 1, 1, p[2]);
      }
      // bevel
      x.globalAlpha = 0.28;
      x.strokeStyle = "#ffffff"; x.beginPath();
      x.moveTo(1, 8); x.lineTo(16, 1); x.lineTo(31, 8); x.stroke();
      x.strokeStyle = "#000000"; x.beginPath();
      x.moveTo(31, 8); x.lineTo(16, 15); x.lineTo(1, 8); x.stroke();
      x.globalAlpha = 1;
    });
  }
  /* dirt/rock side face for raised tiles (dungeon walls) */
  function wallSide(id, variant, hgt) {
    return cached("ws" + id + "_" + variant + "_" + hgt, 32, 16 + hgt, (x) => {
      const p = EH.tileDef(id).pal, r = EH.RNG(id * 31 + variant * 7 + hgt);
      // left face
      x.fillStyle = shade(p[0], -0.34); x.beginPath();
      x.moveTo(0, 8); x.lineTo(16, 16); x.lineTo(16, 16 + hgt); x.lineTo(0, 8 + hgt); x.closePath(); x.fill();
      // right face
      x.fillStyle = shade(p[0], -0.5); x.beginPath();
      x.moveTo(32, 8); x.lineTo(16, 16); x.lineTo(16, 16 + hgt); x.lineTo(32, 8 + hgt); x.closePath(); x.fill();
      for (let i = 0; i < 22; i++) {
        const ox = Math.floor(r() * 32), oy = 8 + Math.floor(r() * (8 + hgt));
        px(x, ox, oy, 1, 1, shade(p[1], -0.4 - r() * 0.25));
      }
      // brick lines
      x.fillStyle = shade(p[0], -0.62);
      for (let k = 0; k < 3; k++) {
        const yy = 11 + k * Math.floor(hgt / 3);
        x.fillRect(1, yy - 3 + k, 14, 1); x.fillRect(17, yy + k, 14, 1);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════
     WORLD OBJECTS : trees, rocks, chests, stairs, portal, pillar
     ═══════════════════════════════════════════════════════════ */
  function obj(name, variant, opt) {
    opt = opt || {};
    return cached("o" + name + variant + (opt.c || "") + (opt.lvl || ""), 32, 48, (x) => {
      const r = EH.RNG(variant * 131 + name.length * 17);
      const cx = 16;
      if (name === "tree") {
        const trunk = "#6a4a28";
        for (let i = 0; i < 12; i++) px(x, cx - 1 + (i > 6 ? 0 : 0), 30 + i, 3, 1, i % 3 ? trunk : "#5a3d20");
        const g = opt.season === 3 ? ["#c8a04a", "#a8742f", "#8a5f28"] : opt.season === 2 ? ["#c8703a", "#a85a2a", "#7a4020"] : ["#4a8c34", "#3d7529", "#5ca844"];
        const blobs = [[0, 16, 9], [-6, 20, 7], [6, 20, 7], [-3, 12, 6], [4, 12, 6], [0, 24, 10]];
        for (const b of blobs) {
          x.fillStyle = g[1]; x.beginPath(); x.ellipse(cx + b[0], b[1], b[2], b[2] * 0.78, 0, 0, EH.TAU); x.fill();
        }
        for (const b of blobs) {
          x.fillStyle = g[0]; x.beginPath(); x.ellipse(cx + b[0] - 1, b[1] - 2, b[2] * 0.62, b[2] * 0.5, 0, 0, EH.TAU); x.fill();
        }
        for (let i = 0; i < 26; i++) px(x, cx - 11 + Math.floor(r() * 22), 6 + Math.floor(r() * 22), 1, 1, g[2]);
      }
      else if (name === "pine") {
        for (let i = 0; i < 10; i++) px(x, cx - 1, 32 + i, 3, 1, "#5a3d20");
        const g = ["#2f5c34", "#26492a", "#3a7040"];
        for (let k = 0; k < 4; k++) {
          const y = 8 + k * 8, w = 5 + k * 4;
          x.fillStyle = g[k % 2]; x.beginPath();
          x.moveTo(cx, y - 5); x.lineTo(cx + w, y + 4); x.lineTo(cx - w, y + 4); x.closePath(); x.fill();
          x.fillStyle = g[2]; x.beginPath();
          x.moveTo(cx, y - 5); x.lineTo(cx + w * 0.45, y + 1); x.lineTo(cx - w * 0.45, y + 1); x.closePath(); x.fill();
        }
      }
      else if (name === "rock") {
        const c = opt.c || EH.PAL.stone;
        x.fillStyle = c[1]; x.beginPath();
        x.moveTo(cx - 8, 40); x.lineTo(cx - 6, 32); x.lineTo(cx - 1, 28); x.lineTo(cx + 5, 30);
        x.lineTo(cx + 8, 36); x.lineTo(cx + 6, 41); x.closePath(); x.fill();
        x.fillStyle = c[2]; x.beginPath();
        x.moveTo(cx - 6, 32); x.lineTo(cx - 1, 28); x.lineTo(cx + 2, 33); x.lineTo(cx - 3, 37); x.closePath(); x.fill();
        x.fillStyle = c[3] || shade(c[0], -0.4); x.fillRect(cx - 8, 39, 15, 2);
      }
      else if (name === "bush") {
        const g = ["#3d7529", "#4a8c34", "#5ca844"];
        for (const b of [[-4, 38, 5], [4, 38, 5], [0, 35, 6]]) {
          x.fillStyle = g[0]; x.beginPath(); x.ellipse(cx + b[0], b[1], b[2], b[2] * 0.8, 0, 0, EH.TAU); x.fill();
          x.fillStyle = g[1]; x.beginPath(); x.ellipse(cx + b[0] - 1, b[1] - 1, b[2] * 0.6, b[2] * 0.5, 0, 0, EH.TAU); x.fill();
        }
        for (let i = 0; i < 4; i++) px(x, cx - 5 + Math.floor(r() * 10), 32 + Math.floor(r() * 8), 1, 1, "#d8452f");
      }
      else if (name === "chest") {
        const opened = opt.opened;
        x.fillStyle = "#6a4a28"; x.fillRect(cx - 7, 34, 14, 9);
        x.fillStyle = "#8a5f35"; x.fillRect(cx - 7, opened ? 27 : 30, 14, opened ? 4 : 5);
        x.fillStyle = "#4a3220"; x.fillRect(cx - 7, 38, 14, 2);
        x.fillStyle = EH.PAL.gold[0]; x.fillRect(cx - 1, 34, 2, 5); x.fillRect(cx - 7, 36, 14, 1);
        if (opened) { x.fillStyle = "#2a1a10"; x.fillRect(cx - 6, 31, 12, 3); }
        else { x.fillStyle = shade(EH.PAL.gold[0], 0.3); x.fillRect(cx - 5, 31, 3, 2); }
      }
      else if (name === "stairs") {
        for (let i = 0; i < 5; i++) {
          const w = 20 - i * 3;
          x.fillStyle = i % 2 ? "#3a3431" : "#4a433f";
          x.fillRect(cx - w / 2, 30 + i * 3, w, 3);
          x.fillStyle = "#241f1d"; x.fillRect(cx - w / 2, 32 + i * 3, w, 1);
        }
        x.fillStyle = "#0b0908"; x.fillRect(cx - 6, 26, 12, 5);
      }
      else if (name === "portal") {
        const t = (opt.t || 0);
        for (let i = 0; i < 6; i++) {
          const rr = 9 - i, a = 0.15 + i * 0.12;
          x.fillStyle = `rgba(140,90,220,${a})`;
          x.beginPath(); x.ellipse(cx, 34 + Math.sin(t + i) * 0.6, rr, rr * 1.35, 0, 0, EH.TAU); x.fill();
        }
        x.fillStyle = "rgba(220,200,255,.85)"; x.beginPath(); x.ellipse(cx, 34, 3, 5, 0, 0, EH.TAU); x.fill();
      }
      else if (name === "pillar") {
        x.fillStyle = "#3a3431"; x.fillRect(cx - 4, 18, 8, 26);
        x.fillStyle = "#4a433f"; x.fillRect(cx - 4, 18, 3, 26);
        x.fillStyle = "#585449"; x.fillRect(cx - 6, 15, 12, 4); x.fillRect(cx - 6, 42, 12, 3);
        for (let i = 0; i < 5; i++) px(x, cx - 3 + Math.floor(r() * 6), 22 + Math.floor(r() * 18), 1, 1, "#2a2522");
      }
      else if (name === "torch") {
        x.fillStyle = "#5a3d20"; x.fillRect(cx - 1, 26, 2, 16);
        x.fillStyle = "#3a2814"; x.fillRect(cx - 3, 24, 6, 3);
        const t = opt.t || 0, f = Math.sin(t * 7) * 1.2;
        x.fillStyle = "#e06a20"; x.beginPath(); x.ellipse(cx + f * 0.4, 20, 3.4, 5 + f, 0, 0, EH.TAU); x.fill();
        x.fillStyle = "#f0c05a"; x.beginPath(); x.ellipse(cx, 21, 2, 3.4, 0, 0, EH.TAU); x.fill();
        x.fillStyle = "#fff0c0"; px(x, cx, 21, 1, 2, "#fff8e0");
      }
      else if (name === "sign") {
        x.fillStyle = "#5a3d20"; x.fillRect(cx - 1, 30, 2, 12);
        x.fillStyle = "#8a5f35"; x.fillRect(cx - 8, 22, 16, 9);
        x.fillStyle = "#6a4a28"; x.fillRect(cx - 8, 29, 16, 2);
        x.fillStyle = "#d8c8a0"; x.fillRect(cx - 5, 25, 10, 1); x.fillRect(cx - 5, 27, 7, 1);
      }
      else if (name === "well") {
        x.fillStyle = "#6a675f"; x.fillRect(cx - 6, 34, 12, 8);
        x.fillStyle = "#8f8c83"; x.fillRect(cx - 6, 34, 12, 2);
        x.fillStyle = "#1b2a3a"; x.fillRect(cx - 4, 36, 8, 4);
        x.fillStyle = "#5a3d20"; x.fillRect(cx - 6, 26, 2, 9); x.fillRect(cx + 4, 26, 2, 9);
        x.fillStyle = "#8a5f35"; x.fillRect(cx - 7, 24, 14, 3);
      }
      else if (name === "grave") {
        x.fillStyle = "#575449"; x.fillRect(cx - 3, 32, 6, 10);
        x.fillStyle = "#6a675f"; x.fillRect(cx - 3, 32, 6, 2);
        x.beginPath(); x.arc(cx, 32, 3, Math.PI, 0); x.fill();
        x.fillStyle = "#3a3830"; x.fillRect(cx - 1, 35, 2, 4); x.fillRect(cx - 2, 36, 4, 1);
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════
     HUMANOID CHARACTERS — layered, palette-swapped, 3 directions
     ═══════════════════════════════════════════════════════════ */
  const SKIN = ["#e8b48c", "#d49a72", "#b87a52", "#8c5a3a", "#f0c8a0", "#6a4028"];
  const HAIR = ["#3a2a1a", "#6a4a28", "#a8742f", "#d8b050", "#8a3a2a", "#2a2a34", "#c8c0b0", "#4a3a5a"];
  const CLOTH = ["#4a6a8c", "#8c4a4a", "#4a7a4a", "#7a6a3a", "#6a4a7a", "#3a6a6a", "#8c6a3a", "#5a5a6a", "#a8703a", "#3a4a6a"];
  const PANTS = ["#4a3a2a", "#3a3a44", "#5a4a3a", "#2f2f38", "#6a5a44"];

  function humanoid(o) {
    const skin = o.skin || SKIN[0], hair = o.hair || HAIR[0], cloth = o.cloth || CLOTH[0];
    const pants = o.pants || PANTS[0], boots = o.boots || "#3a2a1a";
    const W = 16, H = 24;
    const dirs = ["front", "side", "back"];
    const out = {};
    for (const d of dirs) {
      out[d] = [];
      for (let f = 0; f < 3; f++) {
        out[d].push(cached(`h_${[o.skin, o.hair, o.cloth, o.pants, o.hat, o.hatc, o.cloak, o.cloakc, o.weapon, o.beard, o.helmet, o.big].join("|")}_${d}_${f}`, W, H, (x) => {
          const walk = f > 0, step = f === 1 ? 1 : -1;
          const bob = walk ? (f === 1 ? 0 : 1) : 0;
          const cx = 8, top = 2 + bob;
          // cloak behind
          if (o.cloak) {
            const cc = o.cloakc || "#6a2c2c";
            x.fillStyle = cc;
            x.beginPath();
            x.moveTo(cx - 5, top + 7); x.lineTo(cx + 5, top + 7);
            x.lineTo(cx + 6 + step, top + 17); x.lineTo(cx - 6 + step, top + 17); x.closePath(); x.fill();
            x.fillStyle = shade(cc, -0.25); x.fillRect(cx - 6 + step, top + 15, 12, 2);
          }
          // legs
          const ly = top + 15;
          if (d === "back" || d === "front") {
            x.fillStyle = pants;
            if (walk) {
              x.fillRect(cx - 4, ly, 3, 5 + step); x.fillRect(cx + 1, ly, 3, 5 - step);
              x.fillStyle = boots; x.fillRect(cx - 4, ly + 4 + step, 3, 2); x.fillRect(cx + 1, ly + 4 - step, 3, 2);
            } else {
              x.fillRect(cx - 4, ly, 3, 5); x.fillRect(cx + 1, ly, 3, 5);
              x.fillStyle = boots; x.fillRect(cx - 4, ly + 4, 3, 2); x.fillRect(cx + 1, ly + 4, 3, 2);
            }
          } else {
            x.fillStyle = pants;
            x.fillRect(cx - 3 + (walk ? step : 0), ly, 3, 5); x.fillRect(cx - (walk ? step : 0), ly, 3, 5);
            x.fillStyle = boots;
            x.fillRect(cx - 3 + (walk ? step : 0), ly + 4, 3, 2); x.fillRect(cx - (walk ? step : 0), ly + 4, 3, 2);
          }
          // torso
          const ty = top + 8;
          x.fillStyle = cloth; x.fillRect(cx - 4, ty, 8, 8);
          x.fillStyle = shade(cloth, -0.28); x.fillRect(cx - 4, ty + 6, 8, 2);
          if (d === "front") { x.fillStyle = shade(cloth, 0.22); x.fillRect(cx - 1, ty, 2, 7); }
          // belt
          x.fillStyle = "#3a2a1a"; x.fillRect(cx - 4, ty + 6, 8, 1);
          if (o.buckle !== false) px(x, cx - 1, ty + 6, 2, 1, EH.PAL.gold[1]);
          // arms
          x.fillStyle = cloth;
          if (d === "side") {
            x.fillRect(cx - 2 + (walk ? step : 0), ty + 1, 3, 6);
            x.fillStyle = skin; x.fillRect(cx - 2 + (walk ? step : 0), ty + 6, 3, 2);
          } else {
            const sw = walk ? step : 0;
            x.fillRect(cx - 6, ty + 1 - sw * 0, 2, 6 + (walk ? -sw : 0));
            x.fillRect(cx + 4, ty + 1, 2, 6 + (walk ? sw : 0));
            x.fillStyle = skin;
            x.fillRect(cx - 6, ty + 7 + (walk ? -sw : 0), 2, 2);
            x.fillRect(cx + 4, ty + 7 + (walk ? sw : 0), 2, 2);
          }
          // head
          const hy = top + 2;
          x.fillStyle = skin; x.fillRect(cx - 3, hy, 7, 6);
          x.fillStyle = shade(skin, -0.22); x.fillRect(cx - 3, hy + 5, 7, 1);
          if (d !== "back") {
            // eyes
            x.fillStyle = "#241a14";
            if (d === "front") { px(x, cx - 2, hy + 3, 1, 1); px(x, cx + 2, hy + 3, 1, 1); }
            else { px(x, cx + 2, hy + 3, 1, 1); }
            if (o.blush) { px(x, cx - 3, hy + 4, 1, 1, "#e08a7a"); px(x, cx + 3, hy + 4, 1, 1, "#e08a7a"); }
          }
          // hair / hat / helmet
          if (o.helmet) {
            x.fillStyle = o.helmetc || "#9aa0a8"; x.fillRect(cx - 4, hy - 1, 9, 4);
            x.fillStyle = shade(o.helmetc || "#9aa0a8", -0.3); x.fillRect(cx - 4, hy + 2, 9, 1);
            if (d === "front") { x.fillStyle = shade(o.helmetc || "#9aa0a8", 0.25); x.fillRect(cx - 1, hy - 2, 3, 2); }
            if (o.plume) { x.fillStyle = o.plume; x.fillRect(cx, hy - 4, 2, 3); }
          } else if (o.hat) {
            const hc = o.hatc || "#6a4a28";
            if (o.hat === "wide") { x.fillStyle = hc; x.fillRect(cx - 6, hy + 1, 13, 2); x.fillRect(cx - 3, hy - 2, 7, 3); }
            else if (o.hat === "hood") { x.fillStyle = hc; x.fillRect(cx - 4, hy - 2, 9, 5); x.fillRect(cx - 5, hy + 2, 11, 2); if (d === "front") { x.fillStyle = shade(hc, -0.45); x.fillRect(cx - 3, hy, 7, 3); x.fillStyle = skin; x.fillRect(cx - 2, hy + 1, 5, 3); x.fillStyle = "#241a14"; px(x, cx - 1, hy + 2, 1, 1); px(x, cx + 2, hy + 2, 1, 1); } }
            else if (o.hat === "pointy") { x.fillStyle = hc; x.beginPath(); x.moveTo(cx, hy - 7); x.lineTo(cx + 5, hy + 2); x.lineTo(cx - 5, hy + 2); x.closePath(); x.fill(); x.fillStyle = shade(hc, 0.2); x.fillRect(cx - 5, hy + 1, 11, 1); }
            else if (o.hat === "cap") { x.fillStyle = hc; x.fillRect(cx - 4, hy - 1, 9, 3); if (d === "front") x.fillRect(cx - 4, hy + 1, 5, 1); }
            else if (o.hat === "crown") { x.fillStyle = EH.PAL.gold[0]; x.fillRect(cx - 4, hy - 1, 9, 2); for (let i = 0; i < 3; i++) px(x, cx - 3 + i * 3, hy - 3, 1, 2, EH.PAL.gold[2]); }
          } else {
            x.fillStyle = hair;
            x.fillRect(cx - 4, hy - 1, 9, 3);
            if (d === "back") x.fillRect(cx - 4, hy + 1, 9, 5);
            else { x.fillRect(cx - 4, hy + 1, 2, 3); x.fillRect(cx + 3, hy + 1, 2, 3); }
            if (o.long) { x.fillRect(cx - 4, hy + 2, 2, 6); x.fillRect(cx + 3, hy + 2, 2, 6); }
          }
          if (o.beard && d !== "back") { x.fillStyle = hair; x.fillRect(cx - 3, hy + 5, 7, 3); x.fillStyle = skin; x.fillRect(cx - 1, hy + 4, 3, 1); }
          // weapon in hand
          if (o.weapon && d !== "back") {
            const wx = d === "side" ? cx + 3 : cx + 5, wy = ty + 4;
            if (o.weapon === "sword") { x.fillStyle = "#c8c8d0"; x.fillRect(wx, wy - 7, 2, 8); x.fillStyle = EH.PAL.gold[1]; x.fillRect(wx - 1, wy + 1, 4, 1); x.fillStyle = "#6a4a28"; x.fillRect(wx, wy + 2, 2, 3); }
            else if (o.weapon === "axe") { x.fillStyle = "#6a4a28"; x.fillRect(wx, wy - 6, 2, 10); x.fillStyle = "#c8c8d0"; x.fillRect(wx - 3, wy - 6, 4, 5); x.fillStyle = "#9aa0a8"; x.fillRect(wx - 3, wy - 6, 4, 1); }
            else if (o.weapon === "staff") { x.fillStyle = "#8a5f35"; x.fillRect(wx, wy - 9, 2, 14); x.fillStyle = "#8ef0d8"; x.beginPath(); x.arc(wx + 1, wy - 10, 2.4, 0, EH.TAU); x.fill(); }
            else if (o.weapon === "bow") { x.strokeStyle = "#8a5f35"; x.lineWidth = 1.5; x.beginPath(); x.arc(wx + 1, wy - 2, 6, -1.1, 1.1); x.stroke(); x.strokeStyle = "#e8d9b0"; x.lineWidth = 0.7; x.beginPath(); x.moveTo(wx + 3.4, wy - 7.2); x.lineTo(wx + 3.4, wy + 3.2); x.stroke(); }
            else if (o.weapon === "dagger") { x.fillStyle = "#d8d8e0"; x.fillRect(wx, wy - 3, 2, 4); x.fillStyle = "#6a4a28"; x.fillRect(wx, wy + 1, 2, 2); }
            else if (o.weapon === "hammer") { x.fillStyle = "#6a4a28"; x.fillRect(wx, wy - 5, 2, 9); x.fillStyle = "#8f8c83"; x.fillRect(wx - 2, wy - 8, 6, 4); }
            else if (o.weapon === "book") { x.fillStyle = "#6a2c2c"; x.fillRect(wx - 1, wy + 1, 5, 4); x.fillStyle = "#e8d9b0"; x.fillRect(wx, wy + 2, 3, 2); }
            else if (o.weapon === "pick") { x.fillStyle = "#6a4a28"; x.fillRect(wx, wy - 6, 2, 10); x.fillStyle = "#9aa0a8"; x.fillRect(wx - 3, wy - 6, 8, 2); }
            else if (o.weapon === "basket") { x.fillStyle = "#a8742f"; x.fillRect(wx - 2, wy + 1, 6, 5); x.fillStyle = "#8a5f25"; x.fillRect(wx - 2, wy + 3, 6, 1); }
            else if (o.weapon === "mug") { x.fillStyle = "#c8a05a"; x.fillRect(wx, wy + 1, 4, 4); x.fillStyle = "#e8d9b0"; x.fillRect(wx, wy + 1, 4, 1); }
            else if (o.weapon === "lantern") { x.fillStyle = "#5a4a28"; x.fillRect(wx, wy, 3, 4); x.fillStyle = "#f0c05a"; x.fillRect(wx + 1, wy + 1, 1, 2); }
          }
          // outline (darken edges)
          x.globalCompositeOperation = "source-atop";
          x.globalAlpha = 1;
          x.globalCompositeOperation = "source-over";
        }));
      }
    }
    return out;
  }

  /* ═══════════════════════════════════════════════════════════
     MONSTERS
     ═══════════════════════════════════════════════════════════ */
  function monster(body, col, frame, opt) {
    opt = opt || {};
    return cached(`m_${body}_${col}_${frame}_${opt.big ? 1 : 0}`, 20, 20, (x) => {
      const c = col, dk = shade(c, -0.35), lt = shade(c, 0.3);
      const bob = frame === 1 ? 1 : 0;
      const cx = 10;
      const draw = {
        slime() {
          const h = 8 - bob;
          x.fillStyle = c; x.beginPath(); x.ellipse(cx, 17 - h / 2, 7, h / 1.4, 0, 0, EH.TAU); x.fill();
          x.fillStyle = lt; x.beginPath(); x.ellipse(cx - 2, 14 - h / 2, 3, 2, 0, 0, EH.TAU); x.fill();
          x.fillStyle = "#1a1410"; px(x, cx - 3, 15 - bob, 1, 2); px(x, cx + 2, 15 - bob, 1, 2);
          x.fillStyle = dk; x.fillRect(cx - 7, 18, 14, 1);
        },
        rat() {
          x.fillStyle = c; x.fillRect(cx - 5, 14 - bob, 9, 5);
          x.fillStyle = lt; x.fillRect(cx + 3, 13 - bob, 4, 4);
          x.fillStyle = dk; x.fillRect(cx - 5, 18, 2, 2); x.fillRect(cx + 1, 18, 2, 2);
          x.strokeStyle = dk; x.beginPath(); x.moveTo(cx - 5, 15); x.lineTo(cx - 9, 12 - bob); x.stroke();
          x.fillStyle = "#d8452f"; px(x, cx + 5, 14 - bob, 1, 1);
          x.fillStyle = "#e8d9b0"; px(x, cx + 6, 16 - bob, 1, 1);
        },
        bat() {
          const f = Math.sin(frame * 2) * 2;
          x.fillStyle = c;
          x.beginPath(); x.moveTo(cx - 2, 10); x.lineTo(cx - 9, 7 + f); x.lineTo(cx - 5, 12); x.closePath(); x.fill();
          x.beginPath(); x.moveTo(cx + 2, 10); x.lineTo(cx + 9, 7 + f); x.lineTo(cx + 5, 12); x.closePath(); x.fill();
          x.fillStyle = lt; x.beginPath(); x.ellipse(cx, 11, 3, 3.4, 0, 0, EH.TAU); x.fill();
          x.fillStyle = "#f0c05a"; px(x, cx - 2, 10, 1, 1); px(x, cx + 1, 10, 1, 1);
        },
        humanoid() {
          x.fillStyle = c; x.fillRect(cx - 4, 8 - bob, 8, 8);
          x.fillStyle = lt; x.fillRect(cx - 3, 3 - bob, 6, 5);
          x.fillStyle = dk; x.fillRect(cx - 4, 15 - bob, 3, 4); x.fillRect(cx + 1, 15 - bob, 3, 4);
          x.fillRect(cx - 6, 9 - bob, 2, 6); x.fillRect(cx + 4, 9 - bob, 2, 6);
          x.fillStyle = "#f04030"; px(x, cx - 2, 5 - bob, 1, 1); px(x, cx + 1, 5 - bob, 1, 1);
          if (opt.weapon !== false) { x.fillStyle = "#9aa0a8"; x.fillRect(cx + 6, 6 - bob, 2, 8); x.fillStyle = "#6a4a28"; x.fillRect(cx + 6, 13 - bob, 2, 3); }
        },
        fungus() {
          x.fillStyle = "#e8dcc0"; x.fillRect(cx - 3, 11 - bob, 6, 8);
          x.fillStyle = c; x.beginPath(); x.ellipse(cx, 10 - bob, 7, 5, 0, Math.PI, EH.TAU); x.fill();
          x.fillStyle = lt; for (let i = 0; i < 4; i++) px(x, cx - 5 + i * 3, 7 - bob, 2, 2, lt);
          x.fillStyle = "#241a14"; px(x, cx - 2, 13 - bob, 1, 2); px(x, cx + 1, 13 - bob, 1, 2);
        },
        beetle() {
          x.fillStyle = c; x.beginPath(); x.ellipse(cx, 13 - bob, 7, 5, 0, 0, EH.TAU); x.fill();
          x.fillStyle = lt; x.fillRect(cx - 1, 9 - bob, 2, 8);
          x.fillStyle = dk; for (let i = 0; i < 3; i++) { x.fillRect(cx - 6, 11 + i * 2 - bob, 2, 1); x.fillRect(cx + 4, 11 + i * 2 - bob, 2, 1); }
          x.fillStyle = "#f0c05a"; px(x, cx - 3, 10 - bob, 1, 1); px(x, cx + 2, 10 - bob, 1, 1);
        },
        imp() {
          x.fillStyle = c; x.fillRect(cx - 3, 9 - bob, 6, 6);
          x.fillStyle = lt; x.beginPath(); x.ellipse(cx, 6 - bob, 4, 3.6, 0, 0, EH.TAU); x.fill();
          x.fillStyle = dk; x.beginPath(); x.moveTo(cx - 3, 4 - bob); x.lineTo(cx - 5, 1 - bob); x.lineTo(cx - 1, 3 - bob); x.closePath(); x.fill();
          x.beginPath(); x.moveTo(cx + 3, 4 - bob); x.lineTo(cx + 5, 1 - bob); x.lineTo(cx + 1, 3 - bob); x.closePath(); x.fill();
          x.fillStyle = "#ffe070"; px(x, cx - 2, 6 - bob, 1, 1); px(x, cx + 1, 6 - bob, 1, 1);
          x.fillStyle = c; x.fillRect(cx - 5, 10 - bob, 2, 4); x.fillRect(cx + 3, 10 - bob, 2, 4);
          x.strokeStyle = dk; x.beginPath(); x.moveTo(cx, 15 - bob); x.lineTo(cx + 4, 17 - bob); x.stroke();
        },
        beast() {
          x.fillStyle = c; x.fillRect(cx - 6, 11 - bob, 11, 6);
          x.fillStyle = lt; x.beginPath(); x.ellipse(cx + 5, 12 - bob, 4, 3.4, 0, 0, EH.TAU); x.fill();
          x.fillStyle = dk; for (const o of [[-5, 17], [-2, 17], [2, 17], [4, 17]]) x.fillRect(cx + o[0], o[1] - bob, 2, 2);
          x.fillStyle = "#f04030"; px(x, cx + 5, 11 - bob, 1, 1); px(x, cx + 7, 11 - bob, 1, 1);
          x.fillStyle = "#e8d9b0"; px(x, cx + 6, 14 - bob, 1, 1); px(x, cx + 8, 14 - bob, 1, 1);
          x.strokeStyle = c; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - 6, 12 - bob); x.lineTo(cx - 9, 8 - bob); x.stroke();
        },
        wraith() {
          x.globalAlpha = 0.85;
          x.fillStyle = c; x.beginPath();
          x.moveTo(cx - 5, 18); x.lineTo(cx - 4, 7 - bob); x.quadraticCurveTo(cx, 1 - bob, cx + 4, 7 - bob);
          x.lineTo(cx + 5, 18); x.lineTo(cx + 2, 15); x.lineTo(cx, 18); x.lineTo(cx - 2, 15); x.closePath(); x.fill();
          x.fillStyle = "#0b0908"; x.fillRect(cx - 3, 6 - bob, 6, 4);
          x.fillStyle = "#8ef0d8"; px(x, cx - 2, 7 - bob, 1, 2); px(x, cx + 1, 7 - bob, 1, 2);
          x.globalAlpha = 1;
        },
        troll() {
          x.fillStyle = c; x.fillRect(cx - 6, 7 - bob, 12, 10);
          x.fillStyle = lt; x.beginPath(); x.ellipse(cx, 5 - bob, 5, 4.4, 0, 0, EH.TAU); x.fill();
          x.fillStyle = dk; x.fillRect(cx - 6, 16 - bob, 4, 4); x.fillRect(cx + 2, 16 - bob, 4, 4);
          x.fillRect(cx - 8, 8 - bob, 3, 8); x.fillRect(cx + 5, 8 - bob, 3, 8);
          x.fillStyle = "#f0c05a"; px(x, cx - 3, 4 - bob, 2, 1); px(x, cx + 1, 4 - bob, 2, 1);
          x.fillStyle = "#e8d9b0"; px(x, cx - 2, 7 - bob, 1, 2); px(x, cx + 1, 7 - bob, 1, 2);
        },
        boss1() {
          x.fillStyle = "#3a2a1a"; x.fillRect(cx - 6, 6 - bob, 12, 13);
          x.fillStyle = c; x.fillRect(cx - 5, 8 - bob, 10, 9);
          x.fillStyle = "#e8dcc0"; x.beginPath(); x.ellipse(cx, 4 - bob, 4.6, 4.4, 0, 0, EH.TAU); x.fill();
          x.fillStyle = EH.PAL.gold[0]; x.fillRect(cx - 5, 0 - bob, 10, 2);
          for (let i = 0; i < 4; i++) px(x, cx - 4 + i * 3, -2 - bob, 1, 2, EH.PAL.gold[2]);
          x.fillStyle = "#8a1f14"; px(x, cx - 2, 4 - bob, 2, 1); px(x, cx + 1, 4 - bob, 2, 1);
          x.fillStyle = "#9aa0a8"; x.fillRect(cx + 6, 2 - bob, 2, 14);
          x.fillStyle = dk; x.fillRect(cx - 7, 18 - bob, 4, 2); x.fillRect(cx + 3, 18 - bob, 4, 2);
        },
        boss2() {
          x.fillStyle = c; x.beginPath(); x.ellipse(cx, 12 - bob, 8, 7, 0, 0, EH.TAU); x.fill();
          x.fillStyle = lt; x.beginPath(); x.ellipse(cx, 8 - bob, 5, 4, 0, 0, EH.TAU); x.fill();
          for (let i = 0; i < 6; i++) { const a = i / 6 * EH.TAU + frame; x.strokeStyle = dk; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx + Math.cos(a) * 6, 13 + Math.sin(a) * 4); x.lineTo(cx + Math.cos(a) * 10, 16 + Math.sin(a) * 5); x.stroke(); }
          x.fillStyle = "#ffe070"; px(x, cx - 3, 7 - bob, 2, 2); px(x, cx + 1, 7 - bob, 2, 2);
        },
        boss3() {
          x.fillStyle = "#2a1a14"; x.fillRect(cx - 7, 4 - bob, 14, 15);
          x.fillStyle = c; x.beginPath(); x.ellipse(cx, 4 - bob, 6, 5, 0, 0, EH.TAU); x.fill();
          x.fillStyle = "#ffe070"; px(x, cx - 3, 3 - bob, 2, 2); px(x, cx + 1, 3 - bob, 2, 2);
          x.strokeStyle = "#e06a20"; x.lineWidth = 1.4;
          for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(cx - 7 + i * 5, 6 - bob); x.lineTo(cx - 5 + i * 5, 18 - bob); x.stroke(); }
          x.fillStyle = "#8a5f35"; x.fillRect(cx + 7, 0 - bob, 2, 18);
        },
        boss4() {
          const t = frame * 0.6;
          x.fillStyle = "#120c1a"; x.beginPath(); x.ellipse(cx, 11, 9, 9, 0, 0, EH.TAU); x.fill();
          for (let i = 0; i < 8; i++) { const a = t + i / 8 * EH.TAU; x.fillStyle = c; x.beginPath(); x.ellipse(cx + Math.cos(a) * 6, 11 + Math.sin(a) * 6, 2.6, 2.6, 0, 0, EH.TAU); x.fill(); }
          x.fillStyle = "#f04030"; x.beginPath(); x.ellipse(cx, 11, 4, 5.4, 0, 0, EH.TAU); x.fill();
          x.fillStyle = "#0b0908"; x.beginPath(); x.ellipse(cx, 11, 1.6, 4, 0, 0, EH.TAU); x.fill();
        },
      };
      (draw[body] || draw.humanoid)();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     PETS
     ═══════════════════════════════════════════════════════════ */
  function pet(body, col, frame, fly) {
    return cached(`p_${body}_${col}_${frame}_${fly ? 1 : 0}`, 14, 12, (x) => {
      const c = col, dk = shade(c, -0.35), lt = shade(c, 0.32);
      const bob = frame === 1 ? 1 : 0, y0 = fly ? -2 : 0;
      const cx = 7;
      const D = {
        dog() { x.fillStyle = c; x.fillRect(cx - 4, 6 - bob + y0, 8, 4); x.fillStyle = lt; x.fillRect(cx + 3, 4 - bob + y0, 4, 4); x.fillStyle = dk; x.fillRect(cx + 3, 3 - bob + y0, 2, 2); x.fillRect(cx + 5, 3 - bob + y0, 2, 2); for (const o of [[-4, 10], [-1, 10], [2, 10]]) x.fillRect(cx + o[0], o[1] - bob + y0, 2, 2); x.strokeStyle = c; x.beginPath(); x.moveTo(cx - 4, 6 - bob + y0); x.lineTo(cx - 6, 3 - bob + y0); x.stroke(); x.fillStyle = "#1a1410"; px(x, cx + 5, 5 - bob + y0, 1, 1); },
        cat() { x.fillStyle = c; x.fillRect(cx - 4, 7 - bob + y0, 8, 3); x.fillStyle = lt; x.fillRect(cx + 3, 5 - bob + y0, 4, 4); x.fillStyle = c; x.beginPath(); x.moveTo(cx + 3, 5 - bob + y0); x.lineTo(cx + 4, 2 - bob + y0); x.lineTo(cx + 5, 5 - bob + y0); x.fill(); x.beginPath(); x.moveTo(cx + 5, 5 - bob + y0); x.lineTo(cx + 6, 2 - bob + y0); x.lineTo(cx + 7, 5 - bob + y0); x.fill(); x.fillStyle = "#f0c05a"; px(x, cx + 4, 6 - bob + y0, 1, 1); px(x, cx + 6, 6 - bob + y0, 1, 1); x.strokeStyle = c; x.lineWidth = 1.4; x.beginPath(); x.moveTo(cx - 4, 8 - bob + y0); x.quadraticCurveTo(cx - 7, 6 - bob + y0, cx - 6, 2 - bob + y0); x.stroke(); },
        fox() { x.fillStyle = c; x.fillRect(cx - 4, 6 - bob + y0, 8, 4); x.fillStyle = "#e8dcc0"; x.fillRect(cx - 4, 9 - bob + y0, 8, 1); x.fillStyle = lt; x.beginPath(); x.moveTo(cx + 3, 8 - bob + y0); x.lineTo(cx + 8, 5 - bob + y0); x.lineTo(cx + 6, 9 - bob + y0); x.closePath(); x.fill(); x.fillStyle = "#1a1410"; px(x, cx + 7, 6 - bob + y0, 1, 1); x.fillStyle = c; x.beginPath(); x.moveTo(cx + 4, 4 - bob + y0); x.lineTo(cx + 5, 1 - bob + y0); x.lineTo(cx + 6, 4 - bob + y0); x.fill(); x.strokeStyle = "#e8dcc0"; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 4, 7 - bob + y0); x.lineTo(cx - 7, 4 - bob + y0); x.stroke(); },
        boar() { x.fillStyle = c; x.fillRect(cx - 5, 6 - bob + y0, 10, 5); x.fillStyle = lt; x.fillRect(cx + 4, 6 - bob + y0, 4, 4); x.fillStyle = "#e8dcc0"; px(x, cx + 6, 9 - bob + y0, 1, 2); px(x, cx + 8, 9 - bob + y0, 1, 2); x.fillStyle = dk; for (const o of [[-5, 11], [-2, 11], [1, 11], [4, 11]]) x.fillRect(cx + o[0], o[1] - bob + y0, 2, 1); x.fillStyle = "#f04030"; px(x, cx + 5, 7 - bob + y0, 1, 1); },
        wolf() { x.fillStyle = c; x.fillRect(cx - 5, 5 - bob + y0, 10, 5); x.fillStyle = lt; x.fillRect(cx + 4, 3 - bob + y0, 4, 4); x.fillStyle = c; x.beginPath(); x.moveTo(cx + 4, 3 - bob + y0); x.lineTo(cx + 5, 0 - bob + y0); x.lineTo(cx + 6, 3 - bob + y0); x.fill(); x.fillStyle = "#f0c05a"; px(x, cx + 5, 4 - bob + y0, 1, 1); px(x, cx + 7, 4 - bob + y0, 1, 1); x.fillStyle = dk; for (const o of [[-5, 10], [-2, 10], [2, 10], [4, 10]]) x.fillRect(cx + o[0], o[1] - bob + y0, 2, 2); },
        raven() { x.fillStyle = c; x.beginPath(); x.ellipse(cx, 6 - bob + y0, 4, 3.4, 0, 0, EH.TAU); x.fill(); x.fillStyle = lt; x.beginPath(); x.ellipse(cx + 3, 5 - bob + y0, 2.4, 2.2, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#f0c05a"; px(x, cx + 5, 5 - bob + y0, 2, 1); const f = frame ? -3 : 1; x.fillStyle = dk; x.beginPath(); x.moveTo(cx - 1, 5 - bob + y0); x.lineTo(cx - 6, 3 + f - bob + y0); x.lineTo(cx - 1, 8 - bob + y0); x.closePath(); x.fill(); },
        slime() { x.fillStyle = c; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(cx, 8 - bob / 2 + y0, 5, 4 - bob * 0.4, 0, 0, EH.TAU); x.fill(); x.globalAlpha = 1; x.fillStyle = lt; x.beginPath(); x.ellipse(cx - 1, 6 - bob + y0, 2, 1.4, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#1a1410"; px(x, cx - 2, 8 - bob + y0, 1, 1); px(x, cx + 1, 8 - bob + y0, 1, 1); },
        sprite() { const f = frame ? 2 : -1; x.fillStyle = "rgba(142,240,216,.4)"; x.beginPath(); x.ellipse(cx - 3, 5 + y0, 3, 4 + f, -0.4, 0, EH.TAU); x.fill(); x.beginPath(); x.ellipse(cx + 3, 5 + y0, 3, 4 + f, 0.4, 0, EH.TAU); x.fill(); x.fillStyle = c; x.beginPath(); x.ellipse(cx, 6 - bob + y0, 2.6, 3.4, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#fff"; px(x, cx - 1, 5 - bob + y0, 1, 1); px(x, cx + 1, 5 - bob + y0, 1, 1); },
        drake() { x.fillStyle = c; x.fillRect(cx - 5, 5 - bob + y0, 10, 5); x.fillStyle = lt; x.beginPath(); x.ellipse(cx + 5, 4 - bob + y0, 3.4, 3, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#ffe070"; px(x, cx + 5, 3 - bob + y0, 1, 1); px(x, cx + 7, 3 - bob + y0, 1, 1); const f = frame ? -4 : 0; x.fillStyle = dk; x.beginPath(); x.moveTo(cx - 2, 5 - bob + y0); x.lineTo(cx - 6, 1 + f + y0); x.lineTo(cx + 2, 4 - bob + y0); x.closePath(); x.fill(); x.beginPath(); x.moveTo(cx + 1, 5 - bob + y0); x.lineTo(cx + 4, 1 + f + y0); x.lineTo(cx + 5, 5 - bob + y0); x.closePath(); x.fill(); x.fillStyle = "#e06a20"; px(x, cx + 8, 5 - bob + y0, 1, 1); },
        golem() { x.fillStyle = c; x.fillRect(cx - 5, 3 - bob + y0, 10, 9); x.fillStyle = lt; x.fillRect(cx - 5, 3 - bob + y0, 10, 2); x.fillStyle = dk; x.fillRect(cx - 6, 5 - bob + y0, 2, 6); x.fillRect(cx + 4, 5 - bob + y0, 2, 6); x.fillRect(cx - 4, 12 - bob + y0, 3, 2); x.fillRect(cx + 1, 12 - bob + y0, 3, 2); x.fillStyle = "#8ef0d8"; px(x, cx - 3, 6 - bob + y0, 2, 2); px(x, cx + 1, 6 - bob + y0, 2, 2); },
      };
      (D[body] || D.dog)();
    });
  }

  /* ═══════════════════════════════════════════════════════════
     BUILDINGS (isometric boxes with roofs) — 64×64 canvas
     ═══════════════════════════════════════════════════════════ */
  function building(shape, roofc, wallc, lvl, opt) {
    opt = opt || {};
    return cached(`b_${shape}_${roofc[0]}_${wallc[0]}_${lvl}_${opt.done === false ? 0 : 1}_${opt.night ? 1 : 0}`, 64, 72, (x) => {
      const W = 64, cx = 32;
      const base = 52;                       // y of tile centre bottom
      const h = 20 + lvl * 3;                // wall height
      const wall = wallc[0], wallD = shade(wall, -0.3), wallL = shade(wall, 0.16);
      const roof = roofc[0], roofD = shade(roof, -0.26), roofL = shade(roof, 0.2);
      const w2 = 26 + (shape === "farm" ? 4 : 0), d2 = 13;   // half-widths of the iso footprint

      function isoBox(cx, cy, hw, hd, hh, top, left, right) {
        // left wall
        x.fillStyle = left; x.beginPath();
        x.moveTo(cx - hw, cy); x.lineTo(cx, cy + hd); x.lineTo(cx, cy + hd + hh); x.lineTo(cx - hw, cy + hh); x.closePath(); x.fill();
        // right wall
        x.fillStyle = right; x.beginPath();
        x.moveTo(cx + hw, cy); x.lineTo(cx, cy + hd); x.lineTo(cx, cy + hd + hh); x.lineTo(cx + hw, cy + hh); x.closePath(); x.fill();
        // top diamond
        x.fillStyle = top; x.beginPath();
        x.moveTo(cx, cy - hd); x.lineTo(cx + hw, cy); x.lineTo(cx, cy + hd); x.lineTo(cx - hw, cy); x.closePath(); x.fill();
      }
      function gabledRoof(cx, cy, hw, hd, hh, rc, rl, rd) {
        // two sloped quads meeting at a ridge
        x.fillStyle = rl; x.beginPath();
        x.moveTo(cx - hw, cy); x.lineTo(cx, cy - hd); x.lineTo(cx, cy - hd - hh); x.lineTo(cx - hw + 2, cy - hh + 2); x.closePath(); x.fill();
        x.fillStyle = rd; x.beginPath();
        x.moveTo(cx + hw, cy); x.lineTo(cx, cy - hd); x.lineTo(cx, cy - hd - hh); x.lineTo(cx + hw - 2, cy - hh + 2); x.closePath(); x.fill();
        // gable ends
        x.fillStyle = rc; x.beginPath();
        x.moveTo(cx, cy + hd); x.lineTo(cx - hw, cy); x.lineTo(cx, cy - hh); x.lineTo(cx + hw, cy); x.closePath(); x.fill();
        // ridge highlight
        x.strokeStyle = shade(rc, 0.35); x.lineWidth = 1;
        x.beginPath(); x.moveTo(cx, cy - hd - hh); x.lineTo(cx, cy - hh); x.stroke();
      }

      if (opt.done === false) {
        // construction: scaffolding + partial walls
        x.fillStyle = "#3a2a1a"; x.fillRect(cx - 20, base - 16, 40, 3);
        x.strokeStyle = "#8a5f35"; x.lineWidth = 2;
        for (const o of [[-20, 0], [16, 0], [-6, -6]]) { x.beginPath(); x.moveTo(cx + o[0], base + 8); x.lineTo(cx + o[0], base - 24 + o[1]); x.stroke(); }
        x.fillStyle = wallD; x.fillRect(cx - 16, base - 8, 32, 12);
        x.fillStyle = "#c8a05a"; for (let i = 0; i < 4; i++) x.fillRect(cx - 14 + i * 8, base - 6, 5, 2);
        return;
      }

      if (shape === "farm") {
        // field plots + small barn
        for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) {
          const sx = cx + (q - r) * 12 - 6, sy = base - 4 + (q + r) * 6 - 18;
          x.fillStyle = (q + r) % 2 ? "#7a5c3a" : "#8a6b45";
          x.beginPath(); x.moveTo(sx, sy - 5); x.lineTo(sx + 11, sy); x.lineTo(sx, sy + 5); x.lineTo(sx - 11, sy); x.closePath(); x.fill();
          x.fillStyle = lvl >= 3 ? "#d8c05a" : "#7ec850";
          for (let i = 0; i < 3; i++) { x.fillRect(sx - 5 + i * 5, sy - 3 - (lvl >= 2 ? 2 : 0), 1, 3); x.fillRect(sx - 4 + i * 5, sy - 4 - (lvl >= 2 ? 2 : 0), 1, 1); }
        }
        isoBox(cx + 14, base - 26, 11, 6, 12, wallL, wall, wallD);
        gabledRoof(cx + 14, base - 32, 12, 6, 9, roof, roofL, roofD);
        x.fillStyle = "#3a2a1a"; x.fillRect(cx + 11, base - 24, 6, 8);
        return;
      }
      if (shape === "quarry") {
        x.fillStyle = "#575449"; x.beginPath();
        x.moveTo(cx - 22, base + 4); x.lineTo(cx - 14, base - 18); x.lineTo(cx - 2, base - 26); x.lineTo(cx + 12, base - 16); x.lineTo(cx + 22, base + 4); x.closePath(); x.fill();
        x.fillStyle = "#6a675f"; x.beginPath();
        x.moveTo(cx - 14, base - 18); x.lineTo(cx - 2, base - 26); x.lineTo(cx + 2, base - 14); x.lineTo(cx - 8, base - 8); x.closePath(); x.fill();
        for (let i = 0; i < 10; i++) px(x, cx - 18 + Math.floor(R() * 36), base - 22 + Math.floor(R() * 24), 2, 2, "#8f8c83");
        x.fillStyle = "#8a5f35"; x.fillRect(cx + 8, base - 22, 2, 18); x.fillRect(cx + 14, base - 22, 2, 18);
        x.fillStyle = "#6a4a28"; x.fillRect(cx + 6, base - 24, 12, 3);
        return;
      }
      if (shape === "mine") {
        x.fillStyle = "#575449"; x.beginPath();
        x.moveTo(cx - 24, base + 6); x.lineTo(cx - 16, base - 22); x.lineTo(cx + 16, base - 22); x.lineTo(cx + 24, base + 6); x.closePath(); x.fill();
        x.fillStyle = "#6a675f"; x.fillRect(cx - 18, base - 24, 36, 4);
        x.fillStyle = "#0b0908"; x.beginPath();
        x.moveTo(cx - 9, base + 4); x.lineTo(cx - 9, base - 12); x.quadraticCurveTo(cx, base - 20, cx + 9, base - 12); x.lineTo(cx + 9, base + 4); x.closePath(); x.fill();
        x.fillStyle = "#8a5f35"; x.fillRect(cx - 12, base - 14, 3, 18); x.fillRect(cx + 9, base - 14, 3, 18); x.fillRect(cx - 12, base - 16, 24, 3);
        x.fillStyle = "#f0c05a"; x.fillRect(cx - 4, base - 8, 3, 3);
        return;
      }
      if (shape === "stall") {
        x.fillStyle = "#8a5f35"; x.fillRect(cx - 14, base - 20, 2, 22); x.fillRect(cx + 12, base - 20, 2, 22);
        x.fillStyle = "#6a4a28"; x.fillRect(cx - 16, base - 4, 32, 6);
        x.fillStyle = "#a8742f"; x.fillRect(cx - 16, base - 6, 32, 3);
        // striped awning
        for (let i = 0; i < 8; i++) {
          x.fillStyle = i % 2 ? "#c8402f" : "#e8dcc0";
          x.beginPath(); x.moveTo(cx - 18 + i * 4.6, base - 22); x.lineTo(cx - 13.4 + i * 4.6, base - 22);
          x.lineTo(cx - 11 + i * 4.6, base - 15); x.lineTo(cx - 15.6 + i * 4.6, base - 15); x.closePath(); x.fill();
        }
        // goods on the counter
        const goods = ["#d8452f", "#7ec850", "#f0c05a", "#a8742f", "#8ef0d8"];
        for (let i = 0; i < 4 + lvl; i++) { x.fillStyle = goods[i % goods.length]; x.fillRect(cx - 12 + i * 6, base - 9, 4, 4); }
        return;
      }
      if (shape === "well") {
        x.fillStyle = "#6a675f"; x.beginPath(); x.ellipse(cx, base - 6, 12, 7, 0, 0, EH.TAU); x.fill();
        x.fillStyle = "#8f8c83"; x.beginPath(); x.ellipse(cx, base - 8, 12, 7, 0, 0, EH.TAU); x.fill();
        x.fillStyle = "#1b2a3a"; x.beginPath(); x.ellipse(cx, base - 8, 8, 4.6, 0, 0, EH.TAU); x.fill();
        x.fillStyle = "#5a3d20"; x.fillRect(cx - 11, base - 26, 2, 18); x.fillRect(cx + 9, base - 26, 2, 18);
        gabledRoof(cx, base - 24, 13, 5, 8, roof, roofL, roofD);
        return;
      }
      if (shape === "torch") {
        x.fillStyle = "#5a3d20"; x.fillRect(cx - 1, base - 26, 3, 28);
        x.fillStyle = "#3a2814"; x.fillRect(cx - 4, base - 30, 9, 5);
        x.fillStyle = "#e06a20"; x.beginPath(); x.ellipse(cx, base - 34, 4, 6, 0, 0, EH.TAU); x.fill();
        x.fillStyle = "#f0c05a"; x.beginPath(); x.ellipse(cx, base - 33, 2.4, 4, 0, 0, EH.TAU); x.fill();
        return;
      }
      if (shape === "wallseg") {
        x.fillStyle = "#6a4a28"; x.fillRect(cx - 14, base - 18, 28, 20);
        x.fillStyle = "#8a5f35"; x.fillRect(cx - 14, base - 20, 28, 4);
        for (let i = 0; i < 4; i++) { x.fillStyle = "#5a3d20"; x.fillRect(cx - 13 + i * 7, base - 16, 1, 16); }
        x.fillStyle = "#4a3220"; x.fillRect(cx - 14, base - 2, 28, 3);
        return;
      }
      if (shape === "monument") {
        x.fillStyle = "#575449"; x.beginPath(); x.ellipse(cx, base + 2, 24, 12, 0, 0, EH.TAU); x.fill();
        x.fillStyle = "#6a675f"; x.fillRect(cx - 16, base - 8, 32, 10);
        x.fillStyle = "#8f8c83"; x.fillRect(cx - 12, base - 14, 24, 7);
        x.fillStyle = "#3a3830"; x.beginPath(); x.moveTo(cx, base - 52); x.lineTo(cx + 8, base - 14); x.lineTo(cx - 8, base - 14); x.closePath(); x.fill();
        x.fillStyle = "#575449"; x.beginPath(); x.moveTo(cx, base - 52); x.lineTo(cx + 8, base - 14); x.lineTo(cx + 2, base - 14); x.closePath(); x.fill();
        x.fillStyle = "#e06a20"; x.beginPath(); x.arc(cx, base - 34, 4, 0, EH.TAU); x.fill();
        x.fillStyle = "#f0c05a"; x.beginPath(); x.arc(cx, base - 34, 2, 0, EH.TAU); x.fill();
        return;
      }

      /* generic building body */
      const hw = shape === "tavern" || shape === "barracks" ? 24 : 18;
      const hd = hw * 0.5;
      isoBox(cx, base - hd, hw, hd, h, wallL, wall, wallD);
      // stone foundation
      x.fillStyle = shade(wall, -0.45); x.beginPath();
      x.moveTo(cx - hw, base); x.lineTo(cx, base + hd); x.lineTo(cx + hw, base); x.lineTo(cx + hw, base + 3);
      x.lineTo(cx, base + hd + 3); x.lineTo(cx - hw, base + 3); x.closePath(); x.fill();
      // timber framing
      x.strokeStyle = shade(wall, -0.42); x.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        x.beginPath(); x.moveTo(cx - hw + i * (hw / 3), base - hd + i * (hd / 3)); x.lineTo(cx - hw + i * (hw / 3), base - hd + i * (hd / 3) - h); x.stroke();
      }
      // door (on the left-facing wall)
      x.fillStyle = "#4a3220";
      x.beginPath();
      const dx = cx - hw * 0.5, dy = base - hd * 0.5;
      x.moveTo(dx - 4, dy + 2); x.lineTo(dx + 4, dy + 6); x.lineTo(dx + 4, dy - 8); x.lineTo(dx - 4, dy - 12); x.closePath(); x.fill();
      x.fillStyle = EH.PAL.gold[1]; px(x, dx + 1, dy - 2, 1, 1);
      // windows (glow at night via opt.night)
      const winC = opt.night ? "#f0c05a" : "#2f4a5a";
      for (const wpos of [[0.35, 0.55], [0.7, 0.75]]) {
        const wx = cx + hw * wpos[0] - 3, wy = base - hd + hd * wpos[0] - h * wpos[1];
        x.fillStyle = shade(wall, -0.5); x.fillRect(wx - 1, wy - 1, 6, 6);
        x.fillStyle = winC; x.fillRect(wx, wy, 4, 4);
        x.fillStyle = shade(wall, -0.5); x.fillRect(wx + 2, wy - 1, 1, 6);
      }
      // roof
      if (shape === "chapel") {
        x.fillStyle = roof; x.beginPath();
        x.moveTo(cx, base - hd - h - 26); x.lineTo(cx + hw + 2, base - h); x.lineTo(cx, base - h + hd); x.lineTo(cx - hw - 2, base - h); x.closePath(); x.fill();
        x.fillStyle = roofD; x.beginPath();
        x.moveTo(cx, base - hd - h - 26); x.lineTo(cx + hw + 2, base - h); x.lineTo(cx, base - h + hd); x.closePath(); x.fill();
        x.fillStyle = EH.PAL.gold[0]; x.fillRect(cx - 1, base - hd - h - 34, 2, 9); x.fillRect(cx - 4, base - hd - h - 31, 8, 2);
      } else if (shape === "library" || shape === "barracks") {
        x.fillStyle = roof; x.beginPath();
        x.moveTo(cx - hw - 3, base - h); x.lineTo(cx, base - hd - h - 14); x.lineTo(cx + hw + 3, base - h); x.lineTo(cx, base + hd - h + 4); x.closePath(); x.fill();
        x.fillStyle = roofD; x.beginPath();
        x.moveTo(cx + hw + 3, base - h); x.lineTo(cx, base - hd - h - 14); x.lineTo(cx, base + hd - h + 4); x.closePath(); x.fill();
        x.fillStyle = roofL; x.fillRect(cx - 2, base - hd - h - 18, 4, 5);
      } else {
        gabledRoof(cx, base - hd - h + hd, hw + 3, hd + 2, 15 + lvl, roof, roofL, roofD);
      }
      // chimney + smoke
      if (shape === "forge" || shape === "tavern" || shape === "house") {
        x.fillStyle = shade(wall, -0.2); x.fillRect(cx + hw * 0.35, base - hd - h - 20, 5, 12);
        x.fillStyle = shade(wall, -0.4); x.fillRect(cx + hw * 0.35 - 1, base - hd - h - 21, 7, 2);
        if (shape === "forge") {
          x.fillStyle = "rgba(200,190,180,.35)";
          for (let i = 0; i < 3; i++) x.beginPath(), x.arc(cx + hw * 0.35 + 2 + Math.sin(i * 2 + lvl) * 3, base - hd - h - 26 - i * 6, 3 + i * 1.6, 0, EH.TAU), x.fill();
          // forge glow
          x.fillStyle = "#e06a20"; x.fillRect(dx - 3, dy - 6, 4, 4);
        }
      }
      // signage per type
      if (shape === "tavern") { x.fillStyle = "#6a4a28"; x.fillRect(cx + hw - 2, base - h - 6, 2, 8); x.fillStyle = "#c8a05a"; x.fillRect(cx + hw, base - h - 4, 8, 6); x.fillStyle = "#8a5f25"; px(x, cx + hw + 3, base - h - 2, 2, 3); }
      if (shape === "forge") { x.fillStyle = "#3a3431"; x.fillRect(cx - hw - 8, base - 8, 10, 4); x.fillStyle = "#9aa0a8"; x.fillRect(cx - hw - 6, base - 12, 6, 4); }
      if (shape === "chapel") { x.fillStyle = "#d8d2c0"; x.fillRect(cx - hw - 4, base - 10, 8, 4); }
      if (shape === "kennel") { for (let i = 0; i < 3; i++) { x.fillStyle = "#8a5f35"; x.fillRect(cx - hw + 4 + i * 8, base - 8, 6, 6); x.fillStyle = "#3a2a1a"; x.fillRect(cx - hw + 5 + i * 8, base - 7, 4, 5); } }
      if (shape === "warehouse") { x.fillStyle = "#8a5f35"; for (let i = 0; i < 3; i++) x.fillRect(cx + hw * 0.2 + i * 4, base - h + 8 + i * 2, 4, 8); }
      if (shape === "library") { x.fillStyle = "#c8a05a"; for (let i = 0; i < 4; i++) x.fillRect(cx - hw * 0.5 + i * 3, base - h + 4, 2, 6); }
      // level pips
      if (lvl > 1) { x.fillStyle = EH.PAL.gold[0]; for (let i = 0; i < lvl - 1; i++) x.fillRect(cx - (lvl - 2) * 2 + i * 4, base + hd + 4, 2, 2); }
    });
  }

  /* ═══════════════════════════════════════════════════════════
     ITEM ICONS  (16×16)
     ═══════════════════════════════════════════════════════════ */
  function icon(name, c, opt) {
    opt = opt || {};
    return cached(`i_${name}_${c}_${opt.tier || 0}_${opt.up || 0}`, 16, 16, (x) => {
      const m = "#8a5f35", st = c || "#c8c8d0", dk = shade(st, -0.35), lt = shade(st, 0.35);
      const D = {
        sword() { x.fillStyle = dk; for (let i = 0; i < 9; i++) px(x, 11 - i, 2 + i, 2, 2, i < 2 ? lt : st); x.fillStyle = m; x.fillRect(3, 11, 4, 2); x.fillStyle = "#c8a05a"; x.fillRect(2, 9, 6, 2); x.fillStyle = dk; px(x, 12, 2, 2, 2); },
        axe() { x.fillStyle = m; x.fillRect(4, 3, 2, 11); x.fillStyle = st; x.beginPath(); x.moveTo(6, 3); x.lineTo(12, 5); x.lineTo(12, 9); x.lineTo(6, 8); x.closePath(); x.fill(); x.fillStyle = lt; x.fillRect(10, 5, 2, 4); },
        dagger() { x.fillStyle = st; x.fillRect(9, 3, 2, 7); x.fillStyle = lt; px(x, 10, 3, 1, 6); x.fillStyle = "#c8a05a"; x.fillRect(7, 9, 6, 2); x.fillStyle = m; x.fillRect(9, 11, 2, 3); },
        mace() { x.fillStyle = m; x.fillRect(5, 7, 2, 8); x.fillStyle = st; x.fillRect(6, 2, 6, 6); x.fillStyle = lt; x.fillRect(7, 3, 3, 3); x.fillStyle = dk; px(x, 5, 3, 1, 4); px(x, 12, 3, 1, 4); },
        bow() { x.strokeStyle = m; x.lineWidth = 1.6; x.beginPath(); x.arc(7, 8, 6, -1.2, 1.2); x.stroke(); x.strokeStyle = "#e8d9b0"; x.lineWidth = 0.8; x.beginPath(); x.moveTo(9.6, 2.6); x.lineTo(9.6, 13.4); x.stroke(); x.fillStyle = st; x.fillRect(9, 7, 5, 1); },
        staff() { x.fillStyle = m; x.fillRect(7, 5, 2, 10); x.fillStyle = "#8ef0d8"; x.beginPath(); x.arc(8, 4, 3, 0, EH.TAU); x.fill(); x.fillStyle = "#fff"; px(x, 7, 3, 1, 1); },
        wand() { x.fillStyle = m; x.fillRect(6, 6, 2, 9); x.fillStyle = "#e0933a"; x.beginPath(); x.arc(8, 4, 2.4, 0, EH.TAU); x.fill(); },
        shield() { x.fillStyle = st; x.beginPath(); x.moveTo(3, 3); x.lineTo(13, 3); x.lineTo(13, 9); x.lineTo(8, 14); x.lineTo(3, 9); x.closePath(); x.fill(); x.fillStyle = lt; x.beginPath(); x.moveTo(4, 4); x.lineTo(8, 4); x.lineTo(8, 12); x.lineTo(4, 8); x.closePath(); x.fill(); x.fillStyle = dk; x.fillRect(7, 5, 2, 6); },
        torch() { x.fillStyle = m; x.fillRect(7, 7, 2, 8); x.fillStyle = "#e06a20"; x.beginPath(); x.ellipse(8, 5, 3, 4.4, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#f0c05a"; x.beginPath(); x.ellipse(8, 6, 1.6, 2.6, 0, 0, EH.TAU); x.fill(); },
        book() { x.fillStyle = "#6a2c2c"; x.fillRect(3, 3, 10, 11); x.fillStyle = "#e8d9b0"; x.fillRect(5, 4, 7, 9); x.fillStyle = "#6a2c2c"; x.fillRect(3, 3, 2, 11); x.fillStyle = "#c8a05a"; x.fillRect(7, 7, 3, 1); },
        cap() { x.fillStyle = st; x.beginPath(); x.arc(8, 9, 5, Math.PI, 0); x.fill(); x.fillRect(3, 9, 10, 2); x.fillStyle = dk; x.fillRect(3, 10, 10, 1); },
        helm() { x.fillStyle = st; x.beginPath(); x.arc(8, 8, 5, Math.PI, 0); x.fill(); x.fillRect(3, 8, 10, 5); x.fillStyle = "#1a1410"; x.fillRect(5, 9, 6, 2); x.fillStyle = dk; x.fillRect(7, 9, 2, 5); },
        hood() { x.fillStyle = st; x.beginPath(); x.moveTo(8, 2); x.lineTo(13, 12); x.lineTo(3, 12); x.closePath(); x.fill(); x.fillStyle = "#1a1410"; x.beginPath(); x.ellipse(8, 9, 3, 3.4, 0, 0, EH.TAU); x.fill(); },
        shirt() { x.fillStyle = st; x.fillRect(4, 4, 8, 9); x.fillRect(2, 5, 2, 5); x.fillRect(12, 5, 2, 5); x.fillStyle = dk; x.fillRect(7, 4, 2, 3); },
        mail() { x.fillStyle = st; x.fillRect(3, 4, 10, 9); x.fillRect(1, 5, 2, 5); x.fillRect(13, 5, 2, 5); x.fillStyle = dk; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) px(x, 4 + i * 2 + (j % 2), 5 + j * 3, 1, 1); },
        plate() { x.fillStyle = st; x.fillRect(3, 3, 10, 11); x.fillRect(1, 4, 2, 6); x.fillRect(13, 4, 2, 6); x.fillStyle = lt; x.fillRect(4, 4, 3, 9); x.fillStyle = dk; x.fillRect(8, 4, 1, 9); },
        robe() { x.fillStyle = st; x.beginPath(); x.moveTo(8, 3); x.lineTo(13, 14); x.lineTo(3, 14); x.closePath(); x.fill(); x.fillStyle = dk; x.fillRect(7, 4, 2, 9); x.fillStyle = "#c8a05a"; x.fillRect(5, 10, 6, 1); },
        pants() { x.fillStyle = st; x.fillRect(4, 3, 8, 4); x.fillRect(4, 7, 3, 7); x.fillRect(9, 7, 3, 7); x.fillStyle = dk; x.fillRect(7, 5, 2, 9); },
        greaves() { x.fillStyle = st; x.fillRect(3, 3, 4, 11); x.fillRect(9, 3, 4, 11); x.fillStyle = lt; x.fillRect(3, 3, 2, 11); x.fillRect(9, 3, 2, 11); },
        boots() { x.fillStyle = st; x.fillRect(4, 4, 4, 7); x.fillRect(3, 11, 8, 3); x.fillRect(9, 6, 3, 5); x.fillRect(9, 11, 5, 3); x.fillStyle = dk; x.fillRect(3, 13, 8, 1); },
        sabaton() { x.fillStyle = st; x.fillRect(3, 3, 5, 8); x.fillRect(2, 11, 9, 3); x.fillRect(9, 5, 4, 6); x.fillRect(9, 11, 5, 3); x.fillStyle = lt; x.fillRect(4, 4, 2, 6); },
        ring() { x.strokeStyle = "#c8a05a"; x.lineWidth = 1.8; x.beginPath(); x.arc(8, 9, 4, 0, EH.TAU); x.stroke(); x.fillStyle = st; x.beginPath(); x.arc(8, 4, 2.4, 0, EH.TAU); x.fill(); x.fillStyle = "#fff"; px(x, 7, 3, 1, 1); },
        amulet() { x.strokeStyle = "#c8a05a"; x.lineWidth = 1.2; x.beginPath(); x.arc(8, 6, 5, Math.PI * 0.15, Math.PI * 0.85); x.stroke(); x.fillStyle = st; x.beginPath(); x.moveTo(8, 9); x.lineTo(11, 12); x.lineTo(8, 15); x.lineTo(5, 12); x.closePath(); x.fill(); },
        cloak() { x.fillStyle = st; x.beginPath(); x.moveTo(8, 2); x.lineTo(13, 8); x.lineTo(11, 14); x.lineTo(5, 14); x.lineTo(3, 8); x.closePath(); x.fill(); x.fillStyle = dk; x.fillRect(6, 3, 4, 2); x.fillStyle = "#c8a05a"; px(x, 7, 4, 2, 1); },
        potion() { x.fillStyle = "#d8d2c0"; x.fillRect(6, 2, 4, 3); x.fillStyle = "#8a5f35"; x.fillRect(6, 1, 4, 1); x.fillStyle = "rgba(216,210,192,.55)"; x.beginPath(); x.ellipse(8, 10, 5, 5, 0, 0, EH.TAU); x.fill(); x.fillStyle = st; x.beginPath(); x.ellipse(8, 11, 4, 4, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#fff"; px(x, 6, 9, 1, 2); },
        flask() { x.fillStyle = "#d8d2c0"; x.fillRect(5, 4, 6, 9); x.fillStyle = st; x.fillRect(6, 6, 4, 6); x.fillStyle = "#8a5f35"; x.fillRect(6, 2, 4, 2); x.fillStyle = "#fff"; px(x, 6, 7, 1, 3); },
        bread() { x.fillStyle = "#c89a54"; x.beginPath(); x.ellipse(8, 9, 6, 4, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#a8742f"; x.fillRect(5, 7, 2, 1); x.fillRect(9, 7, 2, 1); x.fillStyle = "#e8c07a"; x.beginPath(); x.ellipse(7, 7, 3, 1.6, 0, 0, EH.TAU); x.fill(); },
        stew() { x.fillStyle = "#8f8c83"; x.beginPath(); x.ellipse(8, 10, 6, 4, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#a86a3a"; x.beginPath(); x.ellipse(8, 9, 5, 3, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#7ec850"; px(x, 6, 8, 2, 1); x.fillStyle = "#d8452f"; px(x, 9, 9, 2, 1); },
        scroll() { x.fillStyle = st; x.fillRect(3, 4, 10, 8); x.fillStyle = dk; x.fillRect(3, 3, 10, 1); x.fillRect(3, 12, 10, 1); x.fillStyle = "#8a5f35"; x.fillRect(2, 3, 2, 10); x.fillRect(12, 3, 2, 10); x.fillStyle = "#6a5a44"; x.fillRect(5, 6, 6, 1); x.fillRect(5, 8, 4, 1); },
        meat() { x.fillStyle = "#a8553a"; x.beginPath(); x.ellipse(8, 9, 5, 4, 0.3, 0, EH.TAU); x.fill(); x.fillStyle = "#e8dcc0"; x.fillRect(2, 8, 4, 3); x.fillStyle = "#c8705a"; x.beginPath(); x.ellipse(9, 8, 2.6, 2, 0.3, 0, EH.TAU); x.fill(); },
        pelt() { x.fillStyle = st; x.beginPath(); x.moveTo(4, 3); x.lineTo(12, 3); x.lineTo(14, 8); x.lineTo(11, 14); x.lineTo(5, 14); x.lineTo(2, 8); x.closePath(); x.fill(); x.fillStyle = dk; x.fillRect(6, 6, 4, 5); },
        fang() { x.fillStyle = st; x.beginPath(); x.moveTo(6, 2); x.lineTo(10, 2); x.lineTo(8, 14); x.closePath(); x.fill(); x.fillStyle = "#fff"; px(x, 7, 3, 1, 6); },
        bone() { x.fillStyle = st; x.fillRect(4, 7, 8, 3); x.beginPath(); x.arc(4, 6, 2, 0, EH.TAU); x.fill(); x.beginPath(); x.arc(4, 11, 2, 0, EH.TAU); x.fill(); x.beginPath(); x.arc(12, 6, 2, 0, EH.TAU); x.fill(); x.beginPath(); x.arc(12, 11, 2, 0, EH.TAU); x.fill(); },
        slime() { x.fillStyle = st; x.globalAlpha = .8; x.beginPath(); x.ellipse(8, 10, 5, 4, 0, 0, EH.TAU); x.fill(); x.globalAlpha = 1; x.fillStyle = lt; x.beginPath(); x.ellipse(6, 8, 2, 1.4, 0, 0, EH.TAU); x.fill(); },
        ecto() { x.fillStyle = st; x.globalAlpha = .7; x.beginPath(); x.ellipse(8, 9, 5, 5, 0, 0, EH.TAU); x.fill(); x.globalAlpha = 1; x.fillStyle = "#fff"; px(x, 6, 6, 2, 2); },
        shard() { x.fillStyle = st; x.beginPath(); x.moveTo(8, 1); x.lineTo(13, 7); x.lineTo(8, 15); x.lineTo(3, 7); x.closePath(); x.fill(); x.fillStyle = lt; x.beginPath(); x.moveTo(8, 2); x.lineTo(11, 7); x.lineTo(8, 12); x.closePath(); x.fill(); },
        bar() { x.fillStyle = st; x.fillRect(2, 6, 12, 5); x.fillStyle = lt; x.fillRect(2, 6, 12, 2); x.fillStyle = dk; x.fillRect(2, 10, 12, 1); },
        herb() { x.fillStyle = st; x.fillRect(7, 7, 2, 7); for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(5 - i, 6 + i * 2, 3, 1.6, -0.5, 0, EH.TAU); x.fill(); x.beginPath(); x.ellipse(11 + i, 6 + i * 2, 3, 1.6, 0.5, 0, EH.TAU); x.fill(); } x.fillStyle = "#e07090"; x.beginPath(); x.arc(8, 4, 2, 0, EH.TAU); x.fill(); },
        wheat() { x.fillStyle = st; x.fillRect(7, 6, 2, 8); for (let i = 0; i < 4; i++) { x.fillRect(5, 4 + i * 2, 2, 2); x.fillRect(9, 4 + i * 2, 2, 2); } x.fillStyle = dk; x.fillRect(7, 3, 2, 2); },
        egg() { x.fillStyle = st; x.beginPath(); x.ellipse(8, 9, 4.6, 6, 0, 0, EH.TAU); x.fill(); x.fillStyle = lt; x.beginPath(); x.ellipse(6.6, 7, 1.8, 2.4, 0, 0, EH.TAU); x.fill(); x.fillStyle = dk; px(x, 9, 11, 2, 1); px(x, 7, 13, 1, 1); },
        coin() { x.fillStyle = "#c89a34"; x.beginPath(); x.arc(8, 8, 6, 0, EH.TAU); x.fill(); x.fillStyle = "#f0c05a"; x.beginPath(); x.arc(8, 7, 5, 0, EH.TAU); x.fill(); x.fillStyle = "#ffe08a"; x.beginPath(); x.arc(6.6, 5.6, 1.8, 0, EH.TAU); x.fill(); x.fillStyle = "#8a5f22"; x.fillRect(7, 5, 2, 5); },
        wood() { x.fillStyle = "#6a4a28"; x.fillRect(2, 6, 12, 5); x.fillStyle = "#8a5f35"; x.fillRect(2, 5, 12, 2); x.fillStyle = "#a3744a"; x.beginPath(); x.ellipse(13, 8, 2, 3, 0, 0, EH.TAU); x.fill(); x.fillStyle = "#6a4a28"; x.beginPath(); x.ellipse(13, 8, 1, 1.6, 0, 0, EH.TAU); x.fill(); },
        stone() { x.fillStyle = "#6a675f"; x.beginPath(); x.moveTo(3, 11); x.lineTo(5, 5); x.lineTo(11, 4); x.lineTo(13, 9); x.lineTo(10, 13); x.closePath(); x.fill(); x.fillStyle = "#8f8c83"; x.beginPath(); x.moveTo(5, 5); x.lineTo(11, 4); x.lineTo(9, 8); x.closePath(); x.fill(); },
        food() { x.fillStyle = "#d8452f"; x.beginPath(); x.arc(6, 9, 4, 0, EH.TAU); x.fill(); x.fillStyle = "#7ec850"; x.fillRect(5, 4, 2, 2); x.fillStyle = "#f07a6a"; px(x, 4, 7, 2, 2); },
        ore() { x.fillStyle = "#575449"; x.beginPath(); x.moveTo(3, 12); x.lineTo(4, 6); x.lineTo(11, 5); x.lineTo(13, 10); x.lineTo(9, 13); x.closePath(); x.fill(); x.fillStyle = "#7a9ad0"; px(x, 6, 7, 2, 2); px(x, 9, 9, 2, 2); px(x, 7, 10, 2, 1); },
        skull() { x.fillStyle = "#e8dcc0"; x.beginPath(); x.arc(8, 7, 5, 0, EH.TAU); x.fill(); x.fillRect(5, 10, 6, 4); x.fillStyle = "#1a1410"; px(x, 5, 6, 2, 3); px(x, 9, 6, 2, 3); x.fillRect(7, 10, 2, 2); },
        star() { x.fillStyle = st; x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 3 : 7; x.lineTo(8 + Math.cos(a) * rr, 8 + Math.sin(a) * rr); } x.closePath(); x.fill(); },
        key() { x.fillStyle = "#c8a05a"; x.beginPath(); x.arc(5, 5, 3, 0, EH.TAU); x.fill(); x.fillRect(6, 6, 8, 2); x.fillRect(11, 8, 2, 3); x.fillRect(13, 8, 1, 2); x.fillStyle = "#241e19"; x.beginPath(); x.arc(5, 5, 1.4, 0, EH.TAU); x.fill(); },
        hammer() { x.fillStyle = m; x.fillRect(7, 6, 2, 9); x.fillStyle = st; x.fillRect(3, 3, 10, 5); x.fillStyle = lt; x.fillRect(3, 3, 10, 2); },
        anvil() { x.fillStyle = "#3a3431"; x.fillRect(3, 5, 10, 3); x.fillRect(5, 8, 6, 3); x.fillRect(3, 11, 10, 3); x.fillStyle = "#575449"; x.fillRect(3, 5, 10, 1); x.fillRect(12, 6, 2, 2); },
        heart() { x.fillStyle = st; x.beginPath(); x.arc(5.5, 6, 3, 0, EH.TAU); x.fill(); x.beginPath(); x.arc(10.5, 6, 3, 0, EH.TAU); x.fill(); x.beginPath(); x.moveTo(3, 7); x.lineTo(8, 14); x.lineTo(13, 7); x.closePath(); x.fill(); },
        burst() { x.fillStyle = st; for (let i = 0; i < 8; i++) { const a = i / 8 * EH.TAU; x.beginPath(); x.moveTo(8, 8); x.lineTo(8 + Math.cos(a - .18) * 3, 8 + Math.sin(a - .18) * 3); x.lineTo(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7); x.lineTo(8 + Math.cos(a + .18) * 3, 8 + Math.sin(a + .18) * 3); x.closePath(); x.fill(); } },
        fire() { x.fillStyle = "#e06a20"; x.beginPath(); x.moveTo(8, 1); x.quadraticCurveTo(13, 7, 11, 12); x.quadraticCurveTo(8, 15, 5, 12); x.quadraticCurveTo(3, 7, 8, 1); x.fill(); x.fillStyle = "#f0c05a"; x.beginPath(); x.moveTo(8, 5); x.quadraticCurveTo(10.5, 9, 9, 12); x.quadraticCurveTo(8, 13, 7, 12); x.quadraticCurveTo(5.5, 9, 8, 5); x.fill(); },
        trap() { x.strokeStyle = st; x.lineWidth = 1.4; x.beginPath(); x.arc(8, 9, 5, Math.PI, 0); x.stroke(); x.fillStyle = st; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(4 + i * 3, 9); x.lineTo(5 + i * 3, 5); x.lineTo(6 + i * 3, 9); x.closePath(); x.fill(); } },
        eye() { x.fillStyle = "#e8dcc0"; x.beginPath(); x.ellipse(8, 8, 6, 4, 0, 0, EH.TAU); x.fill(); x.fillStyle = st; x.beginPath(); x.arc(8, 8, 3, 0, EH.TAU); x.fill(); x.fillStyle = "#1a1410"; x.beginPath(); x.arc(8, 8, 1.4, 0, EH.TAU); x.fill(); },
        house() { x.fillStyle = st; x.fillRect(4, 8, 8, 6); x.fillStyle = dk; x.beginPath(); x.moveTo(3, 8); x.lineTo(8, 3); x.lineTo(13, 8); x.closePath(); x.fill(); x.fillStyle = "#4a3220"; x.fillRect(7, 10, 3, 4); },
        gear() { x.fillStyle = st; x.beginPath(); x.arc(8, 8, 4.6, 0, EH.TAU); x.fill(); for (let i = 0; i < 8; i++) { const a = i / 8 * EH.TAU; x.fillRect(8 + Math.cos(a) * 5 - 1, 8 + Math.sin(a) * 5 - 1, 2, 2); } x.fillStyle = "#241e19"; x.beginPath(); x.arc(8, 8, 2, 0, EH.TAU); x.fill(); },
      };
      (D[name] || D.coin)();
      if (opt.up) { x.fillStyle = "#f0c05a"; x.font = "bold 7px monospace"; x.fillText("+" + opt.up, 8, 15); }
    });
  }

  /* ═══════════════════════════════════════════════════════════
     PORTRAIT (24×24 head shot for panels/dialogue)
     ═══════════════════════════════════════════════════════════ */
  function portrait(o) {
    const master = cached(`pf_${[o.skin, o.hair, o.cloth, o.hat, o.hatc, o.beard, o.helmet, o.helmetc, o.cls, o.sex, o.long, o.eye, o.blush].join("|")}`, 24, 24, (x) => {
      const skin = o.skin, hair = o.hair || "#3a2a1a";
      // backdrop
      x.fillStyle = o.cls ? shade(EH.CLASS[o.cls].c, -0.6) : "#2f3a2a";
      x.fillRect(0, 0, 24, 24);
      x.fillStyle = "rgba(255,255,255,.06)"; x.fillRect(0, 0, 24, 10);
      // shoulders
      x.fillStyle = o.cloth; x.fillRect(3, 19, 18, 5);
      x.fillStyle = shade(o.cloth, -0.3); x.fillRect(3, 22, 18, 2);
      // neck
      x.fillStyle = shade(skin, -0.25); x.fillRect(10, 16, 4, 4);
      // head
      x.fillStyle = skin; x.fillRect(6, 5, 12, 12);
      x.fillStyle = shade(skin, -0.2); x.fillRect(6, 15, 12, 2);
      x.fillStyle = shade(skin, 0.14); x.fillRect(7, 6, 10, 3);
      // ears
      x.fillStyle = shade(skin, -0.12); x.fillRect(5, 10, 1, 3); x.fillRect(18, 10, 1, 3);
      // hair
      if (o.helmet) {
        x.fillStyle = o.helmetc || "#9aa0a8"; x.fillRect(5, 3, 14, 6);
        x.fillStyle = shade(o.helmetc || "#9aa0a8", 0.25); x.fillRect(6, 3, 12, 2);
        x.fillStyle = shade(o.helmetc || "#9aa0a8", -0.35); x.fillRect(5, 8, 14, 1);
        x.fillRect(11, 9, 2, 5);
      } else if (o.hat === "pointy") {
        x.fillStyle = o.hatc || "#4a3a6a"; x.beginPath(); x.moveTo(12, -3); x.lineTo(20, 7); x.lineTo(4, 7); x.closePath(); x.fill();
        x.fillStyle = shade(o.hatc || "#4a3a6a", 0.2); x.fillRect(4, 6, 16, 2);
      } else if (o.hat === "wide") {
        x.fillStyle = o.hatc || "#6a4a28"; x.fillRect(1, 7, 22, 2); x.fillRect(6, 2, 12, 5);
        x.fillStyle = shade(o.hatc || "#6a4a28", -0.3); x.fillRect(1, 8, 22, 1);
      } else if (o.hat === "hood") {
        x.fillStyle = o.hatc || "#5a4a3a"; x.fillRect(4, 3, 16, 10);
        x.fillStyle = shade(o.hatc || "#5a4a3a", -0.45); x.fillRect(6, 5, 12, 10);
        x.fillStyle = skin; x.fillRect(7, 7, 10, 9);
      } else if (o.hat === "cap") {
        // hair underneath, cap over it — matches the world sprite
        x.fillStyle = hair; x.fillRect(5, 5, 14, 4);
        x.fillRect(5, 8, 2, 5); x.fillRect(17, 8, 2, 5);
        if (o.long) { x.fillRect(4, 8, 2, 10); x.fillRect(18, 8, 2, 10); }
        x.fillStyle = o.hatc || "#8c6a3a"; x.fillRect(5, 2, 14, 5);
        x.fillStyle = shade(o.hatc || "#8c6a3a", 0.22); x.fillRect(6, 2, 12, 2);
        x.fillStyle = shade(o.hatc || "#8c6a3a", -0.3); x.fillRect(3, 6, 18, 2);
      } else {
        x.fillStyle = hair; x.fillRect(5, 3, 14, 5);
        x.fillRect(5, 6, 2, 7); x.fillRect(17, 6, 2, 7);
        if (o.long) { x.fillRect(4, 6, 2, 12); x.fillRect(18, 6, 2, 12); }
        x.fillStyle = shade(hair, 0.22); x.fillRect(6, 3, 10, 2);
      }
      if (o.beard) { x.fillStyle = hair; x.fillRect(7, 13, 10, 5); x.fillRect(6, 12, 2, 4); x.fillRect(16, 12, 2, 4); x.fillStyle = skin; x.fillRect(10, 13, 4, 1); }
      // eyes
      x.fillStyle = "#f4ece0"; x.fillRect(8, 10, 3, 3); x.fillRect(13, 10, 3, 3);
      x.fillStyle = o.eye || "#3a5a7a"; x.fillRect(9, 10, 2, 3); x.fillRect(14, 10, 2, 3);
      x.fillStyle = "#12100e"; px(x, 9, 11, 1, 1); px(x, 14, 11, 1, 1);
      x.fillStyle = shade(skin, -0.3); x.fillRect(8, 9, 3, 1); x.fillRect(13, 9, 3, 1);
      // nose + mouth
      x.fillStyle = shade(skin, -0.22); x.fillRect(11, 12, 2, 2);
      x.fillStyle = "#8a4a3a"; x.fillRect(10, 15, 4, 1);
      if (o.blush) { x.fillStyle = "rgba(224,138,122,.5)"; x.fillRect(7, 13, 2, 1); x.fillRect(15, 13, 2, 1); }
    });
    /* A DOM node can only have one parent. The cached canvas is shared, so
       appending it to a second container silently stole it out of the first —
       the villager roster and the dialogue box were fighting over the same
       element and portraits blinked or vanished. Hand back the master only
       while it is unattached; otherwise blit a private copy. */
    if (!(master.parentNode || master.parentElement)) return master;
    const own = mk(24, 24);
    own.x.drawImage(master, 0, 0);
    return own.cv;
  }

  /* ── resource icons for the top bar ───────────────────────── */
  function resIcon(k) { return icon(k === "gold" ? "coin" : k, k === "gold" ? "#f0c05a" : k === "wood" ? "#8a5f35" : k === "stone" ? "#8f8c83" : k === "food" ? "#d8452f" : "#7a9ad0"); }

  /* ── custom external sprites (Imagen / PNG) with procedural fallback ── */
  const customSprites = new Map();
  function loadCustom(id, path) {
    if (typeof Image === "undefined") return;
    const img = new Image();
    img.src = path;
    img.onload = () => { customSprites.set(id, img); };
  }
  function getCustom(id) {
    return customSprites.get(id) || null;
  }

  // Preload available external sprites
  loadCustom("warden", "assets/sprites/characters/warden.png");
  loadCustom("ranger", "assets/sprites/characters/ranger.png");

  return { mk, px, tile, wallSide, obj, humanoid, monster, pet, building, icon, resIcon, portrait, cache: CACHE,
           SKIN, HAIR, CLOTH, PANTS, loadCustom, getCustom, customSprites };
})();
