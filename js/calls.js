import { db } from './config.js';
import { currentUser, currentProfile } from './auth.js';
import { toast, esc, sanitizeInput, ts } from './utils.js';

let localStream = null;
let peerConnection = null;
let currentCallId = null;
let currentCallTarget = null;
let incomingCallRef = null;

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function startDMCall(targetUid, targetName) {
  if (!currentUser) { toast('Sign in first', 'err'); return; }
  initiateCall(targetUid, targetName);
}

export function startVoiceCall() {
  if (!currentUser) { toast('Sign in first', 'err'); return; }
  toast('In server voice calls, invite a friend via DM → Call instead.', 'warn');
}

async function initiateCall(targetUid, targetName) {
  const callId = db.ref('calls').push().key;
  currentCallId = callId;
  currentCallTarget = targetUid;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      toast('Camera not available — audio only', 'warn');
    } catch (e) {
      toast('Could not access microphone: ' + e.message, 'err');
      return;
    }
  }
  localStream = stream;

  showCallUI(targetName, callId, 'outgoing', stream);

  peerConnection = new RTCPeerConnection(ICE_SERVERS);
  stream.getTracks().forEach(t => peerConnection.addTrack(t, stream));

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      db.ref(`calls/${callId}/callerCandidates`).push(e.candidate.toJSON());
    }
  };

  peerConnection.ontrack = e => {
    const remoteVideo = document.getElementById('callRemoteVideo');
    if (remoteVideo) remoteVideo.srcObject = e.streams[0];
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const callerName = (currentProfile?.displayName) || currentUser.displayName || 'User';
  await db.ref('calls/' + callId).set({
    offer: { type: offer.type, sdp: offer.sdp },
    callerId: currentUser.uid,
    callerName: sanitizeInput(callerName, 30),
    targetId: targetUid,
    status: 'ringing',
    createdAt: ts()
  });

  await db.ref('incomingCall/' + targetUid).set({
    callId,
    from: currentUser.uid,
    fromName: sanitizeInput(callerName, 30),
    ts: ts()
  });

  if (window.notifications) {
    window.notifications.addNotif(targetUid, 'call', `📞 ${callerName} is calling you!`);
  }

  db.ref('calls/' + callId + '/answer').on('value', async snap => {
    const answer = snap.val();
    if (answer && peerConnection.currentRemoteDescription === null) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  });

  db.ref('calls/' + callId + '/calleeCandidates').on('child_added', async snap => {
    const candidate = snap.val();
    if (candidate) {
      try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  });

  db.ref('calls/' + callId + '/status').on('value', snap => {
    const status = snap.val();
    if (status === 'ended' || status === 'declined') endCall(false);
  });
}

export function listenForIncomingCalls() {
  if (!currentUser) return;

  if (incomingCallRef) { incomingCallRef.off(); incomingCallRef = null; }

  incomingCallRef = db.ref('incomingCall/' + currentUser.uid);
  incomingCallRef.on('value', async snap => {
    const data = snap.val();
    if (!data) return;

    db.ref('incomingCall/' + currentUser.uid).remove();
    showIncomingCallUI(data.callId, data.fromName || 'Someone');
  });
}

function showIncomingCallUI(callId, callerName) {
  removeCallUI();
  const div = document.createElement('div');
  div.id = 'callOverlay';
  div.style = 'position:fixed;bottom:24px;right:24px;z-index:9000;background:#0a1a0f;border:1px solid var(--border);border-radius:18px;padding:20px;min-width:260px;box-shadow:0 10px 40px rgba(0,0,0,0.6);backdrop-filter:blur(12px);';
  div.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <div style="font-size:1.8rem;animation:pulse 1s infinite;">📞</div>
      <div>
        <div style="font-weight:700;">${esc(callerName)} is calling…</div>
        <div style="font-size:0.78rem;color:var(--muted);">Incoming call</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-p" style="flex:1;" onclick="calls.acceptCall('${callId}')">✅ Accept</button>
      <button class="btn btn-d" style="flex:1;" onclick="calls.declineCall('${callId}')">❌ Decline</button>
    </div>
  `;
  document.body.appendChild(div);
}

function showCallUI(targetName, callId, direction, stream) {
  removeCallUI();
  const div = document.createElement('div');
  div.id = 'callOverlay';
  div.style = 'position:fixed;inset:0;z-index:9000;background:rgba(3,13,6,0.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;';
  div.innerHTML = `
    <div style="font-size:3rem;">📞</div>
    <div style="font-size:1.4rem;font-weight:700;">${esc(targetName)}</div>
    <div style="color:var(--muted);" id="callStatus">${direction === 'outgoing' ? 'Calling…' : 'Connected'}</div>
    <div style="display:flex;gap:10px;position:relative;">
      <video id="callLocalVideo" autoplay muted playsinline style="width:140px;border-radius:12px;border:1px solid var(--border);background:#000;"></video>
      <video id="callRemoteVideo" autoplay playsinline style="width:280px;border-radius:12px;border:1px solid var(--border);background:#000;"></video>
    </div>
    <div style="display:flex;gap:10px;margin-top:10px;">
      <button class="btn" id="callMuteBtn" onclick="calls.toggleMute()">🎙️ Mute</button>
      <button class="btn" id="callCamBtn" onclick="calls.toggleCam()">📷 Cam</button>
      <button class="btn btn-d" onclick="calls.endCall(true)" style="padding:10px 24px;">📵 End</button>
    </div>
  `;
  document.body.appendChild(div);

  const localVid = document.getElementById('callLocalVideo');
  if (localVid && stream) localVid.srcObject = stream;
}

export async function acceptCall(callId) {
  currentCallId = callId;
  removeCallUI();

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  } catch {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      toast('Could not access mic: ' + e.message, 'err');
      declineCall(callId);
      return;
    }
  }
  localStream = stream;

  const callSnap = await db.ref('calls/' + callId).once('value');
  const callData = callSnap.val();
  if (!callData) { toast('Call no longer active', 'err'); return; }

  showCallUI(callData.callerName, callId, 'incoming', stream);

  peerConnection = new RTCPeerConnection(ICE_SERVERS);
  stream.getTracks().forEach(t => peerConnection.addTrack(t, stream));

  peerConnection.onicecandidate = e => {
    if (e.candidate) {
      db.ref(`calls/${callId}/calleeCandidates`).push(e.candidate.toJSON());
    }
  };

  peerConnection.ontrack = e => {
    const remoteVideo = document.getElementById('callRemoteVideo');
    if (remoteVideo) remoteVideo.srcObject = e.streams[0];
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));

  db.ref('calls/' + callId + '/callerCandidates').on('child_added', async snap => {
    const candidate = snap.val();
    if (candidate) {
      try { await peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  });

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  await db.ref('calls/' + callId).update({
    answer: { type: answer.type, sdp: answer.sdp },
    status: 'active'
  });

  db.ref('calls/' + callId + '/status').on('value', snap => {
    if (snap.val() === 'ended') endCall(false);
  });

  const statusEl = document.getElementById('callStatus');
  if (statusEl) statusEl.textContent = 'Connected ✓';
}

export function declineCall(callId) {
  db.ref('calls/' + callId).update({ status: 'declined' });
  removeCallUI();
}

export function endCall(notify = true) {
  if (notify && currentCallId) {
    db.ref('calls/' + currentCallId).update({ status: 'ended' }).catch(() => {});
  }

  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }

  if (currentCallId) {
    db.ref('calls/' + currentCallId).off();
    db.ref('calls/' + currentCallId + '/calleeCandidates').off();
    db.ref('calls/' + currentCallId + '/callerCandidates').off();
    currentCallId = null;
  }

  removeCallUI();
}

function removeCallUI() {
  document.getElementById('callOverlay')?.remove();
}

export function toggleMute() {
  if (!localStream) return;
  const audioTrack = localStream.getAudioTracks()[0];
  if (!audioTrack) return;
  audioTrack.enabled = !audioTrack.enabled;
  const btn = document.getElementById('callMuteBtn');
  if (btn) btn.textContent = audioTrack.enabled ? '🎙️ Mute' : '🔇 Unmute';
}

export function toggleCam() {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;
  videoTrack.enabled = !videoTrack.enabled;
  const btn = document.getElementById('callCamBtn');
  if (btn) btn.textContent = videoTrack.enabled ? '📷 Cam' : '📷 Cam Off';
}

window.calls = { startDMCall, startVoiceCall, acceptCall, declineCall, endCall, toggleMute, toggleCam, listenForIncomingCalls };