import os
import json
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import pandas as pd
import datetime

# Directorio base del proyecto (una carpeta arriba de Dashboard Garantias)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OT_BASE_DIR = os.environ.get('OT_BASE_DIR', os.path.abspath(os.path.join(BASE_DIR, "..", "OT")))

MESES_MAP = {
    1: 'ENERO', 2: 'FEBRERO', 3: 'MARZO', 4: 'ABRIL',
    5: 'MAYO', 6: 'JUNIO', 7: 'JULIO', 8: 'AGOSTO',
    9: 'SEPTIEMBRE', 10: 'OCTUBRE', 11: 'NOVIEMBRE', 12: 'DICIEMBRE'
}

# Variable global para el estado
is_processing = False

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
        else:
            self.send_error(404, "Not Found")

    def handle_upload(self):
        try:
            content_type = self.headers.get('Content-Type')
            if not content_type or 'multipart/form-data' not in content_type:
                self.send_error(400, "Bad Request")
                return

            import re
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "Empty request")
                return
                
            body = self.rfile.read(content_length)
            content_type = self.headers.get('Content-Type', '')
            if 'boundary=' not in content_type:
                self.send_error(400, "No boundary in Content-Type")
                return
                
            boundary = content_type.split('boundary=')[1].encode()
            parts = body.split(b'--' + boundary)
            
            file_data = None
            filename = None
            overwrite = False
            unidad = 'CS'
            
            for part in parts:
                if b'Content-Disposition: form-data;' in part:
                    try:
                        header, pbody = part.split(b'\r\n\r\n', 1)
                    except ValueError:
                        continue
                        
                    if pbody.endswith(b'\r\n'):
                        pbody = pbody[:-2]
                    name_match = re.search(br'name="([^"]+)"', header)
                    if not name_match: 
                        continue
                    name = name_match.group(1).decode('utf-8', 'ignore')
                    
                    if name == 'file':
                        filename_match = re.search(br'filename="([^"]+)"', header)
                        if filename_match:
                            filename = os.path.basename(filename_match.group(1).decode('utf-8', 'ignore'))
                            file_data = pbody
                    elif name == 'overwrite':
                        overwrite = pbody.decode('utf-8', 'ignore').strip().lower() == 'true'
                    elif name == 'unidad_negocio':
                        unidad = pbody.decode('utf-8', 'ignore').strip().upper()
                        
            if not file_data or not filename:
                self.send_error(400, "No file provided")
                return

            # Detectar mes (temporalmente guardamos para leer)
            temp_path = os.path.join(BASE_DIR, "temp_upload.xlsx")
            with open(temp_path, "wb") as f:
                f.write(file_data)

            anio_str, mes_nombre = self.detect_date_info(temp_path, filename)
            
            if not mes_nombre:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No se pudo determinar el mes del archivo'}).encode())
                return

            if unidad not in ['CS', 'MAESTROS']:
                unidad = 'CS'

            target_dir = os.path.join(OT_BASE_DIR, unidad, anio_str, mes_nombre)
            os.makedirs(target_dir, exist_ok=True)
            target_path = os.path.join(target_dir, filename)

            # Verificar si existe y no hay overwrite
            if os.path.exists(target_path) and not overwrite:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                self.send_response(409) # Conflict
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'El archivo ya existe.', 'mes': mes_nombre}).encode())
                return

            # Mover temporal a destino
            if os.path.exists(target_path):
                os.remove(target_path)
            os.rename(temp_path, target_path)

            print(f"Archivo guardado: {target_path}")

            # Ejecutar actualización en segundo plano
            global is_processing
            is_processing = True

            def run_updater(path, u, a, m, m_num):
                global is_processing
                try:
                    import dashboard_updater
                    print(f"Ejecutando actualización incremental para {u} {m} {a}...")
                    dashboard_updater.process_single_file(path, u, a, m, m_num)
                    print("Actualización completada en bases de datos.")
                    
                    # Sincronización con GitHub
                    print("Sincronizando con GitHub...")
                    # Solo commiteamos los .js
                    subprocess.run(["git", "add", "data.js", "servicio_data.js", "parts_data.js", "api_cache.json"], cwd=BASE_DIR, check=False)
                    
                    # Verificamos si hay cambios
                    status = subprocess.run(["git", "status", "--porcelain"], cwd=BASE_DIR, capture_output=True, text=True)
                    if status.stdout.strip():
                        commit_msg = f"Update data from web upload: {u} {m} {a}"
                        subprocess.run(["git", "commit", "-m", commit_msg], cwd=BASE_DIR, check=False)
                        # Push (requiere que el origin este configurado correctamente con credenciales o token)
                        push_res = subprocess.run(["git", "push", "origin", "HEAD:main"], cwd=BASE_DIR, capture_output=True, text=True)
                        if push_res.returncode == 0:
                            print("GitHub sincronizado exitosamente.")
                        else:
                            print(f"Error en git push: {push_res.stderr}")
                    else:
                        print("No hubo cambios nuevos para subir a GitHub.")
                        
                    # Limpiamos el archivo temporal
                    try:
                        if os.path.exists(path):
                            os.remove(path)
                            print(f"Archivo temporal {path} eliminado.")
                    except Exception as e:
                        print(f"No se pudo borrar temporal {path}: {e}")
                        
                except Exception as e:
                    print(f"Error actualizando datos: {str(e)}")
                    import traceback; traceback.print_exc()
                finally:
                    is_processing = False

            # Invertir el mapeo de MESES_MAP para obtener el numero
            REVERSE_MESES = {v: k for k, v in MESES_MAP.items()}
            import threading
            t = threading.Thread(target=run_updater, args=(target_path, unidad, anio_str, mes_nombre, REVERSE_MESES.get(mes_nombre, 0)))
            t.daemon = True
            t.start()
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'success': True, 'mes': mes_nombre}).encode())

        except Exception as ex:
            print(f"Server error during upload: {ex}")
            try:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': f'Server error: {str(ex)}'}).encode())
            except:
                pass

    def detect_date_info(self, filepath, filename):
        import re
        mes_detectado = None
        anio_detectado = None

        # 1. Intentar deducir del nombre del archivo
        filename_upper = filename.upper()
        for mes in MESES_MAP.values():
            if mes in filename_upper:
                mes_detectado = mes
                break
        
        # Buscar año en el nombre del archivo (ej. 2025, 2026)
        match_year = re.search(r'(20\d{2})', filename_upper)
        if match_year:
            anio_detectado = match_year.group(1)
                
        # 2. Si falta algo, leer el Excel
        if not mes_detectado or not anio_detectado:
            try:
                df = pd.read_excel(filepath, sheet_name='OT', header=2)
                if 'FECHA Y HR DE INGRESO' in df.columns:
                    fechas = pd.to_datetime(df['FECHA Y HR DE INGRESO'], errors='coerce').dropna()
                    if not fechas.empty:
                        if not mes_detectado:
                            most_frequent_month = fechas.dt.month.mode()[0]
                            mes_detectado = MESES_MAP.get(most_frequent_month)
                        if not anio_detectado:
                            most_frequent_year = fechas.dt.year.mode()[0]
                            anio_detectado = str(int(most_frequent_year))
            except Exception as e:
                print(f"Error detectando fechas: {e}")
        
        # Fallback a 2026 si no pudo detectar el año
        if not anio_detectado:
            anio_detectado = "2026"
            
        return anio_detectado, mes_detectado

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8001))
    server_address = ('0.0.0.0', port)
    httpd = ThreadingHTTPServer(server_address, DashboardServer)
    print(f"Servidor backend ejecutándose en el puerto {port}...")
    httpd.serve_forever()
