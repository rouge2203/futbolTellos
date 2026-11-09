import { describe, expect, it } from "vitest";
import { canchaPrice, formatColones, getRetoStatus, reservationFut, retoDeleteDialog, retoStartTime, RETOS_PAGE_SIZE } from "./retos";

const now = Date.parse("2026-09-22T18:00:00-06:00");
describe("reto statuses in Costa Rica time", () => {
  it("moves every past match out of open/closed, including the start-time boundary", () => {
    for (const equipo2_encargado of [null, "Rival"]) {
      expect(getRetoStatus({ hora_inicio: "2026-09-22 17:00:00", equipo2_encargado }, now)).toBe("past");
      expect(getRetoStatus({ hora_inicio: "2026-09-22T18:00:00", equipo2_encargado }, now)).toBe("past");
    }
  });
  it("classifies future matches by assigned opponent", () => {
    expect(getRetoStatus({ hora_inicio: "2026-09-22T19:00:00", equipo2_encargado: null }, now)).toBe("open");
    expect(getRetoStatus({ hora_inicio: "2026-09-22T19:00:00", equipo2_encargado: "  " }, now)).toBe("open");
    expect(getRetoStatus({ hora_inicio: "2026-09-22T19:00:00", equipo2_encargado: "Rival" }, now)).toBe("closed");
  });
  it("accepts local and offset timestamps consistently", () => {
    expect(retoStartTime("2026-09-22 18:00:00")).toBe(now);
    expect(retoStartTime("2026-09-23T00:00:00Z")).toBe(now);
    expect(RETOS_PAGE_SIZE).toBe(25);
  });
});

describe("full cancha pricing", () => {
  const cancha = { id: 6, local: 2, cantidad: "7-8-9", precio: "40.000-50.000" };
  it("uses each FUT tariff and adds referee only when applicable", () => {
    expect([7, 8, 9].map(fut => canchaPrice(cancha, fut, false))).toEqual([40000, 45000, 50000]);
    expect([7, 8, 9].map(fut => canchaPrice(cancha, fut, true))).toEqual([45000, 50000, 55000]);
    expect(canchaPrice({ id: 2, local: 1, precio: "23.000" }, 5, true)).toBe(23000);
  });
  it("preserves saved FUT when the reservation has a custom price", () => {
    expect(reservationFut({ cancha, fut: 9, precio: 42000, arbitro: true })).toBe(9);
    expect(reservationFut({ cancha, precio: 50000, arbitro: true })).toBe(8);
  });
});

describe("colón amounts", () => {
  it("groups thousands with periods, the way Costa Rican prices are written", () => {
    expect(formatColones(23000)).toBe("₡23.000");
    expect(formatColones(1500)).toBe("₡1.500");
    expect(formatColones(0)).toBe("₡0");
    expect(formatColones(1234567)).toBe("₡1.234.567");
  });
});

describe("reto delete dialog copy", () => {
  const sinRival = { equipo1_encargado: "Carlos Jiménez", equipo2_encargado: null };
  const conRival = { equipo1_encargado: "Carlos Jiménez", equipo2_encargado: "Luis Mora" };

  it("warns that the linked reservation's payments are deleted too", () => {
    const d = retoDeleteDialog("full", sinRival, 23000);
    expect(d.title).toBe("¿Eliminar reto y reservación?");
    expect(d.confirmLabel).toBe("Eliminar reto y reservación");
    expect(d.tone).toBe("danger");
    expect(d.description).toContain("₡23.000 en pagos registrados");
  });

  it("omits the payment warning when the reservation has none", () => {
    expect(retoDeleteDialog("full", sinRival, 0).description).not.toContain("pagos registrados");
  });

  it("promises the reservation survives when only the reto is removed", () => {
    const d = retoDeleteDialog("keep", sinRival);
    expect(d.title).toBe("¿Eliminar reto y conservar reservación?");
    expect(d.confirmLabel).toBe("Eliminar solo el reto");
    expect(d.tone).toBe("primary");
    expect(d.description).toContain("Carlos Jiménez");
    expect(d.description).not.toContain("rival asignado");
  });

  it("names the rival whose contact details will be lost", () => {
    const d = retoDeleteDialog("keep", conRival);
    expect(d.tone).toBe("danger");
    expect(d.description).toContain("Luis Mora");
    expect(d.description).toContain("datos de contacto se eliminarán");
  });

  it("treats a blank opponent as no opponent", () => {
    expect(retoDeleteDialog("keep", { ...sinRival, equipo2_encargado: "   " }).tone).toBe("primary");
  });

  it("never warns about payments when the reservation is kept", () => {
    expect(retoDeleteDialog("keep", conRival, 23000).description).not.toContain("pagos registrados");
  });
});
