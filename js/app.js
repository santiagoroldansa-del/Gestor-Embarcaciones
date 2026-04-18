/**
 * app.js — Controlador de UI.
 * Todas las operaciones de datos pasan por la capa de servicios (async/await).
 */

// ─── NAVEGACIÓN (TABS) ────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    switchTab(btn.dataset.tab);
  });
});

/**
 * Cambia la pestaña activa y carga los datos correspondientes.
 * @param {string} tabId  'inicio' | 'facturacion' | 'reportes' | 'prefectura'
 */
async function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tabId;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive);
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) panel.classList.add('active');

  if (tabId === 'inicio')      await _loadSubTab(_activeSubTab);
  if (tabId === 'facturacion') await Promise.all([renderCuotas(), renderUltimosMovimientos()]);
  if (tabId === 'reportes')    await renderDashboard();
  if (tabId === 'prefectura')  await renderPrefectura();
}

// ─── SUB-NAVEGACIÓN (dentro de Inicio) ───────────────────────────────────────

let _activeSubTab = 'flota';

/** Renderiza solo el contenido del sub-tab activo. */
async function _loadSubTab(subTabId) {
  if (subTabId === 'flota')     await Promise.all([renderEmbarcaciones()]);
  if (subTabId === 'clientes')  await Promise.all([renderClientes()]);
  if (subTabId === 'maestros')  await Promise.all([renderCategorias(), renderMetodosPago()]);
}

/** Cambia el sub-tab activo dentro de Inicio. */
async function switchSubTab(subTabId) {
  _activeSubTab = subTabId;
  document.querySelectorAll('.sub-tab-btn').forEach(b => {
    const isActive = b.dataset.subtab === subTabId;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive);
  });
  document.querySelectorAll('.sub-tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`subtab-${subTabId}`);
  if (panel) panel.classList.add('active');
  await _loadSubTab(subTabId);
}

document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    switchSubTab(btn.dataset.subtab);
  });
});

// ─── MODALES ──────────────────────────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  // Si el usuario cierra sin guardar, descarta el callback del importador
  if (id === 'modalCliente')    _importPostClienteGuardado   = null;
  if (id === 'modalCategoria')  _importPostCategoriaGuardada = null;
}

document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.modal));
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ─── HELPERS DE UI ────────────────────────────────────────────────────────────

function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}

function estadoBadge(estado) {
  const map = {
    'En Puerto':         'badge-green',
    'En Mar':            'badge-blue',
    'En Mantenimiento':  'badge-yellow',
  };
  return `<span class="badge ${map[estado] || 'badge-gray'}">${estado || '—'}</span>`;
}

function tipoBadge(tipo) {
  const map = {
    'Entrada':       'badge-green',
    'Salida':        'badge-blue',
    'Mantenimiento': 'badge-yellow',
    'Combustible':   'badge-red',
    'Otro':          'badge-gray',
  };
  return `<span class="badge ${map[tipo] || 'badge-gray'}">${tipo}</span>`;
}

function estadoCuotaBadge(estado) {
  const map = {
    'pagado':    'badge-green',
    'parcial':   'badge-parcial',
    'pendiente': 'badge-yellow',
    'vencido':   'badge-red',
  };
  const label = {
    'pagado':    'Pagado',
    'parcial':   'Parcial',
    'pendiente': 'Pendiente',
    'vencido':   'Vencido',
  };
  return `<span class="badge ${map[estado] || 'badge-gray'}">${label[estado] || escHTML(estado || '—')}</span>`;
}

function escHTML(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatMonto(n) {
  if (n == null) return '—';
  // Formato peso argentino: 1.234,56
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Normaliza texto para búsqueda: minúsculas + sin acentos. */
function normalize(str) {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Muestra fila de carga en una tabla mientras se espera el servicio. */
function setTableLoading(tbody, cols) {
  tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-row">
    <span class="spinner"></span> Cargando...
  </td></tr>`;
}

/** Muestra fila de error en una tabla. */
function setTableError(tbody, cols) {
  tbody.innerHTML = `<tr><td colspan="${cols}" class="empty-row error-row">
    No se pudieron cargar los datos. Intenta de nuevo.
  </td></tr>`;
}

/** Bloquea/desbloquea el botón submit de un formulario durante el guardado. */
function setSubmitting(btn, state) {
  btn.disabled = state;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = state ? 'Guardando...' : btn.dataset.originalText;
}

function showError(msg) {
  showToast(`Error: ${msg}`, 'error');
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ─── CONFIRMACIÓN DE ELIMINACIÓN ──────────────────────────────────────────────

let pendingDeleteFn = null;

function confirmDelete(message, onConfirm) {
  document.getElementById('confirmMessage').textContent = message;
  pendingDeleteFn = onConfirm;
  openModal('modalConfirm');
}

// El handler es async para poder awaitar el callback de eliminación.
document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
  if (!pendingDeleteFn) return;
  const fn = pendingDeleteFn;
  pendingDeleteFn = null;
  closeModal('modalConfirm');
  await fn();
});

// ─── HELPERS DE SELECTS ───────────────────────────────────────────────────────

/** Rellena un <select> con una lista de registros ya cargados. */
function fillSelect(selectId, items, labelFn, selectedId = '') {
  const sel = document.getElementById(selectId);
  sel.innerHTML = sel.dataset.placeholder
    ? `<option value="">${sel.dataset.placeholder}</option>`
    : '<option value=""></option>';
  items.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = labelFn(item);
    if (String(item.id) === String(selectedId)) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ─── PAGINACIÓN ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 5;
const _pag = { emb: 0, cli: 0 };

// Filtro de estado: 'activos' | 'todos' | 'bajas'
let _filtroEstadoCli = 'activos';
// Filtro de estado de titular para Embarcaciones: 'todos' | 'activo' | 'baja'
let _filtroEstadoEmb = 'todos';
// Texto del buscador de clientes
let _searchClientes = '';
let _searchCuotas   = '';
// ID del cliente abierto en el modal de Cuenta Corriente (para notas)
let _ccClienteId = null;
let _c360Data    = null;

// ─── ICONOS SVG (stroke, sin relleno) ────────────────────────────────────────
const ICON = {
  eye:     `<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  edit:    `<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 19.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/><path d="m15 5 3 3"/></svg>`,
  trash:   `<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
  search:  `<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  ledger:  `<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  refresh: `<svg class="btn-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
};

function _updatePaginControls(key, total) {
  const suffix = key === 'emb' ? 'Embarcaciones' : 'Clientes';
  const page   = _pag[key];
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const prevEl = document.getElementById(`prev${suffix}`);
  const nextEl = document.getElementById(`next${suffix}`);
  const infoEl = document.getElementById(`info${suffix}`);
  const pagEl  = document.getElementById(`pagin${suffix}`);
  if (!prevEl) return;
  prevEl.disabled = page === 0;
  nextEl.disabled = page >= totalPages - 1;
  if (infoEl) infoEl.textContent = total > PAGE_SIZE
    ? `Pág. ${page + 1} / ${totalPages}  (${total} total)`
    : '';
  if (pagEl) pagEl.style.display = total <= PAGE_SIZE ? 'none' : 'flex';
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

// Usuario autenticado activo (se rellena en showApp)
let _currentUser = null;

// Instancias de Chart.js — se destruyen antes de recrear para evitar errores
let _chartIngresos = null;

// ─── FILTRO DE FECHA COMPARTIDO (Facturación + Reportes) ─────────────────────

const _filtroFecha = { preset: 'todo', desde: '', hasta: '' };

/**
 * Devuelve el rango activo como { tipo, desde, hasta }.
 *   tipo: 'periodo'  → desde/hasta son 'YYYY-MM' (se compara con cuota.periodo)
 *   tipo: 'createdAt'→ desde/hasta son 'YYYY-MM-DD' (se compara con cuota.created_at)
 */
function _getRangoActivo() {
  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  if (_filtroFecha.preset === 'todo') {
    return { tipo: 'todo' };
  }
  if (_filtroFecha.preset === 'mes') {
    return { tipo: 'periodo', desde: mesActual, hasta: mesActual };
  }
  if (_filtroFecha.preset === '3m') {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 2, 1);
    return { tipo: 'periodo',
      desde: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      hasta: mesActual };
  }
  if (_filtroFecha.preset === '6m') {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1);
    return { tipo: 'periodo',
      desde: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      hasta: mesActual };
  }
  if (_filtroFecha.preset === 'ano') {
    const d = new Date(hoy.getFullYear() - 1, hoy.getMonth() + 1, 1);
    return { tipo: 'periodo',
      desde: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      hasta: mesActual };
  }
  // custom
  return { tipo: 'createdAt', desde: _filtroFecha.desde, hasta: _filtroFecha.hasta };
}

/** True si la cuota cae dentro del rango activo. */
function _cuotaMatchesFiltro(cuota) {
  const r = _getRangoActivo();
  if (r.tipo === 'todo') return true;
  if (r.tipo === 'periodo') {
    if (r.desde && cuota.periodo < r.desde) return false;
    if (r.hasta && cuota.periodo > r.hasta) return false;
  } else {
    const ca = cuota.created_at ? cuota.created_at.slice(0, 10) : '';
    if (r.desde && ca < r.desde) return false;
    if (r.hasta && ca > r.hasta) return false;
  }
  return true;
}

/** Mantiene ambos dropdowns (Facturación y Reportes) en sync con _filtroFecha. */
function _syncFiltroUI() {
  ['Cuotas', 'Dash'].forEach(tag => {
    const sel   = document.getElementById(`filtroPreset${tag}`);
    const rango = document.getElementById(`filtroRango${tag}`);
    if (!sel || !rango) return;
    sel.value = _filtroFecha.preset;
    rango.style.display = _filtroFecha.preset === 'custom' ? 'flex' : 'none';
    if (_filtroFecha.preset === 'custom') {
      const elDesde = document.getElementById(`filtroCustomDesde${tag}`);
      const elHasta = document.getElementById(`filtroCustomHasta${tag}`);
      if (elDesde) elDesde.value = _filtroFecha.desde;
      if (elHasta) elHasta.value = _filtroFecha.hasta;
    }
  });
}

/** Devuelve una etiqueta legible del rango activo para los KPIs. */
function _etiquetaRango() {
  const r = _getRangoActivo();
  const labels = { todo: 'Todos los registros', mes: 'Este mes', '3m': 'Últ. 3 meses', '6m': 'Últ. 6 meses', ano: 'Último año' };
  if (_filtroFecha.preset !== 'custom') return labels[_filtroFecha.preset] || r.desde;
  const d = r.desde || '…', h = r.hasta || '…';
  return `${d} → ${h}`;
}

/** Convierte el rango activo a timestamps ISO para consultar la tabla 'pagos'. */
function _rangoToISO() {
  const r = _getRangoActivo();
  if (r.tipo === 'todo') {
    return { desdeISO: '2000-01-01T00:00:00', hastaISO: '2099-12-31T23:59:59' };
  }
  if (r.tipo === 'periodo') {
    const desdeISO = `${r.desde}-01T00:00:00`;
    const [hy, hm] = r.hasta.split('-').map(Number);
    const hastaISO = hm === 12
      ? `${hy + 1}-01-01T00:00:00`
      : `${hy}-${String(hm + 1).padStart(2, '0')}-01T00:00:00`;
    return { desdeISO, hastaISO };
  }
  return {
    desdeISO: r.desde ? `${r.desde}T00:00:00` : '2000-01-01T00:00:00',
    hastaISO: r.hasta ? `${r.hasta}T23:59:59`  : '2099-12-31T23:59:59',
  };
}

async function renderDashboard() {
  const hoy = new Date();

  // Pre-calcular meses para el gráfico de barras (siempre últimos 6, sin filtro)
  const meses6 = [], labels6 = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses6.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    labels6.push(d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }));
  }

  // Rango activo según el filtro compartido
  const { desdeISO, hastaISO } = _rangoToISO();

  try {
    const [embs, clis, cuotas, ingresos, cats, ingresosPorMes] = await Promise.all([
      EmbarcacionesService.getAll(),
      ClientesService.getAll(),
      CuotasService.getAll(),
      PagosService.getIngresosRango(desdeISO, hastaISO),
      CategoriasService.getAll(),
      PagosService.getIngresosUltimosMeses(meses6),
    ]);

    // Aplicar el filtro de rango a las cuotas para todos los KPIs
    const cuotasFiltradas = cuotas.filter(_cuotaMatchesFiltro);

    // ── KPIs ──────────────────────────────────────────────────
    const cuotasImpagas   = cuotasFiltradas.filter(c => c.estado === 'pendiente');
    const montoImpagas    = cuotasImpagas.reduce((s, c) => s + Number(c.monto), 0);

    const cuotasParciales = cuotasFiltradas.filter(c => c.estado === 'parcial');
    const montoParcialResta = cuotasParciales.reduce((s, c) =>
      s + Math.max(0, Number(c.monto) - Number(c.monto_pagado ?? 0)), 0);

    // Morosidad = (impagas + resto parciales) / total del rango  →  %
    const montoMesImpagas    = montoImpagas;
    const montoMesParciales  = montoParcialResta;
    const totalMes           = cuotasFiltradas.reduce((s, c) => s + Number(c.monto), 0);
    const morosidad          = montoMesImpagas + montoMesParciales;
    const morosidadPct       = totalMes > 0 ? Math.round(morosidad / totalMes * 100) : 0;

    const etiqueta = _etiquetaRango();

    document.getElementById('statEmbarcaciones').textContent = embs.length;
    document.getElementById('statClientes').textContent      = clis.length;
    document.getElementById('statIngresos').textContent      = `$ ${formatMonto(ingresos)}`;
    document.getElementById('statMorosidad').textContent     = `${morosidadPct}%`;

    document.getElementById('statPendientes').textContent = `${cuotasImpagas.length}`;
    document.getElementById('subPendientes').textContent  = cuotasImpagas.length > 0
      ? `$ ${formatMonto(montoImpagas)} pendiente`
      : 'sin cuotas impagas';

    document.getElementById('statParciales').textContent = `${cuotasParciales.length}`;
    document.getElementById('subParciales').textContent  = cuotasParciales.length > 0
      ? `$ ${formatMonto(montoParcialResta)} por cobrar`
      : 'sin pagos parciales';

    if (document.getElementById('subIngresos')) {
      document.getElementById('subIngresos').textContent = etiqueta;
    }

    // ── Tooltip morosidad ─────────────────────────────────────
    const cliMapDash = new Map(clis.map(c => [String(c.id), c]));
    const tooltipEl  = document.getElementById('tooltipMorosidad');
    if (tooltipEl) {
      const todasDeudas = [
        ...cuotasImpagas.map(c  => ({ ...c, _tt: 'impaga' })),
        ...cuotasParciales.map(c => ({ ...c, _tt: 'parcial' })),
      ];

      if (todasDeudas.length === 0) {
        tooltipEl.dataset.empty = 'true';
        tooltipEl.innerHTML = '';
      } else {
        tooltipEl.dataset.empty = 'false';
        const MAX_VISIBLE = 5;
        const visibles    = todasDeudas.slice(0, MAX_VISIBLE);
        const extras      = todasDeudas.length - MAX_VISIBLE;

        const filas = visibles.map(c => {
          const cli    = cliMapDash.get(String(c.cliente_id));
          const nombre = escHTML(cli?.nombre ?? '—');
          const monto  = `$ ${formatMonto(c.monto)}`;
          const cls    = c._tt === 'impaga' ? 'tt-badge-impaga' : 'tt-badge-parcial';
          const label  = c._tt === 'impaga' ? 'Impaga' : 'Parcial';
          const periodo = escHTML(c.periodo ?? c.concepto ?? '—');
          return `<tr>
            <td>${nombre}</td>
            <td>${periodo}</td>
            <td>${monto}</td>
            <td class="${cls}">${label}</td>
          </tr>`;
        }).join('');

        const masHTML = extras > 0
          ? `<div class="kpi-tooltip-more">... y ${extras} deuda${extras > 1 ? 's' : ''} más</div>`
          : '';

        tooltipEl.innerHTML = `
          <p class="kpi-tooltip-title">Detalle de deudas (${todasDeudas.length})</p>
          <div class="kpi-tooltip-scroll">
            <table>
              <thead><tr>
                <th>Cliente</th><th>Periodo</th><th>Monto</th><th>Estado</th>
              </tr></thead>
              <tbody>${filas}</tbody>
            </table>
          </div>
          ${masHTML}`;
      }
    }

    // ── Proyección del mes ────────────────────────────────────
    const catMap      = new Map(cats.map(c => [String(c.id), c]));
    const proyectado  = embs.reduce((s, e) => {
      const cat = catMap.get(String(e.categoria_id ?? ''));
      return s + (cat ? Number(cat.precio_base_mensual ?? 0) : 0);
    }, 0);
    const eficacia      = proyectado > 0 ? Math.min(100, Math.round(ingresos / proyectado * 100)) : 0;
    const eficaciaColor = eficacia >= 80 ? '#22c55e' : '#f97316';

    document.getElementById('statProyectado').textContent     = `$ ${formatMonto(proyectado)}`;
    document.getElementById('statRecaudacionReal').textContent = `$ ${formatMonto(ingresos)}`;
    document.getElementById('proyeccionPeriodo').textContent   = etiqueta;

    const pctEl  = document.getElementById('statEficacia');
    const fillEl = document.getElementById('eficaciaFill');
    pctEl.textContent       = `${eficacia}%`;
    pctEl.style.color       = eficaciaColor;
    fillEl.style.width      = `${eficacia}%`;
    fillEl.style.background = eficaciaColor;

    // ── Tabla cuotas por cobrar (pendientes + parciales del rango) ───
    const porCobrar = cuotasFiltradas
      .filter(c => c.estado === 'pendiente' || c.estado === 'parcial')
      .sort((a, b) => a.periodo < b.periodo ? -1 : 1);

    const cliMap = new Map(clis.map(c => [String(c.id), c]));
    const tbody  = document.getElementById('dashboardCuotasBody');
    tbody.innerHTML = porCobrar.length === 0
      ? '<tr><td colspan="5" class="empty-row">Sin cuotas pendientes</td></tr>'
      : porCobrar.slice(0, 10).map(c => {
          const cli   = cliMap.get(String(c.cliente_id));
          const resta = Number(c.monto) - Number(c.monto_pagado ?? 0);
          return `<tr>
            <td>${escHTML(cli ? cli.nombre : '—')}</td>
            <td>${escHTML(c.concepto)}</td>
            <td>${escHTML(c.periodo)}</td>
            <td>${estadoCuotaBadge(c.estado)}</td>
            <td>$ ${formatMonto(resta)}</td>
          </tr>`;
        }).join('');

    // ── Gráfico barras: Ingresos últimos 6 meses (desde tabla pagos) ─────────────
    if (_chartIngresos) _chartIngresos.destroy();
    _chartIngresos = new Chart(document.getElementById('chartIngresosMes'), {
      type: 'bar',
      data: {
        labels: labels6,
        datasets: [{
          label:           'Ingresos',
          data:            ingresosPorMes,
          backgroundColor: 'rgba(16,185,129,.75)',
          borderColor:     'rgba(16,185,129,1)',
          borderRadius:    6,
          borderWidth:     0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` $ ${formatMonto(ctx.raw)}` } },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid:  { color: 'rgba(0,0,0,.05)' },
            ticks: { callback: v => `$ ${formatMonto(v)}` },
          },
          x: { grid: { display: false } },
        },
      },
    });

  } catch (err) {
    console.error('renderDashboard:', err);
    showError('No se pudo cargar el dashboard: ' + err.message);
  }
}

// ─── LISTENERS: FILTRO COMPARTIDO ────────────────────────────────────────────

// ── Helpers de estado para botones de filtro toggle ──────────
function _filterBtnActivate(btn) {
  btn.classList.add('is-active');
  btn.innerHTML = 'Aplicar <em class="btn-filter-x">×</em>';
}
function _filterBtnReset(btn) {
  btn.classList.remove('is-active');
  btn.textContent = 'Aplicar';
}

// Preset dropdowns — solo muestran/ocultan el rango custom, NO aplican
['filtroPresetCuotas', 'filtroPresetDash'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', e => {
    const tag   = id.includes('Cuotas') ? 'Cuotas' : 'Dash';
    const rango = document.getElementById(`filtroRango${tag}`);
    if (rango) rango.style.display = e.target.value === 'custom' ? 'flex' : 'none';
  });
});

// Botón Aplicar — Facturación (toggle)
document.getElementById('btnFiltrarCuotas')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnFiltrarCuotas');
  if (btn.classList.contains('is-active')) {
    // Resetear todos los filtros
    _filtroFecha.preset = 'todo';
    _filtroFecha.desde  = '';
    _filtroFecha.hasta  = '';
    document.getElementById('filtroPresetCuotas').value  = 'todo';
    _searchCuotas = '';
    const searchInput = document.getElementById('searchCuotas');
    if (searchInput) searchInput.value = '';
    document.getElementById('filtroClienteCuotas').value = '';
    document.getElementById('filtroRangoCuotas').style.display = 'none';
    _filterBtnReset(btn);
  } else {
    // Leer el preset actual del select en el momento del click
    _filtroFecha.preset = document.getElementById('filtroPresetCuotas').value;
    if (_filtroFecha.preset === 'custom') {
      _filtroFecha.desde = document.getElementById('filtroCustomDesdeCuotas').value;
      _filtroFecha.hasta = document.getElementById('filtroCustomHastaCuotas').value;
    } else {
      _filtroFecha.desde = '';
      _filtroFecha.hasta = '';
    }
    _filterBtnActivate(btn);
  }
  _syncFiltroUI();
  await Promise.all([renderCuotas(), renderDashboard()]);
});

// Botón Aplicar — Reportes (toggle)
document.getElementById('btnAplicarFiltroDash')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnAplicarFiltroDash');
  if (btn.classList.contains('is-active')) {
    // Resetear a todo
    _filtroFecha.preset = 'todo';
    _filtroFecha.desde  = '';
    _filtroFecha.hasta  = '';
    document.getElementById('filtroPresetDash').value = 'todo';
    document.getElementById('filtroRangoDash').style.display = 'none';
    _filterBtnReset(btn);
  } else {
    // Leer preset actual del select
    _filtroFecha.preset = document.getElementById('filtroPresetDash').value;
    if (_filtroFecha.preset === 'custom') {
      _filtroFecha.desde = document.getElementById('filtroCustomDesdeDash').value;
      _filtroFecha.hasta = document.getElementById('filtroCustomHastaDash').value;
    } else {
      _filtroFecha.desde = '';
      _filtroFecha.hasta = '';
    }
    _filterBtnActivate(btn);
  }
  _syncFiltroUI();
  await Promise.all([renderCuotas(), renderDashboard()]);
});

// ─── EMBARCACIONES ────────────────────────────────────────────────────────────

// ── Multiselect de copropietarios ─────────────────────────────────────────────
// Estado módulo-nivel para el multiselect del modal de embarcación.
let _msClientes  = [];        // todos los clientes disponibles
let _msSelected  = new Set(); // IDs actualmente seleccionados como copropietarios

function _msRenderTags() {
  const tagsEl = document.getElementById('copropietariosTags');
  tagsEl.innerHTML = [..._msSelected].map(id => {
    const cli = _msClientes.find(c => String(c.id) === id);
    const nombre = escHTML(cli ? cli.nombre : id);
    return `<span class="multiselect-tag">${nombre}<button type="button" class="multiselect-tag-remove" data-id="${escHTML(id)}">&times;</button></span>`;
  }).join('');
  tagsEl.querySelectorAll('.multiselect-tag-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      _msSelected.delete(btn.dataset.id);
      _msRenderTags();
      _msRenderDropdown(document.getElementById('copropietariosSearch').value);
    });
  });
}

function _msRenderDropdown(search) {
  const dropdown = document.getElementById('copropietariosDropdown');
  const titularId = document.getElementById('embPropietario').value;
  const q = (search || '').toLowerCase();
  const filtered = _msClientes.filter(c => {
    if (String(c.id) === titularId) return false; // excluir al titular principal
    return !q || c.nombre.toLowerCase().includes(q);
  });
  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="multiselect-empty">Sin coincidencias</div>';
  } else {
    dropdown.innerHTML = filtered.map(c => {
      const sel = _msSelected.has(String(c.id));
      return `<div class="multiselect-option${sel ? ' selected' : ''}" data-id="${escHTML(String(c.id))}">
        <span class="multiselect-check">${sel ? '&#10003;' : ''}</span>${escHTML(c.nombre)}
      </div>`;
    }).join('');
    dropdown.querySelectorAll('.multiselect-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const id = opt.dataset.id;
        if (_msSelected.has(id)) _msSelected.delete(id);
        else _msSelected.add(id);
        _msRenderTags();
        _msRenderDropdown(document.getElementById('copropietariosSearch').value);
      });
    });
  }
}

function _msInit(clientes, selectedIds = []) {
  _msClientes = clientes;
  _msSelected = new Set(selectedIds.map(String));
  _msRenderTags();
  const dropdown = document.getElementById('copropietariosDropdown');
  dropdown.hidden = true;
  document.getElementById('copropietariosSearch').value = '';
}

// Mostrar/ocultar dropdown al enfocar el input de búsqueda
document.getElementById('copropietariosSearch').addEventListener('focus', () => {
  const dropdown = document.getElementById('copropietariosDropdown');
  _msRenderDropdown(document.getElementById('copropietariosSearch').value);
  dropdown.hidden = false;
});
document.getElementById('copropietariosSearch').addEventListener('input', e => {
  _msRenderDropdown(e.target.value);
  document.getElementById('copropietariosDropdown').hidden = false;
});
// Cerrar dropdown al hacer clic fuera
document.addEventListener('mousedown', e => {
  const wrapper = document.getElementById('copropietariosWrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    document.getElementById('copropietariosDropdown').hidden = true;
  }
});
// Recalcular dropdown al cambiar el titular (para excluirlo de la lista)
document.getElementById('embPropietario').addEventListener('change', () => {
  // Si el titular recién elegido estaba como copropietario, quitarlo
  const titularId = document.getElementById('embPropietario').value;
  if (_msSelected.has(titularId)) {
    _msSelected.delete(titularId);
    _msRenderTags();
  }
  if (!document.getElementById('copropietariosDropdown').hidden) {
    _msRenderDropdown(document.getElementById('copropietariosSearch').value);
  }
});
// ─────────────────────────────────────────────────────────────────────────────

async function renderEmbarcaciones(filter = '') {
  const tbody = document.getElementById('tablaEmbarcaciones');
  setTableLoading(tbody, 7);
  try {
    const [embarcaciones, clientes, categorias, copropRows] = await Promise.all([
      EmbarcacionesService.getAll(),
      ClientesService.getAll(),
      CategoriasService.getAll(),
      PropietariosSecundariosService.getAllByGuarderia(),
    ]);
    const clienteMap   = new Map(clientes.map(c   => [String(c.id), c]));
    const categoriaMap = new Map(categorias.map(c => [String(c.id), c]));
    // Agrupa copropietarios por embarcacion_id
    const copropMap = new Map();
    copropRows.forEach(r => {
      const embId = String(r.embarcacion_id);
      if (!copropMap.has(embId)) copropMap.set(embId, []);
      copropMap.get(embId).push(String(r.cliente_id));
    });

    let list = embarcaciones;

    // Filtro por estado del titular
    if (_filtroEstadoEmb !== 'todos') {
      const estadoTarget = _filtroEstadoEmb === 'activo' ? 'Activo' : 'Baja';
      list = list.filter(e => {
        const titular = e.propietario_id ? clienteMap.get(String(e.propietario_id)) : null;
        return (titular?.estado ?? 'Activo') === estadoTarget;
      });
    }

    if (filter) {
      const f = normalize(filter);
      list = list.filter(e => {
        const cat     = e.categoria_id   ? categoriaMap.get(String(e.categoria_id))   : null;
        const titular = e.propietario_id ? clienteMap.get(String(e.propietario_id))   : null;
        return normalize(e.nombre).includes(f)        ||
               normalize(e.matricula).includes(f)     ||
               normalize(e.marca).includes(f)         ||
               normalize(e.modelo).includes(f)        ||
               normalize(e.motorizacion).includes(f)  ||
               normalize(cat?.nombre).includes(f)     ||
               normalize(titular?.nombre).includes(f);
      });
    }

    _updatePaginControls('emb', list.length);
    if (list.length === 0) {
      const msg = filter
        ? `No se encontraron coincidencias para <strong>&laquo;${escHTML(filter)}&raquo;</strong>`
        : 'Sin embarcaciones para los filtros seleccionados';
      tbody.innerHTML = `<tr><td colspan="6" class="empty-row">${msg}</td></tr>`;
      return;
    }
    const _embStart = _pag.emb * PAGE_SIZE;
    tbody.innerHTML = list.slice(_embStart, _embStart + PAGE_SIZE).map(e => {
      const propId   = e.propietario_id ?? e.propietarioId;
      const titular  = propId ? clienteMap.get(String(propId)) : null;
      const cat      = e.categoria_id ? categoriaMap.get(String(e.categoria_id)) : null;
      const copropIds = copropMap.get(String(e.id)) || [];
      const copropNombres = copropIds
        .map(id => clienteMap.get(id)?.nombre)
        .filter(Boolean);
      const propCell = titular
        ? `<span class="prop-titular">${escHTML(titular.nombre)}</span>` +
          (copropNombres.length
            ? `<div class="prop-copropietarios">(${copropNombres.map(escHTML).join(', ')})</div>`
            : '')
        : '—';

      return `<tr>
        <td><strong>${escHTML(e.nombre)}</strong></td>
        <td class="emb-eslora-cell">${e.eslora ? escHTML(String(e.eslora)) + ' m' : '—'}</td>
        <td><code>${escHTML(e.matricula)}</code></td>
        <td>${escHTML(cat ? cat.nombre : '—')}</td>
        <td>${propCell}</td>
        <td>
          <button class="btn-action-outline" onclick="verDetalleEmbarcacion('${escHTML(String(e.id))}')" title="Ver Detalles">${ICON.eye}</button>
          <button class="btn-action-outline" onclick="editEmbarcacion('${escHTML(String(e.id))}')" title="Editar">${ICON.edit}</button>
          <button class="btn-action-outline delete" onclick="removeEmbarcacion('${escHTML(String(e.id))}')" title="Eliminar">${ICON.trash}</button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('renderEmbarcaciones:', err);
    setTableError(tbody, 6);
    showError('No se pudieron cargar las embarcaciones: ' + err.message);
  }
}

document.getElementById('searchEmbarcaciones').addEventListener('input', debounce(e => {
  _pag.emb = 0;
  renderEmbarcaciones(e.target.value);
}, 300));

document.getElementById('filtroEstadoEmb').addEventListener('change', e => {
  _filtroEstadoEmb = e.target.value;
  _pag.emb = 0;
  renderEmbarcaciones(document.getElementById('searchEmbarcaciones').value);
});

document.getElementById('prevEmbarcaciones').addEventListener('click', () => {
  if (_pag.emb > 0) { _pag.emb--; renderEmbarcaciones(document.getElementById('searchEmbarcaciones').value); }
});
document.getElementById('nextEmbarcaciones').addEventListener('click', () => {
  _pag.emb++;
  renderEmbarcaciones(document.getElementById('searchEmbarcaciones').value);
});

document.getElementById('btnNuevaEmbarcacion').addEventListener('click', async () => {
  try {
    const [clientes, categorias] = await Promise.all([
      ClientesService.getAll(),
      CategoriasService.getAll(),
    ]);
    document.getElementById('formEmbarcacion').reset();
    document.getElementById('embarcacionId').value = '';
    document.getElementById('modalEmbarcacionTitle').textContent = 'Nueva Embarcacion';
    fillSelect('embPropietario', clientes,   c => c.nombre);
    fillSelect('embCategoria',   categorias, c => `${c.nombre} — ${formatMonto(c.precio_base_mensual)}/mes`);
    _msInit(clientes, []);
    openModal('modalEmbarcacion');
  } catch (err) {
    showError('No se pudo abrir el formulario: ' + err.message);
  }
});

async function editEmbarcacion(id) {
  try {
    const [emb, clientes, categorias, copropIds] = await Promise.all([
      EmbarcacionesService.getById(id),
      ClientesService.getAll(),
      CategoriasService.getAll(),
      PropietariosSecundariosService.getByEmbarcacion(id),
    ]);
    if (!emb) return;

    document.getElementById('embarcacionId').value     = emb.id;
    document.getElementById('embNombre').value         = emb.nombre       || '';
    document.getElementById('embMatricula').value      = emb.matricula    || '';
    document.getElementById('embMarca').value          = emb.marca        || '';
    document.getElementById('embModelo').value         = emb.modelo       || '';
    document.getElementById('embMotorizacion').value   = emb.motorizacion || '';
    document.getElementById('embEslora').value         = emb.eslora       || '';
    document.getElementById('embManga').value          = emb.manga        || '';
    document.getElementById('embPuntal').value         = emb.puntal       || '';
    document.getElementById('embNotas').value          = emb.notas        || '';

    const propId = emb.propietario_id ?? emb.propietarioId ?? '';
    fillSelect('embPropietario', clientes,   c => c.nombre, propId);
    fillSelect('embCategoria',   categorias, c => `${c.nombre} — ${formatMonto(c.precio_base_mensual)}/mes`, emb.categoria_id ?? '');
    _msInit(clientes, copropIds);
    document.getElementById('modalEmbarcacionTitle').textContent = 'Editar Embarcacion';
    openModal('modalEmbarcacion');
  } catch (err) {
    showError('No se pudo cargar la embarcacion: ' + err.message);
  }
}

async function removeEmbarcacion(id) {
  try {
    const emb = await EmbarcacionesService.getById(id);
    confirmDelete(`¿Eliminar la embarcacion "${emb?.nombre}"?`, async () => {
      try {
        await EmbarcacionesService.delete(id);
        await Promise.all([renderEmbarcaciones(), renderDashboard()]);
      } catch (err) {
        showError('No se pudo eliminar la embarcacion: ' + err.message);
      }
    });
  } catch (err) {
    showError(err.message);
  }
}

async function verDetalleEmbarcacion(id) {
  try {
    const [emb, clientes, categorias, copropIds] = await Promise.all([
      EmbarcacionesService.getById(id),
      ClientesService.getAll(),
      CategoriasService.getAll(),
      PropietariosSecundariosService.getByEmbarcacion(id),
    ]);
    if (!emb) return;

    const clienteMap   = new Map(clientes.map(c => [String(c.id), c]));
    const categoriaMap = new Map(categorias.map(c => [String(c.id), c]));

    const titular   = emb.propietario_id ? clienteMap.get(String(emb.propietario_id)) : null;
    const cat       = emb.categoria_id   ? categoriaMap.get(String(emb.categoria_id)) : null;
    const copropNombres = copropIds
      .map(cid => clienteMap.get(String(cid))?.nombre)
      .filter(Boolean);

    document.getElementById('modalDetalleEmbarcacionTitle').textContent =
      `Ficha Técnica — ${emb.nombre || ''}`;

    const set = (elId, val) => {
      const el = document.getElementById(elId);
      if (el) el.textContent = val || '—';
    };

    set('dembNombre',       emb.nombre);
    set('dembMatricula',    emb.matricula);
    set('dembCategoria',    cat ? `${cat.nombre} — $${formatMonto(cat.precio_base_mensual)}/mes` : null);
    set('dembMarca',        emb.marca);
    set('dembModelo',       emb.modelo);
    set('dembMotorizacion', emb.motorizacion);
    set('dembEslora',       emb.eslora != null ? emb.eslora + ' m' : null);
    set('dembManga',        emb.manga  != null ? emb.manga  + ' m' : null);
    set('dembPuntal',       emb.puntal != null ? emb.puntal + ' m' : null);
    set('dembTitular',      titular ? titular.nombre : null);
    set('dembCopropietarios', copropNombres.length ? copropNombres.join(', ') : null);

    const notasSection = document.getElementById('dembNotasSection');
    const notasEl      = document.getElementById('dembNotas');
    if (emb.notas && emb.notas.trim()) {
      notasEl.textContent  = emb.notas;
      notasSection.hidden  = false;
    } else {
      notasSection.hidden  = true;
    }

    openModal('modalDetalleEmbarcacion');
  } catch (err) {
    showError('No se pudo cargar el detalle: ' + err.message);
  }
}

document.getElementById('formEmbarcacion').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  setSubmitting(btn, true);
  try {
    const idVal = document.getElementById('embarcacionId').value;
    const _parseNum = id => { const v = parseFloat(document.getElementById(id).value); return isNaN(v) ? null : v; };
    const data = {
      nombre:         document.getElementById('embNombre').value.trim(),
      matricula:      document.getElementById('embMatricula').value.trim(),
      categoria_id:   document.getElementById('embCategoria').value || null,
      marca:          document.getElementById('embMarca').value.trim()         || null,
      modelo:         document.getElementById('embModelo').value.trim()        || null,
      motorizacion:   document.getElementById('embMotorizacion').value.trim()  || null,
      eslora:         _parseNum('embEslora'),
      manga:          _parseNum('embManga'),
      puntal:         _parseNum('embPuntal'),
      propietario_id: document.getElementById('embPropietario').value || null,
      notas:          document.getElementById('embNotas').value.trim(),
    };
    if (idVal) data.id = idVal;
    const saved = await EmbarcacionesService.save(data);
    // Guardar copropietarios (titular principal ya está en embarcaciones.cliente_id)
    const embId = saved?.id || idVal;
    if (embId) {
      // Excluir al titular de la lista de copropietarios por si acaso
      const titularId = data.propietario_id;
      const copropIds = [..._msSelected].filter(id => id !== titularId);
      await PropietariosSecundariosService.setForEmbarcacion(embId, copropIds);
    }
    closeModal('modalEmbarcacion');
    await Promise.all([renderEmbarcaciones(), renderDashboard()]);
  } catch (err) {
    showError('No se pudo guardar la embarcacion: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

// Validación: campos numéricos de embarcacion solo aceptan dígitos y punto decimal
['embEslora', 'embManga', 'embPuntal'].forEach(id => {
  document.getElementById(id).addEventListener('input', function () {
    // Eliminar cualquier carácter que no sea dígito o punto; evitar doble punto
    this.value = this.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  });
});

// ─── ÚLTIMOS MOVIMIENTOS ──────────────────────────────────────────────────────

async function renderUltimosMovimientos() {
  const tbody = document.getElementById('tablaUltimosMovimientos');
  if (!tbody) return;
  setTableLoading(tbody, 5);
  try {
    const [extras, clientes] = await Promise.all([
      PagosService.getExtras(),         // solo cuota_id: null
      ClientesService.getAll(),
    ]);
    const cliMap = new Map(clientes.map(c => [String(c.id), c]));

    // Orden: más reciente primero
    extras.sort((a, b) => (a.fecha_pago > b.fecha_pago ? -1 : 1));

    if (extras.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Sin ingresos registrados</td></tr>';
      return;
    }
    tbody.innerHTML = extras.map(p => {
      const cli    = cliMap.get(String(p.cliente_id));
      const fecha  = p.fecha_pago ? p.fecha_pago.slice(0, 10) : '—';
      const metodo = escHTML(p.metodo_pago || p.metodoPago || '—');
      return `<tr>
        <td>${escHTML(p.concepto || '—')}</td>
        <td>${escHTML(cli ? cli.nombre : '—')}</td>
        <td>${metodo}</td>
        <td>$ ${formatMonto(Number(p.monto))}</td>
        <td>${fecha}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('renderUltimosMovimientos:', err);
  }
}

// ─── CLIENTES ─────────────────────────────────────────────────────────────────

async function renderClientes() {
  const tbody = document.getElementById('tablaClientes');
  setTableLoading(tbody, 7);
  try {
    const [clientes, cuotas] = await Promise.all([
      ClientesService.getAll(),
      CuotasService.getAll(),
    ]);

    // Saldo por cobrar: pendiente = monto completo, parcial = monto - monto_pagado
    const saldoMap = new Map();
    cuotas.forEach(c => {
      const cid = String(c.cliente_id);
      if (c.estado === 'pendiente') {
        saldoMap.set(cid, (saldoMap.get(cid) || 0) + Number(c.monto));
      } else if (c.estado === 'parcial') {
        const resta = Math.max(0, Number(c.monto) - Number(c.monto_pagado ?? 0));
        saldoMap.set(cid, (saldoMap.get(cid) || 0) + resta);
      }
    });

    // Filtrar pool según botón activo
    let pool;
    if (_filtroEstadoCli === 'bajas') {
      pool = clientes.filter(c => (c.estado || 'Activo') === 'Baja');
    } else if (_filtroEstadoCli === 'activos') {
      pool = clientes.filter(c => (c.estado || 'Activo') === 'Activo');
    } else {
      pool = [...clientes];
    }

    // Filtros de Al día / Deudor no aplican cuando se muestran bajas
    const sortNombre = document.getElementById('sortClienteNombre').value;
    const estadoFil  = document.getElementById('filtroEstadoCliente').value;
    const sortDeuda  = document.getElementById('sortClienteDeuda').value;

    if (_filtroEstadoCli !== 'bajas') {
      pool = pool.filter(c => {
        const saldo = saldoMap.get(String(c.id)) || 0;
        if (estadoFil === 'aldia'  && saldo > 0)  return false;
        if (estadoFil === 'deudor' && saldo <= 0) return false;
        return true;
      });
    }

    if (sortDeuda === 'mayor') {
      pool.sort((a, b) => (saldoMap.get(String(b.id)) || 0) - (saldoMap.get(String(a.id)) || 0));
    } else if (sortDeuda === 'menor') {
      pool.sort((a, b) => (saldoMap.get(String(a.id)) || 0) - (saldoMap.get(String(b.id)) || 0));
    } else if (sortNombre === 'az') {
      pool.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    } else if (sortNombre === 'za') {
      pool.sort((a, b) => (b.nombre || '').localeCompare(a.nombre || '', 'es'));
    }

    // Búsqueda de texto: nombre/apellido insensible a acentos, o DNI/CUIT/ID exacto
    if (_searchClientes) {
      const f = normalize(_searchClientes);
      pool = pool.filter(c =>
        normalize(c.nombre).includes(f)   ||
        normalize(c.dni).includes(f)      ||
        normalize(String(c.id)).includes(f)
      );
    }

    _updatePaginControls('cli', pool.length);
    if (pool.length === 0) {
      let msg;
      if (_searchClientes) {
        msg = `No se encontraron coincidencias para <strong>&laquo;${escHTML(_searchClientes)}&raquo;</strong>`;
      } else if (_filtroEstadoCli === 'bajas') {
        msg = 'Sin clientes dados de baja';
      } else {
        msg = 'Sin clientes para los filtros seleccionados';
      }
      tbody.innerHTML = `<tr><td colspan="7" class="empty-row">${msg}</td></tr>`;
      return;
    }

    tbody.style.opacity = '0';
    const _cliStart = _pag.cli * PAGE_SIZE;
    tbody.innerHTML = pool.slice(_cliStart, _cliStart + PAGE_SIZE).map(c => {
      const saldo   = saldoMap.get(String(c.id)) || 0;
      const cid     = escHTML(String(c.id));
      const enBaja  = (c.estado || 'Activo') === 'Baja';

      const rowClass   = (enBaja && saldo !== 0) ? 'cli-inactivo-deuda' : (enBaja ? 'cli-inactivo' : '');
      const saldoClass = saldo > 0 ? 'badge-red' : 'badge-green';

      // Badge de estado con fecha
      const estadoBadge = enBaja
        ? `<span class="badge badge-orange">Baja${c.fecha_baja ? ' · ' + escHTML(c.fecha_baja.slice(0, 10)) : ''}</span>`
        : `<span class="badge badge-green">Activo</span>`;

      const acciones = enBaja
        ? `<button class="btn-action-outline accent" onclick="verCliente360('${cid}')" title="Ver Perfil Completo">${ICON.search}</button>
           <button class="btn-action-outline success" onclick="reactivarCliente('${cid}')" title="Reactivar">${ICON.refresh}</button>
           <button class="btn-action-outline" onclick="verCuentaCorriente('${cid}')" title="Cuenta Corriente">${ICON.ledger}</button>
           <button class="btn-action-outline" onclick="editCliente('${cid}')" title="Editar">${ICON.edit}</button>`
        : `<button class="btn-action-outline accent" onclick="verCliente360('${cid}')" title="Ver Perfil Completo">${ICON.search}</button>
           <button class="btn-action-outline" onclick="verCuentaCorriente('${cid}')" title="Cuenta Corriente">${ICON.ledger}</button>
           <button class="btn-action-outline" onclick="editCliente('${cid}')" title="Editar">${ICON.edit}</button>
           <button class="btn-action-outline delete" onclick="removeCliente('${cid}')" title="Dar de baja">${ICON.trash}</button>`;

      return `<tr class="cli-row-interactive ${rowClass}" ondblclick="verCliente360('${cid}')">
        <td><strong>${escHTML(c.nombre)}</strong></td>
        <td>${escHTML(c.dni) || '—'}</td>
        <td>${escHTML(c.telefono) || '—'}</td>
        <td>${escHTML(c.email) || '—'}</td>
        <td><span class="badge ${saldoClass}">$ ${formatMonto(saldo)}</span></td>
        <td>${estadoBadge}</td>
        <td>${acciones}</td>
      </tr>`;
    }).join('');
    requestAnimationFrame(() => { tbody.style.opacity = '1'; });

  } catch (err) {
    console.error('renderClientes:', err);
    setTableError(tbody, 7);
    showError('No se pudieron cargar los clientes: ' + err.message);
  }
}

document.getElementById('sortClienteNombre').addEventListener('change', () => { _pag.cli = 0; renderClientes(); });
document.getElementById('filtroEstadoCliente').addEventListener('change', () => { _pag.cli = 0; renderClientes(); });
document.getElementById('sortClienteDeuda').addEventListener('change', () => { _pag.cli = 0; renderClientes(); });
document.getElementById('searchClientes').addEventListener('input', debounce(e => {
  _searchClientes = e.target.value.trim();
  _pag.cli = 0;
  renderClientes();
}, 300));

document.getElementById('searchCuotas')?.addEventListener('input', debounce(e => {
  _searchCuotas = e.target.value.trim();
  renderCuotas();
}, 300));

document.querySelectorAll('.cli-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cli-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _filtroEstadoCli = btn.dataset.filter;
    _pag.cli = 0;
    const enBajas = _filtroEstadoCli === 'bajas';
    document.getElementById('sortClienteNombre').disabled   = enBajas;
    document.getElementById('filtroEstadoCliente').disabled = enBajas;
    document.getElementById('sortClienteDeuda').disabled    = enBajas;
    renderClientes();
  });
});

document.getElementById('prevClientes').addEventListener('click', () => {
  if (_pag.cli > 0) { _pag.cli--; renderClientes(); }
});
document.getElementById('nextClientes').addEventListener('click', () => {
  _pag.cli++;
  renderClientes();
});

document.getElementById('btnNuevoCliente').addEventListener('click', () => {
  document.getElementById('formCliente').reset();
  document.getElementById('clienteId').value = '';
  document.getElementById('cliEstado').value = 'Activo';
  document.getElementById('modalClienteTitle').textContent = 'Nuevo Cliente';
  openModal('modalCliente');
});

async function editCliente(id) {
  try {
    const c = await ClientesService.getById(id);
    if (!c) return;
    document.getElementById('clienteId').value    = c.id;
    document.getElementById('cliNombre').value    = c.nombre    || '';
    document.getElementById('cliDni').value       = c.dni       || '';
    document.getElementById('cliTelefono').value  = c.telefono  || '';
    document.getElementById('cliEmail').value     = c.email     || '';
    document.getElementById('cliDireccion').value = c.direccion || '';
    document.getElementById('cliEstado').value    = c.estado    || 'Activo';
    document.getElementById('modalClienteTitle').textContent = 'Editar Cliente';
    openModal('modalCliente');
  } catch (err) {
    showError('No se pudo cargar el cliente: ' + err.message);
  }
}

async function removeCliente(id) {
  try {
    const c = await ClientesService.getById(id);
    confirmDelete(
      `¿Dar de baja al cliente "${c?.nombre}"?\nEl registro se conserva; solo se cambia el estado a Baja con la fecha de hoy.`,
      async () => {
        try {
          await ClientesService.deactivate(id);
          await Promise.all([renderClientes(), renderDashboard()]);
          showToast('Cliente dado de baja.');
        } catch (err) {
          showError('No se pudo desactivar el cliente: ' + err.message);
        }
      }
    );
  } catch (err) {
    showError(err.message);
  }
}

async function reactivarCliente(id) {
  try {
    await ClientesService.reactivate(id);
    await renderClientes();
    showToast('Cliente reactivado.');
  } catch (err) {
    showError('No se pudo reactivar el cliente: ' + err.message);
  }
}

async function verDetalleCliente(clienteId) {
  try {
    const [cliente, cuotas] = await Promise.all([
      ClientesService.getById(clienteId),
      CuotasService.getAll(),
    ]);
    const cuotasCliente = cuotas.filter(c => String(c.cliente_id) === String(clienteId));
    const saldoPendiente = cuotasCliente.reduce((sum, c) => {
      if (c.estado === 'pendiente') return sum + Number(c.monto);
      if (c.estado === 'parcial')   return sum + Math.max(0, Number(c.monto) - Number(c.monto_pagado ?? 0));
      return sum;
    }, 0);

    document.getElementById('modalDetalleClienteTitle').textContent =
      `Cuotas — ${cliente ? cliente.nombre : ''}`;
    document.getElementById('detalleSaldoPendiente').textContent = `$ ${formatMonto(saldoPendiente)}`;

    const tbody = document.getElementById('tablaDetalleCliente');
    if (cuotasCliente.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Sin cuotas registradas</td></tr>';
    } else {
      tbody.innerHTML = cuotasCliente.map(c => `<tr>
        <td>${escHTML(c.concepto)}</td>
        <td>${escHTML(c.periodo)}</td>
        <td>$ ${formatMonto(c.monto)}</td>
        <td>${estadoCuotaBadge(c.estado)}</td>
      </tr>`).join('');
    }
    openModal('modalDetalleCliente');
  } catch (err) {
    showError('No se pudo cargar el detalle: ' + err.message);
  }
}

// ─── VISTA 360° DEL CLIENTE ───────────────────────────────────────────────────

async function verCliente360(clienteId) {
  // Abre el modal inmediatamente con estado de carga
  document.getElementById('c360Nombre').textContent   = 'Cargando perfil...';
  document.getElementById('c360Meta').textContent     = '';
  document.getElementById('c360Saldo').textContent    = '—';
  document.getElementById('c360Estado').innerHTML     = '';
  document.getElementById('c360Dni').textContent      = '—';
  document.getElementById('c360FechaAlta').textContent = '—';
  document.getElementById('c360Telefono').textContent = '—';
  const loadingRow = '<p class="c360-empty"><span class="spinner-sm"></span> Cargando...</p>';
  document.getElementById('c360Embarcaciones').innerHTML = loadingRow;
  document.getElementById('c360Movimientos').innerHTML   = loadingRow;
  document.getElementById('c360Notas').innerHTML         = loadingRow;
  openModal('modalCliente360');

  try {
    const [cliente, todasEmb, cuotas, pagos, notas] = await Promise.all([
      ClientesService.getById(clienteId),
      EmbarcacionesService.getAll(),
      CuotasService.getAll(),
      PagosService.getByCliente(clienteId),
      NotasClientesService.getByCliente(clienteId),
    ]);

    // ── Cabecera ──────────────────────────────────────────
    const enBaja = (cliente.estado || 'Activo') === 'Baja';
    document.getElementById('c360Nombre').textContent    = cliente.nombre || '—';
    document.getElementById('c360Meta').textContent      = cliente.email  || '';
    document.getElementById('c360Dni').textContent       = cliente.dni    || '—';
    document.getElementById('c360Telefono').textContent  = cliente.telefono || '—';
    document.getElementById('c360FechaAlta').textContent =
      (cliente.created_at || '').slice(0, 10) || '—';
    document.getElementById('c360Estado').innerHTML = enBaja
      ? `<span class="badge badge-orange">Baja${cliente.fecha_baja ? ' · ' + cliente.fecha_baja.slice(0, 10) : ''}</span>`
      : `<span class="badge badge-green">Activo</span>`;

    // ── Saldo ─────────────────────────────────────────────
    const cuotasCliente = cuotas.filter(c => String(c.cliente_id) === String(clienteId));
    const saldo = cuotasCliente.reduce((sum, c) => {
      if (c.estado === 'pendiente') return sum + Number(c.monto);
      if (c.estado === 'parcial')   return sum + Math.max(0, Number(c.monto) - Number(c.monto_pagado ?? 0));
      return sum;
    }, 0);
    const cuotasPendientes = cuotasCliente.filter(c => c.estado === 'pendiente' || c.estado === 'parcial');
    _c360Data = { cliente, cuotasCliente, cuotasPendientes, saldo };
    const saldoEl = document.getElementById('c360Saldo');
    saldoEl.textContent = `$ ${formatMonto(saldo)}`;
    saldoEl.style.color = saldo > 0 ? 'var(--danger)' : '#15803d';

    // ── Embarcaciones ─────────────────────────────────────
    const embarcaciones = todasEmb.filter(e => String(e.propietario_id) === String(clienteId));
    const embEl = document.getElementById('c360Embarcaciones');
    if (embarcaciones.length === 0) {
      embEl.innerHTML = '<p class="c360-empty">Sin embarcaciones vinculadas</p>';
    } else {
      embEl.innerHTML = embarcaciones.map(e => `
        <div class="c360-emb-row">
          <div class="c360-emb-info">
            <strong>${escHTML(e.nombre)}</strong>
            <span class="c360-emb-mat">${escHTML(e.matricula) || '—'}</span>
          </div>
          <button class="btn-action-outline" onclick="verDetalleEmbarcacion('${escHTML(String(e.id))}')" title="Ver ficha tecnica">${ICON.eye}</button>
        </div>`).join('');
    }

    // ── Últimos 5 movimientos ─────────────────────────────
    const movs = [];
    cuotasCliente.forEach(c => {
      movs.push({ fecha: c.periodo || '', concepto: c.concepto, monto: Number(c.monto), tipo: 'cargo' });
    });
    pagos.forEach(p => {
      const concepto = p.concepto ? `Pago — ${p.concepto}` : 'Pago registrado';
      movs.push({ fecha: (p.fecha_pago || '').slice(0, 7), concepto, monto: Number(p.monto), tipo: 'pago' });
    });
    movs.sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : 0));
    const ultimos5 = movs.slice(0, 5);
    const movEl = document.getElementById('c360Movimientos');
    if (ultimos5.length === 0) {
      movEl.innerHTML = '<p class="c360-empty">Sin movimientos registrados</p>';
    } else {
      movEl.innerHTML = '<div class="c360-movs-list">' + ultimos5.map(m => `
        <div class="c360-mov-row ${m.tipo === 'pago' ? 'c360-mov-pago' : ''}">
          <div class="c360-mov-info">
            <span class="c360-mov-concepto">${escHTML(m.concepto)}</span>
            <span class="c360-mov-fecha">${escHTML(m.fecha)}</span>
          </div>
          <span class="c360-mov-monto" style="color:${m.tipo === 'pago' ? '#15803d' : 'var(--danger)'}">
            ${m.tipo === 'pago' ? '+' : '−'} $ ${formatMonto(m.monto)}
          </span>
        </div>`).join('') + '</div>';
    }

    // ── Notas ─────────────────────────────────────────────
    const notasEl = document.getElementById('c360Notas');
    if (notas.length === 0) {
      notasEl.innerHTML = '<p class="c360-empty">Sin notas registradas</p>';
    } else {
      notasEl.innerHTML = notas.slice(0, 4).map(n => `
        <div class="c360-nota-row">
          <span class="c360-nota-fecha">${(n.created_at || '').slice(0, 10)}</span>
          <span class="c360-nota-texto">${escHTML(n.contenido)}</span>
        </div>`).join('');
    }

    // ── Botones de acción ─────────────────────────────────
    document.getElementById('c360BtnCC').onclick = () => {
      closeModal('modalCliente360');
      verCuentaCorriente(clienteId);
    };
    document.getElementById('c360BtnWA').onclick = () => notificarWhatsApp();

  } catch (err) {
    showError('No se pudo cargar la ficha 360°: ' + err.message);
  }
}

// ─── PDF + WHATSAPP ───────────────────────────────────────────────────────────

function generarPDFCuotasPendientes(cliente, cuotasPendientes, saldo) {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Encabezado con fondo navy
  doc.setFillColor(15, 39, 68);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('NaviGestor', 14, 12);
  doc.setFontSize(9);  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Gestion de Embarcaciones', 14, 20);
  doc.text(`Generado: ${fecha}`, 196, 12, { align: 'right' });

  // Datos del cliente
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text('Estado de Cuenta \u2014 Cuotas Pendientes', 14, 38);
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  let infoY = 46;
  doc.text(`Cliente: ${cliente.nombre || '\u2014'}`, 14, infoY);
  if (cliente.dni)      { infoY += 6; doc.text(`DNI / CUIT: ${cliente.dni}`, 14, infoY); }
  if (cliente.telefono) { infoY += 6; doc.text(`Tel\u00e9fono: ${cliente.telefono}`, 14, infoY); }

  // Tabla de cuotas
  const rows = cuotasPendientes.map(c => {
    const resta = c.estado === 'pendiente'
      ? Number(c.monto)
      : Math.max(0, Number(c.monto) - Number(c.monto_pagado ?? 0));
    return [
      c.periodo  || '\u2014',
      c.concepto || '\u2014',
      `$ ${formatMonto(Number(c.monto))}`,
      c.estado === 'pendiente' ? 'Pendiente' : 'Parcial',
      `$ ${formatMonto(resta)}`,
    ];
  });

  doc.autoTable({
    startY: infoY + 8,
    head:   [['Per\u00edodo', 'Concepto', 'Monto', 'Estado', 'Saldo a Pagar']],
    body:   rows.length ? rows : [['', 'Sin cuotas pendientes', '', '', '$ 0,00']],
    theme:  'striped',
    headStyles:   { fillColor: [15, 39, 68], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles:   { fontSize: 9, textColor: [30, 41, 59] },
    columnStyles: {
      2: { halign: 'right' },
      4: { halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] },
    },
    margin: { left: 14, right: 14 },
  });

  // Saldo total
  const finalY = doc.lastAutoTable.finalY + 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, finalY, 196, finalY);
  doc.setFontSize(11); doc.setFont('helvetica', 'bold');
  doc.setTextColor(239, 68, 68);
  doc.text(`Saldo Total Adeudado:  $ ${formatMonto(saldo)}`, 196, finalY + 8, { align: 'right' });

  // Pie de página
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Este documento es informativo. Ante dudas com\u00fan\u00edquese con la administraci\u00f3n.', 105, 287, { align: 'center' });

  const nombreArchivo = `Estado_Cuenta_${(cliente.nombre || 'cliente').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(nombreArchivo);
}

function notificarWhatsApp() {
  if (!_c360Data) return;
  const { cliente, cuotasPendientes, saldo } = _c360Data;

  // 1. Generar y descargar el PDF
  generarPDFCuotasPendientes(cliente, cuotasPendientes, saldo);

  // 2. Abrir WhatsApp con mensaje dinámico
  const nombre   = cliente.nombre || 'Cliente';
  const telefono = (cliente.telefono || '').replace(/\D/g, '');
  const n        = cuotasPendientes.length;
  const montoStr = `$ ${formatMonto(saldo)}`;

  const msg = [
    `Estimado/a ${nombre},`,
    '',
    `Le informamos que registra *${n} cuota${n !== 1 ? 's' : ''} pendiente${n !== 1 ? 's' : ''}* con un saldo total de *${montoStr}*.`,
    '',
    'Quedamos a disposición por cualquier consulta.',
    '',
    '_NaviGestor \u2014 Sistema de Gesti\u00f3n N\u00e1utica_',
  ].join('\n');

  const url = `https://wa.me/${telefono}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// ─── CUENTA CORRIENTE ─────────────────────────────────────────────────────────

async function verCuentaCorriente(clienteId) {
  // Abre el modal inmediatamente con estado de carga
  document.getElementById('ccClienteNombre').textContent = 'Cargando perfil...';
  document.getElementById('ccPrintNombre').textContent   = '';
  document.getElementById('ccPrintFecha').textContent    = '';
  document.getElementById('ccTotalDebe').textContent     = '—';
  document.getElementById('ccTotalHaber').textContent    = '—';
  document.getElementById('ccSaldoFinal').textContent    = '—';
  document.getElementById('tablaCuentaCorriente').innerHTML =
    '<tr><td colspan="5" class="empty-row"><span class="spinner-sm"></span> Cargando movimientos...</td></tr>';
  openModal('modalCuentaCorriente');

  try {
    const [cliente, cuotas, pagos] = await Promise.all([
      ClientesService.getById(clienteId),
      CuotasService.getAll(),
      PagosService.getByCliente(clienteId),
    ]);

    // Filtrar y ordenar cuotas del cliente (más viejo primero → saldo acumulado correcto)
    const cuotasCliente = cuotas
      .filter(c => String(c.cliente_id) === String(clienteId))
      .sort((a, b) => (a.periodo > b.periodo ? 1 : a.periodo < b.periodo ? -1 : 0));

    const cuotaMap = new Map(cuotasCliente.map(c => [String(c.id), c]));

    const movs = [];

    // DEBE: una línea por cuota (cargo)
    cuotasCliente.forEach(c => {
      movs.push({ fecha: c.periodo, concepto: c.concepto, debe: Number(c.monto), haber: 0, tipo: 'cargo' });
    });

    // HABER: una línea por cada pago real en la tabla 'pagos' (cuotas + extras)
    pagos.forEach(p => {
      const fechaStr = p.fecha_pago ? p.fecha_pago.slice(0, 7) : '—';
      let concepto;
      if (p.cuota_id) {
        const c = cuotaMap.get(String(p.cuota_id));
        concepto = c ? `Pago — ${c.concepto}` : 'Pago de cuota';
      } else {
        concepto = `Ingreso Extra${p.concepto ? ' — ' + p.concepto : ''}`;
      }
      movs.push({ fecha: fechaStr, concepto, debe: 0, haber: Number(p.monto), tipo: 'pago' });
    });

    // Ordenar cronológicamente antes de calcular el saldo acumulado
    movs.sort((a, b) => (a.fecha > b.fecha ? 1 : a.fecha < b.fecha ? -1 : 0));

    // Saldo acumulado (de más viejo a más nuevo)
    let acc = 0;
    movs.forEach(m => { acc += m.debe - m.haber; m.saldo = acc; });

    const totalDebe  = movs.reduce((s, m) => s + m.debe,  0);
    const totalHaber = movs.reduce((s, m) => s + m.haber, 0);
    const saldoFinal = totalDebe - totalHaber;

    // ── Actualizar cabecera / KPIs ────────────────────────────
    const nombre = cliente?.nombre || '';
    document.getElementById('ccClienteNombre').textContent = `Cuenta Corriente — ${nombre}`;
    document.getElementById('ccPrintNombre').textContent   = `Cuenta Corriente: ${nombre}`;
    document.getElementById('ccPrintFecha').textContent    =
      new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' });

    document.getElementById('ccTotalDebe').textContent  = `$ ${formatMonto(totalDebe)}`;
    document.getElementById('ccTotalHaber').textContent = `$ ${formatMonto(totalHaber)}`;

    const saldoEl = document.getElementById('ccSaldoFinal');
    saldoEl.textContent = `$ ${formatMonto(saldoFinal)}`;
    saldoEl.style.color = saldoFinal > 0 ? 'var(--danger)' : '#15803d';

    // ── Renderizar tabla (más reciente primero) ───────────────
    const tbody = document.getElementById('tablaCuentaCorriente');
    if (movs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Sin movimientos registrados</td></tr>';
    } else {
      tbody.innerHTML = [...movs].reverse().map(m => {
        const saldoColor = m.saldo > 0 ? 'color:var(--danger)' : 'color:#15803d';
        const rowClass   = m.tipo === 'pago' ? 'cc-row-pago' : '';
        return `<tr class="${rowClass}">
          <td>${escHTML(m.fecha)}</td>
          <td>${escHTML(m.concepto)}</td>
          <td style="text-align:right;font-weight:600;color:var(--danger)">${m.debe  > 0 ? `$ ${formatMonto(m.debe)}`  : '<span style="color:var(--text-muted)">—</span>'}</td>
          <td style="text-align:right;font-weight:600;color:#15803d">${m.haber > 0 ? `$ ${formatMonto(m.haber)}` : '<span style="color:var(--text-muted)">—</span>'}</td>
          <td style="text-align:right;font-weight:800;${saldoColor}">$ ${formatMonto(m.saldo)}</td>
        </tr>`;
      }).join('');
    }

    _ccClienteId = clienteId;
    // Cargar notas del cliente en paralelo (no bloquea la apertura del modal)
    _renderNotasCC(clienteId);
  } catch (err) {
    showError('No se pudo cargar la cuenta corriente: ' + err.message);
  }
}

async function _renderNotasCC(clienteId) {
  const lista = document.getElementById('ccNotasList');
  if (!lista) return;
  lista.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:4px 0">Cargando notas...</p>';
  try {
    const notas = await NotasClientesService.getByCliente(clienteId);
    if (notas.length === 0) {
      lista.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:4px 0">Sin notas registradas.</p>';
      return;
    }
    lista.innerHTML = notas.map(n => `
      <div class="cc-nota-item">
        <div class="cc-nota-meta">
          <span class="cc-nota-fecha">${escHTML(n.fecha || n.created_at?.slice(0,10) || '')}</span>
          <button class="btn-action-outline delete" onclick="_eliminarNotaCC('${escHTML(String(n.id))}')" title="Eliminar nota">${ICON.trash}</button>
        </div>
        <div class="cc-nota-contenido">${escHTML(n.contenido)}</div>
      </div>
    `).join('');
  } catch (_) {
    lista.innerHTML = '<p style="color:var(--text-muted);font-size:12px">No se pudieron cargar las notas.</p>';
  }
}

async function _eliminarNotaCC(notaId) {
  try {
    await NotasClientesService.delete(notaId);
    if (_ccClienteId) _renderNotasCC(_ccClienteId);
  } catch (err) {
    showError('No se pudo eliminar la nota: ' + err.message);
  }
}

document.getElementById('btnImprimirCC').addEventListener('click', () => window.print());

// ─── NOTAS DE CLIENTE (Cuenta Corriente) ─────────────────────────────────────

document.getElementById('btnToggleNota').addEventListener('click', () => {
  const form = document.getElementById('ccNotaForm');
  form.hidden = !form.hidden;
  if (!form.hidden) document.getElementById('ccNotaContenido').focus();
});

document.getElementById('btnCancelarNota').addEventListener('click', () => {
  document.getElementById('ccNotaForm').hidden = true;
  document.getElementById('ccNotaContenido').value = '';
});

document.getElementById('btnGuardarNota').addEventListener('click', async () => {
  const btn       = document.getElementById('btnGuardarNota');
  const contenido = document.getElementById('ccNotaContenido').value.trim();
  if (!contenido) { showError('Escribe el contenido de la nota.'); return; }
  if (!_ccClienteId) return;
  setSubmitting(btn, true);
  try {
    await NotasClientesService.save({
      clienteId: _ccClienteId,
      contenido,
      fecha: new Date().toISOString().slice(0, 10),
    });
    document.getElementById('ccNotaContenido').value = '';
    document.getElementById('ccNotaForm').hidden = true;
    await _renderNotasCC(_ccClienteId);
  } catch (err) {
    showError('No se pudo guardar la nota: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

document.getElementById('formCliente').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  setSubmitting(btn, true);
  try {
    const idVal = document.getElementById('clienteId').value;
    const data = {
      nombre:    document.getElementById('cliNombre').value.trim(),
      dni:       document.getElementById('cliDni').value.trim(),
      telefono:  document.getElementById('cliTelefono').value.trim(),
      email:     document.getElementById('cliEmail').value.trim(),
      direccion: document.getElementById('cliDireccion').value.trim(),
      estado:    document.getElementById('cliEstado').value,
    };
    if (idVal) data.id = idVal;
    const clienteGuardado = await ClientesService.save(data);
    // Si el modal fue abierto desde el importador, re-valida la fila correspondiente
    if (_importPostClienteGuardado) {
      const cb = _importPostClienteGuardado;
      _importPostClienteGuardado = null;
      cb(clienteGuardado);
    }
    closeModal('modalCliente');
    await Promise.all([renderClientes(), renderDashboard()]);
  } catch (err) {
    showError('No se pudo guardar el cliente: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────

async function renderCategorias(filter = '') {
  const tbody = document.getElementById('tablaCategorias');
  setTableLoading(tbody, 5);
  try {
    let list = await CategoriasService.getAll();
    if (filter) {
      const f = filter.toLowerCase();
      list = list.filter(c => c.nombre?.toLowerCase().includes(f));
    }
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Sin categorias registradas</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(c => {
      const IVA_RATE = 0.21;
      const servicio    = Number(c.precio_base_mensual ?? 0);
      const fondeadero  = Number(c.tasa_fondeadero ?? 0);
      const iva         = Math.round(servicio * IVA_RATE * 100) / 100;
      const total       = servicio + iva + fondeadero;
      return `<tr>
        <td>
          <strong>${escHTML(c.nombre)}</strong>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Total cuota: $ ${formatMonto(total)}</div>
        </td>
        <td>$ ${formatMonto(servicio)} <span style="font-size:11px;color:var(--text-muted)">(+IVA $ ${formatMonto(iva)})</span></td>
        <td>$ ${formatMonto(fondeadero)}</td>
        <td>${formatDate(c.created_at)}</td>
        <td>
          <button class="btn-action-outline" onclick="editCategoria('${escHTML(String(c.id))}')" title="Editar">${ICON.edit}</button>
          <button class="btn-action-outline delete" onclick="removeCategoria('${escHTML(String(c.id))}')" title="Eliminar">${ICON.trash}</button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('renderCategorias:', err);
    setTableError(tbody, 5);
    showError('No se pudieron cargar las categorias: ' + err.message);
  }
}

document.getElementById('searchCategorias').addEventListener('input', e => {
  renderCategorias(e.target.value);
});

document.getElementById('btnNuevaCategoria').addEventListener('click', () => {
  document.getElementById('formCategoria').reset();
  document.getElementById('categoriaId').value = '';
  document.getElementById('modalCategoriaTitle').textContent = 'Nueva Categoria';
  openModal('modalCategoria');
});

async function editCategoria(id) {
  try {
    const c = await CategoriasService.getById(id);
    if (!c) return;
    document.getElementById('categoriaId').value   = c.id;
    document.getElementById('catNombre').value     = c.nombre              || '';
    document.getElementById('catPrecio').value     = c.precio_base_mensual ?? '';
    document.getElementById('catFondeadero').value = c.tasa_fondeadero     ?? '';
    document.getElementById('modalCategoriaTitle').textContent = 'Editar Categoria';
    openModal('modalCategoria');
  } catch (err) {
    showError('No se pudo cargar la categoria: ' + err.message);
  }
}

async function removeCategoria(id) {
  try {
    const c = await CategoriasService.getById(id);
    confirmDelete(
      `¿Eliminar la categoria "${c?.nombre}"? Las embarcaciones vinculadas perderan su categoria.`,
      async () => {
        try {
          await CategoriasService.delete(id);
          await renderCategorias();
        } catch (err) {
          showError('No se pudo eliminar la categoria: ' + err.message);
        }
      }
    );
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById('formCategoria').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  setSubmitting(btn, true);
  try {
    const idVal = document.getElementById('categoriaId').value;
    const data = {
      nombre:              document.getElementById('catNombre').value.trim(),
      precio_base_mensual: parseFloat(document.getElementById('catPrecio').value)     || 0,
      tasa_fondeadero:     parseFloat(document.getElementById('catFondeadero').value) || 0,
    };
    if (idVal) data.id = idVal;
    const catGuardada = await CategoriasService.save(data);
    if (_importPostCategoriaGuardada) {
      const cb = _importPostCategoriaGuardada;
      _importPostCategoriaGuardada = null;
      cb(catGuardada);
    }
    closeModal('modalCategoria');
    await renderCategorias();
  } catch (err) {
    showError('No se pudo guardar la categoria: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

// ─── MÉTODOS DE PAGO ─────────────────────────────────────────────────────────

async function renderMetodosPago() {
  const tbody = document.getElementById('tablaMetodosPago');
  if (!tbody) return;
  setTableLoading(tbody, 2);
  try {
    const metodos = await MetodosPagoService.getAll();
    if (metodos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="empty-row">Sin métodos registrados</td></tr>';
      return;
    }
    tbody.innerHTML = metodos.map(m => `<tr>
      <td><strong>${escHTML(m.nombre)}</strong></td>
      <td>
        <button class="btn-action-outline" onclick="editMetodoPago('${escHTML(String(m.id))}','${escHTML(m.nombre)}')" title="Editar">${ICON.edit}</button>
        <button class="btn-action-outline delete" onclick="removeMetodoPago('${escHTML(String(m.id))}')" title="Eliminar">${ICON.trash}</button>
      </td>
    </tr>`).join('');
  } catch (err) {
    console.error('renderMetodosPago:', err);
    setTableError(tbody, 2);
  }
}

document.getElementById('btnNuevoMetodoPago').addEventListener('click', () => {
  document.getElementById('formMetodoPago').reset();
  document.getElementById('metodoPagoId').value = '';
  document.getElementById('modalMetodoPagoTitle').textContent = 'Nuevo Método de Pago';
  openModal('modalMetodoPago');
});



function editMetodoPago(id, nombre) {
  document.getElementById('metodoPagoId').value      = id;
  document.getElementById('metodoPagoNombre').value  = nombre;
  document.getElementById('modalMetodoPagoTitle').textContent = 'Editar Método de Pago';
  openModal('modalMetodoPago');
}

async function removeMetodoPago(id) {
  confirmDelete('¿Eliminar este método de pago?', async () => {
    try {
      await MetodosPagoService.delete(id);
      await Promise.all([renderMetodosPago(), renderMetodosPagoDropdown()]);
      showToast('Método de pago eliminado.');
    } catch (err) {
      showError('No se pudo eliminar: ' + err.message);
    }
  });
}

document.getElementById('formMetodoPago').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarMetodoPago');
  setSubmitting(btn, true);
  try {
    await MetodosPagoService.save({
      id:     document.getElementById('metodoPagoId').value || undefined,
      nombre: document.getElementById('metodoPagoNombre').value.trim(),
    });
    closeModal('modalMetodoPago');
    await Promise.all([renderMetodosPago(), renderMetodosPagoDropdown()]);
    showToast('Método de pago guardado.');
  } catch (err) {
    showError('No se pudo guardar: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

// ─── PAGOS / CUOTAS ──────────────────────────────────────────────────────────

async function verDetalleCuota(cuotaId) {
  try {
    const cuota = await CuotasService.getById(cuotaId);
    if (!cuota) return;

    const servicio   = Number(cuota.monto_servicio   ?? 0);
    const iva        = Number(cuota.iva              ?? 0);
    const fondeadero = Number(cuota.monto_fondeadero ?? 0);
    const total      = Number(cuota.monto            ?? 0);

    document.getElementById('modalDetalleCuotaTitle').textContent = 'Detalle de Cuota';
    document.getElementById('dcConcepto').textContent  = cuota.concepto || '';
    document.getElementById('dcServicio').textContent  = `$ ${formatMonto(servicio)}`;
    document.getElementById('dcIva').textContent       = `$ ${formatMonto(iva)}`;
    document.getElementById('dcFondeadero').textContent = `$ ${formatMonto(fondeadero)}`;
    document.getElementById('dcTotal').textContent     = `$ ${formatMonto(total)}`;

    openModal('modalDetalleCuota');
  } catch (err) {
    showError('No se pudo cargar el detalle: ' + err.message);
  }
}

async function renderCuotas() {
  const tbody = document.getElementById('tablaCuotas');
  setTableLoading(tbody, 7);
  try {
    const [cuotas, extras, clientes, embarcaciones] = await Promise.all([
      CuotasService.getAll(),
      PagosService.getExtras(),
      ClientesService.getAll(),
      EmbarcacionesService.getAll(),
    ]);
    const clienteMap     = new Map(clientes.map(c => [String(c.id), c]));
    const embarcacionMap = new Map(embarcaciones.map(e => [String(e.id), e]));

    // Categorias para mostrar en columna Embarcacion
    const categorias    = await CategoriasService.getAll();
    const categoriaMap  = new Map(categorias.map(c => [String(c.id), c]));

    // Helper: "YYYY-MM" → "Ene 2025"
    const _MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    function _periodoLabel(p) {
      if (!p) return '—';
      const [y, m] = p.split('-');
      return `${_MESES[parseInt(m, 10) - 1] || m} ${y}`;
    }

    // Poblar select de clientes si aún no está lleno
    const selectCliente = document.getElementById('filtroClienteCuotas');
    if (selectCliente.options.length <= 1) {
      clientes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        opt.textContent = c.nombre;
        selectCliente.appendChild(opt);
      });
    }

    // Normalizar extras para que sean compatibles con los filtros de rango
    // (se añade `periodo` derivado de fecha_pago para que _cuotaMatchesFiltro funcione)
    const extrasNorm = extras.map(p => ({
      ...p,
      _tipo:   'extra',
      periodo: p.fecha_pago ? p.fecha_pago.slice(0, 7) : '',
    }));
    const cuotasNorm = cuotas.map(c => ({ ...c, _tipo: 'mensualidad' }));

    // Leer filtros
    const clienteId = document.getElementById('filtroClienteCuotas').value;

    // Combinar ambos tipos siempre
    let pool = [...cuotasNorm, ...extrasNorm];

    // Ordenar por periodo desc
    pool.sort((a, b) => (a.periodo > b.periodo ? -1 : a.periodo < b.periodo ? 1 : 0));

    let list = pool.filter(item => {
      if (!_cuotaMatchesFiltro(item)) return false;
      if (clienteId && String(item.cliente_id) !== clienteId) return false;
      if (_searchCuotas) {
        const q = normalize(_searchCuotas);
        const cli  = clienteMap.get(String(item.cliente_id));
        const emb  = item.embarcacion_id ? embarcacionMap.get(String(item.embarcacion_id)) : null;
        const hayConcepto    = normalize(item.concepto   || '').includes(q);
        const hayCliente     = normalize(cli?.nombre     || '').includes(q);
        const hayEmbarcacion = normalize(emb?.nombre     || '').includes(q);
        if (!hayConcepto && !hayCliente && !hayEmbarcacion) return false;
      }
      return true;
    });

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Sin registros para los filtros seleccionados</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(item => {
      const cliente     = clienteMap.get(String(item.cliente_id));
      const embarcacion = item.embarcacion_id ? embarcacionMap.get(String(item.embarcacion_id)) : null;
      const categoria   = embarcacion?.categoria_id ? categoriaMap.get(String(embarcacion.categoria_id)) : null;
      const embCell     = embarcacion
        ? escHTML(embarcacion.nombre) + (categoria ? ` <span style="color:var(--text-muted);font-size:12px">(${escHTML(categoria.nombre)})</span>` : '')
        : '—';
      const cid         = escHTML(String(item.id));

      if (item._tipo === 'extra') {
        // ── Fila de Ingreso Extra ──────────────────────────────────────────────
        const fechaLabel = item.fecha_pago ? item.fecha_pago.slice(0, 10) : item.periodo;
        return `<tr>
          <td>${escHTML(item.concepto || '—')} <span class="badge badge-violet">EXTRA</span></td>
          <td>—</td>
          <td>${escHTML(fechaLabel)}</td>
          <td>${escHTML(cliente ? cliente.nombre : '—')}</td>
          <td>$ ${formatMonto(Number(item.monto))}</td>
          <td><span class="badge badge-green">Cobrado</span></td>
          <td>
            <div style="display:flex;align-items:center;gap:4px">
              <button class="btn-action-outline delete" onclick="eliminarExtra('${cid}')" title="Eliminar">${ICON.trash}</button>
            </div>
          </td>
        </tr>`;
      }

      // ── Fila de Mensualidad / Cuota ────────────────────────────────────────
      const montoTotal  = Number(item.monto);
      const montoPagado = Number(item.monto_pagado ?? 0);
      const montoResta  = montoTotal - montoPagado;

      const montoInner = montoPagado > 0
        ? `<div class="cuota-monto-detail">
             <span class="cuota-monto-total">Total: <strong>$ ${formatMonto(montoTotal)}</strong></span>
             <span class="cuota-monto-pagado">Pagado: <strong>$ ${formatMonto(montoPagado)}</strong></span>
             <span class="cuota-monto-resta ${montoResta > 0 ? 'resta-pendiente' : ''}">Resta: <strong>$ ${formatMonto(montoResta)}</strong></span>
           </div>`
        : `$ ${formatMonto(montoTotal)}`;

      const montoCell = `<button class="cuota-monto-link" onclick="verDetalleCuota('${cid}')" title="Ver desglose IVA">${montoInner}</button>`;

      let btnPrincipal;
      if (item.estado === 'pendiente' || item.estado === 'parcial') {
        const label = item.estado === 'parcial' ? 'Registrar Abono' : 'Registrar Pago';
        btnPrincipal = `<button class="btn btn-primary" onclick="registrarPago('${cid}')"
          style="font-size:12px;padding:4px 10px">${label}</button>`;
      } else if (item.comprobante_url) {
        btnPrincipal = `<a href="${escHTML(item.comprobante_url)}" target="_blank" rel="noopener"
          class="btn btn-secondary" style="font-size:12px;padding:4px 10px">Ver Comprobante</a>`;
      } else {
        btnPrincipal = '';
      }
      return `<tr>
        <td>Mensualidad ${escHTML(_periodoLabel(item.periodo))}</td>
        <td>${embCell}</td>
        <td>${escHTML(item.periodo)}</td>
        <td>${escHTML(cliente ? cliente.nombre : '—')}</td>
        <td>${montoCell}</td>
        <td>${estadoCuotaBadge(item.estado)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
            ${btnPrincipal}
            <button class="btn-action-outline" onclick="editarCuota('${cid}')" title="Editar">${ICON.edit}</button>
            <button class="btn-action-outline delete" onclick="eliminarCuota('${cid}')" title="Eliminar">${ICON.trash}</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('renderCuotas:', err);
    setTableError(tbody, 7);
    showError('No se pudieron cargar las cuotas: ' + err.message);
  }
}

/** Llamado desde el botón inline de la tabla. Pre-carga el modal con datos de la cuota. */
async function registrarPago(cuotaId) {
  try {
    const [cuota, metodos] = await Promise.all([
      CuotasService.getById(cuotaId),
      MetodosPagoService.getAll().catch(() => []),
    ]);
    if (!cuota) return;
    const montoTotal  = Number(cuota.monto);
    const acumulado   = Number(cuota.monto_pagado ?? 0);
    const resta       = montoTotal - acumulado;

    document.getElementById('pagoModalCuotaId').value = cuotaId;
    document.getElementById('pagoInfoConcepto').textContent = cuota.concepto || '—';
    // Muestra Total / Pagado / Resta si hay pago parcial previo
    document.getElementById('pagoInfoMonto').textContent = acumulado > 0
      ? `Total: $ ${formatMonto(montoTotal)} | Pagado: $ ${formatMonto(acumulado)} | Resta: $ ${formatMonto(resta)}`
      : `$ ${formatMonto(montoTotal)}`;
    document.getElementById('pagoMontoPagar').value          = resta.toFixed(2);
    document.getElementById('pagoMontoPagar').max            = resta.toFixed(2);
    document.getElementById('pagoUploadError').hidden        = true;

    // Poblar select de métodos de pago
    const sel = document.getElementById('pagoMetodo');
    sel.innerHTML = '';
    const defaults = metodos.length
      ? metodos
      : [{ nombre: 'Efectivo' }, { nombre: 'Transferencia Bancaria' }, { nombre: 'Cheque' }, { nombre: 'Otro' }];
    defaults.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.nombre;
      opt.textContent = m.nombre;
      sel.appendChild(opt);
    });

    openModal('modalRegistrarPago');
  } catch (err) {
    showError('No se pudo cargar la cuota: ' + err.message);
  }
}

document.getElementById('btnConfirmarPago').addEventListener('click', async () => {
  const btn         = document.getElementById('btnConfirmarPago');
  const cuotaId     = document.getElementById('pagoModalCuotaId').value;
  const montoPagado = parseFloat(document.getElementById('pagoMontoPagar').value);
  const metodoPago  = document.getElementById('pagoMetodo').value;
  const errEl       = document.getElementById('pagoUploadError');
  errEl.hidden      = true;

  if (!montoPagado || montoPagado <= 0) {
    errEl.textContent = 'El monto debe ser mayor a 0.';
    errEl.hidden = false;
    return;
  }

  setSubmitting(btn, true);
  try {
    await CuotasService.registrarPago(cuotaId, { montoPagado, metodoPago });
    closeModal('modalRegistrarPago');
    await Promise.all([renderCuotas(), renderDashboard(), renderClientes(), renderUltimosMovimientos()]);
    showToast('Pago registrado correctamente.');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    setSubmitting(btn, false);
  }
});


// ── ELIMINAR INGRESO EXTRA ────────────────────────────────────────────────────

async function eliminarExtra(pagoId) {
  confirmDelete('¿Eliminar este ingreso extra?', async () => {
    try {
      await PagosService.deleteExtra(pagoId);
      await renderCuotas();
    } catch (err) {
      showError('No se pudo eliminar el ingreso extra: ' + err.message);
    }
  });
}

// ── INGRESOS EXTRA ───────────────────────────────────────────────────────────

document.getElementById('btnIngresoExtra').addEventListener('click', async () => {
  document.getElementById('formIngresoExtra').reset();
  document.getElementById('ingresoExtraError').hidden = true;

  // Poblar clientes
  const selCli = document.getElementById('ingresoExtraCliente');
  selCli.innerHTML = '<option value="">— Sin cliente específico —</option>';
  try {
    const clis = await ClientesService.getAll();
    clis.forEach(c => {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = c.nombre;
      selCli.appendChild(opt);
    });
  } catch (_) { /* no crítico */ }

  // Poblar métodos
  const selMet = document.getElementById('ingresoExtraMetodo');
  selMet.innerHTML = '';
  try {
    const mets = await MetodosPagoService.getAll();
    const lista = mets.length
      ? mets
      : [{ nombre: 'Efectivo' }, { nombre: 'Transferencia Bancaria' }, { nombre: 'Cheque' }, { nombre: 'Otro' }];
    lista.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.nombre; opt.textContent = m.nombre;
      selMet.appendChild(opt);
    });
  } catch (_) {
    selMet.innerHTML = '<option>Efectivo</option>';
  }

  openModal('modalIngresoExtra');
});

document.getElementById('formIngresoExtra').addEventListener('submit', async e => {
  e.preventDefault();
  const btn  = document.getElementById('btnGuardarIngresoExtra');
  const errEl = document.getElementById('ingresoExtraError');
  errEl.hidden = true;
  setSubmitting(btn, true);
  try {
    await PagosService.registrarExtra({
      clienteId:  document.getElementById('ingresoExtraCliente').value  || null,
      monto:      document.getElementById('ingresoExtraMonto').value,
      concepto:   document.getElementById('ingresoExtraConcepto').value.trim(),
      metodoPago: document.getElementById('ingresoExtraMetodo').value,
    });
    closeModal('modalIngresoExtra');
    await Promise.all([renderDashboard(), renderClientes(), renderCuotas(), renderUltimosMovimientos()]);
    showToast('Ingreso extra registrado correctamente.');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    setSubmitting(btn, false);
  }
});

// ── EDITAR CUOTA ─────────────────────────────────────────────────────────────

async function editarCuota(cuotaId) {
  try {
    const cuota = await CuotasService.getById(cuotaId);
    if (!cuota) return;
    document.getElementById('editCuotaId').value       = cuota.id;
    document.getElementById('editCuotaConcepto').value = cuota.concepto || '';
    document.getElementById('editCuotaMonto').value    = cuota.monto    ?? '';
    document.getElementById('editCuotaPeriodo').value  = cuota.periodo  || '';  // ya viene 'YYYY-MM'
    // Mostrar el estado calculado (read-only, siempre derivado de los pagos)
    const montoPagado = Number(cuota.monto_pagado ?? 0);
    const montoTotal  = Number(cuota.monto ?? 0);
    const estadoCalc  = montoPagado <= 0 ? 'pendiente'
                      : montoPagado >= montoTotal ? 'pagado'
                      : 'parcial';
    document.getElementById('editCuotaEstado').value = estadoCalc;
    openModal('modalEditarCuota');
  } catch (err) {
    showError('No se pudo cargar la cuota: ' + err.message);
  }
}

document.getElementById('formEditarCuota').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  setSubmitting(btn, true);
  try {
    const id = document.getElementById('editCuotaId').value;
    await CuotasService.update(id, {
      concepto: document.getElementById('editCuotaConcepto').value.trim(),
      monto:    parseFloat(document.getElementById('editCuotaMonto').value),
      periodo:  document.getElementById('editCuotaPeriodo').value,
    });
    closeModal('modalEditarCuota');
    await Promise.all([renderCuotas(), renderDashboard(), renderClientes()]);
  } catch (err) {
    showError('No se pudo guardar la cuota: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

// ── ELIMINAR CUOTA ────────────────────────────────────────────────────────────

async function eliminarCuota(cuotaId) {
  try {
    const cuota = await CuotasService.getById(cuotaId);
    const esPagada = cuota?.estado === 'pagado';
    const msg = esPagada
      ? `¿Eliminar la cuota "${cuota.concepto}"?\nEsta cuota ya fue PAGADA. Al eliminarla el saldo del cliente se recalculara automaticamente.`
      : `¿Eliminar la cuota "${cuota?.concepto}"?`;
    confirmDelete(msg, async () => {
      try {
        await CuotasService.delete(cuotaId);
        await Promise.all([renderCuotas(), renderDashboard(), renderClientes()]);
      } catch (err) {
        showError('No se pudo eliminar la cuota: ' + err.message);
      }
    });
  } catch (err) {
    showError(err.message);
  }
}

// ── EXPORTAR CSV ──────────────────────────────────────────────────────────────

// ─── EXPORTAR CSV ─────────────────────────────────────────────────────────────

/**
 * Helper genérico: genera y descarga un CSV.
 * BOM UTF-8 (﻿) incluido para que Excel abra tildes y ñ correctamente en Windows.
 */
function _descargarCSV(headers, rows, filename) {
  const esc  = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv  = [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── EXPORT FACTURACIÓN ───────────────────────────────────────────────────────

async function _buildExportPool() {
  const [cuotas, extras, clientes, embarcaciones] = await Promise.all([
    CuotasService.getAll(),
    PagosService.getExtras(),
    ClientesService.getAll(),
    EmbarcacionesService.getAll(),
  ]);
  const cliMap = new Map(clientes.map(c => [String(c.id), c]));
  const embMap = new Map(embarcaciones.map(e => [String(e.id), e]));
  const cliId  = document.getElementById('filtroClienteCuotas').value;

  const cuotasNorm = cuotas.map(c => ({ ...c, _tipo: 'mensualidad', periodo: c.periodo }));
  const extrasNorm = extras.map(p => ({
    ...p, _tipo: 'extra', periodo: p.fecha_pago ? p.fecha_pago.slice(0, 7) : '',
  }));

  let pool = [...cuotasNorm, ...extrasNorm].filter(item => {
    if (!_cuotaMatchesFiltro(item)) return false;
    if (cliId && String(item.cliente_id) !== cliId) return false;
    if (_searchCuotas) {
      const q   = normalize(_searchCuotas);
      const cli = cliMap.get(String(item.cliente_id));
      const emb = item.embarcacion_id ? embMap.get(String(item.embarcacion_id)) : null;
      if (!normalize(item.concepto || '').includes(q) &&
          !normalize(cli?.nombre   || '').includes(q) &&
          !normalize(emb?.nombre   || '').includes(q)) return false;
    }
    return true;
  });
  pool.sort((a, b) => (a.periodo > b.periodo ? -1 : a.periodo < b.periodo ? 1 : 0));
  return { pool, cliMap };
}

function _exportFilename(ext) {
  const s = { todo: 'todos', mes: 'este_mes', '3m': '3_meses', '6m': '6_meses', ano: 'ultimo_año' };
  const r = _getRangoActivo();
  const sufijo = _filtroFecha.preset !== 'custom'
    ? (s[_filtroFecha.preset] || 'filtrado')
    : `${r.desde || 'inicio'}_a_${r.hasta || 'fin'}`;
  return `reporte_facturacion_${sufijo}.${ext}`;
}

const EXPORT_HEADERS = ['Periodo', 'Tipo', 'Concepto', 'Cliente', 'DNI/RUC', 'Monto', 'Estado'];

function _poolToObjects(pool, cliMap) {
  return pool.map(item => {
    const cli = cliMap.get(String(item.cliente_id));
    return {
      Periodo:  item._tipo === 'extra' ? (item.fecha_pago ? item.fecha_pago.slice(0, 10) : item.periodo ?? '') : (item.periodo ?? ''),
      Tipo:     item._tipo === 'extra' ? 'Ingreso Extra' : 'Mensualidad',
      Concepto: item.concepto ?? '',
      Cliente:  cli?.nombre ?? '',
      'DNI/RUC': cli?.dni  ?? '',
      Monto:    Number(item.monto ?? 0),
      Estado:   item._tipo === 'extra' ? 'Cobrado' : (item.estado ?? ''),
    };
  });
}

function exportarCSV(pool, cliMap) {
  const data = _poolToObjects(pool, cliMap);
  const csv  = Papa.unparse(data, { header: true, columns: EXPORT_HEADERS });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: _exportFilename('csv') });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`CSV exportado — ${data.length} registro${data.length !== 1 ? 's' : ''} (${_etiquetaRango()})`, 'success');
}

async function exportarExcelPro(pool, cliMap) {
  const data = _poolToObjects(pool, cliMap);
  const wb   = new ExcelJS.Workbook();
  const ws   = wb.addWorksheet('Facturación');

  ws.columns = EXPORT_HEADERS.map(h => ({
    header: h,
    key:    h,
    width:  Math.min(Math.max(h.length, ...data.map(r => String(r[h] ?? '').length)) + 4, 42),
  }));

  ws.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FF2563EB' } } };
  });

  data.forEach(r => {
    const row       = ws.addRow(EXPORT_HEADERS.map(h => r[h]));
    const montoCell = row.getCell(6);
    montoCell.numFmt    = '"$"#,##0.00';
    montoCell.alignment = { horizontal: 'right' };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = Object.assign(document.createElement('a'), { href: url, download: _exportFilename('xlsx') });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Excel exportado — ${data.length} registro${data.length !== 1 ? 's' : ''} (${_etiquetaRango()})`, 'success');
}

// ─── EXPORT GENÉRICO (Clientes / Embarcaciones) ───────────────────────────────

/** Recibe array de objetos planos; exporta CSV via PapaParse. */
function exportarDataCSV(data, nombreArchivo) {
  const csv  = Papa.unparse(data, { header: true });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo + '.csv' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`CSV exportado — ${data.length} registro${data.length !== 1 ? 's' : ''}`, 'success');
}

/** Recibe array de objetos planos; exporta Excel con encabezados gris-azulado y anchos automáticos. */
async function exportarDataExcel(data, nombreArchivo) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(nombreArchivo);

  ws.columns = headers.map(h => ({
    header: h,
    key:    h,
    width:  Math.min(Math.max(h.length, ...data.map(r => String(r[h] ?? '').length)) + 4, 42),
  }));

  ws.getRow(1).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FF1E3A5F' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });

  data.forEach(r => ws.addRow(headers.map(h => r[h])));

  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = Object.assign(document.createElement('a'), { href: url, download: nombreArchivo + '.xlsx' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Excel exportado — ${data.length} registro${data.length !== 1 ? 's' : ''}`, 'success');
}

// ─── BUILDERS DE POOL FILTRADO ────────────────────────────────────────────────

async function _buildClientesPool() {
  const [clientes, cuotas] = await Promise.all([ClientesService.getAll(), CuotasService.getAll()]);
  const saldoMap = new Map();
  cuotas.forEach(c => {
    const cid = String(c.cliente_id);
    if (c.estado === 'pendiente') saldoMap.set(cid, (saldoMap.get(cid) || 0) + Number(c.monto));
    else if (c.estado === 'parcial') saldoMap.set(cid, (saldoMap.get(cid) || 0) + Math.max(0, Number(c.monto) - Number(c.monto_pagado ?? 0)));
  });

  let pool;
  if (_filtroEstadoCli === 'bajas')   pool = clientes.filter(c => (c.estado || 'Activo') === 'Baja');
  else if (_filtroEstadoCli === 'activos') pool = clientes.filter(c => (c.estado || 'Activo') === 'Activo');
  else pool = [...clientes];

  const estadoFil  = document.getElementById('filtroEstadoCliente').value;
  const sortNombre = document.getElementById('sortClienteNombre').value;
  const sortDeuda  = document.getElementById('sortClienteDeuda').value;

  if (_filtroEstadoCli !== 'bajas') {
    pool = pool.filter(c => {
      const s = saldoMap.get(String(c.id)) || 0;
      if (estadoFil === 'aldia'  && s > 0)  return false;
      if (estadoFil === 'deudor' && s <= 0) return false;
      return true;
    });
  }

  if      (sortDeuda  === 'mayor') pool.sort((a, b) => (saldoMap.get(String(b.id)) || 0) - (saldoMap.get(String(a.id)) || 0));
  else if (sortDeuda  === 'menor') pool.sort((a, b) => (saldoMap.get(String(a.id)) || 0) - (saldoMap.get(String(b.id)) || 0));
  else if (sortNombre === 'az')    pool.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  else if (sortNombre === 'za')    pool.sort((a, b) => (b.nombre || '').localeCompare(a.nombre || '', 'es'));

  if (_searchClientes) {
    const f = normalize(_searchClientes);
    pool = pool.filter(c => normalize(c.nombre).includes(f) || normalize(c.dni).includes(f) || normalize(String(c.id)).includes(f));
  }

  return pool.map(c => ({
    Nombre:            c.nombre    ?? '',
    'DNI/RUC':         c.dni       ?? '',
    Telefono:          c.telefono  ?? '',
    Email:             c.email     ?? '',
    Direccion:         c.direccion ?? '',
    Estado:            c.estado    ?? 'Activo',
    'Saldo Pendiente': saldoMap.get(String(c.id)) ?? 0,
  }));
}

async function _buildEmbarcacionesPool() {
  const [embarcaciones, clientes, categorias] = await Promise.all([
    EmbarcacionesService.getAll(),
    ClientesService.getAll(),
    CategoriasService.getAll(),
  ]);
  const clienteMap   = new Map(clientes.map(c   => [String(c.id), c]));
  const categoriaMap = new Map(categorias.map(c => [String(c.id), c]));

  const filter = document.getElementById('searchEmbarcaciones').value;
  let list = embarcaciones;

  if (_filtroEstadoEmb !== 'todos') {
    const estadoTarget = _filtroEstadoEmb === 'activo' ? 'Activo' : 'Baja';
    list = list.filter(e => {
      const titular = e.propietario_id ? clienteMap.get(String(e.propietario_id)) : null;
      return (titular?.estado ?? 'Activo') === estadoTarget;
    });
  }

  if (filter) {
    const f = normalize(filter);
    list = list.filter(e => {
      const cat     = e.categoria_id   ? categoriaMap.get(String(e.categoria_id))   : null;
      const titular = e.propietario_id ? clienteMap.get(String(e.propietario_id))   : null;
      return normalize(e.nombre).includes(f)       || normalize(e.matricula).includes(f)    ||
             normalize(e.marca).includes(f)        || normalize(e.modelo).includes(f)       ||
             normalize(e.motorizacion).includes(f) || normalize(cat?.nombre).includes(f)    ||
             normalize(titular?.nombre).includes(f);
    });
  }

  return list.map(e => {
    const propId  = e.propietario_id ?? e.propietarioId;
    const titular = propId ? clienteMap.get(String(propId)) : null;
    const cat     = e.categoria_id ? categoriaMap.get(String(e.categoria_id)) : null;
    return {
      Nombre:       e.nombre      ?? '',
      Matricula:    e.matricula   ?? '',
      Categoria:    cat?.nombre   ?? '—',
      Titular:      titular?.nombre ?? '—',
      'Eslora (m)': e.eslora      ?? '',
      Motorizacion: e.motorizacion ?? '',
      Notas:        e.notas       ?? '',
    };
  });
}

// ─── DROPDOWN EXPORTAR ────────────────────────────────────────────────────────

document.getElementById('btnExportDropdown').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('exportDropdownMenu').classList.toggle('open');
});

// Cierra todos los dropdowns de exportación al hacer click fuera
document.addEventListener('click', () => {
  ['exportDropdownMenu', 'exportCliDropdownMenu', 'exportEmbDropdownMenu']
    .forEach(id => document.getElementById(id)?.classList.remove('open'));
});

// ── Runner genérico: toggle del dropdown, llama al builder y a la función de export
async function _runEntityExport({ toggleId, menuId, dataFn, formato, filename }) {
  const toggle = document.getElementById(toggleId);
  document.getElementById(menuId)?.classList.remove('open');
  setSubmitting(toggle, true);
  try {
    const data = await dataFn();
    if (!data.length) { showError('Sin registros para exportar con el filtro actual.'); return; }
    if (formato === 'csv') exportarDataCSV(data, filename);
    else                   await exportarDataExcel(data, filename);
  } catch (err) {
    showError('No se pudo exportar: ' + err.message);
  } finally {
    setSubmitting(toggle, false);
  }
}

// ── Runner Facturación (usa su propio builder y funciones de formato)
async function _runExport(exportFn) {
  const toggle = document.getElementById('btnExportDropdown');
  document.getElementById('exportDropdownMenu').classList.remove('open');
  setSubmitting(toggle, true);
  try {
    const { pool, cliMap } = await _buildExportPool();
    if (pool.length === 0) { showError('Sin registros para exportar con el filtro actual.'); return; }
    await exportFn(pool, cliMap);
  } catch (err) {
    showError('No se pudo exportar: ' + err.message);
  } finally {
    setSubmitting(toggle, false);
  }
}

document.getElementById('btnExportarCSV').addEventListener('click', () => _runExport(exportarCSV));
document.getElementById('btnExportarExcel').addEventListener('click', () => _runExport(exportarExcelPro));

// ── Dropdown Clientes
document.getElementById('btnExportCliDropdown').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('exportCliDropdownMenu').classList.toggle('open');
});
document.getElementById('btnExportarClientesCSV').addEventListener('click', () =>
  _runEntityExport({ toggleId: 'btnExportCliDropdown', menuId: 'exportCliDropdownMenu', dataFn: _buildClientesPool, formato: 'csv', filename: 'Listado_Clientes_2026' })
);
document.getElementById('btnExportarClientesExcel').addEventListener('click', () =>
  _runEntityExport({ toggleId: 'btnExportCliDropdown', menuId: 'exportCliDropdownMenu', dataFn: _buildClientesPool, formato: 'excel', filename: 'Listado_Clientes_2026' })
);

// ── Dropdown Embarcaciones
document.getElementById('btnExportEmbDropdown').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('exportEmbDropdownMenu').classList.toggle('open');
});
document.getElementById('btnExportarEmbarcacionesCSV').addEventListener('click', () =>
  _runEntityExport({ toggleId: 'btnExportEmbDropdown', menuId: 'exportEmbDropdownMenu', dataFn: _buildEmbarcacionesPool, formato: 'csv', filename: 'Listado_Embarcaciones_2026' })
);
document.getElementById('btnExportarEmbarcacionesExcel').addEventListener('click', () =>
  _runEntityExport({ toggleId: 'btnExportEmbDropdown', menuId: 'exportEmbDropdownMenu', dataFn: _buildEmbarcacionesPool, formato: 'excel', filename: 'Listado_Embarcaciones_2026' })
);

// ─── GENERAR MENSUALIDADES ────────────────────────────────────────────────────

document.getElementById('btnGenerarMensualidades').addEventListener('click', () => {
  const now  = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  document.getElementById('mensualidadPeriodo').value = `${yyyy}-${mm}`;
  openModal('modalMensualidades');
});

document.getElementById('btnConfirmarMensualidades').addEventListener('click', async () => {
  const btn     = document.getElementById('btnConfirmarMensualidades');
  const periodo = document.getElementById('mensualidadPeriodo').value;
  if (!periodo) { showError('Selecciona un periodo.'); return; }
  setSubmitting(btn, true);
  try {
    const cuotas = await CuotasService.generarMensualidades(periodo);
    closeModal('modalMensualidades');
    const msg = cuotas.length === 1
      ? `1 cuota nueva generada para ${periodo}.`
      : `${cuotas.length} cuotas nuevas generadas para ${periodo}.`;
    // eslint-disable-next-line no-alert
    alert(msg);
  } catch (err) {
    showError('Error al generar mensualidades: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

// ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────

async function renderConfiguracion() {
  try {
    const cfg = await ConfiguracionService.get();
    if (cfg) {
      if (cfg.nombre_guarderia)   document.getElementById('configNombreGuarderia').value  = cfg.nombre_guarderia;
      if (cfg.direccion)          document.getElementById('configDireccion').value         = cfg.direccion;
      if (cfg.telefono)           document.getElementById('configTelefono').value          = cfg.telefono;
      if (cfg.cuit)               document.getElementById('configCuit').value              = cfg.cuit;
      if (cfg.precio_pie_eslora   != null) document.getElementById('configPrecioPieEslora').value   = cfg.precio_pie_eslora;
      if (cfg.precio_fijo_mensual != null) document.getElementById('configPrecioFijoMensual').value = cfg.precio_fijo_mensual;
    }
  } catch (_) { /* no crítico */ }
  // Email siempre del usuario autenticado (solo lectura)
  if (_currentUser?.email) {
    document.getElementById('configEmail').value = _currentUser.email;
  }
  // Limpiar campos de contraseña
  document.getElementById('configPassword').value        = '';
  document.getElementById('configPasswordConfirm').value = '';
  document.getElementById('configError').hidden          = true;
  document.getElementById('configSuccess').hidden        = true;
}

document.getElementById('formConfiguracion').addEventListener('submit', async e => {
  e.preventDefault();
  const btn      = document.getElementById('btnGuardarConfig');
  const errEl    = document.getElementById('configError');
  const successEl = document.getElementById('configSuccess');
  errEl.hidden     = true;
  successEl.hidden = true;
  setSubmitting(btn, true);
  try {
    const nombre            = document.getElementById('configNombreGuarderia').value.trim();
    const direccion         = document.getElementById('configDireccion').value.trim();
    const telefono          = document.getElementById('configTelefono').value.trim();
    const cuit              = document.getElementById('configCuit').value.trim();
    const pass              = document.getElementById('configPassword').value;
    const passConf          = document.getElementById('configPasswordConfirm').value;
    const _pn = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
    const precio_pie_eslora   = _pn(document.getElementById('configPrecioPieEslora').value);
    const precio_fijo_mensual = _pn(document.getElementById('configPrecioFijoMensual').value);

    // Guardar datos de la guardería (incluye tasas)
    await ConfiguracionService.save({ nombre_guarderia: nombre, direccion, telefono, cuit, precio_pie_eslora, precio_fijo_mensual });

    // Actualizar nombre en el header
    if (nombre) document.getElementById('nombreGuarderia').textContent = nombre;

    // Cambiar contraseña solo si se rellenó
    if (pass) {
      if (pass !== passConf) {
        errEl.textContent = 'Las claves no coinciden.';
        errEl.hidden = false;
        return;
      }
      if (pass.length < 6) {
        errEl.textContent = 'La clave debe tener al menos 6 caracteres.';
        errEl.hidden = false;
        return;
      }
      await ConfiguracionService.updatePassword(pass);
    }

    document.getElementById('configPassword').value        = '';
    document.getElementById('configPasswordConfirm').value = '';
    successEl.hidden = false;
    setTimeout(() => { successEl.hidden = true; closeModal('modalPerfil'); }, 1800);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    setSubmitting(btn, false);
  }
});

// Eye toggles para campos de contraseña
document.getElementById('btnEyePassword').addEventListener('click', () => {
  const inp = document.getElementById('configPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});
document.getElementById('btnEyePasswordConfirm').addEventListener('click', () => {
  const inp = document.getElementById('configPasswordConfirm');
  inp.type = inp.type === 'password' ? 'text' : 'password';
});

// renderMetodosPagoDropdown es un no-op: el dropdown fue eliminado de Facturación.
// Se mantiene la función para que las llamadas existentes no rompan.
async function renderMetodosPagoDropdown() { /* dropdown eliminado — no-op */ }

// ─── AUTENTICACIÓN ────────────────────────────────────────────────────────────

/** Muestra la app y oculta el login. Rellena el email en el topnav. */
function showApp(user) {
  _currentUser = user;
  document.getElementById('loginScreen').classList.add('app-hidden');
  document.getElementById('appShell').classList.remove('app-hidden');
  const userEmailEl = document.getElementById('userEmail');
  if (userEmailEl && user?.email) userEmailEl.textContent = user.email;
}

/** Muestra la pantalla de login y oculta toda la app. */
function showLogin() {
  document.getElementById('loginScreen').classList.remove('app-hidden');
  document.getElementById('appShell').classList.add('app-hidden');
}

/**
 * Carga inicial: muestra la pestaña Inicio de inmediato y
 * pre-carga el resto de pestañas en segundo plano.
 */
async function loadAppData() {
  // Inicializar UI del filtro compartido con el estado por defecto ('mes')
  _syncFiltroUI();

  // Cargar nombre de guardería en el topnav
  ConfiguracionService.get().then(cfg => {
    if (cfg?.nombre_guarderia) {
      document.getElementById('nombreGuarderia').textContent = cfg.nombre_guarderia;
    }
  }).catch(() => {});

  await switchTab('inicio');
  // Pre-carga en background para acceso instantáneo al cambiar de pestaña
  renderCuotas().catch(console.error);
  renderDashboard().catch(console.error);
}

// ─── PERFIL GUARDERIA (modal) ─────────────────────────────────────────────────

document.getElementById('btnPerfilGuarderia').addEventListener('click', async () => {
  await renderConfiguracion();
  openModal('modalPerfil');
});

document.getElementById('linkForgotPassword').addEventListener('click', e => {
  e.preventDefault();
  // Pre-rellena con el email que el usuario haya escrito en el login
  document.getElementById('resetEmail').value   = document.getElementById('loginEmail').value;
  document.getElementById('resetMsg').hidden    = true;
  document.getElementById('resetMsg').style.color = '';
  openModal('modalResetPassword');
});

document.getElementById('btnEnviarReset').addEventListener('click', async () => {
  const btn   = document.getElementById('btnEnviarReset');
  const email = document.getElementById('resetEmail').value.trim();
  const msgEl = document.getElementById('resetMsg');
  if (!email) {
    msgEl.textContent = 'Ingresa tu correo electronico.';
    msgEl.style.color = '';
    msgEl.hidden = false;
    return;
  }
  setSubmitting(btn, true);
  try {
    await AuthService.resetPassword(email);
    msgEl.textContent   = `Enlace enviado a ${email}. Revisa tu bandeja de entrada.`;
    msgEl.style.color   = 'green';
    msgEl.hidden        = false;
  } catch (err) {
    msgEl.textContent = err.message;
    msgEl.style.color = '';
    msgEl.hidden      = false;
  } finally {
    setSubmitting(btn, false);
  }
});

document.getElementById('formLogin').addEventListener('submit', async e => {
  e.preventDefault();
  const btn   = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.hidden = true;
  setSubmitting(btn, true);
  try {
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const user = await AuthService.login(email, password);
    showApp(user);
    await loadAppData();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    setSubmitting(btn, false);
  }
});

async function doLogout() {
  // Cerrar modal de perfil si está abierto
  closeModal('modalPerfil');

  try {
    // Cerrar sesión en Supabase directamente
    await db.auth.signOut();
  } catch (_) {
    // Ignorar errores de red — continuar con el logout local de todas formas
  }

  // Limpiar estado local
  localStorage.clear();
  _currentUser = null;

  // Resetear nombre de guardería al valor por defecto
  const nombreEl = document.getElementById('nombreGuarderia');
  if (nombreEl) nombreEl.textContent = 'Mi Guarderia';

  // Volver a la pantalla de login
  showLogin();
}

document.getElementById('btnLogout').addEventListener('click', doLogout);
document.getElementById('btnCerrarSesionPerfil').addEventListener('click', doLogout);

// ─── INIT ─────────────────────────────────────────────────────────────────────

/**
 * Punto de entrada de la app.
 * Comprueba si hay sesión activa antes de mostrar cualquier UI.
 */
async function initAuth() {
  try {
    const user = await AuthService.checkSession();
    if (user) {
      showApp(user);
      await loadAppData();
    } else {
      showLogin();
    }
  } catch {
    // En caso de error de red al verificar, mostrar login como fallback seguro.
    showLogin();
  }
}

initAuth();

// ─── RECUPERACION DE CONTRASEÑA ───────────────────────────────────────────────

db.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    document.getElementById('formLogin').hidden = true;
    document.getElementById('formNuevaPassword').hidden = false;
  }
});

async function confirmarNuevaClave(nuevaPassword) {
  const errEl = document.getElementById('nuevaPasswordError');
  const btn   = document.getElementById('btnActualizarPassword');
  errEl.hidden = true;
  setSubmitting(btn, true);
  try {
    const { error } = await db.auth.updateUser({ password: nuevaPassword });
    if (error) throw error;
    alert('Contraseña actualizada con éxito.');
    location.reload();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    setSubmitting(btn, false);
  }
}

document.getElementById('formNuevaPassword').addEventListener('submit', e => {
  e.preventDefault();
  confirmarNuevaClave(document.getElementById('nuevaPasswordInput').value);
});

// ─── PREFECTURA / REGINAVE ────────────────────────────────────────────────────

let _pnaData = []; // filas actuales del preview; el exportador las lee directo

async function renderPrefectura() {
  const tbody = document.getElementById('tablaPNA');
  const desde = document.getElementById('pnaDesde').value;
  const hasta = document.getElementById('pnaHasta').value;

  document.getElementById('pnaAlertas').innerHTML = '';
  _pnaData = [];

  // Sin rango → no hay "movimiento" que mostrar; evita listar barcos fantasma
  if (!desde && !hasta) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Seleccioná al menos una fecha para filtrar movimientos.</td></tr>';
    return;
  }

  setTableLoading(tbody, 9);

  // True solo si la fecha (string YYYY-MM-DD o ISO) cae dentro del rango activo
  const enRango = (fecha) => {
    if (!fecha) return false;
    const d = String(fecha).slice(0, 10);
    return (!desde || d >= desde) && (!hasta || d <= hasta);
  };

  try {
    const [embarcaciones, clientes] = await Promise.all([
      EmbarcacionesService.getAll(),
      ClientesService.getAll(),
    ]);
    const clienteMap = new Map(clientes.map(c => [String(c.id), c]));

    // FILTRO ESTRICTO: solo aparece si tuvo un movimiento (alta o baja) en el rango
    const list = embarcaciones.filter(e =>
      enRango(e.created_at) || enRango(e.fecha_baja)
    );

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-row">Sin movimientos en el rango seleccionado.</td></tr>';
      return;
    }

    _pnaData = list.map(e => {
      const propId = e.propietario_id ?? e.cliente_id;
      const cli    = propId ? clienteMap.get(String(propId)) : null;

      // BAJA si fecha_baja cae en el rango; ALTA si solo created_at está en rango
      const esBaja          = enRango(e.fecha_baja);
      const tipoMovimiento  = esBaja ? 'BAJA' : 'ALTA';
      const fechaMovimiento = esBaja
        ? String(e.fecha_baja).slice(0, 10)
        : String(e.created_at ?? '').slice(0, 10);

      return {
        id:                 e.id,
        Embarcacion:        e.nombre    ?? '',
        Matricula:          e.matricula ?? '',
        'Eslora (m)':       e.eslora    != null ? String(e.eslora) : '',
        'Manga (m)':        e.manga     != null ? String(e.manga)  : '',
        Titular:            cli?.nombre ?? '—',
        'DNI/RUC':          cli?.dni    ?? '',
        'Fecha Movimiento': fechaMovimiento,
        Movimiento:         tipoMovimiento,
        Observaciones:      '',
        _sinMatricula:      !e.matricula?.trim(),
        _sinDni:            !cli?.dni?.trim(),
        _esBaja:            esBaja,
      };
    });

    const nMat = _pnaData.filter(r => r._sinMatricula).length;
    const nDni = _pnaData.filter(r => r._sinDni).length;
    _renderPnaAlertas(nMat, nDni);

    const WARN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

    tbody.innerHTML = _pnaData.map((row, i) => {
      const movBadge = row._esBaja
        ? '<span class="badge badge-red">BAJA</span>'
        : '<span class="badge badge-green">ALTA</span>';

      // Filas de BAJA: fondo rojo suave + texto ligeramente oscurecido
      // Filas con campos faltantes: fondo amarillo (solo si no es BAJA)
      const rowStyle = row._esBaja
        ? 'style="background:rgba(239,68,68,.06)"'
        : (row._sinMatricula || row._sinDni) ? 'style="background:rgba(251,191,36,.07)"' : '';

      const inputStyle = `width:100%;padding:4px 8px;border:1.5px solid ${row._esBaja ? 'rgba(239,68,68,.35)' : 'var(--border)'};border-radius:6px;font-size:12px;font-family:inherit;background:var(--surface);color:var(--text)`;

      return `<tr ${rowStyle}>
        <td><strong style="${row._esBaja ? 'color:#b91c1c' : ''}">${escHTML(row.Embarcacion)}</strong></td>
        <td>${row._sinMatricula ? WARN_SVG + ' ' : ''}${row.Matricula ? escHTML(row.Matricula) : '<em style="color:var(--text-muted)">—</em>'}</td>
        <td>${escHTML(row['Eslora (m)']) || '—'}</td>
        <td>${escHTML(row['Manga (m)']) || '—'}</td>
        <td>${escHTML(row.Titular)}</td>
        <td>${row._sinDni ? WARN_SVG + ' ' : ''}${row['DNI/RUC'] ? escHTML(row['DNI/RUC']) : '<em style="color:var(--text-muted)">—</em>'}</td>
        <td>${escHTML(row['Fecha Movimiento'])}</td>
        <td>${movBadge}</td>
        <td><input type="text" class="pna-obs-input" data-idx="${i}" placeholder="Sin observaciones" style="${inputStyle}" /></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.pna-obs-input').forEach(input => {
      input.addEventListener('input', ev => {
        _pnaData[Number(ev.target.dataset.idx)].Observaciones = ev.target.value;
      });
    });

  } catch (err) {
    setTableError(tbody, 9);
    showError('No se pudo cargar la vista previa: ' + err.message);
  }
}

function _renderPnaAlertas(nMat, nDni) {
  const el = document.getElementById('pnaAlertas');
  const partes = [];
  if (nMat > 0) partes.push(`<strong>${nMat}</strong> embarcación${nMat !== 1 ? 'es' : ''} sin matrícula`);
  if (nDni > 0) partes.push(`<strong>${nDni}</strong> titular${nDni !== 1 ? 'es' : ''} sin DNI/RUC`);
  if (!partes.length) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;padding:10px 14px;font-size:13px;color:#92400e">
      <svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="flex-shrink:0">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <span>Atenci&#243;n: ${partes.join(' · ')}. La planilla podr&#237;a ser observada por la autoridad marítima.</span>
    </div>`;
}

async function exportarPlanillaPNA() {
  if (!_pnaData.length) {
    showError('Primero cargue la vista previa antes de exportar.');
    return;
  }

  // Captura el estado final de los inputs de Observaciones antes de exportar
  document.querySelectorAll('.pna-obs-input').forEach(input => {
    _pnaData[Number(input.dataset.idx)].Observaciones = input.value;
  });

  const COLS = ['Embarcacion', 'Matricula', 'Eslora (m)', 'Manga (m)', 'Titular', 'DNI/RUC', 'Fecha Movimiento', 'Movimiento', 'Observaciones'];
  const hoy  = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Planilla PNA');

  // Fila 1: título mergeado
  ws.addRow([`MOVIMIENTO DE EMBARCACIONES - NAVIGESTOR - ${hoy}`]);
  ws.mergeCells(1, 1, 1, COLS.length);
  const tCell = ws.getCell('A1');
  tCell.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
  tCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  tCell.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 28;

  // Fila 2: encabezados estilo Pro (gris-azulado)
  ws.addRow(COLS);
  ws.getRow(2).eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FF1E3A5F' } };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border    = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });

  // Anchos automáticos (calculados sobre datos + header)
  ws.columns = COLS.map(h => ({
    width: Math.min(Math.max(h.length, ..._pnaData.map(r => String(r[h] ?? '').length)) + 4, 44),
  }));

  // Filas de datos
  _pnaData.forEach(row => {
    const dataRow = ws.addRow(COLS.map(h => row[h] ?? ''));
    if (row._sinMatricula || row._sinDni) {
      dataRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
      });
    }
  });

  const desde   = document.getElementById('pnaDesde').value || 'todo';
  const hasta   = document.getElementById('pnaHasta').value || 'todo';
  const buffer  = await wb.xlsx.writeBuffer();
  const blob    = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url     = URL.createObjectURL(blob);
  const a       = Object.assign(document.createElement('a'), { href: url, download: `Planilla_PNA_${desde}_${hasta}.xlsx` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Planilla PNA exportada — ${_pnaData.length} embarcación${_pnaData.length !== 1 ? 'es' : ''}`, 'success');
}

document.getElementById('btnCargarPNA').addEventListener('click', renderPrefectura);
document.getElementById('btnExportarPNA').addEventListener('click', async () => {
  const btn = document.getElementById('btnExportarPNA');
  setSubmitting(btn, true);
  try   { await exportarPlanillaPNA(); }
  catch (err) { showError('No se pudo exportar: ' + err.message); }
  finally { setSubmitting(btn, false); }
});

// ─── IMPORTACIÓN MASIVA ────────────────────────────────────────────────────────

let _importRows                = [];
let _importEntity              = null; // 'clientes' | 'embarcaciones'
let _importPostClienteGuardado  = null; // callback para re-validar fila tras crear cliente desde importador
let _importPostCategoriaGuardada = null; // callback para actualizar filas tras crear categoría desde importador

/** Lee el archivo y devuelve array de objetos planos (una fila = un objeto). */
// Keywords that identify a header row in an Excel sheet
const _HEADER_KEYWORDS = /nombre|dni|ruc|matricula|eslora|manga|email|telefono|propietario|titular|categor|tipo|clase/i;

/** Picks a sheet interactively when the workbook has multiple sheets. */
function _elegirHoja(wb) {
  return new Promise(resolve => {
    const sheets = wb.worksheets.map(ws => ws.name);
    if (sheets.length === 1) { resolve(wb.worksheets[0]); return; }

    // Build inline picker inside the import section
    const container = document.getElementById('importFileName');
    const prev = container.innerHTML;
    container.innerHTML =
      `<span style="color:#374151;font-weight:600">Seleccioná una hoja:</span> ` +
      sheets.map((name, i) =>
        `<button onclick="this.closest('#importFileName')._resolve(${i})"
                 style="margin:0 4px;padding:2px 10px;border:1px solid #3B82F6;border-radius:6px;
                        background:#EFF6FF;color:#1D4ED8;cursor:pointer;font-size:.85rem">${escHTML(name)}</button>`
      ).join('') +
      `<span id="sheetPickerHint" style="color:#6B7280;font-size:.8rem;margin-left:8px">
        (el archivo tiene ${sheets.length} hojas)</span>`;
    container._resolve = idx => {
      container.innerHTML = prev;
      resolve(wb.worksheets[idx]);
    };
  });
}

/** Scans rows top-down and returns the first row index (1-based) whose cells
 *  contain known header keywords, or 1 as a fallback. */
function _detectarFilaHeaders(ws) {
  let headerRow = 1;
  ws.eachRow((row, idx) => {
    if (headerRow !== 1) return; // already found
    if (idx > 20) return;        // give up after 20 rows
    const text = row.values.map(v => String(v ?? '')).join(' ');
    if (_HEADER_KEYWORDS.test(text)) headerRow = idx;
  });
  return headerRow;
}

async function _parsearArchivo(file) {
  if (file.name.toLowerCase().endsWith('.csv')) {
    // Auto-detect delimiter (PapaParse uses '' to trigger its own detection)
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: '',   // '' = auto-detect (handles ; | \t , etc.)
        complete: r => resolve(r.data),
        error:    e => reject(new Error(e.message)),
      });
    });
  }

  // XLSX via ExcelJS
  const buffer = await file.arrayBuffer();
  const wb     = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Multi-sheet selection
  const ws = await _elegirHoja(wb);

  // Header row detection
  const headerRowIdx = _detectarFilaHeaders(ws);
  const headers = [];
  const data    = [];

  ws.eachRow((row, idx) => {
    if (idx < headerRowIdx) return; // skip rows above headers
    if (idx === headerRowIdx) {
      row.eachCell({ includeEmpty: true }, cell =>
        headers.push(String(cell.value ?? '').trim())
      );
      return;
    }
    const obj = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const h = headers[col - 1];
      if (h) obj[h] = String(cell.text ?? cell.value ?? '').trim();
    });
    if (Object.values(obj).some(v => v !== '' && v != null)) data.push(obj);
  });
  return data;
}

/**
 * Detecta la entidad (clientes / embarcaciones) por los headers del archivo
 * y normaliza cada fila al esquema que usan los servicios.
 */
function _mapearColumnas(rawRows) {
  if (!rawRows.length) return { entity: 'clientes', mappedRows: [] };

  // Normalización de encabezados: sin tildes, minúsculas, sin chars especiales
  const _normKey = s => String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\-\.\(\)_&,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Patrones de detección por campo (orden importa: más específico primero)
  const PAT = {
    propietario: /propietario|dueno|owner|titular|nombre.*apellido|apellido.*nombre|apellido/,
    matricula:   /matricula|reginave|sigla|nro.*reg|num.*reg|registro/,
    // DNI: solo palabras clave inequívocas — nunca "año", "hp", etc.
    dni:         /\bdni\b|\bcuit\b|\bcuil\b|\bdoc\b|documento|\bruc\b/,
    // Campos que NUNCA son DNI aunque coincidan con el patrón
    _excluirDni: /\bano\b|año|construc|\bhp\b|potencia|\bkw\b|calado|motor|eslora|manga|largo|ancho|peso|\bid\b|marca|modelo|hidrau|serie|loa/,
    nombre:      /nombre.*emb|nombre.*lancha|nombre.*barco|nombre.*veh|vehiculo|embarcacion|barco|boat/,
    eslora:      /eslora|largo|length/,
    manga:       /manga|beam|ancho/,
    telefono:    /telefono|celular|phone|movil|\btel\b|\bcel\b/,
    email:       /email|correo|mail/,
    contacto:    /\bcontacto\b|\bcontact\b/,
    direccion:   /direccion|domicilio|address|calle/,
    localidad:   /localidad|ciudad|pueblo|partido|provincia/,
    notas:       /notas|notes|observacion|comentario/,
    categoria:   /categor|tipo.*emb|clase.*emb|tipo.*barco|\btipo\b|\bclase\b/,
  };

  /**
   * Valida por contenido que una columna realmente contiene DNIs/CUITs.
   * Muestrea hasta 30 filas: si ≥80 % tienen entre 7 y 11 dígitos → es DNI.
   * "Año" tiene 4 dígitos → falla. "HP" tiene 1-3 → falla. DNI 7-8 → pasa. CUIT 11 → pasa.
   */
  const _validarContenidoDni = (colName) => {
    const muestra = rawRows.slice(0, 30)
      .map(r => String(r[colName] ?? '').replace(/[.\-\s]/g, ''))
      .filter(v => v.length > 0);
    if (!muestra.length) return false;
    const validos = muestra.filter(v => /^\d{7,11}$/.test(v));
    return validos.length / muestra.length >= 0.8;
  };

  // Pre-computa qué columnas son realmente DNI (header + contenido)
  const dniCols = new Set(
    Object.keys(rawRows[0]).filter(col => {
      const key = _normKey(col);
      return PAT.dni.test(key) && !PAT._excluirDni.test(key) && _validarContenidoDni(col);
    })
  );

  const headersNorm = Object.keys(rawRows[0]).map(h => _normKey(h));
  const entity = headersNorm.some(h => PAT.matricula.test(h) || PAT.eslora.test(h) || PAT.manga.test(h))
    ? 'embarcaciones'
    : 'clientes';

  const mappedRows = rawRows.map(raw => {
    const r = {};
    Object.entries(raw).forEach(([k, v]) => {
      const key = _normKey(k);
      const val = String(v ?? '').trim();

      // DNI — solo columnas pre-validadas por header Y contenido
      if (dniCols.has(k))                                 { r.dni         = val.replace(/[.\-\s]/g, ''); return; }
      // Propietario — antes que nombre genérico
      if (PAT.propietario.test(key))                      { r.propietario = val; return; }
      // Matrícula — antes que nombre genérico
      if (PAT.matricula.test(key))                        { r.matricula   = val; return; }
      // Nombre de embarcación (patrones específicos)
      if (PAT.nombre.test(key))                           { r.nombre      = val; return; }
      // Nombre genérico: no sobreescribe si ya fue asignado por un patrón específico
      if (/\bnombre\b/.test(key))                         { r.nombre      = r.nombre || val; return; }

      // Resto de campos
      if (PAT.eslora.test(key))    r.eslora    = Number(v) || '';
      if (PAT.manga.test(key))     r.manga     = Number(v) || '';
      if (PAT.telefono.test(key))  r.telefono  = val;
      if (PAT.email.test(key))     r.email     = val;
      if (PAT.contacto.test(key))  r.contacto  = val;
      if (PAT.direccion.test(key)) r.direccion = val;
      if (PAT.localidad.test(key)) r.localidad = val;
      if (PAT.notas.test(key))     r.notas     = val;
      if (PAT.categoria.test(key)) r.categoria = val;
    });
    return r;
  });

  return { entity, mappedRows };
}

/** Devuelve array de strings con los errores de validación de la fila. */
function _validarFilaImport(row, entity) {
  const err = [];
  if (!row.nombre?.trim())                                     err.push('Nombre vacío');
  if (entity === 'clientes'      && !row.dni?.trim())          err.push('DNI vacío');
  if (entity === 'embarcaciones' && !row.matricula?.trim())    err.push('Matrícula vacía');
  return err;
}

// ── Helpers de resolución para importación ──────────────────────────────────

/** Normaliza para comparación: sin tildes, minúsculas, espacios colapsados. */
function _normImport(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Coeficiente de Sørensen-Dice sobre bigramas — mucho más preciso que solapamiento de chars. */
function _diceSim(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const bigrams = s => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i++) set.add(s[i] + s[i + 1]);
    return set;
  };
  const ba = bigrams(a), bb = bigrams(b);
  if (!ba.size || !bb.size) return 0;
  let inter = 0;
  for (const bg of ba) if (bb.has(bg)) inter++;
  return (2 * inter) / (ba.size + bb.size);
}

/**
 * Busca la categoría más parecida al nombre dado.
 * Orden: exacta → contiene (mín. 4 chars) → Dice ≥ 80 %.
 * Si ningún nivel supera el umbral, devuelve null (badge naranja).
 */
function _fuzzyCategoria(nombre, categorias) {
  if (!nombre || !categorias.length) return null;
  const n = _normImport(nombre);

  // 1. Exacta
  let match = categorias.find(c => _normImport(c.nombre) === n);
  if (match) return match;

  // 2. Contiene en cualquier dirección (solo si la cadena corta tiene ≥ 4 chars)
  match = categorias.find(c => {
    const cn = _normImport(c.nombre);
    const shorter = n.length <= cn.length ? n : cn;
    if (shorter.length < 4) return false;
    return cn.includes(n) || n.includes(cn);
  });
  if (match) return match;

  // 3. Dice sobre bigramas con umbral estricto del 80 %
  let best = null, bestScore = 0;
  for (const c of categorias) {
    const score = _diceSim(n, _normImport(c.nombre));
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= 0.8 ? best : null;
}

/**
 * Re-evalúa el estado de validación de una fila concreta tras resolver propietario/categoría.
 * Solo actualiza _errores y _accion; no toca los datos ni los flags de resolución.
 */
function revalidarFila(idx) {
  const row = _importRows[idx];
  if (!row) return;
  row._errores = _validarFilaImport(row, _importEntity);
  if (row._errores.length) {
    row._accion = 'error';
  } else if (row._accion === 'error') {
    // Fue un error que ya se resolvió → vuelve a su estado natural
    row._accion = row._duplicado ? 'actualizar' : 'nuevo';
  }
  // Si ya era 'nuevo', 'actualizar' u 'omitir', lo conserva
}

/**
 * Abre el modal de Nuevo Cliente pre-cargado con los datos de la fila del importador.
 * Al guardar, re-valida la fila y actualiza el badge sin reprocesar el archivo.
 */
/**
 * Analiza un campo "Contacto" libre y extrae email y/o teléfono.
 * Soporta valores mixtos como "juan@mail.com / 11-223344".
 * Retorna { email, telefono } con los valores encontrados (string vacío si no aplica).
 */
function _clasificarContacto(valor) {
  const resultado = { email: '', telefono: '' };
  if (!valor) return resultado;

  // Parte por separadores comunes entre email y teléfono en la misma celda
  const partes = String(valor).split(/[\s\/|,;]+/).map(p => p.trim()).filter(Boolean);

  for (const parte of partes) {
    if (parte.includes('@')) {
      // Es un email
      if (!resultado.email) resultado.email = parte.toLowerCase();
    } else if (/^[\d\+\-\s\(\)\.]{6,}$/.test(parte)) {
      // Es un teléfono: solo dígitos, +, -, espacios, paréntesis, puntos — mínimo 6 chars
      if (!resultado.telefono) resultado.telefono = parte.trim();
    }
  }

  return resultado;
}

/** Convierte "JUAN PABLO pérez" → "Juan Pablo Pérez" */
function _titleCase(s) {
  return String(s ?? '').trim()
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, ch => ch.toUpperCase());
}

function _importCrearCliente(idx) {
  const row = _importRows[idx];
  if (!row) return;

  // Normalización al vuelo
  const nombre = _titleCase(row.propietario ?? '');
  const dni    = String(row.dni ?? '').replace(/\D/g, '');  // solo dígitos

  // Clasificar campo "Contacto" libre (solo cubre lo que las columnas dedicadas no tienen)
  const contactoClasif = _clasificarContacto(row.contacto ?? '');
  const email    = (String(row.email    ?? '').trim() || contactoClasif.email).toLowerCase();
  const telefono =  String(row.telefono ?? '').trim() || contactoClasif.telefono;
  // Dirección: concatena localidad si existe y no está ya incluida
  const dirBase  = String(row.direccion ?? '').trim();
  const loc      = String(row.localidad ?? '').trim();
  const direccion = dirBase && loc && !dirBase.toLowerCase().includes(loc.toLowerCase())
    ? `${dirBase}, ${loc}`
    : dirBase || loc;

  // Pre-carga completa del formulario
  document.getElementById('formCliente').reset();
  document.getElementById('clienteId').value    = '';
  document.getElementById('cliEstado').value    = 'Activo';
  document.getElementById('cliNombre').value    = nombre;
  document.getElementById('cliDni').value       = dni;
  document.getElementById('cliEmail').value     = email;
  document.getElementById('cliTelefono').value  = telefono;
  document.getElementById('cliDireccion').value = direccion;
  document.getElementById('modalClienteTitle').textContent = 'Nuevo Cliente (desde importador)';

  // Registrar callback: actualiza TODAS las filas con el mismo propietario y re-valida
  _importPostClienteGuardado = (clienteGuardado) => {
    if (!clienteGuardado?.id) return;
    const nombreNorm = _normImport(_importRows[idx]?.propietario ?? '');
    const dniLimpio  = String(clienteGuardado.dni ?? '').replace(/[.\-\s]/g, '').toLowerCase();
    let actualizadas = 0;
    _importRows.forEach((row, i) => {
      if (!row._propietario_no_encontrado) return;
      const mismoNombre = nombreNorm && _normImport(row.propietario ?? '') === nombreNorm;
      const mismoDni    = dniLimpio  && String(row.dni ?? '').replace(/[.\-\s]/g, '').toLowerCase() === dniLimpio;
      if (mismoNombre || mismoDni) {
        row._propietario_id            = clienteGuardado.id;
        row._propietario_no_encontrado = false;
        revalidarFila(i);
        actualizadas++;
      }
    });
    if (actualizadas > 1) showToast(`Propietario asignado a ${actualizadas} embarcaciones.`, 'success');
    _renderImportPreview(_importEntity);
  };

  openModal('modalCliente');
}

/**
 * Abre el modal de Nueva Categoría pre-cargado con el nombre del Excel.
 * Al guardar, actualiza en masa TODAS las filas del importador que compartan
 * el mismo nombre de categoría (normalizado), sin reprocesar el archivo.
 */
function _importCrearCategoria(nombreExcel) {
  const nombreNorm = _normImport(nombreExcel);

  // Pre-cargar el modal con el nombre normalizado
  document.getElementById('formCategoria').reset();
  document.getElementById('categoriaId').value = '';
  document.getElementById('catNombre').value   = _titleCase(nombreExcel);
  document.getElementById('modalCategoriaTitle').textContent = 'Nueva Categoría (desde importador)';

  // Callback masivo: actualiza todas las filas con la misma categoría y re-valida
  _importPostCategoriaGuardada = (catGuardada) => {
    if (!catGuardada?.id) return;
    let actualizadas = 0;
    _importRows.forEach((row, i) => {
      if (_normImport(row.categoria ?? '') === nombreNorm) {
        row._categoria_id            = catGuardada.id;
        row._categoria_no_encontrada = false;
        revalidarFila(i);
        actualizadas++;
      }
    });
    if (actualizadas > 0) {
      showToast(`Categoría "${catGuardada.nombre}" asignada a ${actualizadas} fila${actualizadas !== 1 ? 's' : ''}.`, 'success');
      _renderImportPreview(_importEntity);
    }
  };

  openModal('modalCategoria');
}

/** Función principal: parsea, cruza con DB y muestra la tabla de vista previa. */
async function procesarImportacion(file) {
  const btn = document.getElementById('btnProcesarImportacion');
  setSubmitting(btn, true);
  document.getElementById('importPreviewSection').hidden = true;
  _importRows   = [];
  _importEntity = null;

  try {
    const rawRows              = await _parsearArchivo(file);
    const { entity, mappedRows } = _mapearColumnas(rawRows);
    _importEntity              = entity;

    if (!mappedRows.length) { showError('El archivo no contiene filas válidas.'); return; }

    // Carga registros existentes para detección de duplicados
    const existentes = entity === 'clientes'
      ? await ClientesService.getAll()
      : await EmbarcacionesService.getAll();

    const claveMap = entity === 'clientes'
      ? new Map(existentes.map(c => [String(c.dni ?? '').replace(/[.\-\s]/g, '').toLowerCase(), c]))
      : new Map(existentes.map(e => [String(e.matricula ?? '').trim().toLowerCase(), e]));

    // Para embarcaciones: carga adicional de clientes y categorías
    let clienteNombreMap = new Map();
    let clienteDniMap    = new Map();
    let categoriasArr    = [];
    if (entity === 'embarcaciones') {
      const [todosClientes, todasCategorias] = await Promise.all([
        ClientesService.getAll(),
        CategoriasService.getAll(),
      ]);
      clienteNombreMap = new Map(todosClientes.map(c => [_normImport(c.nombre), c]));
      clienteDniMap    = new Map(
        todosClientes
          .filter(c => c.dni)
          .map(c => [String(c.dni).replace(/[.\-\s]/g, '').toLowerCase(), c])
      );
      categoriasArr = todasCategorias;
    }

    _importRows = mappedRows.map(row => {
      const clave     = entity === 'clientes'
        ? (row.dni       ?? '').replace(/[.\-\s]/g, '').toLowerCase()
        : (row.matricula ?? '').trim().toLowerCase();
      const existente = clave ? claveMap.get(clave) : null;
      const errores   = _validarFilaImport(row, entity);

      // Resolución de propietario y categoría (solo embarcaciones)
      let _propietario_id           = null;
      let _propietario_no_encontrado = false;
      let _categoria_id             = null;
      let _categoria_no_encontrada  = false;

      if (entity === 'embarcaciones') {
        const tieneDni  = row.dni?.trim();
        const tieneNombre = row.propietario?.trim();
        if (tieneDni || tieneNombre) {
          let cli = null;
          // 1. Búsqueda por DNI/CUIT (más confiable, sin ambigüedad)
          if (tieneDni) cli = clienteDniMap.get(row.dni.toLowerCase());
          // 2. Fallback: búsqueda por nombre normalizado
          if (!cli && tieneNombre) cli = clienteNombreMap.get(_normImport(row.propietario));
          if (cli) _propietario_id = cli.id;
          else     _propietario_no_encontrado = true;
        }
        if (row.categoria?.trim()) {
          const cat = _fuzzyCategoria(row.categoria, categoriasArr);
          _categoria_id            = cat?.id ?? null;
          _categoria_no_encontrada = !cat;
        }
      }

      return {
        ...row,
        _propietario_id,
        _propietario_no_encontrado,
        _categoria_id,
        _categoria_no_encontrada,
        _errores:     errores,
        _duplicado:   !!existente,
        _existenteId: existente?.id ?? null,
        _accion:      errores.length ? 'error' : (existente ? 'actualizar' : 'nuevo'),
      };
    });

    _renderImportPreview(entity);
  } catch (err) {
    showError('No se pudo procesar el archivo: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
}

/** Renderiza la tabla de vista previa con validación y controles de acción. */
function _renderImportPreview(entity) {
  const nNuevos     = _importRows.filter(r => r._accion === 'nuevo').length;
  const nDuplicados = _importRows.filter(r => r._duplicado).length;
  const nErrores    = _importRows.filter(r => r._errores.length).length;

  document.getElementById('importPreviewTitle').textContent =
    entity === 'clientes' ? 'Vista previa — Clientes' : 'Vista previa — Embarcaciones';
  document.getElementById('importPreviewStats').textContent =
    `${_importRows.length} fila${_importRows.length !== 1 ? 's' : ''} detectada${_importRows.length !== 1 ? 's' : ''} · ${nNuevos} nuevos · ${nDuplicados} duplicados · ${nErrores} con errores`;

  const cols   = entity === 'clientes'
    ? ['nombre', 'dni', 'telefono', 'email', 'direccion']
    : ['nombre', 'matricula', 'eslora', 'manga', 'propietario', 'categoria', 'notas'];
  const labels = entity === 'clientes'
    ? ['Nombre', 'DNI/RUC', 'Teléfono', 'Email', 'Dirección']
    : ['Nombre', 'Matrícula', 'Eslora', 'Manga', 'Propietario', 'Categoría', 'Notas'];
  const reqs   = entity === 'clientes' ? ['nombre', 'dni'] : ['nombre', 'matricula'];

  document.getElementById('importPreviewHead').innerHTML = `<tr>
    <th>Estado</th>
    ${labels.map(l => `<th>${l}</th>`).join('')}
    <th>Acción</th>
  </tr>`;

  document.getElementById('importPreviewBody').innerHTML = _importRows.map((row, i) => {
    const tieneError = row._errores.length > 0;

    const rowStyle = tieneError
      ? 'style="background:rgba(239,68,68,.06)"'
      : row._duplicado ? 'style="background:rgba(251,191,36,.07)"' : '';

    const badge = tieneError
      ? `<span class="badge badge-red" title="${escHTML(row._errores.join(', '))}">&#x2717; Error</span>`
      : row._duplicado
        ? '<span class="badge badge-yellow">&#x26A0; Duplicado</span>'
        : '<span class="badge badge-green">&#x2713; Nuevo</span>';

    const celdas = cols.map(col => {
      const val   = row[col] ?? '';
      const falta = reqs.includes(col) && !String(val).trim();
      let extra   = '';

      if (col === 'propietario' && entity === 'embarcaciones') {
        if (row._propietario_id) {
          extra = ' <span title="Propietario encontrado en BD" style="color:#16a34a;font-weight:700">&#x2713;</span>';
        } else if (row._propietario_no_encontrado) {
          extra =
            ' <span title="No encontrado en BD" style="color:#d97706;cursor:help">&#x26A0;</span>' +
            ` <button onclick="_importCrearCliente(${i})"
                style="margin-left:4px;padding:1px 7px;font-size:11px;border:1px solid #d97706;
                       border-radius:5px;background:#fffbeb;color:#92400e;cursor:pointer;
                       white-space:nowrap">+ Crear Cliente</button>`;
        }
      }

      if (col === 'categoria' && entity === 'embarcaciones') {
        if (row._categoria_id) {
          extra = ' <span title="Categoría encontrada en BD" style="color:#16a34a;font-weight:700">&#x2713;</span>';
        } else if (row._categoria_no_encontrada) {
          extra =
            ' <span title="No encontrada en BD" style="color:#d97706;cursor:help">&#x26A0;</span>' +
            ` <button onclick="_importCrearCategoria(${JSON.stringify(row.categoria ?? '')})"
                style="margin-left:4px;padding:1px 7px;font-size:11px;border:1px solid #d97706;
                       border-radius:5px;background:#fffbeb;color:#92400e;cursor:pointer;
                       white-space:nowrap">+ Crear Categoría</button>`;
        }
      }

      return `<td style="${falta ? 'background:rgba(239,68,68,.12);color:#b91c1c;font-weight:600' : ''}">
        ${escHTML(String(val)) || '<em style="color:var(--text-muted)">—</em>'}${extra}
      </td>`;
    }).join('');

    // Una fila de embarcación está "incompleta" si le falta propietario o categoría
    const tieneIncompleto = entity === 'embarcaciones' &&
      (row._propietario_no_encontrado || row._categoria_no_encontrada);

    let accionCell;
    if (tieneError) {
      accionCell = '<em style="color:var(--text-muted);font-size:12px">Corregir en archivo</em>';
    } else if (row._duplicado) {
      const s = (a) => row._accion === a
        ? 'background:var(--accent);color:#fff;border-color:var(--accent)'
        : '';
      const btnActualizar = tieneIncompleto
        ? `<button class="btn btn-secondary" disabled
               title="Completá propietario y categoría antes de actualizar"
               style="padding:4px 10px;font-size:12px;opacity:.4;cursor:not-allowed">Actualizar</button>`
        : `<button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;${s('actualizar')}"
               onclick="_setImportAccion(${i},'actualizar')">Actualizar</button>`;
      accionCell = `<div style="display:flex;gap:5px">
        <button class="btn btn-secondary" style="padding:4px 10px;font-size:12px;${s('omitir')}"
            onclick="_setImportAccion(${i},'omitir')">Omitir</button>
        ${btnActualizar}
      </div>`;
    } else if (tieneIncompleto) {
      accionCell = '<span style="font-size:12px;color:#d97706;font-weight:600">&#x26A0; Pendiente</span>';
    } else {
      accionCell = '<span style="font-size:12px;color:var(--accent);font-weight:600">Se importará</span>';
    }

    return `<tr ${rowStyle}>
      <td>${badge}</td>
      ${celdas}
      <td>${accionCell}</td>
    </tr>`;
  }).join('');

  document.getElementById('importPreviewSection').hidden = false;
}

/** Cambia la acción de una fila duplicada y re-renderiza. Llamado desde onclick inline. */
function _setImportAccion(idx, accion) {
  _importRows[idx]._accion = accion;
  _renderImportPreview(_importEntity);
}

/** Guarda en Supabase todos los registros con acción 'nuevo' o 'actualizar'. */
async function confirmarImportacion() {
  const toSave = _importRows.filter(r => r._accion === 'nuevo' || r._accion === 'actualizar');
  if (!toSave.length) {
    showError('Sin registros para importar (todos omitidos o con errores).');
    return;
  }

  const btn = document.getElementById('btnConfirmarImportacion');
  setSubmitting(btn, true);

  let ok = 0, errCount = 0;

  for (const row of toSave) {
    try {
      if (_importEntity === 'clientes') {
        await ClientesService.save({
          id:        row._accion === 'actualizar' ? row._existenteId : undefined,
          nombre:    row.nombre    ?? '',
          dni:       row.dni       ?? '',
          telefono:  row.telefono  ?? '',
          email:     row.email     ?? '',
          direccion: row.direccion ?? '',
          estado:    'Activo',
        });
      } else {
        await EmbarcacionesService.save({
          id:            row._accion === 'actualizar' ? row._existenteId : undefined,
          nombre:        row.nombre          ?? '',
          matricula:     row.matricula       ?? '',
          eslora:        row.eslora          || null,
          manga:         row.manga           || null,
          notas:         row.notas           ?? '',
          propietario_id: row._propietario_id || null,
          categoria_id:  row._categoria_id   || null,
        });
      }
      ok++;
    } catch (e) {
      console.error('Import row error:', e.message, row);
      errCount++;
    }
  }

  const label = `${ok} registro${ok !== 1 ? 's' : ''} importado${ok !== 1 ? 's' : ''}`;
  showToast(errCount ? `${label} · ${errCount} con error` : label, ok > 0 ? 'success' : 'error');

  if (ok > 0) {
    _importRows   = [];
    _importEntity = null;
    document.getElementById('importPreviewSection').hidden = true;
    document.getElementById('importFileInput').value        = '';
    document.getElementById('importFileName').textContent   = 'Sin archivo seleccionado';
    document.getElementById('btnProcesarImportacion').disabled = true;
    // Refresca la tabla afectada si el usuario está en Maestros
    if (_activeSubTab === 'clientes')      await renderClientes();
    else if (_activeSubTab === 'flota')    await renderEmbarcaciones();
  }

  setSubmitting(btn, false);
}

// ── Listeners de importación
document.getElementById('importFileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  document.getElementById('importFileName').textContent       = file ? file.name : 'Sin archivo seleccionado';
  document.getElementById('btnProcesarImportacion').disabled  = !file;
  document.getElementById('importPreviewSection').hidden      = true;
  _importRows = [];
});

const _importDropzone = document.getElementById('importDropzone');
_importDropzone.addEventListener('dragover', e => {
  e.preventDefault();
  _importDropzone.style.borderColor = 'var(--accent)';
  _importDropzone.style.background  = '#eff6ff';
});
_importDropzone.addEventListener('dragleave', () => {
  _importDropzone.style.borderColor = 'var(--border)';
  _importDropzone.style.background  = 'var(--bg)';
});
_importDropzone.addEventListener('drop', e => {
  e.preventDefault();
  _importDropzone.style.borderColor = 'var(--border)';
  _importDropzone.style.background  = 'var(--bg)';
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const dt  = new DataTransfer();
  dt.items.add(file);
  const inp = document.getElementById('importFileInput');
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
});

document.getElementById('btnProcesarImportacion').addEventListener('click', () => {
  const file = document.getElementById('importFileInput').files[0];
  if (file) procesarImportacion(file);
});

document.getElementById('btnConfirmarImportacion').addEventListener('click', confirmarImportacion);
