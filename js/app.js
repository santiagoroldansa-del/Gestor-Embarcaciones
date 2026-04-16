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
 * @param {string} tabId  'inicio' | 'facturacion' | 'reportes'
 */
async function switchTab(tabId) {
  // Actualizar botones
  document.querySelectorAll('.tab-btn').forEach(b => {
    const isActive = b.dataset.tab === tabId;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive);
  });
  // Actualizar paneles
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById(`tab-${tabId}`);
  if (panel) panel.classList.add('active');

  // Cargar datos según pestaña
  if (tabId === 'inicio')      await Promise.all([renderEmbarcaciones(), renderClientes(), renderCategorias(), renderMetodosPago()]);
  if (tabId === 'facturacion') await Promise.all([renderCuotas(), renderUltimosMovimientos()]);
  if (tabId === 'reportes')    await renderDashboard();
}

// ─── MODALES ──────────────────────────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
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
    document.getElementById('filtroTipoCuota').value     = '';
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

async function renderEmbarcaciones(filter = '') {
  const tbody = document.getElementById('tablaEmbarcaciones');
  setTableLoading(tbody, 6);
  try {
    const [embarcaciones, clientes, categorias] = await Promise.all([
      EmbarcacionesService.getAll(),
      ClientesService.getAll(),
      CategoriasService.getAll(),
    ]);
    const clienteMap   = new Map(clientes.map(c   => [String(c.id), c]));
    const categoriaMap = new Map(categorias.map(c => [String(c.id), c]));

    let list = embarcaciones;
    if (filter) {
      const f = filter.toLowerCase();
      list = list.filter(e => {
        const cat = e.categoria_id ? categoriaMap.get(String(e.categoria_id)) : null;
        return e.nombre?.toLowerCase().includes(f) ||
               e.matricula?.toLowerCase().includes(f) ||
               cat?.nombre?.toLowerCase().includes(f);
      });
    }

    _updatePaginControls('emb', list.length);
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Sin embarcaciones registradas</td></tr>';
      return;
    }
    const _embStart = _pag.emb * PAGE_SIZE;
    tbody.innerHTML = list.slice(_embStart, _embStart + PAGE_SIZE).map(e => {
      const propId  = e.propietario_id ?? e.propietarioId;
      const cliente = propId ? clienteMap.get(String(propId)) : null;
      const cat     = e.categoria_id ? categoriaMap.get(String(e.categoria_id)) : null;
      return `<tr>
        <td><strong>${escHTML(e.nombre)}</strong></td>
        <td><code>${escHTML(e.matricula)}</code></td>
        <td>${escHTML(cat ? cat.nombre : '—')}</td>
        <td>${escHTML(cliente ? cliente.nombre : '—')}</td>
        <td>
          <button class="btn-icon" onclick="editEmbarcacion('${escHTML(String(e.id))}')" title="Editar">&#9998;</button>
          <button class="btn-icon delete" onclick="removeEmbarcacion('${escHTML(String(e.id))}')" title="Eliminar">&#128465;</button>
        </td>
      </tr>`;
    }).join('');
  } catch (err) {
    console.error('renderEmbarcaciones:', err);
    setTableError(tbody, 6);
    showError('No se pudieron cargar las embarcaciones: ' + err.message);
  }
}

document.getElementById('searchEmbarcaciones').addEventListener('input', e => {
  _pag.emb = 0;
  renderEmbarcaciones(e.target.value);
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
    openModal('modalEmbarcacion');
  } catch (err) {
    showError('No se pudo abrir el formulario: ' + err.message);
  }
});

async function editEmbarcacion(id) {
  try {
    const [emb, clientes, categorias] = await Promise.all([
      EmbarcacionesService.getById(id),
      ClientesService.getAll(),
      CategoriasService.getAll(),
    ]);
    if (!emb) return;

    document.getElementById('embarcacionId').value = emb.id;
    document.getElementById('embNombre').value     = emb.nombre    || '';
    document.getElementById('embMatricula').value  = emb.matricula || '';
    document.getElementById('embEslora').value     = emb.eslora    || '';
    document.getElementById('embNotas').value      = emb.notas     || '';

    const propId = emb.propietario_id ?? emb.propietarioId ?? '';
    fillSelect('embPropietario', clientes,   c => c.nombre, propId);
    fillSelect('embCategoria',   categorias, c => `${c.nombre} — ${formatMonto(c.precio_base_mensual)}/mes`, emb.categoria_id ?? '');
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

document.getElementById('formEmbarcacion').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('[type="submit"]');
  setSubmitting(btn, true);
  try {
    const idVal = document.getElementById('embarcacionId').value;
    const data = {
      nombre:        document.getElementById('embNombre').value.trim(),
      matricula:     document.getElementById('embMatricula').value.trim(),
      categoria_id:  document.getElementById('embCategoria').value || null,
      eslora:        document.getElementById('embEslora').value,
      propietario_id: document.getElementById('embPropietario').value || null,
      notas:         document.getElementById('embNotas').value.trim(),
    };
    if (idVal) data.id = idVal;
    await EmbarcacionesService.save(data);
    closeModal('modalEmbarcacion');
    await Promise.all([renderEmbarcaciones(), renderDashboard()]);
  } catch (err) {
    showError('No se pudo guardar la embarcacion: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
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
  setTableLoading(tbody, 6);
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

    // Leer los 3 selectores
    const sortNombre = document.getElementById('sortClienteNombre').value;    // '' | 'az' | 'za'
    const estadoFil  = document.getElementById('filtroEstadoCliente').value;  // '' | 'aldia' | 'deudor'
    const sortDeuda  = document.getElementById('sortClienteDeuda').value;     // '' | 'mayor' | 'menor'

    // Filtrar por estado
    let list = clientes.filter(c => {
      const saldo = saldoMap.get(String(c.id)) || 0;
      if (estadoFil === 'aldia'  && saldo > 0)  return false;
      if (estadoFil === 'deudor' && saldo <= 0) return false;
      return true;
    });

    // Ordenar (prioridad: deuda si está activo, luego nombre)
    if (sortDeuda === 'mayor') {
      list.sort((a, b) => (saldoMap.get(String(b.id)) || 0) - (saldoMap.get(String(a.id)) || 0));
    } else if (sortDeuda === 'menor') {
      list.sort((a, b) => (saldoMap.get(String(a.id)) || 0) - (saldoMap.get(String(b.id)) || 0));
    } else if (sortNombre === 'az') {
      list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    } else if (sortNombre === 'za') {
      list.sort((a, b) => (b.nombre || '').localeCompare(a.nombre || '', 'es'));
    }

    _updatePaginControls('cli', list.length);
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Sin clientes para los filtros seleccionados</td></tr>';
      return;
    }

    // Transición suave: fade out → actualizar → fade in
    tbody.style.opacity = '0';
    const _cliStart = _pag.cli * PAGE_SIZE;
    tbody.innerHTML = list.slice(_cliStart, _cliStart + PAGE_SIZE).map(c => {
      const saldo      = saldoMap.get(String(c.id)) || 0;
      const saldoClass = saldo > 0 ? 'badge-red' : 'badge-green';
      return `<tr>
        <td><strong>${escHTML(c.nombre)}</strong></td>
        <td>${escHTML(c.dni) || '—'}</td>
        <td>${escHTML(c.telefono) || '—'}</td>
        <td>${escHTML(c.email) || '—'}</td>
        <td><span class="badge ${saldoClass}">$ ${formatMonto(saldo)}</span></td>
        <td>
          <button class="btn-icon" onclick="verCuentaCorriente('${escHTML(String(c.id))}')" title="Cuenta Corriente">&#128203;</button>
          <button class="btn-icon" onclick="editCliente('${escHTML(String(c.id))}')" title="Editar">&#9998;</button>
          <button class="btn-icon delete" onclick="removeCliente('${escHTML(String(c.id))}')" title="Eliminar">&#128465;</button>
        </td>
      </tr>`;
    }).join('');
    requestAnimationFrame(() => { tbody.style.opacity = '1'; });

  } catch (err) {
    console.error('renderClientes:', err);
    setTableError(tbody, 6);
    showError('No se pudieron cargar los clientes: ' + err.message);
  }
}

document.getElementById('sortClienteNombre').addEventListener('change', () => { _pag.cli = 0; renderClientes(); });
document.getElementById('filtroEstadoCliente').addEventListener('change', () => { _pag.cli = 0; renderClientes(); });
document.getElementById('sortClienteDeuda').addEventListener('change', () => { _pag.cli = 0; renderClientes(); });

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
  document.getElementById('modalClienteTitle').textContent = 'Nuevo Cliente';
  openModal('modalCliente');
});

async function editCliente(id) {
  try {
    const c = await ClientesService.getById(id);
    if (!c) return;
    document.getElementById('clienteId').value = c.id;
    document.getElementById('cliNombre').value = c.nombre || '';
    document.getElementById('cliDni').value = c.dni || '';
    document.getElementById('cliTelefono').value = c.telefono || '';
    document.getElementById('cliEmail').value = c.email || '';
    document.getElementById('cliDireccion').value = c.direccion || '';
    document.getElementById('modalClienteTitle').textContent = 'Editar Cliente';
    openModal('modalCliente');
  } catch (err) {
    showError('No se pudo cargar el cliente: ' + err.message);
  }
}

async function removeCliente(id) {
  try {
    const c = await ClientesService.getById(id);
    confirmDelete(`¿Eliminar al cliente "${c?.nombre}"?`, async () => {
      try {
        await ClientesService.delete(id);
        await Promise.all([renderClientes(), renderDashboard()]);
      } catch (err) {
        showError('No se pudo eliminar el cliente: ' + err.message);
      }
    });
  } catch (err) {
    showError(err.message);
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

// ─── CUENTA CORRIENTE ─────────────────────────────────────────────────────────

async function verCuentaCorriente(clienteId) {
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

    openModal('modalCuentaCorriente');
  } catch (err) {
    showError('No se pudo cargar la cuenta corriente: ' + err.message);
  }
}

document.getElementById('btnImprimirCC').addEventListener('click', () => window.print());

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
    };
    if (idVal) data.id = idVal;
    await ClientesService.save(data);
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
  setTableLoading(tbody, 4);
  try {
    let list = await CategoriasService.getAll();
    if (filter) {
      const f = filter.toLowerCase();
      list = list.filter(c => c.nombre?.toLowerCase().includes(f));
    }
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Sin categorias registradas</td></tr>';
      return;
    }
    tbody.innerHTML = list.map(c => `<tr>
      <td><strong>${escHTML(c.nombre)}</strong></td>
      <td>${formatMonto(c.precio_base_mensual)}</td>
      <td>${formatDate(c.created_at)}</td>
      <td>
        <button class="btn-icon" onclick="editCategoria('${escHTML(String(c.id))}')" title="Editar">&#9998;</button>
        <button class="btn-icon delete" onclick="removeCategoria('${escHTML(String(c.id))}')" title="Eliminar">&#128465;</button>
      </td>
    </tr>`).join('');
  } catch (err) {
    console.error('renderCategorias:', err);
    setTableError(tbody, 4);
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
    document.getElementById('categoriaId').value = c.id;
    document.getElementById('catNombre').value   = c.nombre || '';
    document.getElementById('catPrecio').value   = c.precio_base_mensual ?? '';
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
      precio_base_mensual: parseFloat(document.getElementById('catPrecio').value),
    };
    if (idVal) data.id = idVal;
    await CategoriasService.save(data);
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
        <button class="btn-icon" onclick="editMetodoPago('${escHTML(String(m.id))}','${escHTML(m.nombre)}')" title="Editar">&#9998;</button>
        <button class="btn-icon delete" onclick="removeMetodoPago('${escHTML(String(m.id))}')" title="Eliminar">&#128465;</button>
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
    const tipoCuota = document.getElementById('filtroTipoCuota').value; // '' | 'mensualidad' | 'extra'

    // Combinar según filtro de tipo
    let pool = [];
    if (tipoCuota !== 'extra')       pool = pool.concat(cuotasNorm);
    if (tipoCuota !== 'mensualidad') pool = pool.concat(extrasNorm);

    // Ordenar por periodo desc
    pool.sort((a, b) => (a.periodo > b.periodo ? -1 : a.periodo < b.periodo ? 1 : 0));

    let list = pool.filter(item => {
      if (!_cuotaMatchesFiltro(item)) return false;
      if (clienteId && String(item.cliente_id) !== clienteId) return false;
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
              <button class="btn-icon delete" onclick="eliminarExtra('${cid}')" title="Eliminar">&#128465;</button>
            </div>
          </td>
        </tr>`;
      }

      // ── Fila de Mensualidad / Cuota ────────────────────────────────────────
      const montoTotal  = Number(item.monto);
      const montoPagado = Number(item.monto_pagado ?? 0);
      const montoResta  = montoTotal - montoPagado;

      const montoCell = montoPagado > 0
        ? `<div class="cuota-monto-detail">
             <span class="cuota-monto-total">Total: <strong>$ ${formatMonto(montoTotal)}</strong></span>
             <span class="cuota-monto-pagado">Pagado: <strong>$ ${formatMonto(montoPagado)}</strong></span>
             <span class="cuota-monto-resta ${montoResta > 0 ? 'resta-pendiente' : ''}">Resta: <strong>$ ${formatMonto(montoResta)}</strong></span>
           </div>`
        : `$ ${formatMonto(montoTotal)}`;

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
            <button class="btn-icon" onclick="editarCuota('${cid}')" title="Editar">&#9998;</button>
            <button class="btn-icon delete" onclick="eliminarCuota('${cid}')" title="Eliminar">&#128465;</button>
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

/** Exporta la lista de cuotas (filtrada por periodo si está activo). */
function exportarCSV(cuotas, clientes) {
  const cliMap = new Map(clientes.map(c => [String(c.id), c]));
  const rows   = cuotas.map(c => {
    const cli     = cliMap.get(String(c.cliente_id));
    const periodo = c._tipo === 'extra'
      ? (c.fecha_pago ? c.fecha_pago.slice(0, 10) : c.periodo ?? '')
      : (c.periodo ?? '');
    const estado  = c._tipo === 'extra' ? 'Cobrado' : (c.estado ?? '');
    const tipo    = c._tipo === 'extra' ? 'Ingreso Extra' : 'Mensualidad';
    return [periodo, tipo, c.concepto ?? '', cli?.nombre ?? '', cli?.dni ?? '', c.monto ?? 0, estado];
  });

  // Nombre de archivo dinámico según el preset activo
  const sufijosNombre = {
    todo:   'todos',
    mes:    'este_mes',
    '3m':   '3_meses',
    '6m':   '6_meses',
    ano:    'ultimo_año',
  };
  const r      = _getRangoActivo();
  const sufijo = _filtroFecha.preset !== 'custom'
    ? (sufijosNombre[_filtroFecha.preset] || 'filtrado')
    : `${r.desde || 'inicio'}_a_${r.hasta || 'fin'}`;
  const filename = `reporte_facturacion_${sufijo}.csv`;

  // Toast confirmatorio
  const etiqueta = _etiquetaRango();
  showToast(`Exportando ${rows.length} registro${rows.length !== 1 ? 's' : ''} — Filtro: ${etiqueta}`, 'success');

  _descargarCSV(
    ['Periodo', 'Tipo', 'Concepto', 'Cliente', 'DNI/RUC', 'Monto', 'Estado'],
    rows,
    filename
  );
}

/** Exporta la lista de clientes con su saldo pendiente calculado. */
function exportarClientesCSV(clientes, cuotas) {
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
  const rows = clientes.map(c => [
    c.nombre ?? '', c.dni ?? '', c.telefono ?? '', c.email ?? '',
    c.direccion ?? '', saldoMap.get(String(c.id)) ?? 0,
  ]);
  _descargarCSV(
    ['Nombre', 'DNI/RUC', 'Telefono', 'Email', 'Direccion', 'Saldo Pendiente'],
    rows,
    `clientes_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

/** Exporta la lista de embarcaciones con categoría y propietario resueltos. */
function exportarEmbarcacionesCSV(embarcaciones, clientes, categorias) {
  const cliMap = new Map(clientes.map(c  => [String(c.id), c]));
  const catMap = new Map(categorias.map(c => [String(c.id), c]));
  const rows   = embarcaciones.map(e => {
    const propId = e.propietario_id ?? e.propietarioId;
    const cli    = propId ? cliMap.get(String(propId)) : null;
    const cat    = e.categoria_id ? catMap.get(String(e.categoria_id)) : null;
    return [
      e.nombre ?? '', e.matricula ?? '', cat?.nombre ?? '',
      cli?.nombre ?? '', e.eslora ?? '', e.notas ?? '',
    ];
  });
  _descargarCSV(
    ['Nombre', 'Matricula', 'Categoria', 'Estado', 'Propietario', 'Eslora (m)', 'Notas'],
    rows,
    `embarcaciones_${new Date().toISOString().slice(0, 10)}.csv`
  );
}

document.getElementById('btnExportarCSV').addEventListener('click', async () => {
  const btn = document.getElementById('btnExportarCSV');
  setSubmitting(btn, true);
  try {
    const [cuotas, extras, clientes] = await Promise.all([
      CuotasService.getAll(),
      PagosService.getExtras(),
      ClientesService.getAll(),
    ]);
    const cliId     = document.getElementById('filtroClienteCuotas').value;
    const tipoCuota = document.getElementById('filtroTipoCuota').value;

    const cuotasNorm = cuotas.map(c => ({ ...c, _tipo: 'mensualidad', periodo: c.periodo }));
    const extrasNorm = extras.map(p => ({
      ...p, _tipo: 'extra', periodo: p.fecha_pago ? p.fecha_pago.slice(0, 7) : '',
    }));
    let pool = [];
    if (tipoCuota !== 'extra')       pool = pool.concat(cuotasNorm);
    if (tipoCuota !== 'mensualidad') pool = pool.concat(extrasNorm);

    const lista = pool.filter(item => {
      if (!_cuotaMatchesFiltro(item)) return false;
      if (cliId && String(item.cliente_id) !== cliId) return false;
      return true;
    });
    if (lista.length === 0) {
      showError('No hay registros para exportar con el filtro actual.');
      return;
    }
    exportarCSV(lista, clientes);
  } catch (err) {
    showError('No se pudo exportar: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

document.getElementById('btnExportarClientesCSV').addEventListener('click', async () => {
  const btn = document.getElementById('btnExportarClientesCSV');
  setSubmitting(btn, true);
  try {
    const [clientes, cuotas] = await Promise.all([
      ClientesService.getAll(),
      CuotasService.getAll(),
    ]);
    if (clientes.length === 0) { showError('No hay clientes para exportar.'); return; }
    exportarClientesCSV(clientes, cuotas);
  } catch (err) {
    showError('No se pudo exportar clientes: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

document.getElementById('btnExportarEmbarcacionesCSV').addEventListener('click', async () => {
  const btn = document.getElementById('btnExportarEmbarcacionesCSV');
  setSubmitting(btn, true);
  try {
    const [embarcaciones, clientes, categorias] = await Promise.all([
      EmbarcacionesService.getAll(),
      ClientesService.getAll(),
      CategoriasService.getAll(),
    ]);
    if (embarcaciones.length === 0) { showError('No hay embarcaciones para exportar.'); return; }
    exportarEmbarcacionesCSV(embarcaciones, clientes, categorias);
  } catch (err) {
    showError('No se pudo exportar embarcaciones: ' + err.message);
  } finally {
    setSubmitting(btn, false);
  }
});

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
      if (cfg.nombre_guarderia) document.getElementById('configNombreGuarderia').value = cfg.nombre_guarderia;
      if (cfg.direccion)        document.getElementById('configDireccion').value        = cfg.direccion;
      if (cfg.telefono)         document.getElementById('configTelefono').value         = cfg.telefono;
      if (cfg.cuit)             document.getElementById('configCuit').value             = cfg.cuit;
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
    const nombre    = document.getElementById('configNombreGuarderia').value.trim();
    const direccion = document.getElementById('configDireccion').value.trim();
    const telefono  = document.getElementById('configTelefono').value.trim();
    const cuit      = document.getElementById('configCuit').value.trim();
    const pass      = document.getElementById('configPassword').value;
    const passConf  = document.getElementById('configPasswordConfirm').value;

    // Guardar datos de la guardería
    await ConfiguracionService.save({ nombre_guarderia: nombre, direccion, telefono, cuit });

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
