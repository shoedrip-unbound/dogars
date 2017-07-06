/* global require console */

let fs         = require('fs');
let cp         = require('child_process');
let tripcode   = require('tripcode');
let mustache   = require('mustache');
let mkdirp     = require('mkdirp');
let mv         = require('mv');
let poke       = require('./poke-utils');
let db         = require('./db.js');
let shoe       = require('./shoedrip.js');
let notes      = require('./git-notes.js');
let emotionmap = require('./emotions.js');
let settings   = JSON.parse(fs.readFileSync('settings.json'));

let cookieParser	= require('cookie-parser');
let bodyParser		= require('body-parser');
let multer			= require('multer');
let express			= require('express');
let upload          = multer({dest: '/tmp'});
let router			= express();
let compression     = require('compression');
let apiai           = require('apiai');
let bot             = apiai(settings.botkey);

router.set('env', 'production');
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(cookieParser());
router.use(compression());

let files = fs.readdirSync('./templates')
	.filter(file => /\.mustache$/g.test(file))
	.map(file => file.replace(/\.mustache$/g, ''));

let fileCache = {};

let banners = fs.readdirSync('./public/ban');

files.forEach(f => {
	let file = 'templates/' + f + '.mustache';
	fileCache[f] = fs.readFileSync(file, 'utf8');
	fs.watch(file, {persistent: false }, (event, name) => {
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

let render = (view, data) => {
	let subs = extend(fileCache, {content: fileCache[view]});
	return mustache.render(fileCache['shell'], data, subs);
}

let sendTemplate = (req, res, n, data) => {
	data = data || {};
	res.set({'Content-type': 'text/html'});
	data = extend(data, genericData(req, res));
	res.send(render(n, data));
	res.end();
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

let getSetOfTheDay = async cb => {
	let today = new Date();
	let seed = today.getDate() * (today.getMonth() + 1) * (today.getYear() + 1900);
	seed = seed % db.total;
	// >set of the "day"
	// >changes everytime you add or delete a set
	let set;
	// hack
	while (!set) {
		set = db.getSetById('' + seed);
		set = await set;
		seed = seed + 1 % db.total;
	}
	return poke.formatSetFromRow(set[0]);
}

let getCookieData = (request, response) => {
	let default_cookie = {
		dark: 'false',
		style_suffix: '',
		waifu: '/lillie2.png',
		talked: false,
		talkSession: '' + (~~(Math.random() * 10000000))
	};
	if (!request.headers.cookie) {
		console.log('GENERATING NEW COOKIES');
		for (let i in default_cookie)
			response.cookie(i, default_cookie[i]);
		return default_cookie;
	}
	let cook = cookie2obj(request.headers.cookie);
	cook = extend(default_cookie, cook);
	let ret = {
		dark: cook.dark,
		style_suffix: cook.dark == 'true' ? '2' : '',
		waifu: cook.dark == 'true' ? '/moon.png' : '/lillie2.png',
		talked: cook.talked,
		talkSession: cook.talkSession
	};
	for (let i in ret)
		response.cookie(i, ret[i]);
	return ret;
}

let genericData = (request, response) => {
	let ret = extend(shoe.champ, getCookieData(request, response));
	let rand_ban = banners[~~(Math.random() * banners.length)];
	ret = extend(ret, {banner: '/ban/' + rand_ban});
	return ret;
}

router.use(express.static('./public'));

router.get("/", async (request, response) => {
	try {
		let set = await getSetOfTheDay();
		sendTemplate(request, response, 'index', set);
	}
	catch(e) {
		console.log(e);
	}
});

router.get("/all", async (request, response) => {
	let spp = 15; //request.query.spp || 10;
	let npages = ~~(db.total / spp) + (db.total % spp != 0);
	let page = request.query.page || 0;
	page = ~~page;
	let sets = await db.getSetsPage(spp, page);
	sets = sets.map(poke.formatSetFromRow);
	let data = {sets: sets};
	data = extend(data, {display_pages: true, current_page: ~~page + 1, npages: npages, lastpage: npages - 1});
	if (page > 0) {
		data.prev = ~~page - 1;
		data.has_prev = true;
	}
	if (page + 1 < npages)
		data.next = ~~page + 1;
	sendTemplate(request, response, 'all', data);
});

router.get("/import", (request, response) => {
	sendTemplate(request, response, 'import');
});

router.get("/thanks", (request, response) => {
	response.set({'Refresh': '2; url=/'});
	sendTemplate(request, response, 'thanks');
});

router.post("/update/:id", async (request, response, next) => {
	try {
		if (request.body.action == "Update")
			await db.updateSet(request);
		else if (request.body.action == "Delete")
			await db.deleteSet(request);
		response.set({'Refresh': '0; url=/set/' + request.params.id});
		response.end();    
	}
	catch(e) {
		e = e.replace(/\|\|/g, '\n');
		e = e.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');
		response.set({'Refresh': '10; url=/import'});
		sendTemplate(request, response, 'reject', { reason: e });
	}
});

router.post("/add", async (request, response) => {
	try {
		let info = await db.createNewSet(request);
		response.set({'Refresh': '0; url=/set/' + info.insertId});
		response.end();
	}
	catch(e) {
		e = e.replace(/\|\|/g, '\n');
		e = e.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');
		response.set({'Refresh': '10; url=/import'});
		sendTemplate(request, response, 'reject', { reason: e });
	}
});

router.post("/trip", (request, response) => {
	console.log(request.body);
	response.send(tripcode(request.body.v));
	response.end();
});

router.get("/random", (request, response) => {
	let randid = Math.random() * db.total;
	randid = ~~randid;
	response.set({'Refresh': '0; url=/set/' + randid});
	response.end();
});

router.post("/search", async (request, response) => {
	try {
		Object.keys(request.body)
			.filter(attr => request.body[attr] === '')
			.forEach(attr => { delete request.body[attr]});
		if(request.body.q) {
			let sets = await db.getSetsByName(request.body.q)
			sets = sets.map(poke.formatSetFromRow);
			sendTemplate(request, response, 'all', {sets: sets});
		}
		else { // Advanced search
			let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
						'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
						'move_1', 'move_2', 'move_3', 'move_4', 'hp_ev', 'atk_ev', 'def_ev',
						'spa_ev', 'spd_ev', 'spe_ev', 'hp_iv', 'atk_iv', 'def_iv', 'spa_iv',
						'spd_iv', 'spe_iv', 'description'];
			Object.keys(request.body)
				.filter(v => !data.includes(v))
				.forEach(attr => { delete request.body[attr]});
			if (request.body == {}) {
				sendTemplate(request, response, 'all', {sets: []});
			} else {
				let sets = await db.getSetsByProperty(request.body);
				sets = sets.map(e => { return poke.formatSetFromRow(e)});
				sendTemplate(request, response, 'all', {sets: sets});			
			}
		}
	} catch(e) {
		console.log(e);
	}
});

router.get("/search", async (request, response) => {
	if(request.query.q) {
		let sets = await db.getSetsByName(request.body.q);
		sets = sets.map(poke.formatSetFromRow);
		sendTemplate(request, response, 'all', {sets: sets});
	}
	else {
		sendTemplate(request, response, 'search', {});
	}
});

router.get("/replays", async (request, response) => {
	let prefix = 'am';
	let data = {};
	for (let v of [1, 0]) {
		let replays = await db.getReplays(v);
		let memes = [];
		for(var i = 0; i < replays.length; ++i)
			memes.push(await db.memesInReplay(replays[i].id));
		replays = replays.map((r, i) => extend(r, {memes: memes[i].map(poke.formatSetFromRow)}));
		data[prefix[v] + 'replays'] = replays;
	}
	if (request.query.fail)
		data['error'] = true;
	sendTemplate(request, response, 'replays', data);
});

router.get("/replays/add/:id", (request, response) => {
	data = { id: request.params.id };
	sendTemplate(request, response, 'addrset', data);
});

router.post("/replays/add/:id", async (request, response) => {
	let id = request.body.set.match(/http:\/\/dogars\.ml\/set\/([0-9]+)/)[1];
	if (!id) {
		response.set({'Refresh': '5; url=/replays'});
		sendTemplate(request, response, 'genreject', { reason: 'Your submission was rejected because the URL was wrong'});
		return;
	}
	await db.addSetToReplay(id, request.params.id);

	response.set({'Content-type': 'text/html'});
	response.set({'Refresh': '0; url=/replays'});
	response.end();
});

router.post("/replays", async (request, response) => {
	if(/https?:\/\/replay.pokemonshowdown.com\/(.*)-[0-9]*/.test(request.body.link)) {
		await db.addReplay(extend(request.body, {manual: true}));
		response.set({'Refresh': '0; url=/replays'});
	}
	else {
		response.set({'Refresh': '0; url=/replays?fail=true'});
	}
	response.end();
});

router.get("/fame", async (request, response) => {
	let sets = await db.getSetsByProperty({has_custom: 1})
	sets = sets.map(e => { return poke.formatSetFromRow(e)});
	sendTemplate(request, response, 'fame', {sets: sets});
});

router.post("/lillie", async (request, response) => {
	try{
		//hack
		request.headers.cookie = request.body.cook;
		let data = getCookieData(request, response);
		if (!data.talkSession || !request.body.message) {
			response.send(JSON.stringify({}));
			response.end();
			return;
		}
		let req = bot.textRequest(request.body.message, {
			sessionId: data.talkSession
		});
		req.on('response', r => {
			let output = extend(r.result, {
				emotion: emotionmap[r.result.action] || ''
			});
			console.log(data.talkSession + ': ' + request.body.message);
			response.send(JSON.stringify(output));
			response.end();
		});
		req.on('error', r => {
			console.log('ERROR;');
			console.log(r);
			response.send(JSON.stringify({}));
			response.end();
		});
		req.end();
		console.log('request sent;');
	}catch(e){
		console.log(e);
	}

});

router.get("/champs", async (request, response) => {
	let champs = await db.getChamps();
	let data = {champs: champs};
	sendTemplate(request, response, 'champs', data);
});

router.get("/suggest/:type", async (request, response) => {
	let data = {};
	if (request.params.type == 'banner') {
		sendTemplate(request, response, 'suggest-banner');
	}
	else if (/^\d+$/.test(request.params.type)) {
		let set = await db.getSetById(request.params.type);
		set = set[0];
		if (!set) {
			response.set({'Refresh': '0; url=/'});
			response.end();
			return;
		}
		set = poke.formatSetFromRow(set);
		sendTemplate(request, response, 'suggest-set', set);
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
					throw e;
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

router.get("/set/:id", async (request, response) => {
	let set = await db.getSetById(request.params.id);
	set = set[0];
	if (!set) {
		response.set({'Refresh': '0; url=/'});
		response.end();
		return;
	}
	set = poke.formatSetFromRow(set);
	sendTemplate(request, response, 'set', set);
});

let mynotes = false;

router.get("/changelog", async (request, response) => {
	try {
		if (!mynotes) {
			mynotes = await notes.get(); // [{commit:, msg:}, ...]
			mynotes = mynotes.filter(item => item.type)
				.map(item => extend(item, {type: item.type.indexOf('bug') == 0 ? 'bug' : 'plus-square', commit: item.commit.substr(0, 6)}));
		}
		sendTemplate(request, response, 'changelog', { notes: mynotes });
	}
	catch(e) {
		console.log(e);
	}
});

router.use(function(request, response) {
	response.send(render('404', genericData(request, response)));
	response.end();
});

router.use(function(error, request, response, next) {
	console.log(error);
	response.send(render('500', genericData(request, response)));
	response.end();
});

module.exports = router;
