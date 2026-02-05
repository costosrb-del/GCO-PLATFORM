#!/bin/bash

# Script para configurar las credenciales de Google Sheets en Google Cloud Run
# Este script lee el archivo google_credentials.json y lo configura como variable de entorno

echo "=========================================="
echo "Configurar Credenciales para Cloud Run"
echo "=========================================="
echo ""

# Verificar que el archivo de credenciales existe
if [ ! -f "google_credentials.json" ]; then
    echo "❌ ERROR: No se encontró el archivo google_credentials.json"
    echo "   Por favor asegúrese de que el archivo existe en el directorio del backend."
    exit 1
fi

echo "✓ Archivo google_credentials.json encontrado"
echo ""

# Leer el contenido del archivo JSON y eliminar saltos de línea
CREDENTIALS_JSON=$(cat google_credentials.json | tr -d '\n' | tr -d '\r')

echo "Preparando para configurar la variable de entorno en Cloud Run..."
echo ""
echo "IMPORTANTE: Ejecute el siguiente comando en Google Cloud Shell o con gcloud CLI:"
echo ""
echo "================================================================================================================"
echo "gcloud run services update gco-siigo-api \\"
echo "  --region us-central1 \\"
echo "  --update-env-vars GOOGLE_CREDENTIALS_JSON='${CREDENTIALS_JSON}'"
echo "================================================================================================================"
echo ""
echo "También puede configurarlo manualmente en la consola de Google Cloud Run:"
echo "1. Ir a Cloud Run > gco-siigo-api > Editar y Desplegar Nueva Revisión"
echo "2. En 'Variables y Secretos' > Variables de Entorno"
echo "3. Agregar nueva variable:"
echo "   Nombre: GOOGLE_CREDENTIALS_JSON"
echo "   Valor: [pegar el contenido completo del archivo google_credentials.json]"
echo ""
