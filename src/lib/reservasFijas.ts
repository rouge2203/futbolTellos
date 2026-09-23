export const REFEREE_PRICE = 5000;
export type FrequencyWeeks = 1 | 2;

export function costaRicaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function nextFixedDate(day: number, hour: number | null = null, now = new Date()): string {
  const today = costaRicaToday(now);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay() || 7;
  let date = addDays(today, (day - weekday + 7) % 7);
  if (hour !== null && new Date(`${date}T${String(hour).padStart(2, "0")}:00:00-06:00`).getTime() <= now.getTime()) {
    date = addDays(date, 7);
  }
  return date;
}

export function fixedReservationDates(firstDate: string, frequency: FrequencyWeeks): string[] {
  return Array.from({ length: 8 / frequency }, (_, i) => addDays(firstDate, i * frequency * 7));
}

export function schedulesOverlap(
  a: { frecuencia_semanas: number; fecha_inicio: string },
  b: { frecuencia_semanas?: number; fecha_inicio?: string | null },
): boolean {
  if (a.frecuencia_semanas === 1 || (b.frecuencia_semanas ?? 1) === 1 || !b.fecha_inicio) return true;
  const days = Math.round((Date.parse(`${a.fecha_inicio}T12:00:00Z`) - Date.parse(`${b.fecha_inicio}T12:00:00Z`)) / 86400000);
  return days % 14 === 0;
}

export function refereeAdjustedPrice(price: number, previous: boolean, next: boolean): number {
  return Math.max(0, price + (Number(next) - Number(previous)) * REFEREE_PRICE);
}

export function formatFixedDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("es-CR", { timeZone: "America/Costa_Rica", day: "numeric", month: "short", year: "numeric" });
}

export function costaRicaNow(now = new Date()): string {
  return `${costaRicaToday(now)} ${new Intl.DateTimeFormat("en-GB", { timeZone: "America/Costa_Rica", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now)}`;
}
