# 08 Pruebas del frontend

## Estado actual

El script `npm test` ejecuta `node --test`, pero al 15 de octubre de 2026 no
descubre pruebas del frontend. Por eso su salida exitosa no demuestra cobertura.
La CI sí ejecuta lint, typecheck, `npm test`, build y preparación del bundle
móvil.

## Comandos locales

Desde la raíz del repositorio:

```powershell
npm.cmd --prefix FT_HS/frontend run lint
npm.cmd --prefix FT_HS/frontend run typecheck
npm.cmd --prefix FT_HS/frontend test
npm.cmd --prefix FT_HS/frontend run build
npm.cmd --prefix FT_HS/frontend run mobile:prepare
```

## Cobertura que debe incorporarse

1. **Lógica pura:** normalización de permisos, validaciones de formularios,
   rangos de fechas y formato de consumo.
2. **Componentes:** estados de carga/vacío/error, validaciones y acciones
   visibles para cada permiso.
3. **Integración de API:** éxito, 401 con refresh, error CSRF, 403, pérdida de
   conexión y descarga PDF/Excel.
4. **Rutas:** sesión restaurada, sesión expirada, deep link protegido y regreso
   después del login.
5. **Responsive:** navegación inferior móvil, formularios y gráficos en los
   tres tramos de viewport descritos en `07_componentes-y-responsive.md`.
6. **E2E de navegador:** flujos Owner, Guest y Administrator con datos de prueba
   aislados; no usar cuentas ni hogares reales.

## Criterios para agregar una prueba

- Colocarla junto al módulo probado o bajo una carpeta `__tests__` del módulo.
- Probar comportamiento observable, no detalles internos de implementación.
- No guardar tokens reales ni depender de servicios externos en una prueba
  unitaria.
- Los casos de permisos deben comprobar tanto acciones permitidas como
  denegadas. Ocultar un botón no reemplaza la comprobación HTTP del backend.
- Cada nueva dependencia de pruebas debe ser compatible con Expo/Vite y quedar
  fijada en `package.json` y `package-lock.json`.

## Definición de terminado

Una pantalla se considera validada cuando pasa typecheck y build, tiene pruebas
de sus reglas críticas, y se comprueba al menos en viewport móvil y escritorio.
Los flujos protegidos requieren además pruebas de autorización del backend.
