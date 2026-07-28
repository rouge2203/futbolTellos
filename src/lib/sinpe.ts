// Datos de SINPE Móvil por cancha (canchas.sinpe_nombre / canchas.sinpe_numero).
// El número se guarda como 8 dígitos sin guion; el guion es solo presentación.
//
// Estas funciones deciden a quién le llega el dinero de un adelanto, así que
// fallan cerrado: cualquier cosa que no sea un celular tico válido devuelve "".

/** Costa Rican mobile: 8 digits starting with 6, 7 or 8. */
const SINPE_RE = /^[678][0-9]{7}$/;

/**
 * Strip everything but digits — what we persist in canchas.sinpe_numero.
 *
 * Drops a leading 506 country code first. Without that, pasting
 * "+506 8616-7000" would truncate to "50686167": still eight digits, still
 * looks like a phone number, and completely wrong.
 */
export function normalizeSinpe(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length > 8 && digits.startsWith("506")) {
    digits = digits.slice(3);
  }
  return digits.slice(0, 8);
}

/** True when the value is a well-formed Costa Rican mobile number. */
export function isValidSinpe(value: string | null | undefined): boolean {
  return SINPE_RE.test(value ?? "");
}

/** "86167000" -> "8616-7000". Returns "" for anything malformed. */
export function formatSinpe(value: string | null | undefined): string {
  const digits = normalizeSinpe(value ?? "");
  return isValidSinpe(digits) ? `${digits.slice(0, 4)}-${digits.slice(4)}` : "";
}
