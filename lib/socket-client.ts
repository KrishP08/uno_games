import { io, type Socket } from "socket.io-client"

export class SocketClient {
  private socket: Socket | null = null
  private url: string
  private listeners: Map<string, Function[]> = new Map()

  constructor(url: string) {
    this.url = url
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.url, {
          transports: ["websocket", "polling"],
          timeout: 10000,
        })

        this.socket.on("connect", () => {
          console.log("✅ Connected to UNO game server")
          resolve()
        })

        this.socket.on("connect_error", (error) => {
          console.error("❌ Connection error:", error)
          reject(error)
        })

        this.socket.on("disconnect", (reason) => {
          console.log("🔌 Disconnected from server:", reason)
        })

        // Set up message handlers
        this.setupMessageHandlers()
      } catch (error) {
        reject(error)
      }
    })
  }

  private setupMessageHandlers() {
    if (!this.socket) return

    // Handle all incoming events and route to listeners
    const events = [
      "room-list",
      "room-created",
      "room-joined",
      "join-error",
      "player-joined",
      "player-left",
      "game-update",
      "game-started",
    ]

    events.forEach((event) => {
      this.socket!.on(event, (data) => {
        this.handleMessage(event, data)
      })
    })
  }

  private handleMessage(event: string, data: any) {
    const handlers = this.listeners.get(event) || []
    handlers.forEach((handler) => {
      try {
        handler(data)
      } catch (error) {
        console.error(`Error in ${event} handler:`, error)
      }
    })
  }

  // Subscribe to events
  on(event: string, handler: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(handler)
  }

  // Unsubscribe from events
  off(event: string, handler: Function) {
    const handlers = this.listeners.get(event) || []
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  // Emit events to server
  emit(event: string, data?: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data)
    } else {
      console.warn("⚠️ Socket not connected, cannot emit:", event)
    }
  }

  // Check connection status
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // Disconnect from server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // Get rooms list
  getRooms() {
    this.emit("get-rooms")
  }

  // Create a room
  createRoom(roomData: any) {
    this.emit("create-room", roomData)
  }

  // Join a room
  joinRoom(joinData: any) {
    this.emit("join-room", joinData)
  }

  // Leave a room
  leaveRoom(leaveData: any) {
    this.emit("leave-room", leaveData)
  }

  // Send game action
  gameAction(actionData: any) {
    this.emit("game-action", actionData)
  }

  // Start game
  startGame(gameData: any) {
    this.emit("start-game", gameData)
  }
}
