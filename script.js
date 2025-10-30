// --- 1. Configuración de Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, push } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
// ¡NUEVO! Importamos nuestro diccionario
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

// --- 3. Variables de Estado Global ---
let currentGameID = null;
let playerRole = null;
let secretWord = null; // ¡Ahora ambos jugadores tendrán esto!
let isGameActive = false;
let gameListener = null;

// --- 4. Event Listeners ---
createGameBtn.addEventListener('click', crearPartida);
joinGameBtn.addEventListener('click', unirseAPartida);
copyLinkBtn.addEventListener('click', copiarEnlace);
guessBtn.addEventListener('click', handleGuess);
guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGuess();
});

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('dark-mode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }
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


// --- 5. Funciones Principales (Firebase) ---

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

async function crearPartida() {
    // ACTUALIZADO: Convertir a minúsculas para validación
    const word = secretWordInput.value.trim().toLowerCase();

    // Validación de 5 letras
    if (word.length !== 5) {
        showToast("¡La palabra debe tener exactamente 5 letras!");
        applyAnimation(secretWordInput, 'shake');
        return;
    }
    // Validación de solo letras (ahora minúsculas)
    if (!/^[a-zñ]+$/.test(word)) {
        showToast("¡La palabra solo debe contener letras!");
        applyAnimation(secretWordInput, 'shake');
        return;
    }
    
    // ¡NUEVA VALIDACIÓN DE DICCIONARIO!
    if (!DICCIONARIO.has(word)) {
        showToast("La palabra no está en nuestro diccionario.");
        applyAnimation(secretWordInput, 'shake');
        return;
    }

    createGameBtn.disabled = true;
    createGameBtn.textContent = "Creando...";

    currentGameID = await generarCodigoUnico();
    const newGameRef = ref(db, `games/${currentGameID}`);

    document.getElementById('create-section').classList.add('hidden');
    document.getElementById('join-section').classList.add('hidden');
    createGameBtn.disabled = false;
    createGameBtn.textContent = "Crear";
    
    set(newGameRef, {
        secretWord: word, // Guardar palabra en minúsculas
        status: 'waiting',
        intentos: {}
    });

    playerRole = 'retador';
    secretWord = word; // ¡CORRECCIÓN DE BUG! El retador también guarda la palabra
    
    const gameURL = `${window.location.origin}${window.location.pathname}#${currentGameID}`;
    
    roomCodeDisplay.textContent = currentGameID;
    gameLinkText.value = gameURL;
    gameCodeDisplay.classList.remove('hidden');

    // El retador se queda en el lobby, escuchando a que alguien se una.
    const gameStatusRef = ref(db, `games/${currentGameID}/status`);
    gameListener = onValue(gameStatusRef, (snapshot) => {
        if (snapshot.val() === 'active') {
            iniciarJuego('retador');
        }
    });
}

function unirseAPartida() {
    // Código de sala siempre en mayúsculas
    let code = joinCodeInput.value.trim().toUpperCase();
    
    if (code.includes('#')) {
        code = code.split('#')[1].toUpperCase();
    }
    
    // Validación de código de 5 letras (mayúsculas)
    if (code.length !== 5 || !/^[A-Z]+$/.test(code)) {
        showToast("El código debe tener 5 letras.");
        applyAnimation(joinCodeInput, 'shake');
        return;
    }

    const gameRef = ref(db, `games/${code}`);

    get(gameRef).then((snapshot) => {
        if (!snapshot.exists()) {
            showToast("No se encontró esa partida. Revisa el código.");
            applyAnimation(joinCodeInput, 'shake');
        } else if (snapshot.val().status === 'active') {
            showToast("Esta partida ya está en progreso.");
        } else {
            currentGameID = code;
            playerRole = 'retado';
            secretWord = snapshot.val().secretWord; // Obtiene la palabra (en minúsculas)
            
            update(gameRef, { status: 'active' });
            window.history.replaceState(null, '', window.location.pathname);
            
            iniciarJuego('retado');
        }
    }).catch((error) => {
        console.error("Error al unirse a la partida:", error);
        showToast("Error de red. Inténtalo de nuevo.");
    });
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

function iniciarJuego(role) {
    playerRole = role;
    
    lobbyContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    isGameActive = true;

    if (playerRole === 'retador') {
        guessInput.disabled = true;
        guessBtn.disabled = true;
        gameMessage.textContent = "¡Se unió el retado! Esperando su intento.";
    } else {
        guessInput.disabled = false;
        guessBtn.disabled = false;
        guessInput.focus();
        gameMessage.textContent = "¡Tu turno! Adivina la palabra.";
    }

    if (gameListener) {
        gameListener(); // Desconecta el listener de status
    }

    sincronizarJuego();
}

function sincronizarJuego() {
    const gameRef = ref(db, `games/${currentGameID}`);
    
    gameListener = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        let intentosArray = [];
        if (data.intentos) {
            intentosArray = Object.values(data.intentos);
        }
        
        renderizarGrid(intentosArray);
            
        if (intentosArray.length > 0) {
            const ultimoIntento = intentosArray[intentosArray.length - 1];
            
            // ¡CORRECCIÓN DE BUG! Ahora 'secretWord' existe para ambos roles
            if (ultimoIntento.guess === secretWord) {
                gameMessage.textContent = "¡El retado ha ganado!";
                if (playerRole === 'retado') {
                    triggerVictoryAnimation(intentosArray.length - 1);
                }
                endGame();
            } else if (intentosArray.length === 5 && ultimoIntento.guess !== secretWord) {
                gameMessage.textContent = "¡El retado ha perdido! Se acabaron los intentos.";
                endGame();
            }
        }
    });
}

function handleGuess() {
    if (!isGameActive || playerRole !== 'retado') return;
    
    // ACTUALIZADO: Convertir a minúsculas para validación
    const guess = guessInput.value.trim().toLowerCase();

    if (guess.length !== 5) {
        showToast("¡Tu intento debe tener 5 letras!");
        applyAnimation(guessInput, 'shake');
        return;
    }
    
    // ¡NUEVA VALIDACIÓN DE DICCIONARIO!
    if (!DICCIONARIO.has(guess)) {
        showToast("Esa palabra no está en el diccionario.");
        applyAnimation(gameGrid.children[intentosArray.length], 'shake'); // Sacude la fila actual
        return;
    }

    const cellStates = procesarLogicaIntento(guess, secretWord);
    
    const intentosRef = ref(db, `games/${currentGameID}/intentos`);
    const newIntentRef = push(intentosRef);
    set(newIntentRef, {
        guess: guess, // Guardar intento en minúsculas
        states: cellStates
    });

    guessInput.value = "";
}

function renderizarGrid(intentos) {
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
            // ACTUALIZADO: Mostrar la letra en mayúsculas
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

/**
 * Lógica pura de Wordle (ahora todo en minúsculas)
 */
function procesarLogicaIntento(guess, secret) {
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

function endGame() {
    isGameActive = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;

    if (gameListener) {
        gameListener(); // Desconecta el listener
    }
    
    resetBtn.classList.remove('hidden');
    resetBtn.textContent = "Volver al Lobby";
    resetBtn.addEventListener('click', () => {
        window.location.reload();
    }, { once: true });
}

// --- 7. Funciones de Utilidad (Animaciones y Toasts) ---
function triggerVictoryAnimation(rowIndex) {
    const winningRow = gameGrid.children[rowIndex]; 
    for (let i = 0; i < 5; i++) {
        const cell = winningRow.children[i];
        setTimeout(() => {
            cell.classList.add('jubilation');
        }, i * 100);
    }
}

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
