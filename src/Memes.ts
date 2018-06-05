/* tslint:disable */


/**
 * AUTO-GENERATED FILE @ 2018-05-09 07:49:52 - DO NOT EDIT!
 *
 * This file was automatically generated by schemats v.3.0.3
 * $ schemats generate -c mysql://username:password@dogars.ml/memes -t champs -t replays -t Sets -t sets_in_replays -s memes
 *
 */


export namespace champsFields {
    export type id = number;
    export type name = string;
    export type trip = string;
    export type wins = number;
    export type loses = number;
    export type avatar = string | null;
    export type elo = number | null;
    export type showdown_name = string | null;

}

export interface champs {
    id: champsFields.id;
    name: champsFields.name;
    trip: champsFields.trip;
    wins: champsFields.wins;
    loses: champsFields.loses;
    avatar: champsFields.avatar;
    elo: champsFields.elo;
    showdown_name: champsFields.showdown_name;

}

export namespace replaysFields {
    export type id = number;
    export type link = string;
    export type date = Date;
    export type description = string;
    export type champ = string;
    export type trip = string;
    export type manual = boolean;

}

export interface replays {
    id: replaysFields.id;
    link: replaysFields.link;
    date: replaysFields.date;
    description: replaysFields.description;
    champ: replaysFields.champ;
    trip: replaysFields.trip;
    manual: replaysFields.manual;

}

export namespace SetsFields {
    export type date_added = number | null;
    export type format = string | null;
    export type creator = string | null;
    export type hash = string | null;
    export type name = string | null;
    export type species = string | null;
    export type gender = string | null;
    export type item = string | null;
    export type ability = string | null;
    export type shiny = number | null;
    export type level = number | null;
    export type happiness = number | null;
    export type nature = string | null;
    export type move_1 = string | null;
    export type move_2 = string | null;
    export type move_3 = string | null;
    export type move_4 = string | null;
    export type hp_ev = number | null;
    export type atk_ev = number | null;
    export type def_ev = number | null;
    export type spa_ev = number | null;
    export type spd_ev = number | null;
    export type spe_ev = number | null;
    export type hp_iv = number | null;
    export type atk_iv = number | null;
    export type def_iv = number | null;
    export type spa_iv = number | null;
    export type spd_iv = number | null;
    export type spe_iv = number | null;
    export type description = string | null;
    export type id = number;
    export type has_custom = boolean;

}

export interface Sets {
    [idx: string]: number | string | boolean | null;
    date_added: SetsFields.date_added;
    format: SetsFields.format;
    creator: SetsFields.creator;
    hash: SetsFields.hash;
    name: SetsFields.name;
    species: SetsFields.species;
    gender: SetsFields.gender;
    item: SetsFields.item;
    ability: SetsFields.ability;
    shiny: SetsFields.shiny;
    level: SetsFields.level;
    happiness: SetsFields.happiness;
    nature: SetsFields.nature;
    move_1: SetsFields.move_1;
    move_2: SetsFields.move_2;
    move_3: SetsFields.move_3;
    move_4: SetsFields.move_4;
    hp_ev: SetsFields.hp_ev;
    atk_ev: SetsFields.atk_ev;
    def_ev: SetsFields.def_ev;
    spa_ev: SetsFields.spa_ev;
    spd_ev: SetsFields.spd_ev;
    spe_ev: SetsFields.spe_ev;
    hp_iv: SetsFields.hp_iv;
    atk_iv: SetsFields.atk_iv;
    def_iv: SetsFields.def_iv;
    spa_iv: SetsFields.spa_iv;
    spd_iv: SetsFields.spd_iv;
    spe_iv: SetsFields.spe_iv;
    description: SetsFields.description;
    id: SetsFields.id;
    has_custom: SetsFields.has_custom;
}

export namespace sets_in_replaysFields {
    export type id = number;
    export type idreplay = number | null;
    export type idset = number | null;

}

export interface sets_in_replays {
    id: sets_in_replaysFields.id;
    idreplay: sets_in_replaysFields.idreplay;
    idset: sets_in_replaysFields.idset;

}
