import request = require('request-promise-native');

import { clamp } from './utils';

import { connection } from '../Showdown/PSConnection';
import { PSSaveBattleRequest } from '../Showdown/PSMessage';

import { Sets } from '../Backend/Models/Sets';
import { BattleURL } from '../Backend/CringeCompilation';
import { RoomID } from '../Showdown/PSRoom';
import { TeamValidator } from '../../pokemon-showdown/sim/team-validator'
import { Teams } from '../../pokemon-showdown/sim/teams'

// Shamelessly stolen and adapted from showdown-client
let BattleStatIDs: { [idx: string]: ('hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe') } = {
    HP: 'hp',
    hp: 'hp',
    Atk: 'atk',
    atk: 'atk',
    Def: 'def',
    def: 'def',
    SpA: 'spa',
    SAtk: 'spa',
    SpAtk: 'spa',
    spa: 'spa',
    SpD: 'spd',
    SDef: 'spd',
    SpDef: 'spd',
    spd: 'spd',
    Spe: 'spe',
    Spd: 'spe',
    spe: 'spe'
};


export module pokeUtils {
    export let parseSet = (text: string) => {
        const curSet = Teams.import(text) as any as Sets[]
        return curSet[0];
    }

    let headers = {
        'accept': '*/*',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.8,fr;q=0.6,ja;q=0.4,de;q=0.2',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'dnt': '1',
        'origin': 'https://play.pokemonshowdown.com',
        'referer': 'https://play.pokemonshowdown.com/crossprotocol.html?v1.2',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
    }

    export let checkSet = (set: Sets) => {
        let clone = JSON.parse(JSON.stringify(set)) as Sets;
        let f = (x?: string) => x ? x.split('/').map(e => e.trim()) : [''];
        clone.moves = f(clone.moves.join('/')).slice(0, 4);
        let validator = TeamValidator.get(set.format);

        let res = validator.validateSet(clone as PokemonSet, {});
        if (res && res.length)
            return res;
        return null;
    }

    export let saveReplay = async (url: BattleURL) => {
        let room = url.match(/(battle-.*)\/?/)![0] as RoomID;
        let roomid = url.match(/battle-(.*)\/?/)![1];
        // maybe something wrong here
        connection.tryJoin(room);
        let req = new PSSaveBattleRequest(room);
        let data = await connection.request(req);
        try {
            await request.post('http://play.pokemonshowdown.com/~~showdown/action.php?act=uploadreplay', {
                headers: headers,
                form: data
            });
        } catch (e) {
            console.log("Couldn't save replay:", data, e);
        }
    }
}
