// renderer.js - Handles fetching and rendering dynamic content from JSON

/**
 * Lightweight HTML sanitizer — strips event handlers and javascript: hrefs
 * from untrusted raw_content before it is injected via innerHTML.
 * This is a defence-in-depth measure; the primary trust boundary is the
 * server-side JSON files which are authored internally.
 */
function sanitizeHTML(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;

  const FORBIDDEN_ATTRS = [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
    'onkeydown', 'onkeyup', 'onkeypress', 'onsubmit', 'onchange',
    'oninput', 'ondblclick', 'oncontextmenu', 'onwheel', 'ondrag'
  ];

  tpl.content.querySelectorAll('*').forEach(el => {
    // Remove dangerous event-handler attributes
    FORBIDDEN_ATTRS.forEach(attr => el.removeAttribute(attr));

    // Remove javascript: hrefs / srcs
    ['href', 'src', 'action', 'formaction'].forEach(attr => {
      const val = el.getAttribute(attr);
      if (val && /^\s*javascript:/i.test(val)) el.removeAttribute(attr);
    });

    // Remove <script> and <iframe> entirely
    if (el.tagName === 'SCRIPT' || el.tagName === 'IFRAME') {
      el.remove();
    }
  });

  // Serialize back to a string
  const div = document.createElement('div');
  div.appendChild(tpl.content.cloneNode(true));
  return div.innerHTML;
}

async function renderChemicals() {
  const container = document.querySelector('.products-grid');
  if (!container) return;

  try {
    const chemicals = await ChemicalService.getChemicals();

    container.innerHTML = chemicals.map(chem => `
      <article class="product-card" id="${chem.id}" data-theme="${chem.theme}">
        ${sanitizeHTML(chem.raw_content)}
      </article>
    `).join('');
  } catch (err) {
    console.error('Failed to load chemicals data:', err);
    container.innerHTML = '<div class="empty-state">Failed to load chemicals.</div>';
  }
}

async function renderPrograms() {
  const container = document.querySelector('.programs-grid');
  if (!container) return;

  try {
    const programs = await ProgramService.getPrograms();

    container.innerHTML = programs.map(prog => `
      <article class="prog-card ${prog.id.includes('special') ? 'prog-card-special' : ''}" id="${prog.id}" data-program-type="${prog.type}">
        ${sanitizeHTML(prog.raw_content)}
      </article>
    `).join('');
  } catch (err) {
    console.error('Failed to load programs data:', err);
    container.innerHTML = '<div class="empty-state">Failed to load programs.</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderChemicals();
  renderPrograms();
});
