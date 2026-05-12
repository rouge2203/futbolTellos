import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../../../../lib/supabase";

export interface VentaCierreTienda {
  id: number;
  created_at: string;
  producto_nombre: string;
  ubicacion_nombre: string;
  cantidad: number;
  precio_unitario: number;
  costo_unitario: number;
  metodo_pago: string;
  nota: string | null;
  vendido_por_email: string | null;
}

interface GenerateCierreTiendaParams {
  userId: string;
  userEmail: string;
  ventas: VentaCierreTienda[];
  fechaInicio: string;
  fechaFin: string;
  faltante: number;
  nota: string;
  ubicacionFiltro?: string;
}

interface GenerateCierreTiendaResult {
  success: boolean;
  error?: string;
  pdfUrl?: string;
}

const formatCurrency = (value: number): string =>
  `CRC ${value.toLocaleString("es-CR")}`;

const normalizeMetodoPago = (metodo: string): string => metodo.toLowerCase();

const formatMetodoPago = (metodo: string): string => {
  switch (normalizeMetodoPago(metodo)) {
    case "efectivo":
      return "Efectivo";
    case "sinpe":
      return "SINPE";
    case "transferencia":
      return "Transferencia";
    default:
      return metodo;
  }
};

const getTimestamp = (): string => {
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: "America/Costa_Rica",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
};

const loadLogoDataUrl = async (): Promise<string | null> => {
  try {
    const response = await fetch("/tellos-square.svg");
    const svgText = await response.text();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const blobUrl = URL.createObjectURL(blob);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not load logo image"));
      img.src = blobUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(blobUrl);
      return null;
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(blobUrl);
    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Error loading PDF logo:", error);
    return null;
  }
};

export async function generateCierreTienda(
  params: GenerateCierreTiendaParams,
): Promise<GenerateCierreTiendaResult> {
  const {
    userId,
    userEmail,
    ventas,
    fechaInicio,
    fechaFin,
    faltante,
    nota,
    ubicacionFiltro,
  } = params;

  if (ventas.length === 0) {
    return { success: false, error: "No hay ventas para cerrar." };
  }

  try {
    const totalVentas = ventas.length;
    const totalUnidades = ventas.reduce((sum, v) => sum + v.cantidad, 0);
    const totalIngresos = ventas.reduce(
      (sum, v) => sum + v.precio_unitario * v.cantidad,
      0,
    );
    const totalCosto = ventas.reduce(
      (sum, v) => sum + v.costo_unitario * v.cantidad,
      0,
    );
    const totalGanancia = totalIngresos - totalCosto;
    const faltanteFinal = Math.round(faltante || 0);

    const paymentBreakdown = ventas.reduce(
      (acc, venta) => {
        const total = venta.precio_unitario * venta.cantidad;
        const metodo = normalizeMetodoPago(venta.metodo_pago);
        if (metodo === "efectivo") acc.efectivo += total;
        else if (metodo === "sinpe") acc.sinpe += total;
        else if (metodo === "transferencia") acc.transferencia += total;
        return acc;
      },
      { efectivo: 0, sinpe: 0, transferencia: 0 },
    );

    const ventasPorUbicacion = ventas.reduce(
      (acc, venta) => {
        const current = acc.get(venta.ubicacion_nombre) ?? {
          ventas: 0,
          unidades: 0,
          ingresos: 0,
        };
        current.ventas += 1;
        current.unidades += venta.cantidad;
        current.ingresos += venta.precio_unitario * venta.cantidad;
        acc.set(venta.ubicacion_nombre, current);
        return acc;
      },
      new Map<string, { ventas: number; unidades: number; ingresos: number }>(),
    );

    const doc = new jsPDF();
    let yPos = 20;
    const timestamp = getTimestamp();
    const logoDataUrl = await loadLogoDataUrl();
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", 14, 10, 14, 14);
    }

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Cierre de Tienda - Futbol Tello", 105, yPos, {
      align: "center",
    });
    yPos += 10;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const dateText =
      fechaInicio === fechaFin
        ? `Fecha: ${fechaInicio}`
        : `Periodo: ${fechaInicio} - ${fechaFin}`;
    doc.text(dateText, 105, yPos, { align: "center" });
    yPos += 6;

    if (ubicacionFiltro) {
      doc.setFontSize(10);
      doc.text(`Ubicacion: ${ubicacionFiltro}`, 105, yPos, {
        align: "center",
      });
      yPos += 6;
    }

    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado: ${timestamp}  |  Por: ${userEmail || "Usuario"}`, 105, yPos, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);
    yPos += 12;

    doc.setFillColor(240, 240, 240);
    doc.rect(14, yPos - 5, 182, 48, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN GENERAL", 20, yPos + 2);
    yPos += 8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Registros de venta: ${totalVentas}`, 20, yPos);
    doc.text(`Unidades vendidas: ${totalUnidades}`, 110, yPos);
    yPos += 6;
    doc.text(`Ingresos: ${formatCurrency(totalIngresos)}`, 20, yPos);
    doc.text(`Costo total: ${formatCurrency(totalCosto)}`, 110, yPos);
    yPos += 6;
    doc.text(`Ganancia: ${formatCurrency(totalGanancia)}`, 20, yPos);
    doc.setFont("helvetica", "bold");
    doc.text(`Faltante reportado: ${formatCurrency(faltanteFinal)}`, 110, yPos);
    yPos += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Efectivo: ${formatCurrency(paymentBreakdown.efectivo)}`, 20, yPos);
    doc.text(`SINPE: ${formatCurrency(paymentBreakdown.sinpe)}`, 80, yPos);
    doc.text(
      `Transferencia: ${formatCurrency(paymentBreakdown.transferencia)}`,
      130,
      yPos,
    );
    yPos += 18;

    if (nota.trim()) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      const notaLines = doc.splitTextToSize(`Nota: ${nota.trim()}`, 170);
      doc.text(notaLines, 20, yPos);
      yPos += notaLines.length * 5 + 8;
      doc.setFont("helvetica", "normal");
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("VENTAS DETALLADAS", 20, yPos);
    yPos += 8;

    const tableData = ventas.map((v) => {
      const fecha = new Date(v.created_at);
      const fechaStr = `${fecha.getDate()}/${fecha.getMonth() + 1}/${fecha.getFullYear()}`;
      const totalVenta = v.precio_unitario * v.cantidad;
      const costoTotal = v.costo_unitario * v.cantidad;
      const gananciaVenta = totalVenta - costoTotal;

      return [
        fechaStr,
        v.producto_nombre,
        v.ubicacion_nombre,
        v.cantidad.toString(),
        formatCurrency(v.precio_unitario),
        formatCurrency(totalVenta),
        formatCurrency(costoTotal),
        formatCurrency(gananciaVenta),
        formatMetodoPago(v.metodo_pago),
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [
        [
          "Fecha",
          "Producto",
          "Ubicacion",
          "Cant.",
          "Precio Unit.",
          "Total",
          "Costo",
          "Ganancia",
          "Metodo",
        ],
      ],
      body: tableData,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [60, 60, 60] },
      columnStyles: {
        0: { cellWidth: 18 },
        3: { cellWidth: 12, halign: "center" },
        4: { cellWidth: 20, halign: "right" },
        5: { cellWidth: 20, halign: "right" },
        6: { cellWidth: 20, halign: "right" },
        7: { cellWidth: 20, halign: "right" },
        8: { cellWidth: 22 },
      },
    });

    const ventasTable = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable;
    yPos = (ventasTable?.finalY ?? yPos) + 15;

    if (yPos > 235) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("VENTAS POR UBICACION", 20, yPos);
    yPos += 8;

    autoTable(doc, {
      startY: yPos,
      head: [["Ubicacion", "Ventas", "Unidades", "Ingresos"]],
      body: Array.from(ventasPorUbicacion.entries())
        .sort(([, a], [, b]) => b.ingresos - a.ingresos)
        .map(([ubicacion, stats]) => [
          ubicacion,
          stats.ventas.toString(),
          stats.unidades.toString(),
          formatCurrency(stats.ingresos),
        ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [100, 100, 100] },
      columnStyles: {
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "right" },
      },
    });

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Cierre generado automaticamente - Futbol Tello - ${timestamp}`,
      105,
      285,
      { align: "center" },
    );
    doc.setTextColor(0, 0, 0);

    const pdfBlob = doc.output("blob");
    const fileName = `cierre_tienda_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("tienda")
      .upload(fileName, pdfBlob, { contentType: "application/pdf" });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("tienda")
      .getPublicUrl(fileName);

    const { error: insertError } = await supabase.from("cierres").insert({
      inicio: fechaInicio,
      fin: fechaFin,
      creado_por: userId,
      nota: nota.trim() || null,
      faltantes: faltanteFinal,
      cierre_pdf: urlData.publicUrl,
      tipo: "tienda",
    });

    if (insertError) {
      const uploadedPath = fileName;
      const { error: cleanupError } = await supabase.storage
        .from("tienda")
        .remove([uploadedPath]);
      if (cleanupError) {
        console.error("Error cleaning orphan cierre PDF:", cleanupError);
      }
      throw insertError;
    }

    return { success: true, pdfUrl: urlData.publicUrl };
  } catch (error) {
    console.error("Error generando cierre de tienda:", error);
    return {
      success: false,
      error: "Error al registrar el cierre de tienda. Por favor intente de nuevo.",
    };
  }
}
