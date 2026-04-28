import io
import re

html_path = r'b:\Downloads\clax\index.html'
with io.open(html_path, 'r', encoding='utf-8') as f:
    index_html = f.read()

with io.open(r'b:\Downloads\clax\generated_programs.txt', 'r', encoding='utf-8') as f:
    programs_html = f.read()

tips_html = """
  </div><!-- /programs-grid -->

  <!-- Best Practices / Tips Section -->
  <div class="prog-tips-section">
    <div class="prog-tips-header">
      <span class="prog-tips-icon">💡</span>
      <h3>نصائح هامة لنجاح عملية الغسيل</h3>
    </div>
    <ul class="prog-tips-list">
      <li><strong>فرز الملابس (Sorting):</strong> يُفضل دائماً فصل الألوان الفاتحة عن الغوامق، وفصل الفوط والبشاكير عن الملايات لتجنب وبر الأقمشة.</li>
      <li><strong>مستوى المياه (Water Level):</strong> تأكد من ضبط مستوى المياه بشكل صحيح؛ المياه الزائدة تقلل من تركيز الكيماويات والمياه القليلة تسبب احتكاكاً قد يضر الأنسجة.</li>
      <li><strong>ضبط درجات الحرارة:</strong> درجة الحرارة المثالية لعمليات التبييض (Bleaching) هي بين 60°C و 65°C لضمان تفاعل آمن وفعّال.</li>
      <li><strong>عملية التعادل (Neutralization):</strong> مرحلة الساور (Sour) أساسية جداً لمعادلة قلوية الغسيل ومنع اصفرار الملابس أو تهيج الجلد.</li>
    </ul>
  </div>
"""

pattern = r'(<div class="programs-grid">)(.*?)(</div><!-- /programs-grid -->)'
replacement = r'\1\n' + programs_html.replace('\\', '\\\\') + '\n' + tips_html.replace('\\', '\\\\')

new_html = re.sub(pattern, replacement, index_html, flags=re.DOTALL)

with io.open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html)
