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

function handleDelegatedAdminAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;

  if (action === 'close-modal') return closeModal();
  if (action === 'remove-schedule-file') return window._removeScheduleFile();
  if (action === 'restore-schedule') return window._restoreSchedule(target.dataset.id);
  if (action === 'download-schedule') return window._downloadSchedule(target.dataset.id);
  if (action === 'select-json-item') return window._selectJsonItem(target.dataset.id);
  if (action === 'add-chemical') return window._addChemical();
  if (action === 'delete-chemical') return window._deleteChemical(target.dataset.id);
  if (action === 'remove-builder-row') return target.closest('[data-builder-row]')?.remove();
  if (action === 'add-program') return window._addProgram();
  if (action === 'add-program-step') return window._addProgStep();
  if (action === 'delete-program') return window._deleteProgram(target.dataset.id);
  if (action === 'select-tip-card') return window._selectTipCard(Number(target.dataset.index));
  if (action === 'add-tip-card') return window._addTipCard();
  if (action === 'delete-tip-card') return window._deleteTipCard(Number(target.dataset.index));
  if (action === 'edit-staff') return window._editStaff(Number(target.dataset.index));
  if (action === 'archive-staff') return window._archiveStaff(Number(target.dataset.index));
  if (action === 'audit-page') return window._auditPage(Number(target.dataset.page));
}

document.addEventListener('click', handleDelegatedAdminAction);

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
  el.querySelector('.toast-close').addEventListener('click', remove);
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
      if(res.status === 401){
        loginError.textContent = 'بيانات الدخول غير صحيحة';
      } else if(res.status >= 500){
        loginError.textContent = 'خطأ في الخادم — حاول لاحقاً';
      } else {
        loginError.textContent = 'تعذر الاتصال بالخادم (تحقق من إعدادات النشر)';
      }
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

async function handleLogout(){
  const refreshToken = getRefreshToken();
  if(refreshToken){
    await fetch(API_BASE + '/api/admin/login/logout', {
      method:'POST',
      headers: authHeaders(),
      body: JSON.stringify({refreshToken})
    }).catch(()=>{});
  }
  clearToken();
  setSidebarOpen(false);
  setSidebarAccountOpen(false);
  showLogin();
  toast('تم تسجيل الخروج','info');
}

function openChangePasswordModal(){
  setSidebarOpen(false);
  setSidebarAccountOpen(false);
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
  `, '<button class="btn btn-gold" id="cp-save">حفظ كلمة المرور</button><button class="btn btn-outline" data-action="close-modal">إلغاء</button>');
  setTimeout(()=>{
    const btn = $('#cp-save');
    if(btn) btn.addEventListener('click', changePassword);
  },50);
}

if(logoutBtn) logoutBtn.addEventListener('click', handleLogout);
const sidebarLogoutBtn = $('#sidebar-logout-btn');
if(sidebarLogoutBtn) sidebarLogoutBtn.addEventListener('click', handleLogout);

if(changePasswordBtn) changePasswordBtn.addEventListener('click', openChangePasswordModal);
const sidebarChangePasswordBtn = $('#sidebar-change-password-btn');
if(sidebarChangePasswordBtn) sidebarChangePasswordBtn.addEventListener('click', openChangePasswordModal);

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
  $$('.mobile-tab[data-module]').forEach(t=>{
    t.classList.toggle('active', t.dataset.module === mod);
  });
  setSidebarAccountOpen(false);
  // Show module
  $$('.module').forEach(m => m.classList.remove('active'));
  const target = $(`#mod-${mod}`);
  if(target) target.classList.add('active');
  // Close mobile sidebar
  setSidebarOpen(false);
  // Load data
  loadModule(mod);
}

$$('#sidebar-nav a').forEach(a=>{
  a.addEventListener('click', e=>{
    e.preventDefault();
    switchModule(a.dataset.module);
  });
});
const sidebarAccountToggle = $('#sidebar-account-toggle');
const sidebarAccountMenu = $('#sidebar-account-menu');

function setSidebarAccountOpen(open){
  if(!sidebarAccountMenu) return;
  sidebarAccountMenu.hidden = !open;
  if(sidebarAccountToggle){
    sidebarAccountToggle.classList.toggle('open', open);
    sidebarAccountToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
}

if(sidebarAccountToggle){
  sidebarAccountToggle.addEventListener('click', e=>{
    e.stopPropagation();
    setSidebarAccountOpen(sidebarAccountMenu.hidden);
  });
}

$$('.mobile-tab[data-module]').forEach(t=>{
  t.addEventListener('click', ()=> switchModule(t.dataset.module));
});

function setSidebarOpen(open){
  if(!open) setSidebarAccountOpen(false);
  sidebar.classList.toggle('open', open);
  adminPage.classList.toggle('sidebar-open', open);
}
mobileMenuBtn.addEventListener('click', e=>{
  e.stopPropagation();
  setSidebarOpen(!sidebar.classList.contains('open'));
});
// Close sidebar on outside click / backdrop
document.addEventListener('click', e=>{
  if(sidebar.classList.contains('open') &&
     !sidebar.contains(e.target) &&
     !mobileMenuBtn.contains(e.target)){
    setSidebarOpen(false);
  }
  if(sidebarAccountMenu && !sidebarAccountMenu.hidden &&
     sidebarAccountToggle && !sidebarAccountToggle.contains(e.target) &&
     !sidebarAccountMenu.contains(e.target)){
    setSidebarAccountOpen(false);
  }
});

function loadModule(mod){
  switch(mod){
    case 'dashboard': loadDashboard(); break;
    case 'schedule': loadScheduleHistory(); break;
    case 'content':  loadContentSection('intro'); break;
    case 'staff':    loadStaff(); break;
    case 'audit':    loadAudit(1); break;
    case 'admins':   loadAdmins(); break;
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
let hasWorkbookWeeks = false;
const SCHEDULE_PREVIEW_PAGE_SIZE = 25;
let schedulePreviewShown = SCHEDULE_PREVIEW_PAGE_SIZE;

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
      <button class="file-remove" data-action="remove-schedule-file">✕</button>
    </div>
  `;
  uploadScheduleFile(file);
}

window._removeScheduleFile = function(){
  scheduleFile = null;
  schedulePreviewData = null;
  hasWorkbookWeeks = false;
  schedulePreviewShown = SCHEDULE_PREVIEW_PAGE_SIZE;
  fileInfo.style.display = 'none';
  fileInfo.innerHTML = '';
  previewCard.style.display = 'none';
  fileInput.value = '';
};

function setScheduleUploadStatus(message){
  const el = $('#schedule-upload-status');
  if(el) el.textContent = message;
}

async function uploadScheduleFile(file){
  const fd = new FormData();
  fd.append('file', file);
  previewCard.style.display = 'block';
  schedulePreviewShown = SCHEDULE_PREVIEW_PAGE_SIZE;
  $('#schedule-preview-summary').innerHTML = '';
  $('#schedule-preview-table').innerHTML = '<div class="loading-state"><div class="spinner"></div><p id="schedule-upload-status">جاري رفع الملف…</p></div>';
  $('#schedule-validation-errors').innerHTML = '';

  try{
    setScheduleUploadStatus('جاري رفع الملف…');
    const data = await apiFormData('/api/admin/schedule/upload', fd);
    schedulePreviewData = data;
    hasWorkbookWeeks = (Array.isArray(data.weeks) && data.weeks.length > 0) || (data.summary && data.summary.weekCount > 0);
    renderSchedulePreview(data);
    if(data.summary){
      const s = data.summary;
      toast(`تم تحليل الجدول: ${s.employeeCount} موظف · ${s.weekCount} أسبوع · ${s.rowCount} صف`, 'success');
    }
  }catch(err){
    const hint = err.message || 'تحقق من الاتصال بالسيرفر وصيغة الملف (.xlsx)';
    $('#schedule-preview-table').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">فشل في تحليل الملف</div><div class="empty-hint">${escHtml(hint)}</div></div>`;
    toast(hint, 'error');
  }
}

const ROSTER_SHIFT_ORDER = ['Morning', 'Evening', 'Night'];

function schedulePreviewHasRows(data){
  if(!data) return false;
  if(data.summary && data.summary.rowCount > 0) return true;
  const sample = data.previewSample || data.previewData || data.rows || data.preview;
  if(Array.isArray(sample) && sample.length) return true;
  if(Array.isArray(data.weeks) && data.weeks.some((w) => (w.rowCount || (w.rows && w.rows.length)) > 0)) return true;
  return false;
}

function sortSchedulePreviewRows(rawRows){
  return rawRows.slice().sort((a, b) => {
    const rankA = ROSTER_SHIFT_ORDER.indexOf(a.shiftGroup || a.shift_group || 'Morning');
    const rankB = ROSTER_SHIFT_ORDER.indexOf(b.shiftGroup || b.shift_group || 'Morning');
    const safeA = rankA === -1 ? ROSTER_SHIFT_ORDER.length : rankA;
    const safeB = rankB === -1 ? ROSTER_SHIFT_ORDER.length : rankB;
    if (safeA !== safeB) return safeA - safeB;
    return String(a.name || '').localeCompare(String(b.name || ''), 'ar');
  });
}

function mapScheduleRowForTable(r){
  if(r.shifts) {
    return {
      'الأسبوع': r.week_key || '',
      'الوردية': r.shiftGroup || r.shift_group || '',
      'كود الموظف': r.employeeId || '',
      'الاسم': r.name,
      'الوظيفة': r.job || r.department,
      ...r.shifts
    };
  }
  return r;
}

function renderSchedulePreviewSummary(data, totalRows){
  const summaryEl = $('#schedule-preview-summary');
  if(!summaryEl) return;
  const s = data.summary || {};
  const employees = s.employeeCount ?? '—';
  const weeks = s.weekCount ?? (Array.isArray(data.weeks) ? data.weeks.length : '—');
  const rows = s.rowCount ?? totalRows ?? 0;
  const shown = Math.min(schedulePreviewShown, totalRows);
  let html = `<div class="schedule-preview-summary">
    <span><strong>${employees}</strong> موظف</span>
    <span><strong>${weeks}</strong> أسبوع</span>
    <span><strong>${rows}</strong> صف في الملف</span>
    <span>معاينة: <strong>${shown}</strong> من ${rows}</span>
  </div>`;
  if(rows > employees){
    html += `<p class="form-hint" style="margin:8px 0 0">كل موظف قد يظهر أكثر من مرة (ورديات أو أسابيع متعددة) — هذا طبيعي.</p>`;
  }
  summaryEl.innerHTML = html;
}

function renderSchedulePreview(data){
  const errors = data.errors || [];
  let rawRows = data.previewSample || data.previewData || data.rows || data.preview || [];
  rawRows = sortSchedulePreviewRows(rawRows);
  const totalRows = (data.summary && data.summary.rowCount) || rawRows.length;

  if(!schedulePreviewHasRows(data)){
    $('#schedule-preview-summary').innerHTML = '';
    $('#schedule-preview-table').innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">لا توجد بيانات في الملف</div></div>';
    return;
  }

  renderSchedulePreviewSummary(data, totalRows);

  const pageRows = rawRows.slice(0, schedulePreviewShown).map(mapScheduleRowForTable);
  if(!pageRows.length){
    $('#schedule-preview-table').innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">لا توجد بيانات للمعاينة</div></div>';
    return;
  }

  const headers = Object.keys(pageRows[0]);
  let html = '<table class="data-table"><thead><tr>';
  html += '<th>#</th>';
  headers.forEach(h => html += `<th>${escHtml(h)}</th>`);
  html += '</tr></thead><tbody>';
  pageRows.forEach((row, i) => {
    const hasError = errors.some(e => e.row === i + 1);
    html += `<tr style="${hasError?'background:#fff5f5':''}">`;
    html += `<td>${i+1}</td>`;
    headers.forEach(h => html += `<td>${escHtml(String(row[h]||''))}</td>`);
    html += '</tr>';
  });
  html += '</tbody></table>';

  const canShowMoreInSample = schedulePreviewShown < rawRows.length;
  if(canShowMoreInSample){
    html += `<div class="preview-actions" style="margin-top:12px">
      <button type="button" class="btn btn-outline btn-sm" id="schedule-preview-more-btn">
        عرض المزيد (${Math.min(SCHEDULE_PREVIEW_PAGE_SIZE, rawRows.length - schedulePreviewShown)} صف)
      </button>
    </div>`;
  }
  if(totalRows > rawRows.length){
    html += `<p class="form-hint" style="margin-top:10px">المعاينة تعرض أول ${rawRows.length} صف فقط — عند النشر يُحفظ الملف كاملاً (${totalRows} صف).</p>`;
  }

  $('#schedule-preview-table').innerHTML = html;

  const moreBtn = $('#schedule-preview-more-btn');
  if(moreBtn){
    moreBtn.addEventListener('click', ()=>{
      schedulePreviewShown += SCHEDULE_PREVIEW_PAGE_SIZE;
      renderSchedulePreview(data);
    });
  }

  if(errors.length){
    let errHtml = '<div style="margin-top:14px">';
    errors.forEach(e=>{
      const msg = e.message || (Array.isArray(e.issues) ? e.issues.join(', ') : '');
      errHtml += `<div style="color:var(--danger);font-size:.82rem;margin-bottom:4px">⚠️ صف ${e.row}: ${escHtml(msg)}</div>`;
    });
    errHtml += '</div>';
    $('#schedule-validation-errors').innerHTML = errHtml;
  } else {
    $('#schedule-validation-errors').innerHTML = '';
  }
}

$('#schedule-publish-btn').addEventListener('click', async()=>{
  if(!scheduleFile){toast('يرجى رفع ملف أولاً','warning');return;}
  if(!schedulePreviewData || !schedulePreviewData.previewId){toast('انتظر حتى يتم تحليل الملف','warning');return;}
  if (!schedulePreviewHasRows(schedulePreviewData)) {
    toast('لا يمكن نشر جدول فارغ. يرجى التأكد من أن الملف يحتوي على بيانات صحيحة.', 'warning');
    return;
  }
  let weekKey = '';
  if(!hasWorkbookWeeks){
    weekKey = prompt("أدخل مفتاح الأسبوع (مثال: 2026-W21):", "2026-W21");
    if(!weekKey) return;
  }

  const btn = $('#schedule-publish-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></div> جاري النشر…';
  try{
    const publishBody = { previewId: schedulePreviewData.previewId };
    if (!hasWorkbookWeeks) {
      publishBody.week_key = weekKey;
      publishBody.week_start = weekKey;
    }
    const res = await api('/api/admin/schedule/publish', {
      method:'POST',
      body: JSON.stringify(publishBody)
    });
    const count = res.weekCount || (Array.isArray(res.publishedWeeks) ? res.publishedWeeks.length : 0);
    const keys = Array.isArray(res.publishedWeeks) ? res.publishedWeeks.join('، ') : '';
    if (count > 1) {
      toast(`تم نشر ${count} أسابيع: ${keys}`, 'success');
    } else {
      toast(keys ? `تم نشر الأسبوع ${keys}` : 'تم نشر الجدول بنجاح', 'success');
    }
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
          <button class="btn btn-outline btn-sm" data-action="restore-schedule" data-id="${id}" ${isActive ? 'disabled' : ''}>🔄 استعادة</button>
          <button class="btn btn-outline btn-sm" data-action="download-schedule" data-id="${id}" style="margin-right:4px">📥 تحميل</button>
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

window._downloadSchedule = async function(id){
  try{
    const res = await requestWithAuth(`/api/admin/schedule/download/${id}`);
    if(!res) throw new Error('تعذر تحميل الجدول');
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i);
    const filename = filenameMatch ? decodeURIComponent(filenameMatch[1] || filenameMatch[2]) : `schedule_${id}.xlsx`;
    downloadBlob(blob, filename);
    toast('تم تحميل الجدول بنجاح','success');
  }catch(err){
    toast('فشل تحميل الجدول: '+err.message,'error');
  }
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
    if(section === 'tips') return renderTipsCardsEditor(data);
    renderContentEditor(section, data);
  }catch(err){
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-text">لا يوجد محتوى بعد لهذا القسم</div><div class="empty-hint">ابدأ بإضافة محتوى جديد</div></div>`;
    if(section === 'tips') return renderTipsCardsEditor({});
    renderContentEditor(section, {});
  }
}

const sectionLabels = {
  intro: {
    title:'المقدمة',
    description:'هذا الجزء اختياري لتعديل النص الصغير الذي يظهر في شاشة البداية فقط. لو تركت الحقول فارغة سيظل النص الافتراضي الموجود في الموقع كما هو.',
    fields:[
      {key:'title_ar', label:'عنوان شاشة البداية', type:'text', placeholder:'Laundry Guide / دليل المغسلة', help:'اكتب هنا العنوان العربي الذي تريد ظهوره في شاشة البداية.'},
      {key:'body_ar', label:'الوصف المختصر', type:'textarea', placeholder:'Chemicals & Washing Programs Reference', help:'سطر قصير يشرح محتوى التطبيق تحت العنوان.'},
      {key:'title_en', label:'العنوان الإنجليزي (اختياري)', type:'text', optional:true, placeholder:'Laundry Guide', help:'استخدمه فقط لو محتاج نسخة إنجليزية منفصلة.'},
      {key:'body_en', label:'الوصف الإنجليزي (اختياري)', type:'textarea', optional:true, placeholder:'Chemicals & Washing Programs Reference', help:'اختياري، ويُستخدم كبديل لو العنوان أو الوصف العربي غير موجود.'}
    ]
  }
};

let _chemicalsJson = [];
let _programsJson = [];
let _tipsCardsJson = [];
let _activeTipIndex = 0;

function themeOptions(selected){
  const themes = ['gold','pink','blue','red','green'];
  return themes.map(t => `<option value="${t}" ${selected===t?'selected':''}>${t}</option>`).join('');
}

function renderJsonList(items, activeId){
  if(!items.length) return '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">لا توجد عناصر</div><div class="empty-hint">اضغط إضافة لإنشاء عنصر جديد</div></div>';
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>ID</th><th>الاسم</th><th>كود</th><th></th></tr></thead><tbody>` +
    items.map(it=>`
      <tr style="cursor:pointer" data-action="select-json-item" data-id="${escAttr(it.id)}">
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
          <button class="btn btn-gold btn-sm" type="button" data-action="add-chemical">➕ إضافة كيميكل</button>
          <div style="margin-top:12px;">${renderJsonList(_chemicalsJson, id)}</div>
        </div>
      </div>
      <div class="card" style="margin:0;">
        <div class="card-header"><div class="card-title"><span class="icon">✏️</span> تعديل العنصر</div></div>
        <div style="padding:14px;">
          ${active ? `
          <form id="chem-json-form">
            <div class="form-row" data-builder-row="true">
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
            <div class="form-row" data-builder-row="true">
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
            <div class="form-row" data-builder-row="true">
              <div class="form-group" style="flex:1">
                <label>الجرعة</label>
                <input class="form-control" name="dosage" value="${escAttr((active.usage && active.usage.dosage) || '')}">
              </div>
            </div>
            <div class="form-group">
              <label>ملاحظات الاستخدام (كل سطر ملاحظة)</label>
              <textarea class="form-control" name="usageNotes" rows="3" dir="rtl">${escHtml((active.usage && active.usage.blocks && active.usage.blocks.find(b=>b.kind==='list')) ? active.usage.blocks.find(b=>b.kind==='list').items.join('\n') : '')}</textarea>
            </div>
            <div class="form-row" data-builder-row="true">
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
              <button type="button" class="btn btn-outline" data-action="delete-chemical" data-id="${escAttr(active.id)}">🗑️ حذف</button>
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
    <div class="form-group" style="flex:0; display:flex; align-items:flex-end;"><button type="button" class="btn btn-outline" style="padding:10px" data-action="remove-builder-row">X</button></div>
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
      <div class="form-group" style="flex:0; display:flex; align-items:flex-end;"><button type="button" class="btn btn-outline" style="padding:10px" data-action="remove-builder-row">X</button></div>
    </div>
  `).join('');

  const html = `
    <div class="fade-in" style="display:grid;grid-template-columns: 1fr 2fr; gap:16px; align-items:start;">
      <div class="card" style="margin:0;">
        <div class="card-header"><div class="card-title"><span class="icon">⚙️</span> عناصر البرامج</div></div>
        <div style="padding:14px;">
          <button class="btn btn-gold btn-sm" type="button" data-action="add-program">➕ إضافة برنامج</button>
          <div style="margin-top:12px;">${renderJsonList(_programsJson, id)}</div>
        </div>
      </div>
      <div class="card" style="margin:0;">
        <div class="card-header"><div class="card-title"><span class="icon">✏️</span> تعديل العنصر</div></div>
        <div style="padding:14px;">
          ${active ? `
          <form id="prog-json-form">
            <div class="form-row" data-builder-row="true">
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
            <div class="form-row" data-builder-row="true">
              <div class="form-group" style="flex:1">
                <label>الاسم (EN)</label>
                <input class="form-control" name="name_en" value="${escAttr(active.name_en||'')}">
              </div>
              <div class="form-group" style="flex:1">
                <label>الاسم (AR)</label>
                <input class="form-control" name="name_ar" value="${escAttr(active.name_ar||'')}">
              </div>
            </div>
            <div class="form-row" data-builder-row="true">
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
                <button type="button" class="btn btn-sm btn-outline" data-action="add-program-step">➕ إضافة خطوة</button>
              </label>
              <div id="prog-steps-container" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">
                ${stepsHtml}
              </div>
            </div>
            
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
              <button type="submit" class="btn btn-gold">💾 حفظ البرنامج</button>
              <button type="button" class="btn btn-outline" data-action="delete-program" data-id="${escAttr(active.id)}">🗑️ حذف</button>
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

function normalizeTipsCards(data){
  let cards = [];
  if(data && data.cards_json){
    try{
      const parsed = JSON.parse(data.cards_json);
      if(Array.isArray(parsed)) cards = parsed;
    }catch(e){ cards = []; }
  }
  if(!cards.length && data && (data.title_ar || data.title_en || data.content_ar || data.content_en)){
    cards = [{
      icon: data.icon || '💡',
      title_ar: data.title_ar || '',
      title_en: data.title_en || '',
      content_ar: data.content_ar || '',
      content_en: data.content_en || ''
    }];
  }
  return cards
    .filter(card => card && (card.title_ar || card.title_en || card.content_ar || card.content_en))
    .map(card => ({
      icon: card.icon || '💡',
      title_ar: card.title_ar || '',
      title_en: card.title_en || '',
      content_ar: card.content_ar || '',
      content_en: card.content_en || ''
    }));
}

function renderTipsCardsList(){
  if(!_tipsCardsJson.length){
    return '<div class="empty-state"><div class="empty-icon">💡</div><div class="empty-text">لا توجد نصائح مضافة</div><div class="empty-hint">اضغط إضافة نصيحة لإنشاء مربع جديد</div></div>';
  }
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>الأيقونة</th><th>العنوان</th><th></th></tr></thead><tbody>` +
    _tipsCardsJson.map((tip, idx)=>`
      <tr style="cursor:pointer" data-action="select-tip-card" data-index="${idx}">
        <td>${escHtml(tip.icon || '💡')}</td>
        <td>${escHtml(tip.title_ar || tip.title_en || 'نصيحة بدون عنوان')}</td>
        <td>${idx===_activeTipIndex?'✓':''}</td>
      </tr>
    `).join('') + `</tbody></table></div>`;
}

function renderTipsCardsEditor(data){
  if(data){
    _tipsCardsJson = normalizeTipsCards(data);
    _activeTipIndex = Math.min(_activeTipIndex, Math.max(_tipsCardsJson.length - 1, 0));
  }

  const container = $('#content-editor-body');
  const active = _tipsCardsJson[_activeTipIndex] || null;
  const html = `
    <div class="fade-in" style="display:grid;grid-template-columns: 1fr 2fr; gap:16px; align-items:start;">
      <div class="card" style="margin:0;">
        <div class="card-header"><div class="card-title"><span class="icon">💡</span> مربعات النصائح</div></div>
        <div style="padding:14px;">
          <button class="btn btn-gold btn-sm" type="button" data-action="add-tip-card">➕ إضافة نصيحة</button>
          <div style="margin-top:12px;">${renderTipsCardsList()}</div>
        </div>
      </div>
      <div class="card" style="margin:0;">
        <div class="card-header"><div class="card-title"><span class="icon">✏️</span> ${active ? 'تعديل مربع النصيحة' : 'إضافة مربع نصيحة'}</div></div>
        <div style="padding:14px;">
          <div class="empty-hint" style="margin-bottom:14px;line-height:1.7">
            العنوان والوصف العلوي لقسم النصائح ثابتين كما هما في التطبيق. أي بيانات تضيفها هنا ستظهر كمربع نصيحة جديد أسفلهم، ويمكنك اختيار أي مربع من القائمة لتعديله.
          </div>
          ${active ? `
          <form id="tips-card-form">
            <div class="form-row" data-builder-row="true">
              <div class="form-group" style="flex:0 0 120px">
                <label>الأيقونة</label>
                <input class="form-control" name="icon" value="${escAttr(active.icon || '💡')}" placeholder="💡">
              </div>
              <div class="form-group" style="flex:1">
                <label>العنوان (عربي)</label>
                <input class="form-control" name="title_ar" value="${escAttr(active.title_ar || '')}" dir="rtl">
              </div>
              <div class="form-group" style="flex:1">
                <label>العنوان (إنجليزي/اختياري)</label>
                <input class="form-control" name="title_en" value="${escAttr(active.title_en || '')}">
              </div>
            </div>
            <div class="form-group">
              <label>المحتوى (عربي)</label>
              <textarea class="form-control" name="content_ar" rows="4" dir="rtl">${escHtml(active.content_ar || '')}</textarea>
            </div>
            <div class="form-group">
              <label>المحتوى (إنجليزي/اختياري)</label>
              <textarea class="form-control" name="content_en" rows="4">${escHtml(active.content_en || '')}</textarea>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
              <button type="submit" class="btn btn-gold">💾 حفظ النصائح</button>
              <button type="button" class="btn btn-outline" data-action="delete-tip-card" data-index="${_activeTipIndex}">🗑️ حذف هذا المربع</button>
            </div>
          </form>` : '<div class="empty-state"><div class="empty-icon">💡</div><div class="empty-text">اضغط إضافة نصيحة للبدء</div></div>'}
        </div>
      </div>
    </div>
  `;
  container.innerHTML = html;

  const form = document.getElementById('tips-card-form');
  if(form){
    form.addEventListener('submit', async(e)=>{
      e.preventDefault();
      const tip = _tipsCardsJson[_activeTipIndex];
      if(!tip) return;
      tip.icon = form.elements.icon.value.trim() || '💡';
      tip.title_ar = form.elements.title_ar.value.trim();
      tip.title_en = form.elements.title_en.value.trim();
      tip.content_ar = form.elements.content_ar.value.trim();
      tip.content_en = form.elements.content_en.value.trim();
      await saveTipsCards();
    });
  }
}

async function saveTipsCards(){
  const payload = {
    cards_json: JSON.stringify(_tipsCardsJson),
    title_ar: '',
    title_en: '',
    content_ar: '',
    content_en: ''
  };
  try{
    await api('/api/admin/content/tips',{method:'PATCH',body:JSON.stringify(payload)});
    toast('تم حفظ مربعات النصائح بنجاح','success');
    renderTipsCardsEditor(null);
  }catch(err){
    toast('فشل في الحفظ: '+err.message,'error');
  }
}

window._selectTipCard = function(index){
  _activeTipIndex = index;
  renderTipsCardsEditor(null);
};

window._addTipCard = function(){
  _tipsCardsJson.push({icon:'💡', title_ar:'نصيحة جديدة', title_en:'', content_ar:'اكتب محتوى النصيحة هنا', content_en:''});
  _activeTipIndex = _tipsCardsJson.length - 1;
  renderTipsCardsEditor(null);
};

window._deleteTipCard = async function(index){
  if(!confirm('حذف مربع النصيحة هذا؟')) return;
  _tipsCardsJson.splice(index, 1);
  _activeTipIndex = Math.min(index, Math.max(_tipsCardsJson.length - 1, 0));
  await saveTipsCards();
};

function renderContentField(f, value){
  const placeholder = f.placeholder ? ` placeholder="${escAttr(f.placeholder)}"` : '';
  let html = `<div class="form-group">
    <label>${f.label}</label>`;
  if(f.type === 'textarea'){
    html += `<textarea class="form-control" name="${f.key}" rows="4"${placeholder}>${escHtml(String(value))}</textarea>`;
  } else {
    html += `<input type="text" class="form-control" name="${f.key}" value="${escAttr(String(value))}"${placeholder}>`;
  }
  if(f.help){
    html += `<div class="empty-hint" style="margin-top:6px;line-height:1.6">${escHtml(f.help)}</div>`;
  }
  html += `</div>`;
  return html;
}

function renderContentEditor(section, data){
  const config = sectionLabels[section] || sectionLabels.intro;
  const container = $('#content-editor-body');
  const mainFields = config.fields.filter(f=>!f.optional);
  const optionalFields = config.fields.filter(f=>f.optional);
  let html = `<form id="content-form" class="fade-in">`;
  if(config.description){
    html += `<div class="empty-hint" style="margin-bottom:16px;line-height:1.8;padding:12px 14px;border:1px solid rgba(212,175,55,.28);border-radius:12px;background:rgba(212,175,55,.08)">
      💡 ${escHtml(config.description)}
    </div>`;
  }
  mainFields.forEach(f=>{
    const value = data && data[f.key] !== undefined ? data[f.key] : '';
    html += renderContentField(f, value);
  });
  if(optionalFields.length){
    html += `<details style="margin-top:10px">
      <summary class="btn btn-outline btn-sm" style="display:inline-flex;cursor:pointer">إظهار الحقول الاختيارية / الإنجليزية</summary>
      <div style="margin-top:14px">`;
    optionalFields.forEach(f=>{
      const value = data && data[f.key] !== undefined ? data[f.key] : '';
      html += renderContentField(f, value);
    });
    html += `</div></details>`;
  }
  html += `<div style="display:flex;gap:10px;margin-top:18px">
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
        <button class="btn btn-outline btn-sm" data-action="edit-staff" data-index="${i}">✏️</button>
        <button class="btn btn-outline btn-sm" data-action="archive-staff" data-index="${i}" style="margin-right:4px;color:var(--danger)">أرشفة</button>
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
    <div class="form-row" data-builder-row="true">
      <div class="form-group">
        <label>الاسم الكامل (عربي) *</label>
        <input type="text" class="form-control" id="sf-name-ar" value="${escAttr(emp.name_ar||emp.nameAr||'')}" required>
      </div>
      <div class="form-group">
        <label>Full Name (English) *</label>
        <input type="text" class="form-control" id="sf-name-en" value="${escAttr(emp.name_en||emp.nameEn||'')}" required dir="ltr">
      </div>
    </div>
    <div class="form-row" data-builder-row="true">
      <div class="form-group">
        <label>رقم الموظف *</label>
        <input type="text" class="form-control" id="sf-empid" value="${escAttr(emp.employeeId||emp.employee_id||'')}" required>
      </div>
      <div class="form-group">
        <label>القسم *</label>
        <select class="form-control" id="sf-dept">${deptOptions}</select>
      </div>
    </div>
    <div class="form-row" data-builder-row="true">
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
      '<button class="btn btn-gold" id="staff-save-new">💾 حفظ</button><button class="btn btn-outline" data-action="close-modal">إلغاء</button>'
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
    `<button class="btn btn-gold" id="staff-save-edit">💾 حفظ التعديلات</button><button class="btn btn-outline" data-action="close-modal">إلغاء</button>`
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
    `<button class="btn btn-danger" id="staff-confirm-archive">تأكيد الأرشفة</button><button class="btn btn-outline" data-action="close-modal">إلغاء</button>`
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
  let html = `<button ${auditPage<=1?'disabled':''} data-action="audit-page" data-page="${auditPage-1}">‹</button>`;
  for(let i=1;i<=auditTotalPages;i++){
    if(auditTotalPages>7 && Math.abs(i-auditPage)>2 && i!==1 && i!==auditTotalPages){
      if(i===2||i===auditTotalPages-1) html+='<button disabled>…</button>';
      continue;
    }
    html += `<button class="${i===auditPage?'active':''}" data-action="audit-page" data-page="${i}">${i}</button>`;
  }
  html += `<button ${auditPage>=auditTotalPages?'disabled':''} data-action="audit-page" data-page="${auditPage+1}">›</button>`;
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
   MODULE: ADMINS
   ═══════════════════════════════════════════════ */
function adminFormHtml(){
  return `
    <div class="form-group">
      <label for="af-username">اسم المستخدم *</label>
      <input type="text" class="form-control" id="af-username" dir="ltr" autocomplete="username"
        placeholder="مثال: admin2" pattern="[A-Za-z0-9._-]{3,32}" required>
      <div class="form-hint">3–32 حرفاً: إنجليزي، أرقام، نقطة، شرطة سفلية أو وسطية.</div>
    </div>
    <div class="form-group">
      <label for="af-password">كلمة المرور *</label>
      <input type="password" class="form-control" id="af-password" autocomplete="new-password" required>
      <div class="form-hint">8 أحرف على الأقل.</div>
    </div>
    <div class="form-group">
      <label for="af-password-confirm">تأكيد كلمة المرور *</label>
      <input type="password" class="form-control" id="af-password-confirm" autocomplete="new-password" required>
    </div>
  `;
}

function getAdminFormData(){
  const username = (($('#af-username')||{}).value || '').trim();
  const password = ($('#af-password')||{}).value || '';
  const confirm = ($('#af-password-confirm')||{}).value || '';
  if(!username || !password){
    toast('يرجى تعبئة اسم المستخدم وكلمة المرور','warning');
    return null;
  }
  if(!/^[a-zA-Z0-9._-]{3,32}$/.test(username)){
    toast('اسم المستخدم غير صالح','warning');
    return null;
  }
  if(password.length < 8){
    toast('كلمة المرور يجب أن تكون 8 أحرف على الأقل','warning');
    return null;
  }
  if(password !== confirm){
    toast('تأكيد كلمة المرور غير مطابق','warning');
    return null;
  }
  return { username, password };
}

async function loadAdmins(){
  const container = $('#admins-table-content');
  if(!container) return;
  container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>جاري تحميل البيانات…</p></div>';
  try{
    const res = await api('/api/admin/admins');
    const rows = res.data || [];
    if(!rows.length){
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-text">لا يوجد مشرفون مسجلون</div></div>';
      return;
    }
    let html = '<div class="table-wrap"><table class="data-table"><thead><tr>' +
      '<th>#</th><th>اسم المستخدم</th><th>تاريخ الإنشاء</th></tr></thead><tbody>';
    rows.forEach((row, i) => {
      const isSelf = row.username && $('#header-username') &&
        row.username === $('#header-username').textContent;
      html += `<tr>
        <td>${i + 1}</td>
        <td><strong>${escHtml(row.username)}</strong>${isSelf ? ' <span class="status-badge status-active">أنت</span>' : ''}</td>
        <td>${formatDateTime(row.created_at)}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
  }catch(err){
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">فشل التحميل</div><div class="empty-hint">${escHtml(err.message)}</div></div>`;
  }
}

async function saveNewAdmin(){
  const body = getAdminFormData();
  if(!body) return;
  const btn = $('#admin-save-new');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner spinner-sm" style="border-color:rgba(255,255,255,.3);border-top-color:#fff"></div>';
  try{
    await api('/api/admin/admins', { method:'POST', body: JSON.stringify(body) });
    toast('تم إنشاء حساب المشرف بنجاح','success');
    closeModal();
    loadAdmins();
  }catch(err){
    toast('فشل الإضافة: ' + err.message, 'error');
  }finally{
    btn.disabled = false;
    btn.innerHTML = '💾 إنشاء الحساب';
  }
}

onReady(()=>{
  const adminAddBtn = $('#admin-add-btn');
  if(adminAddBtn){
    adminAddBtn.addEventListener('click', ()=>{
      openModal('➕ إضافة مشرف جديد', adminFormHtml(),
        '<button class="btn btn-gold" id="admin-save-new">💾 إنشاء الحساب</button><button class="btn btn-outline" data-action="close-modal">إلغاء</button>'
      );
      setTimeout(()=>{
        const saveBtn = $('#admin-save-new');
        if(saveBtn) saveBtn.addEventListener('click', saveNewAdmin);
      }, 50);
    });
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
