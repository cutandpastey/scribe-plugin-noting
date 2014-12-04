var path = require('path');
var chai = require('chai');
var expect = chai.expect;
var h = require('virtual-hyperscript');

var VFocus = require(path.resolve(process.cwd(), 'src/vfocus'));
var isNotEmptyVFocus = require(path.resolve(process.cwd(), 'src/utils/vfocus/is-not-empty'));

var emptyP;
var containerP;

beforeEach(function() {
  emptyP = new VFocus(h('p'));
  containerP = new VFocus(h('p', 'This is some text'));
});

describe('vfocus isEmpty()', function() {

  it('should correctly identify a VFocus with children', function() {
    expect(isNotEmptyVFocus(emptyP)).to.be.false;
  });

  it('should corectly identify an empty VFocus', function(){
    expect(isNotEmptyVFocus(containerP)).to.be.true;
  });

});