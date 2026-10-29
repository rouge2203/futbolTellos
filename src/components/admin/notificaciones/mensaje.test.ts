import { describe, expect, test } from "vitest";
import { describirFalloWhatsapp, esWhatsappFallido } from "./mensaje";
import type { Notificacion } from "./types";

const base: Notificacion = {
  id: "n1",
  created_at: "2026-10-29T15:20:00+00:00",
  tipo: "whatsapp_fallido",
  nombre_reserva: null,
  celular_reserva: null,
  correo_reserva: null,
  cancha_id: null,
  cancha_nombre: null,
  cancha_local: null,
  precio: null,
  hora_inicio: "2026-10-29 09:00:00",
  hora_fin: "2026-10-29 09:20:00",
  reservacion_fija_id: null,
  fija_nombre: null,
  fija_dia: null,
  fija_hora_inicio: null,
  fija_hora_fin: null,
  fechas_canceladas: [],
  cantidad_fechas: 11,
  atendida: false,
  atendida_por: null,
  atendida_at: null,
};

describe("esWhatsappFallido", () => {
  test("separates the WhatsApp report from the árbitro notification", () => {
    expect(esWhatsappFallido(base)).toBe(true);
    expect(esWhatsappFallido({ ...base, tipo: "cancelacion_arbitro" })).toBe(
      false,
    );
  });
});

describe("describirFalloWhatsapp", () => {
  test("reports how many reservas failed and over what window", () => {
    expect(describirFalloWhatsapp(base)).toBe(
      "No se pudieron enviar los mensajes de 11 reservas entre las 9:00 AM y las 9:20 AM. Contacte al soporte de Lobster Labs.",
    );
  });

  test("uses singular wording and a single hour for one reserva", () => {
    expect(
      describirFalloWhatsapp({
        ...base,
        cantidad_fechas: 1,
        hora_fin: "2026-10-29 09:00:00",
      }),
    ).toBe(
      "No se pudo enviar el mensaje de 1 reserva a las 9:00 AM. Contacte al soporte de Lobster Labs.",
    );
  });

  test("still reads sensibly when the window was not recorded", () => {
    expect(
      describirFalloWhatsapp({ ...base, hora_inicio: null, hora_fin: null }),
    ).toBe(
      "No se pudieron enviar los mensajes de 11 reservas. Contacte al soporte de Lobster Labs.",
    );
  });
});
