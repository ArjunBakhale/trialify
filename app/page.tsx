"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar } from "@/components/ui/avatar"
import { DollarSign, Scale, Milestone } from "lucide-react"
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
          setTimeout(() => setShowButtons(true), 1000)
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
              Trailify is the ethical clinical trial recruitment platform that intelligently and equitably connects
              diverse patient populations to life-saving research. Eliminate barriers, reduce costs, and accelerate the
              future of medicine.
            </p>
            <p className="text-sm text-muted-foreground animate-pulse">Scroll to Connect</p>
          </div>

          <div
            className={`transition-all duration-1000 ${isConnected ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-8"}`}
          >
            <h1 className="text-6xl font-bold mb-6 text-balance">Clarity OS: Your Intelligent Synthesis Engine.</h1>
            <div
              className={`flex gap-4 justify-center transition-all duration-500 delay-1000 ${showButtons ? "opacity-100 transform translate-y-0" : "opacity-0 transform translate-y-4"}`}
            >
              <Link href="/patient-form">
                <Button size="lg" className="bg-teal-600 hover:bg-teal-700">
                  Request a Demo
                </Button>
              </Link>
              <Button variant="outline" size="lg">
                How It Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-card border-border">
              <CardHeader>
                <DollarSign className="w-12 h-12 text-teal-500 mb-4" />
                <CardTitle className="text-xl">The Financial Bottleneck</CardTitle>
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
                <Scale className="w-12 h-12 text-teal-500 mb-4" />
                <CardTitle className="text-xl">The Equity Gap</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Trials often fail to represent our diverse population, leading to treatments that don&apos;t work for
                  everyone. Socioeconomic and geographic barriers exclude countless eligible patients from accessing
                  hope.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <Milestone className="w-12 h-12 text-teal-500 mb-4" />
                <CardTitle className="text-xl">Overwhelming Complexity</CardTitle>
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

      {/* Solution Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16 text-balance">From Chaos to Clarity.</h2>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <div className="w-full h-full bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                    EMR
                  </div>
                </Avatar>
                <div>
                  <h3 className="font-semibold">EMR/EHR Integration</h3>
                  <p className="text-sm text-muted-foreground">Real-time patient data synthesis</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <div className="w-full h-full bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                    DNA
                  </div>
                </Avatar>
                <div>
                  <h3 className="font-semibold">Genomic Data</h3>
                  <p className="text-sm text-muted-foreground">Precision matching algorithms</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <div className="w-full h-full bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                    CT
                  </div>
                </Avatar>
                <div>
                  <h3 className="font-semibold">ClinicalTrials.gov</h3>
                  <p className="text-sm text-muted-foreground">Comprehensive trial database</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-teal-500/20 to-blue-500/20 rounded-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-4 h-4 bg-teal-500 rounded-full mx-auto mb-4"></div>
                  <p className="text-sm font-medium">Your Patient&apos;s Trail</p>
                  <p className="text-xs text-muted-foreground mt-2">Personalized pathway to the right trial</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-8 text-balance">Accelerate Research. Expand Access.</h2>

          <Card className="bg-card border-border">
            <CardContent className="p-8">
              <form className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Work Email</Label>
                    <Input id="email" type="email" placeholder="you@company.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization Name</Label>
                    <Input id="organization" placeholder="Your Organization" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Your Role</Label>
                  <Input id="role" placeholder="e.g., Clinical Research Coordinator" />
                </div>
                <Button type="submit" size="lg" className="w-full bg-teal-600 hover:bg-teal-700">
                  Get Started with Trailify
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
