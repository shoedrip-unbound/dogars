let fs = require('fs');
module.exports = JSON.parse(fs.readFileSync(__dirname + '/settings.json'));
