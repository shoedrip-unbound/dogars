import { Index, Entity, PrimaryColumn, Column, OneToOne, OneToMany, ManyToOne, ManyToMany, JoinColumn, JoinTable, RelationId, PrimaryGeneratedColumn } from "typeorm";


@Entity("sets_in_replays", { schema: "memes" })
export class sets_in_replays {

    @PrimaryGeneratedColumn()
    id!: number;


    @Column("int", {
        nullable: true,
        name: "idreplay"
    })
    idreplay!: number | null;


    @Column("int", {
        nullable: true,
        name: "idset"
    })
    idset!: number | null;

}
