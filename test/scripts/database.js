var should = require('chai').should();
var path = require('path');
var Promise = require('bluebird');
var sinon = require('sinon');
var fs = Promise.promisifyAll(require('fs'));

var ES_HOST = '127.0.0.1:27184';
var DB_NAME = 'organized';
var DB_VERSION = 1;

describe('Database', function(){

  var Database = require('../..');
  var Model = require('../../lib/model');
  var Schema = Database.Schema;
  var db = new Database({host: ES_HOST, name: DB_NAME, version: DB_VERSION});

  var TestModel = db.model('Test', new Schema({
    _id: {type: String, required: true}
  }));


  before(function(){
    return db.connect().then(function () {
      return TestModel.save([
        {_id: 'A'},
        {_id: 'B'},
        {_id: 'C'}
      ]);
    })
  });

  it('model() - get', function(){
    var Test = db.model('Test');
    Test.data.should.eql(TestModel.data);
  });

  it('model() - create', function(){
    var Post = db.model('Post');
    Post.should.be.an.instanceOf(Model);
    db._models.Post.should.exist;
  });


  it('connect()', function(){
    return db.connect().then(function(){
      var Test = db.model('Test');
    });
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