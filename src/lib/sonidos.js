// Sonidos de aviso del POS, sintetizados con Web Audio en vez de archivos de audio: no
// hay assets que precargar (la tablet puede estar en una red mala), suenan igual sin
// conexión, y afinar un tono es cambiar un número aquí en vez de reexportar un audio.
//
// El navegador no deja sonar nada hasta que el usuario toca la pantalla, así que el
// AudioContext se crea perezosamente en el primer sonido (que siempre nace de un tap) y
// se reanuda en cada uso por si el navegador lo suspendió al dormir la tablet.
//
// OJO en iPad: el switch de silencio del aparato apaga Web Audio y la página no tiene
// forma de saberlo, y una tablet dormida o con Safari en segundo plano tampoco suena.
// Eso no se arregla desde el código — es configuración del aparato.

let ctx = null

function audioCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext ?? window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Una nota: oscilador + envolvente. `inicio` es un offset en segundos desde "ahora" para
// encadenar notas con el reloj de audio (mucho más preciso que setTimeout, y no se
// desfasa aunque el hilo de React esté ocupado renderizando).
//
// El ataque de 8 ms evita el chasquido que da arrancar en volumen pleno, y la caída
// exponencial es lo que hace que se oiga como campana y no como bocina.
function tono(ctx, { frecuencia, inicio = 0, duracion, volumen, forma = 'sine' }) {
  const t0 = ctx.currentTime + inicio
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = forma
  osc.frequency.value = frecuencia
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(volumen, t0 + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duracion + 0.02)
}

/** Un pedido de mis mesas quedó listo para recoger. Dos notas ascendentes (Mi5 → La5),
 *  suaves: se tiene que oír en el salón sin que voltee la mesa de al lado. */
export function sonarListo() {
  const ctx = audioCtx()
  if (!ctx) return
  tono(ctx, { frecuencia: 659.25, duracion: 0.34, volumen: 0.18 })
  tono(ctx, { frecuencia: 880.0, inicio: 0.13, duracion: 0.42, volumen: 0.18 })
}

/** Algo no se guardó (envío a cocina, edición de un renglón ya enviado). Dos blips
 *  graves: el contorno DESCENDENTE y el timbre más áspero lo hacen inconfundible con
 *  el de listo aunque el mesero no esté viendo la pantalla. */
export function sonarError() {
  const ctx = audioCtx()
  if (!ctx) return
  tono(ctx, { frecuencia: 233.08, duracion: 0.12, volumen: 0.22, forma: 'triangle' })
  tono(ctx, { frecuencia: 196.0, inicio: 0.15, duracion: 0.18, volumen: 0.22, forma: 'triangle' })
}

/** La orden sí salió a cocina. Un clic corto y apagado, casi subliminal a propósito:
 *  solo confirma que el tap registró antes de que el mesero se dé la vuelta. */
export function sonarConfirmacion() {
  const ctx = audioCtx()
  if (!ctx) return
  tono(ctx, { frecuencia: 900, duracion: 0.06, volumen: 0.1 })
}

/** Arranca (o reanuda) el audio aprovechando un tap que el mesero ya está dando.
 *  Hace falta porque el aviso importante —"pedido listo"— llega solo, sin que nadie
 *  toque la pantalla en ese instante, y el navegador no deja sonar nada hasta que hubo
 *  un gesto real. Se llama desde el teclado del PIN, que se teclea en CADA carga de la
 *  app (sessionUnlocked no se persiste), así que el audio siempre queda armado antes de
 *  que el mesero llegue al mapa de mesas. */
export function desbloquearAudio() {
  audioCtx()
}
