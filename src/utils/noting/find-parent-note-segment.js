var isNoteSegment = require('../noting/is-note-segment');
var isVFocus = require('../vfocus/is-vfocus');

module.exports = function findParentNote(focus) {

  if (!isVFocus(focus)) {
    throw new Error('Only a VFocus element should be passed to findParentNote');
  }

  return focus.find(isNoteSegment, 'up');
};
