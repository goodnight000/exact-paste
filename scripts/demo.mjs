import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = join(dirname(fileURLToPath(import.meta.url)), '../demo');
const port = Number(process.env.PORT ?? 4173);
const server = createServer(async (request, response) => {
  try {
    const file = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (!/^[\w.-]+$/.test(file)) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }[extname(file)] ?? 'text/plain');
    response.end(await readFile(join(directory, file)));
  } catch { response.writeHead(404).end('Not found'); }
});
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`Exact Paste demos: http://127.0.0.1:${port}/application.html`));
