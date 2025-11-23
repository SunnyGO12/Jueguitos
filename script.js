// --- 1. Configuración de Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
// Importamos 'get' y 'update' para la lógica de validación (Mejora 4)
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

// --- 2. Elementos del DOM (Actualizado para las Mejoras) ---
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

// MEJORA 1: Elementos del retador
const secretWordDisplay = document.getElementById('secret-word-display');
const retadorInfo = document.getElementById('retador-info');
// MEJORA 2: Elemento del teclado
const keyboardContainer = document.getElementById('keyboard-container');

// --- 3. Variables de Estado Global ---
let currentGameID = null;
let playerRole = null;
let secretWord = null; 
let isGameActive = false;
let gameListener = null; // Listener del juego activo
let statusListener = null; // Listener de estado del lobby (para el Retador)

// --- 4. Event Listeners (Actualizado para las Mejoras) ---
createGameBtn.addEventListener('click', crearPartida);
joinGameBtn.addEventListener('click', unirseAPartida);
copyLinkBtn.addEventListener('click', copiarEnlace);
guessBtn.addEventListener('click', handleGuess);

// Permitir 'Enter' en el input de adivinanza
guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGuess();
});

// MEJORA 2: Listener para el teclado en pantalla
if (keyboardContainer) {
    keyboardContainer.addEventListener('click', (e) => {
        const key = e.target.getAttribute('data-key');
        const action = e.target.getAttribute('data-action');
        
        if (!isGameActive || playerRole !== 'retado') return;

        if (key) {
            // Escribe la letra (convertir a mayúscula para el input, pero la lógica interna usa minúscula)
            guessInput.value += key.toUpperCase();
        } else if (action === 'enter') {
            handleGuess();
        } else if (action === 'del') {
            // Borrar el último carácter
            guessInput.value = guessInput.value.slice(0, -1);
        }
        
        // Asegurarse de que solo haya 5 caracteres en el input
        guessInput.value = guessInput.value.slice(0, 5);
        
        // Enfocar el input para una posible entrada de teclado física posterior
        guessInput.focus(); 
    });
}

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
    const word = secretWordInput.value.trim().toLowerCase();

    // Validación de 5 letras
    if (word.length !== 5) {
        showToast("¡La palabra debe tener exactamente 5 letras!");
        applyAnimation(secretWordInput, 'shake');
        return;
    }
    // Validación de solo letras
    if (!/^[a-zñ]+$/.test(word)) {
        showToast("¡La palabra solo debe contener letras!");
        applyAnimation(secretWordInput, 'shake');
        return;
    }
    
    // Validación de Diccionario
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
        secretWord: word, 
        status: 'waiting',
        intentos: {}
    });

    playerRole = 'retador';
    secretWord = word;
    
    const gameURL = `${window.location.origin}${window.location.pathname}#${currentGameID}`;
    
    roomCodeDisplay.textContent = currentGameID;
    gameLinkText.value = gameURL;
    gameCodeDisplay.classList.remove('hidden');

    // El retador se queda en el lobby, escuchando a que alguien se una.
    const gameStatusRef = ref(db, `games/${currentGameID}/status`);
    // Usamos statusListener para poder desconectarlo después (Mejora 5)
    statusListener = onValue(gameStatusRef, (snapshot) => {
        if (snapshot.val() === 'active') {
            iniciarJuego('retador');
        }
    });
}

function unirseAPartida() {
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
            secretWord = snapshot.val().secretWord; 
            
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

// MEJORA 1: Lógica para mostrar info al retador
function iniciarJuego(role) {
    playerRole = role;
    
    lobbyContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    isGameActive = true;

    if (playerRole === 'retador') {
        guessInput.disabled = true;
        guessBtn.disabled = true;
        gameMessage.textContent = "¡Se unió el retado! Esperando su intento.";
        
        // Mostrar la palabra secreta
        retadorInfo.classList.remove('hidden');
        secretWordDisplay.textContent = secretWord.toUpperCase();
        
    } else {
        guessInput.disabled = false;
        guessBtn.disabled = false;
        guessInput.focus();
        gameMessage.textContent = "¡Tu turno! Adivina la palabra.";
        retadorInfo.classList.add('hidden');
    }

    // MEJORA 5: Desconecta el listener de status del lobby si estaba activo
    if (statusListener) {
        statusListener(); 
        statusListener = null; 
    }

    sincronizarJuego();
}

// MEJORA 3: Lógica para actualizar los colores del teclado
function actualizarTeclado(intentos) {
    const letterStatus = {}; // { 'A': 'correct', 'B': 'present', 'C': 'absent' }
    
    // Iterar sobre todos los intentos para encontrar el estado MÁS alto de cada letra
    intentos.forEach(intento => {
        const guess = intento.guess;
        const states = intento.states;
        
        for (let i = 0; i < 5; i++) {
            const letter = guess[i].toUpperCase();
            const state = states[i];
            
            // Prioridad: 'correct' > 'present' > 'absent'
            if (state === 'correct') {
                letterStatus[letter] = 'correct';
            } else if (state === 'present' && letterStatus[letter] !== 'correct') {
                letterStatus[letter] = 'present';
            } else if (!letterStatus[letter] && state === 'absent') { 
                 letterStatus[letter] = 'absent';
            }
        }
    });
    
    // Aplicar los estilos
    document.querySelectorAll('#keyboard-container button').forEach(button => {
        const key = button.getAttribute('data-key')?.toUpperCase();
        if (key && letterStatus[key]) {
            // Limpia las clases de color existentes
            button.classList.remove('keyboard-correct', 'keyboard-present', 'keyboard-absent'); 
            button.classList.add(`keyboard-${letterStatus[key]}`);
        }
    });
}

function sincronizarJuego() {
    const gameRef = ref(db, `games/${currentGameID}`);
    
    // Si ya existe un listener del juego, lo desconectamos para evitar duplicados (Mejora 5)
    if (gameListener) {
        gameListener();
    }
    
    gameListener = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        let intentosArray = [];
        if (data.intentos) {
            intentosArray = Object.values(data.intentos);
        }
        
        renderizarGrid(intentosArray);
        actualizarTeclado(intentosArray); // MEJORA 3
            
        if (intentosArray.length > 0) {
            const ultimoIntento = intentosArray[intentosArray.length - 1];
            
            if (ultimoIntento.guess === secretWord) {
                gameMessage.textContent = `¡El retado ha ganado! La palabra era ${secretWord.toUpperCase()}.`;
                if (playerRole === 'retado') {
                    triggerVictoryAnimation(intentosArray.length - 1);
                }
                endGame();
            } else if (intentosArray.length === 5) {
                gameMessage.textContent = `¡El retado ha perdido! La palabra era ${secretWord.toUpperCase()}.`;
                endGame();
            }
        }
    });
}

// MEJORA 4: Lógica de validación de intento refactorizada
async function handleGuess() {
    if (!isGameActive || playerRole !== 'retado') return;
    
    const guess = guessInput.value.trim().toLowerCase();
    
    // 1. Obtener el estado actual para saber en qué fila estamos
    const gameRef = ref(db, `games/${currentGameID}`);
    const snapshot = await get(gameRef);
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
    
    // 2. Validación de Diccionario
    if (!DICCIONARIO.has(guess)) {
        showToast("Esa palabra no está en el diccionario.");
        // Aplicar animación de shake a la fila de la cuadrícula
        applyAnimation(currentRowElement, 'shake'); 
        return;
    }

    // 3. Procesar y Guardar el intento
    const cellStates = procesarLogicaIntento(guess, secretWord);
    
    const intentosRef = ref(db, `games/${currentGameID}/intentos`);
    const newIntentRef = push(intentosRef);
    set(newIntentRef, {
        guess: guess, 
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
            cell.textContent = guess[i].toUpperCase(); 
            cell.classList.add(`cell-${states[i]}`);
            
            // Añadir animación de volteo
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
 * Lógica pura de Wordle (todo en minúsculas)
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

// MEJORA 5: Desconexión explícita de listeners
function endGame() {
    isGameActive = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;

    // Desconecta el listener de la partida
    if (gameListener) {
        gameListener(); 
        gameListener = null;
    }
    
    resetBtn.classList.remove('hidden');
    resetBtn.textContent = "Volver al Lobby";
    // Asegurarse de que el listener de recarga se desconecte si se llama a endGame
    resetBtn.removeEventListener('click', handleResetClick); 
    resetBtn.addEventListener('click', handleResetClick, { once: true });
}

function handleResetClick() {
    // Asegurarse de que no haya listeners activos antes de la recarga
    if (gameListener) {
        gameListener();
    }
    if (statusListener) {
        statusListener();
    }
    window.location.reload();
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
