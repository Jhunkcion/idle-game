/* ═══════════════════════════════════════════════════════════════════════
   domstub.js — a deliberately *faithful* minimal DOM + Canvas 2D stub so the
   game can be executed headlessly in node.

   Design rule: behave like a browser, not like a mock that papers over bugs.
   The real game/index.html is parsed into a real element tree, so
   getElementById / querySelector return null for things that do not exist —
   exactly as they would in the browser. (An earlier version of this file
   auto-created any id it was asked for, which hid a genuine crash: index.html
   was missing #toast / #placebar / #placecancel entirely.)
   ═══════════════════════════════════════════════════════════════════════ */
"use strict";
const fs = require("fs");
const path = require("path");
const noop = () => { };

/* ── Canvas 2D context ─────────────────────────────────────────── */
function makeCtx() {
  const grad = { addColorStop: noop };
  return {
    canvas: null, imageSmoothingEnabled: false, globalAlpha: 1, globalCompositeOperation: "source-over",
    fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, font: "", textAlign: "left", textBaseline: "alphabetic",
    filter: "none", shadowBlur: 0, shadowColor: "transparent", lineCap: "butt", lineJoin: "miter",
    fillRect: noop, clearRect: noop, strokeRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, arcTo: noop, ellipse: noop, rect: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, fill: noop, stroke: noop, clip: noop,
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop, transform: noop, setTransform: noop,
    drawImage: noop, fillText: noop, strokeText: noop,
    measureText: () => ({ width: 10 }),
    createRadialGradient: () => grad, createLinearGradient: () => grad, createPattern: () => null,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    putImageData: noop,
  };
}

/* ── classList ─────────────────────────────────────────────────── */
class ClassList {
  constructor(el) { this.el = el; this.set = new Set(); }
  add(...c) { c.forEach(x => x && this.set.add(x)); }
  remove(...c) { c.forEach(x => this.set.delete(x)); }
  contains(c) { return this.set.has(c); }
  toggle(c, f) {
    if (f === undefined) { this.set.has(c) ? this.set.delete(c) : this.set.add(c); }
    else { f ? this.set.add(c) : this.set.delete(c); }
    return this.set.has(c);
  }
  get value() { return Array.from(this.set).join(" "); }
}

/* ── id registry (mirrors the browser's document tree) ─────────── */
const byId = new Map();

class El {
  constructor(tag) {
    this.tagName = (tag || "div").toUpperCase();
    this.children = []; this.style = {}; this.dataset = {}; this._l = {};
    this._cl = new ClassList(this);
    this._html = ""; this._text = ""; this.value = ""; this.disabled = false;
    this.title = ""; this._id = ""; this.href = ""; this.scrollTop = 0;
    this.offsetWidth = 120; this.offsetHeight = 40;
    this._parent = null;
    if (this.tagName === "CANVAS") { this.width = 300; this.height = 150; this._ctx = makeCtx(); this._ctx.canvas = this; }
  }
  get id() { return this._id; }
  set id(v) {
    if (this._id && byId.get(this._id) === this) byId.delete(this._id);
    this._id = String(v || "");
    if (this._id) byId.set(this._id, this);
  }
  get classList() { return this._cl; }
  set classList(v) { }
  get className() { return this._cl.value; }
  set className(v) { this._cl.set = new Set(String(v || "").split(/\s+/).filter(Boolean)); }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = String(v == null ? "" : v);
    for (const c of this.children) c._parent = null;
    this.children.length = 0;
    this._text = "";
    if (this._html) for (const c of parseHTML(this._html)) this.appendChild(c);
  }
  get textContent() { return this._text || this.children.map(c => c.textContent).join(""); }
  set textContent(v) {
    this._text = String(v == null ? "" : v);
    for (const c of this.children) c._parent = null;
    this.children.length = 0; this._html = "";
  }
  get firstChild() { return this.children[0] || null; }
  get lastChild() { return this.children[this.length - 1] || this.children[this.children.length - 1] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get childElementCount() { return this.children.length; }
  get parentElement() { return this._parent || null; }
  get parentNode() { return this._parent || null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0 }; }
  getContext() { return this._ctx; }
  /* Faithful DOM: a node has exactly ONE parent, so appending an already
     attached node MOVES it. The stub used to allow the same node in two
     parents, which hid a genuine bug — the shared cached portrait canvas was
     silently stolen out of the villager roster by the dialogue box. */
  appendChild(c) { if (c) { detach(c); c._parent = this; this.children.push(c); registerTree(c); } return c; }
  prepend(c) { if (c) { detach(c); c._parent = this; this.children.unshift(c); registerTree(c); } return c; }
  insertBefore(c) { return this.appendChild(c); }
  insertAdjacentHTML(pos, html) {
    const kids = parseHTML(String(html || ""));
    if (pos === "afterbegin") for (const k of kids.reverse()) this.prepend(k);
    else for (const k of kids) this.appendChild(k);
  }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c._parent = null; unregisterTree(c); } return c; }
  remove() { if (this._parent) this._parent.removeChild(this); }
  addEventListener(t, f) { (this._l[t] = this._l[t] || []).push(f); }
  removeEventListener(t, f) { const a = this._l[t]; if (a) { const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); } }
  dispatch(t, ev) {
    const l = this._l[t] || [];
    for (const f of l.slice()) f(Object.assign({
      preventDefault: noop, stopPropagation: noop, target: this, currentTarget: this,
      button: 0, key: "", code: "", clientX: 100, clientY: 100, pointerId: 1, shiftKey: false, ctrlKey: false
    }, ev));
    return l.length;
  }
  setPointerCapture() { } releasePointerCapture() { }
  querySelector(sel) { return queryAll(this, sel, true)[0] || null; }
  querySelectorAll(sel) { return queryAll(this, sel, false); }
  getElementsByClassName(c) { return queryAll(this, "." + c, false); }
  setAttribute(k, v) {
    if (k === "id") this.id = v;
    else if (k === "class") this.className = v;
    else if (k.indexOf("data-") === 0) this.dataset[camelize(k.slice(5))] = v;
    else this[k] = v;
  }
  getAttribute(k) {
    if (k === "id") return this._id;
    if (k === "class") return this.className;
    if (k.indexOf("data-") === 0) return this.dataset[camelize(k.slice(5))];
    return this[k];
  }
  focus() { } blur() { } click() { this.dispatch("click", {}); }
  contains(o) { let n = o; while (n) { if (n === this) return true; n = n._parent; } return false; }
  cloneNode() { const e = new El(this.tagName); e.className = this.className; return e; }
  closest(sel) { let n = this; while (n) { if (matchesSimple(n, sel.trim())) return n; n = n._parent; } return null; }
}
function camelize(s) { return s.replace(/-([a-z])/g, (m, c) => c.toUpperCase()); }
/* detaching a subtree must drop its ids from the document, as in a browser */
function detach(el) { const p = el._parent; if (!p) return; const i = p.children.indexOf(el); if (i >= 0) p.children.splice(i, 1); el._parent = null; }
function unregisterTree(el) { walk(el, n => { if (n._id && byId.get(n._id) === n) byId.delete(n._id); }); if (el._id && byId.get(el._id) === el) byId.delete(el._id); }
function registerTree(el) { walk(el, n => { if (n._id) byId.set(n._id, n); }); if (el._id) byId.set(el._id, el); }

/* ── selector engine: "#id", ".cls", "tag", "tag.cls", and descendant chains ── */
function matchesSimple(el, sel) {
  sel = sel.trim();
  if (!sel || sel === "*") return true;
  const m = /^([\w-]+)?((?:[.#][\w-]+)*)$/.exec(sel);
  if (!m) return false;
  if (m[1] && el.tagName !== m[1].toUpperCase()) return false;
  const parts = (m[2] || "").match(/[.#][\w-]+/g) || [];
  for (const p of parts) {
    if (p[0] === "#") { if (el.id !== p.slice(1)) return false; }
    else if (!el._cl.contains(p.slice(1))) return false;
  }
  return true;
}
function queryAll(root, sel, firstOnly) {
  const chain = String(sel).trim().split(/\s+/);
  let level = [root];
  for (let i = 0; i < chain.length; i++) {
    const simple = chain[i];
    const next = [];
    for (const el of level) {
      // a leading #id resolves globally in a browser, but only inside root here
      if (simple[0] === "#" && i === 0) { const g = byId.get(simple.slice(1)); if (g && isDescendant(g, root)) next.push(g); continue; }
      walk(el, c => { if (matchesSimple(c, simple)) next.push(c); });
    }
    level = next;
    if (!level.length) return [];
    if (firstOnly && i === chain.length - 1) return [level[0]];
  }
  return firstOnly ? (level[0] ? [level[0]] : []) : level;
}
function isDescendant(el, root) { let n = el._parent; while (n) { if (n === root) return true; n = n._parent; } return false; }
function walk(el, fn) { for (const c of el.children) { fn(c); walk(c, fn); } }

/* ── tiny HTML parser (enough for this game's markup) ──────────── */
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
function parseHTML(html) {
  const roots = [];
  const stack = [];
  const top = () => stack[stack.length - 1];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[\w:.-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].indexOf("<!--") === 0) continue;
    if (m[1]) {                                   // closing tag
      const tag = m[1].toUpperCase();
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tagName === tag) { stack.length = i; break; }
      continue;
    }
    if (m[2]) {                                   // opening tag
      const e = new El(m[2]);
      const attrs = m[3] || "";
      const are = /([\w:.-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let a;
      while ((a = are.exec(attrs))) {
        const k = a[1], v = a[2] !== undefined ? a[2] : a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : "";
        if (k === "id") e.id = v;
        else if (k === "class") e.className = v;
        else if (k === "value") e.value = v;
        else if (k === "disabled") e.disabled = true;
        else if (k === "title") e.title = v;
        else if (k === "href") e.href = v;
        else if (k.indexOf("data-") === 0) e.dataset[camelize(k.slice(5))] = v;
        else e.setAttribute(k, v);
      }
      if (top()) top().appendChild(e); else roots.push(e);
      if (!VOID[m[2].toLowerCase()] && !m[4]) stack.push(e);
      continue;
    }
    if (m[5] !== undefined) {                     // text node
      const t = m[5];
      if (t.trim()) { if (top()) top()._text += t; }
    }
  }
  return roots;
}

/* ── build the document from the real index.html ───────────────── */
const HTML_PATH = path.join(__dirname, "..", "game", "index.html");
const htmlSrc = fs.readFileSync(HTML_PATH, "utf8");
const headEl = new El("head");
const bodyEl = new El("body");
const docEl = new El("html");
(function build() {
  const grab = (name) => {
    const re = new RegExp("<" + name + "[^>]*>([\\s\\S]*?)</" + name + ">", "i");
    const m = re.exec(htmlSrc);
    return m ? m[1] : "";
  };
  for (const c of parseHTML(grab("head"))) headEl.appendChild(c);
  for (const c of parseHTML(grab("body"))) bodyEl.appendChild(c);
  docEl.appendChild(headEl); docEl.appendChild(bodyEl);
})();

const documentStub = {
  createElement: t => new El(t),
  createElementNS: (ns, t) => new El(t),
  getElementById: id => byId.get(String(id)) || null,
  querySelector: sel => queryAll(docEl, sel, true)[0] || null,
  querySelectorAll: sel => queryAll(docEl, sel, false),
  addEventListener: noop, removeEventListener: noop,
  body: bodyEl, documentElement: docEl, head: headEl,
  hidden: false, activeElement: null, title: "Emberhold",
};

/* ── window / storage ──────────────────────────────────────────── */
const store = new Map();
const listeners = {};
const windowStub = {
  document: documentStub, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
  removeEventListener: noop,
  dispatch(t, ev) { for (const f of (listeners[t] || []).slice()) f(Object.assign({ preventDefault: noop, key: "" }, ev)); },
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k), clear: () => store.clear(),
    get length() { return store.size; }, key: i => Array.from(store.keys())[i],
  },
  requestAnimationFrame: () => 0, cancelAnimationFrame: noop,
  performance: { now: () => Date.now() },
  console, getComputedStyle: () => ({ getPropertyValue: () => "" }),
  setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
  confirm: () => true, alert: noop, prompt: () => "",
  matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }),
};
windowStub.window = windowStub;
windowStub.self = windowStub;
windowStub.globalThis = windowStub;

global.window = windowStub;
global.document = documentStub;
global.localStorage = windowStub.localStorage;
global.performance = windowStub.performance;
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = noop;
try { global.navigator = { userAgent: "node", platform: "linux" }; } catch (_) { Object.defineProperty(global, "navigator", { value: { userAgent: "node", platform: "linux" }, writable: true, configurable: true }); }
global.confirm = () => true;
global.alert = noop;
global.getComputedStyle = () => ({ getPropertyValue: () => "" });
global.__realSetTimeout = setTimeout;
global.setTimeout = () => 0;
global.__El = El; global.__byId = byId; global.__store = store; global.__parseHTML = parseHTML;
global.__winDispatch = (t, ev) => windowStub.dispatch(t, ev);

module.exports = { windowStub, documentStub, El, byId, store, parseHTML };
