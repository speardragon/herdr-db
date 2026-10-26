#!/usr/bin/env node
// Local viewer server: serves the UI and streams captured MongoDB MCP calls on 127.0.0.1.
import { appendLog, ensureDirs, loadConfig, pathsFor, resolveHome } from '../src/config.mjs';
import { createViewerServer } from '../src/server/app.mjs';

const paths = pathsFor(resolveHome());
ensureDirs(paths);
const config = loadConfig(paths);
const server = createViewerServer({ paths, config });

server.on('error', (error) => {
  // Another hook already started the server: nothing to do.
  if (error.code === 'EADDRINUSE') process.exit(0);
  appendLog(paths.serverLog, `server error: ${error.stack ?? error}`);
  process.exit(1);
});

server.listen(config.port, '127.0.0.1', () => {
  appendLog(paths.serverLog, `listening on http://127.0.0.1:${config.port}/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
