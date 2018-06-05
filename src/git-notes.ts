import cp = require('child_process');
import streamToPromise = require('stream-to-promise');

export module Notes {
    export class Note{
        commit: string = '';
        type: string = '';
        msg: string = '';
        reldate: string = '';
    }

    export let get = async () => {
        let proc = cp.spawn('git', [
            'log',
            '--pretty=format:%h|||%N|||%s|||%ar|',
        ]);
        let buff = await streamToPromise(proc.stdout);
        let strbuff = buff.toString().split('|\n');
        let arr = [];
        for (let commit of strbuff) {
            let c = commit.split('|||');
            arr.push({
                commit: c[0],
                type: c[1],
                msg: c[2],
                reldate: c[3]
            });
        }
        return arr.filter(note => note.msg != '');
    }
}
