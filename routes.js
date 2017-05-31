let fs       = require('fs');
let tripcode = require('tripcode');
let poke     = require('./poke-utils');
let db       = require('./db.js');
let shoe     = require('./shoedrip.js');
let mustache = require('mustache');
//let Router   = require('node-simple-router');
//let router   = Router();
let mkdirp   = require('mkdirp');
let mv       = require('mv');
let cp       = require('child_process');

let cookieParser	= require('cookie-parser')
let bodyParser		= require('body-parser');
let multer			= require('multer');
let express			= require('express');
let upload = multer({dest: '/tmp'});
let router			= express();
let compression     = require('compression');


router.set('env', 'production');
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(cookieParser());
router.use(compression());

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

let extend = (d, s) => {
	let ret = d;
	for(var i in s)
		d[i] = s[i];
	return d;
}

let cookie2obj = (str) => {
	let cook = str.split(';').map(e => e.trim());
	let ret = {};
	cook.forEach(e => {
		let spl = e.split('=').map(kv => kv.trim());
		ret[spl[0]] = spl[1];
	});
	return ret;
}

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
	let cook = cookie2obj(request.headers.cookie);
	return {
		dark: cook.dark,
		style_suffix: cook.dark == 'true' ? '2' : '',
		waifu: cook.dark == 'true' ? '/moon.png' : '/lillie2.png'
	};
}

let genericData = (request) => {
	let ret = extend(shoe.champ, getCookieData(request));
	let rand_ban = banners[~~(Math.random() * banners.length)];
	ret = extend(ret, {banner: '/ban/' + rand_ban});
	return ret;
}

router.use(express.static('./public'));

router.get("/", (request, response) => {
	getSetOfTheDay(set => {
		set = extend(set, genericData(request));
		response.set({'Content-type': 'text/html'});
		response.send(mustache.render(fileCache['shell'], set, {content: fileCache['index']}));
		response.end();
	});
});

router.get("/all", (request, response) => {
	db.getAllSets(sets => {
		sets = sets.map(e => { return poke.formatSetFromRow(e)});
		response.set({'Content-type': 'text/html'});
		let data = extend({sets: sets}, genericData(request));
		response.send(mustache.render(fileCache['shell'], data, {content: fileCache['all']}));
		response.end();
	})
});

router.get("/import", (request, response) => {
    response.set({'Content-type': 'text/html'});
	let data = genericData(request);
	response.send(mustache.render(fileCache['shell'], data, {content: fileCache['import']}));    
	response.end();
});

router.get("/thanks", (request, response) => {
    response.set({'Refresh': '2; url=/', 'Content-type': 'text/html'});
	let data = genericData(request);
	response.send(mustache.render(fileCache['shell'], data, {content: fileCache['thanks']}));    
	response.end();
});

router.post("/update/:id", (request, response, next) => {
	let handleErrorGen = e => {
		if(e) {
			response.set({'Refresh': '2; url=/'});
			response.send('You fucked up something. Back to the homepage in 2, 1...');
			response.end();
			return;
		}
		response.set({'Refresh': '0; url=/set/' + request.params.id});
		response.end();    
	};

	if (request.body.action == "Update")
		db.updateSet(request, handleErrorGen);
	else if (request.body.action == "Delete")
		db.deleteSet(request, handleErrorGen);
	else
		handleErrorGen(true);
});

router.post("/add", (request, response) => {
	try {
		db.createNewSet(request, (e, info) => {
			if(e) {
				response.set({'Refresh': '2; url=/'});
				response.send('You fucked up something. Back to the homepage in 2, 1...');
				response.end();
				return;
			}
			response.set({'Refresh': '0; url=/set/' + info.insertId});
			response.end();
		});
	}
	catch(e) {
		console.log(e);
		response.set({'Refresh': '2; url=/'});
		response.send('You fucked up something. Back to the homepage in 2, 1...');
		response.end();
	}
});

router.get("/favicon.ico", (request, response) => {
	response.sendFile('favicon.ico');
	response.end();
});

router.get("/random", (request, response) => {
	let randid = Math.random() * db.total;
	randid = ~~randid;
	response.set({'Refresh': '0; url=/set/' + randid});
	response.end();
});

router.get("/search", (request, response) => {
	db.getSetsByName(request.query.q, sets => {
		sets = sets.map(e => { return poke.formatSetFromRow(e)});
		let data = extend({sets: sets}, genericData(request));
		response.set({'Content-type': 'text/html'});
		response.send(mustache.render(fileCache['shell'], data, {content: fileCache['all']}));    
		response.end();
	})
});

router.get("/suggest/:type", (request, response) => {
	let data = genericData(request);
	if (request.params.type == 'banner') {
		response.set({'Content-type': 'text/html'});
		response.send(mustache.render(fileCache['shell'], data, {content: fileCache['suggest-banner']}));
		response.end();
	}
	else if (/^\d+$/.test(request.params.type)) {
		db.getSetById(request.params.type, set => {
			if (!set)
			{
				response.set({'Refresh': '0; url=/'});
				response.end();
				return;
			}
			set = poke.formatSetFromRow(set);
			set = extend(set, data);
			response.set({'Content-type': 'text/html'});
			response.send(mustache.render(fileCache['shell'], set, {content: fileCache['suggest-set']}));
			response.end();
		});
	}
	else
		router._404(request, response, '/suggest/' + request.params.type);
});

router.post("/suggest", upload.single('sugg'), (request, response, next) => {
	if (!request.file)
		return next();
	let saveToDir = (dir) => {
		fs.access(dir, (err) => {
			if (err)
				mkdirp.sync(dir);
			fs.readdir(dir, (e, f) => {
				if (e)
					return console.log(e);
				mv(request.file.path, dir + '/' + f.length + '-' + request.file.originalname, {mkdirp: true});
			});
		});
	}

	if (request.body.type == 'banner') {
		saveToDir('./ban-submission');
		response.set({'Refresh': '0; url=/thanks'});
		response.end();
	}
	else if (/^\d+$/.test(request.body.type)) {
		saveToDir('./sets/' + request.body.type);
		response.set({'Refresh': '0; url=/thanks'});
		response.end();
	}
	else
		router._404(request, response, '/suggest/' + request.params.type);
});

router.get("/set/:id", (request, response) => {
	db.getSetById(request.params.id, set => {
		if (!set)
		{
			response.set({'Refresh': '0; url=/'});
			response.end();
			return;
		}
		set = poke.formatSetFromRow(set);
		set = extend(set, genericData(request));
		response.set({'Content-type': 'text/html'});
		response.send(mustache.render(fileCache['shell'], set, {content: fileCache['set']}));
		response.end();
	});
});

router._404 = (request, response, path) => {
	set = genericData(request);
	response.status(404);
	response.set(404, {'Content-type': 'text/html'});
	response.send(mustache.render(fileCache['shell'], set, {content: fileCache['404']}));
	response.end();
}

router.use(function(request, response) {
	response.send(mustache.render(fileCache['shell'], genericData(request), {content: fileCache['404']}));
});

router.use(function(error, request, response, next) {
	response.send(mustache.render(fileCache['shell'], genericData(request), {content: fileCache['500']}));
});

module.exports = router;
