var isVFocus = require('../vfocus/is-vfocus');
var isWithinNote = require('./is-within-note');
var isNoteSegment = require('./is-note-segment');
var findFirstNoteSegment = require('./find-first-note-segment');
// Find the rest of a note.
// We identify notes based on 'adjacency' rather than giving them an id.
// This is because people may press RETURN or copy and paste part of a note.
// In such cases we don't want that to keep being the same note.
//
// This has a caveat when:
// 1. A note covers 3 paragraphs.
// 2. Part of a note in paragraph 2 is unnoted.
// 3. The caret is placed in paragraph 3.
// 4. The noting key is pressed.
// findFirstNoteSegmentSegment will then move backwards over a P
// and into the first note. We will then unnote the first
// note rather than the second.
//

module.exports = function findEntireNote(focus) {

  if (!isVFocus(focus)) {
    throw new Error('Only a valid VFocus element can be passed to findEntirenote');
  }

  var firstNoteSegment = findFirstNoteSegment(focus);

  if(!firstNoteSegment) {
    return;
  }

  return firstNoteSegment.takeWhile(isWithinNote).filter(isNoteSegment);

};
