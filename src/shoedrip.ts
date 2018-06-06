import * as request from 'request-promise-native';
import { BattleMonitor } from './BattleMonitor';
import { db } from './db';
import { logger } from './logger';
import { Champ } from './Champ';
import { fchan } from './fchan';

export let champ: Champ = new Champ();

let max = (a: number, b: number) => a < b ? b : a;

let timeout = (prom: Promise<any>, timeout: number) => new Promise((res, rej) => {
    let id = setTimeout(rej, timeout);
    prom.then((x) => {
        clearTimeout(id);
        res(x);
    }).catch(() => {
        clearTimeout(id);
        rej();
    });
});

let getCurrentThread = async () => {
    let catalog = await fchan.getBoard('vp');
    let derp_no = 0;
    let derp: fchan.OP = new fchan.OP({});
    let found = false;
    catalog.forEach(page => {
        page.threads!.forEach(t => {
            if (t.sub && t.sub.toLowerCase().indexOf('showderp') != -1 && t.no > derp_no) {
                derp = t;
                derp_no = max(t.no, derp_no);
                found = true;
            }
            if (t.com && t.com.toLowerCase().indexOf('dogars.ml') != -1 && t.no > derp_no) {
                derp = t;
                derp_no = max(t.no, derp_no);
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
        champ_name: '',
        champ_trip: '',
        champ_last_active: 0,
        champ_active: false,
        avatar: '166',
        champ_battle: '',
        showdown_name: ''
    };
    for (let i = thread.posts!.length - 1; i != 0; --i) {
        if (!thread.posts![i].trip)
            continue;
        let content = thread.posts![i].com!.replace(/<(?:.|\n)*?>/gm, '');
        let matches;
        if ((matches = content.match(/(https?:\/\/)?play.pokemonshowdown.com\/battle-(.*)-([0-9]*)/g))) {
            let curtime = ~~(+new Date() / 1000);
            champ = <Champ>{
                champ_name: thread.posts![i].name,
                champ_trip: thread.posts![i].trip,
                champ_last_active: thread.posts![i].time,
                avatar: '166',
                champ_battle: '',
                showdown_name: ''
            };
            champ.champ_active = curtime - champ.champ_last_active < 15 * 60;
			/*
			  Dead hours
			 */
            champ.deaddrip = curtime - champ.champ_last_active < 120 * 60;
            champ.champ_battle = matches[0];
            if (champ.champ_battle[0] != 'h')
                champ.champ_battle = 'http://' + champ.champ_battle;
            return champ;
        }
    }
    return champ;
}

let oldbattle: string = '';

// stolen from gist
// but leven(((shtein))) is actually garbage at detecting similar nicknames
let levenshtein = (a: string, b: string) => {
    let tmp;
    a = a || '';
    b = b || '';
    if (a.length === 0) { return b.length; }
    if (b.length === 0) { return a.length; }
    if (a.length > b.length) { tmp = a; a = b; b = tmp; }

    let i, j, res, alen = a.length, blen = b.length, row = Array(alen);
    for (i = 0; i <= alen; i++) { row[i] = i; }

    for (i = 1; i <= blen; i++) {
        res = i;
        for (j = 1; j <= alen; j++) {
            tmp = row[j - 1];
            row[j - 1] = res;
            res = b[i - 1] === a[j - 1] ? tmp : Math.min(tmp + 1, res + 1, row[j] + 1);
        }
    }
    return res;
}

let snooze = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export let shoestart = async () => {
    while (true) {
        try {
            let thread = await getCurrentThread();
            champ = await getCurrentChamp(thread);
            console.log('Current Thread is ', thread.id);
            console.log('Last champ is ', champ.champ_trip);

            if (champ.champ_battle != oldbattle && champ.champ_active) {
                oldbattle = champ.champ_battle;
                if (champ.champ_name != undefined && champ.champ_name != '') {
                    logger.log(0, `Champ has a name so we can monitor battle`);
                    let bm = new BattleMonitor(champ);
                    bm.monitor();
                } else {
                    logger.log(0, `Champ has no name so we can't monitor battle`);
                }
            }
            if (champ.champ_active) {
                let dbchamp = await db.getChampFromTrip(champ.champ_trip);
                champ.avatar = '166';
                if (dbchamp && dbchamp.length) {
                    champ.avatar = dbchamp[0].avatar!;
                }
            }
        }
        catch (e) {
            console.log('--------------------------------------------------------------------------------');
            console.log('An error occured while retrieving some data.\nSome features might now work properly\n Attempting again in a minute');
            console.log(e);
            console.log('--------------------------------------------------------------------------------');
        }
        await snooze(1000 * 60);
    }
}
