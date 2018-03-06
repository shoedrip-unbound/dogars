'use strict';

const WebSocket = require('ws');
const W3CWebSocket = require('websocket').w3cwebsocket;
const WebSocketP = require('websocket-as-promised');

let suck = d => JSON.parse(d.substr(1))[0]
let logger	 = require('./logger');

let connection;

class PSConnection {
	constructor() {
		this.handlers = {};
		this.battles = {};
		this.monitors = {};
		this.usable = false;
		this.readPromises = [];
		this.ws = new WebSocketP('wss://sim2.psim.us/showdown/926/3jbvr0y1/websocket', {
			createWebSocket: u => new W3CWebSocket(u)
		});
		this.ws.cache = []
		this.roomLog = {};
	}

	addCache(data) {
		if (this.readPromises.length > 0) {
			this.readPromises.forEach(res => res(data))
			this.readPromises = [];
		} else
			this.ws.cache.push(data);
	}

	async send(data) {
		await this.ws.send(JSON.stringify(data));
	}

	connread() {
		if (this.ws.cache.length > 0)
			return this.ws.cache.shift();
		return new Promise(res => this.readPromises.push(res));
	}

	async read() {
		let mes;
		while (1) {
			mes = await this.connread();
			if (mes[0] != 'a') {
				return mes;
			}
			let pmes = suck(mes);
			if (pmes[0] != '>')
				break;
			let room = pmes.substr(1, pmes.indexOf('\n') - 1);
			let log = this.roomLog[room] || [];
			let app = pmes.substr(`>${room}\n`.length).split('\n').filter(e => e != '');
			log.push(...app);
			this.roomLog[room] = log;
		}
		return mes;
	}

	newConnection() {
		return new PSConnection();
	}

	async close() {
		this.ws.onClose.removeAllListeners();
		await this.ws.close();
	}

	async getNextBattleEvent(room) {
		let log = this.roomLog[room] || [];
		while (!log || log.length == 0) {
			let mes = suck(await this.connread());
			let oroom = mes.substr(1, mes.indexOf('\n') - 1);
			if (oroom != room) {
				let olog = this.roomLog[oroom] || [];
				let oapp = mes.substr(`>${room}\n`.length).split('\n').filter(e => e != '');
				olog.push(...oapp);
				this.roomLog[oroom] = olog;
			} else {
				log = this.roomLog[room] || [];
				let app = mes.substr(`>${room}\n`.length).split('\n').filter(e => e != '');
				log.push(...app);
			}
		}
		let line = log.shift().split('|').filter(e => e != '');
		let ret = {
			log: line,
			name: line[0]
		};
		this.roomLog[room] = log;
		return ret;
	}

	async start() {
		if (this.usable)
			return;
		try {
			this.ws.onMessage.addListener(d => this.addCache(d));
			this.ws.open();
			let o = await this.read();
			if (o != 'o')
				throw "No o";
			// >We don't care actually
			let formats = await this.read();
			let rooms = await this.read();
			// don't care yet
			rooms = suck(rooms);
			this.challstrraw = suck(await this.read());
			this.usable = true;

			// heartbeat
			setTimeout(() => this.send('/me dabs'), 1000 * 60);

			this.ws.onClose.addOnceListener(async (code, reason) => {
				logger.log(0, 'Socket was closed', code, reason);
				this.usable = false;
				await this.start();
			});
		} catch(e) {
			console.log('Something horribly wrong happened, disabled websocket', e);
		}
	}
};

connection = new PSConnection();
module.exports = connection;
