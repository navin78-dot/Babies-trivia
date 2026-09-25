// Makes sure every sister site's web address is on the Firebase Authentication
// authorized-domains list, so Google sign-in works there. Reads games/*.json
// (the "netlify.domain" field) and adds what is missing through the Identity
// Toolkit admin API, using the same service-account key the other workflows use.
// Never removes a domain. Idempotent: run it as often as you like.
import { readdirSync, readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

const project = "babies-trivia";
const wanted = new Set(process.argv.slice(2)); // extra domains can be passed on the command line
for (const f of readdirSync("games").filter(f => f.endsWith(".json"))) {
  const g = JSON.parse(readFileSync(`games/${f}`, "utf8"));
  if (g.netlify && g.netlify.domain) wanted.add(g.netlify.domain);
}
if (!wanted.size) { console.log("No sister-site domains to add."); process.exit(0); }

const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform", "https://www.googleapis.com/auth/firebase"] });
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;
const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-goog-user-project": project };

const getRes = await fetch(url, { headers });
if (!getRes.ok) { console.error(`::error::Could not read the Auth config (${getRes.status}): ${await getRes.text()}`); process.exit(1); }
const cfg = await getRes.json();
const have = cfg.authorizedDomains || [];
const missing = [...wanted].filter(d => !have.includes(d));
console.log("authorized now:", have.join(", "));
if (!missing.length) { console.log("Nothing to add."); process.exit(0); }

const patch = await fetch(`${url}?updateMask=authorizedDomains`, { method: "PATCH", headers, body: JSON.stringify({ authorizedDomains: have.concat(missing) }) });
if (!patch.ok) {
  console.error(`::error::Could not add ${missing.join(", ")} to the authorized domains (${patch.status}): ${await patch.text()}`);
  console.error("Fallback: Firebase console > Authentication > Settings > Authorized domains > Add domain.");
  process.exit(1);
}
console.log("added:", missing.join(", "));
