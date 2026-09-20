# Exact Paste

Chrome extension. Copy a chunk of text. Paste into a web form. If the box wants a single value (email, name, city), that exact substring is pasted. If it is not a form field, or the match is unclear, the **whole chunk** is pasted. Other fields are never touched. The field is never left empty.

Shift+paste (`Cmd+Shift+V` / `Ctrl+Shift+V`) always pastes the whole chunk.

## Setup

You need Node 22+ and a [TypeSafe](https://console.typesafe.ai/settings/keys) API key.

```sh
cd ~/Developer/exact-paste
cp .env.example .env
# put TYPESAFE_API_KEY=ts_... in .env
npm install
npm test
npm run build
```

Load the unpacked extension:

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked → choose the `dist` folder

The key from `.env` is baked into `dist` at build time. You can also paste a key in the extension toolbar popup. Rebuild after changing `.env`.

Reload any tabs that were already open.

## Try it

```sh
npm run demo
```

Open http://127.0.0.1:4173, copy the sample resume, paste into Email (should insert only the address), then into Full name (Jev), then into the comment box (whole resume).

## Behaviour

| Focus | Result |
| --- | --- |
| Email / phone / URL and the chunk has exactly one | That value, no model call |
| Name, company, city, title, summary | Jev picks a substring, then a second check. Fail → whole chunk |
| Comment, tweet, search, password, unlabeled box | Chrome’s normal paste |
| No key, timeout, error | Whole chunk |

Jev never writes text. Code copies a slice of what you copied. Model: `jev-1.13.0`.

See [SPEC.md](./SPEC.md) for the full contract.
