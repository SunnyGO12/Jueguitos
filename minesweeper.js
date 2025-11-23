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


// --- 4. Funciones de Juego (Lógica de Buscaminas - ADAPTADA A 1D) ---

// Función auxiliar para obtener el índice 1D a partir de 2D
const getIndex1D = (r, c) => r * GRID_SIZE + c;


/**
 * Genera el tablero de minas y números en formato 1D List (Array de 64 elementos).
 */
function generateMinesweeperBoard(size, mines, startR, startC) {
    let board2D = Array(size).fill(0).map(() => Array(size).fill(0));
    let placedMines = 0;

    // Colocar Minas (-1), evitando el área inicial (3x3)
    while (placedMines < mines) {
        let row = Math.floor(Math.random() * size);
        let col = Math.floor(Math.random() * size);
        
        if (Math.abs(row - startR) <= 1 && Math.abs(col - startC) <= 1) {
            continue;
        }
        
        if (board2D[row][col] !== -1) {
            board2D[row][col] = -1;
            placedMines++;
        }
    }

    // Calcular números adyacentes
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (board2D[r][c] === -1) continue;

            let count = 0;
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const nr = r + i;
                    const nc = c + j;

                    if (nr >= 0 && nr < size && nc >= 0 && nc < size && board2D[nr][nc] === -1) {
                        count++;
                    }
                }
            }
            board2D[r][c] = count;
        }
    }
    
    // Convertir a lista 1D para Firebase
    let boardList = [];
    let viewList = [];

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            boardList.push(board2D[r][c]);
            viewList.push({
                revealed: false,
                flagged: false,
                player: null
            });
        }
    }

    return { board: boardList, view: viewList, scoreP1: 0, scoreP2: 0, totalMines: mines, remainingMines: mines, winner: null };
}

/**
 * Revelación en Cascada (Adaptada a 1D)
 */
function checkAndRevealAdjacent(r, c, board, view, player) {
    const i = getIndex1D(r, c);

    if (r < 0 || r >= GRID_SIZE || c < 0 || c >= GRID_SIZE || view[i].revealed) {
        return;
    }
    if (board[i] === -1 || view[i].flagged) {
        return;
    }

    view[i].revealed = true;
    view[i].player = player;
    
    if (board[i] > 0) {
        return;
    }

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue; 
            
            checkAndRevealAdjacent(r + dr, c + dc, board, view, player);
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
    
    set(newGameRef, {
        gameType: 'minesweeper',
        status: 'waiting',
        player1: P_CREATOR, 
        player2: null,
        board: null, 
        view: null,  
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
    
    initializeGridDisplay(); 

    sincronizarMinesweeper();
}

function sincronizarMinesweeper() {
    resetGameListeners();
    
    gameListener = onValue(ref(db, `games/${currentGameID}`), (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        // CRÍTICO: Verificar si el tablero y la vista existen antes de intentar renderizar
        if (data.board === null || data.view === null || data.board === undefined || data.view === undefined) { 
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
            // El juego está activo y esperando clics
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
    
    // Si data.view es un objeto, forzamos su conversión a un array denso.
    const viewList = Array.isArray(view) ? view : Object.values(view || {});
    const boardList = Array.isArray(board) ? board : Object.values(board || {});


    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const i = getIndex1D(r, c); // Índice 1D

            // Verificación de seguridad usando la longitud esperada
            if (i >= viewList.length || i >= boardList.length) continue; 
            
            const cellData = viewList[i];
            const cellValue = boardList[i];
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
    
    // Clic izquierdo
    if (e.button === 0) {
        revealCell(r, c);
    } 
}

function handleFlag(r, c) {
    const gameRef = ref(db, `games/${currentGameID}`);
    get(gameRef).then(snapshot => {
        const data = snapshot.val();
        if (data.winner || data.board === null) return;
        
        const i = getIndex1D(r, c);

        // Clonación profunda de view (array 1D es mucho más fácil)
        let newView = data.view.map(cell => ({ ...cell }));
        
        if (newView[i].revealed) return; // No se puede poner bandera en celda revelada
        
        // Toggle de la bandera
        newView[i].flagged = !newView[i].flagged;

        update(gameRef, {
            view: newView
        });
    });
}

function handleFirstClick(r, c) {
    // 1. Generar tablero de forma segura
    const { board, view, scoreP1, scoreP2, totalMines, remainingMines } = generateMinesweeperBoard(GRID_SIZE, NUM_MINES, r, c);
    
    // 2. Revelar la primera celda (iniciando cascada)
    const initialRevealCount = view.filter(cell => cell.revealed).length;
    checkAndRevealAdjacent(r, c, board, view, playerRole);
    const finalRevealCount = view.filter(cell => cell.revealed).length;
    
    const pointsEarned = finalRevealCount - initialRevealCount;

    // 3. Guardar el nuevo tablero inicial y el estado de la revelación en Firebase
    update(ref(db, `games/${currentGameID}`), {
        board: board,
        view: view,
        scoreP1: playerRole === P_CREATOR ? pointsEarned : 0,
        scoreP2: playerRole === P_JOINER ? pointsEarned : 0
    });
}


function revealCell(r, c) {
    const gameRef = ref(db, `games/${currentGameID}`);
    get(gameRef).then(snapshot => {
        const data = snapshot.val();
        
        // CRÍTICO: Si el tablero es null, este es el primer clic.
        if (data.board === null) {
            // Permitimos el primer clic solo si el juego está activo (ambos jugadores están dentro)
            if (!isGameActive) {
                showToast("Espera a que se una el segundo jugador para iniciar.");
                return;
            }
            handleFirstClick(r, c);
            return;
        }

        const i = getIndex1D(r, c);
        
        // Clonación de los arrays 1D (mucho más fácil y seguro)
        let newBoard = [...data.board]; 
        let newView = data.view.map(cell => ({ ...cell }));
        
        if (data.winner) return; 
        if (newView[i].revealed || newView[i].flagged) return;


        let newScoreP1 = data.scoreP1;
        let newScoreP2 = data.scoreP2;
        let newRemainingMines = data.remainingMines;
        let gameResult = data.winner; 

        // Lógica de derrota y puntuación
        if (newBoard[i] === -1) {
            // ¡Mina!
            const winningPlayer = playerRole === P_CREATOR ? P_JOINER : P_CREATOR;
            gameResult = winningPlayer; 

            newView[i].revealed = true;
            newView[i].player = playerRole; 

            showToast(`¡Boom! ${playerRole} ha perdido. ¡${winningPlayer} gana!`, 'error');

        } else if (newBoard[i] > 0) {
            // Número
            newView[i].revealed = true;
            newView[i].player = playerRole;

            if (playerRole === P_CREATOR) {
                newScoreP1 += newBoard[i];
            } else {
                newScoreP2 += newBoard[i];
            }
        } else {
            // Celda vacía (0)
            const initialRevealCount = newView.filter(c => c.revealed).length;
            
            // Llama a la función recursiva para revelar el área vacía (usa arrays 1D)
            checkAndRevealAdjacent(r, c, newBoard, newView, playerRole);

            const finalRevealCount = newView.filter(c => c.revealed).length;
            const pointsEarned = finalRevealCount - initialRevealCount;

            if (playerRole === P_CREATOR) {
                newScoreP1 += pointsEarned;
            } else {
                newScoreP2 += pointsEarned;
            }
        }
        
        let flaggedCount = newView.filter(c => c.flagged).length;
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
