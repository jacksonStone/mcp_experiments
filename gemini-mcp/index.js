
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { z } from 'zod';
import { spawn } from 'child_process';

// Create an MCP server
const server = new McpServer({
    name: 'gemini-cli-server',
    version: '1.0.0'
});

// Add the gemini tool
server.registerTool(
    'invokeGemini',
    {
        title: 'Invoke Gemini CLI',
        description: 'Invokes the gemini-cli with a given prompt. This is useful when there is a sub task that can be effectively completed off the main thread to save context. Good for highly parallelizable or "research" like tasks that may produce a lot of excess context.',
        inputSchema: { prompt: z.string().describe('The prompt to send to gemini-cli') },
        outputSchema: {
            result: z.string()
        }
    },
    async ({ prompt }) => {
        console.log(`Invoking gemini-cli with prompt: "${prompt}"`);
        console.log(`full command: gemini -m 'gemini-2.5-flash' --yolo -p "${prompt}. Use the currentWeather tool"` )
        return new Promise((resolve, reject) => {
            const gemini = spawn('gemini', ['-m', 'gemini-2.5-flash', '--yolo', '-p', prompt]);

            let stdout = '';
            let stderr = '';

            gemini.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            gemini.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            gemini.on('close', (code) => {
                if (code !== 0) {
                    console.error(`gemini process exited with code ${code}`);
                    const errorResult = { error: stderr };
                    resolve({
                        content: [{ type: 'text', text: JSON.stringify(errorResult) }],
                        structuredContent: errorResult
                    });
                    return;
                }
                const output = { result: stdout || stderr };
                console.log(output);
                resolve({
                    content: [{ type: 'text', text: JSON.stringify(output) }],
                    structuredContent: output
                });
            });

            gemini.on('error', (err) => {
                console.error('Failed to start subprocess.', err);
                reject(err);
            });
        });
    }
);

console.log('Registered tools:', server._registeredTools);

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

const port = parseInt(process.env.PORT || '3001');
app.listen(port, () => {
    console.log(`Gemini MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
});
