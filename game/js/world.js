/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — world.js : map data, generation, A* pathfinding
   ═══════════════════════════════════════════════════════════════════ */
"use strict";
var EH = window.EH;

/* ══════════════════════════════════════════════════════════════
   MAP
   ══════════════════════════════════════════════════════════════ */
EH.Map = class {
  constructor(w, h, kind, seed) {
    this.w = w; this.h = h; this.kind = kind; this.seed = seed || 1;
    this.t = new Uint8Array(w * h);      // tile id
    this.v = new Uint8Array(w * h);      // art variant
    this.seen = new Uint8Array(w * h);   // fog of war (dungeon)
    this.occ = new Map();                // "x,y" -> {type, ref}
    this.light = new Map();              // "x,y" -> intensity
    this.buildings = [];
    this.entities = [];
    this.name = kind === "town" ? "Emberhold" : "Hollowdeep";
  }
  i(x, y) { return y * this.w + x; }
  key(x, y) { return x + "," + y; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inb(x, y) ? this.t[this.i(x, y)] : EH.T.VOID; }
  set(x, y, id) { if (this.inb(x, y)) { this.t[this.i(x, y)] = id; this.v[this.i(x, y)] = (x * 7 + y * 13 + id) & 3; } }
  var(x, y) { return this.inb(x, y) ? this.v[this.i(x, y)] : 0; }
  block(x, y) { const o = this.occ.get(this.key(x, y)); return o ? o : null; }
  walk(x, y, flyer) {
    if (!this.inb(x, y)) return false;
    const id = this.t[this.i(x, y)];
    if (this.occ.has(this.key(x, y))) return false;
    if (flyer) return EH.tileDef(id).kind !== "x";
    return EH.walkable(id);
  }
  /* free rectangle for building placement */
  canPlace(bx, by, bw, bh, ignoreWater) {
    if (bx < 2 || by < 2 || bx + bw > this.w - 2 || by + bh > this.h - 2) return false;
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bw + bx; x++) {
      const id = this.get(x, y);
      if (!EH.walkable(id)) return false;
      if (id === EH.T.WATER || id === EH.T.DEEP) return false;
      if (this.occ.has(this.key(x, y))) return false;
    }
    return true;
  }
  occupy(b) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++)
      this.occ.set(this.key(x, y), { type: "build", ref: b });
  }
  vacate(b) {
    for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) {
      const k = this.key(x, y), o = this.occ.get(k);
      if (o && o.ref === b) this.occ.delete(k);
    }
  }
  /* tile just outside a building, nearest to (tx,ty) */
  doorTile(b, tx, ty) {
    const cands = [];
    for (let x = b.x - 1; x <= b.x + b.w; x++) { cands.push({ x, y: b.y - 1 }); cands.push({ x, y: b.y + b.h }); }
    for (let y = b.y; y < b.y + b.h; y++) { cands.push({ x: b.x - 1, y }); cands.push({ x: b.x + b.w, y }); }
    let best = null, bd = 1e9;
    for (const c of cands) {
      if (!this.walk(c.x, c.y)) continue;
      const d = EH.dist2(c.x, c.y, tx === undefined ? b.x : tx, ty === undefined ? b.y : ty);
      if (d < bd) { bd = d; best = c; }
    }
    return best || { x: b.x, y: b.y + b.h };
  }
  randomFree(r, isDungeon) {
    for (let i = 0; i < 400; i++) {
      const x = EH.randint(1, this.w - 2), y = EH.randint(1, this.h - 2);
      if (this.walk(x, y)) {
        const id = this.get(x, y);
        if (isDungeon && !(id === EH.T.DFLOOR || id === EH.T.DCARPET || id === EH.T.SFLOOR)) continue;
        return { x, y };
      }
    }
    return { x: 1, y: 1 };
  }
  neighbours(x, y, diag) {
    const out = [];
    const d = diag ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of d) {
      if (dx && dy) { if (!this.walk(x + dx, y) || !this.walk(x, y + dy)) continue; }
      if (this.walk(x + dx, y + dy)) out.push([x + dx, y + dy]);
    }
    return out;
  }
};

/* ══════════════════════════════════════════════════════════════
   A* PATHFINDING
   ══════════════════════════════════════════════════════════════ */
EH.findPath = function (map, sx, sy, tx, ty, opt) {
  opt = opt || {};
  sx = Math.round(sx); sy = Math.round(sy); tx = Math.round(tx); ty = Math.round(ty);
  if (!map.inb(sx, sy) || !map.inb(tx, ty)) return null;
  if (!map.walk(tx, ty, opt.fly)) {
    if (opt.allowAdjacent) {
      const near = EH.adjacentFree(map, tx, ty, opt.fly);
      if (!near) return null;
      tx = near.x; ty = near.y;
    } else return null;
  }
  if (sx === tx && sy === ty) return [];
  const W = map.w, H = map.h, N = W * H;
  const g = new Float32Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const h = (x, y) => (Math.abs(x - tx) + Math.abs(y - ty)) * 1.0 + (Math.min(Math.abs(x - tx), Math.abs(y - ty)) * 0.4);
  const start = sy * W + sx;
  g[start] = 0;
  // simple binary heap
  const heap = [[h(sx, sy), start]];
  const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const goal = ty * W + tx;
  let guard = opt.maxNodes || 9000;
  while (heap.length && guard-- > 0) {
    const [, cur] = pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [nx, ny] of map.neighbours(cx, cy, true)) {
      const ni = ny * W + nx;
      if (closed[ni]) continue;
      const step = (nx !== cx && ny !== cy) ? 1.414 : 1;
      const ng = g[cur] + step;
      if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; push(ng + h(nx, ny), ni); }
    }
  }
  if (from[goal] === -1 && goal !== start) return null;
  const path = [];
  let n = goal;
  while (n !== -1 && n !== start) { path.push({ x: n % W, y: (n / W) | 0 }); n = from[n]; }
  path.reverse();
  return path;
};
EH.adjacentFree = function (map, x, y, flyer) {
  let best = null, bd = 1e9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    if (map.walk(x + dx, y + dy, flyer)) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { x: x + dx, y: y + dy }; } }
  }
  return best;
};
/* smooth a grid path into waypoints (string-pull) */
EH.smoothPath = function (map, path, flyer) {
  if (!path || path.length < 3) return path;
  const out = [path[0]];
  let anchor = path[0];
  const los = (a, b) => {
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 2;
    for (let i = 1; i <= n; i++) {
      const x = Math.round(EH.lerp(a.x, b.x, i / n)), y = Math.round(EH.lerp(a.y, b.y, i / n));
      if (!map.walk(x, y, flyer)) return false;
    }
    return true;
  };
  for (let i = 1; i < path.length; i++) {
    if (!los(anchor, path[i])) { out.push(path[i - 1]); anchor = path[i - 1]; }
  }
  out.push(path[path.length - 1]);
  return out;
};

/* ══════════════════════════════════════════════════════════════
   TOWN GENERATION
   ══════════════════════════════════════════════════════════════ */
EH.genTown = function (seed) {
  const S = EH.CFG.MAP_TOWN, m = new EH.Map(S, S, "town", seed);
  const n1 = EH.noise(seed), n2 = EH.noise(seed * 31 + 7);
  const C = Math.floor(S / 2);

  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const e = EH.fbm(n1, x * 0.075, y * 0.075, 4);
    const m2 = EH.fbm(n2, x * 0.12, y * 0.12, 3);
    const edge = Math.min(x, y, S - 1 - x, S - 1 - y) / 6;
    let t = EH.T.GRASS;
    if (e < -0.22) t = EH.T.DEEP;
    else if (e < -0.13) t = EH.T.WATER;
    else if (e < -0.09) t = EH.T.SAND;
    else if (m2 > 0.30) t = EH.T.FLOWERS;
    else if (m2 > 0.16) t = EH.T.GRASS2;
    if (edge < 1 && t !== EH.T.DEEP && t !== EH.T.WATER) t = EH.T.TREE;
    m.set(x, y, t);
  }
  // scatter trees & rocks on grass
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const id = m.get(x, y), d = EH.dist(x, y, C, C);
    if ((id === EH.T.GRASS || id === EH.T.GRASS2) && d > 8) {
      const r = n2(x * 0.4, y * 0.4);
      if (r > 0.34) m.set(x, y, EH.T.PINE);
      else if (r > 0.28) m.set(x, y, EH.T.TREE);
      else if (r < -0.42) m.set(x, y, EH.T.ROCK);
      else if (r < -0.34) m.set(x, y, EH.T.BUSH);
    }
  }
  // clear the town core
  for (let y = C - 11; y <= C + 11; y++) for (let x = C - 11; x <= C + 11; x++) {
    if (!m.inb(x, y)) continue;
    const id = m.get(x, y);
    if (id === EH.T.TREE || id === EH.T.PINE || id === EH.T.ROCK || id === EH.T.BUSH) m.set(x, y, EH.T.GRASS);
    if (id === EH.T.DEEP || id === EH.T.WATER) { /* keep the river */ }
  }
  // plaza
  for (let y = C - 3; y <= C + 3; y++) for (let x = C - 3; x <= C + 3; x++) {
    const d = Math.max(Math.abs(x - C), Math.abs(y - C));
    if (d <= 3) m.set(x, y, d <= 1 ? EH.T.PLAZA : EH.T.PATH);
  }
  // roads: N/S/E/W from the plaza, bridging water
  const road = (x0, y0, x1, y1) => {
    let x = x0, y = y0;
    while (x !== x1 || y !== y1) {
      if (m.inb(x, y)) {
        const id = m.get(x, y);
        if (id === EH.T.WATER || id === EH.T.DEEP) m.set(x, y, EH.T.BRIDGE);
        else if (EH.walkable(id)) m.set(x, y, EH.T.PATH);
        // widen
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (m.inb(nx, ny) && EH.walkable(m.get(nx, ny)) && m.get(nx, ny) !== EH.T.PATH) m.set(nx, ny, EH.T.PATH);
        }
      }
      if (x !== x1) x += EH.sign(x1 - x);
      else if (y !== y1) y += EH.sign(y1 - y);
    }
  };
  road(C, C - 3, C, 3); road(C, C + 3, C, S - 4);
  road(C - 3, C, 3, C); road(C + 3, C, S - 4, C);

  // Hollowdeep entrance (NE) — carved stone + portal
  const dp = { x: C + 11, y: C - 11 };
  for (let y = dp.y - 2; y <= dp.y + 2; y++) for (let x = dp.x - 2; x <= dp.x + 2; x++) {
    if (!m.inb(x, y)) continue;
    const id = m.get(x, y);
    if (id === EH.T.WATER || id === EH.T.DEEP) continue;
    m.set(x, y, EH.T.STONE);
  }
  road(C + 3, C - 1, dp.x - 1, dp.y + 1);
  m.dungeonPortal = { x: dp.x, y: dp.y };
  m.set(dp.x, dp.y, EH.T.DPORTAL);
  m.occ.set(m.key(dp.x, dp.y), { type: "portal", ref: m.dungeonPortal });

  // the Warden's keep (player home) — SW of plaza
  m.keepSpot = { x: C - 7, y: C + 5 };
  for (let y = C + 4; y <= C + 7; y++) for (let x = C - 8; x <= C - 5; x++) if (m.walk(x, y)) m.set(x, y, EH.T.PATH);
  m.spawn = { x: C, y: C };
  // graveyard (flavour) NW
  m.graveyard = { x: C - 10, y: C - 8 };
  return m;
};

/* ══════════════════════════════════════════════════════════════
   DUNGEON GENERATION — rooms + corridors, boss floor every 5.
   The result is flood-filled from the entrance, so the stairs and every
   chest are guaranteed reachable (hazards can never wall you in).
   ══════════════════════════════════════════════════════════════ */
EH.genDungeon = function (seed, floor) {
  const S = EH.CFG.MAP_DUNG;
  const m = new EH.Map(S, S, "dungeon", seed + floor * 7919);
  const R = EH.RNG((seed >>> 0) + floor * 104729 + 9176);
  const deep = floor >= 15;

  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) m.set(x, y, EH.T.DFWALL);

  /* ── rooms ── */
  const rooms = [];
  const want = 7 + R.int(0, 5);
  let guard = 0;
  while (rooms.length < want && guard++ < 600) {
    const w = 5 + R.int(0, 5), h = 5 + R.int(0, 5);
    const x = 2 + R.int(0, S - w - 5), y = 2 + R.int(0, S - h - 5);
    let ok = true;
    for (const r of rooms) {
      if (x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y) { ok = false; break; }
    }
    if (!ok) continue;
    const rm = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) };
    rooms.push(rm);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) m.set(xx, yy, EH.T.DFLOOR);
  }
  if (rooms.length < 2) {           // pathological fallback — never happens, but stay safe
    rooms.length = 0;
    rooms.push({ x: 3, y: 3, w: 7, h: 7, cx: 6, cy: 6 });
    rooms.push({ x: S - 11, y: S - 11, w: 7, h: 7, cx: S - 8, cy: S - 8 });
    for (const r of rooms) for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) m.set(xx, yy, EH.T.DFLOOR);
  }

  /* ── corridors (never decorated, so they always stay passable) ── */
  const carve = (x0, y0, x1, y1) => {
    let x = x0, y = y0;
    while (x !== x1) { m.set(x, y, EH.T.DFLOOR); x += EH.sign(x1 - x); }
    while (y !== y1) { m.set(x, y, EH.T.DFLOOR); y += EH.sign(y1 - y); }
    m.set(x, y, EH.T.DFLOOR);
  };
  const link = (a, b) => {
    if (R.chance(0.5)) { carve(a.cx, a.cy, b.cx, a.cy); carve(b.cx, a.cy, b.cx, b.cy); }
    else { carve(a.cx, a.cy, a.cx, b.cy); carve(a.cx, b.cy, b.cx, b.cy); }
  };
  for (let i = 1; i < rooms.length; i++) link(rooms[i - 1], rooms[i]);
  for (let i = 0; i < 2 && rooms.length > 3; i++) {
    const a = R.pick(rooms), b = R.pick(rooms);
    if (a !== b) link(a, b);
  }

  const ent = rooms[0], ex = rooms[rooms.length - 1];
  const isBoss = floor % 5 === 0;
  m.entrance = { x: ent.cx, y: ent.cy };
  m.stairs = { x: ex.cx, y: ex.cy };
  m.spawn = { x: ent.cx, y: ent.cy };

  /* ── decoration, restricted to room interiors ── */
  const interior = (x, y) => {
    for (const r of rooms) if (x > r.x && x < r.x + r.w - 1 && y > r.y && y < r.y + r.h - 1) return true;
    return false;
  };
  for (const r of rooms) {
    const n = R.int(1, 4);
    for (let i = 0; i < n; i++) {
      const x = r.x + 1 + R.int(0, r.w - 3), y = r.y + 1 + R.int(0, r.h - 3);
      if (m.get(x, y) === EH.T.DFLOOR && interior(x, y)) m.set(x, y, EH.T.DFPILLAR);
    }
  }
  const nPool = 2 + R.int(0, 4);
  for (let i = 0; i < nPool; i++) {
    const r = R.pick(rooms);
    if (r === ent || r === ex) continue;
    const tt = deep && R.chance(0.45) ? EH.T.SLAVA : EH.T.SWATER;
    const cx = r.x + 1 + R.int(0, Math.max(0, r.w - 3)), cy = r.y + 1 + R.int(0, Math.max(0, r.h - 3));
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (!interior(x, y) || R.chance(0.22)) continue;
      if (m.get(x, y) === EH.T.DFLOOR) m.set(x, y, tt);
    }
  }
  if (isBoss) {                        // carpet the guardian's chamber
    for (let y = ex.y; y < ex.y + ex.h; y++) for (let x = ex.x; x < ex.x + ex.w; x++) {
      if (m.get(x, y) === EH.T.DFLOOR) m.set(x, y, EH.T.DCARPET);
    }
  }
  m.set(m.entrance.x, m.entrance.y, EH.T.DFLOOR);
  m.set(m.stairs.x, m.stairs.y, EH.T.DSTAIRS);

  /* ── flood fill so nothing is ever sealed off ── */
  const flood = () => {
    const seen = new Uint8Array(S * S), out = [];
    const stack = [[m.entrance.x, m.entrance.y]];
    seen[m.i(m.entrance.x, m.entrance.y)] = 1;
    while (stack.length) {
      const c = stack.pop(); out.push(c);
      for (let k = 0; k < 4; k++) {
        const nx = c[0] + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = c[1] + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (!m.inb(nx, ny)) continue;
        const id = m.i(nx, ny);
        if (seen[id] || !m.walk(nx, ny)) continue;
        seen[id] = 1; stack.push([nx, ny]);
      }
    }
    return { seen, tiles: out };
  };
  let f = flood();
  if (!f.seen[m.i(m.stairs.x, m.stairs.y)]) {   // emergency corridor
    carve(m.entrance.x, m.entrance.y, m.stairs.x, m.entrance.y);
    carve(m.stairs.x, m.entrance.y, m.stairs.x, m.stairs.y);
    m.set(m.stairs.x, m.stairs.y, EH.T.DSTAIRS);
    f = flood();
  }

  /* ── chests, only on reachable room-interior floor ── */
  const blocked = new Set([m.key(m.entrance.x, m.entrance.y), m.key(m.stairs.x, m.stairs.y)]);
  const spots = f.tiles.filter(([x, y]) =>
    !blocked.has(m.key(x, y)) && interior(x, y) &&
    (m.get(x, y) === EH.T.DFLOOR || m.get(x, y) === EH.T.DCARPET));
  const chests = [];
  const nC = 2 + R.int(0, 2) + (isBoss ? 1 : 0);
  const route = (x, y) => EH.findPath(m, m.entrance.x, m.entrance.y, x, y, { allowAdjacent: true });
  for (let i = 0; i < nC && spots.length; i++) {
    const p = spots.splice(R.int(0, spots.length - 1), 1)[0];
    const tier = floor >= 20 ? 2 : floor >= 8 ? (R.chance(0.4) ? 1 : 0) : (R.chance(0.15) ? 1 : 0);
    const ch = { x: p[0], y: p[1], tier, opened: false };
    m.occ.set(m.key(ch.x, ch.y), { type: "chest", ref: ch });
    // a chest you can't stand next to, or one that walls off the stairs, is worse
    // than no chest at all
    if (!route(ch.x, ch.y) || !route(m.stairs.x, m.stairs.y)) { m.occ.delete(m.key(ch.x, ch.y)); continue; }
    chests.push(ch);
  }
  // a later chest can strand an earlier one — re-verify the whole set and drop
  // any that no longer has a route
  for (let pass = 0; pass < 4; pass++) {
    let dropped = false;
    for (let i = chests.length - 1; i >= 0; i--) {
      if (!route(chests[i].x, chests[i].y)) { m.occ.delete(m.key(chests[i].x, chests[i].y)); chests.splice(i, 1); dropped = true; }
    }
    if (!route(m.stairs.x, m.stairs.y)) {
      carve(m.entrance.x, m.entrance.y, m.stairs.x, m.entrance.y);
      carve(m.stairs.x, m.entrance.y, m.stairs.x, m.stairs.y);
      m.set(m.stairs.x, m.stairs.y, EH.T.DSTAIRS);
      dropped = true;
    }
    if (!dropped) break;
  }

  m.rooms = rooms;
  m.floor = floor;
  m.chests = chests;
  m.isBoss = isBoss;
  m.bossDead = false;
  m.name = "Hollowdeep — Depth " + floor;
  return m;
};

/* ══════════════════════════════════════════════════════════════
   FOG OF WAR
   ══════════════════════════════════════════════════════════════ */
EH.reveal = function (map, cx, cy, rad) {
  cx = Math.round(cx); cy = Math.round(cy);
  const r2 = rad * rad;
  for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
    if (!map.inb(x, y)) continue;
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy > r2) continue;
    map.seen[map.i(x, y)] = 1;
  }
};
EH.seenAt = (map, x, y) => map.inb(x, y) ? map.seen[map.i(x, y)] : 0;
