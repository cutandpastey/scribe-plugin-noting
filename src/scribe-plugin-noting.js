define(function () {

  /*
   * Plugin for adding a <note> elements around
   * things.
   */

  'use strict';

  return function (user) {
    return function(scribe) {

      //currently
      var tag = "gu-note";
      var nodeName = "GU-NOTE";
      var className = "note";
      var dataName = "data-edited-by";
      var dataDate = "data-edited-date";
      var blocks = ["P", "LI", "UL"];

      var noteCommand = new scribe.api.Command('insertHTML');


      function createWrap() {
        var wrap = document.createElement(tag);
        wrap.className = className;
        var date = new Date().getTime().toString();
        wrap.setAttribute("data-edited-by", user);
        wrap.setAttribute("data-edited-date", date);
        return wrap;

      }

      function wrapText(content) {
        //wrap the contents of a text node
        // they behave diffent
        var wrap = createWrap();
        wrap.appendChild(content);
        return wrap;
      }

      function wrapBlock(block) {
        // for this one we need to get the text
        // inside as the clone will wrap this in a p and
        // we'll have to do more magic. So we append the
        // wrap to the element inside the block
        // there are some issues with LIs and Bs at the moment
        var wrap = createWrap();
        var temp = block.cloneNode(true);
        wrap.innerHTML = temp.innerHTML;
        temp.appendChild(wrap);
        return temp;
      }

      function hasBlockElements (range) {
        var childNodes = range.childNodes;

        childNodes = Array.prototype.slice.call(childNodes);

        var temp = childNodes.filter(function (item) {
          return blocks.indexOf(item.nodeName) !== -1;
        });

        return temp.length > 0;
      }

      function checkScribeMarker (node) {
        return checkClass(node, "scribe-marker");
      }

      function checkClass(node, value) {
        if (!node.classList) {
          return false;
        }
        return node.classList.contains(value);
      }


      function isNote (node) {
        return node.tagName === nodeName;
      }

      function findScribeMarker(node) {
        if (checkScribeMarker(node)) {
          // the passed node could also be the marker
          return 1;
        }

        for(var i = 0, len = node.childNodes.length; i < len; i++) {
          if(checkScribeMarker(node.childNodes[i])) {
            return i;
          }
        }
        return -1;
      };


      /* Alternative to merge is to check existing notes and
       * just expand the note accordingly. Look at the selection
       * and see what is next door to it. If it's a note then
       * just append it*/


      function canMerge(node) {
        return isNote(node.previousSibling)
          || isNote(node.nextSibling);
      }

      function mergeNotes(selection, range) {
        selection.placeMarkers();
        selection.selectMarkers(true);
        var nodes = buildNodeList(range.commonAncestorContainer, function (node) {
          return isNote(node);
        });
        nodes.forEach(function (item) {
          // problem I can see is that some of these will already be merged
          if (canMerge(item)) {
            merge(node);
          }
        });
      }

      function walk(node, func) {
        // this is a semi-recursive tree descent
        // although it's a shame it uses a loop
        // this could be trivially rewritten to be
        // fully recursive
        // this is far simpler than doing rubbish
        // with do whiles
        if (!node) {
          return;
        }

        var children = node.childNodes;

        for (var i = 0; i < children.length; i++) {
          walk(children[i], func);
        }

        func(node);
      }

      function unwrap (element) {
        // get the innercontent and move it in place of the element
        // TODO: Only does a basic unwrap - does not do the inner
        // elements
        var innerNode = element.firstChild;
        var parent = element.parentNode;
        parent.replaceChild(innerNode, element);
      }

      function getScribeMarker(arr) {
        for (var i = 0, len = arr.length; i < len; i++) {
          var el = arr[i];
          if(checkScribeMarker(arr[i])) {
            return i;
          }
        }
        return -1;
      }

      function buildNodeList (tree, predicate) {
        // walk a tree and build a list of nodes that need to be wrapped
        var scribeMarkerLocated = false;
        var done = false;
        var nodeList = [];
        walk(tree, function (node) {

          if (done) {
            return; //do nothing
          }


          if (checkScribeMarker(node)) {
            // begin pushing elements
            if (scribeMarkerLocated === true) {
              done = true;
            } else {
              scribeMarkerLocated = true;
            }
          }

          if (!done && scribeMarkerLocated && predicate(node)) {
            //scribe markers do not get pushed
            nodeList.push(node);
          }

        });
        return nodeList;
      }



      /*
       * This wraps all elements that contain block elements
       * in a note class.
       */
      function wrapBlocks (range) {

        var commonAncestor = range.commonAncestorContainer;

        var nodes = buildNodeList(commonAncestor, function (node) {
          return !checkScribeMarker(node)
            && (getScribeMarker(node.childNodes) === -1);
        });


        nodes.forEach(function (item) {
          var wrap;
          var parent = item.parentNode;
          var sibling = item.nextSibling;

          debugger;


          if (canMerge(item)) {
            merge(item);
          } else {
            replace(item);
          }
        });
      }

      function merge(node) {
        // determine what a node should be merged with
        var parent = node.parentNode;
        var previousSibling = node.previousSibling;
        var nextSibling = node.previousSibling;
        var content = node.innerHTML;

        if (previousSibling) {
          previousSibling.appendChild(content);
        } else if (nextSibling) {
          nextSibling.appendChild(content);
        }

        // remove the node empty note
        parent.removeChild(node);

      }

      function replace(item) {
        // replace the item with it's expected
        // note
        if (item.nodeType === Node.TEXT_NODE) {
          // this is for a basic selection
          wrap = wrapText(item);
        } else {
          wrap =  wrapBlock(item);
        }

        // replace directly on the tree
        if (sibling) {
          parent.insertBefore(wrap, sibling);
        } else {
          parent.appendChild(wrap);
        }

      }

      function basicUnwrap( range) {
        // this is a seriously flaky way of doing it at the moment
        // I think there are much better alternatives
        // TODO: Investigate if it's even worth doing this on an undo
        // might just be able to use unwrap in the same way as it works
        // when there are block elements.

        var commonAncestor = range.commonAncestorContainer;
        var parent = commonAncestor.parentNode;

        // this is random - but basically the range thinks the
        // span is the common ancestor if we only select a little bit of
        // the note
        if (commonAncestor.nextSibling) {
          parent = commonAncestor.nextSibling.parentNode;
        } else if (commonAncestor.previousSibling) {
          parent = commonAncestor.previousSibling.parentNode;
        }


        var contents = document.createTextNode(commonAncestor.innerText);
        parent.replaceChild(contents, commonAncestor);


      }


      function descentUnwrap (range) {
        // remove all styling from elements within the range
        // in this case they have selected multiple nodes
        // do a recursive unwrap
        var commonAncestor = range.commonAncestorContainer;
        var toBeUnWrapped = buildNodeList(commonAncestor, function (node) {
          return isNote(node);
        });

        toBeUnWrapped = Array.prototype.slice.call(toBeUnWrapped);

        toBeUnWrapped.forEach(function (item) {
          unwrap(item);
        });

      }


      noteCommand.execute = function () {

        var selection = new scribe.api.Selection();
        var range = selection.range;
        var cloned = range.cloneContents();
        // drop markers so we can operate on all the sub elements in the selection
        selection.placeMarkers();
        selection.selectMarkers(true);

        // if the selection is the whole line, then we need to note the whole line
        // if it isn't then we just do the bit selected and nothing else.
        // selection.selection.data currently will duplicate things if there is no
        // actual selection
        if(selection.selection.type === "Range") {

          if (this.queryState()) {

            if (!hasBlockElements(cloned)) {
              basicUnwrap(range);
            } else {
              descentUnwrap(range);
            }
          } else {
            wrapBlocks(range);
          }
          selection.selectMarkers();
          // TODO: empty the selection and place the caret after it
        }
      };

      noteCommand.queryState = function () {
        // TODO: The instance in which there are more scribe nodes
        // clone the range and see if there are spans in it
        var selection = new scribe.api.Selection();
        var scribeEls = selection.range.cloneContents().querySelectorAll('.note');
        var containsNote = function (scribeEls) {
          for (var i = 0, len = scribeEls.length; i < len; i++) {
            if (isNote(scribeEls[i])) {
              return true;
            }
          }
        };

        // check if there is a note in the selection
        var isNode = !!selection.getContaining(function (node) {
          return isNote(node);
        });

        return isNode || containsNote(scribeEls);

      };


      noteCommand.queryEnabled = function () {
        var selection = new scribe.api.Selection();
        var headingNode = selection.getContaining(function (node) {
          return (/^(H[1-6])$/).test(node.nodeName);
        });

        return scribe.api.CommandPatch.prototype.queryEnabled.apply(this, arguments) && ! headingNode;
      };


      scribe.commands.note = noteCommand;

      /* There may be case when we don't want to use the default commands */

      scribe.el.addEventListener('keydown', function (event) {
        //that's F10 and F8
        if (event.keyCode === 121 ||event.keyCode === 119) {
          var noteCommand = scribe.getCommand("note");
          var selection = new scribe.api.Selection();
          var range = selection.range;

          noteCommand.execute();
        }
      });
    };
  };
});
