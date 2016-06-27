'use strict';

let User  = require('models/user');
let chai  = require('chai');
let users = require('testdata/chat').users;
let clear = require('clear');

let expect = chai.expect;

module.exports = (app) => {
  describe('User model', () => {

    let removeAllUsers = (done) => {
      User.remove({}, (err) => {
        if (err) done(err);
        done();
      });
    };

    before(removeAllUsers);
    after(clear);

    it('Should create a user', (done) => {
      let user = new User(users[0]);

      user.save((err, res) => {
        if (err) done(err);
        done();
      });
    });

    describe('password', () => {
      it('Should return \'true\' with a valid password', (done) => {
        User.findOne({
          name: users[0].name
        }, (err, user) => {
          if (err) done(err);
          let res = user.checkPassword(users[0].password);

          expect(res).to.be.a('boolean');
          expect(res).to.equal(true);

          done(err);
        });
      });

      it('Should return \'false\' with invalid password', (done) => {
        User.findOne({
          name: users[0].name
        }, (err, user) => {
          if (err) done(err);
          let res = user.checkPassword('lalala');

          expect(res).to.be.a('boolean');
          expect(res).to.equal(false);

          done();
        });
      });
    });
  });
}