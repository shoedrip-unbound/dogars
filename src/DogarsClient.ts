import asyncify from 'callback-to-async-iterator';
import SockJS = require('sockjs-client');
import { Champ } from './Shoedrip/Champ';
import { settings } from './Backend/settings';
import { BattleData } from './Showdown/BattleData';
import { BattleURL } from './Backend/CringeCompilation';
import { snooze } from './Website/utils';

export interface DogarsClient {
    registerChampResult(data: BattleData, won: boolean): Promise<void>;
    refresh(): Promise<Champ>;
    setbattle(url: BattleURL): Promise<void>;
    snap(): Promise<void>;
    prepareCringe(u: BattleURL): Promise<void>;
    closeCringe(): Promise<void>;
    monitor(): Promise<void>;
}

export class DogarsIPCClient implements DogarsClient {
    pass: string;
    s!: WebSocket;
    message!: AsyncIterableIterator<IPCCmd>;

    onerror: (e: Parameters<NonNullable<WebSocket['onerror']>>[0]) => any = (e) => { };

    constructor(pass: string) {
        this.pass = pass; // Unused yet, until I observe abuse
    }

    connect() {
        console.log("Attempting to connect to IPC server...");
        this.s = new SockJS('https://dogars.ga/ipc');

        console.log("Attempting to connect to IPC server 2...");
        return new Promise((r) => {
            this.s.onopen = () => {
                console.log("Connected!");
                r();
            };
        });
    }

    monitor(): Promise<void> {
        throw new Error("Method not implemented.");
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

export let DogarsClient = new DogarsIPCClient(settings.admin_pass);

const connectionErrorHandler = async (e: Event) => {
    console.log("A connection error occured, attempting to reconnect in 5 seconds...");
    await snooze(5000);
    await DogarsClient.connect();
};

DogarsClient.onerror = connectionErrorHandler;