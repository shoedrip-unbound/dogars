let fs         = require('fs');
let connection = require('./PSConnection.js');
let settings = require('./settings');
let snooze     = ms => new Promise(resolve => setTimeout(resolve, ms));
let request    = require('request-promise-native');
let p          = require('util').promisify;
let BattleMonitor = require('./BattleMonitor.js');
let logger	 = require('./logger');

let suck = d => JSON.parse(d.substr(1))[0];

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
	if (body[0] == ';') {
		console.log(body);
		console.log(data);
		throw 'Issue with challenge';
	}
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

		this.user = user;
		this.pass = pass;
		this.search = {};
		this.gamescb = [];
		this.rooms = {};
		this.logged = false;
		this.loggedcb = [];
	}

	async connect() {
		logger.log(0, `Logging in as ${this.user}`);
		await this.con.start();

		this.challstr = this.con.challstrraw.substr('|challstr|'.length);
		this.assertion = await getchallstr(this.user, this.pass, this.challstr);
		this.con.send("|/trn " + this.user + ",0," + this.assertion);
		this.joined = [];
		this.games = [];
		this.teamCache = [];

		let updateSearch;
		do {
			updateSearch = suck(await this.con.read());
			if (updateSearch.indexOf('updatesearch') == -1)
				continue;
			updateSearch = updateSearch.substr(14);
			let searches = JSON.parse(updateSearch);
			if (!searches.games)
				continue;
			this.games = searches.games ? Object.keys(searches.games) : [];
		} while (this.games.length == 0);
	}

	async tryJoin(room) {
		if (room != '' && this.joined.indexOf(room) == -1) {
			await this.con.send("|/join " + room);
			this.joined.push(room);
		}
	}

	async message(room, str) {
		this.tryJoin(room);
		await this.con.send(room + '|' + str);
	}

	async forfeit(battle) {
		await this.message(battle, '/forfeit');
	}

	async setTeam(team) {
		await this.message('', '/utm ' + team);
	}

	async getMyTeam(battle) {
		await this.tryJoin(battle);
		if (this.teamCache && this.teamCache[battle])
			return this.teamCache[battle];
		while (1) {
			let event = await this.con.getNextBattleEvent(battle);
			if (event.name == 'request') {
				let teamData = JSON.parse(event.log[1]);
				this.teamCache[battle] = {pokemon: teamData.side.pokemon};
				return this.teamCache[battle];
			}
		}
	}

	getBattles() {
		return this.games;
	}

	async disconnect() {
		await this.con.close();
	}
}

module.exports = Player;
