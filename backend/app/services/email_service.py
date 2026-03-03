
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

PLATFORM_URL = "https://studio-3702398351-4eb21.web.app/"
BRAND_COLOR = "#183C30"


def _build_base_html(title: str, body_content: str) -> str:
    """Genera un email HTML con el estilo corporativo de GCO."""
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    return f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; color: #333; margin: 0; padding: 0; background: #f5f5f5; }}
            .wrapper {{ max-width: 600px; margin: 0 auto; background: white; }}
            .header {{ background-color: {BRAND_COLOR}; color: white; padding: 24px 28px; }}
            .header h1 {{ margin: 0; font-size: 20px; }}
            .header p {{ margin: 4px 0 0; font-size: 12px; opacity: 0.7; }}
            .content {{ padding: 24px 28px; border: 1px solid #e5e7eb; border-top: none; }}
            .stat-box {{ background: #f9fafb; padding: 16px; margin: 16px 0; border-radius: 8px; border-left: 4px solid {BRAND_COLOR}; }}
            .badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }}
            .badge-pending {{ background: #fef3c7; color: #92400e; }}
            .badge-approved {{ background: #d1fae5; color: #065f46; }}
            .badge-rejected {{ background: #fee2e2; color: #991b1b; }}
            .cta {{ text-align: center; margin: 24px 0; }}
            .cta a {{ background-color: {BRAND_COLOR}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; }}
            .footer {{ margin-top: 0; padding: 16px 28px; font-size: 11px; color: #9ca3af; text-align: center; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; }}
            table {{ width: 100%; border-collapse: collapse; margin: 12px 0; }}
            th {{ background: {BRAND_COLOR}; color: white; padding: 8px 12px; text-align: left; font-size: 12px; }}
            td {{ padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="header">
                <h1>{title}</h1>
                <p>GCO Platform · {date_str}</p>
            </div>
            <div class="content">
                {body_content}
            </div>
            <div class="footer">
                Generado automáticamente por GCO Platform V2 · <a href="{PLATFORM_URL}" style="color: {BRAND_COLOR};">Ir a la Plataforma</a>
            </div>
        </div>
    </body>
    </html>
    """


def _send(subject: str, html: str, recipients: list[str]) -> tuple[bool, str]:
    """Envía un email HTML por SMTP."""
    # Support both MAIL_USERNAME (conciliacion) and EMAIL_USER (compras)
    sender_email = os.getenv("MAIL_USERNAME") or os.getenv("EMAIL_USER")
    sender_password = os.getenv("MAIL_PASSWORD") or os.getenv("EMAIL_PASSWORD")
    
    smtp_host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("EMAIL_PORT", "587"))

    if not sender_email or not sender_password:
        logger.warning(f"Email no configurado. MAIL_USERNAME={bool(os.getenv('MAIL_USERNAME'))}, EMAIL_USER={bool(os.getenv('EMAIL_USER'))}")
        return False, "Credenciales de correo no configuradas."

    if not recipients:
        return False, "Sin destinatarios."

    try:
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"GCO Platform <{sender_email}>"
        msg["To"] = ", ".join(recipients)
        msg.attach(MIMEText(html, "html"))

        server.sendmail(sender_email, recipients, msg.as_string())
        server.quit()
        logger.info(f"Email enviado a {recipients}: {subject}")
        return True, "Enviado correctamente."

    except Exception as e:
        logger.error(f"Error enviando email: {e}")
        return False, f"Error SMTP: {str(e)}"


# ── Notificaciones específicas de negocio ─────────────────────────────────────

def notify_orden_creada(orden: dict, tercero_nombre: str, admin_emails: list[str]) -> tuple[bool, str]:
    """Notifica a los admins que hay una nueva OC esperando aprobación."""
    items_html = ""
    for it in (orden.get("items") or []):
        items_html += f"<tr><td>{it.get('insumo', '-')}</td><td>{it.get('cantidad', 0)} {it.get('unidad', '')}</td><td>${it.get('precio_estimado', 0):,.0f}</td></tr>"

    total = orden.get("total_bruto", 0) or 0

    body = f"""
        <p>Se ha generado una nueva <strong>Orden de Compra</strong> que requiere revisión y aprobación.</p>

        <div class="stat-box">
            <p><strong>ID de Orden:</strong> {orden.get('id', 'N/A')}</p>
            <p><strong>Pedido No.:</strong> {orden.get('numeroPedido', 'N/A')}</p>
            <p><strong>Proveedor:</strong> {tercero_nombre}</p>
            <p><strong>Fecha Solicitada:</strong> {orden.get('fechaSolicitada', 'Por definir')}</p>
            <p><strong>Total Estimado:</strong> <span style="font-size:18px;font-weight:bold;color:{BRAND_COLOR}">${total:,.0f} COP</span></p>
        </div>

        <table>
            <tr><th>Insumo</th><th>Cantidad</th><th>Precio Unit.</th></tr>
            {items_html}
        </table>

        {f'<p><em>Notas: {orden["notas"]}</em></p>' if orden.get("notas") else ""}

        <div class="cta">
            <a href="{PLATFORM_URL}dashboard/compras">Revisar y Aprobar Orden →</a>
        </div>
    """
    html = _build_base_html("🛒 Nueva Orden de Compra — Pendiente de Aprobación", body)
    return _send(f"[GCO] Nueva OC {orden.get('id', '')} — Pendiente Aprobación", html, admin_emails)


def notify_orden_aprobada(orden: dict, tercero_correo: str, tercero_nombre: str) -> tuple[bool, str]:
    """Notifica al proveedor que su orden fue aprobada."""
    body = f"""
        <p>Estimado/a <strong>{tercero_nombre}</strong>,</p>
        <p>Nos complace informarle que la siguiente orden de compra ha sido <strong style="color: #065f46;">APROBADA</strong>.</p>

        <div class="stat-box">
            <p><strong>Referencia de Orden:</strong> {orden.get('id', 'N/A')}</p>
            <p><strong>No. Pedido:</strong> {orden.get('numeroPedido', 'N/A')}</p>
            <p><strong>Fecha de Entrega Solicitada:</strong> {orden.get('fechaSolicitada', 'Por coordinar')}</p>
            <p><strong>Tiempo de Entrega:</strong> {orden.get('tiempoEntrega', 'N/A')}</p>
            <p><strong>Total a Liquidar:</strong> <strong>${(orden.get('total_bruto') or 0):,.0f} COP</strong></p>
        </div>

        <p>Por favor proceda con el alistamiento del pedido según los términos acordados.</p>
        <p>Aprobado por: <strong>{orden.get('aprobadoPor', 'Administración')}</strong></p>
    """
    html = _build_base_html("✅ Orden de Compra Aprobada — Origen Botánico", body)
    return _send(f"[GCO] OC {orden.get('id', '')} Aprobada — Proceder con Despacho", html, [tercero_correo])


def notify_orden_rechazada(orden: dict, tercero_nombre: str, solicitante_email: str) -> tuple[bool, str]:
    """Notifica internamente que una OC fue rechazada."""
    body = f"""
        <p>La siguiente orden de compra ha sido <strong style="color: #991b1b;">RECHAZADA / CANCELADA</strong>.</p>

        <div class="stat-box">
            <p><strong>Orden:</strong> {orden.get('id', 'N/A')} · Pedido {orden.get('numeroPedido', 'N/A')}</p>
            <p><strong>Proveedor:</strong> {tercero_nombre}</p>
            <p><strong>Motivo:</strong> {orden.get('motivoRechazo', 'Sin especificar')}</p>
        </div>

        <p>Si tiene preguntas, comuníquese con el área de compras.</p>
    """
    html = _build_base_html("❌ Orden de Compra Cancelada", body)
    recipients = [solicitante_email] if solicitante_email else []
    if not recipients:
        return False, "Sin destinatario para notificación de rechazo."
    return _send(f"[GCO] OC {orden.get('id', '')} Cancelada", html, recipients)


def notify_recepcion_parcial(orden: dict, delivery: dict, tercero_nombre: str, admin_emails: list[str]) -> tuple[bool, str]:
    """Notifica que se registró una entrega parcial de una OC."""
    items_html = "".join(
        f"<tr><td>{it.get('insumo','-')}</td><td>{it.get('cantidad',0)}</td></tr>"
        for it in delivery.get("items", [])
    )
    body = f"""
        <p>Se registró una <strong>entrega parcial</strong> en la orden <strong>{orden.get('id','')}</strong>.</p>
        <div class="stat-box">
            <p><strong>Entrega No.:</strong> {len(orden.get('historialEntregas', []))}</p>
            <p><strong>Proveedor:</strong> {tercero_nombre}</p>
            <p><strong>Recibido por:</strong> {delivery.get('recibidoPor', 'N/A')}</p>
            {f'<p><em>{delivery.get("notas","")}</em></p>' if delivery.get("notas") else ""}
        </div>
        <table>
            <tr><th>Insumo</th><th>Cantidad Recibida</th></tr>
            {items_html}
        </table>
        <div class="cta"><a href="{PLATFORM_URL}dashboard/compras">Ver Orden Completa →</a></div>
    """
    html = _build_base_html("📦 Recepción Parcial Registrada", body)
    return _send(f"[GCO] Entrega Parcial OC {orden.get('id','')} · {tercero_nombre}", html, admin_emails)


def send_daily_report_email(inventory_data) -> tuple[bool, str]:
    """Reporte diario de inventario (función original mejorada)."""
    recipient_emails_raw = os.getenv("MAIL_RECIPIENTS", "")
    recipient_emails = [e.strip() for e in recipient_emails_raw.split(",") if e.strip()]

    total_qty = sum(item.get("quantity", 0) for item in inventory_data)
    total_items = len(inventory_data)
    companies = set(item.get("company_name") for item in inventory_data)

    body = f"""
        <p>Este es el resumen automático del estado del inventario en GCO Platform V2.</p>
        <div class="stat-box">
            <h3 style="margin-top:0">Resumen Ejecutivo</h3>
            <p><strong>Total Unidades:</strong> {total_qty:,.0f}</p>
            <p><strong>Total SKUs:</strong> {total_items}</p>
            <p><strong>Empresas:</strong> {len(companies)}</p>
        </div>
        <h3>Empresas incluidas:</h3>
        <ul>{''.join(f'<li>{c}</li>' for c in sorted(companies))}</ul>
        <div class="cta"><a href="{PLATFORM_URL}">Ir a la Plataforma →</a></div>
    """
    html = _build_base_html("📊 Reporte Diario de Inventario", body)
    return _send(f"📊 Estado Inventario GCO — {datetime.now().strftime('%Y-%m-%d')}", html, recipient_emails)


def send_conciliacion_email(start_date: str, end_date: str, stats: dict, discrepancies: list, recipients: list[str]) -> tuple[bool, str]:
    """Envía un resumen de la conciliación por correo."""
    
    diff_html = ""
    if discrepancies:
        diff_html = "<h3>Detalle de Diferencias (Muestra)</h3><table><tr><th>Empresa</th><th>Factura</th><th>Cliente</th><th>Novedad</th></tr>"
        for d in discrepancies[:10]: # Solo mostramos las primeras 10 para no saturar
            novedades = "<br>".join(d.get("diffs", []))
            diff_html += f"<tr><td>{d.get('empresa','')}</td><td>{d.get('invoice','')}</td><td>{d.get('client','')}</td><td style='color: #991b1b; font-size: 11px;'>{novedades}</td></tr>"
        diff_html += "</table>"
        if len(discrepancies) > 10:
             diff_html += f"<p><em>...y {len(discrepancies) - 10} diferencias más (ver plataforma).</em></p>"

    body = f"""
        <p>Se ha completado un cruce automático de conciliación de facturación.</p>
        
        <div class="stat-box">
            <h3 style="margin-top:0">Resumen del Periodo: {start_date} al {end_date}</h3>
            <p><strong>Hora de Conciliación:</strong> {datetime.now().strftime('%H:%M:%S')}</p>
            <p><strong>Facturas que Coinciden Perfectamente:</strong> <span style="color: #065f46; font-weight: bold;">{stats.get('matched', 0)}</span></p>
            <p><strong>Facturas con Diferencias de Cantidad/SKU:</strong> <span style="color: #92400e; font-weight: bold;">{stats.get('diferencias', 0)}</span></p>
            <p><strong>Facturas solo en Siigo (Faltan en Excel):</strong> <span style="color: #991b1b; font-weight: bold;">{stats.get('solo_siigo', 0)}</span></p>
            <p><strong>Facturas solo en Excel (Pendientes en Siigo):</strong> <span style="color: #ea580c; font-weight: bold;">{stats.get('solo_sheets', 0)}</span></p>
            <p><strong>Total de Documentos Analizados:</strong> {stats.get('total', 0)}</p>
        </div>
        
        {diff_html}
        
        <div class="cta">
            <a href="{PLATFORM_URL}dashboard/conciliacion">Ver Reporte Completo en GCO →</a>
        </div>
    """
    html = _build_base_html(f"🔄 Resultado Conciliación {start_date} / {end_date}", body)
    return _send(f"[GCO] Conciliación FVs: {stats.get('diferencias', 0)} Diferencias ({start_date} al {end_date})", html, recipients)
