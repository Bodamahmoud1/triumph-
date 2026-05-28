(function (global) {
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


  function handleNavigationClick(event) {
    var target = event.target.closest('[data-action], [data-nav-section]');
    if (!target) return;

    var action = target.getAttribute('data-action');
    var section = target.getAttribute('data-nav-section');

    if (section && typeof global.switchSection === 'function') {
      event.preventDefault();
      global.switchSection(section);
      if (target.getAttribute('data-close-mobile') === 'true') closeMobMenu();
      return;
    }

    if (!action) return;
    event.preventDefault();

    if (action === 'close-intro' && typeof global.closeIntro === 'function') {
      global.closeIntro();
    } else if (action === 'toggle-theme') {
      toggleTheme();
    } else if (action === 'toggle-mobile-menu') {
      toggleMobMenu();
    } else if (action === 'close-mobile-menu') {
      closeMobMenu();
    } else if (action === 'toggle-mobile-category' && typeof global.toggleMobCat === 'function') {
      global.toggleMobCat(target);
    }
  }

  document.addEventListener('click', handleNavigationClick);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMobMenu();
  });

  global.toggleMobMenu = toggleMobMenu;
  global.closeMobMenu = closeMobMenu;
  global.toggleTheme = toggleTheme;
})(window);
