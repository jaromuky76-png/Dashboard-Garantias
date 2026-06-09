// repuestos_app.js — Sugerido de Compras con Gestión de Pedidos + Filtros Marca/Período

const LS_KEY    = 'repuestos_order_history';
const LS_CUTOFF = 'repuestos_cutoff';

let allRawData      = [];   // todos los registros raw (con fecha, mes, anio)
let allAggregated   = [];   // todos los items agregados (sin filtro)
let filteredAgg     = [];   // items tras aplicar filtros de marca/período
let currentFiltered = [];   // items tras filtros de tabla
let orderHistory    = {};
let cutoffState     = { month: 0, year: new Date().getFullYear() };
let chartFreq       = null;
let chartQty        = null;

const MESES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Arranque ──────────────────────────────────────────────────────────────────
function startApp() {
    loadPersistedData();

    const data = window.partsData;
    if (!data || data.length === 0) {
        // Reintenta durante 3 segundos por si el archivo grande aun no termino de parsear
        let retries = 0;
        const iv = setInterval(() => {
            retries++;
            const d = window.partsData;
            if (d && d.length > 0) {
                clearInterval(iv);
                initWithData(d);
            } else if (retries > 10) {
                clearInterval(iv);
                renderEmptyTable('No se encontraron datos. Verifica que parts_data.js fue generado (ejecuta dashboard_updater.py).');
            }
        }, 300);
        return;
    }
    initWithData(data);
}

function initWithData(data) {
    try {
        allRawData    = data;
        allAggregated = aggregateParts(allRawData);
        filteredAgg   = allAggregated;

        populatePeriodSelectors();
        populateBrandSelector();
        renderCharts(filteredAgg);
        updateKPIs();
        renderTable();
        updateCutoffStatus();
        setupEventListeners();
    } catch(err) {
        console.error('Error inicializando dashboard:', err);
        renderEmptyTable('Error cargando datos: ' + err.message);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

// ── Persistencia ──────────────────────────────────────────────────────────────
function loadPersistedData() {
    try {
        const h = localStorage.getItem(LS_KEY);
        if (h) orderHistory = JSON.parse(h);
        const c = localStorage.getItem(LS_CUTOFF);
        if (c) cutoffState = JSON.parse(c);
    } catch(e) { orderHistory = {}; cutoffState = { month: 0, year: new Date().getFullYear() }; }
}
function savePersistedData() {
    localStorage.setItem(LS_KEY, JSON.stringify(orderHistory));
    localStorage.setItem(LS_CUTOFF, JSON.stringify(cutoffState));
}

// ── Agregación ────────────────────────────────────────────────────────────────
function aggregateParts(rawRows) {
    const map = new Map();
    rawRows.forEach(p => {
        const partId = (p.codigo_repuesto && p.codigo_repuesto !== 'N/A')
            ? p.codigo_repuesto : (p.descripcion || 'SIN_DESC').toUpperCase();
        const key = `${p.marca}___${partId}`;
        if (!map.has(key)) {
            map.set(key, { key, marca: p.marca || 'DESCONOCIDA',
                codigo: p.codigo_repuesto || 'N/A',
                descripcion: p.descripcion || '', cantidad: 0, ots: new Set(), frecuencia: 0, otDetails: [] });
        }
        const e = map.get(key);
        e.cantidad += (p.cantidad || 1);
        if (p.ot && !e.ots.has(p.ot)) {
            e.ots.add(p.ot);
            e.otDetails.push({ ot: p.ot, mes: p.mes || 'Desconocido' });
        }
        e.frecuencia = e.ots.size;
    });
    return Array.from(map.values()).map(item => {
        let prioridad = 'Puntual', priorityClass = 'badge-low';
        if      (item.frecuencia >= 5) { prioridad = 'ALTA ROTACIÓN';   priorityClass = 'badge-high'; }
        else if (item.frecuencia >= 3) { prioridad = 'ROTACIÓN MEDIA';  priorityClass = 'badge-med';  }
        else if (item.frecuencia >= 2) { prioridad = 'Frecuente';       priorityClass = 'badge-new';  }
        return { ...item, prioridad, priorityClass };
    }).sort((a, b) => b.frecuencia - a.frecuencia || b.cantidad - a.cantidad);
}

// ── Selectores de período y marca ─────────────────────────────────────────────
function populatePeriodSelectors() {
    // Extraer años y meses únicos
    const anios = [...new Set(allRawData.map(r => r.anio).filter(a => typeof a === 'number'))].sort();
    const mesNums = [...new Set(allRawData.map(r => r.mesNum).filter(m => m > 0))].sort((a,b) => a-b);

    const yearOpts = anios.map(y => `<option value="${y}">${y}</option>`).join('');

    // Selectores de período (desde - hasta)
    ['period-from-year','period-to-year'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const prev = el.value;
            el.innerHTML = '<option value="ALL">Todos</option>' + yearOpts;
            if (prev) el.value = prev;
        }
    });
    ['period-from-month','period-to-month'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const prev = el.value;
            el.innerHTML = '<option value="0">Todos</option>' +
                [1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}">${MESES[m]}</option>`).join('');
            if (prev) el.value = prev;
        }
    });
}

function populateBrandSelector() {
    const brands = [...new Set(filteredAgg.map(i => i.marca))].sort();
    const el = document.getElementById('filter-brand');
    if (!el) return;
    const prev = el.value;
    el.innerHTML = '<option value="ALL">Todas las Marcas</option>' +
        brands.map(b => `<option value="${b}">${b}</option>`).join('');
    if (brands.includes(prev)) el.value = prev;
}

// ── Aplicar filtros de período y marca ────────────────────────────────────────
function applyPeriodAndBrandFilter() {
    const fromYear  = document.getElementById('period-from-year')?.value  || 'ALL';
    const fromMonth = parseInt(document.getElementById('period-from-month')?.value || '0');
    const toYear    = document.getElementById('period-to-year')?.value    || 'ALL';
    const toMonth   = parseInt(document.getElementById('period-to-month')?.value || '0');
    const brand     = document.getElementById('filter-brand')?.value      || 'ALL';

    let raw = allRawData;

    // Filtro desde
    if (fromYear !== 'ALL') {
        const fy = parseInt(fromYear);
        raw = raw.filter(r => {
            if (r.anio > fy) return true;
            if (r.anio === fy && fromMonth === 0) return true;
            if (r.anio === fy && r.mesNum >= fromMonth) return true;
            return false;
        });
    }

    // Filtro hasta
    if (toYear !== 'ALL') {
        const ty = parseInt(toYear);
        raw = raw.filter(r => {
            if (r.anio < ty) return true;
            if (r.anio === ty && toMonth === 0) return true;
            if (r.anio === ty && r.mesNum <= toMonth) return true;
            return false;
        });
    }

    // Filtro marca
    if (brand !== 'ALL') raw = raw.filter(r => r.marca === brand);

    filteredAgg = aggregateParts(raw);
    populateBrandSelector();   // refresh brands in dropdown
    renderCharts(filteredAgg);
    updateKPIs();
    renderTable();
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function updateKPIs() {
    const totalUnits = filteredAgg.reduce((s, i) => s + i.cantidad, 0);
    document.getElementById('kpi-total-parts').textContent  = totalUnits.toLocaleString();
    document.getElementById('kpi-unique-parts').textContent = filteredAgg.length.toLocaleString();
    const ots = new Set(filteredAgg.flatMap(i => Array.from(i.ots)));
    document.getElementById('kpi-ots-count').textContent    = ots.size.toLocaleString();
    const toOrder = filteredAgg.filter(i => !orderHistory[i.key]).length;
    document.getElementById('kpi-to-order').textContent     = toOrder.toLocaleString();
}

// ── Gráficos ──────────────────────────────────────────────────────────────────
function renderCharts(aggregated) {
    const topFreq = [...aggregated].sort((a,b) => b.frecuencia - a.frecuencia).slice(0, 8);
    const topQty  = [...aggregated].sort((a,b) => b.cantidad   - a.cantidad).slice(0, 5);

    // Chart 1 — Frecuencia
    const ctx1 = document.getElementById('partsByBrandChart');
    if (!ctx1) return;
    if (chartFreq) { chartFreq.destroy(); chartFreq = null; }
    if (topFreq.length > 0) {
        chartFreq = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: topFreq.map(i => {
                    const lbl = i.codigo !== 'N/A' ? `${i.codigo}` : i.descripcion;
                    return lbl.length > 18 ? lbl.substring(0, 16) + '…' : lbl;
                }),
                datasets: [{ label: 'Frecuencia (OTs distintas)', data: topFreq.map(i => i.frecuencia),
                    backgroundColor: '#3b82f6', borderRadius: 5 }]
            },
            options: { responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: {
                    afterLabel: ctx => filteredAgg[ctx.dataIndex]?.descripcion || ''
                }}},
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { stepSize: 1, color: '#94a3b8' } },
                    x: { grid: { display: false }, ticks: { color: '#94a3b8' } } } }
        });
    }

    // Chart 2 — Cantidad
    const ctx2 = document.getElementById('topPartsChart');
    if (!ctx2) return;
    if (chartQty) { chartQty.destroy(); chartQty = null; }
    if (topQty.length > 0) {
        chartQty = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: topQty.map(i => {
                    const lbl = i.descripcion;
                    return lbl.length > 22 ? lbl.substring(0, 20) + '…' : lbl;
                }),
                datasets: [{ label: 'Cantidad Total Unidades', data: topQty.map(i => i.cantidad),
                    backgroundColor: '#10b981', borderRadius: 5 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    y: { grid: { display: false }, ticks: { color: '#94a3b8' } } } }
        });
    }
}

// ── Tabla ─────────────────────────────────────────────────────────────────────
function renderTable() {
    const query      = (document.getElementById('search-input')?.value || '').toLowerCase();
    const statusFilt = document.getElementById('filter-status')?.value || 'ALL';
    const tbody      = document.getElementById('table-body');
    const rcEl       = document.getElementById('table-row-count');

    let items = filteredAgg;
    if (query) items = items.filter(i =>
        i.descripcion.toLowerCase().includes(query) ||
        (i.codigo && i.codigo.toLowerCase().includes(query)) ||
        i.marca.toLowerCase().includes(query));
    if (statusFilt === 'NEW')     items = items.filter(i => !orderHistory[i.key]);
    if (statusFilt === 'ORDERED') items = items.filter(i =>  orderHistory[i.key]);

    currentFiltered = items;
    if (rcEl) rcEl.textContent = `Mostrando ${items.length} de ${filteredAgg.length} repuestos`;

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-500">No se encontraron resultados.</td></tr>`;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const isOrdered  = !!orderHistory[item.key];
        const orderInfo  = orderHistory[item.key];
        const statusBadge = isOrdered
            ? `<span class="badge-ordered">✔ Pedido (${orderInfo.fecha})</span>`
            : `<span class="badge-new">⬆ Para Pedir</span>`;
        const codeDisplay = item.codigo !== 'N/A'
            ? `<span class="font-mono text-blue-400">${item.codigo}</span>`
            : `<span class="text-slate-500 italic">N/A</span>`;
        const otDetailsDisplay = (item.otDetails || []).map(d => `<span class="whitespace-nowrap px-1 bg-slate-800 text-slate-300 rounded mr-1">${d.mes}: ${d.ot}</span>`).join(' ');

        return `
        <tr class="${isOrdered ? 'already-ordered' : ''} hover:bg-slate-800/40 transition-colors" data-key="${item.key}">
            <td><input type="checkbox" class="row-chk accent-emerald-500 cursor-pointer" data-key="${item.key}" onchange="onCheckboxChange()"></td>
            <td class="font-bold text-white">${item.marca}</td>
            <td>${codeDisplay}</td>
            <td class="text-sm max-w-xs truncate" title="${item.descripcion}">${item.descripcion}</td>
            <td class="text-center font-bold text-blue-300">${item.frecuencia}</td>
            <td class="text-center font-bold text-white">${item.cantidad}</td>
            <td class="text-xs">${otDetailsDisplay}</td>
            <td class="text-center"><span class="${item.priorityClass}">${item.prioridad}</span></td>
            <td class="text-center">${statusBadge}</td>
        </tr>`;
    }).join('');

    document.getElementById('select-all-chk').checked = false;
}

// ── Eventos ───────────────────────────────────────────────────────────────────
function setupEventListeners() {
    document.getElementById('select-all-chk')?.addEventListener('change', e => {
        document.querySelectorAll('.row-chk').forEach(cb => cb.checked = e.target.checked);
        onCheckboxChange();
    });
    document.getElementById('search-input')?.addEventListener('input', renderTable);
    document.getElementById('filter-status')?.addEventListener('change', renderTable);
    document.getElementById('btn-export-all')?.addEventListener('click', exportCurrentView);
    // Periodo y marca — se aplican solo al picar el botón
}

function onCheckboxChange() {
    const checked = document.querySelectorAll('.row-chk:checked');
    const bar = document.getElementById('selection-bar');
    const cnt = document.getElementById('selection-count');
    if (checked.length > 0) {
        bar.classList.remove('hidden');
        cnt.textContent = `${checked.length} ítem(s) seleccionado(s)`;
    } else {
        bar.classList.add('hidden');
    }
}
function clearSelection() {
    document.querySelectorAll('.row-chk').forEach(cb => cb.checked = false);
    document.getElementById('select-all-chk').checked = false;
    document.getElementById('selection-bar').classList.add('hidden');
}

// ── Corte de pedido ───────────────────────────────────────────────────────────
function applyCutoff() {
    const month = parseInt(document.getElementById('cutoff-month').value);
    const year  = parseInt(document.getElementById('cutoff-year').value);
    if (month === 0 || !year) { alert('Selecciona mes y año del último pedido.'); return; }
    cutoffState = { month, year };
    savePersistedData();
    updateCutoffStatus();
    renderTable();
}

function updateCutoffStatus() {
    const statusDiv    = document.getElementById('cutoff-status');
    const orderedCount = Object.keys(orderHistory).length;
    const toOrderCount = filteredAgg.filter(i => !orderHistory[i.key]).length;
    if (cutoffState.month > 0 || orderedCount > 0) {
        statusDiv.classList.remove('hidden');
        const cutoffLabel = cutoffState.month > 0
            ? `Último pedido hasta: <strong class="text-emerald-400">${MESES[cutoffState.month]} ${cutoffState.year}</strong>`
            : 'Sin corte definido';
        statusDiv.innerHTML = `${cutoffLabel} &nbsp;·&nbsp; <span class="text-blue-300">${orderedCount} ítems ya pedidos</span>
            &nbsp;·&nbsp; <span class="text-emerald-400 font-bold">${toOrderCount} ítems para el nuevo pedido</span>`;
    } else {
        statusDiv.classList.add('hidden');
    }
    updateKPIs();
}

// ── Exportar ──────────────────────────────────────────────────────────────────
function generateOrder() {
    const toOrder = filteredAgg.filter(i => !orderHistory[i.key]);
    if (toOrder.length === 0) { alert('No hay ítems nuevos para pedir en la vista actual.'); return; }
    const label  = cutoffState.month > 0 ? `${MESES[cutoffState.month]}_${cutoffState.year}` : 'Nuevo';
    exportToExcel(toOrder, `PedidoSugerido_${label}_${today()}.xlsx`, 'Pedido Nuevo');
}
function exportCurrentView()  { exportToExcel(currentFiltered, `RepuestosVista_${today()}.xlsx`, 'Repuestos'); }
function exportSelection() {
    const keys  = Array.from(document.querySelectorAll('.row-chk:checked')).map(cb => cb.dataset.key);
    const items = filteredAgg.filter(i => keys.includes(i.key));
    exportToExcel(items, `RepuestosSeleccion_${today()}.xlsx`, 'Selección');
}
function exportToExcel(items, filename, sheetName) {
    const rows = [['Marca','Código/ID','Descripción','Frecuencia (OTs)','Cantidad Total','Mes y Nro. OT','Prioridad','Estado Pedido']];
    items.forEach(i => {
        const ord = orderHistory[i.key];
        const otText = i.otDetails.map(d => `${d.mes}: ${d.ot}`).join(', ');
        rows.push([i.marca, i.codigo, i.descripcion, i.frecuencia, i.cantidad, otText, i.prioridad,
            ord ? `Pedido (${ord.fecha})` : 'Para Pedir']);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:18},{wch:16},{wch:45},{wch:16},{wch:16},{wch:30},{wch:16},{wch:20}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
}
function today() { return new Date().toISOString().slice(0,10); }

// ── Confirmar pedido realizado ────────────────────────────────────────────────
function confirmOrderPlaced() {
    const toOrder = filteredAgg.filter(i => !orderHistory[i.key]);
    if (toOrder.length === 0) { alert('No hay ítems nuevos que confirmar.'); return; }
    const label = cutoffState.month > 0 ? `${MESES[cutoffState.month]} ${cutoffState.year}` : new Date().toLocaleDateString('es-HN');
    if (!confirm(`¿Confirmar que el pedido de ${toOrder.length} ítems fue realizado al ${label}?`)) return;
    toOrder.forEach(i => { orderHistory[i.key] = { fecha: label, qty: i.cantidad }; });
    savePersistedData();
    updateCutoffStatus();
    renderTable();
    alert(`✅ ${toOrder.length} ítems registrados como pedido.`);
}
function resetOrderHistory() {
    if (!confirm('¿Limpiar todo el historial de pedidos?')) return;
    orderHistory = {};
    cutoffState  = { month: 0, year: new Date().getFullYear() };
    savePersistedData();
    document.getElementById('cutoff-month').value = 0;
    document.getElementById('cutoff-year').value  = new Date().getFullYear();
    document.getElementById('cutoff-status').classList.add('hidden');
    renderTable();
    updateKPIs();
}
function renderEmptyTable(msg) {
    const el = document.getElementById('table-body');
    if (el) el.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-500 italic">${msg}</td></tr>`;
}
