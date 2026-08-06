require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Flood backend is running');
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
    res.status(500).json({ error: 'Failed to fetch imagery' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

