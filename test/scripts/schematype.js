var should = require('chai').should();
var ValidationError = require('../../lib/error/validation');

describe('SchemaType', function(){
  var SchemaType = require('../../lib/schematype');
  var type = new SchemaType('test');

  it('cast()', function(){
    type.cast(123).should.eql(123);
  });

  it('cast() - default', function(){
    var type = new SchemaType('test', {default: 'foo'});
    type.cast().should.eql('foo');
  });

  it('validate()', function(){
    type.validate(123).should.eql(123);
  });

  it('validate() - required', function(){
    var type = new SchemaType('test', {required: true});
    type.validate().should.be
      .instanceOf(ValidationError)
      .property('message', '`test` is required!');
  });

  it('parse()', function(){
    type.parse(123).should.eql(123);
  });

  it('value()', function(){
    type.value(123).should.eql(123);
  });

  it('match()', function(){
    type.match(1, 1).should.be.true;
    type.match(1, '1').should.be.false;
  });

});
