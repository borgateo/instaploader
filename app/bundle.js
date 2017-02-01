(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(factory());
}(this, (function () { 'use strict';

/** Virtual DOM Node */
function VNode(nodeName, attributes, children) {
	/** @type {string|function} */
	this.nodeName = nodeName;

	/** @type {object<string>|undefined} */
	this.attributes = attributes;

	/** @type {array<VNode>|undefined} */
	this.children = children;

	/** Reference to the given key. */
	this.key = attributes && attributes.key;
}

/** Global options
 *	@public
 *	@namespace options {Object}
 */
var options = {

	/** If `true`, `prop` changes trigger synchronous component updates.
  *	@name syncComponentUpdates
  *	@type Boolean
  *	@default true
  */
	//syncComponentUpdates: true,

	/** Processes all created VNodes.
  *	@param {VNode} vnode	A newly-created VNode to normalize/process
  */
	//vnode(vnode) { }

	/** Hook invoked after a component is mounted. */
	// afterMount(component) { }

	/** Hook invoked after the DOM is updated with a component's latest render. */
	// afterUpdate(component) { }

	/** Hook invoked immediately before a component is unmounted. */
	// beforeUnmount(component) { }
};

var stack = [];

/** JSX/hyperscript reviver
*	Benchmarks: https://esbench.com/bench/57ee8f8e330ab09900a1a1a0
 *	@see http://jasonformat.com/wtf-is-jsx
 *	@public
 *  @example
 *  /** @jsx h *\/
 *  import { render, h } from 'preact';
 *  render(<span>foo</span>, document.body);
 */
function h(nodeName, attributes) {
	var children = [],
	    lastSimple = void 0,
	    child = void 0,
	    simple = void 0,
	    i = void 0;
	for (i = arguments.length; i-- > 2;) {
		stack.push(arguments[i]);
	}
	if (attributes && attributes.children) {
		if (!stack.length) stack.push(attributes.children);
		delete attributes.children;
	}
	while (stack.length) {
		if ((child = stack.pop()) instanceof Array) {
			for (i = child.length; i--;) {
				stack.push(child[i]);
			}
		} else if (child != null && child !== false) {
			if (typeof child == 'number' || child === true) child = String(child);
			simple = typeof child == 'string';
			if (simple && lastSimple) {
				children[children.length - 1] += child;
			} else {
				children.push(child);
				lastSimple = simple;
			}
		}
	}

	var p = new VNode(nodeName, attributes || undefined, children);

	// if a "vnode hook" is defined, pass every created VNode to it
	if (options.vnode) options.vnode(p);

	return p;
}

/** Copy own-properties from `props` onto `obj`.
 *	@returns obj
 *	@private
 */
function extend(obj, props) {
	if (props) {
		for (var i in props) {
			obj[i] = props[i];
		}
	}
	return obj;
}

/** Fast clone. Note: does not filter out non-own properties.
 *	@see https://esbench.com/bench/56baa34f45df6895002e03b6
 */
function clone(obj) {
	return extend({}, obj);
}

/** Get a deep property value from the given object, expressed in dot-notation.
 *	@private
 */
function delve(obj, key) {
	for (var p = key.split('.'), i = 0; i < p.length && obj; i++) {
		obj = obj[p[i]];
	}
	return obj;
}

/** @private is the given object a Function? */
function isFunction(obj) {
	return 'function' === typeof obj;
}

/** @private is the given object a String? */
function isString(obj) {
	return 'string' === typeof obj;
}

/** Convert a hashmap of CSS classes to a space-delimited className string
 *	@private
 */
function hashToClassName(c) {
	var str = '';
	for (var prop in c) {
		if (c[prop]) {
			if (str) str += ' ';
			str += prop;
		}
	}
	return str;
}

/** Just a memoized String#toLowerCase */
var lcCache = {};
var toLowerCase = function toLowerCase(s) {
	return lcCache[s] || (lcCache[s] = s.toLowerCase());
};

/** Call a function asynchronously, as soon as possible.
 *	@param {Function} callback
 */
var resolved = typeof Promise !== 'undefined' && Promise.resolve();
var defer = resolved ? function (f) {
	resolved.then(f);
} : setTimeout;

// render modes

var NO_RENDER = 0;
var SYNC_RENDER = 1;
var FORCE_RENDER = 2;
var ASYNC_RENDER = 3;

var EMPTY = {};

var ATTR_KEY = typeof Symbol !== 'undefined' ? Symbol.for('preactattr') : '__preactattr_';

// DOM properties that should NOT have "px" added when numeric
var NON_DIMENSION_PROPS = {
	boxFlex: 1, boxFlexGroup: 1, columnCount: 1, fillOpacity: 1, flex: 1, flexGrow: 1,
	flexPositive: 1, flexShrink: 1, flexNegative: 1, fontWeight: 1, lineClamp: 1, lineHeight: 1,
	opacity: 1, order: 1, orphans: 1, strokeOpacity: 1, widows: 1, zIndex: 1, zoom: 1
};

// DOM event types that do not bubble and should be attached via useCapture
var NON_BUBBLING_EVENTS = { blur: 1, error: 1, focus: 1, load: 1, resize: 1, scroll: 1 };

function createLinkedState(component, key, eventPath) {
	var path = key.split('.');
	return function (e) {
		var t = e && e.target || this,
		    state = {},
		    obj = state,
		    v = isString(eventPath) ? delve(e, eventPath) : t.nodeName ? t.type.match(/^che|rad/) ? t.checked : t.value : e,
		    i = 0;
		for (; i < path.length - 1; i++) {
			obj = obj[path[i]] || (obj[path[i]] = !i && component.state[path[i]] || {});
		}
		obj[path[i]] = v;
		component.setState(state);
	};
}

var items = [];

function enqueueRender(component) {
	if (!component._dirty && (component._dirty = true) && items.push(component) == 1) {
		(options.debounceRendering || defer)(rerender);
	}
}

function rerender() {
	var p = void 0,
	    list = items;
	items = [];
	while (p = list.pop()) {
		if (p._dirty) renderComponent(p);
	}
}

function isFunctionalComponent(vnode) {
  var nodeName = vnode && vnode.nodeName;
  return nodeName && isFunction(nodeName) && !(nodeName.prototype && nodeName.prototype.render);
}

/** Construct a resultant VNode from a VNode referencing a stateless functional component.
 *	@param {VNode} vnode	A VNode with a `nodeName` property that is a reference to a function.
 *	@private
 */
function buildFunctionalComponent(vnode, context) {
  return vnode.nodeName(getNodeProps(vnode), context || EMPTY);
}

function isSameNodeType(node, vnode) {
	if (isString(vnode)) {
		return node instanceof Text;
	}
	if (isString(vnode.nodeName)) {
		return !node._componentConstructor && isNamedNode(node, vnode.nodeName);
	}
	if (isFunction(vnode.nodeName)) {
		return (node._componentConstructor ? node._componentConstructor === vnode.nodeName : true) || isFunctionalComponent(vnode);
	}
}

function isNamedNode(node, nodeName) {
	return node.normalizedNodeName === nodeName || toLowerCase(node.nodeName) === toLowerCase(nodeName);
}

/**
 * Reconstruct Component-style `props` from a VNode.
 * Ensures default/fallback values from `defaultProps`:
 * Own-properties of `defaultProps` not present in `vnode.attributes` are added.
 * @param {VNode} vnode
 * @returns {Object} props
 */
function getNodeProps(vnode) {
	var props = clone(vnode.attributes);
	props.children = vnode.children;

	var defaultProps = vnode.nodeName.defaultProps;
	if (defaultProps) {
		for (var i in defaultProps) {
			if (props[i] === undefined) {
				props[i] = defaultProps[i];
			}
		}
	}

	return props;
}

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
};











var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();









var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

function removeNode(node) {
	var p = node.parentNode;
	if (p) p.removeChild(node);
}

/** Set a named attribute on the given Node, with special behavior for some names and event handlers.
 *	If `value` is `null`, the attribute/handler will be removed.
 *	@param {Element} node	An element to mutate
 *	@param {string} name	The name/key to set, such as an event or attribute name
 *	@param {any} value		An attribute value, such as a function to be used as an event handler
 *	@param {any} previousValue	The last value that was set for this name/node pair
 *	@private
 */
function setAccessor(node, name, old, value, isSvg) {

	if (name === 'className') name = 'class';

	if (name === 'class' && value && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
		value = hashToClassName(value);
	}

	if (name === 'key') {
		// ignore
	} else if (name === 'class' && !isSvg) {
		node.className = value || '';
	} else if (name === 'style') {
		if (!value || isString(value) || isString(old)) {
			node.style.cssText = value || '';
		}
		if (value && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
			if (!isString(old)) {
				for (var i in old) {
					if (!(i in value)) node.style[i] = '';
				}
			}
			for (var _i in value) {
				node.style[_i] = typeof value[_i] === 'number' && !NON_DIMENSION_PROPS[_i] ? value[_i] + 'px' : value[_i];
			}
		}
	} else if (name === 'dangerouslySetInnerHTML') {
		node.innerHTML = value && value.__html || '';
	} else if (name[0] == 'o' && name[1] == 'n') {
		var l = node._listeners || (node._listeners = {});
		name = toLowerCase(name.substring(2));
		// @TODO: this might be worth it later, un-breaks focus/blur bubbling in IE9:
		// if (node.attachEvent) name = name=='focus'?'focusin':name=='blur'?'focusout':name;
		if (value) {
			if (!l[name]) node.addEventListener(name, eventProxy, !!NON_BUBBLING_EVENTS[name]);
		} else if (l[name]) {
			node.removeEventListener(name, eventProxy, !!NON_BUBBLING_EVENTS[name]);
		}
		l[name] = value;
	} else if (name !== 'list' && name !== 'type' && !isSvg && name in node) {
		setProperty(node, name, value == null ? '' : value);
		if (value == null || value === false) node.removeAttribute(name);
	} else {
		var ns = isSvg && name.match(/^xlink\:?(.+)/);
		if (value == null || value === false) {
			if (ns) node.removeAttributeNS('http://www.w3.org/1999/xlink', toLowerCase(ns[1]));else node.removeAttribute(name);
		} else if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) !== 'object' && !isFunction(value)) {
			if (ns) node.setAttributeNS('http://www.w3.org/1999/xlink', toLowerCase(ns[1]), value);else node.setAttribute(name, value);
		}
	}
}

/** Attempt to set a DOM property to the given value.
 *	IE & FF throw for certain property-value combinations.
 */
function setProperty(node, name, value) {
	try {
		node[name] = value;
	} catch (e) {}
}

/** Proxy an event to hooked event handlers
 *	@private
 */
function eventProxy(e) {
	return this._listeners[e.type](options.event && options.event(e) || e);
}

var nodes = {};

function collectNode(node) {
	removeNode(node);

	if (node instanceof Element) {
		node._component = node._componentConstructor = null;

		var name = node.normalizedNodeName || toLowerCase(node.nodeName);
		(nodes[name] || (nodes[name] = [])).push(node);
	}
}

function createNode(nodeName, isSvg) {
	var name = toLowerCase(nodeName),
	    node = nodes[name] && nodes[name].pop() || (isSvg ? document.createElementNS('http://www.w3.org/2000/svg', nodeName) : document.createElement(nodeName));
	node.normalizedNodeName = name;
	return node;
}

var mounts = [];

/** Diff recursion count, used to track the end of the diff cycle. */
var diffLevel = 0;

/** Global flag indicating if the diff is currently within an SVG */
var isSvgMode = false;

/** Global flag indicating if the diff is performing hydration */
var hydrating = false;

/** Invoke queued componentDidMount lifecycle methods */
function flushMounts() {
	var c = void 0;
	while (c = mounts.pop()) {
		if (options.afterMount) options.afterMount(c);
		if (c.componentDidMount) c.componentDidMount();
	}
}

/** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
 *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
 *	@returns {Element} dom			The created/mutated element
 *	@private
 */
function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	// diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
	if (!diffLevel++) {
		// when first starting the diff, check if we're diffing an SVG or within an SVG
		isSvgMode = parent instanceof SVGElement;

		// hydration is inidicated by the existing element to be diffed not having a prop cache
		hydrating = dom && !(ATTR_KEY in dom);
	}

	var ret = idiff(dom, vnode, context, mountAll);

	// append the element if its a new parent
	if (parent && ret.parentNode !== parent) parent.appendChild(ret);

	// diffLevel being reduced to 0 means we're exiting the diff
	if (! --diffLevel) {
		hydrating = false;
		// invoke queued componentDidMount lifecycle methods
		if (!componentRoot) flushMounts();
	}

	return ret;
}

function idiff(dom, vnode, context, mountAll) {
	var originalAttributes = vnode && vnode.attributes;

	// Resolve ephemeral Pure Functional Components
	while (isFunctionalComponent(vnode)) {
		vnode = buildFunctionalComponent(vnode, context);
	}

	// empty values (null & undefined) render as empty Text nodes
	if (vnode == null) vnode = '';

	// Fast case: Strings create/update Text nodes.
	if (isString(vnode)) {
		// update if it's already a Text node
		if (dom && dom instanceof Text) {
			if (dom.nodeValue != vnode) {
				dom.nodeValue = vnode;
			}
		} else {
			// it wasn't a Text node: replace it with one and recycle the old Element
			if (dom) recollectNodeTree(dom);
			dom = document.createTextNode(vnode);
		}

		// Mark for non-hydration updates
		dom[ATTR_KEY] = true;
		return dom;
	}

	// If the VNode represents a Component, perform a component diff.
	if (isFunction(vnode.nodeName)) {
		return buildComponentFromVNode(dom, vnode, context, mountAll);
	}

	var out = dom,
	    nodeName = String(vnode.nodeName),
	    // @TODO this masks undefined component errors as `<undefined>`
	prevSvgMode = isSvgMode,
	    vchildren = vnode.children;

	// SVGs have special namespace stuff.
	// This tracks entering and exiting that namespace when descending through the tree.
	isSvgMode = nodeName === 'svg' ? true : nodeName === 'foreignObject' ? false : isSvgMode;

	if (!dom) {
		// case: we had no element to begin with
		// - create an element to with the nodeName from VNode
		out = createNode(nodeName, isSvgMode);
	} else if (!isNamedNode(dom, nodeName)) {
		// case: Element and VNode had different nodeNames
		// - need to create the correct Element to match VNode
		// - then migrate children from old to new

		out = createNode(nodeName, isSvgMode);

		// move children into the replacement node
		while (dom.firstChild) {
			out.appendChild(dom.firstChild);
		} // if the previous Element was mounted into the DOM, replace it inline
		if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

		// recycle the old element (skips non-Element node types)
		recollectNodeTree(dom);
	}

	var fc = out.firstChild,
	    props = out[ATTR_KEY];

	// Attribute Hydration: if there is no prop cache on the element,
	// ...create it and populate it with the element's attributes.
	if (!props) {
		out[ATTR_KEY] = props = {};
		for (var a = out.attributes, i = a.length; i--;) {
			props[a[i].name] = a[i].value;
		}
	}

	// Apply attributes/props from VNode to the DOM Element:
	diffAttributes(out, vnode.attributes, props);

	// Optimization: fast-path for elements containing a single TextNode:
	if (!hydrating && vchildren && vchildren.length === 1 && typeof vchildren[0] === 'string' && fc && fc instanceof Text && !fc.nextSibling) {
		if (fc.nodeValue != vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	}
	// otherwise, if there are existing or new children, diff them:
	else if (vchildren && vchildren.length || fc) {
			innerDiffNode(out, vchildren, context, mountAll);
		}

	// invoke original ref (from before resolving Pure Functional Components):
	if (originalAttributes && typeof originalAttributes.ref === 'function') {
		(props.ref = originalAttributes.ref)(out);
	}

	isSvgMode = prevSvgMode;

	return out;
}

/** Apply child and attribute changes between a VNode and a DOM Node to the DOM.
 *	@param {Element} dom		Element whose children should be compared & mutated
 *	@param {Array} vchildren	Array of VNodes to compare to `dom.childNodes`
 *	@param {Object} context		Implicitly descendant context object (from most recent `getChildContext()`)
 *	@param {Boolean} moutAll
 */
function innerDiffNode(dom, vchildren, context, mountAll) {
	var originalChildren = dom.childNodes,
	    children = [],
	    keyed = {},
	    keyedLen = 0,
	    min = 0,
	    len = originalChildren.length,
	    childrenLen = 0,
	    vlen = vchildren && vchildren.length,
	    j = void 0,
	    c = void 0,
	    vchild = void 0,
	    child = void 0;

	if (len) {
		for (var i = 0; i < len; i++) {
			var _child = originalChildren[i],
			    props = _child[ATTR_KEY],
			    key = vlen ? (c = _child._component) ? c.__key : props ? props.key : null : null;
			if (key != null) {
				keyedLen++;
				keyed[key] = _child;
			} else if (hydrating || props) {
				children[childrenLen++] = _child;
			}
		}
	}

	if (vlen) {
		for (var _i = 0; _i < vlen; _i++) {
			vchild = vchildren[_i];
			child = null;

			// if (isFunctionalComponent(vchild)) {
			// 	vchild = buildFunctionalComponent(vchild);
			// }

			// attempt to find a node based on key matching
			var _key = vchild.key;
			if (_key != null) {
				if (keyedLen && _key in keyed) {
					child = keyed[_key];
					keyed[_key] = undefined;
					keyedLen--;
				}
			}
			// attempt to pluck a node of the same type from the existing children
			else if (!child && min < childrenLen) {
					for (j = min; j < childrenLen; j++) {
						c = children[j];
						if (c && isSameNodeType(c, vchild)) {
							child = c;
							children[j] = undefined;
							if (j === childrenLen - 1) childrenLen--;
							if (j === min) min++;
							break;
						}
					}
				}

			// morph the matched/found/created DOM child to match vchild (deep)
			child = idiff(child, vchild, context, mountAll);

			if (child && child !== dom) {
				if (_i >= len) {
					dom.appendChild(child);
				} else if (child !== originalChildren[_i]) {
					if (child === originalChildren[_i + 1]) {
						removeNode(originalChildren[_i]);
					}
					dom.insertBefore(child, originalChildren[_i] || null);
				}
			}
		}
	}

	if (keyedLen) {
		for (var _i2 in keyed) {
			if (keyed[_i2]) recollectNodeTree(keyed[_i2]);
		}
	}

	// remove orphaned children
	while (min <= childrenLen) {
		child = children[childrenLen--];
		if (child) recollectNodeTree(child);
	}
}

/** Recursively recycle (or just unmount) a node an its descendants.
 *	@param {Node} node						DOM node to start unmount/removal from
 *	@param {Boolean} [unmountOnly=false]	If `true`, only triggers unmount lifecycle, skips removal
 */
function recollectNodeTree(node, unmountOnly) {
	var component = node._component;
	if (component) {
		// if node is owned by a Component, unmount that component (ends up recursing back here)
		unmountComponent(component, !unmountOnly);
	} else {
		// If the node's VNode had a ref function, invoke it with null here.
		// (this is part of the React spec, and smart for unsetting references)
		if (node[ATTR_KEY] && node[ATTR_KEY].ref) node[ATTR_KEY].ref(null);

		if (!unmountOnly) {
			collectNode(node);
		}

		// Recollect/unmount all children.
		// - we use .lastChild here because it causes less reflow than .firstChild
		// - it's also cheaper than accessing the .childNodes Live NodeList
		var c = void 0;
		while (c = node.lastChild) {
			recollectNodeTree(c, unmountOnly);
		}
	}
}

/** Apply differences in attributes from a VNode to the given DOM Element.
 *	@param {Element} dom		Element with attributes to diff `attrs` against
 *	@param {Object} attrs		The desired end-state key-value attribute pairs
 *	@param {Object} old			Current/previous attributes (from previous VNode or element's prop cache)
 */
function diffAttributes(dom, attrs, old) {
	// remove attributes no longer present on the vnode by setting them to undefined
	for (var name in old) {
		if (!(attrs && name in attrs) && old[name] != null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	// add new & update changed attributes
	if (attrs) {
		for (var _name in attrs) {
			if (_name !== 'children' && _name !== 'innerHTML' && (!(_name in old) || attrs[_name] !== (_name === 'value' || _name === 'checked' ? dom[_name] : old[_name]))) {
				setAccessor(dom, _name, old[_name], old[_name] = attrs[_name], isSvgMode);
			}
		}
	}
}

var components = {};

function collectComponent(component) {
	var name = component.constructor.name,
	    list = components[name];
	if (list) list.push(component);else components[name] = [component];
}

function createComponent(Ctor, props, context) {
	var inst = new Ctor(props, context),
	    list = components[Ctor.name];
	Component.call(inst, props, context);
	if (list) {
		for (var i = list.length; i--;) {
			if (list[i].constructor === Ctor) {
				inst.nextBase = list[i].nextBase;
				list.splice(i, 1);
				break;
			}
		}
	}
	return inst;
}

function setComponentProps(component, props, opts, context, mountAll) {
	if (component._disable) return;
	component._disable = true;

	if (component.__ref = props.ref) delete props.ref;
	if (component.__key = props.key) delete props.key;

	if (!component.base || mountAll) {
		if (component.componentWillMount) component.componentWillMount();
	} else if (component.componentWillReceiveProps) {
		component.componentWillReceiveProps(props, context);
	}

	if (context && context !== component.context) {
		if (!component.prevContext) component.prevContext = component.context;
		component.context = context;
	}

	if (!component.prevProps) component.prevProps = component.props;
	component.props = props;

	component._disable = false;

	if (opts !== NO_RENDER) {
		if (opts === SYNC_RENDER || options.syncComponentUpdates !== false || !component.base) {
			renderComponent(component, SYNC_RENDER, mountAll);
		} else {
			enqueueRender(component);
		}
	}

	if (component.__ref) component.__ref(component);
}

/** Render a Component, triggering necessary lifecycle events and taking High-Order Components into account.
 *	@param {Component} component
 *	@param {Object} [opts]
 *	@param {boolean} [opts.build=false]		If `true`, component will build and store a DOM node if not already associated with one.
 *	@private
 */
function renderComponent(component, opts, mountAll, isChild) {
	if (component._disable) return;

	var skip = void 0,
	    rendered = void 0,
	    props = component.props,
	    state = component.state,
	    context = component.context,
	    previousProps = component.prevProps || props,
	    previousState = component.prevState || state,
	    previousContext = component.prevContext || context,
	    isUpdate = component.base,
	    nextBase = component.nextBase,
	    initialBase = isUpdate || nextBase,
	    initialChildComponent = component._component,
	    inst = void 0,
	    cbase = void 0;

	// if updating
	if (isUpdate) {
		component.props = previousProps;
		component.state = previousState;
		component.context = previousContext;
		if (opts !== FORCE_RENDER && component.shouldComponentUpdate && component.shouldComponentUpdate(props, state, context) === false) {
			skip = true;
		} else if (component.componentWillUpdate) {
			component.componentWillUpdate(props, state, context);
		}
		component.props = props;
		component.state = state;
		component.context = context;
	}

	component.prevProps = component.prevState = component.prevContext = component.nextBase = null;
	component._dirty = false;

	if (!skip) {
		if (component.render) rendered = component.render(props, state, context);

		// context to pass to the child, can be updated via (grand-)parent component
		if (component.getChildContext) {
			context = extend(clone(context), component.getChildContext());
		}

		while (isFunctionalComponent(rendered)) {
			rendered = buildFunctionalComponent(rendered, context);
		}

		var childComponent = rendered && rendered.nodeName,
		    toUnmount = void 0,
		    base = void 0;

		if (isFunction(childComponent)) {
			// set up high order component link

			var childProps = getNodeProps(rendered);
			inst = initialChildComponent;

			if (inst && inst.constructor === childComponent && childProps.key == inst.__key) {
				setComponentProps(inst, childProps, SYNC_RENDER, context);
			} else {
				toUnmount = inst;

				inst = createComponent(childComponent, childProps, context);
				inst.nextBase = inst.nextBase || nextBase;
				inst._parentComponent = component;
				component._component = inst;
				setComponentProps(inst, childProps, NO_RENDER, context);
				renderComponent(inst, SYNC_RENDER, mountAll, true);
			}

			base = inst.base;
		} else {
			cbase = initialBase;

			// destroy high order component link
			toUnmount = initialChildComponent;
			if (toUnmount) {
				cbase = component._component = null;
			}

			if (initialBase || opts === SYNC_RENDER) {
				if (cbase) cbase._component = null;
				base = diff(cbase, rendered, context, mountAll || !isUpdate, initialBase && initialBase.parentNode, true);
			}
		}

		if (initialBase && base !== initialBase && inst !== initialChildComponent) {
			var baseParent = initialBase.parentNode;
			if (baseParent && base !== baseParent) {
				baseParent.replaceChild(base, initialBase);

				if (!toUnmount) {
					initialBase._component = null;
					recollectNodeTree(initialBase);
				}
			}
		}

		if (toUnmount) {
			unmountComponent(toUnmount, base !== initialBase);
		}

		component.base = base;
		if (base && !isChild) {
			var componentRef = component,
			    t = component;
			while (t = t._parentComponent) {
				(componentRef = t).base = base;
			}
			base._component = componentRef;
			base._componentConstructor = componentRef.constructor;
		}
	}

	if (!isUpdate || mountAll) {
		mounts.unshift(component);
	} else if (!skip) {
		if (component.componentDidUpdate) {
			component.componentDidUpdate(previousProps, previousState, previousContext);
		}
		if (options.afterUpdate) options.afterUpdate(component);
	}

	var cb = component._renderCallbacks,
	    fn = void 0;
	if (cb) while (fn = cb.pop()) {
		fn.call(component);
	}if (!diffLevel && !isChild) flushMounts();
}

/** Apply the Component referenced by a VNode to the DOM.
 *	@param {Element} dom	The DOM node to mutate
 *	@param {VNode} vnode	A Component-referencing VNode
 *	@returns {Element} dom	The created/mutated element
 *	@private
 */
function buildComponentFromVNode(dom, vnode, context, mountAll) {
	var c = dom && dom._component,
	    oldDom = dom,
	    isDirectOwner = c && dom._componentConstructor === vnode.nodeName,
	    isOwner = isDirectOwner,
	    props = getNodeProps(vnode);
	while (c && !isOwner && (c = c._parentComponent)) {
		isOwner = c.constructor === vnode.nodeName;
	}

	if (c && isOwner && (!mountAll || c._component)) {
		setComponentProps(c, props, ASYNC_RENDER, context, mountAll);
		dom = c.base;
	} else {
		if (c && !isDirectOwner) {
			unmountComponent(c, true);
			dom = oldDom = null;
		}

		c = createComponent(vnode.nodeName, props, context);
		if (dom && !c.nextBase) {
			c.nextBase = dom;
			// passing dom/oldDom as nextBase will recycle it if unused, so bypass recycling on L241:
			oldDom = null;
		}
		setComponentProps(c, props, SYNC_RENDER, context, mountAll);
		dom = c.base;

		if (oldDom && dom !== oldDom) {
			oldDom._component = null;
			recollectNodeTree(oldDom);
		}
	}

	return dom;
}

/** Remove a component from the DOM and recycle it.
 *	@param {Element} dom			A DOM node from which to unmount the given Component
 *	@param {Component} component	The Component instance to unmount
 *	@private
 */
function unmountComponent(component, remove) {
	if (options.beforeUnmount) options.beforeUnmount(component);

	// console.log(`${remove?'Removing':'Unmounting'} component: ${component.constructor.name}`);
	var base = component.base;

	component._disable = true;

	if (component.componentWillUnmount) component.componentWillUnmount();

	component.base = null;

	// recursively tear down & recollect high-order component children:
	var inner = component._component;
	if (inner) {
		unmountComponent(inner, remove);
	} else if (base) {
		if (base[ATTR_KEY] && base[ATTR_KEY].ref) base[ATTR_KEY].ref(null);

		component.nextBase = base;

		if (remove) {
			removeNode(base);
			collectComponent(component);
		}
		var c = void 0;
		while (c = base.lastChild) {
			recollectNodeTree(c, !remove);
		} // removeOrphanedChildren(base.childNodes, true);
	}

	if (component.__ref) component.__ref(null);
	if (component.componentDidUnmount) component.componentDidUnmount();
}

function Component(props, context) {
	/** @private */
	this._dirty = true;
	// /** @public */
	// this._disableRendering = false;
	// /** @public */
	// this.prevState = this.prevProps = this.prevContext = this.base = this.nextBase = this._parentComponent = this._component = this.__ref = this.__key = this._linkedStates = this._renderCallbacks = null;
	/** @public */
	this.context = context;
	/** @type {object} */
	this.props = props;
	/** @type {object} */
	if (!this.state) this.state = {};
}

extend(Component.prototype, {

	/** Returns a `boolean` value indicating if the component should re-render when receiving the given `props` and `state`.
  *	@param {object} nextProps
  *	@param {object} nextState
  *	@param {object} nextContext
  *	@returns {Boolean} should the component re-render
  *	@name shouldComponentUpdate
  *	@function
  */
	// shouldComponentUpdate() {
	// 	return true;
	// },


	/** Returns a function that sets a state property when called.
  *	Calling linkState() repeatedly with the same arguments returns a cached link function.
  *
  *	Provides some built-in special cases:
  *		- Checkboxes and radio buttons link their boolean `checked` value
  *		- Inputs automatically link their `value` property
  *		- Event paths fall back to any associated Component if not found on an element
  *		- If linked value is a function, will invoke it and use the result
  *
  *	@param {string} key				The path to set - can be a dot-notated deep key
  *	@param {string} [eventPath]		If set, attempts to find the new state value at a given dot-notated path within the object passed to the linkedState setter.
  *	@returns {function} linkStateSetter(e)
  *
  *	@example Update a "text" state value when an input changes:
  *		<input onChange={ this.linkState('text') } />
  *
  *	@example Set a deep state value on click
  *		<button onClick={ this.linkState('touch.coords', 'touches.0') }>Tap</button
  */
	linkState: function linkState(key, eventPath) {
		var c = this._linkedStates || (this._linkedStates = {});
		return c[key + eventPath] || (c[key + eventPath] = createLinkedState(this, key, eventPath));
	},


	/** Update component state by copying properties from `state` to `this.state`.
  *	@param {object} state		A hash of state properties to update with new values
  */
	setState: function setState(state, callback) {
		var s = this.state;
		if (!this.prevState) this.prevState = clone(s);
		extend(s, isFunction(state) ? state(s, this.props) : state);
		if (callback) (this._renderCallbacks = this._renderCallbacks || []).push(callback);
		enqueueRender(this);
	},


	/** Immediately perform a synchronous re-render of the component.
  *	@private
  */
	forceUpdate: function forceUpdate() {
		renderComponent(this, FORCE_RENDER);
	},


	/** Accepts `props` and `state`, and returns a new Virtual DOM tree to build.
  *	Virtual DOM is generally constructed via [JSX](http://jasonformat.com/wtf-is-jsx).
  *	@param {object} props		Props (eg: JSX attributes) received from parent element/component
  *	@param {object} state		The component's current state
  *	@param {object} context		Context object (if a parent component has provided context)
  *	@returns VNode
  */
	render: function render() {}
});

function render(vnode, parent, merge) {
  return diff(merge, vnode, {}, false, parent);
}

var PLACEHOLDER = 'images/placeholder.png';

var UploadImageComponent = function (_Component) {
  inherits(UploadImageComponent, _Component);

  function UploadImageComponent() {
    classCallCheck(this, UploadImageComponent);

    var _this = possibleConstructorReturn(this, (UploadImageComponent.__proto__ || Object.getPrototypeOf(UploadImageComponent)).call(this));

    _this.state = {
      file: '',
      imagePreviewSrc: PLACEHOLDER
    };
    return _this;
  }

  createClass(UploadImageComponent, [{
    key: '_handleImageChange',
    value: function _handleImageChange(e) {
      var _this2 = this;

      var reader = new FileReader();
      var file = e.target.files[0] || '';

      // clicking on Cancel -> restore placeholder
      if (!file) {
        this.setState({
          imagePreviewSrc: PLACEHOLDER
        });
        return;
      }

      reader.onloadend = function () {
        _this2.setState({
          file: file,
          imagePreviewSrc: reader.result
        });
      };
      reader.readAsDataURL(file);

      this.props.onChange({ image: file.path });
    }
  }, {
    key: 'render',
    value: function render$$1() {
      return h(
        'div',
        { 'class': 'upload-image-component' },
        h(
          'label',
          { 'class': 'note', 'for': 'upload-file' },
          'Image (?',
          h(
            'span',
            { 'class': 'note-description' },
            ' : only jpg format is supported'
          ),
          ')'
        ),
        h(
          'div',
          { 'class': 'image' },
          h('img', { id: 'image-placeholder', src: this.state.imagePreviewSrc })
        ),
        h('input', {
          id: 'upload-file',
          type: 'file',
          name: 'upload-file',
          accept: '.jpg',
          onChange: this._handleImageChange.bind(this)
        })
      );
    }
  }]);
  return UploadImageComponent;
}(Component);

var ComposeCaptionComponent = function (_Component) {
  inherits(ComposeCaptionComponent, _Component);

  function ComposeCaptionComponent(props) {
    classCallCheck(this, ComposeCaptionComponent);

    var _this = possibleConstructorReturn(this, (ComposeCaptionComponent.__proto__ || Object.getPrototypeOf(ComposeCaptionComponent)).call(this, props));

    _this.state = { done: false };
    return _this;
  }

  createClass(ComposeCaptionComponent, [{
    key: "_handleChange",
    value: function _handleChange(e) {
      var text = e.target.value;
      this.props.onChange({ caption: text });
    }
  }, {
    key: "render",
    value: function render$$1() {
      return h(
        "div",
        null,
        h(
          "label",
          { "for": "upload-textarea" },
          "Message"
        ),
        h("textarea", {
          id: "upload-textarea",
          onChange: this._handleChange.bind(this)
        })
      );
    }
  }]);
  return ComposeCaptionComponent;
}(Component);

var HashtagsComponent = function (_Component) {
  inherits(HashtagsComponent, _Component);

  function HashtagsComponent(props) {
    classCallCheck(this, HashtagsComponent);

    var _this = possibleConstructorReturn(this, (HashtagsComponent.__proto__ || Object.getPrototypeOf(HashtagsComponent)).call(this, props));

    _this.state = { done: false };
    return _this;
  }

  createClass(HashtagsComponent, [{
    key: '_handleChange',
    value: function _handleChange(e) {
      var text = e.target.value;
      this.props.onChange({ caption: text });
    }
  }, {
    key: 'render',
    value: function render$$1() {

      var hashtags = ['#barba_gianny', '#beardlove', '#barbalunga', '#barbacurata', '#barbershop', '#barberstyle', '#beardthefuckup', '#barbermoderno', '#barberia', '#beardman', '#beardmodel', '#grownbeard', '#beardlifestyle', '#beardstagram', '#beardedvillainsitaly', '#lebarbeignoranti', '#barbutoitaliano', '#beardinspire', '#barba'];

      return h(
        'div',
        null,
        h(
          'label',
          { 'for': 'upload-hashtags' },
          '#haghtags (',
          hashtags.length,
          ')'
        ),
        h(
          'textarea',
          { id: 'upload-hashtags', readonly: true },
          hashtags.join(' ')
        )
      );
    }
  }]);
  return HashtagsComponent;
}(Component);

var _ = require('lodash');
var Promise$1 = require('bluebird');
var fs = require('fs');
var jsonfile = require('jsonfile');

var Client = require('instagram-private-api').V1;
var Conf = require('../config/config-app.js');
var currentUser = Conf.user;

var device = new Client.Device(currentUser.username);
var storage = new Client.CookieFileStorage('./app/cookies/' + currentUser.username + '.json');
var session = new Client.Session(device, storage);

//-------------------------------------------------
/*
function login() {

  // And go for login
  Client.Session.create( device, storage, currentUser.username, currentUser.password )
    .then(function( session ) {
      console.log('this is your session', session );
    })
  ;
}

function account( callback ) {
    let id;

    storage.getAccountId() 
      .then(function(accountId){
        console.log(accountId);
        id = accountId;
        console.log( id );
      });

    session.getAccount()
      .then(function( account ) {
        console.log('account', account);
    });

    Client.Relationship.get(session, 25025320)
      .then(function( relationship ) {
        console.log('what?', relationship);
      })
    ;
}
*/

function me() {
  return currentUser;
}

function upload(file, caption) {

  if (!fs.existsSync(file)) {
    alert('Forgot to upload a picture?');
    return false;
  }

  Client.Upload.photo(session, file).then(function (uploadObj) {
    // uploadObj instanceof Client.Upload
    // nothing more than just keeping uploadObj id
    console.log(uploadObj.params.uploadId);
    return Client.Media.configurePhoto(session, uploadObj.params.uploadId, caption);
  }).then(function (medium) {
    logEvent(caption);
    // we configure medium, it is now visible with caption
    console.log(medium.params);
  });
}

function logEvent(caption) {
  var logFile = './logs/log.json';
  var logJSON = {};
  var jsonDate = new Date().toJSON();
  var date = new Date(jsonDate);

  jsonfile.readFile(logFile, function (err, obj) {

    if (err) {
      // json is empty, initialize it
      logJSON = { "logs": [{
          'id': 0,
          'date': date,
          'description': caption
        }] };
    } else {

      logJSON = obj;

      var lastEntry = logJSON.logs[logJSON.logs.length - 1];
      var id = +lastEntry.id + 1;

      logJSON.logs.push({
        'id': id,
        'date': date,
        'description': caption
      });
    }

    jsonfile.writeFile(logFile, logJSON, function (err) {
      if (err) throw err;
      console.info('Event Logged into log.json');
    });
  });
}

var App = function (_Component) {
  inherits(App, _Component);

  function App() {
    classCallCheck(this, App);

    var _this = possibleConstructorReturn(this, (App.__proto__ || Object.getPrototypeOf(App)).call(this));

    _this.state = {
      username: me().username,
      caption: "",
      image: ""
    };
    return _this;
  }

  createClass(App, [{
    key: '_handleUploadClick',
    value: function _handleUploadClick() {
      upload(this.state.image, this.state.caption);
    }
  }, {
    key: '_handleCancelClick',
    value: function _handleCancelClick() {
      location.reload();
    }
  }, {
    key: 'onChange',
    value: function onChange(state) {
      this.setState(state);
    }
  }, {
    key: 'render',
    value: function render$$1() {
      return h(
        'div',
        { id: 'upload' },
        h(
          'div',
          { 'class': 'header' },
          h(
            'h1',
            null,
            'Instaploader of ',
            this.state.username
          )
        ),
        h(
          'div',
          { 'class': 'content' },
          h(
            'div',
            { 'class': 'column' },
            h(UploadImageComponent, { onChange: this.onChange.bind(this) })
          ),
          h(
            'div',
            { 'class': 'column' },
            h(ComposeCaptionComponent, { onChange: this.onChange.bind(this) }),
            h(HashtagsComponent, null)
          )
        ),
        h(
          'div',
          { 'class': 'submit' },
          h(
            'button',
            {
              'class': 'primary-btn',
              onClick: this._handleUploadClick.bind(this)
            },
            'Upload'
          ),
          h(
            'button',
            {
              'class': 'secondary-btn',
              onClick: this._handleCancelClick.bind(this)
            },
            'Cancel'
          )
        )
      );
    }
  }]);
  return App;
}(Component);

render(h(App, null), document.querySelector('.app'));

})));
