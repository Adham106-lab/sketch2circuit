import fs from 'fs';

const API_KEY = 'fw_C9FWCqg6aoCsAVFCyiAm93';
// استخدام FireRouter with Opus المتاح في حسابك
const MODEL = 'accounts/fireworks/models/fire-router-opus';

const [,, targetFile, ...instructionParts] = process.argv;
const instruction = instructionParts.join(' ');

if (!targetFile || !instruction) {
  console.log('Usage: node agent.mjs <file-path> "<architect-instruction>"');
  process.exit(1);
}

const currentCode = fs.readFileSync(targetFile, 'utf8');
console.log(`🚀 [FireRouter Opus Agent] Processing ${targetFile}...`);

const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  },
  body: JSON.stringify({
    model: MODEL,
    temperature: 0.1,
    max_tokens: 16384,
    messages: [
      {
        role: 'system',
        content: 'You are an elite TypeScript, React, and Three.js architect. Return ONLY the complete, valid updated source code for the requested file without markdown code fences or explanations. Preserve all existing exports, props, and functionality while applying the architectural upgrade.'
      },
      {
        role: 'user',
        content: `FILE: ${targetFile}\n\nINSTRUCTION:\n${instruction}\n\nCURRENT SOURCE CODE:\n${currentCode}`
      }
    ]
  })
});

const data = await response.json();
if (!response.ok || !data.choices?.[0]?.message?.content) {
  console.error('❌ API Error:', JSON.stringify(data, null, 2));
  process.exit(1);
}

let updatedCode = data.choices[0].message.content.trim();
updatedCode = updatedCode.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');

fs.writeFileSync(targetFile, updatedCode, 'utf8');
console.log(`✅ [Success] Updated ${targetFile} cleanly with Opus!`);
