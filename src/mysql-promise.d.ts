
declare let mysql: () => MySqlClient;

declare class MySqlDBOptions {
    host: string;
    user: string;
    database: string;
    password: string;
    charset: string;
}

declare interface MySqlClient {
    configure: (options: MySqlDBOptions) => void;
    query: (query: string, data?: any[]) => any;
}

declare module 'mysql-promise' {
    export = mysql;
}