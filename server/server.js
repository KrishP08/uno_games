const express = require("express")
const http = require("http")
const { Server } = require("socket.io")
const cors = require("cors")

const app = express()
const server = http.createServer(app)

// Configure CORS for production
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*", // Will be set in Render
    methods: ["GET", "POST"],
    credentials: false,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

app.use(cors())
app.use(express.json())

const gameRooms = {}
const playerSockets = {}
const actionLog = {}

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    status: "UNO Game Server is running!",
    timestamp: new Date().toISOString(),
    activeRooms: Object.keys(gameRooms).length,
    activePlayers: Object.keys(playerSockets).length,
  })
})

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" })
})

// Helper functions (assuming they exist, e.g., generateRoomCode, cleanupRoom, logAction, isDuplicateAction)
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (Object.values(gameRooms).some((room) => room.code === code));
  return code;
}

function cleanupRoom(roomId) {
  if (gameRooms[roomId] && gameRooms[roomId].players.length === 0) {
    delete gameRooms[roomId];
    console.log(`🗑️ Cleaned up empty room: ${roomId}`);
  }
}

function logAction(roomId, action, playerId) {
  if (!actionLog[roomId]) {
    actionLog[roomId] = [];
  }
  const actionEntry = { action, playerId, timestamp: Date.now(), id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}` };
  actionLog[roomId].push(actionEntry);
  if (actionLog[roomId].length > 100) {
    actionLog[roomId] = actionLog[roomId].slice(-100);
  }
  return actionEntry.id;
}

function isDuplicateAction(roomId, actionId) {
  if (!actionLog[roomId]) return false;
  return actionLog[roomId].some((entry) => entry.id === actionId);
}


io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`)

  // ... (other socket event handlers like get-rooms, create-room, join-room, leave-room) ...
  // Placeholder for other handlers for brevity in this example
  socket.on("get-rooms", () => {
    const roomList = Object.values(gameRooms).map((room) => ({
      id: room.id, name: room.name, code: room.code, maxPlayers: room.maxPlayers,
      players: room.players, host: room.host, settings: room.settings,
      gameStarted: room.gameStarted || false,
    }));
    socket.emit("room-list", roomList);
  });

  socket.on("create-room", (data) => {
    const { name, maxPlayers, pointsToWin, stackingEnabled, unlimitedDrawEnabled, forcePlayEnabled, jumpInEnabled, playerId, playerName } = data;
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const roomCode = generateRoomCode();
    const newRoom = {
      id: roomId, name, code: roomCode, maxPlayers,
      players: [{ id: playerId, name: playerName, socketId: socket.id }],
      host: playerId,
      settings: { pointsToWin: pointsToWin || 500, stackingEnabled: stackingEnabled || false, unlimitedDrawEnabled: unlimitedDrawEnabled || false, forcePlayEnabled: forcePlayEnabled || false, jumpInEnabled: jumpInEnabled || false },
      gameStarted: false, createdAt: Date.now(), lastActivity: Date.now(),
    };
    gameRooms[roomId] = newRoom;
    playerSockets[socket.id] = { playerId, playerName, roomId };
    socket.join(roomId);
    console.log(`🏠 Room created: ${name} (${roomCode}) by ${playerName}`);
    socket.emit("room-created", newRoom);
    io.emit("room-list", Object.values(gameRooms));
  });

  socket.on("join-room", (data) => {
    const { roomId, roomCode, playerId, playerName } = data;
    let room = gameRooms[roomId];
    if (!room && roomCode) room = Object.values(gameRooms).find((r) => r.code === roomCode.toUpperCase());
    if (!room) { socket.emit("join-error", { message: "Room not found" }); return; }
    if (room.players.length >= room.maxPlayers) { socket.emit("join-error", { message: "Room is full" }); return; }
    if (room.players.some((p) => p.id === playerId)) { socket.emit("join-error", { message: "You are already in this room" }); return; }
    if (room.players.some((p) => p.name === playerName)) { socket.emit("join-error", { message: "Name already taken" }); return; }
    const player = { id: playerId, name: playerName, socketId: socket.id };
    room.players.push(player);
    playerSockets[socket.id] = { playerId, playerName, roomId: room.id };
    room.lastActivity = Date.now();
    socket.join(room.id);
    console.log(`👋 ${playerName} joined room: ${room.name}`);
    socket.emit("room-joined", room);
    socket.to(room.id).emit("player-joined", { player, room });
    io.emit("room-list", Object.values(gameRooms));
  });

  socket.on("leave-room", (data) => {
    const { roomId, playerId } = data;
    const room = gameRooms[roomId];
    if (!room) return;
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) return;
    const player = room.players[playerIndex];
    room.players.splice(playerIndex, 1);
    room.lastActivity = Date.now();
    socket.leave(roomId);
    delete playerSockets[socket.id];
    console.log(`👋 ${player.name} left room: ${room.name}`);
    if (room.players.length === 0) {
      cleanupRoom(roomId);
    } else {
      if (room.host === playerId) room.host = room.players[0].id;
      socket.to(roomId).emit("player-left", { player, room });
    }
    io.emit("room-list", Object.values(gameRooms));
  });

  socket.on("game-action", (data) => {
    const { roomId, action } = data; // gameData removed for brevity
    const room = gameRooms[roomId];
    if (!room) { console.log(`❌ Room not found for game action: ${roomId}`); return; }
    if (data.actionId && isDuplicateAction(roomId, data.actionId)) {
      socket.emit("action-confirmed", { action, actionId: data.actionId }); return;
    }
    const loggedActionId = logAction(roomId, action, playerSockets[socket.id]?.playerId);
    console.log(`🎮 Game action in ${room.name}: ${action} from ${playerSockets[socket.id]?.playerName}`);
    room.lastActivity = Date.now();

    let updatedGameState = room.gameState ? JSON.parse(JSON.stringify(room.gameState)) : {};
    const playedCard = data.data && data.data.playedCard;
    const currentPlayerId = playerSockets[socket.id]?.playerId;

    if (action === "play-card" && playedCard && room.gameState) {
      const playerInfo = playerSockets[socket.id];
      let currentPlayerIndex = -1;
      if (playerInfo) currentPlayerIndex = updatedGameState.players.findIndex(p => p.id === playerInfo.playerId);
      if (currentPlayerIndex === -1) { console.error("Player not found for game action"); return; }

      const playerHand = updatedGameState.players[currentPlayerIndex].hand;
      const cardIndexInHand = playerHand.findIndex(card => card.id === playedCard.id );
      if (cardIndexInHand === -1) { socket.emit("play-error", { message: "Invalid card: Card not in hand." }); return; }

      const actualPlayedCard = playerHand.splice(cardIndexInHand, 1)[0];
      updatedGameState.discardPile.push(actualPlayedCard);
      updatedGameState.lastPlayedCard = { ...actualPlayedCard };

      if (actualPlayedCard.color !== "WILD") {
        updatedGameState.currentColor = actualPlayedCard.color;
      }
      if (actualPlayedCard.type === "WILD" || actualPlayedCard.type === "WILD_DRAW_FOUR") {
        if (data.data.chosenColor) updatedGameState.currentColor = data.data.chosenColor;
        else updatedGameState.currentColor = "RED"; // Default
      }

      const numPlayers = updatedGameState.players.length;
      let nextPlayerIndex = (currentPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;

      // Simplified action logic from previous implementation
      if (actualPlayedCard.type === "DRAW_TWO") {
        const targetPlayerForDraw = updatedGameState.players[nextPlayerIndex];
        for (let i = 0; i < 2; i++) { if (updatedGameState.deck.length > 0) targetPlayerForDraw.hand.push(updatedGameState.deck.pop()); else break; } // Simplified deck logic
        updatedGameState.currentPlayerIndex = (nextPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;
      } else if (actualPlayedCard.type === "WILD_DRAW_FOUR") {
        const targetPlayerForDraw = updatedGameState.players[nextPlayerIndex];
        for (let i = 0; i < 4; i++) { if (updatedGameState.deck.length > 0) targetPlayerForDraw.hand.push(updatedGameState.deck.pop()); else break; }
        updatedGameState.currentPlayerIndex = (nextPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;
      } else if (actualPlayedCard.type === "SKIP") {
        updatedGameState.currentPlayerIndex = (nextPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;
      } else if (actualPlayedCard.type === "REVERSE") {
        updatedGameState.isReversed = !updatedGameState.isReversed;
        if (numPlayers === 2) updatedGameState.currentPlayerIndex = currentPlayerIndex;
        else updatedGameState.currentPlayerIndex = (currentPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;
      } else if (actualPlayedCard.type === "WILD") {
        updatedGameState.currentPlayerIndex = nextPlayerIndex;
      } else { // Regular card
        updatedGameState.currentPlayerIndex = nextPlayerIndex;
      }
      room.gameState = updatedGameState;
    } else if (action === "draw-card" && room.gameState && playerSockets[socket.id]) {
      // Simplified draw card logic
      const playerInfo = playerSockets[socket.id];
      const drawingPlayerIndex = updatedGameState.players.findIndex(p => p.id === playerInfo.playerId);
      if (drawingPlayerIndex !== -1 && updatedGameState.deck.length > 0) {
        const drawnCard = updatedGameState.deck.pop();
        updatedGameState.players[drawingPlayerIndex].hand.push(drawnCard);
        if (data.data && data.data.passTurn === true) {
           updatedGameState.currentPlayerIndex = (drawingPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + updatedGameState.players.length) % updatedGameState.players.length;
        }
      }
      room.gameState = updatedGameState;
    } else if (data.data) {
        room.gameState = { ...room.gameState, ...data.data };
        updatedGameState = room.gameState;
    }

    const gameUpdate = {
      action, data: updatedGameState, playerId: currentPlayerId,
      playerName: playerSockets[socket.id]?.playerName, timestamp: Date.now(), actionId: loggedActionId,
    };
    io.to(roomId).emit("game-update", gameUpdate);
    socket.emit("action-confirmed", { action, actionId: loggedActionId });
  });

  socket.on("start-game", (data) => {
    const { roomId } = data;
    const room = gameRooms[roomId];
    if (!room) { socket.emit("start-game-error", { message: "Room not found" }); return; }
    if (room.gameStarted) { socket.emit("start-game-error", { message: "Game already started" }); return; }
    const playerInfo = playerSockets[socket.id];
    if (!playerInfo || room.host !== playerInfo.playerId) { socket.emit("start-game-error", { message: "Only host can start" }); return; }
    if (room.players.length < 2) { socket.emit("start-game-error", { message: "Need at least 2 players" }); return; }
    room.gameStarted = true;
    room.lastActivity = Date.now();
    // Initialize gameState if provided by client on start, or server initializes it
    if (data.gameState) {
        room.gameState = data.gameState;
    } else {
        // TODO: Server should initialize game state here if not provided
    }
    console.log(`🎮 Game started in room: ${room.name}`);
    io.to(roomId).emit("game-started", { room, gameState: room.gameState });
    io.emit("room-list", Object.values(gameRooms));
  });

  socket.on("action-confirmed", (data) => {
    console.log(`✅ Action confirmed by client: ${data.action}`);
  });

  socket.on("disconnect", () => {
    console.log(`🔌 User disconnected: ${socket.id}`);
    const playerInfo = playerSockets[socket.id];
    if (playerInfo) {
      const { playerId, playerName, roomId } = playerInfo;
      const room = gameRooms[roomId];
      if (room) {
        const playerIndex = room.players.findIndex((p) => p.id === playerId);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          room.players.splice(playerIndex, 1);
          room.lastActivity = Date.now();
          console.log(`👋 ${playerName} disconnected from room: ${room.name}`);
          if (room.players.length === 0) {
            cleanupRoom(roomId);
          } else {
            if (room.host === playerId) room.host = room.players[0].id;
            socket.to(roomId).emit("player-left", { player, room });
          }
          io.emit("room-list", Object.values(gameRooms));
        }
      }
      delete playerSockets[socket.id];
    }
  });

  // Handler for full game state request - THIS IS CORRECTLY PLACED NOW
  socket.on("request-full-game-state", ({ roomId }) => {
    const room = gameRooms[roomId]
    const playerInfo = playerSockets[socket.id]

    if (room && room.gameState) {
      if (playerInfo && room.players.some(p => p.id === playerInfo.playerId)) {
        console.log(`📤 Sending full game state to ${playerInfo.playerName} (${socket.id}) for room ${roomId}`)
        socket.emit("full-game-state", { gameState: room.gameState })
      } else {
        console.warn(`⚠️ User ${socket.id} (Player ID: ${playerInfo?.playerId}) requested game state for room ${roomId} but is not in it or room has no game state.`)
        socket.emit("game-state-error", { message: "You are not part of this game or game state is unavailable." })
      }
    } else {
      console.warn(`⚠️ Full game state requested for non-existent room or game: ${roomId}`)
      socket.emit("game-state-error", { message: "Game state not found." })
    }
  })
}) // End of io.on("connection")

// Cleanup old rooms periodically
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    const now = Date.now();
    const roomsToDelete = [];
    Object.entries(gameRooms).forEach(([roomId, room]) => {
      if (now - (room.lastActivity || room.createdAt) > 2 * 60 * 60 * 1000) {
        roomsToDelete.push(roomId);
      }
    });
    roomsToDelete.forEach((roomId) => {
      delete gameRooms[roomId];
      console.log(`🗑️ Cleaned up old room: ${roomId}`);
    });
    if (roomsToDelete.length > 0) {
      io.emit("room-list", Object.values(gameRooms));
    }
  }, 30 * 60 * 1000);
}

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 UNO Game Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready for connections`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  });
}

// For testing purposes
if (process.env.NODE_ENV === 'test') {
  module.exports = {
    gameRooms,
    playerSockets,
    io, // Expose the actual io instance for more granular testing if needed
  };
}
