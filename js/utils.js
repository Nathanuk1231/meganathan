export function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function ts() {
  return Date.now();
}

export function timeStr(t) {
  if (!t) return '';
  return new Date(t).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

export function timeAgo(t) {
  if (!t) return 'ages ago';
  const d = Date.now() - t;
  const dy = Math.floor(d / 86400000);
  if (dy < 1) return 'today';
  if (dy < 30) return dy + 'd ago';
  return Math.floor(dy / 30) + 'mo ago';
}

let toastTimer;
export function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.className = '', 3000);
}

export function validateUID(uid) {
  return uid && typeof uid === 'string' && uid.length > 0;
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  return input.trim().substring(0, maxLength);
}

export function isValidURL(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}