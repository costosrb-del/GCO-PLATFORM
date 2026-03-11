import { OrdenCompra, Tercero, Insumo, ProductoFabricado } from "@/hooks/useCompras";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as XLSX from "xlsx";
import { parseISO } from "date-fns";
// jsPDF importado en el módulo (lazy-chunked vía webpack)
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Helper: carga una imagen como base64 (async, con fallback) ───────────────
async function loadLogoBase64(): Promise<string | null> {
    try {
        const logoPath = typeof window !== "undefined" ? `${window.location.origin}/logo.png` : null;
        if (!logoPath) return null;
        const res = await fetch(logoPath);
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

function addLogoToDoc(doc: jsPDF, logoBase64: string | null) {
    doc.setFillColor(24, 60, 48);
    doc.rect(0, 0, 210, 48, "F");
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, "PNG", 12, 6, 36, 36);
        } catch {
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont("helvetica", "bold");
            doc.text("OB", 18, 28);
        }
    } else {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("OB", 18, 28);
    }
}

export const exportarOrdenPDF = async (orden: OrdenCompra, tercero: Tercero, insumos: Insumo[]) => {
    const doc = new jsPDF();
    const logoBase64 = await loadLogoBase64();

    // ── HEADER ────────────────────────────────────────────────────────────
    addLogoToDoc(doc, logoBase64);

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

export const exportarCatalogoProveedorPDF = async (
    tercero: Tercero,
    insumos: Insumo[]
) => {
    const doc = new jsPDF();
    const logoBase64 = await loadLogoBase64();
    addLogoToDoc(doc, logoBase64);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("CATÁLOGO - PROVEEDOR", 52, 22);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Razón Social: ${tercero.nombre}`, 52, 32);
    doc.text(`NIT: ${tercero.nit ?? "N/A"}`, 52, 38);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Listado de Insumos Suministrados", 14, 60);

    const insumosProveedor = insumos.filter(i => 
        (tercero.insumos || "").toLowerCase().includes(`[${i.sku.toLowerCase()}]`) ||
        tercero.insumosPrecios?.some(ip => ip.insumoId === i.id)
    );

    const tableBody = insumosProveedor.map((ins, idx) => {
        const p = tercero.insumosPrecios?.find(ip => ip.insumoId === ins.id)?.precio;
        return [
            (idx + 1).toString(),
            ins.nombre,
            ins.sku,
            ins.unidad,
            p && p > 0 ? `$${p.toLocaleString("es-CO")}` : "N/A"
        ];
    });

    autoTable(doc, {
        startY: 65,
        head: [["No.", "Insumo", "SKU", "Unidad", "Precio Pactado (COP)"]],
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 10 },
            4: { halign: "right", fontStyle: "bold" }
        }
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(24, 60, 48);
        doc.rect(0, 285, 210, 15, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(`CATÁLOGO - ${tercero.nombre} - ${format(new Date(), "dd/MM/yyyy")}`, 14, 292);
        doc.text(`Página ${i} de ${pageCount}`, 180, 292);
    }

    doc.save(`Catálogo_${tercero.nombre.replace(/ /g, "_")}.pdf`);
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

// ── Generación de PDF como Blob (sin auto-descarga) ──────────────────────────
/**
 * Igual que exportarOrdenPDF pero devuelve un Blob en lugar de descargar.
 * Lo usa descargarZIPPedido para empaquetar todos los PDFs en un ZIP.
 */
export const generarPDFOrdenBlob = async (orden: OrdenCompra, tercero: Tercero, insumos: Insumo[]): Promise<Blob> => {
    const doc = new jsPDF();
    const logoBase64 = await loadLogoBase64();
    addLogoToDoc(doc, logoBase64);
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

    const estadoColors: Record<string, [number, number, number]> = {
        "Aprobada": [16, 185, 129], "Pendiente": [245, 158, 11],
        "Cancelada": [239, 68, 68], "Recibido": [59, 130, 246],
    };
    const estadoColor = estadoColors[orden.estado] || [100, 100, 100];
    doc.setFillColor(...estadoColor);
    doc.roundedRect(52, 33, 40, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(orden.estado.toUpperCase(), 72, 38.5, { align: "center" });

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
    if (orden.aprobadoPor) {
        doc.setTextColor(16, 185, 129);
        doc.setFont("helvetica", "bold");
        doc.text(`✓ Aprobado por: ${orden.aprobadoPor}`, 120, 75);
        doc.setTextColor(30, 30, 30);
        doc.setFont("helvetica", "normal");
    }
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Detalle de la Orden", 14, 100);

    const tableBody = (orden.items && orden.items.length > 0)
        ? orden.items.map((it, idx) => [
            (idx + 1).toString(), it.insumo,
            insumos.find(i => i.id === it.insumoId)?.sku || "N/A",
            it.cantidad.toLocaleString(), it.unidad,
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
            0: { cellWidth: 10 }, 3: { halign: "center" }, 4: { halign: "center" },
            5: { halign: "right" }, 6: { halign: "right", fontStyle: "bold" }
        },
        foot: [[
            { content: "TOTAL BRUTO A PAGAR COP", colSpan: 6, styles: { halign: "right", fontStyle: "bold", fillColor: [24, 60, 48], textColor: [255, 255, 255] } },
            { content: `$${totalEstimado.toLocaleString()}`, styles: { halign: "right", fontStyle: "bold", fillColor: [24, 60, 48], textColor: [255, 255, 255] } }
        ]]
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;
    if (orden.notas) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        const splitNotes = doc.splitTextToSize(`Notas: ${orden.notas}`, 180);
        doc.text(splitNotes, 14, finalY);
        finalY += (splitNotes.length * 5) + 8;
    }

    doc.setFillColor(24, 60, 48);
    doc.rect(120, finalY - 8, 76, 15, "F");
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL: $${totalEstimado.toLocaleString()}`, 125, finalY + 1.5);

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

    return doc.output("blob") as unknown as Blob;
};

// ── Descarga ZIP con todos los PDFs del pedido ────────────────────────────────
export const descargarZIPPedido = async (
    ordenes: OrdenCompra[],
    terceros: Tercero[],
    insumos: Insumo[],
    numeroPedido: string,
    onProgress?: (pct: number) => void
): Promise<void> => {
    // Carga JSZip de forma dinámica (chunk separado, no aumenta bundle inicial)
    const JSZip = (await import("jszip" as any)).default as any;
    const zip = new JSZip();

    const folder = zip.folder(`Pedido_${numeroPedido}`);
    let done = 0;

    for (const orden of ordenes) {
        const tercero = terceros.find(t => t.id === orden.terceroId);
        if (!tercero) { done++; continue; }

        const blob = await generarPDFOrdenBlob(orden, tercero, insumos);
        const safeName = tercero.nombre.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "_");
        folder.file(`OC_${orden.id}_${safeName}.pdf`, blob);

        done++;
        onProgress?.(Math.round((done / ordenes.length) * 100));
    }

    const content = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
    });

    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `MRP_Pedido_${numeroPedido}_${format(new Date(), "yyyyMMdd_HHmm")}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Explota recursivamente un producto fabricado en sus insumos básicos.
 */
interface InsumoExplotado {
    id: string;
    nombre: string;
    sku: string;
    unidad: string;
    cantidadTotal: number;
    ruta?: string;
    precioUnitarioBase?: number;
    costoTotal?: number;
}

function explotarBOM(
    producto: ProductoFabricado,
    productos: ProductoFabricado[],
    insumos: Insumo[],
    terceros: Tercero[] = [],
    cantidadPadre: number = 1,
    rutaPadre: string = "",
    ignorarEmpaque: boolean = false
): InsumoExplotado[] {
    let result: InsumoExplotado[] = [];
    const rutaActual = rutaPadre ? `${rutaPadre} > ${producto.nombre}` : producto.nombre;

    // 1. Insumos directos
    if (producto.insumosAsociados) {
        for (const ia of producto.insumosAsociados) {
            const ins = insumos.find(i => i.id === ia.insumoId);
            if (ins) {
                if (ignorarEmpaque && ins.clasificacion) {
                    const clasif = ins.clasificacion.toUpperCase();
                    if (clasif.includes("CAJA") || clasif.includes("TERMO") || clasif.includes("TERMOENCOGIBLE") || clasif.includes("EMPAQUE")) {
                        continue;
                    }
                }
                
                const factorValue = ia.rendimientoAjustado ? String(ia.rendimientoAjustado) : ins.rendimiento;
                let factor = 1;
                
                if (factorValue) {
                    const s = factorValue.trim();
                    if (s.includes("%")) {
                        const match = s.match(/([0-9.,]+)/);
                        if (match) {
                            const n = parseFloat(match[1].replace(',', '.'));
                            if (!isNaN(n) && n > 0) factor = n / 100;
                        }
                    } else {
                        const match = s.match(/([0-9.,]+)/);
                        if (match) {
                            const n = parseFloat(match[1].replace(',', '.'));
                            if (!isNaN(n) && n > 0) factor = n;
                        }
                    }
                }
                
                let qTotal = 0;
                if (factor > 1) { // Empaque
                     qTotal = cantidadPadre;
                } else {
                     qTotal = (ia.cantidadRequerida * cantidadPadre) / (factor || 1);
                }

                let basePrice = Number(ins.precio) || 0;
                if (basePrice <= 0 && terceros && terceros.length > 0) {
                    let minPrice = Infinity;
                    for (const t of terceros) {
                        const p = t.insumosPrecios?.find(x => x.insumoId === ia.insumoId)?.precio;
                        if (p && p > 0 && p < minPrice) minPrice = p;
                    }
                    if (minPrice < Infinity) basePrice = minPrice;
                }
                const unitPriceAjustado = basePrice / factor;
                const subCosto = unitPriceAjustado * ia.cantidadRequerida * cantidadPadre;

                result.push({
                    id: ins.id,
                    nombre: ins.nombre,
                    sku: ins.sku,
                    unidad: ins.unidad,
                    cantidadTotal: qTotal,
                    ruta: rutaActual,
                    precioUnitarioBase: unitPriceAjustado,
                    costoTotal: subCosto
                });
            }
        }
    }

    // 2. Sub-productos (Kits)
    if (producto.productosAsociados) {
        const esKit = producto.tipo === "Kit";
        for (const pa of producto.productosAsociados) {
            const subProd = productos.find(p => p.id === pa.productoId);
            if (subProd) {
                const tempBOM = explotarBOM(subProd, productos, insumos, terceros, 1, "", esKit || ignorarEmpaque);
                const subCostUnit = tempBOM.reduce((acc, cv) => acc + (cv.costoTotal || 0), 0);
                
                // ADDING A DUMMY INSUMO TO REPRESENT THE SUB-PRODUCT ITSELF IN LIST
                result.push({
                     id: subProd.id,
                     nombre: `[SUB-PRODUCTO] ${subProd.nombre}`,
                     sku: subProd.sku || "N/A",
                     unidad: "Unidad",
                     cantidadTotal: pa.cantidadRequerida * cantidadPadre,
                     ruta: rutaActual,
                     precioUnitarioBase: subCostUnit,
                     costoTotal: subCostUnit * pa.cantidadRequerida * cantidadPadre
                });
                const subExplosion = explotarBOM(subProd, productos, insumos, terceros, pa.cantidadRequerida * cantidadPadre, rutaActual, esKit || ignorarEmpaque);
                result = [...result, ...subExplosion];
            }
        }
    }

    return result;
}

/**
 * Agrupa insumos repetidos sumando sus cantidades
 */
function consolidarInsumos(lista: InsumoExplotado[]): InsumoExplotado[] {
    const map = new Map<string, InsumoExplotado>();
    for (const item of lista) {
        if (map.has(item.id)) {
            const ex = map.get(item.id)!;
            ex.cantidadTotal += item.cantidadTotal;
            ex.costoTotal = (ex.costoTotal || 0) + (item.costoTotal || 0);
        } else {
            map.set(item.id, { ...item });
        }
    }
    return Array.from(map.values());
}

export const exportarBOMPDF = async (
    producto: ProductoFabricado,
    productos: ProductoFabricado[],
    insumos: Insumo[],
    terceros: Tercero[] = []
) => {
    const doc = new jsPDF();
    const logoBase64 = await loadLogoBase64();

    // Header
    addLogoToDoc(doc, logoBase64);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("FICHA TÉCNICA - BOM", 52, 22);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Producto: ${producto.nombre}`, 52, 32);
    doc.text(`SKU: ${producto.sku ?? "N/A"}`, 52, 38);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Detalle de Insumos (Explosión Total)", 14, 60);

    const explosion = explotarBOM(producto, productos, insumos, terceros);
    const consolidado = consolidarInsumos(explosion);
    const productTotalCost = consolidado.reduce((acc, curr) => acc + (curr.costoTotal || 0), 0);

    doc.setFontSize(10);
    doc.setTextColor(20, 100, 50);
    doc.text(`Costo Total Estimado: $${productTotalCost.toLocaleString("es-CO", { minimumFractionDigits: 0 })}`, 14, 66);

    const tableBody = consolidado.map((ins, idx) => [
        (idx + 1).toString(),
        ins.nombre,
        ins.sku,
        ins.cantidadTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
        ins.unidad,
        `$${(ins.precioUnitarioBase||0).toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
        `$${(ins.costoTotal||0).toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
        startY: 72,
        head: [["No.", "Insumo", "SKU", "Cant.", "Unid.", "C. Unitario", "C. Total"]],
        body: tableBody,
        theme: "grid",
        headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 8 },
        columnStyles: {
            0: { cellWidth: 8 },
            3: { halign: "right", fontStyle: "bold" },
            4: { halign: "center" },
            5: { halign: "right" },
            6: { halign: "right", fontStyle: "bold" }
        }
    });

    // Pie de página
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(24, 60, 48);
        doc.rect(0, 285, 210, 15, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(`FICHA TÉCNICA - ${producto.nombre} - ${format(new Date(), "dd/MM/yyyy")}`, 14, 292);
        doc.text(`Página ${i} de ${pageCount}`, 180, 292);
    }

    doc.save(`BOM_${producto.nombre.replace(/ /g, "_")}.pdf`);
};

export const descargarZIPBOMs = async (
    productos: ProductoFabricado[],
    todosProductos: ProductoFabricado[],
    insumos: Insumo[],
    onProgress?: (pct: number) => void
) => {
    const JSZip = (await import("jszip" as any)).default as any;
    const zip = new JSZip();
    const folder = zip.folder("Fichas_Tecnicas_BOM");

    let done = 0;
    for (const p of productos) {
        const doc = new jsPDF();
        const logoBase64 = await loadLogoBase64();
        addLogoToDoc(doc, logoBase64);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16); doc.setFont("helvetica", "bold");
        doc.text("FICHA TÉCNICA - BOM", 52, 22);
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text(`Producto: ${p.nombre}`, 52, 32);
        doc.text(`SKU: ${p.sku ?? "N/A"}`, 52, 38);

        const explosion = explotarBOM(p, todosProductos, insumos);
        const consolidado = consolidarInsumos(explosion);
        const tableBody = consolidado.map((ins, idx) => [
            (idx + 1).toString(), ins.nombre, ins.sku,
            ins.cantidadTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
            ins.unidad
        ]);

        autoTable(doc, {
            startY: 65,
            head: [["No.", "Insumo", "SKU", "Cant. Requerida", "Unidad"]],
            body: tableBody,
            theme: "grid",
            headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255], fontStyle: "bold" },
            styles: { fontSize: 9 },
        });

        const blob = doc.output("blob") as unknown as Blob;
        folder.file(`BOM_${p.sku || p.id}_${p.nombre.replace(/ /g, "_")}.pdf`, blob);

        done++;
        onProgress?.(Math.round((done / productos.length) * 100));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BOMs_Productos_${format(new Date(), "yyyyMMdd")}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportarConsolidadoBOMExcel = (
    seleccionados: ProductoFabricado[],
    productos: ProductoFabricado[],
    insumos: Insumo[],
    terceros: Tercero[]
) => {
    const rows: any[] = [];
    for (const p of seleccionados) {
         const explosion = explotarBOM(p, productos, insumos, terceros);
         const cons = consolidarInsumos(explosion);
         const totalProductCost = cons.reduce((acc, curr) => acc + (curr.costoTotal||0), 0);
         
         for (const ins of cons) {
             rows.push({
                 "SKU Producto": p.sku,
                 "Producto": p.nombre,
                 "SKU Componente": ins.sku,
                 "Componente": ins.nombre,
                 "Unidad": ins.unidad,
                 "Cant. Requerida": ins.cantidadTotal,
                 "Costo Unitario Aprox.": ins.precioUnitarioBase ?? 0,
                 "Costo Total": ins.costoTotal ?? 0
             });
         }
         rows.push({
             "SKU Producto": p.sku,
             "Producto": p.nombre,
             "SKU Componente": "TOTAL",
             "Componente": `TOTAL COSTO ${p.nombre}`,
             "Unidad": "",
             "Cant. Requerida": "",
             "Costo Unitario Aprox.": "",
             "Costo Total": totalProductCost
         });
         rows.push({});
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Fichas_Técnicas_Consolidado");
    XLSX.writeFile(wb, `Consolidado_BOM_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
}

export const exportarConsolidadoBOMPDF = async (
    seleccionados: ProductoFabricado[],
    productos: ProductoFabricado[],
    insumos: Insumo[],
    terceros: Tercero[]
) => {
    const doc = new jsPDF();
    const logoBase64 = await loadLogoBase64();

    for (let i = 0; i < seleccionados.length; i++) {
        if (i > 0) doc.addPage();
        const producto = seleccionados[i];
        
        addLogoToDoc(doc, logoBase64);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("FICHA TÉCNICA - BOM", 52, 22);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Producto: ${producto.nombre}`, 52, 32);
        doc.text(`SKU: ${producto.sku ?? "N/A"}`, 52, 38);

        doc.setTextColor(30, 30, 30);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Detalle de Insumos (Explosión Total)", 14, 60);

        const explosion = explotarBOM(producto, productos, insumos, terceros);
        const consolidado = consolidarInsumos(explosion);
        const productTotalCost = consolidado.reduce((acc, curr) => acc + (curr.costoTotal || 0), 0);

        doc.setFontSize(10);
        doc.setTextColor(20, 100, 50);
        doc.text(`Costo Total Estimado: $${productTotalCost.toLocaleString("es-CO", { minimumFractionDigits: 0 })}`, 14, 66);

        const tableBody = consolidado.map((ins, idx) => [
            (idx + 1).toString(),
            ins.nombre,
            ins.sku,
            ins.cantidadTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }),
            ins.unidad,
            `$${(ins.precioUnitarioBase||0).toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
            `$${(ins.costoTotal||0).toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
        ]);

        autoTable(doc, {
            startY: 72,
            head: [["No.", "Insumo", "SKU", "Cant.", "Unid.", "C. Unitario", "C. Total"]],
            body: tableBody,
            theme: "grid",
            headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255], fontStyle: "bold" },
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 8 },
                3: { halign: "right", fontStyle: "bold" },
                4: { halign: "center" },
                5: { halign: "right" },
                6: { halign: "right", fontStyle: "bold" }
            }
        });
    }

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(24, 60, 48);
        doc.rect(0, 285, 210, 15, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text(`FICHA TÉCNICA CONSOLIDADA - ${format(new Date(), "dd/MM/yyyy")}`, 14, 292);
        doc.text(`Página ${i} de ${pageCount}`, 180, 292);
    }

    doc.save(`Consolidado_BOM_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}
