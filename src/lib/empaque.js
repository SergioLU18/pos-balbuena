import { f } from './utils'

// Empaque de un platillo PARA LLEVAR, por pieza (bebidas incluidas): en desechable se
// cobra de más para cubrir el plástico; si el cliente trae su propio tupper se le
// descuenta. Solo aplica a las órdenes para llevar — un renglón de mesa nunca trae
// `empaque`.
//
// El ajuste se guarda en el propio renglón (`ajusteEmpaque`, con signo) y entra en su
// precio_unitario al enviarlo a cocina, igual que el precio de un extra: así el cobro,
// el cierre del día, el historial del cliente y la bitácora lo suman sin saber que
// existe, y un renglón ya enviado conserva el monto aunque éste cambie después.
export const EMPAQUE_MONTO = 5

export const EMPAQUES = {
  plastico: { texto: 'Desechable', ajuste: EMPAQUE_MONTO },
  tupper: { texto: 'Trae su tupper', ajuste: -EMPAQUE_MONTO },
}

/** El renglón con el empaque indicado ('plastico' | 'tupper') y su ajuste. */
export function conEmpaque(item, empaque) {
  return { ...item, empaque, ajusteEmpaque: EMPAQUES[empaque].ajuste }
}

/** "Desechable (+$5.00)" / "Trae su tupper (−$5.00)", o null si el renglón no lleva
 *  empaque. Entra en nombreItem() para que el renglón congelado (historial, bitácora)
 *  explique por qué su precio no es el del menú. */
export function empaqueTexto(item) {
  if (!item.empaque) return null
  const ajuste = Number(item.ajusteEmpaque ?? EMPAQUES[item.empaque]?.ajuste ?? 0)
  const signo = ajuste < 0 ? '−' : '+'
  return `${EMPAQUES[item.empaque]?.texto ?? item.empaque} (${signo}${f(Math.abs(ajuste))})`
}
