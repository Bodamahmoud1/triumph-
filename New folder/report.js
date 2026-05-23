// js/report.js - Incident & Problem Report System

/**
 * showToast(message, type)
 * type: 'success' | 'error'
 * Renders a non-blocking toast instead of the native alert() dialog.
 */
function showToast(message, type) {
  type = type || 'success';
  var existing = document.getElementById('triumph-toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.id = 'triumph-toast';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');

  var bg   = type === 'error' ? '#d94444' : '#2a7a2a';
  var icon = type === 'error' ? '✕' : '✓';

  toast.style.cssText = [
    'position:fixed',
    'bottom:100px',
    'left:50%',
    'transform:translateX(-50%)',
    'background:' + bg,
    'color:#fff',
    'padding:14px 24px',
    'border-radius:12px',
    'font-size:14px',
    'font-weight:700',
    'font-family:inherit',
    'box-shadow:0 8px 30px rgba(0,0,0,0.25)',
    'z-index:9999',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'max-width:90vw',
    'opacity:0',
    'transition:opacity 0.3s ease'
  ].join(';');

  toast.innerHTML = '<span style="font-size:18px">' + icon + '</span><span>' + message + '</span>';
  document.body.appendChild(toast);

  // Fade in
  requestAnimationFrame(function() {
    requestAnimationFrame(function() { toast.style.opacity = '1'; });
  });

  // Auto-dismiss after 3.5 s
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 320);
  }, 3500);
}

function initReportSystem() {
  var container = document.createElement('div');
  container.innerHTML = [
    '<!-- Report Button -->',
    '<button id="report-fab" style="position:fixed;bottom:90px;left:20px;width:50px;height:50px;border-radius:25px;background:var(--danger,#d94444);color:white;border:none;box-shadow:0 4px 10px rgba(0,0,0,0.3);font-size:24px;cursor:pointer;z-index:90;display:flex;align-items:center;justify-content:center;">',
    '  \u26a0\ufe0f',
    '</button>',

    '<!-- Report Modal -->',
    '<div id="report-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:100;align-items:center;justify-content:center;padding:20px;">',
    '  <div style="background:white;width:100%;max-width:500px;border-radius:12px;padding:24px;position:relative;">',
    '    <button id="close-report" style="position:absolute;top:15px;right:15px;background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>',
    '    <h3 style="margin-top:0;color:var(--navy,#0f1e42);border-bottom:1px solid #eee;padding-bottom:10px;">\u26a0\ufe0f \u0627\u0644\u0625\u0628\u0644\u0627\u063a \u0639\u0646 \u0645\u0634\u0643\u0644\u0629</h3>',
    '    <form id="report-form" style="margin-top:15px;">',
    '      <div style="margin-bottom:15px;">',
    '        <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:14px;">\u0646\u0648\u0639 \u0627\u0644\u0645\u0634\u0643\u0644\u0629 *</label>',
    '        <select name="category" required style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;">',
    '          <option value="">\u0627\u062e\u062a\u0631...</option>',
    '          <option value="stain">\u0628\u0642\u0639 \u0644\u0645 \u062a\u0632\u0644 (Stain not removed)</option>',
    '          <option value="damage">\u062a\u0644\u0641 \u0641\u064a \u0627\u0644\u0642\u0645\u0627\u0634 (Fabric damage)</option>',
    '          <option value="machine">\u0639\u0637\u0644 \u0641\u064a \u0627\u0644\u0645\u0627\u0643\u064a\u0646\u0629 (Machine error)</option>',
    '          <option value="chemical">\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u0643\u064a\u0645\u0627\u0648\u064a\u0627\u062a (Chemical issue)</option>',
    '        </select>',
    '      </div>',
    '      <div style="margin-bottom:15px;">',
    '        <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:14px;">\u0631\u0642\u0645 \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</label>',
    '        <input type="number" name="program" min="1" max="13" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;">',
    '      </div>',
    '      <div style="margin-bottom:15px;">',
    '        <label style="display:block;margin-bottom:5px;font-weight:bold;font-size:14px;">\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644 *</label>',
    '        <textarea name="description" required rows="4" maxlength="1000" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px;"></textarea>',
    '      </div>',
    '      <button type="submit" style="width:100%;padding:12px;background:var(--gold,#c5a05a);color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u0631\u064a\u0631</button>',
    '    </form>',
    '  </div>',
    '</div>'
  ].join('\n');

  document.body.appendChild(container);

  var fab     = document.getElementById('report-fab');
  var modal   = document.getElementById('report-modal');
  var closeBtn = document.getElementById('close-report');
  var form    = document.getElementById('report-form');

  fab.addEventListener('click', function() {
    modal.style.display = 'flex';
  });

  closeBtn.addEventListener('click', function() {
    modal.style.display = 'none';
  });

  // Close on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.style.display = 'none';
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    var originalText = btn.textContent;
    btn.textContent = '\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0631\u0633\u0627\u0644...';
    btn.disabled = true;

    // Simulate API call (hook up to real endpoint when ready)
    setTimeout(function() {
      modal.style.display = 'none';
      form.reset();
      btn.textContent = originalText;
      btn.disabled = false;
      showToast('\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u0631\u064a\u0631 \u0628\u0646\u062c\u0627\u062d! \u0633\u064a\u062a\u0645 \u0645\u0631\u0627\u062c\u0639\u062a\u0647 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062f\u0627\u0631\u0629.', 'success');
    }, 1000);
  });
}

document.addEventListener('DOMContentLoaded', initReportSystem);
