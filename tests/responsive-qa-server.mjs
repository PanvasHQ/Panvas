import { createServer } from 'vite';

// Keep browser QA independent of other dev/test servers sharing .vite/deps.
const server = await createServer({
  mode: 'web',
  cacheDir: 'node_modules/.vite-responsive-qa',
  optimizeDeps: { entries: ['index.html', 'tests/fixtures/notebook-interactions.html'] },
  server: { host: '127.0.0.1', port: 3011, strictPort: true, open: false },
});
await server.listen();
server.printUrls();
