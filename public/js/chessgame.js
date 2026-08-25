const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard");
const playerInfo = document.getElementById("playerInfo");
const turnIndicator = document.getElementById("turnIndicator");
const gameStatus = document.getElementById("gameStatus");
const restartBtn = document.getElementById("restartBtn");
const moveSound = document.getElementById("moveSound");

let playerRole = null;
let selectedSquare = null;
let draggedPiece = null;
let sourceSquare = null;

// Get Unicode representation for chess pieces
const getPieceUnicode = (piece) => {
    const unicodePieces = {
        p: "♟",
        r: "♜",
        n: "♞",
        b: "♝",
        q: "♛",
        k: "♚"
    };
    return unicodePieces[piece.type] || "";
};

// Render Board Function
const renderBoard = () => {
    const board = chess.board();
    boardElement.innerHTML = "";

    board.forEach((row, rowindex) => {
        row.forEach((square, squareindex) => {
            const squareElement = document.createElement("div");
            squareElement.classList.add("square", (rowindex + squareindex) % 2 === 0 ? "light" : "dark");
            squareElement.dataset.row = rowindex;
            squareElement.dataset.col = squareindex;

            // Highlight selected square
            if (selectedSquare && selectedSquare.row === rowindex && selectedSquare.col === squareindex) {
                squareElement.classList.add("selected");
            }

            if (square) {
                const pieceElement = document.createElement("div");
                pieceElement.classList.add("piece", square.color === "w" ? "white" : "black");
                pieceElement.innerText = getPieceUnicode(square);

                // Enable drag if player controls piece and it's their turn
                if (square.color === playerRole && chess.turn() === playerRole) {
                    pieceElement.draggable = true;
                    pieceElement.classList.add("draggable");

                    pieceElement.addEventListener("dragstart", (e) => {
                        draggedPiece = pieceElement;
                        sourceSquare = { row: rowindex, col: squareindex };
                        e.dataTransfer.setData("text/plain", "");
                        pieceElement.classList.add("dragging");
                        highlightMoves(rowindex, squareindex);
                    });

                    pieceElement.addEventListener("dragend", () => {
                        draggedPiece = null;
                        sourceSquare = null;
                        pieceElement.classList.remove("dragging");
                        clearHighlights();
                    });
                }

                squareElement.appendChild(pieceElement);
            }

            // Dragover & Drop events on square
            squareElement.addEventListener("dragover", (e) => {
                e.preventDefault();
            });

            squareElement.addEventListener("drop", (e) => {
                e.preventDefault();
                if (!sourceSquare) return;

                const targetSquare = {
                    row: parseInt(squareElement.dataset.row),
                    col: parseInt(squareElement.dataset.col)
                };

                handleMove(sourceSquare, targetSquare);
                sourceSquare = null;
                draggedPiece = null;
                clearHighlights();
            });

            // Unified click handler for selecting, moving, or capturing
            squareElement.addEventListener("click", () => {
                // If a piece is already selected
                if (selectedSquare) {
                    // If clicking the same square again -> deselect
                    if (selectedSquare.row === rowindex && selectedSquare.col === squareindex) {
                        selectedSquare = null;
                        clearHighlights();
                        renderBoard();
                        return;
                    }

                    // If clicking another piece of player's OWN color -> switch selection
                    if (square && square.color === playerRole && chess.turn() === playerRole) {
                        selectedSquare = { row: rowindex, col: squareindex };
                        renderBoard();
                        highlightMoves(rowindex, squareindex);
                        return;
                    }

                    // Otherwise (clicking empty square OR enemy piece to capture) -> attempt move!
                    const targetSquare = {
                        row: rowindex,
                        col: squareindex
                    };

                    handleMove(selectedSquare, targetSquare);
                    selectedSquare = null;
                    clearHighlights();
                    return;
                }

                // If no piece selected, select piece if it's player's own color & turn
                if (square && square.color === playerRole && chess.turn() === playerRole) {
                    selectedSquare = { row: rowindex, col: squareindex };
                    renderBoard();
                    highlightMoves(rowindex, squareindex);
                }
            });

            boardElement.appendChild(squareElement);
        });
    });

    if (playerRole === 'b') {
        boardElement.classList.add("flipped");
    } else {
        boardElement.classList.remove("flipped");
    }
};

// Highlight valid moves for a piece
function highlightMoves(row, col) {
    clearHighlights();
    const square = `${String.fromCharCode(97 + col)}${8 - row}`;
    const moves = chess.moves({ square: square, verbose: true });

    moves.forEach(move => {
        const targetRow = 8 - parseInt(move.to[1]);
        const targetCol = move.to.charCodeAt(0) - 97;
        const squareDiv = document.querySelector(`[data-row='${targetRow}'][data-col='${targetCol}']`);
        if (squareDiv) squareDiv.classList.add("highlight");
    });
}

function clearHighlights() {
    document.querySelectorAll(".highlight").forEach(square => {
        square.classList.remove("highlight");
    });
}

function highlightLastMove(move) {
    clearLastMove();
    if (!move || !move.from || !move.to) return;

    const fromCol = move.from.charCodeAt(0) - 97;
    const fromRow = 8 - parseInt(move.from[1]);
    const toCol = move.to.charCodeAt(0) - 97;
    const toRow = 8 - parseInt(move.to[1]);

    const fromSquare = document.querySelector(`[data-row='${fromRow}'][data-col='${fromCol}']`);
    const toSquare = document.querySelector(`[data-row='${toRow}'][data-col='${toCol}']`);

    if (fromSquare) fromSquare.classList.add("last-move");
    if (toSquare) toSquare.classList.add("last-move");
}

function clearLastMove() {
    document.querySelectorAll(".last-move").forEach(sq => {
        sq.classList.remove("last-move");
    });
}

const handleMove = (source, target) => {
    const move = {
        from: `${String.fromCharCode(97 + source.col)}${8 - source.row}`,
        to: `${String.fromCharCode(97 + target.col)}${8 - target.row}`,
        promotion: 'q'
    };
    socket.emit("move", move);
};

// Socket Listeners
socket.on("playerRole", function(role) {
    playerRole = role;
    playerInfo.innerHTML = role === "w" ? "<span>♔</span> You are White" : "<span>♚</span> You are Black";
    renderBoard();
});

socket.on("spectatorRole", function() {
    playerRole = null;
    playerInfo.innerHTML = "<span>👀</span> You are Spectating";
    renderBoard();
});

socket.on("turn", function(turn) {
    turnIndicator.innerText = turn === "w" ? "Turn: White" : "Turn: Black";
});

socket.on("gameStatus", function(status) {
    gameStatus.innerText = status || "";
});

socket.on("boardState", function(fen) {
    chess.load(fen);
    renderBoard();
});

socket.on("lastMove", function(move) {
    chess.move(move);
    renderBoard();
    highlightLastMove(move);
    if (moveSound) {
        moveSound.currentTime = 0;
        moveSound.play().catch(() => {});
    }
});

socket.on("playerLeft", function(msg) {
    gameStatus.innerText = msg;
});

restartBtn.addEventListener("click", function() {
    socket.emit("restartGame");
});

// Initial Render
renderBoard();
