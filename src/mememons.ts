import fs = require('fs');
import cp = require('child_process');
import { connection } from './PSConnection';
import { shoestart } from './shoedrip';
import { router } from './routes';
import * as mongo from './mongo';
import { settings } from './settings';
import { logger } from './logger';

setInterval(async () => {
    let backup = settings.ressources + '/public/backup.gz';
    if (fs.existsSync(backup))
        fs.renameSync(backup, settings.ressources + '/public/backup' + (+ new Date()) + '.gz');
    await cp.spawnSync('mongodump', ['--db', settings.db.database, '--gzip']);
    await cp.spawnSync('tar', ['-czf', 'backup.tar.gz', 'dump']);
}, 3600 * 1000);

console.log('Starting web server...');
router.listen(process.argv[2] || 1234, async () => {
    console.log('Web server started, initializing database connection...');
    await mongo.init();
    console.log('Database connection started, initializing showdown connection...');
    await connection.connect();
    console.log('Showdown connection started, initializing showderp watch service...');
    shoestart();
});
