'use strict';
(async function () {
  const el = id => document.getElementById(id);
  const status = (id, text) => { el(id).textContent = text; };
  const authFailure = error => {
    // Only render known codes and our own text, never SDK messages/customData.
    const hints = {
      'auth/unauthorized-domain': 'Falta autorizar el dominio de esta página en Authentication.',
      'auth/popup-blocked': 'El navegador bloqueó la ventana. Permite ventanas emergentes para esta página.',
      'auth/popup-closed-by-user': 'La ventana se cerró antes de completar Google. Reintenta y mantenla abierta.',
      'auth/cancelled-popup-request': 'Había otra ventana de acceso abierta. Ciérrala y reintenta una sola vez.',
      'auth/operation-not-allowed': 'Comprueba que Google esté habilitado en Authentication.',
      'auth/network-request-failed': 'No se pudo conectar. Comprueba la conexión y las extensiones del navegador.',
      'auth/invalid-api-key': 'La configuración de la clave de API necesita revisión.',
      'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'La configuración de la clave de API necesita revisión.',
      'auth/invalid-app-credential': 'La credencial de aplicación no fue aceptada. Necesitamos revisar App Check.',
      'auth/internal-error': 'Firebase devolvió un error interno. Necesitamos revisar la configuración.'
    };
    return Object.prototype.hasOwnProperty.call(hints, error?.code)
      ? 'No se completó el acceso (' + error.code + '). ' + hints[error.code]
      : 'No se completó el acceso (error no identificado). Requiere diagnóstico adicional.';
  };
  let generation = 0;
  const clear = () => {
    generation++;
    status('identity', 'Sin sesión');
    status('permission', 'Sin comprobar');
  };
  try {
    const config = window.RACIONAL_CONFIG;
    if (!config || !config.appCheckSiteKey || config.requireAppCheck !== true) {
      throw new Error('missing-config');
    }
    firebase.initializeApp({
      apiKey: 'AIzaSyCQpz0nRrB--a3d4obYsDeHGkvq4BXWuo4',
      authDomain: 'contabilidad-4f074.firebaseapp.com',
      projectId: 'contabilidad-4f074',
      appId: '1:741866902877:web:191716e734a4793b40c4b4'
    });
    const check = firebase.appCheck();
    check.activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(config.appCheckSiteKey), true);
    const auth = firebase.auth();
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    auth.onAuthStateChanged(async user => {
      clear();
      const current = generation;
      if (!user) return;
      try {
        const result = await user.getIdTokenResult(true);
        if (current !== generation) return;
        status('identity', 'Correo: ' + (user.email || 'Sin correo') + '\nUID: ' + user.uid);
        const google = result.claims.firebase?.sign_in_provider === 'google.com';
        status('permission', google && user.emailVerified && result.claims.trackerAccess === true
          ? 'Cuenta autorizada para Racional Tracker'
          : 'Cuenta identificada; falta autorización o verificación');
      } catch {
        if (current === generation) status('permission', 'No se pudo verificar la cuenta. Vuelve a iniciar sesión.');
      }
    }, () => { clear(); status('auth-status', 'No se pudo observar la sesión.'); });
    el('login').onclick = async () => {
      el('login').disabled = true;
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await auth.signInWithPopup(provider);
        status('auth-status', 'Inicio de sesión completado');
      } catch (error) { status('auth-status', authFailure(error)); }
      finally { el('login').disabled = false; }
    };
    el('logout').onclick = async () => {
      clear();
      try { await auth.signOut(); status('auth-status', 'Sesión cerrada'); }
      catch { status('auth-status', 'No se pudo cerrar la sesión. Cierra esta pestaña.'); }
    };
    el('check').onclick = async () => {
      el('check').disabled = true;
      status('appcheck', 'Comprobando…');
      try {
        const result = await check.getToken(true);
        status('appcheck', result && typeof result.token === 'string' && result.token.length > 0
          ? 'App Check entregó un token. La exigencia en Firestore se verifica por separado.'
          : 'App Check no entregó un token válido.');
      } catch { status('appcheck', 'App Check falló. Comprueba el dominio de esta página en la clave de sitio.'); }
      finally { el('check').disabled = false; }
    };
    for (const id of ['login', 'logout', 'check']) el(id).disabled = false;
    status('auth-status', 'Preparado. Inicia sesión con tu cuenta de propietario.');
  } catch {
    status('auth-status', 'Prueba bloqueada: falta configuración o no se pudo inicializar Firebase.');
  }
})();
