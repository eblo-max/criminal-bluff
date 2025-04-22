// Railway build script
const { execSync } = require('child_process');
const fs = require('fs');

// Create .env file if it doesn't exist
if (!fs.existsSync('.env')) {
  console.log('Creating .env file for Railway build...');
  fs.writeFileSync('.env', `VITE_SENTRY_DSN=https://a5291ea1ed611f0a45522c403b23981@o4509192317370448.ingest.sentry.io/4509192317731328\n`);
}

// Run the build
console.log('Starting Vite build...');
execSync('npm run build', { stdio: 'inherit' });
console.log('Build completed successfully!'); 