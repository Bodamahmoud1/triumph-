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
  var frameId = null;
  var isRunning = false;
  var isCompactViewport = window.matchMedia('(max-width: 700px)').matches;
  var isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  var COUNT = isCompactViewport || isTouchDevice ? 12 : 44;
  var W, H;

  /* Colour palette matching the design */
  var COLORS = [
    '197,160,90',   /* gold */
    '43,82,168',    /* blue */
    '255,255,255',  /* white */
    '197,160,90',   /* gold (weighted) */
    '43,82,168'     /* blue (weighted) */
  ];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    isCompactViewport = window.matchMedia('(max-width: 700px)').matches;
    COUNT = isCompactViewport || isTouchDevice ? 12 : 44;
    while (bubbles.length < COUNT) bubbles.push(randomBubble(true));
    while (bubbles.length > COUNT) bubbles.pop();
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
      stopAnimation();
    } else {
      startAnimation();
    }
  });

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
    if (!isRunning) return;
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

    frameId = requestAnimationFrame(draw);
  }

  function startAnimation() {
    if (isRunning) return;
    isRunning = true;
    frameId = requestAnimationFrame(draw);
  }

  function stopAnimation() {
    isRunning = false;
    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  startAnimation();
  window.laundryBubbleControl = function(active) {
    if (active && !document.hidden) startAnimation();
    else stopAnimation();
  };
})();

