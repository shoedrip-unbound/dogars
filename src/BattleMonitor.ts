import { db } from './db';
import { connection, PSConnection } from './PSConnection';
import { PlayerHijack } from './PlayerHijack';
import { Champ } from './Champ'
import { BattleData } from './BattleData'

import { logger } from './logger';
import { PSRoom } from './PSRoom';
import { PSBattleMessage, PSLeaveMessage, PSWinMessage, PSChatMessage, PSJoinMessage, PSPlayerDecl, PSSwitchMessage, PSFaintMessage } from './PSMessage';
import { Player } from './Player';
import { Game } from './Game';

// stolen from gist
let levenshtein = (a: string, b: string) => {
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

class BattleEvent {
	name: string = '';
	log: string[] = [];
	data: string = '';
}

export class BattleMonitor {
	con: Player;
	reg: boolean;
	stopped: boolean;
	attemptedJack: boolean = false;
	battleData: BattleData;
	champ: Champ;
	room: PSRoom;
	battlers: Map<string, Champ> = new Map<string, Champ>();

	events: { [idx: string]: (ev: any) => Promise<void> } = {};

	constructor(pchamp: Champ, isreg: boolean = true) {
		this.con = connection;
		this.reg = isreg === undefined ? true : isreg;
		this.stopped = false;
		this.champ = pchamp;
		this.champ.avatar = '166';
		this.battleData = new BattleData();
		this.battleData.champ = this.champ;
		this.battleData.memes = [];
		this.battleData.dist = 100;
		this.battleData.roomid = this.champ.champ_battle.match(/battle-(.*)\/?/)![0];
		this.room = this.con.tryJoin(this.champ.champ_battle.match(/(battle-.*)\/?/)![0]);
	//		this.room = this.con.joinRoom();

		this.events = {
			l: this.l,
			win: this.win,
			"switch": this.switch,
			player: this.player,
			faint: this.faint,
			c: this.c,
			j: this.j,
			inactive: this.inactive
		};
	}

	async inactive(mes: PSJoinMessage) {
	}

	async j(mes: PSJoinMessage) {
		if (mes.username == 'Roxle')
			this.con.message(this.room.room, `Hi ${mes.username}!`);
	}

	async c(mes: PSChatMessage) {
		if (mes.content.toLowerCase().indexOf('hi dogars-chan') == -1)
			return;
		this.con.message(this.room.room, `Hi ${mes.username}!`);
	}

	async monitor() {
		logger.log(0, 'Starting monitoring');
		while (!this.stopped) {
			let event = await this.room.read();
			if (this.events[event.name])
				await this.events[event.name].apply(this, [event]);
		}
		logger.log(0, 'Battle ended');
	}

	async l(left: PSLeaveMessage) {
		if (this.battleData.finished)
			return;

		let oppo_name;
		let oppo_alias;
		logger.log(0, this.battlers);
		oppo_alias = (this.battlers.get('p1')!.showdown_name == this.battleData.champ!.showdown_name) ? 'p2' : 'p1';
		if (this.battlers.get(oppo_alias)!.jacked)
			return;
		oppo_name = this.battlers.get(oppo_alias)!.showdown_name!;
		if (left.username.indexOf(oppo_name) == 0 || left.username.indexOf(oppo_name) == 1) {
			if (this.attemptedJack)
				return;
			this.attemptedJack = true;
			logger.log(0, `Starting jack attempt ${this.battlers.get(oppo_alias)}`);
			let hj = new PlayerHijack(this.battleData, this.battlers);
			hj.tryJack(false);
		}
	}

	async win(winner: PSWinMessage) {
		this.battleData.memes = this.battlers.get(this.battleData.champ_alias!)!.team!;
		logger.log(0, `${winner.username} won the battle`);
		if (this.reg)
			db.registerChampResult(this.battleData, this.battleData.champ!.showdown_name == winner.username);
		this.stopped = true;
	}

	async player(pl: PSPlayerDecl) {
		if (pl.showdown_name == '')
			return;
		let nc = new Champ();
		nc.showdown_name = pl.showdown_name;
		nc.avatar = pl.avatar;

		this.battlers.set(pl.alias, nc);
		let dist = levenshtein(this.battleData.champ!.champ_name || '', pl.showdown_name);
		if (dist < this.battleData.dist!) {
			this.battleData.champ!.showdown_name = pl.showdown_name;
			this.battleData.champ!.avatar = pl.avatar;
			this.battleData.champ_alias = pl.alias;
			this.battleData.dist = dist;
		}
	}

	async "switch"(sw: PSSwitchMessage) {
		if (this.battleData.dist! >= 3) {
			let name = sw.nick.split(': ')[1].trim();
			let forme = sw.status.split(',')[0].split('-')[0].trim();
			if (forme != name) {
				this.battleData.dist = 0;
				this.battleData.champ_alias = sw.nick.split(': ')[0].substr(0, 2);
				this.battleData.champ!.showdown_name = this.battlers.get(this.battleData.champ_alias!)!.showdown_name;
				this.battleData.champ!.avatar = this.battlers.get(this.battleData.champ_alias!)!.avatar;
			}
		}
		if (sw.nick.indexOf(this.battleData.champ_alias!) == 0) {
			let memename = sw.nick.substr(5);
			this.battleData.active_meme = memename;
			let exists = this.battlers.get(this.battleData.champ_alias!)!.team.some(mon => mon.name == memename);
			if (!exists)
				this.battlers.get(this.battleData.champ_alias!)!.team.push({ name: memename, kills: 0, dead: false })
		}
	}

	async faint(fainted: PSFaintMessage) {
		if (fainted.nick.indexOf(this.battleData.champ_alias!) == 0) {
			let memename = fainted.nick.substr(5);
			for (let i = 0; i < this.battlers.get(this.battleData.champ_alias!)!.team.length; ++i)
				if (this.battlers.get(this.battleData.champ_alias!)!.team[i].name == memename)
					this.battlers.get(this.battleData.champ_alias!)!.team[i].dead = true;
		} else {
			for (let i = 0; i < this.battlers.get(this.battleData.champ_alias!)!.team.length; ++i)
				if (this.battlers.get(this.battleData.champ_alias!)!.team[i].name == this.battleData.active_meme)
					this.battlers.get(this.battleData.champ_alias!)!.team[i].kills++;
		}
	}
}
