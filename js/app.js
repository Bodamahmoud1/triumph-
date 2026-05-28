function initChemicalsUX() {
  var searchInput = document.getElementById('product-search');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('#section-chemicals .hero-filter'));
  var countNode = document.getElementById('chemicals-count');
  var emptyNode = document.getElementById('chemicals-empty');
  var currentTheme = 'all';

  function applyFilters() {
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var visible = 0;
    var cards = Array.prototype.slice.call(document.querySelectorAll('.product-card'));

    cards.forEach(function (card) {
      var text = card.textContent.toLowerCase();
      var matchesQuery = !query || text.indexOf(query) !== -1;
      var matchesTheme = currentTheme === 'all' || card.getAttribute('data-theme') === currentTheme;
      var show = matchesQuery && matchesTheme;
      card.classList.toggle('is-hidden', !show);
      if (show) visible++;
    });

    if (countNode) {
      countNode.textContent = visible + (visible === 1 ? ' chemical' : ' chemicals');
    }
    if (emptyNode) {
      emptyNode.hidden = visible !== 0;
    }
  }

  if (searchInput && !searchInput.dataset.boundChem) {
    searchInput.addEventListener('input', applyFilters);
    searchInput.dataset.boundChem = '1';
  }

  filterButtons.forEach(function (button) {
    if (button.dataset.boundChem) return;
    button.addEventListener('click', function () {
      currentTheme = button.getAttribute('data-filter') || 'all';
      filterButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn === button);
        btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
      });
      applyFilters();
    });
    button.dataset.boundChem = '1';
  });

  filterButtons.forEach(function (button) {
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
  });

  applyFilters();
}

function initProgramsUX() {
  var searchInput = document.getElementById('program-search');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('.program-filter'));
  var countNode = document.getElementById('programs-count');
  var emptyNode = document.getElementById('programs-empty');
  var currentType = 'all';

  function applyFilters() {
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var visible = 0;
    var cards = Array.prototype.slice.call(document.querySelectorAll('.prog-card'));

    cards.forEach(function (card) {
      var text = card.textContent.toLowerCase();
      var type = card.getAttribute('data-program-type') || '';
      var matchesQuery = !query || text.indexOf(query) !== -1;
      var matchesType = currentType === 'all' || type === currentType;
      var show = matchesQuery && matchesType;
      card.classList.toggle('is-hidden', !show);
      if (show) visible++;
    });

    if (countNode) {
      countNode.textContent = visible + (visible === 1 ? ' program' : ' programs');
    }
    if (emptyNode) {
      emptyNode.hidden = visible !== 0;
    }
  }

  if (searchInput && !searchInput.dataset.boundProg) {
    searchInput.addEventListener('input', applyFilters);
    searchInput.dataset.boundProg = '1';
  }

  filterButtons.forEach(function (button) {
    if (button.dataset.boundProg) return;
    button.addEventListener('click', function () {
      currentType = button.getAttribute('data-program-filter') || 'all';
      filterButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn === button);
        btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
      });
      applyFilters();
    });
    button.dataset.boundProg = '1';
  });

  filterButtons.forEach(function (button) {
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
  });

  applyFilters();
}

function getRouteFromHash() {
  var raw = window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : '';
  if (!raw || raw === 'home' || raw === 'landing') return { section: 'landing', target: null };
  if (raw === 'chemicals' || raw === 'programs' || raw === 'tips' || raw === 'schedule') {
    return { section: raw, target: null };
  }

  var target = document.getElementById(raw);
  if (target) {
    return { section: getElementSection(target), target: target };
  }

  return { section: 'landing', target: null };
}

function syncNavigation(sectionName) {
  var navBtns = document.querySelectorAll('.bnav-item');
  for (var i = 0; i < navBtns.length; i++) {
    var btn = navBtns[i];
    var active = btn.getAttribute('data-section') === sectionName;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  }

  var sectionButtons = document.querySelectorAll('[data-nav-section]');
  for (var j = 0; j < sectionButtons.length; j++) {
    var sectionButton = sectionButtons[j];
    sectionButton.classList.toggle('is-active', sectionButton.getAttribute('data-nav-section') === sectionName);
  }
}

function setActiveSection(sectionName) {
  var sections = document.querySelectorAll('.app-section');
  for (var i = 0; i < sections.length; i++) {
    sections[i].classList.remove('is-active');
  }

  var target = document.getElementById('section-' + sectionName);
  if (target) {
    target.style.animation = 'none';
    target.offsetHeight;
    target.style.animation = '';
    target.classList.add('is-active');
  }

  // Show/hide nav groups based on active section
  var chemGroup = document.getElementById('nav-chemicals-group');
  var progGroup = document.getElementById('nav-programs-group');
  var navSeparator = document.querySelector('.nav-separator');

  if (chemGroup) {
    chemGroup.style.display = sectionName === 'chemicals' ? '' : 'none';
  }
  if (progGroup) {
    progGroup.style.display = sectionName === 'programs' ? '' : 'none';
  }
  if (navSeparator) {
    navSeparator.style.display = (sectionName === 'chemicals' || sectionName === 'programs') ? '' : 'none';
  }

  syncNavigation(sectionName);
}

function scrollToTarget(target, preferTop) {
  if (!target) {
    if (preferTop) window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  var previous = document.querySelector('.is-route-target');
  if (previous) previous.classList.remove('is-route-target');
  target.classList.add('is-route-target');
  setTimeout(function () {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}

function openCurrentHash(preferTop) {
  var route = getRouteFromHash();
  setActiveSection(route.section);
  scrollToTarget(route.target, preferTop && !route.target);
}

function updateSectionHash(sectionName) {
  var hash = sectionName === 'landing' ? '#home' : '#' + sectionName;
  if (window.location.hash !== hash) {
    history.pushState(null, '', hash);
  }
}

function applyTextContent(selector, value) {
  var element = document.querySelector(selector);
  if (!element || value === undefined || value === null || String(value).trim() === '') return;
  element.textContent = String(value);
}

function parseEditableTips(data) {
  if (!data) return [];

  if (data.cards_json) {
    try {
      var parsed = JSON.parse(data.cards_json);
      if (Array.isArray(parsed)) {
        return parsed.filter(function (tip) {
          return tip && (tip.title_ar || tip.title_en || tip.content_ar || tip.content_en);
        });
      }
    } catch (e) {
      return [];
    }
  }

  if (data.title_ar || data.title_en || data.content_ar || data.content_en) {
    return [{
      icon: data.icon || '💡',
      title_ar: data.title_ar || '',
      title_en: data.title_en || '',
      content_ar: data.content_ar || '',
      content_en: data.content_en || ''
    }];
  }

  return [];
}

function renderEditableTips(data) {
  var grid = document.querySelector('#section-tips .tips-grid');
  if (!grid) return;

  Array.prototype.slice.call(grid.querySelectorAll('[data-dynamic-tip-card="true"]')).forEach(function (card) {
    card.remove();
  });

  parseEditableTips(data).forEach(function (tip) {
    var titleAr = String(tip.title_ar || '').trim();
    var titleEn = String(tip.title_en || '').trim();
    var contentAr = String(tip.content_ar || '').trim();
    var contentEn = String(tip.content_en || '').trim();
    var title = titleAr || titleEn;

    if (titleAr && titleEn && titleAr.toLowerCase() !== titleEn.toLowerCase()) {
      title = titleAr + ' (' + titleEn + ')';
    }

    var text = contentAr || contentEn;
    if (!title && !text) return;

    var card = document.createElement('div');
    card.className = 'tip-card';
    card.setAttribute('data-dynamic-tip-card', 'true');

    var icon = document.createElement('div');
    icon.className = 'tip-card-icon';
    icon.textContent = String(tip.icon || '💡').trim() || '💡';

    var heading = document.createElement('h4');
    heading.className = 'tip-card-title';
    heading.textContent = title;

    var paragraph = document.createElement('p');
    paragraph.className = 'tip-card-text';
    paragraph.textContent = text;

    card.appendChild(icon);
    card.appendChild(heading);
    card.appendChild(paragraph);
    grid.appendChild(card);
  });
}

function loadEditablePageContent() {
  if (window.location.protocol === 'file:') return;

  fetch('/api/content/intro')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (payload) {
      var data = payload && payload.data ? payload.data : {};
      applyTextContent('[data-content-field="intro.title_ar"]', data.title_ar || data.title_en);
      applyTextContent('[data-content-field="intro.body_ar"]', data.body_ar || data.body_en);
    })
    .catch(function () {
      // Static fallback content remains visible when the API is unavailable.
    });

  fetch('/api/content/tips')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (payload) {
      var data = payload && payload.data ? payload.data : {};
      renderEditableTips(data);
    })
    .catch(function () {
      // Static fallback content remains visible when the API is unavailable.
    });
}

function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  if (window.location.protocol === 'file:') return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {
      // Offline support is optional; the guide should still run as a normal static page.
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  openCurrentHash(!window.location.hash);
  initPwa();
  initStaggeredAnimations();
  loadEditablePageContent();

  // Back to Top Button
  var backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 300) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });
    backToTopBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});

function initStaggeredAnimations() {
  if (!('IntersectionObserver' in window)) return;
  
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  window.observeCards = function() {
    var cards = document.querySelectorAll('.card-animate:not(.is-visible)');
    for (var i = 0; i < cards.length; i++) {
      // Add staggered delay based on horizontal position or just simple order
      cards[i].style.transitionDelay = (i % 6) * 0.05 + 's';
      observer.observe(cards[i]);
    }
  };
  
  // Call it initially and whenever data updates
  document.addEventListener('laundry:data-ready', window.observeCards);
}

window.addEventListener('hashchange', function () {
  openCurrentHash(true);
});


document.addEventListener('laundry:data-ready', function () {
  initChemicalsUX();
  initProgramsUX();
  initGlobalLookup();
  initPrintTools();
});


/* ═══ SECTION SWITCHER ═══ */
function switchSection(sectionName, options) {
  options = options || {};
  setActiveSection(sectionName);
  if (options.updateHash !== false) {
    updateSectionHash(sectionName);
  }
  if (options.scrollTop !== false) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (window.laundryBubbleControl) {
    window.laundryBubbleControl(sectionName === 'landing');
  }
}

/* ═══ MOBILE DRAWER CATEGORY TOGGLE ═══ */
function toggleMobCat(btn) {
  var category = btn.closest('.mob-category');
  if (!category) return;

  // If it has sub-items, toggle the accordion
  var items = category.querySelector('.mob-cat-items');
  if (items) {
    // Close all other open categories
    var allCats = document.querySelectorAll('.mob-category.open');
    for (var i = 0; i < allCats.length; i++) {
      if (allCats[i] !== category) {
        allCats[i].classList.remove('open');
        var otherButton = allCats[i].querySelector('.mob-cat-btn');
        if (otherButton) otherButton.setAttribute('aria-expanded', 'false');
      }
    }
    category.classList.toggle('open');
    btn.setAttribute('aria-expanded', category.classList.contains('open') ? 'true' : 'false');
  }
}

