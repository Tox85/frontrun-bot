import { createServer, IncomingMessage, ServerResponse } from 'http';

const PORT = process.env.PORT || 3000;

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'Frontrun Bot',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage()
    }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

export function startHealthCheck() {
  try {
    server.listen(PORT, () => {
      console.log(`🏥 Health check server running on port ${PORT}`);
    });
    
    server.on('error', (error) => {
      console.error('❌ Health check server error:', error);
    });
  } catch (error) {
    console.error('❌ Failed to start health check server:', error);
  }
} 