import { toast } from './utils.js';

const THEMES = {
  green: { accent: '#00ff80', accent2: '#00c8ff', bg: '#030d06', s: 'rgba(0,255,100,0.07)', s2: 'rgba(0,255,100,0.13)', border: 'rgba(0,255,100,0.22)', grid: 'rgba(0,255,100,0.04)', glow: 'rgba(0,255,100,0.12)' },
  cyan: { accent: '#00ffff', accent2: '#00ff80', bg: '#00060d', s: 'rgba(0,255,255,0.07)', s2: 'rgba(0,255,255,0.13)', border: 'rgba(0,255,255,0.22)', grid: 'rgba(0,255,255,0.04)', glow: 'rgba(0,255,255,0.12)' },
  purple: { accent: '#bf00ff', accent2: '#ff00c8', bg: '#08000d', s: 'rgba(180,0,255,0.07)', s2: 'rgba(180,0,255,0.13)', border: 'rgba(180,0,255,0.22)', grid: 'rgba(180,0,255,0.04)', glow: 'rgba(180,0,255,0.12)' },
  pink: { accent: '#ff66cc', accent2: '#ff00aa', bg: '#0d0009', s: 'rgba(255,100,200,0.07)', s2: 'rgba(255,100,200,0.13)', border: 'rgba(255,100,200,0.22)', grid: 'rgba(255,100,200,0.04)', glow: 'rgba(255,100,200,0.12)' },
  orange: { accent: '#ff8800', accent2: '#ffcc00', bg: '#0d0600', s: 'rgba(255,136,0,0.07)', s2: 'rgba(255,136,0,0.13)', border: 'rgba(255,136,0,0.22)', grid: 'rgba(255,136,0,0.04)', glow: 'rgba(255,136,0,0.12)' },
  red: { accent: '#ff3333', accent2: '#ff8800', bg: '#0d0000', s: 'rgba(255,50,50,0.07)', s2: 'rgba(255,50,50,0.13)', border: 'rgba(255,50,50,0.22)', grid: 'rgba(255,50,50,0.04)', glow: 'rgba(255,50,50,0.12)' }
};

export function applyTheme(name) {
  const t = THEMES[name] || THEMES.green;
  const r = document.documentElement;
  r.style.setProperty('--accent', t.accent);
  r.style.setProperty('--accent2', t.accent2);
  r.style.setProperty('--bg', t.bg);
  r.style.setProperty('--surface', t.s);
  r.style.setProperty('--surface2', t.s2);
  r.style.setProperty('--border', t.border);
  r.style.setProperty('--grid', t.grid);
  r.style.setProperty('--glow', t.glow);
  document.body.style.backgroundColor = t.bg;
  localStorage.setItem('theme', name);
  
  document.querySelectorAll('.theme-sw').forEach(x => x.classList.remove('active'));
  document.getElementById('th-' + name)?.classList.add('active');
  toast('Theme: ' + name + ' ✓');
}

export function loadSavedTheme() {
  const saved = localStorage.getItem('theme') || 'green';
  applyTheme(saved);
}

window.themes = { applyTheme, loadSavedTheme };