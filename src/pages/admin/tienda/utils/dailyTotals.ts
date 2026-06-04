/**
 * Returns the Costa Rica (UTC-6, no DST) calendar day for an ISO timestamp,
 * formatted as YYYY-MM-DD. en-CA locale yields ISO-style date parts.
 */
export function getCostaRicaDayKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-CA", {
    timeZone: "America/Costa_Rica",
  });
}

export interface VentaForDaily {
  id: number;
  transaccion_id: string | null;
  fecha_venta: string | null;
  created_at: string;
  metodo_pago: string;
  precio_unitario: number;
  cantidad: number;
}

export interface DailyTotal {
  dateKey: string; // YYYY-MM-DD in Costa Rica time
  efectivo: number;
  sinpe: number;
  transferencia: number;
  otros: number;
  total: number;
  transacciones: number; // distinct transaction count
}

const ventaDate = (venta: VentaForDaily): string =>
  venta.fecha_venta ?? venta.created_at;

const transaccionKey = (venta: VentaForDaily): string =>
  venta.transaccion_id ?? `legacy-${venta.id}`;

/**
 * Aggregates raw producto_ventas line rows into one summary per Costa Rica
 * calendar day, split by payment method, sorted newest day first.
 */
export function groupVentasByDay(ventas: VentaForDaily[]): DailyTotal[] {
  const byDay = new Map<
    string,
    { totals: DailyTotal; transacciones: Set<string> }
  >();

  for (const venta of ventas) {
    const dateKey = getCostaRicaDayKey(ventaDate(venta));
    let entry = byDay.get(dateKey);
    if (!entry) {
      entry = {
        totals: {
          dateKey,
          efectivo: 0,
          sinpe: 0,
          transferencia: 0,
          otros: 0,
          total: 0,
          transacciones: 0,
        },
        transacciones: new Set<string>(),
      };
      byDay.set(dateKey, entry);
    }

    const lineValue = venta.precio_unitario * venta.cantidad;
    entry.totals.total += lineValue;
    entry.transacciones.add(transaccionKey(venta));

    switch (venta.metodo_pago.toLowerCase()) {
      case "efectivo":
        entry.totals.efectivo += lineValue;
        break;
      case "sinpe":
        entry.totals.sinpe += lineValue;
        break;
      case "transferencia":
        entry.totals.transferencia += lineValue;
        break;
      default:
        entry.totals.otros += lineValue;
        break;
    }
  }

  return Array.from(byDay.values())
    .map(({ totals, transacciones }) => ({
      ...totals,
      transacciones: transacciones.size,
    }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0));
}
