import {
  connectNativeBleProvisioning,
  deviceProvisioning,
} from '@features/devices/provisioning/deviceProvisioning';

export const BLE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const BLE_CONFIG_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const BLE_STATUS_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a9';

export type BleProvisioningStatus = {
  state?: string;
  hardwareId?: string;
  deviceCode?: string;
  firmwareVersion?: string;
  savedNetworks?: number;
  wifiConnected?: boolean;
  mqttConnected?: boolean;
  bleEnabled?: boolean;
  linkedToHome?: boolean;
  bleLocked?: boolean;
  ssid?: string;
  ip?: string;
  rssi?: number;
};

type BleCharacteristic = {
  value: DataView | null;
  readValue?: () => Promise<DataView>;
  startNotifications: () => Promise<BleCharacteristic>;
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValue?: (value: BufferSource) => Promise<void>;
  addEventListener: (type: 'characteristicvaluechanged', listener: EventListener) => void;
  removeEventListener: (type: 'characteristicvaluechanged', listener: EventListener) => void;
};

type BleService = {
  getCharacteristic: (uuid: string) => Promise<BleCharacteristic>;
};

type BleServer = {
  connected?: boolean;
  getPrimaryService: (uuid: string) => Promise<BleService>;
};

type BleDevice = {
  name?: string | null;
  addEventListener?: (type: 'gattserverdisconnected', listener: EventListener) => void;
  removeEventListener?: (type: 'gattserverdisconnected', listener: EventListener) => void;
  gatt?: {
    connect: () => Promise<BleServer>;
    disconnect?: () => void;
  };
};

type BluetoothApi = {
  requestDevice: (options: {
    filters?: Array<{ services: string[] } | { namePrefix: string }>;
    acceptAllDevices?: boolean;
    optionalServices?: string[];
  }) => Promise<BleDevice>;
};

type NavigatorWithBluetooth = Navigator & { bluetooth?: BluetoothApi };

export type BleProvisioningConnection = {
  deviceName: string;
  initialStatus: BleProvisioningStatus | null;
  write: (payload: BleProvisioningPayload) => Promise<void>;
  disconnect: () => void;
};

export type BleProvisioningPayload = {
  ssid: string;
  password: string;
  mqttHost?: string;
  mqttPort?: number;
  deviceCode?: string;
  disableBleAfterProvisioning?: boolean;
};

function getBluetooth(): BluetoothApi | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as NavigatorWithBluetooth).bluetooth || null;
}

function decodeStatus(value: DataView | null): BleProvisioningStatus | null {
  if (!value) return null;

  try {
    const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return parsed && typeof parsed === 'object' ? (parsed as BleProvisioningStatus) : null;
  } catch {
    return null;
  }
}

function waitForBleRetry(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 350));
}

export function isBleProvisioningSupported(): boolean {
  return getBluetooth() !== null || deviceProvisioning.isAvailable();
}

export async function connectBleProvisioning(
  onStatus: (status: BleProvisioningStatus) => void
): Promise<BleProvisioningConnection> {
  if (deviceProvisioning.isAvailable()) {
    return connectNativeBleProvisioning(onStatus);
  }

  const bluetooth = getBluetooth();
  if (!bluetooth) {
    throw new Error('Web Bluetooth no está disponible. Usa Chrome/Edge en localhost o HTTPS.');
  }

  const device = await bluetooth.requestDevice({
    // Windows puede registrar el servicio BLE, pero Chrome/Edge no siempre lo
    // incluye en el filtro del selector cuando llega desde scan response.
    // Dejamos que el usuario seleccione el equipo y validamos el servicio al
    // conectarnos; asi no aparece el selector vacio aunque el ESP32 anuncie.
    acceptAllDevices: true,
    optionalServices: [BLE_SERVICE_UUID],
  });
  if (!device.gatt) throw new Error('El dispositivo BLE no expone un servidor GATT.');

  let server: BleServer | null = null;
  let configCharacteristic: BleCharacteristic | null = null;
  let statusCharacteristic: BleCharacteristic | null = null;
  let lastError: unknown = null;

  // Windows puede aceptar la conexión y soltarla durante el descubrimiento
  // GATT. Reintentamos el ciclo completo sin volver a abrir el selector BLE.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      configCharacteristic = await service.getCharacteristic(BLE_CONFIG_CHARACTERISTIC_UUID);
      statusCharacteristic = await service.getCharacteristic(BLE_STATUS_CHARACTERISTIC_UUID);
      await statusCharacteristic.startNotifications();
      break;
    } catch (error) {
      lastError = error;
      device.gatt.disconnect?.();
      if (attempt < 2) await waitForBleRetry();
    }
  }

  if (!server || !configCharacteristic || !statusCharacteristic) {
    const reason = lastError instanceof Error ? lastError.message : 'desconexión durante GATT';
    throw new Error(`No se pudo mantener la conexión BLE con el ESP32: ${reason}`);
  }

  let activeStatusCharacteristic = statusCharacteristic;
  const listener: EventListener = (event) => {
    const target = event.target as BleCharacteristic | null;
    const status = decodeStatus(target?.value || activeStatusCharacteristic.value);
    if (status) onStatus(status);
  };
  activeStatusCharacteristic.addEventListener('characteristicvaluechanged', listener);

  const reconnectBeforeWrite = async (): Promise<BleCharacteristic> => {
    if (server?.connected === true && configCharacteristic) return configCharacteristic;

    let reconnectError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const nextServer = await device.gatt!.connect();
        const service = await nextServer.getPrimaryService(BLE_SERVICE_UUID);
        const nextConfigCharacteristic = await service.getCharacteristic(
          BLE_CONFIG_CHARACTERISTIC_UUID
        );
        const nextStatusCharacteristic = await service.getCharacteristic(
          BLE_STATUS_CHARACTERISTIC_UUID
        );
        await nextStatusCharacteristic.startNotifications();

        activeStatusCharacteristic.removeEventListener('characteristicvaluechanged', listener);
        activeStatusCharacteristic = nextStatusCharacteristic;
        activeStatusCharacteristic.addEventListener('characteristicvaluechanged', listener);
        server = nextServer;
        configCharacteristic = nextConfigCharacteristic;
        statusCharacteristic = nextStatusCharacteristic;
        return nextConfigCharacteristic;
      } catch (error) {
        reconnectError = error;
        device.gatt?.disconnect?.();
        if (attempt < 2) await waitForBleRetry();
      }
    }

    const reason = reconnectError instanceof Error ? reconnectError.message : 'GATT desconectado';
    throw new Error(`No se pudo reconectar al ESP32 antes de enviar la configuración: ${reason}`);
  };

  const onGattDisconnected: EventListener = () => {
    server = null;
    configCharacteristic = null;
  };
  device.addEventListener?.('gattserverdisconnected', onGattDisconnected);

  let initialStatus = decodeStatus(activeStatusCharacteristic.value);
  if (activeStatusCharacteristic.readValue) {
    try {
      initialStatus = decodeStatus(await activeStatusCharacteristic.readValue());
    } catch {
      // Algunos dispositivos no permiten una lectura explícita después de
      // activar las notificaciones; en ese caso usamos el valor recibido.
    }
  }

  return {
    deviceName: device.name || 'HidroSmart',
    initialStatus,
    write: async (payload) => {
      const characteristic = await reconnectBeforeWrite();
      await writeBleProvisioning(characteristic, payload);
    },
    disconnect: () => {
      device.removeEventListener?.('gattserverdisconnected', onGattDisconnected);
      activeStatusCharacteristic.removeEventListener('characteristicvaluechanged', listener);
      device.gatt?.disconnect?.();
    },
  };
}

export async function writeBleProvisioning(
  characteristic: BleCharacteristic,
  payload: BleProvisioningPayload
): Promise<void> {
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const value = encoded.buffer as ArrayBuffer;

  if (characteristic.writeValueWithResponse) {
    await characteristic.writeValueWithResponse(value);
    return;
  }
  if (characteristic.writeValue) {
    await characteristic.writeValue(value);
    return;
  }
  throw new Error('La característica BLE no permite escribir la configuración.');
}
