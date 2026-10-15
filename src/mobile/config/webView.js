// El contenido se incluye dentro de la aplicación. Solo se permiten
// navegaciones HTTP(S); no se habilitan esquemas de archivos locales.
export const webViewOriginWhitelist = ['about:blank', 'https://*', 'http://*'];

export const webViewBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://hidrosmart.local/';
