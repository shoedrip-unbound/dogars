import asyncify from 'callback-to-async-iterator';
import SockJS = require('sockjs-client');
import { Champ } from './Shoedrip/Champ';
import { BattleData } from './Showdown/BattleData';
import { BattleURL } from './Backend/CringeCompilation';
import { monitor } from './bot-utils';
import { Player } from './Showdown/Player';

export interface DogarsClient {
    registerChampResult(data: BattleData, won: boolean): Promise<void>;
    refresh(): Promise<Champ>;
    setbattle(url: BattleURL): Promise<void>;
    snap(): Promise<void>;
    prepareCringe(u: BattleURL): Promise<void>;
    closeCringe(): Promise<void>;
    monitor(champ: Champ): Promise<void>;
}

export class DogarsIPCClient implements DogarsClient {
    s!: WebSocket;
    message!: AsyncIterableIterator<IPCCmd>;

    onerror: (e: Parameters<NonNullable<WebSocket['onerror']>>[0]) => any = (e) => {};

    constructor(private player: Player) {
        this.player = player; // Unused yet, until I observe abuse
    }

    connect() {
        console.log("Attempting to connect to IPC server...");
        this.s = new SockJS('https://dogars.ga/ipc');
        let stream = asyncify(async (cb: (v: MessageEvent) => void) => {
            this.s.onmessage = message => cb(message)
        });

        let publish: (m: IPCCmd) => void;
        this.message = asyncify(async (cb: (v: IPCCmd) => void) => publish = m => cb(m));

        let inst = this;
        this.s.onerror = e => {
            inst.onerror(e);
        }

        (async () => {
            for await (let mess of stream) {
                let msg = JSON.parse(mess.data);
                console.log(msg);
                if (msg.id !== undefined) {
                    this.awaitingreplies[msg.id](msg.response);
                    delete this.awaitingreplies[msg.id.id];
                } else {
                    publish!(msg as IPCCmd);
                }
            }
        })();
        
        console.log("Attempting to connect to IPC server 2...");
        return new Promise<void>((r) => {
            this.s.onopen = () => {
                console.log("Connected!");
                r();
            };
        });
    }

    messageStream() {
        return this.message;
    }

    async monitor(champ: Champ) {
        monitor(champ, this.player, this);
    }


    send(t: Parameters<WebSocket['send']>[0]) {
        this.s.send(t);
    }

    awaitingreplies: ((fun: any) => void)[] = [];

    replyFor<T>(id: number) {
        return new Promise<T>((res, rej) => {
            this.awaitingreplies[id] = res;
        });
    }

    cmdn = 0;
    async command<T>(data: any) {
        console.log(data);
        data.id = this.cmdn++;
        this.send(JSON.stringify(data));
        return this.replyFor<T>(data.id);
    }

    async registerChampResult(data: BattleData, won: boolean) {
        return await this.command<void>({
            method: 'registerChampResult',
            args: [data, won]
        });
    }
    
    async refresh() {
        return await this.command<Champ>({
            method: 'refresh'
        });
    }
    
    async setbattle(url: BattleURL) {
        return await this.command<void>({
            method: 'setbattle',
            args: [url]
        });
    }

    async snap() {
        console.log("Sending snap command");
        return await this.command<void>({
            method: 'snap',
            args: []
        });
    }

    async prepareCringe(u: BattleURL) {
        console.log("Preparing cringe command");
        return await this.command<void>({
            method: 'prepare',
            args: [u]
        });
    }

    async closeCringe() {
        return await this.command<void>({
            method: 'close'
        });
    }
}

export interface MonitorCmd {
    command: 'monitor';
    champ: Champ;
}

export interface AckCmd {
    command: 'ack';
}

export type IPCCmd = MonitorCmd | AckCmd;
