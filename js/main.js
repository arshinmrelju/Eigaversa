/* ==========================================================
   EIGAVERSA — Main Script
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
