"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Check, ChevronsUpDown, Pencil, ArrowLeft, Loader2, AlertCircle, CheckCircle2, Mic } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { redirect, RedirectType } from 'next/navigation'
import VoiceRecorder from "@/components/voice-recorder"

interface FormData {
  diagnosis: string
  age: string
  medications: string[]
  comorbidities: string[]
  biomarkers: string[]
  priorTreatments: string[]
  labValues: {
    hba1c: string
    egfr: string
    ldl: string
    hdl: string
  }
  bloodPressure: {
    systolic: string
    diastolic: string
  }
  hospitalized: string
  smokingHistory: string
}

interface TrialMatch {
  id: string
  title: string
  phase: string
  status: string
  location: string
  summary: string
  matchScore: number
  matchReason: string
  eligibilityCriteria: string
  contactInfo: {
    name: string
    phone: string
    email: string
  } | null
  studyDetails: {
    sponsor: string
    estimatedCompletion: string
    enrollment: number
  }
  nextSteps: string[]
}

interface ApiResponse {
  success: boolean
  data?: {
    matches: TrialMatch[]
    patientSummary: {
      summary: string
      recommendations: string
      safetyFlags: string[]
    }
    supportingEvidence: Array<{
      title: string
      abstract: string
      relevance: number
      url: string
    }>
    metadata: {
      processingTime: number
      agentsActivated: string[]
      confidenceScore: number
      apiCallsMade: number
    }
  }
  error?: string
  details?: any
}

const diagnoses = [
  "Type 2 Diabetes",
  "Hypertension",
  "Coronary Artery Disease",
  "Heart Failure",
  "Chronic Kidney Disease",
  "COPD",
  "Asthma",
  "Depression",
  "Anxiety",
  "Rheumatoid Arthritis",
]

export default function PatientForm() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<FormData>({
    diagnosis: "",
    age: "",
    medications: [],
    comorbidities: [],
    biomarkers: [],
    priorTreatments: [],
    labValues: {
      hba1c: "",
      egfr: "",
      ldl: "",
      hdl: "",
    },
    bloodPressure: {
      systolic: "",
      diastolic: "",
    },
    hospitalized: "",
    smokingHistory: "",
  })

  const [tempInput, setTempInput] = useState("")
  const [diagnosisOpen, setDiagnosisOpen] = useState(false)
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false)

  const totalSteps = 12 // 0-10 form steps + 1 results step (0-11)
  const progress = ((currentStep + 1) / totalSteps) * 100

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    } else if (currentStep === 0) {
      redirect("/", RedirectType.replace)
    }
  }

  const goToStep = (step: number) => {
    setCurrentStep(step)
  }

  const addArrayItem = (
    field: keyof Pick<FormData, "medications" | "comorbidities" | "biomarkers" | "priorTreatments">,
  ) => {
    if (tempInput.trim()) {
      setFormData((prev) => ({
        ...prev,
        [field]: [...prev[field], tempInput.trim()],
      }))
      setTempInput("")
    }
  }

  const removeArrayItem = (
    field: keyof Pick<FormData, "medications" | "comorbidities" | "biomarkers" | "priorTreatments">,
    index: number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }))
  }

  const handleKeyPress = (
    e: React.KeyboardEvent,
    field: keyof Pick<FormData, "medications" | "comorbidities" | "biomarkers" | "priorTreatments">,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addArrayItem(field)
    }
  }

  // Handle voice transcription completion
  const handleTranscriptionComplete = (transcription: string) => {
    console.log('🎙️ Voice transcription completed:', { transcription })
    setShowVoiceRecorder(false)
    // Automatically submit to Mastra workflow
    submitVoiceData(transcription)
  }


  // Format form data for API submission
  const formatPatientInfo = (): string => {
    const info = []
    
    info.push(`Primary Diagnosis: ${formData.diagnosis}`)
    info.push(`Age: ${formData.age} years`)
    
    if (formData.medications.length > 0) {
      info.push(`Current Medications: ${formData.medications.join(", ")}`)
    }
    
    if (formData.comorbidities.length > 0) {
      info.push(`Comorbidities: ${formData.comorbidities.join(", ")}`)
    }
    
    if (formData.biomarkers.length > 0) {
      info.push(`Relevant Biomarkers: ${formData.biomarkers.join(", ")}`)
    }
    
    if (formData.priorTreatments.length > 0) {
      info.push(`Prior Treatments: ${formData.priorTreatments.join(", ")}`)
    }
    
    // Lab values
    const labValues = []
    if (formData.labValues.hba1c) labValues.push(`HbA1c: ${formData.labValues.hba1c}%`)
    if (formData.labValues.egfr) labValues.push(`eGFR: ${formData.labValues.egfr} mL/min/1.73m²`)
    if (formData.labValues.ldl) labValues.push(`LDL: ${formData.labValues.ldl} mg/dL`)
    if (formData.labValues.hdl) labValues.push(`HDL: ${formData.labValues.hdl} mg/dL`)
    if (labValues.length > 0) {
      info.push(`Lab Values: ${labValues.join(", ")}`)
    }
    
    // Blood pressure
    if (formData.bloodPressure.systolic && formData.bloodPressure.diastolic) {
      info.push(`Blood Pressure: ${formData.bloodPressure.systolic}/${formData.bloodPressure.diastolic} mmHg`)
    }
    
    // Hospitalization
    if (formData.hospitalized) {
      info.push(`Hospitalized in last 90 days: ${formData.hospitalized === "yes" ? "Yes" : "No"}`)
    }
    
    return info.join(". ")
  }

  // Export results functionality
  const exportResults = () => {
    if (!apiResponse?.data) return

    const exportData = {
      patientSummary: apiResponse.data.patientSummary,
      clinicalTrials: apiResponse.data.matches.map(trial => ({
        nctId: trial.id,
        title: trial.title,
        phase: trial.phase,
        status: trial.status,
        location: trial.location,
        matchScore: `${Math.round(trial.matchScore * 100)}%`,
        matchReason: trial.matchReason,
        contactInfo: trial.contactInfo,
        studyDetails: trial.studyDetails,
        nextSteps: trial.nextSteps
      })),
      supportingEvidence: apiResponse.data.supportingEvidence,
      generatedAt: new Date().toISOString()
    }

    const jsonString = JSON.stringify(exportData, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `clinical-trial-results-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Submit voice data directly to API
  const submitVoiceData = async (transcription: string) => {
    console.log('🚀 Voice data submission started');
    setIsLoading(true)
    setError(null)

    try {
      const payload = {
        patientInfo: transcription, // Use transcription directly as patient info
        demographics: {
          location: "United States" // Default location
        },
        preferences: {
          maxTrials: 3,
          includeCompletedTrials: false,
          maxLiteratureResults: 5
        }
      }

      console.log('📤 Sending POST request to /api/find-trials with voice payload:', payload);

      const response = await fetch('/api/find-trials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      console.log('📥 Received response:', response.status, response.statusText);

      const result: ApiResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to find trials')
      }

      // Apply random ±10% fluctuation to match scores on the client side
      if (result.data?.matches) {
        result.data.matches = result.data.matches.map((trial) => {
          const baseMatchScore = trial.matchScore;
          const fluctuation = (Math.random() - 0.5) * 0.2; // ±10% (0.1 * 2 = 0.2)
          const adjustedMatchScore = Math.max(0, Math.min(1, baseMatchScore + fluctuation));

          return {
            ...trial,
            matchScore: adjustedMatchScore
          };
        });
      }

      setApiResponse(result)
      setCurrentStep(totalSteps - 1) // Jump directly to results step

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Submit form data to API
  const submitForm = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const patientInfo = formatPatientInfo()

      const payload = {
        patientInfo,
        demographics: {
          age: formData.age ? parseInt(formData.age) : undefined,
          location: "United States" // Default location, could be made configurable
        },
        preferences: {
          maxTrials: 3,
          includeCompletedTrials: false,
          maxLiteratureResults: 5
        }
      }

      const response = await fetch('/api/find-trials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      const result: ApiResponse = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to find trials')
      }

      // Apply random ±10% fluctuation to match scores on the client side
      if (result.data?.matches) {
        result.data.matches = result.data.matches.map((trial) => {
          const baseMatchScore = trial.matchScore;
          const fluctuation = (Math.random() - 0.5) * 0.2; // ±10% (0.1 * 2 = 0.2)
          const adjustedMatchScore = Math.max(0, Math.min(1, baseMatchScore + fluctuation));

          return {
            ...trial,
            matchScore: adjustedMatchScore
          };
        });
      }

      setApiResponse(result)
      nextStep() // Move to results step

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="w-full max-w-4xl mx-auto space-y-6">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-3xl mb-4">Let&apos;s find the right clinical trial</CardTitle>
                <p className="text-muted-foreground text-lg">
                  We&apos;ll ask you a few questions to match you with relevant clinical trials. This should take about 5
                  minutes.
                </p>
              </CardHeader>
              <CardContent className="text-center pb-8 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <Button onClick={nextStep} size="lg" className="bg-teal-600 hover:bg-teal-700">
                    Start Manual Entry
                  </Button>
                  <div className="text-muted-foreground">or</div>
                  <Button
                    onClick={() => setShowVoiceRecorder(true)}
                    size="lg"
                    variant="outline"
                    className="border-teal-600 text-teal-600 hover:bg-teal-50"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Record Conversation
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
                  You can either fill out the form manually or record a doctor-patient conversation.
                  Our AI will automatically extract relevant information from the conversation to populate the form.
                </p>
              </CardContent>
            </Card>

            {/* Voice Recording Modal/Section */}
            {showVoiceRecorder && (
              <VoiceRecorder
                onTranscriptionComplete={handleTranscriptionComplete}
                className="w-full"
              />
            )}

          </div>
        )

      case 1:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">What is the patient&apos;s primary diagnosis?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Popover open={diagnosisOpen} onOpenChange={setDiagnosisOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={diagnosisOpen}
                    className="w-full justify-between h-12 text-left bg-transparent"
                  >
                    {formData.diagnosis || "Select diagnosis..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search diagnosis..." />
                    <CommandList>
                      <CommandEmpty>No diagnosis found.</CommandEmpty>
                      <CommandGroup>
                        {diagnoses.map((diagnosis) => (
                          <CommandItem
                            key={diagnosis}
                            value={diagnosis}
                            onSelect={(currentValue) => {
                              setFormData((prev) => ({ ...prev, diagnosis: currentValue }))
                              setShowCustomDiagnosis(false)
                              setDiagnosisOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.diagnosis === diagnosis ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {diagnosis}
                          </CommandItem>
                        ))}
                        <CommandItem
                          value="Other"
                          onSelect={() => {
                            setShowCustomDiagnosis(true)
                            setDiagnosisOpen(false)
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              showCustomDiagnosis ? "opacity-100" : "opacity-0",
                            )}
                          />
                          Other
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {showCustomDiagnosis && (
                <div className="mt-4">
                  <Label htmlFor="custom-diagnosis">Other primary diagnosis:</Label>
                  <Input
                    id="custom-diagnosis"
                    value={customDiagnosis}
                    onChange={(e) => {
                      setCustomDiagnosis(e.target.value)
                      setFormData((prev) => ({ ...prev, diagnosis: e.target.value }))
                    }}
                    placeholder="Type your diagnosis here"
                    className="mt-2"
                  />
                </div>
              )}
              <Button
                onClick={nextStep}
                disabled={!formData.diagnosis}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">What is the patient&apos;s age?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Input
                type="number"
                placeholder="Enter age"
                value={formData.age}
                onChange={(e) => setFormData((prev) => ({ ...prev, age: e.target.value }))}
                className="h-12 text-lg"
              />
              <Button onClick={nextStep} disabled={!formData.age} className="w-full bg-teal-600 hover:bg-teal-700">
                Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Please list current medications</CardTitle>
              <p className="text-muted-foreground">Press Enter after each medication to add it</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <Input
                placeholder="Enter medication name"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, "medications")}
                className="h-12 text-lg"
              />
              <div className="flex flex-wrap gap-2 min-h-[60px]">
                {formData.medications.map((med, index) => (
                  <Badge key={index} variant="secondary" className="text-sm py-2 px-3">
                    {med}
                    <button
                      onClick={() => removeArrayItem("medications", index)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <Button onClick={nextStep} className="w-full bg-teal-600 hover:bg-teal-700">
                Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">List any comorbidities</CardTitle>
              <p className="text-muted-foreground">Press Enter after each condition to add it</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <Input
                placeholder="Enter comorbidity"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, "comorbidities")}
                className="h-12 text-lg"
              />
              <div className="flex flex-wrap gap-2 min-h-[60px]">
                {formData.comorbidities.map((condition, index) => (
                  <Badge key={index} variant="secondary" className="text-sm py-2 px-3">
                    {condition}
                    <button
                      onClick={() => removeArrayItem("comorbidities", index)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <Button onClick={nextStep} className="w-full bg-teal-600 hover:bg-teal-700">
                Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">List any known relevant biomarkers</CardTitle>
              <p className="text-muted-foreground">Press Enter after each biomarker to add it</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <Input
                placeholder="Enter biomarker"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, "biomarkers")}
                className="h-12 text-lg"
              />
              <div className="flex flex-wrap gap-2 min-h-[60px]">
                {formData.biomarkers.map((biomarker, index) => (
                  <Badge key={index} variant="secondary" className="text-sm py-2 px-3">
                    {biomarker}
                    <button
                      onClick={() => removeArrayItem("biomarkers", index)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <Button onClick={nextStep} className="w-full bg-teal-600 hover:bg-teal-700">
                Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 6:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">List prior treatments</CardTitle>
              <p className="text-muted-foreground">Press Enter after each treatment to add it</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <Input
                placeholder="Enter prior treatment"
                value={tempInput}
                onChange={(e) => setTempInput(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, "priorTreatments")}
                className="h-12 text-lg"
              />
              <div className="flex flex-wrap gap-2 min-h-[60px]">
                {formData.priorTreatments.map((treatment, index) => (
                  <Badge key={index} variant="secondary" className="text-sm py-2 px-3">
                    {treatment}
                    <button
                      onClick={() => removeArrayItem("priorTreatments", index)}
                      className="ml-2 text-muted-foreground hover:text-foreground"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
              <Button onClick={nextStep} className="w-full bg-teal-600 hover:bg-teal-700">
                Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 7:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Please enter the latest available lab values</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hba1c">HbA1c (%)</Label>
                  <Input
                    id="hba1c"
                    type="number"
                    step="0.1"
                    placeholder="7.2"
                    value={formData.labValues.hba1c}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        labValues: { ...prev.labValues, hba1c: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="egfr">eGFR (mL/min/1.73m²)</Label>
                  <Input
                    id="egfr"
                    type="number"
                    placeholder="90"
                    value={formData.labValues.egfr}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        labValues: { ...prev.labValues, egfr: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldl">LDL (mg/dL)</Label>
                  <Input
                    id="ldl"
                    type="number"
                    placeholder="100"
                    value={formData.labValues.ldl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        labValues: { ...prev.labValues, ldl: e.target.value },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hdl">HDL (mg/dL)</Label>
                  <Input
                    id="hdl"
                    type="number"
                    placeholder="50"
                    value={formData.labValues.hdl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        labValues: { ...prev.labValues, hdl: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
              <Button onClick={nextStep} className="w-full bg-teal-600 hover:bg-teal-700">
                Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 8:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">What is their most recent blood pressure reading?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4 items-center">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="systolic">Systolic</Label>
                  <Input
                    id="systolic"
                    type="number"
                    placeholder="120"
                    value={formData.bloodPressure.systolic}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        bloodPressure: { ...prev.bloodPressure, systolic: e.target.value },
                      }))
                    }
                    className="h-12 text-lg"
                  />
                </div>
                <div className="text-2xl text-muted-foreground">/</div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="diastolic">Diastolic</Label>
                  <Input
                    id="diastolic"
                    type="number"
                    placeholder="80"
                    value={formData.bloodPressure.diastolic}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        bloodPressure: { ...prev.bloodPressure, diastolic: e.target.value },
                      }))
                    }
                    className="h-12 text-lg"
                  />
                </div>
              </div>
              <Button onClick={nextStep} className="w-full bg-teal-600 hover:bg-teal-700">
                Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 9:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Has the patient been hospitalized in the last 90 days?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={formData.hospitalized}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, hospitalized: value }))}
                className="space-y-4"
              >
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="yes" id="hosp-yes" />
                  <Label htmlFor="hosp-yes" className="flex-1 cursor-pointer text-lg">
                    Yes
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="no" id="hosp-no" />
                  <Label htmlFor="hosp-no" className="flex-1 cursor-pointer text-lg">
                    No
                  </Label>
                </div>
              </RadioGroup>
              <Button
                onClick={nextStep}
                disabled={!formData.hospitalized}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )

      case 10:
        return (
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Please review the information</CardTitle>
              <p className="text-muted-foreground">Click the pencil icon to edit any section</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid gap-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Primary Diagnosis</h3>
                    <p className="text-muted-foreground">{formData.diagnosis || "Not specified"}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Age</h3>
                    <p className="text-muted-foreground">{formData.age || "Not specified"}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => goToStep(2)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Current Medications</h3>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.medications.length > 0 ? (
                        formData.medications.map((med, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {med}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-muted-foreground">None specified</p>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => goToStep(3)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">Hospitalization (Last 90 Days)</h3>
                    <p className="text-muted-foreground">
                      {formData.hospitalized === "yes"
                        ? "Yes"
                        : formData.hospitalized === "no"
                          ? "No"
                          : "Not specified"}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => goToStep(9)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button 
                size="lg" 
                className="w-full bg-teal-600 hover:bg-teal-700"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  submitForm();
                }}
                disabled={isLoading}
                type="button"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding Matching Trials...
                  </>
                ) : (
                  'Find Matching Trials'
                )}
              </Button>
            </CardContent>
          </Card>
        )

      default:
        // Results step
        if (!apiResponse?.data) {
          return (
            <Card className="w-full max-w-4xl mx-auto">
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">No results to display</p>
              </CardContent>
            </Card>
          )
        }

        return (
          <div className="w-full max-w-6xl mx-auto space-y-6">
            {/* Success header */}
            <Card>
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <CardTitle className="text-3xl text-green-600">Clinical Trials Found!</CardTitle>
                <p className="text-muted-foreground text-lg">
                  We found {apiResponse.data.matches.length} matching clinical trials for your patient
                </p>
              </CardHeader>
            </Card>

            {/* Patient Summary */}
            {apiResponse.data.patientSummary && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Patient Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">{apiResponse.data.patientSummary.summary}</p>
                  {apiResponse.data.patientSummary.recommendations && (
                    <div>
                      <h4 className="font-semibold mb-2">Recommendations:</h4>
                      <p className="text-muted-foreground">{apiResponse.data.patientSummary.recommendations}</p>
                    </div>
                  )}
                  {apiResponse.data.patientSummary.safetyFlags.length > 0 && (
                    <Alert className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Safety considerations: {apiResponse.data.patientSummary.safetyFlags.join(", ")}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Dropout Risk Summary */}
            {apiResponse.data.matches.length > 0 && apiResponse.data.matches[0].dropoutRisk && (
              <Card className="mb-6 border-l-4 border-l-teal-500">
                <CardHeader>
                  <CardTitle className="text-xl">Dropout Risk Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-center">
                      <div className={`text-3xl font-bold mb-2 ${
                        apiResponse.data.matches[0].dropoutRisk.riskLevel === 'LOW' ? 'text-green-600' :
                        apiResponse.data.matches[0].dropoutRisk.riskLevel === 'MODERATE' ? 'text-yellow-600' :
                        apiResponse.data.matches[0].dropoutRisk.riskLevel === 'HIGH' ? 'text-orange-600' :
                        'text-red-600'
                      }`}>
                        {apiResponse.data.matches[0].dropoutRisk.riskLevel}
                      </div>
                      <div className="text-sm text-muted-foreground">Overall Risk Level</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-3xl font-bold mb-2 text-teal-600">
                        {Math.round(apiResponse.data.matches[0].dropoutRisk.overallRisk * 100)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Risk Score</div>
                    </div>
                  </div>
                  
                  {apiResponse.data.matches[0].riskMitigationRecommendations && 
                   apiResponse.data.matches[0].riskMitigationRecommendations.length > 0 && (
                    <div className="mt-6 pt-4 border-t">
                      <h4 className="font-semibold mb-2">General Recommendations</h4>
                      <p className="text-sm text-muted-foreground">
                        {apiResponse.data.matches[0].riskMitigationRecommendations[0]}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Trial Results */}
            <div className="grid gap-6">
              {apiResponse.data.matches.map((trial, index) => (
                <Card key={trial.id} className="border-l-4 border-l-teal-500">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{trial.title}</CardTitle>
                        <div className="flex gap-2 mb-2 flex-wrap">
                          <Badge variant="outline">NCT ID: {trial.id}</Badge>
                          <Badge variant="outline">Phase: {trial.phase}</Badge>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {Math.round(trial.matchScore * 100)}% Match
                          </Badge>
                        </div>
                        <p className="text-muted-foreground text-sm mb-2">📍 {trial.location}</p>
                        <p className="text-muted-foreground text-sm">🏥 Status: {trial.status}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Summary</h4>
                        <p className="text-sm text-muted-foreground">{trial.summary}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-semibold mb-2">Why This Trial Matches</h4>
                        <p className="text-sm text-muted-foreground">{trial.matchReason}</p>
                      </div>

                      {trial.contactInfo && (
                        <div>
                          <h4 className="font-semibold mb-2">Contact Information</h4>
                          <p className="text-sm text-muted-foreground">
                            {trial.contactInfo.name}
                            {trial.contactInfo.phone !== 'N/A' && ` • ${trial.contactInfo.phone}`}
                            {trial.contactInfo.email !== 'N/A' && ` • ${trial.contactInfo.email}`}
                          </p>
                        </div>
                      )}

                      {trial.nextSteps.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">Next Steps</h4>
                          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                            {trial.nextSteps.map((step, stepIndex) => (
                              <li key={stepIndex}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="pt-4 border-t">
                        <a
                          href={`https://clinicaltrials.gov/ct2/show/${trial.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full"
                        >
                          <Button className="w-full bg-teal-600 hover:bg-teal-700">
                            View Full Trial Details
                          </Button>
                        </a>
                      </div>

                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Supporting Evidence */}
            {apiResponse.data.supportingEvidence.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Supporting Literature</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {apiResponse.data.supportingEvidence.map((evidence, index) => (
                      <div key={index} className="border-l-2 border-l-blue-200 pl-4">
                        <h4 className="font-medium">{evidence.title}</h4>
                        {evidence.abstract !== 'N/A' && (
                          <p className="text-sm text-muted-foreground mt-1">{evidence.abstract}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            Relevance: {Math.round(evidence.relevance * 100)}%
                          </Badge>
                          {evidence.url !== 'N/A' && (
                            <a 
                              href={evidence.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View Article
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}


            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              <Button 
                variant="outline" 
                onClick={() => {
                  setCurrentStep(0)
                  setFormData({
                    diagnosis: "",
                    age: "",
                    medications: [],
                    comorbidities: [],
                    biomarkers: [],
                    priorTreatments: [],
                    labValues: {
                      hba1c: "",
                      egfr: "",
                      ldl: "",
                      hdl: "",
                    },
                    bloodPressure: {
                      systolic: "",
                      diastolic: "",
                    },
                    hospitalized: "",
                    smokingHistory: "",
                  })
                  setApiResponse(null)
                  setError(null)
                }}
              >
                Search for Another Patient
              </Button>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={exportResults}>
                Export Results
              </Button>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground py-8">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === totalSteps - 1}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentStep === totalSteps - 1 ? 'Results' : `Step ${currentStep + 1} of ${totalSteps - 1}`}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Form Content */}
      <div className="pt-24 px-6">
        <div className="max-w-6xl mx-auto">{renderStep()}</div>
      </div>
    </div>
  )
}