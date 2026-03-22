import { db } from './config.js';
import { currentUser } from './auth.js';
import { esc } from './utils.js';

export function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav a').forEach(a => a.classList.remove('active'));
  document.getElementById('page-' + id)?.classList.add('active');
  document.getElementById('nav-' + id)?.classList.add('active');

  if (id === 'chat' && window.chat) window.chat.initChat();
  if (id === 'home') loadHomeStats();
  if (id === 'profile' && window.profile) window.profile.renderProfile();
  if (id === 'leaderboard' && window.games) window.games.loadLeaderboard();
  if (id === 'friends' && window.friends) window.friends.loadFriends();
  if (id === 'notifs' && window.notifications) window.notifications.loadNotifs();
  if (id === 'servers' && window.servers) window.servers.loadServers();
  if (id === 'dm' && window.dm) window.dm.loadDMs();
  if (id === 'themes') {
    const s = localStorage.getItem('theme') || 'green';
    document.querySelectorAll('.theme-sw').forEach(x => x.classList.remove('active'));
    document.getElementById('th-' + s)?.classList.add('active');
  }
  if (id === 'admin' && window.admin) window.admin.loadAdmin();
}

async function loadWeather() {
  const widget = document.getElementById('weatherWidget');
  if (!widget) return;

  try {
    let lat, lon, city;

    try {
      const geoRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
      if (!geoRes.ok) throw new Error('ipapi failed');
      const geo = await geoRes.json();
      if (geo.error) throw new Error('ipapi error');
      lat = geo.latitude;
      lon = geo.longitude;
      city = geo.city;
    } catch {
      try {
        const geoRes2 = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
        const geo2 = await geoRes2.json();
        lat = geo2.latitude;
        lon = geo2.longitude;
        city = geo2.city;
      } catch {
        lat = 51.5;
        lon = -0.1;
        city = 'London';
      }
    }

    const wRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
      { signal: AbortSignal.timeout(5000) }
    );
    const w = await wRes.json();
    const temp = Math.round(w.current_weather.temperature);
    const code = w.current_weather.weathercode;

    widget.innerHTML = `<div class="weather-widget">
      <div class="weather-icon">${weatherIcon(code)}</div>
      <div>
        <div class="weather-temp">${temp}°C</div>
        <div class="weather-desc">${weatherDesc(code)}</div>
        <div class="weather-loc">📍 ${esc(city || 'Unknown')}</div>
      </div>
    </div>`;
  } catch {
    widget.innerHTML = '';
  }
}

function weatherIcon(c) {
  if (c === 0) return '☀️';
  if (c <= 2) return '⛅';
  if (c <= 3) return '☁️';
  if (c <= 67) return '🌧️';
  if (c <= 77) return '❄️';
  if (c <= 82) return '🌦️';
  if (c <= 99) return '⛈️';
  return '🌡️';
}

function weatherDesc(c) {
  if (c === 0) return 'Clear sky';
  if (c <= 2) return 'Partly cloudy';
  if (c <= 3) return 'Overcast';
  if (c <= 48) return 'Foggy';
  if (c <= 67) return 'Rainy';
  if (c <= 77) return 'Snowy';
  if (c <= 82) return 'Showers';
  if (c <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function loadHomeStats() {
  loadWeather();

  let total = 0, done = 0;
  ['general', 'random', 'gaming', 'music-chat'].forEach(ch => {
    db.ref('messages/' + ch).once('value').then(s => {
      total += s.numChildren();
      done++;
      if (done === 4) {
        const el = document.getElementById('statMsgs');
        if (el) el.textContent = total;
      }
    }).catch(() => { done++; });
  });

  db.ref('profiles').once('value').then(s => {
    const el = document.getElementById('statUsers');
    if (el) el.textContent = s.numChildren();
  }).catch(() => {});

  db.ref('online').once('value').then(s => {
    const el = document.getElementById('statOnline');
    if (el) el.textContent = s.numChildren();
  }).catch(() => {});
}

function createPages() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <div class="page active" id="page-home">
      <div id="weatherWidget"></div>
      <div class="hero">
        <div class="hero-badge">✦ LIVE</div>
        <h1>Welcome to <span>NeonVerse</span></h1>
        <p class="muted" style="margin:10px auto 24px;max-width:460px;font-size:1rem;">Chat, game, and vibe with your crew — all in one neon-lit corner of the web.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-p" onclick="app.showPage('chat')">💬 Open Chat</button>
          <button class="btn" onclick="app.showPage('servers')">🌐 Servers</button>
          <button class="btn" onclick="app.showPage('gaming')">🎮 Play Games</button>
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-card"><div class="stat-num" id="statMsgs">–</div><div class="stat-label">Messages</div></div>
        <div class="stat-card"><div class="stat-num" id="statUsers">–</div><div class="stat-label">Members</div></div>
        <div class="stat-card"><div class="stat-num" id="statOnline">–</div><div class="stat-label">Online</div></div>
        <div class="stat-card"><div class="stat-num">5</div><div class="stat-label">Games</div></div>
      </div>
      <div class="quick-grid">
        <div class="quick-card" onclick="app.showPage('chat')"><div class="quick-icon">💬</div><h3>Global Chat</h3><p>Real-time with everyone</p></div>
        <div class="quick-card" onclick="app.showPage('servers')"><div class="quick-icon">🌐</div><h3>Servers</h3><p>Create or join communities</p></div>
        <div class="quick-card" onclick="app.showPage('dm')"><div class="quick-icon">✉️</div><h3>Direct Messages</h3><p>Private conversations</p></div>
        <div class="quick-card" onclick="app.showPage('gaming')"><div class="quick-icon">🎮</div><h3>Games</h3><p>Snake, Dino, 2048 & more</p></div>
        <div class="quick-card" onclick="app.showPage('music')"><div class="quick-icon">🎵</div><h3>Music</h3><p>Search any YouTube track</p></div>
        <div class="quick-card" onclick="app.showPage('profile')"><div class="quick-icon">👤</div><h3>Profile</h3><p>Customise your avatar & bio</p></div>
        <div class="quick-card" onclick="app.showPage('friends')"><div class="quick-icon">👥</div><h3>Friends</h3><p>Add and manage friends</p></div>
        <div class="quick-card" onclick="app.showPage('notifs')"><div class="quick-icon">🔔</div><h3>Notifications</h3><p>See what you missed</p></div>
      </div>
    </div>

    <div class="page" id="page-chat">
      <div class="chat-wrap">
        <div class="chat-side">
          <div class="panel-hd">Channels</div>
          <div class="ch-list">
            <div class="ch-item active" id="ch-general" onclick="chat.switchCh('general')"><span>📢</span> general</div>
            <div class="ch-item" id="ch-random" onclick="chat.switchCh('random')"><span>🎲</span> random</div>
            <div class="ch-item" id="ch-gaming" onclick="chat.switchCh('gaming')"><span>🎮</span> gaming</div>
            <div class="ch-item" id="ch-music-chat" onclick="chat.switchCh('music-chat')"><span>🎵</span> music</div>
          </div>
          <div class="panel-hd" style="border-top:1px solid var(--border)">Online — <span id="onlineCount">0</span></div>
          <div class="user-list" id="onlineList"></div>
        </div>
        <div class="chat-main">
          <div class="chat-hd">
            <span style="font-size:1.1rem" id="chIcon">📢</span>
            <div><div class="chat-title" id="chTitle"># general</div><div class="chat-sub">Welcome to NeonVerse</div></div>
          </div>
          <div class="messages" id="chatBox"></div>
          <div class="typing-bar" id="typingBar"></div>
          <div style="position:relative;">
            <div class="sticker-picker" id="stickerPicker">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <div style="font-size:0.72rem;color:var(--muted);">Stickers</div>
                <button class="btn btn-xs" onclick="chat.openCustomEmojiModal();document.getElementById('stickerPicker').classList.remove('open');">✨ My Emoji</button>
              </div>
              <div class="sticker-grid" id="stickerGrid"></div>
            </div>
            <div class="poll-create" id="pollCreate">
              <h3 style="margin-bottom:10px;">📊 Create Poll</h3>
              <div class="form-row">
                <input class="inp" id="pollQ" placeholder="Question…" maxlength="120"/>
                <input class="inp" id="pollA" placeholder="Option A…" maxlength="60"/>
                <input class="inp" id="pollB" placeholder="Option B…" maxlength="60"/>
                <input class="inp" id="pollC" placeholder="Option C (optional)…" maxlength="60"/>
              </div>
              <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn btn-sm" onclick="chat.closePollCreate()">Cancel</button>
                <button class="btn btn-p btn-sm" onclick="chat.sendPoll()">Send Poll</button>
              </div>
            </div>
          </div>
          <div class="chat-inp-row">
            <div class="inp-wrap">
              <textarea id="messageInput" placeholder="Message #general…" rows="1"
                oninput="chat.autoResize(this);chat.userTyping();" onkeydown="chat.msgKD(event)"></textarea>
              <div class="inp-actions">
                <button class="inp-icon" onclick="chat.toggleStickers()" title="Stickers">🎭</button>
                <button class="inp-icon" onclick="chat.togglePollCreate()" title="Poll">📊</button>
                <button class="inp-icon" onclick="document.getElementById('imageInput').click()" title="Image">📎</button>
              </div>
              <input type="file" id="imageInput" accept="image/*" onchange="chat.handleImg(this)"/>
            </div>
            <button class="btn btn-p" onclick="chat.sendMsg()">Send</button>
          </div>
          <div id="imgPrevBar">
            <span id="imgPrevName"></span>
            <button class="btn btn-xs btn-d" onclick="chat.clearImg()">✕</button>
          </div>
        </div>
      </div>
    </div>

    <div class="page" id="page-servers">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
        <h1 class="accent">🌐 Servers</h1>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-p btn-sm" onclick="servers.openCreateServer()">+ Create Server</button>
          <button class="btn btn-sm" onclick="servers.openJoinServer()">🔗 Join by Code</button>
        </div>
      </div>
      <div id="myServersList" style="margin-bottom:24px;"></div>
      <h2 style="margin-bottom:12px;">Public Servers</h2>
      <div id="publicServersList"></div>
    </div>

    <div class="page" id="page-server-view">
      <div class="chat-wrap" style="height:calc(100vh - 120px);">
        <div class="chat-side" style="min-width:180px;">
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">
            <button class="btn btn-xs" onclick="app.showPage('servers')">←</button>
            <div id="serverViewName" style="font-weight:700;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
          </div>
          <div class="panel-hd" style="display:flex;justify-content:space-between;align-items:center;">
            <span>Channels</span>
            <button class="btn btn-xs" id="addChBtn" onclick="servers.openAddChannel()" style="display:none;">+</button>
          </div>
          <div class="ch-list" id="serverChList"></div>
          <div class="panel-hd" style="border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
            <span>Members</span>
            <span id="serverMemberCount" style="color:var(--muted);font-size:0.75rem;"></span>
          </div>
          <div class="user-list" id="serverMemberList"></div>
          <div style="padding:10px;border-top:1px solid var(--border);">
            <button class="btn btn-xs btn-d" id="leaveServerBtn" onclick="servers.leaveServer()" style="width:100%;">Leave Server</button>
            <button class="btn btn-xs btn-p" id="serverSettingsBtn" onclick="servers.openServerSettings()" style="width:100%;margin-top:6px;display:none;">⚙️ Settings</button>
          </div>
        </div>
        <div class="chat-main">
          <div class="chat-hd">
            <span id="serverChIcon" style="font-size:1.1rem;">#</span>
            <div><div class="chat-title" id="serverChTitle">Select a channel</div></div>
            <div style="margin-left:auto;display:flex;gap:6px;">
              <button class="btn btn-xs" onclick="calls.startVoiceCall()" title="Voice Call">🎙️ Call</button>
            </div>
          </div>
          <div class="messages" id="serverChatBox"></div>
          <div class="typing-bar" id="serverTypingBar"></div>
          <div class="chat-inp-row">
            <div class="inp-wrap">
              <textarea id="serverMsgInput" placeholder="Message…" rows="1"
                oninput="chat.autoResize(this);servers.userTyping();" onkeydown="servers.msgKD(event)"></textarea>
            </div>
            <button class="btn btn-p" onclick="servers.sendMsg()">Send</button>
          </div>
        </div>
      </div>
    </div>

    <div class="page" id="page-dm">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
        <h1 class="accent">✉️ Direct Messages</h1>
        <button class="btn btn-p btn-sm" onclick="dm.openNewDM()">+ New Message</button>
      </div>
      <div class="chat-wrap" style="height:calc(100vh - 160px);">
        <div class="chat-side">
          <div class="panel-hd">Conversations</div>
          <div class="ch-list" id="dmList" style="flex:1;overflow-y:auto;padding:6px;"></div>
        </div>
        <div class="chat-main" id="dmChatArea">
          <div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);flex-direction:column;gap:8px;">
            <div style="font-size:2rem;">✉️</div>
            <p>Select a conversation or start a new one</p>
          </div>
        </div>
      </div>
    </div>

    <div class="page" id="page-gaming">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:20px;">
        <h1 class="accent">🎮 Games</h1>
        <button class="btn btn-sm" onclick="app.showPage('leaderboard')">🏆 Leaderboard</button>
      </div>
      <div id="activeGame" style="display:none;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <button class="btn btn-sm" onclick="games.closeGame()">← Back</button>
          <h2 id="activeGameTitle"></h2>
          <button class="btn btn-p btn-sm" id="submitScoreBtn" onclick="games.openScoreModal()" style="margin-left:auto;">🏆 Submit Score</button>
        </div>
        <iframe id="gameFrame" style="width:100%;height:520px;border:1px solid var(--border);border-radius:var(--r);background:#000;" frameborder="0" allowfullscreen></iframe>
      </div>
      <div class="games-grid" id="gamesGrid">
        <div class="game-card" onclick="games.openGame('snake','Snake')">
          <div class="game-thumb">🐍</div>
          <div class="game-info"><h3>Snake</h3><p>Grow as long as you can</p><button class="btn btn-p btn-sm">Play</button></div>
        </div>
        <div class="game-card" onclick="games.openGame('dino','Chrome Dino')">
          <div class="game-thumb">🦕</div>
          <div class="game-info"><h3>Chrome Dino</h3><p>Jump over the cacti</p><button class="btn btn-p btn-sm">Play</button></div>
        </div>
        <div class="game-card" onclick="games.openGame('2048','2048')">
          <div class="game-thumb">🔢</div>
          <div class="game-info"><h3>2048</h3><p>Slide tiles to reach 2048</p><button class="btn btn-p btn-sm">Play</button></div>
        </div>
        <div class="game-card" onclick="games.openGame('tetris','Tetris')">
          <div class="game-thumb">🟦</div>
          <div class="game-info"><h3>Tetris</h3><p>Stack blocks, clear lines</p><button class="btn btn-p btn-sm">Play</button></div>
        </div>
        <div class="game-card" onclick="games.openGame('pacman','Pac-Man')">
          <div class="game-thumb">👻</div>
          <div class="game-info"><h3>Pac-Man</h3><p>Eat dots, dodge ghosts</p><button class="btn btn-p btn-sm">Play</button></div>
        </div>
      </div>
    </div>

    <div class="page" id="page-leaderboard">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <button class="btn btn-sm" onclick="app.showPage('gaming')">← Back</button>
        <h1 class="accent">🏆 Leaderboard</h1>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;" id="lbTabs"></div>
      <div class="card" id="lbContent"></div>
    </div>

    <div class="page" id="page-music">
      <h1 class="accent">🎵 Music</h1>
      <p class="muted" style="margin-bottom:18px;">Search SoundCloud for any track. Results load directly in the player.</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;">
        <input class="inp" id="searchInput" type="text" placeholder="Search a song or artist…" onkeydown="if(event.key==='Enter')music.searchPlay()"/>
        <button class="btn btn-p" id="musicBtn" onclick="music.searchPlay()">▶ Search</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:16px;" id="musicTabs">
        <button class="btn btn-sm btn-p" id="tab-sc" onclick="music.setMusicSource('sc')">☁️ SoundCloud</button>
        <button class="btn btn-sm" id="tab-yt" onclick="music.setMusicSource('yt')">▶ YouTube</button>
      </div>
      <div id="scSection">
        <div id="scResults" style="display:none;margin-bottom:14px;"></div>
        <div class="card" id="scPlayer" style="display:none;padding:0;overflow:hidden;">
          <iframe id="scFrame" width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
            style="border-bottom:1px solid var(--border);" src=""></iframe>
          <div class="np-info" id="scInfo"></div>
        </div>
      </div>
      <div id="ytSection" style="display:none;">
        <p class="muted" style="font-size:0.82rem;margin-bottom:10px;">Enter a YouTube URL or search term — opens the YouTube embed directly.</p>
        <div style="display:flex;gap:8px;margin-bottom:12px;">
          <input class="inp" id="ytInput" type="text" placeholder="youtube.com/watch?v=… or search term" onkeydown="if(event.key==='Enter')music.playYT()"/>
          <button class="btn btn-p btn-sm" onclick="music.playYT()">▶ Play</button>
        </div>
        <div class="card" id="ytPlayer" style="display:none;padding:0;overflow:hidden;">
          <iframe id="ytFrame" class="np-video" src="" frameborder="0" allowfullscreen allow="autoplay"></iframe>
          <div class="np-info" id="ytInfo"></div>
        </div>
      </div>
      <div id="musicHint" style="text-align:center;padding:50px 0;color:var(--muted);">
        <div style="font-size:2.8rem;margin-bottom:10px;">🎧</div>
        <p>Search a song above to start listening</p>
        <p style="font-size:0.78rem;margin-top:8px;opacity:0.6;">Powered by SoundCloud · Switch to YouTube tab for YT links</p>
      </div>
    </div>

    <div class="page" id="page-themes">
      <h1 class="accent">🎨 Themes</h1>
      <p class="muted" style="margin-bottom:20px;">Pick your vibe — changes everything instantly.</p>
      <div class="theme-grid">
        <div class="theme-sw" id="th-green" onclick="themes.applyTheme('green')" style="background:linear-gradient(135deg,#001a0d,#003319);">
          <div class="dot" style="background:radial-gradient(#00ff80,#00cc60);"></div><div class="theme-name">Neon Green</div>
        </div>
        <div class="theme-sw" id="th-cyan" onclick="themes.applyTheme('cyan')" style="background:linear-gradient(135deg,#00141a,#002633);">
          <div class="dot" style="background:radial-gradient(#00ffff,#00b3cc);"></div><div class="theme-name">Cyan</div>
        </div>
        <div class="theme-sw" id="th-purple" onclick="themes.applyTheme('purple')" style="background:linear-gradient(135deg,#0d001a,#1a0033);">
          <div class="dot" style="background:radial-gradient(#bf00ff,#8800cc);"></div><div class="theme-name">Purple</div>
        </div>
        <div class="theme-sw" id="th-pink" onclick="themes.applyTheme('pink')" style="background:linear-gradient(135deg,#1a0010,#330020);">
          <div class="dot" style="background:radial-gradient(#ff66cc,#cc0066);"></div><div class="theme-name">Pink</div>
        </div>
        <div class="theme-sw" id="th-orange" onclick="themes.applyTheme('orange')" style="background:linear-gradient(135deg,#1a0c00,#331800);">
          <div class="dot" style="background:radial-gradient(#ff8800,#cc5500);"></div><div class="theme-name">Orange</div>
        </div>
        <div class="theme-sw" id="th-red" onclick="themes.applyTheme('red')" style="background:linear-gradient(135deg,#1a0000,#330000);">
          <div class="dot" style="background:radial-gradient(#ff3333,#cc0000);"></div><div class="theme-name">Red</div>
        </div>
      </div>
    </div>

    <div class="page" id="page-profile"><div id="profileContent"></div></div>

    <div class="page" id="page-friends">
      <h1 class="accent">👥 Friends</h1>
      <div style="display:flex;gap:8px;margin:16px 0;">
        <input class="inp" id="friendSearch" placeholder="Search by display name…"/>
        <button class="btn btn-p" onclick="friends.searchFriends()">Search</button>
      </div>
      <div id="friendSearchResults" style="margin-bottom:16px;"></div>
      <h2 style="margin-bottom:12px;">Your Friends</h2>
      <div id="friendsList"></div>
    </div>

    <div class="page" id="page-notifs">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h1 class="accent">🔔 Notifications</h1>
        <button class="btn btn-sm" onclick="notifications.clearNotifs()">Clear all</button>
      </div>
      <div id="notifList"></div>
    </div>

    <div class="page" id="page-admin">
      <h1 class="accent">⚙️ Admin</h1>
      <div class="admin-grid" style="margin:16px 0;" id="adminStats"></div>
      <div class="card" style="margin-bottom:14px;">
        <h3 style="margin-bottom:12px;">📣 Site Announcement</h3>
        <div style="display:flex;gap:8px;">
          <input class="inp" id="announcementInput" placeholder="Announcement text (leave blank to clear)…"/>
          <button class="btn btn-p" onclick="admin.postAnnouncement()">Post</button>
        </div>
      </div>
      <div class="card" id="adminBans"></div>
    </div>
  `;
}

function init() {
  createPages();

  if (window.themes) window.themes.loadSavedTheme();
  if (window.music) window.music.setMusicSource('sc');
  if (window.admin) window.admin.listenAnnouncements();

  showPage('home');
}

window.app = { showPage };
window.onload = init;