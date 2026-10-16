# 05_runtime-styles: web, estilos, empaquetado y despliegue

## Entrada y archivos fuente

- **aaa-Photoroom.png:** es un recurso visual importado por la aplicación.
- **aaa-Photoroom-1.png:** es un recurso visual importado por la aplicación.
- **image.png:** es un recurso visual importado por la aplicación.
- **image-1.png:** es un recurso visual importado por la aplicación.
- **image-2.png:** es un recurso visual importado por la aplicación.
- **main.tsx:** monta React, router, providers globales, estilos e internacionalización.
- **default_theme.css:** define estilos globales o tema: default theme.
- **fonts.css:** define estilos globales o tema: fonts.
- **globals.css:** define estilos globales o tema: globals.
- **index.css:** define estilos globales o tema: index.
- **themes.css:** define estilos globales o tema: themes.
- **vite-env.d.ts:** declara tipos de entorno de Vite para TypeScript.

## Configuración de ejecución

- **package.json:** define dependencias y comandos web, móviles, calidad y
  compilación.
- **vite.config.js:** configura Vite, alias de importación y proxy de
  desarrollo cuando aplica.
- **tsconfig.json:** define compilación TypeScript y alias usados por la web.
- **postcss.config.mjs:** integra PostCSS y Tailwind en la compilación.
- **index.html:** contiene el root HTML que Vite entrega al navegador.
- **.env.example:** enumera variables públicas necesarias, sin secretos.
- **Dockerfile:** genera el contenedor de la interfaz compilada.
- **docker-compose.yml:** permite ejecutar el frontend aislado mediante Docker.
- **nginx.conf:** sirve la SPA y dirige /api/v1 al backend en la pila integrada.
- **nginx.standalone.conf:** sirve la SPA cuando el proxy backend se configura
  fuera de este contenedor.
- **default_shadcn_theme.css:** conserva la base visual de los componentes
  importados de shadcn.
- **app.json:** define identidad, icono, Android y plugins de Expo.

## Calidad y operación

- npm.cmd run dev inicia Vite.
- npm.cmd run typecheck comprueba TypeScript.
- npm.cmd run lint valida formato de src.
- npm.cmd run build produce el bundle web de producción.
- npm.cmd run mobile:prepare genera el bundle que abre el WebView.
- npm.cmd run mobile:android recompila e instala el development build Android.

Los directorios de build, node_modules y productos de Gradle son generados y
no deben confirmarse. La configuración real se toma de .env, que tampoco se
confirma.
