var should = require('chai').should();
var _ = require('lodash');
var Promise = require('bluebird');
var sinon = require('sinon');
var WarehouseError = require('../../lib/error');
var util = require('util');

var ES_HOST = '127.0.0.1:27184';
var DB_NAME = 'organized';
var DB_VERSION = 1;

describe('Model', function () {
  var Database = require('../..');
  var Schema = Database.Schema;

  var db = new Database({host: ES_HOST, name: DB_NAME, version: DB_VERSION});
  before(function () {
    return db.connect().then(function () {
      return User.deleteMapping();
      //return db.drop();
    });
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

  userSchema.virtual('name.full').get(function () {
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

  it('new()', function () {
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

  it('get()', function () {
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function (data) {
      return User.get(data._id).then(function (doc) {
        doc.should.eql(data);
        return doc;
      })
    }).then(function (data) {
      return User.remove(data._id);
    });
  });

  it('save()', function () {
    var listener = sinon.spy(function (data) {
      User.get(data._id).then(function (doc) {
        return doc.should.exist;
      })
    });

    User.once('insert', listener);

    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function (data) {
      return User.get(data._id).then(function (doc) {
        doc.should.exist;
        listener.calledOnce.should.be.true;
        return doc;
      });
    }).then(function (data) {
      return User.remove(data._id);
    });
  });

  it('save() - no id', function () {
    var doc = User.new();
    delete doc._id;

    return User.save(doc).catch(function (err) {
      err.should.be
        .instanceOf(WarehouseError)
        .property('message', 'ID is not defined');
    });
  });

  it('save() - already existed', function () {
    var user;

    return User.save({}).then(function (data) {
      user = data;
      return User.save(data);
    }).finally(function () {
      return User.remove(user._id);
    }).catch(function (err) {
      err.should.be
        .instanceOf(WarehouseError)
        .property('message', 'ID `' + user._id + '` has been used');
    });
  });

  it('save() - hook', function () {
    var testSchema = new Schema();

    var preHook = sinon.spy(function (data) {
      data.foo.should.eql('bar');
      Test.get(data._id).then(function (doc) {

        should.not.exist(doc);
      })
    });

    var postHook = sinon.spy(function (data) {
      Test.get(data._id).then(function (doc) {
        doc.should.exist;
        doc.foo.should.eql('bar');
      });
    });

    testSchema.pre('save', preHook);
    testSchema.post('save', postHook);

    var Test = db.model('TestSaveModel', testSchema);

    return Test.save({foo: 'bar'}).then(function () {
      preHook.calledOnce.should.be.true;
      postHook.calledOnce.should.be.true;
    });
  });

  it('save() - array', function () {
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
    ]).then(function (data) {
      data.length = 2;
      return data;
    }).map(function (item) {
      return User.remove(item._id);
    });
  });

  it('save() - insert', function () {
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function (data) {
      User.get(data._id).should.exist;
      return data;
    }).then(function (data) {
      return User.remove(data._id);
    });
  });

  it('save() - replace', function () {
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function (data) {
      data.age = 30;
      return User.save(data);
    }).then(function (data) {
      data.age.should.eql(30);
      return data;
    }).then(function (data) {
      return User.remove(data._id);
    });
  });

  it('updateById()', function () {
    var listener = sinon.spy(function (data) {
      return User.get(data._id).then(function (doc) {
        doc.age.should.eql(30);
      });
    });

    User.once('update', listener);

    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function (data) {
      return User.updateById(data._id, {age: 30});
    }).then(function (data) {
      data.age.should.eql(30);
      listener.calledOnce.should.be.true;
      return data;
    }).then(function (data) {
      return User.remove(data._id);
    });
  });

  it('updateById() - object', function () {
    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function (data) {
      return User.updateById(data._id, {name: {first: 'Jerry'}});
    }).then(function (data) {
      data.name.first.should.eql('Jerry');
      data.name.last.should.eql('Doe');
      return data;
    }).then(function (data) {
      return User.remove(data._id);
    });
  });

  it('updateById() - id not set', function () {
    return User.updateById(null, {}).catch(function (err) {
      err.should.be
        .instanceOf(WarehouseError)
        .property('message', 'ID is not defined');
    });
  });

  it('updateById() - hook', function () {
    var testSchema = new Schema();
    var Test = db.model('TestUpdateById', testSchema);

    var preHook = sinon.spy(function (data) {
      return Test.get(data._id).then(function (doc) {
        should.not.exist(doc.baz);
      });
    });

    var postHook = sinon.spy(function (data) {
      return Test.get(data._id).then(function (doc) {
        return doc.baz.should.eql(1);
      })
    });

    return Test.save({
      foo: 'bar'
    }).then(function (data) {
      testSchema.pre('save', preHook);
      testSchema.post('save', postHook);

      return Test.updateById(data._id, {baz: 1});
    }).then(function () {
      preHook.calledOnce.should.be.true;
      postHook.calledOnce.should.be.true;
    });
  });

  it('remove()', function () {
    var listener = sinon.spy(function (data) {
      return User.get(data._id).then(function (doc) {

        should.not.exist(doc);
      });
    });

    User.once('remove', listener);

    return User.save({
      name: {first: 'John', last: 'Doe'},
      email: 'abc@example.com',
      age: 20
    }).then(function (data) {
      return User.remove(data._id);
    }).then(function (data) {
      listener.calledOnce.should.be.true;
      return User.get(data._id).then(function (doc) {
        should.not.exist(doc);
      });
    });
  });

  it('remove() - id not exist', function () {
    return User.remove('foo').catch(function (err) {
      err.should.be
        .instanceOf(WarehouseError)
        .property('message', 'ID `foo` does not exist');
    });
  });

  it('remove() - hook', function () {
    var testSchema = new Schema();
    var Test = db.model('TestRemoveHook', testSchema);

    var preHook = sinon.spy(function (data) {
      return Test.get(data._id).then(function (doc) {
        should.exist(doc);
      });
    });

    var postHook = sinon.spy(function (data) {
      return Test.get(data._id).then(function (doc) {
        should.not.exist(doc);
      });
    });

    testSchema.pre('remove', preHook);
    testSchema.post('remove', postHook);

    return Test.save({
      foo: 'bar'
    }).then(function (data) {
      return Test.remove(data._id);
    }).then(function () {
      preHook.calledOnce.should.be.true;
      postHook.calledOnce.should.be.true;
    });
  });

  it('drop() save() and count()', function () {
    return User.drop().then(function () {
      return User.count();
    }).then(function (count) {
      count.should.equal(0);

      return User.save([
        {age: 10},
        {age: 20},
        {age: 20},
        {age: 30},
        {age: 40}
      ]);
    }).then(function (docs) {
      docs.length.should.equal(5);
      return User.count();
    }).then(function (count) {
      count.should.equal(5);
      return User.drop();
    }).then(function () {
      return User.count();
    }).then(function (count) {
      count.should.equal(0);
    });
  });


  it('find()', function () {
    return User.drop()
      .then(function () {
        return User.save([
          {age: 10},
          {age: 20},
          {age: 20},
          {age: 30},
          {age: 40}
        ]);
      }).then(function (data) {
        return User.find({age: 20}).then(function (docs) {
          docs.length.should.equal(2);
          // we cannot guarantee the order of the two documents
          //docs.should.eql(data.slice(1, 3));
          return docs;
        })
      }).then(function () {
        return User.drop();

        //return User.remove(item._id);
      });
  });

  it('find() - blank', function () {
    return User.drop()
      .then(function () {
        return User.save([
          {age: 10},
          {age: 20},
          {age: 20},
          {age: 30},
          {age: 40}
        ]);
      }).then(function (data) {
        return User.find({});
      }).then(function (docs) {
        docs.length.should.equal(5);
        return docs;
      }).map(function (item) {
        return User.remove(item._id);
      });
  });

  it('find() - limit', function () {
    return User.drop()
      .then(function () {
        return User.save([
          {age: 10},
          {age: 20},
          {age: 20},
          {age: 30},
          {age: 40}
        ]);
      }).then(function (data) {
        return User.find({age: 20}, {limit: 1}).then(function (docs) {
          docs.length.should.equal(1);
          return data;
        });
      }).map(function (item) {
        return User.remove(item._id);
      });
  });

  it('find() - skip', function () {
    return User.drop()
      .then(function () {
        return User.save([
          {age: 10},
          {age: 20},
          {age: 20},
          {age: 20}
        ]);
      }).then(function (data) {
        return User.find({age: 20}, {skip: 2}).then(function(docs) {
          docs.length.should.equal(1);
          return data
        });
      }).map(function (item) {
        return User.remove(item._id);
      });
  });

  it('static method', function () {
    var schema = new Schema();

    schema.static('add', function (value) {
      return this.save(value);
    });

    // ensure we have a unique model
    var Test = db.model('TestStaticMethodModel', schema);

    Test.add({name: 'foo'}).then(function (data) {
      data.name.should.eql('foo');
    });
  });

  it('instance method', function () {
    var schema = new Schema();

    schema.method('getName', function () {
      return this.name;
    });

    var Test = db.model('Test', schema);

    Test.save({name: 'foo'}).then(function (data) {
      data.getName().should.eql('foo');
    });
  });

})
;