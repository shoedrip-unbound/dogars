
declare let mysql: () => MySqlClient;

declare class MySqlDBOptions {
    host: "127.0.0.1";
    user: "";
    database: "";
    password: "";
    charset: "utf8mb4";
}

declare interface MySqlClient {
    configure: (options: MySqlDBOptions) => void;
    query: (query: string, data?: any[]) => any;
}

declare module 'mysql-promise' {
    export = mysql;
}