// Questo file contiene le costanti globali dell'applicazione

// Opzioni per il segno della partita
const SEGNI_PARTITA = [
    { value: '1', label: '1 (Vittoria Casa)' },
    { value: 'X', label: 'X (Pareggio)' },
    { value: '2', label: '2 (Vittoria Trasferta)' }
];

// Messaggi di sistema
const MESSAGGI = {
    NESSUNA_PARTITA: 'Nessuna partita disponibile al momento.',
    NESSUN_PRONOSTICO: 'Non hai ancora inserito pronostici per questa giornata.',
    TERMINE_SCADUTO: 'Il termine per i pronostici è scaduto!',
    RISULTATI_SALVATI: 'Risultati salvati con successo!',
    PRONOSTICO_SALVATO: 'Pronostico salvato con successo!',
    ERRORE_GENERICO: 'Si è verificato un errore. Riprova più tardi.',
    FORM_INCOMPLETO: 'Completa tutti i campi richiesti.'
};

// Stati delle partite
const STATI_PARTITA = {
    DA_DISPUTARE: 'da_disputare',
    IN_CORSO: 'in_corso',
    TERMINATA: 'terminata'
};

// Regole di punteggio
const PUNTEGGI = {
    SEGNO: 1,
    RISULTATO: 3,
    MARCATORI: 2  // Questo verrà aggiunto ai punti del risultato esatto
};

// Funzione per calcolare il segno della partita dal risultato
function calcolaSegno(golCasa, golTrasferta) {
    if (golCasa > golTrasferta) return '1';
    if (golCasa < golTrasferta) return '2';
    return 'X';
}

// Funzione per formattare la data
function formattaData(data, includiOra = true) {
    const options = {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    
    if (includiOra) {
        options.hour = '2-digit';
        options.minute = '2-digit';
    }
    
    return new Date(data).toLocaleDateString('it-IT', options);
}

// Funzione per controllare se una data è passata
function isDataPassata(data) {
    return new Date(data) < new Date();
}

// Funzione per convertire minuti in formato leggibile
function formatoTempo(minuti) {
    if (minuti < 60) {
        return `${minuti}m`;
    } else {
        const ore = Math.floor(minuti / 60);
        const min = minuti % 60;
        return min > 0 ? `${ore}h ${min}m` : `${ore}h`;
    }
}
