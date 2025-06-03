"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function RoomCodeJoin({ playerName, setPlayerName, onJoinByCode, onBack }) {
  const [nameInput, setNameInput] = useState(playerName || "")
  const [roomCode, setRoomCode] = useState("")
  const [error, setError] = useState(null)
  const [isJoining, setIsJoining] = useState(false)

  const handleJoin = () => {
    if (!nameInput.trim()) {
      setError("Please enter your name")
      return
    }

    if (!roomCode.trim()) {
      setError("Please enter a room code")
      return
    }

    setIsJoining(true)
    setPlayerName(nameInput.trim())

    const result = onJoinByCode(roomCode)

    if (!result.success) {
      setError(result.message || "Failed to join room")
      setIsJoining(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleJoin()
    }
  }

  return (
    <div className="w-full max-w-md animate-fade-in">
      <Button variant="outline" className="mb-4" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Lobby
      </Button>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Join Room by Code</CardTitle>
          <CardDescription>Enter the room code to join</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            {!playerName && (
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoComplete="off"
                />
              </div>
            )}

            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="roomCode">Room Code</Label>
              <Input
                id="roomCode"
                placeholder="Enter room code (e.g. TEST123)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                autoComplete="off"
                className="text-center text-lg tracking-widest uppercase"
              />
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-100 border-red-300">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleJoin} disabled={isJoining || !roomCode.trim() || (!playerName && !nameInput.trim())}>
            {isJoining ? "Joining..." : "Join Room"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
