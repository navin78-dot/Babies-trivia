# Daily queue top-up

Goal: five written rounds waiting in the nightly-drop queue at all times.

Steps the daily session follows:

1. `git pull origin main` and read `queue-status.json` at the repository root.
   The **Queue status** workflow refreshes it every morning at 12:45 UTC (and on
   demand from the Actions tab). `need` is the total number of rounds to write
   today: one for every entry in `requestsWaiting`, plus `fill` to bring the
   queue back to five. `existingSubjects` is what already exists.
2. If `need` is 0, stop. Otherwise write `need` new rounds as `rounds/<slug>.json`.
   **Write the `requestsWaiting` themes first, one round each, with that
   request's id in a `requestId` field.** A host request is always written, even
   when the queue is already full; it just makes the queue longer. Then write
   `fill` more on themes that are not already in `existingSubjects` and that suit
   a group of five friends in their thirties: pop culture, music, film and TV,
   sport, food, travel, science, history, words, business. Vary the mix.
3. Each round: `"draft": true`, a `name`, `subject`, `tagline`, `theme` (font,
   accent, accent2, accentDark, accent2Dark), `emblem`, and 20 questions:
   7 easy, 7 medium, 6 hard, at most 3 non-multiple-choice (true/false,
   select-all, put-in-order all count). Every question needs `w`, a one- or
   two-sentence explanation with the fact that makes it right. Facts must be
   real and checkable; when unsure of a detail, choose a different question.
   Options should be plausible, no joke answers, no "all of the above".
4. Validate: `npm install firebase-admin@^12 --no-save --no-audit --no-fund && node scripts/publish-rounds.mjs --check`.
5. Commit only the new round files with a message ending in `[skip netlify]`
   (rounds are data, not a site deploy) and push to `main`. The Publish rounds
   workflow puts them in Firestore on its own. Report which rounds were added.
