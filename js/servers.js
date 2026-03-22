import { db } from './config.js';
import { currentUser, currentProfile } from './auth.js';
import { toast, esc, sanitizeInput, validateUID, ts } from './utils.js';

let currentServerId = null;
let currentServerCh = null;
let serverMsgListeners = {};
let isServerOwner = false;
let typingTimer;

export function loadServers() {
  if (!currentUser) {
    document.getElementById('myServersList').innerHTML = '<p class="muted">Sign in to see your servers.</p>';
    document.getElementById('publicServersList').innerHTML = '';
    return;
  }

  loadMyServers();
  loadPublicServers();
}

function loadMyServers() {
  const el = document.getElementById('myServersList');
  el.innerHTML = '<p class="muted" style="font-size:0.85rem;">Loading…</p>';

  db.ref('serverMembers').once('value').then(snap => {
    const myServerIds = [];
    snap.forEach(serverSnap => {
      if (serverSnap.child(currentUser.uid).exists()) {
        myServerIds.push(serverSnap.key);
      }
    });

    if (!myServerIds.length) {
      el.innerHTML = '<p class="muted">You haven\'t joined any servers yet.</p>';
      return;
    }

    el.innerHTML = '<h2 style="margin-bottom:12px;">Your Servers</h2>';
    const grid = document.createElement('div');
    grid.className = 'games-grid';
    el.appendChild(grid);

    myServerIds.forEach(sid => {
      db.ref('servers/' + sid).once('value').then(s => {
        const srv = s.val();
        if (!srv) return;
        const card = document.createElement('div');
        card.className = 'game-card';
        card.onclick = () => openServer(sid);
        card.innerHTML = `
          <div class="game-thumb" style="font-size:2.4rem;">${esc(srv.icon || '🌐')}</div>
          <div class="game-info">
            <h3>${esc(srv.name)}</h3>
            <p>${esc(srv.description || 'No description')}</p>
            <button class="btn btn-p btn-sm">Open</button>
          </div>`;
        grid.appendChild(card);
      });
    });
  }).catch(() => {
    el.innerHTML = '<p style="color:var(--danger);">Could not load servers.</p>';
  });
}

function loadPublicServers() {
  const el = document.getElementById('publicServersList');
  el.innerHTML = '<p class="muted" style="font-size:0.85rem;">Loading…</p>';

  db.ref('servers').orderByChild('public').equalTo(true).limitToFirst(20).once('value').then(snap => {
    const servers = [];
    snap.forEach(s => servers.push({ id: s.key, ...s.val() }));

    if (!servers.length) {
      el.innerHTML = '<p class="muted">No public servers yet — be the first to create one!</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'games-grid';
    servers.forEach(srv => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.onclick = () => joinAndOpenServer(srv.id);
      card.innerHTML = `
        <div class="game-thumb" style="font-size:2.4rem;">${esc(srv.icon || '🌐')}</div>
        <div class="game-info">
          <h3>${esc(srv.name)}</h3>
          <p>${esc(srv.description || 'No description')}</p>
          <p style="font-size:0.7rem;margin-top:4px;color:var(--muted);">Invite: <strong>${esc(srv.inviteCode || '')}</strong></p>
          <button class="btn btn-p btn-sm" onclick="event.stopPropagation();servers.joinAndOpenServer('${srv.id}')">Join</button>
        </div>`;
      grid.appendChild(card);
    });
    el.innerHTML = '';
    el.appendChild(grid);
  }).catch(() => {
    el.innerHTML = '<p style="color:var(--danger);">Could not load public servers.</p>';
  });
}

export function openCreateServer() {
  if (!currentUser) { toast('Sign in first', 'err'); return; }

  const modal = document.getElementById('createServerModal');
  if (!modal) buildCreateServerModal();
  document.getElementById('createServerModal').classList.add('open');
}

function buildCreateServerModal() {
  const modals = document.getElementById('modals');
  const div = document.createElement('div');
  div.id = 'createServerModal';
  div.className = 'mb';
  div.onclick = e => { if (e.target === div) div.classList.remove('open'); };
  div.innerHTML = `
    <div class="modal" style="max-width:440px;">
      <h2>🌐 Create Server</h2>
      <div class="form-row" style="margin-top:14px;">
        <input class="inp" id="newServerName" placeholder="Server name…" maxlength="40"/>
        <input class="inp" id="newServerDesc" placeholder="Description (optional)…" maxlength="100"/>
        <input class="inp" id="newServerIcon" placeholder="Icon emoji (e.g. 🎮)…" maxlength="4"/>
        <label style="display:flex;align-items:center;gap:8px;font-size:0.88rem;cursor:pointer;">
          <input type="checkbox" id="newServerPublic" checked/>
          <span>Public server (visible to all)</span>
        </label>
      </div>
      <div class="modal-foot">
        <button class="btn" onclick="document.getElementById('createServerModal').classList.remove('open')">Cancel</button>
        <button class="btn btn-p" onclick="servers.createServer()">Create</button>
      </div>
    </div>`;
  modals.appendChild(div);
}

export function createServer() {
  if (!currentUser) return;

  const name = sanitizeInput(document.getElementById('newServerName').value, 40);
  const desc = sanitizeInput(document.getElementById('newServerDesc').value, 100);
  const icon = sanitizeInput(document.getElementById('newServerIcon').value, 4) || '🌐';
  const isPublic = document.getElementById('newServerPublic').checked;

  if (!name) { toast('Server name required', 'err'); return; }

  const inviteCode = Math.random().toString(36).substr(2, 8).toUpperCase();
  const serverId = db.ref('servers').push().key;

  const serverData = {
    name,
    description: desc,
    icon,
    public: isPublic,
    inviteCode,
    ownerId: currentUser.uid,
    ownerName: (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User',
    createdAt: ts()
  };

  const updates = {};
  updates[`servers/${serverId}`] = serverData;
  updates[`serverChannels/${serverId}/general`] = { name: 'general', icon: '📢', createdAt: ts() };
  updates[`serverChannels/${serverId}/off-topic`] = { name: 'off-topic', icon: '🎲', createdAt: ts() };
  updates[`serverMembers/${serverId}/${currentUser.uid}`] = {
    role: 'owner',
    joinedAt: ts(),
    name: (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User',
    photo: (currentProfile && currentProfile.photoURL) || ''
  };

  db.ref().update(updates).then(() => {
    document.getElementById('createServerModal').classList.remove('open');
    toast('Server created! Invite code: ' + inviteCode);
    loadServers();
    openServer(serverId);
  }).catch(e => toast('Failed: ' + e.message, 'err'));
}

export function openJoinServer() {
  if (!currentUser) { toast('Sign in first', 'err'); return; }

  const code = prompt('Enter invite code:');
  if (!code) return;

  db.ref('servers').orderByChild('inviteCode').equalTo(code.trim().toUpperCase()).once('value').then(snap => {
    if (!snap.exists()) { toast('Invalid invite code', 'err'); return; }
    const entry = Object.entries(snap.val())[0];
    joinAndOpenServer(entry[0]);
  });
}

export function joinAndOpenServer(serverId) {
  if (!currentUser) { toast('Sign in first', 'err'); return; }

  db.ref(`serverMembers/${serverId}/${currentUser.uid}`).set({
    role: 'member',
    joinedAt: ts(),
    name: (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User',
    photo: (currentProfile && currentProfile.photoURL) || ''
  }).then(() => openServer(serverId));
}

export function openServer(serverId) {
  currentServerId = serverId;
  currentServerCh = null;

  db.ref('servers/' + serverId).once('value').then(s => {
    const srv = s.val();
    if (!srv) { toast('Server not found', 'err'); return; }

    isServerOwner = srv.ownerId === currentUser?.uid;

    document.getElementById('serverViewName').textContent = srv.name;
    document.getElementById('addChBtn').style.display = isServerOwner ? 'inline-flex' : 'none';
    document.getElementById('serverSettingsBtn').style.display = isServerOwner ? 'block' : 'none';

    window.app.showPage('server-view');
    loadServerChannels(serverId);
    loadServerMembers(serverId);
  });
}

function loadServerChannels(serverId) {
  const list = document.getElementById('serverChList');
  list.innerHTML = '';

  db.ref('serverChannels/' + serverId).once('value').then(snap => {
    const channels = [];
    snap.forEach(c => channels.push({ id: c.key, ...c.val() }));

    channels.forEach(ch => {
      const div = document.createElement('div');
      div.className = 'ch-item';
      div.id = 'sch-' + ch.id;
      div.onclick = () => switchServerCh(ch.id, ch.name, ch.icon || '#');
      div.innerHTML = `<span>${esc(ch.icon || '#')}</span> ${esc(ch.name)}`;
      list.appendChild(div);
    });

    if (channels.length) switchServerCh(channels[0].id, channels[0].name, channels[0].icon || '#');
  });
}

function loadServerMembers(serverId) {
  const list = document.getElementById('serverMemberList');
  const countEl = document.getElementById('serverMemberCount');

  db.ref('serverMembers/' + serverId).once('value').then(snap => {
    const members = [];
    snap.forEach(m => members.push({ uid: m.key, ...m.val() }));
    if (countEl) countEl.textContent = members.length;
    list.innerHTML = '';

    members.forEach(m => {
      const div = document.createElement('div');
      div.className = 'u-item';
      div.onclick = () => window.profile.viewProfile(m.uid);
      const roleIcon = m.role === 'owner' ? '👑' : m.role === 'mod' ? '🛡️' : '';
      div.innerHTML = `<span class="online-dot"></span><span class="u-name">${roleIcon ? roleIcon + ' ' : ''}${esc(m.name || 'User')}</span>`;
      list.appendChild(div);
    });
  });
}

function switchServerCh(chId, chName, chIcon) {
  currentServerCh = chId;

  document.querySelectorAll('#serverChList .ch-item').forEach(el => el.classList.remove('active'));
  document.getElementById('sch-' + chId)?.classList.add('active');
  document.getElementById('serverChTitle').textContent = '# ' + chName;
  document.getElementById('serverChIcon').textContent = chIcon;
  document.getElementById('serverMsgInput').placeholder = 'Message #' + chName + '…';

  const box = document.getElementById('serverChatBox');
  box.innerHTML = '';

  const path = `serverMessages/${currentServerId}/${chId}`;

  Object.values(serverMsgListeners).forEach(off => off && off());
  serverMsgListeners = {};

  const ref = db.ref(path).limitToLast(60);
  serverMsgListeners[chId] = ref.on('child_added', snap => {
    appendServerMsg(snap.val(), snap.key);
  });

  db.ref(path).on('child_removed', snap => {
    document.getElementById('smsg-' + snap.key)?.remove();
  });

  db.ref(`serverTyping/${currentServerId}/${chId}`).on('value', snap => {
    const bar = document.getElementById('serverTypingBar');
    const v = snap.val();
    if (bar) bar.textContent = (v && currentUser && v !== ((currentProfile?.displayName) || currentUser.displayName)) ? v + ' is typing…' : '';
  });
}

async function appendServerMsg(msg, key) {
  if (!msg) return;
  const box = document.getElementById('serverChatBox');
  if (!box) return;

  const isOwn = currentUser && msg.uid === currentUser.uid;
  const photo = msg.photoURL || '';
  const avHTML = photo
    ? `<img class="msg-av" src="${esc(photo)}" onerror="this.textContent='👤'">`
    : `<div class="msg-av">👤</div>`;

  const div = document.createElement('div');
  div.className = 'msg' + (isOwn ? ' own' : '');
  div.id = 'smsg-' + key;
  div.innerHTML = `${avHTML}<div class="msg-body">
    <div class="msg-meta">${esc(isOwn ? 'You' : msg.name || 'User')} · ${new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    <div class="msg-bubble">${esc(msg.text || '')}</div>
    ${isServerOwner || isOwn ? `<span class="msg-del" onclick="servers.delServerMsg('${key}')">🗑</span>` : ''}
  </div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

export function sendMsg() {
  if (!currentUser) { toast('Sign in to chat', 'err'); return; }
  if (!currentServerId || !currentServerCh) { toast('Select a channel', 'err'); return; }

  const inp = document.getElementById('serverMsgInput');
  const text = sanitizeInput(inp.value, 1000);
  if (!text) return;

  const name = (currentProfile?.displayName) || currentUser.displayName || 'User';
  db.ref(`serverMessages/${currentServerId}/${currentServerCh}`).push({
    name: sanitizeInput(name, 30),
    uid: currentUser.uid,
    photoURL: (currentProfile?.photoURL) || currentUser.photoURL || '',
    text,
    ts: ts()
  }).catch(e => toast('Failed: ' + e.message, 'err'));

  inp.value = '';
  inp.style.height = 'auto';
  db.ref(`serverTyping/${currentServerId}/${currentServerCh}`).remove();
}

export function msgKD(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
}

export function userTyping() {
  if (!currentUser || !currentServerId || !currentServerCh) return;
  const name = (currentProfile?.displayName) || currentUser.displayName || 'Guest';
  db.ref(`serverTyping/${currentServerId}/${currentServerCh}`).set(name);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => db.ref(`serverTyping/${currentServerId}/${currentServerCh}`).remove(), 1500);
}

export function delServerMsg(key) {
  if (!currentServerId || !currentServerCh) return;
  db.ref(`serverMessages/${currentServerId}/${currentServerCh}/${key}`).remove();
}

export function leaveServer() {
  if (!currentUser || !currentServerId) return;
  if (!confirm('Leave this server?')) return;

  db.ref(`serverMembers/${currentServerId}/${currentUser.uid}`).remove().then(() => {
    toast('Left server');
    window.app.showPage('servers');
    loadServers();
  });
}

export function openAddChannel() {
  if (!isServerOwner) return;
  const name = prompt('Channel name:');
  if (!name) return;
  const clean = sanitizeInput(name, 30).toLowerCase().replace(/\s+/g, '-');
  const icon = prompt('Icon emoji (optional):') || '#';
  db.ref(`serverChannels/${currentServerId}/${clean}`).set({ name: clean, icon: sanitizeInput(icon, 4), createdAt: ts() }).then(() => {
    loadServerChannels(currentServerId);
    toast('Channel #' + clean + ' created');
  });
}

export function openServerSettings() {
  if (!isServerOwner || !currentServerId) return;

  db.ref('servers/' + currentServerId).once('value').then(s => {
    const srv = s.val();
    const modal = document.getElementById('serverSettingsModal');
    if (!modal) buildServerSettingsModal();

    document.getElementById('srvSettName').value = srv.name || '';
    document.getElementById('srvSettDesc').value = srv.description || '';
    document.getElementById('srvSettIcon').value = srv.icon || '';
    document.getElementById('srvSettPublic').checked = srv.public !== false;
    document.getElementById('srvInviteCode').textContent = srv.inviteCode || '';
    document.getElementById('serverSettingsModal').classList.add('open');
  });
}

function buildServerSettingsModal() {
  const modals = document.getElementById('modals');
  const div = document.createElement('div');
  div.id = 'serverSettingsModal';
  div.className = 'mb';
  div.onclick = e => { if (e.target === div) div.classList.remove('open'); };
  div.innerHTML = `
    <div class="modal" style="max-width:440px;">
      <h2>⚙️ Server Settings</h2>
      <div class="form-row" style="margin-top:14px;">
        <input class="inp" id="srvSettName" placeholder="Server name…" maxlength="40"/>
        <input class="inp" id="srvSettDesc" placeholder="Description…" maxlength="100"/>
        <input class="inp" id="srvSettIcon" placeholder="Icon emoji…" maxlength="4"/>
        <label style="display:flex;align-items:center;gap:8px;font-size:0.88rem;cursor:pointer;">
          <input type="checkbox" id="srvSettPublic"/>
          <span>Public server</span>
        </label>
        <div class="card" style="font-size:0.82rem;">
          <span class="muted">Invite code: </span><strong id="srvInviteCode"></strong>
          <button class="btn btn-xs" style="margin-left:8px;" onclick="servers.regenInviteCode()">Regenerate</button>
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-d btn-sm" onclick="servers.deleteServer()">Delete Server</button>
        <button class="btn" onclick="document.getElementById('serverSettingsModal').classList.remove('open')">Cancel</button>
        <button class="btn btn-p" onclick="servers.saveServerSettings()">Save</button>
      </div>
    </div>`;
  modals.appendChild(div);
}

export function saveServerSettings() {
  if (!isServerOwner || !currentServerId) return;
  const name = sanitizeInput(document.getElementById('srvSettName').value, 40);
  const desc = sanitizeInput(document.getElementById('srvSettDesc').value, 100);
  const icon = sanitizeInput(document.getElementById('srvSettIcon').value, 4) || '🌐';
  const isPublic = document.getElementById('srvSettPublic').checked;

  if (!name) { toast('Name required', 'err'); return; }

  db.ref('servers/' + currentServerId).update({ name, description: desc, icon, public: isPublic }).then(() => {
    document.getElementById('serverViewName').textContent = name;
    document.getElementById('serverSettingsModal').classList.remove('open');
    toast('Settings saved ✓');
  }).catch(e => toast('Failed: ' + e.message, 'err'));
}

export function regenInviteCode() {
  if (!isServerOwner || !currentServerId) return;
  const code = Math.random().toString(36).substr(2, 8).toUpperCase();
  db.ref('servers/' + currentServerId).update({ inviteCode: code }).then(() => {
    document.getElementById('srvInviteCode').textContent = code;
    toast('New invite code: ' + code);
  });
}

export function deleteServer() {
  if (!isServerOwner || !currentServerId) return;
  if (!confirm('Delete this server permanently? This cannot be undone.')) return;

  const updates = {};
  updates[`servers/${currentServerId}`] = null;
  updates[`serverChannels/${currentServerId}`] = null;
  updates[`serverMessages/${currentServerId}`] = null;
  updates[`serverMembers/${currentServerId}`] = null;

  db.ref().update(updates).then(() => {
    document.getElementById('serverSettingsModal').classList.remove('open');
    toast('Server deleted');
    window.app.showPage('servers');
    loadServers();
  });
}

window.servers = {
  loadServers, openCreateServer, createServer, openJoinServer,
  joinAndOpenServer, openServer, sendMsg, msgKD, userTyping,
  delServerMsg, leaveServer, openAddChannel, openServerSettings,
  saveServerSettings, regenInviteCode, deleteServer
};