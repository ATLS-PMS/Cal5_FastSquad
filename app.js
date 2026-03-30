var playersPool = [];
var selectedPlayersIds = [];
var matchHistory = [];
var currentTeams = { a: [], b: [] };

var GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbz7-eZ5kua5H6dIEZmi10AOEq6Qbihvnq-JBKRrBLsJ6JYC_dKTg2Xx-MQVozs7aT1N/exec"; 

window.onload = function() {
    var p = localStorage.getItem('fc_players');
    var h = localStorage.getItem('fc_history');
    var t = localStorage.getItem('fc_current_teams');
    
    if(p) playersPool = JSON.parse(p);
    if(h) matchHistory = JSON.parse(h);
    if(t) currentTeams = JSON.parse(t);
    
    renderAll();
    
    // Se c'erano squadre generate ma non salvate, mostrale
    if(currentTeams.a && currentTeams.a.length > 0) {
        document.getElementById('teams-result').className = '';
        renderActiveTeams();
    }
};

function saveData() {
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    localStorage.setItem('fc_history', JSON.stringify(matchHistory));
    localStorage.setItem('fc_current_teams', JSON.stringify(currentTeams));
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

    if(!name) { alert("Inserisci un nome"); return; }
    
    var overall = Math.round((r + f + v) / 3);
    var trovato = false;
    for(var i=0; i<playersPool.length; i++) {
        if(playersPool[i].name.toLowerCase() === name.toLowerCase()) {
            playersPool[i].run=r; playersPool[i].foot=f; playersPool[i].vers=v; playersPool[i].overall=overall;
            trovato = true; break;
        }
    }
    if(!trovato) {
        playersPool.push({id:Date.now(), name:name, run:r, foot:f, vers:v, overall:overall, wins:0, available:true});
    }
    saveData(); renderAll();
    document.getElementById('player-name').value = "";
    document.getElementById('stat-run').value = ""; document.getElementById('stat-foot').value = ""; document.getElementById('stat-vers').value = "";
}

function deletePlayer(id) {
    if(!confirm("Eliminare definitivamente?")) return;
    var nuovo = [];
    for(var i=0; i<playersPool.length; i++) {
        if(playersPool[i].id !== id) nuovo.push(playersPool[i]);
    }
    playersPool = nuovo; saveData(); renderAll();
}

function toggleAvail(id) {
    for(var i=0; i<playersPool.length; i++) {
        if(playersPool[i].id === id) { playersPool[i].available = !playersPool[i].available; break; }
    }
    saveData(); renderAll();
}

function toggleSelect(id) {
    var idx = selectedPlayersIds.indexOf(id);
    if(idx > -1) selectedPlayersIds.splice(idx, 1);
    else if(selectedPlayersIds.length < 10) selectedPlayersIds.push(id);
    renderAll();
}

function generateTeams() {
    if(selectedPlayersIds.length !== 10) { alert("Seleziona 10 persone!"); return; }
    var playing = [];
    for(var i=0; i<playersPool.length; i++) {
        if(selectedPlayersIds.indexOf(playersPool[i].id) > -1) playing.push(playersPool[i]);
    }
    
    playing.sort(function() { return 0.5 - Math.random(); });
    currentTeams.a = playing.slice(0, 5);
    currentTeams.b = playing.slice(5, 10);

    saveData();
    renderActiveTeams();
    document.getElementById('teams-result').className = '';
}

function renderActiveTeams() {
    var hA = ""; for(var a=0; a<5; a++) hA += "<li>"+currentTeams.a[a].name+"</li>";
    document.querySelector('#team-a ul').innerHTML = hA;
    
    var hB = ""; for(var b=0; b<5; b++) hB += "<li>"+currentTeams.b[b].name+"</li>";
    document.querySelector('#team-b ul').innerHTML = hB;

    var playing = currentTeams.a.concat(currentTeams.b);
    var hMVP = "<option value=''>-- Seleziona MVP --</option>";
    for(var m=0; m<playing.length; m++) hMVP += "<option value='"+playing[m].name+"'>"+playing[m].name+"</option>";
    document.getElementById('mvp-select').innerHTML = hMVP;
}

function saveMatch(winner) {
    var mvp = document.getElementById('mvp-select').value;
    if(!mvp) { alert("Scegli l'MVP!"); return; }

    var nomiA = [];
    for(var i=0; i<currentTeams.a.length; i++) {
        nomiA.push(currentTeams.a[i].name);
        if(winner === 'A') {
            var pA = playersPool.find(function(x){return x.id === currentTeams.a[i].id});
            if(pA) pA.wins++;
        }
    }
    
    var nomiB = [];
    for(var j=0; j<currentTeams.b.length; j++) {
        nomiB.push(currentTeams.b[j].name);
        if(winner === 'B') {
            var pB = playersPool.find(function(x){return x.id === currentTeams.b[j].id});
            if(pB) pB.wins++;
        }
    }

    var match = {
        date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
        score: (winner === 'Pareggio') ? 'Pareggio' : 'Vince ' + winner,
        mvp: mvp,
        teamA: nomiA,
        teamB: nomiB
    };

    // INVIO A GOOGLE SHEETS
    if(GOOGLE_SHEET_URL && GOOGLE_SHEET_URL.length > 10) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", GOOGLE_SHEET_URL, true);
        xhr.send(JSON.stringify(match));
    }

    matchHistory.unshift(match);
    selectedPlayersIds = [];
    currentTeams = { a: [], b: [] }; 
    for(var k=0; k<playersPool.length; k++) playersPool[k].available = false;
    
    saveData(); renderAll();
    document.getElementById('teams-result').className = 'hidden';
    alert("Partita archiviata!");
}

function renderAll() {
    // 1. LISTA ADMIN
    var hM = "";
    var poolOrdinato = playersPool.slice().sort(function(a,b){return b.wins - a.wins;});
    for(var i=0; i<poolOrdinato.length; i++) {
        var p = poolOrdinato[i];
        var bgClass = p.available ? "card-avail" : "card-absent";
        hM += "<li class='"+bgClass+"'>" +
              "<div class='p-info'><b>"+p.name+"</b><small>C:"+p.run+" P:"+p.foot+" V:"+p.vers+" | 🏆"+p.wins+"</small></div>" +
              "<div class='p-btns'>" +
              "<button class='btn-avail' onclick='toggleAvail("+p.id+")'>"+(p.available?'PRESENTE':'ASSENTE')+"</button>" +
              "<button class='btn-del' onclick='deletePlayer("+p.id+")'>X</button></div></li>";
    }
    document.getElementById('master-player-list').innerHTML = hM;

    // 2. LISTA CAMPO
    var hS = "";
    for(var j=0; j<playersPool.length; j++) {
        var p2 = playersPool[j];
        if(p2.available) {
            var sel = (selectedPlayersIds.indexOf(p2.id) > -1);
            hS += "<li class='selection-row "+(sel?"selected":"")+"' onclick='toggleSelect("+p2.id+")'>"+p2.name+" <span class='badge-ovr'>"+p2.overall+"</span></li>";
        }
    }
    document.getElementById('selection-player-list').innerHTML = hS;
    document.getElementById('selected-count').innerText = selectedPlayersIds.length;

    // 3. STORICO ESPANDIBILE
    var hH = "";
    for(var k=0; k < matchHistory.length; k++) {
        var m = matchHistory[k];
        hH += "<div class='history-card' onclick='this.classList.toggle(\"open\")'>" +
              "<div style='display:flex; justify-content:space-between'><b>"+m.date+"</b><b>"+m.score+"</b></div>" +
              "<div style='color:#e67e22; font-size:12px; margin-top:3px'>MVP: "+m.mvp+"</div>" +
              "<div class='history-details'><div class='team-list-history'>" +
              "<div><b>Squadra A</b>"+(m.teamA?m.teamA.join('<br>'):'-')+"</div>" +
              "<div><b>Squadra B</b>"+(m.teamB?m.teamB.join('<br>'):'-')+"</div>" +
              "</div></div></div>";
    }
    document.getElementById('history-list').innerHTML = hH;
}

function copyTeamsToClipboard() {
    var txt = "⚽ SQUADRE DEL PROSSIMO MATCH\n\n🔴 A:\n";
    for(var i=0; i<5; i++) txt += "- " + currentTeams.a[i].name + "\n";
    txt += "\n🔵 B:\n";
    for(var j=0; j<5; j++) txt += "- " + currentTeams.b[j].name + "\n";
    var el = document.createElement('textarea'); el.value = txt; document.body.appendChild(el);
    el.select(); document.execCommand('copy'); document.body.removeChild(el);
    alert("Formazioni copiate!");
}

function clearHistory() {
    if(confirm("Vuoi cancellare tutto?")) {
        matchHistory = []; for(var i=0; i<playersPool.length; i++) playersPool[i].wins = 0;
        saveData(); renderAll();
    }
}
