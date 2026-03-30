var playersPool = [];
var selectedPlayersIds = [];
var matchHistory = [];
var currentTeams = { a: [], b: [] };

var GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyts2iYS6Ex5-uo1V636TUpL1Qeab-LPx3F_7nW9Ezh_f7xDRFVOAw6x065AEn-oT8W/exec"; 

window.onload = function() {
    loadLocal();
    syncFromCloud();
};

function loadLocal() {
    var p = localStorage.getItem('fc_players');
    var h = localStorage.getItem('fc_history');
    if(p) playersPool = JSON.parse(p);
    if(h) matchHistory = JSON.parse(h);
    renderAll();
}

function saveData() {
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    localStorage.setItem('fc_history', JSON.stringify(matchHistory));
}

// Invia i dati al cloud includendo lo stato "available" attuale
function pushToCloud() {
    if(!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.length < 10) return;
    var payload = { 
        players: playersPool, 
        history: matchHistory,
        isSyncOnly: true // Flag per dire allo script di non aggiungere righe alle partite
    };
    fetch(GOOGLE_SHEET_URL, { method: 'POST', body: JSON.stringify(payload) })
    .then(() => console.log("Cloud aggiornato"))
    .catch(e => console.error(e));
}

function syncFromCloud() {
    if(!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.length < 10) return;
    document.getElementById('cloud-status').innerText = "☁️ Sincronizzazione...";
    fetch(GOOGLE_SHEET_URL)
        .then(response => response.json())
        .then(cloudData => {
            if(cloudData && cloudData.players) {
                playersPool = cloudData.players;
                matchHistory = cloudData.history || [];
                saveData(); renderAll();
                document.getElementById('cloud-status').innerText = "✅ Cloud Sincronizzato";
            }
        })
        .catch(() => { document.getElementById('cloud-status').innerText = "❌ Errore Cloud"; });
}

function addPlayer() {
    var name = document.getElementById('player-name').value.trim();
    var r = parseInt(document.getElementById('stat-run').value) || 5;
    var f = parseInt(document.getElementById('stat-foot').value) || 5;
    var v = parseInt(document.getElementById('stat-vers').value) || 5;
    if(!name) return;
    var overall = Math.round((r + f + v) / 3);
    var trovato = false;
    for(var i=0; i<playersPool.length; i++) {
        if(playersPool[i].name.toLowerCase() === name.toLowerCase()) {
            playersPool[i].run=r; playersPool[i].foot=f; playersPool[i].vers=v; playersPool[i].overall=overall;
            trovato = true; break;
        }
    }
    if(!trovato) playersPool.push({id:Date.now(), name:name, run:r, foot:f, vers:v, overall:overall, wins:0, available:true});
    saveData(); renderAll(); pushToCloud();
    document.getElementById('player-name').value = "";
}

function toggleAvail(id) {
    for(var i=0; i<playersPool.length; i++) {
        if(playersPool[i].id === id) { playersPool[i].available = !playersPool[i].available; break; }
    }
    saveData(); renderAll(); pushToCloud(); // Sincronizza lo stato P/A subito
}

function deletePlayer(id) {
    if(!confirm("Eliminare?")) return;
    playersPool = playersPool.filter(p => p.id !== id);
    saveData(); renderAll(); pushToCloud();
}

function generateTeams() {
    if(selectedPlayersIds.length !== 10) { alert("Seleziona 10 persone"); return; }
    var p = playersPool.filter(pl => selectedPlayersIds.indexOf(pl.id) > -1);
    var bestDiff = Infinity;
    var bestA = [], bestB = [];

    for(var i=0; i<500; i++) {
        p.sort(() => 0.5 - Math.random());
        var tempA = p.slice(0, 5), tempB = p.slice(5, 10);
        var sA = calcStats(tempA), sB = calcStats(tempB);
        var diff = Math.abs(sA.avgOvr - sB.avgOvr) * 2 + Math.abs(sA.avgRun - sB.avgRun) + Math.abs(sA.avgFoot - sB.avgFoot);
        if(diff < bestDiff) { bestDiff = diff; bestA = [...tempA]; bestB = [...tempB]; }
    }
    currentTeams.a = bestA; currentTeams.b = bestB;
    renderActiveTeams();
    document.getElementById('teams-result').className = '';
}

function calcStats(team) {
    var s = { ovr:0, run:0, foot:0, vers:0 };
    team.forEach(p => { s.ovr += p.overall; s.run += p.run; s.foot += p.foot; s.vers += p.vers; });
    return { avgOvr: s.ovr/5, avgRun: s.run/5, avgFoot: s.foot/5, avgVers: s.vers/5 };
}

function renderActiveTeams() {
    var sA = calcStats(currentTeams.a), sB = calcStats(currentTeams.b);
    var renderT = (id, title, team, stats) => {
        var h = `<div class="team-header"><h3>${title}</h3><span class="team-avg-badge">OVR: ${stats.avgOvr.toFixed(1)}</span></div><ul>`;
        team.forEach(p => h += `<li><span>${p.name}</span><span class="player-ovr-small">OVR ${p.overall}</span></li>`);
        h += `</ul>`;
        document.getElementById(id).innerHTML = h;
    };
    renderT('team-a', 'SQUADRA A', currentTeams.a, sA);
    renderT('team-b', 'SQUADRA B', currentTeams.b, sB);
    var hMVP = "<option value=''>-- MVP --</option>";
    currentTeams.a.concat(currentTeams.b).forEach(p => hMVP += `<option value="${p.name}">${p.name}</option>`);
    document.getElementById('mvp-select').innerHTML = hMVP;
}

function saveMatch(winner) {
    var mvp = document.getElementById('mvp-select').value;
    if(!mvp) { alert("Scegli l'MVP!"); return; }
    if(winner === 'A') currentTeams.a.forEach(tp => { var p = playersPool.find(x => x.id === tp.id); if(p) p.wins++; });
    if(winner === 'B') currentTeams.b.forEach(tp => { var p = playersPool.find(x => x.id === tp.id); if(p) p.wins++; });
    
    var match = {
        date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        score: winner === 'Pareggio' ? 'Pareggio' : 'Vince ' + winner,
        mvp: mvp, teamA: currentTeams.a.map(p=>p.name), teamB: currentTeams.b.map(p=>p.name)
    };
    matchHistory.unshift(match);
    var payload = { players: playersPool, history: matchHistory, ...match };
    fetch(GOOGLE_SHEET_URL, { method: 'POST', body: JSON.stringify(payload) });
    
    selectedPlayersIds = [];
    playersPool.forEach(p => p.available = false);
    saveData(); renderAll();
    document.getElementById('teams-result').className = 'hidden';
}

function renderAll() {
    var hM = "";
    playersPool.slice().sort((a,b) => b.wins - a.wins).forEach(p => {
        var btnClass = p.available ? 'is-avail' : 'is-absent';
        hM += `<li class="${p.available?'card-avail':'card-absent'}">
                <div class="p-info"><b>${p.name}</b><small>OVR:${p.overall} | 🏆${p.wins}</small></div>
                <div class="p-btns">
                    <button class="btn-p-a ${btnClass}" onclick="toggleAvail(${p.id})">${p.available?'PRESENTE':'ASSENTE'}</button>
                    <button class="btn-del" onclick="deletePlayer(${p.id})">X</button>
                </div></li>`;
    });
    document.getElementById('master-player-list').innerHTML = hM;
    var hS = "";
    playersPool.forEach(p => {
        if(p.available) {
            var sel = selectedPlayersIds.indexOf(p.id) > -1;
            hS += `<li class="selection-row ${sel?'selected':''}" onclick="toggleSelect(${p.id})">${p.name} <span>${p.overall}</span></li>`;
        }
    });
    document.getElementById('selection-player-list').innerHTML = hS;
    document.getElementById('selected-count').innerText = selectedPlayersIds.length;
    var hH = "";
    matchHistory.forEach(m => hH += `<div class="history-card" onclick="this.classList.toggle('open')"><b>${m.date}</b>: ${m.score}<div class="history-details">MVP: ${m.mvp}</div></div>`);
    document.getElementById('history-list').innerHTML = hH;
}

function showSection(id) {
    document.getElementById('main-section').className = 'hidden';
    document.getElementById('admin-section').className = 'hidden';
    document.getElementById('history-section').className = 'hidden';
    document.getElementById(id).className = '';
}

function copyTeamsToClipboard() {
    var txt = "SQUADRE:\nA: " + currentTeams.a.map(p => p.name).join(", ") + "\nB: " + currentTeams.b.map(p => p.name).join(", ");
    navigator.clipboard.writeText(txt).then(() => alert("Copiato!"));
}

function clearHistory() {
    if(confirm("Reset totale?")) {
        matchHistory = []; playersPool.forEach(p => p.wins = 0);
        saveData(); renderAll(); pushToCloud();
    }
}

window.onload = function() {
    loadLocal();
    syncFromCloud();
};

function loadLocal() {
    var p = localStorage.getItem('fc_players');
    var h = localStorage.getItem('fc_history');
    if(p) playersPool = JSON.parse(p);
    if(h) matchHistory = JSON.parse(h);
    renderAll();
}

function saveData() {
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    localStorage.setItem('fc_history', JSON.stringify(matchHistory));
}

function syncFromCloud() {
    if(!GOOGLE_SHEET_URL || GOOGLE_SHEET_URL.length < 10) return;
    document.getElementById('cloud-status').innerText = "☁️ Sincronizzazione in corso...";
    fetch(GOOGLE_SHEET_URL)
        .then(response => response.json())
        .then(cloudData => {
            if(cloudData && cloudData.players) {
                playersPool = cloudData.players;
                matchHistory = cloudData.history || [];
                saveData(); renderAll();
                document.getElementById('cloud-status').innerText = "✅ Cloud Sincronizzato";
            }
        })
        .catch(() => { document.getElementById('cloud-status').innerText = "❌ Errore Cloud"; });
}

function showSection(id) {
    document.getElementById('main-section').className = 'hidden';
    document.getElementById('admin-section').className = 'hidden';
    document.getElementById('history-section').className = 'hidden';
    document.getElementById(id).className = '';
}

function addPlayer() {
    var name = document.getElementById('player-name').value.trim();
    var r = parseInt(document.getElementById('stat-run').value) || 5;
    var f = parseInt(document.getElementById('stat-foot').value) || 5;
    var v = parseInt(document.getElementById('stat-vers').value) || 5;
    if(!name) return;
    var overall = Math.round((r + f + v) / 3);
    var trovato = false;
    for(var i=0; i<playersPool.length; i++) {
        if(playersPool[i].name.toLowerCase() === name.toLowerCase()) {
            playersPool[i].run=r; playersPool[i].foot=f; playersPool[i].vers=v; playersPool[i].overall=overall;
            trovato = true; break;
        }
    }
    if(!trovato) playersPool.push({id:Date.now(), name:name, run:r, foot:f, vers:v, overall:overall, wins:0, available:true});
    saveData(); renderAll();
    document.getElementById('player-name').value = "";
}

function toggleAvail(id) {
    for(var i=0; i<playersPool.length; i++) {
        if(playersPool[i].id === id) { playersPool[i].available = !playersPool[i].available; break; }
    }
    saveData(); renderAll();
}

function deletePlayer(id) {
    if(!confirm("Eliminare?")) return;
    playersPool = playersPool.filter(p => p.id !== id);
    saveData(); renderAll();
}

function toggleSelect(id) {
    var idx = selectedPlayersIds.indexOf(id);
    if(idx > -1) selectedPlayersIds.splice(idx, 1);
    else if(selectedPlayersIds.length < 10) selectedPlayersIds.push(id);
    renderAll();
}

// NUOVO ALGORITMO DI BILANCIAMENTO
function generateTeams() {
    if(selectedPlayersIds.length !== 10) { alert("Seleziona esattamente 10 persone"); return; }
    var p = playersPool.filter(pl => selectedPlayersIds.indexOf(pl.id) > -1);
    
    var bestDiff = Infinity;
    var bestA = [];
    var bestB = [];

    // Eseguiamo 500 simulazioni per trovare la combinazione più equilibrata
    for(var i=0; i<500; i++) {
        p.sort(() => 0.5 - Math.random());
        var tempA = p.slice(0, 5);
        var tempB = p.slice(5, 10);

        var statsA = calcStats(tempA);
        var statsB = calcStats(tempB);

        // Calcoliamo la differenza totale (Overall + singole statistiche)
        var diff = Math.abs(statsA.avgOvr - statsB.avgOvr) * 2 + // Peso maggiore all'overall
                   Math.abs(statsA.avgRun - statsB.avgRun) +
                   Math.abs(statsA.avgFoot - statsB.avgFoot) +
                   Math.abs(statsA.avgVers - statsB.avgVers);

        if(diff < bestDiff) {
            bestDiff = diff;
            bestA = [...tempA];
            bestB = [...tempB];
        }
    }

    currentTeams.a = bestA;
    currentTeams.b = bestB;
    renderActiveTeams();
    document.getElementById('teams-result').className = '';
}

function calcStats(team) {
    var s = { ovr:0, run:0, foot:0, vers:0 };
    team.forEach(p => {
        s.ovr += p.overall; s.run += p.run; s.foot += p.foot; s.vers += p.vers;
    });
    return {
        avgOvr: s.ovr / 5, avgRun: s.run / 5, avgFoot: s.foot / 5, avgVers: s.vers / 5
    };
}

function renderActiveTeams() {
    var statsA = calcStats(currentTeams.a);
    var statsB = calcStats(currentTeams.b);

    var renderTeam = (targetId, title, team, stats) => {
        var html = `<div class="team-header"><h3>${title}</h3><span class="team-avg-badge">Media OVR: ${stats.avgOvr.toFixed(1)}</span></div><ul>`;
        team.forEach(p => {
            html += `<li><span>${p.name}</span><span class="player-ovr-small">OVR ${p.overall} (C:${p.run} P:${p.foot})</span></li>`;
        });
        html += `</ul><div style="font-size:9px; color:#999; margin-top:5px; text-align:right">C:${stats.avgRun.toFixed(1)} | P:${stats.avgFoot.toFixed(1)} | V:${stats.avgVers.toFixed(1)}</div>`;
        document.getElementById(targetId).innerHTML = html;
    };

    renderTeam('team-a', 'SQUADRA A', currentTeams.a, statsA);
    renderTeam('team-b', 'SQUADRA B', currentTeams.b, statsB);

    var hMVP = "<option value=''>-- Seleziona MVP --</option>";
    currentTeams.a.concat(currentTeams.b).forEach(p => hMVP += `<option value="${p.name}">${p.name}</option>`);
    document.getElementById('mvp-select').innerHTML = hMVP;
}

function saveMatch(winner) {
    var mvp = document.getElementById('mvp-select').value;
    if(!mvp) { alert("Scegli l'MVP!"); return; }
    var nomiA = currentTeams.a.map(p => p.name);
    var nomiB = currentTeams.b.map(p => p.name);
    if(winner === 'A') currentTeams.a.forEach(tp => { var p = playersPool.find(x => x.id === tp.id); if(p) p.wins++; });
    if(winner === 'B') currentTeams.b.forEach(tp => { var p = playersPool.find(x => x.id === tp.id); if(p) p.wins++; });
    var match = {
        date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        score: winner === 'Pareggio' ? 'Pareggio' : 'Vince ' + winner,
        mvp: mvp, teamA: nomiA, teamB: nomiB
    };
    matchHistory.unshift(match);
    var payload = { players: playersPool, history: matchHistory, ...match };
    fetch(GOOGLE_SHEET_URL, { method: 'POST', body: JSON.stringify(payload) }).catch(e => console.error(e));
    selectedPlayersIds = [];
    currentTeams = { a: [], b: [] };
    playersPool.forEach(p => p.available = false);
    saveData(); renderAll();
    document.getElementById('teams-result').className = 'hidden';
    alert("Partita archiviata!");
}

function renderAll() {
    var hM = "";
    playersPool.slice().sort((a,b) => b.wins - a.wins).forEach(p => {
        hM += `<li class="${p.available?'card-avail':'card-absent'}">
                <div class="p-info"><b>${p.name}</b><small>C:${p.run} P:${p.foot} V:${p.vers} | 🏆${p.wins}</small></div>
                <div class="p-btns"><button class="btn-avail" onclick="toggleAvail(${p.id})">P/A</button>
                <button class="btn-del" onclick="deletePlayer(${p.id})">X</button></div></li>`;
    });
    document.getElementById('master-player-list').innerHTML = hM;
    var hS = "";
    playersPool.forEach(p => {
        if(p.available) {
            var sel = selectedPlayersIds.indexOf(p.id) > -1;
            hS += `<li class="selection-row ${sel?'selected':''}" onclick="toggleSelect(${p.id})">${p.name} <span style="font-size:10px; color:gray">OVR:${p.overall}</span></li>`;
        }
    });
    document.getElementById('selection-player-list').innerHTML = hS;
    document.getElementById('selected-count').innerText = selectedPlayersIds.length;
    var hH = "";
    matchHistory.forEach(m => {
        hH += `<div class="history-card" onclick="this.classList.toggle('open')"><b>${m.date}</b>: ${m.score}<div class="history-details">MVP: ${m.mvp}<br>A: ${m.teamA.join(", ")}<br>B: ${m.teamB.join(", ")}</div></div>`;
    });
    document.getElementById('history-list').innerHTML = hH;
}

function copyTeamsToClipboard() {
    var txt = "SQUADRE:\nA: " + currentTeams.a.map(p => p.name).join(", ") + "\nB: " + currentTeams.b.map(p => p.name).join(", ");
    navigator.clipboard.writeText(txt).then(() => alert("Copiato!"));
}

function clearHistory() {
    if(confirm("Reset totale?")) {
        matchHistory = []; playersPool.forEach(p => p.wins = 0);
        saveData(); renderAll();
    }
}
