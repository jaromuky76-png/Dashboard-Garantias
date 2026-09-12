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
        document.getElementById('filtro-desde-mes').addEventListener('change', () => { deseleccionarBotonesRapidos(); currentPage = 1; aplicarFiltros(); });
        document.getElementById('filtro-desde-anio').addEventListener('change', () => { deseleccionarBotonesRapidos(); currentPage = 1; aplicarFiltros(); });
        document.getElementById('filtro-hasta-mes').addEventListener('change', () => { deseleccionarBotonesRapidos(); currentPage = 1; aplicarFiltros(); });
        document.getElementById('filtro-hasta-anio').addEventListener('change', () => { deseleccionarBotonesRapidos(); currentPage = 1; aplicarFiltros(); });
        
        const buscador = document.getElementById('buscador-general');
        const btnClear = document.getElementById('btn-clear-search');
        buscador.addEventListener('input', () => {
            if (btnClear) {
                if (buscador.value.trim().length > 0) {
                    btnClear.classList.remove('hidden');
                } else {
                    btnClear.classList.add('hidden');
                }
            }
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

    function deseleccionarBotonesRapidos() {
        document.querySelectorAll('.btn-periodo').forEach(b => b.classList.remove('active'));
    }

    window.setRangoRapido = function(dAnio, dMes, hAnio, hMes, btnElement) {
        document.getElementById('filtro-desde-anio').value = dAnio;
        document.getElementById('filtro-desde-mes').value = dMes;
        document.getElementById('filtro-hasta-anio').value = hAnio;
        document.getElementById('filtro-hasta-mes').value = hMes;
        
        deseleccionarBotonesRapidos();
        if (btnElement) {
            btnElement.classList.add('active');
        }

        currentPage = 1;
        aplicarFiltros();
    };

    window.limpiarBuscador = function() {
        const input = document.getElementById('buscador-general');
        if (input) {
            input.value = '';
            input.focus();
        }
        const btnClear = document.getElementById('btn-clear-search');
        if (btnClear) {
            btnClear.classList.add('hidden');
        }
        currentPage = 1;
        aplicarFiltros();
    };

    window.copiarAlPortapapeles = function(texto, label) {
        if (!texto) return;
        navigator.clipboard.writeText(texto).then(() => {
            mostrarToast(`${label || 'Texto'} "${texto}" copiado`);
        }).catch(() => {
            mostrarToast(`Copiado: ${texto}`);
        });
    };

    function mostrarToast(mensaje) {
        const toast = document.getElementById('toast-copy');
        const toastMsg = document.getElementById('toast-msg');
        if (!toast) return;

        if (toastMsg) toastMsg.textContent = mensaje;
        toast.style.display = 'flex';

        if (window._toastTimeout) clearTimeout(window._toastTimeout);
        window._toastTimeout = setTimeout(() => {
            toast.style.display = 'none';
        }, 2200);
    }

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
            tr.className = 'hover:bg-slate-800/50 transition-colors border-b border-slate-800/80 group';

            // Badge Unidad
            const unidadBadge = r.unidad === 'CS' 
                ? '<span class="badge badge-cs font-bold">CS</span>' 
                : '<span class="badge badge-maestros font-bold">MAESTROS</span>';

            // Celda OT con botón de copia rápida y enlace digital
            let otCellContent = '';
            if (r.link) {
                otCellContent = `
                    <a href="${r.link}" target="_blank" rel="noopener noreferrer" class="font-bold text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1">
                        ${r.ot}
                        <svg class="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                        </svg>
                    </a>
                `;
            } else {
                otCellContent = `<span class="font-bold text-white">${r.ot}</span>`;
            }

            const otCell = `
                <div class="inline-flex items-center gap-1.5">
                    ${otCellContent}
                    <button type="button" onclick="copiarAlPortapapeles('${r.ot}', 'No. OT')" class="copy-btn text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700/50" title="Copiar No. de OT">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                    </button>
                </div>
            `;

            // No. Orden Marca (Tratamiento diferenciado: solo LG e HISENSE tienen orden de fábrica)
            let marcaCasoCell = '';
            const isPortalBrand = (r.marca === 'LG' || r.marca === 'HISENSE');

            if (r.no_caso_marca && r.no_caso_marca.trim().length > 0) {
                marcaCasoCell = `
                    <div class="inline-flex items-center gap-1.5">
                        <span class="badge badge-has-case font-mono font-bold">${r.no_caso_marca}</span>
                        <button type="button" onclick="copiarAlPortapapeles('${r.no_caso_marca}', 'No. de Caso')" class="copy-btn text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700/50" title="Copiar No. Caso Marca">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                    </div>
                `;
            } else if (isPortalBrand) {
                marcaCasoCell = `<span class="badge badge-no-case">Pendiente Portal</span>`;
            } else {
                marcaCasoCell = `<span class="badge badge-na-case">N/A (Solo OT)</span>`;
            }

            // Fecha
            const fechaStr = r.fecha ? r.fecha.substring(0, 16) : `${r.mes} ${r.anio}`;

            // Modelo / RMS
            let modeloStr = r.modelo || r.rms || '--';
            if (r.modelo && r.rms && r.modelo !== r.rms) {
                modeloStr = `${r.modelo} <span class="text-[10px] text-slate-400 block font-mono">RMS: ${r.rms}</span>`;
            }

            // Serie
            const serieStr = r.serie ? `<span class="font-mono text-xs text-slate-200 bg-slate-900/60 px-1.5 py-0.5 rounded border border-slate-800">${r.serie}</span>` : '<span class="text-slate-600 italic text-xs">No registrada</span>';

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

        const btnExport = document.getElementById('btn-exportar-excel');
        const btnText = document.getElementById('btn-exportar-texto');
        if (btnText) btnText.textContent = "Generando Excel Ejecutivo...";
        if (btnExport) btnExport.disabled = true;

        try {
            const marca = document.getElementById('filtro-marca').value;
            const unidad = document.getElementById('filtro-unidad').value;
            const desdeAnio = document.getElementById('filtro-desde-anio').value;
            const desdeMesNum = parseInt(document.getElementById('filtro-desde-mes').value, 10);
            const desdeMes = MESES_NOMBRES[desdeMesNum] || '';
            const hastaAnio = document.getElementById('filtro-hasta-anio').value;
            const hastaMesNum = parseInt(document.getElementById('filtro-hasta-mes').value, 10);
            const hastaMes = MESES_NOMBRES[hastaMesNum] || '';

            const marcaTitulo = marca === 'ALL' ? 'TODAS LAS MARCAS' : marca;
            const unidadTitulo = unidad === 'ALL' ? 'CONSOLIDADO (CS + MAESTROS)' : (unidad === 'CS' ? 'CENTRO DE SERVICIOS (CS)' : 'MAESTROS');
            const hoy = new Date();
            const fechaHoraStr = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()} ${String(hoy.getHours()).padStart(2, '0')}:${String(hoy.getMinutes()).padStart(2, '0')}`;

            // Matriz AOA completa
            const aoa = [];

            // Fila 0: Título Principal
            aoa.push([`REPORTE OFICIAL DE CASOS DE GARANTÍA - ${marcaTitulo}`]);
            // Fila 1: Subtítulo de Período y Unidad
            aoa.push([`Período: ${desdeMes} ${desdeAnio} a ${hastaMes} ${hastaAnio}   |   Unidad: ${unidadTitulo}   |   Total Casos: ${filteredRecords.length}`]);
            // Fila 2: Metadatos de auditoría
            aoa.push([`Fecha de Generación: ${fechaHoraStr}   |   Fuente: Sistema Centralizado de Estado de OT`]);
            // Fila 3: Espaciador
            aoa.push([]);

            // Fila 4: Encabezados de tabla
            const headers = [
                "No.",
                "Unidad",
                "No. de OT Interna",
                "No. Orden Marca / Caso",
                "Fecha de Ingreso",
                "Nombre del Cliente",
                "Descripción del Producto",
                "Modelo / RMS",
                "Serie del Equipo",
                "Tipo Garantía / Estado",
                "Marca",
                "Enlace OT Digital"
            ];
            aoa.push(headers);

            // Filas de Datos (Row index 5 en adelante)
            filteredRecords.forEach((r, idx) => {
                const isPortal = (r.marca === 'LG' || r.marca === 'HISENSE');
                let casoTexto = r.no_caso_marca || '';
                if (!casoTexto) {
                    casoTexto = isPortal ? "Pendiente Portal" : "N/A (Solo OT)";
                }

                aoa.push([
                    idx + 1,
                    r.unidad || "CS",
                    r.ot || "",
                    casoTexto,
                    r.fecha || `${r.mes || ''} ${r.anio || ''}`.trim(),
                    r.cliente || "NO ESPECIFICADO",
                    r.descripcion || "",
                    r.modelo || r.rms || "",
                    r.serie || "",
                    r.tipo_garantia || "GARANTIA",
                    r.marca || "",
                    r.link || ""
                ]);
            });

            // Fila de Resumen / Totales (incluida directamente en AOA)
            const summaryRow = [
                "TOTAL REGISTROS:",
                "",
                filteredRecords.length,
                "", "", "", "", "", "", "", "", ""
            ];
            aoa.push(summaryRow);

            // Generar hoja con SheetJS
            const ws = XLSX.utils.aoa_to_sheet(aoa);

            // Merges
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
                { s: { r: 5 + filteredRecords.length, c: 0 }, e: { r: 5 + filteredRecords.length, c: 1 } }
            ];

            // Paleta de colores ejecutiva
            const fontSegoe = 'Segoe UI';
            const colorNavy = { rgb: "1E3A8A" };      // Azul corporativo oscuro #1E3A8A
            const colorBlueHeader = { rgb: "1E40AF" }; // Royal blue #1E40AF
            const colorBorderHeader = { rgb: "93C5FD" }; // Borde azul claro
            const colorBorderCell = { rgb: "E2E8F0" };   // Borde gris sutil
            const colorZebraEven = { rgb: "FFFFFF" };
            const colorZebraOdd = { rgb: "F8FAFC" };     // Blanco humo sutil
            const colorTextDark = { rgb: "0F172A" };
            const colorTextMuted = { rgb: "64748B" };

            const thinCellBorder = {
                top: { style: "thin", color: colorBorderCell },
                bottom: { style: "thin", color: colorBorderCell },
                left: { style: "thin", color: colorBorderCell },
                right: { style: "thin", color: colorBorderCell }
            };

            // Estilos Fila 0 (Título Principal)
            if (ws['A1']) {
                ws['A1'].s = {
                    font: { name: fontSegoe, sz: 14, bold: true, color: { rgb: "FFFFFF" } },
                    fill: { fgColor: colorNavy },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }

            // Estilos Fila 1 (Subtítulo Período)
            if (ws['A2']) {
                ws['A2'].s = {
                    font: { name: fontSegoe, sz: 10, bold: true, color: { rgb: "1E293B" } },
                    fill: { fgColor: { rgb: "E2E8F0" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }

            // Estilos Fila 2 (Metadatos Fecha)
            if (ws['A3']) {
                ws['A3'].s = {
                    font: { name: fontSegoe, sz: 9, italic: true, color: colorTextMuted },
                    fill: { fgColor: { rgb: "F1F5F9" } },
                    alignment: { horizontal: "center", vertical: "center" }
                };
            }

            // Estilos Fila 4 (Encabezados de Tabla, r=4)
            for (let c = 0; c < headers.length; c++) {
                const ref = XLSX.utils.encode_cell({ r: 4, c: c });
                if (ws[ref]) {
                    ws[ref].s = {
                        font: { name: fontSegoe, sz: 10, bold: true, color: { rgb: "FFFFFF" } },
                        fill: { fgColor: colorBlueHeader },
                        alignment: { horizontal: "center", vertical: "center", wrapText: true },
                        border: {
                            top: { style: "thin", color: colorBorderHeader },
                            bottom: { style: "medium", color: colorNavy },
                            left: { style: "thin", color: colorBorderHeader },
                            right: { style: "thin", color: colorBorderHeader }
                        }
                    };
                }
            }

            // Estilos Filas de Datos (r=5 en adelante)
            const totalRows = filteredRecords.length;
            for (let r = 0; r < totalRows; r++) {
                const rowIndex = 5 + r;
                const isOdd = (r % 2 === 1);
                const rowBg = isOdd ? colorZebraOdd : colorZebraEven;
                const record = filteredRecords[r];
                const isPortal = (record.marca === 'LG' || record.marca === 'HISENSE');
                const hasCaseCode = record.no_caso_marca && record.no_caso_marca.trim().length > 0;

                for (let c = 0; c < headers.length; c++) {
                    const ref = XLSX.utils.encode_cell({ r: rowIndex, c: c });
                    const cell = ws[ref];
                    if (!cell) continue;

                    let hAlign = "left";
                    let isBold = false;
                    let textColor = colorTextDark;
                    let isMonospace = false;

                    if (c === 0) { // No.
                        hAlign = "center";
                        textColor = colorTextMuted;
                    } else if (c === 1) { // Unidad
                        hAlign = "center";
                        isBold = true;
                        textColor = record.unidad === 'CS' ? { rgb: "1D4ED8" } : { rgb: "7E22CE" };
                    } else if (c === 2) { // No. OT
                        hAlign = "center";
                        isBold = true;
                        textColor = { rgb: "1E40AF" };
                    } else if (c === 3) { // No. Caso Marca
                        hAlign = "center";
                        if (hasCaseCode) {
                            isBold = true;
                            textColor = { rgb: "047857" }; // Verde Esmeralda
                        } else if (isPortal) {
                            textColor = { rgb: "D97706" }; // Ámbar Pendiente
                            isBold = true;
                        } else {
                            textColor = colorTextMuted; // N/A
                        }
                    } else if (c === 4) { // Fecha
                        hAlign = "center";
                        textColor = colorTextMuted;
                    } else if (c === 5) { // Cliente
                        hAlign = "left";
                        isBold = true;
                    } else if (c === 6) { // Descripción
                        hAlign = "left";
                    } else if (c === 7) { // Modelo
                        hAlign = "center";
                    } else if (c === 8) { // Serie
                        hAlign = "center";
                        isMonospace = true;
                    } else if (c === 9) { // Tipo Garantía
                        hAlign = "center";
                    } else if (c === 10) { // Marca
                        hAlign = "center";
                        isBold = true;
                    } else if (c === 11) { // Enlace OT
                        hAlign = "left";
                        if (cell.v && String(cell.v).startsWith("http")) {
                            textColor = { rgb: "2563EB" };
                        }
                    }

                    cell.s = {
                        font: {
                            name: isMonospace ? 'Consolas' : fontSegoe,
                            sz: 9.5,
                            bold: isBold,
                            color: textColor
                        },
                        fill: { fgColor: rowBg },
                        alignment: {
                            horizontal: hAlign,
                            vertical: "center",
                            wrapText: (c === 6)
                        },
                        border: thinCellBorder
                    };
                }
            }

            // Estilos Fila de Totales
            const summaryRowIdx = 5 + totalRows;
            const doubleBottomBorder = {
                top: { style: "thin", color: colorNavy },
                bottom: { style: "double", color: colorNavy },
                left: { style: "thin", color: colorBorderCell },
                right: { style: "thin", color: colorBorderCell }
            };

            for (let c = 0; c < headers.length; c++) {
                const ref = XLSX.utils.encode_cell({ r: summaryRowIdx, c: c });
                if (ws[ref]) {
                    ws[ref].s = {
                        font: { name: fontSegoe, sz: 10, bold: true, color: colorNavy },
                        fill: { fgColor: { rgb: "E2E8F0" } },
                        alignment: {
                            horizontal: (c === 0 ? "right" : (c === 2 ? "center" : "left")),
                            vertical: "center"
                        },
                        border: doubleBottomBorder
                    };
                }
            }

            // Anchos de Columna optimizados
            ws['!cols'] = [
                { wch: 6 },  // No.
                { wch: 14 }, // Unidad
                { wch: 20 }, // No. OT
                { wch: 24 }, // No. Orden Marca / Caso
                { wch: 18 }, // Fecha Ingreso
                { wch: 34 }, // Cliente
                { wch: 44 }, // Descripción
                { wch: 22 }, // Modelo / RMS
                { wch: 24 }, // Serie
                { wch: 22 }, // Tipo Garantía
                { wch: 16 }, // Marca
                { wch: 42 }  // Enlace OT Digital
            ];

            // Alturas de Fila
            const rowHeights = [
                { hpt: 32 }, // Título
                { hpt: 20 }, // Subtítulo
                { hpt: 18 }, // Metadatos
                { hpt: 10 }, // Espaciador
                { hpt: 26 }  // Encabezados
            ];
            for (let r = 0; r < totalRows; r++) {
                rowHeights.push({ hpt: 22 });
            }
            rowHeights.push({ hpt: 24 }); // Fila de totales
            ws['!rows'] = rowHeights;

            // Crear Libro y Descargar
            const wb = XLSX.utils.book_new();
            const sheetName = ("Garantías " + marcaTitulo).substring(0, 31).replace(/[\\/*?[\]:]/g, '_');
            XLSX.utils.book_append_sheet(wb, ws, sheetName);

            const marcaClean = marca === 'ALL' ? 'TODAS_LAS_MARCAS' : marca.replace(/[^A-Z0-9]/gi, '_');
            const fileName = `Reporte_Garantias_${marcaClean}_${desdeMes}${desdeAnio}_a_${hastaMes}${hastaAnio}.xlsx`;

            XLSX.writeFile(wb, fileName);

            if (btnText) btnText.textContent = "¡Reporte Descargado!";
            setTimeout(() => {
                if (btnText) btnText.textContent = "Exportar Reporte a Excel";
                if (btnExport) btnExport.disabled = false;
            }, 2000);

        } catch (err) {
            console.error("Error al exportar Excel:", err);
            alert("Ocurrió un error al generar el archivo Excel: " + err.message);
            if (btnText) btnText.textContent = "Exportar Reporte a Excel";
            if (btnExport) btnExport.disabled = false;
        }
    };

    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
