(function (global) {
  var chemicalAr = {
    'CLAX Hypo': 'كلور للتبييض',
    'Soft Extra': 'منعم للأقمشة',
    'Build Lite': 'منشط قلوي',
    'Sonril Ultra': 'مبيض أوكسجين',
    'Neutrapur': 'معادل حموضة',
    'Neutra 3in1': 'محيد قلوية + محيد كلور + مزيل صدأ',
    'CLAX 200': 'منظف للملابس البيضاء',
    'CLAX 100 Color': 'منظف آمن للألوان'
  };

  var familyAr = {
    linen: 'مفروشات',
    towels: 'فوط',
    table: 'مفارش طاولات',
    uniforms: 'يونيفورم',
    utility: 'مساعد'
  };

  function productIcon(brand, main, sub, color, tint) {
    return '<svg viewBox="0 0 120 112" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">' +
      '<rect x="10" y="8" width="100" height="96" rx="18" fill="' + tint + '" stroke="' + color + '" stroke-width="3"/>' +
      '<rect x="36" y="10" width="48" height="14" rx="4" fill="#fff" stroke="' + color + '" stroke-width="2"/>' +
      '<path d="M27 43c9-10 21-15 33-15s24 5 33 15v41c-9 8-21 12-33 12s-24-4-33-12V43z" fill="#fff" stroke="' + color + '" stroke-width="2.5"/>' +
      '<rect x="34" y="50" width="52" height="28" rx="7" fill="' + color + '"/>' +
      '<text x="60" y="44" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="' + color + '">' + brand + '</text>' +
      '<text x="60" y="69" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#fff">' + main + '</text>' +
      '<text x="60" y="91" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="800" fill="' + color + '">' + sub + '</text>' +
      '</svg>';
  }

  var chemicalIcons = {
    hypo: productIcon('CLAX', 'HYPO', 'BLEACH', '#c8a96e', '#fff8e8'),
    soft: productIcon('CLAX', 'SOFT', 'EXTRA', '#c22882', '#fff0f8'),
    buildlite: productIcon('CLAX', 'BUILD', 'LITE', '#2b52a8', '#eef4ff'),
    sonril: productIcon('CLAX', 'O2', 'SONRIL', '#c8a96e', '#fff8e8'),
    neutrapur: productIcon('CLAX', 'pH', 'NEUTRA', '#cc2200', '#fff3f0'),
    neutra3in1: productIcon('CLAX', '3in1', 'NEUTRA', '#cc2200', '#fff3f0'),
    clax200: productIcon('CLAX', '200', 'DEGREASE', '#2a7a2a', '#edfaed'),
    clax100: productIcon('CLAX', '100', 'COLOR', '#2a7a2a', '#edfaed'),
    seitzv1: productIcon('SEITZ', 'V1', 'GREASE', '#2a7a2a', '#edfaed'),
    seitzv2: productIcon('SEITZ', 'V2', 'PROTEIN', '#2b52a8', '#eef4ff'),
    seitzv3: productIcon('SEITZ', 'V3', 'TANNIN', '#cc2200', '#fff3f0')
  };

  function injectChemicalIcons() {
    var cards = document.querySelectorAll('.product-card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var iconBox = card.querySelector('.card-icon-box');
      if (!iconBox) continue;
      if (iconBox.innerHTML.trim()) continue;
      var icon = chemicalIcons[card.id];
      if (icon) iconBox.innerHTML = icon;
    }
  }

  function joinList(items) {
    return (items || []).map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
  }

  function escapeHtml(value) {
    var div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  }

  function attr(name, value) {
    return value ? ' ' + name + '="' + escapeHtml(value) + '"' : '';
  }

  function buildContentSections(sections) {
    return (sections || []).map(function (section) {
      var html = '<div class="sec-head head-theme">' + escapeHtml(section.title) + '</div>';
      html += (section.paragraphs || []).map(function (text) {
        return '<p class="btext">' + escapeHtml(text) + '</p>';
      }).join('');
      if (section.items && section.items.length) {
        html += '<ul class="blist">' + joinList(section.items) + '</ul>';
      }
      return html;
    }).join('');
  }

  function buildUsageBlock(block) {
    if (block.kind === 'list') {
      return '<ul' + attr('class', block.className || 'blist') + attr('style', block.style) + '>' +
        joinList(block.items) +
        '</ul>';
    }

    if (block.kind === 'doseTable') {
      var header = (block.headers || []).map(function (head) {
        return '<th>' + escapeHtml(head) + '</th>';
      }).join('');
      var rows = (block.rows || []).map(function (row) {
        return '<tr>' + row.map(function (cell) {
          return '<td>' + escapeHtml(cell) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      return '<table class="dose-table th-theme"><thead><tr>' + header + '</tr></thead><tbody>' + rows + '</tbody></table>';
    }

    var className = block.className || (block.kind === 'note' ? 'note-head' : 'btext');
    var text = escapeHtml(block.text);
    if (block.text && block.text.indexOf('الجرعة:') === 0) {
      text = '<strong>الجرعة:</strong>' + escapeHtml(block.text.slice('الجرعة:'.length));
    }
    return '<p' + attr('class', className) + attr('style', block.style) + '>' + text + '</p>';
  }

  function buildUsage(usage) {
    if (!usage) return '';
    return '<div class="sec-head head-theme" style="margin-top:10px;">' + escapeHtml(usage.title) + '</div>' +
      (usage.blocks || []).map(buildUsageBlock).join('');
  }

  function buildTechnical(technical) {
    if (!technical) return '';
    var rows = (technical.rows || []).map(function (row) {
      var padded = row.slice(0, 2);
      while (padded.length < 2) padded.push({ label: '', value: '' });
      var cells = padded.map(function (entry) {
        return '<td class="lbl">' + escapeHtml(entry.label) + '</td><td class="val">' + escapeHtml(entry.value) + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');

    return '<div class="tech-section">' +
      '<div class="sec-head head-theme">البيانات الفنية</div>' +
      '<table class="tech-table-enhanced tt-theme"><thead><tr><th colspan="4">البيانات الفنية</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="tech-note">' + escapeHtml(technical.note || '') + '</p>' +
      '</div>';
  }

  function buildChemicalCard(chem) {
    if (chem.raw_content) return chem.raw_content;

    if (chem.contentSections) {
      return '' +
        '<div class="card-header hd-theme">' +
        '  <div class="clax-badge-wrap">' +
        '    <div class="clax-box"><span>' + escapeHtml(chem.brand || '') + '</span></div>' +
        '    <div class="clax-divider"></div>' +
        '    <span class="card-prod-name">' + escapeHtml(chem.name) + '</span>' +
        '  </div>' +
        '  <span class="card-prod-code">' + escapeHtml(chem.code || '') + '</span>' +
        '</div>' +
        '<span class="prod-type-tag tag-theme">' + escapeHtml(chem.type || '') + '</span>' +
        '<div class="card-body">' +
        '  <div class="card-top-row">' +
        '    <div class="card-content">' + buildContentSections(chem.contentSections) + '</div>' +
        '    <div class="card-icon-box"></div>' +
        '  </div>' +
        buildUsage(chem.usage) +
        '</div>' +
        buildTechnical(chem.technical) +
        '<div class="card-safe safe-body-theme"><span class="card-safe-head safe-theme">التخزين والتداول الآمن</span><p class="card-safe-text">' + escapeHtml(chem.safety || '') + '</p></div>';
    }

    var arLabel = chemicalAr[chem.name] || 'مادة غسيل';
    return '' +
      '<div class="card-header hd-theme">' +
      '  <div class="clax-badge-wrap">' +
      '    <div class="clax-box"><span>' + escapeHtml(chem.brand || '') + '</span></div>' +
      '    <div class="clax-divider"></div>' +
      '    <span class="card-prod-name">' + chem.name + '</span>' +
      '  </div>' +
      '</div>' +
      '<span class="prod-type-tag tag-theme">' + arLabel + '</span>' +
      '<div class="card-body">' +
      '  <div class="card-content">' +
      '    <div class="sec-head head-theme">Overview / نظرة عامة</div>' +
      '    <p class="btext">' + (chem.subtitle || '') + '</p>' +
      '    <div class="sec-head head-theme">Specs / المواصفات</div>' +
      '    <ul class="blist">' +
      '      <li>pH: ' + (chem.ph || '-') + '</li>' +
      '      <li>Dose: ' + (chem.dosage_ml_kg || '-') + ' ml/kg</li>' +
      '      <li>Temperature: ' + (chem.temp_c || '-') + '°C</li>' +
      '    </ul>' +
      '    <div class="sec-head head-theme">Use For / استخدام مناسب</div>' +
      '    <ul class="blist">' + joinList(chem.use_for) + '</ul>' +
      '    <div class="sec-head head-theme">Avoid / تجنب الاستخدام</div>' +
      '    <ul class="blist">' + joinList(chem.avoid_for) + '</ul>' +
      '    <p class="card-safe-text">' + (chem.notes || '') + '</p>' +
      '  </div>' +
      '</div>';
  }

  var chemColorMap = {
    'Clax 200': 'chem-green',
    'Clax Build Lite': 'chem-blue',
    'Clax Sonril Ultra': 'chem-red',
    'Clax Neutra 3in1': 'chem-darkred',
    'Clax Soft Extra': 'chem-pink',
    'Clax Hypo': 'chem-orange',
    'Clax 100 Color': 'chem-green'
  };

  function formatChems(str) {
    if (!str || str === '-' || str.trim() === '') return '-';
    var items = str.split(/[,+]/).map(function(s) { return s.trim(); });
    return items.map(function(c) {
      if (!c) return '';
      var cls = chemColorMap[c] || 'chem-default';
      return '<span class="prog-chem ' + cls + '">' + escapeHtml(c) + '</span>';
    }).join('<br>');
  }

  function buildProgramCard(prog) {
    if (prog.raw_content) return prog.raw_content;

    var family = prog.type || prog.family || 'utility';
    var headerHtml = '' +
      '<div class="prog-card-head">' +
      '  <span class="prog-num">' + escapeHtml(prog.number || '') + '</span>' +
      '  <div class="prog-titles">' +
      '    <div class="prog-en">' + escapeHtml(prog.name_en || prog.name || '') + '</div>' +
      '    <div class="prog-ar">' + escapeHtml(prog.name_ar || familyAr[family] || 'برنامج') + '</div>' +
      '  </div>' +
      '  <div class="prog-badges">' +
      '    <span class="prog-temp">' + escapeHtml(prog.temp || prog.temp_c || '-') + '</span>' +
      '    <span class="prog-time">' + escapeHtml(prog.time || prog.time_min || '-') + '</span>' +
      '  </div>' +
      '</div>';

    var tableHtml = '';
    if (prog.steps && prog.steps.length > 0) {
      var rows = prog.steps.map(function(s, i) {
        var chemHtml = formatChems(s.chemicals);
        var doseKg = s.dose_kg ? escapeHtml(s.dose_kg).replace(/[,+]/g, '<br>') : '-';
        var doseMac = s.dose_mac ? escapeHtml(s.dose_mac).replace(/[,+]/g, '<br>') : '-';
        return '<tr>' +
          '<td>' + (i+1) + '</td>' +
          '<td>' + escapeHtml(s.op || '-') + '</td>' +
          '<td>' + escapeHtml(s.water || '-') + '</td>' +
          '<td>' + escapeHtml(s.temp || '-') + '</td>' +
          '<td>' + escapeHtml(s.time || '-') + '</td>' +
          '<td>' + chemHtml + '</td>' +
          '<td class="num-col">' + doseKg + '</td>' +
          '<td class="num-col">' + doseMac + '</td>' +
          '</tr>';
      }).join('');
      
      tableHtml = '<div class="table-responsive"><table class="prog-tbl-full">' +
        '<thead><tr><th>#</th><th>العملية</th><th>مستوى المياه</th><th>الحرارة</th><th>الوقت (د)</th><th>الكيماويات</th><th>مل/كجم</th><th>مل/ماكينة</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
    } else {
      tableHtml = '<div class="table-responsive"><table class="prog-tbl-full">' +
        '<thead><tr><th>Family / الفئة</th><th>Load / الحمولة</th><th>Chemicals / الكيماويات</th></tr></thead>' +
        '<tbody><tr>' +
        '<td>' + escapeHtml(familyAr[family] || family) + '</td>' +
        '<td>' + escapeHtml(prog.load || '-') + '</td>' +
        '<td>' + escapeHtml((prog.chemicals || []).join(' + ')) + '</td>' +
        '</tr></tbody></table></div>';
    }

    return headerHtml + tableHtml + '<div class="prog-note">' + escapeHtml(prog.note || prog.notes || '') + '</div>';
  }

  function renderChemicals(items) {
    var grid = document.querySelector('.products-grid');
    if (!grid) return;
    grid.innerHTML = items.map(function (chem) {
      return '<article class="product-card card-animate" id="' + chem.id + '" data-theme="' + chem.theme + '">' +
             buildChemicalCard(chem) +
             '</article>';
    }).join('');
    injectChemicalIcons();
    var countEl = document.querySelector('#chemicals-count');
    if (countEl) countEl.textContent = items.length + ' chemicals';
  }

  function renderPrograms(items) {
    var grid = document.querySelector('.programs-grid');
    if (!grid) return;
    grid.innerHTML = items.map(function (prog) {
      return '<article class="prog-card card-animate" id="' + prog.id + '" data-program-type="' + (prog.type || prog.family || '') + '">' +
             buildProgramCard(prog) +
             '</article>';
    }).join('');
    var countEl = document.querySelector('#programs-count');
    if (countEl) countEl.textContent = items.length + ' programs';
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
    if (!global.ChemicalService || !global.ProgramService) {
      document.dispatchEvent(new CustomEvent('laundry:data-ready'));
      return;
    }

    Promise.all([global.ChemicalService.fetchAll(), global.ProgramService.fetchAll()])
      .then(function (payload) {
        renderChemicals(payload[0]);
        renderPrograms(payload[1]);
        document.dispatchEvent(new CustomEvent('laundry:data-ready'));
      })
      .catch(function (err) {
        renderFallback('Unable to load guide data. Error: ' + err.message);
        console.error(err);
        document.dispatchEvent(new CustomEvent('laundry:data-ready'));
      });
  });

})(window);
