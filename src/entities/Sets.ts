import { Index, Entity, PrimaryColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId, PrimaryGeneratedColumn } from "typeorm";
import { Replay } from "./Replay";
export class Sets {
    [idx: string]: number | string | Replay[] | boolean | null;

    @Reflect.metadata('type', 'string')
    date_added!: string;

    @Reflect.metadata('type', 'string')
    format!: string;

    @Reflect.metadata('type', 'string')
    creator!: string;

    @Reflect.metadata('type', 'string')
    hash!: string;

    @Reflect.metadata('type', 'string')
    name!: string;

    @Reflect.metadata('type', 'string')
    species!: string;

    @Reflect.metadata('type', 'string')
    gender!: string;

    @Reflect.metadata('type', 'string')
    item!: string;

    @Reflect.metadata('type', 'string')
    ability!: string;

    @Reflect.metadata('type', 'number')
    shiny!: number;

    @Reflect.metadata('type', 'number')
    level!: number;

    @Reflect.metadata('type', 'number')
    happiness!: number;

    @Reflect.metadata('type', 'string')
    nature!: string;

    @Reflect.metadata('type', 'string')
    move_1!: string;

    @Reflect.metadata('type', 'string')
    move_2!: string;

    @Reflect.metadata('type', 'string')
    move_3!: string;

    @Reflect.metadata('type', 'string')
    move_4!: string;

    @Reflect.metadata('type', 'number')
    hp_ev!: number;

    @Reflect.metadata('type', 'number')
    atk_ev!: number;

    @Reflect.metadata('type', 'number')
    def_ev!: number;

    @Reflect.metadata('type', 'number')
    spa_ev!: number;

    @Reflect.metadata('type', 'number')
    spd_ev!: number;

    @Reflect.metadata('type', 'number')
    spe_ev!: number;

    @Reflect.metadata('type', 'number')
    hp_iv!: number;

    @Reflect.metadata('type', 'number')
    atk_iv!: number;

    @Reflect.metadata('type', 'number')
    def_iv!: number;

    @Reflect.metadata('type', 'number')
    spa_iv!: number;

    @Reflect.metadata('type', 'number')
    spd_iv!: number;

    @Reflect.metadata('type', 'number')
    spe_iv!: number;

    @Reflect.metadata('type', 'string')
    description!: string;

    @Reflect.metadata('type', 'number')
    id!: number;

    @Reflect.metadata('type', 'number')
    has_custom!: number;

    @Reflect.metadata('type', 'array')
    replays!: Replay[];
}
