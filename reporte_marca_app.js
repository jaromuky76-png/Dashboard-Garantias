// reporte_marca_app.js -- Módulo Gerencial y de Auditoría de Garantías por Marca
// SILVA INTERNACIONAL S.A.

(function() {
    let allRecords = [];
    let currentMainView = 'matriz'; // 'matriz' | 'detalle'

    // Estado Matriz Gerencial
    let matrizDesdeAnio = 2025;
    let matrizDesdeMes = 1;
    let matrizHastaAnio = 2026;
    let matrizHastaMes = 5;
    let matrizDesglose = 'categoria';
    let matrizMarca = 'ALL';

    let chartCasos = null;
    let chartTiempos = null;

    // Estado Auditoría Detallada
    let filteredDetalleRecords = [];
    let currentPage = 1;
    let pageSize = 25;

    const MESES_NOMBRES = {
        1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO', 4: 'ABRIL',
        5: 'MAYO', 6: 'JUNIO', 7: 'JULIO', 8: 'AGOSTO',
        9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE'
    };

    const MESES_ABR = {
        1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr',
        5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Ago',
        9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic'
    };

    function init() {
        if (!window.REPORTES_DATA) {
            console.warn("window.REPORTES_DATA no disponible aún. Reintentando...");
            setTimeout(init, 150);
            return;
        }

        allRecords = window.REPORTES_DATA || [];
        console.log(`Cargados ${allRecords.length} registros en Reportes y Análisis Gerencial.`);

        // Header total
        const headerTotal = document.getElementById('header-total-registros');
        if (headerTotal) {
            headerTotal.textContent = allRecords.length.toLocaleString();
        }

        // Poblar Selectores de Marcas
        poblarSelectoresMarcas();

        // Listeners Matriz
        const mDesglose = document.getElementById('matriz-desglose');
        if (mDesglose) mDesglose.addEventListener('change', (e) => { matrizDesglose = e.target.value; calcularMatriz(); });

        const mMarca = document.getElementById('matriz-filtro-marca');
        if (mMarca) mMarca.addEventListener('change', (e) => { matrizMarca = e.target.value; calcularMatriz(); });

        const mDMes = document.getElementById('matriz-desde-mes');
        const mDAnio = document.getElementById('matriz-desde-anio');
        const mHMes = document.getElementById('matriz-hasta-mes');
        const mHAnio = document.getElementById('matriz-hasta-anio');

        if (mDMes) mDMes.addEventListener('change', (e) => { deseleccionarBotonesRapidosMatriz(); matrizDesdeMes = parseInt(e.target.value); calcularMatriz(); });
        if (mDAnio) mDAnio.addEventListener('change', (e) => { deseleccionarBotonesRapidosMatriz(); matrizDesdeAnio = parseInt(e.target.value); calcularMatriz(); });
        if (mHMes) mHMes.addEventListener('change', (e) => { deseleccionarBotonesRapidosMatriz(); matrizHastaMes = parseInt(e.target.value); calcularMatriz(); });
        if (mHAnio) mHAnio.addEventListener('change', (e) => { deseleccionarBotonesRapidosMatriz(); matrizHastaAnio = parseInt(e.target.value); calcularMatriz(); });

        // Listeners Detalle
        const fMarca = document.getElementById('filtro-marca');
        if (fMarca) fMarca.addEventListener('change', () => { currentPage = 1; aplicarFiltrosDetalle(); });

        const fUnidad = document.getElementById('filtro-unidad');
        if (fUnidad) fUnidad.addEventListener('change', () => { currentPage = 1; aplicarFiltrosDetalle(); });

        const fDMes = document.getElementById('filtro-desde-mes');
        const fDAnio = document.getElementById('filtro-desde-anio');
        const fHMes = document.getElementById('filtro-hasta-mes');
        const fHAnio = document.getElementById('filtro-hasta-anio');

        if (fDMes) fDMes.addEventListener('change', () => { deseleccionarBotonesRapidosDetalle(); currentPage = 1; aplicarFiltrosDetalle(); });
        if (fDAnio) fDAnio.addEventListener('change', () => { deseleccionarBotonesRapidosDetalle(); currentPage = 1; aplicarFiltrosDetalle(); });
        if (fHMes) fHMes.addEventListener('change', () => { deseleccionarBotonesRapidosDetalle(); currentPage = 1; aplicarFiltrosDetalle(); });
        if (fHAnio) fHAnio.addEventListener('change', () => { deseleccionarBotonesRapidosDetalle(); currentPage = 1; aplicarFiltrosDetalle(); });

        const buscador = document.getElementById('buscador-general');
        const btnClear = document.getElementById('btn-clear-search');
        if (buscador) {
            buscador.addEventListener('input', () => {
                if (btnClear) {
                    if (buscador.value.trim().length > 0) btnClear.classList.remove('hidden');
                    else btnClear.classList.add('hidden');
                }
                currentPage = 1;
                aplicarFiltrosDetalle();
            });
        }

        // Ejecutar cálculos iniciales
        calcularMatriz();
        aplicarFiltrosDetalle();
    }

    // =========================================================================
    // CONMUTACIÓN DE VISTAS (MATRIZ VS DETALLE)
    // =========================================================================
    window.switchMainView = function(viewName) {
        currentMainView = viewName;
        const viewMatriz = document.getElementById('view-matriz-gerencial');
        const viewDetalle = document.getElementById('view-auditoria-detallada');
        const tabMatriz = document.getElementById('tab-btn-matriz');
        const tabDetalle = document.getElementById('tab-btn-detalle');

        if (viewName === 'matriz') {
            if (viewMatriz) viewMatriz.classList.remove('hidden');
            if (viewDetalle) viewDetalle.classList.add('hidden');

            if (tabMatriz) {
                tabMatriz.className = "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs tracking-wide transition-all cursor-pointer shadow-md bg-blue-600 text-white";
            }
            if (tabDetalle) {
                tabDetalle.className = "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
            }
            // Redibujar gráficos para ajustar dimensiones
            setTimeout(refreshReporteCharts, 100);
        } else {
            if (viewMatriz) viewMatriz.classList.add('hidden');
            if (viewDetalle) viewDetalle.classList.remove('hidden');

            if (tabDetalle) {
                tabDetalle.className = "flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs tracking-wide transition-all cursor-pointer shadow-md bg-blue-600 text-white";
            }
            if (tabMatriz) {
                tabMatriz.className = "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wide transition-all cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
            }
        }
    };

    // =========================================================================
    // POBLAR MARCAS
    // =========================================================================
    function poblarSelectoresMarcas() {
        const marcasSet = new Set();
        allRecords.forEach(r => {
            if (r.marca && r.marca !== 'DESCONOCIDA') {
                marcasSet.add(r.marca.trim().toUpperCase());
            }
        });
        const marcasOrdenadas = Array.from(marcasSet).sort();

        // 1. Selector Matriz
        const selMatriz = document.getElementById('matriz-filtro-marca');
        if (selMatriz) {
            selMatriz.innerHTML = '<option value="ALL" selected>Todas las Marcas (General)</option>';
            marcasOrdenadas.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                selMatriz.appendChild(opt);
            });
        }

        // 2. Selector Detalle
        const selDetalle = document.getElementById('filtro-marca');
        if (selDetalle) {
            selDetalle.innerHTML = '<option value="ALL">Todas las Marcas (' + marcasOrdenadas.length + ' disponibles)</option>';
            marcasOrdenadas.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                if (m === 'HISENSE') opt.selected = true; // Hisense por defecto en auditoria
                selDetalle.appendChild(opt);
            });
        }

        const label = document.getElementById('marca-count-label');
        if (label) label.textContent = `${marcasOrdenadas.length} marcas registradas`;
    }

    // =========================================================================
    // LÓGICA DE MATRIZ GERENCIAL Y TIEMPOS DE RESPUESTA
    // =========================================================================
    function deseleccionarBotonesRapidosMatriz() {
        document.querySelectorAll('#view-matriz-gerencial .btn-periodo').forEach(b => b.classList.remove('active'));
    }

    window.setMatrizRangoRapido = function(dAnio, dMes, hAnio, hMes, btnElement) {
        deseleccionarBotonesRapidosMatriz();
        if (btnElement) btnElement.classList.add('active');

        matrizDesdeAnio = dAnio;
        matrizDesdeMes = dMes;
        matrizHastaAnio = hAnio;
        matrizHastaMes = hMes;

        const elDMes = document.getElementById('matriz-desde-mes');
        const elDAnio = document.getElementById('matriz-desde-anio');
        const elHMes = document.getElementById('matriz-hasta-mes');
        const elHAnio = document.getElementById('matriz-hasta-anio');

        if (elDMes) elDMes.value = String(dMes);
        if (elDAnio) elDAnio.value = String(dAnio);
        if (elHMes) elHMes.value = String(hMes);
        if (elHAnio) elHAnio.value = String(hAnio);

        calcularMatriz();
    };

    function calcularMatriz() {
        // Filtrar registros por rango de fechas y marca
        const startVal = matrizDesdeAnio * 100 + matrizDesdeMes;
        const endVal = matrizHastaAnio * 100 + matrizHastaMes;

        const records = allRecords.filter(r => {
            const anio = parseInt(r.anio) || 2026;
            const mesNum = parseInt(r.mesNum) || 1;
            const val = anio * 100 + mesNum;
            if (val < startVal || val > endVal) return false;

            if (matrizMarca !== 'ALL') {
                if ((r.marca || '').toUpperCase() !== matrizMarca) return false;
            }
            return true;
        });

        // Agrupar por Mes
        // Generar lista de todos los meses en el rango en orden cronológico
        const mesesEnRango = [];
        let curY = matrizDesdeAnio;
        let curM = matrizDesdeMes;
        while (curY * 100 + curM <= endVal) {
            mesesEnRango.push({
                key: `${curY}-${String(curM).padStart(2, '0')}`,
                anio: curY,
                mesNum: curM,
                label: `${MESES_ABR[curM]} ${curY}`,
                fullLabel: `${MESES_NOMBRES[curM]} ${curY}`
            });
            curM++;
            if (curM > 12) {
                curM = 1;
                curY++;
            }
        }

        // Determinar categorías activas según el tipo de desglose
        const catCountsGlobal = {};
        records.forEach(r => {
            let catKey = '';
            if (matrizDesglose === 'categoria') {
                catKey = r.categoria || 'Otras Categorías';
            } else if (matrizDesglose === 'tipo_garantia') {
                catKey = r.tipo_garantia || 'SIN ESPECIFICAR';
            } else {
                catKey = r.unidad === 'CS' ? 'Centro de Servicios' : 'Maestros';
            }
            catCountsGlobal[catKey] = (catCountsGlobal[catKey] || 0) + 1;
        });

        // Ordenar categorías por volumen descendente
        const categoriasOrdenadas = Object.keys(catCountsGlobal).sort((a, b) => catCountsGlobal[b] - catCountsGlobal[a]);

        // Estructura por mes
        const mesesData = {};
        mesesEnRango.forEach(m => {
            mesesData[m.key] = {
                meta: m,
                total: 0,
                categorias: {},
                diagDias: [],
                cierreDias: []
            };
            categoriasOrdenadas.forEach(c => {
                mesesData[m.key].categorias[c] = 0;
            });
        });

        // Llenar datos
        let totalGeneralCasos = 0;
        const allDiagDias = [];
        const allCierreDias = [];

        records.forEach(r => {
            const anio = parseInt(r.anio) || 2026;
            const mesNum = parseInt(r.mesNum) || 1;
            const key = `${anio}-${String(mesNum).padStart(2, '0')}`;
            if (!mesesData[key]) return;

            let catKey = '';
            if (matrizDesglose === 'categoria') catKey = r.categoria || 'Otras Categorías';
            else if (matrizDesglose === 'tipo_garantia') catKey = r.tipo_garantia || 'SIN ESPECIFICAR';
            else catKey = r.unidad === 'CS' ? 'Centro de Servicios' : 'Maestros';

            mesesData[key].total++;
            mesesData[key].categorias[catKey] = (mesesData[key].categorias[catKey] || 0) + 1;
            totalGeneralCasos++;

            if (r.dias_diagnostico !== null && r.dias_diagnostico !== undefined && !isNaN(r.dias_diagnostico)) {
                mesesData[key].diagDias.push(parseFloat(r.dias_diagnostico));
                allDiagDias.push(parseFloat(r.dias_diagnostico));
            }
            if (r.dias_cierre !== null && r.dias_cierre !== undefined && !isNaN(r.dias_cierre)) {
                mesesData[key].cierreDias.push(parseFloat(r.dias_cierre));
                allCierreDias.push(parseFloat(r.dias_cierre));
            }
        });

        // Actualizar KPIs de la Matriz
        const elTotal = document.getElementById('matriz-kpi-total');
        if (elTotal) elTotal.textContent = totalGeneralCasos.toLocaleString();

        const elDiag = document.getElementById('matriz-kpi-diag');
        if (elDiag) {
            if (allDiagDias.length > 0) {
                const avg = allDiagDias.reduce((a, b) => a + b, 0) / allDiagDias.length;
                const hrs = Math.round(avg * 24);
                elDiag.textContent = `${avg.toFixed(1)} días`;
                const sub = document.getElementById('matriz-kpi-diag-sub');
                if (sub) sub.textContent = `~${hrs} hrs promedio (${allDiagDias.length.toLocaleString()} casos evaluados)`;
            } else {
                elDiag.textContent = 'N/D';
            }
        }

        const elCierre = document.getElementById('matriz-kpi-cierre');
        if (elCierre) {
            if (allCierreDias.length > 0) {
                const avg = allCierreDias.reduce((a, b) => a + b, 0) / allCierreDias.length;
                elCierre.textContent = `${avg.toFixed(1)} días`;
                const sub = document.getElementById('matriz-kpi-cierre-sub');
                if (sub) sub.textContent = `Ciclo Completo (${allCierreDias.length.toLocaleString()} casos finalizados)`;
            } else {
                elCierre.textContent = 'N/D';
            }
        }

        const elCatP = document.getElementById('matriz-kpi-cat-principal');
        const elCatSub = document.getElementById('matriz-kpi-cat-sub');
        if (elCatP && categoriasOrdenadas.length > 0) {
            const topCat = categoriasOrdenadas[0];
            const topCount = catCountsGlobal[topCat] || 0;
            const pct = totalGeneralCasos > 0 ? ((topCount / totalGeneralCasos) * 100).toFixed(1) : '0';
            elCatP.textContent = topCat;
            if (elCatSub) elCatSub.textContent = `${topCount.toLocaleString()} casos (${pct}% del total)`;
        } else if (elCatP) {
            elCatP.textContent = '--';
            if (elCatSub) elCatSub.textContent = '0% del total';
        }

        const mesesLabel = document.getElementById('matriz-total-meses-label');
        if (mesesLabel) mesesLabel.textContent = `${mesesEnRango.length} meses`;

        // Renderizar Tabla Matriz
        renderTablaMatriz(mesesEnRango, categoriasOrdenadas, mesesData, catCountsGlobal, totalGeneralCasos, allDiagDias, allCierreDias);

        // Renderizar Gráficos
        renderGraficosMatriz(mesesEnRango, categoriasOrdenadas, mesesData);
    }

    function renderTablaMatriz(mesesEnRango, categorias, mesesData, catCountsGlobal, totalCasos, allDiagDias, allCierreDias) {
        const thead = document.getElementById('matriz-thead');
        const tbody = document.getElementById('matriz-tbody');
        const tfoot = document.getElementById('matriz-tfoot');

        if (!thead || !tbody || !tfoot) return;

        // Thead
        let headHtml = '<tr><th class="w-36">Mes / Período</th>';
        categorias.forEach(cat => {
            headHtml += `<th class="text-right px-3">${cat}</th>`;
        });
        headHtml += '<th class="text-right px-4 bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-extrabold">Total Casos</th>';
        headHtml += '<th class="text-right px-3 text-emerald-700 dark:text-emerald-400">Diag. Prom (Días)</th>';
        headHtml += '<th class="text-right px-3 text-purple-700 dark:text-purple-400">Cierre Prom (Días)</th></tr>';
        thead.innerHTML = headHtml;

        // Tbody
        let bodyHtml = '';
        mesesEnRango.forEach(m => {
            const rowData = mesesData[m.key];
            const avgD = rowData.diagDias.length > 0 ? (rowData.diagDias.reduce((a, b) => a + b, 0) / rowData.diagDias.length).toFixed(1) : '-';
            const avgC = rowData.cierreDias.length > 0 ? (rowData.cierreDias.reduce((a, b) => a + b, 0) / rowData.cierreDias.length).toFixed(1) : '-';

            bodyHtml += `<tr class="table-row-item">
                <td class="font-bold text-slate-900 dark:text-white whitespace-nowrap flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>${m.fullLabel}</span>
                </td>`;

            categorias.forEach(cat => {
                const count = rowData.categorias[cat] || 0;
                const cellClass = count > 0 ? 'text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-400 dark:text-slate-600';
                bodyHtml += `<td class="text-right px-3 ${cellClass}">${count > 0 ? count.toLocaleString() : '-'}</td>`;
            });

            bodyHtml += `<td class="text-right px-4 font-black text-blue-600 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/20">${rowData.total.toLocaleString()}</td>
                <td class="text-right px-3 font-semibold text-emerald-600 dark:text-emerald-400">${avgD !== '-' ? avgD + ' d' : '-'}</td>
                <td class="text-right px-3 font-semibold text-purple-600 dark:text-purple-400">${avgC !== '-' ? avgC + ' d' : '-'}</td>
            </tr>`;
        });
        tbody.innerHTML = bodyHtml;

        // Tfoot
        const avgGlobalDiag = allDiagDias.length > 0 ? (allDiagDias.reduce((a, b) => a + b, 0) / allDiagDias.length).toFixed(1) + ' d' : '-';
        const avgGlobalCierre = allCierreDias.length > 0 ? (allCierreDias.reduce((a, b) => a + b, 0) / allCierreDias.length).toFixed(1) + ' d' : '-';

        let footHtml = `<tr class="bg-slate-100 dark:bg-slate-900 border-t-2 border-slate-300 dark:border-slate-700 font-black">
            <td class="text-slate-900 dark:text-white uppercase tracking-wider text-xs">TOTALES / PROMEDIOS</td>`;
        categorias.forEach(cat => {
            const cTotal = catCountsGlobal[cat] || 0;
            footHtml += `<td class="text-right px-3 text-slate-900 dark:text-white">${cTotal.toLocaleString()}</td>`;
        });
        footHtml += `<td class="text-right px-4 text-blue-700 dark:text-blue-300 text-sm">${totalCasos.toLocaleString()}</td>
            <td class="text-right px-3 text-emerald-700 dark:text-emerald-400 text-sm">${avgGlobalDiag}</td>
            <td class="text-right px-3 text-purple-700 dark:text-purple-400 text-sm">${avgGlobalCierre}</td>
        </tr>`;
        tfoot.innerHTML = footHtml;
    }

    // =========================================================================
    // RENDERIZADO DE GRÁFICOS (CHART.JS)
    // =========================================================================
    function getThemeColors() {
        const isDark = document.documentElement.classList.contains('dark');
        return {
            textColor: isDark ? '#94a3b8' : '#64748b',
            gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
            tooltipBg: isDark ? '#1e293b' : '#ffffff',
            tooltipText: isDark ? '#f8fafc' : '#0f172a'
        };
    }

    function renderGraficosMatriz(mesesEnRango, categorias, mesesData) {
        if (typeof Chart === 'undefined') return;

        const labels = mesesEnRango.map(m => m.label);
        const theme = getThemeColors();

        // 1. Gráfico de Casos Mensuales
        const ctxCasos = document.getElementById('chart-casos-mensual');
        if (ctxCasos) {
            if (chartCasos) chartCasos.destroy();

            // Paleta de colores para categorias
            const palette = [
                { bg: 'rgba(37, 99, 235, 0.8)', border: '#2563eb' },
                { bg: 'rgba(16, 185, 129, 0.8)', border: '#10b981' },
                { bg: 'rgba(168, 85, 247, 0.8)', border: '#a855f7' },
                { bg: 'rgba(245, 158, 11, 0.8)', border: '#f59e0b' },
                { bg: 'rgba(14, 165, 233, 0.8)', border: '#0ea5e9' },
                { bg: 'rgba(236, 72, 153, 0.8)', border: '#ec4899' },
                { bg: 'rgba(100, 116, 139, 0.8)', border: '#64748b' }
            ];

            const datasets = categorias.slice(0, 6).map((cat, idx) => {
                const color = palette[idx % palette.length];
                return {
                    label: cat,
                    data: mesesEnRango.map(m => mesesData[m.key].categorias[cat] || 0),
                    backgroundColor: color.bg,
                    borderColor: color.border,
                    borderWidth: 1,
                    borderRadius: 4
                };
            });

            chartCasos = new Chart(ctxCasos, {
                type: 'bar',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            stacked: true,
                            grid: { color: theme.gridColor },
                            ticks: { color: theme.textColor, font: { family: 'Inter', size: 10 } }
                        },
                        y: {
                            stacked: true,
                            grid: { color: theme.gridColor },
                            ticks: { color: theme.textColor, font: { family: 'Inter', size: 10 } }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: theme.textColor, font: { family: 'Inter', size: 10, weight: 600 } }
                        }
                    }
                }
            });
        }

        // 2. Gráfico de Tiempos de Respuesta
        const ctxTiempos = document.getElementById('chart-tiempos-respuesta');
        if (ctxTiempos) {
            if (chartTiempos) chartTiempos.destroy();

            const diagData = mesesEnRango.map(m => {
                const arr = mesesData[m.key].diagDias;
                return arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
            });

            const cierreData = mesesEnRango.map(m => {
                const arr = mesesData[m.key].cierreDias;
                return arr.length > 0 ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
            });

            chartTiempos = new Chart(ctxTiempos, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Diag. Promedio (Días)',
                            data: diagData,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.12)',
                            tension: 0.3,
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            fill: true
                        },
                        {
                            label: 'Cierre Promedio (Días)',
                            data: cierreData,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.08)',
                            tension: 0.3,
                            borderWidth: 2.5,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            grid: { color: theme.gridColor },
                            ticks: { color: theme.textColor, font: { family: 'Inter', size: 10 } }
                        },
                        y: {
                            grid: { color: theme.gridColor },
                            ticks: { 
                                color: theme.textColor, 
                                font: { family: 'Inter', size: 10 },
                                callback: val => val + ' d'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: { color: theme.textColor, font: { family: 'Inter', size: 10, weight: 600 } }
                        }
                    }
                }
            });
        }
    }

    window.refreshReporteCharts = function() {
        if (currentMainView === 'matriz') {
            calcularMatriz();
        }
    };

    // =========================================================================
    // EXPORTACIÓN A EXCEL: MATRIZ GERENCIAL + DETALLE EN 2 HOJAS
    // =========================================================================
    window.exportarMatrizExcel = function() {
        if (typeof XLSX === 'undefined') {
            alert('La librería SheetJS aún se está cargando. Por favor intente en unos segundos.');
            return;
        }

        const startVal = matrizDesdeAnio * 100 + matrizDesdeMes;
        const endVal = matrizHastaAnio * 100 + matrizHastaMes;

        const records = allRecords.filter(r => {
            const anio = parseInt(r.anio) || 2026;
            const mesNum = parseInt(r.mesNum) || 1;
            const val = anio * 100 + mesNum;
            if (val < startVal || val > endVal) return false;
            if (matrizMarca !== 'ALL') {
                if ((r.marca || '').toUpperCase() !== matrizMarca) return false;
            }
            return true;
        });

        // 1. Datos para Hoja 1: Resumen Gerencial
        const mesesEnRango = [];
        let curY = matrizDesdeAnio;
        let curM = matrizDesdeMes;
        while (curY * 100 + curM <= endVal) {
            mesesEnRango.push({
                key: `${curY}-${String(curM).padStart(2, '0')}`,
                anio: curY,
                mesNum: curM,
                label: `${MESES_NOMBRES[curM]} ${curY}`
            });
            curM++;
            if (curM > 12) { curM = 1; curY++; }
        }

        const catCountsGlobal = {};
        records.forEach(r => {
            let catKey = '';
            if (matrizDesglose === 'categoria') catKey = r.categoria || 'Otras Categorías';
            else if (matrizDesglose === 'tipo_garantia') catKey = r.tipo_garantia || 'SIN ESPECIFICAR';
            else catKey = r.unidad === 'CS' ? 'Centro de Servicios' : 'Maestros';
            catCountsGlobal[catKey] = (catCountsGlobal[catKey] || 0) + 1;
        });
        const categorias = Object.keys(catCountsGlobal).sort((a, b) => catCountsGlobal[b] - catCountsGlobal[a]);

        const mesesData = {};
        mesesEnRango.forEach(m => {
            mesesData[m.key] = { meta: m, total: 0, categorias: {}, diagDias: [], cierreDias: [] };
            categorias.forEach(c => { mesesData[m.key].categorias[c] = 0; });
        });

        const allDiagDias = [];
        const allCierreDias = [];

        records.forEach(r => {
            const anio = parseInt(r.anio) || 2026;
            const mesNum = parseInt(r.mesNum) || 1;
            const key = `${anio}-${String(mesNum).padStart(2, '0')}`;
            if (!mesesData[key]) return;

            let catKey = '';
            if (matrizDesglose === 'categoria') catKey = r.categoria || 'Otras Categorías';
            else if (matrizDesglose === 'tipo_garantia') catKey = r.tipo_garantia || 'SIN ESPECIFICAR';
            else catKey = r.unidad === 'CS' ? 'Centro de Servicios' : 'Maestros';

            mesesData[key].total++;
            mesesData[key].categorias[catKey] = (mesesData[key].categorias[catKey] || 0) + 1;

            if (r.dias_diagnostico !== null && !isNaN(r.dias_diagnostico)) {
                mesesData[key].diagDias.push(parseFloat(r.dias_diagnostico));
                allDiagDias.push(parseFloat(r.dias_diagnostico));
            }
            if (r.dias_cierre !== null && !isNaN(r.dias_cierre)) {
                mesesData[key].cierreDias.push(parseFloat(r.dias_cierre));
                allCierreDias.push(parseFloat(r.dias_cierre));
            }
        });

        // Construir matriz para Hoja 1
        const rowsHoja1 = [];
        rowsHoja1.push(["SILVA INTERNACIONAL S.A. - INFORME GERENCIAL DE GARANTÍAS Y TIEMPOS DE RESPUESTA"]);
        rowsHoja1.push([`Período: ${MESES_NOMBRES[matrizDesdeMes]} ${matrizDesdeAnio} a ${MESES_NOMBRES[matrizHastaMes]} ${matrizHastaAnio} | Marca: ${matrizMarca === 'ALL' ? 'Todas las Marcas' : matrizMarca}`]);
        rowsHoja1.push([]);

        // Encabezados
        const headersH1 = ["Mes / Período", ...categorias, "Total Casos", "Tiempo Diag. Prom (Días)", "Tiempo Cierre Prom (Días)"];
        rowsHoja1.push(headersH1);

        mesesEnRango.forEach(m => {
            const d = mesesData[m.key];
            const avgD = d.diagDias.length > 0 ? parseFloat((d.diagDias.reduce((a, b) => a + b, 0) / d.diagDias.length).toFixed(1)) : 0;
            const avgC = d.cierreDias.length > 0 ? parseFloat((d.cierreDias.reduce((a, b) => a + b, 0) / d.cierreDias.length).toFixed(1)) : 0;

            const row = [m.label];
            categorias.forEach(c => { row.push(d.categorias[c] || 0); });
            row.push(d.total);
            row.push(avgD > 0 ? avgD : "-");
            row.push(avgC > 0 ? avgC : "-");
            rowsHoja1.push(row);
        });

        // Fila de totales
        const avgTotD = allDiagDias.length > 0 ? parseFloat((allDiagDias.reduce((a, b) => a + b, 0) / allDiagDias.length).toFixed(1)) : 0;
        const avgTotC = allCierreDias.length > 0 ? parseFloat((allCierreDias.reduce((a, b) => a + b, 0) / allCierreDias.length).toFixed(1)) : 0;
        const totalRow = ["TOTAL / PROMEDIO GENERAL"];
        categorias.forEach(c => { totalRow.push(catCountsGlobal[c] || 0); });
        totalRow.push(records.length);
        totalRow.push(avgTotD > 0 ? avgTotD : "-");
        totalRow.push(avgTotC > 0 ? avgTotC : "-");
        rowsHoja1.push(totalRow);

        const ws1 = XLSX.utils.aoa_to_sheet(rowsHoja1);

        // 2. Datos para Hoja 2: Detalle de Casos
        const rowsHoja2 = [];
        rowsHoja2.push([
            "Unidad", "No. OT", "Marca", "No. Orden Marca", "Fecha Ingreso",
            "Cliente", "Descripción del Producto", "Modelo", "Serie",
            "Categoría", "Tipo de Garantía", "Fecha Diagnóstico", "Días Diagnóstico",
            "Fecha Cierre", "Días Cierre", "Estatus"
        ]);

        records.forEach(r => {
            rowsHoja2.push([
                r.unidad || "",
                r.ot || "",
                r.marca || "",
                r.no_caso_marca || "",
                r.fecha || "",
                r.cliente || "",
                r.descripcion || "",
                r.modelo || "",
                r.serie || "",
                r.categoria || "",
                r.tipo_garantia || "",
                r.fecha_diagnostico || "",
                r.dias_diagnostico !== null && r.dias_diagnostico !== undefined ? r.dias_diagnostico : "",
                r.fecha_cierre || "",
                r.dias_cierre !== null && r.dias_cierre !== undefined ? r.dias_cierre : "",
                r.estatus || ""
            ]);
        });

        const ws2 = XLSX.utils.aoa_to_sheet(rowsHoja2);

        // Aplicar estilos si xlsx-js-style está disponible
        try {
            // Estilos Hoja 1
            const styleHeader = {
                font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10, name: "Calibri" },
                fill: { fgColor: { rgb: "1E3A8A" } },
                alignment: { horizontal: "center", vertical: "center", wrapText: true }
            };
            const styleTotal = {
                font: { bold: true, color: { rgb: "0F172A" }, sz: 10, name: "Calibri" },
                fill: { fgColor: { rgb: "E2E8F0" } },
                alignment: { horizontal: "center", vertical: "center" }
            };

            const range1 = XLSX.utils.decode_range(ws1['!ref']);
            for (let C = range1.s.c; C <= range1.e.c; ++C) {
                const cellRefH = XLSX.utils.encode_cell({ r: 3, c: C });
                if (ws1[cellRefH]) ws1[cellRefH].s = styleHeader;

                const cellRefT = XLSX.utils.encode_cell({ r: rowsHoja1.length - 1, c: C });
                if (ws1[cellRefT]) ws1[cellRefT].s = styleTotal;
            }

            // Anchos de columna
            ws1['!cols'] = [{ wch: 22 }, ...categorias.map(() => ({ wch: 18 })), { wch: 15 }, { wch: 22 }, { wch: 22 }];
            ws2['!cols'] = [
                { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 18 },
                { wch: 30 }, { wch: 40 }, { wch: 20 }, { wch: 20 },
                { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 14 },
                { wch: 18 }, { wch: 14 }, { wch: 15 }
            ];
        } catch (e) {
            console.warn("Estilos de celda omitidos:", e);
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, "Resumen Gerencial");
        XLSX.utils.book_append_sheet(wb, ws2, "Detalle de Casos");

        const marcaName = matrizMarca === 'ALL' ? 'TodasLasMarcas' : matrizMarca.replace(/\s+/g, '_');
        const filename = `SILVA_Reporte_Gerencial_${marcaName}_${matrizDesdeAnio}_${matrizHastaAnio}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // =========================================================================
    // LÓGICA DE AUDITORÍA DETALLADA (TABLA DE OTs)
    // =========================================================================
    function deseleccionarBotonesRapidosDetalle() {
        document.querySelectorAll('#view-auditoria-detallada .btn-periodo').forEach(b => b.classList.remove('active'));
    }

    window.setRangoRapido = function(dAnio, dMes, hAnio, hMes, btnElement) {
        deseleccionarBotonesRapidosDetalle();
        if (btnElement) btnElement.classList.add('active');

        const elDMes = document.getElementById('filtro-desde-mes');
        const elDAnio = document.getElementById('filtro-desde-anio');
        const elHMes = document.getElementById('filtro-hasta-mes');
        const elHAnio = document.getElementById('filtro-hasta-anio');

        if (elDMes) elDMes.value = String(dMes);
        if (elDAnio) elDAnio.value = String(dAnio);
        if (elHMes) elHMes.value = String(hMes);
        if (elHAnio) elHAnio.value = String(hAnio);

        currentPage = 1;
        aplicarFiltrosDetalle();
    };

    window.limpiarBuscador = function() {
        const input = document.getElementById('buscador-general');
        if (input) {
            input.value = '';
            document.getElementById('btn-clear-search')?.classList.add('hidden');
            currentPage = 1;
            aplicarFiltrosDetalle();
        }
    };

    function aplicarFiltrosDetalle() {
        const fMarca = document.getElementById('filtro-marca')?.value || 'ALL';
        const fUnidad = document.getElementById('filtro-unidad')?.value || 'ALL';
        const dMes = parseInt(document.getElementById('filtro-desde-mes')?.value || 1);
        const dAnio = parseInt(document.getElementById('filtro-desde-anio')?.value || 2026);
        const hMes = parseInt(document.getElementById('filtro-hasta-mes')?.value || 8);
        const hAnio = parseInt(document.getElementById('filtro-hasta-anio')?.value || 2026);
        const query = (document.getElementById('buscador-general')?.value || '').trim().toUpperCase();

        const startVal = dAnio * 100 + dMes;
        const endVal = hAnio * 100 + hMes;

        filteredDetalleRecords = allRecords.filter(r => {
            if (fMarca !== 'ALL' && (r.marca || '').toUpperCase() !== fMarca) return false;
            if (fUnidad !== 'ALL' && (r.unidad || '').toUpperCase() !== fUnidad) return false;

            const anio = parseInt(r.anio) || 2026;
            const mesNum = parseInt(r.mesNum) || 1;
            const rVal = anio * 100 + mesNum;
            if (rVal < startVal || rVal > endVal) return false;

            if (query.length > 0) {
                const match = (r.ot && r.ot.toUpperCase().includes(query)) ||
                              (r.no_caso_marca && r.no_caso_marca.toUpperCase().includes(query)) ||
                              (r.cliente && r.cliente.toUpperCase().includes(query)) ||
                              (r.descripcion && r.descripcion.toUpperCase().includes(query)) ||
                              (r.modelo && r.modelo.toUpperCase().includes(query)) ||
                              (r.rms && r.rms.toUpperCase().includes(query)) ||
                              (r.serie && r.serie.toUpperCase().includes(query)) ||
                              (r.categoria && r.categoria.toUpperCase().includes(query));
                if (!match) return false;
            }
            return true;
        });

        // Actualizar KPIs Detalle
        actualizarKPIsDetalle(fMarca);

        // Renderizar Tabla Detalle
        renderTablaDetalle();
    }

    function actualizarKPIsDetalle(marcaSeleccionada) {
        const total = filteredDetalleRecords.length;
        let csCount = 0;
        let maeCount = 0;
        let conCasoCount = 0;

        filteredDetalleRecords.forEach(r => {
            if (r.unidad === 'CS') csCount++;
            else if (r.unidad === 'MAESTROS') maeCount++;

            if (r.no_caso_marca && r.no_caso_marca.trim() !== '') conCasoCount++;
        });

        const elTot = document.getElementById('kpi-total');
        if (elTot) elTot.textContent = total.toLocaleString();

        const elCS = document.getElementById('kpi-cs');
        const elCSPct = document.getElementById('kpi-cs-pct');
        if (elCS) elCS.textContent = csCount.toLocaleString();
        if (elCSPct) elCSPct.textContent = total > 0 ? `${((csCount / total) * 100).toFixed(1)}% del total` : '0% del total';

        const elMae = document.getElementById('kpi-maestros');
        const elMaePct = document.getElementById('kpi-maestros-pct');
        if (elMae) elMae.textContent = maeCount.toLocaleString();
        if (elMaePct) elMaePct.textContent = total > 0 ? `${((maeCount / total) * 100).toFixed(1)}% del total` : '0% del total';

        const elCaso = document.getElementById('kpi-con-caso');
        const elCasoPct = document.getElementById('kpi-con-caso-pct');
        const elCasoTitle = document.getElementById('kpi-con-caso-title');

        if (elCaso) elCaso.textContent = conCasoCount.toLocaleString();
        if (elCasoPct) {
            if (marcaSeleccionada === 'HISENSE' || marcaSeleccionada === 'LG') {
                elCasoPct.textContent = total > 0 ? `${((conCasoCount / total) * 100).toFixed(1)}% trámite en portal` : '0% trámite en portal';
                if (elCasoTitle) elCasoTitle.textContent = 'Con No. Orden Marca';
            } else {
                elCasoPct.textContent = `${total.toLocaleString()} órdenes con No. OT SILVA`;
                if (elCasoTitle) elCasoTitle.textContent = 'Control OT Interna';
            }
        }
    }

    function renderTablaDetalle() {
        const tbody = document.getElementById('tabla-cuerpo');
        if (!tbody) return;

        const total = filteredDetalleRecords.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const startIdx = (currentPage - 1) * pageSize;
        const endIdx = Math.min(startIdx + pageSize, total);
        const pageItems = filteredDetalleRecords.slice(startIdx, endIdx);

        // Indicadores paginador
        const elShowingStart = document.getElementById('table-showing-start');
        const elShowingEnd = document.getElementById('table-showing-end');
        const elShowingTotal = document.getElementById('table-showing-total');
        const elPagInfo = document.getElementById('paginador-info');
        const btnPrev = document.getElementById('btn-pag-prev');
        const btnNext = document.getElementById('btn-pag-next');

        if (elShowingStart) elShowingStart.textContent = total > 0 ? (startIdx + 1).toLocaleString() : '0';
        if (elShowingEnd) elShowingEnd.textContent = endIdx.toLocaleString();
        if (elShowingTotal) elShowingTotal.textContent = total.toLocaleString();
        if (elPagInfo) elPagInfo.textContent = `Página ${currentPage.toLocaleString()} de ${totalPages.toLocaleString()}`;

        if (btnPrev) btnPrev.disabled = (currentPage <= 1);
        if (btnNext) btnNext.disabled = (currentPage >= totalPages);

        if (pageItems.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-12 text-slate-400 dark:text-slate-500 font-medium">No se encontraron casos de garantía con los filtros seleccionados.</td></tr>`;
            return;
        }

        let html = '';
        pageItems.forEach(r => {
            const badgeUnidad = r.unidad === 'CS' ? '<span class="badge badge-cs">CS</span>' : '<span class="badge badge-maestros">MAESTROS</span>';
            
            let noCasoBadge = '';
            if (r.no_caso_marca) {
                noCasoBadge = `<div class="flex items-center gap-1.5">
                    <span class="badge badge-has-case font-mono font-bold">${r.no_caso_marca}</span>
                    <button onclick="copiarAlPortapapeles('${r.no_caso_marca}', 'No. Caso')" class="copy-btn text-slate-400" title="Copiar No. de Caso">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                </div>`;
            } else if (r.marca === 'HISENSE' || r.marca === 'LG') {
                noCasoBadge = '<span class="badge badge-no-case">Pendiente Portal</span>';
            } else {
                noCasoBadge = '<span class="badge badge-na-case text-[10px]">No aplica portal</span>';
            }

            const diagTag = (r.dias_diagnostico !== null && r.dias_diagnostico !== undefined) ? `<span class="text-emerald-600 dark:text-emerald-400 font-bold">${r.dias_diagnostico} d</span>` : '<span class="text-slate-400">-</span>';
            const cierreTag = (r.dias_cierre !== null && r.dias_cierre !== undefined) ? `<span class="text-purple-600 dark:text-purple-400 font-bold">${r.dias_cierre} d</span>` : '<span class="text-slate-400">-</span>';

            html += `<tr class="table-row-item text-xs">
                <td>${badgeUnidad}</td>
                <td>
                    <div class="flex items-center gap-1.5">
                        ${r.link ? `<a href="${r.link}" target="_blank" class="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">${r.ot}<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></a>` : `<span class="font-bold text-slate-800 dark:text-slate-200">${r.ot}</span>`}
                        <button onclick="copiarAlPortapapeles('${r.ot}', 'No. OT')" class="copy-btn text-slate-400" title="Copiar No. OT">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                    </div>
                </td>
                <td>${noCasoBadge}</td>
                <td class="text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">${r.fecha || '--'}</td>
                <td class="font-medium text-slate-900 dark:text-slate-100">${r.cliente || '--'}</td>
                <td class="text-slate-700 dark:text-slate-300 max-w-xs truncate" title="${r.descripcion || ''}">${r.descripcion || '--'}</td>
                <td><span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">${r.categoria || 'General'}</span></td>
                <td>${r.serie ? `<span class="serie-chip">${r.serie}</span>` : '<span class="text-slate-400 text-xs italic">S/N</span>'}</td>
                <td class="text-right">${diagTag}</td>
                <td class="text-right">${cierreTag}</td>
            </tr>`;
        });

        tbody.innerHTML = html;
    }

    window.cambiarPagina = function(delta) {
        currentPage += delta;
        renderTablaDetalle();
    };

    window.cambiarTamanoPagina = function(tam) {
        pageSize = parseInt(tam) || 25;
        currentPage = 1;
        renderTablaDetalle();
    };

    window.copiarAlPortapapeles = function(texto, label) {
        if (!texto) return;
        navigator.clipboard.writeText(texto).then(() => {
            const toast = document.getElementById('toast-copy');
            const msg = document.getElementById('toast-msg');
            if (toast && msg) {
                msg.textContent = `${label} "${texto}" copiado`;
                toast.style.display = 'flex';
                setTimeout(() => { toast.style.display = 'none'; }, 2000);
            }
        }).catch(err => {
            console.error('Error al copiar:', err);
        });
    };

    window.exportarExcel = function() {
        if (typeof XLSX === 'undefined') {
            alert('La librería SheetJS aún se está cargando. Por favor intente en unos segundos.');
            return;
        }

        const fMarca = document.getElementById('filtro-marca')?.value || 'ALL';
        const rows = [];
        rows.push([
            "Unidad", "No. OT", "No. Orden Marca", "Fecha Ingreso", "Cliente",
            "Descripción del Producto", "Modelo / RMS", "Serie del Equipo",
            "Categoría", "Tipo de Garantía", "Fecha Diagnóstico", "Días Diagnóstico",
            "Fecha Cierre", "Días Cierre", "Estatus"
        ]);

        filteredDetalleRecords.forEach(r => {
            rows.push([
                r.unidad || "",
                r.ot || "",
                r.no_caso_marca || "",
                r.fecha || "",
                r.cliente || "",
                r.descripcion || "",
                r.modelo || "",
                r.serie || "",
                r.categoria || "",
                r.tipo_garantia || "",
                r.fecha_diagnostico || "",
                r.dias_diagnostico !== null && r.dias_diagnostico !== undefined ? r.dias_diagnostico : "",
                r.fecha_cierre || "",
                r.dias_cierre !== null && r.dias_cierre !== undefined ? r.dias_cierre : "",
                r.estatus || ""
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [
            { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 30 },
            { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 20 },
            { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 15 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Auditoria_Garantias");

        const marcaName = fMarca === 'ALL' ? 'TodasLasMarcas' : fMarca.replace(/\s+/g, '_');
        const filename = `SILVA_Auditoria_Garantias_${marcaName}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // Inicializar al cargar DOM
    document.addEventListener('DOMContentLoaded', init);
})();
