"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

/*!
Waypoints - 4.0.1
Copyright Â© 2011-2016 Caleb Troughton
Licensed under the MIT license.
https://github.com/imakewebthings/waypoints/blob/master/licenses.txt
*/
(function () {
  'use strict';

  var keyCounter = 0;
  var allWaypoints = {};
  /* http://imakewebthings.com/waypoints/api/waypoint */

  function Waypoint(options) {
    if (!options) {
      throw new Error('No options passed to Waypoint constructor');
    }

    if (!options.element) {
      throw new Error('No element option passed to Waypoint constructor');
    }

    if (!options.handler) {
      throw new Error('No handler option passed to Waypoint constructor');
    }

    this.key = 'waypoint-' + keyCounter;
    this.options = Waypoint.Adapter.extend({}, Waypoint.defaults, options);
    this.element = this.options.element;
    this.adapter = new Waypoint.Adapter(this.element);
    this.callback = options.handler;
    this.axis = this.options.horizontal ? 'horizontal' : 'vertical';
    this.enabled = this.options.enabled;
    this.triggerPoint = null;
    this.group = Waypoint.Group.findOrCreate({
      name: this.options.group,
      axis: this.axis
    });
    this.context = Waypoint.Context.findOrCreateByElement(this.options.context);

    if (Waypoint.offsetAliases[this.options.offset]) {
      this.options.offset = Waypoint.offsetAliases[this.options.offset];
    }

    this.group.add(this);
    this.context.add(this);
    allWaypoints[this.key] = this;
    keyCounter += 1;
  }
  /* Private */


  Waypoint.prototype.queueTrigger = function (direction) {
    this.group.queueTrigger(this, direction);
  };
  /* Private */


  Waypoint.prototype.trigger = function (args) {
    if (!this.enabled) {
      return;
    }

    if (this.callback) {
      this.callback.apply(this, args);
    }
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/destroy */


  Waypoint.prototype.destroy = function () {
    this.context.remove(this);
    this.group.remove(this);
    delete allWaypoints[this.key];
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/disable */


  Waypoint.prototype.disable = function () {
    this.enabled = false;
    return this;
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/enable */


  Waypoint.prototype.enable = function () {
    this.context.refresh();
    this.enabled = true;
    return this;
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/next */


  Waypoint.prototype.next = function () {
    return this.group.next(this);
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/previous */


  Waypoint.prototype.previous = function () {
    return this.group.previous(this);
  };
  /* Private */


  Waypoint.invokeAll = function (method) {
    var allWaypointsArray = [];

    for (var waypointKey in allWaypoints) {
      allWaypointsArray.push(allWaypoints[waypointKey]);
    }

    for (var i = 0, end = allWaypointsArray.length; i < end; i++) {
      allWaypointsArray[i][method]();
    }
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/destroy-all */


  Waypoint.destroyAll = function () {
    Waypoint.invokeAll('destroy');
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/disable-all */


  Waypoint.disableAll = function () {
    Waypoint.invokeAll('disable');
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/enable-all */


  Waypoint.enableAll = function () {
    Waypoint.Context.refreshAll();

    for (var waypointKey in allWaypoints) {
      allWaypoints[waypointKey].enabled = true;
    }

    return this;
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/refresh-all */


  Waypoint.refreshAll = function () {
    Waypoint.Context.refreshAll();
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/viewport-height */


  Waypoint.viewportHeight = function () {
    return window.innerHeight || document.documentElement.clientHeight;
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/viewport-width */


  Waypoint.viewportWidth = function () {
    return document.documentElement.clientWidth;
  };

  Waypoint.adapters = [];
  Waypoint.defaults = {
    context: window,
    continuous: true,
    enabled: true,
    group: 'default',
    horizontal: false,
    offset: 0
  };
  Waypoint.offsetAliases = {
    'bottom-in-view': function bottomInView() {
      return this.context.innerHeight() - this.adapter.outerHeight();
    },
    'right-in-view': function rightInView() {
      return this.context.innerWidth() - this.adapter.outerWidth();
    }
  };
  window.Waypoint = Waypoint;
})();

(function () {
  'use strict';

  function requestAnimationFrameShim(callback) {
    window.setTimeout(callback, 1000 / 60);
  }

  var keyCounter = 0;
  var contexts = {};
  var Waypoint = window.Waypoint;
  var oldWindowLoad = window.onload;
  /* http://imakewebthings.com/waypoints/api/context */

  function Context(element) {
    this.element = element;
    this.Adapter = Waypoint.Adapter;
    this.adapter = new this.Adapter(element);
    this.key = 'waypoint-context-' + keyCounter;
    this.didScroll = false;
    this.didResize = false;
    this.oldScroll = {
      x: this.adapter.scrollLeft(),
      y: this.adapter.scrollTop()
    };
    this.waypoints = {
      vertical: {},
      horizontal: {}
    };
    element.waypointContextKey = this.key;
    contexts[element.waypointContextKey] = this;
    keyCounter += 1;

    if (!Waypoint.windowContext) {
      Waypoint.windowContext = true;
      Waypoint.windowContext = new Context(window);
    }

    this.createThrottledScrollHandler();
    this.createThrottledResizeHandler();
  }
  /* Private */


  Context.prototype.add = function (waypoint) {
    var axis = waypoint.options.horizontal ? 'horizontal' : 'vertical';
    this.waypoints[axis][waypoint.key] = waypoint;
    this.refresh();
  };
  /* Private */


  Context.prototype.checkEmpty = function () {
    var horizontalEmpty = this.Adapter.isEmptyObject(this.waypoints.horizontal);
    var verticalEmpty = this.Adapter.isEmptyObject(this.waypoints.vertical);
    var isWindow = this.element == this.element.window;

    if (horizontalEmpty && verticalEmpty && !isWindow) {
      this.adapter.off('.waypoints');
      delete contexts[this.key];
    }
  };
  /* Private */


  Context.prototype.createThrottledResizeHandler = function () {
    var self = this;

    function resizeHandler() {
      self.handleResize();
      self.didResize = false;
    }

    this.adapter.on('resize.waypoints', function () {
      if (!self.didResize) {
        self.didResize = true;
        Waypoint.requestAnimationFrame(resizeHandler);
      }
    });
  };
  /* Private */


  Context.prototype.createThrottledScrollHandler = function () {
    var self = this;

    function scrollHandler() {
      self.handleScroll();
      self.didScroll = false;
    }

    this.adapter.on('scroll.waypoints', function () {
      if (!self.didScroll || Waypoint.isTouch) {
        self.didScroll = true;
        Waypoint.requestAnimationFrame(scrollHandler);
      }
    });
  };
  /* Private */


  Context.prototype.handleResize = function () {
    Waypoint.Context.refreshAll();
  };
  /* Private */


  Context.prototype.handleScroll = function () {
    var triggeredGroups = {};
    var axes = {
      horizontal: {
        newScroll: this.adapter.scrollLeft(),
        oldScroll: this.oldScroll.x,
        forward: 'right',
        backward: 'left'
      },
      vertical: {
        newScroll: this.adapter.scrollTop(),
        oldScroll: this.oldScroll.y,
        forward: 'down',
        backward: 'up'
      }
    };

    for (var axisKey in axes) {
      var axis = axes[axisKey];
      var isForward = axis.newScroll > axis.oldScroll;
      var direction = isForward ? axis.forward : axis.backward;

      for (var waypointKey in this.waypoints[axisKey]) {
        var waypoint = this.waypoints[axisKey][waypointKey];

        if (waypoint.triggerPoint === null) {
          continue;
        }

        var wasBeforeTriggerPoint = axis.oldScroll < waypoint.triggerPoint;
        var nowAfterTriggerPoint = axis.newScroll >= waypoint.triggerPoint;
        var crossedForward = wasBeforeTriggerPoint && nowAfterTriggerPoint;
        var crossedBackward = !wasBeforeTriggerPoint && !nowAfterTriggerPoint;

        if (crossedForward || crossedBackward) {
          waypoint.queueTrigger(direction);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        }
      }
    }

    for (var groupKey in triggeredGroups) {
      triggeredGroups[groupKey].flushTriggers();
    }

    this.oldScroll = {
      x: axes.horizontal.newScroll,
      y: axes.vertical.newScroll
    };
  };
  /* Private */


  Context.prototype.innerHeight = function () {
    /*eslint-disable eqeqeq */
    if (this.element == this.element.window) {
      return Waypoint.viewportHeight();
    }
    /*eslint-enable eqeqeq */


    return this.adapter.innerHeight();
  };
  /* Private */


  Context.prototype.remove = function (waypoint) {
    delete this.waypoints[waypoint.axis][waypoint.key];
    this.checkEmpty();
  };
  /* Private */


  Context.prototype.innerWidth = function () {
    /*eslint-disable eqeqeq */
    if (this.element == this.element.window) {
      return Waypoint.viewportWidth();
    }
    /*eslint-enable eqeqeq */


    return this.adapter.innerWidth();
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/context-destroy */


  Context.prototype.destroy = function () {
    var allWaypoints = [];

    for (var axis in this.waypoints) {
      for (var waypointKey in this.waypoints[axis]) {
        allWaypoints.push(this.waypoints[axis][waypointKey]);
      }
    }

    for (var i = 0, end = allWaypoints.length; i < end; i++) {
      allWaypoints[i].destroy();
    }
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/context-refresh */


  Context.prototype.refresh = function () {
    /*eslint-disable eqeqeq */
    var isWindow = this.element == this.element.window;
    /*eslint-enable eqeqeq */

    var contextOffset = isWindow ? undefined : this.adapter.offset();
    var triggeredGroups = {};
    var axes;
    this.handleScroll();
    axes = {
      horizontal: {
        contextOffset: isWindow ? 0 : contextOffset.left,
        contextScroll: isWindow ? 0 : this.oldScroll.x,
        contextDimension: this.innerWidth(),
        oldScroll: this.oldScroll.x,
        forward: 'right',
        backward: 'left',
        offsetProp: 'left'
      },
      vertical: {
        contextOffset: isWindow ? 0 : contextOffset.top,
        contextScroll: isWindow ? 0 : this.oldScroll.y,
        contextDimension: this.innerHeight(),
        oldScroll: this.oldScroll.y,
        forward: 'down',
        backward: 'up',
        offsetProp: 'top'
      }
    };

    for (var axisKey in axes) {
      var axis = axes[axisKey];

      for (var waypointKey in this.waypoints[axisKey]) {
        var waypoint = this.waypoints[axisKey][waypointKey];
        var adjustment = waypoint.options.offset;
        var oldTriggerPoint = waypoint.triggerPoint;
        var elementOffset = 0;
        var freshWaypoint = oldTriggerPoint == null;
        var contextModifier, wasBeforeScroll, nowAfterScroll;
        var triggeredBackward, triggeredForward;

        if (waypoint.element !== waypoint.element.window) {
          elementOffset = waypoint.adapter.offset()[axis.offsetProp];
        }

        if (typeof adjustment === 'function') {
          adjustment = adjustment.apply(waypoint);
        } else if (typeof adjustment === 'string') {
          adjustment = parseFloat(adjustment);

          if (waypoint.options.offset.indexOf('%') > -1) {
            adjustment = Math.ceil(axis.contextDimension * adjustment / 100);
          }
        }

        contextModifier = axis.contextScroll - axis.contextOffset;
        waypoint.triggerPoint = Math.floor(elementOffset + contextModifier - adjustment);
        wasBeforeScroll = oldTriggerPoint < axis.oldScroll;
        nowAfterScroll = waypoint.triggerPoint >= axis.oldScroll;
        triggeredBackward = wasBeforeScroll && nowAfterScroll;
        triggeredForward = !wasBeforeScroll && !nowAfterScroll;

        if (!freshWaypoint && triggeredBackward) {
          waypoint.queueTrigger(axis.backward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        } else if (!freshWaypoint && triggeredForward) {
          waypoint.queueTrigger(axis.forward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        } else if (freshWaypoint && axis.oldScroll >= waypoint.triggerPoint) {
          waypoint.queueTrigger(axis.forward);
          triggeredGroups[waypoint.group.id] = waypoint.group;
        }
      }
    }

    Waypoint.requestAnimationFrame(function () {
      for (var groupKey in triggeredGroups) {
        triggeredGroups[groupKey].flushTriggers();
      }
    });
    return this;
  };
  /* Private */


  Context.findOrCreateByElement = function (element) {
    return Context.findByElement(element) || new Context(element);
  };
  /* Private */


  Context.refreshAll = function () {
    for (var contextId in contexts) {
      contexts[contextId].refresh();
    }
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/context-find-by-element */


  Context.findByElement = function (element) {
    return contexts[element.waypointContextKey];
  };

  window.onload = function () {
    if (oldWindowLoad) {
      oldWindowLoad();
    }

    Context.refreshAll();
  };

  Waypoint.requestAnimationFrame = function (callback) {
    var requestFn = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || requestAnimationFrameShim;
    requestFn.call(window, callback);
  };

  Waypoint.Context = Context;
})();

(function () {
  'use strict';

  function byTriggerPoint(a, b) {
    return a.triggerPoint - b.triggerPoint;
  }

  function byReverseTriggerPoint(a, b) {
    return b.triggerPoint - a.triggerPoint;
  }

  var groups = {
    vertical: {},
    horizontal: {}
  };
  var Waypoint = window.Waypoint;
  /* http://imakewebthings.com/waypoints/api/group */

  function Group(options) {
    this.name = options.name;
    this.axis = options.axis;
    this.id = this.name + '-' + this.axis;
    this.waypoints = [];
    this.clearTriggerQueues();
    groups[this.axis][this.name] = this;
  }
  /* Private */


  Group.prototype.add = function (waypoint) {
    this.waypoints.push(waypoint);
  };
  /* Private */


  Group.prototype.clearTriggerQueues = function () {
    this.triggerQueues = {
      up: [],
      down: [],
      left: [],
      right: []
    };
  };
  /* Private */


  Group.prototype.flushTriggers = function () {
    for (var direction in this.triggerQueues) {
      var waypoints = this.triggerQueues[direction];
      var reverse = direction === 'up' || direction === 'left';
      waypoints.sort(reverse ? byReverseTriggerPoint : byTriggerPoint);

      for (var i = 0, end = waypoints.length; i < end; i += 1) {
        var waypoint = waypoints[i];

        if (waypoint.options.continuous || i === waypoints.length - 1) {
          waypoint.trigger([direction]);
        }
      }
    }

    this.clearTriggerQueues();
  };
  /* Private */


  Group.prototype.next = function (waypoint) {
    this.waypoints.sort(byTriggerPoint);
    var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
    var isLast = index === this.waypoints.length - 1;
    return isLast ? null : this.waypoints[index + 1];
  };
  /* Private */


  Group.prototype.previous = function (waypoint) {
    this.waypoints.sort(byTriggerPoint);
    var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);
    return index ? this.waypoints[index - 1] : null;
  };
  /* Private */


  Group.prototype.queueTrigger = function (waypoint, direction) {
    this.triggerQueues[direction].push(waypoint);
  };
  /* Private */


  Group.prototype.remove = function (waypoint) {
    var index = Waypoint.Adapter.inArray(waypoint, this.waypoints);

    if (index > -1) {
      this.waypoints.splice(index, 1);
    }
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/first */


  Group.prototype.first = function () {
    return this.waypoints[0];
  };
  /* Public */

  /* http://imakewebthings.com/waypoints/api/last */


  Group.prototype.last = function () {
    return this.waypoints[this.waypoints.length - 1];
  };
  /* Private */


  Group.findOrCreate = function (options) {
    return groups[options.axis][options.name] || new Group(options);
  };

  Waypoint.Group = Group;
})();

(function () {
  'use strict';

  var Waypoint = window.Waypoint;

  function isWindow(element) {
    return element === element.window;
  }

  function getWindow(element) {
    if (isWindow(element)) {
      return element;
    }

    return element.defaultView;
  }

  function NoFrameworkAdapter(element) {
    this.element = element;
    this.handlers = {};
  }

  NoFrameworkAdapter.prototype.innerHeight = function () {
    var isWin = isWindow(this.element);
    return isWin ? this.element.innerHeight : this.element.clientHeight;
  };

  NoFrameworkAdapter.prototype.innerWidth = function () {
    var isWin = isWindow(this.element);
    return isWin ? this.element.innerWidth : this.element.clientWidth;
  };

  NoFrameworkAdapter.prototype.off = function (event, handler) {
    function removeListeners(element, listeners, handler) {
      for (var i = 0, end = listeners.length - 1; i < end; i++) {
        var listener = listeners[i];

        if (!handler || handler === listener) {
          element.removeEventListener(listener);
        }
      }
    }

    var eventParts = event.split('.');
    var eventType = eventParts[0];
    var namespace = eventParts[1];
    var element = this.element;

    if (namespace && this.handlers[namespace] && eventType) {
      removeListeners(element, this.handlers[namespace][eventType], handler);
      this.handlers[namespace][eventType] = [];
    } else if (eventType) {
      for (var ns in this.handlers) {
        removeListeners(element, this.handlers[ns][eventType] || [], handler);
        this.handlers[ns][eventType] = [];
      }
    } else if (namespace && this.handlers[namespace]) {
      for (var type in this.handlers[namespace]) {
        removeListeners(element, this.handlers[namespace][type], handler);
      }

      this.handlers[namespace] = {};
    }
  };
  /* Adapted from jQuery 1.x offset() */


  NoFrameworkAdapter.prototype.offset = function () {
    if (!this.element.ownerDocument) {
      return null;
    }

    var documentElement = this.element.ownerDocument.documentElement;
    var win = getWindow(this.element.ownerDocument);
    var rect = {
      top: 0,
      left: 0
    };

    if (this.element.getBoundingClientRect) {
      rect = this.element.getBoundingClientRect();
    }

    return {
      top: rect.top + win.pageYOffset - documentElement.clientTop,
      left: rect.left + win.pageXOffset - documentElement.clientLeft
    };
  };

  NoFrameworkAdapter.prototype.on = function (event, handler) {
    var eventParts = event.split('.');
    var eventType = eventParts[0];
    var namespace = eventParts[1] || '__default';
    var nsHandlers = this.handlers[namespace] = this.handlers[namespace] || {};
    var nsTypeList = nsHandlers[eventType] = nsHandlers[eventType] || [];
    nsTypeList.push(handler);
    this.element.addEventListener(eventType, handler);
  };

  NoFrameworkAdapter.prototype.outerHeight = function (includeMargin) {
    var height = this.innerHeight();
    var computedStyle;

    if (includeMargin && !isWindow(this.element)) {
      computedStyle = window.getComputedStyle(this.element);
      height += parseInt(computedStyle.marginTop, 10);
      height += parseInt(computedStyle.marginBottom, 10);
    }

    return height;
  };

  NoFrameworkAdapter.prototype.outerWidth = function (includeMargin) {
    var width = this.innerWidth();
    var computedStyle;

    if (includeMargin && !isWindow(this.element)) {
      computedStyle = window.getComputedStyle(this.element);
      width += parseInt(computedStyle.marginLeft, 10);
      width += parseInt(computedStyle.marginRight, 10);
    }

    return width;
  };

  NoFrameworkAdapter.prototype.scrollLeft = function () {
    var win = getWindow(this.element);
    return win ? win.pageXOffset : this.element.scrollLeft;
  };

  NoFrameworkAdapter.prototype.scrollTop = function () {
    var win = getWindow(this.element);
    return win ? win.pageYOffset : this.element.scrollTop;
  };

  NoFrameworkAdapter.extend = function () {
    var args = Array.prototype.slice.call(arguments);

    function merge(target, obj) {
      if (_typeof(target) === 'object' && _typeof(obj) === 'object') {
        for (var key in obj) {
          if (obj.hasOwnProperty(key)) {
            target[key] = obj[key];
          }
        }
      }

      return target;
    }

    for (var i = 1, end = args.length; i < end; i++) {
      merge(args[0], args[i]);
    }

    return args[0];
  };

  NoFrameworkAdapter.inArray = function (element, array, i) {
    return array == null ? -1 : array.indexOf(element, i);
  };

  NoFrameworkAdapter.isEmptyObject = function (obj) {
    /* eslint no-unused-vars: 0 */
    for (var name in obj) {
      return false;
    }

    return true;
  };

  Waypoint.adapters.push({
    name: 'noframework',
    Adapter: NoFrameworkAdapter
  });
  Waypoint.Adapter = NoFrameworkAdapter;
})();
"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

/*
     _ _      _       _
 ___| (_) ___| | __  (_)___
/ __| | |/ __| |/ /  | / __|
\__ \ | | (__|   < _ | \__ \
|___/_|_|\___|_|\_(_)/ |___/
                   |__/

 Version: 1.8.1
  Author: Ken Wheeler
 Website: http://kenwheeler.github.io
    Docs: http://kenwheeler.github.io/slick
    Repo: http://github.com/kenwheeler/slick
  Issues: http://github.com/kenwheeler/slick/issues

 */

/* global window, document, define, jQuery, setInterval, clearInterval */
;

(function (factory) {
  'use strict';

  if (typeof define === 'function' && define.amd) {
    define(['jquery'], factory);
  } else if (typeof exports !== 'undefined') {
    module.exports = factory(require('jquery'));
  } else {
    factory(jQuery);
  }
})(function ($) {
  'use strict';

  var Slick = window.Slick || {};

  Slick = function () {
    var instanceUid = 0;

    function Slick(element, settings) {
      var _ = this,
        dataSettings;

      _.defaults = {
        accessibility: true,
        adaptiveHeight: false,
        appendArrows: $(element),
        appendDots: $(element),
        arrows: true,
        asNavFor: null,
        prevArrow: '<button class="slick-prev" aria-label="Previous" type="button">Previous</button>',
        nextArrow: '<button class="slick-next" aria-label="Next" type="button">Next</button>',
        autoplay: false,
        autoplaySpeed: 3000,
        centerMode: false,
        centerPadding: '50px',
        cssEase: 'ease',
        customPaging: function customPaging(slider, i) {
          return $('<button type="button" />').text(i + 1);
        },
        dots: false,
        dotsClass: 'slick-dots',
        draggable: true,
        easing: 'linear',
        edgeFriction: 0.35,
        fade: false,
        focusOnSelect: false,
        focusOnChange: false,
        infinite: true,
        initialSlide: 0,
        lazyLoad: 'ondemand',
        mobileFirst: false,
        pauseOnHover: true,
        pauseOnFocus: true,
        pauseOnDotsHover: false,
        respondTo: 'window',
        responsive: null,
        rows: 1,
        rtl: false,
        slide: '',
        slidesPerRow: 1,
        slidesToShow: 1,
        slidesToScroll: 1,
        speed: 500,
        swipe: true,
        swipeToSlide: false,
        touchMove: true,
        touchThreshold: 5,
        useCSS: true,
        useTransform: true,
        variableWidth: false,
        vertical: false,
        verticalSwiping: false,
        waitForAnimate: true,
        zIndex: 1000
      };
      _.initials = {
        animating: false,
        dragging: false,
        autoPlayTimer: null,
        currentDirection: 0,
        currentLeft: null,
        currentSlide: 0,
        direction: 1,
        $dots: null,
        listWidth: null,
        listHeight: null,
        loadIndex: 0,
        $nextArrow: null,
        $prevArrow: null,
        scrolling: false,
        slideCount: null,
        slideWidth: null,
        $slideTrack: null,
        $slides: null,
        sliding: false,
        slideOffset: 0,
        swipeLeft: null,
        swiping: false,
        $list: null,
        touchObject: {},
        transformsEnabled: false,
        unslicked: false
      };
      $.extend(_, _.initials);
      _.activeBreakpoint = null;
      _.animType = null;
      _.animProp = null;
      _.breakpoints = [];
      _.breakpointSettings = [];
      _.cssTransitions = false;
      _.focussed = false;
      _.interrupted = false;
      _.hidden = 'hidden';
      _.paused = true;
      _.positionProp = null;
      _.respondTo = null;
      _.rowCount = 1;
      _.shouldClick = true;
      _.$slider = $(element);
      _.$slidesCache = null;
      _.transformType = null;
      _.transitionType = null;
      _.visibilityChange = 'visibilitychange';
      _.windowWidth = 0;
      _.windowTimer = null;
      dataSettings = $(element).data('slick') || {};
      _.options = $.extend({}, _.defaults, settings, dataSettings);
      _.currentSlide = _.options.initialSlide;
      _.originalSettings = _.options;

      if (typeof document.mozHidden !== 'undefined') {
        _.hidden = 'mozHidden';
        _.visibilityChange = 'mozvisibilitychange';
      } else if (typeof document.webkitHidden !== 'undefined') {
        _.hidden = 'webkitHidden';
        _.visibilityChange = 'webkitvisibilitychange';
      }

      _.autoPlay = $.proxy(_.autoPlay, _);
      _.autoPlayClear = $.proxy(_.autoPlayClear, _);
      _.autoPlayIterator = $.proxy(_.autoPlayIterator, _);
      _.changeSlide = $.proxy(_.changeSlide, _);
      _.clickHandler = $.proxy(_.clickHandler, _);
      _.selectHandler = $.proxy(_.selectHandler, _);
      _.setPosition = $.proxy(_.setPosition, _);
      _.swipeHandler = $.proxy(_.swipeHandler, _);
      _.dragHandler = $.proxy(_.dragHandler, _);
      _.keyHandler = $.proxy(_.keyHandler, _);
      _.instanceUid = instanceUid++; // A simple way to check for HTML strings
      // Strict HTML recognition (must start with <)
      // Extracted from jQuery v1.11 source

      _.htmlExpr = /^(?:\s*(<[\w\W]+>)[^>]*)$/;

      _.registerBreakpoints();

      _.init(true);
    }

    return Slick;
  }();

  Slick.prototype.activateADA = function () {
    var _ = this;

    _.$slideTrack.find('.slick-active').attr({
      'aria-hidden': 'false'
    }).find('a, input, button, select').attr({
      'tabindex': '0'
    });
  };

  Slick.prototype.addSlide = Slick.prototype.slickAdd = function (markup, index, addBefore) {
    var _ = this;

    if (typeof index === 'boolean') {
      addBefore = index;
      index = null;
    } else if (index < 0 || index >= _.slideCount) {
      return false;
    }

    _.unload();

    if (typeof index === 'number') {
      if (index === 0 && _.$slides.length === 0) {
        $(markup).appendTo(_.$slideTrack);
      } else if (addBefore) {
        $(markup).insertBefore(_.$slides.eq(index));
      } else {
        $(markup).insertAfter(_.$slides.eq(index));
      }
    } else {
      if (addBefore === true) {
        $(markup).prependTo(_.$slideTrack);
      } else {
        $(markup).appendTo(_.$slideTrack);
      }
    }

    _.$slides = _.$slideTrack.children(this.options.slide);

    _.$slideTrack.children(this.options.slide).detach();

    _.$slideTrack.append(_.$slides);

    _.$slides.each(function (index, element) {
      $(element).attr('data-slick-index', index);
    });

    _.$slidesCache = _.$slides;

    _.reinit();
  };

  Slick.prototype.animateHeight = function () {
    var _ = this;

    if (_.options.slidesToShow === 1 && _.options.adaptiveHeight === true && _.options.vertical === false) {
      var targetHeight = _.$slides.eq(_.currentSlide).outerHeight(true);

      _.$list.animate({
        height: targetHeight
      }, _.options.speed);
    }
  };

  Slick.prototype.animateSlide = function (targetLeft, callback) {
    var animProps = {},
      _ = this;

    _.animateHeight();

    if (_.options.rtl === true && _.options.vertical === false) {
      targetLeft = -targetLeft;
    }

    if (_.transformsEnabled === false) {
      if (_.options.vertical === false) {
        _.$slideTrack.animate({
          left: targetLeft
        }, _.options.speed, _.options.easing, callback);
      } else {
        _.$slideTrack.animate({
          top: targetLeft
        }, _.options.speed, _.options.easing, callback);
      }
    } else {
      if (_.cssTransitions === false) {
        if (_.options.rtl === true) {
          _.currentLeft = -_.currentLeft;
        }

        $({
          animStart: _.currentLeft
        }).animate({
          animStart: targetLeft
        }, {
          duration: _.options.speed,
          easing: _.options.easing,
          step: function step(now) {
            now = Math.ceil(now);

            if (_.options.vertical === false) {
              animProps[_.animType] = 'translate(' + now + 'px, 0px)';

              _.$slideTrack.css(animProps);
            } else {
              animProps[_.animType] = 'translate(0px,' + now + 'px)';

              _.$slideTrack.css(animProps);
            }
          },
          complete: function complete() {
            if (callback) {
              callback.call();
            }
          }
        });
      } else {
        _.applyTransition();

        targetLeft = Math.ceil(targetLeft);

        if (_.options.vertical === false) {
          animProps[_.animType] = 'translate3d(' + targetLeft + 'px, 0px, 0px)';
        } else {
          animProps[_.animType] = 'translate3d(0px,' + targetLeft + 'px, 0px)';
        }

        _.$slideTrack.css(animProps);

        if (callback) {
          setTimeout(function () {
            _.disableTransition();

            callback.call();
          }, _.options.speed);
        }
      }
    }
  };

  Slick.prototype.getNavTarget = function () {
    var _ = this,
      asNavFor = _.options.asNavFor;

    if (asNavFor && asNavFor !== null) {
      asNavFor = $(asNavFor).not(_.$slider);
    }

    return asNavFor;
  };

  Slick.prototype.asNavFor = function (index) {
    var _ = this,
      asNavFor = _.getNavTarget();

    if (asNavFor !== null && _typeof(asNavFor) === 'object') {
      asNavFor.each(function () {
        var target = $(this).slick('getSlick');

        if (!target.unslicked) {
          target.slideHandler(index, true);
        }
      });
    }
  };

  Slick.prototype.applyTransition = function (slide) {
    var _ = this,
      transition = {};

    if (_.options.fade === false) {
      transition[_.transitionType] = _.transformType + ' ' + _.options.speed + 'ms ' + _.options.cssEase;
    } else {
      transition[_.transitionType] = 'opacity ' + _.options.speed + 'ms ' + _.options.cssEase;
    }

    if (_.options.fade === false) {
      _.$slideTrack.css(transition);
    } else {
      _.$slides.eq(slide).css(transition);
    }
  };

  Slick.prototype.autoPlay = function () {
    var _ = this;

    _.autoPlayClear();

    if (_.slideCount > _.options.slidesToShow) {
      _.autoPlayTimer = setInterval(_.autoPlayIterator, _.options.autoplaySpeed);
    }
  };

  Slick.prototype.autoPlayClear = function () {
    var _ = this;

    if (_.autoPlayTimer) {
      clearInterval(_.autoPlayTimer);
    }
  };

  Slick.prototype.autoPlayIterator = function () {
    var _ = this,
      slideTo = _.currentSlide + _.options.slidesToScroll;

    if (!_.paused && !_.interrupted && !_.focussed) {
      if (_.options.infinite === false) {
        if (_.direction === 1 && _.currentSlide + 1 === _.slideCount - 1) {
          _.direction = 0;
        } else if (_.direction === 0) {
          slideTo = _.currentSlide - _.options.slidesToScroll;

          if (_.currentSlide - 1 === 0) {
            _.direction = 1;
          }
        }
      }

      _.slideHandler(slideTo);
    }
  };

  Slick.prototype.buildArrows = function () {
    var _ = this;

    if (_.options.arrows === true) {
      _.$prevArrow = $(_.options.prevArrow).addClass('slick-arrow');
      _.$nextArrow = $(_.options.nextArrow).addClass('slick-arrow');

      if (_.slideCount > _.options.slidesToShow) {
        _.$prevArrow.removeClass('slick-hidden').removeAttr('aria-hidden tabindex');

        _.$nextArrow.removeClass('slick-hidden').removeAttr('aria-hidden tabindex');

        if (_.htmlExpr.test(_.options.prevArrow)) {
          _.$prevArrow.prependTo(_.options.appendArrows);
        }

        if (_.htmlExpr.test(_.options.nextArrow)) {
          _.$nextArrow.appendTo(_.options.appendArrows);
        }

        if (_.options.infinite !== true) {
          _.$prevArrow.addClass('slick-disabled').attr('aria-disabled', 'true');
        }
      } else {
        _.$prevArrow.add(_.$nextArrow).addClass('slick-hidden').attr({
          'aria-disabled': 'true',
          'tabindex': '-1'
        });
      }
    }
  };

  Slick.prototype.buildDots = function () {
    var _ = this,
      i,
      dot;

    if (_.options.dots === true && _.slideCount > _.options.slidesToShow) {
      _.$slider.addClass('slick-dotted');

      dot = $('<ul />').addClass(_.options.dotsClass);

      for (i = 0; i <= _.getDotCount(); i += 1) {
        dot.append($('<li />').append(_.options.customPaging.call(this, _, i)));
      }

      _.$dots = dot.appendTo(_.options.appendDots);

      _.$dots.find('li').first().addClass('slick-active');
    }
  };

  Slick.prototype.buildOut = function () {
    var _ = this;

    _.$slides = _.$slider.children(_.options.slide + ':not(.slick-cloned)').addClass('slick-slide');
    _.slideCount = _.$slides.length;

    _.$slides.each(function (index, element) {
      $(element).attr('data-slick-index', index).data('originalStyling', $(element).attr('style') || '');
    });

    _.$slider.addClass('slick-slider');

    _.$slideTrack = _.slideCount === 0 ? $('<div class="slick-track"/>').appendTo(_.$slider) : _.$slides.wrapAll('<div class="slick-track"/>').parent();
    _.$list = _.$slideTrack.wrap('<div class="slick-list"/>').parent();

    _.$slideTrack.css('opacity', 0);

    if (_.options.centerMode === true || _.options.swipeToSlide === true) {
      _.options.slidesToScroll = 1;
    }

    $('img[data-lazy]', _.$slider).not('[src]').addClass('slick-loading');

    _.setupInfinite();

    _.buildArrows();

    _.buildDots();

    _.updateDots();

    _.setSlideClasses(typeof _.currentSlide === 'number' ? _.currentSlide : 0);

    if (_.options.draggable === true) {
      _.$list.addClass('draggable');
    }
  };

  Slick.prototype.buildRows = function () {
    var _ = this,
      a,
      b,
      c,
      newSlides,
      numOfSlides,
      originalSlides,
      slidesPerSection;

    newSlides = document.createDocumentFragment();
    originalSlides = _.$slider.children();

    if (_.options.rows > 0) {
      slidesPerSection = _.options.slidesPerRow * _.options.rows;
      numOfSlides = Math.ceil(originalSlides.length / slidesPerSection);

      for (a = 0; a < numOfSlides; a++) {
        var slide = document.createElement('div');

        for (b = 0; b < _.options.rows; b++) {
          var row = document.createElement('div');

          for (c = 0; c < _.options.slidesPerRow; c++) {
            var target = a * slidesPerSection + (b * _.options.slidesPerRow + c);

            if (originalSlides.get(target)) {
              row.appendChild(originalSlides.get(target));
            }
          }

          slide.appendChild(row);
        }

        newSlides.appendChild(slide);
      }

      _.$slider.empty().append(newSlides);

      _.$slider.children().children().children().css({
        'width': 100 / _.options.slidesPerRow + '%',
        'display': 'inline-block'
      });
    }
  };

  Slick.prototype.checkResponsive = function (initial, forceUpdate) {
    var _ = this,
      breakpoint,
      targetBreakpoint,
      respondToWidth,
      triggerBreakpoint = false;

    var sliderWidth = _.$slider.width();

    var windowWidth = window.innerWidth || $(window).width();

    if (_.respondTo === 'window') {
      respondToWidth = windowWidth;
    } else if (_.respondTo === 'slider') {
      respondToWidth = sliderWidth;
    } else if (_.respondTo === 'min') {
      respondToWidth = Math.min(windowWidth, sliderWidth);
    }

    if (_.options.responsive && _.options.responsive.length && _.options.responsive !== null) {
      targetBreakpoint = null;

      for (breakpoint in _.breakpoints) {
        if (_.breakpoints.hasOwnProperty(breakpoint)) {
          if (_.originalSettings.mobileFirst === false) {
            if (respondToWidth < _.breakpoints[breakpoint]) {
              targetBreakpoint = _.breakpoints[breakpoint];
            }
          } else {
            if (respondToWidth > _.breakpoints[breakpoint]) {
              targetBreakpoint = _.breakpoints[breakpoint];
            }
          }
        }
      }

      if (targetBreakpoint !== null) {
        if (_.activeBreakpoint !== null) {
          if (targetBreakpoint !== _.activeBreakpoint || forceUpdate) {
            _.activeBreakpoint = targetBreakpoint;

            if (_.breakpointSettings[targetBreakpoint] === 'unslick') {
              _.unslick(targetBreakpoint);
            } else {
              _.options = $.extend({}, _.originalSettings, _.breakpointSettings[targetBreakpoint]);

              if (initial === true) {
                _.currentSlide = _.options.initialSlide;
              }

              _.refresh(initial);
            }

            triggerBreakpoint = targetBreakpoint;
          }
        } else {
          _.activeBreakpoint = targetBreakpoint;

          if (_.breakpointSettings[targetBreakpoint] === 'unslick') {
            _.unslick(targetBreakpoint);
          } else {
            _.options = $.extend({}, _.originalSettings, _.breakpointSettings[targetBreakpoint]);

            if (initial === true) {
              _.currentSlide = _.options.initialSlide;
            }

            _.refresh(initial);
          }

          triggerBreakpoint = targetBreakpoint;
        }
      } else {
        if (_.activeBreakpoint !== null) {
          _.activeBreakpoint = null;
          _.options = _.originalSettings;

          if (initial === true) {
            _.currentSlide = _.options.initialSlide;
          }

          _.refresh(initial);

          triggerBreakpoint = targetBreakpoint;
        }
      } // only trigger breakpoints during an actual break. not on initialize.


      if (!initial && triggerBreakpoint !== false) {
        _.$slider.trigger('breakpoint', [_, triggerBreakpoint]);
      }
    }
  };

  Slick.prototype.changeSlide = function (event, dontAnimate) {
    var _ = this,
      $target = $(event.currentTarget),
      indexOffset,
      slideOffset,
      unevenOffset; // If target is a link, prevent default action.


    if ($target.is('a')) {
      event.preventDefault();
    } // If target is not the <li> element (ie: a child), find the <li>.


    if (!$target.is('li')) {
      $target = $target.closest('li');
    }

    unevenOffset = _.slideCount % _.options.slidesToScroll !== 0;
    indexOffset = unevenOffset ? 0 : (_.slideCount - _.currentSlide) % _.options.slidesToScroll;

    switch (event.data.message) {
      case 'previous':
        slideOffset = indexOffset === 0 ? _.options.slidesToScroll : _.options.slidesToShow - indexOffset;

        if (_.slideCount > _.options.slidesToShow) {
          _.slideHandler(_.currentSlide - slideOffset, false, dontAnimate);
        }

        break;

      case 'next':
        slideOffset = indexOffset === 0 ? _.options.slidesToScroll : indexOffset;

        if (_.slideCount > _.options.slidesToShow) {
          _.slideHandler(_.currentSlide + slideOffset, false, dontAnimate);
        }

        break;

      case 'index':
        var index = event.data.index === 0 ? 0 : event.data.index || $target.index() * _.options.slidesToScroll;

        _.slideHandler(_.checkNavigable(index), false, dontAnimate);

        $target.children().trigger('focus');
        break;

      default:
        return;
    }
  };

  Slick.prototype.checkNavigable = function (index) {
    var _ = this,
      navigables,
      prevNavigable;

    navigables = _.getNavigableIndexes();
    prevNavigable = 0;

    if (index > navigables[navigables.length - 1]) {
      index = navigables[navigables.length - 1];
    } else {
      for (var n in navigables) {
        if (index < navigables[n]) {
          index = prevNavigable;
          break;
        }

        prevNavigable = navigables[n];
      }
    }

    return index;
  };

  Slick.prototype.cleanUpEvents = function () {
    var _ = this;

    if (_.options.dots && _.$dots !== null) {
      $('li', _.$dots).off('click.slick', _.changeSlide).off('mouseenter.slick', $.proxy(_.interrupt, _, true)).off('mouseleave.slick', $.proxy(_.interrupt, _, false));

      if (_.options.accessibility === true) {
        _.$dots.off('keydown.slick', _.keyHandler);
      }
    }

    _.$slider.off('focus.slick blur.slick');

    if (_.options.arrows === true && _.slideCount > _.options.slidesToShow) {
      _.$prevArrow && _.$prevArrow.off('click.slick', _.changeSlide);
      _.$nextArrow && _.$nextArrow.off('click.slick', _.changeSlide);

      if (_.options.accessibility === true) {
        _.$prevArrow && _.$prevArrow.off('keydown.slick', _.keyHandler);
        _.$nextArrow && _.$nextArrow.off('keydown.slick', _.keyHandler);
      }
    }

    _.$list.off('touchstart.slick mousedown.slick', _.swipeHandler);

    _.$list.off('touchmove.slick mousemove.slick', _.swipeHandler);

    _.$list.off('touchend.slick mouseup.slick', _.swipeHandler);

    _.$list.off('touchcancel.slick mouseleave.slick', _.swipeHandler);

    _.$list.off('click.slick', _.clickHandler);

    $(document).off(_.visibilityChange, _.visibility);

    _.cleanUpSlideEvents();

    if (_.options.accessibility === true) {
      _.$list.off('keydown.slick', _.keyHandler);
    }

    if (_.options.focusOnSelect === true) {
      $(_.$slideTrack).children().off('click.slick', _.selectHandler);
    }

    $(window).off('orientationchange.slick.slick-' + _.instanceUid, _.orientationChange);
    $(window).off('resize.slick.slick-' + _.instanceUid, _.resize);
    $('[draggable!=true]', _.$slideTrack).off('dragstart', _.preventDefault);
    $(window).off('load.slick.slick-' + _.instanceUid, _.setPosition);
  };

  Slick.prototype.cleanUpSlideEvents = function () {
    var _ = this;

    _.$list.off('mouseenter.slick', $.proxy(_.interrupt, _, true));

    _.$list.off('mouseleave.slick', $.proxy(_.interrupt, _, false));
  };

  Slick.prototype.cleanUpRows = function () {
    var _ = this,
      originalSlides;

    if (_.options.rows > 0) {
      originalSlides = _.$slides.children().children();
      originalSlides.removeAttr('style');

      _.$slider.empty().append(originalSlides);
    }
  };

  Slick.prototype.clickHandler = function (event) {
    var _ = this;

    if (_.shouldClick === false) {
      event.stopImmediatePropagation();
      event.stopPropagation();
      event.preventDefault();
    }
  };

  Slick.prototype.destroy = function (refresh) {
    var _ = this;

    _.autoPlayClear();

    _.touchObject = {};

    _.cleanUpEvents();

    $('.slick-cloned', _.$slider).detach();

    if (_.$dots) {
      _.$dots.remove();
    }

    if (_.$prevArrow && _.$prevArrow.length) {
      _.$prevArrow.removeClass('slick-disabled slick-arrow slick-hidden').removeAttr('aria-hidden aria-disabled tabindex').css('display', '');

      if (_.htmlExpr.test(_.options.prevArrow)) {
        _.$prevArrow.remove();
      }
    }

    if (_.$nextArrow && _.$nextArrow.length) {
      _.$nextArrow.removeClass('slick-disabled slick-arrow slick-hidden').removeAttr('aria-hidden aria-disabled tabindex').css('display', '');

      if (_.htmlExpr.test(_.options.nextArrow)) {
        _.$nextArrow.remove();
      }
    }

    if (_.$slides) {
      _.$slides.removeClass('slick-slide slick-active slick-center slick-visible slick-current').removeAttr('aria-hidden').removeAttr('data-slick-index').each(function () {
        $(this).attr('style', $(this).data('originalStyling'));
      });

      _.$slideTrack.children(this.options.slide).detach();

      _.$slideTrack.detach();

      _.$list.detach();

      _.$slider.append(_.$slides);
    }

    _.cleanUpRows();

    _.$slider.removeClass('slick-slider');

    _.$slider.removeClass('slick-initialized');

    _.$slider.removeClass('slick-dotted');

    _.unslicked = true;

    if (!refresh) {
      _.$slider.trigger('destroy', [_]);
    }
  };

  Slick.prototype.disableTransition = function (slide) {
    var _ = this,
      transition = {};

    transition[_.transitionType] = '';

    if (_.options.fade === false) {
      _.$slideTrack.css(transition);
    } else {
      _.$slides.eq(slide).css(transition);
    }
  };

  Slick.prototype.fadeSlide = function (slideIndex, callback) {
    var _ = this;

    if (_.cssTransitions === false) {
      _.$slides.eq(slideIndex).css({
        zIndex: _.options.zIndex
      });

      _.$slides.eq(slideIndex).animate({
        opacity: 1
      }, _.options.speed, _.options.easing, callback);
    } else {
      _.applyTransition(slideIndex);

      _.$slides.eq(slideIndex).css({
        opacity: 1,
        zIndex: _.options.zIndex
      });

      if (callback) {
        setTimeout(function () {
          _.disableTransition(slideIndex);

          callback.call();
        }, _.options.speed);
      }
    }
  };

  Slick.prototype.fadeSlideOut = function (slideIndex) {
    var _ = this;

    if (_.cssTransitions === false) {
      _.$slides.eq(slideIndex).animate({
        opacity: 0,
        zIndex: _.options.zIndex - 2
      }, _.options.speed, _.options.easing);
    } else {
      _.applyTransition(slideIndex);

      _.$slides.eq(slideIndex).css({
        opacity: 0,
        zIndex: _.options.zIndex - 2
      });
    }
  };

  Slick.prototype.filterSlides = Slick.prototype.slickFilter = function (filter) {
    var _ = this;

    if (filter !== null) {
      _.$slidesCache = _.$slides;

      _.unload();

      _.$slideTrack.children(this.options.slide).detach();

      _.$slidesCache.filter(filter).appendTo(_.$slideTrack);

      _.reinit();
    }
  };

  Slick.prototype.focusHandler = function () {
    var _ = this;

    _.$slider.off('focus.slick blur.slick').on('focus.slick blur.slick', '*', function (event) {
      event.stopImmediatePropagation();
      var $sf = $(this);
      setTimeout(function () {
        if (_.options.pauseOnFocus) {
          _.focussed = $sf.is(':focus');

          _.autoPlay();
        }
      }, 0);
    });
  };

  Slick.prototype.getCurrent = Slick.prototype.slickCurrentSlide = function () {
    var _ = this;

    return _.currentSlide;
  };

  Slick.prototype.getDotCount = function () {
    var _ = this;

    var breakPoint = 0;
    var counter = 0;
    var pagerQty = 0;

    if (_.options.infinite === true) {
      if (_.slideCount <= _.options.slidesToShow) {
        ++pagerQty;
      } else {
        while (breakPoint < _.slideCount) {
          ++pagerQty;
          breakPoint = counter + _.options.slidesToScroll;
          counter += _.options.slidesToScroll <= _.options.slidesToShow ? _.options.slidesToScroll : _.options.slidesToShow;
        }
      }
    } else if (_.options.centerMode === true) {
      pagerQty = _.slideCount;
    } else if (!_.options.asNavFor) {
      pagerQty = 1 + Math.ceil((_.slideCount - _.options.slidesToShow) / _.options.slidesToScroll);
    } else {
      while (breakPoint < _.slideCount) {
        ++pagerQty;
        breakPoint = counter + _.options.slidesToScroll;
        counter += _.options.slidesToScroll <= _.options.slidesToShow ? _.options.slidesToScroll : _.options.slidesToShow;
      }
    }

    return pagerQty - 1;
  };

  Slick.prototype.getLeft = function (slideIndex) {
    var _ = this,
      targetLeft,
      verticalHeight,
      verticalOffset = 0,
      targetSlide,
      coef;

    _.slideOffset = 0;
    verticalHeight = _.$slides.first().outerHeight(true);

    if (_.options.infinite === true) {
      if (_.slideCount > _.options.slidesToShow) {
        _.slideOffset = _.slideWidth * _.options.slidesToShow * -1;
        coef = -1;

        if (_.options.vertical === true && _.options.centerMode === true) {
          if (_.options.slidesToShow === 2) {
            coef = -1.5;
          } else if (_.options.slidesToShow === 1) {
            coef = -2;
          }
        }

        verticalOffset = verticalHeight * _.options.slidesToShow * coef;
      }

      if (_.slideCount % _.options.slidesToScroll !== 0) {
        if (slideIndex + _.options.slidesToScroll > _.slideCount && _.slideCount > _.options.slidesToShow) {
          if (slideIndex > _.slideCount) {
            _.slideOffset = (_.options.slidesToShow - (slideIndex - _.slideCount)) * _.slideWidth * -1;
            verticalOffset = (_.options.slidesToShow - (slideIndex - _.slideCount)) * verticalHeight * -1;
          } else {
            _.slideOffset = _.slideCount % _.options.slidesToScroll * _.slideWidth * -1;
            verticalOffset = _.slideCount % _.options.slidesToScroll * verticalHeight * -1;
          }
        }
      }
    } else {
      if (slideIndex + _.options.slidesToShow > _.slideCount) {
        _.slideOffset = (slideIndex + _.options.slidesToShow - _.slideCount) * _.slideWidth;
        verticalOffset = (slideIndex + _.options.slidesToShow - _.slideCount) * verticalHeight;
      }
    }

    if (_.slideCount <= _.options.slidesToShow) {
      _.slideOffset = 0;
      verticalOffset = 0;
    }

    if (_.options.centerMode === true && _.slideCount <= _.options.slidesToShow) {
      _.slideOffset = _.slideWidth * Math.floor(_.options.slidesToShow) / 2 - _.slideWidth * _.slideCount / 2;
    } else if (_.options.centerMode === true && _.options.infinite === true) {
      _.slideOffset += _.slideWidth * Math.floor(_.options.slidesToShow / 2) - _.slideWidth;
    } else if (_.options.centerMode === true) {
      _.slideOffset = 0;
      _.slideOffset += _.slideWidth * Math.floor(_.options.slidesToShow / 2);
    }

    if (_.options.vertical === false) {
      targetLeft = slideIndex * _.slideWidth * -1 + _.slideOffset;
    } else {
      targetLeft = slideIndex * verticalHeight * -1 + verticalOffset;
    }

    if (_.options.variableWidth === true) {
      if (_.slideCount <= _.options.slidesToShow || _.options.infinite === false) {
        targetSlide = _.$slideTrack.children('.slick-slide').eq(slideIndex);
      } else {
        targetSlide = _.$slideTrack.children('.slick-slide').eq(slideIndex + _.options.slidesToShow);
      }

      if (_.options.rtl === true) {
        if (targetSlide[0]) {
          targetLeft = (_.$slideTrack.width() - targetSlide[0].offsetLeft - targetSlide.width()) * -1;
        } else {
          targetLeft = 0;
        }
      } else {
        targetLeft = targetSlide[0] ? targetSlide[0].offsetLeft * -1 : 0;
      }

      if (_.options.centerMode === true) {
        if (_.slideCount <= _.options.slidesToShow || _.options.infinite === false) {
          targetSlide = _.$slideTrack.children('.slick-slide').eq(slideIndex);
        } else {
          targetSlide = _.$slideTrack.children('.slick-slide').eq(slideIndex + _.options.slidesToShow + 1);
        }

        if (_.options.rtl === true) {
          if (targetSlide[0]) {
            targetLeft = (_.$slideTrack.width() - targetSlide[0].offsetLeft - targetSlide.width()) * -1;
          } else {
            targetLeft = 0;
          }
        } else {
          targetLeft = targetSlide[0] ? targetSlide[0].offsetLeft * -1 : 0;
        }

        targetLeft += (_.$list.width() - targetSlide.outerWidth()) / 2;
      }
    }

    return targetLeft;
  };

  Slick.prototype.getOption = Slick.prototype.slickGetOption = function (option) {
    var _ = this;

    return _.options[option];
  };

  Slick.prototype.getNavigableIndexes = function () {
    var _ = this,
      breakPoint = 0,
      counter = 0,
      indexes = [],
      max;

    if (_.options.infinite === false) {
      max = _.slideCount;
    } else {
      breakPoint = _.options.slidesToScroll * -1;
      counter = _.options.slidesToScroll * -1;
      max = _.slideCount * 2;
    }

    while (breakPoint < max) {
      indexes.push(breakPoint);
      breakPoint = counter + _.options.slidesToScroll;
      counter += _.options.slidesToScroll <= _.options.slidesToShow ? _.options.slidesToScroll : _.options.slidesToShow;
    }

    return indexes;
  };

  Slick.prototype.getSlick = function () {
    return this;
  };

  Slick.prototype.getSlideCount = function () {
    var _ = this,
      slidesTraversed,
      swipedSlide,
      centerOffset;

    centerOffset = _.options.centerMode === true ? _.slideWidth * Math.floor(_.options.slidesToShow / 2) : 0;

    if (_.options.swipeToSlide === true) {
      _.$slideTrack.find('.slick-slide').each(function (index, slide) {
        if (slide.offsetLeft - centerOffset + $(slide).outerWidth() / 2 > _.swipeLeft * -1) {
          swipedSlide = slide;
          return false;
        }
      });

      slidesTraversed = Math.abs($(swipedSlide).attr('data-slick-index') - _.currentSlide) || 1;
      return slidesTraversed;
    } else {
      return _.options.slidesToScroll;
    }
  };

  Slick.prototype.goTo = Slick.prototype.slickGoTo = function (slide, dontAnimate) {
    var _ = this;

    _.changeSlide({
      data: {
        message: 'index',
        index: parseInt(slide)
      }
    }, dontAnimate);
  };

  Slick.prototype.init = function (creation) {
    var _ = this;

    if (!$(_.$slider).hasClass('slick-initialized')) {
      $(_.$slider).addClass('slick-initialized');

      _.buildRows();

      _.buildOut();

      _.setProps();

      _.startLoad();

      _.loadSlider();

      _.initializeEvents();

      _.updateArrows();

      _.updateDots();

      _.checkResponsive(true);

      _.focusHandler();
    }

    if (creation) {
      _.$slider.trigger('init', [_]);
    }

    if (_.options.accessibility === true) {
      _.initADA();
    }

    if (_.options.autoplay) {
      _.paused = false;

      _.autoPlay();
    }
  };

  Slick.prototype.initADA = function () {
    var _ = this,
      numDotGroups = Math.ceil(_.slideCount / _.options.slidesToShow),
      tabControlIndexes = _.getNavigableIndexes().filter(function (val) {
        return val >= 0 && val < _.slideCount;
      });

    _.$slides.add(_.$slideTrack.find('.slick-cloned')).attr({
      'aria-hidden': 'true',
      'tabindex': '-1'
    }).find('a, input, button, select').attr({
      'tabindex': '-1'
    });

    if (_.$dots !== null) {
      _.$slides.not(_.$slideTrack.find('.slick-cloned')).each(function (i) {
        var slideControlIndex = tabControlIndexes.indexOf(i);
        $(this).attr({
          'role': 'tabpanel',
          'id': 'slick-slide' + _.instanceUid + i,
          'tabindex': -1
        });

        if (slideControlIndex !== -1) {
          var ariaButtonControl = 'slick-slide-control' + _.instanceUid + slideControlIndex;

          if ($('#' + ariaButtonControl).length) {
            $(this).attr({
              'aria-describedby': ariaButtonControl
            });
          }
        }
      });

      _.$dots.attr('role', 'tablist').find('li').each(function (i) {
        var mappedSlideIndex = tabControlIndexes[i];
        $(this).attr({
          'role': 'presentation'
        });
        $(this).find('button').first().attr({
          'role': 'tab',
          'id': 'slick-slide-control' + _.instanceUid + i,
          'aria-controls': 'slick-slide' + _.instanceUid + mappedSlideIndex,
          'aria-label': i + 1 + ' of ' + numDotGroups,
          'aria-selected': null,
          'tabindex': '-1'
        });
      }).eq(_.currentSlide).find('button').attr({
        'aria-selected': 'true',
        'tabindex': '0'
      }).end();
    }

    for (var i = _.currentSlide, max = i + _.options.slidesToShow; i < max; i++) {
      if (_.options.focusOnChange) {
        _.$slides.eq(i).attr({
          'tabindex': '0'
        });
      } else {
        _.$slides.eq(i).removeAttr('tabindex');
      }
    }

    _.activateADA();
  };

  Slick.prototype.initArrowEvents = function () {
    var _ = this;

    if (_.options.arrows === true && _.slideCount > _.options.slidesToShow) {
      _.$prevArrow.off('click.slick').on('click.slick', {
        message: 'previous'
      }, _.changeSlide);

      _.$nextArrow.off('click.slick').on('click.slick', {
        message: 'next'
      }, _.changeSlide);

      if (_.options.accessibility === true) {
        _.$prevArrow.on('keydown.slick', _.keyHandler);

        _.$nextArrow.on('keydown.slick', _.keyHandler);
      }
    }
  };

  Slick.prototype.initDotEvents = function () {
    var _ = this;

    if (_.options.dots === true && _.slideCount > _.options.slidesToShow) {
      $('li', _.$dots).on('click.slick', {
        message: 'index'
      }, _.changeSlide);

      if (_.options.accessibility === true) {
        _.$dots.on('keydown.slick', _.keyHandler);
      }
    }

    if (_.options.dots === true && _.options.pauseOnDotsHover === true && _.slideCount > _.options.slidesToShow) {
      $('li', _.$dots).on('mouseenter.slick', $.proxy(_.interrupt, _, true)).on('mouseleave.slick', $.proxy(_.interrupt, _, false));
    }
  };

  Slick.prototype.initSlideEvents = function () {
    var _ = this;

    if (_.options.pauseOnHover) {
      _.$list.on('mouseenter.slick', $.proxy(_.interrupt, _, true));

      _.$list.on('mouseleave.slick', $.proxy(_.interrupt, _, false));
    }
  };

  Slick.prototype.initializeEvents = function () {
    var _ = this;

    _.initArrowEvents();

    _.initDotEvents();

    _.initSlideEvents();

    _.$list.on('touchstart.slick mousedown.slick', {
      action: 'start'
    }, _.swipeHandler);

    _.$list.on('touchmove.slick mousemove.slick', {
      action: 'move'
    }, _.swipeHandler);

    _.$list.on('touchend.slick mouseup.slick', {
      action: 'end'
    }, _.swipeHandler);

    _.$list.on('touchcancel.slick mouseleave.slick', {
      action: 'end'
    }, _.swipeHandler);

    _.$list.on('click.slick', _.clickHandler);

    $(document).on(_.visibilityChange, $.proxy(_.visibility, _));

    if (_.options.accessibility === true) {
      _.$list.on('keydown.slick', _.keyHandler);
    }

    if (_.options.focusOnSelect === true) {
      $(_.$slideTrack).children().on('click.slick', _.selectHandler);
    }

    $(window).on('orientationchange.slick.slick-' + _.instanceUid, $.proxy(_.orientationChange, _));
    $(window).on('resize.slick.slick-' + _.instanceUid, $.proxy(_.resize, _));
    $('[draggable!=true]', _.$slideTrack).on('dragstart', _.preventDefault);
    $(window).on('load.slick.slick-' + _.instanceUid, _.setPosition);
    $(_.setPosition);
  };

  Slick.prototype.initUI = function () {
    var _ = this;

    if (_.options.arrows === true && _.slideCount > _.options.slidesToShow) {
      _.$prevArrow.show();

      _.$nextArrow.show();
    }

    if (_.options.dots === true && _.slideCount > _.options.slidesToShow) {
      _.$dots.show();
    }
  };

  Slick.prototype.keyHandler = function (event) {
    var _ = this; //Dont slide if the cursor is inside the form fields and arrow keys are pressed


    if (!event.target.tagName.match('TEXTAREA|INPUT|SELECT')) {
      if (event.keyCode === 37 && _.options.accessibility === true) {
        _.changeSlide({
          data: {
            message: _.options.rtl === true ? 'next' : 'previous'
          }
        });
      } else if (event.keyCode === 39 && _.options.accessibility === true) {
        _.changeSlide({
          data: {
            message: _.options.rtl === true ? 'previous' : 'next'
          }
        });
      }
    }
  };

  Slick.prototype.lazyLoad = function () {
    var _ = this,
      loadRange,
      cloneRange,
      rangeStart,
      rangeEnd;

    function loadImages(imagesScope) {
      $('img[data-lazy]', imagesScope).each(function () {
        var image = $(this),
          imageSource = $(this).attr('data-lazy'),
          imageSrcSet = $(this).attr('data-srcset'),
          imageSizes = $(this).attr('data-sizes') || _.$slider.attr('data-sizes'),
          imageToLoad = document.createElement('img');

        imageToLoad.onload = function () {
          image.animate({
            opacity: 0
          }, 100, function () {
            if (imageSrcSet) {
              image.attr('srcset', imageSrcSet);

              if (imageSizes) {
                image.attr('sizes', imageSizes);
              }
            }

            image.attr('src', imageSource).animate({
              opacity: 1
            }, 200, function () {
              image.removeAttr('data-lazy data-srcset data-sizes').removeClass('slick-loading');
            });

            _.$slider.trigger('lazyLoaded', [_, image, imageSource]);
          });
        };

        imageToLoad.onerror = function () {
          image.removeAttr('data-lazy').removeClass('slick-loading').addClass('slick-lazyload-error');

          _.$slider.trigger('lazyLoadError', [_, image, imageSource]);
        };

        imageToLoad.src = imageSource;
      });
    }

    if (_.options.centerMode === true) {
      if (_.options.infinite === true) {
        rangeStart = _.currentSlide + (_.options.slidesToShow / 2 + 1);
        rangeEnd = rangeStart + _.options.slidesToShow + 2;
      } else {
        rangeStart = Math.max(0, _.currentSlide - (_.options.slidesToShow / 2 + 1));
        rangeEnd = 2 + (_.options.slidesToShow / 2 + 1) + _.currentSlide;
      }
    } else {
      rangeStart = _.options.infinite ? _.options.slidesToShow + _.currentSlide : _.currentSlide;
      rangeEnd = Math.ceil(rangeStart + _.options.slidesToShow);

      if (_.options.fade === true) {
        if (rangeStart > 0) rangeStart--;
        if (rangeEnd <= _.slideCount) rangeEnd++;
      }
    }

    loadRange = _.$slider.find('.slick-slide').slice(rangeStart, rangeEnd);

    if (_.options.lazyLoad === 'anticipated') {
      var prevSlide = rangeStart - 1,
        nextSlide = rangeEnd,
        $slides = _.$slider.find('.slick-slide');

      for (var i = 0; i < _.options.slidesToScroll; i++) {
        if (prevSlide < 0) prevSlide = _.slideCount - 1;
        loadRange = loadRange.add($slides.eq(prevSlide));
        loadRange = loadRange.add($slides.eq(nextSlide));
        prevSlide--;
        nextSlide++;
      }
    }

    loadImages(loadRange);

    if (_.slideCount <= _.options.slidesToShow) {
      cloneRange = _.$slider.find('.slick-slide');
      loadImages(cloneRange);
    } else if (_.currentSlide >= _.slideCount - _.options.slidesToShow) {
      cloneRange = _.$slider.find('.slick-cloned').slice(0, _.options.slidesToShow);
      loadImages(cloneRange);
    } else if (_.currentSlide === 0) {
      cloneRange = _.$slider.find('.slick-cloned').slice(_.options.slidesToShow * -1);
      loadImages(cloneRange);
    }
  };

  Slick.prototype.loadSlider = function () {
    var _ = this;

    _.setPosition();

    _.$slideTrack.css({
      opacity: 1
    });

    _.$slider.removeClass('slick-loading');

    _.initUI();

    if (_.options.lazyLoad === 'progressive') {
      _.progressiveLazyLoad();
    }
  };

  Slick.prototype.next = Slick.prototype.slickNext = function () {
    var _ = this;

    _.changeSlide({
      data: {
        message: 'next'
      }
    });
  };

  Slick.prototype.orientationChange = function () {
    var _ = this;

    _.checkResponsive();

    _.setPosition();
  };

  Slick.prototype.pause = Slick.prototype.slickPause = function () {
    var _ = this;

    _.autoPlayClear();

    _.paused = true;
  };

  Slick.prototype.play = Slick.prototype.slickPlay = function () {
    var _ = this;

    _.autoPlay();

    _.options.autoplay = true;
    _.paused = false;
    _.focussed = false;
    _.interrupted = false;
  };

  Slick.prototype.postSlide = function (index) {
    var _ = this;

    if (!_.unslicked) {
      _.$slider.trigger('afterChange', [_, index]);

      _.animating = false;

      if (_.slideCount > _.options.slidesToShow) {
        _.setPosition();
      }

      _.swipeLeft = null;

      if (_.options.autoplay) {
        _.autoPlay();
      }

      if (_.options.accessibility === true) {
        _.initADA();

        if (_.options.focusOnChange) {
          var $currentSlide = $(_.$slides.get(_.currentSlide));
          $currentSlide.attr('tabindex', 0).focus();
        }
      }
    }
  };

  Slick.prototype.prev = Slick.prototype.slickPrev = function () {
    var _ = this;

    _.changeSlide({
      data: {
        message: 'previous'
      }
    });
  };

  Slick.prototype.preventDefault = function (event) {
    event.preventDefault();
  };

  Slick.prototype.progressiveLazyLoad = function (tryCount) {
    tryCount = tryCount || 1;

    var _ = this,
      $imgsToLoad = $('img[data-lazy]', _.$slider),
      image,
      imageSource,
      imageSrcSet,
      imageSizes,
      imageToLoad;

    if ($imgsToLoad.length) {
      image = $imgsToLoad.first();
      imageSource = image.attr('data-lazy');
      imageSrcSet = image.attr('data-srcset');
      imageSizes = image.attr('data-sizes') || _.$slider.attr('data-sizes');
      imageToLoad = document.createElement('img');

      imageToLoad.onload = function () {
        if (imageSrcSet) {
          image.attr('srcset', imageSrcSet);

          if (imageSizes) {
            image.attr('sizes', imageSizes);
          }
        }

        image.attr('src', imageSource).removeAttr('data-lazy data-srcset data-sizes').removeClass('slick-loading');

        if (_.options.adaptiveHeight === true) {
          _.setPosition();
        }

        _.$slider.trigger('lazyLoaded', [_, image, imageSource]);

        _.progressiveLazyLoad();
      };

      imageToLoad.onerror = function () {
        if (tryCount < 3) {
          /**
           * try to load the image 3 times,
           * leave a slight delay so we don't get
           * servers blocking the request.
           */
          setTimeout(function () {
            _.progressiveLazyLoad(tryCount + 1);
          }, 500);
        } else {
          image.removeAttr('data-lazy').removeClass('slick-loading').addClass('slick-lazyload-error');

          _.$slider.trigger('lazyLoadError', [_, image, imageSource]);

          _.progressiveLazyLoad();
        }
      };

      imageToLoad.src = imageSource;
    } else {
      _.$slider.trigger('allImagesLoaded', [_]);
    }
  };

  Slick.prototype.refresh = function (initializing) {
    var _ = this,
      currentSlide,
      lastVisibleIndex;

    lastVisibleIndex = _.slideCount - _.options.slidesToShow; // in non-infinite sliders, we don't want to go past the
    // last visible index.

    if (!_.options.infinite && _.currentSlide > lastVisibleIndex) {
      _.currentSlide = lastVisibleIndex;
    } // if less slides than to show, go to start.


    if (_.slideCount <= _.options.slidesToShow) {
      _.currentSlide = 0;
    }

    currentSlide = _.currentSlide;

    _.destroy(true);

    $.extend(_, _.initials, {
      currentSlide: currentSlide
    });

    _.init();

    if (!initializing) {
      _.changeSlide({
        data: {
          message: 'index',
          index: currentSlide
        }
      }, false);
    }
  };

  Slick.prototype.registerBreakpoints = function () {
    var _ = this,
      breakpoint,
      currentBreakpoint,
      l,
      responsiveSettings = _.options.responsive || null;

    if ($.type(responsiveSettings) === 'array' && responsiveSettings.length) {
      _.respondTo = _.options.respondTo || 'window';

      for (breakpoint in responsiveSettings) {
        l = _.breakpoints.length - 1;

        if (responsiveSettings.hasOwnProperty(breakpoint)) {
          currentBreakpoint = responsiveSettings[breakpoint].breakpoint; // loop through the breakpoints and cut out any existing
          // ones with the same breakpoint number, we don't want dupes.

          while (l >= 0) {
            if (_.breakpoints[l] && _.breakpoints[l] === currentBreakpoint) {
              _.breakpoints.splice(l, 1);
            }

            l--;
          }

          _.breakpoints.push(currentBreakpoint);

          _.breakpointSettings[currentBreakpoint] = responsiveSettings[breakpoint].settings;
        }
      }

      _.breakpoints.sort(function (a, b) {
        return _.options.mobileFirst ? a - b : b - a;
      });
    }
  };

  Slick.prototype.reinit = function () {
    var _ = this;

    _.$slides = _.$slideTrack.children(_.options.slide).addClass('slick-slide');
    _.slideCount = _.$slides.length;

    if (_.currentSlide >= _.slideCount && _.currentSlide !== 0) {
      _.currentSlide = _.currentSlide - _.options.slidesToScroll;
    }

    if (_.slideCount <= _.options.slidesToShow) {
      _.currentSlide = 0;
    }

    _.registerBreakpoints();

    _.setProps();

    _.setupInfinite();

    _.buildArrows();

    _.updateArrows();

    _.initArrowEvents();

    _.buildDots();

    _.updateDots();

    _.initDotEvents();

    _.cleanUpSlideEvents();

    _.initSlideEvents();

    _.checkResponsive(false, true);

    if (_.options.focusOnSelect === true) {
      $(_.$slideTrack).children().on('click.slick', _.selectHandler);
    }

    _.setSlideClasses(typeof _.currentSlide === 'number' ? _.currentSlide : 0);

    _.setPosition();

    _.focusHandler();

    _.paused = !_.options.autoplay;

    _.autoPlay();

    _.$slider.trigger('reInit', [_]);
  };

  Slick.prototype.resize = function () {
    var _ = this;

    if ($(window).width() !== _.windowWidth) {
      clearTimeout(_.windowDelay);
      _.windowDelay = window.setTimeout(function () {
        _.windowWidth = $(window).width();

        _.checkResponsive();

        if (!_.unslicked) {
          _.setPosition();
        }
      }, 50);
    }
  };

  Slick.prototype.removeSlide = Slick.prototype.slickRemove = function (index, removeBefore, removeAll) {
    var _ = this;

    if (typeof index === 'boolean') {
      removeBefore = index;
      index = removeBefore === true ? 0 : _.slideCount - 1;
    } else {
      index = removeBefore === true ? --index : index;
    }

    if (_.slideCount < 1 || index < 0 || index > _.slideCount - 1) {
      return false;
    }

    _.unload();

    if (removeAll === true) {
      _.$slideTrack.children().remove();
    } else {
      _.$slideTrack.children(this.options.slide).eq(index).remove();
    }

    _.$slides = _.$slideTrack.children(this.options.slide);

    _.$slideTrack.children(this.options.slide).detach();

    _.$slideTrack.append(_.$slides);

    _.$slidesCache = _.$slides;

    _.reinit();
  };

  Slick.prototype.setCSS = function (position) {
    var _ = this,
      positionProps = {},
      x,
      y;

    if (_.options.rtl === true) {
      position = -position;
    }

    x = _.positionProp == 'left' ? Math.ceil(position) + 'px' : '0px';
    y = _.positionProp == 'top' ? Math.ceil(position) + 'px' : '0px';
    positionProps[_.positionProp] = position;

    if (_.transformsEnabled === false) {
      _.$slideTrack.css(positionProps);
    } else {
      positionProps = {};

      if (_.cssTransitions === false) {
        positionProps[_.animType] = 'translate(' + x + ', ' + y + ')';

        _.$slideTrack.css(positionProps);
      } else {
        positionProps[_.animType] = 'translate3d(' + x + ', ' + y + ', 0px)';

        _.$slideTrack.css(positionProps);
      }
    }
  };

  Slick.prototype.setDimensions = function () {
    var _ = this;

    if (_.options.vertical === false) {
      if (_.options.centerMode === true) {
        _.$list.css({
          padding: '0px ' + _.options.centerPadding
        });
      }
    } else {
      _.$list.height(_.$slides.first().outerHeight(true) * _.options.slidesToShow);

      if (_.options.centerMode === true) {
        _.$list.css({
          padding: _.options.centerPadding + ' 0px'
        });
      }
    }

    _.listWidth = _.$list.width();
    _.listHeight = _.$list.height();

    if (_.options.vertical === false && _.options.variableWidth === false) {
      _.slideWidth = Math.ceil(_.listWidth / _.options.slidesToShow);

      _.$slideTrack.width(Math.ceil(_.slideWidth * _.$slideTrack.children('.slick-slide').length));
    } else if (_.options.variableWidth === true) {
      _.$slideTrack.width(5000 * _.slideCount);
    } else {
      _.slideWidth = Math.ceil(_.listWidth);

      _.$slideTrack.height(Math.ceil(_.$slides.first().outerHeight(true) * _.$slideTrack.children('.slick-slide').length));
    }

    var offset = _.$slides.first().outerWidth(true) - _.$slides.first().width();

    if (_.options.variableWidth === false) _.$slideTrack.children('.slick-slide').width(_.slideWidth - offset);
  };

  Slick.prototype.setFade = function () {
    var _ = this,
      targetLeft;

    _.$slides.each(function (index, element) {
      targetLeft = _.slideWidth * index * -1;

      if (_.options.rtl === true) {
        $(element).css({
          position: 'relative',
          right: targetLeft,
          top: 0,
          zIndex: _.options.zIndex - 2,
          opacity: 0
        });
      } else {
        $(element).css({
          position: 'relative',
          left: targetLeft,
          top: 0,
          zIndex: _.options.zIndex - 2,
          opacity: 0
        });
      }
    });

    _.$slides.eq(_.currentSlide).css({
      zIndex: _.options.zIndex - 1,
      opacity: 1
    });
  };

  Slick.prototype.setHeight = function () {
    var _ = this;

    if (_.options.slidesToShow === 1 && _.options.adaptiveHeight === true && _.options.vertical === false) {
      var targetHeight = _.$slides.eq(_.currentSlide).outerHeight(true);

      _.$list.css('height', targetHeight);
    }
  };

  Slick.prototype.setOption = Slick.prototype.slickSetOption = function () {
    /**
     * accepts arguments in format of:
     *
     *  - for changing a single option's value:
     *     .slick("setOption", option, value, refresh )
     *
     *  - for changing a set of responsive options:
     *     .slick("setOption", 'responsive', [{}, ...], refresh )
     *
     *  - for updating multiple values at once (not responsive)
     *     .slick("setOption", { 'option': value, ... }, refresh )
     */
    var _ = this,
      l,
      item,
      option,
      value,
      refresh = false,
      type;

    if ($.type(arguments[0]) === 'object') {
      option = arguments[0];
      refresh = arguments[1];
      type = 'multiple';
    } else if ($.type(arguments[0]) === 'string') {
      option = arguments[0];
      value = arguments[1];
      refresh = arguments[2];

      if (arguments[0] === 'responsive' && $.type(arguments[1]) === 'array') {
        type = 'responsive';
      } else if (typeof arguments[1] !== 'undefined') {
        type = 'single';
      }
    }

    if (type === 'single') {
      _.options[option] = value;
    } else if (type === 'multiple') {
      $.each(option, function (opt, val) {
        _.options[opt] = val;
      });
    } else if (type === 'responsive') {
      for (item in value) {
        if ($.type(_.options.responsive) !== 'array') {
          _.options.responsive = [value[item]];
        } else {
          l = _.options.responsive.length - 1; // loop through the responsive object and splice out duplicates.

          while (l >= 0) {
            if (_.options.responsive[l].breakpoint === value[item].breakpoint) {
              _.options.responsive.splice(l, 1);
            }

            l--;
          }

          _.options.responsive.push(value[item]);
        }
      }
    }

    if (refresh) {
      _.unload();

      _.reinit();
    }
  };

  Slick.prototype.setPosition = function () {
    var _ = this;

    _.setDimensions();

    _.setHeight();

    if (_.options.fade === false) {
      _.setCSS(_.getLeft(_.currentSlide));
    } else {
      _.setFade();
    }

    _.$slider.trigger('setPosition', [_]);
  };

  Slick.prototype.setProps = function () {
    var _ = this,
      bodyStyle = document.body.style;

    _.positionProp = _.options.vertical === true ? 'top' : 'left';

    if (_.positionProp === 'top') {
      _.$slider.addClass('slick-vertical');
    } else {
      _.$slider.removeClass('slick-vertical');
    }

    if (bodyStyle.WebkitTransition !== undefined || bodyStyle.MozTransition !== undefined || bodyStyle.msTransition !== undefined) {
      if (_.options.useCSS === true) {
        _.cssTransitions = true;
      }
    }

    if (_.options.fade) {
      if (typeof _.options.zIndex === 'number') {
        if (_.options.zIndex < 3) {
          _.options.zIndex = 3;
        }
      } else {
        _.options.zIndex = _.defaults.zIndex;
      }
    }

    if (bodyStyle.OTransform !== undefined) {
      _.animType = 'OTransform';
      _.transformType = '-o-transform';
      _.transitionType = 'OTransition';
      if (bodyStyle.perspectiveProperty === undefined && bodyStyle.webkitPerspective === undefined) _.animType = false;
    }

    if (bodyStyle.MozTransform !== undefined) {
      _.animType = 'MozTransform';
      _.transformType = '-moz-transform';
      _.transitionType = 'MozTransition';
      if (bodyStyle.perspectiveProperty === undefined && bodyStyle.MozPerspective === undefined) _.animType = false;
    }

    if (bodyStyle.webkitTransform !== undefined) {
      _.animType = 'webkitTransform';
      _.transformType = '-webkit-transform';
      _.transitionType = 'webkitTransition';
      if (bodyStyle.perspectiveProperty === undefined && bodyStyle.webkitPerspective === undefined) _.animType = false;
    }

    if (bodyStyle.msTransform !== undefined) {
      _.animType = 'msTransform';
      _.transformType = '-ms-transform';
      _.transitionType = 'msTransition';
      if (bodyStyle.msTransform === undefined) _.animType = false;
    }

    if (bodyStyle.transform !== undefined && _.animType !== false) {
      _.animType = 'transform';
      _.transformType = 'transform';
      _.transitionType = 'transition';
    }

    _.transformsEnabled = _.options.useTransform && _.animType !== null && _.animType !== false;
  };

  Slick.prototype.setSlideClasses = function (index) {
    var _ = this,
      centerOffset,
      allSlides,
      indexOffset,
      remainder;

    allSlides = _.$slider.find('.slick-slide').removeClass('slick-active slick-center slick-current').attr('aria-hidden', 'true');

    _.$slides.eq(index).addClass('slick-current');

    if (_.options.centerMode === true) {
      var evenCoef = _.options.slidesToShow % 2 === 0 ? 1 : 0;
      centerOffset = Math.floor(_.options.slidesToShow / 2);

      if (_.options.infinite === true) {
        if (index >= centerOffset && index <= _.slideCount - 1 - centerOffset) {
          _.$slides.slice(index - centerOffset + evenCoef, index + centerOffset + 1).addClass('slick-active').attr('aria-hidden', 'false');
        } else {
          indexOffset = _.options.slidesToShow + index;
          allSlides.slice(indexOffset - centerOffset + 1 + evenCoef, indexOffset + centerOffset + 2).addClass('slick-active').attr('aria-hidden', 'false');
        }

        if (index === 0) {
          allSlides.eq(allSlides.length - 1 - _.options.slidesToShow).addClass('slick-center');
        } else if (index === _.slideCount - 1) {
          allSlides.eq(_.options.slidesToShow).addClass('slick-center');
        }
      }

      _.$slides.eq(index).addClass('slick-center');
    } else {
      if (index >= 0 && index <= _.slideCount - _.options.slidesToShow) {
        _.$slides.slice(index, index + _.options.slidesToShow).addClass('slick-active').attr('aria-hidden', 'false');
      } else if (allSlides.length <= _.options.slidesToShow) {
        allSlides.addClass('slick-active').attr('aria-hidden', 'false');
      } else {
        remainder = _.slideCount % _.options.slidesToShow;
        indexOffset = _.options.infinite === true ? _.options.slidesToShow + index : index;

        if (_.options.slidesToShow == _.options.slidesToScroll && _.slideCount - index < _.options.slidesToShow) {
          allSlides.slice(indexOffset - (_.options.slidesToShow - remainder), indexOffset + remainder).addClass('slick-active').attr('aria-hidden', 'false');
        } else {
          allSlides.slice(indexOffset, indexOffset + _.options.slidesToShow).addClass('slick-active').attr('aria-hidden', 'false');
        }
      }
    }

    if (_.options.lazyLoad === 'ondemand' || _.options.lazyLoad === 'anticipated') {
      _.lazyLoad();
    }
  };

  Slick.prototype.setupInfinite = function () {
    var _ = this,
      i,
      slideIndex,
      infiniteCount;

    if (_.options.fade === true) {
      _.options.centerMode = false;
    }

    if (_.options.infinite === true && _.options.fade === false) {
      slideIndex = null;

      if (_.slideCount > _.options.slidesToShow) {
        if (_.options.centerMode === true) {
          infiniteCount = _.options.slidesToShow + 1;
        } else {
          infiniteCount = _.options.slidesToShow;
        }

        for (i = _.slideCount; i > _.slideCount - infiniteCount; i -= 1) {
          slideIndex = i - 1;
          $(_.$slides[slideIndex]).clone(true).attr('id', '').attr('data-slick-index', slideIndex - _.slideCount).prependTo(_.$slideTrack).addClass('slick-cloned');
        }

        for (i = 0; i < infiniteCount + _.slideCount; i += 1) {
          slideIndex = i;
          $(_.$slides[slideIndex]).clone(true).attr('id', '').attr('data-slick-index', slideIndex + _.slideCount).appendTo(_.$slideTrack).addClass('slick-cloned');
        }

        _.$slideTrack.find('.slick-cloned').find('[id]').each(function () {
          $(this).attr('id', '');
        });
      }
    }
  };

  Slick.prototype.interrupt = function (toggle) {
    var _ = this;

    if (!toggle) {
      _.autoPlay();
    }

    _.interrupted = toggle;
  };

  Slick.prototype.selectHandler = function (event) {
    var _ = this;

    var targetElement = $(event.target).is('.slick-slide') ? $(event.target) : $(event.target).parents('.slick-slide');
    var index = parseInt(targetElement.attr('data-slick-index'));
    if (!index) index = 0;

    if (_.slideCount <= _.options.slidesToShow) {
      _.slideHandler(index, false, true);

      return;
    }

    _.slideHandler(index);
  };

  Slick.prototype.slideHandler = function (index, sync, dontAnimate) {
    var targetSlide,
      animSlide,
      oldSlide,
      slideLeft,
      targetLeft = null,
      _ = this,
      navTarget;

    sync = sync || false;

    if (_.animating === true && _.options.waitForAnimate === true) {
      return;
    }

    if (_.options.fade === true && _.currentSlide === index) {
      return;
    }

    if (sync === false) {
      _.asNavFor(index);
    }

    targetSlide = index;
    targetLeft = _.getLeft(targetSlide);
    slideLeft = _.getLeft(_.currentSlide);
    _.currentLeft = _.swipeLeft === null ? slideLeft : _.swipeLeft;

    if (_.options.infinite === false && _.options.centerMode === false && (index < 0 || index > _.getDotCount() * _.options.slidesToScroll)) {
      if (_.options.fade === false) {
        targetSlide = _.currentSlide;

        if (dontAnimate !== true && _.slideCount > _.options.slidesToShow) {
          _.animateSlide(slideLeft, function () {
            _.postSlide(targetSlide);
          });
        } else {
          _.postSlide(targetSlide);
        }
      }

      return;
    } else if (_.options.infinite === false && _.options.centerMode === true && (index < 0 || index > _.slideCount - _.options.slidesToScroll)) {
      if (_.options.fade === false) {
        targetSlide = _.currentSlide;

        if (dontAnimate !== true && _.slideCount > _.options.slidesToShow) {
          _.animateSlide(slideLeft, function () {
            _.postSlide(targetSlide);
          });
        } else {
          _.postSlide(targetSlide);
        }
      }

      return;
    }

    if (_.options.autoplay) {
      clearInterval(_.autoPlayTimer);
    }

    if (targetSlide < 0) {
      if (_.slideCount % _.options.slidesToScroll !== 0) {
        animSlide = _.slideCount - _.slideCount % _.options.slidesToScroll;
      } else {
        animSlide = _.slideCount + targetSlide;
      }
    } else if (targetSlide >= _.slideCount) {
      if (_.slideCount % _.options.slidesToScroll !== 0) {
        animSlide = 0;
      } else {
        animSlide = targetSlide - _.slideCount;
      }
    } else {
      animSlide = targetSlide;
    }

    _.animating = true;

    _.$slider.trigger('beforeChange', [_, _.currentSlide, animSlide]);

    oldSlide = _.currentSlide;
    _.currentSlide = animSlide;

    _.setSlideClasses(_.currentSlide);

    if (_.options.asNavFor) {
      navTarget = _.getNavTarget();
      navTarget = navTarget.slick('getSlick');

      if (navTarget.slideCount <= navTarget.options.slidesToShow) {
        navTarget.setSlideClasses(_.currentSlide);
      }
    }

    _.updateDots();

    _.updateArrows();

    if (_.options.fade === true) {
      if (dontAnimate !== true) {
        _.fadeSlideOut(oldSlide);

        _.fadeSlide(animSlide, function () {
          _.postSlide(animSlide);
        });
      } else {
        _.postSlide(animSlide);
      }

      _.animateHeight();

      return;
    }

    if (dontAnimate !== true && _.slideCount > _.options.slidesToShow) {
      _.animateSlide(targetLeft, function () {
        _.postSlide(animSlide);
      });
    } else {
      _.postSlide(animSlide);
    }
  };

  Slick.prototype.startLoad = function () {
    var _ = this;

    if (_.options.arrows === true && _.slideCount > _.options.slidesToShow) {
      _.$prevArrow.hide();

      _.$nextArrow.hide();
    }

    if (_.options.dots === true && _.slideCount > _.options.slidesToShow) {
      _.$dots.hide();
    }

    _.$slider.addClass('slick-loading');
  };

  Slick.prototype.swipeDirection = function () {
    var xDist,
      yDist,
      r,
      swipeAngle,
      _ = this;

    xDist = _.touchObject.startX - _.touchObject.curX;
    yDist = _.touchObject.startY - _.touchObject.curY;
    r = Math.atan2(yDist, xDist);
    swipeAngle = Math.round(r * 180 / Math.PI);

    if (swipeAngle < 0) {
      swipeAngle = 360 - Math.abs(swipeAngle);
    }

    if (swipeAngle <= 45 && swipeAngle >= 0) {
      return _.options.rtl === false ? 'left' : 'right';
    }

    if (swipeAngle <= 360 && swipeAngle >= 315) {
      return _.options.rtl === false ? 'left' : 'right';
    }

    if (swipeAngle >= 135 && swipeAngle <= 225) {
      return _.options.rtl === false ? 'right' : 'left';
    }

    if (_.options.verticalSwiping === true) {
      if (swipeAngle >= 35 && swipeAngle <= 135) {
        return 'down';
      } else {
        return 'up';
      }
    }

    return 'vertical';
  };

  Slick.prototype.swipeEnd = function (event) {
    var _ = this,
      slideCount,
      direction;

    _.dragging = false;
    _.swiping = false;

    if (_.scrolling) {
      _.scrolling = false;
      return false;
    }

    _.interrupted = false;
    _.shouldClick = _.touchObject.swipeLength > 10 ? false : true;

    if (_.touchObject.curX === undefined) {
      return false;
    }

    if (_.touchObject.edgeHit === true) {
      _.$slider.trigger('edge', [_, _.swipeDirection()]);
    }

    if (_.touchObject.swipeLength >= _.touchObject.minSwipe) {
      direction = _.swipeDirection();

      switch (direction) {
        case 'left':
        case 'down':
          slideCount = _.options.swipeToSlide ? _.checkNavigable(_.currentSlide + _.getSlideCount()) : _.currentSlide + _.getSlideCount();
          _.currentDirection = 0;
          break;

        case 'right':
        case 'up':
          slideCount = _.options.swipeToSlide ? _.checkNavigable(_.currentSlide - _.getSlideCount()) : _.currentSlide - _.getSlideCount();
          _.currentDirection = 1;
          break;

        default:
      }

      if (direction != 'vertical') {
        _.slideHandler(slideCount);

        _.touchObject = {};

        _.$slider.trigger('swipe', [_, direction]);
      }
    } else {
      if (_.touchObject.startX !== _.touchObject.curX) {
        _.slideHandler(_.currentSlide);

        _.touchObject = {};
      }
    }
  };

  Slick.prototype.swipeHandler = function (event) {
    var _ = this;

    if (_.options.swipe === false || 'ontouchend' in document && _.options.swipe === false) {
      return;
    } else if (_.options.draggable === false && event.type.indexOf('mouse') !== -1) {
      return;
    }

    _.touchObject.fingerCount = event.originalEvent && event.originalEvent.touches !== undefined ? event.originalEvent.touches.length : 1;
    _.touchObject.minSwipe = _.listWidth / _.options.touchThreshold;

    if (_.options.verticalSwiping === true) {
      _.touchObject.minSwipe = _.listHeight / _.options.touchThreshold;
    }

    switch (event.data.action) {
      case 'start':
        _.swipeStart(event);

        break;

      case 'move':
        _.swipeMove(event);

        break;

      case 'end':
        _.swipeEnd(event);

        break;
    }
  };

  Slick.prototype.swipeMove = function (event) {
    var _ = this,
      edgeWasHit = false,
      curLeft,
      swipeDirection,
      swipeLength,
      positionOffset,
      touches,
      verticalSwipeLength;

    touches = event.originalEvent !== undefined ? event.originalEvent.touches : null;

    if (!_.dragging || _.scrolling || touches && touches.length !== 1) {
      return false;
    }

    curLeft = _.getLeft(_.currentSlide);
    _.touchObject.curX = touches !== undefined ? touches[0].pageX : event.clientX;
    _.touchObject.curY = touches !== undefined ? touches[0].pageY : event.clientY;
    _.touchObject.swipeLength = Math.round(Math.sqrt(Math.pow(_.touchObject.curX - _.touchObject.startX, 2)));
    verticalSwipeLength = Math.round(Math.sqrt(Math.pow(_.touchObject.curY - _.touchObject.startY, 2)));

    if (!_.options.verticalSwiping && !_.swiping && verticalSwipeLength > 4) {
      _.scrolling = true;
      return false;
    }

    if (_.options.verticalSwiping === true) {
      _.touchObject.swipeLength = verticalSwipeLength;
    }

    swipeDirection = _.swipeDirection();

    if (event.originalEvent !== undefined && _.touchObject.swipeLength > 4) {
      _.swiping = true;
      event.preventDefault();
    }

    positionOffset = (_.options.rtl === false ? 1 : -1) * (_.touchObject.curX > _.touchObject.startX ? 1 : -1);

    if (_.options.verticalSwiping === true) {
      positionOffset = _.touchObject.curY > _.touchObject.startY ? 1 : -1;
    }

    swipeLength = _.touchObject.swipeLength;
    _.touchObject.edgeHit = false;

    if (_.options.infinite === false) {
      if (_.currentSlide === 0 && swipeDirection === 'right' || _.currentSlide >= _.getDotCount() && swipeDirection === 'left') {
        swipeLength = _.touchObject.swipeLength * _.options.edgeFriction;
        _.touchObject.edgeHit = true;
      }
    }

    if (_.options.vertical === false) {
      _.swipeLeft = curLeft + swipeLength * positionOffset;
    } else {
      _.swipeLeft = curLeft + swipeLength * (_.$list.height() / _.listWidth) * positionOffset;
    }

    if (_.options.verticalSwiping === true) {
      _.swipeLeft = curLeft + swipeLength * positionOffset;
    }

    if (_.options.fade === true || _.options.touchMove === false) {
      return false;
    }

    if (_.animating === true) {
      _.swipeLeft = null;
      return false;
    }

    _.setCSS(_.swipeLeft);
  };

  Slick.prototype.swipeStart = function (event) {
    var _ = this,
      touches;

    _.interrupted = true;

    if (_.touchObject.fingerCount !== 1 || _.slideCount <= _.options.slidesToShow) {
      _.touchObject = {};
      return false;
    }

    if (event.originalEvent !== undefined && event.originalEvent.touches !== undefined) {
      touches = event.originalEvent.touches[0];
    }

    _.touchObject.startX = _.touchObject.curX = touches !== undefined ? touches.pageX : event.clientX;
    _.touchObject.startY = _.touchObject.curY = touches !== undefined ? touches.pageY : event.clientY;
    _.dragging = true;
  };

  Slick.prototype.unfilterSlides = Slick.prototype.slickUnfilter = function () {
    var _ = this;

    if (_.$slidesCache !== null) {
      _.unload();

      _.$slideTrack.children(this.options.slide).detach();

      _.$slidesCache.appendTo(_.$slideTrack);

      _.reinit();
    }
  };

  Slick.prototype.unload = function () {
    var _ = this;

    $('.slick-cloned', _.$slider).remove();

    if (_.$dots) {
      _.$dots.remove();
    }

    if (_.$prevArrow && _.htmlExpr.test(_.options.prevArrow)) {
      _.$prevArrow.remove();
    }

    if (_.$nextArrow && _.htmlExpr.test(_.options.nextArrow)) {
      _.$nextArrow.remove();
    }

    _.$slides.removeClass('slick-slide slick-active slick-visible slick-current').attr('aria-hidden', 'true').css('width', '');
  };

  Slick.prototype.unslick = function (fromBreakpoint) {
    var _ = this;

    _.$slider.trigger('unslick', [_, fromBreakpoint]);

    _.destroy();
  };

  Slick.prototype.updateArrows = function () {
    var _ = this,
      centerOffset;

    centerOffset = Math.floor(_.options.slidesToShow / 2);

    if (_.options.arrows === true && _.slideCount > _.options.slidesToShow && !_.options.infinite) {
      _.$prevArrow.removeClass('slick-disabled').attr('aria-disabled', 'false');

      _.$nextArrow.removeClass('slick-disabled').attr('aria-disabled', 'false');

      if (_.currentSlide === 0) {
        _.$prevArrow.addClass('slick-disabled').attr('aria-disabled', 'true');

        _.$nextArrow.removeClass('slick-disabled').attr('aria-disabled', 'false');
      } else if (_.currentSlide >= _.slideCount - _.options.slidesToShow && _.options.centerMode === false) {
        _.$nextArrow.addClass('slick-disabled').attr('aria-disabled', 'true');

        _.$prevArrow.removeClass('slick-disabled').attr('aria-disabled', 'false');
      } else if (_.currentSlide >= _.slideCount - 1 && _.options.centerMode === true) {
        _.$nextArrow.addClass('slick-disabled').attr('aria-disabled', 'true');

        _.$prevArrow.removeClass('slick-disabled').attr('aria-disabled', 'false');
      }
    }
  };

  Slick.prototype.updateDots = function () {
    var _ = this;

    if (_.$dots !== null) {
      _.$dots.find('li').removeClass('slick-active').end();

      _.$dots.find('li').eq(Math.floor(_.currentSlide / _.options.slidesToScroll)).addClass('slick-active');
    }
  };

  Slick.prototype.visibility = function () {
    var _ = this;

    if (_.options.autoplay) {
      if (document[_.hidden]) {
        _.interrupted = true;
      } else {
        _.interrupted = false;
      }
    }
  };

  $.fn.slick = function () {
    var _ = this,
      opt = arguments[0],
      args = Array.prototype.slice.call(arguments, 1),
      l = _.length,
      i,
      ret;

    for (i = 0; i < l; i++) {
      if (_typeof(opt) == 'object' || typeof opt == 'undefined') _[i].slick = new Slick(_[i], opt); else ret = _[i].slick[opt].apply(_[i].slick, args);
      if (typeof ret != 'undefined') return ret;
    }

    return _;
  };
});
"use strict";

function toggleMenu() {
  var bodyElem = document.querySelector("body");
  var menuToggle = document.querySelector(".menu-toggle");
  menuToggle.addEventListener("click", function () {
    bodyElem.classList.toggle("menu-visible");
  });
}

function sliderInit(elem) {
  var controls = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var workSlider = jQuery(elem);

  if (controls) {
    var workSliderNav = jQuery(controls);
    workSlider.on('init', function (event, slick) {
      workSliderNav.eq(0).addClass("active");
    });
    workSliderNav.on("mouseover", function (e) {
      e.preventDefault();
      var slideIndex = jQuery(this).index();
      setTimeout(function () {
        workSlider.slick('slickGoTo', slideIndex);
      }, 100);
    });
  }

  workSlider.on('beforeChange', function (event, slick, currentSlide, nextSlide) {
    if (controls) {
      workSliderNav.removeClass("active");
      workSliderNav.eq(nextSlide).addClass("active");
    }
  });
  workSlider.slick({
    dots: true,
    infinite: true,
    speed: 250,
    fade: true,
    cssEase: 'linear',
    arrows: false,
    autoplay: true
  });
}

sliderInit('.work-slider', '.work-slider-nav ul li');
sliderInit('.detail-slider');
toggleMenu();
"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

/*SMOOTH SCROLL IOS */
!function () {
  "use strict";

  function o() {
    var o = window,
      t = document;

    if (!("scrollBehavior" in t.documentElement.style && !0 !== o.__forceSmoothScrollPolyfill__)) {
      var l,
        e = o.HTMLElement || o.Element,
        r = 468,
        i = {
          scroll: o.scroll || o.scrollTo,
          scrollBy: o.scrollBy,
          elementScroll: e.prototype.scroll || n,
          scrollIntoView: e.prototype.scrollIntoView
        },
        s = o.performance && o.performance.now ? o.performance.now.bind(o.performance) : Date.now,
        c = (l = o.navigator.userAgent, new RegExp(["MSIE ", "Trident/", "Edge/"].join("|")).test(l) ? 1 : 0);
      o.scroll = o.scrollTo = function () {
        void 0 !== arguments[0] && (!0 !== f(arguments[0]) ? h.call(o, t.body, void 0 !== arguments[0].left ? ~~arguments[0].left : o.scrollX || o.pageXOffset, void 0 !== arguments[0].top ? ~~arguments[0].top : o.scrollY || o.pageYOffset) : i.scroll.call(o, void 0 !== arguments[0].left ? arguments[0].left : "object" != _typeof(arguments[0]) ? arguments[0] : o.scrollX || o.pageXOffset, void 0 !== arguments[0].top ? arguments[0].top : void 0 !== arguments[1] ? arguments[1] : o.scrollY || o.pageYOffset));
      }, o.scrollBy = function () {
        void 0 !== arguments[0] && (f(arguments[0]) ? i.scrollBy.call(o, void 0 !== arguments[0].left ? arguments[0].left : "object" != _typeof(arguments[0]) ? arguments[0] : 0, void 0 !== arguments[0].top ? arguments[0].top : void 0 !== arguments[1] ? arguments[1] : 0) : h.call(o, t.body, ~~arguments[0].left + (o.scrollX || o.pageXOffset), ~~arguments[0].top + (o.scrollY || o.pageYOffset)));
      }, e.prototype.scroll = e.prototype.scrollTo = function () {
        if (void 0 !== arguments[0]) if (!0 !== f(arguments[0])) {
          var o = arguments[0].left,
            t = arguments[0].top;
          h.call(this, this, void 0 === o ? this.scrollLeft : ~~o, void 0 === t ? this.scrollTop : ~~t);
        } else {
          if ("number" == typeof arguments[0] && void 0 === arguments[1]) throw new SyntaxError("Value could not be converted");
          i.elementScroll.call(this, void 0 !== arguments[0].left ? ~~arguments[0].left : "object" != _typeof(arguments[0]) ? ~~arguments[0] : this.scrollLeft, void 0 !== arguments[0].top ? ~~arguments[0].top : void 0 !== arguments[1] ? ~~arguments[1] : this.scrollTop);
        }
      }, e.prototype.scrollBy = function () {
        void 0 !== arguments[0] && (!0 !== f(arguments[0]) ? this.scroll({
          left: ~~arguments[0].left + this.scrollLeft,
          top: ~~arguments[0].top + this.scrollTop,
          behavior: arguments[0].behavior
        }) : i.elementScroll.call(this, void 0 !== arguments[0].left ? ~~arguments[0].left + this.scrollLeft : ~~arguments[0] + this.scrollLeft, void 0 !== arguments[0].top ? ~~arguments[0].top + this.scrollTop : ~~arguments[1] + this.scrollTop));
      }, e.prototype.scrollIntoView = function () {
        if (!0 !== f(arguments[0])) {
          var l = function (o) {
            for (; o !== t.body && !1 === (e = p(l = o, "Y") && a(l, "Y"), r = p(l, "X") && a(l, "X"), e || r);) {
              o = o.parentNode || o.host;
            }

            var l, e, r;
            return o;
          }(this),
            e = l.getBoundingClientRect(),
            r = this.getBoundingClientRect();

          l !== t.body ? (h.call(this, l, l.scrollLeft + r.left - e.left, l.scrollTop + r.top - e.top), "fixed" !== o.getComputedStyle(l).position && o.scrollBy({
            left: e.left,
            top: e.top,
            behavior: "smooth"
          })) : o.scrollBy({
            left: r.left,
            top: r.top,
            behavior: "smooth"
          });
        } else i.scrollIntoView.call(this, void 0 === arguments[0] || arguments[0]);
      };
    }

    function n(o, t) {
      this.scrollLeft = o, this.scrollTop = t;
    }

    function f(o) {
      if (null === o || "object" != _typeof(o) || void 0 === o.behavior || "auto" === o.behavior || "instant" === o.behavior) return !0;
      if ("object" == _typeof(o) && "smooth" === o.behavior) return !1;
      throw new TypeError("behavior member of ScrollOptions " + o.behavior + " is not a valid value for enumeration ScrollBehavior.");
    }

    function p(o, t) {
      return "Y" === t ? o.clientHeight + c < o.scrollHeight : "X" === t ? o.clientWidth + c < o.scrollWidth : void 0;
    }

    function a(t, l) {
      var e = o.getComputedStyle(t, null)["overflow" + l];
      return "auto" === e || "scroll" === e;
    }

    function d(t) {
      var l,
        e,
        i,
        c,
        n = (s() - t.startTime) / r;
      c = n = n > 1 ? 1 : n, l = .5 * (1 - Math.cos(Math.PI * c)), e = t.startX + (t.x - t.startX) * l, i = t.startY + (t.y - t.startY) * l, t.method.call(t.scrollable, e, i), e === t.x && i === t.y || o.requestAnimationFrame(d.bind(o, t));
    }

    function h(l, e, r) {
      var c,
        f,
        p,
        a,
        h = s();
      l === t.body ? (c = o, f = o.scrollX || o.pageXOffset, p = o.scrollY || o.pageYOffset, a = i.scroll) : (c = l, f = l.scrollLeft, p = l.scrollTop, a = n), d({
        scrollable: c,
        method: a,
        startTime: h,
        startX: f,
        startY: p,
        x: e,
        y: r
      });
    }
  }

  "object" == (typeof exports === "undefined" ? "undefined" : _typeof(exports)) && "undefined" != typeof module ? module.exports = {
    polyfill: o
  } : o();
}();
"use strict";

var bodyElem = document.querySelector('body');
var waypoint = new Waypoint({
  element: bodyElem,
  offset: 100,
  handler: function handler(direction) {
    if (direction === "down") {
      bodyElem.classList.add("to-top-visible");
    } else {
      bodyElem.classList.remove("to-top-visible");
    }
  }
});
var toTop = document.querySelector(".to-top");
toTop.addEventListener("click", function () {
  jQuery('html,body').animate({
    scrollTop: 0
  });
});
var workTiles = document.querySelectorAll('.work-tile');

if (workTiles.length > 0) {
  workTiles.forEach(function (tile) {
    var anim = new Waypoint({
      element: tile,
      offset: "75%",
      handler: function handler(direction) {
        tile.classList.add("active");
      }
    });
  });
}

var detailSections = document.querySelectorAll('.detail-section');

if (detailSections.length > 0) {
  detailSections.forEach(function (tile) {
    var anim = new Waypoint({
      element: tile,
      offset: "75%",
      handler: function handler(direction) {
        tile.classList.add("active");
      }
    });
  });
}

var aboutSection = document.querySelector('.title');

if (aboutSection) {
  var aboutAnim = new Waypoint({
    element: aboutSection,
    offset: "75%",
    handler: function handler(direction) {
      aboutSection.classList.add("active");
    }
  });
}
"use strict";

function getVideos() {
  return document.querySelectorAll(".vimeo-player");
}

function createVideos() {
  var videos = getVideos();
  videos.forEach(function (video) {
    var vidid = video.getAttribute("vimeoID");
    var autoplay = video.getAttribute("data-autoplay") ? true : false;
    var videoPlayer = new Vimeo.Player(video, {
      url: "https://vimeo.com/".concat(vidid),
      loop: true,
      muted: autoplay,
      controls: !autoplay,
      autoplay: autoplay,
      autopause: 0
    });
    videoPlayer.ready().then(function () {
      inView('#v' + vidid).on('enter', function (el) {
        document.querySelector('#v' + vidid + " iframe").removeAttribute("title");

        if (autoplay) {
          videoPlayer.play().then(function () {
            console.log('starting' + vidid + " AUTOPLAY: " + autoplay);
          });
        }
      }).on('exit', function (el) {
        videoPlayer.pause().then(function () {
          console.log('pausing' + vidid);
        });
      });
    });
  });
}

getVideos().length > 0 ? createVideos() : '';
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIl9ub2ZyYW1ld29yay53YXlwb2ludHMuanMiLCJfc2xpY2suanMiLCJuYXYuanMiLCJwb2x5ZmlsbHMuanMiLCJzY3JvbGwtY29udHJvbHMuanMiLCJ2aW1lb19jb250cm9scy5qcyJdLCJuYW1lcyI6WyJrZXlDb3VudGVyIiwiYWxsV2F5cG9pbnRzIiwiV2F5cG9pbnQiLCJvcHRpb25zIiwiRXJyb3IiLCJlbGVtZW50IiwiaGFuZGxlciIsImtleSIsIkFkYXB0ZXIiLCJleHRlbmQiLCJkZWZhdWx0cyIsImFkYXB0ZXIiLCJjYWxsYmFjayIsImF4aXMiLCJob3Jpem9udGFsIiwiZW5hYmxlZCIsInRyaWdnZXJQb2ludCIsImdyb3VwIiwiR3JvdXAiLCJmaW5kT3JDcmVhdGUiLCJuYW1lIiwiY29udGV4dCIsIkNvbnRleHQiLCJmaW5kT3JDcmVhdGVCeUVsZW1lbnQiLCJvZmZzZXRBbGlhc2VzIiwib2Zmc2V0IiwiYWRkIiwicHJvdG90eXBlIiwicXVldWVUcmlnZ2VyIiwiZGlyZWN0aW9uIiwidHJpZ2dlciIsImFyZ3MiLCJhcHBseSIsImRlc3Ryb3kiLCJyZW1vdmUiLCJkaXNhYmxlIiwiZW5hYmxlIiwicmVmcmVzaCIsIm5leHQiLCJwcmV2aW91cyIsImludm9rZUFsbCIsIm1ldGhvZCIsImFsbFdheXBvaW50c0FycmF5Iiwid2F5cG9pbnRLZXkiLCJwdXNoIiwiaSIsImVuZCIsImxlbmd0aCIsImRlc3Ryb3lBbGwiLCJkaXNhYmxlQWxsIiwiZW5hYmxlQWxsIiwicmVmcmVzaEFsbCIsInZpZXdwb3J0SGVpZ2h0Iiwid2luZG93IiwiaW5uZXJIZWlnaHQiLCJkb2N1bWVudCIsImRvY3VtZW50RWxlbWVudCIsImNsaWVudEhlaWdodCIsInZpZXdwb3J0V2lkdGgiLCJjbGllbnRXaWR0aCIsImFkYXB0ZXJzIiwiY29udGludW91cyIsIm91dGVySGVpZ2h0IiwiaW5uZXJXaWR0aCIsIm91dGVyV2lkdGgiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWVTaGltIiwic2V0VGltZW91dCIsImNvbnRleHRzIiwib2xkV2luZG93TG9hZCIsIm9ubG9hZCIsImRpZFNjcm9sbCIsImRpZFJlc2l6ZSIsIm9sZFNjcm9sbCIsIngiLCJzY3JvbGxMZWZ0IiwieSIsInNjcm9sbFRvcCIsIndheXBvaW50cyIsInZlcnRpY2FsIiwid2F5cG9pbnRDb250ZXh0S2V5Iiwid2luZG93Q29udGV4dCIsImNyZWF0ZVRocm90dGxlZFNjcm9sbEhhbmRsZXIiLCJjcmVhdGVUaHJvdHRsZWRSZXNpemVIYW5kbGVyIiwid2F5cG9pbnQiLCJjaGVja0VtcHR5IiwiaG9yaXpvbnRhbEVtcHR5IiwiaXNFbXB0eU9iamVjdCIsInZlcnRpY2FsRW1wdHkiLCJpc1dpbmRvdyIsIm9mZiIsInNlbGYiLCJyZXNpemVIYW5kbGVyIiwiaGFuZGxlUmVzaXplIiwib24iLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJzY3JvbGxIYW5kbGVyIiwiaGFuZGxlU2Nyb2xsIiwiaXNUb3VjaCIsInRyaWdnZXJlZEdyb3VwcyIsImF4ZXMiLCJuZXdTY3JvbGwiLCJmb3J3YXJkIiwiYmFja3dhcmQiLCJheGlzS2V5IiwiaXNGb3J3YXJkIiwid2FzQmVmb3JlVHJpZ2dlclBvaW50Iiwibm93QWZ0ZXJUcmlnZ2VyUG9pbnQiLCJjcm9zc2VkRm9yd2FyZCIsImNyb3NzZWRCYWNrd2FyZCIsImlkIiwiZ3JvdXBLZXkiLCJmbHVzaFRyaWdnZXJzIiwiY29udGV4dE9mZnNldCIsInVuZGVmaW5lZCIsImxlZnQiLCJjb250ZXh0U2Nyb2xsIiwiY29udGV4dERpbWVuc2lvbiIsIm9mZnNldFByb3AiLCJ0b3AiLCJhZGp1c3RtZW50Iiwib2xkVHJpZ2dlclBvaW50IiwiZWxlbWVudE9mZnNldCIsImZyZXNoV2F5cG9pbnQiLCJjb250ZXh0TW9kaWZpZXIiLCJ3YXNCZWZvcmVTY3JvbGwiLCJub3dBZnRlclNjcm9sbCIsInRyaWdnZXJlZEJhY2t3YXJkIiwidHJpZ2dlcmVkRm9yd2FyZCIsInBhcnNlRmxvYXQiLCJpbmRleE9mIiwiTWF0aCIsImNlaWwiLCJmbG9vciIsImZpbmRCeUVsZW1lbnQiLCJjb250ZXh0SWQiLCJyZXF1ZXN0Rm4iLCJtb3pSZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJ3ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJjYWxsIiwiYnlUcmlnZ2VyUG9pbnQiLCJhIiwiYiIsImJ5UmV2ZXJzZVRyaWdnZXJQb2ludCIsImdyb3VwcyIsImNsZWFyVHJpZ2dlclF1ZXVlcyIsInRyaWdnZXJRdWV1ZXMiLCJ1cCIsImRvd24iLCJyaWdodCIsInJldmVyc2UiLCJzb3J0IiwiaW5kZXgiLCJpbkFycmF5IiwiaXNMYXN0Iiwic3BsaWNlIiwiZmlyc3QiLCJsYXN0IiwiZ2V0V2luZG93IiwiZGVmYXVsdFZpZXciLCJOb0ZyYW1ld29ya0FkYXB0ZXIiLCJoYW5kbGVycyIsImlzV2luIiwiZXZlbnQiLCJyZW1vdmVMaXN0ZW5lcnMiLCJsaXN0ZW5lcnMiLCJsaXN0ZW5lciIsInJlbW92ZUV2ZW50TGlzdGVuZXIiLCJldmVudFBhcnRzIiwic3BsaXQiLCJldmVudFR5cGUiLCJuYW1lc3BhY2UiLCJucyIsInR5cGUiLCJvd25lckRvY3VtZW50Iiwid2luIiwicmVjdCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsInBhZ2VZT2Zmc2V0IiwiY2xpZW50VG9wIiwicGFnZVhPZmZzZXQiLCJjbGllbnRMZWZ0IiwibnNIYW5kbGVycyIsIm5zVHlwZUxpc3QiLCJhZGRFdmVudExpc3RlbmVyIiwiaW5jbHVkZU1hcmdpbiIsImhlaWdodCIsImNvbXB1dGVkU3R5bGUiLCJnZXRDb21wdXRlZFN0eWxlIiwicGFyc2VJbnQiLCJtYXJnaW5Ub3AiLCJtYXJnaW5Cb3R0b20iLCJ3aWR0aCIsIm1hcmdpbkxlZnQiLCJtYXJnaW5SaWdodCIsIkFycmF5Iiwic2xpY2UiLCJhcmd1bWVudHMiLCJtZXJnZSIsInRhcmdldCIsIm9iaiIsImhhc093blByb3BlcnR5IiwiYXJyYXkiLCJmYWN0b3J5IiwiZGVmaW5lIiwiYW1kIiwiZXhwb3J0cyIsIm1vZHVsZSIsInJlcXVpcmUiLCJqUXVlcnkiLCIkIiwiU2xpY2siLCJpbnN0YW5jZVVpZCIsInNldHRpbmdzIiwiXyIsImRhdGFTZXR0aW5ncyIsImFjY2Vzc2liaWxpdHkiLCJhZGFwdGl2ZUhlaWdodCIsImFwcGVuZEFycm93cyIsImFwcGVuZERvdHMiLCJhcnJvd3MiLCJhc05hdkZvciIsInByZXZBcnJvdyIsIm5leHRBcnJvdyIsImF1dG9wbGF5IiwiYXV0b3BsYXlTcGVlZCIsImNlbnRlck1vZGUiLCJjZW50ZXJQYWRkaW5nIiwiY3NzRWFzZSIsImN1c3RvbVBhZ2luZyIsInNsaWRlciIsInRleHQiLCJkb3RzIiwiZG90c0NsYXNzIiwiZHJhZ2dhYmxlIiwiZWFzaW5nIiwiZWRnZUZyaWN0aW9uIiwiZmFkZSIsImZvY3VzT25TZWxlY3QiLCJmb2N1c09uQ2hhbmdlIiwiaW5maW5pdGUiLCJpbml0aWFsU2xpZGUiLCJsYXp5TG9hZCIsIm1vYmlsZUZpcnN0IiwicGF1c2VPbkhvdmVyIiwicGF1c2VPbkZvY3VzIiwicGF1c2VPbkRvdHNIb3ZlciIsInJlc3BvbmRUbyIsInJlc3BvbnNpdmUiLCJyb3dzIiwicnRsIiwic2xpZGUiLCJzbGlkZXNQZXJSb3ciLCJzbGlkZXNUb1Nob3ciLCJzbGlkZXNUb1Njcm9sbCIsInNwZWVkIiwic3dpcGUiLCJzd2lwZVRvU2xpZGUiLCJ0b3VjaE1vdmUiLCJ0b3VjaFRocmVzaG9sZCIsInVzZUNTUyIsInVzZVRyYW5zZm9ybSIsInZhcmlhYmxlV2lkdGgiLCJ2ZXJ0aWNhbFN3aXBpbmciLCJ3YWl0Rm9yQW5pbWF0ZSIsInpJbmRleCIsImluaXRpYWxzIiwiYW5pbWF0aW5nIiwiZHJhZ2dpbmciLCJhdXRvUGxheVRpbWVyIiwiY3VycmVudERpcmVjdGlvbiIsImN1cnJlbnRMZWZ0IiwiY3VycmVudFNsaWRlIiwiJGRvdHMiLCJsaXN0V2lkdGgiLCJsaXN0SGVpZ2h0IiwibG9hZEluZGV4IiwiJG5leHRBcnJvdyIsIiRwcmV2QXJyb3ciLCJzY3JvbGxpbmciLCJzbGlkZUNvdW50Iiwic2xpZGVXaWR0aCIsIiRzbGlkZVRyYWNrIiwiJHNsaWRlcyIsInNsaWRpbmciLCJzbGlkZU9mZnNldCIsInN3aXBlTGVmdCIsInN3aXBpbmciLCIkbGlzdCIsInRvdWNoT2JqZWN0IiwidHJhbnNmb3Jtc0VuYWJsZWQiLCJ1bnNsaWNrZWQiLCJhY3RpdmVCcmVha3BvaW50IiwiYW5pbVR5cGUiLCJhbmltUHJvcCIsImJyZWFrcG9pbnRzIiwiYnJlYWtwb2ludFNldHRpbmdzIiwiY3NzVHJhbnNpdGlvbnMiLCJmb2N1c3NlZCIsImludGVycnVwdGVkIiwiaGlkZGVuIiwicGF1c2VkIiwicG9zaXRpb25Qcm9wIiwicm93Q291bnQiLCJzaG91bGRDbGljayIsIiRzbGlkZXIiLCIkc2xpZGVzQ2FjaGUiLCJ0cmFuc2Zvcm1UeXBlIiwidHJhbnNpdGlvblR5cGUiLCJ2aXNpYmlsaXR5Q2hhbmdlIiwid2luZG93V2lkdGgiLCJ3aW5kb3dUaW1lciIsImRhdGEiLCJvcmlnaW5hbFNldHRpbmdzIiwibW96SGlkZGVuIiwid2Via2l0SGlkZGVuIiwiYXV0b1BsYXkiLCJwcm94eSIsImF1dG9QbGF5Q2xlYXIiLCJhdXRvUGxheUl0ZXJhdG9yIiwiY2hhbmdlU2xpZGUiLCJjbGlja0hhbmRsZXIiLCJzZWxlY3RIYW5kbGVyIiwic2V0UG9zaXRpb24iLCJzd2lwZUhhbmRsZXIiLCJkcmFnSGFuZGxlciIsImtleUhhbmRsZXIiLCJodG1sRXhwciIsInJlZ2lzdGVyQnJlYWtwb2ludHMiLCJpbml0IiwiYWN0aXZhdGVBREEiLCJmaW5kIiwiYXR0ciIsImFkZFNsaWRlIiwic2xpY2tBZGQiLCJtYXJrdXAiLCJhZGRCZWZvcmUiLCJ1bmxvYWQiLCJhcHBlbmRUbyIsImluc2VydEJlZm9yZSIsImVxIiwiaW5zZXJ0QWZ0ZXIiLCJwcmVwZW5kVG8iLCJjaGlsZHJlbiIsImRldGFjaCIsImFwcGVuZCIsImVhY2giLCJyZWluaXQiLCJhbmltYXRlSGVpZ2h0IiwidGFyZ2V0SGVpZ2h0IiwiYW5pbWF0ZSIsImFuaW1hdGVTbGlkZSIsInRhcmdldExlZnQiLCJhbmltUHJvcHMiLCJhbmltU3RhcnQiLCJkdXJhdGlvbiIsInN0ZXAiLCJub3ciLCJjc3MiLCJjb21wbGV0ZSIsImFwcGx5VHJhbnNpdGlvbiIsImRpc2FibGVUcmFuc2l0aW9uIiwiZ2V0TmF2VGFyZ2V0Iiwibm90Iiwic2xpY2siLCJzbGlkZUhhbmRsZXIiLCJ0cmFuc2l0aW9uIiwic2V0SW50ZXJ2YWwiLCJjbGVhckludGVydmFsIiwic2xpZGVUbyIsImJ1aWxkQXJyb3dzIiwiYWRkQ2xhc3MiLCJyZW1vdmVDbGFzcyIsInJlbW92ZUF0dHIiLCJ0ZXN0IiwiYnVpbGREb3RzIiwiZG90IiwiZ2V0RG90Q291bnQiLCJidWlsZE91dCIsIndyYXBBbGwiLCJwYXJlbnQiLCJ3cmFwIiwic2V0dXBJbmZpbml0ZSIsInVwZGF0ZURvdHMiLCJzZXRTbGlkZUNsYXNzZXMiLCJidWlsZFJvd3MiLCJjIiwibmV3U2xpZGVzIiwibnVtT2ZTbGlkZXMiLCJvcmlnaW5hbFNsaWRlcyIsInNsaWRlc1BlclNlY3Rpb24iLCJjcmVhdGVEb2N1bWVudEZyYWdtZW50IiwiY3JlYXRlRWxlbWVudCIsInJvdyIsImdldCIsImFwcGVuZENoaWxkIiwiZW1wdHkiLCJjaGVja1Jlc3BvbnNpdmUiLCJpbml0aWFsIiwiZm9yY2VVcGRhdGUiLCJicmVha3BvaW50IiwidGFyZ2V0QnJlYWtwb2ludCIsInJlc3BvbmRUb1dpZHRoIiwidHJpZ2dlckJyZWFrcG9pbnQiLCJzbGlkZXJXaWR0aCIsIm1pbiIsInVuc2xpY2siLCJkb250QW5pbWF0ZSIsIiR0YXJnZXQiLCJjdXJyZW50VGFyZ2V0IiwiaW5kZXhPZmZzZXQiLCJ1bmV2ZW5PZmZzZXQiLCJpcyIsInByZXZlbnREZWZhdWx0IiwiY2xvc2VzdCIsIm1lc3NhZ2UiLCJjaGVja05hdmlnYWJsZSIsIm5hdmlnYWJsZXMiLCJwcmV2TmF2aWdhYmxlIiwiZ2V0TmF2aWdhYmxlSW5kZXhlcyIsIm4iLCJjbGVhblVwRXZlbnRzIiwiaW50ZXJydXB0IiwidmlzaWJpbGl0eSIsImNsZWFuVXBTbGlkZUV2ZW50cyIsIm9yaWVudGF0aW9uQ2hhbmdlIiwicmVzaXplIiwiY2xlYW5VcFJvd3MiLCJzdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24iLCJzdG9wUHJvcGFnYXRpb24iLCJmYWRlU2xpZGUiLCJzbGlkZUluZGV4Iiwib3BhY2l0eSIsImZhZGVTbGlkZU91dCIsImZpbHRlclNsaWRlcyIsInNsaWNrRmlsdGVyIiwiZmlsdGVyIiwiZm9jdXNIYW5kbGVyIiwiJHNmIiwiZ2V0Q3VycmVudCIsInNsaWNrQ3VycmVudFNsaWRlIiwiYnJlYWtQb2ludCIsImNvdW50ZXIiLCJwYWdlclF0eSIsImdldExlZnQiLCJ2ZXJ0aWNhbEhlaWdodCIsInZlcnRpY2FsT2Zmc2V0IiwidGFyZ2V0U2xpZGUiLCJjb2VmIiwib2Zmc2V0TGVmdCIsImdldE9wdGlvbiIsInNsaWNrR2V0T3B0aW9uIiwib3B0aW9uIiwiaW5kZXhlcyIsIm1heCIsImdldFNsaWNrIiwiZ2V0U2xpZGVDb3VudCIsInNsaWRlc1RyYXZlcnNlZCIsInN3aXBlZFNsaWRlIiwiY2VudGVyT2Zmc2V0IiwiYWJzIiwiZ29UbyIsInNsaWNrR29UbyIsImNyZWF0aW9uIiwiaGFzQ2xhc3MiLCJzZXRQcm9wcyIsInN0YXJ0TG9hZCIsImxvYWRTbGlkZXIiLCJpbml0aWFsaXplRXZlbnRzIiwidXBkYXRlQXJyb3dzIiwiaW5pdEFEQSIsIm51bURvdEdyb3VwcyIsInRhYkNvbnRyb2xJbmRleGVzIiwidmFsIiwic2xpZGVDb250cm9sSW5kZXgiLCJhcmlhQnV0dG9uQ29udHJvbCIsIm1hcHBlZFNsaWRlSW5kZXgiLCJpbml0QXJyb3dFdmVudHMiLCJpbml0RG90RXZlbnRzIiwiaW5pdFNsaWRlRXZlbnRzIiwiYWN0aW9uIiwiaW5pdFVJIiwic2hvdyIsInRhZ05hbWUiLCJtYXRjaCIsImtleUNvZGUiLCJsb2FkUmFuZ2UiLCJjbG9uZVJhbmdlIiwicmFuZ2VTdGFydCIsInJhbmdlRW5kIiwibG9hZEltYWdlcyIsImltYWdlc1Njb3BlIiwiaW1hZ2UiLCJpbWFnZVNvdXJjZSIsImltYWdlU3JjU2V0IiwiaW1hZ2VTaXplcyIsImltYWdlVG9Mb2FkIiwib25lcnJvciIsInNyYyIsInByZXZTbGlkZSIsIm5leHRTbGlkZSIsInByb2dyZXNzaXZlTGF6eUxvYWQiLCJzbGlja05leHQiLCJwYXVzZSIsInNsaWNrUGF1c2UiLCJwbGF5Iiwic2xpY2tQbGF5IiwicG9zdFNsaWRlIiwiJGN1cnJlbnRTbGlkZSIsImZvY3VzIiwicHJldiIsInNsaWNrUHJldiIsInRyeUNvdW50IiwiJGltZ3NUb0xvYWQiLCJpbml0aWFsaXppbmciLCJsYXN0VmlzaWJsZUluZGV4IiwiY3VycmVudEJyZWFrcG9pbnQiLCJsIiwicmVzcG9uc2l2ZVNldHRpbmdzIiwiY2xlYXJUaW1lb3V0Iiwid2luZG93RGVsYXkiLCJyZW1vdmVTbGlkZSIsInNsaWNrUmVtb3ZlIiwicmVtb3ZlQmVmb3JlIiwicmVtb3ZlQWxsIiwic2V0Q1NTIiwicG9zaXRpb24iLCJwb3NpdGlvblByb3BzIiwic2V0RGltZW5zaW9ucyIsInBhZGRpbmciLCJzZXRGYWRlIiwic2V0SGVpZ2h0Iiwic2V0T3B0aW9uIiwic2xpY2tTZXRPcHRpb24iLCJpdGVtIiwidmFsdWUiLCJvcHQiLCJib2R5U3R5bGUiLCJib2R5Iiwic3R5bGUiLCJXZWJraXRUcmFuc2l0aW9uIiwiTW96VHJhbnNpdGlvbiIsIm1zVHJhbnNpdGlvbiIsIk9UcmFuc2Zvcm0iLCJwZXJzcGVjdGl2ZVByb3BlcnR5Iiwid2Via2l0UGVyc3BlY3RpdmUiLCJNb3pUcmFuc2Zvcm0iLCJNb3pQZXJzcGVjdGl2ZSIsIndlYmtpdFRyYW5zZm9ybSIsIm1zVHJhbnNmb3JtIiwidHJhbnNmb3JtIiwiYWxsU2xpZGVzIiwicmVtYWluZGVyIiwiZXZlbkNvZWYiLCJpbmZpbml0ZUNvdW50IiwiY2xvbmUiLCJ0b2dnbGUiLCJ0YXJnZXRFbGVtZW50IiwicGFyZW50cyIsInN5bmMiLCJhbmltU2xpZGUiLCJvbGRTbGlkZSIsInNsaWRlTGVmdCIsIm5hdlRhcmdldCIsImhpZGUiLCJzd2lwZURpcmVjdGlvbiIsInhEaXN0IiwieURpc3QiLCJyIiwic3dpcGVBbmdsZSIsInN0YXJ0WCIsImN1clgiLCJzdGFydFkiLCJjdXJZIiwiYXRhbjIiLCJyb3VuZCIsIlBJIiwic3dpcGVFbmQiLCJzd2lwZUxlbmd0aCIsImVkZ2VIaXQiLCJtaW5Td2lwZSIsImZpbmdlckNvdW50Iiwib3JpZ2luYWxFdmVudCIsInRvdWNoZXMiLCJzd2lwZVN0YXJ0Iiwic3dpcGVNb3ZlIiwiZWRnZVdhc0hpdCIsImN1ckxlZnQiLCJwb3NpdGlvbk9mZnNldCIsInZlcnRpY2FsU3dpcGVMZW5ndGgiLCJwYWdlWCIsImNsaWVudFgiLCJwYWdlWSIsImNsaWVudFkiLCJzcXJ0IiwicG93IiwidW5maWx0ZXJTbGlkZXMiLCJzbGlja1VuZmlsdGVyIiwiZnJvbUJyZWFrcG9pbnQiLCJmbiIsInJldCIsInRvZ2dsZU1lbnUiLCJib2R5RWxlbSIsInF1ZXJ5U2VsZWN0b3IiLCJtZW51VG9nZ2xlIiwiY2xhc3NMaXN0Iiwic2xpZGVySW5pdCIsImVsZW0iLCJjb250cm9scyIsIndvcmtTbGlkZXIiLCJ3b3JrU2xpZGVyTmF2IiwiZSIsIm8iLCJ0IiwiX19mb3JjZVNtb290aFNjcm9sbFBvbHlmaWxsX18iLCJIVE1MRWxlbWVudCIsIkVsZW1lbnQiLCJzY3JvbGwiLCJzY3JvbGxUbyIsInNjcm9sbEJ5IiwiZWxlbWVudFNjcm9sbCIsInNjcm9sbEludG9WaWV3IiwicyIsInBlcmZvcm1hbmNlIiwiYmluZCIsIkRhdGUiLCJuYXZpZ2F0b3IiLCJ1c2VyQWdlbnQiLCJSZWdFeHAiLCJqb2luIiwiZiIsImgiLCJzY3JvbGxYIiwic2Nyb2xsWSIsIlN5bnRheEVycm9yIiwiYmVoYXZpb3IiLCJwIiwicGFyZW50Tm9kZSIsImhvc3QiLCJUeXBlRXJyb3IiLCJzY3JvbGxIZWlnaHQiLCJzY3JvbGxXaWR0aCIsImQiLCJzdGFydFRpbWUiLCJjb3MiLCJzY3JvbGxhYmxlIiwicG9seWZpbGwiLCJ0b1RvcCIsIndvcmtUaWxlcyIsInF1ZXJ5U2VsZWN0b3JBbGwiLCJmb3JFYWNoIiwidGlsZSIsImFuaW0iLCJkZXRhaWxTZWN0aW9ucyIsImFib3V0U2VjdGlvbiIsImFib3V0QW5pbSIsImdldFZpZGVvcyIsImNyZWF0ZVZpZGVvcyIsInZpZGVvcyIsInZpZGVvIiwidmlkaWQiLCJnZXRBdHRyaWJ1dGUiLCJ2aWRlb1BsYXllciIsIlZpbWVvIiwiUGxheWVyIiwidXJsIiwibG9vcCIsIm11dGVkIiwiYXV0b3BhdXNlIiwicmVhZHkiLCJ0aGVuIiwiaW5WaWV3IiwiZWwiLCJyZW1vdmVBdHRyaWJ1dGUiLCJjb25zb2xlIiwibG9nIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0MsYUFBVztBQUNWOztBQUVBLE1BQUlBLFVBQVUsR0FBRyxDQUFqQjtBQUNBLE1BQUlDLFlBQVksR0FBRyxFQUFuQjtBQUVBOztBQUNBLFdBQVNDLFFBQVQsQ0FBa0JDLE9BQWxCLEVBQTJCO0FBQ3pCLFFBQUksQ0FBQ0EsT0FBTCxFQUFjO0FBQ1osWUFBTSxJQUFJQyxLQUFKLENBQVUsMkNBQVYsQ0FBTjtBQUNEOztBQUNELFFBQUksQ0FBQ0QsT0FBTyxDQUFDRSxPQUFiLEVBQXNCO0FBQ3BCLFlBQU0sSUFBSUQsS0FBSixDQUFVLGtEQUFWLENBQU47QUFDRDs7QUFDRCxRQUFJLENBQUNELE9BQU8sQ0FBQ0csT0FBYixFQUFzQjtBQUNwQixZQUFNLElBQUlGLEtBQUosQ0FBVSxrREFBVixDQUFOO0FBQ0Q7O0FBRUQsU0FBS0csR0FBTCxHQUFXLGNBQWNQLFVBQXpCO0FBQ0EsU0FBS0csT0FBTCxHQUFlRCxRQUFRLENBQUNNLE9BQVQsQ0FBaUJDLE1BQWpCLENBQXdCLEVBQXhCLEVBQTRCUCxRQUFRLENBQUNRLFFBQXJDLEVBQStDUCxPQUEvQyxDQUFmO0FBQ0EsU0FBS0UsT0FBTCxHQUFlLEtBQUtGLE9BQUwsQ0FBYUUsT0FBNUI7QUFDQSxTQUFLTSxP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eUIsWUFBVztBQUNoQ0MsTUFBQUEsTUFBTSxDQUFDLE9BQU9YLEtBQVIsQ0FBTixDQUNLdGpCLEVBREwsQ0FDUSxPQURSLEVBQ2lCLFVBQUNra0IsRUFBRCxFQUFNO0FBRWZ4bUIsUUFBQUEsUUFBUSxDQUFDbWlCLGFBQVQsQ0FBdUIsT0FBT3lELEtBQVAsR0FBZSxTQUF0QyxFQUFpRGEsZUFBakQsQ0FBaUUsT0FBakU7O0FBRUEsWUFBR2pjLFFBQUgsRUFBWTtBQUNSc2IsVUFBQUEsV0FBVyxDQUFDN0osSUFBWixHQUFtQnFLLElBQW5CLENBQXdCLFlBQUk7QUFDeEJJLFlBQUFBLE9BQU8sQ0FBQ0MsR0FBUixDQUFZLGFBQWFmLEtBQWIsR0FBcUIsYUFBckIsR0FBcUNwYixRQUFqRDtBQUNILFdBRkQ7QUFHSDtBQUNKLE9BVkwsRUFXS2xJLEVBWEwsQ0FXUSxNQVhSLEVBV2dCLFVBQUFra0IsRUFBRSxFQUFJO0FBRWRWLFFBQUFBLFdBQVcsQ0FBQy9KLEtBQVosR0FBb0J1SyxJQUFwQixDQUF5QixZQUFJO0FBQ3pCSSxVQUFBQSxPQUFPLENBQUNDLEdBQVIsQ0FBWSxZQUFZZixLQUF4QjtBQUNILFNBRkQ7QUFHUCxPQWhCRDtBQWlCSCxLQWxCRDtBQW1CSCxHQWhDRDtBQWlDSDs7QUFFREosU0FBUyxHQUFHaG1CLE1BQVosR0FBcUIsQ0FBckIsR0FBeUJpbUIsWUFBWSxFQUFyQyxHQUEwQyxFQUExQyIsImZpbGUiOiJidWlsZC5taW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiFcbldheXBvaW50cyAtIDQuMC4xXG5Db3B5cmlnaHQgwqkgMjAxMS0yMDE2IENhbGViIFRyb3VnaHRvblxuTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuaHR0cHM6Ly9naXRodWIuY29tL2ltYWtld2VidGhpbmdzL3dheXBvaW50cy9ibG9iL21hc3Rlci9saWNlbnNlcy50eHRcbiovXG4oZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0J1xuXG4gIHZhciBrZXlDb3VudGVyID0gMFxuICB2YXIgYWxsV2F5cG9pbnRzID0ge31cblxuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvd2F5cG9pbnQgKi9cbiAgZnVuY3Rpb24gV2F5cG9pbnQob3B0aW9ucykge1xuICAgIGlmICghb3B0aW9ucykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdObyBvcHRpb25zIHBhc3NlZCB0byBXYXlwb2ludCBjb25zdHJ1Y3RvcicpXG4gICAgfVxuICAgIGlmICghb3B0aW9ucy5lbGVtZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGVsZW1lbnQgb3B0aW9uIHBhc3NlZCB0byBXYXlwb2ludCBjb25zdHJ1Y3RvcicpXG4gICAgfVxuICAgIGlmICghb3B0aW9ucy5oYW5kbGVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ05vIGhhbmRsZXIgb3B0aW9uIHBhc3NlZCB0byBXYXlwb2ludCBjb25zdHJ1Y3RvcicpXG4gICAgfVxuXG4gICAgdGhpcy5rZXkgPSAnd2F5cG9pbnQtJyArIGtleUNvdW50ZXJcbiAgICB0aGlzLm9wdGlvbnMgPSBXYXlwb2ludC5BZGFwdGVyLmV4dGVuZCh7fSwgV2F5cG9pbnQuZGVmYXVsdHMsIG9wdGlvbnMpXG4gICAgdGhpcy5lbGVtZW50ID0gdGhpcy5vcHRpb25zLmVsZW1lbnRcbiAgICB0aGlzLmFkYXB0ZXIgPSBuZXcgV2F5cG9pbnQuQWRhcHRlcih0aGlzLmVsZW1lbnQpXG4gICAgdGhpcy5jYWxsYmFjayA9IG9wdGlvbnMuaGFuZGxlclxuICAgIHRoaXMuYXhpcyA9IHRoaXMub3B0aW9ucy5ob3Jpem9udGFsID8gJ2hvcml6b250YWwnIDogJ3ZlcnRpY2FsJ1xuICAgIHRoaXMuZW5hYmxlZCA9IHRoaXMub3B0aW9ucy5lbmFibGVkXG4gICAgdGhpcy50cmlnZ2VyUG9pbnQgPSBudWxsXG4gICAgdGhpcy5ncm91cCA9IFdheXBvaW50Lkdyb3VwLmZpbmRPckNyZWF0ZSh7XG4gICAgICBuYW1lOiB0aGlzLm9wdGlvbnMuZ3JvdXAsXG4gICAgICBheGlzOiB0aGlzLmF4aXNcbiAgICB9KVxuICAgIHRoaXMuY29udGV4dCA9IFdheXBvaW50LkNvbnRleHQuZmluZE9yQ3JlYXRlQnlFbGVtZW50KHRoaXMub3B0aW9ucy5jb250ZXh0KVxuXG4gICAgaWYgKFdheXBvaW50Lm9mZnNldEFsaWFzZXNbdGhpcy5vcHRpb25zLm9mZnNldF0pIHtcbiAgICAgIHRoaXMub3B0aW9ucy5vZmZzZXQgPSBXYXlwb2ludC5vZmZzZXRBbGlhc2VzW3RoaXMub3B0aW9ucy5vZmZzZXRdXG4gICAgfVxuICAgIHRoaXMuZ3JvdXAuYWRkKHRoaXMpXG4gICAgdGhpcy5jb250ZXh0LmFkZCh0aGlzKVxuICAgIGFsbFdheXBvaW50c1t0aGlzLmtleV0gPSB0aGlzXG4gICAga2V5Q291bnRlciArPSAxXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIFdheXBvaW50LnByb3RvdHlwZS5xdWV1ZVRyaWdnZXIgPSBmdW5jdGlvbihkaXJlY3Rpb24pIHtcbiAgICB0aGlzLmdyb3VwLnF1ZXVlVHJpZ2dlcih0aGlzLCBkaXJlY3Rpb24pXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIFdheXBvaW50LnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24oYXJncykge1xuICAgIGlmICghdGhpcy5lbmFibGVkKSB7XG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgaWYgKHRoaXMuY2FsbGJhY2spIHtcbiAgICAgIHRoaXMuY2FsbGJhY2suYXBwbHkodGhpcywgYXJncylcbiAgICB9XG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2Rlc3Ryb3kgKi9cbiAgV2F5cG9pbnQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLmNvbnRleHQucmVtb3ZlKHRoaXMpXG4gICAgdGhpcy5ncm91cC5yZW1vdmUodGhpcylcbiAgICBkZWxldGUgYWxsV2F5cG9pbnRzW3RoaXMua2V5XVxuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9kaXNhYmxlICovXG4gIFdheXBvaW50LnByb3RvdHlwZS5kaXNhYmxlID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5lbmFibGVkID0gZmFsc2VcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9lbmFibGUgKi9cbiAgV2F5cG9pbnQucHJvdG90eXBlLmVuYWJsZSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGV4dC5yZWZyZXNoKClcbiAgICB0aGlzLmVuYWJsZWQgPSB0cnVlXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvbmV4dCAqL1xuICBXYXlwb2ludC5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmdyb3VwLm5leHQodGhpcylcbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvcHJldmlvdXMgKi9cbiAgV2F5cG9pbnQucHJvdG90eXBlLnByZXZpb3VzID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMuZ3JvdXAucHJldmlvdXModGhpcylcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgV2F5cG9pbnQuaW52b2tlQWxsID0gZnVuY3Rpb24obWV0aG9kKSB7XG4gICAgdmFyIGFsbFdheXBvaW50c0FycmF5ID0gW11cbiAgICBmb3IgKHZhciB3YXlwb2ludEtleSBpbiBhbGxXYXlwb2ludHMpIHtcbiAgICAgIGFsbFdheXBvaW50c0FycmF5LnB1c2goYWxsV2F5cG9pbnRzW3dheXBvaW50S2V5XSlcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDAsIGVuZCA9IGFsbFdheXBvaW50c0FycmF5Lmxlbmd0aDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICBhbGxXYXlwb2ludHNBcnJheVtpXVttZXRob2RdKClcbiAgICB9XG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2Rlc3Ryb3ktYWxsICovXG4gIFdheXBvaW50LmRlc3Ryb3lBbGwgPSBmdW5jdGlvbigpIHtcbiAgICBXYXlwb2ludC5pbnZva2VBbGwoJ2Rlc3Ryb3knKVxuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9kaXNhYmxlLWFsbCAqL1xuICBXYXlwb2ludC5kaXNhYmxlQWxsID0gZnVuY3Rpb24oKSB7XG4gICAgV2F5cG9pbnQuaW52b2tlQWxsKCdkaXNhYmxlJylcbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvZW5hYmxlLWFsbCAqL1xuICBXYXlwb2ludC5lbmFibGVBbGwgPSBmdW5jdGlvbigpIHtcbiAgICBXYXlwb2ludC5Db250ZXh0LnJlZnJlc2hBbGwoKVxuICAgIGZvciAodmFyIHdheXBvaW50S2V5IGluIGFsbFdheXBvaW50cykge1xuICAgICAgYWxsV2F5cG9pbnRzW3dheXBvaW50S2V5XS5lbmFibGVkID0gdHJ1ZVxuICAgIH1cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9yZWZyZXNoLWFsbCAqL1xuICBXYXlwb2ludC5yZWZyZXNoQWxsID0gZnVuY3Rpb24oKSB7XG4gICAgV2F5cG9pbnQuQ29udGV4dC5yZWZyZXNoQWxsKClcbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvdmlld3BvcnQtaGVpZ2h0ICovXG4gIFdheXBvaW50LnZpZXdwb3J0SGVpZ2h0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHdpbmRvdy5pbm5lckhlaWdodCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0XG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL3ZpZXdwb3J0LXdpZHRoICovXG4gIFdheXBvaW50LnZpZXdwb3J0V2lkdGggPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoXG4gIH1cblxuICBXYXlwb2ludC5hZGFwdGVycyA9IFtdXG5cbiAgV2F5cG9pbnQuZGVmYXVsdHMgPSB7XG4gICAgY29udGV4dDogd2luZG93LFxuICAgIGNvbnRpbnVvdXM6IHRydWUsXG4gICAgZW5hYmxlZDogdHJ1ZSxcbiAgICBncm91cDogJ2RlZmF1bHQnLFxuICAgIGhvcml6b250YWw6IGZhbHNlLFxuICAgIG9mZnNldDogMFxuICB9XG5cbiAgV2F5cG9pbnQub2Zmc2V0QWxpYXNlcyA9IHtcbiAgICAnYm90dG9tLWluLXZpZXcnOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiB0aGlzLmNvbnRleHQuaW5uZXJIZWlnaHQoKSAtIHRoaXMuYWRhcHRlci5vdXRlckhlaWdodCgpXG4gICAgfSxcbiAgICAncmlnaHQtaW4tdmlldyc6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHRoaXMuY29udGV4dC5pbm5lcldpZHRoKCkgLSB0aGlzLmFkYXB0ZXIub3V0ZXJXaWR0aCgpXG4gICAgfVxuICB9XG5cbiAgd2luZG93LldheXBvaW50ID0gV2F5cG9pbnRcbn0oKSlcbjsoZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0J1xuXG4gIGZ1bmN0aW9uIHJlcXVlc3RBbmltYXRpb25GcmFtZVNoaW0oY2FsbGJhY2spIHtcbiAgICB3aW5kb3cuc2V0VGltZW91dChjYWxsYmFjaywgMTAwMCAvIDYwKVxuICB9XG5cbiAgdmFyIGtleUNvdW50ZXIgPSAwXG4gIHZhciBjb250ZXh0cyA9IHt9XG4gIHZhciBXYXlwb2ludCA9IHdpbmRvdy5XYXlwb2ludFxuICB2YXIgb2xkV2luZG93TG9hZCA9IHdpbmRvdy5vbmxvYWRcblxuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvY29udGV4dCAqL1xuICBmdW5jdGlvbiBDb250ZXh0KGVsZW1lbnQpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50XG4gICAgdGhpcy5BZGFwdGVyID0gV2F5cG9pbnQuQWRhcHRlclxuICAgIHRoaXMuYWRhcHRlciA9IG5ldyB0aGlzLkFkYXB0ZXIoZWxlbWVudClcbiAgICB0aGlzLmtleSA9ICd3YXlwb2ludC1jb250ZXh0LScgKyBrZXlDb3VudGVyXG4gICAgdGhpcy5kaWRTY3JvbGwgPSBmYWxzZVxuICAgIHRoaXMuZGlkUmVzaXplID0gZmFsc2VcbiAgICB0aGlzLm9sZFNjcm9sbCA9IHtcbiAgICAgIHg6IHRoaXMuYWRhcHRlci5zY3JvbGxMZWZ0KCksXG4gICAgICB5OiB0aGlzLmFkYXB0ZXIuc2Nyb2xsVG9wKClcbiAgICB9XG4gICAgdGhpcy53YXlwb2ludHMgPSB7XG4gICAgICB2ZXJ0aWNhbDoge30sXG4gICAgICBob3Jpem9udGFsOiB7fVxuICAgIH1cblxuICAgIGVsZW1lbnQud2F5cG9pbnRDb250ZXh0S2V5ID0gdGhpcy5rZXlcbiAgICBjb250ZXh0c1tlbGVtZW50LndheXBvaW50Q29udGV4dEtleV0gPSB0aGlzXG4gICAga2V5Q291bnRlciArPSAxXG4gICAgaWYgKCFXYXlwb2ludC53aW5kb3dDb250ZXh0KSB7XG4gICAgICBXYXlwb2ludC53aW5kb3dDb250ZXh0ID0gdHJ1ZVxuICAgICAgV2F5cG9pbnQud2luZG93Q29udGV4dCA9IG5ldyBDb250ZXh0KHdpbmRvdylcbiAgICB9XG5cbiAgICB0aGlzLmNyZWF0ZVRocm90dGxlZFNjcm9sbEhhbmRsZXIoKVxuICAgIHRoaXMuY3JlYXRlVGhyb3R0bGVkUmVzaXplSGFuZGxlcigpXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIENvbnRleHQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHdheXBvaW50KSB7XG4gICAgdmFyIGF4aXMgPSB3YXlwb2ludC5vcHRpb25zLmhvcml6b250YWwgPyAnaG9yaXpvbnRhbCcgOiAndmVydGljYWwnXG4gICAgdGhpcy53YXlwb2ludHNbYXhpc11bd2F5cG9pbnQua2V5XSA9IHdheXBvaW50XG4gICAgdGhpcy5yZWZyZXNoKClcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUuY2hlY2tFbXB0eSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBob3Jpem9udGFsRW1wdHkgPSB0aGlzLkFkYXB0ZXIuaXNFbXB0eU9iamVjdCh0aGlzLndheXBvaW50cy5ob3Jpem9udGFsKVxuICAgIHZhciB2ZXJ0aWNhbEVtcHR5ID0gdGhpcy5BZGFwdGVyLmlzRW1wdHlPYmplY3QodGhpcy53YXlwb2ludHMudmVydGljYWwpXG4gICAgdmFyIGlzV2luZG93ID0gdGhpcy5lbGVtZW50ID09IHRoaXMuZWxlbWVudC53aW5kb3dcbiAgICBpZiAoaG9yaXpvbnRhbEVtcHR5ICYmIHZlcnRpY2FsRW1wdHkgJiYgIWlzV2luZG93KSB7XG4gICAgICB0aGlzLmFkYXB0ZXIub2ZmKCcud2F5cG9pbnRzJylcbiAgICAgIGRlbGV0ZSBjb250ZXh0c1t0aGlzLmtleV1cbiAgICB9XG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIENvbnRleHQucHJvdG90eXBlLmNyZWF0ZVRocm90dGxlZFJlc2l6ZUhhbmRsZXIgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXNcblxuICAgIGZ1bmN0aW9uIHJlc2l6ZUhhbmRsZXIoKSB7XG4gICAgICBzZWxmLmhhbmRsZVJlc2l6ZSgpXG4gICAgICBzZWxmLmRpZFJlc2l6ZSA9IGZhbHNlXG4gICAgfVxuXG4gICAgdGhpcy5hZGFwdGVyLm9uKCdyZXNpemUud2F5cG9pbnRzJywgZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoIXNlbGYuZGlkUmVzaXplKSB7XG4gICAgICAgIHNlbGYuZGlkUmVzaXplID0gdHJ1ZVxuICAgICAgICBXYXlwb2ludC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUocmVzaXplSGFuZGxlcilcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBDb250ZXh0LnByb3RvdHlwZS5jcmVhdGVUaHJvdHRsZWRTY3JvbGxIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzXG4gICAgZnVuY3Rpb24gc2Nyb2xsSGFuZGxlcigpIHtcbiAgICAgIHNlbGYuaGFuZGxlU2Nyb2xsKClcbiAgICAgIHNlbGYuZGlkU2Nyb2xsID0gZmFsc2VcbiAgICB9XG5cbiAgICB0aGlzLmFkYXB0ZXIub24oJ3Njcm9sbC53YXlwb2ludHMnLCBmdW5jdGlvbigpIHtcbiAgICAgIGlmICghc2VsZi5kaWRTY3JvbGwgfHwgV2F5cG9pbnQuaXNUb3VjaCkge1xuICAgICAgICBzZWxmLmRpZFNjcm9sbCA9IHRydWVcbiAgICAgICAgV2F5cG9pbnQucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHNjcm9sbEhhbmRsZXIpXG4gICAgICB9XG4gICAgfSlcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUuaGFuZGxlUmVzaXplID0gZnVuY3Rpb24oKSB7XG4gICAgV2F5cG9pbnQuQ29udGV4dC5yZWZyZXNoQWxsKClcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUuaGFuZGxlU2Nyb2xsID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHRyaWdnZXJlZEdyb3VwcyA9IHt9XG4gICAgdmFyIGF4ZXMgPSB7XG4gICAgICBob3Jpem9udGFsOiB7XG4gICAgICAgIG5ld1Njcm9sbDogdGhpcy5hZGFwdGVyLnNjcm9sbExlZnQoKSxcbiAgICAgICAgb2xkU2Nyb2xsOiB0aGlzLm9sZFNjcm9sbC54LFxuICAgICAgICBmb3J3YXJkOiAncmlnaHQnLFxuICAgICAgICBiYWNrd2FyZDogJ2xlZnQnXG4gICAgICB9LFxuICAgICAgdmVydGljYWw6IHtcbiAgICAgICAgbmV3U2Nyb2xsOiB0aGlzLmFkYXB0ZXIuc2Nyb2xsVG9wKCksXG4gICAgICAgIG9sZFNjcm9sbDogdGhpcy5vbGRTY3JvbGwueSxcbiAgICAgICAgZm9yd2FyZDogJ2Rvd24nLFxuICAgICAgICBiYWNrd2FyZDogJ3VwJ1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGF4aXNLZXkgaW4gYXhlcykge1xuICAgICAgdmFyIGF4aXMgPSBheGVzW2F4aXNLZXldXG4gICAgICB2YXIgaXNGb3J3YXJkID0gYXhpcy5uZXdTY3JvbGwgPiBheGlzLm9sZFNjcm9sbFxuICAgICAgdmFyIGRpcmVjdGlvbiA9IGlzRm9yd2FyZCA/IGF4aXMuZm9yd2FyZCA6IGF4aXMuYmFja3dhcmRcblxuICAgICAgZm9yICh2YXIgd2F5cG9pbnRLZXkgaW4gdGhpcy53YXlwb2ludHNbYXhpc0tleV0pIHtcbiAgICAgICAgdmFyIHdheXBvaW50ID0gdGhpcy53YXlwb2ludHNbYXhpc0tleV1bd2F5cG9pbnRLZXldXG4gICAgICAgIGlmICh3YXlwb2ludC50cmlnZ2VyUG9pbnQgPT09IG51bGwpIHtcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9XG4gICAgICAgIHZhciB3YXNCZWZvcmVUcmlnZ2VyUG9pbnQgPSBheGlzLm9sZFNjcm9sbCA8IHdheXBvaW50LnRyaWdnZXJQb2ludFxuICAgICAgICB2YXIgbm93QWZ0ZXJUcmlnZ2VyUG9pbnQgPSBheGlzLm5ld1Njcm9sbCA+PSB3YXlwb2ludC50cmlnZ2VyUG9pbnRcbiAgICAgICAgdmFyIGNyb3NzZWRGb3J3YXJkID0gd2FzQmVmb3JlVHJpZ2dlclBvaW50ICYmIG5vd0FmdGVyVHJpZ2dlclBvaW50XG4gICAgICAgIHZhciBjcm9zc2VkQmFja3dhcmQgPSAhd2FzQmVmb3JlVHJpZ2dlclBvaW50ICYmICFub3dBZnRlclRyaWdnZXJQb2ludFxuICAgICAgICBpZiAoY3Jvc3NlZEZvcndhcmQgfHwgY3Jvc3NlZEJhY2t3YXJkKSB7XG4gICAgICAgICAgd2F5cG9pbnQucXVldWVUcmlnZ2VyKGRpcmVjdGlvbilcbiAgICAgICAgICB0cmlnZ2VyZWRHcm91cHNbd2F5cG9pbnQuZ3JvdXAuaWRdID0gd2F5cG9pbnQuZ3JvdXBcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGdyb3VwS2V5IGluIHRyaWdnZXJlZEdyb3Vwcykge1xuICAgICAgdHJpZ2dlcmVkR3JvdXBzW2dyb3VwS2V5XS5mbHVzaFRyaWdnZXJzKClcbiAgICB9XG5cbiAgICB0aGlzLm9sZFNjcm9sbCA9IHtcbiAgICAgIHg6IGF4ZXMuaG9yaXpvbnRhbC5uZXdTY3JvbGwsXG4gICAgICB5OiBheGVzLnZlcnRpY2FsLm5ld1Njcm9sbFxuICAgIH1cbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUuaW5uZXJIZWlnaHQgPSBmdW5jdGlvbigpIHtcbiAgICAvKmVzbGludC1kaXNhYmxlIGVxZXFlcSAqL1xuICAgIGlmICh0aGlzLmVsZW1lbnQgPT0gdGhpcy5lbGVtZW50LndpbmRvdykge1xuICAgICAgcmV0dXJuIFdheXBvaW50LnZpZXdwb3J0SGVpZ2h0KClcbiAgICB9XG4gICAgLyplc2xpbnQtZW5hYmxlIGVxZXFlcSAqL1xuICAgIHJldHVybiB0aGlzLmFkYXB0ZXIuaW5uZXJIZWlnaHQoKVxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBDb250ZXh0LnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbih3YXlwb2ludCkge1xuICAgIGRlbGV0ZSB0aGlzLndheXBvaW50c1t3YXlwb2ludC5heGlzXVt3YXlwb2ludC5rZXldXG4gICAgdGhpcy5jaGVja0VtcHR5KClcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUuaW5uZXJXaWR0aCA9IGZ1bmN0aW9uKCkge1xuICAgIC8qZXNsaW50LWRpc2FibGUgZXFlcWVxICovXG4gICAgaWYgKHRoaXMuZWxlbWVudCA9PSB0aGlzLmVsZW1lbnQud2luZG93KSB7XG4gICAgICByZXR1cm4gV2F5cG9pbnQudmlld3BvcnRXaWR0aCgpXG4gICAgfVxuICAgIC8qZXNsaW50LWVuYWJsZSBlcWVxZXEgKi9cbiAgICByZXR1cm4gdGhpcy5hZGFwdGVyLmlubmVyV2lkdGgoKVxuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9jb250ZXh0LWRlc3Ryb3kgKi9cbiAgQ29udGV4dC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBhbGxXYXlwb2ludHMgPSBbXVxuICAgIGZvciAodmFyIGF4aXMgaW4gdGhpcy53YXlwb2ludHMpIHtcbiAgICAgIGZvciAodmFyIHdheXBvaW50S2V5IGluIHRoaXMud2F5cG9pbnRzW2F4aXNdKSB7XG4gICAgICAgIGFsbFdheXBvaW50cy5wdXNoKHRoaXMud2F5cG9pbnRzW2F4aXNdW3dheXBvaW50S2V5XSlcbiAgICAgIH1cbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDAsIGVuZCA9IGFsbFdheXBvaW50cy5sZW5ndGg7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgYWxsV2F5cG9pbnRzW2ldLmRlc3Ryb3koKVxuICAgIH1cbiAgfVxuXG4gIC8qIFB1YmxpYyAqL1xuICAvKiBodHRwOi8vaW1ha2V3ZWJ0aGluZ3MuY29tL3dheXBvaW50cy9hcGkvY29udGV4dC1yZWZyZXNoICovXG4gIENvbnRleHQucHJvdG90eXBlLnJlZnJlc2ggPSBmdW5jdGlvbigpIHtcbiAgICAvKmVzbGludC1kaXNhYmxlIGVxZXFlcSAqL1xuICAgIHZhciBpc1dpbmRvdyA9IHRoaXMuZWxlbWVudCA9PSB0aGlzLmVsZW1lbnQud2luZG93XG4gICAgLyplc2xpbnQtZW5hYmxlIGVxZXFlcSAqL1xuICAgIHZhciBjb250ZXh0T2Zmc2V0ID0gaXNXaW5kb3cgPyB1bmRlZmluZWQgOiB0aGlzLmFkYXB0ZXIub2Zmc2V0KClcbiAgICB2YXIgdHJpZ2dlcmVkR3JvdXBzID0ge31cbiAgICB2YXIgYXhlc1xuXG4gICAgdGhpcy5oYW5kbGVTY3JvbGwoKVxuICAgIGF4ZXMgPSB7XG4gICAgICBob3Jpem9udGFsOiB7XG4gICAgICAgIGNvbnRleHRPZmZzZXQ6IGlzV2luZG93ID8gMCA6IGNvbnRleHRPZmZzZXQubGVmdCxcbiAgICAgICAgY29udGV4dFNjcm9sbDogaXNXaW5kb3cgPyAwIDogdGhpcy5vbGRTY3JvbGwueCxcbiAgICAgICAgY29udGV4dERpbWVuc2lvbjogdGhpcy5pbm5lcldpZHRoKCksXG4gICAgICAgIG9sZFNjcm9sbDogdGhpcy5vbGRTY3JvbGwueCxcbiAgICAgICAgZm9yd2FyZDogJ3JpZ2h0JyxcbiAgICAgICAgYmFja3dhcmQ6ICdsZWZ0JyxcbiAgICAgICAgb2Zmc2V0UHJvcDogJ2xlZnQnXG4gICAgICB9LFxuICAgICAgdmVydGljYWw6IHtcbiAgICAgICAgY29udGV4dE9mZnNldDogaXNXaW5kb3cgPyAwIDogY29udGV4dE9mZnNldC50b3AsXG4gICAgICAgIGNvbnRleHRTY3JvbGw6IGlzV2luZG93ID8gMCA6IHRoaXMub2xkU2Nyb2xsLnksXG4gICAgICAgIGNvbnRleHREaW1lbnNpb246IHRoaXMuaW5uZXJIZWlnaHQoKSxcbiAgICAgICAgb2xkU2Nyb2xsOiB0aGlzLm9sZFNjcm9sbC55LFxuICAgICAgICBmb3J3YXJkOiAnZG93bicsXG4gICAgICAgIGJhY2t3YXJkOiAndXAnLFxuICAgICAgICBvZmZzZXRQcm9wOiAndG9wJ1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGF4aXNLZXkgaW4gYXhlcykge1xuICAgICAgdmFyIGF4aXMgPSBheGVzW2F4aXNLZXldXG4gICAgICBmb3IgKHZhciB3YXlwb2ludEtleSBpbiB0aGlzLndheXBvaW50c1theGlzS2V5XSkge1xuICAgICAgICB2YXIgd2F5cG9pbnQgPSB0aGlzLndheXBvaW50c1theGlzS2V5XVt3YXlwb2ludEtleV1cbiAgICAgICAgdmFyIGFkanVzdG1lbnQgPSB3YXlwb2ludC5vcHRpb25zLm9mZnNldFxuICAgICAgICB2YXIgb2xkVHJpZ2dlclBvaW50ID0gd2F5cG9pbnQudHJpZ2dlclBvaW50XG4gICAgICAgIHZhciBlbGVtZW50T2Zmc2V0ID0gMFxuICAgICAgICB2YXIgZnJlc2hXYXlwb2ludCA9IG9sZFRyaWdnZXJQb2ludCA9PSBudWxsXG4gICAgICAgIHZhciBjb250ZXh0TW9kaWZpZXIsIHdhc0JlZm9yZVNjcm9sbCwgbm93QWZ0ZXJTY3JvbGxcbiAgICAgICAgdmFyIHRyaWdnZXJlZEJhY2t3YXJkLCB0cmlnZ2VyZWRGb3J3YXJkXG5cbiAgICAgICAgaWYgKHdheXBvaW50LmVsZW1lbnQgIT09IHdheXBvaW50LmVsZW1lbnQud2luZG93KSB7XG4gICAgICAgICAgZWxlbWVudE9mZnNldCA9IHdheXBvaW50LmFkYXB0ZXIub2Zmc2V0KClbYXhpcy5vZmZzZXRQcm9wXVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBhZGp1c3RtZW50ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgYWRqdXN0bWVudCA9IGFkanVzdG1lbnQuYXBwbHkod2F5cG9pbnQpXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIGFkanVzdG1lbnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgYWRqdXN0bWVudCA9IHBhcnNlRmxvYXQoYWRqdXN0bWVudClcbiAgICAgICAgICBpZiAod2F5cG9pbnQub3B0aW9ucy5vZmZzZXQuaW5kZXhPZignJScpID4gLSAxKSB7XG4gICAgICAgICAgICBhZGp1c3RtZW50ID0gTWF0aC5jZWlsKGF4aXMuY29udGV4dERpbWVuc2lvbiAqIGFkanVzdG1lbnQgLyAxMDApXG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29udGV4dE1vZGlmaWVyID0gYXhpcy5jb250ZXh0U2Nyb2xsIC0gYXhpcy5jb250ZXh0T2Zmc2V0XG4gICAgICAgIHdheXBvaW50LnRyaWdnZXJQb2ludCA9IE1hdGguZmxvb3IoZWxlbWVudE9mZnNldCArIGNvbnRleHRNb2RpZmllciAtIGFkanVzdG1lbnQpXG4gICAgICAgIHdhc0JlZm9yZVNjcm9sbCA9IG9sZFRyaWdnZXJQb2ludCA8IGF4aXMub2xkU2Nyb2xsXG4gICAgICAgIG5vd0FmdGVyU2Nyb2xsID0gd2F5cG9pbnQudHJpZ2dlclBvaW50ID49IGF4aXMub2xkU2Nyb2xsXG4gICAgICAgIHRyaWdnZXJlZEJhY2t3YXJkID0gd2FzQmVmb3JlU2Nyb2xsICYmIG5vd0FmdGVyU2Nyb2xsXG4gICAgICAgIHRyaWdnZXJlZEZvcndhcmQgPSAhd2FzQmVmb3JlU2Nyb2xsICYmICFub3dBZnRlclNjcm9sbFxuXG4gICAgICAgIGlmICghZnJlc2hXYXlwb2ludCAmJiB0cmlnZ2VyZWRCYWNrd2FyZCkge1xuICAgICAgICAgIHdheXBvaW50LnF1ZXVlVHJpZ2dlcihheGlzLmJhY2t3YXJkKVxuICAgICAgICAgIHRyaWdnZXJlZEdyb3Vwc1t3YXlwb2ludC5ncm91cC5pZF0gPSB3YXlwb2ludC5ncm91cFxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKCFmcmVzaFdheXBvaW50ICYmIHRyaWdnZXJlZEZvcndhcmQpIHtcbiAgICAgICAgICB3YXlwb2ludC5xdWV1ZVRyaWdnZXIoYXhpcy5mb3J3YXJkKVxuICAgICAgICAgIHRyaWdnZXJlZEdyb3Vwc1t3YXlwb2ludC5ncm91cC5pZF0gPSB3YXlwb2ludC5ncm91cFxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKGZyZXNoV2F5cG9pbnQgJiYgYXhpcy5vbGRTY3JvbGwgPj0gd2F5cG9pbnQudHJpZ2dlclBvaW50KSB7XG4gICAgICAgICAgd2F5cG9pbnQucXVldWVUcmlnZ2VyKGF4aXMuZm9yd2FyZClcbiAgICAgICAgICB0cmlnZ2VyZWRHcm91cHNbd2F5cG9pbnQuZ3JvdXAuaWRdID0gd2F5cG9pbnQuZ3JvdXBcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIFdheXBvaW50LnJlcXVlc3RBbmltYXRpb25GcmFtZShmdW5jdGlvbigpIHtcbiAgICAgIGZvciAodmFyIGdyb3VwS2V5IGluIHRyaWdnZXJlZEdyb3Vwcykge1xuICAgICAgICB0cmlnZ2VyZWRHcm91cHNbZ3JvdXBLZXldLmZsdXNoVHJpZ2dlcnMoKVxuICAgICAgfVxuICAgIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBDb250ZXh0LmZpbmRPckNyZWF0ZUJ5RWxlbWVudCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICByZXR1cm4gQ29udGV4dC5maW5kQnlFbGVtZW50KGVsZW1lbnQpIHx8IG5ldyBDb250ZXh0KGVsZW1lbnQpXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIENvbnRleHQucmVmcmVzaEFsbCA9IGZ1bmN0aW9uKCkge1xuICAgIGZvciAodmFyIGNvbnRleHRJZCBpbiBjb250ZXh0cykge1xuICAgICAgY29udGV4dHNbY29udGV4dElkXS5yZWZyZXNoKClcbiAgICB9XG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2NvbnRleHQtZmluZC1ieS1lbGVtZW50ICovXG4gIENvbnRleHQuZmluZEJ5RWxlbWVudCA9IGZ1bmN0aW9uKGVsZW1lbnQpIHtcbiAgICByZXR1cm4gY29udGV4dHNbZWxlbWVudC53YXlwb2ludENvbnRleHRLZXldXG4gIH1cblxuICB3aW5kb3cub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKG9sZFdpbmRvd0xvYWQpIHtcbiAgICAgIG9sZFdpbmRvd0xvYWQoKVxuICAgIH1cbiAgICBDb250ZXh0LnJlZnJlc2hBbGwoKVxuICB9XG5cblxuICBXYXlwb2ludC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHZhciByZXF1ZXN0Rm4gPSB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XG4gICAgICB3aW5kb3cubW96UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XG4gICAgICB3aW5kb3cud2Via2l0UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8XG4gICAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWVTaGltXG4gICAgcmVxdWVzdEZuLmNhbGwod2luZG93LCBjYWxsYmFjaylcbiAgfVxuICBXYXlwb2ludC5Db250ZXh0ID0gQ29udGV4dFxufSgpKVxuOyhmdW5jdGlvbigpIHtcbiAgJ3VzZSBzdHJpY3QnXG5cbiAgZnVuY3Rpb24gYnlUcmlnZ2VyUG9pbnQoYSwgYikge1xuICAgIHJldHVybiBhLnRyaWdnZXJQb2ludCAtIGIudHJpZ2dlclBvaW50XG4gIH1cblxuICBmdW5jdGlvbiBieVJldmVyc2VUcmlnZ2VyUG9pbnQoYSwgYikge1xuICAgIHJldHVybiBiLnRyaWdnZXJQb2ludCAtIGEudHJpZ2dlclBvaW50XG4gIH1cblxuICB2YXIgZ3JvdXBzID0ge1xuICAgIHZlcnRpY2FsOiB7fSxcbiAgICBob3Jpem9udGFsOiB7fVxuICB9XG4gIHZhciBXYXlwb2ludCA9IHdpbmRvdy5XYXlwb2ludFxuXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9ncm91cCAqL1xuICBmdW5jdGlvbiBHcm91cChvcHRpb25zKSB7XG4gICAgdGhpcy5uYW1lID0gb3B0aW9ucy5uYW1lXG4gICAgdGhpcy5heGlzID0gb3B0aW9ucy5heGlzXG4gICAgdGhpcy5pZCA9IHRoaXMubmFtZSArICctJyArIHRoaXMuYXhpc1xuICAgIHRoaXMud2F5cG9pbnRzID0gW11cbiAgICB0aGlzLmNsZWFyVHJpZ2dlclF1ZXVlcygpXG4gICAgZ3JvdXBzW3RoaXMuYXhpc11bdGhpcy5uYW1lXSA9IHRoaXNcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgR3JvdXAucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uKHdheXBvaW50KSB7XG4gICAgdGhpcy53YXlwb2ludHMucHVzaCh3YXlwb2ludClcbiAgfVxuXG4gIC8qIFByaXZhdGUgKi9cbiAgR3JvdXAucHJvdG90eXBlLmNsZWFyVHJpZ2dlclF1ZXVlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudHJpZ2dlclF1ZXVlcyA9IHtcbiAgICAgIHVwOiBbXSxcbiAgICAgIGRvd246IFtdLFxuICAgICAgbGVmdDogW10sXG4gICAgICByaWdodDogW11cbiAgICB9XG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIEdyb3VwLnByb3RvdHlwZS5mbHVzaFRyaWdnZXJzID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgZGlyZWN0aW9uIGluIHRoaXMudHJpZ2dlclF1ZXVlcykge1xuICAgICAgdmFyIHdheXBvaW50cyA9IHRoaXMudHJpZ2dlclF1ZXVlc1tkaXJlY3Rpb25dXG4gICAgICB2YXIgcmV2ZXJzZSA9IGRpcmVjdGlvbiA9PT0gJ3VwJyB8fCBkaXJlY3Rpb24gPT09ICdsZWZ0J1xuICAgICAgd2F5cG9pbnRzLnNvcnQocmV2ZXJzZSA/IGJ5UmV2ZXJzZVRyaWdnZXJQb2ludCA6IGJ5VHJpZ2dlclBvaW50KVxuICAgICAgZm9yICh2YXIgaSA9IDAsIGVuZCA9IHdheXBvaW50cy5sZW5ndGg7IGkgPCBlbmQ7IGkgKz0gMSkge1xuICAgICAgICB2YXIgd2F5cG9pbnQgPSB3YXlwb2ludHNbaV1cbiAgICAgICAgaWYgKHdheXBvaW50Lm9wdGlvbnMuY29udGludW91cyB8fCBpID09PSB3YXlwb2ludHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIHdheXBvaW50LnRyaWdnZXIoW2RpcmVjdGlvbl0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5jbGVhclRyaWdnZXJRdWV1ZXMoKVxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBHcm91cC5wcm90b3R5cGUubmV4dCA9IGZ1bmN0aW9uKHdheXBvaW50KSB7XG4gICAgdGhpcy53YXlwb2ludHMuc29ydChieVRyaWdnZXJQb2ludClcbiAgICB2YXIgaW5kZXggPSBXYXlwb2ludC5BZGFwdGVyLmluQXJyYXkod2F5cG9pbnQsIHRoaXMud2F5cG9pbnRzKVxuICAgIHZhciBpc0xhc3QgPSBpbmRleCA9PT0gdGhpcy53YXlwb2ludHMubGVuZ3RoIC0gMVxuICAgIHJldHVybiBpc0xhc3QgPyBudWxsIDogdGhpcy53YXlwb2ludHNbaW5kZXggKyAxXVxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBHcm91cC5wcm90b3R5cGUucHJldmlvdXMgPSBmdW5jdGlvbih3YXlwb2ludCkge1xuICAgIHRoaXMud2F5cG9pbnRzLnNvcnQoYnlUcmlnZ2VyUG9pbnQpXG4gICAgdmFyIGluZGV4ID0gV2F5cG9pbnQuQWRhcHRlci5pbkFycmF5KHdheXBvaW50LCB0aGlzLndheXBvaW50cylcbiAgICByZXR1cm4gaW5kZXggPyB0aGlzLndheXBvaW50c1tpbmRleCAtIDFdIDogbnVsbFxuICB9XG5cbiAgLyogUHJpdmF0ZSAqL1xuICBHcm91cC5wcm90b3R5cGUucXVldWVUcmlnZ2VyID0gZnVuY3Rpb24od2F5cG9pbnQsIGRpcmVjdGlvbikge1xuICAgIHRoaXMudHJpZ2dlclF1ZXVlc1tkaXJlY3Rpb25dLnB1c2god2F5cG9pbnQpXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIEdyb3VwLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbih3YXlwb2ludCkge1xuICAgIHZhciBpbmRleCA9IFdheXBvaW50LkFkYXB0ZXIuaW5BcnJheSh3YXlwb2ludCwgdGhpcy53YXlwb2ludHMpXG4gICAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICAgIHRoaXMud2F5cG9pbnRzLnNwbGljZShpbmRleCwgMSlcbiAgICB9XG4gIH1cblxuICAvKiBQdWJsaWMgKi9cbiAgLyogaHR0cDovL2ltYWtld2VidGhpbmdzLmNvbS93YXlwb2ludHMvYXBpL2ZpcnN0ICovXG4gIEdyb3VwLnByb3RvdHlwZS5maXJzdCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLndheXBvaW50c1swXVxuICB9XG5cbiAgLyogUHVibGljICovXG4gIC8qIGh0dHA6Ly9pbWFrZXdlYnRoaW5ncy5jb20vd2F5cG9pbnRzL2FwaS9sYXN0ICovXG4gIEdyb3VwLnByb3RvdHlwZS5sYXN0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHRoaXMud2F5cG9pbnRzW3RoaXMud2F5cG9pbnRzLmxlbmd0aCAtIDFdXG4gIH1cblxuICAvKiBQcml2YXRlICovXG4gIEdyb3VwLmZpbmRPckNyZWF0ZSA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICByZXR1cm4gZ3JvdXBzW29wdGlvbnMuYXhpc11bb3B0aW9ucy5uYW1lXSB8fCBuZXcgR3JvdXAob3B0aW9ucylcbiAgfVxuXG4gIFdheXBvaW50Lkdyb3VwID0gR3JvdXBcbn0oKSlcbjsoZnVuY3Rpb24oKSB7XG4gICd1c2Ugc3RyaWN0J1xuXG4gIHZhciBXYXlwb2ludCA9IHdpbmRvdy5XYXlwb2ludFxuXG4gIGZ1bmN0aW9uIGlzV2luZG93KGVsZW1lbnQpIHtcbiAgICByZXR1cm4gZWxlbWVudCA9PT0gZWxlbWVudC53aW5kb3dcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFdpbmRvdyhlbGVtZW50KSB7XG4gICAgaWYgKGlzV2luZG93KGVsZW1lbnQpKSB7XG4gICAgICByZXR1cm4gZWxlbWVudFxuICAgIH1cbiAgICByZXR1cm4gZWxlbWVudC5kZWZhdWx0Vmlld1xuICB9XG5cbiAgZnVuY3Rpb24gTm9GcmFtZXdvcmtBZGFwdGVyKGVsZW1lbnQpIHtcbiAgICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50XG4gICAgdGhpcy5oYW5kbGVycyA9IHt9XG4gIH1cblxuICBOb0ZyYW1ld29ya0FkYXB0ZXIucHJvdG90eXBlLmlubmVySGVpZ2h0ID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGlzV2luID0gaXNXaW5kb3codGhpcy5lbGVtZW50KVxuICAgIHJldHVybiBpc1dpbiA/IHRoaXMuZWxlbWVudC5pbm5lckhlaWdodCA6IHRoaXMuZWxlbWVudC5jbGllbnRIZWlnaHRcbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5wcm90b3R5cGUuaW5uZXJXaWR0aCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBpc1dpbiA9IGlzV2luZG93KHRoaXMuZWxlbWVudClcbiAgICByZXR1cm4gaXNXaW4gPyB0aGlzLmVsZW1lbnQuaW5uZXJXaWR0aCA6IHRoaXMuZWxlbWVudC5jbGllbnRXaWR0aFxuICB9XG5cbiAgTm9GcmFtZXdvcmtBZGFwdGVyLnByb3RvdHlwZS5vZmYgPSBmdW5jdGlvbihldmVudCwgaGFuZGxlcikge1xuICAgIGZ1bmN0aW9uIHJlbW92ZUxpc3RlbmVycyhlbGVtZW50LCBsaXN0ZW5lcnMsIGhhbmRsZXIpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBlbmQgPSBsaXN0ZW5lcnMubGVuZ3RoIC0gMTsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICAgIHZhciBsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXVxuICAgICAgICBpZiAoIWhhbmRsZXIgfHwgaGFuZGxlciA9PT0gbGlzdGVuZXIpIHtcbiAgICAgICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIobGlzdGVuZXIpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgZXZlbnRQYXJ0cyA9IGV2ZW50LnNwbGl0KCcuJylcbiAgICB2YXIgZXZlbnRUeXBlID0gZXZlbnRQYXJ0c1swXVxuICAgIHZhciBuYW1lc3BhY2UgPSBldmVudFBhcnRzWzFdXG4gICAgdmFyIGVsZW1lbnQgPSB0aGlzLmVsZW1lbnRcblxuICAgIGlmIChuYW1lc3BhY2UgJiYgdGhpcy5oYW5kbGVyc1tuYW1lc3BhY2VdICYmIGV2ZW50VHlwZSkge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKGVsZW1lbnQsIHRoaXMuaGFuZGxlcnNbbmFtZXNwYWNlXVtldmVudFR5cGVdLCBoYW5kbGVyKVxuICAgICAgdGhpcy5oYW5kbGVyc1tuYW1lc3BhY2VdW2V2ZW50VHlwZV0gPSBbXVxuICAgIH1cbiAgICBlbHNlIGlmIChldmVudFR5cGUpIHtcbiAgICAgIGZvciAodmFyIG5zIGluIHRoaXMuaGFuZGxlcnMpIHtcbiAgICAgICAgcmVtb3ZlTGlzdGVuZXJzKGVsZW1lbnQsIHRoaXMuaGFuZGxlcnNbbnNdW2V2ZW50VHlwZV0gfHwgW10sIGhhbmRsZXIpXG4gICAgICAgIHRoaXMuaGFuZGxlcnNbbnNdW2V2ZW50VHlwZV0gPSBbXVxuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIGlmIChuYW1lc3BhY2UgJiYgdGhpcy5oYW5kbGVyc1tuYW1lc3BhY2VdKSB7XG4gICAgICBmb3IgKHZhciB0eXBlIGluIHRoaXMuaGFuZGxlcnNbbmFtZXNwYWNlXSkge1xuICAgICAgICByZW1vdmVMaXN0ZW5lcnMoZWxlbWVudCwgdGhpcy5oYW5kbGVyc1tuYW1lc3BhY2VdW3R5cGVdLCBoYW5kbGVyKVxuICAgICAgfVxuICAgICAgdGhpcy5oYW5kbGVyc1tuYW1lc3BhY2VdID0ge31cbiAgICB9XG4gIH1cblxuICAvKiBBZGFwdGVkIGZyb20galF1ZXJ5IDEueCBvZmZzZXQoKSAqL1xuICBOb0ZyYW1ld29ya0FkYXB0ZXIucHJvdG90eXBlLm9mZnNldCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghdGhpcy5lbGVtZW50Lm93bmVyRG9jdW1lbnQpIHtcbiAgICAgIHJldHVybiBudWxsXG4gICAgfVxuXG4gICAgdmFyIGRvY3VtZW50RWxlbWVudCA9IHRoaXMuZWxlbWVudC5vd25lckRvY3VtZW50LmRvY3VtZW50RWxlbWVudFxuICAgIHZhciB3aW4gPSBnZXRXaW5kb3codGhpcy5lbGVtZW50Lm93bmVyRG9jdW1lbnQpXG4gICAgdmFyIHJlY3QgPSB7XG4gICAgICB0b3A6IDAsXG4gICAgICBsZWZ0OiAwXG4gICAgfVxuXG4gICAgaWYgKHRoaXMuZWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QpIHtcbiAgICAgIHJlY3QgPSB0aGlzLmVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG9wOiByZWN0LnRvcCArIHdpbi5wYWdlWU9mZnNldCAtIGRvY3VtZW50RWxlbWVudC5jbGllbnRUb3AsXG4gICAgICBsZWZ0OiByZWN0LmxlZnQgKyB3aW4ucGFnZVhPZmZzZXQgLSBkb2N1bWVudEVsZW1lbnQuY2xpZW50TGVmdFxuICAgIH1cbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5wcm90b3R5cGUub24gPSBmdW5jdGlvbihldmVudCwgaGFuZGxlcikge1xuICAgIHZhciBldmVudFBhcnRzID0gZXZlbnQuc3BsaXQoJy4nKVxuICAgIHZhciBldmVudFR5cGUgPSBldmVudFBhcnRzWzBdXG4gICAgdmFyIG5hbWVzcGFjZSA9IGV2ZW50UGFydHNbMV0gfHwgJ19fZGVmYXVsdCdcbiAgICB2YXIgbnNIYW5kbGVycyA9IHRoaXMuaGFuZGxlcnNbbmFtZXNwYWNlXSA9IHRoaXMuaGFuZGxlcnNbbmFtZXNwYWNlXSB8fCB7fVxuICAgIHZhciBuc1R5cGVMaXN0ID0gbnNIYW5kbGVyc1tldmVudFR5cGVdID0gbnNIYW5kbGVyc1tldmVudFR5cGVdIHx8IFtdXG5cbiAgICBuc1R5cGVMaXN0LnB1c2goaGFuZGxlcilcbiAgICB0aGlzLmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihldmVudFR5cGUsIGhhbmRsZXIpXG4gIH1cblxuICBOb0ZyYW1ld29ya0FkYXB0ZXIucHJvdG90eXBlLm91dGVySGVpZ2h0ID0gZnVuY3Rpb24oaW5jbHVkZU1hcmdpbikge1xuICAgIHZhciBoZWlnaHQgPSB0aGlzLmlubmVySGVpZ2h0KClcbiAgICB2YXIgY29tcHV0ZWRTdHlsZVxuXG4gICAgaWYgKGluY2x1ZGVNYXJnaW4gJiYgIWlzV2luZG93KHRoaXMuZWxlbWVudCkpIHtcbiAgICAgIGNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpXG4gICAgICBoZWlnaHQgKz0gcGFyc2VJbnQoY29tcHV0ZWRTdHlsZS5tYXJnaW5Ub3AsIDEwKVxuICAgICAgaGVpZ2h0ICs9IHBhcnNlSW50KGNvbXB1dGVkU3R5bGUubWFyZ2luQm90dG9tLCAxMClcbiAgICB9XG5cbiAgICByZXR1cm4gaGVpZ2h0XG4gIH1cblxuICBOb0ZyYW1ld29ya0FkYXB0ZXIucHJvdG90eXBlLm91dGVyV2lkdGggPSBmdW5jdGlvbihpbmNsdWRlTWFyZ2luKSB7XG4gICAgdmFyIHdpZHRoID0gdGhpcy5pbm5lcldpZHRoKClcbiAgICB2YXIgY29tcHV0ZWRTdHlsZVxuXG4gICAgaWYgKGluY2x1ZGVNYXJnaW4gJiYgIWlzV2luZG93KHRoaXMuZWxlbWVudCkpIHtcbiAgICAgIGNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSh0aGlzLmVsZW1lbnQpXG4gICAgICB3aWR0aCArPSBwYXJzZUludChjb21wdXRlZFN0eWxlLm1hcmdpbkxlZnQsIDEwKVxuICAgICAgd2lkdGggKz0gcGFyc2VJbnQoY29tcHV0ZWRTdHlsZS5tYXJnaW5SaWdodCwgMTApXG4gICAgfVxuXG4gICAgcmV0dXJuIHdpZHRoXG4gIH1cblxuICBOb0ZyYW1ld29ya0FkYXB0ZXIucHJvdG90eXBlLnNjcm9sbExlZnQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgd2luID0gZ2V0V2luZG93KHRoaXMuZWxlbWVudClcbiAgICByZXR1cm4gd2luID8gd2luLnBhZ2VYT2Zmc2V0IDogdGhpcy5lbGVtZW50LnNjcm9sbExlZnRcbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5wcm90b3R5cGUuc2Nyb2xsVG9wID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHdpbiA9IGdldFdpbmRvdyh0aGlzLmVsZW1lbnQpXG4gICAgcmV0dXJuIHdpbiA/IHdpbi5wYWdlWU9mZnNldCA6IHRoaXMuZWxlbWVudC5zY3JvbGxUb3BcbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5leHRlbmQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cylcblxuICAgIGZ1bmN0aW9uIG1lcmdlKHRhcmdldCwgb2JqKSB7XG4gICAgICBpZiAodHlwZW9mIHRhcmdldCA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICAgICAgdGFyZ2V0W2tleV0gPSBvYmpba2V5XVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGFyZ2V0XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDEsIGVuZCA9IGFyZ3MubGVuZ3RoOyBpIDwgZW5kOyBpKyspIHtcbiAgICAgIG1lcmdlKGFyZ3NbMF0sIGFyZ3NbaV0pXG4gICAgfVxuICAgIHJldHVybiBhcmdzWzBdXG4gIH1cblxuICBOb0ZyYW1ld29ya0FkYXB0ZXIuaW5BcnJheSA9IGZ1bmN0aW9uKGVsZW1lbnQsIGFycmF5LCBpKSB7XG4gICAgcmV0dXJuIGFycmF5ID09IG51bGwgPyAtMSA6IGFycmF5LmluZGV4T2YoZWxlbWVudCwgaSlcbiAgfVxuXG4gIE5vRnJhbWV3b3JrQWRhcHRlci5pc0VtcHR5T2JqZWN0ID0gZnVuY3Rpb24ob2JqKSB7XG4gICAgLyogZXNsaW50IG5vLXVudXNlZC12YXJzOiAwICovXG4gICAgZm9yICh2YXIgbmFtZSBpbiBvYmopIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgV2F5cG9pbnQuYWRhcHRlcnMucHVzaCh7XG4gICAgbmFtZTogJ25vZnJhbWV3b3JrJyxcbiAgICBBZGFwdGVyOiBOb0ZyYW1ld29ya0FkYXB0ZXJcbiAgfSlcbiAgV2F5cG9pbnQuQWRhcHRlciA9IE5vRnJhbWV3b3JrQWRhcHRlclxufSgpKVxuOyIsIi8qXG4gICAgIF8gXyAgICAgIF8gICAgICAgX1xuIF9fX3wgKF8pIF9fX3wgfCBfXyAgKF8pX19fXG4vIF9ffCB8IHwvIF9ffCB8LyAvICB8IC8gX198XG5cXF9fIFxcIHwgfCAoX198ICAgPCBfIHwgXFxfXyBcXFxufF9fXy9ffF98XFxfX198X3xcXF8oXykvIHxfX18vXG4gICAgICAgICAgICAgICAgICAgfF9fL1xuXG4gVmVyc2lvbjogMS44LjFcbiAgQXV0aG9yOiBLZW4gV2hlZWxlclxuIFdlYnNpdGU6IGh0dHA6Ly9rZW53aGVlbGVyLmdpdGh1Yi5pb1xuICAgIERvY3M6IGh0dHA6Ly9rZW53aGVlbGVyLmdpdGh1Yi5pby9zbGlja1xuICAgIFJlcG86IGh0dHA6Ly9naXRodWIuY29tL2tlbndoZWVsZXIvc2xpY2tcbiAgSXNzdWVzOiBodHRwOi8vZ2l0aHViLmNvbS9rZW53aGVlbGVyL3NsaWNrL2lzc3Vlc1xuXG4gKi9cbi8qIGdsb2JhbCB3aW5kb3csIGRvY3VtZW50LCBkZWZpbmUsIGpRdWVyeSwgc2V0SW50ZXJ2YWwsIGNsZWFySW50ZXJ2YWwgKi9cbjsoZnVuY3Rpb24oZmFjdG9yeSkge1xuICAgICd1c2Ugc3RyaWN0JztcbiAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgICAgIGRlZmluZShbJ2pxdWVyeSddLCBmYWN0b3J5KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkocmVxdWlyZSgnanF1ZXJ5JykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGZhY3RvcnkoalF1ZXJ5KTtcbiAgICB9XG5cbn0oZnVuY3Rpb24oJCkge1xuICAgICd1c2Ugc3RyaWN0JztcbiAgICB2YXIgU2xpY2sgPSB3aW5kb3cuU2xpY2sgfHwge307XG5cbiAgICBTbGljayA9IChmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgaW5zdGFuY2VVaWQgPSAwO1xuXG4gICAgICAgIGZ1bmN0aW9uIFNsaWNrKGVsZW1lbnQsIHNldHRpbmdzKSB7XG5cbiAgICAgICAgICAgIHZhciBfID0gdGhpcywgZGF0YVNldHRpbmdzO1xuXG4gICAgICAgICAgICBfLmRlZmF1bHRzID0ge1xuICAgICAgICAgICAgICAgIGFjY2Vzc2liaWxpdHk6IHRydWUsXG4gICAgICAgICAgICAgICAgYWRhcHRpdmVIZWlnaHQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGFwcGVuZEFycm93czogJChlbGVtZW50KSxcbiAgICAgICAgICAgICAgICBhcHBlbmREb3RzOiAkKGVsZW1lbnQpLFxuICAgICAgICAgICAgICAgIGFycm93czogdHJ1ZSxcbiAgICAgICAgICAgICAgICBhc05hdkZvcjogbnVsbCxcbiAgICAgICAgICAgICAgICBwcmV2QXJyb3c6ICc8YnV0dG9uIGNsYXNzPVwic2xpY2stcHJldlwiIGFyaWEtbGFiZWw9XCJQcmV2aW91c1wiIHR5cGU9XCJidXR0b25cIj5QcmV2aW91czwvYnV0dG9uPicsXG4gICAgICAgICAgICAgICAgbmV4dEFycm93OiAnPGJ1dHRvbiBjbGFzcz1cInNsaWNrLW5leHRcIiBhcmlhLWxhYmVsPVwiTmV4dFwiIHR5cGU9XCJidXR0b25cIj5OZXh0PC9idXR0b24+JyxcbiAgICAgICAgICAgICAgICBhdXRvcGxheTogZmFsc2UsXG4gICAgICAgICAgICAgICAgYXV0b3BsYXlTcGVlZDogMzAwMCxcbiAgICAgICAgICAgICAgICBjZW50ZXJNb2RlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjZW50ZXJQYWRkaW5nOiAnNTBweCcsXG4gICAgICAgICAgICAgICAgY3NzRWFzZTogJ2Vhc2UnLFxuICAgICAgICAgICAgICAgIGN1c3RvbVBhZ2luZzogZnVuY3Rpb24oc2xpZGVyLCBpKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkKCc8YnV0dG9uIHR5cGU9XCJidXR0b25cIiAvPicpLnRleHQoaSArIDEpO1xuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgZG90czogZmFsc2UsXG4gICAgICAgICAgICAgICAgZG90c0NsYXNzOiAnc2xpY2stZG90cycsXG4gICAgICAgICAgICAgICAgZHJhZ2dhYmxlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGVhc2luZzogJ2xpbmVhcicsXG4gICAgICAgICAgICAgICAgZWRnZUZyaWN0aW9uOiAwLjM1LFxuICAgICAgICAgICAgICAgIGZhZGU6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGZvY3VzT25TZWxlY3Q6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGZvY3VzT25DaGFuZ2U6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGluZmluaXRlOiB0cnVlLFxuICAgICAgICAgICAgICAgIGluaXRpYWxTbGlkZTogMCxcbiAgICAgICAgICAgICAgICBsYXp5TG9hZDogJ29uZGVtYW5kJyxcbiAgICAgICAgICAgICAgICBtb2JpbGVGaXJzdDogZmFsc2UsXG4gICAgICAgICAgICAgICAgcGF1c2VPbkhvdmVyOiB0cnVlLFxuICAgICAgICAgICAgICAgIHBhdXNlT25Gb2N1czogdHJ1ZSxcbiAgICAgICAgICAgICAgICBwYXVzZU9uRG90c0hvdmVyOiBmYWxzZSxcbiAgICAgICAgICAgICAgICByZXNwb25kVG86ICd3aW5kb3cnLFxuICAgICAgICAgICAgICAgIHJlc3BvbnNpdmU6IG51bGwsXG4gICAgICAgICAgICAgICAgcm93czogMSxcbiAgICAgICAgICAgICAgICBydGw6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNsaWRlOiAnJyxcbiAgICAgICAgICAgICAgICBzbGlkZXNQZXJSb3c6IDEsXG4gICAgICAgICAgICAgICAgc2xpZGVzVG9TaG93OiAxLFxuICAgICAgICAgICAgICAgIHNsaWRlc1RvU2Nyb2xsOiAxLFxuICAgICAgICAgICAgICAgIHNwZWVkOiA1MDAsXG4gICAgICAgICAgICAgICAgc3dpcGU6IHRydWUsXG4gICAgICAgICAgICAgICAgc3dpcGVUb1NsaWRlOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB0b3VjaE1vdmU6IHRydWUsXG4gICAgICAgICAgICAgICAgdG91Y2hUaHJlc2hvbGQ6IDUsXG4gICAgICAgICAgICAgICAgdXNlQ1NTOiB0cnVlLFxuICAgICAgICAgICAgICAgIHVzZVRyYW5zZm9ybTogdHJ1ZSxcbiAgICAgICAgICAgICAgICB2YXJpYWJsZVdpZHRoOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB2ZXJ0aWNhbDogZmFsc2UsXG4gICAgICAgICAgICAgICAgdmVydGljYWxTd2lwaW5nOiBmYWxzZSxcbiAgICAgICAgICAgICAgICB3YWl0Rm9yQW5pbWF0ZTogdHJ1ZSxcbiAgICAgICAgICAgICAgICB6SW5kZXg6IDEwMDBcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIF8uaW5pdGlhbHMgPSB7XG4gICAgICAgICAgICAgICAgYW5pbWF0aW5nOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBkcmFnZ2luZzogZmFsc2UsXG4gICAgICAgICAgICAgICAgYXV0b1BsYXlUaW1lcjogbnVsbCxcbiAgICAgICAgICAgICAgICBjdXJyZW50RGlyZWN0aW9uOiAwLFxuICAgICAgICAgICAgICAgIGN1cnJlbnRMZWZ0OiBudWxsLFxuICAgICAgICAgICAgICAgIGN1cnJlbnRTbGlkZTogMCxcbiAgICAgICAgICAgICAgICBkaXJlY3Rpb246IDEsXG4gICAgICAgICAgICAgICAgJGRvdHM6IG51bGwsXG4gICAgICAgICAgICAgICAgbGlzdFdpZHRoOiBudWxsLFxuICAgICAgICAgICAgICAgIGxpc3RIZWlnaHQ6IG51bGwsXG4gICAgICAgICAgICAgICAgbG9hZEluZGV4OiAwLFxuICAgICAgICAgICAgICAgICRuZXh0QXJyb3c6IG51bGwsXG4gICAgICAgICAgICAgICAgJHByZXZBcnJvdzogbnVsbCxcbiAgICAgICAgICAgICAgICBzY3JvbGxpbmc6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNsaWRlQ291bnQ6IG51bGwsXG4gICAgICAgICAgICAgICAgc2xpZGVXaWR0aDogbnVsbCxcbiAgICAgICAgICAgICAgICAkc2xpZGVUcmFjazogbnVsbCxcbiAgICAgICAgICAgICAgICAkc2xpZGVzOiBudWxsLFxuICAgICAgICAgICAgICAgIHNsaWRpbmc6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNsaWRlT2Zmc2V0OiAwLFxuICAgICAgICAgICAgICAgIHN3aXBlTGVmdDogbnVsbCxcbiAgICAgICAgICAgICAgICBzd2lwaW5nOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAkbGlzdDogbnVsbCxcbiAgICAgICAgICAgICAgICB0b3VjaE9iamVjdDoge30sXG4gICAgICAgICAgICAgICAgdHJhbnNmb3Jtc0VuYWJsZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHVuc2xpY2tlZDogZmFsc2VcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgICQuZXh0ZW5kKF8sIF8uaW5pdGlhbHMpO1xuXG4gICAgICAgICAgICBfLmFjdGl2ZUJyZWFrcG9pbnQgPSBudWxsO1xuICAgICAgICAgICAgXy5hbmltVHlwZSA9IG51bGw7XG4gICAgICAgICAgICBfLmFuaW1Qcm9wID0gbnVsbDtcbiAgICAgICAgICAgIF8uYnJlYWtwb2ludHMgPSBbXTtcbiAgICAgICAgICAgIF8uYnJlYWtwb2ludFNldHRpbmdzID0gW107XG4gICAgICAgICAgICBfLmNzc1RyYW5zaXRpb25zID0gZmFsc2U7XG4gICAgICAgICAgICBfLmZvY3Vzc2VkID0gZmFsc2U7XG4gICAgICAgICAgICBfLmludGVycnVwdGVkID0gZmFsc2U7XG4gICAgICAgICAgICBfLmhpZGRlbiA9ICdoaWRkZW4nO1xuICAgICAgICAgICAgXy5wYXVzZWQgPSB0cnVlO1xuICAgICAgICAgICAgXy5wb3NpdGlvblByb3AgPSBudWxsO1xuICAgICAgICAgICAgXy5yZXNwb25kVG8gPSBudWxsO1xuICAgICAgICAgICAgXy5yb3dDb3VudCA9IDE7XG4gICAgICAgICAgICBfLnNob3VsZENsaWNrID0gdHJ1ZTtcbiAgICAgICAgICAgIF8uJHNsaWRlciA9ICQoZWxlbWVudCk7XG4gICAgICAgICAgICBfLiRzbGlkZXNDYWNoZSA9IG51bGw7XG4gICAgICAgICAgICBfLnRyYW5zZm9ybVR5cGUgPSBudWxsO1xuICAgICAgICAgICAgXy50cmFuc2l0aW9uVHlwZSA9IG51bGw7XG4gICAgICAgICAgICBfLnZpc2liaWxpdHlDaGFuZ2UgPSAndmlzaWJpbGl0eWNoYW5nZSc7XG4gICAgICAgICAgICBfLndpbmRvd1dpZHRoID0gMDtcbiAgICAgICAgICAgIF8ud2luZG93VGltZXIgPSBudWxsO1xuXG4gICAgICAgICAgICBkYXRhU2V0dGluZ3MgPSAkKGVsZW1lbnQpLmRhdGEoJ3NsaWNrJykgfHwge307XG5cbiAgICAgICAgICAgIF8ub3B0aW9ucyA9ICQuZXh0ZW5kKHt9LCBfLmRlZmF1bHRzLCBzZXR0aW5ncywgZGF0YVNldHRpbmdzKTtcblxuICAgICAgICAgICAgXy5jdXJyZW50U2xpZGUgPSBfLm9wdGlvbnMuaW5pdGlhbFNsaWRlO1xuXG4gICAgICAgICAgICBfLm9yaWdpbmFsU2V0dGluZ3MgPSBfLm9wdGlvbnM7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgZG9jdW1lbnQubW96SGlkZGVuICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIF8uaGlkZGVuID0gJ21vekhpZGRlbic7XG4gICAgICAgICAgICAgICAgXy52aXNpYmlsaXR5Q2hhbmdlID0gJ21venZpc2liaWxpdHljaGFuZ2UnO1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgZG9jdW1lbnQud2Via2l0SGlkZGVuICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIF8uaGlkZGVuID0gJ3dlYmtpdEhpZGRlbic7XG4gICAgICAgICAgICAgICAgXy52aXNpYmlsaXR5Q2hhbmdlID0gJ3dlYmtpdHZpc2liaWxpdHljaGFuZ2UnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfLmF1dG9QbGF5ID0gJC5wcm94eShfLmF1dG9QbGF5LCBfKTtcbiAgICAgICAgICAgIF8uYXV0b1BsYXlDbGVhciA9ICQucHJveHkoXy5hdXRvUGxheUNsZWFyLCBfKTtcbiAgICAgICAgICAgIF8uYXV0b1BsYXlJdGVyYXRvciA9ICQucHJveHkoXy5hdXRvUGxheUl0ZXJhdG9yLCBfKTtcbiAgICAgICAgICAgIF8uY2hhbmdlU2xpZGUgPSAkLnByb3h5KF8uY2hhbmdlU2xpZGUsIF8pO1xuICAgICAgICAgICAgXy5jbGlja0hhbmRsZXIgPSAkLnByb3h5KF8uY2xpY2tIYW5kbGVyLCBfKTtcbiAgICAgICAgICAgIF8uc2VsZWN0SGFuZGxlciA9ICQucHJveHkoXy5zZWxlY3RIYW5kbGVyLCBfKTtcbiAgICAgICAgICAgIF8uc2V0UG9zaXRpb24gPSAkLnByb3h5KF8uc2V0UG9zaXRpb24sIF8pO1xuICAgICAgICAgICAgXy5zd2lwZUhhbmRsZXIgPSAkLnByb3h5KF8uc3dpcGVIYW5kbGVyLCBfKTtcbiAgICAgICAgICAgIF8uZHJhZ0hhbmRsZXIgPSAkLnByb3h5KF8uZHJhZ0hhbmRsZXIsIF8pO1xuICAgICAgICAgICAgXy5rZXlIYW5kbGVyID0gJC5wcm94eShfLmtleUhhbmRsZXIsIF8pO1xuXG4gICAgICAgICAgICBfLmluc3RhbmNlVWlkID0gaW5zdGFuY2VVaWQrKztcblxuICAgICAgICAgICAgLy8gQSBzaW1wbGUgd2F5IHRvIGNoZWNrIGZvciBIVE1MIHN0cmluZ3NcbiAgICAgICAgICAgIC8vIFN0cmljdCBIVE1MIHJlY29nbml0aW9uIChtdXN0IHN0YXJ0IHdpdGggPClcbiAgICAgICAgICAgIC8vIEV4dHJhY3RlZCBmcm9tIGpRdWVyeSB2MS4xMSBzb3VyY2VcbiAgICAgICAgICAgIF8uaHRtbEV4cHIgPSAvXig/OlxccyooPFtcXHdcXFddKz4pW14+XSopJC87XG5cblxuICAgICAgICAgICAgXy5yZWdpc3RlckJyZWFrcG9pbnRzKCk7XG4gICAgICAgICAgICBfLmluaXQodHJ1ZSk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBTbGljaztcblxuICAgIH0oKSk7XG5cbiAgICBTbGljay5wcm90b3R5cGUuYWN0aXZhdGVBREEgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIF8uJHNsaWRlVHJhY2suZmluZCgnLnNsaWNrLWFjdGl2ZScpLmF0dHIoe1xuICAgICAgICAgICAgJ2FyaWEtaGlkZGVuJzogJ2ZhbHNlJ1xuICAgICAgICB9KS5maW5kKCdhLCBpbnB1dCwgYnV0dG9uLCBzZWxlY3QnKS5hdHRyKHtcbiAgICAgICAgICAgICd0YWJpbmRleCc6ICcwJ1xuICAgICAgICB9KTtcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuYWRkU2xpZGUgPSBTbGljay5wcm90b3R5cGUuc2xpY2tBZGQgPSBmdW5jdGlvbihtYXJrdXAsIGluZGV4LCBhZGRCZWZvcmUpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgaWYgKHR5cGVvZihpbmRleCkgPT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgYWRkQmVmb3JlID0gaW5kZXg7XG4gICAgICAgICAgICBpbmRleCA9IG51bGw7XG4gICAgICAgIH0gZWxzZSBpZiAoaW5kZXggPCAwIHx8IChpbmRleCA+PSBfLnNsaWRlQ291bnQpKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBfLnVubG9hZCgpO1xuXG4gICAgICAgIGlmICh0eXBlb2YoaW5kZXgpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgICAgaWYgKGluZGV4ID09PSAwICYmIF8uJHNsaWRlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAkKG1hcmt1cCkuYXBwZW5kVG8oXy4kc2xpZGVUcmFjayk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFkZEJlZm9yZSkge1xuICAgICAgICAgICAgICAgICQobWFya3VwKS5pbnNlcnRCZWZvcmUoXy4kc2xpZGVzLmVxKGluZGV4KSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICQobWFya3VwKS5pbnNlcnRBZnRlcihfLiRzbGlkZXMuZXEoaW5kZXgpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChhZGRCZWZvcmUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAkKG1hcmt1cCkucHJlcGVuZFRvKF8uJHNsaWRlVHJhY2spO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkKG1hcmt1cCkuYXBwZW5kVG8oXy4kc2xpZGVUcmFjayk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBfLiRzbGlkZXMgPSBfLiRzbGlkZVRyYWNrLmNoaWxkcmVuKHRoaXMub3B0aW9ucy5zbGlkZSk7XG5cbiAgICAgICAgXy4kc2xpZGVUcmFjay5jaGlsZHJlbih0aGlzLm9wdGlvbnMuc2xpZGUpLmRldGFjaCgpO1xuXG4gICAgICAgIF8uJHNsaWRlVHJhY2suYXBwZW5kKF8uJHNsaWRlcyk7XG5cbiAgICAgICAgXy4kc2xpZGVzLmVhY2goZnVuY3Rpb24oaW5kZXgsIGVsZW1lbnQpIHtcbiAgICAgICAgICAgICQoZWxlbWVudCkuYXR0cignZGF0YS1zbGljay1pbmRleCcsIGluZGV4KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgXy4kc2xpZGVzQ2FjaGUgPSBfLiRzbGlkZXM7XG5cbiAgICAgICAgXy5yZWluaXQoKTtcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuYW5pbWF0ZUhlaWdodCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgXyA9IHRoaXM7XG4gICAgICAgIGlmIChfLm9wdGlvbnMuc2xpZGVzVG9TaG93ID09PSAxICYmIF8ub3B0aW9ucy5hZGFwdGl2ZUhlaWdodCA9PT0gdHJ1ZSAmJiBfLm9wdGlvbnMudmVydGljYWwgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0SGVpZ2h0ID0gXy4kc2xpZGVzLmVxKF8uY3VycmVudFNsaWRlKS5vdXRlckhlaWdodCh0cnVlKTtcbiAgICAgICAgICAgIF8uJGxpc3QuYW5pbWF0ZSh7XG4gICAgICAgICAgICAgICAgaGVpZ2h0OiB0YXJnZXRIZWlnaHRcbiAgICAgICAgICAgIH0sIF8ub3B0aW9ucy5zcGVlZCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmFuaW1hdGVTbGlkZSA9IGZ1bmN0aW9uKHRhcmdldExlZnQsIGNhbGxiYWNrKSB7XG5cbiAgICAgICAgdmFyIGFuaW1Qcm9wcyA9IHt9LFxuICAgICAgICAgICAgXyA9IHRoaXM7XG5cbiAgICAgICAgXy5hbmltYXRlSGVpZ2h0KCk7XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5ydGwgPT09IHRydWUgJiYgXy5vcHRpb25zLnZlcnRpY2FsID09PSBmYWxzZSkge1xuICAgICAgICAgICAgdGFyZ2V0TGVmdCA9IC10YXJnZXRMZWZ0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChfLnRyYW5zZm9ybXNFbmFibGVkID09PSBmYWxzZSkge1xuICAgICAgICAgICAgaWYgKF8ub3B0aW9ucy52ZXJ0aWNhbCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBfLiRzbGlkZVRyYWNrLmFuaW1hdGUoe1xuICAgICAgICAgICAgICAgICAgICBsZWZ0OiB0YXJnZXRMZWZ0XG4gICAgICAgICAgICAgICAgfSwgXy5vcHRpb25zLnNwZWVkLCBfLm9wdGlvbnMuZWFzaW5nLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIF8uJHNsaWRlVHJhY2suYW5pbWF0ZSh7XG4gICAgICAgICAgICAgICAgICAgIHRvcDogdGFyZ2V0TGVmdFxuICAgICAgICAgICAgICAgIH0sIF8ub3B0aW9ucy5zcGVlZCwgXy5vcHRpb25zLmVhc2luZywgY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIGlmIChfLmNzc1RyYW5zaXRpb25zID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIGlmIChfLm9wdGlvbnMucnRsID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgIF8uY3VycmVudExlZnQgPSAtKF8uY3VycmVudExlZnQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAkKHtcbiAgICAgICAgICAgICAgICAgICAgYW5pbVN0YXJ0OiBfLmN1cnJlbnRMZWZ0XG4gICAgICAgICAgICAgICAgfSkuYW5pbWF0ZSh7XG4gICAgICAgICAgICAgICAgICAgIGFuaW1TdGFydDogdGFyZ2V0TGVmdFxuICAgICAgICAgICAgICAgIH0sIHtcbiAgICAgICAgICAgICAgICAgICAgZHVyYXRpb246IF8ub3B0aW9ucy5zcGVlZCxcbiAgICAgICAgICAgICAgICAgICAgZWFzaW5nOiBfLm9wdGlvbnMuZWFzaW5nLFxuICAgICAgICAgICAgICAgICAgICBzdGVwOiBmdW5jdGlvbihub3cpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG5vdyA9IE1hdGguY2VpbChub3cpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKF8ub3B0aW9ucy52ZXJ0aWNhbCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbmltUHJvcHNbXy5hbmltVHlwZV0gPSAndHJhbnNsYXRlKCcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3cgKyAncHgsIDBweCknO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uJHNsaWRlVHJhY2suY3NzKGFuaW1Qcm9wcyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFuaW1Qcm9wc1tfLmFuaW1UeXBlXSA9ICd0cmFuc2xhdGUoMHB4LCcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBub3cgKyAncHgpJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLiRzbGlkZVRyYWNrLmNzcyhhbmltUHJvcHMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYWxsYmFjay5jYWxsKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgIF8uYXBwbHlUcmFuc2l0aW9uKCk7XG4gICAgICAgICAgICAgICAgdGFyZ2V0TGVmdCA9IE1hdGguY2VpbCh0YXJnZXRMZWZ0KTtcblxuICAgICAgICAgICAgICAgIGlmIChfLm9wdGlvbnMudmVydGljYWwgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgIGFuaW1Qcm9wc1tfLmFuaW1UeXBlXSA9ICd0cmFuc2xhdGUzZCgnICsgdGFyZ2V0TGVmdCArICdweCwgMHB4LCAwcHgpJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBhbmltUHJvcHNbXy5hbmltVHlwZV0gPSAndHJhbnNsYXRlM2QoMHB4LCcgKyB0YXJnZXRMZWZ0ICsgJ3B4LCAwcHgpJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXy4kc2xpZGVUcmFjay5jc3MoYW5pbVByb3BzKTtcblxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICBfLmRpc2FibGVUcmFuc2l0aW9uKCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoKTtcbiAgICAgICAgICAgICAgICAgICAgfSwgXy5vcHRpb25zLnNwZWVkKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmdldE5hdlRhcmdldCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcyxcbiAgICAgICAgICAgIGFzTmF2Rm9yID0gXy5vcHRpb25zLmFzTmF2Rm9yO1xuXG4gICAgICAgIGlmICggYXNOYXZGb3IgJiYgYXNOYXZGb3IgIT09IG51bGwgKSB7XG4gICAgICAgICAgICBhc05hdkZvciA9ICQoYXNOYXZGb3IpLm5vdChfLiRzbGlkZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFzTmF2Rm9yO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5hc05hdkZvciA9IGZ1bmN0aW9uKGluZGV4KSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgYXNOYXZGb3IgPSBfLmdldE5hdlRhcmdldCgpO1xuXG4gICAgICAgIGlmICggYXNOYXZGb3IgIT09IG51bGwgJiYgdHlwZW9mIGFzTmF2Rm9yID09PSAnb2JqZWN0JyApIHtcbiAgICAgICAgICAgIGFzTmF2Rm9yLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgdmFyIHRhcmdldCA9ICQodGhpcykuc2xpY2soJ2dldFNsaWNrJyk7XG4gICAgICAgICAgICAgICAgaWYoIXRhcmdldC51bnNsaWNrZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0LnNsaWRlSGFuZGxlcihpbmRleCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuYXBwbHlUcmFuc2l0aW9uID0gZnVuY3Rpb24oc2xpZGUpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXMsXG4gICAgICAgICAgICB0cmFuc2l0aW9uID0ge307XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5mYWRlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgdHJhbnNpdGlvbltfLnRyYW5zaXRpb25UeXBlXSA9IF8udHJhbnNmb3JtVHlwZSArICcgJyArIF8ub3B0aW9ucy5zcGVlZCArICdtcyAnICsgXy5vcHRpb25zLmNzc0Vhc2U7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0cmFuc2l0aW9uW18udHJhbnNpdGlvblR5cGVdID0gJ29wYWNpdHkgJyArIF8ub3B0aW9ucy5zcGVlZCArICdtcyAnICsgXy5vcHRpb25zLmNzc0Vhc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5vcHRpb25zLmZhZGUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBfLiRzbGlkZVRyYWNrLmNzcyh0cmFuc2l0aW9uKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF8uJHNsaWRlcy5lcShzbGlkZSkuY3NzKHRyYW5zaXRpb24pO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmF1dG9QbGF5ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIF8uYXV0b1BsYXlDbGVhcigpO1xuXG4gICAgICAgIGlmICggXy5zbGlkZUNvdW50ID4gXy5vcHRpb25zLnNsaWRlc1RvU2hvdyApIHtcbiAgICAgICAgICAgIF8uYXV0b1BsYXlUaW1lciA9IHNldEludGVydmFsKCBfLmF1dG9QbGF5SXRlcmF0b3IsIF8ub3B0aW9ucy5hdXRvcGxheVNwZWVkICk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuYXV0b1BsYXlDbGVhciA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBpZiAoXy5hdXRvUGxheVRpbWVyKSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKF8uYXV0b1BsYXlUaW1lcik7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuYXV0b1BsYXlJdGVyYXRvciA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcyxcbiAgICAgICAgICAgIHNsaWRlVG8gPSBfLmN1cnJlbnRTbGlkZSArIF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbDtcblxuICAgICAgICBpZiAoICFfLnBhdXNlZCAmJiAhXy5pbnRlcnJ1cHRlZCAmJiAhXy5mb2N1c3NlZCApIHtcblxuICAgICAgICAgICAgaWYgKCBfLm9wdGlvbnMuaW5maW5pdGUgPT09IGZhbHNlICkge1xuXG4gICAgICAgICAgICAgICAgaWYgKCBfLmRpcmVjdGlvbiA9PT0gMSAmJiAoIF8uY3VycmVudFNsaWRlICsgMSApID09PSAoIF8uc2xpZGVDb3VudCAtIDEgKSkge1xuICAgICAgICAgICAgICAgICAgICBfLmRpcmVjdGlvbiA9IDA7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoIF8uZGlyZWN0aW9uID09PSAwICkge1xuXG4gICAgICAgICAgICAgICAgICAgIHNsaWRlVG8gPSBfLmN1cnJlbnRTbGlkZSAtIF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbDtcblxuICAgICAgICAgICAgICAgICAgICBpZiAoIF8uY3VycmVudFNsaWRlIC0gMSA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uZGlyZWN0aW9uID0gMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF8uc2xpZGVIYW5kbGVyKCBzbGlkZVRvICk7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5idWlsZEFycm93cyA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmFycm93cyA9PT0gdHJ1ZSApIHtcblxuICAgICAgICAgICAgXy4kcHJldkFycm93ID0gJChfLm9wdGlvbnMucHJldkFycm93KS5hZGRDbGFzcygnc2xpY2stYXJyb3cnKTtcbiAgICAgICAgICAgIF8uJG5leHRBcnJvdyA9ICQoXy5vcHRpb25zLm5leHRBcnJvdykuYWRkQ2xhc3MoJ3NsaWNrLWFycm93Jyk7XG5cbiAgICAgICAgICAgIGlmKCBfLnNsaWRlQ291bnQgPiBfLm9wdGlvbnMuc2xpZGVzVG9TaG93ICkge1xuXG4gICAgICAgICAgICAgICAgXy4kcHJldkFycm93LnJlbW92ZUNsYXNzKCdzbGljay1oaWRkZW4nKS5yZW1vdmVBdHRyKCdhcmlhLWhpZGRlbiB0YWJpbmRleCcpO1xuICAgICAgICAgICAgICAgIF8uJG5leHRBcnJvdy5yZW1vdmVDbGFzcygnc2xpY2staGlkZGVuJykucmVtb3ZlQXR0cignYXJpYS1oaWRkZW4gdGFiaW5kZXgnKTtcblxuICAgICAgICAgICAgICAgIGlmIChfLmh0bWxFeHByLnRlc3QoXy5vcHRpb25zLnByZXZBcnJvdykpIHtcbiAgICAgICAgICAgICAgICAgICAgXy4kcHJldkFycm93LnByZXBlbmRUbyhfLm9wdGlvbnMuYXBwZW5kQXJyb3dzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoXy5odG1sRXhwci50ZXN0KF8ub3B0aW9ucy5uZXh0QXJyb3cpKSB7XG4gICAgICAgICAgICAgICAgICAgIF8uJG5leHRBcnJvdy5hcHBlbmRUbyhfLm9wdGlvbnMuYXBwZW5kQXJyb3dzKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoXy5vcHRpb25zLmluZmluaXRlICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgIF8uJHByZXZBcnJvd1xuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZENsYXNzKCdzbGljay1kaXNhYmxlZCcpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignYXJpYS1kaXNhYmxlZCcsICd0cnVlJyk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgXy4kcHJldkFycm93LmFkZCggXy4kbmV4dEFycm93IClcblxuICAgICAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoJ3NsaWNrLWhpZGRlbicpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICdhcmlhLWRpc2FibGVkJzogJ3RydWUnLFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RhYmluZGV4JzogJy0xJ1xuICAgICAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuYnVpbGREb3RzID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgaSwgZG90O1xuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuZG90cyA9PT0gdHJ1ZSAmJiBfLnNsaWRlQ291bnQgPiBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSB7XG5cbiAgICAgICAgICAgIF8uJHNsaWRlci5hZGRDbGFzcygnc2xpY2stZG90dGVkJyk7XG5cbiAgICAgICAgICAgIGRvdCA9ICQoJzx1bCAvPicpLmFkZENsYXNzKF8ub3B0aW9ucy5kb3RzQ2xhc3MpO1xuXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDw9IF8uZ2V0RG90Q291bnQoKTsgaSArPSAxKSB7XG4gICAgICAgICAgICAgICAgZG90LmFwcGVuZCgkKCc8bGkgLz4nKS5hcHBlbmQoXy5vcHRpb25zLmN1c3RvbVBhZ2luZy5jYWxsKHRoaXMsIF8sIGkpKSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF8uJGRvdHMgPSBkb3QuYXBwZW5kVG8oXy5vcHRpb25zLmFwcGVuZERvdHMpO1xuXG4gICAgICAgICAgICBfLiRkb3RzLmZpbmQoJ2xpJykuZmlyc3QoKS5hZGRDbGFzcygnc2xpY2stYWN0aXZlJyk7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5idWlsZE91dCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBfLiRzbGlkZXMgPVxuICAgICAgICAgICAgXy4kc2xpZGVyXG4gICAgICAgICAgICAgICAgLmNoaWxkcmVuKCBfLm9wdGlvbnMuc2xpZGUgKyAnOm5vdCguc2xpY2stY2xvbmVkKScpXG4gICAgICAgICAgICAgICAgLmFkZENsYXNzKCdzbGljay1zbGlkZScpO1xuXG4gICAgICAgIF8uc2xpZGVDb3VudCA9IF8uJHNsaWRlcy5sZW5ndGg7XG5cbiAgICAgICAgXy4kc2xpZGVzLmVhY2goZnVuY3Rpb24oaW5kZXgsIGVsZW1lbnQpIHtcbiAgICAgICAgICAgICQoZWxlbWVudClcbiAgICAgICAgICAgICAgICAuYXR0cignZGF0YS1zbGljay1pbmRleCcsIGluZGV4KVxuICAgICAgICAgICAgICAgIC5kYXRhKCdvcmlnaW5hbFN0eWxpbmcnLCAkKGVsZW1lbnQpLmF0dHIoJ3N0eWxlJykgfHwgJycpO1xuICAgICAgICB9KTtcblxuICAgICAgICBfLiRzbGlkZXIuYWRkQ2xhc3MoJ3NsaWNrLXNsaWRlcicpO1xuXG4gICAgICAgIF8uJHNsaWRlVHJhY2sgPSAoXy5zbGlkZUNvdW50ID09PSAwKSA/XG4gICAgICAgICAgICAkKCc8ZGl2IGNsYXNzPVwic2xpY2stdHJhY2tcIi8+JykuYXBwZW5kVG8oXy4kc2xpZGVyKSA6XG4gICAgICAgICAgICBfLiRzbGlkZXMud3JhcEFsbCgnPGRpdiBjbGFzcz1cInNsaWNrLXRyYWNrXCIvPicpLnBhcmVudCgpO1xuXG4gICAgICAgIF8uJGxpc3QgPSBfLiRzbGlkZVRyYWNrLndyYXAoXG4gICAgICAgICAgICAnPGRpdiBjbGFzcz1cInNsaWNrLWxpc3RcIi8+JykucGFyZW50KCk7XG4gICAgICAgIF8uJHNsaWRlVHJhY2suY3NzKCdvcGFjaXR5JywgMCk7XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5jZW50ZXJNb2RlID09PSB0cnVlIHx8IF8ub3B0aW9ucy5zd2lwZVRvU2xpZGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbCA9IDE7XG4gICAgICAgIH1cblxuICAgICAgICAkKCdpbWdbZGF0YS1sYXp5XScsIF8uJHNsaWRlcikubm90KCdbc3JjXScpLmFkZENsYXNzKCdzbGljay1sb2FkaW5nJyk7XG5cbiAgICAgICAgXy5zZXR1cEluZmluaXRlKCk7XG5cbiAgICAgICAgXy5idWlsZEFycm93cygpO1xuXG4gICAgICAgIF8uYnVpbGREb3RzKCk7XG5cbiAgICAgICAgXy51cGRhdGVEb3RzKCk7XG5cblxuICAgICAgICBfLnNldFNsaWRlQ2xhc3Nlcyh0eXBlb2YgXy5jdXJyZW50U2xpZGUgPT09ICdudW1iZXInID8gXy5jdXJyZW50U2xpZGUgOiAwKTtcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmRyYWdnYWJsZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgXy4kbGlzdC5hZGRDbGFzcygnZHJhZ2dhYmxlJyk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuYnVpbGRSb3dzID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLCBhLCBiLCBjLCBuZXdTbGlkZXMsIG51bU9mU2xpZGVzLCBvcmlnaW5hbFNsaWRlcyxzbGlkZXNQZXJTZWN0aW9uO1xuXG4gICAgICAgIG5ld1NsaWRlcyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgb3JpZ2luYWxTbGlkZXMgPSBfLiRzbGlkZXIuY2hpbGRyZW4oKTtcblxuICAgICAgICBpZihfLm9wdGlvbnMucm93cyA+IDApIHtcblxuICAgICAgICAgICAgc2xpZGVzUGVyU2VjdGlvbiA9IF8ub3B0aW9ucy5zbGlkZXNQZXJSb3cgKiBfLm9wdGlvbnMucm93cztcbiAgICAgICAgICAgIG51bU9mU2xpZGVzID0gTWF0aC5jZWlsKFxuICAgICAgICAgICAgICAgIG9yaWdpbmFsU2xpZGVzLmxlbmd0aCAvIHNsaWRlc1BlclNlY3Rpb25cbiAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgIGZvcihhID0gMDsgYSA8IG51bU9mU2xpZGVzOyBhKyspe1xuICAgICAgICAgICAgICAgIHZhciBzbGlkZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgIGZvcihiID0gMDsgYiA8IF8ub3B0aW9ucy5yb3dzOyBiKyspIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHJvdyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgICAgICBmb3IoYyA9IDA7IGMgPCBfLm9wdGlvbnMuc2xpZGVzUGVyUm93OyBjKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0YXJnZXQgPSAoYSAqIHNsaWRlc1BlclNlY3Rpb24gKyAoKGIgKiBfLm9wdGlvbnMuc2xpZGVzUGVyUm93KSArIGMpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvcmlnaW5hbFNsaWRlcy5nZXQodGFyZ2V0KSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJvdy5hcHBlbmRDaGlsZChvcmlnaW5hbFNsaWRlcy5nZXQodGFyZ2V0KSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgc2xpZGUuYXBwZW5kQ2hpbGQocm93KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbmV3U2xpZGVzLmFwcGVuZENoaWxkKHNsaWRlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgXy4kc2xpZGVyLmVtcHR5KCkuYXBwZW5kKG5ld1NsaWRlcyk7XG4gICAgICAgICAgICBfLiRzbGlkZXIuY2hpbGRyZW4oKS5jaGlsZHJlbigpLmNoaWxkcmVuKClcbiAgICAgICAgICAgICAgICAuY3NzKHtcbiAgICAgICAgICAgICAgICAgICAgJ3dpZHRoJzooMTAwIC8gXy5vcHRpb25zLnNsaWRlc1BlclJvdykgKyAnJScsXG4gICAgICAgICAgICAgICAgICAgICdkaXNwbGF5JzogJ2lubGluZS1ibG9jaydcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmNoZWNrUmVzcG9uc2l2ZSA9IGZ1bmN0aW9uKGluaXRpYWwsIGZvcmNlVXBkYXRlKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgYnJlYWtwb2ludCwgdGFyZ2V0QnJlYWtwb2ludCwgcmVzcG9uZFRvV2lkdGgsIHRyaWdnZXJCcmVha3BvaW50ID0gZmFsc2U7XG4gICAgICAgIHZhciBzbGlkZXJXaWR0aCA9IF8uJHNsaWRlci53aWR0aCgpO1xuICAgICAgICB2YXIgd2luZG93V2lkdGggPSB3aW5kb3cuaW5uZXJXaWR0aCB8fCAkKHdpbmRvdykud2lkdGgoKTtcblxuICAgICAgICBpZiAoXy5yZXNwb25kVG8gPT09ICd3aW5kb3cnKSB7XG4gICAgICAgICAgICByZXNwb25kVG9XaWR0aCA9IHdpbmRvd1dpZHRoO1xuICAgICAgICB9IGVsc2UgaWYgKF8ucmVzcG9uZFRvID09PSAnc2xpZGVyJykge1xuICAgICAgICAgICAgcmVzcG9uZFRvV2lkdGggPSBzbGlkZXJXaWR0aDtcbiAgICAgICAgfSBlbHNlIGlmIChfLnJlc3BvbmRUbyA9PT0gJ21pbicpIHtcbiAgICAgICAgICAgIHJlc3BvbmRUb1dpZHRoID0gTWF0aC5taW4od2luZG93V2lkdGgsIHNsaWRlcldpZHRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggXy5vcHRpb25zLnJlc3BvbnNpdmUgJiZcbiAgICAgICAgICAgIF8ub3B0aW9ucy5yZXNwb25zaXZlLmxlbmd0aCAmJlxuICAgICAgICAgICAgXy5vcHRpb25zLnJlc3BvbnNpdmUgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgdGFyZ2V0QnJlYWtwb2ludCA9IG51bGw7XG5cbiAgICAgICAgICAgIGZvciAoYnJlYWtwb2ludCBpbiBfLmJyZWFrcG9pbnRzKSB7XG4gICAgICAgICAgICAgICAgaWYgKF8uYnJlYWtwb2ludHMuaGFzT3duUHJvcGVydHkoYnJlYWtwb2ludCkpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKF8ub3JpZ2luYWxTZXR0aW5ncy5tb2JpbGVGaXJzdCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25kVG9XaWR0aCA8IF8uYnJlYWtwb2ludHNbYnJlYWtwb2ludF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRCcmVha3BvaW50ID0gXy5icmVha3BvaW50c1ticmVha3BvaW50XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXNwb25kVG9XaWR0aCA+IF8uYnJlYWtwb2ludHNbYnJlYWtwb2ludF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRCcmVha3BvaW50ID0gXy5icmVha3BvaW50c1ticmVha3BvaW50XTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRhcmdldEJyZWFrcG9pbnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBpZiAoXy5hY3RpdmVCcmVha3BvaW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmICh0YXJnZXRCcmVha3BvaW50ICE9PSBfLmFjdGl2ZUJyZWFrcG9pbnQgfHwgZm9yY2VVcGRhdGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uYWN0aXZlQnJlYWtwb2ludCA9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0QnJlYWtwb2ludDtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChfLmJyZWFrcG9pbnRTZXR0aW5nc1t0YXJnZXRCcmVha3BvaW50XSA9PT0gJ3Vuc2xpY2snKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXy51bnNsaWNrKHRhcmdldEJyZWFrcG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgXy5vcmlnaW5hbFNldHRpbmdzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmJyZWFrcG9pbnRTZXR0aW5nc1tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldEJyZWFrcG9pbnRdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5pdGlhbCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmN1cnJlbnRTbGlkZSA9IF8ub3B0aW9ucy5pbml0aWFsU2xpZGU7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8ucmVmcmVzaChpbml0aWFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIHRyaWdnZXJCcmVha3BvaW50ID0gdGFyZ2V0QnJlYWtwb2ludDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIF8uYWN0aXZlQnJlYWtwb2ludCA9IHRhcmdldEJyZWFrcG9pbnQ7XG4gICAgICAgICAgICAgICAgICAgIGlmIChfLmJyZWFrcG9pbnRTZXR0aW5nc1t0YXJnZXRCcmVha3BvaW50XSA9PT0gJ3Vuc2xpY2snKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLnVuc2xpY2sodGFyZ2V0QnJlYWtwb2ludCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLm9wdGlvbnMgPSAkLmV4dGVuZCh7fSwgXy5vcmlnaW5hbFNldHRpbmdzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uYnJlYWtwb2ludFNldHRpbmdzW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRCcmVha3BvaW50XSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW5pdGlhbCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uY3VycmVudFNsaWRlID0gXy5vcHRpb25zLmluaXRpYWxTbGlkZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIF8ucmVmcmVzaChpbml0aWFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB0cmlnZ2VyQnJlYWtwb2ludCA9IHRhcmdldEJyZWFrcG9pbnQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpZiAoXy5hY3RpdmVCcmVha3BvaW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIF8uYWN0aXZlQnJlYWtwb2ludCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgIF8ub3B0aW9ucyA9IF8ub3JpZ2luYWxTZXR0aW5ncztcbiAgICAgICAgICAgICAgICAgICAgaWYgKGluaXRpYWwgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uY3VycmVudFNsaWRlID0gXy5vcHRpb25zLmluaXRpYWxTbGlkZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBfLnJlZnJlc2goaW5pdGlhbCk7XG4gICAgICAgICAgICAgICAgICAgIHRyaWdnZXJCcmVha3BvaW50ID0gdGFyZ2V0QnJlYWtwb2ludDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG9ubHkgdHJpZ2dlciBicmVha3BvaW50cyBkdXJpbmcgYW4gYWN0dWFsIGJyZWFrLiBub3Qgb24gaW5pdGlhbGl6ZS5cbiAgICAgICAgICAgIGlmKCAhaW5pdGlhbCAmJiB0cmlnZ2VyQnJlYWtwb2ludCAhPT0gZmFsc2UgKSB7XG4gICAgICAgICAgICAgICAgXy4kc2xpZGVyLnRyaWdnZXIoJ2JyZWFrcG9pbnQnLCBbXywgdHJpZ2dlckJyZWFrcG9pbnRdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5jaGFuZ2VTbGlkZSA9IGZ1bmN0aW9uKGV2ZW50LCBkb250QW5pbWF0ZSkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcyxcbiAgICAgICAgICAgICR0YXJnZXQgPSAkKGV2ZW50LmN1cnJlbnRUYXJnZXQpLFxuICAgICAgICAgICAgaW5kZXhPZmZzZXQsIHNsaWRlT2Zmc2V0LCB1bmV2ZW5PZmZzZXQ7XG5cbiAgICAgICAgLy8gSWYgdGFyZ2V0IGlzIGEgbGluaywgcHJldmVudCBkZWZhdWx0IGFjdGlvbi5cbiAgICAgICAgaWYoJHRhcmdldC5pcygnYScpKSB7XG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgdGFyZ2V0IGlzIG5vdCB0aGUgPGxpPiBlbGVtZW50IChpZTogYSBjaGlsZCksIGZpbmQgdGhlIDxsaT4uXG4gICAgICAgIGlmKCEkdGFyZ2V0LmlzKCdsaScpKSB7XG4gICAgICAgICAgICAkdGFyZ2V0ID0gJHRhcmdldC5jbG9zZXN0KCdsaScpO1xuICAgICAgICB9XG5cbiAgICAgICAgdW5ldmVuT2Zmc2V0ID0gKF8uc2xpZGVDb3VudCAlIF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbCAhPT0gMCk7XG4gICAgICAgIGluZGV4T2Zmc2V0ID0gdW5ldmVuT2Zmc2V0ID8gMCA6IChfLnNsaWRlQ291bnQgLSBfLmN1cnJlbnRTbGlkZSkgJSBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGw7XG5cbiAgICAgICAgc3dpdGNoIChldmVudC5kYXRhLm1lc3NhZ2UpIHtcblxuICAgICAgICAgICAgY2FzZSAncHJldmlvdXMnOlxuICAgICAgICAgICAgICAgIHNsaWRlT2Zmc2V0ID0gaW5kZXhPZmZzZXQgPT09IDAgPyBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGwgOiBfLm9wdGlvbnMuc2xpZGVzVG9TaG93IC0gaW5kZXhPZmZzZXQ7XG4gICAgICAgICAgICAgICAgaWYgKF8uc2xpZGVDb3VudCA+IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpIHtcbiAgICAgICAgICAgICAgICAgICAgXy5zbGlkZUhhbmRsZXIoXy5jdXJyZW50U2xpZGUgLSBzbGlkZU9mZnNldCwgZmFsc2UsIGRvbnRBbmltYXRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ25leHQnOlxuICAgICAgICAgICAgICAgIHNsaWRlT2Zmc2V0ID0gaW5kZXhPZmZzZXQgPT09IDAgPyBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGwgOiBpbmRleE9mZnNldDtcbiAgICAgICAgICAgICAgICBpZiAoXy5zbGlkZUNvdW50ID4gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuICAgICAgICAgICAgICAgICAgICBfLnNsaWRlSGFuZGxlcihfLmN1cnJlbnRTbGlkZSArIHNsaWRlT2Zmc2V0LCBmYWxzZSwgZG9udEFuaW1hdGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnaW5kZXgnOlxuICAgICAgICAgICAgICAgIHZhciBpbmRleCA9IGV2ZW50LmRhdGEuaW5kZXggPT09IDAgPyAwIDpcbiAgICAgICAgICAgICAgICAgICAgZXZlbnQuZGF0YS5pbmRleCB8fCAkdGFyZ2V0LmluZGV4KCkgKiBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGw7XG5cbiAgICAgICAgICAgICAgICBfLnNsaWRlSGFuZGxlcihfLmNoZWNrTmF2aWdhYmxlKGluZGV4KSwgZmFsc2UsIGRvbnRBbmltYXRlKTtcbiAgICAgICAgICAgICAgICAkdGFyZ2V0LmNoaWxkcmVuKCkudHJpZ2dlcignZm9jdXMnKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuY2hlY2tOYXZpZ2FibGUgPSBmdW5jdGlvbihpbmRleCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcyxcbiAgICAgICAgICAgIG5hdmlnYWJsZXMsIHByZXZOYXZpZ2FibGU7XG5cbiAgICAgICAgbmF2aWdhYmxlcyA9IF8uZ2V0TmF2aWdhYmxlSW5kZXhlcygpO1xuICAgICAgICBwcmV2TmF2aWdhYmxlID0gMDtcbiAgICAgICAgaWYgKGluZGV4ID4gbmF2aWdhYmxlc1tuYXZpZ2FibGVzLmxlbmd0aCAtIDFdKSB7XG4gICAgICAgICAgICBpbmRleCA9IG5hdmlnYWJsZXNbbmF2aWdhYmxlcy5sZW5ndGggLSAxXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZvciAodmFyIG4gaW4gbmF2aWdhYmxlcykge1xuICAgICAgICAgICAgICAgIGlmIChpbmRleCA8IG5hdmlnYWJsZXNbbl0pIHtcbiAgICAgICAgICAgICAgICAgICAgaW5kZXggPSBwcmV2TmF2aWdhYmxlO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcHJldk5hdmlnYWJsZSA9IG5hdmlnYWJsZXNbbl07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5kZXg7XG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5jbGVhblVwRXZlbnRzID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuZG90cyAmJiBfLiRkb3RzICE9PSBudWxsKSB7XG5cbiAgICAgICAgICAgICQoJ2xpJywgXy4kZG90cylcbiAgICAgICAgICAgICAgICAub2ZmKCdjbGljay5zbGljaycsIF8uY2hhbmdlU2xpZGUpXG4gICAgICAgICAgICAgICAgLm9mZignbW91c2VlbnRlci5zbGljaycsICQucHJveHkoXy5pbnRlcnJ1cHQsIF8sIHRydWUpKVxuICAgICAgICAgICAgICAgIC5vZmYoJ21vdXNlbGVhdmUuc2xpY2snLCAkLnByb3h5KF8uaW50ZXJydXB0LCBfLCBmYWxzZSkpO1xuXG4gICAgICAgICAgICBpZiAoXy5vcHRpb25zLmFjY2Vzc2liaWxpdHkgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBfLiRkb3RzLm9mZigna2V5ZG93bi5zbGljaycsIF8ua2V5SGFuZGxlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBfLiRzbGlkZXIub2ZmKCdmb2N1cy5zbGljayBibHVyLnNsaWNrJyk7XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5hcnJvd3MgPT09IHRydWUgJiYgXy5zbGlkZUNvdW50ID4gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuICAgICAgICAgICAgXy4kcHJldkFycm93ICYmIF8uJHByZXZBcnJvdy5vZmYoJ2NsaWNrLnNsaWNrJywgXy5jaGFuZ2VTbGlkZSk7XG4gICAgICAgICAgICBfLiRuZXh0QXJyb3cgJiYgXy4kbmV4dEFycm93Lm9mZignY2xpY2suc2xpY2snLCBfLmNoYW5nZVNsaWRlKTtcblxuICAgICAgICAgICAgaWYgKF8ub3B0aW9ucy5hY2Nlc3NpYmlsaXR5ID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgXy4kcHJldkFycm93ICYmIF8uJHByZXZBcnJvdy5vZmYoJ2tleWRvd24uc2xpY2snLCBfLmtleUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIF8uJG5leHRBcnJvdyAmJiBfLiRuZXh0QXJyb3cub2ZmKCdrZXlkb3duLnNsaWNrJywgXy5rZXlIYW5kbGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIF8uJGxpc3Qub2ZmKCd0b3VjaHN0YXJ0LnNsaWNrIG1vdXNlZG93bi5zbGljaycsIF8uc3dpcGVIYW5kbGVyKTtcbiAgICAgICAgXy4kbGlzdC5vZmYoJ3RvdWNobW92ZS5zbGljayBtb3VzZW1vdmUuc2xpY2snLCBfLnN3aXBlSGFuZGxlcik7XG4gICAgICAgIF8uJGxpc3Qub2ZmKCd0b3VjaGVuZC5zbGljayBtb3VzZXVwLnNsaWNrJywgXy5zd2lwZUhhbmRsZXIpO1xuICAgICAgICBfLiRsaXN0Lm9mZigndG91Y2hjYW5jZWwuc2xpY2sgbW91c2VsZWF2ZS5zbGljaycsIF8uc3dpcGVIYW5kbGVyKTtcblxuICAgICAgICBfLiRsaXN0Lm9mZignY2xpY2suc2xpY2snLCBfLmNsaWNrSGFuZGxlcik7XG5cbiAgICAgICAgJChkb2N1bWVudCkub2ZmKF8udmlzaWJpbGl0eUNoYW5nZSwgXy52aXNpYmlsaXR5KTtcblxuICAgICAgICBfLmNsZWFuVXBTbGlkZUV2ZW50cygpO1xuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuYWNjZXNzaWJpbGl0eSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgXy4kbGlzdC5vZmYoJ2tleWRvd24uc2xpY2snLCBfLmtleUhhbmRsZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5mb2N1c09uU2VsZWN0ID09PSB0cnVlKSB7XG4gICAgICAgICAgICAkKF8uJHNsaWRlVHJhY2spLmNoaWxkcmVuKCkub2ZmKCdjbGljay5zbGljaycsIF8uc2VsZWN0SGFuZGxlcik7XG4gICAgICAgIH1cblxuICAgICAgICAkKHdpbmRvdykub2ZmKCdvcmllbnRhdGlvbmNoYW5nZS5zbGljay5zbGljay0nICsgXy5pbnN0YW5jZVVpZCwgXy5vcmllbnRhdGlvbkNoYW5nZSk7XG5cbiAgICAgICAgJCh3aW5kb3cpLm9mZigncmVzaXplLnNsaWNrLnNsaWNrLScgKyBfLmluc3RhbmNlVWlkLCBfLnJlc2l6ZSk7XG5cbiAgICAgICAgJCgnW2RyYWdnYWJsZSE9dHJ1ZV0nLCBfLiRzbGlkZVRyYWNrKS5vZmYoJ2RyYWdzdGFydCcsIF8ucHJldmVudERlZmF1bHQpO1xuXG4gICAgICAgICQod2luZG93KS5vZmYoJ2xvYWQuc2xpY2suc2xpY2stJyArIF8uaW5zdGFuY2VVaWQsIF8uc2V0UG9zaXRpb24pO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5jbGVhblVwU2xpZGVFdmVudHMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgXy4kbGlzdC5vZmYoJ21vdXNlZW50ZXIuc2xpY2snLCAkLnByb3h5KF8uaW50ZXJydXB0LCBfLCB0cnVlKSk7XG4gICAgICAgIF8uJGxpc3Qub2ZmKCdtb3VzZWxlYXZlLnNsaWNrJywgJC5wcm94eShfLmludGVycnVwdCwgXywgZmFsc2UpKTtcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuY2xlYW5VcFJvd3MgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXMsIG9yaWdpbmFsU2xpZGVzO1xuXG4gICAgICAgIGlmKF8ub3B0aW9ucy5yb3dzID4gMCkge1xuICAgICAgICAgICAgb3JpZ2luYWxTbGlkZXMgPSBfLiRzbGlkZXMuY2hpbGRyZW4oKS5jaGlsZHJlbigpO1xuICAgICAgICAgICAgb3JpZ2luYWxTbGlkZXMucmVtb3ZlQXR0cignc3R5bGUnKTtcbiAgICAgICAgICAgIF8uJHNsaWRlci5lbXB0eSgpLmFwcGVuZChvcmlnaW5hbFNsaWRlcyk7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuY2xpY2tIYW5kbGVyID0gZnVuY3Rpb24oZXZlbnQpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgaWYgKF8uc2hvdWxkQ2xpY2sgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBldmVudC5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24ocmVmcmVzaCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBfLmF1dG9QbGF5Q2xlYXIoKTtcblxuICAgICAgICBfLnRvdWNoT2JqZWN0ID0ge307XG5cbiAgICAgICAgXy5jbGVhblVwRXZlbnRzKCk7XG5cbiAgICAgICAgJCgnLnNsaWNrLWNsb25lZCcsIF8uJHNsaWRlcikuZGV0YWNoKCk7XG5cbiAgICAgICAgaWYgKF8uJGRvdHMpIHtcbiAgICAgICAgICAgIF8uJGRvdHMucmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIF8uJHByZXZBcnJvdyAmJiBfLiRwcmV2QXJyb3cubGVuZ3RoICkge1xuXG4gICAgICAgICAgICBfLiRwcmV2QXJyb3dcbiAgICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoJ3NsaWNrLWRpc2FibGVkIHNsaWNrLWFycm93IHNsaWNrLWhpZGRlbicpXG4gICAgICAgICAgICAgICAgLnJlbW92ZUF0dHIoJ2FyaWEtaGlkZGVuIGFyaWEtZGlzYWJsZWQgdGFiaW5kZXgnKVxuICAgICAgICAgICAgICAgIC5jc3MoJ2Rpc3BsYXknLCcnKTtcblxuICAgICAgICAgICAgaWYgKCBfLmh0bWxFeHByLnRlc3QoIF8ub3B0aW9ucy5wcmV2QXJyb3cgKSkge1xuICAgICAgICAgICAgICAgIF8uJHByZXZBcnJvdy5yZW1vdmUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggXy4kbmV4dEFycm93ICYmIF8uJG5leHRBcnJvdy5sZW5ndGggKSB7XG5cbiAgICAgICAgICAgIF8uJG5leHRBcnJvd1xuICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnc2xpY2stZGlzYWJsZWQgc2xpY2stYXJyb3cgc2xpY2staGlkZGVuJylcbiAgICAgICAgICAgICAgICAucmVtb3ZlQXR0cignYXJpYS1oaWRkZW4gYXJpYS1kaXNhYmxlZCB0YWJpbmRleCcpXG4gICAgICAgICAgICAgICAgLmNzcygnZGlzcGxheScsJycpO1xuXG4gICAgICAgICAgICBpZiAoIF8uaHRtbEV4cHIudGVzdCggXy5vcHRpb25zLm5leHRBcnJvdyApKSB7XG4gICAgICAgICAgICAgICAgXy4kbmV4dEFycm93LnJlbW92ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBpZiAoXy4kc2xpZGVzKSB7XG5cbiAgICAgICAgICAgIF8uJHNsaWRlc1xuICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnc2xpY2stc2xpZGUgc2xpY2stYWN0aXZlIHNsaWNrLWNlbnRlciBzbGljay12aXNpYmxlIHNsaWNrLWN1cnJlbnQnKVxuICAgICAgICAgICAgICAgIC5yZW1vdmVBdHRyKCdhcmlhLWhpZGRlbicpXG4gICAgICAgICAgICAgICAgLnJlbW92ZUF0dHIoJ2RhdGEtc2xpY2staW5kZXgnKVxuICAgICAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcykuYXR0cignc3R5bGUnLCAkKHRoaXMpLmRhdGEoJ29yaWdpbmFsU3R5bGluZycpKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgXy4kc2xpZGVUcmFjay5jaGlsZHJlbih0aGlzLm9wdGlvbnMuc2xpZGUpLmRldGFjaCgpO1xuXG4gICAgICAgICAgICBfLiRzbGlkZVRyYWNrLmRldGFjaCgpO1xuXG4gICAgICAgICAgICBfLiRsaXN0LmRldGFjaCgpO1xuXG4gICAgICAgICAgICBfLiRzbGlkZXIuYXBwZW5kKF8uJHNsaWRlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBfLmNsZWFuVXBSb3dzKCk7XG5cbiAgICAgICAgXy4kc2xpZGVyLnJlbW92ZUNsYXNzKCdzbGljay1zbGlkZXInKTtcbiAgICAgICAgXy4kc2xpZGVyLnJlbW92ZUNsYXNzKCdzbGljay1pbml0aWFsaXplZCcpO1xuICAgICAgICBfLiRzbGlkZXIucmVtb3ZlQ2xhc3MoJ3NsaWNrLWRvdHRlZCcpO1xuXG4gICAgICAgIF8udW5zbGlja2VkID0gdHJ1ZTtcblxuICAgICAgICBpZighcmVmcmVzaCkge1xuICAgICAgICAgICAgXy4kc2xpZGVyLnRyaWdnZXIoJ2Rlc3Ryb3knLCBbX10pO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmRpc2FibGVUcmFuc2l0aW9uID0gZnVuY3Rpb24oc2xpZGUpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXMsXG4gICAgICAgICAgICB0cmFuc2l0aW9uID0ge307XG5cbiAgICAgICAgdHJhbnNpdGlvbltfLnRyYW5zaXRpb25UeXBlXSA9ICcnO1xuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuZmFkZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIF8uJHNsaWRlVHJhY2suY3NzKHRyYW5zaXRpb24pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgXy4kc2xpZGVzLmVxKHNsaWRlKS5jc3ModHJhbnNpdGlvbik7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuZmFkZVNsaWRlID0gZnVuY3Rpb24oc2xpZGVJbmRleCwgY2FsbGJhY2spIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgaWYgKF8uY3NzVHJhbnNpdGlvbnMgPT09IGZhbHNlKSB7XG5cbiAgICAgICAgICAgIF8uJHNsaWRlcy5lcShzbGlkZUluZGV4KS5jc3Moe1xuICAgICAgICAgICAgICAgIHpJbmRleDogXy5vcHRpb25zLnpJbmRleFxuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIF8uJHNsaWRlcy5lcShzbGlkZUluZGV4KS5hbmltYXRlKHtcbiAgICAgICAgICAgICAgICBvcGFjaXR5OiAxXG4gICAgICAgICAgICB9LCBfLm9wdGlvbnMuc3BlZWQsIF8ub3B0aW9ucy5lYXNpbmcsIGNhbGxiYWNrKTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBfLmFwcGx5VHJhbnNpdGlvbihzbGlkZUluZGV4KTtcblxuICAgICAgICAgICAgXy4kc2xpZGVzLmVxKHNsaWRlSW5kZXgpLmNzcyh7XG4gICAgICAgICAgICAgICAgb3BhY2l0eTogMSxcbiAgICAgICAgICAgICAgICB6SW5kZXg6IF8ub3B0aW9ucy56SW5kZXhcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICAgICAgICAgIF8uZGlzYWJsZVRyYW5zaXRpb24oc2xpZGVJbmRleCk7XG5cbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbCgpO1xuICAgICAgICAgICAgICAgIH0sIF8ub3B0aW9ucy5zcGVlZCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5mYWRlU2xpZGVPdXQgPSBmdW5jdGlvbihzbGlkZUluZGV4KSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIGlmIChfLmNzc1RyYW5zaXRpb25zID09PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBfLiRzbGlkZXMuZXEoc2xpZGVJbmRleCkuYW5pbWF0ZSh7XG4gICAgICAgICAgICAgICAgb3BhY2l0eTogMCxcbiAgICAgICAgICAgICAgICB6SW5kZXg6IF8ub3B0aW9ucy56SW5kZXggLSAyXG4gICAgICAgICAgICB9LCBfLm9wdGlvbnMuc3BlZWQsIF8ub3B0aW9ucy5lYXNpbmcpO1xuXG4gICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgIF8uYXBwbHlUcmFuc2l0aW9uKHNsaWRlSW5kZXgpO1xuXG4gICAgICAgICAgICBfLiRzbGlkZXMuZXEoc2xpZGVJbmRleCkuY3NzKHtcbiAgICAgICAgICAgICAgICBvcGFjaXR5OiAwLFxuICAgICAgICAgICAgICAgIHpJbmRleDogXy5vcHRpb25zLnpJbmRleCAtIDJcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuZmlsdGVyU2xpZGVzID0gU2xpY2sucHJvdG90eXBlLnNsaWNrRmlsdGVyID0gZnVuY3Rpb24oZmlsdGVyKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIGlmIChmaWx0ZXIgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgXy4kc2xpZGVzQ2FjaGUgPSBfLiRzbGlkZXM7XG5cbiAgICAgICAgICAgIF8udW5sb2FkKCk7XG5cbiAgICAgICAgICAgIF8uJHNsaWRlVHJhY2suY2hpbGRyZW4odGhpcy5vcHRpb25zLnNsaWRlKS5kZXRhY2goKTtcblxuICAgICAgICAgICAgXy4kc2xpZGVzQ2FjaGUuZmlsdGVyKGZpbHRlcikuYXBwZW5kVG8oXy4kc2xpZGVUcmFjayk7XG5cbiAgICAgICAgICAgIF8ucmVpbml0KCk7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5mb2N1c0hhbmRsZXIgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgXy4kc2xpZGVyXG4gICAgICAgICAgICAub2ZmKCdmb2N1cy5zbGljayBibHVyLnNsaWNrJylcbiAgICAgICAgICAgIC5vbignZm9jdXMuc2xpY2sgYmx1ci5zbGljaycsICcqJywgZnVuY3Rpb24oZXZlbnQpIHtcblxuICAgICAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICB2YXIgJHNmID0gJCh0aGlzKTtcblxuICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgIGlmKCBfLm9wdGlvbnMucGF1c2VPbkZvY3VzICkge1xuICAgICAgICAgICAgICAgICAgICBfLmZvY3Vzc2VkID0gJHNmLmlzKCc6Zm9jdXMnKTtcbiAgICAgICAgICAgICAgICAgICAgXy5hdXRvUGxheSgpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfSwgMCk7XG5cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5nZXRDdXJyZW50ID0gU2xpY2sucHJvdG90eXBlLnNsaWNrQ3VycmVudFNsaWRlID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuICAgICAgICByZXR1cm4gXy5jdXJyZW50U2xpZGU7XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmdldERvdENvdW50ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIHZhciBicmVha1BvaW50ID0gMDtcbiAgICAgICAgdmFyIGNvdW50ZXIgPSAwO1xuICAgICAgICB2YXIgcGFnZXJRdHkgPSAwO1xuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuaW5maW5pdGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIGlmIChfLnNsaWRlQ291bnQgPD0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuICAgICAgICAgICAgICAgICArK3BhZ2VyUXR5O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB3aGlsZSAoYnJlYWtQb2ludCA8IF8uc2xpZGVDb3VudCkge1xuICAgICAgICAgICAgICAgICAgICArK3BhZ2VyUXR5O1xuICAgICAgICAgICAgICAgICAgICBicmVha1BvaW50ID0gY291bnRlciArIF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbDtcbiAgICAgICAgICAgICAgICAgICAgY291bnRlciArPSBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGwgPD0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdyA/IF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbCA6IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3c7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKF8ub3B0aW9ucy5jZW50ZXJNb2RlID09PSB0cnVlKSB7XG4gICAgICAgICAgICBwYWdlclF0eSA9IF8uc2xpZGVDb3VudDtcbiAgICAgICAgfSBlbHNlIGlmKCFfLm9wdGlvbnMuYXNOYXZGb3IpIHtcbiAgICAgICAgICAgIHBhZ2VyUXR5ID0gMSArIE1hdGguY2VpbCgoXy5zbGlkZUNvdW50IC0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykgLyBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGwpO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICB3aGlsZSAoYnJlYWtQb2ludCA8IF8uc2xpZGVDb3VudCkge1xuICAgICAgICAgICAgICAgICsrcGFnZXJRdHk7XG4gICAgICAgICAgICAgICAgYnJlYWtQb2ludCA9IGNvdW50ZXIgKyBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGw7XG4gICAgICAgICAgICAgICAgY291bnRlciArPSBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGwgPD0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdyA/IF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbCA6IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3c7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcGFnZXJRdHkgLSAxO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5nZXRMZWZ0ID0gZnVuY3Rpb24oc2xpZGVJbmRleCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcyxcbiAgICAgICAgICAgIHRhcmdldExlZnQsXG4gICAgICAgICAgICB2ZXJ0aWNhbEhlaWdodCxcbiAgICAgICAgICAgIHZlcnRpY2FsT2Zmc2V0ID0gMCxcbiAgICAgICAgICAgIHRhcmdldFNsaWRlLFxuICAgICAgICAgICAgY29lZjtcblxuICAgICAgICBfLnNsaWRlT2Zmc2V0ID0gMDtcbiAgICAgICAgdmVydGljYWxIZWlnaHQgPSBfLiRzbGlkZXMuZmlyc3QoKS5vdXRlckhlaWdodCh0cnVlKTtcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmluZmluaXRlID09PSB0cnVlKSB7XG4gICAgICAgICAgICBpZiAoXy5zbGlkZUNvdW50ID4gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuICAgICAgICAgICAgICAgIF8uc2xpZGVPZmZzZXQgPSAoXy5zbGlkZVdpZHRoICogXy5vcHRpb25zLnNsaWRlc1RvU2hvdykgKiAtMTtcbiAgICAgICAgICAgICAgICBjb2VmID0gLTFcblxuICAgICAgICAgICAgICAgIGlmIChfLm9wdGlvbnMudmVydGljYWwgPT09IHRydWUgJiYgXy5vcHRpb25zLmNlbnRlck1vZGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgPT09IDIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZWYgPSAtMS41O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvZWYgPSAtMlxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHZlcnRpY2FsT2Zmc2V0ID0gKHZlcnRpY2FsSGVpZ2h0ICogXy5vcHRpb25zLnNsaWRlc1RvU2hvdykgKiBjb2VmO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKF8uc2xpZGVDb3VudCAlIF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbCAhPT0gMCkge1xuICAgICAgICAgICAgICAgIGlmIChzbGlkZUluZGV4ICsgXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsID4gXy5zbGlkZUNvdW50ICYmIF8uc2xpZGVDb3VudCA+IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNsaWRlSW5kZXggPiBfLnNsaWRlQ291bnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8uc2xpZGVPZmZzZXQgPSAoKF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgLSAoc2xpZGVJbmRleCAtIF8uc2xpZGVDb3VudCkpICogXy5zbGlkZVdpZHRoKSAqIC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmVydGljYWxPZmZzZXQgPSAoKF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgLSAoc2xpZGVJbmRleCAtIF8uc2xpZGVDb3VudCkpICogdmVydGljYWxIZWlnaHQpICogLTE7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLnNsaWRlT2Zmc2V0ID0gKChfLnNsaWRlQ291bnQgJSBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGwpICogXy5zbGlkZVdpZHRoKSAqIC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgdmVydGljYWxPZmZzZXQgPSAoKF8uc2xpZGVDb3VudCAlIF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbCkgKiB2ZXJ0aWNhbEhlaWdodCkgKiAtMTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChzbGlkZUluZGV4ICsgXy5vcHRpb25zLnNsaWRlc1RvU2hvdyA+IF8uc2xpZGVDb3VudCkge1xuICAgICAgICAgICAgICAgIF8uc2xpZGVPZmZzZXQgPSAoKHNsaWRlSW5kZXggKyBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSAtIF8uc2xpZGVDb3VudCkgKiBfLnNsaWRlV2lkdGg7XG4gICAgICAgICAgICAgICAgdmVydGljYWxPZmZzZXQgPSAoKHNsaWRlSW5kZXggKyBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSAtIF8uc2xpZGVDb3VudCkgKiB2ZXJ0aWNhbEhlaWdodDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfLnNsaWRlQ291bnQgPD0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuICAgICAgICAgICAgXy5zbGlkZU9mZnNldCA9IDA7XG4gICAgICAgICAgICB2ZXJ0aWNhbE9mZnNldCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5vcHRpb25zLmNlbnRlck1vZGUgPT09IHRydWUgJiYgXy5zbGlkZUNvdW50IDw9IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpIHtcbiAgICAgICAgICAgIF8uc2xpZGVPZmZzZXQgPSAoKF8uc2xpZGVXaWR0aCAqIE1hdGguZmxvb3IoXy5vcHRpb25zLnNsaWRlc1RvU2hvdykpIC8gMikgLSAoKF8uc2xpZGVXaWR0aCAqIF8uc2xpZGVDb3VudCkgLyAyKTtcbiAgICAgICAgfSBlbHNlIGlmIChfLm9wdGlvbnMuY2VudGVyTW9kZSA9PT0gdHJ1ZSAmJiBfLm9wdGlvbnMuaW5maW5pdGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIF8uc2xpZGVPZmZzZXQgKz0gXy5zbGlkZVdpZHRoICogTWF0aC5mbG9vcihfLm9wdGlvbnMuc2xpZGVzVG9TaG93IC8gMikgLSBfLnNsaWRlV2lkdGg7XG4gICAgICAgIH0gZWxzZSBpZiAoXy5vcHRpb25zLmNlbnRlck1vZGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIF8uc2xpZGVPZmZzZXQgPSAwO1xuICAgICAgICAgICAgXy5zbGlkZU9mZnNldCArPSBfLnNsaWRlV2lkdGggKiBNYXRoLmZsb29yKF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgLyAyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfLm9wdGlvbnMudmVydGljYWwgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICB0YXJnZXRMZWZ0ID0gKChzbGlkZUluZGV4ICogXy5zbGlkZVdpZHRoKSAqIC0xKSArIF8uc2xpZGVPZmZzZXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0YXJnZXRMZWZ0ID0gKChzbGlkZUluZGV4ICogdmVydGljYWxIZWlnaHQpICogLTEpICsgdmVydGljYWxPZmZzZXQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5vcHRpb25zLnZhcmlhYmxlV2lkdGggPT09IHRydWUpIHtcblxuICAgICAgICAgICAgaWYgKF8uc2xpZGVDb3VudCA8PSBfLm9wdGlvbnMuc2xpZGVzVG9TaG93IHx8IF8ub3B0aW9ucy5pbmZpbml0ZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRTbGlkZSA9IF8uJHNsaWRlVHJhY2suY2hpbGRyZW4oJy5zbGljay1zbGlkZScpLmVxKHNsaWRlSW5kZXgpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRTbGlkZSA9IF8uJHNsaWRlVHJhY2suY2hpbGRyZW4oJy5zbGljay1zbGlkZScpLmVxKHNsaWRlSW5kZXggKyBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKF8ub3B0aW9ucy5ydGwgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0U2xpZGVbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0TGVmdCA9IChfLiRzbGlkZVRyYWNrLndpZHRoKCkgLSB0YXJnZXRTbGlkZVswXS5vZmZzZXRMZWZ0IC0gdGFyZ2V0U2xpZGUud2lkdGgoKSkgKiAtMTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRMZWZ0ID0gIDA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRMZWZ0ID0gdGFyZ2V0U2xpZGVbMF0gPyB0YXJnZXRTbGlkZVswXS5vZmZzZXRMZWZ0ICogLTEgOiAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoXy5vcHRpb25zLmNlbnRlck1vZGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBpZiAoXy5zbGlkZUNvdW50IDw9IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgfHwgXy5vcHRpb25zLmluZmluaXRlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRTbGlkZSA9IF8uJHNsaWRlVHJhY2suY2hpbGRyZW4oJy5zbGljay1zbGlkZScpLmVxKHNsaWRlSW5kZXgpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFNsaWRlID0gXy4kc2xpZGVUcmFjay5jaGlsZHJlbignLnNsaWNrLXNsaWRlJykuZXEoc2xpZGVJbmRleCArIF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgKyAxKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAoXy5vcHRpb25zLnJ0bCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0U2xpZGVbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldExlZnQgPSAoXy4kc2xpZGVUcmFjay53aWR0aCgpIC0gdGFyZ2V0U2xpZGVbMF0ub2Zmc2V0TGVmdCAtIHRhcmdldFNsaWRlLndpZHRoKCkpICogLTE7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRMZWZ0ID0gIDA7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0YXJnZXRMZWZ0ID0gdGFyZ2V0U2xpZGVbMF0gPyB0YXJnZXRTbGlkZVswXS5vZmZzZXRMZWZ0ICogLTEgOiAwO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRhcmdldExlZnQgKz0gKF8uJGxpc3Qud2lkdGgoKSAtIHRhcmdldFNsaWRlLm91dGVyV2lkdGgoKSkgLyAyO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRhcmdldExlZnQ7XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmdldE9wdGlvbiA9IFNsaWNrLnByb3RvdHlwZS5zbGlja0dldE9wdGlvbiA9IGZ1bmN0aW9uKG9wdGlvbikge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICByZXR1cm4gXy5vcHRpb25zW29wdGlvbl07XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmdldE5hdmlnYWJsZUluZGV4ZXMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXMsXG4gICAgICAgICAgICBicmVha1BvaW50ID0gMCxcbiAgICAgICAgICAgIGNvdW50ZXIgPSAwLFxuICAgICAgICAgICAgaW5kZXhlcyA9IFtdLFxuICAgICAgICAgICAgbWF4O1xuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuaW5maW5pdGUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBtYXggPSBfLnNsaWRlQ291bnQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBicmVha1BvaW50ID0gXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsICogLTE7XG4gICAgICAgICAgICBjb3VudGVyID0gXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsICogLTE7XG4gICAgICAgICAgICBtYXggPSBfLnNsaWRlQ291bnQgKiAyO1xuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGJyZWFrUG9pbnQgPCBtYXgpIHtcbiAgICAgICAgICAgIGluZGV4ZXMucHVzaChicmVha1BvaW50KTtcbiAgICAgICAgICAgIGJyZWFrUG9pbnQgPSBjb3VudGVyICsgXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsO1xuICAgICAgICAgICAgY291bnRlciArPSBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGwgPD0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdyA/IF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbCA6IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3c7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gaW5kZXhlcztcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuZ2V0U2xpY2sgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICByZXR1cm4gdGhpcztcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuZ2V0U2xpZGVDb3VudCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcyxcbiAgICAgICAgICAgIHNsaWRlc1RyYXZlcnNlZCwgc3dpcGVkU2xpZGUsIGNlbnRlck9mZnNldDtcblxuICAgICAgICBjZW50ZXJPZmZzZXQgPSBfLm9wdGlvbnMuY2VudGVyTW9kZSA9PT0gdHJ1ZSA/IF8uc2xpZGVXaWR0aCAqIE1hdGguZmxvb3IoXy5vcHRpb25zLnNsaWRlc1RvU2hvdyAvIDIpIDogMDtcblxuICAgICAgICBpZiAoXy5vcHRpb25zLnN3aXBlVG9TbGlkZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgXy4kc2xpZGVUcmFjay5maW5kKCcuc2xpY2stc2xpZGUnKS5lYWNoKGZ1bmN0aW9uKGluZGV4LCBzbGlkZSkge1xuICAgICAgICAgICAgICAgIGlmIChzbGlkZS5vZmZzZXRMZWZ0IC0gY2VudGVyT2Zmc2V0ICsgKCQoc2xpZGUpLm91dGVyV2lkdGgoKSAvIDIpID4gKF8uc3dpcGVMZWZ0ICogLTEpKSB7XG4gICAgICAgICAgICAgICAgICAgIHN3aXBlZFNsaWRlID0gc2xpZGU7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgc2xpZGVzVHJhdmVyc2VkID0gTWF0aC5hYnMoJChzd2lwZWRTbGlkZSkuYXR0cignZGF0YS1zbGljay1pbmRleCcpIC0gXy5jdXJyZW50U2xpZGUpIHx8IDE7XG5cbiAgICAgICAgICAgIHJldHVybiBzbGlkZXNUcmF2ZXJzZWQ7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGw7XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuZ29UbyA9IFNsaWNrLnByb3RvdHlwZS5zbGlja0dvVG8gPSBmdW5jdGlvbihzbGlkZSwgZG9udEFuaW1hdGUpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgXy5jaGFuZ2VTbGlkZSh7XG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ2luZGV4JyxcbiAgICAgICAgICAgICAgICBpbmRleDogcGFyc2VJbnQoc2xpZGUpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIGRvbnRBbmltYXRlKTtcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uKGNyZWF0aW9uKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIGlmICghJChfLiRzbGlkZXIpLmhhc0NsYXNzKCdzbGljay1pbml0aWFsaXplZCcpKSB7XG5cbiAgICAgICAgICAgICQoXy4kc2xpZGVyKS5hZGRDbGFzcygnc2xpY2staW5pdGlhbGl6ZWQnKTtcblxuICAgICAgICAgICAgXy5idWlsZFJvd3MoKTtcbiAgICAgICAgICAgIF8uYnVpbGRPdXQoKTtcbiAgICAgICAgICAgIF8uc2V0UHJvcHMoKTtcbiAgICAgICAgICAgIF8uc3RhcnRMb2FkKCk7XG4gICAgICAgICAgICBfLmxvYWRTbGlkZXIoKTtcbiAgICAgICAgICAgIF8uaW5pdGlhbGl6ZUV2ZW50cygpO1xuICAgICAgICAgICAgXy51cGRhdGVBcnJvd3MoKTtcbiAgICAgICAgICAgIF8udXBkYXRlRG90cygpO1xuICAgICAgICAgICAgXy5jaGVja1Jlc3BvbnNpdmUodHJ1ZSk7XG4gICAgICAgICAgICBfLmZvY3VzSGFuZGxlcigpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY3JlYXRpb24pIHtcbiAgICAgICAgICAgIF8uJHNsaWRlci50cmlnZ2VyKCdpbml0JywgW19dKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuYWNjZXNzaWJpbGl0eSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgXy5pbml0QURBKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIF8ub3B0aW9ucy5hdXRvcGxheSApIHtcblxuICAgICAgICAgICAgXy5wYXVzZWQgPSBmYWxzZTtcbiAgICAgICAgICAgIF8uYXV0b1BsYXkoKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmluaXRBREEgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgICAgIG51bURvdEdyb3VwcyA9IE1hdGguY2VpbChfLnNsaWRlQ291bnQgLyBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSxcbiAgICAgICAgICAgICAgICB0YWJDb250cm9sSW5kZXhlcyA9IF8uZ2V0TmF2aWdhYmxlSW5kZXhlcygpLmZpbHRlcihmdW5jdGlvbih2YWwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICh2YWwgPj0gMCkgJiYgKHZhbCA8IF8uc2xpZGVDb3VudCk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgXy4kc2xpZGVzLmFkZChfLiRzbGlkZVRyYWNrLmZpbmQoJy5zbGljay1jbG9uZWQnKSkuYXR0cih7XG4gICAgICAgICAgICAnYXJpYS1oaWRkZW4nOiAndHJ1ZScsXG4gICAgICAgICAgICAndGFiaW5kZXgnOiAnLTEnXG4gICAgICAgIH0pLmZpbmQoJ2EsIGlucHV0LCBidXR0b24sIHNlbGVjdCcpLmF0dHIoe1xuICAgICAgICAgICAgJ3RhYmluZGV4JzogJy0xJ1xuICAgICAgICB9KTtcblxuICAgICAgICBpZiAoXy4kZG90cyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgXy4kc2xpZGVzLm5vdChfLiRzbGlkZVRyYWNrLmZpbmQoJy5zbGljay1jbG9uZWQnKSkuZWFjaChmdW5jdGlvbihpKSB7XG4gICAgICAgICAgICAgICAgdmFyIHNsaWRlQ29udHJvbEluZGV4ID0gdGFiQ29udHJvbEluZGV4ZXMuaW5kZXhPZihpKTtcblxuICAgICAgICAgICAgICAgICQodGhpcykuYXR0cih7XG4gICAgICAgICAgICAgICAgICAgICdyb2xlJzogJ3RhYnBhbmVsJyxcbiAgICAgICAgICAgICAgICAgICAgJ2lkJzogJ3NsaWNrLXNsaWRlJyArIF8uaW5zdGFuY2VVaWQgKyBpLFxuICAgICAgICAgICAgICAgICAgICAndGFiaW5kZXgnOiAtMVxuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYgKHNsaWRlQ29udHJvbEluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgIHZhciBhcmlhQnV0dG9uQ29udHJvbCA9ICdzbGljay1zbGlkZS1jb250cm9sJyArIF8uaW5zdGFuY2VVaWQgKyBzbGlkZUNvbnRyb2xJbmRleFxuICAgICAgICAgICAgICAgICAgIGlmICgkKCcjJyArIGFyaWFCdXR0b25Db250cm9sKS5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgICQodGhpcykuYXR0cih7XG4gICAgICAgICAgICAgICAgICAgICAgICAgJ2FyaWEtZGVzY3JpYmVkYnknOiBhcmlhQnV0dG9uQ29udHJvbFxuICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBfLiRkb3RzLmF0dHIoJ3JvbGUnLCAndGFibGlzdCcpLmZpbmQoJ2xpJykuZWFjaChmdW5jdGlvbihpKSB7XG4gICAgICAgICAgICAgICAgdmFyIG1hcHBlZFNsaWRlSW5kZXggPSB0YWJDb250cm9sSW5kZXhlc1tpXTtcblxuICAgICAgICAgICAgICAgICQodGhpcykuYXR0cih7XG4gICAgICAgICAgICAgICAgICAgICdyb2xlJzogJ3ByZXNlbnRhdGlvbidcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgICAgICQodGhpcykuZmluZCgnYnV0dG9uJykuZmlyc3QoKS5hdHRyKHtcbiAgICAgICAgICAgICAgICAgICAgJ3JvbGUnOiAndGFiJyxcbiAgICAgICAgICAgICAgICAgICAgJ2lkJzogJ3NsaWNrLXNsaWRlLWNvbnRyb2wnICsgXy5pbnN0YW5jZVVpZCArIGksXG4gICAgICAgICAgICAgICAgICAgICdhcmlhLWNvbnRyb2xzJzogJ3NsaWNrLXNsaWRlJyArIF8uaW5zdGFuY2VVaWQgKyBtYXBwZWRTbGlkZUluZGV4LFxuICAgICAgICAgICAgICAgICAgICAnYXJpYS1sYWJlbCc6IChpICsgMSkgKyAnIG9mICcgKyBudW1Eb3RHcm91cHMsXG4gICAgICAgICAgICAgICAgICAgICdhcmlhLXNlbGVjdGVkJzogbnVsbCxcbiAgICAgICAgICAgICAgICAgICAgJ3RhYmluZGV4JzogJy0xJ1xuICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICB9KS5lcShfLmN1cnJlbnRTbGlkZSkuZmluZCgnYnV0dG9uJykuYXR0cih7XG4gICAgICAgICAgICAgICAgJ2FyaWEtc2VsZWN0ZWQnOiAndHJ1ZScsXG4gICAgICAgICAgICAgICAgJ3RhYmluZGV4JzogJzAnXG4gICAgICAgICAgICB9KS5lbmQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGk9Xy5jdXJyZW50U2xpZGUsIG1heD1pK18ub3B0aW9ucy5zbGlkZXNUb1Nob3c7IGkgPCBtYXg7IGkrKykge1xuICAgICAgICAgIGlmIChfLm9wdGlvbnMuZm9jdXNPbkNoYW5nZSkge1xuICAgICAgICAgICAgXy4kc2xpZGVzLmVxKGkpLmF0dHIoeyd0YWJpbmRleCc6ICcwJ30pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfLiRzbGlkZXMuZXEoaSkucmVtb3ZlQXR0cigndGFiaW5kZXgnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBfLmFjdGl2YXRlQURBKCk7XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmluaXRBcnJvd0V2ZW50cyA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmFycm93cyA9PT0gdHJ1ZSAmJiBfLnNsaWRlQ291bnQgPiBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSB7XG4gICAgICAgICAgICBfLiRwcmV2QXJyb3dcbiAgICAgICAgICAgICAgIC5vZmYoJ2NsaWNrLnNsaWNrJylcbiAgICAgICAgICAgICAgIC5vbignY2xpY2suc2xpY2snLCB7XG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdwcmV2aW91cydcbiAgICAgICAgICAgICAgIH0sIF8uY2hhbmdlU2xpZGUpO1xuICAgICAgICAgICAgXy4kbmV4dEFycm93XG4gICAgICAgICAgICAgICAub2ZmKCdjbGljay5zbGljaycpXG4gICAgICAgICAgICAgICAub24oJ2NsaWNrLnNsaWNrJywge1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnbmV4dCdcbiAgICAgICAgICAgICAgIH0sIF8uY2hhbmdlU2xpZGUpO1xuXG4gICAgICAgICAgICBpZiAoXy5vcHRpb25zLmFjY2Vzc2liaWxpdHkgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBfLiRwcmV2QXJyb3cub24oJ2tleWRvd24uc2xpY2snLCBfLmtleUhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIF8uJG5leHRBcnJvdy5vbigna2V5ZG93bi5zbGljaycsIF8ua2V5SGFuZGxlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuaW5pdERvdEV2ZW50cyA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmRvdHMgPT09IHRydWUgJiYgXy5zbGlkZUNvdW50ID4gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuICAgICAgICAgICAgJCgnbGknLCBfLiRkb3RzKS5vbignY2xpY2suc2xpY2snLCB7XG4gICAgICAgICAgICAgICAgbWVzc2FnZTogJ2luZGV4J1xuICAgICAgICAgICAgfSwgXy5jaGFuZ2VTbGlkZSk7XG5cbiAgICAgICAgICAgIGlmIChfLm9wdGlvbnMuYWNjZXNzaWJpbGl0eSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIF8uJGRvdHMub24oJ2tleWRvd24uc2xpY2snLCBfLmtleUhhbmRsZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5kb3RzID09PSB0cnVlICYmIF8ub3B0aW9ucy5wYXVzZU9uRG90c0hvdmVyID09PSB0cnVlICYmIF8uc2xpZGVDb3VudCA+IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpIHtcblxuICAgICAgICAgICAgJCgnbGknLCBfLiRkb3RzKVxuICAgICAgICAgICAgICAgIC5vbignbW91c2VlbnRlci5zbGljaycsICQucHJveHkoXy5pbnRlcnJ1cHQsIF8sIHRydWUpKVxuICAgICAgICAgICAgICAgIC5vbignbW91c2VsZWF2ZS5zbGljaycsICQucHJveHkoXy5pbnRlcnJ1cHQsIF8sIGZhbHNlKSk7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5pbml0U2xpZGVFdmVudHMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgaWYgKCBfLm9wdGlvbnMucGF1c2VPbkhvdmVyICkge1xuXG4gICAgICAgICAgICBfLiRsaXN0Lm9uKCdtb3VzZWVudGVyLnNsaWNrJywgJC5wcm94eShfLmludGVycnVwdCwgXywgdHJ1ZSkpO1xuICAgICAgICAgICAgXy4kbGlzdC5vbignbW91c2VsZWF2ZS5zbGljaycsICQucHJveHkoXy5pbnRlcnJ1cHQsIF8sIGZhbHNlKSk7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5pbml0aWFsaXplRXZlbnRzID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIF8uaW5pdEFycm93RXZlbnRzKCk7XG5cbiAgICAgICAgXy5pbml0RG90RXZlbnRzKCk7XG4gICAgICAgIF8uaW5pdFNsaWRlRXZlbnRzKCk7XG5cbiAgICAgICAgXy4kbGlzdC5vbigndG91Y2hzdGFydC5zbGljayBtb3VzZWRvd24uc2xpY2snLCB7XG4gICAgICAgICAgICBhY3Rpb246ICdzdGFydCdcbiAgICAgICAgfSwgXy5zd2lwZUhhbmRsZXIpO1xuICAgICAgICBfLiRsaXN0Lm9uKCd0b3VjaG1vdmUuc2xpY2sgbW91c2Vtb3ZlLnNsaWNrJywge1xuICAgICAgICAgICAgYWN0aW9uOiAnbW92ZSdcbiAgICAgICAgfSwgXy5zd2lwZUhhbmRsZXIpO1xuICAgICAgICBfLiRsaXN0Lm9uKCd0b3VjaGVuZC5zbGljayBtb3VzZXVwLnNsaWNrJywge1xuICAgICAgICAgICAgYWN0aW9uOiAnZW5kJ1xuICAgICAgICB9LCBfLnN3aXBlSGFuZGxlcik7XG4gICAgICAgIF8uJGxpc3Qub24oJ3RvdWNoY2FuY2VsLnNsaWNrIG1vdXNlbGVhdmUuc2xpY2snLCB7XG4gICAgICAgICAgICBhY3Rpb246ICdlbmQnXG4gICAgICAgIH0sIF8uc3dpcGVIYW5kbGVyKTtcblxuICAgICAgICBfLiRsaXN0Lm9uKCdjbGljay5zbGljaycsIF8uY2xpY2tIYW5kbGVyKTtcblxuICAgICAgICAkKGRvY3VtZW50KS5vbihfLnZpc2liaWxpdHlDaGFuZ2UsICQucHJveHkoXy52aXNpYmlsaXR5LCBfKSk7XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5hY2Nlc3NpYmlsaXR5ID09PSB0cnVlKSB7XG4gICAgICAgICAgICBfLiRsaXN0Lm9uKCdrZXlkb3duLnNsaWNrJywgXy5rZXlIYW5kbGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuZm9jdXNPblNlbGVjdCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgJChfLiRzbGlkZVRyYWNrKS5jaGlsZHJlbigpLm9uKCdjbGljay5zbGljaycsIF8uc2VsZWN0SGFuZGxlcik7XG4gICAgICAgIH1cblxuICAgICAgICAkKHdpbmRvdykub24oJ29yaWVudGF0aW9uY2hhbmdlLnNsaWNrLnNsaWNrLScgKyBfLmluc3RhbmNlVWlkLCAkLnByb3h5KF8ub3JpZW50YXRpb25DaGFuZ2UsIF8pKTtcblxuICAgICAgICAkKHdpbmRvdykub24oJ3Jlc2l6ZS5zbGljay5zbGljay0nICsgXy5pbnN0YW5jZVVpZCwgJC5wcm94eShfLnJlc2l6ZSwgXykpO1xuXG4gICAgICAgICQoJ1tkcmFnZ2FibGUhPXRydWVdJywgXy4kc2xpZGVUcmFjaykub24oJ2RyYWdzdGFydCcsIF8ucHJldmVudERlZmF1bHQpO1xuXG4gICAgICAgICQod2luZG93KS5vbignbG9hZC5zbGljay5zbGljay0nICsgXy5pbnN0YW5jZVVpZCwgXy5zZXRQb3NpdGlvbik7XG4gICAgICAgICQoXy5zZXRQb3NpdGlvbik7XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmluaXRVSSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmFycm93cyA9PT0gdHJ1ZSAmJiBfLnNsaWRlQ291bnQgPiBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSB7XG5cbiAgICAgICAgICAgIF8uJHByZXZBcnJvdy5zaG93KCk7XG4gICAgICAgICAgICBfLiRuZXh0QXJyb3cuc2hvdygpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5vcHRpb25zLmRvdHMgPT09IHRydWUgJiYgXy5zbGlkZUNvdW50ID4gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuXG4gICAgICAgICAgICBfLiRkb3RzLnNob3coKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmtleUhhbmRsZXIgPSBmdW5jdGlvbihldmVudCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcbiAgICAgICAgIC8vRG9udCBzbGlkZSBpZiB0aGUgY3Vyc29yIGlzIGluc2lkZSB0aGUgZm9ybSBmaWVsZHMgYW5kIGFycm93IGtleXMgYXJlIHByZXNzZWRcbiAgICAgICAgaWYoIWV2ZW50LnRhcmdldC50YWdOYW1lLm1hdGNoKCdURVhUQVJFQXxJTlBVVHxTRUxFQ1QnKSkge1xuICAgICAgICAgICAgaWYgKGV2ZW50LmtleUNvZGUgPT09IDM3ICYmIF8ub3B0aW9ucy5hY2Nlc3NpYmlsaXR5ID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgXy5jaGFuZ2VTbGlkZSh7XG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IF8ub3B0aW9ucy5ydGwgPT09IHRydWUgPyAnbmV4dCcgOiAgJ3ByZXZpb3VzJ1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGV2ZW50LmtleUNvZGUgPT09IDM5ICYmIF8ub3B0aW9ucy5hY2Nlc3NpYmlsaXR5ID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgXy5jaGFuZ2VTbGlkZSh7XG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6IF8ub3B0aW9ucy5ydGwgPT09IHRydWUgPyAncHJldmlvdXMnIDogJ25leHQnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5sYXp5TG9hZCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcyxcbiAgICAgICAgICAgIGxvYWRSYW5nZSwgY2xvbmVSYW5nZSwgcmFuZ2VTdGFydCwgcmFuZ2VFbmQ7XG5cbiAgICAgICAgZnVuY3Rpb24gbG9hZEltYWdlcyhpbWFnZXNTY29wZSkge1xuXG4gICAgICAgICAgICAkKCdpbWdbZGF0YS1sYXp5XScsIGltYWdlc1Njb3BlKS5lYWNoKGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICAgICAgdmFyIGltYWdlID0gJCh0aGlzKSxcbiAgICAgICAgICAgICAgICAgICAgaW1hZ2VTb3VyY2UgPSAkKHRoaXMpLmF0dHIoJ2RhdGEtbGF6eScpLFxuICAgICAgICAgICAgICAgICAgICBpbWFnZVNyY1NldCA9ICQodGhpcykuYXR0cignZGF0YS1zcmNzZXQnKSxcbiAgICAgICAgICAgICAgICAgICAgaW1hZ2VTaXplcyAgPSAkKHRoaXMpLmF0dHIoJ2RhdGEtc2l6ZXMnKSB8fCBfLiRzbGlkZXIuYXR0cignZGF0YS1zaXplcycpLFxuICAgICAgICAgICAgICAgICAgICBpbWFnZVRvTG9hZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuXG4gICAgICAgICAgICAgICAgaW1hZ2VUb0xvYWQub25sb2FkID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaW1hZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hbmltYXRlKHsgb3BhY2l0eTogMCB9LCAxMDAsIGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGltYWdlU3JjU2V0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGltYWdlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignc3Jjc2V0JywgaW1hZ2VTcmNTZXQgKTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoaW1hZ2VTaXplcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1hZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignc2l6ZXMnLCBpbWFnZVNpemVzICk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbWFnZVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignc3JjJywgaW1hZ2VTb3VyY2UpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5hbmltYXRlKHsgb3BhY2l0eTogMSB9LCAyMDAsIGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1hZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVtb3ZlQXR0cignZGF0YS1sYXp5IGRhdGEtc3Jjc2V0IGRhdGEtc2l6ZXMnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnc2xpY2stbG9hZGluZycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLiRzbGlkZXIudHJpZ2dlcignbGF6eUxvYWRlZCcsIFtfLCBpbWFnZSwgaW1hZ2VTb3VyY2VdKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICAgIGltYWdlVG9Mb2FkLm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgICAgICBpbWFnZVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlbW92ZUF0dHIoICdkYXRhLWxhenknIClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcyggJ3NsaWNrLWxvYWRpbmcnIClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRDbGFzcyggJ3NsaWNrLWxhenlsb2FkLWVycm9yJyApO1xuXG4gICAgICAgICAgICAgICAgICAgIF8uJHNsaWRlci50cmlnZ2VyKCdsYXp5TG9hZEVycm9yJywgWyBfLCBpbWFnZSwgaW1hZ2VTb3VyY2UgXSk7XG5cbiAgICAgICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICAgICAgaW1hZ2VUb0xvYWQuc3JjID0gaW1hZ2VTb3VyY2U7XG5cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5vcHRpb25zLmNlbnRlck1vZGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIGlmIChfLm9wdGlvbnMuaW5maW5pdGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICByYW5nZVN0YXJ0ID0gXy5jdXJyZW50U2xpZGUgKyAoXy5vcHRpb25zLnNsaWRlc1RvU2hvdyAvIDIgKyAxKTtcbiAgICAgICAgICAgICAgICByYW5nZUVuZCA9IHJhbmdlU3RhcnQgKyBfLm9wdGlvbnMuc2xpZGVzVG9TaG93ICsgMjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmFuZ2VTdGFydCA9IE1hdGgubWF4KDAsIF8uY3VycmVudFNsaWRlIC0gKF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgLyAyICsgMSkpO1xuICAgICAgICAgICAgICAgIHJhbmdlRW5kID0gMiArIChfLm9wdGlvbnMuc2xpZGVzVG9TaG93IC8gMiArIDEpICsgXy5jdXJyZW50U2xpZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByYW5nZVN0YXJ0ID0gXy5vcHRpb25zLmluZmluaXRlID8gXy5vcHRpb25zLnNsaWRlc1RvU2hvdyArIF8uY3VycmVudFNsaWRlIDogXy5jdXJyZW50U2xpZGU7XG4gICAgICAgICAgICByYW5nZUVuZCA9IE1hdGguY2VpbChyYW5nZVN0YXJ0ICsgXy5vcHRpb25zLnNsaWRlc1RvU2hvdyk7XG4gICAgICAgICAgICBpZiAoXy5vcHRpb25zLmZhZGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBpZiAocmFuZ2VTdGFydCA+IDApIHJhbmdlU3RhcnQtLTtcbiAgICAgICAgICAgICAgICBpZiAocmFuZ2VFbmQgPD0gXy5zbGlkZUNvdW50KSByYW5nZUVuZCsrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgbG9hZFJhbmdlID0gXy4kc2xpZGVyLmZpbmQoJy5zbGljay1zbGlkZScpLnNsaWNlKHJhbmdlU3RhcnQsIHJhbmdlRW5kKTtcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmxhenlMb2FkID09PSAnYW50aWNpcGF0ZWQnKSB7XG4gICAgICAgICAgICB2YXIgcHJldlNsaWRlID0gcmFuZ2VTdGFydCAtIDEsXG4gICAgICAgICAgICAgICAgbmV4dFNsaWRlID0gcmFuZ2VFbmQsXG4gICAgICAgICAgICAgICAgJHNsaWRlcyA9IF8uJHNsaWRlci5maW5kKCcuc2xpY2stc2xpZGUnKTtcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGw7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmIChwcmV2U2xpZGUgPCAwKSBwcmV2U2xpZGUgPSBfLnNsaWRlQ291bnQgLSAxO1xuICAgICAgICAgICAgICAgIGxvYWRSYW5nZSA9IGxvYWRSYW5nZS5hZGQoJHNsaWRlcy5lcShwcmV2U2xpZGUpKTtcbiAgICAgICAgICAgICAgICBsb2FkUmFuZ2UgPSBsb2FkUmFuZ2UuYWRkKCRzbGlkZXMuZXEobmV4dFNsaWRlKSk7XG4gICAgICAgICAgICAgICAgcHJldlNsaWRlLS07XG4gICAgICAgICAgICAgICAgbmV4dFNsaWRlKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsb2FkSW1hZ2VzKGxvYWRSYW5nZSk7XG5cbiAgICAgICAgaWYgKF8uc2xpZGVDb3VudCA8PSBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSB7XG4gICAgICAgICAgICBjbG9uZVJhbmdlID0gXy4kc2xpZGVyLmZpbmQoJy5zbGljay1zbGlkZScpO1xuICAgICAgICAgICAgbG9hZEltYWdlcyhjbG9uZVJhbmdlKTtcbiAgICAgICAgfSBlbHNlXG4gICAgICAgIGlmIChfLmN1cnJlbnRTbGlkZSA+PSBfLnNsaWRlQ291bnQgLSBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSB7XG4gICAgICAgICAgICBjbG9uZVJhbmdlID0gXy4kc2xpZGVyLmZpbmQoJy5zbGljay1jbG9uZWQnKS5zbGljZSgwLCBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KTtcbiAgICAgICAgICAgIGxvYWRJbWFnZXMoY2xvbmVSYW5nZSk7XG4gICAgICAgIH0gZWxzZSBpZiAoXy5jdXJyZW50U2xpZGUgPT09IDApIHtcbiAgICAgICAgICAgIGNsb25lUmFuZ2UgPSBfLiRzbGlkZXIuZmluZCgnLnNsaWNrLWNsb25lZCcpLnNsaWNlKF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgKiAtMSk7XG4gICAgICAgICAgICBsb2FkSW1hZ2VzKGNsb25lUmFuZ2UpO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmxvYWRTbGlkZXIgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgXy5zZXRQb3NpdGlvbigpO1xuXG4gICAgICAgIF8uJHNsaWRlVHJhY2suY3NzKHtcbiAgICAgICAgICAgIG9wYWNpdHk6IDFcbiAgICAgICAgfSk7XG5cbiAgICAgICAgXy4kc2xpZGVyLnJlbW92ZUNsYXNzKCdzbGljay1sb2FkaW5nJyk7XG5cbiAgICAgICAgXy5pbml0VUkoKTtcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmxhenlMb2FkID09PSAncHJvZ3Jlc3NpdmUnKSB7XG4gICAgICAgICAgICBfLnByb2dyZXNzaXZlTGF6eUxvYWQoKTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5uZXh0ID0gU2xpY2sucHJvdG90eXBlLnNsaWNrTmV4dCA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBfLmNoYW5nZVNsaWRlKHtcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAnbmV4dCdcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLm9yaWVudGF0aW9uQ2hhbmdlID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIF8uY2hlY2tSZXNwb25zaXZlKCk7XG4gICAgICAgIF8uc2V0UG9zaXRpb24oKTtcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUucGF1c2UgPSBTbGljay5wcm90b3R5cGUuc2xpY2tQYXVzZSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBfLmF1dG9QbGF5Q2xlYXIoKTtcbiAgICAgICAgXy5wYXVzZWQgPSB0cnVlO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5wbGF5ID0gU2xpY2sucHJvdG90eXBlLnNsaWNrUGxheSA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBfLmF1dG9QbGF5KCk7XG4gICAgICAgIF8ub3B0aW9ucy5hdXRvcGxheSA9IHRydWU7XG4gICAgICAgIF8ucGF1c2VkID0gZmFsc2U7XG4gICAgICAgIF8uZm9jdXNzZWQgPSBmYWxzZTtcbiAgICAgICAgXy5pbnRlcnJ1cHRlZCA9IGZhbHNlO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5wb3N0U2xpZGUgPSBmdW5jdGlvbihpbmRleCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBpZiggIV8udW5zbGlja2VkICkge1xuXG4gICAgICAgICAgICBfLiRzbGlkZXIudHJpZ2dlcignYWZ0ZXJDaGFuZ2UnLCBbXywgaW5kZXhdKTtcblxuICAgICAgICAgICAgXy5hbmltYXRpbmcgPSBmYWxzZTtcblxuICAgICAgICAgICAgaWYgKF8uc2xpZGVDb3VudCA+IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpIHtcbiAgICAgICAgICAgICAgICBfLnNldFBvc2l0aW9uKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF8uc3dpcGVMZWZ0ID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKCBfLm9wdGlvbnMuYXV0b3BsYXkgKSB7XG4gICAgICAgICAgICAgICAgXy5hdXRvUGxheSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoXy5vcHRpb25zLmFjY2Vzc2liaWxpdHkgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBfLmluaXRBREEoKTtcblxuICAgICAgICAgICAgICAgIGlmIChfLm9wdGlvbnMuZm9jdXNPbkNoYW5nZSkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgJGN1cnJlbnRTbGlkZSA9ICQoXy4kc2xpZGVzLmdldChfLmN1cnJlbnRTbGlkZSkpO1xuICAgICAgICAgICAgICAgICAgICAkY3VycmVudFNsaWRlLmF0dHIoJ3RhYmluZGV4JywgMCkuZm9jdXMoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5wcmV2ID0gU2xpY2sucHJvdG90eXBlLnNsaWNrUHJldiA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBfLmNoYW5nZVNsaWRlKHtcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlOiAncHJldmlvdXMnXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5wcmV2ZW50RGVmYXVsdCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUucHJvZ3Jlc3NpdmVMYXp5TG9hZCA9IGZ1bmN0aW9uKCB0cnlDb3VudCApIHtcblxuICAgICAgICB0cnlDb3VudCA9IHRyeUNvdW50IHx8IDE7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgJGltZ3NUb0xvYWQgPSAkKCAnaW1nW2RhdGEtbGF6eV0nLCBfLiRzbGlkZXIgKSxcbiAgICAgICAgICAgIGltYWdlLFxuICAgICAgICAgICAgaW1hZ2VTb3VyY2UsXG4gICAgICAgICAgICBpbWFnZVNyY1NldCxcbiAgICAgICAgICAgIGltYWdlU2l6ZXMsXG4gICAgICAgICAgICBpbWFnZVRvTG9hZDtcblxuICAgICAgICBpZiAoICRpbWdzVG9Mb2FkLmxlbmd0aCApIHtcblxuICAgICAgICAgICAgaW1hZ2UgPSAkaW1nc1RvTG9hZC5maXJzdCgpO1xuICAgICAgICAgICAgaW1hZ2VTb3VyY2UgPSBpbWFnZS5hdHRyKCdkYXRhLWxhenknKTtcbiAgICAgICAgICAgIGltYWdlU3JjU2V0ID0gaW1hZ2UuYXR0cignZGF0YS1zcmNzZXQnKTtcbiAgICAgICAgICAgIGltYWdlU2l6ZXMgID0gaW1hZ2UuYXR0cignZGF0YS1zaXplcycpIHx8IF8uJHNsaWRlci5hdHRyKCdkYXRhLXNpemVzJyk7XG4gICAgICAgICAgICBpbWFnZVRvTG9hZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuXG4gICAgICAgICAgICBpbWFnZVRvTG9hZC5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICAgICAgICAgIGlmIChpbWFnZVNyY1NldCkge1xuICAgICAgICAgICAgICAgICAgICBpbWFnZVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3NyY3NldCcsIGltYWdlU3JjU2V0ICk7XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKGltYWdlU2l6ZXMpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGltYWdlXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ3NpemVzJywgaW1hZ2VTaXplcyApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaW1hZ2VcbiAgICAgICAgICAgICAgICAgICAgLmF0dHIoICdzcmMnLCBpbWFnZVNvdXJjZSApXG4gICAgICAgICAgICAgICAgICAgIC5yZW1vdmVBdHRyKCdkYXRhLWxhenkgZGF0YS1zcmNzZXQgZGF0YS1zaXplcycpXG4gICAgICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnc2xpY2stbG9hZGluZycpO1xuXG4gICAgICAgICAgICAgICAgaWYgKCBfLm9wdGlvbnMuYWRhcHRpdmVIZWlnaHQgPT09IHRydWUgKSB7XG4gICAgICAgICAgICAgICAgICAgIF8uc2V0UG9zaXRpb24oKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBfLiRzbGlkZXIudHJpZ2dlcignbGF6eUxvYWRlZCcsIFsgXywgaW1hZ2UsIGltYWdlU291cmNlIF0pO1xuICAgICAgICAgICAgICAgIF8ucHJvZ3Jlc3NpdmVMYXp5TG9hZCgpO1xuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpbWFnZVRvTG9hZC5vbmVycm9yID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoIHRyeUNvdW50IDwgMyApIHtcblxuICAgICAgICAgICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAgICAgICAgICogdHJ5IHRvIGxvYWQgdGhlIGltYWdlIDMgdGltZXMsXG4gICAgICAgICAgICAgICAgICAgICAqIGxlYXZlIGEgc2xpZ2h0IGRlbGF5IHNvIHdlIGRvbid0IGdldFxuICAgICAgICAgICAgICAgICAgICAgKiBzZXJ2ZXJzIGJsb2NraW5nIHRoZSByZXF1ZXN0LlxuICAgICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCggZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLnByb2dyZXNzaXZlTGF6eUxvYWQoIHRyeUNvdW50ICsgMSApO1xuICAgICAgICAgICAgICAgICAgICB9LCA1MDAgKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICAgICAgaW1hZ2VcbiAgICAgICAgICAgICAgICAgICAgICAgIC5yZW1vdmVBdHRyKCAnZGF0YS1sYXp5JyApXG4gICAgICAgICAgICAgICAgICAgICAgICAucmVtb3ZlQ2xhc3MoICdzbGljay1sb2FkaW5nJyApXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoICdzbGljay1sYXp5bG9hZC1lcnJvcicgKTtcblxuICAgICAgICAgICAgICAgICAgICBfLiRzbGlkZXIudHJpZ2dlcignbGF6eUxvYWRFcnJvcicsIFsgXywgaW1hZ2UsIGltYWdlU291cmNlIF0pO1xuXG4gICAgICAgICAgICAgICAgICAgIF8ucHJvZ3Jlc3NpdmVMYXp5TG9hZCgpO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpbWFnZVRvTG9hZC5zcmMgPSBpbWFnZVNvdXJjZTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBfLiRzbGlkZXIudHJpZ2dlcignYWxsSW1hZ2VzTG9hZGVkJywgWyBfIF0pO1xuXG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUucmVmcmVzaCA9IGZ1bmN0aW9uKCBpbml0aWFsaXppbmcgKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLCBjdXJyZW50U2xpZGUsIGxhc3RWaXNpYmxlSW5kZXg7XG5cbiAgICAgICAgbGFzdFZpc2libGVJbmRleCA9IF8uc2xpZGVDb3VudCAtIF8ub3B0aW9ucy5zbGlkZXNUb1Nob3c7XG5cbiAgICAgICAgLy8gaW4gbm9uLWluZmluaXRlIHNsaWRlcnMsIHdlIGRvbid0IHdhbnQgdG8gZ28gcGFzdCB0aGVcbiAgICAgICAgLy8gbGFzdCB2aXNpYmxlIGluZGV4LlxuICAgICAgICBpZiggIV8ub3B0aW9ucy5pbmZpbml0ZSAmJiAoIF8uY3VycmVudFNsaWRlID4gbGFzdFZpc2libGVJbmRleCApKSB7XG4gICAgICAgICAgICBfLmN1cnJlbnRTbGlkZSA9IGxhc3RWaXNpYmxlSW5kZXg7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBsZXNzIHNsaWRlcyB0aGFuIHRvIHNob3csIGdvIHRvIHN0YXJ0LlxuICAgICAgICBpZiAoIF8uc2xpZGVDb3VudCA8PSBfLm9wdGlvbnMuc2xpZGVzVG9TaG93ICkge1xuICAgICAgICAgICAgXy5jdXJyZW50U2xpZGUgPSAwO1xuXG4gICAgICAgIH1cblxuICAgICAgICBjdXJyZW50U2xpZGUgPSBfLmN1cnJlbnRTbGlkZTtcblxuICAgICAgICBfLmRlc3Ryb3kodHJ1ZSk7XG5cbiAgICAgICAgJC5leHRlbmQoXywgXy5pbml0aWFscywgeyBjdXJyZW50U2xpZGU6IGN1cnJlbnRTbGlkZSB9KTtcblxuICAgICAgICBfLmluaXQoKTtcblxuICAgICAgICBpZiggIWluaXRpYWxpemluZyApIHtcblxuICAgICAgICAgICAgXy5jaGFuZ2VTbGlkZSh7XG4gICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBtZXNzYWdlOiAnaW5kZXgnLFxuICAgICAgICAgICAgICAgICAgICBpbmRleDogY3VycmVudFNsaWRlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSwgZmFsc2UpO1xuXG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUucmVnaXN0ZXJCcmVha3BvaW50cyA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcywgYnJlYWtwb2ludCwgY3VycmVudEJyZWFrcG9pbnQsIGwsXG4gICAgICAgICAgICByZXNwb25zaXZlU2V0dGluZ3MgPSBfLm9wdGlvbnMucmVzcG9uc2l2ZSB8fCBudWxsO1xuXG4gICAgICAgIGlmICggJC50eXBlKHJlc3BvbnNpdmVTZXR0aW5ncykgPT09ICdhcnJheScgJiYgcmVzcG9uc2l2ZVNldHRpbmdzLmxlbmd0aCApIHtcblxuICAgICAgICAgICAgXy5yZXNwb25kVG8gPSBfLm9wdGlvbnMucmVzcG9uZFRvIHx8ICd3aW5kb3cnO1xuXG4gICAgICAgICAgICBmb3IgKCBicmVha3BvaW50IGluIHJlc3BvbnNpdmVTZXR0aW5ncyApIHtcblxuICAgICAgICAgICAgICAgIGwgPSBfLmJyZWFrcG9pbnRzLmxlbmd0aC0xO1xuXG4gICAgICAgICAgICAgICAgaWYgKHJlc3BvbnNpdmVTZXR0aW5ncy5oYXNPd25Qcm9wZXJ0eShicmVha3BvaW50KSkge1xuICAgICAgICAgICAgICAgICAgICBjdXJyZW50QnJlYWtwb2ludCA9IHJlc3BvbnNpdmVTZXR0aW5nc1ticmVha3BvaW50XS5icmVha3BvaW50O1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGxvb3AgdGhyb3VnaCB0aGUgYnJlYWtwb2ludHMgYW5kIGN1dCBvdXQgYW55IGV4aXN0aW5nXG4gICAgICAgICAgICAgICAgICAgIC8vIG9uZXMgd2l0aCB0aGUgc2FtZSBicmVha3BvaW50IG51bWJlciwgd2UgZG9uJ3Qgd2FudCBkdXBlcy5cbiAgICAgICAgICAgICAgICAgICAgd2hpbGUoIGwgPj0gMCApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCBfLmJyZWFrcG9pbnRzW2xdICYmIF8uYnJlYWtwb2ludHNbbF0gPT09IGN1cnJlbnRCcmVha3BvaW50ICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uYnJlYWtwb2ludHMuc3BsaWNlKGwsMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBsLS07XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBfLmJyZWFrcG9pbnRzLnB1c2goY3VycmVudEJyZWFrcG9pbnQpO1xuICAgICAgICAgICAgICAgICAgICBfLmJyZWFrcG9pbnRTZXR0aW5nc1tjdXJyZW50QnJlYWtwb2ludF0gPSByZXNwb25zaXZlU2V0dGluZ3NbYnJlYWtwb2ludF0uc2V0dGluZ3M7XG5cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgXy5icmVha3BvaW50cy5zb3J0KGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKCBfLm9wdGlvbnMubW9iaWxlRmlyc3QgKSA/IGEtYiA6IGItYTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1cblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUucmVpbml0ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIF8uJHNsaWRlcyA9XG4gICAgICAgICAgICBfLiRzbGlkZVRyYWNrXG4gICAgICAgICAgICAgICAgLmNoaWxkcmVuKF8ub3B0aW9ucy5zbGlkZSlcbiAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoJ3NsaWNrLXNsaWRlJyk7XG5cbiAgICAgICAgXy5zbGlkZUNvdW50ID0gXy4kc2xpZGVzLmxlbmd0aDtcblxuICAgICAgICBpZiAoXy5jdXJyZW50U2xpZGUgPj0gXy5zbGlkZUNvdW50ICYmIF8uY3VycmVudFNsaWRlICE9PSAwKSB7XG4gICAgICAgICAgICBfLmN1cnJlbnRTbGlkZSA9IF8uY3VycmVudFNsaWRlIC0gXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF8uc2xpZGVDb3VudCA8PSBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSB7XG4gICAgICAgICAgICBfLmN1cnJlbnRTbGlkZSA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBfLnJlZ2lzdGVyQnJlYWtwb2ludHMoKTtcblxuICAgICAgICBfLnNldFByb3BzKCk7XG4gICAgICAgIF8uc2V0dXBJbmZpbml0ZSgpO1xuICAgICAgICBfLmJ1aWxkQXJyb3dzKCk7XG4gICAgICAgIF8udXBkYXRlQXJyb3dzKCk7XG4gICAgICAgIF8uaW5pdEFycm93RXZlbnRzKCk7XG4gICAgICAgIF8uYnVpbGREb3RzKCk7XG4gICAgICAgIF8udXBkYXRlRG90cygpO1xuICAgICAgICBfLmluaXREb3RFdmVudHMoKTtcbiAgICAgICAgXy5jbGVhblVwU2xpZGVFdmVudHMoKTtcbiAgICAgICAgXy5pbml0U2xpZGVFdmVudHMoKTtcblxuICAgICAgICBfLmNoZWNrUmVzcG9uc2l2ZShmYWxzZSwgdHJ1ZSk7XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5mb2N1c09uU2VsZWN0ID09PSB0cnVlKSB7XG4gICAgICAgICAgICAkKF8uJHNsaWRlVHJhY2spLmNoaWxkcmVuKCkub24oJ2NsaWNrLnNsaWNrJywgXy5zZWxlY3RIYW5kbGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF8uc2V0U2xpZGVDbGFzc2VzKHR5cGVvZiBfLmN1cnJlbnRTbGlkZSA9PT0gJ251bWJlcicgPyBfLmN1cnJlbnRTbGlkZSA6IDApO1xuXG4gICAgICAgIF8uc2V0UG9zaXRpb24oKTtcbiAgICAgICAgXy5mb2N1c0hhbmRsZXIoKTtcblxuICAgICAgICBfLnBhdXNlZCA9ICFfLm9wdGlvbnMuYXV0b3BsYXk7XG4gICAgICAgIF8uYXV0b1BsYXkoKTtcblxuICAgICAgICBfLiRzbGlkZXIudHJpZ2dlcigncmVJbml0JywgW19dKTtcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUucmVzaXplID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIGlmICgkKHdpbmRvdykud2lkdGgoKSAhPT0gXy53aW5kb3dXaWR0aCkge1xuICAgICAgICAgICAgY2xlYXJUaW1lb3V0KF8ud2luZG93RGVsYXkpO1xuICAgICAgICAgICAgXy53aW5kb3dEZWxheSA9IHdpbmRvdy5zZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIF8ud2luZG93V2lkdGggPSAkKHdpbmRvdykud2lkdGgoKTtcbiAgICAgICAgICAgICAgICBfLmNoZWNrUmVzcG9uc2l2ZSgpO1xuICAgICAgICAgICAgICAgIGlmKCAhXy51bnNsaWNrZWQgKSB7IF8uc2V0UG9zaXRpb24oKTsgfVxuICAgICAgICAgICAgfSwgNTApO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5yZW1vdmVTbGlkZSA9IFNsaWNrLnByb3RvdHlwZS5zbGlja1JlbW92ZSA9IGZ1bmN0aW9uKGluZGV4LCByZW1vdmVCZWZvcmUsIHJlbW92ZUFsbCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBpZiAodHlwZW9mKGluZGV4KSA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICByZW1vdmVCZWZvcmUgPSBpbmRleDtcbiAgICAgICAgICAgIGluZGV4ID0gcmVtb3ZlQmVmb3JlID09PSB0cnVlID8gMCA6IF8uc2xpZGVDb3VudCAtIDE7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbmRleCA9IHJlbW92ZUJlZm9yZSA9PT0gdHJ1ZSA/IC0taW5kZXggOiBpbmRleDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfLnNsaWRlQ291bnQgPCAxIHx8IGluZGV4IDwgMCB8fCBpbmRleCA+IF8uc2xpZGVDb3VudCAtIDEpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIF8udW5sb2FkKCk7XG5cbiAgICAgICAgaWYgKHJlbW92ZUFsbCA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgXy4kc2xpZGVUcmFjay5jaGlsZHJlbigpLnJlbW92ZSgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgXy4kc2xpZGVUcmFjay5jaGlsZHJlbih0aGlzLm9wdGlvbnMuc2xpZGUpLmVxKGluZGV4KS5yZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF8uJHNsaWRlcyA9IF8uJHNsaWRlVHJhY2suY2hpbGRyZW4odGhpcy5vcHRpb25zLnNsaWRlKTtcblxuICAgICAgICBfLiRzbGlkZVRyYWNrLmNoaWxkcmVuKHRoaXMub3B0aW9ucy5zbGlkZSkuZGV0YWNoKCk7XG5cbiAgICAgICAgXy4kc2xpZGVUcmFjay5hcHBlbmQoXy4kc2xpZGVzKTtcblxuICAgICAgICBfLiRzbGlkZXNDYWNoZSA9IF8uJHNsaWRlcztcblxuICAgICAgICBfLnJlaW5pdCgpO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5zZXRDU1MgPSBmdW5jdGlvbihwb3NpdGlvbikge1xuXG4gICAgICAgIHZhciBfID0gdGhpcyxcbiAgICAgICAgICAgIHBvc2l0aW9uUHJvcHMgPSB7fSxcbiAgICAgICAgICAgIHgsIHk7XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5ydGwgPT09IHRydWUpIHtcbiAgICAgICAgICAgIHBvc2l0aW9uID0gLXBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgICAgIHggPSBfLnBvc2l0aW9uUHJvcCA9PSAnbGVmdCcgPyBNYXRoLmNlaWwocG9zaXRpb24pICsgJ3B4JyA6ICcwcHgnO1xuICAgICAgICB5ID0gXy5wb3NpdGlvblByb3AgPT0gJ3RvcCcgPyBNYXRoLmNlaWwocG9zaXRpb24pICsgJ3B4JyA6ICcwcHgnO1xuXG4gICAgICAgIHBvc2l0aW9uUHJvcHNbXy5wb3NpdGlvblByb3BdID0gcG9zaXRpb247XG5cbiAgICAgICAgaWYgKF8udHJhbnNmb3Jtc0VuYWJsZWQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBfLiRzbGlkZVRyYWNrLmNzcyhwb3NpdGlvblByb3BzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBvc2l0aW9uUHJvcHMgPSB7fTtcbiAgICAgICAgICAgIGlmIChfLmNzc1RyYW5zaXRpb25zID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHBvc2l0aW9uUHJvcHNbXy5hbmltVHlwZV0gPSAndHJhbnNsYXRlKCcgKyB4ICsgJywgJyArIHkgKyAnKSc7XG4gICAgICAgICAgICAgICAgXy4kc2xpZGVUcmFjay5jc3MocG9zaXRpb25Qcm9wcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHBvc2l0aW9uUHJvcHNbXy5hbmltVHlwZV0gPSAndHJhbnNsYXRlM2QoJyArIHggKyAnLCAnICsgeSArICcsIDBweCknO1xuICAgICAgICAgICAgICAgIF8uJHNsaWRlVHJhY2suY3NzKHBvc2l0aW9uUHJvcHMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLnNldERpbWVuc2lvbnMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy52ZXJ0aWNhbCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIGlmIChfLm9wdGlvbnMuY2VudGVyTW9kZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIF8uJGxpc3QuY3NzKHtcbiAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogKCcwcHggJyArIF8ub3B0aW9ucy5jZW50ZXJQYWRkaW5nKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgXy4kbGlzdC5oZWlnaHQoXy4kc2xpZGVzLmZpcnN0KCkub3V0ZXJIZWlnaHQodHJ1ZSkgKiBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KTtcbiAgICAgICAgICAgIGlmIChfLm9wdGlvbnMuY2VudGVyTW9kZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIF8uJGxpc3QuY3NzKHtcbiAgICAgICAgICAgICAgICAgICAgcGFkZGluZzogKF8ub3B0aW9ucy5jZW50ZXJQYWRkaW5nICsgJyAwcHgnKVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgXy5saXN0V2lkdGggPSBfLiRsaXN0LndpZHRoKCk7XG4gICAgICAgIF8ubGlzdEhlaWdodCA9IF8uJGxpc3QuaGVpZ2h0KCk7XG5cblxuICAgICAgICBpZiAoXy5vcHRpb25zLnZlcnRpY2FsID09PSBmYWxzZSAmJiBfLm9wdGlvbnMudmFyaWFibGVXaWR0aCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIF8uc2xpZGVXaWR0aCA9IE1hdGguY2VpbChfLmxpc3RXaWR0aCAvIF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpO1xuICAgICAgICAgICAgXy4kc2xpZGVUcmFjay53aWR0aChNYXRoLmNlaWwoKF8uc2xpZGVXaWR0aCAqIF8uJHNsaWRlVHJhY2suY2hpbGRyZW4oJy5zbGljay1zbGlkZScpLmxlbmd0aCkpKTtcblxuICAgICAgICB9IGVsc2UgaWYgKF8ub3B0aW9ucy52YXJpYWJsZVdpZHRoID09PSB0cnVlKSB7XG4gICAgICAgICAgICBfLiRzbGlkZVRyYWNrLndpZHRoKDUwMDAgKiBfLnNsaWRlQ291bnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgXy5zbGlkZVdpZHRoID0gTWF0aC5jZWlsKF8ubGlzdFdpZHRoKTtcbiAgICAgICAgICAgIF8uJHNsaWRlVHJhY2suaGVpZ2h0KE1hdGguY2VpbCgoXy4kc2xpZGVzLmZpcnN0KCkub3V0ZXJIZWlnaHQodHJ1ZSkgKiBfLiRzbGlkZVRyYWNrLmNoaWxkcmVuKCcuc2xpY2stc2xpZGUnKS5sZW5ndGgpKSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb2Zmc2V0ID0gXy4kc2xpZGVzLmZpcnN0KCkub3V0ZXJXaWR0aCh0cnVlKSAtIF8uJHNsaWRlcy5maXJzdCgpLndpZHRoKCk7XG4gICAgICAgIGlmIChfLm9wdGlvbnMudmFyaWFibGVXaWR0aCA9PT0gZmFsc2UpIF8uJHNsaWRlVHJhY2suY2hpbGRyZW4oJy5zbGljay1zbGlkZScpLndpZHRoKF8uc2xpZGVXaWR0aCAtIG9mZnNldCk7XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLnNldEZhZGUgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXMsXG4gICAgICAgICAgICB0YXJnZXRMZWZ0O1xuXG4gICAgICAgIF8uJHNsaWRlcy5lYWNoKGZ1bmN0aW9uKGluZGV4LCBlbGVtZW50KSB7XG4gICAgICAgICAgICB0YXJnZXRMZWZ0ID0gKF8uc2xpZGVXaWR0aCAqIGluZGV4KSAqIC0xO1xuICAgICAgICAgICAgaWYgKF8ub3B0aW9ucy5ydGwgPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAkKGVsZW1lbnQpLmNzcyh7XG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxuICAgICAgICAgICAgICAgICAgICByaWdodDogdGFyZ2V0TGVmdCxcbiAgICAgICAgICAgICAgICAgICAgdG9wOiAwLFxuICAgICAgICAgICAgICAgICAgICB6SW5kZXg6IF8ub3B0aW9ucy56SW5kZXggLSAyLFxuICAgICAgICAgICAgICAgICAgICBvcGFjaXR5OiAwXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICQoZWxlbWVudCkuY3NzKHtcbiAgICAgICAgICAgICAgICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXG4gICAgICAgICAgICAgICAgICAgIGxlZnQ6IHRhcmdldExlZnQsXG4gICAgICAgICAgICAgICAgICAgIHRvcDogMCxcbiAgICAgICAgICAgICAgICAgICAgekluZGV4OiBfLm9wdGlvbnMuekluZGV4IC0gMixcbiAgICAgICAgICAgICAgICAgICAgb3BhY2l0eTogMFxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBfLiRzbGlkZXMuZXEoXy5jdXJyZW50U2xpZGUpLmNzcyh7XG4gICAgICAgICAgICB6SW5kZXg6IF8ub3B0aW9ucy56SW5kZXggLSAxLFxuICAgICAgICAgICAgb3BhY2l0eTogMVxuICAgICAgICB9KTtcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuc2V0SGVpZ2h0ID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuc2xpZGVzVG9TaG93ID09PSAxICYmIF8ub3B0aW9ucy5hZGFwdGl2ZUhlaWdodCA9PT0gdHJ1ZSAmJiBfLm9wdGlvbnMudmVydGljYWwgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICB2YXIgdGFyZ2V0SGVpZ2h0ID0gXy4kc2xpZGVzLmVxKF8uY3VycmVudFNsaWRlKS5vdXRlckhlaWdodCh0cnVlKTtcbiAgICAgICAgICAgIF8uJGxpc3QuY3NzKCdoZWlnaHQnLCB0YXJnZXRIZWlnaHQpO1xuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLnNldE9wdGlvbiA9XG4gICAgU2xpY2sucHJvdG90eXBlLnNsaWNrU2V0T3B0aW9uID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGFjY2VwdHMgYXJndW1lbnRzIGluIGZvcm1hdCBvZjpcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gZm9yIGNoYW5naW5nIGEgc2luZ2xlIG9wdGlvbidzIHZhbHVlOlxuICAgICAgICAgKiAgICAgLnNsaWNrKFwic2V0T3B0aW9uXCIsIG9wdGlvbiwgdmFsdWUsIHJlZnJlc2ggKVxuICAgICAgICAgKlxuICAgICAgICAgKiAgLSBmb3IgY2hhbmdpbmcgYSBzZXQgb2YgcmVzcG9uc2l2ZSBvcHRpb25zOlxuICAgICAgICAgKiAgICAgLnNsaWNrKFwic2V0T3B0aW9uXCIsICdyZXNwb25zaXZlJywgW3t9LCAuLi5dLCByZWZyZXNoIClcbiAgICAgICAgICpcbiAgICAgICAgICogIC0gZm9yIHVwZGF0aW5nIG11bHRpcGxlIHZhbHVlcyBhdCBvbmNlIChub3QgcmVzcG9uc2l2ZSlcbiAgICAgICAgICogICAgIC5zbGljayhcInNldE9wdGlvblwiLCB7ICdvcHRpb24nOiB2YWx1ZSwgLi4uIH0sIHJlZnJlc2ggKVxuICAgICAgICAgKi9cblxuICAgICAgICB2YXIgXyA9IHRoaXMsIGwsIGl0ZW0sIG9wdGlvbiwgdmFsdWUsIHJlZnJlc2ggPSBmYWxzZSwgdHlwZTtcblxuICAgICAgICBpZiggJC50eXBlKCBhcmd1bWVudHNbMF0gKSA9PT0gJ29iamVjdCcgKSB7XG5cbiAgICAgICAgICAgIG9wdGlvbiA9ICBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICByZWZyZXNoID0gYXJndW1lbnRzWzFdO1xuICAgICAgICAgICAgdHlwZSA9ICdtdWx0aXBsZSc7XG5cbiAgICAgICAgfSBlbHNlIGlmICggJC50eXBlKCBhcmd1bWVudHNbMF0gKSA9PT0gJ3N0cmluZycgKSB7XG5cbiAgICAgICAgICAgIG9wdGlvbiA9ICBhcmd1bWVudHNbMF07XG4gICAgICAgICAgICB2YWx1ZSA9IGFyZ3VtZW50c1sxXTtcbiAgICAgICAgICAgIHJlZnJlc2ggPSBhcmd1bWVudHNbMl07XG5cbiAgICAgICAgICAgIGlmICggYXJndW1lbnRzWzBdID09PSAncmVzcG9uc2l2ZScgJiYgJC50eXBlKCBhcmd1bWVudHNbMV0gKSA9PT0gJ2FycmF5JyApIHtcblxuICAgICAgICAgICAgICAgIHR5cGUgPSAncmVzcG9uc2l2ZSc7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIHR5cGVvZiBhcmd1bWVudHNbMV0gIT09ICd1bmRlZmluZWQnICkge1xuXG4gICAgICAgICAgICAgICAgdHlwZSA9ICdzaW5nbGUnO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggdHlwZSA9PT0gJ3NpbmdsZScgKSB7XG5cbiAgICAgICAgICAgIF8ub3B0aW9uc1tvcHRpb25dID0gdmFsdWU7XG5cblxuICAgICAgICB9IGVsc2UgaWYgKCB0eXBlID09PSAnbXVsdGlwbGUnICkge1xuXG4gICAgICAgICAgICAkLmVhY2goIG9wdGlvbiAsIGZ1bmN0aW9uKCBvcHQsIHZhbCApIHtcblxuICAgICAgICAgICAgICAgIF8ub3B0aW9uc1tvcHRdID0gdmFsO1xuXG4gICAgICAgICAgICB9KTtcblxuXG4gICAgICAgIH0gZWxzZSBpZiAoIHR5cGUgPT09ICdyZXNwb25zaXZlJyApIHtcblxuICAgICAgICAgICAgZm9yICggaXRlbSBpbiB2YWx1ZSApIHtcblxuICAgICAgICAgICAgICAgIGlmKCAkLnR5cGUoIF8ub3B0aW9ucy5yZXNwb25zaXZlICkgIT09ICdhcnJheScgKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgXy5vcHRpb25zLnJlc3BvbnNpdmUgPSBbIHZhbHVlW2l0ZW1dIF07XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIGwgPSBfLm9wdGlvbnMucmVzcG9uc2l2ZS5sZW5ndGgtMTtcblxuICAgICAgICAgICAgICAgICAgICAvLyBsb29wIHRocm91Z2ggdGhlIHJlc3BvbnNpdmUgb2JqZWN0IGFuZCBzcGxpY2Ugb3V0IGR1cGxpY2F0ZXMuXG4gICAgICAgICAgICAgICAgICAgIHdoaWxlKCBsID49IDAgKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKCBfLm9wdGlvbnMucmVzcG9uc2l2ZVtsXS5icmVha3BvaW50ID09PSB2YWx1ZVtpdGVtXS5icmVha3BvaW50ICkge1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXy5vcHRpb25zLnJlc3BvbnNpdmUuc3BsaWNlKGwsMSk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgbC0tO1xuXG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBfLm9wdGlvbnMucmVzcG9uc2l2ZS5wdXNoKCB2YWx1ZVtpdGVtXSApO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggcmVmcmVzaCApIHtcblxuICAgICAgICAgICAgXy51bmxvYWQoKTtcbiAgICAgICAgICAgIF8ucmVpbml0KCk7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5zZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBfLnNldERpbWVuc2lvbnMoKTtcblxuICAgICAgICBfLnNldEhlaWdodCgpO1xuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuZmFkZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIF8uc2V0Q1NTKF8uZ2V0TGVmdChfLmN1cnJlbnRTbGlkZSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgXy5zZXRGYWRlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBfLiRzbGlkZXIudHJpZ2dlcignc2V0UG9zaXRpb24nLCBbX10pO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5zZXRQcm9wcyA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcyxcbiAgICAgICAgICAgIGJvZHlTdHlsZSA9IGRvY3VtZW50LmJvZHkuc3R5bGU7XG5cbiAgICAgICAgXy5wb3NpdGlvblByb3AgPSBfLm9wdGlvbnMudmVydGljYWwgPT09IHRydWUgPyAndG9wJyA6ICdsZWZ0JztcblxuICAgICAgICBpZiAoXy5wb3NpdGlvblByb3AgPT09ICd0b3AnKSB7XG4gICAgICAgICAgICBfLiRzbGlkZXIuYWRkQ2xhc3MoJ3NsaWNrLXZlcnRpY2FsJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBfLiRzbGlkZXIucmVtb3ZlQ2xhc3MoJ3NsaWNrLXZlcnRpY2FsJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYm9keVN0eWxlLldlYmtpdFRyYW5zaXRpb24gIT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgYm9keVN0eWxlLk1velRyYW5zaXRpb24gIT09IHVuZGVmaW5lZCB8fFxuICAgICAgICAgICAgYm9keVN0eWxlLm1zVHJhbnNpdGlvbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBpZiAoXy5vcHRpb25zLnVzZUNTUyA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIF8uY3NzVHJhbnNpdGlvbnMgPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBfLm9wdGlvbnMuZmFkZSApIHtcbiAgICAgICAgICAgIGlmICggdHlwZW9mIF8ub3B0aW9ucy56SW5kZXggPT09ICdudW1iZXInICkge1xuICAgICAgICAgICAgICAgIGlmKCBfLm9wdGlvbnMuekluZGV4IDwgMyApIHtcbiAgICAgICAgICAgICAgICAgICAgXy5vcHRpb25zLnpJbmRleCA9IDM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfLm9wdGlvbnMuekluZGV4ID0gXy5kZWZhdWx0cy56SW5kZXg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYm9keVN0eWxlLk9UcmFuc2Zvcm0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgXy5hbmltVHlwZSA9ICdPVHJhbnNmb3JtJztcbiAgICAgICAgICAgIF8udHJhbnNmb3JtVHlwZSA9ICctby10cmFuc2Zvcm0nO1xuICAgICAgICAgICAgXy50cmFuc2l0aW9uVHlwZSA9ICdPVHJhbnNpdGlvbic7XG4gICAgICAgICAgICBpZiAoYm9keVN0eWxlLnBlcnNwZWN0aXZlUHJvcGVydHkgPT09IHVuZGVmaW5lZCAmJiBib2R5U3R5bGUud2Via2l0UGVyc3BlY3RpdmUgPT09IHVuZGVmaW5lZCkgXy5hbmltVHlwZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChib2R5U3R5bGUuTW96VHJhbnNmb3JtICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIF8uYW5pbVR5cGUgPSAnTW96VHJhbnNmb3JtJztcbiAgICAgICAgICAgIF8udHJhbnNmb3JtVHlwZSA9ICctbW96LXRyYW5zZm9ybSc7XG4gICAgICAgICAgICBfLnRyYW5zaXRpb25UeXBlID0gJ01velRyYW5zaXRpb24nO1xuICAgICAgICAgICAgaWYgKGJvZHlTdHlsZS5wZXJzcGVjdGl2ZVByb3BlcnR5ID09PSB1bmRlZmluZWQgJiYgYm9keVN0eWxlLk1velBlcnNwZWN0aXZlID09PSB1bmRlZmluZWQpIF8uYW5pbVR5cGUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYm9keVN0eWxlLndlYmtpdFRyYW5zZm9ybSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBfLmFuaW1UeXBlID0gJ3dlYmtpdFRyYW5zZm9ybSc7XG4gICAgICAgICAgICBfLnRyYW5zZm9ybVR5cGUgPSAnLXdlYmtpdC10cmFuc2Zvcm0nO1xuICAgICAgICAgICAgXy50cmFuc2l0aW9uVHlwZSA9ICd3ZWJraXRUcmFuc2l0aW9uJztcbiAgICAgICAgICAgIGlmIChib2R5U3R5bGUucGVyc3BlY3RpdmVQcm9wZXJ0eSA9PT0gdW5kZWZpbmVkICYmIGJvZHlTdHlsZS53ZWJraXRQZXJzcGVjdGl2ZSA9PT0gdW5kZWZpbmVkKSBfLmFuaW1UeXBlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGJvZHlTdHlsZS5tc1RyYW5zZm9ybSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBfLmFuaW1UeXBlID0gJ21zVHJhbnNmb3JtJztcbiAgICAgICAgICAgIF8udHJhbnNmb3JtVHlwZSA9ICctbXMtdHJhbnNmb3JtJztcbiAgICAgICAgICAgIF8udHJhbnNpdGlvblR5cGUgPSAnbXNUcmFuc2l0aW9uJztcbiAgICAgICAgICAgIGlmIChib2R5U3R5bGUubXNUcmFuc2Zvcm0gPT09IHVuZGVmaW5lZCkgXy5hbmltVHlwZSA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChib2R5U3R5bGUudHJhbnNmb3JtICE9PSB1bmRlZmluZWQgJiYgXy5hbmltVHlwZSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgIF8uYW5pbVR5cGUgPSAndHJhbnNmb3JtJztcbiAgICAgICAgICAgIF8udHJhbnNmb3JtVHlwZSA9ICd0cmFuc2Zvcm0nO1xuICAgICAgICAgICAgXy50cmFuc2l0aW9uVHlwZSA9ICd0cmFuc2l0aW9uJztcbiAgICAgICAgfVxuICAgICAgICBfLnRyYW5zZm9ybXNFbmFibGVkID0gXy5vcHRpb25zLnVzZVRyYW5zZm9ybSAmJiAoXy5hbmltVHlwZSAhPT0gbnVsbCAmJiBfLmFuaW1UeXBlICE9PSBmYWxzZSk7XG4gICAgfTtcblxuXG4gICAgU2xpY2sucHJvdG90eXBlLnNldFNsaWRlQ2xhc3NlcyA9IGZ1bmN0aW9uKGluZGV4KSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgY2VudGVyT2Zmc2V0LCBhbGxTbGlkZXMsIGluZGV4T2Zmc2V0LCByZW1haW5kZXI7XG5cbiAgICAgICAgYWxsU2xpZGVzID0gXy4kc2xpZGVyXG4gICAgICAgICAgICAuZmluZCgnLnNsaWNrLXNsaWRlJylcbiAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnc2xpY2stYWN0aXZlIHNsaWNrLWNlbnRlciBzbGljay1jdXJyZW50JylcbiAgICAgICAgICAgIC5hdHRyKCdhcmlhLWhpZGRlbicsICd0cnVlJyk7XG5cbiAgICAgICAgXy4kc2xpZGVzXG4gICAgICAgICAgICAuZXEoaW5kZXgpXG4gICAgICAgICAgICAuYWRkQ2xhc3MoJ3NsaWNrLWN1cnJlbnQnKTtcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmNlbnRlck1vZGUgPT09IHRydWUpIHtcblxuICAgICAgICAgICAgdmFyIGV2ZW5Db2VmID0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdyAlIDIgPT09IDAgPyAxIDogMDtcblxuICAgICAgICAgICAgY2VudGVyT2Zmc2V0ID0gTWF0aC5mbG9vcihfLm9wdGlvbnMuc2xpZGVzVG9TaG93IC8gMik7XG5cbiAgICAgICAgICAgIGlmIChfLm9wdGlvbnMuaW5maW5pdGUgPT09IHRydWUpIHtcblxuICAgICAgICAgICAgICAgIGlmIChpbmRleCA+PSBjZW50ZXJPZmZzZXQgJiYgaW5kZXggPD0gKF8uc2xpZGVDb3VudCAtIDEpIC0gY2VudGVyT2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgICAgIF8uJHNsaWRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgLnNsaWNlKGluZGV4IC0gY2VudGVyT2Zmc2V0ICsgZXZlbkNvZWYsIGluZGV4ICsgY2VudGVyT2Zmc2V0ICsgMSlcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRDbGFzcygnc2xpY2stYWN0aXZlJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdhcmlhLWhpZGRlbicsICdmYWxzZScpO1xuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICBpbmRleE9mZnNldCA9IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgKyBpbmRleDtcbiAgICAgICAgICAgICAgICAgICAgYWxsU2xpZGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2xpY2UoaW5kZXhPZmZzZXQgLSBjZW50ZXJPZmZzZXQgKyAxICsgZXZlbkNvZWYsIGluZGV4T2Zmc2V0ICsgY2VudGVyT2Zmc2V0ICsgMilcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hZGRDbGFzcygnc2xpY2stYWN0aXZlJylcbiAgICAgICAgICAgICAgICAgICAgICAgIC5hdHRyKCdhcmlhLWhpZGRlbicsICdmYWxzZScpO1xuXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGluZGV4ID09PSAwKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgYWxsU2xpZGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAuZXEoYWxsU2xpZGVzLmxlbmd0aCAtIDEgLSBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZENsYXNzKCdzbGljay1jZW50ZXInKTtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5kZXggPT09IF8uc2xpZGVDb3VudCAtIDEpIHtcblxuICAgICAgICAgICAgICAgICAgICBhbGxTbGlkZXNcbiAgICAgICAgICAgICAgICAgICAgICAgIC5lcShfLm9wdGlvbnMuc2xpZGVzVG9TaG93KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZENsYXNzKCdzbGljay1jZW50ZXInKTtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBfLiRzbGlkZXNcbiAgICAgICAgICAgICAgICAuZXEoaW5kZXgpXG4gICAgICAgICAgICAgICAgLmFkZENsYXNzKCdzbGljay1jZW50ZXInKTtcblxuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICBpZiAoaW5kZXggPj0gMCAmJiBpbmRleCA8PSAoXy5zbGlkZUNvdW50IC0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykpIHtcblxuICAgICAgICAgICAgICAgIF8uJHNsaWRlc1xuICAgICAgICAgICAgICAgICAgICAuc2xpY2UoaW5kZXgsIGluZGV4ICsgXy5vcHRpb25zLnNsaWRlc1RvU2hvdylcbiAgICAgICAgICAgICAgICAgICAgLmFkZENsYXNzKCdzbGljay1hY3RpdmUnKVxuICAgICAgICAgICAgICAgICAgICAuYXR0cignYXJpYS1oaWRkZW4nLCAnZmFsc2UnKTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChhbGxTbGlkZXMubGVuZ3RoIDw9IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpIHtcblxuICAgICAgICAgICAgICAgIGFsbFNsaWRlc1xuICAgICAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoJ3NsaWNrLWFjdGl2ZScpXG4gICAgICAgICAgICAgICAgICAgIC5hdHRyKCdhcmlhLWhpZGRlbicsICdmYWxzZScpO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgcmVtYWluZGVyID0gXy5zbGlkZUNvdW50ICUgXy5vcHRpb25zLnNsaWRlc1RvU2hvdztcbiAgICAgICAgICAgICAgICBpbmRleE9mZnNldCA9IF8ub3B0aW9ucy5pbmZpbml0ZSA9PT0gdHJ1ZSA/IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgKyBpbmRleCA6IGluZGV4O1xuXG4gICAgICAgICAgICAgICAgaWYgKF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cgPT0gXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsICYmIChfLnNsaWRlQ291bnQgLSBpbmRleCkgPCBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgYWxsU2xpZGVzXG4gICAgICAgICAgICAgICAgICAgICAgICAuc2xpY2UoaW5kZXhPZmZzZXQgLSAoXy5vcHRpb25zLnNsaWRlc1RvU2hvdyAtIHJlbWFpbmRlciksIGluZGV4T2Zmc2V0ICsgcmVtYWluZGVyKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFkZENsYXNzKCdzbGljay1hY3RpdmUnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJyk7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgICAgICAgICAgIGFsbFNsaWRlc1xuICAgICAgICAgICAgICAgICAgICAgICAgLnNsaWNlKGluZGV4T2Zmc2V0LCBpbmRleE9mZnNldCArIF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYWRkQ2xhc3MoJ3NsaWNrLWFjdGl2ZScpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignYXJpYS1oaWRkZW4nLCAnZmFsc2UnKTtcblxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5vcHRpb25zLmxhenlMb2FkID09PSAnb25kZW1hbmQnIHx8IF8ub3B0aW9ucy5sYXp5TG9hZCA9PT0gJ2FudGljaXBhdGVkJykge1xuICAgICAgICAgICAgXy5sYXp5TG9hZCgpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5zZXR1cEluZmluaXRlID0gZnVuY3Rpb24oKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgaSwgc2xpZGVJbmRleCwgaW5maW5pdGVDb3VudDtcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmZhZGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIF8ub3B0aW9ucy5jZW50ZXJNb2RlID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5vcHRpb25zLmluZmluaXRlID09PSB0cnVlICYmIF8ub3B0aW9ucy5mYWRlID09PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBzbGlkZUluZGV4ID0gbnVsbDtcblxuICAgICAgICAgICAgaWYgKF8uc2xpZGVDb3VudCA+IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpIHtcblxuICAgICAgICAgICAgICAgIGlmIChfLm9wdGlvbnMuY2VudGVyTW9kZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICBpbmZpbml0ZUNvdW50ID0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdyArIDE7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaW5maW5pdGVDb3VudCA9IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3c7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZm9yIChpID0gXy5zbGlkZUNvdW50OyBpID4gKF8uc2xpZGVDb3VudCAtXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZpbml0ZUNvdW50KTsgaSAtPSAxKSB7XG4gICAgICAgICAgICAgICAgICAgIHNsaWRlSW5kZXggPSBpIC0gMTtcbiAgICAgICAgICAgICAgICAgICAgJChfLiRzbGlkZXNbc2xpZGVJbmRleF0pLmNsb25lKHRydWUpLmF0dHIoJ2lkJywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAuYXR0cignZGF0YS1zbGljay1pbmRleCcsIHNsaWRlSW5kZXggLSBfLnNsaWRlQ291bnQpXG4gICAgICAgICAgICAgICAgICAgICAgICAucHJlcGVuZFRvKF8uJHNsaWRlVHJhY2spLmFkZENsYXNzKCdzbGljay1jbG9uZWQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IGluZmluaXRlQ291bnQgICsgXy5zbGlkZUNvdW50OyBpICs9IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgc2xpZGVJbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgICAgICQoXy4kc2xpZGVzW3NsaWRlSW5kZXhdKS5jbG9uZSh0cnVlKS5hdHRyKCdpZCcsICcnKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmF0dHIoJ2RhdGEtc2xpY2staW5kZXgnLCBzbGlkZUluZGV4ICsgXy5zbGlkZUNvdW50KVxuICAgICAgICAgICAgICAgICAgICAgICAgLmFwcGVuZFRvKF8uJHNsaWRlVHJhY2spLmFkZENsYXNzKCdzbGljay1jbG9uZWQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXy4kc2xpZGVUcmFjay5maW5kKCcuc2xpY2stY2xvbmVkJykuZmluZCgnW2lkXScpLmVhY2goZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICQodGhpcykuYXR0cignaWQnLCAnJyk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLmludGVycnVwdCA9IGZ1bmN0aW9uKCB0b2dnbGUgKSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzO1xuXG4gICAgICAgIGlmKCAhdG9nZ2xlICkge1xuICAgICAgICAgICAgXy5hdXRvUGxheSgpO1xuICAgICAgICB9XG4gICAgICAgIF8uaW50ZXJydXB0ZWQgPSB0b2dnbGU7XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLnNlbGVjdEhhbmRsZXIgPSBmdW5jdGlvbihldmVudCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICB2YXIgdGFyZ2V0RWxlbWVudCA9XG4gICAgICAgICAgICAkKGV2ZW50LnRhcmdldCkuaXMoJy5zbGljay1zbGlkZScpID9cbiAgICAgICAgICAgICAgICAkKGV2ZW50LnRhcmdldCkgOlxuICAgICAgICAgICAgICAgICQoZXZlbnQudGFyZ2V0KS5wYXJlbnRzKCcuc2xpY2stc2xpZGUnKTtcblxuICAgICAgICB2YXIgaW5kZXggPSBwYXJzZUludCh0YXJnZXRFbGVtZW50LmF0dHIoJ2RhdGEtc2xpY2staW5kZXgnKSk7XG5cbiAgICAgICAgaWYgKCFpbmRleCkgaW5kZXggPSAwO1xuXG4gICAgICAgIGlmIChfLnNsaWRlQ291bnQgPD0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuXG4gICAgICAgICAgICBfLnNsaWRlSGFuZGxlcihpbmRleCwgZmFsc2UsIHRydWUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIH1cblxuICAgICAgICBfLnNsaWRlSGFuZGxlcihpbmRleCk7XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLnNsaWRlSGFuZGxlciA9IGZ1bmN0aW9uKGluZGV4LCBzeW5jLCBkb250QW5pbWF0ZSkge1xuXG4gICAgICAgIHZhciB0YXJnZXRTbGlkZSwgYW5pbVNsaWRlLCBvbGRTbGlkZSwgc2xpZGVMZWZ0LCB0YXJnZXRMZWZ0ID0gbnVsbCxcbiAgICAgICAgICAgIF8gPSB0aGlzLCBuYXZUYXJnZXQ7XG5cbiAgICAgICAgc3luYyA9IHN5bmMgfHwgZmFsc2U7XG5cbiAgICAgICAgaWYgKF8uYW5pbWF0aW5nID09PSB0cnVlICYmIF8ub3B0aW9ucy53YWl0Rm9yQW5pbWF0ZSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5mYWRlID09PSB0cnVlICYmIF8uY3VycmVudFNsaWRlID09PSBpbmRleCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHN5bmMgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICBfLmFzTmF2Rm9yKGluZGV4KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRhcmdldFNsaWRlID0gaW5kZXg7XG4gICAgICAgIHRhcmdldExlZnQgPSBfLmdldExlZnQodGFyZ2V0U2xpZGUpO1xuICAgICAgICBzbGlkZUxlZnQgPSBfLmdldExlZnQoXy5jdXJyZW50U2xpZGUpO1xuXG4gICAgICAgIF8uY3VycmVudExlZnQgPSBfLnN3aXBlTGVmdCA9PT0gbnVsbCA/IHNsaWRlTGVmdCA6IF8uc3dpcGVMZWZ0O1xuXG4gICAgICAgIGlmIChfLm9wdGlvbnMuaW5maW5pdGUgPT09IGZhbHNlICYmIF8ub3B0aW9ucy5jZW50ZXJNb2RlID09PSBmYWxzZSAmJiAoaW5kZXggPCAwIHx8IGluZGV4ID4gXy5nZXREb3RDb3VudCgpICogXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsKSkge1xuICAgICAgICAgICAgaWYgKF8ub3B0aW9ucy5mYWRlID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIHRhcmdldFNsaWRlID0gXy5jdXJyZW50U2xpZGU7XG4gICAgICAgICAgICAgICAgaWYgKGRvbnRBbmltYXRlICE9PSB0cnVlICYmIF8uc2xpZGVDb3VudCA+IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpIHtcbiAgICAgICAgICAgICAgICAgICAgXy5hbmltYXRlU2xpZGUoc2xpZGVMZWZ0LCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF8ucG9zdFNsaWRlKHRhcmdldFNsaWRlKTtcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgXy5wb3N0U2xpZGUodGFyZ2V0U2xpZGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIGlmIChfLm9wdGlvbnMuaW5maW5pdGUgPT09IGZhbHNlICYmIF8ub3B0aW9ucy5jZW50ZXJNb2RlID09PSB0cnVlICYmIChpbmRleCA8IDAgfHwgaW5kZXggPiAoXy5zbGlkZUNvdW50IC0gXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsKSkpIHtcbiAgICAgICAgICAgIGlmIChfLm9wdGlvbnMuZmFkZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICB0YXJnZXRTbGlkZSA9IF8uY3VycmVudFNsaWRlO1xuICAgICAgICAgICAgICAgIGlmIChkb250QW5pbWF0ZSAhPT0gdHJ1ZSAmJiBfLnNsaWRlQ291bnQgPiBfLm9wdGlvbnMuc2xpZGVzVG9TaG93KSB7XG4gICAgICAgICAgICAgICAgICAgIF8uYW5pbWF0ZVNsaWRlKHNsaWRlTGVmdCwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBfLnBvc3RTbGlkZSh0YXJnZXRTbGlkZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIF8ucG9zdFNsaWRlKHRhcmdldFNsaWRlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIF8ub3B0aW9ucy5hdXRvcGxheSApIHtcbiAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoXy5hdXRvUGxheVRpbWVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0YXJnZXRTbGlkZSA8IDApIHtcbiAgICAgICAgICAgIGlmIChfLnNsaWRlQ291bnQgJSBfLm9wdGlvbnMuc2xpZGVzVG9TY3JvbGwgIT09IDApIHtcbiAgICAgICAgICAgICAgICBhbmltU2xpZGUgPSBfLnNsaWRlQ291bnQgLSAoXy5zbGlkZUNvdW50ICUgXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYW5pbVNsaWRlID0gXy5zbGlkZUNvdW50ICsgdGFyZ2V0U2xpZGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGFyZ2V0U2xpZGUgPj0gXy5zbGlkZUNvdW50KSB7XG4gICAgICAgICAgICBpZiAoXy5zbGlkZUNvdW50ICUgXy5vcHRpb25zLnNsaWRlc1RvU2Nyb2xsICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgYW5pbVNsaWRlID0gMDtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgYW5pbVNsaWRlID0gdGFyZ2V0U2xpZGUgLSBfLnNsaWRlQ291bnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhbmltU2xpZGUgPSB0YXJnZXRTbGlkZTtcbiAgICAgICAgfVxuXG4gICAgICAgIF8uYW5pbWF0aW5nID0gdHJ1ZTtcblxuICAgICAgICBfLiRzbGlkZXIudHJpZ2dlcignYmVmb3JlQ2hhbmdlJywgW18sIF8uY3VycmVudFNsaWRlLCBhbmltU2xpZGVdKTtcblxuICAgICAgICBvbGRTbGlkZSA9IF8uY3VycmVudFNsaWRlO1xuICAgICAgICBfLmN1cnJlbnRTbGlkZSA9IGFuaW1TbGlkZTtcblxuICAgICAgICBfLnNldFNsaWRlQ2xhc3NlcyhfLmN1cnJlbnRTbGlkZSk7XG5cbiAgICAgICAgaWYgKCBfLm9wdGlvbnMuYXNOYXZGb3IgKSB7XG5cbiAgICAgICAgICAgIG5hdlRhcmdldCA9IF8uZ2V0TmF2VGFyZ2V0KCk7XG4gICAgICAgICAgICBuYXZUYXJnZXQgPSBuYXZUYXJnZXQuc2xpY2soJ2dldFNsaWNrJyk7XG5cbiAgICAgICAgICAgIGlmICggbmF2VGFyZ2V0LnNsaWRlQ291bnQgPD0gbmF2VGFyZ2V0Lm9wdGlvbnMuc2xpZGVzVG9TaG93ICkge1xuICAgICAgICAgICAgICAgIG5hdlRhcmdldC5zZXRTbGlkZUNsYXNzZXMoXy5jdXJyZW50U2xpZGUpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH1cblxuICAgICAgICBfLnVwZGF0ZURvdHMoKTtcbiAgICAgICAgXy51cGRhdGVBcnJvd3MoKTtcblxuICAgICAgICBpZiAoXy5vcHRpb25zLmZhZGUgPT09IHRydWUpIHtcbiAgICAgICAgICAgIGlmIChkb250QW5pbWF0ZSAhPT0gdHJ1ZSkge1xuXG4gICAgICAgICAgICAgICAgXy5mYWRlU2xpZGVPdXQob2xkU2xpZGUpO1xuXG4gICAgICAgICAgICAgICAgXy5mYWRlU2xpZGUoYW5pbVNsaWRlLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgXy5wb3N0U2xpZGUoYW5pbVNsaWRlKTtcbiAgICAgICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBfLnBvc3RTbGlkZShhbmltU2xpZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgXy5hbmltYXRlSGVpZ2h0KCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZG9udEFuaW1hdGUgIT09IHRydWUgJiYgXy5zbGlkZUNvdW50ID4gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuICAgICAgICAgICAgXy5hbmltYXRlU2xpZGUodGFyZ2V0TGVmdCwgZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgXy5wb3N0U2xpZGUoYW5pbVNsaWRlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgXy5wb3N0U2xpZGUoYW5pbVNsaWRlKTtcbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5zdGFydExvYWQgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5hcnJvd3MgPT09IHRydWUgJiYgXy5zbGlkZUNvdW50ID4gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuXG4gICAgICAgICAgICBfLiRwcmV2QXJyb3cuaGlkZSgpO1xuICAgICAgICAgICAgXy4kbmV4dEFycm93LmhpZGUoKTtcblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5kb3RzID09PSB0cnVlICYmIF8uc2xpZGVDb3VudCA+IF8ub3B0aW9ucy5zbGlkZXNUb1Nob3cpIHtcblxuICAgICAgICAgICAgXy4kZG90cy5oaWRlKCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIF8uJHNsaWRlci5hZGRDbGFzcygnc2xpY2stbG9hZGluZycpO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5zd2lwZURpcmVjdGlvbiA9IGZ1bmN0aW9uKCkge1xuXG4gICAgICAgIHZhciB4RGlzdCwgeURpc3QsIHIsIHN3aXBlQW5nbGUsIF8gPSB0aGlzO1xuXG4gICAgICAgIHhEaXN0ID0gXy50b3VjaE9iamVjdC5zdGFydFggLSBfLnRvdWNoT2JqZWN0LmN1clg7XG4gICAgICAgIHlEaXN0ID0gXy50b3VjaE9iamVjdC5zdGFydFkgLSBfLnRvdWNoT2JqZWN0LmN1clk7XG4gICAgICAgIHIgPSBNYXRoLmF0YW4yKHlEaXN0LCB4RGlzdCk7XG5cbiAgICAgICAgc3dpcGVBbmdsZSA9IE1hdGgucm91bmQociAqIDE4MCAvIE1hdGguUEkpO1xuICAgICAgICBpZiAoc3dpcGVBbmdsZSA8IDApIHtcbiAgICAgICAgICAgIHN3aXBlQW5nbGUgPSAzNjAgLSBNYXRoLmFicyhzd2lwZUFuZ2xlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICgoc3dpcGVBbmdsZSA8PSA0NSkgJiYgKHN3aXBlQW5nbGUgPj0gMCkpIHtcbiAgICAgICAgICAgIHJldHVybiAoXy5vcHRpb25zLnJ0bCA9PT0gZmFsc2UgPyAnbGVmdCcgOiAncmlnaHQnKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoKHN3aXBlQW5nbGUgPD0gMzYwKSAmJiAoc3dpcGVBbmdsZSA+PSAzMTUpKSB7XG4gICAgICAgICAgICByZXR1cm4gKF8ub3B0aW9ucy5ydGwgPT09IGZhbHNlID8gJ2xlZnQnIDogJ3JpZ2h0Jyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKChzd2lwZUFuZ2xlID49IDEzNSkgJiYgKHN3aXBlQW5nbGUgPD0gMjI1KSkge1xuICAgICAgICAgICAgcmV0dXJuIChfLm9wdGlvbnMucnRsID09PSBmYWxzZSA/ICdyaWdodCcgOiAnbGVmdCcpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChfLm9wdGlvbnMudmVydGljYWxTd2lwaW5nID09PSB0cnVlKSB7XG4gICAgICAgICAgICBpZiAoKHN3aXBlQW5nbGUgPj0gMzUpICYmIChzd2lwZUFuZ2xlIDw9IDEzNSkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ2Rvd24nO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ3VwJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiAndmVydGljYWwnO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5zd2lwZUVuZCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgc2xpZGVDb3VudCxcbiAgICAgICAgICAgIGRpcmVjdGlvbjtcblxuICAgICAgICBfLmRyYWdnaW5nID0gZmFsc2U7XG4gICAgICAgIF8uc3dpcGluZyA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChfLnNjcm9sbGluZykge1xuICAgICAgICAgICAgXy5zY3JvbGxpbmcgPSBmYWxzZTtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIF8uaW50ZXJydXB0ZWQgPSBmYWxzZTtcbiAgICAgICAgXy5zaG91bGRDbGljayA9ICggXy50b3VjaE9iamVjdC5zd2lwZUxlbmd0aCA+IDEwICkgPyBmYWxzZSA6IHRydWU7XG5cbiAgICAgICAgaWYgKCBfLnRvdWNoT2JqZWN0LmN1clggPT09IHVuZGVmaW5lZCApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggXy50b3VjaE9iamVjdC5lZGdlSGl0ID09PSB0cnVlICkge1xuICAgICAgICAgICAgXy4kc2xpZGVyLnRyaWdnZXIoJ2VkZ2UnLCBbXywgXy5zd2lwZURpcmVjdGlvbigpIF0pO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBfLnRvdWNoT2JqZWN0LnN3aXBlTGVuZ3RoID49IF8udG91Y2hPYmplY3QubWluU3dpcGUgKSB7XG5cbiAgICAgICAgICAgIGRpcmVjdGlvbiA9IF8uc3dpcGVEaXJlY3Rpb24oKTtcblxuICAgICAgICAgICAgc3dpdGNoICggZGlyZWN0aW9uICkge1xuXG4gICAgICAgICAgICAgICAgY2FzZSAnbGVmdCc6XG4gICAgICAgICAgICAgICAgY2FzZSAnZG93bic6XG5cbiAgICAgICAgICAgICAgICAgICAgc2xpZGVDb3VudCA9XG4gICAgICAgICAgICAgICAgICAgICAgICBfLm9wdGlvbnMuc3dpcGVUb1NsaWRlID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmNoZWNrTmF2aWdhYmxlKCBfLmN1cnJlbnRTbGlkZSArIF8uZ2V0U2xpZGVDb3VudCgpICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uY3VycmVudFNsaWRlICsgXy5nZXRTbGlkZUNvdW50KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgXy5jdXJyZW50RGlyZWN0aW9uID0gMDtcblxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgJ3JpZ2h0JzpcbiAgICAgICAgICAgICAgICBjYXNlICd1cCc6XG5cbiAgICAgICAgICAgICAgICAgICAgc2xpZGVDb3VudCA9XG4gICAgICAgICAgICAgICAgICAgICAgICBfLm9wdGlvbnMuc3dpcGVUb1NsaWRlID9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBfLmNoZWNrTmF2aWdhYmxlKCBfLmN1cnJlbnRTbGlkZSAtIF8uZ2V0U2xpZGVDb3VudCgpICkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8uY3VycmVudFNsaWRlIC0gXy5nZXRTbGlkZUNvdW50KCk7XG5cbiAgICAgICAgICAgICAgICAgICAgXy5jdXJyZW50RGlyZWN0aW9uID0gMTtcblxuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG5cblxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiggZGlyZWN0aW9uICE9ICd2ZXJ0aWNhbCcgKSB7XG5cbiAgICAgICAgICAgICAgICBfLnNsaWRlSGFuZGxlciggc2xpZGVDb3VudCApO1xuICAgICAgICAgICAgICAgIF8udG91Y2hPYmplY3QgPSB7fTtcbiAgICAgICAgICAgICAgICBfLiRzbGlkZXIudHJpZ2dlcignc3dpcGUnLCBbXywgZGlyZWN0aW9uIF0pO1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgaWYgKCBfLnRvdWNoT2JqZWN0LnN0YXJ0WCAhPT0gXy50b3VjaE9iamVjdC5jdXJYICkge1xuXG4gICAgICAgICAgICAgICAgXy5zbGlkZUhhbmRsZXIoIF8uY3VycmVudFNsaWRlICk7XG4gICAgICAgICAgICAgICAgXy50b3VjaE9iamVjdCA9IHt9O1xuXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS5zd2lwZUhhbmRsZXIgPSBmdW5jdGlvbihldmVudCkge1xuXG4gICAgICAgIHZhciBfID0gdGhpcztcblxuICAgICAgICBpZiAoKF8ub3B0aW9ucy5zd2lwZSA9PT0gZmFsc2UpIHx8ICgnb250b3VjaGVuZCcgaW4gZG9jdW1lbnQgJiYgXy5vcHRpb25zLnN3aXBlID09PSBmYWxzZSkpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfSBlbHNlIGlmIChfLm9wdGlvbnMuZHJhZ2dhYmxlID09PSBmYWxzZSAmJiBldmVudC50eXBlLmluZGV4T2YoJ21vdXNlJykgIT09IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBfLnRvdWNoT2JqZWN0LmZpbmdlckNvdW50ID0gZXZlbnQub3JpZ2luYWxFdmVudCAmJiBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXMgIT09IHVuZGVmaW5lZCA/XG4gICAgICAgICAgICBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXMubGVuZ3RoIDogMTtcblxuICAgICAgICBfLnRvdWNoT2JqZWN0Lm1pblN3aXBlID0gXy5saXN0V2lkdGggLyBfLm9wdGlvbnNcbiAgICAgICAgICAgIC50b3VjaFRocmVzaG9sZDtcblxuICAgICAgICBpZiAoXy5vcHRpb25zLnZlcnRpY2FsU3dpcGluZyA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgXy50b3VjaE9iamVjdC5taW5Td2lwZSA9IF8ubGlzdEhlaWdodCAvIF8ub3B0aW9uc1xuICAgICAgICAgICAgICAgIC50b3VjaFRocmVzaG9sZDtcbiAgICAgICAgfVxuXG4gICAgICAgIHN3aXRjaCAoZXZlbnQuZGF0YS5hY3Rpb24pIHtcblxuICAgICAgICAgICAgY2FzZSAnc3RhcnQnOlxuICAgICAgICAgICAgICAgIF8uc3dpcGVTdGFydChldmVudCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ21vdmUnOlxuICAgICAgICAgICAgICAgIF8uc3dpcGVNb3ZlKGV2ZW50KTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnZW5kJzpcbiAgICAgICAgICAgICAgICBfLnN3aXBlRW5kKGV2ZW50KTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLnN3aXBlTW92ZSA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgZWRnZVdhc0hpdCA9IGZhbHNlLFxuICAgICAgICAgICAgY3VyTGVmdCwgc3dpcGVEaXJlY3Rpb24sIHN3aXBlTGVuZ3RoLCBwb3NpdGlvbk9mZnNldCwgdG91Y2hlcywgdmVydGljYWxTd2lwZUxlbmd0aDtcblxuICAgICAgICB0b3VjaGVzID0gZXZlbnQub3JpZ2luYWxFdmVudCAhPT0gdW5kZWZpbmVkID8gZXZlbnQub3JpZ2luYWxFdmVudC50b3VjaGVzIDogbnVsbDtcblxuICAgICAgICBpZiAoIV8uZHJhZ2dpbmcgfHwgXy5zY3JvbGxpbmcgfHwgdG91Y2hlcyAmJiB0b3VjaGVzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgY3VyTGVmdCA9IF8uZ2V0TGVmdChfLmN1cnJlbnRTbGlkZSk7XG5cbiAgICAgICAgXy50b3VjaE9iamVjdC5jdXJYID0gdG91Y2hlcyAhPT0gdW5kZWZpbmVkID8gdG91Y2hlc1swXS5wYWdlWCA6IGV2ZW50LmNsaWVudFg7XG4gICAgICAgIF8udG91Y2hPYmplY3QuY3VyWSA9IHRvdWNoZXMgIT09IHVuZGVmaW5lZCA/IHRvdWNoZXNbMF0ucGFnZVkgOiBldmVudC5jbGllbnRZO1xuXG4gICAgICAgIF8udG91Y2hPYmplY3Quc3dpcGVMZW5ndGggPSBNYXRoLnJvdW5kKE1hdGguc3FydChcbiAgICAgICAgICAgIE1hdGgucG93KF8udG91Y2hPYmplY3QuY3VyWCAtIF8udG91Y2hPYmplY3Quc3RhcnRYLCAyKSkpO1xuXG4gICAgICAgIHZlcnRpY2FsU3dpcGVMZW5ndGggPSBNYXRoLnJvdW5kKE1hdGguc3FydChcbiAgICAgICAgICAgIE1hdGgucG93KF8udG91Y2hPYmplY3QuY3VyWSAtIF8udG91Y2hPYmplY3Quc3RhcnRZLCAyKSkpO1xuXG4gICAgICAgIGlmICghXy5vcHRpb25zLnZlcnRpY2FsU3dpcGluZyAmJiAhXy5zd2lwaW5nICYmIHZlcnRpY2FsU3dpcGVMZW5ndGggPiA0KSB7XG4gICAgICAgICAgICBfLnNjcm9sbGluZyA9IHRydWU7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5vcHRpb25zLnZlcnRpY2FsU3dpcGluZyA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgXy50b3VjaE9iamVjdC5zd2lwZUxlbmd0aCA9IHZlcnRpY2FsU3dpcGVMZW5ndGg7XG4gICAgICAgIH1cblxuICAgICAgICBzd2lwZURpcmVjdGlvbiA9IF8uc3dpcGVEaXJlY3Rpb24oKTtcblxuICAgICAgICBpZiAoZXZlbnQub3JpZ2luYWxFdmVudCAhPT0gdW5kZWZpbmVkICYmIF8udG91Y2hPYmplY3Quc3dpcGVMZW5ndGggPiA0KSB7XG4gICAgICAgICAgICBfLnN3aXBpbmcgPSB0cnVlO1xuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHBvc2l0aW9uT2Zmc2V0ID0gKF8ub3B0aW9ucy5ydGwgPT09IGZhbHNlID8gMSA6IC0xKSAqIChfLnRvdWNoT2JqZWN0LmN1clggPiBfLnRvdWNoT2JqZWN0LnN0YXJ0WCA/IDEgOiAtMSk7XG4gICAgICAgIGlmIChfLm9wdGlvbnMudmVydGljYWxTd2lwaW5nID09PSB0cnVlKSB7XG4gICAgICAgICAgICBwb3NpdGlvbk9mZnNldCA9IF8udG91Y2hPYmplY3QuY3VyWSA+IF8udG91Y2hPYmplY3Quc3RhcnRZID8gMSA6IC0xO1xuICAgICAgICB9XG5cblxuICAgICAgICBzd2lwZUxlbmd0aCA9IF8udG91Y2hPYmplY3Quc3dpcGVMZW5ndGg7XG5cbiAgICAgICAgXy50b3VjaE9iamVjdC5lZGdlSGl0ID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5pbmZpbml0ZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgIGlmICgoXy5jdXJyZW50U2xpZGUgPT09IDAgJiYgc3dpcGVEaXJlY3Rpb24gPT09ICdyaWdodCcpIHx8IChfLmN1cnJlbnRTbGlkZSA+PSBfLmdldERvdENvdW50KCkgJiYgc3dpcGVEaXJlY3Rpb24gPT09ICdsZWZ0JykpIHtcbiAgICAgICAgICAgICAgICBzd2lwZUxlbmd0aCA9IF8udG91Y2hPYmplY3Quc3dpcGVMZW5ndGggKiBfLm9wdGlvbnMuZWRnZUZyaWN0aW9uO1xuICAgICAgICAgICAgICAgIF8udG91Y2hPYmplY3QuZWRnZUhpdCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5vcHRpb25zLnZlcnRpY2FsID09PSBmYWxzZSkge1xuICAgICAgICAgICAgXy5zd2lwZUxlZnQgPSBjdXJMZWZ0ICsgc3dpcGVMZW5ndGggKiBwb3NpdGlvbk9mZnNldDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIF8uc3dpcGVMZWZ0ID0gY3VyTGVmdCArIChzd2lwZUxlbmd0aCAqIChfLiRsaXN0LmhlaWdodCgpIC8gXy5saXN0V2lkdGgpKSAqIHBvc2l0aW9uT2Zmc2V0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChfLm9wdGlvbnMudmVydGljYWxTd2lwaW5nID09PSB0cnVlKSB7XG4gICAgICAgICAgICBfLnN3aXBlTGVmdCA9IGN1ckxlZnQgKyBzd2lwZUxlbmd0aCAqIHBvc2l0aW9uT2Zmc2V0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF8ub3B0aW9ucy5mYWRlID09PSB0cnVlIHx8IF8ub3B0aW9ucy50b3VjaE1vdmUgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy5hbmltYXRpbmcgPT09IHRydWUpIHtcbiAgICAgICAgICAgIF8uc3dpcGVMZWZ0ID0gbnVsbDtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIF8uc2V0Q1NTKF8uc3dpcGVMZWZ0KTtcblxuICAgIH07XG5cbiAgICBTbGljay5wcm90b3R5cGUuc3dpcGVTdGFydCA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cbiAgICAgICAgdmFyIF8gPSB0aGlzLFxuICAgICAgICAgICAgdG91Y2hlcztcblxuICAgICAgICBfLmludGVycnVwdGVkID0gdHJ1ZTtcblxuICAgICAgICBpZiAoXy50b3VjaE9iamVjdC5maW5nZXJDb3VudCAhPT0gMSB8fCBfLnNsaWRlQ291bnQgPD0gXy5vcHRpb25zLnNsaWRlc1RvU2hvdykge1xuICAgICAgICAgICAgXy50b3VjaE9iamVjdCA9IHt9O1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGV2ZW50Lm9yaWdpbmFsRXZlbnQgIT09IHVuZGVmaW5lZCAmJiBldmVudC5vcmlnaW5hbEV2ZW50LnRvdWNoZXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgdG91Y2hlcyA9IGV2ZW50Lm9yaWdpbmFsRXZlbnQudG91Y2hlc1swXTtcbiAgICAgICAgfVxuXG4gICAgICAgIF8udG91Y2hPYmplY3Quc3RhcnRYID0gXy50b3VjaE9iamVjdC5jdXJYID0gdG91Y2hlcyAhPT0gdW5kZWZpbmVkID8gdG91Y2hlcy5wYWdlWCA6IGV2ZW50LmNsaWVudFg7XG4gICAgICAgIF8udG91Y2hPYmplY3Quc3RhcnRZID0gXy50b3VjaE9iamVjdC5jdXJZID0gdG91Y2hlcyAhPT0gdW5kZWZpbmVkID8gdG91Y2hlcy5wYWdlWSA6IGV2ZW50LmNsaWVudFk7XG5cbiAgICAgICAgXy5kcmFnZ2luZyA9IHRydWU7XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLnVuZmlsdGVyU2xpZGVzID0gU2xpY2sucHJvdG90eXBlLnNsaWNrVW5maWx0ZXIgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgaWYgKF8uJHNsaWRlc0NhY2hlICE9PSBudWxsKSB7XG5cbiAgICAgICAgICAgIF8udW5sb2FkKCk7XG5cbiAgICAgICAgICAgIF8uJHNsaWRlVHJhY2suY2hpbGRyZW4odGhpcy5vcHRpb25zLnNsaWRlKS5kZXRhY2goKTtcblxuICAgICAgICAgICAgXy4kc2xpZGVzQ2FjaGUuYXBwZW5kVG8oXy4kc2xpZGVUcmFjayk7XG5cbiAgICAgICAgICAgIF8ucmVpbml0KCk7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS51bmxvYWQgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgJCgnLnNsaWNrLWNsb25lZCcsIF8uJHNsaWRlcikucmVtb3ZlKCk7XG5cbiAgICAgICAgaWYgKF8uJGRvdHMpIHtcbiAgICAgICAgICAgIF8uJGRvdHMucmVtb3ZlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoXy4kcHJldkFycm93ICYmIF8uaHRtbEV4cHIudGVzdChfLm9wdGlvbnMucHJldkFycm93KSkge1xuICAgICAgICAgICAgXy4kcHJldkFycm93LnJlbW92ZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKF8uJG5leHRBcnJvdyAmJiBfLmh0bWxFeHByLnRlc3QoXy5vcHRpb25zLm5leHRBcnJvdykpIHtcbiAgICAgICAgICAgIF8uJG5leHRBcnJvdy5yZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF8uJHNsaWRlc1xuICAgICAgICAgICAgLnJlbW92ZUNsYXNzKCdzbGljay1zbGlkZSBzbGljay1hY3RpdmUgc2xpY2stdmlzaWJsZSBzbGljay1jdXJyZW50JylcbiAgICAgICAgICAgIC5hdHRyKCdhcmlhLWhpZGRlbicsICd0cnVlJylcbiAgICAgICAgICAgIC5jc3MoJ3dpZHRoJywgJycpO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS51bnNsaWNrID0gZnVuY3Rpb24oZnJvbUJyZWFrcG9pbnQpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG4gICAgICAgIF8uJHNsaWRlci50cmlnZ2VyKCd1bnNsaWNrJywgW18sIGZyb21CcmVha3BvaW50XSk7XG4gICAgICAgIF8uZGVzdHJveSgpO1xuXG4gICAgfTtcblxuICAgIFNsaWNrLnByb3RvdHlwZS51cGRhdGVBcnJvd3MgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXMsXG4gICAgICAgICAgICBjZW50ZXJPZmZzZXQ7XG5cbiAgICAgICAgY2VudGVyT2Zmc2V0ID0gTWF0aC5mbG9vcihfLm9wdGlvbnMuc2xpZGVzVG9TaG93IC8gMik7XG5cbiAgICAgICAgaWYgKCBfLm9wdGlvbnMuYXJyb3dzID09PSB0cnVlICYmXG4gICAgICAgICAgICBfLnNsaWRlQ291bnQgPiBfLm9wdGlvbnMuc2xpZGVzVG9TaG93ICYmXG4gICAgICAgICAgICAhXy5vcHRpb25zLmluZmluaXRlICkge1xuXG4gICAgICAgICAgICBfLiRwcmV2QXJyb3cucmVtb3ZlQ2xhc3MoJ3NsaWNrLWRpc2FibGVkJykuYXR0cignYXJpYS1kaXNhYmxlZCcsICdmYWxzZScpO1xuICAgICAgICAgICAgXy4kbmV4dEFycm93LnJlbW92ZUNsYXNzKCdzbGljay1kaXNhYmxlZCcpLmF0dHIoJ2FyaWEtZGlzYWJsZWQnLCAnZmFsc2UnKTtcblxuICAgICAgICAgICAgaWYgKF8uY3VycmVudFNsaWRlID09PSAwKSB7XG5cbiAgICAgICAgICAgICAgICBfLiRwcmV2QXJyb3cuYWRkQ2xhc3MoJ3NsaWNrLWRpc2FibGVkJykuYXR0cignYXJpYS1kaXNhYmxlZCcsICd0cnVlJyk7XG4gICAgICAgICAgICAgICAgXy4kbmV4dEFycm93LnJlbW92ZUNsYXNzKCdzbGljay1kaXNhYmxlZCcpLmF0dHIoJ2FyaWEtZGlzYWJsZWQnLCAnZmFsc2UnKTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmIChfLmN1cnJlbnRTbGlkZSA+PSBfLnNsaWRlQ291bnQgLSBfLm9wdGlvbnMuc2xpZGVzVG9TaG93ICYmIF8ub3B0aW9ucy5jZW50ZXJNb2RlID09PSBmYWxzZSkge1xuXG4gICAgICAgICAgICAgICAgXy4kbmV4dEFycm93LmFkZENsYXNzKCdzbGljay1kaXNhYmxlZCcpLmF0dHIoJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScpO1xuICAgICAgICAgICAgICAgIF8uJHByZXZBcnJvdy5yZW1vdmVDbGFzcygnc2xpY2stZGlzYWJsZWQnKS5hdHRyKCdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyk7XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoXy5jdXJyZW50U2xpZGUgPj0gXy5zbGlkZUNvdW50IC0gMSAmJiBfLm9wdGlvbnMuY2VudGVyTW9kZSA9PT0gdHJ1ZSkge1xuXG4gICAgICAgICAgICAgICAgXy4kbmV4dEFycm93LmFkZENsYXNzKCdzbGljay1kaXNhYmxlZCcpLmF0dHIoJ2FyaWEtZGlzYWJsZWQnLCAndHJ1ZScpO1xuICAgICAgICAgICAgICAgIF8uJHByZXZBcnJvdy5yZW1vdmVDbGFzcygnc2xpY2stZGlzYWJsZWQnKS5hdHRyKCdhcmlhLWRpc2FibGVkJywgJ2ZhbHNlJyk7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLnVwZGF0ZURvdHMgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgaWYgKF8uJGRvdHMgIT09IG51bGwpIHtcblxuICAgICAgICAgICAgXy4kZG90c1xuICAgICAgICAgICAgICAgIC5maW5kKCdsaScpXG4gICAgICAgICAgICAgICAgICAgIC5yZW1vdmVDbGFzcygnc2xpY2stYWN0aXZlJylcbiAgICAgICAgICAgICAgICAgICAgLmVuZCgpO1xuXG4gICAgICAgICAgICBfLiRkb3RzXG4gICAgICAgICAgICAgICAgLmZpbmQoJ2xpJylcbiAgICAgICAgICAgICAgICAuZXEoTWF0aC5mbG9vcihfLmN1cnJlbnRTbGlkZSAvIF8ub3B0aW9ucy5zbGlkZXNUb1Njcm9sbCkpXG4gICAgICAgICAgICAgICAgLmFkZENsYXNzKCdzbGljay1hY3RpdmUnKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgU2xpY2sucHJvdG90eXBlLnZpc2liaWxpdHkgPSBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgXyA9IHRoaXM7XG5cbiAgICAgICAgaWYgKCBfLm9wdGlvbnMuYXV0b3BsYXkgKSB7XG5cbiAgICAgICAgICAgIGlmICggZG9jdW1lbnRbXy5oaWRkZW5dICkge1xuXG4gICAgICAgICAgICAgICAgXy5pbnRlcnJ1cHRlZCA9IHRydWU7XG5cbiAgICAgICAgICAgIH0gZWxzZSB7XG5cbiAgICAgICAgICAgICAgICBfLmludGVycnVwdGVkID0gZmFsc2U7XG5cbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cbiAgICB9O1xuXG4gICAgJC5mbi5zbGljayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgXyA9IHRoaXMsXG4gICAgICAgICAgICBvcHQgPSBhcmd1bWVudHNbMF0sXG4gICAgICAgICAgICBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKSxcbiAgICAgICAgICAgIGwgPSBfLmxlbmd0aCxcbiAgICAgICAgICAgIGksXG4gICAgICAgICAgICByZXQ7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0ID09ICdvYmplY3QnIHx8IHR5cGVvZiBvcHQgPT0gJ3VuZGVmaW5lZCcpXG4gICAgICAgICAgICAgICAgX1tpXS5zbGljayA9IG5ldyBTbGljayhfW2ldLCBvcHQpO1xuICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHJldCA9IF9baV0uc2xpY2tbb3B0XS5hcHBseShfW2ldLnNsaWNrLCBhcmdzKTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcmV0ICE9ICd1bmRlZmluZWQnKSByZXR1cm4gcmV0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfO1xuICAgIH07XG5cbn0pKTsiLCJmdW5jdGlvbiB0b2dnbGVNZW51KCl7XG4gICAgY29uc3QgYm9keUVsZW0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKFwiYm9keVwiKTtcbiAgICBjb25zdCBtZW51VG9nZ2xlID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihcIi5tZW51LXRvZ2dsZVwiKTtcbiAgICBtZW51VG9nZ2xlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKT0+e1xuICAgICAgICBib2R5RWxlbS5jbGFzc0xpc3QudG9nZ2xlKFwibWVudS12aXNpYmxlXCIpO1xuICAgIH0pXG59XG5cbmZ1bmN0aW9uIHNsaWRlckluaXQoZWxlbSwgY29udHJvbHMgPSBmYWxzZSl7XG5cbiAgICB2YXIgd29ya1NsaWRlciA9IGpRdWVyeShlbGVtKTtcblxuICAgIGlmKGNvbnRyb2xzKXtcbiAgICAgICAgdmFyIHdvcmtTbGlkZXJOYXYgPSBqUXVlcnkoY29udHJvbHMpO1xuXG4gICAgICAgIHdvcmtTbGlkZXIub24oJ2luaXQnLCBmdW5jdGlvbihldmVudCwgc2xpY2spe1xuICAgICAgICAgICAgd29ya1NsaWRlck5hdi5lcSgwKS5hZGRDbGFzcyhcImFjdGl2ZVwiKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgd29ya1NsaWRlck5hdi5vbihcIm1vdXNlb3ZlclwiLCBmdW5jdGlvbihlKXtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIHZhciBzbGlkZUluZGV4ID0galF1ZXJ5KHRoaXMpLmluZGV4KCk7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgd29ya1NsaWRlci5zbGljaygnc2xpY2tHb1RvJywgc2xpZGVJbmRleClcbiAgICAgICAgICAgIH0sIDEwMCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIHdvcmtTbGlkZXIub24oJ2JlZm9yZUNoYW5nZScsIGZ1bmN0aW9uKGV2ZW50LCBzbGljaywgY3VycmVudFNsaWRlLCBuZXh0U2xpZGUpe1xuICAgICAgICBpZihjb250cm9scyl7XG4gICAgICAgICAgICB3b3JrU2xpZGVyTmF2LnJlbW92ZUNsYXNzKFwiYWN0aXZlXCIpO1xuICAgICAgICAgICAgd29ya1NsaWRlck5hdi5lcShuZXh0U2xpZGUpLmFkZENsYXNzKFwiYWN0aXZlXCIpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICB3b3JrU2xpZGVyLnNsaWNrKHtcbiAgICAgICAgZG90czogdHJ1ZSxcbiAgICAgICAgaW5maW5pdGU6IHRydWUsXG4gICAgICAgIHNwZWVkOiAyNTAsXG4gICAgICAgIGZhZGU6IHRydWUsXG4gICAgICAgIGNzc0Vhc2U6ICdsaW5lYXInLFxuICAgICAgICBhcnJvd3M6IGZhbHNlLFxuICAgICAgICBhdXRvcGxheTogdHJ1ZVxuICAgIH0pXG5cbn1cblxuc2xpZGVySW5pdCgnLndvcmstc2xpZGVyJywgJy53b3JrLXNsaWRlci1uYXYgdWwgbGknKTtcbnNsaWRlckluaXQoJy5kZXRhaWwtc2xpZGVyJyk7XG50b2dnbGVNZW51KCk7XG5cbiIsIi8qU01PT1RIIFNDUk9MTCBJT1MgKi9cbiFmdW5jdGlvbigpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIG8oKXt2YXIgbz13aW5kb3csdD1kb2N1bWVudDtpZighKFwic2Nyb2xsQmVoYXZpb3JcImluIHQuZG9jdW1lbnRFbGVtZW50LnN0eWxlJiYhMCE9PW8uX19mb3JjZVNtb290aFNjcm9sbFBvbHlmaWxsX18pKXt2YXIgbCxlPW8uSFRNTEVsZW1lbnR8fG8uRWxlbWVudCxyPTQ2OCxpPXtzY3JvbGw6by5zY3JvbGx8fG8uc2Nyb2xsVG8sc2Nyb2xsQnk6by5zY3JvbGxCeSxlbGVtZW50U2Nyb2xsOmUucHJvdG90eXBlLnNjcm9sbHx8bixzY3JvbGxJbnRvVmlldzplLnByb3RvdHlwZS5zY3JvbGxJbnRvVmlld30scz1vLnBlcmZvcm1hbmNlJiZvLnBlcmZvcm1hbmNlLm5vdz9vLnBlcmZvcm1hbmNlLm5vdy5iaW5kKG8ucGVyZm9ybWFuY2UpOkRhdGUubm93LGM9KGw9by5uYXZpZ2F0b3IudXNlckFnZW50LG5ldyBSZWdFeHAoW1wiTVNJRSBcIixcIlRyaWRlbnQvXCIsXCJFZGdlL1wiXS5qb2luKFwifFwiKSkudGVzdChsKT8xOjApO28uc2Nyb2xsPW8uc2Nyb2xsVG89ZnVuY3Rpb24oKXt2b2lkIDAhPT1hcmd1bWVudHNbMF0mJighMCE9PWYoYXJndW1lbnRzWzBdKT9oLmNhbGwobyx0LmJvZHksdm9pZCAwIT09YXJndW1lbnRzWzBdLmxlZnQ/fn5hcmd1bWVudHNbMF0ubGVmdDpvLnNjcm9sbFh8fG8ucGFnZVhPZmZzZXQsdm9pZCAwIT09YXJndW1lbnRzWzBdLnRvcD9+fmFyZ3VtZW50c1swXS50b3A6by5zY3JvbGxZfHxvLnBhZ2VZT2Zmc2V0KTppLnNjcm9sbC5jYWxsKG8sdm9pZCAwIT09YXJndW1lbnRzWzBdLmxlZnQ/YXJndW1lbnRzWzBdLmxlZnQ6XCJvYmplY3RcIiE9dHlwZW9mIGFyZ3VtZW50c1swXT9hcmd1bWVudHNbMF06by5zY3JvbGxYfHxvLnBhZ2VYT2Zmc2V0LHZvaWQgMCE9PWFyZ3VtZW50c1swXS50b3A/YXJndW1lbnRzWzBdLnRvcDp2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOm8uc2Nyb2xsWXx8by5wYWdlWU9mZnNldCkpfSxvLnNjcm9sbEJ5PWZ1bmN0aW9uKCl7dm9pZCAwIT09YXJndW1lbnRzWzBdJiYoZihhcmd1bWVudHNbMF0pP2kuc2Nyb2xsQnkuY2FsbChvLHZvaWQgMCE9PWFyZ3VtZW50c1swXS5sZWZ0P2FyZ3VtZW50c1swXS5sZWZ0Olwib2JqZWN0XCIhPXR5cGVvZiBhcmd1bWVudHNbMF0/YXJndW1lbnRzWzBdOjAsdm9pZCAwIT09YXJndW1lbnRzWzBdLnRvcD9hcmd1bWVudHNbMF0udG9wOnZvaWQgMCE9PWFyZ3VtZW50c1sxXT9hcmd1bWVudHNbMV06MCk6aC5jYWxsKG8sdC5ib2R5LH5+YXJndW1lbnRzWzBdLmxlZnQrKG8uc2Nyb2xsWHx8by5wYWdlWE9mZnNldCksfn5hcmd1bWVudHNbMF0udG9wKyhvLnNjcm9sbFl8fG8ucGFnZVlPZmZzZXQpKSl9LGUucHJvdG90eXBlLnNjcm9sbD1lLnByb3RvdHlwZS5zY3JvbGxUbz1mdW5jdGlvbigpe2lmKHZvaWQgMCE9PWFyZ3VtZW50c1swXSlpZighMCE9PWYoYXJndW1lbnRzWzBdKSl7dmFyIG89YXJndW1lbnRzWzBdLmxlZnQsdD1hcmd1bWVudHNbMF0udG9wO2guY2FsbCh0aGlzLHRoaXMsdm9pZCAwPT09bz90aGlzLnNjcm9sbExlZnQ6fn5vLHZvaWQgMD09PXQ/dGhpcy5zY3JvbGxUb3A6fn50KX1lbHNle2lmKFwibnVtYmVyXCI9PXR5cGVvZiBhcmd1bWVudHNbMF0mJnZvaWQgMD09PWFyZ3VtZW50c1sxXSl0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJWYWx1ZSBjb3VsZCBub3QgYmUgY29udmVydGVkXCIpO2kuZWxlbWVudFNjcm9sbC5jYWxsKHRoaXMsdm9pZCAwIT09YXJndW1lbnRzWzBdLmxlZnQ/fn5hcmd1bWVudHNbMF0ubGVmdDpcIm9iamVjdFwiIT10eXBlb2YgYXJndW1lbnRzWzBdP35+YXJndW1lbnRzWzBdOnRoaXMuc2Nyb2xsTGVmdCx2b2lkIDAhPT1hcmd1bWVudHNbMF0udG9wP35+YXJndW1lbnRzWzBdLnRvcDp2b2lkIDAhPT1hcmd1bWVudHNbMV0/fn5hcmd1bWVudHNbMV06dGhpcy5zY3JvbGxUb3ApfX0sZS5wcm90b3R5cGUuc2Nyb2xsQnk9ZnVuY3Rpb24oKXt2b2lkIDAhPT1hcmd1bWVudHNbMF0mJighMCE9PWYoYXJndW1lbnRzWzBdKT90aGlzLnNjcm9sbCh7bGVmdDp+fmFyZ3VtZW50c1swXS5sZWZ0K3RoaXMuc2Nyb2xsTGVmdCx0b3A6fn5hcmd1bWVudHNbMF0udG9wK3RoaXMuc2Nyb2xsVG9wLGJlaGF2aW9yOmFyZ3VtZW50c1swXS5iZWhhdmlvcn0pOmkuZWxlbWVudFNjcm9sbC5jYWxsKHRoaXMsdm9pZCAwIT09YXJndW1lbnRzWzBdLmxlZnQ/fn5hcmd1bWVudHNbMF0ubGVmdCt0aGlzLnNjcm9sbExlZnQ6fn5hcmd1bWVudHNbMF0rdGhpcy5zY3JvbGxMZWZ0LHZvaWQgMCE9PWFyZ3VtZW50c1swXS50b3A/fn5hcmd1bWVudHNbMF0udG9wK3RoaXMuc2Nyb2xsVG9wOn5+YXJndW1lbnRzWzFdK3RoaXMuc2Nyb2xsVG9wKSl9LGUucHJvdG90eXBlLnNjcm9sbEludG9WaWV3PWZ1bmN0aW9uKCl7aWYoITAhPT1mKGFyZ3VtZW50c1swXSkpe3ZhciBsPWZ1bmN0aW9uKG8pe2Zvcig7byE9PXQuYm9keSYmITE9PT0oZT1wKGw9byxcIllcIikmJmEobCxcIllcIikscj1wKGwsXCJYXCIpJiZhKGwsXCJYXCIpLGV8fHIpOylvPW8ucGFyZW50Tm9kZXx8by5ob3N0O3ZhciBsLGUscjtyZXR1cm4gb30odGhpcyksZT1sLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLHI9dGhpcy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtsIT09dC5ib2R5PyhoLmNhbGwodGhpcyxsLGwuc2Nyb2xsTGVmdCtyLmxlZnQtZS5sZWZ0LGwuc2Nyb2xsVG9wK3IudG9wLWUudG9wKSxcImZpeGVkXCIhPT1vLmdldENvbXB1dGVkU3R5bGUobCkucG9zaXRpb24mJm8uc2Nyb2xsQnkoe2xlZnQ6ZS5sZWZ0LHRvcDplLnRvcCxiZWhhdmlvcjpcInNtb290aFwifSkpOm8uc2Nyb2xsQnkoe2xlZnQ6ci5sZWZ0LHRvcDpyLnRvcCxiZWhhdmlvcjpcInNtb290aFwifSl9ZWxzZSBpLnNjcm9sbEludG9WaWV3LmNhbGwodGhpcyx2b2lkIDA9PT1hcmd1bWVudHNbMF18fGFyZ3VtZW50c1swXSl9fWZ1bmN0aW9uIG4obyx0KXt0aGlzLnNjcm9sbExlZnQ9byx0aGlzLnNjcm9sbFRvcD10fWZ1bmN0aW9uIGYobyl7aWYobnVsbD09PW98fFwib2JqZWN0XCIhPXR5cGVvZiBvfHx2b2lkIDA9PT1vLmJlaGF2aW9yfHxcImF1dG9cIj09PW8uYmVoYXZpb3J8fFwiaW5zdGFudFwiPT09by5iZWhhdmlvcilyZXR1cm4hMDtpZihcIm9iamVjdFwiPT10eXBlb2YgbyYmXCJzbW9vdGhcIj09PW8uYmVoYXZpb3IpcmV0dXJuITE7dGhyb3cgbmV3IFR5cGVFcnJvcihcImJlaGF2aW9yIG1lbWJlciBvZiBTY3JvbGxPcHRpb25zIFwiK28uYmVoYXZpb3IrXCIgaXMgbm90IGEgdmFsaWQgdmFsdWUgZm9yIGVudW1lcmF0aW9uIFNjcm9sbEJlaGF2aW9yLlwiKX1mdW5jdGlvbiBwKG8sdCl7cmV0dXJuXCJZXCI9PT10P28uY2xpZW50SGVpZ2h0K2M8by5zY3JvbGxIZWlnaHQ6XCJYXCI9PT10P28uY2xpZW50V2lkdGgrYzxvLnNjcm9sbFdpZHRoOnZvaWQgMH1mdW5jdGlvbiBhKHQsbCl7dmFyIGU9by5nZXRDb21wdXRlZFN0eWxlKHQsbnVsbClbXCJvdmVyZmxvd1wiK2xdO3JldHVyblwiYXV0b1wiPT09ZXx8XCJzY3JvbGxcIj09PWV9ZnVuY3Rpb24gZCh0KXt2YXIgbCxlLGksYyxuPShzKCktdC5zdGFydFRpbWUpL3I7Yz1uPW4+MT8xOm4sbD0uNSooMS1NYXRoLmNvcyhNYXRoLlBJKmMpKSxlPXQuc3RhcnRYKyh0LngtdC5zdGFydFgpKmwsaT10LnN0YXJ0WSsodC55LXQuc3RhcnRZKSpsLHQubWV0aG9kLmNhbGwodC5zY3JvbGxhYmxlLGUsaSksZT09PXQueCYmaT09PXQueXx8by5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoZC5iaW5kKG8sdCkpfWZ1bmN0aW9uIGgobCxlLHIpe3ZhciBjLGYscCxhLGg9cygpO2w9PT10LmJvZHk/KGM9byxmPW8uc2Nyb2xsWHx8by5wYWdlWE9mZnNldCxwPW8uc2Nyb2xsWXx8by5wYWdlWU9mZnNldCxhPWkuc2Nyb2xsKTooYz1sLGY9bC5zY3JvbGxMZWZ0LHA9bC5zY3JvbGxUb3AsYT1uKSxkKHtzY3JvbGxhYmxlOmMsbWV0aG9kOmEsc3RhcnRUaW1lOmgsc3RhcnRYOmYsc3RhcnRZOnAseDplLHk6cn0pfX1cIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyYmXCJ1bmRlZmluZWRcIiE9dHlwZW9mIG1vZHVsZT9tb2R1bGUuZXhwb3J0cz17cG9seWZpbGw6b306bygpfSgpOyIsInZhciBib2R5RWxlbSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2JvZHknKTtcblxudmFyIHdheXBvaW50ID0gbmV3IFdheXBvaW50KHtcbiAgZWxlbWVudDogYm9keUVsZW0gLFxuICBvZmZzZXQ6IDEwMCxcbiAgaGFuZGxlcjogZnVuY3Rpb24oZGlyZWN0aW9uKSB7XG4gICAgaWYoZGlyZWN0aW9uID09PSBcImRvd25cIil7XG4gICAgICBib2R5RWxlbS5jbGFzc0xpc3QuYWRkKFwidG8tdG9wLXZpc2libGVcIilcbiAgICB9ZWxzZXtcbiAgICAgIGJvZHlFbGVtLmNsYXNzTGlzdC5yZW1vdmUoXCJ0by10b3AtdmlzaWJsZVwiKVxuICAgIH1cbiAgfVxufSk7XG5cbnZhciB0b1RvcCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoXCIudG8tdG9wXCIpO1xudG9Ub3AuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpPT57XG4gICAgalF1ZXJ5KCdodG1sLGJvZHknKS5hbmltYXRlKHsgc2Nyb2xsVG9wOiAwIH0pO1xufSk7XG5cbnZhciB3b3JrVGlsZXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcud29yay10aWxlJyk7XG5cbmlmKHdvcmtUaWxlcy5sZW5ndGggPiAwKXtcbiAgd29ya1RpbGVzLmZvckVhY2goZnVuY3Rpb24odGlsZSl7XG4gICAgdmFyIGFuaW0gPSBuZXcgV2F5cG9pbnQoe1xuICAgICAgICBlbGVtZW50OiB0aWxlLFxuICAgICAgICBvZmZzZXQ6IFwiNzUlXCIsXG4gICAgICAgIGhhbmRsZXI6IGZ1bmN0aW9uKGRpcmVjdGlvbikge1xuICAgICAgICAgIHRpbGUuY2xhc3NMaXN0LmFkZChcImFjdGl2ZVwiKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH0pO1xufVxuXG5cbnZhciBkZXRhaWxTZWN0aW9ucyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJy5kZXRhaWwtc2VjdGlvbicpO1xuXG5pZihkZXRhaWxTZWN0aW9ucy5sZW5ndGggPiAwKXtcbiAgZGV0YWlsU2VjdGlvbnMuZm9yRWFjaChmdW5jdGlvbih0aWxlKXtcbiAgICB2YXIgYW5pbSA9IG5ldyBXYXlwb2ludCh7XG4gICAgICAgIGVsZW1lbnQ6IHRpbGUsXG4gICAgICAgIG9mZnNldDogXCI3NSVcIixcbiAgICAgICAgaGFuZGxlcjogZnVuY3Rpb24oZGlyZWN0aW9uKSB7XG4gICAgICAgICAgdGlsZS5jbGFzc0xpc3QuYWRkKFwiYWN0aXZlXCIpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfSlcbn1cblxudmFyIGFib3V0U2VjdGlvbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy50aXRsZScpO1xuXG5pZihhYm91dFNlY3Rpb24pe1xuICB2YXIgYWJvdXRBbmltID0gbmV3IFdheXBvaW50KHtcbiAgICBlbGVtZW50OiBhYm91dFNlY3Rpb24sXG4gICAgb2Zmc2V0OiBcIjc1JVwiLFxuICAgIGhhbmRsZXI6IGZ1bmN0aW9uKGRpcmVjdGlvbikge1xuICAgICAgYWJvdXRTZWN0aW9uLmNsYXNzTGlzdC5hZGQoXCJhY3RpdmVcIik7XG4gICAgfVxuICB9KTtcbn0iLCJmdW5jdGlvbiBnZXRWaWRlb3MoKXtcbiAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi52aW1lby1wbGF5ZXJcIik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVZpZGVvcygpe1xuICAgIGNvbnN0IHZpZGVvcyA9IGdldFZpZGVvcygpO1xuICAgIHZpZGVvcy5mb3JFYWNoKCh2aWRlbyk9PnsgXG4gICAgICAgIGNvbnN0IHZpZGlkID0gdmlkZW8uZ2V0QXR0cmlidXRlKFwidmltZW9JRFwiKTtcbiAgICAgICAgY29uc3QgYXV0b3BsYXkgPSB2aWRlby5nZXRBdHRyaWJ1dGUoXCJkYXRhLWF1dG9wbGF5XCIpID8gdHJ1ZSA6IGZhbHNlO1xuIFxuICAgICAgICBsZXQgdmlkZW9QbGF5ZXIgPSBuZXcgVmltZW8uUGxheWVyKHZpZGVvICwge1xuICAgICAgICAgICAgdXJsIDogYGh0dHBzOi8vdmltZW8uY29tLyR7dmlkaWR9YCxcbiAgICAgICAgICAgIGxvb3AgOiB0cnVlLFxuICAgICAgICAgICAgbXV0ZWQgOiBhdXRvcGxheSxcbiAgICAgICAgICAgIGNvbnRyb2xzIDogIWF1dG9wbGF5LFxuICAgICAgICAgICAgYXV0b3BsYXkgOiBhdXRvcGxheSxcbiAgICAgICAgICAgIGF1dG9wYXVzZSA6IDBcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdmlkZW9QbGF5ZXIucmVhZHkoKS50aGVuKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgaW5WaWV3KCcjdicgKyB2aWRpZClcbiAgICAgICAgICAgICAgICAub24oJ2VudGVyJywgKGVsKT0+e1xuXG4gICAgICAgICAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN2JyArIHZpZGlkICsgXCIgaWZyYW1lXCIpLnJlbW92ZUF0dHJpYnV0ZShcInRpdGxlXCIpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmKGF1dG9wbGF5KXtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpZGVvUGxheWVyLnBsYXkoKS50aGVuKCgpPT57XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3N0YXJ0aW5nJyArIHZpZGlkICsgXCIgQVVUT1BMQVk6IFwiICsgYXV0b3BsYXkpXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgLm9uKCdleGl0JywgZWwgPT4ge1xuXG4gICAgICAgICAgICAgICAgICAgIHZpZGVvUGxheWVyLnBhdXNlKCkudGhlbigoKT0+e1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3BhdXNpbmcnICsgdmlkaWQpXG4gICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7IFxuICAgIH0pO1xufVxuXG5nZXRWaWRlb3MoKS5sZW5ndGggPiAwID8gY3JlYXRlVmlkZW9zKCkgOiAnJztcblxuXG5cblxuIl19
