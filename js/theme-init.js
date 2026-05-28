(function () {
  var theme;
  try {
    theme = localStorage.getItem('clax_theme');
  } catch (e) {}
  if (!theme && window.matchMedia) {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-scheme', theme || 'light');
})();
