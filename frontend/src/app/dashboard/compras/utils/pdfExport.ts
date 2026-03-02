import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { OrdenCompra, Tercero, Insumo } from "@/hooks/useCompras";

export const exportarOrdenPDF = (orden: OrdenCompra, tercero: Tercero, insumos: Insumo[]) => {
    const doc = new jsPDF();

    // ── HEADER ────────────────────────────────────────────────────────────
    // Fondo verde
    doc.setFillColor(24, 60, 48);
    doc.rect(0, 0, 210, 48, "F");

    // ── ZONA IZQUIERDA: Logo + empresa (x: 12 → 140) ─────────────────────
    // Logo directo sobre fondo verde (sin caja blanca)
    try {
        const logoPath = typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : "/logo.png";
        doc.addImage(logoPath, "PNG", 12, 6, 36, 36);
    } catch (e) {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("OB", 18, 28);
    }

    // Título del documento y empresa
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("AUTORIZACIÓN DE COMPRA", 52, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("ORIGEN BOTÁNICO", 52, 30);

    // ── SEPARADOR VERTICAL ───────────────────────────────────────────────
    doc.setDrawColor(200, 220, 210);
    doc.setLineWidth(0.3);
    doc.line(148, 8, 148, 40);

    // ── ZONA DERECHA: Metadatos OC (x: 125 → 198, right-align a 197) ─────
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha emisión: ${format(new Date(orden.created_at || new Date()), "dd/MM/yyyy HH:mm")}`, 197, 14, { align: "right" });

    doc.setFontSize(8);
    doc.text(`Pedido No: ${orden.numeroPedido || 'N/A'}`, 197, 21, { align: "right" });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`O.C. ID: ${orden.id.toUpperCase()}`, 197, 33, { align: "right" });

    doc.setFont("helvetica", "normal");

    // Proveedor Info
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.text("Datos del Proveedor", 14, 55);
    doc.setFontSize(10);
    doc.text(`Razón Social: ${tercero.nombre}`, 14, 63);
    doc.text(`NIT / Documento: ${tercero.nit}`, 14, 69);
    doc.text(`Contacto: ${tercero.personaContacto} - ${tercero.numeroContacto}`, 14, 75);
    doc.text(`Correo: ${tercero.correo}`, 14, 81);

    // Columna derecha: Logística
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Detalles de Entrega", 120, 55);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const fSolicitada = orden.fechaSolicitada ? format(parseISO(orden.fechaSolicitada), "dd/MM/yyyy") : "POR DEFINIR";
    doc.text(`Fecha Solicitada: ${fSolicitada}`, 120, 63);
    doc.text(`Tiempo Estimado: ${orden.tiempoEntrega || 'N/A'}`, 120, 69);
    doc.text(`Entregas Parciales: ${orden.entregasParciales || 'N/A'}`, 120, 75);

    // Orden de compra Detalle
    doc.setFontSize(14);
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
        : [[
            "1",
            orden.insumo.replace(/ \+\d+ más$/, ""),
            insumos.find(i => i.id === orden.insumoId)?.sku || "N/A",
            orden.cantidad.toLocaleString(),
            orden.unidad,
            `$${(orden.precio_estimado || 0).toLocaleString()}`,
            `$${(orden.cantidad * (orden.precio_estimado || 0)).toLocaleString()}`
        ]];

    const totalEstimado = (orden.items && orden.items.length > 0)
        ? orden.items.reduce((sum, it) => sum + (it.cantidad * (it.precio_estimado || 0)), 0)
        : (orden.cantidad * (orden.precio_estimado || 0));

    autoTable(doc, {
        startY: 105,
        head: [["Item", "Descripción / Producto", "SKU Ref", "Cantidad", "Unidad", "Vr. Unitario", "Vr. Total"]],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [24, 60, 48], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9 },
        columnStyles: {
            0: { cellWidth: 10 },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'right' },
            6: { halign: 'right', fontStyle: 'bold' }
        },
        foot: [[
            { content: 'TOTAL BRUTO A PAGAR COP', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [24, 60, 48], textColor: [255, 255, 255] } },
            { content: `$${totalEstimado.toLocaleString()}`, styles: { halign: 'right', fontStyle: 'bold', fillColor: [24, 60, 48], textColor: [255, 255, 255] } }
        ]]
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;

    // Información Adicional del Pedido
    if (orden.numeroPedido || orden.fechaSolicitada || orden.entregasParciales || orden.notas) {
        doc.setFontSize(14);
        doc.setTextColor(30, 30, 30);
        doc.text("Información Adicional", 14, finalY);
        finalY += 8;
        doc.setFontSize(10);
        if (orden.numeroPedido) {
            doc.text(`Número de Pedido Interno: ${orden.numeroPedido}`, 14, finalY);
            finalY += 6;
        }
        if (orden.fechaSolicitada) {
            doc.text(`Fecha Solicitada para entrega: ${format(parseISO(orden.fechaSolicitada), "dd/MM/yyyy")}`, 14, finalY);
            finalY += 6;
        }
        if (orden.entregasParciales) {
            doc.text(`Fases de Entregas Parciales: ${orden.entregasParciales}`, 14, finalY);
            finalY += 6;
        }
        if (orden.notas) {
            doc.setFont("helvetica", "italic");
            const splitNotes = doc.splitTextToSize(`Notas Adicionales: ${orden.notas}`, 180);
            doc.text(splitNotes, 14, finalY);
            finalY += (splitNotes.length * 5) + 2;
            doc.setFont("helvetica", "normal");
        }
        finalY += 10;
    }

    // Totales Estimados (Recuadro Verde)
    doc.setFillColor(24, 60, 48);
    doc.rect(120, finalY - 8, 76, 15, 'F');
    doc.setFontSize(14);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL FINAL: $${totalEstimado.toLocaleString()}`, 125, finalY + 1.5);
    doc.setFont("helvetica", "normal");

    finalY += 25;

    // (Términos y Condiciones temporalmente omitidos)

    // Firmas y notas
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);

    // Columna Izquierda: Solicitante
    doc.text("_________________________", 14, finalY);
    doc.setFont("helvetica", "bold");
    doc.text("SOLICITADO POR", 14, finalY + 5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Dpto. de Compras y Logística", 14, finalY + 9);

    // Columna Derecha: Autorización
    doc.setFontSize(10);
    doc.text("_________________________", 120, finalY);
    doc.setFont("helvetica", "bold");
    doc.text("APROBADO POR", 120, finalY + 5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Gerencia Administrativa / Técnica", 120, finalY + 9);

    // --- Historial de Entregas (si hay parciales) ---
    if (orden.historialEntregas && orden.historialEntregas.length > 0) {
        finalY += 20;
        // Check if we need a new page
        if (finalY > 240) { doc.addPage(); finalY = 20; }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(24, 60, 48);
        doc.text("Historial de Entregas Parciales", 14, finalY);
        finalY += 6;
        doc.setDrawColor(24, 60, 48);
        doc.setLineWidth(0.4);
        doc.line(14, finalY, 196, finalY);
        finalY += 4;

        const historialBody = orden.historialEntregas.map((delivery, idx) => [
            `#${idx + 1}`,
            format(new Date(delivery.fecha), 'dd/MM/yy HH:mm'),
            delivery.recibidoPor,
            delivery.items.map((it: any) => `${it.insumo}: ${it.cantidad}`).join(' | '),
            delivery.notas || '-'
        ]);

        autoTable(doc, {
            startY: finalY,
            head: [["No.", "Fecha", "Recibió", "Ítems Entregados", "Notas"]],
            body: historialBody,
            theme: 'striped',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 22 },
                2: { cellWidth: 32 },
                4: { fontStyle: 'italic' }
            }
        });
    }

    // --- Footer ---
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(24, 60, 48);
        doc.rect(0, 285, 210, 15, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.text("ORIGEN BOTÁNICO - ZN E CENTRO LOGISTICO BG 16 Rionegro, Antioquia", 14, 292);
        doc.text(`Página ${i} de ${pageCount}`, 180, 292);
    }

    doc.save(`Orden_Compra_${tercero.nombre.replace(/ /g, '_')}_${format(new Date(), 'ddMMyyyy')}.pdf`);
};
