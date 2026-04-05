const express = require('express');
const Database = require('better-sqlite3');
const multer = require('multer');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer para upload de CSV
const upload = multer({ dest: path.join(__dirname, 'database', 'uploads') });

// Base de datos
const dbPath = path.join(__dirname, 'database', 'ventas.db');
const db = new Database(dbPath);

// Activar foreign keys y WAL mode
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// ─── Crear tablas ─────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL,
    category  TEXT    NOT NULL DEFAULT '',
    price     REAL    NOT NULL DEFAULT 0,
    active    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT   NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_name     TEXT    NOT NULL,
    date            TEXT    NOT NULL,
    messages_sent   INTEGER NOT NULL DEFAULT 0,
    chat_status     TEXT    NOT NULL,
    fall_reason     TEXT,
    fall_reason_other TEXT,
    ticket_amount   REAL    NOT NULL DEFAULT 0,
    observations    TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS record_products (
    record_id  INTEGER NOT NULL REFERENCES records(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    PRIMARY KEY (record_id, product_id)
  );
`);

// ─── RUTAS DE PRODUCTOS ───────────────────────────────────────────────────────

// Listar productos activos
app.get('/api/products', (req, res) => {
  const includeInactive = req.query.all === 'true';
  const rows = includeInactive
    ? db.prepare('SELECT * FROM products ORDER BY category, name').all()
    : db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY category, name').all();
  res.json(rows);
});

// Crear producto
app.post('/api/products', (req, res) => {
  const { name, category, price } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  }
  const stmt = db.prepare('INSERT INTO products (name, category, price) VALUES (?, ?, ?)');
  const info = stmt.run(name.trim(), (category || '').trim(), parseFloat(price) || 0);
  res.json({ id: info.lastInsertRowid, name, category, price });
});

// Actualizar producto
app.put('/api/products/:id', (req, res) => {
  const { name, category, price, active } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  }
  const stmt = db.prepare(
    'UPDATE products SET name = ?, category = ?, price = ?, active = ? WHERE id = ?'
  );
  stmt.run(
    name.trim(),
    (category || '').trim(),
    parseFloat(price) || 0,
    active !== undefined ? (active ? 1 : 0) : 1,
    req.params.id
  );
  res.json({ ok: true });
});

// Eliminar producto
app.delete('/api/products/:id', (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Importar CSV de productos
app.post('/api/products/import', upload.single('csv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo.' });

  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    const lines = fileContent.split(/\r?\n/).filter(l => l.trim() !== '');

    if (lines.length < 2) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'El archivo CSV debe tener encabezado y al menos una fila.' });
    }

    // Detectar separador (coma o punto y coma)
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    const nameIdx     = headers.findIndex(h => h === 'nombre' || h === 'name');
    const categoryIdx = headers.findIndex(h => h === 'categoria' || h === 'categoría' || h === 'category');
    const priceIdx    = headers.findIndex(h => h === 'precio' || h === 'price');

    if (nameIdx === -1) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'El CSV debe tener una columna "nombre" o "name".' });
    }

    const insert = db.prepare('INSERT INTO products (name, category, price) VALUES (?, ?, ?)');
    const importMany = db.transaction((rows) => {
      let count = 0;
      for (const row of rows) {
        const parts = row.split(sep).map(p => p.trim().replace(/"/g, ''));
        const name = parts[nameIdx] || '';
        if (!name) continue;
        const category = categoryIdx >= 0 ? (parts[categoryIdx] || '') : '';
        const price = priceIdx >= 0 ? (parseFloat(parts[priceIdx]) || 0) : 0;
        insert.run(name, category, price);
        count++;
      }
      return count;
    });

    const count = importMany(lines.slice(1));
    fs.unlinkSync(req.file.path);
    res.json({ ok: true, imported: count });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Error al procesar el CSV: ' + err.message });
  }
});

// ─── RUTAS DE REGISTROS ───────────────────────────────────────────────────────

// Crear registro
app.post('/api/records', (req, res) => {
  const {
    seller_name, date, messages_sent, chat_status,
    fall_reason, fall_reason_other, product_ids,
    ticket_amount, observations
  } = req.body;

  if (!seller_name || seller_name.trim() === '') {
    return res.status(400).json({ error: 'El nombre del vendedor es obligatorio.' });
  }
  if (!chat_status) {
    return res.status(400).json({ error: 'El estado del chat es obligatorio.' });
  }
  if (chat_status === 'Venta caída' && !fall_reason) {
    return res.status(400).json({ error: 'El motivo de venta caída es obligatorio.' });
  }
  if (fall_reason === 'Otro' && (!fall_reason_other || fall_reason_other.trim() === '')) {
    return res.status(400).json({ error: 'Debe especificar el motivo en el campo "Otro".' });
  }

  const recordDate = date || new Date().toISOString().split('T')[0];

  const insertRecord = db.prepare(`
    INSERT INTO records (seller_name, date, messages_sent, chat_status, fall_reason, fall_reason_other, ticket_amount, observations)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertProduct = db.prepare('INSERT INTO record_products (record_id, product_id) VALUES (?, ?)');

  const create = db.transaction(() => {
    const info = insertRecord.run(
      seller_name.trim(),
      recordDate,
      parseInt(messages_sent) || 0,
      chat_status,
      fall_reason || null,
      fall_reason_other || null,
      parseFloat(ticket_amount) || 0,
      observations || null
    );
    const recordId = info.lastInsertRowid;

    const ids = Array.isArray(product_ids) ? product_ids : (product_ids ? [product_ids] : []);
    for (const pid of ids) {
      insertProduct.run(recordId, parseInt(pid));
    }
    return recordId;
  });

  const recordId = create();
  res.json({ ok: true, id: recordId });
});

// Listar registros con filtros
app.get('/api/records', (req, res) => {
  const { date, seller, from, to } = req.query;

  let where = [];
  let params = [];

  if (date) {
    where.push('r.date = ?');
    params.push(date);
  } else {
    if (from) { where.push('r.date >= ?'); params.push(from); }
    if (to)   { where.push('r.date <= ?'); params.push(to); }
  }

  if (seller && seller.trim() !== '') {
    where.push('LOWER(r.seller_name) LIKE ?');
    params.push('%' + seller.trim().toLowerCase() + '%');
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const records = db.prepare(`
    SELECT r.*, GROUP_CONCAT(p.name, ', ') AS products_names
    FROM records r
    LEFT JOIN record_products rp ON rp.record_id = r.id
    LEFT JOIN products p ON p.id = rp.product_id
    ${whereClause}
    GROUP BY r.id
    ORDER BY r.date DESC, r.created_at DESC
  `).all(...params);

  res.json(records);
});

// Totales / resumen
app.get('/api/records/summary', (req, res) => {
  const { date, from, to, seller } = req.query;

  let where = [];
  let params = [];

  if (date) {
    where.push('date = ?');
    params.push(date);
  } else {
    if (from) { where.push('date >= ?'); params.push(from); }
    if (to)   { where.push('date <= ?'); params.push(to); }
  }
  if (seller && seller.trim() !== '') {
    where.push('LOWER(seller_name) LIKE ?');
    params.push('%' + seller.trim().toLowerCase() + '%');
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN chat_status = 'En proceso' THEN 1 ELSE 0 END) AS en_proceso,
      SUM(CASE WHEN chat_status = 'Cerrado (venta exitosa)' THEN 1 ELSE 0 END) AS cerrados,
      SUM(CASE WHEN chat_status = 'Venta caída' THEN 1 ELSE 0 END) AS caidos,
      COALESCE(SUM(ticket_amount), 0) AS total_ticket,
      COALESCE(SUM(messages_sent), 0) AS total_messages
    FROM records ${whereClause}
  `).get(...params);

  res.json(summary);
});

// Lista de vendedores únicos
app.get('/api/sellers', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT seller_name FROM records ORDER BY seller_name').all();
  res.json(rows.map(r => r.seller_name));
});

// Exportar a Excel
app.get('/api/records/export', (req, res) => {
  const { date, from, to, seller } = req.query;

  let where = [];
  let params = [];

  if (date) {
    where.push('r.date = ?');
    params.push(date);
  } else {
    if (from) { where.push('r.date >= ?'); params.push(from); }
    if (to)   { where.push('r.date <= ?'); params.push(to); }
  }
  if (seller && seller.trim() !== '') {
    where.push('LOWER(r.seller_name) LIKE ?');
    params.push('%' + seller.trim().toLowerCase() + '%');
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  const records = db.prepare(`
    SELECT r.id, r.seller_name AS Vendedor, r.date AS Fecha,
           r.messages_sent AS Mensajes, r.chat_status AS Estado,
           COALESCE(r.fall_reason, '') AS Motivo_Caida,
           COALESCE(r.fall_reason_other, '') AS Motivo_Otro,
           GROUP_CONCAT(p.name, ', ') AS Productos,
           r.ticket_amount AS Ticket,
           COALESCE(r.observations, '') AS Observaciones,
           r.created_at AS Registrado_a
    FROM records r
    LEFT JOIN record_products rp ON rp.record_id = r.id
    LEFT JOIN products p ON p.id = rp.product_id
    ${whereClause}
    GROUP BY r.id
    ORDER BY r.date DESC, r.created_at DESC
  `).all(...params);

  const ws = xlsx.utils.json_to_sheet(records.map(r => ({
    ID: r.id,
    Vendedor: r.Vendedor,
    Fecha: r.Fecha,
    'Mensajes enviados': r.Mensajes,
    Estado: r.Estado,
    'Motivo caída': r.Motivo_Caida,
    'Motivo otro': r.Motivo_Otro,
    Productos: r.Productos || '',
    'Ticket ($)': r.Ticket,
    Observaciones: r.Observaciones,
    'Registrado a': r.Registrado_a
  })));

  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Registros');

  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const today = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Disposition', `attachment; filename="ventas-${today}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log(`   Vendedor  → http://localhost:${PORT}/`);
  console.log(`   Admin     → http://localhost:${PORT}/admin.html`);
  console.log(`   Productos → http://localhost:${PORT}/products.html\n`);
});
