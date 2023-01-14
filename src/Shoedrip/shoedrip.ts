import * as mongo from '../Backend/mongo';
import { Champ } from './Champ';

import { fchan } from '../Yotsuba/fchan';

import { snooze } from '../Website/utils';
import { BattleURL } from '../Backend/CringeCompilation';
import { BattleAvatarNumbers } from './dexdata';
import { IPCServer } from '../Website/DogarsIPCServer';
import { localclient } from '../mememons';

export let champ: Champ = new Champ();
export let cthread: { no?: number, tim?: number } = {};

let getCurrentThread = async () => {
    let catalog = await fchan.getBoard('vp');
    let derp_no = 0;
    let derp: fchan.OP = new fchan.OP({});
    let found = false;
    catalog.forEach(page => {
        page.threads!.forEach(t => {
            if ((t.com && t.com.toLowerCase().indexOf('dogars.org') != -1 ||
                t.sub && t.sub.toLowerCase().indexOf('showderp') != -1) &&
                t.no > derp_no) {
                derp = t;
                derp_no = Math.max(t.no, derp_no);
                found = true;
            }
        });
    });
    if (!found)
        throw new Error("Couldn't find a suitable thread");
    return derp.getThread();
}

let getCurrentChamp = async (thread: fchan.Thread) => {
    let derp_no = 0;
    let champ = <Champ>{
        avatar: '166',
    };
    for (let i = thread.posts!.length - 1; i != 0; --i) {
        if (!thread.posts![i].trip)
            continue;
        if (!thread.posts![i].com)
            continue;
        let content = thread.posts![i].com!
            .replace(/<(?:.|\n)*?>/gm, '')
            .replace(/<wbr>/gm, '');
        let matches;
        const psreg = /https?:\/\/?play.pokemonshowdown.com\/battle-(.+)/g;
        const dsreg = /https?:\/\/play\.dogars\.ga\/battle-(.+)/g;
        if ((matches = content.match(dsreg)) ||
            (matches = content.match(psreg))) {
            let curtime = ~~(+new Date() / 1000);
            champ = <Champ>{
                name: thread.posts![i].name,
                trip: thread.posts![i].trip,
                last_active: thread.posts![i].time,
                avatar: '166'
            };
            champ.active = curtime - champ.last_active < 15 * 60;
            /*
              Dead hours
             */
            champ.deaddrip = curtime - champ.last_active < 120 * 60;
            champ.current_battle = matches[0] as BattleURL;
            if (champ.current_battle[0] != 'h')
                champ.current_battle = `https://${champ.current_battle}` as BattleURL;
            return champ;
        }
    }
    return champ;
}

let oldid: number = 0;

function timeOutPromise<T>(prom: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([prom, new Promise<T>((res, rej) => setTimeout(rej, timeout, 'Timed out'))]);
}

export let monitorPlayer = (champ: Champ) => {
    console.log('monitor request')
    if (!champ.current_battle) {
        console.log('Champ not currently in battle')
        return;
    }
    const matches = champ.current_battle.match(/battle(-.+)/g);
    const [format, ids, invite] = matches![0].split('-').slice(1)
    const id = +ids;
    if (oldid && id <= oldid) {
        console.log('new battle is older or the same')
        return;
    }
    oldid = id;
    console.log(`start monitoring ${id}`);
    IPCServer.askMonitor();
    localclient && localclient.monitor(champ);
}

export let shoestart = async () => {
    while (true) {
        try {
            let thread = await timeOutPromise(getCurrentThread(), 30000);
            champ = await timeOutPromise(getCurrentChamp(thread), 30000);
            cthread = { no: thread.id, tim: thread.posts![0].tim! };
            if (champ.active) {
                monitorPlayer(champ);
            }
            if (champ.active) {
                let dbchamp = await mongo.ChampsCollection.findOne({ trip: champ.trip });
                champ.avatar = '166';
                if (dbchamp) {
                    champ.avatar = dbchamp.avatar!;
                }
                if (champ.avatar in BattleAvatarNumbers)
                    champ.avatar = BattleAvatarNumbers[champ.avatar as keyof typeof BattleAvatarNumbers];
            }
        }
        catch (e) {
            console.log(e);
        }
        await snooze(1000 * 60);
    }
}
