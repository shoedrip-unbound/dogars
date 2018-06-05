class Property<T> {
    private _value?: T;
    private prom?: (v: T) => void;

    get value(): Promise<T> {
        return new Promise((res, rej) => {
            if (this._value !== undefined)
                return res(this._value);
            this.prom = res;   
        });
    }

    set value(newName: Promise<T>) {
        newName.then(v => {
            this._value = v;
            this.prom && this.prom(this._value);
            this.prom = undefined;
        });
    }
}