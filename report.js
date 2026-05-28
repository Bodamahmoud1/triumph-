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

  var bg   = type === 'error' ? 'error' : 'success';
  var icon = type === 'error' ? '✕' : '✓';

  toast.className = bg;

  toast.innerHTML = '<span style="font-size:18px">' + icon + '</span><span class="toast-message"></span>';
  toast.querySelector('.toast-message').textContent = message;
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
    '<button id="report-fab">',
    '  \u26a0\ufe0f',
    '</button>',

    '<!-- Report Modal -->',
    '<div id="report-modal">',
    '  <div class="modal-content">',
    '    <button id="close-report">&times;</button>',
    '    <h3>\u26a0\ufe0f \u0627\u0644\u0625\u0628\u0644\u0627\u063a \u0639\u0646 \u0645\u0634\u0643\u0644\u0629</h3>',
    '    <form id="report-form">',
    '      <div>',
    '        <label>\u0646\u0648\u0639 \u0627\u0644\u0645\u0634\u0643\u0644\u0629 *</label>',
    '        <select name="category" required>',
    '          <option value="">\u0627\u062e\u062a\u0631...</option>',
    '          <option value="stain">\u0628\u0642\u0639 \u0644\u0645 \u062a\u0632\u0644 (Stain not removed)</option>',
    '          <option value="damage">\u062a\u0644\u0641 \u0641\u064a \u0627\u0644\u0642\u0645\u0627\u0634 (Fabric damage)</option>',
    '          <option value="machine">\u0639\u0637\u0644 \u0641\u064a \u0627\u0644\u0645\u0627\u0643\u064a\u0646\u0629 (Machine error)</option>',
    '          <option value="chemical">\u0645\u0634\u0643\u0644\u0629 \u0641\u064a \u0627\u0644\u0643\u064a\u0645\u0627\u0648\u064a\u0627\u062a (Chemical issue)</option>',
    '        </select>',
    '      </div>',
    '      <div>',
    '        <label>\u0631\u0642\u0645 \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)</label>',
    '        <input type="number" name="program" min="1" max="13">',
    '      </div>',
    '      <div>',
    '        <label>\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644 *</label>',
    '        <textarea name="description" required rows="4" maxlength="1000"></textarea>',
    '      </div>',
    '      <button type="submit">\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u0631\u064a\u0631</button>',
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
      showToast('(محاكاة) تم إرسال التقرير بنجاح! سيتم مراجعته من قبل الإدارة.', 'success');
    }, 1000);
  });
}

document.addEventListener('DOMContentLoaded', initReportSystem);
