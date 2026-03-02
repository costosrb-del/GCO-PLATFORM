import { OrdenCompra, Tercero, Insumo } from "@/hooks/useCompras";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";

// ── PDF Export (existente) ─────────────────────────────────────────────────────
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { parseISO } from "date-fns";

export const exportarOrdenPDF = (orden: OrdenCompra, tercero: Tercero, insumos: Insumo[]) => {
    const doc = new jsPDF();

    // ── HEADER ────────────────────────────────────────────────────────────
    doc.setFillColor(24, 60, 48);
    doc.rect(0, 0, 210, 48, "F");

    try {
        const logoPath = typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "/logo.png";
        doc.addImage(logoPath, "PNG", 12, 6, 36, 36);
    } catch {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("OB", 18, 28);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("AUTORIZACIÓN DE COMPRA", 52, 20);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("ORIGEN BOTÁNICO", 52, 30);

    doc.setDrawColor(200, 220, 210);
    doc.setLineWidth(0.3);
    doc.line(148, 8, 148, 40);

    doc.setFontSize(7.5);
    doc.text(`Fecha emisión: ${format(new Date(orden.created_at || new Date()), "dd/MM/yyyy HH:mm")}`, 197, 14, { align: "right" });
    doc.setFontSize(8);
    doc.text(`Pedido No: ${orden.numeroPedido || "N/A"}`, 197, 21, { align: "right" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`O.C. ID: ${orden.id.toUpperCase()}`, 197, 33, { align: "right" });
    doc.setFont("helvetica", "normal");

    // Estado badge
    const estadoColors: Record<string, [number, number, number]> = {
        "Aprobada": [16, 185, 129],
        "Pendiente": [245, 158, 11],
        "Cancelada": [239, 68, 68],
        "Recibido": [59, 130, 246],
    };
    const estadoColor = estadoColors[orden.estado] || [100, 100, 100];
    doc.setFillColor(...estadoColor);
    doc.roundedRect(52, 33, 40, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(orden.estado.toUpperCase(), 72, 38.5, { align: "center" });

    // Proveedor Info
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Datos del Proveedor", 14, 55);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Razón Social: ${tercero.nombre}`, 14, 63);
    doc.text(`NIT / Documento: ${tercero.nit}`, 14, 69);
    doc.text(`Contacto: ${tercero.personaContacto} - ${tercero.numeroContacto}`, 14, 75);
    doc.text(`Correo: ${tercero.correo}`, 14, 81);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Detalles de Entrega", 120, 55);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const fSolicitada = orden.fechaSolicitada ? format(parseISO(orden.fechaSolicitada), "dd/MM/yyyy") : "POR DEFINIR";
    doc.text(`Fecha Solicitada: ${fSolicitada}`, 120, 63);
    doc.text(`Tiempo Estimado: ${orden.tiempoEntrega || "N/A"}`, 120, 69);
    doc.text(`Entregas Parciales: ${orden.entregasParciales || "N/A"}`, 120, 75);

    if (orden.aprobadoPor) {
        doc.setTextColor(16, 185, 129);
        doc.setFont("helvetica", "bold");
        doc.text(`✓ Aprobado por: ${orden.aprobadoPor}`, 120, 81);
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "normal");
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Detalle de la Orden", 14, 100);

    const tableBody = (orden.items && orden.items.length > 0)
        ? orden.items.map((it, idx) => [
            (idx + 1).toString(),
            it.insumo,
            insumos.find(i => i.id === it.insumoId)?.sku || "N/A",
            it.cantidad.toLocaleString(),
            it.unidad,
            `$${(it.precio_estimado || 0).toLocaleString()}`,
            `$${((it.cantidad || 0) * (it.precio_estimado || 0)).toLocaleString()}`
        ])
        : [["1", (orden.insumo || "").replace(/ \+\d+ más$/, ""),
            insumos.find(i => i.id === orden.insumoId)?.sku || "N/A",
            (orden.cantidad || 0).toLocaleString(), orden.unidad,
            `$${(orden.precio_estimado || 0).toLocaleString()}`,
            `$${((orden.cantidad || 0) * (orden.precio_estimado || 0)).toLocaleString()}`]];

    const totalEstimado = (orden.items && orden.items.length > 0)
        ? orden.items.reduce((sum, it) => sum + (it.cantidad * (it.precio_estimado || 0)), 0)
        : ((orden.cantidad || 0) * (orden.precio_estimado || 0));

    autoTable(doc, {
        startY: 105,
        head: [["Item", "Descripción / Producto", "SKU Ref", "Cantidad", "Unidad", "Vr. Unitario", "Vr. Total"]],
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 10 },
            3: { halign: "center" },
            4: { halign: "center" },
            5: { halign: "right" },
            6: { halign: "right", fontStyle: "bold" }
        },
        foot: [[
            { content: "TOTAL BRUTO A PAGAR COP", colSpan: 6, styles: { halign: "right", fontStyle: "bold", fillColor: [24, 60, 48], textColor: [255, 255, 255] } },
            { content: `$${totalEstimado.toLocaleString()}`, styles: { halign: "right", fontStyle: "bold", fillColor: [24, 60, 48], textColor: [255, 255, 255] } }
        ]]
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;

    if (orden.numeroPedido || orden.fechaSolicitada || orden.entregasParciales || orden.notas) {
        doc.setFontSize(14);
        doc.setTextColor(30, 30, 30);
        doc.text("Información Adicional", 14, finalY);
        finalY += 8;
        doc.setFontSize(10);
        if (orden.numeroPedido) { doc.text(`Número de Pedido Interno: ${orden.numeroPedido}`, 14, finalY); finalY += 6; }
        if (orden.fechaSolicitada) { doc.text(`Fecha Solicitada: ${format(parseISO(orden.fechaSolicitada), "dd/MM/yyyy")}`, 14, finalY); finalY += 6; }
        if (orden.entregasParciales) { doc.text(`Fases de Entregas Parciales: ${orden.entregasParciales}`, 14, finalY); finalY += 6; }
        if (orden.notas) {
            doc.setFont("helvetica", "italic");
            const splitNotes = doc.splitTextToSize(`Notas: ${orden.notas}`, 180);
            doc.text(splitNotes, 14, finalY);
            finalY += (splitNotes.length * 5) + 2;
            doc.setFont("helvetica", "normal");
        }
        finalY += 10;
    }

    doc.setFillColor(24, 60, 48);
    doc.rect(120, finalY - 8, 76, 15, "F");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL FINAL: $${totalEstimado.toLocaleString()}`, 125, finalY + 1.5);
    doc.setFont("helvetica", "normal");
    finalY += 25;

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);
    doc.text("_________________________", 14, finalY);
    doc.setFont("helvetica", "bold");
    doc.text("SOLICITADO POR", 14, finalY + 5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Dpto. de Compras y Logística", 14, finalY + 9);
    doc.setFontSize(10);
    doc.text("_________________________", 120, finalY);
    doc.setFont("helvetica", "bold");
    doc.text("APROBADO POR", 120, finalY + 5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(orden.aprobadoPor || "Gerencia Administrativa / Técnica", 120, finalY + 9);

    if (orden.historialEntregas && orden.historialEntregas.length > 0) {
        finalY += 20;
        if (finalY > 240) { doc.addPage(); finalY = 20; }
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(24, 60, 48);
        doc.text("Historial de Entregas Parciales", 14, finalY);
        finalY += 6;
        doc.line(14, finalY, 196, finalY);
        finalY += 4;
        const historialBody = orden.historialEntregas.map((delivery, idx) => [
            `#${idx + 1}`,
            format(new Date(delivery.fecha), "dd/MM/yy HH:mm"),
            delivery.recibidoPor,
            delivery.items.map((it: any) => `${it.insumo}: ${it.cantidad}`).join(" | "),
            delivery.notas || "-"
        ]);
        autoTable(doc, {
            startY: finalY,
            head: [["No.", "Fecha", "Recibió", "Ítems Entregados", "Notas"]],
            body: historialBody,
            theme: "striped",
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 3 },
            columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 22 }, 2: { cellWidth: 32 }, 4: { fontStyle: "italic" } }
        });
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(24, 60, 48);
        doc.rect(0, 285, 210, 15, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text("ORIGEN BOTÁNICO - ZN E CENTRO LOGISTICO BG 16 Rionegro, Antioquia", 14, 292);
        doc.text(`Página ${i} de ${pageCount}`, 180, 292);
    }

    doc.save(`Orden_Compra_${tercero.nombre.replace(/ /g, "_")}_${format(new Date(), "ddMMyyyy")}.pdf`);
};


// ── Excel Export (NUEVA) ────────────────────────────────────────────────────────

/**
 * Exporta la lista filtrada de órdenes de compra a un archivo Excel (.xlsx)
 */
export const exportarOrdenesExcel = (ordenes: OrdenCompra[], terceros: Tercero[]) => {
    const rows = ordenes.map(o => {
        const t = terceros.find(t => t.id === o.terceroId);
        const total = o.total_bruto || ((o.cantidad || 0) * (o.precio_estimado || 0));
        return {
            "ID Orden": o.id,
            "No. Pedido": o.numeroPedido || "",
            "Proveedor": t?.nombre || "Desconocido",
            "NIT Proveedor": t?.nit || "",
            "Insumo(s)": o.insumo || "",
            "Cantidad Total": o.items ? o.items.reduce((s, i) => s + i.cantidad, 0) : (o.cantidad || 0),
            "Precio Unitario": o.precio_estimado || 0,
            "Total Bruto (COP)": total,
            "Estado": o.estado,
            "Fecha Solicitada": o.fechaSolicitada || "",
            "Tiempo Entrega": o.tiempoEntrega || "",
            "Aprobado Por": o.aprobadoPor || "",
            "Fecha Aprobación": o.fechaAprobacion ? format(new Date(o.fechaAprobacion), "dd/MM/yyyy HH:mm") : "",
            "Notas": o.notas || "",
            "Fecha Creación": o.created_at ? format(new Date(o.created_at), "dd/MM/yyyy HH:mm", { locale: es }) : "",
        };
    });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Estilo de encabezados (ancho automático)
    const colWidths = Object.keys(rows[0] || {}).map(key => ({ wch: Math.max(key.length, 20) }));
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Órdenes de Compra");

    // Hoja de resumen
    const resumenData = [
        ["RESUMEN DE ÓRDENES DE COMPRA", ""],
        ["Generado el:", format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })],
        [""],
        ["Total Órdenes", ordenes.length],
        ["Pendientes", ordenes.filter(o => o.estado === "Pendiente").length],
        ["Aprobadas", ordenes.filter(o => o.estado === "Aprobada").length],
        ["Recibidas", ordenes.filter(o => o.estado === "Recibido").length],
        ["Parciales", ordenes.filter(o => o.estado === "Parcial").length],
        ["Canceladas", ordenes.filter(o => o.estado === "Cancelada").length],
        [""],
        ["Inversión Total (COP)", ordenes.reduce((s, o) => s + (o.total_bruto || ((o.cantidad || 0) * (o.precio_estimado || 0))), 0)],
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

    XLSX.writeFile(wb, `Ordenes_Compra_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
};
