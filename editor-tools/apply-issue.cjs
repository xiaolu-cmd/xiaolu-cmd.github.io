const fs = require('fs');
const path = require('path');
const {applyIssue} = require('../lib/columns.cjs');
const file = path.join(__dirname, '../content/columns.json');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const current = JSON.parse(fs.readFileSync(file, 'utf8'));
const next = applyIssue(current, event);
fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n');
console.log('Authenticated column revision applied.');
