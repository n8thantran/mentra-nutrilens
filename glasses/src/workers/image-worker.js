/**
 * Image Processing Worker Thread
 * Handles photo upload and Claude analysis in parallel to avoid blocking the main thread
 */

const { parentPort, workerData } = require('worker_threads');
const path = require('path');

// Import required modules for image processing
let uploadPhotoToUploadThing;
let analyzeDietaryQuestionWithAudio;

// Dynamically import the modules since they might be ES modules
async function initializeModules() {
  try {
    // Import the upload function
    const uploadModule = await import('../services/uploadthing.js');
    uploadPhotoToUploadThing = uploadModule.uploadPhotoToUploadThing;

    // Import the Claude analysis function
    const claudeModule = await import('../services/claude-dietary-analysis.js');
    analyzeDietaryQuestionWithAudio = claudeModule.analyzeDietaryQuestionWithAudio;

    console.log('✅ Image worker modules initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize image worker modules:', error);
    process.exit(1);
  }
}

/**
 * Process image upload and optional Claude analysis
 */
async function processImage(message) {
  const { id, photoData, userId, question } = message;
  
  try {
    console.log(`🖼️ Image worker processing task ${id} for user ${userId}`);
    
    // Upload photo to get URL for Claude
    const uploadedFile = await uploadPhotoToUploadThing(
      photoData.buffer,
      photoData.filename,
      photoData.mimeType,
      userId,
      photoData.requestId
    );

    console.log(`📤 Image uploaded successfully: ${uploadedFile.url}`);

    let analysis = null;
    
    // Process with Claude if question provided
    if (question && question.trim()) {
      console.log(`🤖 Processing dietary question: "${question}"`);
      analysis = await analyzeDietaryQuestionWithAudio(question, uploadedFile.url, 'Nathan');
      console.log(`✅ Claude analysis completed for task ${id}`);
    }

    // Send success response back to main thread
    parentPort.postMessage({
      id,
      success: true,
      result: {
        uploadedFile,
        analysis
      }
    });

  } catch (error) {
    console.error(`❌ Image processing failed for task ${id}:`, error);
    
    // Send error response back to main thread
    parentPort.postMessage({
      id,
      success: false,
      error: error.message || 'Image processing failed'
    });
  }
}

/**
 * Handle messages from main thread
 */
async function handleMessage(message) {
  if (!message || typeof message !== 'object') {
    console.error('❌ Invalid message received in image worker');
    return;
  }

  switch (message.type) {
    case 'process_image':
      await processImage(message);
      break;
    
    default:
      console.warn(`⚠️ Unknown message type in image worker: ${message.type}`);
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
      console.log('🚀 Image processing worker initialized and ready');
    } else {
      console.error('❌ parentPort not available in image worker');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize image worker:', error);
    process.exit(1);
  }
}

/**
 * Handle worker shutdown
 */
process.on('SIGTERM', () => {
  console.log('🛑 Image worker shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Image worker shutting down...');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception in image worker:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection in image worker:', reason);
  process.exit(1);
});

// Start the worker
initializeWorker(); 