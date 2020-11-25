console.log('started evaluating utils')

import fs = require('fs');
import { settings } from '../Backend/settings';

export let banners = fs.readdirSync(settings.ressources + '/public/ban');

export const fileCache: { [idx: string]: string } = {};

fs.watch(`${settings.ressources}/public/ban`, { persistent: false }, (e, n) => {
    fs.readdir(`${settings.ressources}/public/ban`, (e, banfiles) => {
        banners = banfiles;
    });
})

export let levenshtein = (a: string, b: string) => {
    var tmp;
    a = a || '';
    b = b || '';
    if (a.length === 0) { return b.length; }
    if (b.length === 0) { return a.length; }
    if (a.length > b.length) { tmp = a; a = b; b = tmp; }

    var i, j, res, alen = a.length, blen = b.length, row = Array(alen);
    for (i = 0; i <= alen; i++) { row[i] = i; }

    for (i = 1; i <= blen; i++) {
        res = i;
        for (j = 1; j <= alen; j++) {
            tmp = row[j - 1];
            row[j - 1] = res;
            res = b[i - 1] === a[j - 1] ? tmp : Math.min(tmp + 1,
                Math.min(res + 1, row[j] + 1));
        }
    }
    return res;
}

export let decompose = <T>(obj: T) => {
    let ret: Partial<T>[] = [];
    for (let j in obj) {
        let i: keyof T = j as any;
        let k : {[x in keyof T]: T[x]} = { [i]: obj[i] } as any;
        ret.push(k);
    }
    return ret;
}

export let toId = (text: string | number | { id?: string, userid?: string } | undefined | boolean | null) => {
    // this is a duplicate of Dex.getId, for performance reasons
    if (text && typeof text == "object") {
        if (text.id) {
            text = text.id;
        } else if (text.userid) {
            text = text.userid;
        }
    }
    if (typeof text !== 'string' && typeof text !== 'number') return '';
    return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export let snooze = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export let clamp = (min: number, val: number, max: number) => {
    if (val < min)
        return min;
    if (val > max)
        return max;
    return val;
}
console.log('stopped evaluating utils')
