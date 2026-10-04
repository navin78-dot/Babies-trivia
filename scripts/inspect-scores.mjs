// Read-only: who has a saved run on which round, for one game. Names shortened.
//   node scripts/inspect-scores.mjs <game|babies> [roundId ...]
import admin from "firebase-admin";
const [game, ...only] = process.argv.slice(2);
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();
const root = game === "babies" ? db : db.collection("games").doc(game);
const snap = await root.collection("scores").get();
const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
const short = s => `${(s.name || "?").split(" ")[0]} …${(s.uid || "").slice(-4)}`;
const byRound = {};
for (const s of rows) (byRound[s.roundId] = byRound[s.roundId] || []).push(s);
for (const [rid, list] of Object.entries(byRound).sort()) {
  if (only.length && !only.includes(rid)) continue;
  console.log(`${rid}: ${list.length} run(s)`);
  for (const s of list.sort((a, b) => (a.finishedAt || "").localeCompare(b.finishedAt || ""))) console.log(`   ${short(s)} ${s.score}/${s.total} at ${s.finishedAt || "?"}${s.timedOut ? " (timed out)" : ""}`);
}
console.log(`total ${rows.length} runs across ${Object.keys(byRound).length} rounds`);
