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

  var cleaned = false;
  var cleanup = function () {
    if (cleaned) return;
    cleaned = true;
    element.classList.remove('print-target');
    document.body.classList.remove('is-printing');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  setTimeout(function () {
    window.print();
  }, 150);

  // Fallback cleanup in case afterprint doesn't fire
  setTimeout(cleanup, 5000);
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
