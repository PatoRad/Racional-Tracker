(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RacionalStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const MAX_RECORDS = 10000, MAX_WRITES = 400, PAGE_SIZE = 500;
  const FIELDS = ['tipo','monto','desc','fecha','hora','clp','tc','etf','acciones','orden'];
  const ID = /^[A-Za-z0-9_-]{8,64}$/;
  const clone = value => JSON.parse(JSON.stringify(value));
  const canonical = value => JSON.stringify(value, Object.keys(value).sort());
  class AccountStore {
    constructor({db, storage, uuid, timestamp, validate, projectId, onState = () => {}}) {
      Object.assign(this, {db, storage, uuid, timestamp, validate, projectId, onState});
      this.epoch = 0; this.seq = 0; this.queue = Promise.resolve();
      this.uid = null; this.records = []; this.base = []; this.ready = false;
      this.loaded = false; this.dirty = false; this.revision = 0; this.backupFailed = false;
    }
    get key() { return 'libro:v2:' + this.projectId + ':' + this.uid + ':backup'; }
    emit(message, error = false) {
      if (this.uid && this.backupFailed && !message.includes('respaldo')) message += ' · Respaldo local no disponible; exporta JSON.';
      this.onState({records:this.records, uid:this.uid, ready:this.ready, dirty:this.dirty, message, error}); }
    validUser(user) {
      return user && user.trackerAccess === true && user.emailVerified === true && typeof user.uid === 'string' &&
        /^[A-Za-z0-9_-]{1,128}$/.test(user.uid) &&
        user.providerData?.some(provider => provider.providerId === 'google.com');
    }
    setUser(user) {
      if (this.validUser(user) && this.uid === user.uid) return;
      if (this.uid && this.dirty) this.backup(this.records);
      this.epoch++; this.seq++;
      if (this.unsubscribe) this.unsubscribe();
      this.unsubscribe = null; this.uid = null; this.meta = null;
      this.records = []; this.base = []; this.ready = false;
      this.loaded = false; this.dirty = false; this.revision = 0; this.backupFailed = false;
      this.queue = Promise.resolve();
      this.emit('Inicia sesión con Google para ver tu portafolio');
      if (!this.validUser(user)) return;
      this.uid = user.uid;
      this.meta = this.db.doc('users/' + this.uid + '/portfolios/main');
      this.movements = this.meta.collection('movements');
      const epoch = this.epoch;
      this.emit('Cargando tu portafolio…');
      this.unsubscribe = this.meta.onSnapshot({includeMetadataChanges:true},
        snapshot => { void this.load(snapshot, epoch); },
        () => {
          if (epoch !== this.epoch) return;
          this.ready = false;
          this.emit('No se pudo acceder a la nube. Tu copia local sigue disponible para exportar.', true);
        });
    }
    revisionOf(snapshot) {
      const data = snapshot.data();
      if (data === undefined) return 0;
      if (!data || Object.keys(data).sort().join(',') !== 'revision,schemaVersion' ||
          data.schemaVersion !== 2 || !Number.isSafeInteger(data.revision) || data.revision < 1) throw Error('invalid-revision');
      return data.revision;
    }
    normalize(list) {
      if (!Array.isArray(list) || list.length > MAX_RECORDS) throw Error('invalid-list');
      let nextOrder = list.reduce((m,r) => Math.max(m, Number.isSafeInteger(r?.orden) ? r.orden : -1), -1) + 1;
      const seen = new Set();
      return list.map(record => {
        if (!this.validate(record)) throw Error('invalid-movement');
        const id = record.id || this.uuid();
        if (!ID.test(id) || seen.has(id)) throw Error('invalid-id');
        seen.add(id);
        const normalized = {...record, id, hora:record.hora || '', clp:record.clp || 0,
          tc:record.tc || 0, etf:record.etf || '', acciones:record.acciones || 0,
          orden:record.orden === undefined ? nextOrder++ : record.orden};
        if (!this.validate(normalized)) throw Error('invalid-movement');
        return normalized;
      });
    }
    encode(record) {
      const data = Object.fromEntries(FIELDS.map(key => [key, record[key]]));
      const [day,month,year] = record.fecha.split('/').map(Number);
      data.fecha = this.timestamp(new Date(Date.UTC(year,month-1,day)));
      return data;
    }
    decode(doc) {
      const data = doc.data();
      if (!data || Object.keys(data).some(key => !FIELDS.includes(key)) ||
          !data.fecha || typeof data.fecha.toDate !== 'function') throw Error('invalid-data');
      const date = data.fecha.toDate();
      if (!Number.isFinite(date.getTime()) || date.getUTCHours() || date.getUTCMinutes() || date.getUTCSeconds() || date.getUTCMilliseconds()) throw Error('invalid-date');
      const fecha = [String(date.getUTCDate()).padStart(2,'0'),String(date.getUTCMonth()+1).padStart(2,'0'),date.getUTCFullYear()].join('/');
      const record = {...data,fecha,id:doc.id};
      if (!this.validate(record) || !ID.test(record.id)) throw Error('invalid-data');
      return record;
    }
    async load(snapshot, epoch = this.epoch, attempt = 0) {
      if (epoch !== this.epoch || snapshot.metadata?.hasPendingWrites || snapshot.metadata?.fromCache || this.dirty) return;
      const seq = ++this.seq;
      const meta = this.meta, movements = this.movements;
      let phase = 'metadatos';
      try {
        const revision = this.revisionOf(snapshot);
        phase = 'consulta';
        // Small queries avoid a single oversized listen target. A final sentinel
        // read detects overflow; never expose a silently truncated portfolio.
        const docs = [];
        let cursor = null;
        while (docs.length <= MAX_RECORDS) {
          const pageSize = Math.min(PAGE_SIZE, MAX_RECORDS + 1 - docs.length);
          let pageQuery = movements.limit(pageSize);
          if (cursor) pageQuery = pageQuery.startAfter(cursor);
          const page = await pageQuery.get({source:'server'});
          if (epoch !== this.epoch || seq !== this.seq || this.dirty) return;
          docs.push(...page.docs);
          if (docs.length > MAX_RECORDS) throw Error('invalid-list');
          if (page.docs.length < pageSize) break;
          cursor = page.docs[page.docs.length - 1];
        }
        if (epoch !== this.epoch || seq !== this.seq || this.dirty) return;
        phase = 'revisión';
        const check = await meta.get({source:'server'});
        if (epoch !== this.epoch || seq !== this.seq || this.dirty) return;
        if (this.revisionOf(check) !== revision) {
          if (attempt >= 2) throw Error('busy');
          return this.load(check, epoch, attempt + 1);
        }
        phase = 'validación';
        const list = docs.map(doc => this.decode(doc));
        if (list.length > MAX_RECORDS || (!revision && list.length)) throw Error('invalid-data');
        list.sort((a,b) => a.orden - b.orden || a.id.localeCompare(b.id));
        this.records = this.normalize(list); this.base = clone(this.records);
        this.revision = revision; this.ready = true; this.loaded = true;
        phase = 'pantalla';
        this.emit('✔ Sincronizado');
      } catch(error) {
        if (epoch !== this.epoch || seq !== this.seq) return;
        this.ready = false;
        const known = ['permission-denied','unauthenticated','unavailable','deadline-exceeded','resource-exhausted','failed-precondition','invalid-argument','appCheck/initial-throttle','appCheck/throttled'];
        const internal = ['invalid-revision','invalid-data','invalid-date','invalid-list','invalid-movement','invalid-id','busy'];
        const code = known.includes(error?.code) ? error.code : internal.includes(error?.message) ? error.message : ['TypeError','ReferenceError'].includes(error?.name) ? error.name : 'sin-código';
        this.emit('No se pudo verificar la nube (' + phase + ': ' + code + '). Conserva y exporta tu copia local.', true);
      }
    }
    backup(list) {
      if (!this.uid) return false;
      try {
        const previous = this.storage.getItem(this.key);
        if (previous) this.storage.setItem(this.key + ':previous', previous);
        this.storage.setItem(this.key, JSON.stringify({version:2,uid:this.uid,records:list}));
        this.backupFailed = false;
        return true;
      } catch(error) { this.backupFailed = true; return false; }
    }
    restore(previous = false) {
      if (!this.uid) throw Error('signed-out');
      const data = JSON.parse(this.storage.getItem(this.key + (previous ? ':previous' : '')));
      if (!data || data.version !== 2 || data.uid !== this.uid) throw Error('invalid-backup');
      this.records = this.normalize(data.records); this.dirty = true;
      this.emit('Respaldo recuperado localmente. Exporta JSON para conservarlo.');
    }
    signature(list) { return JSON.stringify(list.map(record => canonical(record))); }
    save(list) {
      const epoch = this.epoch, uid = this.uid;
      if (!uid) return Promise.resolve(false);
      let payload;
      try { payload = this.normalize(list); } catch(error) {
        this.emit('Movimiento inválido; no se guardó ningún cambio.', true);
        return Promise.resolve(false);
      }
      this.records = clone(payload); this.dirty = true;
      const backupOK = this.backup(payload);
      this.emit('Guardando…');
      const job = async () => {
        if (epoch !== this.epoch || uid !== this.uid) return false;
        if (!this.ready) {
          this.emit('Nube no disponible. Exporta tus cambios locales antes de recargar.', true);
          return false;
        }
        const meta = this.meta, movements = this.movements, expectedRevision = this.revision;
        const old = new Map(this.base.map(record => [record.id, record]));
        const next = new Map(payload.map(record => [record.id, record]));
        const changed = payload.filter(record => !old.has(record.id) || canonical(old.get(record.id)) !== canonical(record));
        const removed = this.base.filter(record => !next.has(record.id));
        if (changed.length + removed.length > MAX_WRITES) {
          this.emit('Esta operación supera 400 cambios. No se guardó parcialmente; exporta JSON; se necesita una migración por lotes.', true);
          return false;
        }
        if (!changed.length && !removed.length) {
          this.dirty = this.signature(this.records) !== this.signature(payload);
          this.emit(backupOK ? '✔ Sin cambios pendientes' : 'Respaldo local no disponible; exporta JSON.', !backupOK);
          return true;
        }
        try {
          await this.db.runTransaction(async tx => {
            const current = await tx.get(meta);
            if (epoch !== this.epoch || this.revisionOf(current) !== expectedRevision) throw Error('conflict');
            // Todas las lecturas preceden a las escrituras. Protege también cambios administrativos sin revisión.
            for (const record of [...changed,...removed]) {
              const doc = await tx.get(movements.doc(record.id));
              const expected = old.get(record.id);
              if (expected ? (!doc.exists || canonical(this.decode(doc)) !== canonical(expected)) : doc.exists) throw Error('conflict');
            }
            if (epoch !== this.epoch) throw Error('session-changed');
            tx.set(meta, {schemaVersion:2, revision:expectedRevision + 1});
            for (const record of changed) tx.set(movements.doc(record.id), this.encode(record));
            for (const record of removed) tx.delete(movements.doc(record.id));
          });
          if (epoch !== this.epoch) return false;
          this.revision = expectedRevision + 1; this.base = clone(payload);
          this.dirty = this.signature(this.records) !== this.signature(payload);
          this.emit(backupOK ? '✔ Guardado' : '✔ Nube guardada; respaldo local no disponible', !backupOK);
          if (!this.dirty) {
            try { await this.load(await meta.get({source:'server'}), epoch); } catch(error) { /* El guardado ya fue confirmado. */ }
          }
          return true;
        } catch(error) {
          if (epoch !== this.epoch) return false;
          this.ready = false;
          this.emit('Conflicto o error de nube. Exporta tus cambios antes de recargar.', true);
          return false;
        }
      };
      this.queue = this.queue.then(job, job);
      return this.queue;
    }
  }
  return {AccountStore, MAX_RECORDS, MAX_WRITES};
});
