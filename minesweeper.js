// --- 1. Configuración de Firebase (Igual que en otros scripts) ---
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

// Configuración del tablero
const GRID_SIZE = 8;
const NUM_MINES = 10;
const P_CREATOR = 'P1';
const P_JOINER = 'P2';


// --- 4. Funciones de Juego (Lógica de Buscaminas) ---

/**
 * Genera el tablero de minas y números, GARANTIZANDO que (startR, startC) no tenga una mina
 * y tenga valor 0 (o lo más cercano a 0 posible).
 */
function generateMinesweeperBoard(size, mines, startR, startC) {
    let board = Array(size).fill(0).map(() => Array(size).fill(0));
    let placedMines = 0;

    // Colocar Minas (-1), evitando el área inicial
    while (placedMines < mines) {
        let row = Math.floor(Math.random() * size);
        let col = Math.floor(Math.random() * size);
        
        // Evitar la celda de inicio y sus vecinos inmediatos (3x3 área)
        if (Math.abs(row - startR) <= 1 && Math.abs(col - startC) <= 1) {
            continue;
        }
        
        if (board[row][col] !== -1) {
            board[row][col] = -1;
            placedMines++;
        }
    }

    // Calcular números adyacentes
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
    
    // Matriz de vista inicial
    let view = Array(size).fill(0).map(() => Array(size).fill({
        revealed: false,
        flagged: false,
        player: null
    }));

    return { board, view, scoreP1: 0, scoreP2: 0, totalMines: mines, remainingMines: mines, winner: null };
}

/**
 * REGLA CRÍTICA DE BUSCAMINAS: Revelación en Cascada
 * Modifica la matriz 'view' en su lugar.
 */
function checkAndRevealAdjacent(r, c, board, view, player) {
    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE || view[r][c].revealed) {
        return;
    }
    if (board[r][c] === -1 || view[r][c].flagged) {
        return;
    }

    view[r][c].revealed = true;
    view[r][c].player = player;
    
    if (board[r][c] > 0) {
        return;
    }

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue; 
            
            checkAndRevealAdjacent(r + i, c + j, board, view, player);
        }
    }
}


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

async function crearPartidaMinesweeper() {
    minesweeperCreateBtn.disabled = true;
    minesweeperCreateBtn.textContent = "Creando...";
    resetGameListeners();

    currentGameID = await generarCodigoUnico();
    const newGameRef = ref(db, `games/${currentGameID}`);
    
    // NO GENERAMOS EL TABLERO AQUÍ. Solo lo inicializamos a null.
    set(newGameRef, {
        gameType: 'minesweeper',
        status: 'waiting',
        player1: P_CREATOR, 
        player2: null,
        board: null, // CRÍTICO: El tablero es null al inicio
        view: null,  // CRÍTICO: La vista es null al inicio
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

    if (statusListener) {
        statusListener(); 
        statusListener = null;
    }
    
    // Inicializar la cuadrícula visual para ambos
    initializeGridDisplay(); 

    sincronizarMinesweeper();
}

function sincronizarMinesweeper() {
    resetGameListeners();
    
    gameListener = onValue(ref(db, `games/${currentGameID}`), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        // Si el tablero no se ha generado, mostramos el mensaje de "Esperando el primer clic"
        if (data.board === null) {
            minesweeperStatus.textContent = "Esperando el primer clic de un jugador...";
            return;
        }

        renderMinesweeperGrid(data.view, data.board);
        updateScoreboard(data);

        // Lógica de fin de juego
        if (data.winner) {
            const opponentRole = data.winner === P_CREATOR ? P_JOINER : P_CREATOR;
            if (data.winner === playerRole) {
                minesweeperStatus.textContent = "¡Has Ganado! (Tu oponente tocó una mina)";
            } else {
                minesweeperStatus.textContent = `¡Has Perdido! (Ganó ${data.winner} porque tocaste una mina)`;
            }
            endGameMinesweeper();
            
        } else if (data.remainingMines === 0) {
            const finalMessage = data.scoreP1 > data.scoreP2 ? `P1 gana con ${data.scoreP1} puntos.` : (data.scoreP2 > data.scoreP1 ? `P2 gana con ${data.scoreP2} puntos.` : "¡Empate!");
            endGameMinesweeper(finalMessage);
        } else {
            minesweeperStatus.textContent = "¡A jugar! Clica para revelar celdas.";
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


function renderMinesweeperGrid(view, board) {
    minesweeperGrid.innerHTML = ''; 
    
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const cellData = view[r][c];
            const cellValue = board[r][c];
            const cell = document.createElement('div');
            
            cell.classList.add('mine-cell');
            cell.dataset.row = r;
            cell.dataset.col = c;
            
            if (cellData.revealed) {
                cell.classList.add('revealed');
                
                if (cellValue === -1) {
                    cell.textContent = '💣';
                    if (cellData.player) {
                         cell.classList.add(cellData.player); 
                    }
                } else if (cellValue > 0) {
                    cell.textContent = cellValue;
                    cell.classList.add(`num-${cellValue}`);
                }
            } else if (cellData.flagged) {
                cell.textContent = '🚩';
            }
            
            minesweeperGrid.appendChild(cell);
        }
    }
}

function handleMinesweeperClick(e) {
    const cell = e.target.closest('.mine-cell');
    if (!cell || !isGameActive) return;

    const r = parseInt(cell.dataset.row);
    const c = parseInt(cell.dataset.col);
    
    // Clic izquierdo (Revelar)
    if (e.button === 0) {
        revealCell(r, c);
    } 
    // Clic derecho (Bandera)
    // NOTE: El manejo de clic derecho se hace en el listener de 'contextmenu'
}

function handleFlag(r, c) {
    const gameRef = ref(db, `games/${currentGameID}`);
    get(gameRef).then(snapshot => {
        const data = snapshot.val();
        if (data.winner || data.view[r][c].revealed) return;

        let newView = data.view.map(row => row.map(cell => ({ ...cell })));
        
        // Toggle de la bandera
        newView[r][c].flagged = !newView[r][c].flagged;

        update(gameRef, {
            view: newView
        });
    });
}

// NUEVA FUNCIÓN: Procesa el primer clic para generar el tablero y luego revela
function handleFirstClick(r, c) {
    // 1. Generar tablero de forma segura
    const { board, view, scoreP1, scoreP2, totalMines, remainingMines } = generateMinesweeperBoard(GRID_SIZE, NUM_MINES, r, c);
    
    // 2. Revelar la primera celda (iniciando cascada)
    // Usamos el estado del nuevo tablero generado
    const initialRevealCount = view.flat().filter(cell => cell.revealed).length;
    checkAndRevealAdjacent(r, c, board, view, playerRole);
    const finalRevealCount = view.flat().filter(cell => cell.revealed).length;
    
    const pointsEarned = finalRevealCount - initialRevealCount;

    // 3. Guardar el nuevo tablero inicial y el estado de la revelación en Firebase
    update(ref(db, `games/${currentGameID}`), {
        board: board,
        view: view,
        scoreP1: playerRole === P_CREATOR ? pointsEarned : 0,
        scoreP2: playerRole === P_JOINER ? pointsEarned : 0
    });
}


// Lógica CRÍTICA de Buscaminas (CORREGIDA)
function revealCell(r, c) {
    const gameRef = ref(db, `games/${currentGameID}`);
    get(gameRef).then(snapshot => {
        const data = snapshot.val();
        
        // CRÍTICO: Si el tablero es null, este es el primer clic.
        if (data.board === null) {
            handleFirstClick(r, c);
            return;
        }

        if (data.winner) return; 
        if (data.view[r][c].revealed || data.view[r][c].flagged) return;

        let newBoard = data.board.map(row => [...row]); 
        let newView = data.view.map(row => row.map(cell => ({ ...cell })));

        let newScoreP1 = data.scoreP1;
        let newScoreP2 = data.scoreP2;
        let newRemainingMines = data.remainingMines;
        let gameResult = data.winner; 

        // Lógica de derrota y puntuación
        if (newBoard[r][c] === -1) {
            // ¡Mina! El jugador activo PIERDE, el oponente GANA.
            const winningPlayer = playerRole === P_CREATOR ? P_JOINER : P_CREATOR;
            gameResult = winningPlayer; 

            newView[r][c].revealed = true;
            newView[r][c].player = playerRole; 

            showToast(`¡Boom! ${playerRole} ha perdido. ¡${winningPlayer} gana!`, 'error');

        } else if (newBoard[r][c] > 0) {
            // Número: Revela la celda y suma puntos.
            newView[r][c].revealed = true;
            newView[r][c].player = playerRole;

            if (playerRole === P_CREATOR) {
                newScoreP1 += newBoard[r][c];
            } else {
                newScoreP2 += newBoard[r][c];
            }
        } else {
            // Celda vacía (0): Inicia la cascada y suma 1 punto por cada celda revelada.
            const initialRevealCount = newView.flat().filter(c => c.revealed).length;
            
            checkAndRevealAdjacent(r, c, newBoard, newView, playerRole);

            const finalRevealCount = newView.flat().filter(c => c.revealed).length;
            const pointsEarned = finalRevealCount - initialRevealCount;

            if (playerRole === P_CREATOR) {
                newScoreP1 += pointsEarned;
            } else {
                newScoreP2 += pointsEarned;
            }
        }
        
        // Contar minas restantes (simplificado, asume que las marcadas con bandera son correctas)
        let flaggedCount = newView.flat().filter(c => c.flagged).length;
        newRemainingMines = NUM_MINES - flaggedCount;


        update(gameRef, {
            view: newView,
            scoreP1: newScoreP1,
            scoreP2: newScoreP2,
            remainingMines: newRemainingMines,
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
