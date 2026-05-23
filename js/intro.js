(function (global) {
  var INTRO_KEY = 'triumph_intro_seen_v1';

  function closeIntro() {
    var overlay = document.getElementById('intro-overlay');
    if (!overlay) return;
    overlay.classList.add('is-hidden');
    overlay.setAttribute('aria-hidden', 'true');
    try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
  }

  document.addEventListener('DOMContentLoaded', function () {
    var overlay = document.getElementById('intro-overlay');
    if (!overlay) return;

    var seen = false;
    try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch (e) {}
    if (seen) {
      closeIntro();
      return;
    }

    setTimeout(closeIntro, 6000);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeIntro();
    });
  });

  global.closeIntro = closeIntro;
})(window);
