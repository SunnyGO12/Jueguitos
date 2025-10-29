// --- VARIABLES GLOBALES ---
let secretWord = "";
let currentRow = 0;
let isGameActive = true;
const MAX_TRIES = 5;

// --- ELEMENTOS DEL DOM ---
// Fase 1: Configuración
const setupContainer = document.getElementById('setup-container');
const secretWordInput = document.getElementById('secret-word-input');
const startGameBtn = document.getElementById('start-game-btn');

// Fase 2: Juego
const gameContainer = document.getElementById('game-container');
const gameGrid = document.getElementById('game-grid');
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');
const gameMessage = document.getElementById('game-message');

// Fase 3: Reinicio
const resetBtn = document.getElementById('reset-btn');
// ELIMINADO: const shareBtn = document.getElementById('share-btn');

// Modo Oscuro y Toasts
const darkModeToggle = document.getElementById('dark-mode-toggle');
const toastContainer = document.getElementById('toast-container');

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('dark-mode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }
});

darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('dark-mode', isDarkMode);
    darkModeToggle.textContent = isDarkMode ? '☀️' : '🌙';
});

startGameBtn.addEventListener('click', startGame);

guessBtn.addEventListener('click', handleGuess);
guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGuess();
});

resetBtn.addEventListener('click', resetGame);
// ELIMINADO: shareBtn.addEventListener('click', shareResult);


// --- FUNCIÓN: Notificaciones Toast ---
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


// --- FUNCIONES DEL JUEGO ---

function startGame() {
    const word = secretWordInput.value.trim().toUpperCase();

    if (word.length !== 5) {
        showToast("¡La palabra debe tener exactamente 5 letras!");
        return;
    }
    if (!/^[A-Z]+$/.test(word)) {
        showToast("¡La palabra solo debe contener letras!");
        return;
    }

    secretWord = word;
    isGameActive = true;
    
    setupContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    
    guessInput.focus();
}

function handleGuess() {
    if (!isGameActive) return;

    const guess = guessInput.value.trim().toUpperCase();

    if (guess.length !== 5) {
        showToast("¡Tu intento debe tener 5 letras!");
        return;
    }

    isGameActive = false;
    processGuess(guess);

    guessInput.value = "";
}

function processGuess(guess) {
    const row = gameGrid.children[currentRow];
    
    const secretWordMap = {};
    for (const letter of secretWord) {
        secretWordMap[letter] = (secretWordMap[letter] || 0) + 1;
    }

    const cellStates = Array(5).fill('absent');

    for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        if (letter === secretWord[i]) {
            cellStates[i] = 'correct';
            secretWordMap[letter]--;
        }
    }

    for (let i = 0; i < 5; i++) {
        if (cellStates[i] === 'correct') continue;
        const letter = guess[i];
        if (secretWord.includes(letter) && secretWordMap[letter] > 0) {
            cellStates[i] = 'present';
            secretWordMap[letter]--;
        }
    }

    for (let i = 0; i < 5; i++) {
        const cell = row.children[i];
        
        setTimeout(() => {
            cell.textContent = guess[i];
            cell.classList.add('cell-reveal');
            cell.classList.add(`cell-${cellStates[i]}`);
        }, i * 300);
    }

    const animationDuration = 5 * 300 + 600;
    setTimeout(() => {
        checkGameEnd(guess);
    }, animationDuration);
}

function checkGameEnd(guess) {
    if (guess === secretWord) {
        gameMessage.textContent = "¡Felicidades, Ganaste!";
        endGame();
        return;
    }

    currentRow++;

    if (currentRow === MAX_TRIES) {
        gameMessage.textContent = `Perdiste. La palabra era: ${secretWord}`;
        endGame();
        return;
    }

    isGameActive = true;
    guessInput.focus();
}

function endGame() {
    isGameActive = false;
    guessInput.disabled = true;
    guessBtn.disabled = true;
    resetBtn.classList.remove('hidden');
    // ELIMINADO: shareBtn.classList.remove('hidden');
}

function resetGame() {
    secretWord = "";
    currentRow = 0;
    isGameActive = true;

    setupContainer.classList.remove('hidden');
    secretWordInput.value = "";

    gameContainer.classList.add('hidden');
    gameMessage.textContent = "";
    guessInput.value = "";
    guessInput.disabled = false;
    guessBtn.disabled = false;

    resetBtn.classList.add('hidden');
    // ELIMINADO: shareBtn.classList.add('hidden');

    for (let i = 0; i < MAX_TRIES; i++) {
        const row = gameGrid.children[i];
        for (let j = 0; j < 5; j++) {
            const cell = row.children[j];
            cell.textContent = "";
            cell.classList.remove('cell-correct', 'cell-present', 'cell-absent', 'cell-reveal');
        }
    }
}

// ELIMINADO: La función completa 'shareResult()' ha sido borrada.
