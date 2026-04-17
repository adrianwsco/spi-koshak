// netlify/functions/whisper.js
// Proxies audio to OpenAI Whisper for transcription.
// Client sends base64-encoded audio; we forward as multipart.

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

    const { audioBase64, filename } = body;
    if (!audioBase64) {
        return { statusCode: 400, body: JSON.stringify({ error: 'audioBase64 required' }) };
    }

    if (!process.env.OPENAI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY not configured' }) };
    }

    try {
        // Decode base64 to binary buffer
        const audioBuffer = Buffer.from(audioBase64, 'base64');

        // Build multipart form data manually — Netlify functions don't have FormData
        // in the same way the browser does, but Node 18+ has global FormData and Blob.
        const fd = new FormData();
        const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
        fd.append('file', audioBlob, filename || 'audio.webm');
        fd.append('model', 'whisper-1');
        fd.append('language', 'en');

        const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: fd
        });

        const data = await res.json();
        return {
            statusCode: res.status,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };
    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Transcription failed', detail: err.message })
        };
    }
};
