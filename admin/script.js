(function(){
'use strict';

/* ═══════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════ */
const API_BASE = window.ADMIN_API_BASE || '';
const TOKEN_KEY = 'triumph_admin_token';
const REFRESH_TOKEN_KEY = 'triumph_admin_refresh_token';
const TOKEN_EXPIRY_KEY = 'triumph_admin_expiry';
const TOKEN_TTL_MS = 55 * 60 * 1000;

function onReady(fn){
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', fn, {once:true});
  } else {
    fn();
  }
}

/* ═══════════════════════════════════════════════
   DOM REFS
   ═══════════════════════════════════════════════ */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const loginPage    = $('#login-page');
const adminPage    = $('#admin-page');
const loginForm    = $('#login-form');
const loginBtn     = $('#login-btn');
const loginError   = $('#login-error');
const logoutBtn    = $('#logout-btn');
const changePasswordBtn = $('#change-password-btn');
const sidebar      = $('#admin-sidebar');
const mobileMenuBtn= $('#mobile-menu-btn');
const modalOverlay = $('#modal-overlay');

/* ═══════════════════════════════════════════════
   TOAST SYSTEM
   ═══════════════════════════════════════════════ */
function toast(msg, type='info', duration=4000){
  const container = $('#toast-container');
  const icons = {success:'✅', error:'❌', info:'ℹ️', warning:'⚠️'};
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icons[type]||icons.info}</span>
    <span class="toast-msg">${escHtml(msg)}</span>
    <button class="toast-close">&times;</button>
  `;
  container.appendChild(el);
  const remove = () => {
    el.classList.add('toast-exit');
    setTimeout(() => el.remove(), 300);
  };
  el.querySelector('.toast-close').onclick = remove;
  setTimeout(remove, duration);
}

/* ═══════════════════════════════════════════════
   AUTH HELPERS
   ═══════════════════════════════════════════════ */
function getToken(){ return sessionStorage.getItem(TOKEN_KEY); }
function getRefreshToken(){ return sessionStorage.getItem(REFRESH_TOKEN_KEY); }
function setToken(t, refreshToken){
  sessionStorage.setItem(TOKEN_KEY, t);
  if(refreshToken) sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, Date.now() + TOKEN_TTL_MS);
}
function clearToken(){
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
}
function isTokenExpired(){
  const exp = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
  return !exp || Date.now() > Number(exp);
}

function authHeaders(){
  return {
    'Authorization': 'Bearer ' + getToken(),
    'Content-Type': 'application/json'
  };
}

function authHeadersRaw(){
  return { 'Authorization': 'Bearer ' + getToken() };
}

/* ═══════════════════════════════════════════════
   API FETCH WRAPPER
   ═══════════════════════════════════════════════ */
async function api(url, opts={}){
  if(isTokenExpired() && getRefreshToken()){
    await refreshSession();
  }
  return requestWithAuth(url, opts, true);
}

async function requestWithAuth(url, opts={}, retryOnAuth=true){
  if(!opts.headers) opts.headers = {};
  if(!(opts.body instanceof FormData)){
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
  }
  opts.headers['Authorization'] = 'Bearer ' + getToken();

  try{
    const res = await fetch(API_BASE + url, opts);
    if((res.status === 401 || res.status === 403) && retryOnAuth && getRefreshToken()){
      await refreshSession();
      return requestWithAuth(url, opts, false);
    }
    if(res.status === 401 || res.status === 403){
      clearToken();
      showLogin();
      toast('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى','warning');
      throw new Error('Unauthorized');
    }
    if(!res.ok){
      const data = await res.json().catch(()=>({}));
      throw new Error(data.message || data.error || `HTTP ${res.status}`);
    }
    const ct = res.headers.get('content-type');
    if(ct && ct.includes('application/json')) return res.json();
    return res;
  }catch(err){
    if(err.message !== 'Unauthorized') throw err;
  }
}

async function refreshSession(){
  const refreshToken = getRefreshToken();
  if(!refreshToken) throw new Error('No refresh token');
  const res = await fetch(API_BASE + '/api/admin/login/refresh', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({refreshToken})
  });
  if(!res.ok){
    clearToken();
    showLogin();
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  setToken(data.token, data.refreshToken);
  return data.token;
}

async function apiFormData(url, formData){
  if(isTokenExpired() && getRefreshToken()){
    await refreshSession();
  }
  const headers = { 'Authorization': 'Bearer ' + getToken() };
  const res = await fetch(API_BASE + url, { method:'POST', headers, body: formData });
  if((res.status === 401 || res.status === 403) && getRefreshToken()){
    await refreshSession();
    return apiFormData(url, formData);
  }
  if(res.status === 401 || res.status === 403){
    clearToken(); showLogin();
    toast('انتهت صلاحية الجلسة','warning');
    throw new Error('Unauthorized');
  }
  if(!res.ok){
    const data = await res.json().catch(()=>({}));
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ═══════════════════════════════════════════════
   LOGIN / LOGOUT
   ═══════════════════════════════════════════════ */
function showLogin(){
  loginPage.style.display = 'flex';
  adminPage.classList.remove('active');
  loginError.textContent = '';
  loginForm.reset();
}

function showAdmin(){
  loginPage.style.display = 'none';
  adminPage.classList.add('active');
  currentModule = 'dashboard';
  loadModule('dashboard');
}

loginForm.addEventListener('submit', async(e)=>{
  e.preventDefault();
  const user = $('#login-user').value.trim();
  const pass = $('#login-pass').value;
  if(!user||!pass) return;

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<div class="spinner" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;width:20px;height:20px;border-width:2px"></div><span>جاري الدخول…</span>';
  loginError.textContent = '';

  try{
    const res = await fetch(API_BASE + '/api/admin/login', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username:user, password:pass})
    });
    if(!res.ok){
      loginError.textContent = 'بيانات الدخول غير صحيحة';
      return;
    }
    const data = await res.json();
    if(data.token){
      setToken(data.token, data.refreshToken);
      $('#header-username').textContent = user;
      $('#header-avatar').textContent = user.charAt(0).toUpperCase();
      showAdmin();
      toast('تم تسجيل الدخول بنجاح','success');
    } else {
      loginError.textContent = 'بيانات الدخول غير صحيحة';
    }
  }catch(err){
    loginError.textContent = 'خطأ في الاتصال بالخادم';
  }finally{
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span>🔐</span><span>تسجيل الدخول</span>';
  }
});

logoutBtn.addEventListener('click', async()=>{
  const refreshToken = getRefreshToken();
  if(refreshToken){
    await fetch(API_BASE + '/api/admin/login/logout', {
      method:'POST',
      headers: authHeaders(),
      body: JSON.stringify({refreshToken})
    }).catch(()=>{});
  }
  clearToken();
  showLogin();
  toast('تم تسجيل الخروج','info');
});

changePasswordBtn.addEventListener('click', ()=>{
  openModal('🔑 تغيير كلمة المرور', `
    <div class="form-group">
      <label>كلمة المرور الحالية</label>
      <input type="password" class="form-control" id="cp-old" autocomplete="current-password">
    </div>
    <div class="form-group">
      <label>كلمة المرور الجديدة</label>
      <input type="password" class="form-control" id="cp-new" autocomplete="new-password">
      <div class="form-hint">8 أحرف على الأقل.</div>
    </div>
    <div class="form-group">
      <label>تأكيد كلمة المرور الجديدة</label>
      <input type="password" class="form-control" id="cp-confirm" autocomplete="new-password">
    </div>
  `, '<button class="btn btn-gold" id="cp-save">حفظ كلمة المرور</button><button class="btn btn-outline" onclick="window._closeModal()">إلغاء</button>');
  setTimeout(()=>{
    const btn = $('#cp-save');
    if(btn) btn.addEventListener('click', changePassword);
  },50);
});

async function changePassword(){
  const oldPassword = ($('#cp-old')||{}).value || '';
  const newPassword = ($('#cp-new')||{}).value || '';
  const confirmPassword = ($('#cp-confirm')||{}).value || '';
  if(!oldPassword || !newPassword){
    toast('يرجى تعبئة حقول كلمة المرور','warning');
    return;
  }
  if(newPassword.length < 8){
    toast('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل','warning');
    return;
  }
  if(newPassword !== confirmPassword){
    toast('تأكيد كلمة المرور غير مطابق','warning');
    return;
  }
  const btn = $('#cp-save');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></div>';
  try{
    await api('/api/admin/login/change-password', {method:'POST', body:JSON.stringify({oldPassword, newPassword})});
    toast('تم تغيير كلمة المرور. سجل الدخول مرة أخرى.','success');
    closeModal();
    clearToken();
    showLogin();
  }catch(err){
    toast('فشل تغيير كلمة المرور: '+err.message,'error');
  }finally{
    btn.disabled = false;
    btn.innerHTML = 'حفظ كلمة المرور';
  }
}

/* ═══════════════════════════════════════════════
   NAVIGATION
   ═══════════════════════════════════════════════ */
let currentModule = 'dashboard';

function switchModule(mod){
  if(mod === currentModule) return;
  currentModule = mod;
  // Update sidebar
  $$('#sidebar-nav a').forEach(a=>{
    a.classList.toggle('active', a.dataset.module === mod);
  });
  // Update mobile tabs
  $$('.mobile-tab').forEach(t=>{
    t.classList.toggle('active', t.dataset.module === mod);
  });
  // Show module
  $$('.module').forEach(m => m.classList.remove('active'));
  const target = $(`#mod-${mod}`);
  if(target) target.classList.add('active');
  // Close mobile sidebar
  sidebar.classList.remove('open');
  // Load data
  loadModule(mod);
}

$$('#sidebar-nav a').forEach(a=>{
  a.addEventListener('click', e=>{
    e.preventDefault();
    switchModule(a.dataset.module);
  });
});
$$('.mobile-tab').forEach(t=>{
  t.addEventListener('click', ()=> switchModule(t.dataset.module));
});
mobileMenuBtn.addEventListener('click', ()=>{
  sidebar.classList.toggle('open');
});
// Close sidebar on outside click
document.addEventListener('click', e=>{
  if(sidebar.classList.contains('open') &&
     !sidebar.contains(e.target) &&
     e.target !== mobileMenuBtn){
    sidebar.classList.remove('open');
  }
});

function loadModule(mod){
  switch(mod){
    case 'dashboard': loadDashboard(); break;
    case 'schedule': loadScheduleHistory(); break;
    case 'content':  loadContentSection('intro'); break;
    case 'staff':    loadStaff(); break;
    case 'audit':    loadAudit(1); break;
  }
}

/* ═══════════════════════════════════════════════
   MODULE 0: DASHBOARD
   ═══════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const [staffRes, auditRes, schedRes] = await Promise.all([
      fetch(API_BASE + '/api/admin/staff', { headers: authHeaders() }),
      fetch(API_BASE + '/api/admin/audit?page=1&limit=5', { headers: authHeaders() }),
      fetch(API_BASE + '/api/admin/schedule/history?limit=100', { headers: authHeaders() })
    ]);
    
    if (staffRes.ok) {
      const staffData = await staffRes.json();
      $('#dash-staff-count').textContent = (staffData.pagination && staffData.pagination.total) || (staffData.data && staffData.data.length) || 0;
    }
    
    if (schedRes.ok) {
      const schedData = await schedRes.json();
      $('#dash-schedule-count').textContent = (schedData.pagination && schedData.pagination.total) || (schedData.data && schedData.data.length) || 0;
    }
    
    if (auditRes.ok) {
      const auditData = await auditRes.json();
      const logs = auditData.data || [];
      $('#dash-audit-count').textContent = (auditData.pagination && auditData.pagination.total) || logs.length || 0;
      
      const activityContainer = $('#dash-recent-activity');
      if (!Array.isArray(logs) || !logs.length) {
        activityContainer.innerHTML = '<div class="empty-state" style="padding: 20px;"><div class="empty-text">لا توجد نشاطات حديثة</div></div>';
      } else {
        let html = '<div class="table-wrap"><table class="data-table"><tbody>';
        logs.slice(0, 5).forEach(log => {
          html += `<tr>
            <td style="white-space:nowrap;font-size:.82rem">${formatDateTime(log.created_at||log.timestamp||'')}</td>
            <td><strong>${escHtml(log.username||log.admin||'')}</strong></td>
            <td><span style="background:var(--gold-lt);padding:3px 10px;border-radius:6px;font-size:.8rem;font-weight:600">${escHtml(log.action||'')}</span></td>
          </tr>`;
        });
        html += '</tbody></table></div>';
        activityContainer.innerHTML = html;
      }
    }
  } catch (err) {
    console.error('Dashboard load error', err);
  }
}

/* ═══════════════════════════════════════════════
   MODAL SYSTEM
   ═══════════════════════════════════════════════ */
function openModal(title, bodyHtml, footerHtml=''){
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-footer').innerHTML = footerHtml;
  modalOverlay.classList.add('active');
}
function closeModal(){
  modalOverlay.classList.remove('active');
}
$('#modal-close').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e=>{
  if(e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
});

/* ═══════════════════════════════════════════════
   MODULE 1: SCHEDULE MANAGER
   ═══════════════════════════════════════════════ */
let scheduleFile = null;
let schedulePreviewData = null;

const dropZone = $('#schedule-drop');
const fileInput = $('#schedule-file');
const fileInfo = $('#schedule-file-info');
const previewCard = $('#schedule-preview-card');

// Drag & drop
['dragenter','dragover'].forEach(evt=>{
  dropZone.addEventListener(evt, e=>{
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.add('dragover');
  });
});
['dragleave','drop'].forEach(evt=>{
  dropZone.addEventListener(evt, e=>{
    e.preventDefault(); e.stopPropagation();
    dropZone.classList.remove('dragover');
  });
});
dropZone.addEventListener('drop', e=>{
  const files = e.dataTransfer.files;
  if(files.length) handleScheduleFile(files[0]);
});
fileInput.addEventListener('change', ()=>{
  if(fileInput.files.length) handleScheduleFile(fileInput.files[0]);
});

function handleScheduleFile(file){
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  const ext = file.name.split('.').pop().toLowerCase();
  if(!['xlsx','xls'].includes(ext)){
    toast('يرجى رفع ملف Excel (.xlsx) فقط','error');
    return;
  }
  if(file.size > 5*1024*1024){
    toast('حجم الملف يتجاوز 5MB','error');
    return;
  }
  scheduleFile = file;
  fileInfo.style.display = 'flex';
  fileInfo.innerHTML = `
    <div class="file-info">
      <span>📄</span>
      <span class="file-name">${file.name}</span>
      <span style="color:#999;font-size:.8rem">${(file.size/1024).toFixed(1)} KB</span>
      <button class="file-remove" onclick="window._removeScheduleFile()">✕</button>
    </div>
  `;
  uploadScheduleFile(file);
}

window._removeScheduleFile = function(){
  scheduleFile = null;
  schedulePreviewData = null;
  fileInfo.style.display = 'none';
  fileInfo.innerHTML = '';
  previewCard.style.display = 'none';
  fileInput.value = '';
};

async function uploadScheduleFile(file){
  const fd = new FormData();
  fd.append('file', file);
  previewCard.style.display = 'block';
  $('#schedule-preview-table').innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحليل الملف…</p></div>';
  $('#schedule-validation-errors').innerHTML = '';

  try{
    const data = await apiFormData('/api/admin/schedule/upload', fd);
    schedulePreviewData = data;
    renderSchedulePreview(data);
  }catch(err){
    $('#schedule-preview-table').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">فشل في تحليل الملف</div><div class="empty-hint">${err.message}</div></div>`;
  }
}

function renderSchedulePreview(data){
  let rawRows = data.previewData || data.rows || data.preview || [];
  const errors = data.errors || [];
  if(!rawRows.length){
    $('#schedule-preview-table').innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">لا توجد بيانات في الملف</div></div>';
    return;
  }
  
  // Flatten the rows so shifts are part of the main object for rendering
  const rows = rawRows.map(r => {
    if(r.shifts) {
       return { 
         'الاسم': r.name, 
         'الوظيفة': r.job || r.department, 
         ...r.shifts 
       };
    }
    return r;
  });

  const headers = Object.keys(rows[0]);
  let html = '<table class="data-table"><thead><tr>';
  html += '<th>#</th>';
  headers.forEach(h => html += `<th>${escHtml(h)}</th>`);
  html += '</tr></thead><tbody>';
  rows.forEach((row, i) => {
    const hasError = errors.some(e => e.row === i);
    html += `<tr style="${hasError?'background:#fff5f5':''}">`;
    html += `<td>${i+1}</td>`;
    headers.forEach(h => html += `<td>${escHtml(String(row[h]||''))}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table>';
  $('#schedule-preview-table').innerHTML = html;

  if(errors.length){
    let errHtml = '<div style="margin-top:14px">';
    errors.forEach(e=>{
      errHtml += `<div style="color:var(--danger);font-size:.82rem;margin-bottom:4px">⚠️ صف ${e.row+1}: ${escHtml(e.message)}</div>`;
    });
    errHtml += '</div>';
    $('#schedule-validation-errors').innerHTML = errHtml;
  }
}

$('#schedule-publish-btn').addEventListener('click', async()=>{
  if(!scheduleFile){toast('يرجى رفع ملف أولاً','warning');return;}
  if(!schedulePreviewData || !schedulePreviewData.previewId){toast('انتظر حتى يتم تحليل الملف','warning');return;}
  if(!schedulePreviewData.previewData || schedulePreviewData.previewData.length === 0){
    toast('لا يمكن نشر جدول فارغ. يرجى التأكد من أن الملف يحتوي على بيانات صحيحة.', 'warning');
    return;
  }
  
  const weekKey = prompt("أدخل مفتاح الأسبوع (مثال: 2026-W21):", "2026-W21");
  if(!weekKey) return;

  const btn = $('#schedule-publish-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></div> جاري النشر…';
  try{
    await api('/api/admin/schedule/publish', {
      method:'POST',
      body: JSON.stringify({
        previewId: schedulePreviewData.previewId,
        week_key: weekKey,
        week_start: weekKey
      })
    });
    toast('تم نشر الجدول بنجاح','success');
    window._removeScheduleFile();
    loadScheduleHistory();
  }catch(err){
    toast('فشل في نشر الجدول: '+err.message,'error');
  }finally{
    btn.disabled = false;
    btn.innerHTML = '<span>✓</span> نشر الجدول';
  }
});

$('#schedule-cancel-btn').addEventListener('click', ()=>{
  window._removeScheduleFile();
});

$('#schedule-refresh-btn').addEventListener('click', ()=> loadScheduleHistory());

async function loadScheduleHistory(){
  const container = $('#schedule-history-content');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري التحميل…</p></div>';
  try{
    const data = await api('/api/admin/schedule/history');
    const items = data && (data.data || data.history || data.schedules || data) || [];
    if(!Array.isArray(items) || !items.length){
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">لا توجد جداول منشورة بعد</div><div class="empty-hint">ارفع ملف Excel وانشره ليظهر هنا</div></div>';
      return;
    }
    let html = '<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>الأسبوع</th><th>تاريخ النشر</th><th>الناشر</th><th>الملف</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
    items.slice(0,10).forEach((item,i)=>{
      const date = item.published_at || item.publishedAt || item.date || item.created_at || '';
      const uploader = item.publisher || item.uploadedBy || item.uploader || item.admin || '—';
      const filename = item.original_filename || item.filename || item.file || '—';
      const activeValue = item.is_active ?? item.isActive;
      const isActive = activeValue === true || activeValue === 1 || activeValue === '1';
      const id = item.id || item._id || i;
      html += `<tr>
        <td>${i+1}</td>
        <td><code style="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:.8rem">${escHtml(item.week_key || item.weekKey || '—')}</code></td>
        <td>${formatDate(date)}</td>
        <td>${escHtml(uploader)}</td>
        <td style="font-size:.8rem">${escHtml(filename)}</td>
        <td><span class="status-badge ${isActive ? 'status-published' : 'status-resigned'}">${isActive ? '✓ نشط' : 'نسخة محفوظة'}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="window._restoreSchedule('${id}')" ${isActive ? 'disabled' : ''}>🔄 استعادة</button>
          <button class="btn btn-outline btn-sm" onclick="window._downloadSchedule('${id}')" style="margin-right:4px">📥 تحميل</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
  }catch(err){
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">تعذر تحميل السجل</div><div class="empty-hint">${err.message}</div></div>`;
  }
}

window._restoreSchedule = async function(id){
  if(!confirm('هل تريد استعادة هذا الإصدار وجعله الجدول النشط لهذا الأسبوع؟')) return;
  try{
    await api(`/api/admin/schedule/restore/${id}`,{method:'POST'});
    toast('تمت استعادة الجدول بنجاح','success');
    loadScheduleHistory();
  }catch(err){toast('فشلت الاستعادة: '+err.message,'error')}
};

window._downloadSchedule = function(id){
  const link = document.createElement('a');
  link.href = API_BASE+`/api/admin/schedule/download/${id}`;
  link.setAttribute('download','');
  const token = getToken();
  // For download we open in new tab with auth
  window.open(API_BASE+`/api/admin/schedule/download/${id}?token=${token}`,'_blank');
};

/* ═══════════════════════════════════════════════
   MODULE 2: CONTENT EDITOR
   ═══════════════════════════════════════════════ */
let currentContentSection = 'intro';

onReady(()=>{
  $$('#content-tabs .section-tab').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      $$('#content-tabs .section-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      currentContentSection = tab.dataset.section;
      loadContentSection(tab.dataset.section);
    });
  });
});

async function loadContentSection(section){
  const container = $('#content-editor-body');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل المحتوى…</p></div>';
  try{
    if(section === 'chemicals') return loadChemicalsJsonEditor();
    if(section === 'programs') return loadProgramsJsonEditor();

    const res = await api(`/api/admin/content/${section}`);
    const data = (res && res.data) || res || {};
    renderContentEditor(section, data);
  }catch(err){
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">لا يوجد محتوى بعد لهذا القسم</div><div class="empty-hint">ابدأ بإضافة محتوى جديد</div></div>`;
    renderContentEditor(section, {});
  }
}

const sectionLabels = {
  intro: {title:'المقدمة', fields:[
    {key:'title_ar', label:'العنوان (عربي)', type:'text'},
    {key:'title_en', label:'العنوان (إنجليزي)', type:'text'},
    {key:'body_ar', label:'المحتوى (عربي)', type:'textarea'},
    {key:'body_en', label:'المحتوى (إنجليزي)', type:'textarea'}
  ]},
  tips: {title:'النصائح', fields:[
    {key:'title_ar', label:'العنوان (عربي)', type:'text'},
    {key:'title_en', label:'العنوان (إنجليزي)', type:'text'},
    {key:'content_ar', label:'المحتوى (عربي)', type:'textarea'},
    {key:'content_en', label:'المحتوى (إنجليزي)', type:'textarea'}
  ]}
};

let _chemicalsJson = [];
let _programsJson = [];

function themeOptions(selected){
  const themes = ['gold','pink','blue','red','green'];
  return themes.map(t => `<option value="${t}" ${selected===t?'selected':''}>${t}</option>`).join('');
}

function renderJsonList(items, activeId){
  if(!items.length) return '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">لا توجد عناصر</div><div class="empty-hint">اضغط إضافة لإنشاء عنصر جديد</div></div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>الاسم</th><th>كود</th><th></th></tr></thead><tbody>` +
    items.map(it=>`
      <tr style="cursor:pointer" onclick="window._selectJsonItem('${escAttr(it.id)}')">
        <td><code style="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:.8rem">${escHtml(it.id)}</code></td>
        <td>${escHtml(it.name || it.name_ar || it.name_en || '—')}</td>
        <td>${escHtml(it.code || it.number || '—')}</td>
        <td>${it.id===activeId?'✓':''}</td>
      </tr>
    `).join('') + `</tbody></table></div>`;
}

function renderChemicalsEditor(activeId){
  const container = $('#content-editor-body');
  const active = _chemicalsJson.find(x=>x.id===activeId) || _chemicalsJson[0] || null;
  const id = active ? active.id : '';
  const html = `
    <div class="fade-in" style="display:grid;grid-template-columns: 1fr 2fr; gap:16px; align-items:start;">
      <div class="card" style="margin:0;">
        <div class="card-header"><div class="card-title"><span class="icon">🧪</span> عناصر الكيماويات</div></div>
        <div style="padding:14px;">
          <button class="btn btn-gold btn-sm" type="button" onclick="window._addChemical()">➕ إضافة كيميكل</button>
          <div style="margin-top:12px;">${renderJsonList(_chemicalsJson, id)}</div>
        </div>
      </div>
      <div class="card" style="margin:0;">
        <div class="card-header"><div class="card-title"><span class="icon">✏️</span> تعديل العنصر</div></div>
        <div style="padding:14px;">
          ${active ? `
          <form id="chem-json-form">
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label>ID</label>
                <input class="form-control" name="id" value="${escAttr(active.id)}" disabled>
              </div>
              <div class="form-group" style="flex:1">
                <label>اللون (Theme)</label>
                <select class="form-control" name="theme">${themeOptions(active.theme)}</select>
              </div>
              <div class="form-group" style="flex:1">
                <label>الكود</label>
                <input class="form-control" name="code" value="${escAttr(active.code||'')}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label>الاسم</label>
                <input class="form-control" name="name" value="${escAttr(active.name||'')}">
              </div>
              <div class="form-group" style="flex:1">
                <label>العلامة التجارية</label>
                <input class="form-control" name="brand" value="${escAttr(active.brand||'CLAX')}">
              </div>
              <div class="form-group" style="flex:1">
                <label>النوع (مثال: مبيض كلور)</label>
                <input class="form-control" name="type" value="${escAttr(active.type||'')}">
              </div>
            </div>
            <div class="form-group">
              <label>إيه هي المادة دي؟ (الوصف)</label>
              <textarea class="form-control" name="desc" rows="2" dir="rtl">${escHtml((active.contentSections && active.contentSections[0] && active.contentSections[0].paragraphs && active.contentSections[0].paragraphs[0]) || active.description || '')}</textarea>
            </div>
            <div class="form-group">
              <label>إزاي بيشتغل؟</label>
              <textarea class="form-control" name="howItWorks" rows="2" dir="rtl">${escHtml((active.contentSections && active.contentSections[1] && active.contentSections[1].paragraphs && active.contentSections[1].paragraphs[0]) || active.howItWorks || '')}</textarea>
            </div>
            <div class="form-group">
              <label>المميزات (كل سطر ميزة)</label>
              <textarea class="form-control" name="features" rows="3" dir="rtl">${escHtml((active.contentSections && active.contentSections[2] && active.contentSections[2].items) ? active.contentSections[2].items.join('\n') : (active.features ? active.features.join('\n') : ''))}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label>الجرعة</label>
                <input class="form-control" name="dosage" value="${escAttr((active.usage && active.usage.dosage) || '')}">
              </div>
            </div>
            <div class="form-group">
              <label>ملاحظات الاستخدام (كل سطر ملاحظة)</label>
              <textarea class="form-control" name="usageNotes" rows="3" dir="rtl">${escHtml((active.usage && active.usage.blocks && active.usage.blocks.find(b=>b.kind==='list')) ? active.usage.blocks.find(b=>b.kind==='list').items.join('\n') : '')}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label>الشكل (Appearance)</label>
                <input class="form-control" name="appearance" value="${escAttr((active.technical && active.technical.appearance) || '')}">
              </div>
              <div class="form-group" style="flex:1">
                <label>الـ pH</label>
                <input class="form-control" name="ph" value="${escAttr((active.technical && active.technical.ph) || '')}">
              </div>
              <div class="form-group" style="flex:1">
                <label>الكثافة</label>
                <input class="form-control" name="density" value="${escAttr((active.technical && active.technical.density) || '')}">
              </div>
            </div>
            <div class="form-group">
              <label>ملاحظة فنية (اختياري)</label>
              <input class="form-control" name="techNote" value="${escAttr((active.technical && active.technical.note) || '')}">
            </div>
            <div class="form-group">
              <label>تعليمات الأمان</label>
              <textarea class="form-control" name="safety" rows="2" dir="rtl">${escHtml(active.safety || '')}</textarea>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
              <button type="submit" class="btn btn-gold">💾 حفظ الكيميكل</button>
              <button type="button" class="btn btn-outline" onclick="window._deleteChemical('${escAttr(active.id)}')">🗑️ حذف</button>
            </div>
          </form>
          ` : '<div class="empty-state"><div class="empty-icon">🧪</div><div class="empty-text">لا توجد كيماويات</div></div>'}
        </div>
      </div>
    </div>
  `;
  container.innerHTML = html;

  const form = document.getElementById('chem-json-form');
  if(form){
    form.addEventListener('submit', async(e)=>{
      e.preventDefault();
      const idx = _chemicalsJson.findIndex(x=>x.id===id);
      if(idx === -1) return;
      
      const v = (name) => form.elements[name] ? form.elements[name].value : '';
      const splitLines = (str) => str.split('\n').map(s=>s.trim()).filter(s=>s);
      
      const featuresList = splitLines(v('features'));
      const usageNotesList = splitLines(v('usageNotes'));
      
      const usageBlocks = [
        { kind: "paragraph", className: "dosage-line", style: "", text: v('dosage') }
      ];
      if (usageNotesList.length > 0) {
        usageBlocks.push({ kind: "note", className: "note-head", style: "", text: "مهم جداً:" });
        usageBlocks.push({ kind: "list", className: "blist", style: "", items: usageNotesList });
      }

      _chemicalsJson[idx] = {
        ..._chemicalsJson[idx],
        theme: v('theme'),
        code: v('code'),
        name: v('name'),
        brand: v('brand'),
        type: v('type'),
        description: v('desc'),
        howItWorks: v('howItWorks'),
        features: featuresList,
        contentSections: [
          { title: "إيه هي المادة دي؟", paragraphs: [v('desc')], items: [] },
          { title: "إزاي بيشتغل؟", paragraphs: [v('howItWorks')], items: [] },
          { title: "المميزات", paragraphs: [], items: featuresList }
        ],
        usage: {
          title: "طريقة الاستخدام والجرعة",
          description: v('dosage'),
          dosage: v('dosage'),
          blocks: usageBlocks
        },
        technical: {
          appearance: v('appearance'),
          ph: v('ph'),
          density: v('density'),
          other: {},
          rows: [
            [
              { label: "الشكل", value: v('appearance') },
              { label: "الـ pH", value: v('ph') }
            ],
            [
              { label: "الكثافة", value: v('density') }
            ]
          ],
          note: v('techNote')
        },
        safety: v('safety')
      };
      
      delete _chemicalsJson[idx].raw_content;

      try{
        await api('/api/admin/data/chemicals',{method:'PUT', body: JSON.stringify(_chemicalsJson)});
        toast('تم حفظ ملف chemicals.json بنجاح','success');
        renderChemicalsEditor(id);
      }catch(err){ toast('فشل الحفظ: '+err.message,'error'); }
    });
  }
}

async function loadChemicalsJsonEditor(){
  const container = $('#content-editor-body');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل chemicals.json…</p></div>';
  const res = await api('/api/admin/data/chemicals');
  _chemicalsJson = Array.isArray(res.data) ? res.data : (res.data?.data || []);
  if(!Array.isArray(_chemicalsJson)) _chemicalsJson = [];
  renderChemicalsEditor((_chemicalsJson[0] && _chemicalsJson[0].id) || '');
}

window._addProgStep = function(btn) {
  const container = document.getElementById('prog-steps-container');
  const div = document.createElement('div');
  div.className = 'form-row step-row';
  div.innerHTML = `
    <div class="form-group" style="flex:2"><input class="form-control" name="step_op" placeholder="العملية"></div>
    <div class="form-group" style="flex:1"><input class="form-control" name="step_water" placeholder="مياه"></div>
    <div class="form-group" style="flex:1"><input class="form-control" name="step_temp" placeholder="حرارة"></div>
    <div class="form-group" style="flex:1"><input class="form-control" name="step_time" placeholder="وقت"></div>
    <div class="form-group" style="flex:2"><input class="form-control" name="step_chems" placeholder="كيماويات"></div>
    <div class="form-group" style="flex:1"><input class="form-control" name="step_dose_kg" placeholder="مل/كجم"></div>
    <div class="form-group" style="flex:1"><input class="form-control" name="step_dose_mac" placeholder="مل/ماكينة"></div>
    <div class="form-group" style="flex:0; display:flex; align-items:flex-end;"><button type="button" class="btn btn-outline" style="padding:10px" onclick="this.parentElement.parentElement.remove()">X</button></div>
  `;
  container.appendChild(div);
};

function renderProgramsEditor(activeId){
  const container = $('#content-editor-body');
  const active = _programsJson.find(x=>x.id===activeId) || _programsJson[0] || null;
  const id = active ? active.id : '';
  const steps = active && active.steps ? active.steps : [];
  
  const stepsHtml = steps.map(s => `
    <div class="form-row step-row">
      <div class="form-group" style="flex:2"><input class="form-control" name="step_op" value="${escAttr(s.op||'')}" placeholder="العملية"></div>
      <div class="form-group" style="flex:1"><input class="form-control" name="step_water" value="${escAttr(s.water||'')}" placeholder="مياه"></div>
      <div class="form-group" style="flex:1"><input class="form-control" name="step_temp" value="${escAttr(s.temp||'')}" placeholder="حرارة"></div>
      <div class="form-group" style="flex:1"><input class="form-control" name="step_time" value="${escAttr(s.time||'')}" placeholder="وقت"></div>
      <div class="form-group" style="flex:2"><input class="form-control" name="step_chems" value="${escAttr(s.chemicals||'')}" placeholder="كيماويات"></div>
      <div class="form-group" style="flex:1"><input class="form-control" name="step_dose_kg" value="${escAttr(s.dose_kg||'')}" placeholder="مل/كجم"></div>
      <div class="form-group" style="flex:1"><input class="form-control" name="step_dose_mac" value="${escAttr(s.dose_mac||'')}" placeholder="مل/ماكينة"></div>
      <div class="form-group" style="flex:0; display:flex; align-items:flex-end;"><button type="button" class="btn btn-outline" style="padding:10px" onclick="this.parentElement.parentElement.remove()">X</button></div>
    </div>
  `).join('');

  const html = `
    <div class="fade-in" style="display:grid;grid-template-columns: 1fr 2fr; gap:16px; align-items:start;">
      <div class="card" style="margin:0;">
        <div class="card-header"><div class="card-title"><span class="icon">⚙️</span> عناصر البرامج</div></div>
        <div style="padding:14px;">
          <button class="btn btn-gold btn-sm" type="button" onclick="window._addProgram()">➕ إضافة برنامج</button>
          <div style="margin-top:12px;">${renderJsonList(_programsJson, id)}</div>
        </div>
      </div>
      <div class="card" style="margin:0;">
        <div class="card-header"><div class="card-title"><span class="icon">✏️</span> تعديل العنصر</div></div>
        <div style="padding:14px;">
          ${active ? `
          <form id="prog-json-form">
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label>ID</label>
                <input class="form-control" name="id" value="${escAttr(active.id)}" disabled>
              </div>
              <div class="form-group" style="flex:1">
                <label>الفئة (Type)</label>
                <input class="form-control" name="type" value="${escAttr(active.type||'')}">
              </div>
              <div class="form-group" style="flex:1">
                <label>الرقم (Number)</label>
                <input class="form-control" name="number" value="${escAttr(active.number||'')}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label>الاسم (EN)</label>
                <input class="form-control" name="name_en" value="${escAttr(active.name_en||'')}">
              </div>
              <div class="form-group" style="flex:1">
                <label>الاسم (AR)</label>
                <input class="form-control" name="name_ar" value="${escAttr(active.name_ar||'')}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label>الحرارة الكلية (Temp)</label>
                <input class="form-control" name="temp" value="${escAttr(active.temp||'')}">
              </div>
              <div class="form-group" style="flex:1">
                <label>الوقت الكلي (Time)</label>
                <input class="form-control" name="time" value="${escAttr(active.time||'')}">
              </div>
            </div>
            <div class="form-group">
              <label>ملاحظة عامة (Note)</label>
              <input class="form-control" name="note" value="${escAttr(active.note||'')}">
            </div>
            
            <div class="form-group" style="margin-top:15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top:15px;">
              <label style="display:flex; justify-content:space-between; align-items:center;">
                خطوات البرنامج (الجدول)
                <button type="button" class="btn btn-sm btn-outline" onclick="window._addProgStep()">➕ إضافة خطوة</button>
              </label>
              <div id="prog-steps-container" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                ${stepsHtml}
              </div>
            </div>
            
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
              <button type="submit" class="btn btn-gold">💾 حفظ البرنامج</button>
              <button type="button" class="btn btn-outline" onclick="window._deleteProgram('${escAttr(active.id)}')">🗑️ حذف</button>
            </div>
          </form>
          ` : '<div class="empty-state"><div class="empty-icon">⚙️</div><div class="empty-text">لا توجد برامج</div></div>'}
        </div>
      </div>
    </div>
  `;
  container.innerHTML = html;

  const form = document.getElementById('prog-json-form');
  if(form){
    form.addEventListener('submit', async(e)=>{
      e.preventDefault();
      const idx = _programsJson.findIndex(x=>x.id===id);
      if(idx === -1) return;
      
      const stepRows = form.querySelectorAll('.step-row');
      const newSteps = [];
      stepRows.forEach(row => {
        const v = (name) => row.querySelector(`[name="${name}"]`).value;
        newSteps.push({
          op: v('step_op'),
          water: v('step_water'),
          temp: v('step_temp'),
          time: v('step_time'),
          chemicals: v('step_chems'),
          dose_kg: v('step_dose_kg'),
          dose_mac: v('step_dose_mac')
        });
      });

      _programsJson[idx] = {
        ..._programsJson[idx],
        type: form.elements.type.value,
        number: form.elements.number.value,
        name_en: form.elements.name_en.value,
        name_ar: form.elements.name_ar.value,
        temp: form.elements.temp.value,
        time: form.elements.time.value,
        note: form.elements.note.value,
        steps: newSteps
      };
      
      delete _programsJson[idx].raw_content;

      try{
        await api('/api/admin/data/programs',{method:'PUT', body: JSON.stringify(_programsJson)});
        toast('تم حفظ البرنامج بنجاح','success');
        renderProgramsEditor(id);
      }catch(err){ toast('فشل الحفظ: '+err.message,'error'); }
    });
  }
}

async function loadProgramsJsonEditor(){
  const container = $('#content-editor-body');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل programs.json…</p></div>';
  const res = await api('/api/admin/data/programs');
  _programsJson = Array.isArray(res.data) ? res.data : (res.data?.data || []);
  if(!Array.isArray(_programsJson)) _programsJson = [];
  renderProgramsEditor((_programsJson[0] && _programsJson[0].id) || '');
}

window._selectJsonItem = function(id){
  if(currentContentSection === 'chemicals') return renderChemicalsEditor(id);
  if(currentContentSection === 'programs') return renderProgramsEditor(id);
};

window._addChemical = function(){
  const id = prompt('ID جديد (مثال: hypo2)','new_chemical');
  if(!id) return;
  if(_chemicalsJson.some(x=>x.id===id)) return toast('ID موجود بالفعل','error');
  _chemicalsJson.push({
    id, 
    theme:'gold', 
    name:'New Chemical', 
    code:'', 
    brand: 'CLAX',
    type: '',
    description: '',
    howItWorks: '',
    features: [],
    contentSections: [],
    usage: {},
    technical: {},
    safety: ''
  });
  renderChemicalsEditor(id);
};

window._deleteChemical = function(id){
  if(!confirm('حذف هذا العنصر من chemicals.json؟')) return;
  _chemicalsJson = _chemicalsJson.filter(x=>x.id!==id);
  api('/api/admin/data/chemicals',{method:'PUT', body: JSON.stringify(_chemicalsJson)})
    .then(()=>{ toast('تم الحذف','success'); renderChemicalsEditor((_chemicalsJson[0]&&_chemicalsJson[0].id)||''); })
    .catch(err=>toast('فشل الحذف: '+err.message,'error'));
};

window._addProgram = function(){
  const id = prompt('ID جديد (مثال: prog14)','prog14');
  if(!id) return;
  if(_programsJson.some(x=>x.id===id)) return toast('ID موجود بالفعل','error');
  _programsJson.push({
    id, 
    type:'linen', 
    number:'', 
    name_en:'New Program', 
    name_ar:'برنامج جديد', 
    temp:'', 
    time:'', 
    note:'', 
    steps: []
  });
  renderProgramsEditor(id);
};

window._deleteProgram = function(id){
  if(!confirm('حذف هذا العنصر من programs.json؟')) return;
  _programsJson = _programsJson.filter(x=>x.id!==id);
  api('/api/admin/data/programs',{method:'PUT', body: JSON.stringify(_programsJson)})
    .then(()=>{ toast('تم الحذف','success'); renderProgramsEditor((_programsJson[0]&&_programsJson[0].id)||''); })
    .catch(err=>toast('فشل الحذف: '+err.message,'error'));
};

function renderContentEditor(section, data){
  const config = sectionLabels[section] || sectionLabels.intro;
  const container = $('#content-editor-body');
  let html = `<form id="content-form" class="fade-in">`;
  config.fields.forEach(f=>{
    const value = data && data[f.key] !== undefined ? data[f.key] : '';
    html += `<div class="form-group">
      <label>${f.label}</label>`;
    if(f.type === 'textarea'){
      html += `<textarea class="form-control" name="${f.key}" rows="4">${escHtml(String(value))}</textarea>`;
    } else {
      html += `<input type="text" class="form-control" name="${f.key}" value="${escAttr(String(value))}">`;
    }
    html += `</div>`;
  });
  html += `<div style="display:flex;gap:10px;margin-top:8px">
    <button type="submit" class="btn btn-gold">💾 حفظ التعديلات</button>
  </div></form>`;
  container.innerHTML = html;

  $('#content-form').addEventListener('submit', async(e)=>{
    e.preventDefault();
    const formData = {};
    const form = e.target;
    config.fields.forEach(f=>{
      formData[f.key] = form.elements[f.key].value;
    });
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></div> جاري الحفظ…';
    try{
      await api(`/api/admin/content/${section}`,{method:'PATCH',body:JSON.stringify(formData)});
      toast('تم حفظ المحتوى بنجاح','success');
    }catch(err){
      toast('فشل في الحفظ: '+err.message,'error');
    }finally{
      btn.disabled = false;
      btn.innerHTML = '💾 حفظ التعديلات';
    }
  });
}

/* ═══════════════════════════════════════════════
   MODULE 3: STAFF MANAGER
   ═══════════════════════════════════════════════ */
let staffData = [];
let staffFilters = {search:'', department:'', status:''};

async function loadStaff(){
  const container = $('#staff-table-content');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل البيانات…</p></div>';
  try{
    const params = new URLSearchParams({limit:'100'});
    if(staffFilters.search) params.set('search', staffFilters.search);
    if(staffFilters.department) params.set('department', staffFilters.department);
    if(staffFilters.status) params.set('status', staffFilters.status);
    const data = await api('/api/admin/staff?' + params.toString());
    staffData = data && (data.data || data.employees || data.staff || data) || [];
    if(!Array.isArray(staffData)) staffData = [];
    renderStaffTable();
  }catch(err){
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">تعذر تحميل بيانات الموظفين</div><div class="empty-hint">${err.message}</div></div>`;
  }
}

function renderStaffTable(){
  const container = $('#staff-table-content');
  if(!staffData.length){
    const hasFilters = staffFilters.search || staffFilters.department || staffFilters.status;
    container.innerHTML = hasFilters
      ? '<div class="empty-state"><div class="empty-icon">🔎</div><div class="empty-text">لا توجد نتائج مطابقة</div><div class="empty-hint">عدّل البحث أو امسح الفلاتر</div></div>'
      : '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">لا يوجد موظفون</div><div class="empty-hint">اضغط "إضافة موظف" لإضافة أول موظف</div></div>';
    return;
  }
  let html = '<div class="table-wrap"><table class="data-table"><thead><tr><th>الاسم (عربي)</th><th>الاسم (إنجليزي)</th><th>رقم الموظف</th><th>القسم</th><th>الهاتف</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
  staffData.forEach((emp, i)=>{
    const statusClass = emp.status==='Active'?'status-active':emp.status==='On Leave'?'status-leave':'status-resigned';
    const statusText = emp.status==='Active'?'نشط':emp.status==='On Leave'?'إجازة':emp.status==='Inactive'?'غير نشط':'مستقيل';
    const dept = deptLabel(emp.department);
    html += `<tr>
      <td><strong>${escHtml(emp.name_ar||emp.nameAr||'')}</strong></td>
      <td style="font-family:'Outfit',sans-serif">${escHtml(emp.name_en||emp.nameEn||'')}</td>
      <td><code style="background:#f5f5f5;padding:2px 8px;border-radius:4px;font-size:.8rem">${escHtml(emp.employeeId||emp.employee_id||'')}</code></td>
      <td>${dept}</td>
      <td dir="ltr" style="text-align:right">${escHtml(emp.phone||'—')}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="window._editStaff(${i})">✏️</button>
        <button class="btn btn-outline btn-sm" onclick="window._archiveStaff(${i})" style="margin-right:4px;color:var(--danger)">أرشفة</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function debounce(fn, delay=250){
  let timer;
  return (...args)=>{
    clearTimeout(timer);
    timer = setTimeout(()=>fn(...args), delay);
  };
}

const reloadStaffFromFilters = debounce(()=>{
  staffFilters = {
    search: ($('#staff-search')||{}).value?.trim() || '',
    department: ($('#staff-department-filter')||{}).value || '',
    status: ($('#staff-status-filter')||{}).value || ''
  };
  loadStaff();
});

onReady(()=>{
  ['staff-search','staff-department-filter','staff-status-filter'].forEach(id=>{
    const el = $('#'+id);
    if(el) el.addEventListener(id === 'staff-search' ? 'input' : 'change', reloadStaffFromFilters);
  });
});

onReady(()=>{
  const staffFilterReset = $('#staff-filter-reset');
  if(staffFilterReset) staffFilterReset.addEventListener('click', ()=>{
    $('#staff-search').value = '';
    $('#staff-department-filter').value = '';
    $('#staff-status-filter').value = '';
    staffFilters = {search:'', department:'', status:''};
    loadStaff();
  });
});

function deptLabel(d){
  const map = {Washing:'الغسيل',Ironing:'الكوي',Folding:'الطي',Delivery:'التوصيل',Supervisor:'مشرف'};
  return map[d]||d||'—';
}

const deptOptions = `
  <option value="">— اختر القسم —</option>
  <option value="Washing">الغسيل</option>
  <option value="Ironing">الكوي</option>
  <option value="Folding">الطي</option>
  <option value="Delivery">التوصيل</option>
  <option value="Supervisor">مشرف</option>
`;
const statusOptions = `
  <option value="Active">نشط</option>
  <option value="On Leave">إجازة</option>
  <option value="Inactive">غير نشط</option>
  <option value="Resigned">مستقيل</option>
`;

function staffFormHtml(emp={}){
  return `
    <div class="form-row">
      <div class="form-group">
        <label>الاسم الكامل (عربي) *</label>
        <input type="text" class="form-control" id="sf-name-ar" value="${escAttr(emp.name_ar||emp.nameAr||'')}" required>
      </div>
      <div class="form-group">
        <label>Full Name (English) *</label>
        <input type="text" class="form-control" id="sf-name-en" value="${escAttr(emp.name_en||emp.nameEn||'')}" required dir="ltr">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>رقم الموظف *</label>
        <input type="text" class="form-control" id="sf-empid" value="${escAttr(emp.employeeId||emp.employee_id||'')}" required>
      </div>
      <div class="form-group">
        <label>القسم *</label>
        <select class="form-control" id="sf-dept">${deptOptions}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>رقم الهاتف</label>
        <input type="tel" class="form-control" id="sf-phone" value="${escAttr(emp.phone||'')}" dir="ltr">
      </div>
      <div class="form-group">
        <label>الحالة</label>
        <select class="form-control" id="sf-status">${statusOptions}</select>
      </div>
    </div>
  `;
}

onReady(()=>{
  const staffAddBtn = $('#staff-add-btn');
  if(staffAddBtn) staffAddBtn.addEventListener('click', ()=>{
    openModal('➕ إضافة موظف جديد', staffFormHtml(),
      '<button class="btn btn-gold" id="staff-save-new">💾 حفظ</button><button class="btn btn-outline" onclick="window._closeModal()">إلغاء</button>'
    );
    setTimeout(()=>{
      const saveBtn = $('#staff-save-new');
      if(saveBtn) saveBtn.addEventListener('click', saveNewStaff);
    },50);
  });
});
window._closeModal = closeModal;

async function saveNewStaff(){
  const body = getStaffFormData();
  if(!body) return;
  const btn = $('#staff-save-new');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></div>';
  try{
    await api('/api/admin/staff',{method:'POST',body:JSON.stringify(body)});
    toast('تمت إضافة الموظف بنجاح','success');
    closeModal();
    loadStaff();
  }catch(err){
    toast('فشل في الإضافة: '+err.message,'error');
  }finally{
    btn.disabled = false;
    btn.innerHTML = '💾 حفظ';
  }
}

window._editStaff = function(index){
  const emp = staffData[index];
  if(!emp) return;
  openModal('✏️ تعديل بيانات الموظف', staffFormHtml(emp),
    `<button class="btn btn-gold" id="staff-save-edit">💾 حفظ التعديلات</button><button class="btn btn-outline" onclick="window._closeModal()">إلغاء</button>`
  );
  setTimeout(()=>{
    // Set select values
    const deptSel = $('#sf-dept');
    const statusSel = $('#sf-status');
    if(deptSel) deptSel.value = emp.department||'';
    if(statusSel) statusSel.value = emp.status||'Active';
    const saveBtn = $('#staff-save-edit');
    if(saveBtn) saveBtn.addEventListener('click', ()=> updateStaff(emp.id||emp._id||emp.employeeId||emp.employee_id, index));
  },50);
};

async function updateStaff(id, index){
  const body = getStaffFormData();
  if(!body) return;
  const btn = $('#staff-save-edit');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></div>';
  try{
    await api(`/api/admin/staff/${id}`,{method:'PATCH',body:JSON.stringify(body)});
    toast('تم تحديث بيانات الموظف','success');
    closeModal();
    loadStaff();
  }catch(err){
    toast('فشل في التحديث: '+err.message,'error');
  }finally{
    btn.disabled = false;
    btn.innerHTML = '💾 حفظ التعديلات';
  }
}

window._archiveStaff = function(index) {
  const emp = staffData[index];
  if(!emp) return;
  const id = emp.id || emp._id || emp.employeeId || emp.employee_id;
  const name = emp.name_ar || emp.nameAr;
  
  openModal('تأكيد أرشفة الموظف', 
    `<p>هل تريد أرشفة الموظف <strong>${escHtml(name)}</strong>؟</p><p class="form-hint">سيتم إخفاؤه من قائمة الموظفين النشطة مع بقاء بيانات الجداول القديمة محفوظة.</p>`,
    `<button class="btn btn-danger" id="staff-confirm-archive">تأكيد الأرشفة</button><button class="btn btn-outline" onclick="window._closeModal()">إلغاء</button>`
  );
  
  setTimeout(()=>{
    const btn = $('#staff-confirm-archive');
    if(btn) btn.addEventListener('click', async()=>{
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></div>';
      try{
        await api(`/api/admin/staff/${id}`,{method:'DELETE'});
        toast('تمت أرشفة الموظف بنجاح','success');
        closeModal();
        loadStaff();
      }catch(err){
        toast('فشل في التنفيذ: '+err.message,'error');
      }
    });
  },50);
}


function getStaffFormData(){
  const name_ar = ($('#sf-name-ar')||{}).value?.trim();
  const name_en = ($('#sf-name-en')||{}).value?.trim();
  const employee_id = ($('#sf-empid')||{}).value?.trim();
  const department = ($('#sf-dept')||{}).value;
  const phone = ($('#sf-phone')||{}).value?.trim();
  const status = ($('#sf-status')||{}).value||'Active';
  if(!name_ar||!name_en||!employee_id||!department){
    toast('يرجى تعبئة جميع الحقول المطلوبة','warning');
    return null;
  }
  return {name_ar, name_en, employee_id, department, phone, status};
}

// Export staff
onReady(()=>{
  const staffExportBtn = $('#staff-export-btn');
  if(staffExportBtn) staffExportBtn.addEventListener('click', async()=>{
  try{
    const res = await fetch(API_BASE+'/api/admin/staff/export',{headers:authHeadersRaw()});
    if(res.status===401){clearToken();showLogin();return;}
    const blob = await res.blob();
    downloadBlob(blob,'employees.xlsx');
    toast('تم تصدير البيانات','success');
  }catch(err){
    toast('فشل في التصدير: '+err.message,'error');
  }
  });
});

/* ═══════════════════════════════════════════════
   MODULE 4: AUDIT LOG
   ═══════════════════════════════════════════════ */
let auditPage = 1;
let auditTotalPages = 1;

async function loadAudit(page=1){
  auditPage = page;
  const container = $('#audit-table-content');
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل السجلات…</p></div>';
  try{
    const data = await api(`/api/admin/audit?page=${page}&limit=20`);
    const logs = data && (data.data || data.logs || data.audit || data.entries || data) || [];
    const pagination = data && data.pagination || {};
    auditTotalPages = pagination.totalPages || data.totalPages || data.pages || Math.ceil(((pagination.total || data.total || logs.length) / 20)) || 1;
    if(!Array.isArray(logs)||!logs.length){
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">لا توجد سجلات بعد</div></div>';
      $('#audit-pagination').innerHTML = '';
      return;
    }
    let html = '<div class="table-wrap"><table class="data-table"><thead><tr><th>التاريخ والوقت</th><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th></tr></thead><tbody>';
    logs.forEach(log=>{
      html += `<tr>
        <td style="white-space:nowrap;font-size:.82rem">${formatDateTime(log.created_at||log.timestamp||log.createdAt||log.date||'')}</td>
        <td><strong>${escHtml(log.username||log.admin||log.user||log.adminUser||'')}</strong></td>
        <td><span style="background:var(--gold-lt);padding:3px 10px;border-radius:6px;font-size:.8rem;font-weight:600">${escHtml(log.action||'')}</span></td>
        <td style="font-size:.82rem;color:#666;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(log.details||log.description||'—')}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
    renderAuditPagination();
  }catch(err){
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">تعذر تحميل السجلات</div><div class="empty-hint">${err.message}</div></div>`;
    $('#audit-pagination').innerHTML = '';
  }
}

function renderAuditPagination(){
  const container = $('#audit-pagination');
  if(auditTotalPages <= 1){container.innerHTML='';return;}
  let html = `<button ${auditPage<=1?'disabled':''} onclick="window._auditPage(${auditPage-1})">‹</button>`;
  for(let i=1;i<=auditTotalPages;i++){
    if(auditTotalPages>7 && Math.abs(i-auditPage)>2 && i!==1 && i!==auditTotalPages){
      if(i===2||i===auditTotalPages-1) html+='<button disabled>…</button>';
      continue;
    }
    html += `<button class="${i===auditPage?'active':''}" onclick="window._auditPage(${i})">${i}</button>`;
  }
  html += `<button ${auditPage>=auditTotalPages?'disabled':''} onclick="window._auditPage(${auditPage+1})">›</button>`;
  container.innerHTML = html;
}
window._auditPage = function(p){loadAudit(p)};

// Export audit CSV
$('#audit-export-btn').addEventListener('click', async()=>{
  try{
    const res = await fetch(API_BASE+'/api/admin/audit/export',{headers:authHeadersRaw()});
    if(res.status===401){clearToken();showLogin();return;}
    const blob = await res.blob();
    downloadBlob(blob,'audit_log.csv');
    toast('تم تصدير سجل المراجعة','success');
  }catch(err){
    toast('فشل في التصدير: '+err.message,'error');
  }
});

/* ═══════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════ */
function escHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
function escAttr(s){
  return s.replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDate(d){
  if(!d) return '—';
  try{
    const dt = new Date(d);
    return dt.toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'});
  }catch{return d}
}
function formatDateTime(d){
  if(!d) return '—';
  try{
    const dt = new Date(d);
    return dt.toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'}) +
      ' ' + dt.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'});
  }catch{return d}
}

function downloadBlob(blob, filename){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url)},100);
}

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
function init(){
  const token = getToken();
  if(token && !isTokenExpired()){
    showAdmin();
  } else {
    clearToken();
    showLogin();
  }
}

init();

})();
