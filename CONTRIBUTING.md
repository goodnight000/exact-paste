# Contributing

Use Node 22.15+. Run `npm ci`, `npm test`, and `npm run typecheck`. Local tests do not call Jev.

Add realistic clipboard/field regressions for matching changes, including a case that rejects the wrong answer. Add HTML slot cases to `eval/slot-fixtures.ts` for field detection. Avoid guesses tied to one demo or one application site.

`npm run package` builds key-free download and store ZIPs. `npm run verify` loads the actual extension in a temporary Chrome profile and uses native clipboard and smart-shortcut commands. Set `CHROME_PATH` if needed. Keep checks finite and close the browser after finishing. Normal paste must remain untouched; synthetic keys and choice-button events cannot authorize a smart insertion.

`npm run eval` needs `TYPESAFE_API_KEY` and calls live Jev. A wrong slice is an unsafe failure; a whole fallback is a safe miss. Keep provider errors, local checks, and model accuracy claims distinct.

If you change the interaction or application demo, run `npm run rehearse` after building. It verifies the new key-free workflow, including normal paste, smart shortcut, confirmation and undo. Historical live-Jev scene results do not establish accuracy for a new version. Live evaluation requires separate authorization and a key.

Do not commit `.env`, personal `dist` builds, raw traces, or generated test screenshots. README demo media is intentionally checked in; regenerate it with `npm run build` then `npm run record-demo` using fictional values only. Chrome and FFmpeg are needed for recording.

Onboarding is `npm start`: a local build, a clear folder path, and Chrome's Load unpacked step. API keys are optional. Preserve unrelated local changes when updating an existing install.
