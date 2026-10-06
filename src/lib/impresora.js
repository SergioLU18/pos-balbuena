// Envío de tickets a la térmica. En la app de Android (Capacitor) los bytes van directo
// a la impresora por TCP a través del plugin nativo `Impresora`
// (android/app/src/main/java/mx/chichenit/balbuena/ImpresoraPlugin.java). En un
// navegador no hay forma de abrir ese socket, así que ahí solo existe la vista previa.
import { Capacitor, registerPlugin } from '@capacitor/core'
import { aEscPos, aBase64 } from './escpos'
import { useImpresoraStore } from '../store/appStore'

const Impresora = registerPlugin('Impresora')

/** true dentro de la app de Android; false en un navegador. */
export function puedeImprimir() {
  return Capacitor.isNativePlatform()
}

/** Manda un ticket (bloques de tickets.js) a la impresora configurada en esta tablet.
 *  Resuelve `{ ok: true }` o `{ ok: false, motivo }`; no lanza, para que quien llama
 *  decida cómo avisar sin envolver cada impresión en try/catch. */
export async function imprimir(bloques) {
  if (!puedeImprimir()) return { ok: false, motivo: 'Para imprimir abre el POS desde la app de la tablet.' }
  const { host, puerto } = useImpresoraStore.getState()
  if (!host) return { ok: false, motivo: 'Falta configurar la IP de la impresora en Ajustes → Impresora.' }
  try {
    await Impresora.imprimir({ host, puerto, datos: aBase64(aEscPos(bloques)) })
    return { ok: true }
  } catch (e) {
    return { ok: false, motivo: e?.message ?? 'No se pudo imprimir.' }
  }
}

/** Pregunta a la impresora si está conectada y con papel. Ver ImpresoraPlugin.estado. */
export async function estadoImpresora({ host, puerto }) {
  if (!puedeImprimir() || !host) return null
  return Impresora.estado({ host, puerto })
}
