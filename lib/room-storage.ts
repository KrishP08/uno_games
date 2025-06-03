// Shared room storage using localStorage and BroadcastChannel
export class RoomStorage {
  private static instance: RoomStorage
  private broadcastChannel: BroadcastChannel | null = null
  private storageKey = "uno-game-rooms"
  private listeners: Set<(rooms: any[]) => void> = new Set()

  constructor() {
    // Initialize BroadcastChannel for same-origin communication
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      this.broadcastChannel = new BroadcastChannel("uno-rooms")
      this.broadcastChannel.onmessage = (event) => {
        if (event.data.type === "ROOMS_UPDATED") {
          this.notifyListeners()
        }
      }
    }
  }

  static getInstance(): RoomStorage {
    if (!RoomStorage.instance) {
      RoomStorage.instance = new RoomStorage()
    }
    return RoomStorage.instance
  }

  // Get all rooms from localStorage
  getRooms(): any[] {
    if (typeof window === "undefined") return []

    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const rooms = JSON.parse(stored)
        // Filter out expired rooms (older than 1 hour)
        const validRooms = rooms.filter((room: any) => {
          const roomAge = Date.now() - (room.createdAt || 0)
          return roomAge < 60 * 60 * 1000 // 1 hour
        })

        // Update storage if we filtered out expired rooms
        if (validRooms.length !== rooms.length) {
          this.saveRooms(validRooms)
        }

        return validRooms
      }
    } catch (error) {
      console.error("Error reading rooms from localStorage:", error)
    }
    return []
  }

  // Save rooms to localStorage
  private saveRooms(rooms: any[]): void {
    if (typeof window === "undefined") return

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(rooms))
      this.broadcastRoomsUpdate()
    } catch (error) {
      console.error("Error saving rooms to localStorage:", error)
    }
  }

  // Add a new room
  addRoom(room: any): void {
    const rooms = this.getRooms()
    const roomWithTimestamp = {
      ...room,
      createdAt: Date.now(),
    }
    rooms.push(roomWithTimestamp)
    this.saveRooms(rooms)
    this.notifyListeners()
  }

  // Update an existing room
  updateRoom(roomId: string, updates: any): void {
    const rooms = this.getRooms()
    const roomIndex = rooms.findIndex((r) => r.id === roomId)
    if (roomIndex !== -1) {
      rooms[roomIndex] = { ...rooms[roomIndex], ...updates }
      this.saveRooms(rooms)
      this.notifyListeners()
    }
  }

  // Remove a room
  removeRoom(roomId: string): void {
    const rooms = this.getRooms()
    const filteredRooms = rooms.filter((r) => r.id !== roomId)
    this.saveRooms(filteredRooms)
    this.notifyListeners()
  }

  // Find room by code
  findRoomByCode(code: string): any | null {
    const rooms = this.getRooms()
    return rooms.find((r) => r.code === code.toUpperCase()) || null
  }

  // Find room by ID
  findRoomById(id: string): any | null {
    const rooms = this.getRooms()
    return rooms.find((r) => r.id === id) || null
  }

  // Add a player to a room
  addPlayerToRoom(roomId: string, player: any): boolean {
    const room = this.findRoomById(roomId)
    if (!room) return false

    // Check if room is full
    if (room.players.length >= room.maxPlayers) return false

    // Check if player is already in room
    if (room.players.some((p: any) => p.id === player.id)) return false

    const updatedPlayers = [...room.players, player]
    this.updateRoom(roomId, { players: updatedPlayers })
    return true
  }

  // Remove a player from a room
  removePlayerFromRoom(roomId: string, playerId: string): void {
    const room = this.findRoomById(roomId)
    if (!room) return

    const updatedPlayers = room.players.filter((p: any) => p.id !== playerId)

    // If room is empty, remove it
    if (updatedPlayers.length === 0) {
      this.removeRoom(roomId)
    } else {
      // If the host left, assign new host
      const updates: any = { players: updatedPlayers }
      if (room.host === playerId && updatedPlayers.length > 0) {
        updates.host = updatedPlayers[0].id
      }
      this.updateRoom(roomId, updates)
    }
  }

  // Subscribe to room updates
  subscribe(callback: (rooms: any[]) => void): () => void {
    this.listeners.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback)
    }
  }

  // Notify all listeners of room updates
  private notifyListeners(): void {
    const rooms = this.getRooms()
    this.listeners.forEach((callback) => callback(rooms))
  }

  // Broadcast room updates via BroadcastChannel
  private broadcastRoomsUpdate(): void {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: "ROOMS_UPDATED" })
    }
  }

  // Generate unique room code
  generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let code = ""

    do {
      code = ""
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
    } while (this.findRoomByCode(code)) // Ensure uniqueness

    return code
  }

  // Clean up expired rooms
  cleanupExpiredRooms(): void {
    const rooms = this.getRooms()
    const validRooms = rooms.filter((room: any) => {
      const roomAge = Date.now() - (room.createdAt || 0)
      return roomAge < 60 * 60 * 1000 // 1 hour
    })

    if (validRooms.length !== rooms.length) {
      this.saveRooms(validRooms)
      this.notifyListeners()
    }
  }
}
