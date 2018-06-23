import { Index, Entity, PrimaryColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId, PrimaryGeneratedColumn } from "typeorm";
import { Replay } from "./Replay";


@Entity("Sets", { schema: "memes" })
export class Sets {
    [idx: string]: number | string | Replay[] | boolean | null;

    @Column("bigint", {
        nullable: true,
        name: "date_added"
    })
    date_added!: string | null;


    @Column("text", {
        nullable: true,
        name: "format"
    })
    format!: string | null;


    @Column("text", {
        nullable: true,
        name: "creator"
    })
    creator!: string | null;


    @Column("text", {
        nullable: true,
        name: "hash"
    })
    hash!: string | null;


    @Column("text", {
        nullable: true,
        name: "name"
    })
    name!: string | null;


    @Column("text", {
        nullable: true,
        name: "species"
    })
    species!: string | null;


    @Column("text", {
        nullable: true,
        name: "gender"
    })
    gender!: string | null;


    @Column("text", {
        nullable: true,
        name: "item"
    })
    item!: string | null;


    @Column("text", {
        nullable: true,
        name: "ability"
    })
    ability!: string | null;


    @Column("int", {
        nullable: true,
        name: "shiny"
    })
    shiny!: number | null;


    @Column("int", {
        nullable: true,
        name: "level"
    })
    level!: number | null;


    @Column("int", {
        nullable: true,
        name: "happiness"
    })
    happiness!: number | null;


    @Column("text", {
        nullable: true,
        name: "nature"
    })
    nature!: string | null;


    @Column("text", {
        nullable: true,
        name: "move_1"
    })
    move_1!: string | null;


    @Column("text", {
        nullable: true,
        name: "move_2"
    })
    move_2!: string | null;


    @Column("text", {
        nullable: true,
        name: "move_3"
    })
    move_3!: string | null;


    @Column("text", {
        nullable: true,
        name: "move_4"
    })
    move_4!: string | null;


    @Column("int", {
        nullable: true,
        name: "hp_ev"
    })
    hp_ev!: number | null;


    @Column("int", {
        nullable: true,
        name: "atk_ev"
    })
    atk_ev!: number | null;


    @Column("int", {
        nullable: true,
        name: "def_ev"
    })
    def_ev!: number | null;


    @Column("int", {
        nullable: true,
        name: "spa_ev"
    })
    spa_ev!: number | null;


    @Column("int", {
        nullable: true,
        name: "spd_ev"
    })
    spd_ev!: number | null;


    @Column("int", {
        nullable: true,
        name: "spe_ev"
    })
    spe_ev!: number | null;


    @Column("int", {
        nullable: true,
        name: "hp_iv"
    })
    hp_iv!: number | null;


    @Column("int", {
        nullable: true,
        name: "atk_iv"
    })
    atk_iv!: number | null;


    @Column("int", {
        nullable: true,
        name: "def_iv"
    })
    def_iv!: number | null;


    @Column("int", {
        nullable: true,
        name: "spa_iv"
    })
    spa_iv!: number | null;


    @Column("int", {
        nullable: true,
        name: "spd_iv"
    })
    spd_iv!: number | null;


    @Column("int", {
        nullable: true,
        name: "spe_iv"
    })
    spe_iv!: number | null;


    @Column("text", {
        nullable: true,
        name: "description"
    })
    description!: string | null;


    @PrimaryGeneratedColumn()
    id!: number;


    @Column("tinyint", {
        nullable: false,
        name: "has_custom"
    })
    has_custom!: number;

}
