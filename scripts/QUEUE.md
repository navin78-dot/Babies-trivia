# Daily queue top-up

Goal: every theme idea that won the drop poll is written before its drop day,
and five written rounds wait in the queue of **every game** at all times. Each
game has its own question bank: the original game's round files live in
`rounds/`, a sister game's in `games/<id>/rounds/` (see `games/README.md`). Some
people play more than one game, so a question written for one game is never
reused in another, and if a theme comes up twice it gets different questions.

How drops work: a round goes live at midnight New York time going into Monday,
Wednesday, Friday and Sunday. The poll between two drops picks the drop after
next, from the first three rounds waiting plus every theme idea players typed
in. A winning theme is written by this session; the round file carries the
idea's id so the site matches them up.

Steps the daily session follows:

1. `git pull origin main` and read `queue-status.json` at the repository root.
   The **Queue status** workflow refreshes it every morning at 12:45 UTC (and on
   demand from the Actions tab). `need` is the total number of rounds to write
   today: one for every entry in `requestsWaiting` (a theme that won a poll,
   with the `dropDay` it is due), plus `fill` to bring the queue back to five.
   `existingSubjects` is what that game already has. The top level of the
   report is the original game (files in `rounds/`); each sister game has the
   same block under `games.<id>` with its own `need`, `requestsWaiting`,
   `existingSubjects` and `roundsDir`. Do every game whose `need` is above 0.
   `totalNeed` is the sum.
2. If `totalNeed` is 0, stop. Otherwise, for each game, write its `need` new
   rounds as `<roundsDir>/<slug>.json`.
   **Write the `requestsWaiting` themes first, one round each, with that
   request's id in a `requestId` field, copied exactly as listed** (a sister
   game's request id carries a prefix such as `hamps:`; keep it). A won theme is
   always written, even when the queue is already full, and it must land before
   its `dropDay`. Then write `fill` more on themes that are not already in that
   game's `existingSubjects` and that suit a group of friends in their thirties:
   pop culture, music, film and TV, sport, food, travel, science, history,
   words, business. `ideas` lists the open theme ideas still on the poll; they
   are not to be written unless they win, but they show what the group is in
   the mood for. Vary the mix.
3. Each round: `"draft": true`, a `name`, `subject`, `tagline`, `theme` (font,
   accent, accent2, accentDark, accent2Dark), `emblem`, and **11 questions:
   5 easy, 3 medium, 3 hard**, in both games. At most 3 non-multiple-choice (true/false,
   select-all, put-in-order all count). Every question needs `w`, a one- or
   two-sentence explanation with the fact that makes it right, and a `more`
   field of two or three sentences of background for the Learn tab (the story
   around the answer, not a restatement of `w`). Facts must be
   real and checkable; when unsure of a detail, choose a different question.
   Options should be plausible, no joke answers, no "all of the above".
4. Validate: `npm install firebase-admin@^12 --no-save --no-audit --no-fund && node scripts/publish-rounds.mjs --check`.
5. Commit only the new round files and push to `main`. Do **not** add
   `[skip netlify]`; Netlify's own builds are cancelled for every push, and the
   Deploy sites workflow only runs when a site file changed. The Publish rounds
   workflow puts the rounds in Firestore on its own. Report which rounds were added.
