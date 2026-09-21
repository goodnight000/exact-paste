# Exact Paste

Chrome extension. You copy a chunk of text. You paste into a page. If the cursor is in a form field that wants a single value, the extension pastes **only that value**, copied exactly from what you copied. Otherwise it pastes **the whole chunk**. It never invents text, never fills other fields, and never leaves the field empty.

## Contract

On `paste` in Chrome:

1. If the focused control is not a form slot, do not touch the event. Chrome pastes as usual.
2. If it is a form slot, cancel the default paste and write **this field only**.
3. The written text is either:
   - an exact contiguous substring of the clipboard, the value that belongs in this field, or
   - the entire clipboard text.
4. If anything is uncertain, slow, or missing (no API key, timeout, bad model answer, secret-looking clipboard, field changed), write the **entire clipboard**.
5. Hold Shift while pasting (`Cmd+Shift+V` / `Ctrl+Shift+V`) to always paste the whole chunk.

Wrong is worse than dumb. Dumb is the full paste.

## Form slot (code, conservative)

A slot is a visible, enabled, not-read-only `input` or `textarea` that looks like it wants a single stored value.

**Never a slot**

- `contenteditable`
- password, hidden, file, checkbox, radio, date, number, search, color, range, submit, button
- labels / name / id / autocomplete matching password, OTP, payment, SSN, API key, token
- composer labels: comment, tweet, chat, search, compose, message board, unless they also look like email/name/phone
- unlabeled `type=text` that is not inside a `<form>` and has no autocomplete

**A slot**

- `input type=email|tel|url`
- autocomplete in the name/email/phone/address/organization family
- inside a `<form>` (or labelled control) with a real label, placeholder, name, or aria-label
- textarea labelled like summary, bio, cover letter, title, company, location

Nearby field labels are sent as context. They are never written.

## Decision

Clipboard cap sent to the model: 12,000 characters. Insert still uses the original string for “whole”.

### Candidates (code)

Always include `whole`. Also find, with original offsets:

- emails, URLs, phones
- `Label: value` lines
- short lines (1–80 characters)
- 1–4 word Capitalized name-like spans

Dedupe by exact text. Cap 40 plus `whole` and `none`.

### Fast path (no model)

- Field kind `email` and exactly one unique email in the chunk → that email
- Same for `url` and `tel`
- First / last / middle / full name fields: if the chunk contains exactly one person name (or a `Name:` line), split on whitespace. First token → first name, last token → last name (particles like `van` stay on the last name). Two people in the chunk → no guess, fall through to Jev or whole
- Street / city / state / ZIP: if the chunk contains exactly one `City, ST 12345` line, take city, state, ZIP from it and the numbered street line above it
- Clipboard looks like a secret (private key, credit-card-shaped run) → whole, and do not call the model

### Jev (`jev-1.13.0`)

One request, 2.5s timeout:

- `wants_extracted` (noul): does this field want a value taken out of the clipboard, not the whole clipboard?
- `pick` (choice): `none` | `whole` | `c0`… with criteria describing each candidate

Then code:

- `wants_extracted < 0.72` → whole
- pick `none` / `whole` / missing → whole
- choice confidence `< 0.5` or probability lead `< 0.12` → whole
- picked text must equal `clipboard.slice(start, end)`
- shape gates: email field must be an email; name-like text fields cannot be an email or URL or longer than 120 characters

If the pick is a slice, a second request (1.5s): noul “is this the complete correct value for this field, copied from the clipboard?” `< 0.82` → whole.

Any throw, abort, or HTTP error → whole.

## Insert

Use the native value setter so React/Vue see the change. Dispatch `input` (`insertFromPaste`) and `change`. Restore focus. Do not submit the form.

A 1.2s corner toast appears only when a slice was used.

## Key

- `.env` `TYPESAFE_API_KEY` baked in at `npm run build`
- Options / toolbar popup can override, stored in `chrome.storage.local`
- Worker prefers storage, then the baked key
- No key: do not intercept (native paste)

The key never goes into the content script or to any host except `https://api.typesafe.ai/`.

## Permissions

`storage`. Host: `https://api.typesafe.ai/*`. Clipboard is read from the paste event, not `clipboardRead`.

## Out of scope

macOS-wide paste, clipboard history, filling multiple fields, native apps, shadow DOM, iframes with a closed tree, rich-text editors.
