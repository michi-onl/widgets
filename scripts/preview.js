// Renders every source at every widget family as monospace art, so layout
// changes can be reviewed (and diffed) without a device.
//
//   node scripts/preview.js                  write design-preview.md
//   node scripts/preview.js billboard large  print matching previews to stdout
//
// It runs the real renderWidget() code against the test stubs and fixtures,
// then lays the resulting stack tree out on a character grid. One cell is
// about half the family's secondary font size wide and one secondary text line
// tall. Larger text takes proportionally more cells per character (so it
// truncates where it would on device), and every text line takes one row.
// The "fits" caption comes from the point-based model in
// test/overflow.test.js and is the one to trust.

// Freeze the clock so refresh times and "2h ago" labels don't churn the file.
// Must run before fixtures load, since they stamp `new Date()` at require time.
const RealDate = Date;
const NOW = new RealDate(2026, 8, 12, 9, 41).getTime();
global.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [NOW]));
  }
  static now() {
    return NOW;
  }
};

const fs = require("node:fs");
const path = require("node:path");
const { minHeight } = require("../test/scriptable-stubs");
const { FIXTURES } = require("../test/fixtures");
const { CONFIG } = require("../src/config.js");
const { DataSourceFactory } = require("../src/data/data-source-factory.js");
const { createErrorWidget } = require("../src/ui/widget-chrome.js");

global.Script = { name: () => "Mosaic" };

const FAMILIES = ["small", "medium", "large", "extraLarge"];
const OUTPUT = path.join(__dirname, "..", "design-preview.md");

// SF Symbol → single-width glyph. Unmapped symbols fall back to ◆.
const SYMBOLS = {
  "arrow.up": "↑",
  "arrow.down": "↓",
  minus: "–",
  "star.fill": "★",
  "icloud.slash": "⊘",
  "exclamationmark.triangle": "△",
  "exclamationmark.triangle.fill": "▲",
  "questionmark.circle": "?",
  "chevron.left.forwardslash.chevron.right": "‹",
  "book.fill": "▥",
  "doc.text.fill": "≡",
  "photo.fill": "▨",
  "film.fill": "▦",
  "sunrise.fill": "↥",
  "sunset.fill": "↧",
  "sun.max.fill": "☼",
  "camera.filters": "◎",
  "thermometer.medium": "°",
  "moonphase.new.moon": "○",
  "moonphase.waxing.crescent": "☽",
  "moonphase.first.quarter": "◐",
  "moonphase.waxing.gibbous": "◐",
  "moonphase.full.moon": "●",
  "moonphase.waning.gibbous": "◑",
  "moonphase.last.quarter": "◑",
  "moonphase.waning.crescent": "☾",
};

const chars = (s) => Array.from(s);

// --- Cell metrics ---------------------------------------------------------

function metrics(family) {
  const sizes = CONFIG.sizing[family];
  const canvas = CONFIG.widgetCanvas[family];
  const ref = sizes.fontSize.secondary;
  const cw = ref * 0.5;
  const ch = ref * 1.2;
  return {
    ref,
    cw,
    ch,
    cols: Math.round(canvas.width / cw),
    rows: Math.round(canvas.height / ch),
    x: (pt) => Math.round(pt / cw),
    y: (pt) => Math.round(pt / ch),
  };
}

// --- Layout ---------------------------------------------------------------
// A small SwiftUI-like layout pass. Widths are in cells; heights are tracked in
// points (`pt`) so stacked spacing adds up the way it does on device, and only
// snap to rows (`rows`) when a box is placed. Each call returns
// { w, pt, rows, draw(grid, x, row) }. `pw` is the offered width in cells,
// `ph` the offered height in points (Infinity means "take your minimum").

const EMPTY = { w: 0, pt: 0, rows: 0, draw() {} };

function isFlexSpacer(node) {
  return node.kind === "spacer" && node.length == null;
}

function greedyW(node) {
  if (node.kind === "text") return node.align !== "left";
  if (node.kind !== "stack") return false;
  if (node.size && node.size.width > 0) return false;
  if (node.direction === "horizontal" && node.children.some(isFlexSpacer)) return true;
  return node.children.some(greedyW);
}

function greedyH(node) {
  if (node.kind !== "stack") return false;
  if (node.size && node.size.height > 0) return false;
  if (node.direction === "vertical" && node.children.some(isFlexSpacer)) return true;
  return node.children.some(greedyH);
}

function wrap(text, width, lineLimit) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = [];
  for (const word of words) {
    let w = chars(word);
    const candidate = line.length ? [...line, " ", ...w] : w;
    if (candidate.length <= width) {
      line = candidate;
      continue;
    }
    if (line.length) lines.push(line);
    while (w.length > width) {
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    line = w;
  }
  if (line.length) lines.push(line);
  if (lines.length === 0) lines.push([]);

  const limit = lineLimit > 0 ? lineLimit : Infinity;
  if (lines.length > limit) {
    lines.length = limit;
    const last = lines[limit - 1];
    lines[limit - 1] = [...last.slice(0, Math.max(0, width - 1)), "…"];
  }
  return lines;
}

function layoutText(node, pw, m) {
  // Cells per character: text above the reference size is drawn wider than
  // one cell per glyph would suggest, and gets fewer characters per line.
  const size = node.font ? node.font.size : 12;
  const scale = Math.max(1, size / m.ref);
  const capacity = Math.floor(pw / scale);
  const full = chars(node.text.replace(/\s+/g, " ").trim());
  let lines;
  if (full.length <= capacity) {
    lines = [full];
  } else if (node.lineLimit === 1) {
    lines = [[...full.slice(0, Math.max(0, capacity - 1)), "…"]];
  } else {
    lines = wrap(node.text, capacity, node.lineLimit);
  }
  const natural = Math.ceil(Math.max(...lines.map((l) => l.length)) * scale);
  const w = node.align !== "left" && Number.isFinite(pw) ? pw : natural;
  return {
    w,
    pt: size * 1.2 * lines.length,
    rows: lines.length,
    draw(grid, x, row) {
      lines.forEach((line, i) => {
        const drawn = Math.ceil(line.length * scale);
        const offset =
          node.align === "center"
            ? Math.floor((w - drawn) / 2)
            : node.align === "right"
              ? w - drawn
              : 0;
        grid.put(x + offset, row + i, line);
      });
    },
  };
}

function layoutImage(node, m) {
  const image = node.image || {};
  const size = node.imageSize || { width: 0, height: 0 };
  const w = Math.max(1, m.x(size.width));

  if (image.isSymbol) {
    // Inline icons sit at the leading edge; big standalone ones are centered.
    const glyph = SYMBOLS[image.name] || "◆";
    const dx = w >= 4 ? Math.floor((w - 1) / 2) : 0;
    return { w, pt: size.height, rows: 1, draw: (grid, x, row) => grid.put(x + dx, row, [glyph]) };
  }

  const rows = Math.max(1, m.y(size.height));
  const round = node.cornerRadius > 0;
  const circle = node.cornerRadius >= Math.min(size.width, size.height) / 2;
  return {
    w,
    pt: size.height,
    rows,
    draw(grid, x, row) {
      if (rows === 1) {
        const strip = circle ? "◉" : w < 3 ? "▣" : `▐${"▒".repeat(w - 2)}▌`;
        grid.put(x, row, chars(strip));
        return;
      }
      const [tl, tr, bl, br] = round ? "╭╮╰╯" : "┌┐└┘";
      const inner = Math.max(0, w - 2);
      grid.put(x, row, [tl, ..."─".repeat(inner), tr].slice(0, w));
      for (let r = 1; r < rows - 1; r++) {
        grid.put(x, row + r, ["│", ..."░".repeat(inner), "│"].slice(0, w));
      }
      grid.put(x, row + rows - 1, [bl, ..."─".repeat(inner), br].slice(0, w));
    },
  };
}

function layoutStack(node, pw, ph, m) {
  const pad = node.padding;
  const padLeft = m.x(pad.left);
  const padRight = m.x(pad.right);
  const fixedW = node.size && node.size.width > 0 ? Math.max(1, m.x(node.size.width)) : null;
  const fixedPt = node.size && node.size.height > 0 ? node.size.height : null;
  const innerW = (fixedW ?? pw) - padLeft - padRight;
  const innerPh = (fixedPt ?? ph) - pad.top - pad.bottom;

  const content =
    node.direction === "horizontal"
      ? layoutRow(node, innerW, innerPh, m)
      : layoutColumn(node, innerW, innerPh, m);

  const w = fixedW ?? content.w + padLeft + padRight;
  const pt = fixedPt ?? content.pt + pad.top + pad.bottom;
  const offset = m.y(pad.top);
  const rows = Math.max(
    offset + content.rows + m.y(pad.bottom),
    fixedPt ? Math.max(1, m.y(fixedPt)) : 0,
  );

  return {
    w,
    pt,
    rows,
    draw(grid, x, row) {
      if (node.backgroundColor) drawSurface(grid, x, row, w, rows, node.children.length === 0);
      content.draw(grid, x + padLeft, row + offset);
    },
  };
}

// A filled stack: color dot, hairline, `[tag]` capsule, or a rounded card.
function drawSurface(grid, x, row, w, rows, empty) {
  if (empty) {
    grid.put(x, row, rows === 1 && w <= 2 ? ["●"] : chars("─".repeat(Math.max(1, w))));
    return;
  }
  if (rows === 1) {
    grid.put(x, row, ["["]);
    grid.put(x + w - 1, row, ["]"]);
    return;
  }
  grid.put(x, row, ["╭", ..."─".repeat(w - 2), "╮"]);
  for (let r = 1; r < rows - 1; r++) {
    grid.put(x, row + r, ["│"]);
    grid.put(x + w - 1, row + r, ["│"]);
  }
  grid.put(x, row + rows - 1, ["╰", ..."─".repeat(w - 2), "╯"]);
}

function layoutNode(node, pw, ph, m) {
  if (node.kind === "text") return layoutText(node, pw, m);
  if (node.kind === "image") return layoutImage(node, m);
  if (node.kind === "stack") return layoutStack(node, pw, ph, m);
  return EMPTY;
}

function layoutRow(node, innerW, innerPh, m) {
  const kids = node.children;
  const boxes = new Array(kids.length);
  let remaining = innerW;

  kids.forEach((kid, i) => {
    if (kid.kind === "spacer" && kid.length != null) {
      boxes[i] = { ...EMPTY, w: m.x(kid.length) };
    } else if (kid.kind === "image" || (kid.kind === "stack" && kid.size && kid.size.width > 0)) {
      boxes[i] = layoutNode(kid, innerW, innerPh, m);
    }
    if (boxes[i]) remaining -= boxes[i].w;
  });

  // Offer what's left to the compressible children, least flexible first.
  const flexible = kids
    .map((kid, i) => i)
    .filter((i) => !boxes[i] && !isFlexSpacer(kids[i]))
    .map((i) => ({
      i,
      key: greedyW(kids[i]) ? Infinity : layoutNode(kids[i], Infinity, innerPh, m).w,
    }))
    .sort((a, b) => a.key - b.key);

  flexible.forEach(({ i }, n) => {
    const offer = Math.max(0, Math.floor(remaining / (flexible.length - n)));
    boxes[i] = layoutNode(kids[i], offer, innerPh, m);
    remaining -= boxes[i].w;
  });

  const spacers = kids.map((kid, i) => i).filter((i) => isFlexSpacer(kids[i]));
  const share = Number.isFinite(innerW) ? Math.max(0, remaining) : 0;
  spacers.forEach((i, n) => {
    const each = Math.floor(share / spacers.length) + (n < share % spacers.length ? 1 : 0);
    boxes[i] = { ...EMPTY, w: each };
  });

  const expands = Number.isFinite(innerW) && (spacers.length > 0 || kids.some(greedyW));
  const used = boxes.reduce((sum, b) => sum + b.w, 0);
  const w = expands ? Math.max(innerW, used) : used;
  const fills = greedyH(node) && Number.isFinite(innerPh);
  const pt = Math.max(fills ? innerPh : 0, ...boxes.map((b) => b.pt));
  const rows = Math.max(fills ? m.y(innerPh) : 0, ...boxes.map((b) => b.rows));

  return {
    w,
    pt,
    rows,
    draw(grid, x, row) {
      let cx = x;
      boxes.forEach((box) => {
        const dy =
          node.align === "center"
            ? Math.floor((rows - box.rows) / 2)
            : node.align === "end"
              ? rows - box.rows
              : 0;
        box.draw(grid, cx, row + dy);
        cx += box.w;
      });
    },
  };
}

function layoutColumn(node, innerW, innerPh, m) {
  const kids = node.children;
  const boxes = kids.map((kid) =>
    kid.kind === "spacer"
      ? { ...EMPTY, pt: kid.length ?? 0 }
      : layoutNode(kid, innerW, Infinity, m),
  );

  // Hand any spare height to flexible spacers and vertically greedy stacks.
  const greedy = kids.map((kid, i) => i).filter((i) => isFlexSpacer(kids[i]) || greedyH(kids[i]));
  if (Number.isFinite(innerPh) && greedy.length > 0) {
    const spare = Math.max(0, innerPh - boxes.reduce((sum, b) => sum + b.pt, 0));
    greedy.forEach((i) => {
      boxes[i] = isFlexSpacer(kids[i])
        ? { ...EMPTY, pt: spare / greedy.length }
        : layoutNode(kids[i], innerW, boxes[i].pt + spare / greedy.length, m);
    });
  }

  // Place each box at the row its point offset rounds to, but never on top of
  // the previous box: small text lines are shorter than a row, so they push.
  let cursor = 0;
  let y = 0;
  const placed = boxes.map((box) => {
    const row = Math.max(m.y(y), cursor);
    if (box.rows > 0) cursor = row + box.rows;
    y += box.pt;
    return row;
  });

  const widest = Math.max(0, ...boxes.map((b) => b.w));
  const w = greedyW(node) && Number.isFinite(innerW) ? Math.max(innerW, widest) : widest;

  return {
    w,
    pt: y,
    rows: Math.max(cursor, m.y(y)),
    draw(grid, x, row) {
      boxes.forEach((box, i) => {
        const dx = node.align === "center" ? Math.floor((w - box.w) / 2) : 0;
        box.draw(grid, x + dx, row + placed[i]);
      });
    },
  };
}

// --- Rasterizing ----------------------------------------------------------

// Rows grow on demand so nothing the grid can't fit is silently lost; columns
// clip at the widget edge.
class Grid {
  constructor(cols, rows) {
    this.cols = cols;
    this.cells = Array.from({ length: rows }, () => new Array(cols).fill(" "));
  }
  put(x, y, cells) {
    while (this.cells.length <= y) this.cells.push(new Array(this.cols).fill(" "));
    cells.forEach((cell, i) => {
      const cx = x + i;
      if (y >= 0 && cx >= 0 && cx < this.cols) this.cells[y][cx] = cell;
    });
  }
}

function rasterize(widget, family) {
  const m = metrics(family);
  const canvas = CONFIG.widgetCanvas[family];
  const grid = new Grid(m.cols, m.rows);
  const root = layoutStack(widget, m.cols, canvas.height, m);

  // A ListWidget centers its content vertically when it doesn't fill.
  const slack = Math.max(0, m.rows - root.rows);
  const dy = greedyH(widget) ? 0 : Math.min(slack, m.y((canvas.height - root.pt) / 2));
  root.draw(grid, 0, Math.max(0, dy));

  // Rows past the canvas (grid rounding ran over) get dashed sides.
  const top = `╭${"─".repeat(m.cols)}╮`;
  const bottom = `╰${"─".repeat(m.cols)}╯`;
  const body = grid.cells.map((row, r) => {
    const side = r < m.rows ? "│" : "┆";
    return `${side}${row.join("")}${side}`;
  });
  return { lines: [top, ...body, bottom], width: m.cols + 2 };
}

// --- Rendering sources ----------------------------------------------------

function renderSource(sourceName, family) {
  const sizes = CONFIG.sizing[family];
  const source = DataSourceFactory.create(sourceName, null);
  const widget = new ListWidget();
  widget.setPadding(sizes.padding, sizes.padding, sizes.padding, sizes.padding);
  source.renderWidget(widget, FIXTURES[sourceName].data, family);
  return widget;
}

function renderError(family) {
  return createErrorWidget("Request timed out", family, "billboard");
}

function preview(widget, family) {
  const canvas = CONFIG.widgetCanvas[family];
  const art = rasterize(widget, family);
  const needed = Math.round(minHeight(widget));
  const over = needed - canvas.height;
  const caption = [
    `${family} ${canvas.width}×${canvas.height}pt`,
    over > 0 ? `✂ needs ${needed}pt (+${over})` : `fits ${needed}/${canvas.height}pt`,
  ];
  return { ...art, caption: caption.join(" · ") };
}

// Lay previews out side by side, top-aligned.
function sideBySide(previews, gap = 3) {
  const widths = previews.map((p) => Math.max(p.width, chars(p.caption).length));
  const height = Math.max(...previews.map((p) => p.lines.length)) + 1;
  const out = [];
  for (let r = 0; r < height; r++) {
    const row = previews.map((p, i) => {
      const text = r === 0 ? p.caption : p.lines[r - 1] || "";
      return text + " ".repeat(widths[i] - chars(text).length);
    });
    out.push(row.join(" ".repeat(gap)).trimEnd());
  }
  return out.join("\n");
}

const ROWS = [["small", "medium"], ["large"], ["extraLarge"]];

function section(title, render, families) {
  const blocks = ROWS.map((row) => row.filter((f) => families.includes(f)))
    .filter((row) => row.length > 0)
    .map((row) => sideBySide(row.map((family) => preview(render(family), family))));
  return `## ${title}\n\n\`\`\`text\n${blocks.join("\n\n")}\n\`\`\`\n`;
}

const LEGEND = `| Glyph | Meaning |
| --- | --- |
| \`╭──╮\` \`│░░│\` | Image (cover, poster, avatar); \`▐▒▌\` or \`◉\` (circular) when it is one row tall |
| \`[Tag]\` | Tag/badge (filled capsule); \`●\` is a color dot |
| \`↑\` \`↓\` \`–\` \`★\` | Trend up / down / unchanged / new or rating |
| \`⊘\` | Offline (serving from cache) |
| \`◆\` | Any other SF Symbol (header icons, source badges) |
| \`┆\` | Row the grid needed beyond the canvas (rounding, not necessarily real overflow) |`;

function main() {
  const args = process.argv.slice(2);
  const families = args.filter((a) => FAMILIES.includes(a));
  const names = args.filter((a) => !FAMILIES.includes(a));
  const allSources = Object.keys(FIXTURES);
  const unknown = names.filter((n) => !allSources.includes(n) && n !== "error");
  if (unknown.length) {
    console.error(`Unknown source(s): ${unknown.join(", ")}`);
    console.error(`Known: ${[...allSources, "error"].join(", ")}`);
    process.exit(1);
  }

  const pickedFamilies = families.length ? families : FAMILIES;
  const pickedSources = names.length ? names : [...allSources, "error"];
  const sections = pickedSources.map((name) =>
    name === "error"
      ? section("error widget", renderError, pickedFamilies)
      : section(name, (family) => renderSource(name, family), pickedFamilies),
  );

  if (args.length) {
    process.stdout.write(sections.join("\n"));
    return;
  }

  const doc = `# Widget previews

<!-- Generated by \`npm run preview\` (scripts/preview.js). Do not edit by hand. -->

Every source at every widget family, rendered by the real \`renderWidget()\` code against \`test/fixtures.js\` and laid out on a character grid. To iterate on a design, change the code, run \`npm run preview\`, and diff this file. \`npm run preview -- <source> [family]\` prints just those previews instead.

The grid is approximate. One cell is about half the family's secondary font size wide, larger text takes proportionally more cells, and every text line takes one row whatever its font size, so spacing smaller than about half a row disappears. The \`fits\` / \`✂\` caption comes from the point-based model in \`test/overflow.test.js\` and is the number to trust. The clock is frozen at 09:41 on 2026-09-12 so the file only changes when the design does.

${LEGEND}

${sections.join("\n")}`;
  fs.writeFileSync(OUTPUT, doc);
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}`);
}

main();
