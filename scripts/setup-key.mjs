import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

export function hidden(query, input = stdin, output = stdout) {
  if (!input.isTTY) {
    return new Promise((resolve, reject) => {
      const rl = createInterface({ input, output });
      let answered = false;
      rl.on('close', () => { if (!answered) reject(new Error('No input. Build without a key or add it in Settings.')); });
      rl.question(query, (answer) => { answered = true; resolve(answer.trim()); rl.close(); });
    });
  }
  return new Promise((resolve, reject) => {
    output.write(query); input.setRawMode(true); input.resume();
    let value = '';
    const cleanup = () => {
      input.off('data', onData); input.off('end', onEnd);
      input.setRawMode(false); input.pause();
    };
    const onEnd = () => { cleanup(); reject(new Error('Input ended before a key was entered.')); };
    const onData = (chunk) => {
      // Terminal paste delivers many characters at once, often with bracketed-paste markers.
      const text = chunk.toString('utf8').replace(/\u001b\[20[01]~/g, '');
      for (const char of text) {
        if (char === '\u0003') { cleanup(); output.write('\n'); reject(new Error('Cancelled.')); return; }
        if (char === '\r' || char === '\n') { cleanup(); output.write('\n'); resolve(value.trim()); return; }
        if (char === '\u007f' || char === '\b') { value = value.slice(0, -1); continue; }
        if (char >= ' ' && char !== '\u001b') { value += char; output.write('•'); }
      }
    };
    input.on('data', onData); input.once('end', onEnd);
  });
}

export async function checkKey(key, request = fetch) {
  const res = await request('https://api.typesafe.ai/v1/systemone', {
    method: 'POST', signal: AbortSignal.timeout(5000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-1.13.0', state: 'ok',
      questions: { ping: { type: 'noul', instructions: 'Is this a short test string?' } } }),
  });
  if (res.status === 401 || res.status === 403) return false;
  if (!res.ok) throw new Error(`TypeSafe HTTP ${res.status}`);
  const body = await res.json();
  if (body?.answers?.ping?.type !== 'noul' || !Number.isFinite(body.answers.ping.noul)) {
    throw new Error('TypeSafe returned an invalid key-check response.');
  }
  return true;
}
