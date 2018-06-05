export class DBSet {
    hash: string = '';
    format: string = '';
    creator: string = '';
    date_added: number = 0;
    description: string = '';
    [idx: string]: number | string;
}