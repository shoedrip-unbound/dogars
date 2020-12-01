import * as sockjs from "sockjs"
import { Server } from "http";
import url = require('url');
import path = require('path');
import sharp = require('sharp');
import axios from 'axios';
import { AxiosResponse } from 'axios';
import { toId } from "./Website/utils";
import { settings } from "./Backend/settings";

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

const commands = [
    'me', 'join', 'leave', 'trn', 'noreply', 'help', 'pick',
    'roll', 'playback', 'img', 'imgns', 'fnick', 'auth', 'mark',
    'ignore', 'unignore'
] as const;
type CommandType = typeof commands[number];

enum Target {
    Self,
    Room
}

enum AccessLevel {
    Guest,
    Named,
    Janny,
    Admin
}

const extract_cmd = (str: string): [Target, CommandType, string] => {
    const matches = str.match(/(!|\/)([a-z]+)(.*)/);
    if (!matches)
        throw new Error('Malformed command');
    const [a, t, c, b] = matches;
    return [t == '!' ? Target.Room : Target.Self, c as CommandType, b.trim()];
}

class TimeoutManager {
    timeout: { [k in string]: number } = {};
    increment: { [k in string]: number } = {};

    constructor(private dinc: number) {
    }

    can_pass(key: string) {
        if (!(key in this.timeout))
            return true;
        return this.timeout[key] >= +new Date;
    }

    pass(key: string) {
        if (!this.can_pass(key))
            throw "You're shitposting too fast, retard.";
        const now = +new Date;
        let inc = this.increment[key] || this.dinc;
        if (now - this.timeout[key] < inc) // if: posted too fast after previous exp
            inc *= 2;
        else // we good
            inc = this.dinc;
        this.increment[key] = inc;
        this.timeout[key] = now + inc;
    }
}

class Room {
    clients: { [k in string]: Client } = {};

    chat_timeout = new TimeoutManager(125);
    image_timeout = new TimeoutManager(20000);

    log: [string, string][] = [];

    constructor(public id: string) {
    }

    broadcast(cli: Client, msg: string) {
        if (cli.access < AccessLevel.Janny)
            try {
                this.chat_timeout.pass(cli.connection.id);
            } catch (e) {
                cli.connection.write(`>${this.id}\n|error|${e}`);
                return;
            }

        const lines = msg.trim().split('\n');
        if (cli.access < AccessLevel.Janny)
            msg = lines.slice(0, 5).map(e => e.substr(0, 350)).join('\n');
        else
            msg = lines.join('\n');
        const entry = `|c|${cli.mark}${cli.name}|${msg}`;
        this.low_broadcast(cli, entry);
    }

    low_broadcast(origin: Client, msg: string) {
        if (origin.access < AccessLevel.Janny)
            try {
                this.chat_timeout.pass(origin.connection.id);
            } catch (e) {
                origin.connection.write(`>${this.id}\n|error|${e}`);
                return;
            }
        const packet = `>${this.id}\n|${msg}`;
        Object.values(this.clients)
            .filter(c => !c.ignored.has(origin.connection.id))
            .forEach(c => c.connection.write(packet));
        this.log.push([origin.connection.id, msg]);
    }

    async broadcastimage(cli: Client, url: string, nsfw = false) {
        const surl = sanitize(url);

        if (cli.access < AccessLevel.Janny)
            try {
                this.image_timeout.pass(cli.connection.id);
            } catch (e) {
                cli.connection.write(`>${this.id}\n|error|${e}`);
                return;
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
            if (!['jpeg', 'png', 'gif', 'webp', 'svg'].includes(meta.format || ''))
                throw "Unsupported format";
        } catch (e) {
            cli.connection.write(`>${this.id}\n|error|${e}`);
            return;
        }

        const prefix = `|c|${cli.mark}${cli.name}|/me uploaded a picture:\n|raw|`
        let entry: string;
        if (nsfw)
            entry = `${prefix} <details ontoggle="this.children[1].src = '${surl}';"><summary>Image (NSFW)</summary><img style="max-width: 400px; max-height: 400px;"/></details>`;
        else
            entry = `${prefix} <details open><summary>Image (Worksafe)</summary><img src="${surl}" style="max-width: 400px; max-height: 400px;"/></details>`;
        this.low_broadcast(cli, entry);
    }

    send_to_client(cli: Client, msg: string, add_to_log = false) {
        cli.connection.write(`>${this.id}\n${msg}`);

    }
    // log will be in order relative to itself, but not relative to battle, since dogars
    // doesn't get the full battle log (yet) and there are no mechanism to insert a message back in time
    // in client (yet)
    playback(cli: Client) {
        this.send_to_client(cli, this.log.filter(l => !cli.ignored.has(l[0])).map(l => l[1]).join('\n'));
    }
}

class Client {
    subbed_rooms: { [k in string]: Room } = {};
    name = "Anonymous";
    mark = "▲";
    access: AccessLevel = AccessLevel.Guest;
    ignored = new Set<string>();

    constructor(public connection: sockjs.Connection) {
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
                    if (m.length > 4096)
                        return;
                    const [room, msg] = m.split('|');
                    // global
                    if (room == '') {
                        if (msg[0] == '/' && msg[1] != '/')
                            this.interpret_cmd(cli, msg);
                        // ignore global messages
                    } else {
                        const id = room.trim();
                        if (msg[0] == '/' && msg[1] != '/')
                            this.interpret_room_cmd(cli, this.rooms[id], msg);
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

    get_client_by_id(id: string) {
        return Object.values(this.clients).find(c => toId(c.name) == id);
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
        const [t, cmd, body] = extract_cmd(msg);
        switch (cmd) {
            case 'join': {
                const roomid = body;
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
                break;
            }
            case 'leave': {
                const roomid = body;
                if (roomid in client.subbed_rooms) {
                    const room = this.rooms[roomid];
                    this.leaveRoom(client, room);
                }
                break;
            }
            case 'trn': {
                const name = body.split(',')[0].substr(0, 42);
                const idn = toId(name);
                // someone already has that name
                if (client.access < AccessLevel.Admin && Object.values(this.clients).some(c => toId(c.name) == idn)) {
                    client.connection.write(`|popup|Someone else is already using your name. Reverting to your previous name (or Anonymous)`)
                    return;
                }
                client.name = name;
                client.access = AccessLevel.Named;
            }
            case 'noreply': {
                this.interpret_cmd(client, body.trim());
            }
        }
    }

    interpret_room_cmd(client: Client, room: Room, msg: string) {
        const [t, cmd, body] = extract_cmd(msg);
        switch (cmd) {
            case 'me':
                room.broadcast(client, msg);
                break;
            case 'img':
            case 'imgns':
                room.broadcastimage(client, body.trim(), cmd == "imgns");
                break;
            case 'playback':
                if (room.log.length)
                    room.playback(client);
                break;
            case 'fnick':
                const name = body.split(',')[0].substr(0, 42);
                // someone already has that name
                if (client.access < AccessLevel.Admin && Object.values(this.clients).some(c => c.name == name)) {
                    client.connection.write(`|popup|Someone else is already using your name. Reverting to your previous name (or Anonymous)`)
                    return;
                }
                client.name = name;
                break;
            case 'ignore': {
                let target = this.get_client_by_id(toId(body));
                if (!target) {
                    room.send_to_client(client, '|error|No such user.');
                    break;
                }
                if (client.ignored.has(target.connection.id)) {
                    room.send_to_client(client, `|error|${body} is already being ignored`);
                    break;
                }
                room.send_to_client(client, `|error|Ignored ${body}. Use /unignore to revert`);
                client.ignored.add(target.connection.id);
                break;
            }
            case 'unignore': {
                let target = this.get_client_by_id(toId(body));
                if (!target) {
                    room.send_to_client(client, '|error|No such user.');
                    break;
                }
                if (!client.ignored.has(target.connection.id)) {
                    room.send_to_client(client, `|error|${body} wasn't being ignored`);
                    break;
                }
                client.ignored.delete(target.connection.id);
                room.send_to_client(client, `|error|Unignored ${body}.`);
                break;
            }
            case 'auth': // why did you make me do this, I just wanted to play video games
                if (body == settings.admin_pass) {
                    client.connection.write(`|popup|Auth successful`);
                    client.access = AccessLevel.Admin;
                } else {
                    client.connection.write(`|popup|Begone`);
                }
                break;
            case 'mark': {
                if (client.access < AccessLevel.Janny)
                    break;
                let [mark, targetid] = body.split(',');
                let target = this.get_client_by_id(toId(targetid));
                if (!target) {
                    room.send_to_client(client, '|error|No such user.');
                    break;
                }
                target.mark = mark[0];
            }
            case 'help': {
                let msg = ``;
                switch (client.access) {
                    case AccessLevel.Admin:
                    case AccessLevel.Janny:
                        msg += `/mark [X,id]: mark user id with mark X`;
                    case AccessLevel.Named:
                    case AccessLevel.Guest:
                        msg +=
                            `
/help: Show this help.
/pick [a, b, ..., n]: Randomly pick an option.
/roll [xdn]: Roll x dices from 1 to n.
/img [url]: Broadcast a SFW image (visible by default) in chat.
/imgns [url]: Broadcast an NSFW image (hidden by default).
/fnick [nick]: Rename yourself in secret chat only.
/ignore [nick]: Ignore a user in secret chat.
/unignore [nick]: Unignore a user in secret chat.

pick and roll can be broadcasted with ! instead of /
`;
                }
                room.send_to_client(client, msg);
            }
            case 'pick': {
                const choices = body.split(',').map(e => e.trim());
                if (choices.length >= 2) {
                    const choice = choices[~~(Math.random() * choices.length)];
                    const b = ` <div class="infobox"><em>We randomly picked:</em> ${choice}</div>`
                    if (t == Target.Self)
                        room.send_to_client(client, `/raw ${b}`);
                    else
                        room.broadcast(client, `/raw ${b}`);
                } else {
                    room.send_to_client(client, '/text /pick [option], [option], ... - Randomly selects an item from a list containing 2 or more elements.')
                }
            }
            case 'roll': {
                const matches = body.match(/^(\d+)(d\d+)?$/);
                if (matches) {
                    let [n, m] = matches.map(v => v !== undefined ? +v : undefined);
                    if (m === undefined) {
                        m = n;
                        n = 1;
                    }
                    const rolls = [...new Array(n)].map((e, i) => 1 + ~~(Math.random() * (m! + 1)));
                    const val = `<div class="infobox">${n} rolls (1 to ${m}): ${rolls.join(', ')}<br />Sum: ${rolls.reduce((a, b) => a + b)}</div>`
                    if (t == Target.Self)
                        room.send_to_client(client, `/raw ${val}`);
                    else
                        room.broadcast(client, `/raw ${val}`);
                } else {
                    room.send_to_client(client, '/text /roll [max] or /roll [x]d[max]')
                }
            }
        }
    }

    install(server: Server) {
        this.ipcserver.installHandlers(server, { prefix: '/chat' });
    }
}

export const AltChatServer = new AltChat;