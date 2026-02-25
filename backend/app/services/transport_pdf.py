
from fpdf import FPDF
from datetime import datetime

class TransportPDF(FPDF):
    def header(self):
        # Decorative Top Header Block
        self.set_fill_color(24, 60, 48) # #183C30 Deep Green
        self.rect(0, 0, 210, 25, 'F')
        
        # Brand Title
        self.set_y(8)
        self.set_x(10)
        self.set_font('Arial', 'B', 24)
        self.set_text_color(255, 255, 255)
        self.cell(0, 10, 'ORIGEN BOTÁNICO', 0, 1, 'L')
        
        # Subtitle
        self.set_y(18)
        self.set_x(10)
        self.set_font('Arial', 'I', 10)
        self.set_text_color(200, 220, 210)
        self.cell(0, 5, 'División de Logística y Transporte Oficial', 0, 1, 'L')
        
        self.ln(10)

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
        self.cell(50, 4, "IG: @origenbotanico", 0, 1, 'L')
        self.set_x(80)
        self.cell(50, 4, "WA: +57 318 4626877", 0, 1, 'L')
        
        # Column 3: Email / Web
        self.set_xy(130, 297-28)
        self.cell(60, 4, "sac@origenbotanico.com", 0, 1, 'L')
        self.set_x(130)
        self.cell(60, 4, "www.origenbotanico.com", 0, 1, 'L')
        
        # Column 4: Phone (Right aligned approx)
        self.set_xy(170, 297-28)
        self.set_font('Arial', 'B', 9)
        self.cell(30, 8, "604 2966310", 0, 1, 'R')

    def draw_section_box(self, title, x, y, w, h, content_callback):
        # Draw a section with a header bar
        self.set_xy(x, y)
        self.set_fill_color(250, 250, 250)
        self.rect(x, y, w, h, 'F') # Light gray bg for the whole box
        
        # Header Box
        self.set_fill_color(24, 60, 48)
        self.rect(x, y, w, 8, 'F')
        
        # Title
        self.set_xy(x + 3, y + 2)
        self.set_font('Arial', 'B', 9)
        self.set_text_color(255, 255, 255)
        self.cell(w, 4, title.upper(), 0, 0, 'L')
        
        # Wrapper box border
        self.set_draw_color(200, 200, 200)
        self.rect(x, y, w, h, 'D')
        
        # Content content
        self.set_xy(x + 3, y + 10)
        self.set_text_color(0, 0, 0)
        content_callback(x + 3, y + 10, w - 6)

def safe_str(val, default=""):
    """Safely convert value to string, returning default if None or empty."""
    if val is None:
        return default
    s = str(val).strip()
    return s if s else default

def enhance_address(name, base_addr):
    """Enforce exact addresses for known hubs if missing or loosely described"""
    name_check = safe_str(name, "").lower()
    if "rionegro" in name_check or "bodega principal" in name_check:
        return "ZN E CENTRO LOGISTICO BG 16 DEL CRUCE DEL TABLAZO 900 MTS VIA ZONA FRANCA"
    elif "bogot" in name_check or "laboratorio" in name_check:
        return "CL 17A 68D - 38 Bogotá D.C, Barrio Montevideo, Zona Industrial"
        
    if not base_addr:
        return safe_str(name, "Sin dirección registrada")
    return base_addr

def generate_transport_pdf_bytes(data: dict):
    pdf = TransportPDF()
    pdf.set_auto_page_break(auto=True, margin=40)
    pdf.add_page()
    
    # --- HEADER OVERLAY ---
    pdf.set_y(30) 
    
    req_id = safe_str(data.get('legacy_id') or data.get('id', 'N/A'))[:8].upper()
    cufe_uuid = safe_str(data.get('id', 'N/A'))
    
    # Gray box for Order Details
    pdf.set_fill_color(245, 245, 245)
    pdf.rect(10, 30, 190, 20, 'F')
    pdf.set_draw_color(220, 220, 220)
    pdf.rect(10, 30, 190, 20, 'D')
    
    # Left side of gray box (Dates and CUFE)
    pdf.set_xy(15, 33)
    pdf.set_font('Arial', '', 9)
    pdf.set_text_color(80, 80, 80)
    request_date_raw = data.get("request_date") or data.get("created_at")
    date_str = str(request_date_raw)[:10] if request_date_raw else "N/A"
    pdf.cell(100, 5, f'Fecha de Emisión: {date_str}', 0, 1, 'L')

    pdf.set_x(15)
    pdf.set_font('Arial', '', 7)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(100, 5, f'CUFE / UUID Autorizado: {cufe_uuid}', 0, 1, 'L')
    
    # Right side of gray box (Badge Request ID)
    pdf.set_xy(120, 32)
    pdf.set_font('Arial', 'B', 15)
    pdf.set_text_color(180, 0, 0)
    pdf.cell(75, 8, f'ORDEN N°: {req_id}', 0, 1, 'R')
    pdf.set_x(120)
    pdf.set_font('Arial', 'I', 8)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(75, 4, 'Documento Oficial de Carga', 0, 1, 'R')
    
    # --- LAYOUT ---
    y_start = 55 # Moved down to accommodate new header box
    
    # HELPER Draw Field
    def field_row(pdf_obj, label, value, w, ln=1):
        pdf_obj.set_font('Arial', '', 8)
        pdf_obj.set_text_color(120, 120, 120)
        pdf_obj.cell(35, 5.5, f"{label}:", 0, 0, 'L')
        pdf_obj.set_font('Arial', 'B', 9)
        pdf_obj.set_text_color(30, 30, 30)
        # Handle long text
        val_str = safe_str(value, "-") 
        if len(val_str) > 25: 
            pdf_obj.multi_cell(w - 35, 4.5, val_str, 0, 'L')
        else:
            pdf_obj.cell(w - 35, 5.5, val_str, 0, ln, 'L')

    # SECTION 1: TRANSPORTISTA
    def draw_carrier(x, y, w):
        pdf.set_xy(x, y)
        field_row(pdf, "Nombre / Empresa", data.get("carrier"), w)
        pdf.set_x(x)
        field_row(pdf, "Vehículo", data.get("vehicle_type"), w)
        pdf.set_x(x)
        field_row(pdf, "Condutor", data.get("driver_name"), w)
        pdf.set_x(x)
        field_row(pdf, "Placa", data.get("vehicle_plate"), w)

    pdf.draw_section_box("Datos del Transportador", 10, y_start, 90, 40, draw_carrier)

    # SECTION 2: DETALLES LOGISTICOS
    def draw_details(x, y, w):
        pdf.set_xy(x, y)
        sched_date = data.get("scheduled_load_date") or data.get("pickup_date")
        field_row(pdf, "Fecha de Cargue", sched_date, w)
        pdf.set_x(x)
        
        sched_time = safe_str(data.get("scheduled_load_time"), "No especificada")
        field_row(pdf, "Hora Programada", sched_time, w)
        pdf.set_x(x)
        
        helpers = safe_str(data.get("requires_helpers"), "No")
        field_row(pdf, "Req. Auxiliares?", helpers.upper(), w)
        pdf.set_x(x)
        
        val = data.get("merchandise_value")
        try: val_str = f"${float(val):,.0f}" if val else "$0"
        except: val_str = safe_str(val, "$0")
        field_row(pdf, "Valor Asegurado", val_str, w)
        pdf.set_x(x)
        
        cost = data.get("transport_cost")
        try: cost_str = f"${float(cost):,.0f}" if cost else "---"
        except: cost_str = safe_str(cost, "---")
        field_row(pdf, "Costo de Flete", cost_str, w)

    pdf.draw_section_box("Información del Servicio", 110, y_start, 90, 40, draw_details)

    # SECTION 3: ORIGEN (Increased Height)
    y_loc = y_start + 45
    box_h = 42 # Sleeker height
    
    def draw_origin(x, y, w):
        pdf.set_xy(x, y)
        pdf.set_font('Arial', 'B', 10)
        origin_name = safe_str(data.get("origin_name") or data.get("origin"), "N/A")
        pdf.cell(w, 5, origin_name.upper(), 0, 1, 'L')
        pdf.ln(2)
        pdf.set_font('Arial', '', 9)
        pdf.set_text_color(50, 50, 50)
        
        # Address logic
        addr = enhance_address(origin_name, data.get("origin_address"))
        
        pdf.set_x(x) # Ensure X aligns
        pdf.multi_cell(w, 4.5, f"Dirección Física:\n{addr}", 0, 'L')

    pdf.draw_section_box("Punto de Origen / Cargue", 10, y_loc, 90, box_h, draw_origin)

    # SECTION 4: DESTINO (Increased Height)
    def draw_destination(x, y, w):
        pdf.set_xy(x, y)
        pdf.set_font('Arial', 'B', 10)
        dest_name = safe_str(data.get("destination_name") or data.get("destination"), "N/A")
        pdf.cell(w, 5, dest_name.upper(), 0, 1, 'L')
        pdf.ln(2)
        pdf.set_font('Arial', '', 9)
        pdf.set_text_color(50, 50, 50)
        # Address logic
        addr = enhance_address(dest_name, data.get("destination_address"))
        
        pdf.set_x(x) # Ensure X aligns
        pdf.multi_cell(w, 4.5, f"Dirección Física:\n{addr}", 0, 'L')

    pdf.draw_section_box("Punto de Destino / Entrega", 110, y_loc, 90, box_h, draw_destination)
    
    # SECTION 5: OBSERVACIONES
    y_obs = y_loc + box_h + 5 
    def draw_obs(x, y, w):
        pdf.set_xy(x, y)
        obs = safe_str(data.get("observations"), "Ninguna")
        pdf.set_font('Arial', '', 9)
        pdf.multi_cell(w, 5, obs, 0, 'L')

    pdf.draw_section_box("Observaciones e Instrucciones Especiales", 10, y_obs, 190, 30, draw_obs)

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
    creator = safe_str(data.get("created_by"), "Autorizador Oficial")
    pdf.rect(120, y_sig, 70, 25, 'D')
    pdf.set_xy(120, y_sig + 5)
    pdf.set_font('Arial', 'B', 9)
    # Handle long names in the signature elegantly
    if len(creator) > 28:
        pdf.set_font('Arial', 'B', 8)
    pdf.cell(70, 5, creator.upper(), 0, 1, 'C')
    pdf.set_x(120)
    pdf.set_font('Arial', '', 7)
    pdf.cell(70, 4, "Firma del Coordinador / Orígen Botánico", 0, 1, 'C')

    # Minimal Footer note
    pdf.set_y(-45)
    pdf.set_font('Arial', 'I', 8)
    pdf.set_text_color(180, 180, 180)
    pdf.cell(0, 5, "Documento de uso interno y control logístico.", 0, 1, 'C')

    try:
        return pdf.output(dest='S').encode('latin-1')
    except:
        return pdf.output(dest='S').encode('latin-1', errors='ignore')
