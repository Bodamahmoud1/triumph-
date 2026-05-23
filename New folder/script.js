
function initChemicalsUX() {
  var searchInput = document.getElementById('product-search');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('.hero-filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.product-card'));
  var countNode = document.getElementById('chemicals-count');
  var emptyNode = document.getElementById('chemicals-empty');
  var currentTheme = 'all';

  function applyFilters() {
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var visible = 0;

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

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      currentTheme = button.getAttribute('data-filter') || 'all';
      filterButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn === button);
        btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
      });
      applyFilters();
    });
  });

  filterButtons.forEach(function (button) {
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
  });

  applyFilters();
}

function initProgramsUX() {
  var searchInput = document.getElementById('program-search');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('.program-filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.prog-card'));
  var countNode = document.getElementById('programs-count');
  var emptyNode = document.getElementById('programs-empty');
  var currentType = 'all';

  function applyFilters() {
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var visible = 0;

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

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      currentType = button.getAttribute('data-program-filter') || 'all';
      filterButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn === button);
        btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
      });
      applyFilters();
    });
  });

  filterButtons.forEach(function (button) {
    button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
  });

  applyFilters();
}

function getCardTitle(card) {
  var title =
    card.querySelector('.card-prod-name') ||
    card.querySelector('.prog-en') ||
    card.querySelector('h2, h3, h4');
  return title ? title.textContent.trim() : 'Laundry reference';
}

function getElementSection(element) {
  if (!element) return 'landing';
  if (element.classList.contains('product-card') || element.closest('#section-chemicals')) return 'chemicals';
  if (element.classList.contains('prog-card') || element.closest('#section-programs')) return 'programs';
  if (element.closest('#section-tips')) return 'tips';
  return 'landing';
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

function buildLookupItems() {
  var items = [];
  var tipCounter = 0;
  Array.prototype.slice.call(document.querySelectorAll('.product-card, .prog-card, .tip-card')).forEach(function (card) {
    var id = card.id;
    if (!id && card.classList.contains('tip-card')) {
      tipCounter++;
      id = 'tip-' + tipCounter;
      card.id = id;
    }
    items.push({
      id: id,
      title: getCardTitle(card),
      text: card.textContent.toLowerCase(),
      section: getElementSection(card)
    });
  });
  return items;
}

function initGlobalLookup() {
  var input = document.getElementById('global-search');
  var results = document.getElementById('global-results');
  if (!input || !results) return;

  var items = buildLookupItems();

  function clearResults() {
    results.hidden = true;
    results.replaceChildren();
  }

  function jumpToItem(item) {
    if (!item || !item.id) return;
    var target = document.getElementById(item.id);
    setActiveSection(item.section);
    history.pushState(null, '', '#' + item.id);
    scrollToTarget(target, false);
    clearResults();
    input.value = '';
  }

  input.addEventListener('input', function () {
    var query = input.value.trim().toLowerCase();
    results.replaceChildren();
    if (query.length < 2) {
      results.hidden = true;
      return;
    }

    var matches = items.filter(function (item) {
      return item.text.indexOf(query) !== -1 || item.title.toLowerCase().indexOf(query) !== -1;
    }).slice(0, 6);

    if (!matches.length) {
      var empty = document.createElement('div');
      empty.className = 'landing-result-empty';
      empty.textContent = 'No matching item / لا توجد نتيجة';
      results.appendChild(empty);
      results.hidden = false;
      return;
    }

    matches.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'landing-result';
      button.innerHTML = '<span></span><small></small>';
      button.querySelector('span').textContent = item.title;
      button.querySelector('small').textContent = item.section;
      button.addEventListener('click', function () {
        jumpToItem(item);
      });
      results.appendChild(button);
    });
    results.hidden = false;
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      clearResults();
      input.blur();
    }
    if (event.key === 'Enter') {
      var first = results.querySelector('.landing-result');
      if (first) first.click();
    }
  });

  document.addEventListener('click', function (event) {
    if (!results.contains(event.target) && event.target !== input) {
      clearResults();
    }
  });
}

function printTarget(element, sectionName) {
  if (!element) return;
  if (sectionName) {
    switchSection(sectionName);
  }

  var previousTargets = document.querySelectorAll('.print-target');
  for (var i = 0; i < previousTargets.length; i++) {
    previousTargets[i].classList.remove('print-target');
  }

  element.classList.add('print-target');
  document.body.classList.add('is-printing');

  var cleanup = function () {
    element.classList.remove('print-target');
    document.body.classList.remove('is-printing');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  setTimeout(function () {
    window.print();
  }, 80);
  setTimeout(cleanup, 1500);
}

function addPrintButton(card, sectionName) {
  var host = card.querySelector('.card-header') || card.querySelector('.prog-card-head');
  if (!host || host.querySelector('.print-mini-btn')) return;

  var button = document.createElement('button');
  button.type = 'button';
  button.className = 'print-mini-btn';
  button.textContent = 'Print';
  button.setAttribute('aria-label', 'Print ' + getCardTitle(card));
  button.addEventListener('click', function (event) {
    event.preventDefault();
    event.stopPropagation();
    printTarget(card, sectionName);
  });
  host.appendChild(button);
}

function initPrintTools() {
  Array.prototype.slice.call(document.querySelectorAll('.product-card')).forEach(function (card) {
    addPrintButton(card, 'chemicals');
  });
  Array.prototype.slice.call(document.querySelectorAll('.prog-card')).forEach(function (card) {
    addPrintButton(card, 'programs');
  });

  var printChemicals = document.getElementById('print-chemicals');
  if (printChemicals) {
    printChemicals.addEventListener('click', function () {
      printTarget(document.querySelector('.products-grid'), 'chemicals');
    });
  }

  var printPrograms = document.getElementById('print-programs');
  if (printPrograms) {
    printPrograms.addEventListener('click', function () {
      printTarget(document.querySelector('.programs-grid'), 'programs');
    });
  }
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
  initChemicalsUX();
  initProgramsUX();
  initGlobalLookup();
  initPrintTools();
  openCurrentHash(!window.location.hash);
  initPwa();
});

window.addEventListener('hashchange', function () {
  openCurrentHash(true);
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

/* ═══ INTERACTIVE BUBBLE ANIMATION ═══ */
(function () {
  var canvas = document.getElementById('bubble-canvas');
  if (!canvas) return;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    canvas.style.display = 'none';
    return;
  }
  var ctx = canvas.getContext('2d');
  var mouse = { x: -9999, y: -9999 };
  var bubbles = [];
  var frameId = null;
  var isRunning = false;
  var isCompactViewport = window.matchMedia('(max-width: 700px)').matches;
  var isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  var COUNT = isCompactViewport || isTouchDevice ? 12 : 44;
  var W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* Track mouse and touch */
  if (!isTouchDevice) {
    document.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
  } else {
    document.addEventListener('touchmove', function (e) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }, { passive: true });
  }
  document.addEventListener('mouseleave', function () {
    mouse.x = -9999; mouse.y = -9999;
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      mouse.x = -9999;
      mouse.y = -9999;
      stopAnimation();
    } else {
      startAnimation();
    }
  });

  /* Colour palette matching the design */
  var COLORS = [
    '197,160,90',   /* gold */
    '43,82,168',    /* blue */
    '255,255,255',  /* white */
    '197,160,90',   /* gold (weighted) */
    '43,82,168'     /* blue (weighted) */
  ];

  function randomBubble(spreadY) {
    var r = Math.random() * 28 + 5;
    return {
      x     : Math.random() * W,
      y     : spreadY ? Math.random() * H : H + r + 10,
      r     : r,
      vx    : (Math.random() - 0.5) * 0.8,
      vy    : -(Math.random() * 0.2 + 0.08),   /* upward, slow */
      alpha : Math.random() * 0.25 + 0.04,
      color : COLORS[Math.floor(Math.random() * COLORS.length)]
    };
  }

  for (var i = 0; i < COUNT; i++) {
    bubbles.push(randomBubble(true));
  }

  function draw() {
    if (!isRunning) return;
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];

      /* Mouse repulsion */
      var dx   = b.x - mouse.x;
      var dy   = b.y - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150 && dist > 0) {
        var force = (150 - dist) / 150 * 4.5;
        b.vx += (dx / dist) * force * 0.12;
        b.vy += (dy / dist) * force * 0.12;
      }

      /* Drift damping so they don't rocket off */
      b.vx *= 0.97;
      b.vy  = b.vy * 0.985 - (Math.random() * 0.003 + 0.07);  /* keep rising very slowly */

      b.x += b.vx;
      b.y += b.vy;

      /* Wrap horizontally */
      if (b.x < -b.r)       b.x = W + b.r;
      if (b.x > W + b.r)    b.x = -b.r;

      /* Recycle when off top */
      if (b.y < -b.r * 3) {
        bubbles[i] = randomBubble(false);
        continue;
      }

      /* Draw bubble ring */
      var grad = ctx.createRadialGradient(
        b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.05,
        b.x, b.y, b.r
      );
      grad.addColorStop(0, 'rgba(' + b.color + ',' + (b.alpha * 1.8) + ')');
      grad.addColorStop(0.7, 'rgba(' + b.color + ',' + (b.alpha * 0.5) + ')');
      grad.addColorStop(1, 'rgba(' + b.color + ',0)');

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      /* Glint */
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (b.alpha * 3.5) + ')';
      ctx.fill();

      /* Ring outline */
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + b.color + ',' + (b.alpha * 2.2) + ')';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    frameId = requestAnimationFrame(draw);
  }

  function startAnimation() {
    if (isRunning) return;
    isRunning = true;
    frameId = requestAnimationFrame(draw);
  }

  function stopAnimation() {
    isRunning = false;
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  startAnimation();
})();

/* ═══════════════════════════════════════
   SCHEDULE UX LOGIC
═══════════════════════════════════════ */
(function initScheduleUX() {
  var scheduleApiUrl = '/api/schedule';
  var cacheKey = 'triumph_schedule_cache';
  var currentWeekKey = null;
  var currentScheduleData = null;

  var tbody = document.getElementById('schedule-table-body');
  var mobileList = document.getElementById('schedule-card-list');
  var weekLabel = document.getElementById('schedule-week-range');
  var titleLabel = document.getElementById('schedule-active-week');
  var searchInput = document.getElementById('schedule-search');
  var filterBtns = document.querySelectorAll('.schedule-filter');
  var emptyState = document.getElementById('schedule-empty-state');
  
  var activeFilter = 'all';

  if (!tbody || !mobileList) return; // Schedule not in DOM

  function getISOWeekString(date) {
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
    return d.getUTCFullYear() + '-W' + (weekNo < 10 ? '0' : '') + weekNo;
  }

  function parseISOWeek(weekStr) {
    if (!weekStr) return new Date();
    var parts = weekStr.split('-W');
    if (parts.length !== 2) return new Date();
    var year = parseInt(parts[0], 10);
    var week = parseInt(parts[1], 10);
    var d = new Date(year, 0, 1);
    var days = (week - 1) * 7;
    days -= d.getDay() - 1; // start from monday
    d.setDate(d.getDate() + days - 2); // adjust to saturday start if needed for Arab week
    return d;
  }

  function formatWeekRange(weekStr, weekStartStr) {
    var start;
    if (weekStartStr) {
      start = new Date(weekStartStr);
      if (isNaN(start.getTime())) {
        start = parseISOWeek(weekStr);
      }
    } else {
      start = parseISOWeek(weekStr);
    }
    var end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    var arMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return start.getDate() + ' - ' + end.getDate() + ' ' + arMonths[end.getMonth()] + ' ' + end.getFullYear();
  }

  function fetchSchedule(week) {
    var url = scheduleApiUrl;
    if (week) url += '?week=' + encodeURIComponent(week);
    
    return fetch(url)
      .then(function(res) { return res.json(); })
      .then(function(res) {
        if (res.data) {
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
          renderSchedule(res.data);
        } else {
          renderEmpty(res.message || 'لا يوجد جدول منشور لهذا الأسبوع');
        }
      })
      .catch(function(err) {
        console.warn('Network failed, checking cache', err);
        var cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            var data = JSON.parse(cached);
            if (!week || data.week_key === week) {
              renderSchedule(data);
              return;
            }
          } catch(e) {}
        }
        renderEmpty('خطأ في الاتصال بالشبكة ولم يتم العثور على نسخة محفوظة.');
      });
  }

  function renderEmpty(msg) {
    tbody.innerHTML = '';
    mobileList.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (emptyState) emptyState.textContent = msg;
    currentScheduleData = null;
  }

  function renderSchedule(data) {
    currentWeekKey = data.week_key;
    currentScheduleData = data.employees;
    
    if (titleLabel) titleLabel.textContent = data.week_key;
    if (weekLabel) weekLabel.textContent = formatWeekRange(data.week_key, data.week_start);
    if (emptyState) emptyState.style.display = 'none';

    filterAndRender();
  }

  function filterAndRender() {
    if (!currentScheduleData) return;
    
    var query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    var filtered = currentScheduleData.filter(function(emp) {
      var matchDept = activeFilter === 'all' || emp.department === activeFilter;
      var matchName = true;
      if (query) {
        var nAr = (emp.name_ar || '').toLowerCase();
        var nEn = (emp.name_en || '').toLowerCase();
        matchName = nAr.indexOf(query) !== -1 || nEn.indexOf(query) !== -1;
      }
      return matchDept && matchName;
    });

    // Render Table
    var htmlTable = '';
    var htmlMobile = '';
    var days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    var arDays = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

    filtered.forEach(function(emp) {
      // Table Row
      htmlTable += '<tr>';
      htmlTable += '<td><div class="sched-emp-name"><span class="sched-emp-name-ar">' + emp.name_ar + '</span><span class="sched-emp-name-en">' + (emp.name_en||'') + '</span><span class="sched-emp-dept">' + emp.department + '</span></div></td>';
      
      // Mobile Card
      htmlMobile += '<div class="schedule-emp-card"><div class="schedule-emp-card-head"><span class="schedule-emp-card-name">' + emp.name_ar + '</span><span class="schedule-emp-card-dept">' + emp.department + '</span></div><div class="schedule-emp-card-body">';

      days.forEach(function(d, idx) {
        var shift = emp.shifts[d] || 'Off';
        var shiftClass = 'shift-' + shift; // e.g. shift-Morning
        var shiftLabel = shift === 'Morning' ? 'صباحي' : 
                         shift === 'Evening' ? 'مسائي' : 
                         shift === 'Night' ? 'ليلي' : 
                         shift === 'Holiday' ? 'عطلة' : 'راحة';

        // Table cell
        htmlTable += '<td><span class="shift-cell ' + shiftClass + '">' + shiftLabel + '</span></td>';

        // Mobile cell
        htmlMobile += '<div class="schedule-emp-card-day"><span class="schedule-emp-card-day-name">' + arDays[idx] + '</span><span class="shift-cell ' + shiftClass + '">' + shiftLabel + '</span></div>';
      });

      htmlTable += '</tr>';
      htmlMobile += '</div></div>';
    });

    if (filtered.length === 0) {
      renderEmpty('لم يتم العثور على موظفين مطابقين للبحث.');
    } else {
      tbody.innerHTML = htmlTable;
      mobileList.innerHTML = htmlMobile;
    }
  }

  // Event Listeners
  if (searchInput) {
    searchInput.addEventListener('input', filterAndRender);
  }

  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      filterBtns.forEach(function(b) { b.classList.remove('is-active'); });
      this.classList.add('is-active');
      activeFilter = this.getAttribute('data-schedule-filter') || 'all';
      filterAndRender();
    });
  });

  var btnPrev = document.getElementById('sched-btn-prev');
  var btnNext = document.getElementById('sched-btn-next');
  var btnCurrent = document.getElementById('sched-btn-current');

  function navWeek(offset) {
    if (!currentWeekKey) currentWeekKey = getISOWeekString(new Date());
    var d = parseISOWeek(currentWeekKey);
    d.setDate(d.getDate() + (offset * 7));
    fetchSchedule(getISOWeekString(d));
  }

  if (btnPrev) btnPrev.addEventListener('click', function() { navWeek(-1); });
  if (btnNext) btnNext.addEventListener('click', function() { navWeek(1); });
  if (btnCurrent) btnCurrent.addEventListener('click', function() { fetchSchedule(null); });

  // Load initial
  fetchSchedule(null);

})();

