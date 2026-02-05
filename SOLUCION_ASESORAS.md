# 🚨 PROBLEMA IDENTIFICADO Y SOLUCIÓN

## ❌ El Problema

Has desplegado tu aplicación GCO Platform a Google Cloud Run, pero:

1. ✅ El usuario **admin/costos** SÍ ve el gestor de clientes
2. ❌ El usuario **asesora** NO ve el gestor de clientes  
3. ❌ NO se cargan los datos de Google Sheets

### ¿Por qué sucede esto?

El archivo `google_credentials.json` que permite acceder a Google Sheets:
- ✅ Existe en tu computadora local
- ❌ NO se sube a Google Cloud Run (está excluido en `.dockerignore`)
- ❌ Por lo tanto, Cloud Run no puede conectarse a Google Sheets

## ✅ La Solución

Configurar las credenciales como **variable de entorno** en Google Cloud Run.

### Pasos Rápidos:

#### 📍 PASO 1: Ve a Google Cloud Console
```
https://console.cloud.google.com/run
```

#### 📍 PASO 2: Selecciona tu servicio
- Busca: `gco-siigo-api`
- Haz clic en el servicio

#### 📍 PASO 3: Editar
- Clic en botón: **"EDITAR Y DESPLEGAR NUEVA REVISIÓN"**

#### 📍 PASO 4: Agregar Variable
1. Ve a pestaña: **"Variables y Secretos"**
2. En "Variables de Entorno", clic: **"AGREGAR VARIABLE"**
3. Configurar:
   - **Nombre**: `GOOGLE_CREDENTIALS_JSON`
   - **Valor**: 
     - Abre el archivo `backend/google_credentials.json`
     - Copia TODO el contenido (debe ser un JSON completo)
     - Pégalo en el campo Valor

#### 📍 PASO 5: Desplegar
- Clic en botón: **"DESPLEGAR"**
- Espera 2-3 minutos

#### 📍 PASO 6: Verificar
1. Ve a tu aplicación desplegada
2. Inicia sesión con usuario asesora
3. ✅ Ahora deberías ver "Gestión Clientes"
4. ✅ Los datos de clientes deberían cargarse

## 🎯 Configuración de Roles

| Rol     | ¿Ve Dashboard? | ¿Ve Gestión Clientes? | ¿Puede Editar? |
|---------|----------------|----------------------|----------------|
| admin   | ✅ Sí          | ✅ Sí                 | ✅ Sí          |
| asesora | ❌ No          | ✅ Sí (solo esto)     | ✅ Sí          |
| viewer  | ✅ Sí          | ✅ Sí                 | ❌ No          |

## 📝 Verificación Post-Deployment

### En Google Cloud Console:
```
Cloud Run → gco-siigo-api → Variables y Secretos
```
Deberías ver: `GOOGLE_CREDENTIALS_JSON` configurada

### En la Aplicación:
1. Login con usuario asesora
2. Sidebar debe mostrar: **"Gestión Clientes"**
3. Al hacer clic, debe cargar:
   - 🗺️ Mapa de Colombia con datos
   - 📊 Tabla con clientes
   - ➕ Formulario para agregar nuevos clientes

## 🔧 Troubleshooting

### Problema: Asesora no ve "Gestión Clientes" en el menú

**Solución:**
1. Dashboard → Administrar Usuarios
2. Verifica que el usuario tenga rol: `asesora`
3. Cierra sesión y vuelve a entrar

### Problema: Se muestra error al cargar datos

**Solución:**
1. Verifica logs de Cloud Run:
   ```bash
   gcloud run services logs read gco-siigo-api --region us-central1 --limit 50
   ```
2. Busca: `"Usando credenciales de GOOGLE_CREDENTIALS_JSON"`
3. Si no aparece, revisa que la variable esté bien configurada

## 📞 ¿Necesitas Ayuda?

Lee la guía completa en: `CREDENCIALES_SHEETS_GUIA.md`

---

**Nota**: Este cambio ya está implementado en el código. Solo falta configurar la variable de entorno en Cloud Run.
