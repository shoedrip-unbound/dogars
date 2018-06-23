import * as mocha from 'mocha';
import * as chai from 'chai';

import * as utils from './utils';

const expect = chai.expect;

describe('Utils tests', () => {
    beforeEach(() => {
    });

    it('test extend', () => {
        let obj = utils.extend({a: 1}, {b: 3});
        expect(obj).to.have.property('a');
        expect(obj).to.have.property('b');
        expect(obj.a).to.eq(1);
        expect(obj.b).to.eq(3);
    });

    it('test inverse', () => {
        expect(utils.inverse({
            '23': 'asd',
            'efr': '23fds'
        })).to.deep.equal({
            'asd': '23',
            '23fds': 'efr'
        });
        expect(utils.inverse({
        })).to.deep.equal({
        });
    });

    it('test match', () => {
        expect(utils.match({a: 1, b: 32}, {a: 2})).to.eq(false);
        expect(utils.match({a: 1, b: 32}, {a: 1})).to.eq(true);
    });
});