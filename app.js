import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjJpDGmYUz01Fs7Ld2aegsH1eyq12T0JA",
  authDomain: "familia-app-36d1b.firebaseapp.com",
  projectId: "familia-app-36d1b",
  storageBucket: "familia-app-36d1b.firebasestorage.app",
  messagingSenderId: "340253404823",
  appId: "1:340253404823:web:49468ed89e68e6807f03d2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================
// SPLASH
// ============================================
function hideSplash() {
  const splash = document.getElementById('splash-screen');
  if (!splash) return;
  splash.classList.add('fade-out');
  setTimeout(() => splash.remove(), 500);
}
setTimeout(hideSplash, 3000);

// ============================================
// SCREEN MANAGER
// ============================================
function showScreen(id) {
  document.querySelectorAll('[id$="-screen"]').forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('flex');
  });
  const el = document.getElementById(id);
  if (el) { el.classList.remove('hidden'); el.classList.add('flex'); }
}

// ============================================
// FAMILY ID
// ============================================
function getFamilyId() {
  return localStorage.getItem('familyCode') || 'default';
}

// ============================================
// PIN — Firestore per user
// ============================================
async function getStoredPin() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists() && snap.data().pin) return snap.data().pin;
  } catch (e) {}
  return null;
}

async function savePin(newPin) {
  const user = auth.currentUser;
  if (!user) return;
  await updateDoc(doc(db, 'users', user.uid), { pin: newPin });
}

// ============================================
// SOS SIREN
// ============================================
let sirenInterval = null, sirenCtx = null, sosActive = false;

function startSiren() {
  sirenCtx = new (window.AudioContext || window.webkitAudioContext)();
  sirenCtx.resume().then(() => {
    let toggle = false;
    sirenInterval = setInterval(() => {
      const osc = sirenCtx.createOscillator();
      const gain = sirenCtx.createGain();
      osc.connect(gain);
      gain.connect(sirenCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(toggle ? 880 : 440, sirenCtx.currentTime);
      osc.frequency.linearRampToValueAtTime(toggle ? 440 : 880, sirenCtx.currentTime + 0.4);
      gain.gain.setValueAtTime(1, sirenCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, sirenCtx.currentTime + 0.45);
      osc.start(sirenCtx.currentTime);
      osc.stop(sirenCtx.currentTime + 0.45);
      toggle = !toggle;
    }, 450);
  });
}

function stopSiren() {
  if (sirenInterval) clearInterval(sirenInterval);
  if (sirenCtx) sirenCtx.close();
  sirenCtx = null; sirenInterval = null;
}

document.getElementById('sos-btn').addEventListener('click', () => {
  const btn = document.getElementById('sos-btn');
  if (!sosActive) {
    sosActive = true;
    startSiren();
    btn.classList.add('animate-pulse');
    btn.innerHTML = `<span class="material-symbols-outlined text-3xl icon-filled">emergency</span><span class="text-xl font-bold tracking-wide">TAP TO STOP SOS</span>`;
    if (auth.currentUser) {
      navigator.geolocation.getCurrentPosition(pos => {
        addDoc(collection(db, 'families', getFamilyId(), 'sos_alerts'), {
          triggeredBy: auth.currentUser.displayName || auth.currentUser.email,
          uid: auth.currentUser.uid,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: serverTimestamp()
        });
      });
    }
    setTimeout(() => { window.location.href = 'tel:112'; }, 800);
  } else {
    sosActive = false;
    stopSiren();
    btn.classList.remove('animate-pulse');
    btn.innerHTML = `<span class="material-symbols-outlined text-3xl icon-filled">emergency</span><span class="text-xl font-bold tracking-wide">SOS EMERGENCY</span>`;
  }
});

// ============================================
// AUTH TOGGLE
// ============================================
document.getElementById('toggle-auth-mode').addEventListener('click', () => {
  const isLogin = document.getElementById('auth-title').textContent === 'Welcome Back';
  document.getElementById('auth-title').textContent = isLogin ? 'Join Familia' : 'Welcome Back';
  document.getElementById('auth-submit-btn').textContent = isLogin ? 'Create Account' : 'Login';
  document.getElementById('toggle-auth-mode').textContent = isLogin ? 'Already have an account? Login' : "Don't have an account? Sign Up";
  document.getElementById('name-field').classList.toggle('hidden', !isLogin);
  document.getElementById('family-code-field').classList.toggle('hidden', !isLogin);
  document.getElementById('forgot-password-btn').classList.toggle('hidden', isLogin);
  document.getElementById('auth-error').textContent = '';
  document.getElementById('reset-success').classList.add('hidden');
});

// ============================================
// SIGNUP / LOGIN
// ============================================
document.getElementById('auth-submit-btn').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const isSignup = document.getElementById('auth-title').textContent === 'Join Familia';
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('auth-submit-btn');
  errEl.textContent = '';

  try {
    if (isSignup) {
      const name = document.getElementById('auth-name').value.trim();
      const familyCode = document.getElementById('auth-family-code').value.trim().toLowerCase().replace(/\s/g, '');
      const familyCodeConfirm = document.getElementById('auth-family-code-confirm').value.trim().toLowerCase().replace(/\s/g, '');

      if (!name) { errEl.textContent = 'Naam daalo.'; return; }
      if (!familyCode) { errEl.textContent = 'Family code daalo.'; return; }
      if (familyCode !== familyCodeConfirm) { errEl.textContent = 'Dono family codes match nahi kar rahe!'; return; }
      if (!/^[a-z0-9]+$/.test(familyCode)) { errEl.textContent = 'Sirf lowercase letters aur numbers allowed hain.'; return; }

      btn.textContent = 'Please wait...';
      btn.disabled = true;

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });

      const familyMeta = await getDoc(doc(db, 'families', familyCode, 'meta', 'info'));

      if (!familyMeta.exists()) {
        const confirmed = confirm(`"${familyCode}" family exist nahi karti.\n\nNaya family dashboard banana chahte ho?`);
        if (!confirmed) {
          await cred.user.delete();
          btn.textContent = 'Create Account';
          btn.disabled = false;
          errEl.textContent = 'Signup cancel kiya. Sahi family code dobara try karo.';
          return;
        }
        await setDoc(doc(db, 'families', familyCode, 'meta', 'info'), {
          createdBy: cred.user.uid, createdAt: serverTimestamp(), adminUid: cred.user.uid
        });
        await setDoc(doc(db, 'families', familyCode, 'members', cred.user.uid), {
          name, email, uid: cred.user.uid, role: 'admin', status: 'active', joinedAt: serverTimestamp()
        });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name, email, familyCode, uid: cred.user.uid, role: 'admin', status: 'active'
        });
        localStorage.setItem('familyCode', familyCode);

      } else {
        await setDoc(doc(db, 'families', familyCode, 'join_requests', cred.user.uid), {
          name, email, uid: cred.user.uid, requestedAt: serverTimestamp(), status: 'pending'
        });
        await setDoc(doc(db, 'users', cred.user.uid), {
          name, email, familyCode, uid: cred.user.uid, role: 'member', status: 'pending'
        });
        localStorage.setItem('familyCode', familyCode);
        localStorage.setItem('memberStatus', 'pending');
      }

      btn.textContent = 'Create Account';
      btn.disabled = false;

    } else {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!localStorage.getItem('familyCode')) {
        const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
        if (userDoc.exists()) {
          localStorage.setItem('familyCode', userDoc.data().familyCode);
          if (userDoc.data().status === 'pending') localStorage.setItem('memberStatus', 'pending');
        }
      }
    }
  } catch (e) {
    btn.textContent = isSignup ? 'Create Account' : 'Login';
    btn.disabled = false;
    errEl.textContent = e.message.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, '');
  }
});

// ============================================
// FORGOT PASSWORD
// ============================================
document.getElementById('forgot-password-btn').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const errEl = document.getElementById('auth-error');
  const successEl = document.getElementById('reset-success');
  errEl.textContent = '';
  successEl.classList.add('hidden');
  if (!email) { errEl.textContent = 'Pehle email daalo.'; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    successEl.classList.remove('hidden');
  } catch (e) {
    errEl.textContent = e.message.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, '');
  }
});

// ============================================
// AUTH STATE
// ============================================
onAuthStateChanged(auth, async (user) => {
  hideSplash();
  if (user) {
    if (!localStorage.getItem('familyCode')) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        localStorage.setItem('familyCode', userDoc.data().familyCode);
        if (userDoc.data().status === 'pending') localStorage.setItem('memberStatus', 'pending');
      }
    }

    const status = localStorage.getItem('memberStatus');

    if (status === 'pending') {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().status === 'active') {
        localStorage.removeItem('memberStatus');
        const pin = await getStoredPin();
        if (!pin) {
          showScreen('pin-setup-screen');
          setupPinSetupScreen();
        } else {
          showScreen('pin-screen');
          setupPinScreen();
        }
      } else {
        showScreen('pending-screen');
        document.getElementById('pending-family-code').textContent = getFamilyId();
        listenForApproval(user);
      }
    } else {
      const pin = await getStoredPin();
      if (!pin) {
        showScreen('pin-setup-screen');
        setupPinSetupScreen();
      } else {
        showScreen('pin-screen');
        setupPinScreen();
      }
    }
  } else {
    showScreen('auth-screen');
  }
});

// ============================================
// LISTEN FOR APPROVAL
// ============================================
function listenForApproval(user) {
  const unsub = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
    if (snap.exists() && snap.data().status === 'active') {
      localStorage.removeItem('memberStatus');
      unsub();
      const pin = await getStoredPin();
      if (!pin) {
        showScreen('pin-setup-screen');
        setupPinSetupScreen();
      } else {
        showScreen('pin-screen');
        setupPinScreen();
      }
    }
  });
}

// ============================================
// CANCEL JOIN REQUEST
// ============================================
document.getElementById('cancel-join-request-btn').addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await deleteDoc(doc(db, 'families', getFamilyId(), 'join_requests', user.uid));
    await updateDoc(doc(db, 'users', user.uid), { status: 'cancelled', familyCode: null });
  } catch (e) {}
  localStorage.removeItem('familyCode');
  localStorage.removeItem('memberStatus');
  await signOut(auth);
});

// ============================================
// PIN SCREEN (enter existing PIN)
// ============================================
function setupPinScreen() {
  let pinEntry = '';
  const pinInputs = document.querySelectorAll('.pin-dot');
  const pinErrorEl = document.getElementById('pin-error');
  pinInputs.forEach(i => { i.value = ''; i.style.borderColor = ''; });
  if (pinErrorEl) pinErrorEl.textContent = '';

  function updateDots() {
    pinInputs.forEach((inp, idx) => {
      inp.value = idx < pinEntry.length ? '•' : '';
      inp.style.borderColor = idx < pinEntry.length ? '#7BAE9A' : '';
    });
  }

  async function checkPin() {
    const stored = await getStoredPin();
    if (pinEntry === stored) {
      pinInputs.forEach(i => { i.style.borderColor = '#22c55e'; });
      setTimeout(() => { showScreen('dashboard-screen'); loadDashboard(); }, 350);
    } else {
      if (pinErrorEl) pinErrorEl.textContent = 'Galat PIN. Try again.';
      pinInputs.forEach(i => { i.style.borderColor = '#ef4444'; });
      pinEntry = '';
      setTimeout(() => {
        pinInputs.forEach(i => { i.style.borderColor = ''; i.value = ''; });
        if (pinErrorEl) pinErrorEl.textContent = '';
      }, 800);
    }
  }

  document.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.onclick = () => {
      if (pinEntry.length < 4) { pinEntry += btn.textContent.trim(); updateDots(); }
      if (pinEntry.length === 4) setTimeout(checkPin, 150);
    };
  });

  const backBtn = document.querySelector('.backspace-btn');
  if (backBtn) backBtn.onclick = () => {
    if (pinEntry.length > 0) { pinEntry = pinEntry.slice(0, -1); updateDots(); }
    if (pinErrorEl) pinErrorEl.textContent = '';
  };
}

// ============================================
// PIN SETUP (naye user ke liye)
// ============================================
function setupPinSetupScreen() {
  let firstPin = '';
  let confirmPin = '';
  let isConfirming = false;

  const dots = document.querySelectorAll('.pin-setup-dot');
  const titleEl = document.getElementById('pin-setup-title');
  const subtitleEl = document.getElementById('pin-setup-subtitle');
  const errorEl = document.getElementById('pin-setup-error');

  // Reset state freshly
  firstPin = ''; confirmPin = ''; isConfirming = false;
  dots.forEach(d => { d.value = ''; d.style.borderColor = ''; });
  if (titleEl) titleEl.textContent = 'Set Your PIN';
  if (subtitleEl) subtitleEl.textContent = 'Choose a 4-digit PIN to secure Familia.';
  if (errorEl) errorEl.textContent = '';

  function resetDots() {
    dots.forEach(d => { d.value = ''; d.style.borderColor = ''; });
  }

  function updateDots(entry) {
    dots.forEach((d, i) => {
      d.value = i < entry.length ? '•' : '';
      d.style.borderColor = i < entry.length ? '#7BAE9A' : '';
    });
  }

  document.querySelectorAll('.pin-setup-btn').forEach(btn => {
    btn.onclick = () => {
      if (isConfirming) {
        if (confirmPin.length >= 4) return;
        confirmPin += btn.textContent.trim();
        updateDots(confirmPin);
        if (confirmPin.length === 4) {
          setTimeout(async () => {
            if (firstPin === confirmPin) {
              dots.forEach(d => { d.style.borderColor = '#22c55e'; });
              await savePin(firstPin);
              setTimeout(() => { showScreen('dashboard-screen'); loadDashboard(); }, 400);
            } else {
              if (errorEl) errorEl.textContent = 'PINs match nahi kiye. Dobara try karo.';
              dots.forEach(d => { d.style.borderColor = '#ef4444'; });
              setTimeout(() => {
                firstPin = ''; confirmPin = ''; isConfirming = false;
                resetDots();
                if (titleEl) titleEl.textContent = 'Set Your PIN';
                if (subtitleEl) subtitleEl.textContent = 'Choose a 4-digit PIN to secure Familia.';
                if (errorEl) errorEl.textContent = '';
              }, 900);
            }
          }, 150);
        }
      } else {
        if (firstPin.length >= 4) return;
        firstPin += btn.textContent.trim();
        updateDots(firstPin);
        if (firstPin.length === 4) {
          setTimeout(() => {
            isConfirming = true;
            confirmPin = '';
            resetDots();
            if (titleEl) titleEl.textContent = 'Confirm PIN';
            if (subtitleEl) subtitleEl.textContent = 'Dobara wahi PIN daalo to confirm karo.';
            if (errorEl) errorEl.textContent = '';
          }, 200);
        }
      }
    };
  });

  const backBtn = document.querySelector('.pin-setup-backspace');
  if (backBtn) backBtn.onclick = () => {
    if (isConfirming) {
      confirmPin = confirmPin.slice(0, -1);
      updateDots(confirmPin);
    } else {
      firstPin = firstPin.slice(0, -1);
      updateDots(firstPin);
    }
    if (errorEl) errorEl.textContent = '';
  };
}

// ============================================
// LOGOUT
// ============================================
async function handleLogout() {
  stopSiren();
  localStorage.removeItem('familyCode');
  localStorage.removeItem('memberStatus');
  await signOut(auth);
}
document.getElementById('logout-btn').addEventListener('click', handleLogout);
document.getElementById('logout-dash-btn').addEventListener('click', handleLogout);
document.getElementById('logout-settings-btn').addEventListener('click', handleLogout);

// ============================================
// DASHBOARD
// ============================================
function loadDashboard() {
  const user = auth.currentUser;
  if (!user) return;
  const name = user.displayName || 'Friend';
  document.getElementById('dash-username').textContent = `Hi, ${name}`;
  document.getElementById('dash-avatar').textContent = name[0].toUpperCase();
  loadTodayMood();
  loadTasks('tasks-list');
  loadFamilyMembers();
  loadJoinRequests();
}

// ============================================
// JOIN REQUESTS (admin only)
// ============================================
function loadJoinRequests() {
  const user = auth.currentUser;
  if (!user) return;
  getDoc(doc(db, 'users', user.uid)).then(snap => {
    if (!snap.exists() || snap.data().role !== 'admin') return;
    onSnapshot(
      query(collection(db, 'families', getFamilyId(), 'join_requests'), where('status', '==', 'pending')),
      (snap) => {
        const banner = document.getElementById('join-requests-banner');
        const list = document.getElementById('join-requests-list');
        const count = document.getElementById('join-requests-count');
        if (!banner || !list) return;
        if (snap.empty) { banner.classList.add('hidden'); return; }
        banner.classList.remove('hidden');
        count.textContent = snap.size;
        list.innerHTML = '';
        snap.forEach(docSnap => {
          const req = docSnap.data();
          list.innerHTML += `
            <div class="flex items-center justify-between bg-white rounded-xl px-3 py-2.5 border border-amber-100">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm">${req.name[0].toUpperCase()}</div>
                <div>
                  <p class="font-semibold text-slate-800 text-sm">${req.name}</p>
                  <p class="text-xs text-slate-400">${req.email}</p>
                </div>
              </div>
              <div class="flex gap-2">
                <button onclick="approveRequest('${req.uid}','${req.name}','${req.email}')"
                  class="w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-200 flex items-center justify-center active:scale-90">
                  <span class="material-symbols-outlined text-sm">check</span>
                </button>
                <button onclick="denyRequest('${req.uid}')"
                  class="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center active:scale-90">
                  <span class="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>
          `;
        });
      }
    );
  });
}

window.approveRequest = async (uid, name, email) => {
  const familyCode = getFamilyId();
  await updateDoc(doc(db, 'families', familyCode, 'join_requests', uid), { status: 'approved' });
  await setDoc(doc(db, 'families', familyCode, 'members', uid), {
    name, email, uid, role: 'member', status: 'active', joinedAt: serverTimestamp()
  });
  await updateDoc(doc(db, 'users', uid), { status: 'active' });
};

window.denyRequest = async (uid) => {
  if (!confirm('Request deny karo?')) return;
  await updateDoc(doc(db, 'families', getFamilyId(), 'join_requests', uid), { status: 'denied' });
  await updateDoc(doc(db, 'users', uid), { status: 'denied', familyCode: null });
};

// ============================================
// SETTINGS
// ============================================
function loadSettings() {
  const user = auth.currentUser;
  if (!user) return;
  const name = user.displayName || 'Friend';
  document.getElementById('settings-avatar').textContent = name[0].toUpperCase();
  document.getElementById('settings-name').textContent = name;
  document.getElementById('settings-email').textContent = user.email;
  document.getElementById('settings-family').textContent = `Family: ${getFamilyId()}`;
  document.getElementById('current-family-code-display').textContent = getFamilyId();
}

document.getElementById('change-pin-btn').addEventListener('click', async () => {
  const currentPin = document.getElementById('current-pin').value.trim();
  const newPin = document.getElementById('new-pin').value.trim();
  const confirmPin = document.getElementById('confirm-pin').value.trim();
  const errEl = document.getElementById('pin-change-error');
  errEl.style.color = '';
  errEl.textContent = '';

  if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin) || !/^\d{4}$/.test(confirmPin)) {
    errEl.textContent = 'Sab fields mein exactly 4 digits daalo.'; return;
  }
  if (newPin !== confirmPin) { errEl.textContent = 'New PIN aur Confirm PIN match nahi.'; return; }
  const stored = await getStoredPin();
  if (currentPin !== stored) { errEl.textContent = 'Current PIN galat hai.'; return; }
  await savePin(newPin);
  errEl.style.color = '#22c55e';
  errEl.textContent = 'PIN update ho gaya! ✓';
  document.getElementById('current-pin').value = '';
  document.getElementById('new-pin').value = '';
  document.getElementById('confirm-pin').value = '';
  setTimeout(() => { errEl.textContent = ''; errEl.style.color = ''; }, 2500);
});

document.getElementById('change-family-code-btn').addEventListener('click', async () => {
  const newCode = document.getElementById('new-family-code').value.trim().toLowerCase().replace(/\s/g, '');
  const confirmCode = document.getElementById('new-family-code-confirm').value.trim().toLowerCase().replace(/\s/g, '');
  const errEl = document.getElementById('family-code-change-error');
  errEl.style.color = '';
  errEl.textContent = '';

  if (!newCode) { errEl.textContent = 'Naya code daalo.'; return; }
  if (newCode === getFamilyId()) { errEl.textContent = 'Yeh toh same code hai!'; return; }
  if (newCode !== confirmCode) { errEl.textContent = 'Dono codes match nahi kar rahe.'; return; }
  if (!/^[a-z0-9]+$/.test(newCode)) { errEl.textContent = 'Sirf lowercase letters aur numbers.'; return; }

  const user = auth.currentUser;
  const newFamilySnap = await getDoc(doc(db, 'families', newCode, 'meta', 'info'));
  if (newFamilySnap.exists()) { errEl.textContent = 'Yeh code pehle se exist karta hai.'; return; }

  const oldMemberSnap = await getDoc(doc(db, 'families', getFamilyId(), 'members', user.uid));
  const memberData = oldMemberSnap.exists() ? oldMemberSnap.data() : {};

  await setDoc(doc(db, 'families', newCode, 'meta', 'info'), {
    createdBy: user.uid, createdAt: serverTimestamp(), adminUid: user.uid
  });
  await setDoc(doc(db, 'families', newCode, 'members', user.uid), { ...memberData, role: 'admin' });
  await updateDoc(doc(db, 'users', user.uid), { familyCode: newCode, role: 'admin' });
  localStorage.setItem('familyCode', newCode);

  document.getElementById('new-family-code').value = '';
  document.getElementById('new-family-code-confirm').value = '';
  errEl.style.color = '#22c55e';
  errEl.textContent = `Code "${newCode}" set ho gaya! ✓`;
  loadSettings();
  setTimeout(() => { errEl.textContent = ''; errEl.style.color = ''; }, 3000);
});

// ============================================
// MOOD
// ============================================
function loadTodayMood() {
  const today = new Date().toISOString().split('T')[0];
  onSnapshot(doc(db, 'families', getFamilyId(), 'moods', today), (snap) => {
    if (!snap.exists()) return;
    const mood = snap.data().mood;
    document.querySelectorAll('.mood-btn').forEach(btn => {
      const circle = btn.querySelector('.mood-circle');
      if (!circle) return;
      circle.className = btn.dataset.mood === mood
        ? 'mood-circle w-12 h-12 rounded-full bg-accent-pink border-2 border-accent-pink-dark flex items-center justify-center text-2xl scale-110 shadow-sm transition-all'
        : 'mood-circle w-12 h-12 rounded-full bg-white flex items-center justify-center text-2xl border border-pink-100 transition-all';
    });
    const timeEl = document.getElementById('mood-time');
    if (timeEl) timeEl.textContent = `Updated ${snap.data().time}`;
  });
}

document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    await setDoc(doc(db, 'families', getFamilyId(), 'moods', today), {
      mood: btn.dataset.mood, time, updatedBy: auth.currentUser?.displayName, updatedAt: serverTimestamp()
    });
  });
});

// ============================================
// TASKS
// ============================================
let tasksUnsub = null;

function loadTasks(containerId) {
  if (tasksUnsub) tasksUnsub();
  const today = new Date().toISOString().split('T')[0];
  tasksUnsub = onSnapshot(
    query(collection(db, 'families', getFamilyId(), 'tasks'), where('date', '==', today)),
    (snap) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      if (snap.empty) {
        container.innerHTML = `<p class="text-center text-slate-400 py-8">Aaj koi task nahi. Add karo! 🎉</p>`;
        return;
      }
      const docs = [];
      snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
      docs.sort((a, b) => a.time > b.time ? 1 : -1);
      docs.forEach(task => {
        container.innerHTML += `
          <div class="${task.done ? 'opacity-60 bg-white/60 border-slate-200' : 'bg-surface-pink border-l-4 border-primary'} rounded-xl p-4 shadow-sm border mb-3 transition-all">
            <div class="flex items-center justify-between">
              <div class="flex gap-3 items-center">
                <div class="w-10 h-10 rounded-full ${task.done ? 'bg-slate-100 text-slate-400' : 'bg-white text-primary'} flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined icon-filled">task_alt</span>
                </div>
                <div>
                  <h4 class="font-bold ${task.done ? 'text-slate-400 line-through' : 'text-slate-800'}">${task.title}</h4>
                  <p class="text-xs text-slate-500">${task.time}${task.note ? ' • ' + task.note : ''}</p>
                </div>
              </div>
              <div class="flex gap-2">
                ${!task.done
                  ? `<button onclick="markTaskDone('${task.id}')" class="w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors active:scale-90"><span class="material-symbols-outlined text-sm">check</span></button>`
                  : `<div class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><span class="material-symbols-outlined text-sm">check</span></div>`
                }
                <button onclick="deleteTask('${task.id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center active:scale-90"><span class="material-symbols-outlined text-sm">delete</span></button>
              </div>
            </div>
          </div>
        `;
      });
    }
  );
}

window.markTaskDone = async (id) => {
  await updateDoc(doc(db, 'families', getFamilyId(), 'tasks', id), { done: true, doneAt: serverTimestamp() });
};
window.deleteTask = async (id) => {
  await deleteDoc(doc(db, 'families', getFamilyId(), 'tasks', id));
};

document.getElementById('add-task-btn').addEventListener('click', async () => {
  const title = document.getElementById('task-title').value.trim();
  const time = document.getElementById('task-time').value;
  const note = document.getElementById('task-note').value.trim();
  if (!title || !time) { alert('Task naam aur time dono chahiye!'); return; }
  const today = new Date().toISOString().split('T')[0];
  await addDoc(collection(db, 'families', getFamilyId(), 'tasks'), {
    title, time, note, done: false, date: today,
    createdBy: auth.currentUser?.displayName, createdAt: serverTimestamp()
  });
  document.getElementById('task-title').value = '';
  document.getElementById('task-time').value = '';
  document.getElementById('task-note').value = '';
  closeModal('add-task-modal');
});

// ============================================
// MEDICATIONS
// ============================================
function loadMeds() {
  onSnapshot(collection(db, 'families', getFamilyId(), 'medications'), (snap) => {
    const container = document.getElementById('meds-list');
    if (!container) return;
    container.innerHTML = '';
    if (snap.empty) {
      container.innerHTML = `<p class="text-center text-slate-400 py-8">Koi medication nahi. Add karo!</p>`;
      return;
    }
    snap.forEach(docSnap => {
      const med = docSnap.data();
      const id = docSnap.id;
      const lowStock = med.stock <= 5;
      container.innerHTML += `
        <div class="bg-white rounded-xl p-4 shadow-sm border ${lowStock ? 'border-red-200 bg-red-50/30' : 'border-slate-100'} mb-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full ${lowStock ? 'bg-red-100 text-red-500' : 'bg-primary/10 text-primary'} flex items-center justify-center">
                <span class="material-symbols-outlined icon-filled">pill</span>
              </div>
              <div>
                <h4 class="font-bold text-slate-800">${med.name}</h4>
                <p class="text-sm text-slate-500">${med.dosage} • ${med.frequency}</p>
                <p class="text-xs ${lowStock ? 'text-red-500 font-semibold' : 'text-slate-400'}">${lowStock ? '⚠️ ' : ''}${med.stock} pills left</p>
              </div>
            </div>
            <div class="flex gap-2">
              <button onclick="decrementMed('${id}', ${med.stock})" class="w-8 h-8 rounded-full bg-orange-50 text-orange-500 hover:bg-orange-100 flex items-center justify-center active:scale-90">
                <span class="material-symbols-outlined text-sm">remove</span>
              </button>
              <button onclick="deleteMed('${id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center active:scale-90">
                <span class="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          </div>
        </div>
      `;
    });
  });
}

window.decrementMed = async (id, stock) => {
  if (stock <= 0) { alert('Stock khatam! Refill karo.'); return; }
  await updateDoc(doc(db, 'families', getFamilyId(), 'medications', id), { stock: stock - 1 });
};
window.deleteMed = async (id) => {
  if (confirm('Delete karo?')) await deleteDoc(doc(db, 'families', getFamilyId(), 'medications', id));
};

document.getElementById('add-med-btn').addEventListener('click', async () => {
  const name = document.getElementById('med-name').value.trim();
  const dosage = document.getElementById('med-dosage').value.trim();
  const frequency = document.getElementById('med-frequency').value;
  const stock = parseInt(document.getElementById('med-stock').value);
  if (!name || !dosage || isNaN(stock)) { alert('Saari details bharo!'); return; }
  await addDoc(collection(db, 'families', getFamilyId(), 'medications'), {
    name, dosage, frequency, stock, addedBy: auth.currentUser?.displayName, addedAt: serverTimestamp()
  });
  document.getElementById('med-name').value = '';
  document.getElementById('med-dosage').value = '';
  document.getElementById('med-stock').value = '';
  closeModal('add-med-modal');
});

// ============================================
// CHAT
// ============================================
let chatUnsub = null;

function loadChat() {
  if (chatUnsub) chatUnsub();
  chatUnsub = onSnapshot(
    query(collection(db, 'families', getFamilyId(), 'messages'), orderBy('sentAt')),
    (snap) => {
      const container = document.getElementById('chat-messages');
      if (!container) return;
      container.innerHTML = '';
      snap.forEach(docSnap => {
        const msg = docSnap.data();
        const isMe = msg.uid === auth.currentUser?.uid;
        const time = msg.sentAt?.toDate ? msg.sentAt.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
        container.innerHTML += `
          <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-3">
            <div class="max-w-[75%]">
              ${!isMe ? `<p class="text-xs text-slate-500 mb-1 ml-1">${msg.senderName}</p>` : ''}
              <div class="${isMe ? 'bg-primary text-white' : 'bg-white text-slate-800'} rounded-2xl ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'} px-4 py-3 shadow-sm">
                <p class="text-sm">${msg.text}</p>
              </div>
              <p class="text-[10px] text-slate-400 mt-1 ${isMe ? 'text-right' : 'text-left'}">${time}</p>
            </div>
          </div>
        `;
      });
      container.scrollTop = container.scrollHeight;
    }
  );
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !auth.currentUser) return;
  await addDoc(collection(db, 'families', getFamilyId(), 'messages'), {
    text, uid: auth.currentUser.uid,
    senderName: auth.currentUser.displayName || auth.currentUser.email,
    sentAt: serverTimestamp()
  });
  input.value = '';
}

document.getElementById('send-msg-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

// ============================================
// FAMILY MEMBERS
// ============================================
function loadFamilyMembers() {
  const colors = ['bg-primary', 'bg-pink-400', 'bg-purple-400', 'bg-orange-400', 'bg-teal-400'];
  let i = 0;
  onSnapshot(collection(db, 'families', getFamilyId(), 'members'), (snap) => {
    const container = document.getElementById('family-circle');
    if (!container) return;
    container.innerHTML = '';
    snap.forEach(docSnap => {
      const member = docSnap.data();
      if (member.status !== 'active') return;
      const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
      container.innerHTML += `<div class="w-12 h-12 rounded-full border-2 border-white ${colors[i % colors.length]} flex items-center justify-center text-white font-bold text-sm shadow-sm" title="${member.name}">${initials}</div>`;
      i++;
    });
    container.innerHTML += `<button class="w-12 h-12 rounded-full border-2 border-dashed border-primary text-primary bg-primary-light flex items-center justify-center hover:bg-primary/20 transition-colors ml-1"><span class="material-symbols-outlined">add</span></button>`;
  });
}

// ============================================
// NAVIGATION
// ============================================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.screen;
    if (!target) return;
    showScreen(target);
    if (target === 'dashboard-screen') loadDashboard();
    if (target === 'chat-screen') loadChat();
    if (target === 'meds-screen') loadMeds();
    if (target === 'tasks-screen') loadTasks('tasks-list-full');
    if (target === 'settings-screen') loadSettings();
  });
});

// ============================================
// MODALS
// ============================================
function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

document.getElementById('open-add-task').addEventListener('click', () => openModal('add-task-modal'));
document.getElementById('close-task-modal').addEventListener('click', () => closeModal('add-task-modal'));
document.getElementById('open-add-task-2')?.addEventListener('click', () => openModal('add-task-modal'));
document.getElementById('open-add-med').addEventListener('click', () => openModal('add-med-modal'));
document.getElementById('close-med-modal').addEventListener('click', () => closeModal('add-med-modal'));

['add-task-modal', 'add-med-modal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', e => { if (e.target.id === id) closeModal(id); });
});

// ============================================
// PWA
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}
