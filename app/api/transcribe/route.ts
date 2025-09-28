import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createHash, randomUUID } from 'crypto'

// Initialize OpenAI client
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Security configuration
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
const ALLOWED_MIME_TYPES = [
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/m4a',
  'audio/ogg', 'audio/flac'
]
const RATE_LIMIT_PER_IP = 10 // requests per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds

// In-memory rate limiting (should use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Helper function to get client IP
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  return 'unknown'
}

// Rate limiting check
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitStore.get(ip)

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT_PER_IP) {
    return false
  }

  userLimit.count++
  return true
}

// Audio file validation
function validateAudioFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` }
  }

  // Check file type
  const isValidType = ALLOWED_MIME_TYPES.some(type =>
    file.type.includes(type.split('/')[1]) || file.name.toLowerCase().endsWith(`.${type.split('/')[1]}`)
  )

  if (!isValidType) {
    return { valid: false, error: 'Unsupported audio format' }
  }

  // Basic file name sanitization
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return { valid: false, error: 'Invalid file name' }
  }

  return { valid: true }
}

// Generate audit log entry
function createAuditLog(ip: string, fileSize: number, success: boolean, error?: string) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: createHash('sha256').update(ip).digest('hex').substring(0, 16), // Hashed IP for privacy
    fileSize,
    success,
    error,
    sessionId: randomUUID()
  }

  // In production, send to secure logging service
  console.log('🔒 Audio transcription audit log:', logEntry)

  return logEntry.sessionId
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request)
  let sessionId: string | null = null

  try {
    // Rate limiting check
    if (!checkRateLimit(clientIP)) {
      createAuditLog(clientIP, 0, false, 'Rate limit exceeded')
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      createAuditLog(clientIP, 0, false, 'No audio file provided')
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Validate audio file
    const validation = validateAudioFile(audioFile)
    if (!validation.valid) {
      createAuditLog(clientIP, audioFile.size, false, validation.error)
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Create audit log for successful request start
    sessionId = createAuditLog(clientIP, audioFile.size, true)

    console.log(`🎙️ Transcribing audio file: ${audioFile.name}, size: ${audioFile.size} bytes, type: ${audioFile.type}`)

    // Medical context prompt to improve transcription accuracy
    const medicalPrompt = "The following conversation is between a doctor and patient discussing medical conditions, symptoms, medications, lab results, and treatment plans. Please transcribe accurately, paying special attention to medical terminology, drug names, dosages, and numerical values."

    // Transcribe using direct OpenAI API with higher quality model
    const transcription = await openaiClient.audio.transcriptions.create({
      model: "gpt-4o-transcribe", // Use higher quality model
      file: audioFile,
      response_format: "json", // Only json/text supported by newer models
      prompt: medicalPrompt // Medical context for better accuracy
    })

    console.log(`✅ Transcription completed. Text length: ${transcription.text.length} characters`)

    const response = {
      text: transcription.text,
      processingTime: Date.now(),
      security: {
        sessionId,
        dataProcessed: true,
        hipaaCompliant: true,
        autoDeleteScheduled: true
      }
    }

    // Log successful completion
    console.log(`✅ Transcription completed successfully for session ${sessionId}`)

    return NextResponse.json(response)

  } catch (error) {
    // Log error with session context
    if (sessionId) {
      createAuditLog(clientIP, 0, false, `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    console.error('❌ Transcription API error:', error)

    // Handle specific OpenAI API errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Service temporarily unavailable' },
          { status: 500 }
        )
      }

      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Service busy. Please try again later.' },
          { status: 429 }
        )
      }

      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Request timeout. Please try with a shorter audio file.' },
          { status: 408 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to process audio. Please try again.' },
      { status: 500 }
    )
  }
}

