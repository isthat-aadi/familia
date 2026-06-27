// ============================================
// FAMILIA APP - app.js
// ============================================

// --- FIREBASE CONFIG ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, where, orderBy, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
// SCREEN MANAGER
// ============================================
const screens = {
  welcome: document.getElementById('welcome-screen'),
  auth: document.getElementById('auth-screen'),
  pin: document.getElementById('pin-screen'),
  dashboard: document.getElementById('dashboard-screen'),
  chat: document.getElementById('chat-screen'),
  tasks: document.getElementById('tasks-screen'),
  meds: document.getElementById('meds-screen'),
  profile: document.getElementById('profile-screen'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => {
    s.classList.add('hidden');
    s.classList.remove('flex');
  });
  screens[name].classList.remove('hidden');
  screens[name].classList.add('flex');
}

// ============================================
// SOS SIREN — Web Audio API (ignores volume)
// ============================================
let sirenInterval = null;
let sirenCtx = null;

function startSiren() {
  // AudioContext plays through system audio — bypasses media volume
  sirenCtx = new (window.AudioContext || window.webkitAudioContext)();

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
}

function stopSiren() {
  if (sirenInterval) clearInterval(sirenInterval);
  if (sirenCtx) sirenCtx.close();
  sirenCtx = null;
  sirenInterval = null;
}

// ============================================
// SOS BUTTON
// ============================================
let sosActive = false;

document.getElementById('sos-btn').addEventListener('click', () => {
  if (!sosActive) {
    sosActive = true;
    startSiren();
    document.getElementById('sos-btn').classList.add('animate-pulse');
    document.getElementById('sos-btn').innerHTML = `
      <span class="material-symbols-outlined text-3xl icon-filled">emergency</span>
      <span class="text-xl font-bold tracking-wide">TAP TO STOP SOS</span>
    `;
    // Log SOS to Firestore
    const user = auth.currentUser;
    if (user) {
      navigator.geolocation.getCurrentPosition(pos => {
        addDoc(collection(db, 'families', getFamilyId(), 'sos_alerts'), {
          triggeredBy: user.displayName || user.email,
          uid: user.uid,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: serverTimestamp()
        });
      });
    }
  } else {
    sosActive = false;
    stopSiren();
    document.getElementById('sos-btn').classList.remove('animate-pulse');
    document.getElementById('sos-btn').innerHTML = `
      <span class="material-symbols-outlined text-3xl icon-filled">emergency</span>
      <span class="text-xl font-bold tracking-wide">SOS EMERGENCY</span>
    `;
  }
});

// ============================================
// AUTH — LOGIN / SIGNUP
// ============================================
let currentUser = null;

// Toggle between login and signup
document.getElementById('toggle-auth-mode').addEventListener('click', () => {
  const isLogin = document.getElementById('auth-title').textContent === 'Welcome Back';
  document.getElementById('auth-title').textContent = isLogin ? 'Join Familia' : 'Welcome Back';
  document.getElementById('auth-submit-btn').textContent = isLogin ? 'Create Account' : 'Login';
  document.getElementById('toggle-auth-mode').textContent = isLogin ? 'Already have an account? Login' : "Don't have an account? Sign Up";
  document.getElementById('name-field').classList.toggle('hidden', !isLogin);
  document.getElementById('family-code-field').classList.toggle('hidden', !isLogin);
});

document.getElementById('auth-submit-btn').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const isSignup = document.getElementById('auth-title').textContent === 'Join Familia';
  const errEl = document.getElementById('auth-error');
  errEl.textContent = '';

  try {
    if (isSignup) {
      const name = document.getElementById('auth-name').value.trim();
      const familyCode = document.getElementById('auth-family-code').value.trim();
      if (!name || !familyCode) { errEl.textContent = 'Name aur Family Code dono zaroori hain!'; return; }

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });

      // Save user to Firestore under family
      await setDoc(doc(db, 'families', familyCode, 'members', cred.user.uid), {
        name, email, uid: cred.user.uid, role: 'caretaker', joinedAt: serverTimestamp()
      });
      // Save family reference on user
      await setDoc(doc(db, 'users', cred.user.uid), {
        name, email, familyCode, uid: cred.user.uid
      });

      localStorage.setItem('familyCode', familyCode);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (e) {
    errEl.textContent = e.message.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, '');
  }
});

// ============================================
// FAMILY ID HELPER
// ============================================
function getFamilyId() {
  return localStorage.getItem('familyCode') || 'default';
}

// ============================================
// AUTH STATE LISTENER
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // Load familyCode from Firestore if not in localStorage
    if (!localStorage.getItem('familyCode')) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        localStorage.setItem('familyCode', userDoc.data().familyCode);
      }
    }
    showScreen('pin');
    setupPinScreen();
  } else {
    currentUser = null;
    showScreen('auth');
  }
});

// ============================================
// PIN SCREEN
// ============================================
function setupPinScreen() {
  let pinClicks = 0;
  const pinInputs = document.querySelectorAll('.pin-dot');
  const numpadBtns = document.querySelectorAll('.numpad-btn');

  // Reset
  pinInputs.forEach(i => i.value = '');
  pinClicks = 0;

  numpadBtns.forEach(btn => {
    btn.onclick = () => {
      if (pinClicks < 4) {
        pinInputs[pinClicks].value = '•';
        pinClicks++;
      }
      if (pinClicks === 4) {
        setTimeout(() => {
          showScreen('dashboard');
          loadDashboard();
        }, 400);
      }
    };
  });

  document.querySelector('.backspace-btn').onclick = () => {
    if (pinClicks > 0) {
      pinClicks--;
      pinInputs[pinClicks].value = '';
    }
  };
}

// ============================================
// DASHBOARD
// ============================================
function loadDashboard() {
  const user = auth.currentUser;
  if (!user) return;

  document.getElementById('dash-username').textContent = `Hi, ${user.displayName || 'Friend'}`;
  loadTodayMood();
  loadTasks();
  loadFamilyMembers();
}

// ============================================
// MOOD TRACKING
// ============================================
function loadTodayMood() {
  const familyId = getFamilyId();
  const today = new Date().toISOString().split('T')[0];

  onSnapshot(doc(db, 'families', familyId, 'moods', today), (snap) => {
    if (snap.exists()) {
      const mood = snap.data().mood;
      document.querySelectorAll('.mood-btn').forEach(btn => {
        const isActive = btn.dataset.mood === mood;
        const circle = btn.querySelector('.mood-circle');
        circle.className = isActive
          ? 'mood-circle w-12 h-12 rounded-full bg-accent-pink border-2 border-accent-pink-dark flex items-center justify-center text-2xl scale-110 shadow-sm'
          : 'mood-circle w-12 h-12 rounded-full bg-white flex items-center justify-center text-2xl border border-pink-100';
      });
      document.getElementById('mood-time').textContent = `Updated ${snap.data().time}`;
    }
  });
}

document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const mood = btn.dataset.mood;
    const familyId = getFamilyId();
    const today = new Date().toISOString().split('T')[0];
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    await setDoc(doc(db, 'families', familyId, 'moods', today), {
      mood, time, updatedBy: auth.currentUser?.displayName || 'Someone', updatedAt: serverTimestamp()
    });
  });
});

// ============================================
// TASKS
// ============================================
function loadTasks() {
  const familyId = getFamilyId();
  const today = new Date().toISOString().split('T')[0];

  onSnapshot(query(
    collection(db, 'families', familyId, 'tasks'),
    where('date', '==', today),
    orderBy('time')
  ), (snap) => {
    const container = document.getElementById('tasks-list');
    container.innerHTML = '';

    if (snap.empty) {
      container.innerHTML = `<p class="text-center text-slate-400 py-8">Aaj ke liye koi task nahi. Add karo! 🎉</p>`;
      return;
    }

    snap.forEach(docSnap => {
      const task = docSnap.data();
      const id = docSnap.id;
      const done = task.done;

      container.innerHTML += `
        <div class="${done ? 'opacity-60 bg-white/60' : 'bg-surface-pink'} rounded-xl p-5 shadow-sm border ${done ? 'border-slate-200' : 'border-l-4 border-primary'} mb-4">
          <div class="flex items-start justify-between">
            <div class="flex gap-4">
              <div class="w-12 h-12 rounded-full ${done ? 'bg-slate-100 text-slate-400' : 'bg-white text-primary'} flex items-center justify-center shrink-0 shadow-sm">
                <span class="material-symbols-outlined icon-filled">${task.icon || 'task_alt'}</span>
              </div>
              <div>
                <h4 class="text-lg font-bold ${done ? 'text-slate-500 line-through' : 'text-slate-900'}">${task.title}</h4>
                <p class="text-sm text-slate-500">${task.time} • ${task.note || ''}</p>
              </div>
            </div>
            <div class="flex gap-2">
              ${done
                ? `<div class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center border border-green-200"><span class="material-symbols-outlined text-sm">check</span></div>`
                : `<button onclick="markTaskDone('${id}')" class="w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors"><span class="material-symbols-outlined text-sm">check</span></button>`
              }
              <button onclick="deleteTask('${id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center transition-colors"><span class="material-symbols-outlined text-sm">delete</span></button>
            </div>
          </div>
        </div>
      `;
    });
  });
}

window.markTaskDone = async (id) => {
  const familyId = getFamilyId();
  await updateDoc(doc(db, 'families', familyId, 'tasks', id), { done: true, doneAt: serverTimestamp() });
};

window.deleteTask = async (id) => {
  const familyId = getFamilyId();
  await deleteDoc(doc(db, 'families', familyId, 'tasks', id));
};

// Add Task
document.getElementById('add-task-btn').addEventListener('click', async () => {
  const title = document.getElementById('task-title').value.trim();
  const time = document.getElementById('task-time').value;
  const note = document.getElementById('task-note').value.trim();

  if (!title || !time) { alert('Task naam aur time dono chahiye!'); return; }

  const familyId = getFamilyId();
  const today = new Date().toISOString().split('T')[0];

  await addDoc(collection(db, 'families', familyId, 'tasks'), {
    title, time, note, done: false, icon: 'task_alt',
    date: today, createdBy: auth.currentUser?.displayName,
    createdAt: serverTimestamp()
  });

  document.getElementById('task-title').value = '';
  document.getElementById('task-time').value = '';
  document.getElementById('task-note').value = '';
  document.getElementById('add-task-modal').classList.add('hidden');
});

// ============================================
// MEDICATIONS
// ============================================
function loadMeds() {
  const familyId = getFamilyId();

  onSnapshot(collection(db, 'families', familyId, 'medications'), (snap) => {
    const container = document.getElementById('meds-list');
    container.innerHTML = '';

    if (snap.empty) {
      container.innerHTML = `<p class="text-center text-slate-400 py-8">Koi medication nahi. Add karo!</p>`;
      return;
    }

    snap.forEach(docSnap => {
      const med = docSnap.data();
      const id = docSnap.id;
      container.innerHTML += `
        <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 mb-3 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <span class="material-symbols-outlined icon-filled">pill</span>
            </div>
            <div>
              <h4 class="font-bold text-slate-800">${med.name}</h4>
              <p class="text-sm text-slate-500">${med.dosage} • ${med.frequency}</p>
              <p class="text-xs text-slate-400">Stock: ${med.stock} pills left</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button onclick="decrementMed('${id}', ${med.stock})" class="w-8 h-8 rounded-full bg-orange-50 text-orange-500 hover:bg-orange-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-sm">remove</span>
            </button>
            <button onclick="deleteMed('${id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-sm">delete</span>
            </button>
          </div>
        </div>
      `;
    });
  });
}

window.decrementMed = async (id, currentStock) => {
  if (currentStock <= 0) { alert('Stock khatam! Naya order karo.'); return; }
  const familyId = getFamilyId();
  await updateDoc(doc(db, 'families', familyId, 'medications', id), { stock: currentStock - 1 });
};

window.deleteMed = async (id) => {
  const familyId = getFamilyId();
  await deleteDoc(doc(db, 'families', familyId, 'medications', id));
};

document.getElementById('add-med-btn').addEventListener('click', async () => {
  const name = document.getElementById('med-name').value.trim();
  const dosage = document.getElementById('med-dosage').value.trim();
  const frequency = document.getElementById('med-frequency').value;
  const stock = parseInt(document.getElementById('med-stock').value);

  if (!name || !dosage || !stock) { alert('Saari details bharo!'); return; }

  const familyId = getFamilyId();
  await addDoc(collection(db, 'families', familyId, 'medications'), {
    name, dosage, frequency, stock, addedBy: auth.currentUser?.displayName, addedAt: serverTimestamp()
  });

  document.getElementById('med-name').value = '';
  document.getElementById('med-dosage').value = '';
  document.getElementById('med-stock').value = '';
  document.getElementById('add-med-modal').classList.add('hidden');
});

// ============================================
// FAMILY CHAT — Realtime
// ============================================
function loadChat() {
  const familyId = getFamilyId();

  onSnapshot(query(
    collection(db, 'families', familyId, 'messages'),
    orderBy('sentAt')
  ), (snap) => {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    snap.forEach(docSnap => {
      const msg = docSnap.data();
      const isMe = msg.uid === auth.currentUser?.uid;

      container.innerHTML += `
        <div class="flex ${isMe ? 'justify-end' : 'justify-start'} mb-3">
          <div class="max-w-[75%]">
            ${!isMe ? `<p class="text-xs text-slate-500 mb-1 ml-1">${msg.senderName}</p>` : ''}
            <div class="${isMe ? 'bg-primary text-white' : 'bg-white text-slate-800'} rounded-2xl ${isMe ? 'rounded-tr-sm' : 'rounded-tl-sm'} px-4 py-3 shadow-sm">
              <p class="text-sm">${msg.text}</p>
            </div>
            <p class="text-[10px] text-slate-400 mt-1 ${isMe ? 'text-right' : 'text-left'}">${msg.sentAt?.toDate ? msg.sentAt.toDate().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}) : 'now'}</p>
          </div>
        </div>
      `;
    });
    container.scrollTop = container.scrollHeight;
  });
}

document.getElementById('send-msg-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  const familyId = getFamilyId();
  const user = auth.currentUser;

  await addDoc(collection(db, 'families', familyId, 'messages'), {
    text, uid: user.uid,
    senderName: user.displayName || user.email,
    sentAt: serverTimestamp()
  });

  input.value = '';
}

// ============================================
// FAMILY MEMBERS
// ============================================
function loadFamilyMembers() {
  const familyId = getFamilyId();

  onSnapshot(collection(db, 'families', familyId, 'members'), (snap) => {
    const container = document.getElementById('family-circle');
    container.innerHTML = '';

    snap.forEach(docSnap => {
      const member = docSnap.data();
      const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
      container.innerHTML += `
        <div class="w-12 h-12 rounded-full border-2 border-white bg-primary flex items-center justify-center text-white font-bold text-sm relative" title="${member.name}">
          ${initials}
        </div>
      `;
    });

    // Add button
    container.innerHTML += `
      <button class="w-12 h-12 rounded-full border-2 border-dashed border-primary text-primary bg-primary-light flex items-center justify-center hover:bg-primary/20 transition-colors">
        <span class="material-symbols-outlined">add</span>
      </button>
    `;
  });
}

// ============================================
// NAVIGATION
// ============================================
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.screen;
    showScreen(target);
    if (target === 'dashboard') loadDashboard();
    if (target === 'chat') loadChat();
    if (target === 'meds') loadMeds();

    // Update active nav
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.remove('text-primary');
      b.classList.add('text-slate-400');
    });
    btn.classList.add('text-primary');
    btn.classList.remove('text-slate-400');
  });
});

// ============================================
// LOGOUT
// ============================================
document.getElementById('logout-btn').addEventListener('click', async () => {
  stopSiren();
  localStorage.removeItem('familyCode');
  await signOut(auth);
});

// ============================================
// MODALS
// ============================================
document.getElementById('open-add-task').addEventListener('click', () => {
  document.getElementById('add-task-modal').classList.remove('hidden');
});
document.getElementById('close-task-modal').addEventListener('click', () => {
  document.getElementById('add-task-modal').classList.add('hidden');
});

document.getElementById('open-add-med').addEventListener('click', () => {
  document.getElementById('add-med-modal').classList.remove('hidden');
});
document.getElementById('close-med-modal').addEventListener('click', () => {
  document.getElementById('add-med-modal').classList.add('hidden');
});

// ============================================
// PWA SERVICE WORKER
// ============================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
