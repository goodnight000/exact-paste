# Exact Paste contract

A desktop Chrome extension. A genuine user paste into one labelled form field can insert an exact value from the clipboard or saved details. It never generates an answer, fills other fields, or submits a form.

## Event boundary

Only trusted, nonempty plain-text paste events are eligible. Synthetic events, Shift+paste, a disabled extension, and unsupported controls use Chrome's normal paste. Clipboard text comes from the paste event, not background clipboard polling.

Eligible controls are enabled, visible, editable text/email/phone/URL inputs and labelled application textareas. Accessible-name priority is aria-labelledby, aria-label, associated labels, then placeholder. Sensitive-purpose checks independently inspect placeholders, names, IDs, autocomplete, and label text.

Password, payment, verification-code, search, comment, and chat controls are excluded. Numeric/date controls and contenteditable use native paste. Open shadow roots and frames created by matching HTTP(S) origins are supported; closed shadow roots, native applications, and Chrome internal pages are not.

## Source precedence

1. A validated exact clipboard match wins.
2. Conflicting/empty headers, invalid matching values, unsafe model decisions, secrets, and huge uncertain copies preserve the copied text. They cannot borrow an unrelated saved value.
3. If the clipboard has no clear match, a matching structured saved field can supply its exact value. Duplicate saved labels with different values are ambiguous.
4. Saved notes or a legacy vault can supply a validated substring if no structured field matches.
5. Otherwise the decision is the whole clipboard.

Standalone textarea prose stays the whole clipboard. A template missing a textarea answer can use saved data only when another nonempty header exactly matches a nearby form field. Merely containing Markdown is not enough.

`profile` and its compatibility `vault` are saved together. The worker uses structured fields directly when the serialized profile agrees with the vault, preserving literal headings and colons inside values. If the vault has changed independently, it takes precedence over the stale profile. Legacy vault text is preserved in notes during migration.

## Local matching

Header parsing scans the entire original source. It accepts exact normalized labels, explicit common aliases, `Label: value`, standalone known labels, Markdown/bold headings, and numbered questions. Unicode normalization affects header comparison only. Answers retain their original offsets and internal text.

Nearby form labels provide plain-template boundaries. Markdown peers end an answer; deeper subheadings and fenced code stay inside it. Unclear plain boundaries and conflicting duplicates fall back. Personal/work and company/personal qualifiers are preserved.

Single-value email, phone, URL, name, address, and business paths remain available. Platform fields validate the actual parsed host, not URL substrings. Independent URLs with shared path prefixes remain separate. Regex bounds avoid expensive rescanning of huge invalid tokens.

## Jev

Optional model `jev-1.13.0` through `https://api.typesafe.ai/v1/systemone`.

Unresolved sources over 12,000 characters never go to the model. Recognized secrets in the source or field metadata also block model requests. This is a conservative detector, not a complete sensitive-data classifier.

Candidate extraction includes template sections, scalar values, short lines, names, and business values with source offsets. At most 40 candidates plus whole and none are offered. Jev never supplies replacement text.

Selection thresholds remain wants_extracted >=0.72, confidence >=0.5, and probability lead >=0.12. Every probability/noul/confidence must be finite and within [0,1]. The picked candidate must equal its exact source slice and satisfy field shape/platform checks. A second verification requires >=0.82. Exceptions, invalid responses, auth failures, and timeouts fall back.

Individual selection/verification requests have 2.5s/1.5s limits. The worker allows at most 4.5s of API time across clipboard and saved-note decisions. The content script bounds the total reply wait at 5s.

## Applying the decision

Only the original field can be written. A request captures its value, selection, metadata, limit, and settings epoch. A newer paste, user input, focus change, disabled/removed field, or changed settings invalidates it. A late reply cannot overwrite newer work or move focus.

A slice replaces the field only if its complete normalized value fits maxlength. It is never shortened. Browser-native textarea newline normalization applies. A refusal shows "Too long for this field. Nothing pasted."

For a whole fallback, an empty field or a fully selected value receives the clipboard subject to native control limits. A partial selection receives only the text that fits while preserving the unselected suffix. Existing values with no selection stay unchanged. Truncation never splits a UTF-16 surrogate pair.

The native value setter is used. Composed input/change events notify frameworks and shadow-root ancestors. A toast appears for inserted slices. No submit or focus restoration occurs.

## Settings and distribution

Local storage contains enabled, optional apiKey, profile, and vault. Unsaved drafts use extension session storage and do not affect active paste data until Save. The editor stays inert until stored data loads; failed loads cannot overwrite it with an empty form.

Builds omit API keys by default. `--with-key` explicitly creates a personal build from the environment/.env key. A saved key, including an explicit empty key, overrides a baked key. API keys are never returned to the page.

`npm run package` forces a key-free build and ZIP with a fixed file list. Chrome requires the user to load the unpacked folder. Setup never silently installs an extension or starts a separate persistent browser session.

## Verification boundaries

Local regression tests and the browser harness make no model calls. The harness uses a fresh Chrome profile, the built extension/worker, and native copy/paste commands. Live Jev quality requires the separate API evaluation; a green unit/browser suite does not prove it.
