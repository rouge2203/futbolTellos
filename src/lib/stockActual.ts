export interface StockActualRow {
  producto_id: number;
  ubicacion_id: number;
  stock: number;
  precio_venta: number;
  costo_unitario: number;
}

export function filterStockRows(
  rows: StockActualRow[],
  activeProductoIds: Set<number>,
  activeUbicacionIds: Set<number>,
): StockActualRow[] {
  return rows.filter(
    (r) =>
      activeProductoIds.has(r.producto_id) &&
      activeUbicacionIds.has(r.ubicacion_id),
  );
}

export function buildProductStocks<P extends { id: number }>(
  productos: P[],
  ubicaciones: { id: number }[],
  rows: StockActualRow[],
): { producto: P; stockByLocation: { [ubicacionId: number]: number }; total: number }[] {
  return productos.map((producto) => {
    const stockByLocation: { [ubicacionId: number]: number } = {};
    ubicaciones.forEach((u) => {
      stockByLocation[u.id] = 0;
    });
    rows
      .filter((r) => r.producto_id === producto.id)
      .forEach((r) => {
        if (stockByLocation[r.ubicacion_id] !== undefined) {
          stockByLocation[r.ubicacion_id] += r.stock;
        }
      });
    const total = Object.values(stockByLocation).reduce(
      (sum, val) => sum + val,
      0,
    );
    return { producto, stockByLocation, total };
  });
}
