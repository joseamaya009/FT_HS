import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const repositoryRoot = path.resolve(frontendRoot, '..', '..');

function readEnvValue(filePath, name) {
  try {
    const line = fs
      .readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.match(new RegExp(`^\\s*${name}\\s*=`)));
    if (!line) return undefined;
    return line
      .replace(new RegExp(`^\\s*${name}\\s*=`), '')
      .trim()
      .replace(/^(["'])(.*)\1$/, '$2');
  } catch {
    return undefined;
  }
}

function configuredValue(name) {
  if (process.env[name]) return process.env[name];
  for (const filePath of [
    path.join(frontendRoot, '.env.local'),
    path.join(frontendRoot, '.env'),
    path.join(repositoryRoot, '.env'),
  ]) {
    const value = readEnvValue(filePath, name);
    if (value) return value;
  }
  return undefined;
}

function getLanAddress() {
  const interfaces = os.networkInterfaces();
  const ignoredAdapter =
    /virtual|vmware|vbox|docker|wsl|hyper-v|vethernet|loopback|bluetooth|tailscale|zerotier/i;
  const candidates = [];

  for (const [adapterName, addresses] of Object.entries(interfaces)) {
    if (ignoredAdapter.test(adapterName)) continue;
    for (const address of addresses ?? []) {
      if (
        (address.family !== 'IPv4' && address.family !== 4) ||
        address.internal ||
        address.address.startsWith('169.254.')
      ) {
        continue;
      }
      candidates.push({
        address: address.address,
        preferred: /wi-?fi|wireless|ethernet/i.test(adapterName),
        adapterName,
      });
    }
  }

  candidates.sort((a, b) => Number(b.preferred) - Number(a.preferred));
  return candidates[0];
}

function runBundleBuild(env) {
  const result = spawnSync(process.execPath, [path.join(scriptDir, 'prepare-mobile-bundle.mjs')], {
    cwd: frontendRoot,
    env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function warnIfApiUnavailable(baseUrl) {
  try {
    const response = await fetch(new URL('health', baseUrl), {
      signal: AbortSignal.timeout(1800),
    });
    if (response.ok) {
      console.log('[HidroSmart móvil] API alcanzable a través del frontend.');
      return;
    }
  } catch {
    // Metro can still start; the API warning below explains the dependency.
  }
  console.warn(
    `[HidroSmart móvil] No se alcanzó ${baseUrl}health. Inicia el stack Docker y confirma que el puerto del frontend (${new URL(baseUrl).port}) esté publicado.`
  );
}

const configuredHost = configuredValue('MOBILE_LAN_HOST');
const lanAddress = configuredHost
  ? { address: configuredHost, adapterName: 'MOBILE_LAN_HOST manual' }
  : getLanAddress();

if (!lanAddress) {
  console.error(
    '[HidroSmart móvil] No encontré una IP LAN. Conecta el PC a Wi-Fi/Ethernet o define MOBILE_LAN_HOST con la IP del PC.'
  );
  process.exit(1);
}

const configuredPort = configuredValue('FRONTEND_PORT') || '5173';
const port = Number(configuredPort);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[HidroSmart móvil] FRONTEND_PORT no es válido: ${configuredPort}`);
  process.exit(1);
}

const webBaseUrl = `http://${lanAddress.address}:${port}/`;
const apiBaseUrl = new URL('api/v1', webBaseUrl).toString().replace(/\/$/, '');
const childEnv = {
  ...process.env,
  EXPO_PUBLIC_WEB_BASE_URL: webBaseUrl,
  EXPO_PUBLIC_API_URL: apiBaseUrl,
  VITE_API_URL: apiBaseUrl,
};

console.log(`[HidroSmart móvil] Red: ${lanAddress.adapterName} (${lanAddress.address})`);
console.log(`[HidroSmart móvil] Web/API: ${webBaseUrl} y ${apiBaseUrl}`);
console.log('[HidroSmart móvil] Escanea el QR con Expo Go en el mismo Wi-Fi.');
console.warn(
  '[HidroSmart móvil] BLE no está incluido en Expo Go; el aprovisionamiento del ESP32 requiere una compilación nativa.'
);

await warnIfApiUnavailable(webBaseUrl);
runBundleBuild(childEnv);

const expoCli = path.join(frontendRoot, 'node_modules', 'expo', 'bin', 'cli');
const expo = spawn(process.execPath, [expoCli, 'start', '--go', '--lan'], {
  cwd: frontendRoot,
  env: childEnv,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => expo.kill(signal));
}

expo.on('error', (error) => {
  console.error(`[HidroSmart móvil] No se pudo iniciar Expo: ${error.message}`);
  process.exitCode = 1;
});
expo.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
