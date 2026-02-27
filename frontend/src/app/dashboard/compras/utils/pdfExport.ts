import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { OrdenCompra, Tercero, Insumo } from "@/hooks/useCompras";

export const exportarOrdenPDF = (orden: OrdenCompra, tercero: Tercero, insumos: Insumo[]) => {
    const doc = new jsPDF();

    // Header
    doc.setFillColor(24, 60, 48); // GCO color
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);

    // logo
    try {
        doc.addImage("/logo.png", "PNG", 14, 8, 25, 25);
    } catch (e) {
        console.error("Logo not found for PDF");
    }

    // Split title if too long
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    const title = "AUTORIZACIÓN DE COMPRA";
    doc.text(title, 45, 18);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("ORIGEN BOTÁNICO S.A.S.", 45, 24);
    doc.setFontSize(8);
    doc.text("NIT: 901.401.558-1", 45, 28);

    doc.setFontSize(9);
    doc.text(`Fecha Emisión: ${format(new Date(orden.created_at || new Date()), "dd/MM/yyyy")}`, 150, 15);
    doc.text(`Pedido No: ${orden.numeroPedido || 'N/A'}`, 150, 21);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`O.C. ID: ${orden.id.toUpperCase()}`, 150, 29);
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

    // --- Términos y Condiciones ---
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("TÉRMINOS Y CONDICIONES:", 14, finalY);
    doc.setFont("helvetica", "normal");
    const terms = [
        "1. La entrega debe realizarse en la dirección especificada en la fecha solicitada.",
        "2. Todo producto debe venir con su respectivo Certificado de Análisis y Ficha Técnica.",
        "3. No se aceptarán productos con vencimiento inferior a 12 meses.",
        "4. Esta orden es una autorización formal de compra sujeta a revisión de calidad en recepción."
    ];
    terms.forEach((line, i) => {
        doc.text(line, 14, finalY + 4 + (i * 4));
    });

    finalY += 25;

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
