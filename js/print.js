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

  // Inject print header
  var existingHeader = document.getElementById('print-page-header');
  if (existingHeader) existingHeader.remove();
  var existingFooter = document.getElementById('print-page-footer');
  if (existingFooter) existingFooter.remove();

  var title = getCardTitle(element) || 'Document';
  var now = new Date();
  var dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  var timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  var printHeader = document.createElement('div');
  printHeader.id = 'print-page-header';
  printHeader.innerHTML =
    '<div class="print-header-inner">' +
    '  <div class="print-header-brand">' +
    '    <div class="print-logo-mark">T</div>' +
    '    <div class="print-brand-text">' +
    '      <div class="print-hotel-name">TRIUMPH LUXURY HOTEL</div>' +
    '      <div class="print-dept-name">Laundry Department</div>' +
    '    </div>' +
    '  </div>' +
    '  <div class="print-header-info">' +
    '    <div class="print-doc-title">' + escapeHtmlPrint(title) + '</div>' +
    '    <div class="print-doc-date">' + dateStr + ' — ' + timeStr + '</div>' +
    '  </div>' +
    '</div>';

  var printFooter = document.createElement('div');
  printFooter.id = 'print-page-footer';
  printFooter.innerHTML =
    '<div class="print-footer-inner">' +
    '  <span>Triumph Hotel — Laundry Operations Reference</span>' +
    '  <span>Confidential — Internal Use Only</span>' +
    '</div>';

  // Insert header before the print target and footer after
  element.parentNode.insertBefore(printHeader, element);
  if (element.nextSibling) {
    element.parentNode.insertBefore(printFooter, element.nextSibling);
  } else {
    element.parentNode.appendChild(printFooter);
  }

  var cleaned = false;
  var cleanup = function () {
    if (cleaned) return;
    cleaned = true;
    element.classList.remove('print-target');
    document.body.classList.remove('is-printing');
    var h = document.getElementById('print-page-header');
    var f = document.getElementById('print-page-footer');
    if (h) h.remove();
    if (f) f.remove();
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  setTimeout(function () {
    window.print();
  }, 200);

  // Fallback cleanup
  setTimeout(cleanup, 8000);
}

function escapeHtmlPrint(str) {
  var div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
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

  var printSchedule = document.getElementById('print-schedule');
  if (printSchedule) {
    printSchedule.addEventListener('click', function () {
      printTarget(document.getElementById('schedule-print-area'), 'schedule');
    });
  }
}
