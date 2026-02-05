# Script para configurar las credenciales de Google Sheets en Google Cloud Run
# Este script lee el archivo google_credentials.json y genera el comando necesario

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Configurar Credenciales para Cloud Run" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que el archivo de credenciales existe
if (-Not (Test-Path "google_credentials.json")) {
    Write-Host "❌ ERROR: No se encontró el archivo google_credentials.json" -ForegroundColor Red
    Write-Host "   Por favor asegúrese de que el archivo existe en el directorio del backend." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Archivo google_credentials.json encontrado" -ForegroundColor Green
Write-Host ""

# Leer el contenido del archivo JSON y eliminar saltos de línea
$credentialsJson = (Get-Content "google_credentials.json" -Raw) -replace "`r`n", "" -replace "`n", ""

Write-Host "Contenido de las credenciales preparado." -ForegroundColor Green
Write-Host ""
Write-Host "================================================================================================================" -ForegroundColor Yellow
Write-Host "OPCIÓN 1: Configurar vía Google Cloud Console (Recomendado para principiantes)" -ForegroundColor Cyan
Write-Host "================================================================================================================" -ForegroundColor Yellow
Write-Host "1. Ir a: https://console.cloud.google.com/run" -ForegroundColor White
Write-Host "2. Seleccionar el servicio: gco-siigo-api" -ForegroundColor White
Write-Host "3. Clic en 'EDITAR Y DESPLEGAR NUEVA REVISIÓN'" -ForegroundColor White
Write-Host "4. En la pestaña 'Variables y Secretos' > Variables de Entorno" -ForegroundColor White
Write-Host "5. Agregar nueva variable:" -ForegroundColor White
Write-Host "   Nombre: GOOGLE_CREDENTIALS_JSON" -ForegroundColor Yellow
Write-Host "   Valor: [copiar y pegar el contenido de google_credentials.json]" -ForegroundColor Yellow
Write-Host "6. Clic en 'DESPLEGAR'" -ForegroundColor White
Write-Host ""
Write-Host "================================================================================================================" -ForegroundColor Yellow
Write-Host "OPCIÓN 2: Configurar vía gcloud CLI" -ForegroundColor Cyan
Write-Host "================================================================================================================" -ForegroundColor Yellow
Write-Host "Ejecute el siguiente comando (requiere Google Cloud SDK instalado):" -ForegroundColor White
Write-Host ""
Write-Host "gcloud run services update gco-siigo-api --region us-central1 --update-env-vars `"GOOGLE_CREDENTIALS_JSON=$credentialsJson`"" -ForegroundColor Green
Write-Host ""
Write-Host "================================================================================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "Presione Enter para copiar el comando al portapapeles..." -ForegroundColor Cyan
Read-Host

# Intentar copiar al portapapeles
try {
    Set-Clipboard -Value "gcloud run services update gco-siigo-api --region us-central1 --update-env-vars `"GOOGLE_CREDENTIALS_JSON=$credentialsJson`""
    Write-Host "Comando copiado al portapapeles!" -ForegroundColor Green
} catch {
    Write-Host "No se pudo copiar automaticamente. Copie manualmente el comando de arriba." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Después de configurar la variable de entorno, verifique el deployment." -ForegroundColor Cyan
