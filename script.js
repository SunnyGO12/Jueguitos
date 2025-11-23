// --- 1. Configuración de Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, push } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
// Importamos nuestro diccionario
import { DICCIONARIO } from './diccionario.js';

// Tu configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCKteZmrBY-qSjxbVRVNwSVZWOtPerw_a8",
    authDomain: "multiplayer-f7e23.firebaseapp.com",
    databaseURL: "https://multiplayer-f7e23-default-rtdb.firebaseio.com",
    projectId: "multiplayer-f7e23",
    storageBucket: "multiplayer-f7e23.firebasestorage.app",
    messagingSenderId: "432637902351",
    appId: "1:432637902351:web:3824058ab4070ac86e6d7a",
    measurementId: "G-VGHCJBMEMK"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. Elementos del DOM ---
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');
const createGameBtn = document.getElementById('create-game-btn');
const secretWordInput = document.getElementById('secret-word-input');
const joinGameBtn = document.getElementById('join-game-btn');
const joinCodeInput = document.getElementById('join-code-input');
const gameCodeDisplay = document.getElementById('game-code-display');
const gameLinkText = document.getElementById('game-link-text');
const copyLinkBtn = document.getElementById('copy-link-btn');
const roomCodeDisplay = document.querySelector('.room-code-display');
const gameGrid = document.getElementById('game-grid');
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');
const gameMessage = document.getElementById('game-message');
const resetBtn = document.getElementById('reset-btn');
const darkModeToggle = document.getElementById('dark-mode-toggle');
const toastContainer = document.getElementById('toast-container');

// Elementos de control fino
const createSectionWordle = document.getElementById('create-section');
const joinSectionWordle = document.getElementById('join-section');
const secretWordDisplay = document.getElementById('secret-word-display');
const retadorInfo = document.getElementById('retador-info');
const keyboardContainer = document.getElementById('keyboard-container');

// --- 3. Variables de Estado Global ---
let currentGameID = null;
let playerRole = null;
let secretWord = null; 
let isGameActive = false;
let gameListener = null; 
let statusListener = null; 

// --- 4. Event Listeners ---
createGameBtn.addEventListener('click', crearPartidaWordle);
joinGameBtn.addEventListener('click', unirseAPartidaWordle);
copyLinkBtn.addEventListener('click', copiarEnlace);
guessBtn.addEventListener('click', handleGuessWordle);
guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGuessWordle();
});
if (keyboardContainer) {
    keyboardContainer.addEventListener('click', handleKeyboardClick);
}
resetBtn.addEventListener('click', handleResetClick); // Usar la función global de reset

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar Dark Mode
    if (localStorage.getItem('dark-mode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }
    // Cargar código de partida desde la URL
    if (window.location.hash) {
        const gameCodeFromURL = window.location.hash.substring(1).toUpperCase();
        joinCodeInput.value = gameCodeFromURL;
        showToast("Código de partida cargado desde el enlace.", 'success');
    }
});

darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('dark-mode', isDarkMode);
    darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
});


// --- LÓGICA GENERAL ---

function generarCodigo(longitud) {
    let codigo = '';
    const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < longitud; i++) {
        codigo += CARACTERES.charAt(Math.floor(Math.random() * CARACTERES.length));
    }
    return codigo;
}

async function generarCodigoUnico() {
    let codigoUnico = '';
    let existe = true;
    while (existe) {
        codigoUnico = generarCodigo(5);
        const gameRef = ref(db, `games/${codigoUnico}`);
        const snapshot = await get(gameRef);
        existe = snapshot.exists();
    }
    return codigoUnico;
}

function copiarEnlace() {
    gameLinkText.select();
    gameLinkText.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(gameLinkText.value).then(() => {
        showToast("¡Enlace copiado al portapapeles!", 'success');
    }).catch(err => {
        showToast("No se pudo copiar el enlace.");
        console.error('Error al copiar:', err);
    });
}

function resetGameListeners() {
    if (gameListener) {
        gameListener();
        gameListener = null;
    }
    if (statusListener) {
        statusListener();
        statusListener = null;
    }
}

function handleResetClick() {
    resetGameListeners();
    window.location.reload();
}

// --- LÓGICA WORDLE ---

async function crearPartidaWordle() {
    const word = secretWordInput.value.trim().toLowerCase();

    if (word.length !== 5 || !/^[a-zñ]+$/.test(word)) {
        showToast("¡La palabra debe tener 5 letras válidas!");
        applyAnimation(secretWordInput, 'shake');
        return;
    }
    
    if (!DICCIONARIO.has(word)) {
        showToast("La palabra no está en nuestro diccionario.");
        applyAnimation(secretWordInput, 'shake');
        return;
    }

    createGameBtn.disabled = true;
    createGameBtn.textContent = "Creando...";
    resetGameListeners(); 

    currentGameID = await generarCodigoUnico();
    const newGameRef = ref(db, `games/${currentGameID}`);
    
    set(newGameRef, {
        gameType: 'wordle', 
        secretWord: word, 
        status: 'waiting',
        intentos: {}
    });

    playerRole = 'retador';
    secretWord = word; 

    createSectionWordle.classList.add('hidden');
    joinSectionWordle.classList.add('hidden');
    
    createGameBtn.disabled = false;
    createGameBtn.textContent = "Crear";
    
    const gameURL = `${window.location.origin}${window.location.pathname}#${currentGameID}`;
    
    roomCodeDisplay.textContent = currentGameID;
    gameLinkText.value = gameURL;
    gameCodeDisplay.classList.remove('hidden');

    const gameStatusRef = ref(db, `games/${currentGameID}/status`);
    statusListener = onValue(gameStatusRef, (snapshot) => {
        if (snapshot.val() === 'active') {
            iniciarJuegoWordle('retador');
        }
    });
}

function unirseAPartidaWordle() {
    let code = joinCodeInput.value.trim().toUpperCase();
    
    if (code.includes('#')) {
        code = code.split('#')[1].toUpperCase();
    }
    
    if (code.length !== 5 || !/^[A-Z]+$/.test(code)) {
        showToast("El código debe tener 5 letras.");
        applyAnimation(joinCodeInput, 'shake');
        return;
    }

    const gameRef = ref(db, `games/${code}`);

    get(gameRef).then((snapshot) => {
        const data = snapshot.val();
        if (!snapshot.exists() || data.gameType !== 'wordle') {
            showToast("No se encontró esa partida de Wordle.");
        } else if (data.status === 'active') {
            showToast("Esta partida ya está en progreso.");
        } else {
            currentGameID = code;
            playerRole = 'retado';
            secretWord = data.secretWord; 
            
            update(gameRef, { status: 'active' });
            window.history.replaceState(null, '', window.location.pathname);
            
            iniciarJuegoWordle('retado');
        }
    });
}

function iniciarJuegoWordle(role) {
    playerRole = role;
    
    lobbyContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    isGameActive = true;

    if (playerRole === 'retador') {
        guessInput.disabled = true;
        guessBtn.disabled = true;
        gameMessage.textContent = "¡Se unió el retado! Esperando su intento.";
        
        retadorInfo.classList.remove('hidden');
        secretWordDisplay.textContent = secretWord.toUpperCase();
        
    } else { // Retado
        guessInput.disabled = false;
        guessBtn.disabled = false;
        guessInput.focus();
        gameMessage.textContent = "¡Tu turno! Adivina la palabra.";
        retadorInfo.classList.add('hidden');
    }

    if (statusListener) {
        statusListener(); 
        statusListener = null;
    }

    sincronizarJuegoWordle();
}

function sincronizarJuegoWordle() {
    const gameRef = ref(db, `games/${currentGameID}`);
    
    resetGameListeners(); 
    
    gameListener = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        let intentosArray = [];
        if (data.intentos) {
            intentosArray = Object.values(data.intentos);
        }
        
        renderizarGridWordle(intentosArray);
        actualizarTecladoWordle(intentosArray);
            
        if (intentosArray.length > 0) {
            const ultimoIntento = intentosArray[intentosArray.length - 1];
            
            if (ultimoIntento.guess === secretWord) {
                gameMessage.textContent = `¡El retado ha ganado! La palabra era ${secretWord.toUpperCase()}.`;
                if (playerRole === 'retado') {
                    triggerVictoryAnimationWordle(intentosArray.length - 1);
                }
                endGameWordle();
            } else if (intentosArray.length === 5) {
                gameMessage.textContent = `¡El retado ha perdido! La palabra era ${secretWord.toUpperCase()}.`;
                endGameWordle();
            }
        }
    });
}

function handleGuessWordle() {
    if (!isGameActive || playerRole !== 'retado') return;
    
    const guess = guessInput.value.trim().toLowerCase();
    
    get(ref(db, `games/${currentGameID}`)).then(snapshot => {
        const data = snapshot.val();
        const intentosArray = data.intentos ? Object.values(data.intentos) : [];
        const currentRowIndex = intentosArray.length;
        
        if (currentRowIndex >= 5) {
            showToast("Se acabaron los intentos.");
            return;
        }
        
        const currentRowElement = gameGrid.children[currentRowIndex];

        if (guess.length !== 5) {
            showToast("¡Tu intento debe tener 5 letras!");
            applyAnimation(guessInput, 'shake');
            return;
        }
        
        if (!DICCIONARIO.has(guess)) {
            showToast("Esa palabra no está en el diccionario.");
            applyAnimation(currentRowElement, 'shake'); 
            return;
        }

        const cellStates = procesarLogicaIntentoWordle(guess, secretWord);
        
        const intentosRef = ref(db, `games/${currentGameID}/intentos`);
        const newIntentRef = push(intentosRef);
        set(newIntentRef, {
            guess: guess, 
            states: cellStates
        });

        guessInput.value = "";
    });
}

function renderizarGridWordle(intentos) {
    for (let i = 0; i < 5; i++) {
        const row = gameGrid.children[i];
        for (let j = 0; j < 5; j++) {
            const cell = row.children[j];
            cell.textContent = "";
            cell.className = "grid-cell";
        }
    }
    
    intentos.forEach((intento, rowIndex) => {
        const row = gameGrid.children[rowIndex];
        const guess = intento.guess;
        const states = intento.states;
        
        for (let i = 0; i < 5; i++) {
            const cell = row.children[i];
            cell.textContent = guess[i].toUpperCase(); 
            cell.classList.add(`cell-${states[i]}`);
            
            if (rowIndex === intentos.length - 1 && !cell.classList.contains('cell-reveal')) {
                 setTimeout(() => {
                    cell.classList.add('cell-reveal');
                 }, i * 300);
            } else {
                cell.classList.add('cell-reveal'); 
            }
        }
    });
}

function actualizarTecladoWordle(intentos) {
    const letterStatus = {}; 
    
    intentos.forEach(intento => {
        const guess = intento.guess;
        const states = intento.states;
        
        for (let i = 0; i < 5; i++) {
            const letter = guess[i].toUpperCase();
            const state = states[i];
            
            if (state === 'correct') {
                letterStatus[letter] = 'correct';
            } else if (state === 'present' && letterStatus[letter] !== 'correct') {
                letterStatus[letter] = 'present';
            } else if (!letterStatus[letter] && state === 'absent') { 
                 letterStatus[letter] = 'absent';
            }
        }
    });
    
    document.querySelectorAll('#keyboard-container button').forEach(button => {
        const key = button.getAttribute('data-key')?.toUpperCase();
        if (key && letterStatus[key]) {
            button.classList.remove('keyboard-correct', 'keyboard-present', 'keyboard-absent'); 
            button.classList.add(`keyboard-${letterStatus[key]}`);
        }
    });
}

function handleKeyboardClick(e) {
    const key = e.target.getAttribute('data-key');
    const action = e.target.getAttribute('data-action');
    
    if (!isGameActive || playerRole !== 'retado') return;

    if (key) {
        guessInput.value += key.toUpperCase();
    } else if (action === 'enter') {
        handleGuessWordle();
    } else if (action === 'del') {
        guessInput.value = guessInput.value.slice(0, -1);
    }
    
    guessInput.value = guessInput.value.slice(0, 5);
    guessInput.focus(); 
}

function procesarLogicaIntentoWordle(guess, secret) {
    const secretWordMap = {};
    for (const letter of secret) {
        secretWordMap[letter] = (secretWordMap[letter] || 0) + 1;
    }
    const cellStates = Array(5).fill('absent');
    
    for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        if (letter === secret[i]) {
            cellStates[i] = 'correct';
            secretWordMap[letter]--;
        }
    }
    for (let i = 0; i < 5; i++) {
        if (cellStates[i] === 'correct') continue;
        const letter = guess[i];
        if (secret.includes(letter) && secretWordMap[letter] > 0) {
            cellStates[i] = 'present';
            secretWordMap[letter]--;
        }
    }
    return cellStates;
}

function triggerVictoryAnimationWordle(rowIndex) {
    const winningRow = gameGrid.children[rowIndex]; 
    for (let i = 0; i < 5; i++) {
        const cell = winningRow.children[i];
        setTimeout(() => {
            cell.classList.add('jubilation');
        }, i * 100);
    }
}

function endGameWordle() {
    isGameActive = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;
    resetGameListeners();
    
    resetBtn.classList.remove('hidden');
    resetBtn.textContent = "Volver al Lobby";
    resetBtn.removeEventListener('click', handleResetClick); 
    resetBtn.addEventListener('click', handleResetClick, { once: true });
}

// --- FUNCIONES DE UTILIDAD (Quedan aquí) ---

function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.classList.add('toast');
    if (type === 'success') {
        toast.classList.add('success');
    }
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function applyAnimation(element, animationClass) {
    element.classList.add(animationClass);
    element.addEventListener('animationend', () => {
        element.classList.remove(animationClass);
    }, { once: true });
}
