import { toId } from "../Website/utils";

export type PokemonIdent = string;
export type Username = string;
export type Ability = string;
export type Effect = string;
export type Stat = string;
export type Move = string;

export type GlobalEvents = {
    updateuser: ['updateuser', Username, string],
    queryresponse: ['queryresponse', string, string?, string?],
    popup: ['popup', string],
    formats: ['formats', string],
    challstr: ['challstr', string],
    updatesearch: ['updatesearch', string],
};

export type BattleEvents = {
    '-ability': ['-ability', PokemonIdent, Ability],
    '-activate': ['-activate', PokemonIdent, Effect],
    '-boost': ['-boost', PokemonIdent, Stat, string],
    'c': ['c', Username, string],
    '-damage': ['-damage', PokemonIdent, string, string?],
    '-singleturn': ['-singleturn', PokemonIdent, Move],
    'gen': ['gen', string],
    '-heal': ['-heal', PokemonIdent, string],
    'cant': ['cant', PokemonIdent, string],
    '-fail': ['-fail', PokemonIdent, string, string?],
    'faint': ['faint', string],
    'gametype': ['gametype', string],
    '-mega': ['-mega', PokemonIdent, string, string],
    '-miss': ['-miss', PokemonIdent, PokemonIdent],
    '-immune': ['-immune', PokemonIdent],
    'inactive': ['inactive', string],
    '-item': ['-item', PokemonIdent, string, string],
    'j': ['j', Username],
    'l': ['l', Username],
    'win': ['win', Username],
    'move': ['move', PokemonIdent, Move, PokemonIdent, string?],
    '-unboost': ['-unboost', PokemonIdent, Stat, string],
    'poke': ['poke', string, string],
    'rated': ['rated'],
    'request': ['request', string],
    'player': ['player', 'p1' | 'p2', Username, string],
    'raw': ['raw', string],
    '-resisted': ['-resisted', PokemonIdent],
    '-status': ['-status', PokemonIdent, string, string?],
    '-crit': ['-crit', PokemonIdent],
    'switch': ['switch', PokemonIdent, string],
    'teamsize': ['teamsize', string],
    'savereplay': ['savereplay'],
    'turn': ['turn', string]
}

export type BattleEventsName = keyof BattleEvents;
export type BattleEventsType = BattleEvents[BattleEventsName];

export type GlobalEventsName = keyof GlobalEvents;
export type GlobalEventsType = GlobalEvents[GlobalEventsName];

export type PSEvent = BattleEvents & GlobalEvents;
export type EventsName = GlobalEventsName | BattleEventsName;
export type PSEventType = PSEvent[EventsName];

export abstract class PSRequest<T extends GlobalEventsType, R> {
    T!: T;
    abstract isResponse(m: GlobalEventsType | BattleEventsType): boolean;
    abstract buildResponse(m: T): R;
    abstract toString(): string;
}

export abstract class PSRoomRequest<T extends GlobalEventsType, R> extends PSRequest<T, R> {
    room: string = '';
}

export class PSSaveBattleRequest extends PSRoomRequest<['queryresponse', string, string?, string?], {id: string, log: string}> {
    constructor(room: string) {
        super();
        this.room = room;
    }

    isResponse(m: BattleEventsType): boolean {
        return m[0] == 'savereplay';
    }

    buildResponse(m: this['T']) {
        return JSON.parse(m[1]);
    }

    toString(): string {
        return `${this.room}|/savereplay`;
    }
}

export class PSCheckTeamRequest extends PSRequest<['popup', string], {failed: boolean, reasons: string[]}> {
    format: string;
    constructor(format: string) {
        super();
        this.format = format;
    }

    isResponse(m: this['T']): boolean {
        return m[1].indexOf('Your team') == 0;
    }

    buildResponse(m: this['T']) {
        let res = m[1].split('||');
        let failed = res[0].indexOf('rejected') != -1;
        let reasons = res.slice(2);
        return { failed, reasons };
    }

    toString(): string {
        return `|/vtm ${this.format}`;
    }
}

export type UserDetails = {
    userid: string,
    avatar: string | number,
    group: string,
    rooms: { [k: string]: { [key in 'p1' | 'p2']: string } } | false
};

export class PSUserDetails extends PSRequest<['queryresponse', 'userdetails', string?, string?], UserDetails> {
    user: string;
    usern: string;
    constructor(user: string) {
        super();
        this.user = user;
        this.usern = toId(user);
    }

    isResponse(m: this['T']): boolean {
        let copy = m.slice();
        let b = m[0] == 'queryresponse' && m[1] == 'userdetails';
        copy.splice(0, 2);
        let js = copy.join('|');
        let data: UserDetails = JSON.parse(js);
        return data.userid == this.usern;
    }

    buildResponse(m: this['T']): UserDetails {
        let copy = m.slice();
        let b = m[0] == 'queryresponse' && m[1] == 'userdetails';
        copy.splice(0, 2);
        let js = copy.join('|');
        let data: UserDetails = JSON.parse(js);
        return data;
    }

    toString(): string {
        return `|/cmd userdetails ${this.usern}`;
    }
}

export class MoveOrder {
    move = '';
    id = '';
    pp = 0;
    maxpp = 0;
    disabled = false;
    target = 'normal'
}

export class PokemonOrder {
    moves: MoveOrder[] = [];
    canMegaEvo = false;
}

let packetToMessage = <T extends (BattleEventsType | GlobalEventsType)>(d: string): T => {
    let s = d.split('|');
    s.shift();
    return s as T;
}

export let eventToPSBattleMessage = (me: MessageEvent): {
    room: string,
    events: BattleEventsType[]
} => {
    let data: string[] = me.data.split('\n');
    return {
        room: data.shift()!.substr(1),
        events: data.map(d => packetToMessage(d))
    }
}

export let eventToPSMessages = (me: MessageEvent): GlobalEventsType[] => {
    let data: string[] = me.data.split('\n');
    return data.map(d => packetToMessage(d));
}
