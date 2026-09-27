// Sets (or clears) a game's nightly-drop override from GitHub Actions, using the
// service-account key, so the host does not have to open the site to do it.
//   node scripts/set-override.mjs <game|babies> <YYYY-MM-DD poll day> <roundId|clear>
// The round named drops at midnight New York time at the end of that poll day.
import admin from "firebase-admin";
const [game, day, roundId] = process.argv.slice(2);
if (!game || !/^\d{4}-\d{2}-\d{2}$/.test(day || "") || !roundId) { console.error("usage: set-override.mjs <game|babies> <YYYY-MM-DD> <roundId|clear>"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();
const root = game === "babies" ? db : db.collection("games").doc(game);
if (roundId !== "clear") {
  const r = await root.collection("rounds").doc(roundId).get();
  if (!r.exists) { console.error(`::error::round "${roundId}" is not published for ${game}`); process.exit(1); }
  if (!r.data().draft) console.log(`note: "${roundId}" is not a draft, so it is already live; the override will have no effect`);
}
const ref = root.collection("site").doc("config");
const snap = await ref.get(); const cur = (snap.exists && snap.data().overrides) || {};
const next = { ...cur }; if (roundId === "clear") delete next[day]; else next[day] = roundId;
await ref.set({ overrides: next }, { merge: true });
console.log(`${game}: overrides now ${JSON.stringify(next)}`);
