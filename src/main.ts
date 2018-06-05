import forever = require('forever-monitor');

let opts : forever.Options = {};
opts.max = 30000;
opts.silent = true;
opts.args = [(process.argv[2] || '1234')];

let child = new (forever.Monitor)('mememons.js', opts);

child.on('restart', function () {
    console.log('mememons.js has been restarted');
});

child.on('stdout', b => process.stdout.write(b.toString()));
child.on('stderr', b => process.stdout.write(b.toString()));

child.start();
