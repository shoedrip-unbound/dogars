let fs         = require('fs');
let connection = require('./PSConnection.js');
let settings   = JSON.parse(fs.readFileSync('settings.json'));
let snooze     = ms => new Promise(resolve => setTimeout(resolve, ms));
let request    = require('request-promise-native');
let p          = require('util').promisify;
let BattleMonitor = require('./BattleMonitor.js');

let headers = {
	'accept':'*/*',
	'accept-language':'en-US,en;q=0.8,fr;q=0.6,ja;q=0.4,de;q=0.2',
	'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
	'dnt': '1',
	'origin': 'https://play.pokemonshowdown.com',
	'referer': 'https://play.pokemonshowdown.com/crossprotocol.html?v1.2',
	'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
	'x-requested-with': 'XMLHttpRequest'
}

let getchallstr = async (user, pass, challenge) => {
	let regged = pass !== undefined;
	let data = {};
	data.challstr = challenge;
	if (regged) {
		data.act = 'login';
		data.name = user;
		data.pass = pass;
	} else {
		data.act = 'getassertion';
		data.userid = user;		
	}
	let body = await request.post('http://play.pokemonshowdown.com/action.php', {
					 form: data
	});
	if (body[0] == ';')
		throw 'Issue with challenge';
	if (regged) {
		if (body[0] != ']')
			throw 'Issue with login1';
		body = body.substr(1);
		body = JSON.parse(body);
		if (body.assertion[0] == ';') {
			throw 'Issue with login2';
		}
		return body.assertion;
	}
	else if (body.length > 10)
		return body;
	throw 'Issue with login3';
}

class Player {
	constructor(user, pass) {
		let regged = pass !== undefined;
		this.con = connection.newConnection();
		this.con.on('challstr', async (data) => {
			try {
				this.challstr = data.substr(10);
				this.assertion = await getchallstr(user, pass, this.challstr);
				this.con.send("|/trn " + user + ",0," + this.assertion);
			} catch(e) {
				console.log(e);
			}
		});
		this.con.on('updatesearch', (data) => {
			console.log('updatesearch called');
			data = data.substr(14);
			let searches = JSON.parse(data);
			this.games = searches.games ? Object.keys(searches.games) : [];
			for (let r of this.games) {
				let proxy = {room: r};
				let format = r.substr(7);
				format = format.substr(0, format.indexOf('-'));
				if (this.search[format]) {
					let cb = this.search[format].shift();
					if (cb) {
						let c = {
							champ_battle: r,
							champ_name: this.user
						};
						console.log("https://play.pokemonshowdown.com/" + r);
						let monitor = new BattleMonitor(c, false);
						cb(null, monitor);
					}
				}
				let methods = ["request"];
				for (let m of methods) {
					proxy[m] = this[m].bind(this, r);
				}
				this.con.addBattleListener(proxy);
			}
			this.gamescb.forEach(cb => cb(null, this.games));
		});

		this.con.on('updateuser', (data) => {
			if (data.substr(12, user.length) == user) {
				this.logged = true;
				this.loggedcb.forEach(l => l(null));
				this.loggedcb = [];
			}
		});

		for(let prop of Object.getOwnPropertyNames(Player.prototype)) {
			if (prop[0] == '_') {
				Player.prototype[prop.substr(1)] = p(Player.prototype[prop]);
			}
		}

		this.user = user;
		this.search = {};
		this.gamescb = [];
		this.rooms = {};
		this.con.start();
		this.logged = false;
		this.loggedcb = [];
	}

	_finishInit(cb){
		if (this.logged) {
			cb(null);
		} else {
			this.loggedcb.push(cb);
		}
	}

	request(room, data) {
		let bra = data.indexOf('{');
		if (bra == -1)
			return;
		data = data.substr(bra);
		data = JSON.parse(data);
		this.rooms[room] = this.rooms[room] || {};
		this.rooms[room].team = data;
		if (this.rooms[room].teamcb) {
			while(this.rooms[room].teamcb.length) {
				let cb = this.rooms[room].teamcb.shift();
				cb(null, this.rooms[room].team.side);
			}
		}
	}

	onCurrentBattlesChanged(cb) {
		this.gamescb.push(cb);
	}

	message(room, str) {
		if (room != '')
			this.con.send("|/join " + room);
		this.con.send(room + '|' + str);
	}

	forfeit(battle) {
		this.message(battle, '/forfeit');
	}

	setTeam(team) {
		this.message('', '/utm ' + team);
	}

	_getBattle(format, cb) {
		this.search[format] = this.search[format] || [];
		this.search[format].push(cb);
	}

	_searchBattle(format, cb) {
		this.message('', '/search ' + format);
		this._getBattle(format, cb);
	}

	getMyTeam(battle, cb) {
		if (this.rooms[battle] && this.rooms[battle].team) {
			cb(null, this.rooms[battle].team.side);
		}
		else {
			this.rooms[battle] = this.rooms[battle] || {};
			this.rooms[battle] = { teamcb: this.rooms[battle].teamcb || [] };
			this.rooms[battle].teamcb.push(cb);
		}
		this.con.send("|/join " + battle);
	}

	disconnect() {
		this.con.close();
	}
}

module.exports = Player;