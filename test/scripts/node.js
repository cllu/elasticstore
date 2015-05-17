var chai = require("chai");
var should = chai.should();
var expect = chai.expect;
var sinon = require("sinon");
var sinonChai = require("sinon-chai");
chai.use(sinonChai);

var _ = require('lodash');
var Promise = require('bluebird');
var util = require('util');
var moment = require('moment');

var elasticstore = require('../../lib');
var Store = elasticstore.Store;
var ElasticstoreError = elasticstore.ElasticstoreError;

describe('Node', function () {
  var store = new Store(require('../config'));
  var context = {
    contextVar: '',
    contextFn: sinon.spy()
  };
  var Node = store.registerType(elasticstore.Node, context);

  before(function () {
    return store.connect();
  });

  after(function () {
    return store.drop();
  });

  // Node class methods
  describe('Node class', function () {

    it('getContext', function () {
      expect(Node.getContext()).to.equal(context);
    });

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

    it('getContext', function () {
      var node = new Node({title: 'node.getContext test'});
      expect(node.getContext()).to.equal(context);
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

    // custom node class
    function MyCustomNode(data) {
      elasticstore.Node.call(this, data);
    }
    MyCustomNode._type = 'custom_node';
    MyCustomNode._schema = {
      title: {required: true},
      modified: {default: true},
      created_at: {type: elasticstore.Type.Moment}
    };
    util.inherits(MyCustomNode, elasticstore.Node);

    var CustomNode = store.registerType(MyCustomNode);

    it('CustomNode operations', function () {
      return CustomNode.insert({
        _id: 'test',
        title: 'test'
      }).then(function (node) {
        expect(node._type).to.equal('custom_node');
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

    it('parses Moment value', function () {
      var node = new CustomNode({title: 'CustomNode Moment test', created_at: '2015-05-16T22:50:05.537Z'});
      expect(moment.isMoment(node.created_at)).to.be.true;
    })

  });

});

