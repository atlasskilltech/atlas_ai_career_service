const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-key-not-set',
});

async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  try {
    const timeoutMs = options.timeout || 25000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 2000,
    }, { signal: controller.signal });

    clearTimeout(timer);

    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      throw new Error('Invalid response from OpenAI API');
    }
    return response.choices[0].message.content;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('OpenAI API request timed out');
    }
    throw err;
  }
}

async function textToSpeech(text, outputPath) {
  const response = await openai.audio.speech.create({
    model: 'tts-1',
    voice: 'nova',
    input: text,
    response_format: 'mp3',
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

async function speechToText(audioFilePath) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: 'whisper-1',
    language: 'en',
  });
  return transcription.text;
}

module.exports = { openai, chatCompletion, textToSpeech, speechToText };
