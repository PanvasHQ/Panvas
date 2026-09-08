import http from 'http';
import net from 'net';

const TARGET_PORT = 3001;
const PORTS_TO_BRIDGE = [3000, 5173];

for (const port of PORTS_TO_BRIDGE) {
  const server = http.createServer((req, res) => {
    const options = {
      hostname: 'localhost',
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${TARGET_PORT}`,
      },
    };

    const proxyReq = http.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bridge error to port ' + TARGET_PORT + ': ' + err.message);
    });

    req.pipe(proxyReq);
  });

  // Proxy WebSocket connections (e.g. for Vite HMR)
  server.on('upgrade', (req, socket, head) => {
    const proxySocket = net.connect({ host: 'localhost', port: TARGET_PORT }, () => {
      proxySocket.write(
        `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
        Object.entries(req.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        '\r\n\r\n'
      );
      if (head && head.length) proxySocket.write(head);
      socket.pipe(proxySocket);
      proxySocket.pipe(socket);
    });

    proxySocket.on('error', () => {
      socket.destroy();
    });
    socket.on('error', () => {
      proxySocket.destroy();
    });
  });

  server.on('error', err => {
    console.log(`Port ${port} bridge could not start: ${err.message}`);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Bridge listening on http://localhost:${port} -> http://localhost:${TARGET_PORT}`);
  });
}

