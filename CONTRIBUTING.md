# Contributing

`npm test` must stay green. It does not call Jev.

Add cases to `eval/` rather than one-off prompts. Slot cases are HTML: should this field intercept paste? Decide cases are clipboard + field: exact slice or whole chunk.

`npm run eval` needs `TYPESAFE_API_KEY` and is the reliability check. A wrong slice is an **unsafe** fail. Dumping the whole chunk when a slice was wanted is a **safe miss**.

Do not commit `.env` or `dist/`.

Onboarding is `npm start` (`bin/exact-paste.mjs`). Keep that path to: key → build → one “Load unpacked” click.
