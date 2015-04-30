var Node = require('./node');
var util = require('util');

/**
 * We simulate the node relationship using Node.
 * @constructor
 */
function Relationship() {
  Node.call(this);

  this.schema = {
    subject: {type: String},
    /**
     * valid predicate:
     *
     * - hasTag
     * - hasCategory
     * - hasParentCategory
     * - hasAsset
     */
    predicate: {type: String},
    object: {type: String}
  };
}

util.inherits(Relationship, Node);

module.exports = Relationship;
