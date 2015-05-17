var should = require('chai').should();
var Promise = require('bluebird');
var sinon = require('sinon');

var _ = require('lodash');

var config = require('../config');

describe('Database', function(){

  var Database = require('../../lib/index').Store;
  var Schema = Database.Schema;
  var db = new Database(config);

  it('connect()', function(){
    return db.connect();
  });

  it('connect() - upgrade', function(){
    var onUpgrade = sinon.spy(function(oldVersion, newVersion){
      oldVersion.should.eql(config.version);
      newVersion.should.eql(2);
    });

    var db = new Database(_.merge(_.clone(config), {version: 2, onUpgrade: onUpgrade}));

    return db.connect().then(function(){
      onUpgrade.calledOnce.should.be.true;
    });
  });

  it('connect() - downgrade', function(){
    var onDowngrade = sinon.spy(function(oldVersion, newVersion){
      oldVersion.should.eql(config.version);
      newVersion.should.eql(0);
    });

    var db = new Database(_.merge(_.clone(config), {version: 0, onDowngrade: onDowngrade}));

    return db.connect().then(function(){
      onDowngrade.calledOnce.should.be.true;
    });
  });

});