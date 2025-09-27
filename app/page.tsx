"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar } from "@/components/ui/avatar"
import { DollarSign, TrendingDown, Milestone } from "lucide-react"
import Link from "next/link"

interface Node {
  id: number
  x: number
  y: number
  vx: number
  vy: number
}

interface Connection {
  from: number
  to: number
  opacity: number
}

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<Node[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [showButtons, setShowButtons] = useState(false)
  const animationRef = useRef<number | undefined>(undefined)

  // Initialize nodes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const newNodes: Node[] = []

    for (let i = 0; i < 35; i++) {
      newNodes.push({
        id: i,
        x: Math.random() * rect.width,
        y: Math.random() * rect.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
      })
    }

    nodesRef.current = newNodes
  }, [])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Update node positions
      nodesRef.current = nodesRef.current.map((node) => ({
        ...node,
        x: (node.x + node.vx + canvas.width) % canvas.width,
        y: (node.y + node.vy + canvas.height) % canvas.height,
      }))

      // Draw connections
      ctx.strokeStyle = "#14b8a6"
      ctx.lineWidth = 1
      connections.forEach((conn) => {
        const fromNode = nodesRef.current[conn.from]
        const toNode = nodesRef.current[conn.to]
        if (fromNode && toNode) {
          ctx.globalAlpha = conn.opacity
          ctx.beginPath()
          ctx.moveTo(fromNode.x, fromNode.y)
          ctx.lineTo(toNode.x, toNode.y)
          ctx.stroke()
        }
      })

      // Draw nodes
      ctx.globalAlpha = 1
      ctx.fillStyle = "#14b8a6"
      nodesRef.current.forEach((node) => {
        ctx.beginPath()
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2)
        ctx.fill()

        // Add glow effect
        ctx.shadowColor = "#14b8a6"
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [connections])

  // Handle scroll to connect nodes
  useEffect(() => {
    const handleScroll = () => {
      if (!isConnected && window.scrollY > 50) {
        setIsConnected(true)

        // Create connections between nearby nodes
        const newConnections: Connection[] = []
        nodesRef.current.forEach((node, i) => {
          nodesRef.current.forEach((otherNode, j) => {
            if (i !== j) {
              const distance = Math.sqrt(Math.pow(node.x - otherNode.x, 2) + Math.pow(node.y - otherNode.y, 2))
              if (distance < 150 && Math.random() > 0.7) {
                newConnections.push({
                  from: i,
                  to: j,
                  opacity: 0,
                })
              }
            }
          })
        })

        setConnections(newConnections)

        // Animate connections
        setTimeout(() => {
          setConnections((prev) => prev.map((conn) => ({ ...conn, opacity: 0.6 })))
          setTimeout(() => setShowButtons(true), 50)
        }, 500)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isConnected])

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <div
            className={`transition-all duration-1000 ${isConnected ? "opacity-0 transform -translate-y-8" : "opacity-100"}`}
          >
            <h1 className="text-6xl font-bold mb-6 text-balance">From Labyrinth to Lifeline.</h1>
            <p className="text-xl text-muted-foreground mb-8 text-pretty max-w-3xl mx-auto">
              Trialify is the ethical clinical trial recruitment platform for HCPs that intelligently and equitably connects
              diverse patient populations to life-saving research.
            </p>
            <p className="text-sm text-muted-foreground animate-pulse">Scroll to Connect</p>
          </div>

          <div
            className={`transition-all duration-1000 ${isConnected ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-8"}`}
          >
            <h1 className="text-6xl font-bold mb-6 text-balance">Trialify: Connect Patients to Clinical Trials</h1>
            <div
              className={`flex gap-4 justify-center transition-all duration-500 delay-1000 ${showButtons ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"}`}
            >
              <Link href="/patient-form">
                <Button size="lg" className="bg-teal-600 hover:bg-teal-700">
                  Connect a Patient
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">What do we solve?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-card border-border">
              <CardHeader>
                <DollarSign className="w-12 h-12 text-teal-500 mb-4" />
                <CardTitle className="text-xl">The Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  It can cost over $50,000 to recruit a single patient. 85% of trials are delayed due to recruitment
                  issues, costing sponsors millions per day and delaying life-saving treatments for years.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <TrendingDown className="w-12 h-12 text-teal-500 mb-4" />
                <CardTitle className="text-xl">The Dropout</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Patients often withdraw from clinical trials before completion due to insufficient support or lack of percieved efficacy. More closely matching patients to trials can help reduce dropout and save time. 
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <Milestone className="w-12 h-12 text-teal-500 mb-4" />
                <CardTitle className="text-xl">The Complexity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Clinicians are too burdened to navigate thousands of complex trial protocols. Patients are left to
                  find hope in a system not designed for them, often discovering opportunities too late.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  )
}
