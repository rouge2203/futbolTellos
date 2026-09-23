export type RetoStatus = "open" | "closed" | "past";

// Database timestamps are local Costa Rica wall times, without an offset.
export function retoStartTime(timestamp: string): number {
  const iso = timestamp.replace(" ", "T");
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}-06:00`).getTime();
}

export function getRetoStatus(
  reto: { hora_inicio: string; equipo2_encargado: string | null },
  now = Date.now(),
): RetoStatus {
  if (retoStartTime(reto.hora_inicio) <= now) return "past";
  return reto.equipo2_encargado?.trim() ? "closed" : "open";
}

export const RETOS_PAGE_SIZE = 25;

export function isFullCancha(cancha: { id: number; cantidad?: string } | null) {
  return cancha?.id === 6 || cancha?.cantidad === "7-8-9";
}

export function canchaPrice(
  cancha: { id: number; cantidad?: string; precio?: string; local: number },
  fut: number,
  arbitro: boolean,
) {
  const base = isFullCancha(cancha)
    ? ({ 7: 40000, 8: 45000, 9: 50000 }[fut] ?? 40000)
    : Number((cancha.precio || "0").replace(/\./g, ""));
  return base + (cancha.local === 2 && arbitro ? 5000 : 0);
}

export function reservationFut(reserva: {
  fut?: number | null;
  precio: number;
  arbitro: boolean;
  cancha: { id: number; cantidad?: string; local: number };
}) {
  if (!isFullCancha(reserva.cancha)) return parseInt(reserva.cancha.cantidad || "5", 10);
  if ([7, 8, 9].includes(reserva.fut ?? 0)) return reserva.fut!;
  const base = reserva.precio - (reserva.cancha.local === 2 && reserva.arbitro ? 5000 : 0);
  return base === 50000 ? 9 : base === 45000 ? 8 : 7;
}
