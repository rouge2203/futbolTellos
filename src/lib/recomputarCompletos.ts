// Rehace la bandera `completo` de los pagos de una reserva.
//
// `completo` no se deriva al leer: se guarda por fila en el INSERT, con el total
// acumulado hasta ese momento. Mientras los pagos sólo se agregaban eso
// alcanzaba, pero desde que un superusuario puede anular o editar un pago viejo
// la bandera queda mintiendo — los consumidores preguntan
// `pagos.some(p => p.completo === true)` (ver src/pages/admin/Pagos.tsx), así
// que una reserva que quedó corta seguiría apareciendo como pagada.
//
// Es dinero, así que falla cerrado: cualquier monto raro (NaN, Infinity, null,
// undefined) vale 0. Con eso el recomputo tiende a marcar "incompleto" en vez
// de dar por pagada una reserva que no lo está.

/**
 * Tolerancia en colones, el mismo criterio que src/lib/pagoValidation.ts.
 * Los montos son bigint en la base, así que en la práctica no cambia nada;
 * está para que un precio con decimales no falle por ruido de punto flotante.
 */
const EPSILON = 0.005;

export interface PagoParaRecomputo {
  id: number;
  monto_sinpe: number;
  monto_efectivo: number;
  completo: boolean;
  created_at?: string | null;
  anulado_at?: string | null;
}

/** NaN, Infinity, null y undefined valen 0 — ningún monto raro suma. */
function sane(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * `created_at` en milisegundos, o -Infinity si la fila no trae fecha usable.
 *
 * El campo es opcional en el contrato, así que el caso realista es que el
 * llamador no lo haya pedido en el select y falte en TODAS las filas: ahí todas
 * empatan y manda el id, que es bigserial y respeta el orden de inserción.
 */
function instante(createdAt: string | null | undefined): number {
  if (!createdAt) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(createdAt);
  return Number.isNaN(ms) ? Number.NEGATIVE_INFINITY : ms;
}

/**
 * Devuelve SÓLO las filas cuya bandera `completo` cambió, para que el llamador
 * persista nada más esas. Si nada cambió devuelve [].
 *
 * Los pagos anulados se ignoran por completo: no suman al acumulado y su propia
 * bandera no se toca (nunca salen en el resultado).
 */
export function recomputarCompletos(
  pagos: PagoParaRecomputo[],
  precio: number
): Array<{ id: number; completo: boolean }> {
  const vivos = (pagos ?? []).filter((pago) => pago && !pago.anulado_at);

  // Copia antes de ordenar: el llamador nos pasa el arreglo que ya vive en el
  // estado de React y un .sort() in-place lo reordenaría por debajo.
  const enOrden = [...vivos].sort((a, b) => {
    const ia = instante(a.created_at);
    const ib = instante(b.created_at);
    // El !== evita restar -Infinity con -Infinity (daría NaN y rompería el sort).
    if (ia !== ib) return ia - ib;
    return sane(a.id) - sane(b.id);
  });

  const meta = sane(precio);
  const cambios: Array<{ id: number; completo: boolean }> = [];
  let acumulado = 0;

  for (const pago of enOrden) {
    acumulado += sane(pago.monto_sinpe) + sane(pago.monto_efectivo);
    // Con meta <= 0 esto da true desde el primer pago vivo, que es lo esperado:
    // una reserva sin precio no puede quedar debiendo.
    const completo = acumulado >= meta - EPSILON;
    // `=== true` porque en la base la columna admite null y los consumidores ya
    // tratan null como false: normalizarlo acá evita escrituras inútiles.
    if (completo !== (pago.completo === true)) {
      cambios.push({ id: pago.id, completo });
    }
  }

  return cambios;
}
