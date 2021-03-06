var isVFocus = require('../vfocus/is-vfocus');
var VFocus = require('../../vfocus');
var findScribeMarkers = require('./find-scribe-markers');
var findParentNoteSegment = require('./find-parent-note-segment');
var findEntireNote = require('./find-entire-note');

module.exports = function findSelectedNote(focus) {

  if (!isVFocus(focus)) {
    throw new Error('Only a valid VFocus element can be passed to findSelectedNote');
  }

  var markers = findScribeMarkers(focus);
  if (markers.length <= 0) {
    return;
  }

  var firstMarker = markers[0];

  var note = findParentNoteSegment(firstMarker);
  if (!note) {
    return;
  }

  return note && findEntireNote(note) || undefined;

};
