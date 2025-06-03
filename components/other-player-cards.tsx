"use client"

import { Card } from "./card"

export function OtherPlayerCards({ playerHands, playerName, playerSaidUno, currentPlayer, showEndGameCards, players }) {
  // Filter out the current player
  const otherPlayers = players.filter((player) => player.name !== playerName)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {otherPlayers.map((player, index) => (
        <div
          key={index}
          className={`bg-white/10 p-4 rounded-lg ${currentPlayer === player.name ? "ring-2 ring-yellow-400" : ""}`}
        >
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-white text-lg">
              {player.name}'s Hand ({playerHands[player.name]?.length || 0} cards)
            </h2>
            {playerHands[player.name]?.length === 1 && playerSaidUno[player.name] && (
              <span className="px-2 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">UNO!</span>
            )}
          </div>
          <div className="flex flex-wrap justify-center">
            {playerHands[player.name]?.map((card, cardIndex) => (
              <div
                key={cardIndex}
                className={`transform transition-all duration-500 m-1 ${showEndGameCards ? "rotate-0" : "rotate-180"}`}
                style={{
                  zIndex: cardIndex,
                  transformOrigin: "center bottom",
                  perspective: "1000px",
                  transformStyle: "preserve-3d",
                }}
              >
                {showEndGameCards ? (
                  <Card color={card.color} value={card.value} playable={false} />
                ) : (
                  <div className="w-10 h-16 md:w-12 md:h-18 bg-red-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-lg">UNO</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
