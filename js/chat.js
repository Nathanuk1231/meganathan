import { db, CHANNELS, CH_ICONS, BAD_WORDS, EMOJIS, STICKERS } from './config.js';
import { currentUser, currentProfile, isAdmin } from './auth.js';
import { toast, esc, sanitizeInput, validateUID, ts, timeStr } from './utils.js';

let curCh = 'general';
let msgListeners = {};
let pendingImg = null;
let typingTimer;
let emojiTarget = null;
export let customEmojis = [];
let profileCache = {};

const EMOJI_POOL = ['😀','😂','😍','🥳','😎','🤩','😏','🤯','😤','😴','🥺','😈',
  '🤖','👾','🎃','🤠','🧠','👑','💀','🫶','🙏','🤌','🫡','🫠','🧊','🔮',
  '🌈','⚡','🔥','💧','🌊','🌸','🍀','🌙','☀️','⭐','💫','🎯','🎲','🎮',
  '🏆','🥇','💎','💰','🚀','🛸','🌍','🦄','🐉','🦊','🐺','🐙','🦋','🌺',
  '🍕','🍔','🍦','🎂','🍜','🧋','🥤','🍾','🎵','🎸','🥁','🎹','🎤','🎬',
  '📱','💻','⌨️','🖥️','🕹️','📷','🎧','🔑','💡','⚙️','🔧','🧲','☢️','⚗️'];

function filterMsg(t) {
  let o = t;
  BAD_WORDS.forEach(w => {
    const re = new RegExp('\\b' + w + '\\b', 'gi');
    o = o.replace(re, '*'.repeat(w.length));
  });
  return o;
}

export function initChat() {
  switchCh(curCh);
  listenOnline();
  createStickers();
}

export function switchCh(ch) {
  curCh = ch;
  document.querySelectorAll('.ch-item').forEach(el => el.classList.remove('active'));
  document.getElementById('ch-' + ch)?.classList.add('active');
  document.getElementById('chTitle').textContent = '# ' + ch;
  document.getElementById('chIcon').textContent = CH_ICONS[ch] || '#';
  document.getElementById('messageInput').placeholder = 'Message #' + ch + '…';
  
  const box = document.getElementById('chatBox');
  box.innerHTML = '';
  
  if (msgListeners[ch]) {
    db.ref('messages/' + ch).off();
    msgListeners[ch] = null;
  }
  
  const ref = db.ref('messages/' + ch).limitToLast(60);
  msgListeners[ch] = ref.on('child_added', snap => {
    const msg = snap.val();
    const key = snap.key;
    if (!msg) return;
    appendMsg(msg, key);
  });
  
  db.ref('messages/' + ch).on('child_removed', snap => {
    document.getElementById('msg-' + snap.key)?.remove();
  });
  
  db.ref('messages/' + ch).on('child_changed', snap => {
    const msg = snap.val();
    const key = snap.key;
    const el = document.getElementById('msg-' + key);
    if (el) updateMsgReactions(el, msg, key);
  });
  
  db.ref('typing/' + ch).on('value', snap => {
    const v = snap.val();
    const bar = document.getElementById('typingBar');
    if (!bar) return;
    if (v && currentUser && v !== ((currentProfile && currentProfile.displayName) || currentUser.displayName || 'Guest'))
      bar.textContent = v + ' is typing…';
    else bar.textContent = '';
  });
}

function listenOnline() {
  db.ref('online').on('value', snap => {
    const list = document.getElementById('onlineList');
    const countEl = document.getElementById('onlineCount');
    if (!list) return;
    
    const val = snap.val() || {};
    const entries = Object.entries(val);
    if (countEl) countEl.textContent = entries.length;
    
    const statEl = document.getElementById('statOnline');
    if (statEl) statEl.textContent = entries.length;
    
    list.innerHTML = '';
    entries.forEach(([uid, info]) => {
      const dotClass = { 'online': 'online-dot', 'away': 'away-dot', 'busy': 'busy-dot' }[info.status || 'online'] || 'online-dot';
      const div = document.createElement('div');
      div.className = 'u-item';
      div.onclick = () => window.profile.viewProfile(uid);
      div.innerHTML = `<span class="${dotClass}"></span><span class="u-name">${esc(info.name || 'User')}</span>`;
      list.appendChild(div);
    });
  });
  
  if (currentUser) {
    const ref = db.ref('online/' + currentUser.uid);
    ref.update({
      name: (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User',
      uid: currentUser.uid,
      status: (currentProfile && currentProfile.status) || 'online',
      at: ts()
    });
    ref.onDisconnect().remove();
  }
}

async function appendMsg(msg, key) {
  const box = document.getElementById('chatBox');
  if (!box) return;
  
  const isOwn = currentUser && msg.uid === currentUser.uid;
  
  if (msg.uid && !profileCache[msg.uid]) {
    try {
      const s = await db.ref('profiles/' + msg.uid).once('value');
      profileCache[msg.uid] = s.val();
    } catch (e) {}
  }
  
  const p = msg.uid ? profileCache[msg.uid] : null;
  const senderName = (p && p.displayName) || msg.name || 'User';
  const photo = (p && p.photoURL) || msg.photoURL || '';
  const avHTML = photo 
    ? `<img class="msg-av" src="${esc(photo)}" onclick="profile.viewProfile('${msg.uid || ''}')" onerror="this.textContent='👤'">`
    : `<div class="msg-av" onclick="profile.viewProfile('${msg.uid || ''}')">👤</div>`;

  const div = document.createElement('div');
  div.className = 'msg' + (isOwn ? ' own' : '');
  div.id = 'msg-' + key;

  const reactHTML = buildReactHTML(msg.reactions || {}, key);

  if (msg.type === 'poll') {
    div.innerHTML = `${avHTML}<div class="msg-body">
      <div class="msg-meta" onclick="profile.viewProfile('${msg.uid || ''}')">${esc(isOwn ? 'You' : senderName)} · ${timeStr(msg.ts)}</div>
      <div class="msg-bubble">${buildPollHTML(msg, key)}</div>
      <div class="msg-reactions">${reactHTML}</div>
      <div style="display:flex;gap:4px;margin-top:3px;">
        <span class="msg-del" onclick="chat.addReaction('${key}')">😀</span>
        ${isAdmin() ? `<span class="msg-del" onclick="chat.delMsg('${key}')">🗑</span>` : ''}
      </div>
    </div>`;
  } else {
    div.innerHTML = `${avHTML}<div class="msg-body">
      <div class="msg-meta" onclick="profile.viewProfile('${msg.uid || ''}')">${esc(isOwn ? 'You' : senderName)} · ${timeStr(msg.ts)}</div>
      <div class="msg-bubble">${msg.sticker ? `<span style="font-size:2rem">${msg.sticker}</span>` : esc(msg.text || '')}</div>
      ${msg.image ? `<img class="msg-img" src="${msg.image}" onclick="openLB(this.src)" alt="img">` : ''}
      <div class="msg-reactions" id="react-${key}">${reactHTML}</div>
      <div style="display:flex;gap:4px;margin-top:3px;">
        <span class="msg-del" onclick="chat.addReaction('${key}')">😀</span>
        ${isAdmin() ? `<span class="msg-del" onclick="chat.delMsg('${key}')">🗑</span>` : ''}
      </div>
    </div>`;
  }
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function buildReactHTML(reactions, key) {
  if (!reactions || !Object.keys(reactions).length) return '';
  const counts = {};
  Object.values(reactions).forEach(r => { counts[r] = (counts[r] || 0) + 1; });
  const myUid = currentUser ? currentUser.uid : '';
  const myReacts = currentUser ? Object.entries(reactions).filter(([uid]) => uid === myUid).map(([, r]) => r) : [];
  return Object.entries(counts).map(([emoji, count]) =>
    `<button class="reaction-btn${myReacts.includes(emoji) ? ' mine' : ''}" onclick="chat.toggleReaction('${key}','${emoji}')">${emoji}<span class="reaction-count">${count}</span></button>`
  ).join('');
}

function updateMsgReactions(el, msg, key) {
  const reactEl = el.querySelector('#react-' + key) || el.querySelector('.msg-reactions');
  if (reactEl) reactEl.innerHTML = buildReactHTML(msg.reactions || {}, key);
}

function buildPollHTML(msg, key) {
  const opts = msg.pollOptions || [];
  const votes = msg.votes || {};
  const total = Object.keys(votes).length;
  const myVote = currentUser ? votes[currentUser.uid] : null;
  return `<div class="poll-card">
    <div class="poll-q">📊 ${esc(msg.text)}</div>
    ${opts.map((opt, i) => {
      const voteCount = Object.values(votes).filter(v => v === i).length;
      const pct = total ? Math.round(voteCount / total * 100) : 0;
      return `<div class="poll-option" onclick="chat.vote('${key}',${i})">
        <div class="poll-bar-wrap">
          <div class="poll-bar" style="width:${pct}%"></div>
          <span class="poll-label">${esc(opt)}${myVote === i ? ' ✓' : ''}</span>
        </div>
        <span class="poll-pct">${pct}%</span>
      </div>`;
    }).join('')}
    <div style="font-size:0.72rem;color:var(--muted);margin-top:6px;">${total} vote${total !== 1 ? 's' : ''}</div>
  </div>`;
}

export function vote(key, optIdx) {
  if (!currentUser) {
    toast('Sign in to vote', 'err');
    return;
  }
  db.ref('messages/' + curCh + '/' + key + '/votes/' + currentUser.uid).set(optIdx);
}

export function sendMsg() {
  if (!currentUser) {
    toast('Please sign in to chat', 'err');
    return;
  }
  
  const text = sanitizeInput(document.getElementById('messageInput').value, 1000);
  if (!text && !pendingImg) return;
  
  const name = (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User';
  const msg = {
    name: sanitizeInput(name, 30),
    uid: currentUser.uid,
    photoURL: (currentProfile && currentProfile.photoURL) || currentUser.photoURL || '',
    text: filterMsg(text),
    ts: ts()
  };
  
  if (pendingImg) msg.image = pendingImg;
  
  db.ref('messages/' + curCh).push(msg)
    .then(() => {
      db.ref('profiles/' + currentUser.uid).transaction(p => {
        if (p) { p.messageCount = (p.messageCount || 0) + 1; }
        return p;
      });
      
      if (text) {
        const coolKey = 'notifSent_' + curCh;
        const last = parseInt(localStorage.getItem(coolKey) || '0');
        if (Date.now() - last > 300000) {
          localStorage.setItem(coolKey, Date.now());
          db.ref('friends/' + currentUser.uid).once('value').then(s => {
            const friends = s.val() || {};
            Object.keys(friends).forEach(fUid => {
              if (window.notifications) {
                window.notifications.addNotif(fUid, 'message', `💬 ${name} sent a message in #${curCh}`);
              }
            });
          }).catch(() => {});
        }
      }
    })
    .catch(e => toast('Send failed: ' + e.message, 'err'));
  
  document.getElementById('messageInput').value = '';
  document.getElementById('messageInput').style.height = 'auto';
  clearImg();
  db.ref('typing/' + curCh).remove();
}

export function delMsg(key) {
  db.ref('messages/' + curCh + '/' + key).remove();
}

export function userTyping() {
  if (!currentUser) return;
  const name = (currentProfile && currentProfile.displayName) || currentUser.displayName || 'Guest';
  db.ref('typing/' + curCh).set(name);
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => db.ref('typing/' + curCh).remove(), 1500);
}

export function msgKD(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
}

export function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
}

export function handleImg(inp) {
  const f = inp.files[0];
  if (!f) return;
  
  if (f.size > 2 * 1024 * 1024) {
    toast('Image must be under 2MB', 'err');
    inp.value = '';
    return;
  }
  
  const r = new FileReader();
  r.onloadend = () => {
    pendingImg = r.result;
    document.getElementById('imgPrevName').textContent = '📎 ' + f.name;
    document.getElementById('imgPrevBar').style.display = 'flex';
    toast('Image attached ✓');
  };
  r.readAsDataURL(f);
}

function clearImg() {
  pendingImg = null;
  document.getElementById('imageInput').value = '';
  document.getElementById('imgPrevBar').style.display = 'none';
}

function createStickers() {
  const grid = document.getElementById('stickerGrid');
  if (grid && !grid.children.length) {
    grid.innerHTML = STICKERS.map(s => `<div class="sticker" onclick="chat.sendSticker('${s}')">${s}</div>`).join('');
  }
}

export function toggleStickers() {
  const p = document.getElementById('stickerPicker');
  const pc = document.getElementById('pollCreate');
  pc.classList.remove('open');
  createStickers();
  p.classList.toggle('open');
}

export function sendSticker(s) {
  if (!currentUser) {
    toast('Sign in first', 'err');
    return;
  }
  const name = (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User';
  db.ref('messages/' + curCh).push({
    name: sanitizeInput(name, 30),
    uid: currentUser.uid,
    photoURL: (currentProfile && currentProfile.photoURL) || currentUser.photoURL || '',
    sticker: s,
    text: '',
    ts: ts()
  });
  document.getElementById('stickerPicker').classList.remove('open');
}

export function togglePollCreate() {
  const p = document.getElementById('pollCreate');
  document.getElementById('stickerPicker').classList.remove('open');
  p.classList.toggle('open');
}

export function closePollCreate() {
  document.getElementById('pollCreate').classList.remove('open');
}

export function sendPoll() {
  if (!currentUser) {
    toast('Sign in first', 'err');
    return;
  }
  
  const q = sanitizeInput(document.getElementById('pollQ').value, 120);
  const a = sanitizeInput(document.getElementById('pollA').value, 60);
  const b = sanitizeInput(document.getElementById('pollB').value, 60);
  const c = sanitizeInput(document.getElementById('pollC').value, 60);
  
  if (!q || !a || !b) {
    toast('Question and at least 2 options required', 'err');
    return;
  }
  
  const opts = [a, b];
  if (c) opts.push(c);
  
  const name = (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User';
  db.ref('messages/' + curCh).push({
    name: sanitizeInput(name, 30),
    uid: currentUser.uid,
    type: 'poll',
    text: q,
    pollOptions: opts,
    votes: {},
    ts: ts()
  }).catch(e => toast('Failed: ' + e.message, 'err'));
  
  ['pollQ', 'pollA', 'pollB', 'pollC'].forEach(id => document.getElementById(id).value = '');
  closePollCreate();
}

function openLB(src) {
  document.getElementById('lbImg').src = src;
  document.getElementById('lb').classList.add('open');
}

export function addReaction(key) {
  const picker = document.getElementById('emojiPicker');
  const msgEl = document.getElementById('msg-' + key);
  if (!msgEl) return;
  
  const rect = msgEl.getBoundingClientRect();
  picker.style.display = 'flex';
  picker.style.top = (rect.bottom + window.scrollY + 4) + 'px';
  picker.style.left = Math.min(rect.left, window.innerWidth - 230) + 'px';
  picker.innerHTML = EMOJIS.map(e => `<button class="emoji-btn" onclick="chat.toggleReaction('${key}','${e}');chat.hideEmojiPicker()">${e}</button>`).join('');
  emojiTarget = key;
  setTimeout(() => document.addEventListener('click', outsideEmojiClick, { once: true }), 10);
}

export function hideEmojiPicker() {
  document.getElementById('emojiPicker').style.display = 'none';
}

function outsideEmojiClick(e) {
  if (!document.getElementById('emojiPicker').contains(e.target)) hideEmojiPicker();
}

export function toggleReaction(key, emoji) {
  if (!currentUser) {
    toast('Sign in to react', 'err');
    return;
  }
  const ref = db.ref('messages/' + curCh + '/' + key + '/reactions/' + currentUser.uid);
  ref.once('value').then(s => {
    if (s.val() === emoji) ref.remove();
    else ref.set(emoji);
  });
}

export function loadCustomEmojis() {
  if (!currentUser) {
    customEmojis = [];
    return;
  }
  db.ref('customEmoji/' + currentUser.uid).once('value').then(s => {
    customEmojis = s.val() || [];
    if (!Array.isArray(customEmojis)) customEmojis = Object.values(customEmojis);
    renderCustomEmojiPicker();
  }).catch(() => {
    customEmojis = [];
    renderCustomEmojiPicker();
  });
}

function saveCustomEmojis() {
  if (!currentUser) return;
  db.ref('customEmoji/' + currentUser.uid).set(customEmojis).catch(() => {});
}

function renderCustomEmojiPicker() {
  const grid = document.getElementById('customEmojiGrid');
  if (!grid) return;
  if (!customEmojis.length) {
    grid.innerHTML = '<p class="muted" style="font-size:0.78rem;grid-column:1/-1;">No custom emoji yet. Add some below!</p>';
    return;
  }
  grid.innerHTML = customEmojis.map((e, i) => `
    <div class="custom-emoji-item" onclick="chat.sendCustomEmoji('${e}')" title="${e}">
      ${e}
      <span class="custom-emoji-del" onclick="chat.removeCustomEmoji(event,${i})">✕</span>
    </div>`).join('');
}

export function sendCustomEmoji(e) {
  if (!currentUser) {
    toast('Sign in first', 'err');
    return;
  }
  const name = (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User';
  db.ref('messages/' + curCh).push({
    name: sanitizeInput(name, 30),
    uid: currentUser.uid,
    photoURL: (currentProfile && currentProfile.photoURL) || currentUser.photoURL || '',
    sticker: e,
    text: '',
    ts: ts()
  });
  closeCustomEmojiModal();
}

export function removeCustomEmoji(e, i) {
  e.stopPropagation();
  customEmojis.splice(i, 1);
  saveCustomEmojis();
  renderCustomEmojiPicker();
  renderEmojiPoolPicker();
}

function renderEmojiPoolPicker() {
  const pool = document.getElementById('emojiPoolPicker');
  if (!pool) return;
  pool.innerHTML = EMOJI_POOL.map(e => `<span class="emoji-pick-opt${customEmojis.includes(e) ? ' selected' : ''}"
    onclick="chat.toggleCustomEmoji('${e}')" title="Add/remove">${e}</span>`).join('');
}

export function toggleCustomEmoji(e) {
  const idx = customEmojis.indexOf(e);
  if (idx >= 0) {
    customEmojis.splice(idx, 1);
  } else {
    if (customEmojis.length >= 20) {
      toast('Max 20 custom emoji', 'warn');
      return;
    }
    customEmojis.push(e);
  }
  saveCustomEmojis();
  renderCustomEmojiPicker();
  renderEmojiPoolPicker();
}

export function openCustomEmojiModal() {
  if (!currentUser) {
    toast('Sign in first', 'err');
    return;
  }
  loadCustomEmojis();
  
  const modal = document.getElementById('customEmojiModal');
  if (!modal) createCustomEmojiModal();
  
  document.getElementById('customEmojiModal').classList.add('open');
  setTimeout(renderEmojiPoolPicker, 50);
}

function createCustomEmojiModal() {
  const modals = document.getElementById('modals');
  const div = document.createElement('div');
  div.id = 'customEmojiModal';
  div.className = 'mb';
  div.onclick = (e) => { if (e.target === div) closeCustomEmojiModal(); };
  div.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <h2>✨ My Custom Emoji</h2>
      <p class="muted" style="font-size:0.82rem;margin-bottom:12px;">Pick up to 20 emoji to use as quick reactions in chat. Click one to send it.</p>
      <h3 style="font-size:0.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Your Emoji</h3>
      <div class="custom-emoji-grid" id="customEmojiGrid"></div>
      <h3 style="font-size:0.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;margin-top:12px;">Add from Library</h3>
      <div class="emoji-mgr-picker" id="emojiPoolPicker"></div>
      <div class="modal-foot">
        <button class="btn" onclick="chat.closeCustomEmojiModal()">Done</button>
      </div>
    </div>
  `;
  modals.appendChild(div);
}

function closeCustomEmojiModal() {
  document.getElementById('customEmojiModal').classList.remove('open');
}

window.chat = {
  initChat,
  switchCh,
  sendMsg,
  delMsg,
  userTyping,
  msgKD,
  autoResize,
  handleImg,
  toggleStickers,
  sendSticker,
  togglePollCreate,
  closePollCreate,
  sendPoll,
  vote,
  addReaction,
  hideEmojiPicker,
  toggleReaction,
  loadCustomEmojis,
  sendCustomEmoji,
  removeCustomEmoji,
  toggleCustomEmoji,
  openCustomEmojiModal,
  closeCustomEmojiModal
};