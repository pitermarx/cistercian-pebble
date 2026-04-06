// Cistercian time watchface — Alloy / Poco
//
// Encodes HHMM as a single Cistercian numeral (0–9999).
// The glyph is a vertical staff with strokes branching into four quadrants:
//   top-right    = units     (minutes ones)
//   top-left     = tens      (minutes tens)
//   bottom-right = hundreds  (hours ones)
//   bottom-left  = thousands (hours tens)
//
// Targets: Emery (Pebble Time 2, 200×228) and Gabbro (Pebble Round 2, 180×180)

import Poco from "commodetto/Poco";

// ── Stroke table ─────────────────────────────────────────────────────────────
//
// Each digit 1–9 maps to one or more line segments inside its quadrant.
// Segments are defined as pairs of normalised [x, y] points in [0,1] space:
//
//   [0,0] ──── [1,0]       ← top edge of quadrant
//     |          |
//   [0,1] ──── [1,1]       ← bottom edge (meets the gap)
//
//   [0, y] = on the staff (the vertical centre line)
//   [1, y] = at the outer tip of the arm
//   [x, 0] = at the top of the quadrant (furthest from the gap)
//   [x, 1] = at the bottom (closest to the gap)
//
// The same 9 shapes are reused in all four quadrants — the quadrantPoint()
// function handles the mirroring/flipping for each position.

const STROKES = [
  null,                                                  // 0 – staff only
  [[[0,0],[1,0]]],                                       // 1 – top horizontal
  [[[0,1],[1,1]]],                                       // 2 – bottom horizontal
  [[[0,0],[1,1]]],                                       // 3 – diagonal ↘
  [[[1,0],[0,1]]],                                       // 4 – diagonal ↙
  [[[0,0],[1,0]], [[1,0],[0,1]]],                        // 5 – top horiz + ↙ diag
  [[[1,0],[1,1]]],                                       // 6 – outer vertical
  [[[0,0],[1,0]], [[1,0],[1,1]]],                        // 7 – top horiz + outer vert
  [[[0,1],[1,1]], [[1,0],[1,1]]],                        // 8 – bottom horiz + outer vert
  [[[0,0],[1,0]], [[0,1],[1,1]], [[1,0],[1,1]]],         // 9 – top horiz + bottom horiz + outer vert
];


// ── Quadrant layout ───────────────────────────────────────────────────────────
//
//   q=1 (tens)      │  q=0 (units)
//   ────────────────┤                ← top half-staff ends here
//                   │   ← GAP (breathing room)
//   ────────────────┤                ← bottom half-staff starts here
//   q=3 (thousands) │  q=2 (hundreds)
//
// The gap makes the two halves visually distinct.
// Each half is independently `halfH` pixels tall.

function quadrantPoint(px, py, q, cx, cy, armW, halfH, gap) {
  const right = (q === 0 || q === 2);  // q0 and q2 extend to the right
  const top   = (q === 0 || q === 1);  // q0 and q1 live in the top half

  const signX = right ? 1 : -1;
  const signY = top   ? -1 : 1;

  // X: start at the staff centre, move outward by px * armW
  const x = Math.round(cx + signX * px * armW);

  // Y: start at the centre, skip over the gap, then move into the half.
  //    py=0 → tip of the arm (furthest from gap)
  //    py=1 → base of the arm (at the gap edge)
  const y = Math.round(cy + signY * (gap + (1 - py) * halfH));

  return [x, y];
}


// ── Helpers ───────────────────────────────────────────────────────────────────

// Encodes hours and minutes as the 4-digit Cistercian integer.
// e.g. 14:37 → 1437,  09:05 → 905,  00:00 → 0
function timeToN(h, m) {
  return h * 100 + m;
}


// ── Visual style ──────────────────────────────────────────────────────────────
//
// Centralised here so the browser preview and Alloy face are always in sync.

const STYLE = {
  strokeWidth: 3,

  // Warm gold — a nod to Cistercian manuscript illumination
  strokeR: 215,  strokeG: 190,  strokeB: 120,

  // Deep warm charcoal, not pure black
  bgR: 15,  bgG: 14,  bgB: 11,
};


// ── Layout fractions ──────────────────────────────────────────────────────────
//
// Expressed as fractions of the screen dimensions so the glyph scales
// correctly on Emery (200×228) and Gabbro (180×180).

const LAYOUT = {
  armWFraction:  0.30,   // arm width  = screen width  × this
  halfHFraction: 0.30,   // half-staff = screen height × this
  gapFraction:   0.055,  // gap        = screen height × this
};
const render = new Poco(screen);

// makeColor() converts 0–255 RGB to the display's native colour format.
// Called once at startup — never inside the draw loop.
const COLOR_BG     = render.makeColor(STYLE.bgR,     STYLE.bgG,     STYLE.bgB);
const COLOR_STROKE = render.makeColor(STYLE.strokeR, STYLE.strokeG, STYLE.strokeB);

// Layout — fractions of the actual screen dimensions so the glyph
// scales identically on Emery and Gabbro without any per-platform code.
const CX     = render.width  / 2;
const CY     = render.height / 2;
const BASE   = Math.min(render.width, render.height);
const ARM_W  = Math.round(BASE * LAYOUT.armWFraction);
const HALF_H = Math.round(BASE * LAYOUT.halfHFraction);
const GAP    = Math.round(render.height * LAYOUT.gapFraction);

// Poco has no drawLine — we approximate one with Bresenham's algorithm,
// painting a T×T square at each step along the path.
const T      = STYLE.strokeWidth;
const HALF_T = Math.floor(T / 2);

function drawLine(x0, y0, x1, y1) {
  console.log("drawLine x0:", x0, " y0:", y0, " x1:", x1, " y1:", y1)
  const dx =  Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : x0 > x1 ? -1 : 0;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    render.fillRectangle(COLOR_STROKE, x0 - HALF_T, y0 - HALF_T, T, T);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function drawCistercian(n) {
  console.log("draw called, n =", n);  // should print e.g. "draw called, n = 1437"
  
  // Single unbroken staff spanning the full glyph height.
  // The GAP only affects where strokes attach — not the staff itself.
  drawLine(CX, CY - GAP - HALF_H, CX, CY + GAP + HALF_H);

  if (n === 0) return;

  const digits = [
    n % 10,
    Math.floor(n /   10) % 10,
    Math.floor(n /  100) % 10,
    Math.floor(n / 1000) % 10,
  ];

  for (let q = 0; q < 4; q++) {
    const d = digits[q];
    if (d === 0) continue;
    const segs = STROKES[d];
    for (let s = 0; s < segs.length; s++) {
      const a = quadrantPoint(segs[s][0][0], segs[s][0][1], q, CX, CY, ARM_W, HALF_H, GAP);
      const b = quadrantPoint(segs[s][1][0], segs[s][1][1], q, CX, CY, ARM_W, HALF_H, GAP);
      drawLine(a[0], a[1], b[0], b[1]);
    }
  }
}

function draw(event) {
  const now = event.date || new Date();
  render.begin();
  render.fillRectangle(COLOR_BG, 0, 0, render.width, render.height);
  drawCistercian(timeToN(now.getHours(), now.getMinutes()));
  render.end();
}

console.log("W:", render.width, " H:", render.height);
console.log("ARM_W:", ARM_W, " HALF_H:", HALF_H, " GAP:", GAP);
console.log("staff top:", CY - GAP - HALF_H, "staff bot:", CY + GAP + HALF_H);

// minutechange fires immediately on registration (draws on startup)
// and then once every minute thereafter.
watch.addEventListener("minutechange", draw);