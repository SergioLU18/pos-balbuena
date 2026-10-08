// Tickets para la térmica de 80 mm (ESC/POS, 48 columnas en la fuente normal).
//
// Un ticket se describe como una lista de bloques (ver tickets.js) y aquí se convierte
// en dos cosas a partir del MISMO maquetado: los renglones de texto que pinta la vista
// previa y los bytes que se mandan a la impresora. El acomodo (partir renglones,
// centrar, alinear importes a la derecha) se hace aquí con espacios y no con los
// comandos de alineación de la impresora: así la vista previa es exactamente lo que
// sale en papel, y no dependemos de qué tan bien implemente esos comandos un modelo
// genérico.
//
// Bloques:
//   { tipo: 'texto', texto, alinear?: 'izq'|'centro'|'der', negrita?, grande?, alto? }
//   { tipo: 'columnas', izq, der, prefijo?, negrita?, grande?, alto? }  importe a la derecha
//
// Tamaños: `grande` es doble alto + doble ancho (caben 24 columnas); `alto` es solo doble
// alto, así que se lee más grande sin perder ancho (siguen cabiendo las 48).
// `fuenteB`: la fuente angosta de la impresora (9 puntos de ancho en vez de 12): caben
// 64 columnas, o 32 en `grande` — un tamaño intermedio entre la normal y la grande.
// `aire`: alto del renglón en puntos (ESC 3 n), para separar renglones de doble alto.
//   { tipo: 'linea', caracter? }                                 separador de ancho completo
//   { tipo: 'espacio', n? }                                      renglones en blanco

export const COLUMNAS = 48
// Ancho de carácter en puntos de cada fuente: con la B caben 4/3 de columnas.
const ANCHO_FUENTE_A = 12
const ANCHO_FUENTE_B = 9

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

// GS ! n: nibble alto = ancho, nibble bajo = alto. En letra grande caben la mitad de columnas.
const TAMANO = { normal: 0x00, alto: 0x01, grande: 0x11 }
const tamanoDe = (r) => (r.grande ? 'grande' : r.alto ? 'alto' : 'normal')

/** Parte un texto en renglones de a lo más `ancho` caracteres, cortando entre palabras.
 *  Una palabra más larga que el renglón se corta a la fuerza. */
export function partirTexto(texto, ancho) {
  const renglones = []
  for (const parrafo of String(texto ?? '').split('\n')) {
    let actual = ''
    for (let palabra of parrafo.split(/\s+/).filter(Boolean)) {
      while (palabra.length > ancho) {
        if (actual) { renglones.push(actual); actual = '' }
        renglones.push(palabra.slice(0, ancho))
        palabra = palabra.slice(ancho)
      }
      if (!palabra) continue
      if (!actual) actual = palabra
      else if (actual.length + 1 + palabra.length <= ancho) actual += ' ' + palabra
      else { renglones.push(actual); actual = palabra }
    }
    renglones.push(actual)
  }
  return renglones
}

function alinear(texto, ancho, como) {
  const sobra = Math.max(0, ancho - texto.length)
  if (como === 'centro') return ' '.repeat(Math.floor(sobra / 2)) + texto
  if (como === 'der') return ' '.repeat(sobra) + texto
  return texto
}

/** Bloques → renglones ya acomodados: `{ texto, negrita, grande, alto, fuenteB, aire }`. */
export function maquetar(bloques, columnas = COLUMNAS) {
  const out = []
  for (const b of bloques) {
    const grande = !!b.grande
    const fuenteB = !!b.fuenteB
    const estilo = { negrita: !!b.negrita, grande, alto: !grande && !!b.alto, fuenteB, aire: b.aire ?? null }
    const base = fuenteB ? Math.floor((columnas * ANCHO_FUENTE_A) / ANCHO_FUENTE_B) : columnas
    const ancho = grande ? Math.floor(base / 2) : base

    if (b.tipo === 'texto') {
      for (const r of partirTexto(b.texto, ancho)) out.push({ texto: alinear(r, ancho, b.alinear), ...estilo })
    } else if (b.tipo === 'columnas') {
      // `prefijo` (la cantidad, p. ej.) va pegado al primer renglón y los renglones de
      // continuación de un concepto largo se sangran a su ancho, para que se lea que
      // siguen al de arriba y no que son otro concepto.
      const der = String(b.der ?? '')
      const prefijo = b.prefijo ?? ''
      const sangria = ' '.repeat(prefijo.length)
      const anchoIzq = Math.max(1, ancho - prefijo.length - der.length - 1)
      const [primero, ...resto] = partirTexto(b.izq, anchoIzq)
      out.push({ texto: (prefijo + primero).padEnd(ancho - der.length) + der, ...estilo })
      for (const r of resto.flatMap((r) => partirTexto(r, ancho - sangria.length))) {
        out.push({ texto: sangria + r, ...estilo })
      }
    } else if (b.tipo === 'linea') {
      out.push({ texto: (b.caracter ?? '-').repeat(ancho), ...estilo, negrita: false })
    } else if (b.tipo === 'espacio') {
      for (let i = 0; i < (b.n ?? 1); i++) out.push({ texto: '', negrita: false, grande: false, alto: false, fuenteB: false, aire: null })
    }
  }
  return out
}

// Code page PC850 (ESC t 2): cubre acentos, ñ y signos de apertura del español.
const CP850 = {
  'á': 0xa0, 'é': 0x82, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5,
  'ü': 0x81, 'Ü': 0x9a, '¡': 0xad, '¿': 0xa8, 'Á': 0xb5, 'É': 0x90, 'Í': 0xd6,
  'Ó': 0xe0, 'Ú': 0xe9, '°': 0xf8, '·': 0xfa, '×': 0x9e,
}
// Lo que la impresora no tiene, pero tiene un equivalente obvio.
const EQUIVALENTES = { '−': '-', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...' }

/** Texto → bytes en PC850. Lo que no existe en esa tabla se manda sin acento, o como "?". */
export function codificar(texto) {
  const bytes = []
  for (const ch of texto) {
    const code = ch.codePointAt(0)
    if (code < 0x80) bytes.push(code)
    else if (CP850[ch] != null) bytes.push(CP850[ch])
    else if (EQUIVALENTES[ch]) for (const c of EQUIVALENTES[ch]) bytes.push(c.charCodeAt(0))
    else {
      const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
      bytes.push(base.length === 1 && base.charCodeAt(0) < 0x80 ? base.charCodeAt(0) : 0x3f)
    }
  }
  return bytes
}

/** Bloques → bytes ESC/POS listos para la impresora (incluye avance y corte). */
export function aEscPos(bloques, columnas = COLUMNAS) {
  const bytes = [ESC, 0x40, ESC, 0x74, 2]
  let tamano = 'normal'
  let negrita = false
  let fuenteB = false
  let aire = null
  for (const r of maquetar(bloques, columnas)) {
    const t = tamanoDe(r)
    if (t !== tamano) { bytes.push(GS, 0x21, TAMANO[t]); tamano = t }
    if (r.negrita !== negrita) { bytes.push(ESC, 0x45, r.negrita ? 1 : 0); negrita = r.negrita }
    if (r.fuenteB !== fuenteB) { bytes.push(ESC, 0x4d, r.fuenteB ? 1 : 0); fuenteB = r.fuenteB }
    if (r.aire !== aire) { bytes.push(...(r.aire == null ? [ESC, 0x32] : [ESC, 0x33, r.aire])); aire = r.aire }
    bytes.push(...codificar(r.texto.trimEnd()), LF)
  }
  if (tamano !== 'normal') bytes.push(GS, 0x21, TAMANO.normal)
  if (negrita) bytes.push(ESC, 0x45, 0)
  if (fuenteB) bytes.push(ESC, 0x4d, 0)
  if (aire != null) bytes.push(ESC, 0x32)
  bytes.push(ESC, 0x64, 4) // avanza para que el corte no se coma el último renglón
  bytes.push(GS, 0x56, 0x42, 0) // corte parcial
  return Uint8Array.from(bytes)
}

/** Bytes → base64 (así cruzan el puente hacia el plugin nativo). */
export function aBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}
