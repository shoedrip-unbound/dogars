import SockJS = require('sockjs-client');
import { EventEmitter } from 'events';

export class SockJSP extends EventEmitter {
    connection: WebSocket;
    onopen?: () => void;
    messagequeue: MessageEvent[] = [];
    rpromres?: (ret: MessageEvent | PromiseLike<MessageEvent>) => void;
    rrejres?: (reason?: any) => void;
    ready: boolean = false;

    constructor(url: string, opts?: SockJS.Options) {
        super();
        this.connection = new SockJS(url, opts);
        this.connection.onopen = () => this.onopen && this.onopen();
        this.connection.onmessage = ev => this.emit('message', ev);
        this.connection.onclose = () => {
            this.ready = false;
            if (this.rrejres)
               this.rrejres(new Error('Connection closed unexpectedly'));
        };
    }

    open(): Promise<void> {
        if (this.ready)
            return new Promise<void>(res => res());
        return new Promise((res, rej) => {
            this.onopen = res;
            this.ready = true;
        });
    }

    send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
        this.connection.send(data);
    }

    close(code?: number, reason?: string): void {
        this.connection.close(code, reason);
    }
}