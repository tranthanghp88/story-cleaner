const fs = require('fs');
const path = require('path');
const os = require('os');

const chaptersPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Story Cleaner', 'chapters');
if (fs.existsSync(chaptersPath)) {
  const dirs = fs.readdirSync(chaptersPath);
  console.log("Directories under chapters:", dirs);
  dirs.forEach(d => {
    const fullPath = path.join(chaptersPath, d);
    if (fs.statSync(fullPath).isDirectory()) {
      console.log(`Folder: ${d} has files:`, fs.readdirSync(fullPath));
    }
  });
} else {
  console.log("Chapters path does not exist.");
}
