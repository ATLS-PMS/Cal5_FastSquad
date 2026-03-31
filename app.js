var playersPool = [];
var selectedPlayersIds = [];
var matchHistory = [];
var currentTeams = { a: [], b: [] };

// CONFIGURAZIONE: Inserisci il tuo URL /exec di Google
var GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyAGBwnv6Sb29naP4warPW_7LInkpYQJYwYgIAL54okpOFTcNSm8G5_R07GeVhGpIdj/exec"; 

// --- INIZIALIZZAZIONE ---
window.onload = function() {
    try {
        loadLocal();
        syncFromCloud();
    } catch (e) {
        console.error("Errore avvio:", e);
        document.getElementById('cloud-status').innerText = "⚠️ Errore Sistema";
    }
};

function loadLocal() {
    var p = localStorage.getItem('fc_players');
    var h = localStorage.getItem('fc_history');
    if(p) playersPool = JSON.parse(p);
    if(h) matchHistory = JSON.parse(h);
    renderAll();
}

function updateLog(msg) {
    const ora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('cloud-status').innerText = msg;
    document.getElementById('last-sync-time').innerText = "Ultimo agg: " + ora;
}

// --- LOGICA SINCRONIZZAZIONE ---
function forceCloudSync() {
    if(!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.length < 10) return alert("URL Cloud non configurato!");
    updateLog("🔄 Salvataggio...");

    var payload = { 
        players: playersPool, 
        history: matchHistory,
        isSyncOnly: true 
    };

    fetch(GOOGLE_SHEET_URL, { 
        method: 'POST', 
        mode: 'no-cors', 
        body: JSON.stringify(payload) 
    }).then(() => {
        updateLog("✅ Cloud Aggiornato");
    }).catch(() => {
        updateLog("❌ Errore Invio");
    });
}

function syncFromCloud() {
    if(!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.length < 10) {
        updateLog("⚠️ URL Cloud mancante");
        return;
    }
    updateLog("☁️ Lettura Cloud...");
    
    fetch(GOOGLE_SHEET_URL)
        .then(response => response.json())
        .then(data => {
            if(data && data.players) {
                playersPool = data.players;
                matchHistory = data.history || [];
                localStorage.setItem('fc_players', JSON.stringify(playersPool));
                localStorage.setItem('fc_history', JSON.stringify(matchHistory));
                renderAll();
                updateLog("✅ Dati Sincronizzati");
            }
        })
        .catch(() => updateLog("⚠️ Modalità Offline"));
}

// --- GESTIONE GIOCATORI ---
function addPlayer() {
    var name = document.getElementById('player-name').value.trim();
    if(!name) return;
    var r = parseInt(document.getElementById('stat-run').value) || 5;
    var f = parseInt(document.getElementById('stat-foot').value) || 5;
    var v = parseInt(document.getElementById('stat-vers').value) || 5;
    var ovr = Math.round((r+f+v)/3);
    
    playersPool.push({
        id: Date.now(), 
        name: name, 
        run: r, foot: f, vers: v, 
        overall: ovr, 
        wins: 0, 
        available: true
    });
    
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    document.getElementById('player-name').value = "";
    renderAll();
}

function toggleAvail(id) {
    playersPool.forEach(p => {
        if(p.id === id) p.available = !p.available;
    });
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    renderAll();
}

function deletePlayer(id) {
    if(confirm("Eliminare definitivamente il giocatore?")) {
        playersPool = playersPool.filter(p => p.id !== id);
        localStorage.setItem('fc_players', JSON.stringify(playersPool));
        renderAll();
    }
}

// --- SELEZIONE E CAMPO ---
function toggleSelect(id) {
    var idx = selectedPlayersIds.indexOf(id);
    if (idx > -1) {
        selectedPlayersIds.splice(idx, 1);
    } else {
        if (selectedPlayersIds.length < 10) {
            selectedPlayersIds.push(id);
        } else {
            alert("Massimo 10 giocatori!");
            return;
        }
    }
    renderAll();
}

// --- BILANCIAMENTO AI ---
function generateTeams() {
    if (selectedPlayersIds.length !== 10) return alert("Seleziona 10 persone!");
    
    var p = playersPool.filter(pl => selectedPlayersIds.indexOf(pl.id) > -1);
    var bestDiff = Infinity;
    var bestA = [], bestB = [];

    // Prova 500 combinazioni per il miglior equilibrio possibile
    for (var i = 0; i < 500; i++) {
        p.sort(() => 0.5 - Math.random());
        var tempA = p.slice(0, 5);
        var tempB = p.slice(5, 10);
        
        var sumA = tempA.reduce((s, x) => s + x.overall, 0);
        var sumB = tempB.reduce((s, x) => s + x.overall, 0);
        
        var diff = Math.abs(sumA - sumB);
        
        if (diff < bestDiff) {
            bestDiff = diff;
            bestA = [...tempA];
            bestB = [...tempB];
        }
        if (diff === 0) break; 
    }

    currentTeams.a = bestA;
    currentTeams.b = bestB;
    
    renderActiveTeams();
    document.getElementById('teams-result').classList.remove('hidden');
    document.getElementById('teams-result').scrollIntoView({ behavior: 'smooth' });
}

function renderActiveTeams() {
    var calcStats = (team) => {
        var s = { ovr: 0, run: 0, foot: 0, vers: 0 };
        team.forEach(p => { 
            s.ovr += p.overall; s.run += p.run; s.foot += p.foot; s.vers += p.vers; 
        });
        return { 
            ovr: (s.ovr / 5).toFixed(1), run: (s.run / 5).toFixed(1), 
            foot: (s.foot / 5).toFixed(1), vers: (s.vers / 5).toFixed(1)
        };
    };

    var statsA = calcStats(currentTeams.a);
    var statsB = calcStats(currentTeams.b);

    var drawTeam = (team, stats, title) => {
        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="margin:0; color:var(--primary); font-size:16px;">${title}</h3>
                <span style="background:var(--primary); color:white; padding:3px 10px; border-radius:10px; font-size:11px;">OVR: ${stats.ovr}</span>
            </div>
            <ul style="list-style:none; padding:0; margin-bottom:10px;">`;
        
        team.forEach(p => {
            html += `
                <li style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f0f0; font-size:13px;">
                    <span>${p.name}</span>
                    <span style="color:#888; font-size:10px;">OVR ${p.overall} (C:${p.run} P:${p.foot} V:${p.vers})</span>
                </li>`;
        });

        html += `</ul>
            <div style="text-align:right; font-size:9px; color:#95a5a6; font-style:italic;">
                Medie: Corsa ${stats.run} | Piedi ${stats.foot} | Vers ${stats.vers}
            </div>`;
        return html;
    };

    document.getElementById('team-a-container').innerHTML = drawTeam(currentTeams.a, statsA, "SQUADRA A");
    document.getElementById('team-b-container').innerHTML = drawTeam(currentTeams.b, statsB, "SQUADRA B");

    var opt = "<option value=''>-- SELEZIONA MVP --</option>";
    currentTeams.a.concat(currentTeams.b).forEach(p => opt += `<option value="${p.name}">${p.name}</option>`);
    document.getElementById('mvp-select').innerHTML = opt;
}

// --- SALVATAGGIO PARTITA ---
function saveMatch(winner) {
    var mvp = document.getElementById('mvp-select').value;
    if(!mvp) return alert("Seleziona l'MVP della partita!");
    
    if(winner==='A') currentTeams.a.forEach(tp => { let p = playersPool.find(x=>x.id===tp.id); if(p) p.wins++; });
    if(winner==='B') currentTeams.b.forEach(tp => { let p = playersPool.find(x=>x.id===tp.id); if(p) p.wins++; });
    
    var match = { 
        date: new Date().toLocaleDateString(), 
        score: "Vince "+winner, 
        mvp: mvp, 
        teamA: currentTeams.a.map(p=>p.name), 
        teamB: currentTeams.b.map(p=>p.name) 
    };
    
    matchHistory.unshift(match);
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    localStorage.setItem('fc_history', JSON.stringify(matchHistory));
    
    forceCloudSync();
    selectedPlayersIds = [];
    document.getElementById('teams-result').classList.add('hidden');
    renderAll();
    alert("Partita salvata e classifiche aggiornate!");
}

// --- RENDER GENERALE ---
function renderAll() {
    // 1. MENU GIOCATORI (ADMIN)
    var hM = "";
    var sortedPlayers = [...playersPool].sort((a, b) => b.wins - a.wins);
    sortedPlayers.forEach(p => {
        var statusClass = p.available ? 'is-avail' : 'is-absent';
        var statusTxt = p.available ? 'PRESENTE' : 'ASSENTE';
        hM += `<li class="${p.available ? '' : 'card-absent'}">
                <div class="p-info">
                    <b>${p.name}</b>
                    <small>OVR: ${p.overall} (C:${p.run} P:${p.foot} V:${p.vers}) | 🏆 ${p.wins}</small>
                </div>
                <div class="p-btns">
                    <button class="btn-p-a ${statusClass}" onclick="toggleAvail(${p.id})">${statusTxt}</button>
                    <button class="btn-del" onclick="deletePlayer(${p.id})">×</button>
                </div></li>`;
    });
    document.getElementById('master-player-list').innerHTML = hM;

    // 2. SEZIONE CAMPO (SELEZIONE)
    var hS = "";
    playersPool.forEach(p => {
        if(p.available) {
            var sel = selectedPlayersIds.indexOf(p.id) > -1;
            hS += `<li class="selection-row ${sel ? 'selected' : ''}" onclick="toggleSelect(${p.id})">
                    <div class="p-info">
                        <b>${p.name}</b>
                        <small>C:${p.run} P:${p.foot} V:${p.vers}</small>
                    </div>
                    <b style="color:var(--accent); font-size:16px;">${p.overall}</b>
                   </li>`;
        }
    });
    document.getElementById('selection-player-list').innerHTML = hS;
    document.getElementById('selected-count').innerText = selectedPlayersIds.length;

    // 3. STORICO
    var hH = "";
    matchHistory.forEach((m, index) => {
        hH += `<div class="history-card" onclick="toggleHistory(${index})">
                <div class="history-header">
                    <span>📅 ${m.date}</span>
                    <span style="color:var(--success)">${m.score}</span>
                </div>
                <div id="hist-det-${index}" class="history-details" style="display:none;">
                    <p style="margin-bottom:8px">🌟 MVP: <b>${m.mvp}</b></p>
                    <div style="background:#f9f9f9; padding:10px; border-radius:8px">
                        <p><b>Team A:</b> ${m.teamA ? m.teamA.join(", ") : ""}</p>
                        <p><b>Team B:</b> ${m.teamB ? m.teamB.join(", ") : ""}</p>
                    </div>
                </div>
               </div>`;
    });
    document.getElementById('history-list').innerHTML = hH;
}

// --- UTILITY ---
function toggleHistory(idx) {
    var el = document.getElementById('hist-det-' + idx);
    el.style.display = (el.style.display === 'block') ? 'none' : 'block';
}

function showSection(id) {
    document.getElementById('main-section').classList.add('hidden');
    document.getElementById('admin-section').classList.add('hidden');
    document.getElementById('history-section').classList.add('hidden');
    document.getElementById(id).classList.remove('hidden');
}
