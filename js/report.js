// js/report.js - Incident & Problem Report System

function initReportSystem() {
  const container = document.createElement('div');
  container.innerHTML = `
    <!-- Report Button -->
    <button id="report-fab" style="position:fixed;bottom:90px;left:20px;width:50px;height:50px;border-radius:25px;background:var(--danger,#d94444);color:white;border:none;box-shadow:0 4px 10px rgba(0,0,0,0.3);font-size:24px;cursor:pointer;z-index:90;display:flex;align-items:center;justify-content:center;">
      ⚠️
    </button>

    <!-- Report Modal -->
    <div id="report-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;width:100%;max-width:500px;border-radius:12px;padding:24px;position:relative;">
        <button id="close-report" style="position:absolute;top:15px;right:15px;background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
        <h3 style="margin-top:0;color:var(--navy,#0f1e42);border-bottom:1px solid #eee;padding-bottom:10px;">⚠️ الإبلاغ عن مشكلة</h3>
        
        <form id="report-form" style="margin-top:15px;">
          <div style="margin-bottom:15px;">
            <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:14px;">نوع المشكلة *</label>
            <select name="category" required style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;">
              <option value="">اختر...</option>
              <option value="stain">بقع لم تزل (Stain not removed)</option>
              <option value="damage">تلف في القماش (Fabric damage)</option>
              <option value="machine">عطل في الماكينة (Machine error)</option>
              <option value="chemical">مشكلة في الكيماويات (Chemical issue)</option>
            </select>
          </div>
          
          <div style="margin-bottom:15px;">
            <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:14px;">رقم البرنامج (اختياري)</label>
            <input type="number" name="program" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;">
          </div>
          
          <div style="margin-bottom:15px;">
            <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:14px;">التفاصيل *</label>
            <textarea name="description" required rows="4" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"></textarea>
          </div>
          
          <button type="submit" style="width:100%;padding:12px;background:var(--gold,#c5a05a);color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">إرسال التقرير</button>
        </form>
      </div>
    </div>
  `;
  
  document.body.appendChild(container);
  
  const fab = document.getElementById('report-fab');
  const modal = document.getElementById('report-modal');
  const closeBtn = document.getElementById('close-report');
  const form = document.getElementById('report-form');
  
  fab.addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = 'جاري الإرسال...';
    btn.disabled = true;
    
    // Simulate API call for now (can be hooked up to backend later)
    setTimeout(() => {
      alert('تم إرسال التقرير بنجاح! سيتم مراجعته من قبل الإدارة.');
      modal.style.display = 'none';
      form.reset();
      btn.textContent = 'إرسال التقرير';
      btn.disabled = false;
    }, 1000);
  });
}

document.addEventListener('DOMContentLoaded', initReportSystem);
