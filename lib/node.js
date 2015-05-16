'use strict';

var _ = require('lodash');
var Promise = require('bluebird');
var Types = require('./types');
var ElasticstoreError = require('./error');

/**
 * Node constructor.
 *
 * A node has the following core properties
 *
 * - _store, the ES store instance
 * - _context, optional application context
 * - _type, used as index _type in ElasticSearch
 * - _schema, property schema, specify which properties are required or has default value
 *
 * @class Node
 * @constructor
 * @extends EventEmitter
 * @module warehouse
 */
function Node(data) {

  /**
   * Node type
   *
   * @property {String} _type
   * @private
   */
  this._type = this.constructor._type || 'node';

  /**
   * Node shema
   * @type {*|{}}
   * @private
   */
  this._schema = this.constructor._schema || {};

  // apply data attributes
  _.forOwn(data, function (value, key) {
    this[key] = value;
  }, this);

  // check and apply schema
  _.forOwn(this._schema, function (value, key) {
    // check whether required properties are set
    if (value.required && !_.has(this, key)) {
      throw new ElasticstoreError(key + ' is required but missing');
    }

    // set default properties
    if (_.has(value, 'default') && !_.has(this, key)) {
      if (value.default instanceof Function) {
        this[key] = value.default();
      } else {
        this[key] = value.default;
      }
    }
  }, this);
}

Node._type = 'node';

/**
 * Construct a simple filtered query to be used by ElasticSearch
 * @param filter
 * @private
 */
function _constructSimpleFilteredQuery(filter) {
  var filters = [];
  _.forEach(filter, function (value, key) {
    var f = {term: {}};
    f['term'][key] = value;
    filters.push(f);
  });

  // the query body for ElasticSearch
  return {
    filtered: {
      query: {
        // so that documents will not be scored
        match_all: {}
      },
      filter: {
        bool: {
          must: [
            filters
          ]
        }
      }
    }
  };
}

Node.getContext = function () {
  return this.context;
};

Node.getStore = function () {
  return this._store;
};

Node.getIndex = function () {
  return this.getStore()._index;
};

Node.getType = function () {
  return this._type;
};

Node.getStoreClient = function () {
  return this.getStore().getClient();
};

/**
 * Create a new node instance
 *
 * @param data
 * @returns {*} an instance of Node
 */
Node.createInstance = function (data) {

  var constructor;

  if (this instanceof Node) {
    constructor = this.constructor;
  } else {
    constructor = this;
  }

  if (!data) {
    return new constructor();
  }

  // if it is already an instance
  if (data instanceof constructor) {
    return data;
  }

  delete data.store;
  delete data._schema;
  return new constructor(data);

};

/**
 * Finds a document by its identifier.
 *
 * @method get
 * @param {*} id
 * @return {Document}
 */
Node.get = function (id) {
  var self = this;
  return self.getStoreClient().then(function (client) {
    return client.get({
      index: self.getIndex(),
      type: self._type,
      id: id
    }).then(function (resp) {
      if (resp._source) {
        var data = resp._source;
        data._id = resp._id;

        return self.createInstance(data);
      } else {
        return null;
      }
    }, function (err) {
      if (err.message == 'Not Found') {
        return null;
      } else {
        throw err;
      }
    }).catch(function (err) {
      throw err;
    });
  });
};

Node.findById = Node.get;

Node.addHook = function (hookName, hookFn) {
  this._hooks = this._hooks || {};
  this._hooks[hookName] = this._hooks[hookName] || [];
  this._hooks[hookName].push(hookFn);
};

Node.executeHooks = function (hookName, data) {
  this._hooks = this._hooks || {};

  var hooks = this._hooks[hookName] || [];
  if (!hooks.length) return Promise.resolve(data);

  var self = this;
  return Promise.each(hooks, function (hook) {
    return hook(data, self.getContext());
  }).thenReturn(data);
};

/**
 * Inserts a document.
 *
 * @method _saveOne
 * @param {Object} data
 * @return {Promise}
 */
Node.insertOne = function (data) {
  var self = this;
  var result;

  return new Promise(function (resolve, reject) {
    resolve(self.createInstance(data));
  }).then(function (data) {
      return self.executeHooks('beforeSave', data);
    }).then(function (data) {
      // Insert data to ElasticSearch
      return self.getStoreClient().then(function (client) {

        var _type = data._type || self._type;

        delete data.store;
        delete data._schema;

        return client.index({
          index: self.getIndex(),
          type: _type,
          id: data._id,
          body: data,
          // make sure the data is searchable instantly
          refresh: true
        }).then(function (resp) {

          /**
           * Fired when a document is inserted
           *
           * @event insert
           */
          //self.emit('insert', data);

          if (!data._id) {
            data._id = resp._id;
          }
          return self.createInstance(data);
        });
      });
    }).then(function (data) {
      return self.executeHooks('afterSave', data);
    });
};

/**
 * Save one or more documents.
 *
 * @method save
 * @param {Object|Array} data
 * @return {Promise}
 */
Node.insert = function (data) {
  var self = this;

  if (_.isArray(data)) {
    return Promise.map(data, function (item) {
      return self.insertOne(item);
    }).then(function (docs) {
      return self.getStoreClient().then(function (client) {
        return client.indices.refresh({
          index: self.getIndex()
        }).then(function () {
          return docs;
        });
      })
    })
  } else {
    return this.insertOne(data);
  }
};

//Node.save = Node.insert;

/**
 * Finds a document by its identifier and update it.
 *
 * @method updateById
 * @param {*} id
 * @return {Promise}
 */
Node.updateById = function (id, update) {
  // Check ID
  if (!id) {
    return Promise.reject(new ElasticstoreError('ID is not defined'));
  }

  var self = this;

  return self.get(id).then(function (node) {
    return self.executeHooks('beforeSave', node);
  }).then(function () {
    return self.getStoreClient().then(function (client) {
      return client.update({

        index: self.getIndex(),
        type: self._type,
        id: id,
        body: {
          doc: update
        },
        refresh: true
      })
    });
  }).then(function () {
    // fetch the updated document
    // TODO: another IO
    return self.findById(id);
  }).then(function (data) {
    /**
     * Fired when a document is inserted
     *
     * @event insert
     */
    //self.emit('update', data);
    return self.executeHooks('afterSave', data);
  });
};

/**
 * Drop all documents in this Node
 *
 * @returns {Promise}
 */
Node.drop = function () {
  var self = this;

  return self.getStoreClient().then(function (client) {
    return client.deleteByQuery({
      index: self.store._index,
      type: self._type,
      body: {
        query: {
          match_all: {}
        }
      }
    });
  });
};


/**
 * Drop all documents in this Node
 *
 * @returns {Promise}
 */
Node.findAndRemove = function (filter) {
  var self = this;

  var filteredQuery = _constructSimpleFilteredQuery(filter);

  return self.getStoreClient().then(function (client) {
    return client.deleteByQuery({
      index: self.getIndex(),
      type: self._type,
      body: {
        query: filteredQuery
      }
    });
  });
};

/**
 * Finds a document by its identifier and remove it.
 *
 * @method remove
 * @param {*} _id
 * @return {Promise}
 */
Node.remove = function (_id) {
  var self = this;

  _id = _id || this._id;

  if (!_id) {
    throw new ElasticstoreError('_id is required but missing');
  }

  return self.findById(_id)
    .then(function (data) { // Pre-hooks
      if (data == null) {
        throw new ElasticstoreError('ID `' + _id + '` does not exist');
      }
      return self.executeHooks('beforeSave', data);
    }).then(function (data) { // Removes data

      // delete data from ElasticSearch
      return self.getStoreClient().then(function (client) {
        return client.delete({
          index: self.getIndex(),
          type: self._type,
          id: _id,
          refresh: true
        }).then(function (resp) {
          /**
           * Fired when a document is removed
           *
           * @event remove
           */
          //self.emit('remove', data);
          return data;
        });
      })
    }).then(function (data) {
      return self.executeHooks('afterSave', data);
    });
};

Node.removeById = Node.remove;

/**
 * Returns the number of elements.
 *
 * @method count
 * @return {Number}
 */
Node.count = function () {
  var self = this;
  return this.getStoreClient().then(function (client) {
    return client.count({
      index: self.getIndex(),
      type: self._type
    }).then(function (resp) {
      return resp.count;
    });
  });
};


/**
 * Finds matching documents.
 *
 * @method find
 * @param {Object} filter
 * @param {Object} options
 * @return {Array}
 */
Node.find = function (filter, options) {
  var self = this;

  // filter is an object, like {predicate: "hastag", object: "tagID"}
  // we need to convert it to an array, passed to MUST boolean filter
  // TODO: add test cases
  var query = _constructSimpleFilteredQuery(filter);

  // if filter is null or empty, we return all documents
  if (!filter || _.keys(filter).length == 0) {
    delete query.filtered.filter;
  }

  var limit = (options && options.limit) ? options.limit : 10;
  var skip = (options && options.skip) ? options.skip : 0;

  var constructor;
  if (self instanceof Node) {
    constructor = self.constructor;
  } else {
    constructor = self;
  }

  return self.getStoreClient().then(function (client) {
    return client.search({
      index: self.getIndex(),
      type: self._type,
      body: {
        query: query
      },
      size: limit,
      from: skip
    }).then(function (resp) {
      return _.map(resp.hits.hits, function (hit) {

        // _id is not included in the _source field
        hit._source._id = hit._id;

        return new constructor(hit._source);
      });
    }).catch(function (err) {
      throw err;
    });
  });
};


/**
 * Finds the first matching documents.
 *
 * @method findOne
 * @param {Object} query
 * @return {Document|Object}
 */
Node.findOne = function (query) {

  return this.find(query).then(function (docs) {
    if (docs.length > 0) {
      return docs[0];
    } else {
      return null;
    }
  });
};

Node.findAll = function (query) {
  return this.find(query, {limit: 10000});
};

Node.deleteMapping = function () {
  var self = this;
  return self.getStoreClient().then(function (client) {
    return client.indices.deleteMapping({
      index: self.getIndex(),
      type: self._type
    }).catch(function (err) {
      console.log('error deleting mappings');
      console.log(err);
    });
  });
};

/**
 * Returns a plain JavaScript object, which can be safely saved to database
 *
 * @method toObject
 * @return {Object}
 */
Node.prototype.toObject = function(){
  var keys = Object.keys(this);
  var obj = {};
  var key;

  // remove afflicted properties
  keys = _.without(keys, 'store', '_type', '_schema');

  for (var i = 0, len = keys.length; i < len; i++){
    key = keys[i];
    obj[key] = _.cloneDeep(this[key]);
  }

  return obj;
};


Node.prototype.save = function () {
  return this.constructor.insert(this.toObject());
};

Node.prototype.update = function (updates) {
  return this.constructor.updateById(this._id, updates);
};

Node.prototype.remove = function () {
  return this.constructor.removeById(this._id);
};


module.exports = Node;