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

// Colón amounts are written with period thousand separators, matching how
// canchas.precio is stored. Explicit so the copy never depends on ICU data.
export function formatColones(amount: number) {
  return `₡${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

export type RetoDeleteAction = "full" | "keep";

export function retoDeleteDialog(
  action: RetoDeleteAction,
  reto: { equipo1_encargado: string; equipo2_encargado: string | null },
  pagosTotal = 0,
): { title: string; description: string; confirmLabel: string; tone: "danger" | "primary" } {
  const rival = reto.equipo2_encargado?.trim();
  const titular = reto.equipo1_encargado?.trim() || "el equipo titular";

  if (action === "full") {
    const pagos = pagosTotal > 0
      ? ` Esta reservación tiene ${formatColones(pagosTotal)} en pagos registrados que también se eliminarán.`
      : "";
    return {
      title: "¿Eliminar reto y reservación?",
      description: `Al eliminar este reto también se eliminará su reservación vinculada y se liberará la cancha. Esta acción no se puede deshacer.${pagos}`,
      confirmLabel: "Eliminar reto y reservación",
      tone: "danger",
    };
  }

  const aviso = rival
    ? `Este reto ya tiene un rival asignado: ${rival}. Sus datos de contacto se eliminarán. `
    : "";
  return {
    title: "¿Eliminar reto y conservar reservación?",
    description: `${aviso}El reto dejará de aparecer para los clientes y para ustedes. La reservación de ${titular} se mantiene igual, con su fecha, hora, precio y pagos.`,
    confirmLabel: "Eliminar solo el reto",
    tone: rival ? "danger" : "primary",
  };
}
