"use client"

export function PlayerScoreboard({ players, scores, pointsToWin }) {
  return (
    <div className="bg-white/5 p-4 rounded-lg mb-4">
      <h3 className="text-lg font-medium text-white mb-2">Scoreboard</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {players.map((player, index) => (
          <div key={index} className="bg-white/10 p-2 rounded-lg text-center">
            <p className="text-white font-medium">{player.name}</p>
            <div className="flex items-center justify-center gap-1">
              <span className="text-xl font-bold text-yellow-300">{scores[player.name] || 0}</span>
              <span className="text-xs text-white/70">/ {pointsToWin}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
