import os
import re
import gc
import json
import subprocess
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OT_BASE_DIR = os.environ.get('OT_BASE_DIR', os.path.abspath(os.path.join(BASE_DIR, "..", "OT")))

MESES_MAP = {
    'ENERO': 1, 'FEBRERO': 2, 'MARZO': 3, 'ABRIL': 4,
    'MAYO': 5, 'JUNIO': 6, 'JULIO': 7, 'AGOSTO': 8,
    'SEPTIEMBRE': 9, 'OCTUBRE': 10, 'NOVIEMBRE': 11, 'DICIEMBRE': 12
}
MESES_INV = {v: k for k, v in MESES_MAP.items()}

is_processing = False


def parse_multipart_streaming(rfile, content_length, boundary_bytes, temp_xlsx_path):
    """
    TRUE streaming multipart parser.
    Reads from socket in 64KB chunks and writes the file part straight to disk.
    The full request body is NEVER held in RAM at the same time.
    Returns (filename, unidad).
    """
    boundary = b'--' + boundary_bytes
    CHUNK = 65536  # 64 KB

    filename = None
    unidad = 'CS'

    buf = b''
    state = 'FIND_BOUNDARY'   # states: FIND_BOUNDARY, READ_HEADERS, READ_BODY
    current_field_name = None
    current_filename = None
    is_file_field = False
    field_value_buf = b''
    file_out = None

    bytes_remaining = content_length

    def flush_safe(buf, boundary, file_out):
        """Write everything except the last len(boundary)+4 bytes (safety margin)."""
        safe = max(0, len(buf) - len(boundary) - 4)
        if safe > 0 and file_out:
            file_out.write(buf[:safe])
        return buf[safe:]

    try:
        while bytes_remaining > 0 or buf:
            # Read more data if needed
            if bytes_remaining > 0:
                to_read = min(CHUNK, bytes_remaining)
                chunk = rfile.read(to_read)
                if not chunk:
                    break
                bytes_remaining -= len(chunk)
                buf += chunk

            if state == 'FIND_BOUNDARY':
                pos = buf.find(boundary)
                if pos == -1:
                    if bytes_remaining == 0:
                        break
                    continue
                buf = buf[pos + len(boundary):]
                # skip \r\n after boundary
                if buf.startswith(b'\r\n'):
                    buf = buf[2:]
                state = 'READ_HEADERS'
                current_field_name = None
                current_filename = None
                is_file_field = False
                field_value_buf = b''

            elif state == 'READ_HEADERS':
                # Find end of headers
                end = buf.find(b'\r\n\r\n')
                if end == -1:
                    if bytes_remaining == 0:
                        break
                    continue  # need more data

                header_bytes = buf[:end]
                buf = buf[end + 4:]
                header_str = header_bytes.decode('utf-8', 'ignore')

                name_m = re.search(r'name="([^"]+)"', header_str)
                fn_m = re.search(r'filename="([^"]+)"', header_str)

                current_field_name = name_m.group(1) if name_m else None
                current_filename = fn_m.group(1) if fn_m else None
                is_file_field = current_filename is not None

                if is_file_field:
                    filename = os.path.basename(current_filename)
                    file_out = open(temp_xlsx_path, 'wb')

                state = 'READ_BODY'

            elif state == 'READ_BODY':
                # Look for next boundary in buffer
                pos = buf.find(boundary)
                if pos != -1:
                    # We found the boundary: write everything up to it
                    body_data = buf[:pos]
                    # strip trailing \r\n before boundary
                    if body_data.endswith(b'\r\n'):
                        body_data = body_data[:-2]

                    if is_file_field and file_out:
                        file_out.write(body_data)
                        file_out.close()
                        file_out = None
                    elif current_field_name in ('unidad', 'unidad_negocio'):
                        unidad = body_data.decode('utf-8', 'ignore').strip().upper()

                    buf = buf[pos + len(boundary):]
                    # Check for end boundary (--)
                    if buf.startswith(b'--'):
                        break
                    if buf.startswith(b'\r\n'):
                        buf = buf[2:]

                    state = 'READ_HEADERS'
                    current_field_name = None
                    current_filename = None
                    is_file_field = False
                    field_value_buf = b''
                else:
                    # Boundary not found yet - flush safe portion to disk
                    if is_file_field and file_out:
                        buf = flush_safe(buf, boundary, file_out)
                    if bytes_remaining == 0:
                        # No more data: flush remaining
                        if is_file_field and file_out:
                            file_out.write(buf)
                            file_out.close()
                            file_out = None
                        break
                    # continue reading more chunks

    finally:
        if file_out:
            file_out.close()

    if unidad not in ('CS', 'MAESTROS'):
        unidad = 'CS'

    return filename, unidad


class DashboardServer(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        if self.path == '/status':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'processing': is_processing}).encode())
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/upload':
            self.handle_upload()
        elif self.path == '/api/actualizar_tramite':
            self.handle_actualizar_tramite()
        else:
            self.send_error(404, "Not Found")

    def handle_upload(self):
        try:
            content_type = self.headers.get('Content-Type', '')
            if 'multipart/form-data' not in content_type:
                self.send_error(400, "Bad Request: expected multipart/form-data")
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "Empty request")
                return

            boundary_match = re.search(r'boundary=([^\s;]+)', content_type)
            if not boundary_match:
                self.send_error(400, "No boundary in Content-Type")
                return
            boundary_bytes = boundary_match.group(1).encode()

            temp_path = os.path.join(BASE_DIR, "temp_upload.xlsx")

            # TRUE STREAMING: file goes from socket to disk, never into RAM
            filename, unidad = parse_multipart_streaming(
                self.rfile, content_length, boundary_bytes, temp_path
            )
            gc.collect()

            if not filename or not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                self.send_error(400, "No file uploaded or file empty")
                return

            anio_str, mes_nombre = self.detect_date_info(temp_path, filename, unidad)

            if not mes_nombre:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No se pudo determinar el mes del archivo'}).encode())
                return

            target_dir = os.path.join(OT_BASE_DIR, unidad, anio_str, mes_nombre)
            os.makedirs(target_dir, exist_ok=True)
            target_path = os.path.join(target_dir, filename)

            existing_files = [f for f in os.listdir(target_dir) if f.endswith(('.xlsx', '.xls'))]
            for old_f in existing_files:
                try:
                    os.remove(os.path.join(target_dir, old_f))
                except Exception:
                    pass

            os.rename(temp_path, target_path)
            print(f"Archivo guardado: {target_path}")

            global is_processing
            is_processing = True

            def run_updater(path, u, a, m, m_num):
                global is_processing
                try:
                    import dashboard_updater
                    print(f"Ejecutando actualización: {u} {m} {a}...")
                    dashboard_updater.process_single_file(path, u, a, m, m_num)
                    print("Actualización completada.")

                    subprocess.run(
                        ["git", "add", "data.js", "servicio_data.js", "parts_data.js",
                         "seguimiento_data.js", "api_cache.json"],
                        cwd=BASE_DIR, check=False
                    )
                    status = subprocess.run(
                        ["git", "status", "--porcelain"],
                        cwd=BASE_DIR, capture_output=True, text=True
                    )
                    if status.stdout.strip():
                        subprocess.run(
                            ["git", "commit", "-m", f"Update data: {u} {m} {a}"],
                            cwd=BASE_DIR, check=False
                        )
                        token = os.environ.get("GITHUB_TOKEN")
                        if token:
                            repo_url = f"https://jaromuky76-png:{token}@github.com/jaromuky76-png/Dashboard-Garantias.git"
                            subprocess.run(["git", "remote", "set-url", "origin", repo_url], cwd=BASE_DIR, check=False)
                        push_res = subprocess.run(
                            ["git", "push", "origin", "HEAD:master"],
                            cwd=BASE_DIR, capture_output=True, text=True
                        )
                        print("GitHub OK" if push_res.returncode == 0 else f"Push error: {push_res.stderr}")
                    else:
                        print("Sin cambios nuevos para GitHub.")

                except Exception as e:
                    print(f"Error en run_updater: {e}")
                    import traceback
                    traceback.print_exc()
                finally:
                    is_processing = False

            mes_num = MESES_MAP.get(mes_nombre, 0)
            t = threading.Thread(target=run_updater, args=(target_path, unidad, anio_str, mes_nombre, mes_num))
            t.daemon = True
            t.start()

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'mes': mes_nombre}).encode())

        except Exception as ex:
            import traceback
            traceback.print_exc()
            try:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': f'Server error: {str(ex)}'}).encode())
            except Exception:
                pass

    def detect_date_info(self, filepath, filename, unidad="CS"):
        mes_detectado = None
        anio_detectado = None

        filename_upper = str(filename).upper()
        for mes_name in MESES_MAP.keys():
            if mes_name in filename_upper:
                mes_detectado = mes_name
                break

        match_year = re.search(r'(20\d{2})', filename_upper)
        if match_year:
            anio_detectado = match_year.group(1)

        if not mes_detectado or not anio_detectado:
            try:
                import openpyxl
                from collections import Counter
                wb = openpyxl.load_workbook(filepath, data_only=True, read_only=True)
                ot_sheet_name = None
                for name in wb.sheetnames:
                    if name.strip().upper() in ('OT', 'ESTADO DE OT'):
                        ot_sheet_name = name
                        break
                if not ot_sheet_name:
                    ot_sheet_name = wb.sheetnames[0]
                ws = wb[ot_sheet_name]
                col_idx = 5 if unidad.upper() == 'MAESTROS' else 4
                from collections import Counter
                meses_counter = Counter()
                anios_counter = Counter()
                for row in ws.iter_rows(min_row=3, max_row=100, values_only=True):
                    if len(row) >= col_idx:
                        val = row[col_idx - 1]
                        if val and hasattr(val, 'month'):
                            meses_counter[val.month] += 1
                            anios_counter[val.year] += 1
                if meses_counter and not mes_detectado:
                    mes_detectado = MESES_INV.get(meses_counter.most_common(1)[0][0])
                if anios_counter and not anio_detectado:
                    anio_detectado = str(int(anios_counter.most_common(1)[0][0]))
                wb.close()
            except Exception as e:
                print(f"Error detectando fechas: {e}")

        if not anio_detectado:
            anio_detectado = '2026'
        return anio_detectado, mes_detectado

    def handle_actualizar_tramite(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "Empty request")
                return
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            unidad = data.get('unidad_negocio')
            ot = data.get('ot')
            if not unidad or not ot:
                self.send_error(400, "Missing required fields")
                return
            import dashboard_updater
            output_seg = os.path.join(BASE_DIR, "seguimiento_data.js")
            seg_data = dashboard_updater.load_existing_json(output_seg, 'PRELOADED_SEGUIMIENTO')
            updated = False
            for t in seg_data:
                if t.get('unidad_negocio') == unidad and t.get('ot') == ot:
                    for field in ('estado', 'fecha_estimada', 'notas', 'no_caso_portal', 'fecha_cierre_portal'):
                        if field in data:
                            t[field] = data[field]
                    if 'monto_mano_obra' in data:
                        try:
                            t['monto_mano_obra'] = float(data['monto_mano_obra'])
                        except Exception:
                            t['monto_mano_obra'] = 0
                    updated = True
                    break
            if updated:
                dashboard_updater.save_json(output_seg, 'PRELOADED_SEGUIMIENTO', seg_data, "Seguimiento", "SEGUIMIENTO_META")
                subprocess.run(["git", "add", "seguimiento_data.js"], cwd=BASE_DIR, check=False)
                status = subprocess.run(["git", "status", "--porcelain"], cwd=BASE_DIR, capture_output=True, text=True)
                if status.stdout.strip():
                    subprocess.run(["git", "commit", "-m", f"Update tracking OT {ot}"], cwd=BASE_DIR, check=False)
                    subprocess.run(["git", "push", "origin", "HEAD:master"], cwd=BASE_DIR, check=False)
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True}).encode())
            else:
                self.send_error(404, "OT Not Found")
        except Exception as ex:
            print(f"Error en actualizar_tramite: {ex}")
            self.send_error(500, str(ex))


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8001))
    httpd = ThreadingHTTPServer(('0.0.0.0', port), DashboardServer)
    print(f"Servidor ejecutándose en puerto {port}...")
    httpd.serve_forever()
