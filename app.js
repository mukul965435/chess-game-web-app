const express = require('express');
const socket = require("socket.io");
const http = require("http");
const { Chess } = require("chess.js");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();

let players = {};
let gameOver = false;

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.render('index', { title: 'Online Chess Game' });
});

// Socket.io Connection Logic
io.on("connection", function(uniquesocket) {
    console.log("Client connected:", uniquesocket.id);

    // Assign player role (White, Black, or Spectator)
    if (!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit("playerRole", "w");
    } else if (!players.black) {
        players.black = uniquesocket.id;
        uniquesocket.emit("playerRole", "b");
    } else {
        uniquesocket.emit("spectatorRole");
    }

    // Sync board state & game status to newly connected client
    uniquesocket.emit("boardState", chess.fen());
    uniquesocket.emit("turn", chess.turn());

    if (chess.isCheckmate()) uniquesocket.emit("gameStatus", "Checkmate!");
    else if (chess.isCheck()) uniquesocket.emit("gameStatus", "Check!");
    else if (chess.isDraw()) uniquesocket.emit("gameStatus", "Draw!");

    // Handle Disconnect
    uniquesocket.on("disconnect", function() {
        console.log("Client disconnected:", uniquesocket.id);
        if (uniquesocket.id === players.white) {
            delete players.white;
            io.emit("playerLeft", "White player disconnected");
        } else if (uniquesocket.id === players.black) {
            delete players.black;
            io.emit("playerLeft", "Black player disconnected");
        }
    });

    // Handle Moves
    uniquesocket.on("move", (move) => {
        try {
            if (gameOver) return;

            // Enforce turn order
            if (chess.turn() === "w" && uniquesocket.id !== players.white) return;
            if (chess.turn() === "b" && uniquesocket.id !== players.black) return;

            const result = chess.move(move);

            if (result) {
                io.emit("lastMove", move);
                io.emit("boardState", chess.fen());

                if (chess.isCheckmate()) {
                    gameOver = true;
                    io.emit("gameStatus", "Checkmate!");
                } else if (chess.isCheck()) {
                    io.emit("gameStatus", "Check!");
                } else if (chess.isDraw()) {
                    gameOver = true;
                    io.emit("gameStatus", "Draw!");
                } else {
                    io.emit("gameStatus", "");
                }

                io.emit("turn", chess.turn());
            } else {
                uniquesocket.emit("invalidMove", move);
            }
        } catch (err) {
            console.error("Move error:", err);
            uniquesocket.emit("invalidMove", move);
        }
    });

    // Handle Game Restart
    uniquesocket.on("restartGame", () => {
        chess.reset();
        gameOver = false;
        io.emit("boardState", chess.fen());
        io.emit("gameStatus", "Game Restarted");
        io.emit("turn", chess.turn());
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Chess server running on port ${PORT}`);
});
