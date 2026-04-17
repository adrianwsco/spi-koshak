// netlify/functions/tts.js
// Proxies text to OpenAI TTS. Voice and speed are pluggable via request body —
// defaults chosen for the Tsoi Cat persona. Architecture left open so we can swap
// providers (ElevenLabs, Russian voices) later without client changes.

const DEFAULT_VOICE = 'onyx';
const DEFAULT_SPEED = 0.75;
const DEFAULT_MODEL = 'tts-1-hd';

// ---------- Cyrillic → Latin transliteration for TTS ----------
// OpenAI's English TTS mangles or skips Cyrillic. We transliterate before sending
// so Onyx has something phonetic to attempt. The on-screen subtitle still renders
// the original Cyrillic — this substitution is TTS-only. Replace with a proper
// Slavic voice (ElevenLabs) in a later sprint.
// Phonetic mapping favors what English TTS will pronounce closest to the Russian sound,
// not strict BGN/PCGN transliteration. E.g. "ё" → "yo" not "e".

const CYRILLIC_MAP = {
    'а': 'a',  'б': 'b',  'в': 'v',  'г': 'g',  'д': 'd',
    'е': 'ye', 'ё': 'yo', 'ж': 'zh', 'з': 'z',  'и': 'i',
    'й': 'y',  'к': 'k',  'л': 'l',  'м': 'm',  'н': 'n',
    'о': 'o',  'п': 'p',  'р': 'r',  'с': 's',  'т': 't',
    'у': 'u',  'ф': 'f',  'х': 'kh', 'ц': 'ts', 'ч': 'ch',
    'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y',  'ь': '',
    'э': 'e',  'ю': 'yu', 'я': 'ya',
    // uppercase
    'А': 'A',  'Б': 'B',  'В': 'V',  'Г': 'G',  'Д': 'D',
    'Е': 'Ye', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z',  'И': 'I',
    'Й': 'Y',  'К': 'K',  'Л': 'L',  'М': 'M',  'Н': 'N',
    'О': 'O',  'П': 'P',  'Р': 'R',  'С': 'S',  'Т': 'T',
    'У': 'U',  'Ф': 'F',  'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch',
    'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y',  'Ь': '',
    'Э': 'E',  'Ю': 'Yu', 'Я': 'Ya',
};

function transliterateCyrillic(text) {
    if (!/[а-яА-ЯёЁ]/.test(text)) return text;
    return text.replace(/[а-яА-ЯёЁ]/g, (ch) => CYRILLIC_MAP[ch] ?? ch);
}

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

    // Transliterate any Cyrillic to Latin before TTS. English voices can't
    // pronounce Cyrillic directly — giving them a phonetic approximation
    // gets us something close to the target Russian sound.
    const ttsText = transliterateCyrillic(text);

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
                input: ttsText,
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
