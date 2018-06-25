import fs = require('fs');
import cp = require('child_process');
import { connection } from './PSConnection';
import { shoestart } from './shoedrip';
import { router } from './routes';
import * as mongo from './mongo';
import { settings } from './settings';
import { logger } from './logger';
import { Cringer } from './CringeProvider';
import { Http2SecureServer } from 'http2';
import { Server } from 'http';
import { EventEmitter } from 'events';
import { httpify } from 'caseless';
import http = require('http');

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
server.listen(process.argv[2] || 1234, async () => {
    console.log('Web server started, initializing database connection...');
    await mongo.init();
    console.log('Database connection started, initializing showdown connection...');
    await connection.connect();
    console.log('Showdown connection started, initializing showderp watch service...');
    shoestart();
});
