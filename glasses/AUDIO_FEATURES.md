# 🎵 Audio Features Integration

## Overview

The MentraOS Nutrition Lens now includes **text-to-speech audio generation** using ElevenLabs and UploadThing. Claude's dietary analysis responses are automatically converted to audio and uploaded to your UploadThing bucket for easy access.

## ✨ What's New

### 1. **Automatic Audio Generation**
- Claude's dietary analysis text is automatically converted to speech using ElevenLabs
- Audio files are uploaded to UploadThing and accessible via URL
- High-quality MP3 audio with customizable voices

### 2. **Enhanced Workflow**
```
User asks dietary question → Photo captured → Claude analyzes → 
ElevenLabs generates audio → UploadThing stores audio → 
Returns both text analysis + audio URL
```

### 3. **New API Endpoints**
- `/api/audio/text-to-speech` - Convert any text to audio
- `/api/audio/dietary-analysis` - Full dietary analysis with audio

## 🔧 Implementation Details

### Core Functions

#### `analyzeDietaryQuestionWithAudio()`
```typescript
const result = await analyzeDietaryQuestionWithAudio(
  question: string,
  imageUrl: string, 
  username: string = 'Nathan',
  voiceId?: string
);

// Returns:
{
  analysis: string;           // Claude's text analysis
  audioUrl: string;          // UploadThing audio URL
  audioKey: string;          // UploadThing file key
  audioCustomId: string;     // Custom identifier
}
```

#### `convertTextToAudio()`
```typescript
const audioResult = await convertTextToAudio(
  text: string,
  userId: string,
  voiceId?: string
);

// Returns:
{
  audioUrl: string;          // UploadThing audio URL
  audioKey: string;          // UploadThing file key  
  audioCustomId: string;     // Custom identifier
}
```

## 🚀 Usage Examples

### Example 1: Basic Text-to-Speech
```bash
curl -X POST http://localhost:3000/api/audio/text-to-speech \
  -H "Content-Type: application/json" \
  -d '{
    "text": "This food looks great! It contains chicken, rice, and vegetables. Perfect for your balanced diet.",
    "userId": "Nathan"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Text converted to audio successfully",
  "data": {
    "audioUrl": "https://uploadthing.com/f/abc123.mp3",
    "audioKey": "abc123.mp3",
    "audioCustomId": "tts-Nathan-1642095123"
  }
}
```

### Example 2: Dietary Analysis with Audio
```bash
curl -X POST http://localhost:3000/api/audio/dietary-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Is this meal healthy for me?",
    "imageUrl": "https://example.com/food-image.jpg",
    "username": "Nathan",
    "voiceId": "JBFqnCBsd6RMkjVDRZzb"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Dietary analysis with audio completed successfully", 
  "data": {
    "analysis": "Looking at this meal, I can see chicken, rice, and vegetables. Since you avoid red meat, this is perfect for you...",
    "audioUrl": "https://uploadthing.com/f/analysis-xyz789.mp3",
    "audioKey": "analysis-xyz789.mp3",
    "audioCustomId": "Nathan-analysis-1642095456"
  }
}
```

## 🎤 Voice Customization

### Available Voice IDs
ElevenLabs provides various voice options. Some popular ones:
- `JBFqnCBsd6RMkjVDRZzb` - Default voice (clear, neutral)
- `21m00Tcm4TlvDq8ikWAM` - Professional voice
- `AZnzlk1XvdvUeBnXmlld` - Friendly, warm voice

### Custom Voice Usage
```typescript
// Use a specific voice
const result = await analyzeDietaryQuestionWithAudio(
  "Is this healthy?",
  "https://example.com/image.jpg",
  "Nathan",
  "21m00Tcm4TlvDq8ikWAM" // Custom voice ID
);
```

## 📊 Output Details

### Terminal Output
When the main application runs, you'll see enhanced output:
```
🤖 === CLAUDE DIETARY ANALYSIS WITH AUDIO ===
👤 User: Nathan
❓ Question: "Is this meal healthy for me?"
📷 Image: https://uploadthing.com/f/photo123.jpg
💬 Analysis: Looking at this meal, I can see chicken, rice, and vegetables...
🎧 Audio URL: https://uploadthing.com/f/analysis-abc123.mp3
🔑 Audio Key: analysis-abc123.mp3
===============================================
```

### MentraOS Glasses Display
```
✅ Analysis & Audio Generated!
Check terminal for results.
```

## 🔄 Integration with Existing Features

### Simplified Database Approach
- **No more complex JSON parsing** - entire users table sent to Claude
- **Claude handles user lookup** and dietary restriction parsing
- **Robust error handling** for missing users or database issues

### UploadThing Storage
- Audio files stored in `nutrilens-audio` bucket
- Organized with custom IDs: `tts-{userId}-{timestamp}`
- Automatic cleanup and management via UploadThing

### ElevenLabs Configuration
- Uses `eleven_multilingual_v2` model for best quality
- MP3 format at 44.1kHz/128kbps for optimal file size
- Configurable voice selection per request

## 🛠️ Development & Testing

### Environment Variables Required
```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
UPLOADTHING_SECRET=your_uploadthing_secret
UPLOADTHING_APP_ID=your_uploadthing_app_id
```

### Testing the Integration
1. **Start the application:**
   ```bash
   npm run dev
   ```

2. **Test basic text-to-speech:**
   ```bash
   curl -X POST http://localhost:3000/api/audio/text-to-speech \
     -H "Content-Type: application/json" \
     -d '{"text": "Hello world", "userId": "test"}'
   ```

3. **Test via glasses:** Ask a dietary question using your smart glasses

## 📈 Performance Notes

- **Audio Generation Time:** ~2-5 seconds for typical responses
- **File Sizes:** ~50-200KB for typical dietary analysis responses  
- **Storage:** Files permanently stored in UploadThing (consider cleanup policies)
- **Rate Limits:** Subject to ElevenLabs API rate limits

## 🔮 Future Enhancements

- **Voice cloning** for personalized user voices
- **Batch audio generation** for multiple analyses
- **Audio caching** to avoid regenerating identical responses
- **Streaming audio** for real-time playback on glasses
- **Multiple language support** via ElevenLabs multilingual models

---

**Built with Context7 assistance** 🤖✨ 