# Round files

Each `*.json` file here is one quiz round. On push to `main`, the
**Publish rounds** workflow writes it into the Firestore `rounds` collection,
and the live site loads it at startup. Adding a quiz this way costs no Netlify
deploy, so use `[skip netlify]` in the commit message.

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

Optional round fields: `"draft": true` hides the round until the host adds it to
the lobby; `"added"` is stamped automatically on first publish and drives the
"recent" ordering in the lobby and picker.

## The poll

A `poll.json` at the repository root is published to Firestore as the poll:

```json
{ "open": true, "question": "What should the next round be?", "note": "One vote each.",
  "options": [ { "id": "round-id", "name": "Shown name", "blurb": "One line." } ] }
```

Each option id should match a draft round's id so the host can add it to the
lobby. A promoted theme disappears from the poll automatically.

## Question formats

- Multiple choice (default): `{ "d":"easy", "q":"...", "o":["A","B","C","D"], "a":0, "w":"why" }`
  `a` is the index of the correct option. 2 to 6 options are allowed.
- True / false: a two-option multiple choice with `"keepOrder": true` so the options are not shuffled.
- Select all that apply: `"type":"select"`, and `a` is an array of correct indices, e.g. `"a":[0,2,3]`.
- Put in order: `"type":"order"`, and `o` lists the items already in the correct order.
- Optional visuals on any question: `"emoji":"🐝 👑 🎤"` or `"img":"https://..."` with `"credit":"..."`.

Scoring: multiple choice and true/false are one point or zero. Select-all gives
a share of the point for each correct tick, minus one share for each wrong tick,
never below zero. Put-in-order gives a share for each item in its correct slot.
