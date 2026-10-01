# TODO · Impresión de tickets

Impresora: HSTEM térmica 80 mm (ESC/POS, 48 columnas, USB + Ethernet).
Decisión: cada tablet Android imprime directo a la impresora por la red local
(TCP 9100). Sin puente siempre prendido. Primero con **RawBT**; si no convence,
empaquetar el POS con **Capacitor**.

## Ya probado
- [x] Impresión por USB desde la PC (cola de Windows `Termica80`, driver Generic / Text Only, modo RAW).
- [x] Acentos, ñ y ¡ con code page PC850 (`ESC t 2`).
- [x] Corte de papel (`GS V 66 0`).
- [x] Encabezado fiscal (razón social, RFC, CURP, régimen, dirección, teléfonos).

## Red
- [ ] Conectar la impresora al router por Ethernet.
- [ ] Imprimir la hoja de configuración (encender con FEED presionado) y anotar su IP.
- [ ] Si la IP de fábrica está en otra subred, cambiarla a una fija dentro de la red del restaurante.
- [ ] Probar impresión por TCP 9100 desde la PC.

## RawBT (tablets Android)
- [ ] Instalar RawBT en una tablet o celular de prueba y configurarlo como impresora de red con la IP.
- [ ] `src/lib/escpos.js`: generador de bytes ESC/POS (texto, alineación, negritas, tamaño, corte, PC850).
- [ ] Función para mandar los bytes a RawBT (enlace `intent:` / `rawbt:` en base64), siempre desde un toque de botón.
- [ ] Botón "Imprimir prueba" en Ajustes.
- [ ] Validar en la tablet: qué se ve al imprimir, si regresa solo al POS, diálogo "Abrir con RawBT → Siempre".
- [ ] Revisar si la versión gratis de RawBT tiene anuncios o límites.
- [ ] Aviso en el POS si la tablet no tiene RawBT instalado.

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
- [ ] Conectar "Imprimir cuenta" (`MeseroOrdenPage`) y "Reimprimir ticket" (`PedidosModal`), hoy placeholders.
- [ ] Leyenda "REIMPRESIÓN" en reimpresiones.
- [ ] Título a doble tamaño: `GS !` no funcionó bien, probar `ESC !`.

## Después (si hace falta)
- [ ] Capacitor: APK propio con socket TCP directo, sin RawBT.
- [ ] Impresión automática sin toque (p. ej. comandas en cocina): requiere app propia.
