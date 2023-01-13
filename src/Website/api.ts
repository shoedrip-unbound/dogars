import fs = require('fs');

import * as express from 'express';
import bodyParser = require('body-parser');
import compression = require('compression');
import { Collection, CollectionAggregationOptions } from 'mongodb';
import cp = require('child_process');
import tripcode = require('tripcode');

import { settings } from '../Backend/settings';
import * as db from '../Backend/mongo';
import { Replay } from '../Backend/Models/Replay';
import { decompose, banners } from './utils';
import { champ, cthread } from '../Shoedrip/shoedrip';
import { Champ } from '../Backend/Models/Champ';
import { availableFormats } from '../Showdown/Dex';
import type { DBSet } from '../Backend/Models/Sets';
import requestPromise = require('request-promise-native');
import { Response } from 'request';
import request = require('request');

export let api = express();
api.set('env', 'production');
api.use(bodyParser.json());
api.use(bodyParser.urlencoded({ extended: true }));
api.use(compression());

let ranset: DBSet | null = null;

setInterval(() => { ranset = null }, 1000 * 3600 * 24);

export const getSetOfTheDay = async () => {
    if (ranset)
        return ranset as DBSet;
    let a = new Date();
    let seed = (((a.getMonth() + 1) * (a.getDay() + 1) * (a.getFullYear()) + 1));
    ranset = (await db.getRandomSet(seed))[0];
    return ranset;
}

async function facet<T>(coll: Collection<T>, obj: Record<string, object[]>) {
    let ret = {} as Record<string, any>;
    await Promise.all(Object.entries(obj).map(async ([k, v]) => {
        ret[k] = await coll.aggregate(v, {}).toArray();
    }));
    return ret;
}

async function paginate<T>(coll: Collection<T>, prop: db.AggregationPipelineStage<T>[], pspp: number, ppage: number): Promise<[number, T[]]> {
    if (ppage <= 0)
        ppage = 1;
    if (pspp <= 0)
        pspp = 15;
    let spp = pspp || 15;
    spp > 100 && (spp = 100);
    let page = ppage || 1;

    let res = await facet(coll, {
        metadata: [...(prop as object[]), { $count: "total" }],
        data: [...(prop as object[]), { $skip: (page - 1) * spp }, { $limit: spp }]
    });
    if (!res.metadata) return [0, []];
    return [res.metadata.length ? res.metadata[0].total : 0, res.data];
}

api.get('/sets', async (request, response) => {
    let res = await paginate(db.SetsCollection, [{ $sort: { id: -1 } }], +request.query.spp, +request.query.page);
    response.json(res);
});

api.get('/champ', async (_, res) => {
    res.json(champ);
});

api.get('/thread', async (_, res) => {
    res.json(cthread);
});

api.get('/fame', async (request, response) => {
    let res = await paginate(db.SetsCollection, [{ $match: { has_custom: 1 } }, { $sort: { id: 1 } }], +request.query.spp, +request.query.page);
    response.json(res);
});

api.post('/sets', async (request, response) => {
    try {
        let set = await db.createNewSet(request.body);
        response.json(set.id);
    } catch (e) {
        response.status(400).json(e);
    }
});

api.get('/sets/:id', async (request, response) => {
    try {
        let result = await db.SetsCollection.findOne({ id: +request.params.id });
        if (!result)
            response.status(404).end();
        else
            response.json(result);
    } catch (e) {
        response.status(400).json(e);
    }
});

api.put('/sets/:id', async (request, response) => {
    try {
        let result = await db.updateSet(+request.params.id,
            request.body.trip, request.body);
        response.json({ success: true });
    } catch (e) {
        response.status(400).json(e);
    }
});

api.delete('/sets/:id', async (request, response) => {
    try {
        await db.deleteSet(+request.params.id, request.body.trip);
        response.json({ success: true });
    } catch (e) {
        response.status(400).json(e);
    }
});

api.get('/champs', async (req, res) => {
    let allowed = ['wins', 'loses', 'elo', 'total', 'winrate', 'last_seen'];
    let sort = allowed[0];
    if (allowed.includes(req.query.sort))
        sort = req.query.sort;
    let reversed = req.query.reverse == 'true';
    let params: db.AggregationPipelineStage<Champ>[] = [{
        $addFields: {
            total: {
                $add: ['$wins', '$loses']
            },
            winrate: { $divide: ['$wins', { $sum: ['$wins', '$loses'] }] },
        }
    }, {
        $sort: {
            [sort]: reversed ? 1 : -1
        }
    }];
    if (req.query.name)
        params.unshift({
            $match: { name: new RegExp(req.query.name) }
        });
    let r = await paginate(db.ChampsCollection, params, +req.query.spp, +req.query.page);
    res.json(r);
});

api.get('/replays', async (req, res) => {
    let r = await paginate(db.ReplaysCollection,
        [{ $match: { manual: 1 } }, { $sort: { date: -1 } }],
        +req.query.spp,
        +req.query.page);
    res.json(r);
});

api.get('/replays/auto', async (req, res) => {
    let r = await paginate(db.ReplaysCollection,
        [{ $match: { manual: 0 } }, { $sort: { date: -1 } }],
        +req.query.spp,
        +req.query.page);
    res.json(r);
});

api.post('/replays', async (req, res) => {
    if (/https?:\/\/replay.pokemonshowdown.com\/(.*)-[0-9]*/.test(req.body.link)) {
        let repl = new Replay(req.body.link,
            req.body.description, req.body.champ || '', req.body.trip || '', 1);
        await db.ReplaysCollection.insertOne(repl);
        console.log('added');
        res.json({});
    } else {
        res.status(400).json({});
    }
});

const commitstr = cp.spawnSync('git', ['-C', settings.ressources, 'log', `--pretty=format:%h%x00%ad%x00%s%x00%b%x00`]).stdout.toString();
const grouped = commitstr.split('\x00\n').map(s => s.split('\x00'));

let commits = grouped.map(g => {
    return {
        hash: g[0],
        date: g[1],
        subject: g[2] || '',
        message: g[3] || ''
    };
}).filter(m => !m.subject.toLowerCase().includes('merge'));

api.get('/changelog', (req, res) => {
    res.json(commits.slice(0, 20));
});

api.post('/contact', (req, res) => {
    try {
        let inputData = "Subject: " + req.body.sub + "\n";
        inputData += 'Content-Type: text/plain; charset="utf-8"\n';
        inputData += req.body.com + '\n';

        let child = cp.spawnSync('sendmail', [settings.admin_mail], {
            input: inputData
        });
        res.json({});
    } catch (e) {
        res.status(400).json(e);
    }
});

api.post("/trip", (request, response) => {
    response.json(tripcode(request.body.v));
});

api.get("/formats", (request, response) => {
    response.json(availableFormats);
});

api.get("/day", async (_, response) => {
    let ranset = await getSetOfTheDay();
    response.json(ranset);
});

api.get("/random", async (_, response) => {
    let ranset = await db.getRandomSet();
    response.json(ranset[0].id);
});

api.get("/ban", (_, res) => {
    let len = banners.length;
    res.json(banners[~~(Math.random() * len)]);
})

api.post("/action", async (req, res) => {
    const options: any = {
        method: 'POST',
        uri: 'https://play.pokemonshowdown.com/~~showdown/action.php',
        resolveWithFullResponse: true,
        form: {...req.body, ...req.query},
    };
    if (req.cookies['sid'])
        options.headers = {
            'Cookie': `sid=${req.cookies['sid']}`
        };
    const d: Response = await requestPromise(options);
    const sidcookie = d.headers['set-cookie']?.filter(e => e.startsWith('sid='))[0];
    if (sidcookie) {
        res.cookie('sid', sidcookie.match(/sid=(.*?);/)![1], {
            domain: 'play.dogars.org',
            httpOnly: false,
            secure: true,
            sameSite: 'None'
        });
    }
    res.send(d.body);
});

api.get("/action", async (req, res) => {
    const d = await requestPromise.get('https://play.pokemonshowdown.com/~~showdown/action.php', { 
        qs: req.query
    });
    res.send(d);
});

api.get("/search", async (request, response) => {
    let page = request.query.page || 1;
    page < 1 && (page = 1);
    let spp = request.query.spp || 15;
    spp < 1 && (spp = 15);
    spp > 100 && (spp = 100);
    let random = !!request.query.random;
    try {
        Object.keys(request.query)
            .filter(attr => request.query[attr] === '')
            .forEach(attr => { delete request.query[attr] });
        if (request.query.q) {
            let matching = ['name', 'item', 'species', ...[1, 2, 3, 4].map(e => `move_${e}`)];
            let results = await paginate(db.SetsCollection, [{
                $match: {
                    $or: matching.map(k => {
                        return { [k]: new RegExp(request.query.q, 'i') };
                    })
                }
            }, random ? { $sample: { size: 1 } } : { $sort: { id: 1 } }], spp, page);
            response.json(results);
        } else { // Advanced search
            const data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
                'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
                'move_1', 'move_2', 'move_3', 'move_4', 'description'] as const;
            type fields = typeof data[number];
            let query = request.query as { [k in fields]: string | number };
            const isint: {
                [k in fields]?: boolean
            } = {
                level: true,
                happiness: true,
            };
            (Object.keys(query) as fields[])
                .filter(v => !data.includes(v))
                .forEach(attr => { delete request.query[attr] });
            let results = await paginate(db.SetsCollection, [{
                $match: {
                    $and: decompose(query).map(k => {
                        let prop = Object.keys(k)[0] as fields;
                        return {
                            [prop]: isint[prop] ? +k[prop]! : new RegExp(k[prop] as string, 'i')
                        };
                    })
                }
            }, random ? { $sample: { size: 1 } } : { $sort: { id: 1 } }], spp, page);
            response.json(results);
        }
    } catch (e) {
        response.status(400).json(e);
    }
});

api.get('/custom/:id', async (req, res) => {
    let exts = ['png', 'jpg', 'gif'];
    let id = req.params.id;
    let file = '';
    for (let ext of exts) {
        file = `${settings.ressources}/public/sets/${id}.${ext}`;
        if (fs.existsSync(file))
            return res.sendFile(file);
    }
    res.status(404).end();
});

api.use(function (_, response) {
    response.status(404).end();
});
