import * as sockjs from "sockjs"
import { Server } from "http";

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

class Room {
    clients: { [k in string]: Client } = {};
    constructor(public id: string) {
    }
}

class Client {
    subbed_rooms: { [k in string]: Room } = {};
    name = "Anonymous";
    constructor(public connection: sockjs.Connection) {
    }

    deinit() {
        Object.values(this.subbed_rooms).forEach(r => delete r.clients[this.connection.id])
    }
}

const extract_room_id = (room: string) => room.match(/battle-(.*)/)![1];

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
                        const id = extract_room_id(room);
                        if (msg[0] == '/' && msg[1] != '/')
                            this.interpret_room_cmd(cli, this.rooms[room], msg);
                        else // regular message in room
                            Object.values(this.rooms[room].clients).forEach(c => c.connection.write(`>${room}\n|c|▲${cli.name}|${msg}`))
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
            client.name = msg.slice(5).split(',')[0]
        } else if (msg.startsWith('/noreply '))
            this.interpret_cmd(client, msg.slice(9));
    }

    interpret_room_cmd(client: Client, room: Room, msg: string) {
        // ignore
    }


    install(server: Server) {
        this.ipcserver.installHandlers(server, { prefix: '/chat' });
    }
}

export const AltChatServer = new AltChat;