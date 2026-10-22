# 06 API y autenticación del frontend

## Alcance

Describe cómo la interfaz web llama al backend y conserva la sesión. La fuente
principal del cliente compartido es `src/shared/http/apiClient.ts`;
la sesión de React se administra en `src/app/providers/AuthProvider.tsx`.
Los adaptadores de cada módulo viven junto a su feature.

## Configuración

- `VITE_API_URL` define la base de API. Si no existe, el valor local es
  `http://localhost:3000/api/v1`.
- El frontend web no debe contener contraseñas MQTT ni secretos del backend.
- `VITE_MQTT_DEVICE_HOST` y `VITE_MQTT_DEVICE_PORT` son valores públicos que
  pueden enviarse al ESP32 durante el aprovisionamiento; no son credenciales.
- El bundle móvil se prepara mediante `scripts/prepare-mobile-bundle.mjs` y
  necesita una URL de API alcanzable desde el dispositivo.

## Ciclo de sesión

1. `AuthProvider` consulta `GET /users/me` para restaurar la sesión.
2. Si la cookie de acceso ya venció, `apiClient` intenta una sola renovación
   compartida mediante `POST /auth/refresh` y repite la petición original una
   vez.
3. El login llama a `POST /auth/login` y vuelve a consultar `/users/me` para
   cargar roles y permisos.
4. Al cerrar sesión se llama a `/auth/logout`; siempre se limpia el estado local
   y React Query, aunque el servidor ya haya revocado la sesión.
5. Si la renovación falla, se limpia el estado local y se emite el evento
   `hidrosmart:session-expired`.

Los tokens de acceso y renovación son cookies `HttpOnly`; JavaScript no los lee
ni los almacena. La cookie CSRF sí es legible por el navegador para que el
cliente pueda copiar su valor al encabezado `X-CSRF-Token`.

## Llamadas HTTP y errores

- `apiClient.get/post/put/patch/delete` centraliza `fetch`.
- Todas las solicitudes usan `credentials: 'include'`.
- Los métodos `POST`, `PUT`, `PATCH` y `DELETE` agregan el token CSRF cuando
  existe la cookie correspondiente.
- `ApiError` conserva el código HTTP y los detalles recibidos. Las pantallas
  deben mostrar mensajes entendibles y no filtrar payloads internos.
- Los reportes binarios usan `getBlob`; no conviertas una descarga PDF/XLSX en
  JSON.
- Una feature debe ampliar su adaptador API, no llamar `fetch` desde el JSX de
  una pantalla.

## Autorización en la interfaz

`GET /users/me` proporciona `roles` y `permissions`. `authorization.ts` los
normaliza para ocultar acciones o vistas que no aplican. Esto mejora la
experiencia, pero no concede acceso: el backend vuelve a autorizar y PostgreSQL
aplica el aislamiento de filas.

No mezclar los roles globales (`Administrator`, `HomeUser`, `Guest`) con los
roles de membresía de un hogar (`Owner`, `Member`, `Guest`). Un usuario puede
tener un rol global y una membresía distinta en cada hogar.

## Diagnóstico rápido

| Síntoma | Revisar |
| --- | --- |
| Error de conexión | `VITE_API_URL`, salud del backend, CORS y red del dispositivo. |
| 401 después de recargar | Cookies, expiración/refresh y dominio/SameSite. |
| 403 | Permiso devuelto por `/users/me`, guard del backend y membresía del hogar. |
| 403 CSRF | Cookie `hidrosmart_csrf`, encabezado `X-CSRF-Token` y origen permitido. |
| Reporte vacío o descarga fallida | Formato de respuesta, `getBlob` y permisos `reports.read`. |

El inventario de rutas está en el [resumen del contrato HTTP del backend](https://github.com/joseamaya009/BK_HS/blob/develop/docs/api.md);
la matriz de permisos del servidor, en
[la documentación de arquitectura del backend](https://github.com/joseamaya009/BK_HS/blob/develop/docs/README.md).
