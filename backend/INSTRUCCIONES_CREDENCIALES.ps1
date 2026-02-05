# Script simple para mostrar instrucciones de configuracion de credenciales

Write-Host "=================================" -ForegroundColor Green
Write-Host "CONFIGURAR CREDENCIALES EN CLOUD" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green
Write-Host ""

# Verificar archivo
if (Test-Path "google_credentials.json") {
    Write-Host "[OK] Archivo google_credentials.json encontrado" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] No se encontro google_credentials.json" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "PASOS A SEGUIR:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Abrir Google Cloud Console:" -ForegroundColor White
Write-Host "   https://console.cloud.google.com/run" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Seleccionar servicio: gco-siigo-api" -ForegroundColor White
Write-Host ""
Write-Host "3. Clic en: EDITAR Y DESPLEGAR NUEVA REVISION" -ForegroundColor White
Write-Host ""
Write-Host "4. Ir a pestaña: Variables y Secretos" -ForegroundColor White
Write-Host ""
Write-Host "5. Agregar Variable de Entorno:" -ForegroundColor White
Write-Host "   Nombre: GOOGLE_CREDENTIALS_JSON" -ForegroundColor Yellow
Write-Host "   Valor: [copiar contenido completo de google_credentials.json]" -ForegroundColor Yellow
Write-Host ""
Write-Host "6. Clic en DESPLEGAR" -ForegroundColor White
Write-Host ""
Write-Host "=================================" -ForegroundColor Green
Write-Host ""
Write-Host "Presiona Enter para continuar..."
Read-Host
