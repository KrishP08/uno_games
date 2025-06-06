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
    <div className="flex flex-wrap justify-center gap-2 p-4">
      {cards.map((card, index) => {
        // Determine if this card can be stacked (only draw2 or wild4 when stacking is active)
        const isStackable = canStack && (card.value === "draw2" || card.value === "wild4")

        return (
          <div
            key={index}
            className={`transform transition-all duration-300 hover:scale-105 ${
              isStackable ? "animate-glow-pulse" : ""
            } ${canPlay ? "hover:-translate-y-3" : ""}`}
            style={{
              zIndex: index,
              transform: `translateX(${index * -8}px)`, // Slight overlap for Steam-like effect
            }}
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
