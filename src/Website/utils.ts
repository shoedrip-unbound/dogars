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

export let nameFilter = (inputName: string) => {
    let name = inputName + '';

    name = name.replace(
        /[^a-zA-Z0-9 /\\.~()<>^*%&=+$#_'?!"\u00A1-\u00BF\u00D7\u00F7\u02B9-\u0362\u2012-\u2027\u2030-\u205E\u2050-\u205F\u2190-\u23FA\u2500-\u2BD1\u2E80-\u32FF\u3400-\u9FFF\uF900-\uFAFF\uFE00-\uFE6F-]+/g,
        ''
    );

    name = name.replace(/[\u00a1\u2580-\u2590\u25A0\u25Ac\u25AE\u25B0\u2a0d\u534d\u5350]/g, '');

    if (name.includes('@') && name.includes('.')) return '';

    if (/[a-z0-9]\.(com|net|org|us|uk|co|gg|tk|ml|gq|ga|xxx|download|stream)\b/i.test(name)) name = name.replace(/\./g, '');

    const nameSymbols = name.replace(
        /[^\u00A1-\u00BF\u00D7\u00F7\u02B9-\u0362\u2012-\u2027\u2030-\u205E\u2050-\u205F\u2090-\u23FA\u2500-\u2BD1]+/g,
        ''
    );

    if (
        nameSymbols.length > 4 ||
        /[^a-z0-9][a-z0-9][^a-z0-9]/.test(name.toLowerCase() + ' ') || /[\u00ae\u00a9].*[a-zA-Z0-9]/.test(name)
    ) {
        name = name.replace(
            /[\u00A1-\u00BF\u00D7\u00F7\u02B9-\u0362\u2012-\u2027\u2030-\u205E\u2050-\u205F\u2190-\u23FA\u2500-\u2BD1\u2E80-\u32FF\u3400-\u9FFF\uF900-\uFAFF\uFE00-\uFE6F]+/g,
            ''
        ).replace(/[^A-Za-z0-9]{2,}/g, ' ').trim();
    }
    name = name.replace(/^[^A-Za-z0-9]+/, "");
    name = name.replace(/@/g, "");

    // cut name length down to 18 chars
    if (/[A-Za-z0-9]/.test(name.slice(18))) {
        name = name.replace(/[^A-Za-z0-9]+/g, "");
    } else {
        name = name.slice(0, 18);
    }

    return name;
};

console.log('stopped evaluating utils')
