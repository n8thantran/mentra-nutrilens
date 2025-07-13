/**
 * Audio Processing Worker Thread
 * Handles audio transcription processing and TTS generation in parallel to avoid blocking the main thread
 */

const { parentPort, workerData } = require('worker_threads');
const path = require('path');

// Import required modules for audio processing
let elevenlabsTTS;

// Dynamically import the modules since they might be ES modules
async function initializeModules() {
  try {
    // Import the ElevenLabs TTS module
    const ttsModule = await import('../services/elevenlabs.mts');
    elevenlabsTTS = ttsModule.elevenlabsTTS;

    console.log('✅ Audio worker modules initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize audio worker modules:', error);
    process.exit(1);
  }
}

/**
 * Process audio data with various operations
 */
async function processAudio(message) {
  const { id, audioData, userId, context } = message;
  
  try {
    console.log(`🎧 Audio worker processing task ${id} for user ${userId} (context: ${context})`);
    
    let result = {
      processed: true,
      audioLength: audioData.byteLength,
      context: context,
      timestamp: new Date().toISOString()
    };

    // Handle different audio processing contexts
    switch (context) {
      case 'transcription':
        result = await processTranscriptionAudio(audioData, userId, id);
        break;
      
      case 'dietary_question':
        result = await processDietaryQuestionAudio(audioData, userId, id);
        break;
        
      case 'tts_generation':
        result = await processTTSGeneration(audioData, userId, id);
        break;
        
      default:
        // Generic audio processing
        result.type = 'generic';
        result.sampleRate = 16000; // Assume 16kHz sample rate
        result.duration = audioData.byteLength / (2 * 16000); // Assuming 16-bit samples
        break;
    }

    console.log(`✅ Audio processing completed for task ${id}`);

    // Send success response back to main thread
    parentPort.postMessage({
      id,
      success: true,
      result
    });

  } catch (error) {
    console.error(`❌ Audio processing failed for task ${id}:`, error);
    
    // Send error response back to main thread
    parentPort.postMessage({
      id,
      success: false,
      error: error.message || 'Audio processing failed'
    });
  }
}

/**
 * Process transcription audio data
 */
async function processTranscriptionAudio(audioData, userId, taskId) {
  console.log(`🎤 Processing transcription audio for task ${taskId}`);
  
  // Analyze audio characteristics
  const audioInfo = analyzeAudioData(audioData);
  
  return {
    type: 'transcription',
    audioLength: audioData.byteLength,
    estimatedDuration: audioInfo.duration,
    sampleRate: audioInfo.sampleRate,
    volume: audioInfo.averageVolume,
    hasVoiceActivity: audioInfo.averageVolume > 0.1, // Simple VAD
    processed: true
  };
}

/**
 * Process dietary question audio data
 */
async function processDietaryQuestionAudio(audioData, userId, taskId) {
  console.log(`🍎 Processing dietary question audio for task ${taskId}`);
  
  // Analyze the audio for dietary context
  const audioInfo = analyzeAudioData(audioData);
  
  // Could include keyword detection, sentiment analysis, etc.
  return {
    type: 'dietary_question',
    audioLength: audioData.byteLength,
    estimatedDuration: audioInfo.duration,
    hasVoiceActivity: audioInfo.averageVolume > 0.1,
    confidence: audioInfo.averageVolume > 0.2 ? 'high' : 'low',
    processed: true
  };
}

/**
 * Process TTS generation requests
 */
async function processTTSGeneration(audioData, userId, taskId) {
  console.log(`🔊 Processing TTS generation for task ${taskId}`);
  
  try {
    // Convert audio data back to text (if needed) or process TTS request
    // For now, this is a placeholder for TTS processing
    const textFromAudio = new TextDecoder().decode(audioData);
    
    if (elevenlabsTTS && textFromAudio) {
      const ttsResult = await elevenlabsTTS.generateAndUploadTTS(textFromAudio, userId);
      
      return {
        type: 'tts_generation',
        audioUrl: ttsResult.url,
        audioKey: ttsResult.key,
        originalText: textFromAudio,
        processed: true
      };
    }
    
    return {
      type: 'tts_generation',
      processed: false,
      error: 'TTS module not available'
    };
    
  } catch (error) {
    return {
      type: 'tts_generation',
      processed: false,
      error: error.message
    };
  }
}

/**
 * Analyze audio data to extract basic characteristics
 */
function analyzeAudioData(audioData) {
  // Convert ArrayBuffer to Int16Array (assuming 16-bit audio)
  const samples = new Int16Array(audioData);
  
  // Calculate basic audio characteristics
  let sum = 0;
  let maxVolume = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.abs(samples[i]) / 32768; // Normalize to 0-1
    sum += sample;
    maxVolume = Math.max(maxVolume, sample);
  }
  
  const averageVolume = sum / samples.length;
  const sampleRate = 16000; // Assume 16kHz
  const duration = samples.length / sampleRate;
  
  return {
    sampleCount: samples.length,
    duration,
    sampleRate,
    averageVolume,
    maxVolume,
    hasActivity: averageVolume > 0.01
  };
}

/**
 * Handle messages from main thread
 */
async function handleMessage(message) {
  if (!message || typeof message !== 'object') {
    console.error('❌ Invalid message received in audio worker');
    return;
  }

  switch (message.type) {
    case 'process_audio':
      await processAudio(message);
      break;
    
    default:
      console.warn(`⚠️ Unknown message type in audio worker: ${message.type}`);
      parentPort.postMessage({
        id: message.id || 'unknown',
        success: false,
        error: `Unknown message type: ${message.type}`
      });
  }
}

/**
 * Initialize the worker
 */
async function initializeWorker() {
  try {
    // Initialize required modules
    await initializeModules();
    
    // Set up message handler
    if (parentPort) {
      parentPort.on('message', handleMessage);
      console.log('🚀 Audio processing worker initialized and ready');
    } else {
      console.error('❌ parentPort not available in audio worker');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize audio worker:', error);
    process.exit(1);
  }
}

/**
 * Handle worker shutdown
 */
process.on('SIGTERM', () => {
  console.log('🛑 Audio worker shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Audio worker shutting down...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception in audio worker:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection in audio worker:', reason);
  process.exit(1);
});

// Start the worker
initializeWorker(); 