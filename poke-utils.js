let fs       = require('fs');
let mustache = require('mustache');
let request  = require('request');
const WebSocket = require('ws');

let clamp = (min, val, max) => {
	if (val < min)
		return min;
	if (val > max)
		return max;
	return val;
}

// Shamelessly stolen and adapted from showdown-client
var BattleStatIDs = {
	HP: 'hp',
	hp: 'hp',
	Atk: 'atk',
	atk: 'atk',
	Def: 'def',
	def: 'def',
	SpA: 'spa',
	SAtk: 'spa',
	SpAtk: 'spa',
	spa: 'spa',
	SpD: 'spd',
	SDef: 'spd',
	SpDef: 'spd',
	spd: 'spd',
	Spe: 'spe',
	Spd: 'spe',
	spe: 'spe'
};

module.exports.formatSetFromRow = (set) => {
	let rich = set;
	let date = new Date(parseInt(set.date_added));
	rich.date = date.toLocaleDateString();
	rich.s = rich.species_ = rich.species.toLowerCase();
	rich.species_ = rich.species_.replace(/ /g, "");

	rich.species_ = rich.species_.replace(/:/g, "");
	rich.species_ = rich.species_.replace(/\./g, "");
	rich.species_ = rich.species_.replace(/'/g, "");
	rich.species_ = rich.species_.replace(/mega-x/g, "megax");
	rich.species_ = rich.species_.replace(/mega-y/g, "megay");

	// I fucking give up
	rich.species_ = rich.species_.replace(/kommo-o/g, "kommoo");
	rich.species_ = rich.species_.replace(/pom-pom/g, "pompom");

	rich.set_form = '';
	if (rich.name)
		rich.set_form += rich.name + ' (' + rich.species + ')';
	else
		rich.set_form += rich.species;
	if (rich.gender != '')
		rich.set_form += ' (' + rich.gender + ')';
	if (rich.item != '')
		rich.set_form += ' @ ' + rich.item;
	rich.set_form += '\nAbility: ' + rich.ability + '\n';
	if (rich.level && rich.level != '100')
		rich.set_form += 'Level: ' + rich.level + '\n';
	if (rich.shiny && rich.shiny != '0') {
		rich.set_form += 'Shiny: Yes\n';
		rich.s = true;
	}
	else
		rich.s = false;

	rich.description_html = mustache.render('{{d}}', {d: rich.description});
	rich.description_html = (rich.description_html + '').replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');

	const exts = ['png', 'jpg', 'gif'];
	exts.forEach(e => {
		if (fs.existsSync('./public/sets/' + rich.id + '.' + e)) {
			rich.img_url = '/sets/' + rich.id + '.' + e;
			rich.cust = true;
		}
	});
	rich.img_url = rich.img_url || mustache.render('http://play.pokemonshowdown.com/sprites/xyani{{#s}}-shiny{{/s}}/{{species_}}.gif', rich);
	if (rich.happiness && parseInt(rich.happiness) < '255')
		rich.set_form += 'Happiness: ' + rich.happiness + '\n';
	let stats = ['HP', 'Atk', 'Def', 'SpA', 'SpD', 'Spe'];
	let evstr = '';
	let ivstr = '';
	for(var i in stats) {
		let st = stats[i].toLowerCase();
		if (rich[st + '_ev'] != 0) {
			if (evstr.length > 0)
				evstr += ' / ';
			evstr += rich[st + '_ev'] + ' ' + stats[i];
		}
		if (rich[st + '_iv'] != 31) {
			if (ivstr.length > 0)
				ivstr += ' / ';
			ivstr += rich[st + '_iv'] + ' ' + stats[i];
		}
	}
	if(evstr != '')
		rich.set_form += 'EVs: ' + evstr + '\n';
	var neutral = ['Serious', 'Bashful', 'Docile', 'Hardy', 'Quirky'];
	var nature = false;
	for(var i in neutral)
		if (neutral[i].toLowerCase() == rich.nature)
			nature = true;
	if (rich.nature && !nature)
		rich.set_form += rich.nature + ' Nature\n';
	if(ivstr != '')
		rich.set_form += 'IVs: ' + ivstr + '\n';
	[1, 2, 3, 4].forEach(e => {
		if (rich['move_' + e])
			rich.set_form += '- ' + rich['move_' + e] + '\n';
	});
	return rich;  
}

module.exports.parseSet = (text) => {
	text = text.split("\n");
	var team = [];
	var curSet = null;
	for (var i = 0; i < text.length; i++) {
		var line = text[i].trim();
		if (!curSet) {
			curSet = {name: '', species: '', gender: ''};
			curSet.hp_iv = curSet.atk_iv = curSet.def_iv = curSet.spa_iv = curSet.spd_iv = curSet.spe_iv = 31;
			curSet.hp_ev = curSet.atk_ev = curSet.def_ev = curSet.spa_ev = curSet.spd_ev = curSet.spe_ev = 0;

			team.push(curSet);
			var atIndex = line.lastIndexOf(' @ ');
			if (atIndex !== -1) {
				curSet.item = line.substr(atIndex + 3);
				line = line.substr(0, atIndex);
			}
			if (line.substr(line.length - 4) === ' (M)') {
				curSet.gender = 'M';
				line = line.substr(0, line.length - 4);
			}
			if (line.substr(line.length - 4) === ' (F)') {
				curSet.gender = 'F';
				line = line.substr(0, line.length - 4);
			}
			var parenIndex = line.lastIndexOf(' (');
			if (line.substr(line.length - 1) === ')' && parenIndex !== -1) {
				line = line.substr(0, line.length - 1);
				curSet.species = line.substr(parenIndex + 2);
				line = line.substr(0, parenIndex);
				curSet.name = line;
			} else {
				curSet.species = line.trim();
				curSet.name = '';
			}
		} else if (line.substr(0, 9) === 'Ability: ') {
			line = line.substr(9);
			curSet.ability = line.substr(0, 20);
		} else if (line === 'Shiny: Yes') {
			curSet.shiny = true;
		} else if (line.substr(0, 7) === 'Level: ') {
			line = line.substr(7);
			curSet.level = clamp(1, +line, 100);
		} else if (line.substr(0, 11) === 'Happiness: ') {
			line = line.substr(11);
			curSet.happiness = clamp(0, +line, 256);
		} else if (line.substr(0, 5) === 'EVs: ') {
			line = line.substr(5);
			var evLines = line.split('/');

			curSet.hp_ev = curSet.atk_ev = curSet.def_ev = curSet.spa_ev = curSet.spd_ev = curSet.spe_ev = 0;

			for (var j = 0; j < evLines.length; j++) {
				var evLine = evLines[j].trim();
				var spaceIndex = evLine.indexOf(' ');
				if (spaceIndex === -1) continue;
				var statid = BattleStatIDs[evLine.substr(spaceIndex + 1)];
				var statval = parseInt(evLine.substr(0, spaceIndex), 10);
				if (!statid) continue;
				curSet[statid + '_ev'] = clamp(0, statval, 252);
			}
		} else if (line.substr(0, 5) === 'IVs: ') {
			line = line.substr(5);
			var ivLines = line.split(' / ');
			curSet.hp_iv = curSet.atk_iv = curSet.def_iv = curSet.spa_iv = curSet.spd_iv = curSet.spe_iv = 31;
			for (var j = 0; j < ivLines.length; j++) {
				var ivLine = ivLines[j];
				var spaceIndex = ivLine.indexOf(' ');
				if (spaceIndex === -1) continue;
				var statid = BattleStatIDs[ivLine.substr(spaceIndex + 1)];
				var statval = parseInt(ivLine.substr(0, spaceIndex), 10);
				if (!statid) continue;
				if (isNaN(statval)) statval = 31;
				curSet[statid + '_iv'] = clamp(0, statval, 31);
			}
		} else if (line.match(/^[A-Za-z]+ (N|n)ature/)) {
			var natureIndex = line.indexOf(' Nature');
			if (natureIndex === -1) natureIndex = line.indexOf(' nature');
			if (natureIndex === -1) continue;
			line = line.substr(0, natureIndex);
			if (line !== 'undefined') curSet.nature = line.substr(0, 15);
		} else if (line.substr(0, 1) === '-' || line.substr(0, 1) === '~') {
			line = line.substr(1);
			if (line.substr(0, 1) === ' ') line = line.substr(1);
			if (!curSet.moves) curSet.moves = [];
			curSet.moves.push(line);
		}
	}
	curSet.move_1 = curSet.moves[0];
	curSet.move_2 = curSet.moves[1];
	curSet.move_3 = curSet.moves[2];
	curSet.move_4 = curSet.moves[3];
	curSet.name = curSet.name.substr(0, 30);
	curSet.species = curSet.species.substr(0, 30);
	delete curSet.moves;
	return curSet;
}

let headers = {
	'accept':'*/*',
	'accept-encoding':'gzip, deflate, br',
	'accept-language':'en-US,en;q=0.8,fr;q=0.6,ja;q=0.4,de;q=0.2',
	'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
	'dnt': '1',
	'origin': 'https://play.pokemonshowdown.com',
	'referer': 'https://play.pokemonshowdown.com/crossprotocol.html?v1.2',
	'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
	'x-requested-with': 'XMLHttpRequest'
}

let replayq = 'a["|queryresponse|savereplay|';

let saveReplay = (url, cb) => {
	let ws = new WebSocket('wss://sim2.psim.us/showdown/926/3jbvr0y1/websocket');
	
	let room = url.match(/(battle-.*)\/?/)[0];
	let roomid = url.match(/battle-(.*)\/?/)[1];

	ws.on('open', () => {
		ws.send(JSON.stringify("|/join " + room));
		ws.send(JSON.stringify(room + "|/savereplay"));
	});

	ws.on('message', (data) => {
		if (data == 'o')
			return;
		if (data.indexOf(replayq) != 0)
			return;
		let str = JSON.parse(data.substr(1))[0];
		str = str.substr(replayq.length - 3);
		let form = JSON.parse(str);
		request.post('http://play.pokemonshowdown.com/~~showdown/action.php?act=uploadreplay',
					 {
						 headers: headers,
						 form: form
					 }
					 , (e, b) => {
						 if (e)
							 console.log(e);
						 ws.close();
						 cb();
					 });

	});
}

module.exports.saveReplay = (url, cb) => {
	setTimeout(() => saveReplay(url, cb), 0);
}
