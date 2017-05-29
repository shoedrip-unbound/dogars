let fs       = require('fs');
let tripcode = require('tripcode');
let poke     = require('./poke-utils');
let db       = require('./db.js');
let shoe     = require('./shoedrip.js');
let mustache = require('mustache');
let Router   = require('node-simple-router');
var mkdirp   = require('mkdirp');
let router   = Router();
let cp = require('child_process');

let files = fs.readdirSync('./templates').map(file => {
  return file.replace(/\.mustache$/g, '');
});

let fileCache = {};

let banners = fs.readdirSync('./public/ban');

files.forEach(f => {
  let file = 'templates/' + f + '.mustache';
  fileCache[f] = fs.readFileSync(file, 'utf8');
  fs.watch(file, {persistent: false, }, (event, name) => {
    if (event != 'change')
      return;
    console.log(file + ' changed');
    fileCache[f] = fs.readFileSync(file, 'utf8');
  });
});

fs.watch('./public/ban', {persistent: false}, (e, n) => {
  fs.readdir('./public/ban', (e, banfiles) => {
    banners = banfiles;
  });
})

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

let genericData = (request) => {
  let ret = router.utils.extendObj(shoe.champ, getCookieData(request));
  let rand_ban = banners[~~(Math.random() * banners.length)];
  ret = router.utils.extendObj(ret, {banner: '/ban/' + rand_ban});
  return ret;
}

router.get("/", (request, response) => {
  getSetOfTheDay(set => {
    set = router.utils.extendObj(set, genericData(request));
    response.writeHead(200, {'Content-type': 'text/html'});
    response.end(mustache.render(fileCache['shell'], set, {content: fileCache['index']}));
  });
});

router.get("/all", (request, response) => {
  db.getAllSets(sets => {
    sets = sets.map(e => { return poke.formatSetFromRow(e)});
    response.writeHead(200, {'Content-type': 'text/html'});
    let data = router.utils.extendObj({sets: sets}, genericData(request));
    response.end(mustache.render(fileCache['shell'], data, {content: fileCache['all']}));
  })
});

router.get("/import", (request, response) => {
  response.writeHead(200, {'Content-type': 'text/html'});
  let data = genericData(request);
  response.end(mustache.render(fileCache['shell'], data, {content: fileCache['import']}));    
});

router.get("/thanks", (request, response) => {
  response.writeHead(200, {'Refresh': '2; url=/', 'Content-type': 'text/html'});
  let data = genericData(request);
  response.end(mustache.render(fileCache['shell'], data, {content: fileCache['thanks']}));    
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
    let data = router.utils.extendObj({sets: sets}, genericData(request));
    response.writeHead(200, {'Content-type': 'text/html'});
    response.end(mustache.render(fileCache['shell'], data, {content: fileCache['all']}));    
  })
});

router.get("/suggest/:type", (request, response) => {
  let data = genericData(request);
  if (request.params.type == 'banner') {
    response.writeHead(200, {'Content-type': 'text/html'});
    response.end(mustache.render(fileCache['shell'], data, {content: fileCache['suggest-banner']}));
  }
  else if (/^\d+$/.test(request.params.type)) {
    db.getSetById(request.params.type, set => {
      if (!set)
      {
        response.writeHead(200, {'Refresh': '0; url=/'});
        response.end('');
        return;
      }
      set = poke.formatSetFromRow(set);
      set = router.utils.extendObj(set, data);
      response.writeHead(200, {'Content-type': 'text/html'});
      response.end(mustache.render(fileCache['shell'], set, {content: fileCache['suggest-set']}));
  });
  }
  else
    router._404(request, response, '/suggest/' + request.params.type);
});

router.post("/suggest", (request, response) => {

  let saveToDir = (dir) => {
    fs.access(dir, (err) => {
      if (err)
        mkdirp.sync(dir);
      fs.readdir(dir, (e, f) => {
        if (e)
          return console.log(e);
        console.log('readdir: ' + f);
        fs.writeFile(dir + '/' + f.length + '-' + request.post['multipart-data'][0].fileName,
                     request.post['multipart-data'][0].fileData,
                     {encoding: 'binary'},
                     () => {
                       console.log('Saved file content');
                     });
      });
    });
  }

  if (request.post['multipart-data'][1].fileData == 'banner') {
    saveToDir('./ban-submission');
    response.writeHead(200, {'Refresh': '0; url=/thanks'});
    response.end('');
  }
  else if (/^\d+$/.test(request.post['multipart-data'][1].fileData)) {
    saveToDir('./sets/' + request.post['multipart-data'][1].fileData);
    response.writeHead(200, {'Refresh': '0; url=/thanks'});
    response.end('');
  }
  else
    router._404(request, response, '/suggest/' + request.post.type);
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
    set = router.utils.extendObj(set, genericData(request));
    response.writeHead(200, {'Content-type': 'text/html'});
    response.end(mustache.render(fileCache['shell'], set, {content: fileCache['set']}));
  });
});

router._404 = (request, response, path) => {
  set = genericData(request);
  response.writeHead(404, {'Content-type': 'text/html'});
  response.end(mustache.render(fileCache['shell'], set, {content: fileCache['404']}));
}

module.exports.router = router;
