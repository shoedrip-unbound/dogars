import fs = require('fs');
import cp = require('child_process');
import {connection} from './PSConnection';
import {shoestart} from './shoedrip';
import {router} from './routes';

import { settings } from './settings';

setInterval(() => {
    fs.renameSync(__dirname + '/public/backup.sql', __dirname + '/public/backup' + (+ new Date()) + '.sql');
    let proc = cp.spawn('mysqldump', [
        '-u', settings.db.user,
        '-p' + settings.db.password,
        'memes'
    ], {
            stdio: ['ignore',
                fs.openSync(__dirname + '/public/backup.sql', 'w+'),
                'ignore']
        });
    proc.on('exit', () => {
    });
}, 3600 * 1000);

(async () => {
    await connection.connect();
    shoestart();
    console.log('SHOE STARTED');
    router.listen(process.argv[2] || 1234, () => {
        console.log("started listening");
    });
})();
