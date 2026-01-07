import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../../../lib/supabase";

interface Cancha {
  id: number;
  nombre: string;
  img: string;
  local: number;
}

interface Pago {
  id: number;
  reserva_id: number;
  monto_sinpe: number;
  monto_efectivo: number;
  completo: boolean;
  created_at: string;
  sinpe_pago: string | null;
}

interface Reserva {
  id: number;
  hora_inicio: string;
  hora_fin: string;
  nombre_reserva: string;
  celular_reserva: string;
  correo_reserva: string;
  precio: number;
  arbitro: boolean;
  pago_checkeado: boolean;
  cancha?: Cancha;
  pagos?: Pago[];
  pagoStatus?: "no_registrado" | "incompleto" | "completo";
}

interface GenerateCierreParams {
  userId: string;
  userEmail: string;
  selectedDates: Date[];
  cierreNota: string;
  formatLocalDate: (date: Date) => string;
}

interface GenerateCierreResult {
  success: boolean;
  error?: string;
}

/**
 * Helper function to convert 24h time to 12h AM/PM format
 */
const formatTimeAmPm = (dateTimeStr: string): string => {
  try {
    let timePart = "";
    if (dateTimeStr.includes("T")) {
      timePart = dateTimeStr.split("T")[1];
    } else if (dateTimeStr.includes(" ")) {
      timePart = dateTimeStr.split(" ")[1];
    } else {
      return "";
    }

    const timeOnly = timePart.split("+")[0].split("-")[0].split(".")[0];
    const [hours, minutes] = timeOnly.split(":").map(Number);

    if (isNaN(hours) || isNaN(minutes)) return "";

    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  } catch {
    return "";
  }
};

/**
 * Generates a cierre PDF and uploads it to storage
 */
export async function generateCierre(
  params: GenerateCierreParams
): Promise<GenerateCierreResult> {
  const { userId, userEmail, selectedDates, cierreNota, formatLocalDate } =
    params;

  if (selectedDates.length === 0) {
    return { success: false, error: "No dates selected" };
  }

  try {
    const sortedDates = [...selectedDates].sort(
      (a, b) => a.getTime() - b.getTime()
    );
    const fechaInicio = sortedDates[0];
    const fechaFin = sortedDates[sortedDates.length - 1];

    // Fetch ALL reservas for selected dates (without filters) for the PDF
    let allReservasForPdf: Reserva[] = [];
    for (const date of sortedDates) {
      const dateStr = formatLocalDate(date);
      const startOfDay = `${dateStr} 00:00:00`;
      const endOfDay = `${dateStr} 23:59:59`;

      const { data: reservasData } = await supabase
        .from("reservas")
        .select(
          `
          id, hora_inicio, hora_fin, nombre_reserva, celular_reserva, 
          correo_reserva, precio, arbitro, pago_checkeado,
          cancha:cancha_id (id, nombre, img, local)
        `
        )
        .gte("hora_inicio", startOfDay)
        .lte("hora_inicio", endOfDay)
        .order("hora_inicio", { ascending: true });

      if (reservasData) {
        // Fetch pagos for these reservas
        const reservaIds = reservasData.map((r: any) => r.id);
        const { data: pagosData } = await supabase
          .from("pagos")
          .select("*")
          .in("reserva_id", reservaIds);

        const pagosByReserva: Record<number, Pago[]> = {};
        (pagosData || []).forEach((pago: Pago) => {
          if (!pagosByReserva[pago.reserva_id]) {
            pagosByReserva[pago.reserva_id] = [];
          }
          pagosByReserva[pago.reserva_id].push(pago);
        });

        const processedReservas = reservasData.map((r: any) => {
          const pagos = pagosByReserva[r.id] || [];
          let pagoStatus: "no_registrado" | "incompleto" | "completo" =
            "no_registrado";
          if (pagos.length > 0) {
            const hasCompleto = pagos.some((p: Pago) => p.completo === true);
            pagoStatus = hasCompleto ? "completo" : "incompleto";
          }
          return {
            ...r,
            cancha: Array.isArray(r.cancha) ? r.cancha[0] : r.cancha,
            pagos,
            pagoStatus,
            pago_checkeado: r.pago_checkeado || false,
          };
        });

        allReservasForPdf = [...allReservasForPdf, ...processedReservas];
      }
    }

    // Calculate overall totals
    let overallTotalReservas = 0;
    let overallTotalPagos = 0;
    let overallTotalSinpe = 0;
    let overallTotalEfectivo = 0;

    allReservasForPdf.forEach((r) => {
      overallTotalReservas += r.precio;
      (r.pagos || []).forEach((p) => {
        overallTotalPagos += p.monto_sinpe + p.monto_efectivo;
        overallTotalSinpe += p.monto_sinpe;
        overallTotalEfectivo += p.monto_efectivo;
      });
    });

    const overallFaltante = overallTotalReservas - overallTotalPagos;

    // Generate PDF
    const doc = new jsPDF();
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Cierre de Pagos - Futbol Tello", 105, yPos, {
      align: "center",
    });
    yPos += 10;

    // Date range
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const dateRangeText =
      fechaInicio.getTime() === fechaFin.getTime()
        ? `Fecha: ${fechaInicio.getDate()}/${
            fechaInicio.getMonth() + 1
          }/${fechaInicio.getFullYear()}`
        : `Periodo: ${fechaInicio.getDate()}/${
            fechaInicio.getMonth() + 1
          }/${fechaInicio.getFullYear()} - ${fechaFin.getDate()}/${
            fechaFin.getMonth() + 1
          }/${fechaFin.getFullYear()}`;
    doc.text(dateRangeText, 105, yPos, { align: "center" });
    yPos += 8;

    // Created info
    const createdAt = new Date();
    const createdHour = createdAt.getHours();
    const createdAmPm = createdHour >= 12 ? "PM" : "AM";
    const createdHour12 = createdHour % 12 || 12;
    const createdAtText = `Generado: ${createdAt.getDate()}/${
      createdAt.getMonth() + 1
    }/${createdAt.getFullYear()} ${createdHour12}:${createdAt
      .getMinutes()
      .toString()
      .padStart(2, "0")} ${createdAmPm}`;
    const createdByText = `Por: ${userEmail || "Usuario"}`;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`${createdAtText}  |  ${createdByText}`, 105, yPos, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);
    yPos += 12;

    // Overall Totals Box
    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos - 5, 182, 35, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN GENERAL", 20, yPos + 2);
    yPos += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(
      `Total Reservaciones: CRC ${overallTotalReservas.toLocaleString()}`,
      20,
      yPos
    );
    doc.text(
      `Total Pagos: CRC ${overallTotalPagos.toLocaleString()}`,
      110,
      yPos
    );
    yPos += 6;
    doc.text(`SINPE: CRC ${overallTotalSinpe.toLocaleString()}`, 20, yPos);
    doc.text(
      `Efectivo: CRC ${overallTotalEfectivo.toLocaleString()}`,
      110,
      yPos
    );
    yPos += 6;
    doc.setFont("helvetica", "bold");
    doc.text(`FALTANTE: CRC ${overallFaltante.toLocaleString()}`, 20, yPos);
    yPos += 15;

    // Nota if any
    if (cierreNota.trim()) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(`Nota: ${cierreNota}`, 20, yPos);
      yPos += 10;
    }

    // Group by date and cancha
    const reservasByDate: Record<string, Reserva[]> = {};
    allReservasForPdf.forEach((r) => {
      const dateKey = r.hora_inicio.includes("T")
        ? r.hora_inicio.split("T")[0]
        : r.hora_inicio.split(" ")[0];
      if (!reservasByDate[dateKey]) {
        reservasByDate[dateKey] = [];
      }
      reservasByDate[dateKey].push(r);
    });

    // Filter to show only problematic reservas
    const problemReservas = allReservasForPdf.filter(
      (r) =>
        r.pagoStatus === "no_registrado" ||
        r.pagoStatus === "incompleto" ||
        !r.pago_checkeado
    );

    if (problemReservas.length > 0) {
      yPos += 10; // Add margin before section
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("RESERVAS CON PENDIENTES", 20, yPos);
      yPos += 8;

      // Group problem reservas by date
      const problemByDate: Record<string, Reserva[]> = {};
      problemReservas.forEach((r) => {
        const dateKey = r.hora_inicio.includes("T")
          ? r.hora_inicio.split("T")[0]
          : r.hora_inicio.split(" ")[0];
        if (!problemByDate[dateKey]) {
          problemByDate[dateKey] = [];
        }
        problemByDate[dateKey].push(r);
      });

      for (const dateKey of Object.keys(problemByDate).sort()) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        const dateReservas = problemByDate[dateKey];
        const dateParts = dateKey.split("-");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`, 20, yPos);
        yPos += 6;

        // Group by cancha
        const byCancha: Record<string, Reserva[]> = {};
        dateReservas.forEach((r) => {
          const canchaKey = r.cancha?.nombre || "Sin cancha";
          if (!byCancha[canchaKey]) {
            byCancha[canchaKey] = [];
          }
          byCancha[canchaKey].push(r);
        });

        for (const canchaName of Object.keys(byCancha)) {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }

          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(`  ${canchaName}`, 20, yPos);
          yPos += 5;

          const tableData = byCancha[canchaName].map((r) => {
            const hora = formatTimeAmPm(r.hora_inicio);
            const totalPagado = (r.pagos || []).reduce(
              (sum, p) => sum + p.monto_sinpe + p.monto_efectivo,
              0
            );
            let status = "";
            if (r.pagoStatus === "no_registrado") status = "Sin pago";
            else if (r.pagoStatus === "incompleto") status = "Incompleto";
            else status = "Completo";
            if (!r.pago_checkeado) status += " (No checkeado)";

            return [
              hora,
              r.nombre_reserva,
              `CRC ${r.precio.toLocaleString()}`,
              `CRC ${totalPagado.toLocaleString()}`,
              status,
            ];
          });

          autoTable(doc, {
            startY: yPos,
            head: [["Hora", "Cliente", "Precio", "Pagado", "Estado"]],
            body: tableData,
            margin: { left: 25 },
            styles: { fontSize: 8 },
            headStyles: { fillColor: [100, 100, 100] },
          });

          yPos = (doc as any).lastAutoTable.finalY + 8;
        }
      }
    }

    // Per-day detailed totals
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("TOTALES POR DIA", 20, yPos);
    yPos += 10;

    for (const dateKey of Object.keys(reservasByDate).sort()) {
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }

      const dayReservas = reservasByDate[dateKey];
      let dayExpected = 0;
      let daySinpe = 0;
      let dayEfectivo = 0;

      // Calculate totals for the day
      dayReservas.forEach((r) => {
        dayExpected += r.precio;
        (r.pagos || []).forEach((p) => {
          daySinpe += p.monto_sinpe;
          dayEfectivo += p.monto_efectivo;
        });
      });

      const dayTotalPagos = daySinpe + dayEfectivo;
      const dayFaltante = dayExpected - dayTotalPagos;

      // Group by cancha for this day
      const canchaStats: Record<
        string,
        { count: number; expected: number; pagado: number }
      > = {};
      dayReservas.forEach((r) => {
        const canchaName = r.cancha?.nombre || "Sin cancha";
        if (!canchaStats[canchaName]) {
          canchaStats[canchaName] = { count: 0, expected: 0, pagado: 0 };
        }
        canchaStats[canchaName].count += 1;
        canchaStats[canchaName].expected += r.precio;
        (r.pagos || []).forEach((p) => {
          canchaStats[canchaName].pagado += p.monto_sinpe + p.monto_efectivo;
        });
      });

      // Date header
      const dateParts = dateKey.split("-");
      const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;

      doc.setFillColor(60, 60, 60);
      doc.rect(14, yPos - 4, 182, 8, "F");
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(formattedDate, 20, yPos + 1);
      doc.text(`${dayReservas.length} reservas`, 100, yPos + 1);
      doc.setTextColor(0, 0, 0);
      yPos += 10;

      // Day summary
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Esperado: CRC ${dayExpected.toLocaleString()}`, 20, yPos);
      doc.text(`SINPE: CRC ${daySinpe.toLocaleString()}`, 80, yPos);
      doc.text(`Efectivo: CRC ${dayEfectivo.toLocaleString()}`, 130, yPos);
      yPos += 5;
      doc.text(`Total Pagos: CRC ${dayTotalPagos.toLocaleString()}`, 20, yPos);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Faltante: CRC ${dayFaltante.toLocaleString()}`,
        80,
        yPos
      );
      doc.setFont("helvetica", "normal");
      yPos += 8;

      // Per-cancha breakdown table
      const canchaData = Object.keys(canchaStats)
        .sort()
        .map((canchaName) => {
          const stats = canchaStats[canchaName];
          return [
            canchaName,
            stats.count.toString(),
            `CRC ${stats.expected.toLocaleString()}`,
            `CRC ${stats.pagado.toLocaleString()}`,
          ];
        });

      autoTable(doc, {
        startY: yPos,
        head: [["Cancha", "Reservas", "Esperado", "Pagado"]],
        body: canchaData,
        margin: { left: 20 },
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 100, 100] },
        tableWidth: 170,
      });

      yPos = (doc as any).lastAutoTable.finalY + 12;
    }

    // Generate blob and upload
    const pdfBlob = doc.output("blob");
    const fileName = `cierre_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("cierres")
      .upload(fileName, pdfBlob, { contentType: "application/pdf" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("cierres")
      .getPublicUrl(fileName);

    // Insert cierre record
    const { error: insertError } = await supabase.from("cierres").insert({
      inicio: formatLocalDate(fechaInicio),
      fin: formatLocalDate(fechaFin),
      creado_por: userId,
      nota: cierreNota.trim() || null,
      cierre_pdf: urlData.publicUrl,
      faltantes: overallFaltante,
    });

    if (insertError) throw insertError;

    return { success: true };
  } catch (error) {
    console.error("Error generando cierre:", error);
    return {
      success: false,
      error: "Error al registrar el cierre. Por favor intente de nuevo.",
    };
  }
}

