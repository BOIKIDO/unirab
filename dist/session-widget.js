// Site-wide profile widget for logged-in clients. The portal API's
// ?action=session validates the cookie token and returns a refreshed 30-day
// token plus profile data; this script renders the top-right widget with the
// profile / cheat sheet / upgrade / logout menu on any page that includes it.
(function () {
  'use strict';
  var COOKIE = 'unirab_session';
  var MAX_AGE = 60 * 60 * 24 * 30;

  function readCookie() {
    var row = document.cookie.split('; ').find(function (c) { return c.indexOf(COOKIE + '=') === 0; });
    return row ? decodeURIComponent(row.slice(COOKIE.length + 1)) : null;
  }
  function saveCookie(value) {
    document.cookie = COOKIE + '=' + encodeURIComponent(value) + '; path=/; max-age=' + MAX_AGE + '; SameSite=Lax';
  }
  function clearCookie() {
    document.cookie = COOKIE + '=; path=/; max-age=0; SameSite=Lax';
  }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Minimal line icons (Feather-style strokes, same clean look as flaticon
  // navbar packs) inlined so no external requests are needed.
  function icon(name) {
    var paths = {
      user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
      up: '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
      out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'
    };
    return '<svg class="unirab-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '') + '</svg>';
  }

  // First visit after a magic-link login has no cookie yet: bootstrap the
  // session from the ?t= token on the portal page, then keep it in the cookie.
  var token = readCookie() || (location.pathname === '/portal' ? new URLSearchParams(location.search).get('t') : null);
  if (!token) return;

  fetch('/api/portal?action=session&t=' + encodeURIComponent(token))
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('session invalid')); })
    .then(render)
    .catch(function () { clearCookie(); });

  function render(data) {
    saveCookie(data.token);
    var displayName = String(data.name || data.email || '').trim();
    var t = encodeURIComponent(data.token);

    var style = document.createElement('style');
    style.textContent = [
      '.unirab-user{position:relative;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
      '.unirab-user-btn{display:inline-flex;align-items:center;gap:9px;border:1.5px solid #dfe8e4;background:#fff;border-radius:999px;padding:4px 12px 4px 4px;cursor:pointer;font:inherit}',
      '.unirab-user-btn:hover{border-color:#073c38}',
      '.unirab-user-avatar{width:34px;height:34px;border-radius:50%;background:#073c38;color:#fff;display:grid;place-items:center;font-weight:800;font-size:15px;flex:none}',
      '.unirab-user-name{font-weight:800;font-size:13.5px;color:#102a2a;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.unirab-user-caret{color:#637170;flex:none;transition:transform .15s}',
      '.unirab-user-btn[aria-expanded="true"] .unirab-user-caret{transform:rotate(180deg)}',
      '.unirab-user-menu{position:absolute;right:0;top:calc(100% + 10px);min-width:232px;background:#fff;border:1px solid #dfe8e4;border-radius:12px;box-shadow:0 18px 44px rgba(7,60,56,.14);padding:6px;z-index:300}',
      '.unirab-user-head{font-size:12px;color:#637170;font-weight:700;padding:8px 12px 7px;border-bottom:1px solid #eef3f1;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.unirab-user-menu a,.unirab-user-logout{display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border-radius:8px;font-size:13.5px;font-weight:700;color:#102a2a;text-decoration:none;background:none;border:0;cursor:pointer;font-family:inherit;text-align:left}',
      '.unirab-ic{width:16px;height:16px;flex:none}',
      '.unirab-user-menu a:hover,.unirab-user-logout:hover{background:#eaf7f2}',
      '.unirab-user-sep{height:1px;background:#eef3f1;margin:4px 6px}',
      '.unirab-user-logout{color:#b3352a}',
      '.unirab-user-fixed{position:fixed;top:14px;right:16px;z-index:300}',
      '.unirab-user-in-header{justify-self:end}',
      '@media(max-width:760px){',
      '.unirab-user-name,.unirab-user-caret{display:none}',
      '.unirab-user-btn{padding:3px;border:0}',
      '.unirab-user-avatar{width:40px;height:40px}',
      '}'
    ].join('');
    document.head.appendChild(style);

    var widget = document.createElement('div');
    widget.className = 'unirab-user';
    widget.innerHTML =
      '<button type="button" class="unirab-user-btn" aria-haspopup="menu" aria-expanded="false">' +
        '<span class="unirab-user-avatar" aria-hidden="true">' + esc(displayName.charAt(0).toUpperCase() || 'U') + '</span>' +
        '<span class="unirab-user-name">' + esc(displayName) + '</span>' +
        '<svg class="unirab-user-caret" viewBox="0 0 12 8" width="11" height="8" aria-hidden="true"><path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button>' +
      '<div class="unirab-user-menu" role="menu" hidden>' +
        '<div class="unirab-user-head">' + esc(data.email) + '</div>' +
        '<a role="menuitem" href="/portal?t=' + t + '">' + icon('user') + ' My profile</a>' +
        (data.hasActiveSubscription
          ? '<a role="menuitem" href="/api/portal?action=cheat-sheet&t=' + t + '">' + icon('file') + ' AI Cheat Sheet</a>'
          : '') +
        '<a role="menuitem" href="/portal?t=' + t + '#upgrade">' + icon('up') + ' Upgrade subscription</a>' +
        '<div class="unirab-user-sep" role="separator"></div>' +
        '<button type="button" role="menuitem" class="unirab-user-logout">' + icon('out') + ' Log out</button>' +
      '</div>';
    mount(widget);

    var btn = widget.querySelector('.unirab-user-btn');
    var menu = widget.querySelector('.unirab-user-menu');
    function close() { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      btn.setAttribute('aria-expanded', String(!menu.hidden));
    });
    document.addEventListener('click', function (e) { if (!widget.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    widget.querySelector('.unirab-user-logout').addEventListener('click', function () {
      clearCookie();
      window.location.href = '/';
    });

    // The widget replaces the header's log-in affordances while signed in
    // (and the START NOW CTA on the home header, so the widget sits last).
    document.querySelectorAll('.product-nav a[href="/login"], .nav a[href="/login"], .header-actions a[href="/login"], .header-right a[href="/login"], .header-actions .header-cta')
      .forEach(function (a) { a.style.display = 'none'; });
  }

  function mount(widget) {
    var actions = document.querySelector('.header-actions');
    if (actions) { actions.insertBefore(widget, actions.firstChild); return; }
    var header = document.querySelector('.product-header') || document.querySelector('.site-header');
    var right = header ? header.querySelector('.header-right') : null;
    if (right) { right.appendChild(widget); return; }
    if (header) {
      widget.classList.add('unirab-user-in-header');
      header.appendChild(widget);
      return;
    }
    widget.classList.add('unirab-user-fixed');
    document.body.appendChild(widget);
  }
})();
