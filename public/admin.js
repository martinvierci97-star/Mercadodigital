// ─── Login ────────────────────────────────────────────────────────────────────
const ADMIN_PASS = 'admin123';

function checkLogin() {
  const pass = document.getElementById('admin-pass').value;
  if (pass === ADMIN_PASS) {
    sessionStorage.setItem('admin_auth', '1');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = '';
    initAdmin();
  } else {
    document.getElementById('login-error').classList.remove('hidden');
  }
}

function logout() {
  sessionStorage.removeItem('admin_auth');
  location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
  // Enter key en contraseña
  document.getElementById('admin-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkLogin();
  });

  // Si ya estaba autenticado en esta sesión
  if (sessionStorage.getItem('admin_auth') === '1') {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-panel').style.display = '';
    initAdmin();
  }
});

// ─── Init Admin ───────────────────────────────────────────────────────────────
function initAdmin() {
  // Fecha por defecto: hoy
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-date').value = today;

  loadSellers();
  applyFilters();
}

// ─── Vendedores para el filtro ────────────────────────────────────────────────
async function loadSellers() {
  try {
    const res = await fetch('/api/sellers');
    const sellers = await res.json();
    const sel = document.getElementById('f-seller');
    sellers.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  } catch (e) { /* silencioso */ }
}

// ─── Filtros ──────────────────────────────────────────────────────────────────
function buildQuery() {
  const date   = document.getElementById('f-date').value;
  const from   = document.getElementById('f-from').value;
  const to     = document.getElementById('f-to').value;
  const seller = document.getElementById('f-seller').value;

  const params = new URLSearchParams();
  if (date)   params.append('date', date);
  else {
    if (from) params.append('from', from);
    if (to)   params.append('to', to);
  }
  if (seller) params.append('seller', seller);
  return params.toString();
}

function applyFilters() {
  const q = buildQuery();
  loadSummary(q);
  loadRecords(q);
}

function clearFilters() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('f-date').value = today;
  document.getElementById('f-from').value = '';
  document.getElementById('f-to').value = '';
  document.getElementById('f-seller').value = '';
  applyFilters();
}

// ─── Resumen ──────────────────────────────────────────────────────────────────
async function loadSummary(q) {
  try {
    const res = await fetch('/api/records/summary?' + q);
    const s = await res.json();

    document.getElementById('sum-total').textContent   = s.total ?? 0;
    document.getElementById('sum-proceso').textContent = s.en_proceso ?? 0;
    document.getElementById('sum-cerrado').textContent = s.cerrados ?? 0;
    document.getElementById('sum-caido').textContent   = s.caidos ?? 0;
    document.getElementById('sum-ticket').textContent  = formatMoney(s.total_ticket ?? 0);
    document.getElementById('sum-msgs').textContent    = s.total_messages ?? 0;
  } catch (e) { /* silencioso */ }
}

// ─── Tabla de registros ───────────────────────────────────────────────────────
async function loadRecords(q) {
  const tbody = document.getElementById('records-body');
  tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="icon">⏳</div><p>Cargando...</p></div></td></tr>';

  try {
    const res = await fetch('/api/records?' + q);
    const records = await res.json();

    document.getElementById('records-count').textContent =
      records.length > 0 ? `Mostrando ${records.length} registro${records.length !== 1 ? 's' : ''}` : '';

    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="icon">📭</div><p>No hay registros para los filtros seleccionados.</p></div></td></tr>';
      return;
    }

    tbody.innerHTML = records.map((r, i) => {
      const badgeClass = r.chat_status === 'En proceso'
        ? 'badge-process'
        : r.chat_status === 'Cerrado (venta exitosa)'
        ? 'badge-success'
        : 'badge-fallen';

      const motivoText = r.fall_reason
        ? (r.fall_reason === 'Otro' && r.fall_reason_other
            ? `Otro: ${r.fall_reason_other}`
            : r.fall_reason)
        : '–';

      const hora = r.created_at ? r.created_at.split(' ')[1]?.substring(0,5) : '–';

      return `
        <tr>
          <td style="color:var(--gray-600);font-size:12px">${r.id}</td>
          <td>${r.date}</td>
          <td>${hora}</td>
          <td><strong>${escHtml(r.seller_name)}</strong></td>
          <td style="text-align:center">${r.messages_sent}</td>
          <td><span class="badge ${badgeClass}">${r.chat_status}</span></td>
          <td style="font-size:12px;color:var(--gray-600)">${escHtml(motivoText)}</td>
          <td style="font-size:12px">${r.products_names ? escHtml(r.products_names) : '–'}</td>
          <td>${r.ticket_amount ? formatMoney(r.ticket_amount) : '–'}</td>
          <td style="font-size:12px;color:var(--gray-600)">${r.observations ? escHtml(r.observations) : '–'}</td>
        </tr>`;
    }).join('');
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><div class="icon">⚠️</div><p>Error al cargar los registros.</p></div></td></tr>';
  }
}

// ─── Exportar Excel ───────────────────────────────────────────────────────────
function exportExcel() {
  const q = buildQuery();
  window.location.href = '/api/records/export?' + q;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatMoney(n) {
  return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
