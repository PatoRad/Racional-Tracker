// Lista explícita para no iniciar por accidente las pruebas que requieren emulador.
const {spawnSync}=require('node:child_process');const path=require('node:path');
const names=['finance-core.test.cjs','finance-extended.test.cjs','finance-firestore.test.cjs','finance-repository.test.cjs','finance-session.test.cjs'];
const result=spawnSync(process.execPath,['--test',...names.map(n=>path.join(__dirname,n))],{stdio:'inherit'});process.exit(result.status??1);
