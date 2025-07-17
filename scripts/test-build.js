const { exec } = require('child_process');

console.log('Testing Next.js build...\n');

exec('npm run build', (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Build failed with errors:');
    console.error(stderr);
    process.exit(1);
  }
  
  console.log('✅ Build completed successfully!');
  console.log(stdout);
  process.exit(0);
});