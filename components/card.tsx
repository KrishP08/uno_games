"use client"
import { cn } from "@/lib/utils"

export interface CardProps {
  color: string
  value: string
  onClick?: () => void
  playable?: boolean
  isAnimating?: boolean
}

export function Card({ color, value, onClick, playable = true, isAnimating = false }: CardProps) {
  // Determine background color based on card color
  const getCardColor = () => {
    switch (color) {
      case "red":
        return "bg-red-600"
      case "blue":
        return "bg-blue-600"
      case "green":
        return "bg-green-600"
      case "yellow":
        return "bg-yellow-500"
      case "wild":
        return "bg-gradient-to-br from-red-600 via-blue-600 to-green-600"
      default:
        return "bg-gray-800"
    }
  }

  // Determine text color based on card color
  const getTextColor = () => {
    return color === "yellow" ? "text-black" : "text-white"
  }

  // Special symbol for action cards
  const getSymbol = () => {
    switch (value) {
      case "skip":
        return "⊘"
      case "reverse":
        return "↺"
      case "draw2":
        return "+2"
      case "wild":
        return "W"
      case "wild4":
        return "W+4"
      default:
        return value
    }
  }

  return (
    <div
      className={cn(
        "w-16 h-24 rounded-lg flex flex-col items-center justify-center transform transition-all duration-300",
        getCardColor(),
        playable ? "hover:scale-110 cursor-pointer" : "opacity-90 cursor-not-allowed",
        isAnimating && "animate-card-play",
      )}
      onClick={playable ? onClick : undefined}
    >
      <div className={cn("text-2xl font-bold", getTextColor())}>{getSymbol()}</div>

      {/* Card border */}
      <div className="absolute inset-1 border-2 border-white/30 rounded-lg pointer-events-none"></div>

      {/* Card corners */}
      <div className={cn("absolute top-1 left-1 text-xs font-bold", getTextColor())}>{getSymbol()}</div>
      <div className={cn("absolute bottom-1 right-1 text-xs font-bold", getTextColor())}>{getSymbol()}</div>
    </div>
  )
}
