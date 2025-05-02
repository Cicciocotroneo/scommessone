// Configurazioni e variabili globali
const API_URL = 'https://script.google.com/macros/s/AKfycbyGDTflJjvgEIYRUoNDIcugwwO8mzKXdZvSBPuecBsUoLwIMNTx2Y7ParIaudhzahz-Gw/exec'; // Sostituisci con l'URL pubblicato del tuo Apps Script
let currentUser = null;

// Utility per le chiamate API
async function callAPI(action, params = {}) {
    try {
        const queryParams = new URLSearchParams({ action, ...params }).toString();
        const response = await fetch(`${API_URL}?${queryParams}`);
        return await response.json();
    } catch (error) {
        console.error('Errore API:', error);
        showAlert('Errore di connessione al server', 'danger');
        return { success: false, message: 'Errore di connessione' };
    }
}

// Funzioni di gestione della UI
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(sectionId).classList.add('active');
}

function showAdminTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.nav-tabs .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`[href="#${tabId}"]`).classList.add('active');
}

function showAlert(message, type, container = 'body', autoClose = true) {
    const alertId = 'alert-' + Date.now();
    const alertHtml = `
        <div id="${alertId}" class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    
    if (container === 'body') {
        // Crea un container per l'alert se non esiste
        if (!document.getElementById('global-alerts')) {
            const alertContainer = document.createElement('div');
            alertContainer.id = 'global-alerts';
            alertContainer.style.position = 'fixed';
            alertContainer.style.top = '20px';
            alertContainer.style.right = '20px';
            alertContainer.style.zIndex = '9999';
            alertContainer.style.maxWidth = '350px';
            document.body.appendChild(alertContainer);
        }
        
        document.getElementById('global-alerts').innerHTML += alertHtml;
    } else {
        document.querySelector(container).innerHTML = alertHtml;
    }
    
    if (autoClose) {
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                alert.classList.remove('show');
                setTimeout(() => alert.remove(), 300);
            }
        }, 5000);
    }
}

// Funzioni di autenticazione
function checkLoggedIn() {
    const userData = localStorage.getItem('user');
    
    if (userData) {
        currentUser = JSON.parse(userData);
        updateUIForLoggedInUser();
        return true;
    }
    
    return false;
}

function updateUIForLoggedInUser() {
    document.getElementById('logged-in').style.display = 'block';
    document.getElementById('logged-out').style.display = 'none';
    
    // Mostra menu admin se l'utente è admin
    if (currentUser.ruolo === 'Admin') {
        document.getElementById('admin-menu').style.display = 'block';
    } else {
        document.getElementById('admin-menu').style.display = 'none';
    }
    
    // Aggiorna la home se l'utente è loggato
    const homeCtaElement = document.getElementById('home-cta');
    if (homeCtaElement) {
        homeCtaElement.innerHTML = `
            <a href="#" class="btn btn-primary" id="go-to-predictions-btn">Vai alle Previsioni</a>
        `;
        
        document.getElementById('go-to-predictions-btn').addEventListener('click', (e) => {
            e.preventDefault();
            showSection('previsioni-section');
            loadUserPrevisionsData();
        });
    }
}

async function login(email, password) {
    const result = await callAPI('login', { email, password });
    
    if (result.success) {
        currentUser = result.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateUIForLoggedInUser();
        showAlert('Login effettuato con successo', 'success');
        showSection('home-section');
        loadHomePageData();
    } else {
        showAlert(result.message, 'danger');
    }
    
    return result.success;
}

async function register(email, password, nome, cognome) {
    const result = await callAPI('register', { email, password, nome, cognome });
    
    if (result.success) {
        currentUser = result.user;
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateUIForLoggedInUser();
        showAlert('Registrazione completata con successo', 'success');
        showSection('home-section');
        loadHomePageData();
    } else {
        showAlert(result.message, 'danger');
    }
    
    return result.success;
}

function logout() {
    localStorage.removeItem('user');
    currentUser = null;
    document.getElementById('logged-in').style.display = 'none';
    document.getElementById('logged-out').style.display = 'block';
    document.getElementById('admin-menu').style.display = 'none';
    showSection('home-section');
    loadHomePageData();
}

// Funzioni di caricamento dati
async function loadHomePageData() {
    await loadUpcomingMatches();
}

async function loadUpcomingMatches() {
    const loadingHtml = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Caricamento...</span>
            </div>
        </div>
    `;
    
    document.getElementById('upcoming-matches').innerHTML = loadingHtml;
    
    try {
        const roundsResult = await callAPI('getCurrentRounds');
        
        if (!roundsResult.success || roundsResult.rounds.length === 0) {
            document.getElementById('upcoming-matches').innerHTML = `
                <div class="alert alert-info">
                    Nessuna giornata in corso al momento
                </div>
            `;
            return;
        }
        
        const currentRound = roundsResult.rounds[0];
        const matchesResult = await callAPI('getRoundMatches', { roundId: currentRound.id });
        
        if (!matchesResult.success || matchesResult.matches.length === 0) {
            document.getElementById('upcoming-matches').innerHTML = `
                <div class="alert alert-info">
                    Nessuna partita disponibile
                </div>
            `;
            return;
        }
        
        let matchesHtml = `
            <h6 class="mb-3">Giornata ${currentRound.numero}</h6>
        `;
        
        matchesResult.matches.forEach(match => {
            const matchDate = new Date(match.dataPartita);
            const formattedDate = matchDate.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            matchesHtml += `
                <div class="card mb-2">
                    <div class="card-body p-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <div class="text-end" style="width: 40%;">
                                <span>${match.squadraCasaNome}</span>
                            </div>
                            <div class="text-center" style="width: 20%;">
                                <span class="match-date">${formattedDate}</span>
                            </div>
                            <div class="text-start" style="width: 40%;">
                                <span>${match.squadraTrasfertaNome}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('upcoming-matches').innerHTML = matchesHtml;
    } catch (error) {
        console.error('Errore caricamento partite:', error);
        document.getElementById('upcoming-matches').innerHTML = `
            <div class="alert alert-danger">
                Errore nel caricamento delle partite
            </div>
        `;
    }
}

async function loadMyLeagues() {
    if (!currentUser) {
        showSection('login-section');
        return;
    }
    
    document.getElementById('my-leagues-list').innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Caricamento...</span>
            </div>
        </div>
    `;
    
    try {
        const result = await callAPI('getUserLeagues', { userId: currentUser.id });
        
        if (!result.success) {
            document.getElementById('my-leagues-list').innerHTML = `
                <div class="alert alert-danger">
                    Errore nel caricamento delle leghe
                </div>
            `;
            return;
        }
        
        if (result.leagues.length === 0) {
            document.getElementById('my-leagues-list').innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info">
                        Non sei iscritto a nessuna lega. Clicca su "Iscriviti a una lega" per unirti a una lega esistente.
                    </div>
                </div>
            `;
            return;
        }
        
        let leaguesHtml = '';
        
        result.leagues.forEach(league => {
            leaguesHtml += `
                <div class="col-md-4">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <h5 class="card-title">${league.nome}</h5>
                            <p class="card-text">${league.descrizione || 'Nessuna descrizione'}</p>
                            <div class="d-flex justify-content-between">
                                <button class="btn btn-outline-primary btn-sm view-ranking-btn" data-league-id="${league.id}">
                                    <i class="fas fa-trophy me-1"></i> Classifica
                                </button>
                                <button class="btn btn-primary btn-sm go-predict-btn" data-league-id="${league.id}">
                                    <i class="fas fa-futbol me-1"></i> Pronostici
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('my-leagues-list').innerHTML = leaguesHtml;
        
        // Aggiungi event listeners
        document.querySelectorAll('.view-ranking-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const leagueId = this.getAttribute('data-league-id');
                loadLeagueRanking(leagueId);
            });
        });
        
        document.querySelectorAll('.go-predict-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const leagueId = this.getAttribute('data-league-id');
                showSection('previsioni-section');
                document.getElementById('pred-league-select').value = leagueId;
                loadRoundsForPredictions();
            });
        });
    } catch (error) {
        console.error('Errore caricamento leghe:', error);
        document.getElementById('my-leagues-list').innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger">
                    Errore nel caricamento delle leghe
                </div>
            </div>
        `;
    }
}

async function loadAvailableLeagues() {
    if (!currentUser) {
        showSection('login-section');
        return;
    }
    
    document.getElementById('available-leagues').innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Caricamento...</span>
            </div>
        </div>
    `;
    
    try {
        const result = await callAPI('getLeagues');
        
        if (!result.success) {
            document.getElementById('available-leagues').innerHTML = `
                <div class="alert alert-danger">
                    Errore nel caricamento delle leghe
                </div>
            `;
            return;
        }
        
        if (result.leagues.length === 0) {
            document.getElementById('available-leagues').innerHTML = `
                <div class="alert alert-info">
                    Non ci sono leghe disponibili al momento.
                </div>
            `;
            return;
        }
        
        // Ottiene anche le leghe dell'utente per verificare a quali è già iscritto
        const userLeaguesResult = await callAPI('getUserLeagues', { userId: currentUser.id });
        const userLeagueIds = userLeaguesResult.success 
            ? userLeaguesResult.leagues.map(l => l.id) 
            : [];
        
        let leaguesHtml = '';
        
        result.leagues.forEach(league => {
            const isJoined = userLeagueIds.includes(league.id);
            
            leaguesHtml += `
                <div class="card mb-3">
                    <div class="card-body">
                        <h5 class="card-title">${league.nome}</h5>
                        <p class="card-text">${league.descrizione || 'Nessuna descrizione'}</p>
                        <button class="btn ${isJoined ? 'btn-success disabled' : 'btn-primary'} join-league-btn" 
                            data-league-id="${league.id}" ${isJoined ? 'disabled' : ''}>
                            ${isJoined ? '<i class="fas fa-check me-1"></i> Iscritto' : '<i class="fas fa-plus me-1"></i> Iscriviti'}
                        </button>
                    </div>
                </div>
            `;
        });
        
        document.getElementById('available-leagues').innerHTML = leaguesHtml;
        
        // Aggiungi event listeners
        document.querySelectorAll('.join-league-btn').forEach(btn => {
            if (!btn.classList.contains('disabled')) {
                btn.addEventListener('click', async function() {
                    const leagueId = this.getAttribute('data-league-id');
                    await joinLeague(leagueId);
                });
            }
        });
    } catch (error) {
        console.error('Errore caricamento leghe disponibili:', error);
        document.getElementById('available-leagues').innerHTML = `
            <div class="alert alert-danger">
                Errore nel caricamento delle leghe
            </div>
        `;
    }
}

async function joinLeague(leagueId) {
    if (!currentUser) {
        showSection('login-section');
        return;
    }
    
    try {
        const result = await callAPI('joinLeague', { 
            userId: currentUser.id, 
            leagueId 
        });
        
        if (result.success) {
            showAlert('Richiesta di iscrizione inviata con successo. Attendi l\'approvazione dell\'amministratore.', 'success');
            // Chiudi la modale
            bootstrap.Modal.getInstance(document.getElementById('join-league-modal')).hide();
            // Ricarica le leghe dell'utente
            loadMyLeagues();
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Errore iscrizione lega:', error);
        showAlert('Errore durante l\'iscrizione alla lega', 'danger');
    }
}

async function loadUserPrevisionsData() {
    if (!currentUser) {
        showSection('login-section');
        return;
    }
    
    // Carica le leghe dell'utente
    try {
        const leaguesResult = await callAPI('getUserLeagues', { userId: currentUser.id });
        
        if (!leaguesResult.success || leaguesResult.leagues.length === 0) {
            document.getElementById('pred-league-select').innerHTML = `
                <option value="">Nessuna lega disponibile</option>
            `;
            document.getElementById('predictions-container').innerHTML = `
                <div class="alert alert-info">
                    Non sei iscritto a nessuna lega. Iscriviti a una lega per poter fare previsioni.
                </div>
            `;
            return;
        }
        
        let leaguesHtml = `<option value="">Seleziona una lega</option>`;
        
        leaguesResult.leagues.forEach(league => {
            leaguesHtml += `<option value="${league.id}">${league.nome}</option>`;
        });
        
        document.getElementById('pred-league-select').innerHTML = leaguesHtml;
        
        // Carica le giornate correnti
        await loadRoundsForPredictions();
    } catch (error) {
        console.error('Errore caricamento dati previsioni:', error);
        document.getElementById('predictions-container').innerHTML = `
            <div class="alert alert-danger">
                Errore nel caricamento dei dati
            </div>
        `;
    }
}

async function loadRoundsForPredictions() {
    document.getElementById('pred-round-select').innerHTML = `
        <option value="">Caricamento...</option>
    `;
    
    try {
        const result = await callAPI('getCurrentRounds');
        
        if (!result.success || result.rounds.length === 0) {
            document.getElementById('pred-round-select').innerHTML = `
                <option value="">Nessuna giornata disponibile</option>
            `;
            document.getElementById('predictions-container').innerHTML = `
                <div class="alert alert-info">
                    Non ci sono giornate attive al momento
                </div>
            `;
            return;
        }
        
        let roundsHtml = `<option value="">Seleziona una giornata</option>`;
        
        result.rounds.forEach(round => {
            roundsHtml += `<option value="${round.id}">Giornata ${round.numero}</option>`;
        });
        
        document.getElementById('pred-round-select').innerHTML = roundsHtml;
    } catch (error) {
        console.error('Errore caricamento giornate:', error);
        document.getElementById('pred-round-select').innerHTML = `
            <option value="">Errore caricamento</option>
        `;
    }
}

async function loadMatchesForPrediction(leagueId, roundId) {
    document.getElementById('predictions-container').innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Caricamento...</span>
            </div>
        </div>
    `;
    
    try {
        // Carica le partite della giornata
        const matchesResult = await callAPI('getRoundMatches', { roundId });
        
        if (!matchesResult.success || matchesResult.matches.length === 0) {
            document.getElementById('predictions-container').innerHTML = `
                <div class="alert alert-info">
                    Nessuna partita disponibile per questa giornata
                </div>
            `;
            return;
        }
        
        // Carica le previsioni già fatte dall'utente
        const predictionsResult = await callAPI('getUserPredictions', { 
            userId: currentUser.id,
            roundId,
            leagueId
        });
        
        const userPredictions = predictionsResult.success ? predictionsResult.predictions : [];
        
        let matchesHtml = `
            <h4 class="mb-4">Previsioni Giornata</h4>
        `;
        
        matchesResult.matches.forEach(match => {
            // Verifica se l'utente ha già una previsione per questa partita
            const userPrediction = userPredictions.find(p => p.matchId === match.id);
            const matchDate = new Date(match.dataPartita);
            const now = new Date();
            const isMatchClosed = matchDate <= now || match.stato !== 'Da giocare';
            
            // Formatta la data
            const formattedDate = matchDate.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            matchesHtml += `
                <div class="card shadow-sm mb-3 ${isMatchClosed ? 'bg-light' : 'match-card'}" 
                     ${!isMatchClosed && !userPrediction ? `data-match-id="${match.id}" 
                     data-home-team="${match.squadraCasaNome}" 
                     data-home-team-id="${match.squadraCasaId}"
                     data-away-team="${match.squadraTrasfertaNome}" 
                     data-away-team-id="${match.squadraTrasfertaId}"
                     data-league-id="${leagueId}"` : ''}>
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-4 text-end">
                                <h5>${match.squadraCasaNome}</h5>
                            </div>
                            <div class="col-md-4 text-center">
                                <div class="match-date mb-2">${formattedDate}</div>
                                ${match.stato !== 'Da giocare' ? `
                                    <div class="match-result mb-2">
                                        <span class="badge bg-secondary">${match.risultatoCasa} - ${match.risultatoTrasferta}</span>
                                    </div>
                                ` : ''}
                                ${isMatchClosed ? `
                                    <span class="match-status closed">Chiusa</span>
                                ` : `
                                    <span class="match-status open">Aperta</span>
                                `}
                            </div>
                            <div class="col-md-4 text-start">
                                <h5>${match.squadraTrasfertaNome}</h5>
                            </div>
                        </div>
                        
                        ${userPrediction ? `
                            <hr>
                            <div class="row align-items-center">
                                <div class="col-md-4 text-end">
                                    <span class="prediction-score">${userPrediction.risultatoCasa}</span>
                                </div>
                                <div class="col-md-4 text-center">
                                    <div class="mb-2">
                                        <span class="badge bg-primary">La tua previsione</span>
                                    </div>
                                    ${match.stato === 'Conclusa' ? `
                                        <div>
                                            <span class="badge bg-success">${userPrediction.punteggio} punti</span>
                                        </div>
                                    ` : ''}
                                </div>
                                <div class="col-md-4 text-start">
                                    <span class="prediction-score">${userPrediction.risultatoTrasferta}</span>
                                </div>
                            </div>
                            ${userPrediction.marcatori.length > 0 ? `
                                <div class="row mt-3">
                                    <div class="col-12 text-center">
                                        <span class="badge bg-secondary">Marcatori: ${userPrediction.marcatori.map(m => m.nome + ' ' + m.cognome).join(', ')}</span>
                                    </div>
                                </div>
                            ` : ''}
                        ` : isMatchClosed ? `
                            <hr>
                            <div class="text-center">
                                <span class="badge bg-danger">Previsione non effettuata</span>
                            </div>
                        ` : `
                            <hr>
                            <div class="text-center">
                                <span class="text-muted">Clicca per fare la tua previsione</span>
                            </div>
                        `}
                    </div>
                </div>
            `;
        });
        
        document.getElementById('predictions-container').innerHTML = matchesHtml;
        
        // Aggiungi event listeners per le previsioni
        document.querySelectorAll('.match-card').forEach(card => {
            card.addEventListener('click', function() {
                const matchId = this.getAttribute('data-match-id');
                const homeTeam = this.getAttribute('data-home-team');
                const homeTeamId = this.getAttribute('data-home-team-id');
                const awayTeam = this.getAttribute('data-away-team');
                const awayTeamId = this.getAttribute('data-away-team-id');
                const leagueId = this.getAttribute('data-league-id');
                
                openPredictionModal(matchId, homeTeam, homeTeamId, awayTeam, awayTeamId, leagueId);
            });
        });
    } catch (error) {
        console.error('Errore caricamento partite:', error);
        document.getElementById('predictions-container').innerHTML = `
            <div class="alert alert-danger">
                Errore nel caricamento delle partite
            </div>
        `;
    }
}

async function openPredictionModal(matchId, homeTeam, homeTeamId, awayTeam, awayTeamId, leagueId) {
    // Imposta i dati nel modale
    document.getElementById('prediction-match-id').value = matchId;
    document.getElementById('prediction-league-id').value = leagueId;
    document.getElementById('pred-home-team').textContent = homeTeam;
    document.getElementById('pred-away-team').textContent = awayTeam;
    document.getElementById('pred-home-score').value = '';
    document.getElementById('pred-away-score').value = '';
    document.getElementById('home-scorers-title').textContent = `Marcatori ${homeTeam}`;
    document.getElementById('away-scorers-title').textContent = `Marcatori ${awayTeam}`;
    
    // Reset dei marcatori
    document.getElementById('home-players-list').innerHTML = `
        <div class="text-center py-2">
            <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="visually-hidden">Caricamento...</span>
            </div>
        </div>
    `;
    
    document.getElementById('away-players-list').innerHTML = `
        <div class="text-center py-2">
            <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="visually-hidden">Caricamento...</span>
            </div>
        </div>
    `;
    
    // Mostra il modale
    const predictionModal = new bootstrap.Modal(document.getElementById('prediction-modal'));
    predictionModal.show();
    
    // Carica i giocatori delle squadre
    try {
        const homePlayers = await callAPI('getTeamPlayers', { teamId: homeTeamId });
        const awayPlayers = await callAPI('getTeamPlayers', { teamId: awayTeamId });
        
        let homePlayersHtml = '';
        let awayPlayersHtml = '';
        
        if (homePlayers.success && homePlayers.players.length > 0) {
            homePlayers.players.forEach(player => {
                homePlayersHtml += `
                    <div class="form-check">
                        <input class="form-check-input scorer-checkbox home-scorer" type="checkbox" 
                               value="${player.id}" id="home-player-${player.id}">
                        <label class="form-check-label" for="home-player-${player.id}">
                            ${player.nome} ${player.cognome} (${player.ruolo})
                        </label>
                    </div>
                `;
            });
        } else {
            homePlayersHtml = `<div class="alert alert-info">Nessun giocatore disponibile</div>`;
        }
        
        if (awayPlayers.success && awayPlayers.players.length > 0) {
            awayPlayers.players.forEach(player => {
                awayPlayersHtml += `
                    <div class="form-check">
                        <input class="form-check-input scorer-checkbox away-scorer" type="checkbox" 
                               value="${player.id}" id="away-player-${player.id}">
                        <label class="form-check-label" for="away-player-${player.id}">
                            ${player.nome} ${player.cognome} (${player.ruolo})
                        </label>
                    </div>
                `;
            });
        } else {
            awayPlayersHtml = `<div class="alert alert-info">Nessun giocatore disponibile</div>`;
        }
        
        document.getElementById('home-players-list').innerHTML = homePlayersHtml;
        document.getElementById('away-players-list').innerHTML = awayPlayersHtml;
        
        // Gestisci l'evento change dei risultati
        document.getElementById('pred-home-score').addEventListener('input', updateScorersVisibility);
        document.getElementById('pred-away-score').addEventListener('input', updateScorersVisibility);
        
        // Verifica subito se mostrare i marcatori
        updateScorersVisibility();
    } catch (error) {
        console.error('Errore caricamento giocatori:', error);
        document.getElementById('home-players-list').innerHTML = `<div class="alert alert-danger">Errore caricamento</div>`;
        document.getElementById('away-players-list').innerHTML = `<div class="alert alert-danger">Errore caricamento</div>`;
    }
}

function updateScorersVisibility() {
    const homeScore = parseInt(document.getElementById('pred-home-score').value) || 0;
    const awayScore = parseInt(document.getElementById('pred-away-score').value) || 0;
    
    if (homeScore === 0 && awayScore === 0) {
        document.getElementById('scorers-section').style.display = 'none';
    } else {
        document.getElementById('scorers-section').style.display = 'block';
        
        // Mostra/nascondi marcatori in base ai gol
        const homeScorers = document.querySelectorAll('.home-scorer');
        const awayScorers = document.querySelectorAll('.away-scorer');
        
        if (homeScore === 0) {
            document.getElementById('home-scorers-title').parentElement.style.display = 'none';
            homeScorers.forEach(cb => { cb.checked = false; });
        } else {
            document.getElementById('home-scorers-title').parentElement.style.display = 'block';
        }
        
        if (awayScore === 0) {
            document.getElementById('away-scorers-title').parentElement.style.display = 'none';
            awayScorers.forEach(cb => { cb.checked = false; });
        } else {
            document.getElementById('away-scorers-title').parentElement.style.display = 'block';
        }
    }
}

async function submitPrediction(formData) {
    const matchId = formData.get('prediction-match-id');
    const leagueId = formData.get('prediction-league-id');
    const homeScore = formData.get('pred-home-score');
    const awayScore = formData.get('pred-away-score');
    
    // Determina il segno della partita
    let segno;
    if (parseInt(homeScore) > parseInt(awayScore)) {
        segno = '1';
    } else if (parseInt(homeScore) < parseInt(awayScore)) {
        segno = '2';
    } else {
        segno = 'X';
    }
    
    // Raccogli i marcatori selezionati
    const scorers = [];
    document.querySelectorAll('.scorer-checkbox:checked').forEach(cb => {
        scorers.push(cb.value);
    });
    
    try {
        const result = await callAPI('submitPrediction', {
            userId: currentUser.id,
            matchId,
            leagueId,
            segno,
            risultatoCasa: homeScore,
            risultatoTrasferta: awayScore,
            marcatori: JSON.stringify(scorers)
        });
        
        if (result.success) {
            showAlert('Previsione salvata con successo', 'success');
            // Chiudi il modale
            bootstrap.Modal.getInstance(document.getElementById('prediction-modal')).hide();
            // Ricarica le partite per vedere la previsione aggiornata
            loadMatchesForPrediction(leagueId, document.getElementById('pred-round-select').value);
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Errore salvataggio previsione:', error);
        showAlert('Errore durante il salvataggio della previsione', 'danger');
    }
}

async function loadLeagueRanking(leagueId) {
    // Implementare la visualizzazione della classifica
}

// Funzioni amministrazione
async function loadAdminLeagues() {
    if (!currentUser || currentUser.ruolo !== 'Admin') {
        showSection('home-section');
        return;
    }
    
    document.getElementById('leagues-table').innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Caricamento...</span>
            </div>
        </div>
    `;
    
    try {
        const result = await callAPI('getLeagues');
        
        if (!result.success) {
            document.getElementById('leagues-table').innerHTML = `
                <div class="alert alert-danger">
                    Errore nel caricamento delle leghe
                </div>
            `;
            return;
        }
        
        if (result.leagues.length === 0) {
            document.getElementById('leagues-table').innerHTML = `
                <div class="alert alert-info">
                    Nessuna lega disponibile. Crea una nuova lega.
                </div>
            `;
            return;
        }
        
        let leaguesHtml = `
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Descrizione</th>
                            <th>Data creazione</th>
                            <th>Azioni</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        result.leagues.forEach(league => {
            const creationDate = new Date(league.dataCreazione).toLocaleDateString('it-IT');
            
            leaguesHtml += `
                <tr>
                    <td>${league.nome}</td>
                    <td>${league.descrizione || 'Nessuna descrizione'}</td>
                    <td>${creationDate}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary view-league-btn" data-league-id="${league.id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger delete-league-btn" data-league-id="${league.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        leaguesHtml += `
                    </tbody>
                </table>
            </div>
        `;
        
        document.getElementById('leagues-table').innerHTML = leaguesHtml;
        
        // Carica le richieste in attesa
        loadPendingRequests();
    } catch (error) {
        console.error('Errore caricamento leghe admin:', error);
        document.getElementById('leagues-table').innerHTML = `
            <div class="alert alert-danger">
                Errore nel caricamento delle leghe
            </div>
        `;
    }
}

async function loadPendingRequests() {
    // Implementazione del caricamento delle richieste in attesa
}

async function loadAdminRounds() {
    // Implementazione della gestione delle giornate
}

async function loadAdminTeams() {
    // Implementazione della gestione delle squadre
}

async function loadAdminResults() {
    // Implementazione della gestione dei risultati
}

// Event listeners quando il DOM è caricato
document.addEventListener('DOMContentLoaded', function() {
    // Controllo login all'avvio
    if (checkLoggedIn()) {
        loadHomePageData();
    } else {
        showSection('home-section');
        loadHomePageData();
    }
    
    // Navigation
    document.getElementById('nav-home').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('home-section');
        loadHomePageData();
    });
    
    document.getElementById('nav-leghe').addEventListener('click', function(e) {
        e.preventDefault();
        if (!currentUser) {
            showSection('login-section');
        } else {
            showSection('leghe-section');
            loadMyLeagues();
        }
    });
    
    document.getElementById('nav-previsioni').addEventListener('click', function(e) {
        e.preventDefault();
        if (!currentUser) {
            showSection('login-section');
        } else {
            showSection('previsioni-section');
            loadUserPrevisionsData();
        }
    });
    
    document.getElementById('nav-admin').addEventListener('click', function(e) {
        e.preventDefault();
        if (!currentUser || currentUser.ruolo !== 'Admin') {
            showSection('home-section');
        } else {
            showSection('admin-section');
            showAdminTab('manage-leagues-section');
            loadAdminLeagues();
        }
    });
    
    document.getElementById('nav-login').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('login-section');
    });
    
    document.getElementById('nav-logout').addEventListener('click', function(e) {
        e.preventDefault();
        logout();
    });
    
    // Home buttons
    document.getElementById('home-register-btn').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('register-section');
    });
    
    document.getElementById('home-login-btn').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('login-section');
    });
    
    // Login/Register switchers
    document.getElementById('goto-register').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('register-section');
    });
    
    document.getElementById('goto-login').addEventListener('click', function(e) {
        e.preventDefault();
        showSection('login-section');
    });
    
    // Login form
    document.getElementById('login-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        await login(email, password);
    });
    
    // Register form
    document.getElementById('register-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        const nome = document.getElementById('register-nome').value;
        const cognome = document.getElementById('register-cognome').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        
        if (password !== confirmPassword) {
            showAlert('Le password non coincidono', 'danger');
            return;
        }
        
        await register(email, password, nome, cognome);
    });
    
    // Join League
    document.getElementById('join-league-btn').addEventListener('click', function() {
        if (!currentUser) {
            showSection('login-section');
            return;
        }
        
        loadAvailableLeagues();
        const joinLeagueModal = new bootstrap.Modal(document.getElementById('join-league-modal'));
        joinLeagueModal.show();
    });
    
    // Previsioni
    document.getElementById('load-matches-btn').addEventListener('click', function() {
        const leagueId = document.getElementById('pred-league-select').value;
        const roundId = document.getElementById('pred-round-select').value;
        
        if (!leagueId) {
            showAlert('Seleziona una lega', 'warning');
            return;
        }
        
        if (!roundId) {
            showAlert('Seleziona una giornata', 'warning');
            return;
        }
        
        loadMatchesForPrediction(leagueId, roundId);
    });
    
    // Form previsione
    document.getElementById('prediction-form').addEventListener('submit', function(e) {
        e.preventDefault();
        submitPrediction(new FormData(e.target));
    });
    
    // Admin tabs
    document.getElementById('tab-manage-leagues').addEventListener('click', function(e) {
        e.preventDefault();
        showAdminTab('manage-leagues-section');
        loadAdminLeagues();
    });
    
    document.getElementById('tab-manage-rounds').addEventListener('click', function(e) {
        e.preventDefault();
        showAdminTab('manage-rounds-section');
        loadAdminRounds();
    });
    
    document.getElementById('tab-manage-teams').addEventListener('click', function(e) {
        e.preventDefault();
        showAdminTab('manage-teams-section');
        loadAdminTeams();
    });
    
    document.getElementById('tab-manage-results').addEventListener('click', function(e) {
        e.preventDefault();
        showAdminTab('manage-results-section');
        loadAdminResults();
    });
});
