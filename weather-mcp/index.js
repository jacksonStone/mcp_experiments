
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import https from 'https';

// Create an MCP server
const server = new McpServer({
    name: 'weather-server',
    version: '1.0.0'
});

// Add the weather tool
server.registerTool(
    'getCurrentWeather',
    {
        title: 'Current Weather Tool',
        description: 'Get the current weather for a specified location',
        inputSchema: { location: z.string().describe('The city and state, e.g. San Francisco, CA') },
        outputSchema: {
            temperature: z.number(),
            windspeed: z.number(),
            winddirection: z.number(),
            weathercode: z.number(),
            is_day: z.number(),
            time: z.string()
        }
    },
    async ({ location }) => {
        console.log("Getting weather for " + JSON.stringify(location))
        // Get the latitude and longitude for the location
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;

        const geocodeResponse = await new Promise((resolve, reject) => {
            https.get(geocodeUrl, { headers: { 'User-Agent': 'weather-mcp' } }, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve(JSON.parse(data));
                });
            }).on('error', (err) => {
                reject(err);
            });
        });

        if (geocodeResponse.length === 0) {
            const error = { error: 'Could not find location' };
            return {
                content: [{ type: 'text', text: JSON.stringify(error) }],
                structuredContent: error
            };
        }

        const { lat, lon } = geocodeResponse[0];

        // Get the current weather for the location
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

        const weatherResponse = await new Promise((resolve, reject) => {
            https.get(weatherUrl, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    resolve(JSON.parse(data));
                });
            }).on('error', (err) => {
                reject(err);
            });
        });

        const {
          temperature,
          windspeed,
          winddirection,
          weathercode,
          is_day,
          time
      } = weatherResponse.current_weather;

      // 2. Create a new, clean object that perfectly matches your schema.
      const output = {
          temperature,
          windspeed,
          winddirection,
          weathercode,
          is_day,
          time
      };
        return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output
        };
    }
);

// Set up Express and HTTP transport
const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
    // Create a new transport for each request to prevent request ID collisions
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    res.on('close', () => {
        transport.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '3000');
app.listen(port, () => {
    console.log(`Weather MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});
