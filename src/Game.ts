import { PSConnection } from "./PSConnection";
import { PSRoom } from "./PSRoom";
import { Player } from "./Player";

export class Game {
    room: string = '';
    con: PSConnection;
    p1?: Player;
    p2?: Player;
    myTeam?: any[];

    constructor(con : PSConnection, room: string) {
        this.room = room;
        this.con = con;
    }

    getTeam() {
        return this.myTeam!;
    }

    toString() {
        return this.room;
    }
}