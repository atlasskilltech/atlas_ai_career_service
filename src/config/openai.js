const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function chatCompletion(systemPrompt, userPrompt, options = {}) {
  const response = await openai.chat.completions.create({
    model: options.model || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature || 0.7,
    max_tokens: options.maxTokens || 2000,
  });
  return response.choices[0].message.content;
}

module.exports = { openai, chatCompletion };
