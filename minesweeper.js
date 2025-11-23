// --- 1. Configuración de Firebase ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. Elementos del DOM ---
const minesweeperCreateBtn = document.getElementById('minesweeper-create-btn');
const minesweeperJoinBtn = document.getElementById('minesweeper-join-btn');
const minesweeperJoinInput = document.getElementById('minesweeper-join-input');
const minesweeperCodeDisplay = document.getElementById('minesweeper-code-display');
const minesweeperGameContainer = document.getElementById('minesweeper-game-container');
const minesweeperLobbyContainer = document.getElementById('minesweeper-lobby-container');
const minesweeperGrid = document.getElementById('minesweeper-grid');
const minesweeperStatus = document.getElementById('minesweeper-status');
const minesweeperResetBtn = document.getElementById('minesweeper-reset-btn');

const playerScoreDisplay = document.getElementById('player-score');
const opponentScoreDisplay = document.getElementById('opponent-score');
const minesRemainingDisplay = document.getElementById('mines-remaining');

const darkModeToggle = document.getElementById('dark-mode-toggle');
const toastContainer = document.getElementById('toast-container');

// --- 3. Variables de Estado Global ---
let currentGameID = null;
let playerRole = null; // 'P1' (creador) o 'P2' (retado)
let isGameActive = false;
let gameListener = null; 
let statusListener = null; 

// Configuraciones del Juego
const GRID_SIZE = 8;
const NUM_MINES = 10;
const P_CREATOR = 'P1';
const P_JOINER = 'P2';

// Estado local del tablero (para la lógica de revelación)
let localBoard = null; // Matriz 2D real (minas y números)
let localRevealedState = {}; // Objeto de celdas clave (e.g., '0_0': 'P1_R')


// --- 4. Funciones de Lógica de Juego (ADAPTADAS A 2D LOCAL) ---

// Función auxiliar para obtener la clave de Firebase
const getCellKey = (r, c) => `${r}_${c}`;

/**
 * Genera el tablero de minas y números (2D Array)
 */
function generateBoardData(size, mines, startR, startC) {
    let board = Array(size).fill(0).map(() => Array(size).fill(0));
    let placedMines = 0;

    while (placedMines < mines) {
        let row = Math.floor(Math.random() * size);
        let col = Math.floor(Math.random() * size);
        
        if (Math.abs(row - startR) <= 1 && Math.abs(col - startC) <= 1) {
            continue;
        }
        
        if (board[row][col] !== -1) {
            board[row][col] = -1;
            placedMines++;
        }
    }

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board[r][c] === -1) continue;
            let count = 0;
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const nr = r + i;
                    const nc = c + j;
                    if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc] === -1) {
                        count++;
                    }
                }
            }
            board[r][c] = count;
        }
    }
    return board;
}

/**
 * Revelación en Cascada (Trabaja sobre el estado local: localBoard y localRevealedState)
 */
function checkAndRevealAdjacent(r, c, player) {
    const key = getCellKey(r, c);
    
    // Si fuera de límites, revelada, o marcada con bandera, salimos.
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE || localRevealedState[key]?.includes('_R') || localRevealedState[key]?.includes('_F')) {
        return;
    }
    // Si es una mina, salimos (la mina se maneja en revealCell)
    if (localBoard[r][c] === -1) {
        return;
    }

    // Revelar la celda actual
    localRevealedState[key] = `${player}_R`;
    let points = 1; // 1 punto por celda revelada
    
    // Si es un número (> 0), paramos la cascada y sumamos los puntos del número.
    if (localBoard[r][c] > 0) {
        return points;
    }

    // Si es 0, llamamos recursivamente
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue; 
            
            // Recorre y acumula los puntos de las revelaciones en cascada
            checkAndRevealAdjacent(r + dr, c + dc, player);
        }
    }
    return points;
}


// --- 5. Funciones Principales (Firebase) ---

function generarCodigo(longitud) {
    // ... (función generarCodigo se mantiene)
    let codigo = '';
    const CARACTERES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < longitud; i++) {
        codigo += CARACTERES.charAt(Math.floor(Math.random() * CARACTERES.length));
    }
    return codigo;
}

async function generarCodigoUnico() {
    // ... (función generarCodigoUnico se mantiene)
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
    if (gameListener) { gameListener(); gameListener = null; }
    if (statusListener) { statusListener(); statusListener = null; }
}

function handleResetClick() {
    resetGameListeners();
    window.location.reload(); 
}

async function crearPartidaMinesweeper() {
    minesweeperCreateBtn.disabled = true;
    minesweeperCreateBtn.textContent = "Creando...";
    resetGameListeners();

    currentGameID = await generarCodigoUnico();
    const newGameRef = ref(db, `games/${currentGameID}`);
    
    // Al inicio, el tablero es null, el estado revelado es vacío.
    set(newGameRef, {
        gameType: 'minesweeper',
        status: 'waiting',
        player1: P_CREATOR, 
        player2: null,
        boardConfig: null, 
        revealed: {}, // Objeto vacío, no array problemático
        scoreP1: 0, scoreP2: 0, totalMines: NUM_MINES, remainingMines: NUM_MINES, winner: null
    });

    playerRole = P_CREATOR;
    
    minesweeperCreateBtn.disabled = false;
    minesweeperCreateBtn.textContent = "Crear Partida";
    
    document.querySelectorAll('#minesweeper-lobby-container .lobby-section').forEach(el => el.classList.add('hidden'));
    minesweeperCodeDisplay.classList.remove('hidden');
    document.querySelector('.minesweeper-code').textContent = currentGameID;
    minesweeperStatus.textContent = "Esperando a que el jugador 2 se una...";

    const gameStatusRef = ref(db, `games/${currentGameID}/status`);
    statusListener = onValue(gameStatusRef, (snapshot) => {
        if (snapshot.val() === 'active') {
            iniciarJuegoMinesweeper(P_CREATOR);
        }
    });
}

function unirseAPartidaMinesweeper() {
    const code = minesweeperJoinInput.value.trim().toUpperCase();
    if (code.length !== 5) {
        showToast("El código debe tener 5 letras.");
        applyAnimation(minesweeperJoinInput, 'shake');
        return;
    }

    const gameRef = ref(db, `games/${code}`);
    get(gameRef).then((snapshot) => {
        const data = snapshot.val();
        if (!snapshot.exists() || data.gameType !== 'minesweeper') {
            showToast("No se encontró esa partida de Buscaminas.");
        } else if (data.status === 'active') {
            showToast("Esta partida ya está en progreso.");
        } else {
            currentGameID = code;
            playerRole = P_JOINER; 
            update(gameRef, { status: 'active', player2: P_JOINER });
            iniciarJuegoMinesweeper(P_JOINER);
        }
    });
}


function iniciarJuegoMinesweeper(role) {
    playerRole = role;
    
    minesweeperLobbyContainer.classList.add('hidden');
    minesweeperGameContainer.classList.remove('hidden');
    isGameActive = true; 

    if (statusListener) { statusListener(); statusListener = null; }
    
    initializeGridDisplay(); 
    sincronizarMinesweeper();
}

function sincronizarMinesweeper() {
    resetGameListeners();
    
    gameListener = onValue(ref(db, `games/${currentGameID}`), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        // Cargar el estado local del tablero (o nulo)
        localRevealedState = data.revealed || {};

        if (data.boardConfig) {
            // El tablero existe: Deserializar y actualizar estado local
            localBoard = JSON.parse(data.boardConfig);
            minesweeperStatus.textContent = "¡A jugar! Clica para revelar celdas.";
        } else {
            // El tablero NO existe: Esperar el primer clic
            localBoard = null;
            minesweeperStatus.textContent = "Esperando el primer clic de un jugador...";
        }

        renderMinesweeperGrid(localRevealedState, localBoard);
        updateScoreboard(data);

        // Lógica de fin de juego (Simplificada)
        if (data.winner) {
            const opponentRole = data.winner === P_CREATOR ? P_JOINER : P_CREATOR;
            minesweeperStatus.textContent = data.winner === playerRole ? "¡Has Ganado!" : `¡Has Perdido! (Ganó ${data.winner})`;
            endGameMinesweeper();
        }
    });
}

function updateScoreboard(data) {
    playerScoreDisplay.textContent = `Tú: ${playerRole === P_CREATOR ? data.scoreP1 : data.scoreP2}`;
    opponentScoreDisplay.textContent = `Oponente: ${playerRole === P_CREATOR ? data.scoreP2 : data.scoreP1}`;
    minesRemainingDisplay.textContent = `Minas: ${data.remainingMines}`;
}


// --- 6. Manejo de Interacción y Renderizado ---

function initializeGridDisplay() {
    minesweeperGrid.innerHTML = ''; 
    minesweeperGrid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;
    minesweeperGrid.style.gridTemplateRows = `repeat(${GRID_SIZE}, 1fr)`;
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('mine-cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            minesweeperGrid.appendChild(cell);
        }
    }
}


function renderMinesweeperGrid(revealedState, board) {
    // Si el tablero aún no está generado, solo mostramos las celdas vacías (iniciales)
    const isBoardGenerated = board !== null;

    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const key = getCellKey(r, c);
            const cell = minesweeperGrid.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (!cell) continue;
            
            const state = revealedState[key];
            const cellValue = isBoardGenerated ? board[r][c] : 0;
            
            cell.className = 'mine-cell'; // Reset de clases
            cell.textContent = ''; // Reset de contenido

            if (state?.includes('_R')) {
                cell.classList.add('revealed');
                cell.classList.add(state.slice(0, 2)); // P1 o P2

                if (cellValue === -1) {
                    cell.textContent = '💣';
                } else if (cellValue > 0) {
                    cell.textContent = cellValue;
                    cell.classList.add(`num-${cellValue}`);
                }
            } else if (state?.includes('_F')) {
                cell.textContent = '🚩';
                cell.classList.add('flagged');
            }
        }
    }
}

function handleMinesweeperClick(e) {
    const cell = e.target.closest('.mine-cell');
    if (!cell || !isGameActive) return; 

    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    
    // Clic izquierdo
    if (e.button === 0) {
        revealCell(r, c);
    } 
}

function handleFlag(r, c) {
    if (!localBoard) {
        showToast("El juego aún no ha comenzado con el primer clic.", 'error');
        return;
    }
    
    const key = getCellKey(r, c);
    const isRevealed = localRevealedState[key]?.includes('_R');

    if (isRevealed) return; 

    const gameRef = ref(db, `games/${currentGameID}`);
    get(gameRef).then(snapshot => {
        const data = snapshot.val();
        if (data.winner) return;

        let newRevealed = { ...data.revealed };
        
        if (newRevealed[key]?.includes('_F')) {
            // Quitar bandera
            delete newRevealed[key];
        } else {
            // Poner bandera
            newRevealed[key] = `${playerRole}_F`;
        }

        update(gameRef, {
            revealed: newRevealed
        });
    });
}

function handleFirstClick(r, c) {
    // 1. Generar tablero de forma segura (2D Array local)
    localBoard = generateBoardData(GRID_SIZE, NUM_MINES, r, c);

    // 2. Aplicar la revelación inicial en cascada
    checkAndRevealAdjacent(r, c, playerRole); // Usa localBoard y localRevealedState

    // 3. Calcular puntos iniciales
    const pointsEarned = Object.keys(localRevealedState).length;

    // 4. Guardar el estado inicial y la configuración del tablero en Firebase
    update(ref(db, `games/${currentGameID}`), {
        boardConfig: JSON.stringify(localBoard), // Guardar 2D como string JSON
        revealed: localRevealedState, // Guardar objeto clave-valor 1D
        scoreP1: playerRole === P_CREATOR ? pointsEarned : 0,
        scoreP2: playerRole === P_JOINER ? pointsEarned : 0
    });
}


function revealCell(r, c) {
    const gameRef = ref(db, `games/${currentGameID}`);
    get(gameRef).then(snapshot => {
        const data = snapshot.val();
        
        const key = getCellKey(r, c);
        
        // CRÍTICO: Si el tablero es null, este es el primer clic.
        if (!data.boardConfig) {
            if (!isGameActive) {
                showToast("Espera a que se una el segundo jugador para iniciar.", 'error');
                return;
            }
            handleFirstClick(r, c);
            return;
        }
        
        // Si el tablero ya existe, debemos haberlo cargado localmente en sincronizarMinesweeper
        if (!localBoard) return; 

        if (data.winner) return; 
        if (localRevealedState[key]?.includes('_R') || localRevealedState[key]?.includes('_F')) return;

        // Clonar el estado revelado de Firebase
        let newRevealed = { ...localRevealedState };
        let newScoreP1 = data.scoreP1;
        let newScoreP2 = data.scoreP2;
        let gameResult = data.winner; 
        let pointsEarned = 0;

        // Lógica de derrota y puntuación
        if (localBoard[r][c] === -1) {
            // ¡Mina!
            const winningPlayer = playerRole === P_CREATOR ? P_JOINER : P_CREATOR;
            gameResult = winningPlayer; 

            newRevealed[key] = `${playerRole}_R`; // Marcar la mina que se encontró

            showToast(`¡Boom! ${playerRole} ha perdido. ¡${winningPlayer} gana!`, 'error');

        } else if (localBoard[r][c] > 0) {
            // Número
            newRevealed[key] = `${playerRole}_R`;
            pointsEarned = localBoard[r][c];

        } else {
            // Celda vacía (0)
            const initialRevealCount = Object.keys(newRevealed).length;
            
            // Usamos la función recursiva sobre el estado local clonado (newRevealed)
            localRevealedState = newRevealed; // Asignamos temporalmente para que la recursión funcione
            checkAndRevealAdjacent(r, c, playerRole);
            newRevealed = localRevealedState; // Recuperamos el estado modificado
            
            const finalRevealCount = Object.keys(newRevealed).length;
            pointsEarned = finalRevealCount - initialRevealCount;
            localRevealedState = data.revealed || {}; // Reset localRevealedState 
        }
        
        // Aplicar puntuación
        if (playerRole === P_CREATOR) {
            newScoreP1 += pointsEarned;
        } else {
            newScoreP2 += pointsEarned;
        }

        // 4. Actualizar Firebase
        update(gameRef, {
            revealed: newRevealed,
            scoreP1: newScoreP1,
            scoreP2: newScoreP2,
            winner: gameResult 
        });
    });
}

function endGameMinesweeper(message) {
    isGameActive = false;
    resetGameListeners();
    minesweeperStatus.textContent = message;
    minesweeperResetBtn.classList.remove('hidden');
}


// --- 7. Event Listeners y Utilidades de UI (Minesweeper) ---

minesweeperCreateBtn.addEventListener('click', crearPartidaMinesweeper); 
minesweeperJoinBtn.addEventListener('click', unirseAPartidaMinesweeper); 
minesweeperGrid.addEventListener('click', handleMinesweeperClick); 
minesweeperGrid.addEventListener('contextmenu', (e) => {
    e.preventDefault(); 
    const cell = e.target.closest('.mine-cell');
    if (cell && isGameActive) {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        handleFlag(r, c);
    }
});


// Lógica de inicio de Dark Mode y activación de menú (Copiada)
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

document.addEventListener('DOMContentLoaded', () => {
    setActiveMenu(); 
    initializeGridDisplay(); 
    
    if (localStorage.getItem('dark-mode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }
    if (window.location.hash) {
        const gameCodeFromURL = window.location.hash.substring(1).toUpperCase();
        minesweeperJoinInput.value = gameCodeFromURL;
        showToast("Código de partida cargado desde el enlace.", 'success');
    }
});
darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('dark-mode', isDarkMode);
    darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
});
