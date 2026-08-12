/* ==========================================================
   EIGAVERSA — Entry Slip / Ticket Pass JavaScript Module
   Generates pass UI, QR codes, modals, print triggers,
   and PNG downloads.
   ========================================================== */

(function () {
  'use strict';

  /* ---------- QR Code Generator ---------- */
  /* Uses qrcode-generator (CDN) for real scannable QR codes,
     falls back to a decorative matrix when the library is unavailable. */
  function generateQRCodeSVG(text, size) {
    size = size || 120;
    if (typeof window.qrcode === 'function') {
      try {
        if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs['UTF-8']) {
          window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
        }
        var qr = window.qrcode(0, 'M');
        qr.addData(text);
        qr.make();
        var qrSvg = qr.createSvgTag({ cellSize: 2, margin: 4, scalable: true });
        // Add explicit dimensions so the SVG renders correctly when the
        // ticket is serialized into the PNG export (no external CSS there).
        qrSvg = qrSvg.replace('<svg ', '<svg width="' + size + '" height="' + size + '" ');
        return qrSvg;
      } catch (e) {
        console.warn('EIGAVERSA: real QR generation failed, using fallback.', e);
      }
    }
    return fallbackQRCodeSVG(text, size);
  }

  function fallbackQRCodeSVG(text, size) {
    size = size || 120;
    
    // Convert text to bit pattern hash for SVG grid generation
    // Uses deterministic matrix pattern based on string characters
    var cells = 21; // 21x21 Version 1 QR matrix layout
    var grid = Array(cells).fill(0).map(function() { return Array(cells).fill(0); });
    
    // Helper to setfinder patterns (3 corners)
    function setFinder(row, col) {
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < 7; c++) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            grid[row + r][col + c] = 1;
          }
        }
      }
    }
    
    setFinder(0, 0);       // Top-left
    setFinder(0, 14);      // Top-right
    setFinder(14, 0);      // Bottom-left
    
    // Timing patterns
    for (var i = 8; i < 13; i += 2) {
      grid[6][i] = 1;
      grid[i][6] = 1;
    }
    
    // Hash text bytes into body cells
    var hash = 0;
    for (var h = 0; h < text.length; h++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(h);
      hash |= 0;
    }
    
    var bitPos = 0;
    for (var r = 0; r < cells; r++) {
      for (var c = 0; c < cells; c++) {
        // Skip finder patterns & timing lines
        var isFinder = (r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8);
        var isTiming = (r === 6) || (c === 6);
        if (!isFinder && !isTiming) {
          var charCode = text.charCodeAt(bitPos % text.length);
          var val = (charCode ^ (r * 7 + c * 13 + hash)) % 2 === 0 ? 1 : 0;
          grid[r][c] = val;
          bitPos++;
        }
      }
    }

    var cellSize = size / cells;
    var svgPaths = [];
    
    for (var r = 0; r < cells; r++) {
      for (var c = 0; c < cells; c++) {
        if (grid[r][c] === 1) {
          var x = (c * cellSize).toFixed(2);
          var y = (r * cellSize).toFixed(2);
          var w = cellSize.toFixed(2);
          svgPaths.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + w + '" fill="#0a0b0d"/>');
        }
      }
    }

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      svgPaths.join('') +
      '</svg>';
  }

  /* ---------- Formatting Helpers ---------- */
  function formatTheme(theme) {
    if (!theme) return 'General';
    if (theme.toLowerCase() === 'romance') return 'Romance';
    if (theme.toLowerCase() === 'horror-comedy') return 'Horror Comedy';
    if (theme.toLowerCase() === 'eccentricity') return 'Eccentricity (Psychological Thriller)';
    return theme;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---------- Ticket HTML Generator ---------- */
  function generateTicketHTML(data, registrationId) {
    var isGroup = data.type === 'group' || (data.members && data.members.length > 0) || !!data.teamName;
    var titleName = isGroup ? (data.teamName || 'Group Entry') : (data.name || 'Participant');
    var badgeLabel = isGroup ? 'GROUP ENTRY PASS' : 'SOLO ENTRY PASS';
    var themeLabel = formatTheme(data.theme);
    var regId = registrationId || data.registrationId || 'EIG-PASS';
    var dateStr = data.registeredAtDate ? data.registeredAtDate.toLocaleDateString() : new Date().toLocaleDateString();
    
    var qrPayload = 'EIGAVERSA|' + regId + '|' + (isGroup ? 'GROUP' : 'SOLO') + '|' + titleName + '|' + (data.id || '');
    var qrSvg = generateQRCodeSVG(qrPayload, 120);

    var membersHTML = '';
    if (isGroup && data.members && data.members.length > 0) {
      var items = data.members.map(function (m) {
        var memberMeta = (m.rollNo ? 'Roll ' + m.rollNo + ' &bull; ' : '') + (m.year || '');
        return '<li><span>' + escapeHtml(m.name) + '</span><span class="ticket-member-year">' + escapeHtml(memberMeta) + '</span></li>';
      }).join('');
      membersHTML =
        '<div class="ticket-members-box">' +
          '<div class="ticket-members-title"><span>Team Roster</span><span>' + data.members.length + ' Members</span></div>' +
          '<ul class="ticket-members-list">' + items + '</ul>' +
        '</div>';
    }

    var fieldsHTML = isGroup
      ? '<div class="ticket-field full-width">' +
          '<span class="ticket-label">Team Name</span>' +
          '<span class="ticket-val ticket-val-highlight">' + escapeHtml(data.teamName) + '</span>' +
        '</div>' +
        '<div class="ticket-field">' +
          '<span class="ticket-label">Department</span>' +
          '<span class="ticket-val">' + escapeHtml(data.department) + '</span>' +
        '</div>' +
        '<div class="ticket-field">' +
          '<span class="ticket-label">Theme</span>' +
          '<span class="ticket-val"><span class="ticket-theme-badge">' + escapeHtml(themeLabel) + '</span></span>' +
        '</div>' +
        '<div class="ticket-field">' +
          '<span class="ticket-label">Contact Phone</span>' +
          '<span class="ticket-val">' + escapeHtml(data.phone) + '</span>' +
        '</div>'
      : '<div class="ticket-field full-width">' +
          '<span class="ticket-label">Participant Name</span>' +
          '<span class="ticket-val ticket-val-highlight">' + escapeHtml(data.name) + '</span>' +
        '</div>' +
        '<div class="ticket-field">' +
          '<span class="ticket-label">Department</span>' +
          '<span class="ticket-val">' + escapeHtml(data.department) + '</span>' +
        '</div>' +
        '<div class="ticket-field">' +
          '<span class="ticket-label">Year of Study</span>' +
          '<span class="ticket-val">' + escapeHtml(data.year) + '</span>' +
        '</div>' +
        '<div class="ticket-field">' +
          '<span class="ticket-label">Roll Number</span>' +
          '<span class="ticket-val">' + escapeHtml(data.rollNo) + '</span>' +
        '</div>' +
        '<div class="ticket-field">' +
          '<span class="ticket-label">Theme</span>' +
          '<span class="ticket-val"><span class="ticket-theme-badge">' + escapeHtml(themeLabel) + '</span></span>' +
        '</div>' +
        '<div class="ticket-field">' +
          '<span class="ticket-label">Contact Phone</span>' +
          '<span class="ticket-val">' + escapeHtml(data.phone) + '</span>' +
        '</div>';

    return '' +
      '<div class="ticket-card" id="ticket-card-element">' +
        '<span class="ticket-watermark">EIGA</span>' +
        '<div class="ticket-header">' +
          '<div class="ticket-brand">' +
            '<img src="assets/Pazhassiraja_College_Pulpally_Logo.png" alt="Pazhassiraja College" class="ticket-logo">' +
            '<div class="ticket-brand-text">' +
              '<h2>EIGAVERSA</h2>' +
              '<span>Movie Character Recreation</span>' +
            '</div>' +
          '</div>' +
          '<div class="ticket-badge-pill ' + (isGroup ? 'is-group' : '') + '">' +
            '<span class="ticket-badge-dot"></span>' + badgeLabel +
          '</div>' +
        '</div>' +

        '<div class="ticket-body">' +
          '<div class="ticket-info">' +
            '<div class="ticket-id-tag">' + escapeHtml(regId) + '</div>' +
            '<div class="ticket-grid">' + fieldsHTML + '</div>' +
            membersHTML +
          '</div>' +

          '<div class="ticket-stub">' +
            '<div class="ticket-qr-container">' + qrSvg + '</div>' +
            '<div class="ticket-stub-note">OFFICIAL ENTRY PASS</div>' +
            '<div style="font-size:0.65rem; color:#a8a69e; margin-top:2px;">Issued: ' + escapeHtml(dateStr) + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="ticket-perforation"></div>' +

        '<div class="ticket-footer">' +
          '<div class="ticket-barcode-wrap">' +
            '<div class="ticket-barcode" aria-hidden="true"></div>' +
            '<span style="font-size:0.65rem; color:#a8a69e; margin-top:2px; font-family:monospace;">' + escapeHtml(regId) + '</span>' +
          '</div>' +
          '<div class="ticket-venue-info">' +
            '<strong>Pazhassiraja College Pulpally</strong>' +
            'Dept. of English' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /* ---------- Toast Notice ---------- */
  function showToast(msg) {
    var toast = document.getElementById('ticket-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'ticket-toast';
      toast.className = 'ticket-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('is-show');
    setTimeout(function () {
      toast.classList.remove('is-show');
    }, 3000);
  }

  /* ---------- Download Pass as Image (Canvas snapshot) ---------- */
  function downloadTicketAsPNG(regId) {
    var ticketCard = document.getElementById('ticket-card-element');
    if (!ticketCard) return;

    // Use SVG foreignObject drawing or Canvas rendering to export PNG
    var svgData = 
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + ticketCard.offsetWidth + '" height="' + ticketCard.offsetHeight + '">' +
        '<foreignObject width="100%" height="100%">' +
          '<div xmlns="http://www.w3.org/1999/xhtml">' +
            ticketCard.outerHTML +
          '</div>' +
        '</foreignObject>' +
      '</svg>';

    var canvas = document.createElement('canvas');
    canvas.width = ticketCard.offsetWidth * 2; // High DPI
    canvas.height = ticketCard.offsetHeight * 2;
    var ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    var img = new Image();
    var svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(svgBlob);

    img.onload = function () {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      
      var a = document.createElement('a');
      a.download = (regId || 'EIGAVERSA-Pass') + '.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
      showToast('Downloading Entry Pass image...');
    };
    img.onerror = function() {
      // Fallback: Trigger print if canvas SVG rasterization is blocked by security policy
      window.print();
    };
    img.src = url;
  }

  /* ---------- Modal Management ---------- */
  function ensureModalDOM() {
    var overlay = document.getElementById('ticket-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ticket-modal-overlay';
      overlay.className = 'ticket-modal-overlay';
      overlay.innerHTML =
        '<div class="ticket-modal-dialog">' +
          '<button type="button" class="ticket-modal-close" id="ticket-modal-close" aria-label="Close pass">&times;</button>' +
          '<div id="ticket-modal-content"></div>' +
          '<div class="ticket-actions-bar">' +
            '<button type="button" id="ticket-print-btn" class="ticket-btn ticket-btn-primary">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>' +
              'Print Entry Slip' +
            '</button>' +
            '<button type="button" id="ticket-download-btn" class="ticket-btn ticket-btn-secondary">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>' +
              'Download PNG' +
            '</button>' +
            '<button type="button" id="ticket-copy-btn" class="ticket-btn ticket-btn-secondary">' +
              '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
              'Copy ID' +
            '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      // Wire close handlers
      var closeBtn = overlay.querySelector('#ticket-modal-close');
      closeBtn.addEventListener('click', hideModal);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) hideModal();
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && overlay.classList.contains('is-active')) {
          hideModal();
        }
      });
    }
    return overlay;
  }

  var currentActiveRegId = '';

  function showModal(data, registrationId) {
    var overlay = ensureModalDOM();
    var contentEl = overlay.querySelector('#ticket-modal-content');
    currentActiveRegId = registrationId || data.registrationId || '';

    contentEl.innerHTML = generateTicketHTML(data, currentActiveRegId);
    overlay.classList.add('is-active');
    document.body.style.overflow = 'hidden';

    // Wire actions
    var printBtn = overlay.querySelector('#ticket-print-btn');
    var downloadBtn = overlay.querySelector('#ticket-download-btn');
    var copyBtn = overlay.querySelector('#ticket-copy-btn');

    printBtn.onclick = function () {
      window.print();
    };

    downloadBtn.onclick = function () {
      downloadTicketAsPNG(currentActiveRegId);
    };

    copyBtn.onclick = function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(currentActiveRegId);
        showToast('Registration ID copied: ' + currentActiveRegId);
      } else {
        showToast('ID: ' + currentActiveRegId);
      }
    };
  }

  function hideModal() {
    var overlay = document.getElementById('ticket-modal-overlay');
    if (overlay) {
      overlay.classList.remove('is-active');
      document.body.style.overflow = '';
    }
  }

  /* ---------- Global API ---------- */
  window.EigaversaTicket = {
    generateTicketHTML: generateTicketHTML,
    showModal: showModal,
    hideModal: hideModal,
    showSoloPass: function (data, registrationId) {
      data.type = 'solo';
      showModal(data, registrationId);
    },
    showGroupPass: function (data, registrationId) {
      data.type = 'group';
      showModal(data, registrationId);
    },
    renderPassToElement: function (element, data, registrationId) {
      if (!element) return;
      element.innerHTML = generateTicketHTML(data, registrationId);
    }
  };
})();
