import * as XLSX from "xlsx";

export interface ExcelImportData {
    insumos: any[];
    terceros: any[];
    productos: any[];
    bom: any[];
}

export async function parseExcelImport(file: File): Promise<ExcelImportData> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });

                const result: ExcelImportData = {
                    insumos: [],
                    terceros: [],
                    productos: [],
                    bom: []
                };

                // Mapeo flexible de nombres de pestañas
                workbook.SheetNames.forEach(name => {
                    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
                    const cleanName = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                    if (cleanName.includes("insumo")) result.insumos = sheet;
                    else if (cleanName.includes("tercero") || cleanName.includes("proveedor")) result.terceros = sheet;
                    else if (cleanName.includes("producto")) result.productos = sheet;
                    else if (cleanName.includes("bom") || cleanName.includes("ficha") || cleanName.includes("receta")) result.bom = sheet;
                });

                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = (err) => reject(err);
        reader.readAsArrayBuffer(file);
    });
}

/** 
 * Genera un archivo Excel de ejemplo (Template) para el usuario
 */
export function descargarTemplateExcel() {
    const wb = XLSX.utils.book_new();

    // 1. Insumos
    const wsInsumos = XLSX.utils.json_to_sheet([
        { SKU: "INS-001", Nombre: "Envase PET 500ml", Rendimiento: "1", Unidad: "Unidad", Clasificacion: "Envase", Precio: 850, LoteMinimo: 100 },
        { SKU: "INS-002", Nombre: "Tapa Disco 24/410", Rendimiento: "0.98%", Unidad: "Unidad", Clasificacion: "Tapa", Precio: 320, LoteMinimo: 500 }
    ]);
    XLSX.utils.book_append_sheet(wb, wsInsumos, "Insumos");

    // 2. Terceros
    const wsTerceros = XLSX.utils.json_to_sheet([
        { Nombre: "Distribuidora Plasticos SAS", NIT: "900.123.456-1", Correo: "ventas@plasticos.com", PersonaContacto: "Juan Perez", NumeroContacto: "3001234567", Insumos_SKU: "[INS-001][INS-002]" }
    ]);
    XLSX.utils.book_append_sheet(wb, wsTerceros, "Proveedores");

    // 3. Productos (Finales o Kits)
    const wsProductos = XLSX.utils.json_to_sheet([
        { SKU: "PROD-101", Nombre: "Shampoo Anticaida 500ml", Categoria: "Capilar", Tipo: "Producto" },
        { SKU: "KIT-202", Nombre: "Duo Capilar Regalo", Categoria: "Kits", Tipo: "Kit" }
    ]);
    XLSX.utils.book_append_sheet(wb, wsProductos, "Productos");

    // 4. BOM (Explosión de materiales)
    const wsBOM = XLSX.utils.json_to_sheet([
        { SKU_Padre: "PROD-101", SKU_Hijo: "INS-001", Tipo_Hijo: "Insumo", Cantidad: 1 },
        { SKU_Padre: "PROD-101", SKU_Hijo: "INS-002", Tipo_Hijo: "Insumo", Cantidad: 1 },
        { SKU_Padre: "KIT-202", SKU_Hijo: "PROD-101", Tipo_Hijo: "Producto", Cantidad: 2 }
    ]);
    XLSX.utils.book_append_sheet(wb, wsBOM, "BOM");

    XLSX.writeFile(wb, "Template_Importacion_GCO.xlsx");
}
