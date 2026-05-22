// js/intro.js - Startup Loading Animation
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
