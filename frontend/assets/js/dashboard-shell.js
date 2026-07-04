/* ============================================================================
   Kibarua - shared dashboard shell.
   Injects a consistent sidebar + top bar into any dashboard page, wraps the
   page's existing content in <main class="dashboard-main">, highlights the
   active link, gates role-specific links, and wires logout + the mobile menu.

   Usage: include once, at the end of <body>:
     <script src="../assets/js/dashboard-shell.js"></script>
   The page keeps its own content + scripts; the shell only adds chrome.
   ========================================================================== */
(function () {
  var API_BASE = 'http://localhost:5050/api';

  function getToken() {
    return localStorage.getItem('token')
      || localStorage.getItem('jwt_token')
      || localStorage.getItem('authToken');
  }

  function decodePayload(t) {
    try { return JSON.parse(atob(t.split('.')[1])); } catch (e) { return {}; }
  }

  function logout() {
    ['token', 'jwt_token', 'authToken', 'user'].forEach(function (k) {
      localStorage.removeItem(k);
    });
    window.location.href = '../pages/auth/login.html';
  }
  window.kbLogout = logout;

  // Nav model - order matters. `role` limits an item to one audience.
  // The SAME list is rendered on every dashboard page (including dashboard.html)
  // so the menu never changes/reduces as the user navigates. Items whose href
  // contains a #hash open an in-page section on dashboard.html.
  var NAV = [
    { key: 'dashboard',        href: 'dashboard.html',                 icon: 'fa-gauge-high',       label: 'Dashboard' },
    // Worker
    { key: 'search',           href: 'search.html',                    icon: 'fa-magnifying-glass', label: 'Find Jobs',       role: 'worker' },
    { key: 'recommendations',  href: 'recommendations.html',           icon: 'fa-lightbulb',        label: 'Recommendations', role: 'worker' },
    { key: 'my-applications',  href: 'dashboard.html#my-applications',  icon: 'fa-file-lines',       label: 'My Applications', role: 'worker' },
    { key: 'worker-profile',   href: 'worker-profile.html',            icon: 'fa-user',             label: 'My Profile',      role: 'worker' },
    // Employer
    { key: 'post-job',         href: 'post-job.html',                  icon: 'fa-plus-circle',      label: 'Post a Job',      role: 'employer' },
    { key: 'job-applications', href: 'dashboard.html#job-applications', icon: 'fa-inbox',            label: 'Applications',    role: 'employer' },
    { key: 'employee-ratings', href: 'dashboard.html#employee-ratings', icon: 'fa-user-check',       label: 'Rate Workers',    role: 'employer' },
    { key: 'employer-profile', href: 'dashboard.html#employer-profile', icon: 'fa-building',         label: 'Business Profile', role: 'employer' },
    // Shared
    { key: 'messages',         href: 'messages.html',                  icon: 'fa-comments',         label: 'Messages' },
    { key: 'notifications',    href: 'notifications.html',              icon: 'fa-bell',             label: 'Notifications' },
    { key: 'payments',         href: 'payments.html',                  icon: 'fa-wallet',           label: 'Payments' },
    { key: 'reviews',          href: 'reviews.html',                   icon: 'fa-star',             label: 'Reviews' },
    { key: 'settings',         href: 'dashboard.html#settings',        icon: 'fa-cog',              label: 'Settings' }
  ];

  function currentKey() {
    var f = (location.pathname.split('/').pop() || 'dashboard.html').replace('.html', '');
    // On the hub, a #hash section is the active item.
    if ((f === 'dashboard' || f === '') && location.hash) return location.hash.slice(1);
    return f || 'dashboard';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function ensureFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) return;
    var fa = document.createElement('link');
    fa.rel = 'stylesheet';
    fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
    document.head.appendChild(fa);
  }

  function build() {
    var token = getToken();
    if (!token) { window.location.href = '../pages/auth/login.html'; return; }

    ensureFontAwesome();

    var role = decodePayload(token).role || null;
    var cur = currentKey();
    document.body.classList.add('dashboard-body');

    // Drop any legacy top nav so we don't render two bars.
    Array.prototype.forEach.call(document.querySelectorAll('body > nav.nav-bar'), function (n) {
      n.remove();
    });

    // Wrap existing body content into .dashboard-main (leave <script> in place).
    var main = document.querySelector('.dashboard-main');
    if (!main) {
      main = document.createElement('main');
      main.className = 'dashboard-main';
      var kids = Array.prototype.slice.call(document.body.childNodes);
      document.body.appendChild(main);
      kids.forEach(function (n) {
        if (n === main) return;
        if (n.nodeType === 1 && n.tagName === 'SCRIPT') return;
        main.appendChild(n);
      });
    }

    var items = NAV.filter(function (n) { return !n.role || !role || n.role === role; })
      .map(function (n) {
        return '<a class="sidebar-item' + (n.key === cur ? ' active' : '') + '" href="' + n.href + '">'
             + '<i class="fas ' + n.icon + '"></i> ' + n.label + '</a>';
      }).join('');

    var sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML =
      '<div class="sidebar-header">'
      + '<h3>Menu</h3>'
      + '<button class="close-sidebar" aria-label="Close menu"><i class="fas fa-times"></i></button>'
      + '</div>'
      + '<nav class="sidebar-nav">' + items + '</nav>'
      + '<div class="sidebar-footer">'
      + '<a class="sidebar-item logout-item" href="#"><i class="fas fa-right-from-bracket"></i> Logout</a>'
      + '</div>';

    var topbar = document.createElement('nav');
    topbar.className = 'nav-bar';
    topbar.innerHTML =
      '<div class="nav-left">'
      + '<button class="sidebar-toggle" aria-label="Open menu"><i class="fas fa-bars"></i></button>'
      + '<div class="logo"><h2>KIBARUA</h2></div>'
      + '</div>'
      + '<div class="nav-links">'
      + '<span id="kb-greeting"></span>'
      + '<a href="#" class="btn-primary" id="kb-logout-btn">Logout</a>'
      + '</div>';

    var overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';

    document.body.insertBefore(overlay, document.body.firstChild);
    document.body.insertBefore(topbar, document.body.firstChild);
    document.body.insertBefore(sidebar, document.body.firstChild);

    // Wiring
    function openMenu() { sidebar.classList.add('active'); overlay.classList.add('active'); }
    function closeMenu() { sidebar.classList.remove('active'); overlay.classList.remove('active'); }
    topbar.querySelector('.sidebar-toggle').addEventListener('click', openMenu);
    sidebar.querySelector('.close-sidebar').addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
    topbar.querySelector('#kb-logout-btn').addEventListener('click', function (e) { e.preventDefault(); logout(); });
    sidebar.querySelector('.logout-item').addEventListener('click', function (e) { e.preventDefault(); logout(); });

    // Greeting: prefer the cached user, fall back to /auth/me.
    var g = document.getElementById('kb-greeting');
    var stored = localStorage.getItem('user');
    if (stored) {
      try { g.textContent = 'Hi, ' + (JSON.parse(stored).full_name || 'there'); } catch (e) {}
    }
    if (!g.textContent) {
      fetch(API_BASE + '/auth/me?token=' + encodeURIComponent(token), {
        headers: { Authorization: 'Bearer ' + token }
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.success && d.data && d.data.user) {
          g.textContent = 'Hi, ' + (d.data.user.full_name || 'there');
          try { localStorage.setItem('user', JSON.stringify(d.data.user)); } catch (e) {}
        }
      }).catch(function () {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
