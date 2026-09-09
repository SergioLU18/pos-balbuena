// Cómo se casa un renglón que se MUESTRA en el ticket con el renglón que lo originó
// dentro de un pedido de cocina. De eso depende que los −/+ y el "Quitar" de un renglón
// ya enviado actúen sobre la comanda correcta.
//
// Vive aquí, y no junto al ticket, porque cada flujo elige su clave y el componente solo
// la recibe.

/** Cuentas de MESA: el ticket se pinta de `cuenta_items` (la tabla plana de tali) y la
 *  comanda de `pedidos.items`. Los dos comparten `nombre` —que es como cuenta_items
 *  agrupa— pero no el id: cuenta_items trae su propio id de fila. En modo mock los dos
 *  lados son el mismo objeto y sí comparten id, y no tienen `nombre`; `nombre ?? id`
 *  sirve para los dos casos. */
export const claveRenglonPorNombre = (it) => it.nombre ?? it.id

/** Órdenes PARA LLEVAR: no hay cuenta_items detrás — el ticket se arma de los propios
 *  renglones de las comandas (ver useOrdenLlevar), así que lo mostrado y lo enviado son
 *  el MISMO objeto y casan por id. Casar por nombre sería peor aquí: dos comandas del
 *  mismo cliente con el mismo platillo caerían en la misma clave y los −/+ moverían el
 *  renglón equivocado. */
export const claveRenglonPorId = (it) => it.id
