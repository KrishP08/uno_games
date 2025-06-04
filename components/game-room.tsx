"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { PlayerHand } from "@/components/player-hand"
import { CircularGameLayout } from "@/components/circular-game-layout"
import { generateDeck, shuffleDeck, calculatePoints, getComputerMove } from "@/lib/game-utils"
import { PlayerScoreboard } from "@/components/player-scoreboard"
import { RoomSharing } from "@/components/room-sharing"
import { Mic, MicOff, Volume2, VolumeX, Play, Users } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { VoiceControl } from "@/components/voice-control"

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
        setGameMessage("Game started!")
      }

      const handleGameUpdate = (data) => {
        console.log("🎮 Game update:", data)
        // Handle real-time game updates here
        if (data.action === "CARD_PLAYED") {
          setGameMessage(`${data.playerName} played a card`)
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
        socketClient.off("start-game-error", handleStartGameError) // Add this line
      }
    }
  }, [socketClient, gameMode])

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
      sendGameAction("UNO_CALL", {})
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

  // Start a new game
  const startGame = () => {
    if (gameStarted) {
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

        // Handle stacking
        if (currentRoom.settings?.stackingEnabled && (card.value === "draw2" || card.value === "wild4")) {
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
        } else {
          // Handle special cards normally
          handleSpecialCard(card)
        }
      }, 500)

      sendGameAction("PLAY_CARD", { card, cardIndex })
    } else {
      setGameMessage("Invalid move! The card must match in color or value.")
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
    const topCard = discardPile[discardPile.length - 1]
    const computerHand = playerHands[computerPlayer.name] || []

    // Safety check
    if (!topCard) {
      console.error("❌ No top card available for computer turn")
      return
    }

    // Get computer move based on difficulty
    const { move, cardIndex, chosenColor } = getComputerMove(computerHand, topCard, canStack, computerPlayer.difficulty)

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
        setDiscardPile([...discardPile, card])
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

        // Handle stacking
        if (currentRoom.settings?.stackingEnabled && (card.value === "draw2" || card.value === "wild4")) {
          const newStackedCards = [...stackedCards, card]
          setStackedCards(newStackedCards)

          // Move to next player
          const allPlayers = getAllPlayers()
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
                runComputerTurns()
              }, 1000)
            }, 500)
          } else {
            // Next player can stack, continue with their turn
            runComputerTurns()
          }
        } else {
          // Set wild card color if needed
          if (card.value === "wild" || card.value === "wild4") {
            card.color = chosenColor
            setGameMessage(`${computerPlayer.name} changed the color to ${chosenColor}!`)
          }

          // Handle special cards normally
          handleSpecialCard(card, true)
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
  }

  // Handle round win
  const handleRoundWin = (winner) => {
    // Play win sound
    playWinSound()

    // Show all players' cards
    setShowEndGameCards(true)

    // Calculate points from other players' hands
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
      if (newScores[winner] >= (currentRoom.settings?.pointsToWin || 500)) {
        setGameWinner(winner)
        setGameMessage(`${winner} wins the game with ${newScores[winner]} points!`)
      } else {
        setRoundWinner(winner)
        setGameMessage(`${winner} wins the round and scores ${points} points!`)
      }
    }, 2000)

    sendGameAction("ROUND_WIN", { winner, newScores })
  }

  // Add this function after the handleRoundWin function
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

  // Handle special card effects
  const handleSpecialCard = (card, isComputerTurn = false) => {
    const allPlayers = getAllPlayers()
    const nextPlayerIndex = getNextPlayerIndex()

    switch (card.value) {
      case "skip":
        setGameMessage(`${allPlayers[nextPlayerIndex].name}'s turn is skipped!`)
        // Skip to the next player
        const skipIndex = getNextPlayerIndex(nextPlayerIndex)
        setCurrentPlayerIndex(skipIndex)

        if (isComputerTurn && gameMode === "single") {
          setTimeout(runComputerTurns, 1000)
        }
        break

      case "reverse":
        setDirection(direction * -1)
        setGameMessage(`Direction reversed!`)
        // In a 2-player game, reverse acts like skip
        if (allPlayers.length === 2) {
          setCurrentPlayerIndex(currentPlayerIndex)
        } else {
          setCurrentPlayerIndex(getPreviousPlayerIndex())
        }

        if (isComputerTurn && gameMode === "single") {
          setTimeout(runComputerTurns, 1000)
        }
        break

      case "draw2":
        if (!canStack) {
          const targetPlayer = allPlayers[nextPlayerIndex].name
          drawCards(targetPlayer, 2)
          setGameMessage(`${targetPlayer} draws 2 cards and loses a turn!`)
          // Skip to the next player
          const draw2Index = getNextPlayerIndex(nextPlayerIndex)
          setCurrentPlayerIndex(draw2Index)

          if (isComputerTurn && gameMode === "single") {
            setTimeout(runComputerTurns, 1000)
          }
        }
        break

      case "wild":
        // In a real game, player would choose a color
        if (!card.color || card.color === "wild") {
          card.color = ["red", "blue", "green", "yellow"][Math.floor(Math.random() * 4)]
        }
        setGameMessage(`Color changed to ${card.color}!`)
        setCurrentPlayerIndex(nextPlayerIndex)

        if (isComputerTurn && gameMode === "single") {
          setTimeout(runComputerTurns, 1000)
        }
        break

      case "wild4":
        if (!canStack) {
          // In a real game, player would choose a color
          if (!card.color || card.color === "wild") {
            card.color = ["red", "blue", "green", "yellow"][Math.floor(Math.random() * 4)]
          }
          const wild4Target = allPlayers[nextPlayerIndex].name
          drawCards(wild4Target, 4)
          setGameMessage(`Color changed to ${card.color}! ${wild4Target} draws 4 cards and loses a turn!`)
          // Skip to the next player
          const wild4Index = getNextPlayerIndex(nextPlayerIndex)
          setCurrentPlayerIndex(wild4Index)

          if (isComputerTurn && gameMode === "single") {
            setTimeout(runComputerTurns, 1000)
          }
        }
        break

      default:
        setCurrentPlayerIndex(nextPlayerIndex)

        if (isComputerTurn && gameMode === "single") {
          setTimeout(runComputerTurns, 1000)
        }
        break
    }

    sendGameAction("SPECIAL_CARD", { card })
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

  // Draw cards from the deck
  const drawCards = (player, numCards) => {
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
    }, 300)

    sendGameAction("DRAW_CARDS", { player, numCards })
  }

  // Handle player drawing a card
  const handleDrawCard = () => {
    const allPlayers = getAllPlayers()
    const currentPlayer = allPlayers[currentPlayerIndex]?.name

    // Only allow the current player to draw
    if (currentPlayer !== playerName || !gameStarted || canStack) return

    drawCards(playerName, 1)
    setGameMessage(`${playerName} drew a card.`)

    // Move to next player
    setTimeout(() => {
      setCurrentPlayerIndex(getNextPlayerIndex())

      // Run computer turns in single player mode
      if (gameMode === "single") {
        setTimeout(runComputerTurns, 1000)
      }
    }, 1000)
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
            <p className="text-white text-xl">{gameMessage}</p>
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
