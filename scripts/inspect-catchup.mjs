// Read-only check of why a game's one-time catch-up card did or did not show:
// for every profile, whether catchupSeen is set, plus how many scores each player
// has this cycle, and whether the live page carries the card's code at all.
// Prints names shortened to a first name and the last four characters of the uid.
// Usage: node scripts/inspect-catchup.mjs <game>   (runs in GitHub Actions with the service-account key)
import admin from "firebase-admin";
import { readFileSync } from "node:fs";

const game = process.argv[2] || "hamps";
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();
const root = game === "babies" ? db : db.collection("games").doc(game);
const [profiles, scores, presence] = await Promise.all([root.collection("profiles").get(), root.collection("scores").get(), root.collection("presence").get()]);
const short = (uid, name) => `${(name || "?").split(" ")[0]} …${uid.slice(-4)}`;
const byUid = {};
scores.docs.forEach(d => { const s = d.data(); byUid[s.uid] = (byUid[s.uid] || 0) + 1; });
const names = {}; scores.docs.forEach(d => { const s = d.data(); if (s.name) names[s.uid] = s.name; }); presence.docs.forEach(d => { const p = d.data(); if (p.name) names[p.uid || d.id] = p.name; });
console.log(`game=${game} profiles=${profiles.size} scores=${scores.size} presence=${presence.size}`);
for (const d of profiles.docs) {
  const p = d.data();
  console.log(`  ${short(d.id, p.name || names[d.id])}: catchupSeen=${p.catchupSeen === true} runs=${byUid[d.id] || 0} keys=${Object.keys(p).sort().join(",")}`);
}
const noProfile = Object.keys(byUid).filter(u => !profiles.docs.some(d => d.id === u));
if (noProfile.length) console.log(`  players with scores but no profile doc: ${noProfile.map(u => short(u, names[u])).join("; ")}`);
if (game !== "babies") {
  const g = JSON.parse(readFileSync(`games/${game}.json`, "utf8"));
  const html = await (await fetch(`https://${g.netlify.domain}/?t=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } })).text();
  console.log(`live page: ${html.length} bytes, hasCatchupCode=${html.includes("function maybeCatchup")}, catchupNoteOn=${/catchupNote"?\s*:\s*true/.test(html)}`);
}
