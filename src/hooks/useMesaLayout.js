import { sb } from '../lib/supabase'
import { IS_MOCK } from '../lib/config'
import { useMesaLayoutStore, usePosStore } from '../store/appStore'

// Posiciones de las mesas en el mapa del piso, como fracciones 0..1.
//
// Modo mock: viven en localStorage (useMesaLayoutStore), por dispositivo.
// Modo backend: viven en las columnas pos_x/pos_y de la tabla `pos_mesas`, así el acomodo
// del salón es el mismo en todas las tablets y sobrevive recargas. Realtime propaga
// cualquier cambio de acomodo al instante.
export function useMesaLayout() {
  const localPosiciones = useMesaLayoutStore((s) => s.posiciones)
  const setLocalPosicion = useMesaLayoutStore((s) => s.setPosicion)
  const mesas = usePosStore((s) => s.mesas)

  if (IS_MOCK) {
    return { posiciones: localPosiciones, setPosicion: setLocalPosicion }
  }

  const posiciones = {}
  for (const m of mesas) {
    if (m.pos_x != null && m.pos_y != null) posiciones[m.id] = { x: m.pos_x, y: m.pos_y }
  }

  const setPosicion = (mesaId, x, y) => {
    sb.from('pos_mesas')
      .update({ pos_x: x, pos_y: y })
      .eq('id', mesaId)
      .then(({ error }) => { if (error) console.error('[layout] setPosicion falló:', error) })
  }

  return { posiciones, setPosicion }
}
