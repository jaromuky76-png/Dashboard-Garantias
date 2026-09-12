import os
import json
import datetime
import xlsx_parser
import urllib.request
import re
import time

# Configuración API Gestioo y caché
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(BASE_DIR, "api_cache.json")
BASE_API_URL = "https://taller.gestioo.net/taller/consulta/obtener_orden/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

SKIP_KEYWORDS = [
    "DIAGNOSTICO", "MANTENIMIENTO", "MANO DE OBRA", "REVISION", 
    "LIMPIEZA", "AJUSTE", "CALIBRACION", "TRANSPORTE", "FLETE",
    "VISITA", "LEVANTAMIENTO", "ACTIVIDAD TECNICA", "INSTALACION", 
    "ARMADO", "CHEQUEO", "REPARACION", "PRUEBA", "DESPLAZAMIENTO",
    "SERVICIOS", "MANO OBRA"
]

MESES_MAP = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
    'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
    'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
}

output_js  = os.path.join(BASE_DIR, "data.js")
output_svc = os.path.join(BASE_DIR, "servicio_data.js")
output_pts = os.path.join(BASE_DIR, "parts_data.js")
output_seg = os.path.join(BASE_DIR, "seguimiento_data.js")
output_rep = os.path.join(BASE_DIR, "reportes_data.js")

def load_cache():
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            pass
    return {}

def save_cache(cache):
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache, f, ensure_ascii=False, indent=2)
    except Exception as e:
        pass

def clean_text(text):
    if text is None: return ""
    text = str(text).upper().strip()
    import unicodedata
    text = ''.join(c for c in unicodedata.normalize('NFD', text) if unicodedata.category(c) != 'Mn')
    return text

def is_spare_part(description):
    desc = clean_text(description)
    for kw in SKIP_KEYWORDS:
        if kw in desc:
            return False
    return True

def extract_order_code(url):
    if not isinstance(url, str): return None
    match = re.search(r'/orden/([^/?#]+)', url)
    if match: return match.group(1)
    return None

def extract_part_code(item):
    code = item.get("codigo")
    if code:
        code_str = str(code).strip()
        if len(code_str) == 9 and code_str.isdigit():
            return code_str
    desc = str(item.get("descripcion") or "")
    if desc:
        match = re.search(r'\b(\d{9})\b', desc.strip())
        if match: return match.group(1)
        match_start = re.match(r'^(\d{9})', desc.strip())
        if match_start: return match_start.group(1)
    return "N/A"

def clean_item_description(desc, part_code):
    if not desc: return ""
    desc_str = str(desc).strip()
    if part_code != "N/A" and desc_str.startswith(part_code):
        desc_str = desc_str[len(part_code):].strip(" -:.")
    return desc_str

def fetch_order_parts(order_code, cache):
    if order_code in cache: return cache[order_code]
    url = f"{BASE_API_URL}{order_code}"
    print(f"  -> Consultando API para {order_code}...")
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get('error') == 0:
                parts = data.get('datos', {}).get('servicios_repuestos', [])
                cache[order_code] = parts
                time.sleep(0.5)  # Slightly faster but still polite
                return parts
    except Exception as e:
        print(f"     Error al consultar {order_code}: {e}")
    return []

def safe_str(v, default=''):
    if v is None: return default
    return str(v).strip()

def safe_int(v, default=1):
    try:
        return int(v) if v is not None else default
    except (ValueError, TypeError):
        return default

def fmt_datetime(v):
    if isinstance(v, datetime.datetime): return v.strftime('%Y-%m-%d %H:%M')
    if isinstance(v, datetime.date): return v.strftime('%Y-%m-%d 00:00')
    return ''

def parse_dt(s):
    if not s or not isinstance(s, str): return None
    s = s.strip()
    for fmt in ('%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%d/%m/%Y %H:%M', '%d/%m/%Y'):
        try:
            return datetime.datetime.strptime(s, fmt)
        except:
            pass
    return None

def classify_category(desc, marca, act=""):
    text = f"{desc} {marca} {act}".upper()
    if any(k in text for k in ["BTU", "EVAPORADOR", "CONDENSADOR", "SEER", "MINI SPLIT", "MINISPLIT", "AIRE ACONDICIONADO", "AA "]):
        return "Climatización (A/C)"
    if any(k in text for k in ["REFRIGERAD", "LAVADORA", "SECADORA", "CONGELADOR", "MICROONDAS", "ESTUFA", "DISPENSADOR", "ENFRIADOR", "EXHIBIDOR"]):
        return "Línea Blanca"
    if any(k in text for k in ["TELEVISOR", " TV ", "TV-", "SMART TV", "NANOCELL", "OLED", "PANTALLA", "PARLANTE", "SOUNDBAR", "BARRA DE SONIDO", "AUDIO"]):
        return "Audio y Video (TV)"
    if any(k in text for k in ["TRUPER", "PRETUL", "MAKITA", "DEWALT", "MILWAUKEE", "STANLEY", "TALADRO", "ESMERIL", "SIERRA", "BOMBA", "HIDROLAVADORA", "DESBROZADORA", "GENERADOR", "COMPRESOR", "SOLDADOR", "MOTOBOMBA", "PULIDORA"]):
        return "Herramientas y Maquinaria"
    if any(k in text for k in ["FORZA", "UPS", "PROTECTOR DE VOLTAJE", "REGULADOR", "BATERIA", "AVTEK", "INVERSOR"]):
        return "Protección Eléctrica / UPS"
    if any(k in text for k in ["CERRADURA", "YALE", "CERROJO", "CANDADO"]):
        return "Cerrajería y Seguridad"
    if any(k in text for k in ["DUCHA", "LORENZETTI", "FAME", "LAMPARA", "REFLECTOR", "TECNOLITE", "LLAVE", "GRIFO", "MONOMANDO"]):
        return "Iluminación / Fontanería"
    return "Otras Categorías"

def load_existing_json(filepath, var_name):
    if not os.path.exists(filepath): return []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            match = re.search(r'' + var_name + r'\s*=\s*(\[.*\]);', content, flags=re.DOTALL)
            if match: return json.loads(match.group(1))
    except Exception as e:
        print(f"Error cargando {filepath}: {e}")
    return []

def scan_stored_files():
    folder_ot = os.environ.get('OT_BASE_DIR', os.path.abspath(os.path.join(BASE_DIR, "..", "OT")))
    file_registry = []
    if not os.path.exists(folder_ot):
        return file_registry
    
    for root, dirs, files in os.walk(folder_ot):
        for fl in sorted(files):
            if (fl.endswith(".xlsx") or fl.endswith(".xls")) and not fl.startswith("~"):
                path = os.path.join(root, fl)
                try:
                    file_stat = os.stat(path)
                    mod_time = datetime.datetime.fromtimestamp(file_stat.st_mtime).strftime('%Y-%m-%d %H:%M')
                    file_size_kb = round(file_stat.st_size / 1024, 1)
                    
                    rel_path = os.path.relpath(root, folder_ot)
                    parts = rel_path.split(os.sep)
                    
                    unidad = parts[0] if len(parts) > 0 else 'UNKNOWN'
                    anio = parts[1] if len(parts) > 1 else 'UNKNOWN'
                    mes = parts[2] if len(parts) > 2 else 'UNKNOWN'
                    
                    file_registry.append({
                        "nombre": fl,
                        "unidad": unidad.upper(),
                        "anio": anio,
                        "mes": mes.upper(),
                        "tamano_kb": file_size_kb,
                        "modificado": mod_time
                    })
                except Exception as e:
                    print(f"Error scanning file {path}: {e}")
    return file_registry

def save_json(filepath, var_name, data, desc, meta_var_name, file_registry=None):
    try:
        archivos = set()
        for row in data:
            u = row.get('unidad_negocio', '')
            a = row.get('anio', '')
            m = row.get('mes', '')
            archivos.add(f"{u}-{a}-{m}")
            
        meta = {
            "totalRegistros": len(data),
            "archivosProcessados": len(archivos),
            "errores": 0
        }
        if file_registry is not None:
            meta["listaArchivos"] = file_registry
            
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"// Generado por dashboard_updater.py -- {desc}\n")
            f.write(f"window.{var_name} = {json.dumps(data, ensure_ascii=False)};\n")
            f.write(f"window.{meta_var_name} = {json.dumps(meta, ensure_ascii=False)};\n")
    except Exception as e:
        print(f"Error guardando {filepath}: {e}")

def remove_existing_period(data, unidad, anio, mes):
    return [x for x in data if not (str(x.get('anio')) == str(anio) and str(x.get('mes')).upper() == mes.upper() and str(x.get('unidad_negocio')).upper() == unidad.upper())]

def process_single_file(filepath, unidad, anio, mes, mes_num):
    print(f"Iniciando actualización incremental: {unidad} {mes} {anio}...")
    api_cache = load_cache()
    
    garantia_data = load_existing_json(output_js, 'PRELOADED_DATA')
    servicio_data = load_existing_json(output_svc, 'PRELOADED_SERVICIO')
    parts_data = load_existing_json(output_pts, 'partsData')
    seguimiento_data = load_existing_json(output_seg, 'PRELOADED_SEGUIMIENTO')
    reportes_data = load_existing_json(output_rep, 'REPORTES_DATA')
    
    # Remover registros viejos (excepto para seguimiento, que mantiene el historial)
    garantia_data = remove_existing_period(garantia_data, unidad, anio, mes)
    servicio_data = remove_existing_period(servicio_data, unidad, anio, mes)
    parts_data = remove_existing_period(parts_data, unidad, anio, mes)
    reportes_data = remove_existing_period(reportes_data, unidad, anio, mes)
    
    cnt_g, cnt_s, cnt_p, cnt_seg, cnt_rep = 0, 0, 0, 0, 0
    existing_seg = {f"{x.get('unidad_negocio', '')}-{x.get('ot', '')}" for x in seguimiento_data}
    
    try:
        sheet_names = xlsx_parser.get_xlsx_sheet_names(filepath)
        ot_sheet_name = None
        for name in sheet_names:
            if name.strip().upper() in ('OT', 'ESTADO DE OT'):
                ot_sheet_name = name
                break
        if not ot_sheet_name:
            ot_sheet_name = sheet_names[0] if sheet_names else 'OT'
            
        parser_generator = xlsx_parser.read_xlsx_rows_smart(filepath, ot_sheet_name)
        h = None
        
        for row, header_map in parser_generator:
            if header_map:
                h = header_map
                # Unificar indices
                ot_i = h.get('NO. OT', h.get('NO. OT/MR', -1))
                fecha_i = next((idx for k, idx in h.items() if "FECHA Y HR" in k or "FECHA DE CREACION" in k or "FECHA Y HORA" in k or "FECHA DE INGRESO" in k), -1)
                marca_i = h.get('MARCA', -1)
                rms_i = h.get('RMS', h.get('RMS EVAPORADOR', -1))
                desc_i = h.get('DESCRIPCION DEL EQUIPO', h.get('DESCRIPCION DEL EVAPORADOR', -1))
                cant_i = h.get('CANT2', h.get('CANT', -1))
                tipo_i = h.get('TIPO DE GARANTIA', -1)
                acep_i = h.get('ACEPTACION', -1)
                link_i = h.get('LINK OT DIGITAL', -1)
                
                # Indices específicos para seguimiento
                validador_garantia_i = next((idx for k, idx in h.items() if "VALIDADOR DE GARANTI" in k or "VALIDACION DE GARANTIA" in k), 9)
                boleta_rnn_i = next((idx for k, idx in h.items() if "BOLETA/RNN" in k or "BOLETA" in k or "RNN" in k), 26)
                actividad_i = next((idx for k, idx in h.items() if "ACTIVIDAD" in k), 9)
                externo_rnn_i = next((idx for k, idx in h.items() if "EXTERNO/RNN" in k or "EXTERNO" in k), 3)

                # CS specific
                npp_i = next((idx for k, idx in h.items() if k == "NPP" or "NPP" in k), 18)
                mod_i = h.get('MODELO', -1)
                ser_i = next((idx for k, idx in h.items() if "SERIE" in k), -1)
                fd_i = h.get('FECHA Y HORA DE ENTREGA DE DIAGNOSTICO', -1)
                ff_i = h.get('FECHA Y HORA DE FINALIZACION DE OT', -1)
                estatus_i = h.get('ESTATUS', -1)

                # Maestros specific
                mod_e_i = h.get('MODELO EVARPORADOR', h.get('MODELO EVAPORADOR', -1))
                mod_c_i = h.get('MODELO DEL CONDENSADOR', h.get('MODELO CONDENSADOR', -1))
                ser_e_i = h.get('SERIE EVAPORADOR', -1)
                ser_c_i = h.get('SERIE CONDENSADOR', -1)
                desc_e_i = h.get('DESCRIPCION DEL EVAPORADOR', -1)
                desc_c_i = h.get('DESCRIPCION DEL CONDENSADOR', -1)
                fe_i = h.get('FECHA Y HORA DE FIN DE EJECUCION', -1)

                seg_map = {f"{x.get('unidad_negocio', '')}-{x.get('ot', '')}": x for x in seguimiento_data}
                continue
                
            if h:
                try:
                    tipo = safe_str(row[tipo_i] if tipo_i >= 0 and tipo_i < len(row) else None).upper()
                    
                    acep = safe_str(row[acep_i] if acep_i >= 0 and acep_i < len(row) else None).upper()
                    marca = safe_str(row[marca_i] if marca_i >= 0 and marca_i < len(row) else None, 'DESCONOCIDA').upper()
                    rms = safe_str(row[rms_i] if rms_i >= 0 and rms_i < len(row) else None, 'N/A')
                    desc = safe_str(row[desc_i] if desc_i >= 0 and desc_i < len(row) else None, '')
                    cant = safe_int(row[cant_i] if cant_i >= 0 and cant_i < len(row) else None, 1)
                    ot_n = safe_str(row[ot_i] if ot_i >= 0 and ot_i < len(row) else None, '')
                    link = safe_str(row[link_i] if link_i >= 0 and link_i < len(row) else None, '')
                    fecha = row[fecha_i] if fecha_i >= 0 and fecha_i < len(row) else ""
                    
                    base = {
                        "marca": marca, "rms": rms, "descripcion": desc,
                        "fecha": fecha, "anio": int(anio), "mes": mes, "mesNum": int(mes_num),
                        "ot": ot_n, "unidad_negocio": unidad.upper()
                    }
                    
                    # Garantias y Servicios (tabs Garantias/Servicios)
                    if tipo:
                        if "GARANTIA" in tipo:
                            norm = "GARANTIA TOTAL" if "TOTAL" in tipo else "GARANTIA PARCIAL"
                            garantia_data.append({**base, "tipoGarantia": norm})
                            cnt_g += 1
                        elif "SERVICIO" in tipo:
                            servicio_data.append(base)
                            cnt_s += 1

                    # ----------------- SEGUIMIENTO DE TRAMITES -----------------
                    es_seguimiento = False
                    no_caso = ""
                    estado_inicial = "Pendiente de Subir"
                    
                    if unidad.upper() == 'CS':
                        # CS Logic
                        validador_garantia_val = safe_str(row[validador_garantia_i] if validador_garantia_i < len(row) else None).upper()
                        boleta_rnn_val = safe_str(row[boleta_rnn_i] if boleta_rnn_i < len(row) else None).strip()
                        
                        if "DENTRO" in validador_garantia_val:
                            # Es un reclamo de CS
                            es_seguimiento = True
                            
                            # Validar nomenclatura de LG e Hisense
                            if "LG" in marca:
                                # LG: RNN + 12 digitos
                                rnn_match = re.search(r'RNN\d{12}', boleta_rnn_val, re.IGNORECASE)
                                if rnn_match:
                                    no_caso = rnn_match.group(0).upper()
                                    estado_inicial = "Subido a Portal (Abierto)"
                                else:
                                    no_caso = "Falta trámite en portal"
                                    estado_inicial = "Pendiente de Subir"
                            elif "HISENSE" in marca:
                                # Hisense: 9 digitos
                                his_match = re.search(r'\b\d{9}\b', boleta_rnn_val)
                                if his_match:
                                    no_caso = his_match.group(0)
                                    estado_inicial = "Subido a Portal (Abierto)"
                                else:
                                    no_caso = "Falta trámite en portal"
                                    estado_inicial = "Pendiente de Subir"
                            else:
                                # Otras marcas
                                no_caso = boleta_rnn_val
                                if no_caso:
                                    estado_inicial = "Subido a Portal (Abierto)"
                                else:
                                    estado_inicial = "Pendiente de Subir"
                    else:
                        # MAESTROS Logic
                        # Solo LG y Hisense
                        if "LG" in marca or "HISENSE" in marca:
                            actividad_val = safe_str(row[actividad_i] if actividad_i < len(row) else None).upper()
                            externo_rnn_val = safe_str(row[externo_rnn_i] if externo_rnn_i < len(row) else None).strip()
                            
                            if "RECLAMO" in actividad_val:
                                es_seguimiento = True
                                
                                if "LG" in marca:
                                    rnn_match = re.search(r'RNN\d{12}', externo_rnn_val, re.IGNORECASE)
                                    if rnn_match:
                                        no_caso = rnn_match.group(0).upper()
                                        estado_inicial = "Subido a Portal (Abierto)"
                                    else:
                                        no_caso = "Falta trámite en portal"
                                        estado_inicial = "Pendiente de Subir"
                                elif "HISENSE" in marca:
                                    his_match = re.search(r'\b\d{9}\b', externo_rnn_val)
                                    if his_match:
                                        no_caso = his_match.group(0)
                                        estado_inicial = "Subido a Portal (Abierto)"
                                    else:
                                        no_caso = "Falta trámite en portal"
                                        estado_inicial = "Pendiente de Subir"

                    # Guardar en seguimiento
                    if es_seguimiento and ot_n:
                        key = f"{unidad.upper()}-{ot_n}"
                        if key not in seg_map:
                            # Agregar nuevo
                            seguimiento_data.append({
                                "ot": ot_n, "marca": marca, "descripcion": desc,
                                "fecha_ingreso": fecha, "unidad_negocio": unidad.upper(),
                                "anio": int(anio), "mes": mes, "mesNum": int(mes_num),
                                "estado": estado_inicial, "notes": "", "fecha_estimada": "",
                                "no_caso_portal": no_caso, "fecha_cierre_portal": "", "monto_mano_obra": 0
                            })
                            seg_map[key] = seguimiento_data[-1]
                            cnt_seg += 1
                        else:
                            # Actualizar si no está cerrado
                            existing_rec = seg_map[key]
                            if existing_rec.get("estado") != "Reclamado/Cerrado":
                                old_caso = existing_rec.get("no_caso_portal", "")
                                if (not old_caso or old_caso == "Falta trámite en portal") and no_caso and no_caso != "Falta trámite en portal":
                                    existing_rec["no_caso_portal"] = no_caso
                                    existing_rec["estado"] = "Subido a Portal (Abierto)"
                                if not existing_rec.get("descripcion") and desc:
                                    existing_rec["descripcion"] = desc
                                if not existing_rec.get("fecha_ingreso") and fecha:
                                    existing_rec["fecha_ingreso"] = fecha
                                # También podemos actualizar la marca o el mes/año
                                if not existing_rec.get("marca") and marca:
                                    existing_rec["marca"] = marca
                                existing_rec["anio"] = int(anio)
                                existing_rec["mes"] = mes
                                existing_rec["mesNum"] = int(mes_num)
                        
                    # Repuestos
                    es_parcial = 'PARCIAL' in tipo
                    es_svc_apro = 'SERVICIO' in tipo and acep == 'SI'
                    if es_parcial or es_svc_apro:
                        order_code = extract_order_code(link)
                        if order_code:
                            parts = fetch_order_parts(order_code, api_cache)
                            for p in parts:
                                if p and isinstance(p, dict):
                                    desc_part = p.get('descripcion', '')
                                    if is_spare_part(desc_part):
                                        part_code = extract_part_code(p)
                                        clean_desc = clean_item_description(desc_part, part_code)
                                        cant_part = safe_int(p.get('cantidad'), 1)
                                        parts_data.append({
                                            "ot": ot_n, "marca": marca, "codigo_repuesto": part_code,
                                            "descripcion": clean_desc, "cantidad": cant_part,
                                            "tipo_garantia": tipo, "aceptacion": acep, "link": link,
                                            "fecha": fecha, "anio": int(anio), "mes": mes, "mesNum": int(mes_num),
                                            "unidad_negocio": unidad.upper()
                                        })
                                        cnt_p += 1
                        
                    # ----------------- REPORTE DE GARANTIAS POR MARCA -----------------
                    cli = safe_str(row[cli_i] if cli_i >= 0 and cli_i < len(row) else '')
                    if unidad.upper() == 'CS':
                        npp_val = safe_str(row[npp_i] if npp_i >= 0 and npp_i < len(row) else '')
                        mod_val = safe_str(row[mod_i] if mod_i >= 0 and mod_i < len(row) else '')
                        ser = safe_str(row[ser_i] if ser_i >= 0 and ser_i < len(row) else '')
                        # En CS, Col S (NPP) es la columna oficial para modelo
                        if npp_val and npp_val not in ('--', '0', 'N/A', 'None'):
                            modelo_rep = npp_val
                        elif mod_val and mod_val not in ('--', '0', 'N/A', 'None'):
                            modelo_rep = mod_val
                        else:
                            modelo_rep = rms
                        desc_rep = desc
                    else:
                        mod_e = safe_str(row[mod_e_i] if mod_e_i >= 0 and mod_e_i < len(row) else '')
                        mod_c = safe_str(row[mod_c_i] if mod_c_i >= 0 and mod_c_i < len(row) else '')
                        ser_e = safe_str(row[ser_e_i] if ser_e_i >= 0 and ser_e_i < len(row) else '')
                        ser_c = safe_str(row[ser_c_i] if ser_c_i >= 0 and ser_c_i < len(row) else '')
                        desc_e = safe_str(row[desc_e_i] if desc_e_i >= 0 and desc_e_i < len(row) else '')
                        desc_c = safe_str(row[desc_c_i] if desc_c_i >= 0 and desc_c_i < len(row) else '')
                        desc_list = [d for d in (desc_e, desc_c) if d and d not in ('--', '0')]
                        desc_rep = " / ".join(desc_list) if desc_list else (desc or actividad_val)
                        # En Maestros, Col V (modelo evaporador) es la columna oficial para modelo
                        mod_list = [m for m in (mod_e, mod_c) if m and m not in ('--', '0', 'N/A', 'None')]
                        modelo_rep = " / ".join(mod_list) if mod_list else rms
                        ser_list = [s for s in (ser_e, ser_c) if s and s not in ('--', '0')]
                        ser = " / ".join(ser_list)

                    # REGLA 1: Excluir servicios (solo garantías)
                    if "SERVICIO" in tipo and "GARANTIA" not in tipo:
                        continue
                    if any(x in actividad_val for x in ["INSTALACION", "VISITA FUTURA INST", "MANTENIMIENTO", "DESINSTALACION"]):
                        continue
                    if tipo in ["ARMADO Y PRUEBA", "TRASFERENCIA VIA SISTEMA", "MANTO POSTVENTA"]:
                        continue

                    is_warranty = False
                    if unidad.upper() == 'CS':
                        if "GARANTIA" in tipo or "DENTRO" in validador_garantia_val or tipo in ["TRABAJANDO CORRECTAMENTE", "ACTIVO", "INV TIENDA"]:
                            is_warranty = True
                    else:
                        if "RECLAMO" in actividad_val or "GARANTIA" in tipo or "ASUME TIENDA" in tipo:
                            is_warranty = True

                    if not is_warranty:
                        continue

                    # REGLA 2: Hisense y LG número de orden de portal (si no existe, va en blanco para auditoría de usuarios)
                    no_caso = ""
                    if "HISENSE" in marca:
                        m9 = re.search(r'\b(2\d{8})\b', boleta_val)
                        if not m9:
                            row_s = " ".join(str(c) for c in row if c is not None)
                            m9 = re.search(r'\b(2\d{8})\b', row_s)
                        if m9:
                            no_caso = m9.group(1)
                    elif "LG" in marca:
                        mrnn = re.search(r'RNN\d{12}', boleta_val, re.IGNORECASE)
                        if not mrnn:
                            row_s = " ".join(str(c) for c in row if c is not None)
                            mrnn = re.search(r'RNN\d{12}', row_s, re.IGNORECASE)
                        if mrnn:
                            no_caso = mrnn.group(0).upper()

                    # Categoría y Tiempos de Respuesta
                    categoria = classify_category(desc_rep, marca, actividad_val)
                    estatus_val = safe_str(row[estatus_i] if estatus_i >= 0 and estatus_i < len(row) else None).upper()
                    
                    dt_i = parse_dt(fecha)
                    fd_raw = row[fd_i] if unidad.upper() == 'CS' and fd_i >= 0 and fd_i < len(row) else (row[fe_i] if unidad.upper() != 'CS' and fe_i >= 0 and fe_i < len(row) else None)
                    ff_raw = row[ff_i] if ff_i >= 0 and ff_i < len(row) else None
                    
                    dt_d = parse_dt(fd_raw)
                    dt_f = parse_dt(ff_raw)
                    
                    dias_diag = None
                    dias_cierre = None
                    
                    if dt_i:
                        if dt_d and dt_d >= dt_i:
                            d_val = (dt_d - dt_i).total_seconds() / 86400.0
                            if d_val <= 120:
                                dias_diag = round(d_val, 1)
                        if dt_f and dt_f >= dt_i:
                            f_val = (dt_f - dt_i).total_seconds() / 86400.0
                            if f_val <= 180:
                                dias_cierre = round(f_val, 1)

                    if ot_n and marca and marca != "DESCONOCIDA":
                        reportes_data.append({
                            "ot": ot_n,
                            "marca": marca,
                            "no_caso_marca": no_caso,
                            "cliente": cli,
                            "descripcion": desc_rep,
                            "modelo": modelo_rep,
                            "rms": rms,
                            "serie": ser,
                            "fecha": fecha,
                            "anio": int(anio),
                            "mes": mes,
                            "mesNum": int(mes_num),
                            "tipo_garantia": tipo if tipo else (validador_garantia_val if unidad.upper() == 'CS' else actividad_val),
                            "categoria": categoria,
                            "estatus": estatus_val,
                            "fecha_diagnostico": fd_raw if isinstance(fd_raw, str) else "",
                            "fecha_cierre": ff_raw if isinstance(ff_raw, str) else "",
                            "dias_diagnostico": dias_diag,
                            "dias_cierre": dias_cierre,
                            "link": link
                        })
                        cnt_rep += 1

                except Exception as row_ex:
                    print(f"Error procesando fila {row[:4] if row else 'vacia'}: {row_ex}")
    except Exception as e:
        print(f"Error procesando {filepath}: {e}")
        import traceback; traceback.print_exc()
    finally:
        pass

    # Guardar cache y archivos
    save_cache(api_cache)
    file_reg = scan_stored_files()
    save_json(output_js, 'PRELOADED_DATA', garantia_data, "Garantias", "PRELOADED_META", file_reg)
    save_json(output_svc, 'PRELOADED_SERVICIO', servicio_data, "Servicios", "PRELOADED_META_SVC", file_reg)
    save_json(output_pts, 'partsData', parts_data, "Repuestos", "PARTS_META", file_reg)
    save_json(output_seg, 'PRELOADED_SEGUIMIENTO', seguimiento_data, "Seguimiento", "SEGUIMIENTO_META", file_reg)
    save_json(output_rep, 'REPORTES_DATA', reportes_data, "Reportes Marcas", "REPORTES_META", file_reg)
    
    print(f"Finalizado: {cnt_g} garantias, {cnt_s} servicios, {cnt_p} repuestos, {cnt_seg} nuevos seguimientos, {cnt_rep} reportes agregados.")
    return True

if __name__ == "__main__":
    reg = scan_stored_files()
    print(f"Scanned files count: {len(reg)}")
    if len(reg) > 0:
        print(f"Sample file: {reg[0]}")
    
    garantia_data = load_existing_json(output_js, 'PRELOADED_DATA')
    servicio_data = load_existing_json(output_svc, 'PRELOADED_SERVICIO')
    parts_data = load_existing_json(output_pts, 'partsData')
    seguimiento_data = load_existing_json(output_seg, 'PRELOADED_SEGUIMIENTO')
    reportes_data = load_existing_json(output_rep, 'REPORTES_DATA')
    
    save_json(output_js, 'PRELOADED_DATA', garantia_data, "Garantias", "PRELOADED_META", reg)
    save_json(output_svc, 'PRELOADED_SERVICIO', servicio_data, "Servicios", "PRELOADED_META_SVC", reg)
    save_json(output_pts, 'partsData', parts_data, "Repuestos", "PARTS_META", reg)
    save_json(output_seg, 'PRELOADED_SEGUIMIENTO', seguimiento_data, "Seguimiento", "SEGUIMIENTO_META", reg)
    save_json(output_rep, 'REPORTES_DATA', reportes_data, "Reportes Marcas", "REPORTES_META", reg)
    print("Preloaded files metadata populated in all JS files.")
