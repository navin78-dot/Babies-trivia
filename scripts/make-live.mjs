// Makes a waiting round live right now, outside the drop schedule, keeping every run already
// saved on it. Adds the round to site/config.liveRounds and, when a timestamp is given, sets
// the round's `added` to it so it sits in the right season and day (a round promoted this way
// otherwise keeps the day its file was first published, which may be a past season, and a
// past-season round is closed to play).
//   node scripts/make-live.mjs <game|babies> <roundId> [addedISO]
import admin from "firebase-admin";
const [game, roundId, added] = process.argv.slice(2);
if (!game || !roundId) { console.error("usage: make-live.mjs <game|babies> <roundId> [addedISO]"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();
const root = game === "babies" ? db : db.collection("games").doc(game);
const rref = root.collection("rounds").doc(roundId); const r = await rref.get();
if (!r.exists) { console.error(`::error::round "${roundId}" is not published for ${game}`); process.exit(1); }
if (added) { if (Number.isNaN(Date.parse(added))) { console.error("::error::added must be an ISO timestamp"); process.exit(1); } await rref.set({ added }, { merge: true }); console.log(`${game}/${roundId}: added set to ${added}`); }
const cref = root.collection("site").doc("config"); const c = await cref.get();
const live = new Set(Array.isArray((c.data() || {}).liveRounds) ? c.data().liveRounds : []); live.add(roundId);
await cref.set({ liveRounds: [...live] }, { merge: true });
const scores = await root.collection("scores").where("roundId", "==", roundId).get();
console.log(`${game}: liveRounds now ${JSON.stringify([...live])}; ${roundId} is live with ${scores.size} saved run(s) showing`);
