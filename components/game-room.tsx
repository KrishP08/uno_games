"use client"

import { useState, useEffect, useRef } from "react"
import { generateDeck, shuffleDeck, calculatePoints, getComputerMove } from "@/lib/game-utils"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Play, Users, Volume2, VolumeX } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RoomSharing } from "@/components/room-sharing"
import { PlayerScoreboard } from "@/components/player-scoreboard"
import { CircularGameLayout } from "@/components/circular-game-layout"
import { PlayerHand } from "@/components/player-hand"
import { VoiceControl } from "@/components/voice-control"
import { ColorSelector } from "@/components/color-selector"

export function GameRoom({ room, playerName, playerId, onLeaveRoom, gameMode, socketClient }) {
  const [currentRoom, setCurrentRoom] = useState(room)
  const [deck, setDeck] = useState([])
  const [discardPile, setDiscardPile] = useState([])
  const [playerHands, setPlayerHands] = useState({})
  const [playerScores, setPlayerScores] = useState({})
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameMessage, setGameMessage] = useState("Waiting for players...")
  const [direction, setDirection] = useState(1)
  const [playerSaidUno, setPlayerSaidUno] = useState({})
  const [animatingCard, setAnimatingCard] = useState(null)
  const [drawAnimation, setDrawAnimation] = useState(false)
  const [roundWinner, setRoundWinner] = useState(null)
  const [gameWinner, setGameWinner] = useState(null)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [voiceDetected, setVoiceDetected] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [stackedCards, setStackedCards] = useState([])
  const [canStack, setCanStack] = useState(false)
  const [showEndGameCards, setShowEndGameCards] = useState(false)
  const [computerPlayers, setComputerPlayers] = useState([])
  const [voiceCommandAlert, setVoiceCommandAlert] = useState(null)
  const [showColorSelector, setShowColorSelector] = useState(false)
  const [pendingWildCard, setPendingWildCard] = useState(null)
  const [syncInProgress, setSyncInProgress] = useState(false)
  const [unoReminderShown, setUnoReminderShown] = useState(false)
  const [canDrawMore, setCanDrawMore] = useState(false)
  const [drawnThisTurn, setDrawnThisTurn] = useState(0)
  const [mustPlayDrawnCard, setMustPlayDrawnCard] = useState(false)

  // Audio context for sound effects
  const audioContextRef = useRef(null)

  // Update room state when prop changes
  useEffect(() => {
    if (room) {
      setCurrentRoom(room)
      console.log("🏠 Room updated:", room)
    }
  }, [room])

  // Set up Socket.IO listeners for real-time updates
  useEffect(() => {
    if (socketClient && gameMode === "multi") {
      console.log("🔌 Setting up Socket.IO listeners")

      const handlePlayerJoined = (data) => {
        console.log("👋 Player joined:", data)
        setCurrentRoom(data.room)
        setGameMessage(`${data.player.name} joined the room!`)
      }

      const checkForSinglePlayerRemaining = () => {
        const remainingPlayers = Object.keys(playerHands)
        if (remainingPlayers.length <= 1 && gameStarted) {
          // End the game if only one player remains
          const winner = remainingPlayers[0] || "No one"
          setGameWinner(winner)
          setGameMessage(`${winner} wins the game!`)
          setGameStarted(false)
        }
      }

      const handlePlayerLeft = (data) => {
        console.log("👋 Player left:", data)
        setCurrentRoom(data.room)
        setGameMessage(`${data.player.name} left the room`)

        // If game is active and player left, remove their hand and check for single player
        if (gameStarted && playerHands[data.player.name]) {
          const newPlayerHands = { ...playerHands }
          delete newPlayerHands[data.player.name]
          setPlayerHands(newPlayerHands)

          // Check if only one player remains
          setTimeout(checkForSinglePlayerRemaining, 1000)
        }
      }

      const handleGameStarted = (data) => {
        console.log("🎮 Game started:", data)
        if (data.gameState) {
          // Sync game state from server
          setDeck(data.gameState.deck || [])
          setPlayerHands(data.gameState.playerHands || {})
          setDiscardPile(data.gameState.discardPile || [])
          setCurrentPlayerIndex(data.gameState.currentPlayerIndex || 0)
          setDirection(data.gameState.direction || 1)
          setPlayerSaidUno(data.gameState.playerSaidUno || {})
          setStackedCards(data.gameState.stackedCards || [])
          setCanStack(data.gameState.canStack || false)
        }
        setGameStarted(true)
        setRoundWinner(null)
        setGameWinner(null)
        setShowEndGameCards(false)
        setGameMessage("Game started!")
      }

      const handleGameUpdate = (data) => {
        console.log("🎮 Game update received:", data)

        // Prevent processing our own updates
        if (data.playerId === playerId) {
          console.log("Ignoring own update")
          return
        }

        setSyncInProgress(true)

        // Handle different types of game updates
        switch (data.action) {
          case "NEW_ROUND_STARTED":
            console.log("🔄 New round started by host")
            // Reset all game state for new round
            setRoundWinner(null)
            setGameWinner(null)
            setShowEndGameCards(false)
            setGameStarted(true)

            if (data.data) {
              const { deck, playerHands, discardPile, currentPlayerIndex, direction, playerSaidUno } = data.data
              setDeck(deck || [])
              setPlayerHands(playerHands || {})
              setDiscardPile(discardPile || [])
              setCurrentPlayerIndex(currentPlayerIndex || 0)
              setDirection(direction || 1)
              setPlayerSaidUno(playerSaidUno || {})
              setStackedCards([])
              setCanStack(false)
              setCanDrawMore(false)
              setDrawnThisTurn(0)
              setMustPlayDrawnCard(false)
            }
            setGameMessage("New round started!")
            break

          case "PLAY_CARD":
            if (data.data && data.data.card) {
              const {
                card,
                playerName: cardPlayerName,
                playerHand,
                discardPile: updatedDiscardPile,
                currentPlayerIndex: newPlayerIndex,
                direction: newDirection,
                stackedCards: newStackedCards,
                canStack: newCanStack,
              } = data.data

              // Update the player's hand with the complete hand from server
              if (playerHand && data.playerName) {
                setPlayerHands((prev) => ({
                  ...prev,
                  [data.playerName]: playerHand,
                }))
              }

              // Update discard pile with the complete pile from server
              if (updatedDiscardPile) {
                setDiscardPile(updatedDiscardPile)
              }

              // Update turn system
              if (newPlayerIndex !== undefined) {
                setCurrentPlayerIndex(newPlayerIndex)
              }

              // Update direction if changed
              if (newDirection !== undefined) {
                setDirection(newDirection)
              }

              // Update stacking state
              if (newStackedCards !== undefined) {
                setStackedCards(newStackedCards)
              }
              if (newCanStack !== undefined) {
                setCanStack(newCanStack)
              }

              // Reset draw state for all players when a card is played
              setCanDrawMore(false)
              setDrawnThisTurn(0)
              setMustPlayDrawnCard(false)

              // Set game message
              setGameMessage(`${data.playerName} played ${card.color} ${card.value}`)

              // Play sound
              playCardSound()
            }
            break

          case "DRAW_CARDS":
            if (data.data) {
              const { player, numCards, drawnCards } = data.data

              // If we have the actual drawn cards, validate and use them
              if (drawnCards && drawnCards.length > 0) {
                // Validate all drawn cards to prevent invalid cards
                const validDrawnCards = drawnCards.filter((card) => {
                  const validColors = ["red", "blue", "green", "yellow", "wild"]
                  const validValues = [
                    "0",
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "6",
                    "7",
                    "8",
                    "9",
                    "skip",
                    "reverse",
                    "draw2",
                    "wild",
                    "wild4",
                  ]
                  return validColors.includes(card.color) && validValues.includes(card.value)
                })

                if (validDrawnCards.length > 0) {
                  setPlayerHands((prev) => ({
                    ...prev,
                    [player]: [...(prev[player] || []), ...validDrawnCards],
                  }))
                }
              } else {
                // Generate proper random cards from the deck instead of invalid placeholders
                const validCards = []
                const currentDeck = [...deck]

                for (let i = 0; i < numCards && currentDeck.length > 0; i++) {
                  const randomIndex = Math.floor(Math.random() * currentDeck.length)
                  validCards.push(currentDeck[randomIndex])
                }

                if (validCards.length > 0) {
                  setPlayerHands((prev) => ({
                    ...prev,
                    [player]: [...(prev[player] || []), ...validCards],
                  }))
                }
              }

              // Update deck count
              setDeck((prev) => {
                const newDeck = [...prev]
                return newDeck.slice(0, Math.max(0, newDeck.length - numCards))
              })

              // Reset UNO state for player
              setPlayerSaidUno((prev) => ({
                ...prev,
                [player]: false,
              }))

              setGameMessage(`${player} drew ${numCards} card${numCards > 1 ? "s" : ""}`)
              playDrawSound()
            }
            break

          case "PASS_TURN":
            if (data.data && data.data.currentPlayerIndex !== undefined) {
              setCurrentPlayerIndex(data.data.currentPlayerIndex)
              setGameMessage(`${data.playerName} passed their turn`)
            }
            break

          case "UNO_CALL":
            if (data.data && data.data.player) {
              setPlayerSaidUno((prev) => ({
                ...prev,
                [data.data.player]: true,
              }))
              setGameMessage(`${data.data.player} said UNO!`)
              playUnoSound()
            }
            break

          case "WILD_COLOR_SELECT":
            if (data.data && data.data.card) {
              const { card, currentPlayerIndex: newPlayerIndex, specialEffect } = data.data

              // Update the discard pile with the colored wild card
              setDiscardPile((prev) => {
                const newPile = [...prev]
                if (newPile.length > 0) {
                  newPile[newPile.length - 1] = card
                } else {
                  newPile.push(card)
                }
                return newPile
              })

              // Update current player
              if (newPlayerIndex !== undefined) {
                setCurrentPlayerIndex(newPlayerIndex)
              }

              // Handle special effects
              if (specialEffect && specialEffect.drawCards > 0 && specialEffect.targetPlayer) {
                setTimeout(() => {
                  drawCards(specialEffect.targetPlayer, specialEffect.drawCards)
                }, 500)
              }

              setGameMessage(`${data.playerName} changed the color to ${card.color}!`)
            }
            break

          case "SPECIAL_CARD":
            if (data.data && data.data.card) {
              const { card } = data.data

              // Handle special card effects
              switch (card.value) {
                case "skip":
                  setGameMessage(`${data.playerName} played Skip! Next player's turn is skipped.`)
                  break

                case "reverse":
                  setDirection((prev) => prev * -1)
                  setGameMessage(`${data.playerName} played Reverse! Direction changed.`)
                  break

                case "draw2":
                  setGameMessage(`${data.playerName} played Draw 2!`)
                  break

                case "wild":
                  // Update the top card with the selected color
                  setDiscardPile((prev) => {
                    const newPile = [...prev]
                    if (newPile.length > 0) {
                      // Replace the top card with the updated wild card that has color
                      newPile[newPile.length - 1] = { ...card }
                    }
                    return newPile
                  })
                  setGameMessage(`${data.playerName} played Wild! Color changed to ${card.color}.`)
                  break

                case "wild4":
                  // Update the top card with the selected color
                  setDiscardPile((prev) => {
                    const newPile = [...prev]
                    if (newPile.length > 0) {
                      // Replace the top card with the updated wild card that has color
                      newPile[newPile.length - 1] = { ...card }
                    }
                    return newPile
                  })
                  setGameMessage(`${data.playerName} played Wild Draw 4! Color changed to ${card.color}.`)
                  break
              }
            }
            break

          case "STACKING":
            if (data.data) {
              const {
                stackedCards: newStackedCards,
                canStack: newCanStack,
                currentPlayerIndex: newPlayerIndex,
                lastPlayedCard,
              } = data.data

              // Update stacked cards
              setStackedCards(newStackedCards || [])
              setCanStack(newCanStack || false)

              if (newPlayerIndex !== undefined) {
                setCurrentPlayerIndex(newPlayerIndex)
              }

              // Update game message for stacking
              if (newStackedCards && newStackedCards.length > 0) {
                const lastCard = lastPlayedCard || newStackedCards[newStackedCards.length - 1]
                const totalCards = newStackedCards.reduce((total, c) => {
                  return total + (c.value === "draw2" ? 2 : 4)
                }, 0)

                setGameMessage(
                  `${data.playerName} stacked a ${lastCard.color} ${lastCard.value}! Total to draw: ${totalCards}`,
                )
              }
            }
            break

          case "TURN_CHANGE":
            if (data.data && data.data.currentPlayerIndex !== undefined) {
              setCurrentPlayerIndex(data.data.currentPlayerIndex)
              // Reset draw state when turn changes
              setCanDrawMore(false)
              setDrawnThisTurn(0)
              setMustPlayDrawnCard(false)
            }
            break

          case "GAME_STATE_SYNC":
            if (data.data) {
              const {
                deck,
                playerHands,
                discardPile,
                currentPlayerIndex,
                direction,
                playerSaidUno,
                stackedCards,
                canStack,
              } = data.data

              // Update all game state at once
              if (deck) setDeck(deck)
              if (playerHands) setPlayerHands(playerHands)
              if (discardPile) setDiscardPile(discardPile)
              if (currentPlayerIndex !== undefined) setCurrentPlayerIndex(currentPlayerIndex)
              if (direction) setDirection(direction)
              if (playerSaidUno) setPlayerSaidUno(playerSaidUno)
              if (stackedCards) setStackedCards(stackedCards)
              if (canStack !== undefined) setCanStack(canStack)

              setGameMessage("Game state synchronized")
            }
            break

          case "ROUND_WIN":
            if (data.data && data.data.winner) {
              const { winner, newScores } = data.data
              setRoundWinner(winner)
              if (newScores) setPlayerScores(newScores)
              setShowEndGameCards(true)
              setGameMessage(`${winner} wins the round!`)
              playWinSound()
            }
            break

          case "REQUEST_SYNC":
            if (data.data && data.data.requesterId && isHost()) {
              console.log("🔄 Received sync request from player:", data.data.requesterId)

              // Host responds with complete game state
              const gameState = {
                deck,
                playerHands,
                discardPile,
                currentPlayerIndex,
                direction,
                playerSaidUno,
                stackedCards,
                canStack,
              }

              sendGameAction("GAME_STATE_SYNC", gameState)
            }
            break
        }

        setSyncInProgress(false)
      }

      const handleStartGameError = (error) => {
        console.log("❌ Start game error:", error)
        setGameMessage(`Error: ${error.message}`)
      }

      // Add listeners
      socketClient.on("player-joined", handlePlayerJoined)
      socketClient.on("player-left", handlePlayerLeft)
      socketClient.on("game-started", handleGameStarted)
      socketClient.on("game-update", handleGameUpdate)
      socketClient.on("start-game-error", handleStartGameError)

      // Cleanup listeners on unmount
      return () => {
        socketClient.off("player-joined", handlePlayerJoined)
        socketClient.off("player-left", handlePlayerLeft)
        socketClient.off("game-started", handleGameStarted)
        socketClient.off("game-update", handleGameUpdate)
        socketClient.off("start-game-error", handleStartGameError)
      }
    }
  }, [socketClient, gameMode, playerId, playerHands])

  // Initialize audio context
  useEffect(() => {
    if (soundEnabled && !audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      } catch (error) {
        console.log("Audio context not supported")
      }
    }
  }, [soundEnabled])

  // Play sound effect using Web Audio API
  const playSound = (frequency, duration, type = "sine") => {
    if (!soundEnabled || !audioContextRef.current) return

    try {
      const oscillator = audioContextRef.current.createOscillator()
      const gainNode = audioContextRef.current.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime)
      oscillator.type = type

      gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration)

      oscillator.start(audioContextRef.current.currentTime)
      oscillator.stop(audioContextRef.current.currentTime + duration)
    } catch (error) {
      console.log("Error playing sound:", error)
    }
  }

  // Sound effects
  const playCardSound = () => playSound(440, 0.2, "square")
  const playDrawSound = () => playSound(220, 0.3, "sawtooth")
  const playUnoSound = () => {
    playSound(523, 0.2, "sine")
    setTimeout(() => playSound(659, 0.2, "sine"), 100)
    setTimeout(() => playSound(784, 0.3, "sine"), 200)
  }
  const playWinSound = () => {
    playSound(523, 0.2, "sine")
    setTimeout(() => playSound(659, 0.2, "sine"), 150)
    setTimeout(() => playSound(784, 0.2, "sine"), 300)
    setTimeout(() => playSound(1047, 0.4, "sine"), 450)
  }
  const playUnoReminderSound = () => {
    playSound(880, 0.1, "sine")
    setTimeout(() => playSound(880, 0.1, "sine"), 200)
  }

  // Initialize game when room changes
  useEffect(() => {
    if (currentRoom) {
      const initialScores = {}
      currentRoom.players.forEach((player) => {
        initialScores[player.name] = 0
      })
      setPlayerScores(initialScores)

      const initialUnoState = {}
      currentRoom.players.forEach((player) => {
        initialUnoState[player.name] = false
      })
      setPlayerSaidUno(initialUnoState)

      // Add computer players for single player mode
      if (gameMode === "single") {
        const cpuPlayers = []
        const cpuCount = currentRoom.maxPlayers - 1

        for (let i = 0; i < cpuCount; i++) {
          cpuPlayers.push({
            id: `cpu-${i}`,
            name: `AI Player ${i + 1}`,
            difficulty: "medium",
          })
        }

        setComputerPlayers(cpuPlayers)
      }
    }
  }, [currentRoom, gameMode])

  // Handle voice commands
  const handleVoiceCommand = (command) => {
    if (command.toLowerCase().includes("uno")) {
      handleUnoCall()
      setVoiceCommandAlert({ type: "success", message: "Voice command: UNO!" })
      setTimeout(() => setVoiceCommandAlert(null), 3000)
    } else if (command.toLowerCase().includes("draw") || command.toLowerCase().includes("pick")) {
      handleDrawCard()
      setVoiceCommandAlert({ type: "info", message: "Voice command: Draw card" })
      setTimeout(() => setVoiceCommandAlert(null), 3000)
    }
  }

  // Handle UNO call via voice or button
  const handleUnoCall = () => {
    if (playerHands[playerName]?.length === 1) {
      setPlayerSaidUno({
        ...playerSaidUno,
        [playerName]: true,
      })
      setGameMessage(`${playerName} said UNO!`)
      playUnoSound()
      sendGameAction("UNO_CALL", { player: playerName })
      setUnoReminderShown(false)
    }
  }

  // Check if current player is the host
  const isHost = () => {
    return currentRoom && (currentRoom.host === playerId || gameMode === "single")
  }

  // Check if game can start
  const canStartGame = () => {
    if (gameMode === "single") return true
    if (!currentRoom) return false

    // For multiplayer, need at least 2 players and room shouldn't be full unless it's exactly at max
    const playerCount = currentRoom.players.length
    return playerCount >= 2 && playerCount <= currentRoom.maxPlayers
  }

  const sendGameAction = (action, data) => {
    if (socketClient && socketClient.isConnected() && gameMode === "multi") {
      socketClient.gameAction({
        roomId: currentRoom.id,
        action: action,
        data: { ...data, playerId },
      })
    } else {
      console.log(`Local action: ${action}`, data)
    }
  }

  const handleDrawCard = () => {
    if (!gameStarted) return

    const allPlayers = getAllPlayers()
    const currentPlayer = allPlayers[currentPlayerIndex].name

    if (currentPlayer !== playerName) return

    // Check if player can draw more cards based on the unlimited draw rule
    if (currentRoom.settings?.unlimitedDrawEnabled) {
      drawCards(playerName, 1)
    } else {
      // Traditional UNO rules - only draw one card per turn
      if (drawnThisTurn === 0) {
        drawCards(playerName, 1)
      } else {
        setGameMessage("You can only draw one card per turn.")
      }
    }
  }

  // Start a new game
  const startGame = () => {
    if (gameStarted && !roundWinner && !gameWinner) {
      console.log("⚠️ Game already started, ignoring start request")
      return
    }

    console.log("🎮 Starting game...")

    const newDeck = generateDeck()
    const shuffledDeck = shuffleDeck(newDeck)

    const hands = {}
    let updatedDeck = [...shuffledDeck]

    const allPlayers =
      gameMode === "single" ? [{ id: "host", name: playerName }, ...computerPlayers] : currentRoom.players

    allPlayers.forEach((player) => {
      const { cards, remainingDeck } = dealCardsToPlayer(updatedDeck, 7)
      hands[player.name] = cards
      updatedDeck = remainingDeck
    })

    // Get first card that's not a wild card or action card
    let firstCard
    do {
      firstCard = updatedDeck.pop()
    } while (
      firstCard &&
      (firstCard.color === "wild" || ["skip", "reverse", "draw2"].includes(firstCard.value)) &&
      updatedDeck.length > 0
    )

    // If we couldn't find a suitable card, use a number card
    if (!firstCard || firstCard.color === "wild" || ["skip", "reverse", "draw2"].includes(firstCard.value)) {
      firstCard = { color: "red", value: "1" } // Fallback card
    }

    const initialUnoState = {}
    allPlayers.forEach((player) => {
      initialUnoState[player.name] = false
    })

    const gameState = {
      deck: updatedDeck,
      playerHands: hands,
      discardPile: [firstCard],
      currentPlayerIndex: 0,
      direction: 1,
      playerSaidUno: initialUnoState,
      stackedCards: [],
      canStack: false,
    }

    // Set local state
    setDeck(updatedDeck)
    setPlayerHands(hands)
    setDiscardPile([firstCard])
    setCurrentPlayerIndex(0)
    setDirection(1)
    setGameStarted(true)
    setGameMessage(`Game started! ${allPlayers[0].name}'s turn.`)
    setPlayerSaidUno(initialUnoState)
    setRoundWinner(null)
    setGameWinner(null)
    setStackedCards([])
    setCanStack(false)
    setShowEndGameCards(false)
    setUnoReminderShown(false)
    setCanDrawMore(false)
    setDrawnThisTurn(0)
    setMustPlayDrawnCard(false)

    // Notify other players via Socket.IO
    if (socketClient && socketClient.isConnected() && gameMode === "multi") {
      try {
        console.log("📡 Sending game start to server...")
        if (roundWinner || gameWinner) {
          // This is a new round
          socketClient.gameAction({
            roomId: currentRoom.id,
            action: "NEW_ROUND_STARTED",
            gameData: gameState,
          })
        } else {
          // This is a new game
          socketClient.emit("start-game", {
            roomId: currentRoom.id,
            gameState,
          })
        }
      } catch (error) {
        console.error("❌ Failed to send game start:", error)
      }
    }

    if (gameMode === "single" && allPlayers[0].name !== playerName) {
      setTimeout(runComputerTurns, 1000)
    }
  }

  const dealCardsToPlayer = (deck, count) => {
    const cards = []
    const remainingDeck = [...deck]

    for (let i = 0; i < count; i++) {
      if (remainingDeck.length > 0) {
        cards.push(remainingDeck.pop())
      }
    }

    return { cards, remainingDeck }
  }

  const getAllPlayers = () => {
    return gameMode === "single" ? [{ id: "host", name: playerName }, ...computerPlayers] : currentRoom.players
  }

  const getNextPlayerIndex = (currentIndex = currentPlayerIndex) => {
    const allPlayers = getAllPlayers()
    const nextIndex = (currentIndex + direction + allPlayers.length) % allPlayers.length
    return nextIndex
  }

  const handleRoundWin = (winner) => {
    // Calculate scores
    const newScores = { ...playerScores }
    const allPlayers = getAllPlayers()

    allPlayers.forEach((player) => {
      if (player.name !== winner) {
        const hand = playerHands[player.name] || []
        const points = calculatePoints(hand)
        newScores[winner] += points
      }
    })

    setPlayerScores(newScores)
    setRoundWinner(winner)
    setShowEndGameCards(true)
    setGameMessage(`${winner} wins the round!`)
    playWinSound()

    sendGameAction("ROUND_WIN", { winner, newScores })

    // Check if game is over
    if (newScores[winner] >= currentRoom.settings?.winningScore) {
      setGameWinner(winner)
      setGameMessage(`${winner} wins the entire game!`)
    }
  }

  const handleSpecialCard = (card) => {
    const allPlayers = getAllPlayers()
    const nextPlayerIndex = getNextPlayerIndex()
    const nextPlayer = allPlayers[nextPlayerIndex].name

    switch (card.value) {
      case "skip":
        setGameMessage(`${playerName} played Skip! ${nextPlayer}'s turn is skipped.`)

        // Skip to the player after the next player
        const skipIndex = getNextPlayerIndex(nextPlayerIndex)
        setCurrentPlayerIndex(skipIndex)

        // Send game action
        sendGameAction("SPECIAL_CARD", { card })
        sendGameAction("TURN_CHANGE", { currentPlayerIndex: skipIndex })

        if (gameMode === "single" && allPlayers[skipIndex].name !== playerName) {
          setTimeout(runComputerTurns, 1000)
        }
        break

      case "reverse":
        setDirection((prev) => prev * -1)
        setGameMessage(`${playerName} played Reverse! Direction changed.`)

        // Move to next player
        const reverseIndex = getNextPlayerIndex()
        setCurrentPlayerIndex(reverseIndex)

        // Send game action
        sendGameAction("SPECIAL_CARD", { card })
        sendGameAction("TURN_CHANGE", { currentPlayerIndex: reverseIndex })

        if (gameMode === "single" && allPlayers[reverseIndex].name !== playerName) {
          setTimeout(runComputerTurns, 1000)
        }
        break

      case "draw2":
        drawCards(nextPlayer, 2)
        setGameMessage(`${playerName} played Draw 2! ${nextPlayer} draws 2 cards and loses a turn!`)

        // Skip to the next player
        const draw2SkipIndex = getNextPlayerIndex(nextPlayerIndex)
        setCurrentPlayerIndex(draw2SkipIndex)

        // Send game action
        sendGameAction("SPECIAL_CARD", { card })
        sendGameAction("TURN_CHANGE", { currentPlayerIndex: draw2SkipIndex })

        if (gameMode === "single" && allPlayers[draw2SkipIndex].name !== playerName) {
          setTimeout(runComputerTurns, 1000)
        }
        break

      case "wild":
        setGameMessage(`${playerName} played Wild!`)
        break

      case "wild4":
        setGameMessage(`${playerName} played Wild Draw 4!`)
        break

      default:
        console.warn("Unknown card value:", card.value)
    }
  }

  const runComputerTurns = () => {
    if (gameMode !== "single" || gameWinner) return

    const allPlayers = getAllPlayers()
    let currentPlayer = allPlayers[currentPlayerIndex]

    // Keep running turns until it's the human player's turn
    while (currentPlayer.name !== playerName && !gameWinner) {
      const hand = playerHands[currentPlayer.name] || []
      const topCard = discardPile[discardPile.length - 1]

      // Get computer's move
      const { cardIndex, action } = getComputerMove(hand, topCard, canStack, stackedCards)

      if (action === "play" && cardIndex !== null) {
        // Play the card
        const card = hand[cardIndex]
        const delay = 1000 + Math.random() * 1000 // Add a random delay to simulate thinking

        setTimeout(() => {
          // Simulate playing the card by calling the playCard function directly
          const playerIndex = Object.keys(playerHands).findIndex((name) => name === currentPlayer.name)
          playCard(cardIndex)
        }, delay)
        return // Exit the loop and wait for the playCard function to trigger the next turn
      } else if (action === "draw") {
        // Draw a card
        const delay = 1000 + Math.random() * 1000 // Add a random delay to simulate thinking
        setTimeout(() => {
          drawCards(currentPlayer.name, 1)
        }, delay)
        return // Exit the loop and wait for the drawCards function to trigger the next turn
      } else if (action === "stack") {
        // Stack a card
        const card = hand[cardIndex]
        const delay = 1000 + Math.random() * 1000 // Add a random delay to simulate thinking

        setTimeout(() => {
          // Simulate playing the card by calling the playCard function directly
          const playerIndex = Object.keys(playerHands).findIndex((name) => name === currentPlayer.name)
          playCard(cardIndex)
        }, delay)
        return // Exit the loop and wait for the playCard function to trigger the next turn
      } else {
        // Pass the turn
        const delay = 1000 + Math.random() * 1000 // Add a random delay to simulate thinking
        setTimeout(() => {
          const nextPlayerIndex = getNextPlayerIndex()
          setCurrentPlayerIndex(nextPlayerIndex)
          sendGameAction("TURN_CHANGE", { currentPlayerIndex: nextPlayerIndex })
        }, delay)
      }

      // Update current player for the next iteration
      const nextPlayerIndex = getNextPlayerIndex()
      currentPlayer = allPlayers[nextPlayerIndex]
    }
  }

  // Add a new function to periodically sync game state in multiplayer mode:

  // Add this function after the runComputerTurns function:

  // Periodically sync game state in multiplayer mode
  const syncGameState = () => {
    if (socketClient && socketClient.isConnected() && gameMode === "multi" && gameStarted) {
      // Only the host sends full game state to keep everyone in sync
      if (isHost()) {
        console.log("🔄 Host sending periodic game state sync")

        // Prepare complete game state
        const gameState = {
          deck,
          playerHands,
          discardPile,
          currentPlayerIndex,
          direction,
          playerSaidUno,
          stackedCards,
          canStack,
        }

        // Send complete game state to all players
        sendGameAction("GAME_STATE_SYNC", gameState)
      }
    }
  }

  // Add this useEffect to set up periodic sync:

  // Add this useEffect after the other useEffect hooks
  useEffect(() => {
    // Set up periodic sync for multiplayer games
    let syncInterval

    if (gameMode === "multi" && gameStarted) {
      // Sync every 10 seconds to ensure all players have the same state
      syncInterval = setInterval(syncGameState, 10000)
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval)
      }
    }
  }, [gameMode, gameStarted, isHost, deck, playerHands, discardPile, currentPlayerIndex])

  // Also enhance the requestGameStateSync function to be more robust:

  // Replace the existing requestGameStateSync function with this:
  const requestGameStateSync = () => {
    if (socketClient && socketClient.isConnected() && gameMode === "multi") {
      setSyncInProgress(true)
      setGameMessage("Requesting game state sync...")

      try {
        socketClient.gameAction({
          roomId: currentRoom.id,
          action: "REQUEST_SYNC",
          gameData: { requesterId: playerId },
        })

        // Set a timeout to reset sync status if no response
        setTimeout(() => {
          setSyncInProgress(false)
          setGameMessage("Game state sync complete or timed out")
        }, 5000)
      } catch (error) {
        console.error("Failed to send game action:", error)
        setSyncInProgress(false)
      }
    }
  }

  // Add a handler for REQUEST_SYNC in the handleGameUpdate function:

  // Add this case in the switch statement in handleGameUpdate:
  // Add this case in the switch statement in handleGameUpdate:
  const handleColorSelect = (color) => {
    if (!pendingWildCard) return

    setShowColorSelector(false)

    // Create a new card with the selected color
    const card = { ...pendingWildCard, color }

    // Update discard pile locally
    setDiscardPile((prev) => [...prev, card])
    setAnimatingCard(null)

    // Calculate next player and effects
    const allPlayers = getAllPlayers()
    let nextPlayerIndex = getNextPlayerIndex()
    let drawCards = 0
    let skipTurn = false

    if (card.value === "wild4") {
      drawCards = 4
      skipTurn = true
      nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
    }

    // Update current player
    setCurrentPlayerIndex(nextPlayerIndex)

    // Send the wild color selection with complete state
    sendGameAction("WILD_COLOR_SELECT", {
      card,
      playerName,
      currentPlayerIndex: nextPlayerIndex,
      specialEffect: {
        drawCards,
        skipTurn,
        targetPlayer: drawCards > 0 ? allPlayers[getNextPlayerIndex()].name : null,
      },
    })

    // Handle wild4 effects
    if (card.value === "wild4") {
      const targetPlayer = allPlayers[getNextPlayerIndex()].name
      setTimeout(() => {
        drawCards(targetPlayer, 4)
        setGameMessage(`Color changed to ${color}! ${targetPlayer} draws 4 cards and loses a turn!`)
      }, 500)
    } else {
      setGameMessage(`Color changed to ${color}!`)
    }

    // Check if player has won
    const newHand = playerHands[playerName]
    if (newHand.length === 0) {
      handleRoundWin(playerName)
      setPendingWildCard(null)
      return
    }

    // Check UNO reminder
    if (newHand.length === 1 && !playerSaidUno[playerName]) {
      showUnoReminder()
    }

    setPendingWildCard(null)

    // Run computer turns in single player mode
    if (gameMode === "single" && allPlayers[nextPlayerIndex].name !== playerName) {
      setTimeout(runComputerTurns, 1000)
    }
  }

  // Show UNO reminder instead of automatically drawing cards
  const showUnoReminder = () => {
    if (!unoReminderShown) {
      setUnoReminderShown(true)
      setGameMessage(`Don't forget to say UNO! Click the UNO button or you'll draw 2 cards!`)
      playUnoReminderSound()

      // Set a timer to automatically draw cards if player doesn't say UNO
      setTimeout(() => {
        if (playerHands[playerName]?.length === 1 && !playerSaidUno[playerName]) {
          drawCards(playerName, 2)
          setGameMessage(`${playerName} forgot to say UNO! Draw 2 cards.`)
          setUnoReminderShown(false)
        }
      }, 5000) // Give player 5 seconds to say UNO
    }
  }

  // Check if a card can be played
  const canPlayCard = (card, topCard) => {
    if (canStack) {
      return (
        (card.value === "draw2" && topCard.value === "draw2") ||
        (card.value === "wild4" && (topCard.value === "wild4" || topCard.value === "draw2"))
      )
    }

    // If player must play the drawn card, only allow that specific card
    if (mustPlayDrawnCard) {
      const lastDrawnCard = playerHands[playerName]?.[playerHands[playerName].length - 1]
      return (
        card === lastDrawnCard &&
        (card.color === topCard.color || card.value === topCard.value || card.color === "wild")
      )
    }

    return card.color === topCard.color || card.value === topCard.value || card.color === "wild"
  }

  const playCard = (cardIndex) => {
    const allPlayers = getAllPlayers()
    const currentPlayer = allPlayers[currentPlayerIndex].name

    if (currentPlayer !== playerName || !gameStarted) return

    const card = playerHands[playerName][cardIndex]
    const topCard = discardPile[discardPile.length - 1]

    // Safety check for card and topCard
    if (!card || !topCard) {
      console.error("❌ Invalid card or top card:", { card, topCard })
      return
    }

    // Validate the card before playing
    const validColors = ["red", "blue", "green", "yellow", "wild"]
    const validValues = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2", "wild", "wild4"]

    if (!validColors.includes(card.color) || !validValues.includes(card.value)) {
      console.error("❌ Invalid card detected:", card)
      setGameMessage("Invalid card detected! Removing from hand.")
      return
    }

    if (canPlayCard(card, topCard)) {
      // Play sound
      playCardSound()

      // Set animating card
      setAnimatingCard({ ...card, playerName })

      // Reset draw state when playing a card
      setCanDrawMore(false)
      setDrawnThisTurn(0)
      setMustPlayDrawnCard(false)

      // Remove card from player's hand IMMEDIATELY
      const newHand = [...playerHands[playerName]]
      newHand.splice(cardIndex, 1)

      setPlayerHands((prevHands) => ({
        ...prevHands,
        [playerName]: newHand,
      }))

      // For wild cards, show color selector
      if (card.color === "wild") {
        setPendingWildCard(card)
        setShowColorSelector(true)
        return
      }

      // Calculate next player and handle special cards
      let nextPlayerIndex = getNextPlayerIndex()
      let newDirection = direction
      let skipTurn = false
      let drawCards = 0
      let newStackedCards = [...stackedCards]
      let newCanStack = false

      // Handle special card effects
      switch (card.value) {
        case "skip":
          skipTurn = true
          nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex) // Skip the next player
          break

        case "reverse":
          newDirection = direction * -1
          setDirection(newDirection)
          nextPlayerIndex = (currentPlayerIndex + newDirection + allPlayers.length) % allPlayers.length
          break

        case "draw2":
          if (currentRoom.settings?.stackingEnabled) {
            newStackedCards.push(card)
            const nextPlayer = allPlayers[nextPlayerIndex].name
            const nextPlayerHand = playerHands[nextPlayer] || []
            newCanStack = nextPlayerHand.some((c) => c.value === "draw2")

            if (!newCanStack) {
              drawCards = newStackedCards.reduce((total, c) => total + (c.value === "draw2" ? 2 : 4), 0)
              newStackedCards = []
              skipTurn = true
              nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
            }
          } else {
            drawCards = 2
            skipTurn = true
            nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
          }
          break

        case "wild4":
          if (currentRoom.settings?.stackingEnabled) {
            newStackedCards.push(card)
            const nextPlayer = allPlayers[nextPlayerIndex].name
            const nextPlayerHand = playerHands[nextPlayer] || []
            newCanStack = nextPlayerHand.some((c) => c.value === "wild4" || c.value === "draw2")

            if (!newCanStack) {
              drawCards = newStackedCards.reduce((total, c) => total + (c.value === "draw2" ? 2 : 4), 0)
              newStackedCards = []
              skipTurn = true
              nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
            }
          } else {
            drawCards = 4
            skipTurn = true
            nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
          }
          break
      }

      // Update discard pile
      const newDiscardPile = [...discardPile, card]
      setDiscardPile(newDiscardPile)
      setAnimatingCard(null)

      // Update game state
      setCurrentPlayerIndex(nextPlayerIndex)
      setStackedCards(newStackedCards)
      setCanStack(newCanStack)

      // Check if player has won the round
      if (newHand.length === 0) {
        handleRoundWin(playerName)
        return
      }

      // Check if player should have said UNO
      if (newHand.length === 1 && !playerSaidUno[playerName]) {
        showUnoReminder()
      }

      // Send comprehensive game action with all state changes
      sendGameAction("PLAY_CARD", {
        card,
        cardIndex,
        playerName,
        playerHand: newHand,
        discardPile: newDiscardPile,
        currentPlayerIndex: nextPlayerIndex,
        direction: newDirection,
        stackedCards: newStackedCards,
        canStack: newCanStack,
        specialEffect: {
          skipTurn,
          drawCards,
          targetPlayer: drawCards > 0 ? allPlayers[getNextPlayerIndex()].name : null,
        },
      })

      // Handle drawing cards for the next player if needed
      if (drawCards > 0) {
        const targetPlayer = allPlayers[getNextPlayerIndex()].name
        setTimeout(() => {
          drawCards(targetPlayer, drawCards)
        }, 500)
      }

      // Set appropriate game message
      let message = `${playerName} played ${card.color} ${card.value}`
      if (skipTurn) message += ` - ${allPlayers[getNextPlayerIndex()].name}'s turn is skipped!`
      if (newDirection !== direction) message += " - Direction reversed!"
      if (drawCards > 0) message += ` - ${allPlayers[getNextPlayerIndex()].name} draws ${drawCards} cards!`

      setGameMessage(message)

      // Run computer turns in single player mode
      if (gameMode === "single" && allPlayers[nextPlayerIndex].name !== playerName) {
        setTimeout(runComputerTurns, 1000)
      }
    } else {
      setGameMessage("Invalid move! The card must match in color or value.")
    }
  }

  // Add validation to drawCards function
  const drawCards = (player, numCards) => {
    setDrawAnimation(true)
    playDrawSound()

    setTimeout(() => {
      let currentDeck = [...deck]
      const drawnCards = []

      // If deck is empty, shuffle discard pile except top card
      if (currentDeck.length < numCards) {
        const topCard = discardPile[discardPile.length - 1]
        const newDeck = shuffleDeck(discardPile.slice(0, -1))
        currentDeck = [...newDeck]
        setDiscardPile([topCard])
      }

      // Draw cards and validate them
      for (let i = 0; i < numCards; i++) {
        if (currentDeck.length > 0) {
          const drawnCard = currentDeck.pop()
          // Validate the drawn card
          const validColors = ["red", "blue", "green", "yellow", "wild"]
          const validValues = [
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "skip",
            "reverse",
            "draw2",
            "wild",
            "wild4",
          ]

          if (validColors.includes(drawnCard.color) && validValues.includes(drawnCard.value)) {
            drawnCards.push(drawnCard)
          } else {
            console.warn("Invalid card in deck:", drawnCard)
            // Generate a valid replacement card
            const colors = ["red", "blue", "green", "yellow"]
            const values = ["1", "2", "3", "4", "5"]
            const validCard = {
              color: colors[Math.floor(Math.random() * colors.length)],
              value: values[Math.floor(Math.random() * values.length)],
            }
            drawnCards.push(validCard)
          }
        }
      }

      // Update hands with validated cards
      setPlayerHands((prevHands) => ({
        ...prevHands,
        [player]: [...(prevHands[player] || []), ...drawnCards],
      }))

      // Reset UNO state for player
      setPlayerSaidUno((prevUno) => ({
        ...prevUno,
        [player]: false,
      }))

      // Update deck
      setDeck(currentDeck)
      setDrawAnimation(false)

      // If this is the current player drawing, update draw state
      if (player === playerName) {
        setDrawnThisTurn(drawnThisTurn + numCards)

        // Check if the drawn card can be played (only check valid cards)
        const topCard = discardPile[discardPile.length - 1]
        const lastDrawnCard = drawnCards[drawnCards.length - 1]

        if (lastDrawnCard && canPlayCard(lastDrawnCard, topCard)) {
          setCanDrawMore(false)
          setMustPlayDrawnCard(true)
          setGameMessage(`You drew a playable card! You must play it or draw more cards.`)
        } else {
          // Apply unlimited draw rule if enabled
          if (currentRoom.settings?.unlimitedDrawEnabled) {
            setCanDrawMore(true)
            setGameMessage(`You drew ${numCards} card${numCards > 1 ? "s" : ""}. Draw more or pass your turn.`)
          } else {
            // Traditional UNO rules - must pass turn after drawing
            setCanDrawMore(false)
            setGameMessage(`You drew ${numCards} card${numCards > 1 ? "s" : ""}. Turn passed.`)
            setTimeout(() => {
              const nextPlayerIndex = getNextPlayerIndex()
              setCurrentPlayerIndex(nextPlayerIndex)
              sendGameAction("TURN_CHANGE", { currentPlayerIndex: nextPlayerIndex })
              if (gameMode === "single") {
                setTimeout(runComputerTurns, 1000)
              }
            }, 1000)
          }
        }
      }

      // Send drawn cards to other players if this is the current player
      if (player === playerName) {
        sendGameAction("DRAW_CARDS", { player, numCards, drawnCards })
      } else {
        sendGameAction("DRAW_CARDS", { player, numCards })
      }
    }, 300)
  }

  // Handle passing turn
  const handlePassTurn = () => {
    const allPlayers = getAllPlayers()
    const currentPlayer = allPlayers[currentPlayerIndex]?.name

    // Only allow the current player to pass, and only if they've drawn at least one card
    if (currentPlayer !== playerName || !gameStarted || drawnThisTurn === 0) return

    // Reset draw state
    setCanDrawMore(false)
    setDrawnThisTurn(0)
    setMustPlayDrawnCard(false)

    // Move to next player
    const nextPlayerIndex = getNextPlayerIndex()
    setCurrentPlayerIndex(nextPlayerIndex)

    setGameMessage(`${playerName} passed their turn.`)

    // Send pass turn action
    sendGameAction("PASS_TURN", { currentPlayerIndex: nextPlayerIndex })

    // Run computer turns in single player mode
    if (gameMode === "single") {
      setTimeout(runComputerTurns, 1000)
    }
  }

  // Say UNO
  const sayUno = () => {
    handleUnoCall()
  }

  // Get current player name
  const getCurrentPlayerName = () => {
    const allPlayers = getAllPlayers()
    return gameStarted && allPlayers[currentPlayerIndex] ? allPlayers[currentPlayerIndex].name : ""
  }

  // Toggle voice control
  const toggleVoiceControl = () => {
    setVoiceEnabled(!voiceEnabled)
  }

  // Toggle sound
  const toggleSound = () => {
    setSoundEnabled(!soundEnabled)
  }

  // Get the top card safely
  const getTopCard = () => {
    if (discardPile.length > 0) {
      return discardPile[discardPile.length - 1]
    }
    // Fallback card if no discard pile
    return { color: "red", value: "1" }
  }

  // Start a new round
  const startNewRound = () => {
    setShowEndGameCards(false)
    setRoundWinner(null)
    startGame()
  }

  if (!currentRoom) {
    return (
      <div className="w-full max-w-6xl text-center">
        <p className="text-white text-xl">Loading room...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-6xl">
      {/* Voice control component */}
      {voiceEnabled && (
        <VoiceControl onCommand={handleVoiceCommand} onVoiceDetected={(detected) => setVoiceDetected(detected)} />
      )}

      {/* Wild card color selector */}
      {showColorSelector && <ColorSelector onSelectColor={handleColorSelect} />}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">{currentRoom.name}</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleVoiceControl}
              className={voiceEnabled ? "bg-green-600 text-white hover:bg-green-700" : ""}
            >
              {voiceEnabled ? <Mic className={voiceDetected ? "animate-pulse" : ""} /> : <MicOff />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleSound}
              className={soundEnabled ? "" : "bg-red-600 text-white hover:bg-red-700"}
            >
              {soundEnabled ? <Volume2 /> : <VolumeX />}
            </Button>
          </div>
          <Button variant="outline" onClick={onLeaveRoom}>
            Leave Room
          </Button>
        </div>
      </div>

      {/* Voice command alert */}
      {voiceCommandAlert && (
        <Alert className={`mb-4 ${voiceCommandAlert.type === "success" ? "bg-green-100" : "bg-blue-100"}`}>
          <AlertDescription>{voiceCommandAlert.message}</AlertDescription>
        </Alert>
      )}

      {/* UNO reminder alert */}
      {unoReminderShown && (
        <Alert className="mb-4 bg-yellow-100 border-yellow-300 animate-pulse">
          <AlertDescription className="text-yellow-800 font-bold">
            Don't forget to say UNO! Click the UNO button or you'll draw 2 cards!
          </AlertDescription>
        </Alert>
      )}

      {/* Room sharing - always show for multiplayer */}
      {gameMode === "multi" && !currentRoom.isInstant && <RoomSharing room={currentRoom} />}

      {!gameStarted && !roundWinner && !gameWinner && (
        <div className="bg-white/10 p-6 rounded-lg mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-medium text-white flex items-center gap-2">
              <Users className="h-5 w-5" />
              Players in Room ({currentRoom.players.length}/{currentRoom.maxPlayers})
            </h3>
            {gameMode === "multi" && (
              <div className="text-sm text-white/80">
                Room Code: <span className="font-bold text-yellow-300">{currentRoom.code}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {gameMode === "single" ? (
              <>
                <div className="bg-white/20 p-3 rounded-lg text-center">
                  <p className="text-white font-medium">{playerName}</p>
                  <span className="text-xs text-yellow-300">(You)</span>
                </div>
                {computerPlayers.map((cpu, index) => (
                  <div key={index} className="bg-white/20 p-3 rounded-lg text-center">
                    <p className="text-white font-medium">{cpu.name}</p>
                    <span className="text-xs text-blue-300">(CPU - {cpu.difficulty})</span>
                  </div>
                ))}
              </>
            ) : (
              currentRoom.players.map((player, index) => (
                <div key={index} className="bg-white/20 p-3 rounded-lg text-center">
                  <p className="text-white font-medium">{player.name}</p>
                  {player.id === currentRoom.host && <span className="text-xs text-yellow-300">(Host)</span>}
                  {player.name === playerName && <span className="text-xs text-green-300">(You)</span>}
                </div>
              ))
            )}
          </div>

          {/* Game start button */}
          {isHost() && canStartGame() && !gameStarted && (
            <Button
              onClick={startGame}
              className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-3 mb-4"
              disabled={gameStarted}
            >
              <Play className="mr-2 h-5 w-5" />
              Start Game ({currentRoom.players.length} players)
            </Button>
          )}

          {/* Waiting message */}
          {!canStartGame() && gameMode === "multi" && (
            <div className="text-center p-4 bg-yellow-500/20 rounded-lg mb-4">
              <p className="text-yellow-200 font-medium">
                Waiting for more players... ({currentRoom.players.length}/{currentRoom.maxPlayers})
              </p>
              <p className="text-yellow-200/80 text-sm mt-1">Need at least 2 players to start the game</p>
            </div>
          )}

          {!isHost() && gameMode === "multi" && (
            <div className="text-center p-4 bg-blue-500/20 rounded-lg mb-4">
              <p className="text-blue-200 font-medium">Waiting for host to start the game...</p>
            </div>
          )}

          {/* Game settings display */}
          <div className="mt-4 p-3 bg-white/5 rounded-lg">
            <h4 className="text-sm font-bold text-white mb-2">Game Settings:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-white/80">
              <div>
                🎯 Points to Win: <span className="text-yellow-300">{currentRoom.settings?.pointsToWin || 500}</span>
              </div>
              <div>
                📚 Card Stacking:{" "}
                <span className="text-yellow-300">
                  {currentRoom.settings?.stackingEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {roundWinner && !gameWinner && (
        <div className="bg-white/10 p-6 rounded-lg mb-6 animate-pulse">
          <h3 className="text-2xl font-bold text-center text-yellow-300 mb-4">{roundWinner} wins the round!</h3>

          <PlayerScoreboard
            players={gameMode === "single" ? [{ name: playerName }, ...computerPlayers] : currentRoom.players}
            scores={playerScores}
            pointsToWin={currentRoom.settings?.pointsToWin || 500}
          />

          {isHost() && (
            <Button onClick={startNewRound} className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white">
              Start Next Round
            </Button>
          )}
        </div>
      )}

      {gameWinner && (
        <div className="bg-white/10 p-6 rounded-lg mb-6 animate-bounce">
          <h3 className="text-3xl font-bold text-center text-yellow-300 mb-4">{gameWinner} wins the game!</h3>

          <PlayerScoreboard
            players={gameMode === "single" ? [{ name: playerName }, ...computerPlayers] : currentRoom.players}
            scores={playerScores}
            pointsToWin={currentRoom.settings?.pointsToWin || 500}
          />

          {isHost() && (
            <Button onClick={startNewRound} className="w-full mt-4 bg-red-600 hover:bg-red-700 text-white">
              Start New Game
            </Button>
          )}
        </div>
      )}

      {gameStarted && !roundWinner && !gameWinner && (
        <>
          <div className="bg-white/10 p-4 rounded-lg mb-4">
            <div className="flex justify-between items-center">
              <p className="text-white text-xl">{gameMessage}</p>

              {/* Sync button for multiplayer */}
              {gameMode === "multi" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={requestGameStateSync}
                  disabled={syncInProgress}
                  className="text-xs"
                >
                  {syncInProgress ? "Syncing..." : "Sync Game"}
                </Button>
              )}
            </div>

            {canStack && (
              <p className="text-yellow-300 text-sm mt-2">
                You can stack a {stackedCards[stackedCards.length - 1]?.value === "draw2" ? "Draw 2" : "Wild Draw 4"}{" "}
                card or draw {stackedCards.reduce((total, c) => total + (c.value === "draw2" ? 2 : 4), 0)} cards!
              </p>
            )}

            {/* Unlimited draw controls */}
            {getCurrentPlayerName() === playerName && !canStack && (
              <div className="mt-3 flex gap-2">
                <Button onClick={handleDrawCard} disabled={mustPlayDrawnCard} className="bg-blue-600 hover:bg-blue-700">
                  Draw Card {drawnThisTurn > 0 && `(${drawnThisTurn} drawn)`}
                </Button>

                {canDrawMore && (
                  <Button onClick={handlePassTurn} className="bg-orange-600 hover:bg-orange-700">
                    Pass Turn
                  </Button>
                )}

                {mustPlayDrawnCard && (
                  <div className="bg-yellow-500/20 px-3 py-1 rounded text-yellow-300 text-sm">
                    Must play the drawn card or draw more!
                  </div>
                )}
              </div>
            )}
          </div>

          <PlayerScoreboard
            players={gameMode === "single" ? [{ name: playerName }, ...computerPlayers] : currentRoom.players}
            scores={playerScores}
            pointsToWin={currentRoom.settings?.pointsToWin || 500}
          />

          {/* Circular game layout */}
          <div className="mt-4">
            <CircularGameLayout
              players={gameMode === "single" ? [{ name: playerName }, ...computerPlayers] : currentRoom.players}
              playerHands={playerHands}
              playerName={playerName}
              currentPlayer={getCurrentPlayerName()}
              playerSaidUno={playerSaidUno}
              showEndGameCards={showEndGameCards}
              topCard={getTopCard()}
              deckCount={deck.length}
              onDrawCard={handleDrawCard}
              animatingCard={animatingCard}
              drawAnimation={drawAnimation}
              stackedCards={stackedCards}
            />
          </div>

          {/* Player's hand */}
          <div className="mt-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-white text-xl">Your Hand ({playerHands[playerName]?.length || 0} cards)</h2>
              <Button
                onClick={sayUno}
                disabled={!playerHands[playerName] || playerHands[playerName].length !== 1 || playerSaidUno[playerName]}
                className={`bg-yellow-500 hover:bg-yellow-600 text-black ${unoReminderShown ? "animate-bounce" : ""}`}
              >
                Say UNO!
              </Button>
            </div>
            <PlayerHand
              cards={playerHands[playerName] || []}
              onPlayCard={playCard}
              canPlay={getCurrentPlayerName() === playerName}
              canStack={canStack}
            />
          </div>

          {/* Game rules info */}
          <div className="mt-6 p-4 bg-white/5 rounded-lg">
            <h3 className="text-lg font-medium text-white mb-2">UNO Rules (Steam Version)</h3>
            <ul className="list-disc list-inside text-white/80 text-sm space-y-1">
              <li>Draw cards until you can play or choose to pass your turn</li>
              <li>Wild Draw 4 can only be played if you don't have a matching color card</li>
              <li>Say UNO when you have one card left or draw 2 penalty cards</li>
              <li>Stacking: +2 cards can be stacked on +2, Wild +4 can be stacked on +2 or +4</li>
              <li>Skip cards make the next player lose their turn</li>
              <li>Reverse cards change the direction of play</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
