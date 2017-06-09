'use strict';

const WebSocket = require('ws');

class PSConnection {
	constructor(roomUrl, message) {
		console.log('Connection created');
		let room = roomUrl.match(/(battle-.*)\/?/)[0];

		let handlers = {
			message: message
		}
		this.ws = new WebSocket('wss://sim2.psim.us/showdown/926/3jbvr0y1/websocket');
		this.ws.on('open', () => {
			console.log('Connection opened');
			this.ws.send(JSON.stringify("|/join " + room));
		});

		this.ws.on('close', () => {
			console.log('CONNECTION CLOSED');
		});

		this.ws.on('message', (data) => {
			if (data == 'o')
				return;
			data = JSON.parse(data.substr(1))[0];
			data = data.split('\n').filter(line => line != '');
			if (data[0][0] != '>')
				return;
			for (var i = 1; i < data.length; ++i)
				if (handlers.message(data[i]))
					this.ws.close();
		});
	}
};

module.exports = PSConnection;
