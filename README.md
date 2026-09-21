# Exact Paste

Copy a chunk of text. Paste into a Chrome form field. The value that belongs in **that box** is pasted — an email, a name, a city — copied exactly from what you copied. If it is not a form field, or the match is unclear, the **whole chunk** is pasted.

It never invents text. It never fills the other boxes. It never leaves the field empty.

Shift+paste (`Cmd+Shift+V` / `Ctrl+Shift+V`) always pastes the whole chunk.

Powered by [TypeSafe Jev](https://www.typesafe.ai/).

## Install

You need [Node 22+](https://nodejs.org) and a [TypeSafe API key](https://console.typesafe.ai/settings/keys). Chrome will not let a script silently install an unpacked extension, so this is one command plus one click.

```sh
curl -fsSL https://raw.githubusercontent.com/goodnight000/exact-paste/main/install.sh | bash
```

That clones into `~/.exact-paste`, asks for the key (hidden), checks it against TypeSafe, builds the extension, copies the folder path, and opens Chrome’s extensions page plus Finder on the folder.

Then: **Developer mode** → **Load unpacked** → select that folder. Reload tabs that were already open.

Click the toolbar icon to turn Exact Paste off (badge shows **OFF**). Same toggle: Alt+Shift+V. Shift+paste is always a normal paste.

The popup has a **vault**: a free-form note (LinkedIn and a URL, email, whatever you type). If the clipboard does not match this box, the vault does. A copied match always wins.

From a checkout, the same path is `npm start`. If `TYPESAFE_API_KEY` is already in the environment or `.env`, it does not ask again.

## Try it

```sh
npm run demo
```

Open http://127.0.0.1:4173. Copy the source on the left, paste into one field at a time.

| Scene | What it shows |
| --- | --- |
| [Ship](http://127.0.0.1:4173/keel.html) | One address. Street, city, ZIP, country. |
| [Vendor](http://127.0.0.1:4173/vendor.html) | Two people. Should take the electrician Dave said to use, not the other. |
| [Bill](http://127.0.0.1:4173/bill.html) | Invoice number, amount, due date, remit address. |
| [Guest](http://127.0.0.1:4173/guest.html) | First name / last name from `Maya Chen`. Dietary notes stays a normal paste. |
| [Links](http://127.0.0.1:4173/links.html) | Three URLs. Site vs GitHub vs LinkedIn. |

## How it decides

| Focus | Result |
| --- | --- |
| Email / phone / URL and the chunk has exactly one | That value, on-device |
| First / last / full name and exactly one person in the chunk | Split in code, on-device |
| Company, city, title, summary, or two people in the chunk | Jev picks a substring, then a second check. Fail → whole chunk |
| Clipboard has no match, vault does | Vault value |
| Comment, tweet, search, password | Chrome’s normal paste |
| Timeout, error, or nothing matches | Whole chunk, or leave a filled field alone |

Jev never writes text. Code copies a slice of what you copied. Model: `jev-1.13.0`.

## Eval

`npm test` is free (no API key): slot detection, fixture sanity, fast-path and secret cases.

`npm run eval` hits live Jev. Scoring:

- **pass** — inserted text is exactly the accepted value
- **safe_miss** — we wanted a slice, dumped the whole chunk
- **unsafe** — a wrong slice, or a slice when the whole chunk was required

Unsafe fails the process. Fixtures are in `eval/`.

## Privacy

Clipboard text is read only from the paste event, on the page you paste into. It does not watch copies in the background.

When it tries a smart slice, the pasted text and the field’s label/type go to TypeSafe (`api.typesafe.ai`). Private keys and card-shaped numbers are not sent. One-email / one-phone / one-URL and a single person’s name are decided on-device.

Do not commit `.env` or a built `dist/` that has a key baked in.

## License

MIT. See [SPEC.md](./SPEC.md) for the contract and [CONTRIBUTING.md](./CONTRIBUTING.md) to add fixtures.
