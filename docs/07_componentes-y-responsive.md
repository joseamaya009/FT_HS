# 07 Componentes y diseño responsive

## Organización

- `src/app`: arranque, rutas, proveedores, layouts y selección del hogar activo.
- `src/features/<dominio>`: pantallas y adaptadores API del dominio.
- `src/shared`: componentes, HTTP, permisos, configuración e internacionalización.
- `src/styles/globals.css`: tokens visuales, utilidades y ajustes responsive.

Las pantallas no deben duplicar autenticación, navegación global ni llamadas
HTTP compartidas. Los componentes de una sola feature se quedan dentro de ella;
los que tengan uso transversal pertenecen a `shared`.

## Sistema visual

La interfaz combina componentes de Radix/MUI, iconos Lucide, clases utilitarias y
reglas globales. Antes de añadir un patrón nuevo, reutiliza el componente
existente del proyecto y conserva estados visibles de carga, vacío, error,
selección y deshabilitado. Los colores de estado no deben ser el único medio
para comunicar una condición.

## Puntos de adaptación

Los estilos globales usan estos tramos principales:

| Viewport | Comportamiento base |
| --- | --- |
| Hasta 640 px | Diseño móvil, navegación inferior fija y contenido con scroll. |
| 641–1024 px | Ajuste de tipografía y distribución para tablet. |
| Desde 1025 px | Layout de escritorio. |

Hay reglas más específicas por pantalla: el breakpoint general no sustituye
las pruebas de formularios, tablas, gráficas, calendarios, diálogos y paneles.
En móvil el `AppLayout` cambia a una barra inferior; la lista depende del rol.
El área desplazable debe reservar espacio para esa barra y para las áreas
seguras del dispositivo.

## Navegación y accesibilidad

- Mantener rutas directas protegidas además de ocultar enlaces del menú.
- Usar `aria-label`, `aria-current` y elementos interactivos semánticos.
- Los controles deben poder operarse con teclado y mostrar foco visible.
- Respetar `prefers-reduced-motion`.
- Evitar barras horizontales accidentales; si un carrusel necesita scroll,
  debe ser intencional y conservar una alternativa táctil/teclado.

## Reglas de mantenimiento

1. Añade la pantalla dentro de su feature y registra su ruta en la capa `app`.
2. Usa tokens y componentes compartidos antes de definir colores o botones
   aislados.
3. Prueba el flujo en ancho móvil (≤640 px), tablet y escritorio; no basta con
   que compile.
4. Si cambias navegación o permisos, valida una sesión Owner/HomeUser, Guest y
   Administrator según el alcance de la pantalla.
5. Si modificas `globals.css`, revisa también modo oscuro y las páginas que
   comparten las clases afectadas.

El mapa de rutas está en [`01_shell-routing.md`](01_shell-routing.md), y el
catálogo de features en [`02_features.md`](02_features.md).
