import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import { getSetting } from '../lib/settings.js';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req: AuthRequest, res) => {
  const { messages, systemPrompt } = req.body as {
    messages: { role: 'user' | 'model'; content: string }[];
    systemPrompt?: string;
  };

  if (!messages?.length) { res.status(400).json({ error: 'messages obrigatório' }); return; }

  const provider = (await getSetting('ai_provider', 'AI_PROVIDER')) || 'gemini';
  const model = (await getSetting('ai_model', 'AI_MODEL')) || 'gemma-3-27b-it';
  const apiKey = await getSetting('ai_api_key', 'GEMINI_API_KEY');

  if (!apiKey) { res.status(500).json({ error: 'Chave de API da IA não configurada' }); return; }

  try {
    if (provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const history = messages.slice(0, -1).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));
      const lastMsg = messages[messages.length - 1].content;

      const chat = ai.chats.create({
        model,
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
        history,
      });

      const result = await chat.sendMessage({ message: lastMsg });
      res.json({ content: result.text ?? '' });

    } else if (provider === 'openai') {
      const openaiMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages.map((m) => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: openaiMessages }),
      });
      const data = await response.json() as any;
      if (!response.ok) throw new Error(data.error?.message ?? 'OpenAI error');
      res.json({ content: data.choices[0]?.message?.content ?? '' });

    } else {
      res.status(400).json({ error: `Provedor de IA desconhecido: ${provider}` });
    }
  } catch (err: any) {
    console.error('[chat]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
