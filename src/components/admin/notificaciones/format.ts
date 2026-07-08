// Date/format helpers for notificaciones. parseDateFromTimestamp, getLocalName,
// formatDateTime and MONTHS_SPANISH mirror the per-page copies in
// src/pages/admin/Dashboard.tsx so output stays identical app-wide.

export const MONTHS_SPANISH = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const parseDateFromTimestamp = (timestamp: string): Date => {
  // Accepts both the jsonb `to_char` form ("YYYY-MM-DD HH:MM:SS", space) and
  // the PostgREST/Realtime form ("YYYY-MM-DDTHH:MM:SS", T) for naive columns,
  // parsing the components as local Costa Rica time either way.
  const match = timestamp.match(
    /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );
  if (match) {
    return new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3]),
      parseInt(match[4]),
      parseInt(match[5]),
      parseInt(match[6]),
    );
  }
  return new Date(timestamp);
};

export const getLocalName = (local: number): string => {
  if (local === 1) return "Sabana";
  if (local === 2) return "Guadalupe";
  return `Local ${local}`;
};

export const formatDateTime = (timestamp: string): string => {
  const date = parseDateFromTimestamp(timestamp);
  const day = date.getDate();
  const month = MONTHS_SPANISH[date.getMonth()];
  const year = date.getFullYear();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${day} de ${month} de ${year} a las ${hour12}:${minutes} ${ampm}`;
};

export const formatHora = (timestamp: string): string =>
  parseDateFromTimestamp(timestamp).toLocaleTimeString("es-CR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export const formatFechaCorta = (timestamp: string): string =>
  parseDateFromTimestamp(timestamp).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

export const formatFechaLarga = (timestamp: string): string =>
  parseDateFromTimestamp(timestamp).toLocaleDateString("es-CR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const formatRelative = (iso: string): string => {
  const min = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 60000),
  );
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ayer";
  if (d < 7) return `hace ${d} días`;
  return new Date(iso).toLocaleDateString("es-CR", {
    day: "numeric",
    month: "short",
  });
};
