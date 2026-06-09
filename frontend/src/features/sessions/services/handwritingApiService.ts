interface Point {
  x: number;
  y: number;
  t: number;
}

interface MyScriptStroke {
  x: number[];
  y: number[];
  t: number[];
}

interface MyScriptBatchResponse {
  label: string;
}

async function generateHmacSignature(
  payload: string,
  applicationKey: string,
  hmacKey: string,
): Promise<string> {
  const signingKey = applicationKey + hmacKey;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const payloadData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);

  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function mapStrokesToMyScriptFormat(rawStrokes: Point[][]): MyScriptStroke[] {
  return rawStrokes.map(stroke => ({
    x: stroke.map(p => p.x),
    y: stroke.map(p => p.y),
    t: stroke.map(p => p.t),
  }));
}

export async function recognizeBatch(strokesJson: string): Promise<string> {
  const appKey: string | undefined = import.meta.env.VITE_MYSCRIPT_APP_KEY;
  const hmacKey: string | undefined = import.meta.env.VITE_MYSCRIPT_HMAC_KEY;

  if (!appKey || !hmacKey) {
    throw new Error(
      'MyScript API keys are not configured. Set VITE_MYSCRIPT_APP_KEY and VITE_MYSCRIPT_HMAC_KEY in your .env file.',
    );
  }

  const rawStrokes: Point[][] = JSON.parse(strokesJson);
  if (rawStrokes.length === 0) return '';

  const mappedStrokes = mapStrokesToMyScriptFormat(rawStrokes);

  const payload = JSON.stringify({
    width: 2000,
    height: 2000,
    contentType: 'Text',
    configuration: { lang: 'fr_FR' },
    strokeGroups: [{ strokes: mappedStrokes }],
  });

  const hmacSignature = await generateHmacSignature(payload, appKey, hmacKey);

  try {
    const response = await fetch('https://cloud.myscript.com/api/v4.0/iink/batch', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.myscript.jiix',
        'Content-Type': 'application/json',
        applicationKey: appKey,
        hmac: hmacSignature,
      },
      body: payload,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      throw new Error(`MyScript API error ${response.status}: ${errorBody}`);
    }

    const data: MyScriptBatchResponse = await response.json();
    console.log('MyScript raw response:', data);
    return data.label;
  } catch (err) {
    console.error('[HandwritingApiService] Recognition request failed:', err);
    throw new Error('Handwriting recognition failed. Please check your connection and try again.');
  }
}
