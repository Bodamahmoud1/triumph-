/* ═══════════════════════════════════════
   SCHEDULE UX LOGIC
═══════════════════════════════════════ */
(function initScheduleUX() {
  var scheduleApiUrl = '/api/schedule';
  var scheduleWeeksApiUrl = '/api/schedule/weeks';
  var cacheKey = 'triumph_schedule_cache';
  var currentWeekKey = null;
  var currentScheduleData = null;
  var publishedWeeks = [];
  var siblingWeeks = [];
  var siblingIndex = 0;

  var SHIFT_ORDER = ['Morning', 'Evening', 'Night'];

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

  function isWashingJob(job) {
    var text = normaliseText(job);
    return ['washing', 'wash', 'washer', 'غسيل', 'غسال', 'مغسلة'].some(function(alias) {
      return text.indexOf(normaliseText(alias)) !== -1;
    });
  }

  function washingMachineIcon() {
    return '<span class="schedule-job-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 64 64" focusable="false">' +
      '<rect x="14" y="7" width="36" height="50" rx="7" fill="none" stroke="currentColor" stroke-width="4"/>' +
      '<circle cx="24" cy="17" r="2.5" fill="currentColor"/>' +
      '<rect x="31" y="14" width="10" height="5" rx="2.5" fill="currentColor" opacity="0.55"/>' +
      '<circle cx="32" cy="38" r="13" fill="none" stroke="currentColor" stroke-width="4"/>' +
      '<path d="M22 38c4 4 8 5 13 2 4-2 7-2 9 1" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' +
      '</svg></span>';
  }

  function getJobFilterContent(job) {
    return (isWashingJob(job) ? washingMachineIcon() : '') + '<span>' + escapeHtml(getJobLabel(job)) + '</span>';
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
      var html = '<button class="hero-filter schedule-filter" type="button" data-schedule-filter="all" aria-pressed="false"><span>All / الكل</span></button>';
      jobs.forEach(function(job) {
        html += '<button class="hero-filter schedule-filter" type="button" data-schedule-filter="' + escapeAttr(job) + '" aria-pressed="false">' + getJobFilterContent(job) + '</button>';
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

  function renderNoMatches(msg) {
    tbody.innerHTML = '';
    mobileList.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (emptyState) emptyState.textContent = msg;
    setStatus(msg, true);
  }

  function normaliseText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
  }

  function departmentMatchesFilter(department, filter) {
    if (filter === 'all') return true;

    var dept = normaliseText(department);
    var selected = normaliseText(filter);
    if (!dept) return false;
    if (dept === selected || dept.indexOf(selected) !== -1) return true;

    var departmentAliases = {
      Washing: ['wash', 'washer', 'dry clean', 'ass laundry', 'shift leader', 'غسيل', 'مغسلة'],
      Ironing: ['iron', 'ironing', 'presser', 'press', 'كي'],
      Folding: ['fold', 'folding', 'laundry attendant', 'attendant', 'تطبيق'],
      Delivery: ['delivery', 'valet', 'tailor', 'توصيل']
    };

    return (departmentAliases[filter] || []).some(function(alias) {
      return dept.indexOf(normaliseText(alias)) !== -1;
    });
  }

  function getShiftGroupRank(emp) {
    var group = emp.shift_group;
    if (!group) {
      var shifts = Object.values(emp.shifts || {});
      for (var i = 0; i < SHIFT_ORDER.length; i++) {
        if (shifts.indexOf(SHIFT_ORDER[i]) !== -1) group = SHIFT_ORDER[i];
      }
    }
    var idx = SHIFT_ORDER.indexOf(group || '');
    return idx === -1 ? SHIFT_ORDER.length : idx;
  }

  function sortEmployeesByShift(employees) {
    return (employees || []).slice().sort(function(a, b) {
      var rankDiff = getShiftGroupRank(a) - getShiftGroupRank(b);
      if (rankDiff !== 0) return rankDiff;
      return String(a.name_ar || '').localeCompare(String(b.name_ar || ''), 'ar');
    });
  }

  function updateWeekNavUi() {
    var weeks = siblingWeeks.length > 1 ? siblingWeeks : publishedWeeks;
    var idx = siblingWeeks.length > 1 ? siblingIndex : findPublishedWeekIndex(currentWeekKey);
    var hasMultiple = weeks.length > 1;

    if (btnPrev) btnPrev.disabled = !hasMultiple || idx <= 0;
    if (btnNext) btnNext.disabled = !hasMultiple || idx < 0 || idx >= weeks.length - 1;

    if (titleLabel) {
      if (hasMultiple && idx >= 0) {
        titleLabel.textContent = 'الأسبوع ' + (idx + 1) + ' من ' + weeks.length;
      } else if (currentWeekKey) {
        titleLabel.textContent = currentWeekKey;
      }
    }

    if (hasMultiple && idx >= 0) {
      setStatus('الأسبوع ' + (idx + 1) + ' من ' + weeks.length + ' — استخدم الأسهم للتنقل بين الأسابيع', true);
    } else {
      setStatus('', false);
    }
  }

  function renderSchedule(data) {
    currentWeekKey = data.week_key;
    siblingWeeks = Array.isArray(data.siblings) ? data.siblings : [];
    siblingIndex = typeof data.sibling_index === 'number' && data.sibling_index >= 0
      ? data.sibling_index
      : findPublishedWeekIndex(data.week_key);
    currentScheduleData = sortEmployeesByShift(data.employees);
    renderJobFilters(currentScheduleData);

    if (weekLabel) weekLabel.textContent = formatWeekRange(data.week_key, data.week_start);
    if (emptyState) emptyState.style.display = 'none';
    updateWeekNavUi();

    filterAndRender();
  }

  function filterAndRender() {
    if (!currentScheduleData) return;
    
    var query = searchInput ? normaliseText(searchInput.value) : '';
    
    var filtered = sortEmployeesByShift(currentScheduleData).filter(function(emp) {
      var job = getEmployeeJob(emp);
      var matchJob = activeFilter === 'all' || job === activeFilter;
      var matchName = true;
      if (query) {
        var nAr = normaliseText(emp.name_ar);
        var nEn = normaliseText(emp.name_en);
        var employeeId = normaliseText(emp.employee_id || emp.employeeId);
        matchName = nAr.indexOf(query) !== -1 || nEn.indexOf(query) !== -1 || employeeId.indexOf(query) !== -1;
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
                         shift === 'Vacation' ? 'إجازة' :
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

  function loadPublishedWeeks() {
    return fetch(scheduleWeeksApiUrl)
      .then(function(res) { return res.json(); })
      .then(function(payload) {
        publishedWeeks = Array.isArray(payload.weeks) ? payload.weeks : [];
        return publishedWeeks;
      })
      .catch(function() {
        publishedWeeks = [];
        return publishedWeeks;
      });
  }

  function findPublishedWeekIndex(weekKey) {
    return publishedWeeks.findIndex(function(w) { return w.week_key === weekKey; });
  }

  function navWeek(offset) {
    var weeks = siblingWeeks.length > 1 ? siblingWeeks : publishedWeeks;
    if (weeks.length) {
      var idx = siblingWeeks.length > 1 ? siblingIndex : findPublishedWeekIndex(currentWeekKey);
      if (idx === -1) idx = weeks.length - 1;
      var target = weeks[idx + offset];
      if (target && target.week_key) {
        fetchSchedule(target.week_key);
        return;
      }
      return;
    }

    if (!currentWeekKey) currentWeekKey = getISOWeekString(new Date());
    var d = parseISOWeek(currentWeekKey);
    d.setDate(d.getDate() + (offset * 7));
    fetchSchedule(getISOWeekString(d));
  }

  if (btnPrev) btnPrev.addEventListener('click', function() { navWeek(-1); });
  if (btnNext) btnNext.addEventListener('click', function() { navWeek(1); });
  if (btnCurrent) btnCurrent.addEventListener('click', function() {
    loadPublishedWeeks().then(function(weeks) {
      if (weeks.length) fetchSchedule(weeks[weeks.length - 1].week_key);
      else fetchSchedule(null);
    });
  });

  // Load published weeks list, then show the latest active week
  loadPublishedWeeks().then(function(weeks) {
    if (weeks.length) fetchSchedule(weeks[weeks.length - 1].week_key);
    else fetchSchedule(null);
  });
})();
