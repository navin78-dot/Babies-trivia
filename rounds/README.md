# Round files

Each `*.json` file here is one quiz round for the original game. On push to
`main`, the **Publish rounds** workflow writes it into the Firestore `rounds`
collection, and the live site loads it at startup. Adding a quiz this way costs
no Netlify deploy. A sister game's rounds live in `games/<id>/rounds/` with the
same shape and rules and publish to `games/<id>/rounds`; the two banks never
share a question, because some people play both games.

**Do not put `[skip netlify]` in commit messages.** Netlify no longer builds
anything for this repository: `netlify.toml` cancels every build Netlify would
start, and the **Deploy sites** workflow uploads the finished pages with the
Netlify CLI, only when `index.html`, the manifest, the icons or a game file
changed. That costs no Netlify build credits. The marker used to be harmful too:
Netlify reads only the newest commit of a push, so a trailing data commit once
cancelled the build for a site change behind it and the change never went live.

## Shape

```json
{
  "id": "unique-slug",
  "name": "Round Name",
  "subject": "What it's about",
  "tagline": "One line shown under the title.",
  "theme": { "font": "Bungee", "accent": "#7C3AED", "accent2": "#F59E0B",
             "accentDark": "#A78BFA", "accent2Dark": "#FDBA74" },
  "questions": [ ... 11 questions ... ]
}
```

House rule: at least 6 questions, and each difficulty makes up at least a fifth
of the round (never fewer than 2). The standard is **11: 5 easy, 3 medium, 3 hard**,
in both games (rounds played before 4 Oct 2026 had 20). Shorter rounds are fine. Formats can be mixed, but at most **3 questions per
round** may be anything other than standard multiple choice; true/false,
select-all and put-in-order all count toward that cap.

Optional round fields: `"draft": true` puts the round in the drop queue
instead of straight into the lobby (use it for every new round); `"added"` is
stamped automatically on first publish; `"emblem": "🎬"` sets the big emoji on
the round's poster tile.

## The drop and the queue

Every round file here should carry `"draft": true`. Draft rounds form the
queue. A round drops (leaves the queue and goes live) at midnight New York time
going into Sunday, Tuesday, Thursday and Saturday. The poll on the site runs from
one drop to the next and picks the drop **after** next: its options are the
first three rounds waiting (oldest first) plus every theme idea players have
typed in. A theme that wins is written into a round before its drop day; if the
round is not ready in time, the best-placed written round drops instead and the
theme drops as soon as it is written. The host can pick any waiting round for a
coming drop day, which beats the poll. (Until 3 Oct 2026 there was one drop
every night, chosen by that day's poll.)

The **Queue status** workflow runs every morning and commits `queue-status.json`
at the repository root: how many rounds are waiting, the poll now open, the next
two drops, recent drops, and the theme ideas that won a poll and are still to be
written (`requestsWaiting`, each with its drop day). A daily Claude session
reads it, writes those first, and tops the queue back up to five. See
`scripts/QUEUE.md`.

A round written for a theme idea must carry `"requestId": "<the request id>"`
exactly as `queue-status.json` lists it (a sister game's id is prefixed, e.g.
`hamps:abc`): that is how the drop logic matches the round to the idea that won,
and the publish step ticks the idea off.

Validate files locally without publishing:

```
npm install firebase-admin@^12 --no-save && node scripts/publish-rounds.mjs --check
```

## Question formats

- Multiple choice (default): `{ "d":"easy", "q":"...", "o":["A","B","C","D"], "a":0, "w":"why" }`
  `a` is the index of the correct option. 2 to 6 options are allowed.
- True / false: a two-option multiple choice with `"keepOrder": true` so the options are not shuffled.
- Select all that apply: `"type":"select"`, and `a` is an array of correct indices, e.g. `"a":[0,2,3]`.
- Put in order: `"type":"order"`, and `o` lists the items already in the correct order.
- Optional visuals on any question: `"emoji":"🐝 👑 🎤"` or `"img":"https://..."` with `"credit":"..."`.
- Optional `"more"`: two or three extra sentences of background, shown in the
  **Learn** tab when a player taps the eye on a question they got wrong. `w` is
  the short "why it's right" shown during the round; `more` is the story around
  it, so write something a person would enjoy knowing, not a restatement of `w`.

Scoring: multiple choice and true/false are one point or zero. Select-all gives
a share of the point for each correct tick, minus one share for each wrong tick,
never below zero. Put-in-order gives a share for each item in its correct slot.

## Before a deploy of index.html

A finished run is written to the player's phone first and posted to the board
from there, with retries, so a failed post is never lost. Still, before deploying
a change to the quiz or scoring code, prove the score document is one Firestore
accepts for every question format:

```
npm install firebase@10 --no-save && node scripts/check-score-shape.mjs
```
