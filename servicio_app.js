// servicio_app.js — Dashboard de Servicios con filtro de fecha real

let globalData = [];          // todos los registros raw con fecha
let brandChartInstance = null;

// ── Arranque ──────────────────────────────────────────────────────────────────
function startApp() {
    // Intentar cargar datos pre-generados con retry
    const tryLoad = () => {
        if (window.PRELOADED_SERVICIO && window.PRELOADED_SERVICIO.length > 0) {
            globalData = window.PRELOADED_SERVICIO;
            setupEvents();
            refresh();
            const meta = window.PRELOADED_META_SVC;
            const kf = document.getElementById('kpi-files');
            if (kf) kf.innerText = meta ? `${meta.archivosProcessados}` : 'OK';
            return true;
        }
        return false;
    };
    if (!tryLoad()) {
        let r = 0;
        const iv = setInterval(() => { r++; if (tryLoad() || r > 15) clearInterval(iv); }, 300);
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
else startApp();

// ── Eventos ───────────────────────────────────────────────────────────────────
function setupEvents() {
    // Drop zone
    const dropArea    = document.getElementById('drop-area');
    const fileInput   = document.getElementById('file-input');
    const btnFolder   = document.getElementById('btn-folder');
    const folderInput = document.getElementById('folder-input');
    const loadingEl   = document.getElementById('loading');

    ['dragenter','dragover','dragleave','drop'].forEach(ev =>
        dropArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); }));
    ['dragenter','dragover'].forEach(ev => dropArea.addEventListener(ev, () => dropArea.classList.add('dragover')));
    ['dragleave','drop'].forEach(ev  => dropArea.addEventListener(ev,  () => dropArea.classList.remove('dragover')));

    dropArea.addEventListener('drop', e => processFiles(Array.from(e.dataTransfer.files), loadingEl, dropArea, fileInput, folderInput));
    fileInput.addEventListener('change',   e => processFiles(Array.from(e.target.files), loadingEl, dropArea, fileInput, folderInput));
    btnFolder.addEventListener('click',    () => folderInput.click());
    folderInput.addEventListener('change', e => processFiles(Array.from(e.target.files), loadingEl, dropArea, fileInput, folderInput));

    // Filtros tabla
    document.getElementById('search-input')?.addEventListener('input', renderTable);
    document.getElementById('table-brand-filter')?.addEventListener('change', renderTable);
    // Comparador
    document.getElementById('compare-brand-a')?.addEventListener('change', updateComparator);
    document.getElementById('compare-brand-b')?.addEventListener('change', updateComparator);
    // Top filter
    document.getElementById('brand-top-filter')?.addEventListener('change', e => renderTopProducts(e.target.value));
}

// ── Filtros activos ───────────────────────────────────────────────────────────
function getFilteredData() {
    const dateFrom = document.getElementById('date-from')?.value || '';
    const dateTo   = document.getElementById('date-to')?.value   || '';
    const brand    = document.getElementById('table-brand-filter')?.value || 'ALL';
    const query    = (document.getElementById('search-input')?.value || '').toLowerCase();

    let data = globalData;
    if (dateFrom) data = data.filter(r => r.fecha && r.fecha >= dateFrom);
    if (dateTo)   data = data.filter(r => r.fecha && r.fecha.slice(0,10) <= dateTo);
    if (brand !== 'ALL') data = data.filter(r => r.marca === brand);
    if (query)    data = data.filter(r =>
        r.marca.toLowerCase().includes(query) ||
        r.rms.toLowerCase().includes(query) ||
        r.descripcion.toLowerCase().includes(query));
    return data;
}

function applyTableFilters() { refresh(); }
function clearTableFilters() {
    const df = document.getElementById('date-from');
    const dt = document.getElementById('date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    document.getElementById('table-brand-filter').value = 'ALL';
    document.getElementById('search-input').value = '';
    refresh();
}

// ── Refresh completo ──────────────────────────────────────────────────────────
function refresh() {
    const filtered = getFilteredData();
    const byBrand   = buildByBrand(filtered);
    const byProduct = buildByProduct(filtered);

    window.byBrand           = byBrand;
    window.aggregatedProducts = Object.values(byProduct).sort((a, b) => b.sum - a.sum);

    updateKPIs(filtered);
    renderChart(byBrand);
    populateSelectors();
    renderTopProducts(document.getElementById('brand-top-filter')?.value || 'ALL');
    renderTable();
}

function buildByBrand(data) {
    const m = {};
    data.forEach(r => { if (!m[r.marca]) m[r.marca] = { sum: 0 }; m[r.marca].sum++; });
    return m;
}
function buildByProduct(data) {
    const m = {};
    data.forEach(r => {
        const key = `${r.marca}|||${r.rms}|||${r.descripcion}`;
        if (!m[key]) m[key] = { marca: r.marca, rms: r.rms, descripcion: r.descripcion, sum: 0 };
        m[key].sum++;
    });
    return m;
}

// ── KPIs ──────────────────────────────────────────────────────────────────────
function updateKPIs(filtered) {
    document.getElementById('kpi-total').innerText    = filtered.length.toLocaleString();
    document.getElementById('kpi-marcas').innerText   = Object.keys(buildByBrand(filtered)).length.toLocaleString();
    document.getElementById('kpi-productos').innerText = (window.aggregatedProducts?.length || 0).toLocaleString();
}

// ── Chart ─────────────────────────────────────────────────────────────────────
function renderChart(brandData) {
    const sorted = Object.entries(brandData).sort((a, b) => b[1].sum - a[1].sum).slice(0, 15);
    const ctx = document.getElementById('brandChart');
    if (!ctx) return;
    if (brandChartInstance) brandChartInstance.destroy();
    brandChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(b => b[0]),
            datasets: [{ label: 'Servicios', data: sorted.map(b => b[1].sum),
                backgroundColor: 'rgba(20,184,166,0.75)', borderColor: 'rgb(20,184,166)', borderWidth: 1 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            plugins: { legend: { labels: { color: '#e2e8f0' } }, tooltip: { mode: 'index', intersect: false } }
        }
    });
}

// ── Top Products ──────────────────────────────────────────────────────────────
function renderTopProducts(filterBrand) {
    const container = document.getElementById('top-products-list');
    if (!window.aggregatedProducts?.length) {
        container.innerHTML = '<p class="text-slate-500 text-center text-sm py-8">Sin datos...</p>'; return;
    }
    let products = window.aggregatedProducts;
    if (filterBrand && filterBrand !== 'ALL') products = products.filter(p => p.marca === filterBrand);
    const top5 = products.slice(0, 5);
    if (!top5.length) { container.innerHTML = '<p class="text-slate-500 text-center text-sm py-8">No hay datos para esta marca.</p>'; return; }
    container.innerHTML = top5.map((p, i) => `
        <div class="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:bg-slate-700/50 transition-all">
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold ${i === 0 ? 'text-teal-400' : 'text-slate-400'}">#${i+1}</div>
            <div class="flex-grow min-w-0">
                <div class="flex justify-between items-start">
                    <p class="text-xs font-bold text-slate-500 uppercase truncate">${p.marca}</p>
                    <span class="text-[10px] font-mono text-slate-500">${p.rms}</span>
                </div>
                <p class="text-sm font-medium text-white truncate" title="${p.descripcion}">${p.descripcion}</p>
            </div>
            <div class="flex-shrink-0 text-right">
                <p class="text-xs font-bold text-white">${p.sum}</p>
                <p class="text-[9px] text-slate-500 uppercase">Servicios</p>
            </div>
        </div>`).join('');
}

// ── Comparator ────────────────────────────────────────────────────────────────
function populateSelectors() {
    const brands = Object.keys(window.byBrand || {}).sort();
    const opts   = brands.map(b => `<option value="${b}">${b}</option>`).join('');

    ['table-brand-filter','brand-top-filter'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const prev = el.value;
        el.innerHTML = `<option value="ALL">Todas las Marcas</option>${opts}`;
        if (brands.includes(prev)) el.value = prev;
    });
    ['compare-brand-a','compare-brand-b'].forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const prev = el.value;
        el.innerHTML = `<option value="">Seleccione Marca ${i===0?'A':'B'}</option>${opts}`;
        if (brands.includes(prev)) el.value = prev;
    });
}

function updateComparator() {
    renderComparatorCard('compare-result-a', document.getElementById('compare-brand-a').value);
    renderComparatorCard('compare-result-b', document.getElementById('compare-brand-b').value);
}
function renderComparatorCard(containerId, brandName) {
    const container = document.getElementById(containerId);
    if (!brandName) { container.innerHTML = '<p class="text-slate-500 text-center py-12 italic">Seleccione una marca para comparar...</p>'; return; }
    const data       = window.byBrand[brandName] || { sum: 0 };
    const topProduct = (window.aggregatedProducts || []).find(p => p.marca === brandName);
    const total      = Object.values(window.byBrand || {}).reduce((s,v) => s + v.sum, 0);
    const pct        = total > 0 ? ((data.sum / total) * 100).toFixed(1) : '0.0';
    container.innerHTML = `
        <div class="animate-fadeIn">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-black text-white italic tracking-tighter">${brandName}</h3>
                <div class="text-right">
                    <p class="text-xs text-slate-500 uppercase font-bold">Total Servicios</p>
                    <p class="text-3xl font-black text-teal-400">${data.sum}</p>
                </div>
            </div>
            <div class="mb-6">
                <div class="flex justify-between text-xs mb-1">
                    <span class="text-slate-400">Participación (${pct}%)</span>
                    <span class="text-teal-400 font-bold">${data.sum} / ${total}</span>
                </div>
                <div class="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div class="bg-teal-500 h-full" style="width:${pct}%"></div>
                </div>
            </div>
            ${topProduct ? `
            <div class="bg-dark/40 rounded-lg p-4 border border-slate-700">
                <p class="text-[10px] text-slate-500 uppercase font-bold mb-2">Producto más solicitado</p>
                <p class="text-white font-bold text-sm mb-1">${topProduct.rms}</p>
                <p class="text-xs text-slate-400 line-clamp-2">${topProduct.descripcion}</p>
                <div class="mt-2 flex justify-between items-center">
                    <span class="text-[10px] text-teal-500 bg-teal-500/10 px-2 py-0.5 rounded-full font-bold">Servicio</span>
                    <span class="text-xs font-bold text-white">${topProduct.sum} OTs</span>
                </div>
            </div>` : ''}
        </div>`;
}

// ── Tabla (datos raw con fecha) ───────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('table-body');
    const rcEl  = document.getElementById('table-row-count');
    if (!tbody) return;

    const data    = getFilteredData();
    const display = Math.min(data.length, 500);

    window.currentFilteredProducts = data;

    if (rcEl) {
        const dateFrom = document.getElementById('date-from')?.value || '';
        const dateTo   = document.getElementById('date-to')?.value   || '';
        const brand    = document.getElementById('table-brand-filter')?.value || 'ALL';
        const parts    = [];
        if (brand !== 'ALL') parts.push(`Marca: ${brand}`);
        if (dateFrom || dateTo) parts.push(`Fechas: ${dateFrom||'inicio'} → ${dateTo||'hoy'}`);
        rcEl.textContent = `Mostrando ${display} de ${data.length} registros${parts.length ? ' · ' + parts.join(' · ') : ''}`;
    }

    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-slate-500">No hay resultados para los filtros seleccionados.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.slice(0, display).map(item => `
        <tr class="hover:bg-slate-800/50 transition-colors">
            <td class="font-medium text-white">${item.marca}</td>
            <td class="font-mono text-sm text-slate-300">${item.rms}</td>
            <td class="text-sm text-slate-400 max-w-xs truncate" title="${item.descripcion}">${item.descripcion}</td>
            <td class="text-center text-xs text-slate-500 whitespace-nowrap">${item.fecha ? item.fecha.slice(0,10) : ''}</td>
            <td class="text-center"><span class="badge-svc">Servicio</span></td>
        </tr>`).join('');
}

// ── Exportar ──────────────────────────────────────────────────────────────────
function exportFilteredToExcel() {
    const source = window.currentFilteredProducts;
    if (!source?.length) { alert('No hay datos para exportar.'); return; }
    const brand  = document.getElementById('table-brand-filter')?.value || 'TODAS';
    const fecha  = new Date().toISOString().slice(0, 10);
    const rows = [['Marca','RMS','Descripción del Equipo','Fecha Ingreso','Tipo']];
    source.forEach(r => rows.push([r.marca, r.rms, r.descripcion, r.fecha || '', 'SERVICIO']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:18},{wch:18},{wch:45},{wch:18},{wch:12}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
    XLSX.writeFile(wb, `Servicios_${brand}_${fecha}.xlsx`);
}

// ── Procesar archivos manuales (drag & drop) ──────────────────────────────────
async function processFiles(files, loadingEl, dropArea, fileInput, folderInput) {
    const xlFiles = files.filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'));
    if (!xlFiles.length) { alert('Selecciona archivos Excel (.xlsx/.xls)'); return; }
    loadingEl.classList.remove('hidden');
    dropArea.classList.add('processing');
    try {
        let rows = [];
        for (const file of xlFiles) rows = rows.concat(await readExcelFile(file));
        globalData = globalData.concat(rows);
        refresh();
    } catch(err) { console.error(err); alert('Error: ' + err.message); }
    finally {
        loadingEl.classList.add('hidden');
        dropArea.classList.remove('processing');
        if(fileInput) fileInput.value = '';
        if(folderInput) folderInput.value = '';
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const sheetName = wb.SheetNames.find(n => n.trim().toUpperCase() === 'OT') || wb.SheetNames[0];
                const rawData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null });
                let hIdx = -1; let headers = [];
                for (let i = 0; i < 10; i++) {
                    if (rawData[i]?.includes('MARCA')) { hIdx = i; headers = rawData[i]; break; }
                }
                const processed = [];
                if (hIdx !== -1) {
                    const tipoI  = headers.indexOf('TIPO DE GARANTIA');
                    const marcaI = headers.indexOf('MARCA');
                    const rmsI   = headers.indexOf('RMS');
                    const descI  = headers.indexOf('DESCRIPCION DEL EQUIPO');
                    const fechaI = headers.indexOf('FECHA Y HR DE INGRESO');
                    for (let i = hIdx+1; i < rawData.length; i++) {
                        const row = rawData[i]; if (!row) continue;
                        const tipo = String(row[tipoI]||'').trim().toUpperCase();
                        if (tipo.includes('SERVICIO')) {
                            const fd = row[fechaI];
                            processed.push({
                                marca: String(row[marcaI]||'DESCONOCIDA').trim().toUpperCase(),
                                rms:   String(row[rmsI]  ||'N/A').trim(),
                                descripcion: String(row[descI]||'').trim(),
                                fecha: fd ? (fd instanceof Date ? fd.toISOString().slice(0,16).replace('T',' ') : String(fd).slice(0,16)) : '',
                                anio: 'Manual', mes: 'Manual', mesNum: 0
                            });
                        }
                    }
                }
                resolve(processed);
            } catch(err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}
