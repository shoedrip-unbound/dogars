#!/bin/node

let fs       = require('fs');
let settings = JSON.parse(fs.readFileSync('settings.json'));

let githubhook = require('githubhook');
let github = githubhook({path: '/reload',
						 secret: settings.secret});
let cp = require('child_process');

/*
let http = require('http');
let router = require('./routes.js').router
let server = http.createServer(router);
router.server = server;
server.listen(process.argv[2] || 1234);
*/

//let express = require('express');
//let app = express();
let app = require('./routes.js').listen(process.argv[2] || 1234);

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
