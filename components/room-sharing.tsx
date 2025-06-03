"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Copy, Check, Share2, Users } from "lucide-react"

export function RoomSharing({ room }) {
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(room.joinCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const copyLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.joinCode}`
    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${room.joinCode}`

  return (
    <Card className="w-full mb-4 bg-gradient-to-r from-blue-50 to-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Share2 className="h-5 w-5" />
          Invite Friends to Play
        </CardTitle>
        <CardDescription>Share this room code or link with friends to play together!</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Room Code */}
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600 mb-2">Room Code</p>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-2xl font-bold tracking-widest py-3 px-6 rounded-lg shadow-lg inline-block">
              {room.joinCode}
            </div>
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={copyCode}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Code
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Share Link */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-600 mb-2">Share Link</p>
            <div className="bg-gray-100 p-3 rounded-lg text-sm font-mono break-all">{shareUrl}</div>
            <div className="mt-3 flex gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={copyLink}>
                {linkCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Link Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Link
                  </>
                )}
              </Button>
              {navigator.share && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() =>
                    navigator.share({
                      title: `Join my UNO game!`,
                      text: `Join my UNO game with code: ${room.joinCode}`,
                      url: shareUrl,
                    })
                  }
                >
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-1">How friends can join:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                • Enter room code: <strong>{room.joinCode}</strong>
              </li>
              <li>• Or click the shared link above</li>
              <li>• Or visit the game and use "Join Room"</li>
            </ul>
          </div>

          {/* Current Players */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>
              {room.players.length}/{room.maxPlayers} players in room
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
