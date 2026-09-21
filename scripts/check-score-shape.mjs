// Before deploying a change to index.html: proves that a finished run of every question
// format, including a timed-out run with gaps, produces a document the Firestore SDK
// accepts. Run: npm install firebase@10 --no-save && node scripts/check-score-shape.mjs
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, disableNetwork, serverTimestamp } from "firebase/firestore";
const html = readFileSync("index.html", "utf8");
const a = html.indexOf("const packPicks"), b = html.indexOf("const pendingKey");
if (a < 0 || b < 0) throw new Error("markers not found in index.html");
const { packPicks, cleanDoc } = new Function(html.slice(a, b) + "\nreturn { packPicks, cleanDoc };")();
const db = getFirestore(initializeApp({ projectId: "demo-check", apiKey: "x" })); await disableNetwork(db);
const order = [0, 1, 2, 3, 4]; const picks = []; picks[0] = 2; picks[1] = [0, 3]; picks[3] = [2, 0, 1]; // 2 and 4 unanswered
const result = { uid: "u", name: "N", photo: "", roundId: "r", score: 2.5, total: 5, elapsedMs: 1000, timedOut: true, bestStreak: 1, finishedAt: new Date().toISOString(), order, picks: packPicks(order, picks) };
let bad = 0;
for (const [label, d] of [["multiple choice, select, order, gaps", result], ["nested arrays and undefined", { ...result, extra: [[1, 2]], nested: { a: undefined } }]]) {
  try { setDoc(doc(db, "scores", "t"), cleanDoc({ ...d, createdAt: serverTimestamp() })); console.log("ok:", label); }
  catch (e) { bad++; console.log("REJECTED:", label, e.message); }
}
process.exit(bad ? 1 : 0);
