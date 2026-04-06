from flask import Flask, render_template, request, redirect, url_for, flash, json
import sqlite3
import os
import tempfile
from datetime import date

app = Flask(__name__)
app.secret_key = 'ventas-secret-2024'
DB_PATH = 'ventas.db'

# Mapeo automático: columnas conocidas del Excel del cliente
COL_MAP = {
    'nombre':    ['(P)Nombre', 'Nombre', 'nombre', 'NOMBRE', 'Producto', 'producto'],
    'categoria': ['(P)Categoria', 'Categoria', 'Categoría', 'categoria', 'CATEGORIA'],
    'marca':     ['(P)Marca', 'Marca', 'marca', 'MARCA'],
    'precio':    ['Precio', 'precio', 'PRECIO', 'Price'],
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS productos (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre    TEXT    NOT NULL UNIQUE,
            categoria TEXT,
            marca     TEXT,
            precio    REAL
        )
    ''')
    # Migración: agregar columnas si la tabla ya existía sin ellas
    for col, definition in [('categoria', 'TEXT'), ('marca', 'TEXT'), ('precio', 'REAL')]:
        try:
            c.execute(f'ALTER TABLE productos ADD COLUMN {col} {definition}')
        except sqlite3.OperationalError:
            pass  # columna ya existe

    c.execute('''
        CREATE TABLE IF NOT EXISTS registros (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            vendedor         TEXT    NOT NULL,
            cliente_nombre   TEXT    NOT NULL,
            cliente_apellido TEXT    NOT NULL,
            fecha            DATE    NOT NULL,
            producto         TEXT    NOT NULL,
            estado           TEXT    NOT NULL,
            motivo_caida     TEXT,
            monto_solicitado REAL,
            precio_cierre    REAL,
            created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()


@app.route('/')
def index():
    conn = get_db()
    productos = conn.execute(
        'SELECT id, nombre, categoria, marca, precio FROM productos ORDER BY nombre'
    ).fetchall()
    conn.close()
    # Serializar productos como JSON para que JS pueda auto-completar precio
    productos_json = json.dumps([
        {'id': p['id'], 'nombre': p['nombre'],
         'categoria': p['categoria'] or '', 'marca': p['marca'] or '',
         'precio': p['precio']}
        for p in productos
    ])
    today = date.today().isoformat()
    success = request.args.get('success')
    return render_template('index.html', productos=productos, productos_json=productos_json,
                           today=today, success=success)


@app.route('/registrar', methods=['POST'])
def registrar():
    f = request.form

    vendedor         = f.get('vendedor', '').strip()
    cliente_nombre   = f.get('cliente_nombre', '').strip()
    cliente_apellido = f.get('cliente_apellido', '').strip()
    fecha            = f.get('fecha', '').strip()
    estado           = f.get('estado', '').strip()

    producto_sel    = f.get('producto_sel', '').strip()
    producto_manual = f.get('producto_manual', '').strip()
    if producto_sel == 'otro' or not producto_sel:
        producto = producto_manual
    else:
        conn = get_db()
        row = conn.execute('SELECT nombre FROM productos WHERE id = ?', (producto_sel,)).fetchone()
        conn.close()
        producto = row['nombre'] if row else producto_manual

    motivo_caida = f.get('motivo_caida', '').strip() if estado == 'caida' else None

    monto_raw = f.get('monto_solicitado', '').strip()
    monto_solicitado = float(monto_raw) if monto_raw else None

    precio_raw = f.get('precio_cierre', '').strip()
    precio_cierre = float(precio_raw) if precio_raw else None

    if not all([vendedor, cliente_nombre, cliente_apellido, fecha, producto, estado]):
        flash('Por favor completá todos los campos obligatorios.', 'danger')
        return redirect(url_for('index'))

    conn = get_db()
    conn.execute('''
        INSERT INTO registros
            (vendedor, cliente_nombre, cliente_apellido, fecha, producto,
             estado, motivo_caida, monto_solicitado, precio_cierre)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (vendedor, cliente_nombre, cliente_apellido, fecha, producto,
          estado, motivo_caida, monto_solicitado, precio_cierre))
    conn.commit()
    conn.close()
    return redirect(url_for('index', success=1))


@app.route('/resumen')
def resumen():
    fecha = request.args.get('fecha', date.today().isoformat())
    conn = get_db()
    registros = conn.execute(
        'SELECT * FROM registros WHERE fecha = ? ORDER BY created_at DESC', (fecha,)
    ).fetchall()
    conn.close()

    total        = len(registros)
    cerrados     = sum(1 for r in registros if r['estado'] == 'cerrado')
    en_proceso   = sum(1 for r in registros if r['estado'] == 'proceso')
    caidas       = sum(1 for r in registros if r['estado'] == 'caida')
    total_ventas = sum(r['precio_cierre'] for r in registros
                       if r['precio_cierre'] and r['estado'] == 'cerrado')

    return render_template('resumen.html',
        registros=registros, fecha=fecha,
        total=total, cerrados=cerrados, en_proceso=en_proceso,
        caidas=caidas, total_ventas=total_ventas)


@app.route('/productos/agregar', methods=['POST'])
def agregar_producto():
    nombre    = request.form.get('nombre', '').strip()
    categoria = request.form.get('categoria', '').strip() or None
    marca     = request.form.get('marca', '').strip() or None
    precio_r  = request.form.get('precio', '').strip()
    precio    = float(precio_r) if precio_r else None

    if nombre:
        conn = get_db()
        try:
            conn.execute(
                'INSERT INTO productos (nombre, categoria, marca, precio) VALUES (?, ?, ?, ?)',
                (nombre, categoria, marca, precio)
            )
            conn.commit()
            flash(f'Producto "{nombre}" agregado correctamente.', 'success')
        except sqlite3.IntegrityError:
            flash(f'El producto "{nombre}" ya existe.', 'warning')
        finally:
            conn.close()
    return redirect(url_for('index'))


@app.route('/productos/importar', methods=['GET', 'POST'])
def importar_productos():
    if request.method == 'GET':
        return render_template('importar.html', estado=None)

    archivo = request.files.get('archivo')
    if not archivo or not archivo.filename:
        flash('Seleccioná un archivo Excel.', 'danger')
        return redirect(url_for('importar_productos'))

    ext = os.path.splitext(archivo.filename)[1].lower()
    if ext not in ('.xlsx', '.xls', '.csv'):
        flash('Formato no soportado. Usá .xlsx, .xls o .csv', 'danger')
        return redirect(url_for('importar_productos'))

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    archivo.save(tmp.name)
    tmp.close()

    try:
        filas, cabecera = _leer_excel(tmp.name, ext)
    except Exception as e:
        flash(f'Error al leer el archivo: {e}', 'danger')
        os.unlink(tmp.name)
        return redirect(url_for('importar_productos'))
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass

    # Detectar índices de columnas automáticamente
    def find_col(candidates):
        for candidate in candidates:
            if candidate in cabecera:
                return cabecera.index(candidate)
        return None

    idx = {field: find_col(candidates) for field, candidates in COL_MAP.items()}

    if idx['nombre'] is None:
        flash(
            f'No se encontró la columna de nombre del producto. '
            f'Columnas detectadas: {", ".join(cabecera)}', 'danger'
        )
        return redirect(url_for('importar_productos'))

    conn = get_db()
    agregados = duplicados = omitidos = 0
    for fila in filas:
        nombre = _safe_str(fila, idx['nombre'])
        if not nombre:
            omitidos += 1
            continue
        categoria = _safe_str(fila, idx['categoria'])
        marca     = _safe_str(fila, idx['marca'])
        precio    = _safe_float(fila, idx['precio'])
        try:
            conn.execute(
                'INSERT INTO productos (nombre, categoria, marca, precio) VALUES (?, ?, ?, ?)',
                (nombre, categoria, marca, precio)
            )
            agregados += 1
        except sqlite3.IntegrityError:
            # Actualizar datos extra aunque el nombre ya exista
            conn.execute(
                '''UPDATE productos SET categoria=?, marca=?, precio=?
                   WHERE nombre=? AND (categoria IS NULL OR marca IS NULL OR precio IS NULL)''',
                (categoria, marca, precio, nombre)
            )
            duplicados += 1
    conn.commit()
    conn.close()

    detectados = {k: cabecera[v] for k, v in idx.items() if v is not None}
    msg = f'Importación completada: {agregados} productos nuevos'
    if duplicados:
        msg += f', {duplicados} ya existían (datos actualizados si faltaban)'
    if omitidos:
        msg += f', {omitidos} filas vacías ignoradas'
    flash(msg + '.', 'success')
    return redirect(url_for('index'))


def _leer_excel(path, ext):
    """Devuelve (filas_como_listas, cabecera_lista)."""
    if ext == '.csv':
        import csv
        with open(path, newline='', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            rows = list(reader)
        if not rows:
            return [], []
        return rows[1:], rows[0]
    else:
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        rows = [list(r) for r in ws.iter_rows(values_only=True)]
        wb.close()
        if not rows:
            return [], []
        return rows[1:], [str(c) if c is not None else '' for c in rows[0]]


def _safe_str(fila, idx):
    if idx is None or idx >= len(fila) or fila[idx] is None:
        return None
    val = str(fila[idx]).strip()
    return val if val and val.lower() != 'nan' else None


def _safe_float(fila, idx):
    if idx is None or idx >= len(fila) or fila[idx] is None:
        return None
    try:
        return float(str(fila[idx]).replace(',', '.').strip())
    except (ValueError, TypeError):
        return None


@app.route('/registro/eliminar/<int:registro_id>', methods=['POST'])
def eliminar_registro(registro_id):
    fecha = request.form.get('fecha', date.today().isoformat())
    conn = get_db()
    conn.execute('DELETE FROM registros WHERE id = ?', (registro_id,))
    conn.commit()
    conn.close()
    return redirect(url_for('resumen', fecha=fecha))


if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
