/* ==========================================================
   EIGAVERSA — Solo Registration Script
   Stage 1: client-side validation only. No database yet.
   ========================================================== */

(function () {
  'use strict';

  var form = document.getElementById('solo-form');
  if (!form) return;

  var phoneInput = document.getElementById('phone');
  var submitBtn = form.querySelector('button[type="submit"]');

  /* --- Validation helpers --- */

  function validateField(input) {
    var valid = true;
    var value = input.value.trim();
    var field = input.closest('.form-field');

    if (input.required && !value) {
      valid = false;
      showError(field, input.dataset.emptyMsg || 'This field is required.');
    } else if (input === phoneInput && value && !/^[0-9]{10,13}$/.test(value.replace(/[\s-]/g, ''))) {
      valid = false;
      showError(field, 'Enter a valid phone number (10 to 13 digits).');
    } else if (field) {
      clearError(field);
    }

    if (input === phoneInput) {
      submitBtn.setAttribute('aria-disabled', valid ? 'false' : 'true');
    }

    return valid;
  }

  function showError(field, message) {
    if (!field) return;
    field.classList.add('has-error');
    var errorEl = field.querySelector('.field-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.setAttribute('role', 'alert');
    }
  }

  function clearError(field) {
    if (!field) return;
    field.classList.remove('has-error');
  }

  /* --- Wire up inline validation --- */

  form.addEventListener(
    'input',
    function (event) {
      if (event.target.matches('input, select')) {
        validateField(event.target);
      }
    },
    true
  );

  form.addEventListener(
    'change',
    function (event) {
      if (event.target.matches('select')) {
        validateField(event.target);
      }
    },
    true
  );

  /* --- Submit handler --- */

  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? 'Submitting...' : 'Submit Registration';
  }

  function showMessage(message, isError) {
    var existing = form.querySelector('.form-success');
    var successEl = existing || document.createElement('p');

    if (!existing) {
      successEl.className = 'form-success';
      successEl.setAttribute('role', isError ? 'alert' : 'status');
      form.insertBefore(successEl, form.firstChild);
    }

    successEl.textContent = message;
    successEl.classList.add('is-visible');
    if (isError) {
      successEl.style.borderColor = 'rgba(224, 96, 77, 0.4)';
      successEl.style.color = 'var(--clr-error)';
      successEl.style.background = 'rgba(224, 96, 77, 0.1)';
    } else {
      successEl.style.borderColor = '';
      successEl.style.color = '';
      successEl.style.background = '';
    }
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var inputs = form.querySelectorAll('input, select');
    var allValid = true;

    inputs.forEach(function (input) {
      if (!validateField(input)) {
        allValid = false;
      }
    });

    if (!allValid) {
      var firstInvalid = form.querySelector('.has-error input, .has-error select');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var fb = window.EigaversaFirebase;
    if (!fb || !fb.isConfigured()) {
      showMessage('Firebase is not configured. Please add your config in js/firebase-config.js.', true);
      return;
    }

    var data = {
      name: form.querySelector('#name').value.trim(),
      phone: form.querySelector('#phone').value.trim(),
      department: form.querySelector('#department').value,
      year: form.querySelector('#year-of-study').value,
      theme: form.querySelector('#theme').value
    };

    setBusy(true);

    fb.saveSoloRegistration(data).then(function (result) {
      setBusy(false);
      if (result) {
        form.reset();
        showMessage('Registration submitted successfully! Your entry pass has been generated below.');
        if (window.EigaversaTicket) {
          window.EigaversaTicket.showSoloPass(data, result.registrationId);
        }
      } else {
        showMessage('Registration failed. Please check your connection and try again.', true);
      }
    });
  });
})();
