"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, ChevronUp, Bug } from "lucide-react"

export function DebugPanel({ rooms, onCreateTestRoom }) {
  const [isOpen, setIsOpen] = useState(false)
  const [displayRooms, setDisplayRooms] = useState([])

  useEffect(() => {
    if (isOpen) {
      setDisplayRooms(rooms)
    }
  }, [isOpen, rooms])

  const refreshRooms = () => {
    setDisplayRooms([...rooms])
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant="outline"
        size="sm"
        className="bg-white/10 backdrop-blur-sm"
        onClick={() => {
          setIsOpen(!isOpen)
        }}
      >
        <Bug className="h-4 w-4 mr-1" />
        Debug
        {isOpen ? <ChevronDown className="h-4 w-4 ml-1" /> : <ChevronUp className="h-4 w-4 ml-1" />}
      </Button>

      {isOpen && (
        <Card className="mt-2 w-80 max-h-96 overflow-auto">
          <CardHeader className="py-2">
            <CardTitle className="text-sm flex justify-between items-center">
              Room Storage
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={onCreateTestRoom}>
                  Test Room
                </Button>
                <Button size="sm" variant="outline" onClick={refreshRooms}>
                  Refresh
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 text-xs">
            {displayRooms.length === 0 ? (
              <p className="text-muted-foreground">No rooms in storage</p>
            ) : (
              <pre className="whitespace-pre-wrap">{JSON.stringify(displayRooms, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
