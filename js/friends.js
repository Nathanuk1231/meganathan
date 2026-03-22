import { db } from './config.js';
import { currentUser, currentProfile } from './auth.js';
import { toast, esc, validateUID, sanitizeInput, ts } from './utils.js';

export function loadFriends() {
  if (!currentUser) {
    document.getElementById('friendsList').innerHTML = '<p class="muted">Sign in to manage friends.</p>';
    return;
  }
  
  Promise.all([
    db.ref('friends/' + currentUser.uid).once('value'),
    db.ref('online').once('value')
  ]).then(([fs, onSnap]) => {
    const el = document.getElementById('friendsList');
    const val = fs.val() || {};
    const online = onSnap.val() || {};
    const entries = Object.entries(val);
    
    if (!entries.length) {
      el.innerHTML = '<p class="muted">No friends yet — search above to add some!</p>';
      return;
    }
    
    el.innerHTML = entries.map(([uid, info]) => {
      const liveStatus = (online[uid] && online[uid].status) || null;
      const status = liveStatus || (online[uid] ? 'online' : 'offline');
      const dotClass = { 'online': 'online-dot', 'away': 'away-dot', 'busy': 'busy-dot', 'offline': 'offline-dot' }[status] || 'offline-dot';
      const avHTML = info.photo 
        ? `<img class="friend-av" src="${esc(info.photo)}" onerror="this.textContent='👤'">`
        : `<div class="friend-av">👤</div>`;
      return `<div class="friend-item">
        ${avHTML}
        <div style="cursor:pointer;flex:1;" onclick="profile.viewProfile('${uid}')">
          <div class="friend-name">${esc(info.name || 'User')}</div>
          <div class="friend-status"><span class="${dotClass}" style="display:inline-block;margin-right:4px;"></span>${status}</div>
        </div>
        <button class="btn btn-xs btn-d" onclick="friends.removeFriend('${uid}')">Remove</button>
      </div>`;
    }).join('');
  }).catch(() => {
    document.getElementById('friendsList').innerHTML = '<p style="color:var(--danger);">Could not load — check Firebase rules.</p>';
  });
}

export function searchFriends() {
  const q = sanitizeInput(document.getElementById('friendSearch').value, 50).toLowerCase();
  if (!q) return;
  
  const el = document.getElementById('friendSearchResults');
  el.innerHTML = '<p class="muted">Searching…</p>';
  
  db.ref('profiles').once('value').then(s => {
    const results = [];
    s.forEach(c => {
      const p = c.val();
      const uid = c.key;
      if (uid === currentUser?.uid) return;
      if ((p.displayName || '').toLowerCase().includes(q)) results.push({ uid, ...p });
    });
    
    if (!results.length) {
      el.innerHTML = '<p class="muted">No users found.</p>';
      return;
    }
    
    el.innerHTML = results.slice(0, 8).map(p => {
      const avHTML = p.photoURL 
        ? `<img class="friend-av" src="${esc(p.photoURL)}" onerror="this.textContent='👤'">`
        : `<div class="friend-av">👤</div>`;
      return `<div class="friend-item">
        ${avHTML}
        <div style="flex:1;cursor:pointer;" onclick="profile.viewProfile('${p.uid}')">
          <div class="friend-name">${esc(p.displayName || 'User')}</div>
          <div class="friend-status">${esc(p.bio || '')}</div>
        </div>
        ${currentUser ? `<button class="btn btn-p btn-xs" onclick="friends.addFriend('${p.uid}','${esc(p.displayName || 'User')}')">+ Add</button>` : ''}
      </div>`;
    }).join('');
  }).catch(() => el.innerHTML = '<p style="color:var(--danger);">Search failed.</p>');
}

export function addFriend(uid, name) {
  if (!currentUser) {
    toast('Sign in first', 'err');
    return;
  }
  
  if (!validateUID(uid)) return;
  
  db.ref('profiles/' + uid).once('value').then(s => {
    const p = s.val() || {};
    db.ref('friends/' + currentUser.uid + '/' + uid).set({
      name: sanitizeInput(p.displayName || name, 30),
      photo: p.photoURL || '',
      status: p.status || 'online',
      addedAt: ts()
    }).then(() => toast('Added ' + name + ' as friend ✓'))
      .catch(e => toast('Failed: ' + e.message, 'err'));
  });
  
  if (window.notifications) {
    const myName = (currentProfile && currentProfile.displayName) || currentUser.displayName || 'Someone';
    window.notifications.addNotif(uid, 'friend_request', '🤝 ' + myName + ' added you as a friend!');
  }
}

export function removeFriend(uid) {
  if (!currentUser) return;
  db.ref('friends/' + currentUser.uid + '/' + uid).remove().then(() => {
    toast('Friend removed');
    loadFriends();
  }).catch(() => {});
}

window.friends = { loadFriends, searchFriends, addFriend, removeFriend };