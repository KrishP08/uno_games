"use client"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Monitor } from "lucide-react"

export function GameModeSelect({ onSelectMode }) {
  return (
    <div className="w-full max-w-4xl animate-fade-in">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center text-2xl">Select Game Mode</CardTitle>
          <CardDescription className="text-center">Choose how you want to play UNO</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
            <div
              className="border rounded-lg p-6 hover:bg-accent transition-colors cursor-pointer flex flex-col items-center text-center"
              onClick={() => onSelectMode("single")}
            >
              <Monitor className="h-16 w-16 mb-4" />
              <h3 className="text-xl font-medium mb-2">Single Player</h3>
              <p className="text-muted-foreground">Play against computer opponents with customizable difficulty</p>
              <Button className="mt-4 w-full">Play Single Player</Button>
            </div>

            <div
              className="border rounded-lg p-6 hover:bg-accent transition-colors cursor-pointer flex flex-col items-center text-center"
              onClick={() => onSelectMode("multi")}
            >
              <Users className="h-16 w-16 mb-4" />
              <h3 className="text-xl font-medium mb-2">Multiplayer</h3>
              <p className="text-muted-foreground">Create or join rooms to play with friends</p>
              <Button className="mt-4 w-full">Play Multiplayer</Button>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">Both modes support voice commands and card stacking rules</p>
        </CardFooter>
      </Card>
    </div>
  )
}
