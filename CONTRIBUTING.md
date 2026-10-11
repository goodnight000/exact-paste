# Contributing

Use Node 22.15+. Run `npm ci`, `npm test`, and `npm run typecheck`. Local tests do not call Jev.

Add realistic clipboard/field regressions for matching changes, including a case that rejects the wrong answer. Add HTML slot cases to `eval/slot-fixtures.ts` for field detection. Avoid guesses tied to one demo or one application site.

`npm run package` builds a key-free ZIP. `npm run verify` loads the actual extension in a temporary Chrome profile and uses native clipboard commands. Set `CHROME_PATH` if needed. Keep these checks finite and close the browser after finishing. Synthetic paste events must stay blocked; don't weaken the trust check to make a test pass.

`npm run eval` needs `TYPESAFE_API_KEY` and calls live Jev. A wrong slice is an unsafe failure; a whole fallback is a safe miss. Keep provider errors, local checks, and model accuracy claims distinct.

Do not commit `.env`, personal `dist` builds, raw traces, or generated test screenshots. README demo media is intentionally checked in; regenerate it with `npm run build` then `npm run record-demo` using fictional values only. Chrome and FFmpeg are needed for recording.

Onboarding is `npm start`: a local build, a clear folder path, and Chrome's Load unpacked step. API keys are optional. Preserve unrelated local changes when updating an existing install.
