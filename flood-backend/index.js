require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const allowedOrigins = [
  'https://flood-intelligence-tool.vercel.app',
];

app.use(cors({
  origin(origin, callback) {
    const isLocalhost =
      origin &&
      /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

    const isVercelPreview =
      origin && /\.vercel\.app$/.test(origin);

    if (!origin || allowedOrigins.includes(origin) || isLocalhost || isVercelPreview) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
}));
app.use(express.json({ limit: '25mb' }));

app.get('/', (req, res) => {
  res.send('Flood backend is running');
});

app.get('/api/token', async (req, res) => {
  try {
    if (!process.env.SENTINEL_CLIENT_ID || !process.env.SENTINEL_CLIENT_SECRET) {
      return res.status(500).json({
        error: 'Sentinel credentials are missing on the backend',
      });
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.SENTINEL_CLIENT_ID);
    params.append('client_secret', process.env.SENTINEL_CLIENT_SECRET);

    const response = await fetch('https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token',  {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'Failed to fetch Sentinel Hub token',
        details: errorText,
      });
    }

    const tokenData = await response.json();
    res.json(tokenData);
  } catch (err) {
    console.error('Error fetching token:', err);
    res.status(500).json({ error: 'Failed to fetch token' });
  }
});

app.post('/api/imagery', async (req, res) => {
  try {
    const { lat, lng, fromDate, toDate, accessToken } = req.body;
    const latitude = Number(lat);
    const longitude = Number(lng);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !fromDate || !toDate || !accessToken) {
      return res.status(400).json({ error: 'lat, lng, fromDate, toDate, and accessToken are required' });
    }

    const bbox = [longitude - 0.15, latitude - 0.15, longitude + 0.15, latitude + 0.15];

    const evalscript = `
      //VERSION=3
      function setup() {
        return { input: ["B02", "B03", "B04"], output: { bands: 3 } };
      }
      function evaluatePixel(sample) {
        return [sample.B04 * 3.5, sample.B03 * 3.5, sample.B02 * 3.5];
      }
    `;

    const response = await fetch('https://sh.dataspace.copernicus.eu/api/v1/process', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          bounds: { bbox },
          data: [
            {
              type: 'sentinel-2-l2a',
              dataFilter: {
                timeRange: {
                  from: `${fromDate}T00:00:00Z`,
                  to: `${toDate}T23:59:59Z`,
                },
              },
            },
          ],
        },
        output: { width: 512, height: 512 },
        evalscript,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: 'Failed to fetch imagery',
        details: errorText,
      });
    }

    const buffer = await response.arrayBuffer();
    res.set('Content-Type', response.headers.get('content-type') || 'image/png');
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error('Error fetching imagery:', err);
    res.status(500).json({ error: 'Failed to fetch imagery' });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
     console.log('ANALYZE ROUTE HIT');
    const {
      location,
      fromDate,
      toDate,
      beforeImage,
      afterImage,
    } = req.body;

    if (!beforeImage || !afterImage) {
      return res.status(400).json({
        error: 'Both satellite images are required',
      });
    }

    console.log('AI analysis requested:', {
      location,
      fromDate,
      toDate,
    });

    const response = await openai.responses.create({
      model: 'gpt-5.6-luna',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
You are analyzing satellite imagery for flooding.

Location: ${location}

The first image is BEFORE the floods (June 2022).
The second image is DURING the floods (August 2022).

Compare the two images.

Return exactly these three things:

1. What changed:
One short sentence describing the visible change.

2. Flooding severity:
Choose only one:
- Significant
- Moderate
- Minimal

3. Affected areas:
Briefly describe the visible areas that appear affected.

Do not invent exact measurements, percentages, water depths, or statistics.
Only describe what can reasonably be observed from the images.
              `,
            },
            {
              type: 'input_image',
              image_url: beforeImage,
            },
            {
              type: 'input_image',
              image_url: afterImage,
            },
          ],
        },
      ],
    });

    res.json({
      analysis: response.output_text,
    });
  } catch (err) {
    console.error('AI analysis error:', err);

    res.status(500).json({
      error: 'Failed to generate AI analysis',
    });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
