#!/usr/bin/env node

// Development server script that respects PORT environment variable
const { spawn } = require('child_process');

const port = process.env.PORT || '3000';
const hostname = '0.0.0.0';

console.log(`Starting Next.js development server on port ${port}...`);

const child = spawn('next', ['dev', '-p', port, '--hostname', hostname], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: port }
});

child.on('exit', (code) => {
  process.exit(code);
});