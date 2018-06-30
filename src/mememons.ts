import fs = require('fs');
import cp = require('child_process');
import { Server } from 'http';
import { EventEmitter } from 'events';
import http = require('http');

import { connection } from './Showdown/PSConnection';

import { shoestart } from './Shoedrip/shoedrip';

import { router } from './Website/routes';

import * as mongo from './Backend/mongo';
import { settings } from './Backend/settings';
import { logger } from './Backend/logger';
import { Cringer } from './Backend/CringeProvider';


setInterval(async () => {
    let backup = settings.ressources + '/public/backup.tar.gz';
    if (fs.existsSync(backup))
        fs.renameSync(backup, settings.ressources + '/public/backup' + (+ new Date()) + '.gz');
    await cp.spawnSync('mongodump', ['--db', settings.db.database, '--gzip', '-o', settings.ressources]);
    await cp.spawnSync('tar', ['-czf', backup, settings.ressources + '/dump']);
}, 3600 * 1000);

console.log('Starting web server...');

let server = http.createServer(router);
Cringer.install(server);
server.listen(+process.argv[2] || 1234, '0.0.0.0', async () => {
    console.log('Web server started, initializing database connection...');
    await mongo.init();
    console.log('Database connection started, initializing showdown connection...');
    await connection.connect();
    console.log('Showdown connection started, initializing showderp watch service...');
    shoestart();
});
