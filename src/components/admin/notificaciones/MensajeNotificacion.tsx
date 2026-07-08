import { cn } from "../../../lib/utils";
import { formatDateTime } from "./format";
import { esAgrupada, type Notificacion } from "./types";

interface MensajeNotificacionProps {
  notificacion: Notificacion;
  muted?: boolean;
}

// Shared copy for the quick-view list and the detail dialog so the action
// keeps the same wording through the whole flow.
export default function MensajeNotificacion({
  notificacion: n,
  muted = false,
}: MensajeNotificacionProps) {
  const strong = cn(
    "font-semibold",
    muted ? "text-gray-500" : "text-gray-900",
  );
  const nombre = n.nombre_reserva ?? "Cliente";
  const cancha = n.cancha_nombre ?? "la cancha";

  if (esAgrupada(n)) {
    return (
      <>
        <span className={strong}>{n.cantidad_fechas} fechas canceladas</span>{" "}
        de la reserva fija de <span className={strong}>{nombre}</span> en{" "}
        <span className={strong}>{cancha}</span>. Avisar al árbitro.
      </>
    );
  }

  return (
    <>
      La reserva de <span className={strong}>{nombre}</span> en{" "}
      <span className={strong}>{cancha}</span>
      {n.hora_inicio ? <> el {formatDateTime(n.hora_inicio)}</> : null} fue
      cancelada. Avisar al árbitro.
    </>
  );
}
