import { describe, it, expect } from "vitest";
import {
  getCostaRicaDayKey,
  groupVentasByDay,
  type VentaForDaily,
} from "./dailyTotals";

const v = (over: Partial<VentaForDaily>): VentaForDaily => ({
  id: 0,
  transaccion_id: null,
  fecha_venta: null,
  created_at: "2026-06-02T10:00:00-06:00",
  metodo_pago: "efectivo",
  precio_unitario: 0,
  cantidad: 1,
  ...over,
});

describe("getCostaRicaDayKey", () => {
  it("returns the CR calendar day for a CR-offset timestamp", () => {
    expect(getCostaRicaDayKey("2026-06-02T23:30:00-06:00")).toBe("2026-06-02");
  });

  it("returns the previous CR day for a late-night UTC timestamp", () => {
    // 2026-06-03 04:30 UTC === 2026-06-02 22:30 in Costa Rica
    expect(getCostaRicaDayKey("2026-06-03T04:30:00Z")).toBe("2026-06-02");
  });

  it("handles midnight at CR offset", () => {
    expect(getCostaRicaDayKey("2026-06-02T00:00:00-06:00")).toBe("2026-06-02");
  });
});

describe("groupVentasByDay", () => {
  it("groups by CR day, splits by method, counts distinct transactions, sorts desc", () => {
    const ventas: VentaForDaily[] = [
      v({ id: 1, transaccion_id: "t1", fecha_venta: "2026-06-02T09:00:00-06:00", metodo_pago: "efectivo", precio_unitario: 500, cantidad: 1 }),
      v({ id: 2, transaccion_id: "t1", fecha_venta: "2026-06-02T09:00:00-06:00", metodo_pago: "efectivo", precio_unitario: 1000, cantidad: 1 }),
      v({ id: 3, transaccion_id: "t2", fecha_venta: "2026-06-02T18:00:00-06:00", metodo_pago: "sinpe", precio_unitario: 1000, cantidad: 1 }),
      v({ id: 4, transaccion_id: "t3", fecha_venta: "2026-06-03T08:00:00-06:00", metodo_pago: "Transferencia", precio_unitario: 800, cantidad: 1 }),
      v({ id: 5, transaccion_id: "t4", fecha_venta: "2026-06-03T20:00:00-06:00", metodo_pago: "efectivo", precio_unitario: 300, cantidad: 2 }),
    ];

    const result = groupVentasByDay(ventas);

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      dateKey: "2026-06-03",
      efectivo: 600,
      sinpe: 0,
      transferencia: 800,
      otros: 0,
      total: 1400,
      transacciones: 2,
    });

    expect(result[1]).toEqual({
      dateKey: "2026-06-02",
      efectivo: 1500,
      sinpe: 1000,
      transferencia: 0,
      otros: 0,
      total: 2500,
      transacciones: 2,
    });
  });

  it("uses created_at when fecha_venta is null and folds unknown methods into otros", () => {
    const ventas: VentaForDaily[] = [
      v({ id: 9, transaccion_id: null, fecha_venta: null, created_at: "2026-06-01T12:00:00-06:00", metodo_pago: "tarjeta", precio_unitario: 250, cantidad: 1 }),
    ];
    const result = groupVentasByDay(ventas);
    expect(result).toEqual([
      { dateKey: "2026-06-01", efectivo: 0, sinpe: 0, transferencia: 0, otros: 250, total: 250, transacciones: 1 },
    ]);
  });

  it("returns an empty array for no ventas", () => {
    expect(groupVentasByDay([])).toEqual([]);
  });
});
