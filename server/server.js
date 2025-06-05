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
    const { roomId, action, gameData, actionId } = data
    const room = gameRooms[roomId]

    if (!room) {
      console.log(`❌ Room not found for game action: ${roomId}`)
      return
    }

    // Check for duplicate actions (prevents double processing)
    if (actionId && isDuplicateAction(roomId, actionId)) {
      console.log(`⚠️ Duplicate action detected, ignoring: ${action} (${actionId})`)
      socket.emit("action-confirmed", { action, actionId })
      return
    }

    // Log this action
    const loggedActionId = logAction(roomId, action, playerSockets[socket.id]?.playerId)

    console.log(`🎮 Game action in ${room.name}: ${action} from ${playerSockets[socket.id]?.playerName}`)
    room.lastActivity = Date.now()

    // Update room game state if provided
    if (gameData) {
      room.gameState = { ...room.gameState, ...gameData }
    }

    // Broadcast game action to ALL players in room INCLUDING sender
    // This ensures consistent state across all clients
    const gameUpdate = {
      action,
      data: gameData,
      playerId: playerSockets[socket.id]?.playerId,
      playerName: playerSockets[socket.id]?.playerName,
      timestamp: Date.now(),
      actionId: loggedActionId,
    }

    console.log(`📡 Broadcasting to room ${roomId}:`, action)

    // Send to all players in the room
    io.to(roomId).emit("game-update", gameUpdate)

    // Also send confirmation back to sender
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
