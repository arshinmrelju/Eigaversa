/* ==========================================================
   EIGAVERSA — Rules & Regulations Modal
   Shared module: bank-style scroll-gated T&C checkbox.
   On confirm it stores an acceptance flag in localStorage
   so repeat registrations skip the gate.
   ========================================================== */

(function () {
  'use strict';

  var PREFIX = 'eigaversa_rulesAccepted_';

  var modal = null;
  var scroller = null;
  var scrollHint = null;
  var masterWrap = null;
  var checkAll = null;
  var confirmBtn = null;
  var closeX = null;
  var agreeError = null;

  var scrolledFully = false;
  var onAcceptCb = null;

  function el(id) {
    return document.getElementById(id);
  }

  /* --- Reset modal to locked state --- */

  function resetRulesCheckboxes() {
    scrolledFully = false;
    if (checkAll) {
      checkAll.disabled = true;
      checkAll.checked = false;
    }
    if (confirmBtn) confirmBtn.disabled = true;
    if (agreeError) {
      agreeError.textContent = '';
      agreeError.classList.remove('visible');
    }
    if (scrollHint) scrollHint.classList.remove('rules-unlocked');
    if (scroller) scroller.classList.remove('rules-fully-scrolled');
    if (masterWrap) {
      masterWrap.classList.remove('checkbox-enabled');
      masterWrap.classList.add('checkbox-locked');
    }
    var label = masterWrap ? masterWrap.querySelector('.checkbox-master-label') : null;
    if (label) label.classList.remove('has-ticked');
  }

  /* --- Scroll gate --- */

  function markRulesFullyScrolled() {
    if (scrolledFully) return;
    scrolledFully = true;
    if (scroller) scroller.classList.add('rules-fully-scrolled');
    if (scrollHint) scrollHint.classList.add('rules-unlocked');
    if (masterWrap) {
      masterWrap.classList.remove('checkbox-locked');
      masterWrap.classList.add('checkbox-enabled');
    }
    if (checkAll) checkAll.disabled = false;
    syncConfirmButton();
  }

  function isAtScrollBottom(tolerance) {
    if (!scroller) return true;
    tolerance = tolerance || 8;
    return scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - tolerance;
  }

  function initScrollGate() {
    if (!scroller) {
      markRulesFullyScrolled();
      return;
    }
    scroller.addEventListener('scroll', function () {
      if (isAtScrollBottom()) markRulesFullyScrolled();
    }, { passive: true });
    setTimeout(function () {
      if (scroller.scrollHeight <= scroller.clientHeight + 6) {
        markRulesFullyScrolled();
      }
    }, 80);
  }

  /* --- Confirm sync --- */

  function syncConfirmButton() {
    var ok = scrolledFully && checkAll && checkAll.checked;
    if (confirmBtn) confirmBtn.disabled = !ok;
    if (ok && agreeError) {
      agreeError.textContent = '';
      agreeError.classList.remove('visible');
    }
  }

  /* --- Open / close --- */

  function open(key, cb) {
    pendingKey = key;
    onAcceptCb = cb;
    resetRulesCheckboxes();
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(function () {
      if (scroller) scroller.scrollTop = 0;
      if (scroller && scroller.scrollHeight <= scroller.clientHeight + 6) {
        markRulesFullyScrolled();
      }
    }, 30);
  }

  var pendingKey = null;

  function close() {
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    pendingKey = null;
    onAcceptCb = null;
  }

  function hasAccepted(key) {
    try {
      return !!localStorage.getItem(PREFIX + key);
    } catch (e) {
      return false;
    }
  }

  function markAccepted(key) {
    try {
      localStorage.setItem(PREFIX + key, String(Date.now()));
    } catch (e) {}
  }

  /* --- Init --- */

  function init() {
    modal = el('rules-modal');
    if (!modal) return;

    scroller = el('rules-scroll-container');
    scrollHint = el('rules-scroll-hint');
    masterWrap = el('rules-master-checkbox-wrapper');
    checkAll = el('rule-check-all');
    confirmBtn = el('rules-confirm-btn');
    closeX = el('rules-close-x');
    agreeError = el('rules-agree-error');

    initScrollGate();

    if (checkAll) {
      checkAll.addEventListener('change', function () {
        var label = masterWrap ? masterWrap.querySelector('.checkbox-master-label') : null;
        if (checkAll.checked && label) {
          label.classList.add('has-ticked');
        } else if (label) {
          label.classList.remove('has-ticked');
        }
        syncConfirmButton();
      });
    }

    if (masterWrap) {
      masterWrap.addEventListener('click', function (e) {
        if (!scrolledFully) {
          e.preventDefault();
          e.stopPropagation();
          masterWrap.classList.remove('shake');
          void masterWrap.offsetWidth;
          masterWrap.classList.add('shake');
          setTimeout(function () { masterWrap.classList.remove('shake'); }, 400);
          if (agreeError) {
            agreeError.textContent = '⚠️ Scroll through all rules first to unlock the checkbox.';
            agreeError.classList.add('visible');
          }
          if (scroller) {
            scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
          }
        }
      }, true);
    }

    if (closeX) {
      closeX.addEventListener('click', function () {
        close();
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        if (!scrolledFully || !checkAll || !checkAll.checked) {
          if (agreeError) {
            agreeError.textContent = '⚠️ Please accept all Rules & Regulations to continue.';
            agreeError.classList.add('visible');
          }
          var card = modal ? modal.querySelector('.rules-card') : null;
          if (card) {
            card.classList.remove('shake');
            void card.offsetWidth;
            card.classList.add('shake');
            setTimeout(function () { card.classList.remove('shake'); }, 500);
          }
          return;
        }

        var key = pendingKey;
        var cb = onAcceptCb;
        if (key) markAccepted(key);
        close();
        if (cb) cb();
      });
    }

    // Escape key closes
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        close();
      }
    });
  }

  /* --- Public API --- */

  window.EigaversaRules = {
    init: init,
    hasAccepted: hasAccepted,
    show: function (key, cb) {
      if (!modal) {
        init();
      }
      if (!modal) {
        if (cb) cb();
        return;
      }
      open(key, cb);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
