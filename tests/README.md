# Pruebas de cuentas seguras

Node >=24.12, npm y Java 21 para el emulador.
npm ci --ignore-scripts
npm test
npm run test:security

regression.test.cjs conserva cálculos/escape/validación anteriores.
account.test.cjs prueba la UI y AccountStore con servicios y DOM simulados.
helpers.cjs contiene exclusivamente identidades, registros y almacenamiento ficticios.
firestore-security.test.cjs usa el emulador demo, prueba reglas y transacciones con
el SDK real. Aborta si el host no es loopback:8088. No usa credenciales de producción.

No hay omisiones silenciosas. OAuth, App Check y producción requieren verificación
independiente: véase docs/CUENTAS_SEGURAS.md.