// Upserts every rounds/*.json file into the Firestore "rounds" collection.
// Runs in GitHub Actions with GOOGLE_APPLICATION_CREDENTIALS pointing at the
// service-account key. Adding a quiz is a JSON commit, not a site deploy.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import admin from "firebase-admin";

const dir = "rounds";
const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".json")) : [];
const hasPoll = existsSync("poll.json");
if (!files.length && !hasPoll) { console.log("Nothing to publish."); process.exit(0); }

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();

for (const f of files) {
  const data = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  if (!data.id) throw new Error(`${f} is missing an "id" field`);
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error(`${f} has no questions`);
  const n = data.questions.length, c = { easy: 0, medium: 0, hard: 0 };
  data.questions.forEach(q => { if (c[q.d] != null) c[q.d]++; });
  const min = Math.max(2, Math.ceil(n * 0.2));
  const special = data.questions.filter(q => (q.type || "mc") !== "mc" || (q.o && q.o.length === 2)).length;
  if (n < 6 || c.easy < min || c.medium < min || c.hard < min) throw new Error(`${f} breaks the house rule: ${n} questions, ${c.easy}/${c.medium}/${c.hard} easy/medium/hard (need at least ${min} each)`);
  if (special > 3) throw new Error(`${f} has ${special} non-multiple-choice questions; the cap is 3 (true/false, select-all and put-in-order all count)`);
  if (!data.added) { // keep the first publish date on re-publish
    const existing = await db.collection("rounds").doc(data.id).get();
    data.added = (existing.exists && existing.data().added) || new Date().toISOString();
  }
  await db.collection("rounds").doc(data.id).set(data);
  console.log(`published round "${data.id}" (${n} questions)`);
}
if (hasPoll) {
  const poll = JSON.parse(readFileSync("poll.json", "utf8"));
  if (!Array.isArray(poll.options)) throw new Error("poll.json needs an options array");
  await db.collection("site").doc("poll").set(poll);
  console.log(`published poll with ${poll.options.length} option(s)`);
}
console.log("done");
