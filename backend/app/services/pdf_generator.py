from fpdf import FPDF
from datetime import datetime

class InventoryPDF(FPDF):
    def header(self):
        # Professional Header "ORIGEN BOTANICO"
        self.set_font('Arial', 'B', 20)
        self.set_text_color(24, 60, 48) # #183C30 (Brand Green)
        self.cell(0, 15, 'ORIGEN BOTANICO', 0, 1, 'C')
        
        # Subtitle
        self.set_font('Arial', 'B', 14)
        self.set_text_color(80, 80, 80)
        self.cell(0, 8, 'Reporte Oficial de Saldos', 0, 1, 'C')
        
        # Meta Info Line
        self.set_font('Arial', '', 10)
        self.set_text_color(100, 100, 100)
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.cell(0, 6, f'Generado el: {now} | Usuario: Admin', 0, 1, 'C')
        
        self.ln(5)
        self.set_draw_color(24, 60, 48)
        self.set_line_width(1.0)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'GCO Platform - Agentes de Inteligencia | Página {self.page_no()}/{{nb}}', 0, 0, 'C')

    def draw_chart(self, data):
        """
        Draws a simple bar chart of Inventory Days for TOP 15 filtered products.
        Y-Axis: Days of Inventory
        X-Axis: Products
        """
        self.set_font('Arial', 'B', 12)
        self.set_text_color(0)
        self.cell(0, 10, 'Análisis Gráfico: Días de Inventario (Top 15)', 0, 1, 'L')
        self.ln(5)

        # 1. Prepare Data (Top 15 items with positive stock to make chart meaningful)
        # Filter items with meaningful days (0 < days < 365 to avoid infinity/zeros skewing chart)
        chart_items = [
            d for d in data 
            if 0 < float(d.get('daysSupply', 0)) < 400
        ]
        # Sort by lowest days first (urgency)
        chart_items.sort(key=lambda x: float(x.get('daysSupply', 0)))
        chart_items = chart_items[:15] # Take top 15

        if not chart_items:
            self.set_font('Arial', 'I', 10)
            self.cell(0, 10, 'No hay suficientes datos para generar la gráfica (Requiere stock > 0 y ventas activas).', 0, 1, 'L')
            self.ln(10)
            return

        # 2. Dimensions
        chart_height = 60
        chart_width = 180
        start_x = 15
        start_y = self.get_y() + 5
        bar_width = (chart_width - 20) / len(chart_items)
        max_days = max([float(d.get('daysSupply', 0)) for d in chart_items])
        if max_days == 0: max_days = 10

        # 3. Draw Axes
        self.set_line_width(0.2)
        self.set_draw_color(100, 100, 100)
        # Y-Axis line
        self.line(start_x, start_y, start_x, start_y + chart_height)
        # X-Axis line
        self.line(start_x, start_y + chart_height, start_x + chart_width, start_y + chart_height)

        # 4. Draw Bars
        self.set_font('Arial', '', 6)
        
        for i, item in enumerate(chart_items):
            days = float(item.get('daysSupply', 0))
            
            # Bar Height Calc
            bar_h = (days / max_days) * (chart_height - 10)
            
            # Position
            x_pos = start_x + 5 + (i * bar_width)
            y_pos = start_y + chart_height - bar_h

            # Color Logic (Green=High, Red=Low)
            if days < 15:
                self.set_fill_color(220, 50, 50) # Red
            elif days < 30:
                self.set_fill_color(255, 165, 0) # Orange
            else:
                self.set_fill_color(24, 60, 48) # Green

            # Draw Rect
            self.rect(x_pos, y_pos, bar_width - 2, bar_h, 'F')
            
            # SKU/Name Label (Rotated headers are hard in simple FPDF, just put abbreviated SKU below)
            # FPDF 1.7 text rotation is tricky. We'll utilize numbers or short codes.
            self.set_xy(x_pos, start_y + chart_height + 2)
            code = str(item.get('code', 'N/A'))
            # Try to grab last 4 digits if it's long, or just the code
            display_code = code[-6:] if len(code) > 6 else code
            self.cell(bar_width, 4, display_code, 0, 0, 'C')

            # Value Label (Above bar)
            self.set_xy(x_pos, y_pos - 4)
            self.cell(bar_width, 4, f"{int(days)}d", 0, 0, 'C')

        self.ln(chart_height + 15) # Move cursor past chart

    def generate_table(self, data):
        self.set_font('Arial', 'B', 12)
        self.cell(0, 10, 'Detalle de Referencias', 0, 1, 'L')
        self.ln(2)

        # Table Styling
        self.set_fill_color(24, 60, 48) # Brand Green
        self.set_text_color(255, 255, 255)
        self.set_draw_color(220, 220, 220)
        self.set_line_width(.3)
        self.set_font('Arial', 'B', 8)
        
        # Columns
        header = ['SKU', 'Producto', 'Disponible', 'Venta Diaria', 'Días Inv.', 'Estado']
        w = [25, 85, 20, 20, 15, 25] 
        
        for i, h in enumerate(header):
            self.cell(w[i], 8, h, 1, 0, 'C', 1)
        self.ln()
        
        # Data Rows
        self.set_fill_color(245, 245, 245)
        self.set_text_color(40, 40, 40)
        self.set_font('Arial', '', 7)
        
        fill = False
        for row in data:
            sku = str(row.get('code', ''))[:12]
            name = str(row.get('name', ''))[:55]
            
            try: qty = f"{float(row.get('quantity', 0)):,.0f}" # No decimals for cleaner look
            except: qty = "0"
            
            try: avg = f"{float(row.get('dailyAverage', 0)):.1f}"
            except: avg = "0.0"

            try: 
                days_val = float(row.get('daysSupply', 0))
                days = f"{days_val:.0f}" if days_val < 999 else ">999"
            except: 
                days_val = 0
                days = "-"
            
            # Logic for Status
            status = "Normal"
            if days_val == 0 and float(row.get('quantity', 0)) <= 0: status = "Agotado"
            elif days_val < 15: status = "Crítico"
            elif days_val < 45: status = "Saludable"
            elif days_val > 120: status = "Exceso"

            self.cell(w[0], 6, sku, 'LR', 0, 'L', fill)
            self.cell(w[1], 6, name, 'LR', 0, 'L', fill)
            self.cell(w[2], 6, qty, 'LR', 0, 'R', fill)
            self.cell(w[3], 6, avg, 'LR', 0, 'R', fill)
            self.cell(w[4], 6, days, 'LR', 0, 'C', fill)
            self.cell(w[5], 6, status, 'LR', 0, 'C', fill)
            
            self.ln()
            fill = not fill
            
        self.cell(sum(w), 0, '', 'T')

def sanitize_str(text):
    """Encodes string to latin-1 and ignores characters that can't be represented."""
    if not text:
        return ""
    try:
        # Standard fpdf 1.7.x expects latin-1 (iso-8859-1) strings
        return str(text).encode('latin-1', 'replace').decode('latin-1')
    except:
        return str(text)

def create_inventory_pdf_bytes(data: list):
    pdf = InventoryPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Pre-sanitize data to avoid internal FPDF errors
    sanitized_data = []
    for row in data:
        s_row = {}
        for k, v in row.items():
            if isinstance(v, str):
                s_row[k] = sanitize_str(v)
            else:
                s_row[k] = v
        sanitized_data.append(s_row)

    # Draw Chart First (Visual Impact)
    pdf.draw_chart(sanitized_data)
    
    # Then Table
    pdf.generate_table(sanitized_data)
    
    try:
        return pdf.output(dest='S').encode('latin-1')
    except:
        return pdf.output(dest='S').encode('latin-1', errors='ignore') 

class ActaPDF(FPDF):
    def header(self):
        # Official Heading FI-004 V2 style
        self.set_draw_color(0)
        self.set_line_width(0.4)
        
        # 3-column header box
        self.rect(10, 10, 190, 20)
        self.line(60, 10, 60, 30)
        self.line(160, 10, 160, 30)
        
        # Left: Company Name (Placeholder Origen Botánico)
        self.set_font('Arial', 'B', 12)
        self.set_xy(10, 15)
        self.cell(50, 5, 'ORIGEN', 0, 1, 'C')
        self.set_font('Arial', '', 8)
        self.set_x(10)
        self.cell(50, 5, 'BOTANICO', 0, 1, 'C')
        
        # Middle: Title
        self.set_xy(60, 15)
        self.set_font('Arial', 'B', 10)
        self.cell(100, 5, 'ACTA DE INVENTARIO DE PRODUCTO TERMINADO', 0, 1, 'C')
        self.set_font('Arial', '', 8)
        self.set_x(60)
        self.cell(100, 5, 'Control de Existencias y Auditoria de Stock', 0, 1, 'C')
        
        # Right: Codes
        self.set_font('Arial', 'B', 7)
        self.set_xy(160, 12)
        self.cell(30, 4, 'CODIGO: FI-004 V2', 0, 1, 'L')
        self.set_xy(160, 17)
        self.cell(30, 4, 'FECHA: 07/2024', 0, 1, 'L')
        self.set_xy(160, 22)
        self.cell(30, 4, f'PAGINA: {self.page_no()}', 0, 1, 'L')
        
        self.set_xy(10, 35)

    def footer(self):
        self.set_y(-25)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, 'GCO Platform - Agentes de Inteligencia | Auditoria de Inventarios', 0, 0, 'C')

def create_acta_pdf_bytes(acta_data: dict):
    pdf = ActaPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    data = acta_data.get("data", {})
    items = data.get("items", [])
    
    # 1. INFO GENERAL
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font('Arial', 'B', 9)
    # Row 1
    pdf.cell(60, 10, 'Empresa Auditada:', 1, 0, 'L', 1)
    pdf.set_font('Arial', '', 9)
    pdf.cell(130, 10, sanitize_str(data.get("company", "N/A")), 1, 1, 'L')
    
    # Row 2
    pdf.set_font('Arial', 'B', 9)
    pdf.cell(60, 10, 'Consecutivo / Periodo:', 1, 0, 'L', 1)
    pdf.set_font('Arial', '', 9)
    pdf.cell(130, 10, f'{data.get("consecutivo", "N/A")} | {data.get("periodo", "N/A")}', 1, 1, 'L')
    
    # Row 3
    pdf.set_font('Arial', 'B', 9)
    pdf.cell(60, 10, 'Fecha de Cierre:', 1, 0, 'L', 1)
    pdf.set_font('Arial', '', 9)
    pdf.cell(130, 10, sanitize_str(data.get("fecha", "N/A")), 1, 1, 'L')
    
    pdf.ln(5)
    
    # 2. DESARROLLO (Simplified text)
    pdf.set_font('Arial', 'B', 10)
    pdf.cell(0, 8, '1. Desarrollo y Metodologia', 0, 1, 'L')
    pdf.set_font('Arial', '', 9)
    metodologia = "Se realizo el levantamiento fisico de inventario aplicando el Principio de Verificacion Dual. El equipo de auditoria valido el 100% de las unidades en estanteria y zona de packing."
    pdf.multi_cell(0, 5, sanitize_str(metodologia))
    pdf.ln(5)
    
    # 3. HALLAZGOS TABLE
    pdf.set_font('Arial', 'B', 10)
    pdf.cell(0, 8, '2. Hallazgos y Diferencias', 0, 1, 'L')
    
    # Table Header
    pdf.set_fill_color(24, 60, 48)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font('Arial', 'B', 8)
    
    cols = [30, 70, 30, 30, 30]
    headers = ['SKU', 'Producto', 'Sistema', 'Fisico', 'Diferencia']
    for i, h in enumerate(headers):
        pdf.cell(cols[i], 8, h, 1, 0, 'C', 1)
    pdf.ln()
    
    pdf.set_text_color(0)
    pdf.set_font('Arial', '', 8)
    
    for item in items:
        sku = sanitize_str(item.get("sku", ""))
        name = sanitize_str(item.get("name", ""))[:45]
        
        # Calculate based on system values
        s_total = (float(item.get("bPrincipal") or 0) + 
                   float(item.get("bAverias") or 0) + 
                   float(item.get("bComercExt") or 0) + 
                   float(item.get("bLibre") or 0) +
                   float(item.get("systemFree") or 0))
        
        p_total = (float(item.get("physical") or 0) + 
                   float(item.get("physicalFree") or 0))
        
        diff = p_total - s_total
        
        # Only show items with stock or physical
        if s_total == 0 and p_total == 0:
            continue
            
        pdf.cell(cols[0], 7, sku, 1, 0, 'L')
        pdf.cell(cols[1], 7, name, 1, 0, 'L')
        pdf.cell(cols[2], 7, f"{s_total:,.0f}", 1, 0, 'C')
        pdf.cell(cols[3], 7, f"{p_total:,.0f}", 1, 0, 'C')
        
        # Color difference
        if diff < 0: pdf.set_text_color(200, 0, 0)
        elif diff > 0: pdf.set_text_color(0, 0, 200)
        else: pdf.set_text_color(0, 150, 0)
        
        pdf.cell(cols[4], 7, f"{diff:,.0f}", 1, 1, 'C')
        pdf.set_text_color(0)
        
    pdf.ln(10)
    
    # 4. OBSERVACIONES
    pdf.add_page()
    pdf.set_font('Arial', 'B', 10)
    pdf.cell(0, 8, '3. Observaciones y Dictamen', 0, 1, 'L')
    pdf.set_font('Arial', '', 9)
    obs = data.get("observaciones", "Sin observaciones registradas.")
    pdf.multi_cell(0, 5, sanitize_str(obs))
    
    pdf.ln(20)
    
    # 5. FIRMAS
    pdf.set_font('Arial', 'B', 9)
    pdf.line(20, pdf.get_y(), 80, pdf.get_y())
    pdf.line(120, pdf.get_y(), 180, pdf.get_y())
    pdf.set_y(pdf.get_y() + 2)
    pdf.cell(100, 5, 'Firma Auditor Responsable', 0, 0, 'C')
    pdf.cell(60, 5, 'Firma Logistica / Bodega', 0, 1, 'C')
    
    try:
        return pdf.output(dest='S').encode('latin-1')
    except:
        return pdf.output(dest='S').encode('latin-1', errors='ignore')
