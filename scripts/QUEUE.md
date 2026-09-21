# Daily queue top-up

Goal: five written rounds waiting in the nightly-drop queue at all times.

Steps the daily session follows:

1. Run the **Queue status** workflow (`queue-status.yml`, workflow_dispatch on
   `main`) and read the JSON between `QUEUE_STATUS_BEGIN` and `QUEUE_STATUS_END`
   in its log. `need` is how many rounds to write. `requestsWaiting` lists themes
   the host asked for; write those first, one round each, with `requestId` set.
2. If `need` is 0, stop. Otherwise write `need` new rounds as `rounds/<slug>.json`.
   Pick themes that are not already in `existingSubjects` and that suit a group
   of five friends in their thirties: pop culture, music, film and TV, sport,
   food, travel, science, history, words, business. Vary the mix across days.
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
   workflow puts them in Firestore. Wait for it to succeed and report.
