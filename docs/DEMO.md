# Exact Paste v0.4 demo

A 45–60 second screen demo. Use the real extension, fictional sample data and no API key. Normal paste is always normal; Option/Alt+Shift+V invokes smart paste once.

## Prepare

```sh
npm ci
npm run package
npm run verify
npm run demo
npm run open
```

The demo is at http://127.0.0.1:4173/application.html. In your everyday Chrome, load the extracted exact-paste folder through chrome://extensions, reload the demo tab, and pin the extension. The popup shows the smart-paste and normal-paste keycaps. Expand Shortcut options to change the assigned shortcut if another app uses the binding.

## Show these beats

1. Copy the entire application draft once with Copy all.
2. Click Email and use normal Cmd+V/Ctrl+V. The whole draft pastes. Undo it. Say: “Your regular paste still works exactly as before.”
3. Press Option/Alt+Shift+V in Email. Only its matching answer appears. Say: “This shortcut asks for the answer that belongs in this box.”
4. Smart paste into Website, About your company and What are you building. Show a complete multiline answer. Say: “One copy, then one shortcut for each question.”
5. Open settings, choose Add detail → GitHub, enter a fictional URL, enable Offer when clipboard has no match, and Save. Smart paste into the empty GitHub field. Choose Use saved detail. Say: “Saved details are offered, never slipped in without asking.”
6. Copy prose mentioning a support email and smart paste into Email. Show the proposal with the field still unchanged. Choose Paste original or dismiss. Say: “If it isn’t certain, you choose.”
7. Show Cmd+Z/Ctrl+Z or Undo restoring the previous text. End on the filled form, without submitting.

Select all to replace an existing value. A partial selection replaces only those words. Never suggest that AI is needed for the application demo or that guesses insert automatically. Do not show personal saved details or keys.

`npm run record-demo` records the real setup and application flow to local review media. `npm run rehearse` runs the key-free browser rehearsal. Older Ship, Vendor, Bill, Guest, Links and Apply scenes remain available for exploration; heuristic matches now require confirmation. Their historical live-Jev outcomes are not a claim about the new interaction.

## Installation for viewers

Download exact-paste.zip, extract it somewhere permanent, open chrome://extensions, enable Developer mode, Load unpacked, choose the exact-paste folder, and reload form tabs. No Node or key is needed. The Chrome Web Store upload ZIP is separate; public store installation requires a developer account, listing and review.
