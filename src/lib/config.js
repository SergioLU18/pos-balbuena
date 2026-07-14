// Bandera de modo mock: cuando es `true`, la app funciona 100% en memoria/localStorage
// (sin Supabase), igual que antes de conectar el backend. Cuando es `false`, todos los
// datos compartidos (mesas, cuentas, renglones y pedidos) viven en Supabase y se
// sincronizan en tiempo real entre dispositivos (mesero ↔ cocina).
//
// Se controla con VITE_MOCK en .env.local. En el entorno de pruebas se fuerza a `true`
// (ver vite.config.js) para que los tests corran contra los stores locales.
export const IS_MOCK = import.meta.env.VITE_MOCK === 'true'

// pos-balbuena comparte el backend de tali (un mismo restaurante, dos frontends).
// Todo lo del POS se ancla a esta fila de `restaurantes`; usePosData la busca por nombre.
export const RESTAURANTE_NOMBRE = 'Jardín Balbuena'
