import { Index, Entity, PrimaryColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId, PrimaryGeneratedColumn } from "typeorm";
import { Sets } from './Sets';

export class Replay {    
    constructor(link: string, description: string, champ: string, trip: string, manual: boolean) {
        this.link = link;
        this.description = description;
        this.manual = +manual;
        this.champ = champ;
        this.trip = trip;
        this.date = new Date();
    }
    
    @Reflect.metadata('type', 'number')
    id!: number;
    @Reflect.metadata('type', 'string')
    link!: string;

    @Reflect.metadata('type', 'object')
    date!: Date;


    @Reflect.metadata('type', 'string')
    description!: string;


    @Reflect.metadata('type', 'string')
    champ!: string;


    @Reflect.metadata('type', 'string')
    trip!: string;


    @Reflect.metadata('type', 'number')
    manual!: number;

    @Reflect.metadata('type', 'array')
    sets!: Sets[];
}
