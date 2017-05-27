var forever = require('forever-monitor');

var child = new (forever.Monitor)('mememons.js', {
  max: 30,
  silent: true,
  args: [(process.argv[2] || 1234)]
});

child.on('restart', function () {
  console.log('mememons.js has been restarted');
});

child.on('stdout', b => process.stdout.write(b.toString()));
child.on('stderr', b => process.stdout.write(b.toString()));

child.start();