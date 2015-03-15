'use strict';

var JSONStream = require('JSONStream');
var Promise = require('bluebird');
var fs = require('graceful-fs');
var Model = require('./model');
var Schema = require('./schema');
var SchemaType = require('./schematype');
var util = require('./util');
var WarehouseError = require('./error');
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

  this._es_index = this.options.name;

  /**
   * Models.
   *
   * @property {Object} _models
   * @private
   */
  this._models = {};

  /**
   * Model constructor for this database instance.
   *
   * @property {Function} Model
   * @param {String} name
   * @param {Schema|Object} [schema]
   * @constructor
   * @private
   */
  var _Model = this.Model = function (name, schema) {
    Model.call(this, name, schema);
  };

  util.inherits(_Model, Model);
  _Model.prototype._database = this;
}

/**
 * Creates a new model.
 *
 * @method model
 * @param {String} name
 * @param {Schema|Object} [schema]
 * @return {Model}
 */
Database.prototype.model = function (name, schema) {
  if (this._models[name]) {
    return this._models[name];
  }

  var model = this._models[name] = new this.Model(name, schema);
  return model;
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
    throw new WarehouseError('No database name has been specified');
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

    return client.indices.create({index: index}).then(function () {
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

  return pUpgradeOrDowngrade.nodeify(callback);
};

/**
 * Drop all the data
 */
Database.prototype.drop = function (callback) {
  //this.client.indices.delete({index: this.options.name}),
  return this.client.indices.deleteMapping({index: this.options.name, type: '_all'})
    .catch(function(err){
      console.log(err);
    }).
    nodeify(callback);
};

/**
 * Close the ElasticSearch connection.
 *
 * @method save
 * @param {Function} callback
 * @return {Promise}
 */
Database.prototype.close = function (callback) {
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