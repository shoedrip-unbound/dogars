import "reflect-metadata"
import fs = require('fs');
import cp = require('child_process');
import tripcode = require('tripcode');
import mustache = require('mustache');
import mkdirp = require('mkdirp');
import mv = require('mv');
import { pokeUtils } from './poke-utils';
import * as db from './mongo';
import { getSetOfTheDay, extend, sendTemplate, getCookieData, render, genericData, toId, decompose } from './utils';
import * as Notes from './git-notes';
import { emotionmap } from './emotions';
import { logger } from './logger';

import cookieParser = require('cookie-parser');
import bodyParser = require('body-parser');
import multer = require('multer');
import * as express from 'express';
import compression = require('compression');
import url = require('url');
import { NextFunction, RequestHandlerParams } from 'express-serve-static-core';
import { request } from 'websocket';
import { Request } from './dogars-request';

let upload = multer({ dest: '/tmp' });
export let router = express();
let apiai = require('apiai');

import { settings } from './settings';
import { Replay } from './entities/Replay';
import { Sets } from './entities/Sets';
let bot = apiai(settings.botkey);

router.set('env', 'production');
router.use(bodyParser.json());
router.use(bodyParser.urlencoded({ extended: true }));
router.use(cookieParser());
router.use(compression());

router.use(express.static(settings.ressources + '/public', { lastModified: true }));

let redirect = (res: express.Response, url: string, timeout = 0) => {
    if (timeout === 0) {
        res.redirect(url);
        res.end();
    }
    else
        res.set({ 'Refresh': timeout + '; url=' + url });
}

router.use((req: Request, res: express.Response, n: NextFunction) => {
    req["defaultTemplate"] = req.path.substr(1).split('/')[0];
    if (req["defaultTemplate"] == '')
        req["defaultTemplate"] = 'index';
    n();
});

router.get("/", async (request: Request, response: express.Response, n: NextFunction) => {
    try {
        request["data"] = await getSetOfTheDay();
        n();
    } catch (e) {
        console.log(e);
    }
});

router.get("/all", async (request: Request, response: express.Response, n: NextFunction) => {
    let spp = 15; //request.query.spp || 10;
    let npages = ~~(db.total / spp) + +((db.total % spp) != 0);
    let page = request.query.page || 0;
    page = ~~page;
    let setsc = await db.SetsCollection.find().sort({ id: -1 }).skip(spp * page).limit(spp);
    let sets = await setsc.map(pokeUtils.formatSetFromRow).toArray();
    let data = extend({ sets: sets }, { display_pages: true, current_page: ~~page + 1, npages: npages, lastpage: npages - 1 });
    if (page > 0) {
        data.prev = ~~page - 1;
        data.has_prev = true;
    }
    if (page + 1 < npages)
        data.next = ~~page + 1;
    request["data"] = data;
    n();
});

router.get("/import", (request, response, n: NextFunction) => {
    n();
});

router.get("/thanks", (request, response) => {
    redirect(response, '/', 2);
    response.end();
});

router.post("/update/:id", async (request, response, next) => {
    try {
        let fun = request.body.action == "Delete" ? db.deleteSet : db.updateSet;
        await fun(+request.params.id, request.body.trip, request.body);
        redirect(response, '/set/' + request.params.id);
    } catch (e) {
        logger.log(0, "Rejecting modifications to set", request.params.id);
        e = e.replace(/\|\|/g, '\n');
        e = e.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');
        redirect(response, '/import', 10);
        sendTemplate(request, response, 'reject', { reason: e });
    }
});

router.post("/add", async (request, response) => {
    try {
        let info = await db.createNewSet(request.body);
        logger.log(0, "Added a new set...");
        redirect(response, '/set/' + info.id);
    } catch (e) {
        logger.log(0, "Rejecting new set...");
        try {
            e = e || '';
            e = e.replace(/\|\|/g, '\n');
            e = e.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2');
            redirect(response, '/import', 10);
            if (e == '')
                e = 'Unknown reasons';
        } catch (e) {
            e = 'Unknown reasons';
        }
        sendTemplate(request, response, 'reject', { reason: e });
    }
});

router.post("/trip", (request, response) => {
    response.send(tripcode(request.body.v));
    response.end();
});

router.get("/random", async (request, response) => {
    let ranset = await db.getRandomSet();
    redirect(response, '/set/' + ranset[0].id);
});

router.post("/search", async (request, response) => {
    try {
        Object.keys(request.body)
            .filter(attr => request.body[attr] === '')
            .forEach(attr => { delete request.body[attr] });
        if (request.body.q) {
            let matching = ['name', 'item', 'species', ...[1, 2, 3, 4].map(e => `move_${e}`)]
            let csets = await db.SetsCollection.find({
                $or: matching.map(k => {
                    return { [k]: new RegExp(toId(request.query.q), 'i') };
            })});
            let sets = await csets.map(pokeUtils.formatSetFromRow).toArray();
            sendTemplate(request, response, 'all', { sets });
        } else { // Advanced search
            let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
                'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
                'move_1', 'move_2', 'move_3', 'move_4', 'hp_ev', 'atk_ev', 'def_ev',
                'spa_ev', 'spd_ev', 'spe_ev', 'hp_iv', 'atk_iv', 'def_iv', 'spa_iv',
                'spd_iv', 'spe_iv', 'description'];
            Object.keys(request.body)
                .filter(v => !data.includes(v))
                .forEach(attr => { delete request.body[attr] });
            if (request.body == {}) {
                sendTemplate(request, response, 'all', { sets: [] });
            } else {
                let csets = await db.SetsCollection.find({
                    $and: decompose(request.body).map(k => {
                        let prop = Object.keys(k)[0];
                        k[prop] = new RegExp(toId(k[prop]), 'i');
                        return k;
                    })});
                let sets = await csets.map(pokeUtils.formatSetFromRow).toArray();
                sendTemplate(request, response, 'all', { sets });
            }
        }
    } catch (e) {
        //console.log(e);
    }
});

router.get("/search", async (request: Request, response, n) => {
    if (request.query.q) {
        let matching = ['name', 'item', 'species', ...[1, 2, 3, 4].map(e => `move_${e}`)]
        let csets = await db.SetsCollection.find({
            $or: matching.map(k => {
                return { [k]: new RegExp(toId(request.query.q), 'i') };
        })});
        let sets = await csets.map(pokeUtils.formatSetFromRow).toArray();
        request['data'] = { sets }
        request["defaultTemplate"] = 'all';
    }
    else
        request["defaultTemplate"] = 'search';
    n();
});

let repl = async (request: express.Request, response: express.Response, manual: boolean, template: string, aname: string) => {
    let replays = await db.ReplaysCollection.find({ manual: +manual }).sort({ id: -1 }).toArray();
    let data = {
        [aname]: replays,
        'error': request.query.fail
    }
    sendTemplate(request, response, template, data);
}

router.get("/replays", async (request, response, n) => {
    await repl(request, response, true, 'replays', 'mreplays');
});

router.get("/replays/auto", async (request, response, n) => {
    await repl(request, response, false, 'replaysa', 'areplays');
});

router.get("/replays/add/:id", (request, response) => {
    let data = { id: request.params.id };
    sendTemplate(request, response, 'addrset', data);
});

router.post("/replays/add/:id", async (request, response) => {
    let id = request.body.set.match(/https?:\/\/dogars\.ml\/set\/([0-9]+)/)[1];
    if (!id) {
        redirect(response, '/replays', 5);
        sendTemplate(request, response, 'genreject', { reason: 'Your submission was rejected because the URL was wrong' });
        return;
    }
    let set = await db.SetsCollection.findOne({ id });
    if (!set) {
        redirect(response, '/replays', 5);
        sendTemplate(request, response, 'genreject', { reason: 'Your submission was rejected because the URL was wrong' });
        return;
    }
    await db.ReplaysCollection.updateOne({ id: request.params.id }, {
        $push: { sets: set }
    });
    redirect(response, '/replays');
});

router.post("/replays", async (request, response) => {
    if (/https?:\/\/replay.pokemonshowdown.com\/(.*)-[0-9]*/.test(request.body.link)) {
        let repl = new Replay(request.body.link,
            request.body.description, '', '', true);
        await db.ReplaysCollection.insertOne(repl);
        redirect(response, '/replays');
    } else {
        redirect(response, '/replays?fail=true');
    }
});

router.get("/fame", async (request: Request, response: express.Response, n) => {
    request["data"] = await db.SetsCollection.find({ has_custom: 1 }).toArray();
    request["data"] = { sets: request["data"].map(pokeUtils.formatSetFromRow) };
    n();
});

router.post("/lillie", async (request, response, n) => {
    try {
        //hack
        request.headers.cookie = request.body.cook;
        let data = getCookieData(request, response);
        if (!data.talkSession || !request.body.message) {
            response.send(JSON.stringify({}));
            response.end();
            return;
        }
        let req = bot.textRequest(request.body.message, {
            sessionId: data.talkSession
        });
        req.on('response', (r: any) => {
            let output = extend(r.result, {
                emotion: emotionmap[r.result.action] || ''
            });
            response.send(JSON.stringify(output));
            response.end();
        });
        req.on('error', (r: any) => {
            console.log('ERROR;');
            console.log(r);
            response.send(JSON.stringify({}));
            response.end();
        });
        req.end();
    } catch (e) {
        console.log(e);
    }

});

router.get("/champs", async (request: Request, response: express.Response, n) => {
    let champs = await db.ChampsCollection.find().toArray();
    request["data"] = { champs };
    n();
});

router.get("/suggest/:type", async (request, response) => {
    let data = {};
    if (request.params.type == 'banner') {
        sendTemplate(request, response, 'suggest-banner');
    } else if (/^\d+$/.test(request.params.type)) {
        let set = await db.SetsCollection.findOne(request.params.type);
        if (!set) {
            redirect(response, '/');
            return;
        }
        set = pokeUtils.formatSetFromRow(set);
        sendTemplate(request, response, 'suggest-set', set);
    }
});

router.post("/suggest", upload.single('sugg'), (request, response, next) => {
    if (!request.file)
        return next();
    let saveToDir = (dir: string) => {
        fs.access(dir, (err) => {
            if (err)
                mkdirp.sync(dir);
            fs.readdir(dir, (e, f) => {
                if (e)
                    throw e;
                mv(request.file.path, dir + '/' + f.length + '-' + request.file.originalname, { mkdirp: true }, () => { });
            });
        });
    }

    if (request.body.type == 'banner') {
        logger.log(0, "Added a banner suggestion...");
        saveToDir('./ban-submission');
    } else if (/^\d+$/.test(request.body.type)) {
        logger.log(0, "Added a new set image suggestion...");
        saveToDir('./sets/' + request.body.type);
    }
    redirect(response, '/thanks');
});

router.get("/set/:id", async (request: Request, response: express.Response, n) => {
    let set = await db.SetsCollection.findOne({ id: +request.params.id });
    if (!set) {
        redirect(response, '/');
        return;
    }
    request['data'] = pokeUtils.formatSetFromRow(set);
    n();
});

let mynotes: Notes.Note[];

router.get("/changelog", async (request: Request, response: express.Response, n) => {
    try {
        if (!mynotes) {
            mynotes = await Notes.get(); // [{commit:, msg:}, ...]
            mynotes = mynotes.filter(item => item.type)
                .map(item => extend(item, { type: item.type.indexOf('bug') == 0 ? 'bug' : 'plus-square', commit: item.commit.substr(0, 6) }));
        }
        request['data'] = { notes: mynotes };
    } catch (e) {
        console.log(e);
    }
    n();
});

router.get("/contact", async (request: Request, response: express.Response, n) => {
    n();
});

let spawn = require('child_process').spawnSync;
router.post("/contact", async (request, response, next) => {
    try {
        let inputData = "Subject: " + request.body.sub + "\n";
        inputData += 'Content-Type: text/plain; charset="utf-8"\n';
        inputData += request.body.com + '\n';

        let child = spawn('sendmail', [settings.admin_mail], {
            input: inputData
        });

        redirect(response, '/thanks');
    } catch (e) {
        response.status(500);
        response.send(render('404', genericData(request, response)));
        response.end();
    }
});

router.use(async (req: Request, res: express.Response, n: NextFunction) => {
    sendTemplate(req, res, req["defaultTemplate"]);
});

router.use(function (request, response) {
    response.status(404);
    response.send(render('404', genericData(request, response)));
    response.end();
});

router.use(function (error: string, request: express.Request, response: express.Response, next: NextFunction) {
    console.log(error);
    response.status(500);
    response.send(render('500', genericData(request, response)));
    response.end();
});
