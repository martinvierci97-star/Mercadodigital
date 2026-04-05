// ─── Alertas ──────────────────────────────────────────────────────────────────
function showAlert(msg, type = 'error') {
  const box = document.getElementById('alert-box');
  box.className = `alert alert-${type}`;
  box.innerHTML = (type === 'error' ? '⚠️ ' : type === 'success' ? '✅ ' : 'ℹ️ ') + msg;
  box.classList.remove('hidden');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (type !== 'error') setTimeout(() => box.classList.add('hidden'), 5000);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Cargar productos ─────────────────────────────────────────────────────────
async function loadProducts() {
  const showInactive = document.getElementById('show-inactive').checked;
  const tbody = document.getElementById('products-body');

  try {
    const res = await fetch('/api/products?all=' + showInactive);
    const products = await res.json();

    document.getElementById('products-count').textContent =
      `${products.length} producto${products.length !== 1 ? 's' : ''}`;

    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="icon">📦</div><p>No hay productos cargados todavía.</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr style="${p.active ? '' : 'opacity:.5'}">
        <td style="color:var(--gray-600);font-size:12px">${p.id}</td>
        <td><strong>${escHtml(p.name)}</strong></td>
        <td style="color:var(--gray-600)">${escHtml(p.category) || '–'}</td>
        <td>${p.price ? '$' + Number(p.price).toLocaleString('es-AR') : '–'}</td>
        <td>
          <span class="badge ${p.active ? 'badge-success' : 'badge-fallen'}">
            ${p.active ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" onclick="openEdit(${p.id},'${escHtml(p.name)}','${escHtml(p.category)}',${p.price},${p.active})">
              ✏️ Editar
            </button>
            ${p.active
              ? `<button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})">🗑️ Desactivar</button>`
              : `<button class="btn btn-success btn-sm" onclick="reactivateProduct(${p.id})">♻️ Activar</button>`
            }
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar productos.</p></div></td></tr>';
  }
}

// ─── Agregar producto ─────────────────────────────────────────────────────────
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name     = document.getElementById('p-name').value.trim();
  const category = document.getElementById('p-category').value.trim();
  const price    = document.getElementById('p-price').value;

  if (!name) return showAlert('El nombre del producto es obligatorio.');

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, price: parseFloat(price) || 0 })
    });
    const data = await res.json();
    if (!res.ok) return showAlert(data.error || 'Error al agregar el producto.');

    showAlert('Producto agregado correctamente.', 'success');
    document.getElementById('p-name').value = '';
    document.getElementById('p-category').value = '';
    document.getElementById('p-price').value = '';
    loadProducts();
  } catch (err) {
    showAlert('Error de conexión.');
  }
});

// ─── Importar CSV ─────────────────────────────────────────────────────────────
document.getElementById('csv-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = document.getElementById('csv-file').files[0];
  if (!file) return showAlert('Seleccioná un archivo CSV.');

  const formData = new FormData();
  formData.append('csv', file);

  try {
    const res = await fetch('/api/products/import', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) return showAlert(data.error || 'Error al importar.');

    showAlert(`Se importaron ${data.imported} producto${data.imported !== 1 ? 's' : ''} correctamente.`, 'success');
    document.getElementById('csv-file').value = '';
    loadProducts();
  } catch (err) {
    showAlert('Error de conexión.');
  }
});

// ─── Editar producto ──────────────────────────────────────────────────────────
function openEdit(id, name, category, price, active) {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-name').value = name;
  document.getElementById('edit-category').value = category;
  document.getElementById('edit-price').value = price;
  document.getElementById('edit-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('edit-modal').classList.remove('open');
}

async function saveEdit() {
  const id       = document.getElementById('edit-id').value;
  const name     = document.getElementById('edit-name').value.trim();
  const category = document.getElementById('edit-category').value.trim();
  const price    = document.getElementById('edit-price').value;

  if (!name) return showAlert('El nombre es obligatorio.');

  try {
    const res = await fetch('/api/products/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, price: parseFloat(price) || 0, active: 1 })
    });
    const data = await res.json();
    if (!res.ok) return showAlert(data.error || 'Error al guardar.');

    showAlert('Producto actualizado.', 'success');
    closeModal();
    loadProducts();
  } catch (err) {
    showAlert('Error de conexión.');
  }
}

// Cerrar modal al hacer click fuera
document.getElementById('edit-modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ─── Desactivar / Activar producto ───────────────────────────────────────────
async function deleteProduct(id) {
  if (!confirm('¿Desactivar este producto? No se eliminará de los registros existentes.')) return;
  try {
    await fetch('/api/products/' + id, { method: 'DELETE' });
    loadProducts();
  } catch (e) {
    showAlert('Error al desactivar el producto.');
  }
}

async function reactivateProduct(id) {
  try {
    await fetch('/api/products/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: 1, name: '_placeholder_' })
    });
    // Re-fetch to get real data
    const res = await fetch('/api/products?all=true');
    const products = await res.json();
    const p = products.find(x => x.id == id);
    if (p) {
      await fetch('/api/products/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: p.name, category: p.category, price: p.price, active: 1 })
      });
    }
    loadProducts();
  } catch (e) {
    showAlert('Error al reactivar el producto.');
  }
}

// ─── CSV de ejemplo ───────────────────────────────────────────────────────────
function downloadSample() {
  const csv = 'nombre,categoria,precio\nCamiseta deportiva,Ropa,2500\nZapatillas running,Calzado,15000\nMochila urbana,Accesorios,8500\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'productos_ejemplo.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  document.getElementById('show-inactive').addEventListener('change', loadProducts);
});
