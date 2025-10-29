// --- VARIABLES GLOBALES ---
let secretWord = "";
let currentRow = 0;
const MAX_TRIES = 5;

// --- ELEMENTOS DEL DOM ---
// Fase 1: Configuración
const setupContainer = document.getElementById('setup-container');
const secretWordInput = document.getElementById('secret-word-input');
const startGameBtn = document.getElementById('start-game-btn');
const setupError = document.getElementById('setup-error');

// Fase 2: Juego
const gameContainer = document.getElementById('game-container');
const gameGrid = document.getElementById('game-grid');
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');
const gameMessage = document.getElementById('game-message');

// Fase 3: Reinicio
const resetBtn = document.getElementById('reset-btn');

// --- EVENT LISTENERS ---

// Botón para iniciar el juego (Fase 1)
startGameBtn.addEventListener('click', startGame);

// Botón para enviar intento (Fase 2)
guessBtn.addEventListener('click', handleGuess);

// Permitir enviar intento con la tecla "Enter"
guessInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleGuess();
    }
});

// Botón para jugar de nuevo (Fase 3)
resetBtn.addEventListener('click', resetGame);

// --- FUNCIONES DEL JUEGO ---

/**
 * FASE 1: Iniciar el Juego
 * Valida la palabra secreta y cambia a la Fase 2.
 */
function startGame() {
    const word = secretWordInput.value.trim().toUpperCase();

    // Validación de 5 letras
    if (word.length !== 5) {
        setupError.textContent = "¡La palabra debe tener exactamente 5 letras!";
        return;
    }

    // Almacenamos la palabra y cambiamos de vista
    secretWord = word;
    setupError.textContent = "";
    
    // Ocultar Fase 1 y mostrar Fase 2
    setupContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    
    // Enfocar el campo de adivinanza para el Retado
    guessInput.focus();
}

/**
 * FASE 2: Manejar un Intento
 * Valida la palabra del retado y la procesa.
 */
function handleGuess() {
    const guess = guessInput.value.trim().toUpperCase();

    // Validación de 5 letras
    if (guess.length !== 5) {
        gameMessage.textContent = "¡Tu intento debe tener 5 letras!";
        return;
    }

    // Procesar el intento
    processGuess(guess);

    // Limpiar el campo de entrada
    guessInput.value = "";
}

/**
 * FASE 2: Procesar el Intento
 * Compara la palabra con la secreta y colorea la cuadrícula.
 */
function processGuess(guess) {
    // Obtener la fila actual de la cuadrícula
    const row = gameGrid.children[currentRow];
    
    // Usamos un mapa de frecuencia para manejar letras repetidas (lógica de Wordle)
    const secretWordMap = {};
    for (const letter of secretWord) {
        secretWordMap[letter] = (secretWordMap[letter] || 0) + 1;
    }

    // Array para almacenar los estados (correct, present, absent)
    const cellStates = Array(5).fill('absent');

    // 1er Pase: Buscar letras "Correctas" (Verdes)
    for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        if (letter === secretWord[i]) {
            cellStates[i] = 'correct';
            secretWordMap[letter]--; // Reducir la cuenta de esta letra
        }
    }

    // 2do Pase: Buscar letras "Presentes" (Amarillas)
    for (let i = 0; i < 5; i++) {
        // Si ya es verde, saltar
        if (cellStates[i] === 'correct') continue;

        const letter = guess[i];
        if (secretWord.includes(letter) && secretWordMap[letter] > 0) {
            cellStates[i] = 'present';
            secretWordMap[letter]--; // Reducir la cuenta
        }
    }

    // Aplicar los estilos a las celdas
    for (let i = 0; i < 5; i++) {
        const cell = row.children[i];
        cell.textContent = guess[i];
        cell.classList.add(`cell-${cellStates[i]}`);
    }

    // Pasar a la siguiente fila
    currentRow++;

    // Comprobar si el juego terminó
    checkGameEnd(guess);
}

/**
 * FASE 3: Comprobar Fin del Juego (Victoria o Derrota)
 */
function checkGameEnd(guess) {
    // Condición de Victoria
    if (guess === secretWord) {
        gameMessage.textContent = "¡Felicidades, Ganaste!";
        endGame();
        return;
    }

    // Condición de Derrota (se acabaron los intentos)
    if (currentRow === MAX_TRIES) {
        gameMessage.textContent = `Perdiste. La palabra era: ${secretWord}`;
        endGame();
        return;
    }
}

/**
 * FASE 3: Acciones de Fin de Juego
 * Deshabilita entradas y muestra el botón de reinicio.
 */
function endGame() {
    guessInput.disabled = true;
    guessBtn.disabled = true;
    resetBtn.classList.remove('hidden');
}

/**
 * FASE 3: Reiniciar el Juego
 * Vuelve todo al estado inicial (Fase 1).
 */
function resetGame() {
    // Resetear variables
    secretWord = "";
    currentRow = 0;

    // Resetear interfaz Fase 1
    setupContainer.classList.remove('hidden');
    secretWordInput.value = "";
    setupError.textContent = "";

    // Resetear interfaz Fase 2
    gameContainer.classList.add('hidden');
    gameMessage.textContent = "";
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
            cell.classList.remove('cell-correct', 'cell-present', 'cell-absent');
        }
    }
}