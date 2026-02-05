# 🔧 Guía de Solución: Credenciales de Google Sheets en Producción

## 📋 Resumen del Problema

El sistema GCO Platform desplegado en Google Cloud Run **NO PUEDE CARGAR DATOS DE CLIENTES** porque:

1. ✅ El archivo `google_credentials.json` existe localmente
2. ❌ Este archivo está excluido del deployment (`.dockerignore`)
3. ❌ Cloud Run no tiene acceso a las credenciales de Google Sheets
4. ❌ Por lo tanto, las asesoras y otros usuarios no ven datos de clientes

## ✅ Solución Implementada

Hemos modificado el servicio de Google Sheets para soportar **dos modos de autenticación**:

- **Modo Desarrollo (Local)**: Usa el archivo `google_credentials.json`
- **Modo Producción (Cloud Run)**: Usa la variable de entorno `GOOGLE_CREDENTIALS_JSON`

## 🚀 Pasos para Configurar en Google Cloud Run

### Opción 1: Consola Web de Google Cloud (Recomendado)

1. **Abrir Google Cloud Console**
   - Ir a: https://console.cloud.google.com/run
   - Seleccionar el proyecto correcto

2. **Seleccionar el servicio**
   - Buscar y hacer clic en el servicio: `gco-siigo-api`

3. **Editar y Desplegar Nueva Revisión**
   - Hacer clic en el botón "EDITAR Y DESPLEGAR NUEVA REVISIÓN"

4. **Configurar Variable de Entorno**
   - Ir a la pestaña "Variables y Secretos"
   - En la sección "Variables de Entorno", hacer clic en "AGREGAR VARIABLE"
   - **Nombre**: `GOOGLE_CREDENTIALS_JSON`
   - **Valor**: Abrir el archivo `backend/google_credentials.json` en un editor de texto y copiar TODO su contenido (debe ser un JSON válido)

5. **Desplegar**
   - Hacer clic en "DESPLEGAR"
   - Esperar a que el deployment termine (puede tardar 2-3 minutos)

6. **Verificar**
   - Ir a la aplicación web desplegada
   - Iniciar sesión con el usuario de asesora
   - Verificar que ahora se cargan los datos de clientes

### Opción 2: Google Cloud SDK (gcloud CLI)

Si tienes instalado Google Cloud SDK en tu computadora:

1. **Ejecutar el Script de PowerShell**
   ```powershell
   cd backend
   .\setup_cloud_credentials.ps1
   ```

2. **Copiar el Comando Generado**
   - El script generará el comando necesario y lo copiará al portapapeles

3. **Ejecutar el Comando**
   - Abrir PowerShell o CMD
   - Pegar y ejecutar el comando

4. **Verificar el Deployment**
   - Esperar unos minutos
   - Probar la aplicación

## 🔍 Verificación Post-Deployment

### 1. Verificar que la Variable Está Configurada

En Google Cloud Console:
- Cloud Run > gco-siigo-api > Variables y Secretos
- Debe aparecer `GOOGLE_CREDENTIALS_JSON` con el valor configurado

### 2. Ver Logs de Cloud Run

```bash
gcloud run services logs read gco-siigo-api --region us-central1 --limit 50
```

Buscar en los logs:
- ✅ `"✓ Usando credenciales de GOOGLE_CREDENTIALS_JSON (variable de entorno)"`
- ❌ `"❌ NO SE ENCONTRARON CREDENCIALES DE GOOGLE SHEETS"`

### 3. Probar la Aplicación

1. Ir a la URL desplegada
2. Iniciar sesión con usuario asesora
3. Ir a "Gestión Clientes"
4. Verificar que:
   - Se carga el mapa de Colombia con datos
   - Se pueden ver clientes en la tabla
   - Se puede registrar un nuevo cliente

## 📝 Usuarios de Prueba

### Usuario Administrador (Costos)
- **Email**: costos@ritualbotanico.com
- **Permisos**: Acceso completo a todo el sistema

### Usuario Asesora
- **Email**: [configurar en el sistema de usuarios]
- **Permisos**: Solo puede ver y registrar clientes

## 🔐 Roles y Permisos Configurados

| Rol      | Dashboard | Gestión Clientes | Inventarios | Transporte | Usuarios |
|----------|-----------|------------------|-------------|------------|----------|
| admin    | ✅         | ✅                | ✅           | ✅          | ✅        |
| asesora  | ❌         | ✅ (solo clientes)| ❌           | ❌          | ❌        |
| viewer   | ✅         | ✅ (solo lectura) | ✅ (lectura) | ✅ (lectura)| ❌        |

## 🐛 Troubleshooting

### Problema: Asesora no ve el menú de Gestión Clientes

**Posibles Causas:**
1. El rol del usuario no está configurado correctamente
2. El token JWT no tiene el rol correcto

**Solución:**
1. Ir a Dashboard > Administrar Usuarios
2. Verificar que el usuario tenga rol "asesora"
3. Cerrar sesión y volver a iniciar

### Problema: Se muestra "No encontramos coincidencias" en clientes

**Posibles Causas:**
1. Las credenciales de Google Sheets no están configuradas en Cloud Run
2. Error de conectividad con Google Sheets

**Solución:**
1. Verificar los logs de Cloud Run (ver sección de verificación)
2. Asegurarse de que la variable `GOOGLE_CREDENTIALS_JSON` esté configurada
3. Verificar que el archivo compartido de Google Sheets tenga los permisos correctos

### Problema: Error 500 al cargar clientes

**Posibles Causas:**
1. JSON de credenciales malformado
2. Cuenta de servicio sin permisos

**Solución:**
1. Verificar que el JSON copiado sea válido
2. Ir a Google Cloud Console > IAM & Admin > Service Accounts
3. Verificar que la cuenta de servicio tenga acceso al Spreadsheet

## 📞 Siguiente Paso

Una vez configurada la variable de entorno:
1. **Redesplegar** si usaste la consola web
2. **Esperar** unos minutos a que Cloud Run actualice
3. **Probar** la aplicación con el usuario asesora
4. **Verificar** que los datos de clientes se cargan correctamente

## 🎯 Checklist de Deployment

- [ ] Variable `GOOGLE_CREDENTIALS_JSON` configurada en Cloud Run
- [ ] Servicio redesplegado exitosamente
- [ ] Logs muestran "✓ Usando credenciales de GOOGLE_CREDENTIALS_JSON"
- [ ] Asesoras pueden iniciar sesión
- [ ] Asesoras ven el menú "Gestión Clientes"
- [ ] Los datos de clientes se cargan en la tabla
- [ ] El mapa de Colombia muestra datos
- [ ] Se pueden registrar nuevos clientes

---

**Última actualización**: 2026-02-05
**Versión**: 1.0
