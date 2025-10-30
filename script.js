// --- 1. Configuración de Firebase ---

// Importar las funciones necesarias desde los SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

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
let currentGameID = null; // El código de 5 letras
let playerRole = null; // 'retador' o 'retado'
let secretWord = null; // Solo la conocerá el retado (para comprobar)
let isGameActive = false;
let gameListener = null; // Variable para guardar el listener de Firebase

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

/**
 * Genera un código aleatorio de una longitud dada.
 */
function generarCodigo(longitud) {
    let codigo = '';
    const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < longitud; i++) {
        codigo += CARACTERES.charAt(Math.floor(Math.random() * CARACTERES.length));
    }
    return codigo;
}

/**
 * Genera un código único de 5 letras que no exista en Firebase.
 */
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

/**
 * El Retador crea la partida (es asíncrona).
 */
async function crearPartida() {
    const word = secretWordInput.value.trim().toUpperCase();

    if (word.length !== 5) {
        showToast("¡La palabra debe tener exactamente 5 letras!");
        applyAnimation(secretWordInput, 'shake');
        return;
    }
    if (!/^[A-ZÑ]+$/.test(word)) {
        showToast("¡La palabra solo debe contener letras!");
        applyAnimation(secretWordInput, 'shake');
        return;
    }

    createGameBtn.disabled = true;
    createGameBtn.textContent = "Creando...";

    currentGameID = await generarCodigoUnico();
    const newGameRef = ref(db, `games/${currentGameID}`);

    // Ocultar formularios de lobby
    document.getElementById('create-section').classList.add('hidden');
    document.getElementById('join-section').classList.add('hidden');
    createGameBtn.disabled = false;
    createGameBtn.textContent = "Crear";
    
    // Guardar el estado inicial del juego en la DB
    set(newGameRef, {
        secretWord: word,
        status: 'waiting',
        intentos: {} // Usar objeto vacío para futuros 'push'
    });

    playerRole = 'retador';
    
    const gameURL = `${window.location.origin}${window.location.pathname}#${currentGameID}`;
    
    // Mostrar el código y el enlace
    roomCodeDisplay.textContent = currentGameID;
    gameLinkText.value = gameURL;
    gameCodeDisplay.classList.remove('hidden');

    // --- CORRECCIÓN DE LÓGICA ---
    // El retador AHORA se queda en el lobby, escuchando a que alguien se una.
    const gameStatusRef = ref(db, `games/${currentGameID}/status`);
    gameListener = onValue(gameStatusRef, (snapshot) => {
        if (snapshot.val() === 'active') {
            // ¡Alguien se unió! Ahora iniciamos el juego para el retador.
            iniciarJuego('retador');
        }
    });
}

/**
 * El Retado se une a la partida.
 */
function unirseAPartida() {
    let code = joinCodeInput.value.trim().toUpperCase();
    
    if (code.includes('#')) {
        code = code.split('#')[1].toUpperCase();
    }
    
    if (code.length !== 5) {
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
            // ¡Partida encontrada!
            currentGameID = code;
            playerRole = 'retado';
            secretWord = snapshot.val().secretWord;
            
            // Marcar la partida como activa
            update(gameRef, { status: 'active' });
            window.history.replaceState(null, '', window.location.pathname);
            
            // Iniciar el juego para el retado
            iniciarJuego('retado');
        }
    }).catch((error) => {
        console.error("Error al unirse a la partida:", error);
        showToast("Error de red. Inténtalo de nuevo.");
    });
}

/**
 * Copia el enlace del juego al portapapeles.
 */
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

/**
 * NUEVA FUNCIÓN: Mueve a la pantalla de juego y activa el listener principal
 */
function iniciarJuego(role) {
    playerRole = role;
    
    // 1. Ocultar el lobby y mostrar el tablero de juego
    lobbyContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    isGameActive = true;

    // 2. Habilitar/deshabilitar el input según el rol
    if (playerRole === 'retador') {
        guessInput.disabled = true;
        guessBtn.disabled = true;
        gameMessage.textContent = "¡Se unió el retado! Esperando su intento.";
    } else { // 'retado'
        guessInput.disabled = false;
        guessBtn.disabled = false;
        guessInput.focus();
        gameMessage.textContent = "¡Tu turno! Adivina la palabra.";
    }

    // 3. Apagar el listener de status (si el retador lo tenía)
    if (gameListener) {
        gameListener(); // Llama a la función 'off' (desconectar)
    }

    // 4. Iniciar el listener principal que sincroniza la cuadrícula
    sincronizarJuego();
}

/**
 * Sincroniza la cuadrícula y el estado del juego para ambos jugadores.
 */
function sincronizarJuego() {
    const gameRef = ref(db, `games/${currentGameID}`);
    
    gameListener = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return; // La partida fue borrada
        
        let intentosArray = [];
        if (data.intentos) {
            intentosArray = Object.values(data.intentos);
        }
        
        renderizarGrid(intentosArray); // Renderiza la cuadrícula
            
        // Comprobar estado de victoria/derrota
        if (intentosArray.length > 0) {
            const ultimoIntento = intentosArray[intentosArray.length - 1];
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

/**
 * El Retado envía su intento.
 */
function handleGuess() {
    if (!isGameActive || playerRole !== 'retado') return;
    const guess = guessInput.value.trim().toUpperCase();

    if (guess.length !== 5) {
        showToast("¡Tu intento debe tener 5 letras!");
        applyAnimation(guessInput, 'shake');
        return;
    }

    const cellStates = procesarLogicaIntento(guess, secretWord);
    
    // Usamos el ID del juego y 'push' para añadir a la lista de intentos
    const intentosRef = ref(db, `games/${currentGameID}/intentos`);
    const newIntentRef = push(intentosRef); // Crea una referencia de 'push'
    set(newIntentRef, { // Usa 'set' en esa referencia
        guess: guess,
        states: cellStates
    });

    guessInput.value = "";
}

/**
 * Pinta la cuadrícula basado en los datos de Firebase.
 */
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
            cell.textContent = guess[i];
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
 * Lógica pura de Wordle.
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

/**
 * Termina el juego para todos.
 */
function endGame() {
    isGameActive = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;

    // Apaga el listener de Firebase para no recibir más actualizaciones
    if (gameListener) {
        gameListener(); // Llama a la función 'off' devuelta por onValue
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
