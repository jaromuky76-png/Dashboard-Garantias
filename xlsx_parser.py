import zipfile
import xml.etree.ElementTree as ET
import re
import datetime

def excel_date_to_datetime(serial_num):
    try:
        serial_num = float(serial_num)
        if serial_num < 60:
            start_date = datetime.datetime(1899, 12, 31)
        else:
            start_date = datetime.datetime(1899, 12, 30)
        return start_date + datetime.timedelta(days=serial_num)
    except:
        return None

def fmt_excel_val(val, is_date=False):
    if val is None or val == "":
        return ""
    if is_date:
        dt = excel_date_to_datetime(val)
        if dt:
            return dt.strftime('%Y-%m-%d %H:%M')
    try:
        f = float(val)
        if f.is_integer():
            return str(int(f))
        return str(f)
    except:
        return str(val)

def get_xlsx_sheet_names(filepath):
    try:
        with zipfile.ZipFile(filepath, 'r') as z:
            workbook_xml = z.read("xl/workbook.xml").decode("utf-8")
            return re.findall(r'<sheet name="([^"]+)"', workbook_xml)
    except Exception as e:
        print(f"Error reading sheet names from ZIP: {e}")
        return []

def get_sheet_file_path(zip_file, sheet_name):
    workbook_xml = zip_file.read("xl/workbook.xml").decode("utf-8")
    sheet_match = re.search(rf'<sheet name="{re.escape(sheet_name)}"[^>]*r:id="([^"]+)"', workbook_xml)
    if not sheet_match:
        sheet_match = re.search(rf'<sheet name="[^"]*?{re.escape(sheet_name.strip())}[^"]*?"[^>]*r:id="([^"]+)"', workbook_xml, re.IGNORECASE)
    if not sheet_match:
        sheet_match = re.search(r'<sheet [^>]*r:id="([^"]+)"', workbook_xml)
    if not sheet_match:
        return None
    r_id = sheet_match.group(1)
    
    rels_xml = zip_file.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    rel_match = re.search(rf'<Relationship Id="{re.escape(r_id)}"[^>]*Target="([^"]+)"', rels_xml)
    if not rel_match:
        return None
    target = rel_match.group(1)
    if not target.startswith("xl/"):
        target = "xl/" + target
    return target

def parse_shared_strings(zip_file):
    shared_strings = []
    try:
        f = zip_file.open("xl/sharedStrings.xml")
        current_str = []
        for event, elem in ET.iterparse(f, events=('start', 'end')):
            if event == 'start' and elem.tag.endswith('si'):
                current_str = []
            elif event == 'end' and elem.tag.endswith('t'):
                current_str.append(elem.text or '')
            elif event == 'end' and elem.tag.endswith('si'):
                shared_strings.append("".join(current_str))
                elem.clear()
        f.close()
    except KeyError:
        pass
    return shared_strings

def read_xlsx_rows_smart(filepath, sheet_name):
    """
    Yields rows from the given sheet in the Excel file.
    The first yielded value is (row_list, header_map) for the header row.
    Subsequent yielded values are (row_list, None) for date-formatted data rows.
    Uses constant memory by streaming XML and clearing elements.
    """
    with zipfile.ZipFile(filepath, 'r') as z:
        sheet_path = get_sheet_file_path(z, sheet_name)
        if not sheet_path:
            raise ValueError(f"Sheet {sheet_name} not found in Excel file.")
            
        shared_strings = parse_shared_strings(z)
        
        f = z.open(sheet_path)
        row_data = {}
        ot_headers = None
        date_cols = set()
        
        for event, elem in ET.iterparse(f, events=('start', 'end')):
            if event == 'start' and elem.tag.endswith('row'):
                row_data = {}
            elif event == 'end' and elem.tag.endswith('c'):
                r = elem.get('r', '')
                t = elem.get('t', '')
                val_elem = elem.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                if val_elem is None:
                    val_elem = elem.find('v')
                
                val = ""
                if val_elem is not None:
                    val = val_elem.text or ""
                    if t == 's':
                        try:
                            idx = int(val)
                            val = shared_strings[idx] if idx < len(shared_strings) else ""
                        except (ValueError, TypeError):
                            val = ""
                    elif t == 'b':
                        val = (val == '1')
                
                col_letters = re.match(r'^([A-Z]+)', r)
                if col_letters:
                    col_str = col_letters.group(1)
                    col_idx = 0
                    for char in col_str:
                        col_idx = col_idx * 26 + (ord(char) - ord('A') + 1)
                    col_num = col_idx - 1
                    row_data[col_num] = val
                elem.clear()
                
            elif event == 'end' and elem.tag.endswith('row'):
                if row_data:
                    max_idx = max(row_data.keys())
                    row_list = [row_data.get(i, "") for i in range(max_idx + 1)]
                    
                    if not ot_headers:
                        if any(v and (str(v).strip().upper() == 'MARCA' or 'TIPO DE GARANTIA' in str(v).upper() or 'ACTIVIDAD' in str(v).upper()) for v in row_list if v):
                            ot_headers = row_list
                            h = {str(v).strip().upper(): idx for idx, v in enumerate(ot_headers) if v}
                            for k, idx in h.items():
                                if any(x in k for x in ("FECHA", "INGRESO", "CREACION", "INICIO", "ENTREGA", "CIERRE", "FACT")):
                                    date_cols.add(idx)
                            yield row_list, h
                    else:
                        formatted_row = []
                        for idx, val in enumerate(row_list):
                            is_dt = (idx in date_cols)
                            formatted_row.append(fmt_excel_val(val, is_date=is_dt))
                        yield formatted_row, None
                        
                elem.clear()
        f.close()
