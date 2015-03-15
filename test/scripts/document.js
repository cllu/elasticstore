var should = require('chai').should();
var _ = require('lodash');
var Promise = require('bluebird');

var config = require('../index').config;

describe('Document', function(){
  var Database = require('../..');
  var Document = require('../../lib/document');
  var Schema = Database.Schema;

  var db = new Database({host: config.ES_HOST, name: config.DB_NAME, version: config.DB_VERSION});
  var User = db.model('User', {
    name: String,
    age: Number,
    comments: [{type: Schema.Types.CUID, ref: 'Comment'}]
  });

  var Comment = db.model('Comment', {
    content: String,
    author: {type: Schema.Types.CUID, ref: 'User'}
  });

  before(function () {
    return db.connect().then(function() {
      //return db.drop();
      return User.deleteMapping();
    });
  });


  it('constructor', function(){
    var doc = User.new({
      name: 'John',
      age: 20
    });

    doc.should.be.an.instanceOf(Document);
    doc.name.should.eql('John');
    doc.age.should.eql(20);
  });

  it('constructor - no arguments', function(){
    var doc = User.new();

    doc.should.be.an.instanceOf(Document);
  });

  it('save() - insert', function(){
    var doc = User.new({});

    return doc.save().then(function(item){
      return User.get(doc._id).then(function (doc) {
        doc.should.exist;
        return User.remove(item._id);
      });
    });
  });

  it('save() - replace', function(){
    return User.save({name: 'B'})
      .then(function(doc){
      doc.name = 'A';
      return doc.save();
    }).then(function(doc){
      doc.name.should.eql('A');
      return User.remove(doc._id);
    });
  });

  it('update()', function(){
    return User.save({}).then(function(doc){
      return doc.update({name: 'A'});
    }).then(function(doc){
      doc.name.should.eql('A');
      return User.remove(doc._id);
    });
  });

  it('remove()', function(){
    return User.save({}).then(function(doc){
      return doc.remove();
    }).then(function(doc){
      return User.get(doc._id).then(function(doc) {
        should.not.exist(doc);
      });
    });
  });

  it('toObject()', function(){
    var doc = User.new({});
    doc.toObject().should.not.be.instanceOf(User.Document);
  });

  it('toObject() - don\'t deep clone getters', function(){
    var userSchema = new Schema({
      name: String,
      age: Number
    });

    userSchema.virtual('users').get(function(){
      return User.find({});
    });

    var User = db.model('User', userSchema);

    return User.save({}).then(function(data){
      return User.get(data._id);
    }).then(function(data){
      data.toObject().should.be.ok;
    });
  });

  it('toString()', function(){
    var doc = User.new({});
    doc.toString().should.eql(JSON.stringify(doc));
  });

});