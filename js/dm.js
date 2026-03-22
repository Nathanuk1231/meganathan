import { db } from './config.js';
import { currentUser, currentProfile } from './auth.js';
import { toast, esc, sanitizeInput, validateUID, ts } from './utils.js';

let currentDMUid = null;
let dmMsgListener = null;
let typingTimer;

function getDMKey(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export function loadDMs() {
  if (!currentUser) {
    document.getElementById('dmList').innerHTML = '<p class="muted" style="padding:8px;">Sign in to use DMs.</p>';
    return;
  }

  const list = document.getElementById('dmList');
  list.innerHTML = '<p class="muted" style="padding:8px;font-size:0.82rem;">Loading…</p>';

  db.ref('dmThreads/' + currentUser.uid).once('value').then(snap => {
    const threads = [];
    snap.forEach(c => threads.push({ uid: c.key, ...c.val() }));

    if (!threads.length) {
      list.innerHTML = '<p class="muted" style="padding:8px;font-size:0.82rem;">No conversations yet.</p>';
      return;
    }

    list.innerHTML = '';
    threads.forEach(t => {
      const div = document.createElement('div');
      div.className = 'ch-item';
      div.id = 'dm-' + t.uid;
      div.onclick = () => openDMWith(t.uid, t.name, t.photo);
      const avHTML = t.photo
        ? `<img style="width:24px;height:24px;border-radius:50%;object-fit:cover;" src="${esc(t.photo)}" onerror="this.textContent='👤'">`
        : `<span>👤</span>`;
      div.innerHTML = `${avHTML}<span class="u-name">${esc(t.name || 'User')}</span>`;
      list.appendChild(div);
    });
  }).catch(() => {
    list.innerHTML = '<p style="color:var(--danger);padding:8px;font-size:0.82rem;">Could not load.</p>';
  });
}

export function openNewDM() {
  if (!currentUser) { toast('Sign in first', 'err'); return; }

  const modal = document.getElementById('newDMModal');
  if (!modal) buildNewDMModal();
  document.getElementById('dmSearchInput').value = '';
  document.getElementById('dmSearchResults').innerHTML = '';
  document.getElementById('newDMModal').classList.add('open');
}

function buildNewDMModal() {
  const modals = document.getElementById('modals');
  const div = document.createElement('div');
  div.id = 'newDMModal';
  div.className = 'mb';
  div.onclick = e => { if (e.target === div) div.classList.remove('open'); };
  div.innerHTML = `
    <div class="modal" style="max-width:420px;">
      <h2>✉️ New Message</h2>
      <div style="display:flex;gap:8px;margin:14px 0 10px;">
        <input class="inp" id="dmSearchInput" placeholder="Search by name…" oninput="dm.searchUsers(this.value)"/>
      </div>
      <div id="dmSearchResults"></div>
      <div class="modal-foot">
        <button class="btn" onclick="document.getElementById('newDMModal').classList.remove('open')">Cancel</button>
      </div>
    </div>`;
  modals.appendChild(div);
}

export function searchUsers(q) {
  const el = document.getElementById('dmSearchResults');
  if (!q || q.length < 2) { el.innerHTML = ''; return; }

  db.ref('profiles').once('value').then(snap => {
    const results = [];
    snap.forEach(c => {
      const p = c.val();
      if (c.key !== currentUser.uid && (p.displayName || '').toLowerCase().includes(q.toLowerCase())) {
        results.push({ uid: c.key, ...p });
      }
    });

    if (!results.length) { el.innerHTML = '<p class="muted" style="font-size:0.82rem;">No users found.</p>'; return; }

    el.innerHTML = results.slice(0, 6).map(p => {
      const avHTML = p.photoURL
        ? `<img class="friend-av" src="${esc(p.photoURL)}" onerror="this.textContent='👤'">`
        : `<div class="friend-av">👤</div>`;
      return `<div class="friend-item" style="cursor:pointer;" onclick="dm.startDMWith('${p.uid}','${esc(p.displayName || 'User')}','${esc(p.photoURL || '')}')">
        ${avHTML}
        <div class="friend-name">${esc(p.displayName || 'User')}</div>
      </div>`;
    }).join('');
  });
}

export function startDMWith(uid, name, photo) {
  document.getElementById('newDMModal').classList.remove('open');
  openDMWith(uid, name, photo);
}

export function openDMWith(uid, name, photo) {
  if (!currentUser || !validateUID(uid)) return;

  currentDMUid = uid;

  document.querySelectorAll('#dmList .ch-item').forEach(el => el.classList.remove('active'));
  document.getElementById('dm-' + uid)?.classList.add('active');

  const area = document.getElementById('dmChatArea');
  const dmKey = getDMKey(currentUser.uid, uid);

  area.innerHTML = `
    <div class="chat-hd">
      <div style="display:flex;align-items:center;gap:8px;">
        ${photo ? `<img style="width:28px;height:28px;border-radius:50%;object-fit:cover;" src="${esc(photo)}">` : '<span>👤</span>'}
        <div>
          <div class="chat-title">${esc(name)}</div>
        </div>
      </div>
      <div style="margin-left:auto;display:flex;gap:6px;">
        <button class="btn btn-xs btn-p" onclick="calls.startDMCall('${uid}','${esc(name)}')">📞 Call</button>
      </div>
    </div>
    <div class="messages" id="dmChatBox"></div>
    <div class="typing-bar" id="dmTypingBar"></div>
    <div class="chat-inp-row">
      <div class="inp-wrap">
        <textarea id="dmMsgInput" placeholder="Message ${esc(name)}…" rows="1"
          oninput="chat.autoResize(this);dm.userTyping();" onkeydown="dm.msgKD(event)"></textarea>
      </div>
      <button class="btn btn-p" onclick="dm.sendDM()">Send</button>
    </div>`;

  if (dmMsgListener) {
    db.ref('dms/' + dmKey).off();
    dmMsgListener = null;
  }

  dmMsgListener = db.ref('dms/' + dmKey).limitToLast(80).on('child_added', snap => {
    appendDMMsg(snap.val(), snap.key);
  });

  db.ref('dms/' + dmKey).on('child_removed', snap => {
    document.getElementById('dmmsg-' + snap.key)?.remove();
  });

  db.ref('dmTyping/' + dmKey).on('value', snap => {
    const v = snap.val();
    const bar = document.getElementById('dmTypingBar');
    if (bar) bar.textContent = (v && v !== ((currentProfile?.displayName) || currentUser.displayName)) ? v + ' is typing…' : '';
  });

  const myName = (currentProfile?.displayName) || currentUser.displayName || 'User';
  const myPhoto = (currentProfile?.photoURL) || currentUser.photoURL || '';
  db.ref('dmThreads/' + currentUser.uid + '/' + uid).set({ name: sanitizeInput(name, 30), photo: photo || '', updatedAt: ts() });
  db.ref('dmThreads/' + uid + '/' + currentUser.uid).set({ name: sanitizeInput(myName, 30), photo: myPhoto, updatedAt: ts() });
}

function appendDMMsg(msg, key) {
  if (!msg) return;
  const box = document.getElementById('dmChatBox');
  if (!box) return;

  const isOwn = currentUser && msg.uid === currentUser.uid;
  const photo = msg.photoURL || '';
  const avHTML = photo
    ? `<img class="msg-av" src="${esc(photo)}" onerror="this.textContent='👤'">`
    : `<div class="msg-av">👤</div>`;

  const div = document.createElement('div');
  div.className = 'msg' + (isOwn ? ' own' : '');
  div.id = 'dmmsg-' + key;
  div.innerHTML = `${avHTML}<div class="msg-body">
    <div class="msg-meta">${esc(isOwn ? 'You' : msg.name || 'User')} · ${new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    <div class="msg-bubble">${msg.image ? `<img class="msg-img" src="${msg.image}" onclick="document.getElementById('lbImg').src=this.src;document.getElementById('lb').classList.add('open')">` : ''}${msg.text ? esc(msg.text) : ''}</div>
    ${isOwn ? `<span class="msg-del" onclick="dm.delDM('${key}')">🗑</span>` : ''}
  </div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

export function sendDM() {
  if (!currentUser || !currentDMUid) { toast('No conversation open', 'err'); return; }

  const inp = document.getElementById('dmMsgInput');
  const text = sanitizeInput(inp.value, 1000);
  if (!text) return;

  const dmKey = getDMKey(currentUser.uid, currentDMUid);
  const name = (currentProfile?.displayName) || currentUser.displayName || 'User';

  db.ref('dms/' + dmKey).push({
    uid: currentUser.uid,
    name: sanitizeInput(name, 30),
    photoURL: (currentProfile?.photoURL) || currentUser.photoURL || '',
    text,
    ts: ts()
  }).then(() => {
    if (window.notifications) {
      window.notifications.addNotif(currentDMUid, 'dm', `✉️ ${name} sent you a message`);
    }
  }).catch(e => toast('Failed: ' + e.message, 'err'));

  inp.value = '';
  inp.style.height = 'auto';
  db.ref('dmTyping/' + dmKey).remove();
}

export function delDM(key) {
  if (!currentUser || !currentDMUid) return;
  const dmKey = getDMKey(currentUser.uid, currentDMUid);
  db.ref('dms/' + dmKey + '/' + key).remove();
}

export function msgKD(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDM(); }
}

export function userTyping() {
  if (!currentUser || !currentDMUid) return;
  const dmKey = getDMKey(currentUser.uid, currentDMUid);
  const name = (currentProfile?.displayName) || currentUser.displayName || 'Guest';
  db.ref('dmTyping/' + dmKey).set(name);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => db.ref('dmTyping/' + dmKey).remove(), 1500);
}

window.dm = { loadDMs, openNewDM, searchUsers, startDMWith, openDMWith, sendDM, delDM, msgKD, userTyping };