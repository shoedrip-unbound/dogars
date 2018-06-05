import { PSConnection } from "./PSConnection";
import { EventEmitter } from "events";
import { PSMessage, PSBattleMessage } from "./PSMessage";
import { utils } from "./utils";

export class PSRoom {
    con: PSConnection;
    room: string;
    messqueu: PSBattleMessage[] = [];

    res?: { filter?: any, res: (ev: PSBattleMessage) => void} ;

    constructor(conn: PSConnection, room: string) {
        this.con = conn;
        this.room = room;
    }

    recv(ev: PSBattleMessage) {
        if(this.res && (this.res.filter === undefined || utils.match(ev, this.res.filter))) {
            this.res.res(ev);
            this.res = undefined;
        }
        else
            this.messqueu.push(ev);
    }

    async read(filter?: any) : Promise<PSBattleMessage> {
        return new Promise<PSBattleMessage>((res, rej) => {
            if(this.messqueu.length >= 1) {
                let idx = this.messqueu.findIndex(m => filter === undefined || utils.match(m, filter));
                return res(this.messqueu.splice(idx, 1)[0]!);
            }
            this.res = {filter, res};
        });
    }

    send(data: string) {
		this.con.send(this.room + '|' + data);
    }
}