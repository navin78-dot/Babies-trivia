# Sister games

One source file, `index.html`, runs more than one game. Each `games/<id>.json`
here describes a sister site for a different group of friends: its name, look,
group size, season calendar and where it is hosted. `scripts/build-site.mjs`
builds that site from the shared source, so every feature shipped to the
original game ships to the sisters in the same push.

| Game | Site | Round files | Data in Firestore | Deploys |
|---|---|---|---|---|
| Babies' Trivia (the original, `GAME.id` is `""`) | babiestrivia.netlify.app | `rounds/` plus the built-ins in `index.html` | top-level collections | `.github/workflows/deploy-sites.yml` uploads it to Netlify |
| Trivia for the Hamps Crew (`hamps`) | hampscrew.netlify.app | `games/hamps/rounds/` | `games/hamps/…` | `.github/workflows/deploy-sites.yml` uploads the built file to Netlify |

## What a sister game shares and what it keeps

Shared: the Firebase project and Google sign-in. Nothing else.

Its own: the question bank (some people play more than one game, so no question
is ever reused across games, and a sister site is built without the original
game's built-in rounds), the drop queue and poll, scores, leaderboards,
seasons, medals, trophy case, chat, presence, profiles and avatars, host
overrides, closed and promoted rounds, suggestions and theme requests, and the
site tagline and announcement. All of it lives under `games/<id>/` in Firestore
with the same security rules as the original game (see `firestore.rules`,
`knownGame`). The daily top-up keeps every game's queue at five.

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
    "season": { "boundaries": ["2026-10-04"] },   // Season 2 starts at midnight going into this date (a Sunday), New York time; every 7 days after
    "drop": { "start": "2026-09-25" },             // first poll day of the nightly era (until 3 Oct 2026); the Sun/Tue/Thu/Sat schedule in SETTINGS applies to every game
    "pushNotes": false,                            // false = no "know when a round drops" notifications on this game (on by default; see scripts/push-drop.mjs)
    "catchupNote": true                            // one-time card: rounds played this season and rounds waiting, with a save-to-home-screen link. Off: the first visit gets a plain save-to-home-screen card instead (homeScreenNote)
  },
  "theme": { "fonts": "family=Outfit:wght@700;800", "css": ["…"] }   // extra Google Fonts query and CSS appended to the head
}
```

## Adding another game

1. Copy `games/hamps.json` to `games/<id>.json` and fill it in, and write its first
   rounds in `games/<id>/rounds/` (a few without `draft` so the lobby is not empty,
   five with `"draft": true` for the queue).
2. Add the id to `knownGame` in `firestore.rules` (the rules workflow publishes it).
3. Create the Netlify project (name = subdomain) and put its id and domain in the file.
4. Add the game to `.github/workflows/deploy-sites.yml` (build step, site id, host check).
   It uses the `NETLIFY_AUTH_TOKEN` repository secret.
5. Push. The **Firebase auth domains** workflow adds the new domain to Google sign-in,
   the rules workflow publishes the rules, and the deploy workflow uploads the site.

Build locally to look at it: `node scripts/build-site.mjs <id>` writes `dist/<id>/index.html`.
