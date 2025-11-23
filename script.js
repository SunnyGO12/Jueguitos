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
// Gestión de juegos
const dashboardMenu = document.querySelector('.dashboard-menu');
const gameContentWrapper = document.getElementById('game-content-wrapper');

// Wordle
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
const secretWordDisplay = document.getElementById('secret-word-display');
const retadorInfo = document.getElementById('retador-info');
const keyboardContainer = document.getElementById('keyboard-container');

// Wordle Lobby Sections (NUEVOS DOM Elements para control fino)
const createSectionWordle = document.getElementById('create-section');
const joinSectionWordle = document.getElementById('join-section');

// Tic-Tac-Toe
const tictactoeLobbyContainer = document.getElementById('tictactoe-lobby-container'); // Nuevo: Usar el contenedor del lobby
const tictactoeCreateBtn = document.getElementById('tictactoe-create-btn');
const tictactoeJoinBtn = document.getElementById('tictactoe-join-btn');
const tictactoeJoinInput = document.getElementById('tictactoe-join-input');
const tictactoeCodeDisplay = document.getElementById('tictactoe-code-display');
const tictactoeGameContainer = document.getElementById('tictactoe-game-container');
const tictactoeBoard = document.getElementById('tictactoe-board');
const tictactoeStatus = document.getElementById('tictactoe-status');
const tictactoeResetBtn = document.getElementById('tictactoe-reset-btn');

const darkModeToggle = document.getElementById('dark-mode-toggle');
const toastContainer = document.getElementById('toast-container');

// --- 3. Variables de Estado Global ---
let currentGameID = null;
let playerRole = null;
let secretWord = null; 
let isGameActive = false;
let gameListener = null; // Listener de la partida activa
let statusListener = null; // Listener de estado del lobby
let currentActiveGame = 'wordle'; // El juego que se está mostrando

// --- 4. Event Listeners ---
// Gestión de juegos
dashboardMenu.addEventListener('click', handleMenuClick);

// Wordle
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

// Tic-Tac-Toe
tictactoeCreateBtn.addEventListener('click', crearPartidaTicTacToe);
tictactoeJoinBtn.addEventListener('click', unirseAPartidaTicTacToe);
tictactoeBoard.addEventListener('click', handleTicTacToeClick);
tictactoeResetBtn.addEventListener('click', handleResetClick); // Usar la función global de reset

// Configuración inicial
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('dark-mode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }
    // Inicializar el dashboard en Wordle
    handleMenuClick(null, 'wordle'); 

    // Lógica para unirse a través de URL hash (asumiendo Wordle por defecto si no se especifica)
    if (window.location.hash) {
        const gameCodeFromURL = window.location.hash.substring(1).toUpperCase();
        // Por simplicidad, solo pre-rellenamos el input de Wordle
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


// --- GESTIÓN DE JUEGOS ---

function handleMenuClick(event, gameIdOverride) {
    if (event) {
        event.preventDefault();
        const target = event.target.closest('a');
        if (!target) return;
        currentActiveGame = target.getAttribute('data-game');
    } else if (gameIdOverride) {
        currentActiveGame = gameIdOverride;
    }

    // Ocultar todos los contenedores de juego
    document.querySelectorAll('[data-game]').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active-game');
    });

    // Mostrar solo el contenedor del juego activo
    const activeGameArea = document.getElementById(`${currentActiveGame}-game-area`);
    if (activeGameArea) {
        activeGameArea.classList.remove('hidden');
        activeGameArea.classList.add('active-game');
    }

    // Actualizar el estilo "active" en el menú
    document.querySelectorAll('.dashboard-menu a').forEach(a => {
        a.classList.remove('active');
        if (a.getAttribute('data-game') === currentActiveGame) {
            a.classList.add('active');
        }
    });

    // Limpiar estado y desconectar listeners al cambiar de juego
    resetGameListeners();
    currentGameID = null;
    isGameActive = false;
    playerRole = null;
    
    // **CORRECCIÓN CLAVE:** Asegurar que los lobbies muestren los controles iniciales
    if (currentActiveGame === 'wordle') {
        lobbyContainer.classList.remove('hidden');
        gameContainer.classList.add('hidden');
        createSectionWordle.classList.remove('hidden');
        joinSectionWordle.classList.remove('hidden');
        gameCodeDisplay.classList.add('hidden');
    } else if (currentActiveGame === 'tictactoe') {
        tictactoeLobbyContainer.classList.remove('hidden');
        tictactoeGameContainer.classList.add('hidden');
        // Asegurar que los botones de crear/unir sean visibles
        tictactoeCodeDisplay.classList.add('hidden'); 
        document.querySelectorAll('#tictactoe-lobby-container .lobby-section').forEach(el => el.classList.remove('hidden'));
    }
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

    // Ocultar solo las secciones de crear/unir
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

// ... (handleKeyboardClick, procesarLogicaIntentoWordle, triggerVictoryAnimationWordle, endGameWordle)

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

// --- LÓGICA TIC-TAC-TOE ---

async function crearPartidaTicTacToe() {
    tictactoeCreateBtn.disabled = true;
    tictactoeCreateBtn.textContent = "Creando...";
    resetGameListeners();

    currentGameID = await generarCodigoUnico();
    const newGameRef = ref(db, `games/${currentGameID}`);

    set(newGameRef, {
        gameType: 'tictactoe',
        status: 'waiting',
        playerX: 'creator', 
        playerO: null,
        board: [["", "", ""], ["", "", ""], ["", "", ""]],
        currentTurn: 'X',
        winner: null
    });

    playerRole = 'X';
    
    tictactoeCreateBtn.disabled = false;
    tictactoeCreateBtn.textContent = "Crear Partida de X";
    
    // **CORRECCIÓN DE UI:** Ocultar secciones de Crear/Unir
    document.querySelectorAll('#tictactoe-lobby-container .lobby-section').forEach(el => el.classList.add('hidden'));
    
    tictactoeCodeDisplay.classList.remove('hidden');
    document.querySelector('.tictactoe-code').textContent = currentGameID;
    tictactoeStatus.textContent = "Esperando a que el jugador 'O' se una...";

    const gameStatusRef = ref(db, `games/${currentGameID}/status`);
    statusListener = onValue(gameStatusRef, (snapshot) => {
        if (snapshot.val() === 'active') {
            iniciarTicTacToe('X');
        }
    });
}

function unirseAPartidaTicTacToe() {
    const code = tictactoeJoinInput.value.trim().toUpperCase();
    
    if (code.length !== 5) {
        showToast("El código debe tener 5 letras.");
        applyAnimation(tictactoeJoinInput, 'shake');
        return;
    }

    const gameRef = ref(db, `games/${code}`);

    get(gameRef).then((snapshot) => {
        const data = snapshot.val();
        if (!snapshot.exists() || data.gameType !== 'tictactoe') {
            showToast("No se encontró esa partida de Tic-Tac-Toe.");
        } else if (data.status === 'active') {
            showToast("Esta partida ya está en progreso.");
        } else {
            currentGameID = code;
            playerRole = 'O'; 
            
            update(gameRef, { status: 'active', playerO: 'joiner' });
            
            iniciarTicTacToe('O');
        }
    });
}

function iniciarTicTacToe(role) {
    playerRole = role;
    
    tictactoeLobbyContainer.classList.add('hidden');
    tictactoeGameContainer.classList.remove('hidden');
    isGameActive = true;

    if (statusListener) {
        statusListener(); 
        statusListener = null;
    }

    sincronizarTicTacToe();
}

function sincronizarTicTacToe() {
    const gameRef = ref(db, `games/${currentGameID}`);
    
    resetGameListeners();
    
    gameListener = onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        renderTicTacToeBoard(data.board);
        
        if (data.winner) {
            tictactoeStatus.textContent = data.winner === 'Draw' ? "¡Empate!" : `¡Ganó el jugador ${data.winner}!`;
            endTicTacToe();
        } else {
            const isMyTurn = data.currentTurn === playerRole;
            tictactoeStatus.textContent = isMyTurn ? `¡Tu Turno! Eres ${playerRole}` : `Turno del oponente (${data.currentTurn})`;
        }
    });
}

function renderTicTacToeBoard(board) {
    tictactoeBoard.querySelectorAll('.tictactoe-cell').forEach(cell => {
        const row = parseInt(cell.getAttribute('data-row'));
        const col = parseInt(cell.getAttribute('data-col'));
        const value = board[row][col];
        
        cell.textContent = value;
        cell.className = 'tictactoe-cell'; 
        if (value) {
            cell.classList.add(value); 
        }
    });
}

function handleTicTacToeClick(e) {
    const cell = e.target.closest('.tictactoe-cell');
    if (!cell || !isGameActive) return;

    const row = parseInt(cell.getAttribute('data-row'));
    const col = parseInt(cell.getAttribute('data-col'));
    
    const gameRef = ref(db, `games/${currentGameID}`);
    get(gameRef).then(snapshot => {
        const data = snapshot.val();
        
        if (data.winner) {
            showToast("El juego ha terminado.");
            return;
        }

        if (data.currentTurn !== playerRole) {
            showToast("¡No es tu turno!");
            return;
        }

        if (data.board[row][col] !== "") {
            showToast("Esa celda ya está ocupada.");
            return;
        }

        let newBoard = [...data.board.map(r => [...r])]; 
        newBoard[row][col] = playerRole;
        
        const winner = checkWinner(newBoard);
        const nextTurn = playerRole === 'X' ? 'O' : 'X';
        
        update(gameRef, {
            board: newBoard,
            currentTurn: winner ? data.currentTurn : nextTurn, 
            winner: winner
        });
    });
}

function checkWinner(board) {
    const lines = [
        [board[0][0], board[0][1], board[0][2]],
        [board[1][0], board[1][1], board[1][2]],
        [board[2][0], board[2][1], board[2][2]],
        [board[0][0], board[1][0], board[2][0]],
        [board[0][1], board[1][1], board[2][1]],
        [board[0][2], board[1][2], board[2][2]],
        [board[0][0], board[1][1], board[2][2]],
        [board[0][2], board[1][1], board[2][0]],
    ];

    for (const line of lines) {
        if (line.every(cell => cell === 'X')) return 'X';
        if (line.every(cell => cell === 'O')) return 'O';
    }

    if (board.flat().every(cell => cell !== "")) {
        return 'Draw';
    }

    return null;
}

function endTicTacToe() {
    isGameActive = false;
    resetGameListeners();

    tictactoeResetBtn.classList.remove('hidden');
    tictactoeResetBtn.textContent = "Volver a jugar";
    tictactoeResetBtn.removeEventListener('click', handleResetClick); 
    tictactoeResetBtn.addEventListener('click', handleResetClick, { once: true });
}

// --- FUNCIONES DE UTILIDAD ---

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
