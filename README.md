# Exact Paste

Chrome extension. Copy a chunk of text. Paste into a web form. If the box wants a single value (email, name, city), that exact substring is pasted. If it is not a form field, or the match is unclear, the **whole chunk** is pasted. Other fields are never touched. The field is never left empty.

Shift+paste (`Cmd+Shift+V` / `Ctrl+Shift+V`) always pastes the whole chunk.

## Install

Node 22+ and a [TypeSafe API key](https://console.typesafe.ai/settings/keys). Chrome cannot load an unpacked extension with zero clicks; this gets you to one.

```sh
npm start
```

That checks Node, asks for the key (hidden), proves it against TypeSafe, builds the extension, copies the folder path, and opens Chrome’s extensions page plus Finder on the folder.

Then: Developer mode → Load unpacked → select that folder. Reload tabs that were already open.

If `TYPESAFE_API_KEY` is already in the environment or `.env`, it does not ask again.

```sh
./install.sh
# later, from a public clone:
# curl -fsSL https://raw.githubusercontent.com/<you>/exact-paste/main/install.sh | bash
```

## Try it

```sh
npm run demo
```

Open http://127.0.0.1:4173, copy the sample resume, paste into Email (should insert only the address), then into Full name (Jev), then into the comment box (whole resume).

## Eval

`npm test` is free: slot detection, fixture sanity, fast-path and secret cases, scoring.

`npm run eval` hits live Jev with the key in `.env`. It scores each paste as:

- **pass** — inserted text is exactly the accepted value
- **safe_miss** — we wanted a slice, dumped the whole chunk (never a blank, never a wrong value)
- **unsafe** — a wrong slice, or a slice when the whole chunk was required

Unsafe fails the process. Safe misses are reported and still exit 0.

Fixtures live in `eval/`.

## Behaviour

| Focus | Result |
| --- | --- |
| Email / phone / URL and the chunk has exactly one | That value, no model call |
| First / last / full name and exactly one person in the chunk | Split in code, no model call |
| Company, city, title, summary, or two people in the chunk | Jev picks a substring, then a second check. Fail → whole chunk |
| Comment, tweet, search, password, unlabeled box | Chrome’s normal paste |
| No key, timeout, error | Whole chunk |

Jev never writes text. Code copies a slice of what you copied. Model: `jev-1.13.0`.

## Privacy

The extension reads clipboard text only from the paste event, on pages you paste into. It does not watch copies in the background.

When it tries a smart slice, the pasted text and the field’s label/type are sent to [TypeSafe](https://typesafe.ai) (`api.typesafe.ai`) so Jev can pick a substring. Secrets (private keys, card-shaped numbers) are not sent; those pastes stay local and whole. Email/phone/URL with exactly one match, and a single person’s first/last/full name, are decided on-device and never leave the machine.

Your API key stays in `.env` / `chrome.storage.local`. Do not commit `.env` or a built `dist/` that has a key baked in.

See [SPEC.md](./SPEC.md) for the full contract.
