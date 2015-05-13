'use strict';

var Promise = require('bluebird');
var Schema = require('./schema');
var SchemaType = require('./schematype');
var util = require('./util');
var ElasticstoreError = require('./error');
var pkg = require('../package.json');
var extend = util.extend;
var elasticsearch = require('elasticsearch');

/**
 * Database constructor.
 *
 * @class Database
 * @param {Object} [options]
 *   @param {Number} [options.version=0] Database version
 *   @param {String} [options.host] ElasticSearch host, such as localhost:9200
 * @constructor
 * @module warehouse
 */
function Database(options) {
  /**
   * Database options.
   *
   * @property {Object} options
   * @private
   */
  this.options = extend({
    version: 0,
    onUpgrade: function () {
    },
    onDowngrade: function () {
    }
  }, options);

  this._index = this.options.name;

  this.Node = this.registerType(require('./node'));
  this.Relationship = this.registerType(require('./relationship'));
}

Database.prototype.registerType = function (Type) {

  Type.store = this;
  Type.save = Type.prototype.save.bind(Type);
  Type._saveOne = Type.prototype._saveOne.bind(Type);
  Type.find = Type.prototype.find.bind(Type);
  Type.findById = Type.prototype.findById.bind(Type);
  Type.get = Type.prototype.get.bind(Type);
  Type.removeById = Type.prototype.removeById.bind(Type);
  Type.remove = Type.prototype.remove.bind(Type);

  // lets create an instance so we can get the _type
  Type._type = Type._type || 'node';

  return Type;
};


/**
 * Connects to the ElasticSearch server.
 *
 * @method connect
 * @param {Function} [callback]
 * @return {Promise}
 */
Database.prototype.connect = function (callback) {

  if (!this.options.name) {
    throw new ElasticstoreError('No database name has been specified');
  }

  this.client = new elasticsearch.Client({
    host: this.options.host,
    //log: 'trace'
    log: 'info'
  });

  var self = this;
  var client = this.client;
  var index = this.options.name;
  var version = this.options.version;

  var pCheckIndex = client.indices.exists({index: index});
  // return the version number if we have created the datastore
  var pEnsureIndexExists = pCheckIndex.then(function (exists) {
    if (exists) return null;

    return client.indices.create({index: index, body: {
      settings: self.options.settings || {},
      mappings: self.options.mappings || {}
    }}).then(function () {
      console.log('datastore has been created');

      // put the version information
      return client.index({
        index: index,
        type: 'elasticstore',
        id: 'version',
        body: {
          version: version
        }
      }).then(function () {
        return version;
      })
    });
  });

  var pCheckVersion = pEnsureIndexExists.then(function (oldVersion) {
    if (oldVersion) return oldVersion;

    return client.get({
      index: index,
      type: 'elasticstore',
      id: 'version'
    }).then(function (resp) {
      return resp._source.version;
    })
  });

  var pUpgradeOrDowngrade = pCheckVersion.then(function (oldVersion) {
    if (oldVersion == version) {
      return null;
    } else if (oldVersion > version) {
      return self.options.onDowngrade(oldVersion, version);
    } else if (oldVersion < version) {
      return self.options.onUpgrade(oldVersion, version);
    }
  });

  return pUpgradeOrDowngrade.catch(function (err) {
    throw err;
  }).nodeify(callback);
};

Database.prototype.getClient = function () {
  var self = this;

  if (self.client) {
    return Promise.resolve(self.client);
  }

  return this.connect().then(function () {
    return self.client;
  })
};

/**
 * Drop all mappings
 */
Database.prototype.dropMappings = function () {
  //this.client.indices.delete({index: this.options.name}),
  return this.client.indices.deleteMapping({index: this.options.name, type: '_all'})
    .catch(function(err){
      console.log(err);
    });
};

/**
 * Drop the whole index, including mappings and data
 */
Database.prototype.drop = function () {
  // no need to perform full connect
  this.client = new elasticsearch.Client({
    host: this.options.host,
    //log: 'trace'
    log: 'info'
  });

  return this.client.indices.delete({index: this.options.name})
    .catch(function (err) {
      throw err;
    });
};

/**
 * Close the ElasticSearch connection.
 *
 * @method save
 * @return {Promise}
 */
Database.prototype.close = function () {
  if (this.client) {
    this.client.close();
  }
};

/**
 * See {% crosslink Schema %}.
 *
 * @property {Schema} Schema
 * @static
 */
Database.Schema = Database.prototype.Schema = Schema;

/**
 * See {% crosslink SchemaType %}.
 *
 * @property {SchemaType} SchemaType
 * @static
 */
Database.SchemaType = Database.prototype.SchemaType = SchemaType;

/**
 * Warehouse version.
 *
 * @property {String} version
 * @static
 */
Database.version = pkg.version;

module.exports = Database;