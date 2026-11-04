'use strict';
// Tests de reglas Firebase con EMULADOR local. No usa producción.
// Requiere instalar @firebase/rules-unit-testing y firebase-tools.
// Ejecución sugerida:
// firebase emulators:exec --only firestore "node --test tests/firestore-security.test.cjs"
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let init, assertSucceeds, assertFails, env;
let dependenciesPresent = true;
try {
  ({ initializeTestEnvironment: init, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing'));
} catch (err) {
  dependenciesPresent = false;
}
const run = dependenciesPresent ? test : test.skip;

before(async () => {
  if (!dependenciesPresent) return;
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST no configurado: se prohíbe ejecutar fuera del emulador.');
  }
  env = await init({
    projectId: 'demo-racional-security-tests',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') }
  });
});
after(async () => { if (env) await env.cleanup(); });

run('deniega lectura y escritura anónima de la colección heredada', async () => {
  const db = env.unauthenticatedContext().firestore();
  const doc = db.collection('libro').doc('fake-document');
  await assertFails(doc.get());
  await assertFails(doc.set({records: []}));
});
run('deniega a cualquier usuario la ruta heredada', async () => {
  const db = env.authenticatedContext('user-a').firestore();
  await assertFails(db.collection('libro').doc('fake-document').get());
});
run('deniega el portafolio por defecto a una sesión anónima', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(db.doc('users/user-a/portfolios/main').get());
});
run('permite lectura/escritura al propietario autenticado', async () => {
  const db = env.authenticatedContext('user-a').firestore();
  const ref = db.doc('users/user-a/portfolios/main');
  await assertSucceeds(ref.set({records: []}));
  await assertSucceeds(ref.get());
});
run('impide lectura y escritura entre usuarios', async () => {
  const db = env.authenticatedContext('user-b').firestore();
  const ref = db.doc('users/user-a/portfolios/main');
  await assertFails(ref.get());
  await assertFails(ref.set({records: []}));
});
run('rechaza documentos sin estructura esperada', async () => {
  const db = env.authenticatedContext('user-a').firestore();
  const ref = db.doc('users/user-a/portfolios/main');
  await assertFails(ref.set({other: 'value'}));
  await assertFails(ref.set({records: 'invalid'}));
});
run('no permite eliminar documentos de portafolio', async () => {
  const db = env.authenticatedContext('user-a').firestore();
  const ref = db.doc('users/user-a/portfolios/main');
  await assertSucceeds(ref.set({records: []}));
  await assertFails(ref.delete());
});
