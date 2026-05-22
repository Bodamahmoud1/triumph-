const fs = require('fs');

let content = fs.readFileSync('b:\\Downloads\\clax\\index.html', 'utf8');
const lines = content.split(/\r?\n/);

const correctHTML = `<div class="tip-card-icon">⏱️</div>
            <h4 class="tip-card-title">وقت الغسيل</h4>
            <p class="tip-card-text">التزم بأوقات الغسيل المحددة في كل برنامج. الوقت الزائد يُهلك الأقمشة والوقت القليل لا يعطي نتيجة كافية.</p>
          </div>
          <div class="tip-card">
            <div class="tip-card-icon">📏</div>
            <h4 class="tip-card-title">جرعة الكيماويات</h4>
            <p class="tip-card-text">اتبع الجرعات المحددة بدقة. الزيادة في الكيماويات قد تتلف الأقمشة وتسبب تهيج الجلد، والنقصان يضعف جودة الغسيل.</p>
          </div>
        </div>
      </div>
    </div><!-- /section-tips -->

  </div><!-- /page-wrap -->

  <!-- ═══ BOTTOM NAVIGATION BAR ═══ -->
  <nav class="bottom-nav" id="bottom-nav" aria-label="Primary sections" role="tablist">
    <button class="bnav-item is-active" type="button" role="tab" aria-selected="true" data-section="landing" onclick="switchSection('landing')" aria-label="Home / الرئيسية">
      <span class="bnav-icon">🏠</span>
      <span class="bnav-label">Home / الرئيسية</span>
      <span class="bnav-indicator"></span>
    </button>
    <button class="bnav-item" type="button" role="tab" aria-selected="false" data-section="chemicals" onclick="switchSection('chemicals')" aria-label="Chemicals / الكيماويات">
      <span class="bnav-icon">🧪</span>
      <span class="bnav-label">Chemicals / الكيماويات</span>
      <span class="bnav-indicator"></span>
    </button>
    <button class="bnav-item" type="button" role="tab" aria-selected="false" data-section="programs" onclick="switchSection('programs')" aria-label="Programs / البرامج">
      <span class="bnav-icon">⚙️</span>
      <span class="bnav-label">Programs / البرامج</span>
      <span class="bnav-indicator"></span>
    </button>
    <button class="bnav-item" type="button" role="tab" aria-selected="false" data-section="schedule" onclick="switchSection('schedule')" aria-label="Schedule / جدول العمل">
      <span class="bnav-icon">📅</span>
      <span class="bnav-label">Schedule / الجدول</span>
      <span class="bnav-indicator"></span>
    </button>`;

// Lines 717 to 718 (0-indexed 716 and 717) are the corrupted part.
// We will replace from line 717 up to line 718.
// Actually, let's just splice it.
lines.splice(717, 2, correctHTML);

fs.writeFileSync('b:\\Downloads\\clax\\index.html', lines.join('\n'), 'utf8');
console.log('Fixed index.html via lines');
