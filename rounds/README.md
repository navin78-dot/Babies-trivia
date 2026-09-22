# Round files

Each `*.json` file here is one quiz round. On push to `main`, the
**Publish rounds** workflow writes it into the Firestore `rounds` collection,
and the live site loads it at startup. Adding a quiz this way costs no Netlify
deploy.

**Do not put `[skip netlify]` in commit messages.** `netlify.toml` decides whether
to deploy by looking at whether `index.html` actually changed since the last
published deploy, which is correct no matter how commits are ordered in a push.
The marker is worse: Netlify reads only the newest commit of a push, so a trailing
data commit cancelled the build for a site change behind it and the change never
went live. That happened once; the config exists so it cannot happen again.

## Shape

```json
{
  "id": "unique-slug",
  "name": "Round Name",
  "subject": "What it's about",
  "tagline": "One line shown under the title.",
  "theme": { "font": "Bungee", "accent": "#7C3AED", "accent2": "#F59E0B",
             "accentDark": "#A78BFA", "accent2Dark": "#FDBA74" },
  "questions": [ ... 20 questions ... ]
}
```

House rule: at least 6 questions, and each difficulty makes up at least a fifth
of the round (never fewer than 2). The standard is 20: 7 easy, 7 medium, 6 hard.
Shorter rounds are fine. Formats can be mixed, but at most **3 questions per
round** may be anything other than standard multiple choice; true/false,
select-all and put-in-order all count toward that cap.

Optional round fields: `"draft": true` puts the round in the nightly-drop queue
instead of straight into the lobby (use it for every new round); `"added"` is
stamped automatically on first publish; `"emblem": "🎬"` sets the big emoji on
the round's poster tile.

## The nightly drop and the queue

Every round file here should carry `"draft": true`. Draft rounds form the
queue. Each night at midnight New York time one round leaves the queue and goes
live: the poll on the site shows the first three rounds waiting (oldest first),
the most-voted one drops, the host can override. So the queue needs topping up.

The **Queue status** workflow runs every morning and commits `queue-status.json`
at the repository root: how many rounds are waiting, tonight's poll, recent
drops, and any theme requests the host typed on the Host tab. A daily Claude
session reads it and writes enough rounds to keep five waiting. See
`scripts/QUEUE.md`.

A round written for a host request should carry `"requestId": "<the request id>"`
so the request is ticked off when the round publishes.

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
