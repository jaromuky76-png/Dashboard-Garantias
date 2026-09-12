// app.js

// Global Data State
let globalData = [];
let brandChartInstance = null;
let currentBrandTableFilter = 'ALL';

// DOM Elements
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const btnFolder = document.getElementById('btn-folder');
const folderInput = document.getElementById('folder-input');
const loadingIndicator = document.getElementById('loading');
const searchInput = document.getElementById('search-input');

// Initialize Events
function initEvents() {
    // Basic Drag & Drop
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
    fileInput.addEventListener('change', handleFilesSelect, false);
    
    // Folder Selection button proxy
    btnFolder.addEventListener('click', () => {
        folderInput.click();
    });
    folderInput.addEventListener('change', handleFilesSelect, false);

    // Search input
    searchInput.addEventListener('input', () => {
        renderTable();
    });

    // Table brand filter
    document.getElementById('table-brand-filter').addEventListener('change', (e) => {
        currentBrandTableFilter = e.target.value;
        renderTable();
    });

    // Alert filter
    document.getElementById('brand-alert-filter').addEventListener('change', (e) => {
        renderWorstProductsList(e.target.value);
    });

    // Comparator selectors
    document.getElementById('compare-brand-a').addEventListener('change', updateComparator);
    document.getElementById('compare-brand-b').addEventListener('change', updateComparator);
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
        fileInput.value = '';
        folderInput.value = '';
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
    
    // Si no existe el modal en esta página, solo enviamos como CS por defecto
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
    dropArea.classList.add('processing');
    
    // Cambiamos el texto para indicar procesamiento remoto
    const loadingText = loadingIndicator.querySelector('p');
    if(loadingText) loadingText.innerText = "Subiendo archivo y procesando datos... esto puede tardar un par de minutos.";

    try {
        for (let file of excelFiles) {
            await uploadFileWithRetry(file, false, unidad);
        }
        
        // Iniciar polling de estado
        const loadingText = loadingIndicator.querySelector('p') || loadingIndicator.querySelector('span');
        if(loadingText) loadingText.innerText = "Consolidando todos los archivos... Esto toma entre 1 y 5 minutos. Por favor no cierre la página.";
        
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
                // Si el servidor se apaga, dejamos de intentar
            }
        }, 5000);
        
    } catch(error) {
        console.error("Error al subir archivos:", error);
        alert("Hubo un error subiendo el archivo: " + error.message);
        
        loadingIndicator.classList.add('hidden');
        dropArea.classList.remove('processing');
        fileInput.value = '';
        folderInput.value = '';
    }
}

async function uploadFileWithRetry(file, overwrite = false, unidad = 'CS', anioOverride = null, mesOverride = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('overwrite', overwrite);
    formData.append('unidad_negocio', unidad);
    
    // Detectar mes del nombre del archivo en el cliente (evita carga pesada en servidor)
    const MESES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO',
                   'JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
    const nameUpper = file.name.toUpperCase();
    
    // Año: primero buscar en el nombre, luego usar el actual
    let anio = anioOverride;
    if (!anio) {
        const yearMatch = nameUpper.match(/(20\d{2})/);
        anio = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
    }
    
    // Mes: buscar en el nombre del archivo
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

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // Intentar encontrar la hoja que se llama 'OT' o 'ESTADO DE OT'
                let targetSheetName = workbook.SheetNames.find(n => n.trim().toUpperCase() === 'OT' || n.trim().toUpperCase() === 'ESTADO DE OT');
                
                // Si no existe, usamos la primera hoja por defecto
                if (!targetSheetName) {
                    targetSheetName = workbook.SheetNames[0]; 
                }
                
                const worksheet = workbook.Sheets[targetSheetName];
                
                // Convertir a formato de array 2D para buscar en qué fila están realmente los encabezados
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
                
                let headerRowIndex = -1;
                let headers = [];
                for(let i=0; i<Math.min(20, rawData.length); i++) {
                    const row = rawData[i];
                    if(row && (row.includes('TIPO DE GARANTIA') || row.includes('MARCA') || row.includes('RMS'))) {
                        headerRowIndex = i;
                        headers = row;
                        break;
                    }
                }
                
                let jsonData = [];
                if(headerRowIndex !== -1) {
                    // Mapeamos los datos manualmente a objetos JSON usando los headers encontrados
                    for(let i = headerRowIndex + 1; i < rawData.length; i++) {
                        let rowObj = {};
                        for(let j=0; j < headers.length; j++) {
                            if(headers[j]) {
                                rowObj[headers[j]] = rawData[i][j];
                            }
                        }
                        jsonData.push(rowObj);
                    }
                } else {
                    // Si no encuentra el texto, asume la fila 3 (índice 2) como plan B
                    jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 2, defval: null });
                }
                
                // Process the data
                const processed = [];
                for(let row of jsonData) {
                    const tipoGarantia = String(row['TIPO DE GARANTIA'] || '').toUpperCase().trim();
                    
                    if(tipoGarantia.includes('GARANTIA PARCIAL') || tipoGarantia.includes('GARANTIA TOTAL')) {
                        // Ajustamos la verificación para considerar si dice GARANTIA PARCIAL o GARANTIA TOTAL incluso con espacios o pequeñas variaciones
                        const normalizedGarantia = tipoGarantia.includes('TOTAL') ? 'GARANTIA TOTAL' : 'GARANTIA PARCIAL';
                        
                        processed.push({
                            marca: String(row['MARCA'] || 'Desconocida').trim().toUpperCase(),
                            rms: String(row['RMS'] || 'N/A').trim(),
                            descripcion: String(row['DESCRIPCION DEL EQUIPO'] || '').trim(),
                            tipoGarantia: normalizedGarantia
                        });
                    }
                }
                resolve(processed);
            } catch(err) {
                reject(err);
            }
        };
        
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Dashboard Update Logic
function applyGlobalFilter() {
    const yearSel = document.getElementById('filter-year').value;
    const monthSel = document.getElementById('filter-month').value;
    
    window.filteredGlobalData = globalData.filter(d => {
        const matchYear = yearSel === 'ALL' || d.anio == yearSel;
        const matchMonth = monthSel === 'ALL' || d.mesNum == monthSel;
        return matchYear && matchMonth;
    });
    
    updateDashboard();
}

function updateDashboard() {
    const dataToUse = window.filteredGlobalData || globalData;
    
    // KPIs
    const totalParciales = dataToUse.filter(d => d.tipoGarantia === 'GARANTIA PARCIAL').length;
    const totalTotales = dataToUse.filter(d => d.tipoGarantia === 'GARANTIA TOTAL').length;
    const totalGeneral = dataToUse.length;
    
    // Using simple logic to avoid reading the file again for row count. We just show total "warranties" found.
    // To show "Total OTs Evaluadas" we could ideally need the un-filtered count, but since we filtered early to save RAM,
    // we'll rename the KPI to reflect filtered totals. Wait, I'll update the text in UI via JS.
    document.getElementById('kpi-rows').parentElement.querySelector('h3').innerText = "Total Reclamos de Garantía";

    document.getElementById('kpi-files').innerText = globalData.length > 0 ? "Actualizado" : "0";
    document.getElementById('kpi-rows').innerText = totalGeneral.toLocaleString();
    document.getElementById('kpi-parcial').innerText = totalParciales.toLocaleString();
    document.getElementById('kpi-total').innerText = totalTotales.toLocaleString();

    // Data Aggregation
    // Agrupar por marca
    const byBrand = {};
    const byProduct = {};

    dataToUse.forEach(item => {
        // Por marca
        if(!byBrand[item.marca]) {
            byBrand[item.marca] = { parcial: 0, total: 0, sum: 0 };
        }
        if(item.tipoGarantia === 'GARANTIA PARCIAL') byBrand[item.marca].parcial++;
        else if(item.tipoGarantia === 'GARANTIA TOTAL') byBrand[item.marca].total++;
        byBrand[item.marca].sum++;

        // Por producto
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
        if (!byProduct[pKey].ots.has(otNumber)) {
            byProduct[pKey].ots.add(otNumber);
            byProduct[pKey].otDetails.push({ ot: otNumber, fecha: item.fecha || 'N/A' });
        }
    });

    renderChart(byBrand);
    
    // Store data globally
    window.byBrand = byBrand;
    window.aggregatedProducts = Object.values(byProduct).sort((a,b) => b.sum - a.sum);
    
    populateSelectors();
    renderWorstProductsList('ALL');
    renderTable();
}

function populateSelectors() {
    const brands = Object.keys(window.byBrand).sort();
    const alertFilter    = document.getElementById('brand-alert-filter');
    const compA          = document.getElementById('compare-brand-a');
    const compB          = document.getElementById('compare-brand-b');
    const tableBrandSel  = document.getElementById('table-brand-filter');

    // Save current values to restore them if they exist
    const selectedFilter = alertFilter.value;
    const selectedA      = compA.value;
    const selectedB      = compB.value;
    const selectedTable  = tableBrandSel.value;

    // Clear and refill selectors
    const brandOptions = brands.map(b => `<option value="${b}">${b}</option>`).join('');
    
    alertFilter.innerHTML   = '<option value="ALL">Todas las Marcas</option>' + brandOptions;
    tableBrandSel.innerHTML = '<option value="ALL">Todas las Marcas</option>' + brandOptions;
    compA.innerHTML = '<option value="">Seleccione Marca A</option>' + brandOptions;
    compB.innerHTML = '<option value="">Seleccione Marca B</option>' + brandOptions;

    // Restore selections
    alertFilter.value  = brands.includes(selectedFilter) ? selectedFilter : 'ALL';
    tableBrandSel.value = brands.includes(selectedTable) ? selectedTable : 'ALL';
    compA.value = brands.includes(selectedA) ? selectedA : '';
    compB.value = brands.includes(selectedB) ? selectedB : '';

    // Inicializar selectores de año y mes de forma dinámica
    updatePeriodDropdowns();
}

function updatePeriodDropdowns() {
    const yearSel = document.getElementById('filter-year');
    const monthSel = document.getElementById('filter-month');
    if(!yearSel || !monthSel) return;

    const selectedYear = yearSel.value;
    const selectedMonth = monthSel.value;

    // Calcular años disponibles
    const years = [...new Set(globalData.map(d => d.anio).filter(y => y))].sort();
    
    // Rellenar años solo si no se ha rellenado
    if(yearSel.options.length <= 1 && years.length > 0) {
        yearSel.innerHTML = '<option value="ALL">Todos los Años</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
        yearSel.value = selectedYear || 'ALL';
    }

    // Calcular meses disponibles basados en el año seleccionado (si aplica)
    const availableData = (yearSel.value === 'ALL') ? globalData : globalData.filter(d => d.anio == yearSel.value);
    const monthsSet = new Set(availableData.map(d => parseInt(d.mesNum)).filter(m => !isNaN(m)));
    const availableMonths = [...monthsSet].sort((a,b) => a - b);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
    // Regenerar meses siempre para que se adapte al año seleccionado
    monthSel.innerHTML = '<option value="ALL">Todos los Meses</option>' + availableMonths.map(mNum => {
        return `<option value="${mNum}">${monthNames[mNum - 1]}</option>`;
    }).join('');

    // Restaurar selección si aún es válida, si no 'ALL'
    if(availableMonths.includes(parseInt(selectedMonth))) {
        monthSel.value = selectedMonth;
    } else {
        monthSel.value = 'ALL';
    }
}

// Global Filter Logic setup
document.getElementById('filter-year')?.addEventListener('change', () => {
    updatePeriodDropdowns();
    applyGlobalFilter();
});
document.getElementById('filter-month')?.addEventListener('change', applyGlobalFilter);
document.getElementById('btn-apply-filter')?.addEventListener('click', applyGlobalFilter);

function renderChart(brandData) {
    // Sort brands by total warranties
    const sortedBrands = Object.entries(brandData).sort((a, b) => b[1].sum - a[1].sum);
    
    // We'll take top 15 max for chart readability
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
                    backgroundColor: 'rgba(239, 68, 68, 0.85)', // red-500
                    borderColor: 'rgb(239, 68, 68)',
                    borderRadius: 4,
                    borderWidth: 1
                },
                {
                    label: 'Garantía Parcial',
                    data: dParcial,
                    backgroundColor: 'rgba(245, 158, 11, 0.85)', // amber-500
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
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate" title="${p.descripcion}">${p.descripcion}</p>
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
                <p class="text-slate-900 dark:text-white font-bold text-sm mb-1 truncate" title="${topProduct.descripcion}">${topProduct.descripcion}</p>
                <div class="mt-2 flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span class="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 px-2 py-0.5 rounded-md font-bold">Alerta Crítica</span>
                    <span class="text-xs font-black text-slate-900 dark:text-white">${topProduct.sum} Fallos</span>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

function renderTable() {
    const query  = searchInput.value.toLowerCase();
    const tbody  = document.getElementById('table-body');
    const rowCountEl = document.getElementById('table-row-count');
    
    if(!window.aggregatedProducts || window.aggregatedProducts.length === 0) return;

    let filtered = window.aggregatedProducts;

    // Filtro por marca (dropdown)
    if(currentBrandTableFilter !== 'ALL') {
        filtered = filtered.filter(p => p.marca === currentBrandTableFilter);
    }

    // Filtro por texto libre
    if(query) {
        filtered = filtered.filter(p => 
            p.marca.toLowerCase().includes(query) || 
            p.rms.toLowerCase().includes(query) ||
            p.descripcion.toLowerCase().includes(query)
        );
    }

    // Guardar el filtrado actual para exportación
    window.currentFilteredProducts = filtered;

    const totalFiltered = filtered.length;
    const displayCount  = Math.min(totalFiltered, 200);
    
    // Actualizar indicador de filas
    if(rowCountEl) {
        const brandLabel = currentBrandTableFilter !== 'ALL' ? ` · Marca: ${currentBrandTableFilter}` : '';
        rowCountEl.textContent = `Mostrando ${displayCount} de ${totalFiltered} productos${brandLabel}`;
    }

    let html = '';
    for(let i=0; i < displayCount; i++) {
        const item = filtered[i];
        
        // Formatear las OTs de manera profesional, minimalista y compacta
        const MAX_VISIBLE_OTS = 2;
        const visibleOts = item.otDetails.slice(0, MAX_VISIBLE_OTS);
        const remainingCount = item.otDetails.length - MAX_VISIBLE_OTS;
        
        let otDetailsDisplay = visibleOts.map(d => 
            `<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-mono mr-1 mb-1 whitespace-nowrap">${d.fecha.split(' ')[0]}: <strong class="ml-1 text-slate-900 dark:text-white font-bold">${d.ot}</strong></span>`
        ).join('');

        if (remainingCount > 0) {
            const fullListTooltip = item.otDetails.map(d => `${d.fecha.split(' ')[0]}: OT ${d.ot}`).join('&#10;');
            otDetailsDisplay += `<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10px] font-bold cursor-help mb-1 whitespace-nowrap shadow-sm" title="${fullListTooltip}">+${remainingCount} más</span>`;
        }

        html += `
            <tr class="hover:bg-blue-50/70 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800/70 group">
                <td class="font-bold text-slate-900 dark:text-white text-xs whitespace-nowrap">${item.marca}</td>
                <td class="font-mono text-xs text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">${item.rms}</td>
                <td class="text-xs text-slate-700 dark:text-slate-300 max-w-xs truncate font-medium" title="${item.descripcion}">${item.descripcion}</td>
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

    // Construir filas con encabezados descriptivos
    const rows = [['Marca', 'RMS', 'Descripción del Equipo', 'Garantía Parcial', 'Garantía Total', 'Total Reclamos', 'Mes y Nro. OT']];
    source.forEach(item => {
        const otList = item.otDetails.map(d => `${d.fecha.split(' ')[0]}: ${d.ot}`);
        const pairs = [];
        for(let i=0; i<otList.length; i+=2) {
            if(i+1 < otList.length) {
                // Alineación con espacios simulada para asemejarse al grid del dashboard
                pairs.push(otList[i] + "        " + otList[i+1]);
            } else {
                pairs.push(otList[i]);
            }
        }
        const otText = pairs.join('\n');
        rows.push([item.marca, item.rms, item.descripcion, item.parcial, item.total, item.sum, otText]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Ancho de columnas
    ws['!cols'] = [
        { wch: 20 }, // Marca
        { wch: 18 }, // RMS
        { wch: 45 }, // Descripción
        { wch: 18 }, // Parcial
        { wch: 18 }, // Total
        { wch: 16 }  // Total Reclamos
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Garantías');
    XLSX.writeFile(wb, filename);
}

// Start app
function startApp() {
    initEvents();
    
    // Check if data is already loaded or arrives later
    const checkData = () => {
        if (window.PRELOADED_DATA && window.PRELOADED_DATA.length > 0) {
            console.log("Datos pre-cargados encontrados:", window.PRELOADED_DATA.length);
            globalData = window.PRELOADED_DATA;
            updateDashboard();

            // Usar metadatos del script si están disponibles
            const meta = window.PRELOADED_META;
            if(meta) {
                document.getElementById('kpi-files').innerText = `${meta.archivosProcessados} archivos`;
            } else {
                document.getElementById('kpi-files').innerText = "Actualizado";
            }
            return true;
        }
        return false;
    };

    if (!checkData()) {
        // Retry a few times in case of slow script loading
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
