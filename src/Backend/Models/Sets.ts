type PokemonSet = any;

export type Moves = {
        [k in 'move_1' | 'move_2' | 'move_3' | 'move_4']: string;
}

export type Sets = PokemonSet & Moves & {
        date_added: number;
        format: string;
        creator: string;
        hash: string;
        description: string;
        id: number;
        has_custom: number;
        move_1: string;
        move_2: string;
        move_3: string;
        move_4: string;
};

export type DBSet = Omit<Sets, 'moves' | 'evs' | 'ivs'> & {
        hp_ev: number;
        atk_ev: number;
        def_ev: number;
        spa_ev: number;
        spd_ev: number;
        spe_ev: number;

        hp_iv: number;
        atk_iv: number;
        def_iv: number;
        spa_iv: number;
        spd_iv: number;
        spe_iv: number;

        move_1: string;
        move_2: string;
        move_3: string;
        move_4: string;
};
