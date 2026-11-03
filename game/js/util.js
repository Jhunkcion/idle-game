/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — util.js : math, RNG, pools, helpers
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH || (window.EH = {});

/* ── math ─────────────────────────────────────────────────────── */
EH.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
EH.lerp = (a, b, t) => a + (b - a) * t;
EH.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
EH.dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
EH.idist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
EH.sign = v => v < 0 ? -1 : v > 0 ? 1 : 0;
EH.approach = (v, t, s) => v < t ? Math.min(v + s, t) : Math.max(v - s, t);
EH.smooth = t => t * t * (3 - 2 * t);
EH.TAU = Math.PI * 2;

/* ── seeded RNG (mulberry32) ──────────────────────────────────── */
EH.RNG = function (seed) {
  let s = (seed >>> 0) || 1;
  const f = function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.pick = arr => arr[Math.floor(f() * arr.length)];
  f.chance = p => f() < p;
  f.range = (a, b) => a + f() * (b - a);
  f.shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };
  f.weighted = pairs => { // [[value, weight], ...]
    let tot = 0; for (const p of pairs) tot += p[1];
    let r = f() * tot;
    for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; }
    return pairs[pairs.length - 1][0];
  };
  f.gauss = () => { let u = 0, v = 0; while (!u) u = f(); while (!v) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(EH.TAU * v); };
  /* FR-03: state must be serialisable so save/load and offline catch-up are exact */
  f.state = () => s | 0;
  f.setState = v => { s = (v | 0) || 1; };
  return f;
};
EH.rng = EH.RNG(12345);        // gameplay rng — the ONLY stream the simulation may draw from
EH.rngA = EH.RNG(999);          // art rng — kept separate so rendering never perturbs the sim
EH.rand = (a, b) => a + EH.rng() * (b - a);
EH.randint = (a, b) => a + Math.floor(EH.rng() * (b - a + 1));
EH.pick = a => a[Math.floor(EH.rng() * a.length)];
EH.chance = p => EH.rng() < p;

/* ── FR-03 determinism controls ────────────────────────────────
   The sim is deterministic iff (a) every random draw comes from EH.rng and
   (b) it advances only on fixed timesteps. These helpers make (a) auditable
   and re-seedable, and let a test prove two runs agree exactly.           */
EH.seedRng = function (seed) { EH.rng = EH.RNG(seed >>> 0); EH.rngState0 = EH.rng.state(); if (EH.resetUid) EH.resetUid(); };
EH.randState = () => ({ s: EH.rng.state(), a: EH.rngA.state() });
EH.restoreRand = function (o) { if (!o) return; EH.rng.setState(o.s); EH.rngA.setState(o.a); };

/* ── value noise (deterministic, for terrain) ─────────────────── */
EH.noise = function (seed) {
  const r = EH.RNG(seed), size = 256, perm = new Uint8Array(512), grad = [];
  const p = []; for (let i = 0; i < size; i++) p.push(i);
  for (let i = size - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < size; i++) { const a = r() * EH.TAU; grad.push([Math.cos(a), Math.sin(a)]); }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const dot = (g, x, y) => g[0] * x + g[1] * y;
  return function (x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const aa = perm[perm[X] + Y] & 255, ab = perm[perm[X] + Y + 1] & 255;
    const ba = perm[perm[X + 1] + Y] & 255, bb = perm[perm[X + 1] + Y + 1] & 255;
    const x1 = EH.lerp(dot(grad[aa], x, y), dot(grad[ba], x - 1, y), u);
    const x2 = EH.lerp(dot(grad[ab], x, y - 1), dot(grad[bb], x - 1, y - 1), u);
    return EH.lerp(x1, x2, v); // ~[-1,1]
  };
};
EH.fbm = function (noise, x, y, oct = 4) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { v += a * noise(x * f, y * f); n += a; a *= 0.5; f *= 2; }
  return v / n;
};

/* ── number formatting ────────────────────────────────────────── */
EH.fmt = function (n) {
  if (n === undefined || n === null || isNaN(n)) return "0";
  const a = Math.abs(n);
  if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "K";
  if (a >= 100) return Math.floor(n).toString();
  if (a >= 10) return (Math.round(n * 10) / 10).toString().replace(/\.0$/, "");
  return (Math.round(n * 10) / 10).toString().replace(/\.0$/, "");
};
EH.fmtInt = n => Math.floor(n).toLocaleString("en-US");
EH.fmtTime = mins => {
  const h = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
};
EH.fmtDur = secs => {
  secs = Math.max(0, Math.floor(secs));
  if (secs < 60) return secs + "s";
  const m = Math.floor(secs / 60), s = secs % 60;
  if (m < 60) return m + "m" + (s ? " " + s + "s" : "");
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h " + (m % 60) + "m";
  return Math.floor(h / 24) + "d " + (h % 24) + "h";
};
EH.plural = (n, s, p) => n + " " + (n === 1 ? s : (p || s + "s"));

/* ── colour helpers ───────────────────────────────────────────── */
EH.hex2rgb = h => { h = h.replace("#", ""); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; };
EH.rgb2css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
EH.rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
EH.mix = (a, b, t) => [EH.lerp(a[0], b[0], t), EH.lerp(a[1], b[1], t), EH.lerp(a[2], b[2], t)];
EH.shade = (hex, amt) => { // amt -1..1
  const c = typeof hex === "string" ? EH.hex2rgb(hex) : hex;
  return EH.rgb2css(amt < 0 ? c.map(v => v * (1 + amt)) : c.map(v => v + (255 - v) * amt));
};

/* ── tiny DOM helpers ─────────────────────────────────────────── */
EH.el = function (tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
EH.$ = sel => document.querySelector(sel);
EH.$$ = sel => Array.from(document.querySelectorAll(sel));
EH.esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
EH.on = (el, ev, fn, opt) => { if (el) el.addEventListener(ev, fn, opt); return el; };

/* ── event bus ────────────────────────────────────────────────── */
EH.bus = (function () {
  const m = new Map();
  return {
    on(ev, fn) { if (!m.has(ev)) m.set(ev, []); m.get(ev).push(fn); return () => EH.bus.off(ev, fn); },
    off(ev, fn) { const a = m.get(ev); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
    emit(ev, data) { const a = m.get(ev); if (a) for (const f of a.slice()) { try { f(data); } catch (e) { console.error("[bus]", ev, e); } } }
  };
})();

/* ── weighted pool helper ─────────────────────────────────────── */
EH.rollPool = function (pool, rng) { // pool: [{w:weight, ...}]
  /* FR-03: default to the seeded stream. An unseeded pool roll silently breaks
     save/load, offline catch-up and the §9.4 abstract==live guarantee. */
  const r = rng || (() => EH.rng());
  let tot = 0; for (const it of pool) tot += (it.w || 1);
  let x = r() * tot;
  for (const it of pool) { x -= (it.w || 1); if (x <= 0) return it; }
  return pool[pool.length - 1];
};

/* ── unique ids ───────────────────────────────────────────────── */
let _uid = 1;
/* FR-03: entity ids are part of the simulation's observable state, so both the
   counter and the suffix must come from the seeded stream. `resetUid` is called
   by seedRng so a fresh run always starts ids from the same place — without it,
   the second run in a process inherits the first run's counter and diverges. */
EH.resetUid = () => { _uid = 1; };
EH.uid = p => (p || "id") + "_" + (_uid++) + "_" + Math.floor(EH.rng() * 1e6).toString(36);

/* ── storage ──────────────────────────────────────────────────── */
EH.store = {
  get(k, dflt) { try { const v = localStorage.getItem("emberhold." + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
  set(k, v) { try { localStorage.setItem("emberhold." + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem("emberhold." + k); } catch (e) { } },
  ok() { try { localStorage.setItem("emberhold.__t", "1"); localStorage.removeItem("emberhold.__t"); return true; } catch (e) { return false; } }
};

/* ── timer / schedule helper ──────────────────────────────────── */
EH.every = function (interval, fn) { let acc = 0; return dt => { acc += dt; if (acc >= interval) { const n = Math.min(8, Math.floor(acc / interval)); acc -= n * interval; for (let i = 0; i < n; i++) fn(n); } }; };

/* ── deep clone (plain data only) ─────────────────────────────── */
EH.clone = o => JSON.parse(JSON.stringify(o));

/* ── fps meter ────────────────────────────────────────────────── */
EH.fps = { v: 60, acc: 0, n: 0, tick(dt) { this.acc += dt; this.n++; if (this.acc >= 0.5) { this.v = this.n / this.acc; this.acc = 0; this.n = 0; } } };
