// Reports the nightly-drop queue for every game: which written rounds are still
// waiting, what is on tonight's poll, and which theme requests a host has queued.
// Runs in GitHub Actions with the service-account key, and reuses the exact drop
// logic from index.html so the answer matches what every phone works out.
//
// The rounds are shared, so one new round file lengthens every game's queue. The
// top level of the report is the original game plus the numbers that matter for
// the daily top-up across all games: `fill` is the biggest shortfall of any game,
// `requestsWaiting` lists every game's open requests (a sister game's id is
// prefixed, "hamps:abc", and goes into the round file's requestId as is), and
// `need` is fill + requests. Each sister game has its own block under `games`.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import admin from "firebase-admin";

const TARGET = 5;
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();

const html = readFileSync("index.html", "utf8");
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error("marker not found: " + a); return html.slice(i, j); };
const settings = html.match(/const SETTINGS = \{[\s\S]*?\n\};/)[0];
const code = settings
  + "\nObject.entries(OVERRIDES || {}).forEach(([k, v]) => { SETTINGS[k] = v && typeof v === 'object' && !Array.isArray(v) ? Object.assign({}, SETTINGS[k], v) : v; });\n"
  + slice("const SEASON = SETTINGS.season;", "const SEASON_KEY") + slice("const myVote = day =>", "async function castVote(id){")
  + "\nreturn { dropPlan, seasonOf, currentSeason, addedMs };";

// rounds baked into index.html count too (the plan needs the whole list)
const builtin = [...html.matchAll(/\n    id: "([a-z0-9-]+)",\n    added: "([^"]+)",\n    name: "([^"]+)",\n    subject: "([^"]*)",/g)]
  .map(m => { const head = html.slice(m.index, html.indexOf("questions: [", m.index)); return { id: m[1], added: m[2], name: m[3], subject: m[4], draft: /\n    draft: true,/.test(head), questions: [] }; });
const roundsSnap = await db.collection("rounds").get();
const dbRounds = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const ROUNDS = builtin.filter(b => !dbRounds.some(r => r.id === b.id)).concat(dbRounds);
const name = id => (ROUNDS.find(r => r.id === id) || {}).name || id;

const games = [{ id: "", settings: {} }];
if (existsSync("games")) for (const f of readdirSync("games").filter(f => f.endsWith(".json"))) games.push(JSON.parse(readFileSync(`games/${f}`, "utf8")));

async function report(game){
  const root = game.id ? db.collection("games").doc(game.id) : db;
  const [cfgSnap, votesSnap, reqSnap] = await Promise.all([root.collection("site").doc("config").get(), root.collection("votes").get(), root.collection("requests").get()]);
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const env = { ROUNDS, liveIds: new Set(Array.isArray(cfg.liveRounds) ? cfg.liveRounds : []), siteCfg: cfg, votes: votesSnap.docs.map(d => d.data()), me: null, OVERRIDES: game.settings || {} };
  const { dropPlan, currentSeason } = new Function(...Object.keys(env), code)(...Object.values(env));
  const P = dropPlan();
  const waiting = reqSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => (r.status || "waiting") === "waiting");
  return {
    today: P.today, season: currentSeason(),
    queueCount: P.queue.length, target: TARGET, fill: Math.max(0, TARGET - P.queue.length),
    queue: P.queue.map(r => ({ id: r.id, name: r.name, subject: r.subject || "", onPollSince: P.first[r.id] || null, retired: P.retired.has(r.id) })),
    tonightsPoll: P.options.map(r => r.id), override: P.ov || null,
    dropped: P.history.map(x => ({ day: x.day, id: x.id, name: name(x.id), how: x.how })),
    requestsWaiting: waiting.map(r => ({ id: game.id ? `${game.id}:${r.id}` : r.id, theme: r.theme, game: game.id || "babies" })),
  };
}

const [main, ...sisters] = await Promise.all(games.map(report));
const out = { ...main, games: {} };
for (const [i, g] of sisters.entries()) out.games[games[i + 1].id] = g;
out.fill = Math.max(main.fill, ...sisters.map(g => g.fill));
out.requestsWaiting = main.requestsWaiting.concat(...sisters.map(g => g.requestsWaiting));
out.existingSubjects = ROUNDS.map(r => `${r.name} (${r.subject || ""})`);
out.need = out.fill + out.requestsWaiting.length; // a host request is always written, even with a full queue
const json = JSON.stringify(out, null, 2);
writeFileSync("queue-status.json", json);
console.log("QUEUE_STATUS_BEGIN\n" + json + "\nQUEUE_STATUS_END");
