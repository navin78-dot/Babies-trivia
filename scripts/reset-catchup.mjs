// Clears the "catch-up card seen" mark on a game's profiles so the one-time card
// shows again on the next visit. Runs from the Host tools workflow.
//   node scripts/reset-catchup.mjs <game|babies> <all | last characters of a uid>
import admin from "firebase-admin";
const [game, who] = process.argv.slice(2);
if (!game || !who) { console.error("usage: reset-catchup.mjs <game|babies> <all|uid suffix>"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();
const root = game === "babies" ? db : db.collection("games").doc(game);
const snap = await root.collection("profiles").get();
const hit = snap.docs.filter(d => d.data().catchupSeen && (who === "all" || d.id.endsWith(who)));
if (!hit.length) { console.log(`${game}: no profile matching "${who}" has the card marked as seen; nothing to do`); process.exit(0); }
for (const d of hit) { await d.ref.set({ catchupSeen: admin.firestore.FieldValue.delete() }, { merge: true }); console.log(`${game}: cleared for …${d.id.slice(-4)} (${(d.data().name || "?").split(" ")[0]})`); }
