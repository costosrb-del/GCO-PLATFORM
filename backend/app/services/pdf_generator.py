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

def create_inventory_pdf_bytes(data: list):
    pdf = InventoryPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Draw Chart First (Visual Impact)
    pdf.draw_chart(data)
    
    # Then Table
    pdf.generate_table(data)
    
    try:
        return pdf.output(dest='S').encode('latin-1')
    except:
        return pdf.output(dest='S').encode('latin-1', errors='ignore') 
