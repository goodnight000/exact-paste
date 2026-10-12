// Key-free rehearsal of the supported v0.4 interaction and application demo.
import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['scripts/verify.mjs',...process.argv.slice(2)],{stdio:'inherit'});
if(result.status!==0)process.exit(result.status??1);
console.log('ALL_OK — native shortcut, confirmation, undo, settings and application demo; no API calls.');
