// ─── Utilidades ──────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function showAlert(msg, type = 'error') {
  const box = document.getElementById('alert-box');
  box.className = `alert alert-${type}`;
  box.innerHTML = (type === 'error' ? '⚠️ ' : '✅ ') + msg;
  box.classList.remove('hidden');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (type === 'success') {
    setTimeout(() => box.classList.add('hidden'), 5000);
  }
}

function hideAlert() {
  document.getElementById('alert-box').classList.add('hidden');
}

// ─── Cargar productos ─────────────────────────────────────────────────────────
async function loadProducts() {
  const container = document.getElementById('product-list');
  try {
    const res = await fetch('/api/products');
    const products = await res.json();

    if (!products.length) {
      container.innerHTML = '<span style="color:var(--gray-600);font-size:13px;grid-column:1/-1">No hay productos cargados aún. <a href="products.html">Agregar productos</a></span>';
      return;
    }

    container.innerHTML = products.map(p => `
      <label>
        <input type="checkbox" name="product_ids" value="${p.id}">
        ${p.name}${p.category ? ' <small style="color:var(--gray-600);">(${p.category})</small>' : ''}
      </label>
    `).join('');
  } catch (e) {
    container.innerHTML = '<span style="color:var(--red);font-size:13px;grid-column:1/-1">Error al cargar productos.</span>';
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Fecha por defecto: hoy
  const dateInput = document.getElementById('date');
  dateInput.value = todayISO();

  // Restaurar nombre del vendedor
  const savedName = localStorage.getItem('seller_name') || '';
  const nameInput = document.getElementById('seller-name');
  nameInput.value = savedName;
  nameInput.addEventListener('change', () => {
    localStorage.setItem('seller_name', nameInput.value.trim());
  });

  loadProducts();

  // Mostrar/ocultar motivo venta caída
  const chatStatus = document.getElementById('chat-status');
  const fallGroup  = document.getElementById('fall-reason-group');
  const fallReason = document.getElementById('fall-reason');
  const fallOtherGroup = document.getElementById('fall-other-group');

  chatStatus.addEventListener('change', () => {
    const isFallen = chatStatus.value === 'Venta caída';
    fallGroup.style.display = isFallen ? '' : 'none';
    if (!isFallen) {
      fallReason.value = '';
      fallOtherGroup.style.display = 'none';
      document.getElementById('fall-other').value = '';
    }
  });

  fallReason.addEventListener('change', () => {
    fallOtherGroup.style.display = fallReason.value === 'Otro' ? '' : 'none';
    if (fallReason.value !== 'Otro') document.getElementById('fall-other').value = '';
  });

  // Submit
  document.getElementById('sale-form').addEventListener('submit', submitForm);
});

// ─── Enviar formulario ────────────────────────────────────────────────────────
async function submitForm(e) {
  e.preventDefault();
  hideAlert();

  const sellerName = document.getElementById('seller-name').value.trim();
  const date = document.getElementById('date').value;
  const messagesSent = document.getElementById('messages-sent').value;
  const chatStatus = document.getElementById('chat-status').value;
  const fallReason = document.getElementById('fall-reason').value;
  const fallOther = document.getElementById('fall-other').value.trim();
  const ticketAmount = document.getElementById('ticket-amount').value;
  const observations = document.getElementById('observations').value.trim();

  // Validaciones cliente
  if (!sellerName) return showAlert('Por favor ingresá tu nombre.');
  if (!date) return showAlert('La fecha es obligatoria.');
  if (!messagesSent || parseInt(messagesSent) < 0) return showAlert('Ingresá la cantidad de mensajes enviados.');
  if (!chatStatus) return showAlert('Seleccioná el estado del chat.');
  if (chatStatus === 'Venta caída' && !fallReason) return showAlert('Seleccioná el motivo de venta caída.');
  if (fallReason === 'Otro' && !fallOther) return showAlert('Especificá el motivo en el campo "Otro".');

  const productIds = Array.from(
    document.querySelectorAll('input[name="product_ids"]:checked')
  ).map(cb => cb.value);

  const body = {
    seller_name: sellerName,
    date,
    messages_sent: parseInt(messagesSent),
    chat_status: chatStatus,
    fall_reason: fallReason || null,
    fall_reason_other: fallOther || null,
    product_ids: productIds,
    ticket_amount: ticketAmount ? parseFloat(ticketAmount) : 0,
    observations: observations || null
  };

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  try {
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Error al guardar el registro.');
    } else {
      showAlert('Registro guardado correctamente.', 'success');
      resetForm();
      localStorage.setItem('seller_name', sellerName);
    }
  } catch (err) {
    showAlert('Error de conexión. Verificá que el servidor esté corriendo.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Guardar registro';
  }
}

function resetForm() {
  document.getElementById('messages-sent').value = '';
  document.getElementById('chat-status').value = '';
  document.getElementById('fall-reason').value = '';
  document.getElementById('fall-other').value = '';
  document.getElementById('ticket-amount').value = '';
  document.getElementById('observations').value = '';
  document.getElementById('fall-reason-group').style.display = 'none';
  document.getElementById('fall-other-group').style.display = 'none';
  // Limpiar checkboxes
  document.querySelectorAll('input[name="product_ids"]').forEach(cb => cb.checked = false);
  // Restaurar fecha
  document.getElementById('date').value = todayISO();
}
