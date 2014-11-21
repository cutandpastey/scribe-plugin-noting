/**
 * Noting API
 *
 * Perform noting actions on a Virtual DOM
 */
'use strict';

var h = require('virtual-hyperscript');
var isVText = require('vtree/is-vtext');
var VText = require('vtree/vtext');
var _ = require('lodash');

var NODE_NAME = 'GU-NOTE';
var TAG = 'gu-note';

var CLASS_NAME = 'note';
var DATA_NAME = 'data-note-edited-by';
var DATA_NAME_CAMEL = 'noteEditedBy';
var DATA_DATE = 'data-note-edited-date';
var DATA_DATE_CAMEL = 'noteEditedDate';
var NOTE_BARRIER_TAG = 'gu-note-barrier';


var vdom = require('./note-vdom');


/**
 * Current User property must be set.
 * @type {String}
 */
exports.user = 'unknown';

/**
* Noting: Create, remove, wrap etc.
*/

// Wrap in a note.
// toWrap can be a vNode, DOM node or a string. One or an array with several.
function wrapInNote(toWrap, dataAttrs) {
  var nodes = toWrap instanceof Array ? toWrap : [toWrap];

  // Note that we have to clone dataAttrs or several notes might end up
  // sharing the same dataset object.
  var dataAttrs = dataAttrs ? _.clone(dataAttrs) : {};

  var note = h(TAG + '.' + CLASS_NAME, {title: getEditedByTitleText(dataAttrs), dataset: dataAttrs}, nodes);
  return note;
}

function unwrap(focus) {
  var note = focus.vNode;
  var noteContents = note.children;
  var indexOfNode = focus.parent.vNode.children.indexOf(note);

  // Do the unwrapping.
  focus.parent.vNode.children.splice(indexOfNode, 1, noteContents); // replace note
  focus.parent.vNode.children = _.flatten(focus.parent.vNode.children);

  // We want the note contents to now have their grandparent as parent.
  // The safest way we can ensure this is by changing the VFocus object
  // that previously focused on the note to instead focus on its parent.
  focus.vNode = focus.parent.vNode;
  focus.parent = focus.parent.parent;
}

function addUniqueVNodeClass(vNode, name) {
  var classes = vNode.properties.className.split(' ');
  classes.push(name);

  vNode.properties.className = _.uniq(classes).join(' ');
}

function removeVNodeClass(vNode, name) {
  var classes = vNode.properties.className.split(' ');
  var classId = classes.indexOf(name);

  if (classId !== -1) {
    classes.splice(classId, 1);
    vNode.properties.className = classes.join(' ');
  }
}

function generateUUID(){
  /* jshint bitwise:false */
  var d = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x7|0x8)).toString(16);
  });
  return uuid;
};

// Update note properties, adding them if they aren't already there.
// Note that this is also a way of merging notes, as we update the
// start and end classes as well as give the segments the same edited
// by information.
function updateNoteProperties(noteSegments) {
  updateStartAndEndClasses(noteSegments);

  // FIXME JP 20/11/14
  // This is removed as it causes significant performance issues
  //noteSegments.forEach(updateEditedBy);

  var uuid = generateUUID();
  noteSegments.forEach(function (segment) {
    segment.vNode.properties.dataset['noteId'] = uuid;
  });

  var treeFocus = noteSegments[0].top();
  updateNoteBarriers(treeFocus);
}

// Ensure the first (and only the first) note segment has a
// `note--start` class and that the last (and only the last)
// note segment has a `note--end` class.
function updateStartAndEndClasses(noteSegments) {
  function addStartAndEndClasses(noteSegments) {
    addUniqueVNodeClass(noteSegments[0].vNode, 'note--start');
    addUniqueVNodeClass(noteSegments[noteSegments.length - 1].vNode, 'note--end');
  }

  function removeStartAndEndClasses(noteSegments) {
    noteSegments.forEach(function(segment) {
      removeVNodeClass(segment.vNode, 'note--start');
      removeVNodeClass(segment.vNode, 'note--end');
    });
  }

  removeStartAndEndClasses(noteSegments);
  addStartAndEndClasses(noteSegments);
}

function getEditedByTitleText(dataAttrs) {
  var date = new Date(dataAttrs[DATA_DATE_CAMEL]),

  // crude formatting avoids a "momentjs" dependency - should be adequate
  // forced UK formatted time in local timezone:  dd/MM/YYYY at hh:mm
  formattedDate = [
    date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear(),
    'at',
    date.getHours() + ':' + (date.getMinutes() < 9 ? '0' : '') + date.getMinutes()
  ].join(' ');

  return dataAttrs[DATA_NAME_CAMEL] + '  ' + formattedDate;
}

function updateEditedBy(noteSegment) {
  var dataset = userAndTimeAsDatasetAttrs();

  noteSegment.vNode.properties.dataset[DATA_NAME_CAMEL] = dataset[DATA_NAME_CAMEL];
  noteSegment.vNode.properties.dataset[DATA_DATE_CAMEL] = dataset[DATA_DATE_CAMEL];

  noteSegment.vNode.properties.title = getEditedByTitleText(dataset);
}

function userAndTimeAsDatasetAttrs() {
  var dataset = {};
  dataset[DATA_NAME_CAMEL] = exports.user;
  dataset[DATA_DATE_CAMEL] = new Date().toISOString();

  return dataset;
}

function createVirtualScribeMarker() {
  return h('em.scribe-marker', []);
}

// We need these to make it possible to place the caret immediately
// inside/outside of a note.
function createNoteBarrier() {
  return new VText('\u200B');
}

function updateNoteBarriers(treeFocus) {
  function removeNoteBarriers(treeFocus) {
    treeFocus.filter(vdom.focusOnTextNode).forEach(function (focus) {
      focus.vNode.text = focus.vNode.text.replace(/\u200B/g, '');
    });
  }

  function insertNoteBarriers(treeFocus) {
    vdom.findAllNotes(treeFocus).forEach(function (noteSegments) {
      _.first(noteSegments).next().insertBefore(createNoteBarrier());


      // This is necessarily complex (been through a few iterations) because
      // of Chrome's lack of flexibility when it comes to placing the caret.
      var afterNote = _.last(noteSegments).find(vdom.focusOutsideNote);
      var textNodeAfterNoteFocus = afterNote && afterNote.find(vdom.focusOnNonEmptyTextNode);

      if (textNodeAfterNoteFocus) {
        textNodeAfterNoteFocus.vNode.text = '\u200B' + textNodeAfterNoteFocus.vNode.text;
      }

    });
  }

  removeNoteBarriers(treeFocus);
  insertNoteBarriers(treeFocus);
}


// tree - tree containing a marker.
// Note that we will mutate the tree.
function createEmptyNoteAtCaret(treeFocus) {
  // We need a zero width space character to make the note selectable.
  var zeroWidthSpace = '\u200B';

  // To make sure the caret is placed within the note we place a scribe
  // maker within it.
  // Chrome is picky about needing the space to be before the marker
  // (otherwise the caret won't be placed within the note).
  var replacementVNode = wrapInNote([zeroWidthSpace, createVirtualScribeMarker()], userAndTimeAsDatasetAttrs());

  // We assume there's only one marker.
  var marker = vdom.findMarkers(treeFocus)[0];
  marker.replace(replacementVNode);

  var noteSegments = vdom.findEntireNote(marker);
  updateNoteProperties(noteSegments);
}

// treeFocus: tree focus of tree containing two scribe markers
// Note that we will mutate the tree.
function createNoteFromSelection(treeFocus) {
  // We want to wrap text nodes between the markers. We filter out nodes that have
  // already been wrapped.
  var toWrapAndReplace = vdom.findTextNodeFocusesBetweenMarkers(treeFocus).filter(vdom.focusOutsideNote);


  // Wrap the text nodes.
  var userAndTime = userAndTimeAsDatasetAttrs();
  var wrappedTextNodes = toWrapAndReplace.map(function (focus) {
    return wrapInNote(focus.vNode, userAndTime);
  });


  // Replace the nodes in the tree with the wrapped versions.
  _.zip(toWrapAndReplace, wrappedTextNodes).forEach(function(focusAndReplacementVNode) {
    var focus = focusAndReplacementVNode[0];
    var replacementVNode = focusAndReplacementVNode[1];

    focus.replace(replacementVNode);
  });


  // If we end up with an empty note a <BR> tag would be created. We have to do
  // this before we remove the markers.
  preventBrTags(treeFocus);


  // We want to place the caret after the note. First we have to remove the
  // existing markers.
  vdom.removeVirtualScribeMarkers(treeFocus);


  // Update note properties (merges if necessary).
  var lastNoteSegment = vdom.findLastNoteSegment(toWrapAndReplace[0]);

  var noteSegments = vdom.findEntireNote(lastNoteSegment);
  updateNoteProperties(noteSegments);


  // Now let's place that caret.
  var outsideNoteFocus = _.last(noteSegments).find(vdom.focusOutsideNote);

  // We guard against the case when the user notes the last piece of text in a
  // Scribe instance. In that case we don't bother placing the cursor.
  // (What behaviour would a user expect?)
  if (outsideNoteFocus) {
    if (! vdom.focusOnParagraph(outsideNoteFocus)) {
      // The user's selection ends within a paragraph.

      // To place a marker we have to place an element inbetween the note barrier
      // and the marker, or Chrome will place the caret inside the note.
      outsideNoteFocus.insertBefore([new VText('\u200B'), createVirtualScribeMarker()]);

    } else {

      // The user's selection ends with a whole paragraph being selected. Now
      // we need to place the caret in a different manner (or we will end up
      // with a new empty paragraph). So we place the caret at the start of the
      // next paragraph.
      var focus = outsideNoteFocus.find(vdom.focusOnNonEmptyTextNode);
      if (focus) focus.insertBefore(createVirtualScribeMarker());
    }
  }

  vdom.removeEmptyNotes(treeFocus);
}

function unnote(treeFocus) {
  // We assume the caller knows there's only one marker.
  var marker = vdom.findMarkers(treeFocus)[0];

  // We can't use findEntireNote here since it'll sometimes give us the wrong result.
  // See `findEntireNote` documentation. Instead we look the note up by its ID.
  var noteSegment = vdom.findAncestorNoteSegment(marker);
  var noteSegments = vdom.findNote(treeFocus, noteSegment.vNode.properties.dataset.noteId);

  noteSegments.forEach(unwrap);

  // Take care of any leftover note barriers, which can prevent double clicking
  // a word from selecting the whole word).
  updateNoteBarriers(treeFocus);

  // The marker is where we want it to be (the same position) so we'll
  // just leave it.
}


/*
Unnote part of note, splitting the rest of the original note into new notes.

Example
-------
Text within a note has been selected:

  <p>Asked me questions about the vessel<gu-note>|, the time she left Marseilles|, the
  course she had taken,</gu-note> and what was her cargo. I believe, if she had not
  been laden, and I had been her master, he would have bought her.</p>


We find the entire note and, within the note, we note everything _but_ what we want to unnote:

  <p>Asked me questions about the vessel<gu-note>, the time she left Marseilles<gu-note>, the
  course she had taken,</gu-note></gu-note> and what was her cargo. I believe, if she had not
  been laden, and I had been her master, he would have bought her.</p>


Then we unwrap the previously existing note. The text we selected has been unnoted:

  <p>Asked me questions about the vessel, the time she left Marseilles<gu-note>, the
  course she had taken,</gu-note> and what was her cargo. I believe, if she had not
  been laden, and I had been her master, he would have bought her.</p>

*/
function unnotePartOfNote(treeFocus) {
  function notToBeUnnoted(focus) {
    var candidateVTextNode = focus.vNode;
    return textNodesToUnnote.indexOf(candidateVTextNode) === -1;
  }

  var focusesToUnnote = vdom.findTextNodeFocusesBetweenMarkers(treeFocus);
  var entireNote = vdom.findEntireNote(focusesToUnnote[0]);


  var entireNoteTextNodeFocuses = _(entireNote).map(vdom.focusAndDescendants)
    .flatten().value().filter(vdom.focusOnTextNode);

  var entireNoteTextNodes = entireNoteTextNodeFocuses.map(function (focus) { return focus.vNode; });


  var textNodesToUnnote = focusesToUnnote.map(function (focus) { return focus.vNode; });
  var toWrapAndReplace = _.difference(entireNoteTextNodes, textNodesToUnnote);


  var focusesToNote = entireNoteTextNodeFocuses.filter(notToBeUnnoted);
  var userAndTime = userAndTimeAsDatasetAttrs();


  // Wrap the text nodes.
  var wrappedTextNodes = toWrapAndReplace.map(function (vNode) {
    return wrapInNote(vNode, userAndTime);
  });

  // Replace the nodes in the tree with the wrapped versions.
  _.zip(focusesToNote, wrappedTextNodes).forEach(function(focusAndReplacementVNode) {
    var focus = focusAndReplacementVNode[0];
    var replacementVNode = focusAndReplacementVNode[1];

    focus.replace(replacementVNode);
  });

  // Unwrap previously existing note.
  entireNote.forEach(unwrap);


  // Unless the user selected the entire note contents, notes to the left
  // and/or right of the selection will have been created. We need to update
  // their attributes and CSS classes.
  var onlyPartOfContentsSelected = focusesToNote[0];

  if (onlyPartOfContentsSelected) {
    var treeFocus = focusesToNote[0].top();
    exports.ensureNoteIntegrity(treeFocus);
  }


  // Place marker immediately before the note to the right (this way of doing
  // that seems to be the most reliable for some reason). Both Chrome and
  // Firefox have issues with this however. To force them to behave we insert
  // an empty span element inbetween.
  var markers = vdom.findMarkers(treeFocus.refresh());
  _.last(markers).insertAfter(new VText('\u200B'));
  markers[0].remove();


  // If the user selected everything but a space (or zero width space), we remove
  // the remaining note. Most likely that's what our user intended.
  vdom.removeEmptyNotes(treeFocus.refresh());
}


/*
  Example. We have two notes:
  <p>
    <gu-note>Some noted text</gu-note>| and some other text inbetween |<gu-note>More noted text</gu-note>
  </p>

  We press BACKSPACE, deleting the text, and end up with:
  <p>
    <gu-note data-note-edited-by="Edmond Dantès" data-note-edited-date="2014-09-15T16:49:20.012Z">Some noted text</gu-note><gu-note data-note-edited-by="Lord Wilmore" data-note-edited-date="2014-09-20T10:00:00.012Z">More noted text</gu-note>
  </p>

  This function will merge the notes:
  <p>
    <gu-note data-note-edited-by="The Count of Monte Cristo" data-note-edited-date="2014-10-10T17:00:00.012Z">Some noted text</gu-note><gu-note data-note-edited-by="The Count of Monte Cristo" data-note-edited-date="2014-10-10T17:00:00.012Z">More noted text</gu-note>
  </p>

  The last user to edit "wins", the rationale being that they have approved
  these notes by merging them. In this case all note segments are now
  listed as being edited by The Count of Monte Cristo and the timestamp
  shows the time when the notes were merged.
*/
function mergeIfNecessary(treeFocus) {

  function inconsistentTimestamps(note) {
    function getDataDate(noteSegment) {
      return noteSegment.vNode.properties.dataset[DATA_DATE_CAMEL];
    }

    var uniqVals = _(note).map(getDataDate).uniq().value();
    return uniqVals.length > 1;
  }

  function lacksStartOrEnd(note) {
    var hasNoteStart = 'noteStart' in note[0].vNode.properties.dataset;
    var hasNoteEnd = 'noteEnd' in note[note.length - 1].vNode.properties.dataset;

    return ! (hasNoteStart && hasNoteEnd);
  }

  // Merging is simply a matter of updating the attributes of any notes
  // where all the segments of the note doesn't have the same timestamp,
  // or where there's no start or end property (e.g. when the user has deleted
  // the last note segment of a note).
  function criteria(note) { return inconsistentTimestamps(note) || lacksStartOrEnd(note); }

  //vdom.findAllNotes(treeFocus).filter(criteria).forEach(updateNoteProperties);
}


// In a contenteditable, Scribe currently insert a <BR> tag into empty elements.
// This causes styling issues when the user deletes a part of a note,
// e.g. using backspace. This function provides a workaround and should be run
// anytime a note segment might be empty (as defined by `vdom.consideredEmpty`).
// TODO: Fix this in Scribe.
function preventBrTags(treeFocus) {
  function isTrue(obj) { return !!obj; }

  function removeEmptyAncestors(focus) {
    var f = focus;
    while (f) {
      if (! f.canDown()) f.remove();
      f = f.up();
    }
  }

  // When we delete a space we want to add a space to the previous
  // note segment.
  function addSpaceToPrevSegment(segment) {
      var prevNoteSegment = segment.prev().find(vdom.focusOnNote, 'prev');

      if (prevNoteSegment) {
        var lastTextNode = _.last(prevNoteSegment.vNode.children.filter(isVText));
        if (lastTextNode) lastTextNode.text = lastTextNode.text + ' ';
      }
  }

  // We're only interested in when content is removed, meaning
  // there should only be one marker (a collapsed selection).
  //
  // Could possibly develop a way of knowing deletions from
  // additions, but this isn't necessary at the moment.
  var markers = vdom.findMarkers(treeFocus);
  if (markers.length === 2) return;


  // We're good to go.
  var marker = markers[0];

  // Let's find any note segment before or after the marker.
  var segments = [
    marker.find(vdom.focusOnNote, 'prev'),
    marker.find(vdom.focusOnNote)
  ].filter(isTrue);

  // Replace/delete empty notes, and parents that might have become empty.
  segments.filter(function (segment) { return !!segment; })
    .map(function (segment) {
      if (vdom.withEmptyTextNode(segment)) addSpaceToPrevSegment(segment);

      if (vdom.withoutText(segment) || vdom.withEmptyTextNode(segment)) {
      // In Chrome, removing causes text before the note to be deleted when
      // deleting the last note segment. Replacing with an empty node works
      // fine in Chrome and FF.
      var replaced = segment.replace(new VText('\u200B'));

      removeEmptyAncestors(replaced);
    }
  });
}


exports.ensureNoteIntegrity = function (treeFocus) {
  mergeIfNecessary(treeFocus);
  updateNoteBarriers(treeFocus);
  preventBrTags(treeFocus);
};


exports.toggleNoteAtSelection = function toggleNoteAtSelection(treeFocus, selection) {
  function state() {
    var selectionMarkers = vdom.findMarkers(treeFocus);
    var selectionIsCollapsed = selectionMarkers.length === 1;
    var withinNote = vdom.selectionEntirelyWithinNote(selectionMarkers);

    var state;
    if (selectionIsCollapsed && withinNote) {
      state = 'caretWithinNote';
    } else if (withinNote) {
      state = 'selectionWithinNote';
    } else if (selectionIsCollapsed) {
      state = 'caretOutsideNote';
    } else {
      state = 'selectionOutsideNote'; // at least partially outside.
    }

    return state;
  }

  var scenarios = {
    caretWithinNote: function (treeFocus) { unnote(treeFocus); },
    selectionWithinNote: function (treeFocus) {  unnotePartOfNote(treeFocus);  },
    caretOutsideNote: function (treeFocus) { createEmptyNoteAtCaret(treeFocus); },
    selectionOutsideNote: function (treeFocus) { createNoteFromSelection(treeFocus); }
  };

  // Perform action depending on which state we're in.
  scenarios[state()](treeFocus);
};

// TODO: Replace with `selectionEntirelyWithinNote`.
exports.isSelectionInANote = function isSelectionInANote(selectionRange, parentContainer) {

  // Walk up the (real) DOM checking isTargetNode.
  function domWalkUpFind(node, isTargetNode) {
    if (!node.parentNode || node === parentContainer) { return false; }

    return isTargetNode(node) ? node : domWalkUpFind(node.parentNode, isTargetNode);
  }

  // Return the note our selection is inside of, if we are inside one.
  function domFindAncestorNote(node) {
    return domWalkUpFind(node, function(node) {
      return node.tagName === NODE_NAME;
    });
  }

  return domFindAncestorNote(selectionRange.startContainer) && domFindAncestorNote(selectionRange.endContainer) && true;
};
