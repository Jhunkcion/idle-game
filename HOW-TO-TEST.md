# Emberhold — M1 test build

How to run it, what to look at, and what is *not* there yet.

---

## 1. Run the game

**Easiest — double-click `game/index.html`.**
It is a static site with no build step and no external assets (all art is generated in code).

If saves misbehave, it is your browser restricting `localStorage` on `file://`. Use a local server instead:

```bash
cd game
python3 -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve game`, `php -S localhost:8000 -t game`, …).

**Controls.** Click to move. Nav bar: HERO · BAG · BUILD · TOWN · QUESTS · PETS · ☰.
Speed buttons at the top left (❚❚ ▶ ▶▶ ▶▶▶). `F` toggles auto-explore in the dungeon.

---

## 2. Run the automated suite

```bash
node tools/smoke.js
```

No browser needed. **111 checks**, exits non-zero on any failure, takes ~75 s.
It parses the real `index.html` into a DOM tree, so a missing element fails loudly instead of
being silently invented.

Expected last line: `✓ ALL CHECKS PASSED`

---

## 3. Test the M1 systems by hand

M1 was a **simulation** milestone, so most of it has no player-facing UI yet.
Press **`F9`** (or click the **BENCH** button) to open the dev test bench.

> The bench is dev-only. It is `game/js/testbench.js` plus one `<script>` line in
> `index.html`. It is **not** loaded by the smoke suite. Delete both to remove it.

| Tab | What it shows | What to check |
|---|---|---|
| **determinism** | FR-03 fixed timestep | Click *RUN TWICE & COMPARE*. Same seed + same steps must be byte-identical. Then *SAVE→LOAD→STEP == CONTINUOUS* — 600 steps, save, reload, 600 more must equal 1200 straight through. This is the P0 blocker; if either fails, nothing else matters. |
| **villagers** | FR-11 job training, FR-13 recruitment | Each villager's stats, what their job grows per game day, and which classes they qualify for. Greyed ✕ = not eligible; **hover it to see exactly which stat is short**. Click a green class button to recruit. |
| **buildings** | FR-05 capacity, FR-06 adjacency, §10.5 downtime | Staffing vs capacity, how many are job-matched (×1.25), what decorations physically touch it, which combos are live. **Knock offline** simulates a raid loss: efficiency goes to 0 and the timer counts down on the game clock. |
| **combos** | FR-07 | All 10 adjacency combos and whether each is currently active in your village. |
| **footprints** | FR-06 | How many tiles each decoration shape actually touches. Line and L touch fewer than the full perimeter — that is the point. |

### Things worth trying

1. **Jobs make the army.** Recruit nobody. Watch a farmer's STR climb (~+0.26/game day) while their
   INT never moves. A farming village literally cannot produce a Mage — you have to build and staff
   something that trains INT.
2. **No job locks.** In *buildings*, look for a post filled by someone whose job does not match.
   That is allowed by design; they just work at ×1.00 instead of ×1.25.
3. **Downtime.** Knock your farm offline and watch food income stop, then recover on its own.
   Nothing is ever destroyed — that is the whole loss model.
4. **Determinism.** Run the compare twice with the same seed, then change the seed by 1 and confirm
   the states differ.

---

## 4. What is NOT in this build

Being explicit so you do not go looking for it:

- **No recruitment UI in the normal game.** Only via the bench. The TOWN panel does not list stats.
- **No Breaches, no Retaliation raids, no Expedition Orders.** That is M2.
- **No location select.** One map, the Vale.
- **No village rank / star progression.**
- **Tooltips do not yet show the production breakdown** (capacity × match × adjacency × combo). The
  bench shows it; the game UI does not.
- **The Palisade (`wall`) is tagged `legacy`.** §7.4 cuts tower-defence structures, so M2 must
  repurpose or remove it. Left in place because deleting it now would break existing saves.

Visually the game looks like the previous prototype. That is expected — the engine underneath
changed, the presentation did not.

---

## 5. Where the design lives

- **`game/docs/PRD.md`** — v0.3, signed off. §18 has every decision; Appendix C is the M1 build log
  including the 7 bugs the harness caught.
- **`game/docs/GDD.md`** — older systems design. The PRD supersedes it on scope and priority.
- **`game/docs/PRD-v0.1-archived.md`** — the superseded first draft.

---

## 6. If something breaks

Tell me the exact check name from `node tools/smoke.js`, or what you clicked in the bench.
Because the suite is seeded, any failure is reproducible — that was the point of FR-03.

Saves live in `localStorage` under the key `save`. To wipe one: browser devtools → Application →
Local Storage → delete, or run `localStorage.removeItem('save')` in the console.
