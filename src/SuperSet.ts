import {Sets, SetsFields} from './Memes'
import { SetTextForm } from './SetTextForm';
export class SuperSet implements Sets {
    [idx: string]: number | string | boolean | null;

    date_added: SetsFields.date_added = 0;
    format: SetsFields.format = '';
    creator: SetsFields.creator = '';
    hash: SetsFields.hash = '';
    name: SetsFields.name = '';
    species: SetsFields.species = '';
    gender: SetsFields.gender = '';
    item: SetsFields.item = '';
    ability: SetsFields.ability = '';
    shiny: SetsFields.shiny = 0;
    level: SetsFields.level = 100;
    happiness: SetsFields.happiness = 255;
    nature: SetsFields.nature = '';
    move_1: SetsFields.move_1 = '';
    move_2: SetsFields.move_2 = '';
    move_3: SetsFields.move_3 = '';
    move_4: SetsFields.move_4 = '';
    hp_ev: SetsFields.hp_ev = 0;
    atk_ev: SetsFields.atk_ev = 0;
    def_ev: SetsFields.def_ev = 0;
    spa_ev: SetsFields.spa_ev = 0;
    spd_ev: SetsFields.spd_ev = 0;
    spe_ev: SetsFields.spe_ev = 0;
    hp_iv: SetsFields.hp_iv = 0;
    atk_iv: SetsFields.atk_iv = 0;
    def_iv: SetsFields.def_iv = 0;
    spa_iv: SetsFields.spa_iv = 0;
    spd_iv: SetsFields.spd_iv = 0;
    spe_iv: SetsFields.spe_iv = 0;
    description: SetsFields.description = '';
    id: SetsFields.id = 0;
    has_custom: SetsFields.has_custom = false;
    date: string = '';
    species_: string = '';
    set_form: string = '';
    s: boolean = false;
    description_html: string = '';
    cust: boolean = false;
    img_url: string = '';
} 