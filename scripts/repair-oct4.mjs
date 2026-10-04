// One-off repair for 4 Oct 2026. An automatic "guard" in the Queue status report, fed by a wrong drop plan,
// rewrote the `added` date of twenty already-dropped rounds, put them all in site/config.liveRounds (which
// takes them out of the drop replay and so erased the real history), and created two empty round documents
// for built-in rounds. This puts the dates back to each file's first publish time (from the repository
// history), removes the twenty from liveRounds, and deletes the two empty documents.
//   node scripts/repair-oct4.mjs <game|babies>
import admin from "firebase-admin";
const game = process.argv[2];
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();
const root = game === "babies" ? db : db.collection("games").doc(game);
const plus = (iso, s) => new Date(Date.parse(iso) + s * 1000).toISOString();
// first publish: commit time + about 45 s for the workflow, files in one commit a second apart in name order
const ADDED = {
  babies: {
    "console-wars": plus("2026-09-21T12:18:31Z", 45), "summer-blockbusters": plus("2026-09-21T12:18:31Z", 47),
    "extra-time": plus("2026-09-22T10:13:24Z", 45), "where-on-earth": plus("2026-09-22T10:13:24Z", 46),
    "founding-years": plus("2026-09-24T13:19:09Z", 45), "wild-things": plus("2026-09-24T13:19:09Z", 46),
    "toy-box": plus("2026-09-26T13:18:41Z", 45), "between-the-sheets": plus("2026-09-28T01:24:17Z", 45),
    "cape-and-cowl": plus("2026-09-30T13:18:35Z", 45), "curtain-up": plus("2026-10-01T13:18:55Z", 45), "force-of-nature": plus("2026-10-03T13:18:29Z", 45),
  },
  hamps: {
    "binge-worthy": plus("2026-09-25T23:06:02Z", 45), "crowned-heads": plus("2026-09-25T23:06:02Z", 47), "eureka": plus("2026-09-25T23:06:02Z", 48),
    "game-on": plus("2026-09-25T23:06:02Z", 49), "say-what": plus("2026-09-25T23:06:02Z", 53),
    "gods-and-monsters": plus("2026-09-26T13:18:41Z", 45), "art-attack": plus("2026-09-27T13:17:11Z", 45),
    "east-hampton": plus("2026-09-27T14:11:21Z", 45), "by-the-numbers": plus("2026-10-03T13:18:29Z", 45),
  },
};
const STUBS = { babies: ["plate-to-place", "one-hit-wonders"], hamps: [] };
const fixes = ADDED[game] || {};
for (const [id, added] of Object.entries(fixes)) {
  const ref = root.collection("rounds").doc(id); const snap = await ref.get();
  if (!snap.exists) { console.log(`${id}: no document, skipped`); continue; }
  console.log(`${id}: added ${snap.data().added} -> ${added}`);
  await ref.set({ added }, { merge: true });
}
for (const id of STUBS[game] || []) {
  const ref = root.collection("rounds").doc(id); const snap = await ref.get();
  if (snap.exists && !(Array.isArray(snap.data().questions) && snap.data().questions.length)) { await ref.delete(); console.log(`${id}: empty document deleted (the built-in round stands)`); }
  else console.log(`${id}: ${snap.exists ? "has questions, left alone" : "no document"}`);
}
const cref = root.collection("site").doc("config"); const c = await cref.get(); const cur = Array.isArray((c.data() || {}).liveRounds) ? c.data().liveRounds : [];
const remove = new Set([...Object.keys(fixes), ...(STUBS[game] || [])]);
const next = cur.filter(id => !remove.has(id));
await cref.set({ liveRounds: next }, { merge: true });
console.log(`${game}: liveRounds ${JSON.stringify(cur)} -> ${JSON.stringify(next)}`);
