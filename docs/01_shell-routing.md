# 01_shell-routing: entrada, rutas y proveedores

## Propósito

La capa app prepara el árbol React y decide qué pantalla puede verse según la
sesión. No llama directamente a endpoints de dominio: delega esa tarea en
features y shared/http.

La entrada web es src/main.tsx. Envuelve la aplicación con BrowserRouter,
QueryProvider, ThemeProvider y AuthProvider antes de montar App.

## Rutas principales

- /login, /register y /privacy son públicas y se bloquean si la sesión ya está
  iniciada.
- /verify-email confirma el correo de una cuenta pendiente.
- /app/* requiere una sesión válida y carga el DashboardLayout.
- Las rutas no reconocidas redirigen a /app o /login según el estado de sesión.

Dentro de /app, AppLayout cambia entre inicio, hogares, dispositivos, consumo,
reportes, metas, alertas, soporte, ajustes y pantallas administrativas. Las
vistas se cargan con lazy para reducir el bundle inicial.

## Archivos

- **App.tsx:** declara las rutas públicas, protegidas, recuperación de sesión y pantallas globales.
- **Attributions.md:** conserva atribuciones de recursos de diseño incluidos en la interfaz.
- **AppLayout.tsx:** construye la navegación lateral, cabecera, vistas cargadas de forma diferida y control visual por permisos.
- **ActiveHomeProvider.tsx:** mantiene el hogar activo y carga los hogares disponibles para la sesión.
- **AuthProvider.tsx:** restaura, inicia y cierra sesión mediante cookies HttpOnly y publica permisos al árbol React.
- **QueryProvider.tsx:** configura el cliente React Query y el almacenamiento temporal de consultas.
- **ThemeContext.tsx:** declara el contexto tipado de tema visual.
- **ThemeProvider.tsx:** aplica tema, preferencias de color y persistencia visual.

## Seguridad de navegación

La visibilidad del menú se basa en roles y permisos que devuelve el backend.
Es una ayuda de interfaz; el backend y RLS en PostgreSQL siguen siendo las
barreras reales de autorización.
