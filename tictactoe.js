// --- 1. Configuración de Firebase ---
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
const tictactoeCreateBtn = document.getElementById('tictactoe-create-btn');
const tictactoeJoinBtn = document.getElementById('tictactoe-join-btn');
const tictactoeJoinInput = document.getElementById('tictactoe-join-input');
const tictactoeCodeDisplay = document.getElementById('tictactoe-code-display');
const tictactoeGameContainer = document.getElementById('tictactoe-game-container');
const tictactoeBoard = document.getElementById('tictactoe-board');
const tictactoeStatus = document.getElementById('tictactoe-status');
const tictactoeResetBtn = document.getElementById('tictactoe-reset-btn');
const tictactoeLobbyContainer = document.getElementById('tictactoe-lobby-container');

const darkModeToggle = document.getElementById('dark-mode-toggle');
const toastContainer = document.getElementById('toast-container');

// --- 3. Variables de Estado Global ---
let currentGameID = null;
let playerRole = null;
let isGameActive = false;
let gameListener = null; 
let statusListener = null; 

// --- 4. Event Listeners ---
tictactoeCreateBtn.addEventListener('click', crearPartidaTicTacToe);
tictactoeJoinBtn.addEventListener('click', unirseAPartidaTicTacToe);
tictactoeBoard.addEventListener('click', handleTicTacToeClick);
tictactoeResetBtn.addEventListener('click', handleResetClick); 

// --- FUNCIÓN DE ACTIVACIÓN DE MENÚ ---
function setActiveMenu() {
    const currentPage = window.location.pathname.split('/').pop();
    
    document.querySelectorAll('.dashboard-menu a').forEach(link => {
        link.classList.remove('active');
        const linkUrl = link.getAttribute('href');
        
        if (linkUrl === currentPage) {
            link.classList.add('active');
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setActiveMenu(); // MARCAR EL MENÚ ACTIVO

    // Inicializar Dark Mode
    if (localStorage.getItem('dark-mode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }
    // Lógica para unirse a través de URL hash (si existe)
    if (window.location.hash) {
        const gameCodeFromURL = window.location.hash.substring(1).toUpperCase();
        tictactoeJoinInput.value = gameCodeFromURL;
        showToast("Código de partida cargado desde el enlace.", 'success');
    }
});

darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('dark-mode', isDarkMode);
    darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
});


// --- LÓGICA GENERAL/UTILIDAD ---

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

// --- LÓGICA TIC-TAC-TOE (MOVIMIENTO) ---

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
    
    // Ocultar secciones de Crear/Unir
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
    resetGameListeners();
    
    gameListener = onValue(ref(db, `games/${currentGameID}`), (snapshot) => {
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
