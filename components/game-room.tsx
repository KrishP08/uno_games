"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Users, Play, Volume2, VolumeX, Mic, MicOff, RefreshCw, Settings } from "lucide-react"
import { PlayerHand } from "./player-hand"
import { GameBoard } from "./game-board"
import { OtherPlayerCards } from "./other-player-cards"
import { CircularGameLayout } from "./circular-game-layout"
import { ColorSelector } from "./color-selector"
import { VoiceControl } from "./voice-control"
import { RoomSharing } from "./room-sharing"
import { PlayerScoreboard } from "./player-scoreboard"
import { generateDeck, shuffleDeck, calculatePoints, getComputerMove } from "@/lib/game-utils"

export function GameRoom({ room, playerName, playerId, onLeaveRoom, gameMode, socketClient }) {
  const [processedActions] = useState(new Set())
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
  const [drawnThisTurn, setDrawnThisTurn] = useState(0)
  const [mustPlayDrawnCard, setMustPlayDrawnCard] = useState(false)
  const [gameLayout, setGameLayout] = useState("traditional") // "traditional" or "circular"
  const [isDrawingCards, setIsDrawingCards] = useState(false)

  // Audio context for sound effects
  const audioContextRef = useRef(null)

  // Check if current player is the host
  const isHost = () => {
    return currentRoom && (currentRoom.host === playerId || gameMode === "single")
  }

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
                specialEffect,
              } = data.data

              console.log(`🃏 ${data.playerName} played ${card.color} ${card.value}`)

              // IMMEDIATELY update the player's hand
              setPlayerHands((prev) => ({
                ...prev,
                [data.playerName]: playerHand || [],
              }))

              // IMMEDIATELY update discard pile
              if (updatedDiscardPile && updatedDiscardPile.length > 0) {
                setDiscardPile(updatedDiscardPile)
              } else {
                setDiscardPile((prev) => [...prev, card])
              }

              // IMMEDIATELY update current player index
              if (newPlayerIndex !== undefined) {
                setCurrentPlayerIndex(newPlayerIndex)
                console.log(`🔄 Turn changed to player index: ${newPlayerIndex}`)
              }

              // IMMEDIATELY update direction if changed
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
              setDrawnThisTurn(0)
              setMustPlayDrawnCard(false)

              // Set game message
              let message = `${data.playerName} played ${card.color} ${card.value}`
              if (specialEffect?.skipTurn) message += ` - Turn skipped!`
              if (newDirection !== direction) message += " - Direction reversed!"
              if (specialEffect?.drawCardCount > 0)
                message += ` - ${specialEffect.targetPlayer} draws ${specialEffect.drawCardCount} cards!`

              setGameMessage(message)
              playCardSound()

              // REMOVED: Don't handle special effects here as they're handled by the card player
              // This prevents duplicate card draws
            }
            break

          case "DRAW_CARDS":
            if (data.data && data.playerId !== playerId) {
              const { player, numCards, drawnCards } = data.data
              console.log(`🎴 ${player} drew ${numCards} cards`)

              // Prevent duplicate processing by checking if we already processed this action
              if (data.actionId && processedActions.has(data.actionId)) {
                console.log("Ignoring duplicate DRAW_CARDS action")
                return
              }

              // Mark this action as processed
              if (data.actionId) {
                processedActions.add(data.actionId)
                // Keep only last 100 action IDs to prevent memory leak
                if (processedActions.size > 100) {
                  const firstAction = processedActions.values().next().value
                  processedActions.delete(firstAction)
                }
              }

              // Use the exact cards from the server
              drawCards(player, numCards, drawnCards)
            }
            break

          case "TURN_CHANGE":
            if (data.data && data.data.currentPlayerIndex !== undefined) {
              console.log(`🔄 Turn changed to player index: ${data.data.currentPlayerIndex}`)
              setCurrentPlayerIndex(data.data.currentPlayerIndex)
              setDrawnThisTurn(0)
              setMustPlayDrawnCard(false)
              setIsDrawingCards(false)
            }
            break

          case "UNO_CALL":
            if (data.data && data.data.player) {
              console.log(`🔊 ${data.data.player} said UNO!`)
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

              console.log(`🌈 ${data.playerName} selected color: ${card.color}`)

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

              // Handle special effects for Wild Draw 4
              if (specialEffect && specialEffect.drawCardCount > 0 && specialEffect.targetPlayer) {
                setTimeout(() => {
                  setPlayerHands((prev) => {
                    const targetHand = prev[specialEffect.targetPlayer] || []
                    const newCards = []

                    for (let i = 0; i < specialEffect.drawCardCount; i++) {
                      newCards.push({
                        color: ["red", "blue", "green", "yellow"][Math.floor(Math.random() * 4)],
                        value: Math.floor(Math.random() * 10).toString(),
                      })
                    }

                    return {
                      ...prev,
                      [specialEffect.targetPlayer]: [...targetHand, ...newCards],
                    }
                  })
                }, 500)
              }

              setGameMessage(`${data.playerName} changed the color to ${card.color}!`)
            }
            break

          case "GAME_STATE_SYNC":
            if (data.data) {
              console.log("🔄 Received complete game state sync")
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

          case "UNO_CHALLENGE":
            if (data.data) {
              const { challenger, target } = data.data
              if (target === playerName) {
                // I was challenged, draw 2 cards
                drawCards(playerName, 2)
              }
              setGameMessage(`${challenger} challenged ${target} for not saying UNO!`)
            }
            break

          default:
            console.log("Unknown game action:", data.action)
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
  }, [
    socketClient,
    gameMode,
    playerId,
    playerHands,
    gameStarted,
    deck,
    discardPile,
    currentPlayerIndex,
    direction,
    playerSaidUno,
    stackedCards,
    canStack,
    processedActions,
  ])

  // Periodic game state synchronization for multiplayer
  useEffect(() => {
    let syncInterval

    if (gameMode === "multi" && gameStarted && socketClient?.isConnected()) {
      // Host sends periodic sync every 5 seconds
      if (isHost()) {
        syncInterval = setInterval(() => {
          console.log("🔄 Host sending periodic game state sync")

          const completeGameState = {
            deck,
            playerHands,
            discardPile,
            currentPlayerIndex,
            direction,
            playerSaidUno,
            stackedCards,
            canStack,
            gameStarted,
            roundWinner,
            gameWinner,
            playerScores,
          }

          sendGameAction("GAME_STATE_SYNC", completeGameState)
        }, 5000) // Sync every 5 seconds
      }
    }

    return () => {
      if (syncInterval) {
        clearInterval(syncInterval)
      }
    }
  }, [
    gameMode,
    gameStarted,
    socketClient,
    deck,
    playerHands,
    discardPile,
    currentPlayerIndex,
    direction,
    playerSaidUno,
    stackedCards,
    canStack,
  ])

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

  // Check if game can start
  const canStartGame = () => {
    if (gameMode === "single") return true
    if (!currentRoom) return false

    // For multiplayer, need at least 2 players and room shouldn't be full unless it's exactly at max
    const playerCount = currentRoom.players.length
    return playerCount >= 2 && playerCount <= currentRoom.maxPlayers
  }

  const getCurrentPlayerName = () => {
    const allPlayers = getAllPlayers()
    return allPlayers[currentPlayerIndex]?.name || "N/A"
  }

  const getTopCard = () => {
    return discardPile[discardPile.length - 1]
  }

  const sendGameAction = (action, data) => {
    if (socketClient && socketClient.isConnected() && gameMode === "multi") {
      const timestamp = Date.now()

      // Create comprehensive action payload
      const actionPayload = {
        roomId: currentRoom.id,
        action: action,
        data: {
          ...data,
          playerId,
          playerName,
          timestamp,
        },
      }

      console.log(`📤 Sending ${action} to server:`, actionPayload)
      socketClient.gameAction(actionPayload)
    } else {
      console.log(`Local action: ${action}`, data)
    }
  }

  const drawCards = (player, numCards, forcedCards = null) => {
    if (!gameStarted) return

    // Prevent multiple simultaneous draw operations for the same player
    if (isDrawingCards && player === playerName) {
      console.log("Already drawing cards, ignoring duplicate request")
      return
    }

    // Create a unique key for this draw operation
    const drawKey = `${player}-${numCards}-${Date.now()}`

    if (player === playerName) {
      setIsDrawingCards(true)
    }

    // Use provided cards or draw from deck
    let drawnCards = []
    const updatedDeck = [...deck]

    if (forcedCards && Array.isArray(forcedCards)) {
      // Use the provided cards (from server sync)
      drawnCards = forcedCards.slice(0, numCards) // Ensure we don't get more than requested
    } else {
      // Draw cards from the deck
      for (let i = 0; i < numCards; i++) {
        if (updatedDeck.length > 0) {
          drawnCards.push(updatedDeck.pop())
        } else {
          // Handle reshuffling
          if (discardPile.length > 1) {
            const topCard = discardPile[discardPile.length - 1]
            const cardsToShuffle = discardPile.slice(0, -1)
            updatedDeck.push(...shuffleDeck(cardsToShuffle))
            setDiscardPile([topCard])
            if (updatedDeck.length > 0) {
              drawnCards.push(updatedDeck.pop())
            }
          } else {
            setGameMessage("No more cards available!")
            break
          }
        }
      }
    }

    // Update player's hand - ensure no duplicates
    setPlayerHands((prev) => {
      const currentHand = prev[player] || []
      return {
        ...prev,
        [player]: [...currentHand, ...drawnCards],
      }
    })

    // Update deck only if we actually drew from it
    if (!forcedCards) {
      setDeck(updatedDeck)
    }

    // Reset UNO state for player who drew cards
    setPlayerSaidUno((prev) => ({
      ...prev,
      [player]: false,
    }))

    // Only send game action if this is the current player's action and not from server
    if (player === playerName && !forcedCards) {
      sendGameAction("DRAW_CARDS", {
        player,
        numCards: drawnCards.length,
        drawnCards,
      })
    }

    setGameMessage(`${player} drew ${drawnCards.length} card${drawnCards.length > 1 ? "s" : ""}`)
    playDrawSound()

    if (player === playerName) {
      setIsDrawingCards(false)
      setDrawnThisTurn(drawnThisTurn + drawnCards.length)
    }
  }

  const handleDrawCard = () => {
    if (!gameStarted || isDrawingCards) return

    const allPlayers = getAllPlayers()
    const currentPlayer = allPlayers[currentPlayerIndex].name

    if (currentPlayer !== playerName) return

    // Check unlimited draw setting
    if (currentRoom.settings?.unlimitedDrawEnabled) {
      // Unlimited draw - player can draw as many cards as they want
      drawCards(playerName, 1)
    } else if (currentRoom.settings?.forceDrawEnabled) {
      // Force to draw - draw until you get a playable card
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
    setDrawnThisTurn(0)
    setMustPlayDrawnCard(false)
    setIsDrawingCards(false)

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
    // Immediately end the game to prevent further actions
    setGameStarted(false)

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

    // Clear any pending actions
    setMustPlayDrawnCard(false)
    setIsDrawingCards(false)
    setDrawnThisTurn(0)

    sendGameAction("ROUND_WIN", { winner, newScores })

    // Check if game is over
    if (newScores[winner] >= (currentRoom.settings?.pointsToWin || 500)) {
      setGameWinner(winner)
      setGameMessage(`${winner} wins the entire game!`)
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
        return // Exit the loopp and wait for the playCard function to trigger the next turn
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
      setDrawnThisTurn(0)
      setMustPlayDrawnCard(false)
      setIsDrawingCards(false)

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

        // Send initial card played notification (without color yet)
        sendGameAction("PLAY_CARD", {
          card: { ...card },
          playerName,
          playerHand: newHand,
          discardPile: [...discardPile],
          isWildCard: true,
        })

        return
      }

      // Calculate next player and handle special cards
      let nextPlayerIndex = getNextPlayerIndex()
      let newDirection = direction
      let skipTurn = false
      let drawCardCount = 0
      let newStackedCards = [...stackedCards]
      let newCanStack = false

      // Handle special card effects
      switch (card.value) {
        case "skip":
          skipTurn = true
          // Skip the next player
          nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
          break

        case "reverse":
          newDirection = direction * -1
          setDirection(newDirection)
          // Recalculate next player with new direction
          nextPlayerIndex = (currentPlayerIndex + newDirection + allPlayers.length) % allPlayers.length
          break

        case "draw2":
          if (currentRoom.settings?.stackingEnabled) {
            newStackedCards.push(card)
            const nextPlayer = allPlayers[nextPlayerIndex].name
            const nextPlayerHand = playerHands[nextPlayer] || []
            newCanStack = nextPlayerHand.some((c) => c.value === "draw2")

            if (!newCanStack) {
              // Calculate total cards to draw from stack - FIXED
              drawCardCount = newStackedCards.length * 2 // Each draw2 = 2 cards
              newStackedCards = []
              skipTurn = true
              nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
            }
          } else {
            drawCardCount = 2 // Exactly 2 cards
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

      // Send comprehensive game action with ALL state changes
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
          drawCardCount,
          targetPlayer: drawCardCount > 0 ? allPlayers[nextPlayerIndex].name : null,
        },
      })

      // Handle drawing cards for the next player if needed
      if (drawCardCount > 0) {
        const targetPlayer = allPlayers[getNextPlayerIndex()].name
        setTimeout(() => {
          drawCards(targetPlayer, drawCardCount)
        }, 500)
      }

      // Set appropriate game message
      let message = `${playerName} played ${card.color} ${card.value}`
      if (skipTurn) message += ` - ${allPlayers[getNextPlayerIndex()].name}'s turn is skipped!`
      if (newDirection !== direction) message += " - Direction reversed!"
      if (drawCardCount > 0) message += ` - ${allPlayers[getNextPlayerIndex()].name} draws ${drawCardCount} cards!`

      setGameMessage(message)

      // Run computer turns in single player mode
      if (gameMode === "single" && allPlayers[nextPlayerIndex].name !== playerName) {
        setTimeout(runComputerTurns, 1000)
      }
    } else {
      setGameMessage("Invalid move! The card must match in color or value.")
    }
  }

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
    let drawCardCount = 0
    let skipTurn = false

    if (card.value === "wild4") {
      drawCardCount = 4
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
      discardPile: [...discardPile, card],
      specialEffect: {
        drawCardCount,
        skipTurn,
        targetPlayer: drawCardCount > 0 ? allPlayers[getNextPlayerIndex()].name : null,
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

  // Add this new function after handleUnoCall
  const handleUnoChallenge = (targetPlayer) => {
    if (!gameStarted) return

    const targetHand = playerHands[targetPlayer] || []

    if (targetHand.length === 1 && !playerSaidUno[targetPlayer]) {
      // Valid challenge - target player draws 2 cards
      drawCards(targetPlayer, 2)
      setGameMessage(`${playerName} caught ${targetPlayer}! ${targetPlayer} draws 2 cards for not saying UNO!`)

      sendGameAction("UNO_CHALLENGE", {
        challenger: playerName,
        target: targetPlayer,
      })
    } else {
      setGameMessage(`Invalid challenge! ${targetPlayer} either said UNO or doesn't have 1 card.`)
    }
  }

  if (!currentRoom) {
    return (
      <div className="w-full max-w-4xl animate-fade-in">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Loading room...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl animate-fade-in">
      {/* Header with room info and controls */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {currentRoom.name}
                <Badge variant="secondary" className="text-lg font-bold tracking-wider">
                  {currentRoom.code}
                </Badge>
              </CardTitle>
              <CardDescription>
                {gameMode === "single" ? "Single Player" : "Multiplayer"} • Points to win:{" "}
                {currentRoom.settings?.pointsToWin || 500}
                {currentRoom.settings?.stackingEnabled && " • 📚 Stacking"}
                {currentRoom.settings?.forceDrawEnabled && " • 🎯 Force Draw"}
                {currentRoom.settings?.unlimitedDrawEnabled && " • ♾️ Unlimited"}
                {currentRoom.settings?.forcePlayEnabled && " • 🎮 Force Play"}
                {currentRoom.settings?.jumpInEnabled && " • ⚡ Jump-In"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={voiceEnabled ? "bg-green-100" : ""}
              >
                {voiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={soundEnabled ? "bg-blue-100" : ""}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGameLayout(gameLayout === "traditional" ? "circular" : "traditional")}
              >
                <Settings className="h-4 w-4 mr-1" />
                {gameLayout === "traditional" ? "Circular" : "Traditional"}
              </Button>
              <Button variant="outline" onClick={onLeaveRoom}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Leave Room
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Players list with UNO challenge buttons */}
          <div className="flex flex-wrap gap-2 mb-3">
            {getAllPlayers().map((player, index) => {
              const isCurrentTurn = getCurrentPlayerName() === player.name
              const hasOneCard = playerHands[player.name]?.length === 1
              const saidUno = playerSaidUno[player.name]
              const canChallenge = hasOneCard && !saidUno && player.name !== playerName && gameStarted

              return (
                <div key={index} className="flex items-center gap-1">
                  <Badge
                    variant={player.name === playerName ? "default" : "secondary"}
                    className={`${
                      isCurrentTurn ? "ring-2 ring-yellow-400 animate-pulse" : ""
                    } ${player.name === playerName ? "bg-green-600" : ""}`}
                  >
                    {player.name === currentRoom.host && "👑 "}
                    {player.name}
                    {playerHands[player.name] && ` (${playerHands[player.name].length})`}
                    {saidUno && " 🔊"}
                  </Badge>

                  {/* UNO Challenge button */}
                  {canChallenge && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleUnoChallenge(player.name)}
                      className="text-xs px-2 py-1 h-6"
                    >
                      Challenge!
                    </Button>
                  )}

                  {/* UNO button for current player */}
                  {player.name === playerName && hasOneCard && !saidUno && gameStarted && (
                    <Button
                      size="sm"
                      onClick={handleUnoCall}
                      className="bg-red-600 hover:bg-red-700 animate-bounce text-xs px-2 py-1 h-6"
                    >
                      🔊 UNO!
                    </Button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Game status and controls */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {gameStarted ? (
                <span className="text-green-600 font-medium">🎮 Game in progress</span>
              ) : (
                <span>
                  {currentRoom.players.length}/{currentRoom.maxPlayers} players
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {!gameStarted && isHost() && canStartGame() && (
                <Button onClick={startGame} className="bg-green-600 hover:bg-green-700">
                  <Play className="mr-2 h-4 w-4" />
                  Start Game
                </Button>
              )}
              {(roundWinner || gameWinner) && isHost() && (
                <Button onClick={startGame} className="bg-blue-600 hover:bg-blue-700">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  New Round
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Room sharing (only show if not started and is host) */}
      {!gameStarted && isHost() && gameMode === "multi" && <RoomSharing room={currentRoom} />}

      {/* Game message */}
      {gameMessage && (
        <Alert className="mb-4">
          <AlertDescription className="text-center font-medium">{gameMessage}</AlertDescription>
        </Alert>
      )}

      {/* Voice command alert */}
      {voiceCommandAlert && (
        <Alert className={`mb-4 ${voiceCommandAlert.type === "success" ? "bg-green-100" : "bg-blue-100"}`}>
          <AlertDescription className="text-center">{voiceCommandAlert.message}</AlertDescription>
        </Alert>
      )}

      {/* Scoreboard */}
      {gameStarted && (
        <PlayerScoreboard
          players={getAllPlayers()}
          scores={playerScores}
          pointsToWin={currentRoom.settings?.pointsToWin || 500}
        />
      )}

      {/* Game area */}
      {gameStarted && (
        <div className="space-y-4">
          {gameLayout === "circular" ? (
            <CircularGameLayout
              players={getAllPlayers()}
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
          ) : (
            <>
              {/* Other players */}
              <OtherPlayerCards
                playerHands={playerHands}
                playerName={playerName}
                playerSaidUno={playerSaidUno}
                currentPlayer={getCurrentPlayerName()}
                showEndGameCards={showEndGameCards}
                players={getAllPlayers()}
              />

              {/* Game board */}
              <GameBoard
                topCard={getTopCard()}
                deckCount={deck.length}
                onDrawCard={handleDrawCard}
                currentPlayer={getCurrentPlayerName()}
                currentPlayerName={playerName}
                animatingCard={animatingCard}
                drawAnimation={drawAnimation}
                stackedCards={stackedCards}
              />
            </>
          )}

          {/* Player's hand */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-center">Your Hand ({playerHands[playerName]?.length || 0} cards)</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerHand
                cards={playerHands[playerName] || []}
                onPlayCard={playCard}
                canPlay={getCurrentPlayerName() === playerName && !isDrawingCards}
                canStack={canStack}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Color selector modal */}
      {showColorSelector && <ColorSelector onSelectColor={handleColorSelect} />}

      {/* Voice control */}
      {voiceEnabled && <VoiceControl onCommand={handleVoiceCommand} onVoiceDetected={setVoiceDetected} />}

      {/* Round/Game winner */}
      {(roundWinner || gameWinner) && (
        <Card className="mt-4 bg-gradient-to-r from-yellow-100 to-orange-100">
          <CardContent className="p-6 text-center">
            <h2 className="text-2xl font-bold mb-2">
              🎉 {gameWinner ? "Game Winner" : "Round Winner"}: {roundWinner || gameWinner}!
            </h2>
            {gameWinner && (
              <p className="text-lg mb-4">
                Final Score: {playerScores[gameWinner]} / {currentRoom.settings?.pointsToWin || 500}
              </p>
            )}
            {roundWinner && !gameWinner && (
              <p className="text-lg mb-4">
                Score: {playerScores[roundWinner]} / {currentRoom.settings?.pointsToWin || 500}
              </p>
            )}
            {isHost() && (
              <Button onClick={startGame} className="bg-blue-600 hover:bg-blue-700">
                <RefreshCw className="mr-2 h-4 w-4" />
                {gameWinner ? "New Game" : "Next Round"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
