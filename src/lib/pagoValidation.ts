// Reglas para registrar un pago nuevo en PagoDrawer.
//
// Dos restricciones, ambas sobre dinero, así que fallan cerrado: cualquier
// entrada rara (NaN, negativa, campos vacíos) deja `puedeRegistrar` en false
// en vez de dejar pasar una fila incorrecta.
//
// Devuelve banderas, no textos: el drawer arma los mensajes con
// toLocaleString() como el resto de la app, y el botón y el guard del submit
// leen el mismo `puedeRegistrar` para que no se desincronicen.

/** Tolerancia en colones — los inputs son step="0.01". */
const EPSILON = 0.005;

export interface NuevoPagoInput {
  /** Precio total de la reserva. */
  precio: number;
  /** Suma de los pagos ya registrados. */
  totalPagado: number;
  /** Monto SINPE que se está por registrar. */
  sinpe: number;
  /** Monto efectivo que se está por registrar. */
  efectivo: number;
  /** Si el usuario ya adjuntó la imagen del comprobante. */
  tieneComprobante: boolean;
}

export interface ValidacionNuevoPago {
  /** Cuánto falta para llegar al precio. Nunca negativo. */
  restante: number;
  /** La reserva ya llegó (o pasó) el precio: no admite pagos nuevos. */
  yaPagada: boolean;
  /** Hay monto SINPE, así que el comprobante dejó de ser opcional. */
  comprobanteRequerido: boolean;
  /** Hay monto SINPE pero no se adjuntó comprobante. */
  faltaComprobante: boolean;
  /** SINPE + efectivo se pasan de lo que falta por pagar. */
  excedePrecio: boolean;
  /** Ambos montos en cero. */
  sinMonto: boolean;
  /** Algún monto negativo. */
  montoInvalido: boolean;
  /** Suma de los montos de este pago, ya saneada. */
  total: number;
  puedeRegistrar: boolean;
}

/** NaN, Infinity y undefined valen 0 — parseFloat("") no debe romper la regla. */
function sane(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function validarNuevoPago({
  precio,
  totalPagado,
  sinpe,
  efectivo,
  tieneComprobante,
}: NuevoPagoInput): ValidacionNuevoPago {
  const montoSinpe = sane(sinpe);
  const montoEfectivo = sane(efectivo);
  const total = montoSinpe + montoEfectivo;

  const restante = Math.max(0, sane(precio) - sane(totalPagado));
  const yaPagada = restante <= 0;

  const comprobanteRequerido = montoSinpe > 0;
  const faltaComprobante = comprobanteRequerido && !tieneComprobante;
  const montoInvalido = montoSinpe < 0 || montoEfectivo < 0;
  const sinMonto = !montoInvalido && total <= 0;
  // Una reserva ya pagada se reporta como `yaPagada`, no como exceso: el
  // mensaje útil ahí es "ya está pagada", no "máximo restante: ₡0".
  const excedePrecio = !yaPagada && !montoInvalido && total - restante > EPSILON;

  return {
    restante,
    yaPagada,
    comprobanteRequerido,
    faltaComprobante,
    excedePrecio,
    sinMonto,
    montoInvalido,
    total,
    puedeRegistrar:
      !yaPagada &&
      !montoInvalido &&
      !sinMonto &&
      !faltaComprobante &&
      !excedePrecio,
  };
}
