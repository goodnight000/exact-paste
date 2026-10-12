# Exact Paste privacy policy

Effective October 12, 2026. Applies to Exact Paste v0.4.

Exact Paste helps insert an exact value from copied text into the field you choose. Normal paste is unaffected. The extension never submits forms.

## Clipboard and website information

The extension requests clipboard-read permission so its separate smart-paste shortcut can read text once when you invoke it. It does not monitor copying, poll the clipboard, keep clipboard history, or read clipboard data during ordinary paste.

The first-run tutorial uses the same local paste behavior. Its Copy sample button replaces your clipboard with fictional practice text only when clicked. It does not use saved details or AI.

During smart paste it reads the chosen field's label, type, name, placeholder, autocomplete information and nearby field labels. Local matching runs on your device. Candidate choices shown on a website may be readable by that website. A value you choose to insert becomes part of that site's form and is subject to that site's policies.

## Saved details

Details, notes and any optional API key are stored in Chrome's local extension storage. Exact Paste does not encrypt this storage. Unsaved settings drafts use Chrome's session storage. Saved details are offered only when you enable that option, and require your confirmation before insertion. Saved values are not displayed on a website before you choose to insert them.

You can edit or remove saved entries in Settings. Removing the extension clears its extension storage.

## Optional AI

No account or API key is required for local matching. If you add your own TypeSafe key, an Ask Jev action becomes available. Only choosing that action sends unresolved clipboard text, field metadata and nearby field labels, and any enabled fallback notes, to https://api.typesafe.ai. Structured saved fields are matched locally. The key authenticates requests to TypeSafe and is not sent to the website's JavaScript.

TypeSafe processes those requests under its own terms and privacy practices. Exact Paste does not claim that TypeSafe retains no data or trains on no data. Review the provider's current practices before using AI with sensitive text. Recognized secrets block requests, but the detector is not comprehensive.

## Tracking and sharing

Exact Paste has no analytics, advertising, tracking or developer-operated server. It does not sell data. The developer does not receive your clipboard, saved details or browsing data through the extension. Optional AI requests go directly to TypeSafe; ordinary website form submissions remain under your control.

## Contact

Questions and bug reports: https://github.com/goodnight000/exact-paste/issues. Do not post private clipboard text, saved details or API keys in a public issue.
