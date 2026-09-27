// Estimates the team's Netlify credit use for the current billing cycle from the
// only figure that is reliable: the number of successful production deploys.
// Netlify's account API reported 0 credits used on a day the team was at 50%,
// so it is not consulted. On credit-based plans every successful production
// deploy costs 15 credits (a cancelled build costs nothing; bandwidth is 20
// credits per GB, which for two one-page sites is a rounding error), so
// deploys x 15 is the number that matters. Runs in GitHub Actions with
// NETLIFY_AUTH_TOKEN and writes netlify-usage.json.
import { readFileSync, writeFileSync } from "node:fs";

const TOKEN = process.env.NETLIFY_AUTH_TOKEN;
if (!TOKEN) { console.error("NETLIFY_AUTH_TOKEN is not set"); process.exit(1); }
const ALLOWANCE = 1000, PER_DEPLOY = 15, CYCLE_DAY = 21; // from Netlify's own email: 1000 credits, cycle runs the 21st to the 20th
const SITES = { babies: { id: "9036149d-951a-4517-bda1-41097f45e30e", domain: "babiestrivia.netlify.app" } };
for (const f of ["hamps"]) { const g = JSON.parse(readFileSync(`games/${f}.json`, "utf8")); SITES[g.id] = { id: g.netlify.siteId, domain: g.netlify.domain }; }

const now = new Date();
const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (now.getUTCDate() < CYCLE_DAY ? 1 : 0), CYCLE_DAY));
const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, CYCLE_DAY));
const day = d => d.toISOString().slice(0, 10);

async function deploys(siteId){
  const out = [];
  for (let page = 1; page < 20; page++) {
    const r = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys?per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!r.ok) throw new Error(`deploys ${siteId} page ${page}: HTTP ${r.status}`);
    const batch = await r.json();
    out.push(...batch);
    if (batch.length < 100 || new Date(batch[batch.length - 1].created_at) < start) break;
  }
  return out;
}

const report = { asOf: now.toISOString(), cycle: { start: day(start), end: day(end) }, allowance: ALLOWANCE, creditsPerDeploy: PER_DEPLOY, sites: {} };
let total = 0;
for (const [name, s] of Object.entries(SITES)) {
  const all = await deploys(s.id);
  const inCycle = all.filter(d => new Date(d.created_at) >= start && new Date(d.created_at) < end);
  const counted = inCycle.filter(d => d.state === "ready" && (d.context || "production") === "production");
  const byDay = {};
  for (const d of counted) byDay[day(new Date(d.created_at))] = (byDay[day(new Date(d.created_at))] || 0) + 1;
  report.sites[name] = { domain: s.domain, productionDeploys: counted.length, cancelledOrFailed: inCycle.length - counted.length, byDay, lastDeploy: counted[0] ? counted[0].created_at : null };
  total += counted.length;
}
const used = total * PER_DEPLOY;
const daysLeft = Math.max(0, Math.ceil((end - now) / 864e5));
report.estimate = {
  productionDeploys: total, creditsUsed: used, percentUsed: Math.round(used / ALLOWANCE * 100), creditsLeft: Math.max(0, ALLOWANCE - used),
  deploysLeft: Math.max(0, Math.floor((ALLOWANCE - used) / PER_DEPLOY)), daysLeftInCycle: daysLeft,
  note: "Counts successful production deploys only, at 15 credits each; bandwidth is not counted and is negligible for these sites. Netlify's own emails at 50/75/90/100% are the ground truth; if one disagrees with this, trust the email.",
};
writeFileSync("netlify-usage.json", JSON.stringify(report, null, 2) + "\n");
console.log(`NETLIFY_USAGE: ${total} production deploys this cycle (${day(start)} to ${day(end)}) = about ${used} of ${ALLOWANCE} credits (${report.estimate.percentUsed}%), ${report.estimate.deploysLeft} deploys left for ${daysLeft} days`);
for (const [n, s] of Object.entries(report.sites)) console.log(`  ${n}: ${s.productionDeploys} deploys, ${s.cancelledOrFailed} cancelled/failed`);
