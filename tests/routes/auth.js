'use strict';

let User     = require('models/user');
let chai     = require('chai');
let co       = require('co');
let request  = require('supertest');
let testData = require('testdata/chat');
let clear    = require('clear');

let expect    = chai.expect;
let usersData = testData.users;

module.exports = app => {

  describe('Auth API', () => {
    let token;

    before(done => {
      co(function*() {
        yield User.remove({});
        done();
      }).catch(done);
    });

    after(clear);

    describe('Signup', () => {
      let validationRules = require('routes/validationRules').signup;

      it('Should return errors \'cannot be empty\'', done => {
        request(app)
          .post('/api/signup')
          .expect(400)
          .end((err, res) => {
            expect(res.body.errors.name).to.equal('cannot be empty');
            expect(res.body.errors.username).to.equal('cannot be empty');
            expect(res.body.errors.password).to.equal('cannot be empty');
            expect(res.body.errors.avatar).to.equal('cannot be empty');
            done(err);
          });
      });

      it('Should return errors based on length rule', done => {
        request(app)
          .post('/api/signup')
          .field('name', 'xz')
          .field('username', 'xzy')
          .field('password', 'xzy')
          .expect(400)
          .end((err, res) => {
            expect(res.body.errors.name)
              .to.equal(validationRules.name.length.message);

            expect(res.body.errors.username)
              .to.equal(validationRules.username.length.message);

            expect(res.body.errors.password)
              .to.equal(validationRules.password.length.message);

            expect(res.body.errors.avatar)
              .to.equal('cannot be empty');

            done(err);
          });
      });

      it('Should return errors based on locale rule', done => {
        request(app)
          .post('/api/signup')
          .field('name', 'x!@qq')
          .field('username', 'фывasd')
          .field('password', 'xzy@!#')
          .expect(400)
          .end((err, res) => {
            expect(res.body.errors.name)
              .to.equal(validationRules.name.locale.message);

            expect(res.body.errors.username)
              .to.equal(validationRules.username.locale.message);

            expect(res.body.errors.password)
              .to.equal(validationRules.password.locale.message);

            expect(res.body.errors.avatar)
              .to.equal('cannot be empty');

            done(err);
          });
      });

      it('Should return error based on file type rule', done => {
        request(app)
          .post('/api/signup')
          .attach('avatar', 'tests/testdata/wrongType.bin')
          .expect(400)
          .end((err, res) => {
            expect(res.body.errors.avatar)
              .to.equal(validationRules.avatar.extension.message);
            done(err);
          });
      });

      it('Should return error based on file size rule', done => {
        request(app)
          .post('/api/signup')
          .attach('avatar', 'tests/testdata/bigImage.jpg')
          .expect(400)
          .end((err, res) => {
            expect(res.body.errors.avatar)
              .to.equal(validationRules.avatar.size.message);
            done(err);
          });
      });

      it('Should save user and return token', done => {
        request(app)
          .post('/api/signup')
          .field('name', usersData[0].name)
          .field('username', usersData[0].username)
          .field('password', usersData[0].password)
          .attach('avatar', 'tests/testdata/validUserAvatar.png')
          .expect('Content-Type', /json/)
          .expect(200)
          .end((err, res) => {
            expect(res.body).to.have.property('token');
            expect(res.body.msg).to.equal('user has been created');
            done(err);
          });
      });
    });

    describe('Login', () => {

      it('Should return message: \'Invalid password\'', done => {
        request(app)
          .post('/api/login')
          .send({
            username: usersData[0].username,
            password: 'qwe2'
          })
          .expect(400)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.password.msg).to.equal('invalid password');
            done(err);
          });
      });

      it('Should return message: \'User doesn\'t exist\'', done => {
        request(app)
          .post('/api/login')
          .send({
            username: 'ffjjf',
            password: 'qwerty22'
          })
          .expect(404)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.username.msg).to.equal('user doesn\'t exist');
            done(err);
          });
      });

      it('Should return token', done => {
        request(app)
          .post('/api/login')
          .send({
            username: usersData[0].username,
            password: usersData[0].password
          })
          .expect(200)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.success).to.equal(true);
            expect(res.body).to.have.property('token');
            token = res.body.token;
            done(err);
          });
      });
    });

    describe('Access to the protected routes', () => {

      it('Should return message: \'No token provided\'', done => {
        request(app)
          .get('/api/me')
          .expect(401)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body.msg).to.equal('no token provided');
            done(err);
          });
      });

      it('Should return logged user\'s data', done => {
        request(app)
          .get('/api/me')
          .set('x-access-token', token)
          .expect(200)
          .expect('Content-Type', /json/)
          .end((err, res) => {
            expect(res.body).to.have.property('_id').not.be.empty;
            expect(res.body).to.have.property('name').not.be.empty;
            expect(res.body).to.have.property('username').not.be.empty;
            expect(res.body).to.have.property('avatar').not.be.empty;
            done(err);
          });
      });
    });
  });
}