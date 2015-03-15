var should = require('chai').should();
var _ = require('lodash');
var Promise = require('bluebird');
var sinon = require('sinon');
var WarehouseError = require('../../lib/error');
var util = require('util');

var ES_HOST = '127.0.0.1:27184';
var DB_NAME = 'organized';
var DB_VERSION = 1;

describe('Model', function(){
  var Database = require('../..');
  var Schema = Database.Schema;
  var SchemaType = Database.SchemaType;

  var db = new Database({host: ES_HOST, name: DB_NAME, version: DB_VERSION});
  before(function () {
    return db.connect();
  });

  var userSchema = new Schema({
    name: {
      first: String,
      last: String
    },
    email: String,
    age: Number,
    posts: [{type: Schema.Types.CUID, ref: 'Post'}]
  });

  userSchema.virtual('name.full').get(function(){
    return this.name.first + ' ' + this.name.last;
  });

  var postSchema = new Schema({
    title: String,
    content: String,
    user_id: {type: Schema.Types.CUID, ref: 'User'},
    created: Date
  });

  var User = db.model('User', userSchema);
  var Post = db.model('Post', postSchema);

  it('new()', function(){
    var user = User.new({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    });

    user._id.should.exist;
    user.name.first.should.eql('John');
    user.name.last.should.eql('Doe');
    user.name.full.should.eql('John Doe');
    user.email.should.eql('abc@example.com');
    user.age.should.eql(20);
    user.posts.should.eql([]);
  });

  it.only('get()', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      console.log('saved data');
      console.log(data);
      return User.get(data._id).then(function (doc) {
        doc.should.eql(data);
        return doc;
      })
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('save()', function(){
    var listener = sinon.spy(function(data){
      User.get(data._id).should.exist;
    });

    User.once('insert', listener);

    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      User.get(data._id).should.exist;
      User.length.should.eql(1);
      listener.calledOnce.should.be.true;
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('save() - no id', function(){
    var doc = User.new();
    delete doc._id;

    return User.save(doc).catch(function(err){
      err.should.be
        .instanceOf(WarehouseError)
        .property('message', 'ID is not defined');
    });
  });

  it('save() - already existed', function(){
    var user;

    return User.save({}).then(function(data){
      user = data;
      return User.save(data);
    }).finally(function(){
      return User.removeById(user._id);
    }).catch(function(err){
      err.should.be
        .instanceOf(WarehouseError)
        .property('message', 'ID `' + user._id + '` has been used');
    });
  });

  it('save() - hook', function(){
    var db = new Database();
    var testSchema = new Schema();

    var preHook = sinon.spy(function(data){
      should.not.exist(Test.get(data._id));
      data.foo.should.eql('bar');
    });

    var postHook = sinon.spy(function(data){
      Test.get(data._id).should.exist;
      data.foo.should.eql('bar');
    });

    testSchema.pre('save', preHook);
    testSchema.post('save', postHook);

    var Test = db.model('Test', testSchema);

    return Test.save({foo: 'bar'}).then(function(){
      preHook.calledOnce.should.be.true;
      postHook.calledOnce.should.be.true;
    });
  });

  it('save() - array', function(){
    return User.save([
      {
        name: {first: 'John', last: 'Doe'},
        email: 'abc@example.com',
        age: 20
      },
      {
        name: {first: 'Andy', last: 'Baker'},
        email: 'andy@example.com',
        age: 30
      }
    ]).then(function(data){
      data.length = 2;
      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('save() - sync problem', function(callback){
    var db = new Database();
    var testSchema = new Schema();

    testSchema.pre('save', function(data){
      var item = Test.find({id: data.id});
      if (item) throw new Error('ID "' + data.id + '" has been used.');
    });

    var Test = db.model('Test', testSchema);

    Test.save([
      {id: 1},
      {id: 1}
    ]).catch(function(err){
      err.should.have.property('message', 'ID "1" has been used.');
      callback();
    });
  });

  it('save() - insert', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      User.get(data._id).should.exist;
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('save() - replace', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      data.age = 30;
      return User.save(data);
    }).then(function(data){
      data.age.should.eql(30);
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById()', function(){
    var listener = sinon.spy(function(data){
      User.get(data._id).age.should.eql(30);
    });

    User.once('update', listener);

    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.updateById(data._id, {age: 30});
    }).then(function(data){
      data.age.should.eql(30);
      listener.calledOnce.should.be.true;
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById() - object', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.updateById(data._id, {name: {first: 'Jerry'}});
    }).then(function(data){
      data.name.first.should.eql('Jerry');
      data.name.last.should.eql('Doe');
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById() - dot notation', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.updateById(data._id, {'name.last': 'Smith'});
    }).then(function(data){
      data.name.first.should.eql('John');
      data.name.last.should.eql('Smith');
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById() - operator', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.updateById(data._id, {age: {$inc: 5}});
    }).then(function(data){
      data.age.should.eql(25);
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById() - operator in first class', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.updateById(data._id, {$inc: {age: 5}});
    }).then(function(data){
      data.age.should.eql(25);
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById() - $set', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.updateById(data._id, {$set: {age: 25}});
    }).then(function(data){
      data.age.should.eql(25);
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById() - $unset', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.updateById(data._id, {$unset: {email: true}});
    }).then(function(data){
      should.not.exist(data.email);
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById() - $unset false', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.updateById(data._id, {$unset: {email: false}});
    }).then(function(data){
      data.email.should.eql('abc@example.com');
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById() - $rename', function(){
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.updateById(data._id, {$rename: {email: 'address'}});
    }).then(function(data){
      data.address.should.eql('abc@example.com');
      should.not.exist(data.email);
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('updateById() - id not exist', function(){
    return User.updateById('foo', {}).catch(function(err){
      err.should.be
        .instanceOf(WarehouseError)
        .property('message', 'ID `foo` does not exist');
    });
  });

  it('updateById() - hook', function(){
    var db = new Database();
    var testSchema = new Schema();
    var Test = db.model('Test', testSchema);

    var preHook = sinon.spy(function(data){
      should.not.exist(Test.get(data._id).baz);
    });

    var postHook = sinon.spy(function(data){
      Test.get(data._id).baz.should.eql(1);
    });

    return Test.save({
      foo: 'bar'
    }).then(function(data){
      testSchema.pre('save', preHook);
      testSchema.post('save', postHook);

      return Test.updateById(data._id, {baz: 1});
    }).then(function(){
      preHook.calledOnce.should.be.true;
      postHook.calledOnce.should.be.true;
    });
  });

  it('update()', function(){
    return User.save([
      {age: 10},
      {age: 20},
      {age: 30},
      {age: 20},
      {age: 40}
    ]).then(function(data) {
      return User.update({age: 20}, {email: 'A'}).then(function(updated){
        updated[0]._id.should.eql(data[1]._id);
        updated[1]._id.should.eql(data[3]._id);
        updated[0].email.should.eql('A');
        updated[1].email.should.eql('A');
        return data;
      });
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('replaceById()', function(){
    function validate(data){
      data.name.first.should.eql('Mary');
      data.name.last.should.eql('White');
      data.age.should.eql(40);
      data.should.not.ownProperty('email');
    }

    var listener = sinon.spy(function(data){
      validate(User.get(data._id));
    });

    User.once('update', listener);

    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data) {
      return User.replaceById(data._id, {
        name: {first: 'Mary', last: 'White'},
        age: 40
      });
    }).then(function(data){
      validate(data);
      listener.calledOnce.should.be.true;
      return data;
    }).then(function(data){
      return User.removeById(data._id);
    });
  });

  it('replaceById() - id not exist', function(){
    return User.replaceById('foo', {}).catch(function(err){
      err.should.be
        .instanceOf(WarehouseError)
        .property('message', 'ID `foo` does not exist');
    });
  });

  it('replaceById() - pre-hook', function(){
    var db = new Database();
    var testSchema = new Schema();
    var Test = db.model('Test', testSchema);

    var preHook = sinon.spy(function(data){
      Test.get(data._id).foo.should.eql('bar');
    });

    var postHook = sinon.spy(function(data){
      Test.get(data._id).foo.should.eql('baz');
    });

    return Test.save({
      foo: 'bar'
    }).then(function(data){
      testSchema.pre('save', preHook);
      testSchema.post('save', postHook);

      return Test.replaceById(data._id, {foo: 'baz'});
    }).then(function(){
      preHook.calledOnce.should.be.true;
      postHook.calledOnce.should.be.true;
    });
  });

  it('replace()', function(){
    return User.save([
      {age: 10},
      {age: 20},
      {age: 30},
      {age: 20},
      {age: 40}
    ]).then(function(data) {
      return User.replace({age: 20}, {email: 'A'}).then(function(updated){
        updated[0]._id.should.eql(data[1]._id);
        updated[1]._id.should.eql(data[3]._id);
        updated[0].email.should.eql('A');
        updated[1].email.should.eql('A');
        return data;
      });
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('removeById()', function(){
    var listener = sinon.spy(function(data){
      should.not.exist(User.get(data._id));
    });

    User.once('remove', listener);

    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function(data){
      return User.removeById(data._id);
    }).then(function(data){
      listener.calledOnce.should.be.true;
      should.not.exist(User.get(data._id));
    })
  });

  it('removeById() - id not exist', function(){
    return User.removeById('foo', {}).catch(function(err){
      err.should.be
        .instanceOf(WarehouseError)
        .property('message', 'ID `foo` does not exist');
    });
  });

  it('removeById() - hook', function(){
    var db = new Database();
    var testSchema = new Schema();
    var Test = db.model('Test', testSchema);

    var preHook = sinon.spy(function(data){
      Test.get(data._id).should.exist;
    });

    var postHook = sinon.spy(function(data){
      should.not.exist(Test.get(data._id));
    });

    testSchema.pre('remove', preHook);
    testSchema.post('remove', postHook);

    return Test.save({
      foo: 'bar'
    }).then(function(data){
      return Test.removeById(data._id);
    }).then(function(){
      preHook.calledOnce.should.be.true;
      postHook.calledOnce.should.be.true;
    });
  });

  it('remove()', function(){
    return User.save([
      {age: 10},
      {age: 20},
      {age: 30},
      {age: 20},
      {age: 40}
    ]).then(function(data){
      return User.remove({age: 20}).then(function(removed){
        should.not.exist(User.get(data[1]._id));
        should.not.exist(User.get(data[3]._id));
        return [data[0], data[2], data[4]];
      });
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('count()', function(){
    Post.length.should.eql(Post.count());
  });

  it('find()', function(){
    return User.save([
      {age: 10},
      {age: 20},
      {age: 20},
      {age: 30},
      {age: 40}
    ]).then(function(data){
      var query = User.find({age: 20});
      query.data.should.eql(data.slice(1, 3));
      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('find() - blank', function(){
    return User.save([
      {age: 10},
      {age: 20},
      {age: 20},
      {age: 30},
      {age: 40}
    ]).then(function(data){
      var query = User.find({});
      query.data.should.eql(data);
      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('find() - operator', function(){
    return User.save([
      {age: 10},
      {age: 20},
      {age: 30},
      {age: 40}
    ]).then(function(data){
      var query = User.find({age: {$gt: 20}});
      query.data.should.eql(data.slice(2));
      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('find() - limit', function(){
    return User.save([
      {age: 10},
      {age: 20},
      {age: 30},
      {age: 40}
    ]).then(function(data){
      var query = User.find({age: {$gte: 20}}, {limit: 2});
      query.data.should.eql(data.slice(1, 3));
      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('find() - skip', function(){
    return User.save([
      {age: 10},
      {age: 20},
      {age: 30},
      {age: 40}
    ]).then(function(data){
      var query = User.find({age: {$gte: 20}}, {skip: 1});
      query.data.should.eql(data.slice(2));

      // with limit
      query = User.find({age: {$gte: 20}}, {limit: 1, skip: 1});
      query.data.should.eql(data.slice(2, 3));

      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('find() - $and', function(){
    return User.save([
      {name: {first: 'John', last: 'Doe'}, age: 20},
      {name: {first: 'Jane', last: 'Doe'}, age: 25},
      {name: {first: 'Jack', last: 'White'}, age: 30}
    ]).then(function(data){
      var query = User.find({
        $and: [
          {'name.last': 'Doe'},
          {age: {$gt: 20}}
        ]
      });

      query.toArray().should.eql([data[1]]);

      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('find() - $or', function(){
    return User.save([
      {name: {first: 'John', last: 'Doe'}, age: 20},
      {name: {first: 'Jane', last: 'Doe'}, age: 25},
      {name: {first: 'Jack', last: 'White'}, age: 30}
    ]).then(function(data){
      var query = User.find({
        $or: [
          {'name.last': 'White'},
          {age: {$gt: 20}}
        ]
      });

      query.toArray().should.eql(data.slice(1));

      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('find() - $nor', function(){
    return User.save([
      {name: {first: 'John', last: 'Doe'}, age: 20},
      {name: {first: 'Jane', last: 'Doe'}, age: 25},
      {name: {first: 'Jack', last: 'White'}, age: 30}
    ]).then(function(data){
      var query = User.find({
        $nor: [
          {'name.last': 'White'},
          {age: {$gt: 20}}
        ]
      });

      query.toArray().should.eql([data[0]]);

      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('find() - $not', function(){
    return User.save([
      {name: {first: 'John', last: 'Doe'}, age: 20},
      {name: {first: 'Jane', last: 'Doe'}, age: 25},
      {name: {first: 'Jack', last: 'White'}, age: 30}
    ]).then(function(data){
      var query = User.find({
        $not: {'name.last': 'Doe'}
      });

      query.toArray().should.eql(data.slice(2));

      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('find() - $where', function(){
    return User.save([
      {name: {first: 'John', last: 'Doe'}, age: 20},
      {name: {first: 'Jane', last: 'Doe'}, age: 25},
      {name: {first: 'Jack', last: 'White'}, age: 30}
    ]).then(function(data){
      var query = User.find({
        $where: function(){
          return this.name.last === 'Doe';
        }
      });

      query.toArray().should.eql(data.slice(0, 2));

      return data;
    }).map(function(item){
      return User.removeById(item._id);
    });
  });

  it('static method', function(){
    var schema = new Schema();

    schema.static('add', function(value){
      return this.save(value);
    });

    var Test = db.model('Test', schema);

    Test.add({name: 'foo'}).then(function(data){
      data.name.should.eql('foo');
    });
  });

  it('instance method', function(){
    var schema = new Schema();

    schema.method('getName', function(){
      return this.name;
    });

    var Test = db.model('Test', schema);

    Test.save({name: 'foo'}).then(function(data){
      data.getName().should.eql('foo');
    });
  });

});