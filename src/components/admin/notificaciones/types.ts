// Row shape of public.notificaciones (see supabase_notificaciones_migration.sql).
// Snapshot fields are nullable: they come from LEFT JOINs in the trigger and the
// source reserva columns are themselves nullable.
//
// Parsing rule: hora_inicio / hora_fin / fechas_canceladas[*] are NAIVE local
// Costa Rica timestamps. Depending on the delivery path they arrive space- or
// T-separated ("YYYY-MM-DD HH:MM:SS" from the jsonb to_char, "YYYY-MM-DDTHH:MM:SS"
// from PostgREST/Realtime) — parseDateFromTimestamp handles both. created_at /
// atendida_at are timestamptz ISO strings -> new Date().

export interface FechaCancelada {
  hora_inicio: string;
  hora_fin: string | null;
  cancha_id: number | null;
  cancha_nombre: string | null;
}

export interface Notificacion {
  id: string;
  created_at: string;
  tipo: string;
  nombre_reserva: string | null;
  celular_reserva: string | null;
  correo_reserva: string | null;
  cancha_id: number | null;
  cancha_nombre: string | null;
  cancha_local: number | null;
  precio: number | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  reservacion_fija_id: number | null;
  fija_nombre: string | null;
  fija_dia: number | null;
  fija_hora_inicio: string | null;
  fija_hora_fin: string | null;
  fechas_canceladas: FechaCancelada[];
  cantidad_fechas: number;
  atendida: boolean;
  atendida_por: string | null;
  atendida_at: string | null;
}

export const esAgrupada = (n: Notificacion): boolean => n.cantidad_fechas > 1;

export interface UseNotificacionesResult {
  notificaciones: Notificacion[];
  pendingCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMoreOlderPending: boolean;
  error: string | null;
  markingIds: ReadonlySet<string>;
  recienLlegadas: ReadonlySet<string>;
  showOlderPending: () => Promise<void>;
  markAtendida: (id: string) => Promise<void>;
}
