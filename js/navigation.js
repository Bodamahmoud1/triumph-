h(function (global) {
  function getEl(id) { return document.getElementById(id); }

  function toggleMobMenu(forceOpen) {
    var drawer = getEl('mob-drawer');
    var backdrop = getEl('mob-backdrop');
    var toggle = document.querySelector('.mob-toggle');
    if (!drawer || !backdrop) return;

    var open = typeof forceOpen === 'boolean' ? forceOpen : !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    backdrop.classList.toggle('show', open);
    backdrop.classList.toggle('open', open);
    backdrop.classList.toggle('visible', open);
    if (toggle) toggle.classList.toggle('active', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('no-scroll', open);
  }

  function closeMobMenu() { toggleMobMenu(false); }

  function toggleTheme() {
    var root = document.documentElement;
    var current = root.getAttribute('data-scheme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-scheme', next);
    try { localStorage.setItem('clax_theme', next); } catch (e) {}
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMobMenu();
  });

  global.toggleMobMenu = toggleMobMenu;
  global.closeMobMenu = closeMobMenu;
  global.toggleTheme = toggleTheme;
})(window);
