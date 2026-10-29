// Wording for the whatsapp_fallido notification raised by
// public.wa_report_failed_notification when a reminder exhausts every retry.
// Kept as pure functions so the copy is testable without a DOM.
import { parseDateFromTimestamp } from "./format";
import type { Notificacion } from "./types";

export const TIPO_WHATSAPP_FALLIDO = "whatsapp_fallido";

export const esWhatsappFallido = (n: Notificacion): boolean =>
  n.tipo === TIPO_WHATSAPP_FALLIDO;

// "9:05 AM" — built by hand so the wording matches formatDateTime rather than
// depending on the runtime's es-CR locale data.
const horaAmPm = (timestamp: string): string => {
  const date = parseDateFromTimestamp(timestamp);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
};

export const describirFalloWhatsapp = (n: Notificacion): string => {
  const unico = n.cantidad_fechas === 1;
  const sujeto = unico
    ? "No se pudo enviar el mensaje de 1 reserva"
    : `No se pudieron enviar los mensajes de ${n.cantidad_fechas} reservas`;
  const desde = n.hora_inicio ? horaAmPm(n.hora_inicio) : null;
  const hasta = n.hora_fin ? horaAmPm(n.hora_fin) : null;
  let cuando = "";
  if (desde && hasta) {
    cuando =
      desde === hasta
        ? ` a las ${desde}`
        : ` entre las ${desde} y las ${hasta}`;
  } else if (desde) {
    cuando = ` a las ${desde}`;
  }
  return `${sujeto}${cuando}. Contacte al soporte de Lobster Labs.`;
};
