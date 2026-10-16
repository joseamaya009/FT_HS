# 03_shared: configuración, HTTP, i18n y biblioteca visual

## Propósito

src/shared contiene piezas reutilizables por toda la interfaz. Aquí se
centralizan seguridad de llamadas HTTP, traducciones, autorización visual,
aprovisionamiento BLE web, utilidades y controles UI.

La capa shared no debe conocer detalles internos de una pantalla concreta. Si
un componente solo sirve a un dominio, debe permanecer en src/features.

## Archivos por carpeta

### Configuración y HTTP

- **authorization.ts:** normaliza roles, permisos y comprobaciones visuales de autorización.
- **env.ts:** lee y valida las variables públicas de Vite.
- **apiClient.ts:** ejecuta peticiones con cookies, token CSRF, refresh y manejo uniforme de errores.
- **httpClient.ts:** expone una capa HTTP compatible para módulos que requieren un cliente simple.

### Internacionalización

- **config.js:** inicializa i18next y el detector de idioma.
- **locale.ts:** define tipos y valores admitidos para locales.
- **en.json:** define tipos y valores admitidos para locales.
- **es.json:** define tipos y valores admitidos para locales.
- **it.json:** define tipos y valores admitidos para locales.
- **pt.json:** define tipos y valores admitidos para locales.

### IoT, utilidades y almacenamiento

- **validation.ts:** expone validaciones de formularios compartidas por pantallas.
- **bleProvisioning.ts:** implementa el aprovisionamiento BLE disponible desde la web.
- **dates.ts:** centraliza formato y operaciones de fechas.
- **validators.ts:** centraliza validadores reutilizables de formularios.
- **sessionStorage.ts:** maneja almacenamiento temporal no sensible y la limpieza de restos de sesión antiguos.

### Componentes compartidos

- **accordion.tsx:** exporta el componente base de interfaz accordion.
- **alert.tsx:** exporta el componente base de interfaz alert.
- **alert-dialog.tsx:** exporta el componente base de interfaz alert dialog.
- **aspect-ratio.tsx:** exporta el componente base de interfaz aspect ratio.
- **avatar.tsx:** exporta el componente base de interfaz avatar.
- **badge.tsx:** exporta el componente base de interfaz badge.
- **breadcrumb.tsx:** exporta el componente base de interfaz breadcrumb.
- **button.tsx:** exporta el componente base de interfaz button.
- **calendar.tsx:** exporta el componente base de interfaz calendar.
- **card.tsx:** exporta el componente base de interfaz card.
- **carousel.tsx:** exporta el componente base de interfaz carousel.
- **chart.tsx:** exporta el componente base de interfaz chart.
- **checkbox.tsx:** exporta el componente base de interfaz checkbox.
- **collapsible.tsx:** exporta el componente base de interfaz collapsible.
- **command.tsx:** exporta el componente base de interfaz command.
- **context-menu.tsx:** exporta el componente base de interfaz context menu.
- **dialog.tsx:** exporta el componente base de interfaz dialog.
- **drawer.tsx:** exporta el componente base de interfaz drawer.
- **dropdown-menu.tsx:** exporta el componente base de interfaz dropdown menu.
- **ImageWithFallback.tsx:** muestra imágenes con alternativa visual cuando el recurso falla.
- **FloatingLanguageSwitcher.tsx:** muestra el selector flotante de idioma.
- **form.tsx:** exporta el componente base de interfaz form.
- **hover-card.tsx:** exporta el componente base de interfaz hover card.
- **input.tsx:** exporta el componente base de interfaz input.
- **input-otp.tsx:** exporta el componente base de interfaz input otp.
- **label.tsx:** exporta el componente base de interfaz label.
- **LanguageSelector.tsx:** muestra el selector de idioma reutilizable.
- **LazyViewErrorBoundary.tsx:** captura errores de vistas cargadas de forma diferida.
- **menubar.tsx:** exporta el componente base de interfaz menubar.
- **navigation-menu.tsx:** exporta el componente base de interfaz navigation menu.
- **pagination.tsx:** exporta el componente base de interfaz pagination.
- **popover.tsx:** exporta el componente base de interfaz popover.
- **progress.tsx:** exporta el componente base de interfaz progress.
- **radio-group.tsx:** exporta el componente base de interfaz radio group.
- **resizable.tsx:** exporta el componente base de interfaz resizable.
- **responsive-utils.tsx:** agrupa ayudas visuales de diseño responsive.
- **scroll-area.tsx:** exporta el componente base de interfaz scroll area.
- **select.tsx:** exporta el componente base de interfaz select.
- **separator.tsx:** exporta el componente base de interfaz separator.
- **sheet.tsx:** exporta el componente base de interfaz sheet.
- **sidebar.tsx:** exporta el componente base de interfaz sidebar.
- **skeleton.tsx:** exporta el componente base de interfaz skeleton.
- **slider.tsx:** exporta el componente base de interfaz slider.
- **sonner.tsx:** exporta el componente base de interfaz sonner.
- **switch.tsx:** exporta el componente base de interfaz switch.
- **table.tsx:** exporta el componente base de interfaz table.
- **tabs.tsx:** exporta el componente base de interfaz tabs.
- **textarea.tsx:** exporta el componente base de interfaz textarea.
- **toggle.tsx:** exporta el componente base de interfaz toggle.
- **toggle-group.tsx:** exporta el componente base de interfaz toggle group.
- **tooltip.tsx:** exporta el componente base de interfaz tooltip.
- **use-mobile.ts:** detecta puntos de corte de móvil.
- **utils.ts:** une clases CSS y utilidades de componentes.


## Sesión y CSRF

apiClient usa credentials include; por eso las credenciales de sesión quedan en
cookies HttpOnly y no se guardan como tokens en JavaScript. Para POST, PUT,
PATCH y DELETE incorpora el valor de la cookie CSRF en X-CSRF-Token. Ante un
401 intenta refresh una vez y limpia el estado visual si no puede restaurar la
sesión.
