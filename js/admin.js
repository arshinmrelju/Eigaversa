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
  var togglePassword = document.getElementById('toggle-password');
  var eyeIconOpen = document.getElementById('eye-icon-open');
  var eyeIconClosed = document.getElementById('eye-icon-closed');
  var logoutBtn = document.getElementById('logout-btn');
  var exportBtn = document.getElementById('export-pdf-btn');

  var tabSolo = document.getElementById('tab-solo');
  var tabGroups = document.getElementById('tab-groups');
  var tabSoloCount = document.getElementById('tab-solo-count');
  var tabGroupsCount = document.getElementById('tab-groups-count');

  var searchInput = document.getElementById('filter-search');
  var searchClearBtn = document.getElementById('filter-search-clear');
  var deptFilter = document.getElementById('filter-department');
  var themeFilter = document.getElementById('filter-theme');
  var statusFilter = document.getElementById('filter-status');
  var tableBody = document.getElementById('table-body');
  var emptyState = document.getElementById('empty-state');
  var rowCount = document.getElementById('row-count');
  var toastEl = document.getElementById('admin-toast');

  var statTotal = document.getElementById('stat-total');
  var statSolo = document.getElementById('stat-solo');
  var statGroups = document.getElementById('stat-groups');
  var statParticipants = document.getElementById('stat-participants');

  var thEntity = document.getElementById('th-entity');
  var thDept = document.getElementById('th-dept');
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

  var STANDARD_THEMES = [
    'Romance',
    'Horror Comedy',
    'Drama',
    'Action / Thriller',
    'Sci-Fi / Fantasy',
    'Comedy',
    'Period / Classic'
  ];

  var STATUSES = ['pending', 'confirmed', 'approved', 'rejected'];

  /* --- State --- */
  var soloList = [];
  var groupList = [];
  var currentTab = 'solo';
  var unsubSolo = null;
  var unsubGroups = null;
  var toastTimer = null;

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

  /* --- Toast Notifications --- */
  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.hidden = true;
    }, 3500);
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
    loginMsg.hidden = !message;
    loginMsg.className = 'login-msg' + (isError ? '' : ' is-success');
  }

  /* Eye toggle */
  if (togglePassword && adminCode) {
    togglePassword.addEventListener('click', function () {
      var isPassword = adminCode.type === 'password';
      adminCode.type = isPassword ? 'text' : 'password';
      // Use classList so display:none fires reliably on SVG elements
      if (eyeIconOpen) eyeIconOpen.classList.toggle('is-hidden', isPassword);
      if (eyeIconClosed) eyeIconClosed.classList.toggle('is-hidden', !isPassword);
      adminCode.focus();
    });
    // Set initial state explicitly (open eye shown, closed eye hidden)
    if (eyeIconOpen) eyeIconOpen.classList.remove('is-hidden');
    if (eyeIconClosed) eyeIconClosed.classList.add('is-hidden');
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var code = adminCode.value.trim();
    if (!code) { adminCode.focus(); return; }

    if (!fb || !fb.isConfigured()) {
      setLoginMsg('Firebase is not configured. Add your config in js/firebase-config.js.', true);
      return;
    }

    loginBtn.disabled = true;
    loginBtn.classList.add('is-loading');
    loginMsg.hidden = true;

    fb.getAdminConfig().then(function (config) {
      loginBtn.disabled = false;
      loginBtn.classList.remove('is-loading');

      var match = config && config.accessCode
        ? code === config.accessCode
        : code === DEFAULT_ACCESS_CODE;

      if (!match) {
        setLoginMsg('Incorrect access code. Please try again.', true);
        adminCode.select();
        adminCode.focus();
        return;
      }

      /* If the admin config doc does not exist yet, seed it with the default code. */
      if (!(config && config.accessCode)) {
        fb.setAdminConfig(DEFAULT_ACCESS_CODE);
      }

      sessionStorage.setItem(SESSION_KEY, '1');
      showDashboard();
    }).catch(function () {
      loginBtn.disabled = false;
      loginBtn.classList.remove('is-loading');
      setLoginMsg('Connection error. Please check your network and try again.', true);
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
        populateThemeFilter();
        populateDepartmentFilter();
        render();
      });
    }
    if (!unsubGroups) {
      unsubGroups = fb.subscribeToGroups(function (list) {
        groupList = list;
        populateThemeFilter();
        populateDepartmentFilter();
        render();
      });
    }
  }

  function stopSubscriptions() {
    if (unsubSolo) { unsubSolo(); unsubSolo = null; }
    if (unsubGroups) { unsubGroups(); unsubGroups = null; }
  }

  /* --- Tabs & Stat Card Triggers --- */

  function switchTab(tab) {
    currentTab = tab;
    tabSolo.classList.toggle('is-active', tab === 'solo');
    tabGroups.classList.toggle('is-active', tab === 'groups');

    if (tab === 'solo') {
      thEntity.textContent = 'Name';
      thDept.textContent = 'Department & Year';
      thContact.textContent = 'Phone';
    } else {
      thEntity.textContent = 'Team Name';
      thDept.textContent = 'Department & Members';
      thContact.textContent = 'Contact';
    }
    render();
  }

  tabSolo.addEventListener('click', function () { switchTab('solo'); });
  tabGroups.addEventListener('click', function () { switchTab('groups'); });

  /* Stat card interactive listeners */
  document.querySelectorAll('.stat-card[data-stat-card]').forEach(function (card) {
    card.addEventListener('click', function () {
      var target = card.getAttribute('data-stat-card');
      if (target === 'solo') {
        switchTab('solo');
      } else if (target === 'groups') {
        switchTab('groups');
      } else if (target === 'total') {
        // Reset all filters
        searchInput.value = '';
        if (searchClearBtn) searchClearBtn.hidden = true;
        deptFilter.value = '';
        themeFilter.value = '';
        statusFilter.value = '';
        render();
      }
    });
  });

  /* Search Clear Button */
  if (searchInput && searchClearBtn) {
    searchInput.addEventListener('input', function () {
      searchClearBtn.hidden = !searchInput.value.trim();
      render();
    });
    searchClearBtn.addEventListener('click', function () {
      searchInput.value = '';
      searchClearBtn.hidden = true;
      searchInput.focus();
      render();
    });
  }

  deptFilter.addEventListener('change', render);
  themeFilter.addEventListener('change', render);
  statusFilter.addEventListener('change', render);

  /* --- Dynamic Filters Population --- */

  function populateDepartmentFilter() {
    var existing = Array.from(deptFilter.options).map(function (o) { return o.value; });
    var allDepts = DEPARTMENTS.slice();

    // Incorporate any dynamic dept in Firestore data
    soloList.concat(groupList).forEach(function (doc) {
      if (doc.department && allDepts.indexOf(doc.department) === -1) {
        allDepts.push(doc.department);
      }
    });

    allDepts.sort();
    allDepts.forEach(function (d) {
      if (existing.indexOf(d) === -1) {
        var opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        deptFilter.appendChild(opt);
      }
    });
  }

  function populateThemeFilter() {
    var selectedValue = themeFilter.value;
    var themesSet = {};

    STANDARD_THEMES.forEach(function (t) {
      themesSet[t] = true;
    });

    soloList.concat(groupList).forEach(function (doc) {
      if (doc.theme && doc.theme.trim()) {
        themesSet[doc.theme.trim()] = true;
      }
    });

    var themesList = Object.keys(themesSet).sort();
    themeFilter.innerHTML = '<option value="">All Themes</option>';

    themesList.forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      if (t === selectedValue) opt.selected = true;
      themeFilter.appendChild(opt);
    });
  }

  function normalizeStr(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

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
          searchable = [doc.registrationId, doc.name, doc.phone, doc.department, doc.rollNo, doc.theme, doc.status].join(' ').toLowerCase();
        } else {
          var memberNames = (doc.members || []).map(function (m) { return m.name; }).join(' ');
          searchable = [doc.registrationId, doc.teamName, doc.department, doc.phone, memberNames, doc.theme, doc.status].join(' ').toLowerCase();
        }
        return { doc: doc, searchable: searchable };
      })
      .filter(function (item) {
        if (q && item.searchable.indexOf(q) === -1) return false;
        if (dept && item.doc.department !== dept) return false;
        if (theme && theme !== '') {
          if (normalizeStr(item.doc.theme) !== normalizeStr(theme)) return false;
        }
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

    if (tabSoloCount) tabSoloCount.textContent = soloList.length;
    if (tabGroupsCount) tabGroupsCount.textContent = groupList.length;
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
        var soloRoll = doc.rollNo ? '<br><small>Roll ' + escapeHtml(doc.rollNo) + '</small>' : '';
        tr.innerHTML =
          '<td class="cell-id" data-label="ID"><span class="cell-value">' + escapeHtml(doc.registrationId) + '</span></td>' +
          '<td data-label="Name"><span class="cell-value"><strong>' + escapeHtml(doc.name) + '</strong>' + soloRoll + '</span></td>' +
          '<td data-label="Department &amp; Year"><span class="cell-value"><strong>' + escapeHtml(doc.department) + '</strong><br><small>' + escapeHtml(doc.year) + '</small></span></td>' +
          '<td class="cell-nowrap" data-label="Theme"><span class="cell-value">' + escapeHtml(doc.theme) + '</span></td>' +
          '<td class="cell-nowrap cell-contact" data-label="Phone"><span class="cell-value">' + escapeHtml(doc.phone) + '</span></td>';
      } else {
        var members = doc.members || [];
        var contact = doc.phone ? escapeHtml(doc.phone) : '-';
        var memberInfo = members.map(function (m) {
          return m.name + ' (' + m.year + (m.rollNo ? ', Roll ' + m.rollNo : '') + ')';
        }).join(', ');
        tr.innerHTML =
          '<td class="cell-id" data-label="ID"><span class="cell-value">' + escapeHtml(doc.registrationId) + '</span></td>' +
          '<td data-label="Team Name"><span class="cell-value"><strong>' + escapeHtml(doc.teamName) + '</strong><br><small>' + escapeHtml(memberInfo) + '</small></span></td>' +
          '<td data-label="Department &amp; Members"><span class="cell-value"><strong>' + escapeHtml(doc.department) + '</strong><br><small>' + (doc.memberCount || members.length) + ' members</small></span></td>' +
          '<td class="cell-nowrap" data-label="Theme"><span class="cell-value">' + escapeHtml(doc.theme) + '</span></td>' +
          '<td class="cell-nowrap cell-contact" data-label="Contact"><span class="cell-value">' + contact + '</span></td>';
      }

      var statusTd = document.createElement('td');
      statusTd.className = 'cell-status';
      statusTd.setAttribute('data-label', 'Status');

      /* Integrated status selector badge */
      var statusSelect = document.createElement('select');
      statusSelect.className = 'status-select';
      statusSelect.setAttribute('aria-label', 'Change status for ' + doc.registrationId);
      statusSelect.setAttribute('data-status', doc.status || 'pending');

      STATUSES.forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        opt.selected = doc.status === s;
        statusSelect.appendChild(opt);
      });

      var collectionName = currentTab === 'solo' ? 'eigaversa_solo' : 'eigaversa_groups';

      statusSelect.addEventListener('change', function () {
        var newStatus = statusSelect.value;
        statusSelect.setAttribute('data-status', newStatus);
        fb.updateRegistrationStatus(collectionName, doc.id, newStatus).then(function (ok) {
          if (ok) {
            doc.status = newStatus;
            showToast('Registration ' + doc.registrationId + ' status set to ' + newStatus.toUpperCase());
            updateStats();
          } else {
            showToast('Failed to update status for ' + doc.registrationId);
          }
        });
      });

      statusTd.appendChild(statusSelect);

      var actionsTd = document.createElement('td');
      actionsTd.className = 'cell-actions';
      actionsTd.setAttribute('data-label', 'Actions');

      var actionGroup = document.createElement('div');
      actionGroup.className = 'action-btn-group';

      /* Entry Pass button */
      var passBtn = document.createElement('button');
      passBtn.type = 'button';
      passBtn.className = 'pass-btn';
      passBtn.innerHTML = '<span>🎟️</span> Pass';
      passBtn.setAttribute('aria-label', 'View entry pass for ' + doc.registrationId);
      passBtn.addEventListener('click', function () {
        if (window.EigaversaTicket) {
          window.EigaversaTicket.showModal(doc, doc.registrationId);
        }
      });

      /* Delete button */
      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = 'Delete';
      deleteBtn.setAttribute('aria-label', 'Delete registration ' + doc.registrationId);
      deleteBtn.addEventListener('click', function () {
        if (window.confirm('Are you sure you want to delete registration ' + doc.registrationId + '?')) {
          fb.deleteRegistration(collectionName, doc.id, doc.registrationId).then(function (ok) {
            if (ok) {
              showToast('Deleted ' + doc.registrationId + ' — ID is now available for reuse');
            }
          });
        }
      });

      actionGroup.appendChild(passBtn);
      actionGroup.appendChild(deleteBtn);
      actionsTd.appendChild(actionGroup);

      tr.appendChild(statusTd);
      tr.appendChild(actionsTd);

      tableBody.appendChild(tr);
    });
  }

  /* --- PDF Export --- */

  exportBtn.addEventListener('click', function () {
    var rows = getFilteredRows();
    if (rows.length === 0) {
      showToast('No registrations to export.');
      return;
    }

    var title = 'EIGAVERSA ' + (currentTab === 'solo' ? 'Solo' : 'Group') + ' Registrations';

    if (!window.jspdf || !window.jspdf.jsPDF) {
      showToast('PDF library not loaded. Check your connection and try again.');
      return;
    }

    /* --- Build data rows from current filtered results --- */

    var headings = currentTab === 'solo'
      ? ['Registration ID', 'Name', 'Phone', 'Department', 'Year', 'Roll', 'Theme', 'Status', 'Registered Date']
      : ['Registration ID', 'Team Name', 'Department', 'Theme', 'Contact Phone', 'Members', 'Status', 'Registered Date'];

    var bodyRows = rows.map(function (doc) {
      if (currentTab === 'solo') {
        return [
          doc.registrationId, doc.name, doc.phone, doc.department, doc.year,
          doc.rollNo || '-', doc.theme, doc.status, formatDate(doc.registeredAtDate)
        ];
      }
      var members = (doc.members || []).map(function (m) {
        return m.name + ' (' + m.year + (m.rollNo ? ', Roll ' + m.rollNo : '') + ')';
      }).join(' | ');
      return [
        doc.registrationId, doc.teamName, doc.department, doc.theme, doc.phone,
        members, doc.status, formatDate(doc.registeredAtDate)
      ];
    });

    /* --- Load college logo and generate PDF --- */

    var logo = new Image();
    logo.onload = function () {
      renderPdf(logo, headings, bodyRows, title, rows.length);
    };
    logo.onerror = function () {
      renderPdf(null, headings, bodyRows, title, rows.length);
    };
    logo.src = 'assets/Pazhassiraja_College_Pulpally_Logo.png';
  });

  function renderPdf(logoImg, headings, bodyRows, title, count) {
    var doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    var PW  = doc.internal.pageSize.getWidth();
    var PH  = doc.internal.pageSize.getHeight();
    var MX  = 14;
    var HDR = 35;
    var FTR = 10;

    var NAVY  = [15,  23,  42];    // Deep Navy for primary text and table headers
    var GOLD  = [217, 119,  6];    // Amber Gold for accent lines
    var WHITE = [255, 255, 255];   // Pure White
    var SLATE = [71,  85,  105];   // Muted slate for subtitles
    var BODY  = [30,  41,  59];    // Dark charcoal for table body
    var LINE  = [226, 232, 240];   // Clean border line
    var BG_ALT= [248, 250, 252];   // Very light row stripe

    function sBadge(raw) {
      var s = (raw || '').toLowerCase();
      if (s === 'confirmed') return { bg:[220,252,231], tx:[22, 101, 52] };
      if (s === 'approved')  return { bg:[219,234,254], tx:[30,  64,175] };
      if (s === 'rejected')  return { bg:[254,226,226], tx:[153, 27, 27] };
      return                        { bg:[254,243,199], tx:[146, 64, 14] };
    }

    function drawHeader() {
      // Light background to save ink and look clean on paper
      doc.setFillColor.apply(doc, WHITE);
      doc.rect(0, 0, PW, HDR, 'F');

      // Top dual accent stripe (Navy + Gold)
      doc.setFillColor.apply(doc, NAVY);
      doc.rect(0, 0, PW, 2.5, 'F');
      doc.setFillColor.apply(doc, GOLD);
      doc.rect(0, 2.5, PW, 1, 'F');

      var maxH = 22, maxW = 28;
      var lw = maxH, lh = maxH;
      if (logoImg) {
        var nw = logoImg.naturalWidth || logoImg.width;
        var nh = logoImg.naturalHeight || logoImg.height;
        if (nw && nh) {
          var aspect = nw / nh;
          if (aspect > maxW / maxH) {
            lw = maxW;
            lh = maxW / aspect;
          } else {
            lh = maxH;
            lw = maxH * aspect;
          }
        }
      }
      var lx = MX, ly = (HDR - lh) / 2 + 1.5;
      if (logoImg) {
        try { doc.addImage(logoImg, 'PNG', lx, ly, lw, lh); } catch (e) {}
      }

      var tx = lx + lw + 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor.apply(doc, NAVY);
      doc.text('EIGAVERSA', tx, HDR / 2 + 0.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor.apply(doc, SLATE);
      doc.text('Movie Character Recreation  \u00b7  Pazhassiraja College Pulpally', tx, HDR / 2 + 7.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor.apply(doc, NAVY);
      doc.text((currentTab === 'solo' ? 'SOLO' : 'GROUP') + ' REGISTRATIONS', PW - MX, HDR / 2 - 4, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor.apply(doc, SLATE);
      doc.text('Generated: ' + new Date().toLocaleString(), PW - MX, HDR / 2 + 2.5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor.apply(doc, GOLD);
      doc.text(String(count) + ' Record' + (count !== 1 ? 's' : ''), PW - MX, HDR / 2 + 8.5, { align: 'right' });

      // Bottom gold hairline
      doc.setFillColor.apply(doc, GOLD);
      doc.rect(0, HDR - 0.8, PW, 0.8, 'F');
    }

    function drawFooter(page, total) {
      var fy = PH - FTR;
      doc.setFillColor.apply(doc, BG_ALT);
      doc.rect(0, fy, PW, FTR, 'F');
      doc.setFillColor.apply(doc, GOLD);
      doc.rect(0, fy, PW, 0.8, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor.apply(doc, SLATE);
      doc.text(
        'EIGAVERSA  \u00b7  ' + (currentTab === 'solo' ? 'Solo' : 'Group') + ' Registrations  \u00b7  Pazhassiraja College Pulpally',
        MX, fy + FTR - 3.5
      );
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor.apply(doc, NAVY);
      doc.text('Page ' + page + ' of ' + total, PW - MX, fy + FTR - 3.5, { align: 'right' });
    }

    drawHeader();

    var scIdx = headings.indexOf('Status');

    doc.autoTable({
      startY: HDR + 4,
      head:   [headings],
      body:   bodyRows,
      margin: { left: MX, right: MX, bottom: FTR + 4 },
      tableLineColor: LINE,
      tableLineWidth: 0.15,
      styles: {
        font:        'helvetica',
        fontSize:    7,
        cellPadding: { top: 3, bottom: 3, left: 3.2, right: 3.2 },
        textColor:   BODY,
        lineColor:   LINE,
        lineWidth:   0.15,
        overflow:    'linebreak'
      },
      headStyles: {
        fillColor:   NAVY,
        textColor:   WHITE,
        fontStyle:   'bold',
        fontSize:    7.2,
        cellPadding: { top: 3.8, bottom: 3.8, left: 3.2, right: 3.2 },
        halign:      'left',
        lineWidth:   0
      },
      alternateRowStyles: { fillColor: BG_ALT },
      didParseCell: function (data) {
        if (data.section !== 'body') return;
        if (data.column.index === 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = NAVY;
        }
        if (data.column.index === scIdx) {
          var b = sBadge(data.cell.raw);
          data.cell.styles.fillColor = b.bg;
          data.cell.styles.textColor = b.tx;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize  = 6.5;
          data.cell.styles.halign    = 'center';
        }
      },

      didDrawPage: function (data) {
        if (data.pageNumber > 1) drawHeader();
        drawFooter(data.pageNumber, '\u2013');
      }
    });

    var n = doc.internal.getNumberOfPages();
    for (var i = 1; i <= n; i++) { doc.setPage(i); drawFooter(i, n); }

    var url;
    try { url = doc.output('bloburl'); } catch (e) { url = null; }
    if (!url) { showToast('PDF could not be generated. Please try again.'); return; }
    openPdfPreview(url, title, count);
  }

  /* --- PDF Preview Modal --- */



  function openPdfPreview(url, title, count) {
    var existing = document.getElementById('pdf-preview-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.className = 'pdf-preview-modal';
    modal.id = 'pdf-preview-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'PDF preview');

    var shell = document.createElement('div');
    shell.className = 'pdf-preview-shell';

    var bar = document.createElement('div');
    bar.className = 'pdf-preview-bar';

    var barTitle = document.createElement('span');
    barTitle.className = 'pdf-preview-title';
    barTitle.textContent = title + ' (' + count + ' registrations)';
    bar.appendChild(barTitle);

    var barActions = document.createElement('div');
    barActions.className = 'pdf-preview-actions';

    var downloadBtn = document.createElement('a');
    downloadBtn.className = 'btn btn-primary';
    downloadBtn.textContent = 'Download PDF';
    downloadBtn.href = url;
    downloadBtn.setAttribute('download', 'eigaversa_' + currentTab + '_registrations.pdf');
    barActions.appendChild(downloadBtn);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn-ghost';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', function () {
      modal.remove();
      URL.revokeObjectURL(url);
    });
    barActions.appendChild(closeBtn);

    bar.appendChild(barActions);

    var embed = document.createElement('iframe');
    embed.className = 'pdf-preview-frame';
    embed.title = 'PDF preview';

    shell.appendChild(bar);
    shell.appendChild(embed);
    modal.appendChild(shell);
    document.body.appendChild(modal);
    embed.src = url;

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.remove();
        URL.revokeObjectURL(url);
      }
    });
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

