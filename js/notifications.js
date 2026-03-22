import { db } from './config.js';
import { currentUser } from './auth.js';
import { toast, esc, timeAgo, validateUID } from './utils.js';

export let notifCount = 0;

export function addNotif(toUid, type, text) {
  if (!validateUID(toUid)) return;
  db.ref('notifs/' + toUid).push({
    type,
    text,
    ts: Date.now(),
    read: false
  }).catch(() => {});
}

export function loadNotifCount(uid) {
  if (!validateUID(uid)) return;
  
  db.ref('notifs/' + uid).orderByChild('read').equalTo(false).on('value', s => {
    notifCount = s.numChildren();
    const btn = document.getElementById('notifNavBtn');
    if (btn) btn.setAttribute('data-count', notifCount || 0);
  });
}

export function loadNotifs() {
  const el = document.getElementById('notifList');
  if (!currentUser) {
    el.innerHTML = '<p class="muted">Sign in to see notifications.</p>';
    return;
  }
  
  el.innerHTML = '<p class="muted">Loading…</p>';
  
  db.ref('notifs/' + currentUser.uid).orderByChild('ts').limitToLast(30).once('value').then(s => {
    const items = [];
    s.forEach(c => items.push({ key: c.key, ...c.val() }));
    items.reverse();
    
    if (!items.length) {
      el.innerHTML = '<p class="muted">No notifications yet.</p>';
      return;
    }
    
    el.innerHTML = '<div class="notif-list">' + items.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="notifications.markNotifRead('${n.key}',this)">
        <div class="notif-icon">${n.type === 'friend_request' ? '🤝' : n.type === 'message' ? '💬' : '🔔'}</div>
        <div class="notif-text">${esc(n.text)}</div>
        <div class="notif-time">${timeAgo(n.ts)}</div>
      </div>`).join('') + '</div>';
    
    items.forEach(n => {
      if (!n.read) db.ref('notifs/' + currentUser.uid + '/' + n.key).update({ read: true }).catch(() => {});
    });
    
    notifCount = 0;
    const btn = document.getElementById('notifNavBtn');
    if (btn) btn.setAttribute('data-count', 0);
  }).catch(() => el.innerHTML = '<p style="color:var(--danger);">Could not load — check Firebase rules.</p>');
}

export function markNotifRead(key, el) {
  el.classList.remove('unread');
}

export function clearNotifs() {
  if (!currentUser) return;
  db.ref('notifs/' + currentUser.uid).remove().then(() => {
    loadNotifs();
    toast('Cleared ✓');
  });
}

window.notifications = { addNotif, loadNotifCount, loadNotifs, markNotifRead, clearNotifs, notifCount };