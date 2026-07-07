// seguimiento_app.js

let tramites = window.PRELOADED_SEGUIMIENTO || [];

const AUTHORIZED_BRANDS = ['LG', 'HISENSE', 'MILWAUKEE', 'STANLEY', 'DEWALT', 'BLACK&DECKER', 'FORZA'];

// DOM Elements
const tablaBody = document.getElementById('tabla-body');
const buscadorOT = document.getElementById('buscador-ot');
const filtroEstado = document.getElementById('filtro-estado');
const filtroUnidad = document.getElementById('filtro-unidad');
const filtroMarca = document.getElementById('filtro-marca');
const filtroMes = document.getElementById('filtro-mes');
const kpiActivos = document.getElementById('kpi-activos');
const modal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');

let filteredData = [];

// Initialization
function init() {
    populateMeses();
    renderTable();
    updateKPIs();
    
    // Listeners
    buscadorOT.addEventListener('input', renderTable);
    filtroEstado.addEventListener('change', renderTable);
    filtroUnidad.addEventListener('change', renderTable);
    filtroMarca.addEventListener('change', renderTable);
    filtroMes.addEventListener('change', renderTable);
    
    editForm.addEventListener('submit', handleSave);
}

function populateMeses() {
    const meses = [...new Set(tramites.map(t => (t.mes || '').toUpperCase()).filter(Boolean))];
    const mapOrder = { 'ENERO':1, 'FEBRERO':2, 'MARZO':3, 'ABRIL':4, 'MAYO':5, 'JUNIO':6, 'JULIO':7, 'AGOSTO':8, 'SEPTIEMBRE':9, 'OCTUBRE':10, 'NOVIEMBRE':11, 'DICIEMBRE':12 };
    meses.sort((a, b) => (mapOrder[a] || 99) - (mapOrder[b] || 99));
    
    let html = '<option value="ALL">Todos los Meses</option>';
    meses.forEach(m => html += `<option value="${m}">${m}</option>`);
    filtroMes.innerHTML = html;
}

// Render Table
function renderTable() {
    const term = buscadorOT.value.toLowerCase().trim();
    const estadoFil = filtroEstado.value;
    const uniFil = filtroUnidad.value;
    const marcaFil = filtroMarca.value;
    const mesFil = filtroMes.value;
    
    // Filter
    filteredData = tramites.filter(t => {
        if (uniFil !== 'ALL' && t.unidad_negocio !== uniFil) return false;
        if (estadoFil !== 'ALL' && t.estado !== estadoFil) return false;
        if (mesFil !== 'ALL' && (t.mes || '').toUpperCase() !== mesFil) return false;
        
        if (marcaFil === 'AUTHORIZED') {
            const marca = (t.marca || '').toUpperCase();
            const isAuthorized = AUTHORIZED_BRANDS.some(b => marca.includes(b));
            if (!isAuthorized) return false;
        } else if (marcaFil !== 'ALL') {
            if (!(t.marca || '').toUpperCase().includes(marcaFil)) return false;
        }
        
        if (term) {
            const matchesOT = (t.ot || '').toLowerCase().includes(term);
            const matchesCaso = (t.no_caso_portal || '').toLowerCase().includes(term);
            if (!matchesOT && !matchesCaso) return false;
        }
        
        return true;
    });
    
    // Sort by Date DESC
    filteredData.sort((a, b) => new Date(b.fecha_ingreso || 0) - new Date(a.fecha_ingreso || 0));
    
    // Render limit 100 to avoid lag
    const maxRender = 100;
    
    let html = '';
    for(let i=0; i<Math.min(filteredData.length, maxRender); i++) {
        const t = filteredData[i];
        
        let badgeClass = 'badge-Pendiente';
        if(t.estado === 'Subido a Portal (Abierto)') badgeClass = 'badge-Abierto';
        if(t.estado === 'Reclamado/Cerrado') badgeClass = 'badge-Cerrado';
        
        const marca = (t.marca || '').toUpperCase();
        const isAuthorized = AUTHORIZED_BRANDS.some(b => marca.includes(b));
        const marcaHtml = isAuthorized ? `<span class="text-white font-semibold">${marca}</span>` : marca;
        
        html += `
            <tr class="hover:bg-slate-800/50 transition-colors">
                <td class="font-medium text-slate-300">${t.unidad_negocio || ''}</td>
                <td class="font-bold text-primary">${t.ot || ''}</td>
                <td>${marcaHtml}</td>
                <td class="text-slate-300 font-medium">${t.no_caso_portal || '-'}</td>
                <td class="max-w-[200px] truncate" title="${t.descripcion}">${t.descripcion || ''}</td>
                <td>${t.fecha_ingreso || ''}</td>
                <td><span class="badge ${badgeClass}">${t.estado}</span></td>
                <td>
                    <button onclick="openModal('${t.unidad_negocio}', '${t.ot}')" 
                            class="text-xs bg-slate-700 hover:bg-primary text-white px-3 py-1.5 rounded transition-colors">
                        Actualizar
                    </button>
                </td>
            </tr>
        `;
    }
    
    if (filteredData.length > maxRender) {
        html += `<tr><td colspan="8" class="text-center text-slate-400 italic py-4">Mostrando ${maxRender} de ${filteredData.length} resultados. Usa el buscador para refinar.</td></tr>`;
    } else if (filteredData.length === 0) {
        html += `<tr><td colspan="8" class="text-center text-slate-400 italic py-4">No se encontraron trámites con los filtros actuales.</td></tr>`;
    }
    
    tablaBody.innerHTML = html;
}

function updateKPIs() {
    const activos = tramites.filter(t => t.estado !== 'Reclamado/Cerrado').length;
    kpiActivos.textContent = activos;
}

// Modal Logic
function openModal(unidad, ot) {
    const t = tramites.find(x => x.unidad_negocio === unidad && x.ot === ot);
    if(!t) return;
    
    document.getElementById('edit-unidad').value = unidad;
    document.getElementById('edit-ot').value = ot;
    document.getElementById('edit-estado').value = t.estado || 'Pendiente de Subir';
    document.getElementById('edit-caso').value = t.no_caso_portal || '';
    document.getElementById('edit-cierre').value = t.fecha_cierre_portal || '';
    document.getElementById('edit-monto').value = t.monto_mano_obra || '';
    document.getElementById('edit-notas').value = t.notas || '';
    
    document.getElementById('modal-title').textContent = `Actualizar OT: ${ot}`;
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
}

// Handle Form Save
async function handleSave(e) {
    e.preventDefault();
    
    const unidad = document.getElementById('edit-unidad').value;
    const ot = document.getElementById('edit-ot').value;
    
    const data = {
        unidad_negocio: unidad,
        ot: ot,
        estado: document.getElementById('edit-estado').value,
        no_caso_portal: document.getElementById('edit-caso').value,
        fecha_cierre_portal: document.getElementById('edit-cierre').value,
        monto_mano_obra: document.getElementById('edit-monto').value,
        notas: document.getElementById('edit-notas').value
    };
    
    // Update local immediately for UX
    const tIndex = tramites.findIndex(x => x.unidad_negocio === unidad && x.ot === ot);
    if (tIndex >= 0) {
        tramites[tIndex] = { ...tramites[tIndex], ...data };
        renderTable();
        updateKPIs();
        closeModal();
    }
    
    // Send to server
    try {
        const btn = document.getElementById('btn-guardar');
        btn.textContent = 'Guardando...';
        btn.disabled = true;
        
        const resp = await fetch('/api/actualizar_tramite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!resp.ok) {
            alert("Error al guardar en el servidor.");
        }
    } catch(err) {
        console.error(err);
        alert("No se pudo conectar con el servidor.");
    } finally {
        const btn = document.getElementById('btn-guardar');
        btn.textContent = 'Guardar Cambios';
        btn.disabled = false;
    }
}

// CSV Export
function exportToCSV() {
    if (filteredData.length === 0) {
        alert("No hay datos para exportar con los filtros actuales.");
        return;
    }
    
    const headers = [
        "UNIDAD DE NEGOCIO", "NO. OT", "MARCA", "ESTADO", 
        "NO. CASO PORTAL", "FECHA INGRESO", "FECHA CIERRE", "MONTO ($)", "NOTAS"
    ];
    
    const rows = filteredData.map(t => [
        t.unidad_negocio || '',
        t.ot || '',
        t.marca || '',
        t.estado || '',
        t.no_caso_portal || '',
        t.fecha_ingreso || '',
        t.fecha_cierre_portal || '',
        t.monto_mano_obra || '0',
        (t.notas || '').replace(/"/g, '""').replace(/\n/g, ' ')
    ]);
    
    let csvContent = headers.join(",") + "\n" + 
                     rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
                     
    // BOM for UTF-8 Excel support
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Garantias_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Boot
window.onload = init;
