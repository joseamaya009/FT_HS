# 04_mobile: Expo, WebView y aprovisionamiento BLE

## Propósito

La aplicación móvil reutiliza la interfaz web empaquetada y la muestra en un
WebView de React Native. El código nativo se mantiene pequeño: estado visual,
conectividad del WebView y aprovisionamiento BLE de un ESP32 desde Android.

## Archivos de src/mobile

- **App.jsx:** arranca el contenedor React Native y configura la barra de navegación Android.
- **AppStatusBar.jsx:** ajusta la barra de estado nativa de la aplicación.
- **HidroSmartWebView.jsx:** carga el bundle web, expone mensajes nativos, gestiona errores y el botón Atrás.
- **MobileShell.jsx:** aplica el contenedor visual nativo de la aplicación.
- **WebViewError.jsx:** muestra fallas de carga con una acción para reintentar.
- **WebViewLoading.jsx:** muestra carga y recuperación mientras se inicializa el WebView.
- **webView.js:** resuelve la URL o bundle que cargará el WebView según el entorno.
- **colors.js:** centraliza colores usados por el shell nativo.
- **layout.js:** centraliza constantes de distribución para el shell nativo.
- **bleProvisioning.js:** implementa escaneo, conexión, lectura de estado y envío de Wi-Fi/MQTT por BLE nativo.
- **webBundle.js:** bundle web generado para el WebView; no se edita manualmente.

## Flujo BLE

1. bleProvisioning solicita permisos Android y verifica que Bluetooth esté
   encendido.
2. Escanea dispositivos cuyo nombre comienza por HidroSmart-.
3. Conecta, descubre el servicio GATT y lee o monitoriza el estado.
4. Envía SSID, contraseña, host MQTT, puerto y código lógico como JSON Base64.
5. El ESP32 guarda la red e intenta MQTT. BLE permanece disponible mientras
   el dispositivo no esté vinculado a un hogar.
6. El backend confirma la vinculación por MQTT (`confirm_link`); solo entonces
   el ESP32 apaga BLE. Al desvincular (`unlink`), conserva Wi-Fi y vuelve a
   anunciarse por BLE.

La app no debe enviar una orden para apagar BLE al terminar de enviar Wi-Fi:
la confirmación del backend es la autoridad para cambiar ese estado.

Los UUID deben mantenerse alineados con firmware/mqtt/contract.md y el
firmware cargado en la placa.

## Ejecutar en Expo Go para Android

Desde la raíz de `FT_HS`, ejecuta `npm run mobile:start`. El script prepara el
bundle web, detecta la IP LAN del PC y configura la API en el mismo origen del
frontend (`http://IP_DEL_PC:FRONTEND_PORT/api/v1`), que la enruta al backend.
El teléfono y el PC deben estar en la misma Wi-Fi y el stack Docker debe estar
activo. Si el equipo tiene VPN o varios adaptadores, define `MOBILE_LAN_HOST`
con la IP LAN correcta antes de arrancar.

El proyecto usa Expo SDK 57 (`expo ~57.0.30`). Instala en Android la versión de
Expo Go compatible con SDK 57 desde https://expo.dev/go?device=true&platform=android&sdkVersion=57
y escanea el QR que muestra Metro. No se requiere ni se abre Android Studio.

Expo Go sí puede cargar el WebView y las pantallas de la app, pero no incluye
`react-native-ble-plx`; por eso el aprovisionamiento Bluetooth del ESP32 no
funciona en Expo Go. La app lo informa al intentar usar BLE. Para esa función
se necesita una compilación de desarrollo nativa.

## Android generado

La carpeta android es el proyecto nativo generado por Expo. Incluye
MainActivity.kt, MainApplication.kt, manifests, reglas ProGuard, Gradle,
recursos de icono y splash por densidad, y configuraciones de color/tema.
No se debe editar manualmente salvo una necesidad nativa justificada: los
cambios normales se definen en app.json y se regeneran con Expo prebuild.

## Scripts móviles

- **prepare-mobile-bundle.mjs:** compila la web con Vite y copia el bundle que
  consumirá Expo.
- **start-expo-go.mjs:** prepara la IP LAN, genera el bundle y arranca Metro
  explícitamente en modo Expo Go.
- **run-android.mjs:** ejecuta Android, detecta el emulador y configura los
  reenvíos ADB requeridos.
- **index.js:** registra la entrada Expo de la aplicación.
- **metro.config.cjs:** configura Metro para resolver el bundle y recursos.

En Android, el botón Atrás vuelve a la pantalla web anterior cuando existe
historial. Si falla la carga, la app muestra el error y permite reintentar.
