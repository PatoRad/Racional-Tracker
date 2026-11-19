# Racional Tracker 2.0 — Base aislada de finanzas personales

Prototipo funcional de la **Etapa 1**, construido sin modificar el cliente ni las reglas de producción de Racional Tracker.

## Ejecución

1. Abrir `index.html` en el navegador después de extraer todos los archivos de esta carpeta (o servir la carpeta con un servidor HTTP estático local).
2. Abrir menú lateral `☰` para navegar entre Inicio, Cuentas, Estadísticas, Reportes, Ahorros e Inversiones.
3. Registrar ingresos, gastos, transferencias e intereses de prueba; crear una cuenta adicional; editar y eliminar movimientos; filtrar por cuenta, cambiar mes y exportar CSV.
4. Recargar para volver a cargar el estado inicial. **No introducir datos financieros reales:** el prototipo es efímero y no ofrece respaldo persistente.

## Seguridad y límites

- No incluye Firebase SDK, claves ni consultas de red; CSP restringe conexiones (`connect-src 'none'`).
- Los valores iniciales son ficticios y se almacenan únicamente en la memoria de la pestaña; se pierden al recargar.
- Solo CLP enteros en esta etapa. Las inversiones reales están expresamente desconectadas y no se agregan al patrimonio ficticio.
- El motor contable comparte reglas para saldo y reportes. Las transferencias afectan dos cuentas pero no ingresos/gastos.
- `finance-repository.js` define contrato de lectura/commit con revisión: una futura integración con Firestore usará otro adaptador tras implementar reglas y pruebas de seguridad.
- Las fuentes futuras `bank_import` y `bank_api` exigen `provider` y `externalId` para deduplicar. **No hay conexión bancaria ni consentimiento de terceros implementados.**
- Para producción faltan persistencia segura, autorización, respaldo, conciliación, conexión con inversiones, soporte USD/FX, pruebas de integración y accesibilidad adicionales.

## Pruebas

Con Node.js >= 18:

```
node --test tests/*.test.cjs
```

Las pruebas usan datos sintéticos y no acceden a cuentas ni servicios remotos.

## Protección de main

Esta base se trabaja en `feature/tracker-2-finanzas-preview`. No modificar `main`, reglas de Firestore de producción, documentos de inversiones ni implementar merge/despliegue sin aprobación y validación completa. Si se publica una previsualización, debe estar aislada y no apuntar a la base de datos real.
