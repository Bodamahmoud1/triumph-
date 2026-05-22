const fs = require('fs');

let content = fs.readFileSync('b:\\Downloads\\clax\\index.html', 'utf8');

// The file was corrupted around tip-card-icon ⏱️
// We will replace everything from <div class="tip-card-icon">⏱️</div> until the end of the bottom nav
// with the correct, clean HTML.

const startMarker = '<div class="tip-card-icon">⏱️</div>';
const endMarker = '<!-- ═══ END BOTTOM NAV ═══ -->';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
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
    </button>
    <button class="bnav-item" type="button" role="tab" aria-selected="false" data-section="tips" onclick="switchSection('tips')" aria-label="Tips / النصائح">
      <span class="bnav-icon">💡</span>
      <span class="bnav-label">Tips / النصائح</span>
      <span class="bnav-indicator"></span>
    </button>
  </nav>
  <!-- ═══ END BOTTOM NAV ═══ -->`;

  const newContent = content.substring(0, startIndex) + correctHTML + content.substring(endIndex + endMarker.length);
  fs.writeFileSync('b:\\Downloads\\clax\\index.html', newContent, 'utf8');
  console.log('Fixed index.html');
} else {
  console.log('Markers not found');
}
