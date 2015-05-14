var Promise = require('bluebird');
var EventEmitter = require('events').EventEmitter;
var ElasticstoreError = require('./error');
var util = require('util');
var _ = require('lodash');

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
  var query = {
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

  return query;
}

function NodeOperation() {
  EventEmitter.call(this);
  this.store = this.store || this.constructor.store;
}

util.inherits(NodeOperation, EventEmitter);

NodeOperation.prototype.getContext = function () {
  return this.context || this.constructor.context;
};

NodeOperation.prototype.getStore = function () {
  return this.store || this.constructor.store;
};

NodeOperation.prototype.getIndex = function () {
  return this.getStore()._index;
};

NodeOperation.prototype.getType = function () {
  return this._type || this.constructor._type;
};

NodeOperation.prototype.getStoreClient = function () {
  return this.getStore().getClient();
}

/**
 * Create a new node instance
 *
 * @param data
 * @returns {*} an instance of Node
 */
NodeOperation.prototype.createInstance = function (data) {

  var constructor;

  if (this instanceof NodeOperation) {
    constructor = this.constructor;
  } else {
    constructor = this;
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
NodeOperation.prototype.get = function (id) {
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

NodeOperation.prototype.findById = NodeOperation.prototype.get;

NodeOperation.prototype.addHook = function (hookName, hookFn) {
  this.hooks = this.hooks || {};
  this.hooks[hookName] = this.hooks[hookName] || [];
  this.hooks[hookName].push(hookFn);
};

NodeOperation.prototype.executeHooks = function (hookName, data) {
  this.hooks = this.hooks || {};

  var hooks = this.hooks[hookName] || [];
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
NodeOperation.prototype._saveOne = function (data) {
  var self = this;
  var result;

  return Promise.resolve(self.createInstance(data)).then(function (data) {
    // Pre-hooks
    return self.executeHooks('beforeSave', data);
  }).then(function (data) {
    // Insert data to ElasticSearch
    return self.getStoreClient().then(function (client) {

      var _type = data._type || self._type;

      return client.index({
        index: self.store._index,
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

        //return new Node(data);
        // depends on the type of this
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
NodeOperation.prototype.save = function (data) {
  var self = this;

  if (_.isArray(data)) {
    return Promise.map(data, function (item) {
      return self._saveOne(item);
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
    return this._saveOne(data);
  }
};

/**
 * Finds a document by its identifier and update it.
 *
 * @method updateById
 * @param {*} id
 * @return {Promise}
 */
NodeOperation.prototype.updateById = function (id, update) {
  // Check ID
  if (!id) {
    return new Promise(function (resovle, reject) {
      return reject(new ElasticstoreError('ID is not defined'));
    });
  }

  var self = this;

  return self.get(id).then(function (node) {
    return self.executeHooks('beforeSave', node);
  }).then(function () {
    return self.getStoreClient().then(function (client) {
      return client.update({

        index: self.store._index,
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
 * Drop all documents in this NodeOperation
 *
 * @returns {Promise}
 */
NodeOperation.prototype.drop = function () {
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
 * Drop all documents in this NodeOperation
 *
 * @returns {Promise}
 */
NodeOperation.prototype.findAndRemove = function (filter) {
  var self = this;

  var filteredQuery = _constructSimpleFilteredQuery(filter);

  return self.getStoreClient().then(function (client) {
    return client.deleteByQuery({
      index: self.store._index,
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
NodeOperation.prototype.remove = function (_id) {
  var self = this;

  _id = _id || this._id;

  if (!_id) {
    throw new ElasticstoreError('_id is required but missing');
  }

  return self.get(_id)
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

NodeOperation.prototype.removeById = NodeOperation.prototype.remove;

/**
 * Returns the number of elements.
 *
 * @method count
 * @return {Number}
 */
NodeOperation.prototype.count = function () {
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
NodeOperation.prototype.find = function (filter, options) {
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
  if (self instanceof NodeOperation) {
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
NodeOperation.prototype.findOne = function (query) {

  return this.find(query).then(function (docs) {
    if (docs.length > 0) {
      return docs[0];
    } else {
      return null;
    }
  });
};

NodeOperation.prototype.findAll = function (query) {
  return this.find(query, {limit: 10000});
};

NodeOperation.prototype.deleteMapping = function () {
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

module.exports = NodeOperation;
