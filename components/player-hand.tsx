"use client"
import { Card } from "./card"

interface PlayerHandProps {
  cards: Array<{ color: string; value: string }>
  onPlayCard: (index: number) => void
  canPlay: boolean
  canStack?: boolean
}

export function PlayerHand({ cards, onPlayCard, canPlay, canStack = false }: PlayerHandProps) {
  return (
    <div className="flex flex-wrap justify-center">
      {cards.map((card, index) => {
        // Determine if this card can be stacked (only draw2 or wild4 when stacking is active)
        const isStackable = canStack && (card.value === "draw2" || card.value === "wild4")

        return (
          <div
            key={index}
            className={`m-1 transform hover:-translate-y-2 transition-transform duration-300 ${isStackable ? "animate-pulse" : ""}`}
            style={{ zIndex: index }}
          >
            <Card
              color={card.color}
              value={card.value}
              onClick={() => onPlayCard(index)}
              playable={canPlay && (!canStack || isStackable)}
            />
          </div>
        )
      })}
    </div>
  )
}
