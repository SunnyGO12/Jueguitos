// --- 1. Configuración de Firebase ---

// Importar las funciones necesarias desde los SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, push, set, get, onValue, update } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// Tu configuración de Firebase (usando tu ejemplo)
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
const db = getDatabase(app); // Obtener la instancia de la base de datos
const gamesRef = ref(db, 'games'); // Referencia a la "carpeta" de partidas

// --- 2. Elementos del DOM ---
// Contenedores
const lobbyContainer = document.getElementById('lobby-container');
const gameContainer = document.getElementById('game-container');

// Lobby
const createGameBtn = document.getElementById('create-game-btn');
const secretWordInput = document.getElementById('secret-word-input');
const joinGameBtn = document.getElementById('join-game-btn');
const joinCodeInput = document.getElementById('join-code-input');
const gameCodeDisplay = document.getElementById('game-code-display');
const gameCodeText = document.getElementById('game-code-text');
const copyCodeBtn = document.getElementById('copy-code-btn'); // Botón de copiar

// Juego
const gameGrid = document.getElementById('game-grid');
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');
const gameMessage = document.getElementById('game-message');
const resetBtn = document.getElementById('reset-btn');

// Modo Oscuro y Toasts
const darkModeToggle = document.getElementById('dark-mode-toggle');
const toastContainer = document.getElementById('toast-container');

// --- 3. Variables de Estado Global ---
let currentGameID = null; // El código de la partida actual
let playerRole = null; // 'retador' o 'retado'
let secretWord = null; // Solo la conocerá el retado (para comprobar)
let isGameActive = false;

// --- 4. Event Listeners ---
createGameBtn.addEventListener('click', crearPartida);
joinGameBtn.addEventListener('click', unirseAPartida);
copyCodeBtn.addEventListener('click', copiarCodigo); // Listener para copiar
guessBtn.addEventListener('click', handleGuess);
guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGuess();
});

document.addEventListener('DOMContentLoaded', () => {
    // Listener de Modo Oscuro
    if (localStorage.getItem('dark-mode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }

    // Comprobar si la URL tiene un código de juego al cargar
    if (window.location.hash) {
        // window.location.hash devuelve "#-NqX..."
        const gameCodeFromURL = window.location.hash.substring(1); // Quita el '#'
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
 * El Retador crea la partida.
 * Escribe la palabra secreta en la base de datos.
 */
function crearPartida() {
    const word = secretWordInput.value.trim().toUpperCase();

    // Validar la palabra
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

    // Ocultar botones de lobby para mostrar el código
    document.getElementById('create-section').classList.add('hidden');
    document.getElementById('join-section').classList.add('hidden');

    // Crear un nuevo ID de juego en Firebase
    const newGameRef = push(gamesRef); // Crea una referencia única
    currentGameID = newGameRef.key; // Este es el ID único
    
    // Guardar el estado inicial del juego en la DB
    set(newGameRef, {
        secretWord: word,
        status: 'waiting', // Esperando al retado
        intentos: []
    });

    playerRole = 'retador';
    
    // Genera la URL completa en lugar de solo el código
    const gameURL = `${window.location.origin}${window.location.pathname}#${currentGameID}`;
    gameCodeText.value = gameURL; // Pone la URL en el input
    
    gameCodeDisplay.classList.remove('hidden');

    // Empezar a "escuchar" la partida para saber cuándo se une el retado
    escucharCambiosDelJuego();
}

/**
 * El Retado se une a la partida.
 * Comprueba si el código de la partida es válido.
 */
function unirseAPartida() {
    // El usuario puede pegar la URL completa o solo el código
    let code = joinCodeInput.value.trim();
    
    // Si pegaron la URL completa, extraemos solo el código (lo que está después del #)
    if (code.includes('#')) {
        code = code.split('#')[1];
    }
    
    if (!code) {
        showToast("Escribe un código de partida.");
        applyAnimation(joinCodeInput, 'shake');
        return;
    }

    const gameRef = ref(db, `games/${code}`);

    // Comprobar si la partida existe
    get(gameRef).then((snapshot) => {
        if (!snapshot.exists()) {
            showToast("No se encontró esa partida. Revisa el código.");
            applyAnimation(joinCodeInput, 'shake');
        } else {
            // ¡Partida encontrada!
            currentGameID = code;
            playerRole = 'retado';
            secretWord = snapshot.val().secretWord; // El retado obtiene la palabra secreta
            
            // Marcar la partida como activa
            update(gameRef, { status: 'active' });

            // Limpia la URL (quita el #)
            window.history.replaceState(null, '', window.location.pathname);

            // Empezar a "escuchar" la partida
            escucharCambiosDelJuego();
        }
    }).catch((error) => {
        console.error("Error al unirse a la partida:", error);
        showToast("Error de red. Inténtalo de nuevo.");
    });
}

/**
 * Copia el enlace del juego al portapapeles.
 */
function copiarCodigo() {
    // Selecciona el texto dentro del input
    gameCodeText.select();
    gameCodeText.setSelectionRange(0, 99999); // Para móviles

    // Usa la API del portapapeles
    navigator.clipboard.writeText(gameCodeText.value).then(() => {
        // Éxito
        showToast("¡Enlace copiado al portapapeles!", 'success');
    }).catch(err => {
        // Error
        showToast("No se pudo copiar el enlace.");
        console.error('Error al copiar:', err);
    });
}

/**
 * Se activa cuando el juego empieza (para ambos jugadores).
 * Es el "sincronizador" principal.
 */
function escucharCambiosDelJuego() {
    // Ocultar el lobby y mostrar el tablero de juego
    lobbyContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    isGameActive = true;

    // Habilitar/deshabilitar el input según el rol
    if (playerRole === 'retador') {
        guessInput.disabled = true;
        guessBtn.disabled = true;
        gameMessage.textContent = "Esperando el intento del retado...";
    } else {
        guessInput.disabled = false;
        guessBtn.disabled = false;
        guessInput.focus();
        gameMessage.textContent = "¡Tu turno! Adivina la palabra.";
    }

    const gameRef = ref(db, `games/${currentGameID}`);
    
    // onValue() es el listener que se dispara CADA VEZ que algo cambia en la DB
    onValue(gameRef, (snapshot) => {
        const data = snapshot.val();

        if (!data) return; // La partida fue borrada

        // Sincronizar el estado del juego
        if (data.status === 'active' && playerRole === 'retador') {
             gameMessage.textContent = "¡Se unió el retado! Esperando su intento.";
        }
        
        // Renderizar todos los intentos
        if (data.intentos) {
            // Convertir el objeto de Firebase en un array
            const intentosArray = Object.values(data.intentos);
            renderizarGrid(intentosArray);
            
            // Comprobar estado de victoria/derrota
            const ultimoIntento = intentosArray[intentosArray.length - 1];
            if (ultimoIntento && ultimoIntento.guess === secretWord) {
                gameMessage.textContent = "¡El retado ha ganado!";
                if (playerRole === 'retado') {
                    triggerVictoryAnimation(intentosArray.length - 1);
                }
                endGame();
            } else if (intentosArray.length === 5) {
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

    // El "retado" tiene la palabra secreta y hace la comprobación
    const cellStates = procesarLogicaIntento(guess, secretWord);

    // Escribir el resultado en la base de datos
    const intentosRef = ref(db, `games/${currentGameID}/intentos`);
    push(intentosRef, { // 'push' con datos crea un nuevo hijo con esos datos
        guess: guess,
        states: cellStates
    });

    guessInput.value = "";
}

/**
 * Pinta la cuadrícula basado en los datos de Firebase.
 */
function renderizarGrid(intentos) {
    // 1. Limpiar la cuadrícula
    for (let i = 0; i < 5; i++) {
        const row = gameGrid.children[i];
        for (let j = 0; j < 5; j++) {
            const cell = row.children[j];
            cell.textContent = "";
            cell.className = "grid-cell"; // Resetea clases
        }
    }
    
    // 2. Volver a pintar cada intento
    intentos.forEach((intento, rowIndex) => {
        const row = gameGrid.children[rowIndex];
        const guess = intento.guess;
        const states = intento.states;
        
        for (let i = 0; i < 5; i++) {
            const cell = row.children[i];
            cell.textContent = guess[i];
            cell.classList.add(`cell-${states[i]}`);
            
            // Añadir animación de volteo solo si es el intento más reciente
            if (rowIndex === intentos.length - 1 && !cell.classList.contains('cell-reveal')) {
                 setTimeout(() => {
                    cell.classList.add('cell-reveal');
                 }, i * 300);
            } else {
                // Dejarlas ya volteadas si son intentos antiguos
                cell.classList.add('cell-reveal'); 
            }
        }
    });
}

/**
 * Lógica pura de Wordle. No toca el DOM, solo devuelve los estados.
 */
function procesarLogicaIntento(guess, secret) {
    const secretWordMap = {};
    for (const letter of secret) {
        secretWordMap[letter] = (secretWordMap[letter] || 0) + 1;
    }

    const cellStates = Array(5).fill('absent');

    // 1er Pase: "Correctas" (Verdes)
    for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        if (letter === secret[i]) {
            cellStates[i] = 'correct';
            secretWordMap[letter]--;
        }
    }

    // 2do Pase: "Presentes" (Amarillas)
    for (let i = 0; i < 5; i++) {
        if (cellStates[i] === 'correct') continue;
        const letter = guess[i];
        if (secret.includes(letter) && secretWordMap[letter] > 0) {
            cellStates[i] = 'present';
            secretWordMap[letter]--;
        }
    }
    return cellStates; // Devuelve ['correct', 'absent', 'present', ...]
}

/**
 * Termina el juego para todos.
 */
function endGame() {
    isGameActive = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;
    
    // El botón de reset ahora solo recarga la página para volver al lobby
    resetBtn.classList.remove('hidden');
    resetBtn.textContent = "Volver al Lobby";
    // Usamos 'once: true' para evitar listeners duplicados si endGame se llama varias veces
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
        element.classList.remove(animationClass); // Bug corregido aquí
    }, { once: true });
}
