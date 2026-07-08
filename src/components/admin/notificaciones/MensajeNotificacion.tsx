import { cn } from "../../../lib/utils";
import { formatFechaHoraCorta } from "./format";
import { esAgrupada, type Notificacion } from "./types";

interface MensajeNotificacionProps {
  notificacion: Notificacion;
  muted?: boolean;
}

// "Notificar árbitro de reserva cancelada. Reserva: {nombre} · {cancha} · {cuándo}"
// Shared by the quick-view list and the detail dialog lead so the wording is
// identical in both places.
export default function MensajeNotificacion({
  notificacion: n,
  muted = false,
}: MensajeNotificacionProps) {
  const strong = cn("font-semibold", muted ? "text-gray-500" : "text-gray-900");
  const nombre = n.nombre_reserva ?? "Cliente";
  const cancha = n.cancha_nombre ?? "la cancha";
  const cuando = esAgrupada(n)
    ? `${n.cantidad_fechas} fechas`
    : n.hora_inicio
      ? formatFechaHoraCorta(n.hora_inicio)
      : null;
  const referencia = [nombre, cancha, cuando].filter(Boolean).join(" · ");

  return (
    <>
      Notificar árbitro de reserva cancelada.
      <br />
      Reserva: <span className={strong}>{referencia}</span>
    </>
  );
}
