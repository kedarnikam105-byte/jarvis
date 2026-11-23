import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { URL } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';

const HOST = '127.0.0.1';
const PORT = 8765;
const clients = new Set();
const APP_MAP = {
  chrome: ['cmd.exe', ['/c', 'start', '', 'chrome']],
  edge: ['cmd.exe', ['/c', 'start', '', 'msedge']],
  notepad: ['notepad.exe', []],
  calculator: ['calc.exe', []],
  vscode: ['cmd.exe', ['/c', 'start', '', 'code']],
  explorer: ['explorer.exe', []],
  terminal: ['wt.exe', []],
  cmd: ['cmd.exe', []],
  spotify: ['cmd.exe', ['/c', 'start', '', 'spotify:']],
  outlook: ['cmd.exe', ['/c', 'start', '', 'outlook']],
};

function systemInfo() {
  return {
    os: os.type() + ' ' + os.release(), machine: os.arch(), node: process.version,
    time: new Date().toLocaleTimeString(), total_memory_bytes: os.totalmem(),
    free_memory_bytes: os.freemem(), uptime_seconds: os.uptime(),
  };
}

function launch(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.once('spawn', () => { child.unref(); resolve(); });
    child.once('error', reject);
  });
}

async function executeAction(action) {
  const target = String(action.target || '').trim();
  switch (action.type) {
    case 'open_app': {
      const item = APP_MAP[target.toLowerCase()];
      if (!item) return { ok: false, message: 'App is not in the safe allowlist: ' + target };
      await launch(item[0], item[1]);
      return { ok: true, message: 'Launched ' + target + ' on Windows.' };
    }
    case 'open_url': {
      let parsed;
      try { parsed = new URL(target); } catch { return { ok: false, message: 'The URL is invalid.' }; }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, message: 'Only http/https URLs are permitted.' };
      await launch('rundll32.exe', ['url.dll,FileProtocolHandler', parsed.href]);
      return { ok: true, message: 'Opened URL: ' + parsed.href };
    }
    case 'create_file': {
      const folder = path.join(os.homedir(), 'Desktop', 'JARVIS_Notes');
      fs.mkdirSync(folder, { recursive: true });
      const base = path.basename(target);
      const fileName = (!base || base === '.' || base === '..' ? 'note_' + Date.now() + '.txt' : base).replace(/[\\x00-\\x1f<>:"|?*]/g, '_');
      const filePath = path.join(folder, fileName);
      fs.writeFileSync(filePath, 'Created by J.A.R.V.I.S. at ' + new Date().toISOString() + '\n', 'utf8');
      return { ok: true, message: 'Created file at ' + filePath };
    }
    case 'system_info': return { ok: true, message: 'Windows system information retrieved.', data: systemInfo() };
    case 'lock_screen':
      await launch('rundll32.exe', ['user32.dll,LockWorkStation']);
      return { ok: true, message: 'Windows workstation locked.' };
    case 'clean_temp': {
      let removed = 0;
      for (const name of fs.readdirSync(os.tmpdir())) {
        if (!name.startsWith('jarvis_tmp_')) continue;
        try { fs.rmSync(path.join(os.tmpdir(), name), { recursive: true, force: true }); removed += 1; } catch { /* Skip files in use. */ }
      }
      return { ok: true, message: 'Temp sweep complete (' + removed + ' JARVIS temporary items cleared).' };
    }
    default: return { ok: false, message: 'Unsupported action type: ' + action.type };
  }
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

const server = new WebSocketServer({ host: HOST, port: PORT, maxPayload: 1024 * 1024 });
server.on('connection', (socket, request) => {
  const origin = request.headers.origin || '';
  if (!['http://localhost:8443', 'http://127.0.0.1:8443', 'https://localhost:8443', 'https://127.0.0.1:8443'].includes(origin)) {
    socket.close(1008, 'Local browser origin required');
    return;
  }
  clients.add(socket);
  send(socket, { type: 'hello', system: systemInfo() });
  socket.on('message', async (raw) => {
    let payload;
    try { payload = JSON.parse(raw.toString()); } catch { send(socket, { type: 'error', message: 'Invalid JSON message.' }); return; }
    if (payload.type === 'ping') send(socket, { type: 'pong', system: systemInfo() });
    else if (payload.type === 'execute') {
      const action = payload.action || {};
      try {
        const result = await executeAction(action);
        send(socket, { type: 'action_result', actionId: action.id, ...result });
      } catch (error) {
        send(socket, { type: 'action_result', actionId: action.id, ok: false, message: String(error.message || error) });
      }
    }
  });
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
});
server.on('listening', () => console.log('[J.A.R.V.I.S.] Windows companion listening on ws://' + HOST + ':' + PORT));
server.on('error', (error) => { console.error('[J.A.R.V.I.S.] Companion failed: ' + error.message); process.exitCode = 1; });
process.on('SIGINT', () => { for (const socket of clients) socket.close(); server.close(() => process.exit(0)); });
