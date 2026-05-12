import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "../../../../lib/supabase";

interface VentaReporte {
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

interface ReporteParams {
  ventas: VentaReporte[];
  fechaInicio: string;
  fechaFin: string;
  ubicacionFiltro?: string;
}

const formatCurrency = (value: number): string =>
  `CRC ${value.toLocaleString()}`;

export async function generateReporteVentas(
  params: ReporteParams
): Promise<string> {
  const { ventas, fechaInicio, fechaFin, ubicacionFiltro } = params;

  const totalVentas = ventas.length;
  const totalIngresos = ventas.reduce(
    (sum, v) => sum + v.precio_unitario * v.cantidad,
    0
  );
  const totalCosto = ventas.reduce(
    (sum, v) => sum + v.costo_unitario * v.cantidad,
    0
  );
  const totalGanancia = totalIngresos - totalCosto;

  const doc = new jsPDF();
  let yPos = 20;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Futbol Tello - Reporte de Ventas", 105, yPos, {
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
    doc.text(`Ubicación: ${ubicacionFiltro}`, 105, yPos, { align: "center" });
    yPos += 6;
  }

  const now = new Date();
  const hour = now.getHours();
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  const timestamp = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${hour12}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")} ${ampm}`;
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generado: ${timestamp}`, 105, yPos, { align: "center" });
  doc.setTextColor(0, 0, 0);
  yPos += 12;

  doc.setFillColor(240, 240, 240);
  doc.rect(14, yPos - 5, 182, 30, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RESUMEN", 20, yPos + 2);
  yPos += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Total Ventas: ${totalVentas}`, 20, yPos);
  doc.text(`Ingresos: ${formatCurrency(totalIngresos)}`, 110, yPos);
  yPos += 6;
  doc.text(`Costo Total: ${formatCurrency(totalCosto)}`, 20, yPos);
  doc.setFont("helvetica", "bold");
  doc.text(`Ganancia: ${formatCurrency(totalGanancia)}`, 110, yPos);
  yPos += 15;

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
      v.metodo_pago,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        "Fecha",
        "Producto",
        "Ubicación",
        "Cant.",
        "Precio Unit.",
        "Total",
        "Costo",
        "Ganancia",
        "Método",
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

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } })
    .lastAutoTable;
  yPos = (finalY?.finalY ?? yPos) + 15;

  if (yPos > 270) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Reporte generado automáticamente — Futbol Tello — ${timestamp}`,
    105,
    285,
    { align: "center" }
  );
  doc.setTextColor(0, 0, 0);

  const pdfBlob = doc.output("blob");
  const fileName = `reporte_ventas_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("tienda")
    .upload(fileName, pdfBlob, { contentType: "application/pdf" });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("tienda")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}
