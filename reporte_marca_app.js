// reporte_marca_app.js -- Lógica para el Reporte de Garantías por Marca

(function() {
    let allRecords = [];
    let filteredRecords = [];
    let currentPage = 1;
    let pageSize = 25;

    const MESES_NOMBRES = {
        1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO', 4: 'ABRIL',
        5: 'MAYO', 6: 'JUNIO', 7: 'JULIO', 8: 'AGOSTO',
        9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE'
    };

    function init() {
        if (!window.REPORTES_DATA) {
            console.warn("window.REPORTES_DATA no disponible aún. Esperando...");
            setTimeout(init, 150);
            return;
        }

        allRecords = window.REPORTES_DATA || [];
        console.log(`Cargados ${allRecords.length} registros en Reportes de Marcas.`);

        // Actualizar total en header
        const headerTotal = document.getElementById('header-total-registros');
        if (headerTotal) {
            headerTotal.textContent = allRecords.length.toLocaleString();
        }

        // Poblar Marcas
        poblarSelectorMarcas();

        // Listeners de eventos
        document.getElementById('filtro-marca').addEventListener('change', () => { currentPage = 1; aplicarFiltros(); });
        document.getElementById('filtro-unidad').addEventListener('change', () => { currentPage = 1; aplicarFiltros(); });
        document.getElementById('filtro-desde-mes').addEventListener('change', () => { currentPage = 1; aplicarFiltros(); });
        document.getElementById('filtro-desde-anio').addEventListener('change', () => { currentPage = 1; aplicarFiltros(); });
        document.getElementById('filtro-hasta-mes').addEventListener('change', () => { currentPage = 1; aplicarFiltros(); });
        document.getElementById('filtro-hasta-anio').addEventListener('change', () => { currentPage = 1; aplicarFiltros(); });
        
        const buscador = document.getElementById('buscador-general');
        buscador.addEventListener('input', () => {
            currentPage = 1;
            aplicarFiltros();
        });

        // Aplicar filtros iniciales
        aplicarFiltros();
    }

    function poblarSelectorMarcas() {
        const select = document.getElementById('filtro-marca');
        if (!select) return;

        // Extraer marcas únicas
        const marcasSet = new Set();
        allRecords.forEach(r => {
            if (r.marca && r.marca !== 'DESCONOCIDA') {
                marcasSet.add(r.marca.trim().toUpperCase());
            }
        });

        const marcasOrdenadas = Array.from(marcasSet).sort();

        // Limpiar opciones preservando "Todas las Marcas"
        select.innerHTML = '<option value="ALL">Todas las Marcas (' + marcasOrdenadas.length + ' disponibles)</option>';

        let hasHisense = false;
        marcasOrdenadas.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            if (m === 'HISENSE') {
                hasHisense = true;
                opt.selected = true; // Seleccionar HISENSE por defecto
            }
            select.appendChild(opt);
        });

        // Etiqueta informativa
        const label = document.getElementById('marca-count-label');
        if (label) {
            label.textContent = `${marcasOrdenadas.length} marcas registradas`;
        }
    }

    window.setRangoRapido = function(dAnio, dMes, hAnio, hMes) {
        document.getElementById('filtro-desde-anio').value = dAnio;
        document.getElementById('filtro-desde-mes').value = dMes;
        document.getElementById('filtro-hasta-anio').value = hAnio;
        document.getElementById('filtro-hasta-mes').value = hMes;
        currentPage = 1;
        aplicarFiltros();
    };

    window.cambiarTamanoPagina = function(tamano) {
        pageSize = parseInt(tamano, 10);
        currentPage = 1;
        renderTabla();
    };

    window.cambiarPagina = function(delta) {
        const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
        const nuevaPagina = currentPage + delta;
        if (nuevaPagina >= 1 && nuevaPagina <= totalPages) {
            currentPage = nuevaPagina;
            renderTabla();
        }
    };

    function aplicarFiltros() {
        const marca = document.getElementById('filtro-marca').value;
        const unidad = document.getElementById('filtro-unidad').value;
        const desdeAnio = parseInt(document.getElementById('filtro-desde-anio').value, 10);
        const desdeMes = parseInt(document.getElementById('filtro-desde-mes').value, 10);
        const hastaAnio = parseInt(document.getElementById('filtro-hasta-anio').value, 10);
        const hastaMes = parseInt(document.getElementById('filtro-hasta-mes').value, 10);
        const busqueda = (document.getElementById('buscador-general').value || '').trim().toLowerCase();

        const desdeKey = desdeAnio * 100 + desdeMes;
        const hastaKey = hastaAnio * 100 + hastaMes;

        filteredRecords = allRecords.filter(r => {
            // Filtro Período
            const anio = parseInt(r.anio, 10) || 2026;
            const mesNum = parseInt(r.mesNum, 10) || 1;
            const itemKey = anio * 100 + mesNum;
            if (itemKey < desdeKey || itemKey > hastaKey) {
                return false;
            }

            // Filtro Marca
            if (marca !== 'ALL') {
                if ((r.marca || '').toUpperCase() !== marca) {
                    return false;
                }
            }

            // Filtro Unidad
            if (unidad !== 'ALL') {
                if ((r.unidad || '').toUpperCase() !== unidad) {
                    return false;
                }
            }

            // Buscador General
            if (busqueda) {
                const targetStr = [
                    r.ot,
                    r.no_caso_marca,
                    r.cliente,
                    r.descripcion,
                    r.modelo,
                    r.rms,
                    r.serie,
                    r.tipo_garantia
                ].join(' ').toLowerCase();

                if (!targetStr.includes(busqueda)) {
                    return false;
                }
            }

            return true;
        });

        // Ordenar registros por período y fecha descendente
        filteredRecords.sort((a, b) => {
            const keyA = (a.anio || 0) * 10000 + (a.mesNum || 0) * 100 + (parseInt(a.ot, 10) || 0);
            const keyB = (b.anio || 0) * 10000 + (b.mesNum || 0) * 100 + (parseInt(b.ot, 10) || 0);
            return keyB - keyA;
        });

        actualizarKPIs(desdeMes, desdeAnio, hastaMes, hastaAnio, marca);
        renderTabla();
    }

    function actualizarKPIs(dMes, dAnio, hMes, hAnio, marca) {
        const total = filteredRecords.length;
        const csCount = filteredRecords.filter(r => r.unidad === 'CS').length;
        const maeCount = filteredRecords.filter(r => r.unidad === 'MAESTROS').length;

        document.getElementById('kpi-total').textContent = total.toLocaleString();
        document.getElementById('kpi-cs').textContent = csCount.toLocaleString();
        document.getElementById('kpi-maestros').textContent = maeCount.toLocaleString();

        const csPct = total > 0 ? Math.round((csCount / total) * 100) : 0;
        const maePct = total > 0 ? Math.round((maeCount / total) * 100) : 0;

        document.getElementById('kpi-cs-pct').textContent = `${csPct}% del total`;
        document.getElementById('kpi-maestros-pct').textContent = `${maePct}% del total`;

        const kpi4Card = document.getElementById('kpi-con-caso');
        const kpi4Title = kpi4Card.previousElementSibling;
        const isSpecificNonPortal = (marca !== 'ALL' && marca !== 'LG' && marca !== 'HISENSE');

        if (isSpecificNonPortal) {
            kpi4Title.textContent = "Control Oficial de Marca";
            kpi4Card.textContent = "No. de OT";
            document.getElementById('kpi-con-caso-pct').textContent = "No aplica portal externo (Solo LG e HISENSE)";
        } else {
            kpi4Title.textContent = "Con No. Orden Marca";
            const portalRecords = filteredRecords.filter(r => r.marca === 'LG' || r.marca === 'HISENSE');
            const conCasoCount = portalRecords.filter(r => r.no_caso_marca && r.no_caso_marca.trim().length > 0).length;
            const portalTotal = portalRecords.length;
            const conCasoPct = portalTotal > 0 ? Math.round((conCasoCount / portalTotal) * 100) : 0;
            
            kpi4Card.textContent = conCasoCount.toLocaleString();
            if (marca === 'ALL') {
                document.getElementById('kpi-con-caso-pct').textContent = `${conCasoCount} de ${portalTotal} (${conCasoPct}%) en LG / HISENSE`;
            } else {
                document.getElementById('kpi-con-caso-pct').textContent = `${conCasoCount} de ${total} (${conCasoPct}%) con código de portal`;
            }
        }

        const dMesNombre = MESES_NOMBRES[dMes] || '';
        const hMesNombre = MESES_NOMBRES[hMes] || '';
        document.getElementById('kpi-periodo-desc').textContent = `${dMesNombre} ${dAnio} a ${hMesNombre} ${hAnio}`;
    }

    function renderTabla() {
        const tbody = document.getElementById('tabla-cuerpo');
        tbody.innerHTML = '';

        const total = filteredRecords.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, total);
        const pageItems = filteredRecords.slice(startIndex, endIndex);

        // Actualizar contadores
        document.getElementById('table-showing-start').textContent = total > 0 ? (startIndex + 1).toLocaleString() : '0';
        document.getElementById('table-showing-end').textContent = endIndex.toLocaleString();
        document.getElementById('table-showing-total').textContent = total.toLocaleString();
        document.getElementById('paginador-info').textContent = `Página ${currentPage} de ${totalPages} (${total} registros)`;

        document.getElementById('btn-pag-prev').disabled = (currentPage <= 1);
        document.getElementById('btn-pag-next').disabled = (currentPage >= totalPages);

        if (pageItems.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td colspan="9" class="text-center py-12 text-slate-400">
                    <svg class="w-12 h-12 mx-auto text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p class="text-base font-semibold text-slate-300">No se encontraron casos de garantía</p>
                    <p class="text-xs text-slate-500 mt-1">Pruebe ajustando el rango de fechas, seleccionando otra marca o limpiando el buscador.</p>
                </td>
            `;
            tbody.appendChild(tr);
            return;
        }

        pageItems.forEach(r => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/40 transition-colors border-b border-slate-800';

            // Badge Unidad
            const unidadBadge = r.unidad === 'CS' 
                ? '<span class="badge badge-cs">CS</span>' 
                : '<span class="badge badge-maestros">MAESTROS</span>';

            // Link OT
            let otCell = `<span class="font-bold text-white">${r.ot}</span>`;
            if (r.link) {
                otCell = `
                    <a href="${r.link}" target="_blank" rel="noopener noreferrer" class="font-bold text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 group">
                        ${r.ot}
                        <svg class="w-3.5 h-3.5 text-blue-400 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                    </a>
                `;
            }

            // No. Orden Marca (Tratamiento diferenciado: solo LG e HISENSE tienen orden de fábrica)
            let marcaCasoCell = '';
            const isPortalBrand = (r.marca === 'LG' || r.marca === 'HISENSE');

            if (r.no_caso_marca && r.no_caso_marca.trim().length > 0) {
                marcaCasoCell = `<span class="badge badge-has-case font-mono">${r.no_caso_marca}</span>`;
            } else if (isPortalBrand) {
                marcaCasoCell = `<span class="badge badge-no-case">Pendiente Portal</span>`;
            } else {
                marcaCasoCell = `<span class="text-slate-500 text-xs italic">N/A (Solo OT)</span>`;
            }

            // Fecha
            const fechaStr = r.fecha ? r.fecha.substring(0, 16) : `${r.mes} ${r.anio}`;

            // Modelo / RMS
            let modeloStr = r.modelo || r.rms || '--';
            if (r.modelo && r.rms && r.modelo !== r.rms) {
                modeloStr = `${r.modelo} <span class="text-[10px] text-slate-400 block font-mono">RMS: ${r.rms}</span>`;
            }

            // Serie
            const serieStr = r.serie ? `<span class="font-mono text-xs text-slate-200">${r.serie}</span>` : '<span class="text-slate-600 italic">No registrada</span>';

            tr.innerHTML = `
                <td>${unidadBadge}</td>
                <td>${otCell}</td>
                <td>${marcaCasoCell}</td>
                <td class="text-xs text-slate-300 whitespace-nowrap">${fechaStr}</td>
                <td>
                    <div class="font-semibold text-slate-100 text-sm">${r.cliente || 'CLIENTE NO ESPECIFICADO'}</div>
                </td>
                <td class="text-xs text-slate-300 max-w-xs">
                    <div class="line-clamp-2" title="${r.descripcion || ''}">${r.descripcion || '--'}</div>
                </td>
                <td class="text-xs text-slate-300 font-medium">${modeloStr}</td>
                <td>${serieStr}</td>
                <td class="text-xs">
                    <span class="text-slate-300 font-medium">${r.tipo_garantia || 'GARANTIA'}</span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    window.exportarExcel = function() {
        if (!filteredRecords || filteredRecords.length === 0) {
            alert("No hay registros filtrados para exportar.");
            return;
        }

        const marca = document.getElementById('filtro-marca').value;
        const desdeAnio = document.getElementById('filtro-desde-anio').value;
        const desdeMes = MESES_NOMBRES[document.getElementById('filtro-desde-mes').value] || '';
        const hastaAnio = document.getElementById('filtro-hasta-anio').value;
        const hastaMes = MESES_NOMBRES[document.getElementById('filtro-hasta-mes').value] || '';

        // Estructura del reporte exactamente como lo solicitó el usuario
        const dataRows = filteredRecords.map((r, index) => {
            const isPortal = (r.marca === 'LG' || r.marca === 'HISENSE');
            let casoTexto = r.no_caso_marca || '';
            if (!casoTexto) {
                casoTexto = isPortal ? "Pendiente en Portal" : "N/A";
            }
            return {
                "No.": index + 1,
                "Unidad de Negocio": r.unidad,
                "No. Nuestra Orden (OT)": r.ot,
                "No. Orden Marca / Caso": casoTexto,
                "Fecha de Ingreso": r.fecha || `${r.mes} ${r.anio}`,
                "Nombre del Cliente": r.cliente || "",
                "Descripción del Producto": r.descripcion || "",
                "Modelo / RMS": r.modelo || r.rms || "",
                "Serie del Equipo": r.serie || "",
                "Tipo de Garantía / Estado": r.tipo_garantia || "",
                "Marca": r.marca || "",
                "Link OT Digital": r.link || ""
            };
        });

        // Crear hoja de cálculo SheetJS
        const ws = XLSX.utils.json_to_sheet(dataRows);

        // Anchos de columna automáticos
        ws['!cols'] = [
            { wch: 6 },  // No.
            { wch: 18 }, // Unidad
            { wch: 22 }, // No. OT
            { wch: 24 }, // No. Orden Marca
            { wch: 20 }, // Fecha Ingreso
            { wch: 35 }, // Cliente
            { wch: 45 }, // Descripcion
            { wch: 24 }, // Modelo
            { wch: 26 }, // Serie
            { wch: 24 }, // Tipo Garantia
            { wch: 16 }, // Marca
            { wch: 40 }  // Link
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reporte Garantías");

        // Nombre de archivo descriptivo
        const marcaClean = marca === 'ALL' ? 'TODAS_LAS_MARCAS' : marca.replace(/[^A-Z0-9]/gi, '_');
        const fileName = `Reporte_Garantias_${marcaClean}_${desdeMes}${desdeAnio}_a_${hastaMes}${hastaAnio}.xlsx`;

        XLSX.writeFile(wb, fileName);
    };

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
