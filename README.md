# previo_tecnologias_emergentes

Prototipo funcional de **UberBuses (TransCúcuta Inteligente)**: sistema inteligente de información, planificación de rutas, telemetría en vivo y pago electrónico (QR / NFC) para el transporte público en busetas del Área Metropolitana de Cúcuta.

## Estructura del Repositorio

- `src/`: Código fuente de la aplicación (React 18 + TypeScript + Vite + Tailwind CSS + Leaflet).
- `public/`: Manifiesto PWA, Service Worker y manuales HTML interactivos.
- `database/`: Modelo Entidad-Relación (`modelo_er.md`), script DDL (`schema.sql`) y datos de prueba (`seed.sql`).
- `documentos/`: Documentación técnica profesional, manual de usuario ilustrado con Playwright, banco de preguntas y detalle de arquitectura (Normas APA).
- `presentacion/`: Diapositivas en HTML (`index.html`) con capturas en vista móvil.

## Ejecución Local

```bash
npm install
npm run dev
```

Para compilar la versión de producción:

```bash
npm run build
```
