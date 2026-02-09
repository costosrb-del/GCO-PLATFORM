# Memoria del Proyecto: GCO Platform V2

## 1. Arquitectura
- **Backend:** FastAPI (Python). Puerto 8000.
  - Se encarga de la lógica de negocio, conexión con Siigo API y Google Sheets.
  - Autenticación centralizada (`auth_router.py`).
  - Endpoints actuales: `/auth`, `/inventory`, `/movements`, `/export`.
- **Frontend:** Next.js 14+ (App Router), Tailwind CSS, Framer Motion. Puerto 3000.
  - Diseño "Enterprise" con barra lateral colapsable.
  - Componentes UI modernos (Headless UI para selectores).

## 2. Funcionalidades Clave
### 2.1 Saldos Consolidados (`/dashboard/saldos`)
- Carga inventario multi-empresa + Excel externo.
- **Reglas de Negocio:**
  - Si viene de Google Sheets, la bodega se llama "Sin Ingresar" (Antes "Bodega Libre").
  - Si se activa "Solo Productos de Venta", se filtran automáticamente las bodegas: "Bodega Principal Rionegro" y "Sin Ingresar".
  - Lista de códigos de venta definida y visible en UI.
- **Exportación:** Excel y PDF generados en Backend.

## 3. Registro de Cambios (Changelog)
- **v2.0.0 (Init):** Migración desde Streamlit. Creación de estructura Backend/Frontend.
- **v2.0.1 (UI):** Implementación de Sidebar animada y Dashboard.
- **v2.0.2 (Saldos):** Tabla de saldos con filtros avanzados y KPIs.
- **v2.0.3 (Mejoras):** Filtros colapsables, cambio de nombre "Bodega Libre" -> "Sin Ingresar", auto-selección de bodegas en filtro de venta.
- **v2.0.4 (Fix):** Corrección en Juego de Inventario para sumar stock duplicado por SKUs normalizados (7701, 7702, 7703) en todas las empresas.

## 4. Próximos Pasos
- Módulo de Movimientos (Auditoría).
- Despliegue en Google Cloud Run.
