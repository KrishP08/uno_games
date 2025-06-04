"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface ScoringSystemProps {
  onScoringChange: (scoring: ScoringConfig) => void
  currentScoring: ScoringConfig
}

export interface ScoringConfig {
  numberCards: number // Points for number cards (0-9)
  skipCard: number // Points for Skip cards
  reverseCard: number // Points for Reverse cards
  draw2Card: number // Points for Draw 2 cards
  wildCard: number // Points for Wild cards
  wild4Card: number // Points for Wild Draw 4 cards
  pointsToWin: number // Points needed to win the game
}

export const DEFAULT_SCORING: ScoringConfig = {
  numberCards: 1, // Each number card = face value
  skipCard: 20,
  reverseCard: 20,
  draw2Card: 20,
  wildCard: 50,
  wild4Card: 50,
  pointsToWin: 500,
}

export function ScoringSystem({ onScoringChange, currentScoring }: ScoringSystemProps) {
  const [scoring, setScoring] = useState<ScoringConfig>(currentScoring)
  const [showCustom, setShowCustom] = useState(false)

  const presets = [
    {
      name: "Classic UNO",
      description: "Official UNO scoring rules",
      config: {
        numberCards: 1,
        skipCard: 20,
        reverseCard: 20,
        draw2Card: 20,
        wildCard: 50,
        wild4Card: 50,
        pointsToWin: 500,
      },
    },
    {
      name: "Quick Game",
      description: "Faster games with lower points",
      config: {
        numberCards: 1,
        skipCard: 10,
        reverseCard: 10,
        draw2Card: 15,
        wildCard: 25,
        wild4Card: 30,
        pointsToWin: 200,
      },
    },
    {
      name: "High Stakes",
      description: "Longer games with higher points",
      config: {
        numberCards: 2,
        skipCard: 30,
        reverseCard: 30,
        draw2Card: 40,
        wildCard: 75,
        wild4Card: 100,
        pointsToWin: 1000,
      },
    },
  ]

  const handlePresetSelect = (preset: (typeof presets)[0]) => {
    setScoring(preset.config)
    onScoringChange(preset.config)
  }

  const handleCustomChange = (field: keyof ScoringConfig, value: number) => {
    const newScoring = { ...scoring, [field]: value }
    setScoring(newScoring)
    onScoringChange(newScoring)
  }

  const calculateExampleScore = () => {
    // Example hand: 2 number cards (5, 7), 1 skip, 1 wild
    return 5 * scoring.numberCards + 7 * scoring.numberCards + scoring.skipCard + scoring.wildCard
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">🎯 Scoring System Configuration</CardTitle>
        <p className="text-sm text-muted-foreground">Customize how points are calculated when players go out</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preset Options */}
        <div>
          <Label className="text-base font-semibold">Quick Presets</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
            {presets.map((preset) => (
              <Card
                key={preset.name}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  JSON.stringify(scoring) === JSON.stringify(preset.config)
                    ? "ring-2 ring-blue-500 bg-blue-50"
                    : "hover:bg-gray-50"
                }`}
                onClick={() => handlePresetSelect(preset)}
              >
                <CardContent className="p-4">
                  <h4 className="font-semibold">{preset.name}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <Badge variant="outline" className="text-xs">
                      Win: {preset.config.pointsToWin}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      Wild: {preset.config.wildCard}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Separator />

        {/* Custom Scoring */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Custom Scoring</Label>
            <Button variant="outline" size="sm" onClick={() => setShowCustom(!showCustom)}>
              {showCustom ? "Hide" : "Show"} Custom Options
            </Button>
          </div>

          {showCustom && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <div>
                <Label htmlFor="numberCards" className="text-sm">
                  Number Cards (0-9)
                </Label>
                <Input
                  id="numberCards"
                  type="number"
                  min="0"
                  max="20"
                  value={scoring.numberCards}
                  onChange={(e) => handleCustomChange("numberCards", Number.parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Multiplier for card face value</p>
              </div>

              <div>
                <Label htmlFor="skipCard" className="text-sm">
                  Skip Cards
                </Label>
                <Input
                  id="skipCard"
                  type="number"
                  min="0"
                  max="100"
                  value={scoring.skipCard}
                  onChange={(e) => handleCustomChange("skipCard", Number.parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="reverseCard" className="text-sm">
                  Reverse Cards
                </Label>
                <Input
                  id="reverseCard"
                  type="number"
                  min="0"
                  max="100"
                  value={scoring.reverseCard}
                  onChange={(e) => handleCustomChange("reverseCard", Number.parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="draw2Card" className="text-sm">
                  Draw 2 Cards
                </Label>
                <Input
                  id="draw2Card"
                  type="number"
                  min="0"
                  max="100"
                  value={scoring.draw2Card}
                  onChange={(e) => handleCustomChange("draw2Card", Number.parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="wildCard" className="text-sm">
                  Wild Cards
                </Label>
                <Input
                  id="wildCard"
                  type="number"
                  min="0"
                  max="200"
                  value={scoring.wildCard}
                  onChange={(e) => handleCustomChange("wildCard", Number.parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="wild4Card" className="text-sm">
                  Wild Draw 4
                </Label>
                <Input
                  id="wild4Card"
                  type="number"
                  min="0"
                  max="200"
                  value={scoring.wild4Card}
                  onChange={(e) => handleCustomChange("wild4Card", Number.parseInt(e.target.value) || 0)}
                  className="mt-1"
                />
              </div>

              <div className="md:col-span-3">
                <Label htmlFor="pointsToWin" className="text-sm">
                  Points to Win Game
                </Label>
                <Input
                  id="pointsToWin"
                  type="number"
                  min="50"
                  max="5000"
                  value={scoring.pointsToWin}
                  onChange={(e) => handleCustomChange("pointsToWin", Number.parseInt(e.target.value) || 50)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">First player to reach this score wins</p>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Scoring Example */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 mb-2">📊 How Points Are Calculated</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <p>
              <strong>When a player goes out:</strong>
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Number cards (0-9): Face value × {scoring.numberCards} points</li>
              <li>
                Skip/Reverse/Draw 2: {scoring.skipCard}/{scoring.reverseCard}/{scoring.draw2Card} points each
              </li>
              <li>Wild cards: {scoring.wildCard} points each</li>
              <li>Wild Draw 4: {scoring.wild4Card} points each</li>
            </ul>
            <p className="mt-2">
              <strong>Example:</strong> Hand with cards 5, 7, Skip, Wild = {calculateExampleScore()} points
            </p>
            <p>
              <strong>Winner:</strong> First to {scoring.pointsToWin} points wins the game!
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
