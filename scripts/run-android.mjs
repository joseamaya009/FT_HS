import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const projectRoot = process.cwd();
// Android CMake genera rutas de dependencias muy profundas. En Windows usamos
// un directorio corto para no superar el límite de 260 caracteres de Ninja.
const defaultGradleUserHome = process.platform === 'win32'
  ? path.join(process.env.SystemDrive || 'C:', 'hs-gradle')
  : path.join(projectRoot, '.gradle-user-home');
const gradleUserHome = process.env.HIDROSMART_GRADLE_USER_HOME || defaultGradleUserHome;
if (!existsSync(path.join(projectRoot, 'node_modules', 'expo'))) {
  throw new Error('No se encontró Expo local. Ejecuta npm ci antes de compilar Android.');
}

const configuredSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const defaultWindowsSdk = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
  : null;
const androidSdk = configuredSdk || defaultWindowsSdk;

if (!androidSdk || !existsSync(androidSdk)) {
  throw new Error(
    'No se encontró el Android SDK. Instálalo desde Android Studio o define ANDROID_HOME con su ruta.'
  );
}

const javaExecutableName = process.platform === 'win32' ? 'java.exe' : 'java';
const configuredJavaHome = process.env.JAVA_HOME;
const programFiles = process.env.ProgramW6432 || process.env.ProgramFiles || 'C:\\Program Files';
const adoptiumDirectory = path.join(programFiles, 'Eclipse Adoptium');
const bundledJdk = existsSync(adoptiumDirectory)
  ? readdirSync(adoptiumDirectory)
      .filter((directory) => /^jdk-(17|21)(?:\.|-|$)/.test(directory))
      .sort()
      .map((directory) => path.join(adoptiumDirectory, directory))
      .find((directory) => existsSync(path.join(directory, 'bin', javaExecutableName)))
  : undefined;
const javaHome = bundledJdk || configuredJavaHome;

if (!javaHome || !existsSync(path.join(javaHome, 'bin', javaExecutableName))) {
  throw new Error(
    'No se encontró un JDK 17 o 21. Instala Microsoft OpenJDK 17 o define JAVA_HOME antes de compilar Android.'
  );
}

const buildEnvironment = {
  ...process.env,
  ANDROID_HOME: androidSdk,
  ANDROID_SDK_ROOT: androidSdk,
  JAVA_HOME: javaHome,
  PATH: `${path.join(javaHome, 'bin')}${path.delimiter}${process.env.PATH || ''}`,
  GRADLE_USER_HOME: gradleUserHome,
  NODE_ENV: process.env.NODE_ENV || 'development',
};

const requestedArchitectures = process.env.REACT_NATIVE_ARCHITECTURES?.trim();
const gradleArguments = [
  'app:assembleDebug',
  '--no-daemon',
  '-x',
  'lint',
  '-x',
  'test',
  '-PreactNativeDevServerPort=8081',
  ...(requestedArchitectures ? [`-PreactNativeArchitectures=${requestedArchitectures}`] : []),
];
const androidDirectory = path.join(projectRoot, 'android');
const build = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gradlew.bat', ...gradleArguments], {
      cwd: androidDirectory,
      env: buildEnvironment,
      stdio: 'inherit',
    })
  : spawnSync('./gradlew', gradleArguments, {
      cwd: androidDirectory,
      env: buildEnvironment,
      stdio: 'inherit',
    });

if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const adbExecutable = path.join(
  androidSdk,
  'platform-tools',
  process.platform === 'win32' ? 'adb.exe' : 'adb'
);

if (!existsSync(adbExecutable)) {
  throw new Error('No se encontró adb en el Android SDK. Instala Android SDK Platform-Tools.');
}

const devices = spawnSync(adbExecutable, ['devices'], {
  cwd: projectRoot,
  env: buildEnvironment,
  encoding: 'utf8',
});

if (devices.error) throw devices.error;
if (devices.status !== 0) process.exit(devices.status ?? 1);

const availableDevices = devices.stdout
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => /\tdevice$/.test(line))
  .map((line) => line.split(/\s+/)[0]);
const deviceSerial = process.env.ANDROID_SERIAL || availableDevices[0];

if (!deviceSerial) {
  throw new Error('No hay un emulador o dispositivo Android conectado. Ábrelo en Android Studio y vuelve a intentar.');
}

const adb = (argumentsList) => {
  const result = spawnSync(adbExecutable, ['-s', deviceSerial, ...argumentsList], {
    cwd: projectRoot,
    env: buildEnvironment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const apkPath = path.join(androidDirectory, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!existsSync(apkPath)) {
  throw new Error('No se generó el APK de depuración.');
}

const appConfig = JSON.parse(readFileSync(path.join(projectRoot, 'app.json'), 'utf8'));
const packageName = appConfig?.expo?.android?.package;
if (!packageName) {
  throw new Error('Falta expo.android.package en app.json.');
}

adb(['install', '-r', apkPath]);
for (const port of ['8081', '3000', '5173']) {
  adb(['reverse', `tcp:${port}`, `tcp:${port}`]);
}
adb(['shell', 'am', 'start', '-n', `${packageName}/.MainActivity`]);
