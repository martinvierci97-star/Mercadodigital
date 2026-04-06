from flask import Flask, render_template, request, redirect, url_for, flash
import sqlite3
import os
import tempfile
from datetime import date

app = Flask(__name__)
app.secret_key = 'ventas-secret-2024'
DB_PATH = 'ventas.db'


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS productos (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE
        )
    ''')
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
    # Productos de ejemplo — se pueden agregar más desde la app
    c.execute('SELECT COUNT(*) FROM productos')
    if c.fetchone()[0] == 0:
        defaults = [
            'Plan Básico', 'Plan Intermedio', 'Plan Premium',
            'Servicio de Consultoría', 'Soporte Técnico',
            'Publicidad Digital', 'Pack Redes Sociales'
        ]
        c.executemany('INSERT INTO productos (nombre) VALUES (?)', [(p,) for p in defaults])
    conn.commit()
    conn.close()


@app.route('/')
def index():
    conn = get_db()
    productos = conn.execute('SELECT * FROM productos ORDER BY nombre').fetchall()
    conn.close()
    today = date.today().isoformat()
    success = request.args.get('success')
    return render_template('index.html', productos=productos, today=today, success=success)


@app.route('/registrar', methods=['POST'])
def registrar():
    f = request.form

    vendedor         = f.get('vendedor', '').strip()
    cliente_nombre   = f.get('cliente_nombre', '').strip()
    cliente_apellido = f.get('cliente_apellido', '').strip()
    fecha            = f.get('fecha', '').strip()
    estado           = f.get('estado', '').strip()

    # Producto: de la lista o ingresado manualmente
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

    # Validaciones básicas
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

    total       = len(registros)
    cerrados    = sum(1 for r in registros if r['estado'] == 'cerrado')
    en_proceso  = sum(1 for r in registros if r['estado'] == 'proceso')
    caidas      = sum(1 for r in registros if r['estado'] == 'caida')
    total_ventas = sum(r['precio_cierre'] for r in registros if r['precio_cierre'] and r['estado'] == 'cerrado')

    return render_template('resumen.html',
        registros=registros, fecha=fecha,
        total=total, cerrados=cerrados, en_proceso=en_proceso,
        caidas=caidas, total_ventas=total_ventas
    )


@app.route('/productos/agregar', methods=['POST'])
def agregar_producto():
    nombre = request.form.get('nombre', '').strip()
    if nombre:
        conn = get_db()
        try:
            conn.execute('INSERT INTO productos (nombre) VALUES (?)', (nombre,))
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
        return render_template('importar.html', columnas=None, archivo_tmp=None)

    # POST — primer paso: subir archivo y detectar columnas
    if 'paso' not in request.form:
        archivo = request.files.get('archivo')
        if not archivo or not archivo.filename:
            flash('Seleccioná un archivo Excel.', 'danger')
            return redirect(url_for('importar_productos'))

        ext = os.path.splitext(archivo.filename)[1].lower()
        if ext not in ('.xlsx', '.xls', '.csv'):
            flash('Formato no soportado. Usá .xlsx, .xls o .csv', 'danger')
            return redirect(url_for('importar_productos'))

        # Guardar temporalmente
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        archivo.save(tmp.name)
        tmp.close()

        try:
            columnas, _ = _leer_archivo(tmp.name, ext, col=None)
        except Exception as e:
            flash(f'Error al leer el archivo: {e}', 'danger')
            os.unlink(tmp.name)
            return redirect(url_for('importar_productos'))

        return render_template('importar.html', columnas=columnas,
                               archivo_tmp=tmp.name, ext=ext)

    # POST — segundo paso: elegir columna e importar
    archivo_tmp = request.form.get('archivo_tmp', '')
    ext         = request.form.get('ext', '.xlsx')
    col         = request.form.get('columna', '')

    if not archivo_tmp or not os.path.exists(archivo_tmp):
        flash('La sesión expiró. Subí el archivo nuevamente.', 'warning')
        return redirect(url_for('importar_productos'))

    try:
        _, nombres = _leer_archivo(archivo_tmp, ext, col=col)
    except Exception as e:
        flash(f'Error al procesar el archivo: {e}', 'danger')
        return redirect(url_for('importar_productos'))
    finally:
        try:
            os.unlink(archivo_tmp)
        except OSError:
            pass

    conn = get_db()
    agregados = 0
    duplicados = 0
    for nombre in nombres:
        nombre = str(nombre).strip()
        if not nombre or nombre.lower() == 'nan':
            continue
        try:
            conn.execute('INSERT INTO productos (nombre) VALUES (?)', (nombre,))
            agregados += 1
        except sqlite3.IntegrityError:
            duplicados += 1
    conn.commit()
    conn.close()

    msg = f'Se importaron {agregados} productos correctamente.'
    if duplicados:
        msg += f' ({duplicados} ya existían y fueron ignorados.)'
    flash(msg, 'success')
    return redirect(url_for('index'))


def _leer_archivo(path, ext, col):
    """Devuelve (lista_columnas, lista_valores). col=None solo lee cabeceras."""
    if ext == '.csv':
        import csv
        with open(path, newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            columnas = reader.fieldnames or []
            if col is None:
                return columnas, []
            valores = [row[col] for row in reader if col in row]
        return columnas, valores
    else:
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        wb.close()
        if not rows:
            return [], []
        cabecera = [str(c) if c is not None else f'Columna {i+1}' for i, c in enumerate(rows[0])]
        if col is None:
            return cabecera, []
        try:
            idx = cabecera.index(col)
        except ValueError:
            idx = 0
        valores = [row[idx] for row in rows[1:] if row[idx] is not None]
        return cabecera, valores


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
