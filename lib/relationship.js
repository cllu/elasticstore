var Node = require('./node');
var util = require('util');

/**
 * We simulate the node relationship using Node.
 * @constructor
 */
function Relationship(data) {
  Node.call(this, data);
}

Relationship._type = 'relationship';

/**
 * valid predicate:
 *
 * - hasTag
 * - hasCategory
 * - hasParentCategory
 * - hasAsset
 */
Relationship._schema = {
  subject: {type: String},
  predicate: {type: String},
  object: {type: String}
};

util.inherits(Relationship, Node);

module.exports = Relationship;
