// Mock WebSocket server for development/demo
// In production, you'd replace this with a real WebSocket server

interface Room {
  id: string
  name: string
  code: string
  maxPlayers: number
  players: Player[]
  host: string
  gameState?: any
  settings: {
    pointsToWin: number
    stackingEnabled: boolean
  }
}

interface Player {
  id: string
  name: string
  socketId: string
}

class MockWebSocketServer {
  private rooms: Map<string, Room> = new Map()
  private clients: Map<string, any> = new Map()
  private port = 8080

  constructor() {
    // Simulate some existing rooms for demo
    this.createDemoRooms()
  }

  private createDemoRooms() {
    const demoRoom: Room = {
      id: "demo-room-1",
      name: "Demo Room",
      code: "DEMO01",
      maxPlayers: 4,
      players: [
        { id: "demo-player-1", name: "Alex", socketId: "demo-socket-1" },
        { id: "demo-player-2", name: "Sam", socketId: "demo-socket-2" },
      ],
      host: "demo-player-1",
      settings: {
        pointsToWin: 500,
        stackingEnabled: true,
      },
    }
    this.rooms.set(demoRoom.id, demoRoom)
  }

  handleConnection(client: any, clientId: string) {
    console.log(`🔌 Client connected: ${clientId}`)
    this.clients.set(clientId, client)

    // Send initial room list
    this.sendToClient(clientId, "ROOM_LIST", Array.from(this.rooms.values()))

    client.on("message", (data: string) => {
      try {
        const message = JSON.parse(data)
        this.handleMessage(clientId, message)
      } catch (error) {
        console.error("Failed to parse message:", error)
      }
    })

    client.on("close", () => {
      console.log(`🔌 Client disconnected: ${clientId}`)
      this.handleDisconnection(clientId)
    })
  }

  private handleMessage(clientId: string, message: any) {
    const { type, data } = message

    switch (type) {
      case "GET_ROOMS":
        this.sendToClient(clientId, "ROOM_LIST", Array.from(this.rooms.values()))
        break

      case "CREATE_ROOM":
        this.handleCreateRoom(clientId, data)
        break

      case "JOIN_ROOM":
        this.handleJoinRoom(clientId, data)
        break

      case "LEAVE_ROOM":
        this.handleLeaveRoom(clientId, data)
        break

      case "GAME_ACTION":
        this.handleGameAction(clientId, data)
        break

      default:
        console.log(`Unknown message type: ${type}`)
    }
  }

  private handleCreateRoom(clientId: string, data: any) {
    const roomCode = this.generateRoomCode()
    const room: Room = {
      id: `room-${Date.now()}`,
      name: data.name,
      code: roomCode,
      maxPlayers: data.maxPlayers,
      players: [
        {
          id: data.playerId,
          name: data.playerName,
          socketId: clientId,
        },
      ],
      host: data.playerId,
      settings: {
        pointsToWin: data.pointsToWin,
        stackingEnabled: data.stackingEnabled,
      },
    }

    this.rooms.set(room.id, room)

    // Send room created confirmation
    this.sendToClient(clientId, "ROOM_CREATED", room)

    // Broadcast updated room list
    this.broadcastRoomList()
  }

  private handleJoinRoom(clientId: string, data: any) {
    const room = this.findRoomByCode(data.roomCode) || this.rooms.get(data.roomId)

    if (!room) {
      this.sendToClient(clientId, "JOIN_ERROR", { message: "Room not found" })
      return
    }

    if (room.players.length >= room.maxPlayers) {
      this.sendToClient(clientId, "JOIN_ERROR", { message: "Room is full" })
      return
    }

    if (room.players.some((p) => p.name === data.playerName)) {
      this.sendToClient(clientId, "JOIN_ERROR", { message: "Name already taken" })
      return
    }

    const player: Player = {
      id: data.playerId,
      name: data.playerName,
      socketId: clientId,
    }

    room.players.push(player)

    // Send join confirmation
    this.sendToClient(clientId, "ROOM_JOINED", room)

    // Notify other players
    this.broadcastToRoom(room.id, "PLAYER_JOINED", { player, room }, clientId)

    // Broadcast updated room list
    this.broadcastRoomList()
  }

  private handleLeaveRoom(clientId: string, data: any) {
    const room = this.rooms.get(data.roomId)
    if (!room) return

    const playerIndex = room.players.findIndex((p) => p.socketId === clientId)
    if (playerIndex === -1) return

    const player = room.players[playerIndex]
    room.players.splice(playerIndex, 1)

    // If room is empty, delete it
    if (room.players.length === 0) {
      this.rooms.delete(room.id)
    } else if (room.host === player.id && room.players.length > 0) {
      // Transfer host to next player
      room.host = room.players[0].id
    }

    // Notify other players
    this.broadcastToRoom(room.id, "PLAYER_LEFT", { player, room })

    // Broadcast updated room list
    this.broadcastRoomList()
  }

  private handleGameAction(clientId: string, data: any) {
    const room = this.rooms.get(data.roomId)
    if (!room) return

    // Update room game state
    room.gameState = data.gameState

    // Broadcast game action to all players in room
    this.broadcastToRoom(room.id, "GAME_UPDATE", data, clientId)
  }

  private handleDisconnection(clientId: string) {
    // Find and remove player from all rooms
    for (const room of this.rooms.values()) {
      const playerIndex = room.players.findIndex((p) => p.socketId === clientId)
      if (playerIndex !== -1) {
        const player = room.players[playerIndex]
        room.players.splice(playerIndex, 1)

        if (room.players.length === 0) {
          this.rooms.delete(room.id)
        } else if (room.host === player.id) {
          room.host = room.players[0].id
        }

        this.broadcastToRoom(room.id, "PLAYER_LEFT", { player, room })
      }
    }

    this.clients.delete(clientId)
    this.broadcastRoomList()
  }

  private findRoomByCode(code: string): Room | undefined {
    return Array.from(this.rooms.values()).find((room) => room.code === code)
  }

  private generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = ""
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    // Ensure code is unique
    if (this.findRoomByCode(code)) {
      return this.generateRoomCode()
    }

    return code
  }

  private sendToClient(clientId: string, type: string, data: any) {
    const client = this.clients.get(clientId)
    if (client && client.readyState === 1) {
      // WebSocket.OPEN
      client.send(JSON.stringify({ type, data }))
    }
  }

  private broadcastToRoom(roomId: string, type: string, data: any, excludeClientId?: string) {
    const room = this.rooms.get(roomId)
    if (!room) return

    room.players.forEach((player) => {
      if (player.socketId !== excludeClientId) {
        this.sendToClient(player.socketId, type, data)
      }
    })
  }

  private broadcastRoomList() {
    const roomList = Array.from(this.rooms.values())
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, "ROOM_LIST", roomList)
    })
  }

  getUrl(): string {
    return `ws://localhost:${this.port}`
  }
}

// Export singleton instance
export const mockWebSocketServer = new MockWebSocketServer()
