define(function () {

  /*
   * Plugin for adding a <note> elements around
   * things.
   */

  'use strict';

  return function (user) {
    return function(scribe) {

      //currently
      var tag = "gu:note";
      var nodeName = "GU:NOTE";
      var className = "note";
      var dataName = "data-edited-by";
      var dataDate = "data-edited-date";
      var blocks = ["P", "LI", "UL"];
      var inline = ["B", "I", "EM"]; //more to come
      var noteCommand = new scribe.api.Command('insertHTML');


      function createWrap() {
        var wrap = document.createElement(tag);
        wrap.className = className;
        var date = new Date().getTime().toString();
        wrap.setAttribute("data-edited-by", user);
        wrap.setAttribute("data-edited-date", date);
        return wrap;
      }


      /*
       * TODO: Need to wrap inline elements inside the span
       * rather than the span inside the block element
       * this should fix a lot of issues to do with
       * selecting a B and some of not a b etc.
       * if it has a parent element that can go inside
       * spans, then use the parent element
       */

      function wrapText(content) {
        // wrap the contents of a text node
        // they behave diffent
        // elements like I and B can be put inside the span
        var wrap = createWrap();
        var value = content;


        // we try and wrap inline elements as this makes it easier for
        // merging and altering things
        if (content.parentNode && isInlineElement(content.parentNode)) {
          value = content;
        }

        wrap.appendChild(value);
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
        temp.appendChild(wrap);
        return temp;
      }

      function isInlineElement(node) {
        return blocks.indexOf(node.nodeName) !== -1;
      }

      function isBlockElement (node) {
        return blocks.indexOf(node.nodeName) !== -1;
      }

      function hasBlockElements (range) {
        var childNodes = range.childNodes;

        childNodes = Array.prototype.slice.call(childNodes);

        var temp = childNodes.filter(function (item) {
          return isBlockElement(item);
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

      /*
       * These two function are for moving in and out of the scribe-markers
       * for merging purposes - they are only used when merging
       */
      function getPreviousSibling (node) {
        var previous = node.previousSibling;

        if (!previous) {
          return null;
        }

        if (checkScribeMarker(node.previousSibling)
            && node.previousSibling.previousSibling) {
          previous = node.previousSibling.previousSibling;
        }
        return previous;
      }

      function getNextSibling (node) {
        var next = node.nextSibling;

        if (!next) {
          return null;
        }

        if (checkScribeMarker(node.nextSibling)
            && node.nextSibling.nextSibling) {
          next = node.nextSibling.nextSibling;
        }
        return next;
      }

      function canMerge (node) {
        var prev = getPreviousSibling(node);
        var next = getNextSibling(node);

        /*
         * If the previousSibling or nextSibling is a block element - the note is inside it
         */
        if (prev && isBlockElement(prev)) {
          prev = prev.childNodes[0];
        }

        if (next && isBlockElement(next)) {
          next = next.childNodes[0];
        }

        return (prev && isNote(prev))
          || (next && isNote(getNextSibling(node)));
      }

      function walk(node, func) {
        var nodeIterator = document.createNodeIterator(node);
        var currentNode;
        while (currentNode = nodeIterator.nextNode()) {
          if (!currentNode) {
            return;
          }
          func(currentNode);
        }
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
       * This wraps all elements between the scribe markers in a note class.
       */
      function wrapBlocks (range) {
        var commonAncestor = range.commonAncestorContainer;
        var nodes = buildNodeList(commonAncestor, function (node) {
          return !checkScribeMarker(node)
            && (getScribeMarker(node.childNodes) === -1);
        });

        debugger;
        nodes.forEach(function (item) {
          if (canMerge(item)) {
            // issues here with block and text element
            merge(item);
          } else {
            replace(item);
          }
        });
      }

      function merge(node) {
        /*
         * Some issues arise in merging.
         * Namely, how should we merge a B and somehing else?
         * It we wrapped the nodes in a span that would be okay but
         * we don't do that.
         */


        // determine what a node should be merged with
        var parent = node.parentNode;
        var previousSibling = getPreviousSibling(node);
        var nextSibling = getNextSibling(node);
        var content;
        debugger;
        if (node.nodeType === Node.TEXT_NODE) {
          content = node;
        } else {
          content = node.innerHTML;
        }

        if (isNote(previousSibling)) {
          // left merge
          previousSibling.appendChild(content);
        } else {
          // right merge
          nextSibling.insertBefore(content, nextSibling.childNodes[0]);
        }

        /* as we do a greedy left merge
         * there will only ever be a node on the right that
         * needs to be merged into this node
         * so next we try and merge again but only
         * to the right
         */
        if (isNote(nextSibling)) {
          // append the contents of the nextSibling to this node
          // and delete the nextSibling
          var temp;
          if (nextSibling.childNodes[0].nodeType === Node.TEXT_NODE) {
            temp = nextSibling.childNodes[0];
          } else {
            temp = nextSibling.innerHTML;
          }
          previousSibling.appendChild(temp);
          parent.removeChild(nextSibling);
        }
      }

      function replace(item) {
        var wrap;
        var parent = item.parentNode;
        var sibling = item.nextSibling;
        // create an empty text element and insert
        // it afer the note so people can move outside it
        var text = document.createTextNode(" ");
        text.innerText = " ";

        // replace the item with it's expected
        // note
        if (item.nodeType === Node.TEXT_NODE) {
          // this is for a basic selection
          wrap = wrapText(item);
        } else {
          wrap =  wrapBlock(item);
        }


        /* this will not work currently
         at the moment. As the if we're wrapping an
         inline element the parent will be wrong.
         Using the grandparent won't help either
         as the scribe-marker has the inline element as its
         parent so insertBefore will not work
         */

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

        if(! selection.selection.isCollapsed) {
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

      scribe.commands.note = noteCommand;

      scribe.el.addEventListener('keydown', function (event) {
        //that's F10 and F8 and alt+del
        if (event.keyCode === 121 ||event.keyCode === 119) {
          event.preventDefault();
          var noteCommand = scribe.getCommand("note");
          noteCommand.execute();
        }
      });
    };
  };
});
