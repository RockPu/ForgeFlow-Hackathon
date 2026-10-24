import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  throw new Error('Install Node.js 22.12 or newer, then retry.');
}
if (existsSync('.env')) process.loadEnvFile('.env');

const command = process.argv[2];
const pnpmEntry = process.env.npm_execpath;
if (!pnpmEntry || !pnpmEntry.toLowerCase().includes('pnpm')) {
  throw new Error('Use pnpm setup:local, pnpm dev, pnpm build, pnpm start, or pnpm test.');
}
const webPort = Number(process.env.FORGEFLOW_WEB_PORT || 5173);
const apiPort = Number(process.env.FORGEFLOW_API_PORT || 3001);
for (const port of [webPort, apiPort]) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('Local ports must be whole numbers between 1024 and 65535.');
  }
}
if (webPort === apiPort) throw new Error('Web and API ports must be different.');
const env = { ...process.env, NODE_ENV: 'development', BASE_PATH: '/' };
function requireDatabase() {
  if (!env.DATABASE_URL || env.DATABASE_URL.includes('YOUR_PASSWORD')) {
    throw new Error('Copy .env.example to .env and enter YOUR local PostgreSQL DATABASE_URL first.');
  }
}
function run(args, extra = {}) {
  const result = spawnSync(process.execPath, [pnpmEntry, ...args], {
    cwd: root, stdio: 'inherit', env: { ...env, ...extra },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
function stopChild(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already stopped */ }
  }
}
async function serve(compiled) {
  requireDatabase();
  if (compiled && (!existsSync('artifacts/api-server/dist/index.mjs') ||
    !existsSync('artifacts/forgeflow/dist/public/index.html'))) {
    throw new Error('Run pnpm build before pnpm start.');
  }
  const jobs = [
    { args: ['--filter', '@workspace/api-server', ...(compiled
      ? ['run', 'start'] : ['exec', 'tsx', 'watch', 'src/index.ts'])], port: apiPort },
    { args: ['--filter', '@workspace/forgeflow', 'exec', 'vite',
      ...(compiled ? ['preview'] : []), '--config', 'vite.local.config.ts'], port: webPort },
  ];
  const children = jobs.map(({ args, port }) => spawn(process.execPath, [pnpmEntry, ...args], {
    cwd: root, stdio: 'inherit', env: { ...env, PORT: String(port) },
    detached: process.platform !== 'win32',
  }));
  let stopping = false;
  function stop(code) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    children.forEach(stopChild);
  }
  process.once('SIGINT', () => stop(0));
  process.once('SIGTERM', () => stop(0));
  for (const child of children) {
    child.once('error', (error) => { console.error(error.message); stop(1); });
    child.once('exit', (code) => { if (!stopping) stop(code || 1); });
  }
  console.info(`ForgeFlow will be at http://localhost:${webPort}/ when Vite reports ready. Keep this terminal open. Ctrl+C stops both services.`);
  await Promise.all(children.map(child => new Promise(resolve => child.once('close', resolve))));
}

switch (command) {
  case 'setup':
    requireDatabase();
    console.info('Applying the ForgeFlow schema and demo fixtures. Use a dedicated empty local database.');
    run(['--filter', '@workspace/db', 'run', 'push']);
    run(['--filter', '@workspace/api-server', 'run', 'factory:seed']);
    break;
  case 'build':
    run(['--filter', '@workspace/api-server', 'run', 'build']);
    run(['--filter', '@workspace/forgeflow', 'exec', 'vite', 'build', '--config', 'vite.local.config.ts'],
      { PORT: String(webPort) });
    break;
  case 'dev':
    await serve(false);
    break;
  case 'start':
    await serve(true);
    break;
  case 'test':
    requireDatabase();
    run(['--filter', '@workspace/api-server', 'run', 'test:factory']);
    break;
  default:
    throw new Error('Unknown command. Use pnpm setup:local, dev, build, start, or test.');
}
