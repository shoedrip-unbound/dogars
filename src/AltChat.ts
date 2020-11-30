import * as sockjs from "sockjs"
import { Server } from "http";
import url = require('url');
import path = require('path');
import sharp = require('sharp');
import axios from 'axios';
import { AxiosResponse } from 'axios';
import { toId } from "./Website/utils";

/*
    Idea is to combine both the showdown socket and dogars socket as a single message stream so that
    the webclient will seamlessly integrate messages from both sources into the log.
    When a user sends a global message (such as a command to join a room), the command will be sent
    both to showdown and dogars. showdown will run its room init code while dogars will "subscribe" the
    user to the specified room. Later when a user publishes a message to a given room, the message will be broadcast to every other player in the room.
    One side effect of this is that messages aren't preserved on dogars, and won't be repeated.
    Fix requires spectating rooms and merging the battle log and the local log, and modifying the webclient code to override the room init mechanism.
    Investigate: Maybe we could get away with simply saving what was sent from all users if the webclient allowed messages to be sent out of order (very unlikely, but still possible as mods seem to be able to retroactively delete messages)

    This may allow in the future features like auto-following champ, automatically sending invites to everyone connected through dogars
    if an opponent turns modjoin on.
*/

const sanitize = (surl: string) => {
    const parsed = url.parse(surl);
    if (parsed.protocol != 'https:')
        return '';
    return parsed.href;
}

class Room {
    clients: { [k in string]: Client } = {};
    timeout: { [k in string]: number } = {};
    increments: { [k in string]: number } = {};

    imagetimeout: { [k in string]: number } = {};
    imageincrements: { [k in string]: number } = {};
    log: string[] = [];

    constructor(public id: string) {
    }

    broadcast(cli: Client, msg: string) {
        // fuck you sableye
        const id = cli.connection.id;
        const now = +new Date;

        const timo = this.timeout;
        const tinc = this.increments;

        if (id in timo) {
            if (timo[id] > now) {
                cli.connection.write(`>${this.id}\n|error|You're shitposting too fast, retard.`)
                return;
            }
            // default inc is 125ms, if you post again less than 125ms after expiration, 
            // timer will be doubled, and you will be allowed to post, but your next expiration will be in 150ms, etc...
            // this will reset to 125 if you wait more than the current increment AFTER your increment has expired
            // this means the optimal rate to post to not get your increment doubled is 1msg/250ms
            let inc = tinc[id] || 125;
            if (now - timo[id] < inc) // if: posted too fast after previous exp
                inc *= 2;
            else // we good
                inc = 125;
            tinc[id] = inc;
        }
        const inc = tinc[id] || 125;
        timo[id] = now + inc;
        const lines = msg.trim().split('\n');
        msg = lines.slice(0, 5).map(e => e.substr(0, 350)).join('\n');
        const entry = `|c|${cli.mark}${cli.name}|${msg}`;
        Object.values(this.clients).forEach(c => c.connection.write(`>${this.id}\n${entry}`))
        this.log.push(entry);
    }

    async broadcastimage(cli: Client, url: string, nsfw = false) {
        const surl = sanitize(url);

        const id = cli.connection.id;
        const now = +new Date;

        const timo = this.imagetimeout;
        const tinc = this.imageincrements;

        if (id in timo) {
            if (timo[id] > now) {
                cli.connection.write(`>${this.id}\n|error|You're shitposting too fast, retard.`)
                return;
            }
            let inc = tinc[id] || 20000;
            if (now - timo[id] < inc)
                inc *= 2;
            else
                inc = 20000;
            tinc[id] = inc;
        }
        // this is after timeout verification to prevent DoS and to discourage trying to game the system
        try {
            let buf: AxiosResponse<any>;
            try {
                buf = await axios.get(surl, {
                    headers: {
                        Referer: 'https://play.dogars.ga' // will throw if hotlinking not allowed
                    },
                    responseType: 'arraybuffer',
                    timeout: 5000,
                    maxContentLength: 1024 * 1024
                });    
            } catch (e) {
                throw "Prefetch failed, maybe due to hotlinking not allowed, timeout, or file too big";
            }
            if ((buf.data as ArrayBuffer).byteLength > 1024 * 1024) // isn't that redundant?
                throw "Image too big (Over 1MB)";
            const meta = await sharp(buf.data).metadata(); // i think it should throw if image cannot be decoded
            if (!['jpg', 'png', 'gif', 'webp', 'svg'].includes(meta.format || ''))
                throw "Unsupported format";
        } catch (e) {
            cli.connection.write(`>${this.id}\n|error|${e}`);
            return;
        }

        const inc = tinc[id] || 125;
        timo[id] = now + inc;
        const prefix = `|c|${cli.mark}${cli.name}|/me uploaded a picture:\n|raw|`
        let entry: string;
        if (nsfw)
            entry = `${prefix} <details ontoggle="this.children[1].src = '${surl}';"><summary>Image (NSFW)</summary><img style="max-width: 400px; max-height: 400px;"/></details>`;
        else
            entry = `${prefix} <details open><summary>Image (Worksafe)</summary><img src="${surl}" style="max-width: 400px; max-height: 400px;"/></details>`;
        Object.values(this.clients).forEach(c => c.connection.write(`>${this.id}\n${entry}`))
        this.log.push(entry);
    }

    // log will be in order relative to itself, but not relative to battle, since dogars
    // doesn't get the full battle log (yet) and there are no mechanism to insert a message back in time
    // in client (yet)
    playback(cli: Client) {
        cli.connection.write(`>${this.id}\n${this.log.join('\n')}`);
    }
}

class Client {
    subbed_rooms: { [k in string]: Room } = {};
    name = "Anonymous";
    mark = "▲";

    constructor(public connection: sockjs.Connection) {
    }

    deinit() {
        Object.values(this.subbed_rooms).forEach(r => delete r.clients[this.connection.id])
    }
}

class AltChat {
    clients: { [k in string]: Client } = {};
    rooms: { [k in string]: Room } = {};

    ipcserver: sockjs.Server;
    auth: boolean[] = [];
    gid: number = 0;
    constructor() {
        this.ipcserver = sockjs.createServer({ sockjs_url: "https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.1.5/sockjs.min.js" });
        this.ipcserver.on('connection', (conn: sockjs.Connection) => {
            const cli = new Client(conn);
            this.clients[conn.id] = cli;
            console.log(conn.id)
            conn.on('data', async (m) => {
                try {
                    const [room, msg] = m.split('|');
                    // global
                    if (room == '') {
                        if (msg[0] == '/' && msg[1] != '/')
                            this.interpret_cmd(cli, msg);
                        // ignore global messages
                    } else {
                        const id = room.trim();
                        if (msg[0] == '/' && msg[1] != '/')
                            this.interpret_room_cmd(cli, this.rooms[room], msg);
                        else // regular message in room
                            this.rooms[room].broadcast(cli, msg);
                    }
                } catch (e) {
                    console.error(e);
                }
            });
            conn.on('close', () => {
                Object.values(cli.subbed_rooms).forEach(room => this.leaveRoom(cli, room));
                delete this.clients[conn.id];
            });
        });
    }

    leaveRoom(client: Client, room: Room) {
        delete room.clients[client.connection.id];
        delete client.subbed_rooms[room.id];
        if (Object.keys(room.clients).length == 0) {
            // todo: deinit?
            delete this.rooms[room.id];
        }
    }

    interpret_cmd(client: Client, msg: string) {
        if (msg.startsWith('/join ')) {
            const roomid = msg.slice(6).trim();
            // already joined
            if (roomid in client.subbed_rooms) {
                return;
            }
            let room: Room;
            if (roomid in this.rooms) {
                room = this.rooms[roomid];
            } else {
                room = new Room(roomid);
                this.rooms[roomid] = room;
            }
            client.subbed_rooms[roomid] = room;
            room.clients[client.connection.id] = client;
        } else if (msg.startsWith('/leave ')) {
            const roomid = msg.slice(8).trim();
            if (roomid in client.subbed_rooms) {
                const room = this.rooms[roomid];
                this.leaveRoom(client, room);
            }
        } else if (msg.startsWith('/trn ')) {
            const name = msg.slice(5).split(',')[0].substr(0, 42);
            const idn = toId(name);
            // someone already has that name
            if (Object.values(this.clients).some(c => toId(c.name) == idn)) {
                client.connection.write(`|popup|Someone else is already using your name. Reverting to your previous name (or Anonymous)`)
                return;
            }
            client.name = name;
        } else if (msg.startsWith('/noreply '))
            this.interpret_cmd(client, msg.slice(9));
    }

    interpret_room_cmd(client: Client, room: Room, msg: string) {
        if (msg.startsWith('/playback')) {
            if (room.log.length)
                room.playback(client);
        }
        else if (msg.startsWith('/me '))
            room.broadcast(client, msg);
        else if (msg.startsWith('/img '))
            room.broadcastimage(client, msg.substr(5));
        else if (msg.startsWith('/imgns '))
            room.broadcastimage(client, msg.substr(7), true);
        else if (msg.startsWith('/fnick')) {
            const name = msg.slice(5).split(',')[0].substr(0, 42);
            // someone already has that name
            if (Object.values(this.clients).some(c => c.name == name)) {
                client.connection.write(`|popup|Someone else is already using your name. Reverting to your previous name (or Anonymous)`)
                return;
            }
            client.name = name;
        }
    }

    install(server: Server) {
        this.ipcserver.installHandlers(server, { prefix: '/chat' });
    }
}

export const AltChatServer = new AltChat;