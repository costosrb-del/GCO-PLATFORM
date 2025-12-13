
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def send_daily_report_email(inventory_data):
    """
    Sends an HTML email with the inventory summary using SMTP.
    """
    sender_email = os.getenv("MAIL_USERNAME")
    sender_password = os.getenv("MAIL_PASSWORD")
    recipient_emails = os.getenv("MAIL_RECIPIENTS", "").split(",") # Can be multiple, comma separated

    if not sender_email or not sender_password:
        logger.error("Email credentials not configured (MAIL_USERNAME / MAIL_PASSWORD).")
        return False, "Credenciales de correo no configuradas."

    if not recipient_emails or recipient_emails == ['']:
        logger.error("No recipients configured (MAIL_RECIPIENTS).")
        return False, "Destinatarios no configurados."

    # Calculate Summary Stats
    total_qty = sum(item.get("quantity", 0) for item in inventory_data)
    total_items = len(inventory_data)
    companies = set(item.get("company_name") for item in inventory_data)
    
    # Create HTML Body
    date_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    html_content = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; color: #333; }}
            .header {{ background-color: #183C30; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }}
            .content {{ padding: 20px; border: 1px solid #ddd; border-top: none; }}
            .stat-box {{ background-color: #f9f9f9; padding: 15px; margin-bottom: 20px; border-radius: 5px; border-left: 5px solid #183C30; }}
            .footer {{ margin-top: 20px; font-size: 12px; color: #888; text-align: center; }}
            h2 {{ color: #183C30; }}
            ul {{ line-height: 1.6; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Reporte Diario de Inventario</h1>
            <p>{date_str}</p>
        </div>
        <div class="content">
            <p>Hola,</p>
            <p>Este es el resumen automático del estado del inventario en GCO Platform V2:</p>
            
            <div class="stat-box">
                <h3>Resumen Ejecutivo</h3>
                <p><strong>Total Unidades:</strong> {total_qty:,.0f}</p>
                <p><strong>Total Referencias (SKUs):</strong> {total_items}</p>
                <p><strong>Empresas Reportadas:</strong> {len(companies)}</p>
            </div>

            <h3>Empresas Incluidas:</h3>
            <ul>
                {''.join(f'<li>{c}</li>' for c in sorted(companies))}
            </ul>

            <p>Para ver el detalle completo, ingresa a la plataforma:</p>
            <p style="text-align: center;">
                <a href="https://studio-3702398351-4eb21.web.app/" style="background-color: #183C30; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ir a la Plataforma</a>
            </p>
        </div>
        <div class="footer">
            Generado automáticamente por GCO Platform V2
        </div>
    </body>
    </html>
    """

    try:
        # Validar conexión SMTP (Usualmente Gmail usa puerto 587 con STARTTLS)
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()  # Secure the connection
        server.login(sender_email, sender_password)

        # Create Message
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"📊 Estado Inventario GCO - {date_str}"
        msg["From"] = f"GCO Bot <{sender_email}>"
        msg["To"] = ", ".join(recipient_emails)

        msg.attach(MIMEText(html_content, "html"))

        # Send
        server.sendmail(sender_email, recipient_emails, msg.as_string())
        server.quit()
        
        logger.info(f"Report sent successfully to {recipient_emails}")
        return True, "Correo enviado correctamente."

    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False, f"Error enviando correo: {str(e)}"
