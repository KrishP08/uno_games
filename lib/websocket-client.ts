export class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectDelay = 2000
  private messageHandlers: Map<string, Function[]> = new Map()
  private connectionTimeout: NodeJS.Timeout | null = null

  constructor(private url: string) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Clear any existing connection timeout
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout)
        }

        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close()
            reject(new Error("Connection timeout"))
          }
        }, 10000) // 10 second timeout

        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          console.log("✅ WebSocket connected to:", this.url)
          this.reconnectAttempts = 0
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            // Handle different types of messages
            if (typeof event.data === "string") {
              // Check if it's JSON
              if (event.data.trim().startsWith("{") && event.data.trim().endsWith("}")) {
                try {
                  const message = JSON.parse(event.data)
                  if (message.type && message.data !== undefined) {
                    this.handleMessage(message)
                  } else {
                    console.log("📨 Received non-protocol message:", event.data.substring(0, 100))
                  }
                } catch (parseError) {
                  console.log("📨 Received non-JSON message:", event.data.substring(0, 100))
                }
              } else {
                console.log("📨 Received text message:", event.data.substring(0, 100))
              }
            } else {
              console.log("📨 Received binary message")
            }
          } catch (error) {
            console.error("Error handling WebSocket message:", error)
          }
        }

        this.ws.onclose = (event) => {
          console.log("🔌 WebSocket disconnected:", event.code, event.reason)
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          // Only attempt reconnect if it wasn't a manual close
          if (event.code !== 1000) {
            this.attemptReconnect()
          }
        }

        this.ws.onerror = (error) => {
          console.error("❌ WebSocket error occurred")
          if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout)
            this.connectionTimeout = null
          }

          // Don't reject immediately, let the close event handle it
          if (this.ws?.readyState === WebSocket.CONNECTING) {
            reject(new Error("Failed to connect to WebSocket server"))
          }
        }
      } catch (error) {
        console.error("❌ Failed to create WebSocket:", error)
        reject(error)
      }
    })
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

      setTimeout(() => {
        this.connect().catch((error) => {
          console.log(`❌ Reconnection attempt ${this.reconnectAttempts} failed:`, error.message)
        })
      }, this.reconnectDelay * this.reconnectAttempts)
    } else {
      console.log("❌ Max reconnection attempts reached. Giving up.")
    }
  }

  private handleMessage(message: any) {
    const handlers = this.messageHandlers.get(message.type) || []
    handlers.forEach((handler) => {
      try {
        handler(message.data)
      } catch (error) {
        console.error("Error in message handler:", error)
      }
    })
  }

  on(messageType: string, handler: Function) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, [])
    }
    this.messageHandlers.get(messageType)!.push(handler)
  }

  off(messageType: string, handler: Function) {
    const handlers = this.messageHandlers.get(messageType) || []
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  send(type: string, data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify({ type, data })
        this.ws.send(message)
        console.log("📤 Sent message:", type)
      } catch (error) {
        console.error("❌ Failed to send message:", error)
      }
    } else {
      console.warn("⚠️ WebSocket not connected, message not sent:", type)
    }
  }

  disconnect() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }

    if (this.ws) {
      // Set close code to 1000 (normal closure) to prevent reconnection
      this.ws.close(1000, "Manual disconnect")
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  getConnectionState(): string {
    if (!this.ws) return "disconnected"

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "connecting"
      case WebSocket.OPEN:
        return "connected"
      case WebSocket.CLOSING:
        return "closing"
      case WebSocket.CLOSED:
        return "disconnected"
      default:
        return "unknown"
    }
  }
}
