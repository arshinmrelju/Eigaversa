/* ==========================================================
   EIGAVERSA — Group Registration Script
   Dynamic members (min 2, max 10) with client-side
   validation and Firestore submission.
   ========================================================== */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var MAX_MEMBERS = Infinity;
  var MIN_MEMBERS = 2;

  var form = document.getElementById('group-form');
  if (!form) return;

  var container = document.getElementById('members-container');
  var addBtn = document.getElementById('add-member-btn');
  var limitMsg = document.getElementById('members-limit-msg');
  var submitBtn = form.querySelector('button[type="submit"]');

  var YEARS = ['1st Year', '2nd Year', '3rd Year', '1st Year (PG)', '2nd Year (PG)'];

  var ROLL_NUMBERS = [];
  for (var rn = 1; rn <= 100; rn++) {
    ROLL_NUMBERS.push(String(rn));
  }

  /* --- Member card markup --- */

  function buildMemberCard(index) {
    var card = document.createElement('div');
    card.className = 'member-card';
    card.dataset.memberIndex = index;

    var head = document.createElement('div');
    head.className = 'member-card-head';

    var title = document.createElement('h3');
    title.textContent = 'Member ' + index;

    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'remove-member-btn';
    removeBtn.textContent = 'Remove Member';
    removeBtn.setAttribute('aria-label', 'Remove member ' + index);

    head.appendChild(title);
    head.appendChild(removeBtn);

    var nameField = buildField('text', 'name', index, 'Full Name', 'Member full name');
    var rollField = buildSelect('rollNo', index, 'Roll Number', ROLL_NUMBERS, 'Select roll number');
    var yearField = buildSelect('year', index, 'Year of Studying', YEARS, 'Select your year');

    card.appendChild(head);
    card.appendChild(nameField);
    card.appendChild(rollField);
    card.appendChild(yearField);

    return card;
  }

  function buildField(type, name, index, labelText, placeholder) {
    var field = document.createElement('div');
    field.className = 'form-field';

    var label = document.createElement('label');
    label.htmlFor = memberInputId(name, index);
    label.textContent = labelText + ' ';

    var req = document.createElement('span');
    req.className = 'req';
    req.setAttribute('aria-hidden', 'true');
    req.textContent = '*';
    label.appendChild(req);

    var input = document.createElement('input');
    input.type = type;
    input.id = memberInputId(name, index);
    input.name = name;
    input.placeholder = placeholder;
    input.required = true;
    if (type === 'tel') {
      input.autocomplete = 'tel';
    }

    field.appendChild(label);
    field.appendChild(input);
    field.appendChild(buildErrorEl());
    return field;
  }

  function buildSelect(name, index, labelText, options, placeholder) {
    var field = document.createElement('div');
    field.className = 'form-field';

    var label = document.createElement('label');
    label.htmlFor = memberInputId(name, index);
    label.textContent = labelText + ' ';

    var req = document.createElement('span');
    req.className = 'req';
    req.setAttribute('aria-hidden', 'true');
    req.textContent = '*';
    label.appendChild(req);

    var select = document.createElement('select');
    select.id = memberInputId(name, index);
    select.name = name;
    select.required = true;

    var placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.selected = true;
    placeholderOption.disabled = true;
    select.appendChild(placeholderOption);

    options.forEach(function (optionText) {
      var option = document.createElement('option');
      option.value = optionText;
      option.textContent = optionText;
      select.appendChild(option);
    });

    var wrapper = document.createElement('div');
    wrapper.className = 'select-wrapper';

    var arrow = document.createElement('span');
    arrow.className = 'select-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9" /></svg>';

    wrapper.appendChild(select);
    wrapper.appendChild(arrow);

    field.appendChild(label);
    field.appendChild(wrapper);
    field.appendChild(buildErrorEl());
    return field;
  }

  function buildErrorEl() {
    var errorEl = document.createElement('p');
    errorEl.className = 'field-error';
    return errorEl;
  }

  function memberInputId(name, index) {
    return 'member-' + index + '-' + name;
  }

  /* --- Member management --- */

  function addMember() {
    var count = container.querySelectorAll('.member-card').length;
    if (count >= MAX_MEMBERS) return;

    var card = buildMemberCard(count + 1);
    container.appendChild(card);

    card.querySelector('.remove-member-btn').addEventListener('click', function () {
      removeMember(card);
    });

    updateMemberState();

    var firstName = card.querySelector('input[name="name"]');
    firstName.focus();
  }

  function removeMember(card) {
    if (container.querySelectorAll('.member-card').length <= MIN_MEMBERS) return;

    card.remove();
    renumberMembers();
    updateMemberState();
  }

  function renumberMembers() {
    var cards = container.querySelectorAll('.member-card');
    cards.forEach(function (card, i) {
      var newIndex = i + 1;
      card.dataset.memberIndex = newIndex;
      card.querySelector('.member-card-head h3').textContent = 'Member ' + newIndex;
      card.querySelectorAll('input, select').forEach(function (input) {
        input.id = memberInputId(input.name, newIndex);
        var field = input.closest('.form-field');
        if (field) {
          var label = field.querySelector('label');
          if (label) label.htmlFor = input.id;
        }
      });
    });
  }

  function updateMemberState() {
    var count = container.querySelectorAll('.member-card').length;
    var atMax = count >= MAX_MEMBERS;

    addBtn.disabled = atMax;
    addBtn.setAttribute('aria-disabled', atMax ? 'true' : 'false');
    limitMsg.hidden = !atMax;
  }

  /* --- Validation --- */

  function validateField(input) {
    var valid = true;
    var value = input.value.trim();
    var field = input.closest('.form-field');

    if (input.required && !value) {
      valid = false;
      showError(field, 'This field is required.');
    } else if (input.type === 'tel' && value && !/^[0-9]{10,13}$/.test(value.replace(/[\s-]/g, ''))) {
      valid = false;
      showError(field, 'Enter a valid phone number (10 to 13 digits).');
    } else if (field) {
      clearError(field);
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

  function collectMembers() {
    var members = [];
    container.querySelectorAll('.member-card').forEach(function (card) {
      members.push({
        name: card.querySelector('input[name="name"]').value.trim(),
        rollNo: card.querySelector('select[name="rollNo"]').value,
        year: card.querySelector('select[name="year"]').value
      });
    });
    return members;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var memberCount = container.querySelectorAll('.member-card').length;

    if (memberCount < MIN_MEMBERS) {
      showSuccess('Add at least ' + MIN_MEMBERS + ' members to submit your group.', true);
      return;
    }

    var allValid = true;
    var focusTarget = null;

    form.querySelectorAll('input, select').forEach(function (input) {
      if (!validateField(input)) {
        allValid = false;
        if (!focusTarget) focusTarget = input;
      }
    });

    if (!allValid) {
      if (focusTarget) focusTarget.focus();
      return;
    }

    var fb = window.EigaversaFirebase;
    if (!fb || !fb.isConfigured()) {
      showSuccess('Firebase is not configured. Please add your config in js/firebase-config.js.', true);
      return;
    }

    var data = {
      teamName: form.querySelector('#team-name').value.trim(),
      department: form.querySelector('#team-department').value,
      phone: form.querySelector('#team-phone').value.trim(),
      theme: form.querySelector('#team-theme').value,
      members: collectMembers()
    };

    setBusy(true);

    fb.saveGroupRegistration(data).then(function (result) {
      setBusy(false);
      if (result) {
        form.reset();
        rebuildMembers();
        showSuccess('Group registration submitted successfully! Your entry pass has been generated below.');
        if (window.EigaversaTicket) {
          window.EigaversaTicket.showGroupPass(data, result.registrationId);
        }
      } else {
        showSuccess('Registration failed. Please check your connection and try again.', true);
      }
    });
  });

  function rebuildMembers() {
    container.innerHTML = '';
    addMember();
  }

  function showSuccess(message, isError) {
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

    window.setTimeout(function () {
      successEl.classList.remove('is-visible');
    }, 7000);
  }

  /* --- Init --- */

  addBtn.addEventListener('click', addMember);
  rebuildMembers();
});
