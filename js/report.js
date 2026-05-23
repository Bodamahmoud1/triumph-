(function (global) {
  function buildPageReport() {
    return {
      timestamp: new Date().toISOString(),
      chemicals: document.querySelectorAll('.product-card').length,
      programs: document.querySelectorAll('.prog-card').length,
      activeSection: (document.querySelector('.app-section.is-active') || {}).id || null
    };
  }

  global.TriumphReport = {
    snapshot: buildPageReport
  };
})(window);
