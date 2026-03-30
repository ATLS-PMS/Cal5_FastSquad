var playersPool = [];
var selectedPlayersIds = [];
var matchHistory = [];
var currentTeams = { a: [], b: [] };

var GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzmv9q4YjQ3hfvvRYGrPyBZQcoMtGSX_a-HK7T6zHymgf-3ODMH9Jos8NsCk-LD9Kp1/exec"; 

window.onload = function() {
    var p = localStorage.getItem('fc_players');
    var h = localStorage.getItem('fc_history');
    if(p) playersPool = JSON.parse(p);
    if(h) matchHistory = JSON.parse(h);
    renderAll();
};

function saveData() {
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    localStorage.setItem('fc_history', JSON.stringify(matchHistory));
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
}

function toggleAvail(id) {
    for(var i=0; i<playersPool.length; i++) {
        if(playersPool[i].id === id) { playersPool[i].available = !playersPool[i].available; break; }
    }
    saveData(); renderAll();
}

function deletePlayer(id) {
    if(!confirm("Eliminare?")) return;
    var nuovo = [];
    for(var i=0; i<playersPool.length; i++) {
        if(playersPool[i].id !== id) nuovo.push(playersPool[i]);
    }
    playersPool = nuovo; saveData(); renderAll();
}

function toggleSelect(id) {
    var idx = selectedPlayersIds.indexOf(id);
    if(idx > -1) selectedPlayersIds.splice(idx, 1);
    else if(selectedPlayersIds.length < 10) selectedPlayersIds.push(id);
    renderAll();
}

function generateTeams() {
    if(selectedPlayersIds.length !== 10) { alert("Seleziona 10 persone"); return; }
    var playing = [];
    for(var i=0; i<playersPool.length; i++) {
        if(selectedPlayersIds.indexOf(playersPool[i].id) > -1) playing.push(playersPool[i]);
    }
    
    // Mischia e Bilancia (Semplificato per stabilità)
    playing.sort(function() { return 0.5 - Math.random(); });
    currentTeams.a = playing.slice(0, 5);
    currentTeams.b = playing.slice(5, 10);

    var hA = ""; for(var a=0; a<5; a++) hA += "<li>"+currentTeams.a[a].name+"</li>";
    document.querySelector('#team-a ul').innerHTML = hA;
    
    var hB = ""; for(var b=0; b<5; b++) hB += "<li>"+currentTeams.b[b].name+"</li>";
    document.querySelector('#team-b ul').innerHTML = hB;

    var hMVP = "<option value=''>-- Seleziona MVP --</option>";
    for(var m=0; m<playing.length; m++) hMVP += "<option value='"+playing[m].name+"'>"+playing[m].name+"</option>";
    document.getElementById('mvp-select').innerHTML = hMVP;
    
    document.getElementById('teams-result').className = '';
}

function saveMatch(winner) {
    var mvp = document.getElementById('mvp-select').value;
    if(!mvp) { alert("Scegli l'MVP!"); return; }

    if(winner === 'A' || winner === 'B') {
        var vincenti = (winner === 'A') ? currentTeams.a : currentTeams.b;
        for(var i=0; i<5; i++) {
            for(var j=0; j<playersPool.length; j++) {
                if(playersPool[j].id === vincenti[i].id) playersPool[j].wins++;
            }
        }
    }

    var match = {
        date: new Date().toLocaleDateString(),
        score: (winner === 'Pareggio') ? 'Pareggio' : 'Vince ' + winner,
        mvp: mvp,
        teamA: [], teamB: []
    };
    for(var x=0; x<5; x++) { match.teamA.push(currentTeams.a[x].name); match.teamB.push(currentTeams.b[x].name); }

    // INVIO A GOOGLE SHEETS
    if(GOOGLE_SHEET_URL && GOOGLE_SHEET_URL.length > 10) {
        var xhr = new XMLHttpRequest();
        xhr.open("POST", GOOGLE_SHEET_URL, true);
        xhr.send(JSON.stringify(match));
    }

    matchHistory.unshift(match);
    selectedPlayersIds = [];
    for(var k=0; k<playersPool.length; k++) playersPool[k].available = false;
    
    saveData(); renderAll();
    document.getElementById('teams-result').className = 'hidden';
    alert("Salvato con successo!");
}

function renderAll() {
    var hM = "";
    var poolOrdinato = playersPool.slice().sort(function(a,b){return b.wins - a.wins;});
    for(var i=0; i<poolOrdinato.length; i++) {
        var p = poolOrdinato[i];
        hM += "<li><span>"+p.name+" (🏆"+p.wins+")</span><div>" +
              "<button style='width:auto; padding:5px; background:"+(p.available?"#27ae60":"#999")+"; color:white' onclick='toggleAvail("+p.id+")'>P/A</button> " +
              "<button style='width:auto; padding:5px; background:red; color:white' onclick='deletePlayer("+p.id+")'>X</button></div></li>";
    }
    document.getElementById('master-player-list').innerHTML = hM;

    var hS = "";
    for(var j=0; j<playersPool.length; j++) {
        var p2 = playersPool[j];
        if(p2.available) {
            var sel = (selectedPlayersIds.indexOf(p2.id) > -1);
            hS += "<li class='"+(sel?"selected":"")+"' onclick='toggleSelect("+p2.id+")'>"+p2.name+"</li>";
        }
    }
    document.getElementById('selection-player-list').innerHTML = hS;
    document.getElementById('selected-count').innerText = selectedPlayersIds.length;

    var hH = "";
    for(var k=0; k<matchHistory.length && k<10; k++) {
        var m = matchHistory[k];
        hH += "<div class='history-card'><b>"+m.date+"</b>: "+m.score+"<br><small>MVP: "+m.mvp+"</small></div>";
    }
    document.getElementById('history-list').innerHTML = hH;
}

function copyTeamsToClipboard() {
    var txt = "⚽ SQUADRE\n🔴 A: ";
    for(var i=0; i<5; i++) txt += currentTeams.a[i].name + (i<4?", ":"");
    txt += "\n🔵 B: ";
    for(var j=0; j<5; j++) txt += currentTeams.b[j].name + (j<4?", ":"");
    
    var el = document.createElement('textarea');
    el.value = txt; document.body.appendChild(el);
    el.select(); document.execCommand('copy');
    document.body.removeChild(el);
    alert("Copiato!");
}

function clearHistory() {
    if(confirm("Vuoi resettare tutto (anche le vittorie)?")) {
        matchHistory = [];
        for(var i=0; i<playersPool.length; i++) playersPool[i].wins = 0;
        saveData(); renderAll();
    }
}
