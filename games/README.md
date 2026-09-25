# Sister games

One source file, `index.html`, runs more than one game. Each `games/<id>.json`
here describes a sister site for a different group of friends: its name, look,
group size, season calendar and where it is hosted. `scripts/build-site.mjs`
builds that site from the shared source, so every feature shipped to the
original game ships to the sisters in the same push.

| Game | Site | Data in Firestore | Deploys |
|---|---|---|---|
| Babies' Trivia (the original, `GAME.id` is `""`) | babiestrivia.netlify.app | top-level collections | Netlify builds `index.html` on push |
| Trivia for the Hamps Crew (`hamps`) | hampscrew.netlify.app | `games/hamps/…` | `.github/workflows/deploy-hamps.yml` uploads the built file to Netlify |

## What a sister game shares and what it keeps

Shared: the Firebase project, Google sign-in, and the `rounds` collection. A round
written for either game goes into both games' nightly queues. Every game's host
requests feed the same daily top-up.

Its own: scores, leaderboards, seasons, medals, trophy case, chat, presence,
profiles and avatars, the poll and its votes, host overrides, closed and
promoted rounds, suggestions and theme requests, and the site tagline and
announcement. All of it lives under `games/<id>/` in Firestore with the same
security rules as the original game (see `firestore.rules`, `knownGame`).

## The file

```json
{
  "id": "hamps",                              // lowercase letters and dashes; also the Firestore namespace
  "name": "Trivia for the Hamps Crew",        // full name: screen readers, share text
  "plainName": "Trivia for the Hamps Crew",   // tab title and share-card header, as typed
  "wordmarkHtml": "…",                        // the small name top-left (HTML)
  "titleHtml": "…",                           // the big title on the home screen (HTML)
  "fileSlug": "hamps-crew-trivia",            // share image file names
  "eyebrow": "Trivia for friends",            // over the title before sign-in
  "description": "…",                         // <meta name=description>
  "netlify": { "siteId": "…", "domain": "hampscrew.netlify.app" },
  "settings": {                               // overrides of SETTINGS in index.html
    "playersInGroup": 5,                      // a round closes itself once this many have played it
    "siteTagline": "…",
    "season": { "firstBoundary": "2026-10-04" },   // Season 2 starts at midnight going into this date, New York time
    "drop": { "start": "2026-09-25" }              // first poll day; the first nightly drop is the midnight after it
  },
  "theme": { "fonts": "family=Outfit:wght@700;800", "css": ["…"] }   // extra Google Fonts query and CSS appended to the head
}
```

## Adding another game

1. Copy `games/hamps.json` to `games/<id>.json` and fill it in.
2. Add the id to `knownGame` in `firestore.rules` (the rules workflow publishes it).
3. Create the Netlify project (name = subdomain) and put its id and domain in the file.
4. Copy `.github/workflows/deploy-hamps.yml`, change the game id, paths and `SITE_ID`.
   It uses the `NETLIFY_AUTH_TOKEN` repository secret.
5. Push. The **Firebase auth domains** workflow adds the new domain to Google sign-in,
   the rules workflow publishes the rules, and the deploy workflow uploads the site.

Build locally to look at it: `node scripts/build-site.mjs <id>` writes `dist/<id>/index.html`.
