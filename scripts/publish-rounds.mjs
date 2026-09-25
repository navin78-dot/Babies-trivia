// Upserts round files into Firestore: rounds/*.json go to the original game's
// "rounds" collection, games/<id>/rounds/*.json go to games/<id>/rounds. Each
// game has its own question bank, because some people play more than one game.
// Runs in GitHub Actions with GOOGLE_APPLICATION_CREDENTIALS pointing at the
// service-account key. Adding a quiz is a JSON commit, not a site deploy.
import { readdirSync, readFileSync, existsSync } from "node:fs";

const checkOnly = process.argv.includes("--check"); // validate the files, publish nothing
const jsonFiles = dir => existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".json")).map(f => `${dir}/${f}`) : [];
const targets = [{ game: "", dir: "rounds" }];
for (const f of jsonFiles("games")) { const g = JSON.parse(readFileSync(f, "utf8")); if (g.id) targets.push({ game: g.id, dir: `games/${g.id}/rounds` }); }
const hasPoll = existsSync("poll.json");
if (!targets.some(t => jsonFiles(t.dir).length) && !hasPoll) { console.log("Nothing to publish."); process.exit(0); }

function validate(f, data){
  if (!data.id || !/^[a-z0-9-]+$/.test(data.id)) throw new Error(`${f} needs an "id" of lowercase letters, digits and dashes`);
  if (!data.name) throw new Error(`${f} is missing a "name"`);
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error(`${f} has no questions`);
  const n = data.questions.length, c = { easy: 0, medium: 0, hard: 0 };
  data.questions.forEach((q, i) => {
    if (c[q.d] == null) throw new Error(`${f} question ${i + 1}: d must be easy, medium or hard`);
    c[q.d]++;
    if (!q.q || !Array.isArray(q.o) || q.o.length < 2 || q.o.length > 6) throw new Error(`${f} question ${i + 1}: needs q and 2 to 6 options`);
    const t = q.type || "mc";
    if (t === "mc" && !(Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length)) throw new Error(`${f} question ${i + 1}: a must index an option`);
    if (t === "select" && !(Array.isArray(q.a) && q.a.length && q.a.every(k => Number.isInteger(k) && k >= 0 && k < q.o.length))) throw new Error(`${f} question ${i + 1}: select needs a as an array of option indexes`);
    if (t === "order" && q.o.length < 3) throw new Error(`${f} question ${i + 1}: order needs at least 3 items`);
    if (!q.w) throw new Error(`${f} question ${i + 1}: needs a w explanation`);
  });
  const min = Math.max(2, Math.ceil(n * 0.2));
  const special = data.questions.filter(q => (q.type || "mc") !== "mc" || (q.o && q.o.length === 2)).length;
  if (n < 6 || c.easy < min || c.medium < min || c.hard < min) throw new Error(`${f} breaks the house rule: ${n} questions, ${c.easy}/${c.medium}/${c.hard} easy/medium/hard (need at least ${min} each)`);
  if (special > 3) throw new Error(`${f} has ${special} non-multiple-choice questions; the cap is 3 (true/false, select-all and put-in-order all count)`);
  return { n, c, special };
}

if (checkOnly) {
  const seen = {};
  for (const t of targets) for (const f of jsonFiles(t.dir)) {
    const data = JSON.parse(readFileSync(f, "utf8")); const { n, c, special } = validate(f, data);
    const key = `${t.game}/${data.id}`; if (seen[key]) throw new Error(`${f} and ${seen[key]} both have id "${data.id}"`); seen[key] = f;
    console.log(`ok ${f}: ${n} questions, ${c.easy}/${c.medium}/${c.hard}, ${special} special`);
  }
  console.log("all files valid"); process.exit(0);
}

const admin = (await import("firebase-admin")).default; // only needed when publishing
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();
const rootOf = game => game ? db.collection("games").doc(game) : db;

for (const t of targets) {
  const rounds = rootOf(t.game).collection("rounds");
  for (const f of jsonFiles(t.dir)) {
    const data = JSON.parse(readFileSync(f, "utf8"));
    const { n } = validate(f, data);
    if (!data.added) { // keep the first publish date on re-publish
      const existing = await rounds.doc(data.id).get();
      data.added = (existing.exists && existing.data().added) || new Date().toISOString();
    }
    await rounds.doc(data.id).set(data);
    console.log(`published ${t.dir}/${data.id} (${n} questions)`);
    if (data.requestId) { // a round written for a theme a host asked for: tick it off. "hamps:abc" means games/hamps/requests/abc
      const [game, reqId] = data.requestId.includes(":") ? data.requestId.split(":") : ["", data.requestId];
      try { await rootOf(game).collection("requests").doc(reqId).set({ status: "written", roundId: data.id }, { merge: true }); console.log(`  marked request ${data.requestId} as written`); } catch (e) { console.log(`  could not update request ${data.requestId}: ${e.message}`); }
    }
  }
}
if (hasPoll) {
  const poll = JSON.parse(readFileSync("poll.json", "utf8"));
  if (!Array.isArray(poll.options)) throw new Error("poll.json needs an options array");
  await db.collection("site").doc("poll").set(poll);
  console.log(`published poll with ${poll.options.length} option(s)`);
}
console.log("done");
