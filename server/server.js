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
  // Increase ping timeout for better connection stability
  pingTimeout: 60000,
  // Reduce ping interval for faster disconnect detection
  pingInterval: 25000,
})

app.use(cors())
app.use(express.json())

// Health check endpoint (important for Render)
app.get("/", (req, res) => {
  res.json({
    status: "UNO Game Server is running!",
    timestamp: new Date().toISOString(),
    activeRooms: Object.keys(gameRooms).length,
    activePlayers: Object.keys(playerSockets).length,
  })
})

// Health check for Render
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy" })
})

// Store game rooms and players
const gameRooms = {}
const playerSockets = {}
const actionLog = {} // Track recent actions to prevent duplicates

// Helper function to generate room codes
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  do {
    code = ""
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
  } while (Object.values(gameRooms).some((room) => room.code === code))
  return code
}

// Helper function to clean up empty rooms
function cleanupRoom(roomId) {
  if (gameRooms[roomId] && gameRooms[roomId].players.length === 0) {
    delete gameRooms[roomId]
    console.log(`🗑️ Cleaned up empty room: ${roomId}`)
  }
}

// Helper function to log and track actions
function logAction(roomId, action, playerId) {
  if (!actionLog[roomId]) {
    actionLog[roomId] = []
  }

  const actionEntry = {
    action,
    playerId,
    timestamp: Date.now(),
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  }

  actionLog[roomId].push(actionEntry)

  // Keep only the last 100 actions
  if (actionLog[roomId].length > 100) {
    actionLog[roomId] = actionLog[roomId].slice(-100)
  }

  return actionEntry.id
}

// Helper function to check if an action is a duplicate
function isDuplicateAction(roomId, actionId) {
  if (!actionLog[roomId]) return false
  return actionLog[roomId].some((entry) => entry.id === actionId)
}

io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`)

  // Handle getting room list
  socket.on("get-rooms", () => {
    const roomList = Object.values(gameRooms).map((room) => ({
      id: room.id,
      name: room.name,
      code: room.code,
      maxPlayers: room.maxPlayers,
      players: room.players,
      host: room.host,
      settings: room.settings,
      gameStarted: room.gameStarted || false,
    }))
    socket.emit("room-list", roomList)
  })

  // Handle creating a room
  socket.on("create-room", (data) => {
    const {
      name,
      maxPlayers,
      pointsToWin,
      stackingEnabled,
      unlimitedDrawEnabled,
      forcePlayEnabled,
      jumpInEnabled,
      playerId,
      playerName,
    } = data

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    const roomCode = generateRoomCode()

    const newRoom = {
      id: roomId,
      name,
      code: roomCode,
      maxPlayers,
      players: [
        {
          id: playerId,
          name: playerName,
          socketId: socket.id,
        },
      ],
      host: playerId,
      settings: {
        pointsToWin: pointsToWin || 500,
        stackingEnabled: stackingEnabled || false,
        unlimitedDrawEnabled: unlimitedDrawEnabled || false,
        forcePlayEnabled: forcePlayEnabled || false,
        jumpInEnabled: jumpInEnabled || false,
      },
      gameStarted: false,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    }

    gameRooms[roomId] = newRoom
    playerSockets[socket.id] = { playerId, playerName, roomId }

    socket.join(roomId)

    console.log(`🏠 Room created: ${name} (${roomCode}) by ${playerName} with rules:`, newRoom.settings)

    // Send room created confirmation
    socket.emit("room-created", newRoom)

    // Broadcast updated room list to all clients
    io.emit("room-list", Object.values(gameRooms))
  })

  // Handle joining a room
  socket.on("join-room", (data) => {
    const { roomId, roomCode, playerId, playerName } = data

    // Find room by ID or code
    let room = gameRooms[roomId]
    if (!room && roomCode) {
      room = Object.values(gameRooms).find((r) => r.code === roomCode.toUpperCase())
    }

    if (!room) {
      socket.emit("join-error", { message: "Room not found" })
      return
    }

    // Check if room is full
    if (room.players.length >= room.maxPlayers) {
      socket.emit("join-error", { message: "Room is full" })
      return
    }

    // Check if player is already in room
    if (room.players.some((p) => p.id === playerId)) {
      socket.emit("join-error", { message: "You are already in this room" })
      return
    }

    // Check if name is taken
    if (room.players.some((p) => p.name === playerName)) {
      socket.emit("join-error", { message: "Name already taken in this room" })
      return
    }

    // Add player to room
    const player = {
      id: playerId,
      name: playerName,
      socketId: socket.id,
    }

    room.players.push(player)
    playerSockets[socket.id] = { playerId, playerName, roomId: room.id }
    room.lastActivity = Date.now()

    socket.join(room.id)

    console.log(`👋 ${playerName} joined room: ${room.name}`)

    // Send join confirmation
    socket.emit("room-joined", room)

    // Notify other players in the room
    socket.to(room.id).emit("player-joined", { player, room })

    // Broadcast updated room list
    io.emit("room-list", Object.values(gameRooms))
  })

  // Handle leaving a room
  socket.on("leave-room", (data) => {
    const { roomId, playerId } = data
    const room = gameRooms[roomId]

    if (!room) return

    // Remove player from room
    const playerIndex = room.players.findIndex((p) => p.id === playerId)
    if (playerIndex === -1) return

    const player = room.players[playerIndex]
    room.players.splice(playerIndex, 1)
    room.lastActivity = Date.now()

    socket.leave(roomId)
    delete playerSockets[socket.id]

    console.log(`👋 ${player.name} left room: ${room.name}`)

    // If room is empty, delete it
    if (room.players.length === 0) {
      cleanupRoom(roomId)
    } else {
      // If host left, assign new host
      if (room.host === playerId) {
        room.host = room.players[0].id
      }

      // Notify other players
      socket.to(roomId).emit("player-left", { player, room })
    }

    // Broadcast updated room list
    io.emit("room-list", Object.values(gameRooms))
  })

  // Handle game actions (card plays, draws, etc.)
  socket.on("game-action", (data) => {
    const { roomId, action, gameData } = data
    const room = gameRooms[roomId]

    if (!room) {
      console.log(`❌ Room not found for game action: ${roomId}`)
      return
    }

    // Check for duplicate actions (prevents double processing)
    if (data.actionId && isDuplicateAction(roomId, data.actionId)) {
      console.log(`⚠️ Duplicate action detected, ignoring: ${action} (${data.actionId})`)
      socket.emit("action-confirmed", { action, actionId: data.actionId })
      return
    }

    // Log this action
    const loggedActionId = logAction(roomId, action, playerSockets[socket.id]?.playerId)

    console.log(`🎮 Game action in ${room.name}: ${action} from ${playerSockets[socket.id]?.playerName}`)
    room.lastActivity = Date.now()

    // Server-side game logic will be processed here
    let updatedGameState = room.gameState ? { ...room.gameState } : {};
    const playedCard = data.data && data.data.playedCard; // Card played by the client
    const currentPlayerId = playerSockets[socket.id]?.playerId;

    if (action === "play-card" && playedCard && room.gameState) {
      updatedGameState = JSON.parse(JSON.stringify(room.gameState)); // Deep copy

      // Find the current player index based on socket.id, then map to gameState.players
      const playerInfo = playerSockets[socket.id];
      let currentPlayerIndex = -1;
      if (playerInfo) {
        currentPlayerIndex = updatedGameState.players.findIndex(p => p.id === playerInfo.playerId);
      }

      if (currentPlayerIndex === -1) {
        console.error("Error: Could not find player in game state for game action");
        // Potentially emit an error back to the client
        return;
      }

      // Basic card play logic (remove card from hand, add to discard pile)
      // This might be redundant if client already updated its state, but server should verify/enforce
      // --- Server-Authoritative Card Play Logic ---
      // 1. Identify Player and Card
      const playerHand = updatedGameState.players[currentPlayerIndex].hand;
      // Ensure playedCard from client has enough info (id, type, color) for a unique match.
      // If card objects have unique IDs, matching by ID is best. Otherwise, match type, color, value.
      const cardIndexInHand = playerHand.findIndex(card => card.id === playedCard.id ); // Assuming card.id is unique and sent by client

      if (cardIndexInHand === -1) {
        console.error(`Error: Player ${updatedGameState.players[currentPlayerIndex].name} tried to play card not in hand:`, playedCard);
        socket.emit("play-error", { message: "Invalid card: Card not in hand." });
        return;
      }

      // 2. Move Card: Hand -> Discard Pile
      const actualPlayedCard = playerHand.splice(cardIndexInHand, 1)[0];
      updatedGameState.discardPile.push(actualPlayedCard);
      updatedGameState.lastPlayedCard = { ...actualPlayedCard }; // Store a copy

      // Update currentColor based on the played card if it's not a Wild card.
      // Wild card colors are set based on chosenColor.
      if (actualPlayedCard.color !== "WILD") {
        updatedGameState.currentColor = actualPlayedCard.color;
      }

      // Client might send its deck state if it had to draw before playing (e.g. draw, then play drawn card)
      // This is less common if server handles draws entirely.
      if (data.data.deck) {
          updatedGameState.deck = data.data.deck;
      }
      // chosenColor is expected from client for Wild cards
      if (actualPlayedCard.type === "WILD" || actualPlayedCard.type === "WILD_DRAW_FOUR") {
        if (data.data.chosenColor) {
            updatedGameState.currentColor = data.data.chosenColor;
        } else {
            console.error(`${actualPlayedCard.type} played without a chosenColor! Defaulting to RED.`);
            updatedGameState.currentColor = "RED"; // Defaulting as a fallback
            // It's better to enforce client sends this. Consider emitting an error.
        }
      }

      // 3. Determine Next Player (preliminary)
      const numPlayers = updatedGameState.players.length;
      let nextPlayerIndex = (currentPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;

      // 4. Apply Card-Specific Actions
      if (actualPlayedCard.type === "DRAW_TWO") {
        console.log(`Action: ${actualPlayedCard.type} by ${updatedGameState.players[currentPlayerIndex].name}. Target: ${updatedGameState.players[nextPlayerIndex].name}`);
        const targetPlayerForDraw = updatedGameState.players[nextPlayerIndex];
        for (let i = 0; i < 2; i++) {
          if (updatedGameState.deck.length > 0) {
            targetPlayerForDraw.hand.push(updatedGameState.deck.pop());
          } else {
            console.log("Deck empty, attempting to reshuffle for DRAW_TWO.");
            // Reshuffle logic: keep the very last played card on discard, move rest to deck
            const discardToReshuffle = updatedGameState.discardPile.slice(0, -1);
            if (discardToReshuffle.length > 0) {
                updatedGameState.deck = discardToReshuffle;
                updatedGameState.discardPile = [updatedGameState.discardPile.slice(-1)[0]]; // Keep last actual played card
                // Shuffle deck
                for (let j = updatedGameState.deck.length - 1; j > 0; j--) {
                    const k = Math.floor(Math.random() * (j + 1));
                    [updatedGameState.deck[j], updatedGameState.deck[k]] = [updatedGameState.deck[k], updatedGameState.deck[j]];
                }
                if (updatedGameState.deck.length > 0) {
                     targetPlayerForDraw.hand.push(updatedGameState.deck.pop());
                } else {
                    console.log("Deck still empty after reshuffle attempt during DRAW_TWO.");
                }
            } else {
                 console.log("Not enough cards in discard pile to reshuffle for DRAW_TWO.");
            }
          }
        }
        console.log(`${targetPlayerForDraw.name} draws 2 cards. Hand size: ${targetPlayerForDraw.hand.length}`);
        // Turn skips to the player AFTER the one who drew cards
        updatedGameState.currentPlayerIndex = (nextPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;

      } else if (actualPlayedCard.type === "WILD_DRAW_FOUR") {
        console.log(`Action: ${actualPlayedCard.type} by ${updatedGameState.players[currentPlayerIndex].name}. Target: ${updatedGameState.players[nextPlayerIndex].name}. Color: ${updatedGameState.currentColor}`);
        const targetPlayerForDraw = updatedGameState.players[nextPlayerIndex];
        for (let i = 0; i < 4; i++) {
           if (updatedGameState.deck.length > 0) {
            targetPlayerForDraw.hand.push(updatedGameState.deck.pop());
          } else {
            console.log("Deck empty, attempting to reshuffle for WILD_DRAW_FOUR.");
            const discardToReshuffle = updatedGameState.discardPile.slice(0, -1);
            if (discardToReshuffle.length > 0) {
                updatedGameState.deck = discardToReshuffle;
                updatedGameState.discardPile = [updatedGameState.discardPile.slice(-1)[0]];
                 for (let j = updatedGameState.deck.length - 1; j > 0; j--) {
                    const k = Math.floor(Math.random() * (j + 1));
                    [updatedGameState.deck[j], updatedGameState.deck[k]] = [updatedGameState.deck[k], updatedGameState.deck[j]];
                }
                if (updatedGameState.deck.length > 0) {
                     targetPlayerForDraw.hand.push(updatedGameState.deck.pop());
                } else {
                    console.log("Deck still empty after reshuffle attempt during WILD_DRAW_FOUR.");
                }
            } else {
                console.log("Not enough cards in discard pile to reshuffle for WILD_DRAW_FOUR.");
            }
          }
        }
        console.log(`${targetPlayerForDraw.name} draws 4 cards. Hand size: ${targetPlayerForDraw.hand.length}`);
        // Color is already set from chosenColor earlier
        // Turn skips to the player AFTER the one who drew cards
        updatedGameState.currentPlayerIndex = (nextPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;

      } else if (actualPlayedCard.type === "SKIP") {
        console.log(`Action: ${actualPlayedCard.type} by ${updatedGameState.players[currentPlayerIndex].name}. Player ${updatedGameState.players[nextPlayerIndex].name} is skipped.`);
        // Skip the next player, so advance the turn by one additional step
        updatedGameState.currentPlayerIndex = (nextPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;
        console.log(`New current player index: ${updatedGameState.currentPlayerIndex}`);

      } else if (actualPlayedCard.type === "REVERSE") {
        console.log(`Action: ${actualPlayedCard.type} by ${updatedGameState.players[currentPlayerIndex].name}.`);
        updatedGameState.isReversed = !updatedGameState.isReversed;
        console.log(`Play direction reversed. New direction: ${updatedGameState.isReversed ? "Counter-Clockwise" : "Clockwise"}`);
        if (numPlayers === 2) {
          // In a 2-player game, Reverse acts like a Skip. The player who played Reverse plays again.
          // So, the next player is effectively skipped.
          updatedGameState.currentPlayerIndex = currentPlayerIndex;
        } else {
          // Next player is now based on the new direction from the current player
          updatedGameState.currentPlayerIndex = (currentPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + numPlayers) % numPlayers;
        }
        console.log(`New current player index: ${updatedGameState.currentPlayerIndex}`);
      } else if (actualPlayedCard.type === "WILD") {
        console.log(`Action: ${actualPlayedCard.type} played by ${updatedGameState.players[currentPlayerIndex].name}`);
        if (data.data.chosenColor) {
            updatedGameState.currentColor = data.data.chosenColor;
            console.log(`Color chosen: ${data.data.chosenColor}`);
        } else {
            console.error("WILD card played without a chosenColor! Defaulting to Red.");
            updatedGameState.currentColor = "RED"; // Defaulting
        }
        updatedGameState.currentPlayerIndex = nextPlayerIndex;
      } else {
        // Regular number card
        updatedGameState.currentColor = actualPlayedCard.color;
        updatedGameState.currentPlayerIndex = nextPlayerIndex;
      }
      room.gameState = updatedGameState;
    } else if (action === "draw-card" && room.gameState && playerSockets[socket.id]) {
        updatedGameState = JSON.parse(JSON.stringify(room.gameState)); // Deep copy
        const playerInfo = playerSockets[socket.id];
        const drawingPlayerIndex = updatedGameState.players.findIndex(p => p.id === playerInfo.playerId);

        if (drawingPlayerIndex !== -1) {
            if (updatedGameState.deck.length > 0) {
                const drawnCard = updatedGameState.deck.pop();
                updatedGameState.players[drawingPlayerIndex].hand.push(drawnCard);
                console.log(`${updatedGameState.players[drawingPlayerIndex].name} drew a card: ${drawnCard.type} ${drawnCard.color}`);

                // Client is expected to send if the turn passes or not via data.data.passTurn (boolean)
                // Or client sends nextPlayerIndex directly if they know it.
                // For now, if 'passTurn' is true or nextPlayerIndex is explicitly set by client:
                if (data.data && data.data.passTurn === true) {
                   updatedGameState.currentPlayerIndex = (drawingPlayerIndex + (updatedGameState.isReversed ? -1 : 1) + updatedGameState.players.length) % updatedGameState.players.length;
                   console.log(`Turn passed to player index: ${updatedGameState.currentPlayerIndex}`);
                } else if (data.data && data.data.hasOwnProperty('nextPlayerIndex')) {
                   updatedGameState.currentPlayerIndex = data.data.nextPlayerIndex;
                }
                // If client doesn't specify, turn remains with the drawing player (they might play the drawn card)
                // This part needs to be robustly handled based on game rules (e.g. UNO "draw and play" or "draw and pass")

            } else {
                console.log("Deck is empty, cannot draw.");
                // Optionally emit an event to player if they can't draw
            }
        }
        room.gameState = updatedGameState;
    } else if (data.data) {
        // For other actions OR if gameState wasn't there OR if it's not a play-card/draw-card action handled above
        // This is a fallback to merge client data if no specific server logic applied.
        // It's important that play-card and draw-card actions are fully handled above to avoid this.
        room.gameState = { ...room.gameState, ...data.data };
        updatedGameState = room.gameState;
    }


    // Create the game update with complete data
    const gameUpdate = {
      action,
      data: updatedGameState, // Send the server-processed game state
      playerId: currentPlayerId,
      playerName: playerSockets[socket.id]?.playerName,
      timestamp: Date.now(),
      actionId: loggedActionId,
    }

    console.log(`📡 Broadcasting ${action} to room ${roomId}:`, gameUpdate)

    // Send to ALL players in the room INCLUDING sender for confirmation
    io.to(roomId).emit("game-update", gameUpdate)

    // Send confirmation back to sender
    socket.emit("action-confirmed", { action, actionId: loggedActionId })
  })

  // Handle starting a game
  socket.on("start-game", (data) => {
    const { roomId } = data
    const room = gameRooms[roomId]

    if (!room) {
      socket.emit("start-game-error", { message: "Room not found" })
      return
    }

    // Check if game is already started
    if (room.gameStarted) {
      socket.emit("start-game-error", { message: "Game already started" })
      return
    }

    // Check if player is the host
    const playerInfo = playerSockets[socket.id]
    if (!playerInfo || room.host !== playerInfo.playerId) {
      socket.emit("start-game-error", { message: "Only the host can start the game" })
      return
    }

    // Check if we have enough players
    if (room.players.length < 2) {
      socket.emit("start-game-error", { message: "Need at least 2 players to start" })
      return
    }

    // Check if room is properly filled (for 4-player rooms, we can start with 2-4 players)
    if (room.players.length > room.maxPlayers) {
      socket.emit("start-game-error", { message: "Too many players in room" })
      return
    }

    room.gameStarted = true
    room.lastActivity = Date.now()

    console.log(`🎮 Game started in room: ${room.name} with ${room.players.length} players`)

    // Notify all players in room
    io.to(roomId).emit("game-started", {
      room,
      gameState: data.gameState,
    })

    // Broadcast updated room list
    io.emit("room-list", Object.values(gameRooms))
  })

  // Handle action confirmations
  socket.on("action-confirmed", (data) => {
    console.log(`✅ Action confirmed by client: ${data.action}`)
  })

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`🔌 User disconnected: ${socket.id}`)

    const playerInfo = playerSockets[socket.id]
    if (playerInfo) {
      const { playerId, playerName, roomId } = playerInfo
      const room = gameRooms[roomId]

      if (room) {
        // Remove player from room
        const playerIndex = room.players.findIndex((p) => p.id === playerId)
        if (playerIndex !== -1) {
          const player = room.players[playerIndex]
          room.players.splice(playerIndex, 1)
          room.lastActivity = Date.now()

          console.log(`👋 ${playerName} disconnected from room: ${room.name}`)

          // If room is empty, delete it
          if (room.players.length === 0) {
            cleanupRoom(roomId)
          } else {
            // If host disconnected, assign new host
            if (room.host === playerId) {
              room.host = room.players[0].id
            }

            // Notify other players
            socket.to(roomId).emit("player-left", { player, room })
          }

          // Broadcast updated room list
          io.emit("room-list", Object.values(gameRooms))
        }
      }

      delete playerSockets[socket.id]
    }
  })

  // Send initial room list when client connects
  const roomList = Object.values(gameRooms)
  socket.emit("room-list", roomList)
  })

  // Handle request for full game state
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

// Cleanup old rooms periodically (every 30 minutes)
setInterval(
  () => {
    const now = Date.now()
    const roomsToDelete = []

    Object.entries(gameRooms).forEach(([roomId, room]) => {
      // Remove rooms older than 2 hours with no activity
      if (now - (room.lastActivity || room.createdAt) > 2 * 60 * 60 * 1000) {
        roomsToDelete.push(roomId)
      }
    })

    roomsToDelete.forEach((roomId) => {
      delete gameRooms[roomId]
      console.log(`🗑️ Cleaned up old room: ${roomId}`)
    })

    if (roomsToDelete.length > 0) {
      io.emit("room-list", Object.values(gameRooms))
    }
  },
  30 * 60 * 1000,
)

// Use PORT from environment (Render provides this)
const PORT = process.env.PORT || 3001
server.listen(PORT, () => {
  console.log(`🚀 UNO Game Server running on port ${PORT}`)
  console.log(`📡 WebSocket server ready for connections`)
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
})
