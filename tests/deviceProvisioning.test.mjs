import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

globalThis.window = new EventTarget();

const result = await build({
  entryPoints: [
    fileURLToPath(
      new URL('../src/features/devices/provisioning/deviceProvisioning.ts', import.meta.url)
    ),
  ],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
});
const code = Buffer.from(result.outputFiles[0].text).toString('base64');
const { deviceProvisioning, connectNativeBleProvisioning } = await import(
  `data:text/javascript;base64,${code}`
);

function dispatchNativeMessage(data) {
  const event = new Event('message');
  Object.defineProperty(event, 'data', { value: data });
  window.dispatchEvent(event);
}

test('el puente BLE no se ofrece fuera de la app nativa', async () => {
  delete window.ReactNativeWebView;
  assert.equal(deviceProvisioning.isAvailable(), false);
  assert.throws(() => deviceProvisioning.scan(), /Bluetooth/);
  await assert.rejects(
    connectNativeBleProvisioning(() => {}),
    /app nativa/
  );
});

test('envía comandos BLE y credenciales de aprovisionamiento al puente nativo', () => {
  const sent = [];
  window.ReactNativeWebView = { postMessage: (value) => sent.push(JSON.parse(value)) };
  assert.equal(deviceProvisioning.isAvailable(), true);

  deviceProvisioning.scan();
  deviceProvisioning.connect('esp-001');
  deviceProvisioning.provision({
    ssid: 'red-casa',
    password: 'clave-prueba',
    mqttHost: 'mqtt.example.test',
    mqttPort: 8883,
    deviceCode: 'HS-001',
  });
  deviceProvisioning.stopScan();
  deviceProvisioning.disconnect();

  assert.deepEqual(sent, [
    { type: 'BLE_SCAN_START', payload: {} },
    { type: 'BLE_CONNECT', payload: { deviceId: 'esp-001' } },
    {
      type: 'BLE_PROVISION',
      payload: {
        ssid: 'red-casa',
        password: 'clave-prueba',
        mqttHost: 'mqtt.example.test',
        mqttPort: 8883,
        deviceCode: 'HS-001',
      },
    },
    { type: 'BLE_SCAN_STOP', payload: {} },
    { type: 'BLE_DISCONNECT', payload: {} },
  ]);
});

test('acepta mensajes nativos válidos, ignora los ajenos y permite desuscribirse', () => {
  const received = [];
  const unsubscribe = deviceProvisioning.subscribe((message) => received.push(message));

  dispatchNativeMessage('no es JSON');
  dispatchNativeMessage(JSON.stringify(['BLE_STATUS']));
  dispatchNativeMessage({ type: 42 });
  dispatchNativeMessage(JSON.stringify({ type: 'BLE_STATUS', payload: { wifiConnected: true } }));
  dispatchNativeMessage({ type: 'BLE_CONNECTED', payload: { name: 'ESP32' } });
  unsubscribe();
  dispatchNativeMessage({ type: 'BLE_ERROR', payload: { message: 'tardío' } });

  assert.deepEqual(received, [
    { type: 'BLE_STATUS', payload: { wifiConnected: true } },
    { type: 'BLE_CONNECTED', payload: { name: 'ESP32' } },
  ]);
});

test('el flujo BLE conecta, informa estado y confirma la escritura de Wi-Fi', async () => {
  const sent = [];
  const statuses = [];
  window.ReactNativeWebView = { postMessage: (value) => sent.push(JSON.parse(value)) };

  const connectionPromise = connectNativeBleProvisioning((status) => statuses.push(status));
  assert.equal(sent[0].type, 'BLE_SCAN_START');
  dispatchNativeMessage({ type: 'BLE_DEVICE_FOUND', payload: {} });
  assert.equal(sent.length, 1);
  dispatchNativeMessage({ type: 'BLE_DEVICE_FOUND', payload: { id: 'esp-001' } });
  dispatchNativeMessage({ type: 'BLE_DEVICE_FOUND', payload: { id: 'esp-002' } });
  assert.deepEqual(sent[1], { type: 'BLE_CONNECT', payload: { deviceId: 'esp-001' } });
  assert.equal(sent.length, 2);
  dispatchNativeMessage({ type: 'BLE_STATUS', payload: { wifiConnected: false } });
  dispatchNativeMessage({ type: 'BLE_CONNECTED', payload: { name: 'HidroSmart-ESP' } });

  const connection = await connectionPromise;
  assert.equal(connection.deviceName, 'HidroSmart-ESP');
  assert.deepEqual(connection.initialStatus, { wifiConnected: false });
  assert.deepEqual(statuses, [{ wifiConnected: false }]);

  const writePromise = connection.write({ ssid: 'red-casa', password: 'clave-prueba' });
  assert.equal(sent.at(-1).type, 'BLE_PROVISION');
  dispatchNativeMessage({ type: 'BLE_CONFIG_SENT' });
  await writePromise;

  connection.disconnect();
  assert.equal(sent.at(-1).type, 'BLE_DISCONNECT');
  await assert.rejects(connection.write({ ssid: 'otra-red', password: 'otra-clave' }), /no est/);
});

test('un error BLE durante la búsqueda detiene el escaneo y rechaza la conexión', async () => {
  const sent = [];
  window.ReactNativeWebView = { postMessage: (value) => sent.push(JSON.parse(value)) };

  const connectionPromise = connectNativeBleProvisioning(() => {});
  dispatchNativeMessage({ type: 'BLE_ERROR', payload: { message: 'Bluetooth apagado' } });

  await assert.rejects(connectionPromise, /Bluetooth apagado/);
  assert.deepEqual(
    sent.map(({ type }) => type),
    ['BLE_SCAN_START', 'BLE_SCAN_STOP', 'BLE_DISCONNECT']
  );
});

test('un error BLE durante el envío rechaza la escritura pendiente', async () => {
  window.ReactNativeWebView = { postMessage: () => {} };
  const connectionPromise = connectNativeBleProvisioning(() => {});
  dispatchNativeMessage({ type: 'BLE_DEVICE_FOUND', payload: { id: 'esp-001' } });
  dispatchNativeMessage({ type: 'BLE_CONNECTED', payload: { name: 'ESP32' } });
  const connection = await connectionPromise;

  const writePromise = connection.write({ ssid: 'red-casa', password: 'clave-prueba' });
  dispatchNativeMessage({ type: 'BLE_ERROR', payload: { message: 'ESP rechazó Wi-Fi' } });

  await assert.rejects(writePromise, /ESP rechazó Wi-Fi/);
  connection.disconnect();
});
