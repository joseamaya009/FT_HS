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
npm.cmd run build
```

## Android

El móvil empaqueta el bundle web y lo carga en un development build Expo. Abre
un emulador Android antes de ejecutar:

```powershell
$env:REACT_NATIVE_ARCHITECTURES = 'x86_64'
npm.cmd run mobile:android
```

En otra terminal:

```powershell
npm.cmd run mobile:start -- --localhost
```

`mobile:android` genera el bundle, ejecuta prebuild, compila, instala el APK y
configura `adb reverse` para el emulador. `mobile:doctor` revisa la instalación
Expo. Para un teléfono físico, `EXPO_PUBLIC_API_URL` debe ser una URL accesible
por la red; `localhost` apunta al propio teléfono.

## Variables

Usa `.env.example` como plantilla. No confirmes archivos `.env`, bundles
generados ni directorios de compilación Android.
