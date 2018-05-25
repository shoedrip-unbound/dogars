#!/bin/node

let fs       = require('fs');
let settings = require('./settings');
let connection = require('./PSConnection.js');
let shoe       = require('./shoedrip.js');

console.elog = function(level, ...args) {
	if (settings.log_level && ~~settings.log_level > level)
	   console.log(...args);
}

let githubhook = require('githubhook');
let github = githubhook({path: '/reload',
						 secret: settings.secret,
						 port: 3420 + process.argv[2] - 1234});
let cp = require('child_process');

let app = require('./routes.js');

setInterval(() => {
	console.elog(0, 'starting backup...');
	fs.renameSync(__dirname + '/public/backup.sql', __dirname + '/public/backup' + (+ new Date()) + '.sql');
	let proc = cp.spawn('mysqldump', [
		'-u', settings.db.user,
		'-p' + settings.db.password,
		'memes'
	], {stdio: ['ignore',
				fs.openSync(__dirname + '/public/backup.sql', 'w+'),
				'ignore']});
	proc.on('exit', () => {
		console.elog(0, 'backup finished...');
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

(async () => {
	console.log('listening');
	await connection.start();
	console.log('connection started');
	shoe.start();
	app.listen(process.argv[2] || 1234);
	console.log('not blocking');
})();

try {
	github.listen();
}
catch(e) {
	// beta
}
