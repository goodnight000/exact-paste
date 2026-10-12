# Chrome Web Store preparation

Prepared v0.4 materials. Nothing in this file indicates that the extension has been submitted, approved or published.

## Upload

Run `npm run package`. Upload `release/exact-paste-store.zip`; manifest.json is at the archive root. The ordinary `exact-paste.zip` contains a folder for manual installation and is the download for technical users. Both archives are key-free.

Use the authorized publisher account, complete any account requirements shown by Google, and select Public distribution for discovery and installation. Inspect the exact release contents and test the extracted package before submission. Google review must finish before a public installation link is available.

## Listing copy

Name: Exact Paste

Short description: One shortcut to paste a matching answer from copied text. Normal paste stays normal.

Description:

Copy an application draft once. Press Option+Shift+V on Mac, or Alt+Shift+V on Windows/Linux, in each field to paste the answer under its matching header. Cmd+V/Ctrl+V keeps Chrome's normal behavior.

Exact Paste inserts only into the field you choose. It respects selections, supports Chrome's undo, and never submits a form. Uncertain matches offer a choice. Optional saved details are offered for confirmation; they are not silently substituted.

Local matching needs no API key. Optional TypeSafe Jev suggestions require your own key and an explicit Ask Jev action before text is sent to the provider. AI suggestions still need confirmation.

A first-run practice page lets you copy a fictional sample, compare normal and smart paste, and undo the result. Reopen it anytime from the extension popup.

Supports labelled text, email, phone and URL inputs and application textareas. Rich editors and unsupported controls keep normal paste. Smart clipboard reading requires HTTPS or localhost. Some custom site editors may require normal paste.

Source code is MIT licensed at https://github.com/goodnight000/exact-paste.

## Purpose and permissions

Single purpose: insert an exact matching clipboard answer or a confirmed saved detail into the one form field selected by the user.

- clipboardRead: read text once when the user invokes the smart-paste command; no polling or clipboard history.
- storage: keep optional saved details, API key, shortcut availability and inactive session drafts.
- HTTP(S) content scripts, including frames: locate and edit the chosen field on sites where the user invokes smart paste. They do not intercept normal paste or collect browsing history.
- api.typesafe.ai host permission: optional provider request authenticated with the user's own key, only after choosing Ask Jev. Responses select data; no remote executable code is loaded.

Use https://github.com/goodnight000/exact-paste/blob/main/docs/PRIVACY.md as the public privacy-policy URL after pushing this release. The privacy-practices form must disclose the clipboard, field information and saved personal information that the extension handles, and the optional direct TypeSafe transfer. Check the actual dashboard categories when submitting; do not claim data stays local when AI is enabled and invoked.

## Reviewer instructions

1. Install without a key. Assign the shortcut through chrome://extensions/shortcuts if needed.
2. Copy `Email: demo@example.com` and use smart paste in a labelled Email field on HTTPS or localhost. It inserts the address.
3. Normal Cmd+V/Ctrl+V pastes the entire copied string. Undo works for both paths.
4. Copy prose containing an email. Smart paste offers a choice and leaves the field unchanged until a genuine selection.
5. Add a saved GitHub URL, enable the saved-detail preference, Save, and smart paste into GitHub with an unrelated or empty clipboard. Choose Use saved detail.
6. AI is optional and requires a reviewer-owned TypeSafe key; no developer key is included.

## Store images

Run `npm run package`, then `node scripts/store-assets.mjs` to capture the extension using fictional data. `docs/store/` contains three 1280x800 screenshots, a 440x280 promotional image and a 128x128 icon, matching Google's [image requirements](https://developer.chrome.com/docs/webstore/images). No personal Chrome profile or API calls are used. The images are preparation materials, not proof of store acceptance.

Known limit: very large clipboard checks have intermittently fallen back or failed in native-copy automation. Later exact-header checks passed; the cause is unconfirmed. Matching uncertainty leaves the field unchanged and offers Paste original. No live Jev accuracy claim is made by local tests.
