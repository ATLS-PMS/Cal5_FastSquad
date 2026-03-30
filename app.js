// Stato globale
var playersPool = [];
var selectedPlayersIds = new Set();
var matchHistory = [];
var currentTeams = { a: [], b: [] };

// CONFIGURAZIONE GOOGLE SHEETS (Opzionale: incolla il tuo URL tra le virgolette)
var GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzmv9q4YjQ3hfvvRYGrPyBZQcoMtGSX_a-HK7T6zHymgf-3ODMH9Jos8NsCk-LD9Kp1/exec"; 

// Inizializzazione al caricamento
window.onload = function() {
    loadData();
    renderAll();
    console.log("App pronta");
};

function loadData() {
    try {
        playersPool = JSON.parse(localStorage.getItem('fc_players') || '[]');
        matchHistory = JSON.parse(localStorage.getItem('fc_history') || '[]');
    } catch(e) {
        playersPool = [];
        matchHistory = [];
    }
}

function saveData() {
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    localStorage.setItem('fc_history', JSON.stringify(matchHistory));
}

// Navigazione
function showSection(id) {
    var sections = ['main-section', 'admin-section', 'history-section'];
    sections.forEach(function(s) {
        var el = document.getElementById(s);
        if (el) el.classList.add('hidden');
    });
    var target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
}

// Aggiunta Giocatore
function addPlayer() {
    var nameEl = document.getElementById('player-name');
    var r = parseInt(document.getElementById('stat-run').value);
    var f = document.getElementById('stat-foot').value; // Leggiamo come testo per sicurezza
    var v = document.getElementById('stat-vers').value;
    var name = nameEl.value.trim();

    if (!name || isNaN(r)) {
        alert("Inserisci almeno Nome e Corsa");
        return;
    }

    var run = parseInt(r);
    var foot = parseInt(f) || 5;
    var vers = parseInt(v) || 5;
    var overall = Math.round((run + foot + vers) / 3);

    var idx = playersPool.findIndex(function(p) { return p.name.toLowerCase() === name.toLowerCase(); });

    if (idx !== -1) {
        playersPool[idx].run = run;
        playersPool[idx].foot = foot;
        playersPool[idx].vers = vers;
        playersPool[idx].overall = overall;
    } else {
        playersPool.push({
            id: Date.now(),
            name: name,
            run: run,
            foot: foot,
            vers: vers,
            overall: overall,
            available: true,
            wins: 0
        });
    }

    saveData();
    renderAll();
    nameEl.value = "";
    alert("Salvato: " + name);
}

function toggleSelect(id) {
    if (selectedPlayersIds.has(id)) {
        selectedPlayersIds.delete(id);
    } else {
        if (selectedPlayersIds.size < 10) {
            selectedPlayersIds.add(id);
        } else {
            alert("Massimo 10 giocatori");
        }
    }
    renderAll();
}

function generateTeams() {
    if (selectedPlayersIds.size !== 10) {
        alert("Seleziona 10 giocatori");
        return;
    }

    var players = playersPool.filter(function(p) { return selectedPlayersIds.has(p.id); });
    players.sort(function() { return 0.5 - Math.random(); });

    currentTeams.a = players.slice(0, 5);
    currentTeams.b = players.slice(5, 10);

    var listA = document.querySelector('#team-a ul');
    var listB = document.querySelector('#team-b ul');
    
    if(listA) listA.innerHTML = currentTeams.a.map(function(p){ return "<li>"+p.name+"</li>"; }).join('');
    if(listB) listB.innerHTML = currentTeams.b.map(function(p){ return "<li>"+p.name+"</li>"; }).join('');

    var sel = document.getElementById('mvp-select');
    if (sel) {
        var all = currentTeams.a.concat(currentTeams.b);
        sel.innerHTML = '<option value="">-- MVP --</option>' + 
            all.map(function(p){ return '<option value="'+p.name+'">'+p.name+'</option>'; }).join('');
    }

    document.getElementById('teams-result').classList.remove('hidden');
}

function saveMatch(winner) {
    var mvp = document.getElementById('mvp-select').value;
    if (!mvp) { alert("Scegli l'MVP"); return; }

    if (winner === 'A') {
        currentTeams.a.forEach(function(p) {
            var found = playersPool.find(function(x){ return x.id === p.id; });
            if(found) found.wins = (found.wins || 0) + 1;
        });
    } else if (winner === 'B') {
        currentTeams.b.forEach(function(p) {
            var found = playersPool.find(function(x){ return x.id === p.id; });
            if(found) found.wins = (found.wins || 0) + 1;
        });
    }

    var match = {
        date: new Date().toLocaleDateString(),
        result: winner === 'Pareggio' ? 'Pareggio' : 'Vittoria ' + winner,
        mvp: mvp
    };

    matchHistory.unshift(match);
    selectedPlayersIds.clear();
    playersPool.forEach(function(p){ p.available = false; });
    
    saveData();
    renderAll();
    document.getElementById('teams-result').classList.add('hidden');
    alert("Partita registrata!");
}

function renderAll() {
    var master = document.getElementById('master-player-list');
    if (master) {
        master.innerHTML = playersPool.map(function(p) {
            return '<li>' + p.name + ' (Vittorie: ' + (p.wins || 0) + ') ' +
                   '<button onclick="toggleAvail(' + p.id + ')">' + (p.available ? 'Presente' : 'Assente') + '</button></li>';
        }).join('');
    }

    var selectList = document.getElementById('selection-player-list');
    if (selectList) {
        var available = playersPool.filter(function(p) { return p.available; });
        selectList.innerHTML = available.map(function(p) {
            var selClass = selectedPlayersIds.has(p.id) ? 'selected' : '';
            return '<li class="' + selClass + '" onclick="toggleSelect(' + p.id + ')">' + 
                   p.name + ' (OVR: ' + p.overall + ')</li>';
        }).join('');
    }
    
    var count = document.getElementById
