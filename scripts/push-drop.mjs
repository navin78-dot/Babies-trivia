// Sends the "a new round dropped" push notification. Runs in GitHub Actions a few minutes after
// midnight New York time (and on demand) with the service-account key.
//
//   node scripts/push-drop.mjs            send today's drop, once per game per day (a marker in
//                                         site/push stops a second run from sending it again)
//   node scripts/push-drop.mjs --test     send a test notification to every subscriber instead
//   PUSH_MESSAGE="..." changes the test's text
//
// The VAPID key pair lives in Firestore: the private half in secrets/vapid (no client can read it,
// the service account bypasses rules), the public half in site/config.vapidPublic, which the page
// reads to subscribe. Both are made here on the first run, so there is nothing to set up by hand.
// Subscriptions sit in the push collection, one doc per device, written by the page.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import admin from "firebase-admin";
import webpush from "web-push";

const TEST = process.argv.includes("--test");
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();

const html = readFileSync("index.html", "utf8");
const slice = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b, i); if (i < 0 || j < 0) throw new Error("marker not found: " + a); return html.slice(i, j); };
const settings = html.match(/const SETTINGS = \{[\s\S]*?\n\};/)[0];
const code = settings
  + "\nObject.entries(OVERRIDES || {}).forEach(([k, v]) => { SETTINGS[k] = v && typeof v === 'object' && !Array.isArray(v) ? Object.assign({}, SETTINGS[k], v) : v; });\n"
  + slice("const SEASON = SETTINGS.season;", "const SEASON_KEY") + slice("const myVote = day =>", "async function castVote(id){")
  + "\nconst roundById = id => ROUNDS.find(r => r.id === id) || null;\nreturn { dropPlan, SETTINGS };";
const builtin = [...html.matchAll(/\n    id: "([a-z0-9-]+)",\n    added: "([^"]+)",\n    name: "([^"]+)",\n    subject: "([^"]*)",/g)]
  .map(m => { const head = html.slice(m.index, html.indexOf("questions: [", m.index)); return { id: m[1], added: m[2], name: m[3], subject: m[4], draft: /\n    draft: true,/.test(head), questions: [] }; });

const games = [{ id: "", settings: {}, site: "https://babiestrivia.netlify.app", slug: "babies", name: "Babies' Trivia" }];
if (existsSync("games")) for (const f of readdirSync("games").filter(f => f.endsWith(".json"))) { const g = JSON.parse(readFileSync(`games/${f}`, "utf8")); games.push({ ...g, site: `https://${g.netlify.domain}`, slug: g.id, name: g.plainName || g.name }); }

// the key pair, made once
const keyDoc = db.collection("secrets").doc("vapid");
let keys = (await keyDoc.get()).data();
if (!keys || !keys.publicKey || !keys.privateKey) {
  keys = webpush.generateVAPIDKeys();
  await keyDoc.set({ publicKey: keys.publicKey, privateKey: keys.privateKey, at: new Date().toISOString() });
  console.log("made a new VAPID key pair");
}

for (const game of games) {
  const root = game.id ? db.collection("games").doc(game.id) : db;
  const [roundsSnap, cfgSnap, votesSnap, reqSnap, subsSnap, sentSnap] = await Promise.all([root.collection("rounds").get(), root.collection("site").doc("config").get(), root.collection("votes").get(), root.collection("requests").get(), root.collection("push").get(), root.collection("site").doc("push").get()]);
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  if (cfg.vapidPublic !== keys.publicKey) { await root.collection("site").doc("config").set({ vapidPublic: keys.publicKey }, { merge: true }); console.log(`${game.slug}: published the public key`); }
  const dbRounds = roundsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const ROUNDS = (game.id ? [] : builtin.filter(b => !dbRounds.some(r => r.id === b.id))).concat(dbRounds);
  const env = { ROUNDS, liveIds: new Set(Array.isArray(cfg.liveRounds) ? cfg.liveRounds : []), siteCfg: cfg, votes: votesSnap.docs.map(d => d.data()), requests: reqSnap.docs.map(d => ({ id: d.id, ...d.data() })), me: null, isHost: false, OVERRIDES: game.settings || {} };
  const { dropPlan, SETTINGS } = new Function(...Object.keys(env), code)(...Object.values(env));
  if (SETTINGS.pushNotes === false) { console.log(`${game.slug}: push is off in settings`); continue; }
  const P = dropPlan();
  const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.endpoint && s.keys);
  console.log(`${game.slug}: ${subs.length} subscriber${subs.length === 1 ? "" : "s"}`);
  if (!subs.length) continue;

  let payload, mark = null;
  if (TEST) {
    payload = { title: `${game.name}: test`, body: process.env.PUSH_MESSAGE || "Notifications are working. You'll get one like this when a round drops.", url: game.site, icon: `${game.site}/icons/${game.slug}-180.png`, tag: "test" };
  } else {
    const drop = P.history.find(h => h.day === P.today);
    if (!drop) { console.log(`${game.slug}: no drop today (${P.today})`); continue; }
    const sent = (sentSnap.exists ? sentSnap.data().sent : null) || {};
    if (sent[P.today] === drop.id) { console.log(`${game.slug}: already sent for ${P.today}`); continue; }
    const r = ROUNDS.find(x => x.id === drop.id) || {}; const n = (r.questions || []).length;
    payload = { title: `New round: ${r.name || drop.id}`, body: r.tagline || `${n ? n + " questions" : "A new round"}${r.subject ? " on " + r.subject.toLowerCase() : ""}. One run, it counts.`, url: game.site, icon: `${game.site}/icons/${game.slug}-180.png`, tag: "drop-" + P.today };
    mark = { [P.today]: drop.id };
  }

  webpush.setVapidDetails(game.site, keys.publicKey, keys.privateKey);
  let ok = 0, gone = 0, failed = 0;
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 6 * 3600 }); ok++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { gone++; try { await root.collection("push").doc(s.id).delete(); } catch (err) {} }
      else { failed++; console.log(`  ${s.id}: ${e.statusCode || ""} ${e.body || e.message}`.slice(0, 200)); }
    }
  }
  console.log(`${game.slug}: ${TEST ? "test" : payload.title} → sent ${ok}, expired ${gone}, failed ${failed}`);
  if (mark && ok) await root.collection("site").doc("push").set({ sent: mark }, { merge: true });
}
