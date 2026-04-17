// netlify/functions/tts.js
// Proxies text to OpenAI TTS. Voice and speed are pluggable via request body —
// defaults chosen for the Tsoi Cat persona. Architecture left open so we can swap
// providers (ElevenLabs, Russian voices) later without client changes.

const DEFAULT_VOICE = 'onyx';
const DEFAULT_SPEED = 0.85;
const DEFAULT_MODEL = 'tts-1';

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { text, voice, speed, model } = body;
    if (!text || typeof text !== 'string') {
        return { statusCode: 400, body: JSON.stringify({ error: 'text string required' }) };
    }

    if (!process.env.OPENAI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };
    }

    // Clamp speed to OpenAI's allowed range (0.25 to 4.0)
    const finalSpeed = Math.max(0.25, Math.min(4.0, speed || DEFAULT_SPEED));

    try {
        const res = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: model || DEFAULT_MODEL,
                voice: voice || DEFAULT_VOICE,
                input: text,
                speed: finalSpeed,
                response_format: 'mp3'
            })
        });

        if (!res.ok) {
            const errText = await res.text();
            return {
                statusCode: res.status,
                body: JSON.stringify({ error: 'TTS request failed', detail: errText })
            };
        }

        // Response is binary MP3 audio. Encode as base64 for JSON transport.
        const audioArrayBuffer = await res.arrayBuffer();
        const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64');

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64 })
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'TTS proxy failed', detail: err.message })
        };
    }
};
