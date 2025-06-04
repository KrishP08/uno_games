"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { PlayerHand } from "@/components/player-hand"
import { CircularGameLayout } from "@/components/circular-game-layout"
import { ImprovedGameBoard } from "@/components/improved-game-board"
import { generateDeck, shuffleDeck, getComputerMove } from "@/lib/game-utils"
import { PlayerScoreboard } from "@/components/player-scoreboard"
import { RoomSharing } from "@/components/room-sharing"
import { ScoringSystem, DEFAULT_SCORING, type ScoringConfig } from "@/components/scoring-system"
import { Mic, MicOff, Volume2, VolumeX, Play, Users, Settings, Bug } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { VoiceControl } from "@/components/voice-control"
import { ColorSelector } from "@/components/color-selector"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(DEFAULT_SCORING)
  const [showSettings, setShowSettings] = useState(false)
  const [gameErrors, setGameErrors] = useState([])
  const [debugMode, setDebugMode] = useState(false)

  // Audio context for sound effects
  const audioContextRef = useRef(null)

  // Error logging function
  const logError = (error: string, context?: any) => {
    const errorEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      error,
      context,
      gameState: {
        gameStarted,
        currentPlayer: getCurrentPlayerName(),
        playerCount: Object.keys(playerHands).length,
        deckCount: deck.length,
        discardPileCount: discardPile.length,
      },
    }

    setGameErrors((prev) => [...prev.slice(-9), errorEntry]) // Keep last 10 errors
    console.error("🐛 Game Error:", errorEntry)
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
          if (data.gameState.scoringConfig) {
            setScoringConfig(data.gameState.scoringConfig)
          }
        }
        setGameStarted(true)
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

        try {
          // Handle different types of game updates
          switch (data.action) {
            case "PLAY_CARD":
              handleRemoteCardPlay(data)
              break

            case "DRAW_CARDS":
              handleRemoteCardDraw(data)
              break

            case "UNO_CALL":
              handleRemoteUnoCall(data)
              break

            case "SPECIAL_CARD":
              handleRemoteSpecialCard(data)
              break

            case "TURN_CHANGE":
              if (data.data && data.data.currentPlayerIndex !== undefined) {
                setCurrentPlayerIndex(data.data.currentPlayerIndex)
              }
              break

            case "DIRECTION_CHANGE":
              if (data.data && data.data.direction !== undefined) {
                setDirection(data.data.direction)
              }
              break

            case "STACKING":
              if (data.data) {
                setStackedCards(data.data.stackedCards || [])
                setCanStack(data.data.canStack || false)
                if (data.data.currentPlayerIndex !== undefined) {
                  setCurrentPlayerIndex(data.data.currentPlayerIndex)
                }
              }
              break

            case "GAME_STATE_SYNC":
              handleGameStateSync(data)
              break

            case "ROUND_WIN":
              handleRemoteRoundWin(data)
              break

            default:
              console.log("Unknown game action:", data.action)
          }
        } catch (error) {
          logError("Failed to process game update", { action: data.action, error: error.message })
        }

        setSyncInProgress(false)
      }

      const handleStartGameError = (error) => {
        console.log("❌ Start game error:", error)
        setGameMessage(`Error: ${error.message}`)
        logError("Game start failed", error)
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

  // Remote game action handlers
  const handleRemoteCardPlay = (data) => {
    if (data.data && data.data.card) {
      const { card } = data.data

      // Update player's hand
      if (playerHands[data.playerName]) {
        const updatedHand = [...playerHands[data.playerName]]
        // Remove a card of the same type
        const cardIndex = updatedHand.findIndex((c) => c.color === card.color && c.value === card.value)

        if (cardIndex !== -1) {
          updatedHand.splice(cardIndex, 1)

          setPlayerHands((prev) => ({
            ...prev,
            [data.playerName]: updatedHand,
          }))
        }
      }

      // Add card to discard pile
      setDiscardPile((prev) => [...prev, card])

      // Set game message
      setGameMessage(`${data.playerName} played ${card.color} ${card.value}`)

      // Play sound
      playCardSound()
    }
  }

  const handleRemoteCardDraw = (data) => {
    if (data.data) {
      const { player, numCards, drawnCards } = data.data

      // If we have the actual drawn cards, use them
      if (drawnCards && drawnCards.length > 0) {
        setPlayerHands((prev) => ({
          ...prev,
          [player]: [...(prev[player] || []), ...drawnCards],
        }))
      } else {
        // Otherwise just add placeholder cards for other players
        const placeholderCards = Array(numCards)
          .fill()
          .map(() => ({
            color: "placeholder",
            value: "card",
          }))

        setPlayerHands((prev) => ({
          ...prev,
          [player]: [...(prev[player] || []), ...placeholderCards],
        }))
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
  }

  const handleRemoteUnoCall = (data) => {
    if (data.data && data.data.player) {
      setPlayerSaidUno((prev) => ({
        ...prev,
        [data.data.player]: true,
      }))
      setGameMessage(`${data.data.player} said UNO!`)
      playUnoSound()
    }
  }

  const handleRemoteSpecialCard = (data) => {
    if (data.data && data.data.card) {
      const { card } = data.data

      switch (card.value) {
        case "skip":
          setGameMessage(`${data.playerName} played Skip! Next player's turn is skipped.`)
          break
        case "reverse":
          setGameMessage(`${data.playerName} played Reverse! Direction changed.`)
          break
        case "draw2":
          setGameMessage(`${data.playerName} played Draw 2!`)
          break
        case "wild":
          setGameMessage(`${data.playerName} played Wild! Color changed to ${card.color}.`)
          break
        case "wild4":
          setGameMessage(`${data.playerName} played Wild Draw 4! Color changed to ${card.color}.`)
          break
      }
    }
  }

  const handleGameStateSync = (data) => {
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
        scoringConfig: remoteScoring,
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
      if (remoteScoring) setScoringConfig(remoteScoring)

      setGameMessage("Game state synchronized")
    }
  }

  const handleRemoteRoundWin = (data) => {
    if (data.data && data.data.winner) {
      const { winner, newScores } = data.data
      setRoundWinner(winner)
      if (newScores) setPlayerScores(newScores)
      setShowEndGameCards(true)
      setGameMessage(`${winner} wins the round!`)
      playWinSound()
    }
  }

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

  // Calculate points using custom scoring
  const calculatePoints = (cards) => {
    let points = 0

    cards.forEach((card) => {
      if (card.value === "skip") {
        points += scoringConfig.skipCard
      } else if (card.value === "reverse") {
        points += scoringConfig.reverseCard
      } else if (card.value === "draw2") {
        points += scoringConfig.draw2Card
      } else if (card.value === "wild") {
        points += scoringConfig.wildCard
      } else if (card.value === "wild4") {
        points += scoringConfig.wild4Card
      } else {
        // Number cards
        const numValue = Number.parseInt(card.value) || 0
        points += numValue * scoringConfig.numberCards
      }
    })

    return points
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

    const playerCount = currentRoom.players.length
    return playerCount >= 2 && playerCount <= currentRoom.maxPlayers
  }

  // Start a new game
  const startGame = () => {
    if (gameStarted) {
      console.log("⚠️ Game already started, ignoring start request")
      return
    }

    try {
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

      // Get first card that's not a wild card
      let firstCard
      do {
        firstCard = updatedDeck.pop()
      } while (firstCard && firstCard.color === "wild" && updatedDeck.length > 0)

      // If we couldn't find a non-wild card, use any card
      if (!firstCard) {
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
        scoringConfig,
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
      setStackedCards([])
      setCanStack(false)
      setShowEndGameCards(false)

      // Notify other players via Socket.IO
      if (socketClient && socketClient.isConnected() && gameMode === "multi") {
        try {
          console.log("📡 Sending game start to server...")
          socketClient.emit("start-game", {
            roomId: currentRoom.id,
            gameState,
          })
        } catch (error) {
          console.error("❌ Failed to send game start:", error)
          logError("Failed to send game start", error)
        }
      }

      if (gameMode === "single" && allPlayers[0].name !== playerName) {
        setTimeout(runComputerTurns, 1000)
      }
    } catch (error) {
      logError("Failed to start game", error)
      setGameMessage("Failed to start game. Please try again.")
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

  // Handle wild card color selection
  const handleColorSelect = (color) => {
    if (!pendingWildCard) return

    setShowColorSelector(false)

    const card = { ...pendingWildCard, color }

    // Add card to discard pile
    setDiscardPile((prev) => [...prev, card])
    setAnimatingCard(null)

    // Check if player has won the round
    const newHand = playerHands[playerName]
    if (newHand.length === 0) {
      handleRoundWin(playerName)
      setPendingWildCard(null)
      return
    }

    // Check if player should have said UNO
    if (newHand.length === 1 && !playerSaidUno[playerName]) {
      drawCards(playerName, 2)
      setGameMessage(`${playerName} forgot to say UNO! Draw 2 cards.`)
    }

    // Handle special card effects
    if (card.value === "wild4") {
      const allPlayers = getAllPlayers()
      const nextPlayerIndex = getNextPlayerIndex()
      const nextPlayer = allPlayers[nextPlayerIndex].name

      // Apply draw 4 effect
      setTimeout(() => {
        drawCards(nextPlayer, 4)
        setGameMessage(`Color changed to ${color}! ${nextPlayer} draws 4 cards and loses a turn!`)

        // Skip to the next player
        const skipIndex = getNextPlayerIndex(nextPlayerIndex)
        setCurrentPlayerIndex(skipIndex)

        // Send game actions
        sendGameAction("SPECIAL_CARD", { card })
        sendGameAction("TURN_CHANGE", { currentPlayerIndex: skipIndex })

        if (gameMode === "single") {
          setTimeout(runComputerTurns, 1000)
        }
      }, 500)
    } else {
      // For regular wild cards
      setGameMessage(`Color changed to ${color}!`)

      // Move to next player
      const nextPlayerIndex = getNextPlayerIndex()
      setCurrentPlayerIndex(nextPlayerIndex)

      // Send game actions
      sendGameAction("SPECIAL_CARD", { card })
      sendGameAction("TURN_CHANGE", { currentPlayerIndex: nextPlayerIndex })

      if (gameMode === "single") {
        setTimeout(runComputerTurns, 1000)
      }
    }

    setPendingWildCard(null)
  }

  const playCard = (cardIndex) => {
    try {
      const allPlayers = getAllPlayers()
      const currentPlayer = allPlayers[currentPlayerIndex].name

      if (currentPlayer !== playerName || !gameStarted) return

      const card = playerHands[playerName][cardIndex]
      const topCard = discardPile[discardPile.length - 1]

      // Safety check for card and topCard
      if (!card || !topCard) {
        logError("Invalid card or top card", { card, topCard })
        return
      }

      const canPlayCard = canStack
        ? (card.value === "draw2" && (topCard.value === "draw2" || stackedCards.some((c) => c.value === "draw2"))) ||
          (card.value === "wild4" &&
            (topCard.value === "wild4" ||
              topCard.value === "draw2" ||
              stackedCards.some((c) => c.value === "wild4" || c.value === "draw2")))
        : card.color === topCard.color || card.value === topCard.value || card.color === "wild"

      if (canPlayCard) {
        // Play sound
        playCardSound()

        // Set animating card
        setAnimatingCard({ ...card, playerName })

        // For wild cards, show color selector
        if (card.color === "wild") {
          // Remove card from player's hand
          const newHand = [...playerHands[playerName]]
          newHand.splice(cardIndex, 1)

          setPlayerHands({
            ...playerHands,
            [playerName]: newHand,
          })

          // Store the wild card for later processing
          setPendingWildCard(card)
          setShowColorSelector(true)

          // Send card played action (without color yet)
          sendGameAction("PLAY_CARD", { card, cardIndex, playerName })

          return
        }

        // Remove card from player's hand after animation delay
        setTimeout(() => {
          const newHand = [...playerHands[playerName]]
          newHand.splice(cardIndex, 1)

          setPlayerHands({
            ...playerHands,
            [playerName]: newHand,
          })

          // Add card to discard pile
          setDiscardPile([...discardPile, card])
          setAnimatingCard(null)

          // Check if player has won the round
          if (newHand.length === 0) {
            handleRoundWin(playerName)
            return
          }

          // Check if player should have said UNO
          if (newHand.length === 1 && !playerSaidUno[playerName]) {
            drawCards(playerName, 2)
            setGameMessage(`${playerName} forgot to say UNO! Draw 2 cards.`)
          }

          // Handle stacking for +2 and +4 cards
          if (currentRoom.settings?.stackingEnabled && (card.value === "draw2" || card.value === "wild4")) {
            handleStackingCard(card, allPlayers)
          } else {
            // Handle special cards normally
            handleSpecialCard(card)
          }
        }, 500)

        // Send card played action
        sendGameAction("PLAY_CARD", { card, cardIndex, playerName })
      } else {
        setGameMessage("Invalid move! The card must match in color or value.")
      }
    } catch (error) {
      logError("Failed to play card", { cardIndex, error: error.message })
    }
  }

  // Handle stacking logic for +2 and +4 cards
  const handleStackingCard = (card, allPlayers) => {
    const newStackedCards = [...stackedCards, card]
    setStackedCards(newStackedCards)

    // Move to next player
    const nextPlayerIndex = getNextPlayerIndex()
    setCurrentPlayerIndex(nextPlayerIndex)

    // Check if next player can stack
    const nextPlayer = allPlayers[nextPlayerIndex].name
    const nextPlayerHand = playerHands[nextPlayer] || []
    const nextPlayerCanStack = nextPlayerHand.some(
      (c) =>
        (c.value === "draw2" && (card.value === "draw2" || newStackedCards.some((sc) => sc.value === "draw2"))) ||
        (c.value === "wild4" &&
          (card.value === "wild4" ||
            card.value === "draw2" ||
            newStackedCards.some((sc) => sc.value === "wild4" || sc.value === "draw2"))),
    )

    setCanStack(nextPlayerCanStack)

    // Send stacking update
    sendGameAction("STACKING", {
      stackedCards: newStackedCards,
      canStack: nextPlayerCanStack,
      currentPlayerIndex: nextPlayerIndex,
    })

    if (!nextPlayerCanStack) {
      // Calculate total cards to draw
      const totalDraw = newStackedCards.reduce((total, c) => {
        return total + (c.value === "draw2" ? 2 : 4)
      }, 0)

      setTimeout(() => {
        drawCards(nextPlayer, totalDraw)
        setGameMessage(`${nextPlayer} draws ${totalDraw} cards from stacked cards!`)
        setStackedCards([])
        setCanStack(false)

        // Skip their turn and move to next player
        setTimeout(() => {
          const skipIndex = getNextPlayerIndex(nextPlayerIndex)
          setCurrentPlayerIndex(skipIndex)

          // Send turn change
          sendGameAction("TURN_CHANGE", { currentPlayerIndex: skipIndex })

          if (gameMode === "single") {
            setTimeout(runComputerTurns, 1000)
          }
        }, 1000)
      }, 500)
    } else {
      // Next player can stack, continue with their turn
      if (gameMode === "single") {
        setTimeout(runComputerTurns, 1000)
      }
    }
  }

  // Run computer turns in sequence
  const runComputerTurns = () => {
    if (gameMode !== "single" || roundWinner || gameWinner) return

    const allPlayers = getAllPlayers()
    const currentPlayer = allPlayers[currentPlayerIndex]

    // If current player is a computer
    if (currentPlayer && computerPlayers.some((cp) => cp.name === currentPlayer.name)) {
      setTimeout(() => {
        playComputerTurn(currentPlayer)
      }, 1000)
    }
  }

  // Handle computer player turn
  const playComputerTurn = (computerPlayer) => {
    try {
      const topCard = discardPile[discardPile.length - 1]
      const computerHand = playerHands[computerPlayer.name] || []

      // Safety check
      if (!topCard) {
        logError("No top card available for computer turn")
        return
      }

      // Get computer move based on difficulty
      const { move, cardIndex, chosenColor } = getComputerMove(
        computerHand,
        topCard,
        canStack,
        computerPlayer.difficulty,
      )

      if (move === "play") {
        const card = computerHand[cardIndex]

        // Check if computer should say UNO
        if (computerHand.length === 2) {
          const willSayUno = Math.random() > 0.2 // 80% chance computer says UNO

          if (willSayUno) {
            setPlayerSaidUno({
              ...playerSaidUno,
              [computerPlayer.name]: true,
            })
            setGameMessage(`${computerPlayer.name} says UNO!`)
            playUnoSound()
          }
        }

        // Play sound
        playCardSound()

        // Set animating card
        setAnimatingCard({ ...card, playerName: computerPlayer.name })

        // Remove card from computer's hand after animation delay
        setTimeout(() => {
          const newHand = [...computerHand]
          newHand.splice(cardIndex, 1)

          setPlayerHands({
            ...playerHands,
            [computerPlayer.name]: newHand,
          })

          // Add card to discard pile
          const playedCard = card.color === "wild" ? { ...card, color: chosenColor } : card
          setDiscardPile([...discardPile, playedCard])
          setAnimatingCard(null)

          // Check if computer has won the round
          if (newHand.length === 0) {
            handleRoundWin(computerPlayer.name)
            return
          }

          // Check if computer should have said UNO
          if (newHand.length === 1 && !playerSaidUno[computerPlayer.name]) {
            drawCards(computerPlayer.name, 2)
            setGameMessage(`${computerPlayer.name} forgot to say UNO! Draw 2 cards.`)
          }

          // Handle stacking for +2 and +4 cards
          if (currentRoom.settings?.stackingEnabled && (card.value === "draw2" || card.value === "wild4")) {
            const allPlayers = getAllPlayers()
            handleStackingCard(playedCard, allPlayers)
          } else {
            // Set wild card color if needed
            if (card.value === "wild" || card.value === "wild4") {
              playedCard.color = chosenColor
              setGameMessage(`${computerPlayer.name} changed the color to ${chosenColor}!`)
            }

            // Handle special cards normally
            handleSpecialCard(playedCard, true)
          }
        }, 500)
      } else {
        // Draw a card
        drawCards(computerPlayer.name, 1)
        setGameMessage(`${computerPlayer.name} drew a card.`)

        // Move to next player
        setTimeout(() => {
          setCurrentPlayerIndex(getNextPlayerIndex())
          runComputerTurns()
        }, 1000)
      }
    } catch (error) {
      logError("Computer turn failed", { computerPlayer: computerPlayer.name, error: error.message })
    }
  }

  // Handle round win
  const handleRoundWin = (winner) => {
    try {
      // Play win sound
      playWinSound()

      // Show all players' cards
      setShowEndGameCards(true)

      // Calculate points from other players' hands using custom scoring
      let points = 0
      Object.entries(playerHands).forEach(([player, hand]) => {
        if (player !== winner) {
          points += calculatePoints(hand)
        }
      })

      // Update scores
      const newScores = {
        ...playerScores,
        [winner]: playerScores[winner] + points,
      }
      setPlayerScores(newScores)

      // Check if player has reached the target score
      setTimeout(() => {
        if (newScores[winner] >= scoringConfig.pointsToWin) {
          setGameWinner(winner)
          setGameMessage(`${winner} wins the game with ${newScores[winner]} points!`)
        } else {
          setRoundWinner(winner)
          setGameMessage(`${winner} wins the round and scores ${points} points!`)
        }
      }, 2000)

      sendGameAction("ROUND_WIN", { winner, newScores })
    } catch (error) {
      logError("Round win handling failed", { winner, error: error.message })
    }
  }

  // Check for single player remaining
  const checkForSinglePlayerRemaining = () => {
    const allPlayers = getAllPlayers()
    const activePlayers = allPlayers.filter((player) => {
      const hand = playerHands[player.name] || []
      return hand.length > 0 || player.name === playerName
    })

    if (activePlayers.length === 1 && gameStarted) {
      const winner = activePlayers[0].name
      setGameWinner(winner)
      setGameMessage(`${winner} wins! All other players have left the game.`)
      playWinSound()

      // End the game and return to room after 3 seconds
      setTimeout(() => {
        setGameStarted(false)
        setGameWinner(null)
        setRoundWinner(null)
        setGameMessage("Game ended. Returning to room...")
      }, 3000)
    }
  }

  // Start a new round
  const startNewRound = () => {
    setShowEndGameCards(false)
    setRoundWinner(null)
    startGame()
  }

  // Handle special card effects with improved +2 and +4 logic
  const handleSpecialCard = (card, isComputerTurn = false) => {
    try {
      const allPlayers = getAllPlayers()
      const nextPlayerIndex = getNextPlayerIndex()

      switch (card.value) {
        case "skip":
          setGameMessage(`${allPlayers[nextPlayerIndex].name}'s turn is skipped!`)
          // Skip to the next player
          const skipIndex = getNextPlayerIndex(nextPlayerIndex)
          setCurrentPlayerIndex(skipIndex)

          // Send turn change
          sendGameAction("SPECIAL_CARD", { card })
          sendGameAction("TURN_CHANGE", { currentPlayerIndex: skipIndex })

          if (isComputerTurn && gameMode === "single") {
            setTimeout(runComputerTurns, 1000)
          }
          break

        case "reverse":
          const newDirection = direction * -1
          setDirection(newDirection)
          setGameMessage(`Direction reversed!`)

          // In a 2-player game, reverse acts like skip
          let newPlayerIndex
          if (allPlayers.length === 2) {
            newPlayerIndex = currentPlayerIndex
          } else {
            newPlayerIndex = getPreviousPlayerIndex()
          }

          setCurrentPlayerIndex(newPlayerIndex)

          // Send direction change and turn change
          sendGameAction("SPECIAL_CARD", { card })
          sendGameAction("DIRECTION_CHANGE", { direction: newDirection })
          sendGameAction("TURN_CHANGE", { currentPlayerIndex: newPlayerIndex })

          if (isComputerTurn && gameMode === "single") {
            setTimeout(runComputerTurns, 1000)
          }
          break

        case "draw2":
          if (!canStack) {
            const targetPlayer = allPlayers[nextPlayerIndex].name

            // Apply draw 2 effect
            setTimeout(() => {
              drawCards(targetPlayer, 2)
              setGameMessage(`${targetPlayer} draws 2 cards and loses a turn!`)

              // Skip to the next player
              const draw2Index = getNextPlayerIndex(nextPlayerIndex)
              setCurrentPlayerIndex(draw2Index)

              // Send special card and turn change
              sendGameAction("SPECIAL_CARD", { card })
              sendGameAction("TURN_CHANGE", { currentPlayerIndex: draw2Index })

              if (isComputerTurn && gameMode === "single") {
                setTimeout(runComputerTurns, 1000)
              }
            }, 500)
          }
          break

        case "wild":
          // Color already set for wild cards
          setGameMessage(`Color changed to ${card.color}!`)
          setCurrentPlayerIndex(nextPlayerIndex)

          // Send special card and turn change
          sendGameAction("SPECIAL_CARD", { card })
          sendGameAction("TURN_CHANGE", { currentPlayerIndex: nextPlayerIndex })

          if (isComputerTurn && gameMode === "single") {
            setTimeout(runComputerTurns, 1000)
          }
          break

        case "wild4":
          if (!canStack) {
            // Color already set for wild cards
            const wild4Target = allPlayers[nextPlayerIndex].name

            // Apply wild draw 4 effect
            setTimeout(() => {
              drawCards(wild4Target, 4)
              setGameMessage(`Color changed to ${card.color}! ${wild4Target} draws 4 cards and loses a turn!`)

              // Skip to the next player
              const wild4Index = getNextPlayerIndex(nextPlayerIndex)
              setCurrentPlayerIndex(wild4Index)

              // Send special card and turn change
              sendGameAction("SPECIAL_CARD", { card })
              sendGameAction("TURN_CHANGE", { currentPlayerIndex: wild4Index })

              if (isComputerTurn && gameMode === "single") {
                setTimeout(runComputerTurns, 1000)
              }
            }, 500)
          }
          break

        default:
          setCurrentPlayerIndex(nextPlayerIndex)

          // Send turn change
          sendGameAction("TURN_CHANGE", { currentPlayerIndex: nextPlayerIndex })

          if (isComputerTurn && gameMode === "single") {
            setTimeout(runComputerTurns, 1000)
          }
          break
      }
    } catch (error) {
      logError("Special card handling failed", { card: card.value, error: error.message })
    }
  }

  // Get the index of the next player based on direction
  const getNextPlayerIndex = (currentIndex = currentPlayerIndex) => {
    const allPlayers = getAllPlayers()
    return (currentIndex + direction + allPlayers.length) % allPlayers.length
  }

  // Get the index of the previous player based on direction
  const getPreviousPlayerIndex = () => {
    const allPlayers = getAllPlayers()
    return (currentPlayerIndex - direction + allPlayers.length) % allPlayers.length
  }

  // Draw cards from the deck with improved error handling
  const drawCards = (player, numCards) => {
    try {
      setDrawAnimation(true)

      // Play sound
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

        // Draw cards
        for (let i = 0; i < numCards; i++) {
          if (currentDeck.length > 0) {
            drawnCards.push(currentDeck.pop())
          }
        }

        // Update hands
        setPlayerHands({
          ...playerHands,
          [player]: [...(playerHands[player] || []), ...drawnCards],
        })

        // Reset UNO state for player
        setPlayerSaidUno({
          ...playerSaidUno,
          [player]: false,
        })

        // Update deck
        setDeck(currentDeck)
        setDrawAnimation(false)

        // Send drawn cards to other players if this is the current player
        if (player === playerName) {
          sendGameAction("DRAW_CARDS", { player, numCards, drawnCards })
        } else {
          // Otherwise just send the count
          sendGameAction("DRAW_CARDS", { player, numCards })
        }
      }, 300)
    } catch (error) {
      logError("Draw cards failed", { player, numCards, error: error.message })
    }
  }

  // Handle player drawing a card
  const handleDrawCard = () => {
    try {
      const allPlayers = getAllPlayers()
      const currentPlayer = allPlayers[currentPlayerIndex]?.name

      // Only allow the current player to draw
      if (currentPlayer !== playerName || !gameStarted || canStack) return

      drawCards(playerName, 1)
      setGameMessage(`${playerName} drew a card.`)

      // Move to next player
      setTimeout(() => {
        const nextPlayerIndex = getNextPlayerIndex()
        setCurrentPlayerIndex(nextPlayerIndex)

        // Send turn change
        sendGameAction("TURN_CHANGE", { currentPlayerIndex: nextPlayerIndex })

        // Run computer turns in single player mode
        if (gameMode === "single") {
          setTimeout(runComputerTurns, 1000)
        }
      }, 1000)
    } catch (error) {
      logError("Handle draw card failed", error)
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

  // Send game action via Socket.IO
  const sendGameAction = (action, data) => {
    if (socketClient && socketClient.isConnected() && gameMode === "multi") {
      try {
        socketClient.gameAction({
          roomId: currentRoom.id,
          action,
          gameData: data,
        })
      } catch (error) {
        console.error("Failed to send game action:", error)
        logError("Failed to send game action", { action, error: error.message })
      }
    }
  }

  // Request full game state sync from other players
  const requestGameStateSync = () => {
    if (socketClient && socketClient.isConnected() && gameMode === "multi") {
      try {
        socketClient.gameAction({
          roomId: currentRoom.id,
          action: "REQUEST_SYNC",
          gameData: { requesterId: playerId },
        })
      } catch (error) {
        console.error("Failed to request game state sync:", error)
        logError("Failed to request sync", error)
      }
    }
  }

  // Get the top card safely
  const getTopCard = () => {
    if (discardPile.length > 0) {
      return discardPile[discardPile.length - 1]
    }
    // Fallback card if no discard pile
    return { color: "red", value: "1" }
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
      {showColorSelector && pendingWildCard && (
        <ColorSelector
          onSelectColor={handleColorSelect}
          playerName={playerName}
          cardType={pendingWildCard.value === "wild4" ? "Wild Draw 4" : "Wild"}
        />
      )}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">{currentRoom.name}</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
              className="bg-white/10 text-white hover:bg-white/20"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDebugMode(!debugMode)}
              className={
                debugMode ? "bg-red-600 text-white hover:bg-red-700" : "bg-white/10 text-white hover:bg-white/20"
              }
            >
              <Bug className="h-4 w-4" />
            </Button>
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

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6">
          <Tabs defaultValue="scoring" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="scoring">Scoring System</TabsTrigger>
              <TabsTrigger value="debug">Debug Info</TabsTrigger>
            </TabsList>
            <TabsContent value="scoring">
              <ScoringSystem currentScoring={scoringConfig} onScoringChange={setScoringConfig} />
            </TabsContent>
            <TabsContent value="debug">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bug className="h-5 w-5" />
                    Debug Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Game State</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>Game Started: {gameStarted ? "Yes" : "No"}</div>
                        <div>Current Player: {getCurrentPlayerName()}</div>
                        <div>Direction: {direction === 1 ? "Clockwise" : "Counter-clockwise"}</div>
                        <div>Can Stack: {canStack ? "Yes" : "No"}</div>
                        <div>Deck Count: {deck.length}</div>
                        <div>Discard Pile: {discardPile.length}</div>
                      </div>
                    </div>

                    {gameErrors.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2 text-red-600">Recent Errors ({gameErrors.length})</h4>
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {gameErrors.slice(-5).map((error) => (
                            <div key={error.id} className="text-xs bg-red-50 p-2 rounded border border-red-200">
                              <div className="font-mono text-red-800">{error.error}</div>
                              <div className="text-red-600 mt-1">{new Date(error.timestamp).toLocaleTimeString()}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Voice command alert */}
      {voiceCommandAlert && (
        <Alert className={`mb-4 ${voiceCommandAlert.type === "success" ? "bg-green-100" : "bg-blue-100"}`}>
          <AlertDescription>{voiceCommandAlert.message}</AlertDescription>
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
                🎯 Points to Win: <span className="text-yellow-300">{scoringConfig.pointsToWin}</span>
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
            pointsToWin={scoringConfig.pointsToWin}
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
            pointsToWin={scoringConfig.pointsToWin}
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
          </div>

          <PlayerScoreboard
            players={gameMode === "single" ? [{ name: playerName }, ...computerPlayers] : currentRoom.players}
            scores={playerScores}
            pointsToWin={scoringConfig.pointsToWin}
          />

          {/* Improved game board */}
          <div className="mt-4">
            <ImprovedGameBoard
              topCard={getTopCard()}
              deckCount={deck.length}
              onDrawCard={handleDrawCard}
              currentPlayer={getCurrentPlayerName()}
              currentPlayerName={playerName}
              animatingCard={animatingCard}
              drawAnimation={drawAnimation}
              stackedCards={stackedCards}
              direction={direction}
              canStack={canStack}
            />
          </div>

          {/* Circular game layout for other players */}
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
                className="bg-yellow-500 hover:bg-yellow-600 text-black"
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

          {/* Voice control instructions */}
          {voiceEnabled && (
            <div className="mt-6 p-4 bg-white/5 rounded-lg">
              <h3 className="text-lg font-medium text-white mb-2">Voice Commands</h3>
              <ul className="list-disc list-inside text-white/80">
                <li>Say "UNO" when you have one card left</li>
                <li>Say "Draw" or "Pick" to draw a card</li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
