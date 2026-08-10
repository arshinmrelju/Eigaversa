/* ==========================================================
   EIGAVERSA — Admin Dashboard Script
   Access-code login + Firestore registration management.
   ========================================================== */

document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var SESSION_KEY = 'eigaversa_admin_auth';
  var DEFAULT_ACCESS_CODE = 'ENGPRC1993';

  var fb = window.EigaversaFirebase;

  /* --- DOM refs --- */
  var loginView = document.getElementById('login-view');
  var dashboardView = document.getElementById('dashboard-view');
  var loginForm = document.getElementById('login-form');
  var adminCode = document.getElementById('admin-code');
  var loginBtn = document.getElementById('login-btn');
  var loginMsg = document.getElementById('login-msg');
  var logoutBtn = document.getElementById('logout-btn');
  var exportBtn = document.getElementById('export-csv-btn');

  var tabSolo = document.getElementById('tab-solo');
  var tabGroups = document.getElementById('tab-groups');
  var searchInput = document.getElementById('filter-search');
  var deptFilter = document.getElementById('filter-department');
  var themeFilter = document.getElementById('filter-theme');
  var statusFilter = document.getElementById('filter-status');
  var tableBody = document.getElementById('table-body');
  var emptyState = document.getElementById('empty-state');
  var rowCount = document.getElementById('row-count');

  var statTotal = document.getElementById('stat-total');
  var statSolo = document.getElementById('stat-solo');
  var statGroups = document.getElementById('stat-groups');
  var statParticipants = document.getElementById('stat-participants');

  var thEntity = document.getElementById('th-entity');
  var thYear = document.getElementById('th-year');
  var thContact = document.getElementById('th-contact');

  var DEPARTMENTS = [
    'Department of Biochemistry',
    'Department of Commerce',
    'Department of Economics',
    'Department of English',
    'Department of History',
    'Department of Journalism and Mass Communication',
    'Department of Microbiology',
    'Department of Travel and Tourism'
  ];

  var STATUSES = ['pending', 'confirmed', 'approved', 'rejected'];

  /* --- State --- */
  var soloList = [];
  var groupList = [];
  var currentTab = 'solo';
  var unsubSolo = null;
  var unsubGroups = null;

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(date) {
    if (!date) return '-';
    return date.toLocaleDateString();
  }

  /* --- Auth --- */

  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  }

  function showLogin() {
    dashboardView.hidden = true;
    loginView.hidden = false;
    if (adminCode) adminCode.focus();
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
    startSubscriptions();
  }

  function setLoginMsg(message, isError) {
    if (!loginMsg) return;
    loginMsg.textContent = message;
    loginMsg.hidden = false;
    loginMsg.className = 'login-msg' + (isError ? ' is-error' : '');
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var code = adminCode.value.trim();
    if (!code) return;

    if (!fb || !fb.isConfigured()) {
      setLoginMsg('Firebase is not configured. Add your config in js/firebase-config.js.', true);
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Checking...';
    setLoginMsg('', false);
    loginMsg.hidden = true;

    fb.getAdminConfig().then(function (config) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Sign In';

      var match = config && config.accessCode
        ? code === config.accessCode
        : code === DEFAULT_ACCESS_CODE;

      if (!match) {
        setLoginMsg('Incorrect access code. Please try again.', true);
        adminCode.select();
        return;
      }

      /* If the admin config doc does not exist yet, seed it with the default code. */
      if (!(config && config.accessCode)) {
        fb.setAdminConfig(DEFAULT_ACCESS_CODE);
      }

      sessionStorage.setItem(SESSION_KEY, '1');
      showDashboard();
    });
  });

  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      sessionStorage.removeItem(SESSION_KEY);
      stopSubscriptions();
      soloList = [];
      groupList = [];
      showLogin();
    });
  }

  /* --- Subscriptions --- */

  function startSubscriptions() {
    if (!fb) return;
    if (!unsubSolo) {
      unsubSolo = fb.subscribeToSolo(function (list) {
        soloList = list;
        render();
      });
    }
    if (!unsubGroups) {
      unsubGroups = fb.subscribeToGroups(function (list) {
        groupList = list;
        render();
      });
    }
  }

  function stopSubscriptions() {
    if (unsubSolo) { unsubSolo(); unsubSolo = null; }
    if (unsubGroups) { unsubGroups(); unsubGroups = null; }
  }

  /* --- Tabs --- */

  function switchTab(tab) {
    currentTab = tab;
    tabSolo.classList.toggle('is-active', tab === 'solo');
    tabGroups.classList.toggle('is-active', tab === 'groups');

    if (tab === 'solo') {
      thEntity.textContent = 'Name';
      thYear.textContent = 'Year';
      thContact.textContent = 'Phone';
    } else {
      thEntity.textContent = 'Team Name';
      thYear.textContent = 'Members';
      thContact.textContent = 'Contact';
    }
    render();
  }

  tabSolo.addEventListener('click', function () { switchTab('solo'); });
  tabGroups.addEventListener('click', function () { switchTab('groups'); });

  searchInput.addEventListener('input', render);
  deptFilter.addEventListener('change', render);
  themeFilter.addEventListener('change', render);
  statusFilter.addEventListener('change', render);

  /* --- Filtering --- */

  function getFilteredRows() {
    var q = searchInput.value.trim().toLowerCase();
    var dept = deptFilter.value;
    var theme = themeFilter.value;
    var status = statusFilter.value;
    var source = currentTab === 'solo' ? soloList : groupList;

    var rows = source
      .map(function (doc) {
        var searchable;
        if (currentTab === 'solo') {
          searchable = [doc.registrationId, doc.name, doc.phone, doc.department].join(' ').toLowerCase();
        } else {
          var memberNames = (doc.members || []).map(function (m) { return m.name; }).join(' ');
          searchable = [doc.registrationId, doc.teamName, doc.department, memberNames].join(' ').toLowerCase();
        }
        return { doc: doc, searchable: searchable };
      })
      .filter(function (item) {
        if (q && item.searchable.indexOf(q) === -1) return false;
        if (dept && item.doc.department !== dept) return false;
        if (theme && theme !== '' && (item.doc.theme || '').toLowerCase() !== theme.toLowerCase()) return false;
        if (status && item.doc.status !== status) return false;
        return true;
      })
      .sort(function (a, b) {
        return (b.doc.registeredAtDate || 0) - (a.doc.registeredAtDate || 0);
      })
      .map(function (item) { return item.doc; });

    return rows;
  }

  /* --- Render --- */

  function render() {
    var rows = getFilteredRows();
    rowCount.textContent = rows.length + ' shown';

    updateStats();
    renderRows(rows);
  }

  function updateStats() {
    var total = soloList.length + groupList.length;
    var participants = soloList.length;
    groupList.forEach(function (g) {
      participants += (g.memberCount || (g.members || []).length || 0);
    });
    statTotal.textContent = total;
    statSolo.textContent = soloList.length;
    statGroups.textContent = groupList.length;
    statParticipants.textContent = participants;
  }

  function statusBadge(status) {
    return '<span class="reg-status status-' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>';
  }

  function renderRows(rows) {
    tableBody.innerHTML = '';

    if (rows.length === 0) {
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;

    rows.forEach(function (doc) {
      var tr = document.createElement('tr');

      if (currentTab === 'solo') {
        tr.innerHTML =
          '<td class="cell-id">' + escapeHtml(doc.registrationId) + '</td>' +
          '<td>' + escapeHtml(doc.name) + '</td>' +
          '<td>' + escapeHtml(doc.department) + '</td>' +
          '<td>' + escapeHtml(doc.year) + '</td>' +
          '<td>' + escapeHtml(doc.theme) + '</td>' +
          '<td>' + escapeHtml(doc.phone) + '</td>' +
          '<td>' + statusBadge(doc.status) + '</td>';
      } else {
        var members = doc.members || [];
        var contact = members.length > 0
          ? escapeHtml(members[0].name) + '<br><small>' + escapeHtml(members[0].phone) + '</small>'
          : '-';
        var memberInfo = members.map(function (m) {
          return m.name + ' (' + m.year + ')';
        }).join(', ');
        tr.innerHTML =
          '<td class="cell-id">' + escapeHtml(doc.registrationId) + '</td>' +
          '<td>' + escapeHtml(doc.teamName) + '<br><small>' + escapeHtml(memberInfo) + '</small></td>' +
          '<td>' + escapeHtml(doc.department) + '</td>' +
          '<td>' + (doc.memberCount || members.length) + '</td>' +
          '<td>' + escapeHtml(doc.theme) + '</td>' +
          '<td>' + contact + '</td>' +
          '<td>' + statusBadge(doc.status) + '</td>';
      }

      var actionsTd = document.createElement('td');
      actionsTd.className = 'cell-actions';

      var statusSelect = document.createElement('select');
      statusSelect.className = 'status-select';
      statusSelect.setAttribute('aria-label', 'Change status');
      STATUSES.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        opt.selected = doc.status === s;
        statusSelect.appendChild(opt);
      });

      var collectionName = currentTab === 'solo' ? 'eigaversa_solo' : 'eigaversa_groups';

      statusSelect.addEventListener('change', function () {
        fb.updateRegistrationStatus(collectionName, doc.id, statusSelect.value);
      });

      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', 'Delete registration ' + doc.registrationId);
      deleteBtn.addEventListener('click', function () {
        if (window.confirm('Delete registration ' + doc.registrationId + '?')) {
          fb.deleteRegistration(collectionName, doc.id);
        }
      });

      actionsTd.appendChild(statusSelect);
      actionsTd.appendChild(deleteBtn);
      tr.appendChild(actionsTd);

      tableBody.appendChild(tr);
    });
  }

  /* --- Department filter options --- */

  function populateDepartmentFilter() {
    DEPARTMENTS.forEach(function (d) {
      var opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      deptFilter.appendChild(opt);
    });
  }

  /* --- CSV Export --- */

  exportBtn.addEventListener('click', function () {
    var rows = getFilteredRows();
    if (rows.length === 0) {
      window.alert('No registrations to export.');
      return;
    }

    var headers;
    if (currentTab === 'solo') {
      headers = ['Registration ID', 'Name', 'Phone', 'Department', 'Year', 'Theme', 'Status', 'Registered Date'];
    } else {
      headers = ['Registration ID', 'Team Name', 'Department', 'Theme', 'Members', 'Status', 'Registered Date'];
    }

    var lines = [headers.map(csvCell).join(',')];

    rows.forEach(function (doc) {
      var values;
      if (currentTab === 'solo') {
        values = [
          doc.registrationId,
          doc.name,
          doc.phone,
          doc.department,
          doc.year,
          doc.theme,
          doc.status,
          formatDate(doc.registeredAtDate)
        ];
      } else {
        var members = (doc.members || []).map(function (m) {
          return m.name + ' (' + m.phone + ', ' + m.year + ')';
        }).join(' | ');
        values = [
          doc.registrationId,
          doc.teamName,
          doc.department,
          doc.theme,
          members,
          doc.status,
          formatDate(doc.registeredAtDate)
        ];
      }
      lines.push(values.map(csvCell).join(','));
    });

    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'eigaversa_' + currentTab + '_registrations.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  function csvCell(value) {
    var s = String(value == null ? '' : value);
    if (/[",\n]/.test(s)) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /* --- Init --- */

  populateDepartmentFilter();

  if (!fb || !fb.isConfigured()) {
    setLoginMsg('Firebase is not configured. Add your config in js/firebase-config.js.', true);
    showLogin();
    return;
  }

  if (isLoggedIn()) {
    showDashboard();
  } else {
    showLogin();
  }
});
