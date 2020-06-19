export class ShowdownMon {
    details: string = '';
    ident = '';
    pokeball = '';
    ability = '';
    baseAbility: string = '';
    condition: string = '';
    item: string = '';
    moves: string[] = [];
    stats!: {
        [idx: string]: number,
        hp: number,
        atk: number,
        def: number,
        spa: number,
        spd: number,
        spe: number
    };
}