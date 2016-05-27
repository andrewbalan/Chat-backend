'use strict';

let User     = require('models/user');
let chai     = require('chai');
let co       = require('co');
let request  = require('supertest');
let testData = require('../test_data');

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

    describe('Signup', () => {
      
      it('Should return errors', done => {
        request(app)
          .post('/api/signup')
          .send({
            name: '',
            username: 'dan11!',
            password: '55'
          })
          .expect('Content-Type', /json/)
          .expect(400)
          .end((err, res) => {
            expect(res.body.name.msg).to.equal('field is required');
            expect(res.body.username.msg).to.equal('only letters and numbers are allowed');
            expect(res.body.password.msg).to.equal('3 to 20 characters required');
            done(err);
          });
      });

      it('Should save user and return token', done => {
        request(app)
          .post('/api/signup')
          .send(usersData[0])
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
            expect(res.body).to.have.property('id').not.be.empty;
            done(err);
          });
      });
    });
  });
}