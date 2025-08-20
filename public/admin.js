const $ = (id) => document.getElementById(typeof id === 'string' && id.startsWith('#') ? id.slice(1) : id);
function getCsrf() { return (document.cookie.match(/(?:^|; )csrf_token=([^;]+)/)||[])[1] || ''; }
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = localStorage.getItem('admin_token');
  if (token) headers['x-admin-token'] = token;
  const csrf = getCsrf();
  if (csrf && (opts.method && opts.method !== 'GET')) headers['x-csrf-token'] = csrf;
  const res = await fetch(path, { credentials: 'include', ...opts, headers });
  if (res.status === 401 && !opts.allow401) { throw new Error('Not signed in or session expired. Please sign in above.'); }
  if (!res.ok) { const t = await res.text(); throw new Error(t || res.statusText); }
  return await res.json();
}

// Theme toggle with persistence
function applyTheme(theme) { document.body.classList.toggle('light', theme === 'light'); }
function initTheme() {
  const saved = localStorage.getItem('theme');
  applyTheme(saved || 'dark');
  const btn = $('#themeToggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const cur = document.body.classList.contains('light') ? 'light' : 'dark';
      const next = cur === 'light' ? 'dark' : 'light';
      applyTheme(next); localStorage.setItem('theme', next);
    });
  }
}

async function login() {
  console.log('[admin] login start');
  const btn = $('#loginBtn');
  try {
    btn && (btn.disabled = true);
    const msg = $('#loginMsg');
    if (msg) msg.innerHTML = '<span class="muted">Signing in...</span>';
    const input = $('#loginToken');
    let token = input ? String(input.value || '').trim() : '';
    console.log('[admin] token.len', token.length, 'raw=', input ? input.value : '(no input)');
    if (!token) {
      // 兜底：尝试使用已缓存的本地 token
      const cached = localStorage.getItem('admin_token') || '';
      if (cached) {
        token = cached;
        console.log('[admin] use cached token');
      }
    }
    if (!token) {
      if (msg) msg.innerHTML = '<span class="err">Please enter Admin Token</span>';
      if (input && input.focus) input.focus();
      return;
    }
    console.log('[admin] fetch /auth/login');
    const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ token }), allow401: true });
    console.log('[admin] login response', res);
    if (res && res.ok) {
      localStorage.setItem('admin_token', token);
      if (msg) msg.innerHTML = '<span class="ok">Signed in</span>';
      const card = $('#loginCard');
      if (card) { card.style.display = 'none'; }
      // 后续加载不应覆盖成功提示，将错误各自显示在对应区域
      const tasks = [
        (async () => { try { await loadProjects(); } catch (e) { const pm = $('#projMsg'); if (pm) pm.innerHTML = `<span class="err">${e.message}</span>`; } })(),
        (async () => { try { await loadKeys(); } catch (e) { const am = $('#actionMsg'); if (am) am.innerHTML = `<span class="err">${e.message}</span>`; } })(),
        (async () => { try { await loadAudits(); } catch (e) { /* 忽略审计加载错误 */ } })(),
      ];
      await Promise.allSettled(tasks);
    } else {
      if (msg) msg.innerHTML = '<span class="err">Sign in failed: invalid token</span>';
    }
  } catch (e) {
    const msg = $('#loginMsg');
    if (msg) msg.innerHTML = `<span class="err">${e.message}</span>`;
  } finally {
    btn && (btn.disabled = false);
  }
}
async function loadProjects() {
  try {
    const projects = await api('/admin/projects');
    const list = $('#projectList');
    if (!list) { console.warn('[admin] #projectList not found'); return; }
    list.innerHTML = '';
    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.id; opt.textContent = `${p.id} - ${p.name}`;
      list.appendChild(opt);
    }
    list.addEventListener('change', () => { const pid = $('#projectId'); if (pid) pid.value = list.value; });
    if (projects[0]) { const pid = $('#projectId'); if (pid) pid.value = projects[0].id; }
  } catch (e) { const pm = $('#projMsg'); if (pm) pm.innerHTML = `<span class="err">${e.message}</span>`; }
}
async function createProject() {
  try {
    const name = $('#newProjectName').value.trim();
    if (!name) { $('#projMsg').innerHTML = '<span class="err">Project name is required</span>'; return; }
    const p = await api('/admin/projects', { method: 'POST', body: JSON.stringify({ name }) });
    $('#projMsg').innerHTML = `<span class="ok">Project created #${p.id}</span>`;
    $('#newProjectName').value = '';
    await loadProjects();
  } catch (e) { $('#projMsg').innerHTML = `<span class="err">${e.message}</span>`; }
}
async function saveDatasource() {
  try {
    const projectId = $('#projectList').value || $('#projectId').value;
    const dsn_enc = $('#projectDsn').value.trim();
    const ds = await api(`/admin/datasources/${projectId}`, { method: 'PUT', body: JSON.stringify({ dsn_enc }) });
    const enc = ds.encrypted ? ' (encrypted)' : '';
    $('#projMsg').innerHTML = `<span class="ok">Datasource saved #${ds.id}${enc}</span>`;
  } catch (e) { $('#projMsg').innerHTML = `<span class="err">${e.message}</span>`; }
}
async function testDatasource() {
  try {
    const projectId = $('#projectList').value || $('#projectId').value;
    const dsn_enc = $('#projectDsn').value.trim() || undefined;
    const res = await api(`/admin/datasources/${projectId}/test`, { method: 'POST', body: JSON.stringify({ dsn_enc }) });
    if (res.ok) { $('#projMsg').innerHTML = `<span class="ok">Connected: ${res.version || ''}</span>`; }
    else { $('#projMsg').innerHTML = `<span class="err">Connection failed: ${res.message}</span>`; }
  } catch (e) { $('#projMsg').innerHTML = `<span class="err">${e.message}</span>`; }
}
async function deleteProject() {
  try {
    const projectId = $('#projectList').value || $('#projectId').value;
    if (!projectId) return;
    await api(`/admin/projects/${projectId}`, { method: 'DELETE' });
    $('#projMsg').innerHTML = `<span class="ok">Project deleted #${projectId}</span>`;
    await loadProjects();
  } catch (e) { $('#projMsg').innerHTML = `<span class="err">${e.message}</span>`; }
}
async function issueKey() {
  try {
    const project_id = Number($('#projectId').value);
    const body = {
      project_id,
      rate_rps: Number($('#rateRps').value || 5),
      daily_quota: Number($('#dailyQuota').value || 10000),
      note: $('#keyNote').value.trim() || null,
    };
    const fqn = $('#tableFqn').value.trim();
    const fieldsRaw = $('#allowedFields').value.trim();
    const row_filter_sql = $('#rowFilter').value.trim();
    if (fqn && fieldsRaw) {
      body.table_fqn = fqn;
      body.allowed_fields = fieldsRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (row_filter_sql) body.row_filter_sql = row_filter_sql;
    }
    const data = await api('/admin/keys/issue', { method: 'POST', body: JSON.stringify(body) });
    $('#issueResult').innerHTML = `<div class="ok">Issued. Plaintext key: <code>${data.api_key_plaintext}</code></div>`;
    await loadKeys();
  } catch (e) { $('#issueResult').innerHTML = `<div class="err">${e.message}</div>`; }
}
async function loadKeys() {
  try {
    const project_id = $('#filterProjectId') ? $('#filterProjectId').value.trim() : '';
    const q = $('#keySearch') ? $('#keySearch').value.trim() : '';
    const params = new URLSearchParams();
    if (project_id) params.set('project_id', project_id);
    if (q) params.set('q', q);
    const list = await api(`/admin/keys?${params.toString()}`);
    const table = $('#keysTable');
    if (!table) { console.warn('[admin] #keysTable not found'); return; }
    const tbody = table.querySelector('tbody');
    if (!tbody) { console.warn('[admin] #keysTable tbody not found'); return; }
    tbody.innerHTML = '';
    for (const k of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${k.id}</td><td>${k.project_id}</td><td>${k.key_prefix}</td><td>${k.note || ''}</td><td>${k.active}</td><td>${k.rate_rps}</td><td>${k.daily_quota}</td><td><button data-id="${k.id}" class="btn">Revoke</button></td>`;
      tbody.appendChild(tr);
      tr.querySelector('button').addEventListener('click', async () => {
        try { await api(`/admin/keys/${k.id}/revoke`, { method: 'PUT' }); const am=$('#actionMsg'); if (am) am.innerHTML = '<span class="ok">Revoked</span>'; await loadKeys(); }
        catch (e) { const am=$('#actionMsg'); if (am) am.innerHTML = `<span class="err">${e.message}</span>`; }
      });
    }
  } catch (e) { const am=$('#actionMsg'); if (am) am.innerHTML = `<span class="err">${e.message}</span>`; }
}
async function saveNote() {
  try {
    const id = $('#noteKeyId').value.trim();
    const note = $('#noteText').value.trim();
    const k = await api(`/admin/keys/${id}/note`, { method: 'PUT', body: JSON.stringify({ note }) });
    $('#actionMsg').innerHTML = `<span class="ok">Note updated: ${k.note || ''}</span>`;
    await loadKeys();
  } catch (e) { $('#actionMsg').innerHTML = `<span class="err">${e.message}</span>`; }
}
async function loadAudits() {
  try {
    const params = new URLSearchParams();
    const pid = $('#auditProjectId').value.trim();
    const st = $('#auditStatus').value.trim();
    if (pid) params.set('project_id', pid);
    if (st) params.set('status', st);
    const list = await api(`/admin/audits?${params.toString()}`);
    const tbody = $('#auditTable').querySelector('tbody');
    tbody.innerHTML = '';
    for (const a of list) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${a.created_at}</td><td>${a.route}</td><td>${a.method}</td><td>${a.status}</td><td>${a.duration_ms}ms</td><td>${a.row_count ?? ''}</td>`;
      tbody.appendChild(tr);
    }
  } catch (e) { /* ignore UI errors */ }
}

// Policy tester (client-side only)
function policyTest() {
  const fqn = $('#ptFqn').value.trim();
  const allowed = $('#ptAllowed').value.trim().split(',').map(s=>s.trim()).filter(Boolean);
  const rowFilter = $('#ptRowFilter').value.trim();
  const sel = $('#ptSelect').value.trim();
  const where = $('#ptWhere').value.trim();
  const order = $('#ptOrder').value.trim();
  const limit = Number($('#ptLimit').value || 50);

  const selectCols = sel ? sel.split(',').map(s=>s.trim()).filter(Boolean) : [];
  const denied = selectCols.filter(c => allowed.length && !allowed.includes(c));
  let sql = `SELECT ${selectCols.length?selectCols.join(', '):'*'} FROM ${fqn}`;
  const whereParts = [];
  if (where) whereParts.push(`[where=${where}]`);
  if (rowFilter) whereParts.push(`[policy=${rowFilter}]`);
  if (whereParts.length) sql += ` WHERE ${whereParts.join(' AND ').replaceAll('[','').replaceAll(']','')}`;
  if (order) sql += ` ORDER BY ${order}`;
  sql += ` LIMIT ${limit}`;

  let out = `Estimated SQL:\n${sql}`;
  if (denied.length) out += `\n\nColumns denied by whitelist: ${denied.join(', ')}`;
  $('#ptResult').textContent = out;
}

function boot() {
  console.log('[admin] boot');
  initTheme();
  const btn = $('#loginBtn');
  if (btn) {
    console.log('[admin] bind loginBtn');
    btn.addEventListener('click', login);
  }
  // Delegated fallback: any click on element with id=loginBtn triggers login
  document.addEventListener('click', (ev) => {
    let node = ev.target;
    if (node && node.nodeType !== 1 && node.parentElement) node = node.parentElement;
    const target = (node && (node.id === 'loginBtn' ? node : (node.closest && node.closest('#loginBtn')))) || null;
    if (target) { console.log('[admin] delegated click login'); ev.preventDefault(); login(); }
  });
  // Enter key on token input triggers login
  const tokenInput = $('#loginToken');
  if (tokenInput) {
    tokenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); login(); } });
  }
  $('#createProject')?.addEventListener('click', createProject);
  $('#saveDatasource')?.addEventListener('click', saveDatasource);
  $('#testDatasource')?.addEventListener('click', testDatasource);
  $('#deleteProject')?.addEventListener('click', deleteProject);
  $('#issueBtn')?.addEventListener('click', issueKey);
  $('#refreshKeys')?.addEventListener('click', loadKeys);
  $('#saveNote')?.addEventListener('click', saveNote);
  $('#refreshAudit')?.addEventListener('click', loadAudits);
  $('#ptRun')?.addEventListener('click', policyTest);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
