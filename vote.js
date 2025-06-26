import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { firebaseConfig } from "./firebase.js";

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const voteIdDisplay       = document.getElementById('voteIdDisplay');
const signInBtn           = document.getElementById('signInBtn');
const logoutBtn           = document.getElementById('logoutBtn');
const userEmailEl         = document.getElementById('userEmail');
const participantInputDiv = document.getElementById('participantInputDiv');
const participantNameEl   = document.getElementById('participantName');
const messageEl           = document.getElementById('message');
const formDiv             = document.getElementById('rankingForm');
const clearBtn            = document.getElementById('clearBtn');
const submitBtn           = document.getElementById('submitBtn');
const currentRanks        = document.getElementById('currentRanks');

const voteId = new URLSearchParams(window.location.search).get('voteId');
voteIdDisplay.textContent = `Vote ID: ${voteId}`;

signInBtn.onclick = () => signInWithPopup(auth, provider);
logoutBtn.onclick = () => signOut(auth).then(() => location.reload());

onAuthStateChanged(auth, async user => {
  if (!user) {
    resetUI();
    return;
  }
  // show user info and name input
  userEmailEl.textContent = `Signed in as: ${user.email}`;
  signInBtn.style.display = 'none';
  logoutBtn.style.display = 'inline-block';
  participantInputDiv.style.display = 'block';
  clearBtn.style.display = submitBtn.style.display = 'inline-block';

  // check already voted
  const voterRef = doc(db, 'votes', voteId, 'voters', user.uid);
  const voterSnap = await getDoc(voterRef);
  if (voterSnap.exists()) {
    const data = voterSnap.data();
    messageEl.textContent = "You have already voted.";
    participantInputDiv.style.display = 'none';
    renderFinalRanking(data.ranking);
    return;
  }

  // fetch candidates
  const candSnap = await getDocs(collection(db, 'votes', voteId, 'candidates'));
  if (candSnap.empty) {
    messageEl.textContent = "Invalid vote ID or no candidates.";
    return;
  }
  const candidates = candSnap.docs.map(d => d.data().name);

  messageEl.textContent = '';
  renderForm(candidates);
});

function resetUI() {
  userEmailEl.textContent = '';
  messageEl.textContent = '';
  participantInputDiv.style.display = 'none';
  formDiv.innerHTML = '';
  currentRanks.innerHTML = 'No Rankings yet.';
  clearBtn.style.display = submitBtn.style.display = 'none';
  signInBtn.style.display = 'inline-block';
  logoutBtn.style.display = 'none';
}

function renderForm(candidates) {
  formDiv.innerHTML = '';
  currentRanks.innerHTML = 'No Rankings yet.';

  const selects = Array.from({ length: candidates.length }, (_, i) => {
    const label = document.createElement('label');
    label.textContent = `${i+1}${['st','nd','rd'][i]||'th'} preference: `;
    const sel = document.createElement('select');
    sel.id = `pref${i+1}`;
    sel.disabled = i !== 0;
    sel.add(new Option('Unranked',''));
    candidates.forEach(name => sel.add(new Option(name,name)));
    label.appendChild(sel);
    formDiv.appendChild(label);
    sel.addEventListener('change', () => cascadeLogic(selects, candidates));
    return sel;
  });

  clearBtn.onclick = () => {
    selects.forEach((sel, idx) => {
      sel.disabled = idx !== 0;
      sel.value = '';
      if (![...sel.options].some(o=>o.value==='')) {
        sel.add(new Option('Unranked',''),0);
      }
    });
    currentRanks.innerHTML = 'No Rankings yet.';
  };

  submitBtn.onclick = async () => {
    const name = participantNameEl.value.trim();
    if (!name) {
      alert("Please enter your name before submitting.");
      return;
    }
    const ranking = selects
      .map((sel, idx) => sel.value && { rank: idx+1, name: sel.value })
      .filter(Boolean);

    // save vote with email + name + ranking
    const voterRef = doc(db, 'votes', voteId, 'voters', auth.currentUser.uid);
    await setDoc(voterRef, {
      email: auth.currentUser.email,
      name,
      ranking,
      submittedAt: serverTimestamp()
    });

    // hide form and name input
    formDiv.innerHTML = '';
    participantInputDiv.style.display = 'none';
    clearBtn.style.display = submitBtn.style.display = 'none';
    messageEl.textContent = `Thank you, ${name}! Your vote:`;
    renderFinalRanking(ranking);
  };
}

function cascadeLogic(selects, candidates) {
  // enable next in sequence
  selects.forEach((sel, i) => {
    if (sel.value) {
      sel.disabled = true;
      if (selects[i+1]) selects[i+1].disabled = false;
    }
  });

  const chosen = new Set(selects.map(s=>s.value).filter(v=>v));
  selects.forEach(sel => {
    if (!sel.disabled && sel.value==='') {
      sel.innerHTML = '';
      sel.add(new Option('Unranked',''));
      candidates.forEach(name => {
        if (!chosen.has(name)) sel.add(new Option(name,name));
      });
    }
  });

  currentRanks.innerHTML = '';
  selects.forEach((sel, idx) => {
    if (sel.value) {
      const li = document.createElement('li');
      li.textContent = `${idx+1}. ${sel.value}`;
      currentRanks.appendChild(li);
    }
  });
}

function renderFinalRanking(ranking) {
  currentRanks.innerHTML = '';
  ranking.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.rank}. ${item.name}`;
    currentRanks.appendChild(li);
  });
}
