import "reflect-metadata";
import { Connection, createConnection, Repository, FindManyOptions, Like, In } from "typeorm";
import { settings } from "./settings";
import { Champ } from "./entities/Champ";
import { sets_in_replays } from "./entities/sets_in_replays";
import { Replay } from "./entities/Replay";
import { Sets } from "./entities/Sets";
import { toId } from "./utils";
import * as tripcode from "tripcode"
//import { ReplayData } from "./db";
import { pokeUtils } from "./poke-utils";

export let total: number;
export let SetsRepo: Repository<Sets>;
export let ChampsRepo: Repository<Champ>;
export let ReplaysRepo: Repository<Replay>;
export let connection: Connection;

export const getSetsByName = async (name: string): Promise<Sets[]> => {
    let pattern = `%${toId(name)}%`;
    // High IQ
    return SetsRepo.createQueryBuilder("set")
        .where(SetsRepo.metadata.columns
            .filter(c => ['string', 'text'].includes(c.type.toString()))
            .map(c => `${c.propertyName} like :pattern`)
            .join(" or "))
        .setParameters({
            pattern: pattern,
        })
        .getMany();
}

export const getSetsByProperty = async (props: any): Promise<Sets[]> => {
    for (let i in props)
        props[i] = `%${props[i]}%`;
    return SetsRepo.createQueryBuilder("set")
        .where(Object.keys(props).map(k => `set.${k} like :${k}`).join(' and '))
        .setParameters(props)
        .getMany();
}

export const getSetsByPropertyExact = async (props: any): Promise<Sets[]> => {
    return SetsRepo.createQueryBuilder("set")
        .where(Object.keys(props).map(k => `set.${k} = :${k}`).join(' and '))
        .setParameters(props)
        .getMany();
}

export let init = async () => {
    connection = await createConnection({
        type: 'mariadb',
        host: settings.db.host,
        port: settings.db.port || 3306,
        username: settings.db.user,
        password: settings.db.password,
        database: settings.db.database,
        entities: [Champ, Replay, Sets, sets_in_replays],
        synchronize: true,
        logging: false
    });
    SetsRepo = connection.getRepository(Sets);
    ChampsRepo = connection.getRepository(Champ);
    ReplaysRepo = connection.getRepository(Replay);
};

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
    for (let i in nset)
        nset[i] = pok[i];
    nset.date_added = +new Date();
    await SetsRepo.save(nset);
    total++;
    return nset;
}


export const deleteSet = async (id: number, trip: string) => {
    let row = await SetsRepo.findOne(id);
    if (!row)
        throw 'No such set';
    if (!row.hash || !trip || (trip != settings.admin_pass && row.hash != tripcode(trip)))
        throw 'Wrong tripcode';
    let rows = await SetsRepo.delete(row);
    total--;
}

export const updateSet = async (id: number, trip: string, info: { format: string, desc: string, set: string }) => {
    let uset = await SetsRepo.findOne(id);
    if (!uset)
        throw 'No such set';
    if (!uset.hash || !trip || (trip != settings.admin_pass && uset.hash != tripcode(trip)))
        throw 'Wrong tripcode';
    uset.format = "gen7ou";
    let formats = ["gen7ou", "gen7anythinggoes", "ubers", "uu", "ru",
        "nu", "pu", "lc", "cap"];
    if (formats.includes(info.format))
        uset.format = info.format;
    uset.description = info.desc.substr(0, 230);
    let pok = pokeUtils.parseSet(info.set);
    pok.format = uset.format;
    for (let i in uset)
        uset[i] = pok[i];
    uset.date_added = +new Date();
    let errors = await pokeUtils.checkSet(pok);
    if (errors) {
        throw errors;
    }
    SetsRepo.save(uset);
    return uset;
}

export const createChampFromTrip = async (name: string, trip: string) => ChampsRepo.save(new Champ(name, trip));
//export const addReplay = async (data: ReplayData) => ReplaysRepo.save(new Replay(data.link, data.description, data.champ, data.trip, data.manual));
export const addSetToReplay = async (set: Sets, replay: Replay) => replay.sets.push(set) && ReplaysRepo.save(replay);

/*
export const getReplaysSets = async (manual: number | boolean): Promise<replays[] & sets_in_replays[] & Sets[]> => (await c.query('select * from replays inner join sets_in_replays on replays.id = sets_in_replays.idreplay inner join Sets on idset = Sets.id where manual = ? order by replays.id desc', [manual]))[0];
export const getAllSets = async (): Promise<Sets[]> => (await c.query('select * from Sets'))[0];
export const memesInReplay = async (rid: string): Promise<Sets[]> => (await c.query('select * from memes.Sets where id in (select idset from memes.sets_in_replays where idreplay = ?)', [rid]))[0];
export const getReplays = async (manual: number | boolean): Promise<replays[]> => (await c.query('select * from replays where manual = ? order by id desc;', [manual]))[0];
export const getChampFromTrip = async (trip: string): Promise<Champ[]> => (await c.query('select * from memes.champs where trip = ? order by id desc;', [trip]))[0];
export const getChamps = async (): Promise<Champ[]> => (await c.query('select * from memes.champs order by wins desc;'))[0];
export const getSetsPage = async (setPerPage: number, pageNumber: number): Promise<Sets[]> => (await c.query('select * from Sets order by id desc limit ? offset ?;', [~~setPerPage, ~~(setPerPage * pageNumber)]))[0];
export const getSetById = async (id: number): Promise<Sets[]> => (await c.query('select * from Sets where id = ?', [id]))[0];
export const getSetByNo = async (no: number): Promise<Sets[]> => (await c.query('select * from Sets limit 1 offset ?', [no]))[0];
export const getRandomSet = async (seed: number = ~~(Math.random() * 9999)): Promise<Sets[]> => (await c.query('select * from Sets as r1 join (select ceil(rand(?) * (select max(id) from Sets)) as id) as r2 where r1.id >= r2.id limit 1', [seed]))[0];
*/