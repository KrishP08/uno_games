import { io, type Socket } from "socket.io-client"

export class SocketClient {
  private socket: Socket | null = null
  private url: string
  private listeners: Map<string, Function[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000
  private gameStateCache: any = null
  private _lastAction: any = null

  constructor(url: string) {
    this.url = url
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log("🔗 Attempting to connect to:", this.url)

        this.socket = io(this.url, {
          transports: ["websocket", "polling"],
          timeout: 20000, // Increased timeout for Render
          withCredentials: false,
          forceNew: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        })

        this.socket.on("connect", () => {
          console.log("✅ Connected to UNO game server")
          console.log("🆔 Socket ID:", this.socket?.id)
          this.reconnectAttempts = 0
          resolve()
        })

        this.socket.on("connect_error", (error) => {
          console.error("❌ Connection error:", error.message)
          reject(error)
        })

        this.socket.on("disconnect", (reason) => {
          console.log("🔌 Disconnected from server:", reason)
          // Don't auto-reconnect on manual disconnect
          if (reason !== "io client disconnect") {
            console.log("🔄 Attempting to reconnect...")
          }
        })

        this.socket.on("reconnect", (attemptNumber) => {
          console.log("✅ Reconnected after", attemptNumber, "attempts")
        })

        this.socket.on("reconnect_error", (error) => {
          console.error("❌ Reconnection failed:", error.message)
        })

        // Set up message handlers
        this.setupMessageHandlers()
      } catch (error) {
        console.error("❌ Failed to create socket:", error)
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
      "start-game-error",
    ]

    events.forEach((event) => {
      this.socket!.on(event, (data) => {
        console.log(`📨 Received ${event}:`, data)

        // Cache game state updates for reconnection
        if (event === "game-update" && data.action === "GAME_STATE_SYNC") {
          this.gameStateCache = data.data
        }

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
      console.log(`📤 Sending ${event}:`, data)
      this.socket.emit(event, data)
    } else {
      console.warn("⚠️ Socket not connected, cannot emit:", event)

      // Try to reconnect if not connected
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnect()
      }
    }
  }

  // Check connection status
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // Disconnect from server
  disconnect() {
    if (this.socket) {
      console.log("🔌 Manually disconnecting from server")
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

  // Send game action with retry logic
  gameAction(actionData: any) {
    if (this.isConnected()) {
      try {
        console.log(`📤 Sending game action: ${actionData.action}`, actionData)

        // Add unique ID to track this specific action
        const actionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        actionData.actionId = actionId

        this.emit("game-action", actionData)

        // Store the last action for potential retry
        this._lastAction = actionData

        // Set a timeout to verify the action was processed
        setTimeout(() => {
          // If we're still connected but didn't get confirmation, retry once
          if (this.isConnected() && this._lastAction === actionData) {
            console.log("⚠️ No confirmation for game action, retrying once:", actionData.action)
            this.emit("game-action", actionData)
            this._lastAction = null
          }
        }, 500) // Reduced timeout for faster retry
      } catch (error) {
        console.error("❌ Error sending game action:", error)
        this.queueAction(actionData)
      }
    } else {
      console.warn("⚠️ Cannot send game action - not connected")
      this.queueAction(actionData)
    }
  }

  // Start game
  startGame(gameData: any) {
    this.emit("start-game", gameData)
  }

  // Queue actions for when reconnected
  private actionQueue: any[] = []

  private queueAction(actionData: any) {
    this.actionQueue.push(actionData)
    console.log("📋 Queued action for when reconnected:", actionData.action)
  }

  private processQueuedActions() {
    if (this.actionQueue.length > 0) {
      console.log("📤 Processing queued actions:", this.actionQueue.length)
      this.actionQueue.forEach((action) => {
        this.gameAction(action)
      })
      this.actionQueue = []
    }
  }

  // Manual reconnect
  private reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log("❌ Max reconnection attempts reached")
      return
    }

    this.reconnectAttempts++
    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)

    setTimeout(() => {
      this.connect()
        .then(() => {
          console.log("✅ Reconnected successfully")
          this.processQueuedActions()
        })
        .catch((error) => {
          console.error("❌ Reconnection failed:", error)
          this.reconnect()
        })
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  // Get cached game state
  getCachedGameState() {
    return this.gameStateCache
  }

  // Clear cached game state
  clearCachedGameState() {
    this.gameStateCache = null
  }

  // Add this new method to force a full game state sync
  forceGameStateSync(roomId: string, gameState: any) {
    if (this.isConnected()) {
      console.log("🔄 Forcing complete game state sync")
      this.gameAction({
        roomId,
        action: "GAME_STATE_SYNC",
        data: gameState,
      })
    }
  }
}
