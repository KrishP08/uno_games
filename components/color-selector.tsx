"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ColorSelectorProps {
  onSelectColor: (color: string) => void
  playerName: string
  cardType: string
}

export function ColorSelector({ onSelectColor, playerName, cardType }: ColorSelectorProps) {
  const colors = [
    {
      name: "red",
      bg: "bg-red-600",
      hover: "hover:bg-red-700",
      border: "border-red-400",
      text: "Red",
    },
    {
      name: "blue",
      bg: "bg-blue-600",
      hover: "hover:bg-blue-700",
      border: "border-blue-400",
      text: "Blue",
    },
    {
      name: "green",
      bg: "bg-green-600",
      hover: "hover:bg-green-700",
      border: "border-green-400",
      text: "Green",
    },
    {
      name: "yellow",
      bg: "bg-yellow-500",
      hover: "hover:bg-yellow-600",
      border: "border-yellow-400",
      text: "Yellow",
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 shadow-2xl border-2 border-white/20">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl font-bold">{playerName} - Choose a Color</CardTitle>
          <p className="text-muted-foreground">You played a {cardType}. Select the new color:</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {colors.map((color) => (
              <Button
                key={color.name}
                className={`h-20 ${color.bg} ${color.hover} text-white font-bold text-xl capitalize border-4 ${color.border} transition-all duration-200 transform hover:scale-105 shadow-lg`}
                onClick={() => onSelectColor(color.name)}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full bg-white/30 mb-1`}></div>
                  {color.text}
                </div>
              </Button>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">Click a color to continue the game</p>
        </CardContent>
      </Card>
    </div>
  )
}
