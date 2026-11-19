/* Sesión privada para Racional Tracker 2.0: sin credenciales privadas en el cliente. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;else root.Tracker2Live=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const FIREBASE_PUBLIC_CONFIG=Object.freeze({
 apiKey:'AIzaSyCQpz0nRrB--a3d4obYsDeHGkvq4BXWuo4',
 authDomain:'contabilidad-4f074.firebaseapp.com',projectId:'contabilidad-4f074',
 storageBucket:'contabilidad-4f074.firebasestorage.app',messagingSenderId:'741866902877',
 appId:'1:741866902877:web:191716e734a4793b40c4b4'
});
let auth=null,unsubscribe=null,generation=0;
const ERRORS=Object.freeze({
 'auth/unauthorized-domain':'Este dominio no está autorizado en Firebase Authentication.',
 'auth/popup-blocked':'Permite ventanas emergentes para iniciar sesión.',
 'auth/network-request-failed':'No hay conexión. Comprueba tu red antes de reintentar.',
 'permission-denied':'Firestore rechazó el acceso. No se guardaron los cambios.',
 'unavailable':'No fue posible leer datos desde el servidor. Intenta más tarde.',
 'failed-precondition':'No es posible verificar el estado de la base de datos.'
});
function message(error){const code=typeof error?.code==='string'&&/^[a-zA-Z][a-zA-Z0-9/-]{0,80}$/.test(error.code)?error.code:'';return ERRORS[code]||'No se pudo completar el acceso seguro ('+(code||'error no identificado')+').';}
function isAuthorized(user,claims){return !!(user?.uid&&user.emailVerified===true&&claims?.trackerAccess===true&&claims?.firebase?.sign_in_provider==='google.com');}
async function start({onSignedOut,onLoading,onForbidden,onReady,onError}){
 if(!root.firebase?.auth||!root.firebase?.firestore||!root.firebase?.appCheck||!root.FinanceFirestore||!root.FinanceCore)throw Error('Dependencias de acceso privado no disponibles');
 const cfg=root.RACIONAL_CONFIG;
 if(!cfg?.appCheckSiteKey||cfg.requireAppCheck!==true)throw Error('App Check sin configuración segura');
 if(!root.firebase.apps?.length)root.firebase.initializeApp(FIREBASE_PUBLIC_CONFIG);
 else if(root.firebase.app().options.projectId!==FIREBASE_PUBLIC_CONFIG.projectId)throw Error('Proyecto Firebase inesperado');
 root.firebase.appCheck().activate(new root.firebase.appCheck.ReCaptchaEnterpriseProvider(cfg.appCheckSiteKey),true);
 auth=root.firebase.auth();
 await auth.setPersistence(root.firebase.auth.Auth.Persistence.SESSION);
 if(unsubscribe)unsubscribe();
 unsubscribe=auth.onAuthStateChanged(async user=>{
  const epoch=++generation;onSignedOut('Inicia sesión con tu cuenta de Google autorizada.');
  if(!user)return;onLoading();
  try{
   const token=await user.getIdTokenResult(true);
   if(epoch!==generation)return;
   if(!isAuthorized(user,token.claims)){onForbidden('Esta cuenta Google no está autorizada para Racional Tracker, o falta verificar su correo.');return;}
   const repo=root.FinanceFirestore.createFirestoreRepository({db:root.firebase.firestore(),core:root.FinanceCore,user:{uid:user.uid,emailVerified:true,trackerAccess:true,providerId:'google.com'}});
   const snapshot=await repo.read();
   if(epoch!==generation)return;
   onReady(repo,snapshot,{uid:user.uid});
  }catch(error){if(epoch===generation)onError(message(error));}
 },error=>{generation++;onError(message(error));});
}
async function login(){if(!auth)throw Error('Firebase aún no está preparado');const provider=new root.firebase.auth.GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return auth.signInWithPopup(provider);}
async function signOut(){if(!auth)throw Error('Firebase aún no está preparado');generation++;return auth.signOut();}
return Object.freeze({start,login,signOut,isAuthorized,message});
});