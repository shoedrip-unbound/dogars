import { Index, Entity, PrimaryColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId, PrimaryGeneratedColumn } from "typeorm";


export class Champ {

    constructor(name: string, trip: string) {
        this.name = name;
        this.trip = trip;
    }

    @Reflect.metadata('type', 'number')
    id!: number;

    @Reflect.metadata('type', 'string')
    name: string;

    @Reflect.metadata('type', 'string')
    trip: string;

    @Reflect.metadata('type', 'number')
    wins!: number;

    @Reflect.metadata('type', 'number')
    loses!: number;

    @Reflect.metadata('type', 'string')
    avatar: string = '166';

    @Reflect.metadata('type', 'number')
    elo?: number;

    @Reflect.metadata('type', 'string')
    showdown_name!: string;
}
