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
import { Check, ChevronsUpDown, Pencil, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

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

  const totalSteps = 10
  const progress = ((currentStep + 1) / totalSteps) * 100

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
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

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl mb-4">Let&apos;s find the right clinical trial</CardTitle>
              <p className="text-muted-foreground text-lg">
                We&apos;ll ask you a few questions to match you with relevant clinical trials. This should take about 5
                minutes.
              </p>
            </CardHeader>
            <CardContent className="text-center pb-8">
              <Button onClick={nextStep} size="lg" className="bg-teal-600 hover:bg-teal-700">
                Start
              </Button>
            </CardContent>
          </Card>
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
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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

      default:
        return (
          <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Please review the information</CardTitle>
              <p className="text-muted-foreground">Click the pencil icon to edit any section</p>
            </CardHeader>
            <CardContent className="space-y-6">
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

              <Button size="lg" className="w-full bg-teal-600 hover:bg-teal-700">
                Find Matching Trials
              </Button>
            </CardContent>
          </Card>
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
              disabled={currentStep === 0}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <span className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Form Content */}
      <div className="pt-24 px-6">
        <div className="max-w-4xl mx-auto">{renderStep()}</div>
      </div>
    </div>
  )
}
