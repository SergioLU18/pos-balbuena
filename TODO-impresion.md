# TODO · Impresión de tickets

Impresora: HSTEM térmica 80 mm (ESC/POS, 48 columnas, USB + Ethernet).
Decisión: cada tablet Android imprime directo a la impresora por la red local
(TCP 9100). Sin puente siempre prendido. El POS se empaqueta como app de Android con
**Capacitor** (plugin nativo `Impresora` que abre el socket). Se descartó RawBT.
Guía para el restaurante: [docs/instalacion-impresora.md](docs/instalacion-impresora.md).

## Ya probado
- [x] Impresión por USB desde la PC (cola de Windows `Termica80`, driver Generic / Text Only, modo RAW).
- [x] Acentos, ñ y ¡ con code page PC850 (`ESC t 2`).
- [x] Corte de papel (`GS V 66 0`).
- [x] Encabezado fiscal (razón social, RFC, CURP, régimen, dirección, teléfonos).
- [x] Generador del POS (`src/lib/escpos.js` + `tickets.js`) impreso por USB desde la PC.

## Red
- [ ] Conectar la impresora al router por Ethernet.
- [ ] Imprimir la hoja de configuración (encender con FEED presionado) y anotar su IP.
- [ ] Si la IP de fábrica está en otra subred, cambiarla a una fija dentro de la red del restaurante.
- [ ] Probar impresión por TCP 9100 desde la PC.

## App Android (Capacitor)
- [x] Capacitor instalado, proyecto `android/` generado (appId `mx.chichenit.balbuena`).
- [x] Plugin nativo `ImpresoraPlugin.java`: `imprimir` (TCP 9100) y `estado` (DLE EOT, papel/tapa).
- [x] `src/lib/impresora.js`: envío desde el POS; en navegador solo vista previa.
- [x] Ajustes → Impresora: IP por tablet, probar conexión, imprimir prueba, vista previa.
- [x] "Imprimir cuenta" imprime la pre-cuenta; si falla, aviso con vista previa y "Continuar sin imprimir".
- [ ] Instalar Android Studio en la PC (trae JDK + SDK) para compilar.
- [ ] Poner la URL de Netlify en `capacitor.config.ts` (`POS_URL`).
- [ ] Compilar el primer APK y probarlo en una tablet.
- [ ] Ícono y nombre de la app.
- [ ] Firmar el APK con una llave propia (guardarla bien: sin ella no se puede actualizar la app instalada).
- [ ] Aviso de "hay versión nueva" para APKs (comparar versión contra un archivo publicado y abrir la descarga).
- [ ] Validar si la HSTEM contesta DLE EOT por red (si no, "Probar conexión" solo dirá Conectada).

### iPad (iOS)
- [x] Plataforma iOS agregada (`ios/`, Swift Package Manager, iOS 15+).
- [x] Plugin `ios/App/App/ImpresoraPlugin.swift` (gemelo del de Android) + `MainViewController` que lo registra.
- [x] Permiso `NSLocalNetworkUsageDescription` en Info.plist.
- [ ] En la Mac: `npx cap sync ios` → `npx cap open ios` → elegir Team de firma → compilar en un iPad.
- [ ] Elegir distribución: Ad Hoc (sin revisión, se puede cargar desde Netlify) vs. TestFlight / App Store privada (conviene empaquetar el POS).
- [ ] Test de la pantalla de mesa: "Imprimir cuenta" → aviso → "Continuar sin imprimir" desbloquea "Cerrar mesa".

## Ticket
Dos tickets distintos:
- **Pre-cuenta** (botón "Imprimir cuenta", antes de cobrar): sin folio, leyenda "Pre-cuenta · No es comprobante de pago".
- **Comprobante de pago** (al cobrar, ya se sabe el método).

### Folio (solo pagos con tarjeta)
Decidido:
- Tarjeta (mesa o para llevar) → se asigna folio **al cobrar**, dentro de la misma operación. Se imprime con folio.
- Efectivo (mesa o para llevar) → sin folio. Se imprime nota sin folio.
- Pagos por tali → llevan folio "detrás de cámaras" (no se imprime). Idea: asignarlo con un trigger en la BD cuando la cuenta pasa a pagada, así cubre POS y tali con el mismo consecutivo.
- Un solo consecutivo para mesa y para llevar. El `L-{folio}` actual de para llevar se queda como número de orden (cocina), no es el folio fiscal.

Pendiente de confirmar:
- [ ] Pago mixto (efectivo + tarjeta): ¿lleva folio?
- [ ] Formato del folio (preguntado al contador).

Tareas:
- [ ] Consecutivo de folios en Supabase (sin huecos: solo se consume al cobrar con tarjeta).
- [ ] Asignar folio en `pos_cerrar_mesa` y `pos_pagar_orden_llevar` cuando el método es tarjeta.
- [ ] Asignar folio a pagos hechos en tali.
- [ ] Mostrar el folio en la bitácora / cierre del día.
- [ ] Datos del negocio en Supabase (tabla de configuración) en vez de fijos en el código.
- [ ] Leyendas: "No es comprobante fiscal", "Precios con IVA incluido" (confirmar con contador), cómo pedir factura.
- [x] Conectar "Imprimir cuenta" (`MeseroOrdenPage`) → pre-cuenta.
- [ ] Conectar "Reimprimir ticket" (`PedidosModal`), hoy placeholder.
- [ ] Comprobante de pago (después de cobrar), con folio si es tarjeta.
- [ ] Imprimir también desde para llevar.
- [ ] ¿Propina sugerida en la pre-cuenta?
- [ ] "Peréz" en la razón social: así viene en la tarjeta; confirmar si es "Pérez".
- [ ] Leyenda "REIMPRESIÓN" en reimpresiones.
- [ ] Título a doble tamaño: `GS !` no funcionó bien, probar `ESC !`.

## Después (si hace falta)
- [ ] Impresión automática sin toque (p. ej. comandas en cocina): ya es posible con la app.
- [ ] Modo kiosco en las tablets.
