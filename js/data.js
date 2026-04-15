/**
 * data.js — Store: capa de acceso crudo a localStorage.
 *
 * NOTA: Este módulo ya no es usado por services.js desde la integración
 * con Supabase. Se conserva como referencia histórica y como fallback
 * offline si se necesitara en el futuro.
 */

const Store = {
  KEYS: {
    embarcaciones: 'navi_embarcaciones',
    clientes:      'navi_clientes',
    movimientos:   'navi_movimientos',
  },

  _get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  },

  _set(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  /** Devuelve todos los registros de una colección. */
  getAll(key) {
    return this._get(key);
  },

  /** Busca un registro por id (tolerante a string/number). */
  findById(key, id) {
    return this._get(key).find(r => String(r.id) === String(id)) || null;
  },

  /** Inserta o actualiza un registro buscando por id. */
  upsert(key, record) {
    const list = this._get(key);
    const idx = list.findIndex(r => String(r.id) === String(record.id));
    if (idx !== -1) list[idx] = record;
    else list.push(record);
    this._set(key, list);
  },

  /** Elimina un registro por id. */
  remove(key, id) {
    this._set(key, this._get(key).filter(r => String(r.id) !== String(id)));
  },
};
