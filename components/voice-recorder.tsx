"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Mic, Play, Pause, Square, Upload, Loader2, AlertCircle, Shield, Lock } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceRecorderProps {
  onTranscriptionComplete: (transcription: string) => void
  className?: string
  disabled?: boolean
}

interface TranscriptionResult {
  text: string
}

export default function VoiceRecorder({ onTranscriptionComplete, className, disabled = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string>("")
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [consentGiven, setConsentGiven] = useState(false)
  const [showConsentDialog, setShowConsentDialog] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const audioLevelTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Request microphone permission
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        setPermissionGranted(true)
        stream.getTracks().forEach(track => track.stop()) // Stop the stream immediately
      } catch (_err) {
        setPermissionGranted(false)
        setError("Microphone permission is required for voice recording")
      }
    }

    requestPermission()
  }, [])

  // Audio level monitoring
  const monitorAudioLevel = () => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    const normalizedLevel = Math.min(100, (average / 128) * 100)
    setAudioLevel(normalizedLevel)

    audioLevelTimerRef.current = setTimeout(monitorAudioLevel, 100)
  }

  const startRecording = async () => {
    // Check consent first
    if (!consentGiven) {
      setShowConsentDialog(true)
      return
    }

    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      streamRef.current = stream

      // Set up audio analysis for visual feedback
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })

      mediaRecorderRef.current = mediaRecorder
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))

        // Stop audio level monitoring
        if (audioLevelTimerRef.current) {
          clearTimeout(audioLevelTimerRef.current)
        }
        setAudioLevel(0)
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      // Start audio level monitoring
      monitorAudioLevel()

    } catch (err) {
      setError("Failed to start recording. Please check your microphone.")
      console.error("Recording error:", err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }

      if (audioLevelTimerRef.current) {
        clearTimeout(audioLevelTimerRef.current)
      }
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  const playAudio = () => {
    if (audioRef.current) {
      if (isPaused) {
        audioRef.current.play()
        setIsPaused(false)
      } else {
        audioRef.current.currentTime = 0
        audioRef.current.play()
      }
      setIsPlaying(true)
    }
  }

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
      setIsPaused(true)
    }
  }

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
      setIsPaused(false)
    }
  }

  const transcribeAudio = async () => {
    if (!audioBlob) return

    setIsTranscribing(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Transcription failed')
      }

      const result: TranscriptionResult = await response.json()
      onTranscriptionComplete(result.text)

    } catch (err) {
      setError("Failed to transcribe audio. Please try again.")
      console.error("Transcription error:", err)
    } finally {
      setIsTranscribing(false)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const resetRecording = () => {
    setAudioBlob(null)
    setAudioUrl("")
    setTranscriptionResult(null)
    setRecordingTime(0)
    setError(null)
    stopAudio()
  }

  const handleConsentAccept = () => {
    setConsentGiven(true)
    setShowConsentDialog(false)
    // Automatically start recording after consent
    setTimeout(() => startRecording(), 100)
  }

  const handleConsentDecline = () => {
    setShowConsentDialog(false)
    setError("Consent is required to record audio for transcription.")
  }

  // Audio event handlers
  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current

      const handleEnded = () => {
        setIsPlaying(false)
        setIsPaused(false)
      }

      audio.addEventListener('ended', handleEnded)
      return () => audio.removeEventListener('ended', handleEnded)
    }
  }, [audioUrl])

  if (permissionGranted === false) {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Microphone access is required to record doctor-patient conversations.
              Please enable microphone permissions in your browser settings.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Consent Dialog */}
      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600" />
              Audio Recording Consent & Privacy Notice
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
              <h4 className="font-semibold flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4" />
                HIPAA-Compliant Processing
              </h4>
              <p className="text-sm text-muted-foreground">
                All audio recordings and transcriptions are processed in compliance with HIPAA regulations.
                Your data is encrypted and will be automatically deleted after processing.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">By proceeding, you consent to:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-teal-600 rounded-full mt-2 flex-shrink-0" />
                  Recording of doctor-patient conversation for clinical trial matching purposes
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-teal-600 rounded-full mt-2 flex-shrink-0" />
                  AI-powered transcription and medical information extraction
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-teal-600 rounded-full mt-2 flex-shrink-0" />
                  Temporary storage of audio data for processing (automatically deleted within 24 hours)
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 bg-teal-600 rounded-full mt-2 flex-shrink-0" />
                  Use of extracted medical information to populate clinical trial forms
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Privacy & Security Measures:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• End-to-end encryption during transmission</li>
                <li>• No permanent storage of audio recordings</li>
                <li>• Automatic PII redaction from transcriptions</li>
                <li>• Audit logging for compliance tracking</li>
                <li>• Rate limiting and abuse protection</li>
              </ul>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Patient Rights:</strong> You may withdraw consent at any time by stopping the recording.
                All data can be deleted upon request. This recording is for clinical trial matching purposes only.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleConsentDecline}>
              Decline
            </Button>
            <Button onClick={handleConsentAccept} className="bg-teal-600 hover:bg-teal-700">
              I Consent to Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Recording & Transcription
            {consentGiven && (
              <Badge variant="outline" className="ml-auto text-xs bg-green-50 text-green-700 border-green-200">
                <Shield className="w-3 h-3 mr-1" />
                HIPAA Compliant
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Recording Controls */}
        <div className="flex items-center gap-3">
          {!isRecording && !audioBlob && (
            <Button
              onClick={startRecording}
              disabled={disabled || !permissionGranted}
              className="bg-red-600 hover:bg-red-700"
            >
              <Mic className="w-4 h-4 mr-2" />
              Start Recording
            </Button>
          )}

          {isRecording && (
            <Button
              onClick={stopRecording}
              variant="destructive"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Recording
            </Button>
          )}

          {audioBlob && !isRecording && (
            <div className="flex gap-2">
              {!isPlaying ? (
                <Button onClick={playAudio} variant="outline">
                  <Play className="w-4 h-4 mr-2" />
                  {isPaused ? 'Resume' : 'Play'}
                </Button>
              ) : (
                <Button onClick={pauseAudio} variant="outline">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}

              <Button onClick={stopAudio} variant="outline">
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>

              <Button
                onClick={transcribeAudio}
                disabled={isTranscribing}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Transcribing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Transcribe & Analyze
                  </>
                )}
              </Button>

              <Button onClick={resetRecording} variant="outline">
                Reset
              </Button>
            </div>
          )}
        </div>

        {/* Recording Status */}
        {isRecording && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="destructive" className="animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-2" />
                Recording
              </Badge>
              <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
            </div>

            {/* Audio Level Indicator */}
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Audio Level</div>
              <Progress value={audioLevel} className="h-2" />
            </div>
          </div>
        )}

        {/* Audio Player */}
        {audioUrl && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Recorded Audio ({formatTime(recordingTime)})</div>
            <audio
              ref={audioRef}
              src={audioUrl}
              className="w-full"
              controls
              preload="metadata"
            />
          </div>
        )}

      </CardContent>
      </Card>
    </>
  )
}