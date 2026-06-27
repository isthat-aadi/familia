import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
// SOS SIREN
// ============================================
let sirenInterval = null, sirenCtx = null, sosActive = false;

function startSiren() {
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
  } else {
    sosActive = false;
    stopSiren();
    btn.classList.remove('animate-pulse');
    btn.innerHTML = `<span class="material-symbols-outlined text-3xl icon-filled">emergency</span><span class="text-xl font-bold tracking-wide">SOS EMERGENCY</span>`;
  }
});

// ============================================
// FAMILY ID
// ============================================
function getFamilyId() {
  return localStorage.getItem('familyCode') || 'default';
}

// ============================================
// AUTH
// ============================================
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
      const familyCode = document.getElementById('auth-family-code').value.trim().toLowerCase().replace(/\s/g, '');
      if (!name || !familyCode) { errEl.textContent = 'Name aur Family Code dono zaroori hain!'; return; }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'families', familyCode, 'members', cred.user.uid), {
        name, email, uid: cred.user.uid, role: 'caretaker', joinedAt: serverTimestamp()
      });
      await setDoc(doc(db, 'users', cred.user.uid), { name, email, familyCode, uid: cred.user.uid });
      localStorage.setItem('familyCode', familyCode);
    } else {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      if (!localStorage.getItem('familyCode')) {
        const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
        if (userDoc.exists()) localStorage.setItem('familyCode', userDoc.data().familyCode);
      }
    }
  } catch (e) {
    errEl.textContent = e.message.replace('Firebase: ', '').replace(/\(auth.*\)\.?/, '');
  }
});

// ============================================
// AUTH STATE
// ============================================
onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (!localStorage.getItem('familyCode')) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) localStorage.setItem('familyCode', userDoc.data().familyCode);
    }
    showScreen('pin-screen');
    setupPinScreen();
  } else {
    showScreen('auth-screen');
  }
});

// ============================================
// PIN
// ============================================
function setupPinScreen() {
  let pinClicks = 0;
  const pinInputs = document.querySelectorAll('.pin-dot');
  pinInputs.forEach(i => i.value = '');

  document.querySelectorAll('.numpad-btn').forEach(btn => {
    btn.onclick = () => {
      if (pinClicks < 4) { pinInputs[pinClicks].value = '•'; pinClicks++; }
      if (pinClicks === 4) {
        setTimeout(() => { showScreen('dashboard-screen'); loadDashboard(); }, 400);
      }
    };
  });

  const backBtn = document.querySelector('.backspace-btn');
  if (backBtn) backBtn.onclick = () => { if (pinClicks > 0) { pinClicks--; pinInputs[pinClicks].value = ''; } };
}

// ============================================
// LOGOUT
// ============================================
async function handleLogout() {
  stopSiren();
  localStorage.removeItem('familyCode');
  await signOut(auth);
}
document.getElementById('logout-btn').addEventListener('click', handleLogout);
document.getElementById('logout-dash-btn').addEventListener('click', handleLogout);

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
}

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
        ? 'mood-circle w-12 h-12 rounded-full bg-accent-pink border-2 border-accent-pink-dark flex items-center justify-center text-2xl scale-110 shadow-sm'
        : 'mood-circle w-12 h-12 rounded-full bg-white flex items-center justify-center text-2xl border border-pink-100';
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
          <div class="${task.done ? 'opacity-60 bg-white/60 border-slate-200' : 'bg-surface-pink border-l-4 border-primary'} rounded-xl p-4 shadow-sm border mb-3">
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
                  ? `<button onclick="markTaskDone('${task.id}')" class="w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors"><span class="material-symbols-outlined text-sm">check</span></button>`
                  : `<div class="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center"><span class="material-symbols-outlined text-sm">check</span></div>`
                }
                <button onclick="deleteTask('${task.id}')" class="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center"><span class="material-symbols-outlined text-sm">delete</span></button>
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
        <div class="bg-white rounded-xl p-4 shadow-sm border ${lowStock ? 'border-red-200' : 'border-slate-100'} mb-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined icon-filled">pill</span>
              </div>
              <div>
                <h4 class="font-bold text-slate-800">${med.name}</h4>
                <p class="text-sm text-slate-500">${med.dosage} • ${med.frequency}</p>
                <p class="text-xs ${lowStock ? 'text-red-500 font-semibold' : 'text-slate-400'}">${lowStock ? '⚠️ ' : ''}${med.stock} pills left</p>
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
      const initials = member.name.split(' ').map(n => n[0]).join('').toUpperCase();
      container.innerHTML += `<div class="w-12 h-12 rounded-full border-2 border-white ${colors[i % colors.length]} flex items-center justify-center text-white font-bold text-sm" title="${member.name}">${initials}</div>`;
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
