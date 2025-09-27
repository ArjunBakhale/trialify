"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { DollarSign, Scale, Database, Brain, Users, ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden grid-pattern">
        {/* Animated Background Nodes */}
        <div className="absolute inset-0 overflow-hidden">
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 800">
            {/* Disconnected nodes initially */}
            <circle
              cx="200"
              cy="150"
              r="4"
              fill="currentColor"
              className="text-primary/40 node-float"
              style={{ animationDelay: "0s" }}
            />
            <circle
              cx="400"
              cy="200"
              r="3"
              fill="currentColor"
              className="text-primary/30 node-float"
              style={{ animationDelay: "1s" }}
            />
            <circle
              cx="600"
              cy="120"
              r="5"
              fill="currentColor"
              className="text-primary/50 node-float"
              style={{ animationDelay: "2s" }}
            />
            <circle
              cx="800"
              cy="180"
              r="3"
              fill="currentColor"
              className="text-primary/35 node-float"
              style={{ animationDelay: "0.5s" }}
            />
            <circle
              cx="1000"
              cy="140"
              r="4"
              fill="currentColor"
              className="text-primary/45 node-float"
              style={{ animationDelay: "1.5s" }}
            />

            <circle
              cx="150"
              cy="400"
              r="3"
              fill="currentColor"
              className="text-primary/30 node-float"
              style={{ animationDelay: "2.5s" }}
            />
            <circle
              cx="350"
              cy="450"
              r="4"
              fill="currentColor"
              className="text-primary/40 node-float"
              style={{ animationDelay: "0.8s" }}
            />
            <circle
              cx="550"
              cy="380"
              r="5"
              fill="currentColor"
              className="text-primary/50 node-float"
              style={{ animationDelay: "1.8s" }}
            />
            <circle
              cx="750"
              cy="420"
              r="3"
              fill="currentColor"
              className="text-primary/35 node-float"
              style={{ animationDelay: "0.3s" }}
            />
            <circle
              cx="950"
              cy="390"
              r="4"
              fill="currentColor"
              className="text-primary/45 node-float"
              style={{ animationDelay: "2.2s" }}
            />

            <circle
              cx="300"
              cy="650"
              r="4"
              fill="currentColor"
              className="text-primary/40 node-float"
              style={{ animationDelay: "1.2s" }}
            />
            <circle
              cx="500"
              cy="680"
              r="3"
              fill="currentColor"
              className="text-primary/30 node-float"
              style={{ animationDelay: "0.7s" }}
            />
            <circle
              cx="700"
              cy="620"
              r="5"
              fill="currentColor"
              className="text-primary/50 node-float"
              style={{ animationDelay: "1.7s" }}
            />
            <circle
              cx="900"
              cy="660"
              r="4"
              fill="currentColor"
              className="text-primary/40 node-float"
              style={{ animationDelay: "2.8s" }}
            />

            {/* Connecting lines that appear gradually */}
            <line
              x1="200"
              y1="150"
              x2="400"
              y2="200"
              stroke="currentColor"
              strokeWidth="1"
              className="text-primary/20 connection-line"
              style={{ animationDelay: "3s" }}
            />
            <line
              x1="600"
              y1="120"
              x2="800"
              y2="180"
              stroke="currentColor"
              strokeWidth="1"
              className="text-primary/20 connection-line"
              style={{ animationDelay: "4s" }}
            />
            <line
              x1="350"
              y1="450"
              x2="550"
              y2="380"
              stroke="currentColor"
              strokeWidth="1"
              className="text-primary/20 connection-line"
              style={{ animationDelay: "5s" }}
            />
          </svg>
        </div>

        <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
          <h1
            className={`text-6xl md:text-7xl font-bold mb-6 text-balance transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          >
            From Labyrinth to <span className="text-primary">Lifeline</span>
          </h1>
          <p
            className={`text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed text-pretty transition-all duration-1000 delay-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          >
            Trailify is the ethical clinical trial recruitment platform that intelligently and equitably connects
            diverse patient populations to life-saving research. Eliminate barriers, reduce costs, and accelerate the
            future of medicine.
          </p>
          <Button
            size="lg"
            className={`text-lg px-8 py-6 transition-all duration-1000 delay-600 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          >
            Request a Demo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-balance">
            The cost of a mismatch is paid in <span className="text-primary">dollars</span> and in{" "}
            <span className="text-primary">lives</span>
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 text-center border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">The Financial Bottleneck</h3>
              <p className="text-muted-foreground leading-relaxed">
                It can cost over $50,000 to recruit a single patient. 85% of trials are delayed due to recruitment
                issues, costing sponsors millions per day and stalling critical research.
              </p>
            </Card>

            <Card className="p-8 text-center border-border/50 bg-card/50 backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Scale className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">The Equity Gap</h3>
              <p className="text-muted-foreground leading-relaxed">
                Trials often fail to represent our diverse population, leading to treatments that don't work for
                everyone. Socioeconomic and geographic barriers exclude countless eligible patients from life-saving
                care.
              </p>
            </Card>

            <Card className="p-8 text-center border-border/50 bg-card/50 backdrop-blur-sm md:col-span-2 lg:col-span-1">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">The Human Cost</h3>
              <p className="text-muted-foreground leading-relaxed">
                Every delayed trial means delayed hope for patients and families waiting for breakthrough treatments.
                Time lost in recruitment is time stolen from those who need it most.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-24 px-6 bg-card/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-balance">
            From <span className="text-primary">Chaos</span> to Clarity
          </h2>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <div className="relative">
              {/* Network visualization */}
              <div className="aspect-square bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-8 relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 400 400">
                  {/* Complex network that simplifies to a single path */}
                  <circle cx="100" cy="100" r="6" fill="currentColor" className="text-primary node-pulse" />
                  <circle cx="300" cy="100" r="6" fill="currentColor" className="text-primary node-pulse" />
                  <circle cx="200" cy="200" r="8" fill="currentColor" className="text-primary node-pulse" />
                  <circle cx="100" cy="300" r="6" fill="currentColor" className="text-primary node-pulse" />
                  <circle cx="300" cy="300" r="6" fill="currentColor" className="text-primary node-pulse" />

                  {/* Highlighted path */}
                  <path
                    d="M 100 100 Q 150 150 200 200 Q 250 250 300 300"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    className="text-primary connection-line"
                  />

                  {/* Other connections (dimmed) */}
                  <line
                    x1="100"
                    y1="100"
                    x2="300"
                    y2="100"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-primary/20"
                  />
                  <line
                    x1="100"
                    y1="100"
                    x2="100"
                    y2="300"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-primary/20"
                  />
                  <line
                    x1="300"
                    y1="100"
                    x2="300"
                    y2="300"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-primary/20"
                  />
                  <line
                    x1="100"
                    y1="300"
                    x2="300"
                    y2="300"
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-primary/20"
                  />
                </svg>

                <div className="absolute top-4 left-4 text-sm text-primary font-medium">Patient Universe</div>
                <div className="absolute bottom-4 right-4 text-sm text-primary font-medium">Trial Database</div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Step 1: Ethically Integrate Data</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Trailify securely connects with EMR data sources and global trial databases.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">EMR/EHR</span>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">Genomic Data</span>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                      ClinicalTrials.gov
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Step 2: Reveal the Trail</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Our AI analyzes de-identified patient data against complex inclusion/exclusion criteria to find
                    optimal, unbiased matches, creating a clear trail from diagnosis to enrollment.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Step 3: Empower the Clinician</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Receive a ranked list of suitable trials for your patient, complete with pre-screened eligibility
                    and site contacts, reducing the administrative burden from hours to minutes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-8 text-balance">
            Accelerate Research. <span className="text-primary">Expand Access.</span>
          </h2>

          <Card className="p-8 border-border/50 bg-card/50 backdrop-blur-sm">
            <form className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <Input type="email" placeholder="Work Email" className="bg-background/50 border-border/50" />
                <Input type="text" placeholder="Organization Name" className="bg-background/50 border-border/50" />
              </div>
              <Input
                type="text"
                placeholder="Your Role (e.g., Clinician, Researcher)"
                className="bg-background/50 border-border/50"
              />
              <Button size="lg" className="w-full text-lg py-6">
                Request a Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </div>
  )
}
