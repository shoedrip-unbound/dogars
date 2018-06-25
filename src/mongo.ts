import { MongoClient, Db, Collection } from 'mongodb';
import { settings } from './settings';
import * as orm from './orm';
import { Champ } from './entities/Champ';
import { Repository } from 'typeorm';
import { sets_in_replays } from './entities/sets_in_replays';
import { logger } from './logger';
import * as request from 'request-promise-native';
import { toId } from './utils';
import { ShowdownStat } from './ShowdownStats';
import { BattleData } from './BattleData';
import { pokeUtils } from './poke-utils';
import { Sets } from './entities/Sets';
import { Replay } from './entities/Replay';
import * as tripcode from 'tripcode';


const url = `mongodb://${settings.db.host}:${settings.db.port || 27017}`;
const dbName = settings.db.database;
let memes: Db;

export let total = 0;
export let ChampsCollection: Collection<Champ>;
export let SetsCollection: Collection<Sets>;
export let ReplaysCollection: Collection<Replay>;

let connection: MongoClient;
let inited = false;
export let init = async () => {
    if (inited)
        return;
    connection = await MongoClient.connect(url);
    memes = connection.db(dbName);
    let collections = await memes.collections();
    if (collections.length == 0)
        convert();
    inited = true;
    ChampsCollection = memes.collection('Champs');
    SetsCollection = memes.collection('Sets');
    ReplaysCollection = memes.collection('Replays');
    total = await SetsCollection.count({});
}


export const registerChampResult = async (battleData: BattleData, hasWon: boolean): Promise<void> => {
    let replayurl: string = '';
    try {
        logger.log(0, `Checking elo of ${toId(battleData.champ.showdown_name)}`);
        let b: string = await request.get(`https://play.pokemonshowdown.com/~~showdown/action.php?act=ladderget&user=${toId(battleData.champ.showdown_name)}`);
        let stats: ShowdownStat[] = JSON.parse(b.substr(1));
        if (stats.length == 0)
            throw "Unregistered or never played";
        let oustat = stats.filter(e => e.formatid == 'gen7ou')[0];
        if (!oustat)
            throw "Never played OU";
        let ouelo = ~~oustat.elo;
        logger.log(0, `${battleData.champ.showdown_name} has a elo of ${ouelo}`);
        // no need to sync
        ChampsCollection.updateOne({
            trip: battleData.champ.champ_trip
        }, {
                $set: {
                    elo: b,
                    showdown_name: battleData.champ.showdown_name
                }
            });
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
    let champ = ChampsCollection.findOne({ trip: battleData.champ.champ_trip });
    if (!champ) {
        logger.log(0, `This was ${battleData.champ.champ_name} first battle`);
        ChampsCollection.insertOne(new Champ(battleData.champ.champ_name, battleData.champ.champ_trip));
    }

    if (battleData.champ.avatar)
        await ChampsCollection.updateOne({
            trip: battleData.champ.champ_trip
        }, {
                $set: { avatar: battleData.champ.avatar }
            });
    await ChampsCollection.updateOne({
        trip: battleData.champ.champ_trip
    }, {
            $inc: { [inc]: 1 },
            $set: { name: battleData.champ.champ_name }
        });
    if (!hasWon)
        return;
    let savedrepl = await ReplaysCollection.insertOne(new Replay(replayurl,
        'Automatically uploaded replay. Champ: ' + battleData.champ.champ_name + ' ' + battleData.champ.champ_trip,
        battleData.champ.champ_name,
        battleData.champ.champ_trip,
        false));
    logger.log(0, `${battleData.memes.length} memes detected in champs team`);
    let n = 0;
    for (let i = 0; i < battleData.memes.length; ++i) {
        let set = await SetsCollection.findOne({ name: battleData.memes[i].name })
        if (set) {
            ++n;
            await ReplaysCollection.update({ _id: savedrepl.insertedId },
                { $push: { sets: set } });
        }
    }
    logger.log(0, `${n} memes matched in db`);
}

let convert = async () => {
    await orm.init();
    let repl = await orm.ReplaysRepo.find();
    let champs = await orm.ChampsRepo.find();
    let sets = await orm.SetsRepo.find();
    let sirrepo = await orm.connection.getRepository(sets_in_replays);

    memes.collection('Sets')
        .insertMany(sets);

    memes.collection('Champs')
        .insertMany(champs);

    console.log('Done converting sets and champs, converting', repl.length, 'replays, now');
    let i = 0;
    let j = 10;
    for (let r of repl) {
        i += 100 / repl.length;
        if (i >= j) {
            console.log(`${j}%...`);
            j += 10;
        }
        let setsids = await sirrepo.find({ idreplay: r.id });
        let seta = await orm.SetsRepo.findByIds(setsids.map(id => id.idset));
        r.sets = seta;
    }
    await memes.collection('Replays')
        .insertMany(repl);
    connection.close();
    console.log("Finished copying replays");
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

export const updateSet = async (id: number, trip: string, info: { format: string, desc: string, set: string }) => {
    let uset = await SetsCollection.findOne({ id });
    if (!uset)
        throw 'No such set';
    if (trip != settings.admin_pass && (!uset.hash || !trip))
        throw 'No tripcode associated with this set or no tripcode given';
    if (!(trip == settings.admin_pass || uset.hash == tripcode(trip)))
        throw 'Wrong tripcode';
    uset.format = "gen7ou";
    let formats = ["gen7ou", "gen7anythinggoes", "ubers", "uu", "ru",
        "nu", "pu", "lc", "cap"];
    if (formats.includes(info.format))
        uset.format = info.format;
    uset.description = info.desc.substr(0, 230);
    let pok = pokeUtils.parseSet(info.set);
    pok.format = uset.format;
    for (let i in pok)
        uset[i] = pok[i];
    uset.date_added = +new Date();
    let errors = await pokeUtils.checkSet(pok);
    if (errors) {
        throw errors;
    }
    SetsCollection.updateOne({ id }, { $set: uset });
    return null;
}

export const buildCheckableSet = (set: Sets) => {
    let nset = set;
    [1, 2, 3, 4]
        .map(d => 'move_' + d)
        .forEach(mp => nset[mp] = nset[mp] ? (<string>nset[mp]).split('/')[0].trim() : null);
    return nset;
}


export const createNewSet = async (sdata: {
    trip: string,
    format: string,
    desc: string,
    set: string,
    creat: string
}) => {
    let nset = new Sets;
    nset.hash = tripcode(sdata.trip);
    nset.format = "gen7ou";
    let formats = ["gen7ou", "gen7ubers", "gen7anythinggoes", "gen7uu", "gen7ru", "gen7nu", "gen7pu", "gen7lc", "gen7natureswap", "gen7balancedhackmons", "gen7mixandmega", "gen7almostanyability", "gen7camomons", "gen7stabmons", "gen7customgame"];
    if (formats.includes(sdata.format))
        nset.format = sdata.format;
    nset.creator = sdata.creat.substr(0, 23);
    nset.description = sdata.desc.substr(0, 230);
    let pok = pokeUtils.parseSet(sdata.set);
    pok.format = nset.format;
    let errors = await pokeUtils.checkSet(pok);
    if (errors)
        throw errors;
    for (let i in pok)
        nset[i] = pok[i];
    nset.date_added = +new Date();
    total++;
    nset.id = (await SetsCollection.find().sort({ id: -1 }).toArray())[0].id + 1;
    await SetsCollection.insert(nset);
    return nset;
}

export let getRandomSet = async (seed: number = ~~(Math.random() * total)) => SetsCollection.find().skip(seed % total).limit(1).toArray();
