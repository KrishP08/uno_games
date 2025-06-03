"use client"

import { useState, useEffect } from "react"

export function VoiceControl({ onCommand, onVoiceDetected }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let recognition = null

    // Check if browser supports speech recognition
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      recognition = new SpeechRecognition()

      recognition.continuous = true
      recognition.interimResults = true

      recognition.onstart = () => {
        setListening(true)
      }

      recognition.onend = () => {
        setListening(false)
        // Restart recognition
        if (!error) {
          recognition.start()
        }
      }

      recognition.onerror = (event) => {
        setError(`Speech recognition error: ${event.error}`)
        setListening(false)
      }

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join("")

        // Check for voice activity
        onVoiceDetected(true)

        // Reset voice detection after a short delay
        setTimeout(() => onVoiceDetected(false), 500)

        // Check for UNO command
        if (transcript.toLowerCase().includes("uno")) {
          onCommand("uno")
        }

        // Check for draw card command
        if (transcript.toLowerCase().includes("draw") || transcript.toLowerCase().includes("pick")) {
          onCommand("draw")
        }
      }

      // Start recognition
      recognition.start()
    } else {
      setError("Speech recognition not supported in this browser")
    }

    // Cleanup
    return () => {
      if (recognition) {
        recognition.stop()
      }
    }
  }, [onCommand, onVoiceDetected])

  return null // No UI needed
}
