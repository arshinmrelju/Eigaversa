/* ==========================================================
   EIGAVERSA Ã¢â‚¬â€ Main Script
   Shared behaviour across all pages.
   ========================================================== */

(function () {
  'use strict';

  /* Footer year */
  var yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  /* Mobile navigation toggle */
  var navToggle = document.getElementById('nav-toggle');
  var navMenu = document.getElementById('site-menu');

  function setMenuOpen(open) {
    if (!navToggle || !navMenu) return;
    navMenu.classList.toggle('is-open', open);
    navToggle.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      setMenuOpen(!navMenu.classList.contains('is-open'));
    });

    navMenu.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        setMenuOpen(false);
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        if (navToggle) navToggle.focus();
      }
    });
  }

  /* Scroll reveal for elements marked with .reveal */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length > 0 && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }
})();

/* ==========================================================
   EIGAVERSA — Index Page Music (proud, game-winning feel)
   Only runs on index.html / home page.
   ========================================================== */
(function () {
  'use strict';

  /* Only run on the home/index page */
  var path = window.location.pathname;
  var isHome = path === '/' || path.slice(-10) === 'index.html' || path.slice(-1) === '/';
  if (!isHome) return;

  /* Inject <audio> */
  var audio = document.createElement('audio');
  audio.loop = true;
  audio.preload = 'auto';
  var src = document.createElement('source');
  src.src = 'assets/award-ceremony.mp3';
  src.type = 'audio/mpeg';
  audio.appendChild(src);
  document.body.appendChild(audio);
  audio.load(); /* start buffering immediately */

  var isMuted = false;

  /* Smooth volume fade-in */
  function fadeIn(target, duration) {
    audio.volume = 0;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      audio.volume = progress * target;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* Inject mute/unmute toggle button */
  var toggleBtn = document.createElement('button');
  toggleBtn.id = 'music-toggle';
  toggleBtn.className = 'music-toggle';
  toggleBtn.type = 'button';
  toggleBtn.setAttribute('aria-label', 'Mute background music');
  toggleBtn.hidden = true;
  toggleBtn.innerHTML =
    '<svg class="icon-sound-on" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
    '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>' +
    '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>' +
    '</svg>' +
    '<svg class="icon-sound-off" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
    '<line x1="23" y1="9" x2="17" y2="15"/>' +
    '<line x1="17" y1="9" x2="23" y2="15"/>' +
    '</svg>';
  document.body.appendChild(toggleBtn);

  toggleBtn.addEventListener('click', function () {
    isMuted = !isMuted;
    audio.muted = isMuted;
    toggleBtn.classList.toggle('is-muted', isMuted);
    toggleBtn.setAttribute('aria-label', isMuted ? 'Unmute background music' : 'Mute background music');
  });

  /* Inject opt-in overlay */
  var overlay = document.createElement('div');
  overlay.id = 'music-overlay';
  overlay.className = 'music-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Enable background music');
  overlay.innerHTML =
    '<div class="music-overlay-card">' +
    '<div class="music-overlay-icon" aria-hidden="true">' +
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9 18V5l12-2v13"/>' +
    '<circle cx="6" cy="18" r="3"/>' +
    '<circle cx="18" cy="16" r="3"/>' +
    '</svg>' +
    '</div>' +
    '<h2 class="music-overlay-title">Experience the Cinematic Atmosphere</h2>' +
    '<p class="music-overlay-desc">Eigaversa comes alive with music. Allow background audio for the full experience.</p>' +
    '<div class="music-overlay-actions">' +
    '<button id="music-allow" class="btn btn-primary" type="button">Play Music</button>' +
    '<button id="music-skip" class="music-skip-btn" type="button">Continue without sound</button>' +
    '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  function dismissOverlay() {
    overlay.classList.add('music-overlay--hidden');
    overlay.addEventListener('transitionend', function () { overlay.remove(); }, { once: true });
    toggleBtn.hidden = false;
  }

  function play(cb) {
    audio.muted = true;
    var p = audio.play();
    if (p !== undefined) {
      p.then(function () {
        audio.muted = false;
        fadeIn(0.15, 400);
        if (cb) cb();
      }).catch(function () {
        audio.muted = false;
        if (cb) cb();
      });
    } else {
      toggleBtn.hidden = false;
    }
  }

  overlay.querySelector('#music-allow').addEventListener('click', function () {
    play(dismissOverlay);
  });

  overlay.querySelector('#music-skip').addEventListener('click', function () {
    audio.pause();
    overlay.classList.add('music-overlay--hidden');
    overlay.addEventListener('transitionend', function () { overlay.remove(); }, { once: true });
  });

  /* Try silent autoplay — bypasses overlay if browser allows it */
  audio.muted = true;
  audio.play().then(function () {
    audio.muted = false;
    fadeIn(0.15, 400);
    dismissOverlay();
  }).catch(function () {
    audio.muted = false;
    /* Overlay stays for user to click */
  });
})();
