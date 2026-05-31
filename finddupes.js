const fs = require('fs');
const path = require('path');
const names = {};

function scan(dir) {
  fs.readdirSync(dir).forEach(f => {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      scan(full);
    } else if (f.endsWith('.js')) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.matchAll(/\.setName\('([^']+)'\)/g);
      for (const m of matches) {
        if (!names[m[1]]) names[m[1]] = [];
        names[m[1]].push(full);
      }
    }
  });
}

scan('commands');

let found = false;
Object.entries(names).forEach(([k, v]) => {
  if (v.length > 1) {
    console.log('DUPLICATE:', k);
    v.forEach(f => console.log('  ->', f));
    found = true;
  }
});

if (!found) console.log('No duplicates found!');