import { snooze, toId } from '../Website/utils';
import { eventToPSMessages, GlobalEventsType, eventToPSBattleMessage, PSRequest, EventsName, PSEvent, PSEventType, BattleEventsType } from './PSMessage';
import { PSRoom, RoomID } from './PSRoom';
import { Player } from './Player';

import SockJS = require('sockjs-client');

type ID = string & { __tag: 'id' }
export let toID = (e: Parameters<typeof toId>[0]) => toId(e) as ID;
type Format = { id: ID, name: string, section: string };

export enum Sink {
	Showdown = 1,
	Dogars = 2,
	All = 3
};

export class PSConnection {
	usable: boolean = false;
	onstart?: () => Promise<void>;
	ws!: WebSocket;
	dws!: WebSocket;

	iid?: NodeJS.Timer;
	challstrraw: string = '';
	eventqueue: PSEventType[] = [];
	rooms: Map<string, PSRoom> = new Map<string, PSRoom>();
	messagequeue: MessageEvent[] = [];

	openprom?: () => void;
	openrej?: (d: Error) => void;
	dopenprom?: () => void;
	dopenrej?: (d: Error) => void;

	opened = false;
	readprom?: { name?: EventsName, res: (ev: PSEventType) => void };
	requests: ({
		req: PSRequest<any, any>;
		res: (value?: any) => void;
		rej: (value?: any) => void;
	})[] = [];
	errored = false;

	clear() {
		this.iid && clearTimeout(this.iid);
		this.usable = false;
		this.opened = false;
		this.ws && this.ws.close();
		this.dws && this.dws.close();
		this.ws = new SockJS('https://sim3.psim.us/showdown');
		this.dws = new SockJS('https://dogars.ga/chat');
		this.dws.onmessage = this.ws.onmessage = ev => {
			console.log(ev)
			if (ev.data[0] == '>') {
				let { room, events } = eventToPSBattleMessage(ev);
				if (this.rooms.has(room)) {
					if (events instanceof Array)
						events.forEach(e => this.rooms.get(room)!.recv(e));
					else
						this.rooms.get(room)!.recv(events);
				}
			} else {
				let mesgs = eventToPSMessages(ev);
				// remove requests that where handled from the list
				this.requests = this.requests.filter(r => {
					let handled = false;
					// remove messages that where handled by a request
					mesgs = mesgs.filter(e => {
						let h = r.req.isResponse(e);
						if (h) {
							handled = true;
							r.res(r.req.buildResponse(e));
						}
						return !h;
					});
					return !handled;
				});
				// everything was consumed
				if (mesgs.length == 0)
					return;
				// if something is waiting to read...
				if (this.readprom && mesgs[0][0] == this.readprom.name) {
					this.readprom.res(mesgs.shift()!);
					this.readprom = undefined;
				}
				// push messages that weren't handled yet
				this.eventqueue.push(...mesgs);
			}
		};

		this.ws.onopen = () => {
			this.opened = true;
			this.openprom && this.openprom();
			this.openrej = undefined;
		}

		this.dws.onopen = () => {
			this.opened = true;
			this.dopenprom && this.dopenprom();
			this.dopenrej = undefined;
		}

		const sderror = (e?: Event) => {
			this.opened = false;
			this.usable = false;
			this.openrej && this.openrej(new Error(e && e.type));
		};

		const doerror = (e?: Event) => {
			this.opened = false;
			this.usable = false;
			this.dopenrej && this.dopenrej(new Error(e && e.type));
		};

		this.ws.onclose = sderror;
		this.ws.onerror = sderror;
		this.dws.onclose = doerror;
		this.dws.onerror = doerror;
	}

	constructor() {
		//this.clear();
	}


	send(data: string | ArrayBufferLike | Blob | ArrayBufferView, sink: Sink) {
		if (this.errored)
			throw 'Socket is in an error state';
		if (sink & Sink.Showdown) {
			if (!this.ws)
				throw 'Attempted to send without initialized socket';
			this.ws.send(data);
		}
		if (sink & Sink.Dogars) {
			if (!this.dws)
				throw 'Attempted to send without initialized socket';
			this.dws.send(data);
		}
	}

	joinRoom(room: RoomID): PSRoom {
		if (room == '')
			return new PSRoom(this, '' as RoomID);
		if (this.rooms.has(room))
			return this.rooms.get(room)!;
		let ret: PSRoom = new PSRoom(this, room);
		if (!this.ws)
			throw 'Attempted to send without initialized socket';
		this.send(`|/join ${room}`, Sink.All);
		this.rooms.set(room, ret);
		return ret;
	}

	leaveRoom(room: string) {
		if (!this.rooms.has(room))
			return;
		let ret: PSRoom = this.rooms.get(room)!;
		ret.send('/leave', Sink.All);
		this.rooms.delete(room);
		return ret;
	}

	// I want to impregnate type systems
	read<T extends EventsName>(name?: T) {
		return new Promise<PSEventType>((res, rej) => {
			if (this.errored)
				return rej('Socket is in an error state');
			if (this.eventqueue.length >= 1) {
				let idx = this.eventqueue.findIndex(m => m[0] == name);
				let elem = this.eventqueue.splice(idx, 1)[0];
				return res(elem as PSEvent[T]);
			}
			this.readprom = { name, res };
		}) as any as Promise<PSEvent[T]>;
	}

	close() {
		this.usable = false;
		this.opened = false;
		if (!this.ws)
			throw 'Attempted to close without initialized socket';
		if (!this.dws)
			throw 'Attempted to close without initialized socket';
		this.ws.close();
		this.dws.close();
		this.ws.onclose = null;
		this.dws.onclose = null;
	}

	request<T extends GlobalEventsType | BattleEventsType, R>(req: PSRequest<T, R>): Promise<R> {
		return new Promise<R>((res, rej) => {
			this.send(req.toString(), Sink.All);
			this.requests.push({ req, res, rej });
		})
	}

	async open() {
		if (this.opened)
			return;
		return Promise.all([new Promise<void>((res, rej) => {
			this.openprom = res;
			this.openrej = rej;
		}), new Promise<void>((res, rej) => {
			this.dopenprom = res;
			this.dopenrej = rej;
		})]);
	}

	async start() {
		this.clear();
		if (this.usable)
			return;
		try {
			await this.open();

			// don't care yet
			let user = await this.read('updateuser');
			let formats = await this.read('formats');

			// Hum what the fuck zarle?
			// let rooms = await this.read('queryresponse');
			let challstr = await this.read('challstr');
			challstr.shift();
			this.challstrraw = challstr.join('|');
			this.usable = true;
			// heartbeat
			this.iid = setInterval(() => this.send('/me dabs', Sink.Showdown), 1000 * 60);
			if (!this.ws || !this.dws)
				throw 'Socket not initialized';
			this.dws.onclose = this.ws.onclose = async (ev) => {
				this.close();
				await this.start();
			};
			this.onstart && await this.onstart();
		} catch (e) {
			console.log('Something horribly wrong happened, disabled websocket', e);
			this.close();
			//await this.start();
		}
	}
};

let connection: Player;

// Guest
// connection = new PSConnection();

// Named
export let tryConnect = async () => {
	let success = false;
	do {
		try {
			connection = new Player();
			await connection.connect();
			console.log('Successful connection ');
			success = true;
		} catch (e) {
			console.log('Connection failed, attempting again in 5 seconds...');
			await snooze(5000);
		}
	}
	while (!success);
};

export { connection };
