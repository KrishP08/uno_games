"use client"
import { Card } from "./card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface GameBoardProps {
  topCard: { color: string; value: string }
  deckCount: number
  onDrawCard: () => void
  currentPlayer: string
  currentPlayerName: string
  animatingCard: { color: string; value: string; playerName: string } | null
  drawAnimation: boolean
  stackedCards: Array<{ color: string; value: string }>
}

export function GameBoard({
  topCard,
  deckCount,
  onDrawCard,
  currentPlayer,
  currentPlayerName,
  animatingCard,
  drawAnimation,
  stackedCards,
}: GameBoardProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex justify-center items-center gap-8 my-4">
        {/* Discard pile */}
        <div className="text-center relative">
          <p className="text-white mb-2">Discard Pile</p>
          <div className="relative">
            <Card color={topCard.color} value={topCard.value} playable={false} />

            {/* Stacked cards */}
            {stackedCards.length > 0 && (
              <div className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2">
                <div className="bg-white/80 px-2 py-1 rounded-full text-xs font-bold">
                  +{stackedCards.reduce((total, card) => total + (card.value === "draw2" ? 2 : 4), 0)}
                </div>
              </div>
            )}
          </div>

          {/* Animating card */}
          {animatingCard && (
            <div className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 animate-card-play">
              <Card color={animatingCard.color} value={animatingCard.value} playable={false} isAnimating={true} />
            </div>
          )}
        </div>

        {/* Draw pile */}
        <div className="text-center">
          <p className="text-white mb-2">Draw Pile ({deckCount})</p>
          <Button
            onClick={onDrawCard}
            disabled={currentPlayer !== currentPlayerName}
            className={cn(
              "w-16 h-24 bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center",
              drawAnimation && "animate-card-draw",
            )}
          >
            <span className="text-white font-bold text-2xl">UNO</span>
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <div className="px-4 py-2 bg-white/20 rounded-full">
          <p className="text-white font-medium">
            Current Color: <span className="font-bold">{topCard.color.toUpperCase()}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 px-4 py-2 bg-white/20 rounded-full animate-pulse">
        <p className="text-white font-medium">
          Current Player: <span className="font-bold">{currentPlayer}</span>
          {currentPlayer === currentPlayerName && " (You)"}
        </p>
      </div>
    </div>
  )
}
