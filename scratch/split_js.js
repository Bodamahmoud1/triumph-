const fs = require('fs');

const scriptPath = 'b:\\Downloads\\clax\\script.js';
let content = fs.readFileSync(scriptPath, 'utf8');

// The file has several distinct sections:
// 1. Intro IIFE (lines 1 to 48)
// 2. Mobile Menu & Theme (lines 50 to 100)

const introCode = `// js/intro.js - Startup Loading Animation
(function(){
  var INTRO_KEY = 'clax_intro_seen_v1';
  var t;
  var lockedScrollY = 0;
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lockIntroScroll() {
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add('intro-lock');
    document.body.classList.add('intro-lock');
    document.body.style.top = '-' + lockedScrollY + 'px';
  }
  function unlockIntroScroll() {
    var top = parseInt(document.body.style.top || '0', 10) || 0;
    document.documentElement.classList.remove('intro-lock');
    document.body.classList.remove('intro-lock');
    document.body.style.top = '';
    window.scrollTo(0, -top);
  }

  window.closeIntro = function(){
    clearTimeout(t);
    var el = document.getElementById('intro-overlay');
    if(!el || el.classList.contains('hiding')) return;
    try {
      localStorage.setItem(INTRO_KEY, '1');
    } catch (error) {}
    el.classList.add('hiding');
    setTimeout(function(){
      el.style.display = 'none';
      unlockIntroScroll();
    }, reducedMotion ? 0 : 420);
  };

  var overlay = document.getElementById('intro-overlay');
  var seenIntro = false;
  try {
    seenIntro = localStorage.getItem(INTRO_KEY) === '1';
  } catch (error) {}

  if (!overlay || seenIntro || reducedMotion) {
    if (overlay) overlay.style.display = 'none';
    return;
  }

  lockIntroScroll();
  t = setTimeout(window.closeIntro, 2800);
})();
`;

const navCode = `// js/navigation.js - Mobile Drawer and Theme Toggle
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
`;

fs.writeFileSync('b:\\Downloads\\clax\\js\\intro.js', introCode, 'utf8');
fs.writeFileSync('b:\\Downloads\\clax\\js\\navigation.js', navCode, 'utf8');

// Now we need to remove the first 100 lines from script.js
const lines = content.split(/\r?\n/);
const remainingLines = lines.slice(100);

fs.writeFileSync('b:\\Downloads\\clax\\script.js', remainingLines.join('\n'), 'utf8');
console.log('Successfully split intro.js and navigation.js');
