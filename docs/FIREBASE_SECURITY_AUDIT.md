# Auditoría de seguridad de Firebase / Firestore — Etapa 3

**Estado: propuesta NO desplegada.** Fecha: 2026-11-04. Rama: `audit/firebase-firestore-seguridad`.

## Alcance confirmado por el repositorio

- `index.html` incluye configuración pública del cliente Firebase y la SDK compat.
- Inicializa Firestore y lee/escribe un único documento fijo de `libro` mediante `onSnapshot` y `set({records})`.
- No implementa Firebase Authentication, selección de usuario ni aislamiento por propietario.
- La configuración real de las reglas de la base, el estado de App Check, los métodos de autenticación habilitados y los controles del hosting **no están disponibles** en los archivos examinados.
- No se inspeccionó ningún documento, usuario, credencial privada ni movimiento real. No se usaron accesos a la API de Firestore de producción.

**Conclusión:** un documento conocido y un SDK en el navegador no demuestran por sí mismos lectura/escritura pública. La exposición depende de las reglas **efectivamente desplegadas**, que no han sido verificadas. Una API key web de Firebase es normalmente pública y no debe tratarse como una contraseña.

## Material preparado

- `firestore.rules`: **modelo propuesto**, que deniega `/libro/{documentId}` y permite solo al propietario autenticado leer/crear/actualizar un portafolio en `/users/{uid}/portfolios/{portfolioId}`; niega el resto y los borrados.
- `firebase.json`: emulador Firestore local, puerto 8088, sin interfaz web.
- `tests/firestore-security.test.cjs`: casos de autorización que usan únicamente identidades y documentos ficticios.

Estas reglas no resuelven por sí solas todos los problemas: aún falta validar objetos individuales dentro de `records`, habilitar autenticación segura, proteger contra escrituras concurrentes, controlar cuotas y añadir recuperación. La autorización basada en UID presupone una identidad autenticada por Firebase, no un valor de UID escrito por el cliente.

## Advertencia de compatibilidad

**NO EJECUTAR `firebase deploy --only firestore:rules` sobre el proyecto real.** Las reglas preparadas niegan el acceso a la ruta `libro` que utiliza actualmente `index.html`. Desplegarlas sin migrar antes la app provocaría fallos de sincronización o bloqueo de acceso. Tampoco se recomienda copiar registros reales a un entorno de prueba.

## Verificación de reglas en un proyecto de prueba

Requisitos: Node.js, Firebase CLI, paquete `@firebase/rules-unit-testing` y el emulador Firestore local.

1. Trabajar en una copia aislada, sin credenciales ni asociación con el proyecto real. `firebase.json` solamente contiene configuración del emulador.
2. Instalar las dependencias de desarrollo necesarias en esa copia; no requiere introducir credenciales de producción.
3. Ejecutar el emulador y las pruebas con un identificador ficticio:

```sh
firebase emulators:exec --project demo-racional-security-tests --only firestore "node --test tests/firestore-security.test.cjs"
```

Las pruebas comprueban acceso anónimo, acceso de propietarios, aislamiento entre usuarios, estructura documental y bloqueo de borrados. Si falta `@firebase/rules-unit-testing`, la suite falla al cargar; no se permite un verde con todos los casos omitidos. Si el emulador no está activo se aborta, evitando peticiones a producción.

## Plan de adopción (no ejecutado)

1. Revisar con acceso administrativo y de solo lectura las reglas **desplegadas** del proyecto Firebase, en su consola. No copiar ni compartir documentos de usuarios.
2. Confirmar política de cuentas: una cuenta personal, varias cuentas o acceso compartido. Activar Firebase Authentication en un proyecto de ensayo.
3. Migrar la aplicación en una rama adicional a rutas por UID, con validación explícita de sesión; separar operaciones de lectura y escritura.
4. Diseñar copia de seguridad, migración y reversión. Evitar que un `set({records})` sobrescriba ediciones concurrentes; evaluar movimientos en documentos individuales.
5. Probar reglas y cliente juntos en el emulador, incluyendo conflictos, errores, autenticación y recuperación.
6. Solo después de revisión manual, aprobación explícita y backup verificado, plantear el despliegue. **Esta auditoría no cambia producción.**

## Riesgos aún abiertos

- Exposición potencial de datos si las reglas reales de `libro` permiten clientes no autorizados.
- Colisión / pérdida de actualizaciones por sobrescritura del documento completo.
- Ausencia de recuperación comprobada de la copia local.
- No se confirmó App Check ni se actualizaron dependencias externas.
- La suite original del emulador pasó en CI (7/7); la prueba de navegador con autenticación sigue pendiente.

## Validación del punto 4 — 2026-11-05

Commit original: `b3f73f5a01cac3c4823dc0399d6e141e6ad4a392`.
- [Push de la rama feature: ejecución 42113763747](https://github.com/PatoRad/Racional-Tracker/actions/runs/42113763747): ambas tareas correctas.
- [PR #1: ejecución 42113771127](https://github.com/PatoRad/Racional-Tracker/actions/runs/42113771127): 21/21 pruebas sintéticas y 7/7 del emulador, cero fallos y cero omisiones.
- Los mensajes PERMISSION_DENIED corresponden a denegaciones esperadas por assertFails. El script terminó con código 0. El emulador compiló las reglas.
- El conflicto previo Firebase 11 / rules-unit-testing 5 ya está resuelto en el commit original con Firebase 12.
- PR #1 continúa abierto, en borrador, dirigido a audit/firebase-firestore-seguridad.
- No se ejecutó localmente: este workspace no dispone de Node/npm/git. La ejecución verificable se hace en GitHub Actions, con Java 21 y proyecto demo; no se requieren credenciales Firebase.

### Corrección en rama independiente

`fix/firestore-security-validation` deriva del commit original. La suite falla si faltan dependencias o si el host no es localhost/127.0.0.1:8088. Amplía cobertura de consultas, creación y actualización entre usuarios, esquema en create/update, límite 10000/10001, inyección de role, rutas desconocidas, subcolecciones y escrituras heredadas. No cambia reglas ni el cliente.

### Evaluación de seguridad y límite de la validación

```json
{
  "score": 4,
  "summary": "Aislamiento por UID y esquema exterior comprobables en emulador; propuesta sin validar en producción.",
  "findings": [
    {
      "check": "Type Safety / Storage Abuse",
      "severity": "minor",
      "issue": "records limita la lista a 10000 elementos pero admite valores arbitrarios dentro de ella; el propietario puede corromper sus propios registros.",
      "recommendation": "Definir un esquema de movimientos y validar cada documento individual antes de adoptar las reglas."
    }
  ]
}
```

La aceptación de listas numéricas en el caso de límite documenta el contrato actual, no valida movimientos financieros. No se cambia ese contrato sin diseñar la migración. Roles y ownerId añadidos al documento se rechazan por hasOnly; la autoridad procede de request.auth.uid. No hay contadores, estados ni timestamps definidos en este modelo, por lo que no se afirma cobertura de esas propiedades. Las subcolecciones desconocidas se deniegan; los portafolios no exigen documento padre users existente, por diseño basado en UID.

### Pendiente en Firebase real (no ejecutado, fuera de este cierre)

1. Revisar las reglas efectivamente desplegadas, proveedores Auth, App Check y configuración administrativa; su estado sigue desconocido.
2. Implementar y probar inicio/cierre de sesión, expiración y rutas por UID en un entorno aislado.
3. Definir esquema por movimiento, límites de campos y estrategia frente a escrituras concurrentes.
4. Preparar backup, migración y reversión verificables antes de bloquear la ruta heredada.
5. Validar cliente y reglas juntos con datos ficticios; revisar dependencias de CI (hay avisos de deprecación).
6. Cualquier despliegue real requiere otra tarea y autorización. No desplegar estas reglas con el cliente actual.

El cierre del punto 4 cubre pruebas de la propuesta en emulador, no certifica la seguridad ni compatibilidad del Firebase real. No se leyeron datos financieros, no se modificó main, no hubo merge ni despliegue.

### Resultado de la suite ampliada

[GitHub Actions 42139532367](https://github.com/PatoRad/Racional-Tracker/actions/runs/42139532367), commit `da4ea2d7974a0350fdcb0a16e42c005020951197`, comprobado el 2026-11-05 (America/Santiago):
- firestore-emulador: 14 pruebas, 14 aprobadas, 0 fallos, 0 omitidas; salida 0.
- pruebas-sinteticas: tarea completada correctamente.
- El punto 4 queda completado para la validación de las reglas propuestas en emulador, con los límites y pendientes anteriores.
