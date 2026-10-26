import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

globalThis.sessionStorage = { removeItem() {} };
globalThis.window = new EventTarget();

const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/shared/http/apiClient.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
  plugins: [
    {
      name: 'test-env',
      setup(builder) {
        builder.onResolve({ filter: /^\.\.\/config\/env$/ }, () => ({
          path: 'env',
          namespace: 'test-env',
        }));
        builder.onLoad({ filter: /^env$/, namespace: 'test-env' }, () => ({
          contents: 'export const env = { apiBaseUrl: "https://api.example.test/api/v1" };',
          loader: 'js',
        }));
      },
    },
  ],
});
const code = Buffer.from(result.outputFiles[0].text).toString('base64');
const {
  apiClient,
  authApi,
  devicesApi,
  reportsApi,
  ApiError,
  SESSION_EXPIRED_EVENT,
  sessionTokens,
} = await import(`data:text/javascript;base64,${code}`);

function csrfResponse(token) {
  return new Response(null, { status: 204, headers: { 'X-CSRF-Token': token } });
}

test('obtiene CSRF y lo envía en el login con cookies incluidas', async () => {
  sessionTokens.clear();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/csrf')) return csrfResponse('token-1');
    return Response.json({ data: { userId: 'u' } });
  };

  await authApi.login('owner@example.test', 'password');

  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[1].options.credentials, 'include');
  assert.equal(calls[1].options.headers.get('X-CSRF-Token'), 'token-1');
});

test('renueva CSRF y reintenta una sola vez cuando el backend lo rechaza', async () => {
  sessionTokens.clear();
  let bootstrapCount = 0;
  let postCount = 0;
  const sentTokens = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/auth/csrf')) return csrfResponse(`token-${++bootstrapCount}`);
    postCount += 1;
    sentTokens.push(options.headers.get('X-CSRF-Token'));
    return postCount === 1
      ? Response.json(
          { error: { code: 'CSRF_INVALID', message: 'CSRF inválido' } },
          { status: 403 }
        )
      : Response.json({ data: { ok: true } });
  };

  await apiClient.post('/auth/login', { login: 'a', password: 'b' }, { skipAuth: true });

  assert.equal(bootstrapCount, 2);
  assert.equal(postCount, 2);
  assert.deepEqual(sentTokens, ['token-1', 'token-2']);
});

test('no repite un 403 de permisos ni un rechazo CSRF dos veces', async () => {
  sessionTokens.clear();
  let postCount = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/auth/csrf')) return csrfResponse('token');
    postCount += 1;
    return Response.json({ error: { code: 'FORBIDDEN', message: 'Sin permiso' } }, { status: 403 });
  };
  await assert.rejects(
    apiClient.post('/test'),
    (error) => error instanceof ApiError && error.status === 403
  );
  assert.equal(postCount, 1);

  sessionTokens.clear();
  postCount = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/auth/csrf')) return csrfResponse('token');
    postCount += 1;
    return Response.json(
      { error: { code: 'CSRF_INVALID', message: 'CSRF inválido' } },
      { status: 403 }
    );
  };
  await assert.rejects(
    apiClient.post('/test'),
    (error) => error instanceof ApiError && error.status === 403
  );
  assert.equal(postCount, 2);
});

test('cierra localmente solo cuando el refresh confirma 401, no ante 500', async () => {
  sessionTokens.clear();
  let expiredEvents = 0;
  const onExpired = () => {
    expiredEvents += 1;
  };
  window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
  let refreshStatus = 500;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/auth/csrf')) return csrfResponse('token');
    if (url.endsWith('/auth/refresh')) {
      return Response.json({ error: { message: 'Refresh error' } }, { status: refreshStatus });
    }
    return Response.json({ error: { message: 'Sesión vencida' } }, { status: 401 });
  };

  await assert.rejects(
    apiClient.get('/users/me'),
    (error) => error instanceof ApiError && error.status === 500
  );
  assert.equal(expiredEvents, 0);

  refreshStatus = 401;
  await assert.rejects(
    apiClient.get('/users/me'),
    (error) => error instanceof ApiError && error.status === 401
  );
  assert.equal(expiredEvents, 1);
  window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
});

test('renueva una sesión vencida y repite la consulta original una vez', async () => {
  sessionTokens.clear();
  const calls = [];
  let profileReads = 0;
  let expiredEvents = 0;
  const onExpired = () => {
    expiredEvents += 1;
  };
  window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/auth/csrf')) return csrfResponse('token-refresh');
    if (url.endsWith('/auth/refresh')) return Response.json({ data: { sessionId: 'new-session' } });
    profileReads += 1;
    return profileReads === 1
      ? Response.json({ error: { message: 'Access expirado' } }, { status: 401 })
      : Response.json({ data: { userId: 'owner-id', roles: ['HomeUser'] } });
  };

  const response = await apiClient.get('/users/me');

  assert.equal(response.data.userId, 'owner-id');
  assert.equal(profileReads, 2);
  assert.equal(calls.filter(({ url }) => url.endsWith('/auth/refresh')).length, 1);
  assert.equal(
    calls.find(({ url }) => url.endsWith('/auth/refresh')).options.headers.get('X-CSRF-Token'),
    'token-refresh'
  );
  assert.equal(expiredEvents, 0);
  window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
});

test('dos consultas vencidas comparten un único refresh en curso', async () => {
  sessionTokens.clear();
  const reads = new Map();
  let refreshCount = 0;
  let csrfCount = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/auth/csrf')) {
      csrfCount += 1;
      return csrfResponse('shared-token');
    }
    if (url.endsWith('/auth/refresh')) {
      refreshCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return Response.json({ data: { sessionId: 'new-session' } });
    }
    const count = (reads.get(url) || 0) + 1;
    reads.set(url, count);
    return count === 1
      ? Response.json({ error: { message: 'Access expirado' } }, { status: 401 })
      : Response.json({ data: { ok: true } });
  };

  const [profile, homes] = await Promise.all([apiClient.get('/users/me'), apiClient.get('/homes')]);

  assert.equal(profile.data.ok, true);
  assert.equal(homes.data.ok, true);
  assert.equal(refreshCount, 1);
  assert.equal(csrfCount, 1);
  assert.equal(reads.get('https://api.example.test/api/v1/users/me'), 2);
  assert.equal(reads.get('https://api.example.test/api/v1/homes'), 2);
});

test('un fallo al obtener CSRF no envía la mutación y permite reintentar después', async () => {
  sessionTokens.clear();
  let csrfCount = 0;
  let mutations = 0;
  globalThis.fetch = async (url) => {
    if (url.endsWith('/auth/csrf')) {
      csrfCount += 1;
      if (csrfCount === 1) throw new TypeError('network down');
      return csrfResponse('recovered-token');
    }
    mutations += 1;
    return Response.json({ data: { saved: true } });
  };

  await assert.rejects(
    apiClient.post('/test', { value: 1 }),
    (error) => error instanceof ApiError && error.status === 0
  );
  assert.equal(mutations, 0);

  const response = await apiClient.post('/test', { value: 1 });
  assert.equal(response.data.saved, true);
  assert.equal(csrfCount, 2);
  assert.equal(mutations, 1);
});

test('descarga PDF como Blob y conserva el detalle de un error JSON', async () => {
  sessionTokens.clear();
  const pdf = new Uint8Array([37, 80, 68, 70]);
  globalThis.fetch = async () =>
    new Response(pdf, {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });

  const blob = await apiClient.getBlob('/reports/consumption.pdf');
  assert.ok(blob instanceof Blob);
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [...pdf]);

  globalThis.fetch = async () =>
    Response.json({ error: { code: 'FORBIDDEN', message: 'No tienes permiso' } }, { status: 403 });
  await assert.rejects(
    apiClient.getBlob('/reports/consumption.pdf'),
    (error) =>
      error instanceof ApiError &&
      error.status === 403 &&
      error.message === 'No tienes permiso' &&
      error.details.error.code === 'FORBIDDEN'
  );
});

test('los tokens de sesión no se exponen ni guardan en JavaScript', () => {
  sessionTokens.save({ accessToken: 'secret-access', refreshToken: 'secret-refresh' });
  assert.equal(sessionTokens.accessToken, null);
  assert.equal(sessionTokens.refreshToken, null);
  assert.equal(sessionTokens.sessionId, null);
});

test('vincular y desvincular dispositivo usan las rutas y métodos esperados', async () => {
  sessionTokens.clear();
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return url.endsWith('/auth/csrf')
      ? csrfResponse('device-token')
      : Response.json({ data: { ok: true } });
  };

  await devicesApi.link({ homeId: 'hogar-1', code: 'HS-ABC' });
  await devicesApi.unlink('device-1', 'hogar-1');

  assert.equal(calls.length, 3);
  assert.equal(calls[1].url, 'https://api.example.test/api/v1/devices/link');
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), { homeId: 'hogar-1', code: 'HS-ABC' });
  assert.equal(calls[2].url, 'https://api.example.test/api/v1/devices/device-1/home/hogar-1');
  assert.equal(calls[2].options.method, 'DELETE');
  assert.equal(calls[1].options.headers.get('X-CSRF-Token'), 'device-token');
  assert.equal(calls[2].options.headers.get('X-CSRF-Token'), 'device-token');
});

test('los reportes PDF y Excel consultan sus endpoints como descargas binarias', async () => {
  sessionTokens.clear();
  const calls = [];
  const bytes = new Uint8Array([1, 2, 3]);
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } });
  };

  const query = 'homeId=hogar-1&from=2026-10-01&to=2026-10-18';
  const pdf = await reportsApi.downloadConsumptionPdf(query);
  const excel = await reportsApi.downloadConsumptionExcel(query);

  assert.ok(pdf instanceof Blob);
  assert.ok(excel instanceof Blob);
  assert.deepEqual(
    calls.map(({ url }) => url),
    [
      `https://api.example.test/api/v1/reports/consumption.pdf?${query}`,
      `https://api.example.test/api/v1/reports/consumption.xlsx?${query}`,
    ]
  );
  assert.ok(
    calls.every(({ options }) => options.method === 'GET' && options.credentials === 'include')
  );
});
