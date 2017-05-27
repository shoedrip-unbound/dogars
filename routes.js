let fs       = require('fs');
let tripcode = require('tripcode');
let poke     = require('./poke-utils');
let db       = require('./db.js');
let shoe     = require('./shoedrip.js');
let mustache = require('mustache');
let Router   = require('node-simple-router');
let router   = Router();

let files = ['shell', 'index', 'set', 'all', 'import', '404', '500'];
let fileCache = {};

files.forEach(f => {
  let file = 'templates/' + f + '.mustache';
  fileCache[f] = fs.readFileSync(file, 'utf8');
  fs.watch(file, {persistent: false, }, (event, name) => {
    if (event != 'change')
      return;
    fileCache[f] = fs.readFileSync(file, 'utf8');
  });
});

let getSetOfTheDay = cb => {
  let today = new Date();
  let seed = today.getDate() * (today.getMonth() + 1) * (today.getYear() + 1900);
  seed = seed % db.total;
  // >set of the "day"
  // >changes everytime you add or delete a set
  db.getSetById('' + seed, set => {
    cb(poke.formatSetFromRow(set))
  });
}

let getCookieData = request => {
  if (!request.headers.cookie)
    return {
      dark: 'false',
      style_suffix: '',
      waifu: '/lillie2.png'
    };
  let cook = router.utils.cookie2obj(request.headers.cookie);
  return {
    dark: cook.dark,
    style_suffix: cook.dark == 'true' ? '2' : '',
    waifu: cook.dark == 'true' ? '/moon.png' : '/lillie2.png'
  };
}

router.get("/", (request, response) => {
  getSetOfTheDay(set => {
    set = router.utils.extendObj(set, getCookieData(request));
    set = router.utils.extendObj(set, shoe.champ);
    response.writeHead(200, {'Content-type': 'text/html'});
    response.end(mustache.render(fileCache['shell'], set, {content: fileCache['index']}));
  });
});

router.get("/all", (request, response) => {
  db.getAllSets(sets => {
    sets = sets.map(e => { return poke.formatSetFromRow(e)});
    response.writeHead(200, {'Content-type': 'text/html'});
    let data = router.utils.extendObj({sets: sets}, getCookieData(request));
    data = router.utils.extendObj(data, shoe.champ);
    response.end(mustache.render(fileCache['shell'], data, {content: fileCache['all']}));
  })
});

router.get("/import", (request, response) => {
  response.writeHead(200, {'Content-type': 'text/html'});
  let data = router.utils.extendObj(shoe.champ, getCookieData(request));
  response.end(mustache.render(fileCache['shell'], data, {content: fileCache['import']}));    
});

router.post("/update/:id", (request, response) => {
  let handleErrorGen = e => {
    if(e) {
      response.writeHead(200, {'Refresh': '2; url=/'});
      response.end('You fucked up something. Back to the homepage in 2, 1...');
      return;
    }
    response.writeHead(200, {'Refresh': '0; url=/set/' + request.params.id});
    response.end('');    
  };

  if (request.post.action == "Update")
    db.updateSet(request, handleErrorGen);
  else if (request.post.action == "Delete")
    db.deleteSet(request, handleErrorGen);
  else
    handleErrorGen(true);
});

router.post("/add", (request, response) => {
  try {
    db.createNewSet(request, (e, info) => {
      if(e) {
        response.writeHead(200, {'Refresh': '2; url=/'});
        response.end('You fucked up something. Back to the homepage in 2, 1...');
        return;
      }
      response.writeHead(200, {'Refresh': '0; url=/set/' + info.insertId});
      response.end('');
    });
  }
  catch(e) {
    console.log(e);
    response.writeHead(200, {'Refresh': '2; url=/'});
    response.end('You fucked up something. Back to the homepage in 2, 1...');
  }
});

router.get("/favicon.ico", (request, response) => {
  response.end(fs.readFileSync('favicon.ico'));
});

router.get("/random", (request, response) => {
  let randid = Math.random() * db.total;
  randid = ~~randid;
  response.writeHead(200, {'Refresh': '0; url=/set/' + randid});
  response.end('');
});

router.get("/search", (request, response) => {
  db.getSetsByName(request.get.q, sets => {
    sets = sets.map(e => { return poke.formatSetFromRow(e)});
    let data = router.utils.extendObj({sets: sets}, getCookieData(request));
    data = router.utils.extendObj(data, shoe.champ);
    response.writeHead(200, {'Content-type': 'text/html'});
    response.end(mustache.render(fileCache['shell'], data, {content: fileCache['all']}));    
  })
});

router.get("/set/:id", (request, response) => {
  db.getSetById(request.params.id, set => {
    if (!set)
    {
      response.writeHead(200, {'Refresh': '0; url=/'});
      response.end('');
      return;
    }
    set = poke.formatSetFromRow(set);
    set = router.utils.extendObj(set, getCookieData(request));
    set = router.utils.extendObj(set, shoe.champ);
    response.writeHead(200, {'Content-type': 'text/html'});
    response.end(mustache.render(fileCache['shell'], set, {content: fileCache['set']}));
  });
});

router._404 = (request, response, path) => {
  set = getCookieData(request);
  set = router.utils.extendObj(set, shoe.champ);
  response.writeHead(404, {'Content-type': 'text/html'});
  response.end(mustache.render(fileCache['shell'], set, {content: fileCache['404']}));
}

module.exports.router = router;
