(function (global) {
  function createChemicalCard(item) {
    var liUse = item.use_for.map(function (x) { return '<li>' + x + '</li>'; }).join('');
    var liAvoid = item.avoid_for.map(function (x) { return '<li>' + x + '</li>'; }).join('');

    return [
      '<article class="product-card" id="', item.id, '" data-theme="', item.theme, '">',
      '  <header class="card-header" data-theme="', item.theme, '">',
      '    <div class="card-prod-name">', item.name, '</div>',
      '    <span class="card-tag">', item.category, '</span>',
      '  </header>',
      '  <div class="card-body">',
      '    <p class="card-sub">', item.subtitle, '</p>',
      '    <div class="card-kpis">',
      '      <span><strong>pH:</strong> ', item.ph, '</span>',
      '      <span><strong>Dosage:</strong> ', item.dosage_ml_kg, ' ml/kg</span>',
      '      <span><strong>Temp:</strong> ', item.temp_c, ' °C</span>',
      '    </div>',
      liUse ? '    <div class="card-block"><strong>Use for:</strong><ul>' + liUse + '</ul></div>' : '',
      liAvoid ? '    <div class="card-block"><strong>Avoid for:</strong><ul>' + liAvoid + '</ul></div>' : '',
      item.notes ? '    <p class="card-note">' + item.notes + '</p>' : '',
      '  </div>',
      '</article>'
    ].join('');
  }

  function createProgramCard(item, index) {
    var chem = item.chemicals.join(' • ');
    return [
      '<article class="prog-card" id="', item.id, '" data-program-type="', item.family, '">',
      '  <div class="prog-card-head">',
      '    <div class="prog-no">', (index + 1), '</div>',
      '    <div>',
      '      <h3 class="prog-en">', item.name, '</h3>',
      '      <p class="prog-family">', item.family, ' • ', item.load, '</p>',
      '    </div>',
      '  </div>',
      '  <div class="prog-body">',
      '    <p><strong>Temperature:</strong> ', item.temp_c, '°C</p>',
      '    <p><strong>Cycle time:</strong> ', item.time_min, ' min</p>',
      '    <p><strong>Chemicals:</strong> ', chem, '</p>',
      item.notes ? '    <p class="prog-note">' + item.notes + '</p>' : '',
      '  </div>',
      '</article>'
    ].join('');
  }

  function setCount(selector, count, labelSingular, labelPlural) {
    var el = document.querySelector(selector);
    if (!el) return;
    el.textContent = count + ' ' + (count === 1 ? labelSingular : labelPlural);
  }

  function renderChemicals(items) {
    var grid = document.querySelector('.products-grid');
    if (!grid) return;
    grid.innerHTML = items.map(createChemicalCard).join('');
    setCount('#chemicals-count', items.length, 'chemical', 'chemicals');
  }

  function renderPrograms(items) {
    var grid = document.querySelector('.programs-grid');
    if (!grid) return;
    grid.innerHTML = items.map(createProgramCard).join('');
    setCount('#programs-count', items.length, 'program', 'programs');
  }

  function renderFallback(message) {
    ['.products-grid', '.programs-grid'].forEach(function (selector) {
      var el = document.querySelector(selector);
      if (el) {
        el.innerHTML = '<div class="empty-state"><strong>' + message + '</strong></div>';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!global.ChemicalService || !global.ProgramService) return;

    Promise.all([global.ChemicalService.fetchAll(), global.ProgramService.fetchAll()])
      .then(function (payload) {
        renderChemicals(payload[0]);
        renderPrograms(payload[1]);
        document.dispatchEvent(new CustomEvent('laundry:data-ready'));
      })
      .catch(function () {
        renderFallback('Unable to load guide data.');
      });
  });
})(window);
