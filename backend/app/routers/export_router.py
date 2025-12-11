from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import Response, StreamingResponse
import pandas as pd
import io
# from app.services.inventory import get_all_products # Reusing data passed from frontend or cached?
# Ideally, frontend sends data to export to ensure WYSIWYG, or we regenerate.
# For simplicity and speed, let's accept the filtered data from frontend.

router = APIRouter(prefix="/export", tags=["export"])

@router.post("/excel")
def export_excel(data: list = Body(...)):
    df = pd.DataFrame(data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Saldos")
        # Enhancements could go here (formats)
    
    output.seek(0)
    
    headers = {
        "Content-Disposition": "attachment; filename=saldos_inventario.xlsx"
    }
    return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)

@router.post("/pdf")
def export_pdf(data: list = Body(...)):
    # Simple PDF generation using FPDF
    from fpdf import FPDF
    
    class PDF(FPDF):
        def header(self):
            # Logo placeholder (ideally load from file or URL)
            self.set_font("Arial", "B", 12)
            self.cell(0, 10, "Reporte de Inventarios - Origen Botanico", 0, 1, "C")
            self.ln(5)

        def footer(self):
            self.set_y(-15)
            self.set_font("Arial", "I", 8)
            self.cell(0, 10, f"Pagina {self.page_no()}", 0, 0, "C")

    pdf = PDF()
    pdf.add_page()
    pdf.set_font("Arial", "B", 10)
    
    # Headers
    cols = ["Empresa", "SKU", "Producto", "Bodega", "Cant"]
    widths = [40, 30, 60, 40, 20]
    
    for i, h in enumerate(cols):
        pdf.cell(widths[i], 10, h, 1)
    pdf.ln()
    
    # Data
    pdf.set_font("Arial", "", 8)
    for row in data:
        # Truncate strings to fit
        c_name = str(row.get("company_name", ""))[:20]
        sku = str(row.get("code", ""))[:15]
        prod = str(row.get("name", ""))[:30]
        wh = str(row.get("warehouse_name", ""))[:20]
        qty = str(row.get("quantity", 0))
        
        pdf.cell(widths[0], 8, c_name, 1)
        pdf.cell(widths[1], 8, sku, 1)
        pdf.cell(widths[2], 8, prod, 1)
        pdf.cell(widths[3], 8, wh, 1)
        pdf.cell(widths[4], 8, qty, 1)
        pdf.ln()

    output = io.BytesIO(pdf.output(dest="S").encode("latin-1"))
    
    headers = {
        "Content-Disposition": "attachment; filename=reporte_inventario.pdf"
    }
    return Response(content=output.getvalue(), media_type="application/pdf", headers=headers)
