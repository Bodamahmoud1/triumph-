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

