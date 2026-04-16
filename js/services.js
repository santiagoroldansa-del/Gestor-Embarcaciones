/**
 * services.js — Capa de servicios: Supabase.
 *
 * Cada entidad tiene un par de funciones de mapeo:
 *   _xToDb(data)  — traduce nombres del frontend → columnas exactas de Supabase
 *                   Se llama ANTES de cada INSERT / UPDATE.
 *   _xFromDb(row) — traduce columnas de Supabase → nombres que espera app.js
 *                   Se llama DESPUÉS de cada SELECT.
 *
 * app.js nunca conoce los nombres internos de las columnas.
 * Si Supabase renombra una columna, solo hay que tocar los mappers.
 *
 * ─── Esquema confirmado ──────────────────────────────────────────────────────
 *  clientes     id · guarderia_id · nombre · dni_ruc · telefono · email ·
 *               direccion · saldo_actual · created_at
 *               ↳ SIN updated_at  |  frontend "dni" → DB "dni_ruc"
 *
 *  movimientos  id · guarderia_id · embarcacion_id · tipo · fecha_hora ·
 *               destino · responsable · notas · created_at
 *               ↳ frontend "fecha" → DB "fecha_hora"
 *
 *  embarcaciones  id · guarderia_id · nombre · matricula · eslora · estado ·
 *                cliente_id · categoria_id · notas · created_at
 *                ↳ frontend "propietario_id" → DB "cliente_id"
 *                ↳ "categoria_id" es UUID FK a categorias_embarcacion
 *
 *  categorias_embarcacion  id · guarderia_id · nombre · precio_base_mensual · created_at
 *
 *  cuotas_mensuales  id · guarderia_id · cliente_id · embarcacion_id · categoria_id ·
 *                    concepto · monto · monto_pagado (default 0) · periodo · estado · created_at
 *                    estado: 'pendiente' | 'parcial' | 'pagado' | 'vencido'
 *
 *  MIGRACIÓN requerida en Supabase SQL Editor:
 *    ALTER TABLE cuotas_mensuales
 *      ADD COLUMN IF NOT EXISTS monto_pagado numeric(12,2) NOT NULL DEFAULT 0;
 *    -- Retrocompatibilidad: cuotas ya pagadas sin monto_pagado
 *    UPDATE cuotas_mensuales SET monto_pagado = monto WHERE estado = 'pagado' AND monto_pagado = 0;
 *
 *  REGLA GENERAL: Ningún toDb envía updated_at ni created_at.
 *  Supabase los genera automáticamente vía DEFAULT / triggers.
 */

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://gbbpqchthvosgstysyai.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lh4Wb8A1egzw9V7ML1NP-g_U8ikMC27';

/**
 * Identificador de la guardería activa.
 * Null hasta que el usuario se autentique. AuthService.login() y
 * AuthService.checkSession() lo actualizan con session.user.id,
 * aislando automáticamente todos los queries de esta sesión.
 */
let GUARDERIA_ID = null;

// Inicializar cliente. El CDN expone window.supabase.createClient.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── UTILIDADES DE ESCRITURA ───────────────────────────────────────────────────

function _check(res) {
  if (res.error) throw new Error(res.error.message);
}

/** Campos de auditoría para INSERTs (el id lo genera Supabase). */
function _metaNuevo() {
  return {
    guarderia_id: GUARDERIA_ID,
    created_at:   new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  };
}

/** Campos de auditoría para UPDATEs. */
function _metaUpdate() {
  return { updated_at: new Date().toISOString() };
}

// ── MAPPERS: CLIENTES ─────────────────────────────────────────────────────────
//
// Diferencias:
//   • "dni"        (frontend)  ↔  "dni_ruc"     (DB)
//   • "updated_at" no existe en la tabla → se descarta en toDb
//   • "saldo_actual" solo existe en DB   → pasa transparente en fromDb

/**
 * Convierte un objeto del frontend al formato de columnas de la tabla `clientes`.
 * Descarta updated_at y created_at: la tabla no tiene updated_at y Supabase
 * genera created_at automáticamente vía DEFAULT.
 */
function _clienteToDb(data) {
  const { dni, updated_at, created_at, ...rest } = data;  // eslint-disable-line no-unused-vars
  const out = { ...rest };
  if (dni !== undefined) out.dni_ruc = dni;
  return out;
}

/**
 * Convierte una fila de `clientes` (Supabase) al formato que usa app.js.
 * "saldo_actual" no se traduce (no tiene equivalente en el form aún),
 * pero queda en el objeto por si se necesita en el futuro.
 */
function _clienteFromDb(row) {
  if (!row) return null;
  const { dni_ruc, ...rest } = row;
  const out = { ...rest };
  if (dni_ruc !== undefined) out.dni = dni_ruc;
  return out;
}

// ── MAPPERS: MOVIMIENTOS ──────────────────────────────────────────────────────
//
// Diferencias:
//   • "fecha"      (frontend)  ↔  "fecha_hora"  (DB)

function _movimientoToDb(data) {
  const { fecha, updated_at, created_at, ...rest } = data;  // eslint-disable-line no-unused-vars
  const out = { ...rest };
  if (fecha !== undefined) out.fecha_hora = fecha;
  return out;
}

function _movimientoFromDb(row) {
  if (!row) return null;
  const { fecha_hora, ...rest } = row;
  const out = { ...rest };
  if (fecha_hora !== undefined) out.fecha = fecha_hora;
  return out;
}

// ── MAPPERS: CATEGORÍAS ──────────────────────────────────────────────────────
//
// Sin diferencias de nombre de columna; solo se descartan timestamps para
// que Supabase no rechace el INSERT/UPDATE con "column does not exist".
// precio_base_mensual pasa de forma transparente en ambas direcciones.

function _categoriaToDb(data) {
  // eslint-disable-next-line no-unused-vars
  const { updated_at, created_at, ...rest } = data;
  // nombre y precio_base_mensual pasan directamente en `rest`
  return rest;
}

function _categoriaFromDb(row) {
  if (!row) return null;
  // precio_base_mensual está presente en la fila de DB; pasa sin transformar
  return { ...row };
}

// ── MAPPERS: EMBARCACIONES ────────────────────────────────────────────────────
//
// Diferencias confirmadas:
//   • "propietario_id" (frontend)  ↔  "cliente_id"   (DB)
//   • "tipo"           (frontend, texto)  →  no tiene columna propia aún.
//     La tabla espera UUID en "categoria_id"; hasta que exista la gestión de
//     categorías se serializa como "[Tipo] notas..." dentro del campo `notas`
//     para no perder el dato. _embarcacionFromDb lo recupera al leer.

// Diferencias:
//   • "propietario_id" (frontend)  ↔  "cliente_id"  (DB)
//   • "categoria_id"  — UUID FK a categorias_embarcacion; pasa directo
//   • El nombre de la categoría se resuelve en el UI vía CategoriasService
//
// MIGRACIÓN: barcos anteriores tienen "[Tipo] notas..." en el campo notas.
// El usuario debe limpiarlos y asignar categoría al editar por primera vez.

function _embarcacionToDb(data) {
  const { propietario_id, updated_at, created_at, ...rest } = data;  // eslint-disable-line no-unused-vars
  const out = { ...rest };
  if (propietario_id !== undefined) out.cliente_id = propietario_id || null;
  // categoria_id llega como UUID desde el select de categorías; pasa directo
  return out;
}

function _embarcacionFromDb(row) {
  if (!row) return null;
  const { cliente_id, ...rest } = row;
  const out = { ...rest };
  if (cliente_id !== undefined) out.propietario_id = cliente_id;
  // categoria_id pasa como UUID; el nombre se resuelve en renderEmbarcaciones()
  return out;
}

// ── SERVICIO: EMBARCACIONES ───────────────────────────────────────────────────

const EmbarcacionesService = {
  async getAll() {
    const res = await db
      .from('embarcaciones')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .order('created_at', { ascending: false });
    _check(res);
    return res.data.map(_embarcacionFromDb);
  },

  async getById(id) {
    const res = await db
      .from('embarcaciones')
      .select('*')
      .eq('id', id)
      .single();
    _check(res);
    return _embarcacionFromDb(res.data);
  },

  async save(data) {
    const { id, ...fields } = data;

    if (!id) {
      const dbData = _embarcacionToDb({ ...fields, ..._metaNuevo() });
      const res = await db
        .from('embarcaciones')
        .insert(dbData)
        .select()
        .single();
      _check(res);
      return _embarcacionFromDb(res.data);
    }

    const dbData = _embarcacionToDb({ ...fields, ..._metaUpdate() });
    const res = await db
      .from('embarcaciones')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();
    _check(res);
    return _embarcacionFromDb(res.data);
  },

  async delete(id) {
    const res = await db
      .from('embarcaciones')
      .delete()
      .eq('id', id);
    _check(res);
  },

  /**
   * Side-effect interno: actualiza solo `estado`.
   * No lanza error para no revertir el movimiento ya guardado.
   */
  async _actualizarEstado(embarcacionId, estado) {
    if (!embarcacionId) return;
    const res = await db
      .from('embarcaciones')
      .update({ estado, ..._metaUpdate() })
      .eq('id', String(embarcacionId));
    if (res.error) {
      console.warn('[_actualizarEstado]', res.error.message);
    }
  },
};

// ── SERVICIO: PROPIETARIOS SECUNDARIOS ───────────────────────────────────────
//
// Tabla: propietarios_secundarios (id · guarderia_id · embarcacion_id · cliente_id · created_at)
// Cada fila asocia un copropietario a una embarcación.
// El Titular Principal siempre es embarcaciones.cliente_id.

const PropietariosSecundariosService = {
  /**
   * Devuelve todos los copropietarios de la guardería en una sola consulta.
   * Returns: [{ embarcacion_id, cliente_id }, ...]
   */
  async getAllByGuarderia() {
    const res = await db
      .from('propietarios_secundarios')
      .select('embarcacion_id, cliente_id')
      .eq('guarderia_id', GUARDERIA_ID);
    if (res.error) return [];
    return res.data;
  },

  /**
   * Devuelve los IDs de clientes copropietarios de una embarcación.
   */
  async getByEmbarcacion(embarcacionId) {
    const res = await db
      .from('propietarios_secundarios')
      .select('cliente_id')
      .eq('embarcacion_id', embarcacionId)
      .eq('guarderia_id', GUARDERIA_ID);
    if (res.error) return [];
    return res.data.map(r => r.cliente_id);
  },

  /**
   * Reemplaza los copropietarios de una embarcación con la lista dada.
   * Primero borra los existentes, luego inserta los nuevos.
   */
  async setForEmbarcacion(embarcacionId, clienteIds) {
    const delRes = await db
      .from('propietarios_secundarios')
      .delete()
      .eq('embarcacion_id', embarcacionId)
      .eq('guarderia_id', GUARDERIA_ID);
    if (delRes.error) throw new Error(delRes.error.message);

    if (!clienteIds || clienteIds.length === 0) return;

    const rows = clienteIds.map(cid => ({
      guarderia_id:   GUARDERIA_ID,
      embarcacion_id: embarcacionId,
      cliente_id:     cid,
      created_at:     new Date().toISOString(),
    }));
    const insRes = await db
      .from('propietarios_secundarios')
      .insert(rows);
    if (insRes.error) throw new Error(insRes.error.message);
  },
};

// ── SERVICIO: CLIENTES ────────────────────────────────────────────────────────

const ClientesService = {
  async getAll() {
    const res = await db
      .from('clientes')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .order('created_at', { ascending: false });
    _check(res);
    return res.data.map(_clienteFromDb);
  },

  async getById(id) {
    const res = await db
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();
    _check(res);
    return _clienteFromDb(res.data);
  },

  async save(data) {
    const { id, ...fields } = data;

    if (!id) {
      // _clienteToDb también descarta updated_at que _metaNuevo() incluye
      const dbData = _clienteToDb({ ...fields, ..._metaNuevo() });
      const res = await db
        .from('clientes')
        .insert(dbData)
        .select()
        .single();
      _check(res);
      return _clienteFromDb(res.data);
    }

    // _clienteToDb descarta updated_at (la tabla no tiene esa columna)
    const dbData = _clienteToDb({ ...fields, ..._metaUpdate() });
    const res = await db
      .from('clientes')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();
    _check(res);
    return _clienteFromDb(res.data);
  },

  async delete(id) {
    const res = await db
      .from('clientes')
      .delete()
      .eq('id', id);
    _check(res);
  },
};

// ── SERVICIO: MOVIMIENTOS ─────────────────────────────────────────────────────

const MovimientosService = {
  async getAll() {
    const res = await db
      .from('movimientos')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .order('fecha_hora', { ascending: false }); // columna real en DB
    _check(res);
    return res.data.map(_movimientoFromDb);
  },

  async getById(id) {
    const res = await db
      .from('movimientos')
      .select('*')
      .eq('id', id)
      .single();
    _check(res);
    return _movimientoFromDb(res.data);
  },

  /**
   * Crea o actualiza un movimiento.
   * Side-effect: actualiza el estado de la embarcación según el tipo.
   *
   * NOTA: Las dos operaciones no son atómicas. Para atomicidad real,
   * usar una Supabase DB Function y reemplazar por:
   *   await db.rpc('registrar_movimiento', { p_movimiento: dbData })
   */
  async save(data) {
    const { id, ...fields } = data;
    let record;

    if (!id) {
      const dbData = _movimientoToDb({ ...fields, ..._metaNuevo() });
      const res = await db
        .from('movimientos')
        .insert(dbData)
        .select()
        .single();
      _check(res);
      record = _movimientoFromDb(res.data); // record.fecha ya está traducido
    } else {
      const dbData = _movimientoToDb({ ...fields, ..._metaUpdate() });
      const res = await db
        .from('movimientos')
        .update(dbData)
        .eq('id', id)
        .select()
        .single();
      _check(res);
      record = _movimientoFromDb(res.data);
    }

    // Side-effect: sincronizar estado de la embarcación
    const estadoMap = {
      'Entrada':       'En Puerto',
      'Salida':        'En Mar',
      'Mantenimiento': 'En Mantenimiento',
    };
    const nuevoEstado = estadoMap[record.tipo];
    if (nuevoEstado && record.embarcacion_id) {
      await EmbarcacionesService._actualizarEstado(record.embarcacion_id, nuevoEstado);
    }

    return record;
  },

  async delete(id) {
    const res = await db
      .from('movimientos')
      .delete()
      .eq('id', id);
    _check(res);
  },
};

// ── SERVICIO: CATEGORÍAS ─────────────────────────────────────────────────────

const CategoriasService = {
  async getAll() {
    const res = await db
      .from('categorias_embarcacion')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .order('nombre', { ascending: true });
    _check(res);
    return res.data.map(_categoriaFromDb);
  },

  async getById(id) {
    const res = await db
      .from('categorias_embarcacion')
      .select('*')
      .eq('id', id)
      .single();
    _check(res);
    return _categoriaFromDb(res.data);
  },

  /** Crea o actualiza una categoría. No envía timestamps (los genera Supabase). */
  async save(data) {
    const { id, ...fields } = data;
    if (!id) {
      const dbData = _categoriaToDb({ ...fields, guarderia_id: GUARDERIA_ID });
      const res = await db
        .from('categorias_embarcacion')
        .insert(dbData)
        .select()
        .single();
      _check(res);
      return _categoriaFromDb(res.data);
    }
    const dbData = _categoriaToDb(fields);
    const res = await db
      .from('categorias_embarcacion')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();
    _check(res);
    return _categoriaFromDb(res.data);
  },

  async delete(id) {
    const res = await db
      .from('categorias_embarcacion')
      .delete()
      .eq('id', id);
    _check(res);
  },
};

// ── MÉTODOS DE PAGO ──────────────────────────────────────────────────────────

const MetodosPagoService = {
  async getAll() {
    const res = await db
      .from('metodos_pago')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .order('nombre', { ascending: true });
    _check(res);
    return res.data;
  },

  async save(data) {
    const payload = {
      nombre:       data.nombre,
      guarderia_id: GUARDERIA_ID,
    };
    if (data.id) {
      const res = await db.from('metodos_pago').update(payload).eq('id', data.id);
      _check(res);
    } else {
      payload.id = crypto.randomUUID();
      payload.created_at = new Date().toISOString();
      const res = await db.from('metodos_pago').insert(payload);
      _check(res);
    }
  },

  async delete(id) {
    const res = await db.from('metodos_pago').delete().eq('id', id);
    _check(res);
  },
};

// ── PAGOS EXTRA ──────────────────────────────────────────────────────────────

const PagosService = {
  /**
   * Registra un ingreso extra (no vinculado a cuota mensual).
   * Inserta en 'pagos' con cuota_id = null y decrementa saldo_actual del cliente.
   */
  async registrarExtra({ clienteId, monto, concepto, metodoPago }) {
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) throw new Error('El monto debe ser mayor a 0.');

    const pagoRes = await db.from('pagos').insert({
      guarderia_id: GUARDERIA_ID,
      cuota_id:     null,
      cliente_id:   clienteId || null,
      monto:        montoNum,
      concepto:     concepto,
      metodo_pago:  metodoPago,
      fecha_pago:   new Date().toISOString(),
      created_at:   new Date().toISOString(),
    });
    if (pagoRes.error) throw new Error(pagoRes.error.message);

    if (clienteId) {
      const cliRes = await db
        .from('clientes')
        .select('saldo_actual')
        .eq('id', clienteId)
        .single();
      if (!cliRes.error && cliRes.data) {
        const nuevo = (Number(cliRes.data.saldo_actual) || 0) - montoNum;
        await db.from('clientes').update({ saldo_actual: nuevo }).eq('id', clienteId);
      }
    }
  },

  /**
   * Devuelve todos los ingresos extra de la guardería (pagos sin cuota asociada).
   * Ordenados por fecha_pago descendente.
   */
  async getExtras() {
    const res = await db
      .from('pagos')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .is('cuota_id', null)
      .order('fecha_pago', { ascending: false });
    if (res.error) return [];
    return res.data;
  },

  /**
   * Elimina un ingreso extra (pago sin cuota_id).
   * Solo elimina si cuota_id IS NULL para no borrar pagos de cuotas.
   */
  async deleteExtra(id) {
    const res = await db
      .from('pagos')
      .delete()
      .eq('id', id)
      .eq('guarderia_id', GUARDERIA_ID)
      .is('cuota_id', null);
    _check(res);
  },

  /**
   * Devuelve todos los pagos de un cliente (cuotas + extras), ordenados
   * por fecha_pago ascendente. Usado por la Cuenta Corriente.
   */
  async getByCliente(clienteId) {
    const res = await db
      .from('pagos')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .eq('cliente_id', clienteId)
      .order('fecha_pago', { ascending: true });
    if (res.error) return [];
    return res.data;
  },

  /**
   * Devuelve los N pagos más recientes de toda la guardería (cuotas + extras).
   * Usado por el widget "Últimos Movimientos" en la pestaña Inicio.
   */
  async getRecientes(limit = 12) {
    const res = await db
      .from('pagos')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .order('fecha_pago', { ascending: false })
      .limit(limit);
    if (res.error) return [];
    return res.data;
  },

  /**
   * Suma todos los pagos registrados en la tabla 'pagos' (cuotas + extras)
   * para el período 'YYYY-MM'. Es el KPI "Recaudación Real" del Dashboard.
   */
  async getIngresosMes(periodo) {
    const inicio = `${periodo}-01T00:00:00`;
    const [y, m] = periodo.split('-').map(Number);
    const fin = m === 12
      ? `${y + 1}-01-01T00:00:00`
      : `${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00`;
    const res = await db
      .from('pagos')
      .select('monto')
      .eq('guarderia_id', GUARDERIA_ID)
      .gte('fecha_pago', inicio)
      .lt('fecha_pago', fin);
    if (res.error) return 0;
    return res.data.reduce((s, p) => s + Number(p.monto), 0);
  },

  /**
   * Suma ingresos de la tabla 'pagos' para un rango arbitrario de timestamps ISO.
   * Usado por el Dashboard cuando el filtro cubre varios meses o un rango custom.
   *
   * @param {string} desdeISO  'YYYY-MM-DDTHH:mm:ss'  (inclusive)
   * @param {string} hastaISO  'YYYY-MM-DDTHH:mm:ss'  (exclusive para periodo, inclusive para custom)
   */
  async getIngresosRango(desdeISO, hastaISO) {
    let query = db
      .from('pagos')
      .select('monto')
      .eq('guarderia_id', GUARDERIA_ID)
      .gte('fecha_pago', desdeISO);
    // Para custom usamos lte; para periodo usamos lt (el hastaISO ya es el primer día del mes sig.)
    if (hastaISO.endsWith('T23:59:59')) {
      query = query.lte('fecha_pago', hastaISO);
    } else {
      query = query.lt('fecha_pago', hastaISO);
    }
    const res = await query;
    if (res.error) return 0;
    return res.data.reduce((s, p) => s + Number(p.monto), 0);
  },

  /**
   * Devuelve un array de totales de ingresos para cada mes en el array dado.
   * Usado por el gráfico de barras del Dashboard (últimos 6 meses).
   *
   * @param {string[]} meses  Array de 'YYYY-MM' en orden cronológico
   * @returns {number[]}      Totales en el mismo orden
   */
  async getIngresosUltimosMeses(meses) {
    if (!meses.length) return [];
    const inicio = `${meses[0]}-01T00:00:00`;
    const last   = meses[meses.length - 1];
    const [ly, lm] = last.split('-').map(Number);
    const fin = lm === 12
      ? `${ly + 1}-01-01T00:00:00`
      : `${ly}-${String(lm + 1).padStart(2, '0')}-01T00:00:00`;
    const res = await db
      .from('pagos')
      .select('monto, fecha_pago')
      .eq('guarderia_id', GUARDERIA_ID)
      .gte('fecha_pago', inicio)
      .lt('fecha_pago', fin);
    if (res.error) return meses.map(() => 0);
    return meses.map(mes => {
      const [my, mm] = mes.split('-').map(Number);
      return res.data
        .filter(p => {
          const d = new Date(p.fecha_pago);
          return d.getFullYear() === my && (d.getMonth() + 1) === mm;
        })
        .reduce((s, p) => s + Number(p.monto), 0);
    });
  },
};

// ── MAPPERS: CUOTAS ──────────────────────────────────────────────────────────
//
// La columna `periodo` en Supabase es de tipo DATE (YYYY-MM-DD).
// El frontend usa el formato corto 'YYYY-MM' (value de <input type="month">).
//
//   toDb:   'YYYY-MM'    → 'YYYY-MM-01'   (primer día del mes)
//   fromDb: 'YYYY-MM-DD' → 'YYYY-MM'      (recorta el día para la UI)

function _cuotaToDb(data) {
  const { periodo, ...rest } = data;
  const out = { ...rest };
  if (periodo !== undefined) {
    // Normaliza 'YYYY-MM' → 'YYYY-MM-01'; si ya viene completo, lo deja igual.
    out.periodo = /^\d{4}-\d{2}$/.test(periodo) ? `${periodo}-01` : periodo;
  }
  return out;
}

function _cuotaFromDb(row) {
  if (!row) return null;
  const { periodo, monto_pagado, ...rest } = row;
  const out = { ...rest };
  if (periodo !== undefined) {
    // Recorta 'YYYY-MM-DD' → 'YYYY-MM' para que coincida con <input type="month">
    out.periodo = typeof periodo === 'string' ? periodo.slice(0, 7) : periodo;
  }
  // Garantiza que monto_pagado sea siempre numérico (backward-compat con filas sin columna)
  out.monto_pagado = Number(monto_pagado ?? 0);
  return out;
}

// ── SERVICIO: CUOTAS ─────────────────────────────────────────────────────────

const CuotasService = {
  async getById(id) {
    const res = await db
      .from('cuotas_mensuales')
      .select('*')
      .eq('id', id)
      .eq('guarderia_id', GUARDERIA_ID)
      .single();
    _check(res);
    return _cuotaFromDb(res.data);
  },

  /**
   * Actualiza campos editables de una cuota (concepto, monto, periodo).
   * El estado siempre se recalcula automáticamente según monto_pagado vs monto:
   *   monto_pagado == 0              → 'pendiente'
   *   0 < monto_pagado < monto       → 'parcial'
   *   monto_pagado >= monto          → 'pagado'
   */
  async update(id, data) {
    // 1. Leer monto_pagado actual para recalcular estado
    const curRes = await db
      .from('cuotas_mensuales')
      .select('monto, monto_pagado')
      .eq('id', id)
      .eq('guarderia_id', GUARDERIA_ID)
      .single();
    _check(curRes);

    const payload = {};
    if (data.concepto !== undefined) payload.concepto = data.concepto;
    if (data.monto    !== undefined) payload.monto    = data.monto;
    if (data.periodo  !== undefined) {
      // Normalizar 'YYYY-MM' → 'YYYY-MM-01' para la columna DATE
      payload.periodo = _cuotaToDb({ periodo: data.periodo }).periodo;
    }

    // 2. Recalcular estado basado en pagos acumulados
    const montoFinal  = payload.monto !== undefined ? Number(payload.monto) : Number(curRes.data.monto);
    const montoPagado = Number(curRes.data.monto_pagado ?? 0);
    if (montoPagado <= 0) {
      payload.estado = 'pendiente';
    } else if (montoPagado >= montoFinal) {
      payload.estado = 'pagado';
    } else {
      payload.estado = 'parcial';
    }

    const res = await db
      .from('cuotas_mensuales')
      .update(payload)
      .eq('id', id)
      .eq('guarderia_id', GUARDERIA_ID)
      .select()
      .single();
    _check(res);
    return _cuotaFromDb(res.data);
  },

  async delete(id) {
    // 1. Leer cuota para poder restaurar saldo_actual si tenía pagos
    const cuotaRes = await db
      .from('cuotas_mensuales')
      .select('cliente_id, monto_pagado')
      .eq('id', id)
      .eq('guarderia_id', GUARDERIA_ID)
      .maybeSingle();

    // 2. Eliminar pagos asociados (limpia la cuenta corriente de registros huérfanos)
    await db.from('pagos')
      .delete()
      .eq('cuota_id', id)
      .eq('guarderia_id', GUARDERIA_ID);

    // 3. Restaurar saldo_actual del cliente (deshacer los cobros ya registrados)
    const cuota = cuotaRes.data;
    if (cuota && cuota.cliente_id && Number(cuota.monto_pagado) > 0) {
      const cliRes = await db
        .from('clientes')
        .select('saldo_actual')
        .eq('id', cuota.cliente_id)
        .single();
      if (!cliRes.error && cliRes.data) {
        const nuevo = (Number(cliRes.data.saldo_actual) || 0) + Number(cuota.monto_pagado);
        await db.from('clientes').update({ saldo_actual: nuevo }).eq('id', cuota.cliente_id);
      }
    }

    // 4. Eliminar la cuota
    const res = await db
      .from('cuotas_mensuales')
      .delete()
      .eq('id', id)
      .eq('guarderia_id', GUARDERIA_ID);
    _check(res);
  },

  /** Devuelve todas las cuotas de la guardería, ordenadas por fecha desc. */
  async getAll() {
    const res = await db
      .from('cuotas_mensuales')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .order('created_at', { ascending: false });
    _check(res);
    return res.data.map(_cuotaFromDb);
  },

  /**
   * Suma los montos de cuotas pagadas para un período 'YYYY-MM'.
   * Usado por el dashboard para mostrar ingresos del mes actual.
   *
   * Usa rango de fechas (>= primer día, < primer día del mes siguiente)
   * porque la columna `periodo` es de tipo DATE en Supabase.
   */
  async getIngresosMes(periodo) {
    // periodo: 'YYYY-MM'
    // Suma lo efectivamente cobrado (monto_pagado) en cuotas pagadas o parciales del mes.
    const inicio   = `${periodo}-01`;
    const [y, m]   = periodo.split('-').map(Number);
    const finMes   = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const res = await db
      .from('cuotas_mensuales')
      .select('monto, monto_pagado')
      .eq('guarderia_id', GUARDERIA_ID)
      .gte('periodo', inicio)
      .lt('periodo', finMes)
      .in('estado', ['pagado', 'parcial']);
    _check(res);
    // Usa monto_pagado si existe, monto como fallback para filas anteriores a la migración
    return res.data.reduce((sum, c) => {
      const pagado = Number(c.monto_pagado ?? 0);
      return sum + (pagado > 0 ? pagado : Number(c.monto));
    }, 0);
  },

  /**
   * Registra un pago:
   *   1. Marca la cuota como 'pagado' (+ comprobante_url si se adjuntó).
   *   2. Descuenta el monto de saldo_actual del cliente.
   *   3. Inserta un registro en la tabla 'pagos'.
   *
   * @param {string} cuotaId
   * @param {{ comprobanteUrl?, montoPagado?, metodoPago? }} opts
   */
  async registrarPago(cuotaId, { comprobanteUrl = null, montoPagado, metodoPago = 'Efectivo' } = {}) {
    // 1. Leer cuota actual (incluye monto_pagado acumulado)
    const cuotaRes = await db
      .from('cuotas_mensuales')
      .select('id, monto, monto_pagado, cliente_id, concepto, estado')
      .eq('id', cuotaId)
      .eq('guarderia_id', GUARDERIA_ID)
      .single();
    _check(cuotaRes);
    const cuota = cuotaRes.data;
    if (cuota.estado === 'pagado') throw new Error('Esta cuota ya fue pagada completamente.');

    const montoTotal     = Number(cuota.monto);
    const yaAcumulado    = Number(cuota.monto_pagado ?? 0);
    const estePago       = Number(montoPagado ?? montoTotal);

    if (estePago <= 0) throw new Error('El monto a pagar debe ser mayor a 0.');

    const resta = montoTotal - yaAcumulado;
    if (estePago > resta) {
      throw new Error(
        `El monto ingresado ($${estePago.toFixed(2)}) supera el saldo restante ($${resta.toFixed(2)}).`
      );
    }

    // 2. Calcular nuevo acumulado y determinar estado
    const nuevoAcumulado = yaAcumulado + estePago;
    const nuevoEstado    = nuevoAcumulado >= montoTotal ? 'pagado' : 'parcial';

    // 3. Actualizar cuota
    const cuotaPayload = {
      monto_pagado: nuevoAcumulado,
      estado:       nuevoEstado,
    };
    if (comprobanteUrl) cuotaPayload.comprobante_url = comprobanteUrl;
    _check(await db.from('cuotas_mensuales').update(cuotaPayload).eq('id', cuotaId));

    // 4. Descontar saldo_actual del cliente solo por el monto efectivamente pagado ahora
    if (cuota.cliente_id) {
      const cliRes = await db
        .from('clientes')
        .select('saldo_actual')
        .eq('id', cuota.cliente_id)
        .single();
      if (!cliRes.error && cliRes.data) {
        const nuevo = (Number(cliRes.data.saldo_actual) || 0) - estePago;
        await db.from('clientes').update({ saldo_actual: nuevo }).eq('id', cuota.cliente_id);
      }
    }

    // 5. Insertar en tabla 'pagos' (graceful — la tabla puede no existir aún)
    const pagoRes = await db.from('pagos').insert({
      guarderia_id:    GUARDERIA_ID,
      cuota_id:        cuotaId,
      cliente_id:      cuota.cliente_id,
      monto:           estePago,
      metodo_pago:     metodoPago,
      comprobante_url: comprobanteUrl,
      fecha_pago:      new Date().toISOString(),
      created_at:      new Date().toISOString(),
    }).select().single();
    if (pagoRes.error) console.warn('[registrarPago] tabla pagos:', pagoRes.error.message);

    return { ...cuota, ...cuotaPayload };
  },

  /**
   * Sube un archivo al bucket 'facturas' de Supabase Storage y devuelve su URL pública.
   * Requiere que el bucket exista y sea público (o ajustar a signed URL si es privado).
   *
   * @param {string} cuotaId  UUID de la cuota (se usa como carpeta para organizar)
   * @param {File}   file     Archivo seleccionado por el usuario
   */
  async subirComprobante(cuotaId, file) {
    const ext  = file.name.split('.').pop();
    const path = `${GUARDERIA_ID}/${cuotaId}/${Date.now()}.${ext}`;
    const { error } = await db.storage
      .from('facturas')
      .upload(path, file, { contentType: file.type, upsert: true });
    if (error) throw new Error(error.message);
    const { data: { publicUrl } } = db.storage
      .from('facturas')
      .getPublicUrl(path);
    return publicUrl;
  },

  /**
   * Genera una cuota mensual para cada embarcación activa que tenga
   * categoría y propietario asignados, OMITIENDO las que ya existen
   * para el período dado (evita duplicados).
   *
   * Estrategia anti-duplicado (dos capas):
   *   1. Filtrado previo: consulta las embarcaciones que ya tienen cuota en
   *      este período y las excluye antes de hacer el INSERT.
   *   2. upsert con onConflict: como red de seguridad ante race conditions.
   *      Requiere restricción UNIQUE(guarderia_id, embarcacion_id, periodo)
   *      en la tabla. Si no existe la restricción, Supabase ignora el
   *      onConflict y actúa como INSERT normal (la capa 1 ya cubrió el caso).
   *
   * @param {string} periodo  Formato 'YYYY-MM'  ej: '2025-01'
   * @returns {Object[]}      Cuotas nuevas insertadas (vacío si todas existen)
   */
  async generarMensualidades(periodo) {
    // Calcular rango de fechas del mes para la consulta (columna es DATE)
    const periodoDb = /^\d{4}-\d{2}$/.test(periodo) ? `${periodo}-01` : periodo;
    const [y, m]    = periodo.split('-').map(Number);
    const finMes    = m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`;

    // Carga paralela: embarcaciones, categorías y cuotas ya existentes del período
    const [embarcaciones, categorias, existentesRes] = await Promise.all([
      EmbarcacionesService.getAll(),
      CategoriasService.getAll(),
      db.from('cuotas_mensuales')
        .select('embarcacion_id')
        .eq('guarderia_id', GUARDERIA_ID)
        .gte('periodo', periodoDb)
        .lt('periodo', finMes),
    ]);
    _check(existentesRes);

    // Set de embarcaciones que YA tienen cuota en este período
    const yaGenerados = new Set(
      existentesRes.data.map(c => String(c.embarcacion_id))
    );

    const catMap = new Map(categorias.map(c => [String(c.id), c]));

    // Solo construir cuotas para las embarcaciones que FALTAN
    const cuotas = embarcaciones
      .filter(e => e.categoria_id && e.propietario_id && !yaGenerados.has(String(e.id)))
      .map(e => {
        const cat = catMap.get(String(e.categoria_id));
        if (!cat) return null;
        return _cuotaToDb({
          guarderia_id:   GUARDERIA_ID,
          cliente_id:     e.propietario_id,
          embarcacion_id: e.id,
          categoria_id:   e.categoria_id,
          concepto:       `Mensualidad ${periodo} — ${e.nombre} (${cat.nombre})`,
          monto:          cat.precio_base_mensual,
          periodo,
          estado:         'pendiente',
        });
      })
      .filter(Boolean);

    if (cuotas.length === 0) {
      const totalCandidatos = embarcaciones.filter(e => e.categoria_id && e.propietario_id).length;
      if (totalCandidatos === 0) {
        throw new Error('No hay embarcaciones con categoría y propietario asignados.');
      }
      throw new Error(`Todas las embarcaciones (${totalCandidatos}) ya tienen cuota generada para ${periodo}.`);
    }

    // upsert como red de seguridad: si la restricción UNIQUE existe en la DB,
    // un intento duplicado concurrente no producirá error ni inserción extra.
    const res = await db
      .from('cuotas_mensuales')
      .upsert(cuotas, { onConflict: 'embarcacion_id,periodo', ignoreDuplicates: true })
      .select();
    _check(res);
    return res.data.map(_cuotaFromDb);
  },
};

// ── SERVICIO: AUTENTICACIÓN ───────────────────────────────────────────────────

const AuthService = {
  /**
   * Inicia sesión con email y contraseña.
   * Actualiza GUARDERIA_ID con el user.id del JWT, aislando todos los
   * queries de esta sesión a los datos de esa guardería.
   */
  async login(email, password) {
    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    GUARDERIA_ID = data.user.id;
    return data.user;
  },

  /**
   * Cierra la sesión activa y limpia GUARDERIA_ID.
   * Supabase borra el token del localStorage del navegador.
   */
  async logout() {
    const { error } = await db.auth.signOut();
    if (error) throw new Error(error.message);
    GUARDERIA_ID = null;
  },

  /**
   * Envía un correo de recuperación de contraseña.
   * Supabase redirige al usuario a `redirectTo` con el token en la URL.
   */
  async resetPassword(email) {
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw new Error(error.message);
  },

  /**
   * Verifica si hay una sesión persistida en el navegador.
   * Llamar una sola vez al iniciar la app (antes de mostrar cualquier UI).
   * Restaura GUARDERIA_ID si hay sesión válida.
   *
   * @returns {Object|null} user de Supabase, o null si no hay sesión.
   */
  async checkSession() {
    const { data: { session }, error } = await db.auth.getSession();
    if (error) throw new Error(error.message);
    if (session) {
      GUARDERIA_ID = session.user.id;
      return session.user;
    }
    return null;
  },
};

// ── SERVICIO: CONFIGURACIÓN ───────────────────────────────────────────────────

const ConfiguracionService = {
  /**
   * Lee la configuración de la guardería (nombre, etc.).
   * Usa maybeSingle() para no lanzar error si aún no existe el registro.
   */
  async get() {
    const res = await db
      .from('configuracion')
      .select('*')
      .eq('guarderia_id', GUARDERIA_ID)
      .maybeSingle();
    if (res.error) return null;
    return res.data;
  },

  /**
   * Guarda (crea o actualiza) la configuración de la guardería.
   * upsert sobre guarderia_id para que sea idempotente.
   */
  async save({ nombre_guarderia, direccion, telefono, cuit }) {
    const payload = { guarderia_id: GUARDERIA_ID, nombre_guarderia };
    if (direccion !== undefined) payload.direccion = direccion;
    if (telefono  !== undefined) payload.telefono  = telefono;
    if (cuit      !== undefined) payload.cuit      = cuit;
    const res = await db
      .from('configuracion')
      .upsert(payload, { onConflict: 'guarderia_id' });
    _check(res);
  },

  /**
   * Cambia la contraseña del usuario autenticado actualmente.
   * Supabase requiere que el usuario tenga una sesión válida.
   */
  async updatePassword(newPassword) {
    const { error } = await db.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },
};
