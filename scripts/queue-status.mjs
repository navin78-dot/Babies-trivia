// Reports the drop queue for every game: which written rounds are still waiting,
// what is on the poll now, which theme ideas have won a poll and must be written
// before their drop day, and recent drops. Runs in GitHub Actions with the
// service-account key, and reuses the exact drop logic from index.html so the
// answer matches what every phone works out.
//
// Every game has its own question bank and its own queue (people who play two
// games must not meet the same questions twice). The top level of the report is
// the original game, whose round files live in rounds/. Each sister game has the
// same block under `games.<id>`, with `roundsDir` saying where its files go and
// `requestsWaiting` ids prefixed with the game id ("hamps:abc"), to be copied
// into the round file's requestId as is. `totalNeed` adds up every game's need.
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
  + "\nconst firstPlayMs = r => { let t = Infinity; for (const s of scores) if (s.roundId === r.id) { const v = Date.parse(s.finishedAt || ''); if (v && v < t) t = v; } return t; }; const playedBy = r => firstPlayMs(r) < Infinity;\n" // defined in index.html outside the slice below
  + slice("const SEASON = SETTINGS.season;", "const SEASON_KEY") + slice("const myVote = day =>", "async function castVote(id){")
  + "\nconst roundById = id => ROUNDS.find(r => r.id === id) || null;\nreturn { dropPlan, seasonOf, currentSeason, addedMs };";

// rounds baked into index.html belong to the original game only
const builtin = [...html.matchAll(/\n    id: "([a-z0-9-]+)",\n    added: "([^"]+)",\n    name: "([^"]+)",\n    subject: "([^"]*)",/g)]
  .map(m => { const head = html.slice(m.index, html.indexOf("questions: [", m.index)); return { id: m[1], added: m[2], name: m[3], subject: m[4], draft: /\n    draft: true,/.test(head), questions: [] }; });

const games = [{ id: "", settings: {}, roundsDir: "rounds" }];
if (existsSync("games")) for (const f of readdirSync("games").filter(f => f.endsWith(".json"))) { const g = JSON.parse(readFileSync(`games/${f}`, "utf8")); games.push({ ...g, roundsDir: `games/${g.id}/rounds` }); }

async function report(game){
  const root = game.id ? db.collection("games").doc(game.id) : db;
  const [roundsSnap, cfgSnap, votesSnap, reqSnap, scoresSnap] = await Promise.all([root.collection("rounds").get(), root.collection("site").doc("config").get(), root.collection("votes").get(), root.collection("requests").get(), root.collection("scores").get()]);
  const dbRounds = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => Array.isArray(r.questions) && r.questions.length); // the page ignores a document without questions too
  const ROUNDS = (game.id ? [] : builtin.filter(b => !dbRounds.some(r => r.id === b.id))).concat(dbRounds);
  const name = id => (ROUNDS.find(r => r.id === id) || {}).name || id;
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const env = { ROUNDS, liveIds: new Set(Array.isArray(cfg.liveRounds) ? cfg.liveRounds : []), siteCfg: cfg, votes: votesSnap.docs.map(d => d.data()), requests, scores: scoresSnap.docs.map(d => d.data()), me: null, isHost: false, OVERRIDES: game.settings || {} };
  const { dropPlan, currentSeason } = new Function(...Object.keys(env), code)(...Object.values(env));
  const P = dropPlan();
  // Guard: a round that anyone has already played must stay visible. The page enforces this itself (a played round
  // counts as published); the report only checks and shouts, it never writes, because a wrong plan once made an
  // automatic version of this check "heal" twenty rounds that were fine and rewrite their dates.
  const dropped = new Set(P.history.map(x => x.id));
  for (const r of ROUNDS) if (r.draft && !env.liveIds.has(r.id) && !dropped.has(r.id) && env.scores.some(s => s.roundId === r.id))
    console.log(`::warning::${game.id || "babies"}: "${r.name}" has saved runs but the drop plan does not list it as dropped; the page shows it anyway (played rounds are always visible). If it should be a proper round for a day, use the make-live host tool.`);
  // themes that won a poll and have no round file yet: each must be written before its drop day
  const waiting = P.needsWriting.map(x => ({ id: game.id ? `${game.id}:${x.reqId}` : x.reqId, theme: x.req.theme, by: x.req.name || "", dropDay: x.day }));
  const fill = Math.max(0, TARGET - P.queue.length);
  return {
    game: game.id || "babies", roundsDir: game.roundsDir,
    today: P.today, season: currentSeason(),
    queueCount: P.queue.length, target: TARGET, fill,
    queue: P.queue.map(r => ({ id: r.id, name: r.name, subject: r.subject || "", onPollSince: P.first[r.id] || null, retired: P.retired.has(r.id), requestId: r.requestId || null })),
    poll: { key: P.pollKey, closes: P.closes, decides: P.decides, options: P.options.map(o => o.kind === "theme" ? { id: o.id, theme: o.name, by: o.by } : { id: o.id }) },
    upcoming: P.upcoming.map(u => ({ day: u.day, id: u.plan ? u.plan.id : null, name: u.plan && !u.plan.id.startsWith("req:") ? name(u.plan.id) : null, how: u.plan ? u.plan.how : "nothing" })),
    dropped: P.history.map(x => ({ day: x.day, id: x.id, name: name(x.id), how: x.how })),
    requestsWaiting: waiting,
    ideas: requests.filter(x => (x.status || "waiting") === "waiting" && !P.retired.has("req:" + x.id)).map(x => ({ id: x.id, theme: x.theme, by: x.name || "" })),
    existingSubjects: ROUNDS.map(r => `${r.name} (${r.subject || ""})`),
    need: fill + waiting.length, // a won theme is always written, even with a full queue
  };
}

const [main, ...sisters] = await Promise.all(games.map(report));
const out = { ...main, games: {} };
for (const [i, g] of sisters.entries()) out.games[games[i + 1].id] = g;
out.totalNeed = main.need + sisters.reduce((n, g) => n + g.need, 0);
const json = JSON.stringify(out, null, 2);
writeFileSync("queue-status.json", json);
console.log("QUEUE_STATUS_BEGIN\n" + json + "\nQUEUE_STATUS_END");
