function getMqttDeviceHost(value: string | undefined) {
  return (value || 'mqtt.flespi.io')
    .trim()
    .replace(/^mqtts?:\/\//i, '')
    .replace(/\/.*$/, '');
}

function getMqttDevicePort(value: string | undefined) {
  const port = Number(value || 8883);
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : 8883;
}

export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1').replace(/\/$/, ''),
  // Esta configuración es pública (no contiene usuario ni contraseña). Se
  // envía al ESP32 por BLE, para no pedir una IP en la pantalla.
  mqttDeviceHost: getMqttDeviceHost(import.meta.env.VITE_MQTT_DEVICE_HOST),
  mqttDevicePort: getMqttDevicePort(import.meta.env.VITE_MQTT_DEVICE_PORT),
};
