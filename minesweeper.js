// Reemplaza la función revealCell COMPLETA en minesweeper.js
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

        if (data.winner) return; 
        if (data.view[r][c].revealed || data.view[r][c].flagged) return;

        // *****************************************************************
        // CORRECCIÓN DEFINITIVA: Clonación manual y robusta de las matrices
        // *****************************************************************
        let newBoard = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0));
        let newView = Array(GRID_SIZE).fill(0).map(() => Array(GRID_SIZE).fill(0).map(() => ({ revealed: false, flagged: false, player: null })));
        
        // Copiar datos existentes de forma segura
        for (let i = 0; i < GRID_SIZE; i++) {
            if (data.board && data.board[i]) {
                newBoard[i] = [...data.board[i]];
            }
            if (data.view && data.view[i]) {
                for (let j = 0; j < GRID_SIZE; j++) {
                    if (data.view[i][j]) {
                        newView[i][j] = { ...data.view[i][j] };
                    }
                }
            }
        }
        
        // Ahora trabajamos con las matrices newBoard y newView seguras
        let newScoreP1 = data.scoreP1;
        let newScoreP2 = data.scoreP2;
        let newRemainingMines = data.remainingMines;
        let gameResult = data.winner; 

        // Lógica de derrota y puntuación
        if (newBoard[r][c] === -1) {
            // ¡Mina!
            const winningPlayer = playerRole === P_CREATOR ? P_JOINER : P_CREATOR;
            gameResult = winningPlayer; 

            newView[r][c].revealed = true;
            newView[r][c].player = playerRole; 

            showToast(`¡Boom! ${playerRole} ha perdido. ¡${winningPlayer} gana!`, 'error');

        } else if (newBoard[r][c] > 0) {
            // Número
            newView[r][c].revealed = true;
            newView[r][c].player = playerRole;

            if (playerRole === P_CREATOR) {
                newScoreP1 += newBoard[r][c];
            } else {
                newScoreP2 += newBoard[r][c];
            }
        } else {
            // Celda vacía (0)
            const initialRevealCount = newView.flat().filter(c => c.revealed).length;
            
            // Llama a la función recursiva para revelar el área vacía
            checkAndRevealAdjacent(r, c, newBoard, newView, playerRole);

            const finalRevealCount = newView.flat().filter(c => c.revealed).length;
            const pointsEarned = finalRevealCount - initialRevealCount;

            if (playerRole === P_CREATOR) {
                newScoreP1 += pointsEarned;
            } else {
                newScoreP2 += pointsEarned;
            }
        }
        
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
