// app.js
import { db, collection as rootCol, addDoc } from './firebase.js';
import {
  serverTimestamp,
  collection,
  onSnapshot,
  doc,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const candidateInput = document.getElementById('candidateInput');
const addCandidateBtn = document.getElementById('addCandidate');
const candidateList = document.getElementById('candidateList');
const startVoteBtn = document.getElementById('startVote');

const resultSection = document.getElementById('resultSection');
const voteLinkInput = document.getElementById('voteLink');
const voteIdDisplay = document.getElementById('voteIdDisplay');
const participantsList = document.getElementById('participantsList');
const winnerDisplay = document.getElementById('winnerDisplay');

let candidates = [];

function computeRCV(ballots, candidateNames) {
  if (!ballots.length) return 'No votes yet';
  if (!candidateNames.length) return 'Tie (no candidates)';

  let active = new Set(candidateNames);
  let rounds = 0;

  while (true) {
    rounds++;
    const counts = {};
    active.forEach(c => counts[c] = 0);

    ballots.forEach(ballot => {
      for (let choice of ballot) {
        if (active.has(choice)) {
          counts[choice]++;
          break;
        }
      }
    });

    const total = ballots.length;
    let majorityWinner = null;
    for (let candidate of active) {
      if (counts[candidate] > total / 2) {
        majorityWinner = candidate;
        break;
      }
    }

    if (majorityWinner) {
      return majorityWinner;
    }

    const values = Object.values(counts);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    if (minVal === maxVal) {
      return `Tie between ${[...active].join(', ')}`;
    }

    const toEliminate = [...active].filter(c => counts[c] === minVal);
    toEliminate.forEach(c => active.delete(c));

    if (active.size === 0) {
      return 'Tie (all candidates eliminated)';
    }
    if (active.size === 1) {
      const last = [...active][0];
      return last;
    }
  }
}

function finalRCV(ballots, candidateNames) {
  const winner = computeRCV(ballots, candidateNames);

  if (winner.startsWith('Tie') || winner === 'No votes yet') {
    return { winner, runnerUp: null };
  }

  const newCandidateNames = candidateNames.filter(c => c !== winner);
  if (newCandidateNames.length === 0) {
    return { winner, runnerUp: null };
  }

  const newBallots = ballots.map(ballot => ballot.filter(c => c !== winner));
  const runnerUp = computeRCV(newBallots, newCandidateNames);

  return { winner, runnerUp };
}

function watchVoters(voteId) {
  const votersCol = collection(db, 'votes', voteId, 'voters');
  onSnapshot(votersCol, snapshot => {
    participantsList.innerHTML = '';
    const ballots = [];

    snapshot.forEach(snap => {
      const { name, email, ranking } = snap.data();
      const ordered = ranking
        .sort((a, b) => a.rank - b.rank)
        .map(r => r.name);
      ballots.push(ordered);

      const li = document.createElement('li');
      li.innerHTML = `<strong>${name}</strong> voted`;
      participantsList.appendChild(li);
    });

    if (ballots.length === 0) {
      participantsList.innerHTML = '<li>No participants yet.</li>';
    }

    const result = finalRCV(ballots, candidates);
    winnerDisplay.innerHTML = `
      <strong>Winner:</strong> ${result.winner} <br>
      ${result.runnerUp ? `<strong>1st Runner-Up:</strong> ${result.runnerUp}` : ''}
    `;
  });
}


const urlParams = new URLSearchParams(window.location.search);
const existingVid = urlParams.get('voteId');

if (existingVid) {
  [candidateInput, addCandidateBtn, candidateList, startVoteBtn]
    .forEach(el => el.style.display = 'none');

  (async () => {
    voteIdDisplay.textContent = `Vote ID: ${existingVid}`;
    const link = `${location.origin}/vote.html?voteId=${existingVid}`;
    voteLinkInput.value = link;

    const candSnap = await getDocs(
      collection(db, 'votes', existingVid, 'candidates')
    );
    candidates = candSnap.docs.map(d => d.data().name);

    resultSection.style.display = 'block';
    watchVoters(existingVid);
  })();
}

addCandidateBtn.addEventListener('click', () => {
  const name = candidateInput.value.trim();
  if (!name || candidates.includes(name)) return;
  candidates.push(name);
  const li = document.createElement('li');
  li.textContent = name;
  candidateList.appendChild(li);
  candidateInput.value = '';
});

startVoteBtn.addEventListener('click', async () => {
  if (!candidates.length) {
    alert("Add at least one candidate.");
    return;
  }
  try {
    const voteRef = await addDoc(rootCol(db, 'votes'), {
      isClosed: false,
      createdAt: serverTimestamp()
    });
    const voteId = voteRef.id;

    await Promise.all(
      candidates.map(name =>
        addDoc(collection(db, 'votes', voteId, 'candidates'), { name })
      )
    );

    candidates = [];
    candidateList.innerHTML = '';
    candidateInput.value = '';
    window.history.replaceState(null, '', `?voteId=${voteId}`);

    resultSection.style.display = 'block';
    voteIdDisplay.textContent = `Vote ID: ${voteId}`;
    const link = `${location.origin}/vote.html?voteId=${voteId}`;
    voteLinkInput.value = link;
    voteLinkInput.select();
    document.execCommand('copy');
    alert("Vote link copied to clipboard!");

    watchVoters(voteId);
  } catch (e) {
    console.error(e);
    alert("Error creating vote.");
  }
});
