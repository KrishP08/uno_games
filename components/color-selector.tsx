"use client"

import { Button } from "@/components/ui/button"

interface ColorSelectorProps {
  onSelectColor: (color: string) => void
}

export function ColorSelector({ onSelectColor }: ColorSelectorProps) {
  const colors = [
    { name: "red", bg: "bg-red-600", hover: "hover:bg-red-700" },
    { name: "blue", bg: "bg-blue-600", hover: "hover:bg-blue-700" },
    { name: "green", bg: "bg-green-600", hover: "hover:bg-green-700" },
    { name: "yellow", bg: "bg-yellow-500", hover: "hover:bg-yellow-600" },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 text-center">Select a Color</h2>
        <div className="grid grid-cols-2 gap-4">
          {colors.map((color) => (
            <Button
              key={color.name}
              className={`h-24 ${color.bg} ${color.hover} text-white font-bold text-xl capitalize`}
              onClick={() => onSelectColor(color.name)}
            >
              {color.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
