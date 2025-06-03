"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, RefreshCw, Users, Wifi, WifiOff, Zap } from "lucide-react"

export function Lobby({
  playerName,
  setPlayerName,
  rooms,
  onJoinRoom,
  onCreateRoom,
  onJoinByCode,
  gameMode,
  onBackToModeSelect,
  onRefreshRooms,
  onCreateInstantMultiplayer,
  connectionStatus,
}) {
  const [roomName, setRoomName] = useState("")
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [pointsToWin, setPointsToWin] = useState(500)
  const [stackingEnabled, setStackingEnabled] = useState(true)
  const [activeTab, setActiveTab] = useState("instant")
  const [computerPlayers, setComputerPlayers] = useState(3)
  const [nameInput, setNameInput] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")

  const handleCreateRoom = () => {
    if (!playerName) {
      setStatusMessage("Please enter your name first")
      return
    }

    if (!roomName.trim()) {
      setStatusMessage("Please enter a room name")
      return
    }

    // Call the onCreateRoom function with the room settings
    onCreateRoom(roomName, maxPlayers, pointsToWin, stackingEnabled)

    // Log for debugging
    console.log("Creating room:", {
      roomName,
      maxPlayers,
      pointsToWin,
      stackingEnabled,
      playerName,
    })
  }

  const handleStartSinglePlayer = () => {
    if (playerName) {
      onCreateRoom("Single Player Game", computerPlayers + 1, pointsToWin, stackingEnabled)
    }
  }

  const handleNameSubmit = () => {
    if (nameInput.trim()) {
      setPlayerName(nameInput.trim())
    }
  }

  const handleJoinByCode = () => {
    if (joinCode.trim()) {
      onJoinByCode(joinCode.trim())
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      if (!playerName) {
        handleNameSubmit()
      } else if (activeTab === "join") {
        handleJoinByCode()
      }
    }
  }

  const handleRefreshRooms = () => {
    setIsRefreshing(true)
    onRefreshRooms()
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const isOnline = connectionStatus === "connected"

  return (
    <div className="w-full max-w-4xl animate-fade-in">
      <Button variant="outline" className="mb-4" onClick={onBackToModeSelect}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Game Modes
      </Button>

      {!playerName ? (
        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Welcome to UNO!</CardTitle>
            <CardDescription>Enter your name to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoComplete="off"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleNameSubmit} disabled={!nameInput.trim()}>
              Continue
            </Button>
          </CardFooter>
        </Card>
      ) : gameMode === "single" ? (
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Single Player Setup</CardTitle>
            <CardDescription>Configure your game against computer opponents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="computerPlayers">Number of Computer Opponents</Label>
                  <Select
                    value={computerPlayers.toString()}
                    onValueChange={(value) => setComputerPlayers(Number.parseInt(value))}
                  >
                    <SelectTrigger id="computerPlayers">
                      <SelectValue placeholder="Select number of opponents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Computer</SelectItem>
                      <SelectItem value="2">2 Computers</SelectItem>
                      <SelectItem value="3">3 Computers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="pointsToWin">Points to Win</Label>
                  <Select
                    value={pointsToWin.toString()}
                    onValueChange={(value) => setPointsToWin(Number.parseInt(value))}
                  >
                    <SelectTrigger id="pointsToWin">
                      <SelectValue placeholder="Select points to win" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="100">100 Points</SelectItem>
                      <SelectItem value="200">200 Points</SelectItem>
                      <SelectItem value="300">300 Points</SelectItem>
                      <SelectItem value="500">500 Points</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="stacking">Enable Card Stacking</Label>
                  <Switch id="stacking" checked={stackingEnabled} onCheckedChange={setStackingEnabled} />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleStartSinglePlayer}>Start Game</Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isOnline ? <Wifi className="h-5 w-5 text-green-600" /> : <WifiOff className="h-5 w-5 text-red-600" />}
              UNO Multiplayer
            </CardTitle>
            <CardDescription>
              Welcome, {playerName}! 🎮 {isOnline ? "Online multiplayer ready!" : "Offline mode - limited features"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="instant" value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="instant">🚀 Instant</TabsTrigger>
                <TabsTrigger value="join">🔗 Join</TabsTrigger>
                <TabsTrigger value="create">🏠 Create</TabsTrigger>
              </TabsList>

              <TabsContent value="instant" className="mt-6">
                <div className="text-center space-y-6">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 rounded-lg text-white">
                    <Zap className="h-12 w-12 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold mb-2">Instant Multiplayer</h3>
                    <p className="text-purple-100">Jump straight into a game with smart AI players!</p>
                  </div>
                  <Button
                    onClick={onCreateInstantMultiplayer}
                    size="lg"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 text-lg"
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    Start Instant Game
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Perfect for quick games • No waiting • Smart AI opponents
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="join" className="mt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Available Rooms ({rooms.length})</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshRooms}
                        disabled={isRefreshing || !isOnline}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {/* Join by Code */}
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h4 className="font-medium text-green-900 mb-2">🔗 Join by Code</h4>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter room code"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        onKeyPress={handleKeyPress}
                        className="text-center text-lg tracking-widest uppercase"
                        maxLength={6}
                      />
                      <Button
                        onClick={handleJoinByCode}
                        disabled={!joinCode.trim()}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Join
                      </Button>
                    </div>
                  </div>

                  {/* Room List */}
                  {rooms.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-muted-foreground font-medium">No rooms available</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isOnline ? "Create a room or try instant play!" : "Server offline - try instant play!"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {rooms.map((room) => (
                        <div
                          key={room.id}
                          className="flex items-center justify-between p-4 border-2 rounded-lg bg-gradient-to-r from-blue-50 to-green-50 hover:from-blue-100 hover:to-green-100 transition-all"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h4 className="font-bold text-lg">{room.name}</h4>
                              <span className="bg-blue-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                                {room.code}
                              </span>
                              {room.isOffline && (
                                <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded-full">OFFLINE</span>
                              )}
                              {room.players.length >= room.maxPlayers && (
                                <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">FULL</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                              👥 Players: {room.players.length}/{room.maxPlayers} • 🎯 Points:{" "}
                              {room.settings?.pointsToWin || 500}
                              {room.settings?.stackingEnabled && " • 📚 Stacking"}
                            </p>
                            {room.players.length > 0 && (
                              <p className="text-xs text-blue-600 mt-1">
                                Players: {room.players.map((p) => p.name).join(", ")}
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={() => onJoinRoom(room.id)}
                            disabled={room.players.length >= room.maxPlayers}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold px-6"
                          >
                            {room.players.length >= room.maxPlayers ? "Full" : "Join"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="create" className="mt-6">
                <div className="space-y-4">
                  {!isOnline && (
                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <p className="text-yellow-800 text-sm">⚠️ Server offline - rooms created will be local only</p>
                    </div>
                  )}

                  <div className="grid w-full items-center gap-4">
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="roomName">Room Name</Label>
                      <Input
                        id="roomName"
                        placeholder="Enter room name"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="maxPlayers">Max Players</Label>
                      <Select
                        value={maxPlayers.toString()}
                        onValueChange={(value) => setMaxPlayers(Number.parseInt(value))}
                      >
                        <SelectTrigger id="maxPlayers">
                          <SelectValue placeholder="Select max players" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 Players</SelectItem>
                          <SelectItem value="3">3 Players</SelectItem>
                          <SelectItem value="4">4 Players</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      <Label htmlFor="pointsToWin">Points to Win</Label>
                      <Select
                        value={pointsToWin.toString()}
                        onValueChange={(value) => setPointsToWin(Number.parseInt(value))}
                      >
                        <SelectTrigger id="pointsToWin">
                          <SelectValue placeholder="Select points to win" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">100 Points</SelectItem>
                          <SelectItem value="200">200 Points</SelectItem>
                          <SelectItem value="300">300 Points</SelectItem>
                          <SelectItem value="500">500 Points</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="stacking">Enable Card Stacking</Label>
                      <Switch id="stacking" checked={stackingEnabled} onCheckedChange={setStackingEnabled} />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setPlayerName("")}>
              Change Name
            </Button>
            {activeTab === "create" && (
              <Button onClick={handleCreateRoom} disabled={!roomName} className="bg-blue-600 hover:bg-blue-700">
                Create Room
              </Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
