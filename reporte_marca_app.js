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
            const currentVal = selMatriz.value || matrizMarca || 'ALL';
            selMatriz.innerHTML = `<option value="ALL">Todas las Marcas (General - ${marcasOrdenadas.length} marcas)</option>`;
            marcasOrdenadas.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                if (m === currentVal) opt.selected = true;
                selMatriz.appendChild(opt);
            });
        }

        // 2. Selector Detalle
        const selDetalle = document.getElementById('filtro-marca');
        if (selDetalle) {
            const currentVal = selDetalle.value || 'HISENSE';
            selDetalle.innerHTML = `<option value="ALL">Todas las Marcas (${marcasOrdenadas.length} marcas)</option>`;
            marcasOrdenadas.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                opt.textContent = m;
                if (m === currentVal) opt.selected = true;
                selDetalle.appendChild(opt);
            });
        }

        const labelMatriz = document.getElementById('matriz-marca-count');
        if (labelMatriz) labelMatriz.textContent = `${marcasOrdenadas.length} marcas`;

        const labelDetalle = document.getElementById('marca-count-label');
        if (labelDetalle) labelDetalle.textContent = `${marcasOrdenadas.length} marcas registradas`;
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
            } else {
                catKey = r.tipo_garantia || 'SIN ESPECIFICAR';
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
            else catKey = r.tipo_garantia || 'SIN ESPECIFICAR';

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
    // ESTILOS Y HELPERS EJECUTIVOS PARA EXCEL (XLSX-JS-STYLE)
    // =========================================================================
    const EXCEL_STYLES = {
        borderThin: {
            top: { style: "thin", color: { rgb: "CBD5E1" } },
            bottom: { style: "thin", color: { rgb: "CBD5E1" } },
            left: { style: "thin", color: { rgb: "CBD5E1" } },
            right: { style: "thin", color: { rgb: "CBD5E1" } }
        },
        borderData: {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } }
        },
        borderTotal: {
            top: { style: "thin", color: { rgb: "475569" } },
            bottom: { style: "double", color: { rgb: "0F2942" } },
            left: { style: "thin", color: { rgb: "CBD5E1" } },
            right: { style: "thin", color: { rgb: "CBD5E1" } }
        }
    };

    function applyBannerStyles(ws, totalCols, companyTitle, reportTitle, metaText) {
        // Row 0: Company Banner
        const cellA1 = ws['A1'];
        if (cellA1) {
            cellA1.v = companyTitle;
            cellA1.s = {
                font: { name: "Calibri", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "0F2942" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }
        for (let c = 1; c < totalCols; c++) {
            const ref = XLSX.utils.encode_cell({ r: 0, c });
            if (!ws[ref]) ws[ref] = { t: "s", v: "" };
            ws[ref].s = { fill: { fgColor: { rgb: "0F2942" } } };
        }

        // Row 1: Report Subtitle
        const cellA2 = ws['A2'];
        if (cellA2) {
            cellA2.v = reportTitle;
            cellA2.s = {
                font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "1E3A8A" } },
                fill: { fgColor: { rgb: "F1F5F9" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }
        for (let c = 1; c < totalCols; c++) {
            const ref = XLSX.utils.encode_cell({ r: 1, c });
            if (!ws[ref]) ws[ref] = { t: "s", v: "" };
            ws[ref].s = { fill: { fgColor: { rgb: "F1F5F9" } } };
        }

        // Row 2: Metadata badge
        const cellA3 = ws['A3'];
        if (cellA3) {
            cellA3.v = metaText;
            cellA3.s = {
                font: { name: "Calibri", sz: 9.5, italic: true, color: { rgb: "475569" } },
                fill: { fgColor: { rgb: "F1F5F9" } },
                alignment: { horizontal: "center", vertical: "center" }
            };
        }
        for (let c = 1; c < totalCols; c++) {
            const ref = XLSX.utils.encode_cell({ r: 2, c });
            if (!ws[ref]) ws[ref] = { t: "s", v: "" };
            ws[ref].s = { fill: { fgColor: { rgb: "F1F5F9" } } };
        }

        ws['!merges'] = ws['!merges'] || [];
        ws['!merges'].push(
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
            { s: { r: 2, c: 0 }, e: { r: 2, c: totalCols - 1 } }
        );
    }

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
            else catKey = r.tipo_garantia || 'SIN ESPECIFICAR';
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
            else catKey = r.tipo_garantia || 'SIN ESPECIFICAR';

            mesesData[key].total++;
            mesesData[key].categorias[catKey] = (mesesData[key].categorias[catKey] || 0) + 1;

            if (r.dias_diagnostico !== null && r.dias_diagnostico !== undefined && !isNaN(r.dias_diagnostico)) {
                mesesData[key].diagDias.push(parseFloat(r.dias_diagnostico));
                allDiagDias.push(parseFloat(r.dias_diagnostico));
            }
            if (r.dias_cierre !== null && r.dias_cierre !== undefined && !isNaN(r.dias_cierre)) {
                mesesData[key].cierreDias.push(parseFloat(r.dias_cierre));
                allCierreDias.push(parseFloat(r.dias_cierre));
            }
        });

        // Construir filas para Hoja 1
        const rowsHoja1 = [
            ["SILVA INTERNACIONAL S.A."],
            ["INFORME GERENCIAL DE CASOS DE GARANTÍA Y TIEMPOS DE RESPUESTA"],
            [`Período: ${MESES_NOMBRES[matrizDesdeMes]} ${matrizDesdeAnio} a ${MESES_NOMBRES[matrizHastaMes]} ${matrizHastaAnio}   |   Filtro Marca: ${matrizMarca === 'ALL' ? 'Todas las Marcas (Consolidado)' : matrizMarca}   |   Total Casos: ${records.length.toLocaleString()}`],
            [] // Espaciado
        ];

        const headersH1 = ["Mes / Período", ...categorias, "Total Casos", "Tiempo Diag. Prom (Días)", "Tiempo Cierre Prom (Días)"];
        rowsHoja1.push(headersH1);

        mesesEnRango.forEach(m => {
            const d = mesesData[m.key];
            const avgD = d.diagDias.length > 0 ? parseFloat((d.diagDias.reduce((a, b) => a + b, 0) / d.diagDias.length).toFixed(1)) : null;
            const avgC = d.cierreDias.length > 0 ? parseFloat((d.cierreDias.reduce((a, b) => a + b, 0) / d.cierreDias.length).toFixed(1)) : null;

            const row = [m.label];
            categorias.forEach(c => { row.push(d.categorias[c] || 0); });
            row.push(d.total);
            row.push(avgD !== null ? avgD : "-");
            row.push(avgC !== null ? avgC : "-");
            rowsHoja1.push(row);
        });

        // Fila Totales
        const avgTotD = allDiagDias.length > 0 ? parseFloat((allDiagDias.reduce((a, b) => a + b, 0) / allDiagDias.length).toFixed(1)) : null;
        const avgTotC = allCierreDias.length > 0 ? parseFloat((allCierreDias.reduce((a, b) => a + b, 0) / allCierreDias.length).toFixed(1)) : null;
        const totalRow = ["TOTAL / PROMEDIO GENERAL"];
        categorias.forEach(c => { totalRow.push(catCountsGlobal[c] || 0); });
        totalRow.push(records.length);
        totalRow.push(avgTotD !== null ? avgTotD : "-");
        totalRow.push(avgTotC !== null ? avgTotC : "-");
        rowsHoja1.push(totalRow);

        const ws1 = XLSX.utils.aoa_to_sheet(rowsHoja1);

        // Estilar Hoja 1
        try {
            applyBannerStyles(ws1, headersH1.length, "SILVA INTERNACIONAL S.A.", "INFORME GERENCIAL DE CASOS DE GARANTÍA Y TIEMPOS DE RESPUESTA", rowsHoja1[2][0]);

            // Header row (Index 4)
            for (let c = 0; c < headersH1.length; c++) {
                const ref = XLSX.utils.encode_cell({ r: 4, c });
                if (ws1[ref]) {
                    let bg = "1E3A8A";
                    if (c === headersH1.length - 3) bg = "0F2942";
                    else if (c === headersH1.length - 2) bg = "065F46";
                    else if (c === headersH1.length - 1) bg = "5B21B6";

                    ws1[ref].s = {
                        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
                        fill: { fgColor: { rgb: bg } },
                        alignment: { horizontal: "center", vertical: "center", wrapText: true },
                        border: EXCEL_STYLES.borderThin
                    };
                }
            }

            // Data rows (Index 5 to rowsHoja1.length - 2)
            const rowHeights = [{ hpt: 26 }, { hpt: 20 }, { hpt: 18 }, { hpt: 8 }, { hpt: 28 }];
            for (let r = 5; r < rowsHoja1.length - 1; r++) {
                rowHeights.push({ hpt: 20 });
                const isOdd = (r % 2 === 1);
                const bgRow = isOdd ? "F8FAFC" : "FFFFFF";

                for (let c = 0; c < headersH1.length; c++) {
                    const ref = XLSX.utils.encode_cell({ r, c });
                    if (ws1[ref]) {
                        const isMes = (c === 0);
                        const isTot = (c === headersH1.length - 3);
                        const isDiag = (c === headersH1.length - 2);
                        const isCierre = (c === headersH1.length - 1);

                        let align = isMes ? "left" : "right";
                        let fontColor = "0F172A";
                        let fontBold = isMes || isTot;
                        let cellBg = bgRow;

                        if (isTot) { cellBg = isOdd ? "EFF6FF" : "F0F7FF"; fontColor = "1E3A8A"; }
                        else if (isDiag) { cellBg = isOdd ? "ECFDF5" : "F0FDF4"; fontColor = "047857"; fontBold = true; }
                        else if (isCierre) { cellBg = isOdd ? "F5F3FF" : "FAF5FF"; fontColor = "7C3AED"; fontBold = true; }

                        if (ws1[ref].v === "-") align = "center";

                        ws1[ref].s = {
                            font: { name: "Calibri", sz: 10, bold: fontBold, color: { rgb: fontColor } },
                            fill: { fgColor: { rgb: cellBg } },
                            alignment: { horizontal: align, vertical: "center" },
                            border: EXCEL_STYLES.borderData
                        };
                        if (typeof ws1[ref].v === 'number') {
                            ws1[ref].z = (isDiag || isCierre) ? "0.0" : "#,##0";
                        }
                    }
                }
            }

            // Total row (Index rowsHoja1.length - 1)
            const lastR = rowsHoja1.length - 1;
            rowHeights.push({ hpt: 24 });
            for (let c = 0; c < headersH1.length; c++) {
                const ref = XLSX.utils.encode_cell({ r: lastR, c });
                if (ws1[ref]) {
                    const isDiag = (c === headersH1.length - 2);
                    const isCierre = (c === headersH1.length - 1);
                    const isTot = (c === headersH1.length - 3);

                    let fontColor = "0F2942";
                    if (isTot) fontColor = "1E3A8A";
                    else if (isDiag) fontColor = "047857";
                    else if (isCierre) fontColor = "7C3AED";

                    ws1[ref].s = {
                        font: { name: "Calibri", sz: 10.5, bold: true, color: { rgb: fontColor } },
                        fill: { fgColor: { rgb: "E2E8F0" } },
                        alignment: { horizontal: c === 0 ? "left" : "right", vertical: "center" },
                        border: EXCEL_STYLES.borderTotal
                    };
                    if (typeof ws1[ref].v === 'number') {
                        ws1[ref].z = (isDiag || isCierre) ? "0.0" : "#,##0";
                    }
                }
            }

            ws1['!rows'] = rowHeights;
            ws1['!cols'] = [
                { wch: 22 },
                ...categorias.map(() => ({ wch: 20 })),
                { wch: 16 },
                { wch: 24 },
                { wch: 24 }
            ];
        } catch (e) {
            console.warn("Estilos de Hoja 1 omitidos:", e);
        }

        // 2. Datos para Hoja 2: Detalle de Casos (14 Columnas exactas - SIN Estatus)
        const rowsHoja2 = [
            ["SILVA INTERNACIONAL S.A."],
            ["AUDITORÍA DETALLADA DE CASOS DE GARANTÍA POR MARCA"],
            [`Período: ${MESES_NOMBRES[matrizDesdeMes]} ${matrizDesdeAnio} a ${MESES_NOMBRES[matrizHastaMes]} ${matrizHastaAnio}   |   Marca: ${matrizMarca === 'ALL' ? 'Todas las Marcas' : matrizMarca}   |   Total Casos: ${records.length.toLocaleString()}   |   Criterio: Casos de Garantía (Excluye Servicios)`],
            [] // Espaciado
        ];

        const headersH2 = [
            "No. OT", "Marca", "No. Orden Marca", "Fecha Ingreso",
            "Cliente", "Descripción del Producto", "Modelo", "Serie del Equipo",
            "Categoría", "Tipo de Garantía", "Fecha Diagnóstico", "Días Diagnóstico",
            "Fecha Cierre", "Días Cierre"
        ];
        rowsHoja2.push(headersH2);

        records.forEach(r => {
            rowsHoja2.push([
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
                r.dias_diagnostico !== null && r.dias_diagnostico !== undefined && !isNaN(r.dias_diagnostico) ? parseFloat(r.dias_diagnostico) : "-",
                r.fecha_cierre || "",
                r.dias_cierre !== null && r.dias_cierre !== undefined && !isNaN(r.dias_cierre) ? parseFloat(r.dias_cierre) : "-"
            ]);
        });

        const ws2 = XLSX.utils.aoa_to_sheet(rowsHoja2);

        // Estilar Hoja 2
        try {
            applyBannerStyles(ws2, headersH2.length, "SILVA INTERNACIONAL S.A.", "AUDITORÍA DETALLADA DE CASOS DE GARANTÍA POR MARCA", rowsHoja2[2][0]);

            // Header row (Index 4)
            for (let c = 0; c < headersH2.length; c++) {
                const ref = XLSX.utils.encode_cell({ r: 4, c });
                if (ws2[ref]) {
                    ws2[ref].s = {
                        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
                        fill: { fgColor: { rgb: "0F2942" } },
                        alignment: { horizontal: "center", vertical: "center", wrapText: true },
                        border: EXCEL_STYLES.borderThin
                    };
                }
            }

            // Data rows (Index 5 to rowsHoja2.length - 1)
            const rowHeights2 = [{ hpt: 26 }, { hpt: 20 }, { hpt: 18 }, { hpt: 8 }, { hpt: 26 }];
            for (let r = 5; r < rowsHoja2.length; r++) {
                rowHeights2.push({ hpt: 20 });
                const isOdd = (r % 2 === 1);
                const bgRow = isOdd ? "F8FAFC" : "FFFFFF";

                for (let c = 0; c < headersH2.length; c++) {
                    const ref = XLSX.utils.encode_cell({ r, c });
                    if (ws2[ref]) {
                        let align = "center";
                        let fontBold = false;
                        let fontColor = "0F172A";
                        let cellBg = bgRow;

                        if (c === 0) { fontBold = true; fontColor = "0F172A"; }
                        else if (c === 1) { fontBold = true; fontColor = "1E3A8A"; }
                        else if (c === 2) { fontColor = "334155"; }
                        else if (c === 4 || c === 5) { align = "left"; }
                        else if (c === 6) { fontBold = true; fontColor = "0F172A"; }
                        else if (c === 11) {
                            align = ws2[ref].v === "-" ? "center" : "right";
                            fontBold = (ws2[ref].v !== "-");
                            fontColor = "047857";
                            cellBg = isOdd ? "ECFDF5" : "F0FDF4";
                        }
                        else if (c === 13) {
                            align = ws2[ref].v === "-" ? "center" : "right";
                            fontBold = (ws2[ref].v !== "-");
                            fontColor = "7C3AED";
                            cellBg = isOdd ? "F5F3FF" : "FAF5FF";
                        }

                        ws2[ref].s = {
                            font: { name: "Calibri", sz: 10, bold: fontBold, color: { rgb: fontColor } },
                            fill: { fgColor: { rgb: cellBg } },
                            alignment: { horizontal: align, vertical: "center", wrapText: (c === 5) },
                            border: EXCEL_STYLES.borderData
                        };
                        if (typeof ws2[ref].v === 'number') {
                            ws2[ref].z = (c === 11 || c === 13) ? "0.0" : "#,##0";
                        }
                    }
                }
            }

            ws2['!rows'] = rowHeights2;
            ws2['!cols'] = [
                { wch: 12 }, // No. OT
                { wch: 16 }, // Marca
                { wch: 22 }, // No. Orden Marca
                { wch: 18 }, // Fecha Ingreso
                { wch: 32 }, // Cliente
                { wch: 44 }, // Descripcion
                { wch: 24 }, // Modelo (Col G)
                { wch: 20 }, // Serie
                { wch: 24 }, // Categoria
                { wch: 22 }, // Tipo Garantia
                { wch: 18 }, // Fecha Diag
                { wch: 16 }, // Dias Diag
                { wch: 18 }, // Fecha Cierre
                { wch: 16 }  // Dias Cierre
            ];

            ws2['!autofilter'] = { ref: `A5:N${rowsHoja2.length}` };
        } catch (e) {
            console.warn("Estilos de Hoja 2 omitidos:", e);
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, "Resumen Gerencial");
        XLSX.utils.book_append_sheet(wb, ws2, "Detalle de Casos");

        const marcaName = matrizMarca === 'ALL' ? 'TodasLasMarcas' : matrizMarca.replace(/\s+/g, '_');
        const filename = `SILVA_Reporte_Gerencial_${marcaName}_${matrizDesdeAnio}_${matrizHastaAnio}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    // =========================================================================
    // EXPORTACIÓN A EXCEL DIRECTA DESDE PESTAÑA AUDITORÍA DETALLADA
    // =========================================================================
    window.exportarExcel = function() {
        if (typeof XLSX === 'undefined') {
            alert('La librería SheetJS aún se está cargando. Por favor intente en unos segundos.');
            return;
        }

        const fMarca = document.getElementById('filtro-marca')?.value || 'ALL';
        const dMes = parseInt(document.getElementById('filtro-desde-mes')?.value || 1);
        const dAnio = parseInt(document.getElementById('filtro-desde-anio')?.value || 2026);
        const hMes = parseInt(document.getElementById('filtro-hasta-mes')?.value || 8);
        const hAnio = parseInt(document.getElementById('filtro-hasta-anio')?.value || 2026);

        const rows = [
            ["SILVA INTERNACIONAL S.A."],
            ["AUDITORÍA DETALLADA DE CASOS DE GARANTÍA POR MARCA"],
            [`Período: ${MESES_NOMBRES[dMes]} ${dAnio} a ${MESES_NOMBRES[hMes]} ${hAnio}   |   Marca: ${fMarca === 'ALL' ? 'Todas las Marcas' : fMarca}   |   Total Casos: ${filteredDetalleRecords.length.toLocaleString()}   |   Criterio: Casos de Garantía (Excluye Servicios)`],
            [] // Espaciado
        ];

        const headers = [
            "No. OT", "Marca", "No. Orden Marca", "Fecha Ingreso",
            "Cliente", "Descripción del Producto", "Modelo", "Serie del Equipo",
            "Categoría", "Tipo de Garantía", "Fecha Diagnóstico", "Días Diagnóstico",
            "Fecha Cierre", "Días Cierre"
        ];
        rows.push(headers);

        filteredDetalleRecords.forEach(r => {
            rows.push([
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
                r.dias_diagnostico !== null && r.dias_diagnostico !== undefined && !isNaN(r.dias_diagnostico) ? parseFloat(r.dias_diagnostico) : "-",
                r.fecha_cierre || "",
                r.dias_cierre !== null && r.dias_cierre !== undefined && !isNaN(r.dias_cierre) ? parseFloat(r.dias_cierre) : "-"
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(rows);

        try {
            applyBannerStyles(ws, headers.length, "SILVA INTERNACIONAL S.A.", "AUDITORÍA DETALLADA DE CASOS DE GARANTÍA POR MARCA", rows[2][0]);

            // Header row (Index 4)
            for (let c = 0; c < headers.length; c++) {
                const ref = XLSX.utils.encode_cell({ r: 4, c });
                if (ws[ref]) {
                    ws[ref].s = {
                        font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
                        fill: { fgColor: { rgb: "0F2942" } },
                        alignment: { horizontal: "center", vertical: "center", wrapText: true },
                        border: EXCEL_STYLES.borderThin
                    };
                }
            }

            // Data rows (Index 5 to rows.length - 1)
            const rowHeights = [{ hpt: 26 }, { hpt: 20 }, { hpt: 18 }, { hpt: 8 }, { hpt: 26 }];
            for (let r = 5; r < rows.length; r++) {
                rowHeights.push({ hpt: 20 });
                const isOdd = (r % 2 === 1);
                const bgRow = isOdd ? "F8FAFC" : "FFFFFF";

                for (let c = 0; c < headers.length; c++) {
                    const ref = XLSX.utils.encode_cell({ r, c });
                    if (ws[ref]) {
                        let align = "center";
                        let fontBold = false;
                        let fontColor = "0F172A";
                        let cellBg = bgRow;

                        if (c === 0) { fontBold = true; fontColor = "0F172A"; }
                        else if (c === 1) { fontBold = true; fontColor = "1E3A8A"; }
                        else if (c === 2) { fontColor = "334155"; }
                        else if (c === 4 || c === 5) { align = "left"; }
                        else if (c === 6) { fontBold = true; fontColor = "0F172A"; }
                        else if (c === 11) {
                            align = ws[ref].v === "-" ? "center" : "right";
                            fontBold = (ws[ref].v !== "-");
                            fontColor = "047857";
                            cellBg = isOdd ? "ECFDF5" : "F0FDF4";
                        }
                        else if (c === 13) {
                            align = ws[ref].v === "-" ? "center" : "right";
                            fontBold = (ws[ref].v !== "-");
                            fontColor = "7C3AED";
                            cellBg = isOdd ? "F5F3FF" : "FAF5FF";
                        }

                        ws[ref].s = {
                            font: { name: "Calibri", sz: 10, bold: fontBold, color: { rgb: fontColor } },
                            fill: { fgColor: { rgb: cellBg } },
                            alignment: { horizontal: align, vertical: "center", wrapText: (c === 5) },
                            border: EXCEL_STYLES.borderData
                        };
                        if (typeof ws[ref].v === 'number') {
                            ws[ref].z = (c === 11 || c === 13) ? "0.0" : "#,##0";
                        }
                    }
                }
            }

            ws['!rows'] = rowHeights;
            ws['!cols'] = [
                { wch: 12 }, // No. OT
                { wch: 16 }, // Marca
                { wch: 22 }, // No. Orden Marca
                { wch: 18 }, // Fecha Ingreso
                { wch: 32 }, // Cliente
                { wch: 44 }, // Descripcion
                { wch: 24 }, // Modelo (Col G)
                { wch: 20 }, // Serie
                { wch: 24 }, // Categoria
                { wch: 22 }, // Tipo Garantia
                { wch: 18 }, // Fecha Diag
                { wch: 16 }, // Dias Diag
                { wch: 18 }, // Fecha Cierre
                { wch: 16 }  // Dias Cierre
            ];

            ws['!autofilter'] = { ref: `A5:N${rows.length}` };
        } catch (e) {
            console.warn("Estilos de exportación omitidos:", e);
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Auditoria_Garantias");

        const marcaName = fMarca === 'ALL' ? 'TodasLasMarcas' : fMarca.replace(/\s+/g, '_');
        const filename = `SILVA_Auditoria_Garantias_${marcaName}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    function startApp() {
        if (window.REPORTES_DATA && window.REPORTES_DATA.length > 0) {
            init();
        } else {
            console.log("Esperando REPORTES_DATA...");
            let attempts = 0;
            const timer = setInterval(() => {
                attempts++;
                if (window.REPORTES_DATA && window.REPORTES_DATA.length > 0) {
                    clearInterval(timer);
                    init();
                } else if (attempts > 50) {
                    clearInterval(timer);
                    console.warn("Timeout esperando REPORTES_DATA");
                    init();
                }
            }, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startApp);
    } else {
        startApp();
    }
})();
