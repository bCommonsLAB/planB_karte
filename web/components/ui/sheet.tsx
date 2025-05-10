"use client"

import * as React from "react"
import { X } from "lucide-react"

interface SheetProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Sheet({ isOpen, onClose, children }: SheetProps) {
  // Überwache Escape-Taste für das Schließen
  React.useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey)
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isOpen, onClose])
  
  if (!isOpen) return null
  
  return (
    <>
      {/* Overlay im Hintergrund */}
      <div 
        className="fixed inset-0 z-30 bg-black/30 transition-opacity duration-300 ease-in-out"
        onClick={onClose}
        aria-hidden="true"
      />
      
      <div 
        className={`fixed inset-y-0 right-0 z-40 w-full md:w-1/3 lg:w-1/4 max-w-md p-4 bg-white shadow-2xl transition-transform duration-300 ease-in-out border-l border-gray-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 rounded-full p-1 text-gray-500 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
          <span className="sr-only">Schließen</span>
        </button>
        <div className="h-full overflow-auto pt-3">
          {children}
        </div>
      </div>
    </>
  )
} 