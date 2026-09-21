// Upserts every rounds/*.json file into the Firestore "rounds" collection.
// Runs in GitHub Actions with GOOGLE_APPLICATION_CREDENTIALS pointing at the
// service-account key. Adding a quiz is a JSON commit, not a site deploy.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import admin from "firebase-admin";

const dir = "rounds";
const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".json")) : [];
if (!files.length) { console.log("No round files to publish."); process.exit(0); }

admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();

for (const f of files) {
  const data = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  if (!data.id) throw new Error(`${f} is missing an "id" field`);
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error(`${f} has no questions`);
  await db.collection("rounds").doc(data.id).set(data);
  console.log(`published round "${data.id}" (${data.questions.length} questions)`);
}
console.log("done");
