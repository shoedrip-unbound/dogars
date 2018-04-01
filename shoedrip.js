const request = require('request-promise-native');
let BattleMonitor = require('./BattleMonitor.js');
let db = require('./db.js');
let logger	 = require('./logger');

module.exports.champ = {};

let max = (a, b) => a < b ? b : a;

let getCurrentThread = async () => {
	let b = await request.get('http://a.4cdn.org/vp/catalog.json');
	let catalog = JSON.parse(b);
	let derp_no = 0;
	catalog.forEach(page => {
		page.threads.forEach(t => {
			if (t.sub && t.sub.toLowerCase().indexOf('showderp') != -1 && t.no > derp_no)
				derp_no = max(t.no, derp_no);
			if (t.com && t.com.toLowerCase().indexOf('dogars.ml') != -1 && t.no > derp_no)
				derp_no = max(t.no, derp_no);
		});
	});
	return derp_no;
}

let getCurrentChamp = async b => {
	let thread = JSON.parse(b);
	let derp_no = 0;
	for (let i = thread.posts.length - 1; i != 0; --i) {
		if (!thread.posts[i].trip)
			continue;
		let content = thread.posts[i].com.replace(/<(?:.|\n)*?>/gm, '');
		let matches;
		if ((matches = content.match(/(https?:\/\/)?play.pokemonshowdown.com\/battle-(.*)-([0-9]*)/g))) {
			let champ = {champ_name: thread.posts[i].name, champ_trip: thread.posts[i].trip, champ_last_active: thread.posts[i].time};
			let curtime = ~~(+new Date() / 1000);
			champ.champ_active = curtime - champ.champ_last_active < 15 * 60;
			/*
			  Dead hours
			 */
			champ.deaddrip = curtime - champ.champ_last_active < 120 * 60;
			champ.champ_battle = matches[0];
			if(champ.champ_battle[0] != 'h')
				champ.champ_battle = 'http://' + champ.champ_battle;
			return champ;
		}
	}
	return {};
}

let oldbattle = null;

// stolen from gist
// but leven(((shtein))) is actually garbage at detecting similar nicknames
let levenshtein = (a, b) => {
	let tmp;
	a = a || '';
	b = b || '';
	if (a.length === 0) { return b.length; }
	if (b.length === 0) { return a.length; }
	if (a.length > b.length) { tmp = a; a = b; b = tmp; }

	let i, j, res, alen = a.length, blen = b.length, row = Array(alen);
	for (i = 0; i <= alen; i++) { row[i] = i; }

	for (i = 1; i <= blen; i++) {
		res = i;
		for (j = 1; j <= alen; j++) {
			tmp = row[j - 1];
			row[j - 1] = res;
			res = b[i - 1] === a[j - 1] ? tmp : Math.min(tmp + 1, res + 1, row[j] + 1);
		}
	}
	return res;
}

let snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

let main = async () => {
	while (true) {
		try {
			let thread = await getCurrentThread();
			let threadjs = await request.get(`http://a.4cdn.org/vp/thread/${thread}.json`);
			let champ = await getCurrentChamp(threadjs);
			if (champ.champ_battle != oldbattle) {
				oldbattle = champ.champ_battle;
				if (champ.champ_name != undefined && champ.champ_name != '') {
					logger.log(0, `Champ has a name so we can monitor battle`);
					let bm = new BattleMonitor(champ);
					bm.monitor();
				} else {
					logger.log(0, `Champ has no name so we can't monitor battle`);
				}
			}
			if (champ.champ_active) {
				let dbchamp = await db.getChampFromTrip(champ.champ_trip);
				champ.avatar = '166';
				if (dbchamp && dbchamp.length) {
					champ.avatar = dbchamp[0].avatar;
				}
			}
			module.exports.champ = champ;
		}
		catch(e) {
			console.log('--------------------------------------------------------------------------------');
			console.log('An error occured while retriving some data.\nSome features might now work properly');
			console.log(e);
			console.log('--------------------------------------------------------------------------------');
		}
		await sneeze(1000 * 60);
	}
}

module.exports.start = main;
