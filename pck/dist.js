const fs = require('fs');
const path = require('path');

// Define the source and destination directories
const sourceDir = 'node_modules/node-notifier/vendor/';
const destinationDir = 'dist/notifier/';

// List of files to copy
const filesToCopy = [
  'notifu/notifu.exe',
  'notifu/notifu64.exe',
  'snoreToast/snoretoast-x64.exe',
  'snoreToast/snoretoast-x86.exe',
  'mac.noindex/terminal-notifier.app/Contents/MacOS/terminal-notifier',
];

// Additional file to copy
const additionalFile = 'app/media/logo/favicon.ico';

// Iterate through the files and copy each one
[...filesToCopy, additionalFile].forEach(file => {
  const sourcePath = file.startsWith('app') ? file : path.join(sourceDir, file);
  const destinationPath = file.startsWith('app')
    ? path.join('dist', file)
    : path.join(destinationDir, path.basename(file));

  // Create destination directory if it doesn't exist
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });

  // Copy the file
  fs.copyFileSync(sourcePath, destinationPath);

  console.log(`Copied: ${sourcePath} -> ${destinationPath}`);
});

console.log('Copy operation complete.');