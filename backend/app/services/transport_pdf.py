
from fpdf import FPDF
from datetime import datetime

class TransportPDF(FPDF):
    def header(self):
        # Decorative Top Bar
        self.set_fill_color(24, 60, 48) # #183C30 Deep Green
        self.rect(0, 0, 210, 5, 'F')
        
        self.ln(10)
        
        # Brand Title
        self.set_font('Arial', 'B', 18)
        self.set_text_color(24, 60, 48)
        self.cell(0, 8, 'GCO - Origen Botánico', 0, 1, 'L')
        
        # Subtitle
        self.set_font('Arial', '', 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, 'Solicitud de Servicio de Transporte de Carga', 0, 1, 'L')
        
        # Divider Line
        self.set_draw_color(24, 60, 48)
        self.set_line_width(0.5)
        self.line(10, 30, 200, 30)
        self.ln(5)

    def footer(self):
        # Professional Footer with Contact Info
        self.set_y(-35)
        self.set_fill_color(24, 60, 48) # #183C30 Deep Green
        self.rect(0, 297-35, 210, 35, 'F')
        
        self.set_y(-28)
        self.set_text_color(255, 255, 255)
        self.set_font('Arial', '', 7)
        
        # Column 1: Address
        self.set_x(10)
        self.multi_cell(60, 3.5, "Zona E, Centro Logístico, Bodega 16,\ndel cruce del Tablazo 900 mts\nVía Zona Franca. Rionegro, Ant.", 0, 'L')
        
        # Column 2: Social / Web
        self.set_xy(80, 297-28)
        self.cell(50, 4, "IG: @ritualbotanico.co", 0, 1, 'L')
        self.set_x(80)
        self.cell(50, 4, "WA: +57 318 4626877", 0, 1, 'L')
        
        # Column 3: Email / Web
        self.set_xy(130, 297-28)
        self.cell(60, 4, "sac@ritualbotanico.com", 0, 1, 'L')
        self.set_x(130)
        self.cell(60, 4, "www.ritualbotanico.com", 0, 1, 'L')
        
        # Column 4: Phone (Right aligned approx)
        self.set_xy(170, 297-28)
        self.set_font('Arial', 'B', 9)
        self.cell(30, 8, "604 2966310", 0, 1, 'R')

    def draw_section_box(self, title, x, y, w, h, content_callback):
        # Draw a section with a header bar
        self.set_xy(x, y)
        self.set_fill_color(240, 240, 240)
        # self.rect(x, y, w, h, 'F')
        
        # Header Box
        self.set_fill_color(24, 60, 48)
        self.rect(x, y, w, 7, 'F')
        
        # Title
        self.set_xy(x + 2, y + 1.5)
        self.set_font('Arial', 'B', 9)
        self.set_text_color(255, 255, 255)
        self.cell(w, 4, title.upper(), 0, 0, 'L')
        
        # Wrapper box border
        self.set_draw_color(200, 200, 200)
        self.rect(x, y, w, h, 'D')
        
        # Content content
        self.set_xy(x + 2, y + 9)
        self.set_text_color(0, 0, 0)
        content_callback(x + 2, y + 9, w - 4)

def safe_str(val, default=""):
    """Safely convert value to string, returning default if None or empty."""
    if val is None:
        return default
    s = str(val).strip()
    return s if s else default

def generate_transport_pdf_bytes(data: dict):
    pdf = TransportPDF()
    pdf.set_auto_page_break(auto=True, margin=40)
    pdf.add_page()
    
    # --- HEADER OVERLAY ---
    pdf.set_y(15)
    pdf.set_x(120)
    pdf.set_font('Arial', 'B', 12)
    pdf.set_text_color(24, 60, 48)
    req_id = safe_str(data.get('legacy_id') or data.get('id', 'N/A'))[:8].upper()
    pdf.cell(80, 8, f'SOLICITUD: {req_id}', 0, 1, 'R')
    
    pdf.set_x(120)
    pdf.set_font('Arial', '', 9)
    pdf.set_text_color(100, 100, 100)
    request_date_raw = data.get("request_date")
    pdf.cell(80, 5, f'Fecha: {str(request_date_raw)[:10] if request_date_raw else "N/A"}', 0, 1, 'R')
    
    # --- LAYOUT ---
    y_start = 40
    
    # HELPER Draw Field
    def field_row(pdf_obj, label, value, w, ln=1):
        pdf_obj.set_font('Arial', 'B', 8)
        pdf_obj.set_text_color(80, 80, 80)
        pdf_obj.cell(30, 5, f"{label}:", 0, 0, 'L')
        pdf_obj.set_font('Arial', '', 9)
        pdf_obj.set_text_color(0, 0, 0)
        # Handle long text
        val_str = safe_str(value, "-") 
        if len(val_str) > 30:
            pdf_obj.multi_cell(w - 30, 5, val_str, 0, 'L')
        else:
            pdf_obj.cell(w - 30, 5, val_str, 0, ln, 'L')

    # SECTION 1: TRANSPORTISTA
    def draw_carrier(x, y, w):
        pdf.set_xy(x, y)
        field_row(pdf, "Nombre", data.get("carrier"), w)
        pdf.set_x(x)
        field_row(pdf, "Vehículo", data.get("vehicle_type"), w)
        pdf.set_x(x)
        field_row(pdf, "Conductor", data.get("driver_name"), w)
        pdf.set_x(x)
        field_row(pdf, "Placa", data.get("vehicle_plate"), w)

    pdf.draw_section_box("Transportista", 10, y_start, 90, 35, draw_carrier)

    # SECTION 2: DETALLES LOGISTICOS
    def draw_details(x, y, w):
        pdf.set_xy(x, y)
        sched_date = data.get("scheduled_load_date") or data.get("pickup_date")
        field_row(pdf, "F. Cargue", sched_date, w)
        pdf.set_x(x)
        
        val = data.get("merchandise_value")
        try: val_str = f"${float(val):,.0f}" if val else "$0"
        except: val_str = safe_str(val, "$0")
        field_row(pdf, "Valor Merca.", val_str, w)
        pdf.set_x(x)
        
        cost = data.get("transport_cost")
        try: cost_str = f"${float(cost):,.0f}" if cost else "---"
        except: cost_str = safe_str(cost, "---")
        field_row(pdf, "Costo Flete", cost_str, w)

    pdf.draw_section_box("Detalles del Servicio", 110, y_start, 90, 35, draw_details)

    # SECTION 3: ORIGEN
    y_loc = y_start + 45
    def draw_origin(x, y, w):
        pdf.set_xy(x, y)
        pdf.set_font('Arial', 'B', 10)
        origin_name = safe_str(data.get("origin_name") or data.get("origin"), "N/A")
        pdf.cell(w, 5, origin_name, 0, 1, 'L')
        pdf.ln(2)
        pdf.set_font('Arial', '', 8)
        pdf.set_text_color(50, 50, 50)
        
        # Address logic
        addr = safe_str(data.get("origin_address"), "")
        if not addr:
             # Fallback if origin itself looks like address or just repeat name
             addr = safe_str(data.get("origin"), "Sin dirección registrada")
        
        pdf.multi_cell(w, 4, f"Dirección:\n{addr}", 0, 'L')

    pdf.draw_section_box("Origen / Cargue", 10, y_loc, 90, 40, draw_origin)

    # SECTION 4: DESTINO
    def draw_destination(x, y, w):
        pdf.set_xy(x, y)
        pdf.set_font('Arial', 'B', 10)
        dest_name = safe_str(data.get("destination_name") or data.get("destination"), "N/A")
        pdf.cell(w, 5, dest_name, 0, 1, 'L')
        pdf.ln(2)
        pdf.set_font('Arial', '', 8)
        pdf.set_text_color(50, 50, 50)
        
        addr = safe_str(data.get("destination_address"), "")
        if not addr:
             addr = safe_str(data.get("destination"), "Sin dirección registrada")
             
        pdf.multi_cell(w, 4, f"Dirección:\n{addr}", 0, 'L')

    pdf.draw_section_box("Destino / Entrega", 110, y_loc, 90, 40, draw_destination)
    
    # SECTION 5: OBSERVACIONES
    y_obs = y_loc + 50
    def draw_obs(x, y, w):
        pdf.set_xy(x, y)
        obs = safe_str(data.get("observations"), "Ninguna")
        pdf.set_font('Arial', '', 9)
        pdf.multi_cell(w, 4, obs, 0, 'L')

    pdf.draw_section_box("Observaciones / Instrucciones", 10, y_obs, 190, 25, draw_obs)

    # SIGNATURES AREA
    y_sig = y_obs + 45
    
    pdf.set_y(y_sig)
    pdf.set_draw_color(150, 150, 150)
    
    # Left Box
    pdf.rect(20, y_sig, 70, 25, 'D')
    pdf.set_xy(20, y_sig + 18)
    pdf.set_font('Arial', '', 7)
    pdf.cell(70, 4, "Firma del Conductor / Transportista", 0, 0, 'C')
    
    # Right Box
    pdf.rect(120, y_sig, 70, 25, 'D')
    pdf.set_xy(120, y_sig + 5)
    pdf.set_font('Arial', 'B', 9)
    pdf.cell(70, 5, "Santiago Alvarez Lopez", 0, 1, 'C')
    pdf.set_x(120)
    pdf.set_font('Arial', '', 7)
    pdf.cell(70, 4, "Coordinador de Costos", 0, 1, 'C')

    # UUID
    pdf.set_y(-45)
    uuid_code = safe_str(data.get("id"), "---")
    pdf.set_font('Courier', '', 8)
    pdf.set_text_color(150, 150, 150)
    pdf.cell(0, 5, f"UUID: {uuid_code}", 0, 1, 'C')

    try:
        return pdf.output(dest='S').encode('latin-1')
    except:
        return pdf.output(dest='S').encode('latin-1', errors='ignore')
