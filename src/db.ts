import * as mysqlp from 'mysql-promise';
import * as fs from 'fs';
import * as request from 'request-promise-native';
import * as tripcode from 'tripcode';
import * as express from 'express';

import { pokeUtils } from './poke-utils';
import { logger } from './logger';
import { DBSet } from './DBSet';
import { BattleData } from './BattleData';
import { Sets, champs, replays, sets_in_replays } from './Memes';
import { ShowdownStat } from './ShowdownStats';
import { SuperSet } from './SuperSet';
import { settings } from './settings';

let c = mysqlp();
c.configure(settings.db);

let toId = (text: any) => {
    // this is a duplicate of Dex.getId, for performance reasons
    if (text && text.id) {
        text = text.id;
    } else if (text && text.userid) {
        text = text.userid;
    }
    if (typeof text !== 'string' && typeof text !== 'number') return '';
    return ('' + text).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export module db {
    export let total = 0;

    c.query('select count(*) from Sets').then((rows: any[]) => {
        total = +rows[0][0]['count(*)'];
        logger.log(0, total, "sets in database");
        module.exports.total = total;
    });

    export class ReplayData {
        link: string = '';
        description: string = '';
        champ: string = '';
        manual: boolean = false;
        trip: string = '';
    }

    export const createChampFromTrip = async (name: string, trip: string) => await c.query('insert into memes.champs (name, trip) values (?, ?) ', [name || '', trip]);
    export const addReplay = async (data: ReplayData) => await c.query('insert into memes.replays (link, description, champ, trip, manual) values (?, ?, ?, ?, ?);', [data.link, data.description || '', data.champ || '', data.trip || '', data.manual || 1]);
    export const addSetToReplay = async (setid: number, rid: number) => await c.query('insert into memes.sets_in_replays (idreplay, idset) values (?, ?)', [rid, setid]);
    export const updateChampName = async (trip: string, name: string) => await c.query('update memes.champs set name = ? where trip = ?', [name, trip]);
    export const updateChampAvatar = async (trip: string, aid: string) => await c.query('update memes.champs set avatar = ? where trip = ?', [aid, trip]);

    export const getReplaysSets = async (manual: number | boolean): Promise<replays[] & sets_in_replays[] & Sets[]> => (await c.query('select * from replays inner join sets_in_replays on replays.id = sets_in_replays.idreplay inner join Sets on idset = Sets.id where manual = ? order by replays.id desc', [manual]))[0];
    export const getAllSets = async (): Promise<Sets[]> => (await c.query('select * from Sets'))[0];
    export const memesInReplay = async (rid: string): Promise<Sets[]> => (await c.query('select * from memes.Sets where id in (select idset from memes.sets_in_replays where idreplay = ?)', [rid]))[0];
    export const getReplays = async (manual: number | boolean): Promise<replays[]> => (await c.query('select * from replays where manual = ? order by id desc;', [manual]))[0];
    export const getChampFromTrip = async (trip: string): Promise<champs[]> => (await c.query('select * from memes.champs where trip = ? order by id desc;', [trip]))[0];
    export const getChamps = async (): Promise<champs[]> => (await c.query('select * from memes.champs order by wins desc;'))[0];
    export const getSetsPage = async (setPerPage: number, pageNumber: number): Promise<Sets[]> => (await c.query('select * from Sets order by id desc limit ? offset ?;', [~~setPerPage, ~~(setPerPage * pageNumber)]))[0];
    export const getSetById = async (id: number): Promise<Sets[]> => (await c.query('select * from Sets where id = ?', [id]))[0];
    export const getSetByNo = async (no: number): Promise<Sets[]> => (await c.query('select * from Sets limit 1 offset ?', [no]))[0];
    export const getRandomSet = async (seed: number = ~~(Math.random() * 9999)): Promise<Sets[]> => (await c.query('select * from Sets as r1 join (select ceil(rand(?) * (select max(id) from Sets)) as id) as r2 where r1.id >= r2.id limit 1', [seed]))[0];

    export const registerChampResult = async (battleData: BattleData, hasWon: boolean): Promise<void> => {
        let replayurl: string;
        try {
            logger.log(0, `Checking elo of ${toId(battleData.champ.showdown_name)}`);
            let b : string = await request.get(`https://play.pokemonshowdown.com/~~showdown/action.php?act=ladderget&user=${toId(battleData.champ.showdown_name)}`);
            let stats : ShowdownStat[] = JSON.parse(b.substr(1));
            if (stats.length == 0)
                throw "Unregistered or never played";
            let oustat = stats.filter(e => e.formatid == 'gen7ou')[0];
            if (!oustat)
                throw "Never played OU";
            let ouelo = ~~oustat.elo;
            logger.log(0, `${battleData.champ.showdown_name} has a elo of ${ouelo}`);
            // no need to sync
            c.query('update memes.champs set elo = ? where trip = ?', [b, battleData.champ.champ_trip]);
            // might be useful to store this
            c.query('update memes.champs set showdown_name = ? where trip = ?', [battleData.champ.showdown_name, battleData.champ.champ_trip]);
        } catch (e) {
            console.log(e);
        }
        if (hasWon) {
            logger.log(0, `${battleData.champ.showdown_name} won`);
            await pokeUtils.saveReplay(battleData.champ.champ_battle);
            replayurl = 'http://replay.pokemonshowdown.com/' + battleData.roomid;
        } else {
            logger.log(0, `${battleData.champ.showdown_name} lost`);
        }

        let inc = hasWon ? 'wins' : 'loses';
        let champ = await getChampFromTrip(battleData.champ.champ_trip);
        if (champ.length == 0) {
            logger.log(0, `This was ${battleData.champ.champ_name} first battle`);
            await createChampFromTrip(battleData.champ.champ_name, battleData.champ.champ_trip);
        }

        await c.query('update memes.champs set ' + inc + ' = ' + inc + ' + 1 where trip = ?', [battleData.champ.champ_trip]);
        if (battleData.champ.avatar)
            updateChampAvatar(battleData.champ.champ_trip, battleData.champ.avatar.substr(+(battleData.champ.avatar[0] == '#')));
        updateChampName(battleData.champ.champ_trip, battleData.champ.champ_name);
        if (!hasWon)
            return;
        logger.log(0, `Adding ${battleData.champ.champ_name} battle to database`);
        let info = await addReplay({
            link: replayurl!,
            description: 'Automatically uploaded replay. Champ: ' + battleData.champ.champ_name + ' ' + battleData.champ.champ_trip,
            champ: battleData.champ.champ_name,
            trip: battleData.champ.champ_trip,
            manual: false
        });
        logger.log(0, `Replay successfully added ${info}`);
        logger.log(0, `${battleData.memes.length} memes detected in champs team`);
        let n = 0;
        for (let i = 0; i < battleData.memes.length; ++i) {
            let sets = await getSetsByPropertyExact({ name: battleData.memes[i].name });
            if (sets.length >= 1) {
                let set = sets[0];
                ++n;
                addSetToReplay(set.id, info.insertId);
            }
        }
        logger.log(0, `${n} memes matched in db`);
    }

    export const getSetsByProperty = async (props: any): Promise<Sets[]> => {
        let querystr = 'select * from Sets ';
        let data: string[] = [];
        let where_clause = Object.keys(props).map(i => '?? like ?').join(' and ');
        Object.keys(props).forEach(i => data.push(i, '%' + props[i] + '%'));
        if (where_clause)
            querystr += 'where ' + where_clause;
        return (await c.query(querystr, data))[0];
    }

    export const getSetsByPropertyExact = async (props: any): Promise<Sets[]> => {
        let querystr = 'select * from Sets where ';
        let data: string[] = [];
        querystr += Object.keys(props).map(i => '?? like ?').join(' and ');
        Object.keys(props).forEach(i => data.push(i, props[i]));
        return (await c.query(querystr, data))[0];
    }

    export const getSetsByName = async (name: string): Promise<Sets[]> => {
        let pattern = '%' + name + '%';
        let sets = (await c.query('select * from Sets where name like ? or species like ? or move_1 like ? or move_2 like ? or move_3 like ? or move_4 like ?',
            [pattern,
                pattern, pattern, pattern, pattern,
                pattern]))[0];
        return sets;
    }

    export const createNewSet = async (request: express.Request) => {
        let row: SuperSet = new SuperSet;
        row.hash = tripcode(request.body.trip);
        row.format = "gen7ou";
        let formats = ["gen7ou", "gen7ubers", "gen7anythinggoes", "gen7uu", "gen7ru", "gen7nu", "gen7pu", "gen7lc", "gen7natureswap", "gen7balancedhackmons", "gen7mixandmega", "gen7almostanyability", "gen7camomons", "gen7stabmons", "gen7customgame"];
        if (formats.includes(request.body.format))
            row.format = request.body.format;
        row.creator = request.body.creat.substr(0, 23);
        row.description = request.body.desc.substr(0, 230);
        let pok = pokeUtils.parseSet(request.body.set);
        pok.format = row.format;
        let errors = await pokeUtils.checkSet(pok);
        if (errors)
        throw errors;
        for (let i in pok)
        row[i] = pok[i];
        row.date_added = +new Date();
        let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
            'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
            ...[1, 2, 3, 4].map(id => `move_${id}`),
            /// who else /high-iq/ here?
            ...['e', 'i'].map(t => ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].map(s => `${s}_${t}v`)).reduce((a, b) => a.concat(b), []),
            'description'];
        let data_arr = [];
        let querystr = `insert into Sets (${data.map(attr => '??').join(', ')}) value (${data.map(attr => '?').join(', ')})`;
        data_arr.push(...data, ...data.map(attr => row[attr]));
        let rows = await c.query(querystr, data_arr);
        module.exports.total++;
        return rows;
    }

    export const buildCheckableSet = (set: Sets) => {
        let nset = set;
        [1, 2, 3, 4]
            .map(d => 'move_' + d)
            .forEach(mp => nset[mp] = nset[mp] ? (<string>nset[mp]).split('/')[0].trim() : null);
        return nset;
    }

    export const updateSet = async (request: express.Request) => {
        let row = (await getSetById(request.params.id))[0];
        if (request.body.trip == '' || (request.body.trip != settings.admin_pass && row.hash != tripcode(request.body.trip)))
            throw 'Wrong tripcode';

        row.format = "gen7ou";
        let formats = ["gen7ou", "gen7anythinggoes", "ubers", "uu", "ru",
            "nu", "pu", "lc", "cap"];
        if (formats.includes(request.body.format))
            row.format = request.body.format;
        row.description = request.body.desc.substr(0, 230);
        row.date_added = +new Date();

        try {
            let pok = pokeUtils.parseSet(request.body.set);
            for (let i in pok)
                row[i] = pok[i];
            let set = pokeUtils.formatSetFromRow(row);
            let errors = await pokeUtils.checkSet(set);
            if (errors) {
                throw errors;
            }
        }
        catch (e) {
            throw e;
        }

        let data = ['date_added', 'format', 'creator', 'hash', 'name', 'species',
            'gender', 'item', 'ability', 'shiny', 'level', 'happiness', 'nature',
            'move_1', 'move_2', 'move_3', 'move_4', 'hp_ev', 'atk_ev', 'def_ev',
            'spa_ev', 'spd_ev', 'spe_ev', 'hp_iv', 'atk_iv', 'def_iv', 'spa_iv',
            'spd_iv', 'spe_iv', 'description'];

        let data_arr: any[] = [];

        let querystr = `update Sets set ${data.map(attr => '?? = ?').join(', ')} WHERE id = ?`;

        data.map(attr => data_arr.push(attr, row[attr]));
        data_arr.push(request.params.id);
        let rows = await c.query(querystr, data_arr);
        return rows.info;
    }

    export const deleteSet = async (request: express.Request) => {
        let row = (await getSetById(request.params.id))[0];
        if (request.body.trip == '' ||
            (request.body.trip != settings.admin_pass &&
                row.hash != tripcode(request.body.trip)))
            throw 'Wrong tripcode';
        let rows = await c.query('delete from Sets where id = ?', [request.params.id]);
        module.exports.total--;
        return rows.info;
    }
}
