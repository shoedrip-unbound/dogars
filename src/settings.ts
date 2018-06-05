import fs = require('fs');

export let settings = JSON.parse(fs.readFileSync(__dirname + 'settings.json').toString());
