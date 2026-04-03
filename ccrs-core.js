/* ═══════════════════════════════════════════════════════════════
   CCRS Core — Storage, Auth, Utilities, Navigation
   ═══════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  /* ── Storage Keys ─────────────────────────────────────────── */
  const SK = {
    USERS:      'ccrs_users',
    REPORTS:    'ccrs_reports',
    AUTH_TOKEN: 'ccrs_auth_token',
    AUTH_TS:    'ccrs_auth_ts',
  };

  /* ── Helpers ──────────────────────────────────────────────── */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function hashPassword(p) {
    let h = 0;
    for (let i = 0; i < p.length; i++) { h = ((h << 5) - h) + p.charCodeAt(i); h |= 0; }
    return 'h_' + Math.abs(h).toString(36) + '_' + btoa(p.slice(0,3) || 'x').replace(/=/g,'');
  }
  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }
  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
  }
  function writeJSON(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.error('Storage write failed', e); }
  }

  /* ── Users CRUD ───────────────────────────────────────────── */
  function getUsers() { return readJSON(SK.USERS, []); }
  function _saveUsers(u) { writeJSON(SK.USERS, u); }

  function saveUser(data) {
    const users = getUsers();
    const norm = data.email.toLowerCase().trim();
    if (users.find(u => u.email.toLowerCase() === norm)) return null;
    const user = {
      id: uid(),
      firstName: (data.firstName || '').trim(),
      lastName: (data.lastName || '').trim(),
      email: norm,
      phone: data.phone || '',
      passwordHash: data.passwordHash || hashPassword(data.password || ''),
      role: data.role || 'resident',
      token: uid() + uid(),
      createdAt: Date.now(),
    };
    users.push(user);
    _saveUsers(users);
    return user;
  }

  function findUser(email) {
    return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  /* ── Reports CRUD ─────────────────────────────────────────── */
  function getReports() { return readJSON(SK.REPORTS, []); }
  function _saveReports(r) { writeJSON(SK.REPORTS, r); }

  function saveReport(data) {
    const user = getCurrentUser();
    const report = {
      id: uid(),
      category:    data.category || 'Other',
      location:    data.location || '',
      country:     data.country || 'Philippines',
      province:    data.province || '',
      city:        data.city || '',
      barangay:    data.barangay || '',
      latitude:    data.latitude || 12.8797,
      longitude:   data.longitude || 121.7740,
      description: data.description || '',
      photos:      data.photos || [],
      status:      'pending',
      timestamp:   Date.now(),
      userId:      user ? user.id : 'guest',
    };
    const reports = getReports();
    reports.unshift(report);
    _saveReports(reports);
    return report;
  }

  function updateReport(id, patch) {
    const reports = getReports();
    const idx = reports.findIndex(r => r.id === id);
    if (idx === -1) return null;
    reports[idx] = { ...reports[idx], ...patch };
    _saveReports(reports);
    return reports[idx];
  }

  function deleteReport(id) {
    const reports = getReports().filter(r => r.id !== id);
    _saveReports(reports);
  }

  function getUserStats() {
    const reports = getReports();
    const total = reports.length;
    const resolved = reports.filter(r => r.status === 'resolved').length;
    const inProgress = reports.filter(r => r.status === 'in-progress').length;
    const pending = reports.filter(r => r.status === 'pending').length;
    return { total, resolved, inProgress, pending, resolutionRate: total ? Math.round(resolved / total * 100) : 0 };
  }

  /* ── Auth ─────────────────────────────────────────────────── */
  const AUTH_MAX_AGE = 1000 * 60 * 60 * 24;

  function login(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return null;
    const hashed = hashPassword(password);
    const legacy = btoa(password);
    if (user.passwordHash === hashed || user.passwordHash === legacy) {
      if (user.passwordHash === legacy) { user.passwordHash = hashed; _saveUsers(users); }
      localStorage.setItem(SK.AUTH_TOKEN, user.token);
      localStorage.setItem(SK.AUTH_TS, Date.now().toString());
      return user;
    }
    return null;
  }

  function logout() {
    localStorage.removeItem(SK.AUTH_TOKEN);
    localStorage.removeItem(SK.AUTH_TS);
  }

  function getCurrentUser() {
    const token = localStorage.getItem(SK.AUTH_TOKEN);
    if (!token) return null;
    const ts = Number(localStorage.getItem(SK.AUTH_TS));
    if (ts && Date.now() - ts > AUTH_MAX_AGE) { logout(); return null; }
    return getUsers().find(u => u.token === token) || null;
  }

  function isAuthenticated() { return !!getCurrentUser(); }
  function isAdmin() { const u = getCurrentUser(); return !!(u && u.role === 'admin'); }

  /* ── Seed Data ────────────────────────────────────────────── */
  (function seed() {
    if (getUsers().length === 0) {
      saveUser({ email: 'admin@ccrs.ph', passwordHash: hashPassword('admin123'), role: 'admin' });
      saveUser({ email: 'user@ccrs.ph',  passwordHash: hashPassword('password'),  role: 'resident' });
      saveUser({ email: 'maria@ccrs.ph', passwordHash: hashPassword('password'),  role: 'resident' });
    }
    if (getReports().length === 0) {
      const demos = [
        { category:'Overflowing Bin',    location:'Barangay Hall, Main St.',      description:'Garbage bin overflowing for 3 days. Residents are complaining about the smell and flies.',          status:'resolved',    daysAgo:5 },
        { category:'Illegal Dumping',    location:'Rizal Park, North Entrance',   description:'Large mattress and broken furniture illegally dumped near the park entrance overnight.',             status:'in-progress', daysAgo:3 },
        { category:'Dirty Road',         location:'Mabini St. corner Rizal',      description:'Significant buildup of mud and debris on the road after the heavy rain. Causing minor flooding.',   status:'pending',     daysAgo:1 },
        { category:'Clogged Drainage',   location:'Phase 2, Block 7',             description:'Drainage canal is blocked by accumulated trash. Water is rising and threatening nearby homes.',      status:'pending',     daysAgo:0 },
        { category:'Overflowing Bin',    location:'Public Market, Gate 2',        description:'Bins near the market entrance are full and spilling onto the sidewalk. Creates health hazard.',      status:'resolved',    daysAgo:7 },
        { category:'Graffiti/Vandalism', location:'Covered Court Perimeter Wall', description:'The barangay covered court perimeter wall was vandalized with spray paint graffiti overnight.',      status:'in-progress', daysAgo:2 },
      ];
      const users   = getUsers();
      const admin   = users.find(u => u.role === 'admin');
      const resident = users.find(u => u.email === 'user@ccrs.ph');
      const seeded = demos.map((d, i) => ({
        id: 'demo' + (i + 1),
        category: d.category, location: d.location, description: d.description,
        photos: [], status: d.status,
        timestamp: Date.now() - d.daysAgo * 86400000 - Math.random() * 3600000,
        userId: i % 2 === 0 ? (resident?.id || 'r') : (admin?.id || 'a'),
      }));
      _saveReports(seeded);
    }
  })();

  /* ── Categories ───────────────────────────────────────────── */
  const CATEGORIES = [
    {
      id: 'overflowing-bin', name: 'Overflowing Bin',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`,
      desc: 'Full or overflowing garbage bins',
    },
    {
      id: 'dirty-road', name: 'Dirty Road',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l2-11h14l2 11"/><path d="M3 17h18"/><path d="M7 13h10"/><path d="M9 9h6"/></svg>`,
      desc: 'Mud, debris, or litter on roads',
    },
    {
      id: 'illegal-dumping', name: 'Illegal Dumping',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><line x1="3" y1="3" x2="21" y2="21"/></svg>`,
      desc: 'Furniture or waste dumped illegally',
    },
    {
      id: 'clogged-drainage', name: 'Clogged Drainage',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8c0 5 14 5 14 0"/><path d="M5 12c0 5 14 5 14 0"/><path d="M5 16c0 5 14 5 14 0"/></svg>`,
      desc: 'Blocked drains causing flooding',
    },
    {
      id: 'graffiti', name: 'Graffiti/Vandalism',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
      desc: 'Vandalism on public property',
    },
    {
      id: 'other', name: 'Other Issues',
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`,
      desc: 'Any other cleanliness concern',
    },
  ];

  /* ── Global Location Database (Comprehensive) ──────────────────────────────────────────────── */
  /* Structure: Country → Province/State → City/Municipality → Barangay/District with coordinates */
  const LOCATIONS = {
    'Philippines': {
      // ── NCRO (National Capital Region / Metro Manila) ──
      'Metro Manila': {
        'Manila': {
          'Binondo': { lat: 14.5994, lng: 120.9624 },
          'Intramuros': { lat: 14.5801, lng: 120.9789 },
          'Quiapo': { lat: 14.6058, lng: 120.9795 },
          'Santo Domingo': { lat: 14.6016, lng: 120.9862 },
          'Sampaloc': { lat: 14.6165, lng: 120.9948 },
          'Tondo': { lat: 14.6324, lng: 120.9633 },
        },
        'Quezon City': {
          'Barangay Fairview': { lat: 14.3814, lng: 121.0471 },
          'Barangay Commonwealth': { lat: 14.3431, lng: 121.0578 },
          'Barangay Tandang Sora': { lat: 14.3062, lng: 121.0697 },
          'Barangay Diliman': { lat: 14.1803, lng: 121.0643 },
          'Barangay Makiki': { lat: 14.1614, lng: 121.0825 },
          'Barangay Cubao': { lat: 14.1920, lng: 121.0523 },
        },
        'Las Piñas': {
          'Barangay Almanza Uno': { lat: 14.3545, lng: 120.9712 },
          'Barangay Zapote': { lat: 14.3628, lng: 120.9856 },
        },
        'Makati': {
          'Barangay Bel-Air': { lat: 14.5544, lng: 121.0238 },
          'Barangay Ayala': { lat: 14.5530, lng: 121.0283 },
          'Barangay San Antonio': { lat: 14.5580, lng: 121.0313 },
        },
        'Pasig': {
          'Barangay Greenmeadows': { lat: 14.5822, lng: 121.0884 },
          'Barangay Kaybiga': { lat: 14.5672, lng: 121.1045 },
          'Barangay Rosario': { lat: 14.5569, lng: 121.1168 },
        },
        'Taguig': {
          'Barangay Bagumbayan': { lat: 14.5210, lng: 121.0442 },
          'Barangay Bonifacio': { lat: 14.5328, lng: 121.0548 },
        },
      },
      // ── CALABARZON ──
      'Cavite': {
        'Kawit': {
          'Barangay Magdalo': { lat: 14.4408, lng: 120.8795 },
          'Barangay Putol': { lat: 14.4369, lng: 120.8761 },
        },
        'Bacoor': {
          'Barangay Salawag': { lat: 14.4149, lng: 120.8937 },
          'Barangay Zapote': { lat: 14.4236, lng: 120.9009 },
        },
        'Dasmariñas': {
          'Barangay Salawahan': { lat: 14.3088, lng: 120.8949 },
        },
      },
      'Laguna': {
        'Binangonan': {
          'Barangay Hinulugang Taktak': { lat: 14.3446, lng: 121.3048 },
          'Barangay Palayan': { lat: 14.3391, lng: 121.3128 },
        },
        'Santa Rosa': {
          'Barangay Balian': { lat: 14.3524, lng: 121.2020 },
        },
      },
      'Batangas': {
        'Batangas City': {
          'Barangay Bauan': { lat: 13.7537, lng: 121.1858 },
        },
      },
      'Quezon': {
        'Lucena': {
          'Barangay Halili': { lat: 14.0307, lng: 121.1385 },
        },
      },
      'Rizal': {
        'Antipolo': {
          'Barangay Mamuyod': { lat: 14.5867, lng: 121.1739 },
          'Barangay San Roque': { lat: 14.6135, lng: 121.1872 },
        },
      },
      // ── Visayas ──
      'Cebu': {
        'Cebu City': {
          'Barangay Apas': { lat: 10.3180, lng: 123.8854 },
          'Barangay Ayala': { lat: 10.3222, lng: 123.8916 },
          'Barangay Cogon': { lat: 10.3024, lng: 123.8856 },
        },
        'Lapu-Lapu': {
          'Barangay Asturias': { lat: 10.3195, lng: 123.9756 },
        },
      },
      'Negros Occidental': {
        'Bacolod': {
          'Barangay Alijis': { lat: 10.3945, lng: 123.0054 },
        },
      },
      'Iloilo': {
        'Iloilo City': {
          'Barangay Molo': { lat: 10.6934, lng: 122.5469 },
        },
      },
      // ── Mindanao ──
      'Davao del Sur': {
        'Davao City': {
          'Barangay Agdao': { lat: 7.1907, lng: 125.2788 },
          'Barangay Toril': { lat: 7.2269, lng: 125.2920 },
        },
      },
      'Misamis Oriental': {
        'Cagayan de Oro': {
          'Barangay Balanga': { lat: 8.4807, lng: 124.6467 },
        },
      },
      // ── Luzon (Other Regions) ──
      'Bulacan': {
        'Malolos': {
          'Barangay Del Pilar': { lat: 14.8357, lng: 120.7811 },
        },
      },
    },
    
    'United States': {
      'California': {
        'Los Angeles': {
          'Downtown': { lat: 34.0522, lng: -118.2437 },
          'Beverly Hills': { lat: 34.0901, lng: -118.4065 },
        },
        'San Francisco': {
          'Mission District': { lat: 37.7599, lng: -122.4148 },
        },
      },
      'New York': {
        'New York City': {
          'Manhattan': { lat: 40.7831, lng: -73.9712 },
          'Brooklyn': { lat: 40.6782, lng: -73.9442 },
        },
      },
      'Texas': {
        'Houston': {
          'Downtown': { lat: 29.7604, lng: -95.3698 },
        },
      },
    },

    'Canada': {
      'Ontario': {
        'Toronto': {
          'Downtown': { lat: 43.6629, lng: -79.3957 },
          'Midtown': { lat: 43.6896, lng: -79.4016 },
        },
        'Ottawa': {
          'Downtown': { lat: 45.4215, lng: -75.6972 },
        },
      },
      'British Columbia': {
        'Vancouver': {
          'Downtown': { lat: 49.2827, lng: -123.1207 },
        },
      },
    },

    'United Kingdom': {
      'England': {
        'London': {
          'Central': { lat: 51.5074, lng: -0.1278 },
          'West End': { lat: 51.5136, lng: -0.1404 },
        },
        'Manchester': {
          'City Centre': { lat: 53.4808, lng: -2.2426 },
        },
      },
    },

    'Australia': {
      'New South Wales': {
        'Sydney': {
          'Central Business District': { lat: -33.8688, lng: 151.2093 },
          'Parramatta': { lat: -33.8158, lng: 151.0018 },
        },
      },
      'Victoria': {
        'Melbourne': {
          'Central Business District': { lat: -37.8136, lng: 144.9631 },
        },
      },
    },

    'Japan': {
      'Tokyo': {
        'Tokyo': {
          'Chiyoda': { lat: 35.6762, lng: 139.7674 },
          'Shibuya': { lat: 35.6595, lng: 139.7004 },
        },
      },
      'Osaka': {
        'Osaka': {
          'Kita Ward': { lat: 34.6901, lng: 135.5023 },
        },
      },
    },

    'China': {
      'Beijing': {
        'Beijing': {
          'Chaoyang': { lat: 39.8633, lng: 116.4615 },
          'Dongcheng': { lat: 39.9042, lng: 116.4074 },
        },
      },
      'Shanghai': {
        'Shanghai': {
          'Pudong': { lat: 31.2304, lng: 121.5724 },
        },
      },
    },

    'India': {
      'Delhi': {
        'New Delhi': {
          'Central': { lat: 28.6139, lng: 77.2090 },
        },
      },
      'Maharashtra': {
        'Mumbai': {
          'Central': { lat: 19.0760, lng: 72.8777 },
        },
      },
    },

    'Singapore': {
      'Singapore': {
        'Singapore': {
          'Central Business District': { lat: 1.3521, lng: 103.8198 },
          'Jurong': { lat: 1.3488, lng: 103.7618 },
        },
      },
    },
  };

  /* ── Location Utilities ────────────────────────────────────── */
  function getCountries() {
    return Object.keys(LOCATIONS).sort();
  }

  function getProvinces(country) {
    return LOCATIONS[country] ? Object.keys(LOCATIONS[country]).sort() : [];
  }

  function getCities(country, province) {
    return LOCATIONS[country] && LOCATIONS[country][province] ? Object.keys(LOCATIONS[country][province]) : [];
  }

  function getBarangays(country, province, city) {
    if (LOCATIONS[country] && LOCATIONS[country][province] && LOCATIONS[country][province][city]) {
      return Object.keys(LOCATIONS[country][province][city]);
    }
    return [];
  }

  function getCoordinates(country, province, city, barangay) {
    if (LOCATIONS[country] && LOCATIONS[country][province] && LOCATIONS[country][province][city] && LOCATIONS[country][province][city][barangay]) {
      return LOCATIONS[country][province][city][barangay];
    }
    // Default fallback to center of Philippines
    return { lat: 12.8797, lng: 121.7740 };
  }

  /* ── Formatters ───────────────────────────────────────────── */
  function formatDate(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
    if (m < 2) return 'Just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 7) return `${d}d ago`;
    return new Date(ts).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateFull(ts) {
    return new Date(ts).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatStatus(status) {
    const map = {
      'pending':     { label: 'Pending',     cls: 'badge-pending',  icon: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>` },
      'in-progress': { label: 'In Progress', cls: 'badge-progress', icon: `<svg viewBox="0 0 24 24"><path d="m8 3 4 8 5-5 5 15H2L8 3Z"/></svg>` },
      'resolved':    { label: 'Resolved',    cls: 'badge-resolved', icon: `<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>` },
    };
    return map[status] || map['pending'];
  }

  /* ── Validation ───────────────────────────────────────────── */
  function validateReportForm(data) {
    const errors = [];
    if (!data.category) errors.push('Please select an issue category.');
    if (!data.location || data.location.length < 3) errors.push('Location must be at least 3 characters.');
    if (!data.description || data.description.length < 10) errors.push('Description must be at least 10 characters.');
    return errors;
  }

  /* ── Photo Preview ────────────────────────────────────────── */
  function createPhotoPreview(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { reject('Not an image'); return; }
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = () => reject('Read failed');
      r.readAsDataURL(file);
    });
  }

  /* ── Notifications ────────────────────────────────────────── */
  const NOTIF_ICONS = {
    success: `<svg class="notif-icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>`,
    error:   `<svg class="notif-icon" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>`,
    info:    `<svg class="notif-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  };

  function showNotification(message, type = 'success') {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.className = `notification notification-${type}`;
    el.innerHTML = (NOTIF_ICONS[type] || '') + `<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.parentNode && el.remove(), 4500);
  }

  /* ── Auth Guards ──────────────────────────────────────────── */
  function redirectIfNotAuth() {
    if (!isAuthenticated()) { window.location.href = 'login.html'; return true; }
    return false;
  }

  function initAuth() {
    const path = window.location.pathname;
    if (path.includes('admin-dashboard') && !isAdmin()) { window.location.href = 'login.html'; }
    if ((path.includes('report.html') || path.includes('resident-dashboard')) && !isAuthenticated()) { window.location.href = 'login.html'; }
  }

  /* ── Nav Auth Update ──────────────────────────────────────── */
  function updateNavAuth() {
    const user = getCurrentUser();
    const btns = document.querySelector('.nav-btns');
    const drawerBtns = document.querySelector('.drawer-auth');
    if (!btns) return;
    if (user) {
      if (user.role === 'admin') {
        btns.innerHTML = `
          <a href="admin-dashboard.html" class="btn-ghost">
            <svg class="nav-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Dashboard
          </a>
          <button onclick="window._ccrsLogout()" class="btn-solid">
            <svg class="nav-icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>`;
      } else {
        btns.innerHTML = `
          <a href="resident-dashboard.html" class="btn-ghost">
            <svg class="nav-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Dashboard
          </a>
          <button onclick="window._ccrsLogout()" class="btn-solid">
            <svg class="nav-icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </button>`;
      }
    }
    if (drawerBtns && user) {
      drawerBtns.innerHTML = user.role === 'admin'
        ? `<a href="admin-dashboard.html" class="drawer-link"><svg class="drawer-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Dashboard</a><button onclick="window._ccrsLogout()" class="drawer-link" style="border:none;background:none;width:100%;text-align:left;cursor:pointer;"><svg class="drawer-icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Logout</button>`
        : `<a href="resident-dashboard.html" class="drawer-link"><svg class="drawer-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>Dashboard</a><a href="report.html" class="drawer-link"><svg class="drawer-icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Report Issue</a><button onclick="window._ccrsLogout()" class="drawer-link" style="border:none;background:none;width:100%;text-align:left;cursor:pointer;"><svg class="drawer-icon" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Logout</button>`;
    }
  }

  global._ccrsLogout = function () {
    logout();
    showNotification('You have been logged out.', 'info');
    setTimeout(() => { window.location.href = 'index.html'; }, 800);
  };

  /* ── Drawer ───────────────────────────────────────────────── */
  global.openDrawer = function () {
    document.getElementById('mobileDrawer')?.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  global.closeDrawer = function () {
    document.getElementById('mobileDrawer')?.classList.remove('open');
    document.body.style.overflow = '';
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') global.closeDrawer(); });

  /* ── Counter Animation ────────────────────────────────────── */
  function animateCounter(el, target, duration = 1400, suffix = '') {
    if (!el) return;
    const start = Date.now();
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      el.textContent = Math.floor(easeOut(p) * target) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ── Scroll Reveal ────────────────────────────────────────── */
  function initReveal() {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        if (e.target.id === 'statsBar') {
          const stats = getUserStats();
          animateCounter(document.getElementById('s-total'),    stats.total);
          animateCounter(document.getElementById('s-resolved'), stats.resolved);
          animateCounter(document.getElementById('s-rate'),     stats.resolutionRate, 1400, '%');
          animateCounter(document.getElementById('s-pending'),  stats.pending);
        }
        e.target.classList.add('visible');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('.reveal, #statsBar').forEach(el => io.observe(el));
  }

  /* ── Active Nav ───────────────────────────────────────────── */
  function setActiveNav() {
    const cur = (window.location.pathname.split('/').pop() || 'index.html');
    const norm = h => (h || '').split('?')[0].split('#')[0] || 'index.html';
    document.querySelectorAll('.nav-link, .drawer-link').forEach(el => {
      el.classList.toggle('active', norm(el.getAttribute('href')) === cur);
    });
  }

  /* ── DOMContentLoaded Init ────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    updateNavAuth();
    setActiveNav();
    initReveal();
    setTimeout(() => document.getElementById('heroBg')?.classList.add('loaded'), 100);

    // Smooth anchor scrolls + close drawer
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', function (e) {
        const t = document.querySelector(this.getAttribute('href'));
        if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); global.closeDrawer(); }
      });
    });
  });

  // Scroll: sticky nav + parallax
  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 40);
    const bg = document.getElementById('heroBg');
    if (bg) bg.style.transform = `translateY(${window.scrollY * 0.28}px) scale(1.05)`;
  }, { passive: true });

  /* ── Reverse Geocoding (Coordinates to Address) ─────────────── */
  /**
   * Convert latitude/longitude to address using OpenStreetMap Nominatim API
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<string>} - Address string or empty if not found
   */
  async function reverseGeocode(lat, lng) {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'en' }
      });
      if (!response.ok) return '';
      const data = await response.json();
      if (!data.address) return '';
      
      // Build address from components
      const addr = data.address;
      const parts = [];
      if (addr.road) parts.push(addr.road);
      if (addr.village) parts.push(addr.village);
      else if (addr.town) parts.push(addr.town);
      else if (addr.city) parts.push(addr.city);
      if (addr.municipality && !parts.includes(addr.municipality)) parts.push(addr.municipality);
      if (addr.state && addr.state !== addr.municipality) parts.push(addr.state);
      if (addr.country) parts.push(addr.country);
      
      return parts.join(', ');
    } catch (e) {
      console.error('Reverse geocoding failed:', e);
      return '';
    }
  }

  /* ── Public API ───────────────────────────────────────────── */
  global.storage = { getReports, saveReport, updateReport, deleteReport, getUserStats, getUsers, saveUser, findUser, login, logout, getCurrentUser, isAuthenticated, isAdmin };
  global.CCRSUTILS = { CATEGORIES, LOCATIONS, getCountries, getProvinces, getCities, getBarangays, getCoordinates, formatDate, formatDateFull, formatStatus, validateReportForm, createPhotoPreview, showNotification, redirectIfNotAuth, escapeHtml, animateCounter, reverseGeocode };
  global.CCRSUPTILS = global.CCRSUTILS; // legacy alias

})(window);
