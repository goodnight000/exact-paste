# How Exact Paste works

Normal paste is Chrome's own paste. Exact Paste runs only when the user presses its separate smart-paste shortcut, normally Option+Shift+V on Mac or Alt+Shift+V on Windows and Linux.

## From shortcut to value

`extension/manifest.json` registers `smart-paste`. `extension/worker.ts` routes it to the focused tab. `extension/content.ts` handles the focused frame and reads clipboard text once. It also recognizes trusted keys for the currently assigned shortcut, supporting Chrome's headless path. Fake paste/key/click events do not authorize clipboard or saved-data access.

`src/paste.ts` captures the field and its current value/selection before reading. It calls the worker for a local decision. Clear headed templates can insert immediately. Inferred values and saved details require a genuine choice; uncertain matches offer Paste original. The page never gets a saved value before the user chooses to insert it.

A user edit, selection change, Tab, another invocation or changed settings cancels the request. Pending work never replaces newer input. The choice panel is keyboard accessible, dismissible with Escape and expires after 30 seconds. Normal paste continues to use site paste and beforeinput handlers.

## Matching

`src/field.ts` checks eligibility and describes the field using its accessible label, kind and nearby labels. Sensitive fields and unsupported editors retain native paste. A labelled essay question can receive headed answers, but words inside the question do not turn it into a first-name slot.

`src/template.ts` scans the entire original clipboard, matches exact normalized labels/aliases, and preserves source offsets. It handles Markdown, numbered questions, inline values, multiline answers, fenced code and nested headings. Conflicting duplicate answers are refused. Prose preceding template headers makes a match reviewable.

`src/decide.ts` tries templates first, then local scalar, name, address and business extractors. Heuristic results are suggestions. Personal/work/company qualifiers, parsed platform hosts, full addresses vs units, distinct invoice fields and phone components prevent related fields from being conflated. Ambiguous cultural name parts require explicit labels.

`src/resolve.ts` gives matching clipboard answers precedence. Saved data is available only when the user enables the source preference; it is always offered for confirmation. `src/profile.ts` preserves structured saved answers without parsing their contents as new headers and handles legacy vault migration.

## AI and privacy

No key is needed. With a TypeSafe key, the user can choose Ask Jev on an uncertain match. That button explains that it sends clipboard and field information to TypeSafe. It never sends anything automatically on normal or local smart paste.

`src/jev.ts` calls `jev-1.13.0`; `src/decide.ts` offers exact-source candidates, checks the selection and asks for a second verification. It never accepts model-generated replacement text. Recognized secrets and sources over 12,000 characters block requests. The thresholds and deadlines are specified in [SPEC.md](../SPEC.md). Model suggestions still need confirmation.

## Editing and undo

`src/apply.ts` checks complete values against remaining field limits. `src/insert.ts` uses Chrome's native `insertText` editing command, preserving selection and undo history. Production does not fall back to a whole-field value setter when native editing is unsupported. The DOM-only fallback supports unit tests without an editing engine.

Feedback offers Undo and Paste original. Both are guarded against newer changes. Paste original undoes the smart edit before using the original selection. Chrome's native line-ending and input normalization still apply.

## Install and verification

On first install, Chrome opens `welcome.html`. Its practice fields use the same `installPaste` and `resolvePaste` code as website fields, with no saved details or AI. The worker routes the registered command to that focused tutorial. The popup can reopen it. The tutorial reads clipboard text only when smart paste is invoked; its Copy sample button writes fictional text when clicked.

`npm start` builds locally and prints the folder for Chrome's Load unpacked step. `npm run package` makes both a key-free download ZIP and a store-format ZIP. No API key is necessary or included.

`npm test` and `npm run typecheck` check local behavior. `npm run verify` exercises the built extension with real Chrome clipboard, shortcuts, selections, undo, choices, profile editing, frames and shadow roots. The release workflow extracts the ZIP and verifies that artifact. `npm run record-demo` creates a genuine screen recording using fictional data and no model calls.

Chrome's site-access controls can disable the extension on individual websites. Clipboard text reading needs HTTPS or localhost. Rich editors, closed shadow roots, native applications and Chrome internal pages use normal paste. Site-specific editor behavior and live Jev accuracy need their own verification; local green tests do not establish either.
