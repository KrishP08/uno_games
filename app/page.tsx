"use client"

import { useState, useEffect, useRef } from "react"
import { Lobby } from "@/components/lobby"
import { GameRoom } from "@/components/game-room"
import { GameModeSelect } from "@/components/game-mode-select"
import { SocketClient } from "@/lib/socket-client"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Wifi, WifiOff, AlertTriangle } from "lucide-react"

export default function UnoGame() {
  const [gameState, setGameState] = useState("mode-select")
  const [gameMode, setGameMode] = useState(null)
  const [currentRoom, setCurrentRoom] = useState(null)
  const [playerName, setPlayerName] = useState("")
  const [rooms, setRooms] = useState([])
  const [connectionStatus, setConnectionStatus] = useState("disconnected")
  const [statusMessage, setStatusMessage] = useState("")
  const [playerId] = useState(() => `player_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`)

  const socketClient = useRef<SocketClient | null>(null)

  // Initialize Socket.IO connection
  useEffect(() => {
    initializeSocket()

    return () => {
      if (socketClient.current) {
        socketClient.current.disconnect()
      }
    }
  }, [])

  const initializeSocket = async () => {
    setConnectionStatus("connecting")
    setStatusMessage("🔌 Connecting to UNO game server...")

    try {
      // Get server URL from environment variable or fallback
      const serverUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001"

      console.log("🔗 Connecting to server:", serverUrl)

      socketClient.current = new SocketClient(serverUrl)
      setupSocketHandlers()

      await socketClient.current.connect()

      setConnectionStatus("connected")
      setStatusMessage("✅ Connected to UNO multiplayer server!")

      // Get initial room list
      socketClient.current.getRooms()
    } catch (error) {
      console.error("❌ Failed to connect to server:", error)
      setConnectionStatus("failed")
      setStatusMessage("❌ Cannot connect to server. Using offline mode with AI players.")
      setupOfflineMode()
    }
  }

  const setupSocketHandlers = () => {
    if (!socketClient.current) return

    socketClient.current.on("room-list", (roomList) => {
      setRooms(roomList)
      console.log("📋 Received room list:", roomList)
    })

    socketClient.current.on("room-created", (room) => {
      setCurrentRoom(room)
      setGameState("room")
      setStatusMessage(`✅ Created room: ${room.name} (Code: ${room.code})`)
    })

    socketClient.current.on("room-joined", (room) => {
      setCurrentRoom(room)
      setGameState("room")
      setStatusMessage(`✅ Joined room: ${room.name}`)
    })

    socketClient.current.on("join-error", (error) => {
      setStatusMessage(`❌ ${error.message}`)
    })

    socketClient.current.on("player-joined", (data) => {
      console.log("👋 Player joined event:", data)
      if (currentRoom && currentRoom.id === data.room.id) {
        setCurrentRoom(data.room)
        setStatusMessage(`👋 ${data.player.name} joined the room!`)
      }
    })

    socketClient.current.on("player-left", (data) => {
      console.log("👋 Player left event:", data)
      if (currentRoom && currentRoom.id === data.room.id) {
        setCurrentRoom(data.room)
        setStatusMessage(`👋 ${data.player.name} left the room`)
      }
    })

    socketClient.current.on("game-update", (data) => {
      setStatusMessage(`🎮 Game update from ${data.playerName}`)
    })

    socketClient.current.on("game-started", (data) => {
      setStatusMessage(`🎮 Game started in ${data.room.name}!`)
    })
  }

  const setupOfflineMode = () => {
    // Set up demo rooms for offline play
    setRooms([
      {
        id: "offline-demo-1",
        name: "🤖 AI Challenge Room",
        code: "AI001",
        maxPlayers: 4,
        players: [
          { id: "ai-player-1", name: "Alex (AI)", isAI: true },
          { id: "ai-player-2", name: "Sam (AI)", isAI: true },
        ],
        host: "ai-player-1",
        settings: {
          pointsToWin: 500,
          stackingEnabled: true,
          unlimitedDrawEnabled: true,
          forcePlayEnabled: true,
          jumpInEnabled: false,
        },
        isOffline: true,
      },
    ])
  }

  const selectGameMode = (mode) => {
    setGameMode(mode)
    setGameState("lobby")
    setStatusMessage("")
  }

  const createRoom = (roomName, maxPlayers, pointsToWin, gameRules) => {
    if (socketClient.current && socketClient.current.isConnected()) {
      console.log("🏠 Creating room via Socket.IO")
      socketClient.current.createRoom({
        name: roomName,
        maxPlayers,
        pointsToWin,
        stackingEnabled: gameRules.stackingEnabled,
        unlimitedDrawEnabled: gameRules.unlimitedDrawEnabled,
        forcePlayEnabled: gameRules.forcePlayEnabled,
        jumpInEnabled: gameRules.jumpInEnabled,
        playerId,
        playerName,
      })
      setStatusMessage("Creating room... Please wait.")
    } else {
      console.log("🏠 Creating offline room")
      // Offline mode fallback
      const roomCode = generateRoomCode()
      const newRoom = {
        id: `offline-${Date.now()}`,
        name: roomName,
        code: roomCode,
        maxPlayers,
        players: [{ id: playerId, name: playerName }],
        host: playerId,
        settings: {
          pointsToWin,
          stackingEnabled: gameRules.stackingEnabled,
          unlimitedDrawEnabled: gameRules.unlimitedDrawEnabled,
          forcePlayEnabled: gameRules.forcePlayEnabled,
          jumpInEnabled: gameRules.jumpInEnabled,
        },
        isOffline: true,
      }

      setCurrentRoom(newRoom)
      setGameState("room")
      setStatusMessage(`✅ Created offline room: ${roomName} (Code: ${roomCode})`)
    }
  }

  const joinRoom = (roomId) => {
    if (socketClient.current && socketClient.current.isConnected()) {
      console.log("🚪 Joining room via Socket.IO:", roomId)
      socketClient.current.joinRoom({
        roomId,
        playerId,
        playerName,
      })
      setStatusMessage("Joining room... Please wait.")
    } else {
      // Offline mode fallback
      const room = rooms.find((r) => r.id === roomId)
      if (room) {
        const updatedRoom = {
          ...room,
          players: [...room.players, { id: playerId, name: playerName }],
        }
        setCurrentRoom(updatedRoom)
        setGameState("room")
        setStatusMessage(`✅ Joined offline room: ${room.name}`)
      }
    }
  }

  const joinRoomByCode = (code) => {
    if (socketClient.current && socketClient.current.isConnected()) {
      console.log("🔗 Joining room by code via Socket.IO:", code)
      socketClient.current.joinRoom({
        roomCode: code.toUpperCase(),
        playerId,
        playerName,
      })
      setStatusMessage("Joining room... Please wait.")
      return { success: true }
    } else {
      // Offline mode fallback
      const room = rooms.find((r) => r.code === code.toUpperCase())
      if (room) {
        joinRoom(room.id)
        return { success: true }
      } else {
        return { success: false, message: "Room not found in offline mode" }
      }
    }
  }

  const leaveRoom = () => {
    if (socketClient.current && socketClient.current.isConnected() && currentRoom) {
      socketClient.current.leaveRoom({
        roomId: currentRoom.id,
        playerId,
      })
    }

    setCurrentRoom(null)
    setGameState("lobby")
    setStatusMessage("✅ Left room")
  }

  const generateRoomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = ""
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const handleSetPlayerName = (name) => {
    setPlayerName(name)
  }

  const backToModeSelect = () => {
    setGameState("mode-select")
    setGameMode(null)
    setStatusMessage("")
  }

  const refreshRooms = () => {
    if (socketClient.current && socketClient.current.isConnected()) {
      socketClient.current.getRooms()
      setStatusMessage("🔄 Refreshing rooms...")
    } else {
      setStatusMessage("⚠️ Cannot refresh - server not connected")
    }
  }

  const createInstantMultiplayer = () => {
    const aiPlayers = [
      { id: "ai_1", name: "Alex (AI)", isAI: true },
      { id: "ai_2", name: "Sam (AI)", isAI: true },
      { id: "ai_3", name: "Jordan (AI)", isAI: true },
    ]

    const instantRoom = {
      id: `instant_${Date.now()}`,
      code: "INSTANT",
      name: "🚀 Instant Multiplayer",
      maxPlayers: 4,
      players: [{ id: playerId, name: playerName }, ...aiPlayers.slice(0, 2)],
      host: playerId,
      settings: {
        pointsToWin: 500,
        stackingEnabled: true,
        unlimitedDrawEnabled: true,
        forcePlayEnabled: true,
        jumpInEnabled: false,
      },
      isInstant: true,
    }

    setCurrentRoom(instantRoom)
    setGameState("room")
    setStatusMessage("🚀 Started instant multiplayer with AI players!")
  }

  const retryConnection = () => {
    setStatusMessage("🔄 Retrying connection...")
    initializeSocket()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-green-800 to-green-900">
      <h1 className="text-4xl font-bold text-white mb-6">UNO Game</h1>

      {/* Connection Status */}
      <Alert
        className={`w-full max-w-4xl mb-4 ${
          connectionStatus === "connected"
            ? "bg-green-100 border-green-300"
            : connectionStatus === "failed"
              ? "bg-red-100 border-red-300"
              : "bg-yellow-100 border-yellow-300"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {connectionStatus === "connected" ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : connectionStatus === "failed" ? (
              <WifiOff className="h-4 w-4 text-red-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            )}
            <AlertDescription
              className={
                connectionStatus === "connected"
                  ? "text-green-800"
                  : connectionStatus === "failed"
                    ? "text-red-800"
                    : "text-yellow-800"
              }
            >
              {connectionStatus === "connected" && "🟢 Real-time multiplayer active!"}
              {connectionStatus === "connecting" && "🟡 Connecting to server..."}
              {connectionStatus === "failed" && "🔴 Offline Mode - AI opponents available"}
            </AlertDescription>
          </div>
          {connectionStatus === "failed" && (
            <button
              onClick={retryConnection}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Retry
            </button>
          )}
        </div>
      </Alert>

      {statusMessage && (
        <div className="w-full max-w-4xl mb-4 p-3 bg-blue-600 text-white rounded-lg text-center animate-fade-in">
          {statusMessage}
        </div>
      )}

      {gameState === "mode-select" ? (
        <GameModeSelect onSelectMode={selectGameMode} />
      ) : gameState === "lobby" ? (
        <Lobby
          playerName={playerName}
          setPlayerName={handleSetPlayerName}
          rooms={rooms}
          onJoinRoom={joinRoom}
          onCreateRoom={createRoom}
          onJoinByCode={joinRoomByCode}
          gameMode={gameMode}
          onBackToModeSelect={backToModeSelect}
          onRefreshRooms={refreshRooms}
          onCreateInstantMultiplayer={createInstantMultiplayer}
          connectionStatus={connectionStatus}
        />
      ) : (
        <GameRoom
          room={currentRoom}
          playerName={playerName}
          playerId={playerId}
          onLeaveRoom={leaveRoom}
          gameMode={gameMode}
          socketClient={socketClient.current}
        />
      )}
    </div>
  )
}
