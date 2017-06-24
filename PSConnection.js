'use strict';

const WebSocket = require('ws');

class PSConnection {
	constructor() {
		this.handlers = {};
		this.battles = {};
		this.monitors = {};
		this.usable = false;
	}

	on(event, cb) {
		this.handlers[event] = this.handlers[event] || [];
		this.handlers[event].push(cb);
	}

	remove(event, cb) {
		for (var i in this.handlers[event])
			if (this.handlers[event][i] == cb) {
				delete this.handlers[event][i];
				break;
			}
	}

	send(data) {
		this.ws.send(JSON.stringify(data));
	}

	addBattleListener(battle) {
		this.monitors[battle.room] = battle;
	}

	removeBattleListener(battle) {
		delete this.monitors[battle.room];
	}

	start() {
		try {
			this.ws = new WebSocket('wss://sim2.psim.us/showdown/926/3jbvr0y1/websocket');
			this.ws.on('error', () => {
				console.log('Failed to connect. Websocket was disabled, some feature might not work properly');				
				this.usable = false;
			});
			
			this.ws.on('open', () => {
				console.log('kek');
				this.usable = true;
			});

			this.ws.on('close', () => {
				console.log('CONNECTION CLOSED');
				this.usable = false;
				this.start();
			});
			
			this.ws.on('message', (data) => {
				if (data == 'o')
					return;
				data = JSON.parse(data.substr(1))[0];
				data = data.split('\n')
					.filter(line => line != '');
				if (data[0][0] == '>') {
					let room = data[0].substr(1);
					data = data.filter(line => line[0] != '>');
					if (this.monitors[room]) {
						for(let e of data) {
							// Have to check everytime because certain events might destroy the room
							if (!this.monitors[room])
								break;
							let event = e.split('|')[1];
							if (this.monitors[room][event]) {
								this.monitors[room][event](e, e.split('|').filter(d => d != ''));
							}
						}
					}
				}
				else {
					data.filter(line => line[0] != '>')
						.map(e => [e.split('|')[1], e.split('|'), e])
						.filter(event => this.handlers[event[0]])
						.map(event => [this.handlers[event[0]], ...event])
						.forEach(e => e[0].forEach(f => f(e[3], e[2].filter(d => d != ''))));
				}
			});
		} catch(e) {
			console.log('Something horribly wrong happened, disabled websocket');
		}
	}
};

module.exports = new PSConnection();
