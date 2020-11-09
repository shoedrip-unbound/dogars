import { MongoClient, Db, Collection } from 'mongodb';
import { settings } from './settings';
import * as request from 'request-promise-native';
import * as tripcode from 'tripcode';

import { ShowdownStat } from '../Showdown/ShowdownStats';
import { BattleData } from '../Showdown/BattleData';

import { toId } from '../Website/utils';
import { pokeUtils } from '../Website/poke-utils';

import { Champ } from './Models/Champ';
import { Sets, DBSet } from './Models/Sets';
import { Replay } from './Models/Replay';
import { BattleURL } from './CringeCompilation';
import { BattleAvatarNumbers } from '../Shoedrip/dexdata';

const url = `mongodb://${settings.db.host}:${settings.db.port || 27017}`;
const dbName = settings.db.database;
let memes: Db;

export let total = 0;
export let ChampsCollection: Collection<Champ>;
export let SetsCollection: Collection<DBSet>;
export let ReplaysCollection: Collection<Replay>;

export type QueryOperation<T> =
    { [op in '$and' | '$add' | '$divide']: Array<AggregationQuery<T>> } | {};


type QueryValue = string | number | RegExp;
type AggregationQuery<T> = QueryFieldOf<T> | QueryOperation<T> | QueryValue;
type QueryFieldOf<T> = { [key in keyof T]?: QueryValue };

export type AggregationPipelineStage<T> =
    { $match: AggregationQuery<QueryFieldOf<T>> } |
    { $addFields: { [k: string]: QueryOperation<T> } } |
    { $sort: { [key in keyof T]?: -1 | 1 } } |
    { $sample: { size: number } } |
    undefined;

let connection: MongoClient;
let inited = false;
export let init = async () => {
    if (inited)
        return;
    connection = await MongoClient.connect(url, {
        useUnifiedTopology: true,
        useNewUrlParser: true
    });
    memes = connection.db(dbName);
    let collections = await memes.collections();
    inited = true;
    ChampsCollection = memes.collection('Champs');
    SetsCollection = memes.collection('Sets');
    ReplaysCollection = memes.collection('Replays');
    total = await SetsCollection.countDocuments({});
    console.log(total, "of memes in DB")
}

const updateElo = async (trip: string, name: string) => {
    let b: string = await request.get(`https://play.pokemonshowdown.com/~~showdown/action.php?act=ladderget&user=${toId(name)}`);
    let stats: ShowdownStat[] = JSON.parse(b.substr(1));
    if (stats.length == 0)
        throw "Unregistered or never played";
    let oustat = stats.filter(e => e.formatid == 'gen7ou')[0];
    if (!oustat)
        throw "Never played OU";
    let ouelo = ~~oustat.elo;
    // no need to sync
    ChampsCollection.updateOne({
        trip
    }, {
        $set: {
            elo: ouelo,
            showdown_name: name
        }
    });
}

export const rebuildChampAvatars = async () => {
    let i = 0;
    let j = 0;
    let target = 10;
    let champs = await ChampsCollection.find({}).toArray();
    for (let c of champs) {
        ++i;
        if (c.avatar && c.avatar in BattleAvatarNumbers) {
            ++j;
            if ((i / champs.length) * 100 >= target) {
                target += 10;
                console.log(`${target}%...`)
            }

            c.avatar = BattleAvatarNumbers[c.avatar as keyof typeof BattleAvatarNumbers];
            await ChampsCollection.updateOne({
                trip: c.trip
            }, {
                $set: { avatar: c.avatar }
            });
        }
    }

}

export const registerChampResult = async (battleData: BattleData, hasWon: boolean): Promise<void> => {
    let replayurl: string;
    if (!inited)
        return;
    try {
        await updateElo(battleData.champ.trip, battleData.champ.showdown_name);
    } catch (e) {
        console.log(e);
    }
    let inc = hasWon ? 'wins' : 'loses';
    let champ = await ChampsCollection.findOne({ trip: battleData.champ.trip });
    if (!champ) {
        ChampsCollection.insertOne(new Champ(battleData.champ.name, battleData.champ.trip));
    }
    if (battleData.champ.avatar != '166')
        await ChampsCollection.updateOne({
            trip: battleData.champ.trip
        }, {
            $set: { avatar: battleData.champ.avatar }
        });
    await ChampsCollection.updateOne({
        trip: battleData.champ.trip
    }, {
        $inc: { [inc]: 1 },
        $set: {
            name: battleData.champ.name,
            last_seen: +new Date
        }
    });
    if (!hasWon)
        return;
    if (!battleData.champ.current_battle)
        return;
    await pokeUtils.saveReplay(battleData.champ.current_battle);
    replayurl = 'http://replay.pokemonshowdown.com/' + battleData.roomid;
    let savedrepl = await ReplaysCollection.insertOne(new Replay(replayurl,
        'Automatically uploaded replay. Champ: ' + battleData.champ.name + ' ' + battleData.champ.trip,
        battleData.champ.name,
        battleData.champ.trip,
        0));
    let n = 0;
    for (let i = 0; i < battleData.memes.length; ++i) {
        let set = await SetsCollection.findOne({ name: battleData.memes[i].name })
        if (set) {
            ++n;
            await ReplaysCollection.update({ _id: savedrepl.insertedId },
                { $push: { sets: set } });
        }
    }
}

export const deleteSet = async (id: number, trip: string, ignored?: any) => {
    let row = await SetsCollection.findOne({ id });
    if (!row)
        throw 'No such set';
    if (trip != settings.admin_pass && (!row.hash || !trip))
        throw 'No tripcode associated with this set or no tripcode given';
    if (!(trip == settings.admin_pass || row.hash == tripcode(trip)))
        throw 'Wrong tripcode';
    let del = await SetsCollection.deleteOne({ id });
    total--;
    return null;
}

export const formats = ["gen8ou", "gen8ubers", "gen8lc", "gen8monotype",
    "gen8anythinggoes", "gen8nfe", "gen81v1", "gen8cap", "gen8battlestadiumsingles",
    "gen8galarbeginnings", "gen8doublesou", "gen8battlestadiumdoubles", "gen82v2doubles",
    "gen8metronomebattle", "gen8nationaldex", "gen8nationaldexag", "gen8balancedhackmons"]

export const updateSet = async (id: number, trip: string, info: { format: string, desc: string, set: string }) => {
    let uset = await SetsCollection.findOne({ id });
    if (!uset)
        throw 'No such set';
    if (trip != settings.admin_pass && (!uset.hash || !trip))
        throw 'No tripcode associated with this set or no tripcode given';
    if (!(trip == settings.admin_pass || uset.hash == tripcode(trip)))
        throw 'Wrong tripcode';
    uset.format = "gen8ou";
    if (formats.includes(info.format))
        uset.format = info.format;
    uset.description = info.desc.substr(0, 650);
    let pok = pokeUtils.parseSet(info.set) as Sets;
    pok.date_added = +new Date();
    pok.format = uset.format;
    pok.creator = uset.creator;
    pok.hash = uset.hash;
    pok.description = uset.description;
    pok.id = uset.id;
    pok.has_custom = uset.has_custom
    let errors = pokeUtils.checkSet(pok);
    if (errors) {
        throw errors;
    }
    SetsCollection.updateOne({ id }, { $set: toDBSet(pok) });
    return null;
}

export const buildCheckableSet = (set: Sets) => {
    let nset = JSON.parse(JSON.stringify(set)) as Sets;
    nset.moves = nset.moves!
        .map(mp => mp ? mp.split('/')[0].trim() : '');
    return nset;
}

const toDBSet = (s: Sets) => {
    type SetOptionnal<T, U extends string | number | symbol> = Omit<T, U> & Partial<T>;
    let ret = JSON.parse(JSON.stringify(s)) as SetOptionnal<Sets & DBSet, 'evs' | 'ivs' | 'moves'>;
    if (s.evs) {
        ret.hp_ev = s.evs.hp;
        ret.atk_ev = s.evs.atk;
        ret.def_ev = s.evs.def;
        ret.spa_ev = s.evs.spa;
        ret.spd_ev = s.evs.spd;
        ret.spe_ev = s.evs.spe;
    }

    if (s.ivs) {
        ret.hp_iv = s.ivs.hp;
        ret.atk_iv = s.ivs.atk;
        ret.def_iv = s.ivs.def;
        ret.spa_iv = s.ivs.spa;
        ret.spd_iv = s.ivs.spd;
        ret.spe_iv = s.ivs.spe;
    }

    [ret.move_1, ret.move_2, ret.move_3, ret.move_4] = s.moves!;
    delete ret.moves;
    delete ret.ivs;
    delete ret.evs;
    return ret as DBSet;
}

export const createNewSet = async (sdata: {
    trip: string,
    format: string,
    desc: string,
    set: string,
    creat: string
}) => {
    let nset: Sets = {} as Sets;
    nset.hash = tripcode(sdata.trip);
    nset.format = "gen8ou";
    if (formats.includes(sdata.format))
        nset.format = sdata.format;
    nset.creator = sdata.creat.substr(0, 23);
    nset.description = sdata.desc.substr(0, 650);
    let pok = pokeUtils.parseSet(sdata.set) as Sets;
    pok.format = nset.format;
    let errors = pokeUtils.checkSet(pok);
    if (errors)
        throw errors;
    nset = { ...nset, ...pok };
    nset.date_added = +new Date();
    total++;
    nset.id = ((await SetsCollection.find().sort({ id: -1 }).toArray())[0]?.id || 0) + 1;
    await SetsCollection.insertOne(toDBSet(nset));
    return nset;
}

export let getRandomSet = async (seed: number = ~~(Math.random() * total)) => SetsCollection.find().skip(seed % total).limit(1).toArray();
