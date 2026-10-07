import type { CapacitorConfig } from '@capacitor/cli';

// La app de Android carga el POS desde Netlify en vez de llevarlo empaquetado: así cada
// deploy llega a las tablets sin reinstalar el APK. Solo hace falta un APK nuevo cuando
// cambia algo nativo (el plugin de impresión, permisos, versión de Capacitor).
// Para probar contra un build local, comenta `server` y corre `npm run build && npx cap sync`.
const POS_URL = 'https://pos-balbuena.netlify.app';

const config: CapacitorConfig = {
  appId: 'mx.chichenit.balbuena',
  appName: 'Jardín Balbuena',
  webDir: 'dist',
  server: {
    url: POS_URL,
    cleartext: false,
    // Pantalla propia (empaquetada en la app) cuando no se puede cargar el POS, en vez del
    // error genérico del WebView. Ver public/offline.html.
    errorPath: 'offline.html',
  },
};

export default config;
