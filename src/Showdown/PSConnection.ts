import { eventToPSMessages, GlobalEventsType, eventToPSBattleMessage, PSRequest, EventsName, PSEvent, PSEventType, BattleEventsType } from './PSMessage';
import { PSRoom, RoomID } from './PSRoom';
import { Player } from './Player';

import SockJS = require('sockjs-client');
import { snooze, toId } from '../Website/utils';

type ID = string & { __tag: 'id' }
export let toID = (e: Parameters<typeof toId>[0]) => toId(e) as ID;
type Format = { id: ID, name: string, section: string };

let parseFormats = (formatsList: string[]) => {
	let isSection = false;
	let section = '';

	let column = 0;

	let BattleFormats: Map<ID, Format> = new Map;
	for (let j = 1; j < formatsList.length; j++) {
		const entry = formatsList[j];
		if (isSection) {
			section = entry;
			isSection = false;
		} else if (entry === ',LL') {
			//PS.teams.usesLocalLadder = true;
		} else if (entry === '' || (entry.charAt(0) === ',' && !isNaN(Number(entry.slice(1))))) {
			isSection = true;

			if (entry) {
				column = parseInt(entry.slice(1), 10) || 0;
			}
		} else {
			let name = entry;
			let searchShow = true;
			let challengeShow = true;
			let tournamentShow = true;
			let team: 'preset' | null = null;
			let teambuilderLevel: number | null = null;
			let lastCommaIndex = name.lastIndexOf(',');
			let code = lastCommaIndex >= 0 ? parseInt(name.substr(lastCommaIndex + 1), 16) : NaN;
			if (!isNaN(code)) {
				name = name.substr(0, lastCommaIndex);
				if (code & 1) team = 'preset';
				if (!(code & 2)) searchShow = false;
				if (!(code & 4)) challengeShow = false;
				if (!(code & 8)) tournamentShow = false;
				if (code & 16) teambuilderLevel = 50;
			} else {
				// Backwards compatibility: late 0.9.0 -> 0.10.0
				if (name.substr(name.length - 2) === ',#') { // preset teams
					team = 'preset';
					name = name.substr(0, name.length - 2);
				}
				if (name.substr(name.length - 2) === ',,') { // search-only
					challengeShow = false;
					name = name.substr(0, name.length - 2);
				} else if (name.substr(name.length - 1) === ',') { // challenge-only
					searchShow = false;
					name = name.substr(0, name.length - 1);
				}
			}
			let id = toID(name);
			let isTeambuilderFormat = !team && name.slice(-11) !== 'Custom Game';
			let teambuilderFormat = '' as ID;
			let teambuilderFormatName = '';
			if (isTeambuilderFormat) {
				teambuilderFormatName = name;
				if (id.slice(0, 3) !== 'gen') {
					teambuilderFormatName = '[Gen 6] ' + name;
				}
				let parenPos = teambuilderFormatName.indexOf('(');
				if (parenPos > 0 && name.slice(-1) === ')') {
					// variation of existing tier
					teambuilderFormatName = teambuilderFormatName.slice(0, parenPos).trim();
				}
				if (teambuilderFormatName !== name) {
					teambuilderFormat = toID(teambuilderFormatName);
					let elem = BattleFormats.get(teambuilderFormat);
					if (!elem) {
						BattleFormats.set(teambuilderFormat, {
							id: teambuilderFormat,
							name: teambuilderFormatName,
							section,
						});
					}
					isTeambuilderFormat = false;
				}
			}
			// make sure formats aren't out-of-order
			if (BattleFormats.has(id))
				BattleFormats.delete(id);
			BattleFormats.set(id, {
				id,
				name,
				section,
			});
		}
	}
	return BattleFormats
}
export let availableFormats: any = {};

let updateAvailableFormats = (formats: string[]) => {
	let map = parseFormats(formats);
	for (let e of map.entries())
		availableFormats[e[0]] = e[1]
}

export class PSConnection {
	usable: boolean = false;
	onstart?: () => Promise<void>;
	ws!: WebSocket;
	wscache: string[] = [];
	iid?: NodeJS.Timer;
	challstrraw: string = '';
	eventqueue: PSEventType[] = [];
	rooms: Map<string, PSRoom> = new Map<string, PSRoom>();
	messagequeue: MessageEvent[] = [];
	openprom?: () => void;
	openrej?: (d: Error) => void;
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
		this.ws = new SockJS('https://sim3.psim.us/showdown');
		this.ws.onmessage = ev => {
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

		this.ws.onclose = (e?: Event) => {
			this.opened = false;
			this.usable = false;
			this.openrej && this.openrej(new Error(e && e.type));
		}

		this.ws.onerror = (e?: Event) => {
			this.opened = false;
			this.usable = false;
			this.openrej && this.openrej(new Error(e && e.type));
		}
	}

	constructor() {
		//this.clear();
	}

	send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
		if (!this.ws)
			throw 'Attempted to send without initialized socket';
		if (this.errored)
			throw 'Socket is in an error state';
		this.ws.send(data);
	}

	joinRoom(room: RoomID): PSRoom {
		if (room == '')
			return new PSRoom(this, '' as RoomID);
		if (this.rooms.has(room))
			return this.rooms.get(room)!;
		let ret: PSRoom = new PSRoom(this, room);
		if (!this.ws)
			throw 'Attempted to send without initialized socket';
		this.send(`|/join ${room}`);
		this.rooms.set(room, ret);
		return ret;
	}

	leaveRoom(room: string) {
		if (!this.rooms.has(room))
			return;
		let ret: PSRoom = this.rooms.get(room)!;
		ret.send('/leave');
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
		this.ws.close();
		this.ws.onclose = null;
	}

	request<T extends GlobalEventsType | BattleEventsType, R>(req: PSRequest<T, R>): Promise<R> {
		return new Promise<R>((res, rej) => {
			this.send(req.toString());
			this.requests.push({ req, res, rej });
		})
	}

	async open() {
		if (this.opened)
			return;
		return new Promise<void>((res, rej) => {
			this.openprom = res;
			this.openrej = rej;
		});
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

			updateAvailableFormats(formats);

			// Hum what the fuck zarle?
			// let rooms = await this.read('queryresponse');
			let challstr = await this.read('challstr');
			challstr.shift();
			this.challstrraw = challstr.join('|');
			this.usable = true;
			// heartbeat
			this.iid = setInterval(() => this.send('/me dabs'), 1000 * 60);
			if (!this.ws)
				throw 'Socket not initialized';
			this.ws.onclose = async (ev) => {
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
