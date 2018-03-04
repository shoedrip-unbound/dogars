'use strict';

const WebSocket = require('ws');
const W3CWebSocket = require('websocket').w3cwebsocket;
const WebSocketP = require('websocket-as-promised');

let suck = d => JSON.parse(d.substr(1))[0]

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

	read() {
		if (this.ws.cache.length > 0) {
			return new Promise(res => {
				res(this.ws.cache.shift());
			});
		}
		return new Promise(res => {
			this.readPromises.push(res);
		});
	}

	newConnection() {
		return new PSConnection();
	}

	async close() {
		await this.ws.close();
	}

	async getNextBattleEvent(room) {
		this.roomLog = this.roomLog || {}
		let log = this.roomLog[room];
		if (!log || log.length == 0) {
			let mess;
			do {
				mess = suck(await this.read());
			} while (mess.indexOf(`>${room}\n`) == -1)
			log = mess.substr(`>${room}\n`.length).split('\n').filter(e => e != '');
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
			this.ws.onClose.addOnceListener(async (code, reason) => {
				console.log('Socket was closed', code, reason);
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
