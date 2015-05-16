exports.config = {
  ES_HOST: '127.0.0.1:27184',
  DB_NAME: 'organized-test',
  DB_VERSION: 1
};

describe('Warehouse', function () {
  require('./scripts/database');
  require('./scripts/node');
  require('./scripts/schematype');
  require('./scripts/types/array');
  require('./scripts/types/boolean');
  require('./scripts/types/cuid');
  require('./scripts/types/date');
  require('./scripts/types/enum');
  require('./scripts/types/integer');
  require('./scripts/types/number');
  require('./scripts/types/object');
  require('./scripts/types/string');
  require('./scripts/types/virtual');
  require('./scripts/util');
});