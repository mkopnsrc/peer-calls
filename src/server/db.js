'use strict';
const Promise = require('bluebird');
const config = require('config');
const mongo = require('./promisifiedMongo.js');

let _db;

function connect() {
  return mongo.connectAsync(config.get('database'))
  .then(db => {
    _db = Promise.promisifyAll(db);
    return _db;
  });
}

function get() {
  return _db;
}

function collection(name) {
  return _db.collection(name);
}

module.exports = { connect, get: get, collection };