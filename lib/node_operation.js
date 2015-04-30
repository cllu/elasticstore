var Promise = require('bluebird');
var EventEmitter = require('events').EventEmitter;
var ElasticstoreError = require('./error');
var util = require('util');
var _ = require('lodash');


function NodeOperation() {
  EventEmitter.call(this);
}

util.inherits(NodeOperation, EventEmitter);

/**
 * Finds a document by its identifier.
 *
 * @method get
 * @param {*} id
 * @param {Function} callback
 * @return {Document}
 */
NodeOperation.prototype.get = function (id, callback) {
  var self = this;
  return self.store.getClient().then(function (client) {
    return client.get({
      index: self.store._index,
      type: self._type,
      id: id
    }).then(function (resp) {
      if (resp._source) {
        var data = resp._source;
        return new self(data);
      } else {
        return null;
      }
    }, function (err) {
      if (err.message == 'Not Found') {
        return null;
      } else {
        throw err;
      }
    }).catch(function(err) {
      throw err;
    });
  }).nodeify(callback);
};

NodeOperation.prototype.findById = NodeOperation.prototype.get;

function execHooks(schema, type, event, data) {
  // FIXME:
  return Promise.resolve(data);

  var hooks = schema.hooks[type][event];
  if (!hooks.length) return Promise.resolve(data);

  return Promise.each(hooks, function (hook) {
    return hook(data);
  }).thenReturn(data);
}

/**
 * Inserts a document.
 *
 * @method _saveOne
 * @param {Object} data_
 * @param {Function} [callback]
 * @return {Promise}
 */
NodeOperation.prototype._saveOne = function (data_, callback) {
  var self = this;
  console.log('self');
  console.log(self);
  var schema = this.schema;
  var result;

  var Node = require('./node');

  return new Promise(function (resolve, reject) {
    // Apply getters
    //var data = data_ instanceof self.Document ? data_ : new self.Document(data_);
    var data = data_ instanceof self ? data_ : new self(data_);
    var id = data._id;

    console.log('data');
    console.log(data);

    // Check ID
    if (!id) {
      return reject(new ElasticstoreError('ID is not defined'));
    }

    resolve(data);
  }).then(function (data) {
        // Apply setters
        //result = data.toObject();
        //var err = schema._applySetters(result);
        //
        //if (err) return Promise.reject(err);

        // Pre-hooks
        return execHooks(schema, 'pre', 'save', data);
      }).then(function (data) {
        // Insert data to ElasticSearch
        return self.store.getClient().then(function (client) {

          return client.index({
            index: self.store._index,
            type: data._type,
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
            return new Node(data);
          });
        });
      }).then(function (data) {
        return execHooks(schema, 'post', 'save', data);
      }).nodeify(callback);
};

/**
 * Save one or more documents.
 *
 * @method save
 * @param {Object|Array} data
 * @param {Function} [callback]
 * @return {Promise}
 */
NodeOperation.prototype.save = function (data, callback) {
  var self = this;

  if (_.isArray(data)) {
    return Promise.map(data, function (item) {


      return self._saveOne(item);
    }).then(function(docs){
      return self.store.getClient().then(function (client) {
        return client.indices.refresh({
          index: self.store._index
        }).then(function() {
          return docs;
        });
      })
    }).nodeify(callback);
  } else {
    return this._saveOne(data, callback);
  }
};

/**
 * Finds a document by its identifier and update it.
 *
 * @method updateById
 * @param {*} id
 * @param {Object} update
 * @param {Function} [callback]
 * @return {Promise}
 */
NodeOperation.prototype.updateById = function (id, update, callback) {
  // Check ID
  if (!id) {
    return new Promise(function (resovle, reject) {
      return reject(new ElasticstoreError('ID is not defined'));
    });
  }

  var self = this;

  return self.get(id)
      .then(function (doc) {
        return execHooks(self.schema, 'pre', 'save', doc)
      })
      .then(function () {
        return self.store.getClient().then(function (client) {
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
      })
      .then(function () {
        // fetch the updated document
        // TODO: another IO
        return self.get(id);
      })
      .then(function (data) {
        /**
         * Fired when a document is inserted
         *
         * @event insert
         */
        //self.emit('update', data);
        return execHooks(self.schema, 'post', 'save', data);
      })
      .nodeify(callback);
};

/**
 * Drop all documents in this NodeOperation
 *
 * @param callback
 * @returns {Promise}
 */
NodeOperation.prototype.drop = function (callback) {
  var self = this;

  return self.store.getClient().then(function (client) {
    return client.deleteByQuery({
      index: self.store._index,
      type: self._type,
      body: {
        query: {
          match_all: {}
        }
      }
    });
  }).nodeify(callback);
};


/**
 * Finds a document by its identifier and remove it.
 *
 * @method remove
 * @param {*} id
 * @param {Function} [callback]
 * @return {Promise}
 */
NodeOperation.prototype.remove = function (id, callback) {
  var self = this;
  var schema = this.schema;

  return self.get(id)
      .then(function (data) { // Pre-hooks
        if (data == null) {
          throw new ElasticstoreError('ID `' + id + '` does not exist');
        }
        return execHooks(schema, 'pre', 'remove', data);
      }).then(function (data) { // Removes data

        // delete data from ElasticSearch
        return self.store.getClient().then(function (client) {
          return client.delete({
            index: self.store._index,
            type: self._type,
            id: id,
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
        return execHooks(schema, 'post', 'remove', data);
      })
      .nodeify(callback);
};

NodeOperation.prototype.removeById = NodeOperation.prototype.remove;

/**
 * Returns the number of elements.
 *
 * @method count
 * @return {Number}
 */
NodeOperation.prototype.count = function (callback) {
  var self = this;
  return this.store.getClient().then(function (client) {
    return client.count({
      index: self.store._index,
      type: self._type
    }).then(function (resp) {
      return resp.count;
    });
  }).nodeify(callback);
};

/**
 * Finds matching documents.
 *
 * @method find
 * @param {Object} filter
 * @param {Object} options
 * @param {Function} callback
 * @return {Array}
 */
NodeOperation.prototype.find = function (filter, options, callback) {
  var self = this;

  // filter is an object, like {predicate: "hastag", object: "tagID"}
  // we need to convert it to an array, passed to MUST boolean filter
  // TODO: add test cases
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
  // if filter is null or empty, we return all documents
  if (!filter || _.keys(filter).length == 0) {
    delete query.filtered.filter;
  }

  var limit = (options && options.limit) ? options.limit : 10;
  var skip = (options && options.skip) ? options.skip : 0;

  return self.store.getClient().then(function (client) {
    return client.search({
      index: self.store._index,
      type: self._type,
      body: {
        query: query
      },
      size: limit,
      from: skip
    }).then(function (resp) {
      return _.map(resp.hits.hits, function (hit) {
        return new self.Document(hit._source);
      });
    }).catch(function(err) {
      throw err;
    });
  }).nodeify(callback);
};


/**
 * Finds the first matching documents.
 *
 * @method findOne
 * @param {Object} query
 * @return {Document|Object}
 */
NodeOperation.prototype.findOne = function(query){

  return this.find(query).then(function (docs) {
    if (docs.length > 0) {
      return docs[0];
    } else {
      return null;
    }
  });
};

NodeOperation.prototype.findAll = function(query) {
  return this.find(query, {limit: 10000});
};

NodeOperation.prototype.deleteMapping = function (callback) {
  var self = this;
  return self.store.getClient().then(function (client) {
    return client.indices.deleteMapping({
      index: self.store._index,
      type: self._type
    }).catch(function (err) {
      console.log('error deleting mappings');
      console.log(err);
    });
  }).nodeify(callback);
};

module.exports = NodeOperation;
