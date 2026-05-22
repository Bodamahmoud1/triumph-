// js/navigation.js - Mobile Drawer and Theme Toggle
function toggleMobMenu() {
  var drawer   = document.getElementById('mob-drawer');
  var backdrop = document.getElementById('mob-backdrop');
  var toggle   = document.getElementById('mob-toggle');
  if (!drawer || !backdrop || !toggle) return;
  var isOpen   = drawer.classList.contains('open');
  if (isOpen) { closeMobMenu(); } else {
    backdrop.classList.add('open');
    requestAnimationFrame(function(){
      backdrop.classList.add('visible');
      drawer.classList.add('open');
      toggle.classList.add('active');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu / إغلاق القائمة');
    });
    document.body.style.overflow = 'hidden';
  }
}
function closeMobMenu() {
  var drawer   = document.getElementById('mob-drawer');
  var backdrop = document.getElementById('mob-backdrop');
  var toggle   = document.getElementById('mob-toggle');
  if (!drawer || !backdrop || !toggle) return;
  backdrop.classList.remove('visible');
  drawer.classList.remove('open');
  toggle.classList.remove('active');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', 'Open menu / فتح القائمة');
  document.body.style.overflow = '';
  setTimeout(function(){ backdrop.classList.remove('open'); }, 380);
}

window.addEventListener('resize', function () {
  if (window.innerWidth > 980) {
    closeMobMenu();
  }
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    closeMobMenu();
  }
});

function toggleTheme() {
  var html = document.documentElement;
  var current = html.getAttribute('data-scheme');
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-scheme', next);
  localStorage.setItem('clax_theme', next);
}
