// Read-only: what each player has actually done in a game, from the records the site keeps.
// There is no tab-view tracking, so this shows creation signals only (runs, chat, votes, ideas,
// avatar, push, cards seen). Names shortened to a first name.
//   node scripts/inspect-usage.mjs <game|babies>
import admin from "firebase-admin";
const game = process.argv[2] || "babies";
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: "babies-trivia" });
const db = admin.firestore();
const root = game === "babies" ? db : db.collection("games").doc(game);
const get = n => root.collection(n).get().then(s => s.docs.map(d => ({ _id: d.id, ...d.data() }))).catch(() => []);
const [scores, chat, votes, reqs, sugg, profiles, push, presence] = await Promise.all(["scores", "chat", "votes", "requests", "suggestions", "profiles", "push", "presence"].map(get));
const ms = v => !v ? 0 : typeof v === "string" ? Date.parse(v) : v.toMillis ? v.toMillis() : v._seconds ? v._seconds * 1000 : +v || 0;
const people = {};
const P = (uid, name) => { if (!uid) return null; const p = people[uid] = people[uid] || { name: "", runs: 0, lastRun: 0, chat: 0, lastChat: 0, tags: 0, votes: 0, voteDays: new Set(), ideas: 0, sugg: 0, avatar: false, push: 0, chatSeen: 0, catchup: false, home: false, lastSeen: 0 }; if (name && !p.name) p.name = name; return p; };
for (const s of scores) { const p = P(s.uid, s.name); if (!p) continue; p.runs++; p.lastRun = Math.max(p.lastRun, ms(s.finishedAt)); }
for (const m of chat) { const p = P(m.uid, m.name); if (!p) continue; p.chat++; if (m.tag) p.tags++; p.lastChat = Math.max(p.lastChat, ms(m.at)); }
for (const v of votes) { const p = P(v.uid, v.name); if (!p) continue; p.votes++; p.voteDays.add(v.day); }
for (const r of reqs) { const p = P(r.uid, r.name); if (p) p.ideas++; }
for (const s of sugg) { const p = P(s.uid, s.name); if (p) p.sugg++; }
for (const x of push) { const p = P(x.uid, x.name); if (p) p.push++; }
for (const x of presence) { const p = P(x.uid || x._id, x.name); if (p) p.lastSeen = Math.max(p.lastSeen, ms(x.at)); }
for (const x of profiles) { const p = P(x.uid || x._id, x.name); if (!p) continue; p.avatar = !!x.avatar; p.chatSeen = ms(x.chatSeen); p.catchup = !!x.catchupSeen; p.home = !!x.homeSeen; }
const d = t => t ? new Date(t).toISOString().slice(5, 16).replace("T", " ") : "-";
console.log(`== ${game}: ${Object.keys(people).length} people | runs ${scores.length} | chat ${chat.length} | votes ${votes.length} | ideas ${reqs.length} | suggestions ${sugg.length} | push devices ${push.length}`);
console.log("name       runs  lastRun      chat tags lastChat     readChat     votes days ideas sugg avatar push home catch");
for (const p of Object.values(people).sort((a, b) => b.runs - a.runs)) {
  const n = (p.name || "?").split(" ")[0].padEnd(10);
  console.log(`${n} ${String(p.runs).padStart(4)}  ${d(p.lastRun)}  ${String(p.chat).padStart(4)} ${String(p.tags).padStart(4)} ${d(p.lastChat)}  ${d(p.chatSeen)}  ${String(p.votes).padStart(5)} ${String(p.voteDays.size).padStart(4)} ${String(p.ideas).padStart(5)} ${String(p.sugg).padStart(4)} ${p.avatar ? "  yes " : "   no "} ${String(p.push).padStart(4)} ${p.home ? " yes" : "  no"} ${p.catchup ? " yes" : "  no"}`);
}
const days = {}; for (const v of votes) days[v.day] = (days[v.day] || 0) + 1;
console.log("votes per poll day:", JSON.stringify(Object.fromEntries(Object.entries(days).sort())));
const cd = {}; for (const m of chat) { const k = d(ms(m.at)).slice(0, 5); cd[k] = (cd[k] || 0) + 1; }
console.log("chat per day:", JSON.stringify(Object.fromEntries(Object.entries(cd).sort())));
