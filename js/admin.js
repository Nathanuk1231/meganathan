import { db } from './config.js';
import { currentUser, isAdmin } from './auth.js';
import { toast, esc, sanitizeInput } from './utils.js';

let bannedUsers = {};

export function loadAdmin() {
  if (!isAdmin()) {
    toast('Admin only', 'err');
    if (window.app) window.app.showPage('home');
    return;
  }
  
  const el = document.getElementById('adminStats');
  Promise.all([
    db.ref('messages/general').once('value'),
    db.ref('messages/random').once('value'),
    db.ref('messages/gaming').once('value'),
    db.ref('messages/music-chat').once('value'),
    db.ref('profiles').once('value'),
    db.ref('online').once('value'),
    db.ref('customEmoji').once('value')
  ]).then(([g, r, gm, mc, prof, on, ce]) => {
    const msgs = g.numChildren() + r.numChildren() + gm.numChildren() + mc.numChildren();
    el.innerHTML = `
      <div class="admin-stat"><div style="font-size:1.8rem">💬</div><div><div class="admin-stat-num">${msgs}</div><div class="muted" style="font-size:0.75rem;">Messages</div></div></div>
      <div class="admin-stat"><div style="font-size:1.8rem">👥</div><div><div class="admin-stat-num">${prof.numChildren()}</div><div class="muted" style="font-size:0.75rem;">Members</div></div></div>
      <div class="admin-stat"><div style="font-size:1.8rem">🟢</div><div><div class="admin-stat-num">${on.numChildren()}</div><div class="muted" style="font-size:0.75rem;">Online now</div></div></div>
      <div class="admin-stat"><div style="font-size:1.8rem">✨</div><div><div class="admin-stat-num">${ce.numChildren()}</div><div class="muted" style="font-size:0.75rem;">Custom Emoji Users</div></div></div>
    `;
  }).catch(() => {
    document.getElementById('adminStats').innerHTML = '<p style="color:var(--danger);">Could not load stats — check Firebase rules.</p>';
  });

  db.ref('announcement').once('value').then(s => {
    document.getElementById('announcementInput').value = s.val() || '';
  }).catch(() => {});

  loadBans();
}

function loadBans() {
  const banEl = document.getElementById('adminBans');
  db.ref('banned').once('value').then(s => {
    bannedUsers = s.val() || {};
    banEl.innerHTML = '<h3 style="margin-bottom:10px;">🚫 Banned Users</h3>';
    if (!Object.keys(bannedUsers).length) {
      banEl.innerHTML += '<p class="muted" style="font-size:0.85rem;">No banned users.</p>';
    } else {
      Object.keys(bannedUsers).forEach(u => {
        const d = document.createElement('div');
        d.style = 'display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)';
        d.innerHTML = `<span>${esc(u)}</span><button class="btn btn-xs" onclick="admin.unban('${u}')">Unban</button>`;
        banEl.appendChild(d);
      });
    }
  }).catch(() => {});
}

export function postAnnouncement() {
  if (!isAdmin()) return;
  
  const text = sanitizeInput(document.getElementById('announcementInput').value, 200);
  db.ref('announcement').set(text || null).then(() => {
    toast(text ? 'Announcement posted ✓' : 'Announcement cleared');
    updateAnnouncementBar(text);
  }).catch(e => toast('Failed: ' + e.message, 'err'));
}

function updateAnnouncementBar(text) {
  const bar = document.getElementById('announcementBar');
  if (text) {
    bar.textContent = '📣 ' + text;
    bar.style.display = 'block';
  } else {
    bar.style.display = 'none';
  }
}

export function banUser(uid) {
  if (!isAdmin()) return;
  db.ref('banned/' + uid).set(true).then(() => {
    toast('User banned');
    loadBans();
  });
}

export function unban(u) {
  if (!isAdmin()) return;
  db.ref('banned/' + u).remove().then(() => {
    delete bannedUsers[u];
    toast(u + ' unbanned');
    loadBans();
  });
}

export function listenAnnouncements() {
  db.ref('announcement').on('value', s => updateAnnouncementBar(s.val() || ''));
}

window.admin = { loadAdmin, postAnnouncement, banUser, unban, listenAnnouncements };