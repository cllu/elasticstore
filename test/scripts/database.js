var should = require('chai').should();
var Promise = require('bluebird');
var sinon = require('sinon');

var ES_HOST = '127.0.0.1:27184';
var DB_NAME = 'organized-test';
var DB_VERSION = 1;

describe('Database', function(){

  var Database = require('../../lib/index').Store;
  var Schema = Database.Schema;
  var db = new Database({host: ES_HOST, name: DB_NAME, version: DB_VERSION});

  it('connect()', function(){
    return db.connect();
  });

  it('connect() - upgrade', function(){
    var onUpgrade = sinon.spy(function(oldVersion, newVersion){
      oldVersion.should.eql(DB_VERSION);
      newVersion.should.eql(2);
    });

    var db = new Database({
      host: ES_HOST,
      name: DB_NAME,
      version: 2,
      onUpgrade: onUpgrade
    });

    return db.connect().then(function(){
      onUpgrade.calledOnce.should.be.true;
    });
  });

  it('connect() - downgrade', function(){
    var onDowngrade = sinon.spy(function(oldVersion, newVersion){
      oldVersion.should.eql(DB_VERSION);
      newVersion.should.eql(0);
    });

    var db = new Database({
      host: ES_HOST,
      name: DB_NAME,
      version: 0,
      onDowngrade: onDowngrade
    });

    return db.connect().then(function(){
      onDowngrade.calledOnce.should.be.true;
    });
  });

});