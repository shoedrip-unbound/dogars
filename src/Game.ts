import { PSConnection } from "./PSConnection";
import { PSRoom } from "./PSRoom";
import { Player } from "./Player";
import { Sets } from "./Memes";

export class Game {
    room: string = '';
    con: PSConnection;
    p1?: Player;
    p2?: Player;
    myTeam?: Property<any[]>;

    constructor(con : PSConnection, room: string) {
        this.room = room;
        this.con = con;
    }

    getTeam() {
        return this.myTeam!.value;
    }

    toString() {
        return this.room;
    }
}