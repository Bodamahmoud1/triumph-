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
  var statusLabel = document.getElementById('schedule-status');
  var filterRow = document.querySelector('.schedule-filter-row');
  var jobSelect = document.getElementById('schedule-job');
  var emptyState = document.getElementById('schedule-empty');
  
  var activeFilter = 'all';

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getEmployeeJob(emp) {
    return (emp && (emp.job || emp.position || emp.department || '')).trim();
  }

  function getJobLabel(job) {
    return job || 'Unassigned / بدون وظيفة';
  }

  function getUniqueJobs(employees) {
    var seen = {};
    var jobs = [];
    (employees || []).forEach(function(emp) {
      var job = getEmployeeJob(emp);
      if (!job || seen[job]) return;
      seen[job] = true;
      jobs.push(job);
    });
    return jobs;
  }

  function setActiveJobFilter(value) {
    activeFilter = value || 'all';

    if (filterRow) {
      var buttons = filterRow.querySelectorAll('.schedule-filter');
      buttons.forEach(function(btn) {
        var isActive = btn.getAttribute('data-schedule-filter') === activeFilter;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    if (jobSelect) jobSelect.value = activeFilter;
  }

  function renderJobFilters(employees) {
    var jobs = getUniqueJobs(employees);
    if (activeFilter !== 'all' && jobs.indexOf(activeFilter) === -1) activeFilter = 'all';

    if (filterRow) {
      var html = '<button class="hero-filter schedule-filter" type="button" data-schedule-filter="all" aria-pressed="false">All / الكل</button>';
      jobs.forEach(function(job) {
        html += '<button class="hero-filter schedule-filter" type="button" data-schedule-filter="' + escapeAttr(job) + '" aria-pressed="false">' + escapeHtml(getJobLabel(job)) + '</button>';
      });
      filterRow.innerHTML = html;
    }

    if (jobSelect) {
      var options = '<option value="all">All / الكل</option>';
      jobs.forEach(function(job) {
        options += '<option value="' + escapeAttr(job) + '">' + escapeHtml(getJobLabel(job)) + '</option>';
      });
      jobSelect.innerHTML = options;
    }

    setActiveJobFilter(activeFilter);
  }

  function setStatus(text, visible) {
    if (!statusLabel) return;
    statusLabel.textContent = text || '';
    statusLabel.hidden = !visible;
  }

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
    setStatus('Loading schedule...', true);
    
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
    setStatus(msg, true);
    if (weekLabel && weekLabel.textContent === 'Loading...') weekLabel.textContent = 'No schedule';
    currentScheduleData = null;
  }

  function renderSchedule(data) {
    currentWeekKey = data.week_key;
    currentScheduleData = data.employees;
    renderJobFilters(currentScheduleData);
    
    if (titleLabel) titleLabel.textContent = data.week_key;
    if (weekLabel) weekLabel.textContent = formatWeekRange(data.week_key, data.week_start);
    if (emptyState) emptyState.style.display = 'none';
    setStatus('', false);

    filterAndRender();
  }

  function filterAndRender() {
    if (!currentScheduleData) return;
    
    var query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    var filtered = currentScheduleData.filter(function(emp) {
      var job = getEmployeeJob(emp);
      var matchJob = activeFilter === 'all' || job === activeFilter;
      var matchName = true;
      if (query) {
        var nAr = (emp.name_ar || '').toLowerCase();
        var nEn = (emp.name_en || '').toLowerCase();
        matchName = nAr.indexOf(query) !== -1 || nEn.indexOf(query) !== -1;
      }
      return matchJob && matchName;
    });

    // Render Table
    var htmlTable = '';
    var htmlMobile = '';
    var days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    var arDays = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

    filtered.forEach(function(emp) {
      var safeNameAr = escapeHtml(emp.name_ar);
      var safeNameEn = escapeHtml(emp.name_en || '');
      var safeJob = escapeHtml(getJobLabel(getEmployeeJob(emp)));

      // Table Row
      htmlTable += '<tr>';
      htmlTable += '<td><div class="sched-emp-name"><span class="sched-emp-name-ar">' + safeNameAr + '</span><span class="sched-emp-name-en">' + safeNameEn + '</span><span class="sched-emp-dept">' + safeJob + '</span></div></td>';
      
      // Mobile Card
      htmlMobile += '<div class="schedule-emp-card"><div class="schedule-emp-card-head"><span class="schedule-emp-card-name">' + safeNameAr + '</span><span class="schedule-emp-card-dept">' + safeJob + '</span></div><div class="schedule-emp-card-body">';

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
      tbody.innerHTML = '';
      mobileList.innerHTML = '';
      if (emptyState) {
        emptyState.style.display = 'block';
        emptyState.textContent = 'لم يتم العثور على موظفين مطابقين للبحث.';
      }
      setStatus('لم يتم العثور على موظفين مطابقين للبحث.', true);
    } else {
      tbody.innerHTML = htmlTable;
      mobileList.innerHTML = htmlMobile;
      if (emptyState) emptyState.style.display = 'none';
      setStatus('', false);
    }
  }

  // Event Listeners
  if (searchInput) {
    searchInput.addEventListener('input', filterAndRender);
  }

  if (filterRow) {
    filterRow.addEventListener('click', function(event) {
      var btn = event.target.closest('.schedule-filter');
      if (!btn || !filterRow.contains(btn)) return;
      setActiveJobFilter(btn.getAttribute('data-schedule-filter') || 'all');
      filterAndRender();
    });
  }

  if (jobSelect) {
    jobSelect.addEventListener('change', function() {
      setActiveJobFilter(jobSelect.value || 'all');
      filterAndRender();
    });
  }

  var btnPrev = document.getElementById('schedule-prev');
  var btnNext = document.getElementById('schedule-next');
  var btnCurrent = document.getElementById('schedule-current');

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
