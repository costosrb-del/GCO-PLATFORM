from fpdf import FPDF
from datetime import datetime

class InventoryPDF(FPDF):
    def header(self):
        # Logo or Brand Name
        self.set_font('Arial', 'B', 15)
        self.set_text_color(24, 60, 48) # #183C30 (Dark Green)
        self.cell(0, 10, 'GCO Global Trading Platform', 0, 1, 'L')
        
        # Report Title
        self.set_font('Arial', 'B', 12)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, 'Reporte de Saldos de Inventario', 0, 1, 'L')
        
        # Date
        self.set_font('Arial', '', 10)
        self.cell(0, 10, f'Fecha de Generación: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', 0, 1, 'L')
        
        self.ln(5)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Página {self.page_no()}/{{nb}}', 0, 0, 'C')

    def chapter_title(self, label):
        self.set_font('Arial', 'B', 12)
        self.cell(0, 10, label, 0, 1, 'L')
        self.ln(4)

    def generate_table(self, data):
        # Colors, line width and bold font
        self.set_fill_color(24, 60, 48) # Header Background
        self.set_text_color(255, 255, 255) # Header Text
        self.set_draw_color(200, 200, 200)
        self.set_line_width(.3)
        self.set_font('Arial', 'B', 8) # Smaller font for table
        
        # Header
        # Columns: SKU | Producto | Promedio (20d) | Dias Inv. | Fecha Agotado | Cantidad
        header = ['SKU', 'Producto', 'Prom. (7d)', 'Dias Inv.', 'Fecha Agotado', 'Total']
        w = [30, 80, 20, 20, 25, 20] # Column widths
        
        for i, h in enumerate(header):
            self.cell(w[i], 7, h, 1, 0, 'C', 1)
        self.ln()
        
        # Color and font restoration
        self.set_fill_color(240, 245, 240) # Alternating Row Color
        self.set_text_color(0)
        self.set_font('Arial', '', 7)
        
        # Data
        fill = False
        for row in data:
            sku = str(row.get('code', ''))[:15] # Truncate strict
            name = str(row.get('name', ''))[:45] # Truncate strict
            
            # Format numbers
            try:
                avg = f"{float(row.get('dailyAverage', 0)):.2f}"
            except: avg = "0.00"
            
            try:
                days = float(row.get('daysSupply', 0))
                days_str = f"{days:.0f}" if days < 9999 else "Inf"
            except: days_str = "-"
            
            conflict = str(row.get('conflictDate', '-'))
            
            try:
                qty = f"{float(row.get('quantity', 0)):,.2f}"
            except: qty = "0.00"

            self.cell(w[0], 6, sku, 'LR', 0, 'L', fill)
            self.cell(w[1], 6, name, 'LR', 0, 'L', fill)
            self.cell(w[2], 6, avg, 'LR', 0, 'R', fill)
            self.cell(w[3], 6, days_str, 'LR', 0, 'C', fill)
            self.cell(w[4], 6, conflict, 'LR', 0, 'C', fill)
            self.cell(w[5], 6, qty, 'LR', 0, 'R', fill)
            
            self.ln()
            fill = not fill
            
        self.cell(sum(w), 0, '', 'T') # Closing line

def create_inventory_pdf_bytes(data: list):
    pdf = InventoryPDF()
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.generate_table(data)
    
    # Return bytes
    # fpdf2 uses output(dest='S') to return string/bytes -> clean way is usually .output() for recent versions
    # Checking requirement: strictly fpdf (v1.7.2 usually returns str in latin-1)
    # However, depending on python version, we might need encoding
    
    # Safe method for FPDF 1.7.2 (common in these envs)
    return pdf.output(dest='S').encode('latin-1') 
