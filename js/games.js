import { db, GAME_URLS, GAME_NAMES } from './config.js';
import { currentUser, currentProfile } from './auth.js';
import { toast, esc, validateUID, timeAgo, ts } from './utils.js';

let currentGame = '';
let lbGame = 'snake';

export function openGame(id, title) {
  document.getElementById('gamesGrid').style.display = 'none';
  document.getElementById('activeGame').style.display = 'block';
  document.getElementById('activeGameTitle').textContent = title;
  document.getElementById('gameFrame').src = GAME_URLS[id] || '';
  currentGame = id;
}

export function closeGame() {
  document.getElementById('gamesGrid').style.display = 'grid';
  document.getElementById('activeGame').style.display = 'none';
  document.getElementById('gameFrame').src = '';
  currentGame = '';
}

export function openScoreModal() {
  if (!currentUser) {
    toast('Sign in to submit scores', 'err');
    return;
  }
  
  const modal = document.getElementById('scoreModal');
  if (!modal) createScoreModal();
  
  document.getElementById('scoreGameName').textContent = document.getElementById('activeGameTitle').textContent;
  document.getElementById('scoreInput').value = '';
  document.getElementById('scoreModal').classList.add('open');
}

function createScoreModal() {
  const modals = document.getElementById('modals');
  const div = document.createElement('div');
  div.id = 'scoreModal';
  div.className = 'mb';
  div.onclick = (e) => { if (e.target === div) closeScoreModal(); };
  div.innerHTML = `
    <div class="modal">
      <h2>🏆 Submit Score</h2>
      <p class="muted" style="margin-bottom:14px;font-size:0.88rem;">Enter your score for <strong id="scoreGameName"></strong></p>
      <input class="inp" id="scoreInput" type="number" placeholder="Your score…" min="0"/>
      <div class="modal-foot">
        <button class="btn" onclick="games.closeScoreModal()">Cancel</button>
        <button class="btn btn-p" onclick="games.submitScore()">Submit</button>
      </div>
    </div>
  `;
  modals.appendChild(div);
}

export function closeScoreModal() {
  document.getElementById('scoreModal').classList.remove('open');
}

export function submitScore() {
  if (!currentUser) return;
  
  const score = parseInt(document.getElementById('scoreInput').value);
  if (isNaN(score) || score < 0) {
    toast('Enter a valid score', 'err');
    return;
  }
  
  const name = (currentProfile && currentProfile.displayName) || currentUser.displayName || 'User';
  const photo = (currentProfile && currentProfile.photoURL) || currentUser.photoURL || '';
  const ref = db.ref('leaderboard/' + currentGame + '/' + currentUser.uid);
  
  ref.once('value').then(s => {
    const existing = s.val();
    if (!existing || score > existing.score) {
      ref.set({
        score,
        name,
        photo,
        uid: currentUser.uid,
        at: ts()
      });
      toast('Score submitted! 🏆');
    } else {
      toast('Your best is already ' + existing.score, 'warn');
    }
  }).catch(e => toast('Failed: ' + e.message, 'err'));
  
  closeScoreModal();
}

export function loadLeaderboard() {
  const tabs = document.getElementById('lbTabs');
  tabs.innerHTML = Object.entries(GAME_NAMES).map(([id, name]) =>
    `<button class="btn btn-sm ${id === lbGame ? 'btn-p' : ''}" onclick="games.switchLb('${id}')">${name}</button>`
  ).join('');
  loadLbGame(lbGame);
}

export function switchLb(id) {
  lbGame = id;
  loadLeaderboard();
}

function loadLbGame(id) {
  const el = document.getElementById('lbContent');
  el.innerHTML = '<p class="muted">Loading…</p>';
  
  db.ref('leaderboard/' + id).orderByChild('score').limitToLast(20).once('value').then(s => {
    const rows = [];
    s.forEach(c => rows.push(c.val()));
    rows.sort((a, b) => b.score - a.score);
    
    if (!rows.length) {
      el.innerHTML = '<p class="muted">No scores yet — be the first!</p>';
      return;
    }
    
    el.innerHTML = `<h3 style="margin-bottom:12px;">${GAME_NAMES[id]} Top Scores</h3>
    <table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Score</th><th>Date</th></tr></thead>
    <tbody>${rows.map((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
      const cls = i === 0 ? 'lb-gold' : i === 1 ? 'lb-silver' : i === 2 ? 'lb-bronze' : '';
      return `<tr><td class="lb-rank ${cls}">${medal || i + 1}</td>
        <td style="cursor:pointer;" onclick="profile.viewProfile('${r.uid}')">${esc(r.name)}</td>
        <td class="lb-score">${r.score.toLocaleString()}</td>
        <td class="muted" style="font-size:0.75rem;">${timeAgo(r.at)}</td></tr>`;
    }).join('')}</tbody></table>`;
  }).catch(() => el.innerHTML = '<p class="muted">Could not load scores — check Firebase rules.</p>');
}

window.games = { openGame, closeGame, openScoreModal, closeScoreModal, submitScore, loadLeaderboard, switchLb };