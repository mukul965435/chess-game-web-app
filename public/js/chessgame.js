// const { render } = require("ejs");

const socket = io();
const chess = new Chess();
const boardElement = document.querySelector(".chessboard")
//GPT 
const playerInfo = document.getElementById("playerInfo");
const turnIndicator = document.getElementById("turnIndicator");
const gameStatus = document.getElementById("gameStatus");
const restartBtn = document.getElementById("restartBtn");
//GPT

// let draggedPiece = null;
// let sourceSquare = null;
let playerRole = null;

let selectedSquare = null;   // Track currently selected square


// SOUND
const moveSound = document.getElementById("moveSound");



// RENDER BOARD 
const renderBoard = ()=>{
   const board = chess.board();
   boardElement.innerHTML= "";
   board.forEach((row, rowindex)=>{
    row.forEach((square, squareindex)=>{
                const squareElement = document.createElement("div");
                squareElement.classList.add("square",
                    (rowindex + squareindex) % 2 ===0 ? "light" : "dark"
                );
                squareElement.dataset.row = rowindex;
                squareElement.dataset.col = squareindex;


                if(square){
                    const pieceElement = document.createElement("div");
                    pieceElement.classList.add(
                        "piece", 
                        square.color==="w" ? "white" : "black"
                    );
                    pieceElement.innerText=getPieceUnicode(square);


                                // 🟢 CLICK TO SELECT PIECE
                                pieceElement.addEventListener("click", (e) => {

                                    e.stopPropagation(); // Prevent square click firing
                                
                                    if (square.color !== playerRole) return;
                                
                                    selectedSquare = {
                                        row: rowindex,
                                        col: squareindex
                                    };
                                
                                    highlightMoves(rowindex, squareindex);
                                });
                                

                    squareElement.appendChild(pieceElement);  
                }

                squareElement.addEventListener("click", function () {

                    // If no piece selected → do nothing
                    if (!selectedSquare) return;
                
                    const targetSquare = {
                        row: parseInt(squareElement.dataset.row),
                        col: parseInt(squareElement.dataset.col)
                    };
                
                    handleMove(selectedSquare, targetSquare);
                
                    selectedSquare = null;
                    clearHighlights();
                });
                

            
                boardElement.appendChild(squareElement)
   });
   });

   if(playerRole === 'b'){
    boardElement.classList.add("flipped")
   }
   else{
        boardElement.classList.remove("flipped")
   }

};
//RENDERBOARD END 


function highlightMoves(row, col) {

    // Clear old highlights
    clearHighlights();

    // Convert board position to chess notation (e.g. e2)
    const square = `${String.fromCharCode(97 + col)}${8 - row}`;

    // Get all legal moves for this square
    const moves = chess.moves({
        square: square,
        verbose: true   // verbose gives detailed move info
    });

    moves.forEach(move => {

        const targetRow = 8 - parseInt(move.to[1]);
        const targetCol = move.to.charCodeAt(0) - 97;

        const squareDiv = document.querySelector(
            `[data-row='${targetRow}'][data-col='${targetCol}']`
        );

        // Add highlight class
        squareDiv.classList.add("highlight");
    });
}



function clearHighlights() {
    document.querySelectorAll(".highlight").forEach(square => {
        square.classList.remove("highlight");
    });
}






const handleMove = (source, target)=>{
    const move = {
        from:  `${String.fromCharCode(97+source.col)}${8-source.row}`,
        to:  `${String.fromCharCode(97+target.col)}${8-target.row}`,
        promotion: 'q'
    };  

    socket.emit("move", move)
};
const getPieceUnicode = (piece)=>{
    const unicodePieces =  {
        p:"♙",
        r:"♜",
        n:"♞",
        b:"♝",
        q:"♕",
        k:"♔",
        P:"♟",
        R:"♖",
        N:"♘",
        B:"♗",
        Q:"♛", 
        K:"♔",
    }
    return unicodePieces[piece.type] || "";
}



socket.on("playerRole", function(role){
    playerRole = role;

    // Show which color player got
    playerInfo.innerText = role === "w" 
        ? "You are White ♔"
        : "You are Black ♚";

    renderBoard();
});


socket.on("turn", function(turn){

    // Update UI showing whose turn it is
    turnIndicator.innerText = turn === "w"
        ? "Turn: White"
        : "Turn: Black";
});


socket.on("gameStatus", function(status){

    // Show check, checkmate, draw etc
    gameStatus.innerText = status;
});


restartBtn.addEventListener("click", function(){
    socket.emit("restartGame");
});




socket.on("spectatorRole", function(){
    playerRole = null;
    renderBoard();
});

socket.on("boardState", function(fen){
     chess.load(fen);
     renderBoard();
})


// 🔵 Listen for last move from server
socket.on("lastMove", function(move){

    chess.move(move);     // Update local chess board
    renderBoard();        // Re-render UI
    highlightLastMove(move); // Highlight from & to squares
    moveSound.play();           //SOUND

});







function clearLastMove(){
    document.querySelectorAll(".last-move").forEach(sq=>{
        sq.classList.remove("last-move");
    });
}



renderBoard();

