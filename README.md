# Aplicación web y móvil

## Web

```powershell
npm.cmd install
npm.cmd run dev
```

La aplicación Vite queda disponible normalmente en `http://localhost:5173`.
Configura `VITE_API_URL` en `.env` con la URL de la API cuando ejecutes fuera de
Docker.

## Validación

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run mobile:doctor
```

## Expo Go en un teléfono Android (sin Android Studio)

Con Docker Desktop iniciado y el PC y teléfono en la misma red, ejecuta desde
`FT_HS/frontend`:

```powershell
npm.cmd run mobile:start
```

El script detecta la IP LAN, regenera el bundle web y muestra el QR. La web/API
debe responder desde el teléfono en `http://IP_DEL_PC:5173/health`. Expo Go
permite probar las pantallas, pero no incluye el módulo BLE nativo del ESP32.

## Android nativo (opcional, para BLE)

El móvil empaqueta el bundle web y lo carga en un development build Expo. Abre
un emulador Android antes de ejecutar:

```powershell
$env:REACT_NATIVE_ARCHITECTURES = 'x86_64'
npm.cmd run mobile:android
```

`mobile:android` genera el bundle, ejecuta prebuild, compila, instala el APK y
configura `adb reverse` para el emulador. Esta ruta sí necesita el SDK nativo
de Android. Para un teléfono físico, la API debe ser accesible por la red;
`localhost` apunta al propio teléfono. Revisa [04_mobile.md](../docs/04_mobile.md)
antes de probar BLE.

## Variables

Usa `.env.example` como plantilla. No confirmes archivos `.env`, bundles
generados ni directorios de compilación Android.
