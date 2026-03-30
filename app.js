var playersPool = [];
var selectedPlayersIds = [];
var matchHistory = [];
var currentTeams = { a: [], b: [] };

var GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbwqq2h8faSalSOlfZCCXwL6Qhu7n4L_ufcCDSqepY2jvYYOJfJDXZRAgre2qyPW9OBK/exec"; 

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
    document.getElementById('cloud-status').innerText = "Sincronizzazione Cloud...";
    
    var xhr = new XMLHttpRequest();
    xhr.open("GET", GOOGLE_SHEET_URL, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200) {
            try {
                var cloudData = JSON.parse(xhr.responseText);
                if(cloudData.players) {
                    playersPool = cloudData.players;
                    matchHistory = cloudData.history || [];
                    saveData();
                    renderAll();
                    document.getElementById('cloud-status').innerText = "✅ Dati Sincronizzati dal Cloud";
                } else {
                    document.getElementById('cloud-status').innerText = "☁️ Cloud pronto (nuovo)";
                }
            } catch(e) {
                document.getElementById('cloud-status').innerText = "⚠️ Nessun dato sul Cloud";
            }
        }
    };
    xhr.send();
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
    if(!name) { alert("Nome obbligatorio"); return; }
    
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
    if(!confirm("Eliminare giocatore?")) return;
    playersPool = playersPool.filter(function(p){ return p.id !== id; });
    saveData(); renderAll();
}

function toggleSelect(id) {
    var idx = selectedPlayersIds.indexOf(id);
    if(idx > -1) selectedPlayersIds.splice(idx, 1);
    else if(selectedPlayersIds.length < 10) selectedPlayersIds.push(id);
    renderAll();
}

function generateTeams() {
    if(selectedPlayersIds.length !== 10) { alert("Seleziona 10 persone"); return; }
    var playing = playersPool.filter(function(p){ return selectedPlayersIds.indexOf(p.id) > -1; });
    
    // Mischia
    playing.sort(function() { return 0.5 - Math.random(); });
    currentTeams.a = playing.slice(0, 5);
    currentTeams.b = playing.slice(5, 10);
    
    var hA = ""; currentTeams.a.forEach(function(p){ hA += "<li>"+p.name+"</li>"; });
    document.querySelector('#team-a ul').innerHTML = hA;
    var hB = ""; currentTeams.b.forEach(function(p){ hB += "<li>"+p.name+"</li>"; });
    document.querySelector('#team-b ul').innerHTML = hB;
    
    var hMVP = "<option value=''>-- Seleziona MVP --</option>";
    playing.forEach(function(p){ hMVP += "<option value='"+p.name+"'>"+p.name+"</option>"; });
    document.getElementById('mvp-select').innerHTML = hMVP;
    
    document.getElementById('teams-result').className = '';
}

function saveMatch(winner) {
    var mvp = document.getElementById('mvp-select').value;
    if(!mvp) { alert("Scegli l'MVP!"); return; }

    var nomiA = currentTeams.a.map(function(p){ return p.name; });
    var nomiB = currentTeams.b.map(function(p){ return p.name; });

    if(winner === 'A') {
        currentTeams.a.forEach(function(tp){
            var p = playersPool.find(function(xp){return xp.id === tp.id});
            if(p) p.wins++;
        });
    } else if(winner === 'B') {
        currentTeams.b.forEach(function(tp){
            var p = playersPool.find(function(xp){return xp.id === tp.id});
            if(p) p.wins++;
        });
    }

    var match = {
        date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        score: (winner === 'Pareggio') ? 'Pareggio' : 'Vince ' + winner,
        mvp: mvp,
        teamA: nomiA,
        teamB: nomiB
    };

    matchHistory.unshift(match);
    
    // Backup Cloud
    var payload = { players: playersPool, history: matchHistory, date: match.date, score: match.score, mvp: match.mvp, teamA: nomiA, teamB: nomiB };
    var xhr = new XMLHttpRequest();
    xhr.open("POST", GOOGLE_SHEET_URL, true);
    xhr.send(JSON.stringify(payload));

    selectedPlayersIds = [];
    currentTeams = { a: [], b: [] }; 
    playersPool.forEach(function(p){ p.available = false; });
    
    saveData(); renderAll();
    document.getElementById('teams-result').className = 'hidden';
    alert("Partita salvata e sincronizzata!");
}

function renderAll() {
    // Admin List
    var hM = "";
    var poolOrdinato = playersPool.slice().sort(function(a,b){return b.wins - a.wins;});
    poolOrdinato.forEach(function(p){
        hM += "<li class='"+(p.available?"card-avail":"card-absent")+"'>" +
              "<div><b>"+p.name+"</b><br><small>C:"+p.run+" P:"+p.foot+" V:"+p.vers+" | 🏆"+p.wins+"</small></div>" +
              "<div class='p-btns'><button class='btn-avail' onclick='toggleAvail("+p.id+")'>P/A</button>" +
              "<button class='btn-del' onclick='deletePlayer("+p.id+")'>X</button></div></li>";
    });
    document.getElementById('master-player-list').innerHTML = hM;

    // Selection List
    var hS = "";
    playersPool.forEach(function(p){
        if(p.available) {
            var sel = (selectedPlayersIds.indexOf(p.id) > -1);
            hS += "<li class='selection-row "+(sel?"selected":"")+"' onclick='toggleSelect("+p.id+")'>"+p.name+" <span style='font-size:10px; color:gray'>OVR:"+p.overall+"</span></li>";
        }
    });
    document.getElementById('selection-player-list').innerHTML = hS;
    document.getElementById('selected-count').innerText = selectedPlayersIds.length;

    // History List
    var hH = "";
    matchHistory.forEach(function(m){
        hH += "<div class='history-card' onclick='this.classList.toggle(\"open\")'>" +
              "<b>"+m.date+"</b>: "+m.score+"<div class='history-details'>" +
              "MVP: <b>"+m.mvp+"</b><br>A: "+m.teamA.join(", ")+"<br>B: "+m.teamB.join(", ")+"</div></div>";
    });
    document.getElementById('history-list').innerHTML = hH;
}

function copyTeamsToClipboard() {
    var txt = "SQUADRE:\nA: " + currentTeams.a.map(function(p){return p.name}).join(", ") + "\nB: " + currentTeams.b.map(function(p){return p.name}).join(", ");
    var el = document.createElement('textarea'); el.value = txt; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el);
    alert("Copiato!");
}

function clearHistory() {
    if(confirm("Resettare tutto?")) {
        matchHistory = []; playersPool.forEach(function(p){p.wins=0;});
        saveData(); renderAll();
    }
}
