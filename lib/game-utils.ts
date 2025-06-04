// Generate a complete UNO deck
export function generateDeck() {
  const colors = ["red", "blue", "green", "yellow"]
  const numbers = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

  const deck = []

  // Add number cards (0-9) for each color
  colors.forEach((color) => {
    // Only one zero per color
    deck.push({ color, value: "0" })

    // Two of each 1-9 per color
    numbers.slice(1).forEach((num) => {
      deck.push({ color, value: num })
      deck.push({ color, value: num })
    })

    // Two of each action card per color (Skip, Reverse, Draw 2)
    deck.push({ color, value: "skip" })
    deck.push({ color, value: "skip" })
    deck.push({ color, value: "reverse" })
    deck.push({ color, value: "reverse" })
    deck.push({ color, value: "draw2" })
    deck.push({ color, value: "draw2" })
  })

  // Add 4 Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "wild", value: "wild" })
  }

  // Add 4 Wild Draw 4 cards
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "wild", value: "wild4" })
  }

  return deck
}

// Add validation function to ensure cards are valid
export function isValidCard(card) {
  if (!card || !card.color || !card.value) return false

  const validColors = ["red", "blue", "green", "yellow", "wild"]
  const validValues = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2", "wild", "wild4"]

  // Check if color is valid
  if (!validColors.includes(card.color)) return false

  // Check if value is valid
  if (!validValues.includes(card.value)) return false

  // Wild cards can only have wild or wild4 values
  if (card.color === "wild" && !["wild", "wild4"].includes(card.value)) return false

  // Non-wild cards cannot have wild values
  if (card.color !== "wild" && ["wild", "wild4"].includes(card.value)) return false

  return true
}

// Filter out invalid cards from a hand
export function validateHand(hand) {
  return hand.filter((card) => isValidCard(card))
}

// Shuffle the deck using Fisher-Yates algorithm
export function shuffleDeck(deck) {
  const newDeck = [...deck]
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]]
  }
  return newDeck
}

// Deal cards to players
export function dealCards(deck) {
  const player1Cards = []
  const player2Cards = []
  const updatedDeck = [...deck]

  // Each player gets 7 cards
  for (let i = 0; i < 7; i++) {
    player1Cards.push(updatedDeck.pop())
    player2Cards.push(updatedDeck.pop())
  }

  return { updatedDeck, player1Cards, player2Cards }
}

// Calculate points for cards in hand
export function calculatePoints(cards) {
  let points = 0

  cards.forEach((card) => {
    if (card.value === "skip" || card.value === "reverse" || card.value === "draw2") {
      points += 20
    } else if (card.value === "wild" || card.value === "wild4") {
      points += 50
    } else {
      points += Number.parseInt(card.value) || 0
    }
  })

  return points
}

// Get computer move based on difficulty
export function getComputerMove(hand, topCard, canStack, difficulty = "medium") {
  // Find playable cards
  const playableCards = hand.filter((card) => {
    if (canStack) {
      // For stacking, we need to match the exact card type
      if (topCard.value === "draw2") {
        return card.value === "draw2"
      } else if (topCard.value === "wild4") {
        return card.value === "wild4" || card.value === "draw2"
      }
      return false
    }

    // Normal play rules
    return card.color === topCard.color || card.value === topCard.value || card.color === "wild"
  })

  if (playableCards.length === 0) {
    return { move: "draw" }
  }

  // Choose card based on difficulty
  let chosenCard
  let cardIndex

  switch (difficulty) {
    case "easy":
      // Play the first available card
      chosenCard = playableCards[0]
      cardIndex = hand.findIndex((card) => card === chosenCard)
      break

    case "hard":
      // Strategic play - prioritize action cards and high-value cards
      const actionCards = playableCards.filter((card) =>
        ["skip", "reverse", "draw2", "wild", "wild4"].includes(card.value),
      )

      if (actionCards.length > 0) {
        // Prioritize wild cards, then draw cards, then other actions
        const wildCards = actionCards.filter((card) => card.value === "wild" || card.value === "wild4")
        const drawCards = actionCards.filter((card) => card.value === "draw2")

        if (wildCards.length > 0) {
          chosenCard = wildCards[0]
        } else if (drawCards.length > 0) {
          chosenCard = drawCards[0]
        } else {
          chosenCard = actionCards[0]
        }
      } else {
        // Play highest value number card
        const numberCards = playableCards.filter((card) => !isNaN(Number.parseInt(card.value)))
        if (numberCards.length > 0) {
          chosenCard = numberCards.reduce((highest, current) =>
            Number.parseInt(current.value) > Number.parseInt(highest.value) ? current : highest,
          )
        } else {
          chosenCard = playableCards[0]
        }
      }

      cardIndex = hand.findIndex((card) => card === chosenCard)
      break

    case "medium":
    default:
      // Balanced play - sometimes strategic, sometimes random
      if (Math.random() > 0.5) {
        // Strategic move
        const actionCards = playableCards.filter((card) =>
          ["skip", "reverse", "draw2", "wild", "wild4"].includes(card.value),
        )

        if (actionCards.length > 0 && Math.random() > 0.3) {
          chosenCard = actionCards[Math.floor(Math.random() * actionCards.length)]
        } else {
          chosenCard = playableCards[Math.floor(Math.random() * playableCards.length)]
        }
      } else {
        // Random move
        chosenCard = playableCards[Math.floor(Math.random() * playableCards.length)]
      }

      cardIndex = hand.findIndex((card) => card === chosenCard)
      break
  }

  // Choose color for wild cards
  let chosenColor = null
  if (chosenCard.value === "wild" || chosenCard.value === "wild4") {
    chosenColor = getMostFrequentColor(hand.filter((_, index) => index !== cardIndex))
  }

  return {
    move: "play",
    cardIndex,
    chosenColor,
  }
}

// Get the most frequent color in a hand (for computer's wild card choice)
function getMostFrequentColor(hand) {
  const colors = hand.filter((card) => card.color !== "wild").map((card) => card.color)

  if (colors.length === 0) {
    return ["red", "blue", "green", "yellow"][Math.floor(Math.random() * 4)]
  }

  const colorCounts = {}
  colors.forEach((color) => {
    colorCounts[color] = (colorCounts[color] || 0) + 1
  })

  let mostFrequent = null
  let highestCount = 0

  Object.keys(colorCounts).forEach((color) => {
    if (colorCounts[color] > highestCount) {
      mostFrequent = color
      highestCount = colorCounts[color]
    }
  })

  return mostFrequent || ["red", "blue", "green", "yellow"][Math.floor(Math.random() * 4)]
}
