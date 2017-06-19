let db = require('./db.js');
let connection = require('./PSConnection.js');

class BattleMonitor {
	constructor(champ) {
		this.battleData = {};
		this.champ = champ;
		this.champ.avatar = '166';
		this.battleData.champ = champ;
		this.battleData.memes = [];
		this.battleData.dist = 100;
		this.battleData.roomid = champ.champ_battle.match(/battle-(.*)\/?/)[1];
		this.battlers = {};

		this.room = champ.champ_battle.match(/(battle-.*)\/?/)[0];
		connection.addBattleListener(this);
		connection.send('|/join ' + this.room);
		console.log('joining ' + this.room);
	}

	win(data, log) {
		this.battleData.memes = this.battlers[this.battleData.champ_alias].team;
		db.registerChampResult(this.battleData, this.battleData.champ.showdown_name == log[1]);

		connection.removeBattleListener(this);
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

	switchf(data, log) {
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
