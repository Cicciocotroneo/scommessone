// app.js - Script Frontend per Lo Scommessone

// Configurazione API (sostituisci con l'URL della tua Web App)
const API_URL = 'https://script.google.com/macros/s/AKfycbyAeUS-GJzUhFn2wMis9jrTZMo4mLDxV1gL7wPTsdlqk4QN_gDOApaa8ouXpnaZ1Vv3_A/exec';

// Token di autenticazione memorizzato localmente
let token = localStorage.getItem('token');
let currentUser = null;
let isAdmin = false;
let currentLega = null;
let currentGiornata = null;

// Funzione per fare richieste all'API utilizzando JSONP (aggira CORS)
function fetchAPI(endpoint, action, data = null) {
  return new Promise((resolve, reject) => {
    // Crea un nome di callback unico
    const callbackName = 'jsonpCallback_' + Date.now() + Math.floor(Math.random() * 1000);

    // Crea una funzione globale temporanea
    window[callbackName] = function(response) {
      // Pulisci creando la funzione callback
      delete window[callbackName];
      // Rimuovi lo script quando terminato
      if (script.parentNode) document.head.removeChild(script);
      resolve(response);
    };

    // Crea query string per i parametri
    let url = API_URL + '?callback=' + callbackName + '&endpoint=' + endpoint + '&action=' + action;

    // Aggiungi token se presente
    if (token) url += '&token=' + encodeURIComponent(token);

    // Aggiungi dati se presenti (converti oggetti in JSON)
    if (data) {
      url += '&data=' + encodeURIComponent(JSON.stringify(data));
    }

    // Crea elemento script
    const script = document.createElement('script');
    script.src = url;

    // Gestione errori
    script.onerror = function() {
      delete window[callbackName];
      document.head.removeChild(script);
      reject(new Error('Errore di connessione al server'));
    };

    // Timeout per sicurezza (60 secondi)
    const timeoutId = setTimeout(() => {
      if (window[callbackName]) {
        delete window[callbackName];
        document.head.removeChild(script);
        reject(new Error('Timeout della richiesta'));
      }
    }, 60000);

    // Aggiungi lo script al documento
    document.head.appendChild(script);
  });
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
    // Gestione sezioni
    setupEventListeners();

    // Test connessione all'avvio
    testConnection();

    // Carica informazioni lega
    await loadLegaInfo();

    // Verifica login utente
    if (token) {
        await checkAuthStatus();
    }

    // Carica prossime partite e classifica per la home
    loadProssimePartite();
    loadHomeClassifica();

    // Carica giornate per il selettore
    loadGiornate();

    // Carica albo d'oro
    loadAlboOro();
});

// Funzione per testare la connessione
function testConnection() {
    fetchAPI('test', 'connection')
        .then(response => {
            console.log('✅ Connessione al server: OK', response);
        })
        .catch(error => {
            console.error('❌ Errore di connessione al server:', error);
            showAlert('Errore di connessione al server. Riprova più tardi.', 'error');
        });
}

// Carica informazioni sulla lega
async function loadLegaInfo() {
    try {
        const data = await fetchAPI('lega', 'getInfo');
        
        if (data.success && data.lega) {
            currentLega = data.lega;
            
            // Aggiorna titolo del sito
            const sitoTitle = document.getElementById('sitoTitle');
            if (sitoTitle && currentLega.nome) {
                sitoTitle.textContent = `Lo Scommessone - ${currentLega.nome}`;
                document.title = `Lo Scommessone - ${currentLega.nome}`;
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento delle informazioni della lega:', error);
    }
}

// FUNZIONI DI AUTENTICAZIONE

// Verifica lo stato di autenticazione
async function checkAuthStatus() {
    try {
        const data = await fetchAPI('auth', 'me');

        if (data.success) {
            currentUser = data.user;
            isAdmin = data.user.isAdmin;

            updateUIForLoggedInUser();

            // Se l'utente è nella sezione account, carica i dati dell'utente
            if (document.getElementById('account').classList.contains('active')) {
                loadUserData();
            }

            // Carica i pronostici dell'utente
            loadPronostici();
        } else {
            // Token non valido o scaduto
            logout();
        }
    } catch (error) {
        console.error('Errore nella verifica dell\'autenticazione:', error);
        logout();
    }
}

// Login utente
async function login(email, password) {
    try {
        const data = await fetchAPI('auth', 'login', { email, password });

        if (data.success) {
            token = data.token;
            currentUser = data.user;
            isAdmin = data.user.isAdmin;

            localStorage.setItem('token', token);

            updateUIForLoggedInUser();
            showSection('account');

            showAlert('Login effettuato con successo!', 'success');
            return true;
        } else {
            showAlert(data.message || 'Errore durante il login', 'error');
            return false;
        }
    } catch (error) {
        console.error('Errore durante il login:', error);
        showAlert('Errore di connessione al server', 'error');
        return false;
    }
}

// Registrazione utente
async function register(nome, email, password) {
    try {
        const data = await fetchAPI('auth', 'register', { nome, email, password });

        if (data.success) {
            token = data.token;
            currentUser = data.user;
            isAdmin = data.user.isAdmin;

            localStorage.setItem('token', token);

            updateUIForLoggedInUser();
            showSection('account');

            showAlert('Registrazione effettuata con successo!', 'success');
            return true;
        } else {
            showAlert(data.message || 'Errore durante la registrazione', 'error');
            return false;
        }
    } catch (error) {
        console.error('Errore durante la registrazione:', error);
        showAlert('Errore di connessione al server', 'error');
        return false;
    }
}

// Login amministratore
async function adminLogin(password) {
    try {
        const data = await fetchAPI('auth', 'adminLogin', { password });

        if (data.success) {
            if (data.token) {
                token = data.token;
                currentUser = data.user;
                isAdmin = true;
                localStorage.setItem('token', token);
            } else {
                isAdmin = data.isAdmin;
            }

            document.getElementById('adminLoginForm').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'block';

            // Carica le impostazioni esistenti
            loadAdminSettings();
            // Carica squadre
            loadSquadre();
            // Carica giornate per admin
            loadGiornateForAdmin();
            // Carica albo d'oro per admin
            loadAlboOroForAdmin();

            showAlert('Login admin effettuato con successo!', 'success');
            return true;
        } else {
            showAlert(data.message || 'Password non valida', 'error');
            return false;
        }
    } catch (error) {
        console.error('Errore durante il login admin:', error);
        showAlert('Errore di connessione al server', 'error');
        return false;
    }
}

// Logout utente
function logout() {
    token = null;
    currentUser = null;
    isAdmin = false;

    localStorage.removeItem('token');

    // Aggiorna UI
    document.getElementById('loginBtn').textContent = 'Accedi';
    document.getElementById('notLoggedInMessage').style.display = 'block';
    document.getElementById('accountInfo').style.display = 'none';
    document.getElementById('myScommesseSection').style.display = 'none';
    document.getElementById('statisticheSection').style.display = 'none';

    // Torna alla home
    showSection('home');
    showAlert('Logout effettuato con successo!', 'success');
}

// Richiedi reset password
async function requestPasswordReset(email) {
    try {
        const data = await fetchAPI('auth', 'requestPasswordReset', { email });

        if (data.success) {
            showAlert(data.message, 'success');
            // Mostra il form per inserire il token e la nuova password
            document.getElementById('requestResetForm').style.display = 'none';
            document.getElementById('confirmResetForm').style.display = 'block';
            return true;
        } else {
            showAlert(data.message || 'Errore durante la richiesta di reset', 'error');
            return false;
        }
    } catch (error) {
        console.error('Errore durante la richiesta di reset:', error);
        showAlert('Errore di connessione al server', 'error');
        return false;
    }
}

// Resetta password con token
async function resetPassword(token, newPassword) {
    try {
        const data = await fetchAPI('auth', 'resetPassword', { 
            token,
            newPassword
        });

        if (data.success) {
            showAlert(data.message, 'success');
            // Torna al login
            showLoginForm();
            return true;
        } else {
            showAlert(data.message || 'Errore durante il reset della password', 'error');
            return false;
        }
    } catch (error) {
        console.error('Errore durante il reset della password:', error);
        showAlert('Errore di connessione al server', 'error');
        return false;
    }
}

// FUNZIONI HOME

// Carica le prossime partite per la home
async function loadProssimePartite() {
    try {
        const data = await fetchAPI('partite', 'getProssime');
        
        if (data.success && data.partite) {
            const container = document.getElementById('prossimaGiornata');
            
            if (data.partite.length > 0) {
                container.innerHTML = `
                    <h3>Giornata ${data.giornata.numero} - ${formattaData(data.giornata.data)}</h3>
                    <p>Chiusura pronostici: ${formattaData(data.giornata.chiusura_pronostici)}</p>
                    <div class="grid-container">
                        ${data.partite.map(partita => `
                            <div class="match-card">
                                <div class="match-header">
                                    <div>${formattaData(partita.data_ora)}</div>
                                </div>
                                <div class="match-teams">
                                    <div class="team">
                                        <div class="team-name">${partita.squadra_casa}</div>
                                    </div>
                                    <div class="vs">VS</div>
                                    <div class="team">
                                        <div class="team-name">${partita.squadra_trasferta}</div>
                                    </div>
                                </div>
                                ${currentUser ? `
                                <div style="text-align: center; margin-top: 1rem;">
                                    <button class="btn-secondary" onclick="showPronosticoForm('${partita.id}')">Pronostica</button>
                                </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                container.innerHTML = '<p>Nessuna partita in programma al momento.</p>';
            }
        } else {
            document.getElementById('prossimaGiornata').innerHTML = '<p>Nessuna partita in programma al momento.</p>';
        }
    } catch (error) {
        console.error('Errore nel caricamento delle prossime partite:', error);
        document.getElementById('prossimaGiornata').innerHTML = '<p>Errore nel caricamento delle partite.</p>';
    }
}

// Carica la classifica per la home
async function loadHomeClassifica() {
    try {
        const data = await fetchAPI('classifica', 'getTop10');
        
        if (data.success && data.classifica && data.classifica.length > 0) {
            const container = document.getElementById('homeClassifica');
            
            container.innerHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Pos.</th>
                            <th>Partecipante</th>
                            <th>Punti</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.classifica.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.nome_utente}</td>
                                <td>${item.punti}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="text-align: right; margin-top: 1rem;">
                    <a onclick="showSection('classifica')" style="cursor: pointer; color: var(--primary);">Visualizza classifica completa →</a>
                </div>
            `;
        } else {
            document.getElementById('homeClassifica').innerHTML = '<p>Classifica non ancora disponibile.</p>';
        }
    } catch (error) {
        console.error('Errore nel caricamento della classifica:', error);
        document.getElementById('homeClassifica').innerHTML = '<p>Errore nel caricamento della classifica.</p>';
    }
}

// FUNZIONI GIORNATE

// Carica le giornate disponibili
async function loadGiornate() {
    try {
        const data = await fetchAPI('giornate', 'getAll');
        
        if (data.success && data.giornate && data.giornate.length > 0) {
            // Popola selettore giornate per utenti normali
            const userSelect = document.getElementById('giornataSelectUser');
            const pronosticiSelect = document.getElementById('pronosticiGiornataSelect');
            const classificaSelect = document.getElementById('classificaGiornataSelect');
            
            userSelect.innerHTML = '';
            pronosticiSelect.innerHTML = '';
            classificaSelect.innerHTML = '<option value="all">Classifica completa</option>';
            
            data.giornate.forEach(giornata => {
                const option = document.createElement('option');
                option.value = giornata.id;
                option.textContent = `Giornata ${giornata.numero} - ${formattaData(giornata.data, false)}`;
                
                userSelect.appendChild(option.cloneNode(true));
                pronosticiSelect.appendChild(option.cloneNode(true));
                classificaSelect.appendChild(option.cloneNode(true));
            });
            
            // Imposta giornata corrente e carica partite
            if (userSelect.options.length > 0) {
                currentGiornata = data.giornate[0].id;
                userSelect.value = currentGiornata;
                pronosticiSelect.value = currentGiornata;
                
                loadPartiteGiornata(currentGiornata);
                if (currentUser) {
                    loadPronosticiGiornata(currentGiornata);
                }
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento delle giornate:', error);
    }
}

// Carica le partite di una giornata
async function loadPartiteGiornata(giornataId) {
    try {
        const data = await fetchAPI('partite', 'getByGiornata', { giornata_id: giornataId });
        
        if (data.success) {
            const container = document.getElementById('partiteGiornata');
            
            if (data.partite && data.partite.length > 0) {
                container.innerHTML = `
                    <h3>Giornata ${data.giornata.numero} - ${formattaData(data.giornata.data)}</h3>
                    <p>Chiusura pronostici: ${formattaData(data.giornata.chiusura_pronostici)}</p>
                    <div class="grid-container">
                        ${data.partite.map(partita => `
                            <div class="match-card">
                                <div class="match-header">
                                    <div>${formattaData(partita.data_ora)}</div>
                                    ${partita.stato === STATI_PARTITA.TERMINATA ? `
                                    <div style="font-weight: bold;">TERMINATA</div>
                                    ` : partita.stato === STATI_PARTITA.IN_CORSO ? `
                                    <div style="font-weight: bold; color: var(--primary);">IN CORSO</div>
                                    ` : ''}
                                </div>
                                <div class="match-teams">
                                    <div class="team">
                                        <div class="team-name">${partita.squadra_casa}</div>
                                    </div>
                                    <div class="vs">
                                        ${partita.stato === STATI_PARTITA.TERMINATA || partita.stato === STATI_PARTITA.IN_CORSO ? 
                                            `${partita.gol_casa} - ${partita.gol_trasferta}` : 'VS'
                                        }
                                    </div>
                                    <div class="team">
                                        <div class="team-name">${partita.squadra_trasferta}</div>
                                    </div>
                                </div>
                                ${partita.stato === STATI_PARTITA.TERMINATA ? `
                                <div class="scorer-section">
                                    <div><strong>Marcatori:</strong></div>
                                    <div>${partita.marcatori && partita.marcatori.length > 0 ? 
                                        partita.marcatori.map(m => m.nome).join(', ') : 
                                        'Nessun marcatore'}</div>
                                </div>
                                ` : ''}
                                ${currentUser && partita.stato === STATI_PARTITA.DA_DISPUTARE ? `
                                <div style="text-align: center; margin-top: 1rem;">
                                    <button class="btn-secondary" onclick="showPronosticoForm('${partita.id}')">Pronostica</button>
                                </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                container.innerHTML = '<p>Nessuna partita disponibile per questa giornata.</p>';
            }
        } else {
            document.getElementById('partiteGiornata').innerHTML = '<p>Nessuna partita disponibile per questa giornata.</p>';
        }
    } catch (error) {
        console.error('Errore nel caricamento delle partite:', error);
        document.getElementById('partiteGiornata').innerHTML = '<p>Errore nel caricamento delle partite.</p>';
    }
}

// FUNZIONI PRONOSTICI

// Carica i pronostici dell'utente
async function loadPronostici() {
    if (!token || !currentUser) return;
    
    try {
        // Carica le giornate per scegliere i pronostici
        const data = await fetchAPI('giornate', 'getAll');
        
        if (data.success && data.giornate && data.giornate.length > 0) {
            // Mostra la sezione pronostici
            document.getElementById('myScommesseSection').style.display = 'block';
            document.getElementById('statisticheSection').style.display = 'block';
            
            // Se c'è una giornata corrente, carica i pronostici
            if (currentGiornata) {
                loadPronosticiGiornata(currentGiornata);
            } else if (data.giornate.length > 0) {
                loadPronosticiGiornata(data.giornate[0].id);
            }
            
            // Carica statistiche utente
            loadUserStatistiche();
        }
    } catch (error) {
        console.error('Errore nel caricamento dei pronostici:', error);
    }
}

// Carica i pronostici dell'utente per una giornata
async function loadPronosticiGiornata(giornataId) {
    if (!token || !currentUser) return;
    
    try {
        const data = await fetchAPI('pronostici', 'getByGiornata', { giornata_id: giornataId });
        
        if (data.success) {
            const container = document.getElementById('pronosticiList');
            
            if (data.pronostici && data.pronostici.length > 0) {
                // Verifica se la deadline è passata
                const deadlinePassata = isDataPassata(data.giornata.chiusura_pronostici);
                
                container.innerHTML = `
                    <h3>Giornata ${data.giornata.numero} - ${formattaData(data.giornata.data)}</h3>
                    <p>Chiusura pronostici: ${formattaData(data.giornata.chiusura_pronostici)}</p>
                    ${deadlinePassata ? `<p style="color: var(--error); font-weight: bold;">Il termine per i pronostici è scaduto!</p>` : ''}
                    <div class="grid-container">
                        ${data.pronostici.map(pronostico => `
                            <div class="match-card">
                                <div class="match-header">
                                    <div>${formattaData(pronostico.data_partita)}</div>
                                    ${pronostico.stato_partita === STATI_PARTITA.TERMINATA ? `
                                    <div style="font-weight: bold;">TERMINATA</div>
                                    ` : pronostico.stato_partita === STATI_PARTITA.IN_CORSO ? `
                                    <div style="font-weight: bold; color: var(--primary);">IN CORSO</div>
                                    ` : ''}
                                </div>
                                <div class="match-teams">
                                    <div class="team">
                                        <div class="team-name">${pronostico.squadra_casa}</div>
                                    </div>
                                    <div class="vs">VS</div>
                                    <div class="team">
                                        <div class="team-name">${pronostico.squadra_trasferta}</div>
                                    </div>
                                </div>
                                
                                <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
                                    <h4>Il tuo pronostico:</h4>
                                    <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                                        <div><strong>Segno:</strong> ${pronostico.segno}</div>
                                        <div><strong>Risultato:</strong> ${pronostico.gol_casa}-${pronostico.gol_trasferta}</div>
                                    </div>
                                    <div style="margin-top: 0.5rem;">
                                        <strong>Marcatori:</strong> 
                                        ${pronostico.marcatori && pronostico.marcatori.length > 0 ? 
                                            pronostico.marcatori.map(m => m.nome).join(', ') : 
                                            'Nessun marcatore selezionato'}
                                    </div>
                                    
                                    ${pronostico.stato_partita === STATI_PARTITA.TERMINATA ? `
                                    <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
                                        <h4>Risultato finale:</h4>
                                        <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                                            <div><strong>Segno:</strong> ${pronostico.segno_finale}</div>
                                            <div><strong>Risultato:</strong> ${pronostico.gol_casa_finale}-${pronostico.gol_trasferta_finale}</div>
                                        </div>
                                        <div style="margin-top: 0.5rem;">
                                            <strong>Marcatori:</strong> 
                                            ${pronostico.marcatori_finali && pronostico.marcatori_finali.length > 0 ? 
                                                pronostico.marcatori_finali.map(m => m.nome).join(', ') : 
                                                'Nessun marcatore'}
                                        </div>
                                        <div style="margin-top: 0.5rem; font-weight: bold; color: ${pronostico.punti > 0 ? 'var(--success)' : 'var(--text)'}">
                                            Punti: ${pronostico.punti}
                                        </div>
                                    </div>
                                    ` : ''}
                                    
                                    ${!deadlinePassata && pronostico.stato_partita === STATI_PARTITA.DA_DISPUTARE ? `
                                    <div style="text-align: center; margin-top: 1rem;">
                                        <button class="btn-secondary" onclick="showPronosticoForm('${pronostico.partita_id}')">Modifica</button>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <h3>Giornata ${data.giornata.numero} - ${formattaData(data.giornata.data)}</h3>
                    <p>Chiusura pronostici: ${formattaData(data.giornata.chiusura_pronostici)}</p>
                    <p>Non hai ancora inserito pronostici per questa giornata.</p>
                    <button class="btn-secondary" onclick="showSection('giornate')">Vai alle Partite</button>
                `;
            }
        } else {
            document.getElementById('pronosticiList').innerHTML = '<p>Errore nel caricamento dei pronostici.</p>';
        }
    } catch (error) {
        console.error('Errore nel caricamento dei pronostici:', error);
        document.getElementById('pronosticiList').innerHTML = '<p>Errore nel caricamento dei pronostici.</p>';
    }
}

// Mostra il form per fare un pronostico
async function showPronosticoForm(partitaId) {
    if (!token || !currentUser) {
        showAlert('Devi effettuare l\'accesso per fare un pronostico', 'error');
        document.getElementById('authSection').style.display = 'block';
        return;
    }
    
    try {
        // Ottieni i dettagli della partita e l'eventuale pronostico esistente
        const data = await fetchAPI('pronostici', 'getPartitaDetails', { partita_id: partitaId });
        
        if (data.success) {
            // Verifica se la deadline è passata
            if (isDataPassata(data.giornata.chiusura_pronostici)) {
                showAlert('Il termine per i pronostici è scaduto!', 'error');
                return;
            }
            
            // Crea il form di pronostico
            const modalHtml = `
                <div id="pronosticoModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;">
                    <div style="background-color: white; border-radius: 8px; padding: 2rem; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
                        <h2>Pronostico</h2>
                        <h3>${data.partita.squadra_casa} vs ${data.partita.squadra_trasferta}</h3>
                        <p>${formattaData(data.partita.data_ora)}</p>
                        
                        <form id="pronosticoForm">
                            <input type="hidden" id="pronosticoPartitaId" value="${partitaId}">
                            
                            <div class="form-group">
                                <label>Segno</label>
                                <div style="display: flex; gap: 1rem;">
                                    ${SEGNI_PARTITA.map(segno => `
                                        <label style="display: inline-flex; align-items: center; cursor: pointer;">
                                            <input type="radio" name="segno" value="${segno.value}" ${data.pronostico && data.pronostico.segno === segno.value ? 'checked' : ''}>
                                            <span style="margin-left: 0.5rem;">${segno.label}</span>
                                        </label>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Risultato</label>
                                <div class="match-result">
                                    <div>
                                        <label>${data.partita.squadra_casa}</label>
                                        <input type="number" id="golCasa" class="result-input" min="0" max="20" value="${data.pronostico ? data.pronostico.gol_casa : '0'}" required>
                                    </div>
                                    <div>-</div>
                                    <div>
                                        <label>${data.partita.squadra_trasferta}</label>
                                        <input type="number" id="golTrasferta" class="result-input" min="0" max="20" value="${data.pronostico ? data.pronostico.gol_trasferta : '0'}" required>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label>Marcatori</label>
                                <div>
                                    <h4 style="margin: 0.5rem 0;">${data.partita.squadra_casa}</h4>
                                    <div class="player-picker" id="marcatoriCasa">
                                        ${data.giocatori_casa.map(giocatore => `
                                            <div class="player-chip ${data.pronostico && data.pronostico.marcatori && data.pronostico.marcatori.some(m => m.id === giocatore.id) ? 'selected' : ''}" 
                                                 data-id="${giocatore.id}" 
                                                 onclick="toggleMarcatore(this)">
                                                ${giocatore.nome}
                                            </div>
                                        `).join('')}
                                    </div>
                                    
                                    <h4 style="margin: 1rem 0 0.5rem;">${data.partita.squadra_trasferta}</h4>
                                    <div class="player-picker" id="marcatoriTrasferta">
                                        ${data.giocatori_trasferta.map(giocatore => `
                                            <div class="player-chip ${data.pronostico && data.pronostico.marcatori && data.pronostico.marcatori.some(m => m.id === giocatore.id) ? 'selected' : ''}" 
                                                 data-id="${giocatore.id}" 
                                                 onclick="toggleMarcatore(this)">
                                                ${giocatore.nome}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                            
                            <div style="display: flex; justify-content: space-between; margin-top: 1.5rem;">
                                <button type="button" onclick="closePronosticoModal()" class="btn-danger">Annulla</button>
                                <button type="submit" class="btn-secondary">Salva Pronostico</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            // Aggiungi il modal al body
            const modalDiv = document.createElement('div');
            modalDiv.innerHTML = modalHtml;
            document.body.appendChild(modalDiv.firstChild);
            
            // Gestisci il submit del form
            document.getElementById('pronosticoForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const partitaId = document.getElementById('pronosticoPartitaId').value;
                const segno = document.querySelector('input[name="segno"]:checked')?.value;
                const golCasa = parseInt(document.getElementById('golCasa').value);
                const golTrasferta = parseInt(document.getElementById('golTrasferta').value);
                
                // Raccogli i marcatori selezionati
                const marcatori = [];
                document.querySelectorAll('.player-chip.selected').forEach(chip => {
                    marcatori.push(chip.getAttribute('data-id'));
                });
                
                // Validazione
                if (!segno) {
                    showAlert('Seleziona un segno (1, X, 2)', 'error');
                    return;
                }
                
                // Controllo coerenza tra segno e risultato
                const segnoRisultato = calcolaSegno(golCasa, golTrasferta);
                if (segno !== segnoRisultato) {
                    showAlert(`Il segno "${segno}" non corrisponde al risultato ${golCasa}-${golTrasferta} (${segnoRisultato})`, 'error');
                    return;
                }
                
                // Invia il pronostico
                try {
                    const pronosticoData = {
                        partita_id: partitaId,
                        segno,
                        gol_casa: golCasa,
                        gol_trasferta: golTrasferta,
                        marcatori
                    };
                    
                    const result = await fetchAPI('pronostici', 'save', pronosticoData);
                    
                    if (result.success) {
                        showAlert('Pronostico salvato con successo!', 'success');
                        closePronosticoModal();
                        
                        // Ricarica i pronostici
                        loadPronosticiGiornata(currentGiornata);
                    } else {
                        showAlert(result.message || 'Errore nel salvataggio del pronostico', 'error');
                    }
                } catch (error) {
                    console.error('Errore nel salvataggio del pronostico:', error);
                    showAlert('Errore di connessione al server', 'error');
                }
            });
        } else {
            showAlert(data.message || 'Errore nel caricamento dei dettagli della partita', 'error');
        }
    } catch (error) {
        console.error('Errore nel caricamento dei dettagli della partita:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// Funzione per selezionare/deselezionare un marcatore
function toggleMarcatore(element) {
    element.classList.toggle('selected');
    
    // Aggiorna il conteggio dei gol in base ai marcatori selezionati
    const casaCount = document.querySelectorAll('#marcatoriCasa .player-chip.selected').length;
    const trasfertaCount = document.querySelectorAll('#marcatoriTrasferta .player-chip.selected').length;
    
    document.getElementById('golCasa').value = casaCount;
    document.getElementById('golTrasferta').value = trasfertaCount;
    
    // Aggiorna automaticamente il segno
    const segno = calcolaSegno(casaCount, trasfertaCount);
    document.querySelector(`input[name="segno"][value="${segno}"]`).checked = true;
}

// Funzione per chiudere il modal di pronostico
function closePronosticoModal() {
    const modal = document.getElementById('pronosticoModal');
    if (modal) {
        modal.remove();
    }
}

// FUNZIONI CLASSIFICA

// Carica la classifica completa
async function loadClassifica() {
    try {
        const giornataId = document.getElementById('classificaGiornataSelect').value;
        
        const data = await fetchAPI('classifica', 'get', { giornata_id: giornataId === 'all' ? null : giornataId });
        
        if (data.success && data.classifica) {
            const container = document.getElementById('classificaAttualeContainer');
            container.style.display = 'block';
            document.getElementById('classificaInfo').style.display = 'none';
            
            const tableBody = document.getElementById('classificaBody');
            tableBody.innerHTML = '';
            
            if (data.classifica.length > 0) {
                data.classifica.forEach((item, index) => {
                    const row = document.createElement('tr');
                    
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${item.nome_utente}</td>
                        <td>${item.punti}</td>
                        <td>1️⃣ ${item.punti_segno || 0} | 3️⃣ ${item.punti_risultato || 0} | 5️⃣ ${item.punti_marcatori || 0}</td>
                    `;
                    
                    tableBody.appendChild(row);
                });
                
                // Se è la classifica finale, mostra il podio
                if (data.lega && data.lega.stato === 'conclusa' && giornataId === 'all') {
                    showPodio(data.classifica);
                }
            } else {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center;">Nessun partecipante in classifica</td>
                    </tr>
                `;
            }
        } else {
            document.getElementById('classificaAttualeContainer').style.display = 'none';
            document.getElementById('classificaInfo').style.display = 'block';
        }
    } catch (error) {
        console.error('Errore nel caricamento della classifica:', error);
        document.getElementById('classificaAttualeContainer').style.display = 'none';
        document.getElementById('classificaInfo').style.display = 'block';
    }
}

// Mostra il podio della classifica
function showPodio(classifica) {
    if (classifica.length < 3) return;
    
    const podioHtml = `
        <div class="podium">
            <div class="podium-position second">
                <div class="podium-block second">2</div>
                <div class="podium-name">${classifica[1].nome_utente}</div>
                <div class="podium-points">${classifica[1].punti} punti</div>
            </div>
            <div class="podium-position first">
                <div class="podium-block first">1</div>
                <div class="podium-name">${classifica[0].nome_utente}</div>
                <div class="podium-points">${classifica[0].punti} punti</div>
            </div>
            <div class="podium-position third">
                <div class="podium-block third">3</div>
                <div class="podium-name">${classifica[2].nome_utente}</div>
                <div class="podium-points">${classifica[2].punti} punti</div>
            </div>
        </div>
    `;
    
    // Inserisci il podio prima della tabella
    const container = document.getElementById('classificaTable');
    container.insertAdjacentHTML('beforebegin', podioHtml);
}

// FUNZIONI ALBO D'ORO

// Carica l'albo d'oro
async function loadAlboOro() {
    try {
        const data = await fetchAPI('alboOro', 'getAll');
        
        if (data.success && data.edizioni && data.edizioni.length > 0) {
            const container = document.getElementById('alboOroContainer');
            
            container.innerHTML = '';
            
            // Raggruppa per torneo
            const tornei = {};
            data.edizioni.forEach(edizione => {
                if (!tornei[edizione.nome_torneo]) {
                    tornei[edizione.nome_torneo] = [];
                }
                tornei[edizione.nome_torneo].push(edizione);
            });
            
            // Crea la visualizzazione per ogni torneo
            for (const [nomeTorneo, edizioni] of Object.entries(tornei)) {
                // Ordina le edizioni per anno (decrescente)
                edizioni.sort((a, b) => b.anno.localeCompare(a.anno));
                
                const torneoDiv = document.createElement('div');
                torneoDiv.innerHTML = `
                    <h3>${nomeTorneo}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Stagione</th>
                                <th>1° Classificato</th>
                                <th>2° Classificato</th>
                                <th>3° Classificato</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${edizioni.map(edizione => `
                                <tr>
                                    <td>${edizione.anno}</td>
                                    <td>${edizione.primo_classificato}</td>
                                    <td>${edizione.secondo_classificato || '-'}</td>
                                    <td>${edizione.terzo_classificato || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                
                container.appendChild(torneoDiv);
            }
        } else {
            document.getElementById('alboOroContainer').innerHTML = '<p>Non ci sono ancora edizioni registrate nell\'Albo d\'Oro.</p>';
        }
    } catch (error) {
        console.error('Errore nel caricamento dell\'albo d\'oro:', error);
        document.getElementById('alboOroContainer').innerHTML = '<p>Errore nel caricamento dell\'albo d\'oro.</p>';
    }
}

// FUNZIONI STATISTICHE UTENTE

// Carica le statistiche dell'utente
async function loadUserStatistiche() {
    if (!token || !currentUser) return;
    
    try {
        const data = await fetchAPI('utenti', 'getStatistiche');
        
        if (data.success && data.statistiche) {
            document.getElementById('totalScore').textContent = data.statistiche.punti_totali || '0';
            document.getElementById('currentPosition').textContent = data.statistiche.posizione ? `${data.statistiche.posizione}° su ${data.statistiche.totale_partecipanti}` : 'N/D';
            document.getElementById('exactResults').textContent = data.statistiche.risultati_esatti || '0';
            document.getElementById('correctSigns').textContent = data.statistiche.segni_corretti || '0';
            document.getElementById('correctScorers').textContent = data.statistiche.marcatori_corretti || '0';
        }
    } catch (error) {
        console.error('Errore nel caricamento delle statistiche:', error);
    }
}

// FUNZIONI ADMIN

// Carica le impostazioni per l'admin
async function loadAdminSettings() {
    if (!isAdmin) return;
    
    // Mostra la sezione impostazioni
    document.querySelectorAll('[data-admin-tab]').forEach(tab => {
        document.getElementById(`admin${tab.getAttribute('data-admin-tab').charAt(0).toUpperCase() + tab.getAttribute('data-admin-tab').slice(1)}`).style.display = 'none';
    });
    document.getElementById('adminImpostazioni').style.display = 'block';
    
    try {
        const data = await fetchAPI('lega', 'getInfo');
        
        if (data.success && data.lega) {
            document.getElementById('nomeLega').value = data.lega.nome || '';
            document.getElementById('statoLega').value = data.lega.stato || 'attiva';
        }
    } catch (error) {
        console.error('Errore nel caricamento delle impostazioni:', error);
    }
}

// Salva le impostazioni dell'admin
async function saveAdminSettings() {
    if (!isAdmin) return false;
    
    try {
        const nomeLega = document.getElementById('nomeLega').value.trim();
        const statoLega = document.getElementById('statoLega').value;
        
        if (!nomeLega) {
            showAlert('Il nome della lega è obbligatorio', 'error');
            return false;
        }
        
        const data = await fetchAPI('admin', 'saveSettings', { 
            nome_lega: nomeLega, 
            stato_lega: statoLega 
        });
        
        if (data.success) {
            // Aggiorna il titolo del sito
            document.getElementById('sitoTitle').textContent = `Lo Scommessone - ${nomeLega}`;
            document.title = `Lo Scommessone - ${nomeLega}`;
            
            showAlert('Impostazioni salvate con successo!', 'success');
            return true;
        } else {
            showAlert(data.message || 'Errore durante il salvataggio delle impostazioni', 'error');
            return false;
        }
    } catch (error) {
        console.error('Errore durante il salvataggio delle impostazioni:', error);
        showAlert('Errore di connessione al server', 'error');
        return false;
    }
}

// FUNZIONI ADMIN SQUADRE

// Carica le squadre per admin
async function loadSquadre() {
    if (!isAdmin) return;
    
    try {
        const data = await fetchAPI('squadre', 'getAll');
        
        if (data.success) {
            const container = document.getElementById('squadreList');
            
            if (data.squadre && data.squadre.length > 0) {
                container.innerHTML = '';
                
                data.squadre.forEach(squadra => {
                    const squadraDiv = document.createElement('div');
                    squadraDiv.className = 'card';
                    squadraDiv.innerHTML = `
                        <h3>${squadra.nome}</h3>
                        <p><strong>Giocatori:</strong> ${squadra.giocatori.length}</p>
                        <div style="margin-top: 1rem;">
                            <button onclick="editSquadra('${squadra.id}')" class="btn-secondary">Modifica</button>
                            <button onclick="deleteSquadra('${squadra.id}')" class="btn-danger">Elimina</button>
                        </div>
                    `;
                    
                    container.appendChild(squadraDiv);
                });
            } else {
                container.innerHTML = '<p>Nessuna squadra registrata.</p>';
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento delle squadre:', error);
        document.getElementById('squadreList').innerHTML = '<p>Errore nel caricamento delle squadre.</p>';
    }
}

// Mostra form per aggiungere/modificare squadra
async function showSquadraForm(squadraId = null) {
    document.getElementById('squadreList').style.display = 'none';
    document.getElementById('squadraForm').style.display = 'block';
    document.getElementById('giocatoriList').innerHTML = '';
    
    // Reset form
    document.getElementById('nomeSquadra').value = '';
    
    if (squadraId) {
        // Carica dati squadra per modifica
        try {
            const data = await fetchAPI('squadre', 'get', { squadra_id: squadraId });
            
            if (data.success && data.squadra) {
                document.getElementById('nomeSquadra').value = data.squadra.nome;
                
                // Popola lista giocatori
                const container = document.getElementById('giocatoriList');
                
                if (data.squadra.giocatori && data.squadra.giocatori.length > 0) {
                    data.squadra.giocatori.forEach(giocatore => {
                        const giocatoreDiv = document.createElement('div');
                        giocatoreDiv.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                <span>${giocatore.nome}</span>
                                <button type="button" onclick="this.parentNode.remove()" class="btn-danger" style="padding: 0.25rem 0.5rem;">X</button>
                            </div>
                        `;
                        
                        container.appendChild(giocatoreDiv);
                    });
                }
            }
        } catch (error) {
            console.error('Errore nel caricamento dei dati della squadra:', error);
            showAlert('Errore nel caricamento dei dati della squadra', 'error');
        }
    }
}

// Aggiunge un giocatore alla squadra (form)
function addGiocatore() {
    const nomeGiocatore = document.getElementById('nomeGiocatore').value.trim();
    
    if (!nomeGiocatore) {
        showAlert('Inserisci il nome del giocatore', 'error');
        return;
    }
    
    const container = document.getElementById('giocatoriList');
    const giocatoreDiv = document.createElement('div');
    
    giocatoreDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span>${nomeGiocatore}</span>
            <button type="button" onclick="this.parentNode.remove()" class="btn-danger" style="padding: 0.25rem 0.5rem;">X</button>
        </div>
    `;
    
    container.appendChild(giocatoreDiv);
    document.getElementById('nomeGiocatore').value = '';
}

// Salva una squadra
async function saveSquadra() {
    const nome = document.getElementById('nomeSquadra').value.trim();
    
    if (!nome) {
        showAlert('Il nome della squadra è obbligatorio', 'error');
        return;
    }
    
    // Raccogli giocatori
    const giocatori = [];
    document.querySelectorAll('#giocatoriList div span').forEach(span => {
        giocatori.push(span.textContent);
    });
    
    try {
        const data = await fetchAPI('squadre', 'save', { 
            nome,
            giocatori
        });
        
        if (data.success) {
            showAlert('Squadra salvata con successo!', 'success');
            
            // Torna alla lista squadre
            cancelSquadraForm();
            
            // Ricarica squadre
            loadSquadre();
        } else {
            showAlert(data.message || 'Errore durante il salvataggio della squadra', 'error');
        }
    } catch (error) {
        console.error('Errore durante il salvataggio della squadra:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// Annulla form squadra
function cancelSquadraForm() {
    document.getElementById('squadreList').style.display = 'grid';
    document.getElementById('squadraForm').style.display = 'none';
}

// Elimina una squadra
async function deleteSquadra(squadraId) {
    if (!confirm('Sei sicuro di voler eliminare questa squadra? Questa azione è irreversibile.')) {
        return;
    }
    
    try {
        const data = await fetchAPI('squadre', 'delete', { squadra_id: squadraId });
        
        if (data.success) {
            showAlert('Squadra eliminata con successo!', 'success');
            loadSquadre();
        } else {
            showAlert(data.message || 'Errore durante l\'eliminazione della squadra', 'error');
        }
    } catch (error) {
        console.error('Errore durante l\'eliminazione della squadra:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// FUNZIONI ADMIN GIORNATE

// Carica le giornate per admin
async function loadGiornateForAdmin() {
    if (!isAdmin) return;
    
    try {
        const data = await fetchAPI('giornate', 'getAll');
        
        if (data.success) {
            // Popola selettore giornate per admin
            const giornataSelect = document.getElementById('giornataSelect');
            const risultatiGiornataSelect = document.getElementById('risultatiGiornataSelect');
            
            giornataSelect.innerHTML = '<option value="">-- Seleziona una giornata --</option>';
            risultatiGiornataSelect.innerHTML = '<option value="">-- Seleziona una giornata --</option>';
            
            if (data.giornate && data.giornate.length > 0) {
                data.giornate.forEach(giornata => {
                    const option = document.createElement('option');
                    option.value = giornata.id;
                    option.textContent = `Giornata ${giornata.numero} - ${formattaData(giornata.data, false)}`;
                    
                    giornataSelect.appendChild(option.cloneNode(true));
                    risultatiGiornataSelect.appendChild(option.cloneNode(true));
                });
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento delle giornate per admin:', error);
    }
}

// Mostra form per aggiungere una nuova giornata
function showGiornataForm() {
    document.getElementById('giornataForm').style.display = 'block';
    document.getElementById('partiteContainer').style.display = 'none';
    
    // Reset form
    document.getElementById('numeroGiornata').value = '';
    document.getElementById('dataGiornata').value = '';
    document.getElementById('oraChiusura').value = '';
}

// Annulla form giornata
function cancelGiornataForm() {
    document.getElementById('giornataForm').style.display = 'none';
    document.getElementById('partiteContainer').style.display = 'block';
}

// Salva una giornata
async function saveGiornata() {
    const numero = document.getElementById('numeroGiornata').value;
    const data = document.getElementById('dataGiornata').value;
    const oraChiusura = document.getElementById('oraChiusura').value;
    
    if (!numero || !data || !oraChiusura) {
        showAlert('Tutti i campi sono obbligatori', 'error');
        return;
    }
    
    try {
        const giornataData = {
            numero,
            data,
            chiusura_pronostici: `${data}T${oraChiusura}:00`
        };
        
        const result = await fetchAPI('giornate', 'save', giornataData);
        
        if (result.success) {
            showAlert('Giornata salvata con successo!', 'success');
            
            // Aggiorna selettore giornate
            loadGiornateForAdmin();
            
            // Torna al selettore
            cancelGiornataForm();
        } else {
            showAlert(result.message || 'Errore durante il salvataggio della giornata', 'error');
        }
    } catch (error) {
        console.error('Errore durante il salvataggio della giornata:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// Carica le partite di una giornata (admin)
async function loadPartiteAdmin(giornataId) {
    if (!isAdmin) return;
    
    try {
        const data = await fetchAPI('partite', 'getByGiornata', { giornata_id: giornataId });
        
        if (data.success) {
            const container = document.getElementById('partiteList');
            document.getElementById('partiteContainer').style.display = 'block';
            
            if (data.partite && data.partite.length > 0) {
                container.innerHTML = '';
                
                data.partite.forEach(partita => {
                    const partitaDiv = document.createElement('div');
                    partitaDiv.className = 'match-card';
                    
                    partitaDiv.innerHTML = `
                        <div class="match-header">
                            <div>${formattaData(partita.data_ora)}</div>
                            ${partita.stato === STATI_PARTITA.TERMINATA ? `
                            <div style="font-weight: bold;">TERMINATA</div>
                            ` : partita.stato === STATI_PARTITA.IN_CORSO ? `
                            <div style="font-weight: bold; color: var(--primary);">IN CORSO</div>
                            ` : ''}
                        </div>
                        <div class="match-teams">
                            <div class="team">
                                <div class="team-name">${partita.squadra_casa}</div>
                            </div>
                            <div class="vs">
                                ${partita.stato === STATI_PARTITA.TERMINATA || partita.stato === STATI_PARTITA.IN_CORSO ? 
                                    `${partita.gol_casa} - ${partita.gol_trasferta}` : 'VS'
                                }
                            </div>
                            <div class="team">
                                <div class="team-name">${partita.squadra_trasferta}</div>
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-top: 1rem;">
                            <button onclick="editPartita('${partita.id}')" class="btn-secondary">Modifica</button>
                            <button onclick="deletePartita('${partita.id}')" class="btn-danger">Elimina</button>
                        </div>
                    `;
                    
                    container.appendChild(partitaDiv);
                });
            } else {
                container.innerHTML = '<p>Nessuna partita per questa giornata.</p>';
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento delle partite per admin:', error);
        document.getElementById('partiteList').innerHTML = '<p>Errore nel caricamento delle partite.</p>';
    }
}

// Mostra form per aggiungere/modificare partita
async function showPartitaForm(partitaId = null) {
    document.getElementById('partiteList').style.display = 'none';
    document.getElementById('partitaForm').style.display = 'block';
    
    // Reset form
    document.getElementById('squadraCasa').innerHTML = '<option value="">-- Seleziona --</option>';
    document.getElementById('squadraTrasferta').innerHTML = '<option value="">-- Seleziona --</option>';
    document.getElementById('dataPartita').value = '';
    document.getElementById('oraPartita').value = '';
    
    // Carica squadre
    try {
        const squadreData = await fetchAPI('squadre', 'getAll');
        
        if (squadreData.success && squadreData.squadre) {
            const selectCasa = document.getElementById('squadraCasa');
            const selectTrasferta = document.getElementById('squadraTrasferta');
            
            squadreData.squadre.forEach(squadra => {
                const option = document.createElement('option');
                option.value = squadra.id;
                option.textContent = squadra.nome;
                
                selectCasa.appendChild(option.cloneNode(true));
                selectTrasferta.appendChild(option.cloneNode(true));
            });
            
            if (partitaId) {
                // Carica dati partita per modifica
                const partitaData = await fetchAPI('partite', 'get', { partita_id: partitaId });
                
                if (partitaData.success && partitaData.partita) {
                    selectCasa.value = partitaData.partita.squadra_casa_id;
                    selectTrasferta.value = partitaData.partita.squadra_trasferta_id;
                    
                    const dataOra = new Date(partitaData.partita.data_ora);
                    document.getElementById('dataPartita').value = dataOra.toISOString().split('T')[0];
                    document.getElementById('oraPartita').value = dataOra.toISOString().split('T')[1].substring(0, 5);
                }
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento delle squadre:', error);
        showAlert('Errore nel caricamento delle squadre', 'error');
    }
}

// Annulla form partita
function cancelPartitaForm() {
    document.getElementById('partiteList').style.display = 'block';
    document.getElementById('partitaForm').style.display = 'none';
}

// Salva una partita
async function savePartita() {
    const giornataId = document.getElementById('giornataSelect').value;
    const squadraCasaId = document.getElementById('squadraCasa').value;
    const squadraTrasfertaId = document.getElementById('squadraTrasferta').value;
    const dataPartita = document.getElementById('dataPartita').value;
    const oraPartita = document.getElementById('oraPartita').value;
    
    if (!giornataId || !squadraCasaId || !squadraTrasfertaId || !dataPartita || !oraPartita) {
        showAlert('Tutti i campi sono obbligatori', 'error');
        return;
    }
    
    if (squadraCasaId === squadraTrasfertaId) {
        showAlert('La squadra di casa e quella in trasferta devono essere diverse', 'error');
        return;
    }
    
    try {
        const partitaData = {
            giornata_id: giornataId,
            squadra_casa_id: squadraCasaId,
            squadra_trasferta_id: squadraTrasfertaId,
            data_ora: `${dataPartita}T${oraPartita}:00`
        };
        
        const result = await fetchAPI('partite', 'save', partitaData);
        
        if (result.success) {
            showAlert('Partita salvata con successo!', 'success');
            
            // Torna alla lista partite
            cancelPartitaForm();
            
            // Ricarica partite
            loadPartiteAdmin(giornataId);
        } else {
            showAlert(result.message || 'Errore durante il salvataggio della partita', 'error');
        }
    } catch (error) {
        console.error('Errore durante il salvataggio della partita:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// Elimina una partita
async function deletePartita(partitaId) {
    if (!confirm('Sei sicuro di voler eliminare questa partita? Questa azione è irreversibile.')) {
        return;
    }
    
    try {
        const data = await fetchAPI('partite', 'delete', { partita_id: partitaId });
        
        if (data.success) {
            showAlert('Partita eliminata con successo!', 'success');
            loadPartiteAdmin(document.getElementById('giornataSelect').value);
        } else {
            showAlert(data.message || 'Errore durante l\'eliminazione della partita', 'error');
        }
    } catch (error) {
        console.error('Errore durante l\'eliminazione della partita:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// FUNZIONI ADMIN RISULTATI

// Carica le partite per inserire i risultati
async function loadRisultatiAdmin(giornataId) {
    if (!isAdmin) return;
    
    try {
        const data = await fetchAPI('partite', 'getByGiornata', { giornata_id: giornataId });
        
        if (data.success) {
            const container = document.getElementById('risultatiList');
            
            if (data.partite && data.partite.length > 0) {
                container.innerHTML = `
                    <h3>Giornata ${data.giornata.numero} - ${formattaData(data.giornata.data)}</h3>
                `;
                
                data.partite.forEach(partita => {
                    const partitaDiv = document.createElement('div');
                    partitaDiv.className = 'match-card';
                    
                    const isTerminata = partita.stato === STATI_PARTITA.TERMINATA;
                    
                    partitaDiv.innerHTML = `
                        <div class="match-header">
                            <div>${formattaData(partita.data_ora)}</div>
                            ${isTerminata ? '<div style="font-weight: bold;">TERMINATA</div>' : ''}
                        </div>
                        <div class="match-teams">
                            <div class="team">
                                <div class="team-name">${partita.squadra_casa}</div>
                            </div>
                            <div class="vs">VS</div>
                            <div class="team">
                                <div class="team-name">${partita.squadra_trasferta}</div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
                            <h4>Risultato</h4>
                            <div class="match-result">
                                <div>
                                    <input type="number" id="golCasa_${partita.id}" class="result-input" min="0" max="20" value="${isTerminata ? partita.gol_casa : '0'}" required>
                                </div>
                                <div>-</div>
                                <div>
                                    <input type="number" id="golTrasferta_${partita.id}" class="result-input" min="0" max="20" value="${isTerminata ? partita.gol_trasferta : '0'}" required>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-group" style="margin-top: 1rem;">
                            <label>Marcatori Casa</label>
                            <div class="player-picker" id="marcatoriCasa_${partita.id}">
                                ${partita.giocatori_casa.map(giocatore => `
                                    <div class="player-chip ${isTerminata && partita.marcatori && partita.marcatori.some(m => m.id === giocatore.id) ? 'selected' : ''}" 
                                         data-id="${giocatore.id}" 
                                         data-partita="${partita.id}"
                                         onclick="toggleMarcatoreRisultato(this)">
                                        ${giocatore.nome}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Marcatori Trasferta</label>
                            <div class="player-picker" id="marcatoriTrasferta_${partita.id}">
                                ${partita.giocatori_trasferta.map(giocatore => `
                                    <div class="player-chip ${isTerminata && partita.marcatori && partita.marcatori.some(m => m.id === giocatore.id) ? 'selected' : ''}" 
                                         data-id="${giocatore.id}"
                                         data-partita="${partita.id}"
                                         onclick="toggleMarcatoreRisultato(this)">
                                        ${giocatore.nome}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                    
                    container.appendChild(partitaDiv);
                });
            } else {
                container.innerHTML = '<p>Nessuna partita disponibile per questa giornata.</p>';
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento delle partite per risultati:', error);
        document.getElementById('risultatiList').innerHTML = '<p>Errore nel caricamento delle partite.</p>';
    }
}

// Funzione per selezionare/deselezionare un marcatore nei risultati
function toggleMarcatoreRisultato(element) {
    element.classList.toggle('selected');
    
    // Aggiorna il conteggio dei gol in base ai marcatori selezionati
    const partitaId = element.getAttribute('data-partita');
    const casaCount = document.querySelectorAll(`#marcatoriCasa_${partitaId} .player-chip.selected`).length;
    const trasfertaCount = document.querySelectorAll(`#marcatoriTrasferta_${partitaId} .player-chip.selected`).length;
    
    document.getElementById(`golCasa_${partitaId}`).value = casaCount;
    document.getElementById(`golTrasferta_${partitaId}`).value = trasfertaCount;
}

// Salva tutti i risultati
async function saveAllRisultati() {
    const giornataId = document.getElementById('risultatiGiornataSelect').value;
    
    if (!giornataId) {
        showAlert('Seleziona una giornata', 'error');
        return;
    }
    
    // Raccogli tutti i risultati
    const risultati = [];
    const partiteCards = document.querySelectorAll('#risultatiList .match-card');
    
    partiteCards.forEach(card => {
        const playerChips = card.querySelectorAll('.player-chip');
        if (playerChips.length === 0) return; // Skip if not a valid match card
        
        const partitaId = playerChips[0].getAttribute('data-partita');
        const golCasa = parseInt(document.getElementById(`golCasa_${partitaId}`).value);
        const golTrasferta = parseInt(document.getElementById(`golTrasferta_${partitaId}`).value);
        
        // Raccogli i marcatori selezionati
        const marcatori = [];
        card.querySelectorAll('.player-chip.selected').forEach(chip => {
            marcatori.push(chip.getAttribute('data-id'));
        });
        
        risultati.push({
            partita_id: partitaId,
            gol_casa: golCasa,
            gol_trasferta: golTrasferta,
            marcatori
        });
    });
    
    if (risultati.length === 0) {
        showAlert('Nessun risultato da salvare', 'error');
        return;
    }
    
    try {
        const data = await fetchAPI('risultati', 'saveAll', { 
            giornata_id: giornataId,
            risultati
        });
        
        if (data.success) {
            showAlert('Risultati salvati con successo!', 'success');
        } else {
            showAlert(data.message || 'Errore durante il salvataggio dei risultati', 'error');
        }
    } catch (error) {
        console.error('Errore durante il salvataggio dei risultati:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// Calcola la classifica dopo l'inserimento dei risultati
async function calcolaClassifica() {
    const giornataId = document.getElementById('risultatiGiornataSelect').value;
    
    if (!giornataId) {
        showAlert('Seleziona una giornata', 'error');
        return;
    }
    
    try {
        const data = await fetchAPI('classifica', 'calcola', { giornata_id: giornataId });
        
        if (data.success) {
            showAlert('Classifica calcolata con successo!', 'success');
        } else {
            showAlert(data.message || 'Errore durante il calcolo della classifica', 'error');
        }
    } catch (error) {
        console.error('Errore durante il calcolo della classifica:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// FUNZIONI ADMIN ALBO D'ORO

// Carica l'albo d'oro per admin
async function loadAlboOroForAdmin() {
    if (!isAdmin) return;
    
    try {
        const data = await fetchAPI('alboOro', 'getAll');
        
        if (data.success) {
            const container = document.getElementById('edizioniList');
            
            if (data.edizioni && data.edizioni.length > 0) {
                container.innerHTML = '';
                
                data.edizioni.forEach(edizione => {
                    const edizioneDiv = document.createElement('div');
                    edizioneDiv.className = 'card';
                    
                    edizioneDiv.innerHTML = `
                        <h3>${edizione.nome_torneo} - ${edizione.anno}</h3>
                        <div style="margin-top: 0.5rem;">
                            <div><strong>1° Classificato:</strong> ${edizione.primo_classificato}</div>
                            <div><strong>2° Classificato:</strong> ${edizione.secondo_classificato || '-'}</div>
                            <div><strong>3° Classificato:</strong> ${edizione.terzo_classificato || '-'}</div>
                        </div>
                        <div style="margin-top: 1rem;">
                            <button onclick="editEdizione('${edizione.id}')" class="btn-secondary">Modifica</button>
                            <button onclick="deleteEdizione('${edizione.id}')" class="btn-danger">Elimina</button>
                        </div>
                    `;
                    
                    container.appendChild(edizioneDiv);
                });
            } else {
                container.innerHTML = '<p>Nessuna edizione registrata nell\'Albo d\'Oro.</p>';
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento dell\'albo d\'oro per admin:', error);
        document.getElementById('edizioniList').innerHTML = '<p>Errore nel caricamento dell\'albo d\'oro.</p>';
    }
}

// Mostra form per aggiungere/modificare edizione
async function showEdizioneForm(edizioneId = null) {
    document.getElementById('edizioniList').style.display = 'none';
    document.getElementById('edizioneForm').style.display = 'block';
    
    // Reset form
    document.getElementById('annoEdizione').value = '';
    document.getElementById('nomeTorneo').value = '';
    document.getElementById('primoClassificato').value = '';
    document.getElementById('secondoClassificato').value = '';
    document.getElementById('terzoClassificato').value = '';
    
    if (edizioneId) {
        // Carica dati edizione per modifica
        try {
            const data = await fetchAPI('alboOro', 'get', { edizione_id: edizioneId });
            
            if (data.success && data.edizione) {
                document.getElementById('annoEdizione').value = data.edizione.anno;
                document.getElementById('nomeTorneo').value = data.edizione.nome_torneo;
                document.getElementById('primoClassificato').value = data.edizione.primo_classificato;
                document.getElementById('secondoClassificato').value = data.edizione.secondo_classificato || '';
                document.getElementById('terzoClassificato').value = data.edizione.terzo_classificato || '';
            }
        } catch (error) {
            console.error('Errore nel caricamento dei dati dell\'edizione:', error);
            showAlert('Errore nel caricamento dei dati dell\'edizione', 'error');
        }
    }
}

// Annulla form edizione
function cancelEdizioneForm() {
    document.getElementById('edizioniList').style.display = 'block';
    document.getElementById('edizioneForm').style.display = 'none';
}

// Salva un'edizione
async function saveEdizione() {
    const anno = document.getElementById('annoEdizione').value.trim();
    const nomeTorneo = document.getElementById('nomeTorneo').value.trim();
    const primoClassificato = document.getElementById('primoClassificato').value.trim();
    const secondoClassificato = document.getElementById('secondoClassificato').value.trim();
    const terzoClassificato = document.getElementById('terzoClassificato').value.trim();
    
    if (!anno || !nomeTorneo || !primoClassificato) {
        showAlert('I campi Anno, Nome Torneo e 1° Classificato sono obbligatori', 'error');
        return;
    }
    
    try {
        const edizioneData = {
            anno,
            nome_torneo: nomeTorneo,
            primo_classificato: primoClassificato,
            secondo_classificato: secondoClassificato || null,
            terzo_classificato: terzoClassificato || null
        };
        
        const result = await fetchAPI('alboOro', 'save', edizioneData);
        
        if (result.success) {
            showAlert('Edizione salvata con successo!', 'success');
            
            // Torna alla lista edizioni
            cancelEdizioneForm();
            
            // Ricarica albo d'oro
            loadAlboOroForAdmin();
            loadAlboOro(); // Aggiorna anche la vista pubblica
        } else {
            showAlert(result.message || 'Errore durante il salvataggio dell\'edizione', 'error');
        }
    } catch (error) {
        console.error('Errore durante il salvataggio dell\'edizione:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// Elimina un'edizione
async function deleteEdizione(edizioneId) {
    if (!confirm('Sei sicuro di voler eliminare questa edizione? Questa azione è irreversibile.')) {
        return;
    }
    
    try {
        const data = await fetchAPI('alboOro', 'delete', { edizione_id: edizioneId });
        
        if (data.success) {
            showAlert('Edizione eliminata con successo!', 'success');
            loadAlboOroForAdmin();
            loadAlboOro(); // Aggiorna anche la vista pubblica
        } else {
            showAlert(data.message || 'Errore durante l\'eliminazione dell\'edizione', 'error');
        }
    } catch (error) {
        console.error('Errore durante l\'eliminazione dell\'edizione:', error);
        showAlert('Errore di connessione al server', 'error');
    }
}

// FUNZIONI UTILITÀ

// Mostra una sezione
function showSection(sectionId) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });

    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.style.display = 'block';
        selectedSection.classList.add('active');

        // Se è la sezione account e l'utente è loggato, carica i dati utente
        if (sectionId === 'account' && currentUser) {
            loadUserData();
            loadPronostici();
        }

        // Se è la sezione classifica, carica la classifica
        if (sectionId === 'classifica') {
            loadClassifica();
        }
        
        // Se è la sezione giornate, carica le partite della giornata corrente
        if (sectionId === 'giornate' && currentGiornata) {
            loadPartiteGiornata(currentGiornata);
        }
    }

    // Chiudi sezione login e admin quando si cambia sezione
    document.getElementById('authSection').style.display = 'none';
    document.getElementById('adminSection').style.display = 'none';
}

// Carica i dati dell'utente nella sezione account
function loadUserData() {
    if (currentUser) {
        document.getElementById('accountName').textContent = currentUser.nome;
        document.getElementById('accountEmail').textContent = currentUser.email;

        const regDate = new Date(currentUser.data_registrazione || Date.now());
        document.getElementById('accountRegDate').textContent = regDate.toLocaleDateString('it-IT');

        document.getElementById('notLoggedInMessage').style.display = 'none';
        document.getElementById('accountInfo').style.display = 'block';
    } else {
        document.getElementById('notLoggedInMessage').style.display = 'block';
        document.getElementById('accountInfo').style.display = 'none';
        document.getElementById('myScommesseSection').style.display = 'none';
        document.getElementById('statisticheSection').style.display = 'none';
    }
}

// Aggiorna l'interfaccia per un utente loggato
function updateUIForLoggedInUser() {
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.textContent = 'Account';
    loginBtn.onclick = () => showSection('account');
}

// Mostra un messaggio di alert
function showAlert(message, type) {
    // Rimuovi alert esistenti
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    // Crea nuovo alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    // Inserisci dopo il primo elemento del main
    document.querySelector('main').insertBefore(alert, document.querySelector('main').firstChild);

    // Rimuovi dopo 5 secondi
    setTimeout(() => {
        if (alert.parentNode) {
            alert.remove();
        }
    }, 5000);
}

// Mostra form per il recupero password
function showPasswordResetForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('adminLoginForm').style.display = 'none';
    document.getElementById('passwordResetSection').style.display = 'block';

    // Reset dei form
    document.getElementById('requestResetForm').style.display = 'block';
    document.getElementById('confirmResetForm').style.display = 'none';
    document.getElementById('resetEmail').value = '';
    document.getElementById('resetToken').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
}

// Funzione per mostrare il form di login
function showLoginForm() {
    document.getElementById('passwordResetSection').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('authSection').style.display = 'block';
    document.querySelector('.tab[data-tab="login"]').classList.add('active');
    document.querySelector('.tab[data-tab="register"]').classList.remove('active');
    document.getElementById('login').classList.add('active');
    document.getElementById('register').classList.remove('active');
}

// SETUP EVENT LISTENERS

function setupEventListeners() {
    // Gestione navigazione
    document.querySelectorAll('a[onclick^="showSection"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('onclick').match(/'([^']+)'/)[1];
            showSection(sectionId);
        });
    });

    // Hamburger menu
    const hamburger = document.querySelector('.hamburger');
    if (hamburger) {
        hamburger.addEventListener('click', function() {
            document.querySelector('nav').classList.toggle('show');
        });
    }

    // Gestione tab login/registrati
    const tabs = document.querySelectorAll('.tab[data-tab]');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            document.getElementById(this.getAttribute('data-tab')).classList.add('active');
        });
    });
    
    // Gestione tab admin
    const adminTabs = document.querySelectorAll('[data-admin-tab]');
    adminTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            adminTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Nascondi tutte le sezioni admin
            document.querySelectorAll('[id^="admin"]').forEach(section => {
                if (section.id !== 'adminPanel' && section.id !== 'adminSection' && section.id !== 'adminLoginForm') {
                    section.style.display = 'none';
                }
            });
            
            // Mostra la sezione corrispondente
            const sectionId = `admin${this.getAttribute('data-admin-tab').charAt(0).toUpperCase() + this.getAttribute('data-admin-tab').slice(1)}`;
            document.getElementById(sectionId).style.display = 'block';
        });
    });

    // Click su pulsante login
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            if (currentUser) {
                showSection('account');
            } else {
                document.getElementById('authSection').style.display = 'block';
                document.getElementById('login').classList.add('active');
                document.getElementById('register').classList.remove('active');
                document.querySelector('.tab[data-tab="login"]').classList.add('active');
                document.querySelector('.tab[data-tab="register"]').classList.remove('active');
            }
        });
    }

    // Click su login dall'account
    const loginFromAccountBtn = document.getElementById('loginFromAccountBtn');
    if (loginFromAccountBtn) {
        loginFromAccountBtn.addEventListener('click', function() {
            document.getElementById('authSection').style.display = 'block';
        });
    }

    // Click su logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Click su partecipaNow
    const partecipaNowBtn = document.getElementById('partecipaNowBtn');
    if (partecipaNowBtn) {
        partecipaNowBtn.addEventListener('click', function() {
            if (currentUser) {
                showSection('giornate');
            } else {
                document.getElementById('authSection').style.display = 'block';
            }
        });
    }

    // Click su admin
    const adminBtn = document.getElementById('adminBtn');
    if (adminBtn) {
        adminBtn.addEventListener('click', function() {
            document.getElementById('adminSection').style.display = 'block';
            document.getElementById('adminLoginForm').style.display = 'block';
            document.getElementById('adminPanel').style.display = 'none';
        });
    }

    // Login form submit
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            if (await login(email, password)) {
                document.getElementById('authSection').style.display = 'none';
                loginForm.reset();
            }
        });
    }

    // Register form submit
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const nome = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                showAlert('Le password non coincidono!', 'error');
                return;
            }

            if (await register(nome, email, password)) {
                document.getElementById('authSection').style.display = 'none';
                registerForm.reset();
            }
        });
    }

    // Admin login submit
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', async function() {
            const password = document.getElementById('adminPassword').value;

            if (await adminLogin(password)) {
                document.getElementById('adminPassword').value = '';
            }
        });
    }

    // Password dimenticata
    document.getElementById('forgotPasswordLink')?.addEventListener('click', function(e) {
        e.preventDefault();
        showPasswordResetForm();
    });

    // Torna al login
    document.getElementById('backToLoginLink')?.addEventListener('click', function(e) {
        e.preventDefault();
        showLoginForm();
    });

    // Richiedi reset password
    document.getElementById('requestResetBtn')?.addEventListener('click', async function() {
        const email = document.getElementById('resetEmail').value;

        if (!email) {
            showAlert('Inserisci la tua email', 'error');
            return;
        }

        await requestPasswordReset(email);
    });

    // Conferma reset password
    document.getElementById('confirmResetBtn')?.addEventListener('click', async function() {
        const token = document.getElementById('resetToken').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmNewPassword = document.getElementById('confirmNewPassword').value;

        if (!token || !newPassword || !confirmNewPassword) {
            showAlert('Tutti i campi sono obbligatori', 'error');
            return;
        }

        if (newPassword !== confirmNewPassword) {
            showAlert('Le password non coincidono', 'error');
            return;
        }

        await resetPassword(token, newPassword);
    });
    
    // Selezione giornata (utente)
    document.getElementById('giornataSelectUser')?.addEventListener('change', function() {
        currentGiornata = this.value;
        loadPartiteGiornata(currentGiornata);
    });
    
    // Selezione giornata (pronostici)
    document.getElementById('pronosticiGiornataSelect')?.addEventListener('change', function() {
        loadPronosticiGiornata(this.value);
    });
    
    // Selezione giornata (classifica)
    document.getElementById('classificaGiornataSelect')?.addEventListener('change', function() {
        loadClassifica();
    });
    
    // Selezione giornata (admin)
    document.getElementById('giornataSelect')?.addEventListener('change', function() {
        const giornataId = this.value;
        if (giornataId) {
            loadPartiteAdmin(giornataId);
        } else {
            document.getElementById('partiteList').innerHTML = '<p>Seleziona una giornata</p>';
        }
    });
    
    // Selezione giornata (risultati)
    document.getElementById('risultatiGiornataSelect')?.addEventListener('change', function() {
        const giornataId = this.value;
        if (giornataId) {
            loadRisultatiAdmin(giornataId);
        } else {
            document.getElementById('risultatiList').innerHTML = '<p>Seleziona una giornata</p>';
        }
    });
    
    // Admin: Salva impostazioni
    document.getElementById('saveSettingsBtn')?.addEventListener('click', saveAdminSettings);
    
    // Admin: Aggiungi squadra
    document.getElementById('addSquadraBtn')?.addEventListener('click', function() {
        showSquadraForm();
    });
    
    // Admin: Salva squadra
    document.getElementById('saveSquadraBtn')?.addEventListener('click', saveSquadra);
    
    // Admin: Annulla form squadra
    document.getElementById('cancelSquadraBtn')?.addEventListener('click', cancelSquadraForm);
    
    // Admin: Aggiungi giocatore
    document.getElementById('addGiocatoreBtn')?.addEventListener('click', addGiocatore);
    
    // Admin: Aggiungi giornata
    document.getElementById('addGiornataBtn')?.addEventListener('click', showGiornataForm);
    
    // Admin: Salva giornata
    document.getElementById('saveGiornataBtn')?.addEventListener('click', saveGiornata);
    
    // Admin: Annulla form giornata
    document.getElementById('cancelGiornataBtn')?.addEventListener('click', cancelGiornataForm);
    
    // Admin: Aggiungi partita
    document.getElementById('addPartitaBtn')?.addEventListener('click', function() {
        showPartitaForm();
    });
    
    // Admin: Salva partita
    document.getElementById('savePartitaBtn')?.addEventListener('click', savePartita);
    
    // Admin: Annulla form partita
    document.getElementById('cancelPartitaBtn')?.addEventListener('click', cancelPartitaForm);
    
    // Admin: Salva tutti i risultati
    document.getElementById('saveAllRisultatiBtn')?.addEventListener('click', saveAllRisultati);
    
    // Admin: Calcola classifica
    document.getElementById('calcolaClassificaBtn')?.addEventListener('click', calcolaClassifica);
    
    // Admin: Aggiungi edizione albo d'oro
    document.getElementById('addEdizioneBtn')?.addEventListener('click', function() {
        showEdizioneForm();
    });
    
    // Admin: Salva edizione albo d'oro
    document.getElementById('saveEdizioneBtn')?.addEventListener('click', saveEdizione);
    
    // Admin: Annulla form edizione albo d'oro
    document.getElementById('cancelEdizioneBtn')?.addEventListener('click', cancelEdizioneForm);
}
