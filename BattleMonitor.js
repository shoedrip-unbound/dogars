let db = require('./db.js');
let connection = require('./PSConnection.js');
let PlayerHijack = require('./PlayerHijack.js');
let p          = require('util').promisify;

// stolen from gist
let levenshtein = (a, b) => {
	var tmp;
	a = a || '';
	b = b || '';
	if (a.length === 0) { return b.length; }
	if (b.length === 0) { return a.length; }
	if (a.length > b.length) { tmp = a; a = b; b = tmp; }

	var i, j, res, alen = a.length, blen = b.length, row = Array(alen);
	for (i = 0; i <= alen; i++) { row[i] = i; }

	for (i = 1; i <= blen; i++) {
		res = i;
		for (j = 1; j <= alen; j++) {
			tmp = row[j - 1];
			row[j - 1] = res;
			res = b[i - 1] === a[j - 1] ? tmp : Math.min(tmp + 1,
														 Math.min(res + 1, row[j] + 1));
		}
	}
	return res;
}

class BattleMonitor {
	constructor(champ, reg) {
		this.con = connection;
		this.reg = reg === undefined ? true : reg;
		this.stopped = false;
		this.battleData = {};
		this.champ = champ;
		this.champ.avatar = '166';
		this.battleData.champ = champ;
		this.battleData.memes = [];
		this.battleData.dist = 100;
		this.battleData.roomid = champ.champ_battle.match(/battle-(.*)\/?/)[1];
		this.battlers = {};
		this.room = champ.champ_battle.match(/(battle-.*)\/?/)[0];

	}

	async monitor() {
		await this.con.send('|/join ' + this.room);
		while (!this.stopped) {
			let event = await this.con.getNextBattleEvent(this.room);
			if (this[event.name])
				await this[event.name](event.data, event.log);
		}
	}

	l(data, log) {
		if (this.battleData.finished)
			return;
		let oppo_name;
		let oppo_alias;
		oppo_alias = (this.battlers.p1.showdown_name == this.battleData.champ.showdown_name) ? 'p2' : 'p1';
		if (this.battlers[oppo_alias].jacked)
			return;
		oppo_name = this.battlers[oppo_alias].showdown_name;
		if (log[1].indexOf(oppo_name) == 0 || log[1].indexOf(oppo_name) == 1) {
			if (this.attemptedJack)
				return;
			this.attemptedJack = true;
			console.log(this.battlers[oppo_alias])
			let hj = new PlayerHijack(this.battleData, this.battlers);
			hj.tryJack(false);
		}
	}

	win(data, log) {
		this.battleData.memes = this.battlers[this.battleData.champ_alias].team;
		if(this.reg)
			db.registerChampResult(this.battleData, this.battleData.champ.showdown_name == log[1]);
		this.stopped = true;
	}

	player(data, log) {
		if (log[2] == '')
			return;
		this.battlers[log[1]] = {};
		this.battlers[log[1]].showdown_name = log[2];
		this.battlers[log[1]].avatar = log[3];
		this.battlers[log[1]].team = [];
		let dist = levenshtein(this.battleData.champ.champ_name || '', log[2]);
		if (dist < this.battleData.dist) {
			this.battleData.champ.showdown_name = log[2];
			this.battleData.champ.avatar = log[3];
			this.battleData.champ_alias = log[1];
			this.battleData.dist = dist;
		}
	}

	"switch"(data, log) {
		if (this.battleData.dist >= 3) {
			let name = log[1].split(': ')[1].trim();
			let forme = log[2].split(',')[0].split('-')[0].trim();
			if (forme != name) {
				this.battleData.dist = 0;
				this.battleData.champ_alias = log[1].split(': ')[0].substr(0, 2);
				this.battleData.champ.showdown_name = this.battlers[this.battleData.champ_alias].showdown_name;
				this.battleData.champ.avatar = this.battlers[this.battleData.champ_alias].avatar;
			}
		}
		if (log[1].indexOf(this.battleData.champ_alias) == 0) {
			let memename = log[1].substr(5);
			this.battleData.activeMeme = memename;
			let exists = this.battlers[this.battleData.champ_alias].team.some(mon => mon.name == memename);
			if(!exists)
				this.battlers[this.battleData.champ_alias].team.push({name: memename, kills: 0, dead: false})
		}
	}

	faint(data, log) {
		if (log[1].indexOf(this.battleData.champ_alias) == 0) {
			let memename = log[1].substr(5);
			for(var i = 0; i < this.battlers[this.battleData.champ_alias].team.length; ++i)
				if (this.battlers[this.battleData.champ_alias].team[i].name == memename)
					this.battlers[this.battleData.champ_alias].team[i].dead = true;
		} else {
			for(var i = 0; i < this.battlers[this.battleData.champ_alias].team.length; ++i)
				if (this.battlers[this.battleData.champ_alias].team[i].name == this.battleData.activeMeme)
					this.battlers[this.battleData.champ_alias].team[i].kills++;
		}
	}
}

module.exports = BattleMonitor;
