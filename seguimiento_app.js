// seguimiento_app.js

let tramites = window.PRELOADED_SEGUIMIENTO || [];

// DOM Elements
const tablaBody = document.getElementById('tabla-body');
const buscadorOT = document.getElementById('buscador-ot');
const filtroEstado = document.getElementById('filtro-estado');
const filtroUnidad = document.getElementById('filtro-unidad');
const kpiActivos = document.getElementById('kpi-activos');
const modal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');

// Initialization
function init() {
    renderTable();
    updateKPIs();
    
    // Listeners
    buscadorOT.addEventListener('input', renderTable);
    filtroEstado.addEventListener('change', renderTable);
    filtroUnidad.addEventListener('change', renderTable);
    
    editForm.addEventListener('submit', handleSave);
}

// Render Table
function renderTable() {
    const term = buscadorOT.value.toLowerCase().trim();
    const estadoFil = filtroEstado.value;
    const uniFil = filtroUnidad.value;
    
    // Filter
    let filtered = tramites.filter(t => {
        if (uniFil !== 'ALL' && t.unidad_negocio !== uniFil) return false;
        if (estadoFil !== 'ALL' && t.estado !== estadoFil) return false;
        if (term && !t.ot.toLowerCase().includes(term)) return false;
        return true;
    });
    
    // Sort by Date DESC
    filtered.sort((a, b) => new Date(b.fecha_ingreso || 0) - new Date(a.fecha_ingreso || 0));
    
    // Render limit 50 to avoid lag
    const maxRender = 50;
    
    let html = '';
    for(let i=0; i<Math.min(filtered.length, maxRender); i++) {
        const t = filtered[i];
        
        let badgeClass = 'badge-Pendiente';
        if(t.estado === 'Proceso') badgeClass = 'badge-Proceso';
        if(t.estado === 'Finalizado') badgeClass = 'badge-Finalizado';
        
        html += `
            <tr class="hover:bg-slate-800/50 transition-colors">
                <td class="font-medium text-slate-300">${t.unidad_negocio || ''}</td>
                <td class="font-bold text-primary">${t.ot || ''}</td>
                <td>${t.marca || ''}</td>
                <td class="max-w-[200px] truncate" title="${t.descripcion}">${t.descripcion || ''}</td>
                <td>${t.fecha_ingreso || ''}</td>
                <td><span class="badge ${badgeClass}">${t.estado}</span></td>
                <td>${t.fecha_estimada || '-'}</td>
                <td>
                    <button onclick="openModal('${t.unidad_negocio}', '${t.ot}')" 
                            class="text-xs bg-slate-700 hover:bg-primary text-white px-3 py-1.5 rounded transition-colors">
                        Actualizar
                    </button>
                </td>
            </tr>
        `;
    }
    
    if (filtered.length > maxRender) {
        html += `<tr><td colspan="8" class="text-center text-slate-400 italic py-4">Mostrando ${maxRender} de ${filtered.length} resultados. Usa el buscador para refinar.</td></tr>`;
    } else if (filtered.length === 0) {
        html += `<tr><td colspan="8" class="text-center text-slate-400 italic py-4">No se encontraron trámites con los filtros actuales.</td></tr>`;
    }
    
    tablaBody.innerHTML = html;
}

function updateKPIs() {
    const activos = tramites.filter(t => t.estado !== 'Finalizado').length;
    kpiActivos.textContent = activos;
}

// Modal Logic
function openModal(unidad, ot) {
    const t = tramites.find(x => x.unidad_negocio === unidad && x.ot === ot);
    if(!t) return;
    
    document.getElementById('edit-unidad').value = unidad;
    document.getElementById('edit-ot').value = ot;
    document.getElementById('edit-estado').value = t.estado || 'Pendiente';
    document.getElementById('edit-fecha').value = t.fecha_estimada || '';
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
        fecha_estimada: document.getElementById('edit-fecha').value,
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

// Boot
window.onload = init;
