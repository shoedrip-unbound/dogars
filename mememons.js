#!/bin/node

let fs       = require('fs');
let settings = JSON.parse(fs.readFileSync('settings.json'));

let githubhook = require('githubhook');
let github = githubhook({path: '/reload',
						 secret: settings.secret});
let cp = require('child_process');

let app = require('./routes.js').listen(process.argv[2] || 1234);

setInterval(() => {
    cp.exec('mysqldump -u ' + settings.db.user + ' -p' + settings.db.password + ' memes', (e, si, se) => {
		if (e)
			return console.log(e);
		fs.renameSync('./public/backup.sql', './public/backup' + (+ new Date()) + '.sql');
		fs.writeFile('./public/backup.sql', si, () => {
			console.log('Backup done');
		});
	});
}, 3600 * 1000);

github.on('push', () => {
  try {
    cp.execSync('git pull origin master || true');
    cp.execSync('git pull hub master || true');
    cp.execSync('npm install');
  }
  catch(e) {
  }
  process.exit(1);
});

github.listen();
