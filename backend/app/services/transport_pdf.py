
from fpdf import FPDF
from datetime import datetime

class TransportPDF(FPDF):
    def header(self):
        # Top Left: Brand
        self.set_font('Arial', 'B', 16)
        self.set_text_color(24, 60, 48) # #183C30
        self.cell(100, 8, 'GCO - Origen Botánico', 0, 0, 'L')
        
        # Top Right: ID
        self.set_font('Arial', 'B', 12)
        self.set_text_color(100, 100, 100)
        # Using a holder for ID, will vary per doc, but header is static usually. 
        # We'll print ID in the body closely to header to avoid complication.
        self.ln(8)
        
        self.set_font('Arial', '', 10)
        self.set_text_color(128, 128, 128)
        self.cell(0, 5, 'Solicitud de Servicio de Transporte', 0, 1, 'L')
        
        self.set_draw_color(230, 230, 230)
        self.line(10, 25, 200, 25)
        self.ln(10)

    def footer(self):
        self.set_y(-25)
        self.set_font('Arial', 'I', 8)
        self.set_text_color(150, 150, 150)
        
        # Authenticity
        self.cell(0, 4, 'Autenticidad del Documento', 0, 1, 'C')
        self.set_font('Arial', '', 7)
        self.cell(0, 4, 'Este documento fue generado automáticamente por la plataforma GCO.', 0, 1, 'C')
        self.cell(0, 4, f'Fecha de generación: {datetime.now().strftime("%Y-%m-%d %H:%M %p")}', 0, 1, 'C')

def generate_transport_pdf_bytes(data: dict):
    pdf = TransportPDF()
    pdf.add_page()
    
    # --- HEADER OVERLAY (To put dynamic ID/Date aligned right) ---
    pdf.set_y(10)
    pdf.set_x(120)
    pdf.set_font('Arial', 'B', 12)
    pdf.set_text_color(24, 60, 48)
    req_id = str(data.get('legacy_id') or data.get('id', 'N/A'))[:8].upper()
    pdf.cell(80, 8, f'ID: {req_id}', 0, 1, 'R')
    
    pdf.set_x(120)
    pdf.set_font('Arial', '', 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(80, 5, f'Fecha Solicitud: {data.get("request_date", "N/A")}', 0, 1, 'R')
    
    pdf.set_y(35) # Start Body
    
    # --- HELPER FOR SECTIONS ---
    def draw_section_title(title):
        pdf.set_font('Arial', 'B', 10)
        pdf.set_text_color(100, 100, 100)
        pdf.cell(0, 8, title, 'B', 1, 'L') # Bottom border
        pdf.ln(2)

    def draw_field(label, value, w=90, ln=0):
        pdf.set_font('Arial', 'B', 9)
        pdf.set_text_color(50, 50, 50)
        pdf.cell(35, 6, f"{label}:", 0, 0, 'L')
        
        pdf.set_font('Arial', '', 9)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(w-35, 6, str(value), 0, ln, 'L')

    # --- GRID LAYOUT ---
    # ROW 1: Transportista (Left) - Detalles (Right)
    y_start = pdf.get_y()
    
    # Col 1
    pdf.set_left_margin(10)
    pdf.set_right_margin(110)
    draw_section_title("Información del Transportista")
    draw_field("Nombre", data.get("carrier", "N/A"), 90, 1)
    draw_field("Contacto", data.get("carrier_contact", "-"), 90, 1)
    draw_field("Teléfono", data.get("carrier_phone", "-"), 90, 1)
    
    # Col 2
    pdf.set_y(y_start)
    pdf.set_left_margin(110)
    pdf.set_right_margin(10)
    draw_section_title("Detalles del Servicio")
    draw_field("Recolección", data.get("pickup_date", "N/A"), 90, 1)
    draw_field("Hora", data.get("pickup_time", "--:--"), 90, 1)
    draw_field("Vehículo", data.get("vehicle_type", "N/A"), 90, 1)
    
    val = data.get("merchandise_value", 0)
    try: val_str = f"${float(val):,.0f}"
    except: val_str = str(val)
    draw_field("Valor Est.", val_str, 90, 1)

    pdf.ln(10)
    
    # Reset Margins
    pdf.set_left_margin(10)
    pdf.set_right_margin(10)
    pdf.set_y(pdf.get_y() + 10) # Formatting spacing
    
    # ROW 2: Recogida vs Destino
    y_mid = pdf.get_y()
    
    # Col 1
    pdf.set_left_margin(10)
    pdf.set_right_margin(110)
    draw_section_title("Lugar de Recogida")
    draw_field("Ubicación", data.get("origin_name", data.get("origin", "N/A")), 90, 1)
    
    # Multi-cell for address
    pdf.set_font('Arial', 'B', 9) 
    pdf.cell(35, 6, "Dirección:", 0, 0, 'L')
    pdf.set_font('Arial', '', 9)
    pdf.multi_cell(55, 6, data.get("origin_address", data.get("origin", "")), 0, 'L')
    
    # Col 2
    pdf.set_y(y_mid)
    pdf.set_left_margin(110)
    pdf.set_right_margin(10)
    draw_section_title("Lugar de Destino")
    draw_field("Ubicación", data.get("destination_name", data.get("destination", "N/A")), 90, 1)
    
    # Multi-cell for address
    pdf.set_font('Arial', 'B', 9) 
    pdf.cell(35, 6, "Dirección:", 0, 0, 'L')
    pdf.set_font('Arial', '', 9)
    pdf.multi_cell(55, 6, data.get("destination_address", data.get("destination", "")), 0, 'L')
    
    # Reset
    pdf.set_left_margin(10)
    pdf.set_right_margin(10)
    pdf.set_y(pdf.get_y() + 20)

    # --- SIGNATURES ---
    pdf.ln(20)
    y_sig = pdf.get_y()
    
    # Left Sig
    pdf.line(20, y_sig, 90, y_sig)
    pdf.set_xy(20, y_sig + 2)
    pdf.set_font('Arial', '', 8)
    pdf.cell(70, 5, "Firma Transportista", 0, 0, 'C')
    
    # Right Sig
    pdf.line(120, y_sig, 190, y_sig)
    pdf.set_xy(120, y_sig + 2)
    pdf.set_font('Arial', 'B', 8)
    pdf.cell(70, 5, "Santiago Alvarez Lopez", 0, 1, 'C')
    pdf.set_x(120)
    pdf.set_font('Arial', '', 7)
    pdf.cell(70, 4, "(Coordinador de Costos)", 0, 1, 'C')

    # UUID at bottom
    pdf.set_y(-35)
    uuid_code = data.get("id", "---")
    pdf.set_font('Courier', '', 8)
    pdf.set_fill_color(245, 245, 245)
    pdf.cell(0, 6, uuid_code, 0, 1, 'C', 1)

    try:
        return pdf.output(dest='S').encode('latin-1')
    except:
        return pdf.output(dest='S').encode('latin-1', errors='ignore')
