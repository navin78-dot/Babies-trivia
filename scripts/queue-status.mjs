// Reports the nightly-drop queue: which written rounds are still waiting, what is on
// tonight's poll, and which theme requests the host has queued. Runs in GitHub Actions
// with the service-account key, and reuses the exact drop logic from index.html so the
// answer matches what every phone works out.
import { readFileSync, writeFileSync } from "node:fs";
import admin from "firebase-admin";

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();
const [roundsSnap, cfgSnap, votesSnap, reqSnap] = await Promise.all([
  db.collection("rounds").get(), db.collection("site").doc("config").get(), db.collection("votes").get(), db.collection("requests").get(),
]);
const html = readFileSync("index.html", "utf8");
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error("marker not found: " + a); return html.slice(i, j); };
const settings = html.match(/const SETTINGS = \{[\s\S]*?\n\};/)[0];
const code = settings + "\n" + slice("const SEASON = SETTINGS.season;", "const SEASON_KEY") + slice("const myVote = day =>", "async function castVote(id){")
  + "\nreturn { dropPlan, seasonOf, currentSeason, addedMs };";
// rounds baked into index.html count too (they are never drafts, but the plan needs the list)
const builtin = [...html.matchAll(/\n    id: "([a-z0-9-]+)",\n    added: "([^"]+)",\n    name: "([^"]+)",\n    subject: "([^"]*)",/g)]
  .map(m => { const head = html.slice(m.index, html.indexOf("questions: [", m.index)); return { id: m[1], added: m[2], name: m[3], subject: m[4], draft: /\n    draft: true,/.test(head), questions: [] }; });
const dbRounds = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const ROUNDS = builtin.filter(b => !dbRounds.some(r => r.id === b.id)).concat(dbRounds);
const cfg = cfgSnap.exists ? cfgSnap.data() : {};
const env = { ROUNDS, liveIds: new Set(Array.isArray(cfg.liveRounds) ? cfg.liveRounds : []), siteCfg: cfg, votes: votesSnap.docs.map(d => d.data()), me: null };
const fn = new Function(...Object.keys(env), code);
const { dropPlan, seasonOf, currentSeason } = fn(...Object.values(env));
const P = dropPlan();
const name = id => (ROUNDS.find(r => r.id === id) || {}).name || id;
const out = {
  today: P.today, season: currentSeason(),
  queueCount: P.queue.length, target: 5, need: Math.max(0, 5 - P.queue.length),
  queue: P.queue.map(r => ({ id: r.id, name: r.name, subject: r.subject || "", onPollSince: P.first[r.id] || null, retired: P.retired.has(r.id) })),
  tonightsPoll: P.options.map(r => r.id), override: P.ov || null,
  dropped: P.history.map(x => ({ day: x.day, id: x.id, name: name(x.id), how: x.how })),
  requestsWaiting: reqSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => (r.status || "waiting") === "waiting").map(r => ({ id: r.id, theme: r.theme })),
  existingSubjects: ROUNDS.map(r => `${r.name} (${r.subject || ""})`),
};
const json = JSON.stringify(out, null, 2);
writeFileSync("queue-status.json", json);
console.log("QUEUE_STATUS_BEGIN\n" + json + "\nQUEUE_STATUS_END");
