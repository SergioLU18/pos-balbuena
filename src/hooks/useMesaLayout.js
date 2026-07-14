import { useMesaLayoutStore } from '../store/appStore'

// Posiciones de las mesas en el mapa del piso, como fracciones 0..1.
//
// Se guardan localmente (localStorage), por dispositivo, en ambos modos. La tabla
// `mesas` de tali no tiene columnas de posición y no queremos modificar sus tipos
// solo por el acomodo visual del salón, que es una preferencia del POS. Si más
// adelante se quiere compartir el acomodo entre tablets, se movería a su propia tabla.
export function useMesaLayout() {
  const posiciones = useMesaLayoutStore((s) => s.posiciones)
  const setPosicion = useMesaLayoutStore((s) => s.setPosicion)
  return { posiciones, setPosicion }
}
