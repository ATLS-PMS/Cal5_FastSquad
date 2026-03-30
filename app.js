// Stato dell'applicazione
let playersPool = [];
let selectedPlayersIds = new Set();
let matchHistory = [];
let currentTeams = { a: [], b: [] };

// CONFIGURAZIONE: Incolla qui l'URL della Web App di Google Sheets se ce l'hai
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzmv9q4YjQ3hfvvRYGrPyBZQcoMtGSX_a-HK7T6zHymgf-3ODMH9Jos8NsCk-LD9Kp1/exec"; 

window.onload = () => { loadAllData(); renderAll(); };

function loadAllData() {
    playersPool = JSON.parse(localStorage.getItem('fc_players') || '[]');
    matchHistory = JSON.parse(localStorage.getItem('fc_history') || '[]');
}

function saveAllData() {
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    localStorage.setItem('fc_history', JSON.stringify(matchHistory));
}

function showSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
}

function addPlayer() {
    const nameInput = document.getElementById('player-name');
    const r = parseInt(document.getElementById('stat-run').value);
    const f = parseInt(document.getElementById('stat-foot').value);
    const v = parseInt(document.getElementById('stat-vers').value);
    const name = nameInput.value.trim();

    if (!name || isNaN(r) || isNaN(f) || isNaN(v)) return alert("Dati incompleti");

    const overall = Math.round((r + f + v) / 3);
    const idx = playersPool.findIndex(p => p.name.toLowerCase() === name.toLowerCase());

    if (idx !== -1) {
        playersPool[idx] = { ...playersPool[idx], name, run: r, foot: f, vers: v, overall };
    } else {
        // Aggiungiamo 'wins: 0' per i nuovi giocatori
        playersPool.push({ id: Date.now(), name, run: r, foot: f, vers: v, overall, available: true, wins: 0 });
    }

    saveAllData(); renderAll(); nameInput.value = '';
}

function generateTeams() {
    if (selectedPlayersIds.size !== 10) return alert("Seleziona 10 giocatori");
    let p = playersPool.filter(x => selectedPlayersIds.has(x.id));
    p.sort(() => Math.random() - 0.5);
    currentTeams.a = p.slice(0, 5);
    currentTeams.b = p.slice(5, 10);

    document.querySelector('#team-a ul').innerHTML = currentTeams.a.map(x => `<li>${x.name}</li>`).join('');
    document.querySelector('#team-b ul').innerHTML = currentTeams.b.map(x => `<li>${x.name}</li>`).join('');
    
    const sel = document.getElementById('mvp-select');
    sel.innerHTML = '<option value="">-- Seleziona MVP --</option>' + 
        [...currentTeams.a, ...currentTeams.b].map(x => `<option value="${x.name}">${x.name}</option>`).join('');
    
    document.getElementById('teams-result').classList.remove('hidden');
}

// SALVATAGGIO CON CONTEGGIO VITTORIE
async function saveMatch(winner) {
    const mvp = document.getElementById('mvp-select').value;
    if (!mvp) return alert("Seleziona l'MVP prima di chiudere!");

    // Aggiorna le vittorie nel pool giocatori
    if (winner === 'A') {
        currentTeams.a.forEach(pA => {
            const p = playersPool.find(x => x.id === pA.id);
            if (p) p.wins = (p.wins || 0) + 1;
        });
    } else if (winner === 'B') {
        currentTeams.b.forEach(pB => {
            const p = playersPool.find(x => x.id === pB.id);
            if (p) p.wins = (p.wins || 0) + 1;
        });
    }

    const match = {
        date: new Date().toLocaleDateString(),
        result: winner === 'Pareggio' ? 'Pareggio' : `Vittoria Squadra ${winner}`,
        mvp: mvp,
        teamA: currentTeams.a.map(p => p.name),
        teamB: currentTeams.b.map(p => p.name)
    };

    // Invio a Google Sheets
    if (GOOGLE_SHEET_URL) {
        fetch(GOOGLE_SHEET_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(match) });
    }

    matchHistory.unshift(match);
    playersPool.forEach(p => p.available = false);
    selectedPlayersIds.clear();
    saveAllData();
    renderAll();
    document.getElementById('teams-result').classList.add('hidden');
    alert("Partita registrata e vittorie aggiornate!");
}

function renderAll() {
    // Lista admin con contatore vittorie
    document.getElementById('master-player-list').innerHTML = playersPool
        .sort((a, b) => b.wins - a.wins) // Ordina per chi ha più vittorie!
        .map(p => `
        <li style="border-left: 5px solid ${p.available ? '#27ae60' : '#ccc'}">
            <span>${p.name} (OVR: ${p.overall}) - <b>🏆 ${p.wins || 0}</b></span>
            <button class="secondary" style="width:auto; padding:5px" onclick="toggleAvailability(${p.id})">P/A</button>
        </li>
    `).join('');

    // Lista selezione campo
    const available = playersPool.filter(p => p.available || selectedPlayersIds.has(p.id));
    document.getElementById('selection-player-list').innerHTML = available.map(p => `
        <li class="${selectedPlayersIds.has(p.id)?'selected':''}" onclick="toggleSelect(${p.id})">
            ${p.name} <span class="ovr-badge">Vittorie: ${p.wins || 0}</span>
        </li>
    `).join('');
    document.getElementById('selected-count').innerText = selectedPlayersIds.size;

    // Storico
    document.getElementById('history-list').innerHTML = matchHistory.slice(0, 10).map(m => `
        <div class="history-card">
            <b>${m.date}</b>: ${m.result}<br>
            <small>MVP: ${m.mvp}</small>
        </div>
    `).join('');
}

function toggleSelect(id) {
    if (selectedPlayersIds.has(id)) selectedPlayersIds.delete(id);
    else if (selectedPlayersIds.size < 10) selectedPlayersIds.add(id);
    renderAll();
}

function toggleAvailability(id) {
    const p = playersPool.find(x => x.id === id);
    if(p) p.available = !p.available;
    saveAllData(); renderAll();
}

function exportData() {
    const blob = new Blob([JSON.stringify({p: playersPool, h: matchHistory})], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fanta_calcetto.json';
    a.click();
}

function importData() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.onchange = e => {
        const reader = new FileReader();
        reader.onload = ev => {
            const d = JSON.parse(ev.target.result);
            playersPool = d.p; matchHistory = d.h;
            saveAllData(); renderAll();
        };
        reader.readAsText(e.target.files[0]);
    };
    inp.click();
}

function copyTeamsToClipboard() {
    const t = `⚽ SQUADRE\n🔴 A: ${currentTeams.a.map(p=>p.name).join(', ')}\n🔵 B: ${currentTeams.b.map(p=>p.name).join(', ')}`;
    navigator.clipboard.writeText(t).then(()=>alert("Copiato!"));
}

function clearHistory() {
    if(confirm("Vuoi resettare tutto?")) { matchHistory = []; playersPool.forEach(p => p.wins = 0); saveAllData(); renderAll(); }
}
