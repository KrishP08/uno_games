"use client"

import { Card } from "./card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CircularGameLayout({
  players,
  playerHands,
  playerName,
  currentPlayer,
  playerSaidUno,
  showEndGameCards,
  topCard,
  deckCount,
  onDrawCard,
  animatingCard,
  drawAnimation,
  stackedCards,
}) {
  // Reorder players so the current user is always at the bottom
  const reorderPlayers = () => {
    const playerIndex = players.findIndex((p) => p.name === playerName)
    if (playerIndex === -1) return players

    const result = [...players]
    const currentPlayerObj = result.splice(playerIndex, 1)[0]
    result.unshift(currentPlayerObj)
    return result
  }

  const orderedPlayers = reorderPlayers()

  // Calculate positions based on number of players
  const getPlayerPositions = () => {
    const positions = []
    const totalPlayers = orderedPlayers.length

    // Current player is always at bottom
    positions.push({ x: 0, y: 250, angle: 0 })

    if (totalPlayers === 2) {
      // 2 players: opponent at top
      positions.push({ x: 0, y: -250, angle: 180 })
    } else if (totalPlayers === 3) {
      // 3 players: opponents at top-left and top-right
      positions.push({ x: -220, y: -150, angle: 135 })
      positions.push({ x: 220, y: -150, angle: 225 })
    } else if (totalPlayers === 4) {
      // 4 players: opponents at left, top, and right
      positions.push({ x: -250, y: 0, angle: 90 })
      positions.push({ x: 0, y: -250, angle: 180 })
      positions.push({ x: 250, y: 0, angle: 270 })
    }

    return positions
  }

  const positions = getPlayerPositions()

  return (
    <div className="relative w-full h-[600px] flex items-center justify-center">
      {/* Players positioned around the table */}
      {orderedPlayers.map((player, index) => {
        const position = positions[index]
        const isCurrentPlayer = currentPlayer === player.name
        const isHumanPlayer = player.name === playerName
        const hand = playerHands[player.name] || []

        return (
          <div
            key={player.name}
            className={cn(
              "absolute flex flex-col items-center transition-all duration-300",
              isCurrentPlayer && "scale-110",
            )}
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
            }}
          >
            {/* Player info */}
            <div
              className={cn(
                "bg-white/20 backdrop-blur-sm rounded-lg p-3 mb-2 min-w-[120px] text-center",
                isCurrentPlayer && "ring-2 ring-yellow-400 bg-yellow-400/20",
                isHumanPlayer && "bg-green-400/20",
              )}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-2 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{player.name.charAt(0).toUpperCase()}</span>
              </div>
              <p className="text-white font-medium text-sm">{player.name}</p>
              <p className="text-white/80 text-xs">{hand.length} cards</p>
              {hand.length === 1 && playerSaidUno[player.name] && (
                <span className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full mt-1 inline-block">
                  UNO!
                </span>
              )}
            </div>

            {/* Player cards - only show for non-human players */}
            {!isHumanPlayer && (
              <div
                className="flex flex-wrap justify-center max-w-[150px]"
                style={{
                  transform: `rotate(${position.angle}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {hand.map((card, cardIndex) => (
                  <div
                    key={cardIndex}
                    className={cn(
                      "transform transition-all duration-500 m-0.5",
                      showEndGameCards ? "rotate-0" : "rotate-180",
                    )}
                    style={{
                      zIndex: cardIndex,
                      transformOrigin: "center bottom",
                    }}
                  >
                    {showEndGameCards ? (
                      <div className="w-8 h-12">
                        <Card color={card.color} value={card.value} playable={false} />
                      </div>
                    ) : (
                      <div className="w-8 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-xs">UNO</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Center game area */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-8">
          {/* Discard pile */}
          <div className="text-center relative">
            <p className="text-white mb-2 text-sm">Discard</p>
            <div className="relative">
              <Card color={topCard.color} value={topCard.value} playable={false} />

              {/* Stacked cards indicator */}
              {stackedCards.length > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  +{stackedCards.reduce((total, card) => total + (card.value === "draw2" ? 2 : 4), 0)}
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
            <p className="text-white mb-2 text-sm">Draw ({deckCount})</p>
            <Button
              onClick={onDrawCard}
              disabled={currentPlayer !== playerName}
              className={cn(
                "w-16 h-24 bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center",
                drawAnimation && "animate-card-draw",
              )}
            >
              <span className="text-white font-bold text-lg">UNO</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Current player indicator */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
          <p className="text-white font-medium text-sm">
            Current: <span className="font-bold">{currentPlayer}</span>
            {currentPlayer === playerName && " (You)"}
          </p>
        </div>
      </div>
    </div>
  )
}
