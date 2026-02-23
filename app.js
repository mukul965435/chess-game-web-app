const express = require('express');
const socket = require("socket.io")
const http = require("http");
const {Chess} = require("chess.js")
const path = require('path');

const app = express();

const server = http.createServer(app);
const io = socket(server);
 
const chess = new Chess();

let players = {};
let currentPlayer = 'W';
 
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname,'public')));

app.get('/', (req, res) => {
    res.render('index', {title: 'Chess Game'});
});




//main io socket section


io.on("connection", function(uniquesocket){
    console.log("Connected")  

    if(!players.white){
        players.white = uniquesocket.id;
        uniquesocket.emit("playerRole", "w")
    }
    else if(!players.black){
        players.black = uniquesocket.id;
        uniquesocket.emit("playerRole", "b")
    }

    else{
        uniquesocket.emit("spectatorRole")
    }

    uniquesocket.on("disconnect", function(){
        if(uniquesocket.id === players.white){
            delete players.white;
        }
        else if(uniquesocket.id === players.black){
            delete players.black;
        }
    });

    
// Track if game is over
let gameOver = false;

uniquesocket.on("move", (move) => {
    try {

        // ❌ If game already ended → ignore moves
        if (gameOver) return;

        // ✅ Only allow correct player to move
        // chess.turn() tells whose turn it is ("w" or "b")
        if (chess.turn() === "w" && uniquesocket.id !== players.white) return;
        if (chess.turn() === "b" && uniquesocket.id !== players.black) return;

        // Try to make move using chess.js
        const result = chess.move(move);

        // If move is valid
        if (result) {

            // Send move to all clients
            io.emit("lastMove", move);

            // Send updated board state (FEN string)
            io.emit("boardState", chess.fen());

            // 🟢 Check game conditions after every move

            if (chess.inCheck()) {
                io.emit("gameStatus", "Check!");
            }

            if (chess.inCheckmate()) {
                gameOver = true;  // Stop further moves
                io.emit("gameStatus", "Checkmate!");
            }

            if (chess.inDraw()) {
                gameOver = true;
                io.emit("gameStatus", "Draw!");
            }

            // Send whose turn it is
            io.emit("turn", chess.turn());
        }

        else {
            uniquesocket.emit("invalidMove", move);
        }

    } catch (err) {
        console.log(err);
        uniquesocket.emit("invalidMove", move);
    }
});

    
// Restart game
uniquesocket.on("restartGame", () => {

    // Reset chess board to starting position
    chess.reset();

    // Allow moves again
    gameOver = false;

    // Send fresh board state
    io.emit("boardState", chess.fen());

    // Clear status
    io.emit("gameStatus", "Game Restarted");

    // Reset turn to white
    io.emit("turn", chess.turn());
});

    
});    

server.listen(3000, () => {
    console.log('Server is running on port 3000');
}   );


