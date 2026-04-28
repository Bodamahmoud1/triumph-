(function(){
  var t;
  var lockedScrollY = 0;
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
    el.classList.add('hiding');
    setTimeout(function(){
      el.style.display = 'none';
      unlockIntroScroll();
    }, 680);
  };

  lockIntroScroll();
  t = setTimeout(window.closeIntro, 30000);
})();

function toggleMobMenu() {
  var drawer   = document.getElementById('mob-drawer');
  var backdrop = document.getElementById('mob-backdrop');
  var toggle   = document.getElementById('mob-toggle');
  var isOpen   = drawer.classList.contains('open');
  if (isOpen) { closeMobMenu(); } else {
    backdrop.classList.add('open');
    requestAnimationFrame(function(){
      backdrop.classList.add('visible');
      drawer.classList.add('open');
      toggle.classList.add('active');
    });
    document.body.style.overflow = 'hidden';
  }
}
function closeMobMenu() {
  var drawer   = document.getElementById('mob-drawer');
  var backdrop = document.getElementById('mob-backdrop');
  var toggle   = document.getElementById('mob-toggle');
  backdrop.classList.remove('visible');
  drawer.classList.remove('open');
  toggle.classList.remove('active');
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

function initCatalogUX() {
  var searchInput = document.getElementById('product-search');
  var filterButtons = Array.prototype.slice.call(document.querySelectorAll('.hero-filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.product-card'));
  var countNode = document.getElementById('catalog-count');
  var currentTheme = 'all';

  function applyFilters() {
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    var visible = 0;

    cards.forEach(function (card) {
      var text = card.textContent.toLowerCase();
      var matchesQuery = !query || text.indexOf(query) !== -1;
      var matchesTheme = currentTheme === 'all' || card.getAttribute('data-theme') === currentTheme;
      var show = matchesQuery && matchesTheme;
      card.classList.toggle('is-hidden', !show);
      if (show) visible++;
    });

    if (countNode) {
      countNode.textContent = visible + ' products';
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      currentTheme = button.getAttribute('data-filter') || 'all';
      filterButtons.forEach(function (btn) {
        btn.classList.toggle('active', btn === button);
      });
      applyFilters();
    });
  });

  applyFilters();
}

document.addEventListener('DOMContentLoaded', initCatalogUX);

/* ═══ SECTION SWITCHER ═══ */
function switchSection(sectionName) {
  // Hide all sections
  var sections = document.querySelectorAll('.app-section');
  for (var i = 0; i < sections.length; i++) {
    sections[i].classList.remove('is-active');
  }

  // Show the target section
  var target = document.getElementById('section-' + sectionName);
  if (target) {
    // Force re-trigger animation by removing then adding class
    target.style.animation = 'none';
    target.offsetHeight; // reflow
    target.style.animation = '';
    target.classList.add('is-active');
  }

  // Update bottom nav active state
  var navBtns = document.querySelectorAll('.bnav-item');
  for (var j = 0; j < navBtns.length; j++) {
    var btn = navBtns[j];
    if (btn.getAttribute('data-section') === sectionName) {
      btn.classList.add('is-active');
    } else {
      btn.classList.remove('is-active');
    }
  }

  // Scroll to top of page
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══ MOBILE DRAWER CATEGORY TOGGLE ═══ */
function toggleMobCat(btn) {
  var category = btn.closest('.mob-category');
  if (!category) return;

  // If it has sub-items, toggle the accordion
  var items = category.querySelector('.mob-cat-items');
  if (items) {
    // Close all other open categories
    var allCats = document.querySelectorAll('.mob-category.open');
    for (var i = 0; i < allCats.length; i++) {
      if (allCats[i] !== category) {
        allCats[i].classList.remove('open');
      }
    }
    category.classList.toggle('open');
  }
}

/* ═══ INTERACTIVE BUBBLE ANIMATION ═══ */
(function () {
  var canvas = document.getElementById('bubble-canvas');
  if (!canvas) return;
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    canvas.style.display = 'none';
    return;
  }
  var ctx = canvas.getContext('2d');
  var mouse = { x: -9999, y: -9999 };
  var bubbles = [];
  var isCompactViewport = window.matchMedia('(max-width: 700px)').matches;
  var isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  var COUNT = isCompactViewport || isTouchDevice ? 20 : 55;
  var W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* Track mouse and touch */
  if (!isTouchDevice) {
    document.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
  } else {
    document.addEventListener('touchmove', function (e) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }, { passive: true });
  }
  document.addEventListener('mouseleave', function () {
    mouse.x = -9999; mouse.y = -9999;
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      mouse.x = -9999;
      mouse.y = -9999;
    }
  });

  /* Colour palette matching the design */
  var COLORS = [
    '197,160,90',   /* gold */
    '43,82,168',    /* blue */
    '255,255,255',  /* white */
    '197,160,90',   /* gold (weighted) */
    '43,82,168'     /* blue (weighted) */
  ];

  function randomBubble(spreadY) {
    var r = Math.random() * 28 + 5;
    return {
      x     : Math.random() * W,
      y     : spreadY ? Math.random() * H : H + r + 10,
      r     : r,
      vx    : (Math.random() - 0.5) * 0.8,
      vy    : -(Math.random() * 0.2 + 0.08),   /* upward, slow */
      alpha : Math.random() * 0.25 + 0.04,
      color : COLORS[Math.floor(Math.random() * COLORS.length)]
    };
  }

  for (var i = 0; i < COUNT; i++) {
    bubbles.push(randomBubble(true));
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];

      /* Mouse repulsion */
      var dx   = b.x - mouse.x;
      var dy   = b.y - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150 && dist > 0) {
        var force = (150 - dist) / 150 * 4.5;
        b.vx += (dx / dist) * force * 0.12;
        b.vy += (dy / dist) * force * 0.12;
      }

      /* Drift damping so they don't rocket off */
      b.vx *= 0.97;
      b.vy  = b.vy * 0.985 - (Math.random() * 0.003 + 0.07);  /* keep rising very slowly */

      b.x += b.vx;
      b.y += b.vy;

      /* Wrap horizontally */
      if (b.x < -b.r)       b.x = W + b.r;
      if (b.x > W + b.r)    b.x = -b.r;

      /* Recycle when off top */
      if (b.y < -b.r * 3) {
        bubbles[i] = randomBubble(false);
        continue;
      }

      /* Draw bubble ring */
      var grad = ctx.createRadialGradient(
        b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.05,
        b.x, b.y, b.r
      );
      grad.addColorStop(0, 'rgba(' + b.color + ',' + (b.alpha * 1.8) + ')');
      grad.addColorStop(0.7, 'rgba(' + b.color + ',' + (b.alpha * 0.5) + ')');
      grad.addColorStop(1, 'rgba(' + b.color + ',0)');

      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      /* Glint */
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,' + (b.alpha * 3.5) + ')';
      ctx.fill();

      /* Ring outline */
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + b.color + ',' + (b.alpha * 2.2) + ')';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  draw();
})();