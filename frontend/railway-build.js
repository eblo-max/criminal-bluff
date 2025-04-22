// Railway build script
const { execSync } = require('child_process');
const fs = require('fs');

// Create .env file if it doesn't exist
if (!fs.existsSync('.env')) {
  console.log('Creating .env file for Railway build...');
  // Не создаем Sentry DSN, так как мы удалили зависимость
  fs.writeFileSync('.env', `NODE_ENV=production\n`);
}

// Run the build
console.log('Starting Vite build...');
execSync('npm run build', { stdio: 'inherit' });
console.log('Build completed successfully!'); 