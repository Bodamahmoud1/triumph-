// renderer.js - Handles fetching and rendering dynamic content from JSON

async function renderChemicals() {
  const container = document.getElementById('chemicals-grid');
  if (!container) return;

  try {
    const chemicals = await ChemicalService.getChemicals();

    container.innerHTML = chemicals.map(chem => `
      <article class="product-card" id="${chem.id}" data-theme="${chem.theme}">
        ${chem.raw_content}
      </article>
    `).join('');
  } catch (err) {
    console.error('Failed to load chemicals data:', err);
    container.innerHTML = '<div class="empty-state">Failed to load chemicals.</div>';
  }
}

async function renderPrograms() {
  const container = document.getElementById('programs-grid');
  if (!container) return;

  try {
    const programs = await ProgramService.getPrograms();

    container.innerHTML = programs.map(prog => `
      <article class="prog-card ${prog.id.includes('special') ? 'prog-card-special' : ''}" id="${prog.id}" data-program-type="${prog.type}">
        ${prog.raw_content}
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
