var chai = require("chai");
var should = chai.should();
var expect = chai.expect;
var sinon = require("sinon");
var sinonChai = require("sinon-chai");
chai.use(sinonChai);

var _ = require('lodash');
var Promise = require('bluebird');
var ElasticstoreError = require('../../lib/error');
var util = require('util');

var ES_HOST = '127.0.0.1:27184';
var DB_NAME = 'organized-test';
var DB_VERSION = 1;

//describe.skip('Model', function () {
//  var Database = require('../../lib/database');
//  var Schema = Database.Schema;
//
//  var db = new Database({host: ES_HOST, name: DB_NAME, version: DB_VERSION});
//  before(function () {
//    return db.connect().then(function () {
//      return User.deleteMapping();
//      //return db.drop();
//    });
//  });
//
//  var userSchema = new Schema({
//    name: {
//      first: String,
//      last: String
//    },
//    email: String,
//    age: Number,
//    posts: [{type: Schema.Types.CUID, ref: 'Post'}]
//  });
//
//  userSchema.virtual('name.full').get(function () {
//    return this.name.first + ' ' + this.name.last;
//  });
//
//  var postSchema = new Schema({
//    title: String,
//    content: String,
//    user_id: {type: Schema.Types.CUID, ref: 'User'},
//    created: Date
//  });
//
//  var User = db.model('User', userSchema);
//  var Post = db.model('Post', postSchema);
//
//  it('new()', function () {
//    var user = User.new({
//      name: {first: 'John', last: 'Doe'},
//      email: 'abc@example.com',
//      age: 20
//    });
//
//    user._id.should.exist;
//    user.name.first.should.eql('John');
//    user.name.last.should.eql('Doe');
//    user.name.full.should.eql('John Doe');
//    user.email.should.eql('abc@example.com');
//    user.age.should.eql(20);
//    user.posts.should.eql([]);
//  });
//
//  it('get()', function () {
//    return User.save({
//      name: {first: 'John', last: 'Doe'},
//      email: 'abc@example.com',
//      age: 20
//    }).then(function (data) {
//      return User.get(data._id).then(function (doc) {
//        doc.should.eql(data);
//        return doc;
//      })
//    }).then(function (data) {
//      return User.remove(data._id);
//    });
//  });
//
//  it('save()', function () {
//    var listener = sinon.spy(function (data) {
//      User.get(data._id).then(function (doc) {
//        return doc.should.exist;
//      })
//    });
//
//    User.once('insert', listener);
//
//    return User.save({
//      name: {first: 'John', last: 'Doe'},
//      email: 'abc@example.com',
//      age: 20
//    }).then(function (data) {
//      return User.get(data._id).then(function (doc) {
//        doc.should.exist;
//        listener.calledOnce.should.be.true;
//        return doc;
//      });
//    }).then(function (data) {
//      return User.remove(data._id);
//    });
//  });
//
//  it('save() - no id', function () {
//    var doc = User.new();
//    delete doc._id;
//
//    return User.save(doc).catch(function (err) {
//      err.should.be
//        .instanceOf(ElasticstoreError)
//        .property('message', 'ID is not defined');
//    });
//  });
//
//  it('save() - already existed', function () {
//    var user;
//
//    return User.save({}).then(function (data) {
//      user = data;
//      return User.save(data);
//    }).finally(function () {
//      return User.remove(user._id);
//    }).catch(function (err) {
//      err.should.be
//        .instanceOf(ElasticstoreError)
//        .property('message', 'ID `' + user._id + '` has been used');
//    });
//  });
//
//  it('save() - hook', function () {
//    var testSchema = new Schema();
//
//    var preHook = sinon.spy(function (data) {
//      data.foo.should.eql('bar');
//      Test.get(data._id).then(function (doc) {
//
//        should.not.exist(doc);
//      })
//    });
//
//    var postHook = sinon.spy(function (data) {
//      Test.get(data._id).then(function (doc) {
//        doc.should.exist;
//        doc.foo.should.eql('bar');
//      });
//    });
//
//    testSchema.pre('save', preHook);
//    testSchema.post('save', postHook);
//
//    var Test = db.model('TestSaveModel', testSchema);
//
//    return Test.save({foo: 'bar'}).then(function () {
//      preHook.calledOnce.should.be.true;
//      postHook.calledOnce.should.be.true;
//    });
//  });
//
//  it('save() - array', function () {
//    return User.save([
//      {
//        name: {first: 'John', last: 'Doe'},
//        email: 'abc@example.com',
//        age: 20
//      },
//      {
//        name: {first: 'Andy', last: 'Baker'},
//        email: 'andy@example.com',
//        age: 30
//      }
//    ]).then(function (data) {
//      data.length = 2;
//      return data;
//    }).map(function (item) {
//      return User.remove(item._id);
//    });
//  });
//
//  it('save() - insert', function () {
//    return User.save({
//      name: {first: 'John', last: 'Doe'},
//      email: 'abc@example.com',
//      age: 20
//    }).then(function (data) {
//      User.get(data._id).should.exist;
//      return data;
//    }).then(function (data) {
//      return User.remove(data._id);
//    });
//  });
//
//  it('save() - replace', function () {
//    return User.save({
//      name: {first: 'John', last: 'Doe'},
//      email: 'abc@example.com',
//      age: 20
//    }).then(function (data) {
//      data.age = 30;
//      return User.save(data);
//    }).then(function (data) {
//      data.age.should.eql(30);
//      return data;
//    }).then(function (data) {
//      return User.remove(data._id);
//    });
//  });
//
//  it('updateById()', function () {
//    var listener = sinon.spy(function (data) {
//      return User.get(data._id).then(function (doc) {
//        doc.age.should.eql(30);
//      });
//    });
//
//    User.once('update', listener);
//
//    return User.save({
//      name: {first: 'John', last: 'Doe'},
//      email: 'abc@example.com',
//      age: 20
//    }).then(function (data) {
//      return User.updateById(data._id, {age: 30});
//    }).then(function (data) {
//      data.age.should.eql(30);
//      listener.calledOnce.should.be.true;
//      return data;
//    }).then(function (data) {
//      return User.remove(data._id);
//    });
//  });
//
//  it('updateById() - object', function () {
//    return User.save({
//      name: {first: 'John', last: 'Doe'},
//      email: 'abc@example.com',
//      age: 20
//    }).then(function (data) {
//      return User.updateById(data._id, {name: {first: 'Jerry'}});
//    }).then(function (data) {
//      data.name.first.should.eql('Jerry');
//      data.name.last.should.eql('Doe');
//      return data;
//    }).then(function (data) {
//      return User.remove(data._id);
//    });
//  });
//
//  it('updateById() - id not set', function () {
//    return User.updateById(null, {}).catch(function (err) {
//      err.should.be
//        .instanceOf(ElasticstoreError)
//        .property('message', 'ID is not defined');
//    });
//  });
//
//  it('updateById() - hook', function () {
//    var testSchema = new Schema();
//    var Test = db.model('TestUpdateById', testSchema);
//
//    var preHook = sinon.spy(function (data) {
//      return Test.get(data._id).then(function (doc) {
//        should.not.exist(doc.baz);
//      });
//    });
//
//    var postHook = sinon.spy(function (data) {
//      return Test.get(data._id).then(function (doc) {
//        return doc.baz.should.eql(1);
//      })
//    });
//
//    return Test.save({
//      foo: 'bar'
//    }).then(function (data) {
//      testSchema.pre('save', preHook);
//      testSchema.post('save', postHook);
//
//      return Test.updateById(data._id, {baz: 1});
//    }).then(function () {
//      preHook.calledOnce.should.be.true;
//      postHook.calledOnce.should.be.true;
//    });
//  });
//
//  it('remove()', function () {
//    var listener = sinon.spy(function (data) {
//      return User.get(data._id).then(function (doc) {
//
//        should.not.exist(doc);
//      });
//    });
//
//    User.once('remove', listener);
//
//    return User.save({
//      name: {first: 'John', last: 'Doe'},
//      email: 'abc@example.com',
//      age: 20
//    }).then(function (data) {
//      return User.remove(data._id);
//    }).then(function (data) {
//      listener.calledOnce.should.be.true;
//      return User.get(data._id).then(function (doc) {
//        should.not.exist(doc);
//      });
//    });
//  });
//
//  it('remove() - id not exist', function () {
//    return User.remove('foo').catch(function (err) {
//      err.should.be
//        .instanceOf(ElasticstoreError)
//        .property('message', 'ID `foo` does not exist');
//    });
//  });
//
//  it('remove() - hook', function () {
//    var testSchema = new Schema();
//    var Test = db.model('TestRemoveHook', testSchema);
//
//    var preHook = sinon.spy(function (data) {
//      return Test.get(data._id).then(function (doc) {
//        should.exist(doc);
//      });
//    });
//
//    var postHook = sinon.spy(function (data) {
//      return Test.get(data._id).then(function (doc) {
//        should.not.exist(doc);
//      });
//    });
//
//    testSchema.pre('remove', preHook);
//    testSchema.post('remove', postHook);
//
//    return Test.save({
//      foo: 'bar'
//    }).then(function (data) {
//      return Test.remove(data._id);
//    }).then(function () {
//      preHook.calledOnce.should.be.true;
//      postHook.calledOnce.should.be.true;
//    });
//  });
//
//  it('drop() save() and count()', function () {
//    return User.drop().then(function () {
//      return User.count();
//    }).then(function (count) {
//      count.should.equal(0);
//
//      return User.save([
//        {age: 10},
//        {age: 20},
//        {age: 20},
//        {age: 30},
//        {age: 40}
//      ]);
//    }).then(function (docs) {
//      docs.length.should.equal(5);
//      return User.count();
//    }).then(function (count) {
//      count.should.equal(5);
//      return User.drop();
//    }).then(function () {
//      return User.count();
//    }).then(function (count) {
//      count.should.equal(0);
//    });
//  });
//
//
//  it('find()', function () {
//    return User.drop()
//      .then(function () {
//        return User.save([
//          {age: 10},
//          {age: 20},
//          {age: 20},
//          {age: 30},
//          {age: 40}
//        ]);
//      }).then(function (data) {
//        return User.find({age: 20}).then(function (docs) {
//          docs.length.should.equal(2);
//          // we cannot guarantee the order of the two documents
//          //docs.should.eql(data.slice(1, 3));
//          return docs;
//        })
//      }).then(function () {
//        return User.drop();
//
//        //return User.remove(item._id);
//      });
//  });
//
//  it('find() - blank', function () {
//    return User.drop()
//      .then(function () {
//        return User.save([
//          {age: 10},
//          {age: 20},
//          {age: 20},
//          {age: 30},
//          {age: 40}
//        ]);
//      }).then(function (data) {
//        return User.find({});
//      }).then(function (docs) {
//        docs.length.should.equal(5);
//        return docs;
//      }).map(function (item) {
//        return User.remove(item._id);
//      });
//  });
//
//  it('find() - limit', function () {
//    return User.drop()
//      .then(function () {
//        return User.save([
//          {age: 10},
//          {age: 20},
//          {age: 20},
//          {age: 30},
//          {age: 40}
//        ]);
//      }).then(function (data) {
//        return User.find({age: 20}, {limit: 1}).then(function (docs) {
//          docs.length.should.equal(1);
//          return data;
//        });
//      }).map(function (item) {
//        return User.remove(item._id);
//      });
//  });
//
//  it('find() - skip', function () {
//    return User.drop()
//      .then(function () {
//        return User.save([
//          {age: 10},
//          {age: 20},
//          {age: 20},
//          {age: 20}
//        ]);
//      }).then(function (data) {
//        return User.find({age: 20}, {skip: 2}).then(function(docs) {
//          docs.length.should.equal(1);
//          return data
//        });
//      }).map(function (item) {
//        return User.remove(item._id);
//      });
//  });
//
//  it('static method', function () {
//    var schema = new Schema();
//
//    schema.static('add', function (value) {
//      return this.save(value);
//    });
//
//    // ensure we have a unique model
//    var Test = db.model('TestStaticMethodModel', schema);
//
//    Test.add({name: 'foo'}).then(function (data) {
//      data.name.should.eql('foo');
//    });
//  });
//
//  it('instance method', function () {
//    var schema = new Schema();
//
//    schema.method('getName', function () {
//      return this.name;
//    });
//
//    var Test = db.model('Test', schema);
//
//    Test.save({name: 'foo'}).then(function (data) {
//      data.getName().should.eql('foo');
//    });
//  });
//
//});

// Node class methods
describe('Node', function () {
  var Store = require('../../lib').Store;
  var store = new Store({host: ES_HOST, name: DB_NAME, version: DB_VERSION});
  var Node = require('../../lib').Node;
  store.registerType(Node);

  before(function () {
    return store.connect();
  });

  after(function () {
    return store.drop();
  });

  it('getContext');
  it('getStore', function () {
    expect(Node.getStore()).to.be.instanceof(Store);
  });

  it('getIndex', function() {
    expect(Node.getIndex()).to.equal(store._index);
  });

  it('getType', function() {
    expect(Node.getType()).to.equal('node');
  });

  it('createInstance', function () {
    var node = Node.createInstance();
    expect(node).instanceof(Node);
  });

  it('insert', function () {
    return Node.insert({title: 'Node.insert test'}).then(function (node) {
      expect(node.title).to.equal('Node.insert test');
    });
  });

  it('find', function () {
    return Node.insert({title: 'Node.find test'}).then(function (node) {
      return Node.find({_id: node._id}).then(function (nodes) {
        expect(nodes).to.have.length(1);
        expect(nodes[0]._id).to.equal(node._id);
      });
    });
  });
  it('findOne', function () {
    return Node.insert({title: 'Node.findOne test'}).then(function (node) {
      return Node.findOne({_id: node._id}).then(function (n) {
        expect(n._id).to.equal(node._id);
      });
    });
  });
  it('findById', function () {
    return Node.insert({title: 'Node.findById test'}).then(function (node) {
      return Node.findById(node._id).then(function (n) {
        expect(n._id).to.equal(node._id);
      });
    });
  });
  it('updateById', function () {
    return Node.insert({title: 'Node.updateById test'}).then(function (node) {
      return Node.updateById(node._id, {title: 'Node.updateById test update'});
    }).then(function (updatedNode) {
      expect(updatedNode.title).to.equal('Node.updateById test update');
    });
  });
  it('removeById', function () {
    return Node.insert({title: 'Node.removeById test'}).then(function (node) {
      return Node.removeById(node._id);
    }).then(function (removedNode) {
      return Node.findById(removedNode._id).then(function (n) {
        return expect(n).to.not.ok;
      });
    });
  });
  it('findAndRemove', function () {
    return Node.insert({title: 'Node.findAndRemove test'}).then(function (node) {
      return Node.findAndRemove({_id: node._id}).thenReturn(node);
    }).then(function (node) {
      return Node.findById(node._id).then(function (n) {
        return expect(n).to.not.ok;
      });
    });
  });

  it('addHook', function () {
    Node.addHook('beforeSave', function () {
      console.log('hook');
    });
    expect(Node._hooks['beforeSave']).to.have.length(1);
  });
  it('executeHooks', function () {
    var hookFn = sinon.spy();
    var node = {title: 'Node.executeHooks test'};
    Node.addHook('beforeSave', hookFn);
    return Node.executeHooks('beforeSave', node).then(function () {
      expect(hookFn).to.have.been.calledWith(node);
    });
  });
});

// Node instance methods
describe('Node instance', function () {
  var Store = require('../../lib').Store;
  var store = new Store({host: ES_HOST, name: DB_NAME, version: DB_VERSION});
  var Node = require('../../lib').Node;
  store.registerType(Node);

  before(function () {
    return store.connect();
  });

  after(function () {
    return store.drop();
  });

  it('save', function () {
    var node = new Node({title: 'node.save test'});
    return node.save().then(function (n) {
      return Node.findById(n._id);
    }).then(function (node) {
      expect(node.title).to.equal('node.save test');
    });
  });
  it('update', function () {
    var node = new Node({title: 'node.update test'});
    return node.save().then(function (n) {
      return Node.findById(n._id);
    }).then(function (node) {
      expect(node.title).to.equal('node.update test');
      return node;
    }).then(function (node) {
      return node.update({title: 'node.update test update'})
    }).then(function (node) {
      expect(node.title).to.equal('node.update test update');
    });
  });
  it('remove', function () {
    var node = new Node({title: 'node.remove test'});

    return node.save().then(function (node) {
      return node.remove();
    }).then(function (removedNode) {
      return Node.findById(removedNode._id).then(function (n) {
        return expect(n).to.not.ok;
      });
    });
  });
});

/**
 * new style interface
 */
describe('CustomNode', function () {
  var Store = require('../../lib').Store;
  var store = new Store({host: ES_HOST, name: DB_NAME, version: DB_VERSION});
  var Node = require('../../lib').Node;

  // custom node class
  function CustomNode(data) {
    Node.call(this, data);
  }
  CustomNode._type = 'custom_node';
  CustomNode._schema = {
    title: {required: true},
    modified: {default: true}
  };
  util.inherits(CustomNode, Node);

  store.registerType(CustomNode);

  before(function () {
    return store.connect();
  });

  it('CustomNode operations', function () {

    return CustomNode.insert({
      _id: 'test',
      title: 'test'
    }).then(function (node) {
      return CustomNode.findById(node._id).then(function (nodeFromDB) {
        expect(nodeFromDB._id).to.equal(node._id);
        return nodeFromDB.remove();
      })
    });
  });

  it('CustomNode check required properties specified in schema', function () {
    expect(function () {new CustomNode()}).to.throw(ElasticstoreError);
    expect(function () {new CustomNode({title: 'hello'})}).to.not.throw(Error);
  });

  it('CustomNode set default properties specified in schema', function () {
    var node = new CustomNode({title: 'hello'});
    expect(node.modified).to.equal(true);
  });

  it('CustomNode _type property', function () {
    var node = new CustomNode({title: 'hello'});
    expect(node._type).to.equal('custom_node');
  });

});