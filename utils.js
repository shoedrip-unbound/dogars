let fs         = require('fs');
let mustache   = require('mustache');
let db         = require('./db.js');
let shoe       = require('./shoedrip.js');
let poke       = require('./poke-utils');


let banners = fs.readdirSync('./public/ban');

let fileCache = {};
let files = fs.readdirSync('./templates')
	.filter(file => /\.mustache$/g.test(file))
	.map(file => file.replace(/\.mustache$/g, ''));
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

let pfileCache = {};
let pfiles = fs.readdirSync('./templates/m')
	.filter(file => /\.mustache$/g.test(file))
	.map(file => file.replace(/\.mustache$/g, ''));
pfiles.forEach(f => {
	let file = 'templates/m/' + f + '.mustache';
	pfileCache[f] = fs.readFileSync(file, 'utf8');
	console.log('watching', file);
	fs.watch(file, {persistent: false }, (event, name) => {
		if (event != 'change')
			return;
		console.log(file + ' changed');
		pfileCache[f] = fs.readFileSync(file, 'utf8');
	});
});

fs.watch('./public/ban', {persistent: false}, (e, n) => {
	fs.readdir('./public/ban', (e, banfiles) => {
		banners = banfiles;
	});
})

const reg = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
const reg2 = /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i;

let isMobile = ua => {
	ua = ua.toLowerCase();
	let ret = reg.test(ua) || reg2.test(ua.substr(0, 4));
	return ret;
};

let extend = (d, s) => {
	let ret = d;
	for(var i in s)
		d[i] = s[i];
	return d;
}

let render = (view, data) => {
	let cache = data.phone ? pfileCache : fileCache;
	let subs = extend(fileCache, {content: cache[view]});
	return mustache.render(cache['shell'], data, subs);
}

let sendTemplate = (req, res, n, data) => {
	data = data || {};
	data.phone = false; //isMobile(req.get('User-Agent'));
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
	let set = await db.getSetByNo(seed);
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
	ret = extend(ret, {
		banner: '/ban/' + rand_ban,
		phone: false//isMobile(request.get('User-Agent'))
	});
	return ret;
}

module.exports.genericData = genericData;
module.exports.getCookieData = getCookieData;
module.exports.getSetOfTheDay =getSetOfTheDay;
module.exports.cookie2obj = cookie2obj;
module.exports.sendTemplate = sendTemplate;
module.exports.render = render;
module.exports.extend = extend;

module.exports.banners = banners;
module.exports.fileCache = fileCache;
module.exports.pfileCache = pfileCache;
