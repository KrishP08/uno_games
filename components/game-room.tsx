"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  ArrowLeft,
  Users,
  Play,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  RefreshCw,
  Settings,
  Zap,
  AlertTriangle,
} from "lucide-react"
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
  const [gameLayout, setGameLayout] = useState("traditional")
  const [isDrawingCards, setIsDrawingCards] = useState(false)
  const [turnInProgress, setTurnInProgress] = useState(false)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [pendingDrawCount, setPendingDrawCount] = useState(0)
  const [challengeablePlayer, setChallengeablePlayer] = useState(null)

  // Audio context for sound effects
  const audioContextRef = useRef(null)
  const actionTimeoutRef = useRef(null)
  const unoTimeoutRef = useRef(null)

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

  // Scroll to player hand when game starts
  useEffect(() => {
    if (gameStarted && playerHands[playerName]?.length > 0) {
      const playerHandElement = document.getElementById("player-hand")
      if (playerHandElement) {
        playerHandElement.scrollIntoView({ behavior: "smooth", block: "center" })
      }
    }
  }, [gameStarted, playerHands, playerName])

  // Monitor UNO state and set up challenge timer
  useEffect(() => {
    const checkUnoChallenge = () => {
      const allPlayers = getAllPlayers()

      // Find players with exactly 1 card who haven't said UNO
      const challengeablePlayers = allPlayers.filter((player) => {
        const hand = playerHands[player.name] || []
        return hand.length === 1 && !playerSaidUno[player.name] && player.name !== playerName
      })

      if (challengeablePlayers.length > 0) {
        setChallengeablePlayer(challengeablePlayers[0].name)

        // Set timeout for automatic penalty if no one challenges
        if (unoTimeoutRef.current) {
          clearTimeout(unoTimeoutRef.current)
        }

        unoTimeoutRef.current = setTimeout(() => {
          // Auto-penalize if no challenge was made
          const player = challengeablePlayers[0].name
          const currentHand = playerHands[player] || []
          if (currentHand.length === 1 && !playerSaidUno[player]) {
            drawCards(player, 2)
            setGameMessage(`${player} forgot to say UNO! Draws 2 cards automatically.`)
            setChallengeablePlayer(null)
          }
        }, 3000) // 3 second window to challenge
      } else {
        setChallengeablePlayer(null)
        if (unoTimeoutRef.current) {
          clearTimeout(unoTimeoutRef.current)
        }
      }
    }

    if (gameStarted) {
      checkUnoChallenge()
    }

    return () => {
      if (unoTimeoutRef.current) {
        clearTimeout(unoTimeoutRef.current)
      }
    }
  }, [playerHands, playerSaidUno, gameStarted, playerName])

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

        if (gameStarted && playerHands[data.player.name]) {
          const newPlayerHands = { ...playerHands }
          delete newPlayerHands[data.player.name]
          setPlayerHands(newPlayerHands)
          setTimeout(checkForSinglePlayerRemaining, 1000)
        }
      }

      const handleGameStarted = (data) => {
        console.log("🎮 Game started:", data)
        if (data.gameState) {
          setDeck(data.gameState.deck || [])
          setPlayerHands(data.gameState.playerHands || {})
          setDiscardPile(data.gameState.discardPile || [])
          setCurrentPlayerIndex(data.gameState.currentPlayerIndex || 0)
          setDirection(data.gameState.direction || 1)
          setPlayerSaidUno(data.gameState.playerSaidUno || {})
          setStackedCards(data.gameState.stackedCards || [])
          setCanStack(data.gameState.canStack || false)
          setPendingDrawCount(data.gameState.pendingDrawCount || 0)
        }
        setGameStarted(true)
        setRoundWinner(null)
        setGameWinner(null)
        setShowEndGameCards(false)
        setGameMessage("Game started!")
        setTurnInProgress(false)
        setActionInProgress(false)
      }

      const handleGameUpdate = (data) => {
        console.log("🎮 Game update received:", data)

        // Prevent processing our own updates
        if (data.playerId === playerId) {
          console.log("Ignoring own update")
          return
        }

        // Prevent duplicate processing
        if (data.actionId && processedActions.has(data.actionId)) {
          console.log("Ignoring duplicate action:", data.action)
          return
        }

        if (data.actionId) {
          processedActions.add(data.actionId)
          if (processedActions.size > 100) {
            const firstAction = processedActions.values().next().value
            processedActions.delete(firstAction)
          }
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
              setPendingDrawCount(0)
              setDrawnThisTurn(0)
              setMustPlayDrawnCard(false)
              setTurnInProgress(false)
              setActionInProgress(false)
            }
            setGameMessage("New round started!")
            break

          case "PLAY_CARD":
            if (data.data && data.data.card) {
              const {
                card,
                playerHand,
                discardPile: updatedDiscardPile,
                currentPlayerIndex: newPlayerIndex,
                direction: newDirection,
                stackedCards: newStackedCards,
                canStack: newCanStack,
                pendingDrawCount: newPendingDrawCount,
                specialEffect,
              } = data.data

              console.log(`🃏 ${data.playerName} played ${card.color} ${card.value}`)

              // Update the player's hand
              setPlayerHands((prev) => ({
                ...prev,
                [data.playerName]: playerHand || [],
              }))

              // Update discard pile
              if (updatedDiscardPile && updatedDiscardPile.length > 0) {
                setDiscardPile(updatedDiscardPile)
              }

              // Update current player index
              if (newPlayerIndex !== undefined) {
                setCurrentPlayerIndex(newPlayerIndex)
                console.log(`🔄 Turn changed to player index: ${newPlayerIndex}`)
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
              if (newPendingDrawCount !== undefined) {
                setPendingDrawCount(newPendingDrawCount)
              }

              // Reset turn state
              setDrawnThisTurn(0)
              setMustPlayDrawnCard(false)
              setTurnInProgress(false)
              setActionInProgress(false)

              // Set game message
              let message = `${data.playerName} played ${card.color} ${card.value}`
              if (specialEffect?.skipTurn) message += ` - Turn skipped!`
              if (newDirection !== direction) message += " - Direction reversed!"
              if (specialEffect?.drawCardCount > 0)
                message += ` - ${specialEffect.targetPlayer} must draw ${specialEffect.drawCardCount} cards!`

              setGameMessage(message)
              playCardSound()
            }
            break

          case "DRAW_CARDS":
            if (data.data && data.playerId !== playerId) {
              const { player, numCards, drawnCards, newDeck, pendingDrawCount: newPendingDrawCount } = data.data
              console.log(`🎴 ${player} drew ${numCards} cards`)

              // Update player's hand with exact cards from server
              if (drawnCards && Array.isArray(drawnCards)) {
                setPlayerHands((prev) => {
                  const currentHand = prev[player] || []
                  return {
                    ...prev,
                    [player]: [...currentHand, ...drawnCards],
                  }
                })
              }

              // Update deck if provided
              if (newDeck) {
                setDeck(newDeck)
              }

              // Update pending draw count
              if (newPendingDrawCount !== undefined) {
                setPendingDrawCount(newPendingDrawCount)
              }

              // Reset UNO state for player who drew cards
              setPlayerSaidUno((prev) => ({
                ...prev,
                [player]: false,
              }))

              setGameMessage(`${player} drew ${numCards} card${numCards > 1 ? "s" : ""}`)
            }
            break

          case "TURN_CHANGE":
            if (data.data && data.data.currentPlayerIndex !== undefined) {
              console.log(`🔄 Turn changed to player index: ${data.data.currentPlayerIndex}`)
              setCurrentPlayerIndex(data.data.currentPlayerIndex)
              setDrawnThisTurn(0)
              setMustPlayDrawnCard(false)
              setIsDrawingCards(false)
              setTurnInProgress(false)
              setActionInProgress(false)
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

          case "UNO_CHALLENGE":
            if (data.data) {
              const { challenger, target, success } = data.data
              if (success) {
                setGameMessage(
                  `${challenger} successfully challenged ${target}! ${target} draws 2 cards for not saying UNO!`,
                )
              } else {
                setGameMessage(`${challenger} failed to challenge ${target}. ${challenger} draws 2 cards as penalty!`)
              }
            }
            break

          case "WILD_COLOR_SELECT":
            if (data.data && data.data.card) {
              const { card, currentPlayerIndex: newPlayerIndex } = data.data

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
                pendingDrawCount,
              } = data.data

              if (deck) setDeck(deck)
              if (playerHands) setPlayerHands(playerHands)
              if (discardPile) setDiscardPile(discardPile)
              if (currentPlayerIndex !== undefined) setCurrentPlayerIndex(currentPlayerIndex)
              if (direction) setDirection(direction)
              if (playerSaidUno) setPlayerSaidUno(playerSaidUno)
              if (stackedCards) setStackedCards(stackedCards)
              if (canStack !== undefined) setCanStack(canStack)
              if (pendingDrawCount !== undefined) setPendingDrawCount(pendingDrawCount)

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

  // Clear action timeout on unmount
  useEffect(() => {
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current)
      }
      if (unoTimeoutRef.current) {
        clearTimeout(unoTimeoutRef.current)
      }
    }
  }, [])

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
    const hand = playerHands[playerName] || []
    if (hand.length <= 2) {
      // Allow UNO call when 2 or fewer cards
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

  // Handle UNO challenge
  const handleUnoChallenge = (targetPlayer) => {
    if (!gameStarted || !targetPlayer) return

    const targetHand = playerHands[targetPlayer] || []

    if (targetHand.length === 1 && !playerSaidUno[targetPlayer]) {
      // Successful challenge
      drawCards(targetPlayer, 2)
      setGameMessage(`${playerName} caught ${targetPlayer}! ${targetPlayer} draws 2 cards for not saying UNO!`)

      sendGameAction("UNO_CHALLENGE", {
        challenger: playerName,
        target: targetPlayer,
        success: true,
      })
    } else {
      // Failed challenge - challenger draws 2 cards
      drawCards(playerName, 2)
      setGameMessage(`${playerName} failed to challenge ${targetPlayer}. ${playerName} draws 2 cards as penalty!`)

      sendGameAction("UNO_CHALLENGE", {
        challenger: playerName,
        target: targetPlayer,
        success: false,
      })
    }

    setChallengeablePlayer(null)
    if (unoTimeoutRef.current) {
      clearTimeout(unoTimeoutRef.current)
    }
  }

  // Check if game can start
  const canStartGame = () => {
    if (gameMode === "single") return true
    if (!currentRoom) return false

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
      const actionId = `${timestamp}-${Math.random().toString(36).substring(2, 9)}`

      const actionPayload = {
        roomId: currentRoom.id,
        action: action,
        data: {
          ...data,
          playerId,
          playerName,
          timestamp,
        },
        actionId,
      }

      console.log(`📤 Sending ${action} to server:`, actionPayload)
      socketClient.gameAction(actionPayload)
    } else {
      console.log(`Local action: ${action}`, data)
    }
  }

  const drawCards = (player, numCards, forcedCards = null) => {
    if (!gameStarted || actionInProgress) return

    // Prevent multiple simultaneous draw operations
    if (isDrawingCards && player === playerName) {
      console.log("Already drawing cards, ignoring duplicate request")
      return
    }

    if (player === playerName) {
      setIsDrawingCards(true)
      setActionInProgress(true)
    }

    let drawnCards = []
    const updatedDeck = [...deck]

    if (forcedCards && Array.isArray(forcedCards)) {
      // Use the provided cards (from server sync)
      drawnCards = forcedCards.slice(0, numCards)
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

    // Update player's hand
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

    // Update pending draw count
    const newPendingDrawCount = Math.max(0, pendingDrawCount - numCards)
    setPendingDrawCount(newPendingDrawCount)

    // Only send game action if this is the current player's action and not from server
    if (player === playerName && !forcedCards) {
      sendGameAction("DRAW_CARDS", {
        player,
        numCards: drawnCards.length,
        drawnCards,
        newDeck: updatedDeck,
        pendingDrawCount: newPendingDrawCount,
      })
    }

    setGameMessage(`${player} drew ${drawnCards.length} card${drawnCards.length > 1 ? "s" : ""}`)
    playDrawSound()

    if (player === playerName) {
      setIsDrawingCards(false)
      setDrawnThisTurn(drawnThisTurn + drawnCards.length)

      // Auto-advance turn after drawing if not force draw mode and no pending draws
      if (
        !currentRoom.settings?.forceDrawEnabled &&
        !currentRoom.settings?.unlimitedDrawEnabled &&
        newPendingDrawCount === 0
      ) {
        // Clear any existing timeout
        if (actionTimeoutRef.current) {
          clearTimeout(actionTimeoutRef.current)
        }

        actionTimeoutRef.current = setTimeout(() => {
          setActionInProgress(false)
          advanceTurn()
        }, 1500)
      } else {
        setActionInProgress(false)
      }
    }
  }

  const advanceTurn = () => {
    if (turnInProgress || actionInProgress) return

    setTurnInProgress(true)
    setActionInProgress(true)

    const allPlayers = getAllPlayers()
    const nextPlayerIndex = getNextPlayerIndex()

    setCurrentPlayerIndex(nextPlayerIndex)
    setDrawnThisTurn(0)
    setMustPlayDrawnCard(false)
    setIsDrawingCards(false)

    sendGameAction("TURN_CHANGE", { currentPlayerIndex: nextPlayerIndex })

    setGameMessage(`${allPlayers[nextPlayerIndex].name}'s turn`)

    // Clear any existing timeout
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current)
    }

    actionTimeoutRef.current = setTimeout(() => {
      setTurnInProgress(false)
      setActionInProgress(false)

      // Run computer turns in single player mode
      if (gameMode === "single" && allPlayers[nextPlayerIndex].name !== playerName) {
        setTimeout(runComputerTurns, 800)
      }
    }, 800)
  }

  const handleDrawCard = () => {
    if (!gameStarted || isDrawingCards || turnInProgress || actionInProgress) return

    const allPlayers = getAllPlayers()
    const currentPlayer = allPlayers[currentPlayerIndex].name

    if (currentPlayer !== playerName) {
      setGameMessage("It's not your turn!")
      return
    }

    // If there are pending draws from +2/+4 cards, draw those first
    if (pendingDrawCount > 0) {
      drawCards(playerName, pendingDrawCount)
      return
    }

    // Check unlimited draw setting
    if (currentRoom.settings?.unlimitedDrawEnabled) {
      // Unlimited draw - player can draw as many cards as they want
      drawCards(playerName, 1)
    } else if (currentRoom.settings?.forceDrawEnabled) {
      // Force to draw - draw until you get a playable card
      drawCards(playerName, 1)
      // Check if drawn card is playable
      setTimeout(() => {
        const topCard = getTopCard()
        const hand = playerHands[playerName] || []
        const lastCard = hand[hand.length - 1]
        if (lastCard && canPlayCard(lastCard, topCard)) {
          setMustPlayDrawnCard(true)
          setGameMessage("You drew a playable card! You must play it or draw again.")
        } else {
          // Continue drawing until playable card
          if (hand.length < 20) {
            // Safety limit
            handleDrawCard()
          } else {
            advanceTurn()
          }
        }
      }, 1000)
    } else {
      // Traditional UNO rules - only draw one card per turn
      if (drawnThisTurn === 0) {
        drawCards(playerName, 1)
      } else {
        setGameMessage("You can only draw one card per turn.")
        advanceTurn()
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
      firstCard = { color: "red", value: "1" }
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
      pendingDrawCount: 0,
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
    setPendingDrawCount(0)
    setShowEndGameCards(false)
    setUnoReminderShown(false)
    setDrawnThisTurn(0)
    setMustPlayDrawnCard(false)
    setIsDrawingCards(false)
    setTurnInProgress(false)
    setActionInProgress(false)
    setChallengeablePlayer(null)

    // Notify other players via Socket.IO
    if (socketClient && socketClient.isConnected() && gameMode === "multi") {
      try {
        console.log("📡 Sending game start to server...")
        if (roundWinner || gameWinner) {
          sendGameAction("NEW_ROUND_STARTED", gameState)
        } else {
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
    setGameStarted(false)

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

    setMustPlayDrawnCard(false)
    setIsDrawingCards(false)
    setDrawnThisTurn(0)
    setTurnInProgress(false)
    setActionInProgress(false)
    setPendingDrawCount(0)
    setChallengeablePlayer(null)

    sendGameAction("ROUND_WIN", { winner, newScores })

    if (newScores[winner] >= (currentRoom.settings?.pointsToWin || 500)) {
      setGameWinner(winner)
      setGameMessage(`${winner} wins the entire game!`)
    }
  }

  const runComputerTurns = () => {
    if (gameMode !== "single" || gameWinner || turnInProgress || actionInProgress) return

    const allPlayers = getAllPlayers()
    const currentPlayer = allPlayers[currentPlayerIndex]

    if (currentPlayer.name === playerName) return

    const hand = playerHands[currentPlayer.name] || []
    const topCard = discardPile[discardPile.length - 1]

    // Handle pending draws first
    if (pendingDrawCount > 0) {
      setTimeout(
        () => {
          drawCards(currentPlayer.name, pendingDrawCount)
          setTimeout(() => {
            advanceTurn()
          }, 1200)
        },
        1200 + Math.random() * 800,
      )
      return
    }

    // Get computer's move
    const move = getComputerMove(hand, topCard, canStack, currentRoom.settings?.difficulty || "medium")

    if (move.move === "play" && move.cardIndex !== null) {
      setTimeout(
        () => {
          playCard(move.cardIndex)
        },
        1200 + Math.random() * 800,
      )
    } else {
      setTimeout(
        () => {
          drawCards(currentPlayer.name, 1)
          setTimeout(() => {
            advanceTurn()
          }, 1200)
        },
        1200 + Math.random() * 800,
      )
    }
  }

  // Check if a card can be played
  const canPlayCard = (card, topCard) => {
    if (!card || !topCard) return false

    if (canStack) {
      return (
        (card.value === "draw2" && topCard.value === "draw2") ||
        (card.value === "wild4" && (topCard.value === "wild4" || topCard.value === "draw2"))
      )
    }

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

    if (currentPlayer !== playerName || !gameStarted || turnInProgress || actionInProgress) return

    const card = playerHands[playerName][cardIndex]
    const topCard = discardPile[discardPile.length - 1]

    if (!card || !topCard) {
      console.error("❌ Invalid card or top card:", { card, topCard })
      return
    }

    const validColors = ["red", "blue", "green", "yellow", "wild"]
    const validValues = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2", "wild", "wild4"]

    if (!validColors.includes(card.color) || !validValues.includes(card.value)) {
      console.error("❌ Invalid card detected:", card)
      setGameMessage("Invalid card detected! Removing from hand.")
      return
    }

    if (canPlayCard(card, topCard)) {
      setTurnInProgress(true)
      setActionInProgress(true)
      playCardSound()
      setAnimatingCard({ ...card, playerName })

      setDrawnThisTurn(0)
      setMustPlayDrawnCard(false)
      setIsDrawingCards(false)

      // Remove card from player's hand
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
      let newPendingDrawCount = pendingDrawCount

      // Handle special card effects
      switch (card.value) {
        case "skip":
          skipTurn = true
          nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
          break

        case "reverse":
          newDirection = direction * -1
          setDirection(newDirection)
          nextPlayerIndex = (currentPlayerIndex + newDirection + allPlayers.length) % allPlayers.length
          break

        case "draw2":
          if (currentRoom.settings?.stackingEnabled) {
            newStackedCards.push(card)
            newPendingDrawCount += 2
            const nextPlayer = allPlayers[nextPlayerIndex].name
            const nextPlayerHand = playerHands[nextPlayer] || []
            newCanStack = nextPlayerHand.some((c) => c.value === "draw2" || c.value === "wild4")

            if (!newCanStack) {
              // Next player must draw all stacked cards
              drawCardCount = newPendingDrawCount
              newStackedCards = []
              newPendingDrawCount = 0
              skipTurn = true
              nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
            }
          } else {
            drawCardCount = 2
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
      setPendingDrawCount(newPendingDrawCount)

      // Check if player has won the round
      if (newHand.length === 0) {
        handleRoundWin(playerName)
        return
      }

      // Send comprehensive game action
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
        pendingDrawCount: newPendingDrawCount,
        specialEffect: {
          skipTurn,
          drawCardCount,
          targetPlayer: drawCardCount > 0 ? allPlayers[nextPlayerIndex].name : null,
        },
      })

      // Handle drawing cards for the next player if needed
      if (drawCardCount > 0) {
        const targetPlayer = allPlayers[nextPlayerIndex].name
        setTimeout(() => {
          drawCards(targetPlayer, drawCardCount)
        }, 800)
      }

      let message = `${playerName} played ${card.color} ${card.value}`
      if (skipTurn) message += ` - Turn skipped!`
      if (newDirection !== direction) message += " - Direction reversed!"
      if (drawCardCount > 0) message += ` - ${allPlayers[nextPlayerIndex].name} draws ${drawCardCount} cards!`

      setGameMessage(message)

      // Clear any existing timeout
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current)
      }

      actionTimeoutRef.current = setTimeout(() => {
        setTurnInProgress(false)
        setActionInProgress(false)

        // Run computer turns in single player mode
        if (gameMode === "single" && allPlayers[nextPlayerIndex].name !== playerName) {
          setTimeout(runComputerTurns, 800)
        }
      }, 1200)
    } else {
      setGameMessage("Invalid move! The card must match in color or value.")
    }
  }

  const handleColorSelect = (color) => {
    if (!pendingWildCard) return

    setShowColorSelector(false)

    const card = { ...pendingWildCard, color }

    setDiscardPile((prev) => [...prev, card])
    setAnimatingCard(null)

    const allPlayers = getAllPlayers()
    let nextPlayerIndex = getNextPlayerIndex()
    let drawCardCount = 0
    let skipTurn = false
    let newPendingDrawCount = pendingDrawCount

    if (card.value === "wild4") {
      if (currentRoom.settings?.stackingEnabled) {
        newPendingDrawCount += 4
        const nextPlayer = allPlayers[nextPlayerIndex].name
        const nextPlayerHand = playerHands[nextPlayer] || []
        const canStackWild4 = nextPlayerHand.some((c) => c.value === "wild4")

        if (!canStackWild4) {
          drawCardCount = newPendingDrawCount
          newPendingDrawCount = 0
          skipTurn = true
          nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
        }
      } else {
        drawCardCount = 4
        skipTurn = true
        nextPlayerIndex = getNextPlayerIndex(nextPlayerIndex)
      }
    }

    setCurrentPlayerIndex(nextPlayerIndex)
    setPendingDrawCount(newPendingDrawCount)

    sendGameAction("WILD_COLOR_SELECT", {
      card,
      playerName,
      currentPlayerIndex: nextPlayerIndex,
      discardPile: [...discardPile, card],
      pendingDrawCount: newPendingDrawCount,
      specialEffect: {
        drawCardCount,
        skipTurn,
        targetPlayer: drawCardCount > 0 ? allPlayers[nextPlayerIndex].name : null,
      },
    })

    if (card.value === "wild4") {
      const targetPlayer = allPlayers[nextPlayerIndex].name
      setTimeout(() => {
        if (drawCardCount > 0) {
          drawCards(targetPlayer, drawCardCount)
        }
        setGameMessage(
          `Color changed to ${color}! ${targetPlayer} ${drawCardCount > 0 ? `draws ${drawCardCount} cards and ` : ""}${skipTurn ? "loses a turn!" : ""}`,
        )
      }, 800)
    } else {
      setGameMessage(`Color changed to ${color}!`)
    }

    const newHand = playerHands[playerName]
    if (newHand.length === 0) {
      handleRoundWin(playerName)
      setPendingWildCard(null)
      return
    }

    setPendingWildCard(null)

    // Clear any existing timeout
    if (actionTimeoutRef.current) {
      clearTimeout(actionTimeoutRef.current)
    }

    actionTimeoutRef.current = setTimeout(() => {
      setTurnInProgress(false)
      setActionInProgress(false)

      if (gameMode === "single" && allPlayers[nextPlayerIndex].name !== playerName) {
        setTimeout(runComputerTurns, 800)
      }
    }, 1200)
  }

  if (!currentRoom) {
    return (
      <div className="w-full max-w-4xl animate-fade-in">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-300">Loading room...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-7xl animate-fade-in">
      {/* Header with room info and controls - Steam-like design */}
      <Card className="mb-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-slate-700 shadow-2xl">
        <CardHeader className="pb-3 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <span className="text-white">{currentRoom.name}</span>
                <Badge
                  variant="secondary"
                  className="text-lg font-bold tracking-wider bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-3 py-1"
                >
                  {currentRoom.code}
                </Badge>
              </CardTitle>
              <CardDescription className="text-slate-300 mt-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="bg-slate-700 px-2 py-1 rounded text-xs">
                    {gameMode === "single" ? "🤖 Single Player" : "🌐 Multiplayer"}
                  </span>
                  <span className="bg-slate-700 px-2 py-1 rounded text-xs">
                    🎯 {currentRoom.settings?.pointsToWin || 500} pts
                  </span>
                  {currentRoom.settings?.stackingEnabled && (
                    <span className="bg-blue-600 px-2 py-1 rounded text-xs">📚 Stacking</span>
                  )}
                  {currentRoom.settings?.forceDrawEnabled && (
                    <span className="bg-red-600 px-2 py-1 rounded text-xs">🎯 Force Draw</span>
                  )}
                  {currentRoom.settings?.unlimitedDrawEnabled && (
                    <span className="bg-purple-600 px-2 py-1 rounded text-xs">♾️ Unlimited</span>
                  )}
                  {currentRoom.settings?.forcePlayEnabled && (
                    <span className="bg-green-600 px-2 py-1 rounded text-xs">🎮 Force Play</span>
                  )}
                  {currentRoom.settings?.jumpInEnabled && (
                    <span className="bg-yellow-600 px-2 py-1 rounded text-xs">⚡ Jump-In</span>
                  )}
                </div>
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className={`border-slate-600 ${voiceEnabled ? "bg-green-600 text-white" : "bg-slate-700 text-slate-300"} hover:bg-green-700`}
              >
                {voiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`border-slate-600 ${soundEnabled ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-300"} hover:bg-blue-700`}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGameLayout(gameLayout === "traditional" ? "circular" : "traditional")}
                className="border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600"
              >
                <Settings className="h-4 w-4 mr-1" />
                {gameLayout === "traditional" ? "Circular" : "Traditional"}
              </Button>
              <Button
                variant="outline"
                onClick={onLeaveRoom}
                className="border-slate-600 bg-slate-700 text-slate-300 hover:bg-red-600 hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Leave Room
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 bg-slate-800/50">
          {/* Players list with enhanced Steam-like design */}
          <div className="flex flex-wrap gap-3 mb-4">
            {getAllPlayers().map((player, index) => {
              const isCurrentTurn = getCurrentPlayerName() === player.name
              const hasOneCard = playerHands[player.name]?.length === 1
              const hasTwoCards = playerHands[player.name]?.length === 2
              const saidUno = playerSaidUno[player.name]

              return (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className={`relative p-3 rounded-lg border-2 transition-all duration-300 ${
                      isCurrentTurn
                        ? "border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 shadow-lg shadow-yellow-400/20 animate-pulse"
                        : "border-slate-600 bg-gradient-to-br from-slate-700 to-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          player.name === playerName ? "bg-green-500" : "bg-slate-500"
                        }`}
                      ></div>
                      <span
                        className={`font-medium ${player.name === playerName ? "text-green-400" : "text-slate-300"}`}
                      >
                        {player.name === currentRoom.host && "👑 "}
                        {player.name}
                      </span>
                      {playerHands[player.name] && (
                        <span className="bg-slate-600 px-2 py-1 rounded text-xs text-slate-300">
                          {playerHands[player.name].length}
                        </span>
                      )}
                      {saidUno && (
                        <span className="bg-red-500 px-2 py-1 rounded text-xs text-white animate-bounce">UNO!</span>
                      )}
                    </div>

                    {isCurrentTurn && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full animate-ping"></div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Challenge button for UNO violations */}
          {challengeablePlayer && (
            <div className="mb-4 p-3 bg-gradient-to-r from-red-800 to-red-700 border border-red-600 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 animate-bounce" />
                  <span className="text-white font-medium">{challengeablePlayer} has 1 card but didn't say UNO!</span>
                </div>
                <Button
                  onClick={() => handleUnoChallenge(challengeablePlayer)}
                  className="bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-black font-bold animate-pulse"
                >
                  ⚡ Challenge UNO!
                </Button>
              </div>
            </div>
          )}

          {/* Game status and controls */}
          <div className="flex justify-between items-center">
            <div className="text-sm">
              {gameStarted ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-green-400 font-medium">🎮 Game in progress</span>
                  {syncInProgress && <span className="text-yellow-400 text-xs">⚡ Syncing...</span>}
                  {pendingDrawCount > 0 && (
                    <span className="bg-red-600 px-2 py-1 rounded text-xs text-white animate-bounce">
                      +{pendingDrawCount} pending
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-slate-400">
                  👥 {currentRoom.players.length}/{currentRoom.maxPlayers} players
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {!gameStarted && isHost() && canStartGame() && (
                <Button
                  onClick={startGame}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Start Game
                </Button>
              )}
              {(roundWinner || gameWinner) && isHost() && (
                <Button
                  onClick={startGame}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold"
                >
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

      {/* Game message with Steam-like design */}
      {gameMessage && (
        <Alert className="mb-4 bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600 shadow-lg">
          <AlertDescription className="text-center font-medium text-slate-200 text-lg">{gameMessage}</AlertDescription>
        </Alert>
      )}

      {/* Voice command alert */}
      {voiceCommandAlert && (
        <Alert
          className={`mb-4 ${voiceCommandAlert.type === "success" ? "bg-gradient-to-r from-green-800 to-green-700 border-green-600" : "bg-gradient-to-r from-blue-800 to-blue-700 border-blue-600"}`}
        >
          <AlertDescription className="text-center text-white">{voiceCommandAlert.message}</AlertDescription>
        </Alert>
      )}

      {/* Scoreboard with enhanced design */}
      {gameStarted && (
        <div className="mb-4">
          <PlayerScoreboard
            players={getAllPlayers()}
            scores={playerScores}
            pointsToWin={currentRoom.settings?.pointsToWin || 500}
          />
        </div>
      )}

      {/* Game area */}
      {gameStarted && (
        <div className="space-y-4">
          {gameLayout === "circular" ? (
            <div className="bg-gradient-to-br from-green-900 via-green-800 to-green-900 rounded-2xl p-6 border border-green-700 shadow-2xl">
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
            </div>
          ) : (
            <>
              {/* Other players with enhanced design */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 shadow-2xl">
                <OtherPlayerCards
                  playerHands={playerHands}
                  playerName={playerName}
                  playerSaidUno={playerSaidUno}
                  currentPlayer={getCurrentPlayerName()}
                  showEndGameCards={showEndGameCards}
                  players={getAllPlayers()}
                />
              </div>

              {/* Game board with enhanced design */}
              <div className="bg-gradient-to-br from-green-900 via-green-800 to-green-900 rounded-2xl p-6 border border-green-700 shadow-2xl">
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
              </div>
            </>
          )}

          {/* Player's hand with UNO button - Enhanced Steam-like design */}
          <Card
            id="player-hand"
            className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 shadow-2xl"
          >
            <CardHeader className="pb-3 bg-gradient-to-r from-blue-900/20 to-purple-900/20">
              <div className="flex justify-between items-center">
                <CardTitle className="text-center text-white text-xl">
                  Your Hand ({playerHands[playerName]?.length || 0} cards)
                </CardTitle>

                {/* UNO Button - Show when player has 2 or fewer cards */}
                {playerHands[playerName]?.length <= 2 && playerHands[playerName]?.length > 0 && gameStarted && (
                  <Button
                    onClick={handleUnoCall}
                    disabled={playerSaidUno[playerName]}
                    className={`${
                      playerSaidUno[playerName]
                        ? "bg-gray-600 text-gray-300 cursor-not-allowed"
                        : "bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:from-red-700 hover:via-red-600 hover:to-red-700 animate-uno-button-pulse"
                    } text-white font-bold text-lg px-6 py-3 h-12 shadow-lg border-2 border-red-400 uno-button`}
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    {playerSaidUno[playerName] ? "✅ UNO Said!" : "🔊 Say UNO!"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="bg-slate-800/50">
              <PlayerHand
                cards={playerHands[playerName] || []}
                onPlayCard={playCard}
                canPlay={
                  getCurrentPlayerName() === playerName && !isDrawingCards && !turnInProgress && !actionInProgress
                }
                canStack={canStack}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Color selector modal with enhanced design */}
      {showColorSelector && <ColorSelector onSelectColor={handleColorSelect} />}

      {/* Voice control */}
      {voiceEnabled && <VoiceControl onCommand={handleVoiceCommand} onVoiceDetected={setVoiceDetected} />}

      {/* Round/Game winner with enhanced design */}
      {(roundWinner || gameWinner) && (
        <Card className="mt-4 bg-gradient-to-br from-yellow-900 via-yellow-800 to-orange-900 border-yellow-600 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="mb-4">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold mb-2 text-yellow-100">
                {gameWinner ? "🏆 Game Winner" : "🥇 Round Winner"}
              </h2>
              <h3 className="text-4xl font-bold text-yellow-300 mb-4">{roundWinner || gameWinner}!</h3>
            </div>

            {gameWinner && (
              <p className="text-xl mb-4 text-yellow-200">
                Final Score: <span className="font-bold text-yellow-300">{playerScores[gameWinner]}</span> /{" "}
                {currentRoom.settings?.pointsToWin || 500}
              </p>
            )}
            {roundWinner && !gameWinner && (
              <p className="text-xl mb-4 text-yellow-200">
                Score: <span className="font-bold text-yellow-300">{playerScores[roundWinner]}</span> /{" "}
                {currentRoom.settings?.pointsToWin || 500}
              </p>
            )}

            {isHost() && (
              <Button
                onClick={startGame}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg px-8 py-4"
              >
                <RefreshCw className="mr-2 h-5 w-5" />
                {gameWinner ? "🎮 New Game" : "▶️ Next Round"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
