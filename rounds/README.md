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

House rule: 20 questions, at least 4 each of easy, medium and hard.

## Question formats

- Multiple choice (default): `{ "d":"easy", "q":"...", "o":["A","B","C","D"], "a":0, "w":"why" }`
  `a` is the index of the correct option. 2 to 6 options are allowed.
- True / false: a two-option multiple choice with `"keepOrder": true` so the options are not shuffled.
- Select all that apply: `"type":"select"`, and `a` is an array of correct indices, e.g. `"a":[0,2,3]`.
- Put in order: `"type":"order"`, and `o` lists the items already in the correct order.
- Optional visuals on any question: `"emoji":"🐝 👑 🎤"` or `"img":"https://..."` with `"credit":"..."`.

Scoring is all-or-nothing per question.
