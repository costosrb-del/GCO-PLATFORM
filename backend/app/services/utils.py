import pandas as pd
from io import BytesIO
from fpdf import FPDF
import datetime

def to_excel(df):
    """
    Converts a DataFrame to an Excel file in memory.
    """
    output = BytesIO()
    with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
        df.to_excel(writer, index=False, sheet_name='Sheet1')
        workbook = writer.book
        worksheet = writer.sheets['Sheet1']
        
        # Format header
        header_format = workbook.add_format({
            'bold': True,
            'text_wrap': True,
            'valign': 'top',
            'fg_color': '#D7E4BC',
            'border': 1
        })
        
        for col_num, value in enumerate(df.columns.values):
            worksheet.write(0, col_num, value, header_format)
            
        # Auto-adjust columns
        for column in df:
            column_width = max(df[column].astype(str).map(len).max(), len(column))
            col_idx = df.columns.get_loc(column)
            worksheet.set_column(col_idx, col_idx, column_width)
            
    return output.getvalue()

class PDF(FPDF):
    def __init__(self, header_title="Reporte de Inventario - Origen Botánico", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.header_title = header_title

    def header(self):
        # Professional Banner
        # Dark Green Background
        self.set_fill_color(24, 60, 48) # #183C30
        self.rect(0, 0, 210, 30, 'F') # Full width banner (A4 width approx 210)
        
        # Logo
        import os
        logo_path = "src/assets/logo.png"
        has_logo = False
        if os.path.exists(logo_path):
            try:
                # x=10, y=5, h=20 (banner is 30)
                self.image(logo_path, 10, 5, h=20)
                has_logo = True
            except:
                pass # Fail silently if image is bad

        # Title Text
        self.set_font('Arial', 'B', 14) # Slightly smaller to fit multiple lines
        self.set_text_color(255, 255, 255) # White
        
        if has_logo:
             self.set_xy(35, 5)
             w_title = 165
        else:
             self.set_xy(10, 5)
             w_title = 190
             
        self.multi_cell(w_title, 8, self.header_title, 0, 'C')
        self.ln(2)
        
        # Reset colors
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Origen Botánico - Página {self.page_no()}/{{nb}}', 0, 0, 'C')

def to_pdf(df, title="Reporte", filters=None, custom_header=None):
    """
    Converts a DataFrame to a simple PDF report with metadata.
    """
    # Use custom header if provided, otherwise default fallback or title
    pdf_title = custom_header if custom_header else "Reporte de Inventario - Origen Botánico"
    pdf = PDF(header_title=pdf_title)
    pdf.alias_nb_pages()
    pdf.add_page()
    pdf.set_font('Arial', '', 10)
    
    # Metadata Section (Below Banner)
    pdf.set_y(35) # Start below banner
    
    # Sub-Title (The 'title' param) and Date
    pdf.set_font('Arial', 'B', 12)
    current_time = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    pdf.cell(0, 8, f"{title}", 0, 1)
    
    pdf.set_font('Arial', '', 9)
    pdf.cell(0, 6, f"Generado el: {current_time}", 0, 1)
    
    # Filters Section
    if filters:
        pdf.ln(2)
        pdf.set_font('Arial', 'B', 9)
        pdf.cell(0, 6, "Filtros Aplicados:", 0, 1)
        pdf.set_font('Arial', '', 8)
        for key, value in filters.items():
            # Handle list values (like multi-select)
            if isinstance(value, list):
                val_str = ", ".join(value) if value else "Todos"
            else:
                val_str = str(value)
            pdf.cell(0, 5, f"- {key}: {val_str}", 0, 1)
    
    pdf.ln(5)
    
    # Table Header
    pdf.set_font('Arial', 'B', 9)
    pdf.set_fill_color(200, 200, 200) # Light Gray Header
    col_width = pdf.w / (len(df.columns) + 1)
    row_height = 8 # Slightly taller
    
    for col in df.columns:
        pdf.cell(col_width, row_height, str(col), 1, 0, 'C', True)
    pdf.ln()
    
    # Table Data
    pdf.set_font('Arial', '', 8)
    fill = False # Alternating row color
    
    for index, row in df.iterrows():
        # Zebra striping
        if fill:
            pdf.set_fill_color(245, 245, 245)
        else:
            pdf.set_fill_color(255, 255, 255)
            
        for item in row:
            text = str(item)[:25] # Truncate check
            # Use 'F' for fill if fill=True in 4th arg? No, in cell() 7th arg is fill boolean
            pdf.cell(col_width, row_height, text, 1, 0, 'L', True)
            
        pdf.ln()
        fill = not fill # Toggle
        
    return pdf.output(dest='S').encode('latin-1', 'replace')

def fetch_google_sheet_inventory(sheet_url):
    """
    Fetches inventory data from a public Google Sheet CSV link.
    Expects:
    - Column A (0): Product Code (SKU)
    - Column B (1): Product Name (Description)
    - Column C (2): Quantity
    
    Returns a list of dictionaries with formatting compatible with the main inventory data.
    """
    external_data = []
    try:
        # Read CSV directly from URL
        df = pd.read_csv(sheet_url, on_bad_lines='skip')
        
        # Ensure we have at least 3 columns
        if len(df.columns) < 3:
            print("ERROR: Google Sheet has less than 3 columns (Requires A=SKU, B=Name, C=Qty).")
            return []
            
        # Select first three columns
        df = df.iloc[:, [0, 1, 2]]
        df.columns = ['code', 'name', 'quantity'] 
        
        for index, row in df.iterrows():
            try:
                code = str(row['code']).strip()
                name = str(row['name']).strip()
                
                # Clean quantity
                # User Issue: "2.000" (2000) is being read as 2.0.
                # Fix: Remove '.' (Thousand separator in LATAM). Replace ',' with '.' (Decimal).
                qty_str = str(row['quantity']).strip()
                if qty_str and qty_str.lower() != 'nan':
                     # Remove thousands separator (.)
                    qty_str = qty_str.replace('.', '') 
                    # Replace decimal separator (,) with dot for Python
                    qty_str = qty_str.replace(',', '.') 
                    qty = float(qty_str)
                else:
                    qty = 0.0
                
                if not code or code.lower() == 'nan':
                    continue
                    
                if not name or name.lower() == 'nan':
                    name = "Sin Nombre Externo"

                external_data.append({
                    "company_name": "Inventario Externo",
                    "code": code,
                    "name": name, 
                    "warehouse_name": "Bodega Libre",
                    "quantity": qty
                })
            except ValueError:
                continue 
                
        print(f"Fetched {len(external_data)} rows from Google Sheet.")
        return external_data
        
    except Exception as e:
        print(f"Error fetching Google Sheet: {e}")
        return []
