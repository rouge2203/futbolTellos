import { describe, it, expect } from "vitest";
import {
  filterStockRows,
  buildProductStocks,
  type StockActualRow,
} from "./stockActual";

const row = (
  producto_id: number,
  ubicacion_id: number,
  stock: number,
  precio_venta = 1000,
  costo_unitario = 600,
): StockActualRow => ({
  producto_id,
  ubicacion_id,
  stock,
  precio_venta,
  costo_unitario,
});

describe("filterStockRows", () => {
  it("keeps only rows whose producto and ubicacion are active", () => {
    const rows = [row(1, 10, 5), row(1, 99, 3), row(2, 10, 7), row(3, 11, 2)];
    const result = filterStockRows(rows, new Set([1, 2]), new Set([10, 11]));
    expect(result).toEqual([row(1, 10, 5), row(2, 10, 7)]);
  });

  it("returns empty array for empty input", () => {
    expect(filterStockRows([], new Set([1]), new Set([10]))).toEqual([]);
  });
});

describe("buildProductStocks", () => {
  const productos = [
    { id: 1, nombre: "Powerade" },
    { id: 2, nombre: "Galleta" },
  ];
  const ubicaciones = [{ id: 10 }, { id: 11 }];

  it("initializes every listed ubicacion at 0", () => {
    const [ps] = buildProductStocks([productos[0]], ubicaciones, []);
    expect(ps.stockByLocation).toEqual({ 10: 0, 11: 0 });
    expect(ps.total).toBe(0);
  });

  it("maps view rows into per-location stock and totals", () => {
    const rows = [row(1, 10, 5), row(1, 11, -2), row(2, 10, 7)];
    const result = buildProductStocks(productos, ubicaciones, rows);
    expect(result[0].stockByLocation).toEqual({ 10: 5, 11: -2 });
    expect(result[0].total).toBe(3);
    expect(result[1].stockByLocation).toEqual({ 10: 7, 11: 0 });
    expect(result[1].total).toBe(7);
  });

  it("ignores rows for ubicaciones not in the list (inactive)", () => {
    const rows = [row(1, 10, 5), row(1, 99, 100)];
    const [ps] = buildProductStocks([productos[0]], ubicaciones, rows);
    expect(ps.stockByLocation).toEqual({ 10: 5, 11: 0 });
    expect(ps.total).toBe(5);
  });

  it("preserves the producto object it was given", () => {
    const result = buildProductStocks(productos, ubicaciones, []);
    expect(result[0].producto).toBe(productos[0]);
  });
});
