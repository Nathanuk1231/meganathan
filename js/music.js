import { toast, esc } from './utils.js';

let musicSource = 'sc';

export function setMusicSource(src) {
  musicSource = src;
  document.getElementById('tab-sc').className = 'btn btn-sm' + (src === 'sc' ? ' btn-p' : '');
  document.getElementById('tab-yt').className = 'btn btn-sm' + (src === 'yt' ? ' btn-p' : '');
  document.getElementById('scSection').style.display = src === 'sc' ? 'block' : 'none';
  document.getElementById('ytSection').style.display = src === 'yt' ? 'block' : 'none';
  
  const inp = document.getElementById('searchInput');
  if (inp) inp.placeholder = src === 'sc' ? 'Search SoundCloud…' : 'Search or paste YouTube URL…';
}

function formatDur(ms) {
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}

export async function searchPlay() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  
  const btn = document.getElementById('musicBtn');
  btn.textContent = '⏳ Searching…';
  btn.disabled = true;
  
  if (musicSource === 'yt') {
    await playYT();
    btn.textContent = '▶ Search';
    btn.disabled = false;
    return;
  }
  
  try {
    const res = await fetch(
      `https://api.soundcloud.com/tracks?q=${encodeURIComponent(q)}&limit=5&linked_partitioning=1&client_id=iZIs9mchVcX5lhVRyQGGAYlNPVldzAoX`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) throw new Error('SC API error');
    const data = await res.json();
    const tracks = (data.collection || data || []).filter(t => t.streamable || t.permalink_url);
    if (!tracks.length) {
      toast('No results on SoundCloud — try YouTube tab', 'warn');
      return;
    }
    showSCResults(tracks);
    playSCTrack(tracks[0]);
  } catch (e) {
    tryScEmbed(q);
  } finally {
    btn.textContent = '▶ Search';
    btn.disabled = false;
  }
}

function showSCResults(tracks) {
  const el = document.getElementById('scResults');
  el.style.display = 'block';
  el.innerHTML = tracks.slice(0, 5).map((t, i) => {
    const art = t.artwork_url ? t.artwork_url.replace('-large', '-t67x67') : '';
    const dur = t.duration ? formatDur(t.duration) : '';
    return `<div class="sc-result" onclick="music.playSCTrackByIndex(${i})">
      ${art ? `<img class="sc-art" src="${esc(art)}" onerror="this.style.display='none'">` : '<div class="sc-art"></div>'}
      <div style="min-width:0;flex:1;">
        <div class="sc-title">${esc(t.title || 'Unknown')}</div>
        <div class="sc-user">${esc(t.user && t.user.username || '')}</div>
      </div>
      ${dur ? `<span class="sc-dur">${dur}</span>` : ''}
    </div>`;
  }).join('');
  window.scLastResults = tracks;
  document.getElementById('musicHint').style.display = 'none';
}

export function playSCTrackByIndex(i) {
  if (window.scLastResults && window.scLastResults[i]) {
    playSCTrack(window.scLastResults[i]);
  }
}

export function playSCTrack(track) {
  if (!track || !track.permalink_url) return;
  const url = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(track.permalink_url) +
    '&color=%2300ff80&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false';
  document.getElementById('scFrame').src = url;
  document.getElementById('scInfo').innerHTML =
    `<div style="font-weight:700;">${esc(track.title || '')}</div>
     <div class="muted" style="font-size:0.82rem;margin-top:2px;">${esc(track.user && track.user.username || '')}</div>
     <a href="${esc(track.permalink_url)}" target="_blank" rel="noopener"
        class="btn btn-xs" style="margin-top:8px;">Open on SoundCloud ↗</a>`;
  document.getElementById('scPlayer').style.display = 'block';
  document.getElementById('musicHint').style.display = 'none';
  toast('▶ Playing: ' + (track.title || 'track'));
}

function tryScEmbed(q) {
  const url = 'https://w.soundcloud.com/player/?url=' +
    encodeURIComponent('https://soundcloud.com/search?q=' + encodeURIComponent(q)) +
    '&color=%2300ff80&auto_play=false';
  document.getElementById('scFrame').src = url;
  document.getElementById('scInfo').innerHTML =
    `<div style="font-weight:700;">${esc(q)}</div>
     <div class="muted" style="font-size:0.82rem;">SoundCloud search results</div>`;
  document.getElementById('scPlayer').style.display = 'block';
  document.getElementById('musicHint').style.display = 'none';
  toast('▶ Showing SoundCloud results for: ' + q);
}

export function playYT() {
  const raw = (document.getElementById('ytInput') || document.getElementById('searchInput')).value.trim();
  if (!raw) return;
  
  let videoId = null;
  const m = raw.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  if (m) videoId = m[1];
  
  const src = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`
    : `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(raw)}&autoplay=1`;
  
  document.getElementById('ytFrame').src = src;
  document.getElementById('ytInfo').innerHTML =
    `<div style="font-weight:700;">${esc(videoId ? 'YouTube video' : 'Search: ' + raw)}</div>
     <div class="muted" style="font-size:0.78rem;margin-top:4px;">Note: YouTube may block autoplay or embedding for some videos.</div>`;
  document.getElementById('ytPlayer').style.display = 'block';
  document.getElementById('musicHint').style.display = 'none';
  toast('▶ Loading YouTube…');
}

window.music = { setMusicSource, searchPlay, playSCTrackByIndex, playSCTrack, playYT };