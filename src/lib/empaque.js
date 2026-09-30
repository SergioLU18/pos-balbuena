import { f } from './utils'

// Empaque de un platillo PARA LLEVAR, por pieza (bebidas incluidas): en desechable se
// cobra de más para cubrir el plástico; si el cliente trae su propio tupper se le
// descuenta. En una orden para llevar todo renglón lo trae; en una mesa, solo el que el
// mesero marcó "Para llevar" en el modal del platillo, y ahí siempre es desechable (el
// resto no trae `empaque`).
//
// El ajuste se guarda en el propio renglón (`ajusteEmpaque`, con signo) y entra en su
// precio_unitario al enviarlo a cocina, igual que el precio de un extra: así el cobro,
// el cierre del día, el historial del cliente y la bitácora lo suman sin saber que
// existe, y un renglón ya enviado conserva el monto aunque éste cambie después.
export const EMPAQUE_MONTO = 5

export const EMPAQUES = {
  plastico: { texto: 'Desechable', ajuste: EMPAQUE_MONTO },
  tupper: { texto: 'Su tupper', ajuste: -EMPAQUE_MONTO },
}

/** El renglón con el empaque indicado ('plastico' | 'tupper') y su ajuste; con null,
 *  el renglón sin empaque (se come en la mesa). */
export function conEmpaque(item, empaque) {
  if (!empaque) return { ...item, empaque: undefined, ajusteEmpaque: undefined }
  return { ...item, empaque, ajusteEmpaque: EMPAQUES[empaque].ajuste }
}

/** "Para llevar (+$5.00)" / "Para llevar · su tupper (−$5.00)", o null si el renglón
 *  no lleva
 *  empaque. Entra en nombreItem() para que el renglón congelado (historial, bitácora)
 *  explique por qué su precio no es el del menú. */
export function empaqueTexto(item) {
  if (!item.empaque) return null
  const ajuste = Number(item.ajusteEmpaque ?? EMPAQUES[item.empaque]?.ajuste ?? 0)
  const signo = ajuste < 0 ? '−' : '+'
  const cual = item.empaque === 'tupper' ? ' · su tupper' : ''
  return `Para llevar${cual} (${signo}${f(Math.abs(ajuste))})`
}
