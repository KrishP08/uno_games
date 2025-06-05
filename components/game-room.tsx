"use client"

import { useState, useEffect, useRef } from "react"
import { generateDeck, shuffleDeck, calculatePoints, getComputerMove } from "@/lib/game-utils"

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

  const getCurrentPlayerName = () => {
    const allPlayers = getAllPlayers()
    return allPlayers[currentPlayerIndex]?.name || "N/A"
  }

  const getTopCard = () => {
    return discardPile[discardPile.length - 1]
  }

  const sendGameAction = (action, data) => {
    if (socketClient && socketClient.isConnected() && gameMode === "multi") {
      // Add timestamp to help track and order events
      const timestamp = Date.now()

      // Create a comprehensive action payload with all necessary state
      const actionPayload = {
        roomId: currentRoom.id,
        action: action,
        data: {
          ...data,
          playerId,
          timestamp,
          // Include critical game state with every action for better sync
          gameState: {
            currentPlayerIndex,
            direction,
            stackedCards,
            canStack,
          },
        },
      }

      console.log(`📤 Sending ${action} to server:`, actionPayload)
      socketClient.gameAction(actionPayload)

      // For debugging
      console.log(`Local state after ${action}:`, {
        currentPlayer: getCurrentPlayerName(),
        topCard: getTopCard(),
        playerHands: Object.keys(playerHands).map((name) => ({ name, cards: playerHands[name]?.length })),
      })
    } else {
      console.log(`Local action: ${action}`, data)
    }
  }

  const drawCards = (player, numCards) => {
    if (!gameStarted) return

    const allPlayers = getAllPlayers()
    const currentPlayer = allPlayers[currentPlayerIndex].name

    if (currentPlayer !== playerName) return

    // Draw cards from the deck
    const drawnCards = []
    const updatedDeck = [...deck]

    for (let i = 0; i < numCards; i++) {
      if (updatedDeck.length > 0) {
        drawnCards.push(updatedDeck.pop())
      } else {
        // Handle reshuffling the discard pile into the deck if empty
        if (discardPile.length > 1) {
          const topCard = discardPile.pop() // Keep the top card
          updatedDeck.push(...discardPile) // Add discard pile to deck
          setDiscardPile([topCard]) // Reset discard pile with the top card
          shuffleDeck(updatedDeck) // Shuffle the deck
          updatedDeck.pop()
          drawnCards.push(updatedDeck.pop())
        } else {
          setGameMessage("No more cards in the deck or discard pile!")
          break
        }
      }
    }

    // Update player's hand
    setPlayerHands((prev) => ({
      ...prev,
      [player]: [...(prev[player] || []), ...drawnCards],
    }))

    // Update deck
    setDeck(updatedDeck)

    // Reset UNO state for player
    setPlayerSaidUno((prev) => ({
      ...prev,
      [player]: false,
    }))

    // Set game message
    setGameMessage(`${player} drew ${numCards} card${numCards > 1 ? "s" : ""}`)
    playDrawSound()

    // Send game action
    sendGameAction("DRAW_CARDS", { player, numCards, drawnCards })

    // If player drew a card on their turn, set the state to allow playing it
    if (player === playerName && !currentRoom.settings?.unlimitedDrawEnabled) {
      setDrawnThisTurn(1)
      setMustPlayDrawnCard(true)
    }

    // Run computer turns in single player mode
    if (gameMode === "single" && allPlayers[currentPlayerIndex].name !== playerName) {
      setTimeout(runComputerTurns, 1000)
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
              drawCardCount = newStackedCards.reduce((total, c) => total + (c.value === "draw2" ? 2 : 4), 0)
              newStackedCards = []
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
          targetPlayer: drawCardCount > 0 ? allPlayers[getNextPlayerIndex()].name : null,
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

  // Replace the handleColorSelect function with this fixed version

  // Replace the handleGameUpdate function in the useEffect
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
            specialEffect,
          } = data.data

          console.log(`🃏 ${data.playerName} played ${card.color} ${card.value}`)

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
          } else {
            // Add card to discard pile
            setDiscardPile((prev) => [...prev, card])
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

          console.log(`🎴 ${player} drew ${numCards} cards`)

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
          console.log(`⏭️ ${data.playerName} passed their turn`)
          setCurrentPlayerIndex(data.data.currentPlayerIndex)
          setGameMessage(`${data.playerName} passed their turn`)
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

          // Handle special effects
          if (specialEffect && specialEffect.drawCardCount > 0 && specialEffect.targetPlayer) {
            setTimeout(() => {
              drawCards(specialEffect.targetPlayer, specialEffect.drawCardCount)
            }, 500)
          }

          setGameMessage(`${data.playerName} changed the color to ${card.color}!`)
        }
        break

      case "GAME_STATE_SYNC":
        if (data.data) {
          console.log("🔄 Received game state sync")
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
