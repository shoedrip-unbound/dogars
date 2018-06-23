import { Index, Entity, PrimaryColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId, PrimaryGeneratedColumn } from "typeorm";
import { Sets } from "./Sets";


@Entity("replays", { schema: "memes" })
export class Replay {

    @PrimaryGeneratedColumn()
    id!: number;

    constructor(link: string, description: string, champ: string, trip: string, manual: boolean) {
        this.link = link;
        this.description = description;
        this.manual = +manual;
        this.champ = champ;
        this.trip = trip;
        this.date = new Date();
    }

    @Column("varchar", {
        nullable: false,
        length: 70,
        name: "link"
    })
    link!: string;


    @Column("datetime", {
        nullable: false,
        default: "CURRENT_TIMESTAMP",
        name: "date"
    })
    date!: Date;


    @Column("varchar", {
        nullable: false,
        length: 250,
        name: "description"
    })
    description!: string;


    @Column("varchar", {
        nullable: false,
        length: 45,
        name: "champ"
    })
    champ!: string;


    @Column("varchar", {
        nullable: false,
        length: 45,
        name: "trip"
    })
    trip!: string;


    @Column("tinyint", {
        nullable: false,
        name: "manual"
    })
    manual!: number;


    sets!: Sets[];
}
