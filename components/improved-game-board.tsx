"use client"

import { Card } from "./card"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ImprovedGameBoardProps {
  topCard: { color: string; value: string }
  deckCount: number
  onDrawCard: () => void
  currentPlayer: string
  currentPlayerName: string
  animatingCard: { color: string; value: string; playerName: string } | null
  drawAnimation: boolean
  stackedCards: Array<{ color: string; value: string }>
  direction: number
  canStack: boolean
}

export function ImprovedGameBoard({
  topCard,
  deckCount,
  onDrawCard,
  currentPlayer,
  currentPlayerName,
  animatingCard,
  drawAnimation,
  stackedCards,
  direction,
  canStack,
}: ImprovedGameBoardProps) {
  const getStackedCardsTotal = () => {
    return stackedCards.reduce((total, card) => {
      return total + (card.value === "draw2" ? 2 : card.value === "wild4" ? 4 : 0)
    }, 0)
  }

  const isPlayerTurn = currentPlayer === currentPlayerName
  const canPlayerDraw = isPlayerTurn && !canStack

  return (
    <div className="flex flex-col items-center">
      {/* Direction indicator */}
      <div className="mb-4 flex items-center gap-2">
        <Badge variant="outline" className="bg-white/10 text-white border-white/30">
          Direction: {direction === 1 ? "→ Clockwise" : "← Counter-clockwise"}
        </Badge>
        {canStack && (
          <Badge variant="destructive" className="animate-pulse">
            Stacking Active! (+{getStackedCardsTotal()})
          </Badge>
        )}
      </div>

      <div className="flex justify-center items-center gap-12 my-6">
        {/* Discard pile */}
        <div className="text-center relative">
          <p className="text-white mb-3 font-medium">Discard Pile</p>
          <div className="relative">
            {/* Base discard pile with multiple card effect */}
            <div className="relative">
              <div className="absolute top-1 left-1 opacity-30">
                <div className="w-16 h-24 bg-gray-600 rounded-lg"></div>
              </div>
              <div className="absolute top-0.5 left-0.5 opacity-60">
                <div className="w-16 h-24 bg-gray-700 rounded-lg"></div>
              </div>
              <Card color={topCard.color} value={topCard.value} playable={false} />
            </div>

            {/* Current color indicator */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
              <div className="px-3 py-1 bg-white/90 rounded-full text-black text-sm font-bold">
                {topCard.color.toUpperCase()}
              </div>
            </div>

            {/* Stacked cards indicator */}
            {stackedCards.length > 0 && (
              <div className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold animate-bounce">
                +{getStackedCardsTotal()}
              </div>
            )}

            {/* Special effect for stacked cards */}
            {stackedCards.length > 0 && (
              <div className="absolute inset-0 rounded-lg border-2 border-red-500 animate-pulse"></div>
            )}
          </div>

          {/* Animating card */}
          {animatingCard && (
            <div className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 animate-card-play z-10">
              <Card color={animatingCard.color} value={animatingCard.value} playable={false} isAnimating={true} />
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">
                {animatingCard.playerName}
              </div>
            </div>
          )}
        </div>

        {/* Draw pile - Fixed */}
        <div className="text-center relative">
          <p className="text-white mb-3 font-medium">Draw Pile</p>
          <div className="relative">
            {/* Multiple card stack effect */}
            <div className="absolute top-2 left-2 opacity-40">
              <div className="w-16 h-24 bg-red-700 rounded-lg"></div>
            </div>
            <div className="absolute top-1 left-1 opacity-70">
              <div className="w-16 h-24 bg-red-650 rounded-lg"></div>
            </div>

            {/* Main draw pile button */}
            <div
              className={cn(
                "w-16 h-24 bg-red-600 rounded-lg flex flex-col items-center justify-center relative overflow-hidden cursor-pointer transition-all duration-200",
                drawAnimation && "animate-card-draw",
                canPlayerDraw && "ring-2 ring-yellow-400 ring-offset-2 hover:bg-red-700 hover:scale-105",
                !canPlayerDraw && "opacity-50 cursor-not-allowed",
              )}
              onClick={canPlayerDraw ? onDrawCard : undefined}
            >
              <span className="text-white font-bold text-lg">UNO</span>
              <span className="text-white text-xs mt-1">{canPlayerDraw ? "DRAW" : canStack ? "STACK" : "WAIT"}</span>

              {/* Card count badge */}
              <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                {deckCount}
              </div>

              {/* Hover effect for active state */}
              {canPlayerDraw && (
                <div className="absolute inset-0 bg-white/0 hover:bg-white/10 transition-colors duration-200"></div>
              )}
            </div>
          </div>

          {/* Draw instruction */}
          {canPlayerDraw && (
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-yellow-300 text-xs font-bold animate-pulse">
              Your Turn - Click to Draw
            </div>
          )}

          {canStack && (
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-red-300 text-xs font-bold">
              Play +2/+4 or Draw {getStackedCardsTotal()}
            </div>
          )}
        </div>
      </div>

      {/* Game status */}
      <div className="mt-6 space-y-2">
        <div className="px-6 py-3 bg-white/20 backdrop-blur-sm rounded-full">
          <p className="text-white font-medium text-center">
            Current Player: <span className="font-bold text-yellow-300">{currentPlayer}</span>
            {currentPlayer === currentPlayerName && " (Your Turn!)"}
          </p>
        </div>

        {canStack && (
          <div className="px-4 py-2 bg-red-500/80 backdrop-blur-sm rounded-full">
            <p className="text-white font-medium text-center text-sm">
              ⚡ Stacking Mode: Play a +2 or +4 card, or draw {getStackedCardsTotal()} cards!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
