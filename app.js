// app.js

// Global Data State
let globalData = [];
let brandChartInstance = null;
let currentBrandTableFilter = 'ALL';

// DOM Elements
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const fileInputCs = document.getElementById('file-input-cs');
const fileInputMaestros = document.getElementById('file-input-maestros');
const btnUploadCs = document.getElementById('btn-upload-cs');
const btnUploadMaestros = document.getElementById('btn-upload-maestros');
const btnFolder = document.getElementById('btn-folder');
const folderInput = document.getElementById('folder-input');
const loadingIndicator = document.getElementById('loading');
const searchInput = document.getElementById('search-input');

// Initialize Events
function initEvents() {
    // Basic Drag & Drop
    if (dropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
        });

        dropArea.addEventListener('drop', handleDrop, false);
    }

    if (fileInput) fileInput.addEventListener('change', handleFilesSelect, false);

    // Direct upload buttons for CS and MAESTROS
    if (btnUploadCs && fileInputCs) {
        btnUploadCs.addEventListener('click', () => fileInputCs.click());
        fileInputCs.addEventListener('change', (e) => {
            const excelFiles = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls'));
            if (excelFiles.length > 0) {
                processFiles(excelFiles, 'CS');
            }
        });
    }

    if (btnUploadMaestros && fileInputMaestros) {
        btnUploadMaestros.addEventListener('click', () => fileInputMaestros.click());
        fileInputMaestros.addEventListener('change', (e) => {
            const excelFiles = Array.from(e.target.files).filter(f => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls'));
            if (excelFiles.length > 0) {
                processFiles(excelFiles, 'MAESTROS');
            }
        });
    }
    
    // Folder Selection button proxy
    if (btnFolder && folderInput) {
        btnFolder.addEventListener('click', () => {
            folderInput.click();
        });
        folderInput.addEventListener('change', handleFilesSelect, false);
    }

    // Search input
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderTable();
        });
    }

    // Table brand filter
    document.getElementById('table-brand-filter')?.addEventListener('change', (e) => {
        currentBrandTableFilter = e.target.value;
        renderTable();
    });

    // Alert filter
    document.getElementById('brand-alert-filter')?.addEventListener('change', (e) => {
        renderWorstProductsList(e.target.value);
    });

    // Comparator selectors
    document.getElementById('compare-brand-a')?.addEventListener('change', updateComparator);
    document.getElementById('compare-brand-b')?.addEventListener('change', updateComparator);

    // Modal handlers
    document.getElementById('btn-unit-cs')?.addEventListener('click', () => {
        document.getElementById('unit-modal').classList.add('hidden');
        if(pendingUploadFiles.length > 0) processFiles(pendingUploadFiles, 'CS');
    });
    document.getElementById('btn-unit-maestros')?.addEventListener('click', () => {
        document.getElementById('unit-modal').classList.add('hidden');
        if(pendingUploadFiles.length > 0) processFiles(pendingUploadFiles, 'MAESTROS');
    });
    document.getElementById('btn-unit-cancel')?.addEventListener('click', () => {
        document.getElementById('unit-modal').classList.add('hidden');
        pendingUploadFiles = [];
        if (fileInput) fileInput.value = '';
        if (folderInput) folderInput.value = '';
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

let pendingUploadFiles = [];

function promptUnitSelection(files) {
    const excelFiles = files.filter(f => f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls'));
    if (excelFiles.length === 0) {
        alert('Por favor selecciona archivos Excel (.xlsx o .xls)');
        return;
    }
    pendingUploadFiles = excelFiles;

    const preview = document.getElementById('unit-modal-file-preview');
    if (preview) {
        preview.innerHTML = excelFiles.map(f => `• ${f.name}`).join('<br>');
    }
    
    const modal = document.getElementById('unit-modal');
    if(modal) {
        modal.classList.remove('hidden');
    } else {
        processFiles(pendingUploadFiles, 'CS');
    }
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    promptUnitSelection(Array.from(dt.files));
}

function handleFilesSelect(e) {
    promptUnitSelection(Array.from(e.target.files));
}

// Data Processing
async function processFiles(excelFiles, unidad) {
    loadingIndicator.classList.remove('hidden');
    if (dropArea) dropArea.classList.add('processing');
    
    const loadingText = loadingIndicator.querySelector('p') || loadingIndicator.querySelector('span');
    if(loadingText) loadingText.innerText = `Subiendo ${excelFiles.length} archivo(s) a Unidad ${unidad} y procesando datos...`;

    try {
        for (let file of excelFiles) {
            await uploadFileWithRetry(file, false, unidad);
        }
        
        if(loadingText) loadingText.innerText = `Consolidando datos de Unidad ${unidad} en todos los módulos... Por favor espere unos segundos.`;
        
        const pollStatus = setInterval(async () => {
            try {
                const res = await fetch('/status');
                const data = await res.json();
                if (!data.processing) {
                    clearInterval(pollStatus);
                    window.location.href = window.location.pathname + '?v=' + new Date().getTime();
                }
            } catch(e) {
                console.error("Error polling status:", e);
            }
        }, 3000);
        
    } catch(error) {
        console.error("Error al subir archivos:", error);
        alert("Hubo un error subiendo el archivo: " + error.message);
        
        loadingIndicator.classList.add('hidden');
        if (dropArea) dropArea.classList.remove('processing');
        if (fileInput) fileInput.value = '';
        if (fileInputCs) fileInputCs.value = '';
        if (fileInputMaestros) fileInputMaestros.value = '';
        if (folderInput) folderInput.value = '';
    }
}

async function uploadFileWithRetry(file, overwrite = false, unidad = 'CS', anioOverride = null, mesOverride = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('overwrite', overwrite);
    formData.append('unidad_negocio', unidad);
    
    const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                   'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const nameUpper = file.name.toUpperCase();
    
    let anio = anioOverride;
    if (!anio) {
        const yearMatch = nameUpper.match(/(20\d{2})/);
        anio = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
    }
    
    let mes = mesOverride;
    if (!mes) {
        mes = MESES.find(m => nameUpper.includes(m)) || null;
    }
    
    formData.append('anio', anio);
    if (mes) formData.append('mes', mes);

    const response = await fetch('/upload', {
        method: 'POST',
        body: formData
    });

    if (response.status === 409) {
        const errorData = await response.json();
        const confirmOverwrite = confirm(`El archivo para el mes de ${errorData.mes} (Unidad: ${unidad}) ya existe.\n¿Desea reemplazarlo y re-procesar los datos?`);
        if (confirmOverwrite) {
            return await uploadFileWithRetry(file, true, unidad, anio, mes);
        } else {
            throw new Error("El usuario canceló la subida (archivo ya existe).");
        }
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP status ${response.status}`);
    }

    return await response.json();
}

// Dashboard Update Logic
function applyGlobalFilter() {
    const unitSel = document.getElementById('filter-unit')?.value || 'ALL';
    const yearSel = document.getElementById('filter-year')?.value || 'ALL';
    const monthSel = document.getElementById('filter-month')?.value || 'ALL';
    
    window.filteredGlobalData = globalData.filter(d => {
        const matchUnit = unitSel === 'ALL' || (d.unidad_negocio || 'CS').toUpperCase() === unitSel;
        const matchYear = yearSel === 'ALL' || String(d.anio) === String(yearSel);
        const matchMonth = monthSel === 'ALL' || String(d.mesNum) === String(monthSel);
        return matchUnit && matchYear && matchMonth;
    });
    
    updateDashboard();
}

function updateDashboard() {
    const dataToUse = window.filteredGlobalData || globalData;
    const unitSel = document.getElementById('filter-unit')?.value || 'ALL';
    const yearSel = document.getElementById('filter-year')?.value || 'ALL';
    const monthSel = document.getElementById('filter-month')?.value || 'ALL';
    
    // KPIs
    const totalParciales = dataToUse.filter(d => d.tipoGarantia === 'GARANTIA PARCIAL').length;
    const totalTotales = dataToUse.filter(d => d.tipoGarantia === 'GARANTIA TOTAL').length;
    const totalGeneral = dataToUse.length;
    
    const csRowsCount = dataToUse.filter(d => (d.unidad_negocio || 'CS').toUpperCase() === 'CS').length;
    const maestrosRowsCount = dataToUse.filter(d => (d.unidad_negocio || '').toUpperCase() === 'MAESTROS').length;

    // Archivos procesados dinámicos según filtro
    const meta = window.PRELOADED_META;
    const listaArchivos = (meta && meta.listaArchivos) ? meta.listaArchivos : [];
    const monthNamesUpper = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

    if (listaArchivos.length > 0) {
        const totalCsFiles = listaArchivos.filter(f => f.unidad === 'CS').length;
        const totalMaestrosFiles = listaArchivos.filter(f => f.unidad === 'MAESTROS').length;
        const badgeText = document.getElementById('coverage-badge-text');
        if (badgeText) {
            badgeText.textContent = `${listaArchivos.length} archivos activos (${totalCsFiles} CS · ${totalMaestrosFiles} MAESTROS)`;
        }

        const filteredFiles = listaArchivos.filter(f => {
            const mUnit = unitSel === 'ALL' || f.unidad === unitSel;
            const mYear = yearSel === 'ALL' || String(f.anio) === String(yearSel);
            const mMonth = monthSel === 'ALL' || f.mes === monthNamesUpper[parseInt(monthSel) - 1];
            return mUnit && mYear && mMonth;
        });
        const fCs = filteredFiles.filter(f => f.unidad === 'CS').length;
        const fMaestros = filteredFiles.filter(f => f.unidad === 'MAESTROS').length;

        document.getElementById('kpi-files').innerText = `${filteredFiles.length} archivos`;
        const filesSub = document.getElementById('kpi-files-sub');
        if (filesSub) {
            filesSub.innerText = `${fCs} de CS · ${fMaestros} de MAESTROS`;
        }
    } else {
        const periods = new Set(dataToUse.map(d => `${d.unidad_negocio}-${d.anio}-${d.mes}`));
        document.getElementById('kpi-files').innerText = `${periods.size} archivos`;
    }

    document.getElementById('kpi-rows').innerText = totalGeneral.toLocaleString();
    const rowsSub = document.getElementById('kpi-rows-sub');
    if (rowsSub) {
        rowsSub.innerText = `${csRowsCount.toLocaleString()} CS · ${maestrosRowsCount.toLocaleString()} MAESTROS`;
    }

    document.getElementById('kpi-parcial').innerText = totalParciales.toLocaleString();
    const parcialSub = document.getElementById('kpi-parcial-sub');
    if (parcialSub) {
        const pctP = totalGeneral > 0 ? ((totalParciales / totalGeneral) * 100).toFixed(1) : '0.0';
        parcialSub.innerText = `${pctP}% del total de garantías`;
    }

    document.getElementById('kpi-total').innerText = totalTotales.toLocaleString();
    const totalSub = document.getElementById('kpi-total-sub');
    if (totalSub) {
        const pctT = totalGeneral > 0 ? ((totalTotales / totalGeneral) * 100).toFixed(1) : '0.0';
        totalSub.innerText = `${pctT}% del total de garantías`;
    }

    // Data Aggregation
    const byBrand = {};
    const byProduct = {};

    dataToUse.forEach(item => {
        if(!byBrand[item.marca]) {
            byBrand[item.marca] = { parcial: 0, total: 0, sum: 0 };
        }
        if(item.tipoGarantia === 'GARANTIA PARCIAL') byBrand[item.marca].parcial++;
        else if(item.tipoGarantia === 'GARANTIA TOTAL') byBrand[item.marca].total++;
        byBrand[item.marca].sum++;

        const pKey = `${item.marca}___${item.rms}___${item.descripcion}`;
        if(!byProduct[pKey]) {
            byProduct[pKey] = {
                marca: item.marca,
                rms: item.rms,
                descripcion: item.descripcion,
                parcial: 0,
                total: 0,
                sum: 0,
                ots: new Set(),
                otDetails: []
            };
        }
        if(item.tipoGarantia === 'GARANTIA PARCIAL') byProduct[pKey].parcial++;
        else if(item.tipoGarantia === 'GARANTIA TOTAL') byProduct[pKey].total++;
        byProduct[pKey].sum++;
        
        const otNumber = item.ot || 'S/N';
        const uNeg = (item.unidad_negocio || 'CS').toUpperCase();
        const otKey = `${uNeg}-${otNumber}`;
        if (!byProduct[pKey].ots.has(otKey)) {
            byProduct[pKey].ots.add(otKey);
            byProduct[pKey].otDetails.push({
                ot: otNumber,
                fecha: item.fecha || 'N/A',
                unidad: uNeg
            });
        }
    });

    renderChart(byBrand);
    
    window.byBrand = byBrand;
    window.aggregatedProducts = Object.values(byProduct).sort((a,b) => b.sum - a.sum);
    
    populateSelectors();
    renderWorstProductsList(document.getElementById('brand-alert-filter')?.value || 'ALL');
    renderTable();
}

function populateSelectors() {
    const brands = Object.keys(window.byBrand).sort();
    const alertFilter    = document.getElementById('brand-alert-filter');
    const compA          = document.getElementById('compare-brand-a');
    const compB          = document.getElementById('compare-brand-b');
    const tableBrandSel  = document.getElementById('table-brand-filter');

    const selectedFilter = alertFilter.value;
    const selectedA      = compA.value;
    const selectedB      = compB.value;
    const selectedTable  = tableBrandSel.value;

    const brandOptions = brands.map(b => `<option value="${b}">${b}</option>`).join('');
    
    alertFilter.innerHTML   = '<option value="ALL">Todas las Marcas</option>' + brandOptions;
    tableBrandSel.innerHTML = '<option value="ALL">Todas las Marcas</option>' + brandOptions;
    compA.innerHTML = '<option value="">Seleccione Marca A</option>' + brandOptions;
    compB.innerHTML = '<option value="">Seleccione Marca B</option>' + brandOptions;

    alertFilter.value  = brands.includes(selectedFilter) ? selectedFilter : 'ALL';
    tableBrandSel.value = brands.includes(selectedTable) ? selectedTable : 'ALL';
    compA.value = brands.includes(selectedA) ? selectedA : '';
    compB.value = brands.includes(selectedB) ? selectedB : '';

    updatePeriodDropdowns();
}

function updatePeriodDropdowns() {
    const unitSel = document.getElementById('filter-unit');
    const yearSel = document.getElementById('filter-year');
    const monthSel = document.getElementById('filter-month');
    if(!yearSel || !monthSel) return;

    const selectedUnit = unitSel ? unitSel.value : 'ALL';
    const selectedYear = yearSel.value;
    const selectedMonth = monthSel.value;

    const unitFilteredData = (selectedUnit === 'ALL')
        ? globalData
        : globalData.filter(d => (d.unidad_negocio || 'CS').toUpperCase() === selectedUnit);

    const years = [...new Set(unitFilteredData.map(d => d.anio).filter(y => y))].sort();
    
    yearSel.innerHTML = '<option value="ALL">Todos los Años</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    if (years.map(String).includes(String(selectedYear))) {
        yearSel.value = selectedYear;
    } else {
        yearSel.value = 'ALL';
    }

    const availableData = (yearSel.value === 'ALL') ? unitFilteredData : unitFilteredData.filter(d => String(d.anio) === String(yearSel.value));
    const monthsSet = new Set(availableData.map(d => parseInt(d.mesNum)).filter(m => !isNaN(m)));
    const availableMonths = [...monthsSet].sort((a,b) => a - b);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    monthSel.innerHTML = '<option value="ALL">Todos los Meses</option>' + availableMonths.map(mNum => {
        return `<option value="${mNum}">${monthNames[mNum - 1]}</option>`;
    }).join('');

    if(availableMonths.includes(parseInt(selectedMonth))) {
        monthSel.value = selectedMonth;
    } else {
        monthSel.value = 'ALL';
    }
}

// Global Filter Logic setup
document.getElementById('filter-unit')?.addEventListener('change', () => {
    updatePeriodDropdowns();
    applyGlobalFilter();
});
document.getElementById('filter-year')?.addEventListener('change', () => {
    updatePeriodDropdowns();
    applyGlobalFilter();
});
document.getElementById('filter-month')?.addEventListener('change', applyGlobalFilter);
document.getElementById('btn-apply-filter')?.addEventListener('click', applyGlobalFilter);

function renderChart(brandData) {
    const sortedBrands = Object.entries(brandData).sort((a, b) => b[1].sum - a[1].sum);
    const topBrands = sortedBrands.slice(0, 15);
    
    const labels = topBrands.map(b => b[0]);
    const dParcial = topBrands.map(b => b[1].parcial);
    const dTotal = topBrands.map(b => b[1].total);

    const ctx = document.getElementById('brandChart').getContext('2d');
    
    if(brandChartInstance) {
        brandChartInstance.destroy();
    }

    const isDark = document.documentElement.classList.contains('dark');
    const tickColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const legendColor = isDark ? '#f1f5f9' : '#0f172a';

    brandChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Garantía Total',
                    data: dTotal,
                    backgroundColor: 'rgba(239, 68, 68, 0.85)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderRadius: 4,
                    borderWidth: 1
                },
                {
                    label: 'Garantía Parcial',
                    data: dParcial,
                    backgroundColor: 'rgba(245, 158, 11, 0.85)',
                    borderColor: 'rgb(245, 158, 11)',
                    borderRadius: 4,
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: tickColor, font: { family: 'Inter', size: 11, weight: '600' } },
                    grid: { color: gridColor }
                },
                y: {
                    stacked: true,
                    ticks: { color: tickColor, font: { family: 'Inter', size: 11 } },
                    grid: { color: gridColor }
                }
            },
            plugins: {
                legend: {
                    labels: { color: legendColor, font: { family: 'Inter', size: 12, weight: '700' } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

window.refreshBrandChart = function() {
    if (window.byBrand) {
        renderChart(window.byBrand);
    }
};

function renderWorstProductsList(filterBrand) {
    const container = document.getElementById('worst-products-list');
    if(!window.aggregatedProducts || window.aggregatedProducts.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center text-sm py-8 font-medium">Esperando datos...</p>';
        return;
    }

    let products = window.aggregatedProducts;
    if(filterBrand !== 'ALL') {
        products = products.filter(p => p.marca === filterBrand);
    }

    const top5 = products.slice(0, 5);
    
    if(top5.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-center text-sm py-8 font-medium">No hay datos para esta marca.</p>';
        return;
    }

    container.innerHTML = top5.map((p, index) => {
        const isTop = index === 0;
        const rankBadge = isTop 
            ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-black' 
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-bold';

        return `
            <div class="flex items-center space-x-3 p-3 rounded-xl bg-slate-50/90 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all group">
                <div class="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs ${rankBadge}">
                    #${index + 1}
                </div>
                <div class="flex-grow min-w-0">
                    <div class="flex justify-between items-center mb-0.5">
                        <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">${p.marca}</span>
                        <span class="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-semibold">${p.rms}</span>
                    </div>
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title="${p.descripcion}">${p.descripcion || 'Sin descripción'}</p>
                </div>
                <div class="flex-shrink-0 text-right pl-2">
                    <p class="text-sm font-black text-slate-900 dark:text-white leading-none">${p.sum}</p>
                    <p class="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-0.5">Fallos</p>
                </div>
            </div>
        `;
    }).join('');
}

function updateComparator() {
    const brandA = document.getElementById('compare-brand-a').value;
    const brandB = document.getElementById('compare-brand-b').value;

    renderComparatorCard('compare-result-a', brandA);
    renderComparatorCard('compare-result-b', brandB);
}

function renderComparatorCard(containerId, brandName) {
    const container = document.getElementById(containerId);
    if(!brandName) {
        container.innerHTML = '<p class="text-slate-400 text-center py-12 italic text-sm">Seleccione una marca para comparar...</p>';
        return;
    }

    const data = window.byBrand[brandName];
    if(!data) {
        container.innerHTML = '<p class="text-slate-400 text-center py-12 italic text-sm">No hay datos para esta marca</p>';
        return;
    }
    const topProduct = window.aggregatedProducts.find(p => p.marca === brandName);

    const parcialRate = ((data.parcial / data.sum) * 100).toFixed(1);
    const totalRate = ((data.total / data.sum) * 100).toFixed(1);

    container.innerHTML = `
        <div class="animate-fadeIn">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-2xl font-black text-slate-900 dark:text-white tracking-tight">${brandName}</h3>
                <div class="text-right">
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Total Reclamos</p>
                    <p class="text-3xl font-black text-blue-600 dark:text-blue-400">${data.sum}</p>
                </div>
            </div>

            <div class="space-y-4 mb-6">
                <div>
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-slate-600 dark:text-slate-400 font-medium">Garantías Totales (${totalRate}%)</span>
                        <span class="text-red-600 dark:text-red-400 font-bold">${data.total}</span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div class="bg-red-500 h-full rounded-full" style="width: ${totalRate}%"></div>
                    </div>
                </div>
                <div>
                    <div class="flex justify-between text-xs mb-1">
                        <span class="text-slate-600 dark:text-slate-400 font-medium">Garantías Parciales (${parcialRate}%)</span>
                        <span class="text-amber-600 dark:text-amber-400 font-bold">${data.parcial}</span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div class="bg-amber-500 h-full rounded-full" style="width: ${parcialRate}%"></div>
                    </div>
                </div>
            </div>

            ${topProduct ? `
            <div class="bg-white dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div class="flex justify-between items-center mb-1">
                    <p class="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Producto con Mayor Incidencia</p>
                    <span class="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">RMS: ${topProduct.rms}</span>
                </div>
                <p class="text-slate-900 dark:text-white font-bold text-sm mb-1 truncate" title="${topProduct.descripcion}">${topProduct.descripcion || 'Sin descripción'}</p>
                <div class="mt-2 flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span class="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 px-2 py-0.5 rounded-md font-bold">Alerta Crítica</span>
                    <span class="text-xs font-black text-slate-900 dark:text-white">${topProduct.sum} Fallos</span>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

function formatDateShort(fechaStr) {
    if (!fechaStr) return 'N/A';
    const raw = String(fechaStr).split(' ')[0];
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return raw;
}

function renderTable() {
    const query  = searchInput ? searchInput.value.toLowerCase() : '';
    const tbody  = document.getElementById('table-body');
    const rowCountEl = document.getElementById('table-row-count');
    
    if(!window.aggregatedProducts || window.aggregatedProducts.length === 0) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">No se encontraron registros para el filtro seleccionado.</td></tr>`;
        return;
    }

    let filtered = window.aggregatedProducts;

    if(currentBrandTableFilter !== 'ALL') {
        filtered = filtered.filter(p => p.marca === currentBrandTableFilter);
    }

    if(query) {
        filtered = filtered.filter(p => 
            p.marca.toLowerCase().includes(query) || 
            p.rms.toLowerCase().includes(query) ||
            (p.descripcion || '').toLowerCase().includes(query)
        );
    }

    window.currentFilteredProducts = filtered;

    const totalFiltered = filtered.length;
    const displayCount  = Math.min(totalFiltered, 200);
    
    if(rowCountEl) {
        const brandLabel = currentBrandTableFilter !== 'ALL' ? ` · Marca: ${currentBrandTableFilter}` : '';
        rowCountEl.textContent = `Mostrando ${displayCount} de ${totalFiltered} productos${brandLabel}`;
    }

    let html = '';
    for(let i=0; i < displayCount; i++) {
        const item = filtered[i];
        
        const MAX_VISIBLE_OTS = 2;
        const visibleOts = item.otDetails.slice(0, MAX_VISIBLE_OTS);
        const remainingCount = item.otDetails.length - MAX_VISIBLE_OTS;
        
        let otDetailsDisplay = visibleOts.map(d => {
            const unitColor = d.unidad === 'MAESTROS'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
            return `<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-mono mr-1 mb-1 whitespace-nowrap">
                <span class="px-1 rounded text-[9px] font-bold mr-1 ${unitColor}">${d.unidad === 'MAESTROS' ? 'M' : 'CS'}</span>
                ${formatDateShort(d.fecha)}: <strong class="ml-1 text-slate-900 dark:text-white font-bold">${d.ot}</strong>
            </span>`;
        }).join('');

        if (remainingCount > 0) {
            const fullListTooltip = item.otDetails.map(d => `[${d.unidad}] ${formatDateShort(d.fecha)}: OT ${d.ot}`).join('&#10;');
            otDetailsDisplay += `<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold cursor-help mb-1 whitespace-nowrap shadow-sm" title="${fullListTooltip}">+${remainingCount} más</span>`;
        }

        html += `
            <tr class="hover:bg-blue-50/70 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/70 group">
                <td class="font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">${item.marca}</td>
                <td class="font-mono text-xs text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">${item.rms}</td>
                <td class="text-xs text-slate-700 dark:text-slate-300 max-w-xs truncate font-medium" title="${item.descripcion}">${item.descripcion || 'Sin descripción'}</td>
                <td class="text-center"><span class="badge badge-parcial font-bold">${item.parcial}</span></td>
                <td class="text-center"><span class="badge badge-total font-bold">${item.total}</span></td>
                <td class="text-center font-black text-slate-900 dark:text-white text-sm">${item.sum}</td>
                <td class="text-xs max-w-md">${otDetailsDisplay}</td>
            </tr>
        `;
    }

    if(displayCount === 0) {
        const msg = currentBrandTableFilter !== 'ALL'
            ? `No hay productos registrados para la marca "${currentBrandTableFilter}"`
            : `No se encontraron resultados para "${query}"`;
        html = `<tr><td colspan="7" class="text-center py-8 text-slate-400">${msg}</td></tr>`;
    }

    tbody.innerHTML = html;
}

// ── Exportar a Excel la vista actual ──────────────────────────────────────────
function exportFilteredToExcel() {
    const source = window.currentFilteredProducts || window.aggregatedProducts;
    if(!source || source.length === 0) {
        alert('No hay datos para exportar. Aplica un filtro primero.');
        return;
    }

    const brandLabel = currentBrandTableFilter !== 'ALL' ? currentBrandTableFilter : 'TODAS_LAS_MARCAS';
    const fecha = new Date().toISOString().slice(0,10);
    const filename = `Garantias_${brandLabel}_${fecha}.xlsx`;

    const rows = [['Marca', 'RMS / Modelo', 'Descripción del Equipo', 'Garantía Parcial', 'Garantía Total', 'Total Reclamos', 'Unidad, Fecha y Nro. OT']];
    source.forEach(item => {
        const otList = item.otDetails.map(d => `[${d.unidad}] ${formatDateShort(d.fecha)}: ${d.ot}`);
        const pairs = [];
        for(let i=0; i<otList.length; i+=2) {
            if(i+1 < otList.length) {
                pairs.push(otList[i] + "        " + otList[i+1]);
            } else {
                pairs.push(otList[i]);
            }
        }
        const otText = pairs.join('\n');
        rows.push([item.marca, item.rms, item.descripcion, item.parcial, item.total, item.sum, otText]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws['!cols'] = [
        { wch: 20 },
        { wch: 20 },
        { wch: 45 },
        { wch: 18 },
        { wch: 18 },
        { wch: 16 },
        { wch: 48 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Garantías');
    XLSX.writeFile(wb, filename);
}

// Start app
function startApp() {
    initEvents();
    
    const checkData = () => {
        if (window.PRELOADED_DATA && window.PRELOADED_DATA.length > 0) {
            console.log("Datos pre-cargados encontrados:", window.PRELOADED_DATA.length);
            globalData = window.PRELOADED_DATA;
            updateDashboard();
            return true;
        }
        return false;
    };

    if (!checkData()) {
        let retries = 0;
        const interval = setInterval(() => {
            retries++;
            if (checkData() || retries > 10) clearInterval(interval);
        }, 300);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}
