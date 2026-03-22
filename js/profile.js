import { db } from './config.js';
import { currentUser, currentProfile, updateCurrentProfile, updateNav } from './auth.js';
import { toast, esc, validateUID, timeAgo, ts, sanitizeInput } from './utils.js';

let pendingAvData = null;

export function renderProfile() {
  const div = document.getElementById('profileContent');
  if (!currentUser) {
    div.innerHTML = '<div class="card" style="text-align:center;padding:50px;"><p style="font-size:2rem;margin-bottom:12px;">👤</p><h2>Not signed in</h2><p class="muted" style="margin:10px 0 18px;">Sign in to view your profile</p><button class="btn btn-p" onclick="auth.doLogin()">Sign In with Google</button></div>';
    return;
  }

  div.innerHTML = '<div class="card" style="text-align:center;padding:30px;color:var(--muted);">Loading…</div>';

  db.ref('profiles/' + currentUser.uid).once('value').then(s => {
    const p = s.val() || {};

    const name = sanitizeInput(p.displayName || currentUser.displayName || 'User', 30);
    const bio = sanitizeInput(p.bio || 'No bio yet.', 100);
    const photo = p.photoURL || currentUser.photoURL || '';
    const avHTML = photo
      ? '<img class="profile-av" src="' + esc(photo) + '" onerror="this.outerHTML=\'<div class=&quot;profile-av&quot;>👤</div>\'" alt="">'
      : '<div class="profile-av">👤</div>';
    const streak = p.streak || 0;

    div.innerHTML =
      '<div class="profile-hd">' +
        '<div class="profile-av-wrap">' + avHTML + '<div class="edit-badge" onclick="profile.openEdit()">✏️</div></div>' +
        '<div style="flex:1;">' +
          '<h2>' + esc(name) + '</h2>' +
          '<p class="muted" style="font-size:0.85rem;margin-top:4px;">' + esc(bio) + '</p>' +
          '<p class="muted" style="font-size:0.72rem;margin-top:4px;">' + esc(currentUser.email) + '</p>' +
          '<div class="profile-stats">' +
            '<div class="p-stat"><div class="n" id="pmsgN">–</div><div class="l">Messages</div></div>' +
            '<div class="p-stat"><div class="n">' + timeAgo(p.joinedAt) + '</div><div class="l">Joined</div></div>' +
            '<div class="p-stat"><div class="n">' + streak + '</div><div class="l">Day Streak</div></div>' +
          '</div>' +
          (streak > 0 ? '<div class="streak-badge" style="margin-top:10px;">🔥 ' + streak + '-day streak! Keep it up!</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="card" style="margin-top:0;">' +
        '<h3 style="margin-bottom:10px;">🔴 Status</h3>' +
        '<div class="status-sel" id="statusSel">' +
          '<div class="status-opt ' + ((p.status || 'online') === 'online' ? 'active' : '') + '" onclick="profile.setStatus(\'online\')">🟢 Online</div>' +
          '<div class="status-opt ' + (p.status === 'away' ? 'active' : '') + '" onclick="profile.setStatus(\'away\')">🟡 Away</div>' +
          '<div class="status-opt ' + (p.status === 'busy' ? 'active' : '') + '" onclick="profile.setStatus(\'busy\')">🔴 Busy</div>' +
        '</div>' +
      '</div>';

    loadMessageCount();
  }).catch(e => {
    div.innerHTML = '<div class="card" style="padding:30px;text-align:center;"><p style="color:var(--danger);">⚠️ Could not load profile</p><p class="muted" style="font-size:0.82rem;margin-top:8px;">' + esc(e.message) + '</p></div>';
  });
}

function loadMessageCount() {
  let tot = 0, done = 0;
  ['general', 'random', 'gaming', 'music-chat'].forEach(ch => {
    db.ref('messages/' + ch).orderByChild('uid').equalTo(currentUser.uid).once('value').then(ss => {
      tot += ss.numChildren();
      done++;
      if (done === 4) {
        const el = document.getElementById('pmsgN');
        if (el) el.textContent = tot;
      }
    }).catch(() => { done++; });
  });
}

export function setStatus(s) {
  if (!currentUser) return;
  const validStatuses = ['online', 'away', 'busy'];
  if (!validStatuses.includes(s)) return;

  db.ref('profiles/' + currentUser.uid).update({ status: s, uid: currentUser.uid, email: currentUser.email, displayName: (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User' });
  db.ref('online/' + currentUser.uid).update({ status: s });

  document.querySelectorAll('.status-opt').forEach(el => el.classList.remove('active'));
  event.target.classList.add('active');
  toast('Status set to ' + s);
}

export function openEdit() {
  if (!currentUser) { toast('Sign in first', 'err'); return; }
  pendingAvData = null;

  db.ref('profiles/' + currentUser.uid).once('value').then(s => {
    const p = s.val() || {};
    const modal = document.getElementById('editModal');
    if (!modal) createEditModal();

    document.getElementById('editName').value = sanitizeInput(p.displayName || currentUser.displayName || '', 30);
    document.getElementById('editBio').value = sanitizeInput(p.bio || '', 100);
    document.getElementById('editAvUrl').value = '';
    updateEditAvPrev(p.photoURL || currentUser.photoURL || '');
    document.getElementById('editModal').classList.add('open');
  });
}

function createEditModal() {
  const modals = document.getElementById('modals');
  const div = document.createElement('div');
  div.id = 'editModal';
  div.className = 'mb';
  div.onclick = (e) => { if (e.target === div) closeEdit(); };
  div.innerHTML =
    '<div class="modal">' +
      '<h2>✏️ Edit Profile</h2>' +
      '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">' +
        '<div id="editAvPrev" style="width:60px;height:60px;border-radius:50%;background:var(--surface2);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:1.6rem;overflow:hidden;flex-shrink:0;">👤</div>' +
        '<div><p class="muted" style="font-size:0.78rem;margin-bottom:6px;">Upload photo or paste URL</p>' +
        '<label class="btn btn-sm" style="cursor:pointer;">📁 Upload<input type="file" id="editAvFile" accept="image/*" style="display:none;" onchange="profile.prevEditAv(this)"/></label></div>' +
      '</div>' +
      '<div class="form-row">' +
        '<input class="inp" id="editName" type="text" placeholder="Display name" maxlength="30"/>' +
        '<input class="inp" id="editBio" type="text" placeholder="Bio" maxlength="100"/>' +
        '<input class="inp" id="editAvUrl" type="text" placeholder="Or paste avatar URL…" oninput="profile.syncAvUrl(this.value)"/>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn" onclick="profile.closeEdit()">Cancel</button>' +
        '<button class="btn btn-p" id="saveProfileBtn" onclick="profile.saveProfile()">Save</button>' +
      '</div>' +
    '</div>';
  modals.appendChild(div);
}

export function closeEdit() {
  document.getElementById('editModal').classList.remove('open');
  pendingAvData = null;
}

function updateEditAvPrev(src) {
  const el = document.getElementById('editAvPrev');
  el.innerHTML = src
    ? '<img src="' + esc(src) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.parentElement.textContent=\'👤\'">'
    : '👤';
}

export function prevEditAv(inp) {
  const f = inp.files[0];
  if (!f) return;
  if (f.size > 1.2 * 1024 * 1024) { toast('Photo must be under 1.2MB', 'err'); inp.value = ''; return; }
  const r = new FileReader();
  r.onloadend = () => {
    pendingAvData = r.result;
    updateEditAvPrev(pendingAvData);
    document.getElementById('editAvUrl').value = '';
  };
  r.readAsDataURL(f);
}

export function syncAvUrl(v) {
  if (v) {
    pendingAvData = null;
    document.getElementById('editAvFile').value = '';
    updateEditAvPrev(v);
  }
}

export function saveProfile() {
  if (!currentUser) return;

  const name = sanitizeInput(document.getElementById('editName').value, 30) || currentUser.displayName || 'User';
  const bio = sanitizeInput(document.getElementById('editBio').value, 100);
  const urlV = document.getElementById('editAvUrl').value.trim();
  const finalAv = pendingAvData || urlV || null;

  const update = {
    displayName: name,
    bio,
    uid: currentUser.uid,
    email: currentUser.email
  };
  if (finalAv) update.photoURL = finalAv;

  const btn = document.getElementById('saveProfileBtn');
  btn.textContent = 'Saving…';
  btn.disabled = true;

  db.ref('profiles/' + currentUser.uid).update(update).then(() => {
    closeEdit();
    toast('Profile updated ✓');
    db.ref('profiles/' + currentUser.uid).once('value').then(s => {
      updateCurrentProfile(s.val() || {});
      updateNav(currentUser, s.val());
      renderProfile();
    });
  }).catch(e => toast('Save failed: ' + e.message, 'err'))
    .finally(() => { btn.textContent = 'Save'; btn.disabled = false; });
}

export function viewProfile(uid) {
  if (!validateUID(uid)) return;

  db.ref('profiles/' + uid).once('value').then(s => {
    const p = s.val() || {};
    const name = sanitizeInput(p.displayName || 'User', 30);
    const photo = p.photoURL || '';
    const avHTML = photo
      ? '<img class="pub-av" src="' + esc(photo) + '" onerror="this.outerHTML=\'<div class=&quot;pub-av&quot;>👤</div>\'" alt="">'
      : '<div class="pub-av">👤</div>';
    const statusDot = { 'online': '🟢', 'away': '🟡', 'busy': '🔴' }[p.status || 'online'] || '⚫';

    const modal = document.getElementById('pubModal');
    if (!modal) createPubModal();

    document.getElementById('pubProfileContent').innerHTML =
      '<div class="pub-profile">' + avHTML +
        '<div><h2>' + esc(name) + '</h2>' +
          '<p class="muted" style="font-size:0.82rem;margin-top:3px;">' + esc(p.bio || 'No bio.') + '</p>' +
          '<p style="font-size:0.8rem;margin-top:6px;">' + statusDot + ' ' + esc(p.status || 'online') + '</p>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        (currentUser && uid !== currentUser.uid
          ? '<button class="btn btn-p btn-sm" onclick="friends.addFriend(\'' + uid + '\',\'' + esc(name) + '\')">➕ Add Friend</button>' +
            '<button class="btn btn-sm" onclick="dm.openDMWith(\'' + uid + '\',\'' + esc(name) + '\',\'' + esc(photo) + '\');document.getElementById(\'pubModal\').classList.remove(\'open\')">✉️ DM</button>'
          : '') +
      '</div>';

    document.getElementById('pubModal').classList.add('open');
  });
}

function createPubModal() {
  const modals = document.getElementById('modals');
  const div = document.createElement('div');
  div.id = 'pubModal';
  div.className = 'mb';
  div.onclick = (e) => { if (e.target === div) div.classList.remove('open'); };
  div.innerHTML =
    '<div class="modal" style="max-width:480px;">' +
      '<div id="pubProfileContent"></div>' +
      '<div class="modal-foot"><button class="btn" onclick="document.getElementById(\'pubModal\').classList.remove(\'open\')">Close</button></div>' +
    '</div>';
  modals.appendChild(div);
}

export function checkStreak(uid) {
  if (!validateUID(uid)) return;
  db.ref('profiles/' + uid).once('value').then(s => {
    const p = s.val() || {};
    const now = new Date();
    const lastLogin = p.lastLogin ? new Date(p.lastLogin) : null;
    let streak = p.streak || 0;
    let updated = false;

    if (lastLogin) {
      const diffDays = Math.floor((now - lastLogin) / 86400000);
      if (diffDays === 1) { streak++; updated = true; }
      else if (diffDays > 1) { streak = 1; updated = true; }
    } else {
      streak = 1;
      updated = true;
    }

    if (updated) {
      db.ref('profiles/' + uid).update({ streak, lastLogin: ts(), uid, email: currentUser?.email || '' });
      if (streak >= 2) {
        const el = document.getElementById('streakBanner');
        if (el) {
          el.textContent = '🔥 ' + streak + '-day streak! You\'re on a roll!';
          el.style.display = 'block';
          setTimeout(() => el.style.display = 'none', 5000);
        }
      }
    }
  }).catch(() => {});
}

window.profile = { renderProfile, setStatus, openEdit, closeEdit, prevEditAv, syncAvUrl, saveProfile, viewProfile, checkStreak };