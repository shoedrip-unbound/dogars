#!/bin/node

let fs       = require('fs');
let settings = JSON.parse(fs.readFileSync('settings.json'));

let githubhook = require('githubhook');
let github = githubhook({path: '/reload',
						 secret: settings.secret});
let cp = require('child_process');

let app = require('./routes.js').listen(process.argv[2] || 1234);

setInterval(() => {
	console.log('starting backup...');
	fs.renameSync('./public/backup.sql', './public/backup' + (+ new Date()) + '.sql');
	let proc = cp.spawn('mysqldump', [
		'-u', settings.db.user,
		'-p' + settings.db.password,
		'memes'
	], {stdio: ['ignore',
				fs.openSync('./public/backup.sql', 'w+'),
				'ignore']});
	proc.on('exit', () => {
		console.log('backup finished...');
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
