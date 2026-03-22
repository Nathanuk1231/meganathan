import { db } from './config.js';
import { currentUser } from './auth.js';
import { toast, esc, timeAgo, validateUID } from './utils.js';

const state = { notifCount: 0 };
const COOLDOWNS = {};
const COOLDOWN_MS = 60000;

export function addNotif(toUid, type, text) {
  if (!validateUID(toUid)) return;

  const coolKey = toUid + '_' + type;
  const now = Date.now();
  if (COOLDOWNS[coolKey] && now - COOLDOWNS[coolKey] < COOLDOWN_MS) return;
  COOLDOWNS[coolKey] = now;

  db.ref('notifs/' + toUid).push({
    type,
    text,
    ts: now,
    read: false
  }).catch(() => {});
}

export function loadNotifCount(uid) {
  if (!validateUID(uid)) return;

  db.ref('notifs/' + uid).on('value', snap => {
    let unread = 0;
    snap.forEach(c => { if (c.val().read === false) unread++; });
    state.notifCount = unread;
    const btn = document.getElementById('notifNavBtn');
    if (btn) btn.setAttribute('data-count', unread || 0);
  });
}

export function loadNotifs() {
  const el = document.getElementById('notifList');
  if (!currentUser) {
    el.innerHTML = '<p class="muted">Sign in to see notifications.</p>';
    return;
  }

  el.innerHTML = '<p class="muted">Loading…</p>';

  db.ref('notifs/' + currentUser.uid).limitToLast(50).once('value').then(snap => {
    const items = [];
    snap.forEach(c => items.push({ key: c.key, ...c.val() }));
    items.reverse();

    if (!items.length) {
      el.innerHTML = '<p class="muted">No notifications yet.</p>';
      return;
    }

    const iconMap = { friend_request: '🤝', message: '💬', dm: '✉️', call: '📞' };

    const unread = items.filter(n => n.read === false);
    const read = items.filter(n => n.read !== false);

    let html = '<div class="notif-list">';

    if (unread.length) {
      html += `<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent);padding:4px 2px 8px;">New — ${unread.length}</div>`;
      html += unread.map(n => renderNotif(n, iconMap)).join('');
    }

    if (read.length) {
      html += `<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);padding:${unread.length ? '16px' : '4px'} 2px 8px;">Earlier</div>`;
      html += read.map(n => renderNotif(n, iconMap)).join('');
    }

    html += '</div>';
    el.innerHTML = html;

    unread.forEach(n => {
      db.ref('notifs/' + currentUser.uid + '/' + n.key).update({ read: true }).catch(() => {});
    });

    state.notifCount = 0;
    const btn = document.getElementById('notifNavBtn');
    if (btn) btn.setAttribute('data-count', 0);
  }).catch(() => {
    el.innerHTML = '<p style="color:var(--danger);">Could not load — check Firebase rules.</p>';
  });
}

function renderNotif(n, iconMap) {
  return `<div class="notif-item ${n.read === false ? 'unread' : ''}" onclick="notifications.markNotifRead('${n.key}',this)">
    <div class="notif-icon">${iconMap[n.type] || '🔔'}</div>
    <div class="notif-text">${esc(n.text)}</div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
      <div class="notif-time">${timeAgo(n.ts)}</div>
      <button class="btn btn-xs btn-d" style="opacity:0.6;" onclick="event.stopPropagation();notifications.deleteNotif('${n.key}',this.closest('.notif-item'))">✕</button>
    </div>
  </div>`;
}

export function markNotifRead(key, el) {
  if (!el.classList.contains('unread')) return;
  el.classList.remove('unread');
  if (!currentUser) return;
  db.ref('notifs/' + currentUser.uid + '/' + key).update({ read: true }).catch(() => {});
}

export function deleteNotif(key, el) {
  if (!currentUser) return;
  el?.remove();
  db.ref('notifs/' + currentUser.uid + '/' + key).remove().catch(() => {});
}

export function clearNotifs() {
  if (!currentUser) return;
  db.ref('notifs/' + currentUser.uid).remove().then(() => {
    loadNotifs();
    toast('Cleared ✓');
  });
}

Object.defineProperty(window, 'notifications', {
  get: () => ({
    addNotif,
    loadNotifCount,
    loadNotifs,
    markNotifRead,
    deleteNotif,
    clearNotifs,
    get notifCount() { return state.notifCount; }
  }),
  configurable: true
});