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
        // If it's a wild card but has a selected color, use that color
        if (value === "wild" || value === "wild4") {
          return "bg-gradient-to-br from-red-600 via-blue-600 to-green-600"
        }
        return "bg-gradient-to-br from-red-600 via-blue-600 to-green-600"
      case "placeholder":
        // For placeholder cards, use a neutral color
        return "bg-gray-800"
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
      case "card":
        // For placeholder cards, show a generic symbol
        return "?"
      default:
        return value
    }
  }

  // Don't render invalid cards
  if (!color || !value) {
    return (
      <div className="w-16 h-24 rounded-lg flex flex-col items-center justify-center bg-gray-800 text-white">
        <div className="text-xs">Invalid</div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "w-16 h-24 rounded-lg flex flex-col items-center justify-center transform transition-all duration-300 relative",
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
      <div className={cn("absolute bottom-1 right-1 text-xs font-bold rotate-180", getTextColor())}>{getSymbol()}</div>
    </div>
  )
}
