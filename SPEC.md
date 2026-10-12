# Exact Paste contract

A desktop Chrome extension. Cmd+V/Ctrl+V always uses Chrome's native paste. Option+Shift+V on Mac or Alt+Shift+V on Windows/Linux requests one smart paste. There is no persistent smart-paste mode. It never generates replacement text, fills other fields, or submits a form.

## Invocation and permissions

The registered `smart-paste` Chrome command targets the focused tab/frame. A trusted keydown handler supports the same assigned command in Chrome's headless path. Synthetic keyboard, paste, and feedback-button events cannot invoke clipboard access or insert saved values. Users can change or remove the binding at chrome://extensions/shortcuts.

`clipboardRead` is needed to read text when the shortcut is invoked. There is no clipboard polling or history. Text reading requires a secure page, including HTTPS and localhost. If unavailable, the extension explains how to use normal paste. Unsupported editors use native paste when Chrome permits it.

Eligible controls are visible, enabled, editable text/email/phone/URL inputs and labelled textareas. Password, payment, verification-code, search, comment, and chat controls are excluded. Numeric/date controls and rich editors retain native paste. Open shadow roots and matching frames are supported; closed shadow roots, native apps and Chrome internal pages are outside smart support.

## Matching and sources

1. An exact normalized clipboard header matching the focused field can insert immediately when the source starts with template headers. Whole-field replacement requires selecting the whole field. Introductory prose before a header makes the match a suggestion.
2. Local heuristic extraction produces a suggestion, never an automatic write. Uniqueness does not prove identity, ownership or purpose.
3. Saved details are disabled by default. Enabling “Offer when clipboard has no match” allows an exact saved field or saved note to be offered when the clipboard has no matching answer. Saved suggestions require confirmation and are labelled by source; their values are not exposed in the page before insertion.
4. Conflicting/empty headers, invalid values, secrets, huge uncertain sources and unsafe model decisions cannot silently borrow saved values.
5. Otherwise the user can choose a candidate or Paste original. Sources longer than 12,000 characters are not enumerated as uncertain candidates or sent to AI; exact header matching still scans the full source.

The visible field label takes precedence over machine names. Essay questions mentioning a first name are not name slots. Personal/work and company/personal qualifiers remain distinct. Address line 2 means unit, not street. A full street-address textarea preserves the unit. Invoice number, invoice date and due date use distinct rules. Calling codes and phone extensions have their own shapes. Compound or unspaced names require explicit name-part labels rather than a guessed split.

Header parsing preserves source offsets and complete multiline answers, including nested Markdown and fenced code. Duplicate conflicting answers are rejected. Structured profile fields are used directly, preserving literal headings in saved answers. A changed legacy vault takes precedence over a stale structured copy.

## Optional Jev

A user's optional TypeSafe key makes an Ask Jev button available. Only choosing that button authorizes the request; an ordinary or local smart paste never calls AI automatically.

Model `jev-1.13.0` uses https://api.typesafe.ai/v1/systemone. The complete unresolved clipboard, field metadata/nearby labels, and enabled fallback notes may be sent. Recognized secrets block model requests, but the detector is not a complete sensitive-data classifier. Structured saved fields match locally.

Jev selects a candidate substring and verifies it; it cannot supply new replacement text. Limits remain wants_extracted >=0.72, confidence >=0.5, lead >=0.12 and second verification >=0.82. Probabilities must be finite and within [0,1]; the selected value must be the exact source slice and satisfy field shape/platform checks. At most 40 candidates plus whole/none are offered to the model. Errors and timeouts leave a choice available without writing.

Requests have 2.5s/1.5s selection/verification limits; the worker bounds aggregate API time at 4.5s and the UI reply wait at 5s. Model output always requires user confirmation.

## Editing and feedback

A request captures field identity, value, selection, metadata, limit and settings epoch before reading clipboard text. User input, cursor/selection changes, focus changes, another invocation, settings changes, disabled/removed controls or navigation invalidate it. Late results cannot overwrite work. Cancellation is visible; no late normal fallback is inserted.

Smart edits insert at the cursor or replace only the selection using Chrome's native editing command. They create native undo entries. Complete smart values must fit the remaining maxlength; they are never shortened. Native newline/control normalization applies. Email controls do not expose their selection through the DOM, so length checks conservatively account for the existing value.

Feedback offers Undo and Paste original. Paste original first undoes the smart edit, checks that the original value was restored, then inserts the original clipboard at the captured selection. Actions expire or invalidate after subsequent edits, selection changes, focus/settings changes or navigation. Choice buttons require trusted user input and are keyboard accessible. Escape dismisses feedback and returns from the choice panel to the field.

Ordinary paste remains native, including site paste/beforeinput handling, masks, rich formats and undo. Smart editing compatibility is verified in Chrome fixtures; unknown site-specific editors can use normal paste or Chrome's per-site extension access controls.

## Settings and distribution

Local storage contains enabled (shortcut availability), optional apiKey, useSaved, profile and compatibility vault. Profile/key/source preference are saved together. Session drafts are inactive until Save. Failed loads cannot overwrite saved data with an empty editor.

Builds are key-free by default. An explicit --with-key creates a personal build; never distribute it. `npm run package` forces a key-free build with a fixed file list and creates a downloadable ZIP containing an exact-paste folder plus a store ZIP with manifest.json at its root. Fresh installs open shortcut/setup help.

## Verification

Unit tests and `npm run verify` make no model calls. Native browser verification uses a temporary Chrome profile, real clipboard/key commands, matching decisions, selection, undo, genuine choice buttons, settings, shadow roots, frames and extracted release ZIPs. `npm run record-demo` records fictional data with no key. Live AI accuracy is a separate opt-in evaluation, not established by local checks.
