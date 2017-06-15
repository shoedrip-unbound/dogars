'use strict';

const WebSocket = require('ws');

class PSConnection {
	constructor() {
		this.handlers = {};
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

	start() {
		let init = () => {
			this.ws = new WebSocket('wss://sim2.psim.us/showdown/926/3jbvr0y1/websocket');
			this.ws.on('open', () => {
			});

			this.ws.on('close', () => {
				console.log('CONNECTION CLOSED');
				// Can this reastically work?
				init();
			});
			
			this.ws.on('message', (data) => {
				if (data == 'o')
					return;
				data = JSON.parse(data.substr(1))[0];
				let e = data.split('|').filter(l => l != '')[0];
				if (this.handlers[e])
					this.handlers[e].forEach(fun => fun(data));
			});
		};
		init();
	}
};

module.exports = PSConnection;
