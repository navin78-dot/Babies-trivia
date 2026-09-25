// Builds a sister site from the one source file.
//
//   node scripts/build-site.mjs <game-id> [out-dir]     e.g. node scripts/build-site.mjs hamps dist/hamps
//
// Reads index.html and games/<game-id>.json, swaps the GAME block, the tab title,
// the description, the wordmark, the big title and the palette, and writes
// <out-dir>/index.html. Everything else is byte-for-byte the original game, so a
// feature shipped once ships everywhere. Every replacement must match exactly
// once; if the source drifts, this fails loudly instead of shipping a mixed page.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const [id, out = `dist/${process.argv[2]}`] = process.argv.slice(2);
if (!id) { console.error("usage: node scripts/build-site.mjs <game-id> [out-dir]"); process.exit(1); }
const game = JSON.parse(readFileSync(`games/${id}.json`, "utf8"));
if (game.id !== id) throw new Error(`games/${id}.json has id "${game.id}"`);
for (const k of ["name", "plainName", "wordmarkHtml", "titleHtml", "fileSlug"]) if (!game[k]) throw new Error(`games/${id}.json is missing "${k}"`);

let html = readFileSync("index.html", "utf8");
const escAttr = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function once(re, replacement, what){
  const all = html.match(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g")) || [];
  if (all.length !== 1) throw new Error(`${what}: expected exactly one match in index.html, found ${all.length}`);
  html = html.replace(re, replacement);
}

// 1. The GAME block: only what the page needs at runtime.
const client = { id: game.id, name: game.name, plainName: game.plainName, wordmarkHtml: game.wordmarkHtml, titleHtml: game.titleHtml,
  fileSlug: game.fileSlug, eyebrow: game.eyebrow || "Trivia for friends", settings: game.settings || {} };
const block = JSON.stringify(client, null, 2);
if (/<\/script|<!--/i.test(block)) throw new Error("game config contains text that would break the script tag");
once(/\/\* GAME-CONFIG-START \*\/[\s\S]*?\/\* GAME-CONFIG-END \*\//, () => `/* GAME-CONFIG-START */\nconst GAME = ${block};\n/* GAME-CONFIG-END */`, "GAME block");

// 1b. A sister game has none of the original game's built-in rounds (people who play both must not have seen the questions).
once(/\/\* BUILTIN-ROUNDS-START \*\/[\s\S]*?\/\* BUILTIN-ROUNDS-END \*\//, () => "/* BUILTIN-ROUNDS-START */\nlet ROUNDS = [];\n/* BUILTIN-ROUNDS-END */", "built-in rounds");

// 2. Head: title, description, palette and fonts.
once(/<title>[^<]*<\/title>/, () => `<title>${escAttr(game.plainName)}</title>`, "title");
if (game.description) once(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${escAttr(game.description)}">`, "description");
const theme = game.theme || {};
const fonts = theme.fonts ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${theme.fonts}&display=swap">\n` : "";
const css = Array.isArray(theme.css) ? theme.css.join("\n") : (theme.css || "");
once(/<style id="game-theme"><\/style>/, () => `${fonts}<style id="game-theme">\n${css}\n</style>`, "theme slot");

// 3. Static markup that shows before the script runs: the wordmark and the big title.
once(/(<button class="wordmark" id="home"[^>]*aria-label=")[^"]*("[^>]*>)[\s\S]*?(<\/button>)/,
  (m, a, b, c) => `${a}${escAttr(game.name)}, back to the homepage${b}${game.wordmarkHtml}${c}`, "wordmark");
once(/(<h1 id="roundName" class="site">)[\s\S]*?(<\/h1>)/, (m, a, b) => `${a}<span class="sr">${escAttr(game.name)}</span>${b}`, "big title");

mkdirSync(out, { recursive: true });
writeFileSync(`${out}/index.html`, html);
console.log(`built ${out}/index.html for "${game.name}" (${html.length} bytes)`);
