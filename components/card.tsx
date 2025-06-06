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
        return "bg-gradient-to-br from-red-600 via-red-500 to-red-700"
      case "blue":
        return "bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700"
      case "green":
        return "bg-gradient-to-br from-green-600 via-green-500 to-green-700"
      case "yellow":
        return "bg-gradient-to-br from-yellow-500 via-yellow-400 to-yellow-600"
      case "wild":
        // For wild cards, use a rainbow gradient background
        return "bg-gradient-to-br from-red-500 via-blue-500 via-green-500 to-purple-500"
      default:
        // If color is somehow undefined or invalid, use a fallback
        return "bg-gradient-to-br from-gray-700 to-gray-900"
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
        "uno-card w-20 h-28 rounded-xl flex flex-col items-center justify-center transform transition-all duration-300 shadow-lg border-2 border-white/20",
        getCardColor(),
        playable
          ? "hover:scale-110 hover:shadow-2xl cursor-pointer hover:border-white/40"
          : "opacity-75 cursor-not-allowed",
        isAnimating && "animate-card-play",
        "relative overflow-hidden",
      )}
      onClick={playable ? onClick : undefined}
    >
      {/* Main symbol */}
      <div className={cn("text-3xl font-bold drop-shadow-lg", getTextColor())}>{getSymbol()}</div>

      {/* Card border with enhanced glow effect */}
      <div className="absolute inset-1 border-2 border-white/30 rounded-lg pointer-events-none"></div>

      {/* Corner symbols */}
      <div className={cn("absolute top-2 left-2 text-xs font-bold drop-shadow", getTextColor())}>{getSymbol()}</div>
      <div className={cn("absolute bottom-2 right-2 text-xs font-bold drop-shadow rotate-180", getTextColor())}>
        {getSymbol()}
      </div>

      {/* Shine effect for playable cards */}
      {playable && (
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
      )}

      {/* Special glow for wild cards */}
      {color === "wild" && (
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-blue-500/20 via-green-500/20 to-purple-500/20 animate-pulse pointer-events-none"></div>
      )}
    </div>
  )
}
