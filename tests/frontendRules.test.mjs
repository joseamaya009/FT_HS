import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

async function loadSource(relativePath) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(relativePath, import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  const code = Buffer.from(result.outputFiles[0].text).toString('base64');
  return import(`data:text/javascript;base64,${code}`);
}

const authorization = await loadSource('../src/shared/config/authorization.ts');
const validators = await loadSource('../src/shared/lib/validators.ts');
const dates = await loadSource('../src/shared/lib/dates.ts');
const locale = await loadSource('../src/shared/i18n/locale.ts');

test('normaliza roles sin aceptar valores ajenos al contrato', () => {
  assert.deepEqual(
    authorization.normalizeRoles(['Guest', 'Administrator', 'Guest', 'Owner', null]),
    ['Guest', 'Administrator']
  );
  assert.deepEqual(authorization.normalizeRoles(null), []);
  assert.equal(
    authorization.getPrimaryRole(['Guest', 'HomeUser', 'Administrator']),
    'Administrator'
  );
  assert.equal(authorization.getPrimaryRole(['Guest', 'HomeUser']), 'HomeUser');
  assert.equal(authorization.getPrimaryRole([]), null);
});

test('no confunde permisos recibidos con roles ni concede permisos ausentes', () => {
  const permissions = authorization.normalizePermissions([
    'homes.read',
    'homes.read',
    'devices.manage',
    7,
    null,
  ]);
  assert.deepEqual(permissions, ['homes.read', 'devices.manage']);
  assert.equal(authorization.can(permissions, 'devices.manage'), true);
  assert.equal(authorization.can(permissions, 'users.manage'), false);
  assert.equal(authorization.can(undefined, 'homes.read'), false);
  assert.equal(authorization.hasRole(['Guest'], 'Administrator'), false);
  assert.equal(authorization.hasRole(['Guest'], 'Guest'), true);
});

test('normaliza el documento a diez dígitos y valida el formato', () => {
  assert.equal(validators.normalizeDocumentNumber('CC 12.345.678-90 extra'), '1234567890');
  assert.match('1234567890', validators.documentNumberPattern);
  assert.doesNotMatch('12345678901', validators.documentNumberPattern);
  assert.doesNotMatch('12-34', validators.documentNumberPattern);
});

test('exige longitud y composición de contraseña, y valida correo básico', () => {
  assert.equal(validators.isValidPassword('Aa12345!'), true);
  assert.equal(validators.isValidPassword('Aa1234!'), false);
  assert.equal(validators.isValidPassword('aa12345!'), false);
  assert.equal(validators.isValidPassword('AA12345!'), false);
  assert.equal(validators.isValidPassword('Aa123456'), false);
  assert.equal(validators.isValidPassword('Aa' + '1'.repeat(125) + '!'), true);
  assert.equal(validators.isValidPassword('Aa' + '1'.repeat(126) + '!'), false);
  assert.match('usuario@ejemplo.com', validators.emailPattern);
  assert.doesNotMatch('usuario@@ejemplo.com', validators.emailPattern);
});

test('formatea fechas locales sin desfase UTC y reconoce idiomas soportados', () => {
  assert.equal(dates.localDate(new Date(2024, 1, 29, 23, 30)), '2024-02-29');
  assert.equal(dates.localDate(new Date(2026, 0, 2, 0, 5)), '2026-01-02');
  assert.equal(locale.normalizeLanguage('pt-BR'), 'pt');
  assert.equal(locale.normalizeLanguage('en-US'), 'en');
  assert.equal(locale.normalizeLanguage('xx-YY'), 'es');
  assert.equal(locale.defaultCurrencyForLanguage('es-CO'), 'COP');
  assert.equal(locale.localeForLanguage('it-IT'), 'it-IT');
});
