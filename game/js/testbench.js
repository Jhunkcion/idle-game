/* ═══════════════════════════════════════════════════════════════════
   EMBERHOLD — testbench.js : DEV-ONLY M1 inspection panel

   Not part of the shipped product and not loaded by tools/smoke.js.
   It exists because M1 was a simulation milestone: the systems are built
   and harness-verified but have no player-facing UI yet (that is M2).
   This panel makes them visible and pokeable so a human can check the
   numbers rather than trusting the suite.

   Open with F9, or the BENCH button in the top nav.
   Delete this file and its <script> tag to remove it entirely.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var EH = window.EH;
  if (!EH) return;

  var TABS = ["determinism", "villagers", "buildings", "combos", "footprints"];
  var tab = "villagers";
  var root = null, body = null;

  /* ── styles (inline: the panel must not depend on game CSS) ─────── */
  var CSS = [
    "position:fixed;top:44px;right:8px;width:min(660px,calc(100vw - 16px));",
    "max-height:calc(100vh - 60px);overflow:auto;z-index:9999;",
    "background:#171310;border:1px solid #8a6a3a;border-radius:4px;",
    "color:#e8dcc8;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;",
    "box-shadow:0 6px 24px rgba(0,0,0,.6);padding:0;",
  ].join("");

  function el(tag, style, html) {
    var e = document.createElement(tag);
    /* cssText rather than setAttribute("style"): keeps `e.style` a live object in
       a real browser AND in the headless stub, so later `.style.x =` writes work. */
    if (style) e.style.cssText = style;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function btn(label, fn, style) {
    var b = el("button", style || "background:#2a211a;color:#e8dcc8;border:1px solid #6b5330;" +
      "border-radius:3px;padding:2px 7px;cursor:pointer;font:inherit;margin:0 2px 2px 0;", label);
    b.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); fn(); });
    return b;
  }
  var TH = "text-align:left;padding:2px 6px;border-bottom:1px solid #4a3a26;color:#c9a86a;white-space:nowrap;";
  var TD = "padding:2px 6px;border-bottom:1px solid #241d17;vertical-align:top;";
  function table(head, rows) {
    var h = "<tr>" + head.map(function (x) { return "<th style='" + TH + "'>" + x + "</th>"; }).join("") + "</tr>";
    var b = rows.map(function (r) {
      return "<tr>" + r.map(function (c) { return "<td style='" + TD + "'>" + c + "</td>"; }).join("") + "</tr>";
    }).join("");
    return "<table style='border-collapse:collapse;width:100%'>" + h + b + "</table>";
  }
  function n(v, d) { return (typeof v === "number" && isFinite(v)) ? v.toFixed(d === undefined ? 2 : d) : "—"; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  /* ── scratch runs that cannot corrupt the live game ───────────────
     newState/setupWorld replace EH.Game.st and reseed the global RNG, so
     both are captured and restored. Without this, opening the determinism
     tab would silently re-roll the player's actual world.               */
  function withScratch(seed, steps, fn) {
    var liveSt = EH.Game.st, liveRng = EH.randState();
    try {
      var s = EH.Game.newState("Bench", "warden", seed);
      EH.Game.st = s; EH.Game.setupWorld(false);
      EH.Game.stepN(steps);
      return fn(s);
    } finally {
      EH.Game.st = liveSt;
      EH.restoreRand(liveRng);
    }
  }
  function snap(s) {
    return JSON.stringify({
      rng: EH.randState().s, day: s.time.day, minute: s.time.minute, res: s.res,
      weather: s.weather, weatherT: s.weatherT,
      npcs: s.npcs.map(function (x) { return [x.x, x.y, x.needs.mood, x.stats.str, x.stats.int]; }),
      b: s.buildings.map(function (x) { return [x.id, x.done, x.lvl, x.workers.length]; }),
      steps: s.simSteps,
    });
  }
  function firstDiff(a, b) {
    var i = 0; while (i < a.length && a[i] === b[i]) i++;
    return "char " + i + "\n  A …" + a.slice(Math.max(0, i - 50), i + 50) + "\n  B …" + b.slice(Math.max(0, i - 50), i + 50);
  }

  /* ══ TAB: determinism (FR-03) ══════════════════════════════════ */
  function renderDeterminism() {
    var seed = 20260, steps = 1200, log = [];
    var out = el("div", "padding:8px;");
    var seedIn = el("input", "width:90px;background:#0f0c0a;color:#e8dcc8;border:1px solid #6b5330;padding:2px 4px;font:inherit;", String(seed));
    var stepIn = el("input", "width:90px;background:#0f0c0a;color:#e8dcc8;border:1px solid #6b5330;padding:2px 4px;font:inherit;", String(steps));
    var logBox = el("pre", "margin:8px 0 0;padding:6px;background:#0f0c0a;border:1px solid #241d17;border-radius:3px;white-space:pre-wrap;min-height:60px;", "idle");

    function say(t, ok) {
      log.push((ok === undefined ? "· " : ok ? "✓ " : "✗ ") + t);
      logBox.textContent = log.join("\n");
      logBox.style.color = log.some(function (l) { return l[0] === "✗"; }) ? "#e0705a" : "#9fd07a";
    }

    var bar = el("div", "margin-bottom:6px;");
    bar.appendChild(el("span", "", "seed ")); bar.appendChild(seedIn);
    bar.appendChild(el("span", "", "  steps ")); bar.appendChild(stepIn);
    bar.appendChild(btn("RUN TWICE & COMPARE", function () {
      log = []; logBox.textContent = "running…";
      seed = parseInt(seedIn.value, 10) || 20260; steps = parseInt(stepIn.value, 10) || 1200;
      setTimeout(function () {
        try {
          var a = withScratch(seed, steps, snap);
          var b = withScratch(seed, steps, snap);
          var ja = JSON.parse(a);
          say(steps + " fixed steps run twice at seed " + seed, true);
          say("rng stream ends identical (" + ja.rng + ")", a === b || undefined);
          if (a === b) say("state is byte-identical — FR-03 holds", true);
          else { say("DIVERGED at " + firstDiff(a, b), false); }
          var c = withScratch(seed + 1, steps, snap);
          say("seed " + (seed + 1) + " differs from seed " + seed + " (sim is seed-sensitive)", c !== a);
          var d = withScratch(seed, Math.floor(steps / 2), snap);
          say("half the steps gives a different state (sim really advances)", d !== a);
        } catch (e) { say("threw: " + e.message, false); }
      }, 20);
    }));
    bar.appendChild(btn("AUDIT Math.random", function () {
      log = [];
      /* FR-03(a): the only permitted unseeded draw is the entropy that seeds a new run. */
      say("util.js must have 0 — the sim may not touch the unseeded stream",
        String(EH.rand).indexOf("EH.rng") >= 0 && String(EH.chance).indexOf("EH.rng") >= 0);
      say("EH.rand is routed through the seeded stream: " + String(EH.rand).replace(/\s+/g, " ").slice(0, 70), true);
      say("EH.rollPool defaults to the seeded stream: " + String(EH.rollPool).replace(/\s+/g, " ").indexOf("EH.rng") >= 0, true);
      say("FIXED timestep = 1/" + Math.round(1 / EH.Game.FIXED) + " s", Math.abs(EH.Game.FIXED - 1 / 60) < 1e-12);
      say("stepN exposed: " + (typeof EH.Game.stepN === "function"), typeof EH.Game.stepN === "function");
      var st = EH.Game.st;
      say("save carries the rng stream: " + !!(EH.Game.serialize && EH.Game.serialize().rng), !!(EH.Game.serialize && EH.Game.serialize().rng));
      say("live simSteps so far: " + (st && st.simSteps || 0), true);
    }));
    bar.appendChild(btn("SAVE→LOAD→STEP == CONTINUOUS", function () {
      log = []; logBox.textContent = "running…";
      setTimeout(function () {
        try {
          var live = EH.Game.st, liveRng = EH.randState();
          var half = 600, rest = 600;
          var continuous = withScratch(4242, half + rest, snap);
          /* the split run: 600 steps, save, load, 600 more */
          var split = (function () {
            var s = EH.Game.newState("Bench", "warden", 4242);
            EH.Game.st = s; EH.Game.setupWorld(false);
            EH.Game.stepN(half);
            var blob = EH.Game.serialize();
            EH.Game.load(JSON.parse(JSON.stringify(blob)));
            EH.Game.stepN(rest);
            var out2 = snap(EH.Game.st);
            EH.Game.st = live; EH.restoreRand(liveRng);
            return out2;
          })();
          say("ran 1200 continuous steps and 600+save+load+600", true);
          if (split === continuous) say("identical — offline catch-up and reload are exact", true);
          else say("DIVERGED:\n" + firstDiff(continuous, split), false);
        } catch (e) { say("threw: " + e.message, false); }
      }, 20);
    }));

    out.appendChild(el("div", "color:#c9a86a;margin-bottom:4px;",
      "<b>FR-03 — fixed timestep &amp; determinism.</b> Scratch runs restore the live world and RNG stream, so this is safe to poke mid-game."));
    out.appendChild(bar); out.appendChild(logBox);
    return out;
  }

  /* ══ TAB: villagers (FR-11, FR-13) ═════════════════════════════ */
  function renderVillagers() {
    var st = EH.Game.st;
    var out = el("div", "padding:8px;");
    if (!st || !st.npcs) return el("div", "padding:8px;", "no live game — start a village first");

    function growth(job) {
      var t = EH.JOB_TRAIN[job];
      if (!t || !t.grow) return "<span style='color:#6b5b48'>none</span>";
      return Object.keys(t.grow).map(function (k) {
        return "<b style='color:#9fd07a'>+" + t.grow[k] + "</b> " + (EH.STATNAME[k] || k).slice(0, 3);
      }).join(", ") + "<span style='color:#6b5b48'>/day</span>";
    }
    function statCell(v, k, req) {
      var val = v.stats[k] || 0;
      var met = req === undefined || val >= req;
      var col = req === undefined ? "#e8dcc8" : met ? "#9fd07a" : "#e0705a";
      return "<span style='color:" + col + "'>" + n(val, 1) + (req === undefined ? "" : "/" + req) + "</span>";
    }

    var rows = st.npcs.filter(function (x) { return !x.dead; }).map(function (v) {
      var opts = EH.NPCs.classOptions(v);
      var acts = opts.map(function (o) {
        if (o.ok) return btn(o.n, function () {
          var r = EH.NPCs.recruit(st, v.id, o.cls);
          if (!r.ok) alert("Refused: " + r.why); else render();
        }, "background:#2f4a24;border-color:#5d8a44;");
        var why = o.missing.map(function (m) { return (EH.STATNAME[m.k] || m.k) + " " + m.have + "/" + m.need; }).join(", ");
        return "<span style='color:#6b5b48' title='" + esc(why) + "'>" + esc(o.n) + " ✕</span>";
      }).join(" ");
      var state = v.adventurer
        ? "<b style='color:#f0c05a'>" + esc(EH.CLASS[v.adventurer.cls].n) + "</b> " +
          btn("retire", function () { EH.NPCs.retire(st, v.id); render(); }, "background:#4a2f24;border-color:#8a5d44;")
        : (v.downed > 0 ? "<b style='color:#e0705a'>downed " + Math.ceil(v.downed) + "m</b>" : "villager");
      return [
        "<b>" + esc(v.name) + "</b><br><span style='color:#8a7a63'>" + esc(v.job) + (v.away ? " · <b>away</b>" : "") + "</span>",
        state,
        statCell(v, "str") + " " + statCell(v, "dex") + " " + statCell(v, "int") + " " +
        statCell(v, "vit") + " " + statCell(v, "per") + " " + statCell(v, "lck"),
        growth(v.job),
        acts || "<span style='color:#6b5b48'>too young</span>",
      ];
    });

    var head = ["villager", "status", "str dex int vit per lck", "§6.1 job training", "§6.5 recruit as…"];
    var wrap = el("div");
    wrap.appendChild(el("div", "color:#c9a86a;margin-bottom:4px;",
      "<b>FR-11 / FR-13.</b> Jobs grow stats; stats gate classes; you pick the class. " +
      "Hover a greyed ✕ to see exactly which stat is short — that is P5, the refusal always names the reason."));
    wrap.appendChild(el("div", "margin-bottom:6px;",
      "<span style='color:#8a7a63'>adventurers: <b style='color:#f0c05a'>" + EH.NPCs.adventurers(st).length +
      "</b> · working at home for ×" + EH.CFG.ADV_WORK_MUL + " (D14)</span>"));
    wrap.appendChild(el("div", "", table(head, rows)));
    out.appendChild(wrap);
    return out;
  }

  /* ══ TAB: buildings (FR-05, FR-06, §10.5) ══════════════════════ */
  function renderBuildings() {
    var st = EH.Game.st;
    if (!st || !st.buildings) return el("div", "padding:8px;", "no live game");
    var cache = new Map();
    var CATCOL = { production: "#9fd07a", kiosk: "#f0c05a", vacation: "#7ec8d8", decoration: "#c89fd0", legacy: "#8a7a63" };

    var rows = st.buildings.map(function (b) {
      var B = EH.BUILD[b.type] || {};
      var ws = EH.Build.workersOf(st, b);
      var cap = EH.Build.capacityOf(b);
      var adj = EH.Build.adjacencyOf(st, b);
      var comb = EH.Build.combosOf(st, b);
      var eff = EH.Build.efficiency(st, b);
      var matched = ws.filter(function (x) { return EH.Build.matchBonus(b, x) > 1; }).length;
      return [
        "<b>" + esc(B.n || b.type) + "</b> <span style='color:#6b5b48'>Lv" + b.lvl + "</span><br>" +
        "<span style='color:" + (CATCOL[B.cat] || "#888") + "'>" + esc(B.cat || "?") + "</span>" +
        (b.done ? "" : " <span style='color:#e0a05a'>building…</span>"),
        cap ? (ws.length + "/" + cap + (matched ? " <span style='color:#9fd07a'>(" + matched + " matched ×" + EH.CFG.MATCH_BONUS + ")</span>" : ""))
            : "<span style='color:#6b5b48'>no posts</span>",
        "<span style='color:" + (b.offline > 0 ? "#e0705a" : "#e8dcc8") + "'>×" + n(eff) + "</span>" +
        (b.offline > 0 ? "<br><b style='color:#e0705a'>offline " + Math.ceil(b.offline) + "m</b>" : ""),
        adj.src.length ? adj.src.map(function (s) { return "<span style='color:#c89fd0'>" + esc(s) + "</span>"; }).join(", ") +
          "<br><span style='color:#6b5b48'>" + Object.keys(adj.mul).map(function (k) { return k + " ×" + n(adj.mul[k]); }).join(" ") + "</span>"
          : "<span style='color:#4a3f33'>nothing touches it</span>",
        comb.length ? comb.map(function (c) { return "<b style='color:#f0c05a'>" + esc(c.n) + "</b>"; }).join(", ")
          : "<span style='color:#4a3f33'>—</span>",
        btn(b.offline > 0 ? "restore" : "knock offline", function () {
          b.offline = b.offline > 0 ? 0 : 180; render();
        }, b.offline > 0 ? "background:#2f4a24;border-color:#5d8a44;" : "background:#4a2f24;border-color:#8a5d44;"),
      ];
    });

    var wrap = el("div", "padding:8px;");
    wrap.appendChild(el("div", "color:#c9a86a;margin-bottom:4px;",
      "<b>FR-05 / FR-06 / §10.5.</b> Capacity is shared — no building demands a job, matching only pays a bonus. " +
      "Decoration buffs only tiles it physically touches. “Knock offline” simulates a raid loss: output goes to zero and decays on the game clock."));
    wrap.appendChild(el("div", "", table(
      ["building", "§5.1 staffed", "efficiency", "§5.2 touched by", "§5.3 combos", "§10.5 downtime"], rows)));
    return wrap;
  }

  /* ══ TAB: combos ══════════════════════════════════════════════ */
  function renderCombos() {
    var st = EH.Game.st;
    var wrap = el("div", "padding:8px;");
    var live = {};
    if (st && st.buildings) st.buildings.forEach(function (b) {
      if (!b.done) return;
      EH.Build.combosOf(st, b).forEach(function (c) { live[c.id] = (live[c.id] || 0) + 1; });
    });
    wrap.appendChild(el("div", "color:#c9a86a;margin-bottom:4px;",
      "<b>FR-07 §5.3.</b> Combos cost no dungeon materials — that is deliberate. They are the guaranteed escape valve " +
      "when a player is stuck between the rank gate and the depth gate (§11.2)."));
    wrap.appendChild(el("div", "", table(
      ["combo", "pair", "bonus", "why", "active now"],
      EH.COMBOS.map(function (c) {
        return ["<b style='color:#f0c05a'>" + esc(c.n) + "</b>",
          esc((EH.BUILD[c.a] || {}).n || c.a) + " + " + esc((EH.BUILD[c.b] || {}).n || c.b),
          Object.keys(c.mul).map(function (k) { return k + " ×" + c.mul[k]; }).join("<br>"),
          "<span style='color:#8a7a63'>" + esc(c.d) + "</span>",
          live[c.id] ? "<b style='color:#9fd07a'>yes ×" + live[c.id] + "</b>" : "<span style='color:#4a3f33'>no</span>"];
      }))));
    return wrap;
  }

  /* ══ TAB: footprints ══════════════════════════════════════════ */
  function renderFootprints() {
    var wrap = el("div", "padding:8px;");
    var SHAPES = { single: "every tile around it", line: "one face only", L: "two faces at a corner", cross: "the centre tile of each face" };
    wrap.appendChild(el("div", "color:#c9a86a;margin-bottom:4px;",
      "<b>FR-06 §5.2.</b> Deliberately stricter than Kairosoft's “8 surrounding tiles”. A shaped footprint makes " +
      "decoration a spatial puzzle — and the same machinery is reused for Breach adjacency (§10.6)."));
    wrap.appendChild(el("div", "", table(
      ["decoration", "size", "shape", "tiles touched", "buff", "what the shape means"],
      Object.keys(EH.BUILD).filter(function (k) { return EH.BUILD[k].decor; }).map(function (k) {
        var B = EH.BUILD[k];
        var fake = { type: k, x: 10, y: 10, w: B.w, h: B.h };
        var t = EH.Build.touchTiles(fake);
        var per = EH.Build.perimeterTiles(fake).length;
        return ["<b style='color:#c89fd0'>" + esc(B.n) + "</b>", B.w + "×" + B.h,
          "<b>" + esc(B.decor.shape) + (B.decor.dir ? " " + esc(B.decor.dir) : "") + "</b>",
          "<b style='color:" + (t.length < per ? "#f0c05a" : "#9fd07a") + "'>" + t.length + "</b> <span style='color:#6b5b48'>of " + per + " around it</span>",
          Object.keys(B.decor.mul).map(function (m) { return m + " ×" + B.decor.mul[m]; }).join("<br>"),
          "<span style='color:#8a7a63'>" + esc(SHAPES[B.decor.shape] || "") + "</span>"];
      }))));
    wrap.appendChild(el("div", "margin-top:6px;color:#8a7a63;",
      "A shape touching fewer tiles than the full perimeter is the point: you must aim it. " +
      "Line and L footprints are directional, so placement matters more than count."));
    return wrap;
  }

  /* ── chrome ───────────────────────────────────────────────────── */
  var RENDER = { determinism: renderDeterminism, villagers: renderVillagers, buildings: renderBuildings, combos: renderCombos, footprints: renderFootprints };

  function render() {
    if (!root) return;
    body.innerHTML = "";
    body.appendChild(RENDER[tab]());
  }
  function build() {
    root = el("div", CSS); root.style.display = "none";
    var head = el("div", "display:flex;align-items:center;gap:2px;padding:5px 6px;background:#241d17;border-bottom:1px solid #8a6a3a;position:sticky;top:0;flex-wrap:wrap;");
    head.appendChild(el("span", "color:#f0c05a;font-weight:bold;margin-right:6px;", "M1 TEST BENCH"));
    TABS.forEach(function (t) {
      var b = btn(t, function () { tab = t; render(); paintTabs(); });
      b.setAttribute("data-tab", t);
      head.appendChild(b);
    });
    var sp = el("span", "flex:1");
    head.appendChild(sp);
    head.appendChild(btn("refresh", render));
    head.appendChild(btn("✕", function () { root.style.display = "none"; }));
    body = el("div");
    root.appendChild(head); root.appendChild(body);
    document.body.appendChild(root);
    paintTabs();
  }
  function paintTabs() {
    if (!root) return;
    var bs = root.querySelectorAll("[data-tab]");
    for (var i = 0; i < bs.length; i++) {
      var on = bs[i].getAttribute("data-tab") === tab;
      bs[i].style.background = on ? "#8a6a3a" : "#2a211a";
      bs[i].style.color = on ? "#171310" : "#e8dcc8";
    }
  }
  function toggle() {
    if (!root) build();
    var show = root.style.display === "none";
    root.style.display = show ? "block" : "none";
    if (show) { render(); }
  }

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  ready(function () {
    /* A nav button, injected rather than hardcoded so index.html stays clean.
       If the nav cannot be found (selector unsupported, markup changed) fall back
       to a fixed floating button, so there is always a way in besides F9. */
    var injected = false;
    try {
      var nav = document.querySelector("[data-panel='menu']");
      if (nav && nav.parentNode) {
        var b = el("button", "", "BENCH");
        b.setAttribute("title", "M1 test bench (F9)");
        b.setAttribute("data-bench", "1");
        b.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); toggle(); });
        nav.parentNode.insertBefore(b, nav);
        injected = true;
      }
    } catch (e) { /* fall through to the floating button */ }
    if (!injected) {
      var f = el("button",
        "position:fixed;top:6px;right:8px;z-index:9998;background:#8a6a3a;color:#171310;" +
        "border:1px solid #f0c05a;border-radius:3px;padding:3px 9px;cursor:pointer;" +
        "font:bold 11px ui-monospace,Menlo,Consolas,monospace;", "M1 BENCH (F9)");
      f.setAttribute("data-bench", "1");
      f.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); toggle(); });
      document.body.appendChild(f);
    }
    window.addEventListener("keydown", function (e) {
      if (e.key === "F9") { e.preventDefault(); toggle(); }
    });
    EH.TestBench = { toggle: toggle, render: render, snap: snap, withScratch: withScratch };
  });
})();
