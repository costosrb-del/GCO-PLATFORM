"""
email_router.py
───────────────
Endpoint para enviar la Orden de Compra aprobada al proveedor por correo,
con el PDF adjunto y soporte de CC a múltiples destinatarios.

Variables de entorno requeridas (.env del backend):
  EMAIL_USER      → correo from (ej. compras@origenbotanico.com o gmail)
  EMAIL_PASSWORD  → contraseña de app (Gmail: generar en myaccount.google.com/apppasswords)
  EMAIL_HOST      → smtp.gmail.com  (por defecto)
  EMAIL_PORT      → 587             (por defecto, TLS)
  EMAIL_FROM_NAME → Origen Botánico — Compras   (por defecto)
"""

import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.routers.auth_router import verify_token

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/email", tags=["Email"])


# ── Modelos ───────────────────────────────────────────────────────────────────

class ItemOC(BaseModel):
    insumo: str
    cantidad: float
    unidad: str
    precio_estimado: float = 0.0

class EnviarOCRequest(BaseModel):
    oc_id: str
    numero_pedido: str
    correo_proveedor: str
    nombre_proveedor: str
    nit_proveedor: str
    correo_cc: List[str] = []          # copias adicionales
    fecha_solicitada: Optional[str] = None
    tiempo_entrega: Optional[str] = None
    notas: Optional[str] = None
    items: List[ItemOC]
    total_bruto: float = 0.0
    pdf_base64: Optional[str] = None   # PDF generado en frontend, base64

class EnviarOCResponse(BaseModel):
    ok: bool
    message: str
    destinatarios: List[str]


# ── Template HTML del email ───────────────────────────────────────────────────

def _build_html(req: EnviarOCRequest) -> str:
    filas_items = ""
    for i, item in enumerate(req.items, 1):
        subtotal = item.cantidad * item.precio_estimado
        filas_items += f"""
        <tr style="background:{'#f9fafb' if i % 2 == 0 else 'white'}">
            <td style="padding:10px 14px;font-size:13px;color:#374151">{i}</td>
            <td style="padding:10px 14px;font-size:13px;color:#374151;font-weight:600">{item.insumo}</td>
            <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:center">{item.cantidad:,.2f}</td>
            <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:center">{item.unidad}</td>
            <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right">${item.precio_estimado:,.0f}</td>
            <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:700;text-align:right">${subtotal:,.0f}</td>
        </tr>"""

    fecha_str = req.fecha_solicitada or "Por confirmar"
    entrega_str = req.tiempo_entrega or "Por confirmar"
    emitida_str = datetime.now().strftime("%d/%m/%Y %H:%M")

    return f"""<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#183C30;padding:32px 36px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:#a7f3d0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Autorización de Compra</p>
                  <h1 style="margin:6px 0 0;color:white;font-size:26px;font-weight:900">Orden de Compra</h1>
                  <p style="margin:4px 0 0;color:#6ee7b7;font-size:14px;font-weight:600">#{req.oc_id}</p>
                </td>
                <td align="right" valign="top">
                  <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:12px 16px;text-align:right">
                    <p style="margin:0;color:#a7f3d0;font-size:10px;text-transform:uppercase;letter-spacing:1px">Pedido No.</p>
                    <p style="margin:2px 0 0;color:white;font-size:22px;font-weight:900">{req.numero_pedido}</p>
                    <p style="margin:6px 0 0;color:#6ee7b7;font-size:10px">Emitida: {emitida_str}</p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Info proveedor + entrega -->
        <tr>
          <td style="padding:28px 36px 0">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" valign="top" style="padding-right:20px">
                  <p style="margin:0 0 10px;font-size:10px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px">Estimado Proveedor</p>
                  <p style="margin:0;font-size:17px;font-weight:800;color:#111827">{req.nombre_proveedor}</p>
                  <p style="margin:2px 0 0;font-size:12px;color:#6b7280;font-family:monospace">NIT: {req.nit_proveedor}</p>
                  <p style="margin:10px 0 0;font-size:13px;color:#374151;line-height:1.6">
                    Por medio del presente, <strong>Origen Botánico</strong> les notifica la aprobación
                    de la siguiente solicitud de compra. Por favor confirmar disponibilidad y
                    fecha de despacho.
                  </p>
                </td>
                <td width="50%" valign="top">
                  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px">
                    <p style="margin:0 0 10px;font-size:10px;font-weight:800;color:#16a34a;text-transform:uppercase;letter-spacing:1.5px">Detalles de Entrega</p>
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="font-size:11px;color:#6b7280;padding-bottom:6px">Fecha solicitada:</td>
                        <td align="right" style="font-size:12px;color:#111827;font-weight:700;padding-bottom:6px">{fecha_str}</td>
                      </tr>
                      <tr>
                        <td style="font-size:11px;color:#6b7280;padding-bottom:6px">Tiempo de entrega:</td>
                        <td align="right" style="font-size:12px;color:#111827;font-weight:700;padding-bottom:6px">{entrega_str}</td>
                      </tr>
                      <tr>
                        <td style="font-size:11px;color:#6b7280">Estado:</td>
                        <td align="right">
                          <span style="background:#183C30;color:white;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px">APROBADA</span>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Tabla ítems -->
        <tr>
          <td style="padding:24px 36px 0">
            <p style="margin:0 0 12px;font-size:10px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px">Detalle de la Orden</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
              <thead>
                <tr style="background:#183C30">
                  <th style="padding:10px 14px;font-size:10px;color:#a7f3d0;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:1px">#</th>
                  <th style="padding:10px 14px;font-size:10px;color:#a7f3d0;font-weight:700;text-align:left;text-transform:uppercase;letter-spacing:1px">Descripción</th>
                  <th style="padding:10px 14px;font-size:10px;color:#a7f3d0;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px">Cantidad</th>
                  <th style="padding:10px 14px;font-size:10px;color:#a7f3d0;font-weight:700;text-align:center;text-transform:uppercase;letter-spacing:1px">Unidad</th>
                  <th style="padding:10px 14px;font-size:10px;color:#a7f3d0;font-weight:700;text-align:right;text-transform:uppercase;letter-spacing:1px">Vr. Unit.</th>
                  <th style="padding:10px 14px;font-size:10px;color:#a7f3d0;font-weight:700;text-align:right;text-transform:uppercase;letter-spacing:1px">Vr. Total</th>
                </tr>
              </thead>
              <tbody>{filas_items}</tbody>
              <tfoot>
                <tr style="background:#f0fdf4">
                  <td colspan="5" style="padding:12px 14px;font-size:12px;font-weight:800;color:#183C30;text-align:right;text-transform:uppercase;letter-spacing:0.5px">Total Bruto COP</td>
                  <td style="padding:12px 14px;font-size:16px;font-weight:900;color:#183C30;text-align:right">${req.total_bruto:,.0f}</td>
                </tr>
              </tfoot>
            </table>
          </td>
        </tr>

        <!-- Notas -->
        {'<tr><td style="padding:16px 36px 0"><div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px"><p style="margin:0;font-size:10px;font-weight:800;color:#92400e;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Notas / Observaciones</p><p style="margin:0;font-size:13px;color:#78350f">' + str(req.notas) + '</p></div></td></tr>' if req.notas else ''}

        <!-- Footer acción -->
        <tr>
          <td style="padding:28px 36px">
            <div style="background:#f8fafc;border-radius:12px;padding:20px;text-align:center">
              <p style="margin:0 0 8px;font-size:13px;color:#374151">
                Por favor confirmar recepción y disponibilidad respondiendo este correo
                o comunicándose con el área de compras.
              </p>
              <p style="margin:0;font-size:12px;color:#9ca3af">
                El PDF de la Orden de Compra se adjunta a este correo para su archivo.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer empresa -->
        <tr>
          <td style="background:#183C30;padding:20px 36px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:#a7f3d0;font-size:13px;font-weight:700">Origen Botánico</p>
                  <p style="margin:2px 0 0;color:#6ee7b7;font-size:11px">ZN E Centro Logístico BG 16 · Rionegro, Antioquia</p>
                  <p style="margin:2px 0 0;color:#6ee7b7;font-size:11px">🌿 compras@origenbotanico.com</p>
                </td>
                <td align="right">
                  <p style="margin:0;color:#4ade80;font-size:10px">OC #{req.oc_id} · Pedido {req.numero_pedido}</p>
                  <p style="margin:2px 0 0;color:#6ee7b7;font-size:10px">Sistema GCO Platform V2</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/enviar-oc", response_model=EnviarOCResponse)
async def enviar_oc(req: EnviarOCRequest, user=Depends(verify_token)):
    """
    Envía la OC aprobada al proveedor con:
    - HTML profesional como cuerpo del email
    - PDF adjunto (base64 enviado desde el frontend)
    - CC a correos adicionales
    """
    smtp_host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("EMAIL_PORT", "587"))
    smtp_user = os.getenv("EMAIL_USER")
    smtp_pass = os.getenv("EMAIL_PASSWORD")
    from_name = os.getenv("EMAIL_FROM_NAME", "Origen Botánico — Compras")

    if not smtp_user or not smtp_pass:
        raise HTTPException(
            status_code=503,
            detail="EMAIL_USER y EMAIL_PASSWORD no configurados en el servidor. Contacta al administrador."
        )

    # Todos los destinatarios
    to_list = [req.correo_proveedor]
    cc_list = [c.strip() for c in req.correo_cc if c.strip()]

    msg = MIMEMultipart("alternative") if not req.pdf_base64 else MIMEMultipart("mixed")
    msg["Subject"] = f"Orden de Compra #{req.oc_id} — Pedido {req.numero_pedido} | Origen Botánico"
    msg["From"] = f"{from_name} <{smtp_user}>"
    msg["To"] = req.correo_proveedor
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)
    msg["Reply-To"] = smtp_user

    # Cuerpo HTML
    html_body = _build_html(req)
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    # Adjuntar PDF si viene en base64
    if req.pdf_base64:
        import base64
        try:
            pdf_bytes = base64.b64decode(req.pdf_base64)
            part = MIMEBase("application", "pdf")
            part.set_payload(pdf_bytes)
            encoders.encode_base64(part)
            safe_id = req.oc_id.replace("/", "-")
            part.add_header("Content-Disposition", f'attachment; filename="OC_{safe_id}.pdf"')
            msg.attach(part)
        except Exception as e:
            logger.warning(f"No se pudo adjuntar el PDF: {e}")

    # Enviar
    all_recipients = to_list + cc_list
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(smtp_user, smtp_pass)
            smtp.sendmail(smtp_user, all_recipients, msg.as_string())

        logger.info(f"✉️  OC {req.oc_id} enviada a {all_recipients}")
        return EnviarOCResponse(
            ok=True,
            message=f"Email enviado correctamente a {len(all_recipients)} destinatario(s)",
            destinatarios=all_recipients
        )
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=401, detail="Error de autenticación SMTP. Verifica EMAIL_USER y EMAIL_PASSWORD.")
    except smtplib.SMTPRecipientsRefused as e:
        raise HTTPException(status_code=400, detail=f"Correo rechazado por el servidor: {e}")
    except Exception as e:
        logger.error(f"Error enviando email OC {req.oc_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al enviar el correo: {str(e)}")
