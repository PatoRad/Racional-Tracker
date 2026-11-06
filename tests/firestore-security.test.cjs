'use strict';
// Tests de reglas Firebase con EMULADOR local. No usa producción.
// Requiere instalar @firebase/rules-unit-testing y firebase-tools.
// Ejecución sugerida:
// firebase emulators:exec --only firestore "node --test tests/firestore-security.test.cjs"
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { initializeTestEnvironment: init, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
let env;
const run = test;

before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('FIRESTORE_EMULATOR_HOST no configurado: se prohíbe ejecutar fuera del emulador.');
  }
  if (!/^(127\.0\.0\.1|localhost):8088$/.test(process.env.FIRESTORE_EMULATOR_HOST)) {
    throw new Error('Solo se permite el emulador local en puerto 8088.');
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

run('permite actualizar y consultar la colección del propietario', async () => {
  const db = env.authenticatedContext('owner-query').firestore();
  const ref = db.doc('users/owner-query/portfolios/main');
  await assertSucceeds(ref.set({records: []}));
  await assertSucceeds(ref.update({records: []}));
  await assertSucceeds(db.collection('users/owner-query/portfolios').get());
});
run('deniega consultas anónimas y entre usuarios', async () => {
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('other').firestore()]) {
    await assertFails(db.collection('users/owner-query/portfolios').get());
    await assertFails(db.collection('libro').get());
  }
});
run('deniega creación, actualización y borrado entre usuarios', async () => {
  const owner = env.authenticatedContext('owner-write').firestore();
  await assertSucceeds(owner.doc('users/owner-write/portfolios/existing').set({records: []}));
  const db = env.authenticatedContext('attacker').firestore();
  await assertFails(db.doc('users/owner-write/portfolios/new').set({records: []}));
  const existing = db.doc('users/owner-write/portfolios/existing');
  await assertFails(existing.update({records: []}));
  await assertFails(existing.delete());
});
run('valida estructura tanto al crear como al actualizar', async () => {
  const db = env.authenticatedContext('schema-owner').firestore();
  const existing = db.doc('users/schema-owner/portfolios/existing');
  await assertSucceeds(existing.set({records: []}));
  const invalid = [{}, {records: null}, {records: {}}, {records: [], role: 'admin'}, {records: Array(10001).fill(0)}];
  for (let i = 0; i < invalid.length; i++) {
    await assertFails(db.doc('users/schema-owner/portfolios/invalid-' + i).set(invalid[i]));
    await assertFails(existing.set(invalid[i]));
  }
  await assertFails(existing.update({role: 'admin'}));
  assert.deepEqual((await existing.get()).data(), {records: []});
});
run('acepta el límite documentado de 10000 elementos', async () => {
  const db = env.authenticatedContext('limit-owner').firestore();
  await assertSucceeds(db.doc('users/limit-owner/portfolios/main').set({records: Array(10000).fill(0)}));
});
run('deniega rutas no declaradas y subcolecciones', async () => {
  const db = env.authenticatedContext('default-owner').firestore();
  for (const path of ['users/default-owner', 'unknown/doc', 'users/default-owner/portfolios/main/private/doc']) {
    await assertFails(db.doc(path).get());
    await assertFails(db.doc(path).set({records: []}));
    await assertFails(db.doc(path).delete());
  }
});
run('deniega escrituras autenticadas sobre documentos heredados existentes', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await context.firestore().doc('libro/seed-ficticio').set({records: []});
  });
  const ref = env.authenticatedContext('legacy-user').firestore().doc('libro/seed-ficticio');
  await assertFails(ref.get());
  await assertFails(ref.update({records: []}));
  await assertFails(ref.delete());
});
