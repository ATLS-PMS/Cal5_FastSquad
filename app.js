var playersPool = [];
var selectedPlayersIds = new Set();
var matchHistory = [];
var currentTeams = { a: [], b: [] };

var GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzmv9q4YjQ3hfvvRYGrPyBZQcoMtGSX_a-HK7T6zHymgf-3ODMH9Jos8NsCk-LD9Kp1/exec"; 

window.onload = function() {
    loadData();
    renderAll();
};

function loadData() {
    try {
        playersPool = JSON.parse(localStorage.getItem('fc_players') || '[]');
        matchHistory = JSON.parse(localStorage.getItem('fc_history') || '[]');
    } catch(e) { console.error(e); }
}

function saveData() {
    localStorage.setItem('fc_players', JSON.stringify(playersPool));
    localStorage.setItem('fc_history', JSON.stringify(matchHistory));
}

function showSection(id) {
    var sections = ['main-section', 'admin-section', 'history-section'];
    sections.forEach(function(s) {
        var el = document.getElementById(s);
        if(el) el.classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
}

function addPlayer() {
    var nEl = document.getElementById('player-name');
    var r = parseInt(document.getElementById('stat-run').value);
    var f = parseInt(document.getElementById('stat-foot').value);
    var v = parseInt(document.getElementById('stat-vers').value);
    var name = nEl.value.trim();

    if(!name || isNaN(r)) { alert("Inserisci nome e almeno corsa!"); return; }

    var overall = Math.round((r + (f||5) + (v||5)) / 3);
    var idx = playersPool.findIndex(function(p){ return p.name.toLowerCase() === name.toLowerCase(); });

    if(idx !== -1) {
        playersPool[idx].run = r; playersPool[idx].foot = f||5; playersPool[idx].vers = v||5; playersPool[idx].overall = overall;
    } else {
        playersPool.push({id:Date.now(), name:name, run:r, foot:f||5, vers:v||5, overall:overall, available:true, wins:0});
    }
    saveData(); renderAll(); nEl.value="";
}

function deletePlayer(id) {
    if(confirm("Eliminare definitivamente?")) {
        playersPool = playersPool.filter(function(p){ return p.id !== id; });
        saveData(); renderAll();
    }
}

function toggleAvail(id) {
    var p = playersPool.find(function(x){ return x.id === id; });
    if(p) p.available = !p.available;
    saveData(); renderAll();
}

function toggleSelect(id) {
    if(selectedPlayersIds.has(id)) selectedPlayersIds.delete(id);
    else if(selectedPlayersIds.size < 10) selectedPlayersIds.add(id);
    renderAll();
}

function generateTeams() {
    if(selectedPlayersIds.size !== 10) { alert("Seleziona 10 giocatori!"); return; }
    var p = playersPool.filter(function(x){ return selectedPlayersIds.has(x.id); });
    
    // Algoritmo di bilanciamento
    p.sort(function(){ return 0.5 - Math.random(); });
    var tA = p.slice(0, 5); var tB = p.slice(5, 10);

    function getImbalance(a, b) {
        var diff = 0;
        ['run','foot','vers','overall'].forEach(function(s){
            var avgA = a.reduce(function(acc, x){ return acc + x[s]; }, 0) / 5;
            var avgB = b.reduce(function(acc, x){ return acc + x[s]; }, 0) / 5;
            diff += Math.pow(avgA - avgB, 2);
        });
        return diff;
    }

    for(var i=0; i<50; i++) {
        var best = getImbalance(tA, tB);
        var swapped = false;
        for(var ia=0; ia<5; ia++) {
            for(var ib=0; ib<5; ib++) {
                var nA = tA.slice(); var nB = tB.slice();
                var temp = nA[ia]; nA[ia] = nB[ib]; nB[ib] = temp;
                if(getImbalance(nA, nB) < best) { tA = nA; tB = nB; swapped = true; break; }
            }
            if(swapped) break;
        }
        if(!swapped) break;
    }

    currentTeams.a = tA; currentTeams.b = tB;
    document.querySelector('#team-a ul').innerHTML = tA.map(function(x){ return "<li>"+x.name+"</li>"; }).join('');
    document.querySelector('#team-b ul').innerHTML = tB.map(function(x){ return "<li>"+x.name+"</li>"; }).join('');
    
    var sel = document.getElementById('mvp-select');
    var all = tA.concat(tB).sort(function(a,b){ return a.name.localeCompare(b.name); });
    sel.innerHTML = '<option value="">-- Scegli MVP --</option>' + all.map(function(x){ return '<option value="'+x.name+'">'+x.name+'</option>'; }).join('');
    
    document.getElementById('teams-result').classList.remove('hidden');
}

function saveMatch(winner) {
    var mvp = document.getElementById('mvp-select').value;
    if(!mvp) { alert("Seleziona MVP!"); return; }

    if(winner === 'A') {
        currentTeams.a.forEach(function(p){ 
            var found = playersPool.find(function(x){return x.id === p.id;});
            if(found) found.wins = (found.wins || 0) + 1;
        });
    } else if(winner === 'B') {
        currentTeams.b.forEach(function(p){ 
            var found = playersPool.find(function(x){return x.id === p.id;});
            if(found) found.wins = (found.wins || 0) + 1;
        });
    }

    var match = { date: new Date().toLocaleDateString(), result: winner==='Pareggio'?'Pareggio':'Vince '+winner, mvp: mvp, teamA: currentTeams.a.map(function(p){return p.name;}), teamB: currentTeams.b.map(function(p){return p.name;}) };
    
    // Invio Google Sheets
    if(GOOGLE_SHEET_URL && GOOGLE_SHEET_URL.indexOf("http") !== -1) {
        fetch(GOOGLE_SHEET_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(match) }).catch(function(e){console.log(e)});
    }

    matchHistory.unshift(match);
    playersPool.forEach(function(p){ p.available = false; });
    selectedPlayersIds.clear();
    saveData(); renderAll();
    document.getElementById('teams-result').classList.add('hidden');
    alert("Partita salvata!");
}

function renderAll() {
    var master = document.getElementById('master-player-list');
    if(master) {
        master.innerHTML = playersPool.slice().sort(function(a,b){return (b.wins||0)-(a.wins||0);}).map(function(p){
            return '<li style="background:#fff; padding:10px; margin-bottom:5px; border-radius:8px; border-left:5px solid '+(p.available?'#27ae60':'#ccc')+'">' +
            '<b>'+p.name+'</b> (🏆 '+(p.wins||0)+')<div style="float:right">' +
            '<button onclick="toggleAvail('+p.id+')" style="width:auto; padding:4px 8px; font-size:0.7em; margin-right:5px; background:#3498db; color:white">'+(p.available?'P':'A')+'</button>' +
            '<button onclick="deletePlayer('+p.id+')" style="width:auto; padding:4px 8px; font-size:0.7em; background:#e74c3c; color:white">X</button></div></li>';
        }).join('');
    }

    var selectList = document.getElementById('selection-player-list');
    if(selectList) {
        var av = playersPool.filter(function(p){ return p.available; });
        selectList.innerHTML = av.map(function(p){
            var sel = selectedPlayersIds.has(p.id);
            return '<li class="'+(sel?'selected':'')+'" onclick="toggleSelect('+p.id+')">'+p.name+'<span class="ovr-badge">'+p.overall+'</span></li>';
        }).join('');
    }
    document.getElementById('selected-count').innerText = selectedPlayersIds.size;

    var hist = document.getElementById('history-list');
    if(hist) {
        hist.innerHTML = matchHistory.slice(0,10).map(function(m){
            return '<div class="history-card"><b>'+m.date+'</b>: '+m.result+'<br><small>MVP: '+m.mvp+'</small></div>';
        }).join('');
    }
}

function copyTeamsToClipboard() {
    var t = "⚽ SQUADRE\n🔴 A: " + currentTeams.a.map(function(p){return p.name;}).join(', ') + "\n🔵 B: " + currentTeams.b.map(function(p){return p.name;}).join(', ');
    navigator.clipboard.writeText(t).then(function(){alert("Copiato!");});
}

function exportData() {
    var blob = new Blob([JSON.stringify({p:playersPool, h:matchHistory})], {type:'application/json'});
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fanta_backup.json'; a.click();
}

function importData() {
    var inp = document.createElement('input'); inp.type='file';
    inp.onchange = function(e){
        var reader = new FileReader();
        reader.onload = function(ev){
            var d = JSON.parse(ev.target.result);
            playersPool = d.p; matchHistory = d.h;
            saveData(); renderAll(); alert("Backup caricato!");
        };
        reader.readAsText(e.target.files[0]);
    };
    inp.click();
}

function clearHistory() {
    if(confirm("Resettare tutto? (Verranno azzerate anche le vittorie)")) {
        matchHistory = []; playersPool.forEach(function(p){p.wins=0;});
        saveData(); renderAll();
    }
}
