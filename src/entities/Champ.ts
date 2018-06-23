import { Index, Entity, PrimaryColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId, PrimaryGeneratedColumn } from "typeorm";


@Entity("champs", { schema: "memes" })
@Index("trip_UNIQUE", ["trip",], { unique: true })
export class Champ {

    @PrimaryGeneratedColumn()
    id!: number;
    constructor(name: string, trip: string) {
        this.name = name;
        this.trip = trip;
    }

    @Column("varchar", {
        nullable: false,
        length: 45,
        name: "name"
    })
    name!: string;


    @Column("varchar", {
        nullable: false,
        unique: true,
        length: 45,
        name: "trip"
    })
    trip!: string;


    @Column("int", {
        nullable: false,
        default: "0",
        name: "wins"
    })
    wins!: number;


    @Column("int", {
        nullable: false,
        default: "0",
        name: "loses"
    })
    loses!: number;


    @Column("varchar", {
        nullable: true,
        length: 15,
        default: "166",
        name: "avatar"
    })
    avatar!: string | null;


    @Column("int", {
        nullable: true,
        name: "elo"
    })
    elo!: number | null;


    @Column("varchar", {
        nullable: true,
        length: 45,
        name: "showdown_name"
    })
    showdown_name!: string | null;

}
