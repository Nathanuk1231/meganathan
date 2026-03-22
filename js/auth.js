import { auth, db } from './config.js';
import { toast, validateUID, ts } from './utils.js';

export let currentUser = null;
export let currentProfile = null;
let isUserAdmin = false;

export function isAdmin() {
  return isUserAdmin;
}

function checkAdminStatus(uid) {
  if (!validateUID(uid)) {
    isUserAdmin = false;
    return;
  }
  
  db.ref('admins/' + uid).once('value').then(s => {
    isUserAdmin = s.val() === true;
    if (window.auth) {
      updateNav(currentUser, currentProfile);
    }
  }).catch(() => {
    isUserAdmin = false;
  });
}

export function doLogin() {
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .then(r => {
      toast('Welcome, ' + r.user.displayName + ' 👋');
      if (window.app) window.app.showPage('chat');
    })
    .catch(e => toast('Login failed: ' + e.message, 'err'));
}

export function doLogout() {
  if (currentUser) {
    db.ref('online/' + currentUser.uid).remove();
  }
  auth.signOut().then(() => {
    currentUser = null;
    currentProfile = null;
    updateNav(null);
    toast('Signed out');
    if (window.app) window.app.showPage('home');
  });
}

function ensureProfile(user) {
  if (!validateUID(user.uid)) return;
  
  db.ref('profiles/' + user.uid).once('value').then(s => {
    if (!s.exists()) {
      db.ref('profiles/' + user.uid).set({
        displayName: user.displayName || 'User',
        photoURL: user.photoURL || '',
        bio: '',
        joinedAt: ts(),
        messageCount: 0,
        streak: 0,
        lastLogin: ts(),
        uid: user.uid,
        email: user.email
      });
    } else {
      db.ref('profiles/' + user.uid).update({
        lastLogin: ts()
      });
    }
  }).catch(() => {});
}

auth.onAuthStateChanged(user => {
  currentUser = user;
  isUserAdmin = false;
  
  if (user) {
    if (!validateUID(user.uid)) {
      console.error('Invalid user UID');
      doLogout();
      return;
    }

    ensureProfile(user);
    checkAdminStatus(user.uid);
    
    db.ref('profiles/' + user.uid).once('value').then(s => {
      const profile = s.val();
      
      if (profile && profile.uid === user.uid) {
        currentProfile = profile;
        updateNav(user, profile);
        
        if (window.profile) {
          window.profile.checkStreak(user.uid);
        }
        if (window.notifications) {
          window.notifications.loadNotifCount(user.uid);
        }
        if (window.chat) {
          window.chat.loadCustomEmojis();
        }
      } else {
        updateNav(user, null);
      }
    }).catch(() => {
      updateNav(user, null);
    });

    const onRef = db.ref('online/' + user.uid);
    onRef.set({
      name: user.displayName || 'User',
      uid: user.uid,
      status: 'online',
      at: ts()
    });
    onRef.onDisconnect().remove();
  } else {
    updateNav(null);
  }
});

export function updateNav(user, p) {
  const r = document.getElementById('navRight');
  if (!r) return;
  
  if (user) {
    const photo = (p && p.photoURL) || user.photoURL || '';
    const name = (p && p.displayName) || user.displayName || 'User';
    const avHTML = photo 
      ? `<img class="nav-avatar" src="${photo}" onerror="this.style.display='none'">`
      : '<span style="font-size:1.1rem">👤</span>';
    
    r.innerHTML = `
      ${isAdmin() ? `<a onclick="app.showPage('admin')">⚙️</a>` : ''}
      <a id="notifNavBtn" class="notif-dot" data-count="0" onclick="app.showPage('notifs')" title="Notifications">🔔</a>
      <a onclick="app.showPage('profile')" style="display:flex;align-items:center;gap:6px;">${avHTML}<span style="font-size:0.8rem;color:var(--muted);">${name}</span></a>
      <button class="btn btn-d btn-sm" onclick="auth.doLogout()">Out</button>
    `;
    
    if (window.notifications && window.notifications.notifCount > 0) {
      document.getElementById('notifNavBtn')?.setAttribute('data-count', window.notifications.notifCount);
    }
  } else {
    r.innerHTML = `<button class="btn btn-p btn-sm" onclick="auth.doLogin()">Sign In</button>`;
  }
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentProfile() {
  return currentProfile;
}

export function updateCurrentProfile(updates) {
  if (currentProfile) {
    currentProfile = { ...currentProfile, ...updates };
  }
}

window.auth = { doLogin, doLogout, isAdmin, getCurrentUser, getCurrentProfile };