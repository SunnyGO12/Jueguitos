// --- VARIABLES GLOBALES ---
let secretWord = "";
let currentRow = 0;
let isGameActive = true;
const MAX_TRIES = 5;
// ELIMINADO: currentGuess y currentCellIndex

// --- ELEMENTOS DEL DOM ---
// Fase 1
const setupContainer = document.getElementById('setup-container');
const secretWordInput = document.getElementById('secret-word-input');
const startGameBtn = document.getElementById('start-game-btn');

// Fase 2
const gameContainer = document.getElementById('game-container');
const gameGrid = document.getElementById('game-grid');
const gameMessage = document.getElementById('game-message');
// REVERTIDO: Volvemos a añadir guessInput y guessBtn
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');
// ELIMINADO: keyboardContainer

// Fase 3
const resetBtn = document.getElementById('reset-btn');

// Modo Oscuro y Toasts
const darkModeToggle = document.getElementById('dark-mode-toggle');
const toastContainer = document.getElementById('toast-container');

// --- EVENT LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    // Aplicar modo oscuro si estaba guardado
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
resetBtn.addEventListener('click', resetGame);

// REVERTIDO: Vuelven los listeners para el input
guessBtn.addEventListener('click', handleGuess);
guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGuess();
});

// ELIMINADO: Listeners del Teclado


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

// --- FUNCIÓN: Aplicar Animación ---
function applyAnimation(element, animationClass) {
    element.classList.add(animationClass);
    
    element.addEventListener('animationend', () => {
        element.classList.remove(animationClass);
    }, { once: true });
}


// ELIMINADO: Funciones processInput, addLetter, deleteLetter


// --- FUNCIONES DEL JUEGO (MODIFICADAS) ---

/**
 * FASE 1: Iniciar el Juego
 */
function startGame() {
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

    secretWord = word;
    isGameActive = true;
    
    setupContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    
    // REVERTIDO: Hacemos focus en el input
    guessInput.focus();
}

/**
 * FASE 2: Manejar un Intento (REVERTIDO)
 */
function handleGuess() {
    if (!isGameActive) return;

    // REVERTIDO: Leemos desde el input
    const guess = guessInput.value.trim().toUpperCase();

    if (guess.length !== 5) {
        showToast("¡Tu intento debe tener 5 letras!");
        applyAnimation(guessInput, 'shake'); // Animar el input
        return;
    }

    isGameActive = false; // Deshabilitar entrada durante la animación
    processGuess(guess);

    // REVERTIDO: Limpiamos el input
    guessInput.value = "";
}

/**
 * FASE 2: Procesar el Intento (MODIFICADO)
 */
function processGuess(guess) {
    const row = gameGrid.children[currentRow];
    
    // Lógica de mapeo de letras
    const secretWordMap = {};
    for (const letter of secretWord) {
        secretWordMap[letter] = (secretWordMap[letter] || 0) + 1;
    }
    const cellStates = Array(5).fill('absent');

    // 1er Pase: "Correctas" (Verdes)
    for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        if (letter === secretWord[i]) {
            cellStates[i] = 'correct';
            secretWordMap[letter]--;
        }
    }

    // 2do Pase: "Presentes" (Amarillas)
    for (let i = 0; i < 5; i++) {
        if (cellStates[i] === 'correct') continue;
        const letter = guess[i];
        if (secretWord.includes(letter) && secretWordMap[letter] > 0) {
            cellStates[i] = 'present';
            secretWordMap[letter]--;
        }
    }

    // Aplicar animación de volteo
    for (let i = 0; i < 5; i++) {
        const cell = row.children[i];
        
        setTimeout(() => {
            // REVERTIDO: Añadimos el texto de la letra aquí
            cell.textContent = guess[i]; 
            cell.classList.add('cell-reveal');
            cell.classList.add(`cell-${cellStates[i]}`);
        }, i * 300); 
    }

    // Comprobar fin del juego DESPUÉS de la animación
    const animationDuration = 5 * 300 + 600; 
    setTimeout(() => {
        // ELIMINADO: updateKeyboardColors()
        checkGameEnd(guess);
    }, animationDuration);
}

// ELIMINADO: La función updateKeyboardColors()


/**
 * FASE 3: Comprobar Fin del Juego (MODIFICADO)
 */
function checkGameEnd(guess) {
    // Condición de Victoria
    if (guess === secretWord) {
        gameMessage.textContent = "¡Felicidades, Ganaste!";
        triggerVictoryAnimation();
        endGame();
        return;
    }

    currentRow++;
    // ELIMINADO: Reseteo de currentGuess y currentCellIndex

    // Condición de Derrota
    if (currentRow === MAX_TRIES) {
        // CORREGIDO: No mostrar la palabra secreta
        gameMessage.textContent = "¡Perdiste! La palabra no fue adivinada.";
        endGame();
        return;
    }

    // Si el juego no ha terminado, reactivarlo
    isGameActive = true;
    guessInput.focus(); // REVERTIDO: Hacemos focus en el input
}

/**
 * FASE 3: Acciones de Fin de Juego (REVERTIDO)
 */
function endGame() {
    isGameActive = false; 
    // REVERTIDO: Deshabilitamos el input y botón
    guessInput.disabled = true;
    guessBtn.disabled = true;
    resetBtn.classList.remove('hidden');
}

/**
 * FASE 3: Reiniciar el Juego (REVERTIDO)
 */
function resetGame() {
    // Resetear variables
    secretWord = "";
    currentRow = 0;
    isGameActive = true;
    // ELIMINADO: Reseteo de currentGuess y currentCellIndex

    // Resetear interfaz Fase 1
    setupContainer.classList.remove('hidden');
    secretWordInput.value = "";

    // Resetear interfaz Fase 2
    gameContainer.classList.add('hidden');
    gameMessage.textContent = "";
    // REVERTIDO: Reseteo del input y botón
    guessInput.value = "";
    guessInput.disabled = false;
    guessBtn.disabled = false;

    // Ocultar botón de reinicio
    resetBtn.classList.add('hidden');

    // Limpiar la cuadrícula
    for (let i = 0; i < MAX_TRIES; i++) {
        const row = gameGrid.children[i];
        for (let j = 0; j < 5; j++) {
            const cell = row.children[j];
            cell.textContent = "";
            cell.classList.remove('cell-correct', 'cell-present', 'cell-absent', 'cell-reveal', 'jubilation');
        }
    }
    
    // ELIMINADO: Limpieza del teclado
}

/**
 * Animación de Victoria
 */
function triggerVictoryAnimation() {
    const winningRow = gameGrid.children[currentRow]; 
    
    for (let i = 0; i < 5; i++) {
        const cell = winningRow.children[i];
        setTimeout(() => {
            cell.classList.add('jubilation');
        }, i * 100); 
    }
}
