(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){(function (){
// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var nedb = (typeof window !== "undefined" ? window['Nedb'] : typeof global !== "undefined" ? global['Nedb'] : null);

function Namespace(options) {
    if (!(this instanceof Namespace)) {
        return new Namespace(options);
    }
    var collections = {};
    this.getCollection = function (name) {
        return collections[name];
    };
    this.getCollectionNames = function () {
        return Object.keys(collections);
    };
    function Collection(options) {
        if (!(this instanceof Collection)) {
            return new Collection(options);
        }
        nedb.apply(this);
        collections[options.filename] = this;
    }
    Collection.prototype = nedb.prototype;
    this.nedb = Collection;
}

exports.Namespace = Namespace;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
(function (global){(function (){
// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null),
    ko = (typeof window !== "undefined" ? window['ko'] : typeof global !== "undefined" ? global['ko'] : null),
    document = (typeof window !== "undefined" ? window['document'] : typeof global !== "undefined" ? global['document'] : null),
    window = (typeof window !== "undefined" ? window['window'] : typeof global !== "undefined" ? global['window'] : null),
    createZip = require('jszip'),
    Promise = (typeof window !== "undefined" ? window['Promise'] : typeof global !== "undefined" ? global['Promise'] : null),
    createNamespace = require('./datastore').Namespace,
    namespace = createNamespace(),
    requires = {
        jquery: $,
        knockout: ko,
        nedb: namespace.nedb,
        bluebird: Promise
    },
    createPanner = require('./panner').Panner;

Promise.config({cancellation: true});

var panner = createPanner({el: document.scrollingElement});

function load(folder, file) {
    var module = { exports: {} };
    function r(module) {
        if (requires[module]) { return requires[module]; }
        module = module.substr(2);
        if (folder.file(module)) {
            requires[folder.root + module] = load(folder, module);
            return requires[folder.root + module];
        }
        if (folder.file(module + '.js')) {
            requires[folder.root + module] = load(folder, module + '.js');
            return requires[folder.root + module];
        }
        if (folder.file(module + '.json')) {
            requires[folder.root + module] = load(folder, module + '.json');
            return requires[folder.root + module];
        }
        if (folder.folder(module).file('index.js')) {
            requires[folder.root + module] = load(folder.folder(module), 'index.js');
            return requires[folder.root + module];
        }
    }
    if (file.substr(-3) === '.js') {
        /*jslint evil: true */
        (new Function('require', 'module', 'exports', folder.file(file).asText()))(r, module, module.exports);
        /*jslint evil: false */
    } else if (file.substr(-5) === '.json') {
        module.exports = JSON.parse(folder.file(file).asText());
    } else if (file.substr(-5) === '.html') {
        module.exports = folder.file(file).asText();
    }
    return module.exports;
}

function hotReload() {
    var app = window.document.body.getElementsByTagName('main-application')[0],
        viewmodel = ko.dataFor(app);
    Object.keys(viewmodel.context.vms).forEach(function (id) {
        var vm = viewmodel.context.vms[id],
            selected = vm.selected && vm.selected();
        function fixStatus() {
            vm.waitForStatusChange().then(function () {
                if (vm.status() === 'computed') {
                    var item = vm.items().filter(function (item) {
                        return item.id === selected;
                    })[0];
                    if (item) {
                        vm.selected(selected);
                        vm.output = item;
                    }
                } else {
                    fixStatus();
                }
            });
        }
        if (vm.output !== undefined) {
            vm.output = undefined;
            vm.init({
                filters: vm.filters
            });
            if (selected !== undefined) {
                fixStatus();
            }
        }
    });
}

function reload() {
    var app = window.document.body.getElementsByTagName('main-application')[0],
        viewmodel = ko.dataFor(app);
    ko.cleanNode(window.document.body);
    ko.applyBindings(viewmodel);
    viewmodel.context.top.init();
}

function receiveMessage(e) {
    var zip,
        collection;
    if (e.data.response) { return; }
    switch (e.data.command) {
    case 'load':
        if (!e.data.zip) { return; }
        zip = createZip(e.data.zip);
        load(zip.folder('mobileexample').folder('src').folder('js'), 'index.js');
        break;
    case 'reload':
        reload();
        break;
    case 'hot_reload':
        hotReload();
        break;
    case 'get_collection_names':
        window.postMessage({
            command: 'get_collection_names',
            collections: namespace.getCollectionNames(),
            response: true
        }, '*');
        break;
    case 'dump_collection':
        if (!e.data.collection) { return; }
        collection = namespace.getCollection(e.data.collection);
        if (collection) {
            collection.find({}, function (err, docs) {
                if (err) {
                    return window.postMessage({
                        command: 'dump_collection',
                        collection: e.data.collection,
                        error: err,
                        response: true
                    }, '*');
                }
                window.postMessage({
                    command: 'dump_collection',
                    collection: e.data.collection,
                    docs: docs,
                    response: true
                }, '*');
            });
        } else {
            window.postMessage({
                command: 'dump_collection',
                collection: e.data.collection,
                error: 'uknown collection "' + e.data.collection + '"',
                response: true
            }, '*');
        }
        break;
    case 'restore_collection':
        if (!e.data.collection) { return; }
        if (!e.data.documents) { return; }
        collection = namespace.getCollection(e.data.collection);
        if (!collection) { return; }
        collection.remove({}, {multi: true});
        collection.insert(e.data.documents);
        break;
    }
}

(function () {
    var register = ko.components.register;
    ko.components.register = function (name, options) {
        var createViewModel = options.viewModel.createViewModel;
        options.viewModel.createViewModel = function () {
            setTimeout(function () {
                $(name + ' ul.tabs').each(function () {
                    if (!$(this).data('padding')) {
                        createPanner({el: this});
                        $(this).data('padding', 'true');
                    }
                });
            }, 1);
            return createViewModel.apply(this, arguments);
        };
        return register.apply(this, arguments);
    };
}());

window.addEventListener('message', receiveMessage, false);

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./datastore":1,"./panner":3,"jszip":16}],3:[function(require,module,exports){
(function (global){(function (){
// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var $ = (typeof window !== "undefined" ? window['$'] : typeof global !== "undefined" ? global['$'] : null),
    document = (typeof window !== "undefined" ? window['document'] : typeof global !== "undefined" ? global['document'] : null),
    window = (typeof window !== "undefined" ? window['window'] : typeof global !== "undefined" ? global['window'] : null);

function Panner(options) {
    if (!(this instanceof Panner)) { return new Panner(options); }
    options = options || {};

    if (!options.el) { throw new Error('listener option is mandatory'); }
    if ($(options.el).length === 0) { throw new Error('invalid listener option'); }

    var el = $(options.el)[0],
        moved,
        removeHandlers,
        startClientX,
        startClientY,
        lastClientX,
        lastClientY;

    function mousemove(e) {
        if (e.buttons === 0) {
            el.style.pointerEvents = null;
            return removeHandlers();
        }
        if (!moved) {
            if (Math.abs(startClientX - e.clientX) + Math.abs(startClientY - e.clientY) > 10) {
                moved = true;
                el.style.pointerEvents = 'none';
            }
        }
        el.scrollLeft += (lastClientX - e.clientX);
        lastClientX = e.clientX;
        el.scrollTop += (lastClientY - e.clientY);
        lastClientY = e.clientY;
        e.preventDefault();
    }

    function mouseup() {
        removeHandlers();
        if (moved) {
            el.style.pointerEvents = null;
        }
    }

    removeHandlers = function () {
        window.removeEventListener('mouseup', mouseup, true);
        window.removeEventListener('mousemove', mousemove, true);
    };

    function mousedown(e) {
        removeHandlers();
        moved = false;
        startClientX = lastClientX = e.clientX;
        startClientY = lastClientY = e.clientY;
        window.addEventListener('mouseup', mouseup, true);
        window.addEventListener('mousemove', mousemove, true);
    }

    this.start = function () {
        removeHandlers();
        this.stop();
        el.addEventListener('mousedown', mousedown, true);
    };

    this.stop = function () {
        el.removeEventListener('mousedown', mousedown, true);
    };

    if (options.autostart === undefined || options.autostart) {
        this.start();
    }
}

exports.Panner = Panner;

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],4:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],5:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)

},{"base64-js":4,"buffer":5,"ieee754":6}],6:[function(require,module,exports){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],7:[function(require,module,exports){
'use strict';
var DataReader = require('./dataReader');

function ArrayReader(data) {
    if (data) {
        this.data = data;
        this.length = this.data.length;
        this.index = 0;
        this.zero = 0;

        for(var i = 0; i < this.data.length; i++) {
            data[i] = data[i] & 0xFF;
        }
    }
}
ArrayReader.prototype = new DataReader();
/**
 * @see DataReader.byteAt
 */
ArrayReader.prototype.byteAt = function(i) {
    return this.data[this.zero + i];
};
/**
 * @see DataReader.lastIndexOfSignature
 */
ArrayReader.prototype.lastIndexOfSignature = function(sig) {
    var sig0 = sig.charCodeAt(0),
        sig1 = sig.charCodeAt(1),
        sig2 = sig.charCodeAt(2),
        sig3 = sig.charCodeAt(3);
    for (var i = this.length - 4; i >= 0; --i) {
        if (this.data[i] === sig0 && this.data[i + 1] === sig1 && this.data[i + 2] === sig2 && this.data[i + 3] === sig3) {
            return i - this.zero;
        }
    }

    return -1;
};
/**
 * @see DataReader.readData
 */
ArrayReader.prototype.readData = function(size) {
    this.checkOffset(size);
    if(size === 0) {
        return [];
    }
    var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
};
module.exports = ArrayReader;

},{"./dataReader":12}],8:[function(require,module,exports){
'use strict';
// private property
var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";


// public method for encoding
exports.encode = function(input, utf8) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    while (i < input.length) {

        chr1 = input.charCodeAt(i++);
        chr2 = input.charCodeAt(i++);
        chr3 = input.charCodeAt(i++);

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        }
        else if (isNaN(chr3)) {
            enc4 = 64;
        }

        output = output + _keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4);

    }

    return output;
};

// public method for decoding
exports.decode = function(input, utf8) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    while (i < input.length) {

        enc1 = _keyStr.indexOf(input.charAt(i++));
        enc2 = _keyStr.indexOf(input.charAt(i++));
        enc3 = _keyStr.indexOf(input.charAt(i++));
        enc4 = _keyStr.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output = output + String.fromCharCode(chr1);

        if (enc3 != 64) {
            output = output + String.fromCharCode(chr2);
        }
        if (enc4 != 64) {
            output = output + String.fromCharCode(chr3);
        }

    }

    return output;

};

},{}],9:[function(require,module,exports){
'use strict';
function CompressedObject() {
    this.compressedSize = 0;
    this.uncompressedSize = 0;
    this.crc32 = 0;
    this.compressionMethod = null;
    this.compressedContent = null;
}

CompressedObject.prototype = {
    /**
     * Return the decompressed content in an unspecified format.
     * The format will depend on the decompressor.
     * @return {Object} the decompressed content.
     */
    getContent: function() {
        return null; // see implementation
    },
    /**
     * Return the compressed content in an unspecified format.
     * The format will depend on the compressed conten source.
     * @return {Object} the compressed content.
     */
    getCompressedContent: function() {
        return null; // see implementation
    }
};
module.exports = CompressedObject;

},{}],10:[function(require,module,exports){
'use strict';
exports.STORE = {
    magic: "\x00\x00",
    compress: function(content, compressionOptions) {
        return content; // no compression
    },
    uncompress: function(content) {
        return content; // no compression
    },
    compressInputType: null,
    uncompressInputType: null
};
exports.DEFLATE = require('./flate');

},{"./flate":15}],11:[function(require,module,exports){
'use strict';

var utils = require('./utils');

var table = [
    0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA,
    0x076DC419, 0x706AF48F, 0xE963A535, 0x9E6495A3,
    0x0EDB8832, 0x79DCB8A4, 0xE0D5E91E, 0x97D2D988,
    0x09B64C2B, 0x7EB17CBD, 0xE7B82D07, 0x90BF1D91,
    0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,
    0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7,
    0x136C9856, 0x646BA8C0, 0xFD62F97A, 0x8A65C9EC,
    0x14015C4F, 0x63066CD9, 0xFA0F3D63, 0x8D080DF5,
    0x3B6E20C8, 0x4C69105E, 0xD56041E4, 0xA2677172,
    0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
    0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940,
    0x32D86CE3, 0x45DF5C75, 0xDCD60DCF, 0xABD13D59,
    0x26D930AC, 0x51DE003A, 0xC8D75180, 0xBFD06116,
    0x21B4F4B5, 0x56B3C423, 0xCFBA9599, 0xB8BDA50F,
    0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
    0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D,
    0x76DC4190, 0x01DB7106, 0x98D220BC, 0xEFD5102A,
    0x71B18589, 0x06B6B51F, 0x9FBFE4A5, 0xE8B8D433,
    0x7807C9A2, 0x0F00F934, 0x9609A88E, 0xE10E9818,
    0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
    0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E,
    0x6C0695ED, 0x1B01A57B, 0x8208F4C1, 0xF50FC457,
    0x65B0D9C6, 0x12B7E950, 0x8BBEB8EA, 0xFCB9887C,
    0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3, 0xFBD44C65,
    0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,
    0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB,
    0x4369E96A, 0x346ED9FC, 0xAD678846, 0xDA60B8D0,
    0x44042D73, 0x33031DE5, 0xAA0A4C5F, 0xDD0D7CC9,
    0x5005713C, 0x270241AA, 0xBE0B1010, 0xC90C2086,
    0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
    0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4,
    0x59B33D17, 0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD,
    0xEDB88320, 0x9ABFB3B6, 0x03B6E20C, 0x74B1D29A,
    0xEAD54739, 0x9DD277AF, 0x04DB2615, 0x73DC1683,
    0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
    0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1,
    0xF00F9344, 0x8708A3D2, 0x1E01F268, 0x6906C2FE,
    0xF762575D, 0x806567CB, 0x196C3671, 0x6E6B06E7,
    0xFED41B76, 0x89D32BE0, 0x10DA7A5A, 0x67DD4ACC,
    0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
    0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252,
    0xD1BB67F1, 0xA6BC5767, 0x3FB506DD, 0x48B2364B,
    0xD80D2BDA, 0xAF0A1B4C, 0x36034AF6, 0x41047A60,
    0xDF60EFC3, 0xA867DF55, 0x316E8EEF, 0x4669BE79,
    0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
    0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F,
    0xC5BA3BBE, 0xB2BD0B28, 0x2BB45A92, 0x5CB36A04,
    0xC2D7FFA7, 0xB5D0CF31, 0x2CD99E8B, 0x5BDEAE1D,
    0x9B64C2B0, 0xEC63F226, 0x756AA39C, 0x026D930A,
    0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
    0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38,
    0x92D28E9B, 0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21,
    0x86D3D2D4, 0xF1D4E242, 0x68DDB3F8, 0x1FDA836E,
    0x81BE16CD, 0xF6B9265B, 0x6FB077E1, 0x18B74777,
    0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,
    0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45,
    0xA00AE278, 0xD70DD2EE, 0x4E048354, 0x3903B3C2,
    0xA7672661, 0xD06016F7, 0x4969474D, 0x3E6E77DB,
    0xAED16A4A, 0xD9D65ADC, 0x40DF0B66, 0x37D83BF0,
    0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
    0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6,
    0xBAD03605, 0xCDD70693, 0x54DE5729, 0x23D967BF,
    0xB3667A2E, 0xC4614AB8, 0x5D681B02, 0x2A6F2B94,
    0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B, 0x2D02EF8D
];

/**
 *
 *  Javascript crc32
 *  http://www.webtoolkit.info/
 *
 */
module.exports = function crc32(input, crc) {
    if (typeof input === "undefined" || !input.length) {
        return 0;
    }

    var isArray = utils.getTypeOf(input) !== "string";

    if (typeof(crc) == "undefined") {
        crc = 0;
    }
    var x = 0;
    var y = 0;
    var b = 0;

    crc = crc ^ (-1);
    for (var i = 0, iTop = input.length; i < iTop; i++) {
        b = isArray ? input[i] : input.charCodeAt(i);
        y = (crc ^ b) & 0xFF;
        x = table[y];
        crc = (crc >>> 8) ^ x;
    }

    return crc ^ (-1);
};
// vim: set shiftwidth=4 softtabstop=4:

},{"./utils":28}],12:[function(require,module,exports){
'use strict';
var utils = require('./utils');

function DataReader(data) {
    this.data = null; // type : see implementation
    this.length = 0;
    this.index = 0;
    this.zero = 0;
}
DataReader.prototype = {
    /**
     * Check that the offset will not go too far.
     * @param {string} offset the additional offset to check.
     * @throws {Error} an Error if the offset is out of bounds.
     */
    checkOffset: function(offset) {
        this.checkIndex(this.index + offset);
    },
    /**
     * Check that the specifed index will not be too far.
     * @param {string} newIndex the index to check.
     * @throws {Error} an Error if the index is out of bounds.
     */
    checkIndex: function(newIndex) {
        if (this.length < this.zero + newIndex || newIndex < 0) {
            throw new Error("End of data reached (data length = " + this.length + ", asked index = " + (newIndex) + "). Corrupted zip ?");
        }
    },
    /**
     * Change the index.
     * @param {number} newIndex The new index.
     * @throws {Error} if the new index is out of the data.
     */
    setIndex: function(newIndex) {
        this.checkIndex(newIndex);
        this.index = newIndex;
    },
    /**
     * Skip the next n bytes.
     * @param {number} n the number of bytes to skip.
     * @throws {Error} if the new index is out of the data.
     */
    skip: function(n) {
        this.setIndex(this.index + n);
    },
    /**
     * Get the byte at the specified index.
     * @param {number} i the index to use.
     * @return {number} a byte.
     */
    byteAt: function(i) {
        // see implementations
    },
    /**
     * Get the next number with a given byte size.
     * @param {number} size the number of bytes to read.
     * @return {number} the corresponding number.
     */
    readInt: function(size) {
        var result = 0,
            i;
        this.checkOffset(size);
        for (i = this.index + size - 1; i >= this.index; i--) {
            result = (result << 8) + this.byteAt(i);
        }
        this.index += size;
        return result;
    },
    /**
     * Get the next string with a given byte size.
     * @param {number} size the number of bytes to read.
     * @return {string} the corresponding string.
     */
    readString: function(size) {
        return utils.transformTo("string", this.readData(size));
    },
    /**
     * Get raw data without conversion, <size> bytes.
     * @param {number} size the number of bytes to read.
     * @return {Object} the raw data, implementation specific.
     */
    readData: function(size) {
        // see implementations
    },
    /**
     * Find the last occurence of a zip signature (4 bytes).
     * @param {string} sig the signature to find.
     * @return {number} the index of the last occurence, -1 if not found.
     */
    lastIndexOfSignature: function(sig) {
        // see implementations
    },
    /**
     * Get the next date.
     * @return {Date} the date.
     */
    readDate: function() {
        var dostime = this.readInt(4);
        return new Date(
        ((dostime >> 25) & 0x7f) + 1980, // year
        ((dostime >> 21) & 0x0f) - 1, // month
        (dostime >> 16) & 0x1f, // day
        (dostime >> 11) & 0x1f, // hour
        (dostime >> 5) & 0x3f, // minute
        (dostime & 0x1f) << 1); // second
    }
};
module.exports = DataReader;

},{"./utils":28}],13:[function(require,module,exports){
'use strict';
exports.base64 = false;
exports.binary = false;
exports.dir = false;
exports.createFolders = false;
exports.date = null;
exports.compression = null;
exports.compressionOptions = null;
exports.comment = null;
exports.unixPermissions = null;
exports.dosPermissions = null;

},{}],14:[function(require,module,exports){
'use strict';
var utils = require('./utils');

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.string2binary = function(str) {
    return utils.string2binary(str);
};

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.string2Uint8Array = function(str) {
    return utils.transformTo("uint8array", str);
};

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.uint8Array2String = function(array) {
    return utils.transformTo("string", array);
};

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.string2Blob = function(str) {
    var buffer = utils.transformTo("arraybuffer", str);
    return utils.arrayBuffer2Blob(buffer);
};

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.arrayBuffer2Blob = function(buffer) {
    return utils.arrayBuffer2Blob(buffer);
};

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.transformTo = function(outputType, input) {
    return utils.transformTo(outputType, input);
};

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.getTypeOf = function(input) {
    return utils.getTypeOf(input);
};

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.checkSupport = function(type) {
    return utils.checkSupport(type);
};

/**
 * @deprecated
 * This value will be removed in a future version without replacement.
 */
exports.MAX_VALUE_16BITS = utils.MAX_VALUE_16BITS;

/**
 * @deprecated
 * This value will be removed in a future version without replacement.
 */
exports.MAX_VALUE_32BITS = utils.MAX_VALUE_32BITS;


/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.pretty = function(str) {
    return utils.pretty(str);
};

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.findCompression = function(compressionMethod) {
    return utils.findCompression(compressionMethod);
};

/**
 * @deprecated
 * This function will be removed in a future version without replacement.
 */
exports.isRegExp = function (object) {
    return utils.isRegExp(object);
};


},{"./utils":28}],15:[function(require,module,exports){
'use strict';
var USE_TYPEDARRAY = (typeof Uint8Array !== 'undefined') && (typeof Uint16Array !== 'undefined') && (typeof Uint32Array !== 'undefined');

var pako = require("pako");
exports.uncompressInputType = USE_TYPEDARRAY ? "uint8array" : "array";
exports.compressInputType = USE_TYPEDARRAY ? "uint8array" : "array";

exports.magic = "\x08\x00";
exports.compress = function(input, compressionOptions) {
    return pako.deflateRaw(input, {
        level : compressionOptions.level || -1 // default compression
    });
};
exports.uncompress =  function(input) {
    return pako.inflateRaw(input);
};

},{"pako":31}],16:[function(require,module,exports){
'use strict';

var base64 = require('./base64');

/**
Usage:
   zip = new JSZip();
   zip.file("hello.txt", "Hello, World!").file("tempfile", "nothing");
   zip.folder("images").file("smile.gif", base64Data, {base64: true});
   zip.file("Xmas.txt", "Ho ho ho !", {date : new Date("December 25, 2007 00:00:01")});
   zip.remove("tempfile");

   base64zip = zip.generate();

**/

/**
 * Representation a of zip file in js
 * @constructor
 * @param {String=|ArrayBuffer=|Uint8Array=} data the data to load, if any (optional).
 * @param {Object=} options the options for creating this objects (optional).
 */
function JSZip(data, options) {
    // if this constructor is used without `new`, it adds `new` before itself:
    if(!(this instanceof JSZip)) return new JSZip(data, options);

    // object containing the files :
    // {
    //   "folder/" : {...},
    //   "folder/data.txt" : {...}
    // }
    // NOTE: we use a null prototype because we do not
    // want filenames like "toString" coming from a zip file
    // to overwrite methods and attributes in a normal Object.
    this.files = Object.create(null);

    this.comment = null;

    // Where we are in the hierarchy
    this.root = "";
    if (data) {
        this.load(data, options);
    }
    this.clone = function() {
        var newObj = new JSZip();
        for (var i in this) {
            if (typeof this[i] !== "function") {
                newObj[i] = this[i];
            }
        }
        return newObj;
    };
}
JSZip.prototype = require('./object');
JSZip.prototype.load = require('./load');
JSZip.support = require('./support');
JSZip.defaults = require('./defaults');

/**
 * @deprecated
 * This namespace will be removed in a future version without replacement.
 */
JSZip.utils = require('./deprecatedPublicUtils');

JSZip.base64 = {
    /**
     * @deprecated
     * This method will be removed in a future version without replacement.
     */
    encode : function(input) {
        return base64.encode(input);
    },
    /**
     * @deprecated
     * This method will be removed in a future version without replacement.
     */
    decode : function(input) {
        return base64.decode(input);
    }
};
JSZip.compressions = require('./compressions');
module.exports = JSZip;

},{"./base64":8,"./compressions":10,"./defaults":13,"./deprecatedPublicUtils":14,"./load":17,"./object":20,"./support":24}],17:[function(require,module,exports){
'use strict';
var base64 = require('./base64');
var utf8 = require('./utf8');
var utils = require('./utils');
var ZipEntries = require('./zipEntries');
module.exports = function(data, options) {
    var files, zipEntries, i, input;
    options = utils.extend(options || {}, {
        base64: false,
        checkCRC32: false,
        optimizedBinaryString : false,
        createFolders: false,
        decodeFileName: utf8.utf8decode
    });
    if (options.base64) {
        data = base64.decode(data);
    }

    zipEntries = new ZipEntries(data, options);
    files = zipEntries.files;
    for (i = 0; i < files.length; i++) {
        input = files[i];
        this.file(input.fileNameStr, input.decompressed, {
            binary: true,
            optimizedBinaryString: true,
            date: input.date,
            dir: input.dir,
            comment : input.fileCommentStr.length ? input.fileCommentStr : null,
            unixPermissions : input.unixPermissions,
            dosPermissions : input.dosPermissions,
            createFolders: options.createFolders
        });
    }
    if (zipEntries.zipComment.length) {
        this.comment = zipEntries.zipComment;
    }

    return this;
};

},{"./base64":8,"./utf8":27,"./utils":28,"./zipEntries":29}],18:[function(require,module,exports){
(function (Buffer){(function (){
'use strict';
module.exports = function(data, encoding){
    return new Buffer(data, encoding);
};
module.exports.test = function(b){
    return Buffer.isBuffer(b);
};

}).call(this)}).call(this,require("buffer").Buffer)

},{"buffer":5}],19:[function(require,module,exports){
'use strict';
var Uint8ArrayReader = require('./uint8ArrayReader');

function NodeBufferReader(data) {
    this.data = data;
    this.length = this.data.length;
    this.index = 0;
    this.zero = 0;
}
NodeBufferReader.prototype = new Uint8ArrayReader();

/**
 * @see DataReader.readData
 */
NodeBufferReader.prototype.readData = function(size) {
    this.checkOffset(size);
    var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
};
module.exports = NodeBufferReader;

},{"./uint8ArrayReader":25}],20:[function(require,module,exports){
'use strict';
var support = require('./support');
var utils = require('./utils');
var crc32 = require('./crc32');
var signature = require('./signature');
var defaults = require('./defaults');
var base64 = require('./base64');
var compressions = require('./compressions');
var CompressedObject = require('./compressedObject');
var nodeBuffer = require('./nodeBuffer');
var utf8 = require('./utf8');
var StringWriter = require('./stringWriter');
var Uint8ArrayWriter = require('./uint8ArrayWriter');

/**
 * Returns the raw data of a ZipObject, decompress the content if necessary.
 * @param {ZipObject} file the file to use.
 * @return {String|ArrayBuffer|Uint8Array|Buffer} the data.
 */
var getRawData = function(file) {
    if (file._data instanceof CompressedObject) {
        file._data = file._data.getContent();
        file.options.binary = true;
        file.options.base64 = false;

        if (utils.getTypeOf(file._data) === "uint8array") {
            var copy = file._data;
            // when reading an arraybuffer, the CompressedObject mechanism will keep it and subarray() a Uint8Array.
            // if we request a file in the same format, we might get the same Uint8Array or its ArrayBuffer (the original zip file).
            file._data = new Uint8Array(copy.length);
            // with an empty Uint8Array, Opera fails with a "Offset larger than array size"
            if (copy.length !== 0) {
                file._data.set(copy, 0);
            }
        }
    }
    return file._data;
};

/**
 * Returns the data of a ZipObject in a binary form. If the content is an unicode string, encode it.
 * @param {ZipObject} file the file to use.
 * @return {String|ArrayBuffer|Uint8Array|Buffer} the data.
 */
var getBinaryData = function(file) {
    var result = getRawData(file),
        type = utils.getTypeOf(result);
    if (type === "string") {
        if (!file.options.binary) {
            // unicode text !
            // unicode string => binary string is a painful process, check if we can avoid it.
            if (support.nodebuffer) {
                return nodeBuffer(result, "utf-8");
            }
        }
        return file.asBinary();
    }
    return result;
};

/**
 * Transform this._data into a string.
 * @param {function} filter a function String -> String, applied if not null on the result.
 * @return {String} the string representing this._data.
 */
var dataToString = function(asUTF8) {
    var result = getRawData(this);
    if (result === null || typeof result === "undefined") {
        return "";
    }
    // if the data is a base64 string, we decode it before checking the encoding !
    if (this.options.base64) {
        result = base64.decode(result);
    }
    if (asUTF8 && this.options.binary) {
        // JSZip.prototype.utf8decode supports arrays as input
        // skip to array => string step, utf8decode will do it.
        result = out.utf8decode(result);
    }
    else {
        // no utf8 transformation, do the array => string step.
        result = utils.transformTo("string", result);
    }

    if (!asUTF8 && !this.options.binary) {
        result = utils.transformTo("string", out.utf8encode(result));
    }
    return result;
};
/**
 * A simple object representing a file in the zip file.
 * @constructor
 * @param {string} name the name of the file
 * @param {String|ArrayBuffer|Uint8Array|Buffer} data the data
 * @param {Object} options the options of the file
 */
var ZipObject = function(name, data, options) {
    this.name = name;
    this.dir = options.dir;
    this.date = options.date;
    this.comment = options.comment;
    this.unixPermissions = options.unixPermissions;
    this.dosPermissions = options.dosPermissions;

    this._data = data;
    this.options = options;

    /*
     * This object contains initial values for dir and date.
     * With them, we can check if the user changed the deprecated metadata in
     * `ZipObject#options` or not.
     */
    this._initialMetadata = {
      dir : options.dir,
      date : options.date
    };
};

ZipObject.prototype = {
    /**
     * Return the content as UTF8 string.
     * @return {string} the UTF8 string.
     */
    asText: function() {
        return dataToString.call(this, true);
    },
    /**
     * Returns the binary content.
     * @return {string} the content as binary.
     */
    asBinary: function() {
        return dataToString.call(this, false);
    },
    /**
     * Returns the content as a nodejs Buffer.
     * @return {Buffer} the content as a Buffer.
     */
    asNodeBuffer: function() {
        var result = getBinaryData(this);
        return utils.transformTo("nodebuffer", result);
    },
    /**
     * Returns the content as an Uint8Array.
     * @return {Uint8Array} the content as an Uint8Array.
     */
    asUint8Array: function() {
        var result = getBinaryData(this);
        return utils.transformTo("uint8array", result);
    },
    /**
     * Returns the content as an ArrayBuffer.
     * @return {ArrayBuffer} the content as an ArrayBufer.
     */
    asArrayBuffer: function() {
        return this.asUint8Array().buffer;
    }
};

/**
 * Transform an integer into a string in hexadecimal.
 * @private
 * @param {number} dec the number to convert.
 * @param {number} bytes the number of bytes to generate.
 * @returns {string} the result.
 */
var decToHex = function(dec, bytes) {
    var hex = "",
        i;
    for (i = 0; i < bytes; i++) {
        hex += String.fromCharCode(dec & 0xff);
        dec = dec >>> 8;
    }
    return hex;
};

/**
 * Transforms the (incomplete) options from the user into the complete
 * set of options to create a file.
 * @private
 * @param {Object} o the options from the user.
 * @return {Object} the complete set of options.
 */
var prepareFileAttrs = function(o) {
    o = o || {};
    if (o.base64 === true && (o.binary === null || o.binary === undefined)) {
        o.binary = true;
    }
    o = utils.extend(o, defaults);
    o.date = o.date || new Date();
    if (o.compression !== null) o.compression = o.compression.toUpperCase();

    return o;
};

/**
 * Add a file in the current folder.
 * @private
 * @param {string} name the name of the file
 * @param {String|ArrayBuffer|Uint8Array|Buffer} data the data of the file
 * @param {Object} o the options of the file
 * @return {Object} the new file.
 */
var fileAdd = function(name, data, o) {
    // be sure sub folders exist
    var dataType = utils.getTypeOf(data),
        parent;

    o = prepareFileAttrs(o);

    if (typeof o.unixPermissions === "string") {
        o.unixPermissions = parseInt(o.unixPermissions, 8);
    }

    // UNX_IFDIR  0040000 see zipinfo.c
    if (o.unixPermissions && (o.unixPermissions & 0x4000)) {
        o.dir = true;
    }
    // Bit 4    Directory
    if (o.dosPermissions && (o.dosPermissions & 0x0010)) {
        o.dir = true;
    }

    if (o.dir) {
        name = forceTrailingSlash(name);
    }

    if (o.createFolders && (parent = parentFolder(name))) {
        folderAdd.call(this, parent, true);
    }

    if (o.dir || data === null || typeof data === "undefined") {
        o.base64 = false;
        o.binary = false;
        data = null;
        dataType = null;
    }
    else if (dataType === "string") {
        if (o.binary && !o.base64) {
            // optimizedBinaryString == true means that the file has already been filtered with a 0xFF mask
            if (o.optimizedBinaryString !== true) {
                // this is a string, not in a base64 format.
                // Be sure that this is a correct "binary string"
                data = utils.string2binary(data);
            }
        }
    }
    else { // arraybuffer, uint8array, ...
        o.base64 = false;
        o.binary = true;

        if (!dataType && !(data instanceof CompressedObject)) {
            throw new Error("The data of '" + name + "' is in an unsupported format !");
        }

        // special case : it's way easier to work with Uint8Array than with ArrayBuffer
        if (dataType === "arraybuffer") {
            data = utils.transformTo("uint8array", data);
        }
    }

    var object = new ZipObject(name, data, o);
    this.files[name] = object;
    return object;
};

/**
 * Find the parent folder of the path.
 * @private
 * @param {string} path the path to use
 * @return {string} the parent folder, or ""
 */
var parentFolder = function (path) {
    if (path.slice(-1) == '/') {
        path = path.substring(0, path.length - 1);
    }
    var lastSlash = path.lastIndexOf('/');
    return (lastSlash > 0) ? path.substring(0, lastSlash) : "";
};


/**
 * Returns the path with a slash at the end.
 * @private
 * @param {String} path the path to check.
 * @return {String} the path with a trailing slash.
 */
var forceTrailingSlash = function(path) {
    // Check the name ends with a /
    if (path.slice(-1) != "/") {
        path += "/"; // IE doesn't like substr(-1)
    }
    return path;
};
/**
 * Add a (sub) folder in the current folder.
 * @private
 * @param {string} name the folder's name
 * @param {boolean=} [createFolders] If true, automatically create sub
 *  folders. Defaults to false.
 * @return {Object} the new folder.
 */
var folderAdd = function(name, createFolders) {
    createFolders = (typeof createFolders !== 'undefined') ? createFolders : false;

    name = forceTrailingSlash(name);

    // Does this folder already exist?
    if (!this.files[name]) {
        fileAdd.call(this, name, null, {
            dir: true,
            createFolders: createFolders
        });
    }
    return this.files[name];
};

/**
 * Generate a JSZip.CompressedObject for a given zipOject.
 * @param {ZipObject} file the object to read.
 * @param {JSZip.compression} compression the compression to use.
 * @param {Object} compressionOptions the options to use when compressing.
 * @return {JSZip.CompressedObject} the compressed result.
 */
var generateCompressedObjectFrom = function(file, compression, compressionOptions) {
    var result = new CompressedObject(),
        content;

    // the data has not been decompressed, we might reuse things !
    if (file._data instanceof CompressedObject) {
        result.uncompressedSize = file._data.uncompressedSize;
        result.crc32 = file._data.crc32;

        if (result.uncompressedSize === 0 || file.dir) {
            compression = compressions['STORE'];
            result.compressedContent = "";
            result.crc32 = 0;
        }
        else if (file._data.compressionMethod === compression.magic) {
            result.compressedContent = file._data.getCompressedContent();
        }
        else {
            content = file._data.getContent();
            // need to decompress / recompress
            result.compressedContent = compression.compress(utils.transformTo(compression.compressInputType, content), compressionOptions);
        }
    }
    else {
        // have uncompressed data
        content = getBinaryData(file);
        if (!content || content.length === 0 || file.dir) {
            compression = compressions['STORE'];
            content = "";
        }
        result.uncompressedSize = content.length;
        result.crc32 = crc32(content);
        result.compressedContent = compression.compress(utils.transformTo(compression.compressInputType, content), compressionOptions);
    }

    result.compressedSize = result.compressedContent.length;
    result.compressionMethod = compression.magic;

    return result;
};




/**
 * Generate the UNIX part of the external file attributes.
 * @param {Object} unixPermissions the unix permissions or null.
 * @param {Boolean} isDir true if the entry is a directory, false otherwise.
 * @return {Number} a 32 bit integer.
 *
 * adapted from http://unix.stackexchange.com/questions/14705/the-zip-formats-external-file-attribute :
 *
 * TTTTsstrwxrwxrwx0000000000ADVSHR
 * ^^^^____________________________ file type, see zipinfo.c (UNX_*)
 *     ^^^_________________________ setuid, setgid, sticky
 *        ^^^^^^^^^________________ permissions
 *                 ^^^^^^^^^^______ not used ?
 *                           ^^^^^^ DOS attribute bits : Archive, Directory, Volume label, System file, Hidden, Read only
 */
var generateUnixExternalFileAttr = function (unixPermissions, isDir) {

    var result = unixPermissions;
    if (!unixPermissions) {
        // I can't use octal values in strict mode, hence the hexa.
        //  040775 => 0x41fd
        // 0100664 => 0x81b4
        result = isDir ? 0x41fd : 0x81b4;
    }

    return (result & 0xFFFF) << 16;
};

/**
 * Generate the DOS part of the external file attributes.
 * @param {Object} dosPermissions the dos permissions or null.
 * @param {Boolean} isDir true if the entry is a directory, false otherwise.
 * @return {Number} a 32 bit integer.
 *
 * Bit 0     Read-Only
 * Bit 1     Hidden
 * Bit 2     System
 * Bit 3     Volume Label
 * Bit 4     Directory
 * Bit 5     Archive
 */
var generateDosExternalFileAttr = function (dosPermissions, isDir) {

    // the dir flag is already set for compatibility

    return (dosPermissions || 0)  & 0x3F;
};

/**
 * Generate the various parts used in the construction of the final zip file.
 * @param {string} name the file name.
 * @param {ZipObject} file the file content.
 * @param {JSZip.CompressedObject} compressedObject the compressed object.
 * @param {number} offset the current offset from the start of the zip file.
 * @param {String} platform let's pretend we are this platform (change platform dependents fields)
 * @param {Function} encodeFileName the function to encode the file name / comment.
 * @return {object} the zip parts.
 */
var generateZipParts = function(name, file, compressedObject, offset, platform, encodeFileName) {
    var data = compressedObject.compressedContent,
        useCustomEncoding = encodeFileName !== utf8.utf8encode,
        encodedFileName = utils.transformTo("string", encodeFileName(file.name)),
        utfEncodedFileName = utils.transformTo("string", utf8.utf8encode(file.name)),
        comment = file.comment || "",
        encodedComment = utils.transformTo("string", encodeFileName(comment)),
        utfEncodedComment = utils.transformTo("string", utf8.utf8encode(comment)),
        useUTF8ForFileName = utfEncodedFileName.length !== file.name.length,
        useUTF8ForComment = utfEncodedComment.length !== comment.length,
        o = file.options,
        dosTime,
        dosDate,
        extraFields = "",
        unicodePathExtraField = "",
        unicodeCommentExtraField = "",
        dir, date;


    // handle the deprecated options.dir
    if (file._initialMetadata.dir !== file.dir) {
        dir = file.dir;
    } else {
        dir = o.dir;
    }

    // handle the deprecated options.date
    if(file._initialMetadata.date !== file.date) {
        date = file.date;
    } else {
        date = o.date;
    }

    var extFileAttr = 0;
    var versionMadeBy = 0;
    if (dir) {
        // dos or unix, we set the dos dir flag
        extFileAttr |= 0x00010;
    }
    if(platform === "UNIX") {
        versionMadeBy = 0x031E; // UNIX, version 3.0
        extFileAttr |= generateUnixExternalFileAttr(file.unixPermissions, dir);
    } else { // DOS or other, fallback to DOS
        versionMadeBy = 0x0014; // DOS, version 2.0
        extFileAttr |= generateDosExternalFileAttr(file.dosPermissions, dir);
    }

    // date
    // @see http://www.delorie.com/djgpp/doc/rbinter/it/52/13.html
    // @see http://www.delorie.com/djgpp/doc/rbinter/it/65/16.html
    // @see http://www.delorie.com/djgpp/doc/rbinter/it/66/16.html

    dosTime = date.getHours();
    dosTime = dosTime << 6;
    dosTime = dosTime | date.getMinutes();
    dosTime = dosTime << 5;
    dosTime = dosTime | date.getSeconds() / 2;

    dosDate = date.getFullYear() - 1980;
    dosDate = dosDate << 4;
    dosDate = dosDate | (date.getMonth() + 1);
    dosDate = dosDate << 5;
    dosDate = dosDate | date.getDate();

    if (useUTF8ForFileName) {
        // set the unicode path extra field. unzip needs at least one extra
        // field to correctly handle unicode path, so using the path is as good
        // as any other information. This could improve the situation with
        // other archive managers too.
        // This field is usually used without the utf8 flag, with a non
        // unicode path in the header (winrar, winzip). This helps (a bit)
        // with the messy Windows' default compressed folders feature but
        // breaks on p7zip which doesn't seek the unicode path extra field.
        // So for now, UTF-8 everywhere !
        unicodePathExtraField =
            // Version
            decToHex(1, 1) +
            // NameCRC32
            decToHex(crc32(encodedFileName), 4) +
            // UnicodeName
            utfEncodedFileName;

        extraFields +=
            // Info-ZIP Unicode Path Extra Field
            "\x75\x70" +
            // size
            decToHex(unicodePathExtraField.length, 2) +
            // content
            unicodePathExtraField;
    }

    if(useUTF8ForComment) {

        unicodeCommentExtraField =
            // Version
            decToHex(1, 1) +
            // CommentCRC32
            decToHex(this.crc32(encodedComment), 4) +
            // UnicodeName
            utfEncodedComment;

        extraFields +=
            // Info-ZIP Unicode Path Extra Field
            "\x75\x63" +
            // size
            decToHex(unicodeCommentExtraField.length, 2) +
            // content
            unicodeCommentExtraField;
    }

    var header = "";

    // version needed to extract
    header += "\x0A\x00";
    // general purpose bit flag
    // set bit 11 if utf8
    header += !useCustomEncoding && (useUTF8ForFileName || useUTF8ForComment) ? "\x00\x08" : "\x00\x00";
    // compression method
    header += compressedObject.compressionMethod;
    // last mod file time
    header += decToHex(dosTime, 2);
    // last mod file date
    header += decToHex(dosDate, 2);
    // crc-32
    header += decToHex(compressedObject.crc32, 4);
    // compressed size
    header += decToHex(compressedObject.compressedSize, 4);
    // uncompressed size
    header += decToHex(compressedObject.uncompressedSize, 4);
    // file name length
    header += decToHex(encodedFileName.length, 2);
    // extra field length
    header += decToHex(extraFields.length, 2);


    var fileRecord = signature.LOCAL_FILE_HEADER + header + encodedFileName + extraFields;

    var dirRecord = signature.CENTRAL_FILE_HEADER +
    // version made by (00: DOS)
    decToHex(versionMadeBy, 2) +
    // file header (common to file and central directory)
    header +
    // file comment length
    decToHex(encodedComment.length, 2) +
    // disk number start
    "\x00\x00" +
    // internal file attributes TODO
    "\x00\x00" +
    // external file attributes
    decToHex(extFileAttr, 4) +
    // relative offset of local header
    decToHex(offset, 4) +
    // file name
    encodedFileName +
    // extra field
    extraFields +
    // file comment
    encodedComment;

    return {
        fileRecord: fileRecord,
        dirRecord: dirRecord,
        compressedObject: compressedObject
    };
};


// return the actual prototype of JSZip
var out = {
    /**
     * Read an existing zip and merge the data in the current JSZip object.
     * The implementation is in jszip-load.js, don't forget to include it.
     * @param {String|ArrayBuffer|Uint8Array|Buffer} stream  The stream to load
     * @param {Object} options Options for loading the stream.
     *  options.base64 : is the stream in base64 ? default : false
     * @return {JSZip} the current JSZip object
     */
    load: function(stream, options) {
        throw new Error("Load method is not defined. Is the file jszip-load.js included ?");
    },

    /**
     * Filter nested files/folders with the specified function.
     * @param {Function} search the predicate to use :
     * function (relativePath, file) {...}
     * It takes 2 arguments : the relative path and the file.
     * @return {Array} An array of matching elements.
     */
    filter: function(search) {
        var result = [],
            filename, relativePath, file, fileClone;
        for (filename in this.files) {
            file = this.files[filename];
            // return a new object, don't let the user mess with our internal objects :)
            fileClone = new ZipObject(file.name, file._data, utils.extend(file.options));
            relativePath = filename.slice(this.root.length, filename.length);
            if (filename.slice(0, this.root.length) === this.root && // the file is in the current root
            search(relativePath, fileClone)) { // and the file matches the function
                result.push(fileClone);
            }
        }
        return result;
    },

    /**
     * Add a file to the zip file, or search a file.
     * @param   {string|RegExp} name The name of the file to add (if data is defined),
     * the name of the file to find (if no data) or a regex to match files.
     * @param   {String|ArrayBuffer|Uint8Array|Buffer} data  The file data, either raw or base64 encoded
     * @param   {Object} o     File options
     * @return  {JSZip|Object|Array} this JSZip object (when adding a file),
     * a file (when searching by string) or an array of files (when searching by regex).
     */
    file: function(name, data, o) {
        if (arguments.length === 1) {
            if (utils.isRegExp(name)) {
                var regexp = name;
                return this.filter(function(relativePath, file) {
                    return !file.dir && regexp.test(relativePath);
                });
            }
            else { // text
                return this.filter(function(relativePath, file) {
                    return !file.dir && relativePath === name;
                })[0] || null;
            }
        }
        else { // more than one argument : we have data !
            name = this.root + name;
            fileAdd.call(this, name, data, o);
        }
        return this;
    },

    /**
     * Add a directory to the zip file, or search.
     * @param   {String|RegExp} arg The name of the directory to add, or a regex to search folders.
     * @return  {JSZip} an object with the new directory as the root, or an array containing matching folders.
     */
    folder: function(arg) {
        if (!arg) {
            return this;
        }

        if (utils.isRegExp(arg)) {
            return this.filter(function(relativePath, file) {
                return file.dir && arg.test(relativePath);
            });
        }

        // else, name is a new folder
        var name = this.root + arg;
        var newFolder = folderAdd.call(this, name);

        // Allow chaining by returning a new object with this folder as the root
        var ret = this.clone();
        ret.root = newFolder.name;
        return ret;
    },

    /**
     * Delete a file, or a directory and all sub-files, from the zip
     * @param {string} name the name of the file to delete
     * @return {JSZip} this JSZip object
     */
    remove: function(name) {
        name = this.root + name;
        var file = this.files[name];
        if (!file) {
            // Look for any folders
            if (name.slice(-1) != "/") {
                name += "/";
            }
            file = this.files[name];
        }

        if (file && !file.dir) {
            // file
            delete this.files[name];
        } else {
            // maybe a folder, delete recursively
            var kids = this.filter(function(relativePath, file) {
                return file.name.slice(0, name.length) === name;
            });
            for (var i = 0; i < kids.length; i++) {
                delete this.files[kids[i].name];
            }
        }

        return this;
    },

    /**
     * Generate the complete zip file
     * @param {Object} options the options to generate the zip file :
     * - base64, (deprecated, use type instead) true to generate base64.
     * - compression, "STORE" by default.
     * - type, "base64" by default. Values are : string, base64, uint8array, arraybuffer, blob.
     * @return {String|Uint8Array|ArrayBuffer|Buffer|Blob} the zip file
     */
    generate: function(options) {
        options = utils.extend(options || {}, {
            base64: true,
            compression: "STORE",
            compressionOptions : null,
            type: "base64",
            platform: "DOS",
            comment: null,
            mimeType: 'application/zip',
            encodeFileName: utf8.utf8encode
        });

        utils.checkSupport(options.type);

        // accept nodejs `process.platform`
        if(
          options.platform === 'darwin' ||
          options.platform === 'freebsd' ||
          options.platform === 'linux' ||
          options.platform === 'sunos'
        ) {
          options.platform = "UNIX";
        }
        if (options.platform === 'win32') {
          options.platform = "DOS";
        }

        var zipData = [],
            localDirLength = 0,
            centralDirLength = 0,
            writer, i,
            encodedComment = utils.transformTo("string", options.encodeFileName(options.comment || this.comment || ""));

        // first, generate all the zip parts.
        for (var name in this.files) {
            var file = this.files[name];

            var compressionName = file.options.compression || options.compression.toUpperCase();
            var compression = compressions[compressionName];
            if (!compression) {
                throw new Error(compressionName + " is not a valid compression method !");
            }
            var compressionOptions = file.options.compressionOptions || options.compressionOptions || {};

            var compressedObject = generateCompressedObjectFrom.call(this, file, compression, compressionOptions);

            var zipPart = generateZipParts.call(this, name, file, compressedObject, localDirLength, options.platform, options.encodeFileName);
            localDirLength += zipPart.fileRecord.length + compressedObject.compressedSize;
            centralDirLength += zipPart.dirRecord.length;
            zipData.push(zipPart);
        }

        var dirEnd = "";

        // end of central dir signature
        dirEnd = signature.CENTRAL_DIRECTORY_END +
        // number of this disk
        "\x00\x00" +
        // number of the disk with the start of the central directory
        "\x00\x00" +
        // total number of entries in the central directory on this disk
        decToHex(zipData.length, 2) +
        // total number of entries in the central directory
        decToHex(zipData.length, 2) +
        // size of the central directory   4 bytes
        decToHex(centralDirLength, 4) +
        // offset of start of central directory with respect to the starting disk number
        decToHex(localDirLength, 4) +
        // .ZIP file comment length
        decToHex(encodedComment.length, 2) +
        // .ZIP file comment
        encodedComment;


        // we have all the parts (and the total length)
        // time to create a writer !
        var typeName = options.type.toLowerCase();
        if(typeName==="uint8array"||typeName==="arraybuffer"||typeName==="blob"||typeName==="nodebuffer") {
            writer = new Uint8ArrayWriter(localDirLength + centralDirLength + dirEnd.length);
        }else{
            writer = new StringWriter(localDirLength + centralDirLength + dirEnd.length);
        }

        for (i = 0; i < zipData.length; i++) {
            writer.append(zipData[i].fileRecord);
            writer.append(zipData[i].compressedObject.compressedContent);
        }
        for (i = 0; i < zipData.length; i++) {
            writer.append(zipData[i].dirRecord);
        }

        writer.append(dirEnd);

        var zip = writer.finalize();



        switch(options.type.toLowerCase()) {
            // case "zip is an Uint8Array"
            case "uint8array" :
            case "arraybuffer" :
            case "nodebuffer" :
               return utils.transformTo(options.type.toLowerCase(), zip);
            case "blob" :
               return utils.arrayBuffer2Blob(utils.transformTo("arraybuffer", zip), options.mimeType);
            // case "zip is a string"
            case "base64" :
               return (options.base64) ? base64.encode(zip) : zip;
            default : // case "string" :
               return zip;
         }

    },

    /**
     * @deprecated
     * This method will be removed in a future version without replacement.
     */
    crc32: function (input, crc) {
        return crc32(input, crc);
    },

    /**
     * @deprecated
     * This method will be removed in a future version without replacement.
     */
    utf8encode: function (string) {
        return utils.transformTo("string", utf8.utf8encode(string));
    },

    /**
     * @deprecated
     * This method will be removed in a future version without replacement.
     */
    utf8decode: function (input) {
        return utf8.utf8decode(input);
    }
};
module.exports = out;

},{"./base64":8,"./compressedObject":9,"./compressions":10,"./crc32":11,"./defaults":13,"./nodeBuffer":18,"./signature":21,"./stringWriter":23,"./support":24,"./uint8ArrayWriter":26,"./utf8":27,"./utils":28}],21:[function(require,module,exports){
'use strict';
exports.LOCAL_FILE_HEADER = "PK\x03\x04";
exports.CENTRAL_FILE_HEADER = "PK\x01\x02";
exports.CENTRAL_DIRECTORY_END = "PK\x05\x06";
exports.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x06\x07";
exports.ZIP64_CENTRAL_DIRECTORY_END = "PK\x06\x06";
exports.DATA_DESCRIPTOR = "PK\x07\x08";

},{}],22:[function(require,module,exports){
'use strict';
var DataReader = require('./dataReader');
var utils = require('./utils');

function StringReader(data, optimizedBinaryString) {
    this.data = data;
    if (!optimizedBinaryString) {
        this.data = utils.string2binary(this.data);
    }
    this.length = this.data.length;
    this.index = 0;
    this.zero = 0;
}
StringReader.prototype = new DataReader();
/**
 * @see DataReader.byteAt
 */
StringReader.prototype.byteAt = function(i) {
    return this.data.charCodeAt(this.zero + i);
};
/**
 * @see DataReader.lastIndexOfSignature
 */
StringReader.prototype.lastIndexOfSignature = function(sig) {
    return this.data.lastIndexOf(sig) - this.zero;
};
/**
 * @see DataReader.readData
 */
StringReader.prototype.readData = function(size) {
    this.checkOffset(size);
    // this will work because the constructor applied the "& 0xff" mask.
    var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
};
module.exports = StringReader;

},{"./dataReader":12,"./utils":28}],23:[function(require,module,exports){
'use strict';

var utils = require('./utils');

/**
 * An object to write any content to a string.
 * @constructor
 */
var StringWriter = function() {
    this.data = [];
};
StringWriter.prototype = {
    /**
     * Append any content to the current string.
     * @param {Object} input the content to add.
     */
    append: function(input) {
        input = utils.transformTo("string", input);
        this.data.push(input);
    },
    /**
     * Finalize the construction an return the result.
     * @return {string} the generated string.
     */
    finalize: function() {
        return this.data.join("");
    }
};

module.exports = StringWriter;

},{"./utils":28}],24:[function(require,module,exports){
(function (Buffer){(function (){
'use strict';
exports.base64 = true;
exports.array = true;
exports.string = true;
exports.arraybuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
// contains true if JSZip can read/generate nodejs Buffer, false otherwise.
// Browserify will provide a Buffer implementation for browsers, which is
// an augmented Uint8Array (i.e., can be used as either Buffer or U8).
exports.nodebuffer = typeof Buffer !== "undefined";
// contains true if JSZip can read/generate Uint8Array, false otherwise.
exports.uint8array = typeof Uint8Array !== "undefined";

if (typeof ArrayBuffer === "undefined") {
    exports.blob = false;
}
else {
    var buffer = new ArrayBuffer(0);
    try {
        exports.blob = new Blob([buffer], {
            type: "application/zip"
        }).size === 0;
    }
    catch (e) {
        try {
            var Builder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
            var builder = new Builder();
            builder.append(buffer);
            exports.blob = builder.getBlob('application/zip').size === 0;
        }
        catch (e) {
            exports.blob = false;
        }
    }
}

}).call(this)}).call(this,require("buffer").Buffer)

},{"buffer":5}],25:[function(require,module,exports){
'use strict';
var ArrayReader = require('./arrayReader');

function Uint8ArrayReader(data) {
    if (data) {
        this.data = data;
        this.length = this.data.length;
        this.index = 0;
        this.zero = 0;
    }
}
Uint8ArrayReader.prototype = new ArrayReader();
/**
 * @see DataReader.readData
 */
Uint8ArrayReader.prototype.readData = function(size) {
    this.checkOffset(size);
    if(size === 0) {
        // in IE10, when using subarray(idx, idx), we get the array [0x00] instead of [].
        return new Uint8Array(0);
    }
    var result = this.data.subarray(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
};
module.exports = Uint8ArrayReader;

},{"./arrayReader":7}],26:[function(require,module,exports){
'use strict';

var utils = require('./utils');

/**
 * An object to write any content to an Uint8Array.
 * @constructor
 * @param {number} length The length of the array.
 */
var Uint8ArrayWriter = function(length) {
    this.data = new Uint8Array(length);
    this.index = 0;
};
Uint8ArrayWriter.prototype = {
    /**
     * Append any content to the current array.
     * @param {Object} input the content to add.
     */
    append: function(input) {
        if (input.length !== 0) {
            // with an empty Uint8Array, Opera fails with a "Offset larger than array size"
            input = utils.transformTo("uint8array", input);
            this.data.set(input, this.index);
            this.index += input.length;
        }
    },
    /**
     * Finalize the construction an return the result.
     * @return {Uint8Array} the generated array.
     */
    finalize: function() {
        return this.data;
    }
};

module.exports = Uint8ArrayWriter;

},{"./utils":28}],27:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var support = require('./support');
var nodeBuffer = require('./nodeBuffer');

/**
 * The following functions come from pako, from pako/lib/utils/strings
 * released under the MIT license, see pako https://github.com/nodeca/pako/
 */

// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
var _utf8len = new Array(256);
for (var i=0; i<256; i++) {
  _utf8len[i] = (i >= 252 ? 6 : i >= 248 ? 5 : i >= 240 ? 4 : i >= 224 ? 3 : i >= 192 ? 2 : 1);
}
_utf8len[254]=_utf8len[254]=1; // Invalid sequence start

// convert string to array (typed, when possible)
var string2buf = function (str) {
    var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;

    // count binary size
    for (m_pos = 0; m_pos < str_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 0xfc00) === 0xd800 && (m_pos+1 < str_len)) {
            c2 = str.charCodeAt(m_pos+1);
            if ((c2 & 0xfc00) === 0xdc00) {
                c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
                m_pos++;
            }
        }
        buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }

    // allocate buffer
    if (support.uint8array) {
        buf = new Uint8Array(buf_len);
    } else {
        buf = new Array(buf_len);
    }

    // convert
    for (i=0, m_pos = 0; i < buf_len; m_pos++) {
        c = str.charCodeAt(m_pos);
        if ((c & 0xfc00) === 0xd800 && (m_pos+1 < str_len)) {
            c2 = str.charCodeAt(m_pos+1);
            if ((c2 & 0xfc00) === 0xdc00) {
                c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
                m_pos++;
            }
        }
        if (c < 0x80) {
            /* one byte */
            buf[i++] = c;
        } else if (c < 0x800) {
            /* two bytes */
            buf[i++] = 0xC0 | (c >>> 6);
            buf[i++] = 0x80 | (c & 0x3f);
        } else if (c < 0x10000) {
            /* three bytes */
            buf[i++] = 0xE0 | (c >>> 12);
            buf[i++] = 0x80 | (c >>> 6 & 0x3f);
            buf[i++] = 0x80 | (c & 0x3f);
        } else {
            /* four bytes */
            buf[i++] = 0xf0 | (c >>> 18);
            buf[i++] = 0x80 | (c >>> 12 & 0x3f);
            buf[i++] = 0x80 | (c >>> 6 & 0x3f);
            buf[i++] = 0x80 | (c & 0x3f);
        }
    }

    return buf;
};

// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
var utf8border = function(buf, max) {
    var pos;

    max = max || buf.length;
    if (max > buf.length) { max = buf.length; }

    // go back from last position, until start of sequence found
    pos = max-1;
    while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) { pos--; }

    // Fuckup - very small and broken sequence,
    // return max, because we should return something anyway.
    if (pos < 0) { return max; }

    // If we came to start of buffer - that means vuffer is too small,
    // return max too.
    if (pos === 0) { return max; }

    return (pos + _utf8len[buf[pos]] > max) ? pos : max;
};

// convert array to string
var buf2string = function (buf) {
    var str, i, out, c, c_len;
    var len = buf.length;

    // Reserve max possible length (2 words per char)
    // NB: by unknown reasons, Array is significantly faster for
    //     String.fromCharCode.apply than Uint16Array.
    var utf16buf = new Array(len*2);

    for (out=0, i=0; i<len;) {
        c = buf[i++];
        // quick process ascii
        if (c < 0x80) { utf16buf[out++] = c; continue; }

        c_len = _utf8len[c];
        // skip 5 & 6 byte codes
        if (c_len > 4) { utf16buf[out++] = 0xfffd; i += c_len-1; continue; }

        // apply mask on first byte
        c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
        // join the rest
        while (c_len > 1 && i < len) {
            c = (c << 6) | (buf[i++] & 0x3f);
            c_len--;
        }

        // terminated by end of string?
        if (c_len > 1) { utf16buf[out++] = 0xfffd; continue; }

        if (c < 0x10000) {
            utf16buf[out++] = c;
        } else {
            c -= 0x10000;
            utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff);
            utf16buf[out++] = 0xdc00 | (c & 0x3ff);
        }
    }

    // shrinkBuf(utf16buf, out)
    if (utf16buf.length !== out) {
        if(utf16buf.subarray) {
            utf16buf = utf16buf.subarray(0, out);
        } else {
            utf16buf.length = out;
        }
    }

    // return String.fromCharCode.apply(null, utf16buf);
    return utils.applyFromCharCode(utf16buf);
};


// That's all for the pako functions.


/**
 * Transform a javascript string into an array (typed if possible) of bytes,
 * UTF-8 encoded.
 * @param {String} str the string to encode
 * @return {Array|Uint8Array|Buffer} the UTF-8 encoded string.
 */
exports.utf8encode = function utf8encode(str) {
    if (support.nodebuffer) {
        return nodeBuffer(str, "utf-8");
    }

    return string2buf(str);
};


/**
 * Transform a bytes array (or a representation) representing an UTF-8 encoded
 * string into a javascript string.
 * @param {Array|Uint8Array|Buffer} buf the data de decode
 * @return {String} the decoded string.
 */
exports.utf8decode = function utf8decode(buf) {
    if (support.nodebuffer) {
        return utils.transformTo("nodebuffer", buf).toString("utf-8");
    }

    buf = utils.transformTo(support.uint8array ? "uint8array" : "array", buf);

    // return buf2string(buf);
    // Chrome prefers to work with "small" chunks of data
    // for the method buf2string.
    // Firefox and Chrome has their own shortcut, IE doesn't seem to really care.
    var result = [], k = 0, len = buf.length, chunk = 65536;
    while (k < len) {
        var nextBoundary = utf8border(buf, Math.min(k + chunk, len));
        if (support.uint8array) {
            result.push(buf2string(buf.subarray(k, nextBoundary)));
        } else {
            result.push(buf2string(buf.slice(k, nextBoundary)));
        }
        k = nextBoundary;
    }
    return result.join("");

};
// vim: set shiftwidth=4 softtabstop=4:

},{"./nodeBuffer":18,"./support":24,"./utils":28}],28:[function(require,module,exports){
'use strict';
var support = require('./support');
var compressions = require('./compressions');
var nodeBuffer = require('./nodeBuffer');
/**
 * Convert a string to a "binary string" : a string containing only char codes between 0 and 255.
 * @param {string} str the string to transform.
 * @return {String} the binary string.
 */
exports.string2binary = function(str) {
    var result = "";
    for (var i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) & 0xff);
    }
    return result;
};
exports.arrayBuffer2Blob = function(buffer, mimeType) {
    exports.checkSupport("blob");
	mimeType = mimeType || 'application/zip';

    try {
        // Blob constructor
        return new Blob([buffer], {
            type: mimeType
        });
    }
    catch (e) {

        try {
            // deprecated, browser only, old way
            var Builder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
            var builder = new Builder();
            builder.append(buffer);
            return builder.getBlob(mimeType);
        }
        catch (e) {

            // well, fuck ?!
            throw new Error("Bug : can't construct the Blob.");
        }
    }


};
/**
 * The identity function.
 * @param {Object} input the input.
 * @return {Object} the same input.
 */
function identity(input) {
    return input;
}

/**
 * Fill in an array with a string.
 * @param {String} str the string to use.
 * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to fill in (will be mutated).
 * @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated array.
 */
function stringToArrayLike(str, array) {
    for (var i = 0; i < str.length; ++i) {
        array[i] = str.charCodeAt(i) & 0xFF;
    }
    return array;
}

/**
 * Transform an array-like object to a string.
 * @param {Array|ArrayBuffer|Uint8Array|Buffer} array the array to transform.
 * @return {String} the result.
 */
function arrayLikeToString(array) {
    // Performances notes :
    // --------------------
    // String.fromCharCode.apply(null, array) is the fastest, see
    // see http://jsperf.com/converting-a-uint8array-to-a-string/2
    // but the stack is limited (and we can get huge arrays !).
    //
    // result += String.fromCharCode(array[i]); generate too many strings !
    //
    // This code is inspired by http://jsperf.com/arraybuffer-to-string-apply-performance/2
    var chunk = 65536;
    var result = [],
        len = array.length,
        type = exports.getTypeOf(array),
        k = 0,
        canUseApply = true;
      try {
         switch(type) {
            case "uint8array":
               String.fromCharCode.apply(null, new Uint8Array(0));
               break;
            case "nodebuffer":
               String.fromCharCode.apply(null, nodeBuffer(0));
               break;
         }
      } catch(e) {
         canUseApply = false;
      }

      // no apply : slow and painful algorithm
      // default browser on android 4.*
      if (!canUseApply) {
         var resultStr = "";
         for(var i = 0; i < array.length;i++) {
            resultStr += String.fromCharCode(array[i]);
         }
    return resultStr;
    }
    while (k < len && chunk > 1) {
        try {
            if (type === "array" || type === "nodebuffer") {
                result.push(String.fromCharCode.apply(null, array.slice(k, Math.min(k + chunk, len))));
            }
            else {
                result.push(String.fromCharCode.apply(null, array.subarray(k, Math.min(k + chunk, len))));
            }
            k += chunk;
        }
        catch (e) {
            chunk = Math.floor(chunk / 2);
        }
    }
    return result.join("");
}

exports.applyFromCharCode = arrayLikeToString;


/**
 * Copy the data from an array-like to an other array-like.
 * @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayFrom the origin array.
 * @param {Array|ArrayBuffer|Uint8Array|Buffer} arrayTo the destination array which will be mutated.
 * @return {Array|ArrayBuffer|Uint8Array|Buffer} the updated destination array.
 */
function arrayLikeToArrayLike(arrayFrom, arrayTo) {
    for (var i = 0; i < arrayFrom.length; i++) {
        arrayTo[i] = arrayFrom[i];
    }
    return arrayTo;
}

// a matrix containing functions to transform everything into everything.
var transform = {};

// string to ?
transform["string"] = {
    "string": identity,
    "array": function(input) {
        return stringToArrayLike(input, new Array(input.length));
    },
    "arraybuffer": function(input) {
        return transform["string"]["uint8array"](input).buffer;
    },
    "uint8array": function(input) {
        return stringToArrayLike(input, new Uint8Array(input.length));
    },
    "nodebuffer": function(input) {
        return stringToArrayLike(input, nodeBuffer(input.length));
    }
};

// array to ?
transform["array"] = {
    "string": arrayLikeToString,
    "array": identity,
    "arraybuffer": function(input) {
        return (new Uint8Array(input)).buffer;
    },
    "uint8array": function(input) {
        return new Uint8Array(input);
    },
    "nodebuffer": function(input) {
        return nodeBuffer(input);
    }
};

// arraybuffer to ?
transform["arraybuffer"] = {
    "string": function(input) {
        return arrayLikeToString(new Uint8Array(input));
    },
    "array": function(input) {
        return arrayLikeToArrayLike(new Uint8Array(input), new Array(input.byteLength));
    },
    "arraybuffer": identity,
    "uint8array": function(input) {
        return new Uint8Array(input);
    },
    "nodebuffer": function(input) {
        return nodeBuffer(new Uint8Array(input));
    }
};

// uint8array to ?
transform["uint8array"] = {
    "string": arrayLikeToString,
    "array": function(input) {
        return arrayLikeToArrayLike(input, new Array(input.length));
    },
    "arraybuffer": function(input) {
        return input.buffer;
    },
    "uint8array": identity,
    "nodebuffer": function(input) {
        return nodeBuffer(input);
    }
};

// nodebuffer to ?
transform["nodebuffer"] = {
    "string": arrayLikeToString,
    "array": function(input) {
        return arrayLikeToArrayLike(input, new Array(input.length));
    },
    "arraybuffer": function(input) {
        return transform["nodebuffer"]["uint8array"](input).buffer;
    },
    "uint8array": function(input) {
        return arrayLikeToArrayLike(input, new Uint8Array(input.length));
    },
    "nodebuffer": identity
};

/**
 * Transform an input into any type.
 * The supported output type are : string, array, uint8array, arraybuffer, nodebuffer.
 * If no output type is specified, the unmodified input will be returned.
 * @param {String} outputType the output type.
 * @param {String|Array|ArrayBuffer|Uint8Array|Buffer} input the input to convert.
 * @throws {Error} an Error if the browser doesn't support the requested output type.
 */
exports.transformTo = function(outputType, input) {
    if (!input) {
        // undefined, null, etc
        // an empty string won't harm.
        input = "";
    }
    if (!outputType) {
        return input;
    }
    exports.checkSupport(outputType);
    var inputType = exports.getTypeOf(input);
    var result = transform[inputType][outputType](input);
    return result;
};

/**
 * Return the type of the input.
 * The type will be in a format valid for JSZip.utils.transformTo : string, array, uint8array, arraybuffer.
 * @param {Object} input the input to identify.
 * @return {String} the (lowercase) type of the input.
 */
exports.getTypeOf = function(input) {
    if (typeof input === "string") {
        return "string";
    }
    if (Object.prototype.toString.call(input) === "[object Array]") {
        return "array";
    }
    if (support.nodebuffer && nodeBuffer.test(input)) {
        return "nodebuffer";
    }
    if (support.uint8array && input instanceof Uint8Array) {
        return "uint8array";
    }
    if (support.arraybuffer && input instanceof ArrayBuffer) {
        return "arraybuffer";
    }
};

/**
 * Throw an exception if the type is not supported.
 * @param {String} type the type to check.
 * @throws {Error} an Error if the browser doesn't support the requested type.
 */
exports.checkSupport = function(type) {
    var supported = support[type.toLowerCase()];
    if (!supported) {
        throw new Error(type + " is not supported by this browser");
    }
};
exports.MAX_VALUE_16BITS = 65535;
exports.MAX_VALUE_32BITS = -1; // well, "\xFF\xFF\xFF\xFF\xFF\xFF\xFF\xFF" is parsed as -1

/**
 * Prettify a string read as binary.
 * @param {string} str the string to prettify.
 * @return {string} a pretty string.
 */
exports.pretty = function(str) {
    var res = '',
        code, i;
    for (i = 0; i < (str || "").length; i++) {
        code = str.charCodeAt(i);
        res += '\\x' + (code < 16 ? "0" : "") + code.toString(16).toUpperCase();
    }
    return res;
};

/**
 * Find a compression registered in JSZip.
 * @param {string} compressionMethod the method magic to find.
 * @return {Object|null} the JSZip compression object, null if none found.
 */
exports.findCompression = function(compressionMethod) {
    for (var method in compressions) {
        if (!compressions.hasOwnProperty(method)) {
            continue;
        }
        if (compressions[method].magic === compressionMethod) {
            return compressions[method];
        }
    }
    return null;
};
/**
* Cross-window, cross-Node-context regular expression detection
* @param  {Object}  object Anything
* @return {Boolean}        true if the object is a regular expression,
* false otherwise
*/
exports.isRegExp = function (object) {
    return Object.prototype.toString.call(object) === "[object RegExp]";
};

/**
 * Merge the objects passed as parameters into a new one.
 * @private
 * @param {...Object} var_args All objects to merge.
 * @return {Object} a new object with the data of the others.
 */
exports.extend = function() {
    var result = {}, i, attr;
    for (i = 0; i < arguments.length; i++) { // arguments is not enumerable in some browsers
        for (attr in arguments[i]) {
            if (arguments[i].hasOwnProperty(attr) && typeof result[attr] === "undefined") {
                result[attr] = arguments[i][attr];
            }
        }
    }
    return result;
};


},{"./compressions":10,"./nodeBuffer":18,"./support":24}],29:[function(require,module,exports){
'use strict';
var StringReader = require('./stringReader');
var NodeBufferReader = require('./nodeBufferReader');
var Uint8ArrayReader = require('./uint8ArrayReader');
var ArrayReader = require('./arrayReader');
var utils = require('./utils');
var sig = require('./signature');
var ZipEntry = require('./zipEntry');
var support = require('./support');
var jszipProto = require('./object');
//  class ZipEntries {{{
/**
 * All the entries in the zip file.
 * @constructor
 * @param {String|ArrayBuffer|Uint8Array} data the binary stream to load.
 * @param {Object} loadOptions Options for loading the stream.
 */
function ZipEntries(data, loadOptions) {
    this.files = [];
    this.loadOptions = loadOptions;
    if (data) {
        this.load(data);
    }
}
ZipEntries.prototype = {
    /**
     * Check that the reader is on the speficied signature.
     * @param {string} expectedSignature the expected signature.
     * @throws {Error} if it is an other signature.
     */
    checkSignature: function(expectedSignature) {
        var signature = this.reader.readString(4);
        if (signature !== expectedSignature) {
            throw new Error("Corrupted zip or bug : unexpected signature " + "(" + utils.pretty(signature) + ", expected " + utils.pretty(expectedSignature) + ")");
        }
    },
    /**
     * Check if the given signature is at the given index.
     * @param {number} askedIndex the index to check.
     * @param {string} expectedSignature the signature to expect.
     * @return {boolean} true if the signature is here, false otherwise.
     */
    isSignature: function(askedIndex, expectedSignature) {
        var currentIndex = this.reader.index;
        this.reader.setIndex(askedIndex);
        var signature = this.reader.readString(4);
        var result = signature === expectedSignature;
        this.reader.setIndex(currentIndex);
        return result;
    },
    /**
     * Read the end of the central directory.
     */
    readBlockEndOfCentral: function() {
        this.diskNumber = this.reader.readInt(2);
        this.diskWithCentralDirStart = this.reader.readInt(2);
        this.centralDirRecordsOnThisDisk = this.reader.readInt(2);
        this.centralDirRecords = this.reader.readInt(2);
        this.centralDirSize = this.reader.readInt(4);
        this.centralDirOffset = this.reader.readInt(4);

        this.zipCommentLength = this.reader.readInt(2);
        // warning : the encoding depends of the system locale
        // On a linux machine with LANG=en_US.utf8, this field is utf8 encoded.
        // On a windows machine, this field is encoded with the localized windows code page.
        var zipComment = this.reader.readData(this.zipCommentLength);
        var decodeParamType = support.uint8array ? "uint8array" : "array";
        // To get consistent behavior with the generation part, we will assume that
        // this is utf8 encoded unless specified otherwise.
        var decodeContent = utils.transformTo(decodeParamType, zipComment);
        this.zipComment = this.loadOptions.decodeFileName(decodeContent);
    },
    /**
     * Read the end of the Zip 64 central directory.
     * Not merged with the method readEndOfCentral :
     * The end of central can coexist with its Zip64 brother,
     * I don't want to read the wrong number of bytes !
     */
    readBlockZip64EndOfCentral: function() {
        this.zip64EndOfCentralSize = this.reader.readInt(8);
        this.versionMadeBy = this.reader.readString(2);
        this.versionNeeded = this.reader.readInt(2);
        this.diskNumber = this.reader.readInt(4);
        this.diskWithCentralDirStart = this.reader.readInt(4);
        this.centralDirRecordsOnThisDisk = this.reader.readInt(8);
        this.centralDirRecords = this.reader.readInt(8);
        this.centralDirSize = this.reader.readInt(8);
        this.centralDirOffset = this.reader.readInt(8);

        this.zip64ExtensibleData = {};
        var extraDataSize = this.zip64EndOfCentralSize - 44,
            index = 0,
            extraFieldId,
            extraFieldLength,
            extraFieldValue;
        while (index < extraDataSize) {
            extraFieldId = this.reader.readInt(2);
            extraFieldLength = this.reader.readInt(4);
            extraFieldValue = this.reader.readString(extraFieldLength);
            this.zip64ExtensibleData[extraFieldId] = {
                id: extraFieldId,
                length: extraFieldLength,
                value: extraFieldValue
            };
        }
    },
    /**
     * Read the end of the Zip 64 central directory locator.
     */
    readBlockZip64EndOfCentralLocator: function() {
        this.diskWithZip64CentralDirStart = this.reader.readInt(4);
        this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);
        this.disksCount = this.reader.readInt(4);
        if (this.disksCount > 1) {
            throw new Error("Multi-volumes zip are not supported");
        }
    },
    /**
     * Read the local files, based on the offset read in the central part.
     */
    readLocalFiles: function() {
        var i, file;
        for (i = 0; i < this.files.length; i++) {
            file = this.files[i];
            this.reader.setIndex(file.localHeaderOffset);
            this.checkSignature(sig.LOCAL_FILE_HEADER);
            file.readLocalPart(this.reader);
            file.handleUTF8();
            file.processAttributes();
        }
    },
    /**
     * Read the central directory.
     */
    readCentralDir: function() {
        var file;

        this.reader.setIndex(this.centralDirOffset);
        while (this.reader.readString(4) === sig.CENTRAL_FILE_HEADER) {
            file = new ZipEntry({
                zip64: this.zip64
            }, this.loadOptions);
            file.readCentralPart(this.reader);
            this.files.push(file);
        }

        if (this.centralDirRecords !== this.files.length) {
            if (this.centralDirRecords !== 0 && this.files.length === 0) {
                // We expected some records but couldn't find ANY.
                // This is really suspicious, as if something went wrong.
                throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
            } else {
                // We found some records but not all.
                // Something is wrong but we got something for the user: no error here.
                // console.warn("expected", this.centralDirRecords, "records in central dir, got", this.files.length);
            }
        }
    },
    /**
     * Read the end of central directory.
     */
    readEndOfCentral: function() {
        var offset = this.reader.lastIndexOfSignature(sig.CENTRAL_DIRECTORY_END);
        if (offset < 0) {
            // Check if the content is a truncated zip or complete garbage.
            // A "LOCAL_FILE_HEADER" is not required at the beginning (auto
            // extractible zip for example) but it can give a good hint.
            // If an ajax request was used without responseType, we will also
            // get unreadable data.
            var isGarbage = !this.isSignature(0, sig.LOCAL_FILE_HEADER);

            if (isGarbage) {
                throw new Error("Can't find end of central directory : is this a zip file ? " +
                                "If it is, see http://stuk.github.io/jszip/documentation/howto/read_zip.html");
            } else {
                throw new Error("Corrupted zip : can't find end of central directory");
            }
        }
        this.reader.setIndex(offset);
        var endOfCentralDirOffset = offset;
        this.checkSignature(sig.CENTRAL_DIRECTORY_END);
        this.readBlockEndOfCentral();


        /* extract from the zip spec :
            4)  If one of the fields in the end of central directory
                record is too small to hold required data, the field
                should be set to -1 (0xFFFF or 0xFFFFFFFF) and the
                ZIP64 format record should be created.
            5)  The end of central directory record and the
                Zip64 end of central directory locator record must
                reside on the same disk when splitting or spanning
                an archive.
         */
        if (this.diskNumber === utils.MAX_VALUE_16BITS || this.diskWithCentralDirStart === utils.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === utils.MAX_VALUE_16BITS || this.centralDirRecords === utils.MAX_VALUE_16BITS || this.centralDirSize === utils.MAX_VALUE_32BITS || this.centralDirOffset === utils.MAX_VALUE_32BITS) {
            this.zip64 = true;

            /*
            Warning : the zip64 extension is supported, but ONLY if the 64bits integer read from
            the zip file can fit into a 32bits integer. This cannot be solved : Javascript represents
            all numbers as 64-bit double precision IEEE 754 floating point numbers.
            So, we have 53bits for integers and bitwise operations treat everything as 32bits.
            see https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Operators/Bitwise_Operators
            and http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-262.pdf section 8.5
            */

            // should look for a zip64 EOCD locator
            offset = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
            if (offset < 0) {
                throw new Error("Corrupted zip : can't find the ZIP64 end of central directory locator");
            }
            this.reader.setIndex(offset);
            this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
            this.readBlockZip64EndOfCentralLocator();

            // now the zip64 EOCD record
            if (!this.isSignature(this.relativeOffsetEndOfZip64CentralDir, sig.ZIP64_CENTRAL_DIRECTORY_END)) {
                // console.warn("ZIP64 end of central directory not where expected.");
                this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
                if (this.relativeOffsetEndOfZip64CentralDir < 0) {
                    throw new Error("Corrupted zip : can't find the ZIP64 end of central directory");
                }
            }
            this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);
            this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
            this.readBlockZip64EndOfCentral();
        }

        var expectedEndOfCentralDirOffset = this.centralDirOffset + this.centralDirSize;
        if (this.zip64) {
            expectedEndOfCentralDirOffset += 20; // end of central dir 64 locator
            expectedEndOfCentralDirOffset += 12 /* should not include the leading 12 bytes */ + this.zip64EndOfCentralSize;
        }

        var extraBytes = endOfCentralDirOffset - expectedEndOfCentralDirOffset;

        if (extraBytes > 0) {
            // console.warn(extraBytes, "extra bytes at beginning or within zipfile");
            if (this.isSignature(endOfCentralDirOffset, sig.CENTRAL_FILE_HEADER)) {
                // The offsets seem wrong, but we have something at the specified offset.
                // So… we keep it.
            } else {
                // the offset is wrong, update the "zero" of the reader
                // this happens if data has been prepended (crx files for example)
                this.reader.zero = extraBytes;
            }
        } else if (extraBytes < 0) {
            throw new Error("Corrupted zip: missing " + Math.abs(extraBytes) + " bytes.");
        }
    },
    prepareReader: function(data) {
        var type = utils.getTypeOf(data);
        utils.checkSupport(type);
        if (type === "string" && !support.uint8array) {
            this.reader = new StringReader(data, this.loadOptions.optimizedBinaryString);
        }
        else if (type === "nodebuffer") {
            this.reader = new NodeBufferReader(data);
        }
        else if (support.uint8array) {
            this.reader = new Uint8ArrayReader(utils.transformTo("uint8array", data));
        } else if (support.array) {
            this.reader = new ArrayReader(utils.transformTo("array", data));
        } else {
            throw new Error("Unexpected error: unsupported type '" + type + "'");
        }
    },
    /**
     * Read a zip file and create ZipEntries.
     * @param {String|ArrayBuffer|Uint8Array|Buffer} data the binary string representing a zip file.
     */
    load: function(data) {
        this.prepareReader(data);
        this.readEndOfCentral();
        this.readCentralDir();
        this.readLocalFiles();
    }
};
// }}} end of ZipEntries
module.exports = ZipEntries;

},{"./arrayReader":7,"./nodeBufferReader":19,"./object":20,"./signature":21,"./stringReader":22,"./support":24,"./uint8ArrayReader":25,"./utils":28,"./zipEntry":30}],30:[function(require,module,exports){
'use strict';
var StringReader = require('./stringReader');
var utils = require('./utils');
var CompressedObject = require('./compressedObject');
var jszipProto = require('./object');
var support = require('./support');

var MADE_BY_DOS = 0x00;
var MADE_BY_UNIX = 0x03;

// class ZipEntry {{{
/**
 * An entry in the zip file.
 * @constructor
 * @param {Object} options Options of the current file.
 * @param {Object} loadOptions Options for loading the stream.
 */
function ZipEntry(options, loadOptions) {
    this.options = options;
    this.loadOptions = loadOptions;
}
ZipEntry.prototype = {
    /**
     * say if the file is encrypted.
     * @return {boolean} true if the file is encrypted, false otherwise.
     */
    isEncrypted: function() {
        // bit 1 is set
        return (this.bitFlag & 0x0001) === 0x0001;
    },
    /**
     * say if the file has utf-8 filename/comment.
     * @return {boolean} true if the filename/comment is in utf-8, false otherwise.
     */
    useUTF8: function() {
        // bit 11 is set
        return (this.bitFlag & 0x0800) === 0x0800;
    },
    /**
     * Prepare the function used to generate the compressed content from this ZipFile.
     * @param {DataReader} reader the reader to use.
     * @param {number} from the offset from where we should read the data.
     * @param {number} length the length of the data to read.
     * @return {Function} the callback to get the compressed content (the type depends of the DataReader class).
     */
    prepareCompressedContent: function(reader, from, length) {
        return function() {
            var previousIndex = reader.index;
            reader.setIndex(from);
            var compressedFileData = reader.readData(length);
            reader.setIndex(previousIndex);

            return compressedFileData;
        };
    },
    /**
     * Prepare the function used to generate the uncompressed content from this ZipFile.
     * @param {DataReader} reader the reader to use.
     * @param {number} from the offset from where we should read the data.
     * @param {number} length the length of the data to read.
     * @param {JSZip.compression} compression the compression used on this file.
     * @param {number} uncompressedSize the uncompressed size to expect.
     * @return {Function} the callback to get the uncompressed content (the type depends of the DataReader class).
     */
    prepareContent: function(reader, from, length, compression, uncompressedSize) {
        return function() {

            var compressedFileData = utils.transformTo(compression.uncompressInputType, this.getCompressedContent());
            var uncompressedFileData = compression.uncompress(compressedFileData);

            if (uncompressedFileData.length !== uncompressedSize) {
                throw new Error("Bug : uncompressed data size mismatch");
            }

            return uncompressedFileData;
        };
    },
    /**
     * Read the local part of a zip file and add the info in this object.
     * @param {DataReader} reader the reader to use.
     */
    readLocalPart: function(reader) {
        var compression, localExtraFieldsLength;

        // we already know everything from the central dir !
        // If the central dir data are false, we are doomed.
        // On the bright side, the local part is scary  : zip64, data descriptors, both, etc.
        // The less data we get here, the more reliable this should be.
        // Let's skip the whole header and dash to the data !
        reader.skip(22);
        // in some zip created on windows, the filename stored in the central dir contains \ instead of /.
        // Strangely, the filename here is OK.
        // I would love to treat these zip files as corrupted (see http://www.info-zip.org/FAQ.html#backslashes
        // or APPNOTE#4.4.17.1, "All slashes MUST be forward slashes '/'") but there are a lot of bad zip generators...
        // Search "unzip mismatching "local" filename continuing with "central" filename version" on
        // the internet.
        //
        // I think I see the logic here : the central directory is used to display
        // content and the local directory is used to extract the files. Mixing / and \
        // may be used to display \ to windows users and use / when extracting the files.
        // Unfortunately, this lead also to some issues : http://seclists.org/fulldisclosure/2009/Sep/394
        this.fileNameLength = reader.readInt(2);
        localExtraFieldsLength = reader.readInt(2); // can't be sure this will be the same as the central dir
        this.fileName = reader.readData(this.fileNameLength);
        reader.skip(localExtraFieldsLength);

        if (this.compressedSize == -1 || this.uncompressedSize == -1) {
            throw new Error("Bug or corrupted zip : didn't get enough informations from the central directory " + "(compressedSize == -1 || uncompressedSize == -1)");
        }

        compression = utils.findCompression(this.compressionMethod);
        if (compression === null) { // no compression found
            throw new Error("Corrupted zip : compression " + utils.pretty(this.compressionMethod) + " unknown (inner file : " +  utils.transformTo("string", this.fileName) + ")");
        }
        this.decompressed = new CompressedObject();
        this.decompressed.compressedSize = this.compressedSize;
        this.decompressed.uncompressedSize = this.uncompressedSize;
        this.decompressed.crc32 = this.crc32;
        this.decompressed.compressionMethod = this.compressionMethod;
        this.decompressed.getCompressedContent = this.prepareCompressedContent(reader, reader.index, this.compressedSize, compression);
        this.decompressed.getContent = this.prepareContent(reader, reader.index, this.compressedSize, compression, this.uncompressedSize);

        // we need to compute the crc32...
        if (this.loadOptions.checkCRC32) {
            this.decompressed = utils.transformTo("string", this.decompressed.getContent());
            if (jszipProto.crc32(this.decompressed) !== this.crc32) {
                throw new Error("Corrupted zip : CRC32 mismatch");
            }
        }
    },

    /**
     * Read the central part of a zip file and add the info in this object.
     * @param {DataReader} reader the reader to use.
     */
    readCentralPart: function(reader) {
        this.versionMadeBy = reader.readInt(2);
        this.versionNeeded = reader.readInt(2);
        this.bitFlag = reader.readInt(2);
        this.compressionMethod = reader.readString(2);
        this.date = reader.readDate();
        this.crc32 = reader.readInt(4);
        this.compressedSize = reader.readInt(4);
        this.uncompressedSize = reader.readInt(4);
        this.fileNameLength = reader.readInt(2);
        this.extraFieldsLength = reader.readInt(2);
        this.fileCommentLength = reader.readInt(2);
        this.diskNumberStart = reader.readInt(2);
        this.internalFileAttributes = reader.readInt(2);
        this.externalFileAttributes = reader.readInt(4);
        this.localHeaderOffset = reader.readInt(4);

        if (this.isEncrypted()) {
            throw new Error("Encrypted zip are not supported");
        }

        this.fileName = reader.readData(this.fileNameLength);
        this.readExtraFields(reader);
        this.parseZIP64ExtraField(reader);
        this.fileComment = reader.readData(this.fileCommentLength);
    },

    /**
     * Parse the external file attributes and get the unix/dos permissions.
     */
    processAttributes: function () {
        this.unixPermissions = null;
        this.dosPermissions = null;
        var madeBy = this.versionMadeBy >> 8;

        // Check if we have the DOS directory flag set.
        // We look for it in the DOS and UNIX permissions
        // but some unknown platform could set it as a compatibility flag.
        this.dir = this.externalFileAttributes & 0x0010 ? true : false;

        if(madeBy === MADE_BY_DOS) {
            // first 6 bits (0 to 5)
            this.dosPermissions = this.externalFileAttributes & 0x3F;
        }

        if(madeBy === MADE_BY_UNIX) {
            this.unixPermissions = (this.externalFileAttributes >> 16) & 0xFFFF;
            // the octal permissions are in (this.unixPermissions & 0x01FF).toString(8);
        }

        // fail safe : if the name ends with a / it probably means a folder
        if (!this.dir && this.fileNameStr.slice(-1) === '/') {
            this.dir = true;
        }
    },

    /**
     * Parse the ZIP64 extra field and merge the info in the current ZipEntry.
     * @param {DataReader} reader the reader to use.
     */
    parseZIP64ExtraField: function(reader) {

        if (!this.extraFields[0x0001]) {
            return;
        }

        // should be something, preparing the extra reader
        var extraReader = new StringReader(this.extraFields[0x0001].value);

        // I really hope that these 64bits integer can fit in 32 bits integer, because js
        // won't let us have more.
        if (this.uncompressedSize === utils.MAX_VALUE_32BITS) {
            this.uncompressedSize = extraReader.readInt(8);
        }
        if (this.compressedSize === utils.MAX_VALUE_32BITS) {
            this.compressedSize = extraReader.readInt(8);
        }
        if (this.localHeaderOffset === utils.MAX_VALUE_32BITS) {
            this.localHeaderOffset = extraReader.readInt(8);
        }
        if (this.diskNumberStart === utils.MAX_VALUE_32BITS) {
            this.diskNumberStart = extraReader.readInt(4);
        }
    },
    /**
     * Read the central part of a zip file and add the info in this object.
     * @param {DataReader} reader the reader to use.
     */
    readExtraFields: function(reader) {
        var start = reader.index,
            extraFieldId,
            extraFieldLength,
            extraFieldValue;

        this.extraFields = this.extraFields || {};

        while (reader.index < start + this.extraFieldsLength) {
            extraFieldId = reader.readInt(2);
            extraFieldLength = reader.readInt(2);
            extraFieldValue = reader.readString(extraFieldLength);

            this.extraFields[extraFieldId] = {
                id: extraFieldId,
                length: extraFieldLength,
                value: extraFieldValue
            };
        }
    },
    /**
     * Apply an UTF8 transformation if needed.
     */
    handleUTF8: function() {
        var decodeParamType = support.uint8array ? "uint8array" : "array";
        if (this.useUTF8()) {
            this.fileNameStr = jszipProto.utf8decode(this.fileName);
            this.fileCommentStr = jszipProto.utf8decode(this.fileComment);
        } else {
            var upath = this.findExtraFieldUnicodePath();
            if (upath !== null) {
                this.fileNameStr = upath;
            } else {
                var fileNameByteArray =  utils.transformTo(decodeParamType, this.fileName);
                this.fileNameStr = this.loadOptions.decodeFileName(fileNameByteArray);
            }

            var ucomment = this.findExtraFieldUnicodeComment();
            if (ucomment !== null) {
                this.fileCommentStr = ucomment;
            } else {
                var commentByteArray =  utils.transformTo(decodeParamType, this.fileComment);
                this.fileCommentStr = this.loadOptions.decodeFileName(commentByteArray);
            }
        }
    },

    /**
     * Find the unicode path declared in the extra field, if any.
     * @return {String} the unicode path, null otherwise.
     */
    findExtraFieldUnicodePath: function() {
        var upathField = this.extraFields[0x7075];
        if (upathField) {
            var extraReader = new StringReader(upathField.value);

            // wrong version
            if (extraReader.readInt(1) !== 1) {
                return null;
            }

            // the crc of the filename changed, this field is out of date.
            if (jszipProto.crc32(this.fileName) !== extraReader.readInt(4)) {
                return null;
            }

            return jszipProto.utf8decode(extraReader.readString(upathField.length - 5));
        }
        return null;
    },

    /**
     * Find the unicode comment declared in the extra field, if any.
     * @return {String} the unicode comment, null otherwise.
     */
    findExtraFieldUnicodeComment: function() {
        var ucommentField = this.extraFields[0x6375];
        if (ucommentField) {
            var extraReader = new StringReader(ucommentField.value);

            // wrong version
            if (extraReader.readInt(1) !== 1) {
                return null;
            }

            // the crc of the comment changed, this field is out of date.
            if (jszipProto.crc32(this.fileComment) !== extraReader.readInt(4)) {
                return null;
            }

            return jszipProto.utf8decode(extraReader.readString(ucommentField.length - 5));
        }
        return null;
    }
};
module.exports = ZipEntry;

},{"./compressedObject":9,"./object":20,"./stringReader":22,"./support":24,"./utils":28}],31:[function(require,module,exports){
// Top level file is just a mixin of submodules & constants
'use strict';

var assign    = require('./lib/utils/common').assign;

var deflate   = require('./lib/deflate');
var inflate   = require('./lib/inflate');
var constants = require('./lib/zlib/constants');

var pako = {};

assign(pako, deflate, inflate, constants);

module.exports = pako;

},{"./lib/deflate":32,"./lib/inflate":33,"./lib/utils/common":34,"./lib/zlib/constants":37}],32:[function(require,module,exports){
'use strict';


var zlib_deflate = require('./zlib/deflate');
var utils        = require('./utils/common');
var strings      = require('./utils/strings');
var msg          = require('./zlib/messages');
var ZStream      = require('./zlib/zstream');

var toString = Object.prototype.toString;

/* Public constants ==========================================================*/
/* ===========================================================================*/

var Z_NO_FLUSH      = 0;
var Z_FINISH        = 4;

var Z_OK            = 0;
var Z_STREAM_END    = 1;
var Z_SYNC_FLUSH    = 2;

var Z_DEFAULT_COMPRESSION = -1;

var Z_DEFAULT_STRATEGY    = 0;

var Z_DEFLATED  = 8;

/* ===========================================================================*/


/**
 * class Deflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[deflate]],
 * [[deflateRaw]] and [[gzip]].
 **/

/* internal
 * Deflate.chunks -> Array
 *
 * Chunks of output data, if [[Deflate#onData]] not overridden.
 **/

/**
 * Deflate.result -> Uint8Array|Array
 *
 * Compressed result, generated by default [[Deflate#onData]]
 * and [[Deflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Deflate#push]] with `Z_FINISH` / `true` param)  or if you
 * push a chunk with explicit flush (call [[Deflate#push]] with
 * `Z_SYNC_FLUSH` param).
 **/

/**
 * Deflate.err -> Number
 *
 * Error code after deflate finished. 0 (Z_OK) on success.
 * You will not need it in real life, because deflate errors
 * are possible only on wrong options or bad `onData` / `onEnd`
 * custom handlers.
 **/

/**
 * Deflate.msg -> String
 *
 * Error message, if [[Deflate.err]] != 0
 **/


/**
 * new Deflate(options)
 * - options (Object): zlib deflate options.
 *
 * Creates new deflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `level`
 * - `windowBits`
 * - `memLevel`
 * - `strategy`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw deflate
 * - `gzip` (Boolean) - create gzip wrapper
 * - `to` (String) - if equal to 'string', then result will be "binary string"
 *    (each char code [0..255])
 * - `header` (Object) - custom header for gzip
 *   - `text` (Boolean) - true if compressed data believed to be text
 *   - `time` (Number) - modification time, unix timestamp
 *   - `os` (Number) - operation system code
 *   - `extra` (Array) - array of bytes with extra data (max 65536)
 *   - `name` (String) - file name (binary string)
 *   - `comment` (String) - comment (binary string)
 *   - `hcrc` (Boolean) - true if header crc should be added
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * var deflate = new pako.Deflate({ level: 3});
 *
 * deflate.push(chunk1, false);
 * deflate.push(chunk2, true);  // true -> last chunk
 *
 * if (deflate.err) { throw new Error(deflate.err); }
 *
 * console.log(deflate.result);
 * ```
 **/
function Deflate(options) {
  if (!(this instanceof Deflate)) return new Deflate(options);

  this.options = utils.assign({
    level: Z_DEFAULT_COMPRESSION,
    method: Z_DEFLATED,
    chunkSize: 16384,
    windowBits: 15,
    memLevel: 8,
    strategy: Z_DEFAULT_STRATEGY,
    to: ''
  }, options || {});

  var opt = this.options;

  if (opt.raw && (opt.windowBits > 0)) {
    opt.windowBits = -opt.windowBits;
  }

  else if (opt.gzip && (opt.windowBits > 0) && (opt.windowBits < 16)) {
    opt.windowBits += 16;
  }

  this.err    = 0;      // error code, if happens (0 = Z_OK)
  this.msg    = '';     // error message
  this.ended  = false;  // used to avoid multiple onEnd() calls
  this.chunks = [];     // chunks of compressed data

  this.strm = new ZStream();
  this.strm.avail_out = 0;

  var status = zlib_deflate.deflateInit2(
    this.strm,
    opt.level,
    opt.method,
    opt.windowBits,
    opt.memLevel,
    opt.strategy
  );

  if (status !== Z_OK) {
    throw new Error(msg[status]);
  }

  if (opt.header) {
    zlib_deflate.deflateSetHeader(this.strm, opt.header);
  }

  if (opt.dictionary) {
    var dict;
    // Convert data if needed
    if (typeof opt.dictionary === 'string') {
      // If we need to compress text, change encoding to utf8.
      dict = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
      dict = new Uint8Array(opt.dictionary);
    } else {
      dict = opt.dictionary;
    }

    status = zlib_deflate.deflateSetDictionary(this.strm, dict);

    if (status !== Z_OK) {
      throw new Error(msg[status]);
    }

    this._dict_set = true;
  }
}

/**
 * Deflate#push(data[, mode]) -> Boolean
 * - data (Uint8Array|Array|ArrayBuffer|String): input data. Strings will be
 *   converted to utf8 byte sequence.
 * - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
 *
 * Sends input data to deflate pipe, generating [[Deflate#onData]] calls with
 * new compressed chunks. Returns `true` on success. The last data block must have
 * mode Z_FINISH (or `true`). That will flush internal pending buffers and call
 * [[Deflate#onEnd]]. For interim explicit flushes (without ending the stream) you
 * can use mode Z_SYNC_FLUSH, keeping the compression context.
 *
 * On fail call [[Deflate#onEnd]] with error code and return false.
 *
 * We strongly recommend to use `Uint8Array` on input for best speed (output
 * array format is detected automatically). Also, don't skip last param and always
 * use the same type in your code (boolean or number). That will improve JS speed.
 *
 * For regular `Array`-s make sure all elements are [0..255].
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Deflate.prototype.push = function (data, mode) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var status, _mode;

  if (this.ended) { return false; }

  _mode = (mode === ~~mode) ? mode : ((mode === true) ? Z_FINISH : Z_NO_FLUSH);

  // Convert data if needed
  if (typeof data === 'string') {
    // If we need to compress text, change encoding to utf8.
    strm.input = strings.string2buf(data);
  } else if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  do {
    if (strm.avail_out === 0) {
      strm.output = new utils.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }
    status = zlib_deflate.deflate(strm, _mode);    /* no bad return value */

    if (status !== Z_STREAM_END && status !== Z_OK) {
      this.onEnd(status);
      this.ended = true;
      return false;
    }
    if (strm.avail_out === 0 || (strm.avail_in === 0 && (_mode === Z_FINISH || _mode === Z_SYNC_FLUSH))) {
      if (this.options.to === 'string') {
        this.onData(strings.buf2binstring(utils.shrinkBuf(strm.output, strm.next_out)));
      } else {
        this.onData(utils.shrinkBuf(strm.output, strm.next_out));
      }
    }
  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END);

  // Finalize on the last chunk.
  if (_mode === Z_FINISH) {
    status = zlib_deflate.deflateEnd(this.strm);
    this.onEnd(status);
    this.ended = true;
    return status === Z_OK;
  }

  // callback interim results if Z_SYNC_FLUSH.
  if (_mode === Z_SYNC_FLUSH) {
    this.onEnd(Z_OK);
    strm.avail_out = 0;
    return true;
  }

  return true;
};


/**
 * Deflate#onData(chunk) -> Void
 * - chunk (Uint8Array|Array|String): output data. Type of array depends
 *   on js engine support. When string output requested, each chunk
 *   will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Deflate.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};


/**
 * Deflate#onEnd(status) -> Void
 * - status (Number): deflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called once after you tell deflate that the input stream is
 * complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
 * or if an error happened. By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Deflate.prototype.onEnd = function (status) {
  // On success - join
  if (status === Z_OK) {
    if (this.options.to === 'string') {
      this.result = this.chunks.join('');
    } else {
      this.result = utils.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};


/**
 * deflate(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * Compress `data` with deflate algorithm and `options`.
 *
 * Supported options are:
 *
 * - level
 * - windowBits
 * - memLevel
 * - strategy
 * - dictionary
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be "binary string"
 *    (each char code [0..255])
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , data = Uint8Array([1,2,3,4,5,6,7,8,9]);
 *
 * console.log(pako.deflate(data));
 * ```
 **/
function deflate(input, options) {
  var deflator = new Deflate(options);

  deflator.push(input, true);

  // That will never happens, if you don't cheat with options :)
  if (deflator.err) { throw deflator.msg || msg[deflator.err]; }

  return deflator.result;
}


/**
 * deflateRaw(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function deflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return deflate(input, options);
}


/**
 * gzip(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to compress.
 * - options (Object): zlib deflate options.
 *
 * The same as [[deflate]], but create gzip wrapper instead of
 * deflate one.
 **/
function gzip(input, options) {
  options = options || {};
  options.gzip = true;
  return deflate(input, options);
}


exports.Deflate = Deflate;
exports.deflate = deflate;
exports.deflateRaw = deflateRaw;
exports.gzip = gzip;

},{"./utils/common":34,"./utils/strings":35,"./zlib/deflate":39,"./zlib/messages":44,"./zlib/zstream":46}],33:[function(require,module,exports){
'use strict';


var zlib_inflate = require('./zlib/inflate');
var utils        = require('./utils/common');
var strings      = require('./utils/strings');
var c            = require('./zlib/constants');
var msg          = require('./zlib/messages');
var ZStream      = require('./zlib/zstream');
var GZheader     = require('./zlib/gzheader');

var toString = Object.prototype.toString;

/**
 * class Inflate
 *
 * Generic JS-style wrapper for zlib calls. If you don't need
 * streaming behaviour - use more simple functions: [[inflate]]
 * and [[inflateRaw]].
 **/

/* internal
 * inflate.chunks -> Array
 *
 * Chunks of output data, if [[Inflate#onData]] not overridden.
 **/

/**
 * Inflate.result -> Uint8Array|Array|String
 *
 * Uncompressed result, generated by default [[Inflate#onData]]
 * and [[Inflate#onEnd]] handlers. Filled after you push last chunk
 * (call [[Inflate#push]] with `Z_FINISH` / `true` param) or if you
 * push a chunk with explicit flush (call [[Inflate#push]] with
 * `Z_SYNC_FLUSH` param).
 **/

/**
 * Inflate.err -> Number
 *
 * Error code after inflate finished. 0 (Z_OK) on success.
 * Should be checked if broken data possible.
 **/

/**
 * Inflate.msg -> String
 *
 * Error message, if [[Inflate.err]] != 0
 **/


/**
 * new Inflate(options)
 * - options (Object): zlib inflate options.
 *
 * Creates new inflator instance with specified params. Throws exception
 * on bad params. Supported options:
 *
 * - `windowBits`
 * - `dictionary`
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information on these.
 *
 * Additional options, for internal needs:
 *
 * - `chunkSize` - size of generated data chunks (16K by default)
 * - `raw` (Boolean) - do raw inflate
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 * By default, when no options set, autodetect deflate/gzip data format via
 * wrapper header.
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , chunk1 = Uint8Array([1,2,3,4,5,6,7,8,9])
 *   , chunk2 = Uint8Array([10,11,12,13,14,15,16,17,18,19]);
 *
 * var inflate = new pako.Inflate({ level: 3});
 *
 * inflate.push(chunk1, false);
 * inflate.push(chunk2, true);  // true -> last chunk
 *
 * if (inflate.err) { throw new Error(inflate.err); }
 *
 * console.log(inflate.result);
 * ```
 **/
function Inflate(options) {
  if (!(this instanceof Inflate)) return new Inflate(options);

  this.options = utils.assign({
    chunkSize: 16384,
    windowBits: 0,
    to: ''
  }, options || {});

  var opt = this.options;

  // Force window size for `raw` data, if not set directly,
  // because we have no header for autodetect.
  if (opt.raw && (opt.windowBits >= 0) && (opt.windowBits < 16)) {
    opt.windowBits = -opt.windowBits;
    if (opt.windowBits === 0) { opt.windowBits = -15; }
  }

  // If `windowBits` not defined (and mode not raw) - set autodetect flag for gzip/deflate
  if ((opt.windowBits >= 0) && (opt.windowBits < 16) &&
      !(options && options.windowBits)) {
    opt.windowBits += 32;
  }

  // Gzip header has no info about windows size, we can do autodetect only
  // for deflate. So, if window size not set, force it to max when gzip possible
  if ((opt.windowBits > 15) && (opt.windowBits < 48)) {
    // bit 3 (16) -> gzipped data
    // bit 4 (32) -> autodetect gzip/deflate
    if ((opt.windowBits & 15) === 0) {
      opt.windowBits |= 15;
    }
  }

  this.err    = 0;      // error code, if happens (0 = Z_OK)
  this.msg    = '';     // error message
  this.ended  = false;  // used to avoid multiple onEnd() calls
  this.chunks = [];     // chunks of compressed data

  this.strm   = new ZStream();
  this.strm.avail_out = 0;

  var status  = zlib_inflate.inflateInit2(
    this.strm,
    opt.windowBits
  );

  if (status !== c.Z_OK) {
    throw new Error(msg[status]);
  }

  this.header = new GZheader();

  zlib_inflate.inflateGetHeader(this.strm, this.header);

  // Setup dictionary
  if (opt.dictionary) {
    // Convert data if needed
    if (typeof opt.dictionary === 'string') {
      opt.dictionary = strings.string2buf(opt.dictionary);
    } else if (toString.call(opt.dictionary) === '[object ArrayBuffer]') {
      opt.dictionary = new Uint8Array(opt.dictionary);
    }
    if (opt.raw) { //In raw mode we need to set the dictionary early
      status = zlib_inflate.inflateSetDictionary(this.strm, opt.dictionary);
      if (status !== c.Z_OK) {
        throw new Error(msg[status]);
      }
    }
  }
}

/**
 * Inflate#push(data[, mode]) -> Boolean
 * - data (Uint8Array|Array|ArrayBuffer|String): input data
 * - mode (Number|Boolean): 0..6 for corresponding Z_NO_FLUSH..Z_TREE modes.
 *   See constants. Skipped or `false` means Z_NO_FLUSH, `true` means Z_FINISH.
 *
 * Sends input data to inflate pipe, generating [[Inflate#onData]] calls with
 * new output chunks. Returns `true` on success. The last data block must have
 * mode Z_FINISH (or `true`). That will flush internal pending buffers and call
 * [[Inflate#onEnd]]. For interim explicit flushes (without ending the stream) you
 * can use mode Z_SYNC_FLUSH, keeping the decompression context.
 *
 * On fail call [[Inflate#onEnd]] with error code and return false.
 *
 * We strongly recommend to use `Uint8Array` on input for best speed (output
 * format is detected automatically). Also, don't skip last param and always
 * use the same type in your code (boolean or number). That will improve JS speed.
 *
 * For regular `Array`-s make sure all elements are [0..255].
 *
 * ##### Example
 *
 * ```javascript
 * push(chunk, false); // push one of data chunks
 * ...
 * push(chunk, true);  // push last chunk
 * ```
 **/
Inflate.prototype.push = function (data, mode) {
  var strm = this.strm;
  var chunkSize = this.options.chunkSize;
  var dictionary = this.options.dictionary;
  var status, _mode;
  var next_out_utf8, tail, utf8str;

  // Flag to properly process Z_BUF_ERROR on testing inflate call
  // when we check that all output data was flushed.
  var allowBufError = false;

  if (this.ended) { return false; }
  _mode = (mode === ~~mode) ? mode : ((mode === true) ? c.Z_FINISH : c.Z_NO_FLUSH);

  // Convert data if needed
  if (typeof data === 'string') {
    // Only binary strings can be decompressed on practice
    strm.input = strings.binstring2buf(data);
  } else if (toString.call(data) === '[object ArrayBuffer]') {
    strm.input = new Uint8Array(data);
  } else {
    strm.input = data;
  }

  strm.next_in = 0;
  strm.avail_in = strm.input.length;

  do {
    if (strm.avail_out === 0) {
      strm.output = new utils.Buf8(chunkSize);
      strm.next_out = 0;
      strm.avail_out = chunkSize;
    }

    status = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);    /* no bad return value */

    if (status === c.Z_NEED_DICT && dictionary) {
      status = zlib_inflate.inflateSetDictionary(this.strm, dictionary);
    }

    if (status === c.Z_BUF_ERROR && allowBufError === true) {
      status = c.Z_OK;
      allowBufError = false;
    }

    if (status !== c.Z_STREAM_END && status !== c.Z_OK) {
      this.onEnd(status);
      this.ended = true;
      return false;
    }

    if (strm.next_out) {
      if (strm.avail_out === 0 || status === c.Z_STREAM_END || (strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH))) {

        if (this.options.to === 'string') {

          next_out_utf8 = strings.utf8border(strm.output, strm.next_out);

          tail = strm.next_out - next_out_utf8;
          utf8str = strings.buf2string(strm.output, next_out_utf8);

          // move tail
          strm.next_out = tail;
          strm.avail_out = chunkSize - tail;
          if (tail) { utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0); }

          this.onData(utf8str);

        } else {
          this.onData(utils.shrinkBuf(strm.output, strm.next_out));
        }
      }
    }

    // When no more input data, we should check that internal inflate buffers
    // are flushed. The only way to do it when avail_out = 0 - run one more
    // inflate pass. But if output data not exists, inflate return Z_BUF_ERROR.
    // Here we set flag to process this error properly.
    //
    // NOTE. Deflate does not return error in this case and does not needs such
    // logic.
    if (strm.avail_in === 0 && strm.avail_out === 0) {
      allowBufError = true;
    }

  } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== c.Z_STREAM_END);

  if (status === c.Z_STREAM_END) {
    _mode = c.Z_FINISH;
  }

  // Finalize on the last chunk.
  if (_mode === c.Z_FINISH) {
    status = zlib_inflate.inflateEnd(this.strm);
    this.onEnd(status);
    this.ended = true;
    return status === c.Z_OK;
  }

  // callback interim results if Z_SYNC_FLUSH.
  if (_mode === c.Z_SYNC_FLUSH) {
    this.onEnd(c.Z_OK);
    strm.avail_out = 0;
    return true;
  }

  return true;
};


/**
 * Inflate#onData(chunk) -> Void
 * - chunk (Uint8Array|Array|String): output data. Type of array depends
 *   on js engine support. When string output requested, each chunk
 *   will be string.
 *
 * By default, stores data blocks in `chunks[]` property and glue
 * those in `onEnd`. Override this handler, if you need another behaviour.
 **/
Inflate.prototype.onData = function (chunk) {
  this.chunks.push(chunk);
};


/**
 * Inflate#onEnd(status) -> Void
 * - status (Number): inflate status. 0 (Z_OK) on success,
 *   other if not.
 *
 * Called either after you tell inflate that the input stream is
 * complete (Z_FINISH) or should be flushed (Z_SYNC_FLUSH)
 * or if an error happened. By default - join collected chunks,
 * free memory and fill `results` / `err` properties.
 **/
Inflate.prototype.onEnd = function (status) {
  // On success - join
  if (status === c.Z_OK) {
    if (this.options.to === 'string') {
      // Glue & convert here, until we teach pako to send
      // utf8 aligned strings to onData
      this.result = this.chunks.join('');
    } else {
      this.result = utils.flattenChunks(this.chunks);
    }
  }
  this.chunks = [];
  this.err = status;
  this.msg = this.strm.msg;
};


/**
 * inflate(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Decompress `data` with inflate/ungzip and `options`. Autodetect
 * format via wrapper header by default. That's why we don't provide
 * separate `ungzip` method.
 *
 * Supported options are:
 *
 * - windowBits
 *
 * [http://zlib.net/manual.html#Advanced](http://zlib.net/manual.html#Advanced)
 * for more information.
 *
 * Sugar (options):
 *
 * - `raw` (Boolean) - say that we work with raw stream, if you don't wish to specify
 *   negative windowBits implicitly.
 * - `to` (String) - if equal to 'string', then result will be converted
 *   from utf8 to utf16 (javascript) string. When string output requested,
 *   chunk length can differ from `chunkSize`, depending on content.
 *
 *
 * ##### Example:
 *
 * ```javascript
 * var pako = require('pako')
 *   , input = pako.deflate([1,2,3,4,5,6,7,8,9])
 *   , output;
 *
 * try {
 *   output = pako.inflate(input);
 * } catch (err)
 *   console.log(err);
 * }
 * ```
 **/
function inflate(input, options) {
  var inflator = new Inflate(options);

  inflator.push(input, true);

  // That will never happens, if you don't cheat with options :)
  if (inflator.err) { throw inflator.msg || msg[inflator.err]; }

  return inflator.result;
}


/**
 * inflateRaw(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * The same as [[inflate]], but creates raw data, without wrapper
 * (header and adler32 crc).
 **/
function inflateRaw(input, options) {
  options = options || {};
  options.raw = true;
  return inflate(input, options);
}


/**
 * ungzip(data[, options]) -> Uint8Array|Array|String
 * - data (Uint8Array|Array|String): input data to decompress.
 * - options (Object): zlib inflate options.
 *
 * Just shortcut to [[inflate]], because it autodetects format
 * by header.content. Done for convenience.
 **/


exports.Inflate = Inflate;
exports.inflate = inflate;
exports.inflateRaw = inflateRaw;
exports.ungzip  = inflate;

},{"./utils/common":34,"./utils/strings":35,"./zlib/constants":37,"./zlib/gzheader":40,"./zlib/inflate":42,"./zlib/messages":44,"./zlib/zstream":46}],34:[function(require,module,exports){
'use strict';


var TYPED_OK =  (typeof Uint8Array !== 'undefined') &&
                (typeof Uint16Array !== 'undefined') &&
                (typeof Int32Array !== 'undefined');

function _has(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

exports.assign = function (obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);
  while (sources.length) {
    var source = sources.shift();
    if (!source) { continue; }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be non-object');
    }

    for (var p in source) {
      if (_has(source, p)) {
        obj[p] = source[p];
      }
    }
  }

  return obj;
};


// reduce buffer size, avoiding mem copy
exports.shrinkBuf = function (buf, size) {
  if (buf.length === size) { return buf; }
  if (buf.subarray) { return buf.subarray(0, size); }
  buf.length = size;
  return buf;
};


var fnTyped = {
  arraySet: function (dest, src, src_offs, len, dest_offs) {
    if (src.subarray && dest.subarray) {
      dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
      return;
    }
    // Fallback to ordinary array
    for (var i = 0; i < len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function (chunks) {
    var i, l, len, pos, chunk, result;

    // calculate data length
    len = 0;
    for (i = 0, l = chunks.length; i < l; i++) {
      len += chunks[i].length;
    }

    // join chunks
    result = new Uint8Array(len);
    pos = 0;
    for (i = 0, l = chunks.length; i < l; i++) {
      chunk = chunks[i];
      result.set(chunk, pos);
      pos += chunk.length;
    }

    return result;
  }
};

var fnUntyped = {
  arraySet: function (dest, src, src_offs, len, dest_offs) {
    for (var i = 0; i < len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  },
  // Join array of chunks to single array.
  flattenChunks: function (chunks) {
    return [].concat.apply([], chunks);
  }
};


// Enable/Disable typed arrays use, for testing
//
exports.setTyped = function (on) {
  if (on) {
    exports.Buf8  = Uint8Array;
    exports.Buf16 = Uint16Array;
    exports.Buf32 = Int32Array;
    exports.assign(exports, fnTyped);
  } else {
    exports.Buf8  = Array;
    exports.Buf16 = Array;
    exports.Buf32 = Array;
    exports.assign(exports, fnUntyped);
  }
};

exports.setTyped(TYPED_OK);

},{}],35:[function(require,module,exports){
// String encode/decode helpers
'use strict';


var utils = require('./common');


// Quick check if we can use fast array to bin string conversion
//
// - apply(Array) can fail on Android 2.2
// - apply(Uint8Array) can fail on iOS 5.1 Safari
//
var STR_APPLY_OK = true;
var STR_APPLY_UIA_OK = true;

try { String.fromCharCode.apply(null, [ 0 ]); } catch (__) { STR_APPLY_OK = false; }
try { String.fromCharCode.apply(null, new Uint8Array(1)); } catch (__) { STR_APPLY_UIA_OK = false; }


// Table with utf8 lengths (calculated by first byte of sequence)
// Note, that 5 & 6-byte values and some 4-byte values can not be represented in JS,
// because max possible codepoint is 0x10ffff
var _utf8len = new utils.Buf8(256);
for (var q = 0; q < 256; q++) {
  _utf8len[q] = (q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1);
}
_utf8len[254] = _utf8len[254] = 1; // Invalid sequence start


// convert string to array (typed, when possible)
exports.string2buf = function (str) {
  var buf, c, c2, m_pos, i, str_len = str.length, buf_len = 0;

  // count binary size
  for (m_pos = 0; m_pos < str_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    buf_len += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }

  // allocate buffer
  buf = new utils.Buf8(buf_len);

  // convert
  for (i = 0, m_pos = 0; i < buf_len; m_pos++) {
    c = str.charCodeAt(m_pos);
    if ((c & 0xfc00) === 0xd800 && (m_pos + 1 < str_len)) {
      c2 = str.charCodeAt(m_pos + 1);
      if ((c2 & 0xfc00) === 0xdc00) {
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        m_pos++;
      }
    }
    if (c < 0x80) {
      /* one byte */
      buf[i++] = c;
    } else if (c < 0x800) {
      /* two bytes */
      buf[i++] = 0xC0 | (c >>> 6);
      buf[i++] = 0x80 | (c & 0x3f);
    } else if (c < 0x10000) {
      /* three bytes */
      buf[i++] = 0xE0 | (c >>> 12);
      buf[i++] = 0x80 | (c >>> 6 & 0x3f);
      buf[i++] = 0x80 | (c & 0x3f);
    } else {
      /* four bytes */
      buf[i++] = 0xf0 | (c >>> 18);
      buf[i++] = 0x80 | (c >>> 12 & 0x3f);
      buf[i++] = 0x80 | (c >>> 6 & 0x3f);
      buf[i++] = 0x80 | (c & 0x3f);
    }
  }

  return buf;
};

// Helper (used in 2 places)
function buf2binstring(buf, len) {
  // On Chrome, the arguments in a function call that are allowed is `65534`.
  // If the length of the buffer is smaller than that, we can use this optimization,
  // otherwise we will take a slower path.
  if (len < 65534) {
    if ((buf.subarray && STR_APPLY_UIA_OK) || (!buf.subarray && STR_APPLY_OK)) {
      return String.fromCharCode.apply(null, utils.shrinkBuf(buf, len));
    }
  }

  var result = '';
  for (var i = 0; i < len; i++) {
    result += String.fromCharCode(buf[i]);
  }
  return result;
}


// Convert byte array to binary string
exports.buf2binstring = function (buf) {
  return buf2binstring(buf, buf.length);
};


// Convert binary string (typed, when possible)
exports.binstring2buf = function (str) {
  var buf = new utils.Buf8(str.length);
  for (var i = 0, len = buf.length; i < len; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf;
};


// convert array to string
exports.buf2string = function (buf, max) {
  var i, out, c, c_len;
  var len = max || buf.length;

  // Reserve max possible length (2 words per char)
  // NB: by unknown reasons, Array is significantly faster for
  //     String.fromCharCode.apply than Uint16Array.
  var utf16buf = new Array(len * 2);

  for (out = 0, i = 0; i < len;) {
    c = buf[i++];
    // quick process ascii
    if (c < 0x80) { utf16buf[out++] = c; continue; }

    c_len = _utf8len[c];
    // skip 5 & 6 byte codes
    if (c_len > 4) { utf16buf[out++] = 0xfffd; i += c_len - 1; continue; }

    // apply mask on first byte
    c &= c_len === 2 ? 0x1f : c_len === 3 ? 0x0f : 0x07;
    // join the rest
    while (c_len > 1 && i < len) {
      c = (c << 6) | (buf[i++] & 0x3f);
      c_len--;
    }

    // terminated by end of string?
    if (c_len > 1) { utf16buf[out++] = 0xfffd; continue; }

    if (c < 0x10000) {
      utf16buf[out++] = c;
    } else {
      c -= 0x10000;
      utf16buf[out++] = 0xd800 | ((c >> 10) & 0x3ff);
      utf16buf[out++] = 0xdc00 | (c & 0x3ff);
    }
  }

  return buf2binstring(utf16buf, out);
};


// Calculate max possible position in utf8 buffer,
// that will not break sequence. If that's not possible
// - (very small limits) return max size as is.
//
// buf[] - utf8 bytes array
// max   - length limit (mandatory);
exports.utf8border = function (buf, max) {
  var pos;

  max = max || buf.length;
  if (max > buf.length) { max = buf.length; }

  // go back from last position, until start of sequence found
  pos = max - 1;
  while (pos >= 0 && (buf[pos] & 0xC0) === 0x80) { pos--; }

  // Very small and broken sequence,
  // return max, because we should return something anyway.
  if (pos < 0) { return max; }

  // If we came to start of buffer - that means buffer is too small,
  // return max too.
  if (pos === 0) { return max; }

  return (pos + _utf8len[buf[pos]] > max) ? pos : max;
};

},{"./common":34}],36:[function(require,module,exports){
'use strict';

// Note: adler32 takes 12% for level 0 and 2% for level 6.
// It isn't worth it to make additional optimizations as in original.
// Small size is preferable.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function adler32(adler, buf, len, pos) {
  var s1 = (adler & 0xffff) |0,
      s2 = ((adler >>> 16) & 0xffff) |0,
      n = 0;

  while (len !== 0) {
    // Set limit ~ twice less than 5552, to keep
    // s2 in 31-bits, because we force signed ints.
    // in other case %= will fail.
    n = len > 2000 ? 2000 : len;
    len -= n;

    do {
      s1 = (s1 + buf[pos++]) |0;
      s2 = (s2 + s1) |0;
    } while (--n);

    s1 %= 65521;
    s2 %= 65521;
  }

  return (s1 | (s2 << 16)) |0;
}


module.exports = adler32;

},{}],37:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

module.exports = {

  /* Allowed flush values; see deflate() and inflate() below for details */
  Z_NO_FLUSH:         0,
  Z_PARTIAL_FLUSH:    1,
  Z_SYNC_FLUSH:       2,
  Z_FULL_FLUSH:       3,
  Z_FINISH:           4,
  Z_BLOCK:            5,
  Z_TREES:            6,

  /* Return codes for the compression/decompression functions. Negative values
  * are errors, positive values are used for special but normal events.
  */
  Z_OK:               0,
  Z_STREAM_END:       1,
  Z_NEED_DICT:        2,
  Z_ERRNO:           -1,
  Z_STREAM_ERROR:    -2,
  Z_DATA_ERROR:      -3,
  //Z_MEM_ERROR:     -4,
  Z_BUF_ERROR:       -5,
  //Z_VERSION_ERROR: -6,

  /* compression levels */
  Z_NO_COMPRESSION:         0,
  Z_BEST_SPEED:             1,
  Z_BEST_COMPRESSION:       9,
  Z_DEFAULT_COMPRESSION:   -1,


  Z_FILTERED:               1,
  Z_HUFFMAN_ONLY:           2,
  Z_RLE:                    3,
  Z_FIXED:                  4,
  Z_DEFAULT_STRATEGY:       0,

  /* Possible values of the data_type field (though see inflate()) */
  Z_BINARY:                 0,
  Z_TEXT:                   1,
  //Z_ASCII:                1, // = Z_TEXT (deprecated)
  Z_UNKNOWN:                2,

  /* The deflate compression method */
  Z_DEFLATED:               8
  //Z_NULL:                 null // Use -1 or null inline, depending on var type
};

},{}],38:[function(require,module,exports){
'use strict';

// Note: we can't get significant speed boost here.
// So write code to minimize size - no pregenerated tables
// and array tools dependencies.

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// Use ordinary array, since untyped makes no boost here
function makeTable() {
  var c, table = [];

  for (var n = 0; n < 256; n++) {
    c = n;
    for (var k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    table[n] = c;
  }

  return table;
}

// Create table on load. Just 255 signed longs. Not a problem.
var crcTable = makeTable();


function crc32(crc, buf, len, pos) {
  var t = crcTable,
      end = pos + len;

  crc ^= -1;

  for (var i = pos; i < end; i++) {
    crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
  }

  return (crc ^ (-1)); // >>> 0;
}


module.exports = crc32;

},{}],39:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils   = require('../utils/common');
var trees   = require('./trees');
var adler32 = require('./adler32');
var crc32   = require('./crc32');
var msg     = require('./messages');

/* Public constants ==========================================================*/
/* ===========================================================================*/


/* Allowed flush values; see deflate() and inflate() below for details */
var Z_NO_FLUSH      = 0;
var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
var Z_FULL_FLUSH    = 3;
var Z_FINISH        = 4;
var Z_BLOCK         = 5;
//var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK            = 0;
var Z_STREAM_END    = 1;
//var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR  = -2;
var Z_DATA_ERROR    = -3;
//var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR     = -5;
//var Z_VERSION_ERROR = -6;


/* compression levels */
//var Z_NO_COMPRESSION      = 0;
//var Z_BEST_SPEED          = 1;
//var Z_BEST_COMPRESSION    = 9;
var Z_DEFAULT_COMPRESSION = -1;


var Z_FILTERED            = 1;
var Z_HUFFMAN_ONLY        = 2;
var Z_RLE                 = 3;
var Z_FIXED               = 4;
var Z_DEFAULT_STRATEGY    = 0;

/* Possible values of the data_type field (though see inflate()) */
//var Z_BINARY              = 0;
//var Z_TEXT                = 1;
//var Z_ASCII               = 1; // = Z_TEXT
var Z_UNKNOWN             = 2;


/* The deflate compression method */
var Z_DEFLATED  = 8;

/*============================================================================*/


var MAX_MEM_LEVEL = 9;
/* Maximum value for memLevel in deflateInit2 */
var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_MEM_LEVEL = 8;


var LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */
var LITERALS      = 256;
/* number of literal bytes 0..255 */
var L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */
var D_CODES       = 30;
/* number of distance codes */
var BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */
var HEAP_SIZE     = 2 * L_CODES + 1;
/* maximum heap size */
var MAX_BITS  = 15;
/* All codes must not exceed MAX_BITS bits */

var MIN_MATCH = 3;
var MAX_MATCH = 258;
var MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);

var PRESET_DICT = 0x20;

var INIT_STATE = 42;
var EXTRA_STATE = 69;
var NAME_STATE = 73;
var COMMENT_STATE = 91;
var HCRC_STATE = 103;
var BUSY_STATE = 113;
var FINISH_STATE = 666;

var BS_NEED_MORE      = 1; /* block not completed, need more input or more output */
var BS_BLOCK_DONE     = 2; /* block flush performed */
var BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
var BS_FINISH_DONE    = 4; /* finish done, accept no more input or output */

var OS_CODE = 0x03; // Unix :) . Don't detect, use this default.

function err(strm, errorCode) {
  strm.msg = msg[errorCode];
  return errorCode;
}

function rank(f) {
  return ((f) << 1) - ((f) > 4 ? 9 : 0);
}

function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }


/* =========================================================================
 * Flush as much pending output as possible. All deflate() output goes
 * through this function so some applications may wish to modify it
 * to avoid allocating a large strm->output buffer and copying into it.
 * (See also read_buf()).
 */
function flush_pending(strm) {
  var s = strm.state;

  //_tr_flush_bits(s);
  var len = s.pending;
  if (len > strm.avail_out) {
    len = strm.avail_out;
  }
  if (len === 0) { return; }

  utils.arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
  strm.next_out += len;
  s.pending_out += len;
  strm.total_out += len;
  strm.avail_out -= len;
  s.pending -= len;
  if (s.pending === 0) {
    s.pending_out = 0;
  }
}


function flush_block_only(s, last) {
  trees._tr_flush_block(s, (s.block_start >= 0 ? s.block_start : -1), s.strstart - s.block_start, last);
  s.block_start = s.strstart;
  flush_pending(s.strm);
}


function put_byte(s, b) {
  s.pending_buf[s.pending++] = b;
}


/* =========================================================================
 * Put a short in the pending buffer. The 16-bit value is put in MSB order.
 * IN assertion: the stream state is correct and there is enough room in
 * pending_buf.
 */
function putShortMSB(s, b) {
//  put_byte(s, (Byte)(b >> 8));
//  put_byte(s, (Byte)(b & 0xff));
  s.pending_buf[s.pending++] = (b >>> 8) & 0xff;
  s.pending_buf[s.pending++] = b & 0xff;
}


/* ===========================================================================
 * Read a new buffer from the current input stream, update the adler32
 * and total number of bytes read.  All deflate() input goes through
 * this function so some applications may wish to modify it to avoid
 * allocating a large strm->input buffer and copying from it.
 * (See also flush_pending()).
 */
function read_buf(strm, buf, start, size) {
  var len = strm.avail_in;

  if (len > size) { len = size; }
  if (len === 0) { return 0; }

  strm.avail_in -= len;

  // zmemcpy(buf, strm->next_in, len);
  utils.arraySet(buf, strm.input, strm.next_in, len, start);
  if (strm.state.wrap === 1) {
    strm.adler = adler32(strm.adler, buf, len, start);
  }

  else if (strm.state.wrap === 2) {
    strm.adler = crc32(strm.adler, buf, len, start);
  }

  strm.next_in += len;
  strm.total_in += len;

  return len;
}


/* ===========================================================================
 * Set match_start to the longest match starting at the given string and
 * return its length. Matches shorter or equal to prev_length are discarded,
 * in which case the result is equal to prev_length and match_start is
 * garbage.
 * IN assertions: cur_match is the head of the hash chain for the current
 *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
 * OUT assertion: the match length is not greater than s->lookahead.
 */
function longest_match(s, cur_match) {
  var chain_length = s.max_chain_length;      /* max hash chain length */
  var scan = s.strstart; /* current string */
  var match;                       /* matched string */
  var len;                           /* length of current match */
  var best_len = s.prev_length;              /* best match length so far */
  var nice_match = s.nice_match;             /* stop if match long enough */
  var limit = (s.strstart > (s.w_size - MIN_LOOKAHEAD)) ?
      s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0/*NIL*/;

  var _win = s.window; // shortcut

  var wmask = s.w_mask;
  var prev  = s.prev;

  /* Stop when cur_match becomes <= limit. To simplify the code,
   * we prevent matches with the string of window index 0.
   */

  var strend = s.strstart + MAX_MATCH;
  var scan_end1  = _win[scan + best_len - 1];
  var scan_end   = _win[scan + best_len];

  /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
   * It is easy to get rid of this optimization if necessary.
   */
  // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

  /* Do not waste too much time if we already have a good match: */
  if (s.prev_length >= s.good_match) {
    chain_length >>= 2;
  }
  /* Do not look for matches beyond the end of the input. This is necessary
   * to make deflate deterministic.
   */
  if (nice_match > s.lookahead) { nice_match = s.lookahead; }

  // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

  do {
    // Assert(cur_match < s->strstart, "no future");
    match = cur_match;

    /* Skip to next match if the match length cannot increase
     * or if the match length is less than 2.  Note that the checks below
     * for insufficient lookahead only occur occasionally for performance
     * reasons.  Therefore uninitialized memory will be accessed, and
     * conditional jumps will be made that depend on those values.
     * However the length of the match is limited to the lookahead, so
     * the output of deflate is not affected by the uninitialized values.
     */

    if (_win[match + best_len]     !== scan_end  ||
        _win[match + best_len - 1] !== scan_end1 ||
        _win[match]                !== _win[scan] ||
        _win[++match]              !== _win[scan + 1]) {
      continue;
    }

    /* The check at best_len-1 can be removed because it will be made
     * again later. (This heuristic is not always a win.)
     * It is not necessary to compare scan[2] and match[2] since they
     * are always equal when the other bytes match, given that
     * the hash keys are equal and that HASH_BITS >= 8.
     */
    scan += 2;
    match++;
    // Assert(*scan == *match, "match[2]?");

    /* We check for insufficient lookahead only every 8th comparison;
     * the 256th check will be made at strstart+258.
     */
    do {
      /*jshint noempty:false*/
    } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
             scan < strend);

    // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

    len = MAX_MATCH - (strend - scan);
    scan = strend - MAX_MATCH;

    if (len > best_len) {
      s.match_start = cur_match;
      best_len = len;
      if (len >= nice_match) {
        break;
      }
      scan_end1  = _win[scan + best_len - 1];
      scan_end   = _win[scan + best_len];
    }
  } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);

  if (best_len <= s.lookahead) {
    return best_len;
  }
  return s.lookahead;
}


/* ===========================================================================
 * Fill the window when the lookahead becomes insufficient.
 * Updates strstart and lookahead.
 *
 * IN assertion: lookahead < MIN_LOOKAHEAD
 * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
 *    At least one byte has been read, or avail_in == 0; reads are
 *    performed for at least two bytes (required for the zip translate_eol
 *    option -- not supported here).
 */
function fill_window(s) {
  var _w_size = s.w_size;
  var p, n, m, more, str;

  //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

  do {
    more = s.window_size - s.lookahead - s.strstart;

    // JS ints have 32 bit, block below not needed
    /* Deal with !@#$% 64K limit: */
    //if (sizeof(int) <= 2) {
    //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
    //        more = wsize;
    //
    //  } else if (more == (unsigned)(-1)) {
    //        /* Very unlikely, but possible on 16 bit machine if
    //         * strstart == 0 && lookahead == 1 (input done a byte at time)
    //         */
    //        more--;
    //    }
    //}


    /* If the window is almost full and there is insufficient lookahead,
     * move the upper half to the lower one to make room in the upper half.
     */
    if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {

      utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
      s.match_start -= _w_size;
      s.strstart -= _w_size;
      /* we now have strstart >= MAX_DIST */
      s.block_start -= _w_size;

      /* Slide the hash table (could be avoided with 32 bit values
       at the expense of memory usage). We slide even when level == 0
       to keep the hash table consistent if we switch back to level > 0
       later. (Using level 0 permanently is not an optimal usage of
       zlib, so we don't care about this pathological case.)
       */

      n = s.hash_size;
      p = n;
      do {
        m = s.head[--p];
        s.head[p] = (m >= _w_size ? m - _w_size : 0);
      } while (--n);

      n = _w_size;
      p = n;
      do {
        m = s.prev[--p];
        s.prev[p] = (m >= _w_size ? m - _w_size : 0);
        /* If n is not on any hash chain, prev[n] is garbage but
         * its value will never be used.
         */
      } while (--n);

      more += _w_size;
    }
    if (s.strm.avail_in === 0) {
      break;
    }

    /* If there was no sliding:
     *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
     *    more == window_size - lookahead - strstart
     * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
     * => more >= window_size - 2*WSIZE + 2
     * In the BIG_MEM or MMAP case (not yet supported),
     *   window_size == input_size + MIN_LOOKAHEAD  &&
     *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
     * Otherwise, window_size == 2*WSIZE so more >= 2.
     * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
     */
    //Assert(more >= 2, "more < 2");
    n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
    s.lookahead += n;

    /* Initialize the hash value now that we have some input: */
    if (s.lookahead + s.insert >= MIN_MATCH) {
      str = s.strstart - s.insert;
      s.ins_h = s.window[str];

      /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + 1]) & s.hash_mask;
//#if MIN_MATCH != 3
//        Call update_hash() MIN_MATCH-3 more times
//#endif
      while (s.insert) {
        /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;

        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
        s.insert--;
        if (s.lookahead + s.insert < MIN_MATCH) {
          break;
        }
      }
    }
    /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
     * but this is not important since only literal bytes will be emitted.
     */

  } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);

  /* If the WIN_INIT bytes after the end of the current data have never been
   * written, then zero those bytes in order to avoid memory check reports of
   * the use of uninitialized (or uninitialised as Julian writes) bytes by
   * the longest match routines.  Update the high water mark for the next
   * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
   * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
   */
//  if (s.high_water < s.window_size) {
//    var curr = s.strstart + s.lookahead;
//    var init = 0;
//
//    if (s.high_water < curr) {
//      /* Previous high water mark below current data -- zero WIN_INIT
//       * bytes or up to end of window, whichever is less.
//       */
//      init = s.window_size - curr;
//      if (init > WIN_INIT)
//        init = WIN_INIT;
//      zmemzero(s->window + curr, (unsigned)init);
//      s->high_water = curr + init;
//    }
//    else if (s->high_water < (ulg)curr + WIN_INIT) {
//      /* High water mark at or above current data, but below current data
//       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
//       * to end of window, whichever is less.
//       */
//      init = (ulg)curr + WIN_INIT - s->high_water;
//      if (init > s->window_size - s->high_water)
//        init = s->window_size - s->high_water;
//      zmemzero(s->window + s->high_water, (unsigned)init);
//      s->high_water += init;
//    }
//  }
//
//  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
//    "not enough room for search");
}

/* ===========================================================================
 * Copy without compression as much as possible from the input stream, return
 * the current block state.
 * This function does not insert new strings in the dictionary since
 * uncompressible data is probably not useful. This function is used
 * only for the level=0 compression option.
 * NOTE: this function should be optimized to avoid extra copying from
 * window to pending_buf.
 */
function deflate_stored(s, flush) {
  /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
   * to pending_buf_size, and each stored block has a 5 byte header:
   */
  var max_block_size = 0xffff;

  if (max_block_size > s.pending_buf_size - 5) {
    max_block_size = s.pending_buf_size - 5;
  }

  /* Copy as much as possible from input to output: */
  for (;;) {
    /* Fill the window as much as possible: */
    if (s.lookahead <= 1) {

      //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
      //  s->block_start >= (long)s->w_size, "slide too late");
//      if (!(s.strstart < s.w_size + (s.w_size - MIN_LOOKAHEAD) ||
//        s.block_start >= s.w_size)) {
//        throw  new Error("slide too late");
//      }

      fill_window(s);
      if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }

      if (s.lookahead === 0) {
        break;
      }
      /* flush the current block */
    }
    //Assert(s->block_start >= 0L, "block gone");
//    if (s.block_start < 0) throw new Error("block gone");

    s.strstart += s.lookahead;
    s.lookahead = 0;

    /* Emit a stored block if pending_buf will be full: */
    var max_start = s.block_start + max_block_size;

    if (s.strstart === 0 || s.strstart >= max_start) {
      /* strstart == 0 is possible when wraparound on 16-bit machine */
      s.lookahead = s.strstart - max_start;
      s.strstart = max_start;
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/


    }
    /* Flush if we may have to slide, otherwise block_start may become
     * negative and the data will be gone:
     */
    if (s.strstart - s.block_start >= (s.w_size - MIN_LOOKAHEAD)) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }

  s.insert = 0;

  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }

  if (s.strstart > s.block_start) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_NEED_MORE;
}

/* ===========================================================================
 * Compress as much as possible from the input stream, return the current
 * block state.
 * This function does not perform lazy evaluation of matches and inserts
 * new strings in the dictionary only for unmatched strings or for short
 * matches. It is used only for the fast compression options.
 */
function deflate_fast(s, flush) {
  var hash_head;        /* head of the hash chain */
  var bflush;           /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) {
        break; /* flush the current block */
      }
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     * At this point we have always match_length < MIN_MATCH
     */
    if (hash_head !== 0/*NIL*/ && ((s.strstart - hash_head) <= (s.w_size - MIN_LOOKAHEAD))) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */
    }
    if (s.match_length >= MIN_MATCH) {
      // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

      /*** _tr_tally_dist(s, s.strstart - s.match_start,
                     s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;

      /* Insert new strings in the hash table only if the match length
       * is not too large. This saves time but degrades compression.
       */
      if (s.match_length <= s.max_lazy_match/*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
        s.match_length--; /* string at strstart already in table */
        do {
          s.strstart++;
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
          /* strstart never exceeds WSIZE-MAX_MATCH, so there are
           * always MIN_MATCH bytes ahead.
           */
        } while (--s.match_length !== 0);
        s.strstart++;
      } else
      {
        s.strstart += s.match_length;
        s.match_length = 0;
        s.ins_h = s.window[s.strstart];
        /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + 1]) & s.hash_mask;

//#if MIN_MATCH != 3
//                Call UPDATE_HASH() MIN_MATCH-3 more times
//#endif
        /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
         * matter since it will be recomputed at next deflate call.
         */
      }
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s.window[s.strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = ((s.strstart < (MIN_MATCH - 1)) ? s.strstart : MIN_MATCH - 1);
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * Same as above, but achieves better compression. We use a lazy
 * evaluation for matches: a match is finally adopted only if there is
 * no better match at the next window position.
 */
function deflate_slow(s, flush) {
  var hash_head;          /* head of hash chain */
  var bflush;              /* set if current block must be flushed */

  var max_insert;

  /* Process the input block. */
  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the next match, plus MIN_MATCH bytes to insert the
     * string following the next match.
     */
    if (s.lookahead < MIN_LOOKAHEAD) {
      fill_window(s);
      if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* Insert the string window[strstart .. strstart+2] in the
     * dictionary, and set hash_head to the head of the hash chain:
     */
    hash_head = 0/*NIL*/;
    if (s.lookahead >= MIN_MATCH) {
      /*** INSERT_STRING(s, s.strstart, hash_head); ***/
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
      hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
      s.head[s.ins_h] = s.strstart;
      /***/
    }

    /* Find the longest match, discarding those <= prev_length.
     */
    s.prev_length = s.match_length;
    s.prev_match = s.match_start;
    s.match_length = MIN_MATCH - 1;

    if (hash_head !== 0/*NIL*/ && s.prev_length < s.max_lazy_match &&
        s.strstart - hash_head <= (s.w_size - MIN_LOOKAHEAD)/*MAX_DIST(s)*/) {
      /* To simplify the code, we prevent matches with the string
       * of window index 0 (in particular we have to avoid a match
       * of the string with itself at the start of the input file).
       */
      s.match_length = longest_match(s, hash_head);
      /* longest_match() sets match_start */

      if (s.match_length <= 5 &&
         (s.strategy === Z_FILTERED || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096/*TOO_FAR*/))) {

        /* If prev_match is also MIN_MATCH, match_start is garbage
         * but we will ignore the current match anyway.
         */
        s.match_length = MIN_MATCH - 1;
      }
    }
    /* If there was a match at the previous step and the current
     * match is not better, output the previous match:
     */
    if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
      max_insert = s.strstart + s.lookahead - MIN_MATCH;
      /* Do not insert strings in hash table beyond this. */

      //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

      /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                     s.prev_length - MIN_MATCH, bflush);***/
      bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
      /* Insert in hash table all strings up to the end of the match.
       * strstart-1 and strstart are already inserted. If there is not
       * enough lookahead, the last two strings are not inserted in
       * the hash table.
       */
      s.lookahead -= s.prev_length - 1;
      s.prev_length -= 2;
      do {
        if (++s.strstart <= max_insert) {
          /*** INSERT_STRING(s, s.strstart, hash_head); ***/
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
          hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = s.strstart;
          /***/
        }
      } while (--s.prev_length !== 0);
      s.match_available = 0;
      s.match_length = MIN_MATCH - 1;
      s.strstart++;

      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }

    } else if (s.match_available) {
      /* If there was no match at the previous position, output a
       * single literal. If there was a match but the current match
       * is longer, truncate the previous match to a single literal.
       */
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);

      if (bflush) {
        /*** FLUSH_BLOCK_ONLY(s, 0) ***/
        flush_block_only(s, false);
        /***/
      }
      s.strstart++;
      s.lookahead--;
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    } else {
      /* There is no previous match to compare with, wait for
       * the next step to decide.
       */
      s.match_available = 1;
      s.strstart++;
      s.lookahead--;
    }
  }
  //Assert (flush != Z_NO_FLUSH, "no flush?");
  if (s.match_available) {
    //Tracevv((stderr,"%c", s->window[s->strstart-1]));
    /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);

    s.match_available = 0;
  }
  s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }

  return BS_BLOCK_DONE;
}


/* ===========================================================================
 * For Z_RLE, simply look for runs of bytes, generate matches only of distance
 * one.  Do not maintain a hash table.  (It will be regenerated if this run of
 * deflate switches away from Z_RLE.)
 */
function deflate_rle(s, flush) {
  var bflush;            /* set if current block must be flushed */
  var prev;              /* byte at distance one to match */
  var scan, strend;      /* scan goes up to strend for length of run */

  var _win = s.window;

  for (;;) {
    /* Make sure that we always have enough lookahead, except
     * at the end of the input file. We need MAX_MATCH bytes
     * for the longest run, plus one for the unrolled loop.
     */
    if (s.lookahead <= MAX_MATCH) {
      fill_window(s);
      if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
        return BS_NEED_MORE;
      }
      if (s.lookahead === 0) { break; } /* flush the current block */
    }

    /* See how many times the previous byte repeats */
    s.match_length = 0;
    if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
      scan = s.strstart - 1;
      prev = _win[scan];
      if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
        strend = s.strstart + MAX_MATCH;
        do {
          /*jshint noempty:false*/
        } while (prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 prev === _win[++scan] && prev === _win[++scan] &&
                 scan < strend);
        s.match_length = MAX_MATCH - (strend - scan);
        if (s.match_length > s.lookahead) {
          s.match_length = s.lookahead;
        }
      }
      //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
    }

    /* Emit match if have run of MIN_MATCH or longer, else emit literal */
    if (s.match_length >= MIN_MATCH) {
      //check_match(s, s.strstart, s.strstart - 1, s.match_length);

      /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
      bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);

      s.lookahead -= s.match_length;
      s.strstart += s.match_length;
      s.match_length = 0;
    } else {
      /* No match, output a literal byte */
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);

      s.lookahead--;
      s.strstart++;
    }
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* ===========================================================================
 * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
 * (It will be regenerated if this run of deflate switches away from Huffman.)
 */
function deflate_huff(s, flush) {
  var bflush;             /* set if current block must be flushed */

  for (;;) {
    /* Make sure that we have a literal to write. */
    if (s.lookahead === 0) {
      fill_window(s);
      if (s.lookahead === 0) {
        if (flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        break;      /* flush the current block */
      }
    }

    /* Output a literal byte */
    s.match_length = 0;
    //Tracevv((stderr,"%c", s->window[s->strstart]));
    /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
    bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
    s.lookahead--;
    s.strstart++;
    if (bflush) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
  }
  s.insert = 0;
  if (flush === Z_FINISH) {
    /*** FLUSH_BLOCK(s, 1); ***/
    flush_block_only(s, true);
    if (s.strm.avail_out === 0) {
      return BS_FINISH_STARTED;
    }
    /***/
    return BS_FINISH_DONE;
  }
  if (s.last_lit) {
    /*** FLUSH_BLOCK(s, 0); ***/
    flush_block_only(s, false);
    if (s.strm.avail_out === 0) {
      return BS_NEED_MORE;
    }
    /***/
  }
  return BS_BLOCK_DONE;
}

/* Values for max_lazy_match, good_match and max_chain_length, depending on
 * the desired pack level (0..9). The values given below have been tuned to
 * exclude worst case performance for pathological files. Better values may be
 * found for specific files.
 */
function Config(good_length, max_lazy, nice_length, max_chain, func) {
  this.good_length = good_length;
  this.max_lazy = max_lazy;
  this.nice_length = nice_length;
  this.max_chain = max_chain;
  this.func = func;
}

var configuration_table;

configuration_table = [
  /*      good lazy nice chain */
  new Config(0, 0, 0, 0, deflate_stored),          /* 0 store only */
  new Config(4, 4, 8, 4, deflate_fast),            /* 1 max speed, no lazy matches */
  new Config(4, 5, 16, 8, deflate_fast),           /* 2 */
  new Config(4, 6, 32, 32, deflate_fast),          /* 3 */

  new Config(4, 4, 16, 16, deflate_slow),          /* 4 lazy matches */
  new Config(8, 16, 32, 32, deflate_slow),         /* 5 */
  new Config(8, 16, 128, 128, deflate_slow),       /* 6 */
  new Config(8, 32, 128, 256, deflate_slow),       /* 7 */
  new Config(32, 128, 258, 1024, deflate_slow),    /* 8 */
  new Config(32, 258, 258, 4096, deflate_slow)     /* 9 max compression */
];


/* ===========================================================================
 * Initialize the "longest match" routines for a new zlib stream
 */
function lm_init(s) {
  s.window_size = 2 * s.w_size;

  /*** CLEAR_HASH(s); ***/
  zero(s.head); // Fill with NIL (= 0);

  /* Set the default configuration parameters:
   */
  s.max_lazy_match = configuration_table[s.level].max_lazy;
  s.good_match = configuration_table[s.level].good_length;
  s.nice_match = configuration_table[s.level].nice_length;
  s.max_chain_length = configuration_table[s.level].max_chain;

  s.strstart = 0;
  s.block_start = 0;
  s.lookahead = 0;
  s.insert = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  s.ins_h = 0;
}


function DeflateState() {
  this.strm = null;            /* pointer back to this zlib stream */
  this.status = 0;            /* as the name implies */
  this.pending_buf = null;      /* output still pending */
  this.pending_buf_size = 0;  /* size of pending_buf */
  this.pending_out = 0;       /* next pending byte to output to the stream */
  this.pending = 0;           /* nb of bytes in the pending buffer */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.gzhead = null;         /* gzip header information to write */
  this.gzindex = 0;           /* where in extra, name, or comment */
  this.method = Z_DEFLATED; /* can only be DEFLATED */
  this.last_flush = -1;   /* value of flush param for previous deflate call */

  this.w_size = 0;  /* LZ77 window size (32K by default) */
  this.w_bits = 0;  /* log2(w_size)  (8..16) */
  this.w_mask = 0;  /* w_size - 1 */

  this.window = null;
  /* Sliding window. Input bytes are read into the second half of the window,
   * and move to the first half later to keep a dictionary of at least wSize
   * bytes. With this organization, matches are limited to a distance of
   * wSize-MAX_MATCH bytes, but this ensures that IO is always
   * performed with a length multiple of the block size.
   */

  this.window_size = 0;
  /* Actual size of window: 2*wSize, except when the user input buffer
   * is directly used as sliding window.
   */

  this.prev = null;
  /* Link to older string with same hash index. To limit the size of this
   * array to 64K, this link is maintained only for the last 32K strings.
   * An index in this array is thus a window index modulo 32K.
   */

  this.head = null;   /* Heads of the hash chains or NIL. */

  this.ins_h = 0;       /* hash index of string to be inserted */
  this.hash_size = 0;   /* number of elements in hash table */
  this.hash_bits = 0;   /* log2(hash_size) */
  this.hash_mask = 0;   /* hash_size-1 */

  this.hash_shift = 0;
  /* Number of bits by which ins_h must be shifted at each input
   * step. It must be such that after MIN_MATCH steps, the oldest
   * byte no longer takes part in the hash key, that is:
   *   hash_shift * MIN_MATCH >= hash_bits
   */

  this.block_start = 0;
  /* Window position at the beginning of the current output block. Gets
   * negative when the window is moved backwards.
   */

  this.match_length = 0;      /* length of best match */
  this.prev_match = 0;        /* previous match */
  this.match_available = 0;   /* set if previous match exists */
  this.strstart = 0;          /* start of string to insert */
  this.match_start = 0;       /* start of matching string */
  this.lookahead = 0;         /* number of valid bytes ahead in window */

  this.prev_length = 0;
  /* Length of the best match at previous step. Matches not greater than this
   * are discarded. This is used in the lazy match evaluation.
   */

  this.max_chain_length = 0;
  /* To speed up deflation, hash chains are never searched beyond this
   * length.  A higher limit improves compression ratio but degrades the
   * speed.
   */

  this.max_lazy_match = 0;
  /* Attempt to find a better match only when the current match is strictly
   * smaller than this value. This mechanism is used only for compression
   * levels >= 4.
   */
  // That's alias to max_lazy_match, don't use directly
  //this.max_insert_length = 0;
  /* Insert new strings in the hash table only if the match length is not
   * greater than this length. This saves time but degrades compression.
   * max_insert_length is used only for compression levels <= 3.
   */

  this.level = 0;     /* compression level (1..9) */
  this.strategy = 0;  /* favor or force Huffman coding*/

  this.good_match = 0;
  /* Use a faster search when the previous match is longer than this */

  this.nice_match = 0; /* Stop searching when current match exceeds this */

              /* used by trees.c: */

  /* Didn't use ct_data typedef below to suppress compiler warning */

  // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
  // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
  // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

  // Use flat array of DOUBLE size, with interleaved fata,
  // because JS does not support effective
  this.dyn_ltree  = new utils.Buf16(HEAP_SIZE * 2);
  this.dyn_dtree  = new utils.Buf16((2 * D_CODES + 1) * 2);
  this.bl_tree    = new utils.Buf16((2 * BL_CODES + 1) * 2);
  zero(this.dyn_ltree);
  zero(this.dyn_dtree);
  zero(this.bl_tree);

  this.l_desc   = null;         /* desc. for literal tree */
  this.d_desc   = null;         /* desc. for distance tree */
  this.bl_desc  = null;         /* desc. for bit length tree */

  //ush bl_count[MAX_BITS+1];
  this.bl_count = new utils.Buf16(MAX_BITS + 1);
  /* number of codes at each bit length for an optimal tree */

  //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
  this.heap = new utils.Buf16(2 * L_CODES + 1);  /* heap used to build the Huffman trees */
  zero(this.heap);

  this.heap_len = 0;               /* number of elements in the heap */
  this.heap_max = 0;               /* element of largest frequency */
  /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
   * The same heap array is used to build all trees.
   */

  this.depth = new utils.Buf16(2 * L_CODES + 1); //uch depth[2*L_CODES+1];
  zero(this.depth);
  /* Depth of each subtree used as tie breaker for trees of equal frequency
   */

  this.l_buf = 0;          /* buffer index for literals or lengths */

  this.lit_bufsize = 0;
  /* Size of match buffer for literals/lengths.  There are 4 reasons for
   * limiting lit_bufsize to 64K:
   *   - frequencies can be kept in 16 bit counters
   *   - if compression is not successful for the first block, all input
   *     data is still in the window so we can still emit a stored block even
   *     when input comes from standard input.  (This can also be done for
   *     all blocks if lit_bufsize is not greater than 32K.)
   *   - if compression is not successful for a file smaller than 64K, we can
   *     even emit a stored file instead of a stored block (saving 5 bytes).
   *     This is applicable only for zip (not gzip or zlib).
   *   - creating new Huffman trees less frequently may not provide fast
   *     adaptation to changes in the input data statistics. (Take for
   *     example a binary file with poorly compressible code followed by
   *     a highly compressible string table.) Smaller buffer sizes give
   *     fast adaptation but have of course the overhead of transmitting
   *     trees more frequently.
   *   - I can't count above 4
   */

  this.last_lit = 0;      /* running index in l_buf */

  this.d_buf = 0;
  /* Buffer index for distances. To simplify the code, d_buf and l_buf have
   * the same number of elements. To use different lengths, an extra flag
   * array would be necessary.
   */

  this.opt_len = 0;       /* bit length of current block with optimal trees */
  this.static_len = 0;    /* bit length of current block with static trees */
  this.matches = 0;       /* number of string matches in current block */
  this.insert = 0;        /* bytes at end of window left to insert */


  this.bi_buf = 0;
  /* Output buffer. bits are inserted starting at the bottom (least
   * significant bits).
   */
  this.bi_valid = 0;
  /* Number of valid bits in bi_buf.  All bits above the last valid bit
   * are always zero.
   */

  // Used for window memory init. We safely ignore it for JS. That makes
  // sense only for pointers and memory check tools.
  //this.high_water = 0;
  /* High water mark offset in window for initialized bytes -- bytes above
   * this are set to zero in order to avoid memory check warnings when
   * longest match routines access bytes past the input.  This is then
   * updated to the new high water mark.
   */
}


function deflateResetKeep(strm) {
  var s;

  if (!strm || !strm.state) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.total_in = strm.total_out = 0;
  strm.data_type = Z_UNKNOWN;

  s = strm.state;
  s.pending = 0;
  s.pending_out = 0;

  if (s.wrap < 0) {
    s.wrap = -s.wrap;
    /* was made negative by deflate(..., Z_FINISH); */
  }
  s.status = (s.wrap ? INIT_STATE : BUSY_STATE);
  strm.adler = (s.wrap === 2) ?
    0  // crc32(0, Z_NULL, 0)
  :
    1; // adler32(0, Z_NULL, 0)
  s.last_flush = Z_NO_FLUSH;
  trees._tr_init(s);
  return Z_OK;
}


function deflateReset(strm) {
  var ret = deflateResetKeep(strm);
  if (ret === Z_OK) {
    lm_init(strm.state);
  }
  return ret;
}


function deflateSetHeader(strm, head) {
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  if (strm.state.wrap !== 2) { return Z_STREAM_ERROR; }
  strm.state.gzhead = head;
  return Z_OK;
}


function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
  if (!strm) { // === Z_NULL
    return Z_STREAM_ERROR;
  }
  var wrap = 1;

  if (level === Z_DEFAULT_COMPRESSION) {
    level = 6;
  }

  if (windowBits < 0) { /* suppress zlib wrapper */
    wrap = 0;
    windowBits = -windowBits;
  }

  else if (windowBits > 15) {
    wrap = 2;           /* write gzip wrapper instead */
    windowBits -= 16;
  }


  if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED ||
    windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
    strategy < 0 || strategy > Z_FIXED) {
    return err(strm, Z_STREAM_ERROR);
  }


  if (windowBits === 8) {
    windowBits = 9;
  }
  /* until 256-byte window bug fixed */

  var s = new DeflateState();

  strm.state = s;
  s.strm = strm;

  s.wrap = wrap;
  s.gzhead = null;
  s.w_bits = windowBits;
  s.w_size = 1 << s.w_bits;
  s.w_mask = s.w_size - 1;

  s.hash_bits = memLevel + 7;
  s.hash_size = 1 << s.hash_bits;
  s.hash_mask = s.hash_size - 1;
  s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);

  s.window = new utils.Buf8(s.w_size * 2);
  s.head = new utils.Buf16(s.hash_size);
  s.prev = new utils.Buf16(s.w_size);

  // Don't need mem init magic for JS.
  //s.high_water = 0;  /* nothing written to s->window yet */

  s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */

  s.pending_buf_size = s.lit_bufsize * 4;

  //overlay = (ushf *) ZALLOC(strm, s->lit_bufsize, sizeof(ush)+2);
  //s->pending_buf = (uchf *) overlay;
  s.pending_buf = new utils.Buf8(s.pending_buf_size);

  // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
  //s->d_buf = overlay + s->lit_bufsize/sizeof(ush);
  s.d_buf = 1 * s.lit_bufsize;

  //s->l_buf = s->pending_buf + (1+sizeof(ush))*s->lit_bufsize;
  s.l_buf = (1 + 2) * s.lit_bufsize;

  s.level = level;
  s.strategy = strategy;
  s.method = method;

  return deflateReset(strm);
}

function deflateInit(strm, level) {
  return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
}


function deflate(strm, flush) {
  var old_flush, s;
  var beg, val; // for gzip header write only

  if (!strm || !strm.state ||
    flush > Z_BLOCK || flush < 0) {
    return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
  }

  s = strm.state;

  if (!strm.output ||
      (!strm.input && strm.avail_in !== 0) ||
      (s.status === FINISH_STATE && flush !== Z_FINISH)) {
    return err(strm, (strm.avail_out === 0) ? Z_BUF_ERROR : Z_STREAM_ERROR);
  }

  s.strm = strm; /* just in case */
  old_flush = s.last_flush;
  s.last_flush = flush;

  /* Write the header */
  if (s.status === INIT_STATE) {

    if (s.wrap === 2) { // GZIP header
      strm.adler = 0;  //crc32(0L, Z_NULL, 0);
      put_byte(s, 31);
      put_byte(s, 139);
      put_byte(s, 8);
      if (!s.gzhead) { // s->gzhead == Z_NULL
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, 0);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, OS_CODE);
        s.status = BUSY_STATE;
      }
      else {
        put_byte(s, (s.gzhead.text ? 1 : 0) +
                    (s.gzhead.hcrc ? 2 : 0) +
                    (!s.gzhead.extra ? 0 : 4) +
                    (!s.gzhead.name ? 0 : 8) +
                    (!s.gzhead.comment ? 0 : 16)
        );
        put_byte(s, s.gzhead.time & 0xff);
        put_byte(s, (s.gzhead.time >> 8) & 0xff);
        put_byte(s, (s.gzhead.time >> 16) & 0xff);
        put_byte(s, (s.gzhead.time >> 24) & 0xff);
        put_byte(s, s.level === 9 ? 2 :
                    (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ?
                     4 : 0));
        put_byte(s, s.gzhead.os & 0xff);
        if (s.gzhead.extra && s.gzhead.extra.length) {
          put_byte(s, s.gzhead.extra.length & 0xff);
          put_byte(s, (s.gzhead.extra.length >> 8) & 0xff);
        }
        if (s.gzhead.hcrc) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
        }
        s.gzindex = 0;
        s.status = EXTRA_STATE;
      }
    }
    else // DEFLATE header
    {
      var header = (Z_DEFLATED + ((s.w_bits - 8) << 4)) << 8;
      var level_flags = -1;

      if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
        level_flags = 0;
      } else if (s.level < 6) {
        level_flags = 1;
      } else if (s.level === 6) {
        level_flags = 2;
      } else {
        level_flags = 3;
      }
      header |= (level_flags << 6);
      if (s.strstart !== 0) { header |= PRESET_DICT; }
      header += 31 - (header % 31);

      s.status = BUSY_STATE;
      putShortMSB(s, header);

      /* Save the adler32 of the preset dictionary: */
      if (s.strstart !== 0) {
        putShortMSB(s, strm.adler >>> 16);
        putShortMSB(s, strm.adler & 0xffff);
      }
      strm.adler = 1; // adler32(0L, Z_NULL, 0);
    }
  }

//#ifdef GZIP
  if (s.status === EXTRA_STATE) {
    if (s.gzhead.extra/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */

      while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            break;
          }
        }
        put_byte(s, s.gzhead.extra[s.gzindex] & 0xff);
        s.gzindex++;
      }
      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (s.gzindex === s.gzhead.extra.length) {
        s.gzindex = 0;
        s.status = NAME_STATE;
      }
    }
    else {
      s.status = NAME_STATE;
    }
  }
  if (s.status === NAME_STATE) {
    if (s.gzhead.name/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.name.length) {
          val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.gzindex = 0;
        s.status = COMMENT_STATE;
      }
    }
    else {
      s.status = COMMENT_STATE;
    }
  }
  if (s.status === COMMENT_STATE) {
    if (s.gzhead.comment/* != Z_NULL*/) {
      beg = s.pending;  /* start of bytes to update crc */
      //int val;

      do {
        if (s.pending === s.pending_buf_size) {
          if (s.gzhead.hcrc && s.pending > beg) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
          }
          flush_pending(strm);
          beg = s.pending;
          if (s.pending === s.pending_buf_size) {
            val = 1;
            break;
          }
        }
        // JS specific: little magic to add zero terminator to end of string
        if (s.gzindex < s.gzhead.comment.length) {
          val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
        } else {
          val = 0;
        }
        put_byte(s, val);
      } while (val !== 0);

      if (s.gzhead.hcrc && s.pending > beg) {
        strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
      }
      if (val === 0) {
        s.status = HCRC_STATE;
      }
    }
    else {
      s.status = HCRC_STATE;
    }
  }
  if (s.status === HCRC_STATE) {
    if (s.gzhead.hcrc) {
      if (s.pending + 2 > s.pending_buf_size) {
        flush_pending(strm);
      }
      if (s.pending + 2 <= s.pending_buf_size) {
        put_byte(s, strm.adler & 0xff);
        put_byte(s, (strm.adler >> 8) & 0xff);
        strm.adler = 0; //crc32(0L, Z_NULL, 0);
        s.status = BUSY_STATE;
      }
    }
    else {
      s.status = BUSY_STATE;
    }
  }
//#endif

  /* Flush as much pending output as possible */
  if (s.pending !== 0) {
    flush_pending(strm);
    if (strm.avail_out === 0) {
      /* Since avail_out is 0, deflate will be called again with
       * more output space, but possibly with both pending and
       * avail_in equal to zero. There won't be anything to do,
       * but this is not an error situation so make sure we
       * return OK instead of BUF_ERROR at next call of deflate:
       */
      s.last_flush = -1;
      return Z_OK;
    }

    /* Make sure there is something to do and avoid duplicate consecutive
     * flushes. For repeated and useless calls with Z_FINISH, we keep
     * returning Z_STREAM_END instead of Z_BUF_ERROR.
     */
  } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) &&
    flush !== Z_FINISH) {
    return err(strm, Z_BUF_ERROR);
  }

  /* User must not provide more input after the first FINISH: */
  if (s.status === FINISH_STATE && strm.avail_in !== 0) {
    return err(strm, Z_BUF_ERROR);
  }

  /* Start a new block or continue the current one.
   */
  if (strm.avail_in !== 0 || s.lookahead !== 0 ||
    (flush !== Z_NO_FLUSH && s.status !== FINISH_STATE)) {
    var bstate = (s.strategy === Z_HUFFMAN_ONLY) ? deflate_huff(s, flush) :
      (s.strategy === Z_RLE ? deflate_rle(s, flush) :
        configuration_table[s.level].func(s, flush));

    if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
      s.status = FINISH_STATE;
    }
    if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        /* avoid BUF_ERROR next call, see above */
      }
      return Z_OK;
      /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
       * of deflate should use the same flush parameter to make sure
       * that the flush is complete. So we don't have to output an
       * empty block here, this will be done at next call. This also
       * ensures that for a very small output buffer, we emit at most
       * one empty block.
       */
    }
    if (bstate === BS_BLOCK_DONE) {
      if (flush === Z_PARTIAL_FLUSH) {
        trees._tr_align(s);
      }
      else if (flush !== Z_BLOCK) { /* FULL_FLUSH or SYNC_FLUSH */

        trees._tr_stored_block(s, 0, 0, false);
        /* For a full flush, this empty block will be recognized
         * as a special marker by inflate_sync().
         */
        if (flush === Z_FULL_FLUSH) {
          /*** CLEAR_HASH(s); ***/             /* forget history */
          zero(s.head); // Fill with NIL (= 0);

          if (s.lookahead === 0) {
            s.strstart = 0;
            s.block_start = 0;
            s.insert = 0;
          }
        }
      }
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
        return Z_OK;
      }
    }
  }
  //Assert(strm->avail_out > 0, "bug2");
  //if (strm.avail_out <= 0) { throw new Error("bug2");}

  if (flush !== Z_FINISH) { return Z_OK; }
  if (s.wrap <= 0) { return Z_STREAM_END; }

  /* Write the trailer */
  if (s.wrap === 2) {
    put_byte(s, strm.adler & 0xff);
    put_byte(s, (strm.adler >> 8) & 0xff);
    put_byte(s, (strm.adler >> 16) & 0xff);
    put_byte(s, (strm.adler >> 24) & 0xff);
    put_byte(s, strm.total_in & 0xff);
    put_byte(s, (strm.total_in >> 8) & 0xff);
    put_byte(s, (strm.total_in >> 16) & 0xff);
    put_byte(s, (strm.total_in >> 24) & 0xff);
  }
  else
  {
    putShortMSB(s, strm.adler >>> 16);
    putShortMSB(s, strm.adler & 0xffff);
  }

  flush_pending(strm);
  /* If avail_out is zero, the application will call deflate again
   * to flush the rest.
   */
  if (s.wrap > 0) { s.wrap = -s.wrap; }
  /* write the trailer only once! */
  return s.pending !== 0 ? Z_OK : Z_STREAM_END;
}

function deflateEnd(strm) {
  var status;

  if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
    return Z_STREAM_ERROR;
  }

  status = strm.state.status;
  if (status !== INIT_STATE &&
    status !== EXTRA_STATE &&
    status !== NAME_STATE &&
    status !== COMMENT_STATE &&
    status !== HCRC_STATE &&
    status !== BUSY_STATE &&
    status !== FINISH_STATE
  ) {
    return err(strm, Z_STREAM_ERROR);
  }

  strm.state = null;

  return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
}


/* =========================================================================
 * Initializes the compression dictionary from the given byte
 * sequence without producing any compressed output.
 */
function deflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;

  var s;
  var str, n;
  var wrap;
  var avail;
  var next;
  var input;
  var tmpDict;

  if (!strm/*== Z_NULL*/ || !strm.state/*== Z_NULL*/) {
    return Z_STREAM_ERROR;
  }

  s = strm.state;
  wrap = s.wrap;

  if (wrap === 2 || (wrap === 1 && s.status !== INIT_STATE) || s.lookahead) {
    return Z_STREAM_ERROR;
  }

  /* when using zlib wrappers, compute Adler-32 for provided dictionary */
  if (wrap === 1) {
    /* adler32(strm->adler, dictionary, dictLength); */
    strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
  }

  s.wrap = 0;   /* avoid computing Adler-32 in read_buf */

  /* if dictionary would fill window, just replace the history */
  if (dictLength >= s.w_size) {
    if (wrap === 0) {            /* already empty otherwise */
      /*** CLEAR_HASH(s); ***/
      zero(s.head); // Fill with NIL (= 0);
      s.strstart = 0;
      s.block_start = 0;
      s.insert = 0;
    }
    /* use the tail */
    // dictionary = dictionary.slice(dictLength - s.w_size);
    tmpDict = new utils.Buf8(s.w_size);
    utils.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
    dictionary = tmpDict;
    dictLength = s.w_size;
  }
  /* insert dictionary into window and hash */
  avail = strm.avail_in;
  next = strm.next_in;
  input = strm.input;
  strm.avail_in = dictLength;
  strm.next_in = 0;
  strm.input = dictionary;
  fill_window(s);
  while (s.lookahead >= MIN_MATCH) {
    str = s.strstart;
    n = s.lookahead - (MIN_MATCH - 1);
    do {
      /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
      s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;

      s.prev[str & s.w_mask] = s.head[s.ins_h];

      s.head[s.ins_h] = str;
      str++;
    } while (--n);
    s.strstart = str;
    s.lookahead = MIN_MATCH - 1;
    fill_window(s);
  }
  s.strstart += s.lookahead;
  s.block_start = s.strstart;
  s.insert = s.lookahead;
  s.lookahead = 0;
  s.match_length = s.prev_length = MIN_MATCH - 1;
  s.match_available = 0;
  strm.next_in = next;
  strm.input = input;
  strm.avail_in = avail;
  s.wrap = wrap;
  return Z_OK;
}


exports.deflateInit = deflateInit;
exports.deflateInit2 = deflateInit2;
exports.deflateReset = deflateReset;
exports.deflateResetKeep = deflateResetKeep;
exports.deflateSetHeader = deflateSetHeader;
exports.deflate = deflate;
exports.deflateEnd = deflateEnd;
exports.deflateSetDictionary = deflateSetDictionary;
exports.deflateInfo = 'pako deflate (from Nodeca project)';

/* Not implemented
exports.deflateBound = deflateBound;
exports.deflateCopy = deflateCopy;
exports.deflateParams = deflateParams;
exports.deflatePending = deflatePending;
exports.deflatePrime = deflatePrime;
exports.deflateTune = deflateTune;
*/

},{"../utils/common":34,"./adler32":36,"./crc32":38,"./messages":44,"./trees":45}],40:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function GZheader() {
  /* true if compressed data believed to be text */
  this.text       = 0;
  /* modification time */
  this.time       = 0;
  /* extra flags (not used when writing a gzip file) */
  this.xflags     = 0;
  /* operating system */
  this.os         = 0;
  /* pointer to extra field or Z_NULL if none */
  this.extra      = null;
  /* extra field length (valid if extra != Z_NULL) */
  this.extra_len  = 0; // Actually, we don't need it in JS,
                       // but leave for few code modifications

  //
  // Setup limits is not necessary because in js we should not preallocate memory
  // for inflate use constant limit in 65536 bytes
  //

  /* space at extra (only when reading header) */
  // this.extra_max  = 0;
  /* pointer to zero-terminated file name or Z_NULL */
  this.name       = '';
  /* space at name (only when reading header) */
  // this.name_max   = 0;
  /* pointer to zero-terminated comment or Z_NULL */
  this.comment    = '';
  /* space at comment (only when reading header) */
  // this.comm_max   = 0;
  /* true if there was or will be a header crc */
  this.hcrc       = 0;
  /* true when done reading gzip header (not used when writing a gzip file) */
  this.done       = false;
}

module.exports = GZheader;

},{}],41:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

// See state defs from inflate.js
var BAD = 30;       /* got a data error -- remain here until reset */
var TYPE = 12;      /* i: waiting for type bits, including last-flag bit */

/*
   Decode literal, length, and distance codes and write out the resulting
   literal and match bytes until either not enough input or output is
   available, an end-of-block is encountered, or a data error is encountered.
   When large enough input and output buffers are supplied to inflate(), for
   example, a 16K input buffer and a 64K output buffer, more than 95% of the
   inflate execution time is spent in this routine.

   Entry assumptions:

        state.mode === LEN
        strm.avail_in >= 6
        strm.avail_out >= 258
        start >= strm.avail_out
        state.bits < 8

   On return, state.mode is one of:

        LEN -- ran out of enough output space or enough available input
        TYPE -- reached end of block code, inflate() to interpret next block
        BAD -- error in block data

   Notes:

    - The maximum input bits used by a length/distance pair is 15 bits for the
      length code, 5 bits for the length extra, 15 bits for the distance code,
      and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
      Therefore if strm.avail_in >= 6, then there is enough input to avoid
      checking for available input while decoding.

    - The maximum bytes that a single length/distance pair can output is 258
      bytes, which is the maximum length that can be coded.  inflate_fast()
      requires strm.avail_out >= 258 for each loop to avoid checking for
      output space.
 */
module.exports = function inflate_fast(strm, start) {
  var state;
  var _in;                    /* local strm.input */
  var last;                   /* have enough input while in < last */
  var _out;                   /* local strm.output */
  var beg;                    /* inflate()'s initial strm.output */
  var end;                    /* while out < end, enough space available */
//#ifdef INFLATE_STRICT
  var dmax;                   /* maximum distance from zlib header */
//#endif
  var wsize;                  /* window size or zero if not using window */
  var whave;                  /* valid bytes in the window */
  var wnext;                  /* window write index */
  // Use `s_window` instead `window`, avoid conflict with instrumentation tools
  var s_window;               /* allocated sliding window, if wsize != 0 */
  var hold;                   /* local strm.hold */
  var bits;                   /* local strm.bits */
  var lcode;                  /* local strm.lencode */
  var dcode;                  /* local strm.distcode */
  var lmask;                  /* mask for first level of length codes */
  var dmask;                  /* mask for first level of distance codes */
  var here;                   /* retrieved table entry */
  var op;                     /* code bits, operation, extra bits, or */
                              /*  window position, window bytes to copy */
  var len;                    /* match length, unused bytes */
  var dist;                   /* match distance */
  var from;                   /* where to copy match from */
  var from_source;


  var input, output; // JS specific, because we have no pointers

  /* copy state to local variables */
  state = strm.state;
  //here = state.here;
  _in = strm.next_in;
  input = strm.input;
  last = _in + (strm.avail_in - 5);
  _out = strm.next_out;
  output = strm.output;
  beg = _out - (start - strm.avail_out);
  end = _out + (strm.avail_out - 257);
//#ifdef INFLATE_STRICT
  dmax = state.dmax;
//#endif
  wsize = state.wsize;
  whave = state.whave;
  wnext = state.wnext;
  s_window = state.window;
  hold = state.hold;
  bits = state.bits;
  lcode = state.lencode;
  dcode = state.distcode;
  lmask = (1 << state.lenbits) - 1;
  dmask = (1 << state.distbits) - 1;


  /* decode literals and length/distances until end-of-block or not enough
     input data or output space */

  top:
  do {
    if (bits < 15) {
      hold += input[_in++] << bits;
      bits += 8;
      hold += input[_in++] << bits;
      bits += 8;
    }

    here = lcode[hold & lmask];

    dolen:
    for (;;) { // Goto emulation
      op = here >>> 24/*here.bits*/;
      hold >>>= op;
      bits -= op;
      op = (here >>> 16) & 0xff/*here.op*/;
      if (op === 0) {                          /* literal */
        //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
        //        "inflate:         literal '%c'\n" :
        //        "inflate:         literal 0x%02x\n", here.val));
        output[_out++] = here & 0xffff/*here.val*/;
      }
      else if (op & 16) {                     /* length base */
        len = here & 0xffff/*here.val*/;
        op &= 15;                           /* number of extra bits */
        if (op) {
          if (bits < op) {
            hold += input[_in++] << bits;
            bits += 8;
          }
          len += hold & ((1 << op) - 1);
          hold >>>= op;
          bits -= op;
        }
        //Tracevv((stderr, "inflate:         length %u\n", len));
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = dcode[hold & dmask];

        dodist:
        for (;;) { // goto emulation
          op = here >>> 24/*here.bits*/;
          hold >>>= op;
          bits -= op;
          op = (here >>> 16) & 0xff/*here.op*/;

          if (op & 16) {                      /* distance base */
            dist = here & 0xffff/*here.val*/;
            op &= 15;                       /* number of extra bits */
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
              }
            }
            dist += hold & ((1 << op) - 1);
//#ifdef INFLATE_STRICT
            if (dist > dmax) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break top;
            }
//#endif
            hold >>>= op;
            bits -= op;
            //Tracevv((stderr, "inflate:         distance %u\n", dist));
            op = _out - beg;                /* max distance in output */
            if (dist > op) {                /* see if copy from window */
              op = dist - op;               /* distance back in window */
              if (op > whave) {
                if (state.sane) {
                  strm.msg = 'invalid distance too far back';
                  state.mode = BAD;
                  break top;
                }

// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//                if (len <= op - whave) {
//                  do {
//                    output[_out++] = 0;
//                  } while (--len);
//                  continue top;
//                }
//                len -= op - whave;
//                do {
//                  output[_out++] = 0;
//                } while (--op > whave);
//                if (op === 0) {
//                  from = _out - dist;
//                  do {
//                    output[_out++] = output[from++];
//                  } while (--len);
//                  continue top;
//                }
//#endif
              }
              from = 0; // window index
              from_source = s_window;
              if (wnext === 0) {           /* very common case */
                from += wsize - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              else if (wnext < op) {      /* wrap around window */
                from += wsize + wnext - op;
                op -= wnext;
                if (op < len) {         /* some from end of window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = 0;
                  if (wnext < len) {  /* some from start of window */
                    op = wnext;
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;      /* rest from output */
                    from_source = output;
                  }
                }
              }
              else {                      /* contiguous in window */
                from += wnext - op;
                if (op < len) {         /* some from window */
                  len -= op;
                  do {
                    output[_out++] = s_window[from++];
                  } while (--op);
                  from = _out - dist;  /* rest from output */
                  from_source = output;
                }
              }
              while (len > 2) {
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                output[_out++] = from_source[from++];
                len -= 3;
              }
              if (len) {
                output[_out++] = from_source[from++];
                if (len > 1) {
                  output[_out++] = from_source[from++];
                }
              }
            }
            else {
              from = _out - dist;          /* copy direct from output */
              do {                        /* minimum length is three */
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                output[_out++] = output[from++];
                len -= 3;
              } while (len > 2);
              if (len) {
                output[_out++] = output[from++];
                if (len > 1) {
                  output[_out++] = output[from++];
                }
              }
            }
          }
          else if ((op & 64) === 0) {          /* 2nd level distance code */
            here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
            continue dodist;
          }
          else {
            strm.msg = 'invalid distance code';
            state.mode = BAD;
            break top;
          }

          break; // need to emulate goto via "continue"
        }
      }
      else if ((op & 64) === 0) {              /* 2nd level length code */
        here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
        continue dolen;
      }
      else if (op & 32) {                     /* end-of-block */
        //Tracevv((stderr, "inflate:         end of block\n"));
        state.mode = TYPE;
        break top;
      }
      else {
        strm.msg = 'invalid literal/length code';
        state.mode = BAD;
        break top;
      }

      break; // need to emulate goto via "continue"
    }
  } while (_in < last && _out < end);

  /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
  len = bits >> 3;
  _in -= len;
  bits -= len << 3;
  hold &= (1 << bits) - 1;

  /* update state and return */
  strm.next_in = _in;
  strm.next_out = _out;
  strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
  strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
  state.hold = hold;
  state.bits = bits;
  return;
};

},{}],42:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils         = require('../utils/common');
var adler32       = require('./adler32');
var crc32         = require('./crc32');
var inflate_fast  = require('./inffast');
var inflate_table = require('./inftrees');

var CODES = 0;
var LENS = 1;
var DISTS = 2;

/* Public constants ==========================================================*/
/* ===========================================================================*/


/* Allowed flush values; see deflate() and inflate() below for details */
//var Z_NO_FLUSH      = 0;
//var Z_PARTIAL_FLUSH = 1;
//var Z_SYNC_FLUSH    = 2;
//var Z_FULL_FLUSH    = 3;
var Z_FINISH        = 4;
var Z_BLOCK         = 5;
var Z_TREES         = 6;


/* Return codes for the compression/decompression functions. Negative values
 * are errors, positive values are used for special but normal events.
 */
var Z_OK            = 0;
var Z_STREAM_END    = 1;
var Z_NEED_DICT     = 2;
//var Z_ERRNO         = -1;
var Z_STREAM_ERROR  = -2;
var Z_DATA_ERROR    = -3;
var Z_MEM_ERROR     = -4;
var Z_BUF_ERROR     = -5;
//var Z_VERSION_ERROR = -6;

/* The deflate compression method */
var Z_DEFLATED  = 8;


/* STATES ====================================================================*/
/* ===========================================================================*/


var    HEAD = 1;       /* i: waiting for magic header */
var    FLAGS = 2;      /* i: waiting for method and flags (gzip) */
var    TIME = 3;       /* i: waiting for modification time (gzip) */
var    OS = 4;         /* i: waiting for extra flags and operating system (gzip) */
var    EXLEN = 5;      /* i: waiting for extra length (gzip) */
var    EXTRA = 6;      /* i: waiting for extra bytes (gzip) */
var    NAME = 7;       /* i: waiting for end of file name (gzip) */
var    COMMENT = 8;    /* i: waiting for end of comment (gzip) */
var    HCRC = 9;       /* i: waiting for header crc (gzip) */
var    DICTID = 10;    /* i: waiting for dictionary check value */
var    DICT = 11;      /* waiting for inflateSetDictionary() call */
var        TYPE = 12;      /* i: waiting for type bits, including last-flag bit */
var        TYPEDO = 13;    /* i: same, but skip check to exit inflate on new block */
var        STORED = 14;    /* i: waiting for stored size (length and complement) */
var        COPY_ = 15;     /* i/o: same as COPY below, but only first time in */
var        COPY = 16;      /* i/o: waiting for input or output to copy stored block */
var        TABLE = 17;     /* i: waiting for dynamic block table lengths */
var        LENLENS = 18;   /* i: waiting for code length code lengths */
var        CODELENS = 19;  /* i: waiting for length/lit and distance code lengths */
var            LEN_ = 20;      /* i: same as LEN below, but only first time in */
var            LEN = 21;       /* i: waiting for length/lit/eob code */
var            LENEXT = 22;    /* i: waiting for length extra bits */
var            DIST = 23;      /* i: waiting for distance code */
var            DISTEXT = 24;   /* i: waiting for distance extra bits */
var            MATCH = 25;     /* o: waiting for output space to copy string */
var            LIT = 26;       /* o: waiting for output space to write literal */
var    CHECK = 27;     /* i: waiting for 32-bit check value */
var    LENGTH = 28;    /* i: waiting for 32-bit length (gzip) */
var    DONE = 29;      /* finished check, done -- remain here until reset */
var    BAD = 30;       /* got a data error -- remain here until reset */
var    MEM = 31;       /* got an inflate() memory error -- remain here until reset */
var    SYNC = 32;      /* looking for synchronization bytes to restart inflate() */

/* ===========================================================================*/



var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH =  (ENOUGH_LENS+ENOUGH_DISTS);

var MAX_WBITS = 15;
/* 32K LZ77 window */
var DEF_WBITS = MAX_WBITS;


function zswap32(q) {
  return  (((q >>> 24) & 0xff) +
          ((q >>> 8) & 0xff00) +
          ((q & 0xff00) << 8) +
          ((q & 0xff) << 24));
}


function InflateState() {
  this.mode = 0;             /* current inflate mode */
  this.last = false;          /* true if processing last block */
  this.wrap = 0;              /* bit 0 true for zlib, bit 1 true for gzip */
  this.havedict = false;      /* true if dictionary provided */
  this.flags = 0;             /* gzip header method and flags (0 if zlib) */
  this.dmax = 0;              /* zlib header max distance (INFLATE_STRICT) */
  this.check = 0;             /* protected copy of check value */
  this.total = 0;             /* protected copy of output count */
  // TODO: may be {}
  this.head = null;           /* where to save gzip header information */

  /* sliding window */
  this.wbits = 0;             /* log base 2 of requested window size */
  this.wsize = 0;             /* window size or zero if not using window */
  this.whave = 0;             /* valid bytes in the window */
  this.wnext = 0;             /* window write index */
  this.window = null;         /* allocated sliding window, if needed */

  /* bit accumulator */
  this.hold = 0;              /* input bit accumulator */
  this.bits = 0;              /* number of bits in "in" */

  /* for string and stored block copying */
  this.length = 0;            /* literal or length of data to copy */
  this.offset = 0;            /* distance back to copy string from */

  /* for table and code decoding */
  this.extra = 0;             /* extra bits needed */

  /* fixed and dynamic code tables */
  this.lencode = null;          /* starting table for length/literal codes */
  this.distcode = null;         /* starting table for distance codes */
  this.lenbits = 0;           /* index bits for lencode */
  this.distbits = 0;          /* index bits for distcode */

  /* dynamic table building */
  this.ncode = 0;             /* number of code length code lengths */
  this.nlen = 0;              /* number of length code lengths */
  this.ndist = 0;             /* number of distance code lengths */
  this.have = 0;              /* number of code lengths in lens[] */
  this.next = null;              /* next available space in codes[] */

  this.lens = new utils.Buf16(320); /* temporary storage for code lengths */
  this.work = new utils.Buf16(288); /* work area for code table building */

  /*
   because we don't have pointers in js, we use lencode and distcode directly
   as buffers so we don't need codes
  */
  //this.codes = new utils.Buf32(ENOUGH);       /* space for code tables */
  this.lendyn = null;              /* dynamic table for length/literal codes (JS specific) */
  this.distdyn = null;             /* dynamic table for distance codes (JS specific) */
  this.sane = 0;                   /* if false, allow invalid distance too far */
  this.back = 0;                   /* bits back of last unprocessed length/lit */
  this.was = 0;                    /* initial length of match */
}

function inflateResetKeep(strm) {
  var state;

  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  strm.total_in = strm.total_out = state.total = 0;
  strm.msg = ''; /*Z_NULL*/
  if (state.wrap) {       /* to support ill-conceived Java test suite */
    strm.adler = state.wrap & 1;
  }
  state.mode = HEAD;
  state.last = 0;
  state.havedict = 0;
  state.dmax = 32768;
  state.head = null/*Z_NULL*/;
  state.hold = 0;
  state.bits = 0;
  //state.lencode = state.distcode = state.next = state.codes;
  state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
  state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);

  state.sane = 1;
  state.back = -1;
  //Tracev((stderr, "inflate: reset\n"));
  return Z_OK;
}

function inflateReset(strm) {
  var state;

  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  state.wsize = 0;
  state.whave = 0;
  state.wnext = 0;
  return inflateResetKeep(strm);

}

function inflateReset2(strm, windowBits) {
  var wrap;
  var state;

  /* get the state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;

  /* extract wrap request from windowBits parameter */
  if (windowBits < 0) {
    wrap = 0;
    windowBits = -windowBits;
  }
  else {
    wrap = (windowBits >> 4) + 1;
    if (windowBits < 48) {
      windowBits &= 15;
    }
  }

  /* set number of window bits, free window if different */
  if (windowBits && (windowBits < 8 || windowBits > 15)) {
    return Z_STREAM_ERROR;
  }
  if (state.window !== null && state.wbits !== windowBits) {
    state.window = null;
  }

  /* update state and reset the rest of it */
  state.wrap = wrap;
  state.wbits = windowBits;
  return inflateReset(strm);
}

function inflateInit2(strm, windowBits) {
  var ret;
  var state;

  if (!strm) { return Z_STREAM_ERROR; }
  //strm.msg = Z_NULL;                 /* in case we return an error */

  state = new InflateState();

  //if (state === Z_NULL) return Z_MEM_ERROR;
  //Tracev((stderr, "inflate: allocated\n"));
  strm.state = state;
  state.window = null/*Z_NULL*/;
  ret = inflateReset2(strm, windowBits);
  if (ret !== Z_OK) {
    strm.state = null/*Z_NULL*/;
  }
  return ret;
}

function inflateInit(strm) {
  return inflateInit2(strm, DEF_WBITS);
}


/*
 Return state with length and distance decoding tables and index sizes set to
 fixed code decoding.  Normally this returns fixed tables from inffixed.h.
 If BUILDFIXED is defined, then instead this routine builds the tables the
 first time it's called, and returns those tables the first time and
 thereafter.  This reduces the size of the code by about 2K bytes, in
 exchange for a little execution time.  However, BUILDFIXED should not be
 used for threaded applications, since the rewriting of the tables and virgin
 may not be thread-safe.
 */
var virgin = true;

var lenfix, distfix; // We have no pointers in JS, so keep tables separate

function fixedtables(state) {
  /* build fixed huffman tables if first call (may not be thread safe) */
  if (virgin) {
    var sym;

    lenfix = new utils.Buf32(512);
    distfix = new utils.Buf32(32);

    /* literal/length table */
    sym = 0;
    while (sym < 144) { state.lens[sym++] = 8; }
    while (sym < 256) { state.lens[sym++] = 9; }
    while (sym < 280) { state.lens[sym++] = 7; }
    while (sym < 288) { state.lens[sym++] = 8; }

    inflate_table(LENS,  state.lens, 0, 288, lenfix,   0, state.work, { bits: 9 });

    /* distance table */
    sym = 0;
    while (sym < 32) { state.lens[sym++] = 5; }

    inflate_table(DISTS, state.lens, 0, 32,   distfix, 0, state.work, { bits: 5 });

    /* do this just once */
    virgin = false;
  }

  state.lencode = lenfix;
  state.lenbits = 9;
  state.distcode = distfix;
  state.distbits = 5;
}


/*
 Update the window with the last wsize (normally 32K) bytes written before
 returning.  If window does not exist yet, create it.  This is only called
 when a window is already in use, or when output has been written during this
 inflate call, but the end of the deflate stream has not been reached yet.
 It is also called to create a window for dictionary data when a dictionary
 is loaded.

 Providing output buffers larger than 32K to inflate() should provide a speed
 advantage, since only the last 32K of output is copied to the sliding window
 upon return from inflate(), and since all distances after the first 32K of
 output will fall in the output data, making match copies simpler and faster.
 The advantage may be dependent on the size of the processor's data caches.
 */
function updatewindow(strm, src, end, copy) {
  var dist;
  var state = strm.state;

  /* if it hasn't been done already, allocate space for the window */
  if (state.window === null) {
    state.wsize = 1 << state.wbits;
    state.wnext = 0;
    state.whave = 0;

    state.window = new utils.Buf8(state.wsize);
  }

  /* copy state->wsize or less output bytes into the circular window */
  if (copy >= state.wsize) {
    utils.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
    state.wnext = 0;
    state.whave = state.wsize;
  }
  else {
    dist = state.wsize - state.wnext;
    if (dist > copy) {
      dist = copy;
    }
    //zmemcpy(state->window + state->wnext, end - copy, dist);
    utils.arraySet(state.window, src, end - copy, dist, state.wnext);
    copy -= dist;
    if (copy) {
      //zmemcpy(state->window, end - copy, copy);
      utils.arraySet(state.window, src, end - copy, copy, 0);
      state.wnext = copy;
      state.whave = state.wsize;
    }
    else {
      state.wnext += dist;
      if (state.wnext === state.wsize) { state.wnext = 0; }
      if (state.whave < state.wsize) { state.whave += dist; }
    }
  }
  return 0;
}

function inflate(strm, flush) {
  var state;
  var input, output;          // input/output buffers
  var next;                   /* next input INDEX */
  var put;                    /* next output INDEX */
  var have, left;             /* available input and output */
  var hold;                   /* bit buffer */
  var bits;                   /* bits in bit buffer */
  var _in, _out;              /* save starting available input and output */
  var copy;                   /* number of stored or match bytes to copy */
  var from;                   /* where to copy match bytes from */
  var from_source;
  var here = 0;               /* current decoding table entry */
  var here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
  //var last;                   /* parent table entry */
  var last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
  var len;                    /* length to copy for repeats, bits to drop */
  var ret;                    /* return code */
  var hbuf = new utils.Buf8(4);    /* buffer for gzip header crc calculation */
  var opts;

  var n; // temporary var for NEED_BITS

  var order = /* permutation of code lengths */
    [ 16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15 ];


  if (!strm || !strm.state || !strm.output ||
      (!strm.input && strm.avail_in !== 0)) {
    return Z_STREAM_ERROR;
  }

  state = strm.state;
  if (state.mode === TYPE) { state.mode = TYPEDO; }    /* skip check */


  //--- LOAD() ---
  put = strm.next_out;
  output = strm.output;
  left = strm.avail_out;
  next = strm.next_in;
  input = strm.input;
  have = strm.avail_in;
  hold = state.hold;
  bits = state.bits;
  //---

  _in = have;
  _out = left;
  ret = Z_OK;

  inf_leave: // goto emulation
  for (;;) {
    switch (state.mode) {
      case HEAD:
        if (state.wrap === 0) {
          state.mode = TYPEDO;
          break;
        }
        //=== NEEDBITS(16);
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if ((state.wrap & 2) && hold === 0x8b1f) {  /* gzip header */
          state.check = 0/*crc32(0L, Z_NULL, 0)*/;
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//

          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = FLAGS;
          break;
        }
        state.flags = 0;           /* expect zlib header */
        if (state.head) {
          state.head.done = false;
        }
        if (!(state.wrap & 1) ||   /* check if zlib header allowed */
          (((hold & 0xff)/*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
          strm.msg = 'incorrect header check';
          state.mode = BAD;
          break;
        }
        if ((hold & 0x0f)/*BITS(4)*/ !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
        len = (hold & 0x0f)/*BITS(4)*/ + 8;
        if (state.wbits === 0) {
          state.wbits = len;
        }
        else if (len > state.wbits) {
          strm.msg = 'invalid window size';
          state.mode = BAD;
          break;
        }
        state.dmax = 1 << len;
        //Tracev((stderr, "inflate:   zlib header ok\n"));
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = hold & 0x200 ? DICTID : TYPE;
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        break;
      case FLAGS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.flags = hold;
        if ((state.flags & 0xff) !== Z_DEFLATED) {
          strm.msg = 'unknown compression method';
          state.mode = BAD;
          break;
        }
        if (state.flags & 0xe000) {
          strm.msg = 'unknown header flags set';
          state.mode = BAD;
          break;
        }
        if (state.head) {
          state.head.text = ((hold >> 8) & 1);
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = TIME;
        /* falls through */
      case TIME:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.time = hold;
        }
        if (state.flags & 0x0200) {
          //=== CRC4(state.check, hold)
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          hbuf[2] = (hold >>> 16) & 0xff;
          hbuf[3] = (hold >>> 24) & 0xff;
          state.check = crc32(state.check, hbuf, 4, 0);
          //===
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = OS;
        /* falls through */
      case OS:
        //=== NEEDBITS(16); */
        while (bits < 16) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if (state.head) {
          state.head.xflags = (hold & 0xff);
          state.head.os = (hold >> 8);
        }
        if (state.flags & 0x0200) {
          //=== CRC2(state.check, hold);
          hbuf[0] = hold & 0xff;
          hbuf[1] = (hold >>> 8) & 0xff;
          state.check = crc32(state.check, hbuf, 2, 0);
          //===//
        }
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = EXLEN;
        /* falls through */
      case EXLEN:
        if (state.flags & 0x0400) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length = hold;
          if (state.head) {
            state.head.extra_len = hold;
          }
          if (state.flags & 0x0200) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
            //===//
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        }
        else if (state.head) {
          state.head.extra = null/*Z_NULL*/;
        }
        state.mode = EXTRA;
        /* falls through */
      case EXTRA:
        if (state.flags & 0x0400) {
          copy = state.length;
          if (copy > have) { copy = have; }
          if (copy) {
            if (state.head) {
              len = state.head.extra_len - state.length;
              if (!state.head.extra) {
                // Use untyped array for more convenient processing later
                state.head.extra = new Array(state.head.extra_len);
              }
              utils.arraySet(
                state.head.extra,
                input,
                next,
                // extra field is limited to 65536 bytes
                // - no need for additional size check
                copy,
                /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                len
              );
              //zmemcpy(state.head.extra + len, next,
              //        len + copy > state.head.extra_max ?
              //        state.head.extra_max - len : copy);
            }
            if (state.flags & 0x0200) {
              state.check = crc32(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            state.length -= copy;
          }
          if (state.length) { break inf_leave; }
        }
        state.length = 0;
        state.mode = NAME;
        /* falls through */
      case NAME:
        if (state.flags & 0x0800) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            // TODO: 2 or 1 bytes?
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len &&
                (state.length < 65536 /*state.head.name_max*/)) {
              state.head.name += String.fromCharCode(len);
            }
          } while (len && copy < have);

          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.name = null;
        }
        state.length = 0;
        state.mode = COMMENT;
        /* falls through */
      case COMMENT:
        if (state.flags & 0x1000) {
          if (have === 0) { break inf_leave; }
          copy = 0;
          do {
            len = input[next + copy++];
            /* use constant limit because in js we should not preallocate memory */
            if (state.head && len &&
                (state.length < 65536 /*state.head.comm_max*/)) {
              state.head.comment += String.fromCharCode(len);
            }
          } while (len && copy < have);
          if (state.flags & 0x0200) {
            state.check = crc32(state.check, input, copy, next);
          }
          have -= copy;
          next += copy;
          if (len) { break inf_leave; }
        }
        else if (state.head) {
          state.head.comment = null;
        }
        state.mode = HCRC;
        /* falls through */
      case HCRC:
        if (state.flags & 0x0200) {
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (hold !== (state.check & 0xffff)) {
            strm.msg = 'header crc mismatch';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
        }
        if (state.head) {
          state.head.hcrc = ((state.flags >> 9) & 1);
          state.head.done = true;
        }
        strm.adler = state.check = 0;
        state.mode = TYPE;
        break;
      case DICTID:
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        strm.adler = state.check = zswap32(hold);
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = DICT;
        /* falls through */
      case DICT:
        if (state.havedict === 0) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          return Z_NEED_DICT;
        }
        strm.adler = state.check = 1/*adler32(0L, Z_NULL, 0)*/;
        state.mode = TYPE;
        /* falls through */
      case TYPE:
        if (flush === Z_BLOCK || flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case TYPEDO:
        if (state.last) {
          //--- BYTEBITS() ---//
          hold >>>= bits & 7;
          bits -= bits & 7;
          //---//
          state.mode = CHECK;
          break;
        }
        //=== NEEDBITS(3); */
        while (bits < 3) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.last = (hold & 0x01)/*BITS(1)*/;
        //--- DROPBITS(1) ---//
        hold >>>= 1;
        bits -= 1;
        //---//

        switch ((hold & 0x03)/*BITS(2)*/) {
          case 0:                             /* stored block */
            //Tracev((stderr, "inflate:     stored block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = STORED;
            break;
          case 1:                             /* fixed block */
            fixedtables(state);
            //Tracev((stderr, "inflate:     fixed codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = LEN_;             /* decode codes */
            if (flush === Z_TREES) {
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
              break inf_leave;
            }
            break;
          case 2:                             /* dynamic block */
            //Tracev((stderr, "inflate:     dynamic codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = TABLE;
            break;
          case 3:
            strm.msg = 'invalid block type';
            state.mode = BAD;
        }
        //--- DROPBITS(2) ---//
        hold >>>= 2;
        bits -= 2;
        //---//
        break;
      case STORED:
        //--- BYTEBITS() ---// /* go to byte boundary */
        hold >>>= bits & 7;
        bits -= bits & 7;
        //---//
        //=== NEEDBITS(32); */
        while (bits < 32) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
          strm.msg = 'invalid stored block lengths';
          state.mode = BAD;
          break;
        }
        state.length = hold & 0xffff;
        //Tracev((stderr, "inflate:       stored length %u\n",
        //        state.length));
        //=== INITBITS();
        hold = 0;
        bits = 0;
        //===//
        state.mode = COPY_;
        if (flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case COPY_:
        state.mode = COPY;
        /* falls through */
      case COPY:
        copy = state.length;
        if (copy) {
          if (copy > have) { copy = have; }
          if (copy > left) { copy = left; }
          if (copy === 0) { break inf_leave; }
          //--- zmemcpy(put, next, copy); ---
          utils.arraySet(output, input, next, copy, put);
          //---//
          have -= copy;
          next += copy;
          left -= copy;
          put += copy;
          state.length -= copy;
          break;
        }
        //Tracev((stderr, "inflate:       stored end\n"));
        state.mode = TYPE;
        break;
      case TABLE:
        //=== NEEDBITS(14); */
        while (bits < 14) {
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
        }
        //===//
        state.nlen = (hold & 0x1f)/*BITS(5)*/ + 257;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ndist = (hold & 0x1f)/*BITS(5)*/ + 1;
        //--- DROPBITS(5) ---//
        hold >>>= 5;
        bits -= 5;
        //---//
        state.ncode = (hold & 0x0f)/*BITS(4)*/ + 4;
        //--- DROPBITS(4) ---//
        hold >>>= 4;
        bits -= 4;
        //---//
//#ifndef PKZIP_BUG_WORKAROUND
        if (state.nlen > 286 || state.ndist > 30) {
          strm.msg = 'too many length or distance symbols';
          state.mode = BAD;
          break;
        }
//#endif
        //Tracev((stderr, "inflate:       table sizes ok\n"));
        state.have = 0;
        state.mode = LENLENS;
        /* falls through */
      case LENLENS:
        while (state.have < state.ncode) {
          //=== NEEDBITS(3);
          while (bits < 3) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.lens[order[state.have++]] = (hold & 0x07);//BITS(3);
          //--- DROPBITS(3) ---//
          hold >>>= 3;
          bits -= 3;
          //---//
        }
        while (state.have < 19) {
          state.lens[order[state.have++]] = 0;
        }
        // We have separate tables & no pointers. 2 commented lines below not needed.
        //state.next = state.codes;
        //state.lencode = state.next;
        // Switch to use dynamic table
        state.lencode = state.lendyn;
        state.lenbits = 7;

        opts = { bits: state.lenbits };
        ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
        state.lenbits = opts.bits;

        if (ret) {
          strm.msg = 'invalid code lengths set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, "inflate:       code lengths ok\n"));
        state.have = 0;
        state.mode = CODELENS;
        /* falls through */
      case CODELENS:
        while (state.have < state.nlen + state.ndist) {
          for (;;) {
            here = state.lencode[hold & ((1 << state.lenbits) - 1)];/*BITS(state.lenbits)*/
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          if (here_val < 16) {
            //--- DROPBITS(here.bits) ---//
            hold >>>= here_bits;
            bits -= here_bits;
            //---//
            state.lens[state.have++] = here_val;
          }
          else {
            if (here_val === 16) {
              //=== NEEDBITS(here.bits + 2);
              n = here_bits + 2;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              if (state.have === 0) {
                strm.msg = 'invalid bit length repeat';
                state.mode = BAD;
                break;
              }
              len = state.lens[state.have - 1];
              copy = 3 + (hold & 0x03);//BITS(2);
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
            }
            else if (here_val === 17) {
              //=== NEEDBITS(here.bits + 3);
              n = here_bits + 3;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 3 + (hold & 0x07);//BITS(3);
              //--- DROPBITS(3) ---//
              hold >>>= 3;
              bits -= 3;
              //---//
            }
            else {
              //=== NEEDBITS(here.bits + 7);
              n = here_bits + 7;
              while (bits < n) {
                if (have === 0) { break inf_leave; }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              //===//
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              len = 0;
              copy = 11 + (hold & 0x7f);//BITS(7);
              //--- DROPBITS(7) ---//
              hold >>>= 7;
              bits -= 7;
              //---//
            }
            if (state.have + copy > state.nlen + state.ndist) {
              strm.msg = 'invalid bit length repeat';
              state.mode = BAD;
              break;
            }
            while (copy--) {
              state.lens[state.have++] = len;
            }
          }
        }

        /* handle error breaks in while */
        if (state.mode === BAD) { break; }

        /* check for end-of-block code (better have one) */
        if (state.lens[256] === 0) {
          strm.msg = 'invalid code -- missing end-of-block';
          state.mode = BAD;
          break;
        }

        /* build code tables -- note: do not change the lenbits or distbits
           values here (9 and 6) without reading the comments in inftrees.h
           concerning the ENOUGH constants, which depend on those values */
        state.lenbits = 9;

        opts = { bits: state.lenbits };
        ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.lenbits = opts.bits;
        // state.lencode = state.next;

        if (ret) {
          strm.msg = 'invalid literal/lengths set';
          state.mode = BAD;
          break;
        }

        state.distbits = 6;
        //state.distcode.copy(state.codes);
        // Switch to use dynamic table
        state.distcode = state.distdyn;
        opts = { bits: state.distbits };
        ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
        // We have separate tables & no pointers. 2 commented lines below not needed.
        // state.next_index = opts.table_index;
        state.distbits = opts.bits;
        // state.distcode = state.next;

        if (ret) {
          strm.msg = 'invalid distances set';
          state.mode = BAD;
          break;
        }
        //Tracev((stderr, 'inflate:       codes ok\n'));
        state.mode = LEN_;
        if (flush === Z_TREES) { break inf_leave; }
        /* falls through */
      case LEN_:
        state.mode = LEN;
        /* falls through */
      case LEN:
        if (have >= 6 && left >= 258) {
          //--- RESTORE() ---
          strm.next_out = put;
          strm.avail_out = left;
          strm.next_in = next;
          strm.avail_in = have;
          state.hold = hold;
          state.bits = bits;
          //---
          inflate_fast(strm, _out);
          //--- LOAD() ---
          put = strm.next_out;
          output = strm.output;
          left = strm.avail_out;
          next = strm.next_in;
          input = strm.input;
          have = strm.avail_in;
          hold = state.hold;
          bits = state.bits;
          //---

          if (state.mode === TYPE) {
            state.back = -1;
          }
          break;
        }
        state.back = 0;
        for (;;) {
          here = state.lencode[hold & ((1 << state.lenbits) - 1)];  /*BITS(state.lenbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if (here_bits <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if (here_op && (here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.lencode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((last_bits + here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        state.length = here_val;
        if (here_op === 0) {
          //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
          //        "inflate:         literal '%c'\n" :
          //        "inflate:         literal 0x%02x\n", here.val));
          state.mode = LIT;
          break;
        }
        if (here_op & 32) {
          //Tracevv((stderr, "inflate:         end of block\n"));
          state.back = -1;
          state.mode = TYPE;
          break;
        }
        if (here_op & 64) {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD;
          break;
        }
        state.extra = here_op & 15;
        state.mode = LENEXT;
        /* falls through */
      case LENEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.length += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
        //Tracevv((stderr, "inflate:         length %u\n", state.length));
        state.was = state.length;
        state.mode = DIST;
        /* falls through */
      case DIST:
        for (;;) {
          here = state.distcode[hold & ((1 << state.distbits) - 1)];/*BITS(state.distbits)*/
          here_bits = here >>> 24;
          here_op = (here >>> 16) & 0xff;
          here_val = here & 0xffff;

          if ((here_bits) <= bits) { break; }
          //--- PULLBYTE() ---//
          if (have === 0) { break inf_leave; }
          have--;
          hold += input[next++] << bits;
          bits += 8;
          //---//
        }
        if ((here_op & 0xf0) === 0) {
          last_bits = here_bits;
          last_op = here_op;
          last_val = here_val;
          for (;;) {
            here = state.distcode[last_val +
                    ((hold & ((1 << (last_bits + last_op)) - 1))/*BITS(last.bits + last.op)*/ >> last_bits)];
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((last_bits + here_bits) <= bits) { break; }
            //--- PULLBYTE() ---//
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          //--- DROPBITS(last.bits) ---//
          hold >>>= last_bits;
          bits -= last_bits;
          //---//
          state.back += last_bits;
        }
        //--- DROPBITS(here.bits) ---//
        hold >>>= here_bits;
        bits -= here_bits;
        //---//
        state.back += here_bits;
        if (here_op & 64) {
          strm.msg = 'invalid distance code';
          state.mode = BAD;
          break;
        }
        state.offset = here_val;
        state.extra = (here_op) & 15;
        state.mode = DISTEXT;
        /* falls through */
      case DISTEXT:
        if (state.extra) {
          //=== NEEDBITS(state.extra);
          n = state.extra;
          while (bits < n) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.offset += hold & ((1 << state.extra) - 1)/*BITS(state.extra)*/;
          //--- DROPBITS(state.extra) ---//
          hold >>>= state.extra;
          bits -= state.extra;
          //---//
          state.back += state.extra;
        }
//#ifdef INFLATE_STRICT
        if (state.offset > state.dmax) {
          strm.msg = 'invalid distance too far back';
          state.mode = BAD;
          break;
        }
//#endif
        //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
        state.mode = MATCH;
        /* falls through */
      case MATCH:
        if (left === 0) { break inf_leave; }
        copy = _out - left;
        if (state.offset > copy) {         /* copy from window */
          copy = state.offset - copy;
          if (copy > state.whave) {
            if (state.sane) {
              strm.msg = 'invalid distance too far back';
              state.mode = BAD;
              break;
            }
// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility
//#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
//          Trace((stderr, "inflate.c too far\n"));
//          copy -= state.whave;
//          if (copy > state.length) { copy = state.length; }
//          if (copy > left) { copy = left; }
//          left -= copy;
//          state.length -= copy;
//          do {
//            output[put++] = 0;
//          } while (--copy);
//          if (state.length === 0) { state.mode = LEN; }
//          break;
//#endif
          }
          if (copy > state.wnext) {
            copy -= state.wnext;
            from = state.wsize - copy;
          }
          else {
            from = state.wnext - copy;
          }
          if (copy > state.length) { copy = state.length; }
          from_source = state.window;
        }
        else {                              /* copy from output */
          from_source = output;
          from = put - state.offset;
          copy = state.length;
        }
        if (copy > left) { copy = left; }
        left -= copy;
        state.length -= copy;
        do {
          output[put++] = from_source[from++];
        } while (--copy);
        if (state.length === 0) { state.mode = LEN; }
        break;
      case LIT:
        if (left === 0) { break inf_leave; }
        output[put++] = state.length;
        left--;
        state.mode = LEN;
        break;
      case CHECK:
        if (state.wrap) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            // Use '|' instead of '+' to make sure that result is signed
            hold |= input[next++] << bits;
            bits += 8;
          }
          //===//
          _out -= left;
          strm.total_out += _out;
          state.total += _out;
          if (_out) {
            strm.adler = state.check =
                /*UPDATE(state.check, put - _out, _out);*/
                (state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out));

          }
          _out = left;
          // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
          if ((state.flags ? hold : zswap32(hold)) !== state.check) {
            strm.msg = 'incorrect data check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   check matches trailer\n"));
        }
        state.mode = LENGTH;
        /* falls through */
      case LENGTH:
        if (state.wrap && state.flags) {
          //=== NEEDBITS(32);
          while (bits < 32) {
            if (have === 0) { break inf_leave; }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (hold !== (state.total & 0xffffffff)) {
            strm.msg = 'incorrect length check';
            state.mode = BAD;
            break;
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          //Tracev((stderr, "inflate:   length matches trailer\n"));
        }
        state.mode = DONE;
        /* falls through */
      case DONE:
        ret = Z_STREAM_END;
        break inf_leave;
      case BAD:
        ret = Z_DATA_ERROR;
        break inf_leave;
      case MEM:
        return Z_MEM_ERROR;
      case SYNC:
        /* falls through */
      default:
        return Z_STREAM_ERROR;
    }
  }

  // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

  /*
     Return from inflate(), updating the total counts and the check value.
     If there was no progress during the inflate() call, return a buffer
     error.  Call updatewindow() to create and/or update the window state.
     Note: a memory error from inflate() is non-recoverable.
   */

  //--- RESTORE() ---
  strm.next_out = put;
  strm.avail_out = left;
  strm.next_in = next;
  strm.avail_in = have;
  state.hold = hold;
  state.bits = bits;
  //---

  if (state.wsize || (_out !== strm.avail_out && state.mode < BAD &&
                      (state.mode < CHECK || flush !== Z_FINISH))) {
    if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
      state.mode = MEM;
      return Z_MEM_ERROR;
    }
  }
  _in -= strm.avail_in;
  _out -= strm.avail_out;
  strm.total_in += _in;
  strm.total_out += _out;
  state.total += _out;
  if (state.wrap && _out) {
    strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
      (state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out));
  }
  strm.data_type = state.bits + (state.last ? 64 : 0) +
                    (state.mode === TYPE ? 128 : 0) +
                    (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
  if (((_in === 0 && _out === 0) || flush === Z_FINISH) && ret === Z_OK) {
    ret = Z_BUF_ERROR;
  }
  return ret;
}

function inflateEnd(strm) {

  if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/) {
    return Z_STREAM_ERROR;
  }

  var state = strm.state;
  if (state.window) {
    state.window = null;
  }
  strm.state = null;
  return Z_OK;
}

function inflateGetHeader(strm, head) {
  var state;

  /* check state */
  if (!strm || !strm.state) { return Z_STREAM_ERROR; }
  state = strm.state;
  if ((state.wrap & 2) === 0) { return Z_STREAM_ERROR; }

  /* save header structure */
  state.head = head;
  head.done = false;
  return Z_OK;
}

function inflateSetDictionary(strm, dictionary) {
  var dictLength = dictionary.length;

  var state;
  var dictid;
  var ret;

  /* check state */
  if (!strm /* == Z_NULL */ || !strm.state /* == Z_NULL */) { return Z_STREAM_ERROR; }
  state = strm.state;

  if (state.wrap !== 0 && state.mode !== DICT) {
    return Z_STREAM_ERROR;
  }

  /* check for correct dictionary identifier */
  if (state.mode === DICT) {
    dictid = 1; /* adler32(0, null, 0)*/
    /* dictid = adler32(dictid, dictionary, dictLength); */
    dictid = adler32(dictid, dictionary, dictLength, 0);
    if (dictid !== state.check) {
      return Z_DATA_ERROR;
    }
  }
  /* copy dictionary to window using updatewindow(), which will amend the
   existing dictionary if appropriate */
  ret = updatewindow(strm, dictionary, dictLength, dictLength);
  if (ret) {
    state.mode = MEM;
    return Z_MEM_ERROR;
  }
  state.havedict = 1;
  // Tracev((stderr, "inflate:   dictionary set\n"));
  return Z_OK;
}

exports.inflateReset = inflateReset;
exports.inflateReset2 = inflateReset2;
exports.inflateResetKeep = inflateResetKeep;
exports.inflateInit = inflateInit;
exports.inflateInit2 = inflateInit2;
exports.inflate = inflate;
exports.inflateEnd = inflateEnd;
exports.inflateGetHeader = inflateGetHeader;
exports.inflateSetDictionary = inflateSetDictionary;
exports.inflateInfo = 'pako inflate (from Nodeca project)';

/* Not implemented
exports.inflateCopy = inflateCopy;
exports.inflateGetDictionary = inflateGetDictionary;
exports.inflateMark = inflateMark;
exports.inflatePrime = inflatePrime;
exports.inflateSync = inflateSync;
exports.inflateSyncPoint = inflateSyncPoint;
exports.inflateUndermine = inflateUndermine;
*/

},{"../utils/common":34,"./adler32":36,"./crc32":38,"./inffast":41,"./inftrees":43}],43:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

var utils = require('../utils/common');

var MAXBITS = 15;
var ENOUGH_LENS = 852;
var ENOUGH_DISTS = 592;
//var ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

var CODES = 0;
var LENS = 1;
var DISTS = 2;

var lbase = [ /* Length codes 257..285 base */
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
];

var lext = [ /* Length codes 257..285 extra */
  16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
  19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
];

var dbase = [ /* Distance codes 0..29 base */
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
  8193, 12289, 16385, 24577, 0, 0
];

var dext = [ /* Distance codes 0..29 extra */
  16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
  23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
  28, 28, 29, 29, 64, 64
];

module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts)
{
  var bits = opts.bits;
      //here = opts.here; /* table entry for duplication */

  var len = 0;               /* a code's length in bits */
  var sym = 0;               /* index of code symbols */
  var min = 0, max = 0;          /* minimum and maximum code lengths */
  var root = 0;              /* number of index bits for root table */
  var curr = 0;              /* number of index bits for current table */
  var drop = 0;              /* code bits to drop for sub-table */
  var left = 0;                   /* number of prefix codes available */
  var used = 0;              /* code entries in table used */
  var huff = 0;              /* Huffman code */
  var incr;              /* for incrementing code, index */
  var fill;              /* index for replicating entries */
  var low;               /* low bits for current root entry */
  var mask;              /* mask for low root bits */
  var next;             /* next available space in table */
  var base = null;     /* base value table to use */
  var base_index = 0;
//  var shoextra;    /* extra bits table to use */
  var end;                    /* use base and extra for symbol > end */
  var count = new utils.Buf16(MAXBITS + 1); //[MAXBITS+1];    /* number of codes of each length */
  var offs = new utils.Buf16(MAXBITS + 1); //[MAXBITS+1];     /* offsets in table for each length */
  var extra = null;
  var extra_index = 0;

  var here_bits, here_op, here_val;

  /*
   Process a set of code lengths to create a canonical Huffman code.  The
   code lengths are lens[0..codes-1].  Each length corresponds to the
   symbols 0..codes-1.  The Huffman code is generated by first sorting the
   symbols by length from short to long, and retaining the symbol order
   for codes with equal lengths.  Then the code starts with all zero bits
   for the first code of the shortest length, and the codes are integer
   increments for the same length, and zeros are appended as the length
   increases.  For the deflate format, these bits are stored backwards
   from their more natural integer increment ordering, and so when the
   decoding tables are built in the large loop below, the integer codes
   are incremented backwards.

   This routine assumes, but does not check, that all of the entries in
   lens[] are in the range 0..MAXBITS.  The caller must assure this.
   1..MAXBITS is interpreted as that code length.  zero means that that
   symbol does not occur in this code.

   The codes are sorted by computing a count of codes for each length,
   creating from that a table of starting indices for each length in the
   sorted table, and then entering the symbols in order in the sorted
   table.  The sorted table is work[], with that space being provided by
   the caller.

   The length counts are used for other purposes as well, i.e. finding
   the minimum and maximum length codes, determining if there are any
   codes at all, checking for a valid set of lengths, and looking ahead
   at length counts to determine sub-table sizes when building the
   decoding tables.
   */

  /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
  for (len = 0; len <= MAXBITS; len++) {
    count[len] = 0;
  }
  for (sym = 0; sym < codes; sym++) {
    count[lens[lens_index + sym]]++;
  }

  /* bound code lengths, force root to be within code lengths */
  root = bits;
  for (max = MAXBITS; max >= 1; max--) {
    if (count[max] !== 0) { break; }
  }
  if (root > max) {
    root = max;
  }
  if (max === 0) {                     /* no symbols to code at all */
    //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
    //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
    //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;


    //table.op[opts.table_index] = 64;
    //table.bits[opts.table_index] = 1;
    //table.val[opts.table_index++] = 0;
    table[table_index++] = (1 << 24) | (64 << 16) | 0;

    opts.bits = 1;
    return 0;     /* no symbols, but wait for decoding to report error */
  }
  for (min = 1; min < max; min++) {
    if (count[min] !== 0) { break; }
  }
  if (root < min) {
    root = min;
  }

  /* check for an over-subscribed or incomplete set of lengths */
  left = 1;
  for (len = 1; len <= MAXBITS; len++) {
    left <<= 1;
    left -= count[len];
    if (left < 0) {
      return -1;
    }        /* over-subscribed */
  }
  if (left > 0 && (type === CODES || max !== 1)) {
    return -1;                      /* incomplete set */
  }

  /* generate offsets into symbol table for each length for sorting */
  offs[1] = 0;
  for (len = 1; len < MAXBITS; len++) {
    offs[len + 1] = offs[len] + count[len];
  }

  /* sort symbols by length, by symbol order within each length */
  for (sym = 0; sym < codes; sym++) {
    if (lens[lens_index + sym] !== 0) {
      work[offs[lens[lens_index + sym]]++] = sym;
    }
  }

  /*
   Create and fill in decoding tables.  In this loop, the table being
   filled is at next and has curr index bits.  The code being used is huff
   with length len.  That code is converted to an index by dropping drop
   bits off of the bottom.  For codes where len is less than drop + curr,
   those top drop + curr - len bits are incremented through all values to
   fill the table with replicated entries.

   root is the number of index bits for the root table.  When len exceeds
   root, sub-tables are created pointed to by the root entry with an index
   of the low root bits of huff.  This is saved in low to check for when a
   new sub-table should be started.  drop is zero when the root table is
   being filled, and drop is root when sub-tables are being filled.

   When a new sub-table is needed, it is necessary to look ahead in the
   code lengths to determine what size sub-table is needed.  The length
   counts are used for this, and so count[] is decremented as codes are
   entered in the tables.

   used keeps track of how many table entries have been allocated from the
   provided *table space.  It is checked for LENS and DIST tables against
   the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
   the initial root table size constants.  See the comments in inftrees.h
   for more information.

   sym increments through all symbols, and the loop terminates when
   all codes of length max, i.e. all codes, have been processed.  This
   routine permits incomplete codes, so another loop after this one fills
   in the rest of the decoding tables with invalid code markers.
   */

  /* set up for code type */
  // poor man optimization - use if-else instead of switch,
  // to avoid deopts in old v8
  if (type === CODES) {
    base = extra = work;    /* dummy value--not used */
    end = 19;

  } else if (type === LENS) {
    base = lbase;
    base_index -= 257;
    extra = lext;
    extra_index -= 257;
    end = 256;

  } else {                    /* DISTS */
    base = dbase;
    extra = dext;
    end = -1;
  }

  /* initialize opts for loop */
  huff = 0;                   /* starting code */
  sym = 0;                    /* starting code symbol */
  len = min;                  /* starting code length */
  next = table_index;              /* current table to fill in */
  curr = root;                /* current table index bits */
  drop = 0;                   /* current bits to drop from code for index */
  low = -1;                   /* trigger new sub-table when len > root */
  used = 1 << root;          /* use root table entries */
  mask = used - 1;            /* mask for comparing low */

  /* check available table space */
  if ((type === LENS && used > ENOUGH_LENS) ||
    (type === DISTS && used > ENOUGH_DISTS)) {
    return 1;
  }

  /* process all codes and make table entries */
  for (;;) {
    /* create table entry */
    here_bits = len - drop;
    if (work[sym] < end) {
      here_op = 0;
      here_val = work[sym];
    }
    else if (work[sym] > end) {
      here_op = extra[extra_index + work[sym]];
      here_val = base[base_index + work[sym]];
    }
    else {
      here_op = 32 + 64;         /* end of block */
      here_val = 0;
    }

    /* replicate for those indices with low len bits equal to huff */
    incr = 1 << (len - drop);
    fill = 1 << curr;
    min = fill;                 /* save offset to next table */
    do {
      fill -= incr;
      table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val |0;
    } while (fill !== 0);

    /* backwards increment the len-bit code huff */
    incr = 1 << (len - 1);
    while (huff & incr) {
      incr >>= 1;
    }
    if (incr !== 0) {
      huff &= incr - 1;
      huff += incr;
    } else {
      huff = 0;
    }

    /* go to next symbol, update count, len */
    sym++;
    if (--count[len] === 0) {
      if (len === max) { break; }
      len = lens[lens_index + work[sym]];
    }

    /* create new sub-table if needed */
    if (len > root && (huff & mask) !== low) {
      /* if first time, transition to sub-tables */
      if (drop === 0) {
        drop = root;
      }

      /* increment past last table */
      next += min;            /* here min is 1 << curr */

      /* determine length of next table */
      curr = len - drop;
      left = 1 << curr;
      while (curr + drop < max) {
        left -= count[curr + drop];
        if (left <= 0) { break; }
        curr++;
        left <<= 1;
      }

      /* check for enough space */
      used += 1 << curr;
      if ((type === LENS && used > ENOUGH_LENS) ||
        (type === DISTS && used > ENOUGH_DISTS)) {
        return 1;
      }

      /* point entry in root table to sub-table */
      low = huff & mask;
      /*table.op[low] = curr;
      table.bits[low] = root;
      table.val[low] = next - opts.table_index;*/
      table[low] = (root << 24) | (curr << 16) | (next - table_index) |0;
    }
  }

  /* fill in remaining table entry if code is incomplete (guaranteed to have
   at most one remaining entry, since if the code is incomplete, the
   maximum code length that was allowed to get this far is one bit) */
  if (huff !== 0) {
    //table.op[next + huff] = 64;            /* invalid code marker */
    //table.bits[next + huff] = len - drop;
    //table.val[next + huff] = 0;
    table[next + huff] = ((len - drop) << 24) | (64 << 16) |0;
  }

  /* set return parameters */
  //opts.table_index += used;
  opts.bits = root;
  return 0;
};

},{"../utils/common":34}],44:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

module.exports = {
  2:      'need dictionary',     /* Z_NEED_DICT       2  */
  1:      'stream end',          /* Z_STREAM_END      1  */
  0:      '',                    /* Z_OK              0  */
  '-1':   'file error',          /* Z_ERRNO         (-1) */
  '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
  '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
  '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
  '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
  '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
};

},{}],45:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

/* eslint-disable space-unary-ops */

var utils = require('../utils/common');

/* Public constants ==========================================================*/
/* ===========================================================================*/


//var Z_FILTERED          = 1;
//var Z_HUFFMAN_ONLY      = 2;
//var Z_RLE               = 3;
var Z_FIXED               = 4;
//var Z_DEFAULT_STRATEGY  = 0;

/* Possible values of the data_type field (though see inflate()) */
var Z_BINARY              = 0;
var Z_TEXT                = 1;
//var Z_ASCII             = 1; // = Z_TEXT
var Z_UNKNOWN             = 2;

/*============================================================================*/


function zero(buf) { var len = buf.length; while (--len >= 0) { buf[len] = 0; } }

// From zutil.h

var STORED_BLOCK = 0;
var STATIC_TREES = 1;
var DYN_TREES    = 2;
/* The three kinds of block type */

var MIN_MATCH    = 3;
var MAX_MATCH    = 258;
/* The minimum and maximum match lengths */

// From deflate.h
/* ===========================================================================
 * Internal compression state.
 */

var LENGTH_CODES  = 29;
/* number of length codes, not counting the special END_BLOCK code */

var LITERALS      = 256;
/* number of literal bytes 0..255 */

var L_CODES       = LITERALS + 1 + LENGTH_CODES;
/* number of Literal or Length codes, including the END_BLOCK code */

var D_CODES       = 30;
/* number of distance codes */

var BL_CODES      = 19;
/* number of codes used to transfer the bit lengths */

var HEAP_SIZE     = 2 * L_CODES + 1;
/* maximum heap size */

var MAX_BITS      = 15;
/* All codes must not exceed MAX_BITS bits */

var Buf_size      = 16;
/* size of bit buffer in bi_buf */


/* ===========================================================================
 * Constants
 */

var MAX_BL_BITS = 7;
/* Bit length codes must not exceed MAX_BL_BITS bits */

var END_BLOCK   = 256;
/* end of block literal code */

var REP_3_6     = 16;
/* repeat previous bit length 3-6 times (2 bits of repeat count) */

var REPZ_3_10   = 17;
/* repeat a zero length 3-10 times  (3 bits of repeat count) */

var REPZ_11_138 = 18;
/* repeat a zero length 11-138 times  (7 bits of repeat count) */

/* eslint-disable comma-spacing,array-bracket-spacing */
var extra_lbits =   /* extra bits for each length code */
  [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];

var extra_dbits =   /* extra bits for each distance code */
  [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];

var extra_blbits =  /* extra bits for each bit length code */
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7];

var bl_order =
  [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
/* eslint-enable comma-spacing,array-bracket-spacing */

/* The lengths of the bit length codes are sent in order of decreasing
 * probability, to avoid transmitting the lengths for unused bit length codes.
 */

/* ===========================================================================
 * Local data. These are initialized only once.
 */

// We pre-fill arrays with 0 to avoid uninitialized gaps

var DIST_CODE_LEN = 512; /* see definition of array dist_code below */

// !!!! Use flat array instead of structure, Freq = i*2, Len = i*2+1
var static_ltree  = new Array((L_CODES + 2) * 2);
zero(static_ltree);
/* The static literal tree. Since the bit lengths are imposed, there is no
 * need for the L_CODES extra codes used during heap construction. However
 * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
 * below).
 */

var static_dtree  = new Array(D_CODES * 2);
zero(static_dtree);
/* The static distance tree. (Actually a trivial tree since all codes use
 * 5 bits.)
 */

var _dist_code    = new Array(DIST_CODE_LEN);
zero(_dist_code);
/* Distance codes. The first 256 values correspond to the distances
 * 3 .. 258, the last 256 values correspond to the top 8 bits of
 * the 15 bit distances.
 */

var _length_code  = new Array(MAX_MATCH - MIN_MATCH + 1);
zero(_length_code);
/* length code for each normalized match length (0 == MIN_MATCH) */

var base_length   = new Array(LENGTH_CODES);
zero(base_length);
/* First normalized length for each code (0 = MIN_MATCH) */

var base_dist     = new Array(D_CODES);
zero(base_dist);
/* First normalized distance for each code (0 = distance of 1) */


function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {

  this.static_tree  = static_tree;  /* static tree or NULL */
  this.extra_bits   = extra_bits;   /* extra bits for each code or NULL */
  this.extra_base   = extra_base;   /* base index for extra_bits */
  this.elems        = elems;        /* max number of elements in the tree */
  this.max_length   = max_length;   /* max bit length for the codes */

  // show if `static_tree` has data or dummy - needed for monomorphic objects
  this.has_stree    = static_tree && static_tree.length;
}


var static_l_desc;
var static_d_desc;
var static_bl_desc;


function TreeDesc(dyn_tree, stat_desc) {
  this.dyn_tree = dyn_tree;     /* the dynamic tree */
  this.max_code = 0;            /* largest code with non zero frequency */
  this.stat_desc = stat_desc;   /* the corresponding static tree */
}



function d_code(dist) {
  return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
}


/* ===========================================================================
 * Output a short LSB first on the stream.
 * IN assertion: there is enough room in pendingBuf.
 */
function put_short(s, w) {
//    put_byte(s, (uch)((w) & 0xff));
//    put_byte(s, (uch)((ush)(w) >> 8));
  s.pending_buf[s.pending++] = (w) & 0xff;
  s.pending_buf[s.pending++] = (w >>> 8) & 0xff;
}


/* ===========================================================================
 * Send a value on a given number of bits.
 * IN assertion: length <= 16 and value fits in length bits.
 */
function send_bits(s, value, length) {
  if (s.bi_valid > (Buf_size - length)) {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    put_short(s, s.bi_buf);
    s.bi_buf = value >> (Buf_size - s.bi_valid);
    s.bi_valid += length - Buf_size;
  } else {
    s.bi_buf |= (value << s.bi_valid) & 0xffff;
    s.bi_valid += length;
  }
}


function send_code(s, c, tree) {
  send_bits(s, tree[c * 2]/*.Code*/, tree[c * 2 + 1]/*.Len*/);
}


/* ===========================================================================
 * Reverse the first len bits of a code, using straightforward code (a faster
 * method would use a table)
 * IN assertion: 1 <= len <= 15
 */
function bi_reverse(code, len) {
  var res = 0;
  do {
    res |= code & 1;
    code >>>= 1;
    res <<= 1;
  } while (--len > 0);
  return res >>> 1;
}


/* ===========================================================================
 * Flush the bit buffer, keeping at most 7 bits in it.
 */
function bi_flush(s) {
  if (s.bi_valid === 16) {
    put_short(s, s.bi_buf);
    s.bi_buf = 0;
    s.bi_valid = 0;

  } else if (s.bi_valid >= 8) {
    s.pending_buf[s.pending++] = s.bi_buf & 0xff;
    s.bi_buf >>= 8;
    s.bi_valid -= 8;
  }
}


/* ===========================================================================
 * Compute the optimal bit lengths for a tree and update the total bit length
 * for the current block.
 * IN assertion: the fields freq and dad are set, heap[heap_max] and
 *    above are the tree nodes sorted by increasing frequency.
 * OUT assertions: the field len is set to the optimal bit length, the
 *     array bl_count contains the frequencies for each bit length.
 *     The length opt_len is updated; static_len is also updated if stree is
 *     not null.
 */
function gen_bitlen(s, desc)
//    deflate_state *s;
//    tree_desc *desc;    /* the tree descriptor */
{
  var tree            = desc.dyn_tree;
  var max_code        = desc.max_code;
  var stree           = desc.stat_desc.static_tree;
  var has_stree       = desc.stat_desc.has_stree;
  var extra           = desc.stat_desc.extra_bits;
  var base            = desc.stat_desc.extra_base;
  var max_length      = desc.stat_desc.max_length;
  var h;              /* heap index */
  var n, m;           /* iterate over the tree elements */
  var bits;           /* bit length */
  var xbits;          /* extra bits */
  var f;              /* frequency */
  var overflow = 0;   /* number of elements with bit length too large */

  for (bits = 0; bits <= MAX_BITS; bits++) {
    s.bl_count[bits] = 0;
  }

  /* In a first pass, compute the optimal bit lengths (which may
   * overflow in the case of the bit length tree).
   */
  tree[s.heap[s.heap_max] * 2 + 1]/*.Len*/ = 0; /* root of the heap */

  for (h = s.heap_max + 1; h < HEAP_SIZE; h++) {
    n = s.heap[h];
    bits = tree[tree[n * 2 + 1]/*.Dad*/ * 2 + 1]/*.Len*/ + 1;
    if (bits > max_length) {
      bits = max_length;
      overflow++;
    }
    tree[n * 2 + 1]/*.Len*/ = bits;
    /* We overwrite tree[n].Dad which is no longer needed */

    if (n > max_code) { continue; } /* not a leaf node */

    s.bl_count[bits]++;
    xbits = 0;
    if (n >= base) {
      xbits = extra[n - base];
    }
    f = tree[n * 2]/*.Freq*/;
    s.opt_len += f * (bits + xbits);
    if (has_stree) {
      s.static_len += f * (stree[n * 2 + 1]/*.Len*/ + xbits);
    }
  }
  if (overflow === 0) { return; }

  // Trace((stderr,"\nbit length overflow\n"));
  /* This happens for example on obj2 and pic of the Calgary corpus */

  /* Find the first bit length which could increase: */
  do {
    bits = max_length - 1;
    while (s.bl_count[bits] === 0) { bits--; }
    s.bl_count[bits]--;      /* move one leaf down the tree */
    s.bl_count[bits + 1] += 2; /* move one overflow item as its brother */
    s.bl_count[max_length]--;
    /* The brother of the overflow item also moves one step up,
     * but this does not affect bl_count[max_length]
     */
    overflow -= 2;
  } while (overflow > 0);

  /* Now recompute all bit lengths, scanning in increasing frequency.
   * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
   * lengths instead of fixing only the wrong ones. This idea is taken
   * from 'ar' written by Haruhiko Okumura.)
   */
  for (bits = max_length; bits !== 0; bits--) {
    n = s.bl_count[bits];
    while (n !== 0) {
      m = s.heap[--h];
      if (m > max_code) { continue; }
      if (tree[m * 2 + 1]/*.Len*/ !== bits) {
        // Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
        s.opt_len += (bits - tree[m * 2 + 1]/*.Len*/) * tree[m * 2]/*.Freq*/;
        tree[m * 2 + 1]/*.Len*/ = bits;
      }
      n--;
    }
  }
}


/* ===========================================================================
 * Generate the codes for a given tree and bit counts (which need not be
 * optimal).
 * IN assertion: the array bl_count contains the bit length statistics for
 * the given tree and the field len is set for all tree elements.
 * OUT assertion: the field code is set for all tree elements of non
 *     zero code length.
 */
function gen_codes(tree, max_code, bl_count)
//    ct_data *tree;             /* the tree to decorate */
//    int max_code;              /* largest code with non zero frequency */
//    ushf *bl_count;            /* number of codes at each bit length */
{
  var next_code = new Array(MAX_BITS + 1); /* next code value for each bit length */
  var code = 0;              /* running code value */
  var bits;                  /* bit index */
  var n;                     /* code index */

  /* The distribution counts are first used to generate the code values
   * without bit reversal.
   */
  for (bits = 1; bits <= MAX_BITS; bits++) {
    next_code[bits] = code = (code + bl_count[bits - 1]) << 1;
  }
  /* Check that the bit counts in bl_count are consistent. The last code
   * must be all ones.
   */
  //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
  //        "inconsistent bit counts");
  //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

  for (n = 0;  n <= max_code; n++) {
    var len = tree[n * 2 + 1]/*.Len*/;
    if (len === 0) { continue; }
    /* Now reverse the bits */
    tree[n * 2]/*.Code*/ = bi_reverse(next_code[len]++, len);

    //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
    //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
  }
}


/* ===========================================================================
 * Initialize the various 'constant' tables.
 */
function tr_static_init() {
  var n;        /* iterates over tree elements */
  var bits;     /* bit counter */
  var length;   /* length value */
  var code;     /* code value */
  var dist;     /* distance index */
  var bl_count = new Array(MAX_BITS + 1);
  /* number of codes at each bit length for an optimal tree */

  // do check in _tr_init()
  //if (static_init_done) return;

  /* For some embedded targets, global variables are not initialized: */
/*#ifdef NO_INIT_GLOBAL_POINTERS
  static_l_desc.static_tree = static_ltree;
  static_l_desc.extra_bits = extra_lbits;
  static_d_desc.static_tree = static_dtree;
  static_d_desc.extra_bits = extra_dbits;
  static_bl_desc.extra_bits = extra_blbits;
#endif*/

  /* Initialize the mapping length (0..255) -> length code (0..28) */
  length = 0;
  for (code = 0; code < LENGTH_CODES - 1; code++) {
    base_length[code] = length;
    for (n = 0; n < (1 << extra_lbits[code]); n++) {
      _length_code[length++] = code;
    }
  }
  //Assert (length == 256, "tr_static_init: length != 256");
  /* Note that the length 255 (match length 258) can be represented
   * in two different ways: code 284 + 5 bits or code 285, so we
   * overwrite length_code[255] to use the best encoding:
   */
  _length_code[length - 1] = code;

  /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
  dist = 0;
  for (code = 0; code < 16; code++) {
    base_dist[code] = dist;
    for (n = 0; n < (1 << extra_dbits[code]); n++) {
      _dist_code[dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: dist != 256");
  dist >>= 7; /* from now on, all distances are divided by 128 */
  for (; code < D_CODES; code++) {
    base_dist[code] = dist << 7;
    for (n = 0; n < (1 << (extra_dbits[code] - 7)); n++) {
      _dist_code[256 + dist++] = code;
    }
  }
  //Assert (dist == 256, "tr_static_init: 256+dist != 512");

  /* Construct the codes of the static literal tree */
  for (bits = 0; bits <= MAX_BITS; bits++) {
    bl_count[bits] = 0;
  }

  n = 0;
  while (n <= 143) {
    static_ltree[n * 2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  while (n <= 255) {
    static_ltree[n * 2 + 1]/*.Len*/ = 9;
    n++;
    bl_count[9]++;
  }
  while (n <= 279) {
    static_ltree[n * 2 + 1]/*.Len*/ = 7;
    n++;
    bl_count[7]++;
  }
  while (n <= 287) {
    static_ltree[n * 2 + 1]/*.Len*/ = 8;
    n++;
    bl_count[8]++;
  }
  /* Codes 286 and 287 do not exist, but we must include them in the
   * tree construction to get a canonical Huffman tree (longest code
   * all ones)
   */
  gen_codes(static_ltree, L_CODES + 1, bl_count);

  /* The static distance tree is trivial: */
  for (n = 0; n < D_CODES; n++) {
    static_dtree[n * 2 + 1]/*.Len*/ = 5;
    static_dtree[n * 2]/*.Code*/ = bi_reverse(n, 5);
  }

  // Now data ready and we can init static trees
  static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
  static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0,          D_CODES, MAX_BITS);
  static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0,         BL_CODES, MAX_BL_BITS);

  //static_init_done = true;
}


/* ===========================================================================
 * Initialize a new block.
 */
function init_block(s) {
  var n; /* iterates over tree elements */

  /* Initialize the trees. */
  for (n = 0; n < L_CODES;  n++) { s.dyn_ltree[n * 2]/*.Freq*/ = 0; }
  for (n = 0; n < D_CODES;  n++) { s.dyn_dtree[n * 2]/*.Freq*/ = 0; }
  for (n = 0; n < BL_CODES; n++) { s.bl_tree[n * 2]/*.Freq*/ = 0; }

  s.dyn_ltree[END_BLOCK * 2]/*.Freq*/ = 1;
  s.opt_len = s.static_len = 0;
  s.last_lit = s.matches = 0;
}


/* ===========================================================================
 * Flush the bit buffer and align the output on a byte boundary
 */
function bi_windup(s)
{
  if (s.bi_valid > 8) {
    put_short(s, s.bi_buf);
  } else if (s.bi_valid > 0) {
    //put_byte(s, (Byte)s->bi_buf);
    s.pending_buf[s.pending++] = s.bi_buf;
  }
  s.bi_buf = 0;
  s.bi_valid = 0;
}

/* ===========================================================================
 * Copy a stored block, storing first the length and its
 * one's complement if requested.
 */
function copy_block(s, buf, len, header)
//DeflateState *s;
//charf    *buf;    /* the input data */
//unsigned len;     /* its length */
//int      header;  /* true if block header must be written */
{
  bi_windup(s);        /* align on byte boundary */

  if (header) {
    put_short(s, len);
    put_short(s, ~len);
  }
//  while (len--) {
//    put_byte(s, *buf++);
//  }
  utils.arraySet(s.pending_buf, s.window, buf, len, s.pending);
  s.pending += len;
}

/* ===========================================================================
 * Compares to subtrees, using the tree depth as tie breaker when
 * the subtrees have equal frequency. This minimizes the worst case length.
 */
function smaller(tree, n, m, depth) {
  var _n2 = n * 2;
  var _m2 = m * 2;
  return (tree[_n2]/*.Freq*/ < tree[_m2]/*.Freq*/ ||
         (tree[_n2]/*.Freq*/ === tree[_m2]/*.Freq*/ && depth[n] <= depth[m]));
}

/* ===========================================================================
 * Restore the heap property by moving down the tree starting at node k,
 * exchanging a node with the smallest of its two sons if necessary, stopping
 * when the heap property is re-established (each father smaller than its
 * two sons).
 */
function pqdownheap(s, tree, k)
//    deflate_state *s;
//    ct_data *tree;  /* the tree to restore */
//    int k;               /* node to move down */
{
  var v = s.heap[k];
  var j = k << 1;  /* left son of k */
  while (j <= s.heap_len) {
    /* Set j to the smallest of the two sons: */
    if (j < s.heap_len &&
      smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
      j++;
    }
    /* Exit if v is smaller than both sons */
    if (smaller(tree, v, s.heap[j], s.depth)) { break; }

    /* Exchange v with the smallest son */
    s.heap[k] = s.heap[j];
    k = j;

    /* And continue down the tree, setting j to the left son of k */
    j <<= 1;
  }
  s.heap[k] = v;
}


// inlined manually
// var SMALLEST = 1;

/* ===========================================================================
 * Send the block data compressed using the given Huffman trees
 */
function compress_block(s, ltree, dtree)
//    deflate_state *s;
//    const ct_data *ltree; /* literal tree */
//    const ct_data *dtree; /* distance tree */
{
  var dist;           /* distance of matched string */
  var lc;             /* match length or unmatched char (if dist == 0) */
  var lx = 0;         /* running index in l_buf */
  var code;           /* the code to send */
  var extra;          /* number of extra bits to send */

  if (s.last_lit !== 0) {
    do {
      dist = (s.pending_buf[s.d_buf + lx * 2] << 8) | (s.pending_buf[s.d_buf + lx * 2 + 1]);
      lc = s.pending_buf[s.l_buf + lx];
      lx++;

      if (dist === 0) {
        send_code(s, lc, ltree); /* send a literal byte */
        //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
      } else {
        /* Here, lc is the match length - MIN_MATCH */
        code = _length_code[lc];
        send_code(s, code + LITERALS + 1, ltree); /* send the length code */
        extra = extra_lbits[code];
        if (extra !== 0) {
          lc -= base_length[code];
          send_bits(s, lc, extra);       /* send the extra length bits */
        }
        dist--; /* dist is now the match distance - 1 */
        code = d_code(dist);
        //Assert (code < D_CODES, "bad d_code");

        send_code(s, code, dtree);       /* send the distance code */
        extra = extra_dbits[code];
        if (extra !== 0) {
          dist -= base_dist[code];
          send_bits(s, dist, extra);   /* send the extra distance bits */
        }
      } /* literal or match pair ? */

      /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
      //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
      //       "pendingBuf overflow");

    } while (lx < s.last_lit);
  }

  send_code(s, END_BLOCK, ltree);
}


/* ===========================================================================
 * Construct one Huffman tree and assigns the code bit strings and lengths.
 * Update the total bit length for the current block.
 * IN assertion: the field freq is set for all tree elements.
 * OUT assertions: the fields len and code are set to the optimal bit length
 *     and corresponding code. The length opt_len is updated; static_len is
 *     also updated if stree is not null. The field max_code is set.
 */
function build_tree(s, desc)
//    deflate_state *s;
//    tree_desc *desc; /* the tree descriptor */
{
  var tree     = desc.dyn_tree;
  var stree    = desc.stat_desc.static_tree;
  var has_stree = desc.stat_desc.has_stree;
  var elems    = desc.stat_desc.elems;
  var n, m;          /* iterate over heap elements */
  var max_code = -1; /* largest code with non zero frequency */
  var node;          /* new node being created */

  /* Construct the initial heap, with least frequent element in
   * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
   * heap[0] is not used.
   */
  s.heap_len = 0;
  s.heap_max = HEAP_SIZE;

  for (n = 0; n < elems; n++) {
    if (tree[n * 2]/*.Freq*/ !== 0) {
      s.heap[++s.heap_len] = max_code = n;
      s.depth[n] = 0;

    } else {
      tree[n * 2 + 1]/*.Len*/ = 0;
    }
  }

  /* The pkzip format requires that at least one distance code exists,
   * and that at least one bit should be sent even if there is only one
   * possible code. So to avoid special checks later on we force at least
   * two codes of non zero frequency.
   */
  while (s.heap_len < 2) {
    node = s.heap[++s.heap_len] = (max_code < 2 ? ++max_code : 0);
    tree[node * 2]/*.Freq*/ = 1;
    s.depth[node] = 0;
    s.opt_len--;

    if (has_stree) {
      s.static_len -= stree[node * 2 + 1]/*.Len*/;
    }
    /* node is 0 or 1 so it does not have extra bits */
  }
  desc.max_code = max_code;

  /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
   * establish sub-heaps of increasing lengths:
   */
  for (n = (s.heap_len >> 1/*int /2*/); n >= 1; n--) { pqdownheap(s, tree, n); }

  /* Construct the Huffman tree by repeatedly combining the least two
   * frequent nodes.
   */
  node = elems;              /* next internal node of the tree */
  do {
    //pqremove(s, tree, n);  /* n = node of least frequency */
    /*** pqremove ***/
    n = s.heap[1/*SMALLEST*/];
    s.heap[1/*SMALLEST*/] = s.heap[s.heap_len--];
    pqdownheap(s, tree, 1/*SMALLEST*/);
    /***/

    m = s.heap[1/*SMALLEST*/]; /* m = node of next least frequency */

    s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
    s.heap[--s.heap_max] = m;

    /* Create a new node father of n and m */
    tree[node * 2]/*.Freq*/ = tree[n * 2]/*.Freq*/ + tree[m * 2]/*.Freq*/;
    s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
    tree[n * 2 + 1]/*.Dad*/ = tree[m * 2 + 1]/*.Dad*/ = node;

    /* and insert the new node in the heap */
    s.heap[1/*SMALLEST*/] = node++;
    pqdownheap(s, tree, 1/*SMALLEST*/);

  } while (s.heap_len >= 2);

  s.heap[--s.heap_max] = s.heap[1/*SMALLEST*/];

  /* At this point, the fields freq and dad are set. We can now
   * generate the bit lengths.
   */
  gen_bitlen(s, desc);

  /* The field len is now set, we can generate the bit codes */
  gen_codes(tree, max_code, s.bl_count);
}


/* ===========================================================================
 * Scan a literal or distance tree to determine the frequencies of the codes
 * in the bit length tree.
 */
function scan_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree;   /* the tree to be scanned */
//    int max_code;    /* and its largest code of non zero frequency */
{
  var n;                     /* iterates over all tree elements */
  var prevlen = -1;          /* last emitted length */
  var curlen;                /* length of current code */

  var nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */

  var count = 0;             /* repeat count of the current code */
  var max_count = 7;         /* max repeat count */
  var min_count = 4;         /* min repeat count */

  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }
  tree[(max_code + 1) * 2 + 1]/*.Len*/ = 0xffff; /* guard */

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      s.bl_tree[curlen * 2]/*.Freq*/ += count;

    } else if (curlen !== 0) {

      if (curlen !== prevlen) { s.bl_tree[curlen * 2]/*.Freq*/++; }
      s.bl_tree[REP_3_6 * 2]/*.Freq*/++;

    } else if (count <= 10) {
      s.bl_tree[REPZ_3_10 * 2]/*.Freq*/++;

    } else {
      s.bl_tree[REPZ_11_138 * 2]/*.Freq*/++;
    }

    count = 0;
    prevlen = curlen;

    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}


/* ===========================================================================
 * Send a literal or distance tree in compressed form, using the codes in
 * bl_tree.
 */
function send_tree(s, tree, max_code)
//    deflate_state *s;
//    ct_data *tree; /* the tree to be scanned */
//    int max_code;       /* and its largest code of non zero frequency */
{
  var n;                     /* iterates over all tree elements */
  var prevlen = -1;          /* last emitted length */
  var curlen;                /* length of current code */

  var nextlen = tree[0 * 2 + 1]/*.Len*/; /* length of next code */

  var count = 0;             /* repeat count of the current code */
  var max_count = 7;         /* max repeat count */
  var min_count = 4;         /* min repeat count */

  /* tree[max_code+1].Len = -1; */  /* guard already set */
  if (nextlen === 0) {
    max_count = 138;
    min_count = 3;
  }

  for (n = 0; n <= max_code; n++) {
    curlen = nextlen;
    nextlen = tree[(n + 1) * 2 + 1]/*.Len*/;

    if (++count < max_count && curlen === nextlen) {
      continue;

    } else if (count < min_count) {
      do { send_code(s, curlen, s.bl_tree); } while (--count !== 0);

    } else if (curlen !== 0) {
      if (curlen !== prevlen) {
        send_code(s, curlen, s.bl_tree);
        count--;
      }
      //Assert(count >= 3 && count <= 6, " 3_6?");
      send_code(s, REP_3_6, s.bl_tree);
      send_bits(s, count - 3, 2);

    } else if (count <= 10) {
      send_code(s, REPZ_3_10, s.bl_tree);
      send_bits(s, count - 3, 3);

    } else {
      send_code(s, REPZ_11_138, s.bl_tree);
      send_bits(s, count - 11, 7);
    }

    count = 0;
    prevlen = curlen;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;

    } else if (curlen === nextlen) {
      max_count = 6;
      min_count = 3;

    } else {
      max_count = 7;
      min_count = 4;
    }
  }
}


/* ===========================================================================
 * Construct the Huffman tree for the bit lengths and return the index in
 * bl_order of the last bit length code to send.
 */
function build_bl_tree(s) {
  var max_blindex;  /* index of last bit length code of non zero freq */

  /* Determine the bit length frequencies for literal and distance trees */
  scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
  scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

  /* Build the bit length tree: */
  build_tree(s, s.bl_desc);
  /* opt_len now includes the length of the tree representations, except
   * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
   */

  /* Determine the number of bit length codes to send. The pkzip format
   * requires that at least 4 bit length codes be sent. (appnote.txt says
   * 3 but the actual value used is 4.)
   */
  for (max_blindex = BL_CODES - 1; max_blindex >= 3; max_blindex--) {
    if (s.bl_tree[bl_order[max_blindex] * 2 + 1]/*.Len*/ !== 0) {
      break;
    }
  }
  /* Update opt_len to include the bit length tree and counts */
  s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
  //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
  //        s->opt_len, s->static_len));

  return max_blindex;
}


/* ===========================================================================
 * Send the header for a block using dynamic Huffman trees: the counts, the
 * lengths of the bit length codes, the literal tree and the distance tree.
 * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
 */
function send_all_trees(s, lcodes, dcodes, blcodes)
//    deflate_state *s;
//    int lcodes, dcodes, blcodes; /* number of codes for each tree */
{
  var rank;                    /* index in bl_order */

  //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
  //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
  //        "too many codes");
  //Tracev((stderr, "\nbl counts: "));
  send_bits(s, lcodes - 257, 5); /* not +255 as stated in appnote.txt */
  send_bits(s, dcodes - 1,   5);
  send_bits(s, blcodes - 4,  4); /* not -3 as stated in appnote.txt */
  for (rank = 0; rank < blcodes; rank++) {
    //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
    send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1]/*.Len*/, 3);
  }
  //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_ltree, lcodes - 1); /* literal tree */
  //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

  send_tree(s, s.dyn_dtree, dcodes - 1); /* distance tree */
  //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
}


/* ===========================================================================
 * Check if the data type is TEXT or BINARY, using the following algorithm:
 * - TEXT if the two conditions below are satisfied:
 *    a) There are no non-portable control characters belonging to the
 *       "black list" (0..6, 14..25, 28..31).
 *    b) There is at least one printable character belonging to the
 *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
 * - BINARY otherwise.
 * - The following partially-portable control characters form a
 *   "gray list" that is ignored in this detection algorithm:
 *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
 * IN assertion: the fields Freq of dyn_ltree are set.
 */
function detect_data_type(s) {
  /* black_mask is the bit mask of black-listed bytes
   * set bits 0..6, 14..25, and 28..31
   * 0xf3ffc07f = binary 11110011111111111100000001111111
   */
  var black_mask = 0xf3ffc07f;
  var n;

  /* Check for non-textual ("black-listed") bytes. */
  for (n = 0; n <= 31; n++, black_mask >>>= 1) {
    if ((black_mask & 1) && (s.dyn_ltree[n * 2]/*.Freq*/ !== 0)) {
      return Z_BINARY;
    }
  }

  /* Check for textual ("white-listed") bytes. */
  if (s.dyn_ltree[9 * 2]/*.Freq*/ !== 0 || s.dyn_ltree[10 * 2]/*.Freq*/ !== 0 ||
      s.dyn_ltree[13 * 2]/*.Freq*/ !== 0) {
    return Z_TEXT;
  }
  for (n = 32; n < LITERALS; n++) {
    if (s.dyn_ltree[n * 2]/*.Freq*/ !== 0) {
      return Z_TEXT;
    }
  }

  /* There are no "black-listed" or "white-listed" bytes:
   * this stream either is empty or has tolerated ("gray-listed") bytes only.
   */
  return Z_BINARY;
}


var static_init_done = false;

/* ===========================================================================
 * Initialize the tree data structures for a new zlib stream.
 */
function _tr_init(s)
{

  if (!static_init_done) {
    tr_static_init();
    static_init_done = true;
  }

  s.l_desc  = new TreeDesc(s.dyn_ltree, static_l_desc);
  s.d_desc  = new TreeDesc(s.dyn_dtree, static_d_desc);
  s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);

  s.bi_buf = 0;
  s.bi_valid = 0;

  /* Initialize the first block of the first file: */
  init_block(s);
}


/* ===========================================================================
 * Send a stored block
 */
function _tr_stored_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);    /* send block type */
  copy_block(s, buf, stored_len, true); /* with header */
}


/* ===========================================================================
 * Send one empty static block to give enough lookahead for inflate.
 * This takes 10 bits, of which 7 may remain in the bit buffer.
 */
function _tr_align(s) {
  send_bits(s, STATIC_TREES << 1, 3);
  send_code(s, END_BLOCK, static_ltree);
  bi_flush(s);
}


/* ===========================================================================
 * Determine the best encoding for the current block: dynamic trees, static
 * trees or store, and output the encoded block to the zip file.
 */
function _tr_flush_block(s, buf, stored_len, last)
//DeflateState *s;
//charf *buf;       /* input block, or NULL if too old */
//ulg stored_len;   /* length of input block */
//int last;         /* one if this is the last block for a file */
{
  var opt_lenb, static_lenb;  /* opt_len and static_len in bytes */
  var max_blindex = 0;        /* index of last bit length code of non zero freq */

  /* Build the Huffman trees unless a stored block is forced */
  if (s.level > 0) {

    /* Check if the file is binary or text */
    if (s.strm.data_type === Z_UNKNOWN) {
      s.strm.data_type = detect_data_type(s);
    }

    /* Construct the literal and distance trees */
    build_tree(s, s.l_desc);
    // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));

    build_tree(s, s.d_desc);
    // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
    //        s->static_len));
    /* At this point, opt_len and static_len are the total bit lengths of
     * the compressed block data, excluding the tree representations.
     */

    /* Build the bit length tree for the above two trees, and get the index
     * in bl_order of the last bit length code to send.
     */
    max_blindex = build_bl_tree(s);

    /* Determine the best encoding. Compute the block lengths in bytes. */
    opt_lenb = (s.opt_len + 3 + 7) >>> 3;
    static_lenb = (s.static_len + 3 + 7) >>> 3;

    // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
    //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
    //        s->last_lit));

    if (static_lenb <= opt_lenb) { opt_lenb = static_lenb; }

  } else {
    // Assert(buf != (char*)0, "lost buf");
    opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
  }

  if ((stored_len + 4 <= opt_lenb) && (buf !== -1)) {
    /* 4: two words for the lengths */

    /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
     * Otherwise we can't have processed more than WSIZE input bytes since
     * the last block flush, because compression would have been
     * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
     * transform a block into a stored block.
     */
    _tr_stored_block(s, buf, stored_len, last);

  } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {

    send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
    compress_block(s, static_ltree, static_dtree);

  } else {
    send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
    send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
    compress_block(s, s.dyn_ltree, s.dyn_dtree);
  }
  // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
  /* The above check is made mod 2^32, for files larger than 512 MB
   * and uLong implemented on 32 bits.
   */
  init_block(s);

  if (last) {
    bi_windup(s);
  }
  // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
  //       s->compressed_len-7*last));
}

/* ===========================================================================
 * Save the match info and tally the frequency counts. Return true if
 * the current block must be flushed.
 */
function _tr_tally(s, dist, lc)
//    deflate_state *s;
//    unsigned dist;  /* distance of matched string */
//    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */
{
  //var out_length, in_length, dcode;

  s.pending_buf[s.d_buf + s.last_lit * 2]     = (dist >>> 8) & 0xff;
  s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff;

  s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff;
  s.last_lit++;

  if (dist === 0) {
    /* lc is the unmatched char */
    s.dyn_ltree[lc * 2]/*.Freq*/++;
  } else {
    s.matches++;
    /* Here, lc is the match length - MIN_MATCH */
    dist--;             /* dist = match distance - 1 */
    //Assert((ush)dist < (ush)MAX_DIST(s) &&
    //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
    //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

    s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]/*.Freq*/++;
    s.dyn_dtree[d_code(dist) * 2]/*.Freq*/++;
  }

// (!) This block is disabled in zlib defaults,
// don't enable it for binary compatibility

//#ifdef TRUNCATE_BLOCK
//  /* Try to guess if it is profitable to stop the current block here */
//  if ((s.last_lit & 0x1fff) === 0 && s.level > 2) {
//    /* Compute an upper bound for the compressed length */
//    out_length = s.last_lit*8;
//    in_length = s.strstart - s.block_start;
//
//    for (dcode = 0; dcode < D_CODES; dcode++) {
//      out_length += s.dyn_dtree[dcode*2]/*.Freq*/ * (5 + extra_dbits[dcode]);
//    }
//    out_length >>>= 3;
//    //Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
//    //       s->last_lit, in_length, out_length,
//    //       100L - out_length*100L/in_length));
//    if (s.matches < (s.last_lit>>1)/*int /2*/ && out_length < (in_length>>1)/*int /2*/) {
//      return true;
//    }
//  }
//#endif

  return (s.last_lit === s.lit_bufsize - 1);
  /* We avoid equality with lit_bufsize because of wraparound at 64K
   * on 16 bit machines and because stored blocks are restricted to
   * 64K-1 bytes.
   */
}

exports._tr_init  = _tr_init;
exports._tr_stored_block = _tr_stored_block;
exports._tr_flush_block  = _tr_flush_block;
exports._tr_tally = _tr_tally;
exports._tr_align = _tr_align;

},{"../utils/common":34}],46:[function(require,module,exports){
'use strict';

// (C) 1995-2013 Jean-loup Gailly and Mark Adler
// (C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//   claim that you wrote the original software. If you use this software
//   in a product, an acknowledgment in the product documentation would be
//   appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//   misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.

function ZStream() {
  /* next input byte */
  this.input = null; // JS specific, because we have no pointers
  this.next_in = 0;
  /* number of bytes available at input */
  this.avail_in = 0;
  /* total number of input bytes read so far */
  this.total_in = 0;
  /* next output byte should be put there */
  this.output = null; // JS specific, because we have no pointers
  this.next_out = 0;
  /* remaining free space at output */
  this.avail_out = 0;
  /* total number of bytes output so far */
  this.total_out = 0;
  /* last error message, NULL if no error */
  this.msg = ''/*Z_NULL*/;
  /* not visible by applications */
  this.state = null;
  /* best guess about the data type: binary or text */
  this.data_type = 2/*Z_UNKNOWN*/;
  /* adler32 value of the uncompressed data */
  this.adler = 0;
}

module.exports = ZStream;

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJjbGllbnQvZGVtby1tb2JpbGUvZGF0YXN0b3JlLmpzIiwiY2xpZW50L2RlbW8tbW9iaWxlL2luZGV4LmpzIiwiY2xpZW50L2RlbW8tbW9iaWxlL3Bhbm5lci5qcyIsIm5vZGVfbW9kdWxlcy9iYXNlNjQtanMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2llZWU3NTQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvanN6aXAvbGliL2FycmF5UmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzL2pzemlwL2xpYi9iYXNlNjQuanMiLCJub2RlX21vZHVsZXMvanN6aXAvbGliL2NvbXByZXNzZWRPYmplY3QuanMiLCJub2RlX21vZHVsZXMvanN6aXAvbGliL2NvbXByZXNzaW9ucy5qcyIsIm5vZGVfbW9kdWxlcy9qc3ppcC9saWIvY3JjMzIuanMiLCJub2RlX21vZHVsZXMvanN6aXAvbGliL2RhdGFSZWFkZXIuanMiLCJub2RlX21vZHVsZXMvanN6aXAvbGliL2RlZmF1bHRzLmpzIiwibm9kZV9tb2R1bGVzL2pzemlwL2xpYi9kZXByZWNhdGVkUHVibGljVXRpbHMuanMiLCJub2RlX21vZHVsZXMvanN6aXAvbGliL2ZsYXRlLmpzIiwibm9kZV9tb2R1bGVzL2pzemlwL2xpYi9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9qc3ppcC9saWIvbG9hZC5qcyIsIm5vZGVfbW9kdWxlcy9qc3ppcC9saWIvbm9kZUJ1ZmZlci5qcyIsIm5vZGVfbW9kdWxlcy9qc3ppcC9saWIvbm9kZUJ1ZmZlclJlYWRlci5qcyIsIm5vZGVfbW9kdWxlcy9qc3ppcC9saWIvb2JqZWN0LmpzIiwibm9kZV9tb2R1bGVzL2pzemlwL2xpYi9zaWduYXR1cmUuanMiLCJub2RlX21vZHVsZXMvanN6aXAvbGliL3N0cmluZ1JlYWRlci5qcyIsIm5vZGVfbW9kdWxlcy9qc3ppcC9saWIvc3RyaW5nV3JpdGVyLmpzIiwibm9kZV9tb2R1bGVzL2pzemlwL2xpYi9zdXBwb3J0LmpzIiwibm9kZV9tb2R1bGVzL2pzemlwL2xpYi91aW50OEFycmF5UmVhZGVyLmpzIiwibm9kZV9tb2R1bGVzL2pzemlwL2xpYi91aW50OEFycmF5V3JpdGVyLmpzIiwibm9kZV9tb2R1bGVzL2pzemlwL2xpYi91dGY4LmpzIiwibm9kZV9tb2R1bGVzL2pzemlwL2xpYi91dGlscy5qcyIsIm5vZGVfbW9kdWxlcy9qc3ppcC9saWIvemlwRW50cmllcy5qcyIsIm5vZGVfbW9kdWxlcy9qc3ppcC9saWIvemlwRW50cnkuanMiLCJub2RlX21vZHVsZXMvcGFrby9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wYWtvL2xpYi9kZWZsYXRlLmpzIiwibm9kZV9tb2R1bGVzL3Bha28vbGliL2luZmxhdGUuanMiLCJub2RlX21vZHVsZXMvcGFrby9saWIvdXRpbHMvY29tbW9uLmpzIiwibm9kZV9tb2R1bGVzL3Bha28vbGliL3V0aWxzL3N0cmluZ3MuanMiLCJub2RlX21vZHVsZXMvcGFrby9saWIvemxpYi9hZGxlcjMyLmpzIiwibm9kZV9tb2R1bGVzL3Bha28vbGliL3psaWIvY29uc3RhbnRzLmpzIiwibm9kZV9tb2R1bGVzL3Bha28vbGliL3psaWIvY3JjMzIuanMiLCJub2RlX21vZHVsZXMvcGFrby9saWIvemxpYi9kZWZsYXRlLmpzIiwibm9kZV9tb2R1bGVzL3Bha28vbGliL3psaWIvZ3poZWFkZXIuanMiLCJub2RlX21vZHVsZXMvcGFrby9saWIvemxpYi9pbmZmYXN0LmpzIiwibm9kZV9tb2R1bGVzL3Bha28vbGliL3psaWIvaW5mbGF0ZS5qcyIsIm5vZGVfbW9kdWxlcy9wYWtvL2xpYi96bGliL2luZnRyZWVzLmpzIiwibm9kZV9tb2R1bGVzL3Bha28vbGliL3psaWIvbWVzc2FnZXMuanMiLCJub2RlX21vZHVsZXMvcGFrby9saWIvemxpYi90cmVlcy5qcyIsIm5vZGVfbW9kdWxlcy9wYWtvL2xpYi96bGliL3pzdHJlYW0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2p2REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDYkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoMkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9NQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2haQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2YUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2wxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDelZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdlZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0c0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8vIENvcHlyaWdodCAoYykgMjAxNiwgdGhlIElGTUxFZGl0Lm9yZyBwcm9qZWN0IGF1dGhvcnMuIFBsZWFzZSBzZWUgdGhlXHJcbi8vIEFVVEhPUlMgZmlsZSBmb3IgZGV0YWlscy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXNcclxuLy8gZ292ZXJuZWQgYnkgdGhlIE1JVCBsaWNlbnNlIHRoYXQgY2FuIGJlIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUuXHJcbi8qanNsaW50IG5vZGU6IHRydWUsIG5vbWVuOiB0cnVlICovXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxudmFyIG5lZGIgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snTmVkYiddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnTmVkYiddIDogbnVsbCk7XHJcblxyXG5mdW5jdGlvbiBOYW1lc3BhY2Uob3B0aW9ucykge1xyXG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIE5hbWVzcGFjZSkpIHtcclxuICAgICAgICByZXR1cm4gbmV3IE5hbWVzcGFjZShvcHRpb25zKTtcclxuICAgIH1cclxuICAgIHZhciBjb2xsZWN0aW9ucyA9IHt9O1xyXG4gICAgdGhpcy5nZXRDb2xsZWN0aW9uID0gZnVuY3Rpb24gKG5hbWUpIHtcclxuICAgICAgICByZXR1cm4gY29sbGVjdGlvbnNbbmFtZV07XHJcbiAgICB9O1xyXG4gICAgdGhpcy5nZXRDb2xsZWN0aW9uTmFtZXMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIE9iamVjdC5rZXlzKGNvbGxlY3Rpb25zKTtcclxuICAgIH07XHJcbiAgICBmdW5jdGlvbiBDb2xsZWN0aW9uKG9wdGlvbnMpIHtcclxuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ29sbGVjdGlvbikpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBDb2xsZWN0aW9uKG9wdGlvbnMpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBuZWRiLmFwcGx5KHRoaXMpO1xyXG4gICAgICAgIGNvbGxlY3Rpb25zW29wdGlvbnMuZmlsZW5hbWVdID0gdGhpcztcclxuICAgIH1cclxuICAgIENvbGxlY3Rpb24ucHJvdG90eXBlID0gbmVkYi5wcm90b3R5cGU7XHJcbiAgICB0aGlzLm5lZGIgPSBDb2xsZWN0aW9uO1xyXG59XHJcblxyXG5leHBvcnRzLk5hbWVzcGFjZSA9IE5hbWVzcGFjZTtcclxuIiwiLy8gQ29weXJpZ2h0IChjKSAyMDE2LCB0aGUgSUZNTEVkaXQub3JnIHByb2plY3QgYXV0aG9ycy4gUGxlYXNlIHNlZSB0aGVcclxuLy8gQVVUSE9SUyBmaWxlIGZvciBkZXRhaWxzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpc1xyXG4vLyBnb3Zlcm5lZCBieSB0aGUgTUlUIGxpY2Vuc2UgdGhhdCBjYW4gYmUgZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZS5cclxuLypqc2xpbnQgbm9kZTogdHJ1ZSwgbm9tZW46IHRydWUgKi9cclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG52YXIgJCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WyckJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWyckJ10gOiBudWxsKSxcclxuICAgIGtvID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ2tvJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydrbyddIDogbnVsbCksXHJcbiAgICBkb2N1bWVudCA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93Wydkb2N1bWVudCddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnZG9jdW1lbnQnXSA6IG51bGwpLFxyXG4gICAgd2luZG93ID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ3dpbmRvdyddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnd2luZG93J10gOiBudWxsKSxcclxuICAgIGNyZWF0ZVppcCA9IHJlcXVpcmUoJ2pzemlwJyksXHJcbiAgICBQcm9taXNlID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ1Byb21pc2UnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ1Byb21pc2UnXSA6IG51bGwpLFxyXG4gICAgY3JlYXRlTmFtZXNwYWNlID0gcmVxdWlyZSgnLi9kYXRhc3RvcmUnKS5OYW1lc3BhY2UsXHJcbiAgICBuYW1lc3BhY2UgPSBjcmVhdGVOYW1lc3BhY2UoKSxcclxuICAgIHJlcXVpcmVzID0ge1xyXG4gICAgICAgIGpxdWVyeTogJCxcclxuICAgICAgICBrbm9ja291dDoga28sXHJcbiAgICAgICAgbmVkYjogbmFtZXNwYWNlLm5lZGIsXHJcbiAgICAgICAgYmx1ZWJpcmQ6IFByb21pc2VcclxuICAgIH0sXHJcbiAgICBjcmVhdGVQYW5uZXIgPSByZXF1aXJlKCcuL3Bhbm5lcicpLlBhbm5lcjtcclxuXHJcblByb21pc2UuY29uZmlnKHtjYW5jZWxsYXRpb246IHRydWV9KTtcclxuXHJcbnZhciBwYW5uZXIgPSBjcmVhdGVQYW5uZXIoe2VsOiBkb2N1bWVudC5zY3JvbGxpbmdFbGVtZW50fSk7XHJcblxyXG5mdW5jdGlvbiBsb2FkKGZvbGRlciwgZmlsZSkge1xyXG4gICAgdmFyIG1vZHVsZSA9IHsgZXhwb3J0czoge30gfTtcclxuICAgIGZ1bmN0aW9uIHIobW9kdWxlKSB7XHJcbiAgICAgICAgaWYgKHJlcXVpcmVzW21vZHVsZV0pIHsgcmV0dXJuIHJlcXVpcmVzW21vZHVsZV07IH1cclxuICAgICAgICBtb2R1bGUgPSBtb2R1bGUuc3Vic3RyKDIpO1xyXG4gICAgICAgIGlmIChmb2xkZXIuZmlsZShtb2R1bGUpKSB7XHJcbiAgICAgICAgICAgIHJlcXVpcmVzW2ZvbGRlci5yb290ICsgbW9kdWxlXSA9IGxvYWQoZm9sZGVyLCBtb2R1bGUpO1xyXG4gICAgICAgICAgICByZXR1cm4gcmVxdWlyZXNbZm9sZGVyLnJvb3QgKyBtb2R1bGVdO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoZm9sZGVyLmZpbGUobW9kdWxlICsgJy5qcycpKSB7XHJcbiAgICAgICAgICAgIHJlcXVpcmVzW2ZvbGRlci5yb290ICsgbW9kdWxlXSA9IGxvYWQoZm9sZGVyLCBtb2R1bGUgKyAnLmpzJyk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXF1aXJlc1tmb2xkZXIucm9vdCArIG1vZHVsZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmb2xkZXIuZmlsZShtb2R1bGUgKyAnLmpzb24nKSkge1xyXG4gICAgICAgICAgICByZXF1aXJlc1tmb2xkZXIucm9vdCArIG1vZHVsZV0gPSBsb2FkKGZvbGRlciwgbW9kdWxlICsgJy5qc29uJyk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXF1aXJlc1tmb2xkZXIucm9vdCArIG1vZHVsZV07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChmb2xkZXIuZm9sZGVyKG1vZHVsZSkuZmlsZSgnaW5kZXguanMnKSkge1xyXG4gICAgICAgICAgICByZXF1aXJlc1tmb2xkZXIucm9vdCArIG1vZHVsZV0gPSBsb2FkKGZvbGRlci5mb2xkZXIobW9kdWxlKSwgJ2luZGV4LmpzJyk7XHJcbiAgICAgICAgICAgIHJldHVybiByZXF1aXJlc1tmb2xkZXIucm9vdCArIG1vZHVsZV07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG4gICAgaWYgKGZpbGUuc3Vic3RyKC0zKSA9PT0gJy5qcycpIHtcclxuICAgICAgICAvKmpzbGludCBldmlsOiB0cnVlICovXHJcbiAgICAgICAgKG5ldyBGdW5jdGlvbigncmVxdWlyZScsICdtb2R1bGUnLCAnZXhwb3J0cycsIGZvbGRlci5maWxlKGZpbGUpLmFzVGV4dCgpKSkociwgbW9kdWxlLCBtb2R1bGUuZXhwb3J0cyk7XHJcbiAgICAgICAgLypqc2xpbnQgZXZpbDogZmFsc2UgKi9cclxuICAgIH0gZWxzZSBpZiAoZmlsZS5zdWJzdHIoLTUpID09PSAnLmpzb24nKSB7XHJcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBKU09OLnBhcnNlKGZvbGRlci5maWxlKGZpbGUpLmFzVGV4dCgpKTtcclxuICAgIH0gZWxzZSBpZiAoZmlsZS5zdWJzdHIoLTUpID09PSAnLmh0bWwnKSB7XHJcbiAgICAgICAgbW9kdWxlLmV4cG9ydHMgPSBmb2xkZXIuZmlsZShmaWxlKS5hc1RleHQoKTtcclxuICAgIH1cclxuICAgIHJldHVybiBtb2R1bGUuZXhwb3J0cztcclxufVxyXG5cclxuZnVuY3Rpb24gaG90UmVsb2FkKCkge1xyXG4gICAgdmFyIGFwcCA9IHdpbmRvdy5kb2N1bWVudC5ib2R5LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdtYWluLWFwcGxpY2F0aW9uJylbMF0sXHJcbiAgICAgICAgdmlld21vZGVsID0ga28uZGF0YUZvcihhcHApO1xyXG4gICAgT2JqZWN0LmtleXModmlld21vZGVsLmNvbnRleHQudm1zKS5mb3JFYWNoKGZ1bmN0aW9uIChpZCkge1xyXG4gICAgICAgIHZhciB2bSA9IHZpZXdtb2RlbC5jb250ZXh0LnZtc1tpZF0sXHJcbiAgICAgICAgICAgIHNlbGVjdGVkID0gdm0uc2VsZWN0ZWQgJiYgdm0uc2VsZWN0ZWQoKTtcclxuICAgICAgICBmdW5jdGlvbiBmaXhTdGF0dXMoKSB7XHJcbiAgICAgICAgICAgIHZtLndhaXRGb3JTdGF0dXNDaGFuZ2UoKS50aGVuKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGlmICh2bS5zdGF0dXMoKSA9PT0gJ2NvbXB1dGVkJykge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhciBpdGVtID0gdm0uaXRlbXMoKS5maWx0ZXIoZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW0uaWQgPT09IHNlbGVjdGVkO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pWzBdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpdGVtKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZtLnNlbGVjdGVkKHNlbGVjdGVkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdm0ub3V0cHV0ID0gaXRlbTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIGZpeFN0YXR1cygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHZtLm91dHB1dCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgIHZtLm91dHB1dCA9IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgdm0uaW5pdCh7XHJcbiAgICAgICAgICAgICAgICBmaWx0ZXJzOiB2bS5maWx0ZXJzXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICBpZiAoc2VsZWN0ZWQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgZml4U3RhdHVzKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVsb2FkKCkge1xyXG4gICAgdmFyIGFwcCA9IHdpbmRvdy5kb2N1bWVudC5ib2R5LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdtYWluLWFwcGxpY2F0aW9uJylbMF0sXHJcbiAgICAgICAgdmlld21vZGVsID0ga28uZGF0YUZvcihhcHApO1xyXG4gICAga28uY2xlYW5Ob2RlKHdpbmRvdy5kb2N1bWVudC5ib2R5KTtcclxuICAgIGtvLmFwcGx5QmluZGluZ3Modmlld21vZGVsKTtcclxuICAgIHZpZXdtb2RlbC5jb250ZXh0LnRvcC5pbml0KCk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJlY2VpdmVNZXNzYWdlKGUpIHtcclxuICAgIHZhciB6aXAsXHJcbiAgICAgICAgY29sbGVjdGlvbjtcclxuICAgIGlmIChlLmRhdGEucmVzcG9uc2UpIHsgcmV0dXJuOyB9XHJcbiAgICBzd2l0Y2ggKGUuZGF0YS5jb21tYW5kKSB7XHJcbiAgICBjYXNlICdsb2FkJzpcclxuICAgICAgICBpZiAoIWUuZGF0YS56aXApIHsgcmV0dXJuOyB9XHJcbiAgICAgICAgemlwID0gY3JlYXRlWmlwKGUuZGF0YS56aXApO1xyXG4gICAgICAgIGxvYWQoemlwLmZvbGRlcignbW9iaWxlZXhhbXBsZScpLmZvbGRlcignc3JjJykuZm9sZGVyKCdqcycpLCAnaW5kZXguanMnKTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgJ3JlbG9hZCc6XHJcbiAgICAgICAgcmVsb2FkKCk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdob3RfcmVsb2FkJzpcclxuICAgICAgICBob3RSZWxvYWQoKTtcclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgJ2dldF9jb2xsZWN0aW9uX25hbWVzJzpcclxuICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2Uoe1xyXG4gICAgICAgICAgICBjb21tYW5kOiAnZ2V0X2NvbGxlY3Rpb25fbmFtZXMnLFxyXG4gICAgICAgICAgICBjb2xsZWN0aW9uczogbmFtZXNwYWNlLmdldENvbGxlY3Rpb25OYW1lcygpLFxyXG4gICAgICAgICAgICByZXNwb25zZTogdHJ1ZVxyXG4gICAgICAgIH0sICcqJyk7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICBjYXNlICdkdW1wX2NvbGxlY3Rpb24nOlxyXG4gICAgICAgIGlmICghZS5kYXRhLmNvbGxlY3Rpb24pIHsgcmV0dXJuOyB9XHJcbiAgICAgICAgY29sbGVjdGlvbiA9IG5hbWVzcGFjZS5nZXRDb2xsZWN0aW9uKGUuZGF0YS5jb2xsZWN0aW9uKTtcclxuICAgICAgICBpZiAoY29sbGVjdGlvbikge1xyXG4gICAgICAgICAgICBjb2xsZWN0aW9uLmZpbmQoe30sIGZ1bmN0aW9uIChlcnIsIGRvY3MpIHtcclxuICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gd2luZG93LnBvc3RNZXNzYWdlKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWFuZDogJ2R1bXBfY29sbGVjdGlvbicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IGUuZGF0YS5jb2xsZWN0aW9uLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogZXJyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNwb25zZTogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgICAgIH0sICcqJyk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2Uoe1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbW1hbmQ6ICdkdW1wX2NvbGxlY3Rpb24nLFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IGUuZGF0YS5jb2xsZWN0aW9uLFxyXG4gICAgICAgICAgICAgICAgICAgIGRvY3M6IGRvY3MsXHJcbiAgICAgICAgICAgICAgICAgICAgcmVzcG9uc2U6IHRydWVcclxuICAgICAgICAgICAgICAgIH0sICcqJyk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSh7XHJcbiAgICAgICAgICAgICAgICBjb21tYW5kOiAnZHVtcF9jb2xsZWN0aW9uJyxcclxuICAgICAgICAgICAgICAgIGNvbGxlY3Rpb246IGUuZGF0YS5jb2xsZWN0aW9uLFxyXG4gICAgICAgICAgICAgICAgZXJyb3I6ICd1a25vd24gY29sbGVjdGlvbiBcIicgKyBlLmRhdGEuY29sbGVjdGlvbiArICdcIicsXHJcbiAgICAgICAgICAgICAgICByZXNwb25zZTogdHJ1ZVxyXG4gICAgICAgICAgICB9LCAnKicpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBicmVhaztcclxuICAgIGNhc2UgJ3Jlc3RvcmVfY29sbGVjdGlvbic6XHJcbiAgICAgICAgaWYgKCFlLmRhdGEuY29sbGVjdGlvbikgeyByZXR1cm47IH1cclxuICAgICAgICBpZiAoIWUuZGF0YS5kb2N1bWVudHMpIHsgcmV0dXJuOyB9XHJcbiAgICAgICAgY29sbGVjdGlvbiA9IG5hbWVzcGFjZS5nZXRDb2xsZWN0aW9uKGUuZGF0YS5jb2xsZWN0aW9uKTtcclxuICAgICAgICBpZiAoIWNvbGxlY3Rpb24pIHsgcmV0dXJuOyB9XHJcbiAgICAgICAgY29sbGVjdGlvbi5yZW1vdmUoe30sIHttdWx0aTogdHJ1ZX0pO1xyXG4gICAgICAgIGNvbGxlY3Rpb24uaW5zZXJ0KGUuZGF0YS5kb2N1bWVudHMpO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgfVxyXG59XHJcblxyXG4oZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIHJlZ2lzdGVyID0ga28uY29tcG9uZW50cy5yZWdpc3RlcjtcclxuICAgIGtvLmNvbXBvbmVudHMucmVnaXN0ZXIgPSBmdW5jdGlvbiAobmFtZSwgb3B0aW9ucykge1xyXG4gICAgICAgIHZhciBjcmVhdGVWaWV3TW9kZWwgPSBvcHRpb25zLnZpZXdNb2RlbC5jcmVhdGVWaWV3TW9kZWw7XHJcbiAgICAgICAgb3B0aW9ucy52aWV3TW9kZWwuY3JlYXRlVmlld01vZGVsID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgICQobmFtZSArICcgdWwudGFicycpLmVhY2goZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghJCh0aGlzKS5kYXRhKCdwYWRkaW5nJykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY3JlYXRlUGFubmVyKHtlbDogdGhpc30pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAkKHRoaXMpLmRhdGEoJ3BhZGRpbmcnLCAndHJ1ZScpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9LCAxKTtcclxuICAgICAgICAgICAgcmV0dXJuIGNyZWF0ZVZpZXdNb2RlbC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmV0dXJuIHJlZ2lzdGVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XHJcbiAgICB9O1xyXG59KCkpO1xyXG5cclxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCByZWNlaXZlTWVzc2FnZSwgZmFsc2UpO1xyXG4iLCIvLyBDb3B5cmlnaHQgKGMpIDIwMTYsIHRoZSBJRk1MRWRpdC5vcmcgcHJvamVjdCBhdXRob3JzLiBQbGVhc2Ugc2VlIHRoZVxyXG4vLyBBVVRIT1JTIGZpbGUgZm9yIGRldGFpbHMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzXHJcbi8vIGdvdmVybmVkIGJ5IHRoZSBNSVQgbGljZW5zZSB0aGF0IGNhbiBiZSBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlLlxyXG4vKmpzbGludCBub2RlOiB0cnVlLCBub21lbjogdHJ1ZSAqL1xyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbnZhciAkID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJyQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJyQnXSA6IG51bGwpLFxyXG4gICAgZG9jdW1lbnQgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snZG9jdW1lbnQnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ2RvY3VtZW50J10gOiBudWxsKSxcclxuICAgIHdpbmRvdyA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93Wyd3aW5kb3cnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ3dpbmRvdyddIDogbnVsbCk7XHJcblxyXG5mdW5jdGlvbiBQYW5uZXIob3B0aW9ucykge1xyXG4gICAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFBhbm5lcikpIHsgcmV0dXJuIG5ldyBQYW5uZXIob3B0aW9ucyk7IH1cclxuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xyXG5cclxuICAgIGlmICghb3B0aW9ucy5lbCkgeyB0aHJvdyBuZXcgRXJyb3IoJ2xpc3RlbmVyIG9wdGlvbiBpcyBtYW5kYXRvcnknKTsgfVxyXG4gICAgaWYgKCQob3B0aW9ucy5lbCkubGVuZ3RoID09PSAwKSB7IHRocm93IG5ldyBFcnJvcignaW52YWxpZCBsaXN0ZW5lciBvcHRpb24nKTsgfVxyXG5cclxuICAgIHZhciBlbCA9ICQob3B0aW9ucy5lbClbMF0sXHJcbiAgICAgICAgbW92ZWQsXHJcbiAgICAgICAgcmVtb3ZlSGFuZGxlcnMsXHJcbiAgICAgICAgc3RhcnRDbGllbnRYLFxyXG4gICAgICAgIHN0YXJ0Q2xpZW50WSxcclxuICAgICAgICBsYXN0Q2xpZW50WCxcclxuICAgICAgICBsYXN0Q2xpZW50WTtcclxuXHJcbiAgICBmdW5jdGlvbiBtb3VzZW1vdmUoZSkge1xyXG4gICAgICAgIGlmIChlLmJ1dHRvbnMgPT09IDApIHtcclxuICAgICAgICAgICAgZWwuc3R5bGUucG9pbnRlckV2ZW50cyA9IG51bGw7XHJcbiAgICAgICAgICAgIHJldHVybiByZW1vdmVIYW5kbGVycygpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIW1vdmVkKSB7XHJcbiAgICAgICAgICAgIGlmIChNYXRoLmFicyhzdGFydENsaWVudFggLSBlLmNsaWVudFgpICsgTWF0aC5hYnMoc3RhcnRDbGllbnRZIC0gZS5jbGllbnRZKSA+IDEwKSB7XHJcbiAgICAgICAgICAgICAgICBtb3ZlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBlbC5zdHlsZS5wb2ludGVyRXZlbnRzID0gJ25vbmUnO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsLnNjcm9sbExlZnQgKz0gKGxhc3RDbGllbnRYIC0gZS5jbGllbnRYKTtcclxuICAgICAgICBsYXN0Q2xpZW50WCA9IGUuY2xpZW50WDtcclxuICAgICAgICBlbC5zY3JvbGxUb3AgKz0gKGxhc3RDbGllbnRZIC0gZS5jbGllbnRZKTtcclxuICAgICAgICBsYXN0Q2xpZW50WSA9IGUuY2xpZW50WTtcclxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gbW91c2V1cCgpIHtcclxuICAgICAgICByZW1vdmVIYW5kbGVycygpO1xyXG4gICAgICAgIGlmIChtb3ZlZCkge1xyXG4gICAgICAgICAgICBlbC5zdHlsZS5wb2ludGVyRXZlbnRzID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgcmVtb3ZlSGFuZGxlcnMgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBtb3VzZXVwLCB0cnVlKTtcclxuICAgICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgbW91c2Vtb3ZlLCB0cnVlKTtcclxuICAgIH07XHJcblxyXG4gICAgZnVuY3Rpb24gbW91c2Vkb3duKGUpIHtcclxuICAgICAgICByZW1vdmVIYW5kbGVycygpO1xyXG4gICAgICAgIG1vdmVkID0gZmFsc2U7XHJcbiAgICAgICAgc3RhcnRDbGllbnRYID0gbGFzdENsaWVudFggPSBlLmNsaWVudFg7XHJcbiAgICAgICAgc3RhcnRDbGllbnRZID0gbGFzdENsaWVudFkgPSBlLmNsaWVudFk7XHJcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCBtb3VzZXVwLCB0cnVlKTtcclxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vtb3ZlJywgbW91c2Vtb3ZlLCB0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLnN0YXJ0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJlbW92ZUhhbmRsZXJzKCk7XHJcbiAgICAgICAgdGhpcy5zdG9wKCk7XHJcbiAgICAgICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgbW91c2Vkb3duLCB0cnVlKTtcclxuICAgIH07XHJcblxyXG4gICAgdGhpcy5zdG9wID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIG1vdXNlZG93biwgdHJ1ZSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGlmIChvcHRpb25zLmF1dG9zdGFydCA9PT0gdW5kZWZpbmVkIHx8IG9wdGlvbnMuYXV0b3N0YXJ0KSB7XHJcbiAgICAgICAgdGhpcy5zdGFydCgpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnRzLlBhbm5lciA9IFBhbm5lcjtcclxuIiwiJ3VzZSBzdHJpY3QnXG5cbmV4cG9ydHMuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcbmV4cG9ydHMudG9CeXRlQXJyYXkgPSB0b0J5dGVBcnJheVxuZXhwb3J0cy5mcm9tQnl0ZUFycmF5ID0gZnJvbUJ5dGVBcnJheVxuXG52YXIgbG9va3VwID0gW11cbnZhciByZXZMb29rdXAgPSBbXVxudmFyIEFyciA9IHR5cGVvZiBVaW50OEFycmF5ICE9PSAndW5kZWZpbmVkJyA/IFVpbnQ4QXJyYXkgOiBBcnJheVxuXG52YXIgY29kZSA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuZm9yICh2YXIgaSA9IDAsIGxlbiA9IGNvZGUubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgbG9va3VwW2ldID0gY29kZVtpXVxuICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGlcbn1cblxuLy8gU3VwcG9ydCBkZWNvZGluZyBVUkwtc2FmZSBiYXNlNjQgc3RyaW5ncywgYXMgTm9kZS5qcyBkb2VzLlxuLy8gU2VlOiBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CYXNlNjQjVVJMX2FwcGxpY2F0aW9uc1xucmV2TG9va3VwWyctJy5jaGFyQ29kZUF0KDApXSA9IDYyXG5yZXZMb29rdXBbJ18nLmNoYXJDb2RlQXQoMCldID0gNjNcblxuZnVuY3Rpb24gZ2V0TGVucyAoYjY0KSB7XG4gIHZhciBsZW4gPSBiNjQubGVuZ3RoXG5cbiAgaWYgKGxlbiAlIDQgPiAwKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHN0cmluZy4gTGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiA0JylcbiAgfVxuXG4gIC8vIFRyaW0gb2ZmIGV4dHJhIGJ5dGVzIGFmdGVyIHBsYWNlaG9sZGVyIGJ5dGVzIGFyZSBmb3VuZFxuICAvLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9iZWF0Z2FtbWl0L2Jhc2U2NC1qcy9pc3N1ZXMvNDJcbiAgdmFyIHZhbGlkTGVuID0gYjY0LmluZGV4T2YoJz0nKVxuICBpZiAodmFsaWRMZW4gPT09IC0xKSB2YWxpZExlbiA9IGxlblxuXG4gIHZhciBwbGFjZUhvbGRlcnNMZW4gPSB2YWxpZExlbiA9PT0gbGVuXG4gICAgPyAwXG4gICAgOiA0IC0gKHZhbGlkTGVuICUgNClcblxuICByZXR1cm4gW3ZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW5dXG59XG5cbi8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuZnVuY3Rpb24gYnl0ZUxlbmd0aCAoYjY0KSB7XG4gIHZhciBsZW5zID0gZ2V0TGVucyhiNjQpXG4gIHZhciB2YWxpZExlbiA9IGxlbnNbMF1cbiAgdmFyIHBsYWNlSG9sZGVyc0xlbiA9IGxlbnNbMV1cbiAgcmV0dXJuICgodmFsaWRMZW4gKyBwbGFjZUhvbGRlcnNMZW4pICogMyAvIDQpIC0gcGxhY2VIb2xkZXJzTGVuXG59XG5cbmZ1bmN0aW9uIF9ieXRlTGVuZ3RoIChiNjQsIHZhbGlkTGVuLCBwbGFjZUhvbGRlcnNMZW4pIHtcbiAgcmV0dXJuICgodmFsaWRMZW4gKyBwbGFjZUhvbGRlcnNMZW4pICogMyAvIDQpIC0gcGxhY2VIb2xkZXJzTGVuXG59XG5cbmZ1bmN0aW9uIHRvQnl0ZUFycmF5IChiNjQpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVucyA9IGdldExlbnMoYjY0KVxuICB2YXIgdmFsaWRMZW4gPSBsZW5zWzBdXG4gIHZhciBwbGFjZUhvbGRlcnNMZW4gPSBsZW5zWzFdXG5cbiAgdmFyIGFyciA9IG5ldyBBcnIoX2J5dGVMZW5ndGgoYjY0LCB2YWxpZExlbiwgcGxhY2VIb2xkZXJzTGVuKSlcblxuICB2YXIgY3VyQnl0ZSA9IDBcblxuICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gIHZhciBsZW4gPSBwbGFjZUhvbGRlcnNMZW4gPiAwXG4gICAgPyB2YWxpZExlbiAtIDRcbiAgICA6IHZhbGlkTGVuXG5cbiAgdmFyIGlcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSArPSA0KSB7XG4gICAgdG1wID1cbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDE4KSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPDwgMTIpIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDIpXSA8PCA2KSB8XG4gICAgICByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDMpXVxuICAgIGFycltjdXJCeXRlKytdID0gKHRtcCA+PiAxNikgJiAweEZGXG4gICAgYXJyW2N1ckJ5dGUrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltjdXJCeXRlKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVyc0xlbiA9PT0gMikge1xuICAgIHRtcCA9XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkpXSA8PCAyKSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAxKV0gPj4gNClcbiAgICBhcnJbY3VyQnl0ZSsrXSA9IHRtcCAmIDB4RkZcbiAgfVxuXG4gIGlmIChwbGFjZUhvbGRlcnNMZW4gPT09IDEpIHtcbiAgICB0bXAgPVxuICAgICAgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTApIHxcbiAgICAgIChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCA0KSB8XG4gICAgICAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPj4gMilcbiAgICBhcnJbY3VyQnl0ZSsrXSA9ICh0bXAgPj4gOCkgJiAweEZGXG4gICAgYXJyW2N1ckJ5dGUrK10gPSB0bXAgJiAweEZGXG4gIH1cblxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gIHJldHVybiBsb29rdXBbbnVtID4+IDE4ICYgMHgzRl0gK1xuICAgIGxvb2t1cFtudW0gPj4gMTIgJiAweDNGXSArXG4gICAgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gK1xuICAgIGxvb2t1cFtudW0gJiAweDNGXVxufVxuXG5mdW5jdGlvbiBlbmNvZGVDaHVuayAodWludDgsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHRtcFxuICB2YXIgb3V0cHV0ID0gW11cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpICs9IDMpIHtcbiAgICB0bXAgPVxuICAgICAgKCh1aW50OFtpXSA8PCAxNikgJiAweEZGMDAwMCkgK1xuICAgICAgKCh1aW50OFtpICsgMV0gPDwgOCkgJiAweEZGMDApICtcbiAgICAgICh1aW50OFtpICsgMl0gJiAweEZGKVxuICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0bXApKVxuICB9XG4gIHJldHVybiBvdXRwdXQuam9pbignJylcbn1cblxuZnVuY3Rpb24gZnJvbUJ5dGVBcnJheSAodWludDgpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVuID0gdWludDgubGVuZ3RoXG4gIHZhciBleHRyYUJ5dGVzID0gbGVuICUgMyAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuICB2YXIgcGFydHMgPSBbXVxuICB2YXIgbWF4Q2h1bmtMZW5ndGggPSAxNjM4MyAvLyBtdXN0IGJlIG11bHRpcGxlIG9mIDNcblxuICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gIGZvciAodmFyIGkgPSAwLCBsZW4yID0gbGVuIC0gZXh0cmFCeXRlczsgaSA8IGxlbjI7IGkgKz0gbWF4Q2h1bmtMZW5ndGgpIHtcbiAgICBwYXJ0cy5wdXNoKGVuY29kZUNodW5rKHVpbnQ4LCBpLCAoaSArIG1heENodW5rTGVuZ3RoKSA+IGxlbjIgPyBsZW4yIDogKGkgKyBtYXhDaHVua0xlbmd0aCkpKVxuICB9XG5cbiAgLy8gcGFkIHRoZSBlbmQgd2l0aCB6ZXJvcywgYnV0IG1ha2Ugc3VyZSB0byBub3QgZm9yZ2V0IHRoZSBleHRyYSBieXRlc1xuICBpZiAoZXh0cmFCeXRlcyA9PT0gMSkge1xuICAgIHRtcCA9IHVpbnQ4W2xlbiAtIDFdXG4gICAgcGFydHMucHVzaChcbiAgICAgIGxvb2t1cFt0bXAgPj4gMl0gK1xuICAgICAgbG9va3VwWyh0bXAgPDwgNCkgJiAweDNGXSArXG4gICAgICAnPT0nXG4gICAgKVxuICB9IGVsc2UgaWYgKGV4dHJhQnl0ZXMgPT09IDIpIHtcbiAgICB0bXAgPSAodWludDhbbGVuIC0gMl0gPDwgOCkgKyB1aW50OFtsZW4gLSAxXVxuICAgIHBhcnRzLnB1c2goXG4gICAgICBsb29rdXBbdG1wID4+IDEwXSArXG4gICAgICBsb29rdXBbKHRtcCA+PiA0KSAmIDB4M0ZdICtcbiAgICAgIGxvb2t1cFsodG1wIDw8IDIpICYgMHgzRl0gK1xuICAgICAgJz0nXG4gICAgKVxuICB9XG5cbiAgcmV0dXJuIHBhcnRzLmpvaW4oJycpXG59XG4iLCIvKiFcbiAqIFRoZSBidWZmZXIgbW9kdWxlIGZyb20gbm9kZS5qcywgZm9yIHRoZSBicm93c2VyLlxuICpcbiAqIEBhdXRob3IgICBGZXJvc3MgQWJvdWtoYWRpamVoIDxodHRwczovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcblxudmFyIEtfTUFYX0xFTkdUSCA9IDB4N2ZmZmZmZmZcbmV4cG9ydHMua01heExlbmd0aCA9IEtfTUFYX0xFTkdUSFxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBQcmludCB3YXJuaW5nIGFuZCByZWNvbW1lbmQgdXNpbmcgYGJ1ZmZlcmAgdjQueCB3aGljaCBoYXMgYW4gT2JqZWN0XG4gKiAgICAgICAgICAgICAgIGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBXZSByZXBvcnQgdGhhdCB0aGUgYnJvd3NlciBkb2VzIG5vdCBzdXBwb3J0IHR5cGVkIGFycmF5cyBpZiB0aGUgYXJlIG5vdCBzdWJjbGFzc2FibGVcbiAqIHVzaW5nIF9fcHJvdG9fXy4gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWBcbiAqIChTZWU6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTY5NTQzOCkuIElFIDEwIGxhY2tzIHN1cHBvcnRcbiAqIGZvciBfX3Byb3RvX18gYW5kIGhhcyBhIGJ1Z2d5IHR5cGVkIGFycmF5IGltcGxlbWVudGF0aW9uLlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiB0eXBlb2YgY29uc29sZSAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICB0eXBlb2YgY29uc29sZS5lcnJvciA9PT0gJ2Z1bmN0aW9uJykge1xuICBjb25zb2xlLmVycm9yKFxuICAgICdUaGlzIGJyb3dzZXIgbGFja3MgdHlwZWQgYXJyYXkgKFVpbnQ4QXJyYXkpIHN1cHBvcnQgd2hpY2ggaXMgcmVxdWlyZWQgYnkgJyArXG4gICAgJ2BidWZmZXJgIHY1LnguIFVzZSBgYnVmZmVyYCB2NC54IGlmIHlvdSByZXF1aXJlIG9sZCBicm93c2VyIHN1cHBvcnQuJ1xuICApXG59XG5cbmZ1bmN0aW9uIHR5cGVkQXJyYXlTdXBwb3J0ICgpIHtcbiAgLy8gQ2FuIHR5cGVkIGFycmF5IGluc3RhbmNlcyBjYW4gYmUgYXVnbWVudGVkP1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5fX3Byb3RvX18gPSB7IF9fcHJvdG9fXzogVWludDhBcnJheS5wcm90b3R5cGUsIGZvbzogZnVuY3Rpb24gKCkgeyByZXR1cm4gNDIgfSB9XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDJcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShCdWZmZXIucHJvdG90eXBlLCAncGFyZW50Jywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0aGlzKSkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIHJldHVybiB0aGlzLmJ1ZmZlclxuICB9XG59KVxuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLnByb3RvdHlwZSwgJ29mZnNldCcsIHtcbiAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgZ2V0OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIodGhpcykpIHJldHVybiB1bmRlZmluZWRcbiAgICByZXR1cm4gdGhpcy5ieXRlT2Zmc2V0XG4gIH1cbn0pXG5cbmZ1bmN0aW9uIGNyZWF0ZUJ1ZmZlciAobGVuZ3RoKSB7XG4gIGlmIChsZW5ndGggPiBLX01BWF9MRU5HVEgpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVGhlIHZhbHVlIFwiJyArIGxlbmd0aCArICdcIiBpcyBpbnZhbGlkIGZvciBvcHRpb24gXCJzaXplXCInKVxuICB9XG4gIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlXG4gIHZhciBidWYgPSBuZXcgVWludDhBcnJheShsZW5ndGgpXG4gIGJ1Zi5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIHJldHVybiBidWZcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuXG5mdW5jdGlvbiBCdWZmZXIgKGFyZywgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKSB7XG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAodHlwZW9mIGVuY29kaW5nT3JPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgICAnVGhlIFwic3RyaW5nXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIHN0cmluZy4gUmVjZWl2ZWQgdHlwZSBudW1iZXInXG4gICAgICApXG4gICAgfVxuICAgIHJldHVybiBhbGxvY1Vuc2FmZShhcmcpXG4gIH1cbiAgcmV0dXJuIGZyb20oYXJnLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG59XG5cbi8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG5pZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgIT0gbnVsbCAmJlxuICAgIEJ1ZmZlcltTeW1ib2wuc3BlY2llc10gPT09IEJ1ZmZlcikge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkoQnVmZmVyLCBTeW1ib2wuc3BlY2llcywge1xuICAgIHZhbHVlOiBudWxsLFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBlbnVtZXJhYmxlOiBmYWxzZSxcbiAgICB3cml0YWJsZTogZmFsc2VcbiAgfSlcbn1cblxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbmZ1bmN0aW9uIGZyb20gKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gZnJvbVN0cmluZyh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldClcbiAgfVxuXG4gIGlmIChBcnJheUJ1ZmZlci5pc1ZpZXcodmFsdWUpKSB7XG4gICAgcmV0dXJuIGZyb21BcnJheUxpa2UodmFsdWUpXG4gIH1cblxuICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgIHRocm93IFR5cGVFcnJvcihcbiAgICAgICdUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBvbmUgb2YgdHlwZSBzdHJpbmcsIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEFycmF5LCAnICtcbiAgICAgICdvciBBcnJheS1saWtlIE9iamVjdC4gUmVjZWl2ZWQgdHlwZSAnICsgKHR5cGVvZiB2YWx1ZSlcbiAgICApXG4gIH1cblxuICBpZiAoaXNJbnN0YW5jZSh2YWx1ZSwgQXJyYXlCdWZmZXIpIHx8XG4gICAgICAodmFsdWUgJiYgaXNJbnN0YW5jZSh2YWx1ZS5idWZmZXIsIEFycmF5QnVmZmVyKSkpIHtcbiAgICByZXR1cm4gZnJvbUFycmF5QnVmZmVyKHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAnVGhlIFwidmFsdWVcIiBhcmd1bWVudCBtdXN0IG5vdCBiZSBvZiB0eXBlIG51bWJlci4gUmVjZWl2ZWQgdHlwZSBudW1iZXInXG4gICAgKVxuICB9XG5cbiAgdmFyIHZhbHVlT2YgPSB2YWx1ZS52YWx1ZU9mICYmIHZhbHVlLnZhbHVlT2YoKVxuICBpZiAodmFsdWVPZiAhPSBudWxsICYmIHZhbHVlT2YgIT09IHZhbHVlKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5mcm9tKHZhbHVlT2YsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIHZhciBiID0gZnJvbU9iamVjdCh2YWx1ZSlcbiAgaWYgKGIpIHJldHVybiBiXG5cbiAgaWYgKHR5cGVvZiBTeW1ib2wgIT09ICd1bmRlZmluZWQnICYmIFN5bWJvbC50b1ByaW1pdGl2ZSAhPSBudWxsICYmXG4gICAgICB0eXBlb2YgdmFsdWVbU3ltYm9sLnRvUHJpbWl0aXZlXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBCdWZmZXIuZnJvbShcbiAgICAgIHZhbHVlW1N5bWJvbC50b1ByaW1pdGl2ZV0oJ3N0cmluZycpLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGhcbiAgICApXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICdUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBvbmUgb2YgdHlwZSBzdHJpbmcsIEJ1ZmZlciwgQXJyYXlCdWZmZXIsIEFycmF5LCAnICtcbiAgICAnb3IgQXJyYXktbGlrZSBPYmplY3QuIFJlY2VpdmVkIHR5cGUgJyArICh0eXBlb2YgdmFsdWUpXG4gIClcbn1cblxuLyoqXG4gKiBGdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB0byBCdWZmZXIoYXJnLCBlbmNvZGluZykgYnV0IHRocm93cyBhIFR5cGVFcnJvclxuICogaWYgdmFsdWUgaXMgYSBudW1iZXIuXG4gKiBCdWZmZXIuZnJvbShzdHJbLCBlbmNvZGluZ10pXG4gKiBCdWZmZXIuZnJvbShhcnJheSlcbiAqIEJ1ZmZlci5mcm9tKGJ1ZmZlcilcbiAqIEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyWywgYnl0ZU9mZnNldFssIGxlbmd0aF1dKVxuICoqL1xuQnVmZmVyLmZyb20gPSBmdW5jdGlvbiAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gZnJvbSh2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG4vLyBOb3RlOiBDaGFuZ2UgcHJvdG90eXBlICphZnRlciogQnVmZmVyLmZyb20gaXMgZGVmaW5lZCB0byB3b3JrYXJvdW5kIENocm9tZSBidWc6XG4vLyBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzE0OFxuQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuQnVmZmVyLl9fcHJvdG9fXyA9IFVpbnQ4QXJyYXlcblxuZnVuY3Rpb24gYXNzZXJ0U2l6ZSAoc2l6ZSkge1xuICBpZiAodHlwZW9mIHNpemUgIT09ICdudW1iZXInKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJzaXplXCIgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIG51bWJlcicpXG4gIH0gZWxzZSBpZiAoc2l6ZSA8IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVGhlIHZhbHVlIFwiJyArIHNpemUgKyAnXCIgaXMgaW52YWxpZCBmb3Igb3B0aW9uIFwic2l6ZVwiJylcbiAgfVxufVxuXG5mdW5jdGlvbiBhbGxvYyAoc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplKVxuICB9XG4gIGlmIChmaWxsICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBPbmx5IHBheSBhdHRlbnRpb24gdG8gZW5jb2RpbmcgaWYgaXQncyBhIHN0cmluZy4gVGhpc1xuICAgIC8vIHByZXZlbnRzIGFjY2lkZW50YWxseSBzZW5kaW5nIGluIGEgbnVtYmVyIHRoYXQgd291bGRcbiAgICAvLyBiZSBpbnRlcnByZXR0ZWQgYXMgYSBzdGFydCBvZmZzZXQuXG4gICAgcmV0dXJuIHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZydcbiAgICAgID8gY3JlYXRlQnVmZmVyKHNpemUpLmZpbGwoZmlsbCwgZW5jb2RpbmcpXG4gICAgICA6IGNyZWF0ZUJ1ZmZlcihzaXplKS5maWxsKGZpbGwpXG4gIH1cbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplKVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqIGFsbG9jKHNpemVbLCBmaWxsWywgZW5jb2RpbmddXSlcbiAqKi9cbkJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICByZXR1cm4gYWxsb2Moc2l6ZSwgZmlsbCwgZW5jb2RpbmcpXG59XG5cbmZ1bmN0aW9uIGFsbG9jVW5zYWZlIChzaXplKSB7XG4gIGFzc2VydFNpemUoc2l6ZSlcbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcihzaXplIDwgMCA/IDAgOiBjaGVja2VkKHNpemUpIHwgMClcbn1cblxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIEJ1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICogKi9cbkJ1ZmZlci5hbGxvY1Vuc2FmZSA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShzaXplKVxufVxuLyoqXG4gKiBFcXVpdmFsZW50IHRvIFNsb3dCdWZmZXIobnVtKSwgYnkgZGVmYXVsdCBjcmVhdGVzIGEgbm9uLXplcm8tZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlU2xvdyA9IGZ1bmN0aW9uIChzaXplKSB7XG4gIHJldHVybiBhbGxvY1Vuc2FmZShzaXplKVxufVxuXG5mdW5jdGlvbiBmcm9tU3RyaW5nIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnIHx8IGVuY29kaW5nID09PSAnJykge1xuICAgIGVuY29kaW5nID0gJ3V0ZjgnXG4gIH1cblxuICBpZiAoIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgfVxuXG4gIHZhciBsZW5ndGggPSBieXRlTGVuZ3RoKHN0cmluZywgZW5jb2RpbmcpIHwgMFxuICB2YXIgYnVmID0gY3JlYXRlQnVmZmVyKGxlbmd0aClcblxuICB2YXIgYWN0dWFsID0gYnVmLndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG5cbiAgaWYgKGFjdHVhbCAhPT0gbGVuZ3RoKSB7XG4gICAgLy8gV3JpdGluZyBhIGhleCBzdHJpbmcsIGZvciBleGFtcGxlLCB0aGF0IGNvbnRhaW5zIGludmFsaWQgY2hhcmFjdGVycyB3aWxsXG4gICAgLy8gY2F1c2UgZXZlcnl0aGluZyBhZnRlciB0aGUgZmlyc3QgaW52YWxpZCBjaGFyYWN0ZXIgdG8gYmUgaWdub3JlZC4gKGUuZy5cbiAgICAvLyAnYWJ4eGNkJyB3aWxsIGJlIHRyZWF0ZWQgYXMgJ2FiJylcbiAgICBidWYgPSBidWYuc2xpY2UoMCwgYWN0dWFsKVxuICB9XG5cbiAgcmV0dXJuIGJ1ZlxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlMaWtlIChhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGFycmF5Lmxlbmd0aCkgfCAwXG4gIHZhciBidWYgPSBjcmVhdGVCdWZmZXIobGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgYnVmW2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21BcnJheUJ1ZmZlciAoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAoYnl0ZU9mZnNldCA8IDAgfHwgYXJyYXkuYnl0ZUxlbmd0aCA8IGJ5dGVPZmZzZXQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJvZmZzZXRcIiBpcyBvdXRzaWRlIG9mIGJ1ZmZlciBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0ICsgKGxlbmd0aCB8fCAwKSkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdcImxlbmd0aFwiIGlzIG91dHNpZGUgb2YgYnVmZmVyIGJvdW5kcycpXG4gIH1cblxuICB2YXIgYnVmXG4gIGlmIChieXRlT2Zmc2V0ID09PSB1bmRlZmluZWQgJiYgbGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBidWYgPSBuZXcgVWludDhBcnJheShhcnJheSlcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0KVxuICB9IGVsc2Uge1xuICAgIGJ1ZiA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpXG4gIH1cblxuICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZVxuICBidWYuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKG9iaikge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iaikpIHtcbiAgICB2YXIgbGVuID0gY2hlY2tlZChvYmoubGVuZ3RoKSB8IDBcbiAgICB2YXIgYnVmID0gY3JlYXRlQnVmZmVyKGxlbilcblxuICAgIGlmIChidWYubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gYnVmXG4gICAgfVxuXG4gICAgb2JqLmNvcHkoYnVmLCAwLCAwLCBsZW4pXG4gICAgcmV0dXJuIGJ1ZlxuICB9XG5cbiAgaWYgKG9iai5sZW5ndGggIT09IHVuZGVmaW5lZCkge1xuICAgIGlmICh0eXBlb2Ygb2JqLmxlbmd0aCAhPT0gJ251bWJlcicgfHwgbnVtYmVySXNOYU4ob2JqLmxlbmd0aCkpIHtcbiAgICAgIHJldHVybiBjcmVhdGVCdWZmZXIoMClcbiAgICB9XG4gICAgcmV0dXJuIGZyb21BcnJheUxpa2Uob2JqKVxuICB9XG5cbiAgaWYgKG9iai50eXBlID09PSAnQnVmZmVyJyAmJiBBcnJheS5pc0FycmF5KG9iai5kYXRhKSkge1xuICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKG9iai5kYXRhKVxuICB9XG59XG5cbmZ1bmN0aW9uIGNoZWNrZWQgKGxlbmd0aCkge1xuICAvLyBOb3RlOiBjYW5ub3QgdXNlIGBsZW5ndGggPCBLX01BWF9MRU5HVEhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0gS19NQVhfTEVOR1RIKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIEtfTUFYX0xFTkdUSC50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKCtsZW5ndGggIT0gbGVuZ3RoKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZXFlcWVxXG4gICAgbGVuZ3RoID0gMFxuICB9XG4gIHJldHVybiBCdWZmZXIuYWxsb2MoK2xlbmd0aClcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuIGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlciA9PT0gdHJ1ZSAmJlxuICAgIGIgIT09IEJ1ZmZlci5wcm90b3R5cGUgLy8gc28gQnVmZmVyLmlzQnVmZmVyKEJ1ZmZlci5wcm90b3R5cGUpIHdpbGwgYmUgZmFsc2Vcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmIChpc0luc3RhbmNlKGEsIFVpbnQ4QXJyYXkpKSBhID0gQnVmZmVyLmZyb20oYSwgYS5vZmZzZXQsIGEuYnl0ZUxlbmd0aClcbiAgaWYgKGlzSW5zdGFuY2UoYiwgVWludDhBcnJheSkpIGIgPSBCdWZmZXIuZnJvbShiLCBiLm9mZnNldCwgYi5ieXRlTGVuZ3RoKVxuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICdUaGUgXCJidWYxXCIsIFwiYnVmMlwiIGFyZ3VtZW50cyBtdXN0IGJlIG9uZSBvZiB0eXBlIEJ1ZmZlciBvciBVaW50OEFycmF5J1xuICAgIClcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIHggPSBhW2ldXG4gICAgICB5ID0gYltpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnbGF0aW4xJzpcbiAgICBjYXNlICdiaW5hcnknOlxuICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIUFycmF5LmlzQXJyYXkobGlzdCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImxpc3RcIiBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5hbGxvYygwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmZmVyID0gQnVmZmVyLmFsbG9jVW5zYWZlKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgYnVmID0gbGlzdFtpXVxuICAgIGlmIChpc0luc3RhbmNlKGJ1ZiwgVWludDhBcnJheSkpIHtcbiAgICAgIGJ1ZiA9IEJ1ZmZlci5mcm9tKGJ1ZilcbiAgICB9XG4gICAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJsaXN0XCIgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzJylcbiAgICB9XG4gICAgYnVmLmNvcHkoYnVmZmVyLCBwb3MpXG4gICAgcG9zICs9IGJ1Zi5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmZmVyXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihzdHJpbmcpKSB7XG4gICAgcmV0dXJuIHN0cmluZy5sZW5ndGhcbiAgfVxuICBpZiAoQXJyYXlCdWZmZXIuaXNWaWV3KHN0cmluZykgfHwgaXNJbnN0YW5jZShzdHJpbmcsIEFycmF5QnVmZmVyKSkge1xuICAgIHJldHVybiBzdHJpbmcuYnl0ZUxlbmd0aFxuICB9XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXG4gICAgICAnVGhlIFwic3RyaW5nXCIgYXJndW1lbnQgbXVzdCBiZSBvbmUgb2YgdHlwZSBzdHJpbmcsIEJ1ZmZlciwgb3IgQXJyYXlCdWZmZXIuICcgK1xuICAgICAgJ1JlY2VpdmVkIHR5cGUgJyArIHR5cGVvZiBzdHJpbmdcbiAgICApXG4gIH1cblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICB2YXIgbXVzdE1hdGNoID0gKGFyZ3VtZW50cy5sZW5ndGggPiAyICYmIGFyZ3VtZW50c1syXSA9PT0gdHJ1ZSlcbiAgaWYgKCFtdXN0TWF0Y2ggJiYgbGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnbGF0aW4xJzpcbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBsZW5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiBsZW4gKiAyXG4gICAgICBjYXNlICdoZXgnOlxuICAgICAgICByZXR1cm4gbGVuID4+PiAxXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0VG9CeXRlcyhzdHJpbmcpLmxlbmd0aFxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB7XG4gICAgICAgICAgcmV0dXJuIG11c3RNYXRjaCA/IC0xIDogdXRmOFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGggLy8gYXNzdW1lIHV0ZjhcbiAgICAgICAgfVxuICAgICAgICBlbmNvZGluZyA9ICgnJyArIGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuQnVmZmVyLmJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoXG5cbmZ1bmN0aW9uIHNsb3dUb1N0cmluZyAoZW5jb2RpbmcsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcblxuICAvLyBObyBuZWVkIHRvIHZlcmlmeSB0aGF0IFwidGhpcy5sZW5ndGggPD0gTUFYX1VJTlQzMlwiIHNpbmNlIGl0J3MgYSByZWFkLW9ubHlcbiAgLy8gcHJvcGVydHkgb2YgYSB0eXBlZCBhcnJheS5cblxuICAvLyBUaGlzIGJlaGF2ZXMgbmVpdGhlciBsaWtlIFN0cmluZyBub3IgVWludDhBcnJheSBpbiB0aGF0IHdlIHNldCBzdGFydC9lbmRcbiAgLy8gdG8gdGhlaXIgdXBwZXIvbG93ZXIgYm91bmRzIGlmIHRoZSB2YWx1ZSBwYXNzZWQgaXMgb3V0IG9mIHJhbmdlLlxuICAvLyB1bmRlZmluZWQgaXMgaGFuZGxlZCBzcGVjaWFsbHkgYXMgcGVyIEVDTUEtMjYyIDZ0aCBFZGl0aW9uLFxuICAvLyBTZWN0aW9uIDEzLjMuMy43IFJ1bnRpbWUgU2VtYW50aWNzOiBLZXllZEJpbmRpbmdJbml0aWFsaXphdGlvbi5cbiAgaWYgKHN0YXJ0ID09PSB1bmRlZmluZWQgfHwgc3RhcnQgPCAwKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgLy8gUmV0dXJuIGVhcmx5IGlmIHN0YXJ0ID4gdGhpcy5sZW5ndGguIERvbmUgaGVyZSB0byBwcmV2ZW50IHBvdGVudGlhbCB1aW50MzJcbiAgLy8gY29lcmNpb24gZmFpbCBiZWxvdy5cbiAgaWYgKHN0YXJ0ID4gdGhpcy5sZW5ndGgpIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCB8fCBlbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gIH1cblxuICBpZiAoZW5kIDw9IDApIHtcbiAgICByZXR1cm4gJydcbiAgfVxuXG4gIC8vIEZvcmNlIGNvZXJzaW9uIHRvIHVpbnQzMi4gVGhpcyB3aWxsIGFsc28gY29lcmNlIGZhbHNleS9OYU4gdmFsdWVzIHRvIDAuXG4gIGVuZCA+Pj49IDBcbiAgc3RhcnQgPj4+PSAwXG5cbiAgaWYgKGVuZCA8PSBzdGFydCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKCFlbmNvZGluZykgZW5jb2RpbmcgPSAndXRmOCdcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1dGYxNmxlU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKGVuY29kaW5nICsgJycpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbi8vIFRoaXMgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCAoYW5kIHRoZSBgaXMtYnVmZmVyYCBucG0gcGFja2FnZSlcbi8vIHRvIGRldGVjdCBhIEJ1ZmZlciBpbnN0YW5jZS4gSXQncyBub3QgcG9zc2libGUgdG8gdXNlIGBpbnN0YW5jZW9mIEJ1ZmZlcmBcbi8vIHJlbGlhYmx5IGluIGEgYnJvd3NlcmlmeSBjb250ZXh0IGJlY2F1c2UgdGhlcmUgY291bGQgYmUgbXVsdGlwbGUgZGlmZmVyZW50XG4vLyBjb3BpZXMgb2YgdGhlICdidWZmZXInIHBhY2thZ2UgaW4gdXNlLiBUaGlzIG1ldGhvZCB3b3JrcyBldmVuIGZvciBCdWZmZXJcbi8vIGluc3RhbmNlcyB0aGF0IHdlcmUgY3JlYXRlZCBmcm9tIGFub3RoZXIgY29weSBvZiB0aGUgYGJ1ZmZlcmAgcGFja2FnZS5cbi8vIFNlZTogaHR0cHM6Ly9naXRodWIuY29tL2Zlcm9zcy9idWZmZXIvaXNzdWVzLzE1NFxuQnVmZmVyLnByb3RvdHlwZS5faXNCdWZmZXIgPSB0cnVlXG5cbmZ1bmN0aW9uIHN3YXAgKGIsIG4sIG0pIHtcbiAgdmFyIGkgPSBiW25dXG4gIGJbbl0gPSBiW21dXG4gIGJbbV0gPSBpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuc3dhcDE2ID0gZnVuY3Rpb24gc3dhcDE2ICgpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIGlmIChsZW4gJSAyICE9PSAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0J1ZmZlciBzaXplIG11c3QgYmUgYSBtdWx0aXBsZSBvZiAxNi1iaXRzJylcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSArPSAyKSB7XG4gICAgc3dhcCh0aGlzLCBpLCBpICsgMSlcbiAgfVxuICByZXR1cm4gdGhpc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAzMiA9IGZ1bmN0aW9uIHN3YXAzMiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgNCAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMzItYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gNCkge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDMpXG4gICAgc3dhcCh0aGlzLCBpICsgMSwgaSArIDIpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwNjQgPSBmdW5jdGlvbiBzd2FwNjQgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDggIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDY0LWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDgpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyA3KVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyA2KVxuICAgIHN3YXAodGhpcywgaSArIDIsIGkgKyA1KVxuICAgIHN3YXAodGhpcywgaSArIDMsIGkgKyA0KVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0xvY2FsZVN0cmluZyA9IEJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmdcblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgc3RyID0gdGhpcy50b1N0cmluZygnaGV4JywgMCwgbWF4KS5yZXBsYWNlKC8oLnsyfSkvZywgJyQxICcpLnRyaW0oKVxuICBpZiAodGhpcy5sZW5ndGggPiBtYXgpIHN0ciArPSAnIC4uLiAnXG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKHRhcmdldCwgc3RhcnQsIGVuZCwgdGhpc1N0YXJ0LCB0aGlzRW5kKSB7XG4gIGlmIChpc0luc3RhbmNlKHRhcmdldCwgVWludDhBcnJheSkpIHtcbiAgICB0YXJnZXQgPSBCdWZmZXIuZnJvbSh0YXJnZXQsIHRhcmdldC5vZmZzZXQsIHRhcmdldC5ieXRlTGVuZ3RoKVxuICB9XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFxuICAgICAgJ1RoZSBcInRhcmdldFwiIGFyZ3VtZW50IG11c3QgYmUgb25lIG9mIHR5cGUgQnVmZmVyIG9yIFVpbnQ4QXJyYXkuICcgK1xuICAgICAgJ1JlY2VpdmVkIHR5cGUgJyArICh0eXBlb2YgdGFyZ2V0KVxuICAgIClcbiAgfVxuXG4gIGlmIChzdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgc3RhcnQgPSAwXG4gIH1cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5kID0gdGFyZ2V0ID8gdGFyZ2V0Lmxlbmd0aCA6IDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzU3RhcnQgPSAwXG4gIH1cbiAgaWYgKHRoaXNFbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIHRoaXNFbmQgPSB0aGlzLmxlbmd0aFxuICB9XG5cbiAgaWYgKHN0YXJ0IDwgMCB8fCBlbmQgPiB0YXJnZXQubGVuZ3RoIHx8IHRoaXNTdGFydCA8IDAgfHwgdGhpc0VuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ291dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQgJiYgc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDBcbiAgfVxuICBpZiAodGhpc1N0YXJ0ID49IHRoaXNFbmQpIHtcbiAgICByZXR1cm4gLTFcbiAgfVxuICBpZiAoc3RhcnQgPj0gZW5kKSB7XG4gICAgcmV0dXJuIDFcbiAgfVxuXG4gIHN0YXJ0ID4+Pj0gMFxuICBlbmQgPj4+PSAwXG4gIHRoaXNTdGFydCA+Pj49IDBcbiAgdGhpc0VuZCA+Pj49IDBcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0KSByZXR1cm4gMFxuXG4gIHZhciB4ID0gdGhpc0VuZCAtIHRoaXNTdGFydFxuICB2YXIgeSA9IGVuZCAtIHN0YXJ0XG4gIHZhciBsZW4gPSBNYXRoLm1pbih4LCB5KVxuXG4gIHZhciB0aGlzQ29weSA9IHRoaXMuc2xpY2UodGhpc1N0YXJ0LCB0aGlzRW5kKVxuICB2YXIgdGFyZ2V0Q29weSA9IHRhcmdldC5zbGljZShzdGFydCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyArK2kpIHtcbiAgICBpZiAodGhpc0NvcHlbaV0gIT09IHRhcmdldENvcHlbaV0pIHtcbiAgICAgIHggPSB0aGlzQ29weVtpXVxuICAgICAgeSA9IHRhcmdldENvcHlbaV1cbiAgICAgIGJyZWFrXG4gICAgfVxuICB9XG5cbiAgaWYgKHggPCB5KSByZXR1cm4gLTFcbiAgaWYgKHkgPCB4KSByZXR1cm4gMVxuICByZXR1cm4gMFxufVxuXG4vLyBGaW5kcyBlaXRoZXIgdGhlIGZpcnN0IGluZGV4IG9mIGB2YWxgIGluIGBidWZmZXJgIGF0IG9mZnNldCA+PSBgYnl0ZU9mZnNldGAsXG4vLyBPUiB0aGUgbGFzdCBpbmRleCBvZiBgdmFsYCBpbiBgYnVmZmVyYCBhdCBvZmZzZXQgPD0gYGJ5dGVPZmZzZXRgLlxuLy9cbi8vIEFyZ3VtZW50czpcbi8vIC0gYnVmZmVyIC0gYSBCdWZmZXIgdG8gc2VhcmNoXG4vLyAtIHZhbCAtIGEgc3RyaW5nLCBCdWZmZXIsIG9yIG51bWJlclxuLy8gLSBieXRlT2Zmc2V0IC0gYW4gaW5kZXggaW50byBgYnVmZmVyYDsgd2lsbCBiZSBjbGFtcGVkIHRvIGFuIGludDMyXG4vLyAtIGVuY29kaW5nIC0gYW4gb3B0aW9uYWwgZW5jb2RpbmcsIHJlbGV2YW50IGlzIHZhbCBpcyBhIHN0cmluZ1xuLy8gLSBkaXIgLSB0cnVlIGZvciBpbmRleE9mLCBmYWxzZSBmb3IgbGFzdEluZGV4T2ZcbmZ1bmN0aW9uIGJpZGlyZWN0aW9uYWxJbmRleE9mIChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcikge1xuICAvLyBFbXB0eSBidWZmZXIgbWVhbnMgbm8gbWF0Y2hcbiAgaWYgKGJ1ZmZlci5sZW5ndGggPT09IDApIHJldHVybiAtMVxuXG4gIC8vIE5vcm1hbGl6ZSBieXRlT2Zmc2V0XG4gIGlmICh0eXBlb2YgYnl0ZU9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGJ5dGVPZmZzZXRcbiAgICBieXRlT2Zmc2V0ID0gMFxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSB7XG4gICAgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIHtcbiAgICBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgfVxuICBieXRlT2Zmc2V0ID0gK2J5dGVPZmZzZXQgLy8gQ29lcmNlIHRvIE51bWJlci5cbiAgaWYgKG51bWJlcklzTmFOKGJ5dGVPZmZzZXQpKSB7XG4gICAgLy8gYnl0ZU9mZnNldDogaXQgaXQncyB1bmRlZmluZWQsIG51bGwsIE5hTiwgXCJmb29cIiwgZXRjLCBzZWFyY2ggd2hvbGUgYnVmZmVyXG4gICAgYnl0ZU9mZnNldCA9IGRpciA/IDAgOiAoYnVmZmVyLmxlbmd0aCAtIDEpXG4gIH1cblxuICAvLyBOb3JtYWxpemUgYnl0ZU9mZnNldDogbmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBidWZmZXIubGVuZ3RoICsgYnl0ZU9mZnNldFxuICBpZiAoYnl0ZU9mZnNldCA+PSBidWZmZXIubGVuZ3RoKSB7XG4gICAgaWYgKGRpcikgcmV0dXJuIC0xXG4gICAgZWxzZSBieXRlT2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCAtIDFcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgMCkge1xuICAgIGlmIChkaXIpIGJ5dGVPZmZzZXQgPSAwXG4gICAgZWxzZSByZXR1cm4gLTFcbiAgfVxuXG4gIC8vIE5vcm1hbGl6ZSB2YWxcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgdmFsID0gQnVmZmVyLmZyb20odmFsLCBlbmNvZGluZylcbiAgfVxuXG4gIC8vIEZpbmFsbHksIHNlYXJjaCBlaXRoZXIgaW5kZXhPZiAoaWYgZGlyIGlzIHRydWUpIG9yIGxhc3RJbmRleE9mXG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIC8vIFNwZWNpYWwgY2FzZTogbG9va2luZyBmb3IgZW1wdHkgc3RyaW5nL2J1ZmZlciBhbHdheXMgZmFpbHNcbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIC0xXG4gICAgfVxuICAgIHJldHVybiBhcnJheUluZGV4T2YoYnVmZmVyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpXG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAweEZGIC8vIFNlYXJjaCBmb3IgYSBieXRlIHZhbHVlIFswLTI1NV1cbiAgICBpZiAodHlwZW9mIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGlmIChkaXIpIHtcbiAgICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YuY2FsbChidWZmZXIsIHZhbCwgYnl0ZU9mZnNldClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5sYXN0SW5kZXhPZi5jYWxsKGJ1ZmZlciwgdmFsLCBieXRlT2Zmc2V0KVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKGJ1ZmZlciwgWyB2YWwgXSwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGRpcilcbiAgfVxuXG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ3ZhbCBtdXN0IGJlIHN0cmluZywgbnVtYmVyIG9yIEJ1ZmZlcicpXG59XG5cbmZ1bmN0aW9uIGFycmF5SW5kZXhPZiAoYXJyLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCBkaXIpIHtcbiAgdmFyIGluZGV4U2l6ZSA9IDFcbiAgdmFyIGFyckxlbmd0aCA9IGFyci5sZW5ndGhcbiAgdmFyIHZhbExlbmd0aCA9IHZhbC5sZW5ndGhcblxuICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgaWYgKGVuY29kaW5nID09PSAndWNzMicgfHwgZW5jb2RpbmcgPT09ICd1Y3MtMicgfHxcbiAgICAgICAgZW5jb2RpbmcgPT09ICd1dGYxNmxlJyB8fCBlbmNvZGluZyA9PT0gJ3V0Zi0xNmxlJykge1xuICAgICAgaWYgKGFyci5sZW5ndGggPCAyIHx8IHZhbC5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiAtMVxuICAgICAgfVxuICAgICAgaW5kZXhTaXplID0gMlxuICAgICAgYXJyTGVuZ3RoIC89IDJcbiAgICAgIHZhbExlbmd0aCAvPSAyXG4gICAgICBieXRlT2Zmc2V0IC89IDJcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChidWYsIGkpIHtcbiAgICBpZiAoaW5kZXhTaXplID09PSAxKSB7XG4gICAgICByZXR1cm4gYnVmW2ldXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBidWYucmVhZFVJbnQxNkJFKGkgKiBpbmRleFNpemUpXG4gICAgfVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGRpcikge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKGkgPSBieXRlT2Zmc2V0OyBpIDwgYXJyTGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChyZWFkKGFyciwgaSkgPT09IHJlYWQodmFsLCBmb3VuZEluZGV4ID09PSAtMSA/IDAgOiBpIC0gZm91bmRJbmRleCkpIHtcbiAgICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgICBpZiAoaSAtIGZvdW5kSW5kZXggKyAxID09PSB2YWxMZW5ndGgpIHJldHVybiBmb3VuZEluZGV4ICogaW5kZXhTaXplXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoZm91bmRJbmRleCAhPT0gLTEpIGkgLT0gaSAtIGZvdW5kSW5kZXhcbiAgICAgICAgZm91bmRJbmRleCA9IC0xXG4gICAgICB9XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChieXRlT2Zmc2V0ICsgdmFsTGVuZ3RoID4gYXJyTGVuZ3RoKSBieXRlT2Zmc2V0ID0gYXJyTGVuZ3RoIC0gdmFsTGVuZ3RoXG4gICAgZm9yIChpID0gYnl0ZU9mZnNldDsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHZhciBmb3VuZCA9IHRydWVcbiAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdmFsTGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKHJlYWQoYXJyLCBpICsgaikgIT09IHJlYWQodmFsLCBqKSkge1xuICAgICAgICAgIGZvdW5kID0gZmFsc2VcbiAgICAgICAgICBicmVha1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZm91bmQpIHJldHVybiBpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIC0xXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5jbHVkZXMgPSBmdW5jdGlvbiBpbmNsdWRlcyAodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykge1xuICByZXR1cm4gdGhpcy5pbmRleE9mKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpICE9PSAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiBiaWRpcmVjdGlvbmFsSW5kZXhPZih0aGlzLCB2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nLCB0cnVlKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmxhc3RJbmRleE9mID0gZnVuY3Rpb24gbGFzdEluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgcmV0dXJuIGJpZGlyZWN0aW9uYWxJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcsIGZhbHNlKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKG51bWJlcklzTmFOKHBhcnNlZCkpIHJldHVybiBpXG4gICAgYnVmW29mZnNldCArIGldID0gcGFyc2VkXG4gIH1cbiAgcmV0dXJuIGlcbn1cblxuZnVuY3Rpb24gdXRmOFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmOFRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYXNjaWlXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGFzY2lpVG9CeXRlcyhzdHJpbmcpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBsYXRpbjFXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBhc2NpaVdyaXRlKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gYmFzZTY0V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcihiYXNlNjRUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIHVjczJXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKHV0ZjE2bGVUb0J5dGVzKHN0cmluZywgYnVmLmxlbmd0aCAtIG9mZnNldCksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiB3cml0ZSAoc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCwgZW5jb2RpbmcpIHtcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZylcbiAgaWYgKG9mZnNldCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgICBsZW5ndGggPSB0aGlzLmxlbmd0aFxuICAgIG9mZnNldCA9IDBcbiAgLy8gQnVmZmVyI3dyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQgJiYgdHlwZW9mIG9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IG9mZnNldFxuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBvZmZzZXRbLCBsZW5ndGhdWywgZW5jb2RpbmddKVxuICB9IGVsc2UgaWYgKGlzRmluaXRlKG9mZnNldCkpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoID4+PiAwXG4gICAgICBpZiAoZW5jb2RpbmcgPT09IHVuZGVmaW5lZCkgZW5jb2RpbmcgPSAndXRmOCdcbiAgICB9IGVsc2Uge1xuICAgICAgZW5jb2RpbmcgPSBsZW5ndGhcbiAgICAgIGxlbmd0aCA9IHVuZGVmaW5lZFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnQnVmZmVyLndyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldFssIGxlbmd0aF0pIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQnXG4gICAgKVxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2xhdGluMSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgICByZXR1cm4gbGF0aW4xV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgLy8gV2FybmluZzogbWF4TGVuZ3RoIG5vdCB0YWtlbiBpbnRvIGFjY291bnQgaW4gYmFzZTY0V3JpdGVcbiAgICAgICAgcmV0dXJuIGJhc2U2NFdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ3VjczInOlxuICAgICAgY2FzZSAndWNzLTInOlxuICAgICAgY2FzZSAndXRmMTZsZSc6XG4gICAgICBjYXNlICd1dGYtMTZsZSc6XG4gICAgICAgIHJldHVybiB1Y3MyV3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgaWYgKGxvd2VyZWRDYXNlKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9KU09OID0gZnVuY3Rpb24gdG9KU09OICgpIHtcbiAgcmV0dXJuIHtcbiAgICB0eXBlOiAnQnVmZmVyJyxcbiAgICBkYXRhOiBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbCh0aGlzLl9hcnIgfHwgdGhpcywgMClcbiAgfVxufVxuXG5mdW5jdGlvbiBiYXNlNjRTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIGlmIChzdGFydCA9PT0gMCAmJiBlbmQgPT09IGJ1Zi5sZW5ndGgpIHtcbiAgICByZXR1cm4gYmFzZTY0LmZyb21CeXRlQXJyYXkoYnVmKVxuICB9IGVsc2Uge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYuc2xpY2Uoc3RhcnQsIGVuZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gdXRmOFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuICB2YXIgcmVzID0gW11cblxuICB2YXIgaSA9IHN0YXJ0XG4gIHdoaWxlIChpIDwgZW5kKSB7XG4gICAgdmFyIGZpcnN0Qnl0ZSA9IGJ1ZltpXVxuICAgIHZhciBjb2RlUG9pbnQgPSBudWxsXG4gICAgdmFyIGJ5dGVzUGVyU2VxdWVuY2UgPSAoZmlyc3RCeXRlID4gMHhFRikgPyA0XG4gICAgICA6IChmaXJzdEJ5dGUgPiAweERGKSA/IDNcbiAgICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICAgICAgOiAxXG5cbiAgICBpZiAoaSArIGJ5dGVzUGVyU2VxdWVuY2UgPD0gZW5kKSB7XG4gICAgICB2YXIgc2Vjb25kQnl0ZSwgdGhpcmRCeXRlLCBmb3VydGhCeXRlLCB0ZW1wQ29kZVBvaW50XG5cbiAgICAgIHN3aXRjaCAoYnl0ZXNQZXJTZXF1ZW5jZSkge1xuICAgICAgICBjYXNlIDE6XG4gICAgICAgICAgaWYgKGZpcnN0Qnl0ZSA8IDB4ODApIHtcbiAgICAgICAgICAgIGNvZGVQb2ludCA9IGZpcnN0Qnl0ZVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweDFGKSA8PCAweDYgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4N0YpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgaWYgKChzZWNvbmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKHRoaXJkQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHhDIHwgKHNlY29uZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAodGhpcmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3RkYgJiYgKHRlbXBDb2RlUG9pbnQgPCAweEQ4MDAgfHwgdGVtcENvZGVQb2ludCA+IDB4REZGRikpIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDQ6XG4gICAgICAgICAgc2Vjb25kQnl0ZSA9IGJ1ZltpICsgMV1cbiAgICAgICAgICB0aGlyZEJ5dGUgPSBidWZbaSArIDJdXG4gICAgICAgICAgZm91cnRoQnl0ZSA9IGJ1ZltpICsgM11cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODAgJiYgKGZvdXJ0aEJ5dGUgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgICAgdGVtcENvZGVQb2ludCA9IChmaXJzdEJ5dGUgJiAweEYpIDw8IDB4MTIgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4QyB8ICh0aGlyZEJ5dGUgJiAweDNGKSA8PCAweDYgfCAoZm91cnRoQnl0ZSAmIDB4M0YpXG4gICAgICAgICAgICBpZiAodGVtcENvZGVQb2ludCA+IDB4RkZGRiAmJiB0ZW1wQ29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgICAgICAgICAgY29kZVBvaW50ID0gdGVtcENvZGVQb2ludFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29kZVBvaW50ID09PSBudWxsKSB7XG4gICAgICAvLyB3ZSBkaWQgbm90IGdlbmVyYXRlIGEgdmFsaWQgY29kZVBvaW50IHNvIGluc2VydCBhXG4gICAgICAvLyByZXBsYWNlbWVudCBjaGFyIChVK0ZGRkQpIGFuZCBhZHZhbmNlIG9ubHkgMSBieXRlXG4gICAgICBjb2RlUG9pbnQgPSAweEZGRkRcbiAgICAgIGJ5dGVzUGVyU2VxdWVuY2UgPSAxXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPiAweEZGRkYpIHtcbiAgICAgIC8vIGVuY29kZSB0byB1dGYxNiAoc3Vycm9nYXRlIHBhaXIgZGFuY2UpXG4gICAgICBjb2RlUG9pbnQgLT0gMHgxMDAwMFxuICAgICAgcmVzLnB1c2goY29kZVBvaW50ID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKVxuICAgICAgY29kZVBvaW50ID0gMHhEQzAwIHwgY29kZVBvaW50ICYgMHgzRkZcbiAgICB9XG5cbiAgICByZXMucHVzaChjb2RlUG9pbnQpXG4gICAgaSArPSBieXRlc1BlclNlcXVlbmNlXG4gIH1cblxuICByZXR1cm4gZGVjb2RlQ29kZVBvaW50c0FycmF5KHJlcylcbn1cblxuLy8gQmFzZWQgb24gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMjI3NDcyNzIvNjgwNzQyLCB0aGUgYnJvd3NlciB3aXRoXG4vLyB0aGUgbG93ZXN0IGxpbWl0IGlzIENocm9tZSwgd2l0aCAweDEwMDAwIGFyZ3MuXG4vLyBXZSBnbyAxIG1hZ25pdHVkZSBsZXNzLCBmb3Igc2FmZXR5XG52YXIgTUFYX0FSR1VNRU5UU19MRU5HVEggPSAweDEwMDBcblxuZnVuY3Rpb24gZGVjb2RlQ29kZVBvaW50c0FycmF5IChjb2RlUG9pbnRzKSB7XG4gIHZhciBsZW4gPSBjb2RlUG9pbnRzLmxlbmd0aFxuICBpZiAobGVuIDw9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKSB7XG4gICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkoU3RyaW5nLCBjb2RlUG9pbnRzKSAvLyBhdm9pZCBleHRyYSBzbGljZSgpXG4gIH1cblxuICAvLyBEZWNvZGUgaW4gY2h1bmtzIHRvIGF2b2lkIFwiY2FsbCBzdGFjayBzaXplIGV4Y2VlZGVkXCIuXG4gIHZhciByZXMgPSAnJ1xuICB2YXIgaSA9IDBcbiAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICByZXMgKz0gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShcbiAgICAgIFN0cmluZyxcbiAgICAgIGNvZGVQb2ludHMuc2xpY2UoaSwgaSArPSBNQVhfQVJHVU1FTlRTX0xFTkdUSClcbiAgICApXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSAmIDB4N0YpXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBsYXRpbjFTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciByZXQgPSAnJ1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG5cbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICByZXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShidWZbaV0pXG4gIH1cbiAgcmV0dXJuIHJldFxufVxuXG5mdW5jdGlvbiBoZXhTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBsZW4gPSBidWYubGVuZ3RoXG5cbiAgaWYgKCFzdGFydCB8fCBzdGFydCA8IDApIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCB8fCBlbmQgPCAwIHx8IGVuZCA+IGxlbikgZW5kID0gbGVuXG5cbiAgdmFyIG91dCA9ICcnXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgb3V0ICs9IHRvSGV4KGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gb3V0XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVTbGljZSAoYnVmLCBzdGFydCwgZW5kKSB7XG4gIHZhciBieXRlcyA9IGJ1Zi5zbGljZShzdGFydCwgZW5kKVxuICB2YXIgcmVzID0gJydcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBieXRlcy5sZW5ndGg7IGkgKz0gMikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ5dGVzW2ldICsgKGJ5dGVzW2kgKyAxXSAqIDI1NikpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZiA9IHRoaXMuc3ViYXJyYXkoc3RhcnQsIGVuZClcbiAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2VcbiAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgcmV0dXJuIG5ld0J1ZlxufVxuXG4vKlxuICogTmVlZCB0byBtYWtlIHN1cmUgdGhhdCBidWZmZXIgaXNuJ3QgdHJ5aW5nIHRvIHdyaXRlIG91dCBvZiBib3VuZHMuXG4gKi9cbmZ1bmN0aW9uIGNoZWNrT2Zmc2V0IChvZmZzZXQsIGV4dCwgbGVuZ3RoKSB7XG4gIGlmICgob2Zmc2V0ICUgMSkgIT09IDAgfHwgb2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ29mZnNldCBpcyBub3QgdWludCcpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBsZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdUcnlpbmcgdG8gYWNjZXNzIGJleW9uZCBidWZmZXIgbGVuZ3RoJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludExFID0gZnVuY3Rpb24gcmVhZFVJbnRMRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuICB9XG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1ieXRlTGVuZ3RoXVxuICB2YXIgbXVsID0gMVxuICB3aGlsZSAoYnl0ZUxlbmd0aCA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQ4ID0gZnVuY3Rpb24gcmVhZFVJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQxNkxFID0gZnVuY3Rpb24gcmVhZFVJbnQxNkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDgpIHwgdGhpc1tvZmZzZXQgKyAxXVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKCh0aGlzW29mZnNldF0pIHxcbiAgICAgICh0aGlzW29mZnNldCArIDFdIDw8IDgpIHxcbiAgICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSkgK1xuICAgICAgKHRoaXNbb2Zmc2V0ICsgM10gKiAweDEwMDAwMDApXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkJFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIGJ5dGVMZW5ndGgsIHRoaXMubGVuZ3RoKVxuXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF1cbiAgdmFyIG11bCA9IDFcbiAgdmFyIGkgPSAwXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgaV0gKiBtdWxcbiAgfVxuICBtdWwgKj0gMHg4MFxuXG4gIGlmICh2YWwgPj0gbXVsKSB2YWwgLT0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGgpXG5cbiAgcmV0dXJuIHZhbFxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnRCRSA9IGZ1bmN0aW9uIHJlYWRJbnRCRSAob2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGhcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgLS1pXVxuICB3aGlsZSAoaSA+IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyAtLWldICogbXVsXG4gIH1cbiAgbXVsICo9IDB4ODBcblxuICBpZiAodmFsID49IG11bCkgdmFsIC09IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50OCA9IGZ1bmN0aW9uIHJlYWRJbnQ4IChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldF0gfCAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDE2QkUgPSBmdW5jdGlvbiByZWFkSW50MTZCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0ICsgMV0gfCAodGhpc1tvZmZzZXRdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MzJMRSA9IGZ1bmN0aW9uIHJlYWRJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA0LCB0aGlzLmxlbmd0aClcblxuICByZXR1cm4gKHRoaXNbb2Zmc2V0XSA8PCAyNCkgfFxuICAgICh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDNdKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRGbG9hdExFID0gZnVuY3Rpb24gcmVhZEZsb2F0TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCB0cnVlLCAyMywgNClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkRmxvYXRCRSA9IGZ1bmN0aW9uIHJlYWRGbG9hdEJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIHRydWUsIDUyLCA4KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVCRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCA4LCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIGllZWU3NTQucmVhZCh0aGlzLCBvZmZzZXQsIGZhbHNlLCA1MiwgOClcbn1cblxuZnVuY3Rpb24gY2hlY2tJbnQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgZXh0LCBtYXgsIG1pbikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihidWYpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImJ1ZmZlclwiIGFyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgaXMgb3V0IG9mIGJvdW5kcycpXG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnRMRSA9IGZ1bmN0aW9uIHdyaXRlVUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGJ5dGVMZW5ndGggPSBieXRlTGVuZ3RoID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbWF4Qnl0ZXMgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCkgLSAxXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbWF4Qnl0ZXMsIDApXG4gIH1cblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCAoOCAqIGJ5dGVMZW5ndGgpIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSAwXG4gIHZhciBtdWwgPSAxXG4gIHZhciBzdWIgPSAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIGlmICh2YWx1ZSA8IDAgJiYgc3ViID09PSAwICYmIHRoaXNbb2Zmc2V0ICsgaSAtIDFdICE9PSAwKSB7XG4gICAgICBzdWIgPSAxXG4gICAgfVxuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgKDggKiBieXRlTGVuZ3RoKSAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgKyAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4N2YsIC0weDgwKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVJbnQxNkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4N2ZmZmZmZmYsIC0weDgwMDAwMDAwKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgPj4+IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiAxNilcbiAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbmZ1bmN0aW9uIGNoZWNrSUVFRTc1NCAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBleHQsIG1heCwgbWluKSB7XG4gIGlmIChvZmZzZXQgKyBleHQgPiBidWYubGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignSW5kZXggb3V0IG9mIHJhbmdlJylcbiAgaWYgKG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5mdW5jdGlvbiB3cml0ZUZsb2F0IChidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0ID4+PiAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICBjaGVja0lFRUU3NTQoYnVmLCB2YWx1ZSwgb2Zmc2V0LCA0LCAzLjQwMjgyMzQ2NjM4NTI4ODZlKzM4LCAtMy40MDI4MjM0NjYzODUyODg2ZSszOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCAyMywgNClcbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0TEUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRmxvYXRCRSA9IGZ1bmN0aW9uIHdyaXRlRmxvYXRCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRmxvYXQodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG5mdW5jdGlvbiB3cml0ZURvdWJsZSAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4sIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCA+Pj4gMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKHRhcmdldCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2FyZ3VtZW50IHNob3VsZCBiZSBhIEJ1ZmZlcicpXG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAoZW5kIDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3NvdXJjZUVuZCBvdXQgb2YgYm91bmRzJylcblxuICAvLyBBcmUgd2Ugb29iP1xuICBpZiAoZW5kID4gdGhpcy5sZW5ndGgpIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgPCBlbmQgLSBzdGFydCkge1xuICAgIGVuZCA9IHRhcmdldC5sZW5ndGggLSB0YXJnZXRTdGFydCArIHN0YXJ0XG4gIH1cblxuICB2YXIgbGVuID0gZW5kIC0gc3RhcnRcblxuICBpZiAodGhpcyA9PT0gdGFyZ2V0ICYmIHR5cGVvZiBVaW50OEFycmF5LnByb3RvdHlwZS5jb3B5V2l0aGluID09PSAnZnVuY3Rpb24nKSB7XG4gICAgLy8gVXNlIGJ1aWx0LWluIHdoZW4gYXZhaWxhYmxlLCBtaXNzaW5nIGZyb20gSUUxMVxuICAgIHRoaXMuY29weVdpdGhpbih0YXJnZXRTdGFydCwgc3RhcnQsIGVuZClcbiAgfSBlbHNlIGlmICh0aGlzID09PSB0YXJnZXQgJiYgc3RhcnQgPCB0YXJnZXRTdGFydCAmJiB0YXJnZXRTdGFydCA8IGVuZCkge1xuICAgIC8vIGRlc2NlbmRpbmcgY29weSBmcm9tIGVuZFxuICAgIGZvciAodmFyIGkgPSBsZW4gLSAxOyBpID49IDA7IC0taSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpLFxuICAgICAgdGFyZ2V0U3RhcnRcbiAgICApXG4gIH1cblxuICByZXR1cm4gbGVuXG59XG5cbi8vIFVzYWdlOlxuLy8gICAgYnVmZmVyLmZpbGwobnVtYmVyWywgb2Zmc2V0WywgZW5kXV0pXG4vLyAgICBidWZmZXIuZmlsbChidWZmZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKHN0cmluZ1ssIG9mZnNldFssIGVuZF1dWywgZW5jb2RpbmddKVxuQnVmZmVyLnByb3RvdHlwZS5maWxsID0gZnVuY3Rpb24gZmlsbCAodmFsLCBzdGFydCwgZW5kLCBlbmNvZGluZykge1xuICAvLyBIYW5kbGUgc3RyaW5nIGNhc2VzOlxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ3N0cmluZycpIHtcbiAgICBpZiAodHlwZW9mIHN0YXJ0ID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBzdGFydFxuICAgICAgc3RhcnQgPSAwXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGVuZCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGVuY29kaW5nID0gZW5kXG4gICAgICBlbmQgPSB0aGlzLmxlbmd0aFxuICAgIH1cbiAgICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCAmJiB0eXBlb2YgZW5jb2RpbmcgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdlbmNvZGluZyBtdXN0IGJlIGEgc3RyaW5nJylcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZycgJiYgIUJ1ZmZlci5pc0VuY29kaW5nKGVuY29kaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgIH1cbiAgICBpZiAodmFsLmxlbmd0aCA9PT0gMSkge1xuICAgICAgdmFyIGNvZGUgPSB2YWwuY2hhckNvZGVBdCgwKVxuICAgICAgaWYgKChlbmNvZGluZyA9PT0gJ3V0ZjgnICYmIGNvZGUgPCAxMjgpIHx8XG4gICAgICAgICAgZW5jb2RpbmcgPT09ICdsYXRpbjEnKSB7XG4gICAgICAgIC8vIEZhc3QgcGF0aDogSWYgYHZhbGAgZml0cyBpbnRvIGEgc2luZ2xlIGJ5dGUsIHVzZSB0aGF0IG51bWVyaWMgdmFsdWUuXG4gICAgICAgIHZhbCA9IGNvZGVcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICB2YWwgPSB2YWwgJiAyNTVcbiAgfVxuXG4gIC8vIEludmFsaWQgcmFuZ2VzIGFyZSBub3Qgc2V0IHRvIGEgZGVmYXVsdCwgc28gY2FuIHJhbmdlIGNoZWNrIGVhcmx5LlxuICBpZiAoc3RhcnQgPCAwIHx8IHRoaXMubGVuZ3RoIDwgc3RhcnQgfHwgdGhpcy5sZW5ndGggPCBlbmQpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignT3V0IG9mIHJhbmdlIGluZGV4JylcbiAgfVxuXG4gIGlmIChlbmQgPD0gc3RhcnQpIHtcbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgc3RhcnQgPSBzdGFydCA+Pj4gMFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IHRoaXMubGVuZ3RoIDogZW5kID4+PiAwXG5cbiAgaWYgKCF2YWwpIHZhbCA9IDBcblxuICB2YXIgaVxuICBpZiAodHlwZW9mIHZhbCA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgICB0aGlzW2ldID0gdmFsXG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHZhciBieXRlcyA9IEJ1ZmZlci5pc0J1ZmZlcih2YWwpXG4gICAgICA/IHZhbFxuICAgICAgOiBCdWZmZXIuZnJvbSh2YWwsIGVuY29kaW5nKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBpZiAobGVuID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGUgdmFsdWUgXCInICsgdmFsICtcbiAgICAgICAgJ1wiIGlzIGludmFsaWQgZm9yIGFyZ3VtZW50IFwidmFsdWVcIicpXG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBlbmQgLSBzdGFydDsgKytpKSB7XG4gICAgICB0aGlzW2kgKyBzdGFydF0gPSBieXRlc1tpICUgbGVuXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzXG59XG5cbi8vIEhFTFBFUiBGVU5DVElPTlNcbi8vID09PT09PT09PT09PT09PT1cblxudmFyIElOVkFMSURfQkFTRTY0X1JFID0gL1teKy8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgdGFrZXMgZXF1YWwgc2lnbnMgYXMgZW5kIG9mIHRoZSBCYXNlNjQgZW5jb2RpbmdcbiAgc3RyID0gc3RyLnNwbGl0KCc9JylbMF1cbiAgLy8gTm9kZSBzdHJpcHMgb3V0IGludmFsaWQgY2hhcmFjdGVycyBsaWtlIFxcbiBhbmQgXFx0IGZyb20gdGhlIHN0cmluZywgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHN0ciA9IHN0ci50cmltKCkucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG4vLyBBcnJheUJ1ZmZlciBvciBVaW50OEFycmF5IG9iamVjdHMgZnJvbSBvdGhlciBjb250ZXh0cyAoaS5lLiBpZnJhbWVzKSBkbyBub3QgcGFzc1xuLy8gdGhlIGBpbnN0YW5jZW9mYCBjaGVjayBidXQgdGhleSBzaG91bGQgYmUgdHJlYXRlZCBhcyBvZiB0aGF0IHR5cGUuXG4vLyBTZWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9mZXJvc3MvYnVmZmVyL2lzc3Vlcy8xNjZcbmZ1bmN0aW9uIGlzSW5zdGFuY2UgKG9iaiwgdHlwZSkge1xuICByZXR1cm4gb2JqIGluc3RhbmNlb2YgdHlwZSB8fFxuICAgIChvYmogIT0gbnVsbCAmJiBvYmouY29uc3RydWN0b3IgIT0gbnVsbCAmJiBvYmouY29uc3RydWN0b3IubmFtZSAhPSBudWxsICYmXG4gICAgICBvYmouY29uc3RydWN0b3IubmFtZSA9PT0gdHlwZS5uYW1lKVxufVxuZnVuY3Rpb24gbnVtYmVySXNOYU4gKG9iaikge1xuICAvLyBGb3IgSUUxMSBzdXBwb3J0XG4gIHJldHVybiBvYmogIT09IG9iaiAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXNlbGYtY29tcGFyZVxufVxuIiwiLyohIGllZWU3NTQuIEJTRC0zLUNsYXVzZSBMaWNlbnNlLiBGZXJvc3MgQWJvdWtoYWRpamVoIDxodHRwczovL2Zlcm9zcy5vcmcvb3BlbnNvdXJjZT4gKi9cbmV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gKG5CeXRlcyAqIDgpIC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBuQml0cyA9IC03XG4gIHZhciBpID0gaXNMRSA/IChuQnl0ZXMgLSAxKSA6IDBcbiAgdmFyIGQgPSBpc0xFID8gLTEgOiAxXG4gIHZhciBzID0gYnVmZmVyW29mZnNldCArIGldXG5cbiAgaSArPSBkXG5cbiAgZSA9IHMgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgcyA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gZUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBlID0gKGUgKiAyNTYpICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gKG0gKiAyNTYpICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IChuQnl0ZXMgKiA4KSAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgcnQgPSAobUxlbiA9PT0gMjMgPyBNYXRoLnBvdygyLCAtMjQpIC0gTWF0aC5wb3coMiwgLTc3KSA6IDApXG4gIHZhciBpID0gaXNMRSA/IDAgOiAobkJ5dGVzIC0gMSlcbiAgdmFyIGQgPSBpc0xFID8gMSA6IC0xXG4gIHZhciBzID0gdmFsdWUgPCAwIHx8ICh2YWx1ZSA9PT0gMCAmJiAxIC8gdmFsdWUgPCAwKSA/IDEgOiAwXG5cbiAgdmFsdWUgPSBNYXRoLmFicyh2YWx1ZSlcblxuICBpZiAoaXNOYU4odmFsdWUpIHx8IHZhbHVlID09PSBJbmZpbml0eSkge1xuICAgIG0gPSBpc05hTih2YWx1ZSkgPyAxIDogMFxuICAgIGUgPSBlTWF4XG4gIH0gZWxzZSB7XG4gICAgZSA9IE1hdGguZmxvb3IoTWF0aC5sb2codmFsdWUpIC8gTWF0aC5MTjIpXG4gICAgaWYgKHZhbHVlICogKGMgPSBNYXRoLnBvdygyLCAtZSkpIDwgMSkge1xuICAgICAgZS0tXG4gICAgICBjICo9IDJcbiAgICB9XG4gICAgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICB2YWx1ZSArPSBydCAvIGNcbiAgICB9IGVsc2Uge1xuICAgICAgdmFsdWUgKz0gcnQgKiBNYXRoLnBvdygyLCAxIC0gZUJpYXMpXG4gICAgfVxuICAgIGlmICh2YWx1ZSAqIGMgPj0gMikge1xuICAgICAgZSsrXG4gICAgICBjIC89IDJcbiAgICB9XG5cbiAgICBpZiAoZSArIGVCaWFzID49IGVNYXgpIHtcbiAgICAgIG0gPSAwXG4gICAgICBlID0gZU1heFxuICAgIH0gZWxzZSBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIG0gPSAoKHZhbHVlICogYykgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsIid1c2Ugc3RyaWN0JztcbnZhciBEYXRhUmVhZGVyID0gcmVxdWlyZSgnLi9kYXRhUmVhZGVyJyk7XG5cbmZ1bmN0aW9uIEFycmF5UmVhZGVyKGRhdGEpIHtcbiAgICBpZiAoZGF0YSkge1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgICAgICB0aGlzLmxlbmd0aCA9IHRoaXMuZGF0YS5sZW5ndGg7XG4gICAgICAgIHRoaXMuaW5kZXggPSAwO1xuICAgICAgICB0aGlzLnplcm8gPSAwO1xuXG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCB0aGlzLmRhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGRhdGFbaV0gPSBkYXRhW2ldICYgMHhGRjtcbiAgICAgICAgfVxuICAgIH1cbn1cbkFycmF5UmVhZGVyLnByb3RvdHlwZSA9IG5ldyBEYXRhUmVhZGVyKCk7XG4vKipcbiAqIEBzZWUgRGF0YVJlYWRlci5ieXRlQXRcbiAqL1xuQXJyYXlSZWFkZXIucHJvdG90eXBlLmJ5dGVBdCA9IGZ1bmN0aW9uKGkpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhW3RoaXMuemVybyArIGldO1xufTtcbi8qKlxuICogQHNlZSBEYXRhUmVhZGVyLmxhc3RJbmRleE9mU2lnbmF0dXJlXG4gKi9cbkFycmF5UmVhZGVyLnByb3RvdHlwZS5sYXN0SW5kZXhPZlNpZ25hdHVyZSA9IGZ1bmN0aW9uKHNpZykge1xuICAgIHZhciBzaWcwID0gc2lnLmNoYXJDb2RlQXQoMCksXG4gICAgICAgIHNpZzEgPSBzaWcuY2hhckNvZGVBdCgxKSxcbiAgICAgICAgc2lnMiA9IHNpZy5jaGFyQ29kZUF0KDIpLFxuICAgICAgICBzaWczID0gc2lnLmNoYXJDb2RlQXQoMyk7XG4gICAgZm9yICh2YXIgaSA9IHRoaXMubGVuZ3RoIC0gNDsgaSA+PSAwOyAtLWkpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YVtpXSA9PT0gc2lnMCAmJiB0aGlzLmRhdGFbaSArIDFdID09PSBzaWcxICYmIHRoaXMuZGF0YVtpICsgMl0gPT09IHNpZzIgJiYgdGhpcy5kYXRhW2kgKyAzXSA9PT0gc2lnMykge1xuICAgICAgICAgICAgcmV0dXJuIGkgLSB0aGlzLnplcm87XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gLTE7XG59O1xuLyoqXG4gKiBAc2VlIERhdGFSZWFkZXIucmVhZERhdGFcbiAqL1xuQXJyYXlSZWFkZXIucHJvdG90eXBlLnJlYWREYXRhID0gZnVuY3Rpb24oc2l6ZSkge1xuICAgIHRoaXMuY2hlY2tPZmZzZXQoc2l6ZSk7XG4gICAgaWYoc2l6ZSA9PT0gMCkge1xuICAgICAgICByZXR1cm4gW107XG4gICAgfVxuICAgIHZhciByZXN1bHQgPSB0aGlzLmRhdGEuc2xpY2UodGhpcy56ZXJvICsgdGhpcy5pbmRleCwgdGhpcy56ZXJvICsgdGhpcy5pbmRleCArIHNpemUpO1xuICAgIHRoaXMuaW5kZXggKz0gc2l6ZTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcbm1vZHVsZS5leHBvcnRzID0gQXJyYXlSZWFkZXI7XG4iLCIndXNlIHN0cmljdCc7XG4vLyBwcml2YXRlIHByb3BlcnR5XG52YXIgX2tleVN0ciA9IFwiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz1cIjtcblxuXG4vLyBwdWJsaWMgbWV0aG9kIGZvciBlbmNvZGluZ1xuZXhwb3J0cy5lbmNvZGUgPSBmdW5jdGlvbihpbnB1dCwgdXRmOCkge1xuICAgIHZhciBvdXRwdXQgPSBcIlwiO1xuICAgIHZhciBjaHIxLCBjaHIyLCBjaHIzLCBlbmMxLCBlbmMyLCBlbmMzLCBlbmM0O1xuICAgIHZhciBpID0gMDtcblxuICAgIHdoaWxlIChpIDwgaW5wdXQubGVuZ3RoKSB7XG5cbiAgICAgICAgY2hyMSA9IGlucHV0LmNoYXJDb2RlQXQoaSsrKTtcbiAgICAgICAgY2hyMiA9IGlucHV0LmNoYXJDb2RlQXQoaSsrKTtcbiAgICAgICAgY2hyMyA9IGlucHV0LmNoYXJDb2RlQXQoaSsrKTtcblxuICAgICAgICBlbmMxID0gY2hyMSA+PiAyO1xuICAgICAgICBlbmMyID0gKChjaHIxICYgMykgPDwgNCkgfCAoY2hyMiA+PiA0KTtcbiAgICAgICAgZW5jMyA9ICgoY2hyMiAmIDE1KSA8PCAyKSB8IChjaHIzID4+IDYpO1xuICAgICAgICBlbmM0ID0gY2hyMyAmIDYzO1xuXG4gICAgICAgIGlmIChpc05hTihjaHIyKSkge1xuICAgICAgICAgICAgZW5jMyA9IGVuYzQgPSA2NDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChpc05hTihjaHIzKSkge1xuICAgICAgICAgICAgZW5jNCA9IDY0O1xuICAgICAgICB9XG5cbiAgICAgICAgb3V0cHV0ID0gb3V0cHV0ICsgX2tleVN0ci5jaGFyQXQoZW5jMSkgKyBfa2V5U3RyLmNoYXJBdChlbmMyKSArIF9rZXlTdHIuY2hhckF0KGVuYzMpICsgX2tleVN0ci5jaGFyQXQoZW5jNCk7XG5cbiAgICB9XG5cbiAgICByZXR1cm4gb3V0cHV0O1xufTtcblxuLy8gcHVibGljIG1ldGhvZCBmb3IgZGVjb2RpbmdcbmV4cG9ydHMuZGVjb2RlID0gZnVuY3Rpb24oaW5wdXQsIHV0ZjgpIHtcbiAgICB2YXIgb3V0cHV0ID0gXCJcIjtcbiAgICB2YXIgY2hyMSwgY2hyMiwgY2hyMztcbiAgICB2YXIgZW5jMSwgZW5jMiwgZW5jMywgZW5jNDtcbiAgICB2YXIgaSA9IDA7XG5cbiAgICBpbnB1dCA9IGlucHV0LnJlcGxhY2UoL1teQS1aYS16MC05XFwrXFwvXFw9XS9nLCBcIlwiKTtcblxuICAgIHdoaWxlIChpIDwgaW5wdXQubGVuZ3RoKSB7XG5cbiAgICAgICAgZW5jMSA9IF9rZXlTdHIuaW5kZXhPZihpbnB1dC5jaGFyQXQoaSsrKSk7XG4gICAgICAgIGVuYzIgPSBfa2V5U3RyLmluZGV4T2YoaW5wdXQuY2hhckF0KGkrKykpO1xuICAgICAgICBlbmMzID0gX2tleVN0ci5pbmRleE9mKGlucHV0LmNoYXJBdChpKyspKTtcbiAgICAgICAgZW5jNCA9IF9rZXlTdHIuaW5kZXhPZihpbnB1dC5jaGFyQXQoaSsrKSk7XG5cbiAgICAgICAgY2hyMSA9IChlbmMxIDw8IDIpIHwgKGVuYzIgPj4gNCk7XG4gICAgICAgIGNocjIgPSAoKGVuYzIgJiAxNSkgPDwgNCkgfCAoZW5jMyA+PiAyKTtcbiAgICAgICAgY2hyMyA9ICgoZW5jMyAmIDMpIDw8IDYpIHwgZW5jNDtcblxuICAgICAgICBvdXRwdXQgPSBvdXRwdXQgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGNocjEpO1xuXG4gICAgICAgIGlmIChlbmMzICE9IDY0KSB7XG4gICAgICAgICAgICBvdXRwdXQgPSBvdXRwdXQgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGNocjIpO1xuICAgICAgICB9XG4gICAgICAgIGlmIChlbmM0ICE9IDY0KSB7XG4gICAgICAgICAgICBvdXRwdXQgPSBvdXRwdXQgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGNocjMpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbiAgICByZXR1cm4gb3V0cHV0O1xuXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuZnVuY3Rpb24gQ29tcHJlc3NlZE9iamVjdCgpIHtcbiAgICB0aGlzLmNvbXByZXNzZWRTaXplID0gMDtcbiAgICB0aGlzLnVuY29tcHJlc3NlZFNpemUgPSAwO1xuICAgIHRoaXMuY3JjMzIgPSAwO1xuICAgIHRoaXMuY29tcHJlc3Npb25NZXRob2QgPSBudWxsO1xuICAgIHRoaXMuY29tcHJlc3NlZENvbnRlbnQgPSBudWxsO1xufVxuXG5Db21wcmVzc2VkT2JqZWN0LnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBSZXR1cm4gdGhlIGRlY29tcHJlc3NlZCBjb250ZW50IGluIGFuIHVuc3BlY2lmaWVkIGZvcm1hdC5cbiAgICAgKiBUaGUgZm9ybWF0IHdpbGwgZGVwZW5kIG9uIHRoZSBkZWNvbXByZXNzb3IuXG4gICAgICogQHJldHVybiB7T2JqZWN0fSB0aGUgZGVjb21wcmVzc2VkIGNvbnRlbnQuXG4gICAgICovXG4gICAgZ2V0Q29udGVudDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBudWxsOyAvLyBzZWUgaW1wbGVtZW50YXRpb25cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgY29tcHJlc3NlZCBjb250ZW50IGluIGFuIHVuc3BlY2lmaWVkIGZvcm1hdC5cbiAgICAgKiBUaGUgZm9ybWF0IHdpbGwgZGVwZW5kIG9uIHRoZSBjb21wcmVzc2VkIGNvbnRlbiBzb3VyY2UuXG4gICAgICogQHJldHVybiB7T2JqZWN0fSB0aGUgY29tcHJlc3NlZCBjb250ZW50LlxuICAgICAqL1xuICAgIGdldENvbXByZXNzZWRDb250ZW50OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7IC8vIHNlZSBpbXBsZW1lbnRhdGlvblxuICAgIH1cbn07XG5tb2R1bGUuZXhwb3J0cyA9IENvbXByZXNzZWRPYmplY3Q7XG4iLCIndXNlIHN0cmljdCc7XG5leHBvcnRzLlNUT1JFID0ge1xuICAgIG1hZ2ljOiBcIlxceDAwXFx4MDBcIixcbiAgICBjb21wcmVzczogZnVuY3Rpb24oY29udGVudCwgY29tcHJlc3Npb25PcHRpb25zKSB7XG4gICAgICAgIHJldHVybiBjb250ZW50OyAvLyBubyBjb21wcmVzc2lvblxuICAgIH0sXG4gICAgdW5jb21wcmVzczogZnVuY3Rpb24oY29udGVudCkge1xuICAgICAgICByZXR1cm4gY29udGVudDsgLy8gbm8gY29tcHJlc3Npb25cbiAgICB9LFxuICAgIGNvbXByZXNzSW5wdXRUeXBlOiBudWxsLFxuICAgIHVuY29tcHJlc3NJbnB1dFR5cGU6IG51bGxcbn07XG5leHBvcnRzLkRFRkxBVEUgPSByZXF1aXJlKCcuL2ZsYXRlJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxudmFyIHRhYmxlID0gW1xuICAgIDB4MDAwMDAwMDAsIDB4NzcwNzMwOTYsIDB4RUUwRTYxMkMsIDB4OTkwOTUxQkEsXG4gICAgMHgwNzZEQzQxOSwgMHg3MDZBRjQ4RiwgMHhFOTYzQTUzNSwgMHg5RTY0OTVBMyxcbiAgICAweDBFREI4ODMyLCAweDc5RENCOEE0LCAweEUwRDVFOTFFLCAweDk3RDJEOTg4LFxuICAgIDB4MDlCNjRDMkIsIDB4N0VCMTdDQkQsIDB4RTdCODJEMDcsIDB4OTBCRjFEOTEsXG4gICAgMHgxREI3MTA2NCwgMHg2QUIwMjBGMiwgMHhGM0I5NzE0OCwgMHg4NEJFNDFERSxcbiAgICAweDFBREFENDdELCAweDZERERFNEVCLCAweEY0RDRCNTUxLCAweDgzRDM4NUM3LFxuICAgIDB4MTM2Qzk4NTYsIDB4NjQ2QkE4QzAsIDB4RkQ2MkY5N0EsIDB4OEE2NUM5RUMsXG4gICAgMHgxNDAxNUM0RiwgMHg2MzA2NkNEOSwgMHhGQTBGM0Q2MywgMHg4RDA4MERGNSxcbiAgICAweDNCNkUyMEM4LCAweDRDNjkxMDVFLCAweEQ1NjA0MUU0LCAweEEyNjc3MTcyLFxuICAgIDB4M0MwM0U0RDEsIDB4NEIwNEQ0NDcsIDB4RDIwRDg1RkQsIDB4QTUwQUI1NkIsXG4gICAgMHgzNUI1QThGQSwgMHg0MkIyOTg2QywgMHhEQkJCQzlENiwgMHhBQ0JDRjk0MCxcbiAgICAweDMyRDg2Q0UzLCAweDQ1REY1Qzc1LCAweERDRDYwRENGLCAweEFCRDEzRDU5LFxuICAgIDB4MjZEOTMwQUMsIDB4NTFERTAwM0EsIDB4QzhENzUxODAsIDB4QkZEMDYxMTYsXG4gICAgMHgyMUI0RjRCNSwgMHg1NkIzQzQyMywgMHhDRkJBOTU5OSwgMHhCOEJEQTUwRixcbiAgICAweDI4MDJCODlFLCAweDVGMDU4ODA4LCAweEM2MENEOUIyLCAweEIxMEJFOTI0LFxuICAgIDB4MkY2RjdDODcsIDB4NTg2ODRDMTEsIDB4QzE2MTFEQUIsIDB4QjY2NjJEM0QsXG4gICAgMHg3NkRDNDE5MCwgMHgwMURCNzEwNiwgMHg5OEQyMjBCQywgMHhFRkQ1MTAyQSxcbiAgICAweDcxQjE4NTg5LCAweDA2QjZCNTFGLCAweDlGQkZFNEE1LCAweEU4QjhENDMzLFxuICAgIDB4NzgwN0M5QTIsIDB4MEYwMEY5MzQsIDB4OTYwOUE4OEUsIDB4RTEwRTk4MTgsXG4gICAgMHg3RjZBMERCQiwgMHgwODZEM0QyRCwgMHg5MTY0NkM5NywgMHhFNjYzNUMwMSxcbiAgICAweDZCNkI1MUY0LCAweDFDNkM2MTYyLCAweDg1NjUzMEQ4LCAweEYyNjIwMDRFLFxuICAgIDB4NkMwNjk1RUQsIDB4MUIwMUE1N0IsIDB4ODIwOEY0QzEsIDB4RjUwRkM0NTcsXG4gICAgMHg2NUIwRDlDNiwgMHgxMkI3RTk1MCwgMHg4QkJFQjhFQSwgMHhGQ0I5ODg3QyxcbiAgICAweDYyREQxRERGLCAweDE1REEyRDQ5LCAweDhDRDM3Q0YzLCAweEZCRDQ0QzY1LFxuICAgIDB4NERCMjYxNTgsIDB4M0FCNTUxQ0UsIDB4QTNCQzAwNzQsIDB4RDRCQjMwRTIsXG4gICAgMHg0QURGQTU0MSwgMHgzREQ4OTVENywgMHhBNEQxQzQ2RCwgMHhEM0Q2RjRGQixcbiAgICAweDQzNjlFOTZBLCAweDM0NkVEOUZDLCAweEFENjc4ODQ2LCAweERBNjBCOEQwLFxuICAgIDB4NDQwNDJENzMsIDB4MzMwMzFERTUsIDB4QUEwQTRDNUYsIDB4REQwRDdDQzksXG4gICAgMHg1MDA1NzEzQywgMHgyNzAyNDFBQSwgMHhCRTBCMTAxMCwgMHhDOTBDMjA4NixcbiAgICAweDU3NjhCNTI1LCAweDIwNkY4NUIzLCAweEI5NjZENDA5LCAweENFNjFFNDlGLFxuICAgIDB4NUVERUY5MEUsIDB4MjlEOUM5OTgsIDB4QjBEMDk4MjIsIDB4QzdEN0E4QjQsXG4gICAgMHg1OUIzM0QxNywgMHgyRUI0MEQ4MSwgMHhCN0JENUMzQiwgMHhDMEJBNkNBRCxcbiAgICAweEVEQjg4MzIwLCAweDlBQkZCM0I2LCAweDAzQjZFMjBDLCAweDc0QjFEMjlBLFxuICAgIDB4RUFENTQ3MzksIDB4OUREMjc3QUYsIDB4MDREQjI2MTUsIDB4NzNEQzE2ODMsXG4gICAgMHhFMzYzMEIxMiwgMHg5NDY0M0I4NCwgMHgwRDZENkEzRSwgMHg3QTZBNUFBOCxcbiAgICAweEU0MEVDRjBCLCAweDkzMDlGRjlELCAweDBBMDBBRTI3LCAweDdEMDc5RUIxLFxuICAgIDB4RjAwRjkzNDQsIDB4ODcwOEEzRDIsIDB4MUUwMUYyNjgsIDB4NjkwNkMyRkUsXG4gICAgMHhGNzYyNTc1RCwgMHg4MDY1NjdDQiwgMHgxOTZDMzY3MSwgMHg2RTZCMDZFNyxcbiAgICAweEZFRDQxQjc2LCAweDg5RDMyQkUwLCAweDEwREE3QTVBLCAweDY3REQ0QUNDLFxuICAgIDB4RjlCOURGNkYsIDB4OEVCRUVGRjksIDB4MTdCN0JFNDMsIDB4NjBCMDhFRDUsXG4gICAgMHhENkQ2QTNFOCwgMHhBMUQxOTM3RSwgMHgzOEQ4QzJDNCwgMHg0RkRGRjI1MixcbiAgICAweEQxQkI2N0YxLCAweEE2QkM1NzY3LCAweDNGQjUwNkRELCAweDQ4QjIzNjRCLFxuICAgIDB4RDgwRDJCREEsIDB4QUYwQTFCNEMsIDB4MzYwMzRBRjYsIDB4NDEwNDdBNjAsXG4gICAgMHhERjYwRUZDMywgMHhBODY3REY1NSwgMHgzMTZFOEVFRiwgMHg0NjY5QkU3OSxcbiAgICAweENCNjFCMzhDLCAweEJDNjY4MzFBLCAweDI1NkZEMkEwLCAweDUyNjhFMjM2LFxuICAgIDB4Q0MwQzc3OTUsIDB4QkIwQjQ3MDMsIDB4MjIwMjE2QjksIDB4NTUwNTI2MkYsXG4gICAgMHhDNUJBM0JCRSwgMHhCMkJEMEIyOCwgMHgyQkI0NUE5MiwgMHg1Q0IzNkEwNCxcbiAgICAweEMyRDdGRkE3LCAweEI1RDBDRjMxLCAweDJDRDk5RThCLCAweDVCREVBRTFELFxuICAgIDB4OUI2NEMyQjAsIDB4RUM2M0YyMjYsIDB4NzU2QUEzOUMsIDB4MDI2RDkzMEEsXG4gICAgMHg5QzA5MDZBOSwgMHhFQjBFMzYzRiwgMHg3MjA3Njc4NSwgMHgwNTAwNTcxMyxcbiAgICAweDk1QkY0QTgyLCAweEUyQjg3QTE0LCAweDdCQjEyQkFFLCAweDBDQjYxQjM4LFxuICAgIDB4OTJEMjhFOUIsIDB4RTVENUJFMEQsIDB4N0NEQ0VGQjcsIDB4MEJEQkRGMjEsXG4gICAgMHg4NkQzRDJENCwgMHhGMUQ0RTI0MiwgMHg2OEREQjNGOCwgMHgxRkRBODM2RSxcbiAgICAweDgxQkUxNkNELCAweEY2QjkyNjVCLCAweDZGQjA3N0UxLCAweDE4Qjc0Nzc3LFxuICAgIDB4ODgwODVBRTYsIDB4RkYwRjZBNzAsIDB4NjYwNjNCQ0EsIDB4MTEwMTBCNUMsXG4gICAgMHg4RjY1OUVGRiwgMHhGODYyQUU2OSwgMHg2MTZCRkZEMywgMHgxNjZDQ0Y0NSxcbiAgICAweEEwMEFFMjc4LCAweEQ3MEREMkVFLCAweDRFMDQ4MzU0LCAweDM5MDNCM0MyLFxuICAgIDB4QTc2NzI2NjEsIDB4RDA2MDE2RjcsIDB4NDk2OTQ3NEQsIDB4M0U2RTc3REIsXG4gICAgMHhBRUQxNkE0QSwgMHhEOUQ2NUFEQywgMHg0MERGMEI2NiwgMHgzN0Q4M0JGMCxcbiAgICAweEE5QkNBRTUzLCAweERFQkI5RUM1LCAweDQ3QjJDRjdGLCAweDMwQjVGRkU5LFxuICAgIDB4QkRCREYyMUMsIDB4Q0FCQUMyOEEsIDB4NTNCMzkzMzAsIDB4MjRCNEEzQTYsXG4gICAgMHhCQUQwMzYwNSwgMHhDREQ3MDY5MywgMHg1NERFNTcyOSwgMHgyM0Q5NjdCRixcbiAgICAweEIzNjY3QTJFLCAweEM0NjE0QUI4LCAweDVENjgxQjAyLCAweDJBNkYyQjk0LFxuICAgIDB4QjQwQkJFMzcsIDB4QzMwQzhFQTEsIDB4NUEwNURGMUIsIDB4MkQwMkVGOERcbl07XG5cbi8qKlxuICpcbiAqICBKYXZhc2NyaXB0IGNyYzMyXG4gKiAgaHR0cDovL3d3dy53ZWJ0b29sa2l0LmluZm8vXG4gKlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNyYzMyKGlucHV0LCBjcmMpIHtcbiAgICBpZiAodHlwZW9mIGlucHV0ID09PSBcInVuZGVmaW5lZFwiIHx8ICFpbnB1dC5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIDA7XG4gICAgfVxuXG4gICAgdmFyIGlzQXJyYXkgPSB1dGlscy5nZXRUeXBlT2YoaW5wdXQpICE9PSBcInN0cmluZ1wiO1xuXG4gICAgaWYgKHR5cGVvZihjcmMpID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgY3JjID0gMDtcbiAgICB9XG4gICAgdmFyIHggPSAwO1xuICAgIHZhciB5ID0gMDtcbiAgICB2YXIgYiA9IDA7XG5cbiAgICBjcmMgPSBjcmMgXiAoLTEpO1xuICAgIGZvciAodmFyIGkgPSAwLCBpVG9wID0gaW5wdXQubGVuZ3RoOyBpIDwgaVRvcDsgaSsrKSB7XG4gICAgICAgIGIgPSBpc0FycmF5ID8gaW5wdXRbaV0gOiBpbnB1dC5jaGFyQ29kZUF0KGkpO1xuICAgICAgICB5ID0gKGNyYyBeIGIpICYgMHhGRjtcbiAgICAgICAgeCA9IHRhYmxlW3ldO1xuICAgICAgICBjcmMgPSAoY3JjID4+PiA4KSBeIHg7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNyYyBeICgtMSk7XG59O1xuLy8gdmltOiBzZXQgc2hpZnR3aWR0aD00IHNvZnR0YWJzdG9wPTQ6XG4iLCIndXNlIHN0cmljdCc7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbmZ1bmN0aW9uIERhdGFSZWFkZXIoZGF0YSkge1xuICAgIHRoaXMuZGF0YSA9IG51bGw7IC8vIHR5cGUgOiBzZWUgaW1wbGVtZW50YXRpb25cbiAgICB0aGlzLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5pbmRleCA9IDA7XG4gICAgdGhpcy56ZXJvID0gMDtcbn1cbkRhdGFSZWFkZXIucHJvdG90eXBlID0ge1xuICAgIC8qKlxuICAgICAqIENoZWNrIHRoYXQgdGhlIG9mZnNldCB3aWxsIG5vdCBnbyB0b28gZmFyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBvZmZzZXQgdGhlIGFkZGl0aW9uYWwgb2Zmc2V0IHRvIGNoZWNrLlxuICAgICAqIEB0aHJvd3Mge0Vycm9yfSBhbiBFcnJvciBpZiB0aGUgb2Zmc2V0IGlzIG91dCBvZiBib3VuZHMuXG4gICAgICovXG4gICAgY2hlY2tPZmZzZXQ6IGZ1bmN0aW9uKG9mZnNldCkge1xuICAgICAgICB0aGlzLmNoZWNrSW5kZXgodGhpcy5pbmRleCArIG9mZnNldCk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBDaGVjayB0aGF0IHRoZSBzcGVjaWZlZCBpbmRleCB3aWxsIG5vdCBiZSB0b28gZmFyLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBuZXdJbmRleCB0aGUgaW5kZXggdG8gY2hlY2suXG4gICAgICogQHRocm93cyB7RXJyb3J9IGFuIEVycm9yIGlmIHRoZSBpbmRleCBpcyBvdXQgb2YgYm91bmRzLlxuICAgICAqL1xuICAgIGNoZWNrSW5kZXg6IGZ1bmN0aW9uKG5ld0luZGV4KSB7XG4gICAgICAgIGlmICh0aGlzLmxlbmd0aCA8IHRoaXMuemVybyArIG5ld0luZGV4IHx8IG5ld0luZGV4IDwgMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5kIG9mIGRhdGEgcmVhY2hlZCAoZGF0YSBsZW5ndGggPSBcIiArIHRoaXMubGVuZ3RoICsgXCIsIGFza2VkIGluZGV4ID0gXCIgKyAobmV3SW5kZXgpICsgXCIpLiBDb3JydXB0ZWQgemlwID9cIik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENoYW5nZSB0aGUgaW5kZXguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG5ld0luZGV4IFRoZSBuZXcgaW5kZXguXG4gICAgICogQHRocm93cyB7RXJyb3J9IGlmIHRoZSBuZXcgaW5kZXggaXMgb3V0IG9mIHRoZSBkYXRhLlxuICAgICAqL1xuICAgIHNldEluZGV4OiBmdW5jdGlvbihuZXdJbmRleCkge1xuICAgICAgICB0aGlzLmNoZWNrSW5kZXgobmV3SW5kZXgpO1xuICAgICAgICB0aGlzLmluZGV4ID0gbmV3SW5kZXg7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBTa2lwIHRoZSBuZXh0IG4gYnl0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IG4gdGhlIG51bWJlciBvZiBieXRlcyB0byBza2lwLlxuICAgICAqIEB0aHJvd3Mge0Vycm9yfSBpZiB0aGUgbmV3IGluZGV4IGlzIG91dCBvZiB0aGUgZGF0YS5cbiAgICAgKi9cbiAgICBza2lwOiBmdW5jdGlvbihuKSB7XG4gICAgICAgIHRoaXMuc2V0SW5kZXgodGhpcy5pbmRleCArIG4pO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBieXRlIGF0IHRoZSBzcGVjaWZpZWQgaW5kZXguXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGkgdGhlIGluZGV4IHRvIHVzZS5cbiAgICAgKiBAcmV0dXJuIHtudW1iZXJ9IGEgYnl0ZS5cbiAgICAgKi9cbiAgICBieXRlQXQ6IGZ1bmN0aW9uKGkpIHtcbiAgICAgICAgLy8gc2VlIGltcGxlbWVudGF0aW9uc1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBuZXh0IG51bWJlciB3aXRoIGEgZ2l2ZW4gYnl0ZSBzaXplLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBzaXplIHRoZSBudW1iZXIgb2YgYnl0ZXMgdG8gcmVhZC5cbiAgICAgKiBAcmV0dXJuIHtudW1iZXJ9IHRoZSBjb3JyZXNwb25kaW5nIG51bWJlci5cbiAgICAgKi9cbiAgICByZWFkSW50OiBmdW5jdGlvbihzaXplKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSAwLFxuICAgICAgICAgICAgaTtcbiAgICAgICAgdGhpcy5jaGVja09mZnNldChzaXplKTtcbiAgICAgICAgZm9yIChpID0gdGhpcy5pbmRleCArIHNpemUgLSAxOyBpID49IHRoaXMuaW5kZXg7IGktLSkge1xuICAgICAgICAgICAgcmVzdWx0ID0gKHJlc3VsdCA8PCA4KSArIHRoaXMuYnl0ZUF0KGkpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuaW5kZXggKz0gc2l6ZTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgbmV4dCBzdHJpbmcgd2l0aCBhIGdpdmVuIGJ5dGUgc2l6ZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gc2l6ZSB0aGUgbnVtYmVyIG9mIGJ5dGVzIHRvIHJlYWQuXG4gICAgICogQHJldHVybiB7c3RyaW5nfSB0aGUgY29ycmVzcG9uZGluZyBzdHJpbmcuXG4gICAgICovXG4gICAgcmVhZFN0cmluZzogZnVuY3Rpb24oc2l6ZSkge1xuICAgICAgICByZXR1cm4gdXRpbHMudHJhbnNmb3JtVG8oXCJzdHJpbmdcIiwgdGhpcy5yZWFkRGF0YShzaXplKSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBHZXQgcmF3IGRhdGEgd2l0aG91dCBjb252ZXJzaW9uLCA8c2l6ZT4gYnl0ZXMuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHNpemUgdGhlIG51bWJlciBvZiBieXRlcyB0byByZWFkLlxuICAgICAqIEByZXR1cm4ge09iamVjdH0gdGhlIHJhdyBkYXRhLCBpbXBsZW1lbnRhdGlvbiBzcGVjaWZpYy5cbiAgICAgKi9cbiAgICByZWFkRGF0YTogZnVuY3Rpb24oc2l6ZSkge1xuICAgICAgICAvLyBzZWUgaW1wbGVtZW50YXRpb25zXG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBGaW5kIHRoZSBsYXN0IG9jY3VyZW5jZSBvZiBhIHppcCBzaWduYXR1cmUgKDQgYnl0ZXMpLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzaWcgdGhlIHNpZ25hdHVyZSB0byBmaW5kLlxuICAgICAqIEByZXR1cm4ge251bWJlcn0gdGhlIGluZGV4IG9mIHRoZSBsYXN0IG9jY3VyZW5jZSwgLTEgaWYgbm90IGZvdW5kLlxuICAgICAqL1xuICAgIGxhc3RJbmRleE9mU2lnbmF0dXJlOiBmdW5jdGlvbihzaWcpIHtcbiAgICAgICAgLy8gc2VlIGltcGxlbWVudGF0aW9uc1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogR2V0IHRoZSBuZXh0IGRhdGUuXG4gICAgICogQHJldHVybiB7RGF0ZX0gdGhlIGRhdGUuXG4gICAgICovXG4gICAgcmVhZERhdGU6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZG9zdGltZSA9IHRoaXMucmVhZEludCg0KTtcbiAgICAgICAgcmV0dXJuIG5ldyBEYXRlKFxuICAgICAgICAoKGRvc3RpbWUgPj4gMjUpICYgMHg3ZikgKyAxOTgwLCAvLyB5ZWFyXG4gICAgICAgICgoZG9zdGltZSA+PiAyMSkgJiAweDBmKSAtIDEsIC8vIG1vbnRoXG4gICAgICAgIChkb3N0aW1lID4+IDE2KSAmIDB4MWYsIC8vIGRheVxuICAgICAgICAoZG9zdGltZSA+PiAxMSkgJiAweDFmLCAvLyBob3VyXG4gICAgICAgIChkb3N0aW1lID4+IDUpICYgMHgzZiwgLy8gbWludXRlXG4gICAgICAgIChkb3N0aW1lICYgMHgxZikgPDwgMSk7IC8vIHNlY29uZFxuICAgIH1cbn07XG5tb2R1bGUuZXhwb3J0cyA9IERhdGFSZWFkZXI7XG4iLCIndXNlIHN0cmljdCc7XG5leHBvcnRzLmJhc2U2NCA9IGZhbHNlO1xuZXhwb3J0cy5iaW5hcnkgPSBmYWxzZTtcbmV4cG9ydHMuZGlyID0gZmFsc2U7XG5leHBvcnRzLmNyZWF0ZUZvbGRlcnMgPSBmYWxzZTtcbmV4cG9ydHMuZGF0ZSA9IG51bGw7XG5leHBvcnRzLmNvbXByZXNzaW9uID0gbnVsbDtcbmV4cG9ydHMuY29tcHJlc3Npb25PcHRpb25zID0gbnVsbDtcbmV4cG9ydHMuY29tbWVudCA9IG51bGw7XG5leHBvcnRzLnVuaXhQZXJtaXNzaW9ucyA9IG51bGw7XG5leHBvcnRzLmRvc1Blcm1pc3Npb25zID0gbnVsbDtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbiB3aXRob3V0IHJlcGxhY2VtZW50LlxuICovXG5leHBvcnRzLnN0cmluZzJiaW5hcnkgPSBmdW5jdGlvbihzdHIpIHtcbiAgICByZXR1cm4gdXRpbHMuc3RyaW5nMmJpbmFyeShzdHIpO1xufTtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbiB3aXRob3V0IHJlcGxhY2VtZW50LlxuICovXG5leHBvcnRzLnN0cmluZzJVaW50OEFycmF5ID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgcmV0dXJuIHV0aWxzLnRyYW5zZm9ybVRvKFwidWludDhhcnJheVwiLCBzdHIpO1xufTtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbiB3aXRob3V0IHJlcGxhY2VtZW50LlxuICovXG5leHBvcnRzLnVpbnQ4QXJyYXkyU3RyaW5nID0gZnVuY3Rpb24oYXJyYXkpIHtcbiAgICByZXR1cm4gdXRpbHMudHJhbnNmb3JtVG8oXCJzdHJpbmdcIiwgYXJyYXkpO1xufTtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbiB3aXRob3V0IHJlcGxhY2VtZW50LlxuICovXG5leHBvcnRzLnN0cmluZzJCbG9iID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgdmFyIGJ1ZmZlciA9IHV0aWxzLnRyYW5zZm9ybVRvKFwiYXJyYXlidWZmZXJcIiwgc3RyKTtcbiAgICByZXR1cm4gdXRpbHMuYXJyYXlCdWZmZXIyQmxvYihidWZmZXIpO1xufTtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbiB3aXRob3V0IHJlcGxhY2VtZW50LlxuICovXG5leHBvcnRzLmFycmF5QnVmZmVyMkJsb2IgPSBmdW5jdGlvbihidWZmZXIpIHtcbiAgICByZXR1cm4gdXRpbHMuYXJyYXlCdWZmZXIyQmxvYihidWZmZXIpO1xufTtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbiB3aXRob3V0IHJlcGxhY2VtZW50LlxuICovXG5leHBvcnRzLnRyYW5zZm9ybVRvID0gZnVuY3Rpb24ob3V0cHV0VHlwZSwgaW5wdXQpIHtcbiAgICByZXR1cm4gdXRpbHMudHJhbnNmb3JtVG8ob3V0cHV0VHlwZSwgaW5wdXQpO1xufTtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbiB3aXRob3V0IHJlcGxhY2VtZW50LlxuICovXG5leHBvcnRzLmdldFR5cGVPZiA9IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgcmV0dXJuIHV0aWxzLmdldFR5cGVPZihpbnB1dCk7XG59O1xuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIHdpdGhvdXQgcmVwbGFjZW1lbnQuXG4gKi9cbmV4cG9ydHMuY2hlY2tTdXBwb3J0ID0gZnVuY3Rpb24odHlwZSkge1xuICAgIHJldHVybiB1dGlscy5jaGVja1N1cHBvcnQodHlwZSk7XG59O1xuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKiBUaGlzIHZhbHVlIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIHdpdGhvdXQgcmVwbGFjZW1lbnQuXG4gKi9cbmV4cG9ydHMuTUFYX1ZBTFVFXzE2QklUUyA9IHV0aWxzLk1BWF9WQUxVRV8xNkJJVFM7XG5cbi8qKlxuICogQGRlcHJlY2F0ZWRcbiAqIFRoaXMgdmFsdWUgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHZlcnNpb24gd2l0aG91dCByZXBsYWNlbWVudC5cbiAqL1xuZXhwb3J0cy5NQVhfVkFMVUVfMzJCSVRTID0gdXRpbHMuTUFYX1ZBTFVFXzMyQklUUztcblxuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIHdpdGhvdXQgcmVwbGFjZW1lbnQuXG4gKi9cbmV4cG9ydHMucHJldHR5ID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgcmV0dXJuIHV0aWxzLnByZXR0eShzdHIpO1xufTtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZFxuICogVGhpcyBmdW5jdGlvbiB3aWxsIGJlIHJlbW92ZWQgaW4gYSBmdXR1cmUgdmVyc2lvbiB3aXRob3V0IHJlcGxhY2VtZW50LlxuICovXG5leHBvcnRzLmZpbmRDb21wcmVzc2lvbiA9IGZ1bmN0aW9uKGNvbXByZXNzaW9uTWV0aG9kKSB7XG4gICAgcmV0dXJuIHV0aWxzLmZpbmRDb21wcmVzc2lvbihjb21wcmVzc2lvbk1ldGhvZCk7XG59O1xuXG4vKipcbiAqIEBkZXByZWNhdGVkXG4gKiBUaGlzIGZ1bmN0aW9uIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIHdpdGhvdXQgcmVwbGFjZW1lbnQuXG4gKi9cbmV4cG9ydHMuaXNSZWdFeHAgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIHV0aWxzLmlzUmVnRXhwKG9iamVjdCk7XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG52YXIgVVNFX1RZUEVEQVJSQVkgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSAmJiAodHlwZW9mIFVpbnQxNkFycmF5ICE9PSAndW5kZWZpbmVkJykgJiYgKHR5cGVvZiBVaW50MzJBcnJheSAhPT0gJ3VuZGVmaW5lZCcpO1xuXG52YXIgcGFrbyA9IHJlcXVpcmUoXCJwYWtvXCIpO1xuZXhwb3J0cy51bmNvbXByZXNzSW5wdXRUeXBlID0gVVNFX1RZUEVEQVJSQVkgPyBcInVpbnQ4YXJyYXlcIiA6IFwiYXJyYXlcIjtcbmV4cG9ydHMuY29tcHJlc3NJbnB1dFR5cGUgPSBVU0VfVFlQRURBUlJBWSA/IFwidWludDhhcnJheVwiIDogXCJhcnJheVwiO1xuXG5leHBvcnRzLm1hZ2ljID0gXCJcXHgwOFxceDAwXCI7XG5leHBvcnRzLmNvbXByZXNzID0gZnVuY3Rpb24oaW5wdXQsIGNvbXByZXNzaW9uT3B0aW9ucykge1xuICAgIHJldHVybiBwYWtvLmRlZmxhdGVSYXcoaW5wdXQsIHtcbiAgICAgICAgbGV2ZWwgOiBjb21wcmVzc2lvbk9wdGlvbnMubGV2ZWwgfHwgLTEgLy8gZGVmYXVsdCBjb21wcmVzc2lvblxuICAgIH0pO1xufTtcbmV4cG9ydHMudW5jb21wcmVzcyA9ICBmdW5jdGlvbihpbnB1dCkge1xuICAgIHJldHVybiBwYWtvLmluZmxhdGVSYXcoaW5wdXQpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGJhc2U2NCA9IHJlcXVpcmUoJy4vYmFzZTY0Jyk7XG5cbi8qKlxuVXNhZ2U6XG4gICB6aXAgPSBuZXcgSlNaaXAoKTtcbiAgIHppcC5maWxlKFwiaGVsbG8udHh0XCIsIFwiSGVsbG8sIFdvcmxkIVwiKS5maWxlKFwidGVtcGZpbGVcIiwgXCJub3RoaW5nXCIpO1xuICAgemlwLmZvbGRlcihcImltYWdlc1wiKS5maWxlKFwic21pbGUuZ2lmXCIsIGJhc2U2NERhdGEsIHtiYXNlNjQ6IHRydWV9KTtcbiAgIHppcC5maWxlKFwiWG1hcy50eHRcIiwgXCJIbyBobyBobyAhXCIsIHtkYXRlIDogbmV3IERhdGUoXCJEZWNlbWJlciAyNSwgMjAwNyAwMDowMDowMVwiKX0pO1xuICAgemlwLnJlbW92ZShcInRlbXBmaWxlXCIpO1xuXG4gICBiYXNlNjR6aXAgPSB6aXAuZ2VuZXJhdGUoKTtcblxuKiovXG5cbi8qKlxuICogUmVwcmVzZW50YXRpb24gYSBvZiB6aXAgZmlsZSBpbiBqc1xuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge1N0cmluZz18QXJyYXlCdWZmZXI9fFVpbnQ4QXJyYXk9fSBkYXRhIHRoZSBkYXRhIHRvIGxvYWQsIGlmIGFueSAob3B0aW9uYWwpLlxuICogQHBhcmFtIHtPYmplY3Q9fSBvcHRpb25zIHRoZSBvcHRpb25zIGZvciBjcmVhdGluZyB0aGlzIG9iamVjdHMgKG9wdGlvbmFsKS5cbiAqL1xuZnVuY3Rpb24gSlNaaXAoZGF0YSwgb3B0aW9ucykge1xuICAgIC8vIGlmIHRoaXMgY29uc3RydWN0b3IgaXPCoHVzZWQgd2l0aG91dMKgYG5ld2AsIGl0wqBhZGRzIGBuZXdgIGJlZm9yZcKgaXRzZWxmOlxuICAgIGlmKCEodGhpcyBpbnN0YW5jZW9mIEpTWmlwKSkgcmV0dXJuIG5ldyBKU1ppcChkYXRhLCBvcHRpb25zKTtcblxuICAgIC8vIG9iamVjdCBjb250YWluaW5nIHRoZSBmaWxlcyA6XG4gICAgLy8ge1xuICAgIC8vICAgXCJmb2xkZXIvXCIgOiB7Li4ufSxcbiAgICAvLyAgIFwiZm9sZGVyL2RhdGEudHh0XCIgOiB7Li4ufVxuICAgIC8vIH1cbiAgICAvLyBOT1RFOiB3ZSB1c2UgYSBudWxsIHByb3RvdHlwZSBiZWNhdXNlIHdlIGRvIG5vdFxuICAgIC8vIHdhbnQgZmlsZW5hbWVzIGxpa2UgXCJ0b1N0cmluZ1wiIGNvbWluZyBmcm9tIGEgemlwIGZpbGVcbiAgICAvLyB0byBvdmVyd3JpdGUgbWV0aG9kcyBhbmQgYXR0cmlidXRlcyBpbiBhIG5vcm1hbCBPYmplY3QuXG4gICAgdGhpcy5maWxlcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cbiAgICB0aGlzLmNvbW1lbnQgPSBudWxsO1xuXG4gICAgLy8gV2hlcmUgd2UgYXJlIGluIHRoZSBoaWVyYXJjaHlcbiAgICB0aGlzLnJvb3QgPSBcIlwiO1xuICAgIGlmIChkYXRhKSB7XG4gICAgICAgIHRoaXMubG9hZChkYXRhLCBvcHRpb25zKTtcbiAgICB9XG4gICAgdGhpcy5jbG9uZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgbmV3T2JqID0gbmV3IEpTWmlwKCk7XG4gICAgICAgIGZvciAodmFyIGkgaW4gdGhpcykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0aGlzW2ldICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgICAgICBuZXdPYmpbaV0gPSB0aGlzW2ldO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBuZXdPYmo7XG4gICAgfTtcbn1cbkpTWmlwLnByb3RvdHlwZSA9IHJlcXVpcmUoJy4vb2JqZWN0Jyk7XG5KU1ppcC5wcm90b3R5cGUubG9hZCA9IHJlcXVpcmUoJy4vbG9hZCcpO1xuSlNaaXAuc3VwcG9ydCA9IHJlcXVpcmUoJy4vc3VwcG9ydCcpO1xuSlNaaXAuZGVmYXVsdHMgPSByZXF1aXJlKCcuL2RlZmF1bHRzJyk7XG5cbi8qKlxuICogQGRlcHJlY2F0ZWRcbiAqIFRoaXMgbmFtZXNwYWNlIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIHdpdGhvdXQgcmVwbGFjZW1lbnQuXG4gKi9cbkpTWmlwLnV0aWxzID0gcmVxdWlyZSgnLi9kZXByZWNhdGVkUHVibGljVXRpbHMnKTtcblxuSlNaaXAuYmFzZTY0ID0ge1xuICAgIC8qKlxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICogVGhpcyBtZXRob2Qgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHZlcnNpb24gd2l0aG91dCByZXBsYWNlbWVudC5cbiAgICAgKi9cbiAgICBlbmNvZGUgOiBmdW5jdGlvbihpbnB1dCkge1xuICAgICAgICByZXR1cm4gYmFzZTY0LmVuY29kZShpbnB1dCk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqIFRoaXMgbWV0aG9kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIHdpdGhvdXQgcmVwbGFjZW1lbnQuXG4gICAgICovXG4gICAgZGVjb2RlIDogZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIGJhc2U2NC5kZWNvZGUoaW5wdXQpO1xuICAgIH1cbn07XG5KU1ppcC5jb21wcmVzc2lvbnMgPSByZXF1aXJlKCcuL2NvbXByZXNzaW9ucycpO1xubW9kdWxlLmV4cG9ydHMgPSBKU1ppcDtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciBiYXNlNjQgPSByZXF1aXJlKCcuL2Jhc2U2NCcpO1xudmFyIHV0ZjggPSByZXF1aXJlKCcuL3V0ZjgnKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBaaXBFbnRyaWVzID0gcmVxdWlyZSgnLi96aXBFbnRyaWVzJyk7XG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGRhdGEsIG9wdGlvbnMpIHtcbiAgICB2YXIgZmlsZXMsIHppcEVudHJpZXMsIGksIGlucHV0O1xuICAgIG9wdGlvbnMgPSB1dGlscy5leHRlbmQob3B0aW9ucyB8fCB7fSwge1xuICAgICAgICBiYXNlNjQ6IGZhbHNlLFxuICAgICAgICBjaGVja0NSQzMyOiBmYWxzZSxcbiAgICAgICAgb3B0aW1pemVkQmluYXJ5U3RyaW5nIDogZmFsc2UsXG4gICAgICAgIGNyZWF0ZUZvbGRlcnM6IGZhbHNlLFxuICAgICAgICBkZWNvZGVGaWxlTmFtZTogdXRmOC51dGY4ZGVjb2RlXG4gICAgfSk7XG4gICAgaWYgKG9wdGlvbnMuYmFzZTY0KSB7XG4gICAgICAgIGRhdGEgPSBiYXNlNjQuZGVjb2RlKGRhdGEpO1xuICAgIH1cblxuICAgIHppcEVudHJpZXMgPSBuZXcgWmlwRW50cmllcyhkYXRhLCBvcHRpb25zKTtcbiAgICBmaWxlcyA9IHppcEVudHJpZXMuZmlsZXM7XG4gICAgZm9yIChpID0gMDsgaSA8IGZpbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlucHV0ID0gZmlsZXNbaV07XG4gICAgICAgIHRoaXMuZmlsZShpbnB1dC5maWxlTmFtZVN0ciwgaW5wdXQuZGVjb21wcmVzc2VkLCB7XG4gICAgICAgICAgICBiaW5hcnk6IHRydWUsXG4gICAgICAgICAgICBvcHRpbWl6ZWRCaW5hcnlTdHJpbmc6IHRydWUsXG4gICAgICAgICAgICBkYXRlOiBpbnB1dC5kYXRlLFxuICAgICAgICAgICAgZGlyOiBpbnB1dC5kaXIsXG4gICAgICAgICAgICBjb21tZW50IDogaW5wdXQuZmlsZUNvbW1lbnRTdHIubGVuZ3RoID8gaW5wdXQuZmlsZUNvbW1lbnRTdHIgOiBudWxsLFxuICAgICAgICAgICAgdW5peFBlcm1pc3Npb25zIDogaW5wdXQudW5peFBlcm1pc3Npb25zLFxuICAgICAgICAgICAgZG9zUGVybWlzc2lvbnMgOiBpbnB1dC5kb3NQZXJtaXNzaW9ucyxcbiAgICAgICAgICAgIGNyZWF0ZUZvbGRlcnM6IG9wdGlvbnMuY3JlYXRlRm9sZGVyc1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgaWYgKHppcEVudHJpZXMuemlwQ29tbWVudC5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5jb21tZW50ID0gemlwRW50cmllcy56aXBDb21tZW50O1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzO1xufTtcbiIsIid1c2Ugc3RyaWN0Jztcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZGF0YSwgZW5jb2Rpbmcpe1xuICAgIHJldHVybiBuZXcgQnVmZmVyKGRhdGEsIGVuY29kaW5nKTtcbn07XG5tb2R1bGUuZXhwb3J0cy50ZXN0ID0gZnVuY3Rpb24oYil7XG4gICAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihiKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG52YXIgVWludDhBcnJheVJlYWRlciA9IHJlcXVpcmUoJy4vdWludDhBcnJheVJlYWRlcicpO1xuXG5mdW5jdGlvbiBOb2RlQnVmZmVyUmVhZGVyKGRhdGEpIHtcbiAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgIHRoaXMubGVuZ3RoID0gdGhpcy5kYXRhLmxlbmd0aDtcbiAgICB0aGlzLmluZGV4ID0gMDtcbiAgICB0aGlzLnplcm8gPSAwO1xufVxuTm9kZUJ1ZmZlclJlYWRlci5wcm90b3R5cGUgPSBuZXcgVWludDhBcnJheVJlYWRlcigpO1xuXG4vKipcbiAqIEBzZWUgRGF0YVJlYWRlci5yZWFkRGF0YVxuICovXG5Ob2RlQnVmZmVyUmVhZGVyLnByb3RvdHlwZS5yZWFkRGF0YSA9IGZ1bmN0aW9uKHNpemUpIHtcbiAgICB0aGlzLmNoZWNrT2Zmc2V0KHNpemUpO1xuICAgIHZhciByZXN1bHQgPSB0aGlzLmRhdGEuc2xpY2UodGhpcy56ZXJvICsgdGhpcy5pbmRleCwgdGhpcy56ZXJvICsgdGhpcy5pbmRleCArIHNpemUpO1xuICAgIHRoaXMuaW5kZXggKz0gc2l6ZTtcbiAgICByZXR1cm4gcmVzdWx0O1xufTtcbm1vZHVsZS5leHBvcnRzID0gTm9kZUJ1ZmZlclJlYWRlcjtcbiIsIid1c2Ugc3RyaWN0JztcbnZhciBzdXBwb3J0ID0gcmVxdWlyZSgnLi9zdXBwb3J0Jyk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgY3JjMzIgPSByZXF1aXJlKCcuL2NyYzMyJyk7XG52YXIgc2lnbmF0dXJlID0gcmVxdWlyZSgnLi9zaWduYXR1cmUnKTtcbnZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vZGVmYXVsdHMnKTtcbnZhciBiYXNlNjQgPSByZXF1aXJlKCcuL2Jhc2U2NCcpO1xudmFyIGNvbXByZXNzaW9ucyA9IHJlcXVpcmUoJy4vY29tcHJlc3Npb25zJyk7XG52YXIgQ29tcHJlc3NlZE9iamVjdCA9IHJlcXVpcmUoJy4vY29tcHJlc3NlZE9iamVjdCcpO1xudmFyIG5vZGVCdWZmZXIgPSByZXF1aXJlKCcuL25vZGVCdWZmZXInKTtcbnZhciB1dGY4ID0gcmVxdWlyZSgnLi91dGY4Jyk7XG52YXIgU3RyaW5nV3JpdGVyID0gcmVxdWlyZSgnLi9zdHJpbmdXcml0ZXInKTtcbnZhciBVaW50OEFycmF5V3JpdGVyID0gcmVxdWlyZSgnLi91aW50OEFycmF5V3JpdGVyJyk7XG5cbi8qKlxuICogUmV0dXJucyB0aGUgcmF3IGRhdGEgb2YgYSBaaXBPYmplY3QsIGRlY29tcHJlc3MgdGhlIGNvbnRlbnQgaWYgbmVjZXNzYXJ5LlxuICogQHBhcmFtIHtaaXBPYmplY3R9IGZpbGUgdGhlIGZpbGUgdG8gdXNlLlxuICogQHJldHVybiB7U3RyaW5nfEFycmF5QnVmZmVyfFVpbnQ4QXJyYXl8QnVmZmVyfSB0aGUgZGF0YS5cbiAqL1xudmFyIGdldFJhd0RhdGEgPSBmdW5jdGlvbihmaWxlKSB7XG4gICAgaWYgKGZpbGUuX2RhdGEgaW5zdGFuY2VvZiBDb21wcmVzc2VkT2JqZWN0KSB7XG4gICAgICAgIGZpbGUuX2RhdGEgPSBmaWxlLl9kYXRhLmdldENvbnRlbnQoKTtcbiAgICAgICAgZmlsZS5vcHRpb25zLmJpbmFyeSA9IHRydWU7XG4gICAgICAgIGZpbGUub3B0aW9ucy5iYXNlNjQgPSBmYWxzZTtcblxuICAgICAgICBpZiAodXRpbHMuZ2V0VHlwZU9mKGZpbGUuX2RhdGEpID09PSBcInVpbnQ4YXJyYXlcIikge1xuICAgICAgICAgICAgdmFyIGNvcHkgPSBmaWxlLl9kYXRhO1xuICAgICAgICAgICAgLy8gd2hlbiByZWFkaW5nIGFuIGFycmF5YnVmZmVyLCB0aGUgQ29tcHJlc3NlZE9iamVjdCBtZWNoYW5pc20gd2lsbCBrZWVwIGl0IGFuZCBzdWJhcnJheSgpIGEgVWludDhBcnJheS5cbiAgICAgICAgICAgIC8vIGlmIHdlIHJlcXVlc3QgYSBmaWxlIGluIHRoZSBzYW1lIGZvcm1hdCwgd2UgbWlnaHQgZ2V0IHRoZSBzYW1lIFVpbnQ4QXJyYXkgb3IgaXRzIEFycmF5QnVmZmVyICh0aGUgb3JpZ2luYWwgemlwIGZpbGUpLlxuICAgICAgICAgICAgZmlsZS5fZGF0YSA9IG5ldyBVaW50OEFycmF5KGNvcHkubGVuZ3RoKTtcbiAgICAgICAgICAgIC8vIHdpdGggYW4gZW1wdHkgVWludDhBcnJheSwgT3BlcmEgZmFpbHMgd2l0aCBhIFwiT2Zmc2V0IGxhcmdlciB0aGFuIGFycmF5IHNpemVcIlxuICAgICAgICAgICAgaWYgKGNvcHkubGVuZ3RoICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgZmlsZS5fZGF0YS5zZXQoY29weSwgMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZpbGUuX2RhdGE7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGRhdGEgb2YgYSBaaXBPYmplY3QgaW4gYSBiaW5hcnkgZm9ybS4gSWYgdGhlIGNvbnRlbnQgaXMgYW4gdW5pY29kZSBzdHJpbmcsIGVuY29kZSBpdC5cbiAqIEBwYXJhbSB7WmlwT2JqZWN0fSBmaWxlIHRoZSBmaWxlIHRvIHVzZS5cbiAqIEByZXR1cm4ge1N0cmluZ3xBcnJheUJ1ZmZlcnxVaW50OEFycmF5fEJ1ZmZlcn0gdGhlIGRhdGEuXG4gKi9cbnZhciBnZXRCaW5hcnlEYXRhID0gZnVuY3Rpb24oZmlsZSkge1xuICAgIHZhciByZXN1bHQgPSBnZXRSYXdEYXRhKGZpbGUpLFxuICAgICAgICB0eXBlID0gdXRpbHMuZ2V0VHlwZU9mKHJlc3VsdCk7XG4gICAgaWYgKHR5cGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgaWYgKCFmaWxlLm9wdGlvbnMuYmluYXJ5KSB7XG4gICAgICAgICAgICAvLyB1bmljb2RlIHRleHQgIVxuICAgICAgICAgICAgLy8gdW5pY29kZSBzdHJpbmcgPT4gYmluYXJ5IHN0cmluZyBpcyBhIHBhaW5mdWwgcHJvY2VzcywgY2hlY2sgaWYgd2UgY2FuIGF2b2lkIGl0LlxuICAgICAgICAgICAgaWYgKHN1cHBvcnQubm9kZWJ1ZmZlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiBub2RlQnVmZmVyKHJlc3VsdCwgXCJ1dGYtOFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmlsZS5hc0JpbmFyeSgpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcblxuLyoqXG4gKiBUcmFuc2Zvcm0gdGhpcy5fZGF0YSBpbnRvIGEgc3RyaW5nLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gZmlsdGVyIGEgZnVuY3Rpb24gU3RyaW5nIC0+IFN0cmluZywgYXBwbGllZCBpZiBub3QgbnVsbCBvbiB0aGUgcmVzdWx0LlxuICogQHJldHVybiB7U3RyaW5nfSB0aGUgc3RyaW5nIHJlcHJlc2VudGluZyB0aGlzLl9kYXRhLlxuICovXG52YXIgZGF0YVRvU3RyaW5nID0gZnVuY3Rpb24oYXNVVEY4KSB7XG4gICAgdmFyIHJlc3VsdCA9IGdldFJhd0RhdGEodGhpcyk7XG4gICAgaWYgKHJlc3VsdCA9PT0gbnVsbCB8fCB0eXBlb2YgcmVzdWx0ID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cbiAgICAvLyBpZiB0aGUgZGF0YSBpcyBhIGJhc2U2NCBzdHJpbmcsIHdlIGRlY29kZSBpdCBiZWZvcmUgY2hlY2tpbmcgdGhlIGVuY29kaW5nICFcbiAgICBpZiAodGhpcy5vcHRpb25zLmJhc2U2NCkge1xuICAgICAgICByZXN1bHQgPSBiYXNlNjQuZGVjb2RlKHJlc3VsdCk7XG4gICAgfVxuICAgIGlmIChhc1VURjggJiYgdGhpcy5vcHRpb25zLmJpbmFyeSkge1xuICAgICAgICAvLyBKU1ppcC5wcm90b3R5cGUudXRmOGRlY29kZSBzdXBwb3J0cyBhcnJheXMgYXMgaW5wdXRcbiAgICAgICAgLy8gc2tpcCB0byBhcnJheSA9PiBzdHJpbmcgc3RlcCwgdXRmOGRlY29kZSB3aWxsIGRvIGl0LlxuICAgICAgICByZXN1bHQgPSBvdXQudXRmOGRlY29kZShyZXN1bHQpO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgLy8gbm8gdXRmOCB0cmFuc2Zvcm1hdGlvbiwgZG8gdGhlIGFycmF5ID0+IHN0cmluZyBzdGVwLlxuICAgICAgICByZXN1bHQgPSB1dGlscy50cmFuc2Zvcm1UbyhcInN0cmluZ1wiLCByZXN1bHQpO1xuICAgIH1cblxuICAgIGlmICghYXNVVEY4ICYmICF0aGlzLm9wdGlvbnMuYmluYXJ5KSB7XG4gICAgICAgIHJlc3VsdCA9IHV0aWxzLnRyYW5zZm9ybVRvKFwic3RyaW5nXCIsIG91dC51dGY4ZW5jb2RlKHJlc3VsdCkpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcbi8qKlxuICogQSBzaW1wbGUgb2JqZWN0IHJlcHJlc2VudGluZyBhIGZpbGUgaW4gdGhlIHppcCBmaWxlLlxuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge3N0cmluZ30gbmFtZSB0aGUgbmFtZSBvZiB0aGUgZmlsZVxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXlCdWZmZXJ8VWludDhBcnJheXxCdWZmZXJ9IGRhdGEgdGhlIGRhdGFcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIHRoZSBvcHRpb25zIG9mIHRoZSBmaWxlXG4gKi9cbnZhciBaaXBPYmplY3QgPSBmdW5jdGlvbihuYW1lLCBkYXRhLCBvcHRpb25zKSB7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICB0aGlzLmRpciA9IG9wdGlvbnMuZGlyO1xuICAgIHRoaXMuZGF0ZSA9IG9wdGlvbnMuZGF0ZTtcbiAgICB0aGlzLmNvbW1lbnQgPSBvcHRpb25zLmNvbW1lbnQ7XG4gICAgdGhpcy51bml4UGVybWlzc2lvbnMgPSBvcHRpb25zLnVuaXhQZXJtaXNzaW9ucztcbiAgICB0aGlzLmRvc1Blcm1pc3Npb25zID0gb3B0aW9ucy5kb3NQZXJtaXNzaW9ucztcblxuICAgIHRoaXMuX2RhdGEgPSBkYXRhO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAvKlxuICAgICAqIFRoaXMgb2JqZWN0IGNvbnRhaW5zIGluaXRpYWwgdmFsdWVzIGZvciBkaXIgYW5kIGRhdGUuXG4gICAgICogV2l0aCB0aGVtLCB3ZSBjYW4gY2hlY2sgaWYgdGhlIHVzZXIgY2hhbmdlZCB0aGUgZGVwcmVjYXRlZCBtZXRhZGF0YSBpblxuICAgICAqIGBaaXBPYmplY3Qjb3B0aW9uc2Agb3Igbm90LlxuICAgICAqL1xuICAgIHRoaXMuX2luaXRpYWxNZXRhZGF0YSA9IHtcbiAgICAgIGRpciA6IG9wdGlvbnMuZGlyLFxuICAgICAgZGF0ZSA6IG9wdGlvbnMuZGF0ZVxuICAgIH07XG59O1xuXG5aaXBPYmplY3QucHJvdG90eXBlID0ge1xuICAgIC8qKlxuICAgICAqIFJldHVybiB0aGUgY29udGVudCBhcyBVVEY4IHN0cmluZy5cbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IHRoZSBVVEY4IHN0cmluZy5cbiAgICAgKi9cbiAgICBhc1RleHQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gZGF0YVRvU3RyaW5nLmNhbGwodGhpcywgdHJ1ZSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBiaW5hcnkgY29udGVudC5cbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IHRoZSBjb250ZW50IGFzIGJpbmFyeS5cbiAgICAgKi9cbiAgICBhc0JpbmFyeTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBkYXRhVG9TdHJpbmcuY2FsbCh0aGlzLCBmYWxzZSk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBjb250ZW50IGFzIGEgbm9kZWpzIEJ1ZmZlci5cbiAgICAgKiBAcmV0dXJuIHtCdWZmZXJ9IHRoZSBjb250ZW50IGFzIGEgQnVmZmVyLlxuICAgICAqL1xuICAgIGFzTm9kZUJ1ZmZlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByZXN1bHQgPSBnZXRCaW5hcnlEYXRhKHRoaXMpO1xuICAgICAgICByZXR1cm4gdXRpbHMudHJhbnNmb3JtVG8oXCJub2RlYnVmZmVyXCIsIHJlc3VsdCk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBjb250ZW50IGFzIGFuIFVpbnQ4QXJyYXkuXG4gICAgICogQHJldHVybiB7VWludDhBcnJheX0gdGhlIGNvbnRlbnQgYXMgYW4gVWludDhBcnJheS5cbiAgICAgKi9cbiAgICBhc1VpbnQ4QXJyYXk6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gZ2V0QmluYXJ5RGF0YSh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHV0aWxzLnRyYW5zZm9ybVRvKFwidWludDhhcnJheVwiLCByZXN1bHQpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgY29udGVudCBhcyBhbiBBcnJheUJ1ZmZlci5cbiAgICAgKiBAcmV0dXJuIHtBcnJheUJ1ZmZlcn0gdGhlIGNvbnRlbnQgYXMgYW4gQXJyYXlCdWZlci5cbiAgICAgKi9cbiAgICBhc0FycmF5QnVmZmVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYXNVaW50OEFycmF5KCkuYnVmZmVyO1xuICAgIH1cbn07XG5cbi8qKlxuICogVHJhbnNmb3JtIGFuIGludGVnZXIgaW50byBhIHN0cmluZyBpbiBoZXhhZGVjaW1hbC5cbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0ge251bWJlcn0gZGVjIHRoZSBudW1iZXIgdG8gY29udmVydC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBieXRlcyB0aGUgbnVtYmVyIG9mIGJ5dGVzIHRvIGdlbmVyYXRlLlxuICogQHJldHVybnMge3N0cmluZ30gdGhlIHJlc3VsdC5cbiAqL1xudmFyIGRlY1RvSGV4ID0gZnVuY3Rpb24oZGVjLCBieXRlcykge1xuICAgIHZhciBoZXggPSBcIlwiLFxuICAgICAgICBpO1xuICAgIGZvciAoaSA9IDA7IGkgPCBieXRlczsgaSsrKSB7XG4gICAgICAgIGhleCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGRlYyAmIDB4ZmYpO1xuICAgICAgICBkZWMgPSBkZWMgPj4+IDg7XG4gICAgfVxuICAgIHJldHVybiBoZXg7XG59O1xuXG4vKipcbiAqIFRyYW5zZm9ybXMgdGhlIChpbmNvbXBsZXRlKSBvcHRpb25zIGZyb20gdGhlIHVzZXIgaW50byB0aGUgY29tcGxldGVcbiAqIHNldCBvZiBvcHRpb25zIHRvIGNyZWF0ZSBhIGZpbGUuXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IG8gdGhlIG9wdGlvbnMgZnJvbSB0aGUgdXNlci5cbiAqIEByZXR1cm4ge09iamVjdH0gdGhlIGNvbXBsZXRlIHNldCBvZiBvcHRpb25zLlxuICovXG52YXIgcHJlcGFyZUZpbGVBdHRycyA9IGZ1bmN0aW9uKG8pIHtcbiAgICBvID0gbyB8fCB7fTtcbiAgICBpZiAoby5iYXNlNjQgPT09IHRydWUgJiYgKG8uYmluYXJ5ID09PSBudWxsIHx8IG8uYmluYXJ5ID09PSB1bmRlZmluZWQpKSB7XG4gICAgICAgIG8uYmluYXJ5ID0gdHJ1ZTtcbiAgICB9XG4gICAgbyA9IHV0aWxzLmV4dGVuZChvLCBkZWZhdWx0cyk7XG4gICAgby5kYXRlID0gby5kYXRlIHx8IG5ldyBEYXRlKCk7XG4gICAgaWYgKG8uY29tcHJlc3Npb24gIT09IG51bGwpIG8uY29tcHJlc3Npb24gPSBvLmNvbXByZXNzaW9uLnRvVXBwZXJDYXNlKCk7XG5cbiAgICByZXR1cm4gbztcbn07XG5cbi8qKlxuICogQWRkIGEgZmlsZSBpbiB0aGUgY3VycmVudCBmb2xkZXIuXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgdGhlIG5hbWUgb2YgdGhlIGZpbGVcbiAqIEBwYXJhbSB7U3RyaW5nfEFycmF5QnVmZmVyfFVpbnQ4QXJyYXl8QnVmZmVyfSBkYXRhIHRoZSBkYXRhIG9mIHRoZSBmaWxlXG4gKiBAcGFyYW0ge09iamVjdH0gbyB0aGUgb3B0aW9ucyBvZiB0aGUgZmlsZVxuICogQHJldHVybiB7T2JqZWN0fSB0aGUgbmV3IGZpbGUuXG4gKi9cbnZhciBmaWxlQWRkID0gZnVuY3Rpb24obmFtZSwgZGF0YSwgbykge1xuICAgIC8vIGJlIHN1cmUgc3ViIGZvbGRlcnMgZXhpc3RcbiAgICB2YXIgZGF0YVR5cGUgPSB1dGlscy5nZXRUeXBlT2YoZGF0YSksXG4gICAgICAgIHBhcmVudDtcblxuICAgIG8gPSBwcmVwYXJlRmlsZUF0dHJzKG8pO1xuXG4gICAgaWYgKHR5cGVvZiBvLnVuaXhQZXJtaXNzaW9ucyA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICBvLnVuaXhQZXJtaXNzaW9ucyA9IHBhcnNlSW50KG8udW5peFBlcm1pc3Npb25zLCA4KTtcbiAgICB9XG5cbiAgICAvLyBVTlhfSUZESVIgIDAwNDAwMDAgc2VlIHppcGluZm8uY1xuICAgIGlmIChvLnVuaXhQZXJtaXNzaW9ucyAmJiAoby51bml4UGVybWlzc2lvbnMgJiAweDQwMDApKSB7XG4gICAgICAgIG8uZGlyID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gQml0IDQgICAgRGlyZWN0b3J5XG4gICAgaWYgKG8uZG9zUGVybWlzc2lvbnMgJiYgKG8uZG9zUGVybWlzc2lvbnMgJiAweDAwMTApKSB7XG4gICAgICAgIG8uZGlyID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoby5kaXIpIHtcbiAgICAgICAgbmFtZSA9IGZvcmNlVHJhaWxpbmdTbGFzaChuYW1lKTtcbiAgICB9XG5cbiAgICBpZiAoby5jcmVhdGVGb2xkZXJzICYmIChwYXJlbnQgPSBwYXJlbnRGb2xkZXIobmFtZSkpKSB7XG4gICAgICAgIGZvbGRlckFkZC5jYWxsKHRoaXMsIHBhcmVudCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgaWYgKG8uZGlyIHx8IGRhdGEgPT09IG51bGwgfHwgdHlwZW9mIGRhdGEgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgby5iYXNlNjQgPSBmYWxzZTtcbiAgICAgICAgby5iaW5hcnkgPSBmYWxzZTtcbiAgICAgICAgZGF0YSA9IG51bGw7XG4gICAgICAgIGRhdGFUeXBlID0gbnVsbDtcbiAgICB9XG4gICAgZWxzZSBpZiAoZGF0YVR5cGUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgaWYgKG8uYmluYXJ5ICYmICFvLmJhc2U2NCkge1xuICAgICAgICAgICAgLy8gb3B0aW1pemVkQmluYXJ5U3RyaW5nID09IHRydWUgbWVhbnMgdGhhdCB0aGUgZmlsZSBoYXMgYWxyZWFkeSBiZWVuIGZpbHRlcmVkIHdpdGggYSAweEZGIG1hc2tcbiAgICAgICAgICAgIGlmIChvLm9wdGltaXplZEJpbmFyeVN0cmluZyAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIC8vIHRoaXMgaXMgYSBzdHJpbmcsIG5vdCBpbiBhIGJhc2U2NCBmb3JtYXQuXG4gICAgICAgICAgICAgICAgLy8gQmUgc3VyZSB0aGF0IHRoaXMgaXMgYSBjb3JyZWN0IFwiYmluYXJ5IHN0cmluZ1wiXG4gICAgICAgICAgICAgICAgZGF0YSA9IHV0aWxzLnN0cmluZzJiaW5hcnkoZGF0YSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7IC8vIGFycmF5YnVmZmVyLCB1aW50OGFycmF5LCAuLi5cbiAgICAgICAgby5iYXNlNjQgPSBmYWxzZTtcbiAgICAgICAgby5iaW5hcnkgPSB0cnVlO1xuXG4gICAgICAgIGlmICghZGF0YVR5cGUgJiYgIShkYXRhIGluc3RhbmNlb2YgQ29tcHJlc3NlZE9iamVjdCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBkYXRhIG9mICdcIiArIG5hbWUgKyBcIicgaXMgaW4gYW4gdW5zdXBwb3J0ZWQgZm9ybWF0ICFcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBzcGVjaWFsIGNhc2UgOiBpdCdzIHdheSBlYXNpZXIgdG8gd29yayB3aXRoIFVpbnQ4QXJyYXkgdGhhbiB3aXRoIEFycmF5QnVmZmVyXG4gICAgICAgIGlmIChkYXRhVHlwZSA9PT0gXCJhcnJheWJ1ZmZlclwiKSB7XG4gICAgICAgICAgICBkYXRhID0gdXRpbHMudHJhbnNmb3JtVG8oXCJ1aW50OGFycmF5XCIsIGRhdGEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIG9iamVjdCA9IG5ldyBaaXBPYmplY3QobmFtZSwgZGF0YSwgbyk7XG4gICAgdGhpcy5maWxlc1tuYW1lXSA9IG9iamVjdDtcbiAgICByZXR1cm4gb2JqZWN0O1xufTtcblxuLyoqXG4gKiBGaW5kIHRoZSBwYXJlbnQgZm9sZGVyIG9mIHRoZSBwYXRoLlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIHRoZSBwYXRoIHRvIHVzZVxuICogQHJldHVybiB7c3RyaW5nfSB0aGUgcGFyZW50IGZvbGRlciwgb3IgXCJcIlxuICovXG52YXIgcGFyZW50Rm9sZGVyID0gZnVuY3Rpb24gKHBhdGgpIHtcbiAgICBpZiAocGF0aC5zbGljZSgtMSkgPT0gJy8nKSB7XG4gICAgICAgIHBhdGggPSBwYXRoLnN1YnN0cmluZygwLCBwYXRoLmxlbmd0aCAtIDEpO1xuICAgIH1cbiAgICB2YXIgbGFzdFNsYXNoID0gcGF0aC5sYXN0SW5kZXhPZignLycpO1xuICAgIHJldHVybiAobGFzdFNsYXNoID4gMCkgPyBwYXRoLnN1YnN0cmluZygwLCBsYXN0U2xhc2gpIDogXCJcIjtcbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBwYXRoIHdpdGggYSBzbGFzaCBhdCB0aGUgZW5kLlxuICogQHByaXZhdGVcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIHRoZSBwYXRoIHRvIGNoZWNrLlxuICogQHJldHVybiB7U3RyaW5nfSB0aGUgcGF0aCB3aXRoIGEgdHJhaWxpbmcgc2xhc2guXG4gKi9cbnZhciBmb3JjZVRyYWlsaW5nU2xhc2ggPSBmdW5jdGlvbihwYXRoKSB7XG4gICAgLy8gQ2hlY2sgdGhlIG5hbWUgZW5kcyB3aXRoIGEgL1xuICAgIGlmIChwYXRoLnNsaWNlKC0xKSAhPSBcIi9cIikge1xuICAgICAgICBwYXRoICs9IFwiL1wiOyAvLyBJRSBkb2Vzbid0IGxpa2Ugc3Vic3RyKC0xKVxuICAgIH1cbiAgICByZXR1cm4gcGF0aDtcbn07XG4vKipcbiAqIEFkZCBhIChzdWIpIGZvbGRlciBpbiB0aGUgY3VycmVudCBmb2xkZXIuXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgdGhlIGZvbGRlcidzIG5hbWVcbiAqIEBwYXJhbSB7Ym9vbGVhbj19IFtjcmVhdGVGb2xkZXJzXSBJZiB0cnVlLCBhdXRvbWF0aWNhbGx5IGNyZWF0ZSBzdWJcbiAqICBmb2xkZXJzLiBEZWZhdWx0cyB0byBmYWxzZS5cbiAqIEByZXR1cm4ge09iamVjdH0gdGhlIG5ldyBmb2xkZXIuXG4gKi9cbnZhciBmb2xkZXJBZGQgPSBmdW5jdGlvbihuYW1lLCBjcmVhdGVGb2xkZXJzKSB7XG4gICAgY3JlYXRlRm9sZGVycyA9ICh0eXBlb2YgY3JlYXRlRm9sZGVycyAhPT0gJ3VuZGVmaW5lZCcpID8gY3JlYXRlRm9sZGVycyA6IGZhbHNlO1xuXG4gICAgbmFtZSA9IGZvcmNlVHJhaWxpbmdTbGFzaChuYW1lKTtcblxuICAgIC8vIERvZXMgdGhpcyBmb2xkZXIgYWxyZWFkeSBleGlzdD9cbiAgICBpZiAoIXRoaXMuZmlsZXNbbmFtZV0pIHtcbiAgICAgICAgZmlsZUFkZC5jYWxsKHRoaXMsIG5hbWUsIG51bGwsIHtcbiAgICAgICAgICAgIGRpcjogdHJ1ZSxcbiAgICAgICAgICAgIGNyZWF0ZUZvbGRlcnM6IGNyZWF0ZUZvbGRlcnNcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmZpbGVzW25hbWVdO1xufTtcblxuLyoqXG4gKiBHZW5lcmF0ZSBhIEpTWmlwLkNvbXByZXNzZWRPYmplY3QgZm9yIGEgZ2l2ZW4gemlwT2plY3QuXG4gKiBAcGFyYW0ge1ppcE9iamVjdH0gZmlsZSB0aGUgb2JqZWN0IHRvIHJlYWQuXG4gKiBAcGFyYW0ge0pTWmlwLmNvbXByZXNzaW9ufSBjb21wcmVzc2lvbiB0aGUgY29tcHJlc3Npb24gdG8gdXNlLlxuICogQHBhcmFtIHtPYmplY3R9IGNvbXByZXNzaW9uT3B0aW9ucyB0aGUgb3B0aW9ucyB0byB1c2Ugd2hlbiBjb21wcmVzc2luZy5cbiAqIEByZXR1cm4ge0pTWmlwLkNvbXByZXNzZWRPYmplY3R9IHRoZSBjb21wcmVzc2VkIHJlc3VsdC5cbiAqL1xudmFyIGdlbmVyYXRlQ29tcHJlc3NlZE9iamVjdEZyb20gPSBmdW5jdGlvbihmaWxlLCBjb21wcmVzc2lvbiwgY29tcHJlc3Npb25PcHRpb25zKSB7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyBDb21wcmVzc2VkT2JqZWN0KCksXG4gICAgICAgIGNvbnRlbnQ7XG5cbiAgICAvLyB0aGUgZGF0YSBoYXMgbm90IGJlZW4gZGVjb21wcmVzc2VkLCB3ZSBtaWdodCByZXVzZSB0aGluZ3MgIVxuICAgIGlmIChmaWxlLl9kYXRhIGluc3RhbmNlb2YgQ29tcHJlc3NlZE9iamVjdCkge1xuICAgICAgICByZXN1bHQudW5jb21wcmVzc2VkU2l6ZSA9IGZpbGUuX2RhdGEudW5jb21wcmVzc2VkU2l6ZTtcbiAgICAgICAgcmVzdWx0LmNyYzMyID0gZmlsZS5fZGF0YS5jcmMzMjtcblxuICAgICAgICBpZiAocmVzdWx0LnVuY29tcHJlc3NlZFNpemUgPT09IDAgfHwgZmlsZS5kaXIpIHtcbiAgICAgICAgICAgIGNvbXByZXNzaW9uID0gY29tcHJlc3Npb25zWydTVE9SRSddO1xuICAgICAgICAgICAgcmVzdWx0LmNvbXByZXNzZWRDb250ZW50ID0gXCJcIjtcbiAgICAgICAgICAgIHJlc3VsdC5jcmMzMiA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoZmlsZS5fZGF0YS5jb21wcmVzc2lvbk1ldGhvZCA9PT0gY29tcHJlc3Npb24ubWFnaWMpIHtcbiAgICAgICAgICAgIHJlc3VsdC5jb21wcmVzc2VkQ29udGVudCA9IGZpbGUuX2RhdGEuZ2V0Q29tcHJlc3NlZENvbnRlbnQoKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnRlbnQgPSBmaWxlLl9kYXRhLmdldENvbnRlbnQoKTtcbiAgICAgICAgICAgIC8vIG5lZWQgdG8gZGVjb21wcmVzcyAvIHJlY29tcHJlc3NcbiAgICAgICAgICAgIHJlc3VsdC5jb21wcmVzc2VkQ29udGVudCA9IGNvbXByZXNzaW9uLmNvbXByZXNzKHV0aWxzLnRyYW5zZm9ybVRvKGNvbXByZXNzaW9uLmNvbXByZXNzSW5wdXRUeXBlLCBjb250ZW50KSwgY29tcHJlc3Npb25PcHRpb25zKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgLy8gaGF2ZSB1bmNvbXByZXNzZWQgZGF0YVxuICAgICAgICBjb250ZW50ID0gZ2V0QmluYXJ5RGF0YShmaWxlKTtcbiAgICAgICAgaWYgKCFjb250ZW50IHx8IGNvbnRlbnQubGVuZ3RoID09PSAwIHx8IGZpbGUuZGlyKSB7XG4gICAgICAgICAgICBjb21wcmVzc2lvbiA9IGNvbXByZXNzaW9uc1snU1RPUkUnXTtcbiAgICAgICAgICAgIGNvbnRlbnQgPSBcIlwiO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdC51bmNvbXByZXNzZWRTaXplID0gY29udGVudC5sZW5ndGg7XG4gICAgICAgIHJlc3VsdC5jcmMzMiA9IGNyYzMyKGNvbnRlbnQpO1xuICAgICAgICByZXN1bHQuY29tcHJlc3NlZENvbnRlbnQgPSBjb21wcmVzc2lvbi5jb21wcmVzcyh1dGlscy50cmFuc2Zvcm1Ubyhjb21wcmVzc2lvbi5jb21wcmVzc0lucHV0VHlwZSwgY29udGVudCksIGNvbXByZXNzaW9uT3B0aW9ucyk7XG4gICAgfVxuXG4gICAgcmVzdWx0LmNvbXByZXNzZWRTaXplID0gcmVzdWx0LmNvbXByZXNzZWRDb250ZW50Lmxlbmd0aDtcbiAgICByZXN1bHQuY29tcHJlc3Npb25NZXRob2QgPSBjb21wcmVzc2lvbi5tYWdpYztcblxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG5cblxuXG4vKipcbiAqIEdlbmVyYXRlIHRoZSBVTklYIHBhcnQgb2YgdGhlIGV4dGVybmFsIGZpbGUgYXR0cmlidXRlcy5cbiAqIEBwYXJhbSB7T2JqZWN0fSB1bml4UGVybWlzc2lvbnMgdGhlIHVuaXggcGVybWlzc2lvbnMgb3IgbnVsbC5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gaXNEaXIgdHJ1ZSBpZiB0aGUgZW50cnkgaXMgYSBkaXJlY3RvcnksIGZhbHNlIG90aGVyd2lzZS5cbiAqIEByZXR1cm4ge051bWJlcn0gYSAzMiBiaXQgaW50ZWdlci5cbiAqXG4gKiBhZGFwdGVkIGZyb20gaHR0cDovL3VuaXguc3RhY2tleGNoYW5nZS5jb20vcXVlc3Rpb25zLzE0NzA1L3RoZS16aXAtZm9ybWF0cy1leHRlcm5hbC1maWxlLWF0dHJpYnV0ZSA6XG4gKlxuICogVFRUVHNzdHJ3eHJ3eHJ3eDAwMDAwMDAwMDBBRFZTSFJcbiAqIF5eXl5fX19fX19fX19fX19fX19fX19fX19fX19fX19fIGZpbGUgdHlwZSwgc2VlIHppcGluZm8uYyAoVU5YXyopXG4gKiAgICAgXl5eX19fX19fX19fX19fX19fX19fX19fX19fXyBzZXR1aWQsIHNldGdpZCwgc3RpY2t5XG4gKiAgICAgICAgXl5eXl5eXl5eX19fX19fX19fX19fX19fXyBwZXJtaXNzaW9uc1xuICogICAgICAgICAgICAgICAgIF5eXl5eXl5eXl5fX19fX18gbm90IHVzZWQgP1xuICogICAgICAgICAgICAgICAgICAgICAgICAgICBeXl5eXl4gRE9TIGF0dHJpYnV0ZSBiaXRzIDogQXJjaGl2ZSwgRGlyZWN0b3J5LCBWb2x1bWUgbGFiZWwsIFN5c3RlbSBmaWxlLCBIaWRkZW4sIFJlYWQgb25seVxuICovXG52YXIgZ2VuZXJhdGVVbml4RXh0ZXJuYWxGaWxlQXR0ciA9IGZ1bmN0aW9uICh1bml4UGVybWlzc2lvbnMsIGlzRGlyKSB7XG5cbiAgICB2YXIgcmVzdWx0ID0gdW5peFBlcm1pc3Npb25zO1xuICAgIGlmICghdW5peFBlcm1pc3Npb25zKSB7XG4gICAgICAgIC8vIEkgY2FuJ3QgdXNlIG9jdGFsIHZhbHVlcyBpbiBzdHJpY3QgbW9kZSwgaGVuY2UgdGhlIGhleGEuXG4gICAgICAgIC8vICAwNDA3NzUgPT4gMHg0MWZkXG4gICAgICAgIC8vIDAxMDA2NjQgPT4gMHg4MWI0XG4gICAgICAgIHJlc3VsdCA9IGlzRGlyID8gMHg0MWZkIDogMHg4MWI0O1xuICAgIH1cblxuICAgIHJldHVybiAocmVzdWx0ICYgMHhGRkZGKSA8PCAxNjtcbn07XG5cbi8qKlxuICogR2VuZXJhdGUgdGhlIERPUyBwYXJ0IG9mIHRoZSBleHRlcm5hbCBmaWxlIGF0dHJpYnV0ZXMuXG4gKiBAcGFyYW0ge09iamVjdH0gZG9zUGVybWlzc2lvbnMgdGhlIGRvcyBwZXJtaXNzaW9ucyBvciBudWxsLlxuICogQHBhcmFtIHtCb29sZWFufSBpc0RpciB0cnVlIGlmIHRoZSBlbnRyeSBpcyBhIGRpcmVjdG9yeSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICogQHJldHVybiB7TnVtYmVyfSBhIDMyIGJpdCBpbnRlZ2VyLlxuICpcbiAqIEJpdCAwICAgICBSZWFkLU9ubHlcbiAqIEJpdCAxICAgICBIaWRkZW5cbiAqIEJpdCAyICAgICBTeXN0ZW1cbiAqIEJpdCAzICAgICBWb2x1bWUgTGFiZWxcbiAqIEJpdCA0ICAgICBEaXJlY3RvcnlcbiAqIEJpdCA1ICAgICBBcmNoaXZlXG4gKi9cbnZhciBnZW5lcmF0ZURvc0V4dGVybmFsRmlsZUF0dHIgPSBmdW5jdGlvbiAoZG9zUGVybWlzc2lvbnMsIGlzRGlyKSB7XG5cbiAgICAvLyB0aGUgZGlyIGZsYWcgaXMgYWxyZWFkeSBzZXQgZm9yIGNvbXBhdGliaWxpdHlcblxuICAgIHJldHVybiAoZG9zUGVybWlzc2lvbnMgfHwgMCkgICYgMHgzRjtcbn07XG5cbi8qKlxuICogR2VuZXJhdGUgdGhlIHZhcmlvdXMgcGFydHMgdXNlZCBpbiB0aGUgY29uc3RydWN0aW9uIG9mIHRoZSBmaW5hbCB6aXAgZmlsZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBuYW1lIHRoZSBmaWxlIG5hbWUuXG4gKiBAcGFyYW0ge1ppcE9iamVjdH0gZmlsZSB0aGUgZmlsZSBjb250ZW50LlxuICogQHBhcmFtIHtKU1ppcC5Db21wcmVzc2VkT2JqZWN0fSBjb21wcmVzc2VkT2JqZWN0IHRoZSBjb21wcmVzc2VkIG9iamVjdC5cbiAqIEBwYXJhbSB7bnVtYmVyfSBvZmZzZXQgdGhlIGN1cnJlbnQgb2Zmc2V0IGZyb20gdGhlIHN0YXJ0IG9mIHRoZSB6aXAgZmlsZS5cbiAqIEBwYXJhbSB7U3RyaW5nfSBwbGF0Zm9ybSBsZXQncyBwcmV0ZW5kIHdlIGFyZSB0aGlzIHBsYXRmb3JtIChjaGFuZ2UgcGxhdGZvcm0gZGVwZW5kZW50cyBmaWVsZHMpXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBlbmNvZGVGaWxlTmFtZSB0aGUgZnVuY3Rpb24gdG8gZW5jb2RlIHRoZSBmaWxlIG5hbWUgLyBjb21tZW50LlxuICogQHJldHVybiB7b2JqZWN0fSB0aGUgemlwIHBhcnRzLlxuICovXG52YXIgZ2VuZXJhdGVaaXBQYXJ0cyA9IGZ1bmN0aW9uKG5hbWUsIGZpbGUsIGNvbXByZXNzZWRPYmplY3QsIG9mZnNldCwgcGxhdGZvcm0sIGVuY29kZUZpbGVOYW1lKSB7XG4gICAgdmFyIGRhdGEgPSBjb21wcmVzc2VkT2JqZWN0LmNvbXByZXNzZWRDb250ZW50LFxuICAgICAgICB1c2VDdXN0b21FbmNvZGluZyA9IGVuY29kZUZpbGVOYW1lICE9PSB1dGY4LnV0ZjhlbmNvZGUsXG4gICAgICAgIGVuY29kZWRGaWxlTmFtZSA9IHV0aWxzLnRyYW5zZm9ybVRvKFwic3RyaW5nXCIsIGVuY29kZUZpbGVOYW1lKGZpbGUubmFtZSkpLFxuICAgICAgICB1dGZFbmNvZGVkRmlsZU5hbWUgPSB1dGlscy50cmFuc2Zvcm1UbyhcInN0cmluZ1wiLCB1dGY4LnV0ZjhlbmNvZGUoZmlsZS5uYW1lKSksXG4gICAgICAgIGNvbW1lbnQgPSBmaWxlLmNvbW1lbnQgfHwgXCJcIixcbiAgICAgICAgZW5jb2RlZENvbW1lbnQgPSB1dGlscy50cmFuc2Zvcm1UbyhcInN0cmluZ1wiLCBlbmNvZGVGaWxlTmFtZShjb21tZW50KSksXG4gICAgICAgIHV0ZkVuY29kZWRDb21tZW50ID0gdXRpbHMudHJhbnNmb3JtVG8oXCJzdHJpbmdcIiwgdXRmOC51dGY4ZW5jb2RlKGNvbW1lbnQpKSxcbiAgICAgICAgdXNlVVRGOEZvckZpbGVOYW1lID0gdXRmRW5jb2RlZEZpbGVOYW1lLmxlbmd0aCAhPT0gZmlsZS5uYW1lLmxlbmd0aCxcbiAgICAgICAgdXNlVVRGOEZvckNvbW1lbnQgPSB1dGZFbmNvZGVkQ29tbWVudC5sZW5ndGggIT09IGNvbW1lbnQubGVuZ3RoLFxuICAgICAgICBvID0gZmlsZS5vcHRpb25zLFxuICAgICAgICBkb3NUaW1lLFxuICAgICAgICBkb3NEYXRlLFxuICAgICAgICBleHRyYUZpZWxkcyA9IFwiXCIsXG4gICAgICAgIHVuaWNvZGVQYXRoRXh0cmFGaWVsZCA9IFwiXCIsXG4gICAgICAgIHVuaWNvZGVDb21tZW50RXh0cmFGaWVsZCA9IFwiXCIsXG4gICAgICAgIGRpciwgZGF0ZTtcblxuXG4gICAgLy8gaGFuZGxlIHRoZSBkZXByZWNhdGVkIG9wdGlvbnMuZGlyXG4gICAgaWYgKGZpbGUuX2luaXRpYWxNZXRhZGF0YS5kaXIgIT09IGZpbGUuZGlyKSB7XG4gICAgICAgIGRpciA9IGZpbGUuZGlyO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGRpciA9IG8uZGlyO1xuICAgIH1cblxuICAgIC8vIGhhbmRsZSB0aGUgZGVwcmVjYXRlZCBvcHRpb25zLmRhdGVcbiAgICBpZihmaWxlLl9pbml0aWFsTWV0YWRhdGEuZGF0ZSAhPT0gZmlsZS5kYXRlKSB7XG4gICAgICAgIGRhdGUgPSBmaWxlLmRhdGU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgZGF0ZSA9IG8uZGF0ZTtcbiAgICB9XG5cbiAgICB2YXIgZXh0RmlsZUF0dHIgPSAwO1xuICAgIHZhciB2ZXJzaW9uTWFkZUJ5ID0gMDtcbiAgICBpZiAoZGlyKSB7XG4gICAgICAgIC8vIGRvcyBvciB1bml4LCB3ZSBzZXQgdGhlIGRvcyBkaXIgZmxhZ1xuICAgICAgICBleHRGaWxlQXR0ciB8PSAweDAwMDEwO1xuICAgIH1cbiAgICBpZihwbGF0Zm9ybSA9PT0gXCJVTklYXCIpIHtcbiAgICAgICAgdmVyc2lvbk1hZGVCeSA9IDB4MDMxRTsgLy8gVU5JWCwgdmVyc2lvbiAzLjBcbiAgICAgICAgZXh0RmlsZUF0dHIgfD0gZ2VuZXJhdGVVbml4RXh0ZXJuYWxGaWxlQXR0cihmaWxlLnVuaXhQZXJtaXNzaW9ucywgZGlyKTtcbiAgICB9IGVsc2UgeyAvLyBET1Mgb3Igb3RoZXIsIGZhbGxiYWNrIHRvIERPU1xuICAgICAgICB2ZXJzaW9uTWFkZUJ5ID0gMHgwMDE0OyAvLyBET1MsIHZlcnNpb24gMi4wXG4gICAgICAgIGV4dEZpbGVBdHRyIHw9IGdlbmVyYXRlRG9zRXh0ZXJuYWxGaWxlQXR0cihmaWxlLmRvc1Blcm1pc3Npb25zLCBkaXIpO1xuICAgIH1cblxuICAgIC8vIGRhdGVcbiAgICAvLyBAc2VlIGh0dHA6Ly93d3cuZGVsb3JpZS5jb20vZGpncHAvZG9jL3JiaW50ZXIvaXQvNTIvMTMuaHRtbFxuICAgIC8vIEBzZWUgaHR0cDovL3d3dy5kZWxvcmllLmNvbS9kamdwcC9kb2MvcmJpbnRlci9pdC82NS8xNi5odG1sXG4gICAgLy8gQHNlZSBodHRwOi8vd3d3LmRlbG9yaWUuY29tL2RqZ3BwL2RvYy9yYmludGVyL2l0LzY2LzE2Lmh0bWxcblxuICAgIGRvc1RpbWUgPSBkYXRlLmdldEhvdXJzKCk7XG4gICAgZG9zVGltZSA9IGRvc1RpbWUgPDwgNjtcbiAgICBkb3NUaW1lID0gZG9zVGltZSB8IGRhdGUuZ2V0TWludXRlcygpO1xuICAgIGRvc1RpbWUgPSBkb3NUaW1lIDw8IDU7XG4gICAgZG9zVGltZSA9IGRvc1RpbWUgfCBkYXRlLmdldFNlY29uZHMoKSAvIDI7XG5cbiAgICBkb3NEYXRlID0gZGF0ZS5nZXRGdWxsWWVhcigpIC0gMTk4MDtcbiAgICBkb3NEYXRlID0gZG9zRGF0ZSA8PCA0O1xuICAgIGRvc0RhdGUgPSBkb3NEYXRlIHwgKGRhdGUuZ2V0TW9udGgoKSArIDEpO1xuICAgIGRvc0RhdGUgPSBkb3NEYXRlIDw8IDU7XG4gICAgZG9zRGF0ZSA9IGRvc0RhdGUgfCBkYXRlLmdldERhdGUoKTtcblxuICAgIGlmICh1c2VVVEY4Rm9yRmlsZU5hbWUpIHtcbiAgICAgICAgLy8gc2V0IHRoZSB1bmljb2RlIHBhdGggZXh0cmEgZmllbGQuIHVuemlwIG5lZWRzIGF0IGxlYXN0IG9uZSBleHRyYVxuICAgICAgICAvLyBmaWVsZCB0byBjb3JyZWN0bHkgaGFuZGxlIHVuaWNvZGUgcGF0aCwgc28gdXNpbmcgdGhlIHBhdGggaXMgYXMgZ29vZFxuICAgICAgICAvLyBhcyBhbnkgb3RoZXIgaW5mb3JtYXRpb24uIFRoaXMgY291bGQgaW1wcm92ZSB0aGUgc2l0dWF0aW9uIHdpdGhcbiAgICAgICAgLy8gb3RoZXIgYXJjaGl2ZSBtYW5hZ2VycyB0b28uXG4gICAgICAgIC8vIFRoaXMgZmllbGQgaXMgdXN1YWxseSB1c2VkIHdpdGhvdXQgdGhlIHV0ZjggZmxhZywgd2l0aCBhIG5vblxuICAgICAgICAvLyB1bmljb2RlIHBhdGggaW4gdGhlIGhlYWRlciAod2lucmFyLCB3aW56aXApLiBUaGlzIGhlbHBzIChhIGJpdClcbiAgICAgICAgLy8gd2l0aCB0aGUgbWVzc3kgV2luZG93cycgZGVmYXVsdCBjb21wcmVzc2VkIGZvbGRlcnMgZmVhdHVyZSBidXRcbiAgICAgICAgLy8gYnJlYWtzIG9uIHA3emlwIHdoaWNoIGRvZXNuJ3Qgc2VlayB0aGUgdW5pY29kZSBwYXRoIGV4dHJhIGZpZWxkLlxuICAgICAgICAvLyBTbyBmb3Igbm93LCBVVEYtOCBldmVyeXdoZXJlICFcbiAgICAgICAgdW5pY29kZVBhdGhFeHRyYUZpZWxkID1cbiAgICAgICAgICAgIC8vIFZlcnNpb25cbiAgICAgICAgICAgIGRlY1RvSGV4KDEsIDEpICtcbiAgICAgICAgICAgIC8vIE5hbWVDUkMzMlxuICAgICAgICAgICAgZGVjVG9IZXgoY3JjMzIoZW5jb2RlZEZpbGVOYW1lKSwgNCkgK1xuICAgICAgICAgICAgLy8gVW5pY29kZU5hbWVcbiAgICAgICAgICAgIHV0ZkVuY29kZWRGaWxlTmFtZTtcblxuICAgICAgICBleHRyYUZpZWxkcyArPVxuICAgICAgICAgICAgLy8gSW5mby1aSVAgVW5pY29kZSBQYXRoIEV4dHJhIEZpZWxkXG4gICAgICAgICAgICBcIlxceDc1XFx4NzBcIiArXG4gICAgICAgICAgICAvLyBzaXplXG4gICAgICAgICAgICBkZWNUb0hleCh1bmljb2RlUGF0aEV4dHJhRmllbGQubGVuZ3RoLCAyKSArXG4gICAgICAgICAgICAvLyBjb250ZW50XG4gICAgICAgICAgICB1bmljb2RlUGF0aEV4dHJhRmllbGQ7XG4gICAgfVxuXG4gICAgaWYodXNlVVRGOEZvckNvbW1lbnQpIHtcblxuICAgICAgICB1bmljb2RlQ29tbWVudEV4dHJhRmllbGQgPVxuICAgICAgICAgICAgLy8gVmVyc2lvblxuICAgICAgICAgICAgZGVjVG9IZXgoMSwgMSkgK1xuICAgICAgICAgICAgLy8gQ29tbWVudENSQzMyXG4gICAgICAgICAgICBkZWNUb0hleCh0aGlzLmNyYzMyKGVuY29kZWRDb21tZW50KSwgNCkgK1xuICAgICAgICAgICAgLy8gVW5pY29kZU5hbWVcbiAgICAgICAgICAgIHV0ZkVuY29kZWRDb21tZW50O1xuXG4gICAgICAgIGV4dHJhRmllbGRzICs9XG4gICAgICAgICAgICAvLyBJbmZvLVpJUCBVbmljb2RlIFBhdGggRXh0cmEgRmllbGRcbiAgICAgICAgICAgIFwiXFx4NzVcXHg2M1wiICtcbiAgICAgICAgICAgIC8vIHNpemVcbiAgICAgICAgICAgIGRlY1RvSGV4KHVuaWNvZGVDb21tZW50RXh0cmFGaWVsZC5sZW5ndGgsIDIpICtcbiAgICAgICAgICAgIC8vIGNvbnRlbnRcbiAgICAgICAgICAgIHVuaWNvZGVDb21tZW50RXh0cmFGaWVsZDtcbiAgICB9XG5cbiAgICB2YXIgaGVhZGVyID0gXCJcIjtcblxuICAgIC8vIHZlcnNpb24gbmVlZGVkIHRvIGV4dHJhY3RcbiAgICBoZWFkZXIgKz0gXCJcXHgwQVxceDAwXCI7XG4gICAgLy8gZ2VuZXJhbCBwdXJwb3NlIGJpdCBmbGFnXG4gICAgLy8gc2V0IGJpdCAxMSBpZiB1dGY4XG4gICAgaGVhZGVyICs9ICF1c2VDdXN0b21FbmNvZGluZyAmJiAodXNlVVRGOEZvckZpbGVOYW1lIHx8IHVzZVVURjhGb3JDb21tZW50KSA/IFwiXFx4MDBcXHgwOFwiIDogXCJcXHgwMFxceDAwXCI7XG4gICAgLy8gY29tcHJlc3Npb24gbWV0aG9kXG4gICAgaGVhZGVyICs9IGNvbXByZXNzZWRPYmplY3QuY29tcHJlc3Npb25NZXRob2Q7XG4gICAgLy8gbGFzdCBtb2QgZmlsZSB0aW1lXG4gICAgaGVhZGVyICs9IGRlY1RvSGV4KGRvc1RpbWUsIDIpO1xuICAgIC8vIGxhc3QgbW9kIGZpbGUgZGF0ZVxuICAgIGhlYWRlciArPSBkZWNUb0hleChkb3NEYXRlLCAyKTtcbiAgICAvLyBjcmMtMzJcbiAgICBoZWFkZXIgKz0gZGVjVG9IZXgoY29tcHJlc3NlZE9iamVjdC5jcmMzMiwgNCk7XG4gICAgLy8gY29tcHJlc3NlZCBzaXplXG4gICAgaGVhZGVyICs9IGRlY1RvSGV4KGNvbXByZXNzZWRPYmplY3QuY29tcHJlc3NlZFNpemUsIDQpO1xuICAgIC8vIHVuY29tcHJlc3NlZCBzaXplXG4gICAgaGVhZGVyICs9IGRlY1RvSGV4KGNvbXByZXNzZWRPYmplY3QudW5jb21wcmVzc2VkU2l6ZSwgNCk7XG4gICAgLy8gZmlsZSBuYW1lIGxlbmd0aFxuICAgIGhlYWRlciArPSBkZWNUb0hleChlbmNvZGVkRmlsZU5hbWUubGVuZ3RoLCAyKTtcbiAgICAvLyBleHRyYSBmaWVsZCBsZW5ndGhcbiAgICBoZWFkZXIgKz0gZGVjVG9IZXgoZXh0cmFGaWVsZHMubGVuZ3RoLCAyKTtcblxuXG4gICAgdmFyIGZpbGVSZWNvcmQgPSBzaWduYXR1cmUuTE9DQUxfRklMRV9IRUFERVIgKyBoZWFkZXIgKyBlbmNvZGVkRmlsZU5hbWUgKyBleHRyYUZpZWxkcztcblxuICAgIHZhciBkaXJSZWNvcmQgPSBzaWduYXR1cmUuQ0VOVFJBTF9GSUxFX0hFQURFUiArXG4gICAgLy8gdmVyc2lvbiBtYWRlIGJ5ICgwMDogRE9TKVxuICAgIGRlY1RvSGV4KHZlcnNpb25NYWRlQnksIDIpICtcbiAgICAvLyBmaWxlIGhlYWRlciAoY29tbW9uIHRvIGZpbGUgYW5kIGNlbnRyYWwgZGlyZWN0b3J5KVxuICAgIGhlYWRlciArXG4gICAgLy8gZmlsZSBjb21tZW50IGxlbmd0aFxuICAgIGRlY1RvSGV4KGVuY29kZWRDb21tZW50Lmxlbmd0aCwgMikgK1xuICAgIC8vIGRpc2sgbnVtYmVyIHN0YXJ0XG4gICAgXCJcXHgwMFxceDAwXCIgK1xuICAgIC8vIGludGVybmFsIGZpbGUgYXR0cmlidXRlcyBUT0RPXG4gICAgXCJcXHgwMFxceDAwXCIgK1xuICAgIC8vIGV4dGVybmFsIGZpbGUgYXR0cmlidXRlc1xuICAgIGRlY1RvSGV4KGV4dEZpbGVBdHRyLCA0KSArXG4gICAgLy8gcmVsYXRpdmUgb2Zmc2V0IG9mIGxvY2FsIGhlYWRlclxuICAgIGRlY1RvSGV4KG9mZnNldCwgNCkgK1xuICAgIC8vIGZpbGUgbmFtZVxuICAgIGVuY29kZWRGaWxlTmFtZSArXG4gICAgLy8gZXh0cmEgZmllbGRcbiAgICBleHRyYUZpZWxkcyArXG4gICAgLy8gZmlsZSBjb21tZW50XG4gICAgZW5jb2RlZENvbW1lbnQ7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBmaWxlUmVjb3JkOiBmaWxlUmVjb3JkLFxuICAgICAgICBkaXJSZWNvcmQ6IGRpclJlY29yZCxcbiAgICAgICAgY29tcHJlc3NlZE9iamVjdDogY29tcHJlc3NlZE9iamVjdFxuICAgIH07XG59O1xuXG5cbi8vIHJldHVybiB0aGUgYWN0dWFsIHByb3RvdHlwZSBvZiBKU1ppcFxudmFyIG91dCA9IHtcbiAgICAvKipcbiAgICAgKiBSZWFkIGFuIGV4aXN0aW5nIHppcCBhbmQgbWVyZ2UgdGhlIGRhdGEgaW4gdGhlIGN1cnJlbnQgSlNaaXAgb2JqZWN0LlxuICAgICAqIFRoZSBpbXBsZW1lbnRhdGlvbiBpcyBpbiBqc3ppcC1sb2FkLmpzLCBkb24ndCBmb3JnZXQgdG8gaW5jbHVkZSBpdC5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ3xBcnJheUJ1ZmZlcnxVaW50OEFycmF5fEJ1ZmZlcn0gc3RyZWFtICBUaGUgc3RyZWFtIHRvIGxvYWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucyBPcHRpb25zIGZvciBsb2FkaW5nIHRoZSBzdHJlYW0uXG4gICAgICogIG9wdGlvbnMuYmFzZTY0IDogaXMgdGhlIHN0cmVhbSBpbiBiYXNlNjQgPyBkZWZhdWx0IDogZmFsc2VcbiAgICAgKiBAcmV0dXJuIHtKU1ppcH0gdGhlIGN1cnJlbnQgSlNaaXAgb2JqZWN0XG4gICAgICovXG4gICAgbG9hZDogZnVuY3Rpb24oc3RyZWFtLCBvcHRpb25zKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkxvYWQgbWV0aG9kIGlzIG5vdCBkZWZpbmVkLiBJcyB0aGUgZmlsZSBqc3ppcC1sb2FkLmpzIGluY2x1ZGVkID9cIik7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZpbHRlciBuZXN0ZWQgZmlsZXMvZm9sZGVycyB3aXRoIHRoZSBzcGVjaWZpZWQgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gc2VhcmNoIHRoZSBwcmVkaWNhdGUgdG8gdXNlIDpcbiAgICAgKiBmdW5jdGlvbiAocmVsYXRpdmVQYXRoLCBmaWxlKSB7Li4ufVxuICAgICAqIEl0IHRha2VzIDIgYXJndW1lbnRzIDogdGhlIHJlbGF0aXZlIHBhdGggYW5kIHRoZSBmaWxlLlxuICAgICAqIEByZXR1cm4ge0FycmF5fSBBbiBhcnJheSBvZiBtYXRjaGluZyBlbGVtZW50cy5cbiAgICAgKi9cbiAgICBmaWx0ZXI6IGZ1bmN0aW9uKHNlYXJjaCkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gW10sXG4gICAgICAgICAgICBmaWxlbmFtZSwgcmVsYXRpdmVQYXRoLCBmaWxlLCBmaWxlQ2xvbmU7XG4gICAgICAgIGZvciAoZmlsZW5hbWUgaW4gdGhpcy5maWxlcykge1xuICAgICAgICAgICAgZmlsZSA9IHRoaXMuZmlsZXNbZmlsZW5hbWVdO1xuICAgICAgICAgICAgLy8gcmV0dXJuIGEgbmV3IG9iamVjdCwgZG9uJ3QgbGV0IHRoZSB1c2VyIG1lc3Mgd2l0aCBvdXIgaW50ZXJuYWwgb2JqZWN0cyA6KVxuICAgICAgICAgICAgZmlsZUNsb25lID0gbmV3IFppcE9iamVjdChmaWxlLm5hbWUsIGZpbGUuX2RhdGEsIHV0aWxzLmV4dGVuZChmaWxlLm9wdGlvbnMpKTtcbiAgICAgICAgICAgIHJlbGF0aXZlUGF0aCA9IGZpbGVuYW1lLnNsaWNlKHRoaXMucm9vdC5sZW5ndGgsIGZpbGVuYW1lLmxlbmd0aCk7XG4gICAgICAgICAgICBpZiAoZmlsZW5hbWUuc2xpY2UoMCwgdGhpcy5yb290Lmxlbmd0aCkgPT09IHRoaXMucm9vdCAmJiAvLyB0aGUgZmlsZSBpcyBpbiB0aGUgY3VycmVudCByb290XG4gICAgICAgICAgICBzZWFyY2gocmVsYXRpdmVQYXRoLCBmaWxlQ2xvbmUpKSB7IC8vIGFuZCB0aGUgZmlsZSBtYXRjaGVzIHRoZSBmdW5jdGlvblxuICAgICAgICAgICAgICAgIHJlc3VsdC5wdXNoKGZpbGVDbG9uZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgZmlsZSB0byB0aGUgemlwIGZpbGUsIG9yIHNlYXJjaCBhIGZpbGUuXG4gICAgICogQHBhcmFtICAge3N0cmluZ3xSZWdFeHB9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGZpbGUgdG8gYWRkIChpZiBkYXRhIGlzIGRlZmluZWQpLFxuICAgICAqIHRoZSBuYW1lIG9mIHRoZSBmaWxlIHRvIGZpbmQgKGlmIG5vIGRhdGEpIG9yIGEgcmVnZXggdG8gbWF0Y2ggZmlsZXMuXG4gICAgICogQHBhcmFtICAge1N0cmluZ3xBcnJheUJ1ZmZlcnxVaW50OEFycmF5fEJ1ZmZlcn0gZGF0YSAgVGhlIGZpbGUgZGF0YSwgZWl0aGVyIHJhdyBvciBiYXNlNjQgZW5jb2RlZFxuICAgICAqIEBwYXJhbSAgIHtPYmplY3R9IG8gICAgIEZpbGUgb3B0aW9uc1xuICAgICAqIEByZXR1cm4gIHtKU1ppcHxPYmplY3R8QXJyYXl9IHRoaXMgSlNaaXAgb2JqZWN0ICh3aGVuIGFkZGluZyBhIGZpbGUpLFxuICAgICAqIGEgZmlsZSAod2hlbiBzZWFyY2hpbmcgYnkgc3RyaW5nKSBvciBhbiBhcnJheSBvZiBmaWxlcyAod2hlbiBzZWFyY2hpbmcgYnkgcmVnZXgpLlxuICAgICAqL1xuICAgIGZpbGU6IGZ1bmN0aW9uKG5hbWUsIGRhdGEsIG8pIHtcbiAgICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgIGlmICh1dGlscy5pc1JlZ0V4cChuYW1lKSkge1xuICAgICAgICAgICAgICAgIHZhciByZWdleHAgPSBuYW1lO1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmZpbHRlcihmdW5jdGlvbihyZWxhdGl2ZVBhdGgsIGZpbGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICFmaWxlLmRpciAmJiByZWdleHAudGVzdChyZWxhdGl2ZVBhdGgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSB7IC8vIHRleHRcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5maWx0ZXIoZnVuY3Rpb24ocmVsYXRpdmVQYXRoLCBmaWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAhZmlsZS5kaXIgJiYgcmVsYXRpdmVQYXRoID09PSBuYW1lO1xuICAgICAgICAgICAgICAgIH0pWzBdIHx8IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7IC8vIG1vcmUgdGhhbiBvbmUgYXJndW1lbnQgOiB3ZSBoYXZlIGRhdGEgIVxuICAgICAgICAgICAgbmFtZSA9IHRoaXMucm9vdCArIG5hbWU7XG4gICAgICAgICAgICBmaWxlQWRkLmNhbGwodGhpcywgbmFtZSwgZGF0YSwgbyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGRpcmVjdG9yeSB0byB0aGUgemlwIGZpbGUsIG9yIHNlYXJjaC5cbiAgICAgKiBAcGFyYW0gICB7U3RyaW5nfFJlZ0V4cH0gYXJnIFRoZSBuYW1lIG9mIHRoZSBkaXJlY3RvcnkgdG8gYWRkLCBvciBhIHJlZ2V4IHRvIHNlYXJjaCBmb2xkZXJzLlxuICAgICAqIEByZXR1cm4gIHtKU1ppcH0gYW4gb2JqZWN0IHdpdGggdGhlIG5ldyBkaXJlY3RvcnkgYXMgdGhlIHJvb3QsIG9yIGFuIGFycmF5IGNvbnRhaW5pbmcgbWF0Y2hpbmcgZm9sZGVycy5cbiAgICAgKi9cbiAgICBmb2xkZXI6IGZ1bmN0aW9uKGFyZykge1xuICAgICAgICBpZiAoIWFyZykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodXRpbHMuaXNSZWdFeHAoYXJnKSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZmlsdGVyKGZ1bmN0aW9uKHJlbGF0aXZlUGF0aCwgZmlsZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmaWxlLmRpciAmJiBhcmcudGVzdChyZWxhdGl2ZVBhdGgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBlbHNlLCBuYW1lIGlzIGEgbmV3IGZvbGRlclxuICAgICAgICB2YXIgbmFtZSA9IHRoaXMucm9vdCArIGFyZztcbiAgICAgICAgdmFyIG5ld0ZvbGRlciA9IGZvbGRlckFkZC5jYWxsKHRoaXMsIG5hbWUpO1xuXG4gICAgICAgIC8vIEFsbG93IGNoYWluaW5nIGJ5IHJldHVybmluZyBhIG5ldyBvYmplY3Qgd2l0aCB0aGlzIGZvbGRlciBhcyB0aGUgcm9vdFxuICAgICAgICB2YXIgcmV0ID0gdGhpcy5jbG9uZSgpO1xuICAgICAgICByZXQucm9vdCA9IG5ld0ZvbGRlci5uYW1lO1xuICAgICAgICByZXR1cm4gcmV0O1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBEZWxldGUgYSBmaWxlLCBvciBhIGRpcmVjdG9yeSBhbmQgYWxsIHN1Yi1maWxlcywgZnJvbSB0aGUgemlwXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgdGhlIG5hbWUgb2YgdGhlIGZpbGUgdG8gZGVsZXRlXG4gICAgICogQHJldHVybiB7SlNaaXB9IHRoaXMgSlNaaXAgb2JqZWN0XG4gICAgICovXG4gICAgcmVtb3ZlOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgIG5hbWUgPSB0aGlzLnJvb3QgKyBuYW1lO1xuICAgICAgICB2YXIgZmlsZSA9IHRoaXMuZmlsZXNbbmFtZV07XG4gICAgICAgIGlmICghZmlsZSkge1xuICAgICAgICAgICAgLy8gTG9vayBmb3IgYW55IGZvbGRlcnNcbiAgICAgICAgICAgIGlmIChuYW1lLnNsaWNlKC0xKSAhPSBcIi9cIikge1xuICAgICAgICAgICAgICAgIG5hbWUgKz0gXCIvXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmaWxlID0gdGhpcy5maWxlc1tuYW1lXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChmaWxlICYmICFmaWxlLmRpcikge1xuICAgICAgICAgICAgLy8gZmlsZVxuICAgICAgICAgICAgZGVsZXRlIHRoaXMuZmlsZXNbbmFtZV07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBtYXliZSBhIGZvbGRlciwgZGVsZXRlIHJlY3Vyc2l2ZWx5XG4gICAgICAgICAgICB2YXIga2lkcyA9IHRoaXMuZmlsdGVyKGZ1bmN0aW9uKHJlbGF0aXZlUGF0aCwgZmlsZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBmaWxlLm5hbWUuc2xpY2UoMCwgbmFtZS5sZW5ndGgpID09PSBuYW1lO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGtpZHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5maWxlc1traWRzW2ldLm5hbWVdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEdlbmVyYXRlIHRoZSBjb21wbGV0ZSB6aXAgZmlsZVxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIHRoZSBvcHRpb25zIHRvIGdlbmVyYXRlIHRoZSB6aXAgZmlsZSA6XG4gICAgICogLSBiYXNlNjQsIChkZXByZWNhdGVkLCB1c2UgdHlwZSBpbnN0ZWFkKSB0cnVlIHRvIGdlbmVyYXRlIGJhc2U2NC5cbiAgICAgKiAtIGNvbXByZXNzaW9uLCBcIlNUT1JFXCIgYnkgZGVmYXVsdC5cbiAgICAgKiAtIHR5cGUsIFwiYmFzZTY0XCIgYnkgZGVmYXVsdC4gVmFsdWVzIGFyZSA6IHN0cmluZywgYmFzZTY0LCB1aW50OGFycmF5LCBhcnJheWJ1ZmZlciwgYmxvYi5cbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd8VWludDhBcnJheXxBcnJheUJ1ZmZlcnxCdWZmZXJ8QmxvYn0gdGhlIHppcCBmaWxlXG4gICAgICovXG4gICAgZ2VuZXJhdGU6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IHV0aWxzLmV4dGVuZChvcHRpb25zIHx8IHt9LCB7XG4gICAgICAgICAgICBiYXNlNjQ6IHRydWUsXG4gICAgICAgICAgICBjb21wcmVzc2lvbjogXCJTVE9SRVwiLFxuICAgICAgICAgICAgY29tcHJlc3Npb25PcHRpb25zIDogbnVsbCxcbiAgICAgICAgICAgIHR5cGU6IFwiYmFzZTY0XCIsXG4gICAgICAgICAgICBwbGF0Zm9ybTogXCJET1NcIixcbiAgICAgICAgICAgIGNvbW1lbnQ6IG51bGwsXG4gICAgICAgICAgICBtaW1lVHlwZTogJ2FwcGxpY2F0aW9uL3ppcCcsXG4gICAgICAgICAgICBlbmNvZGVGaWxlTmFtZTogdXRmOC51dGY4ZW5jb2RlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHV0aWxzLmNoZWNrU3VwcG9ydChvcHRpb25zLnR5cGUpO1xuXG4gICAgICAgIC8vIGFjY2VwdCBub2RlanMgYHByb2Nlc3MucGxhdGZvcm1gXG4gICAgICAgIGlmKFxuICAgICAgICAgIG9wdGlvbnMucGxhdGZvcm0gPT09ICdkYXJ3aW4nIHx8XG4gICAgICAgICAgb3B0aW9ucy5wbGF0Zm9ybSA9PT0gJ2ZyZWVic2QnIHx8XG4gICAgICAgICAgb3B0aW9ucy5wbGF0Zm9ybSA9PT0gJ2xpbnV4JyB8fFxuICAgICAgICAgIG9wdGlvbnMucGxhdGZvcm0gPT09ICdzdW5vcydcbiAgICAgICAgKSB7XG4gICAgICAgICAgb3B0aW9ucy5wbGF0Zm9ybSA9IFwiVU5JWFwiO1xuICAgICAgICB9XG4gICAgICAgIGlmIChvcHRpb25zLnBsYXRmb3JtID09PSAnd2luMzInKSB7XG4gICAgICAgICAgb3B0aW9ucy5wbGF0Zm9ybSA9IFwiRE9TXCI7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgemlwRGF0YSA9IFtdLFxuICAgICAgICAgICAgbG9jYWxEaXJMZW5ndGggPSAwLFxuICAgICAgICAgICAgY2VudHJhbERpckxlbmd0aCA9IDAsXG4gICAgICAgICAgICB3cml0ZXIsIGksXG4gICAgICAgICAgICBlbmNvZGVkQ29tbWVudCA9IHV0aWxzLnRyYW5zZm9ybVRvKFwic3RyaW5nXCIsIG9wdGlvbnMuZW5jb2RlRmlsZU5hbWUob3B0aW9ucy5jb21tZW50IHx8IHRoaXMuY29tbWVudCB8fCBcIlwiKSk7XG5cbiAgICAgICAgLy8gZmlyc3QsIGdlbmVyYXRlIGFsbCB0aGUgemlwIHBhcnRzLlxuICAgICAgICBmb3IgKHZhciBuYW1lIGluIHRoaXMuZmlsZXMpIHtcbiAgICAgICAgICAgIHZhciBmaWxlID0gdGhpcy5maWxlc1tuYW1lXTtcblxuICAgICAgICAgICAgdmFyIGNvbXByZXNzaW9uTmFtZSA9IGZpbGUub3B0aW9ucy5jb21wcmVzc2lvbiB8fCBvcHRpb25zLmNvbXByZXNzaW9uLnRvVXBwZXJDYXNlKCk7XG4gICAgICAgICAgICB2YXIgY29tcHJlc3Npb24gPSBjb21wcmVzc2lvbnNbY29tcHJlc3Npb25OYW1lXTtcbiAgICAgICAgICAgIGlmICghY29tcHJlc3Npb24pIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoY29tcHJlc3Npb25OYW1lICsgXCIgaXMgbm90IGEgdmFsaWQgY29tcHJlc3Npb24gbWV0aG9kICFcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB2YXIgY29tcHJlc3Npb25PcHRpb25zID0gZmlsZS5vcHRpb25zLmNvbXByZXNzaW9uT3B0aW9ucyB8fCBvcHRpb25zLmNvbXByZXNzaW9uT3B0aW9ucyB8fCB7fTtcblxuICAgICAgICAgICAgdmFyIGNvbXByZXNzZWRPYmplY3QgPSBnZW5lcmF0ZUNvbXByZXNzZWRPYmplY3RGcm9tLmNhbGwodGhpcywgZmlsZSwgY29tcHJlc3Npb24sIGNvbXByZXNzaW9uT3B0aW9ucyk7XG5cbiAgICAgICAgICAgIHZhciB6aXBQYXJ0ID0gZ2VuZXJhdGVaaXBQYXJ0cy5jYWxsKHRoaXMsIG5hbWUsIGZpbGUsIGNvbXByZXNzZWRPYmplY3QsIGxvY2FsRGlyTGVuZ3RoLCBvcHRpb25zLnBsYXRmb3JtLCBvcHRpb25zLmVuY29kZUZpbGVOYW1lKTtcbiAgICAgICAgICAgIGxvY2FsRGlyTGVuZ3RoICs9IHppcFBhcnQuZmlsZVJlY29yZC5sZW5ndGggKyBjb21wcmVzc2VkT2JqZWN0LmNvbXByZXNzZWRTaXplO1xuICAgICAgICAgICAgY2VudHJhbERpckxlbmd0aCArPSB6aXBQYXJ0LmRpclJlY29yZC5sZW5ndGg7XG4gICAgICAgICAgICB6aXBEYXRhLnB1c2goemlwUGFydCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZGlyRW5kID0gXCJcIjtcblxuICAgICAgICAvLyBlbmQgb2YgY2VudHJhbCBkaXIgc2lnbmF0dXJlXG4gICAgICAgIGRpckVuZCA9IHNpZ25hdHVyZS5DRU5UUkFMX0RJUkVDVE9SWV9FTkQgK1xuICAgICAgICAvLyBudW1iZXIgb2YgdGhpcyBkaXNrXG4gICAgICAgIFwiXFx4MDBcXHgwMFwiICtcbiAgICAgICAgLy8gbnVtYmVyIG9mIHRoZSBkaXNrIHdpdGggdGhlIHN0YXJ0IG9mIHRoZSBjZW50cmFsIGRpcmVjdG9yeVxuICAgICAgICBcIlxceDAwXFx4MDBcIiArXG4gICAgICAgIC8vIHRvdGFsIG51bWJlciBvZiBlbnRyaWVzIGluIHRoZSBjZW50cmFsIGRpcmVjdG9yeSBvbiB0aGlzIGRpc2tcbiAgICAgICAgZGVjVG9IZXgoemlwRGF0YS5sZW5ndGgsIDIpICtcbiAgICAgICAgLy8gdG90YWwgbnVtYmVyIG9mIGVudHJpZXMgaW4gdGhlIGNlbnRyYWwgZGlyZWN0b3J5XG4gICAgICAgIGRlY1RvSGV4KHppcERhdGEubGVuZ3RoLCAyKSArXG4gICAgICAgIC8vIHNpemUgb2YgdGhlIGNlbnRyYWwgZGlyZWN0b3J5ICAgNCBieXRlc1xuICAgICAgICBkZWNUb0hleChjZW50cmFsRGlyTGVuZ3RoLCA0KSArXG4gICAgICAgIC8vIG9mZnNldCBvZiBzdGFydCBvZiBjZW50cmFsIGRpcmVjdG9yeSB3aXRoIHJlc3BlY3QgdG8gdGhlIHN0YXJ0aW5nIGRpc2sgbnVtYmVyXG4gICAgICAgIGRlY1RvSGV4KGxvY2FsRGlyTGVuZ3RoLCA0KSArXG4gICAgICAgIC8vIC5aSVAgZmlsZSBjb21tZW50IGxlbmd0aFxuICAgICAgICBkZWNUb0hleChlbmNvZGVkQ29tbWVudC5sZW5ndGgsIDIpICtcbiAgICAgICAgLy8gLlpJUCBmaWxlIGNvbW1lbnRcbiAgICAgICAgZW5jb2RlZENvbW1lbnQ7XG5cblxuICAgICAgICAvLyB3ZSBoYXZlIGFsbCB0aGUgcGFydHMgKGFuZCB0aGUgdG90YWwgbGVuZ3RoKVxuICAgICAgICAvLyB0aW1lIHRvIGNyZWF0ZSBhIHdyaXRlciAhXG4gICAgICAgIHZhciB0eXBlTmFtZSA9IG9wdGlvbnMudHlwZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZih0eXBlTmFtZT09PVwidWludDhhcnJheVwifHx0eXBlTmFtZT09PVwiYXJyYXlidWZmZXJcInx8dHlwZU5hbWU9PT1cImJsb2JcInx8dHlwZU5hbWU9PT1cIm5vZGVidWZmZXJcIikge1xuICAgICAgICAgICAgd3JpdGVyID0gbmV3IFVpbnQ4QXJyYXlXcml0ZXIobG9jYWxEaXJMZW5ndGggKyBjZW50cmFsRGlyTGVuZ3RoICsgZGlyRW5kLmxlbmd0aCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgd3JpdGVyID0gbmV3IFN0cmluZ1dyaXRlcihsb2NhbERpckxlbmd0aCArIGNlbnRyYWxEaXJMZW5ndGggKyBkaXJFbmQubGVuZ3RoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB6aXBEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB3cml0ZXIuYXBwZW5kKHppcERhdGFbaV0uZmlsZVJlY29yZCk7XG4gICAgICAgICAgICB3cml0ZXIuYXBwZW5kKHppcERhdGFbaV0uY29tcHJlc3NlZE9iamVjdC5jb21wcmVzc2VkQ29udGVudCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IHppcERhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIHdyaXRlci5hcHBlbmQoemlwRGF0YVtpXS5kaXJSZWNvcmQpO1xuICAgICAgICB9XG5cbiAgICAgICAgd3JpdGVyLmFwcGVuZChkaXJFbmQpO1xuXG4gICAgICAgIHZhciB6aXAgPSB3cml0ZXIuZmluYWxpemUoKTtcblxuXG5cbiAgICAgICAgc3dpdGNoKG9wdGlvbnMudHlwZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgICAgICAvLyBjYXNlIFwiemlwIGlzIGFuIFVpbnQ4QXJyYXlcIlxuICAgICAgICAgICAgY2FzZSBcInVpbnQ4YXJyYXlcIiA6XG4gICAgICAgICAgICBjYXNlIFwiYXJyYXlidWZmZXJcIiA6XG4gICAgICAgICAgICBjYXNlIFwibm9kZWJ1ZmZlclwiIDpcbiAgICAgICAgICAgICAgIHJldHVybiB1dGlscy50cmFuc2Zvcm1UbyhvcHRpb25zLnR5cGUudG9Mb3dlckNhc2UoKSwgemlwKTtcbiAgICAgICAgICAgIGNhc2UgXCJibG9iXCIgOlxuICAgICAgICAgICAgICAgcmV0dXJuIHV0aWxzLmFycmF5QnVmZmVyMkJsb2IodXRpbHMudHJhbnNmb3JtVG8oXCJhcnJheWJ1ZmZlclwiLCB6aXApLCBvcHRpb25zLm1pbWVUeXBlKTtcbiAgICAgICAgICAgIC8vIGNhc2UgXCJ6aXAgaXMgYSBzdHJpbmdcIlxuICAgICAgICAgICAgY2FzZSBcImJhc2U2NFwiIDpcbiAgICAgICAgICAgICAgIHJldHVybiAob3B0aW9ucy5iYXNlNjQpID8gYmFzZTY0LmVuY29kZSh6aXApIDogemlwO1xuICAgICAgICAgICAgZGVmYXVsdCA6IC8vIGNhc2UgXCJzdHJpbmdcIiA6XG4gICAgICAgICAgICAgICByZXR1cm4gemlwO1xuICAgICAgICAgfVxuXG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICogVGhpcyBtZXRob2Qgd2lsbCBiZSByZW1vdmVkIGluIGEgZnV0dXJlIHZlcnNpb24gd2l0aG91dCByZXBsYWNlbWVudC5cbiAgICAgKi9cbiAgICBjcmMzMjogZnVuY3Rpb24gKGlucHV0LCBjcmMpIHtcbiAgICAgICAgcmV0dXJuIGNyYzMyKGlucHV0LCBjcmMpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqIFRoaXMgbWV0aG9kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIHdpdGhvdXQgcmVwbGFjZW1lbnQuXG4gICAgICovXG4gICAgdXRmOGVuY29kZTogZnVuY3Rpb24gKHN0cmluZykge1xuICAgICAgICByZXR1cm4gdXRpbHMudHJhbnNmb3JtVG8oXCJzdHJpbmdcIiwgdXRmOC51dGY4ZW5jb2RlKHN0cmluZykpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqIFRoaXMgbWV0aG9kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIHdpdGhvdXQgcmVwbGFjZW1lbnQuXG4gICAgICovXG4gICAgdXRmOGRlY29kZTogZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHJldHVybiB1dGY4LnV0ZjhkZWNvZGUoaW5wdXQpO1xuICAgIH1cbn07XG5tb2R1bGUuZXhwb3J0cyA9IG91dDtcbiIsIid1c2Ugc3RyaWN0JztcbmV4cG9ydHMuTE9DQUxfRklMRV9IRUFERVIgPSBcIlBLXFx4MDNcXHgwNFwiO1xuZXhwb3J0cy5DRU5UUkFMX0ZJTEVfSEVBREVSID0gXCJQS1xceDAxXFx4MDJcIjtcbmV4cG9ydHMuQ0VOVFJBTF9ESVJFQ1RPUllfRU5EID0gXCJQS1xceDA1XFx4MDZcIjtcbmV4cG9ydHMuWklQNjRfQ0VOVFJBTF9ESVJFQ1RPUllfTE9DQVRPUiA9IFwiUEtcXHgwNlxceDA3XCI7XG5leHBvcnRzLlpJUDY0X0NFTlRSQUxfRElSRUNUT1JZX0VORCA9IFwiUEtcXHgwNlxceDA2XCI7XG5leHBvcnRzLkRBVEFfREVTQ1JJUFRPUiA9IFwiUEtcXHgwN1xceDA4XCI7XG4iLCIndXNlIHN0cmljdCc7XG52YXIgRGF0YVJlYWRlciA9IHJlcXVpcmUoJy4vZGF0YVJlYWRlcicpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG5mdW5jdGlvbiBTdHJpbmdSZWFkZXIoZGF0YSwgb3B0aW1pemVkQmluYXJ5U3RyaW5nKSB7XG4gICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICBpZiAoIW9wdGltaXplZEJpbmFyeVN0cmluZykge1xuICAgICAgICB0aGlzLmRhdGEgPSB1dGlscy5zdHJpbmcyYmluYXJ5KHRoaXMuZGF0YSk7XG4gICAgfVxuICAgIHRoaXMubGVuZ3RoID0gdGhpcy5kYXRhLmxlbmd0aDtcbiAgICB0aGlzLmluZGV4ID0gMDtcbiAgICB0aGlzLnplcm8gPSAwO1xufVxuU3RyaW5nUmVhZGVyLnByb3RvdHlwZSA9IG5ldyBEYXRhUmVhZGVyKCk7XG4vKipcbiAqIEBzZWUgRGF0YVJlYWRlci5ieXRlQXRcbiAqL1xuU3RyaW5nUmVhZGVyLnByb3RvdHlwZS5ieXRlQXQgPSBmdW5jdGlvbihpKSB7XG4gICAgcmV0dXJuIHRoaXMuZGF0YS5jaGFyQ29kZUF0KHRoaXMuemVybyArIGkpO1xufTtcbi8qKlxuICogQHNlZSBEYXRhUmVhZGVyLmxhc3RJbmRleE9mU2lnbmF0dXJlXG4gKi9cblN0cmluZ1JlYWRlci5wcm90b3R5cGUubGFzdEluZGV4T2ZTaWduYXR1cmUgPSBmdW5jdGlvbihzaWcpIHtcbiAgICByZXR1cm4gdGhpcy5kYXRhLmxhc3RJbmRleE9mKHNpZykgLSB0aGlzLnplcm87XG59O1xuLyoqXG4gKiBAc2VlIERhdGFSZWFkZXIucmVhZERhdGFcbiAqL1xuU3RyaW5nUmVhZGVyLnByb3RvdHlwZS5yZWFkRGF0YSA9IGZ1bmN0aW9uKHNpemUpIHtcbiAgICB0aGlzLmNoZWNrT2Zmc2V0KHNpemUpO1xuICAgIC8vIHRoaXMgd2lsbCB3b3JrIGJlY2F1c2UgdGhlIGNvbnN0cnVjdG9yIGFwcGxpZWQgdGhlIFwiJiAweGZmXCIgbWFzay5cbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5kYXRhLnNsaWNlKHRoaXMuemVybyArIHRoaXMuaW5kZXgsIHRoaXMuemVybyArIHRoaXMuaW5kZXggKyBzaXplKTtcbiAgICB0aGlzLmluZGV4ICs9IHNpemU7XG4gICAgcmV0dXJuIHJlc3VsdDtcbn07XG5tb2R1bGUuZXhwb3J0cyA9IFN0cmluZ1JlYWRlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuXG4vKipcbiAqIEFuIG9iamVjdCB0byB3cml0ZSBhbnkgY29udGVudCB0byBhIHN0cmluZy5cbiAqIEBjb25zdHJ1Y3RvclxuICovXG52YXIgU3RyaW5nV3JpdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5kYXRhID0gW107XG59O1xuU3RyaW5nV3JpdGVyLnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBBcHBlbmQgYW55IGNvbnRlbnQgdG8gdGhlIGN1cnJlbnQgc3RyaW5nLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dCB0aGUgY29udGVudCB0byBhZGQuXG4gICAgICovXG4gICAgYXBwZW5kOiBmdW5jdGlvbihpbnB1dCkge1xuICAgICAgICBpbnB1dCA9IHV0aWxzLnRyYW5zZm9ybVRvKFwic3RyaW5nXCIsIGlucHV0KTtcbiAgICAgICAgdGhpcy5kYXRhLnB1c2goaW5wdXQpO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogRmluYWxpemUgdGhlIGNvbnN0cnVjdGlvbiBhbiByZXR1cm4gdGhlIHJlc3VsdC5cbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IHRoZSBnZW5lcmF0ZWQgc3RyaW5nLlxuICAgICAqL1xuICAgIGZpbmFsaXplOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YS5qb2luKFwiXCIpO1xuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RyaW5nV3JpdGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuZXhwb3J0cy5iYXNlNjQgPSB0cnVlO1xuZXhwb3J0cy5hcnJheSA9IHRydWU7XG5leHBvcnRzLnN0cmluZyA9IHRydWU7XG5leHBvcnRzLmFycmF5YnVmZmVyID0gdHlwZW9mIEFycmF5QnVmZmVyICE9PSBcInVuZGVmaW5lZFwiICYmIHR5cGVvZiBVaW50OEFycmF5ICE9PSBcInVuZGVmaW5lZFwiO1xuLy8gY29udGFpbnMgdHJ1ZSBpZiBKU1ppcCBjYW4gcmVhZC9nZW5lcmF0ZSBub2RlanMgQnVmZmVyLCBmYWxzZSBvdGhlcndpc2UuXG4vLyBCcm93c2VyaWZ5IHdpbGwgcHJvdmlkZSBhIEJ1ZmZlciBpbXBsZW1lbnRhdGlvbiBmb3IgYnJvd3NlcnMsIHdoaWNoIGlzXG4vLyBhbiBhdWdtZW50ZWQgVWludDhBcnJheSAoaS5lLiwgY2FuIGJlIHVzZWQgYXMgZWl0aGVyIEJ1ZmZlciBvciBVOCkuXG5leHBvcnRzLm5vZGVidWZmZXIgPSB0eXBlb2YgQnVmZmVyICE9PSBcInVuZGVmaW5lZFwiO1xuLy8gY29udGFpbnMgdHJ1ZSBpZiBKU1ppcCBjYW4gcmVhZC9nZW5lcmF0ZSBVaW50OEFycmF5LCBmYWxzZSBvdGhlcndpc2UuXG5leHBvcnRzLnVpbnQ4YXJyYXkgPSB0eXBlb2YgVWludDhBcnJheSAhPT0gXCJ1bmRlZmluZWRcIjtcblxuaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIGV4cG9ydHMuYmxvYiA9IGZhbHNlO1xufVxuZWxzZSB7XG4gICAgdmFyIGJ1ZmZlciA9IG5ldyBBcnJheUJ1ZmZlcigwKTtcbiAgICB0cnkge1xuICAgICAgICBleHBvcnRzLmJsb2IgPSBuZXcgQmxvYihbYnVmZmVyXSwge1xuICAgICAgICAgICAgdHlwZTogXCJhcHBsaWNhdGlvbi96aXBcIlxuICAgICAgICB9KS5zaXplID09PSAwO1xuICAgIH1cbiAgICBjYXRjaCAoZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIEJ1aWxkZXIgPSB3aW5kb3cuQmxvYkJ1aWxkZXIgfHwgd2luZG93LldlYktpdEJsb2JCdWlsZGVyIHx8IHdpbmRvdy5Nb3pCbG9iQnVpbGRlciB8fCB3aW5kb3cuTVNCbG9iQnVpbGRlcjtcbiAgICAgICAgICAgIHZhciBidWlsZGVyID0gbmV3IEJ1aWxkZXIoKTtcbiAgICAgICAgICAgIGJ1aWxkZXIuYXBwZW5kKGJ1ZmZlcik7XG4gICAgICAgICAgICBleHBvcnRzLmJsb2IgPSBidWlsZGVyLmdldEJsb2IoJ2FwcGxpY2F0aW9uL3ppcCcpLnNpemUgPT09IDA7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGV4cG9ydHMuYmxvYiA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgfVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xudmFyIEFycmF5UmVhZGVyID0gcmVxdWlyZSgnLi9hcnJheVJlYWRlcicpO1xuXG5mdW5jdGlvbiBVaW50OEFycmF5UmVhZGVyKGRhdGEpIHtcbiAgICBpZiAoZGF0YSkge1xuICAgICAgICB0aGlzLmRhdGEgPSBkYXRhO1xuICAgICAgICB0aGlzLmxlbmd0aCA9IHRoaXMuZGF0YS5sZW5ndGg7XG4gICAgICAgIHRoaXMuaW5kZXggPSAwO1xuICAgICAgICB0aGlzLnplcm8gPSAwO1xuICAgIH1cbn1cblVpbnQ4QXJyYXlSZWFkZXIucHJvdG90eXBlID0gbmV3IEFycmF5UmVhZGVyKCk7XG4vKipcbiAqIEBzZWUgRGF0YVJlYWRlci5yZWFkRGF0YVxuICovXG5VaW50OEFycmF5UmVhZGVyLnByb3RvdHlwZS5yZWFkRGF0YSA9IGZ1bmN0aW9uKHNpemUpIHtcbiAgICB0aGlzLmNoZWNrT2Zmc2V0KHNpemUpO1xuICAgIGlmKHNpemUgPT09IDApIHtcbiAgICAgICAgLy8gaW4gSUUxMCwgd2hlbiB1c2luZyBzdWJhcnJheShpZHgsIGlkeCksIHdlIGdldCB0aGUgYXJyYXkgWzB4MDBdIGluc3RlYWQgb2YgW10uXG4gICAgICAgIHJldHVybiBuZXcgVWludDhBcnJheSgwKTtcbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMuZGF0YS5zdWJhcnJheSh0aGlzLnplcm8gKyB0aGlzLmluZGV4LCB0aGlzLnplcm8gKyB0aGlzLmluZGV4ICsgc2l6ZSk7XG4gICAgdGhpcy5pbmRleCArPSBzaXplO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xubW9kdWxlLmV4cG9ydHMgPSBVaW50OEFycmF5UmVhZGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbi8qKlxuICogQW4gb2JqZWN0IHRvIHdyaXRlIGFueSBjb250ZW50IHRvIGFuIFVpbnQ4QXJyYXkuXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7bnVtYmVyfSBsZW5ndGggVGhlIGxlbmd0aCBvZiB0aGUgYXJyYXkuXG4gKi9cbnZhciBVaW50OEFycmF5V3JpdGVyID0gZnVuY3Rpb24obGVuZ3RoKSB7XG4gICAgdGhpcy5kYXRhID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKTtcbiAgICB0aGlzLmluZGV4ID0gMDtcbn07XG5VaW50OEFycmF5V3JpdGVyLnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBBcHBlbmQgYW55IGNvbnRlbnQgdG8gdGhlIGN1cnJlbnQgYXJyYXkuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGlucHV0IHRoZSBjb250ZW50IHRvIGFkZC5cbiAgICAgKi9cbiAgICBhcHBlbmQ6IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICAgIGlmIChpbnB1dC5sZW5ndGggIT09IDApIHtcbiAgICAgICAgICAgIC8vIHdpdGggYW4gZW1wdHkgVWludDhBcnJheSwgT3BlcmEgZmFpbHMgd2l0aCBhIFwiT2Zmc2V0IGxhcmdlciB0aGFuIGFycmF5IHNpemVcIlxuICAgICAgICAgICAgaW5wdXQgPSB1dGlscy50cmFuc2Zvcm1UbyhcInVpbnQ4YXJyYXlcIiwgaW5wdXQpO1xuICAgICAgICAgICAgdGhpcy5kYXRhLnNldChpbnB1dCwgdGhpcy5pbmRleCk7XG4gICAgICAgICAgICB0aGlzLmluZGV4ICs9IGlucHV0Lmxlbmd0aDtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogRmluYWxpemUgdGhlIGNvbnN0cnVjdGlvbiBhbiByZXR1cm4gdGhlIHJlc3VsdC5cbiAgICAgKiBAcmV0dXJuIHtVaW50OEFycmF5fSB0aGUgZ2VuZXJhdGVkIGFycmF5LlxuICAgICAqL1xuICAgIGZpbmFsaXplOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0YTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFVpbnQ4QXJyYXlXcml0ZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBzdXBwb3J0ID0gcmVxdWlyZSgnLi9zdXBwb3J0Jyk7XG52YXIgbm9kZUJ1ZmZlciA9IHJlcXVpcmUoJy4vbm9kZUJ1ZmZlcicpO1xuXG4vKipcbiAqIFRoZSBmb2xsb3dpbmcgZnVuY3Rpb25zIGNvbWUgZnJvbSBwYWtvLCBmcm9tIHBha28vbGliL3V0aWxzL3N0cmluZ3NcbiAqIHJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSwgc2VlIHBha28gaHR0cHM6Ly9naXRodWIuY29tL25vZGVjYS9wYWtvL1xuICovXG5cbi8vIFRhYmxlIHdpdGggdXRmOCBsZW5ndGhzIChjYWxjdWxhdGVkIGJ5IGZpcnN0IGJ5dGUgb2Ygc2VxdWVuY2UpXG4vLyBOb3RlLCB0aGF0IDUgJiA2LWJ5dGUgdmFsdWVzIGFuZCBzb21lIDQtYnl0ZSB2YWx1ZXMgY2FuIG5vdCBiZSByZXByZXNlbnRlZCBpbiBKUyxcbi8vIGJlY2F1c2UgbWF4IHBvc3NpYmxlIGNvZGVwb2ludCBpcyAweDEwZmZmZlxudmFyIF91dGY4bGVuID0gbmV3IEFycmF5KDI1Nik7XG5mb3IgKHZhciBpPTA7IGk8MjU2OyBpKyspIHtcbiAgX3V0ZjhsZW5baV0gPSAoaSA+PSAyNTIgPyA2IDogaSA+PSAyNDggPyA1IDogaSA+PSAyNDAgPyA0IDogaSA+PSAyMjQgPyAzIDogaSA+PSAxOTIgPyAyIDogMSk7XG59XG5fdXRmOGxlblsyNTRdPV91dGY4bGVuWzI1NF09MTsgLy8gSW52YWxpZCBzZXF1ZW5jZSBzdGFydFxuXG4vLyBjb252ZXJ0IHN0cmluZyB0byBhcnJheSAodHlwZWQsIHdoZW4gcG9zc2libGUpXG52YXIgc3RyaW5nMmJ1ZiA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgICB2YXIgYnVmLCBjLCBjMiwgbV9wb3MsIGksIHN0cl9sZW4gPSBzdHIubGVuZ3RoLCBidWZfbGVuID0gMDtcblxuICAgIC8vIGNvdW50IGJpbmFyeSBzaXplXG4gICAgZm9yIChtX3BvcyA9IDA7IG1fcG9zIDwgc3RyX2xlbjsgbV9wb3MrKykge1xuICAgICAgICBjID0gc3RyLmNoYXJDb2RlQXQobV9wb3MpO1xuICAgICAgICBpZiAoKGMgJiAweGZjMDApID09PSAweGQ4MDAgJiYgKG1fcG9zKzEgPCBzdHJfbGVuKSkge1xuICAgICAgICAgICAgYzIgPSBzdHIuY2hhckNvZGVBdChtX3BvcysxKTtcbiAgICAgICAgICAgIGlmICgoYzIgJiAweGZjMDApID09PSAweGRjMDApIHtcbiAgICAgICAgICAgICAgICBjID0gMHgxMDAwMCArICgoYyAtIDB4ZDgwMCkgPDwgMTApICsgKGMyIC0gMHhkYzAwKTtcbiAgICAgICAgICAgICAgICBtX3BvcysrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGJ1Zl9sZW4gKz0gYyA8IDB4ODAgPyAxIDogYyA8IDB4ODAwID8gMiA6IGMgPCAweDEwMDAwID8gMyA6IDQ7XG4gICAgfVxuXG4gICAgLy8gYWxsb2NhdGUgYnVmZmVyXG4gICAgaWYgKHN1cHBvcnQudWludDhhcnJheSkge1xuICAgICAgICBidWYgPSBuZXcgVWludDhBcnJheShidWZfbGVuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBidWYgPSBuZXcgQXJyYXkoYnVmX2xlbik7XG4gICAgfVxuXG4gICAgLy8gY29udmVydFxuICAgIGZvciAoaT0wLCBtX3BvcyA9IDA7IGkgPCBidWZfbGVuOyBtX3BvcysrKSB7XG4gICAgICAgIGMgPSBzdHIuY2hhckNvZGVBdChtX3Bvcyk7XG4gICAgICAgIGlmICgoYyAmIDB4ZmMwMCkgPT09IDB4ZDgwMCAmJiAobV9wb3MrMSA8IHN0cl9sZW4pKSB7XG4gICAgICAgICAgICBjMiA9IHN0ci5jaGFyQ29kZUF0KG1fcG9zKzEpO1xuICAgICAgICAgICAgaWYgKChjMiAmIDB4ZmMwMCkgPT09IDB4ZGMwMCkge1xuICAgICAgICAgICAgICAgIGMgPSAweDEwMDAwICsgKChjIC0gMHhkODAwKSA8PCAxMCkgKyAoYzIgLSAweGRjMDApO1xuICAgICAgICAgICAgICAgIG1fcG9zKys7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGMgPCAweDgwKSB7XG4gICAgICAgICAgICAvKiBvbmUgYnl0ZSAqL1xuICAgICAgICAgICAgYnVmW2krK10gPSBjO1xuICAgICAgICB9IGVsc2UgaWYgKGMgPCAweDgwMCkge1xuICAgICAgICAgICAgLyogdHdvIGJ5dGVzICovXG4gICAgICAgICAgICBidWZbaSsrXSA9IDB4QzAgfCAoYyA+Pj4gNik7XG4gICAgICAgICAgICBidWZbaSsrXSA9IDB4ODAgfCAoYyAmIDB4M2YpO1xuICAgICAgICB9IGVsc2UgaWYgKGMgPCAweDEwMDAwKSB7XG4gICAgICAgICAgICAvKiB0aHJlZSBieXRlcyAqL1xuICAgICAgICAgICAgYnVmW2krK10gPSAweEUwIHwgKGMgPj4+IDEyKTtcbiAgICAgICAgICAgIGJ1ZltpKytdID0gMHg4MCB8IChjID4+PiA2ICYgMHgzZik7XG4gICAgICAgICAgICBidWZbaSsrXSA9IDB4ODAgfCAoYyAmIDB4M2YpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLyogZm91ciBieXRlcyAqL1xuICAgICAgICAgICAgYnVmW2krK10gPSAweGYwIHwgKGMgPj4+IDE4KTtcbiAgICAgICAgICAgIGJ1ZltpKytdID0gMHg4MCB8IChjID4+PiAxMiAmIDB4M2YpO1xuICAgICAgICAgICAgYnVmW2krK10gPSAweDgwIHwgKGMgPj4+IDYgJiAweDNmKTtcbiAgICAgICAgICAgIGJ1ZltpKytdID0gMHg4MCB8IChjICYgMHgzZik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gYnVmO1xufTtcblxuLy8gQ2FsY3VsYXRlIG1heCBwb3NzaWJsZSBwb3NpdGlvbiBpbiB1dGY4IGJ1ZmZlcixcbi8vIHRoYXQgd2lsbCBub3QgYnJlYWsgc2VxdWVuY2UuIElmIHRoYXQncyBub3QgcG9zc2libGVcbi8vIC0gKHZlcnkgc21hbGwgbGltaXRzKSByZXR1cm4gbWF4IHNpemUgYXMgaXMuXG4vL1xuLy8gYnVmW10gLSB1dGY4IGJ5dGVzIGFycmF5XG4vLyBtYXggICAtIGxlbmd0aCBsaW1pdCAobWFuZGF0b3J5KTtcbnZhciB1dGY4Ym9yZGVyID0gZnVuY3Rpb24oYnVmLCBtYXgpIHtcbiAgICB2YXIgcG9zO1xuXG4gICAgbWF4ID0gbWF4IHx8IGJ1Zi5sZW5ndGg7XG4gICAgaWYgKG1heCA+IGJ1Zi5sZW5ndGgpIHsgbWF4ID0gYnVmLmxlbmd0aDsgfVxuXG4gICAgLy8gZ28gYmFjayBmcm9tIGxhc3QgcG9zaXRpb24sIHVudGlsIHN0YXJ0IG9mIHNlcXVlbmNlIGZvdW5kXG4gICAgcG9zID0gbWF4LTE7XG4gICAgd2hpbGUgKHBvcyA+PSAwICYmIChidWZbcG9zXSAmIDB4QzApID09PSAweDgwKSB7IHBvcy0tOyB9XG5cbiAgICAvLyBGdWNrdXAgLSB2ZXJ5IHNtYWxsIGFuZCBicm9rZW4gc2VxdWVuY2UsXG4gICAgLy8gcmV0dXJuIG1heCwgYmVjYXVzZSB3ZSBzaG91bGQgcmV0dXJuIHNvbWV0aGluZyBhbnl3YXkuXG4gICAgaWYgKHBvcyA8IDApIHsgcmV0dXJuIG1heDsgfVxuXG4gICAgLy8gSWYgd2UgY2FtZSB0byBzdGFydCBvZiBidWZmZXIgLSB0aGF0IG1lYW5zIHZ1ZmZlciBpcyB0b28gc21hbGwsXG4gICAgLy8gcmV0dXJuIG1heCB0b28uXG4gICAgaWYgKHBvcyA9PT0gMCkgeyByZXR1cm4gbWF4OyB9XG5cbiAgICByZXR1cm4gKHBvcyArIF91dGY4bGVuW2J1Zltwb3NdXSA+IG1heCkgPyBwb3MgOiBtYXg7XG59O1xuXG4vLyBjb252ZXJ0IGFycmF5IHRvIHN0cmluZ1xudmFyIGJ1ZjJzdHJpbmcgPSBmdW5jdGlvbiAoYnVmKSB7XG4gICAgdmFyIHN0ciwgaSwgb3V0LCBjLCBjX2xlbjtcbiAgICB2YXIgbGVuID0gYnVmLmxlbmd0aDtcblxuICAgIC8vIFJlc2VydmUgbWF4IHBvc3NpYmxlIGxlbmd0aCAoMiB3b3JkcyBwZXIgY2hhcilcbiAgICAvLyBOQjogYnkgdW5rbm93biByZWFzb25zLCBBcnJheSBpcyBzaWduaWZpY2FudGx5IGZhc3RlciBmb3JcbiAgICAvLyAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseSB0aGFuIFVpbnQxNkFycmF5LlxuICAgIHZhciB1dGYxNmJ1ZiA9IG5ldyBBcnJheShsZW4qMik7XG5cbiAgICBmb3IgKG91dD0wLCBpPTA7IGk8bGVuOykge1xuICAgICAgICBjID0gYnVmW2krK107XG4gICAgICAgIC8vIHF1aWNrIHByb2Nlc3MgYXNjaWlcbiAgICAgICAgaWYgKGMgPCAweDgwKSB7IHV0ZjE2YnVmW291dCsrXSA9IGM7IGNvbnRpbnVlOyB9XG5cbiAgICAgICAgY19sZW4gPSBfdXRmOGxlbltjXTtcbiAgICAgICAgLy8gc2tpcCA1ICYgNiBieXRlIGNvZGVzXG4gICAgICAgIGlmIChjX2xlbiA+IDQpIHsgdXRmMTZidWZbb3V0KytdID0gMHhmZmZkOyBpICs9IGNfbGVuLTE7IGNvbnRpbnVlOyB9XG5cbiAgICAgICAgLy8gYXBwbHkgbWFzayBvbiBmaXJzdCBieXRlXG4gICAgICAgIGMgJj0gY19sZW4gPT09IDIgPyAweDFmIDogY19sZW4gPT09IDMgPyAweDBmIDogMHgwNztcbiAgICAgICAgLy8gam9pbiB0aGUgcmVzdFxuICAgICAgICB3aGlsZSAoY19sZW4gPiAxICYmIGkgPCBsZW4pIHtcbiAgICAgICAgICAgIGMgPSAoYyA8PCA2KSB8IChidWZbaSsrXSAmIDB4M2YpO1xuICAgICAgICAgICAgY19sZW4tLTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHRlcm1pbmF0ZWQgYnkgZW5kIG9mIHN0cmluZz9cbiAgICAgICAgaWYgKGNfbGVuID4gMSkgeyB1dGYxNmJ1ZltvdXQrK10gPSAweGZmZmQ7IGNvbnRpbnVlOyB9XG5cbiAgICAgICAgaWYgKGMgPCAweDEwMDAwKSB7XG4gICAgICAgICAgICB1dGYxNmJ1ZltvdXQrK10gPSBjO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYyAtPSAweDEwMDAwO1xuICAgICAgICAgICAgdXRmMTZidWZbb3V0KytdID0gMHhkODAwIHwgKChjID4+IDEwKSAmIDB4M2ZmKTtcbiAgICAgICAgICAgIHV0ZjE2YnVmW291dCsrXSA9IDB4ZGMwMCB8IChjICYgMHgzZmYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gc2hyaW5rQnVmKHV0ZjE2YnVmLCBvdXQpXG4gICAgaWYgKHV0ZjE2YnVmLmxlbmd0aCAhPT0gb3V0KSB7XG4gICAgICAgIGlmKHV0ZjE2YnVmLnN1YmFycmF5KSB7XG4gICAgICAgICAgICB1dGYxNmJ1ZiA9IHV0ZjE2YnVmLnN1YmFycmF5KDAsIG91dCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB1dGYxNmJ1Zi5sZW5ndGggPSBvdXQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCB1dGYxNmJ1Zik7XG4gICAgcmV0dXJuIHV0aWxzLmFwcGx5RnJvbUNoYXJDb2RlKHV0ZjE2YnVmKTtcbn07XG5cblxuLy8gVGhhdCdzIGFsbCBmb3IgdGhlIHBha28gZnVuY3Rpb25zLlxuXG5cbi8qKlxuICogVHJhbnNmb3JtIGEgamF2YXNjcmlwdCBzdHJpbmcgaW50byBhbiBhcnJheSAodHlwZWQgaWYgcG9zc2libGUpIG9mIGJ5dGVzLFxuICogVVRGLTggZW5jb2RlZC5cbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgdGhlIHN0cmluZyB0byBlbmNvZGVcbiAqIEByZXR1cm4ge0FycmF5fFVpbnQ4QXJyYXl8QnVmZmVyfSB0aGUgVVRGLTggZW5jb2RlZCBzdHJpbmcuXG4gKi9cbmV4cG9ydHMudXRmOGVuY29kZSA9IGZ1bmN0aW9uIHV0ZjhlbmNvZGUoc3RyKSB7XG4gICAgaWYgKHN1cHBvcnQubm9kZWJ1ZmZlcikge1xuICAgICAgICByZXR1cm4gbm9kZUJ1ZmZlcihzdHIsIFwidXRmLThcIik7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0cmluZzJidWYoc3RyKTtcbn07XG5cblxuLyoqXG4gKiBUcmFuc2Zvcm0gYSBieXRlcyBhcnJheSAob3IgYSByZXByZXNlbnRhdGlvbikgcmVwcmVzZW50aW5nIGFuIFVURi04IGVuY29kZWRcbiAqIHN0cmluZyBpbnRvIGEgamF2YXNjcmlwdCBzdHJpbmcuXG4gKiBAcGFyYW0ge0FycmF5fFVpbnQ4QXJyYXl8QnVmZmVyfSBidWYgdGhlIGRhdGEgZGUgZGVjb2RlXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHRoZSBkZWNvZGVkIHN0cmluZy5cbiAqL1xuZXhwb3J0cy51dGY4ZGVjb2RlID0gZnVuY3Rpb24gdXRmOGRlY29kZShidWYpIHtcbiAgICBpZiAoc3VwcG9ydC5ub2RlYnVmZmVyKSB7XG4gICAgICAgIHJldHVybiB1dGlscy50cmFuc2Zvcm1UbyhcIm5vZGVidWZmZXJcIiwgYnVmKS50b1N0cmluZyhcInV0Zi04XCIpO1xuICAgIH1cblxuICAgIGJ1ZiA9IHV0aWxzLnRyYW5zZm9ybVRvKHN1cHBvcnQudWludDhhcnJheSA/IFwidWludDhhcnJheVwiIDogXCJhcnJheVwiLCBidWYpO1xuXG4gICAgLy8gcmV0dXJuIGJ1ZjJzdHJpbmcoYnVmKTtcbiAgICAvLyBDaHJvbWUgcHJlZmVycyB0byB3b3JrIHdpdGggXCJzbWFsbFwiIGNodW5rcyBvZiBkYXRhXG4gICAgLy8gZm9yIHRoZSBtZXRob2QgYnVmMnN0cmluZy5cbiAgICAvLyBGaXJlZm94IGFuZCBDaHJvbWUgaGFzIHRoZWlyIG93biBzaG9ydGN1dCwgSUUgZG9lc24ndCBzZWVtIHRvIHJlYWxseSBjYXJlLlxuICAgIHZhciByZXN1bHQgPSBbXSwgayA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGgsIGNodW5rID0gNjU1MzY7XG4gICAgd2hpbGUgKGsgPCBsZW4pIHtcbiAgICAgICAgdmFyIG5leHRCb3VuZGFyeSA9IHV0Zjhib3JkZXIoYnVmLCBNYXRoLm1pbihrICsgY2h1bmssIGxlbikpO1xuICAgICAgICBpZiAoc3VwcG9ydC51aW50OGFycmF5KSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaChidWYyc3RyaW5nKGJ1Zi5zdWJhcnJheShrLCBuZXh0Qm91bmRhcnkpKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXN1bHQucHVzaChidWYyc3RyaW5nKGJ1Zi5zbGljZShrLCBuZXh0Qm91bmRhcnkpKSk7XG4gICAgICAgIH1cbiAgICAgICAgayA9IG5leHRCb3VuZGFyeTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdC5qb2luKFwiXCIpO1xuXG59O1xuLy8gdmltOiBzZXQgc2hpZnR3aWR0aD00IHNvZnR0YWJzdG9wPTQ6XG4iLCIndXNlIHN0cmljdCc7XG52YXIgc3VwcG9ydCA9IHJlcXVpcmUoJy4vc3VwcG9ydCcpO1xudmFyIGNvbXByZXNzaW9ucyA9IHJlcXVpcmUoJy4vY29tcHJlc3Npb25zJyk7XG52YXIgbm9kZUJ1ZmZlciA9IHJlcXVpcmUoJy4vbm9kZUJ1ZmZlcicpO1xuLyoqXG4gKiBDb252ZXJ0IGEgc3RyaW5nIHRvIGEgXCJiaW5hcnkgc3RyaW5nXCIgOiBhIHN0cmluZyBjb250YWluaW5nIG9ubHkgY2hhciBjb2RlcyBiZXR3ZWVuIDAgYW5kIDI1NS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgdGhlIHN0cmluZyB0byB0cmFuc2Zvcm0uXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHRoZSBiaW5hcnkgc3RyaW5nLlxuICovXG5leHBvcnRzLnN0cmluZzJiaW5hcnkgPSBmdW5jdGlvbihzdHIpIHtcbiAgICB2YXIgcmVzdWx0ID0gXCJcIjtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgICAgICByZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShzdHIuY2hhckNvZGVBdChpKSAmIDB4ZmYpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xufTtcbmV4cG9ydHMuYXJyYXlCdWZmZXIyQmxvYiA9IGZ1bmN0aW9uKGJ1ZmZlciwgbWltZVR5cGUpIHtcbiAgICBleHBvcnRzLmNoZWNrU3VwcG9ydChcImJsb2JcIik7XG5cdG1pbWVUeXBlID0gbWltZVR5cGUgfHwgJ2FwcGxpY2F0aW9uL3ppcCc7XG5cbiAgICB0cnkge1xuICAgICAgICAvLyBCbG9iIGNvbnN0cnVjdG9yXG4gICAgICAgIHJldHVybiBuZXcgQmxvYihbYnVmZmVyXSwge1xuICAgICAgICAgICAgdHlwZTogbWltZVR5cGVcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGNhdGNoIChlKSB7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIGRlcHJlY2F0ZWQsIGJyb3dzZXIgb25seSwgb2xkIHdheVxuICAgICAgICAgICAgdmFyIEJ1aWxkZXIgPSB3aW5kb3cuQmxvYkJ1aWxkZXIgfHwgd2luZG93LldlYktpdEJsb2JCdWlsZGVyIHx8IHdpbmRvdy5Nb3pCbG9iQnVpbGRlciB8fCB3aW5kb3cuTVNCbG9iQnVpbGRlcjtcbiAgICAgICAgICAgIHZhciBidWlsZGVyID0gbmV3IEJ1aWxkZXIoKTtcbiAgICAgICAgICAgIGJ1aWxkZXIuYXBwZW5kKGJ1ZmZlcik7XG4gICAgICAgICAgICByZXR1cm4gYnVpbGRlci5nZXRCbG9iKG1pbWVUeXBlKTtcbiAgICAgICAgfVxuICAgICAgICBjYXRjaCAoZSkge1xuXG4gICAgICAgICAgICAvLyB3ZWxsLCBmdWNrID8hXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJCdWcgOiBjYW4ndCBjb25zdHJ1Y3QgdGhlIEJsb2IuXCIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn07XG4vKipcbiAqIFRoZSBpZGVudGl0eSBmdW5jdGlvbi5cbiAqIEBwYXJhbSB7T2JqZWN0fSBpbnB1dCB0aGUgaW5wdXQuXG4gKiBAcmV0dXJuIHtPYmplY3R9IHRoZSBzYW1lIGlucHV0LlxuICovXG5mdW5jdGlvbiBpZGVudGl0eShpbnB1dCkge1xuICAgIHJldHVybiBpbnB1dDtcbn1cblxuLyoqXG4gKiBGaWxsIGluIGFuIGFycmF5IHdpdGggYSBzdHJpbmcuXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyIHRoZSBzdHJpbmcgdG8gdXNlLlxuICogQHBhcmFtIHtBcnJheXxBcnJheUJ1ZmZlcnxVaW50OEFycmF5fEJ1ZmZlcn0gYXJyYXkgdGhlIGFycmF5IHRvIGZpbGwgaW4gKHdpbGwgYmUgbXV0YXRlZCkuXG4gKiBAcmV0dXJuIHtBcnJheXxBcnJheUJ1ZmZlcnxVaW50OEFycmF5fEJ1ZmZlcn0gdGhlIHVwZGF0ZWQgYXJyYXkuXG4gKi9cbmZ1bmN0aW9uIHN0cmluZ1RvQXJyYXlMaWtlKHN0ciwgYXJyYXkpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgICAgICBhcnJheVtpXSA9IHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRjtcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5O1xufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbiBhcnJheS1saWtlIG9iamVjdCB0byBhIHN0cmluZy5cbiAqIEBwYXJhbSB7QXJyYXl8QXJyYXlCdWZmZXJ8VWludDhBcnJheXxCdWZmZXJ9IGFycmF5IHRoZSBhcnJheSB0byB0cmFuc2Zvcm0uXG4gKiBAcmV0dXJuIHtTdHJpbmd9IHRoZSByZXN1bHQuXG4gKi9cbmZ1bmN0aW9uIGFycmF5TGlrZVRvU3RyaW5nKGFycmF5KSB7XG4gICAgLy8gUGVyZm9ybWFuY2VzIG5vdGVzIDpcbiAgICAvLyAtLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgIC8vIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgYXJyYXkpIGlzIHRoZSBmYXN0ZXN0LCBzZWVcbiAgICAvLyBzZWUgaHR0cDovL2pzcGVyZi5jb20vY29udmVydGluZy1hLXVpbnQ4YXJyYXktdG8tYS1zdHJpbmcvMlxuICAgIC8vIGJ1dCB0aGUgc3RhY2sgaXMgbGltaXRlZCAoYW5kIHdlIGNhbiBnZXQgaHVnZSBhcnJheXMgISkuXG4gICAgLy9cbiAgICAvLyByZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShhcnJheVtpXSk7IGdlbmVyYXRlIHRvbyBtYW55IHN0cmluZ3MgIVxuICAgIC8vXG4gICAgLy8gVGhpcyBjb2RlIGlzIGluc3BpcmVkIGJ5IGh0dHA6Ly9qc3BlcmYuY29tL2FycmF5YnVmZmVyLXRvLXN0cmluZy1hcHBseS1wZXJmb3JtYW5jZS8yXG4gICAgdmFyIGNodW5rID0gNjU1MzY7XG4gICAgdmFyIHJlc3VsdCA9IFtdLFxuICAgICAgICBsZW4gPSBhcnJheS5sZW5ndGgsXG4gICAgICAgIHR5cGUgPSBleHBvcnRzLmdldFR5cGVPZihhcnJheSksXG4gICAgICAgIGsgPSAwLFxuICAgICAgICBjYW5Vc2VBcHBseSA9IHRydWU7XG4gICAgICB0cnkge1xuICAgICAgICAgc3dpdGNoKHR5cGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJ1aW50OGFycmF5XCI6XG4gICAgICAgICAgICAgICBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KDApKTtcbiAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIm5vZGVidWZmZXJcIjpcbiAgICAgICAgICAgICAgIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgbm9kZUJ1ZmZlcigwKSk7XG4gICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgIH1cbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgY2FuVXNlQXBwbHkgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgLy8gbm8gYXBwbHkgOiBzbG93IGFuZCBwYWluZnVsIGFsZ29yaXRobVxuICAgICAgLy8gZGVmYXVsdCBicm93c2VyIG9uIGFuZHJvaWQgNC4qXG4gICAgICBpZiAoIWNhblVzZUFwcGx5KSB7XG4gICAgICAgICB2YXIgcmVzdWx0U3RyID0gXCJcIjtcbiAgICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7aSsrKSB7XG4gICAgICAgICAgICByZXN1bHRTdHIgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShhcnJheVtpXSk7XG4gICAgICAgICB9XG4gICAgcmV0dXJuIHJlc3VsdFN0cjtcbiAgICB9XG4gICAgd2hpbGUgKGsgPCBsZW4gJiYgY2h1bmsgPiAxKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gXCJhcnJheVwiIHx8IHR5cGUgPT09IFwibm9kZWJ1ZmZlclwiKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBhcnJheS5zbGljZShrLCBNYXRoLm1pbihrICsgY2h1bmssIGxlbikpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHQucHVzaChTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIGFycmF5LnN1YmFycmF5KGssIE1hdGgubWluKGsgKyBjaHVuaywgbGVuKSkpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGsgKz0gY2h1bms7XG4gICAgICAgIH1cbiAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNodW5rID0gTWF0aC5mbG9vcihjaHVuayAvIDIpO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQuam9pbihcIlwiKTtcbn1cblxuZXhwb3J0cy5hcHBseUZyb21DaGFyQ29kZSA9IGFycmF5TGlrZVRvU3RyaW5nO1xuXG5cbi8qKlxuICogQ29weSB0aGUgZGF0YSBmcm9tIGFuIGFycmF5LWxpa2UgdG8gYW4gb3RoZXIgYXJyYXktbGlrZS5cbiAqIEBwYXJhbSB7QXJyYXl8QXJyYXlCdWZmZXJ8VWludDhBcnJheXxCdWZmZXJ9IGFycmF5RnJvbSB0aGUgb3JpZ2luIGFycmF5LlxuICogQHBhcmFtIHtBcnJheXxBcnJheUJ1ZmZlcnxVaW50OEFycmF5fEJ1ZmZlcn0gYXJyYXlUbyB0aGUgZGVzdGluYXRpb24gYXJyYXkgd2hpY2ggd2lsbCBiZSBtdXRhdGVkLlxuICogQHJldHVybiB7QXJyYXl8QXJyYXlCdWZmZXJ8VWludDhBcnJheXxCdWZmZXJ9IHRoZSB1cGRhdGVkIGRlc3RpbmF0aW9uIGFycmF5LlxuICovXG5mdW5jdGlvbiBhcnJheUxpa2VUb0FycmF5TGlrZShhcnJheUZyb20sIGFycmF5VG8pIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFycmF5RnJvbS5sZW5ndGg7IGkrKykge1xuICAgICAgICBhcnJheVRvW2ldID0gYXJyYXlGcm9tW2ldO1xuICAgIH1cbiAgICByZXR1cm4gYXJyYXlUbztcbn1cblxuLy8gYSBtYXRyaXggY29udGFpbmluZyBmdW5jdGlvbnMgdG8gdHJhbnNmb3JtIGV2ZXJ5dGhpbmcgaW50byBldmVyeXRoaW5nLlxudmFyIHRyYW5zZm9ybSA9IHt9O1xuXG4vLyBzdHJpbmcgdG8gP1xudHJhbnNmb3JtW1wic3RyaW5nXCJdID0ge1xuICAgIFwic3RyaW5nXCI6IGlkZW50aXR5LFxuICAgIFwiYXJyYXlcIjogZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIHN0cmluZ1RvQXJyYXlMaWtlKGlucHV0LCBuZXcgQXJyYXkoaW5wdXQubGVuZ3RoKSk7XG4gICAgfSxcbiAgICBcImFycmF5YnVmZmVyXCI6IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICAgIHJldHVybiB0cmFuc2Zvcm1bXCJzdHJpbmdcIl1bXCJ1aW50OGFycmF5XCJdKGlucHV0KS5idWZmZXI7XG4gICAgfSxcbiAgICBcInVpbnQ4YXJyYXlcIjogZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIHN0cmluZ1RvQXJyYXlMaWtlKGlucHV0LCBuZXcgVWludDhBcnJheShpbnB1dC5sZW5ndGgpKTtcbiAgICB9LFxuICAgIFwibm9kZWJ1ZmZlclwiOiBmdW5jdGlvbihpbnB1dCkge1xuICAgICAgICByZXR1cm4gc3RyaW5nVG9BcnJheUxpa2UoaW5wdXQsIG5vZGVCdWZmZXIoaW5wdXQubGVuZ3RoKSk7XG4gICAgfVxufTtcblxuLy8gYXJyYXkgdG8gP1xudHJhbnNmb3JtW1wiYXJyYXlcIl0gPSB7XG4gICAgXCJzdHJpbmdcIjogYXJyYXlMaWtlVG9TdHJpbmcsXG4gICAgXCJhcnJheVwiOiBpZGVudGl0eSxcbiAgICBcImFycmF5YnVmZmVyXCI6IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICAgIHJldHVybiAobmV3IFVpbnQ4QXJyYXkoaW5wdXQpKS5idWZmZXI7XG4gICAgfSxcbiAgICBcInVpbnQ4YXJyYXlcIjogZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGlucHV0KTtcbiAgICB9LFxuICAgIFwibm9kZWJ1ZmZlclwiOiBmdW5jdGlvbihpbnB1dCkge1xuICAgICAgICByZXR1cm4gbm9kZUJ1ZmZlcihpbnB1dCk7XG4gICAgfVxufTtcblxuLy8gYXJyYXlidWZmZXIgdG8gP1xudHJhbnNmb3JtW1wiYXJyYXlidWZmZXJcIl0gPSB7XG4gICAgXCJzdHJpbmdcIjogZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIGFycmF5TGlrZVRvU3RyaW5nKG5ldyBVaW50OEFycmF5KGlucHV0KSk7XG4gICAgfSxcbiAgICBcImFycmF5XCI6IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBhcnJheUxpa2VUb0FycmF5TGlrZShuZXcgVWludDhBcnJheShpbnB1dCksIG5ldyBBcnJheShpbnB1dC5ieXRlTGVuZ3RoKSk7XG4gICAgfSxcbiAgICBcImFycmF5YnVmZmVyXCI6IGlkZW50aXR5LFxuICAgIFwidWludDhhcnJheVwiOiBmdW5jdGlvbihpbnB1dCkge1xuICAgICAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoaW5wdXQpO1xuICAgIH0sXG4gICAgXCJub2RlYnVmZmVyXCI6IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBub2RlQnVmZmVyKG5ldyBVaW50OEFycmF5KGlucHV0KSk7XG4gICAgfVxufTtcblxuLy8gdWludDhhcnJheSB0byA/XG50cmFuc2Zvcm1bXCJ1aW50OGFycmF5XCJdID0ge1xuICAgIFwic3RyaW5nXCI6IGFycmF5TGlrZVRvU3RyaW5nLFxuICAgIFwiYXJyYXlcIjogZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIGFycmF5TGlrZVRvQXJyYXlMaWtlKGlucHV0LCBuZXcgQXJyYXkoaW5wdXQubGVuZ3RoKSk7XG4gICAgfSxcbiAgICBcImFycmF5YnVmZmVyXCI6IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBpbnB1dC5idWZmZXI7XG4gICAgfSxcbiAgICBcInVpbnQ4YXJyYXlcIjogaWRlbnRpdHksXG4gICAgXCJub2RlYnVmZmVyXCI6IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgICAgIHJldHVybiBub2RlQnVmZmVyKGlucHV0KTtcbiAgICB9XG59O1xuXG4vLyBub2RlYnVmZmVyIHRvID9cbnRyYW5zZm9ybVtcIm5vZGVidWZmZXJcIl0gPSB7XG4gICAgXCJzdHJpbmdcIjogYXJyYXlMaWtlVG9TdHJpbmcsXG4gICAgXCJhcnJheVwiOiBmdW5jdGlvbihpbnB1dCkge1xuICAgICAgICByZXR1cm4gYXJyYXlMaWtlVG9BcnJheUxpa2UoaW5wdXQsIG5ldyBBcnJheShpbnB1dC5sZW5ndGgpKTtcbiAgICB9LFxuICAgIFwiYXJyYXlidWZmZXJcIjogZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIHRyYW5zZm9ybVtcIm5vZGVidWZmZXJcIl1bXCJ1aW50OGFycmF5XCJdKGlucHV0KS5idWZmZXI7XG4gICAgfSxcbiAgICBcInVpbnQ4YXJyYXlcIjogZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIGFycmF5TGlrZVRvQXJyYXlMaWtlKGlucHV0LCBuZXcgVWludDhBcnJheShpbnB1dC5sZW5ndGgpKTtcbiAgICB9LFxuICAgIFwibm9kZWJ1ZmZlclwiOiBpZGVudGl0eVxufTtcblxuLyoqXG4gKiBUcmFuc2Zvcm0gYW4gaW5wdXQgaW50byBhbnkgdHlwZS5cbiAqIFRoZSBzdXBwb3J0ZWQgb3V0cHV0IHR5cGUgYXJlIDogc3RyaW5nLCBhcnJheSwgdWludDhhcnJheSwgYXJyYXlidWZmZXIsIG5vZGVidWZmZXIuXG4gKiBJZiBubyBvdXRwdXQgdHlwZSBpcyBzcGVjaWZpZWQsIHRoZSB1bm1vZGlmaWVkIGlucHV0IHdpbGwgYmUgcmV0dXJuZWQuXG4gKiBAcGFyYW0ge1N0cmluZ30gb3V0cHV0VHlwZSB0aGUgb3V0cHV0IHR5cGUuXG4gKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxBcnJheUJ1ZmZlcnxVaW50OEFycmF5fEJ1ZmZlcn0gaW5wdXQgdGhlIGlucHV0IHRvIGNvbnZlcnQuXG4gKiBAdGhyb3dzIHtFcnJvcn0gYW4gRXJyb3IgaWYgdGhlIGJyb3dzZXIgZG9lc24ndCBzdXBwb3J0IHRoZSByZXF1ZXN0ZWQgb3V0cHV0IHR5cGUuXG4gKi9cbmV4cG9ydHMudHJhbnNmb3JtVG8gPSBmdW5jdGlvbihvdXRwdXRUeXBlLCBpbnB1dCkge1xuICAgIGlmICghaW5wdXQpIHtcbiAgICAgICAgLy8gdW5kZWZpbmVkLCBudWxsLCBldGNcbiAgICAgICAgLy8gYW4gZW1wdHkgc3RyaW5nIHdvbid0IGhhcm0uXG4gICAgICAgIGlucHV0ID0gXCJcIjtcbiAgICB9XG4gICAgaWYgKCFvdXRwdXRUeXBlKSB7XG4gICAgICAgIHJldHVybiBpbnB1dDtcbiAgICB9XG4gICAgZXhwb3J0cy5jaGVja1N1cHBvcnQob3V0cHV0VHlwZSk7XG4gICAgdmFyIGlucHV0VHlwZSA9IGV4cG9ydHMuZ2V0VHlwZU9mKGlucHV0KTtcbiAgICB2YXIgcmVzdWx0ID0gdHJhbnNmb3JtW2lucHV0VHlwZV1bb3V0cHV0VHlwZV0oaW5wdXQpO1xuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4vKipcbiAqIFJldHVybiB0aGUgdHlwZSBvZiB0aGUgaW5wdXQuXG4gKiBUaGUgdHlwZSB3aWxsIGJlIGluIGEgZm9ybWF0IHZhbGlkIGZvciBKU1ppcC51dGlscy50cmFuc2Zvcm1UbyA6IHN0cmluZywgYXJyYXksIHVpbnQ4YXJyYXksIGFycmF5YnVmZmVyLlxuICogQHBhcmFtIHtPYmplY3R9IGlucHV0IHRoZSBpbnB1dCB0byBpZGVudGlmeS5cbiAqIEByZXR1cm4ge1N0cmluZ30gdGhlIChsb3dlcmNhc2UpIHR5cGUgb2YgdGhlIGlucHV0LlxuICovXG5leHBvcnRzLmdldFR5cGVPZiA9IGZ1bmN0aW9uKGlucHV0KSB7XG4gICAgaWYgKHR5cGVvZiBpbnB1dCA9PT0gXCJzdHJpbmdcIikge1xuICAgICAgICByZXR1cm4gXCJzdHJpbmdcIjtcbiAgICB9XG4gICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChpbnB1dCkgPT09IFwiW29iamVjdCBBcnJheV1cIikge1xuICAgICAgICByZXR1cm4gXCJhcnJheVwiO1xuICAgIH1cbiAgICBpZiAoc3VwcG9ydC5ub2RlYnVmZmVyICYmIG5vZGVCdWZmZXIudGVzdChpbnB1dCkpIHtcbiAgICAgICAgcmV0dXJuIFwibm9kZWJ1ZmZlclwiO1xuICAgIH1cbiAgICBpZiAoc3VwcG9ydC51aW50OGFycmF5ICYmIGlucHV0IGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgICAgICByZXR1cm4gXCJ1aW50OGFycmF5XCI7XG4gICAgfVxuICAgIGlmIChzdXBwb3J0LmFycmF5YnVmZmVyICYmIGlucHV0IGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgICAgcmV0dXJuIFwiYXJyYXlidWZmZXJcIjtcbiAgICB9XG59O1xuXG4vKipcbiAqIFRocm93IGFuIGV4Y2VwdGlvbiBpZiB0aGUgdHlwZSBpcyBub3Qgc3VwcG9ydGVkLlxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgdGhlIHR5cGUgdG8gY2hlY2suXG4gKiBAdGhyb3dzIHtFcnJvcn0gYW4gRXJyb3IgaWYgdGhlIGJyb3dzZXIgZG9lc24ndCBzdXBwb3J0IHRoZSByZXF1ZXN0ZWQgdHlwZS5cbiAqL1xuZXhwb3J0cy5jaGVja1N1cHBvcnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gICAgdmFyIHN1cHBvcnRlZCA9IHN1cHBvcnRbdHlwZS50b0xvd2VyQ2FzZSgpXTtcbiAgICBpZiAoIXN1cHBvcnRlZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IodHlwZSArIFwiIGlzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBicm93c2VyXCIpO1xuICAgIH1cbn07XG5leHBvcnRzLk1BWF9WQUxVRV8xNkJJVFMgPSA2NTUzNTtcbmV4cG9ydHMuTUFYX1ZBTFVFXzMyQklUUyA9IC0xOyAvLyB3ZWxsLCBcIlxceEZGXFx4RkZcXHhGRlxceEZGXFx4RkZcXHhGRlxceEZGXFx4RkZcIiBpcyBwYXJzZWQgYXMgLTFcblxuLyoqXG4gKiBQcmV0dGlmeSBhIHN0cmluZyByZWFkIGFzIGJpbmFyeS5cbiAqIEBwYXJhbSB7c3RyaW5nfSBzdHIgdGhlIHN0cmluZyB0byBwcmV0dGlmeS5cbiAqIEByZXR1cm4ge3N0cmluZ30gYSBwcmV0dHkgc3RyaW5nLlxuICovXG5leHBvcnRzLnByZXR0eSA9IGZ1bmN0aW9uKHN0cikge1xuICAgIHZhciByZXMgPSAnJyxcbiAgICAgICAgY29kZSwgaTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgKHN0ciB8fCBcIlwiKS5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb2RlID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgIHJlcyArPSAnXFxcXHgnICsgKGNvZGUgPCAxNiA/IFwiMFwiIDogXCJcIikgKyBjb2RlLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpO1xuICAgIH1cbiAgICByZXR1cm4gcmVzO1xufTtcblxuLyoqXG4gKiBGaW5kIGEgY29tcHJlc3Npb24gcmVnaXN0ZXJlZCBpbiBKU1ppcC5cbiAqIEBwYXJhbSB7c3RyaW5nfSBjb21wcmVzc2lvbk1ldGhvZCB0aGUgbWV0aG9kIG1hZ2ljIHRvIGZpbmQuXG4gKiBAcmV0dXJuIHtPYmplY3R8bnVsbH0gdGhlIEpTWmlwIGNvbXByZXNzaW9uIG9iamVjdCwgbnVsbCBpZiBub25lIGZvdW5kLlxuICovXG5leHBvcnRzLmZpbmRDb21wcmVzc2lvbiA9IGZ1bmN0aW9uKGNvbXByZXNzaW9uTWV0aG9kKSB7XG4gICAgZm9yICh2YXIgbWV0aG9kIGluIGNvbXByZXNzaW9ucykge1xuICAgICAgICBpZiAoIWNvbXByZXNzaW9ucy5oYXNPd25Qcm9wZXJ0eShtZXRob2QpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoY29tcHJlc3Npb25zW21ldGhvZF0ubWFnaWMgPT09IGNvbXByZXNzaW9uTWV0aG9kKSB7XG4gICAgICAgICAgICByZXR1cm4gY29tcHJlc3Npb25zW21ldGhvZF07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG59O1xuLyoqXG4qIENyb3NzLXdpbmRvdywgY3Jvc3MtTm9kZS1jb250ZXh0IHJlZ3VsYXIgZXhwcmVzc2lvbiBkZXRlY3Rpb25cbiogQHBhcmFtICB7T2JqZWN0fSAgb2JqZWN0IEFueXRoaW5nXG4qIEByZXR1cm4ge0Jvb2xlYW59ICAgICAgICB0cnVlIGlmIHRoZSBvYmplY3QgaXMgYSByZWd1bGFyIGV4cHJlc3Npb24sXG4qIGZhbHNlIG90aGVyd2lzZVxuKi9cbmV4cG9ydHMuaXNSZWdFeHAgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChvYmplY3QpID09PSBcIltvYmplY3QgUmVnRXhwXVwiO1xufTtcblxuLyoqXG4gKiBNZXJnZSB0aGUgb2JqZWN0cyBwYXNzZWQgYXMgcGFyYW1ldGVycyBpbnRvIGEgbmV3IG9uZS5cbiAqIEBwcml2YXRlXG4gKiBAcGFyYW0gey4uLk9iamVjdH0gdmFyX2FyZ3MgQWxsIG9iamVjdHMgdG8gbWVyZ2UuXG4gKiBAcmV0dXJuIHtPYmplY3R9IGEgbmV3IG9iamVjdCB3aXRoIHRoZSBkYXRhIG9mIHRoZSBvdGhlcnMuXG4gKi9cbmV4cG9ydHMuZXh0ZW5kID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9LCBpLCBhdHRyO1xuICAgIGZvciAoaSA9IDA7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHsgLy8gYXJndW1lbnRzIGlzIG5vdCBlbnVtZXJhYmxlIGluIHNvbWUgYnJvd3NlcnNcbiAgICAgICAgZm9yIChhdHRyIGluIGFyZ3VtZW50c1tpXSkge1xuICAgICAgICAgICAgaWYgKGFyZ3VtZW50c1tpXS5oYXNPd25Qcm9wZXJ0eShhdHRyKSAmJiB0eXBlb2YgcmVzdWx0W2F0dHJdID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W2F0dHJdID0gYXJndW1lbnRzW2ldW2F0dHJdO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG52YXIgU3RyaW5nUmVhZGVyID0gcmVxdWlyZSgnLi9zdHJpbmdSZWFkZXInKTtcbnZhciBOb2RlQnVmZmVyUmVhZGVyID0gcmVxdWlyZSgnLi9ub2RlQnVmZmVyUmVhZGVyJyk7XG52YXIgVWludDhBcnJheVJlYWRlciA9IHJlcXVpcmUoJy4vdWludDhBcnJheVJlYWRlcicpO1xudmFyIEFycmF5UmVhZGVyID0gcmVxdWlyZSgnLi9hcnJheVJlYWRlcicpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIHNpZyA9IHJlcXVpcmUoJy4vc2lnbmF0dXJlJyk7XG52YXIgWmlwRW50cnkgPSByZXF1aXJlKCcuL3ppcEVudHJ5Jyk7XG52YXIgc3VwcG9ydCA9IHJlcXVpcmUoJy4vc3VwcG9ydCcpO1xudmFyIGpzemlwUHJvdG8gPSByZXF1aXJlKCcuL29iamVjdCcpO1xuLy8gIGNsYXNzIFppcEVudHJpZXMge3t7XG4vKipcbiAqIEFsbCB0aGUgZW50cmllcyBpbiB0aGUgemlwIGZpbGUuXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7U3RyaW5nfEFycmF5QnVmZmVyfFVpbnQ4QXJyYXl9IGRhdGEgdGhlIGJpbmFyeSBzdHJlYW0gdG8gbG9hZC5cbiAqIEBwYXJhbSB7T2JqZWN0fSBsb2FkT3B0aW9ucyBPcHRpb25zIGZvciBsb2FkaW5nIHRoZSBzdHJlYW0uXG4gKi9cbmZ1bmN0aW9uIFppcEVudHJpZXMoZGF0YSwgbG9hZE9wdGlvbnMpIHtcbiAgICB0aGlzLmZpbGVzID0gW107XG4gICAgdGhpcy5sb2FkT3B0aW9ucyA9IGxvYWRPcHRpb25zO1xuICAgIGlmIChkYXRhKSB7XG4gICAgICAgIHRoaXMubG9hZChkYXRhKTtcbiAgICB9XG59XG5aaXBFbnRyaWVzLnByb3RvdHlwZSA9IHtcbiAgICAvKipcbiAgICAgKiBDaGVjayB0aGF0IHRoZSByZWFkZXIgaXMgb24gdGhlIHNwZWZpY2llZCBzaWduYXR1cmUuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGV4cGVjdGVkU2lnbmF0dXJlIHRoZSBleHBlY3RlZCBzaWduYXR1cmUuXG4gICAgICogQHRocm93cyB7RXJyb3J9IGlmIGl0IGlzIGFuIG90aGVyIHNpZ25hdHVyZS5cbiAgICAgKi9cbiAgICBjaGVja1NpZ25hdHVyZTogZnVuY3Rpb24oZXhwZWN0ZWRTaWduYXR1cmUpIHtcbiAgICAgICAgdmFyIHNpZ25hdHVyZSA9IHRoaXMucmVhZGVyLnJlYWRTdHJpbmcoNCk7XG4gICAgICAgIGlmIChzaWduYXR1cmUgIT09IGV4cGVjdGVkU2lnbmF0dXJlKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb3JydXB0ZWQgemlwIG9yIGJ1ZyA6IHVuZXhwZWN0ZWQgc2lnbmF0dXJlIFwiICsgXCIoXCIgKyB1dGlscy5wcmV0dHkoc2lnbmF0dXJlKSArIFwiLCBleHBlY3RlZCBcIiArIHV0aWxzLnByZXR0eShleHBlY3RlZFNpZ25hdHVyZSkgKyBcIilcIik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIENoZWNrIGlmIHRoZSBnaXZlbiBzaWduYXR1cmUgaXMgYXQgdGhlIGdpdmVuIGluZGV4LlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBhc2tlZEluZGV4IHRoZSBpbmRleCB0byBjaGVjay5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gZXhwZWN0ZWRTaWduYXR1cmUgdGhlIHNpZ25hdHVyZSB0byBleHBlY3QuXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn0gdHJ1ZSBpZiB0aGUgc2lnbmF0dXJlIGlzIGhlcmUsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBpc1NpZ25hdHVyZTogZnVuY3Rpb24oYXNrZWRJbmRleCwgZXhwZWN0ZWRTaWduYXR1cmUpIHtcbiAgICAgICAgdmFyIGN1cnJlbnRJbmRleCA9IHRoaXMucmVhZGVyLmluZGV4O1xuICAgICAgICB0aGlzLnJlYWRlci5zZXRJbmRleChhc2tlZEluZGV4KTtcbiAgICAgICAgdmFyIHNpZ25hdHVyZSA9IHRoaXMucmVhZGVyLnJlYWRTdHJpbmcoNCk7XG4gICAgICAgIHZhciByZXN1bHQgPSBzaWduYXR1cmUgPT09IGV4cGVjdGVkU2lnbmF0dXJlO1xuICAgICAgICB0aGlzLnJlYWRlci5zZXRJbmRleChjdXJyZW50SW5kZXgpO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVhZCB0aGUgZW5kIG9mIHRoZSBjZW50cmFsIGRpcmVjdG9yeS5cbiAgICAgKi9cbiAgICByZWFkQmxvY2tFbmRPZkNlbnRyYWw6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmRpc2tOdW1iZXIgPSB0aGlzLnJlYWRlci5yZWFkSW50KDIpO1xuICAgICAgICB0aGlzLmRpc2tXaXRoQ2VudHJhbERpclN0YXJ0ID0gdGhpcy5yZWFkZXIucmVhZEludCgyKTtcbiAgICAgICAgdGhpcy5jZW50cmFsRGlyUmVjb3Jkc09uVGhpc0Rpc2sgPSB0aGlzLnJlYWRlci5yZWFkSW50KDIpO1xuICAgICAgICB0aGlzLmNlbnRyYWxEaXJSZWNvcmRzID0gdGhpcy5yZWFkZXIucmVhZEludCgyKTtcbiAgICAgICAgdGhpcy5jZW50cmFsRGlyU2l6ZSA9IHRoaXMucmVhZGVyLnJlYWRJbnQoNCk7XG4gICAgICAgIHRoaXMuY2VudHJhbERpck9mZnNldCA9IHRoaXMucmVhZGVyLnJlYWRJbnQoNCk7XG5cbiAgICAgICAgdGhpcy56aXBDb21tZW50TGVuZ3RoID0gdGhpcy5yZWFkZXIucmVhZEludCgyKTtcbiAgICAgICAgLy8gd2FybmluZyA6IHRoZSBlbmNvZGluZyBkZXBlbmRzIG9mIHRoZSBzeXN0ZW0gbG9jYWxlXG4gICAgICAgIC8vIE9uIGEgbGludXggbWFjaGluZSB3aXRoIExBTkc9ZW5fVVMudXRmOCwgdGhpcyBmaWVsZCBpcyB1dGY4IGVuY29kZWQuXG4gICAgICAgIC8vIE9uIGEgd2luZG93cyBtYWNoaW5lLCB0aGlzIGZpZWxkIGlzIGVuY29kZWQgd2l0aCB0aGUgbG9jYWxpemVkIHdpbmRvd3MgY29kZSBwYWdlLlxuICAgICAgICB2YXIgemlwQ29tbWVudCA9IHRoaXMucmVhZGVyLnJlYWREYXRhKHRoaXMuemlwQ29tbWVudExlbmd0aCk7XG4gICAgICAgIHZhciBkZWNvZGVQYXJhbVR5cGUgPSBzdXBwb3J0LnVpbnQ4YXJyYXkgPyBcInVpbnQ4YXJyYXlcIiA6IFwiYXJyYXlcIjtcbiAgICAgICAgLy8gVG8gZ2V0IGNvbnNpc3RlbnQgYmVoYXZpb3Igd2l0aCB0aGUgZ2VuZXJhdGlvbiBwYXJ0LCB3ZSB3aWxsIGFzc3VtZSB0aGF0XG4gICAgICAgIC8vIHRoaXMgaXMgdXRmOCBlbmNvZGVkIHVubGVzcyBzcGVjaWZpZWQgb3RoZXJ3aXNlLlxuICAgICAgICB2YXIgZGVjb2RlQ29udGVudCA9IHV0aWxzLnRyYW5zZm9ybVRvKGRlY29kZVBhcmFtVHlwZSwgemlwQ29tbWVudCk7XG4gICAgICAgIHRoaXMuemlwQ29tbWVudCA9IHRoaXMubG9hZE9wdGlvbnMuZGVjb2RlRmlsZU5hbWUoZGVjb2RlQ29udGVudCk7XG4gICAgfSxcbiAgICAvKipcbiAgICAgKiBSZWFkIHRoZSBlbmQgb2YgdGhlIFppcCA2NCBjZW50cmFsIGRpcmVjdG9yeS5cbiAgICAgKiBOb3QgbWVyZ2VkIHdpdGggdGhlIG1ldGhvZCByZWFkRW5kT2ZDZW50cmFsIDpcbiAgICAgKiBUaGUgZW5kIG9mIGNlbnRyYWwgY2FuIGNvZXhpc3Qgd2l0aCBpdHMgWmlwNjQgYnJvdGhlcixcbiAgICAgKiBJIGRvbid0IHdhbnQgdG8gcmVhZCB0aGUgd3JvbmcgbnVtYmVyIG9mIGJ5dGVzICFcbiAgICAgKi9cbiAgICByZWFkQmxvY2taaXA2NEVuZE9mQ2VudHJhbDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHRoaXMuemlwNjRFbmRPZkNlbnRyYWxTaXplID0gdGhpcy5yZWFkZXIucmVhZEludCg4KTtcbiAgICAgICAgdGhpcy52ZXJzaW9uTWFkZUJ5ID0gdGhpcy5yZWFkZXIucmVhZFN0cmluZygyKTtcbiAgICAgICAgdGhpcy52ZXJzaW9uTmVlZGVkID0gdGhpcy5yZWFkZXIucmVhZEludCgyKTtcbiAgICAgICAgdGhpcy5kaXNrTnVtYmVyID0gdGhpcy5yZWFkZXIucmVhZEludCg0KTtcbiAgICAgICAgdGhpcy5kaXNrV2l0aENlbnRyYWxEaXJTdGFydCA9IHRoaXMucmVhZGVyLnJlYWRJbnQoNCk7XG4gICAgICAgIHRoaXMuY2VudHJhbERpclJlY29yZHNPblRoaXNEaXNrID0gdGhpcy5yZWFkZXIucmVhZEludCg4KTtcbiAgICAgICAgdGhpcy5jZW50cmFsRGlyUmVjb3JkcyA9IHRoaXMucmVhZGVyLnJlYWRJbnQoOCk7XG4gICAgICAgIHRoaXMuY2VudHJhbERpclNpemUgPSB0aGlzLnJlYWRlci5yZWFkSW50KDgpO1xuICAgICAgICB0aGlzLmNlbnRyYWxEaXJPZmZzZXQgPSB0aGlzLnJlYWRlci5yZWFkSW50KDgpO1xuXG4gICAgICAgIHRoaXMuemlwNjRFeHRlbnNpYmxlRGF0YSA9IHt9O1xuICAgICAgICB2YXIgZXh0cmFEYXRhU2l6ZSA9IHRoaXMuemlwNjRFbmRPZkNlbnRyYWxTaXplIC0gNDQsXG4gICAgICAgICAgICBpbmRleCA9IDAsXG4gICAgICAgICAgICBleHRyYUZpZWxkSWQsXG4gICAgICAgICAgICBleHRyYUZpZWxkTGVuZ3RoLFxuICAgICAgICAgICAgZXh0cmFGaWVsZFZhbHVlO1xuICAgICAgICB3aGlsZSAoaW5kZXggPCBleHRyYURhdGFTaXplKSB7XG4gICAgICAgICAgICBleHRyYUZpZWxkSWQgPSB0aGlzLnJlYWRlci5yZWFkSW50KDIpO1xuICAgICAgICAgICAgZXh0cmFGaWVsZExlbmd0aCA9IHRoaXMucmVhZGVyLnJlYWRJbnQoNCk7XG4gICAgICAgICAgICBleHRyYUZpZWxkVmFsdWUgPSB0aGlzLnJlYWRlci5yZWFkU3RyaW5nKGV4dHJhRmllbGRMZW5ndGgpO1xuICAgICAgICAgICAgdGhpcy56aXA2NEV4dGVuc2libGVEYXRhW2V4dHJhRmllbGRJZF0gPSB7XG4gICAgICAgICAgICAgICAgaWQ6IGV4dHJhRmllbGRJZCxcbiAgICAgICAgICAgICAgICBsZW5ndGg6IGV4dHJhRmllbGRMZW5ndGgsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGV4dHJhRmllbGRWYWx1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVhZCB0aGUgZW5kIG9mIHRoZSBaaXAgNjQgY2VudHJhbCBkaXJlY3RvcnkgbG9jYXRvci5cbiAgICAgKi9cbiAgICByZWFkQmxvY2taaXA2NEVuZE9mQ2VudHJhbExvY2F0b3I6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLmRpc2tXaXRoWmlwNjRDZW50cmFsRGlyU3RhcnQgPSB0aGlzLnJlYWRlci5yZWFkSW50KDQpO1xuICAgICAgICB0aGlzLnJlbGF0aXZlT2Zmc2V0RW5kT2ZaaXA2NENlbnRyYWxEaXIgPSB0aGlzLnJlYWRlci5yZWFkSW50KDgpO1xuICAgICAgICB0aGlzLmRpc2tzQ291bnQgPSB0aGlzLnJlYWRlci5yZWFkSW50KDQpO1xuICAgICAgICBpZiAodGhpcy5kaXNrc0NvdW50ID4gMSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTXVsdGktdm9sdW1lcyB6aXAgYXJlIG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlYWQgdGhlIGxvY2FsIGZpbGVzLCBiYXNlZCBvbiB0aGUgb2Zmc2V0IHJlYWQgaW4gdGhlIGNlbnRyYWwgcGFydC5cbiAgICAgKi9cbiAgICByZWFkTG9jYWxGaWxlczogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBpLCBmaWxlO1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgdGhpcy5maWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgZmlsZSA9IHRoaXMuZmlsZXNbaV07XG4gICAgICAgICAgICB0aGlzLnJlYWRlci5zZXRJbmRleChmaWxlLmxvY2FsSGVhZGVyT2Zmc2V0KTtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tTaWduYXR1cmUoc2lnLkxPQ0FMX0ZJTEVfSEVBREVSKTtcbiAgICAgICAgICAgIGZpbGUucmVhZExvY2FsUGFydCh0aGlzLnJlYWRlcik7XG4gICAgICAgICAgICBmaWxlLmhhbmRsZVVURjgoKTtcbiAgICAgICAgICAgIGZpbGUucHJvY2Vzc0F0dHJpYnV0ZXMoKTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVhZCB0aGUgY2VudHJhbCBkaXJlY3RvcnkuXG4gICAgICovXG4gICAgcmVhZENlbnRyYWxEaXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZmlsZTtcblxuICAgICAgICB0aGlzLnJlYWRlci5zZXRJbmRleCh0aGlzLmNlbnRyYWxEaXJPZmZzZXQpO1xuICAgICAgICB3aGlsZSAodGhpcy5yZWFkZXIucmVhZFN0cmluZyg0KSA9PT0gc2lnLkNFTlRSQUxfRklMRV9IRUFERVIpIHtcbiAgICAgICAgICAgIGZpbGUgPSBuZXcgWmlwRW50cnkoe1xuICAgICAgICAgICAgICAgIHppcDY0OiB0aGlzLnppcDY0XG4gICAgICAgICAgICB9LCB0aGlzLmxvYWRPcHRpb25zKTtcbiAgICAgICAgICAgIGZpbGUucmVhZENlbnRyYWxQYXJ0KHRoaXMucmVhZGVyKTtcbiAgICAgICAgICAgIHRoaXMuZmlsZXMucHVzaChmaWxlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmNlbnRyYWxEaXJSZWNvcmRzICE9PSB0aGlzLmZpbGVzLmxlbmd0aCkge1xuICAgICAgICAgICAgaWYgKHRoaXMuY2VudHJhbERpclJlY29yZHMgIT09IDAgJiYgdGhpcy5maWxlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgICAvLyBXZSBleHBlY3RlZCBzb21lIHJlY29yZHMgYnV0IGNvdWxkbid0IGZpbmQgQU5ZLlxuICAgICAgICAgICAgICAgIC8vIFRoaXMgaXMgcmVhbGx5IHN1c3BpY2lvdXMsIGFzIGlmIHNvbWV0aGluZyB3ZW50IHdyb25nLlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvcnJ1cHRlZCB6aXAgb3IgYnVnOiBleHBlY3RlZCBcIiArIHRoaXMuY2VudHJhbERpclJlY29yZHMgKyBcIiByZWNvcmRzIGluIGNlbnRyYWwgZGlyLCBnb3QgXCIgKyB0aGlzLmZpbGVzLmxlbmd0aCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFdlIGZvdW5kIHNvbWUgcmVjb3JkcyBidXQgbm90IGFsbC5cbiAgICAgICAgICAgICAgICAvLyBTb21ldGhpbmcgaXMgd3JvbmcgYnV0IHdlIGdvdCBzb21ldGhpbmcgZm9yIHRoZSB1c2VyOiBubyBlcnJvciBoZXJlLlxuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUud2FybihcImV4cGVjdGVkXCIsIHRoaXMuY2VudHJhbERpclJlY29yZHMsIFwicmVjb3JkcyBpbiBjZW50cmFsIGRpciwgZ290XCIsIHRoaXMuZmlsZXMubGVuZ3RoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogUmVhZCB0aGUgZW5kIG9mIGNlbnRyYWwgZGlyZWN0b3J5LlxuICAgICAqL1xuICAgIHJlYWRFbmRPZkNlbnRyYWw6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgb2Zmc2V0ID0gdGhpcy5yZWFkZXIubGFzdEluZGV4T2ZTaWduYXR1cmUoc2lnLkNFTlRSQUxfRElSRUNUT1JZX0VORCk7XG4gICAgICAgIGlmIChvZmZzZXQgPCAwKSB7XG4gICAgICAgICAgICAvLyBDaGVjayBpZiB0aGUgY29udGVudCBpcyBhIHRydW5jYXRlZCB6aXAgb3IgY29tcGxldGUgZ2FyYmFnZS5cbiAgICAgICAgICAgIC8vIEEgXCJMT0NBTF9GSUxFX0hFQURFUlwiIGlzIG5vdCByZXF1aXJlZCBhdCB0aGUgYmVnaW5uaW5nIChhdXRvXG4gICAgICAgICAgICAvLyBleHRyYWN0aWJsZSB6aXAgZm9yIGV4YW1wbGUpIGJ1dCBpdCBjYW4gZ2l2ZSBhIGdvb2QgaGludC5cbiAgICAgICAgICAgIC8vIElmIGFuIGFqYXggcmVxdWVzdCB3YXMgdXNlZCB3aXRob3V0IHJlc3BvbnNlVHlwZSwgd2Ugd2lsbCBhbHNvXG4gICAgICAgICAgICAvLyBnZXQgdW5yZWFkYWJsZSBkYXRhLlxuICAgICAgICAgICAgdmFyIGlzR2FyYmFnZSA9ICF0aGlzLmlzU2lnbmF0dXJlKDAsIHNpZy5MT0NBTF9GSUxFX0hFQURFUik7XG5cbiAgICAgICAgICAgIGlmIChpc0dhcmJhZ2UpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW4ndCBmaW5kIGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeSA6IGlzIHRoaXMgYSB6aXAgZmlsZSA/IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJJZiBpdCBpcywgc2VlIGh0dHA6Ly9zdHVrLmdpdGh1Yi5pby9qc3ppcC9kb2N1bWVudGF0aW9uL2hvd3RvL3JlYWRfemlwLmh0bWxcIik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvcnJ1cHRlZCB6aXAgOiBjYW4ndCBmaW5kIGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlYWRlci5zZXRJbmRleChvZmZzZXQpO1xuICAgICAgICB2YXIgZW5kT2ZDZW50cmFsRGlyT2Zmc2V0ID0gb2Zmc2V0O1xuICAgICAgICB0aGlzLmNoZWNrU2lnbmF0dXJlKHNpZy5DRU5UUkFMX0RJUkVDVE9SWV9FTkQpO1xuICAgICAgICB0aGlzLnJlYWRCbG9ja0VuZE9mQ2VudHJhbCgpO1xuXG5cbiAgICAgICAgLyogZXh0cmFjdCBmcm9tIHRoZSB6aXAgc3BlYyA6XG4gICAgICAgICAgICA0KSAgSWYgb25lIG9mIHRoZSBmaWVsZHMgaW4gdGhlIGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeVxuICAgICAgICAgICAgICAgIHJlY29yZCBpcyB0b28gc21hbGwgdG8gaG9sZCByZXF1aXJlZCBkYXRhLCB0aGUgZmllbGRcbiAgICAgICAgICAgICAgICBzaG91bGQgYmUgc2V0IHRvIC0xICgweEZGRkYgb3IgMHhGRkZGRkZGRikgYW5kIHRoZVxuICAgICAgICAgICAgICAgIFpJUDY0IGZvcm1hdCByZWNvcmQgc2hvdWxkIGJlIGNyZWF0ZWQuXG4gICAgICAgICAgICA1KSAgVGhlIGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeSByZWNvcmQgYW5kIHRoZVxuICAgICAgICAgICAgICAgIFppcDY0IGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeSBsb2NhdG9yIHJlY29yZCBtdXN0XG4gICAgICAgICAgICAgICAgcmVzaWRlIG9uIHRoZSBzYW1lIGRpc2sgd2hlbiBzcGxpdHRpbmcgb3Igc3Bhbm5pbmdcbiAgICAgICAgICAgICAgICBhbiBhcmNoaXZlLlxuICAgICAgICAgKi9cbiAgICAgICAgaWYgKHRoaXMuZGlza051bWJlciA9PT0gdXRpbHMuTUFYX1ZBTFVFXzE2QklUUyB8fCB0aGlzLmRpc2tXaXRoQ2VudHJhbERpclN0YXJ0ID09PSB1dGlscy5NQVhfVkFMVUVfMTZCSVRTIHx8IHRoaXMuY2VudHJhbERpclJlY29yZHNPblRoaXNEaXNrID09PSB1dGlscy5NQVhfVkFMVUVfMTZCSVRTIHx8IHRoaXMuY2VudHJhbERpclJlY29yZHMgPT09IHV0aWxzLk1BWF9WQUxVRV8xNkJJVFMgfHwgdGhpcy5jZW50cmFsRGlyU2l6ZSA9PT0gdXRpbHMuTUFYX1ZBTFVFXzMyQklUUyB8fCB0aGlzLmNlbnRyYWxEaXJPZmZzZXQgPT09IHV0aWxzLk1BWF9WQUxVRV8zMkJJVFMpIHtcbiAgICAgICAgICAgIHRoaXMuemlwNjQgPSB0cnVlO1xuXG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgV2FybmluZyA6IHRoZSB6aXA2NCBleHRlbnNpb24gaXMgc3VwcG9ydGVkLCBidXQgT05MWSBpZiB0aGUgNjRiaXRzIGludGVnZXIgcmVhZCBmcm9tXG4gICAgICAgICAgICB0aGUgemlwIGZpbGUgY2FuIGZpdCBpbnRvIGEgMzJiaXRzIGludGVnZXIuIFRoaXMgY2Fubm90IGJlIHNvbHZlZCA6IEphdmFzY3JpcHQgcmVwcmVzZW50c1xuICAgICAgICAgICAgYWxsIG51bWJlcnMgYXMgNjQtYml0IGRvdWJsZSBwcmVjaXNpb24gSUVFRSA3NTQgZmxvYXRpbmcgcG9pbnQgbnVtYmVycy5cbiAgICAgICAgICAgIFNvLCB3ZSBoYXZlIDUzYml0cyBmb3IgaW50ZWdlcnMgYW5kIGJpdHdpc2Ugb3BlcmF0aW9ucyB0cmVhdCBldmVyeXRoaW5nIGFzIDMyYml0cy5cbiAgICAgICAgICAgIHNlZSBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL0phdmFTY3JpcHQvUmVmZXJlbmNlL09wZXJhdG9ycy9CaXR3aXNlX09wZXJhdG9yc1xuICAgICAgICAgICAgYW5kIGh0dHA6Ly93d3cuZWNtYS1pbnRlcm5hdGlvbmFsLm9yZy9wdWJsaWNhdGlvbnMvZmlsZXMvRUNNQS1TVC9FQ01BLTI2Mi5wZGYgc2VjdGlvbiA4LjVcbiAgICAgICAgICAgICovXG5cbiAgICAgICAgICAgIC8vIHNob3VsZCBsb29rIGZvciBhIHppcDY0IEVPQ0QgbG9jYXRvclxuICAgICAgICAgICAgb2Zmc2V0ID0gdGhpcy5yZWFkZXIubGFzdEluZGV4T2ZTaWduYXR1cmUoc2lnLlpJUDY0X0NFTlRSQUxfRElSRUNUT1JZX0xPQ0FUT1IpO1xuICAgICAgICAgICAgaWYgKG9mZnNldCA8IDApIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb3JydXB0ZWQgemlwIDogY2FuJ3QgZmluZCB0aGUgWklQNjQgZW5kIG9mIGNlbnRyYWwgZGlyZWN0b3J5IGxvY2F0b3JcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlYWRlci5zZXRJbmRleChvZmZzZXQpO1xuICAgICAgICAgICAgdGhpcy5jaGVja1NpZ25hdHVyZShzaWcuWklQNjRfQ0VOVFJBTF9ESVJFQ1RPUllfTE9DQVRPUik7XG4gICAgICAgICAgICB0aGlzLnJlYWRCbG9ja1ppcDY0RW5kT2ZDZW50cmFsTG9jYXRvcigpO1xuXG4gICAgICAgICAgICAvLyBub3cgdGhlIHppcDY0IEVPQ0QgcmVjb3JkXG4gICAgICAgICAgICBpZiAoIXRoaXMuaXNTaWduYXR1cmUodGhpcy5yZWxhdGl2ZU9mZnNldEVuZE9mWmlwNjRDZW50cmFsRGlyLCBzaWcuWklQNjRfQ0VOVFJBTF9ESVJFQ1RPUllfRU5EKSkge1xuICAgICAgICAgICAgICAgIC8vIGNvbnNvbGUud2FybihcIlpJUDY0IGVuZCBvZiBjZW50cmFsIGRpcmVjdG9yeSBub3Qgd2hlcmUgZXhwZWN0ZWQuXCIpO1xuICAgICAgICAgICAgICAgIHRoaXMucmVsYXRpdmVPZmZzZXRFbmRPZlppcDY0Q2VudHJhbERpciA9IHRoaXMucmVhZGVyLmxhc3RJbmRleE9mU2lnbmF0dXJlKHNpZy5aSVA2NF9DRU5UUkFMX0RJUkVDVE9SWV9FTkQpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLnJlbGF0aXZlT2Zmc2V0RW5kT2ZaaXA2NENlbnRyYWxEaXIgPCAwKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvcnJ1cHRlZCB6aXAgOiBjYW4ndCBmaW5kIHRoZSBaSVA2NCBlbmQgb2YgY2VudHJhbCBkaXJlY3RvcnlcIik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5yZWFkZXIuc2V0SW5kZXgodGhpcy5yZWxhdGl2ZU9mZnNldEVuZE9mWmlwNjRDZW50cmFsRGlyKTtcbiAgICAgICAgICAgIHRoaXMuY2hlY2tTaWduYXR1cmUoc2lnLlpJUDY0X0NFTlRSQUxfRElSRUNUT1JZX0VORCk7XG4gICAgICAgICAgICB0aGlzLnJlYWRCbG9ja1ppcDY0RW5kT2ZDZW50cmFsKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgZXhwZWN0ZWRFbmRPZkNlbnRyYWxEaXJPZmZzZXQgPSB0aGlzLmNlbnRyYWxEaXJPZmZzZXQgKyB0aGlzLmNlbnRyYWxEaXJTaXplO1xuICAgICAgICBpZiAodGhpcy56aXA2NCkge1xuICAgICAgICAgICAgZXhwZWN0ZWRFbmRPZkNlbnRyYWxEaXJPZmZzZXQgKz0gMjA7IC8vIGVuZCBvZiBjZW50cmFsIGRpciA2NCBsb2NhdG9yXG4gICAgICAgICAgICBleHBlY3RlZEVuZE9mQ2VudHJhbERpck9mZnNldCArPSAxMiAvKiBzaG91bGQgbm90IGluY2x1ZGUgdGhlIGxlYWRpbmcgMTIgYnl0ZXMgKi8gKyB0aGlzLnppcDY0RW5kT2ZDZW50cmFsU2l6ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBleHRyYUJ5dGVzID0gZW5kT2ZDZW50cmFsRGlyT2Zmc2V0IC0gZXhwZWN0ZWRFbmRPZkNlbnRyYWxEaXJPZmZzZXQ7XG5cbiAgICAgICAgaWYgKGV4dHJhQnl0ZXMgPiAwKSB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLndhcm4oZXh0cmFCeXRlcywgXCJleHRyYSBieXRlcyBhdCBiZWdpbm5pbmcgb3Igd2l0aGluIHppcGZpbGVcIik7XG4gICAgICAgICAgICBpZiAodGhpcy5pc1NpZ25hdHVyZShlbmRPZkNlbnRyYWxEaXJPZmZzZXQsIHNpZy5DRU5UUkFMX0ZJTEVfSEVBREVSKSkge1xuICAgICAgICAgICAgICAgIC8vIFRoZSBvZmZzZXRzIHNlZW0gd3JvbmcsIGJ1dCB3ZSBoYXZlIHNvbWV0aGluZyBhdCB0aGUgc3BlY2lmaWVkIG9mZnNldC5cbiAgICAgICAgICAgICAgICAvLyBTb+KApiB3ZSBrZWVwIGl0LlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyB0aGUgb2Zmc2V0IGlzIHdyb25nLCB1cGRhdGUgdGhlIFwiemVyb1wiIG9mIHRoZSByZWFkZXJcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGhhcHBlbnMgaWYgZGF0YSBoYXMgYmVlbiBwcmVwZW5kZWQgKGNyeCBmaWxlcyBmb3IgZXhhbXBsZSlcbiAgICAgICAgICAgICAgICB0aGlzLnJlYWRlci56ZXJvID0gZXh0cmFCeXRlcztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChleHRyYUJ5dGVzIDwgMCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ29ycnVwdGVkIHppcDogbWlzc2luZyBcIiArIE1hdGguYWJzKGV4dHJhQnl0ZXMpICsgXCIgYnl0ZXMuXCIpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBwcmVwYXJlUmVhZGVyOiBmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgIHZhciB0eXBlID0gdXRpbHMuZ2V0VHlwZU9mKGRhdGEpO1xuICAgICAgICB1dGlscy5jaGVja1N1cHBvcnQodHlwZSk7XG4gICAgICAgIGlmICh0eXBlID09PSBcInN0cmluZ1wiICYmICFzdXBwb3J0LnVpbnQ4YXJyYXkpIHtcbiAgICAgICAgICAgIHRoaXMucmVhZGVyID0gbmV3IFN0cmluZ1JlYWRlcihkYXRhLCB0aGlzLmxvYWRPcHRpb25zLm9wdGltaXplZEJpbmFyeVN0cmluZyk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZSA9PT0gXCJub2RlYnVmZmVyXCIpIHtcbiAgICAgICAgICAgIHRoaXMucmVhZGVyID0gbmV3IE5vZGVCdWZmZXJSZWFkZXIoZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3VwcG9ydC51aW50OGFycmF5KSB7XG4gICAgICAgICAgICB0aGlzLnJlYWRlciA9IG5ldyBVaW50OEFycmF5UmVhZGVyKHV0aWxzLnRyYW5zZm9ybVRvKFwidWludDhhcnJheVwiLCBkYXRhKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoc3VwcG9ydC5hcnJheSkge1xuICAgICAgICAgICAgdGhpcy5yZWFkZXIgPSBuZXcgQXJyYXlSZWFkZXIodXRpbHMudHJhbnNmb3JtVG8oXCJhcnJheVwiLCBkYXRhKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGVycm9yOiB1bnN1cHBvcnRlZCB0eXBlICdcIiArIHR5cGUgKyBcIidcIik7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlYWQgYSB6aXAgZmlsZSBhbmQgY3JlYXRlIFppcEVudHJpZXMuXG4gICAgICogQHBhcmFtIHtTdHJpbmd8QXJyYXlCdWZmZXJ8VWludDhBcnJheXxCdWZmZXJ9IGRhdGEgdGhlIGJpbmFyeSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgemlwIGZpbGUuXG4gICAgICovXG4gICAgbG9hZDogZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICB0aGlzLnByZXBhcmVSZWFkZXIoZGF0YSk7XG4gICAgICAgIHRoaXMucmVhZEVuZE9mQ2VudHJhbCgpO1xuICAgICAgICB0aGlzLnJlYWRDZW50cmFsRGlyKCk7XG4gICAgICAgIHRoaXMucmVhZExvY2FsRmlsZXMoKTtcbiAgICB9XG59O1xuLy8gfX19IGVuZCBvZiBaaXBFbnRyaWVzXG5tb2R1bGUuZXhwb3J0cyA9IFppcEVudHJpZXM7XG4iLCIndXNlIHN0cmljdCc7XG52YXIgU3RyaW5nUmVhZGVyID0gcmVxdWlyZSgnLi9zdHJpbmdSZWFkZXInKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBDb21wcmVzc2VkT2JqZWN0ID0gcmVxdWlyZSgnLi9jb21wcmVzc2VkT2JqZWN0Jyk7XG52YXIganN6aXBQcm90byA9IHJlcXVpcmUoJy4vb2JqZWN0Jyk7XG52YXIgc3VwcG9ydCA9IHJlcXVpcmUoJy4vc3VwcG9ydCcpO1xuXG52YXIgTUFERV9CWV9ET1MgPSAweDAwO1xudmFyIE1BREVfQllfVU5JWCA9IDB4MDM7XG5cbi8vIGNsYXNzIFppcEVudHJ5IHt7e1xuLyoqXG4gKiBBbiBlbnRyeSBpbiB0aGUgemlwIGZpbGUuXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIE9wdGlvbnMgb2YgdGhlIGN1cnJlbnQgZmlsZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBsb2FkT3B0aW9ucyBPcHRpb25zIGZvciBsb2FkaW5nIHRoZSBzdHJlYW0uXG4gKi9cbmZ1bmN0aW9uIFppcEVudHJ5KG9wdGlvbnMsIGxvYWRPcHRpb25zKSB7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmxvYWRPcHRpb25zID0gbG9hZE9wdGlvbnM7XG59XG5aaXBFbnRyeS5wcm90b3R5cGUgPSB7XG4gICAgLyoqXG4gICAgICogc2F5IGlmIHRoZSBmaWxlIGlzIGVuY3J5cHRlZC5cbiAgICAgKiBAcmV0dXJuIHtib29sZWFufSB0cnVlIGlmIHRoZSBmaWxlIGlzIGVuY3J5cHRlZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGlzRW5jcnlwdGVkOiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gYml0IDEgaXMgc2V0XG4gICAgICAgIHJldHVybiAodGhpcy5iaXRGbGFnICYgMHgwMDAxKSA9PT0gMHgwMDAxO1xuICAgIH0sXG4gICAgLyoqXG4gICAgICogc2F5IGlmIHRoZSBmaWxlIGhhcyB1dGYtOCBmaWxlbmFtZS9jb21tZW50LlxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59IHRydWUgaWYgdGhlIGZpbGVuYW1lL2NvbW1lbnQgaXMgaW4gdXRmLTgsIGZhbHNlIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICB1c2VVVEY4OiBmdW5jdGlvbigpIHtcbiAgICAgICAgLy8gYml0IDExIGlzIHNldFxuICAgICAgICByZXR1cm4gKHRoaXMuYml0RmxhZyAmIDB4MDgwMCkgPT09IDB4MDgwMDtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFByZXBhcmUgdGhlIGZ1bmN0aW9uIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIGNvbXByZXNzZWQgY29udGVudCBmcm9tIHRoaXMgWmlwRmlsZS5cbiAgICAgKiBAcGFyYW0ge0RhdGFSZWFkZXJ9IHJlYWRlciB0aGUgcmVhZGVyIHRvIHVzZS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gZnJvbSB0aGUgb2Zmc2V0IGZyb20gd2hlcmUgd2Ugc2hvdWxkIHJlYWQgdGhlIGRhdGEuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IGxlbmd0aCB0aGUgbGVuZ3RoIG9mIHRoZSBkYXRhIHRvIHJlYWQuXG4gICAgICogQHJldHVybiB7RnVuY3Rpb259IHRoZSBjYWxsYmFjayB0byBnZXQgdGhlIGNvbXByZXNzZWQgY29udGVudCAodGhlIHR5cGUgZGVwZW5kcyBvZiB0aGUgRGF0YVJlYWRlciBjbGFzcykuXG4gICAgICovXG4gICAgcHJlcGFyZUNvbXByZXNzZWRDb250ZW50OiBmdW5jdGlvbihyZWFkZXIsIGZyb20sIGxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB2YXIgcHJldmlvdXNJbmRleCA9IHJlYWRlci5pbmRleDtcbiAgICAgICAgICAgIHJlYWRlci5zZXRJbmRleChmcm9tKTtcbiAgICAgICAgICAgIHZhciBjb21wcmVzc2VkRmlsZURhdGEgPSByZWFkZXIucmVhZERhdGEobGVuZ3RoKTtcbiAgICAgICAgICAgIHJlYWRlci5zZXRJbmRleChwcmV2aW91c0luZGV4KTtcblxuICAgICAgICAgICAgcmV0dXJuIGNvbXByZXNzZWRGaWxlRGF0YTtcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFByZXBhcmUgdGhlIGZ1bmN0aW9uIHVzZWQgdG8gZ2VuZXJhdGUgdGhlIHVuY29tcHJlc3NlZCBjb250ZW50IGZyb20gdGhpcyBaaXBGaWxlLlxuICAgICAqIEBwYXJhbSB7RGF0YVJlYWRlcn0gcmVhZGVyIHRoZSByZWFkZXIgdG8gdXNlLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyfSBmcm9tIHRoZSBvZmZzZXQgZnJvbSB3aGVyZSB3ZSBzaG91bGQgcmVhZCB0aGUgZGF0YS5cbiAgICAgKiBAcGFyYW0ge251bWJlcn0gbGVuZ3RoIHRoZSBsZW5ndGggb2YgdGhlIGRhdGEgdG8gcmVhZC5cbiAgICAgKiBAcGFyYW0ge0pTWmlwLmNvbXByZXNzaW9ufSBjb21wcmVzc2lvbiB0aGUgY29tcHJlc3Npb24gdXNlZCBvbiB0aGlzIGZpbGUuXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IHVuY29tcHJlc3NlZFNpemUgdGhlIHVuY29tcHJlc3NlZCBzaXplIHRvIGV4cGVjdC5cbiAgICAgKiBAcmV0dXJuIHtGdW5jdGlvbn0gdGhlIGNhbGxiYWNrIHRvIGdldCB0aGUgdW5jb21wcmVzc2VkIGNvbnRlbnQgKHRoZSB0eXBlIGRlcGVuZHMgb2YgdGhlIERhdGFSZWFkZXIgY2xhc3MpLlxuICAgICAqL1xuICAgIHByZXBhcmVDb250ZW50OiBmdW5jdGlvbihyZWFkZXIsIGZyb20sIGxlbmd0aCwgY29tcHJlc3Npb24sIHVuY29tcHJlc3NlZFNpemUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuXG4gICAgICAgICAgICB2YXIgY29tcHJlc3NlZEZpbGVEYXRhID0gdXRpbHMudHJhbnNmb3JtVG8oY29tcHJlc3Npb24udW5jb21wcmVzc0lucHV0VHlwZSwgdGhpcy5nZXRDb21wcmVzc2VkQ29udGVudCgpKTtcbiAgICAgICAgICAgIHZhciB1bmNvbXByZXNzZWRGaWxlRGF0YSA9IGNvbXByZXNzaW9uLnVuY29tcHJlc3MoY29tcHJlc3NlZEZpbGVEYXRhKTtcblxuICAgICAgICAgICAgaWYgKHVuY29tcHJlc3NlZEZpbGVEYXRhLmxlbmd0aCAhPT0gdW5jb21wcmVzc2VkU2l6ZSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkJ1ZyA6IHVuY29tcHJlc3NlZCBkYXRhIHNpemUgbWlzbWF0Y2hcIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiB1bmNvbXByZXNzZWRGaWxlRGF0YTtcbiAgICAgICAgfTtcbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlYWQgdGhlIGxvY2FsIHBhcnQgb2YgYSB6aXAgZmlsZSBhbmQgYWRkIHRoZSBpbmZvIGluIHRoaXMgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7RGF0YVJlYWRlcn0gcmVhZGVyIHRoZSByZWFkZXIgdG8gdXNlLlxuICAgICAqL1xuICAgIHJlYWRMb2NhbFBhcnQ6IGZ1bmN0aW9uKHJlYWRlcikge1xuICAgICAgICB2YXIgY29tcHJlc3Npb24sIGxvY2FsRXh0cmFGaWVsZHNMZW5ndGg7XG5cbiAgICAgICAgLy8gd2UgYWxyZWFkeSBrbm93IGV2ZXJ5dGhpbmcgZnJvbSB0aGUgY2VudHJhbCBkaXIgIVxuICAgICAgICAvLyBJZiB0aGUgY2VudHJhbCBkaXIgZGF0YSBhcmUgZmFsc2UsIHdlIGFyZSBkb29tZWQuXG4gICAgICAgIC8vIE9uIHRoZSBicmlnaHQgc2lkZSwgdGhlIGxvY2FsIHBhcnQgaXMgc2NhcnkgIDogemlwNjQsIGRhdGEgZGVzY3JpcHRvcnMsIGJvdGgsIGV0Yy5cbiAgICAgICAgLy8gVGhlIGxlc3MgZGF0YSB3ZSBnZXQgaGVyZSwgdGhlIG1vcmUgcmVsaWFibGUgdGhpcyBzaG91bGQgYmUuXG4gICAgICAgIC8vIExldCdzIHNraXAgdGhlIHdob2xlIGhlYWRlciBhbmQgZGFzaCB0byB0aGUgZGF0YSAhXG4gICAgICAgIHJlYWRlci5za2lwKDIyKTtcbiAgICAgICAgLy8gaW4gc29tZSB6aXAgY3JlYXRlZCBvbiB3aW5kb3dzLCB0aGUgZmlsZW5hbWUgc3RvcmVkIGluIHRoZSBjZW50cmFsIGRpciBjb250YWlucyBcXCBpbnN0ZWFkIG9mIC8uXG4gICAgICAgIC8vIFN0cmFuZ2VseSwgdGhlIGZpbGVuYW1lIGhlcmUgaXMgT0suXG4gICAgICAgIC8vIEkgd291bGQgbG92ZSB0byB0cmVhdCB0aGVzZSB6aXAgZmlsZXMgYXMgY29ycnVwdGVkIChzZWUgaHR0cDovL3d3dy5pbmZvLXppcC5vcmcvRkFRLmh0bWwjYmFja3NsYXNoZXNcbiAgICAgICAgLy8gb3IgQVBQTk9URSM0LjQuMTcuMSwgXCJBbGwgc2xhc2hlcyBNVVNUIGJlIGZvcndhcmQgc2xhc2hlcyAnLydcIikgYnV0IHRoZXJlIGFyZSBhIGxvdCBvZiBiYWQgemlwIGdlbmVyYXRvcnMuLi5cbiAgICAgICAgLy8gU2VhcmNoIFwidW56aXAgbWlzbWF0Y2hpbmcgXCJsb2NhbFwiIGZpbGVuYW1lIGNvbnRpbnVpbmcgd2l0aCBcImNlbnRyYWxcIiBmaWxlbmFtZSB2ZXJzaW9uXCIgb25cbiAgICAgICAgLy8gdGhlIGludGVybmV0LlxuICAgICAgICAvL1xuICAgICAgICAvLyBJIHRoaW5rIEkgc2VlIHRoZSBsb2dpYyBoZXJlIDogdGhlIGNlbnRyYWwgZGlyZWN0b3J5IGlzIHVzZWQgdG8gZGlzcGxheVxuICAgICAgICAvLyBjb250ZW50IGFuZCB0aGUgbG9jYWwgZGlyZWN0b3J5IGlzIHVzZWQgdG8gZXh0cmFjdCB0aGUgZmlsZXMuIE1peGluZyAvIGFuZCBcXFxuICAgICAgICAvLyBtYXkgYmUgdXNlZCB0byBkaXNwbGF5IFxcIHRvIHdpbmRvd3MgdXNlcnMgYW5kIHVzZSAvIHdoZW4gZXh0cmFjdGluZyB0aGUgZmlsZXMuXG4gICAgICAgIC8vIFVuZm9ydHVuYXRlbHksIHRoaXMgbGVhZCBhbHNvIHRvIHNvbWUgaXNzdWVzIDogaHR0cDovL3NlY2xpc3RzLm9yZy9mdWxsZGlzY2xvc3VyZS8yMDA5L1NlcC8zOTRcbiAgICAgICAgdGhpcy5maWxlTmFtZUxlbmd0aCA9IHJlYWRlci5yZWFkSW50KDIpO1xuICAgICAgICBsb2NhbEV4dHJhRmllbGRzTGVuZ3RoID0gcmVhZGVyLnJlYWRJbnQoMik7IC8vIGNhbid0IGJlIHN1cmUgdGhpcyB3aWxsIGJlIHRoZSBzYW1lIGFzIHRoZSBjZW50cmFsIGRpclxuICAgICAgICB0aGlzLmZpbGVOYW1lID0gcmVhZGVyLnJlYWREYXRhKHRoaXMuZmlsZU5hbWVMZW5ndGgpO1xuICAgICAgICByZWFkZXIuc2tpcChsb2NhbEV4dHJhRmllbGRzTGVuZ3RoKTtcblxuICAgICAgICBpZiAodGhpcy5jb21wcmVzc2VkU2l6ZSA9PSAtMSB8fCB0aGlzLnVuY29tcHJlc3NlZFNpemUgPT0gLTEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkJ1ZyBvciBjb3JydXB0ZWQgemlwIDogZGlkbid0IGdldCBlbm91Z2ggaW5mb3JtYXRpb25zIGZyb20gdGhlIGNlbnRyYWwgZGlyZWN0b3J5IFwiICsgXCIoY29tcHJlc3NlZFNpemUgPT0gLTEgfHwgdW5jb21wcmVzc2VkU2l6ZSA9PSAtMSlcIik7XG4gICAgICAgIH1cblxuICAgICAgICBjb21wcmVzc2lvbiA9IHV0aWxzLmZpbmRDb21wcmVzc2lvbih0aGlzLmNvbXByZXNzaW9uTWV0aG9kKTtcbiAgICAgICAgaWYgKGNvbXByZXNzaW9uID09PSBudWxsKSB7IC8vIG5vIGNvbXByZXNzaW9uIGZvdW5kXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDb3JydXB0ZWQgemlwIDogY29tcHJlc3Npb24gXCIgKyB1dGlscy5wcmV0dHkodGhpcy5jb21wcmVzc2lvbk1ldGhvZCkgKyBcIiB1bmtub3duIChpbm5lciBmaWxlIDogXCIgKyAgdXRpbHMudHJhbnNmb3JtVG8oXCJzdHJpbmdcIiwgdGhpcy5maWxlTmFtZSkgKyBcIilcIik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5kZWNvbXByZXNzZWQgPSBuZXcgQ29tcHJlc3NlZE9iamVjdCgpO1xuICAgICAgICB0aGlzLmRlY29tcHJlc3NlZC5jb21wcmVzc2VkU2l6ZSA9IHRoaXMuY29tcHJlc3NlZFNpemU7XG4gICAgICAgIHRoaXMuZGVjb21wcmVzc2VkLnVuY29tcHJlc3NlZFNpemUgPSB0aGlzLnVuY29tcHJlc3NlZFNpemU7XG4gICAgICAgIHRoaXMuZGVjb21wcmVzc2VkLmNyYzMyID0gdGhpcy5jcmMzMjtcbiAgICAgICAgdGhpcy5kZWNvbXByZXNzZWQuY29tcHJlc3Npb25NZXRob2QgPSB0aGlzLmNvbXByZXNzaW9uTWV0aG9kO1xuICAgICAgICB0aGlzLmRlY29tcHJlc3NlZC5nZXRDb21wcmVzc2VkQ29udGVudCA9IHRoaXMucHJlcGFyZUNvbXByZXNzZWRDb250ZW50KHJlYWRlciwgcmVhZGVyLmluZGV4LCB0aGlzLmNvbXByZXNzZWRTaXplLCBjb21wcmVzc2lvbik7XG4gICAgICAgIHRoaXMuZGVjb21wcmVzc2VkLmdldENvbnRlbnQgPSB0aGlzLnByZXBhcmVDb250ZW50KHJlYWRlciwgcmVhZGVyLmluZGV4LCB0aGlzLmNvbXByZXNzZWRTaXplLCBjb21wcmVzc2lvbiwgdGhpcy51bmNvbXByZXNzZWRTaXplKTtcblxuICAgICAgICAvLyB3ZSBuZWVkIHRvIGNvbXB1dGUgdGhlIGNyYzMyLi4uXG4gICAgICAgIGlmICh0aGlzLmxvYWRPcHRpb25zLmNoZWNrQ1JDMzIpIHtcbiAgICAgICAgICAgIHRoaXMuZGVjb21wcmVzc2VkID0gdXRpbHMudHJhbnNmb3JtVG8oXCJzdHJpbmdcIiwgdGhpcy5kZWNvbXByZXNzZWQuZ2V0Q29udGVudCgpKTtcbiAgICAgICAgICAgIGlmIChqc3ppcFByb3RvLmNyYzMyKHRoaXMuZGVjb21wcmVzc2VkKSAhPT0gdGhpcy5jcmMzMikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkNvcnJ1cHRlZCB6aXAgOiBDUkMzMiBtaXNtYXRjaFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZWFkIHRoZSBjZW50cmFsIHBhcnQgb2YgYSB6aXAgZmlsZSBhbmQgYWRkIHRoZSBpbmZvIGluIHRoaXMgb2JqZWN0LlxuICAgICAqIEBwYXJhbSB7RGF0YVJlYWRlcn0gcmVhZGVyIHRoZSByZWFkZXIgdG8gdXNlLlxuICAgICAqL1xuICAgIHJlYWRDZW50cmFsUGFydDogZnVuY3Rpb24ocmVhZGVyKSB7XG4gICAgICAgIHRoaXMudmVyc2lvbk1hZGVCeSA9IHJlYWRlci5yZWFkSW50KDIpO1xuICAgICAgICB0aGlzLnZlcnNpb25OZWVkZWQgPSByZWFkZXIucmVhZEludCgyKTtcbiAgICAgICAgdGhpcy5iaXRGbGFnID0gcmVhZGVyLnJlYWRJbnQoMik7XG4gICAgICAgIHRoaXMuY29tcHJlc3Npb25NZXRob2QgPSByZWFkZXIucmVhZFN0cmluZygyKTtcbiAgICAgICAgdGhpcy5kYXRlID0gcmVhZGVyLnJlYWREYXRlKCk7XG4gICAgICAgIHRoaXMuY3JjMzIgPSByZWFkZXIucmVhZEludCg0KTtcbiAgICAgICAgdGhpcy5jb21wcmVzc2VkU2l6ZSA9IHJlYWRlci5yZWFkSW50KDQpO1xuICAgICAgICB0aGlzLnVuY29tcHJlc3NlZFNpemUgPSByZWFkZXIucmVhZEludCg0KTtcbiAgICAgICAgdGhpcy5maWxlTmFtZUxlbmd0aCA9IHJlYWRlci5yZWFkSW50KDIpO1xuICAgICAgICB0aGlzLmV4dHJhRmllbGRzTGVuZ3RoID0gcmVhZGVyLnJlYWRJbnQoMik7XG4gICAgICAgIHRoaXMuZmlsZUNvbW1lbnRMZW5ndGggPSByZWFkZXIucmVhZEludCgyKTtcbiAgICAgICAgdGhpcy5kaXNrTnVtYmVyU3RhcnQgPSByZWFkZXIucmVhZEludCgyKTtcbiAgICAgICAgdGhpcy5pbnRlcm5hbEZpbGVBdHRyaWJ1dGVzID0gcmVhZGVyLnJlYWRJbnQoMik7XG4gICAgICAgIHRoaXMuZXh0ZXJuYWxGaWxlQXR0cmlidXRlcyA9IHJlYWRlci5yZWFkSW50KDQpO1xuICAgICAgICB0aGlzLmxvY2FsSGVhZGVyT2Zmc2V0ID0gcmVhZGVyLnJlYWRJbnQoNCk7XG5cbiAgICAgICAgaWYgKHRoaXMuaXNFbmNyeXB0ZWQoKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW5jcnlwdGVkIHppcCBhcmUgbm90IHN1cHBvcnRlZFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuZmlsZU5hbWUgPSByZWFkZXIucmVhZERhdGEodGhpcy5maWxlTmFtZUxlbmd0aCk7XG4gICAgICAgIHRoaXMucmVhZEV4dHJhRmllbGRzKHJlYWRlcik7XG4gICAgICAgIHRoaXMucGFyc2VaSVA2NEV4dHJhRmllbGQocmVhZGVyKTtcbiAgICAgICAgdGhpcy5maWxlQ29tbWVudCA9IHJlYWRlci5yZWFkRGF0YSh0aGlzLmZpbGVDb21tZW50TGVuZ3RoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUGFyc2UgdGhlIGV4dGVybmFsIGZpbGUgYXR0cmlidXRlcyBhbmQgZ2V0IHRoZSB1bml4L2RvcyBwZXJtaXNzaW9ucy5cbiAgICAgKi9cbiAgICBwcm9jZXNzQXR0cmlidXRlczogZnVuY3Rpb24gKCkge1xuICAgICAgICB0aGlzLnVuaXhQZXJtaXNzaW9ucyA9IG51bGw7XG4gICAgICAgIHRoaXMuZG9zUGVybWlzc2lvbnMgPSBudWxsO1xuICAgICAgICB2YXIgbWFkZUJ5ID0gdGhpcy52ZXJzaW9uTWFkZUJ5ID4+IDg7XG5cbiAgICAgICAgLy8gQ2hlY2sgaWYgd2UgaGF2ZSB0aGUgRE9TIGRpcmVjdG9yeSBmbGFnIHNldC5cbiAgICAgICAgLy8gV2UgbG9vayBmb3IgaXQgaW4gdGhlIERPUyBhbmQgVU5JWCBwZXJtaXNzaW9uc1xuICAgICAgICAvLyBidXQgc29tZSB1bmtub3duIHBsYXRmb3JtIGNvdWxkIHNldCBpdCBhcyBhIGNvbXBhdGliaWxpdHkgZmxhZy5cbiAgICAgICAgdGhpcy5kaXIgPSB0aGlzLmV4dGVybmFsRmlsZUF0dHJpYnV0ZXMgJiAweDAwMTAgPyB0cnVlIDogZmFsc2U7XG5cbiAgICAgICAgaWYobWFkZUJ5ID09PSBNQURFX0JZX0RPUykge1xuICAgICAgICAgICAgLy8gZmlyc3QgNiBiaXRzICgwIHRvIDUpXG4gICAgICAgICAgICB0aGlzLmRvc1Blcm1pc3Npb25zID0gdGhpcy5leHRlcm5hbEZpbGVBdHRyaWJ1dGVzICYgMHgzRjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmKG1hZGVCeSA9PT0gTUFERV9CWV9VTklYKSB7XG4gICAgICAgICAgICB0aGlzLnVuaXhQZXJtaXNzaW9ucyA9ICh0aGlzLmV4dGVybmFsRmlsZUF0dHJpYnV0ZXMgPj4gMTYpICYgMHhGRkZGO1xuICAgICAgICAgICAgLy8gdGhlIG9jdGFsIHBlcm1pc3Npb25zIGFyZSBpbiAodGhpcy51bml4UGVybWlzc2lvbnMgJiAweDAxRkYpLnRvU3RyaW5nKDgpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZmFpbCBzYWZlIDogaWYgdGhlIG5hbWUgZW5kcyB3aXRoIGEgLyBpdCBwcm9iYWJseSBtZWFucyBhIGZvbGRlclxuICAgICAgICBpZiAoIXRoaXMuZGlyICYmIHRoaXMuZmlsZU5hbWVTdHIuc2xpY2UoLTEpID09PSAnLycpIHtcbiAgICAgICAgICAgIHRoaXMuZGlyID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBQYXJzZSB0aGUgWklQNjQgZXh0cmEgZmllbGQgYW5kIG1lcmdlIHRoZSBpbmZvIGluIHRoZSBjdXJyZW50IFppcEVudHJ5LlxuICAgICAqIEBwYXJhbSB7RGF0YVJlYWRlcn0gcmVhZGVyIHRoZSByZWFkZXIgdG8gdXNlLlxuICAgICAqL1xuICAgIHBhcnNlWklQNjRFeHRyYUZpZWxkOiBmdW5jdGlvbihyZWFkZXIpIHtcblxuICAgICAgICBpZiAoIXRoaXMuZXh0cmFGaWVsZHNbMHgwMDAxXSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gc2hvdWxkIGJlIHNvbWV0aGluZywgcHJlcGFyaW5nIHRoZSBleHRyYSByZWFkZXJcbiAgICAgICAgdmFyIGV4dHJhUmVhZGVyID0gbmV3IFN0cmluZ1JlYWRlcih0aGlzLmV4dHJhRmllbGRzWzB4MDAwMV0udmFsdWUpO1xuXG4gICAgICAgIC8vIEkgcmVhbGx5IGhvcGUgdGhhdCB0aGVzZSA2NGJpdHMgaW50ZWdlciBjYW4gZml0IGluIDMyIGJpdHMgaW50ZWdlciwgYmVjYXVzZSBqc1xuICAgICAgICAvLyB3b24ndCBsZXQgdXMgaGF2ZSBtb3JlLlxuICAgICAgICBpZiAodGhpcy51bmNvbXByZXNzZWRTaXplID09PSB1dGlscy5NQVhfVkFMVUVfMzJCSVRTKSB7XG4gICAgICAgICAgICB0aGlzLnVuY29tcHJlc3NlZFNpemUgPSBleHRyYVJlYWRlci5yZWFkSW50KDgpO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLmNvbXByZXNzZWRTaXplID09PSB1dGlscy5NQVhfVkFMVUVfMzJCSVRTKSB7XG4gICAgICAgICAgICB0aGlzLmNvbXByZXNzZWRTaXplID0gZXh0cmFSZWFkZXIucmVhZEludCg4KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5sb2NhbEhlYWRlck9mZnNldCA9PT0gdXRpbHMuTUFYX1ZBTFVFXzMyQklUUykge1xuICAgICAgICAgICAgdGhpcy5sb2NhbEhlYWRlck9mZnNldCA9IGV4dHJhUmVhZGVyLnJlYWRJbnQoOCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuZGlza051bWJlclN0YXJ0ID09PSB1dGlscy5NQVhfVkFMVUVfMzJCSVRTKSB7XG4gICAgICAgICAgICB0aGlzLmRpc2tOdW1iZXJTdGFydCA9IGV4dHJhUmVhZGVyLnJlYWRJbnQoNCk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIC8qKlxuICAgICAqIFJlYWQgdGhlIGNlbnRyYWwgcGFydCBvZiBhIHppcCBmaWxlIGFuZCBhZGQgdGhlIGluZm8gaW4gdGhpcyBvYmplY3QuXG4gICAgICogQHBhcmFtIHtEYXRhUmVhZGVyfSByZWFkZXIgdGhlIHJlYWRlciB0byB1c2UuXG4gICAgICovXG4gICAgcmVhZEV4dHJhRmllbGRzOiBmdW5jdGlvbihyZWFkZXIpIHtcbiAgICAgICAgdmFyIHN0YXJ0ID0gcmVhZGVyLmluZGV4LFxuICAgICAgICAgICAgZXh0cmFGaWVsZElkLFxuICAgICAgICAgICAgZXh0cmFGaWVsZExlbmd0aCxcbiAgICAgICAgICAgIGV4dHJhRmllbGRWYWx1ZTtcblxuICAgICAgICB0aGlzLmV4dHJhRmllbGRzID0gdGhpcy5leHRyYUZpZWxkcyB8fCB7fTtcblxuICAgICAgICB3aGlsZSAocmVhZGVyLmluZGV4IDwgc3RhcnQgKyB0aGlzLmV4dHJhRmllbGRzTGVuZ3RoKSB7XG4gICAgICAgICAgICBleHRyYUZpZWxkSWQgPSByZWFkZXIucmVhZEludCgyKTtcbiAgICAgICAgICAgIGV4dHJhRmllbGRMZW5ndGggPSByZWFkZXIucmVhZEludCgyKTtcbiAgICAgICAgICAgIGV4dHJhRmllbGRWYWx1ZSA9IHJlYWRlci5yZWFkU3RyaW5nKGV4dHJhRmllbGRMZW5ndGgpO1xuXG4gICAgICAgICAgICB0aGlzLmV4dHJhRmllbGRzW2V4dHJhRmllbGRJZF0gPSB7XG4gICAgICAgICAgICAgICAgaWQ6IGV4dHJhRmllbGRJZCxcbiAgICAgICAgICAgICAgICBsZW5ndGg6IGV4dHJhRmllbGRMZW5ndGgsXG4gICAgICAgICAgICAgICAgdmFsdWU6IGV4dHJhRmllbGRWYWx1ZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgLyoqXG4gICAgICogQXBwbHkgYW4gVVRGOCB0cmFuc2Zvcm1hdGlvbiBpZiBuZWVkZWQuXG4gICAgICovXG4gICAgaGFuZGxlVVRGODogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBkZWNvZGVQYXJhbVR5cGUgPSBzdXBwb3J0LnVpbnQ4YXJyYXkgPyBcInVpbnQ4YXJyYXlcIiA6IFwiYXJyYXlcIjtcbiAgICAgICAgaWYgKHRoaXMudXNlVVRGOCgpKSB7XG4gICAgICAgICAgICB0aGlzLmZpbGVOYW1lU3RyID0ganN6aXBQcm90by51dGY4ZGVjb2RlKHRoaXMuZmlsZU5hbWUpO1xuICAgICAgICAgICAgdGhpcy5maWxlQ29tbWVudFN0ciA9IGpzemlwUHJvdG8udXRmOGRlY29kZSh0aGlzLmZpbGVDb21tZW50KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciB1cGF0aCA9IHRoaXMuZmluZEV4dHJhRmllbGRVbmljb2RlUGF0aCgpO1xuICAgICAgICAgICAgaWYgKHVwYXRoICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxlTmFtZVN0ciA9IHVwYXRoO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgZmlsZU5hbWVCeXRlQXJyYXkgPSAgdXRpbHMudHJhbnNmb3JtVG8oZGVjb2RlUGFyYW1UeXBlLCB0aGlzLmZpbGVOYW1lKTtcbiAgICAgICAgICAgICAgICB0aGlzLmZpbGVOYW1lU3RyID0gdGhpcy5sb2FkT3B0aW9ucy5kZWNvZGVGaWxlTmFtZShmaWxlTmFtZUJ5dGVBcnJheSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciB1Y29tbWVudCA9IHRoaXMuZmluZEV4dHJhRmllbGRVbmljb2RlQ29tbWVudCgpO1xuICAgICAgICAgICAgaWYgKHVjb21tZW50ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5maWxlQ29tbWVudFN0ciA9IHVjb21tZW50O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgY29tbWVudEJ5dGVBcnJheSA9ICB1dGlscy50cmFuc2Zvcm1UbyhkZWNvZGVQYXJhbVR5cGUsIHRoaXMuZmlsZUNvbW1lbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuZmlsZUNvbW1lbnRTdHIgPSB0aGlzLmxvYWRPcHRpb25zLmRlY29kZUZpbGVOYW1lKGNvbW1lbnRCeXRlQXJyYXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZpbmQgdGhlIHVuaWNvZGUgcGF0aCBkZWNsYXJlZCBpbiB0aGUgZXh0cmEgZmllbGQsIGlmIGFueS5cbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IHRoZSB1bmljb2RlIHBhdGgsIG51bGwgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGZpbmRFeHRyYUZpZWxkVW5pY29kZVBhdGg6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdXBhdGhGaWVsZCA9IHRoaXMuZXh0cmFGaWVsZHNbMHg3MDc1XTtcbiAgICAgICAgaWYgKHVwYXRoRmllbGQpIHtcbiAgICAgICAgICAgIHZhciBleHRyYVJlYWRlciA9IG5ldyBTdHJpbmdSZWFkZXIodXBhdGhGaWVsZC52YWx1ZSk7XG5cbiAgICAgICAgICAgIC8vIHdyb25nIHZlcnNpb25cbiAgICAgICAgICAgIGlmIChleHRyYVJlYWRlci5yZWFkSW50KDEpICE9PSAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRoZSBjcmMgb2YgdGhlIGZpbGVuYW1lIGNoYW5nZWQsIHRoaXMgZmllbGQgaXMgb3V0IG9mIGRhdGUuXG4gICAgICAgICAgICBpZiAoanN6aXBQcm90by5jcmMzMih0aGlzLmZpbGVOYW1lKSAhPT0gZXh0cmFSZWFkZXIucmVhZEludCg0KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4ganN6aXBQcm90by51dGY4ZGVjb2RlKGV4dHJhUmVhZGVyLnJlYWRTdHJpbmcodXBhdGhGaWVsZC5sZW5ndGggLSA1KSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEZpbmQgdGhlIHVuaWNvZGUgY29tbWVudCBkZWNsYXJlZCBpbiB0aGUgZXh0cmEgZmllbGQsIGlmIGFueS5cbiAgICAgKiBAcmV0dXJuIHtTdHJpbmd9IHRoZSB1bmljb2RlIGNvbW1lbnQsIG51bGwgb3RoZXJ3aXNlLlxuICAgICAqL1xuICAgIGZpbmRFeHRyYUZpZWxkVW5pY29kZUNvbW1lbnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgdWNvbW1lbnRGaWVsZCA9IHRoaXMuZXh0cmFGaWVsZHNbMHg2Mzc1XTtcbiAgICAgICAgaWYgKHVjb21tZW50RmllbGQpIHtcbiAgICAgICAgICAgIHZhciBleHRyYVJlYWRlciA9IG5ldyBTdHJpbmdSZWFkZXIodWNvbW1lbnRGaWVsZC52YWx1ZSk7XG5cbiAgICAgICAgICAgIC8vIHdyb25nIHZlcnNpb25cbiAgICAgICAgICAgIGlmIChleHRyYVJlYWRlci5yZWFkSW50KDEpICE9PSAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIHRoZSBjcmMgb2YgdGhlIGNvbW1lbnQgY2hhbmdlZCwgdGhpcyBmaWVsZCBpcyBvdXQgb2YgZGF0ZS5cbiAgICAgICAgICAgIGlmIChqc3ppcFByb3RvLmNyYzMyKHRoaXMuZmlsZUNvbW1lbnQpICE9PSBleHRyYVJlYWRlci5yZWFkSW50KDQpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBqc3ppcFByb3RvLnV0ZjhkZWNvZGUoZXh0cmFSZWFkZXIucmVhZFN0cmluZyh1Y29tbWVudEZpZWxkLmxlbmd0aCAtIDUpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG59O1xubW9kdWxlLmV4cG9ydHMgPSBaaXBFbnRyeTtcbiIsIi8vIFRvcCBsZXZlbCBmaWxlIGlzIGp1c3QgYSBtaXhpbiBvZiBzdWJtb2R1bGVzICYgY29uc3RhbnRzXG4ndXNlIHN0cmljdCc7XG5cbnZhciBhc3NpZ24gICAgPSByZXF1aXJlKCcuL2xpYi91dGlscy9jb21tb24nKS5hc3NpZ247XG5cbnZhciBkZWZsYXRlICAgPSByZXF1aXJlKCcuL2xpYi9kZWZsYXRlJyk7XG52YXIgaW5mbGF0ZSAgID0gcmVxdWlyZSgnLi9saWIvaW5mbGF0ZScpO1xudmFyIGNvbnN0YW50cyA9IHJlcXVpcmUoJy4vbGliL3psaWIvY29uc3RhbnRzJyk7XG5cbnZhciBwYWtvID0ge307XG5cbmFzc2lnbihwYWtvLCBkZWZsYXRlLCBpbmZsYXRlLCBjb25zdGFudHMpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBha287XG4iLCIndXNlIHN0cmljdCc7XG5cblxudmFyIHpsaWJfZGVmbGF0ZSA9IHJlcXVpcmUoJy4vemxpYi9kZWZsYXRlJyk7XG52YXIgdXRpbHMgICAgICAgID0gcmVxdWlyZSgnLi91dGlscy9jb21tb24nKTtcbnZhciBzdHJpbmdzICAgICAgPSByZXF1aXJlKCcuL3V0aWxzL3N0cmluZ3MnKTtcbnZhciBtc2cgICAgICAgICAgPSByZXF1aXJlKCcuL3psaWIvbWVzc2FnZXMnKTtcbnZhciBaU3RyZWFtICAgICAgPSByZXF1aXJlKCcuL3psaWIvenN0cmVhbScpO1xuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuXG4vKiBQdWJsaWMgY29uc3RhbnRzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxudmFyIFpfTk9fRkxVU0ggICAgICA9IDA7XG52YXIgWl9GSU5JU0ggICAgICAgID0gNDtcblxudmFyIFpfT0sgICAgICAgICAgICA9IDA7XG52YXIgWl9TVFJFQU1fRU5EICAgID0gMTtcbnZhciBaX1NZTkNfRkxVU0ggICAgPSAyO1xuXG52YXIgWl9ERUZBVUxUX0NPTVBSRVNTSU9OID0gLTE7XG5cbnZhciBaX0RFRkFVTFRfU1RSQVRFR1kgICAgPSAwO1xuXG52YXIgWl9ERUZMQVRFRCAgPSA4O1xuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5cbi8qKlxuICogY2xhc3MgRGVmbGF0ZVxuICpcbiAqIEdlbmVyaWMgSlMtc3R5bGUgd3JhcHBlciBmb3IgemxpYiBjYWxscy4gSWYgeW91IGRvbid0IG5lZWRcbiAqIHN0cmVhbWluZyBiZWhhdmlvdXIgLSB1c2UgbW9yZSBzaW1wbGUgZnVuY3Rpb25zOiBbW2RlZmxhdGVdXSxcbiAqIFtbZGVmbGF0ZVJhd11dIGFuZCBbW2d6aXBdXS5cbiAqKi9cblxuLyogaW50ZXJuYWxcbiAqIERlZmxhdGUuY2h1bmtzIC0+IEFycmF5XG4gKlxuICogQ2h1bmtzIG9mIG91dHB1dCBkYXRhLCBpZiBbW0RlZmxhdGUjb25EYXRhXV0gbm90IG92ZXJyaWRkZW4uXG4gKiovXG5cbi8qKlxuICogRGVmbGF0ZS5yZXN1bHQgLT4gVWludDhBcnJheXxBcnJheVxuICpcbiAqIENvbXByZXNzZWQgcmVzdWx0LCBnZW5lcmF0ZWQgYnkgZGVmYXVsdCBbW0RlZmxhdGUjb25EYXRhXV1cbiAqIGFuZCBbW0RlZmxhdGUjb25FbmRdXSBoYW5kbGVycy4gRmlsbGVkIGFmdGVyIHlvdSBwdXNoIGxhc3QgY2h1bmtcbiAqIChjYWxsIFtbRGVmbGF0ZSNwdXNoXV0gd2l0aCBgWl9GSU5JU0hgIC8gYHRydWVgIHBhcmFtKSAgb3IgaWYgeW91XG4gKiBwdXNoIGEgY2h1bmsgd2l0aCBleHBsaWNpdCBmbHVzaCAoY2FsbCBbW0RlZmxhdGUjcHVzaF1dIHdpdGhcbiAqIGBaX1NZTkNfRkxVU0hgIHBhcmFtKS5cbiAqKi9cblxuLyoqXG4gKiBEZWZsYXRlLmVyciAtPiBOdW1iZXJcbiAqXG4gKiBFcnJvciBjb2RlIGFmdGVyIGRlZmxhdGUgZmluaXNoZWQuIDAgKFpfT0spIG9uIHN1Y2Nlc3MuXG4gKiBZb3Ugd2lsbCBub3QgbmVlZCBpdCBpbiByZWFsIGxpZmUsIGJlY2F1c2UgZGVmbGF0ZSBlcnJvcnNcbiAqIGFyZSBwb3NzaWJsZSBvbmx5IG9uIHdyb25nIG9wdGlvbnMgb3IgYmFkIGBvbkRhdGFgIC8gYG9uRW5kYFxuICogY3VzdG9tIGhhbmRsZXJzLlxuICoqL1xuXG4vKipcbiAqIERlZmxhdGUubXNnIC0+IFN0cmluZ1xuICpcbiAqIEVycm9yIG1lc3NhZ2UsIGlmIFtbRGVmbGF0ZS5lcnJdXSAhPSAwXG4gKiovXG5cblxuLyoqXG4gKiBuZXcgRGVmbGF0ZShvcHRpb25zKVxuICogLSBvcHRpb25zIChPYmplY3QpOiB6bGliIGRlZmxhdGUgb3B0aW9ucy5cbiAqXG4gKiBDcmVhdGVzIG5ldyBkZWZsYXRvciBpbnN0YW5jZSB3aXRoIHNwZWNpZmllZCBwYXJhbXMuIFRocm93cyBleGNlcHRpb25cbiAqIG9uIGJhZCBwYXJhbXMuIFN1cHBvcnRlZCBvcHRpb25zOlxuICpcbiAqIC0gYGxldmVsYFxuICogLSBgd2luZG93Qml0c2BcbiAqIC0gYG1lbUxldmVsYFxuICogLSBgc3RyYXRlZ3lgXG4gKiAtIGBkaWN0aW9uYXJ5YFxuICpcbiAqIFtodHRwOi8vemxpYi5uZXQvbWFudWFsLmh0bWwjQWR2YW5jZWRdKGh0dHA6Ly96bGliLm5ldC9tYW51YWwuaHRtbCNBZHZhbmNlZClcbiAqIGZvciBtb3JlIGluZm9ybWF0aW9uIG9uIHRoZXNlLlxuICpcbiAqIEFkZGl0aW9uYWwgb3B0aW9ucywgZm9yIGludGVybmFsIG5lZWRzOlxuICpcbiAqIC0gYGNodW5rU2l6ZWAgLSBzaXplIG9mIGdlbmVyYXRlZCBkYXRhIGNodW5rcyAoMTZLIGJ5IGRlZmF1bHQpXG4gKiAtIGByYXdgIChCb29sZWFuKSAtIGRvIHJhdyBkZWZsYXRlXG4gKiAtIGBnemlwYCAoQm9vbGVhbikgLSBjcmVhdGUgZ3ppcCB3cmFwcGVyXG4gKiAtIGB0b2AgKFN0cmluZykgLSBpZiBlcXVhbCB0byAnc3RyaW5nJywgdGhlbiByZXN1bHQgd2lsbCBiZSBcImJpbmFyeSBzdHJpbmdcIlxuICogICAgKGVhY2ggY2hhciBjb2RlIFswLi4yNTVdKVxuICogLSBgaGVhZGVyYCAoT2JqZWN0KSAtIGN1c3RvbSBoZWFkZXIgZm9yIGd6aXBcbiAqICAgLSBgdGV4dGAgKEJvb2xlYW4pIC0gdHJ1ZSBpZiBjb21wcmVzc2VkIGRhdGEgYmVsaWV2ZWQgdG8gYmUgdGV4dFxuICogICAtIGB0aW1lYCAoTnVtYmVyKSAtIG1vZGlmaWNhdGlvbiB0aW1lLCB1bml4IHRpbWVzdGFtcFxuICogICAtIGBvc2AgKE51bWJlcikgLSBvcGVyYXRpb24gc3lzdGVtIGNvZGVcbiAqICAgLSBgZXh0cmFgIChBcnJheSkgLSBhcnJheSBvZiBieXRlcyB3aXRoIGV4dHJhIGRhdGEgKG1heCA2NTUzNilcbiAqICAgLSBgbmFtZWAgKFN0cmluZykgLSBmaWxlIG5hbWUgKGJpbmFyeSBzdHJpbmcpXG4gKiAgIC0gYGNvbW1lbnRgIChTdHJpbmcpIC0gY29tbWVudCAoYmluYXJ5IHN0cmluZylcbiAqICAgLSBgaGNyY2AgKEJvb2xlYW4pIC0gdHJ1ZSBpZiBoZWFkZXIgY3JjIHNob3VsZCBiZSBhZGRlZFxuICpcbiAqICMjIyMjIEV4YW1wbGU6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogdmFyIHBha28gPSByZXF1aXJlKCdwYWtvJylcbiAqICAgLCBjaHVuazEgPSBVaW50OEFycmF5KFsxLDIsMyw0LDUsNiw3LDgsOV0pXG4gKiAgICwgY2h1bmsyID0gVWludDhBcnJheShbMTAsMTEsMTIsMTMsMTQsMTUsMTYsMTcsMTgsMTldKTtcbiAqXG4gKiB2YXIgZGVmbGF0ZSA9IG5ldyBwYWtvLkRlZmxhdGUoeyBsZXZlbDogM30pO1xuICpcbiAqIGRlZmxhdGUucHVzaChjaHVuazEsIGZhbHNlKTtcbiAqIGRlZmxhdGUucHVzaChjaHVuazIsIHRydWUpOyAgLy8gdHJ1ZSAtPiBsYXN0IGNodW5rXG4gKlxuICogaWYgKGRlZmxhdGUuZXJyKSB7IHRocm93IG5ldyBFcnJvcihkZWZsYXRlLmVycik7IH1cbiAqXG4gKiBjb25zb2xlLmxvZyhkZWZsYXRlLnJlc3VsdCk7XG4gKiBgYGBcbiAqKi9cbmZ1bmN0aW9uIERlZmxhdGUob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgRGVmbGF0ZSkpIHJldHVybiBuZXcgRGVmbGF0ZShvcHRpb25zKTtcblxuICB0aGlzLm9wdGlvbnMgPSB1dGlscy5hc3NpZ24oe1xuICAgIGxldmVsOiBaX0RFRkFVTFRfQ09NUFJFU1NJT04sXG4gICAgbWV0aG9kOiBaX0RFRkxBVEVELFxuICAgIGNodW5rU2l6ZTogMTYzODQsXG4gICAgd2luZG93Qml0czogMTUsXG4gICAgbWVtTGV2ZWw6IDgsXG4gICAgc3RyYXRlZ3k6IFpfREVGQVVMVF9TVFJBVEVHWSxcbiAgICB0bzogJydcbiAgfSwgb3B0aW9ucyB8fCB7fSk7XG5cbiAgdmFyIG9wdCA9IHRoaXMub3B0aW9ucztcblxuICBpZiAob3B0LnJhdyAmJiAob3B0LndpbmRvd0JpdHMgPiAwKSkge1xuICAgIG9wdC53aW5kb3dCaXRzID0gLW9wdC53aW5kb3dCaXRzO1xuICB9XG5cbiAgZWxzZSBpZiAob3B0Lmd6aXAgJiYgKG9wdC53aW5kb3dCaXRzID4gMCkgJiYgKG9wdC53aW5kb3dCaXRzIDwgMTYpKSB7XG4gICAgb3B0LndpbmRvd0JpdHMgKz0gMTY7XG4gIH1cblxuICB0aGlzLmVyciAgICA9IDA7ICAgICAgLy8gZXJyb3IgY29kZSwgaWYgaGFwcGVucyAoMCA9IFpfT0spXG4gIHRoaXMubXNnICAgID0gJyc7ICAgICAvLyBlcnJvciBtZXNzYWdlXG4gIHRoaXMuZW5kZWQgID0gZmFsc2U7ICAvLyB1c2VkIHRvIGF2b2lkIG11bHRpcGxlIG9uRW5kKCkgY2FsbHNcbiAgdGhpcy5jaHVua3MgPSBbXTsgICAgIC8vIGNodW5rcyBvZiBjb21wcmVzc2VkIGRhdGFcblxuICB0aGlzLnN0cm0gPSBuZXcgWlN0cmVhbSgpO1xuICB0aGlzLnN0cm0uYXZhaWxfb3V0ID0gMDtcblxuICB2YXIgc3RhdHVzID0gemxpYl9kZWZsYXRlLmRlZmxhdGVJbml0MihcbiAgICB0aGlzLnN0cm0sXG4gICAgb3B0LmxldmVsLFxuICAgIG9wdC5tZXRob2QsXG4gICAgb3B0LndpbmRvd0JpdHMsXG4gICAgb3B0Lm1lbUxldmVsLFxuICAgIG9wdC5zdHJhdGVneVxuICApO1xuXG4gIGlmIChzdGF0dXMgIT09IFpfT0spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IobXNnW3N0YXR1c10pO1xuICB9XG5cbiAgaWYgKG9wdC5oZWFkZXIpIHtcbiAgICB6bGliX2RlZmxhdGUuZGVmbGF0ZVNldEhlYWRlcih0aGlzLnN0cm0sIG9wdC5oZWFkZXIpO1xuICB9XG5cbiAgaWYgKG9wdC5kaWN0aW9uYXJ5KSB7XG4gICAgdmFyIGRpY3Q7XG4gICAgLy8gQ29udmVydCBkYXRhIGlmIG5lZWRlZFxuICAgIGlmICh0eXBlb2Ygb3B0LmRpY3Rpb25hcnkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBJZiB3ZSBuZWVkIHRvIGNvbXByZXNzIHRleHQsIGNoYW5nZSBlbmNvZGluZyB0byB1dGY4LlxuICAgICAgZGljdCA9IHN0cmluZ3Muc3RyaW5nMmJ1ZihvcHQuZGljdGlvbmFyeSk7XG4gICAgfSBlbHNlIGlmICh0b1N0cmluZy5jYWxsKG9wdC5kaWN0aW9uYXJ5KSA9PT0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJykge1xuICAgICAgZGljdCA9IG5ldyBVaW50OEFycmF5KG9wdC5kaWN0aW9uYXJ5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGljdCA9IG9wdC5kaWN0aW9uYXJ5O1xuICAgIH1cblxuICAgIHN0YXR1cyA9IHpsaWJfZGVmbGF0ZS5kZWZsYXRlU2V0RGljdGlvbmFyeSh0aGlzLnN0cm0sIGRpY3QpO1xuXG4gICAgaWYgKHN0YXR1cyAhPT0gWl9PSykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZ1tzdGF0dXNdKTtcbiAgICB9XG5cbiAgICB0aGlzLl9kaWN0X3NldCA9IHRydWU7XG4gIH1cbn1cblxuLyoqXG4gKiBEZWZsYXRlI3B1c2goZGF0YVssIG1vZGVdKSAtPiBCb29sZWFuXG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXl8QXJyYXlCdWZmZXJ8U3RyaW5nKTogaW5wdXQgZGF0YS4gU3RyaW5ncyB3aWxsIGJlXG4gKiAgIGNvbnZlcnRlZCB0byB1dGY4IGJ5dGUgc2VxdWVuY2UuXG4gKiAtIG1vZGUgKE51bWJlcnxCb29sZWFuKTogMC4uNiBmb3IgY29ycmVzcG9uZGluZyBaX05PX0ZMVVNILi5aX1RSRUUgbW9kZXMuXG4gKiAgIFNlZSBjb25zdGFudHMuIFNraXBwZWQgb3IgYGZhbHNlYCBtZWFucyBaX05PX0ZMVVNILCBgdHJ1ZWAgbWVhbnMgWl9GSU5JU0guXG4gKlxuICogU2VuZHMgaW5wdXQgZGF0YSB0byBkZWZsYXRlIHBpcGUsIGdlbmVyYXRpbmcgW1tEZWZsYXRlI29uRGF0YV1dIGNhbGxzIHdpdGhcbiAqIG5ldyBjb21wcmVzc2VkIGNodW5rcy4gUmV0dXJucyBgdHJ1ZWAgb24gc3VjY2Vzcy4gVGhlIGxhc3QgZGF0YSBibG9jayBtdXN0IGhhdmVcbiAqIG1vZGUgWl9GSU5JU0ggKG9yIGB0cnVlYCkuIFRoYXQgd2lsbCBmbHVzaCBpbnRlcm5hbCBwZW5kaW5nIGJ1ZmZlcnMgYW5kIGNhbGxcbiAqIFtbRGVmbGF0ZSNvbkVuZF1dLiBGb3IgaW50ZXJpbSBleHBsaWNpdCBmbHVzaGVzICh3aXRob3V0IGVuZGluZyB0aGUgc3RyZWFtKSB5b3VcbiAqIGNhbiB1c2UgbW9kZSBaX1NZTkNfRkxVU0gsIGtlZXBpbmcgdGhlIGNvbXByZXNzaW9uIGNvbnRleHQuXG4gKlxuICogT24gZmFpbCBjYWxsIFtbRGVmbGF0ZSNvbkVuZF1dIHdpdGggZXJyb3IgY29kZSBhbmQgcmV0dXJuIGZhbHNlLlxuICpcbiAqIFdlIHN0cm9uZ2x5IHJlY29tbWVuZCB0byB1c2UgYFVpbnQ4QXJyYXlgIG9uIGlucHV0IGZvciBiZXN0IHNwZWVkIChvdXRwdXRcbiAqIGFycmF5IGZvcm1hdCBpcyBkZXRlY3RlZCBhdXRvbWF0aWNhbGx5KS4gQWxzbywgZG9uJ3Qgc2tpcCBsYXN0IHBhcmFtIGFuZCBhbHdheXNcbiAqIHVzZSB0aGUgc2FtZSB0eXBlIGluIHlvdXIgY29kZSAoYm9vbGVhbiBvciBudW1iZXIpLiBUaGF0IHdpbGwgaW1wcm92ZSBKUyBzcGVlZC5cbiAqXG4gKiBGb3IgcmVndWxhciBgQXJyYXlgLXMgbWFrZSBzdXJlIGFsbCBlbGVtZW50cyBhcmUgWzAuLjI1NV0uXG4gKlxuICogIyMjIyMgRXhhbXBsZVxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHB1c2goY2h1bmssIGZhbHNlKTsgLy8gcHVzaCBvbmUgb2YgZGF0YSBjaHVua3NcbiAqIC4uLlxuICogcHVzaChjaHVuaywgdHJ1ZSk7ICAvLyBwdXNoIGxhc3QgY2h1bmtcbiAqIGBgYFxuICoqL1xuRGVmbGF0ZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uIChkYXRhLCBtb2RlKSB7XG4gIHZhciBzdHJtID0gdGhpcy5zdHJtO1xuICB2YXIgY2h1bmtTaXplID0gdGhpcy5vcHRpb25zLmNodW5rU2l6ZTtcbiAgdmFyIHN0YXR1cywgX21vZGU7XG5cbiAgaWYgKHRoaXMuZW5kZWQpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgX21vZGUgPSAobW9kZSA9PT0gfn5tb2RlKSA/IG1vZGUgOiAoKG1vZGUgPT09IHRydWUpID8gWl9GSU5JU0ggOiBaX05PX0ZMVVNIKTtcblxuICAvLyBDb252ZXJ0IGRhdGEgaWYgbmVlZGVkXG4gIGlmICh0eXBlb2YgZGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICAvLyBJZiB3ZSBuZWVkIHRvIGNvbXByZXNzIHRleHQsIGNoYW5nZSBlbmNvZGluZyB0byB1dGY4LlxuICAgIHN0cm0uaW5wdXQgPSBzdHJpbmdzLnN0cmluZzJidWYoZGF0YSk7XG4gIH0gZWxzZSBpZiAodG9TdHJpbmcuY2FsbChkYXRhKSA9PT0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJykge1xuICAgIHN0cm0uaW5wdXQgPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgfSBlbHNlIHtcbiAgICBzdHJtLmlucHV0ID0gZGF0YTtcbiAgfVxuXG4gIHN0cm0ubmV4dF9pbiA9IDA7XG4gIHN0cm0uYXZhaWxfaW4gPSBzdHJtLmlucHV0Lmxlbmd0aDtcblxuICBkbyB7XG4gICAgaWYgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICBzdHJtLm91dHB1dCA9IG5ldyB1dGlscy5CdWY4KGNodW5rU2l6ZSk7XG4gICAgICBzdHJtLm5leHRfb3V0ID0gMDtcbiAgICAgIHN0cm0uYXZhaWxfb3V0ID0gY2h1bmtTaXplO1xuICAgIH1cbiAgICBzdGF0dXMgPSB6bGliX2RlZmxhdGUuZGVmbGF0ZShzdHJtLCBfbW9kZSk7ICAgIC8qIG5vIGJhZCByZXR1cm4gdmFsdWUgKi9cblxuICAgIGlmIChzdGF0dXMgIT09IFpfU1RSRUFNX0VORCAmJiBzdGF0dXMgIT09IFpfT0spIHtcbiAgICAgIHRoaXMub25FbmQoc3RhdHVzKTtcbiAgICAgIHRoaXMuZW5kZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDAgfHwgKHN0cm0uYXZhaWxfaW4gPT09IDAgJiYgKF9tb2RlID09PSBaX0ZJTklTSCB8fCBfbW9kZSA9PT0gWl9TWU5DX0ZMVVNIKSkpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMudG8gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRoaXMub25EYXRhKHN0cmluZ3MuYnVmMmJpbnN0cmluZyh1dGlscy5zaHJpbmtCdWYoc3RybS5vdXRwdXQsIHN0cm0ubmV4dF9vdXQpKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9uRGF0YSh1dGlscy5zaHJpbmtCdWYoc3RybS5vdXRwdXQsIHN0cm0ubmV4dF9vdXQpKTtcbiAgICAgIH1cbiAgICB9XG4gIH0gd2hpbGUgKChzdHJtLmF2YWlsX2luID4gMCB8fCBzdHJtLmF2YWlsX291dCA9PT0gMCkgJiYgc3RhdHVzICE9PSBaX1NUUkVBTV9FTkQpO1xuXG4gIC8vIEZpbmFsaXplIG9uIHRoZSBsYXN0IGNodW5rLlxuICBpZiAoX21vZGUgPT09IFpfRklOSVNIKSB7XG4gICAgc3RhdHVzID0gemxpYl9kZWZsYXRlLmRlZmxhdGVFbmQodGhpcy5zdHJtKTtcbiAgICB0aGlzLm9uRW5kKHN0YXR1cyk7XG4gICAgdGhpcy5lbmRlZCA9IHRydWU7XG4gICAgcmV0dXJuIHN0YXR1cyA9PT0gWl9PSztcbiAgfVxuXG4gIC8vIGNhbGxiYWNrIGludGVyaW0gcmVzdWx0cyBpZiBaX1NZTkNfRkxVU0guXG4gIGlmIChfbW9kZSA9PT0gWl9TWU5DX0ZMVVNIKSB7XG4gICAgdGhpcy5vbkVuZChaX09LKTtcbiAgICBzdHJtLmF2YWlsX291dCA9IDA7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cblxuLyoqXG4gKiBEZWZsYXRlI29uRGF0YShjaHVuaykgLT4gVm9pZFxuICogLSBjaHVuayAoVWludDhBcnJheXxBcnJheXxTdHJpbmcpOiBvdXRwdXQgZGF0YS4gVHlwZSBvZiBhcnJheSBkZXBlbmRzXG4gKiAgIG9uIGpzIGVuZ2luZSBzdXBwb3J0LiBXaGVuIHN0cmluZyBvdXRwdXQgcmVxdWVzdGVkLCBlYWNoIGNodW5rXG4gKiAgIHdpbGwgYmUgc3RyaW5nLlxuICpcbiAqIEJ5IGRlZmF1bHQsIHN0b3JlcyBkYXRhIGJsb2NrcyBpbiBgY2h1bmtzW11gIHByb3BlcnR5IGFuZCBnbHVlXG4gKiB0aG9zZSBpbiBgb25FbmRgLiBPdmVycmlkZSB0aGlzIGhhbmRsZXIsIGlmIHlvdSBuZWVkIGFub3RoZXIgYmVoYXZpb3VyLlxuICoqL1xuRGVmbGF0ZS5wcm90b3R5cGUub25EYXRhID0gZnVuY3Rpb24gKGNodW5rKSB7XG4gIHRoaXMuY2h1bmtzLnB1c2goY2h1bmspO1xufTtcblxuXG4vKipcbiAqIERlZmxhdGUjb25FbmQoc3RhdHVzKSAtPiBWb2lkXG4gKiAtIHN0YXR1cyAoTnVtYmVyKTogZGVmbGF0ZSBzdGF0dXMuIDAgKFpfT0spIG9uIHN1Y2Nlc3MsXG4gKiAgIG90aGVyIGlmIG5vdC5cbiAqXG4gKiBDYWxsZWQgb25jZSBhZnRlciB5b3UgdGVsbCBkZWZsYXRlIHRoYXQgdGhlIGlucHV0IHN0cmVhbSBpc1xuICogY29tcGxldGUgKFpfRklOSVNIKSBvciBzaG91bGQgYmUgZmx1c2hlZCAoWl9TWU5DX0ZMVVNIKVxuICogb3IgaWYgYW4gZXJyb3IgaGFwcGVuZWQuIEJ5IGRlZmF1bHQgLSBqb2luIGNvbGxlY3RlZCBjaHVua3MsXG4gKiBmcmVlIG1lbW9yeSBhbmQgZmlsbCBgcmVzdWx0c2AgLyBgZXJyYCBwcm9wZXJ0aWVzLlxuICoqL1xuRGVmbGF0ZS5wcm90b3R5cGUub25FbmQgPSBmdW5jdGlvbiAoc3RhdHVzKSB7XG4gIC8vIE9uIHN1Y2Nlc3MgLSBqb2luXG4gIGlmIChzdGF0dXMgPT09IFpfT0spIHtcbiAgICBpZiAodGhpcy5vcHRpb25zLnRvID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5yZXN1bHQgPSB0aGlzLmNodW5rcy5qb2luKCcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZXN1bHQgPSB1dGlscy5mbGF0dGVuQ2h1bmtzKHRoaXMuY2h1bmtzKTtcbiAgICB9XG4gIH1cbiAgdGhpcy5jaHVua3MgPSBbXTtcbiAgdGhpcy5lcnIgPSBzdGF0dXM7XG4gIHRoaXMubXNnID0gdGhpcy5zdHJtLm1zZztcbn07XG5cblxuLyoqXG4gKiBkZWZsYXRlKGRhdGFbLCBvcHRpb25zXSkgLT4gVWludDhBcnJheXxBcnJheXxTdHJpbmdcbiAqIC0gZGF0YSAoVWludDhBcnJheXxBcnJheXxTdHJpbmcpOiBpbnB1dCBkYXRhIHRvIGNvbXByZXNzLlxuICogLSBvcHRpb25zIChPYmplY3QpOiB6bGliIGRlZmxhdGUgb3B0aW9ucy5cbiAqXG4gKiBDb21wcmVzcyBgZGF0YWAgd2l0aCBkZWZsYXRlIGFsZ29yaXRobSBhbmQgYG9wdGlvbnNgLlxuICpcbiAqIFN1cHBvcnRlZCBvcHRpb25zIGFyZTpcbiAqXG4gKiAtIGxldmVsXG4gKiAtIHdpbmRvd0JpdHNcbiAqIC0gbWVtTGV2ZWxcbiAqIC0gc3RyYXRlZ3lcbiAqIC0gZGljdGlvbmFyeVxuICpcbiAqIFtodHRwOi8vemxpYi5uZXQvbWFudWFsLmh0bWwjQWR2YW5jZWRdKGh0dHA6Ly96bGliLm5ldC9tYW51YWwuaHRtbCNBZHZhbmNlZClcbiAqIGZvciBtb3JlIGluZm9ybWF0aW9uIG9uIHRoZXNlLlxuICpcbiAqIFN1Z2FyIChvcHRpb25zKTpcbiAqXG4gKiAtIGByYXdgIChCb29sZWFuKSAtIHNheSB0aGF0IHdlIHdvcmsgd2l0aCByYXcgc3RyZWFtLCBpZiB5b3UgZG9uJ3Qgd2lzaCB0byBzcGVjaWZ5XG4gKiAgIG5lZ2F0aXZlIHdpbmRvd0JpdHMgaW1wbGljaXRseS5cbiAqIC0gYHRvYCAoU3RyaW5nKSAtIGlmIGVxdWFsIHRvICdzdHJpbmcnLCB0aGVuIHJlc3VsdCB3aWxsIGJlIFwiYmluYXJ5IHN0cmluZ1wiXG4gKiAgICAoZWFjaCBjaGFyIGNvZGUgWzAuLjI1NV0pXG4gKlxuICogIyMjIyMgRXhhbXBsZTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgcGFrbyA9IHJlcXVpcmUoJ3Bha28nKVxuICogICAsIGRhdGEgPSBVaW50OEFycmF5KFsxLDIsMyw0LDUsNiw3LDgsOV0pO1xuICpcbiAqIGNvbnNvbGUubG9nKHBha28uZGVmbGF0ZShkYXRhKSk7XG4gKiBgYGBcbiAqKi9cbmZ1bmN0aW9uIGRlZmxhdGUoaW5wdXQsIG9wdGlvbnMpIHtcbiAgdmFyIGRlZmxhdG9yID0gbmV3IERlZmxhdGUob3B0aW9ucyk7XG5cbiAgZGVmbGF0b3IucHVzaChpbnB1dCwgdHJ1ZSk7XG5cbiAgLy8gVGhhdCB3aWxsIG5ldmVyIGhhcHBlbnMsIGlmIHlvdSBkb24ndCBjaGVhdCB3aXRoIG9wdGlvbnMgOilcbiAgaWYgKGRlZmxhdG9yLmVycikgeyB0aHJvdyBkZWZsYXRvci5tc2cgfHwgbXNnW2RlZmxhdG9yLmVycl07IH1cblxuICByZXR1cm4gZGVmbGF0b3IucmVzdWx0O1xufVxuXG5cbi8qKlxuICogZGVmbGF0ZVJhdyhkYXRhWywgb3B0aW9uc10pIC0+IFVpbnQ4QXJyYXl8QXJyYXl8U3RyaW5nXG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXl8U3RyaW5nKTogaW5wdXQgZGF0YSB0byBjb21wcmVzcy5cbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBkZWZsYXRlIG9wdGlvbnMuXG4gKlxuICogVGhlIHNhbWUgYXMgW1tkZWZsYXRlXV0sIGJ1dCBjcmVhdGVzIHJhdyBkYXRhLCB3aXRob3V0IHdyYXBwZXJcbiAqIChoZWFkZXIgYW5kIGFkbGVyMzIgY3JjKS5cbiAqKi9cbmZ1bmN0aW9uIGRlZmxhdGVSYXcoaW5wdXQsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIG9wdGlvbnMucmF3ID0gdHJ1ZTtcbiAgcmV0dXJuIGRlZmxhdGUoaW5wdXQsIG9wdGlvbnMpO1xufVxuXG5cbi8qKlxuICogZ3ppcChkYXRhWywgb3B0aW9uc10pIC0+IFVpbnQ4QXJyYXl8QXJyYXl8U3RyaW5nXG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXl8U3RyaW5nKTogaW5wdXQgZGF0YSB0byBjb21wcmVzcy5cbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBkZWZsYXRlIG9wdGlvbnMuXG4gKlxuICogVGhlIHNhbWUgYXMgW1tkZWZsYXRlXV0sIGJ1dCBjcmVhdGUgZ3ppcCB3cmFwcGVyIGluc3RlYWQgb2ZcbiAqIGRlZmxhdGUgb25lLlxuICoqL1xuZnVuY3Rpb24gZ3ppcChpbnB1dCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgb3B0aW9ucy5nemlwID0gdHJ1ZTtcbiAgcmV0dXJuIGRlZmxhdGUoaW5wdXQsIG9wdGlvbnMpO1xufVxuXG5cbmV4cG9ydHMuRGVmbGF0ZSA9IERlZmxhdGU7XG5leHBvcnRzLmRlZmxhdGUgPSBkZWZsYXRlO1xuZXhwb3J0cy5kZWZsYXRlUmF3ID0gZGVmbGF0ZVJhdztcbmV4cG9ydHMuZ3ppcCA9IGd6aXA7XG4iLCIndXNlIHN0cmljdCc7XG5cblxudmFyIHpsaWJfaW5mbGF0ZSA9IHJlcXVpcmUoJy4vemxpYi9pbmZsYXRlJyk7XG52YXIgdXRpbHMgICAgICAgID0gcmVxdWlyZSgnLi91dGlscy9jb21tb24nKTtcbnZhciBzdHJpbmdzICAgICAgPSByZXF1aXJlKCcuL3V0aWxzL3N0cmluZ3MnKTtcbnZhciBjICAgICAgICAgICAgPSByZXF1aXJlKCcuL3psaWIvY29uc3RhbnRzJyk7XG52YXIgbXNnICAgICAgICAgID0gcmVxdWlyZSgnLi96bGliL21lc3NhZ2VzJyk7XG52YXIgWlN0cmVhbSAgICAgID0gcmVxdWlyZSgnLi96bGliL3pzdHJlYW0nKTtcbnZhciBHWmhlYWRlciAgICAgPSByZXF1aXJlKCcuL3psaWIvZ3poZWFkZXInKTtcblxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZztcblxuLyoqXG4gKiBjbGFzcyBJbmZsYXRlXG4gKlxuICogR2VuZXJpYyBKUy1zdHlsZSB3cmFwcGVyIGZvciB6bGliIGNhbGxzLiBJZiB5b3UgZG9uJ3QgbmVlZFxuICogc3RyZWFtaW5nIGJlaGF2aW91ciAtIHVzZSBtb3JlIHNpbXBsZSBmdW5jdGlvbnM6IFtbaW5mbGF0ZV1dXG4gKiBhbmQgW1tpbmZsYXRlUmF3XV0uXG4gKiovXG5cbi8qIGludGVybmFsXG4gKiBpbmZsYXRlLmNodW5rcyAtPiBBcnJheVxuICpcbiAqIENodW5rcyBvZiBvdXRwdXQgZGF0YSwgaWYgW1tJbmZsYXRlI29uRGF0YV1dIG5vdCBvdmVycmlkZGVuLlxuICoqL1xuXG4vKipcbiAqIEluZmxhdGUucmVzdWx0IC0+IFVpbnQ4QXJyYXl8QXJyYXl8U3RyaW5nXG4gKlxuICogVW5jb21wcmVzc2VkIHJlc3VsdCwgZ2VuZXJhdGVkIGJ5IGRlZmF1bHQgW1tJbmZsYXRlI29uRGF0YV1dXG4gKiBhbmQgW1tJbmZsYXRlI29uRW5kXV0gaGFuZGxlcnMuIEZpbGxlZCBhZnRlciB5b3UgcHVzaCBsYXN0IGNodW5rXG4gKiAoY2FsbCBbW0luZmxhdGUjcHVzaF1dIHdpdGggYFpfRklOSVNIYCAvIGB0cnVlYCBwYXJhbSkgb3IgaWYgeW91XG4gKiBwdXNoIGEgY2h1bmsgd2l0aCBleHBsaWNpdCBmbHVzaCAoY2FsbCBbW0luZmxhdGUjcHVzaF1dIHdpdGhcbiAqIGBaX1NZTkNfRkxVU0hgIHBhcmFtKS5cbiAqKi9cblxuLyoqXG4gKiBJbmZsYXRlLmVyciAtPiBOdW1iZXJcbiAqXG4gKiBFcnJvciBjb2RlIGFmdGVyIGluZmxhdGUgZmluaXNoZWQuIDAgKFpfT0spIG9uIHN1Y2Nlc3MuXG4gKiBTaG91bGQgYmUgY2hlY2tlZCBpZiBicm9rZW4gZGF0YSBwb3NzaWJsZS5cbiAqKi9cblxuLyoqXG4gKiBJbmZsYXRlLm1zZyAtPiBTdHJpbmdcbiAqXG4gKiBFcnJvciBtZXNzYWdlLCBpZiBbW0luZmxhdGUuZXJyXV0gIT0gMFxuICoqL1xuXG5cbi8qKlxuICogbmV3IEluZmxhdGUob3B0aW9ucylcbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBpbmZsYXRlIG9wdGlvbnMuXG4gKlxuICogQ3JlYXRlcyBuZXcgaW5mbGF0b3IgaW5zdGFuY2Ugd2l0aCBzcGVjaWZpZWQgcGFyYW1zLiBUaHJvd3MgZXhjZXB0aW9uXG4gKiBvbiBiYWQgcGFyYW1zLiBTdXBwb3J0ZWQgb3B0aW9uczpcbiAqXG4gKiAtIGB3aW5kb3dCaXRzYFxuICogLSBgZGljdGlvbmFyeWBcbiAqXG4gKiBbaHR0cDovL3psaWIubmV0L21hbnVhbC5odG1sI0FkdmFuY2VkXShodHRwOi8vemxpYi5uZXQvbWFudWFsLmh0bWwjQWR2YW5jZWQpXG4gKiBmb3IgbW9yZSBpbmZvcm1hdGlvbiBvbiB0aGVzZS5cbiAqXG4gKiBBZGRpdGlvbmFsIG9wdGlvbnMsIGZvciBpbnRlcm5hbCBuZWVkczpcbiAqXG4gKiAtIGBjaHVua1NpemVgIC0gc2l6ZSBvZiBnZW5lcmF0ZWQgZGF0YSBjaHVua3MgKDE2SyBieSBkZWZhdWx0KVxuICogLSBgcmF3YCAoQm9vbGVhbikgLSBkbyByYXcgaW5mbGF0ZVxuICogLSBgdG9gIChTdHJpbmcpIC0gaWYgZXF1YWwgdG8gJ3N0cmluZycsIHRoZW4gcmVzdWx0IHdpbGwgYmUgY29udmVydGVkXG4gKiAgIGZyb20gdXRmOCB0byB1dGYxNiAoamF2YXNjcmlwdCkgc3RyaW5nLiBXaGVuIHN0cmluZyBvdXRwdXQgcmVxdWVzdGVkLFxuICogICBjaHVuayBsZW5ndGggY2FuIGRpZmZlciBmcm9tIGBjaHVua1NpemVgLCBkZXBlbmRpbmcgb24gY29udGVudC5cbiAqXG4gKiBCeSBkZWZhdWx0LCB3aGVuIG5vIG9wdGlvbnMgc2V0LCBhdXRvZGV0ZWN0IGRlZmxhdGUvZ3ppcCBkYXRhIGZvcm1hdCB2aWFcbiAqIHdyYXBwZXIgaGVhZGVyLlxuICpcbiAqICMjIyMjIEV4YW1wbGU6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogdmFyIHBha28gPSByZXF1aXJlKCdwYWtvJylcbiAqICAgLCBjaHVuazEgPSBVaW50OEFycmF5KFsxLDIsMyw0LDUsNiw3LDgsOV0pXG4gKiAgICwgY2h1bmsyID0gVWludDhBcnJheShbMTAsMTEsMTIsMTMsMTQsMTUsMTYsMTcsMTgsMTldKTtcbiAqXG4gKiB2YXIgaW5mbGF0ZSA9IG5ldyBwYWtvLkluZmxhdGUoeyBsZXZlbDogM30pO1xuICpcbiAqIGluZmxhdGUucHVzaChjaHVuazEsIGZhbHNlKTtcbiAqIGluZmxhdGUucHVzaChjaHVuazIsIHRydWUpOyAgLy8gdHJ1ZSAtPiBsYXN0IGNodW5rXG4gKlxuICogaWYgKGluZmxhdGUuZXJyKSB7IHRocm93IG5ldyBFcnJvcihpbmZsYXRlLmVycik7IH1cbiAqXG4gKiBjb25zb2xlLmxvZyhpbmZsYXRlLnJlc3VsdCk7XG4gKiBgYGBcbiAqKi9cbmZ1bmN0aW9uIEluZmxhdGUob3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgSW5mbGF0ZSkpIHJldHVybiBuZXcgSW5mbGF0ZShvcHRpb25zKTtcblxuICB0aGlzLm9wdGlvbnMgPSB1dGlscy5hc3NpZ24oe1xuICAgIGNodW5rU2l6ZTogMTYzODQsXG4gICAgd2luZG93Qml0czogMCxcbiAgICB0bzogJydcbiAgfSwgb3B0aW9ucyB8fCB7fSk7XG5cbiAgdmFyIG9wdCA9IHRoaXMub3B0aW9ucztcblxuICAvLyBGb3JjZSB3aW5kb3cgc2l6ZSBmb3IgYHJhd2AgZGF0YSwgaWYgbm90IHNldCBkaXJlY3RseSxcbiAgLy8gYmVjYXVzZSB3ZSBoYXZlIG5vIGhlYWRlciBmb3IgYXV0b2RldGVjdC5cbiAgaWYgKG9wdC5yYXcgJiYgKG9wdC53aW5kb3dCaXRzID49IDApICYmIChvcHQud2luZG93Qml0cyA8IDE2KSkge1xuICAgIG9wdC53aW5kb3dCaXRzID0gLW9wdC53aW5kb3dCaXRzO1xuICAgIGlmIChvcHQud2luZG93Qml0cyA9PT0gMCkgeyBvcHQud2luZG93Qml0cyA9IC0xNTsgfVxuICB9XG5cbiAgLy8gSWYgYHdpbmRvd0JpdHNgIG5vdCBkZWZpbmVkIChhbmQgbW9kZSBub3QgcmF3KSAtIHNldCBhdXRvZGV0ZWN0IGZsYWcgZm9yIGd6aXAvZGVmbGF0ZVxuICBpZiAoKG9wdC53aW5kb3dCaXRzID49IDApICYmIChvcHQud2luZG93Qml0cyA8IDE2KSAmJlxuICAgICAgIShvcHRpb25zICYmIG9wdGlvbnMud2luZG93Qml0cykpIHtcbiAgICBvcHQud2luZG93Qml0cyArPSAzMjtcbiAgfVxuXG4gIC8vIEd6aXAgaGVhZGVyIGhhcyBubyBpbmZvIGFib3V0IHdpbmRvd3Mgc2l6ZSwgd2UgY2FuIGRvIGF1dG9kZXRlY3Qgb25seVxuICAvLyBmb3IgZGVmbGF0ZS4gU28sIGlmIHdpbmRvdyBzaXplIG5vdCBzZXQsIGZvcmNlIGl0IHRvIG1heCB3aGVuIGd6aXAgcG9zc2libGVcbiAgaWYgKChvcHQud2luZG93Qml0cyA+IDE1KSAmJiAob3B0LndpbmRvd0JpdHMgPCA0OCkpIHtcbiAgICAvLyBiaXQgMyAoMTYpIC0+IGd6aXBwZWQgZGF0YVxuICAgIC8vIGJpdCA0ICgzMikgLT4gYXV0b2RldGVjdCBnemlwL2RlZmxhdGVcbiAgICBpZiAoKG9wdC53aW5kb3dCaXRzICYgMTUpID09PSAwKSB7XG4gICAgICBvcHQud2luZG93Qml0cyB8PSAxNTtcbiAgICB9XG4gIH1cblxuICB0aGlzLmVyciAgICA9IDA7ICAgICAgLy8gZXJyb3IgY29kZSwgaWYgaGFwcGVucyAoMCA9IFpfT0spXG4gIHRoaXMubXNnICAgID0gJyc7ICAgICAvLyBlcnJvciBtZXNzYWdlXG4gIHRoaXMuZW5kZWQgID0gZmFsc2U7ICAvLyB1c2VkIHRvIGF2b2lkIG11bHRpcGxlIG9uRW5kKCkgY2FsbHNcbiAgdGhpcy5jaHVua3MgPSBbXTsgICAgIC8vIGNodW5rcyBvZiBjb21wcmVzc2VkIGRhdGFcblxuICB0aGlzLnN0cm0gICA9IG5ldyBaU3RyZWFtKCk7XG4gIHRoaXMuc3RybS5hdmFpbF9vdXQgPSAwO1xuXG4gIHZhciBzdGF0dXMgID0gemxpYl9pbmZsYXRlLmluZmxhdGVJbml0MihcbiAgICB0aGlzLnN0cm0sXG4gICAgb3B0LndpbmRvd0JpdHNcbiAgKTtcblxuICBpZiAoc3RhdHVzICE9PSBjLlpfT0spIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IobXNnW3N0YXR1c10pO1xuICB9XG5cbiAgdGhpcy5oZWFkZXIgPSBuZXcgR1poZWFkZXIoKTtcblxuICB6bGliX2luZmxhdGUuaW5mbGF0ZUdldEhlYWRlcih0aGlzLnN0cm0sIHRoaXMuaGVhZGVyKTtcblxuICAvLyBTZXR1cCBkaWN0aW9uYXJ5XG4gIGlmIChvcHQuZGljdGlvbmFyeSkge1xuICAgIC8vIENvbnZlcnQgZGF0YSBpZiBuZWVkZWRcbiAgICBpZiAodHlwZW9mIG9wdC5kaWN0aW9uYXJ5ID09PSAnc3RyaW5nJykge1xuICAgICAgb3B0LmRpY3Rpb25hcnkgPSBzdHJpbmdzLnN0cmluZzJidWYob3B0LmRpY3Rpb25hcnkpO1xuICAgIH0gZWxzZSBpZiAodG9TdHJpbmcuY2FsbChvcHQuZGljdGlvbmFyeSkgPT09ICdbb2JqZWN0IEFycmF5QnVmZmVyXScpIHtcbiAgICAgIG9wdC5kaWN0aW9uYXJ5ID0gbmV3IFVpbnQ4QXJyYXkob3B0LmRpY3Rpb25hcnkpO1xuICAgIH1cbiAgICBpZiAob3B0LnJhdykgeyAvL0luIHJhdyBtb2RlIHdlIG5lZWQgdG8gc2V0IHRoZSBkaWN0aW9uYXJ5IGVhcmx5XG4gICAgICBzdGF0dXMgPSB6bGliX2luZmxhdGUuaW5mbGF0ZVNldERpY3Rpb25hcnkodGhpcy5zdHJtLCBvcHQuZGljdGlvbmFyeSk7XG4gICAgICBpZiAoc3RhdHVzICE9PSBjLlpfT0spIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKG1zZ1tzdGF0dXNdKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBJbmZsYXRlI3B1c2goZGF0YVssIG1vZGVdKSAtPiBCb29sZWFuXG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXl8QXJyYXlCdWZmZXJ8U3RyaW5nKTogaW5wdXQgZGF0YVxuICogLSBtb2RlIChOdW1iZXJ8Qm9vbGVhbik6IDAuLjYgZm9yIGNvcnJlc3BvbmRpbmcgWl9OT19GTFVTSC4uWl9UUkVFIG1vZGVzLlxuICogICBTZWUgY29uc3RhbnRzLiBTa2lwcGVkIG9yIGBmYWxzZWAgbWVhbnMgWl9OT19GTFVTSCwgYHRydWVgIG1lYW5zIFpfRklOSVNILlxuICpcbiAqIFNlbmRzIGlucHV0IGRhdGEgdG8gaW5mbGF0ZSBwaXBlLCBnZW5lcmF0aW5nIFtbSW5mbGF0ZSNvbkRhdGFdXSBjYWxscyB3aXRoXG4gKiBuZXcgb3V0cHV0IGNodW5rcy4gUmV0dXJucyBgdHJ1ZWAgb24gc3VjY2Vzcy4gVGhlIGxhc3QgZGF0YSBibG9jayBtdXN0IGhhdmVcbiAqIG1vZGUgWl9GSU5JU0ggKG9yIGB0cnVlYCkuIFRoYXQgd2lsbCBmbHVzaCBpbnRlcm5hbCBwZW5kaW5nIGJ1ZmZlcnMgYW5kIGNhbGxcbiAqIFtbSW5mbGF0ZSNvbkVuZF1dLiBGb3IgaW50ZXJpbSBleHBsaWNpdCBmbHVzaGVzICh3aXRob3V0IGVuZGluZyB0aGUgc3RyZWFtKSB5b3VcbiAqIGNhbiB1c2UgbW9kZSBaX1NZTkNfRkxVU0gsIGtlZXBpbmcgdGhlIGRlY29tcHJlc3Npb24gY29udGV4dC5cbiAqXG4gKiBPbiBmYWlsIGNhbGwgW1tJbmZsYXRlI29uRW5kXV0gd2l0aCBlcnJvciBjb2RlIGFuZCByZXR1cm4gZmFsc2UuXG4gKlxuICogV2Ugc3Ryb25nbHkgcmVjb21tZW5kIHRvIHVzZSBgVWludDhBcnJheWAgb24gaW5wdXQgZm9yIGJlc3Qgc3BlZWQgKG91dHB1dFxuICogZm9ybWF0IGlzIGRldGVjdGVkIGF1dG9tYXRpY2FsbHkpLiBBbHNvLCBkb24ndCBza2lwIGxhc3QgcGFyYW0gYW5kIGFsd2F5c1xuICogdXNlIHRoZSBzYW1lIHR5cGUgaW4geW91ciBjb2RlIChib29sZWFuIG9yIG51bWJlcikuIFRoYXQgd2lsbCBpbXByb3ZlIEpTIHNwZWVkLlxuICpcbiAqIEZvciByZWd1bGFyIGBBcnJheWAtcyBtYWtlIHN1cmUgYWxsIGVsZW1lbnRzIGFyZSBbMC4uMjU1XS5cbiAqXG4gKiAjIyMjIyBFeGFtcGxlXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogcHVzaChjaHVuaywgZmFsc2UpOyAvLyBwdXNoIG9uZSBvZiBkYXRhIGNodW5rc1xuICogLi4uXG4gKiBwdXNoKGNodW5rLCB0cnVlKTsgIC8vIHB1c2ggbGFzdCBjaHVua1xuICogYGBgXG4gKiovXG5JbmZsYXRlLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKGRhdGEsIG1vZGUpIHtcbiAgdmFyIHN0cm0gPSB0aGlzLnN0cm07XG4gIHZhciBjaHVua1NpemUgPSB0aGlzLm9wdGlvbnMuY2h1bmtTaXplO1xuICB2YXIgZGljdGlvbmFyeSA9IHRoaXMub3B0aW9ucy5kaWN0aW9uYXJ5O1xuICB2YXIgc3RhdHVzLCBfbW9kZTtcbiAgdmFyIG5leHRfb3V0X3V0ZjgsIHRhaWwsIHV0ZjhzdHI7XG5cbiAgLy8gRmxhZyB0byBwcm9wZXJseSBwcm9jZXNzIFpfQlVGX0VSUk9SIG9uIHRlc3RpbmcgaW5mbGF0ZSBjYWxsXG4gIC8vIHdoZW4gd2UgY2hlY2sgdGhhdCBhbGwgb3V0cHV0IGRhdGEgd2FzIGZsdXNoZWQuXG4gIHZhciBhbGxvd0J1ZkVycm9yID0gZmFsc2U7XG5cbiAgaWYgKHRoaXMuZW5kZWQpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIF9tb2RlID0gKG1vZGUgPT09IH5+bW9kZSkgPyBtb2RlIDogKChtb2RlID09PSB0cnVlKSA/IGMuWl9GSU5JU0ggOiBjLlpfTk9fRkxVU0gpO1xuXG4gIC8vIENvbnZlcnQgZGF0YSBpZiBuZWVkZWRcbiAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgIC8vIE9ubHkgYmluYXJ5IHN0cmluZ3MgY2FuIGJlIGRlY29tcHJlc3NlZCBvbiBwcmFjdGljZVxuICAgIHN0cm0uaW5wdXQgPSBzdHJpbmdzLmJpbnN0cmluZzJidWYoZGF0YSk7XG4gIH0gZWxzZSBpZiAodG9TdHJpbmcuY2FsbChkYXRhKSA9PT0gJ1tvYmplY3QgQXJyYXlCdWZmZXJdJykge1xuICAgIHN0cm0uaW5wdXQgPSBuZXcgVWludDhBcnJheShkYXRhKTtcbiAgfSBlbHNlIHtcbiAgICBzdHJtLmlucHV0ID0gZGF0YTtcbiAgfVxuXG4gIHN0cm0ubmV4dF9pbiA9IDA7XG4gIHN0cm0uYXZhaWxfaW4gPSBzdHJtLmlucHV0Lmxlbmd0aDtcblxuICBkbyB7XG4gICAgaWYgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICBzdHJtLm91dHB1dCA9IG5ldyB1dGlscy5CdWY4KGNodW5rU2l6ZSk7XG4gICAgICBzdHJtLm5leHRfb3V0ID0gMDtcbiAgICAgIHN0cm0uYXZhaWxfb3V0ID0gY2h1bmtTaXplO1xuICAgIH1cblxuICAgIHN0YXR1cyA9IHpsaWJfaW5mbGF0ZS5pbmZsYXRlKHN0cm0sIGMuWl9OT19GTFVTSCk7ICAgIC8qIG5vIGJhZCByZXR1cm4gdmFsdWUgKi9cblxuICAgIGlmIChzdGF0dXMgPT09IGMuWl9ORUVEX0RJQ1QgJiYgZGljdGlvbmFyeSkge1xuICAgICAgc3RhdHVzID0gemxpYl9pbmZsYXRlLmluZmxhdGVTZXREaWN0aW9uYXJ5KHRoaXMuc3RybSwgZGljdGlvbmFyeSk7XG4gICAgfVxuXG4gICAgaWYgKHN0YXR1cyA9PT0gYy5aX0JVRl9FUlJPUiAmJiBhbGxvd0J1ZkVycm9yID09PSB0cnVlKSB7XG4gICAgICBzdGF0dXMgPSBjLlpfT0s7XG4gICAgICBhbGxvd0J1ZkVycm9yID0gZmFsc2U7XG4gICAgfVxuXG4gICAgaWYgKHN0YXR1cyAhPT0gYy5aX1NUUkVBTV9FTkQgJiYgc3RhdHVzICE9PSBjLlpfT0spIHtcbiAgICAgIHRoaXMub25FbmQoc3RhdHVzKTtcbiAgICAgIHRoaXMuZW5kZWQgPSB0cnVlO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIGlmIChzdHJtLm5leHRfb3V0KSB7XG4gICAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDAgfHwgc3RhdHVzID09PSBjLlpfU1RSRUFNX0VORCB8fCAoc3RybS5hdmFpbF9pbiA9PT0gMCAmJiAoX21vZGUgPT09IGMuWl9GSU5JU0ggfHwgX21vZGUgPT09IGMuWl9TWU5DX0ZMVVNIKSkpIHtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnRvID09PSAnc3RyaW5nJykge1xuXG4gICAgICAgICAgbmV4dF9vdXRfdXRmOCA9IHN0cmluZ3MudXRmOGJvcmRlcihzdHJtLm91dHB1dCwgc3RybS5uZXh0X291dCk7XG5cbiAgICAgICAgICB0YWlsID0gc3RybS5uZXh0X291dCAtIG5leHRfb3V0X3V0Zjg7XG4gICAgICAgICAgdXRmOHN0ciA9IHN0cmluZ3MuYnVmMnN0cmluZyhzdHJtLm91dHB1dCwgbmV4dF9vdXRfdXRmOCk7XG5cbiAgICAgICAgICAvLyBtb3ZlIHRhaWxcbiAgICAgICAgICBzdHJtLm5leHRfb3V0ID0gdGFpbDtcbiAgICAgICAgICBzdHJtLmF2YWlsX291dCA9IGNodW5rU2l6ZSAtIHRhaWw7XG4gICAgICAgICAgaWYgKHRhaWwpIHsgdXRpbHMuYXJyYXlTZXQoc3RybS5vdXRwdXQsIHN0cm0ub3V0cHV0LCBuZXh0X291dF91dGY4LCB0YWlsLCAwKTsgfVxuXG4gICAgICAgICAgdGhpcy5vbkRhdGEodXRmOHN0cik7XG5cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLm9uRGF0YSh1dGlscy5zaHJpbmtCdWYoc3RybS5vdXRwdXQsIHN0cm0ubmV4dF9vdXQpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFdoZW4gbm8gbW9yZSBpbnB1dCBkYXRhLCB3ZSBzaG91bGQgY2hlY2sgdGhhdCBpbnRlcm5hbCBpbmZsYXRlIGJ1ZmZlcnNcbiAgICAvLyBhcmUgZmx1c2hlZC4gVGhlIG9ubHkgd2F5IHRvIGRvIGl0IHdoZW4gYXZhaWxfb3V0ID0gMCAtIHJ1biBvbmUgbW9yZVxuICAgIC8vIGluZmxhdGUgcGFzcy4gQnV0IGlmIG91dHB1dCBkYXRhIG5vdCBleGlzdHMsIGluZmxhdGUgcmV0dXJuIFpfQlVGX0VSUk9SLlxuICAgIC8vIEhlcmUgd2Ugc2V0IGZsYWcgdG8gcHJvY2VzcyB0aGlzIGVycm9yIHByb3Blcmx5LlxuICAgIC8vXG4gICAgLy8gTk9URS4gRGVmbGF0ZSBkb2VzIG5vdCByZXR1cm4gZXJyb3IgaW4gdGhpcyBjYXNlIGFuZCBkb2VzIG5vdCBuZWVkcyBzdWNoXG4gICAgLy8gbG9naWMuXG4gICAgaWYgKHN0cm0uYXZhaWxfaW4gPT09IDAgJiYgc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgIGFsbG93QnVmRXJyb3IgPSB0cnVlO1xuICAgIH1cblxuICB9IHdoaWxlICgoc3RybS5hdmFpbF9pbiA+IDAgfHwgc3RybS5hdmFpbF9vdXQgPT09IDApICYmIHN0YXR1cyAhPT0gYy5aX1NUUkVBTV9FTkQpO1xuXG4gIGlmIChzdGF0dXMgPT09IGMuWl9TVFJFQU1fRU5EKSB7XG4gICAgX21vZGUgPSBjLlpfRklOSVNIO1xuICB9XG5cbiAgLy8gRmluYWxpemUgb24gdGhlIGxhc3QgY2h1bmsuXG4gIGlmIChfbW9kZSA9PT0gYy5aX0ZJTklTSCkge1xuICAgIHN0YXR1cyA9IHpsaWJfaW5mbGF0ZS5pbmZsYXRlRW5kKHRoaXMuc3RybSk7XG4gICAgdGhpcy5vbkVuZChzdGF0dXMpO1xuICAgIHRoaXMuZW5kZWQgPSB0cnVlO1xuICAgIHJldHVybiBzdGF0dXMgPT09IGMuWl9PSztcbiAgfVxuXG4gIC8vIGNhbGxiYWNrIGludGVyaW0gcmVzdWx0cyBpZiBaX1NZTkNfRkxVU0guXG4gIGlmIChfbW9kZSA9PT0gYy5aX1NZTkNfRkxVU0gpIHtcbiAgICB0aGlzLm9uRW5kKGMuWl9PSyk7XG4gICAgc3RybS5hdmFpbF9vdXQgPSAwO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5cbi8qKlxuICogSW5mbGF0ZSNvbkRhdGEoY2h1bmspIC0+IFZvaWRcbiAqIC0gY2h1bmsgKFVpbnQ4QXJyYXl8QXJyYXl8U3RyaW5nKTogb3V0cHV0IGRhdGEuIFR5cGUgb2YgYXJyYXkgZGVwZW5kc1xuICogICBvbiBqcyBlbmdpbmUgc3VwcG9ydC4gV2hlbiBzdHJpbmcgb3V0cHV0IHJlcXVlc3RlZCwgZWFjaCBjaHVua1xuICogICB3aWxsIGJlIHN0cmluZy5cbiAqXG4gKiBCeSBkZWZhdWx0LCBzdG9yZXMgZGF0YSBibG9ja3MgaW4gYGNodW5rc1tdYCBwcm9wZXJ0eSBhbmQgZ2x1ZVxuICogdGhvc2UgaW4gYG9uRW5kYC4gT3ZlcnJpZGUgdGhpcyBoYW5kbGVyLCBpZiB5b3UgbmVlZCBhbm90aGVyIGJlaGF2aW91ci5cbiAqKi9cbkluZmxhdGUucHJvdG90eXBlLm9uRGF0YSA9IGZ1bmN0aW9uIChjaHVuaykge1xuICB0aGlzLmNodW5rcy5wdXNoKGNodW5rKTtcbn07XG5cblxuLyoqXG4gKiBJbmZsYXRlI29uRW5kKHN0YXR1cykgLT4gVm9pZFxuICogLSBzdGF0dXMgKE51bWJlcik6IGluZmxhdGUgc3RhdHVzLiAwIChaX09LKSBvbiBzdWNjZXNzLFxuICogICBvdGhlciBpZiBub3QuXG4gKlxuICogQ2FsbGVkIGVpdGhlciBhZnRlciB5b3UgdGVsbCBpbmZsYXRlIHRoYXQgdGhlIGlucHV0IHN0cmVhbSBpc1xuICogY29tcGxldGUgKFpfRklOSVNIKSBvciBzaG91bGQgYmUgZmx1c2hlZCAoWl9TWU5DX0ZMVVNIKVxuICogb3IgaWYgYW4gZXJyb3IgaGFwcGVuZWQuIEJ5IGRlZmF1bHQgLSBqb2luIGNvbGxlY3RlZCBjaHVua3MsXG4gKiBmcmVlIG1lbW9yeSBhbmQgZmlsbCBgcmVzdWx0c2AgLyBgZXJyYCBwcm9wZXJ0aWVzLlxuICoqL1xuSW5mbGF0ZS5wcm90b3R5cGUub25FbmQgPSBmdW5jdGlvbiAoc3RhdHVzKSB7XG4gIC8vIE9uIHN1Y2Nlc3MgLSBqb2luXG4gIGlmIChzdGF0dXMgPT09IGMuWl9PSykge1xuICAgIGlmICh0aGlzLm9wdGlvbnMudG8gPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBHbHVlICYgY29udmVydCBoZXJlLCB1bnRpbCB3ZSB0ZWFjaCBwYWtvIHRvIHNlbmRcbiAgICAgIC8vIHV0ZjggYWxpZ25lZCBzdHJpbmdzIHRvIG9uRGF0YVxuICAgICAgdGhpcy5yZXN1bHQgPSB0aGlzLmNodW5rcy5qb2luKCcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZXN1bHQgPSB1dGlscy5mbGF0dGVuQ2h1bmtzKHRoaXMuY2h1bmtzKTtcbiAgICB9XG4gIH1cbiAgdGhpcy5jaHVua3MgPSBbXTtcbiAgdGhpcy5lcnIgPSBzdGF0dXM7XG4gIHRoaXMubXNnID0gdGhpcy5zdHJtLm1zZztcbn07XG5cblxuLyoqXG4gKiBpbmZsYXRlKGRhdGFbLCBvcHRpb25zXSkgLT4gVWludDhBcnJheXxBcnJheXxTdHJpbmdcbiAqIC0gZGF0YSAoVWludDhBcnJheXxBcnJheXxTdHJpbmcpOiBpbnB1dCBkYXRhIHRvIGRlY29tcHJlc3MuXG4gKiAtIG9wdGlvbnMgKE9iamVjdCk6IHpsaWIgaW5mbGF0ZSBvcHRpb25zLlxuICpcbiAqIERlY29tcHJlc3MgYGRhdGFgIHdpdGggaW5mbGF0ZS91bmd6aXAgYW5kIGBvcHRpb25zYC4gQXV0b2RldGVjdFxuICogZm9ybWF0IHZpYSB3cmFwcGVyIGhlYWRlciBieSBkZWZhdWx0LiBUaGF0J3Mgd2h5IHdlIGRvbid0IHByb3ZpZGVcbiAqIHNlcGFyYXRlIGB1bmd6aXBgIG1ldGhvZC5cbiAqXG4gKiBTdXBwb3J0ZWQgb3B0aW9ucyBhcmU6XG4gKlxuICogLSB3aW5kb3dCaXRzXG4gKlxuICogW2h0dHA6Ly96bGliLm5ldC9tYW51YWwuaHRtbCNBZHZhbmNlZF0oaHR0cDovL3psaWIubmV0L21hbnVhbC5odG1sI0FkdmFuY2VkKVxuICogZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKlxuICogU3VnYXIgKG9wdGlvbnMpOlxuICpcbiAqIC0gYHJhd2AgKEJvb2xlYW4pIC0gc2F5IHRoYXQgd2Ugd29yayB3aXRoIHJhdyBzdHJlYW0sIGlmIHlvdSBkb24ndCB3aXNoIHRvIHNwZWNpZnlcbiAqICAgbmVnYXRpdmUgd2luZG93Qml0cyBpbXBsaWNpdGx5LlxuICogLSBgdG9gIChTdHJpbmcpIC0gaWYgZXF1YWwgdG8gJ3N0cmluZycsIHRoZW4gcmVzdWx0IHdpbGwgYmUgY29udmVydGVkXG4gKiAgIGZyb20gdXRmOCB0byB1dGYxNiAoamF2YXNjcmlwdCkgc3RyaW5nLiBXaGVuIHN0cmluZyBvdXRwdXQgcmVxdWVzdGVkLFxuICogICBjaHVuayBsZW5ndGggY2FuIGRpZmZlciBmcm9tIGBjaHVua1NpemVgLCBkZXBlbmRpbmcgb24gY29udGVudC5cbiAqXG4gKlxuICogIyMjIyMgRXhhbXBsZTpcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgcGFrbyA9IHJlcXVpcmUoJ3Bha28nKVxuICogICAsIGlucHV0ID0gcGFrby5kZWZsYXRlKFsxLDIsMyw0LDUsNiw3LDgsOV0pXG4gKiAgICwgb3V0cHV0O1xuICpcbiAqIHRyeSB7XG4gKiAgIG91dHB1dCA9IHBha28uaW5mbGF0ZShpbnB1dCk7XG4gKiB9IGNhdGNoIChlcnIpXG4gKiAgIGNvbnNvbGUubG9nKGVycik7XG4gKiB9XG4gKiBgYGBcbiAqKi9cbmZ1bmN0aW9uIGluZmxhdGUoaW5wdXQsIG9wdGlvbnMpIHtcbiAgdmFyIGluZmxhdG9yID0gbmV3IEluZmxhdGUob3B0aW9ucyk7XG5cbiAgaW5mbGF0b3IucHVzaChpbnB1dCwgdHJ1ZSk7XG5cbiAgLy8gVGhhdCB3aWxsIG5ldmVyIGhhcHBlbnMsIGlmIHlvdSBkb24ndCBjaGVhdCB3aXRoIG9wdGlvbnMgOilcbiAgaWYgKGluZmxhdG9yLmVycikgeyB0aHJvdyBpbmZsYXRvci5tc2cgfHwgbXNnW2luZmxhdG9yLmVycl07IH1cblxuICByZXR1cm4gaW5mbGF0b3IucmVzdWx0O1xufVxuXG5cbi8qKlxuICogaW5mbGF0ZVJhdyhkYXRhWywgb3B0aW9uc10pIC0+IFVpbnQ4QXJyYXl8QXJyYXl8U3RyaW5nXG4gKiAtIGRhdGEgKFVpbnQ4QXJyYXl8QXJyYXl8U3RyaW5nKTogaW5wdXQgZGF0YSB0byBkZWNvbXByZXNzLlxuICogLSBvcHRpb25zIChPYmplY3QpOiB6bGliIGluZmxhdGUgb3B0aW9ucy5cbiAqXG4gKiBUaGUgc2FtZSBhcyBbW2luZmxhdGVdXSwgYnV0IGNyZWF0ZXMgcmF3IGRhdGEsIHdpdGhvdXQgd3JhcHBlclxuICogKGhlYWRlciBhbmQgYWRsZXIzMiBjcmMpLlxuICoqL1xuZnVuY3Rpb24gaW5mbGF0ZVJhdyhpbnB1dCwgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgb3B0aW9ucy5yYXcgPSB0cnVlO1xuICByZXR1cm4gaW5mbGF0ZShpbnB1dCwgb3B0aW9ucyk7XG59XG5cblxuLyoqXG4gKiB1bmd6aXAoZGF0YVssIG9wdGlvbnNdKSAtPiBVaW50OEFycmF5fEFycmF5fFN0cmluZ1xuICogLSBkYXRhIChVaW50OEFycmF5fEFycmF5fFN0cmluZyk6IGlucHV0IGRhdGEgdG8gZGVjb21wcmVzcy5cbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogemxpYiBpbmZsYXRlIG9wdGlvbnMuXG4gKlxuICogSnVzdCBzaG9ydGN1dCB0byBbW2luZmxhdGVdXSwgYmVjYXVzZSBpdCBhdXRvZGV0ZWN0cyBmb3JtYXRcbiAqIGJ5IGhlYWRlci5jb250ZW50LiBEb25lIGZvciBjb252ZW5pZW5jZS5cbiAqKi9cblxuXG5leHBvcnRzLkluZmxhdGUgPSBJbmZsYXRlO1xuZXhwb3J0cy5pbmZsYXRlID0gaW5mbGF0ZTtcbmV4cG9ydHMuaW5mbGF0ZVJhdyA9IGluZmxhdGVSYXc7XG5leHBvcnRzLnVuZ3ppcCAgPSBpbmZsYXRlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbnZhciBUWVBFRF9PSyA9ICAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKSAmJlxuICAgICAgICAgICAgICAgICh0eXBlb2YgVWludDE2QXJyYXkgIT09ICd1bmRlZmluZWQnKSAmJlxuICAgICAgICAgICAgICAgICh0eXBlb2YgSW50MzJBcnJheSAhPT0gJ3VuZGVmaW5lZCcpO1xuXG5mdW5jdGlvbiBfaGFzKG9iaiwga2V5KSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xufVxuXG5leHBvcnRzLmFzc2lnbiA9IGZ1bmN0aW9uIChvYmogLypmcm9tMSwgZnJvbTIsIGZyb20zLCAuLi4qLykge1xuICB2YXIgc291cmNlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gIHdoaWxlIChzb3VyY2VzLmxlbmd0aCkge1xuICAgIHZhciBzb3VyY2UgPSBzb3VyY2VzLnNoaWZ0KCk7XG4gICAgaWYgKCFzb3VyY2UpIHsgY29udGludWU7IH1cblxuICAgIGlmICh0eXBlb2Ygc291cmNlICE9PSAnb2JqZWN0Jykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzb3VyY2UgKyAnbXVzdCBiZSBub24tb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcCBpbiBzb3VyY2UpIHtcbiAgICAgIGlmIChfaGFzKHNvdXJjZSwgcCkpIHtcbiAgICAgICAgb2JqW3BdID0gc291cmNlW3BdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBvYmo7XG59O1xuXG5cbi8vIHJlZHVjZSBidWZmZXIgc2l6ZSwgYXZvaWRpbmcgbWVtIGNvcHlcbmV4cG9ydHMuc2hyaW5rQnVmID0gZnVuY3Rpb24gKGJ1Ziwgc2l6ZSkge1xuICBpZiAoYnVmLmxlbmd0aCA9PT0gc2l6ZSkgeyByZXR1cm4gYnVmOyB9XG4gIGlmIChidWYuc3ViYXJyYXkpIHsgcmV0dXJuIGJ1Zi5zdWJhcnJheSgwLCBzaXplKTsgfVxuICBidWYubGVuZ3RoID0gc2l6ZTtcbiAgcmV0dXJuIGJ1Zjtcbn07XG5cblxudmFyIGZuVHlwZWQgPSB7XG4gIGFycmF5U2V0OiBmdW5jdGlvbiAoZGVzdCwgc3JjLCBzcmNfb2ZmcywgbGVuLCBkZXN0X29mZnMpIHtcbiAgICBpZiAoc3JjLnN1YmFycmF5ICYmIGRlc3Quc3ViYXJyYXkpIHtcbiAgICAgIGRlc3Quc2V0KHNyYy5zdWJhcnJheShzcmNfb2Zmcywgc3JjX29mZnMgKyBsZW4pLCBkZXN0X29mZnMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBGYWxsYmFjayB0byBvcmRpbmFyeSBhcnJheVxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGRlc3RbZGVzdF9vZmZzICsgaV0gPSBzcmNbc3JjX29mZnMgKyBpXTtcbiAgICB9XG4gIH0sXG4gIC8vIEpvaW4gYXJyYXkgb2YgY2h1bmtzIHRvIHNpbmdsZSBhcnJheS5cbiAgZmxhdHRlbkNodW5rczogZnVuY3Rpb24gKGNodW5rcykge1xuICAgIHZhciBpLCBsLCBsZW4sIHBvcywgY2h1bmssIHJlc3VsdDtcblxuICAgIC8vIGNhbGN1bGF0ZSBkYXRhIGxlbmd0aFxuICAgIGxlbiA9IDA7XG4gICAgZm9yIChpID0gMCwgbCA9IGNodW5rcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGxlbiArPSBjaHVua3NbaV0ubGVuZ3RoO1xuICAgIH1cblxuICAgIC8vIGpvaW4gY2h1bmtzXG4gICAgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkobGVuKTtcbiAgICBwb3MgPSAwO1xuICAgIGZvciAoaSA9IDAsIGwgPSBjaHVua3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBjaHVuayA9IGNodW5rc1tpXTtcbiAgICAgIHJlc3VsdC5zZXQoY2h1bmssIHBvcyk7XG4gICAgICBwb3MgKz0gY2h1bmsubGVuZ3RoO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbn07XG5cbnZhciBmblVudHlwZWQgPSB7XG4gIGFycmF5U2V0OiBmdW5jdGlvbiAoZGVzdCwgc3JjLCBzcmNfb2ZmcywgbGVuLCBkZXN0X29mZnMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBkZXN0W2Rlc3Rfb2ZmcyArIGldID0gc3JjW3NyY19vZmZzICsgaV07XG4gICAgfVxuICB9LFxuICAvLyBKb2luIGFycmF5IG9mIGNodW5rcyB0byBzaW5nbGUgYXJyYXkuXG4gIGZsYXR0ZW5DaHVua3M6IGZ1bmN0aW9uIChjaHVua3MpIHtcbiAgICByZXR1cm4gW10uY29uY2F0LmFwcGx5KFtdLCBjaHVua3MpO1xuICB9XG59O1xuXG5cbi8vIEVuYWJsZS9EaXNhYmxlIHR5cGVkIGFycmF5cyB1c2UsIGZvciB0ZXN0aW5nXG4vL1xuZXhwb3J0cy5zZXRUeXBlZCA9IGZ1bmN0aW9uIChvbikge1xuICBpZiAob24pIHtcbiAgICBleHBvcnRzLkJ1ZjggID0gVWludDhBcnJheTtcbiAgICBleHBvcnRzLkJ1ZjE2ID0gVWludDE2QXJyYXk7XG4gICAgZXhwb3J0cy5CdWYzMiA9IEludDMyQXJyYXk7XG4gICAgZXhwb3J0cy5hc3NpZ24oZXhwb3J0cywgZm5UeXBlZCk7XG4gIH0gZWxzZSB7XG4gICAgZXhwb3J0cy5CdWY4ICA9IEFycmF5O1xuICAgIGV4cG9ydHMuQnVmMTYgPSBBcnJheTtcbiAgICBleHBvcnRzLkJ1ZjMyID0gQXJyYXk7XG4gICAgZXhwb3J0cy5hc3NpZ24oZXhwb3J0cywgZm5VbnR5cGVkKTtcbiAgfVxufTtcblxuZXhwb3J0cy5zZXRUeXBlZChUWVBFRF9PSyk7XG4iLCIvLyBTdHJpbmcgZW5jb2RlL2RlY29kZSBoZWxwZXJzXG4ndXNlIHN0cmljdCc7XG5cblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi9jb21tb24nKTtcblxuXG4vLyBRdWljayBjaGVjayBpZiB3ZSBjYW4gdXNlIGZhc3QgYXJyYXkgdG8gYmluIHN0cmluZyBjb252ZXJzaW9uXG4vL1xuLy8gLSBhcHBseShBcnJheSkgY2FuIGZhaWwgb24gQW5kcm9pZCAyLjJcbi8vIC0gYXBwbHkoVWludDhBcnJheSkgY2FuIGZhaWwgb24gaU9TIDUuMSBTYWZhcmlcbi8vXG52YXIgU1RSX0FQUExZX09LID0gdHJ1ZTtcbnZhciBTVFJfQVBQTFlfVUlBX09LID0gdHJ1ZTtcblxudHJ5IHsgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShudWxsLCBbIDAgXSk7IH0gY2F0Y2ggKF9fKSB7IFNUUl9BUFBMWV9PSyA9IGZhbHNlOyB9XG50cnkgeyBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIG5ldyBVaW50OEFycmF5KDEpKTsgfSBjYXRjaCAoX18pIHsgU1RSX0FQUExZX1VJQV9PSyA9IGZhbHNlOyB9XG5cblxuLy8gVGFibGUgd2l0aCB1dGY4IGxlbmd0aHMgKGNhbGN1bGF0ZWQgYnkgZmlyc3QgYnl0ZSBvZiBzZXF1ZW5jZSlcbi8vIE5vdGUsIHRoYXQgNSAmIDYtYnl0ZSB2YWx1ZXMgYW5kIHNvbWUgNC1ieXRlIHZhbHVlcyBjYW4gbm90IGJlIHJlcHJlc2VudGVkIGluIEpTLFxuLy8gYmVjYXVzZSBtYXggcG9zc2libGUgY29kZXBvaW50IGlzIDB4MTBmZmZmXG52YXIgX3V0ZjhsZW4gPSBuZXcgdXRpbHMuQnVmOCgyNTYpO1xuZm9yICh2YXIgcSA9IDA7IHEgPCAyNTY7IHErKykge1xuICBfdXRmOGxlbltxXSA9IChxID49IDI1MiA/IDYgOiBxID49IDI0OCA/IDUgOiBxID49IDI0MCA/IDQgOiBxID49IDIyNCA/IDMgOiBxID49IDE5MiA/IDIgOiAxKTtcbn1cbl91dGY4bGVuWzI1NF0gPSBfdXRmOGxlblsyNTRdID0gMTsgLy8gSW52YWxpZCBzZXF1ZW5jZSBzdGFydFxuXG5cbi8vIGNvbnZlcnQgc3RyaW5nIHRvIGFycmF5ICh0eXBlZCwgd2hlbiBwb3NzaWJsZSlcbmV4cG9ydHMuc3RyaW5nMmJ1ZiA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgdmFyIGJ1ZiwgYywgYzIsIG1fcG9zLCBpLCBzdHJfbGVuID0gc3RyLmxlbmd0aCwgYnVmX2xlbiA9IDA7XG5cbiAgLy8gY291bnQgYmluYXJ5IHNpemVcbiAgZm9yIChtX3BvcyA9IDA7IG1fcG9zIDwgc3RyX2xlbjsgbV9wb3MrKykge1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChtX3Bvcyk7XG4gICAgaWYgKChjICYgMHhmYzAwKSA9PT0gMHhkODAwICYmIChtX3BvcyArIDEgPCBzdHJfbGVuKSkge1xuICAgICAgYzIgPSBzdHIuY2hhckNvZGVBdChtX3BvcyArIDEpO1xuICAgICAgaWYgKChjMiAmIDB4ZmMwMCkgPT09IDB4ZGMwMCkge1xuICAgICAgICBjID0gMHgxMDAwMCArICgoYyAtIDB4ZDgwMCkgPDwgMTApICsgKGMyIC0gMHhkYzAwKTtcbiAgICAgICAgbV9wb3MrKztcbiAgICAgIH1cbiAgICB9XG4gICAgYnVmX2xlbiArPSBjIDwgMHg4MCA/IDEgOiBjIDwgMHg4MDAgPyAyIDogYyA8IDB4MTAwMDAgPyAzIDogNDtcbiAgfVxuXG4gIC8vIGFsbG9jYXRlIGJ1ZmZlclxuICBidWYgPSBuZXcgdXRpbHMuQnVmOChidWZfbGVuKTtcblxuICAvLyBjb252ZXJ0XG4gIGZvciAoaSA9IDAsIG1fcG9zID0gMDsgaSA8IGJ1Zl9sZW47IG1fcG9zKyspIHtcbiAgICBjID0gc3RyLmNoYXJDb2RlQXQobV9wb3MpO1xuICAgIGlmICgoYyAmIDB4ZmMwMCkgPT09IDB4ZDgwMCAmJiAobV9wb3MgKyAxIDwgc3RyX2xlbikpIHtcbiAgICAgIGMyID0gc3RyLmNoYXJDb2RlQXQobV9wb3MgKyAxKTtcbiAgICAgIGlmICgoYzIgJiAweGZjMDApID09PSAweGRjMDApIHtcbiAgICAgICAgYyA9IDB4MTAwMDAgKyAoKGMgLSAweGQ4MDApIDw8IDEwKSArIChjMiAtIDB4ZGMwMCk7XG4gICAgICAgIG1fcG9zKys7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjIDwgMHg4MCkge1xuICAgICAgLyogb25lIGJ5dGUgKi9cbiAgICAgIGJ1ZltpKytdID0gYztcbiAgICB9IGVsc2UgaWYgKGMgPCAweDgwMCkge1xuICAgICAgLyogdHdvIGJ5dGVzICovXG4gICAgICBidWZbaSsrXSA9IDB4QzAgfCAoYyA+Pj4gNik7XG4gICAgICBidWZbaSsrXSA9IDB4ODAgfCAoYyAmIDB4M2YpO1xuICAgIH0gZWxzZSBpZiAoYyA8IDB4MTAwMDApIHtcbiAgICAgIC8qIHRocmVlIGJ5dGVzICovXG4gICAgICBidWZbaSsrXSA9IDB4RTAgfCAoYyA+Pj4gMTIpO1xuICAgICAgYnVmW2krK10gPSAweDgwIHwgKGMgPj4+IDYgJiAweDNmKTtcbiAgICAgIGJ1ZltpKytdID0gMHg4MCB8IChjICYgMHgzZik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qIGZvdXIgYnl0ZXMgKi9cbiAgICAgIGJ1ZltpKytdID0gMHhmMCB8IChjID4+PiAxOCk7XG4gICAgICBidWZbaSsrXSA9IDB4ODAgfCAoYyA+Pj4gMTIgJiAweDNmKTtcbiAgICAgIGJ1ZltpKytdID0gMHg4MCB8IChjID4+PiA2ICYgMHgzZik7XG4gICAgICBidWZbaSsrXSA9IDB4ODAgfCAoYyAmIDB4M2YpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWY7XG59O1xuXG4vLyBIZWxwZXIgKHVzZWQgaW4gMiBwbGFjZXMpXG5mdW5jdGlvbiBidWYyYmluc3RyaW5nKGJ1ZiwgbGVuKSB7XG4gIC8vIE9uIENocm9tZSwgdGhlIGFyZ3VtZW50cyBpbiBhIGZ1bmN0aW9uIGNhbGwgdGhhdCBhcmUgYWxsb3dlZCBpcyBgNjU1MzRgLlxuICAvLyBJZiB0aGUgbGVuZ3RoIG9mIHRoZSBidWZmZXIgaXMgc21hbGxlciB0aGFuIHRoYXQsIHdlIGNhbiB1c2UgdGhpcyBvcHRpbWl6YXRpb24sXG4gIC8vIG90aGVyd2lzZSB3ZSB3aWxsIHRha2UgYSBzbG93ZXIgcGF0aC5cbiAgaWYgKGxlbiA8IDY1NTM0KSB7XG4gICAgaWYgKChidWYuc3ViYXJyYXkgJiYgU1RSX0FQUExZX1VJQV9PSykgfHwgKCFidWYuc3ViYXJyYXkgJiYgU1RSX0FQUExZX09LKSkge1xuICAgICAgcmV0dXJuIFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgdXRpbHMuc2hyaW5rQnVmKGJ1ZiwgbGVuKSk7XG4gICAgfVxuICB9XG5cbiAgdmFyIHJlc3VsdCA9ICcnO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgcmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5cbi8vIENvbnZlcnQgYnl0ZSBhcnJheSB0byBiaW5hcnkgc3RyaW5nXG5leHBvcnRzLmJ1ZjJiaW5zdHJpbmcgPSBmdW5jdGlvbiAoYnVmKSB7XG4gIHJldHVybiBidWYyYmluc3RyaW5nKGJ1ZiwgYnVmLmxlbmd0aCk7XG59O1xuXG5cbi8vIENvbnZlcnQgYmluYXJ5IHN0cmluZyAodHlwZWQsIHdoZW4gcG9zc2libGUpXG5leHBvcnRzLmJpbnN0cmluZzJidWYgPSBmdW5jdGlvbiAoc3RyKSB7XG4gIHZhciBidWYgPSBuZXcgdXRpbHMuQnVmOChzdHIubGVuZ3RoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGJ1Zi5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIGJ1ZltpXSA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICB9XG4gIHJldHVybiBidWY7XG59O1xuXG5cbi8vIGNvbnZlcnQgYXJyYXkgdG8gc3RyaW5nXG5leHBvcnRzLmJ1ZjJzdHJpbmcgPSBmdW5jdGlvbiAoYnVmLCBtYXgpIHtcbiAgdmFyIGksIG91dCwgYywgY19sZW47XG4gIHZhciBsZW4gPSBtYXggfHwgYnVmLmxlbmd0aDtcblxuICAvLyBSZXNlcnZlIG1heCBwb3NzaWJsZSBsZW5ndGggKDIgd29yZHMgcGVyIGNoYXIpXG4gIC8vIE5COiBieSB1bmtub3duIHJlYXNvbnMsIEFycmF5IGlzIHNpZ25pZmljYW50bHkgZmFzdGVyIGZvclxuICAvLyAgICAgU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseSB0aGFuIFVpbnQxNkFycmF5LlxuICB2YXIgdXRmMTZidWYgPSBuZXcgQXJyYXkobGVuICogMik7XG5cbiAgZm9yIChvdXQgPSAwLCBpID0gMDsgaSA8IGxlbjspIHtcbiAgICBjID0gYnVmW2krK107XG4gICAgLy8gcXVpY2sgcHJvY2VzcyBhc2NpaVxuICAgIGlmIChjIDwgMHg4MCkgeyB1dGYxNmJ1ZltvdXQrK10gPSBjOyBjb250aW51ZTsgfVxuXG4gICAgY19sZW4gPSBfdXRmOGxlbltjXTtcbiAgICAvLyBza2lwIDUgJiA2IGJ5dGUgY29kZXNcbiAgICBpZiAoY19sZW4gPiA0KSB7IHV0ZjE2YnVmW291dCsrXSA9IDB4ZmZmZDsgaSArPSBjX2xlbiAtIDE7IGNvbnRpbnVlOyB9XG5cbiAgICAvLyBhcHBseSBtYXNrIG9uIGZpcnN0IGJ5dGVcbiAgICBjICY9IGNfbGVuID09PSAyID8gMHgxZiA6IGNfbGVuID09PSAzID8gMHgwZiA6IDB4MDc7XG4gICAgLy8gam9pbiB0aGUgcmVzdFxuICAgIHdoaWxlIChjX2xlbiA+IDEgJiYgaSA8IGxlbikge1xuICAgICAgYyA9IChjIDw8IDYpIHwgKGJ1ZltpKytdICYgMHgzZik7XG4gICAgICBjX2xlbi0tO1xuICAgIH1cblxuICAgIC8vIHRlcm1pbmF0ZWQgYnkgZW5kIG9mIHN0cmluZz9cbiAgICBpZiAoY19sZW4gPiAxKSB7IHV0ZjE2YnVmW291dCsrXSA9IDB4ZmZmZDsgY29udGludWU7IH1cblxuICAgIGlmIChjIDwgMHgxMDAwMCkge1xuICAgICAgdXRmMTZidWZbb3V0KytdID0gYztcbiAgICB9IGVsc2Uge1xuICAgICAgYyAtPSAweDEwMDAwO1xuICAgICAgdXRmMTZidWZbb3V0KytdID0gMHhkODAwIHwgKChjID4+IDEwKSAmIDB4M2ZmKTtcbiAgICAgIHV0ZjE2YnVmW291dCsrXSA9IDB4ZGMwMCB8IChjICYgMHgzZmYpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBidWYyYmluc3RyaW5nKHV0ZjE2YnVmLCBvdXQpO1xufTtcblxuXG4vLyBDYWxjdWxhdGUgbWF4IHBvc3NpYmxlIHBvc2l0aW9uIGluIHV0ZjggYnVmZmVyLFxuLy8gdGhhdCB3aWxsIG5vdCBicmVhayBzZXF1ZW5jZS4gSWYgdGhhdCdzIG5vdCBwb3NzaWJsZVxuLy8gLSAodmVyeSBzbWFsbCBsaW1pdHMpIHJldHVybiBtYXggc2l6ZSBhcyBpcy5cbi8vXG4vLyBidWZbXSAtIHV0ZjggYnl0ZXMgYXJyYXlcbi8vIG1heCAgIC0gbGVuZ3RoIGxpbWl0IChtYW5kYXRvcnkpO1xuZXhwb3J0cy51dGY4Ym9yZGVyID0gZnVuY3Rpb24gKGJ1ZiwgbWF4KSB7XG4gIHZhciBwb3M7XG5cbiAgbWF4ID0gbWF4IHx8IGJ1Zi5sZW5ndGg7XG4gIGlmIChtYXggPiBidWYubGVuZ3RoKSB7IG1heCA9IGJ1Zi5sZW5ndGg7IH1cblxuICAvLyBnbyBiYWNrIGZyb20gbGFzdCBwb3NpdGlvbiwgdW50aWwgc3RhcnQgb2Ygc2VxdWVuY2UgZm91bmRcbiAgcG9zID0gbWF4IC0gMTtcbiAgd2hpbGUgKHBvcyA+PSAwICYmIChidWZbcG9zXSAmIDB4QzApID09PSAweDgwKSB7IHBvcy0tOyB9XG5cbiAgLy8gVmVyeSBzbWFsbCBhbmQgYnJva2VuIHNlcXVlbmNlLFxuICAvLyByZXR1cm4gbWF4LCBiZWNhdXNlIHdlIHNob3VsZCByZXR1cm4gc29tZXRoaW5nIGFueXdheS5cbiAgaWYgKHBvcyA8IDApIHsgcmV0dXJuIG1heDsgfVxuXG4gIC8vIElmIHdlIGNhbWUgdG8gc3RhcnQgb2YgYnVmZmVyIC0gdGhhdCBtZWFucyBidWZmZXIgaXMgdG9vIHNtYWxsLFxuICAvLyByZXR1cm4gbWF4IHRvby5cbiAgaWYgKHBvcyA9PT0gMCkgeyByZXR1cm4gbWF4OyB9XG5cbiAgcmV0dXJuIChwb3MgKyBfdXRmOGxlbltidWZbcG9zXV0gPiBtYXgpID8gcG9zIDogbWF4O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gTm90ZTogYWRsZXIzMiB0YWtlcyAxMiUgZm9yIGxldmVsIDAgYW5kIDIlIGZvciBsZXZlbCA2LlxuLy8gSXQgaXNuJ3Qgd29ydGggaXQgdG8gbWFrZSBhZGRpdGlvbmFsIG9wdGltaXphdGlvbnMgYXMgaW4gb3JpZ2luYWwuXG4vLyBTbWFsbCBzaXplIGlzIHByZWZlcmFibGUuXG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuZnVuY3Rpb24gYWRsZXIzMihhZGxlciwgYnVmLCBsZW4sIHBvcykge1xuICB2YXIgczEgPSAoYWRsZXIgJiAweGZmZmYpIHwwLFxuICAgICAgczIgPSAoKGFkbGVyID4+PiAxNikgJiAweGZmZmYpIHwwLFxuICAgICAgbiA9IDA7XG5cbiAgd2hpbGUgKGxlbiAhPT0gMCkge1xuICAgIC8vIFNldCBsaW1pdCB+IHR3aWNlIGxlc3MgdGhhbiA1NTUyLCB0byBrZWVwXG4gICAgLy8gczIgaW4gMzEtYml0cywgYmVjYXVzZSB3ZSBmb3JjZSBzaWduZWQgaW50cy5cbiAgICAvLyBpbiBvdGhlciBjYXNlICU9IHdpbGwgZmFpbC5cbiAgICBuID0gbGVuID4gMjAwMCA/IDIwMDAgOiBsZW47XG4gICAgbGVuIC09IG47XG5cbiAgICBkbyB7XG4gICAgICBzMSA9IChzMSArIGJ1Zltwb3MrK10pIHwwO1xuICAgICAgczIgPSAoczIgKyBzMSkgfDA7XG4gICAgfSB3aGlsZSAoLS1uKTtcblxuICAgIHMxICU9IDY1NTIxO1xuICAgIHMyICU9IDY1NTIxO1xuICB9XG5cbiAgcmV0dXJuIChzMSB8IChzMiA8PCAxNikpIHwwO1xufVxuXG5cbm1vZHVsZS5leHBvcnRzID0gYWRsZXIzMjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcblxuICAvKiBBbGxvd2VkIGZsdXNoIHZhbHVlczsgc2VlIGRlZmxhdGUoKSBhbmQgaW5mbGF0ZSgpIGJlbG93IGZvciBkZXRhaWxzICovXG4gIFpfTk9fRkxVU0g6ICAgICAgICAgMCxcbiAgWl9QQVJUSUFMX0ZMVVNIOiAgICAxLFxuICBaX1NZTkNfRkxVU0g6ICAgICAgIDIsXG4gIFpfRlVMTF9GTFVTSDogICAgICAgMyxcbiAgWl9GSU5JU0g6ICAgICAgICAgICA0LFxuICBaX0JMT0NLOiAgICAgICAgICAgIDUsXG4gIFpfVFJFRVM6ICAgICAgICAgICAgNixcblxuICAvKiBSZXR1cm4gY29kZXMgZm9yIHRoZSBjb21wcmVzc2lvbi9kZWNvbXByZXNzaW9uIGZ1bmN0aW9ucy4gTmVnYXRpdmUgdmFsdWVzXG4gICogYXJlIGVycm9ycywgcG9zaXRpdmUgdmFsdWVzIGFyZSB1c2VkIGZvciBzcGVjaWFsIGJ1dCBub3JtYWwgZXZlbnRzLlxuICAqL1xuICBaX09LOiAgICAgICAgICAgICAgIDAsXG4gIFpfU1RSRUFNX0VORDogICAgICAgMSxcbiAgWl9ORUVEX0RJQ1Q6ICAgICAgICAyLFxuICBaX0VSUk5POiAgICAgICAgICAgLTEsXG4gIFpfU1RSRUFNX0VSUk9SOiAgICAtMixcbiAgWl9EQVRBX0VSUk9SOiAgICAgIC0zLFxuICAvL1pfTUVNX0VSUk9SOiAgICAgLTQsXG4gIFpfQlVGX0VSUk9SOiAgICAgICAtNSxcbiAgLy9aX1ZFUlNJT05fRVJST1I6IC02LFxuXG4gIC8qIGNvbXByZXNzaW9uIGxldmVscyAqL1xuICBaX05PX0NPTVBSRVNTSU9OOiAgICAgICAgIDAsXG4gIFpfQkVTVF9TUEVFRDogICAgICAgICAgICAgMSxcbiAgWl9CRVNUX0NPTVBSRVNTSU9OOiAgICAgICA5LFxuICBaX0RFRkFVTFRfQ09NUFJFU1NJT046ICAgLTEsXG5cblxuICBaX0ZJTFRFUkVEOiAgICAgICAgICAgICAgIDEsXG4gIFpfSFVGRk1BTl9PTkxZOiAgICAgICAgICAgMixcbiAgWl9STEU6ICAgICAgICAgICAgICAgICAgICAzLFxuICBaX0ZJWEVEOiAgICAgICAgICAgICAgICAgIDQsXG4gIFpfREVGQVVMVF9TVFJBVEVHWTogICAgICAgMCxcblxuICAvKiBQb3NzaWJsZSB2YWx1ZXMgb2YgdGhlIGRhdGFfdHlwZSBmaWVsZCAodGhvdWdoIHNlZSBpbmZsYXRlKCkpICovXG4gIFpfQklOQVJZOiAgICAgICAgICAgICAgICAgMCxcbiAgWl9URVhUOiAgICAgICAgICAgICAgICAgICAxLFxuICAvL1pfQVNDSUk6ICAgICAgICAgICAgICAgIDEsIC8vID0gWl9URVhUIChkZXByZWNhdGVkKVxuICBaX1VOS05PV046ICAgICAgICAgICAgICAgIDIsXG5cbiAgLyogVGhlIGRlZmxhdGUgY29tcHJlc3Npb24gbWV0aG9kICovXG4gIFpfREVGTEFURUQ6ICAgICAgICAgICAgICAgOFxuICAvL1pfTlVMTDogICAgICAgICAgICAgICAgIG51bGwgLy8gVXNlIC0xIG9yIG51bGwgaW5saW5lLCBkZXBlbmRpbmcgb24gdmFyIHR5cGVcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIE5vdGU6IHdlIGNhbid0IGdldCBzaWduaWZpY2FudCBzcGVlZCBib29zdCBoZXJlLlxuLy8gU28gd3JpdGUgY29kZSB0byBtaW5pbWl6ZSBzaXplIC0gbm8gcHJlZ2VuZXJhdGVkIHRhYmxlc1xuLy8gYW5kIGFycmF5IHRvb2xzIGRlcGVuZGVuY2llcy5cblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG4vLyBVc2Ugb3JkaW5hcnkgYXJyYXksIHNpbmNlIHVudHlwZWQgbWFrZXMgbm8gYm9vc3QgaGVyZVxuZnVuY3Rpb24gbWFrZVRhYmxlKCkge1xuICB2YXIgYywgdGFibGUgPSBbXTtcblxuICBmb3IgKHZhciBuID0gMDsgbiA8IDI1NjsgbisrKSB7XG4gICAgYyA9IG47XG4gICAgZm9yICh2YXIgayA9IDA7IGsgPCA4OyBrKyspIHtcbiAgICAgIGMgPSAoKGMgJiAxKSA/ICgweEVEQjg4MzIwIF4gKGMgPj4+IDEpKSA6IChjID4+PiAxKSk7XG4gICAgfVxuICAgIHRhYmxlW25dID0gYztcbiAgfVxuXG4gIHJldHVybiB0YWJsZTtcbn1cblxuLy8gQ3JlYXRlIHRhYmxlIG9uIGxvYWQuIEp1c3QgMjU1IHNpZ25lZCBsb25ncy4gTm90IGEgcHJvYmxlbS5cbnZhciBjcmNUYWJsZSA9IG1ha2VUYWJsZSgpO1xuXG5cbmZ1bmN0aW9uIGNyYzMyKGNyYywgYnVmLCBsZW4sIHBvcykge1xuICB2YXIgdCA9IGNyY1RhYmxlLFxuICAgICAgZW5kID0gcG9zICsgbGVuO1xuXG4gIGNyYyBePSAtMTtcblxuICBmb3IgKHZhciBpID0gcG9zOyBpIDwgZW5kOyBpKyspIHtcbiAgICBjcmMgPSAoY3JjID4+PiA4KSBeIHRbKGNyYyBeIGJ1ZltpXSkgJiAweEZGXTtcbiAgfVxuXG4gIHJldHVybiAoY3JjIF4gKC0xKSk7IC8vID4+PiAwO1xufVxuXG5cbm1vZHVsZS5leHBvcnRzID0gY3JjMzI7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxudmFyIHV0aWxzICAgPSByZXF1aXJlKCcuLi91dGlscy9jb21tb24nKTtcbnZhciB0cmVlcyAgID0gcmVxdWlyZSgnLi90cmVlcycpO1xudmFyIGFkbGVyMzIgPSByZXF1aXJlKCcuL2FkbGVyMzInKTtcbnZhciBjcmMzMiAgID0gcmVxdWlyZSgnLi9jcmMzMicpO1xudmFyIG1zZyAgICAgPSByZXF1aXJlKCcuL21lc3NhZ2VzJyk7XG5cbi8qIFB1YmxpYyBjb25zdGFudHMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5cbi8qIEFsbG93ZWQgZmx1c2ggdmFsdWVzOyBzZWUgZGVmbGF0ZSgpIGFuZCBpbmZsYXRlKCkgYmVsb3cgZm9yIGRldGFpbHMgKi9cbnZhciBaX05PX0ZMVVNIICAgICAgPSAwO1xudmFyIFpfUEFSVElBTF9GTFVTSCA9IDE7XG4vL3ZhciBaX1NZTkNfRkxVU0ggICAgPSAyO1xudmFyIFpfRlVMTF9GTFVTSCAgICA9IDM7XG52YXIgWl9GSU5JU0ggICAgICAgID0gNDtcbnZhciBaX0JMT0NLICAgICAgICAgPSA1O1xuLy92YXIgWl9UUkVFUyAgICAgICAgID0gNjtcblxuXG4vKiBSZXR1cm4gY29kZXMgZm9yIHRoZSBjb21wcmVzc2lvbi9kZWNvbXByZXNzaW9uIGZ1bmN0aW9ucy4gTmVnYXRpdmUgdmFsdWVzXG4gKiBhcmUgZXJyb3JzLCBwb3NpdGl2ZSB2YWx1ZXMgYXJlIHVzZWQgZm9yIHNwZWNpYWwgYnV0IG5vcm1hbCBldmVudHMuXG4gKi9cbnZhciBaX09LICAgICAgICAgICAgPSAwO1xudmFyIFpfU1RSRUFNX0VORCAgICA9IDE7XG4vL3ZhciBaX05FRURfRElDVCAgICAgPSAyO1xuLy92YXIgWl9FUlJOTyAgICAgICAgID0gLTE7XG52YXIgWl9TVFJFQU1fRVJST1IgID0gLTI7XG52YXIgWl9EQVRBX0VSUk9SICAgID0gLTM7XG4vL3ZhciBaX01FTV9FUlJPUiAgICAgPSAtNDtcbnZhciBaX0JVRl9FUlJPUiAgICAgPSAtNTtcbi8vdmFyIFpfVkVSU0lPTl9FUlJPUiA9IC02O1xuXG5cbi8qIGNvbXByZXNzaW9uIGxldmVscyAqL1xuLy92YXIgWl9OT19DT01QUkVTU0lPTiAgICAgID0gMDtcbi8vdmFyIFpfQkVTVF9TUEVFRCAgICAgICAgICA9IDE7XG4vL3ZhciBaX0JFU1RfQ09NUFJFU1NJT04gICAgPSA5O1xudmFyIFpfREVGQVVMVF9DT01QUkVTU0lPTiA9IC0xO1xuXG5cbnZhciBaX0ZJTFRFUkVEICAgICAgICAgICAgPSAxO1xudmFyIFpfSFVGRk1BTl9PTkxZICAgICAgICA9IDI7XG52YXIgWl9STEUgICAgICAgICAgICAgICAgID0gMztcbnZhciBaX0ZJWEVEICAgICAgICAgICAgICAgPSA0O1xudmFyIFpfREVGQVVMVF9TVFJBVEVHWSAgICA9IDA7XG5cbi8qIFBvc3NpYmxlIHZhbHVlcyBvZiB0aGUgZGF0YV90eXBlIGZpZWxkICh0aG91Z2ggc2VlIGluZmxhdGUoKSkgKi9cbi8vdmFyIFpfQklOQVJZICAgICAgICAgICAgICA9IDA7XG4vL3ZhciBaX1RFWFQgICAgICAgICAgICAgICAgPSAxO1xuLy92YXIgWl9BU0NJSSAgICAgICAgICAgICAgID0gMTsgLy8gPSBaX1RFWFRcbnZhciBaX1VOS05PV04gICAgICAgICAgICAgPSAyO1xuXG5cbi8qIFRoZSBkZWZsYXRlIGNvbXByZXNzaW9uIG1ldGhvZCAqL1xudmFyIFpfREVGTEFURUQgID0gODtcblxuLyo9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuXG52YXIgTUFYX01FTV9MRVZFTCA9IDk7XG4vKiBNYXhpbXVtIHZhbHVlIGZvciBtZW1MZXZlbCBpbiBkZWZsYXRlSW5pdDIgKi9cbnZhciBNQVhfV0JJVFMgPSAxNTtcbi8qIDMySyBMWjc3IHdpbmRvdyAqL1xudmFyIERFRl9NRU1fTEVWRUwgPSA4O1xuXG5cbnZhciBMRU5HVEhfQ09ERVMgID0gMjk7XG4vKiBudW1iZXIgb2YgbGVuZ3RoIGNvZGVzLCBub3QgY291bnRpbmcgdGhlIHNwZWNpYWwgRU5EX0JMT0NLIGNvZGUgKi9cbnZhciBMSVRFUkFMUyAgICAgID0gMjU2O1xuLyogbnVtYmVyIG9mIGxpdGVyYWwgYnl0ZXMgMC4uMjU1ICovXG52YXIgTF9DT0RFUyAgICAgICA9IExJVEVSQUxTICsgMSArIExFTkdUSF9DT0RFUztcbi8qIG51bWJlciBvZiBMaXRlcmFsIG9yIExlbmd0aCBjb2RlcywgaW5jbHVkaW5nIHRoZSBFTkRfQkxPQ0sgY29kZSAqL1xudmFyIERfQ09ERVMgICAgICAgPSAzMDtcbi8qIG51bWJlciBvZiBkaXN0YW5jZSBjb2RlcyAqL1xudmFyIEJMX0NPREVTICAgICAgPSAxOTtcbi8qIG51bWJlciBvZiBjb2RlcyB1c2VkIHRvIHRyYW5zZmVyIHRoZSBiaXQgbGVuZ3RocyAqL1xudmFyIEhFQVBfU0laRSAgICAgPSAyICogTF9DT0RFUyArIDE7XG4vKiBtYXhpbXVtIGhlYXAgc2l6ZSAqL1xudmFyIE1BWF9CSVRTICA9IDE1O1xuLyogQWxsIGNvZGVzIG11c3Qgbm90IGV4Y2VlZCBNQVhfQklUUyBiaXRzICovXG5cbnZhciBNSU5fTUFUQ0ggPSAzO1xudmFyIE1BWF9NQVRDSCA9IDI1ODtcbnZhciBNSU5fTE9PS0FIRUFEID0gKE1BWF9NQVRDSCArIE1JTl9NQVRDSCArIDEpO1xuXG52YXIgUFJFU0VUX0RJQ1QgPSAweDIwO1xuXG52YXIgSU5JVF9TVEFURSA9IDQyO1xudmFyIEVYVFJBX1NUQVRFID0gNjk7XG52YXIgTkFNRV9TVEFURSA9IDczO1xudmFyIENPTU1FTlRfU1RBVEUgPSA5MTtcbnZhciBIQ1JDX1NUQVRFID0gMTAzO1xudmFyIEJVU1lfU1RBVEUgPSAxMTM7XG52YXIgRklOSVNIX1NUQVRFID0gNjY2O1xuXG52YXIgQlNfTkVFRF9NT1JFICAgICAgPSAxOyAvKiBibG9jayBub3QgY29tcGxldGVkLCBuZWVkIG1vcmUgaW5wdXQgb3IgbW9yZSBvdXRwdXQgKi9cbnZhciBCU19CTE9DS19ET05FICAgICA9IDI7IC8qIGJsb2NrIGZsdXNoIHBlcmZvcm1lZCAqL1xudmFyIEJTX0ZJTklTSF9TVEFSVEVEID0gMzsgLyogZmluaXNoIHN0YXJ0ZWQsIG5lZWQgb25seSBtb3JlIG91dHB1dCBhdCBuZXh0IGRlZmxhdGUgKi9cbnZhciBCU19GSU5JU0hfRE9ORSAgICA9IDQ7IC8qIGZpbmlzaCBkb25lLCBhY2NlcHQgbm8gbW9yZSBpbnB1dCBvciBvdXRwdXQgKi9cblxudmFyIE9TX0NPREUgPSAweDAzOyAvLyBVbml4IDopIC4gRG9uJ3QgZGV0ZWN0LCB1c2UgdGhpcyBkZWZhdWx0LlxuXG5mdW5jdGlvbiBlcnIoc3RybSwgZXJyb3JDb2RlKSB7XG4gIHN0cm0ubXNnID0gbXNnW2Vycm9yQ29kZV07XG4gIHJldHVybiBlcnJvckNvZGU7XG59XG5cbmZ1bmN0aW9uIHJhbmsoZikge1xuICByZXR1cm4gKChmKSA8PCAxKSAtICgoZikgPiA0ID8gOSA6IDApO1xufVxuXG5mdW5jdGlvbiB6ZXJvKGJ1ZikgeyB2YXIgbGVuID0gYnVmLmxlbmd0aDsgd2hpbGUgKC0tbGVuID49IDApIHsgYnVmW2xlbl0gPSAwOyB9IH1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBGbHVzaCBhcyBtdWNoIHBlbmRpbmcgb3V0cHV0IGFzIHBvc3NpYmxlLiBBbGwgZGVmbGF0ZSgpIG91dHB1dCBnb2VzXG4gKiB0aHJvdWdoIHRoaXMgZnVuY3Rpb24gc28gc29tZSBhcHBsaWNhdGlvbnMgbWF5IHdpc2ggdG8gbW9kaWZ5IGl0XG4gKiB0byBhdm9pZCBhbGxvY2F0aW5nIGEgbGFyZ2Ugc3RybS0+b3V0cHV0IGJ1ZmZlciBhbmQgY29weWluZyBpbnRvIGl0LlxuICogKFNlZSBhbHNvIHJlYWRfYnVmKCkpLlxuICovXG5mdW5jdGlvbiBmbHVzaF9wZW5kaW5nKHN0cm0pIHtcbiAgdmFyIHMgPSBzdHJtLnN0YXRlO1xuXG4gIC8vX3RyX2ZsdXNoX2JpdHMocyk7XG4gIHZhciBsZW4gPSBzLnBlbmRpbmc7XG4gIGlmIChsZW4gPiBzdHJtLmF2YWlsX291dCkge1xuICAgIGxlbiA9IHN0cm0uYXZhaWxfb3V0O1xuICB9XG4gIGlmIChsZW4gPT09IDApIHsgcmV0dXJuOyB9XG5cbiAgdXRpbHMuYXJyYXlTZXQoc3RybS5vdXRwdXQsIHMucGVuZGluZ19idWYsIHMucGVuZGluZ19vdXQsIGxlbiwgc3RybS5uZXh0X291dCk7XG4gIHN0cm0ubmV4dF9vdXQgKz0gbGVuO1xuICBzLnBlbmRpbmdfb3V0ICs9IGxlbjtcbiAgc3RybS50b3RhbF9vdXQgKz0gbGVuO1xuICBzdHJtLmF2YWlsX291dCAtPSBsZW47XG4gIHMucGVuZGluZyAtPSBsZW47XG4gIGlmIChzLnBlbmRpbmcgPT09IDApIHtcbiAgICBzLnBlbmRpbmdfb3V0ID0gMDtcbiAgfVxufVxuXG5cbmZ1bmN0aW9uIGZsdXNoX2Jsb2NrX29ubHkocywgbGFzdCkge1xuICB0cmVlcy5fdHJfZmx1c2hfYmxvY2socywgKHMuYmxvY2tfc3RhcnQgPj0gMCA/IHMuYmxvY2tfc3RhcnQgOiAtMSksIHMuc3Ryc3RhcnQgLSBzLmJsb2NrX3N0YXJ0LCBsYXN0KTtcbiAgcy5ibG9ja19zdGFydCA9IHMuc3Ryc3RhcnQ7XG4gIGZsdXNoX3BlbmRpbmcocy5zdHJtKTtcbn1cblxuXG5mdW5jdGlvbiBwdXRfYnl0ZShzLCBiKSB7XG4gIHMucGVuZGluZ19idWZbcy5wZW5kaW5nKytdID0gYjtcbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBQdXQgYSBzaG9ydCBpbiB0aGUgcGVuZGluZyBidWZmZXIuIFRoZSAxNi1iaXQgdmFsdWUgaXMgcHV0IGluIE1TQiBvcmRlci5cbiAqIElOIGFzc2VydGlvbjogdGhlIHN0cmVhbSBzdGF0ZSBpcyBjb3JyZWN0IGFuZCB0aGVyZSBpcyBlbm91Z2ggcm9vbSBpblxuICogcGVuZGluZ19idWYuXG4gKi9cbmZ1bmN0aW9uIHB1dFNob3J0TVNCKHMsIGIpIHtcbi8vICBwdXRfYnl0ZShzLCAoQnl0ZSkoYiA+PiA4KSk7XG4vLyAgcHV0X2J5dGUocywgKEJ5dGUpKGIgJiAweGZmKSk7XG4gIHMucGVuZGluZ19idWZbcy5wZW5kaW5nKytdID0gKGIgPj4+IDgpICYgMHhmZjtcbiAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcrK10gPSBiICYgMHhmZjtcbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFJlYWQgYSBuZXcgYnVmZmVyIGZyb20gdGhlIGN1cnJlbnQgaW5wdXQgc3RyZWFtLCB1cGRhdGUgdGhlIGFkbGVyMzJcbiAqIGFuZCB0b3RhbCBudW1iZXIgb2YgYnl0ZXMgcmVhZC4gIEFsbCBkZWZsYXRlKCkgaW5wdXQgZ29lcyB0aHJvdWdoXG4gKiB0aGlzIGZ1bmN0aW9uIHNvIHNvbWUgYXBwbGljYXRpb25zIG1heSB3aXNoIHRvIG1vZGlmeSBpdCB0byBhdm9pZFxuICogYWxsb2NhdGluZyBhIGxhcmdlIHN0cm0tPmlucHV0IGJ1ZmZlciBhbmQgY29weWluZyBmcm9tIGl0LlxuICogKFNlZSBhbHNvIGZsdXNoX3BlbmRpbmcoKSkuXG4gKi9cbmZ1bmN0aW9uIHJlYWRfYnVmKHN0cm0sIGJ1Ziwgc3RhcnQsIHNpemUpIHtcbiAgdmFyIGxlbiA9IHN0cm0uYXZhaWxfaW47XG5cbiAgaWYgKGxlbiA+IHNpemUpIHsgbGVuID0gc2l6ZTsgfVxuICBpZiAobGVuID09PSAwKSB7IHJldHVybiAwOyB9XG5cbiAgc3RybS5hdmFpbF9pbiAtPSBsZW47XG5cbiAgLy8gem1lbWNweShidWYsIHN0cm0tPm5leHRfaW4sIGxlbik7XG4gIHV0aWxzLmFycmF5U2V0KGJ1Ziwgc3RybS5pbnB1dCwgc3RybS5uZXh0X2luLCBsZW4sIHN0YXJ0KTtcbiAgaWYgKHN0cm0uc3RhdGUud3JhcCA9PT0gMSkge1xuICAgIHN0cm0uYWRsZXIgPSBhZGxlcjMyKHN0cm0uYWRsZXIsIGJ1ZiwgbGVuLCBzdGFydCk7XG4gIH1cblxuICBlbHNlIGlmIChzdHJtLnN0YXRlLndyYXAgPT09IDIpIHtcbiAgICBzdHJtLmFkbGVyID0gY3JjMzIoc3RybS5hZGxlciwgYnVmLCBsZW4sIHN0YXJ0KTtcbiAgfVxuXG4gIHN0cm0ubmV4dF9pbiArPSBsZW47XG4gIHN0cm0udG90YWxfaW4gKz0gbGVuO1xuXG4gIHJldHVybiBsZW47XG59XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZXQgbWF0Y2hfc3RhcnQgdG8gdGhlIGxvbmdlc3QgbWF0Y2ggc3RhcnRpbmcgYXQgdGhlIGdpdmVuIHN0cmluZyBhbmRcbiAqIHJldHVybiBpdHMgbGVuZ3RoLiBNYXRjaGVzIHNob3J0ZXIgb3IgZXF1YWwgdG8gcHJldl9sZW5ndGggYXJlIGRpc2NhcmRlZCxcbiAqIGluIHdoaWNoIGNhc2UgdGhlIHJlc3VsdCBpcyBlcXVhbCB0byBwcmV2X2xlbmd0aCBhbmQgbWF0Y2hfc3RhcnQgaXNcbiAqIGdhcmJhZ2UuXG4gKiBJTiBhc3NlcnRpb25zOiBjdXJfbWF0Y2ggaXMgdGhlIGhlYWQgb2YgdGhlIGhhc2ggY2hhaW4gZm9yIHRoZSBjdXJyZW50XG4gKiAgIHN0cmluZyAoc3Ryc3RhcnQpIGFuZCBpdHMgZGlzdGFuY2UgaXMgPD0gTUFYX0RJU1QsIGFuZCBwcmV2X2xlbmd0aCA+PSAxXG4gKiBPVVQgYXNzZXJ0aW9uOiB0aGUgbWF0Y2ggbGVuZ3RoIGlzIG5vdCBncmVhdGVyIHRoYW4gcy0+bG9va2FoZWFkLlxuICovXG5mdW5jdGlvbiBsb25nZXN0X21hdGNoKHMsIGN1cl9tYXRjaCkge1xuICB2YXIgY2hhaW5fbGVuZ3RoID0gcy5tYXhfY2hhaW5fbGVuZ3RoOyAgICAgIC8qIG1heCBoYXNoIGNoYWluIGxlbmd0aCAqL1xuICB2YXIgc2NhbiA9IHMuc3Ryc3RhcnQ7IC8qIGN1cnJlbnQgc3RyaW5nICovXG4gIHZhciBtYXRjaDsgICAgICAgICAgICAgICAgICAgICAgIC8qIG1hdGNoZWQgc3RyaW5nICovXG4gIHZhciBsZW47ICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogbGVuZ3RoIG9mIGN1cnJlbnQgbWF0Y2ggKi9cbiAgdmFyIGJlc3RfbGVuID0gcy5wcmV2X2xlbmd0aDsgICAgICAgICAgICAgIC8qIGJlc3QgbWF0Y2ggbGVuZ3RoIHNvIGZhciAqL1xuICB2YXIgbmljZV9tYXRjaCA9IHMubmljZV9tYXRjaDsgICAgICAgICAgICAgLyogc3RvcCBpZiBtYXRjaCBsb25nIGVub3VnaCAqL1xuICB2YXIgbGltaXQgPSAocy5zdHJzdGFydCA+IChzLndfc2l6ZSAtIE1JTl9MT09LQUhFQUQpKSA/XG4gICAgICBzLnN0cnN0YXJ0IC0gKHMud19zaXplIC0gTUlOX0xPT0tBSEVBRCkgOiAwLypOSUwqLztcblxuICB2YXIgX3dpbiA9IHMud2luZG93OyAvLyBzaG9ydGN1dFxuXG4gIHZhciB3bWFzayA9IHMud19tYXNrO1xuICB2YXIgcHJldiAgPSBzLnByZXY7XG5cbiAgLyogU3RvcCB3aGVuIGN1cl9tYXRjaCBiZWNvbWVzIDw9IGxpbWl0LiBUbyBzaW1wbGlmeSB0aGUgY29kZSxcbiAgICogd2UgcHJldmVudCBtYXRjaGVzIHdpdGggdGhlIHN0cmluZyBvZiB3aW5kb3cgaW5kZXggMC5cbiAgICovXG5cbiAgdmFyIHN0cmVuZCA9IHMuc3Ryc3RhcnQgKyBNQVhfTUFUQ0g7XG4gIHZhciBzY2FuX2VuZDEgID0gX3dpbltzY2FuICsgYmVzdF9sZW4gLSAxXTtcbiAgdmFyIHNjYW5fZW5kICAgPSBfd2luW3NjYW4gKyBiZXN0X2xlbl07XG5cbiAgLyogVGhlIGNvZGUgaXMgb3B0aW1pemVkIGZvciBIQVNIX0JJVFMgPj0gOCBhbmQgTUFYX01BVENILTIgbXVsdGlwbGUgb2YgMTYuXG4gICAqIEl0IGlzIGVhc3kgdG8gZ2V0IHJpZCBvZiB0aGlzIG9wdGltaXphdGlvbiBpZiBuZWNlc3NhcnkuXG4gICAqL1xuICAvLyBBc3NlcnQocy0+aGFzaF9iaXRzID49IDggJiYgTUFYX01BVENIID09IDI1OCwgXCJDb2RlIHRvbyBjbGV2ZXJcIik7XG5cbiAgLyogRG8gbm90IHdhc3RlIHRvbyBtdWNoIHRpbWUgaWYgd2UgYWxyZWFkeSBoYXZlIGEgZ29vZCBtYXRjaDogKi9cbiAgaWYgKHMucHJldl9sZW5ndGggPj0gcy5nb29kX21hdGNoKSB7XG4gICAgY2hhaW5fbGVuZ3RoID4+PSAyO1xuICB9XG4gIC8qIERvIG5vdCBsb29rIGZvciBtYXRjaGVzIGJleW9uZCB0aGUgZW5kIG9mIHRoZSBpbnB1dC4gVGhpcyBpcyBuZWNlc3NhcnlcbiAgICogdG8gbWFrZSBkZWZsYXRlIGRldGVybWluaXN0aWMuXG4gICAqL1xuICBpZiAobmljZV9tYXRjaCA+IHMubG9va2FoZWFkKSB7IG5pY2VfbWF0Y2ggPSBzLmxvb2thaGVhZDsgfVxuXG4gIC8vIEFzc2VydCgodWxnKXMtPnN0cnN0YXJ0IDw9IHMtPndpbmRvd19zaXplLU1JTl9MT09LQUhFQUQsIFwibmVlZCBsb29rYWhlYWRcIik7XG5cbiAgZG8ge1xuICAgIC8vIEFzc2VydChjdXJfbWF0Y2ggPCBzLT5zdHJzdGFydCwgXCJubyBmdXR1cmVcIik7XG4gICAgbWF0Y2ggPSBjdXJfbWF0Y2g7XG5cbiAgICAvKiBTa2lwIHRvIG5leHQgbWF0Y2ggaWYgdGhlIG1hdGNoIGxlbmd0aCBjYW5ub3QgaW5jcmVhc2VcbiAgICAgKiBvciBpZiB0aGUgbWF0Y2ggbGVuZ3RoIGlzIGxlc3MgdGhhbiAyLiAgTm90ZSB0aGF0IHRoZSBjaGVja3MgYmVsb3dcbiAgICAgKiBmb3IgaW5zdWZmaWNpZW50IGxvb2thaGVhZCBvbmx5IG9jY3VyIG9jY2FzaW9uYWxseSBmb3IgcGVyZm9ybWFuY2VcbiAgICAgKiByZWFzb25zLiAgVGhlcmVmb3JlIHVuaW5pdGlhbGl6ZWQgbWVtb3J5IHdpbGwgYmUgYWNjZXNzZWQsIGFuZFxuICAgICAqIGNvbmRpdGlvbmFsIGp1bXBzIHdpbGwgYmUgbWFkZSB0aGF0IGRlcGVuZCBvbiB0aG9zZSB2YWx1ZXMuXG4gICAgICogSG93ZXZlciB0aGUgbGVuZ3RoIG9mIHRoZSBtYXRjaCBpcyBsaW1pdGVkIHRvIHRoZSBsb29rYWhlYWQsIHNvXG4gICAgICogdGhlIG91dHB1dCBvZiBkZWZsYXRlIGlzIG5vdCBhZmZlY3RlZCBieSB0aGUgdW5pbml0aWFsaXplZCB2YWx1ZXMuXG4gICAgICovXG5cbiAgICBpZiAoX3dpblttYXRjaCArIGJlc3RfbGVuXSAgICAgIT09IHNjYW5fZW5kICB8fFxuICAgICAgICBfd2luW21hdGNoICsgYmVzdF9sZW4gLSAxXSAhPT0gc2Nhbl9lbmQxIHx8XG4gICAgICAgIF93aW5bbWF0Y2hdICAgICAgICAgICAgICAgICE9PSBfd2luW3NjYW5dIHx8XG4gICAgICAgIF93aW5bKyttYXRjaF0gICAgICAgICAgICAgICE9PSBfd2luW3NjYW4gKyAxXSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgLyogVGhlIGNoZWNrIGF0IGJlc3RfbGVuLTEgY2FuIGJlIHJlbW92ZWQgYmVjYXVzZSBpdCB3aWxsIGJlIG1hZGVcbiAgICAgKiBhZ2FpbiBsYXRlci4gKFRoaXMgaGV1cmlzdGljIGlzIG5vdCBhbHdheXMgYSB3aW4uKVxuICAgICAqIEl0IGlzIG5vdCBuZWNlc3NhcnkgdG8gY29tcGFyZSBzY2FuWzJdIGFuZCBtYXRjaFsyXSBzaW5jZSB0aGV5XG4gICAgICogYXJlIGFsd2F5cyBlcXVhbCB3aGVuIHRoZSBvdGhlciBieXRlcyBtYXRjaCwgZ2l2ZW4gdGhhdFxuICAgICAqIHRoZSBoYXNoIGtleXMgYXJlIGVxdWFsIGFuZCB0aGF0IEhBU0hfQklUUyA+PSA4LlxuICAgICAqL1xuICAgIHNjYW4gKz0gMjtcbiAgICBtYXRjaCsrO1xuICAgIC8vIEFzc2VydCgqc2NhbiA9PSAqbWF0Y2gsIFwibWF0Y2hbMl0/XCIpO1xuXG4gICAgLyogV2UgY2hlY2sgZm9yIGluc3VmZmljaWVudCBsb29rYWhlYWQgb25seSBldmVyeSA4dGggY29tcGFyaXNvbjtcbiAgICAgKiB0aGUgMjU2dGggY2hlY2sgd2lsbCBiZSBtYWRlIGF0IHN0cnN0YXJ0KzI1OC5cbiAgICAgKi9cbiAgICBkbyB7XG4gICAgICAvKmpzaGludCBub2VtcHR5OmZhbHNlKi9cbiAgICB9IHdoaWxlIChfd2luWysrc2Nhbl0gPT09IF93aW5bKyttYXRjaF0gJiYgX3dpblsrK3NjYW5dID09PSBfd2luWysrbWF0Y2hdICYmXG4gICAgICAgICAgICAgX3dpblsrK3NjYW5dID09PSBfd2luWysrbWF0Y2hdICYmIF93aW5bKytzY2FuXSA9PT0gX3dpblsrK21hdGNoXSAmJlxuICAgICAgICAgICAgIF93aW5bKytzY2FuXSA9PT0gX3dpblsrK21hdGNoXSAmJiBfd2luWysrc2Nhbl0gPT09IF93aW5bKyttYXRjaF0gJiZcbiAgICAgICAgICAgICBfd2luWysrc2Nhbl0gPT09IF93aW5bKyttYXRjaF0gJiYgX3dpblsrK3NjYW5dID09PSBfd2luWysrbWF0Y2hdICYmXG4gICAgICAgICAgICAgc2NhbiA8IHN0cmVuZCk7XG5cbiAgICAvLyBBc3NlcnQoc2NhbiA8PSBzLT53aW5kb3crKHVuc2lnbmVkKShzLT53aW5kb3dfc2l6ZS0xKSwgXCJ3aWxkIHNjYW5cIik7XG5cbiAgICBsZW4gPSBNQVhfTUFUQ0ggLSAoc3RyZW5kIC0gc2Nhbik7XG4gICAgc2NhbiA9IHN0cmVuZCAtIE1BWF9NQVRDSDtcblxuICAgIGlmIChsZW4gPiBiZXN0X2xlbikge1xuICAgICAgcy5tYXRjaF9zdGFydCA9IGN1cl9tYXRjaDtcbiAgICAgIGJlc3RfbGVuID0gbGVuO1xuICAgICAgaWYgKGxlbiA+PSBuaWNlX21hdGNoKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgc2Nhbl9lbmQxICA9IF93aW5bc2NhbiArIGJlc3RfbGVuIC0gMV07XG4gICAgICBzY2FuX2VuZCAgID0gX3dpbltzY2FuICsgYmVzdF9sZW5dO1xuICAgIH1cbiAgfSB3aGlsZSAoKGN1cl9tYXRjaCA9IHByZXZbY3VyX21hdGNoICYgd21hc2tdKSA+IGxpbWl0ICYmIC0tY2hhaW5fbGVuZ3RoICE9PSAwKTtcblxuICBpZiAoYmVzdF9sZW4gPD0gcy5sb29rYWhlYWQpIHtcbiAgICByZXR1cm4gYmVzdF9sZW47XG4gIH1cbiAgcmV0dXJuIHMubG9va2FoZWFkO1xufVxuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogRmlsbCB0aGUgd2luZG93IHdoZW4gdGhlIGxvb2thaGVhZCBiZWNvbWVzIGluc3VmZmljaWVudC5cbiAqIFVwZGF0ZXMgc3Ryc3RhcnQgYW5kIGxvb2thaGVhZC5cbiAqXG4gKiBJTiBhc3NlcnRpb246IGxvb2thaGVhZCA8IE1JTl9MT09LQUhFQURcbiAqIE9VVCBhc3NlcnRpb25zOiBzdHJzdGFydCA8PSB3aW5kb3dfc2l6ZS1NSU5fTE9PS0FIRUFEXG4gKiAgICBBdCBsZWFzdCBvbmUgYnl0ZSBoYXMgYmVlbiByZWFkLCBvciBhdmFpbF9pbiA9PSAwOyByZWFkcyBhcmVcbiAqICAgIHBlcmZvcm1lZCBmb3IgYXQgbGVhc3QgdHdvIGJ5dGVzIChyZXF1aXJlZCBmb3IgdGhlIHppcCB0cmFuc2xhdGVfZW9sXG4gKiAgICBvcHRpb24gLS0gbm90IHN1cHBvcnRlZCBoZXJlKS5cbiAqL1xuZnVuY3Rpb24gZmlsbF93aW5kb3cocykge1xuICB2YXIgX3dfc2l6ZSA9IHMud19zaXplO1xuICB2YXIgcCwgbiwgbSwgbW9yZSwgc3RyO1xuXG4gIC8vQXNzZXJ0KHMtPmxvb2thaGVhZCA8IE1JTl9MT09LQUhFQUQsIFwiYWxyZWFkeSBlbm91Z2ggbG9va2FoZWFkXCIpO1xuXG4gIGRvIHtcbiAgICBtb3JlID0gcy53aW5kb3dfc2l6ZSAtIHMubG9va2FoZWFkIC0gcy5zdHJzdGFydDtcblxuICAgIC8vIEpTIGludHMgaGF2ZSAzMiBiaXQsIGJsb2NrIGJlbG93IG5vdCBuZWVkZWRcbiAgICAvKiBEZWFsIHdpdGggIUAjJCUgNjRLIGxpbWl0OiAqL1xuICAgIC8vaWYgKHNpemVvZihpbnQpIDw9IDIpIHtcbiAgICAvLyAgICBpZiAobW9yZSA9PSAwICYmIHMtPnN0cnN0YXJ0ID09IDAgJiYgcy0+bG9va2FoZWFkID09IDApIHtcbiAgICAvLyAgICAgICAgbW9yZSA9IHdzaXplO1xuICAgIC8vXG4gICAgLy8gIH0gZWxzZSBpZiAobW9yZSA9PSAodW5zaWduZWQpKC0xKSkge1xuICAgIC8vICAgICAgICAvKiBWZXJ5IHVubGlrZWx5LCBidXQgcG9zc2libGUgb24gMTYgYml0IG1hY2hpbmUgaWZcbiAgICAvLyAgICAgICAgICogc3Ryc3RhcnQgPT0gMCAmJiBsb29rYWhlYWQgPT0gMSAoaW5wdXQgZG9uZSBhIGJ5dGUgYXQgdGltZSlcbiAgICAvLyAgICAgICAgICovXG4gICAgLy8gICAgICAgIG1vcmUtLTtcbiAgICAvLyAgICB9XG4gICAgLy99XG5cblxuICAgIC8qIElmIHRoZSB3aW5kb3cgaXMgYWxtb3N0IGZ1bGwgYW5kIHRoZXJlIGlzIGluc3VmZmljaWVudCBsb29rYWhlYWQsXG4gICAgICogbW92ZSB0aGUgdXBwZXIgaGFsZiB0byB0aGUgbG93ZXIgb25lIHRvIG1ha2Ugcm9vbSBpbiB0aGUgdXBwZXIgaGFsZi5cbiAgICAgKi9cbiAgICBpZiAocy5zdHJzdGFydCA+PSBfd19zaXplICsgKF93X3NpemUgLSBNSU5fTE9PS0FIRUFEKSkge1xuXG4gICAgICB1dGlscy5hcnJheVNldChzLndpbmRvdywgcy53aW5kb3csIF93X3NpemUsIF93X3NpemUsIDApO1xuICAgICAgcy5tYXRjaF9zdGFydCAtPSBfd19zaXplO1xuICAgICAgcy5zdHJzdGFydCAtPSBfd19zaXplO1xuICAgICAgLyogd2Ugbm93IGhhdmUgc3Ryc3RhcnQgPj0gTUFYX0RJU1QgKi9cbiAgICAgIHMuYmxvY2tfc3RhcnQgLT0gX3dfc2l6ZTtcblxuICAgICAgLyogU2xpZGUgdGhlIGhhc2ggdGFibGUgKGNvdWxkIGJlIGF2b2lkZWQgd2l0aCAzMiBiaXQgdmFsdWVzXG4gICAgICAgYXQgdGhlIGV4cGVuc2Ugb2YgbWVtb3J5IHVzYWdlKS4gV2Ugc2xpZGUgZXZlbiB3aGVuIGxldmVsID09IDBcbiAgICAgICB0byBrZWVwIHRoZSBoYXNoIHRhYmxlIGNvbnNpc3RlbnQgaWYgd2Ugc3dpdGNoIGJhY2sgdG8gbGV2ZWwgPiAwXG4gICAgICAgbGF0ZXIuIChVc2luZyBsZXZlbCAwIHBlcm1hbmVudGx5IGlzIG5vdCBhbiBvcHRpbWFsIHVzYWdlIG9mXG4gICAgICAgemxpYiwgc28gd2UgZG9uJ3QgY2FyZSBhYm91dCB0aGlzIHBhdGhvbG9naWNhbCBjYXNlLilcbiAgICAgICAqL1xuXG4gICAgICBuID0gcy5oYXNoX3NpemU7XG4gICAgICBwID0gbjtcbiAgICAgIGRvIHtcbiAgICAgICAgbSA9IHMuaGVhZFstLXBdO1xuICAgICAgICBzLmhlYWRbcF0gPSAobSA+PSBfd19zaXplID8gbSAtIF93X3NpemUgOiAwKTtcbiAgICAgIH0gd2hpbGUgKC0tbik7XG5cbiAgICAgIG4gPSBfd19zaXplO1xuICAgICAgcCA9IG47XG4gICAgICBkbyB7XG4gICAgICAgIG0gPSBzLnByZXZbLS1wXTtcbiAgICAgICAgcy5wcmV2W3BdID0gKG0gPj0gX3dfc2l6ZSA/IG0gLSBfd19zaXplIDogMCk7XG4gICAgICAgIC8qIElmIG4gaXMgbm90IG9uIGFueSBoYXNoIGNoYWluLCBwcmV2W25dIGlzIGdhcmJhZ2UgYnV0XG4gICAgICAgICAqIGl0cyB2YWx1ZSB3aWxsIG5ldmVyIGJlIHVzZWQuXG4gICAgICAgICAqL1xuICAgICAgfSB3aGlsZSAoLS1uKTtcblxuICAgICAgbW9yZSArPSBfd19zaXplO1xuICAgIH1cbiAgICBpZiAocy5zdHJtLmF2YWlsX2luID09PSAwKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICAvKiBJZiB0aGVyZSB3YXMgbm8gc2xpZGluZzpcbiAgICAgKiAgICBzdHJzdGFydCA8PSBXU0laRStNQVhfRElTVC0xICYmIGxvb2thaGVhZCA8PSBNSU5fTE9PS0FIRUFEIC0gMSAmJlxuICAgICAqICAgIG1vcmUgPT0gd2luZG93X3NpemUgLSBsb29rYWhlYWQgLSBzdHJzdGFydFxuICAgICAqID0+IG1vcmUgPj0gd2luZG93X3NpemUgLSAoTUlOX0xPT0tBSEVBRC0xICsgV1NJWkUgKyBNQVhfRElTVC0xKVxuICAgICAqID0+IG1vcmUgPj0gd2luZG93X3NpemUgLSAyKldTSVpFICsgMlxuICAgICAqIEluIHRoZSBCSUdfTUVNIG9yIE1NQVAgY2FzZSAobm90IHlldCBzdXBwb3J0ZWQpLFxuICAgICAqICAgd2luZG93X3NpemUgPT0gaW5wdXRfc2l6ZSArIE1JTl9MT09LQUhFQUQgICYmXG4gICAgICogICBzdHJzdGFydCArIHMtPmxvb2thaGVhZCA8PSBpbnB1dF9zaXplID0+IG1vcmUgPj0gTUlOX0xPT0tBSEVBRC5cbiAgICAgKiBPdGhlcndpc2UsIHdpbmRvd19zaXplID09IDIqV1NJWkUgc28gbW9yZSA+PSAyLlxuICAgICAqIElmIHRoZXJlIHdhcyBzbGlkaW5nLCBtb3JlID49IFdTSVpFLiBTbyBpbiBhbGwgY2FzZXMsIG1vcmUgPj0gMi5cbiAgICAgKi9cbiAgICAvL0Fzc2VydChtb3JlID49IDIsIFwibW9yZSA8IDJcIik7XG4gICAgbiA9IHJlYWRfYnVmKHMuc3RybSwgcy53aW5kb3csIHMuc3Ryc3RhcnQgKyBzLmxvb2thaGVhZCwgbW9yZSk7XG4gICAgcy5sb29rYWhlYWQgKz0gbjtcblxuICAgIC8qIEluaXRpYWxpemUgdGhlIGhhc2ggdmFsdWUgbm93IHRoYXQgd2UgaGF2ZSBzb21lIGlucHV0OiAqL1xuICAgIGlmIChzLmxvb2thaGVhZCArIHMuaW5zZXJ0ID49IE1JTl9NQVRDSCkge1xuICAgICAgc3RyID0gcy5zdHJzdGFydCAtIHMuaW5zZXJ0O1xuICAgICAgcy5pbnNfaCA9IHMud2luZG93W3N0cl07XG5cbiAgICAgIC8qIFVQREFURV9IQVNIKHMsIHMtPmluc19oLCBzLT53aW5kb3dbc3RyICsgMV0pOyAqL1xuICAgICAgcy5pbnNfaCA9ICgocy5pbnNfaCA8PCBzLmhhc2hfc2hpZnQpIF4gcy53aW5kb3dbc3RyICsgMV0pICYgcy5oYXNoX21hc2s7XG4vLyNpZiBNSU5fTUFUQ0ggIT0gM1xuLy8gICAgICAgIENhbGwgdXBkYXRlX2hhc2goKSBNSU5fTUFUQ0gtMyBtb3JlIHRpbWVzXG4vLyNlbmRpZlxuICAgICAgd2hpbGUgKHMuaW5zZXJ0KSB7XG4gICAgICAgIC8qIFVQREFURV9IQVNIKHMsIHMtPmluc19oLCBzLT53aW5kb3dbc3RyICsgTUlOX01BVENILTFdKTsgKi9cbiAgICAgICAgcy5pbnNfaCA9ICgocy5pbnNfaCA8PCBzLmhhc2hfc2hpZnQpIF4gcy53aW5kb3dbc3RyICsgTUlOX01BVENIIC0gMV0pICYgcy5oYXNoX21hc2s7XG5cbiAgICAgICAgcy5wcmV2W3N0ciAmIHMud19tYXNrXSA9IHMuaGVhZFtzLmluc19oXTtcbiAgICAgICAgcy5oZWFkW3MuaW5zX2hdID0gc3RyO1xuICAgICAgICBzdHIrKztcbiAgICAgICAgcy5pbnNlcnQtLTtcbiAgICAgICAgaWYgKHMubG9va2FoZWFkICsgcy5pbnNlcnQgPCBNSU5fTUFUQ0gpIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICAvKiBJZiB0aGUgd2hvbGUgaW5wdXQgaGFzIGxlc3MgdGhhbiBNSU5fTUFUQ0ggYnl0ZXMsIGluc19oIGlzIGdhcmJhZ2UsXG4gICAgICogYnV0IHRoaXMgaXMgbm90IGltcG9ydGFudCBzaW5jZSBvbmx5IGxpdGVyYWwgYnl0ZXMgd2lsbCBiZSBlbWl0dGVkLlxuICAgICAqL1xuXG4gIH0gd2hpbGUgKHMubG9va2FoZWFkIDwgTUlOX0xPT0tBSEVBRCAmJiBzLnN0cm0uYXZhaWxfaW4gIT09IDApO1xuXG4gIC8qIElmIHRoZSBXSU5fSU5JVCBieXRlcyBhZnRlciB0aGUgZW5kIG9mIHRoZSBjdXJyZW50IGRhdGEgaGF2ZSBuZXZlciBiZWVuXG4gICAqIHdyaXR0ZW4sIHRoZW4gemVybyB0aG9zZSBieXRlcyBpbiBvcmRlciB0byBhdm9pZCBtZW1vcnkgY2hlY2sgcmVwb3J0cyBvZlxuICAgKiB0aGUgdXNlIG9mIHVuaW5pdGlhbGl6ZWQgKG9yIHVuaW5pdGlhbGlzZWQgYXMgSnVsaWFuIHdyaXRlcykgYnl0ZXMgYnlcbiAgICogdGhlIGxvbmdlc3QgbWF0Y2ggcm91dGluZXMuICBVcGRhdGUgdGhlIGhpZ2ggd2F0ZXIgbWFyayBmb3IgdGhlIG5leHRcbiAgICogdGltZSB0aHJvdWdoIGhlcmUuICBXSU5fSU5JVCBpcyBzZXQgdG8gTUFYX01BVENIIHNpbmNlIHRoZSBsb25nZXN0IG1hdGNoXG4gICAqIHJvdXRpbmVzIGFsbG93IHNjYW5uaW5nIHRvIHN0cnN0YXJ0ICsgTUFYX01BVENILCBpZ25vcmluZyBsb29rYWhlYWQuXG4gICAqL1xuLy8gIGlmIChzLmhpZ2hfd2F0ZXIgPCBzLndpbmRvd19zaXplKSB7XG4vLyAgICB2YXIgY3VyciA9IHMuc3Ryc3RhcnQgKyBzLmxvb2thaGVhZDtcbi8vICAgIHZhciBpbml0ID0gMDtcbi8vXG4vLyAgICBpZiAocy5oaWdoX3dhdGVyIDwgY3Vycikge1xuLy8gICAgICAvKiBQcmV2aW91cyBoaWdoIHdhdGVyIG1hcmsgYmVsb3cgY3VycmVudCBkYXRhIC0tIHplcm8gV0lOX0lOSVRcbi8vICAgICAgICogYnl0ZXMgb3IgdXAgdG8gZW5kIG9mIHdpbmRvdywgd2hpY2hldmVyIGlzIGxlc3MuXG4vLyAgICAgICAqL1xuLy8gICAgICBpbml0ID0gcy53aW5kb3dfc2l6ZSAtIGN1cnI7XG4vLyAgICAgIGlmIChpbml0ID4gV0lOX0lOSVQpXG4vLyAgICAgICAgaW5pdCA9IFdJTl9JTklUO1xuLy8gICAgICB6bWVtemVybyhzLT53aW5kb3cgKyBjdXJyLCAodW5zaWduZWQpaW5pdCk7XG4vLyAgICAgIHMtPmhpZ2hfd2F0ZXIgPSBjdXJyICsgaW5pdDtcbi8vICAgIH1cbi8vICAgIGVsc2UgaWYgKHMtPmhpZ2hfd2F0ZXIgPCAodWxnKWN1cnIgKyBXSU5fSU5JVCkge1xuLy8gICAgICAvKiBIaWdoIHdhdGVyIG1hcmsgYXQgb3IgYWJvdmUgY3VycmVudCBkYXRhLCBidXQgYmVsb3cgY3VycmVudCBkYXRhXG4vLyAgICAgICAqIHBsdXMgV0lOX0lOSVQgLS0gemVybyBvdXQgdG8gY3VycmVudCBkYXRhIHBsdXMgV0lOX0lOSVQsIG9yIHVwXG4vLyAgICAgICAqIHRvIGVuZCBvZiB3aW5kb3csIHdoaWNoZXZlciBpcyBsZXNzLlxuLy8gICAgICAgKi9cbi8vICAgICAgaW5pdCA9ICh1bGcpY3VyciArIFdJTl9JTklUIC0gcy0+aGlnaF93YXRlcjtcbi8vICAgICAgaWYgKGluaXQgPiBzLT53aW5kb3dfc2l6ZSAtIHMtPmhpZ2hfd2F0ZXIpXG4vLyAgICAgICAgaW5pdCA9IHMtPndpbmRvd19zaXplIC0gcy0+aGlnaF93YXRlcjtcbi8vICAgICAgem1lbXplcm8ocy0+d2luZG93ICsgcy0+aGlnaF93YXRlciwgKHVuc2lnbmVkKWluaXQpO1xuLy8gICAgICBzLT5oaWdoX3dhdGVyICs9IGluaXQ7XG4vLyAgICB9XG4vLyAgfVxuLy9cbi8vICBBc3NlcnQoKHVsZylzLT5zdHJzdGFydCA8PSBzLT53aW5kb3dfc2l6ZSAtIE1JTl9MT09LQUhFQUQsXG4vLyAgICBcIm5vdCBlbm91Z2ggcm9vbSBmb3Igc2VhcmNoXCIpO1xufVxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIENvcHkgd2l0aG91dCBjb21wcmVzc2lvbiBhcyBtdWNoIGFzIHBvc3NpYmxlIGZyb20gdGhlIGlucHV0IHN0cmVhbSwgcmV0dXJuXG4gKiB0aGUgY3VycmVudCBibG9jayBzdGF0ZS5cbiAqIFRoaXMgZnVuY3Rpb24gZG9lcyBub3QgaW5zZXJ0IG5ldyBzdHJpbmdzIGluIHRoZSBkaWN0aW9uYXJ5IHNpbmNlXG4gKiB1bmNvbXByZXNzaWJsZSBkYXRhIGlzIHByb2JhYmx5IG5vdCB1c2VmdWwuIFRoaXMgZnVuY3Rpb24gaXMgdXNlZFxuICogb25seSBmb3IgdGhlIGxldmVsPTAgY29tcHJlc3Npb24gb3B0aW9uLlxuICogTk9URTogdGhpcyBmdW5jdGlvbiBzaG91bGQgYmUgb3B0aW1pemVkIHRvIGF2b2lkIGV4dHJhIGNvcHlpbmcgZnJvbVxuICogd2luZG93IHRvIHBlbmRpbmdfYnVmLlxuICovXG5mdW5jdGlvbiBkZWZsYXRlX3N0b3JlZChzLCBmbHVzaCkge1xuICAvKiBTdG9yZWQgYmxvY2tzIGFyZSBsaW1pdGVkIHRvIDB4ZmZmZiBieXRlcywgcGVuZGluZ19idWYgaXMgbGltaXRlZFxuICAgKiB0byBwZW5kaW5nX2J1Zl9zaXplLCBhbmQgZWFjaCBzdG9yZWQgYmxvY2sgaGFzIGEgNSBieXRlIGhlYWRlcjpcbiAgICovXG4gIHZhciBtYXhfYmxvY2tfc2l6ZSA9IDB4ZmZmZjtcblxuICBpZiAobWF4X2Jsb2NrX3NpemUgPiBzLnBlbmRpbmdfYnVmX3NpemUgLSA1KSB7XG4gICAgbWF4X2Jsb2NrX3NpemUgPSBzLnBlbmRpbmdfYnVmX3NpemUgLSA1O1xuICB9XG5cbiAgLyogQ29weSBhcyBtdWNoIGFzIHBvc3NpYmxlIGZyb20gaW5wdXQgdG8gb3V0cHV0OiAqL1xuICBmb3IgKDs7KSB7XG4gICAgLyogRmlsbCB0aGUgd2luZG93IGFzIG11Y2ggYXMgcG9zc2libGU6ICovXG4gICAgaWYgKHMubG9va2FoZWFkIDw9IDEpIHtcblxuICAgICAgLy9Bc3NlcnQocy0+c3Ryc3RhcnQgPCBzLT53X3NpemUrTUFYX0RJU1QocykgfHxcbiAgICAgIC8vICBzLT5ibG9ja19zdGFydCA+PSAobG9uZylzLT53X3NpemUsIFwic2xpZGUgdG9vIGxhdGVcIik7XG4vLyAgICAgIGlmICghKHMuc3Ryc3RhcnQgPCBzLndfc2l6ZSArIChzLndfc2l6ZSAtIE1JTl9MT09LQUhFQUQpIHx8XG4vLyAgICAgICAgcy5ibG9ja19zdGFydCA+PSBzLndfc2l6ZSkpIHtcbi8vICAgICAgICB0aHJvdyAgbmV3IEVycm9yKFwic2xpZGUgdG9vIGxhdGVcIik7XG4vLyAgICAgIH1cblxuICAgICAgZmlsbF93aW5kb3cocyk7XG4gICAgICBpZiAocy5sb29rYWhlYWQgPT09IDAgJiYgZmx1c2ggPT09IFpfTk9fRkxVU0gpIHtcbiAgICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICAgIH1cblxuICAgICAgaWYgKHMubG9va2FoZWFkID09PSAwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLyogZmx1c2ggdGhlIGN1cnJlbnQgYmxvY2sgKi9cbiAgICB9XG4gICAgLy9Bc3NlcnQocy0+YmxvY2tfc3RhcnQgPj0gMEwsIFwiYmxvY2sgZ29uZVwiKTtcbi8vICAgIGlmIChzLmJsb2NrX3N0YXJ0IDwgMCkgdGhyb3cgbmV3IEVycm9yKFwiYmxvY2sgZ29uZVwiKTtcblxuICAgIHMuc3Ryc3RhcnQgKz0gcy5sb29rYWhlYWQ7XG4gICAgcy5sb29rYWhlYWQgPSAwO1xuXG4gICAgLyogRW1pdCBhIHN0b3JlZCBibG9jayBpZiBwZW5kaW5nX2J1ZiB3aWxsIGJlIGZ1bGw6ICovXG4gICAgdmFyIG1heF9zdGFydCA9IHMuYmxvY2tfc3RhcnQgKyBtYXhfYmxvY2tfc2l6ZTtcblxuICAgIGlmIChzLnN0cnN0YXJ0ID09PSAwIHx8IHMuc3Ryc3RhcnQgPj0gbWF4X3N0YXJ0KSB7XG4gICAgICAvKiBzdHJzdGFydCA9PSAwIGlzIHBvc3NpYmxlIHdoZW4gd3JhcGFyb3VuZCBvbiAxNi1iaXQgbWFjaGluZSAqL1xuICAgICAgcy5sb29rYWhlYWQgPSBzLnN0cnN0YXJ0IC0gbWF4X3N0YXJ0O1xuICAgICAgcy5zdHJzdGFydCA9IG1heF9zdGFydDtcbiAgICAgIC8qKiogRkxVU0hfQkxPQ0socywgMCk7ICoqKi9cbiAgICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgICAgaWYgKHMuc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICAgIH1cbiAgICAgIC8qKiovXG5cblxuICAgIH1cbiAgICAvKiBGbHVzaCBpZiB3ZSBtYXkgaGF2ZSB0byBzbGlkZSwgb3RoZXJ3aXNlIGJsb2NrX3N0YXJ0IG1heSBiZWNvbWVcbiAgICAgKiBuZWdhdGl2ZSBhbmQgdGhlIGRhdGEgd2lsbCBiZSBnb25lOlxuICAgICAqL1xuICAgIGlmIChzLnN0cnN0YXJ0IC0gcy5ibG9ja19zdGFydCA+PSAocy53X3NpemUgLSBNSU5fTE9PS0FIRUFEKSkge1xuICAgICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgICAgZmx1c2hfYmxvY2tfb25seShzLCBmYWxzZSk7XG4gICAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgICAgLyoqKi9cbiAgICB9XG4gIH1cblxuICBzLmluc2VydCA9IDA7XG5cbiAgaWYgKGZsdXNoID09PSBaX0ZJTklTSCkge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMSk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIHRydWUpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfRklOSVNIX1NUQVJURUQ7XG4gICAgfVxuICAgIC8qKiovXG4gICAgcmV0dXJuIEJTX0ZJTklTSF9ET05FO1xuICB9XG5cbiAgaWYgKHMuc3Ryc3RhcnQgPiBzLmJsb2NrX3N0YXJ0KSB7XG4gICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgIH1cbiAgICAvKioqL1xuICB9XG5cbiAgcmV0dXJuIEJTX05FRURfTU9SRTtcbn1cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDb21wcmVzcyBhcyBtdWNoIGFzIHBvc3NpYmxlIGZyb20gdGhlIGlucHV0IHN0cmVhbSwgcmV0dXJuIHRoZSBjdXJyZW50XG4gKiBibG9jayBzdGF0ZS5cbiAqIFRoaXMgZnVuY3Rpb24gZG9lcyBub3QgcGVyZm9ybSBsYXp5IGV2YWx1YXRpb24gb2YgbWF0Y2hlcyBhbmQgaW5zZXJ0c1xuICogbmV3IHN0cmluZ3MgaW4gdGhlIGRpY3Rpb25hcnkgb25seSBmb3IgdW5tYXRjaGVkIHN0cmluZ3Mgb3IgZm9yIHNob3J0XG4gKiBtYXRjaGVzLiBJdCBpcyB1c2VkIG9ubHkgZm9yIHRoZSBmYXN0IGNvbXByZXNzaW9uIG9wdGlvbnMuXG4gKi9cbmZ1bmN0aW9uIGRlZmxhdGVfZmFzdChzLCBmbHVzaCkge1xuICB2YXIgaGFzaF9oZWFkOyAgICAgICAgLyogaGVhZCBvZiB0aGUgaGFzaCBjaGFpbiAqL1xuICB2YXIgYmZsdXNoOyAgICAgICAgICAgLyogc2V0IGlmIGN1cnJlbnQgYmxvY2sgbXVzdCBiZSBmbHVzaGVkICovXG5cbiAgZm9yICg7Oykge1xuICAgIC8qIE1ha2Ugc3VyZSB0aGF0IHdlIGFsd2F5cyBoYXZlIGVub3VnaCBsb29rYWhlYWQsIGV4Y2VwdFxuICAgICAqIGF0IHRoZSBlbmQgb2YgdGhlIGlucHV0IGZpbGUuIFdlIG5lZWQgTUFYX01BVENIIGJ5dGVzXG4gICAgICogZm9yIHRoZSBuZXh0IG1hdGNoLCBwbHVzIE1JTl9NQVRDSCBieXRlcyB0byBpbnNlcnQgdGhlXG4gICAgICogc3RyaW5nIGZvbGxvd2luZyB0aGUgbmV4dCBtYXRjaC5cbiAgICAgKi9cbiAgICBpZiAocy5sb29rYWhlYWQgPCBNSU5fTE9PS0FIRUFEKSB7XG4gICAgICBmaWxsX3dpbmRvdyhzKTtcbiAgICAgIGlmIChzLmxvb2thaGVhZCA8IE1JTl9MT09LQUhFQUQgJiYgZmx1c2ggPT09IFpfTk9fRkxVU0gpIHtcbiAgICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICAgIH1cbiAgICAgIGlmIChzLmxvb2thaGVhZCA9PT0gMCkge1xuICAgICAgICBicmVhazsgLyogZmx1c2ggdGhlIGN1cnJlbnQgYmxvY2sgKi9cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvKiBJbnNlcnQgdGhlIHN0cmluZyB3aW5kb3dbc3Ryc3RhcnQgLi4gc3Ryc3RhcnQrMl0gaW4gdGhlXG4gICAgICogZGljdGlvbmFyeSwgYW5kIHNldCBoYXNoX2hlYWQgdG8gdGhlIGhlYWQgb2YgdGhlIGhhc2ggY2hhaW46XG4gICAgICovXG4gICAgaGFzaF9oZWFkID0gMC8qTklMKi87XG4gICAgaWYgKHMubG9va2FoZWFkID49IE1JTl9NQVRDSCkge1xuICAgICAgLyoqKiBJTlNFUlRfU1RSSU5HKHMsIHMuc3Ryc3RhcnQsIGhhc2hfaGVhZCk7ICoqKi9cbiAgICAgIHMuaW5zX2ggPSAoKHMuaW5zX2ggPDwgcy5oYXNoX3NoaWZ0KSBeIHMud2luZG93W3Muc3Ryc3RhcnQgKyBNSU5fTUFUQ0ggLSAxXSkgJiBzLmhhc2hfbWFzaztcbiAgICAgIGhhc2hfaGVhZCA9IHMucHJldltzLnN0cnN0YXJ0ICYgcy53X21hc2tdID0gcy5oZWFkW3MuaW5zX2hdO1xuICAgICAgcy5oZWFkW3MuaW5zX2hdID0gcy5zdHJzdGFydDtcbiAgICAgIC8qKiovXG4gICAgfVxuXG4gICAgLyogRmluZCB0aGUgbG9uZ2VzdCBtYXRjaCwgZGlzY2FyZGluZyB0aG9zZSA8PSBwcmV2X2xlbmd0aC5cbiAgICAgKiBBdCB0aGlzIHBvaW50IHdlIGhhdmUgYWx3YXlzIG1hdGNoX2xlbmd0aCA8IE1JTl9NQVRDSFxuICAgICAqL1xuICAgIGlmIChoYXNoX2hlYWQgIT09IDAvKk5JTCovICYmICgocy5zdHJzdGFydCAtIGhhc2hfaGVhZCkgPD0gKHMud19zaXplIC0gTUlOX0xPT0tBSEVBRCkpKSB7XG4gICAgICAvKiBUbyBzaW1wbGlmeSB0aGUgY29kZSwgd2UgcHJldmVudCBtYXRjaGVzIHdpdGggdGhlIHN0cmluZ1xuICAgICAgICogb2Ygd2luZG93IGluZGV4IDAgKGluIHBhcnRpY3VsYXIgd2UgaGF2ZSB0byBhdm9pZCBhIG1hdGNoXG4gICAgICAgKiBvZiB0aGUgc3RyaW5nIHdpdGggaXRzZWxmIGF0IHRoZSBzdGFydCBvZiB0aGUgaW5wdXQgZmlsZSkuXG4gICAgICAgKi9cbiAgICAgIHMubWF0Y2hfbGVuZ3RoID0gbG9uZ2VzdF9tYXRjaChzLCBoYXNoX2hlYWQpO1xuICAgICAgLyogbG9uZ2VzdF9tYXRjaCgpIHNldHMgbWF0Y2hfc3RhcnQgKi9cbiAgICB9XG4gICAgaWYgKHMubWF0Y2hfbGVuZ3RoID49IE1JTl9NQVRDSCkge1xuICAgICAgLy8gY2hlY2tfbWF0Y2gocywgcy5zdHJzdGFydCwgcy5tYXRjaF9zdGFydCwgcy5tYXRjaF9sZW5ndGgpOyAvLyBmb3IgZGVidWcgb25seVxuXG4gICAgICAvKioqIF90cl90YWxseV9kaXN0KHMsIHMuc3Ryc3RhcnQgLSBzLm1hdGNoX3N0YXJ0LFxuICAgICAgICAgICAgICAgICAgICAgcy5tYXRjaF9sZW5ndGggLSBNSU5fTUFUQ0gsIGJmbHVzaCk7ICoqKi9cbiAgICAgIGJmbHVzaCA9IHRyZWVzLl90cl90YWxseShzLCBzLnN0cnN0YXJ0IC0gcy5tYXRjaF9zdGFydCwgcy5tYXRjaF9sZW5ndGggLSBNSU5fTUFUQ0gpO1xuXG4gICAgICBzLmxvb2thaGVhZCAtPSBzLm1hdGNoX2xlbmd0aDtcblxuICAgICAgLyogSW5zZXJ0IG5ldyBzdHJpbmdzIGluIHRoZSBoYXNoIHRhYmxlIG9ubHkgaWYgdGhlIG1hdGNoIGxlbmd0aFxuICAgICAgICogaXMgbm90IHRvbyBsYXJnZS4gVGhpcyBzYXZlcyB0aW1lIGJ1dCBkZWdyYWRlcyBjb21wcmVzc2lvbi5cbiAgICAgICAqL1xuICAgICAgaWYgKHMubWF0Y2hfbGVuZ3RoIDw9IHMubWF4X2xhenlfbWF0Y2gvKm1heF9pbnNlcnRfbGVuZ3RoKi8gJiYgcy5sb29rYWhlYWQgPj0gTUlOX01BVENIKSB7XG4gICAgICAgIHMubWF0Y2hfbGVuZ3RoLS07IC8qIHN0cmluZyBhdCBzdHJzdGFydCBhbHJlYWR5IGluIHRhYmxlICovXG4gICAgICAgIGRvIHtcbiAgICAgICAgICBzLnN0cnN0YXJ0Kys7XG4gICAgICAgICAgLyoqKiBJTlNFUlRfU1RSSU5HKHMsIHMuc3Ryc3RhcnQsIGhhc2hfaGVhZCk7ICoqKi9cbiAgICAgICAgICBzLmluc19oID0gKChzLmluc19oIDw8IHMuaGFzaF9zaGlmdCkgXiBzLndpbmRvd1tzLnN0cnN0YXJ0ICsgTUlOX01BVENIIC0gMV0pICYgcy5oYXNoX21hc2s7XG4gICAgICAgICAgaGFzaF9oZWFkID0gcy5wcmV2W3Muc3Ryc3RhcnQgJiBzLndfbWFza10gPSBzLmhlYWRbcy5pbnNfaF07XG4gICAgICAgICAgcy5oZWFkW3MuaW5zX2hdID0gcy5zdHJzdGFydDtcbiAgICAgICAgICAvKioqL1xuICAgICAgICAgIC8qIHN0cnN0YXJ0IG5ldmVyIGV4Y2VlZHMgV1NJWkUtTUFYX01BVENILCBzbyB0aGVyZSBhcmVcbiAgICAgICAgICAgKiBhbHdheXMgTUlOX01BVENIIGJ5dGVzIGFoZWFkLlxuICAgICAgICAgICAqL1xuICAgICAgICB9IHdoaWxlICgtLXMubWF0Y2hfbGVuZ3RoICE9PSAwKTtcbiAgICAgICAgcy5zdHJzdGFydCsrO1xuICAgICAgfSBlbHNlXG4gICAgICB7XG4gICAgICAgIHMuc3Ryc3RhcnQgKz0gcy5tYXRjaF9sZW5ndGg7XG4gICAgICAgIHMubWF0Y2hfbGVuZ3RoID0gMDtcbiAgICAgICAgcy5pbnNfaCA9IHMud2luZG93W3Muc3Ryc3RhcnRdO1xuICAgICAgICAvKiBVUERBVEVfSEFTSChzLCBzLmluc19oLCBzLndpbmRvd1tzLnN0cnN0YXJ0KzFdKTsgKi9cbiAgICAgICAgcy5pbnNfaCA9ICgocy5pbnNfaCA8PCBzLmhhc2hfc2hpZnQpIF4gcy53aW5kb3dbcy5zdHJzdGFydCArIDFdKSAmIHMuaGFzaF9tYXNrO1xuXG4vLyNpZiBNSU5fTUFUQ0ggIT0gM1xuLy8gICAgICAgICAgICAgICAgQ2FsbCBVUERBVEVfSEFTSCgpIE1JTl9NQVRDSC0zIG1vcmUgdGltZXNcbi8vI2VuZGlmXG4gICAgICAgIC8qIElmIGxvb2thaGVhZCA8IE1JTl9NQVRDSCwgaW5zX2ggaXMgZ2FyYmFnZSwgYnV0IGl0IGRvZXMgbm90XG4gICAgICAgICAqIG1hdHRlciBzaW5jZSBpdCB3aWxsIGJlIHJlY29tcHV0ZWQgYXQgbmV4dCBkZWZsYXRlIGNhbGwuXG4gICAgICAgICAqL1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvKiBObyBtYXRjaCwgb3V0cHV0IGEgbGl0ZXJhbCBieXRlICovXG4gICAgICAvL1RyYWNldnYoKHN0ZGVycixcIiVjXCIsIHMud2luZG93W3Muc3Ryc3RhcnRdKSk7XG4gICAgICAvKioqIF90cl90YWxseV9saXQocywgcy53aW5kb3dbcy5zdHJzdGFydF0sIGJmbHVzaCk7ICoqKi9cbiAgICAgIGJmbHVzaCA9IHRyZWVzLl90cl90YWxseShzLCAwLCBzLndpbmRvd1tzLnN0cnN0YXJ0XSk7XG5cbiAgICAgIHMubG9va2FoZWFkLS07XG4gICAgICBzLnN0cnN0YXJ0Kys7XG4gICAgfVxuICAgIGlmIChiZmx1c2gpIHtcbiAgICAgIC8qKiogRkxVU0hfQkxPQ0socywgMCk7ICoqKi9cbiAgICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgICAgaWYgKHMuc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICAgIH1cbiAgICAgIC8qKiovXG4gICAgfVxuICB9XG4gIHMuaW5zZXJ0ID0gKChzLnN0cnN0YXJ0IDwgKE1JTl9NQVRDSCAtIDEpKSA/IHMuc3Ryc3RhcnQgOiBNSU5fTUFUQ0ggLSAxKTtcbiAgaWYgKGZsdXNoID09PSBaX0ZJTklTSCkge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMSk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIHRydWUpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfRklOSVNIX1NUQVJURUQ7XG4gICAgfVxuICAgIC8qKiovXG4gICAgcmV0dXJuIEJTX0ZJTklTSF9ET05FO1xuICB9XG4gIGlmIChzLmxhc3RfbGl0KSB7XG4gICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgIH1cbiAgICAvKioqL1xuICB9XG4gIHJldHVybiBCU19CTE9DS19ET05FO1xufVxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNhbWUgYXMgYWJvdmUsIGJ1dCBhY2hpZXZlcyBiZXR0ZXIgY29tcHJlc3Npb24uIFdlIHVzZSBhIGxhenlcbiAqIGV2YWx1YXRpb24gZm9yIG1hdGNoZXM6IGEgbWF0Y2ggaXMgZmluYWxseSBhZG9wdGVkIG9ubHkgaWYgdGhlcmUgaXNcbiAqIG5vIGJldHRlciBtYXRjaCBhdCB0aGUgbmV4dCB3aW5kb3cgcG9zaXRpb24uXG4gKi9cbmZ1bmN0aW9uIGRlZmxhdGVfc2xvdyhzLCBmbHVzaCkge1xuICB2YXIgaGFzaF9oZWFkOyAgICAgICAgICAvKiBoZWFkIG9mIGhhc2ggY2hhaW4gKi9cbiAgdmFyIGJmbHVzaDsgICAgICAgICAgICAgIC8qIHNldCBpZiBjdXJyZW50IGJsb2NrIG11c3QgYmUgZmx1c2hlZCAqL1xuXG4gIHZhciBtYXhfaW5zZXJ0O1xuXG4gIC8qIFByb2Nlc3MgdGhlIGlucHV0IGJsb2NrLiAqL1xuICBmb3IgKDs7KSB7XG4gICAgLyogTWFrZSBzdXJlIHRoYXQgd2UgYWx3YXlzIGhhdmUgZW5vdWdoIGxvb2thaGVhZCwgZXhjZXB0XG4gICAgICogYXQgdGhlIGVuZCBvZiB0aGUgaW5wdXQgZmlsZS4gV2UgbmVlZCBNQVhfTUFUQ0ggYnl0ZXNcbiAgICAgKiBmb3IgdGhlIG5leHQgbWF0Y2gsIHBsdXMgTUlOX01BVENIIGJ5dGVzIHRvIGluc2VydCB0aGVcbiAgICAgKiBzdHJpbmcgZm9sbG93aW5nIHRoZSBuZXh0IG1hdGNoLlxuICAgICAqL1xuICAgIGlmIChzLmxvb2thaGVhZCA8IE1JTl9MT09LQUhFQUQpIHtcbiAgICAgIGZpbGxfd2luZG93KHMpO1xuICAgICAgaWYgKHMubG9va2FoZWFkIDwgTUlOX0xPT0tBSEVBRCAmJiBmbHVzaCA9PT0gWl9OT19GTFVTSCkge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgICAgaWYgKHMubG9va2FoZWFkID09PSAwKSB7IGJyZWFrOyB9IC8qIGZsdXNoIHRoZSBjdXJyZW50IGJsb2NrICovXG4gICAgfVxuXG4gICAgLyogSW5zZXJ0IHRoZSBzdHJpbmcgd2luZG93W3N0cnN0YXJ0IC4uIHN0cnN0YXJ0KzJdIGluIHRoZVxuICAgICAqIGRpY3Rpb25hcnksIGFuZCBzZXQgaGFzaF9oZWFkIHRvIHRoZSBoZWFkIG9mIHRoZSBoYXNoIGNoYWluOlxuICAgICAqL1xuICAgIGhhc2hfaGVhZCA9IDAvKk5JTCovO1xuICAgIGlmIChzLmxvb2thaGVhZCA+PSBNSU5fTUFUQ0gpIHtcbiAgICAgIC8qKiogSU5TRVJUX1NUUklORyhzLCBzLnN0cnN0YXJ0LCBoYXNoX2hlYWQpOyAqKiovXG4gICAgICBzLmluc19oID0gKChzLmluc19oIDw8IHMuaGFzaF9zaGlmdCkgXiBzLndpbmRvd1tzLnN0cnN0YXJ0ICsgTUlOX01BVENIIC0gMV0pICYgcy5oYXNoX21hc2s7XG4gICAgICBoYXNoX2hlYWQgPSBzLnByZXZbcy5zdHJzdGFydCAmIHMud19tYXNrXSA9IHMuaGVhZFtzLmluc19oXTtcbiAgICAgIHMuaGVhZFtzLmluc19oXSA9IHMuc3Ryc3RhcnQ7XG4gICAgICAvKioqL1xuICAgIH1cblxuICAgIC8qIEZpbmQgdGhlIGxvbmdlc3QgbWF0Y2gsIGRpc2NhcmRpbmcgdGhvc2UgPD0gcHJldl9sZW5ndGguXG4gICAgICovXG4gICAgcy5wcmV2X2xlbmd0aCA9IHMubWF0Y2hfbGVuZ3RoO1xuICAgIHMucHJldl9tYXRjaCA9IHMubWF0Y2hfc3RhcnQ7XG4gICAgcy5tYXRjaF9sZW5ndGggPSBNSU5fTUFUQ0ggLSAxO1xuXG4gICAgaWYgKGhhc2hfaGVhZCAhPT0gMC8qTklMKi8gJiYgcy5wcmV2X2xlbmd0aCA8IHMubWF4X2xhenlfbWF0Y2ggJiZcbiAgICAgICAgcy5zdHJzdGFydCAtIGhhc2hfaGVhZCA8PSAocy53X3NpemUgLSBNSU5fTE9PS0FIRUFEKS8qTUFYX0RJU1QocykqLykge1xuICAgICAgLyogVG8gc2ltcGxpZnkgdGhlIGNvZGUsIHdlIHByZXZlbnQgbWF0Y2hlcyB3aXRoIHRoZSBzdHJpbmdcbiAgICAgICAqIG9mIHdpbmRvdyBpbmRleCAwIChpbiBwYXJ0aWN1bGFyIHdlIGhhdmUgdG8gYXZvaWQgYSBtYXRjaFxuICAgICAgICogb2YgdGhlIHN0cmluZyB3aXRoIGl0c2VsZiBhdCB0aGUgc3RhcnQgb2YgdGhlIGlucHV0IGZpbGUpLlxuICAgICAgICovXG4gICAgICBzLm1hdGNoX2xlbmd0aCA9IGxvbmdlc3RfbWF0Y2gocywgaGFzaF9oZWFkKTtcbiAgICAgIC8qIGxvbmdlc3RfbWF0Y2goKSBzZXRzIG1hdGNoX3N0YXJ0ICovXG5cbiAgICAgIGlmIChzLm1hdGNoX2xlbmd0aCA8PSA1ICYmXG4gICAgICAgICAocy5zdHJhdGVneSA9PT0gWl9GSUxURVJFRCB8fCAocy5tYXRjaF9sZW5ndGggPT09IE1JTl9NQVRDSCAmJiBzLnN0cnN0YXJ0IC0gcy5tYXRjaF9zdGFydCA+IDQwOTYvKlRPT19GQVIqLykpKSB7XG5cbiAgICAgICAgLyogSWYgcHJldl9tYXRjaCBpcyBhbHNvIE1JTl9NQVRDSCwgbWF0Y2hfc3RhcnQgaXMgZ2FyYmFnZVxuICAgICAgICAgKiBidXQgd2Ugd2lsbCBpZ25vcmUgdGhlIGN1cnJlbnQgbWF0Y2ggYW55d2F5LlxuICAgICAgICAgKi9cbiAgICAgICAgcy5tYXRjaF9sZW5ndGggPSBNSU5fTUFUQ0ggLSAxO1xuICAgICAgfVxuICAgIH1cbiAgICAvKiBJZiB0aGVyZSB3YXMgYSBtYXRjaCBhdCB0aGUgcHJldmlvdXMgc3RlcCBhbmQgdGhlIGN1cnJlbnRcbiAgICAgKiBtYXRjaCBpcyBub3QgYmV0dGVyLCBvdXRwdXQgdGhlIHByZXZpb3VzIG1hdGNoOlxuICAgICAqL1xuICAgIGlmIChzLnByZXZfbGVuZ3RoID49IE1JTl9NQVRDSCAmJiBzLm1hdGNoX2xlbmd0aCA8PSBzLnByZXZfbGVuZ3RoKSB7XG4gICAgICBtYXhfaW5zZXJ0ID0gcy5zdHJzdGFydCArIHMubG9va2FoZWFkIC0gTUlOX01BVENIO1xuICAgICAgLyogRG8gbm90IGluc2VydCBzdHJpbmdzIGluIGhhc2ggdGFibGUgYmV5b25kIHRoaXMuICovXG5cbiAgICAgIC8vY2hlY2tfbWF0Y2gocywgcy5zdHJzdGFydC0xLCBzLnByZXZfbWF0Y2gsIHMucHJldl9sZW5ndGgpO1xuXG4gICAgICAvKioqX3RyX3RhbGx5X2Rpc3Qocywgcy5zdHJzdGFydCAtIDEgLSBzLnByZXZfbWF0Y2gsXG4gICAgICAgICAgICAgICAgICAgICBzLnByZXZfbGVuZ3RoIC0gTUlOX01BVENILCBiZmx1c2gpOyoqKi9cbiAgICAgIGJmbHVzaCA9IHRyZWVzLl90cl90YWxseShzLCBzLnN0cnN0YXJ0IC0gMSAtIHMucHJldl9tYXRjaCwgcy5wcmV2X2xlbmd0aCAtIE1JTl9NQVRDSCk7XG4gICAgICAvKiBJbnNlcnQgaW4gaGFzaCB0YWJsZSBhbGwgc3RyaW5ncyB1cCB0byB0aGUgZW5kIG9mIHRoZSBtYXRjaC5cbiAgICAgICAqIHN0cnN0YXJ0LTEgYW5kIHN0cnN0YXJ0IGFyZSBhbHJlYWR5IGluc2VydGVkLiBJZiB0aGVyZSBpcyBub3RcbiAgICAgICAqIGVub3VnaCBsb29rYWhlYWQsIHRoZSBsYXN0IHR3byBzdHJpbmdzIGFyZSBub3QgaW5zZXJ0ZWQgaW5cbiAgICAgICAqIHRoZSBoYXNoIHRhYmxlLlxuICAgICAgICovXG4gICAgICBzLmxvb2thaGVhZCAtPSBzLnByZXZfbGVuZ3RoIC0gMTtcbiAgICAgIHMucHJldl9sZW5ndGggLT0gMjtcbiAgICAgIGRvIHtcbiAgICAgICAgaWYgKCsrcy5zdHJzdGFydCA8PSBtYXhfaW5zZXJ0KSB7XG4gICAgICAgICAgLyoqKiBJTlNFUlRfU1RSSU5HKHMsIHMuc3Ryc3RhcnQsIGhhc2hfaGVhZCk7ICoqKi9cbiAgICAgICAgICBzLmluc19oID0gKChzLmluc19oIDw8IHMuaGFzaF9zaGlmdCkgXiBzLndpbmRvd1tzLnN0cnN0YXJ0ICsgTUlOX01BVENIIC0gMV0pICYgcy5oYXNoX21hc2s7XG4gICAgICAgICAgaGFzaF9oZWFkID0gcy5wcmV2W3Muc3Ryc3RhcnQgJiBzLndfbWFza10gPSBzLmhlYWRbcy5pbnNfaF07XG4gICAgICAgICAgcy5oZWFkW3MuaW5zX2hdID0gcy5zdHJzdGFydDtcbiAgICAgICAgICAvKioqL1xuICAgICAgICB9XG4gICAgICB9IHdoaWxlICgtLXMucHJldl9sZW5ndGggIT09IDApO1xuICAgICAgcy5tYXRjaF9hdmFpbGFibGUgPSAwO1xuICAgICAgcy5tYXRjaF9sZW5ndGggPSBNSU5fTUFUQ0ggLSAxO1xuICAgICAgcy5zdHJzdGFydCsrO1xuXG4gICAgICBpZiAoYmZsdXNoKSB7XG4gICAgICAgIC8qKiogRkxVU0hfQkxPQ0socywgMCk7ICoqKi9cbiAgICAgICAgZmx1c2hfYmxvY2tfb25seShzLCBmYWxzZSk7XG4gICAgICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICAgICAgfVxuICAgICAgICAvKioqL1xuICAgICAgfVxuXG4gICAgfSBlbHNlIGlmIChzLm1hdGNoX2F2YWlsYWJsZSkge1xuICAgICAgLyogSWYgdGhlcmUgd2FzIG5vIG1hdGNoIGF0IHRoZSBwcmV2aW91cyBwb3NpdGlvbiwgb3V0cHV0IGFcbiAgICAgICAqIHNpbmdsZSBsaXRlcmFsLiBJZiB0aGVyZSB3YXMgYSBtYXRjaCBidXQgdGhlIGN1cnJlbnQgbWF0Y2hcbiAgICAgICAqIGlzIGxvbmdlciwgdHJ1bmNhdGUgdGhlIHByZXZpb3VzIG1hdGNoIHRvIGEgc2luZ2xlIGxpdGVyYWwuXG4gICAgICAgKi9cbiAgICAgIC8vVHJhY2V2digoc3RkZXJyLFwiJWNcIiwgcy0+d2luZG93W3MtPnN0cnN0YXJ0LTFdKSk7XG4gICAgICAvKioqIF90cl90YWxseV9saXQocywgcy53aW5kb3dbcy5zdHJzdGFydC0xXSwgYmZsdXNoKTsgKioqL1xuICAgICAgYmZsdXNoID0gdHJlZXMuX3RyX3RhbGx5KHMsIDAsIHMud2luZG93W3Muc3Ryc3RhcnQgLSAxXSk7XG5cbiAgICAgIGlmIChiZmx1c2gpIHtcbiAgICAgICAgLyoqKiBGTFVTSF9CTE9DS19PTkxZKHMsIDApICoqKi9cbiAgICAgICAgZmx1c2hfYmxvY2tfb25seShzLCBmYWxzZSk7XG4gICAgICAgIC8qKiovXG4gICAgICB9XG4gICAgICBzLnN0cnN0YXJ0Kys7XG4gICAgICBzLmxvb2thaGVhZC0tO1xuICAgICAgaWYgKHMuc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLyogVGhlcmUgaXMgbm8gcHJldmlvdXMgbWF0Y2ggdG8gY29tcGFyZSB3aXRoLCB3YWl0IGZvclxuICAgICAgICogdGhlIG5leHQgc3RlcCB0byBkZWNpZGUuXG4gICAgICAgKi9cbiAgICAgIHMubWF0Y2hfYXZhaWxhYmxlID0gMTtcbiAgICAgIHMuc3Ryc3RhcnQrKztcbiAgICAgIHMubG9va2FoZWFkLS07XG4gICAgfVxuICB9XG4gIC8vQXNzZXJ0IChmbHVzaCAhPSBaX05PX0ZMVVNILCBcIm5vIGZsdXNoP1wiKTtcbiAgaWYgKHMubWF0Y2hfYXZhaWxhYmxlKSB7XG4gICAgLy9UcmFjZXZ2KChzdGRlcnIsXCIlY1wiLCBzLT53aW5kb3dbcy0+c3Ryc3RhcnQtMV0pKTtcbiAgICAvKioqIF90cl90YWxseV9saXQocywgcy53aW5kb3dbcy5zdHJzdGFydC0xXSwgYmZsdXNoKTsgKioqL1xuICAgIGJmbHVzaCA9IHRyZWVzLl90cl90YWxseShzLCAwLCBzLndpbmRvd1tzLnN0cnN0YXJ0IC0gMV0pO1xuXG4gICAgcy5tYXRjaF9hdmFpbGFibGUgPSAwO1xuICB9XG4gIHMuaW5zZXJ0ID0gcy5zdHJzdGFydCA8IE1JTl9NQVRDSCAtIDEgPyBzLnN0cnN0YXJ0IDogTUlOX01BVENIIC0gMTtcbiAgaWYgKGZsdXNoID09PSBaX0ZJTklTSCkge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMSk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIHRydWUpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfRklOSVNIX1NUQVJURUQ7XG4gICAgfVxuICAgIC8qKiovXG4gICAgcmV0dXJuIEJTX0ZJTklTSF9ET05FO1xuICB9XG4gIGlmIChzLmxhc3RfbGl0KSB7XG4gICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgIH1cbiAgICAvKioqL1xuICB9XG5cbiAgcmV0dXJuIEJTX0JMT0NLX0RPTkU7XG59XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBGb3IgWl9STEUsIHNpbXBseSBsb29rIGZvciBydW5zIG9mIGJ5dGVzLCBnZW5lcmF0ZSBtYXRjaGVzIG9ubHkgb2YgZGlzdGFuY2VcbiAqIG9uZS4gIERvIG5vdCBtYWludGFpbiBhIGhhc2ggdGFibGUuICAoSXQgd2lsbCBiZSByZWdlbmVyYXRlZCBpZiB0aGlzIHJ1biBvZlxuICogZGVmbGF0ZSBzd2l0Y2hlcyBhd2F5IGZyb20gWl9STEUuKVxuICovXG5mdW5jdGlvbiBkZWZsYXRlX3JsZShzLCBmbHVzaCkge1xuICB2YXIgYmZsdXNoOyAgICAgICAgICAgIC8qIHNldCBpZiBjdXJyZW50IGJsb2NrIG11c3QgYmUgZmx1c2hlZCAqL1xuICB2YXIgcHJldjsgICAgICAgICAgICAgIC8qIGJ5dGUgYXQgZGlzdGFuY2Ugb25lIHRvIG1hdGNoICovXG4gIHZhciBzY2FuLCBzdHJlbmQ7ICAgICAgLyogc2NhbiBnb2VzIHVwIHRvIHN0cmVuZCBmb3IgbGVuZ3RoIG9mIHJ1biAqL1xuXG4gIHZhciBfd2luID0gcy53aW5kb3c7XG5cbiAgZm9yICg7Oykge1xuICAgIC8qIE1ha2Ugc3VyZSB0aGF0IHdlIGFsd2F5cyBoYXZlIGVub3VnaCBsb29rYWhlYWQsIGV4Y2VwdFxuICAgICAqIGF0IHRoZSBlbmQgb2YgdGhlIGlucHV0IGZpbGUuIFdlIG5lZWQgTUFYX01BVENIIGJ5dGVzXG4gICAgICogZm9yIHRoZSBsb25nZXN0IHJ1biwgcGx1cyBvbmUgZm9yIHRoZSB1bnJvbGxlZCBsb29wLlxuICAgICAqL1xuICAgIGlmIChzLmxvb2thaGVhZCA8PSBNQVhfTUFUQ0gpIHtcbiAgICAgIGZpbGxfd2luZG93KHMpO1xuICAgICAgaWYgKHMubG9va2FoZWFkIDw9IE1BWF9NQVRDSCAmJiBmbHVzaCA9PT0gWl9OT19GTFVTSCkge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgICAgaWYgKHMubG9va2FoZWFkID09PSAwKSB7IGJyZWFrOyB9IC8qIGZsdXNoIHRoZSBjdXJyZW50IGJsb2NrICovXG4gICAgfVxuXG4gICAgLyogU2VlIGhvdyBtYW55IHRpbWVzIHRoZSBwcmV2aW91cyBieXRlIHJlcGVhdHMgKi9cbiAgICBzLm1hdGNoX2xlbmd0aCA9IDA7XG4gICAgaWYgKHMubG9va2FoZWFkID49IE1JTl9NQVRDSCAmJiBzLnN0cnN0YXJ0ID4gMCkge1xuICAgICAgc2NhbiA9IHMuc3Ryc3RhcnQgLSAxO1xuICAgICAgcHJldiA9IF93aW5bc2Nhbl07XG4gICAgICBpZiAocHJldiA9PT0gX3dpblsrK3NjYW5dICYmIHByZXYgPT09IF93aW5bKytzY2FuXSAmJiBwcmV2ID09PSBfd2luWysrc2Nhbl0pIHtcbiAgICAgICAgc3RyZW5kID0gcy5zdHJzdGFydCArIE1BWF9NQVRDSDtcbiAgICAgICAgZG8ge1xuICAgICAgICAgIC8qanNoaW50IG5vZW1wdHk6ZmFsc2UqL1xuICAgICAgICB9IHdoaWxlIChwcmV2ID09PSBfd2luWysrc2Nhbl0gJiYgcHJldiA9PT0gX3dpblsrK3NjYW5dICYmXG4gICAgICAgICAgICAgICAgIHByZXYgPT09IF93aW5bKytzY2FuXSAmJiBwcmV2ID09PSBfd2luWysrc2Nhbl0gJiZcbiAgICAgICAgICAgICAgICAgcHJldiA9PT0gX3dpblsrK3NjYW5dICYmIHByZXYgPT09IF93aW5bKytzY2FuXSAmJlxuICAgICAgICAgICAgICAgICBwcmV2ID09PSBfd2luWysrc2Nhbl0gJiYgcHJldiA9PT0gX3dpblsrK3NjYW5dICYmXG4gICAgICAgICAgICAgICAgIHNjYW4gPCBzdHJlbmQpO1xuICAgICAgICBzLm1hdGNoX2xlbmd0aCA9IE1BWF9NQVRDSCAtIChzdHJlbmQgLSBzY2FuKTtcbiAgICAgICAgaWYgKHMubWF0Y2hfbGVuZ3RoID4gcy5sb29rYWhlYWQpIHtcbiAgICAgICAgICBzLm1hdGNoX2xlbmd0aCA9IHMubG9va2FoZWFkO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvL0Fzc2VydChzY2FuIDw9IHMtPndpbmRvdysodUludCkocy0+d2luZG93X3NpemUtMSksIFwid2lsZCBzY2FuXCIpO1xuICAgIH1cblxuICAgIC8qIEVtaXQgbWF0Y2ggaWYgaGF2ZSBydW4gb2YgTUlOX01BVENIIG9yIGxvbmdlciwgZWxzZSBlbWl0IGxpdGVyYWwgKi9cbiAgICBpZiAocy5tYXRjaF9sZW5ndGggPj0gTUlOX01BVENIKSB7XG4gICAgICAvL2NoZWNrX21hdGNoKHMsIHMuc3Ryc3RhcnQsIHMuc3Ryc3RhcnQgLSAxLCBzLm1hdGNoX2xlbmd0aCk7XG5cbiAgICAgIC8qKiogX3RyX3RhbGx5X2Rpc3QocywgMSwgcy5tYXRjaF9sZW5ndGggLSBNSU5fTUFUQ0gsIGJmbHVzaCk7ICoqKi9cbiAgICAgIGJmbHVzaCA9IHRyZWVzLl90cl90YWxseShzLCAxLCBzLm1hdGNoX2xlbmd0aCAtIE1JTl9NQVRDSCk7XG5cbiAgICAgIHMubG9va2FoZWFkIC09IHMubWF0Y2hfbGVuZ3RoO1xuICAgICAgcy5zdHJzdGFydCArPSBzLm1hdGNoX2xlbmd0aDtcbiAgICAgIHMubWF0Y2hfbGVuZ3RoID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgLyogTm8gbWF0Y2gsIG91dHB1dCBhIGxpdGVyYWwgYnl0ZSAqL1xuICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsXCIlY1wiLCBzLT53aW5kb3dbcy0+c3Ryc3RhcnRdKSk7XG4gICAgICAvKioqIF90cl90YWxseV9saXQocywgcy53aW5kb3dbcy5zdHJzdGFydF0sIGJmbHVzaCk7ICoqKi9cbiAgICAgIGJmbHVzaCA9IHRyZWVzLl90cl90YWxseShzLCAwLCBzLndpbmRvd1tzLnN0cnN0YXJ0XSk7XG5cbiAgICAgIHMubG9va2FoZWFkLS07XG4gICAgICBzLnN0cnN0YXJ0Kys7XG4gICAgfVxuICAgIGlmIChiZmx1c2gpIHtcbiAgICAgIC8qKiogRkxVU0hfQkxPQ0socywgMCk7ICoqKi9cbiAgICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgICAgaWYgKHMuc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgICAgcmV0dXJuIEJTX05FRURfTU9SRTtcbiAgICAgIH1cbiAgICAgIC8qKiovXG4gICAgfVxuICB9XG4gIHMuaW5zZXJ0ID0gMDtcbiAgaWYgKGZsdXNoID09PSBaX0ZJTklTSCkge1xuICAgIC8qKiogRkxVU0hfQkxPQ0socywgMSk7ICoqKi9cbiAgICBmbHVzaF9ibG9ja19vbmx5KHMsIHRydWUpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfRklOSVNIX1NUQVJURUQ7XG4gICAgfVxuICAgIC8qKiovXG4gICAgcmV0dXJuIEJTX0ZJTklTSF9ET05FO1xuICB9XG4gIGlmIChzLmxhc3RfbGl0KSB7XG4gICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgIGZsdXNoX2Jsb2NrX29ubHkocywgZmFsc2UpO1xuICAgIGlmIChzLnN0cm0uYXZhaWxfb3V0ID09PSAwKSB7XG4gICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgIH1cbiAgICAvKioqL1xuICB9XG4gIHJldHVybiBCU19CTE9DS19ET05FO1xufVxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEZvciBaX0hVRkZNQU5fT05MWSwgZG8gbm90IGxvb2sgZm9yIG1hdGNoZXMuICBEbyBub3QgbWFpbnRhaW4gYSBoYXNoIHRhYmxlLlxuICogKEl0IHdpbGwgYmUgcmVnZW5lcmF0ZWQgaWYgdGhpcyBydW4gb2YgZGVmbGF0ZSBzd2l0Y2hlcyBhd2F5IGZyb20gSHVmZm1hbi4pXG4gKi9cbmZ1bmN0aW9uIGRlZmxhdGVfaHVmZihzLCBmbHVzaCkge1xuICB2YXIgYmZsdXNoOyAgICAgICAgICAgICAvKiBzZXQgaWYgY3VycmVudCBibG9jayBtdXN0IGJlIGZsdXNoZWQgKi9cblxuICBmb3IgKDs7KSB7XG4gICAgLyogTWFrZSBzdXJlIHRoYXQgd2UgaGF2ZSBhIGxpdGVyYWwgdG8gd3JpdGUuICovXG4gICAgaWYgKHMubG9va2FoZWFkID09PSAwKSB7XG4gICAgICBmaWxsX3dpbmRvdyhzKTtcbiAgICAgIGlmIChzLmxvb2thaGVhZCA9PT0gMCkge1xuICAgICAgICBpZiAoZmx1c2ggPT09IFpfTk9fRkxVU0gpIHtcbiAgICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrOyAgICAgIC8qIGZsdXNoIHRoZSBjdXJyZW50IGJsb2NrICovXG4gICAgICB9XG4gICAgfVxuXG4gICAgLyogT3V0cHV0IGEgbGl0ZXJhbCBieXRlICovXG4gICAgcy5tYXRjaF9sZW5ndGggPSAwO1xuICAgIC8vVHJhY2V2digoc3RkZXJyLFwiJWNcIiwgcy0+d2luZG93W3MtPnN0cnN0YXJ0XSkpO1xuICAgIC8qKiogX3RyX3RhbGx5X2xpdChzLCBzLndpbmRvd1tzLnN0cnN0YXJ0XSwgYmZsdXNoKTsgKioqL1xuICAgIGJmbHVzaCA9IHRyZWVzLl90cl90YWxseShzLCAwLCBzLndpbmRvd1tzLnN0cnN0YXJ0XSk7XG4gICAgcy5sb29rYWhlYWQtLTtcbiAgICBzLnN0cnN0YXJ0Kys7XG4gICAgaWYgKGJmbHVzaCkge1xuICAgICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAwKTsgKioqL1xuICAgICAgZmx1c2hfYmxvY2tfb25seShzLCBmYWxzZSk7XG4gICAgICBpZiAocy5zdHJtLmF2YWlsX291dCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gQlNfTkVFRF9NT1JFO1xuICAgICAgfVxuICAgICAgLyoqKi9cbiAgICB9XG4gIH1cbiAgcy5pbnNlcnQgPSAwO1xuICBpZiAoZmx1c2ggPT09IFpfRklOSVNIKSB7XG4gICAgLyoqKiBGTFVTSF9CTE9DSyhzLCAxKTsgKioqL1xuICAgIGZsdXNoX2Jsb2NrX29ubHkocywgdHJ1ZSk7XG4gICAgaWYgKHMuc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgIHJldHVybiBCU19GSU5JU0hfU1RBUlRFRDtcbiAgICB9XG4gICAgLyoqKi9cbiAgICByZXR1cm4gQlNfRklOSVNIX0RPTkU7XG4gIH1cbiAgaWYgKHMubGFzdF9saXQpIHtcbiAgICAvKioqIEZMVVNIX0JMT0NLKHMsIDApOyAqKiovXG4gICAgZmx1c2hfYmxvY2tfb25seShzLCBmYWxzZSk7XG4gICAgaWYgKHMuc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgIHJldHVybiBCU19ORUVEX01PUkU7XG4gICAgfVxuICAgIC8qKiovXG4gIH1cbiAgcmV0dXJuIEJTX0JMT0NLX0RPTkU7XG59XG5cbi8qIFZhbHVlcyBmb3IgbWF4X2xhenlfbWF0Y2gsIGdvb2RfbWF0Y2ggYW5kIG1heF9jaGFpbl9sZW5ndGgsIGRlcGVuZGluZyBvblxuICogdGhlIGRlc2lyZWQgcGFjayBsZXZlbCAoMC4uOSkuIFRoZSB2YWx1ZXMgZ2l2ZW4gYmVsb3cgaGF2ZSBiZWVuIHR1bmVkIHRvXG4gKiBleGNsdWRlIHdvcnN0IGNhc2UgcGVyZm9ybWFuY2UgZm9yIHBhdGhvbG9naWNhbCBmaWxlcy4gQmV0dGVyIHZhbHVlcyBtYXkgYmVcbiAqIGZvdW5kIGZvciBzcGVjaWZpYyBmaWxlcy5cbiAqL1xuZnVuY3Rpb24gQ29uZmlnKGdvb2RfbGVuZ3RoLCBtYXhfbGF6eSwgbmljZV9sZW5ndGgsIG1heF9jaGFpbiwgZnVuYykge1xuICB0aGlzLmdvb2RfbGVuZ3RoID0gZ29vZF9sZW5ndGg7XG4gIHRoaXMubWF4X2xhenkgPSBtYXhfbGF6eTtcbiAgdGhpcy5uaWNlX2xlbmd0aCA9IG5pY2VfbGVuZ3RoO1xuICB0aGlzLm1heF9jaGFpbiA9IG1heF9jaGFpbjtcbiAgdGhpcy5mdW5jID0gZnVuYztcbn1cblxudmFyIGNvbmZpZ3VyYXRpb25fdGFibGU7XG5cbmNvbmZpZ3VyYXRpb25fdGFibGUgPSBbXG4gIC8qICAgICAgZ29vZCBsYXp5IG5pY2UgY2hhaW4gKi9cbiAgbmV3IENvbmZpZygwLCAwLCAwLCAwLCBkZWZsYXRlX3N0b3JlZCksICAgICAgICAgIC8qIDAgc3RvcmUgb25seSAqL1xuICBuZXcgQ29uZmlnKDQsIDQsIDgsIDQsIGRlZmxhdGVfZmFzdCksICAgICAgICAgICAgLyogMSBtYXggc3BlZWQsIG5vIGxhenkgbWF0Y2hlcyAqL1xuICBuZXcgQ29uZmlnKDQsIDUsIDE2LCA4LCBkZWZsYXRlX2Zhc3QpLCAgICAgICAgICAgLyogMiAqL1xuICBuZXcgQ29uZmlnKDQsIDYsIDMyLCAzMiwgZGVmbGF0ZV9mYXN0KSwgICAgICAgICAgLyogMyAqL1xuXG4gIG5ldyBDb25maWcoNCwgNCwgMTYsIDE2LCBkZWZsYXRlX3Nsb3cpLCAgICAgICAgICAvKiA0IGxhenkgbWF0Y2hlcyAqL1xuICBuZXcgQ29uZmlnKDgsIDE2LCAzMiwgMzIsIGRlZmxhdGVfc2xvdyksICAgICAgICAgLyogNSAqL1xuICBuZXcgQ29uZmlnKDgsIDE2LCAxMjgsIDEyOCwgZGVmbGF0ZV9zbG93KSwgICAgICAgLyogNiAqL1xuICBuZXcgQ29uZmlnKDgsIDMyLCAxMjgsIDI1NiwgZGVmbGF0ZV9zbG93KSwgICAgICAgLyogNyAqL1xuICBuZXcgQ29uZmlnKDMyLCAxMjgsIDI1OCwgMTAyNCwgZGVmbGF0ZV9zbG93KSwgICAgLyogOCAqL1xuICBuZXcgQ29uZmlnKDMyLCAyNTgsIDI1OCwgNDA5NiwgZGVmbGF0ZV9zbG93KSAgICAgLyogOSBtYXggY29tcHJlc3Npb24gKi9cbl07XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBJbml0aWFsaXplIHRoZSBcImxvbmdlc3QgbWF0Y2hcIiByb3V0aW5lcyBmb3IgYSBuZXcgemxpYiBzdHJlYW1cbiAqL1xuZnVuY3Rpb24gbG1faW5pdChzKSB7XG4gIHMud2luZG93X3NpemUgPSAyICogcy53X3NpemU7XG5cbiAgLyoqKiBDTEVBUl9IQVNIKHMpOyAqKiovXG4gIHplcm8ocy5oZWFkKTsgLy8gRmlsbCB3aXRoIE5JTCAoPSAwKTtcblxuICAvKiBTZXQgdGhlIGRlZmF1bHQgY29uZmlndXJhdGlvbiBwYXJhbWV0ZXJzOlxuICAgKi9cbiAgcy5tYXhfbGF6eV9tYXRjaCA9IGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0ubWF4X2xhenk7XG4gIHMuZ29vZF9tYXRjaCA9IGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0uZ29vZF9sZW5ndGg7XG4gIHMubmljZV9tYXRjaCA9IGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0ubmljZV9sZW5ndGg7XG4gIHMubWF4X2NoYWluX2xlbmd0aCA9IGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0ubWF4X2NoYWluO1xuXG4gIHMuc3Ryc3RhcnQgPSAwO1xuICBzLmJsb2NrX3N0YXJ0ID0gMDtcbiAgcy5sb29rYWhlYWQgPSAwO1xuICBzLmluc2VydCA9IDA7XG4gIHMubWF0Y2hfbGVuZ3RoID0gcy5wcmV2X2xlbmd0aCA9IE1JTl9NQVRDSCAtIDE7XG4gIHMubWF0Y2hfYXZhaWxhYmxlID0gMDtcbiAgcy5pbnNfaCA9IDA7XG59XG5cblxuZnVuY3Rpb24gRGVmbGF0ZVN0YXRlKCkge1xuICB0aGlzLnN0cm0gPSBudWxsOyAgICAgICAgICAgIC8qIHBvaW50ZXIgYmFjayB0byB0aGlzIHpsaWIgc3RyZWFtICovXG4gIHRoaXMuc3RhdHVzID0gMDsgICAgICAgICAgICAvKiBhcyB0aGUgbmFtZSBpbXBsaWVzICovXG4gIHRoaXMucGVuZGluZ19idWYgPSBudWxsOyAgICAgIC8qIG91dHB1dCBzdGlsbCBwZW5kaW5nICovXG4gIHRoaXMucGVuZGluZ19idWZfc2l6ZSA9IDA7ICAvKiBzaXplIG9mIHBlbmRpbmdfYnVmICovXG4gIHRoaXMucGVuZGluZ19vdXQgPSAwOyAgICAgICAvKiBuZXh0IHBlbmRpbmcgYnl0ZSB0byBvdXRwdXQgdG8gdGhlIHN0cmVhbSAqL1xuICB0aGlzLnBlbmRpbmcgPSAwOyAgICAgICAgICAgLyogbmIgb2YgYnl0ZXMgaW4gdGhlIHBlbmRpbmcgYnVmZmVyICovXG4gIHRoaXMud3JhcCA9IDA7ICAgICAgICAgICAgICAvKiBiaXQgMCB0cnVlIGZvciB6bGliLCBiaXQgMSB0cnVlIGZvciBnemlwICovXG4gIHRoaXMuZ3poZWFkID0gbnVsbDsgICAgICAgICAvKiBnemlwIGhlYWRlciBpbmZvcm1hdGlvbiB0byB3cml0ZSAqL1xuICB0aGlzLmd6aW5kZXggPSAwOyAgICAgICAgICAgLyogd2hlcmUgaW4gZXh0cmEsIG5hbWUsIG9yIGNvbW1lbnQgKi9cbiAgdGhpcy5tZXRob2QgPSBaX0RFRkxBVEVEOyAvKiBjYW4gb25seSBiZSBERUZMQVRFRCAqL1xuICB0aGlzLmxhc3RfZmx1c2ggPSAtMTsgICAvKiB2YWx1ZSBvZiBmbHVzaCBwYXJhbSBmb3IgcHJldmlvdXMgZGVmbGF0ZSBjYWxsICovXG5cbiAgdGhpcy53X3NpemUgPSAwOyAgLyogTFo3NyB3aW5kb3cgc2l6ZSAoMzJLIGJ5IGRlZmF1bHQpICovXG4gIHRoaXMud19iaXRzID0gMDsgIC8qIGxvZzIod19zaXplKSAgKDguLjE2KSAqL1xuICB0aGlzLndfbWFzayA9IDA7ICAvKiB3X3NpemUgLSAxICovXG5cbiAgdGhpcy53aW5kb3cgPSBudWxsO1xuICAvKiBTbGlkaW5nIHdpbmRvdy4gSW5wdXQgYnl0ZXMgYXJlIHJlYWQgaW50byB0aGUgc2Vjb25kIGhhbGYgb2YgdGhlIHdpbmRvdyxcbiAgICogYW5kIG1vdmUgdG8gdGhlIGZpcnN0IGhhbGYgbGF0ZXIgdG8ga2VlcCBhIGRpY3Rpb25hcnkgb2YgYXQgbGVhc3Qgd1NpemVcbiAgICogYnl0ZXMuIFdpdGggdGhpcyBvcmdhbml6YXRpb24sIG1hdGNoZXMgYXJlIGxpbWl0ZWQgdG8gYSBkaXN0YW5jZSBvZlxuICAgKiB3U2l6ZS1NQVhfTUFUQ0ggYnl0ZXMsIGJ1dCB0aGlzIGVuc3VyZXMgdGhhdCBJTyBpcyBhbHdheXNcbiAgICogcGVyZm9ybWVkIHdpdGggYSBsZW5ndGggbXVsdGlwbGUgb2YgdGhlIGJsb2NrIHNpemUuXG4gICAqL1xuXG4gIHRoaXMud2luZG93X3NpemUgPSAwO1xuICAvKiBBY3R1YWwgc2l6ZSBvZiB3aW5kb3c6IDIqd1NpemUsIGV4Y2VwdCB3aGVuIHRoZSB1c2VyIGlucHV0IGJ1ZmZlclxuICAgKiBpcyBkaXJlY3RseSB1c2VkIGFzIHNsaWRpbmcgd2luZG93LlxuICAgKi9cblxuICB0aGlzLnByZXYgPSBudWxsO1xuICAvKiBMaW5rIHRvIG9sZGVyIHN0cmluZyB3aXRoIHNhbWUgaGFzaCBpbmRleC4gVG8gbGltaXQgdGhlIHNpemUgb2YgdGhpc1xuICAgKiBhcnJheSB0byA2NEssIHRoaXMgbGluayBpcyBtYWludGFpbmVkIG9ubHkgZm9yIHRoZSBsYXN0IDMySyBzdHJpbmdzLlxuICAgKiBBbiBpbmRleCBpbiB0aGlzIGFycmF5IGlzIHRodXMgYSB3aW5kb3cgaW5kZXggbW9kdWxvIDMySy5cbiAgICovXG5cbiAgdGhpcy5oZWFkID0gbnVsbDsgICAvKiBIZWFkcyBvZiB0aGUgaGFzaCBjaGFpbnMgb3IgTklMLiAqL1xuXG4gIHRoaXMuaW5zX2ggPSAwOyAgICAgICAvKiBoYXNoIGluZGV4IG9mIHN0cmluZyB0byBiZSBpbnNlcnRlZCAqL1xuICB0aGlzLmhhc2hfc2l6ZSA9IDA7ICAgLyogbnVtYmVyIG9mIGVsZW1lbnRzIGluIGhhc2ggdGFibGUgKi9cbiAgdGhpcy5oYXNoX2JpdHMgPSAwOyAgIC8qIGxvZzIoaGFzaF9zaXplKSAqL1xuICB0aGlzLmhhc2hfbWFzayA9IDA7ICAgLyogaGFzaF9zaXplLTEgKi9cblxuICB0aGlzLmhhc2hfc2hpZnQgPSAwO1xuICAvKiBOdW1iZXIgb2YgYml0cyBieSB3aGljaCBpbnNfaCBtdXN0IGJlIHNoaWZ0ZWQgYXQgZWFjaCBpbnB1dFxuICAgKiBzdGVwLiBJdCBtdXN0IGJlIHN1Y2ggdGhhdCBhZnRlciBNSU5fTUFUQ0ggc3RlcHMsIHRoZSBvbGRlc3RcbiAgICogYnl0ZSBubyBsb25nZXIgdGFrZXMgcGFydCBpbiB0aGUgaGFzaCBrZXksIHRoYXQgaXM6XG4gICAqICAgaGFzaF9zaGlmdCAqIE1JTl9NQVRDSCA+PSBoYXNoX2JpdHNcbiAgICovXG5cbiAgdGhpcy5ibG9ja19zdGFydCA9IDA7XG4gIC8qIFdpbmRvdyBwb3NpdGlvbiBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBjdXJyZW50IG91dHB1dCBibG9jay4gR2V0c1xuICAgKiBuZWdhdGl2ZSB3aGVuIHRoZSB3aW5kb3cgaXMgbW92ZWQgYmFja3dhcmRzLlxuICAgKi9cblxuICB0aGlzLm1hdGNoX2xlbmd0aCA9IDA7ICAgICAgLyogbGVuZ3RoIG9mIGJlc3QgbWF0Y2ggKi9cbiAgdGhpcy5wcmV2X21hdGNoID0gMDsgICAgICAgIC8qIHByZXZpb3VzIG1hdGNoICovXG4gIHRoaXMubWF0Y2hfYXZhaWxhYmxlID0gMDsgICAvKiBzZXQgaWYgcHJldmlvdXMgbWF0Y2ggZXhpc3RzICovXG4gIHRoaXMuc3Ryc3RhcnQgPSAwOyAgICAgICAgICAvKiBzdGFydCBvZiBzdHJpbmcgdG8gaW5zZXJ0ICovXG4gIHRoaXMubWF0Y2hfc3RhcnQgPSAwOyAgICAgICAvKiBzdGFydCBvZiBtYXRjaGluZyBzdHJpbmcgKi9cbiAgdGhpcy5sb29rYWhlYWQgPSAwOyAgICAgICAgIC8qIG51bWJlciBvZiB2YWxpZCBieXRlcyBhaGVhZCBpbiB3aW5kb3cgKi9cblxuICB0aGlzLnByZXZfbGVuZ3RoID0gMDtcbiAgLyogTGVuZ3RoIG9mIHRoZSBiZXN0IG1hdGNoIGF0IHByZXZpb3VzIHN0ZXAuIE1hdGNoZXMgbm90IGdyZWF0ZXIgdGhhbiB0aGlzXG4gICAqIGFyZSBkaXNjYXJkZWQuIFRoaXMgaXMgdXNlZCBpbiB0aGUgbGF6eSBtYXRjaCBldmFsdWF0aW9uLlxuICAgKi9cblxuICB0aGlzLm1heF9jaGFpbl9sZW5ndGggPSAwO1xuICAvKiBUbyBzcGVlZCB1cCBkZWZsYXRpb24sIGhhc2ggY2hhaW5zIGFyZSBuZXZlciBzZWFyY2hlZCBiZXlvbmQgdGhpc1xuICAgKiBsZW5ndGguICBBIGhpZ2hlciBsaW1pdCBpbXByb3ZlcyBjb21wcmVzc2lvbiByYXRpbyBidXQgZGVncmFkZXMgdGhlXG4gICAqIHNwZWVkLlxuICAgKi9cblxuICB0aGlzLm1heF9sYXp5X21hdGNoID0gMDtcbiAgLyogQXR0ZW1wdCB0byBmaW5kIGEgYmV0dGVyIG1hdGNoIG9ubHkgd2hlbiB0aGUgY3VycmVudCBtYXRjaCBpcyBzdHJpY3RseVxuICAgKiBzbWFsbGVyIHRoYW4gdGhpcyB2YWx1ZS4gVGhpcyBtZWNoYW5pc20gaXMgdXNlZCBvbmx5IGZvciBjb21wcmVzc2lvblxuICAgKiBsZXZlbHMgPj0gNC5cbiAgICovXG4gIC8vIFRoYXQncyBhbGlhcyB0byBtYXhfbGF6eV9tYXRjaCwgZG9uJ3QgdXNlIGRpcmVjdGx5XG4gIC8vdGhpcy5tYXhfaW5zZXJ0X2xlbmd0aCA9IDA7XG4gIC8qIEluc2VydCBuZXcgc3RyaW5ncyBpbiB0aGUgaGFzaCB0YWJsZSBvbmx5IGlmIHRoZSBtYXRjaCBsZW5ndGggaXMgbm90XG4gICAqIGdyZWF0ZXIgdGhhbiB0aGlzIGxlbmd0aC4gVGhpcyBzYXZlcyB0aW1lIGJ1dCBkZWdyYWRlcyBjb21wcmVzc2lvbi5cbiAgICogbWF4X2luc2VydF9sZW5ndGggaXMgdXNlZCBvbmx5IGZvciBjb21wcmVzc2lvbiBsZXZlbHMgPD0gMy5cbiAgICovXG5cbiAgdGhpcy5sZXZlbCA9IDA7ICAgICAvKiBjb21wcmVzc2lvbiBsZXZlbCAoMS4uOSkgKi9cbiAgdGhpcy5zdHJhdGVneSA9IDA7ICAvKiBmYXZvciBvciBmb3JjZSBIdWZmbWFuIGNvZGluZyovXG5cbiAgdGhpcy5nb29kX21hdGNoID0gMDtcbiAgLyogVXNlIGEgZmFzdGVyIHNlYXJjaCB3aGVuIHRoZSBwcmV2aW91cyBtYXRjaCBpcyBsb25nZXIgdGhhbiB0aGlzICovXG5cbiAgdGhpcy5uaWNlX21hdGNoID0gMDsgLyogU3RvcCBzZWFyY2hpbmcgd2hlbiBjdXJyZW50IG1hdGNoIGV4Y2VlZHMgdGhpcyAqL1xuXG4gICAgICAgICAgICAgIC8qIHVzZWQgYnkgdHJlZXMuYzogKi9cblxuICAvKiBEaWRuJ3QgdXNlIGN0X2RhdGEgdHlwZWRlZiBiZWxvdyB0byBzdXBwcmVzcyBjb21waWxlciB3YXJuaW5nICovXG5cbiAgLy8gc3RydWN0IGN0X2RhdGFfcyBkeW5fbHRyZWVbSEVBUF9TSVpFXTsgICAvKiBsaXRlcmFsIGFuZCBsZW5ndGggdHJlZSAqL1xuICAvLyBzdHJ1Y3QgY3RfZGF0YV9zIGR5bl9kdHJlZVsyKkRfQ09ERVMrMV07IC8qIGRpc3RhbmNlIHRyZWUgKi9cbiAgLy8gc3RydWN0IGN0X2RhdGFfcyBibF90cmVlWzIqQkxfQ09ERVMrMV07ICAvKiBIdWZmbWFuIHRyZWUgZm9yIGJpdCBsZW5ndGhzICovXG5cbiAgLy8gVXNlIGZsYXQgYXJyYXkgb2YgRE9VQkxFIHNpemUsIHdpdGggaW50ZXJsZWF2ZWQgZmF0YSxcbiAgLy8gYmVjYXVzZSBKUyBkb2VzIG5vdCBzdXBwb3J0IGVmZmVjdGl2ZVxuICB0aGlzLmR5bl9sdHJlZSAgPSBuZXcgdXRpbHMuQnVmMTYoSEVBUF9TSVpFICogMik7XG4gIHRoaXMuZHluX2R0cmVlICA9IG5ldyB1dGlscy5CdWYxNigoMiAqIERfQ09ERVMgKyAxKSAqIDIpO1xuICB0aGlzLmJsX3RyZWUgICAgPSBuZXcgdXRpbHMuQnVmMTYoKDIgKiBCTF9DT0RFUyArIDEpICogMik7XG4gIHplcm8odGhpcy5keW5fbHRyZWUpO1xuICB6ZXJvKHRoaXMuZHluX2R0cmVlKTtcbiAgemVybyh0aGlzLmJsX3RyZWUpO1xuXG4gIHRoaXMubF9kZXNjICAgPSBudWxsOyAgICAgICAgIC8qIGRlc2MuIGZvciBsaXRlcmFsIHRyZWUgKi9cbiAgdGhpcy5kX2Rlc2MgICA9IG51bGw7ICAgICAgICAgLyogZGVzYy4gZm9yIGRpc3RhbmNlIHRyZWUgKi9cbiAgdGhpcy5ibF9kZXNjICA9IG51bGw7ICAgICAgICAgLyogZGVzYy4gZm9yIGJpdCBsZW5ndGggdHJlZSAqL1xuXG4gIC8vdXNoIGJsX2NvdW50W01BWF9CSVRTKzFdO1xuICB0aGlzLmJsX2NvdW50ID0gbmV3IHV0aWxzLkJ1ZjE2KE1BWF9CSVRTICsgMSk7XG4gIC8qIG51bWJlciBvZiBjb2RlcyBhdCBlYWNoIGJpdCBsZW5ndGggZm9yIGFuIG9wdGltYWwgdHJlZSAqL1xuXG4gIC8vaW50IGhlYXBbMipMX0NPREVTKzFdOyAgICAgIC8qIGhlYXAgdXNlZCB0byBidWlsZCB0aGUgSHVmZm1hbiB0cmVlcyAqL1xuICB0aGlzLmhlYXAgPSBuZXcgdXRpbHMuQnVmMTYoMiAqIExfQ09ERVMgKyAxKTsgIC8qIGhlYXAgdXNlZCB0byBidWlsZCB0aGUgSHVmZm1hbiB0cmVlcyAqL1xuICB6ZXJvKHRoaXMuaGVhcCk7XG5cbiAgdGhpcy5oZWFwX2xlbiA9IDA7ICAgICAgICAgICAgICAgLyogbnVtYmVyIG9mIGVsZW1lbnRzIGluIHRoZSBoZWFwICovXG4gIHRoaXMuaGVhcF9tYXggPSAwOyAgICAgICAgICAgICAgIC8qIGVsZW1lbnQgb2YgbGFyZ2VzdCBmcmVxdWVuY3kgKi9cbiAgLyogVGhlIHNvbnMgb2YgaGVhcFtuXSBhcmUgaGVhcFsyKm5dIGFuZCBoZWFwWzIqbisxXS4gaGVhcFswXSBpcyBub3QgdXNlZC5cbiAgICogVGhlIHNhbWUgaGVhcCBhcnJheSBpcyB1c2VkIHRvIGJ1aWxkIGFsbCB0cmVlcy5cbiAgICovXG5cbiAgdGhpcy5kZXB0aCA9IG5ldyB1dGlscy5CdWYxNigyICogTF9DT0RFUyArIDEpOyAvL3VjaCBkZXB0aFsyKkxfQ09ERVMrMV07XG4gIHplcm8odGhpcy5kZXB0aCk7XG4gIC8qIERlcHRoIG9mIGVhY2ggc3VidHJlZSB1c2VkIGFzIHRpZSBicmVha2VyIGZvciB0cmVlcyBvZiBlcXVhbCBmcmVxdWVuY3lcbiAgICovXG5cbiAgdGhpcy5sX2J1ZiA9IDA7ICAgICAgICAgIC8qIGJ1ZmZlciBpbmRleCBmb3IgbGl0ZXJhbHMgb3IgbGVuZ3RocyAqL1xuXG4gIHRoaXMubGl0X2J1ZnNpemUgPSAwO1xuICAvKiBTaXplIG9mIG1hdGNoIGJ1ZmZlciBmb3IgbGl0ZXJhbHMvbGVuZ3Rocy4gIFRoZXJlIGFyZSA0IHJlYXNvbnMgZm9yXG4gICAqIGxpbWl0aW5nIGxpdF9idWZzaXplIHRvIDY0SzpcbiAgICogICAtIGZyZXF1ZW5jaWVzIGNhbiBiZSBrZXB0IGluIDE2IGJpdCBjb3VudGVyc1xuICAgKiAgIC0gaWYgY29tcHJlc3Npb24gaXMgbm90IHN1Y2Nlc3NmdWwgZm9yIHRoZSBmaXJzdCBibG9jaywgYWxsIGlucHV0XG4gICAqICAgICBkYXRhIGlzIHN0aWxsIGluIHRoZSB3aW5kb3cgc28gd2UgY2FuIHN0aWxsIGVtaXQgYSBzdG9yZWQgYmxvY2sgZXZlblxuICAgKiAgICAgd2hlbiBpbnB1dCBjb21lcyBmcm9tIHN0YW5kYXJkIGlucHV0LiAgKFRoaXMgY2FuIGFsc28gYmUgZG9uZSBmb3JcbiAgICogICAgIGFsbCBibG9ja3MgaWYgbGl0X2J1ZnNpemUgaXMgbm90IGdyZWF0ZXIgdGhhbiAzMksuKVxuICAgKiAgIC0gaWYgY29tcHJlc3Npb24gaXMgbm90IHN1Y2Nlc3NmdWwgZm9yIGEgZmlsZSBzbWFsbGVyIHRoYW4gNjRLLCB3ZSBjYW5cbiAgICogICAgIGV2ZW4gZW1pdCBhIHN0b3JlZCBmaWxlIGluc3RlYWQgb2YgYSBzdG9yZWQgYmxvY2sgKHNhdmluZyA1IGJ5dGVzKS5cbiAgICogICAgIFRoaXMgaXMgYXBwbGljYWJsZSBvbmx5IGZvciB6aXAgKG5vdCBnemlwIG9yIHpsaWIpLlxuICAgKiAgIC0gY3JlYXRpbmcgbmV3IEh1ZmZtYW4gdHJlZXMgbGVzcyBmcmVxdWVudGx5IG1heSBub3QgcHJvdmlkZSBmYXN0XG4gICAqICAgICBhZGFwdGF0aW9uIHRvIGNoYW5nZXMgaW4gdGhlIGlucHV0IGRhdGEgc3RhdGlzdGljcy4gKFRha2UgZm9yXG4gICAqICAgICBleGFtcGxlIGEgYmluYXJ5IGZpbGUgd2l0aCBwb29ybHkgY29tcHJlc3NpYmxlIGNvZGUgZm9sbG93ZWQgYnlcbiAgICogICAgIGEgaGlnaGx5IGNvbXByZXNzaWJsZSBzdHJpbmcgdGFibGUuKSBTbWFsbGVyIGJ1ZmZlciBzaXplcyBnaXZlXG4gICAqICAgICBmYXN0IGFkYXB0YXRpb24gYnV0IGhhdmUgb2YgY291cnNlIHRoZSBvdmVyaGVhZCBvZiB0cmFuc21pdHRpbmdcbiAgICogICAgIHRyZWVzIG1vcmUgZnJlcXVlbnRseS5cbiAgICogICAtIEkgY2FuJ3QgY291bnQgYWJvdmUgNFxuICAgKi9cblxuICB0aGlzLmxhc3RfbGl0ID0gMDsgICAgICAvKiBydW5uaW5nIGluZGV4IGluIGxfYnVmICovXG5cbiAgdGhpcy5kX2J1ZiA9IDA7XG4gIC8qIEJ1ZmZlciBpbmRleCBmb3IgZGlzdGFuY2VzLiBUbyBzaW1wbGlmeSB0aGUgY29kZSwgZF9idWYgYW5kIGxfYnVmIGhhdmVcbiAgICogdGhlIHNhbWUgbnVtYmVyIG9mIGVsZW1lbnRzLiBUbyB1c2UgZGlmZmVyZW50IGxlbmd0aHMsIGFuIGV4dHJhIGZsYWdcbiAgICogYXJyYXkgd291bGQgYmUgbmVjZXNzYXJ5LlxuICAgKi9cblxuICB0aGlzLm9wdF9sZW4gPSAwOyAgICAgICAvKiBiaXQgbGVuZ3RoIG9mIGN1cnJlbnQgYmxvY2sgd2l0aCBvcHRpbWFsIHRyZWVzICovXG4gIHRoaXMuc3RhdGljX2xlbiA9IDA7ICAgIC8qIGJpdCBsZW5ndGggb2YgY3VycmVudCBibG9jayB3aXRoIHN0YXRpYyB0cmVlcyAqL1xuICB0aGlzLm1hdGNoZXMgPSAwOyAgICAgICAvKiBudW1iZXIgb2Ygc3RyaW5nIG1hdGNoZXMgaW4gY3VycmVudCBibG9jayAqL1xuICB0aGlzLmluc2VydCA9IDA7ICAgICAgICAvKiBieXRlcyBhdCBlbmQgb2Ygd2luZG93IGxlZnQgdG8gaW5zZXJ0ICovXG5cblxuICB0aGlzLmJpX2J1ZiA9IDA7XG4gIC8qIE91dHB1dCBidWZmZXIuIGJpdHMgYXJlIGluc2VydGVkIHN0YXJ0aW5nIGF0IHRoZSBib3R0b20gKGxlYXN0XG4gICAqIHNpZ25pZmljYW50IGJpdHMpLlxuICAgKi9cbiAgdGhpcy5iaV92YWxpZCA9IDA7XG4gIC8qIE51bWJlciBvZiB2YWxpZCBiaXRzIGluIGJpX2J1Zi4gIEFsbCBiaXRzIGFib3ZlIHRoZSBsYXN0IHZhbGlkIGJpdFxuICAgKiBhcmUgYWx3YXlzIHplcm8uXG4gICAqL1xuXG4gIC8vIFVzZWQgZm9yIHdpbmRvdyBtZW1vcnkgaW5pdC4gV2Ugc2FmZWx5IGlnbm9yZSBpdCBmb3IgSlMuIFRoYXQgbWFrZXNcbiAgLy8gc2Vuc2Ugb25seSBmb3IgcG9pbnRlcnMgYW5kIG1lbW9yeSBjaGVjayB0b29scy5cbiAgLy90aGlzLmhpZ2hfd2F0ZXIgPSAwO1xuICAvKiBIaWdoIHdhdGVyIG1hcmsgb2Zmc2V0IGluIHdpbmRvdyBmb3IgaW5pdGlhbGl6ZWQgYnl0ZXMgLS0gYnl0ZXMgYWJvdmVcbiAgICogdGhpcyBhcmUgc2V0IHRvIHplcm8gaW4gb3JkZXIgdG8gYXZvaWQgbWVtb3J5IGNoZWNrIHdhcm5pbmdzIHdoZW5cbiAgICogbG9uZ2VzdCBtYXRjaCByb3V0aW5lcyBhY2Nlc3MgYnl0ZXMgcGFzdCB0aGUgaW5wdXQuICBUaGlzIGlzIHRoZW5cbiAgICogdXBkYXRlZCB0byB0aGUgbmV3IGhpZ2ggd2F0ZXIgbWFyay5cbiAgICovXG59XG5cblxuZnVuY3Rpb24gZGVmbGF0ZVJlc2V0S2VlcChzdHJtKSB7XG4gIHZhciBzO1xuXG4gIGlmICghc3RybSB8fCAhc3RybS5zdGF0ZSkge1xuICAgIHJldHVybiBlcnIoc3RybSwgWl9TVFJFQU1fRVJST1IpO1xuICB9XG5cbiAgc3RybS50b3RhbF9pbiA9IHN0cm0udG90YWxfb3V0ID0gMDtcbiAgc3RybS5kYXRhX3R5cGUgPSBaX1VOS05PV047XG5cbiAgcyA9IHN0cm0uc3RhdGU7XG4gIHMucGVuZGluZyA9IDA7XG4gIHMucGVuZGluZ19vdXQgPSAwO1xuXG4gIGlmIChzLndyYXAgPCAwKSB7XG4gICAgcy53cmFwID0gLXMud3JhcDtcbiAgICAvKiB3YXMgbWFkZSBuZWdhdGl2ZSBieSBkZWZsYXRlKC4uLiwgWl9GSU5JU0gpOyAqL1xuICB9XG4gIHMuc3RhdHVzID0gKHMud3JhcCA/IElOSVRfU1RBVEUgOiBCVVNZX1NUQVRFKTtcbiAgc3RybS5hZGxlciA9IChzLndyYXAgPT09IDIpID9cbiAgICAwICAvLyBjcmMzMigwLCBaX05VTEwsIDApXG4gIDpcbiAgICAxOyAvLyBhZGxlcjMyKDAsIFpfTlVMTCwgMClcbiAgcy5sYXN0X2ZsdXNoID0gWl9OT19GTFVTSDtcbiAgdHJlZXMuX3RyX2luaXQocyk7XG4gIHJldHVybiBaX09LO1xufVxuXG5cbmZ1bmN0aW9uIGRlZmxhdGVSZXNldChzdHJtKSB7XG4gIHZhciByZXQgPSBkZWZsYXRlUmVzZXRLZWVwKHN0cm0pO1xuICBpZiAocmV0ID09PSBaX09LKSB7XG4gICAgbG1faW5pdChzdHJtLnN0YXRlKTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG5cbmZ1bmN0aW9uIGRlZmxhdGVTZXRIZWFkZXIoc3RybSwgaGVhZCkge1xuICBpZiAoIXN0cm0gfHwgIXN0cm0uc3RhdGUpIHsgcmV0dXJuIFpfU1RSRUFNX0VSUk9SOyB9XG4gIGlmIChzdHJtLnN0YXRlLndyYXAgIT09IDIpIHsgcmV0dXJuIFpfU1RSRUFNX0VSUk9SOyB9XG4gIHN0cm0uc3RhdGUuZ3poZWFkID0gaGVhZDtcbiAgcmV0dXJuIFpfT0s7XG59XG5cblxuZnVuY3Rpb24gZGVmbGF0ZUluaXQyKHN0cm0sIGxldmVsLCBtZXRob2QsIHdpbmRvd0JpdHMsIG1lbUxldmVsLCBzdHJhdGVneSkge1xuICBpZiAoIXN0cm0pIHsgLy8gPT09IFpfTlVMTFxuICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUjtcbiAgfVxuICB2YXIgd3JhcCA9IDE7XG5cbiAgaWYgKGxldmVsID09PSBaX0RFRkFVTFRfQ09NUFJFU1NJT04pIHtcbiAgICBsZXZlbCA9IDY7XG4gIH1cblxuICBpZiAod2luZG93Qml0cyA8IDApIHsgLyogc3VwcHJlc3MgemxpYiB3cmFwcGVyICovXG4gICAgd3JhcCA9IDA7XG4gICAgd2luZG93Qml0cyA9IC13aW5kb3dCaXRzO1xuICB9XG5cbiAgZWxzZSBpZiAod2luZG93Qml0cyA+IDE1KSB7XG4gICAgd3JhcCA9IDI7ICAgICAgICAgICAvKiB3cml0ZSBnemlwIHdyYXBwZXIgaW5zdGVhZCAqL1xuICAgIHdpbmRvd0JpdHMgLT0gMTY7XG4gIH1cblxuXG4gIGlmIChtZW1MZXZlbCA8IDEgfHwgbWVtTGV2ZWwgPiBNQVhfTUVNX0xFVkVMIHx8IG1ldGhvZCAhPT0gWl9ERUZMQVRFRCB8fFxuICAgIHdpbmRvd0JpdHMgPCA4IHx8IHdpbmRvd0JpdHMgPiAxNSB8fCBsZXZlbCA8IDAgfHwgbGV2ZWwgPiA5IHx8XG4gICAgc3RyYXRlZ3kgPCAwIHx8IHN0cmF0ZWd5ID4gWl9GSVhFRCkge1xuICAgIHJldHVybiBlcnIoc3RybSwgWl9TVFJFQU1fRVJST1IpO1xuICB9XG5cblxuICBpZiAod2luZG93Qml0cyA9PT0gOCkge1xuICAgIHdpbmRvd0JpdHMgPSA5O1xuICB9XG4gIC8qIHVudGlsIDI1Ni1ieXRlIHdpbmRvdyBidWcgZml4ZWQgKi9cblxuICB2YXIgcyA9IG5ldyBEZWZsYXRlU3RhdGUoKTtcblxuICBzdHJtLnN0YXRlID0gcztcbiAgcy5zdHJtID0gc3RybTtcblxuICBzLndyYXAgPSB3cmFwO1xuICBzLmd6aGVhZCA9IG51bGw7XG4gIHMud19iaXRzID0gd2luZG93Qml0cztcbiAgcy53X3NpemUgPSAxIDw8IHMud19iaXRzO1xuICBzLndfbWFzayA9IHMud19zaXplIC0gMTtcblxuICBzLmhhc2hfYml0cyA9IG1lbUxldmVsICsgNztcbiAgcy5oYXNoX3NpemUgPSAxIDw8IHMuaGFzaF9iaXRzO1xuICBzLmhhc2hfbWFzayA9IHMuaGFzaF9zaXplIC0gMTtcbiAgcy5oYXNoX3NoaWZ0ID0gfn4oKHMuaGFzaF9iaXRzICsgTUlOX01BVENIIC0gMSkgLyBNSU5fTUFUQ0gpO1xuXG4gIHMud2luZG93ID0gbmV3IHV0aWxzLkJ1Zjgocy53X3NpemUgKiAyKTtcbiAgcy5oZWFkID0gbmV3IHV0aWxzLkJ1ZjE2KHMuaGFzaF9zaXplKTtcbiAgcy5wcmV2ID0gbmV3IHV0aWxzLkJ1ZjE2KHMud19zaXplKTtcblxuICAvLyBEb24ndCBuZWVkIG1lbSBpbml0IG1hZ2ljIGZvciBKUy5cbiAgLy9zLmhpZ2hfd2F0ZXIgPSAwOyAgLyogbm90aGluZyB3cml0dGVuIHRvIHMtPndpbmRvdyB5ZXQgKi9cblxuICBzLmxpdF9idWZzaXplID0gMSA8PCAobWVtTGV2ZWwgKyA2KTsgLyogMTZLIGVsZW1lbnRzIGJ5IGRlZmF1bHQgKi9cblxuICBzLnBlbmRpbmdfYnVmX3NpemUgPSBzLmxpdF9idWZzaXplICogNDtcblxuICAvL292ZXJsYXkgPSAodXNoZiAqKSBaQUxMT0Moc3RybSwgcy0+bGl0X2J1ZnNpemUsIHNpemVvZih1c2gpKzIpO1xuICAvL3MtPnBlbmRpbmdfYnVmID0gKHVjaGYgKikgb3ZlcmxheTtcbiAgcy5wZW5kaW5nX2J1ZiA9IG5ldyB1dGlscy5CdWY4KHMucGVuZGluZ19idWZfc2l6ZSk7XG5cbiAgLy8gSXQgaXMgb2Zmc2V0IGZyb20gYHMucGVuZGluZ19idWZgIChzaXplIGlzIGBzLmxpdF9idWZzaXplICogMmApXG4gIC8vcy0+ZF9idWYgPSBvdmVybGF5ICsgcy0+bGl0X2J1ZnNpemUvc2l6ZW9mKHVzaCk7XG4gIHMuZF9idWYgPSAxICogcy5saXRfYnVmc2l6ZTtcblxuICAvL3MtPmxfYnVmID0gcy0+cGVuZGluZ19idWYgKyAoMStzaXplb2YodXNoKSkqcy0+bGl0X2J1ZnNpemU7XG4gIHMubF9idWYgPSAoMSArIDIpICogcy5saXRfYnVmc2l6ZTtcblxuICBzLmxldmVsID0gbGV2ZWw7XG4gIHMuc3RyYXRlZ3kgPSBzdHJhdGVneTtcbiAgcy5tZXRob2QgPSBtZXRob2Q7XG5cbiAgcmV0dXJuIGRlZmxhdGVSZXNldChzdHJtKTtcbn1cblxuZnVuY3Rpb24gZGVmbGF0ZUluaXQoc3RybSwgbGV2ZWwpIHtcbiAgcmV0dXJuIGRlZmxhdGVJbml0MihzdHJtLCBsZXZlbCwgWl9ERUZMQVRFRCwgTUFYX1dCSVRTLCBERUZfTUVNX0xFVkVMLCBaX0RFRkFVTFRfU1RSQVRFR1kpO1xufVxuXG5cbmZ1bmN0aW9uIGRlZmxhdGUoc3RybSwgZmx1c2gpIHtcbiAgdmFyIG9sZF9mbHVzaCwgcztcbiAgdmFyIGJlZywgdmFsOyAvLyBmb3IgZ3ppcCBoZWFkZXIgd3JpdGUgb25seVxuXG4gIGlmICghc3RybSB8fCAhc3RybS5zdGF0ZSB8fFxuICAgIGZsdXNoID4gWl9CTE9DSyB8fCBmbHVzaCA8IDApIHtcbiAgICByZXR1cm4gc3RybSA/IGVycihzdHJtLCBaX1NUUkVBTV9FUlJPUikgOiBaX1NUUkVBTV9FUlJPUjtcbiAgfVxuXG4gIHMgPSBzdHJtLnN0YXRlO1xuXG4gIGlmICghc3RybS5vdXRwdXQgfHxcbiAgICAgICghc3RybS5pbnB1dCAmJiBzdHJtLmF2YWlsX2luICE9PSAwKSB8fFxuICAgICAgKHMuc3RhdHVzID09PSBGSU5JU0hfU1RBVEUgJiYgZmx1c2ggIT09IFpfRklOSVNIKSkge1xuICAgIHJldHVybiBlcnIoc3RybSwgKHN0cm0uYXZhaWxfb3V0ID09PSAwKSA/IFpfQlVGX0VSUk9SIDogWl9TVFJFQU1fRVJST1IpO1xuICB9XG5cbiAgcy5zdHJtID0gc3RybTsgLyoganVzdCBpbiBjYXNlICovXG4gIG9sZF9mbHVzaCA9IHMubGFzdF9mbHVzaDtcbiAgcy5sYXN0X2ZsdXNoID0gZmx1c2g7XG5cbiAgLyogV3JpdGUgdGhlIGhlYWRlciAqL1xuICBpZiAocy5zdGF0dXMgPT09IElOSVRfU1RBVEUpIHtcblxuICAgIGlmIChzLndyYXAgPT09IDIpIHsgLy8gR1pJUCBoZWFkZXJcbiAgICAgIHN0cm0uYWRsZXIgPSAwOyAgLy9jcmMzMigwTCwgWl9OVUxMLCAwKTtcbiAgICAgIHB1dF9ieXRlKHMsIDMxKTtcbiAgICAgIHB1dF9ieXRlKHMsIDEzOSk7XG4gICAgICBwdXRfYnl0ZShzLCA4KTtcbiAgICAgIGlmICghcy5nemhlYWQpIHsgLy8gcy0+Z3poZWFkID09IFpfTlVMTFxuICAgICAgICBwdXRfYnl0ZShzLCAwKTtcbiAgICAgICAgcHV0X2J5dGUocywgMCk7XG4gICAgICAgIHB1dF9ieXRlKHMsIDApO1xuICAgICAgICBwdXRfYnl0ZShzLCAwKTtcbiAgICAgICAgcHV0X2J5dGUocywgMCk7XG4gICAgICAgIHB1dF9ieXRlKHMsIHMubGV2ZWwgPT09IDkgPyAyIDpcbiAgICAgICAgICAgICAgICAgICAgKHMuc3RyYXRlZ3kgPj0gWl9IVUZGTUFOX09OTFkgfHwgcy5sZXZlbCA8IDIgP1xuICAgICAgICAgICAgICAgICAgICAgNCA6IDApKTtcbiAgICAgICAgcHV0X2J5dGUocywgT1NfQ09ERSk7XG4gICAgICAgIHMuc3RhdHVzID0gQlVTWV9TVEFURTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBwdXRfYnl0ZShzLCAocy5nemhlYWQudGV4dCA/IDEgOiAwKSArXG4gICAgICAgICAgICAgICAgICAgIChzLmd6aGVhZC5oY3JjID8gMiA6IDApICtcbiAgICAgICAgICAgICAgICAgICAgKCFzLmd6aGVhZC5leHRyYSA/IDAgOiA0KSArXG4gICAgICAgICAgICAgICAgICAgICghcy5nemhlYWQubmFtZSA/IDAgOiA4KSArXG4gICAgICAgICAgICAgICAgICAgICghcy5nemhlYWQuY29tbWVudCA/IDAgOiAxNilcbiAgICAgICAgKTtcbiAgICAgICAgcHV0X2J5dGUocywgcy5nemhlYWQudGltZSAmIDB4ZmYpO1xuICAgICAgICBwdXRfYnl0ZShzLCAocy5nemhlYWQudGltZSA+PiA4KSAmIDB4ZmYpO1xuICAgICAgICBwdXRfYnl0ZShzLCAocy5nemhlYWQudGltZSA+PiAxNikgJiAweGZmKTtcbiAgICAgICAgcHV0X2J5dGUocywgKHMuZ3poZWFkLnRpbWUgPj4gMjQpICYgMHhmZik7XG4gICAgICAgIHB1dF9ieXRlKHMsIHMubGV2ZWwgPT09IDkgPyAyIDpcbiAgICAgICAgICAgICAgICAgICAgKHMuc3RyYXRlZ3kgPj0gWl9IVUZGTUFOX09OTFkgfHwgcy5sZXZlbCA8IDIgP1xuICAgICAgICAgICAgICAgICAgICAgNCA6IDApKTtcbiAgICAgICAgcHV0X2J5dGUocywgcy5nemhlYWQub3MgJiAweGZmKTtcbiAgICAgICAgaWYgKHMuZ3poZWFkLmV4dHJhICYmIHMuZ3poZWFkLmV4dHJhLmxlbmd0aCkge1xuICAgICAgICAgIHB1dF9ieXRlKHMsIHMuZ3poZWFkLmV4dHJhLmxlbmd0aCAmIDB4ZmYpO1xuICAgICAgICAgIHB1dF9ieXRlKHMsIChzLmd6aGVhZC5leHRyYS5sZW5ndGggPj4gOCkgJiAweGZmKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocy5nemhlYWQuaGNyYykge1xuICAgICAgICAgIHN0cm0uYWRsZXIgPSBjcmMzMihzdHJtLmFkbGVyLCBzLnBlbmRpbmdfYnVmLCBzLnBlbmRpbmcsIDApO1xuICAgICAgICB9XG4gICAgICAgIHMuZ3ppbmRleCA9IDA7XG4gICAgICAgIHMuc3RhdHVzID0gRVhUUkFfU1RBVEU7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2UgLy8gREVGTEFURSBoZWFkZXJcbiAgICB7XG4gICAgICB2YXIgaGVhZGVyID0gKFpfREVGTEFURUQgKyAoKHMud19iaXRzIC0gOCkgPDwgNCkpIDw8IDg7XG4gICAgICB2YXIgbGV2ZWxfZmxhZ3MgPSAtMTtcblxuICAgICAgaWYgKHMuc3RyYXRlZ3kgPj0gWl9IVUZGTUFOX09OTFkgfHwgcy5sZXZlbCA8IDIpIHtcbiAgICAgICAgbGV2ZWxfZmxhZ3MgPSAwO1xuICAgICAgfSBlbHNlIGlmIChzLmxldmVsIDwgNikge1xuICAgICAgICBsZXZlbF9mbGFncyA9IDE7XG4gICAgICB9IGVsc2UgaWYgKHMubGV2ZWwgPT09IDYpIHtcbiAgICAgICAgbGV2ZWxfZmxhZ3MgPSAyO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxfZmxhZ3MgPSAzO1xuICAgICAgfVxuICAgICAgaGVhZGVyIHw9IChsZXZlbF9mbGFncyA8PCA2KTtcbiAgICAgIGlmIChzLnN0cnN0YXJ0ICE9PSAwKSB7IGhlYWRlciB8PSBQUkVTRVRfRElDVDsgfVxuICAgICAgaGVhZGVyICs9IDMxIC0gKGhlYWRlciAlIDMxKTtcblxuICAgICAgcy5zdGF0dXMgPSBCVVNZX1NUQVRFO1xuICAgICAgcHV0U2hvcnRNU0IocywgaGVhZGVyKTtcblxuICAgICAgLyogU2F2ZSB0aGUgYWRsZXIzMiBvZiB0aGUgcHJlc2V0IGRpY3Rpb25hcnk6ICovXG4gICAgICBpZiAocy5zdHJzdGFydCAhPT0gMCkge1xuICAgICAgICBwdXRTaG9ydE1TQihzLCBzdHJtLmFkbGVyID4+PiAxNik7XG4gICAgICAgIHB1dFNob3J0TVNCKHMsIHN0cm0uYWRsZXIgJiAweGZmZmYpO1xuICAgICAgfVxuICAgICAgc3RybS5hZGxlciA9IDE7IC8vIGFkbGVyMzIoMEwsIFpfTlVMTCwgMCk7XG4gICAgfVxuICB9XG5cbi8vI2lmZGVmIEdaSVBcbiAgaWYgKHMuc3RhdHVzID09PSBFWFRSQV9TVEFURSkge1xuICAgIGlmIChzLmd6aGVhZC5leHRyYS8qICE9IFpfTlVMTCovKSB7XG4gICAgICBiZWcgPSBzLnBlbmRpbmc7ICAvKiBzdGFydCBvZiBieXRlcyB0byB1cGRhdGUgY3JjICovXG5cbiAgICAgIHdoaWxlIChzLmd6aW5kZXggPCAocy5nemhlYWQuZXh0cmEubGVuZ3RoICYgMHhmZmZmKSkge1xuICAgICAgICBpZiAocy5wZW5kaW5nID09PSBzLnBlbmRpbmdfYnVmX3NpemUpIHtcbiAgICAgICAgICBpZiAocy5nemhlYWQuaGNyYyAmJiBzLnBlbmRpbmcgPiBiZWcpIHtcbiAgICAgICAgICAgIHN0cm0uYWRsZXIgPSBjcmMzMihzdHJtLmFkbGVyLCBzLnBlbmRpbmdfYnVmLCBzLnBlbmRpbmcgLSBiZWcsIGJlZyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgICAgICAgYmVnID0gcy5wZW5kaW5nO1xuICAgICAgICAgIGlmIChzLnBlbmRpbmcgPT09IHMucGVuZGluZ19idWZfc2l6ZSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHB1dF9ieXRlKHMsIHMuZ3poZWFkLmV4dHJhW3MuZ3ppbmRleF0gJiAweGZmKTtcbiAgICAgICAgcy5nemluZGV4Kys7XG4gICAgICB9XG4gICAgICBpZiAocy5nemhlYWQuaGNyYyAmJiBzLnBlbmRpbmcgPiBiZWcpIHtcbiAgICAgICAgc3RybS5hZGxlciA9IGNyYzMyKHN0cm0uYWRsZXIsIHMucGVuZGluZ19idWYsIHMucGVuZGluZyAtIGJlZywgYmVnKTtcbiAgICAgIH1cbiAgICAgIGlmIChzLmd6aW5kZXggPT09IHMuZ3poZWFkLmV4dHJhLmxlbmd0aCkge1xuICAgICAgICBzLmd6aW5kZXggPSAwO1xuICAgICAgICBzLnN0YXR1cyA9IE5BTUVfU1RBVEU7XG4gICAgICB9XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcy5zdGF0dXMgPSBOQU1FX1NUQVRFO1xuICAgIH1cbiAgfVxuICBpZiAocy5zdGF0dXMgPT09IE5BTUVfU1RBVEUpIHtcbiAgICBpZiAocy5nemhlYWQubmFtZS8qICE9IFpfTlVMTCovKSB7XG4gICAgICBiZWcgPSBzLnBlbmRpbmc7ICAvKiBzdGFydCBvZiBieXRlcyB0byB1cGRhdGUgY3JjICovXG4gICAgICAvL2ludCB2YWw7XG5cbiAgICAgIGRvIHtcbiAgICAgICAgaWYgKHMucGVuZGluZyA9PT0gcy5wZW5kaW5nX2J1Zl9zaXplKSB7XG4gICAgICAgICAgaWYgKHMuZ3poZWFkLmhjcmMgJiYgcy5wZW5kaW5nID4gYmVnKSB7XG4gICAgICAgICAgICBzdHJtLmFkbGVyID0gY3JjMzIoc3RybS5hZGxlciwgcy5wZW5kaW5nX2J1Ziwgcy5wZW5kaW5nIC0gYmVnLCBiZWcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBmbHVzaF9wZW5kaW5nKHN0cm0pO1xuICAgICAgICAgIGJlZyA9IHMucGVuZGluZztcbiAgICAgICAgICBpZiAocy5wZW5kaW5nID09PSBzLnBlbmRpbmdfYnVmX3NpemUpIHtcbiAgICAgICAgICAgIHZhbCA9IDE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gSlMgc3BlY2lmaWM6IGxpdHRsZSBtYWdpYyB0byBhZGQgemVybyB0ZXJtaW5hdG9yIHRvIGVuZCBvZiBzdHJpbmdcbiAgICAgICAgaWYgKHMuZ3ppbmRleCA8IHMuZ3poZWFkLm5hbWUubGVuZ3RoKSB7XG4gICAgICAgICAgdmFsID0gcy5nemhlYWQubmFtZS5jaGFyQ29kZUF0KHMuZ3ppbmRleCsrKSAmIDB4ZmY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsID0gMDtcbiAgICAgICAgfVxuICAgICAgICBwdXRfYnl0ZShzLCB2YWwpO1xuICAgICAgfSB3aGlsZSAodmFsICE9PSAwKTtcblxuICAgICAgaWYgKHMuZ3poZWFkLmhjcmMgJiYgcy5wZW5kaW5nID4gYmVnKSB7XG4gICAgICAgIHN0cm0uYWRsZXIgPSBjcmMzMihzdHJtLmFkbGVyLCBzLnBlbmRpbmdfYnVmLCBzLnBlbmRpbmcgLSBiZWcsIGJlZyk7XG4gICAgICB9XG4gICAgICBpZiAodmFsID09PSAwKSB7XG4gICAgICAgIHMuZ3ppbmRleCA9IDA7XG4gICAgICAgIHMuc3RhdHVzID0gQ09NTUVOVF9TVEFURTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBzLnN0YXR1cyA9IENPTU1FTlRfU1RBVEU7XG4gICAgfVxuICB9XG4gIGlmIChzLnN0YXR1cyA9PT0gQ09NTUVOVF9TVEFURSkge1xuICAgIGlmIChzLmd6aGVhZC5jb21tZW50LyogIT0gWl9OVUxMKi8pIHtcbiAgICAgIGJlZyA9IHMucGVuZGluZzsgIC8qIHN0YXJ0IG9mIGJ5dGVzIHRvIHVwZGF0ZSBjcmMgKi9cbiAgICAgIC8vaW50IHZhbDtcblxuICAgICAgZG8ge1xuICAgICAgICBpZiAocy5wZW5kaW5nID09PSBzLnBlbmRpbmdfYnVmX3NpemUpIHtcbiAgICAgICAgICBpZiAocy5nemhlYWQuaGNyYyAmJiBzLnBlbmRpbmcgPiBiZWcpIHtcbiAgICAgICAgICAgIHN0cm0uYWRsZXIgPSBjcmMzMihzdHJtLmFkbGVyLCBzLnBlbmRpbmdfYnVmLCBzLnBlbmRpbmcgLSBiZWcsIGJlZyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgICAgICAgYmVnID0gcy5wZW5kaW5nO1xuICAgICAgICAgIGlmIChzLnBlbmRpbmcgPT09IHMucGVuZGluZ19idWZfc2l6ZSkge1xuICAgICAgICAgICAgdmFsID0gMTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBKUyBzcGVjaWZpYzogbGl0dGxlIG1hZ2ljIHRvIGFkZCB6ZXJvIHRlcm1pbmF0b3IgdG8gZW5kIG9mIHN0cmluZ1xuICAgICAgICBpZiAocy5nemluZGV4IDwgcy5nemhlYWQuY29tbWVudC5sZW5ndGgpIHtcbiAgICAgICAgICB2YWwgPSBzLmd6aGVhZC5jb21tZW50LmNoYXJDb2RlQXQocy5nemluZGV4KyspICYgMHhmZjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWwgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHB1dF9ieXRlKHMsIHZhbCk7XG4gICAgICB9IHdoaWxlICh2YWwgIT09IDApO1xuXG4gICAgICBpZiAocy5nemhlYWQuaGNyYyAmJiBzLnBlbmRpbmcgPiBiZWcpIHtcbiAgICAgICAgc3RybS5hZGxlciA9IGNyYzMyKHN0cm0uYWRsZXIsIHMucGVuZGluZ19idWYsIHMucGVuZGluZyAtIGJlZywgYmVnKTtcbiAgICAgIH1cbiAgICAgIGlmICh2YWwgPT09IDApIHtcbiAgICAgICAgcy5zdGF0dXMgPSBIQ1JDX1NUQVRFO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHMuc3RhdHVzID0gSENSQ19TVEFURTtcbiAgICB9XG4gIH1cbiAgaWYgKHMuc3RhdHVzID09PSBIQ1JDX1NUQVRFKSB7XG4gICAgaWYgKHMuZ3poZWFkLmhjcmMpIHtcbiAgICAgIGlmIChzLnBlbmRpbmcgKyAyID4gcy5wZW5kaW5nX2J1Zl9zaXplKSB7XG4gICAgICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgICB9XG4gICAgICBpZiAocy5wZW5kaW5nICsgMiA8PSBzLnBlbmRpbmdfYnVmX3NpemUpIHtcbiAgICAgICAgcHV0X2J5dGUocywgc3RybS5hZGxlciAmIDB4ZmYpO1xuICAgICAgICBwdXRfYnl0ZShzLCAoc3RybS5hZGxlciA+PiA4KSAmIDB4ZmYpO1xuICAgICAgICBzdHJtLmFkbGVyID0gMDsgLy9jcmMzMigwTCwgWl9OVUxMLCAwKTtcbiAgICAgICAgcy5zdGF0dXMgPSBCVVNZX1NUQVRFO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHMuc3RhdHVzID0gQlVTWV9TVEFURTtcbiAgICB9XG4gIH1cbi8vI2VuZGlmXG5cbiAgLyogRmx1c2ggYXMgbXVjaCBwZW5kaW5nIG91dHB1dCBhcyBwb3NzaWJsZSAqL1xuICBpZiAocy5wZW5kaW5nICE9PSAwKSB7XG4gICAgZmx1c2hfcGVuZGluZyhzdHJtKTtcbiAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgIC8qIFNpbmNlIGF2YWlsX291dCBpcyAwLCBkZWZsYXRlIHdpbGwgYmUgY2FsbGVkIGFnYWluIHdpdGhcbiAgICAgICAqIG1vcmUgb3V0cHV0IHNwYWNlLCBidXQgcG9zc2libHkgd2l0aCBib3RoIHBlbmRpbmcgYW5kXG4gICAgICAgKiBhdmFpbF9pbiBlcXVhbCB0byB6ZXJvLiBUaGVyZSB3b24ndCBiZSBhbnl0aGluZyB0byBkbyxcbiAgICAgICAqIGJ1dCB0aGlzIGlzIG5vdCBhbiBlcnJvciBzaXR1YXRpb24gc28gbWFrZSBzdXJlIHdlXG4gICAgICAgKiByZXR1cm4gT0sgaW5zdGVhZCBvZiBCVUZfRVJST1IgYXQgbmV4dCBjYWxsIG9mIGRlZmxhdGU6XG4gICAgICAgKi9cbiAgICAgIHMubGFzdF9mbHVzaCA9IC0xO1xuICAgICAgcmV0dXJuIFpfT0s7XG4gICAgfVxuXG4gICAgLyogTWFrZSBzdXJlIHRoZXJlIGlzIHNvbWV0aGluZyB0byBkbyBhbmQgYXZvaWQgZHVwbGljYXRlIGNvbnNlY3V0aXZlXG4gICAgICogZmx1c2hlcy4gRm9yIHJlcGVhdGVkIGFuZCB1c2VsZXNzIGNhbGxzIHdpdGggWl9GSU5JU0gsIHdlIGtlZXBcbiAgICAgKiByZXR1cm5pbmcgWl9TVFJFQU1fRU5EIGluc3RlYWQgb2YgWl9CVUZfRVJST1IuXG4gICAgICovXG4gIH0gZWxzZSBpZiAoc3RybS5hdmFpbF9pbiA9PT0gMCAmJiByYW5rKGZsdXNoKSA8PSByYW5rKG9sZF9mbHVzaCkgJiZcbiAgICBmbHVzaCAhPT0gWl9GSU5JU0gpIHtcbiAgICByZXR1cm4gZXJyKHN0cm0sIFpfQlVGX0VSUk9SKTtcbiAgfVxuXG4gIC8qIFVzZXIgbXVzdCBub3QgcHJvdmlkZSBtb3JlIGlucHV0IGFmdGVyIHRoZSBmaXJzdCBGSU5JU0g6ICovXG4gIGlmIChzLnN0YXR1cyA9PT0gRklOSVNIX1NUQVRFICYmIHN0cm0uYXZhaWxfaW4gIT09IDApIHtcbiAgICByZXR1cm4gZXJyKHN0cm0sIFpfQlVGX0VSUk9SKTtcbiAgfVxuXG4gIC8qIFN0YXJ0IGEgbmV3IGJsb2NrIG9yIGNvbnRpbnVlIHRoZSBjdXJyZW50IG9uZS5cbiAgICovXG4gIGlmIChzdHJtLmF2YWlsX2luICE9PSAwIHx8IHMubG9va2FoZWFkICE9PSAwIHx8XG4gICAgKGZsdXNoICE9PSBaX05PX0ZMVVNIICYmIHMuc3RhdHVzICE9PSBGSU5JU0hfU1RBVEUpKSB7XG4gICAgdmFyIGJzdGF0ZSA9IChzLnN0cmF0ZWd5ID09PSBaX0hVRkZNQU5fT05MWSkgPyBkZWZsYXRlX2h1ZmYocywgZmx1c2gpIDpcbiAgICAgIChzLnN0cmF0ZWd5ID09PSBaX1JMRSA/IGRlZmxhdGVfcmxlKHMsIGZsdXNoKSA6XG4gICAgICAgIGNvbmZpZ3VyYXRpb25fdGFibGVbcy5sZXZlbF0uZnVuYyhzLCBmbHVzaCkpO1xuXG4gICAgaWYgKGJzdGF0ZSA9PT0gQlNfRklOSVNIX1NUQVJURUQgfHwgYnN0YXRlID09PSBCU19GSU5JU0hfRE9ORSkge1xuICAgICAgcy5zdGF0dXMgPSBGSU5JU0hfU1RBVEU7XG4gICAgfVxuICAgIGlmIChic3RhdGUgPT09IEJTX05FRURfTU9SRSB8fCBic3RhdGUgPT09IEJTX0ZJTklTSF9TVEFSVEVEKSB7XG4gICAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgICAgcy5sYXN0X2ZsdXNoID0gLTE7XG4gICAgICAgIC8qIGF2b2lkIEJVRl9FUlJPUiBuZXh0IGNhbGwsIHNlZSBhYm92ZSAqL1xuICAgICAgfVxuICAgICAgcmV0dXJuIFpfT0s7XG4gICAgICAvKiBJZiBmbHVzaCAhPSBaX05PX0ZMVVNIICYmIGF2YWlsX291dCA9PSAwLCB0aGUgbmV4dCBjYWxsXG4gICAgICAgKiBvZiBkZWZsYXRlIHNob3VsZCB1c2UgdGhlIHNhbWUgZmx1c2ggcGFyYW1ldGVyIHRvIG1ha2Ugc3VyZVxuICAgICAgICogdGhhdCB0aGUgZmx1c2ggaXMgY29tcGxldGUuIFNvIHdlIGRvbid0IGhhdmUgdG8gb3V0cHV0IGFuXG4gICAgICAgKiBlbXB0eSBibG9jayBoZXJlLCB0aGlzIHdpbGwgYmUgZG9uZSBhdCBuZXh0IGNhbGwuIFRoaXMgYWxzb1xuICAgICAgICogZW5zdXJlcyB0aGF0IGZvciBhIHZlcnkgc21hbGwgb3V0cHV0IGJ1ZmZlciwgd2UgZW1pdCBhdCBtb3N0XG4gICAgICAgKiBvbmUgZW1wdHkgYmxvY2suXG4gICAgICAgKi9cbiAgICB9XG4gICAgaWYgKGJzdGF0ZSA9PT0gQlNfQkxPQ0tfRE9ORSkge1xuICAgICAgaWYgKGZsdXNoID09PSBaX1BBUlRJQUxfRkxVU0gpIHtcbiAgICAgICAgdHJlZXMuX3RyX2FsaWduKHMpO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAoZmx1c2ggIT09IFpfQkxPQ0spIHsgLyogRlVMTF9GTFVTSCBvciBTWU5DX0ZMVVNIICovXG5cbiAgICAgICAgdHJlZXMuX3RyX3N0b3JlZF9ibG9jayhzLCAwLCAwLCBmYWxzZSk7XG4gICAgICAgIC8qIEZvciBhIGZ1bGwgZmx1c2gsIHRoaXMgZW1wdHkgYmxvY2sgd2lsbCBiZSByZWNvZ25pemVkXG4gICAgICAgICAqIGFzIGEgc3BlY2lhbCBtYXJrZXIgYnkgaW5mbGF0ZV9zeW5jKCkuXG4gICAgICAgICAqL1xuICAgICAgICBpZiAoZmx1c2ggPT09IFpfRlVMTF9GTFVTSCkge1xuICAgICAgICAgIC8qKiogQ0xFQVJfSEFTSChzKTsgKioqLyAgICAgICAgICAgICAvKiBmb3JnZXQgaGlzdG9yeSAqL1xuICAgICAgICAgIHplcm8ocy5oZWFkKTsgLy8gRmlsbCB3aXRoIE5JTCAoPSAwKTtcblxuICAgICAgICAgIGlmIChzLmxvb2thaGVhZCA9PT0gMCkge1xuICAgICAgICAgICAgcy5zdHJzdGFydCA9IDA7XG4gICAgICAgICAgICBzLmJsb2NrX3N0YXJ0ID0gMDtcbiAgICAgICAgICAgIHMuaW5zZXJ0ID0gMDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGZsdXNoX3BlbmRpbmcoc3RybSk7XG4gICAgICBpZiAoc3RybS5hdmFpbF9vdXQgPT09IDApIHtcbiAgICAgICAgcy5sYXN0X2ZsdXNoID0gLTE7IC8qIGF2b2lkIEJVRl9FUlJPUiBhdCBuZXh0IGNhbGwsIHNlZSBhYm92ZSAqL1xuICAgICAgICByZXR1cm4gWl9PSztcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy9Bc3NlcnQoc3RybS0+YXZhaWxfb3V0ID4gMCwgXCJidWcyXCIpO1xuICAvL2lmIChzdHJtLmF2YWlsX291dCA8PSAwKSB7IHRocm93IG5ldyBFcnJvcihcImJ1ZzJcIik7fVxuXG4gIGlmIChmbHVzaCAhPT0gWl9GSU5JU0gpIHsgcmV0dXJuIFpfT0s7IH1cbiAgaWYgKHMud3JhcCA8PSAwKSB7IHJldHVybiBaX1NUUkVBTV9FTkQ7IH1cblxuICAvKiBXcml0ZSB0aGUgdHJhaWxlciAqL1xuICBpZiAocy53cmFwID09PSAyKSB7XG4gICAgcHV0X2J5dGUocywgc3RybS5hZGxlciAmIDB4ZmYpO1xuICAgIHB1dF9ieXRlKHMsIChzdHJtLmFkbGVyID4+IDgpICYgMHhmZik7XG4gICAgcHV0X2J5dGUocywgKHN0cm0uYWRsZXIgPj4gMTYpICYgMHhmZik7XG4gICAgcHV0X2J5dGUocywgKHN0cm0uYWRsZXIgPj4gMjQpICYgMHhmZik7XG4gICAgcHV0X2J5dGUocywgc3RybS50b3RhbF9pbiAmIDB4ZmYpO1xuICAgIHB1dF9ieXRlKHMsIChzdHJtLnRvdGFsX2luID4+IDgpICYgMHhmZik7XG4gICAgcHV0X2J5dGUocywgKHN0cm0udG90YWxfaW4gPj4gMTYpICYgMHhmZik7XG4gICAgcHV0X2J5dGUocywgKHN0cm0udG90YWxfaW4gPj4gMjQpICYgMHhmZik7XG4gIH1cbiAgZWxzZVxuICB7XG4gICAgcHV0U2hvcnRNU0Iocywgc3RybS5hZGxlciA+Pj4gMTYpO1xuICAgIHB1dFNob3J0TVNCKHMsIHN0cm0uYWRsZXIgJiAweGZmZmYpO1xuICB9XG5cbiAgZmx1c2hfcGVuZGluZyhzdHJtKTtcbiAgLyogSWYgYXZhaWxfb3V0IGlzIHplcm8sIHRoZSBhcHBsaWNhdGlvbiB3aWxsIGNhbGwgZGVmbGF0ZSBhZ2FpblxuICAgKiB0byBmbHVzaCB0aGUgcmVzdC5cbiAgICovXG4gIGlmIChzLndyYXAgPiAwKSB7IHMud3JhcCA9IC1zLndyYXA7IH1cbiAgLyogd3JpdGUgdGhlIHRyYWlsZXIgb25seSBvbmNlISAqL1xuICByZXR1cm4gcy5wZW5kaW5nICE9PSAwID8gWl9PSyA6IFpfU1RSRUFNX0VORDtcbn1cblxuZnVuY3Rpb24gZGVmbGF0ZUVuZChzdHJtKSB7XG4gIHZhciBzdGF0dXM7XG5cbiAgaWYgKCFzdHJtLyo9PSBaX05VTEwqLyB8fCAhc3RybS5zdGF0ZS8qPT0gWl9OVUxMKi8pIHtcbiAgICByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gIH1cblxuICBzdGF0dXMgPSBzdHJtLnN0YXRlLnN0YXR1cztcbiAgaWYgKHN0YXR1cyAhPT0gSU5JVF9TVEFURSAmJlxuICAgIHN0YXR1cyAhPT0gRVhUUkFfU1RBVEUgJiZcbiAgICBzdGF0dXMgIT09IE5BTUVfU1RBVEUgJiZcbiAgICBzdGF0dXMgIT09IENPTU1FTlRfU1RBVEUgJiZcbiAgICBzdGF0dXMgIT09IEhDUkNfU1RBVEUgJiZcbiAgICBzdGF0dXMgIT09IEJVU1lfU1RBVEUgJiZcbiAgICBzdGF0dXMgIT09IEZJTklTSF9TVEFURVxuICApIHtcbiAgICByZXR1cm4gZXJyKHN0cm0sIFpfU1RSRUFNX0VSUk9SKTtcbiAgfVxuXG4gIHN0cm0uc3RhdGUgPSBudWxsO1xuXG4gIHJldHVybiBzdGF0dXMgPT09IEJVU1lfU1RBVEUgPyBlcnIoc3RybSwgWl9EQVRBX0VSUk9SKSA6IFpfT0s7XG59XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW5pdGlhbGl6ZXMgdGhlIGNvbXByZXNzaW9uIGRpY3Rpb25hcnkgZnJvbSB0aGUgZ2l2ZW4gYnl0ZVxuICogc2VxdWVuY2Ugd2l0aG91dCBwcm9kdWNpbmcgYW55IGNvbXByZXNzZWQgb3V0cHV0LlxuICovXG5mdW5jdGlvbiBkZWZsYXRlU2V0RGljdGlvbmFyeShzdHJtLCBkaWN0aW9uYXJ5KSB7XG4gIHZhciBkaWN0TGVuZ3RoID0gZGljdGlvbmFyeS5sZW5ndGg7XG5cbiAgdmFyIHM7XG4gIHZhciBzdHIsIG47XG4gIHZhciB3cmFwO1xuICB2YXIgYXZhaWw7XG4gIHZhciBuZXh0O1xuICB2YXIgaW5wdXQ7XG4gIHZhciB0bXBEaWN0O1xuXG4gIGlmICghc3RybS8qPT0gWl9OVUxMKi8gfHwgIXN0cm0uc3RhdGUvKj09IFpfTlVMTCovKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuICB9XG5cbiAgcyA9IHN0cm0uc3RhdGU7XG4gIHdyYXAgPSBzLndyYXA7XG5cbiAgaWYgKHdyYXAgPT09IDIgfHwgKHdyYXAgPT09IDEgJiYgcy5zdGF0dXMgIT09IElOSVRfU1RBVEUpIHx8IHMubG9va2FoZWFkKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuICB9XG5cbiAgLyogd2hlbiB1c2luZyB6bGliIHdyYXBwZXJzLCBjb21wdXRlIEFkbGVyLTMyIGZvciBwcm92aWRlZCBkaWN0aW9uYXJ5ICovXG4gIGlmICh3cmFwID09PSAxKSB7XG4gICAgLyogYWRsZXIzMihzdHJtLT5hZGxlciwgZGljdGlvbmFyeSwgZGljdExlbmd0aCk7ICovXG4gICAgc3RybS5hZGxlciA9IGFkbGVyMzIoc3RybS5hZGxlciwgZGljdGlvbmFyeSwgZGljdExlbmd0aCwgMCk7XG4gIH1cblxuICBzLndyYXAgPSAwOyAgIC8qIGF2b2lkIGNvbXB1dGluZyBBZGxlci0zMiBpbiByZWFkX2J1ZiAqL1xuXG4gIC8qIGlmIGRpY3Rpb25hcnkgd291bGQgZmlsbCB3aW5kb3csIGp1c3QgcmVwbGFjZSB0aGUgaGlzdG9yeSAqL1xuICBpZiAoZGljdExlbmd0aCA+PSBzLndfc2l6ZSkge1xuICAgIGlmICh3cmFwID09PSAwKSB7ICAgICAgICAgICAgLyogYWxyZWFkeSBlbXB0eSBvdGhlcndpc2UgKi9cbiAgICAgIC8qKiogQ0xFQVJfSEFTSChzKTsgKioqL1xuICAgICAgemVybyhzLmhlYWQpOyAvLyBGaWxsIHdpdGggTklMICg9IDApO1xuICAgICAgcy5zdHJzdGFydCA9IDA7XG4gICAgICBzLmJsb2NrX3N0YXJ0ID0gMDtcbiAgICAgIHMuaW5zZXJ0ID0gMDtcbiAgICB9XG4gICAgLyogdXNlIHRoZSB0YWlsICovXG4gICAgLy8gZGljdGlvbmFyeSA9IGRpY3Rpb25hcnkuc2xpY2UoZGljdExlbmd0aCAtIHMud19zaXplKTtcbiAgICB0bXBEaWN0ID0gbmV3IHV0aWxzLkJ1Zjgocy53X3NpemUpO1xuICAgIHV0aWxzLmFycmF5U2V0KHRtcERpY3QsIGRpY3Rpb25hcnksIGRpY3RMZW5ndGggLSBzLndfc2l6ZSwgcy53X3NpemUsIDApO1xuICAgIGRpY3Rpb25hcnkgPSB0bXBEaWN0O1xuICAgIGRpY3RMZW5ndGggPSBzLndfc2l6ZTtcbiAgfVxuICAvKiBpbnNlcnQgZGljdGlvbmFyeSBpbnRvIHdpbmRvdyBhbmQgaGFzaCAqL1xuICBhdmFpbCA9IHN0cm0uYXZhaWxfaW47XG4gIG5leHQgPSBzdHJtLm5leHRfaW47XG4gIGlucHV0ID0gc3RybS5pbnB1dDtcbiAgc3RybS5hdmFpbF9pbiA9IGRpY3RMZW5ndGg7XG4gIHN0cm0ubmV4dF9pbiA9IDA7XG4gIHN0cm0uaW5wdXQgPSBkaWN0aW9uYXJ5O1xuICBmaWxsX3dpbmRvdyhzKTtcbiAgd2hpbGUgKHMubG9va2FoZWFkID49IE1JTl9NQVRDSCkge1xuICAgIHN0ciA9IHMuc3Ryc3RhcnQ7XG4gICAgbiA9IHMubG9va2FoZWFkIC0gKE1JTl9NQVRDSCAtIDEpO1xuICAgIGRvIHtcbiAgICAgIC8qIFVQREFURV9IQVNIKHMsIHMtPmluc19oLCBzLT53aW5kb3dbc3RyICsgTUlOX01BVENILTFdKTsgKi9cbiAgICAgIHMuaW5zX2ggPSAoKHMuaW5zX2ggPDwgcy5oYXNoX3NoaWZ0KSBeIHMud2luZG93W3N0ciArIE1JTl9NQVRDSCAtIDFdKSAmIHMuaGFzaF9tYXNrO1xuXG4gICAgICBzLnByZXZbc3RyICYgcy53X21hc2tdID0gcy5oZWFkW3MuaW5zX2hdO1xuXG4gICAgICBzLmhlYWRbcy5pbnNfaF0gPSBzdHI7XG4gICAgICBzdHIrKztcbiAgICB9IHdoaWxlICgtLW4pO1xuICAgIHMuc3Ryc3RhcnQgPSBzdHI7XG4gICAgcy5sb29rYWhlYWQgPSBNSU5fTUFUQ0ggLSAxO1xuICAgIGZpbGxfd2luZG93KHMpO1xuICB9XG4gIHMuc3Ryc3RhcnQgKz0gcy5sb29rYWhlYWQ7XG4gIHMuYmxvY2tfc3RhcnQgPSBzLnN0cnN0YXJ0O1xuICBzLmluc2VydCA9IHMubG9va2FoZWFkO1xuICBzLmxvb2thaGVhZCA9IDA7XG4gIHMubWF0Y2hfbGVuZ3RoID0gcy5wcmV2X2xlbmd0aCA9IE1JTl9NQVRDSCAtIDE7XG4gIHMubWF0Y2hfYXZhaWxhYmxlID0gMDtcbiAgc3RybS5uZXh0X2luID0gbmV4dDtcbiAgc3RybS5pbnB1dCA9IGlucHV0O1xuICBzdHJtLmF2YWlsX2luID0gYXZhaWw7XG4gIHMud3JhcCA9IHdyYXA7XG4gIHJldHVybiBaX09LO1xufVxuXG5cbmV4cG9ydHMuZGVmbGF0ZUluaXQgPSBkZWZsYXRlSW5pdDtcbmV4cG9ydHMuZGVmbGF0ZUluaXQyID0gZGVmbGF0ZUluaXQyO1xuZXhwb3J0cy5kZWZsYXRlUmVzZXQgPSBkZWZsYXRlUmVzZXQ7XG5leHBvcnRzLmRlZmxhdGVSZXNldEtlZXAgPSBkZWZsYXRlUmVzZXRLZWVwO1xuZXhwb3J0cy5kZWZsYXRlU2V0SGVhZGVyID0gZGVmbGF0ZVNldEhlYWRlcjtcbmV4cG9ydHMuZGVmbGF0ZSA9IGRlZmxhdGU7XG5leHBvcnRzLmRlZmxhdGVFbmQgPSBkZWZsYXRlRW5kO1xuZXhwb3J0cy5kZWZsYXRlU2V0RGljdGlvbmFyeSA9IGRlZmxhdGVTZXREaWN0aW9uYXJ5O1xuZXhwb3J0cy5kZWZsYXRlSW5mbyA9ICdwYWtvIGRlZmxhdGUgKGZyb20gTm9kZWNhIHByb2plY3QpJztcblxuLyogTm90IGltcGxlbWVudGVkXG5leHBvcnRzLmRlZmxhdGVCb3VuZCA9IGRlZmxhdGVCb3VuZDtcbmV4cG9ydHMuZGVmbGF0ZUNvcHkgPSBkZWZsYXRlQ29weTtcbmV4cG9ydHMuZGVmbGF0ZVBhcmFtcyA9IGRlZmxhdGVQYXJhbXM7XG5leHBvcnRzLmRlZmxhdGVQZW5kaW5nID0gZGVmbGF0ZVBlbmRpbmc7XG5leHBvcnRzLmRlZmxhdGVQcmltZSA9IGRlZmxhdGVQcmltZTtcbmV4cG9ydHMuZGVmbGF0ZVR1bmUgPSBkZWZsYXRlVHVuZTtcbiovXG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuZnVuY3Rpb24gR1poZWFkZXIoKSB7XG4gIC8qIHRydWUgaWYgY29tcHJlc3NlZCBkYXRhIGJlbGlldmVkIHRvIGJlIHRleHQgKi9cbiAgdGhpcy50ZXh0ICAgICAgID0gMDtcbiAgLyogbW9kaWZpY2F0aW9uIHRpbWUgKi9cbiAgdGhpcy50aW1lICAgICAgID0gMDtcbiAgLyogZXh0cmEgZmxhZ3MgKG5vdCB1c2VkIHdoZW4gd3JpdGluZyBhIGd6aXAgZmlsZSkgKi9cbiAgdGhpcy54ZmxhZ3MgICAgID0gMDtcbiAgLyogb3BlcmF0aW5nIHN5c3RlbSAqL1xuICB0aGlzLm9zICAgICAgICAgPSAwO1xuICAvKiBwb2ludGVyIHRvIGV4dHJhIGZpZWxkIG9yIFpfTlVMTCBpZiBub25lICovXG4gIHRoaXMuZXh0cmEgICAgICA9IG51bGw7XG4gIC8qIGV4dHJhIGZpZWxkIGxlbmd0aCAodmFsaWQgaWYgZXh0cmEgIT0gWl9OVUxMKSAqL1xuICB0aGlzLmV4dHJhX2xlbiAgPSAwOyAvLyBBY3R1YWxseSwgd2UgZG9uJ3QgbmVlZCBpdCBpbiBKUyxcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gYnV0IGxlYXZlIGZvciBmZXcgY29kZSBtb2RpZmljYXRpb25zXG5cbiAgLy9cbiAgLy8gU2V0dXAgbGltaXRzIGlzIG5vdCBuZWNlc3NhcnkgYmVjYXVzZSBpbiBqcyB3ZSBzaG91bGQgbm90IHByZWFsbG9jYXRlIG1lbW9yeVxuICAvLyBmb3IgaW5mbGF0ZSB1c2UgY29uc3RhbnQgbGltaXQgaW4gNjU1MzYgYnl0ZXNcbiAgLy9cblxuICAvKiBzcGFjZSBhdCBleHRyYSAob25seSB3aGVuIHJlYWRpbmcgaGVhZGVyKSAqL1xuICAvLyB0aGlzLmV4dHJhX21heCAgPSAwO1xuICAvKiBwb2ludGVyIHRvIHplcm8tdGVybWluYXRlZCBmaWxlIG5hbWUgb3IgWl9OVUxMICovXG4gIHRoaXMubmFtZSAgICAgICA9ICcnO1xuICAvKiBzcGFjZSBhdCBuYW1lIChvbmx5IHdoZW4gcmVhZGluZyBoZWFkZXIpICovXG4gIC8vIHRoaXMubmFtZV9tYXggICA9IDA7XG4gIC8qIHBvaW50ZXIgdG8gemVyby10ZXJtaW5hdGVkIGNvbW1lbnQgb3IgWl9OVUxMICovXG4gIHRoaXMuY29tbWVudCAgICA9ICcnO1xuICAvKiBzcGFjZSBhdCBjb21tZW50IChvbmx5IHdoZW4gcmVhZGluZyBoZWFkZXIpICovXG4gIC8vIHRoaXMuY29tbV9tYXggICA9IDA7XG4gIC8qIHRydWUgaWYgdGhlcmUgd2FzIG9yIHdpbGwgYmUgYSBoZWFkZXIgY3JjICovXG4gIHRoaXMuaGNyYyAgICAgICA9IDA7XG4gIC8qIHRydWUgd2hlbiBkb25lIHJlYWRpbmcgZ3ppcCBoZWFkZXIgKG5vdCB1c2VkIHdoZW4gd3JpdGluZyBhIGd6aXAgZmlsZSkgKi9cbiAgdGhpcy5kb25lICAgICAgID0gZmFsc2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gR1poZWFkZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuLy8gU2VlIHN0YXRlIGRlZnMgZnJvbSBpbmZsYXRlLmpzXG52YXIgQkFEID0gMzA7ICAgICAgIC8qIGdvdCBhIGRhdGEgZXJyb3IgLS0gcmVtYWluIGhlcmUgdW50aWwgcmVzZXQgKi9cbnZhciBUWVBFID0gMTI7ICAgICAgLyogaTogd2FpdGluZyBmb3IgdHlwZSBiaXRzLCBpbmNsdWRpbmcgbGFzdC1mbGFnIGJpdCAqL1xuXG4vKlxuICAgRGVjb2RlIGxpdGVyYWwsIGxlbmd0aCwgYW5kIGRpc3RhbmNlIGNvZGVzIGFuZCB3cml0ZSBvdXQgdGhlIHJlc3VsdGluZ1xuICAgbGl0ZXJhbCBhbmQgbWF0Y2ggYnl0ZXMgdW50aWwgZWl0aGVyIG5vdCBlbm91Z2ggaW5wdXQgb3Igb3V0cHV0IGlzXG4gICBhdmFpbGFibGUsIGFuIGVuZC1vZi1ibG9jayBpcyBlbmNvdW50ZXJlZCwgb3IgYSBkYXRhIGVycm9yIGlzIGVuY291bnRlcmVkLlxuICAgV2hlbiBsYXJnZSBlbm91Z2ggaW5wdXQgYW5kIG91dHB1dCBidWZmZXJzIGFyZSBzdXBwbGllZCB0byBpbmZsYXRlKCksIGZvclxuICAgZXhhbXBsZSwgYSAxNksgaW5wdXQgYnVmZmVyIGFuZCBhIDY0SyBvdXRwdXQgYnVmZmVyLCBtb3JlIHRoYW4gOTUlIG9mIHRoZVxuICAgaW5mbGF0ZSBleGVjdXRpb24gdGltZSBpcyBzcGVudCBpbiB0aGlzIHJvdXRpbmUuXG5cbiAgIEVudHJ5IGFzc3VtcHRpb25zOlxuXG4gICAgICAgIHN0YXRlLm1vZGUgPT09IExFTlxuICAgICAgICBzdHJtLmF2YWlsX2luID49IDZcbiAgICAgICAgc3RybS5hdmFpbF9vdXQgPj0gMjU4XG4gICAgICAgIHN0YXJ0ID49IHN0cm0uYXZhaWxfb3V0XG4gICAgICAgIHN0YXRlLmJpdHMgPCA4XG5cbiAgIE9uIHJldHVybiwgc3RhdGUubW9kZSBpcyBvbmUgb2Y6XG5cbiAgICAgICAgTEVOIC0tIHJhbiBvdXQgb2YgZW5vdWdoIG91dHB1dCBzcGFjZSBvciBlbm91Z2ggYXZhaWxhYmxlIGlucHV0XG4gICAgICAgIFRZUEUgLS0gcmVhY2hlZCBlbmQgb2YgYmxvY2sgY29kZSwgaW5mbGF0ZSgpIHRvIGludGVycHJldCBuZXh0IGJsb2NrXG4gICAgICAgIEJBRCAtLSBlcnJvciBpbiBibG9jayBkYXRhXG5cbiAgIE5vdGVzOlxuXG4gICAgLSBUaGUgbWF4aW11bSBpbnB1dCBiaXRzIHVzZWQgYnkgYSBsZW5ndGgvZGlzdGFuY2UgcGFpciBpcyAxNSBiaXRzIGZvciB0aGVcbiAgICAgIGxlbmd0aCBjb2RlLCA1IGJpdHMgZm9yIHRoZSBsZW5ndGggZXh0cmEsIDE1IGJpdHMgZm9yIHRoZSBkaXN0YW5jZSBjb2RlLFxuICAgICAgYW5kIDEzIGJpdHMgZm9yIHRoZSBkaXN0YW5jZSBleHRyYS4gIFRoaXMgdG90YWxzIDQ4IGJpdHMsIG9yIHNpeCBieXRlcy5cbiAgICAgIFRoZXJlZm9yZSBpZiBzdHJtLmF2YWlsX2luID49IDYsIHRoZW4gdGhlcmUgaXMgZW5vdWdoIGlucHV0IHRvIGF2b2lkXG4gICAgICBjaGVja2luZyBmb3IgYXZhaWxhYmxlIGlucHV0IHdoaWxlIGRlY29kaW5nLlxuXG4gICAgLSBUaGUgbWF4aW11bSBieXRlcyB0aGF0IGEgc2luZ2xlIGxlbmd0aC9kaXN0YW5jZSBwYWlyIGNhbiBvdXRwdXQgaXMgMjU4XG4gICAgICBieXRlcywgd2hpY2ggaXMgdGhlIG1heGltdW0gbGVuZ3RoIHRoYXQgY2FuIGJlIGNvZGVkLiAgaW5mbGF0ZV9mYXN0KClcbiAgICAgIHJlcXVpcmVzIHN0cm0uYXZhaWxfb3V0ID49IDI1OCBmb3IgZWFjaCBsb29wIHRvIGF2b2lkIGNoZWNraW5nIGZvclxuICAgICAgb3V0cHV0IHNwYWNlLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGluZmxhdGVfZmFzdChzdHJtLCBzdGFydCkge1xuICB2YXIgc3RhdGU7XG4gIHZhciBfaW47ICAgICAgICAgICAgICAgICAgICAvKiBsb2NhbCBzdHJtLmlucHV0ICovXG4gIHZhciBsYXN0OyAgICAgICAgICAgICAgICAgICAvKiBoYXZlIGVub3VnaCBpbnB1dCB3aGlsZSBpbiA8IGxhc3QgKi9cbiAgdmFyIF9vdXQ7ICAgICAgICAgICAgICAgICAgIC8qIGxvY2FsIHN0cm0ub3V0cHV0ICovXG4gIHZhciBiZWc7ICAgICAgICAgICAgICAgICAgICAvKiBpbmZsYXRlKCkncyBpbml0aWFsIHN0cm0ub3V0cHV0ICovXG4gIHZhciBlbmQ7ICAgICAgICAgICAgICAgICAgICAvKiB3aGlsZSBvdXQgPCBlbmQsIGVub3VnaCBzcGFjZSBhdmFpbGFibGUgKi9cbi8vI2lmZGVmIElORkxBVEVfU1RSSUNUXG4gIHZhciBkbWF4OyAgICAgICAgICAgICAgICAgICAvKiBtYXhpbXVtIGRpc3RhbmNlIGZyb20gemxpYiBoZWFkZXIgKi9cbi8vI2VuZGlmXG4gIHZhciB3c2l6ZTsgICAgICAgICAgICAgICAgICAvKiB3aW5kb3cgc2l6ZSBvciB6ZXJvIGlmIG5vdCB1c2luZyB3aW5kb3cgKi9cbiAgdmFyIHdoYXZlOyAgICAgICAgICAgICAgICAgIC8qIHZhbGlkIGJ5dGVzIGluIHRoZSB3aW5kb3cgKi9cbiAgdmFyIHduZXh0OyAgICAgICAgICAgICAgICAgIC8qIHdpbmRvdyB3cml0ZSBpbmRleCAqL1xuICAvLyBVc2UgYHNfd2luZG93YCBpbnN0ZWFkIGB3aW5kb3dgLCBhdm9pZCBjb25mbGljdCB3aXRoIGluc3RydW1lbnRhdGlvbiB0b29sc1xuICB2YXIgc193aW5kb3c7ICAgICAgICAgICAgICAgLyogYWxsb2NhdGVkIHNsaWRpbmcgd2luZG93LCBpZiB3c2l6ZSAhPSAwICovXG4gIHZhciBob2xkOyAgICAgICAgICAgICAgICAgICAvKiBsb2NhbCBzdHJtLmhvbGQgKi9cbiAgdmFyIGJpdHM7ICAgICAgICAgICAgICAgICAgIC8qIGxvY2FsIHN0cm0uYml0cyAqL1xuICB2YXIgbGNvZGU7ICAgICAgICAgICAgICAgICAgLyogbG9jYWwgc3RybS5sZW5jb2RlICovXG4gIHZhciBkY29kZTsgICAgICAgICAgICAgICAgICAvKiBsb2NhbCBzdHJtLmRpc3Rjb2RlICovXG4gIHZhciBsbWFzazsgICAgICAgICAgICAgICAgICAvKiBtYXNrIGZvciBmaXJzdCBsZXZlbCBvZiBsZW5ndGggY29kZXMgKi9cbiAgdmFyIGRtYXNrOyAgICAgICAgICAgICAgICAgIC8qIG1hc2sgZm9yIGZpcnN0IGxldmVsIG9mIGRpc3RhbmNlIGNvZGVzICovXG4gIHZhciBoZXJlOyAgICAgICAgICAgICAgICAgICAvKiByZXRyaWV2ZWQgdGFibGUgZW50cnkgKi9cbiAgdmFyIG9wOyAgICAgICAgICAgICAgICAgICAgIC8qIGNvZGUgYml0cywgb3BlcmF0aW9uLCBleHRyYSBiaXRzLCBvciAqL1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogIHdpbmRvdyBwb3NpdGlvbiwgd2luZG93IGJ5dGVzIHRvIGNvcHkgKi9cbiAgdmFyIGxlbjsgICAgICAgICAgICAgICAgICAgIC8qIG1hdGNoIGxlbmd0aCwgdW51c2VkIGJ5dGVzICovXG4gIHZhciBkaXN0OyAgICAgICAgICAgICAgICAgICAvKiBtYXRjaCBkaXN0YW5jZSAqL1xuICB2YXIgZnJvbTsgICAgICAgICAgICAgICAgICAgLyogd2hlcmUgdG8gY29weSBtYXRjaCBmcm9tICovXG4gIHZhciBmcm9tX3NvdXJjZTtcblxuXG4gIHZhciBpbnB1dCwgb3V0cHV0OyAvLyBKUyBzcGVjaWZpYywgYmVjYXVzZSB3ZSBoYXZlIG5vIHBvaW50ZXJzXG5cbiAgLyogY29weSBzdGF0ZSB0byBsb2NhbCB2YXJpYWJsZXMgKi9cbiAgc3RhdGUgPSBzdHJtLnN0YXRlO1xuICAvL2hlcmUgPSBzdGF0ZS5oZXJlO1xuICBfaW4gPSBzdHJtLm5leHRfaW47XG4gIGlucHV0ID0gc3RybS5pbnB1dDtcbiAgbGFzdCA9IF9pbiArIChzdHJtLmF2YWlsX2luIC0gNSk7XG4gIF9vdXQgPSBzdHJtLm5leHRfb3V0O1xuICBvdXRwdXQgPSBzdHJtLm91dHB1dDtcbiAgYmVnID0gX291dCAtIChzdGFydCAtIHN0cm0uYXZhaWxfb3V0KTtcbiAgZW5kID0gX291dCArIChzdHJtLmF2YWlsX291dCAtIDI1Nyk7XG4vLyNpZmRlZiBJTkZMQVRFX1NUUklDVFxuICBkbWF4ID0gc3RhdGUuZG1heDtcbi8vI2VuZGlmXG4gIHdzaXplID0gc3RhdGUud3NpemU7XG4gIHdoYXZlID0gc3RhdGUud2hhdmU7XG4gIHduZXh0ID0gc3RhdGUud25leHQ7XG4gIHNfd2luZG93ID0gc3RhdGUud2luZG93O1xuICBob2xkID0gc3RhdGUuaG9sZDtcbiAgYml0cyA9IHN0YXRlLmJpdHM7XG4gIGxjb2RlID0gc3RhdGUubGVuY29kZTtcbiAgZGNvZGUgPSBzdGF0ZS5kaXN0Y29kZTtcbiAgbG1hc2sgPSAoMSA8PCBzdGF0ZS5sZW5iaXRzKSAtIDE7XG4gIGRtYXNrID0gKDEgPDwgc3RhdGUuZGlzdGJpdHMpIC0gMTtcblxuXG4gIC8qIGRlY29kZSBsaXRlcmFscyBhbmQgbGVuZ3RoL2Rpc3RhbmNlcyB1bnRpbCBlbmQtb2YtYmxvY2sgb3Igbm90IGVub3VnaFxuICAgICBpbnB1dCBkYXRhIG9yIG91dHB1dCBzcGFjZSAqL1xuXG4gIHRvcDpcbiAgZG8ge1xuICAgIGlmIChiaXRzIDwgMTUpIHtcbiAgICAgIGhvbGQgKz0gaW5wdXRbX2luKytdIDw8IGJpdHM7XG4gICAgICBiaXRzICs9IDg7XG4gICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgYml0cyArPSA4O1xuICAgIH1cblxuICAgIGhlcmUgPSBsY29kZVtob2xkICYgbG1hc2tdO1xuXG4gICAgZG9sZW46XG4gICAgZm9yICg7OykgeyAvLyBHb3RvIGVtdWxhdGlvblxuICAgICAgb3AgPSBoZXJlID4+PiAyNC8qaGVyZS5iaXRzKi87XG4gICAgICBob2xkID4+Pj0gb3A7XG4gICAgICBiaXRzIC09IG9wO1xuICAgICAgb3AgPSAoaGVyZSA+Pj4gMTYpICYgMHhmZi8qaGVyZS5vcCovO1xuICAgICAgaWYgKG9wID09PSAwKSB7ICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBsaXRlcmFsICovXG4gICAgICAgIC8vVHJhY2V2digoc3RkZXJyLCBoZXJlLnZhbCA+PSAweDIwICYmIGhlcmUudmFsIDwgMHg3ZiA/XG4gICAgICAgIC8vICAgICAgICBcImluZmxhdGU6ICAgICAgICAgbGl0ZXJhbCAnJWMnXFxuXCIgOlxuICAgICAgICAvLyAgICAgICAgXCJpbmZsYXRlOiAgICAgICAgIGxpdGVyYWwgMHglMDJ4XFxuXCIsIGhlcmUudmFsKSk7XG4gICAgICAgIG91dHB1dFtfb3V0KytdID0gaGVyZSAmIDB4ZmZmZi8qaGVyZS52YWwqLztcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYgKG9wICYgMTYpIHsgICAgICAgICAgICAgICAgICAgICAvKiBsZW5ndGggYmFzZSAqL1xuICAgICAgICBsZW4gPSBoZXJlICYgMHhmZmZmLypoZXJlLnZhbCovO1xuICAgICAgICBvcCAmPSAxNTsgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgZXh0cmEgYml0cyAqL1xuICAgICAgICBpZiAob3ApIHtcbiAgICAgICAgICBpZiAoYml0cyA8IG9wKSB7XG4gICAgICAgICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICBsZW4gKz0gaG9sZCAmICgoMSA8PCBvcCkgLSAxKTtcbiAgICAgICAgICBob2xkID4+Pj0gb3A7XG4gICAgICAgICAgYml0cyAtPSBvcDtcbiAgICAgICAgfVxuICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICAgIGxlbmd0aCAldVxcblwiLCBsZW4pKTtcbiAgICAgICAgaWYgKGJpdHMgPCAxNSkge1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbX2luKytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbX2luKytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIGhlcmUgPSBkY29kZVtob2xkICYgZG1hc2tdO1xuXG4gICAgICAgIGRvZGlzdDpcbiAgICAgICAgZm9yICg7OykgeyAvLyBnb3RvIGVtdWxhdGlvblxuICAgICAgICAgIG9wID0gaGVyZSA+Pj4gMjQvKmhlcmUuYml0cyovO1xuICAgICAgICAgIGhvbGQgPj4+PSBvcDtcbiAgICAgICAgICBiaXRzIC09IG9wO1xuICAgICAgICAgIG9wID0gKGhlcmUgPj4+IDE2KSAmIDB4ZmYvKmhlcmUub3AqLztcblxuICAgICAgICAgIGlmIChvcCAmIDE2KSB7ICAgICAgICAgICAgICAgICAgICAgIC8qIGRpc3RhbmNlIGJhc2UgKi9cbiAgICAgICAgICAgIGRpc3QgPSBoZXJlICYgMHhmZmZmLypoZXJlLnZhbCovO1xuICAgICAgICAgICAgb3AgJj0gMTU7ICAgICAgICAgICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgZXh0cmEgYml0cyAqL1xuICAgICAgICAgICAgaWYgKGJpdHMgPCBvcCkge1xuICAgICAgICAgICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgICAgIGlmIChiaXRzIDwgb3ApIHtcbiAgICAgICAgICAgICAgICBob2xkICs9IGlucHV0W19pbisrXSA8PCBiaXRzO1xuICAgICAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGlzdCArPSBob2xkICYgKCgxIDw8IG9wKSAtIDEpO1xuLy8jaWZkZWYgSU5GTEFURV9TVFJJQ1RcbiAgICAgICAgICAgIGlmIChkaXN0ID4gZG1heCkge1xuICAgICAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGRpc3RhbmNlIHRvbyBmYXIgYmFjayc7XG4gICAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgICAgIGJyZWFrIHRvcDtcbiAgICAgICAgICAgIH1cbi8vI2VuZGlmXG4gICAgICAgICAgICBob2xkID4+Pj0gb3A7XG4gICAgICAgICAgICBiaXRzIC09IG9wO1xuICAgICAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgICBkaXN0YW5jZSAldVxcblwiLCBkaXN0KSk7XG4gICAgICAgICAgICBvcCA9IF9vdXQgLSBiZWc7ICAgICAgICAgICAgICAgIC8qIG1heCBkaXN0YW5jZSBpbiBvdXRwdXQgKi9cbiAgICAgICAgICAgIGlmIChkaXN0ID4gb3ApIHsgICAgICAgICAgICAgICAgLyogc2VlIGlmIGNvcHkgZnJvbSB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgb3AgPSBkaXN0IC0gb3A7ICAgICAgICAgICAgICAgLyogZGlzdGFuY2UgYmFjayBpbiB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgaWYgKG9wID4gd2hhdmUpIHtcbiAgICAgICAgICAgICAgICBpZiAoc3RhdGUuc2FuZSkge1xuICAgICAgICAgICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBkaXN0YW5jZSB0b28gZmFyIGJhY2snO1xuICAgICAgICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICAgICAgICAgIGJyZWFrIHRvcDtcbiAgICAgICAgICAgICAgICB9XG5cbi8vICghKSBUaGlzIGJsb2NrIGlzIGRpc2FibGVkIGluIHpsaWIgZGVmYXVsdHMsXG4vLyBkb24ndCBlbmFibGUgaXQgZm9yIGJpbmFyeSBjb21wYXRpYmlsaXR5XG4vLyNpZmRlZiBJTkZMQVRFX0FMTE9XX0lOVkFMSURfRElTVEFOQ0VfVE9PRkFSX0FSUlJcbi8vICAgICAgICAgICAgICAgIGlmIChsZW4gPD0gb3AgLSB3aGF2ZSkge1xuLy8gICAgICAgICAgICAgICAgICBkbyB7XG4vLyAgICAgICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSAwO1xuLy8gICAgICAgICAgICAgICAgICB9IHdoaWxlICgtLWxlbik7XG4vLyAgICAgICAgICAgICAgICAgIGNvbnRpbnVlIHRvcDtcbi8vICAgICAgICAgICAgICAgIH1cbi8vICAgICAgICAgICAgICAgIGxlbiAtPSBvcCAtIHdoYXZlO1xuLy8gICAgICAgICAgICAgICAgZG8ge1xuLy8gICAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IDA7XG4vLyAgICAgICAgICAgICAgICB9IHdoaWxlICgtLW9wID4gd2hhdmUpO1xuLy8gICAgICAgICAgICAgICAgaWYgKG9wID09PSAwKSB7XG4vLyAgICAgICAgICAgICAgICAgIGZyb20gPSBfb3V0IC0gZGlzdDtcbi8vICAgICAgICAgICAgICAgICAgZG8ge1xuLy8gICAgICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gb3V0cHV0W2Zyb20rK107XG4vLyAgICAgICAgICAgICAgICAgIH0gd2hpbGUgKC0tbGVuKTtcbi8vICAgICAgICAgICAgICAgICAgY29udGludWUgdG9wO1xuLy8gICAgICAgICAgICAgICAgfVxuLy8jZW5kaWZcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmcm9tID0gMDsgLy8gd2luZG93IGluZGV4XG4gICAgICAgICAgICAgIGZyb21fc291cmNlID0gc193aW5kb3c7XG4gICAgICAgICAgICAgIGlmICh3bmV4dCA9PT0gMCkgeyAgICAgICAgICAgLyogdmVyeSBjb21tb24gY2FzZSAqL1xuICAgICAgICAgICAgICAgIGZyb20gKz0gd3NpemUgLSBvcDtcbiAgICAgICAgICAgICAgICBpZiAob3AgPCBsZW4pIHsgICAgICAgICAvKiBzb21lIGZyb20gd2luZG93ICovXG4gICAgICAgICAgICAgICAgICBsZW4gLT0gb3A7XG4gICAgICAgICAgICAgICAgICBkbyB7XG4gICAgICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gc193aW5kb3dbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICAgIH0gd2hpbGUgKC0tb3ApO1xuICAgICAgICAgICAgICAgICAgZnJvbSA9IF9vdXQgLSBkaXN0OyAgLyogcmVzdCBmcm9tIG91dHB1dCAqL1xuICAgICAgICAgICAgICAgICAgZnJvbV9zb3VyY2UgPSBvdXRwdXQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGVsc2UgaWYgKHduZXh0IDwgb3ApIHsgICAgICAvKiB3cmFwIGFyb3VuZCB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgICBmcm9tICs9IHdzaXplICsgd25leHQgLSBvcDtcbiAgICAgICAgICAgICAgICBvcCAtPSB3bmV4dDtcbiAgICAgICAgICAgICAgICBpZiAob3AgPCBsZW4pIHsgICAgICAgICAvKiBzb21lIGZyb20gZW5kIG9mIHdpbmRvdyAqL1xuICAgICAgICAgICAgICAgICAgbGVuIC09IG9wO1xuICAgICAgICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IHNfd2luZG93W2Zyb20rK107XG4gICAgICAgICAgICAgICAgICB9IHdoaWxlICgtLW9wKTtcbiAgICAgICAgICAgICAgICAgIGZyb20gPSAwO1xuICAgICAgICAgICAgICAgICAgaWYgKHduZXh0IDwgbGVuKSB7ICAvKiBzb21lIGZyb20gc3RhcnQgb2Ygd2luZG93ICovXG4gICAgICAgICAgICAgICAgICAgIG9wID0gd25leHQ7XG4gICAgICAgICAgICAgICAgICAgIGxlbiAtPSBvcDtcbiAgICAgICAgICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gc193aW5kb3dbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICAgICAgfSB3aGlsZSAoLS1vcCk7XG4gICAgICAgICAgICAgICAgICAgIGZyb20gPSBfb3V0IC0gZGlzdDsgICAgICAvKiByZXN0IGZyb20gb3V0cHV0ICovXG4gICAgICAgICAgICAgICAgICAgIGZyb21fc291cmNlID0gb3V0cHV0O1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBlbHNlIHsgICAgICAgICAgICAgICAgICAgICAgLyogY29udGlndW91cyBpbiB3aW5kb3cgKi9cbiAgICAgICAgICAgICAgICBmcm9tICs9IHduZXh0IC0gb3A7XG4gICAgICAgICAgICAgICAgaWYgKG9wIDwgbGVuKSB7ICAgICAgICAgLyogc29tZSBmcm9tIHdpbmRvdyAqL1xuICAgICAgICAgICAgICAgICAgbGVuIC09IG9wO1xuICAgICAgICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IHNfd2luZG93W2Zyb20rK107XG4gICAgICAgICAgICAgICAgICB9IHdoaWxlICgtLW9wKTtcbiAgICAgICAgICAgICAgICAgIGZyb20gPSBfb3V0IC0gZGlzdDsgIC8qIHJlc3QgZnJvbSBvdXRwdXQgKi9cbiAgICAgICAgICAgICAgICAgIGZyb21fc291cmNlID0gb3V0cHV0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB3aGlsZSAobGVuID4gMikge1xuICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gZnJvbV9zb3VyY2VbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IGZyb21fc291cmNlW2Zyb20rK107XG4gICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBmcm9tX3NvdXJjZVtmcm9tKytdO1xuICAgICAgICAgICAgICAgIGxlbiAtPSAzO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IGZyb21fc291cmNlW2Zyb20rK107XG4gICAgICAgICAgICAgICAgaWYgKGxlbiA+IDEpIHtcbiAgICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gZnJvbV9zb3VyY2VbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICBmcm9tID0gX291dCAtIGRpc3Q7ICAgICAgICAgIC8qIGNvcHkgZGlyZWN0IGZyb20gb3V0cHV0ICovXG4gICAgICAgICAgICAgIGRvIHsgICAgICAgICAgICAgICAgICAgICAgICAvKiBtaW5pbXVtIGxlbmd0aCBpcyB0aHJlZSAqL1xuICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gb3V0cHV0W2Zyb20rK107XG4gICAgICAgICAgICAgICAgb3V0cHV0W19vdXQrK10gPSBvdXRwdXRbZnJvbSsrXTtcbiAgICAgICAgICAgICAgICBvdXRwdXRbX291dCsrXSA9IG91dHB1dFtmcm9tKytdO1xuICAgICAgICAgICAgICAgIGxlbiAtPSAzO1xuICAgICAgICAgICAgICB9IHdoaWxlIChsZW4gPiAyKTtcbiAgICAgICAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gb3V0cHV0W2Zyb20rK107XG4gICAgICAgICAgICAgICAgaWYgKGxlbiA+IDEpIHtcbiAgICAgICAgICAgICAgICAgIG91dHB1dFtfb3V0KytdID0gb3V0cHV0W2Zyb20rK107XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2UgaWYgKChvcCAmIDY0KSA9PT0gMCkgeyAgICAgICAgICAvKiAybmQgbGV2ZWwgZGlzdGFuY2UgY29kZSAqL1xuICAgICAgICAgICAgaGVyZSA9IGRjb2RlWyhoZXJlICYgMHhmZmZmKS8qaGVyZS52YWwqLyArIChob2xkICYgKCgxIDw8IG9wKSAtIDEpKV07XG4gICAgICAgICAgICBjb250aW51ZSBkb2Rpc3Q7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBkaXN0YW5jZSBjb2RlJztcbiAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgICBicmVhayB0b3A7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYnJlYWs7IC8vIG5lZWQgdG8gZW11bGF0ZSBnb3RvIHZpYSBcImNvbnRpbnVlXCJcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSBpZiAoKG9wICYgNjQpID09PSAwKSB7ICAgICAgICAgICAgICAvKiAybmQgbGV2ZWwgbGVuZ3RoIGNvZGUgKi9cbiAgICAgICAgaGVyZSA9IGxjb2RlWyhoZXJlICYgMHhmZmZmKS8qaGVyZS52YWwqLyArIChob2xkICYgKCgxIDw8IG9wKSAtIDEpKV07XG4gICAgICAgIGNvbnRpbnVlIGRvbGVuO1xuICAgICAgfVxuICAgICAgZWxzZSBpZiAob3AgJiAzMikgeyAgICAgICAgICAgICAgICAgICAgIC8qIGVuZC1vZi1ibG9jayAqL1xuICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICAgIGVuZCBvZiBibG9ja1xcblwiKSk7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBUWVBFO1xuICAgICAgICBicmVhayB0b3A7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBsaXRlcmFsL2xlbmd0aCBjb2RlJztcbiAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgYnJlYWsgdG9wO1xuICAgICAgfVxuXG4gICAgICBicmVhazsgLy8gbmVlZCB0byBlbXVsYXRlIGdvdG8gdmlhIFwiY29udGludWVcIlxuICAgIH1cbiAgfSB3aGlsZSAoX2luIDwgbGFzdCAmJiBfb3V0IDwgZW5kKTtcblxuICAvKiByZXR1cm4gdW51c2VkIGJ5dGVzIChvbiBlbnRyeSwgYml0cyA8IDgsIHNvIGluIHdvbid0IGdvIHRvbyBmYXIgYmFjaykgKi9cbiAgbGVuID0gYml0cyA+PiAzO1xuICBfaW4gLT0gbGVuO1xuICBiaXRzIC09IGxlbiA8PCAzO1xuICBob2xkICY9ICgxIDw8IGJpdHMpIC0gMTtcblxuICAvKiB1cGRhdGUgc3RhdGUgYW5kIHJldHVybiAqL1xuICBzdHJtLm5leHRfaW4gPSBfaW47XG4gIHN0cm0ubmV4dF9vdXQgPSBfb3V0O1xuICBzdHJtLmF2YWlsX2luID0gKF9pbiA8IGxhc3QgPyA1ICsgKGxhc3QgLSBfaW4pIDogNSAtIChfaW4gLSBsYXN0KSk7XG4gIHN0cm0uYXZhaWxfb3V0ID0gKF9vdXQgPCBlbmQgPyAyNTcgKyAoZW5kIC0gX291dCkgOiAyNTcgLSAoX291dCAtIGVuZCkpO1xuICBzdGF0ZS5ob2xkID0gaG9sZDtcbiAgc3RhdGUuYml0cyA9IGJpdHM7XG4gIHJldHVybjtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxudmFyIHV0aWxzICAgICAgICAgPSByZXF1aXJlKCcuLi91dGlscy9jb21tb24nKTtcbnZhciBhZGxlcjMyICAgICAgID0gcmVxdWlyZSgnLi9hZGxlcjMyJyk7XG52YXIgY3JjMzIgICAgICAgICA9IHJlcXVpcmUoJy4vY3JjMzInKTtcbnZhciBpbmZsYXRlX2Zhc3QgID0gcmVxdWlyZSgnLi9pbmZmYXN0Jyk7XG52YXIgaW5mbGF0ZV90YWJsZSA9IHJlcXVpcmUoJy4vaW5mdHJlZXMnKTtcblxudmFyIENPREVTID0gMDtcbnZhciBMRU5TID0gMTtcbnZhciBESVNUUyA9IDI7XG5cbi8qIFB1YmxpYyBjb25zdGFudHMgPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuXG5cbi8qIEFsbG93ZWQgZmx1c2ggdmFsdWVzOyBzZWUgZGVmbGF0ZSgpIGFuZCBpbmZsYXRlKCkgYmVsb3cgZm9yIGRldGFpbHMgKi9cbi8vdmFyIFpfTk9fRkxVU0ggICAgICA9IDA7XG4vL3ZhciBaX1BBUlRJQUxfRkxVU0ggPSAxO1xuLy92YXIgWl9TWU5DX0ZMVVNIICAgID0gMjtcbi8vdmFyIFpfRlVMTF9GTFVTSCAgICA9IDM7XG52YXIgWl9GSU5JU0ggICAgICAgID0gNDtcbnZhciBaX0JMT0NLICAgICAgICAgPSA1O1xudmFyIFpfVFJFRVMgICAgICAgICA9IDY7XG5cblxuLyogUmV0dXJuIGNvZGVzIGZvciB0aGUgY29tcHJlc3Npb24vZGVjb21wcmVzc2lvbiBmdW5jdGlvbnMuIE5lZ2F0aXZlIHZhbHVlc1xuICogYXJlIGVycm9ycywgcG9zaXRpdmUgdmFsdWVzIGFyZSB1c2VkIGZvciBzcGVjaWFsIGJ1dCBub3JtYWwgZXZlbnRzLlxuICovXG52YXIgWl9PSyAgICAgICAgICAgID0gMDtcbnZhciBaX1NUUkVBTV9FTkQgICAgPSAxO1xudmFyIFpfTkVFRF9ESUNUICAgICA9IDI7XG4vL3ZhciBaX0VSUk5PICAgICAgICAgPSAtMTtcbnZhciBaX1NUUkVBTV9FUlJPUiAgPSAtMjtcbnZhciBaX0RBVEFfRVJST1IgICAgPSAtMztcbnZhciBaX01FTV9FUlJPUiAgICAgPSAtNDtcbnZhciBaX0JVRl9FUlJPUiAgICAgPSAtNTtcbi8vdmFyIFpfVkVSU0lPTl9FUlJPUiA9IC02O1xuXG4vKiBUaGUgZGVmbGF0ZSBjb21wcmVzc2lvbiBtZXRob2QgKi9cbnZhciBaX0RFRkxBVEVEICA9IDg7XG5cblxuLyogU1RBVEVTID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cblxudmFyICAgIEhFQUQgPSAxOyAgICAgICAvKiBpOiB3YWl0aW5nIGZvciBtYWdpYyBoZWFkZXIgKi9cbnZhciAgICBGTEFHUyA9IDI7ICAgICAgLyogaTogd2FpdGluZyBmb3IgbWV0aG9kIGFuZCBmbGFncyAoZ3ppcCkgKi9cbnZhciAgICBUSU1FID0gMzsgICAgICAgLyogaTogd2FpdGluZyBmb3IgbW9kaWZpY2F0aW9uIHRpbWUgKGd6aXApICovXG52YXIgICAgT1MgPSA0OyAgICAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGV4dHJhIGZsYWdzIGFuZCBvcGVyYXRpbmcgc3lzdGVtIChnemlwKSAqL1xudmFyICAgIEVYTEVOID0gNTsgICAgICAvKiBpOiB3YWl0aW5nIGZvciBleHRyYSBsZW5ndGggKGd6aXApICovXG52YXIgICAgRVhUUkEgPSA2OyAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGV4dHJhIGJ5dGVzIChnemlwKSAqL1xudmFyICAgIE5BTUUgPSA3OyAgICAgICAvKiBpOiB3YWl0aW5nIGZvciBlbmQgb2YgZmlsZSBuYW1lIChnemlwKSAqL1xudmFyICAgIENPTU1FTlQgPSA4OyAgICAvKiBpOiB3YWl0aW5nIGZvciBlbmQgb2YgY29tbWVudCAoZ3ppcCkgKi9cbnZhciAgICBIQ1JDID0gOTsgICAgICAgLyogaTogd2FpdGluZyBmb3IgaGVhZGVyIGNyYyAoZ3ppcCkgKi9cbnZhciAgICBESUNUSUQgPSAxMDsgICAgLyogaTogd2FpdGluZyBmb3IgZGljdGlvbmFyeSBjaGVjayB2YWx1ZSAqL1xudmFyICAgIERJQ1QgPSAxMTsgICAgICAvKiB3YWl0aW5nIGZvciBpbmZsYXRlU2V0RGljdGlvbmFyeSgpIGNhbGwgKi9cbnZhciAgICAgICAgVFlQRSA9IDEyOyAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIHR5cGUgYml0cywgaW5jbHVkaW5nIGxhc3QtZmxhZyBiaXQgKi9cbnZhciAgICAgICAgVFlQRURPID0gMTM7ICAgIC8qIGk6IHNhbWUsIGJ1dCBza2lwIGNoZWNrIHRvIGV4aXQgaW5mbGF0ZSBvbiBuZXcgYmxvY2sgKi9cbnZhciAgICAgICAgU1RPUkVEID0gMTQ7ICAgIC8qIGk6IHdhaXRpbmcgZm9yIHN0b3JlZCBzaXplIChsZW5ndGggYW5kIGNvbXBsZW1lbnQpICovXG52YXIgICAgICAgIENPUFlfID0gMTU7ICAgICAvKiBpL286IHNhbWUgYXMgQ09QWSBiZWxvdywgYnV0IG9ubHkgZmlyc3QgdGltZSBpbiAqL1xudmFyICAgICAgICBDT1BZID0gMTY7ICAgICAgLyogaS9vOiB3YWl0aW5nIGZvciBpbnB1dCBvciBvdXRwdXQgdG8gY29weSBzdG9yZWQgYmxvY2sgKi9cbnZhciAgICAgICAgVEFCTEUgPSAxNzsgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGR5bmFtaWMgYmxvY2sgdGFibGUgbGVuZ3RocyAqL1xudmFyICAgICAgICBMRU5MRU5TID0gMTg7ICAgLyogaTogd2FpdGluZyBmb3IgY29kZSBsZW5ndGggY29kZSBsZW5ndGhzICovXG52YXIgICAgICAgIENPREVMRU5TID0gMTk7ICAvKiBpOiB3YWl0aW5nIGZvciBsZW5ndGgvbGl0IGFuZCBkaXN0YW5jZSBjb2RlIGxlbmd0aHMgKi9cbnZhciAgICAgICAgICAgIExFTl8gPSAyMDsgICAgICAvKiBpOiBzYW1lIGFzIExFTiBiZWxvdywgYnV0IG9ubHkgZmlyc3QgdGltZSBpbiAqL1xudmFyICAgICAgICAgICAgTEVOID0gMjE7ICAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGxlbmd0aC9saXQvZW9iIGNvZGUgKi9cbnZhciAgICAgICAgICAgIExFTkVYVCA9IDIyOyAgICAvKiBpOiB3YWl0aW5nIGZvciBsZW5ndGggZXh0cmEgYml0cyAqL1xudmFyICAgICAgICAgICAgRElTVCA9IDIzOyAgICAgIC8qIGk6IHdhaXRpbmcgZm9yIGRpc3RhbmNlIGNvZGUgKi9cbnZhciAgICAgICAgICAgIERJU1RFWFQgPSAyNDsgICAvKiBpOiB3YWl0aW5nIGZvciBkaXN0YW5jZSBleHRyYSBiaXRzICovXG52YXIgICAgICAgICAgICBNQVRDSCA9IDI1OyAgICAgLyogbzogd2FpdGluZyBmb3Igb3V0cHV0IHNwYWNlIHRvIGNvcHkgc3RyaW5nICovXG52YXIgICAgICAgICAgICBMSVQgPSAyNjsgICAgICAgLyogbzogd2FpdGluZyBmb3Igb3V0cHV0IHNwYWNlIHRvIHdyaXRlIGxpdGVyYWwgKi9cbnZhciAgICBDSEVDSyA9IDI3OyAgICAgLyogaTogd2FpdGluZyBmb3IgMzItYml0IGNoZWNrIHZhbHVlICovXG52YXIgICAgTEVOR1RIID0gMjg7ICAgIC8qIGk6IHdhaXRpbmcgZm9yIDMyLWJpdCBsZW5ndGggKGd6aXApICovXG52YXIgICAgRE9ORSA9IDI5OyAgICAgIC8qIGZpbmlzaGVkIGNoZWNrLCBkb25lIC0tIHJlbWFpbiBoZXJlIHVudGlsIHJlc2V0ICovXG52YXIgICAgQkFEID0gMzA7ICAgICAgIC8qIGdvdCBhIGRhdGEgZXJyb3IgLS0gcmVtYWluIGhlcmUgdW50aWwgcmVzZXQgKi9cbnZhciAgICBNRU0gPSAzMTsgICAgICAgLyogZ290IGFuIGluZmxhdGUoKSBtZW1vcnkgZXJyb3IgLS0gcmVtYWluIGhlcmUgdW50aWwgcmVzZXQgKi9cbnZhciAgICBTWU5DID0gMzI7ICAgICAgLyogbG9va2luZyBmb3Igc3luY2hyb25pemF0aW9uIGJ5dGVzIHRvIHJlc3RhcnQgaW5mbGF0ZSgpICovXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSovXG5cblxuXG52YXIgRU5PVUdIX0xFTlMgPSA4NTI7XG52YXIgRU5PVUdIX0RJU1RTID0gNTkyO1xuLy92YXIgRU5PVUdIID0gIChFTk9VR0hfTEVOUytFTk9VR0hfRElTVFMpO1xuXG52YXIgTUFYX1dCSVRTID0gMTU7XG4vKiAzMksgTFo3NyB3aW5kb3cgKi9cbnZhciBERUZfV0JJVFMgPSBNQVhfV0JJVFM7XG5cblxuZnVuY3Rpb24genN3YXAzMihxKSB7XG4gIHJldHVybiAgKCgocSA+Pj4gMjQpICYgMHhmZikgK1xuICAgICAgICAgICgocSA+Pj4gOCkgJiAweGZmMDApICtcbiAgICAgICAgICAoKHEgJiAweGZmMDApIDw8IDgpICtcbiAgICAgICAgICAoKHEgJiAweGZmKSA8PCAyNCkpO1xufVxuXG5cbmZ1bmN0aW9uIEluZmxhdGVTdGF0ZSgpIHtcbiAgdGhpcy5tb2RlID0gMDsgICAgICAgICAgICAgLyogY3VycmVudCBpbmZsYXRlIG1vZGUgKi9cbiAgdGhpcy5sYXN0ID0gZmFsc2U7ICAgICAgICAgIC8qIHRydWUgaWYgcHJvY2Vzc2luZyBsYXN0IGJsb2NrICovXG4gIHRoaXMud3JhcCA9IDA7ICAgICAgICAgICAgICAvKiBiaXQgMCB0cnVlIGZvciB6bGliLCBiaXQgMSB0cnVlIGZvciBnemlwICovXG4gIHRoaXMuaGF2ZWRpY3QgPSBmYWxzZTsgICAgICAvKiB0cnVlIGlmIGRpY3Rpb25hcnkgcHJvdmlkZWQgKi9cbiAgdGhpcy5mbGFncyA9IDA7ICAgICAgICAgICAgIC8qIGd6aXAgaGVhZGVyIG1ldGhvZCBhbmQgZmxhZ3MgKDAgaWYgemxpYikgKi9cbiAgdGhpcy5kbWF4ID0gMDsgICAgICAgICAgICAgIC8qIHpsaWIgaGVhZGVyIG1heCBkaXN0YW5jZSAoSU5GTEFURV9TVFJJQ1QpICovXG4gIHRoaXMuY2hlY2sgPSAwOyAgICAgICAgICAgICAvKiBwcm90ZWN0ZWQgY29weSBvZiBjaGVjayB2YWx1ZSAqL1xuICB0aGlzLnRvdGFsID0gMDsgICAgICAgICAgICAgLyogcHJvdGVjdGVkIGNvcHkgb2Ygb3V0cHV0IGNvdW50ICovXG4gIC8vIFRPRE86IG1heSBiZSB7fVxuICB0aGlzLmhlYWQgPSBudWxsOyAgICAgICAgICAgLyogd2hlcmUgdG8gc2F2ZSBnemlwIGhlYWRlciBpbmZvcm1hdGlvbiAqL1xuXG4gIC8qIHNsaWRpbmcgd2luZG93ICovXG4gIHRoaXMud2JpdHMgPSAwOyAgICAgICAgICAgICAvKiBsb2cgYmFzZSAyIG9mIHJlcXVlc3RlZCB3aW5kb3cgc2l6ZSAqL1xuICB0aGlzLndzaXplID0gMDsgICAgICAgICAgICAgLyogd2luZG93IHNpemUgb3IgemVybyBpZiBub3QgdXNpbmcgd2luZG93ICovXG4gIHRoaXMud2hhdmUgPSAwOyAgICAgICAgICAgICAvKiB2YWxpZCBieXRlcyBpbiB0aGUgd2luZG93ICovXG4gIHRoaXMud25leHQgPSAwOyAgICAgICAgICAgICAvKiB3aW5kb3cgd3JpdGUgaW5kZXggKi9cbiAgdGhpcy53aW5kb3cgPSBudWxsOyAgICAgICAgIC8qIGFsbG9jYXRlZCBzbGlkaW5nIHdpbmRvdywgaWYgbmVlZGVkICovXG5cbiAgLyogYml0IGFjY3VtdWxhdG9yICovXG4gIHRoaXMuaG9sZCA9IDA7ICAgICAgICAgICAgICAvKiBpbnB1dCBiaXQgYWNjdW11bGF0b3IgKi9cbiAgdGhpcy5iaXRzID0gMDsgICAgICAgICAgICAgIC8qIG51bWJlciBvZiBiaXRzIGluIFwiaW5cIiAqL1xuXG4gIC8qIGZvciBzdHJpbmcgYW5kIHN0b3JlZCBibG9jayBjb3B5aW5nICovXG4gIHRoaXMubGVuZ3RoID0gMDsgICAgICAgICAgICAvKiBsaXRlcmFsIG9yIGxlbmd0aCBvZiBkYXRhIHRvIGNvcHkgKi9cbiAgdGhpcy5vZmZzZXQgPSAwOyAgICAgICAgICAgIC8qIGRpc3RhbmNlIGJhY2sgdG8gY29weSBzdHJpbmcgZnJvbSAqL1xuXG4gIC8qIGZvciB0YWJsZSBhbmQgY29kZSBkZWNvZGluZyAqL1xuICB0aGlzLmV4dHJhID0gMDsgICAgICAgICAgICAgLyogZXh0cmEgYml0cyBuZWVkZWQgKi9cblxuICAvKiBmaXhlZCBhbmQgZHluYW1pYyBjb2RlIHRhYmxlcyAqL1xuICB0aGlzLmxlbmNvZGUgPSBudWxsOyAgICAgICAgICAvKiBzdGFydGluZyB0YWJsZSBmb3IgbGVuZ3RoL2xpdGVyYWwgY29kZXMgKi9cbiAgdGhpcy5kaXN0Y29kZSA9IG51bGw7ICAgICAgICAgLyogc3RhcnRpbmcgdGFibGUgZm9yIGRpc3RhbmNlIGNvZGVzICovXG4gIHRoaXMubGVuYml0cyA9IDA7ICAgICAgICAgICAvKiBpbmRleCBiaXRzIGZvciBsZW5jb2RlICovXG4gIHRoaXMuZGlzdGJpdHMgPSAwOyAgICAgICAgICAvKiBpbmRleCBiaXRzIGZvciBkaXN0Y29kZSAqL1xuXG4gIC8qIGR5bmFtaWMgdGFibGUgYnVpbGRpbmcgKi9cbiAgdGhpcy5uY29kZSA9IDA7ICAgICAgICAgICAgIC8qIG51bWJlciBvZiBjb2RlIGxlbmd0aCBjb2RlIGxlbmd0aHMgKi9cbiAgdGhpcy5ubGVuID0gMDsgICAgICAgICAgICAgIC8qIG51bWJlciBvZiBsZW5ndGggY29kZSBsZW5ndGhzICovXG4gIHRoaXMubmRpc3QgPSAwOyAgICAgICAgICAgICAvKiBudW1iZXIgb2YgZGlzdGFuY2UgY29kZSBsZW5ndGhzICovXG4gIHRoaXMuaGF2ZSA9IDA7ICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgY29kZSBsZW5ndGhzIGluIGxlbnNbXSAqL1xuICB0aGlzLm5leHQgPSBudWxsOyAgICAgICAgICAgICAgLyogbmV4dCBhdmFpbGFibGUgc3BhY2UgaW4gY29kZXNbXSAqL1xuXG4gIHRoaXMubGVucyA9IG5ldyB1dGlscy5CdWYxNigzMjApOyAvKiB0ZW1wb3Jhcnkgc3RvcmFnZSBmb3IgY29kZSBsZW5ndGhzICovXG4gIHRoaXMud29yayA9IG5ldyB1dGlscy5CdWYxNigyODgpOyAvKiB3b3JrIGFyZWEgZm9yIGNvZGUgdGFibGUgYnVpbGRpbmcgKi9cblxuICAvKlxuICAgYmVjYXVzZSB3ZSBkb24ndCBoYXZlIHBvaW50ZXJzIGluIGpzLCB3ZSB1c2UgbGVuY29kZSBhbmQgZGlzdGNvZGUgZGlyZWN0bHlcbiAgIGFzIGJ1ZmZlcnMgc28gd2UgZG9uJ3QgbmVlZCBjb2Rlc1xuICAqL1xuICAvL3RoaXMuY29kZXMgPSBuZXcgdXRpbHMuQnVmMzIoRU5PVUdIKTsgICAgICAgLyogc3BhY2UgZm9yIGNvZGUgdGFibGVzICovXG4gIHRoaXMubGVuZHluID0gbnVsbDsgICAgICAgICAgICAgIC8qIGR5bmFtaWMgdGFibGUgZm9yIGxlbmd0aC9saXRlcmFsIGNvZGVzIChKUyBzcGVjaWZpYykgKi9cbiAgdGhpcy5kaXN0ZHluID0gbnVsbDsgICAgICAgICAgICAgLyogZHluYW1pYyB0YWJsZSBmb3IgZGlzdGFuY2UgY29kZXMgKEpTIHNwZWNpZmljKSAqL1xuICB0aGlzLnNhbmUgPSAwOyAgICAgICAgICAgICAgICAgICAvKiBpZiBmYWxzZSwgYWxsb3cgaW52YWxpZCBkaXN0YW5jZSB0b28gZmFyICovXG4gIHRoaXMuYmFjayA9IDA7ICAgICAgICAgICAgICAgICAgIC8qIGJpdHMgYmFjayBvZiBsYXN0IHVucHJvY2Vzc2VkIGxlbmd0aC9saXQgKi9cbiAgdGhpcy53YXMgPSAwOyAgICAgICAgICAgICAgICAgICAgLyogaW5pdGlhbCBsZW5ndGggb2YgbWF0Y2ggKi9cbn1cblxuZnVuY3Rpb24gaW5mbGF0ZVJlc2V0S2VlcChzdHJtKSB7XG4gIHZhciBzdGF0ZTtcblxuICBpZiAoIXN0cm0gfHwgIXN0cm0uc3RhdGUpIHsgcmV0dXJuIFpfU1RSRUFNX0VSUk9SOyB9XG4gIHN0YXRlID0gc3RybS5zdGF0ZTtcbiAgc3RybS50b3RhbF9pbiA9IHN0cm0udG90YWxfb3V0ID0gc3RhdGUudG90YWwgPSAwO1xuICBzdHJtLm1zZyA9ICcnOyAvKlpfTlVMTCovXG4gIGlmIChzdGF0ZS53cmFwKSB7ICAgICAgIC8qIHRvIHN1cHBvcnQgaWxsLWNvbmNlaXZlZCBKYXZhIHRlc3Qgc3VpdGUgKi9cbiAgICBzdHJtLmFkbGVyID0gc3RhdGUud3JhcCAmIDE7XG4gIH1cbiAgc3RhdGUubW9kZSA9IEhFQUQ7XG4gIHN0YXRlLmxhc3QgPSAwO1xuICBzdGF0ZS5oYXZlZGljdCA9IDA7XG4gIHN0YXRlLmRtYXggPSAzMjc2ODtcbiAgc3RhdGUuaGVhZCA9IG51bGwvKlpfTlVMTCovO1xuICBzdGF0ZS5ob2xkID0gMDtcbiAgc3RhdGUuYml0cyA9IDA7XG4gIC8vc3RhdGUubGVuY29kZSA9IHN0YXRlLmRpc3Rjb2RlID0gc3RhdGUubmV4dCA9IHN0YXRlLmNvZGVzO1xuICBzdGF0ZS5sZW5jb2RlID0gc3RhdGUubGVuZHluID0gbmV3IHV0aWxzLkJ1ZjMyKEVOT1VHSF9MRU5TKTtcbiAgc3RhdGUuZGlzdGNvZGUgPSBzdGF0ZS5kaXN0ZHluID0gbmV3IHV0aWxzLkJ1ZjMyKEVOT1VHSF9ESVNUUyk7XG5cbiAgc3RhdGUuc2FuZSA9IDE7XG4gIHN0YXRlLmJhY2sgPSAtMTtcbiAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiByZXNldFxcblwiKSk7XG4gIHJldHVybiBaX09LO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlUmVzZXQoc3RybSkge1xuICB2YXIgc3RhdGU7XG5cbiAgaWYgKCFzdHJtIHx8ICFzdHJtLnN0YXRlKSB7IHJldHVybiBaX1NUUkVBTV9FUlJPUjsgfVxuICBzdGF0ZSA9IHN0cm0uc3RhdGU7XG4gIHN0YXRlLndzaXplID0gMDtcbiAgc3RhdGUud2hhdmUgPSAwO1xuICBzdGF0ZS53bmV4dCA9IDA7XG4gIHJldHVybiBpbmZsYXRlUmVzZXRLZWVwKHN0cm0pO1xuXG59XG5cbmZ1bmN0aW9uIGluZmxhdGVSZXNldDIoc3RybSwgd2luZG93Qml0cykge1xuICB2YXIgd3JhcDtcbiAgdmFyIHN0YXRlO1xuXG4gIC8qIGdldCB0aGUgc3RhdGUgKi9cbiAgaWYgKCFzdHJtIHx8ICFzdHJtLnN0YXRlKSB7IHJldHVybiBaX1NUUkVBTV9FUlJPUjsgfVxuICBzdGF0ZSA9IHN0cm0uc3RhdGU7XG5cbiAgLyogZXh0cmFjdCB3cmFwIHJlcXVlc3QgZnJvbSB3aW5kb3dCaXRzIHBhcmFtZXRlciAqL1xuICBpZiAod2luZG93Qml0cyA8IDApIHtcbiAgICB3cmFwID0gMDtcbiAgICB3aW5kb3dCaXRzID0gLXdpbmRvd0JpdHM7XG4gIH1cbiAgZWxzZSB7XG4gICAgd3JhcCA9ICh3aW5kb3dCaXRzID4+IDQpICsgMTtcbiAgICBpZiAod2luZG93Qml0cyA8IDQ4KSB7XG4gICAgICB3aW5kb3dCaXRzICY9IDE1O1xuICAgIH1cbiAgfVxuXG4gIC8qIHNldCBudW1iZXIgb2Ygd2luZG93IGJpdHMsIGZyZWUgd2luZG93IGlmIGRpZmZlcmVudCAqL1xuICBpZiAod2luZG93Qml0cyAmJiAod2luZG93Qml0cyA8IDggfHwgd2luZG93Qml0cyA+IDE1KSkge1xuICAgIHJldHVybiBaX1NUUkVBTV9FUlJPUjtcbiAgfVxuICBpZiAoc3RhdGUud2luZG93ICE9PSBudWxsICYmIHN0YXRlLndiaXRzICE9PSB3aW5kb3dCaXRzKSB7XG4gICAgc3RhdGUud2luZG93ID0gbnVsbDtcbiAgfVxuXG4gIC8qIHVwZGF0ZSBzdGF0ZSBhbmQgcmVzZXQgdGhlIHJlc3Qgb2YgaXQgKi9cbiAgc3RhdGUud3JhcCA9IHdyYXA7XG4gIHN0YXRlLndiaXRzID0gd2luZG93Qml0cztcbiAgcmV0dXJuIGluZmxhdGVSZXNldChzdHJtKTtcbn1cblxuZnVuY3Rpb24gaW5mbGF0ZUluaXQyKHN0cm0sIHdpbmRvd0JpdHMpIHtcbiAgdmFyIHJldDtcbiAgdmFyIHN0YXRlO1xuXG4gIGlmICghc3RybSkgeyByZXR1cm4gWl9TVFJFQU1fRVJST1I7IH1cbiAgLy9zdHJtLm1zZyA9IFpfTlVMTDsgICAgICAgICAgICAgICAgIC8qIGluIGNhc2Ugd2UgcmV0dXJuIGFuIGVycm9yICovXG5cbiAgc3RhdGUgPSBuZXcgSW5mbGF0ZVN0YXRlKCk7XG5cbiAgLy9pZiAoc3RhdGUgPT09IFpfTlVMTCkgcmV0dXJuIFpfTUVNX0VSUk9SO1xuICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6IGFsbG9jYXRlZFxcblwiKSk7XG4gIHN0cm0uc3RhdGUgPSBzdGF0ZTtcbiAgc3RhdGUud2luZG93ID0gbnVsbC8qWl9OVUxMKi87XG4gIHJldCA9IGluZmxhdGVSZXNldDIoc3RybSwgd2luZG93Qml0cyk7XG4gIGlmIChyZXQgIT09IFpfT0spIHtcbiAgICBzdHJtLnN0YXRlID0gbnVsbC8qWl9OVUxMKi87XG4gIH1cbiAgcmV0dXJuIHJldDtcbn1cblxuZnVuY3Rpb24gaW5mbGF0ZUluaXQoc3RybSkge1xuICByZXR1cm4gaW5mbGF0ZUluaXQyKHN0cm0sIERFRl9XQklUUyk7XG59XG5cblxuLypcbiBSZXR1cm4gc3RhdGUgd2l0aCBsZW5ndGggYW5kIGRpc3RhbmNlIGRlY29kaW5nIHRhYmxlcyBhbmQgaW5kZXggc2l6ZXMgc2V0IHRvXG4gZml4ZWQgY29kZSBkZWNvZGluZy4gIE5vcm1hbGx5IHRoaXMgcmV0dXJucyBmaXhlZCB0YWJsZXMgZnJvbSBpbmZmaXhlZC5oLlxuIElmIEJVSUxERklYRUQgaXMgZGVmaW5lZCwgdGhlbiBpbnN0ZWFkIHRoaXMgcm91dGluZSBidWlsZHMgdGhlIHRhYmxlcyB0aGVcbiBmaXJzdCB0aW1lIGl0J3MgY2FsbGVkLCBhbmQgcmV0dXJucyB0aG9zZSB0YWJsZXMgdGhlIGZpcnN0IHRpbWUgYW5kXG4gdGhlcmVhZnRlci4gIFRoaXMgcmVkdWNlcyB0aGUgc2l6ZSBvZiB0aGUgY29kZSBieSBhYm91dCAySyBieXRlcywgaW5cbiBleGNoYW5nZSBmb3IgYSBsaXR0bGUgZXhlY3V0aW9uIHRpbWUuICBIb3dldmVyLCBCVUlMREZJWEVEIHNob3VsZCBub3QgYmVcbiB1c2VkIGZvciB0aHJlYWRlZCBhcHBsaWNhdGlvbnMsIHNpbmNlIHRoZSByZXdyaXRpbmcgb2YgdGhlIHRhYmxlcyBhbmQgdmlyZ2luXG4gbWF5IG5vdCBiZSB0aHJlYWQtc2FmZS5cbiAqL1xudmFyIHZpcmdpbiA9IHRydWU7XG5cbnZhciBsZW5maXgsIGRpc3RmaXg7IC8vIFdlIGhhdmUgbm8gcG9pbnRlcnMgaW4gSlMsIHNvIGtlZXAgdGFibGVzIHNlcGFyYXRlXG5cbmZ1bmN0aW9uIGZpeGVkdGFibGVzKHN0YXRlKSB7XG4gIC8qIGJ1aWxkIGZpeGVkIGh1ZmZtYW4gdGFibGVzIGlmIGZpcnN0IGNhbGwgKG1heSBub3QgYmUgdGhyZWFkIHNhZmUpICovXG4gIGlmICh2aXJnaW4pIHtcbiAgICB2YXIgc3ltO1xuXG4gICAgbGVuZml4ID0gbmV3IHV0aWxzLkJ1ZjMyKDUxMik7XG4gICAgZGlzdGZpeCA9IG5ldyB1dGlscy5CdWYzMigzMik7XG5cbiAgICAvKiBsaXRlcmFsL2xlbmd0aCB0YWJsZSAqL1xuICAgIHN5bSA9IDA7XG4gICAgd2hpbGUgKHN5bSA8IDE0NCkgeyBzdGF0ZS5sZW5zW3N5bSsrXSA9IDg7IH1cbiAgICB3aGlsZSAoc3ltIDwgMjU2KSB7IHN0YXRlLmxlbnNbc3ltKytdID0gOTsgfVxuICAgIHdoaWxlIChzeW0gPCAyODApIHsgc3RhdGUubGVuc1tzeW0rK10gPSA3OyB9XG4gICAgd2hpbGUgKHN5bSA8IDI4OCkgeyBzdGF0ZS5sZW5zW3N5bSsrXSA9IDg7IH1cblxuICAgIGluZmxhdGVfdGFibGUoTEVOUywgIHN0YXRlLmxlbnMsIDAsIDI4OCwgbGVuZml4LCAgIDAsIHN0YXRlLndvcmssIHsgYml0czogOSB9KTtcblxuICAgIC8qIGRpc3RhbmNlIHRhYmxlICovXG4gICAgc3ltID0gMDtcbiAgICB3aGlsZSAoc3ltIDwgMzIpIHsgc3RhdGUubGVuc1tzeW0rK10gPSA1OyB9XG5cbiAgICBpbmZsYXRlX3RhYmxlKERJU1RTLCBzdGF0ZS5sZW5zLCAwLCAzMiwgICBkaXN0Zml4LCAwLCBzdGF0ZS53b3JrLCB7IGJpdHM6IDUgfSk7XG5cbiAgICAvKiBkbyB0aGlzIGp1c3Qgb25jZSAqL1xuICAgIHZpcmdpbiA9IGZhbHNlO1xuICB9XG5cbiAgc3RhdGUubGVuY29kZSA9IGxlbmZpeDtcbiAgc3RhdGUubGVuYml0cyA9IDk7XG4gIHN0YXRlLmRpc3Rjb2RlID0gZGlzdGZpeDtcbiAgc3RhdGUuZGlzdGJpdHMgPSA1O1xufVxuXG5cbi8qXG4gVXBkYXRlIHRoZSB3aW5kb3cgd2l0aCB0aGUgbGFzdCB3c2l6ZSAobm9ybWFsbHkgMzJLKSBieXRlcyB3cml0dGVuIGJlZm9yZVxuIHJldHVybmluZy4gIElmIHdpbmRvdyBkb2VzIG5vdCBleGlzdCB5ZXQsIGNyZWF0ZSBpdC4gIFRoaXMgaXMgb25seSBjYWxsZWRcbiB3aGVuIGEgd2luZG93IGlzIGFscmVhZHkgaW4gdXNlLCBvciB3aGVuIG91dHB1dCBoYXMgYmVlbiB3cml0dGVuIGR1cmluZyB0aGlzXG4gaW5mbGF0ZSBjYWxsLCBidXQgdGhlIGVuZCBvZiB0aGUgZGVmbGF0ZSBzdHJlYW0gaGFzIG5vdCBiZWVuIHJlYWNoZWQgeWV0LlxuIEl0IGlzIGFsc28gY2FsbGVkIHRvIGNyZWF0ZSBhIHdpbmRvdyBmb3IgZGljdGlvbmFyeSBkYXRhIHdoZW4gYSBkaWN0aW9uYXJ5XG4gaXMgbG9hZGVkLlxuXG4gUHJvdmlkaW5nIG91dHB1dCBidWZmZXJzIGxhcmdlciB0aGFuIDMySyB0byBpbmZsYXRlKCkgc2hvdWxkIHByb3ZpZGUgYSBzcGVlZFxuIGFkdmFudGFnZSwgc2luY2Ugb25seSB0aGUgbGFzdCAzMksgb2Ygb3V0cHV0IGlzIGNvcGllZCB0byB0aGUgc2xpZGluZyB3aW5kb3dcbiB1cG9uIHJldHVybiBmcm9tIGluZmxhdGUoKSwgYW5kIHNpbmNlIGFsbCBkaXN0YW5jZXMgYWZ0ZXIgdGhlIGZpcnN0IDMySyBvZlxuIG91dHB1dCB3aWxsIGZhbGwgaW4gdGhlIG91dHB1dCBkYXRhLCBtYWtpbmcgbWF0Y2ggY29waWVzIHNpbXBsZXIgYW5kIGZhc3Rlci5cbiBUaGUgYWR2YW50YWdlIG1heSBiZSBkZXBlbmRlbnQgb24gdGhlIHNpemUgb2YgdGhlIHByb2Nlc3NvcidzIGRhdGEgY2FjaGVzLlxuICovXG5mdW5jdGlvbiB1cGRhdGV3aW5kb3coc3RybSwgc3JjLCBlbmQsIGNvcHkpIHtcbiAgdmFyIGRpc3Q7XG4gIHZhciBzdGF0ZSA9IHN0cm0uc3RhdGU7XG5cbiAgLyogaWYgaXQgaGFzbid0IGJlZW4gZG9uZSBhbHJlYWR5LCBhbGxvY2F0ZSBzcGFjZSBmb3IgdGhlIHdpbmRvdyAqL1xuICBpZiAoc3RhdGUud2luZG93ID09PSBudWxsKSB7XG4gICAgc3RhdGUud3NpemUgPSAxIDw8IHN0YXRlLndiaXRzO1xuICAgIHN0YXRlLnduZXh0ID0gMDtcbiAgICBzdGF0ZS53aGF2ZSA9IDA7XG5cbiAgICBzdGF0ZS53aW5kb3cgPSBuZXcgdXRpbHMuQnVmOChzdGF0ZS53c2l6ZSk7XG4gIH1cblxuICAvKiBjb3B5IHN0YXRlLT53c2l6ZSBvciBsZXNzIG91dHB1dCBieXRlcyBpbnRvIHRoZSBjaXJjdWxhciB3aW5kb3cgKi9cbiAgaWYgKGNvcHkgPj0gc3RhdGUud3NpemUpIHtcbiAgICB1dGlscy5hcnJheVNldChzdGF0ZS53aW5kb3csIHNyYywgZW5kIC0gc3RhdGUud3NpemUsIHN0YXRlLndzaXplLCAwKTtcbiAgICBzdGF0ZS53bmV4dCA9IDA7XG4gICAgc3RhdGUud2hhdmUgPSBzdGF0ZS53c2l6ZTtcbiAgfVxuICBlbHNlIHtcbiAgICBkaXN0ID0gc3RhdGUud3NpemUgLSBzdGF0ZS53bmV4dDtcbiAgICBpZiAoZGlzdCA+IGNvcHkpIHtcbiAgICAgIGRpc3QgPSBjb3B5O1xuICAgIH1cbiAgICAvL3ptZW1jcHkoc3RhdGUtPndpbmRvdyArIHN0YXRlLT53bmV4dCwgZW5kIC0gY29weSwgZGlzdCk7XG4gICAgdXRpbHMuYXJyYXlTZXQoc3RhdGUud2luZG93LCBzcmMsIGVuZCAtIGNvcHksIGRpc3QsIHN0YXRlLnduZXh0KTtcbiAgICBjb3B5IC09IGRpc3Q7XG4gICAgaWYgKGNvcHkpIHtcbiAgICAgIC8vem1lbWNweShzdGF0ZS0+d2luZG93LCBlbmQgLSBjb3B5LCBjb3B5KTtcbiAgICAgIHV0aWxzLmFycmF5U2V0KHN0YXRlLndpbmRvdywgc3JjLCBlbmQgLSBjb3B5LCBjb3B5LCAwKTtcbiAgICAgIHN0YXRlLnduZXh0ID0gY29weTtcbiAgICAgIHN0YXRlLndoYXZlID0gc3RhdGUud3NpemU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgc3RhdGUud25leHQgKz0gZGlzdDtcbiAgICAgIGlmIChzdGF0ZS53bmV4dCA9PT0gc3RhdGUud3NpemUpIHsgc3RhdGUud25leHQgPSAwOyB9XG4gICAgICBpZiAoc3RhdGUud2hhdmUgPCBzdGF0ZS53c2l6ZSkgeyBzdGF0ZS53aGF2ZSArPSBkaXN0OyB9XG4gICAgfVxuICB9XG4gIHJldHVybiAwO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlKHN0cm0sIGZsdXNoKSB7XG4gIHZhciBzdGF0ZTtcbiAgdmFyIGlucHV0LCBvdXRwdXQ7ICAgICAgICAgIC8vIGlucHV0L291dHB1dCBidWZmZXJzXG4gIHZhciBuZXh0OyAgICAgICAgICAgICAgICAgICAvKiBuZXh0IGlucHV0IElOREVYICovXG4gIHZhciBwdXQ7ICAgICAgICAgICAgICAgICAgICAvKiBuZXh0IG91dHB1dCBJTkRFWCAqL1xuICB2YXIgaGF2ZSwgbGVmdDsgICAgICAgICAgICAgLyogYXZhaWxhYmxlIGlucHV0IGFuZCBvdXRwdXQgKi9cbiAgdmFyIGhvbGQ7ICAgICAgICAgICAgICAgICAgIC8qIGJpdCBidWZmZXIgKi9cbiAgdmFyIGJpdHM7ICAgICAgICAgICAgICAgICAgIC8qIGJpdHMgaW4gYml0IGJ1ZmZlciAqL1xuICB2YXIgX2luLCBfb3V0OyAgICAgICAgICAgICAgLyogc2F2ZSBzdGFydGluZyBhdmFpbGFibGUgaW5wdXQgYW5kIG91dHB1dCAqL1xuICB2YXIgY29weTsgICAgICAgICAgICAgICAgICAgLyogbnVtYmVyIG9mIHN0b3JlZCBvciBtYXRjaCBieXRlcyB0byBjb3B5ICovXG4gIHZhciBmcm9tOyAgICAgICAgICAgICAgICAgICAvKiB3aGVyZSB0byBjb3B5IG1hdGNoIGJ5dGVzIGZyb20gKi9cbiAgdmFyIGZyb21fc291cmNlO1xuICB2YXIgaGVyZSA9IDA7ICAgICAgICAgICAgICAgLyogY3VycmVudCBkZWNvZGluZyB0YWJsZSBlbnRyeSAqL1xuICB2YXIgaGVyZV9iaXRzLCBoZXJlX29wLCBoZXJlX3ZhbDsgLy8gcGFrZWQgXCJoZXJlXCIgZGVub3JtYWxpemVkIChKUyBzcGVjaWZpYylcbiAgLy92YXIgbGFzdDsgICAgICAgICAgICAgICAgICAgLyogcGFyZW50IHRhYmxlIGVudHJ5ICovXG4gIHZhciBsYXN0X2JpdHMsIGxhc3Rfb3AsIGxhc3RfdmFsOyAvLyBwYWtlZCBcImxhc3RcIiBkZW5vcm1hbGl6ZWQgKEpTIHNwZWNpZmljKVxuICB2YXIgbGVuOyAgICAgICAgICAgICAgICAgICAgLyogbGVuZ3RoIHRvIGNvcHkgZm9yIHJlcGVhdHMsIGJpdHMgdG8gZHJvcCAqL1xuICB2YXIgcmV0OyAgICAgICAgICAgICAgICAgICAgLyogcmV0dXJuIGNvZGUgKi9cbiAgdmFyIGhidWYgPSBuZXcgdXRpbHMuQnVmOCg0KTsgICAgLyogYnVmZmVyIGZvciBnemlwIGhlYWRlciBjcmMgY2FsY3VsYXRpb24gKi9cbiAgdmFyIG9wdHM7XG5cbiAgdmFyIG47IC8vIHRlbXBvcmFyeSB2YXIgZm9yIE5FRURfQklUU1xuXG4gIHZhciBvcmRlciA9IC8qIHBlcm11dGF0aW9uIG9mIGNvZGUgbGVuZ3RocyAqL1xuICAgIFsgMTYsIDE3LCAxOCwgMCwgOCwgNywgOSwgNiwgMTAsIDUsIDExLCA0LCAxMiwgMywgMTMsIDIsIDE0LCAxLCAxNSBdO1xuXG5cbiAgaWYgKCFzdHJtIHx8ICFzdHJtLnN0YXRlIHx8ICFzdHJtLm91dHB1dCB8fFxuICAgICAgKCFzdHJtLmlucHV0ICYmIHN0cm0uYXZhaWxfaW4gIT09IDApKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuICB9XG5cbiAgc3RhdGUgPSBzdHJtLnN0YXRlO1xuICBpZiAoc3RhdGUubW9kZSA9PT0gVFlQRSkgeyBzdGF0ZS5tb2RlID0gVFlQRURPOyB9ICAgIC8qIHNraXAgY2hlY2sgKi9cblxuXG4gIC8vLS0tIExPQUQoKSAtLS1cbiAgcHV0ID0gc3RybS5uZXh0X291dDtcbiAgb3V0cHV0ID0gc3RybS5vdXRwdXQ7XG4gIGxlZnQgPSBzdHJtLmF2YWlsX291dDtcbiAgbmV4dCA9IHN0cm0ubmV4dF9pbjtcbiAgaW5wdXQgPSBzdHJtLmlucHV0O1xuICBoYXZlID0gc3RybS5hdmFpbF9pbjtcbiAgaG9sZCA9IHN0YXRlLmhvbGQ7XG4gIGJpdHMgPSBzdGF0ZS5iaXRzO1xuICAvLy0tLVxuXG4gIF9pbiA9IGhhdmU7XG4gIF9vdXQgPSBsZWZ0O1xuICByZXQgPSBaX09LO1xuXG4gIGluZl9sZWF2ZTogLy8gZ290byBlbXVsYXRpb25cbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoc3RhdGUubW9kZSkge1xuICAgICAgY2FzZSBIRUFEOlxuICAgICAgICBpZiAoc3RhdGUud3JhcCA9PT0gMCkge1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBUWVBFRE87XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy89PT0gTkVFREJJVFMoMTYpO1xuICAgICAgICB3aGlsZSAoYml0cyA8IDE2KSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIGlmICgoc3RhdGUud3JhcCAmIDIpICYmIGhvbGQgPT09IDB4OGIxZikgeyAgLyogZ3ppcCBoZWFkZXIgKi9cbiAgICAgICAgICBzdGF0ZS5jaGVjayA9IDAvKmNyYzMyKDBMLCBaX05VTEwsIDApKi87XG4gICAgICAgICAgLy89PT0gQ1JDMihzdGF0ZS5jaGVjaywgaG9sZCk7XG4gICAgICAgICAgaGJ1ZlswXSA9IGhvbGQgJiAweGZmO1xuICAgICAgICAgIGhidWZbMV0gPSAoaG9sZCA+Pj4gOCkgJiAweGZmO1xuICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzIoc3RhdGUuY2hlY2ssIGhidWYsIDIsIDApO1xuICAgICAgICAgIC8vPT09Ly9cblxuICAgICAgICAgIC8vPT09IElOSVRCSVRTKCk7XG4gICAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgICAgYml0cyA9IDA7XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBGTEFHUztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5mbGFncyA9IDA7ICAgICAgICAgICAvKiBleHBlY3QgemxpYiBoZWFkZXIgKi9cbiAgICAgICAgaWYgKHN0YXRlLmhlYWQpIHtcbiAgICAgICAgICBzdGF0ZS5oZWFkLmRvbmUgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIShzdGF0ZS53cmFwICYgMSkgfHwgICAvKiBjaGVjayBpZiB6bGliIGhlYWRlciBhbGxvd2VkICovXG4gICAgICAgICAgKCgoaG9sZCAmIDB4ZmYpLypCSVRTKDgpKi8gPDwgOCkgKyAoaG9sZCA+PiA4KSkgJSAzMSkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2luY29ycmVjdCBoZWFkZXIgY2hlY2snO1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKChob2xkICYgMHgwZikvKkJJVFMoNCkqLyAhPT0gWl9ERUZMQVRFRCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ3Vua25vd24gY29tcHJlc3Npb24gbWV0aG9kJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vLS0tIERST1BCSVRTKDQpIC0tLS8vXG4gICAgICAgIGhvbGQgPj4+PSA0O1xuICAgICAgICBiaXRzIC09IDQ7XG4gICAgICAgIC8vLS0tLy9cbiAgICAgICAgbGVuID0gKGhvbGQgJiAweDBmKS8qQklUUyg0KSovICsgODtcbiAgICAgICAgaWYgKHN0YXRlLndiaXRzID09PSAwKSB7XG4gICAgICAgICAgc3RhdGUud2JpdHMgPSBsZW47XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAobGVuID4gc3RhdGUud2JpdHMpIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIHdpbmRvdyBzaXplJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmRtYXggPSAxIDw8IGxlbjtcbiAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgIHpsaWIgaGVhZGVyIG9rXFxuXCIpKTtcbiAgICAgICAgc3RybS5hZGxlciA9IHN0YXRlLmNoZWNrID0gMS8qYWRsZXIzMigwTCwgWl9OVUxMLCAwKSovO1xuICAgICAgICBzdGF0ZS5tb2RlID0gaG9sZCAmIDB4MjAwID8gRElDVElEIDogVFlQRTtcbiAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAvLz09PS8vXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBGTEFHUzpcbiAgICAgICAgLy89PT0gTkVFREJJVFMoMTYpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDE2KSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLmZsYWdzID0gaG9sZDtcbiAgICAgICAgaWYgKChzdGF0ZS5mbGFncyAmIDB4ZmYpICE9PSBaX0RFRkxBVEVEKSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAndW5rbm93biBjb21wcmVzc2lvbiBtZXRob2QnO1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXRlLmZsYWdzICYgMHhlMDAwKSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAndW5rbm93biBoZWFkZXIgZmxhZ3Mgc2V0JztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC50ZXh0ID0gKChob2xkID4+IDgpICYgMSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHN0YXRlLmZsYWdzICYgMHgwMjAwKSB7XG4gICAgICAgICAgLy89PT0gQ1JDMihzdGF0ZS5jaGVjaywgaG9sZCk7XG4gICAgICAgICAgaGJ1ZlswXSA9IGhvbGQgJiAweGZmO1xuICAgICAgICAgIGhidWZbMV0gPSAoaG9sZCA+Pj4gOCkgJiAweGZmO1xuICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzIoc3RhdGUuY2hlY2ssIGhidWYsIDIsIDApO1xuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgfVxuICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICBob2xkID0gMDtcbiAgICAgICAgYml0cyA9IDA7XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RhdGUubW9kZSA9IFRJTUU7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgVElNRTpcbiAgICAgICAgLy89PT0gTkVFREJJVFMoMzIpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDMyKSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC50aW1lID0gaG9sZDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUuZmxhZ3MgJiAweDAyMDApIHtcbiAgICAgICAgICAvLz09PSBDUkM0KHN0YXRlLmNoZWNrLCBob2xkKVxuICAgICAgICAgIGhidWZbMF0gPSBob2xkICYgMHhmZjtcbiAgICAgICAgICBoYnVmWzFdID0gKGhvbGQgPj4+IDgpICYgMHhmZjtcbiAgICAgICAgICBoYnVmWzJdID0gKGhvbGQgPj4+IDE2KSAmIDB4ZmY7XG4gICAgICAgICAgaGJ1ZlszXSA9IChob2xkID4+PiAyNCkgJiAweGZmO1xuICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzIoc3RhdGUuY2hlY2ssIGhidWYsIDQsIDApO1xuICAgICAgICAgIC8vPT09XG4gICAgICAgIH1cbiAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLm1vZGUgPSBPUztcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBPUzpcbiAgICAgICAgLy89PT0gTkVFREJJVFMoMTYpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDE2KSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC54ZmxhZ3MgPSAoaG9sZCAmIDB4ZmYpO1xuICAgICAgICAgIHN0YXRlLmhlYWQub3MgPSAoaG9sZCA+PiA4KTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUuZmxhZ3MgJiAweDAyMDApIHtcbiAgICAgICAgICAvLz09PSBDUkMyKHN0YXRlLmNoZWNrLCBob2xkKTtcbiAgICAgICAgICBoYnVmWzBdID0gaG9sZCAmIDB4ZmY7XG4gICAgICAgICAgaGJ1ZlsxXSA9IChob2xkID4+PiA4KSAmIDB4ZmY7XG4gICAgICAgICAgc3RhdGUuY2hlY2sgPSBjcmMzMihzdGF0ZS5jaGVjaywgaGJ1ZiwgMiwgMCk7XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICB9XG4gICAgICAgIC8vPT09IElOSVRCSVRTKCk7XG4gICAgICAgIGhvbGQgPSAwO1xuICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgLy89PT0vL1xuICAgICAgICBzdGF0ZS5tb2RlID0gRVhMRU47XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgRVhMRU46XG4gICAgICAgIGlmIChzdGF0ZS5mbGFncyAmIDB4MDQwMCkge1xuICAgICAgICAgIC8vPT09IE5FRURCSVRTKDE2KTsgKi9cbiAgICAgICAgICB3aGlsZSAoYml0cyA8IDE2KSB7XG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgc3RhdGUubGVuZ3RoID0gaG9sZDtcbiAgICAgICAgICBpZiAoc3RhdGUuaGVhZCkge1xuICAgICAgICAgICAgc3RhdGUuaGVhZC5leHRyYV9sZW4gPSBob2xkO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc3RhdGUuZmxhZ3MgJiAweDAyMDApIHtcbiAgICAgICAgICAgIC8vPT09IENSQzIoc3RhdGUuY2hlY2ssIGhvbGQpO1xuICAgICAgICAgICAgaGJ1ZlswXSA9IGhvbGQgJiAweGZmO1xuICAgICAgICAgICAgaGJ1ZlsxXSA9IChob2xkID4+PiA4KSAmIDB4ZmY7XG4gICAgICAgICAgICBzdGF0ZS5jaGVjayA9IGNyYzMyKHN0YXRlLmNoZWNrLCBoYnVmLCAyLCAwKTtcbiAgICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgICBob2xkID0gMDtcbiAgICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAoc3RhdGUuaGVhZCkge1xuICAgICAgICAgIHN0YXRlLmhlYWQuZXh0cmEgPSBudWxsLypaX05VTEwqLztcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5tb2RlID0gRVhUUkE7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgRVhUUkE6XG4gICAgICAgIGlmIChzdGF0ZS5mbGFncyAmIDB4MDQwMCkge1xuICAgICAgICAgIGNvcHkgPSBzdGF0ZS5sZW5ndGg7XG4gICAgICAgICAgaWYgKGNvcHkgPiBoYXZlKSB7IGNvcHkgPSBoYXZlOyB9XG4gICAgICAgICAgaWYgKGNvcHkpIHtcbiAgICAgICAgICAgIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgICAgIGxlbiA9IHN0YXRlLmhlYWQuZXh0cmFfbGVuIC0gc3RhdGUubGVuZ3RoO1xuICAgICAgICAgICAgICBpZiAoIXN0YXRlLmhlYWQuZXh0cmEpIHtcbiAgICAgICAgICAgICAgICAvLyBVc2UgdW50eXBlZCBhcnJheSBmb3IgbW9yZSBjb252ZW5pZW50IHByb2Nlc3NpbmcgbGF0ZXJcbiAgICAgICAgICAgICAgICBzdGF0ZS5oZWFkLmV4dHJhID0gbmV3IEFycmF5KHN0YXRlLmhlYWQuZXh0cmFfbGVuKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB1dGlscy5hcnJheVNldChcbiAgICAgICAgICAgICAgICBzdGF0ZS5oZWFkLmV4dHJhLFxuICAgICAgICAgICAgICAgIGlucHV0LFxuICAgICAgICAgICAgICAgIG5leHQsXG4gICAgICAgICAgICAgICAgLy8gZXh0cmEgZmllbGQgaXMgbGltaXRlZCB0byA2NTUzNiBieXRlc1xuICAgICAgICAgICAgICAgIC8vIC0gbm8gbmVlZCBmb3IgYWRkaXRpb25hbCBzaXplIGNoZWNrXG4gICAgICAgICAgICAgICAgY29weSxcbiAgICAgICAgICAgICAgICAvKmxlbiArIGNvcHkgPiBzdGF0ZS5oZWFkLmV4dHJhX21heCAtIGxlbiA/IHN0YXRlLmhlYWQuZXh0cmFfbWF4IDogY29weSwqL1xuICAgICAgICAgICAgICAgIGxlblxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAvL3ptZW1jcHkoc3RhdGUuaGVhZC5leHRyYSArIGxlbiwgbmV4dCxcbiAgICAgICAgICAgICAgLy8gICAgICAgIGxlbiArIGNvcHkgPiBzdGF0ZS5oZWFkLmV4dHJhX21heCA/XG4gICAgICAgICAgICAgIC8vICAgICAgICBzdGF0ZS5oZWFkLmV4dHJhX21heCAtIGxlbiA6IGNvcHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0YXRlLmZsYWdzICYgMHgwMjAwKSB7XG4gICAgICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzIoc3RhdGUuY2hlY2ssIGlucHV0LCBjb3B5LCBuZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGhhdmUgLT0gY29weTtcbiAgICAgICAgICAgIG5leHQgKz0gY29weTtcbiAgICAgICAgICAgIHN0YXRlLmxlbmd0aCAtPSBjb3B5O1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoc3RhdGUubGVuZ3RoKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmxlbmd0aCA9IDA7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBOQU1FO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIE5BTUU6XG4gICAgICAgIGlmIChzdGF0ZS5mbGFncyAmIDB4MDgwMCkge1xuICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgIGNvcHkgPSAwO1xuICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgIC8vIFRPRE86IDIgb3IgMSBieXRlcz9cbiAgICAgICAgICAgIGxlbiA9IGlucHV0W25leHQgKyBjb3B5KytdO1xuICAgICAgICAgICAgLyogdXNlIGNvbnN0YW50IGxpbWl0IGJlY2F1c2UgaW4ganMgd2Ugc2hvdWxkIG5vdCBwcmVhbGxvY2F0ZSBtZW1vcnkgKi9cbiAgICAgICAgICAgIGlmIChzdGF0ZS5oZWFkICYmIGxlbiAmJlxuICAgICAgICAgICAgICAgIChzdGF0ZS5sZW5ndGggPCA2NTUzNiAvKnN0YXRlLmhlYWQubmFtZV9tYXgqLykpIHtcbiAgICAgICAgICAgICAgc3RhdGUuaGVhZC5uYW1lICs9IFN0cmluZy5mcm9tQ2hhckNvZGUobGVuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IHdoaWxlIChsZW4gJiYgY29weSA8IGhhdmUpO1xuXG4gICAgICAgICAgaWYgKHN0YXRlLmZsYWdzICYgMHgwMjAwKSB7XG4gICAgICAgICAgICBzdGF0ZS5jaGVjayA9IGNyYzMyKHN0YXRlLmNoZWNrLCBpbnB1dCwgY29weSwgbmV4dCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGhhdmUgLT0gY29weTtcbiAgICAgICAgICBuZXh0ICs9IGNvcHk7XG4gICAgICAgICAgaWYgKGxlbikgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChzdGF0ZS5oZWFkKSB7XG4gICAgICAgICAgc3RhdGUuaGVhZC5uYW1lID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5sZW5ndGggPSAwO1xuICAgICAgICBzdGF0ZS5tb2RlID0gQ09NTUVOVDtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBDT01NRU5UOlxuICAgICAgICBpZiAoc3RhdGUuZmxhZ3MgJiAweDEwMDApIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBjb3B5ID0gMDtcbiAgICAgICAgICBkbyB7XG4gICAgICAgICAgICBsZW4gPSBpbnB1dFtuZXh0ICsgY29weSsrXTtcbiAgICAgICAgICAgIC8qIHVzZSBjb25zdGFudCBsaW1pdCBiZWNhdXNlIGluIGpzIHdlIHNob3VsZCBub3QgcHJlYWxsb2NhdGUgbWVtb3J5ICovXG4gICAgICAgICAgICBpZiAoc3RhdGUuaGVhZCAmJiBsZW4gJiZcbiAgICAgICAgICAgICAgICAoc3RhdGUubGVuZ3RoIDwgNjU1MzYgLypzdGF0ZS5oZWFkLmNvbW1fbWF4Ki8pKSB7XG4gICAgICAgICAgICAgIHN0YXRlLmhlYWQuY29tbWVudCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGxlbik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSB3aGlsZSAobGVuICYmIGNvcHkgPCBoYXZlKTtcbiAgICAgICAgICBpZiAoc3RhdGUuZmxhZ3MgJiAweDAyMDApIHtcbiAgICAgICAgICAgIHN0YXRlLmNoZWNrID0gY3JjMzIoc3RhdGUuY2hlY2ssIGlucHV0LCBjb3B5LCBuZXh0KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaGF2ZSAtPSBjb3B5O1xuICAgICAgICAgIG5leHQgKz0gY29weTtcbiAgICAgICAgICBpZiAobGVuKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHN0YXRlLmhlYWQpIHtcbiAgICAgICAgICBzdGF0ZS5oZWFkLmNvbW1lbnQgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLm1vZGUgPSBIQ1JDO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIEhDUkM6XG4gICAgICAgIGlmIChzdGF0ZS5mbGFncyAmIDB4MDIwMCkge1xuICAgICAgICAgIC8vPT09IE5FRURCSVRTKDE2KTsgKi9cbiAgICAgICAgICB3aGlsZSAoYml0cyA8IDE2KSB7XG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgaWYgKGhvbGQgIT09IChzdGF0ZS5jaGVjayAmIDB4ZmZmZikpIHtcbiAgICAgICAgICAgIHN0cm0ubXNnID0gJ2hlYWRlciBjcmMgbWlzbWF0Y2gnO1xuICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICAgIGhvbGQgPSAwO1xuICAgICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgfVxuICAgICAgICBpZiAoc3RhdGUuaGVhZCkge1xuICAgICAgICAgIHN0YXRlLmhlYWQuaGNyYyA9ICgoc3RhdGUuZmxhZ3MgPj4gOSkgJiAxKTtcbiAgICAgICAgICBzdGF0ZS5oZWFkLmRvbmUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICAgIHN0cm0uYWRsZXIgPSBzdGF0ZS5jaGVjayA9IDA7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBUWVBFO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRElDVElEOlxuICAgICAgICAvLz09PSBORUVEQklUUygzMik7ICovXG4gICAgICAgIHdoaWxlIChiaXRzIDwgMzIpIHtcbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICB9XG4gICAgICAgIC8vPT09Ly9cbiAgICAgICAgc3RybS5hZGxlciA9IHN0YXRlLmNoZWNrID0genN3YXAzMihob2xkKTtcbiAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLm1vZGUgPSBESUNUO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIERJQ1Q6XG4gICAgICAgIGlmIChzdGF0ZS5oYXZlZGljdCA9PT0gMCkge1xuICAgICAgICAgIC8vLS0tIFJFU1RPUkUoKSAtLS1cbiAgICAgICAgICBzdHJtLm5leHRfb3V0ID0gcHV0O1xuICAgICAgICAgIHN0cm0uYXZhaWxfb3V0ID0gbGVmdDtcbiAgICAgICAgICBzdHJtLm5leHRfaW4gPSBuZXh0O1xuICAgICAgICAgIHN0cm0uYXZhaWxfaW4gPSBoYXZlO1xuICAgICAgICAgIHN0YXRlLmhvbGQgPSBob2xkO1xuICAgICAgICAgIHN0YXRlLmJpdHMgPSBiaXRzO1xuICAgICAgICAgIC8vLS0tXG4gICAgICAgICAgcmV0dXJuIFpfTkVFRF9ESUNUO1xuICAgICAgICB9XG4gICAgICAgIHN0cm0uYWRsZXIgPSBzdGF0ZS5jaGVjayA9IDEvKmFkbGVyMzIoMEwsIFpfTlVMTCwgMCkqLztcbiAgICAgICAgc3RhdGUubW9kZSA9IFRZUEU7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgVFlQRTpcbiAgICAgICAgaWYgKGZsdXNoID09PSBaX0JMT0NLIHx8IGZsdXNoID09PSBaX1RSRUVTKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIFRZUEVETzpcbiAgICAgICAgaWYgKHN0YXRlLmxhc3QpIHtcbiAgICAgICAgICAvLy0tLSBCWVRFQklUUygpIC0tLS8vXG4gICAgICAgICAgaG9sZCA+Pj49IGJpdHMgJiA3O1xuICAgICAgICAgIGJpdHMgLT0gYml0cyAmIDc7XG4gICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBDSEVDSztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvLz09PSBORUVEQklUUygzKTsgKi9cbiAgICAgICAgd2hpbGUgKGJpdHMgPCAzKSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLmxhc3QgPSAoaG9sZCAmIDB4MDEpLypCSVRTKDEpKi87XG4gICAgICAgIC8vLS0tIERST1BCSVRTKDEpIC0tLS8vXG4gICAgICAgIGhvbGQgPj4+PSAxO1xuICAgICAgICBiaXRzIC09IDE7XG4gICAgICAgIC8vLS0tLy9cblxuICAgICAgICBzd2l0Y2ggKChob2xkICYgMHgwMykvKkJJVFMoMikqLykge1xuICAgICAgICAgIGNhc2UgMDogICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIHN0b3JlZCBibG9jayAqL1xuICAgICAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgc3RvcmVkIGJsb2NrJXNcXG5cIixcbiAgICAgICAgICAgIC8vICAgICAgICBzdGF0ZS5sYXN0ID8gXCIgKGxhc3QpXCIgOiBcIlwiKSk7XG4gICAgICAgICAgICBzdGF0ZS5tb2RlID0gU1RPUkVEO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxOiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLyogZml4ZWQgYmxvY2sgKi9cbiAgICAgICAgICAgIGZpeGVkdGFibGVzKHN0YXRlKTtcbiAgICAgICAgICAgIC8vVHJhY2V2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgIGZpeGVkIGNvZGVzIGJsb2NrJXNcXG5cIixcbiAgICAgICAgICAgIC8vICAgICAgICBzdGF0ZS5sYXN0ID8gXCIgKGxhc3QpXCIgOiBcIlwiKSk7XG4gICAgICAgICAgICBzdGF0ZS5tb2RlID0gTEVOXzsgICAgICAgICAgICAgLyogZGVjb2RlIGNvZGVzICovXG4gICAgICAgICAgICBpZiAoZmx1c2ggPT09IFpfVFJFRVMpIHtcbiAgICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoMikgLS0tLy9cbiAgICAgICAgICAgICAgaG9sZCA+Pj49IDI7XG4gICAgICAgICAgICAgIGJpdHMgLT0gMjtcbiAgICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgICBicmVhayBpbmZfbGVhdmU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDI6ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvKiBkeW5hbWljIGJsb2NrICovXG4gICAgICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgICBkeW5hbWljIGNvZGVzIGJsb2NrJXNcXG5cIixcbiAgICAgICAgICAgIC8vICAgICAgICBzdGF0ZS5sYXN0ID8gXCIgKGxhc3QpXCIgOiBcIlwiKSk7XG4gICAgICAgICAgICBzdGF0ZS5tb2RlID0gVEFCTEU7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGJsb2NrIHR5cGUnO1xuICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgfVxuICAgICAgICAvLy0tLSBEUk9QQklUUygyKSAtLS0vL1xuICAgICAgICBob2xkID4+Pj0gMjtcbiAgICAgICAgYml0cyAtPSAyO1xuICAgICAgICAvLy0tLS8vXG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBTVE9SRUQ6XG4gICAgICAgIC8vLS0tIEJZVEVCSVRTKCkgLS0tLy8gLyogZ28gdG8gYnl0ZSBib3VuZGFyeSAqL1xuICAgICAgICBob2xkID4+Pj0gYml0cyAmIDc7XG4gICAgICAgIGJpdHMgLT0gYml0cyAmIDc7XG4gICAgICAgIC8vLS0tLy9cbiAgICAgICAgLy89PT0gTkVFREJJVFMoMzIpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDMyKSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIGlmICgoaG9sZCAmIDB4ZmZmZikgIT09ICgoaG9sZCA+Pj4gMTYpIF4gMHhmZmZmKSkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgc3RvcmVkIGJsb2NrIGxlbmd0aHMnO1xuICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUubGVuZ3RoID0gaG9sZCAmIDB4ZmZmZjtcbiAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICBzdG9yZWQgbGVuZ3RoICV1XFxuXCIsXG4gICAgICAgIC8vICAgICAgICBzdGF0ZS5sZW5ndGgpKTtcbiAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgaG9sZCA9IDA7XG4gICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLm1vZGUgPSBDT1BZXztcbiAgICAgICAgaWYgKGZsdXNoID09PSBaX1RSRUVTKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIENPUFlfOlxuICAgICAgICBzdGF0ZS5tb2RlID0gQ09QWTtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBDT1BZOlxuICAgICAgICBjb3B5ID0gc3RhdGUubGVuZ3RoO1xuICAgICAgICBpZiAoY29weSkge1xuICAgICAgICAgIGlmIChjb3B5ID4gaGF2ZSkgeyBjb3B5ID0gaGF2ZTsgfVxuICAgICAgICAgIGlmIChjb3B5ID4gbGVmdCkgeyBjb3B5ID0gbGVmdDsgfVxuICAgICAgICAgIGlmIChjb3B5ID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgIC8vLS0tIHptZW1jcHkocHV0LCBuZXh0LCBjb3B5KTsgLS0tXG4gICAgICAgICAgdXRpbHMuYXJyYXlTZXQob3V0cHV0LCBpbnB1dCwgbmV4dCwgY29weSwgcHV0KTtcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgaGF2ZSAtPSBjb3B5O1xuICAgICAgICAgIG5leHQgKz0gY29weTtcbiAgICAgICAgICBsZWZ0IC09IGNvcHk7XG4gICAgICAgICAgcHV0ICs9IGNvcHk7XG4gICAgICAgICAgc3RhdGUubGVuZ3RoIC09IGNvcHk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICBzdG9yZWQgZW5kXFxuXCIpKTtcbiAgICAgICAgc3RhdGUubW9kZSA9IFRZUEU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBUQUJMRTpcbiAgICAgICAgLy89PT0gTkVFREJJVFMoMTQpOyAqL1xuICAgICAgICB3aGlsZSAoYml0cyA8IDE0KSB7XG4gICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgfVxuICAgICAgICAvLz09PS8vXG4gICAgICAgIHN0YXRlLm5sZW4gPSAoaG9sZCAmIDB4MWYpLypCSVRTKDUpKi8gKyAyNTc7XG4gICAgICAgIC8vLS0tIERST1BCSVRTKDUpIC0tLS8vXG4gICAgICAgIGhvbGQgPj4+PSA1O1xuICAgICAgICBiaXRzIC09IDU7XG4gICAgICAgIC8vLS0tLy9cbiAgICAgICAgc3RhdGUubmRpc3QgPSAoaG9sZCAmIDB4MWYpLypCSVRTKDUpKi8gKyAxO1xuICAgICAgICAvLy0tLSBEUk9QQklUUyg1KSAtLS0vL1xuICAgICAgICBob2xkID4+Pj0gNTtcbiAgICAgICAgYml0cyAtPSA1O1xuICAgICAgICAvLy0tLS8vXG4gICAgICAgIHN0YXRlLm5jb2RlID0gKGhvbGQgJiAweDBmKS8qQklUUyg0KSovICsgNDtcbiAgICAgICAgLy8tLS0gRFJPUEJJVFMoNCkgLS0tLy9cbiAgICAgICAgaG9sZCA+Pj49IDQ7XG4gICAgICAgIGJpdHMgLT0gNDtcbiAgICAgICAgLy8tLS0vL1xuLy8jaWZuZGVmIFBLWklQX0JVR19XT1JLQVJPVU5EXG4gICAgICAgIGlmIChzdGF0ZS5ubGVuID4gMjg2IHx8IHN0YXRlLm5kaXN0ID4gMzApIHtcbiAgICAgICAgICBzdHJtLm1zZyA9ICd0b28gbWFueSBsZW5ndGggb3IgZGlzdGFuY2Ugc3ltYm9scyc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuLy8jZW5kaWZcbiAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICB0YWJsZSBzaXplcyBva1xcblwiKSk7XG4gICAgICAgIHN0YXRlLmhhdmUgPSAwO1xuICAgICAgICBzdGF0ZS5tb2RlID0gTEVOTEVOUztcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBMRU5MRU5TOlxuICAgICAgICB3aGlsZSAoc3RhdGUuaGF2ZSA8IHN0YXRlLm5jb2RlKSB7XG4gICAgICAgICAgLy89PT0gTkVFREJJVFMoMyk7XG4gICAgICAgICAgd2hpbGUgKGJpdHMgPCAzKSB7XG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgc3RhdGUubGVuc1tvcmRlcltzdGF0ZS5oYXZlKytdXSA9IChob2xkICYgMHgwNyk7Ly9CSVRTKDMpO1xuICAgICAgICAgIC8vLS0tIERST1BCSVRTKDMpIC0tLS8vXG4gICAgICAgICAgaG9sZCA+Pj49IDM7XG4gICAgICAgICAgYml0cyAtPSAzO1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgfVxuICAgICAgICB3aGlsZSAoc3RhdGUuaGF2ZSA8IDE5KSB7XG4gICAgICAgICAgc3RhdGUubGVuc1tvcmRlcltzdGF0ZS5oYXZlKytdXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2UgaGF2ZSBzZXBhcmF0ZSB0YWJsZXMgJiBubyBwb2ludGVycy4gMiBjb21tZW50ZWQgbGluZXMgYmVsb3cgbm90IG5lZWRlZC5cbiAgICAgICAgLy9zdGF0ZS5uZXh0ID0gc3RhdGUuY29kZXM7XG4gICAgICAgIC8vc3RhdGUubGVuY29kZSA9IHN0YXRlLm5leHQ7XG4gICAgICAgIC8vIFN3aXRjaCB0byB1c2UgZHluYW1pYyB0YWJsZVxuICAgICAgICBzdGF0ZS5sZW5jb2RlID0gc3RhdGUubGVuZHluO1xuICAgICAgICBzdGF0ZS5sZW5iaXRzID0gNztcblxuICAgICAgICBvcHRzID0geyBiaXRzOiBzdGF0ZS5sZW5iaXRzIH07XG4gICAgICAgIHJldCA9IGluZmxhdGVfdGFibGUoQ09ERVMsIHN0YXRlLmxlbnMsIDAsIDE5LCBzdGF0ZS5sZW5jb2RlLCAwLCBzdGF0ZS53b3JrLCBvcHRzKTtcbiAgICAgICAgc3RhdGUubGVuYml0cyA9IG9wdHMuYml0cztcblxuICAgICAgICBpZiAocmV0KSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBjb2RlIGxlbmd0aHMgc2V0JztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIC8vVHJhY2V2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgY29kZSBsZW5ndGhzIG9rXFxuXCIpKTtcbiAgICAgICAgc3RhdGUuaGF2ZSA9IDA7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBDT0RFTEVOUztcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBDT0RFTEVOUzpcbiAgICAgICAgd2hpbGUgKHN0YXRlLmhhdmUgPCBzdGF0ZS5ubGVuICsgc3RhdGUubmRpc3QpIHtcbiAgICAgICAgICBmb3IgKDs7KSB7XG4gICAgICAgICAgICBoZXJlID0gc3RhdGUubGVuY29kZVtob2xkICYgKCgxIDw8IHN0YXRlLmxlbmJpdHMpIC0gMSldOy8qQklUUyhzdGF0ZS5sZW5iaXRzKSovXG4gICAgICAgICAgICBoZXJlX2JpdHMgPSBoZXJlID4+PiAyNDtcbiAgICAgICAgICAgIGhlcmVfb3AgPSAoaGVyZSA+Pj4gMTYpICYgMHhmZjtcbiAgICAgICAgICAgIGhlcmVfdmFsID0gaGVyZSAmIDB4ZmZmZjtcblxuICAgICAgICAgICAgaWYgKChoZXJlX2JpdHMpIDw9IGJpdHMpIHsgYnJlYWs7IH1cbiAgICAgICAgICAgIC8vLS0tIFBVTExCWVRFKCkgLS0tLy9cbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChoZXJlX3ZhbCA8IDE2KSB7XG4gICAgICAgICAgICAvLy0tLSBEUk9QQklUUyhoZXJlLmJpdHMpIC0tLS8vXG4gICAgICAgICAgICBob2xkID4+Pj0gaGVyZV9iaXRzO1xuICAgICAgICAgICAgYml0cyAtPSBoZXJlX2JpdHM7XG4gICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgICBzdGF0ZS5sZW5zW3N0YXRlLmhhdmUrK10gPSBoZXJlX3ZhbDtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICBpZiAoaGVyZV92YWwgPT09IDE2KSB7XG4gICAgICAgICAgICAgIC8vPT09IE5FRURCSVRTKGhlcmUuYml0cyArIDIpO1xuICAgICAgICAgICAgICBuID0gaGVyZV9iaXRzICsgMjtcbiAgICAgICAgICAgICAgd2hpbGUgKGJpdHMgPCBuKSB7XG4gICAgICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgICAgIC8vLS0tIERST1BCSVRTKGhlcmUuYml0cykgLS0tLy9cbiAgICAgICAgICAgICAgaG9sZCA+Pj49IGhlcmVfYml0cztcbiAgICAgICAgICAgICAgYml0cyAtPSBoZXJlX2JpdHM7XG4gICAgICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICAgICAgaWYgKHN0YXRlLmhhdmUgPT09IDApIHtcbiAgICAgICAgICAgICAgICBzdHJtLm1zZyA9ICdpbnZhbGlkIGJpdCBsZW5ndGggcmVwZWF0JztcbiAgICAgICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGxlbiA9IHN0YXRlLmxlbnNbc3RhdGUuaGF2ZSAtIDFdO1xuICAgICAgICAgICAgICBjb3B5ID0gMyArIChob2xkICYgMHgwMyk7Ly9CSVRTKDIpO1xuICAgICAgICAgICAgICAvLy0tLSBEUk9QQklUUygyKSAtLS0vL1xuICAgICAgICAgICAgICBob2xkID4+Pj0gMjtcbiAgICAgICAgICAgICAgYml0cyAtPSAyO1xuICAgICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChoZXJlX3ZhbCA9PT0gMTcpIHtcbiAgICAgICAgICAgICAgLy89PT0gTkVFREJJVFMoaGVyZS5iaXRzICsgMyk7XG4gICAgICAgICAgICAgIG4gPSBoZXJlX2JpdHMgKyAzO1xuICAgICAgICAgICAgICB3aGlsZSAoYml0cyA8IG4pIHtcbiAgICAgICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoaGVyZS5iaXRzKSAtLS0vL1xuICAgICAgICAgICAgICBob2xkID4+Pj0gaGVyZV9iaXRzO1xuICAgICAgICAgICAgICBiaXRzIC09IGhlcmVfYml0cztcbiAgICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgICAgICBjb3B5ID0gMyArIChob2xkICYgMHgwNyk7Ly9CSVRTKDMpO1xuICAgICAgICAgICAgICAvLy0tLSBEUk9QQklUUygzKSAtLS0vL1xuICAgICAgICAgICAgICBob2xkID4+Pj0gMztcbiAgICAgICAgICAgICAgYml0cyAtPSAzO1xuICAgICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgLy89PT0gTkVFREJJVFMoaGVyZS5iaXRzICsgNyk7XG4gICAgICAgICAgICAgIG4gPSBoZXJlX2JpdHMgKyA3O1xuICAgICAgICAgICAgICB3aGlsZSAoYml0cyA8IG4pIHtcbiAgICAgICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoaGVyZS5iaXRzKSAtLS0vL1xuICAgICAgICAgICAgICBob2xkID4+Pj0gaGVyZV9iaXRzO1xuICAgICAgICAgICAgICBiaXRzIC09IGhlcmVfYml0cztcbiAgICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgICBsZW4gPSAwO1xuICAgICAgICAgICAgICBjb3B5ID0gMTEgKyAoaG9sZCAmIDB4N2YpOy8vQklUUyg3KTtcbiAgICAgICAgICAgICAgLy8tLS0gRFJPUEJJVFMoNykgLS0tLy9cbiAgICAgICAgICAgICAgaG9sZCA+Pj49IDc7XG4gICAgICAgICAgICAgIGJpdHMgLT0gNztcbiAgICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHN0YXRlLmhhdmUgKyBjb3B5ID4gc3RhdGUubmxlbiArIHN0YXRlLm5kaXN0KSB7XG4gICAgICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgYml0IGxlbmd0aCByZXBlYXQnO1xuICAgICAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdoaWxlIChjb3B5LS0pIHtcbiAgICAgICAgICAgICAgc3RhdGUubGVuc1tzdGF0ZS5oYXZlKytdID0gbGVuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qIGhhbmRsZSBlcnJvciBicmVha3MgaW4gd2hpbGUgKi9cbiAgICAgICAgaWYgKHN0YXRlLm1vZGUgPT09IEJBRCkgeyBicmVhazsgfVxuXG4gICAgICAgIC8qIGNoZWNrIGZvciBlbmQtb2YtYmxvY2sgY29kZSAoYmV0dGVyIGhhdmUgb25lKSAqL1xuICAgICAgICBpZiAoc3RhdGUubGVuc1syNTZdID09PSAwKSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBjb2RlIC0tIG1pc3NpbmcgZW5kLW9mLWJsb2NrJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgLyogYnVpbGQgY29kZSB0YWJsZXMgLS0gbm90ZTogZG8gbm90IGNoYW5nZSB0aGUgbGVuYml0cyBvciBkaXN0Yml0c1xuICAgICAgICAgICB2YWx1ZXMgaGVyZSAoOSBhbmQgNikgd2l0aG91dCByZWFkaW5nIHRoZSBjb21tZW50cyBpbiBpbmZ0cmVlcy5oXG4gICAgICAgICAgIGNvbmNlcm5pbmcgdGhlIEVOT1VHSCBjb25zdGFudHMsIHdoaWNoIGRlcGVuZCBvbiB0aG9zZSB2YWx1ZXMgKi9cbiAgICAgICAgc3RhdGUubGVuYml0cyA9IDk7XG5cbiAgICAgICAgb3B0cyA9IHsgYml0czogc3RhdGUubGVuYml0cyB9O1xuICAgICAgICByZXQgPSBpbmZsYXRlX3RhYmxlKExFTlMsIHN0YXRlLmxlbnMsIDAsIHN0YXRlLm5sZW4sIHN0YXRlLmxlbmNvZGUsIDAsIHN0YXRlLndvcmssIG9wdHMpO1xuICAgICAgICAvLyBXZSBoYXZlIHNlcGFyYXRlIHRhYmxlcyAmIG5vIHBvaW50ZXJzLiAyIGNvbW1lbnRlZCBsaW5lcyBiZWxvdyBub3QgbmVlZGVkLlxuICAgICAgICAvLyBzdGF0ZS5uZXh0X2luZGV4ID0gb3B0cy50YWJsZV9pbmRleDtcbiAgICAgICAgc3RhdGUubGVuYml0cyA9IG9wdHMuYml0cztcbiAgICAgICAgLy8gc3RhdGUubGVuY29kZSA9IHN0YXRlLm5leHQ7XG5cbiAgICAgICAgaWYgKHJldCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgbGl0ZXJhbC9sZW5ndGhzIHNldCc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHN0YXRlLmRpc3RiaXRzID0gNjtcbiAgICAgICAgLy9zdGF0ZS5kaXN0Y29kZS5jb3B5KHN0YXRlLmNvZGVzKTtcbiAgICAgICAgLy8gU3dpdGNoIHRvIHVzZSBkeW5hbWljIHRhYmxlXG4gICAgICAgIHN0YXRlLmRpc3Rjb2RlID0gc3RhdGUuZGlzdGR5bjtcbiAgICAgICAgb3B0cyA9IHsgYml0czogc3RhdGUuZGlzdGJpdHMgfTtcbiAgICAgICAgcmV0ID0gaW5mbGF0ZV90YWJsZShESVNUUywgc3RhdGUubGVucywgc3RhdGUubmxlbiwgc3RhdGUubmRpc3QsIHN0YXRlLmRpc3Rjb2RlLCAwLCBzdGF0ZS53b3JrLCBvcHRzKTtcbiAgICAgICAgLy8gV2UgaGF2ZSBzZXBhcmF0ZSB0YWJsZXMgJiBubyBwb2ludGVycy4gMiBjb21tZW50ZWQgbGluZXMgYmVsb3cgbm90IG5lZWRlZC5cbiAgICAgICAgLy8gc3RhdGUubmV4dF9pbmRleCA9IG9wdHMudGFibGVfaW5kZXg7XG4gICAgICAgIHN0YXRlLmRpc3RiaXRzID0gb3B0cy5iaXRzO1xuICAgICAgICAvLyBzdGF0ZS5kaXN0Y29kZSA9IHN0YXRlLm5leHQ7XG5cbiAgICAgICAgaWYgKHJldCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgZGlzdGFuY2VzIHNldCc7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICAvL1RyYWNldigoc3RkZXJyLCAnaW5mbGF0ZTogICAgICAgY29kZXMgb2tcXG4nKSk7XG4gICAgICAgIHN0YXRlLm1vZGUgPSBMRU5fO1xuICAgICAgICBpZiAoZmx1c2ggPT09IFpfVFJFRVMpIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgTEVOXzpcbiAgICAgICAgc3RhdGUubW9kZSA9IExFTjtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBMRU46XG4gICAgICAgIGlmIChoYXZlID49IDYgJiYgbGVmdCA+PSAyNTgpIHtcbiAgICAgICAgICAvLy0tLSBSRVNUT1JFKCkgLS0tXG4gICAgICAgICAgc3RybS5uZXh0X291dCA9IHB1dDtcbiAgICAgICAgICBzdHJtLmF2YWlsX291dCA9IGxlZnQ7XG4gICAgICAgICAgc3RybS5uZXh0X2luID0gbmV4dDtcbiAgICAgICAgICBzdHJtLmF2YWlsX2luID0gaGF2ZTtcbiAgICAgICAgICBzdGF0ZS5ob2xkID0gaG9sZDtcbiAgICAgICAgICBzdGF0ZS5iaXRzID0gYml0cztcbiAgICAgICAgICAvLy0tLVxuICAgICAgICAgIGluZmxhdGVfZmFzdChzdHJtLCBfb3V0KTtcbiAgICAgICAgICAvLy0tLSBMT0FEKCkgLS0tXG4gICAgICAgICAgcHV0ID0gc3RybS5uZXh0X291dDtcbiAgICAgICAgICBvdXRwdXQgPSBzdHJtLm91dHB1dDtcbiAgICAgICAgICBsZWZ0ID0gc3RybS5hdmFpbF9vdXQ7XG4gICAgICAgICAgbmV4dCA9IHN0cm0ubmV4dF9pbjtcbiAgICAgICAgICBpbnB1dCA9IHN0cm0uaW5wdXQ7XG4gICAgICAgICAgaGF2ZSA9IHN0cm0uYXZhaWxfaW47XG4gICAgICAgICAgaG9sZCA9IHN0YXRlLmhvbGQ7XG4gICAgICAgICAgYml0cyA9IHN0YXRlLmJpdHM7XG4gICAgICAgICAgLy8tLS1cblxuICAgICAgICAgIGlmIChzdGF0ZS5tb2RlID09PSBUWVBFKSB7XG4gICAgICAgICAgICBzdGF0ZS5iYWNrID0gLTE7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmJhY2sgPSAwO1xuICAgICAgICBmb3IgKDs7KSB7XG4gICAgICAgICAgaGVyZSA9IHN0YXRlLmxlbmNvZGVbaG9sZCAmICgoMSA8PCBzdGF0ZS5sZW5iaXRzKSAtIDEpXTsgIC8qQklUUyhzdGF0ZS5sZW5iaXRzKSovXG4gICAgICAgICAgaGVyZV9iaXRzID0gaGVyZSA+Pj4gMjQ7XG4gICAgICAgICAgaGVyZV9vcCA9IChoZXJlID4+PiAxNikgJiAweGZmO1xuICAgICAgICAgIGhlcmVfdmFsID0gaGVyZSAmIDB4ZmZmZjtcblxuICAgICAgICAgIGlmIChoZXJlX2JpdHMgPD0gYml0cykgeyBicmVhazsgfVxuICAgICAgICAgIC8vLS0tIFBVTExCWVRFKCkgLS0tLy9cbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgfVxuICAgICAgICBpZiAoaGVyZV9vcCAmJiAoaGVyZV9vcCAmIDB4ZjApID09PSAwKSB7XG4gICAgICAgICAgbGFzdF9iaXRzID0gaGVyZV9iaXRzO1xuICAgICAgICAgIGxhc3Rfb3AgPSBoZXJlX29wO1xuICAgICAgICAgIGxhc3RfdmFsID0gaGVyZV92YWw7XG4gICAgICAgICAgZm9yICg7Oykge1xuICAgICAgICAgICAgaGVyZSA9IHN0YXRlLmxlbmNvZGVbbGFzdF92YWwgK1xuICAgICAgICAgICAgICAgICAgICAoKGhvbGQgJiAoKDEgPDwgKGxhc3RfYml0cyArIGxhc3Rfb3ApKSAtIDEpKS8qQklUUyhsYXN0LmJpdHMgKyBsYXN0Lm9wKSovID4+IGxhc3RfYml0cyldO1xuICAgICAgICAgICAgaGVyZV9iaXRzID0gaGVyZSA+Pj4gMjQ7XG4gICAgICAgICAgICBoZXJlX29wID0gKGhlcmUgPj4+IDE2KSAmIDB4ZmY7XG4gICAgICAgICAgICBoZXJlX3ZhbCA9IGhlcmUgJiAweGZmZmY7XG5cbiAgICAgICAgICAgIGlmICgobGFzdF9iaXRzICsgaGVyZV9iaXRzKSA8PSBiaXRzKSB7IGJyZWFrOyB9XG4gICAgICAgICAgICAvLy0tLSBQVUxMQllURSgpIC0tLS8vXG4gICAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICAgIGhhdmUtLTtcbiAgICAgICAgICAgIGhvbGQgKz0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgICAgLy8tLS0vL1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLy0tLSBEUk9QQklUUyhsYXN0LmJpdHMpIC0tLS8vXG4gICAgICAgICAgaG9sZCA+Pj49IGxhc3RfYml0cztcbiAgICAgICAgICBiaXRzIC09IGxhc3RfYml0cztcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgc3RhdGUuYmFjayArPSBsYXN0X2JpdHM7XG4gICAgICAgIH1cbiAgICAgICAgLy8tLS0gRFJPUEJJVFMoaGVyZS5iaXRzKSAtLS0vL1xuICAgICAgICBob2xkID4+Pj0gaGVyZV9iaXRzO1xuICAgICAgICBiaXRzIC09IGhlcmVfYml0cztcbiAgICAgICAgLy8tLS0vL1xuICAgICAgICBzdGF0ZS5iYWNrICs9IGhlcmVfYml0cztcbiAgICAgICAgc3RhdGUubGVuZ3RoID0gaGVyZV92YWw7XG4gICAgICAgIGlmIChoZXJlX29wID09PSAwKSB7XG4gICAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIGhlcmUudmFsID49IDB4MjAgJiYgaGVyZS52YWwgPCAweDdmID9cbiAgICAgICAgICAvLyAgICAgICAgXCJpbmZsYXRlOiAgICAgICAgIGxpdGVyYWwgJyVjJ1xcblwiIDpcbiAgICAgICAgICAvLyAgICAgICAgXCJpbmZsYXRlOiAgICAgICAgIGxpdGVyYWwgMHglMDJ4XFxuXCIsIGhlcmUudmFsKSk7XG4gICAgICAgICAgc3RhdGUubW9kZSA9IExJVDtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGVyZV9vcCAmIDMyKSB7XG4gICAgICAgICAgLy9UcmFjZXZ2KChzdGRlcnIsIFwiaW5mbGF0ZTogICAgICAgICBlbmQgb2YgYmxvY2tcXG5cIikpO1xuICAgICAgICAgIHN0YXRlLmJhY2sgPSAtMTtcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gVFlQRTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBpZiAoaGVyZV9vcCAmIDY0KSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBsaXRlcmFsL2xlbmd0aCBjb2RlJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLmV4dHJhID0gaGVyZV9vcCAmIDE1O1xuICAgICAgICBzdGF0ZS5tb2RlID0gTEVORVhUO1xuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBjYXNlIExFTkVYVDpcbiAgICAgICAgaWYgKHN0YXRlLmV4dHJhKSB7XG4gICAgICAgICAgLy89PT0gTkVFREJJVFMoc3RhdGUuZXh0cmEpO1xuICAgICAgICAgIG4gPSBzdGF0ZS5leHRyYTtcbiAgICAgICAgICB3aGlsZSAoYml0cyA8IG4pIHtcbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICBzdGF0ZS5sZW5ndGggKz0gaG9sZCAmICgoMSA8PCBzdGF0ZS5leHRyYSkgLSAxKS8qQklUUyhzdGF0ZS5leHRyYSkqLztcbiAgICAgICAgICAvLy0tLSBEUk9QQklUUyhzdGF0ZS5leHRyYSkgLS0tLy9cbiAgICAgICAgICBob2xkID4+Pj0gc3RhdGUuZXh0cmE7XG4gICAgICAgICAgYml0cyAtPSBzdGF0ZS5leHRyYTtcbiAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgc3RhdGUuYmFjayArPSBzdGF0ZS5leHRyYTtcbiAgICAgICAgfVxuICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICAgIGxlbmd0aCAldVxcblwiLCBzdGF0ZS5sZW5ndGgpKTtcbiAgICAgICAgc3RhdGUud2FzID0gc3RhdGUubGVuZ3RoO1xuICAgICAgICBzdGF0ZS5tb2RlID0gRElTVDtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBESVNUOlxuICAgICAgICBmb3IgKDs7KSB7XG4gICAgICAgICAgaGVyZSA9IHN0YXRlLmRpc3Rjb2RlW2hvbGQgJiAoKDEgPDwgc3RhdGUuZGlzdGJpdHMpIC0gMSldOy8qQklUUyhzdGF0ZS5kaXN0Yml0cykqL1xuICAgICAgICAgIGhlcmVfYml0cyA9IGhlcmUgPj4+IDI0O1xuICAgICAgICAgIGhlcmVfb3AgPSAoaGVyZSA+Pj4gMTYpICYgMHhmZjtcbiAgICAgICAgICBoZXJlX3ZhbCA9IGhlcmUgJiAweGZmZmY7XG5cbiAgICAgICAgICBpZiAoKGhlcmVfYml0cykgPD0gYml0cykgeyBicmVhazsgfVxuICAgICAgICAgIC8vLS0tIFBVTExCWVRFKCkgLS0tLy9cbiAgICAgICAgICBpZiAoaGF2ZSA9PT0gMCkgeyBicmVhayBpbmZfbGVhdmU7IH1cbiAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgfVxuICAgICAgICBpZiAoKGhlcmVfb3AgJiAweGYwKSA9PT0gMCkge1xuICAgICAgICAgIGxhc3RfYml0cyA9IGhlcmVfYml0cztcbiAgICAgICAgICBsYXN0X29wID0gaGVyZV9vcDtcbiAgICAgICAgICBsYXN0X3ZhbCA9IGhlcmVfdmFsO1xuICAgICAgICAgIGZvciAoOzspIHtcbiAgICAgICAgICAgIGhlcmUgPSBzdGF0ZS5kaXN0Y29kZVtsYXN0X3ZhbCArXG4gICAgICAgICAgICAgICAgICAgICgoaG9sZCAmICgoMSA8PCAobGFzdF9iaXRzICsgbGFzdF9vcCkpIC0gMSkpLypCSVRTKGxhc3QuYml0cyArIGxhc3Qub3ApKi8gPj4gbGFzdF9iaXRzKV07XG4gICAgICAgICAgICBoZXJlX2JpdHMgPSBoZXJlID4+PiAyNDtcbiAgICAgICAgICAgIGhlcmVfb3AgPSAoaGVyZSA+Pj4gMTYpICYgMHhmZjtcbiAgICAgICAgICAgIGhlcmVfdmFsID0gaGVyZSAmIDB4ZmZmZjtcblxuICAgICAgICAgICAgaWYgKChsYXN0X2JpdHMgKyBoZXJlX2JpdHMpIDw9IGJpdHMpIHsgYnJlYWs7IH1cbiAgICAgICAgICAgIC8vLS0tIFBVTExCWVRFKCkgLS0tLy9cbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgICAvLy0tLS8vXG4gICAgICAgICAgfVxuICAgICAgICAgIC8vLS0tIERST1BCSVRTKGxhc3QuYml0cykgLS0tLy9cbiAgICAgICAgICBob2xkID4+Pj0gbGFzdF9iaXRzO1xuICAgICAgICAgIGJpdHMgLT0gbGFzdF9iaXRzO1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICBzdGF0ZS5iYWNrICs9IGxhc3RfYml0cztcbiAgICAgICAgfVxuICAgICAgICAvLy0tLSBEUk9QQklUUyhoZXJlLmJpdHMpIC0tLS8vXG4gICAgICAgIGhvbGQgPj4+PSBoZXJlX2JpdHM7XG4gICAgICAgIGJpdHMgLT0gaGVyZV9iaXRzO1xuICAgICAgICAvLy0tLS8vXG4gICAgICAgIHN0YXRlLmJhY2sgKz0gaGVyZV9iaXRzO1xuICAgICAgICBpZiAoaGVyZV9vcCAmIDY0KSB7XG4gICAgICAgICAgc3RybS5tc2cgPSAnaW52YWxpZCBkaXN0YW5jZSBjb2RlJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLm9mZnNldCA9IGhlcmVfdmFsO1xuICAgICAgICBzdGF0ZS5leHRyYSA9IChoZXJlX29wKSAmIDE1O1xuICAgICAgICBzdGF0ZS5tb2RlID0gRElTVEVYVDtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBESVNURVhUOlxuICAgICAgICBpZiAoc3RhdGUuZXh0cmEpIHtcbiAgICAgICAgICAvLz09PSBORUVEQklUUyhzdGF0ZS5leHRyYSk7XG4gICAgICAgICAgbiA9IHN0YXRlLmV4dHJhO1xuICAgICAgICAgIHdoaWxlIChiaXRzIDwgbikge1xuICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICBob2xkICs9IGlucHV0W25leHQrK10gPDwgYml0cztcbiAgICAgICAgICAgIGJpdHMgKz0gODtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0vL1xuICAgICAgICAgIHN0YXRlLm9mZnNldCArPSBob2xkICYgKCgxIDw8IHN0YXRlLmV4dHJhKSAtIDEpLypCSVRTKHN0YXRlLmV4dHJhKSovO1xuICAgICAgICAgIC8vLS0tIERST1BCSVRTKHN0YXRlLmV4dHJhKSAtLS0vL1xuICAgICAgICAgIGhvbGQgPj4+PSBzdGF0ZS5leHRyYTtcbiAgICAgICAgICBiaXRzIC09IHN0YXRlLmV4dHJhO1xuICAgICAgICAgIC8vLS0tLy9cbiAgICAgICAgICBzdGF0ZS5iYWNrICs9IHN0YXRlLmV4dHJhO1xuICAgICAgICB9XG4vLyNpZmRlZiBJTkZMQVRFX1NUUklDVFxuICAgICAgICBpZiAoc3RhdGUub2Zmc2V0ID4gc3RhdGUuZG1heCkge1xuICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgZGlzdGFuY2UgdG9vIGZhciBiYWNrJztcbiAgICAgICAgICBzdGF0ZS5tb2RlID0gQkFEO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4vLyNlbmRpZlxuICAgICAgICAvL1RyYWNldnYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgICAgICAgIGRpc3RhbmNlICV1XFxuXCIsIHN0YXRlLm9mZnNldCkpO1xuICAgICAgICBzdGF0ZS5tb2RlID0gTUFUQ0g7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgTUFUQ0g6XG4gICAgICAgIGlmIChsZWZ0ID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICBjb3B5ID0gX291dCAtIGxlZnQ7XG4gICAgICAgIGlmIChzdGF0ZS5vZmZzZXQgPiBjb3B5KSB7ICAgICAgICAgLyogY29weSBmcm9tIHdpbmRvdyAqL1xuICAgICAgICAgIGNvcHkgPSBzdGF0ZS5vZmZzZXQgLSBjb3B5O1xuICAgICAgICAgIGlmIChjb3B5ID4gc3RhdGUud2hhdmUpIHtcbiAgICAgICAgICAgIGlmIChzdGF0ZS5zYW5lKSB7XG4gICAgICAgICAgICAgIHN0cm0ubXNnID0gJ2ludmFsaWQgZGlzdGFuY2UgdG9vIGZhciBiYWNrJztcbiAgICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4vLyAoISkgVGhpcyBibG9jayBpcyBkaXNhYmxlZCBpbiB6bGliIGRlZmF1bHRzLFxuLy8gZG9uJ3QgZW5hYmxlIGl0IGZvciBiaW5hcnkgY29tcGF0aWJpbGl0eVxuLy8jaWZkZWYgSU5GTEFURV9BTExPV19JTlZBTElEX0RJU1RBTkNFX1RPT0ZBUl9BUlJSXG4vLyAgICAgICAgICBUcmFjZSgoc3RkZXJyLCBcImluZmxhdGUuYyB0b28gZmFyXFxuXCIpKTtcbi8vICAgICAgICAgIGNvcHkgLT0gc3RhdGUud2hhdmU7XG4vLyAgICAgICAgICBpZiAoY29weSA+IHN0YXRlLmxlbmd0aCkgeyBjb3B5ID0gc3RhdGUubGVuZ3RoOyB9XG4vLyAgICAgICAgICBpZiAoY29weSA+IGxlZnQpIHsgY29weSA9IGxlZnQ7IH1cbi8vICAgICAgICAgIGxlZnQgLT0gY29weTtcbi8vICAgICAgICAgIHN0YXRlLmxlbmd0aCAtPSBjb3B5O1xuLy8gICAgICAgICAgZG8ge1xuLy8gICAgICAgICAgICBvdXRwdXRbcHV0KytdID0gMDtcbi8vICAgICAgICAgIH0gd2hpbGUgKC0tY29weSk7XG4vLyAgICAgICAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKSB7IHN0YXRlLm1vZGUgPSBMRU47IH1cbi8vICAgICAgICAgIGJyZWFrO1xuLy8jZW5kaWZcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNvcHkgPiBzdGF0ZS53bmV4dCkge1xuICAgICAgICAgICAgY29weSAtPSBzdGF0ZS53bmV4dDtcbiAgICAgICAgICAgIGZyb20gPSBzdGF0ZS53c2l6ZSAtIGNvcHk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgZnJvbSA9IHN0YXRlLnduZXh0IC0gY29weTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGNvcHkgPiBzdGF0ZS5sZW5ndGgpIHsgY29weSA9IHN0YXRlLmxlbmd0aDsgfVxuICAgICAgICAgIGZyb21fc291cmNlID0gc3RhdGUud2luZG93O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgeyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8qIGNvcHkgZnJvbSBvdXRwdXQgKi9cbiAgICAgICAgICBmcm9tX3NvdXJjZSA9IG91dHB1dDtcbiAgICAgICAgICBmcm9tID0gcHV0IC0gc3RhdGUub2Zmc2V0O1xuICAgICAgICAgIGNvcHkgPSBzdGF0ZS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvcHkgPiBsZWZ0KSB7IGNvcHkgPSBsZWZ0OyB9XG4gICAgICAgIGxlZnQgLT0gY29weTtcbiAgICAgICAgc3RhdGUubGVuZ3RoIC09IGNvcHk7XG4gICAgICAgIGRvIHtcbiAgICAgICAgICBvdXRwdXRbcHV0KytdID0gZnJvbV9zb3VyY2VbZnJvbSsrXTtcbiAgICAgICAgfSB3aGlsZSAoLS1jb3B5KTtcbiAgICAgICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCkgeyBzdGF0ZS5tb2RlID0gTEVOOyB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBMSVQ6XG4gICAgICAgIGlmIChsZWZ0ID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICBvdXRwdXRbcHV0KytdID0gc3RhdGUubGVuZ3RoO1xuICAgICAgICBsZWZ0LS07XG4gICAgICAgIHN0YXRlLm1vZGUgPSBMRU47XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBDSEVDSzpcbiAgICAgICAgaWYgKHN0YXRlLndyYXApIHtcbiAgICAgICAgICAvLz09PSBORUVEQklUUygzMik7XG4gICAgICAgICAgd2hpbGUgKGJpdHMgPCAzMikge1xuICAgICAgICAgICAgaWYgKGhhdmUgPT09IDApIHsgYnJlYWsgaW5mX2xlYXZlOyB9XG4gICAgICAgICAgICBoYXZlLS07XG4gICAgICAgICAgICAvLyBVc2UgJ3wnIGluc3RlYWQgb2YgJysnIHRvIG1ha2Ugc3VyZSB0aGF0IHJlc3VsdCBpcyBzaWduZWRcbiAgICAgICAgICAgIGhvbGQgfD0gaW5wdXRbbmV4dCsrXSA8PCBiaXRzO1xuICAgICAgICAgICAgYml0cyArPSA4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgX291dCAtPSBsZWZ0O1xuICAgICAgICAgIHN0cm0udG90YWxfb3V0ICs9IF9vdXQ7XG4gICAgICAgICAgc3RhdGUudG90YWwgKz0gX291dDtcbiAgICAgICAgICBpZiAoX291dCkge1xuICAgICAgICAgICAgc3RybS5hZGxlciA9IHN0YXRlLmNoZWNrID1cbiAgICAgICAgICAgICAgICAvKlVQREFURShzdGF0ZS5jaGVjaywgcHV0IC0gX291dCwgX291dCk7Ki9cbiAgICAgICAgICAgICAgICAoc3RhdGUuZmxhZ3MgPyBjcmMzMihzdGF0ZS5jaGVjaywgb3V0cHV0LCBfb3V0LCBwdXQgLSBfb3V0KSA6IGFkbGVyMzIoc3RhdGUuY2hlY2ssIG91dHB1dCwgX291dCwgcHV0IC0gX291dCkpO1xuXG4gICAgICAgICAgfVxuICAgICAgICAgIF9vdXQgPSBsZWZ0O1xuICAgICAgICAgIC8vIE5COiBjcmMzMiBzdG9yZWQgYXMgc2lnbmVkIDMyLWJpdCBpbnQsIHpzd2FwMzIgcmV0dXJucyBzaWduZWQgdG9vXG4gICAgICAgICAgaWYgKChzdGF0ZS5mbGFncyA/IGhvbGQgOiB6c3dhcDMyKGhvbGQpKSAhPT0gc3RhdGUuY2hlY2spIHtcbiAgICAgICAgICAgIHN0cm0ubXNnID0gJ2luY29ycmVjdCBkYXRhIGNoZWNrJztcbiAgICAgICAgICAgIHN0YXRlLm1vZGUgPSBCQUQ7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgLy89PT0gSU5JVEJJVFMoKTtcbiAgICAgICAgICBob2xkID0gMDtcbiAgICAgICAgICBiaXRzID0gMDtcbiAgICAgICAgICAvLz09PS8vXG4gICAgICAgICAgLy9UcmFjZXYoKHN0ZGVyciwgXCJpbmZsYXRlOiAgIGNoZWNrIG1hdGNoZXMgdHJhaWxlclxcblwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUubW9kZSA9IExFTkdUSDtcbiAgICAgICAgLyogZmFsbHMgdGhyb3VnaCAqL1xuICAgICAgY2FzZSBMRU5HVEg6XG4gICAgICAgIGlmIChzdGF0ZS53cmFwICYmIHN0YXRlLmZsYWdzKSB7XG4gICAgICAgICAgLy89PT0gTkVFREJJVFMoMzIpO1xuICAgICAgICAgIHdoaWxlIChiaXRzIDwgMzIpIHtcbiAgICAgICAgICAgIGlmIChoYXZlID09PSAwKSB7IGJyZWFrIGluZl9sZWF2ZTsgfVxuICAgICAgICAgICAgaGF2ZS0tO1xuICAgICAgICAgICAgaG9sZCArPSBpbnB1dFtuZXh0KytdIDw8IGJpdHM7XG4gICAgICAgICAgICBiaXRzICs9IDg7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICBpZiAoaG9sZCAhPT0gKHN0YXRlLnRvdGFsICYgMHhmZmZmZmZmZikpIHtcbiAgICAgICAgICAgIHN0cm0ubXNnID0gJ2luY29ycmVjdCBsZW5ndGggY2hlY2snO1xuICAgICAgICAgICAgc3RhdGUubW9kZSA9IEJBRDtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLz09PSBJTklUQklUUygpO1xuICAgICAgICAgIGhvbGQgPSAwO1xuICAgICAgICAgIGJpdHMgPSAwO1xuICAgICAgICAgIC8vPT09Ly9cbiAgICAgICAgICAvL1RyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgbGVuZ3RoIG1hdGNoZXMgdHJhaWxlclxcblwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgc3RhdGUubW9kZSA9IERPTkU7XG4gICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgIGNhc2UgRE9ORTpcbiAgICAgICAgcmV0ID0gWl9TVFJFQU1fRU5EO1xuICAgICAgICBicmVhayBpbmZfbGVhdmU7XG4gICAgICBjYXNlIEJBRDpcbiAgICAgICAgcmV0ID0gWl9EQVRBX0VSUk9SO1xuICAgICAgICBicmVhayBpbmZfbGVhdmU7XG4gICAgICBjYXNlIE1FTTpcbiAgICAgICAgcmV0dXJuIFpfTUVNX0VSUk9SO1xuICAgICAgY2FzZSBTWU5DOlxuICAgICAgICAvKiBmYWxscyB0aHJvdWdoICovXG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gICAgfVxuICB9XG5cbiAgLy8gaW5mX2xlYXZlIDwtIGhlcmUgaXMgcmVhbCBwbGFjZSBmb3IgXCJnb3RvIGluZl9sZWF2ZVwiLCBlbXVsYXRlZCB2aWEgXCJicmVhayBpbmZfbGVhdmVcIlxuXG4gIC8qXG4gICAgIFJldHVybiBmcm9tIGluZmxhdGUoKSwgdXBkYXRpbmcgdGhlIHRvdGFsIGNvdW50cyBhbmQgdGhlIGNoZWNrIHZhbHVlLlxuICAgICBJZiB0aGVyZSB3YXMgbm8gcHJvZ3Jlc3MgZHVyaW5nIHRoZSBpbmZsYXRlKCkgY2FsbCwgcmV0dXJuIGEgYnVmZmVyXG4gICAgIGVycm9yLiAgQ2FsbCB1cGRhdGV3aW5kb3coKSB0byBjcmVhdGUgYW5kL29yIHVwZGF0ZSB0aGUgd2luZG93IHN0YXRlLlxuICAgICBOb3RlOiBhIG1lbW9yeSBlcnJvciBmcm9tIGluZmxhdGUoKSBpcyBub24tcmVjb3ZlcmFibGUuXG4gICAqL1xuXG4gIC8vLS0tIFJFU1RPUkUoKSAtLS1cbiAgc3RybS5uZXh0X291dCA9IHB1dDtcbiAgc3RybS5hdmFpbF9vdXQgPSBsZWZ0O1xuICBzdHJtLm5leHRfaW4gPSBuZXh0O1xuICBzdHJtLmF2YWlsX2luID0gaGF2ZTtcbiAgc3RhdGUuaG9sZCA9IGhvbGQ7XG4gIHN0YXRlLmJpdHMgPSBiaXRzO1xuICAvLy0tLVxuXG4gIGlmIChzdGF0ZS53c2l6ZSB8fCAoX291dCAhPT0gc3RybS5hdmFpbF9vdXQgJiYgc3RhdGUubW9kZSA8IEJBRCAmJlxuICAgICAgICAgICAgICAgICAgICAgIChzdGF0ZS5tb2RlIDwgQ0hFQ0sgfHwgZmx1c2ggIT09IFpfRklOSVNIKSkpIHtcbiAgICBpZiAodXBkYXRld2luZG93KHN0cm0sIHN0cm0ub3V0cHV0LCBzdHJtLm5leHRfb3V0LCBfb3V0IC0gc3RybS5hdmFpbF9vdXQpKSB7XG4gICAgICBzdGF0ZS5tb2RlID0gTUVNO1xuICAgICAgcmV0dXJuIFpfTUVNX0VSUk9SO1xuICAgIH1cbiAgfVxuICBfaW4gLT0gc3RybS5hdmFpbF9pbjtcbiAgX291dCAtPSBzdHJtLmF2YWlsX291dDtcbiAgc3RybS50b3RhbF9pbiArPSBfaW47XG4gIHN0cm0udG90YWxfb3V0ICs9IF9vdXQ7XG4gIHN0YXRlLnRvdGFsICs9IF9vdXQ7XG4gIGlmIChzdGF0ZS53cmFwICYmIF9vdXQpIHtcbiAgICBzdHJtLmFkbGVyID0gc3RhdGUuY2hlY2sgPSAvKlVQREFURShzdGF0ZS5jaGVjaywgc3RybS5uZXh0X291dCAtIF9vdXQsIF9vdXQpOyovXG4gICAgICAoc3RhdGUuZmxhZ3MgPyBjcmMzMihzdGF0ZS5jaGVjaywgb3V0cHV0LCBfb3V0LCBzdHJtLm5leHRfb3V0IC0gX291dCkgOiBhZGxlcjMyKHN0YXRlLmNoZWNrLCBvdXRwdXQsIF9vdXQsIHN0cm0ubmV4dF9vdXQgLSBfb3V0KSk7XG4gIH1cbiAgc3RybS5kYXRhX3R5cGUgPSBzdGF0ZS5iaXRzICsgKHN0YXRlLmxhc3QgPyA2NCA6IDApICtcbiAgICAgICAgICAgICAgICAgICAgKHN0YXRlLm1vZGUgPT09IFRZUEUgPyAxMjggOiAwKSArXG4gICAgICAgICAgICAgICAgICAgIChzdGF0ZS5tb2RlID09PSBMRU5fIHx8IHN0YXRlLm1vZGUgPT09IENPUFlfID8gMjU2IDogMCk7XG4gIGlmICgoKF9pbiA9PT0gMCAmJiBfb3V0ID09PSAwKSB8fCBmbHVzaCA9PT0gWl9GSU5JU0gpICYmIHJldCA9PT0gWl9PSykge1xuICAgIHJldCA9IFpfQlVGX0VSUk9SO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGluZmxhdGVFbmQoc3RybSkge1xuXG4gIGlmICghc3RybSB8fCAhc3RybS5zdGF0ZSAvKnx8IHN0cm0tPnpmcmVlID09IChmcmVlX2Z1bmMpMCovKSB7XG4gICAgcmV0dXJuIFpfU1RSRUFNX0VSUk9SO1xuICB9XG5cbiAgdmFyIHN0YXRlID0gc3RybS5zdGF0ZTtcbiAgaWYgKHN0YXRlLndpbmRvdykge1xuICAgIHN0YXRlLndpbmRvdyA9IG51bGw7XG4gIH1cbiAgc3RybS5zdGF0ZSA9IG51bGw7XG4gIHJldHVybiBaX09LO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlR2V0SGVhZGVyKHN0cm0sIGhlYWQpIHtcbiAgdmFyIHN0YXRlO1xuXG4gIC8qIGNoZWNrIHN0YXRlICovXG4gIGlmICghc3RybSB8fCAhc3RybS5zdGF0ZSkgeyByZXR1cm4gWl9TVFJFQU1fRVJST1I7IH1cbiAgc3RhdGUgPSBzdHJtLnN0YXRlO1xuICBpZiAoKHN0YXRlLndyYXAgJiAyKSA9PT0gMCkgeyByZXR1cm4gWl9TVFJFQU1fRVJST1I7IH1cblxuICAvKiBzYXZlIGhlYWRlciBzdHJ1Y3R1cmUgKi9cbiAgc3RhdGUuaGVhZCA9IGhlYWQ7XG4gIGhlYWQuZG9uZSA9IGZhbHNlO1xuICByZXR1cm4gWl9PSztcbn1cblxuZnVuY3Rpb24gaW5mbGF0ZVNldERpY3Rpb25hcnkoc3RybSwgZGljdGlvbmFyeSkge1xuICB2YXIgZGljdExlbmd0aCA9IGRpY3Rpb25hcnkubGVuZ3RoO1xuXG4gIHZhciBzdGF0ZTtcbiAgdmFyIGRpY3RpZDtcbiAgdmFyIHJldDtcblxuICAvKiBjaGVjayBzdGF0ZSAqL1xuICBpZiAoIXN0cm0gLyogPT0gWl9OVUxMICovIHx8ICFzdHJtLnN0YXRlIC8qID09IFpfTlVMTCAqLykgeyByZXR1cm4gWl9TVFJFQU1fRVJST1I7IH1cbiAgc3RhdGUgPSBzdHJtLnN0YXRlO1xuXG4gIGlmIChzdGF0ZS53cmFwICE9PSAwICYmIHN0YXRlLm1vZGUgIT09IERJQ1QpIHtcbiAgICByZXR1cm4gWl9TVFJFQU1fRVJST1I7XG4gIH1cblxuICAvKiBjaGVjayBmb3IgY29ycmVjdCBkaWN0aW9uYXJ5IGlkZW50aWZpZXIgKi9cbiAgaWYgKHN0YXRlLm1vZGUgPT09IERJQ1QpIHtcbiAgICBkaWN0aWQgPSAxOyAvKiBhZGxlcjMyKDAsIG51bGwsIDApKi9cbiAgICAvKiBkaWN0aWQgPSBhZGxlcjMyKGRpY3RpZCwgZGljdGlvbmFyeSwgZGljdExlbmd0aCk7ICovXG4gICAgZGljdGlkID0gYWRsZXIzMihkaWN0aWQsIGRpY3Rpb25hcnksIGRpY3RMZW5ndGgsIDApO1xuICAgIGlmIChkaWN0aWQgIT09IHN0YXRlLmNoZWNrKSB7XG4gICAgICByZXR1cm4gWl9EQVRBX0VSUk9SO1xuICAgIH1cbiAgfVxuICAvKiBjb3B5IGRpY3Rpb25hcnkgdG8gd2luZG93IHVzaW5nIHVwZGF0ZXdpbmRvdygpLCB3aGljaCB3aWxsIGFtZW5kIHRoZVxuICAgZXhpc3RpbmcgZGljdGlvbmFyeSBpZiBhcHByb3ByaWF0ZSAqL1xuICByZXQgPSB1cGRhdGV3aW5kb3coc3RybSwgZGljdGlvbmFyeSwgZGljdExlbmd0aCwgZGljdExlbmd0aCk7XG4gIGlmIChyZXQpIHtcbiAgICBzdGF0ZS5tb2RlID0gTUVNO1xuICAgIHJldHVybiBaX01FTV9FUlJPUjtcbiAgfVxuICBzdGF0ZS5oYXZlZGljdCA9IDE7XG4gIC8vIFRyYWNldigoc3RkZXJyLCBcImluZmxhdGU6ICAgZGljdGlvbmFyeSBzZXRcXG5cIikpO1xuICByZXR1cm4gWl9PSztcbn1cblxuZXhwb3J0cy5pbmZsYXRlUmVzZXQgPSBpbmZsYXRlUmVzZXQ7XG5leHBvcnRzLmluZmxhdGVSZXNldDIgPSBpbmZsYXRlUmVzZXQyO1xuZXhwb3J0cy5pbmZsYXRlUmVzZXRLZWVwID0gaW5mbGF0ZVJlc2V0S2VlcDtcbmV4cG9ydHMuaW5mbGF0ZUluaXQgPSBpbmZsYXRlSW5pdDtcbmV4cG9ydHMuaW5mbGF0ZUluaXQyID0gaW5mbGF0ZUluaXQyO1xuZXhwb3J0cy5pbmZsYXRlID0gaW5mbGF0ZTtcbmV4cG9ydHMuaW5mbGF0ZUVuZCA9IGluZmxhdGVFbmQ7XG5leHBvcnRzLmluZmxhdGVHZXRIZWFkZXIgPSBpbmZsYXRlR2V0SGVhZGVyO1xuZXhwb3J0cy5pbmZsYXRlU2V0RGljdGlvbmFyeSA9IGluZmxhdGVTZXREaWN0aW9uYXJ5O1xuZXhwb3J0cy5pbmZsYXRlSW5mbyA9ICdwYWtvIGluZmxhdGUgKGZyb20gTm9kZWNhIHByb2plY3QpJztcblxuLyogTm90IGltcGxlbWVudGVkXG5leHBvcnRzLmluZmxhdGVDb3B5ID0gaW5mbGF0ZUNvcHk7XG5leHBvcnRzLmluZmxhdGVHZXREaWN0aW9uYXJ5ID0gaW5mbGF0ZUdldERpY3Rpb25hcnk7XG5leHBvcnRzLmluZmxhdGVNYXJrID0gaW5mbGF0ZU1hcms7XG5leHBvcnRzLmluZmxhdGVQcmltZSA9IGluZmxhdGVQcmltZTtcbmV4cG9ydHMuaW5mbGF0ZVN5bmMgPSBpbmZsYXRlU3luYztcbmV4cG9ydHMuaW5mbGF0ZVN5bmNQb2ludCA9IGluZmxhdGVTeW5jUG9pbnQ7XG5leHBvcnRzLmluZmxhdGVVbmRlcm1pbmUgPSBpbmZsYXRlVW5kZXJtaW5lO1xuKi9cbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscy9jb21tb24nKTtcblxudmFyIE1BWEJJVFMgPSAxNTtcbnZhciBFTk9VR0hfTEVOUyA9IDg1MjtcbnZhciBFTk9VR0hfRElTVFMgPSA1OTI7XG4vL3ZhciBFTk9VR0ggPSAoRU5PVUdIX0xFTlMrRU5PVUdIX0RJU1RTKTtcblxudmFyIENPREVTID0gMDtcbnZhciBMRU5TID0gMTtcbnZhciBESVNUUyA9IDI7XG5cbnZhciBsYmFzZSA9IFsgLyogTGVuZ3RoIGNvZGVzIDI1Ny4uMjg1IGJhc2UgKi9cbiAgMywgNCwgNSwgNiwgNywgOCwgOSwgMTAsIDExLCAxMywgMTUsIDE3LCAxOSwgMjMsIDI3LCAzMSxcbiAgMzUsIDQzLCA1MSwgNTksIDY3LCA4MywgOTksIDExNSwgMTMxLCAxNjMsIDE5NSwgMjI3LCAyNTgsIDAsIDBcbl07XG5cbnZhciBsZXh0ID0gWyAvKiBMZW5ndGggY29kZXMgMjU3Li4yODUgZXh0cmEgKi9cbiAgMTYsIDE2LCAxNiwgMTYsIDE2LCAxNiwgMTYsIDE2LCAxNywgMTcsIDE3LCAxNywgMTgsIDE4LCAxOCwgMTgsXG4gIDE5LCAxOSwgMTksIDE5LCAyMCwgMjAsIDIwLCAyMCwgMjEsIDIxLCAyMSwgMjEsIDE2LCA3MiwgNzhcbl07XG5cbnZhciBkYmFzZSA9IFsgLyogRGlzdGFuY2UgY29kZXMgMC4uMjkgYmFzZSAqL1xuICAxLCAyLCAzLCA0LCA1LCA3LCA5LCAxMywgMTcsIDI1LCAzMywgNDksIDY1LCA5NywgMTI5LCAxOTMsXG4gIDI1NywgMzg1LCA1MTMsIDc2OSwgMTAyNSwgMTUzNywgMjA0OSwgMzA3MywgNDA5NywgNjE0NSxcbiAgODE5MywgMTIyODksIDE2Mzg1LCAyNDU3NywgMCwgMFxuXTtcblxudmFyIGRleHQgPSBbIC8qIERpc3RhbmNlIGNvZGVzIDAuLjI5IGV4dHJhICovXG4gIDE2LCAxNiwgMTYsIDE2LCAxNywgMTcsIDE4LCAxOCwgMTksIDE5LCAyMCwgMjAsIDIxLCAyMSwgMjIsIDIyLFxuICAyMywgMjMsIDI0LCAyNCwgMjUsIDI1LCAyNiwgMjYsIDI3LCAyNyxcbiAgMjgsIDI4LCAyOSwgMjksIDY0LCA2NFxuXTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmZsYXRlX3RhYmxlKHR5cGUsIGxlbnMsIGxlbnNfaW5kZXgsIGNvZGVzLCB0YWJsZSwgdGFibGVfaW5kZXgsIHdvcmssIG9wdHMpXG57XG4gIHZhciBiaXRzID0gb3B0cy5iaXRzO1xuICAgICAgLy9oZXJlID0gb3B0cy5oZXJlOyAvKiB0YWJsZSBlbnRyeSBmb3IgZHVwbGljYXRpb24gKi9cblxuICB2YXIgbGVuID0gMDsgICAgICAgICAgICAgICAvKiBhIGNvZGUncyBsZW5ndGggaW4gYml0cyAqL1xuICB2YXIgc3ltID0gMDsgICAgICAgICAgICAgICAvKiBpbmRleCBvZiBjb2RlIHN5bWJvbHMgKi9cbiAgdmFyIG1pbiA9IDAsIG1heCA9IDA7ICAgICAgICAgIC8qIG1pbmltdW0gYW5kIG1heGltdW0gY29kZSBsZW5ndGhzICovXG4gIHZhciByb290ID0gMDsgICAgICAgICAgICAgIC8qIG51bWJlciBvZiBpbmRleCBiaXRzIGZvciByb290IHRhYmxlICovXG4gIHZhciBjdXJyID0gMDsgICAgICAgICAgICAgIC8qIG51bWJlciBvZiBpbmRleCBiaXRzIGZvciBjdXJyZW50IHRhYmxlICovXG4gIHZhciBkcm9wID0gMDsgICAgICAgICAgICAgIC8qIGNvZGUgYml0cyB0byBkcm9wIGZvciBzdWItdGFibGUgKi9cbiAgdmFyIGxlZnQgPSAwOyAgICAgICAgICAgICAgICAgICAvKiBudW1iZXIgb2YgcHJlZml4IGNvZGVzIGF2YWlsYWJsZSAqL1xuICB2YXIgdXNlZCA9IDA7ICAgICAgICAgICAgICAvKiBjb2RlIGVudHJpZXMgaW4gdGFibGUgdXNlZCAqL1xuICB2YXIgaHVmZiA9IDA7ICAgICAgICAgICAgICAvKiBIdWZmbWFuIGNvZGUgKi9cbiAgdmFyIGluY3I7ICAgICAgICAgICAgICAvKiBmb3IgaW5jcmVtZW50aW5nIGNvZGUsIGluZGV4ICovXG4gIHZhciBmaWxsOyAgICAgICAgICAgICAgLyogaW5kZXggZm9yIHJlcGxpY2F0aW5nIGVudHJpZXMgKi9cbiAgdmFyIGxvdzsgICAgICAgICAgICAgICAvKiBsb3cgYml0cyBmb3IgY3VycmVudCByb290IGVudHJ5ICovXG4gIHZhciBtYXNrOyAgICAgICAgICAgICAgLyogbWFzayBmb3IgbG93IHJvb3QgYml0cyAqL1xuICB2YXIgbmV4dDsgICAgICAgICAgICAgLyogbmV4dCBhdmFpbGFibGUgc3BhY2UgaW4gdGFibGUgKi9cbiAgdmFyIGJhc2UgPSBudWxsOyAgICAgLyogYmFzZSB2YWx1ZSB0YWJsZSB0byB1c2UgKi9cbiAgdmFyIGJhc2VfaW5kZXggPSAwO1xuLy8gIHZhciBzaG9leHRyYTsgICAgLyogZXh0cmEgYml0cyB0YWJsZSB0byB1c2UgKi9cbiAgdmFyIGVuZDsgICAgICAgICAgICAgICAgICAgIC8qIHVzZSBiYXNlIGFuZCBleHRyYSBmb3Igc3ltYm9sID4gZW5kICovXG4gIHZhciBjb3VudCA9IG5ldyB1dGlscy5CdWYxNihNQVhCSVRTICsgMSk7IC8vW01BWEJJVFMrMV07ICAgIC8qIG51bWJlciBvZiBjb2RlcyBvZiBlYWNoIGxlbmd0aCAqL1xuICB2YXIgb2ZmcyA9IG5ldyB1dGlscy5CdWYxNihNQVhCSVRTICsgMSk7IC8vW01BWEJJVFMrMV07ICAgICAvKiBvZmZzZXRzIGluIHRhYmxlIGZvciBlYWNoIGxlbmd0aCAqL1xuICB2YXIgZXh0cmEgPSBudWxsO1xuICB2YXIgZXh0cmFfaW5kZXggPSAwO1xuXG4gIHZhciBoZXJlX2JpdHMsIGhlcmVfb3AsIGhlcmVfdmFsO1xuXG4gIC8qXG4gICBQcm9jZXNzIGEgc2V0IG9mIGNvZGUgbGVuZ3RocyB0byBjcmVhdGUgYSBjYW5vbmljYWwgSHVmZm1hbiBjb2RlLiAgVGhlXG4gICBjb2RlIGxlbmd0aHMgYXJlIGxlbnNbMC4uY29kZXMtMV0uICBFYWNoIGxlbmd0aCBjb3JyZXNwb25kcyB0byB0aGVcbiAgIHN5bWJvbHMgMC4uY29kZXMtMS4gIFRoZSBIdWZmbWFuIGNvZGUgaXMgZ2VuZXJhdGVkIGJ5IGZpcnN0IHNvcnRpbmcgdGhlXG4gICBzeW1ib2xzIGJ5IGxlbmd0aCBmcm9tIHNob3J0IHRvIGxvbmcsIGFuZCByZXRhaW5pbmcgdGhlIHN5bWJvbCBvcmRlclxuICAgZm9yIGNvZGVzIHdpdGggZXF1YWwgbGVuZ3Rocy4gIFRoZW4gdGhlIGNvZGUgc3RhcnRzIHdpdGggYWxsIHplcm8gYml0c1xuICAgZm9yIHRoZSBmaXJzdCBjb2RlIG9mIHRoZSBzaG9ydGVzdCBsZW5ndGgsIGFuZCB0aGUgY29kZXMgYXJlIGludGVnZXJcbiAgIGluY3JlbWVudHMgZm9yIHRoZSBzYW1lIGxlbmd0aCwgYW5kIHplcm9zIGFyZSBhcHBlbmRlZCBhcyB0aGUgbGVuZ3RoXG4gICBpbmNyZWFzZXMuICBGb3IgdGhlIGRlZmxhdGUgZm9ybWF0LCB0aGVzZSBiaXRzIGFyZSBzdG9yZWQgYmFja3dhcmRzXG4gICBmcm9tIHRoZWlyIG1vcmUgbmF0dXJhbCBpbnRlZ2VyIGluY3JlbWVudCBvcmRlcmluZywgYW5kIHNvIHdoZW4gdGhlXG4gICBkZWNvZGluZyB0YWJsZXMgYXJlIGJ1aWx0IGluIHRoZSBsYXJnZSBsb29wIGJlbG93LCB0aGUgaW50ZWdlciBjb2Rlc1xuICAgYXJlIGluY3JlbWVudGVkIGJhY2t3YXJkcy5cblxuICAgVGhpcyByb3V0aW5lIGFzc3VtZXMsIGJ1dCBkb2VzIG5vdCBjaGVjaywgdGhhdCBhbGwgb2YgdGhlIGVudHJpZXMgaW5cbiAgIGxlbnNbXSBhcmUgaW4gdGhlIHJhbmdlIDAuLk1BWEJJVFMuICBUaGUgY2FsbGVyIG11c3QgYXNzdXJlIHRoaXMuXG4gICAxLi5NQVhCSVRTIGlzIGludGVycHJldGVkIGFzIHRoYXQgY29kZSBsZW5ndGguICB6ZXJvIG1lYW5zIHRoYXQgdGhhdFxuICAgc3ltYm9sIGRvZXMgbm90IG9jY3VyIGluIHRoaXMgY29kZS5cblxuICAgVGhlIGNvZGVzIGFyZSBzb3J0ZWQgYnkgY29tcHV0aW5nIGEgY291bnQgb2YgY29kZXMgZm9yIGVhY2ggbGVuZ3RoLFxuICAgY3JlYXRpbmcgZnJvbSB0aGF0IGEgdGFibGUgb2Ygc3RhcnRpbmcgaW5kaWNlcyBmb3IgZWFjaCBsZW5ndGggaW4gdGhlXG4gICBzb3J0ZWQgdGFibGUsIGFuZCB0aGVuIGVudGVyaW5nIHRoZSBzeW1ib2xzIGluIG9yZGVyIGluIHRoZSBzb3J0ZWRcbiAgIHRhYmxlLiAgVGhlIHNvcnRlZCB0YWJsZSBpcyB3b3JrW10sIHdpdGggdGhhdCBzcGFjZSBiZWluZyBwcm92aWRlZCBieVxuICAgdGhlIGNhbGxlci5cblxuICAgVGhlIGxlbmd0aCBjb3VudHMgYXJlIHVzZWQgZm9yIG90aGVyIHB1cnBvc2VzIGFzIHdlbGwsIGkuZS4gZmluZGluZ1xuICAgdGhlIG1pbmltdW0gYW5kIG1heGltdW0gbGVuZ3RoIGNvZGVzLCBkZXRlcm1pbmluZyBpZiB0aGVyZSBhcmUgYW55XG4gICBjb2RlcyBhdCBhbGwsIGNoZWNraW5nIGZvciBhIHZhbGlkIHNldCBvZiBsZW5ndGhzLCBhbmQgbG9va2luZyBhaGVhZFxuICAgYXQgbGVuZ3RoIGNvdW50cyB0byBkZXRlcm1pbmUgc3ViLXRhYmxlIHNpemVzIHdoZW4gYnVpbGRpbmcgdGhlXG4gICBkZWNvZGluZyB0YWJsZXMuXG4gICAqL1xuXG4gIC8qIGFjY3VtdWxhdGUgbGVuZ3RocyBmb3IgY29kZXMgKGFzc3VtZXMgbGVuc1tdIGFsbCBpbiAwLi5NQVhCSVRTKSAqL1xuICBmb3IgKGxlbiA9IDA7IGxlbiA8PSBNQVhCSVRTOyBsZW4rKykge1xuICAgIGNvdW50W2xlbl0gPSAwO1xuICB9XG4gIGZvciAoc3ltID0gMDsgc3ltIDwgY29kZXM7IHN5bSsrKSB7XG4gICAgY291bnRbbGVuc1tsZW5zX2luZGV4ICsgc3ltXV0rKztcbiAgfVxuXG4gIC8qIGJvdW5kIGNvZGUgbGVuZ3RocywgZm9yY2Ugcm9vdCB0byBiZSB3aXRoaW4gY29kZSBsZW5ndGhzICovXG4gIHJvb3QgPSBiaXRzO1xuICBmb3IgKG1heCA9IE1BWEJJVFM7IG1heCA+PSAxOyBtYXgtLSkge1xuICAgIGlmIChjb3VudFttYXhdICE9PSAwKSB7IGJyZWFrOyB9XG4gIH1cbiAgaWYgKHJvb3QgPiBtYXgpIHtcbiAgICByb290ID0gbWF4O1xuICB9XG4gIGlmIChtYXggPT09IDApIHsgICAgICAgICAgICAgICAgICAgICAvKiBubyBzeW1ib2xzIHRvIGNvZGUgYXQgYWxsICovXG4gICAgLy90YWJsZS5vcFtvcHRzLnRhYmxlX2luZGV4XSA9IDY0OyAgLy9oZXJlLm9wID0gKHZhciBjaGFyKTY0OyAgICAvKiBpbnZhbGlkIGNvZGUgbWFya2VyICovXG4gICAgLy90YWJsZS5iaXRzW29wdHMudGFibGVfaW5kZXhdID0gMTsgICAvL2hlcmUuYml0cyA9ICh2YXIgY2hhcikxO1xuICAgIC8vdGFibGUudmFsW29wdHMudGFibGVfaW5kZXgrK10gPSAwOyAgIC8vaGVyZS52YWwgPSAodmFyIHNob3J0KTA7XG4gICAgdGFibGVbdGFibGVfaW5kZXgrK10gPSAoMSA8PCAyNCkgfCAoNjQgPDwgMTYpIHwgMDtcblxuXG4gICAgLy90YWJsZS5vcFtvcHRzLnRhYmxlX2luZGV4XSA9IDY0O1xuICAgIC8vdGFibGUuYml0c1tvcHRzLnRhYmxlX2luZGV4XSA9IDE7XG4gICAgLy90YWJsZS52YWxbb3B0cy50YWJsZV9pbmRleCsrXSA9IDA7XG4gICAgdGFibGVbdGFibGVfaW5kZXgrK10gPSAoMSA8PCAyNCkgfCAoNjQgPDwgMTYpIHwgMDtcblxuICAgIG9wdHMuYml0cyA9IDE7XG4gICAgcmV0dXJuIDA7ICAgICAvKiBubyBzeW1ib2xzLCBidXQgd2FpdCBmb3IgZGVjb2RpbmcgdG8gcmVwb3J0IGVycm9yICovXG4gIH1cbiAgZm9yIChtaW4gPSAxOyBtaW4gPCBtYXg7IG1pbisrKSB7XG4gICAgaWYgKGNvdW50W21pbl0gIT09IDApIHsgYnJlYWs7IH1cbiAgfVxuICBpZiAocm9vdCA8IG1pbikge1xuICAgIHJvb3QgPSBtaW47XG4gIH1cblxuICAvKiBjaGVjayBmb3IgYW4gb3Zlci1zdWJzY3JpYmVkIG9yIGluY29tcGxldGUgc2V0IG9mIGxlbmd0aHMgKi9cbiAgbGVmdCA9IDE7XG4gIGZvciAobGVuID0gMTsgbGVuIDw9IE1BWEJJVFM7IGxlbisrKSB7XG4gICAgbGVmdCA8PD0gMTtcbiAgICBsZWZ0IC09IGNvdW50W2xlbl07XG4gICAgaWYgKGxlZnQgPCAwKSB7XG4gICAgICByZXR1cm4gLTE7XG4gICAgfSAgICAgICAgLyogb3Zlci1zdWJzY3JpYmVkICovXG4gIH1cbiAgaWYgKGxlZnQgPiAwICYmICh0eXBlID09PSBDT0RFUyB8fCBtYXggIT09IDEpKSB7XG4gICAgcmV0dXJuIC0xOyAgICAgICAgICAgICAgICAgICAgICAvKiBpbmNvbXBsZXRlIHNldCAqL1xuICB9XG5cbiAgLyogZ2VuZXJhdGUgb2Zmc2V0cyBpbnRvIHN5bWJvbCB0YWJsZSBmb3IgZWFjaCBsZW5ndGggZm9yIHNvcnRpbmcgKi9cbiAgb2Zmc1sxXSA9IDA7XG4gIGZvciAobGVuID0gMTsgbGVuIDwgTUFYQklUUzsgbGVuKyspIHtcbiAgICBvZmZzW2xlbiArIDFdID0gb2Zmc1tsZW5dICsgY291bnRbbGVuXTtcbiAgfVxuXG4gIC8qIHNvcnQgc3ltYm9scyBieSBsZW5ndGgsIGJ5IHN5bWJvbCBvcmRlciB3aXRoaW4gZWFjaCBsZW5ndGggKi9cbiAgZm9yIChzeW0gPSAwOyBzeW0gPCBjb2Rlczsgc3ltKyspIHtcbiAgICBpZiAobGVuc1tsZW5zX2luZGV4ICsgc3ltXSAhPT0gMCkge1xuICAgICAgd29ya1tvZmZzW2xlbnNbbGVuc19pbmRleCArIHN5bV1dKytdID0gc3ltO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICBDcmVhdGUgYW5kIGZpbGwgaW4gZGVjb2RpbmcgdGFibGVzLiAgSW4gdGhpcyBsb29wLCB0aGUgdGFibGUgYmVpbmdcbiAgIGZpbGxlZCBpcyBhdCBuZXh0IGFuZCBoYXMgY3VyciBpbmRleCBiaXRzLiAgVGhlIGNvZGUgYmVpbmcgdXNlZCBpcyBodWZmXG4gICB3aXRoIGxlbmd0aCBsZW4uICBUaGF0IGNvZGUgaXMgY29udmVydGVkIHRvIGFuIGluZGV4IGJ5IGRyb3BwaW5nIGRyb3BcbiAgIGJpdHMgb2ZmIG9mIHRoZSBib3R0b20uICBGb3IgY29kZXMgd2hlcmUgbGVuIGlzIGxlc3MgdGhhbiBkcm9wICsgY3VycixcbiAgIHRob3NlIHRvcCBkcm9wICsgY3VyciAtIGxlbiBiaXRzIGFyZSBpbmNyZW1lbnRlZCB0aHJvdWdoIGFsbCB2YWx1ZXMgdG9cbiAgIGZpbGwgdGhlIHRhYmxlIHdpdGggcmVwbGljYXRlZCBlbnRyaWVzLlxuXG4gICByb290IGlzIHRoZSBudW1iZXIgb2YgaW5kZXggYml0cyBmb3IgdGhlIHJvb3QgdGFibGUuICBXaGVuIGxlbiBleGNlZWRzXG4gICByb290LCBzdWItdGFibGVzIGFyZSBjcmVhdGVkIHBvaW50ZWQgdG8gYnkgdGhlIHJvb3QgZW50cnkgd2l0aCBhbiBpbmRleFxuICAgb2YgdGhlIGxvdyByb290IGJpdHMgb2YgaHVmZi4gIFRoaXMgaXMgc2F2ZWQgaW4gbG93IHRvIGNoZWNrIGZvciB3aGVuIGFcbiAgIG5ldyBzdWItdGFibGUgc2hvdWxkIGJlIHN0YXJ0ZWQuICBkcm9wIGlzIHplcm8gd2hlbiB0aGUgcm9vdCB0YWJsZSBpc1xuICAgYmVpbmcgZmlsbGVkLCBhbmQgZHJvcCBpcyByb290IHdoZW4gc3ViLXRhYmxlcyBhcmUgYmVpbmcgZmlsbGVkLlxuXG4gICBXaGVuIGEgbmV3IHN1Yi10YWJsZSBpcyBuZWVkZWQsIGl0IGlzIG5lY2Vzc2FyeSB0byBsb29rIGFoZWFkIGluIHRoZVxuICAgY29kZSBsZW5ndGhzIHRvIGRldGVybWluZSB3aGF0IHNpemUgc3ViLXRhYmxlIGlzIG5lZWRlZC4gIFRoZSBsZW5ndGhcbiAgIGNvdW50cyBhcmUgdXNlZCBmb3IgdGhpcywgYW5kIHNvIGNvdW50W10gaXMgZGVjcmVtZW50ZWQgYXMgY29kZXMgYXJlXG4gICBlbnRlcmVkIGluIHRoZSB0YWJsZXMuXG5cbiAgIHVzZWQga2VlcHMgdHJhY2sgb2YgaG93IG1hbnkgdGFibGUgZW50cmllcyBoYXZlIGJlZW4gYWxsb2NhdGVkIGZyb20gdGhlXG4gICBwcm92aWRlZCAqdGFibGUgc3BhY2UuICBJdCBpcyBjaGVja2VkIGZvciBMRU5TIGFuZCBESVNUIHRhYmxlcyBhZ2FpbnN0XG4gICB0aGUgY29uc3RhbnRzIEVOT1VHSF9MRU5TIGFuZCBFTk9VR0hfRElTVFMgdG8gZ3VhcmQgYWdhaW5zdCBjaGFuZ2VzIGluXG4gICB0aGUgaW5pdGlhbCByb290IHRhYmxlIHNpemUgY29uc3RhbnRzLiAgU2VlIHRoZSBjb21tZW50cyBpbiBpbmZ0cmVlcy5oXG4gICBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cblxuICAgc3ltIGluY3JlbWVudHMgdGhyb3VnaCBhbGwgc3ltYm9scywgYW5kIHRoZSBsb29wIHRlcm1pbmF0ZXMgd2hlblxuICAgYWxsIGNvZGVzIG9mIGxlbmd0aCBtYXgsIGkuZS4gYWxsIGNvZGVzLCBoYXZlIGJlZW4gcHJvY2Vzc2VkLiAgVGhpc1xuICAgcm91dGluZSBwZXJtaXRzIGluY29tcGxldGUgY29kZXMsIHNvIGFub3RoZXIgbG9vcCBhZnRlciB0aGlzIG9uZSBmaWxsc1xuICAgaW4gdGhlIHJlc3Qgb2YgdGhlIGRlY29kaW5nIHRhYmxlcyB3aXRoIGludmFsaWQgY29kZSBtYXJrZXJzLlxuICAgKi9cblxuICAvKiBzZXQgdXAgZm9yIGNvZGUgdHlwZSAqL1xuICAvLyBwb29yIG1hbiBvcHRpbWl6YXRpb24gLSB1c2UgaWYtZWxzZSBpbnN0ZWFkIG9mIHN3aXRjaCxcbiAgLy8gdG8gYXZvaWQgZGVvcHRzIGluIG9sZCB2OFxuICBpZiAodHlwZSA9PT0gQ09ERVMpIHtcbiAgICBiYXNlID0gZXh0cmEgPSB3b3JrOyAgICAvKiBkdW1teSB2YWx1ZS0tbm90IHVzZWQgKi9cbiAgICBlbmQgPSAxOTtcblxuICB9IGVsc2UgaWYgKHR5cGUgPT09IExFTlMpIHtcbiAgICBiYXNlID0gbGJhc2U7XG4gICAgYmFzZV9pbmRleCAtPSAyNTc7XG4gICAgZXh0cmEgPSBsZXh0O1xuICAgIGV4dHJhX2luZGV4IC09IDI1NztcbiAgICBlbmQgPSAyNTY7XG5cbiAgfSBlbHNlIHsgICAgICAgICAgICAgICAgICAgIC8qIERJU1RTICovXG4gICAgYmFzZSA9IGRiYXNlO1xuICAgIGV4dHJhID0gZGV4dDtcbiAgICBlbmQgPSAtMTtcbiAgfVxuXG4gIC8qIGluaXRpYWxpemUgb3B0cyBmb3IgbG9vcCAqL1xuICBodWZmID0gMDsgICAgICAgICAgICAgICAgICAgLyogc3RhcnRpbmcgY29kZSAqL1xuICBzeW0gPSAwOyAgICAgICAgICAgICAgICAgICAgLyogc3RhcnRpbmcgY29kZSBzeW1ib2wgKi9cbiAgbGVuID0gbWluOyAgICAgICAgICAgICAgICAgIC8qIHN0YXJ0aW5nIGNvZGUgbGVuZ3RoICovXG4gIG5leHQgPSB0YWJsZV9pbmRleDsgICAgICAgICAgICAgIC8qIGN1cnJlbnQgdGFibGUgdG8gZmlsbCBpbiAqL1xuICBjdXJyID0gcm9vdDsgICAgICAgICAgICAgICAgLyogY3VycmVudCB0YWJsZSBpbmRleCBiaXRzICovXG4gIGRyb3AgPSAwOyAgICAgICAgICAgICAgICAgICAvKiBjdXJyZW50IGJpdHMgdG8gZHJvcCBmcm9tIGNvZGUgZm9yIGluZGV4ICovXG4gIGxvdyA9IC0xOyAgICAgICAgICAgICAgICAgICAvKiB0cmlnZ2VyIG5ldyBzdWItdGFibGUgd2hlbiBsZW4gPiByb290ICovXG4gIHVzZWQgPSAxIDw8IHJvb3Q7ICAgICAgICAgIC8qIHVzZSByb290IHRhYmxlIGVudHJpZXMgKi9cbiAgbWFzayA9IHVzZWQgLSAxOyAgICAgICAgICAgIC8qIG1hc2sgZm9yIGNvbXBhcmluZyBsb3cgKi9cblxuICAvKiBjaGVjayBhdmFpbGFibGUgdGFibGUgc3BhY2UgKi9cbiAgaWYgKCh0eXBlID09PSBMRU5TICYmIHVzZWQgPiBFTk9VR0hfTEVOUykgfHxcbiAgICAodHlwZSA9PT0gRElTVFMgJiYgdXNlZCA+IEVOT1VHSF9ESVNUUykpIHtcbiAgICByZXR1cm4gMTtcbiAgfVxuXG4gIC8qIHByb2Nlc3MgYWxsIGNvZGVzIGFuZCBtYWtlIHRhYmxlIGVudHJpZXMgKi9cbiAgZm9yICg7Oykge1xuICAgIC8qIGNyZWF0ZSB0YWJsZSBlbnRyeSAqL1xuICAgIGhlcmVfYml0cyA9IGxlbiAtIGRyb3A7XG4gICAgaWYgKHdvcmtbc3ltXSA8IGVuZCkge1xuICAgICAgaGVyZV9vcCA9IDA7XG4gICAgICBoZXJlX3ZhbCA9IHdvcmtbc3ltXTtcbiAgICB9XG4gICAgZWxzZSBpZiAod29ya1tzeW1dID4gZW5kKSB7XG4gICAgICBoZXJlX29wID0gZXh0cmFbZXh0cmFfaW5kZXggKyB3b3JrW3N5bV1dO1xuICAgICAgaGVyZV92YWwgPSBiYXNlW2Jhc2VfaW5kZXggKyB3b3JrW3N5bV1dO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGhlcmVfb3AgPSAzMiArIDY0OyAgICAgICAgIC8qIGVuZCBvZiBibG9jayAqL1xuICAgICAgaGVyZV92YWwgPSAwO1xuICAgIH1cblxuICAgIC8qIHJlcGxpY2F0ZSBmb3IgdGhvc2UgaW5kaWNlcyB3aXRoIGxvdyBsZW4gYml0cyBlcXVhbCB0byBodWZmICovXG4gICAgaW5jciA9IDEgPDwgKGxlbiAtIGRyb3ApO1xuICAgIGZpbGwgPSAxIDw8IGN1cnI7XG4gICAgbWluID0gZmlsbDsgICAgICAgICAgICAgICAgIC8qIHNhdmUgb2Zmc2V0IHRvIG5leHQgdGFibGUgKi9cbiAgICBkbyB7XG4gICAgICBmaWxsIC09IGluY3I7XG4gICAgICB0YWJsZVtuZXh0ICsgKGh1ZmYgPj4gZHJvcCkgKyBmaWxsXSA9IChoZXJlX2JpdHMgPDwgMjQpIHwgKGhlcmVfb3AgPDwgMTYpIHwgaGVyZV92YWwgfDA7XG4gICAgfSB3aGlsZSAoZmlsbCAhPT0gMCk7XG5cbiAgICAvKiBiYWNrd2FyZHMgaW5jcmVtZW50IHRoZSBsZW4tYml0IGNvZGUgaHVmZiAqL1xuICAgIGluY3IgPSAxIDw8IChsZW4gLSAxKTtcbiAgICB3aGlsZSAoaHVmZiAmIGluY3IpIHtcbiAgICAgIGluY3IgPj49IDE7XG4gICAgfVxuICAgIGlmIChpbmNyICE9PSAwKSB7XG4gICAgICBodWZmICY9IGluY3IgLSAxO1xuICAgICAgaHVmZiArPSBpbmNyO1xuICAgIH0gZWxzZSB7XG4gICAgICBodWZmID0gMDtcbiAgICB9XG5cbiAgICAvKiBnbyB0byBuZXh0IHN5bWJvbCwgdXBkYXRlIGNvdW50LCBsZW4gKi9cbiAgICBzeW0rKztcbiAgICBpZiAoLS1jb3VudFtsZW5dID09PSAwKSB7XG4gICAgICBpZiAobGVuID09PSBtYXgpIHsgYnJlYWs7IH1cbiAgICAgIGxlbiA9IGxlbnNbbGVuc19pbmRleCArIHdvcmtbc3ltXV07XG4gICAgfVxuXG4gICAgLyogY3JlYXRlIG5ldyBzdWItdGFibGUgaWYgbmVlZGVkICovXG4gICAgaWYgKGxlbiA+IHJvb3QgJiYgKGh1ZmYgJiBtYXNrKSAhPT0gbG93KSB7XG4gICAgICAvKiBpZiBmaXJzdCB0aW1lLCB0cmFuc2l0aW9uIHRvIHN1Yi10YWJsZXMgKi9cbiAgICAgIGlmIChkcm9wID09PSAwKSB7XG4gICAgICAgIGRyb3AgPSByb290O1xuICAgICAgfVxuXG4gICAgICAvKiBpbmNyZW1lbnQgcGFzdCBsYXN0IHRhYmxlICovXG4gICAgICBuZXh0ICs9IG1pbjsgICAgICAgICAgICAvKiBoZXJlIG1pbiBpcyAxIDw8IGN1cnIgKi9cblxuICAgICAgLyogZGV0ZXJtaW5lIGxlbmd0aCBvZiBuZXh0IHRhYmxlICovXG4gICAgICBjdXJyID0gbGVuIC0gZHJvcDtcbiAgICAgIGxlZnQgPSAxIDw8IGN1cnI7XG4gICAgICB3aGlsZSAoY3VyciArIGRyb3AgPCBtYXgpIHtcbiAgICAgICAgbGVmdCAtPSBjb3VudFtjdXJyICsgZHJvcF07XG4gICAgICAgIGlmIChsZWZ0IDw9IDApIHsgYnJlYWs7IH1cbiAgICAgICAgY3VycisrO1xuICAgICAgICBsZWZ0IDw8PSAxO1xuICAgICAgfVxuXG4gICAgICAvKiBjaGVjayBmb3IgZW5vdWdoIHNwYWNlICovXG4gICAgICB1c2VkICs9IDEgPDwgY3VycjtcbiAgICAgIGlmICgodHlwZSA9PT0gTEVOUyAmJiB1c2VkID4gRU5PVUdIX0xFTlMpIHx8XG4gICAgICAgICh0eXBlID09PSBESVNUUyAmJiB1c2VkID4gRU5PVUdIX0RJU1RTKSkge1xuICAgICAgICByZXR1cm4gMTtcbiAgICAgIH1cblxuICAgICAgLyogcG9pbnQgZW50cnkgaW4gcm9vdCB0YWJsZSB0byBzdWItdGFibGUgKi9cbiAgICAgIGxvdyA9IGh1ZmYgJiBtYXNrO1xuICAgICAgLyp0YWJsZS5vcFtsb3ddID0gY3VycjtcbiAgICAgIHRhYmxlLmJpdHNbbG93XSA9IHJvb3Q7XG4gICAgICB0YWJsZS52YWxbbG93XSA9IG5leHQgLSBvcHRzLnRhYmxlX2luZGV4OyovXG4gICAgICB0YWJsZVtsb3ddID0gKHJvb3QgPDwgMjQpIHwgKGN1cnIgPDwgMTYpIHwgKG5leHQgLSB0YWJsZV9pbmRleCkgfDA7XG4gICAgfVxuICB9XG5cbiAgLyogZmlsbCBpbiByZW1haW5pbmcgdGFibGUgZW50cnkgaWYgY29kZSBpcyBpbmNvbXBsZXRlIChndWFyYW50ZWVkIHRvIGhhdmVcbiAgIGF0IG1vc3Qgb25lIHJlbWFpbmluZyBlbnRyeSwgc2luY2UgaWYgdGhlIGNvZGUgaXMgaW5jb21wbGV0ZSwgdGhlXG4gICBtYXhpbXVtIGNvZGUgbGVuZ3RoIHRoYXQgd2FzIGFsbG93ZWQgdG8gZ2V0IHRoaXMgZmFyIGlzIG9uZSBiaXQpICovXG4gIGlmIChodWZmICE9PSAwKSB7XG4gICAgLy90YWJsZS5vcFtuZXh0ICsgaHVmZl0gPSA2NDsgICAgICAgICAgICAvKiBpbnZhbGlkIGNvZGUgbWFya2VyICovXG4gICAgLy90YWJsZS5iaXRzW25leHQgKyBodWZmXSA9IGxlbiAtIGRyb3A7XG4gICAgLy90YWJsZS52YWxbbmV4dCArIGh1ZmZdID0gMDtcbiAgICB0YWJsZVtuZXh0ICsgaHVmZl0gPSAoKGxlbiAtIGRyb3ApIDw8IDI0KSB8ICg2NCA8PCAxNikgfDA7XG4gIH1cblxuICAvKiBzZXQgcmV0dXJuIHBhcmFtZXRlcnMgKi9cbiAgLy9vcHRzLnRhYmxlX2luZGV4ICs9IHVzZWQ7XG4gIG9wdHMuYml0cyA9IHJvb3Q7XG4gIHJldHVybiAwO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgMjogICAgICAnbmVlZCBkaWN0aW9uYXJ5JywgICAgIC8qIFpfTkVFRF9ESUNUICAgICAgIDIgICovXG4gIDE6ICAgICAgJ3N0cmVhbSBlbmQnLCAgICAgICAgICAvKiBaX1NUUkVBTV9FTkQgICAgICAxICAqL1xuICAwOiAgICAgICcnLCAgICAgICAgICAgICAgICAgICAgLyogWl9PSyAgICAgICAgICAgICAgMCAgKi9cbiAgJy0xJzogICAnZmlsZSBlcnJvcicsICAgICAgICAgIC8qIFpfRVJSTk8gICAgICAgICAoLTEpICovXG4gICctMic6ICAgJ3N0cmVhbSBlcnJvcicsICAgICAgICAvKiBaX1NUUkVBTV9FUlJPUiAgKC0yKSAqL1xuICAnLTMnOiAgICdkYXRhIGVycm9yJywgICAgICAgICAgLyogWl9EQVRBX0VSUk9SICAgICgtMykgKi9cbiAgJy00JzogICAnaW5zdWZmaWNpZW50IG1lbW9yeScsIC8qIFpfTUVNX0VSUk9SICAgICAoLTQpICovXG4gICctNSc6ICAgJ2J1ZmZlciBlcnJvcicsICAgICAgICAvKiBaX0JVRl9FUlJPUiAgICAgKC01KSAqL1xuICAnLTYnOiAgICdpbmNvbXBhdGlibGUgdmVyc2lvbicgLyogWl9WRVJTSU9OX0VSUk9SICgtNikgKi9cbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIChDKSAxOTk1LTIwMTMgSmVhbi1sb3VwIEdhaWxseSBhbmQgTWFyayBBZGxlclxuLy8gKEMpIDIwMTQtMjAxNyBWaXRhbHkgUHV6cmluIGFuZCBBbmRyZXkgVHVwaXRzaW5cbi8vXG4vLyBUaGlzIHNvZnR3YXJlIGlzIHByb3ZpZGVkICdhcy1pcycsIHdpdGhvdXQgYW55IGV4cHJlc3Mgb3IgaW1wbGllZFxuLy8gd2FycmFudHkuIEluIG5vIGV2ZW50IHdpbGwgdGhlIGF1dGhvcnMgYmUgaGVsZCBsaWFibGUgZm9yIGFueSBkYW1hZ2VzXG4vLyBhcmlzaW5nIGZyb20gdGhlIHVzZSBvZiB0aGlzIHNvZnR3YXJlLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgZ3JhbnRlZCB0byBhbnlvbmUgdG8gdXNlIHRoaXMgc29mdHdhcmUgZm9yIGFueSBwdXJwb3NlLFxuLy8gaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdFxuLy8gZnJlZWx5LCBzdWJqZWN0IHRvIHRoZSBmb2xsb3dpbmcgcmVzdHJpY3Rpb25zOlxuLy9cbi8vIDEuIFRoZSBvcmlnaW4gb2YgdGhpcyBzb2Z0d2FyZSBtdXN0IG5vdCBiZSBtaXNyZXByZXNlbnRlZDsgeW91IG11c3Qgbm90XG4vLyAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlXG4vLyAgIGluIGEgcHJvZHVjdCwgYW4gYWNrbm93bGVkZ21lbnQgaW4gdGhlIHByb2R1Y3QgZG9jdW1lbnRhdGlvbiB3b3VsZCBiZVxuLy8gICBhcHByZWNpYXRlZCBidXQgaXMgbm90IHJlcXVpcmVkLlxuLy8gMi4gQWx0ZXJlZCBzb3VyY2UgdmVyc2lvbnMgbXVzdCBiZSBwbGFpbmx5IG1hcmtlZCBhcyBzdWNoLCBhbmQgbXVzdCBub3QgYmVcbi8vICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLlxuLy8gMy4gVGhpcyBub3RpY2UgbWF5IG5vdCBiZSByZW1vdmVkIG9yIGFsdGVyZWQgZnJvbSBhbnkgc291cmNlIGRpc3RyaWJ1dGlvbi5cblxuLyogZXNsaW50LWRpc2FibGUgc3BhY2UtdW5hcnktb3BzICovXG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzL2NvbW1vbicpO1xuXG4vKiBQdWJsaWMgY29uc3RhbnRzID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0qL1xuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuXG4vL3ZhciBaX0ZJTFRFUkVEICAgICAgICAgID0gMTtcbi8vdmFyIFpfSFVGRk1BTl9PTkxZICAgICAgPSAyO1xuLy92YXIgWl9STEUgICAgICAgICAgICAgICA9IDM7XG52YXIgWl9GSVhFRCAgICAgICAgICAgICAgID0gNDtcbi8vdmFyIFpfREVGQVVMVF9TVFJBVEVHWSAgPSAwO1xuXG4vKiBQb3NzaWJsZSB2YWx1ZXMgb2YgdGhlIGRhdGFfdHlwZSBmaWVsZCAodGhvdWdoIHNlZSBpbmZsYXRlKCkpICovXG52YXIgWl9CSU5BUlkgICAgICAgICAgICAgID0gMDtcbnZhciBaX1RFWFQgICAgICAgICAgICAgICAgPSAxO1xuLy92YXIgWl9BU0NJSSAgICAgICAgICAgICA9IDE7IC8vID0gWl9URVhUXG52YXIgWl9VTktOT1dOICAgICAgICAgICAgID0gMjtcblxuLyo9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09Ki9cblxuXG5mdW5jdGlvbiB6ZXJvKGJ1ZikgeyB2YXIgbGVuID0gYnVmLmxlbmd0aDsgd2hpbGUgKC0tbGVuID49IDApIHsgYnVmW2xlbl0gPSAwOyB9IH1cblxuLy8gRnJvbSB6dXRpbC5oXG5cbnZhciBTVE9SRURfQkxPQ0sgPSAwO1xudmFyIFNUQVRJQ19UUkVFUyA9IDE7XG52YXIgRFlOX1RSRUVTICAgID0gMjtcbi8qIFRoZSB0aHJlZSBraW5kcyBvZiBibG9jayB0eXBlICovXG5cbnZhciBNSU5fTUFUQ0ggICAgPSAzO1xudmFyIE1BWF9NQVRDSCAgICA9IDI1ODtcbi8qIFRoZSBtaW5pbXVtIGFuZCBtYXhpbXVtIG1hdGNoIGxlbmd0aHMgKi9cblxuLy8gRnJvbSBkZWZsYXRlLmhcbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW50ZXJuYWwgY29tcHJlc3Npb24gc3RhdGUuXG4gKi9cblxudmFyIExFTkdUSF9DT0RFUyAgPSAyOTtcbi8qIG51bWJlciBvZiBsZW5ndGggY29kZXMsIG5vdCBjb3VudGluZyB0aGUgc3BlY2lhbCBFTkRfQkxPQ0sgY29kZSAqL1xuXG52YXIgTElURVJBTFMgICAgICA9IDI1Njtcbi8qIG51bWJlciBvZiBsaXRlcmFsIGJ5dGVzIDAuLjI1NSAqL1xuXG52YXIgTF9DT0RFUyAgICAgICA9IExJVEVSQUxTICsgMSArIExFTkdUSF9DT0RFUztcbi8qIG51bWJlciBvZiBMaXRlcmFsIG9yIExlbmd0aCBjb2RlcywgaW5jbHVkaW5nIHRoZSBFTkRfQkxPQ0sgY29kZSAqL1xuXG52YXIgRF9DT0RFUyAgICAgICA9IDMwO1xuLyogbnVtYmVyIG9mIGRpc3RhbmNlIGNvZGVzICovXG5cbnZhciBCTF9DT0RFUyAgICAgID0gMTk7XG4vKiBudW1iZXIgb2YgY29kZXMgdXNlZCB0byB0cmFuc2ZlciB0aGUgYml0IGxlbmd0aHMgKi9cblxudmFyIEhFQVBfU0laRSAgICAgPSAyICogTF9DT0RFUyArIDE7XG4vKiBtYXhpbXVtIGhlYXAgc2l6ZSAqL1xuXG52YXIgTUFYX0JJVFMgICAgICA9IDE1O1xuLyogQWxsIGNvZGVzIG11c3Qgbm90IGV4Y2VlZCBNQVhfQklUUyBiaXRzICovXG5cbnZhciBCdWZfc2l6ZSAgICAgID0gMTY7XG4vKiBzaXplIG9mIGJpdCBidWZmZXIgaW4gYmlfYnVmICovXG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDb25zdGFudHNcbiAqL1xuXG52YXIgTUFYX0JMX0JJVFMgPSA3O1xuLyogQml0IGxlbmd0aCBjb2RlcyBtdXN0IG5vdCBleGNlZWQgTUFYX0JMX0JJVFMgYml0cyAqL1xuXG52YXIgRU5EX0JMT0NLICAgPSAyNTY7XG4vKiBlbmQgb2YgYmxvY2sgbGl0ZXJhbCBjb2RlICovXG5cbnZhciBSRVBfM182ICAgICA9IDE2O1xuLyogcmVwZWF0IHByZXZpb3VzIGJpdCBsZW5ndGggMy02IHRpbWVzICgyIGJpdHMgb2YgcmVwZWF0IGNvdW50KSAqL1xuXG52YXIgUkVQWl8zXzEwICAgPSAxNztcbi8qIHJlcGVhdCBhIHplcm8gbGVuZ3RoIDMtMTAgdGltZXMgICgzIGJpdHMgb2YgcmVwZWF0IGNvdW50KSAqL1xuXG52YXIgUkVQWl8xMV8xMzggPSAxODtcbi8qIHJlcGVhdCBhIHplcm8gbGVuZ3RoIDExLTEzOCB0aW1lcyAgKDcgYml0cyBvZiByZXBlYXQgY291bnQpICovXG5cbi8qIGVzbGludC1kaXNhYmxlIGNvbW1hLXNwYWNpbmcsYXJyYXktYnJhY2tldC1zcGFjaW5nICovXG52YXIgZXh0cmFfbGJpdHMgPSAgIC8qIGV4dHJhIGJpdHMgZm9yIGVhY2ggbGVuZ3RoIGNvZGUgKi9cbiAgWzAsMCwwLDAsMCwwLDAsMCwxLDEsMSwxLDIsMiwyLDIsMywzLDMsMyw0LDQsNCw0LDUsNSw1LDUsMF07XG5cbnZhciBleHRyYV9kYml0cyA9ICAgLyogZXh0cmEgYml0cyBmb3IgZWFjaCBkaXN0YW5jZSBjb2RlICovXG4gIFswLDAsMCwwLDEsMSwyLDIsMywzLDQsNCw1LDUsNiw2LDcsNyw4LDgsOSw5LDEwLDEwLDExLDExLDEyLDEyLDEzLDEzXTtcblxudmFyIGV4dHJhX2JsYml0cyA9ICAvKiBleHRyYSBiaXRzIGZvciBlYWNoIGJpdCBsZW5ndGggY29kZSAqL1xuICBbMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDAsMCwyLDMsN107XG5cbnZhciBibF9vcmRlciA9XG4gIFsxNiwxNywxOCwwLDgsNyw5LDYsMTAsNSwxMSw0LDEyLDMsMTMsMiwxNCwxLDE1XTtcbi8qIGVzbGludC1lbmFibGUgY29tbWEtc3BhY2luZyxhcnJheS1icmFja2V0LXNwYWNpbmcgKi9cblxuLyogVGhlIGxlbmd0aHMgb2YgdGhlIGJpdCBsZW5ndGggY29kZXMgYXJlIHNlbnQgaW4gb3JkZXIgb2YgZGVjcmVhc2luZ1xuICogcHJvYmFiaWxpdHksIHRvIGF2b2lkIHRyYW5zbWl0dGluZyB0aGUgbGVuZ3RocyBmb3IgdW51c2VkIGJpdCBsZW5ndGggY29kZXMuXG4gKi9cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBMb2NhbCBkYXRhLiBUaGVzZSBhcmUgaW5pdGlhbGl6ZWQgb25seSBvbmNlLlxuICovXG5cbi8vIFdlIHByZS1maWxsIGFycmF5cyB3aXRoIDAgdG8gYXZvaWQgdW5pbml0aWFsaXplZCBnYXBzXG5cbnZhciBESVNUX0NPREVfTEVOID0gNTEyOyAvKiBzZWUgZGVmaW5pdGlvbiBvZiBhcnJheSBkaXN0X2NvZGUgYmVsb3cgKi9cblxuLy8gISEhISBVc2UgZmxhdCBhcnJheSBpbnN0ZWFkIG9mIHN0cnVjdHVyZSwgRnJlcSA9IGkqMiwgTGVuID0gaSoyKzFcbnZhciBzdGF0aWNfbHRyZWUgID0gbmV3IEFycmF5KChMX0NPREVTICsgMikgKiAyKTtcbnplcm8oc3RhdGljX2x0cmVlKTtcbi8qIFRoZSBzdGF0aWMgbGl0ZXJhbCB0cmVlLiBTaW5jZSB0aGUgYml0IGxlbmd0aHMgYXJlIGltcG9zZWQsIHRoZXJlIGlzIG5vXG4gKiBuZWVkIGZvciB0aGUgTF9DT0RFUyBleHRyYSBjb2RlcyB1c2VkIGR1cmluZyBoZWFwIGNvbnN0cnVjdGlvbi4gSG93ZXZlclxuICogVGhlIGNvZGVzIDI4NiBhbmQgMjg3IGFyZSBuZWVkZWQgdG8gYnVpbGQgYSBjYW5vbmljYWwgdHJlZSAoc2VlIF90cl9pbml0XG4gKiBiZWxvdykuXG4gKi9cblxudmFyIHN0YXRpY19kdHJlZSAgPSBuZXcgQXJyYXkoRF9DT0RFUyAqIDIpO1xuemVybyhzdGF0aWNfZHRyZWUpO1xuLyogVGhlIHN0YXRpYyBkaXN0YW5jZSB0cmVlLiAoQWN0dWFsbHkgYSB0cml2aWFsIHRyZWUgc2luY2UgYWxsIGNvZGVzIHVzZVxuICogNSBiaXRzLilcbiAqL1xuXG52YXIgX2Rpc3RfY29kZSAgICA9IG5ldyBBcnJheShESVNUX0NPREVfTEVOKTtcbnplcm8oX2Rpc3RfY29kZSk7XG4vKiBEaXN0YW5jZSBjb2Rlcy4gVGhlIGZpcnN0IDI1NiB2YWx1ZXMgY29ycmVzcG9uZCB0byB0aGUgZGlzdGFuY2VzXG4gKiAzIC4uIDI1OCwgdGhlIGxhc3QgMjU2IHZhbHVlcyBjb3JyZXNwb25kIHRvIHRoZSB0b3AgOCBiaXRzIG9mXG4gKiB0aGUgMTUgYml0IGRpc3RhbmNlcy5cbiAqL1xuXG52YXIgX2xlbmd0aF9jb2RlICA9IG5ldyBBcnJheShNQVhfTUFUQ0ggLSBNSU5fTUFUQ0ggKyAxKTtcbnplcm8oX2xlbmd0aF9jb2RlKTtcbi8qIGxlbmd0aCBjb2RlIGZvciBlYWNoIG5vcm1hbGl6ZWQgbWF0Y2ggbGVuZ3RoICgwID09IE1JTl9NQVRDSCkgKi9cblxudmFyIGJhc2VfbGVuZ3RoICAgPSBuZXcgQXJyYXkoTEVOR1RIX0NPREVTKTtcbnplcm8oYmFzZV9sZW5ndGgpO1xuLyogRmlyc3Qgbm9ybWFsaXplZCBsZW5ndGggZm9yIGVhY2ggY29kZSAoMCA9IE1JTl9NQVRDSCkgKi9cblxudmFyIGJhc2VfZGlzdCAgICAgPSBuZXcgQXJyYXkoRF9DT0RFUyk7XG56ZXJvKGJhc2VfZGlzdCk7XG4vKiBGaXJzdCBub3JtYWxpemVkIGRpc3RhbmNlIGZvciBlYWNoIGNvZGUgKDAgPSBkaXN0YW5jZSBvZiAxKSAqL1xuXG5cbmZ1bmN0aW9uIFN0YXRpY1RyZWVEZXNjKHN0YXRpY190cmVlLCBleHRyYV9iaXRzLCBleHRyYV9iYXNlLCBlbGVtcywgbWF4X2xlbmd0aCkge1xuXG4gIHRoaXMuc3RhdGljX3RyZWUgID0gc3RhdGljX3RyZWU7ICAvKiBzdGF0aWMgdHJlZSBvciBOVUxMICovXG4gIHRoaXMuZXh0cmFfYml0cyAgID0gZXh0cmFfYml0czsgICAvKiBleHRyYSBiaXRzIGZvciBlYWNoIGNvZGUgb3IgTlVMTCAqL1xuICB0aGlzLmV4dHJhX2Jhc2UgICA9IGV4dHJhX2Jhc2U7ICAgLyogYmFzZSBpbmRleCBmb3IgZXh0cmFfYml0cyAqL1xuICB0aGlzLmVsZW1zICAgICAgICA9IGVsZW1zOyAgICAgICAgLyogbWF4IG51bWJlciBvZiBlbGVtZW50cyBpbiB0aGUgdHJlZSAqL1xuICB0aGlzLm1heF9sZW5ndGggICA9IG1heF9sZW5ndGg7ICAgLyogbWF4IGJpdCBsZW5ndGggZm9yIHRoZSBjb2RlcyAqL1xuXG4gIC8vIHNob3cgaWYgYHN0YXRpY190cmVlYCBoYXMgZGF0YSBvciBkdW1teSAtIG5lZWRlZCBmb3IgbW9ub21vcnBoaWMgb2JqZWN0c1xuICB0aGlzLmhhc19zdHJlZSAgICA9IHN0YXRpY190cmVlICYmIHN0YXRpY190cmVlLmxlbmd0aDtcbn1cblxuXG52YXIgc3RhdGljX2xfZGVzYztcbnZhciBzdGF0aWNfZF9kZXNjO1xudmFyIHN0YXRpY19ibF9kZXNjO1xuXG5cbmZ1bmN0aW9uIFRyZWVEZXNjKGR5bl90cmVlLCBzdGF0X2Rlc2MpIHtcbiAgdGhpcy5keW5fdHJlZSA9IGR5bl90cmVlOyAgICAgLyogdGhlIGR5bmFtaWMgdHJlZSAqL1xuICB0aGlzLm1heF9jb2RlID0gMDsgICAgICAgICAgICAvKiBsYXJnZXN0IGNvZGUgd2l0aCBub24gemVybyBmcmVxdWVuY3kgKi9cbiAgdGhpcy5zdGF0X2Rlc2MgPSBzdGF0X2Rlc2M7ICAgLyogdGhlIGNvcnJlc3BvbmRpbmcgc3RhdGljIHRyZWUgKi9cbn1cblxuXG5cbmZ1bmN0aW9uIGRfY29kZShkaXN0KSB7XG4gIHJldHVybiBkaXN0IDwgMjU2ID8gX2Rpc3RfY29kZVtkaXN0XSA6IF9kaXN0X2NvZGVbMjU2ICsgKGRpc3QgPj4+IDcpXTtcbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIE91dHB1dCBhIHNob3J0IExTQiBmaXJzdCBvbiB0aGUgc3RyZWFtLlxuICogSU4gYXNzZXJ0aW9uOiB0aGVyZSBpcyBlbm91Z2ggcm9vbSBpbiBwZW5kaW5nQnVmLlxuICovXG5mdW5jdGlvbiBwdXRfc2hvcnQocywgdykge1xuLy8gICAgcHV0X2J5dGUocywgKHVjaCkoKHcpICYgMHhmZikpO1xuLy8gICAgcHV0X2J5dGUocywgKHVjaCkoKHVzaCkodykgPj4gOCkpO1xuICBzLnBlbmRpbmdfYnVmW3MucGVuZGluZysrXSA9ICh3KSAmIDB4ZmY7XG4gIHMucGVuZGluZ19idWZbcy5wZW5kaW5nKytdID0gKHcgPj4+IDgpICYgMHhmZjtcbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNlbmQgYSB2YWx1ZSBvbiBhIGdpdmVuIG51bWJlciBvZiBiaXRzLlxuICogSU4gYXNzZXJ0aW9uOiBsZW5ndGggPD0gMTYgYW5kIHZhbHVlIGZpdHMgaW4gbGVuZ3RoIGJpdHMuXG4gKi9cbmZ1bmN0aW9uIHNlbmRfYml0cyhzLCB2YWx1ZSwgbGVuZ3RoKSB7XG4gIGlmIChzLmJpX3ZhbGlkID4gKEJ1Zl9zaXplIC0gbGVuZ3RoKSkge1xuICAgIHMuYmlfYnVmIHw9ICh2YWx1ZSA8PCBzLmJpX3ZhbGlkKSAmIDB4ZmZmZjtcbiAgICBwdXRfc2hvcnQocywgcy5iaV9idWYpO1xuICAgIHMuYmlfYnVmID0gdmFsdWUgPj4gKEJ1Zl9zaXplIC0gcy5iaV92YWxpZCk7XG4gICAgcy5iaV92YWxpZCArPSBsZW5ndGggLSBCdWZfc2l6ZTtcbiAgfSBlbHNlIHtcbiAgICBzLmJpX2J1ZiB8PSAodmFsdWUgPDwgcy5iaV92YWxpZCkgJiAweGZmZmY7XG4gICAgcy5iaV92YWxpZCArPSBsZW5ndGg7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBzZW5kX2NvZGUocywgYywgdHJlZSkge1xuICBzZW5kX2JpdHMocywgdHJlZVtjICogMl0vKi5Db2RlKi8sIHRyZWVbYyAqIDIgKyAxXS8qLkxlbiovKTtcbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFJldmVyc2UgdGhlIGZpcnN0IGxlbiBiaXRzIG9mIGEgY29kZSwgdXNpbmcgc3RyYWlnaHRmb3J3YXJkIGNvZGUgKGEgZmFzdGVyXG4gKiBtZXRob2Qgd291bGQgdXNlIGEgdGFibGUpXG4gKiBJTiBhc3NlcnRpb246IDEgPD0gbGVuIDw9IDE1XG4gKi9cbmZ1bmN0aW9uIGJpX3JldmVyc2UoY29kZSwgbGVuKSB7XG4gIHZhciByZXMgPSAwO1xuICBkbyB7XG4gICAgcmVzIHw9IGNvZGUgJiAxO1xuICAgIGNvZGUgPj4+PSAxO1xuICAgIHJlcyA8PD0gMTtcbiAgfSB3aGlsZSAoLS1sZW4gPiAwKTtcbiAgcmV0dXJuIHJlcyA+Pj4gMTtcbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEZsdXNoIHRoZSBiaXQgYnVmZmVyLCBrZWVwaW5nIGF0IG1vc3QgNyBiaXRzIGluIGl0LlxuICovXG5mdW5jdGlvbiBiaV9mbHVzaChzKSB7XG4gIGlmIChzLmJpX3ZhbGlkID09PSAxNikge1xuICAgIHB1dF9zaG9ydChzLCBzLmJpX2J1Zik7XG4gICAgcy5iaV9idWYgPSAwO1xuICAgIHMuYmlfdmFsaWQgPSAwO1xuXG4gIH0gZWxzZSBpZiAocy5iaV92YWxpZCA+PSA4KSB7XG4gICAgcy5wZW5kaW5nX2J1ZltzLnBlbmRpbmcrK10gPSBzLmJpX2J1ZiAmIDB4ZmY7XG4gICAgcy5iaV9idWYgPj49IDg7XG4gICAgcy5iaV92YWxpZCAtPSA4O1xuICB9XG59XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDb21wdXRlIHRoZSBvcHRpbWFsIGJpdCBsZW5ndGhzIGZvciBhIHRyZWUgYW5kIHVwZGF0ZSB0aGUgdG90YWwgYml0IGxlbmd0aFxuICogZm9yIHRoZSBjdXJyZW50IGJsb2NrLlxuICogSU4gYXNzZXJ0aW9uOiB0aGUgZmllbGRzIGZyZXEgYW5kIGRhZCBhcmUgc2V0LCBoZWFwW2hlYXBfbWF4XSBhbmRcbiAqICAgIGFib3ZlIGFyZSB0aGUgdHJlZSBub2RlcyBzb3J0ZWQgYnkgaW5jcmVhc2luZyBmcmVxdWVuY3kuXG4gKiBPVVQgYXNzZXJ0aW9uczogdGhlIGZpZWxkIGxlbiBpcyBzZXQgdG8gdGhlIG9wdGltYWwgYml0IGxlbmd0aCwgdGhlXG4gKiAgICAgYXJyYXkgYmxfY291bnQgY29udGFpbnMgdGhlIGZyZXF1ZW5jaWVzIGZvciBlYWNoIGJpdCBsZW5ndGguXG4gKiAgICAgVGhlIGxlbmd0aCBvcHRfbGVuIGlzIHVwZGF0ZWQ7IHN0YXRpY19sZW4gaXMgYWxzbyB1cGRhdGVkIGlmIHN0cmVlIGlzXG4gKiAgICAgbm90IG51bGwuXG4gKi9cbmZ1bmN0aW9uIGdlbl9iaXRsZW4ocywgZGVzYylcbi8vICAgIGRlZmxhdGVfc3RhdGUgKnM7XG4vLyAgICB0cmVlX2Rlc2MgKmRlc2M7ICAgIC8qIHRoZSB0cmVlIGRlc2NyaXB0b3IgKi9cbntcbiAgdmFyIHRyZWUgICAgICAgICAgICA9IGRlc2MuZHluX3RyZWU7XG4gIHZhciBtYXhfY29kZSAgICAgICAgPSBkZXNjLm1heF9jb2RlO1xuICB2YXIgc3RyZWUgICAgICAgICAgID0gZGVzYy5zdGF0X2Rlc2Muc3RhdGljX3RyZWU7XG4gIHZhciBoYXNfc3RyZWUgICAgICAgPSBkZXNjLnN0YXRfZGVzYy5oYXNfc3RyZWU7XG4gIHZhciBleHRyYSAgICAgICAgICAgPSBkZXNjLnN0YXRfZGVzYy5leHRyYV9iaXRzO1xuICB2YXIgYmFzZSAgICAgICAgICAgID0gZGVzYy5zdGF0X2Rlc2MuZXh0cmFfYmFzZTtcbiAgdmFyIG1heF9sZW5ndGggICAgICA9IGRlc2Muc3RhdF9kZXNjLm1heF9sZW5ndGg7XG4gIHZhciBoOyAgICAgICAgICAgICAgLyogaGVhcCBpbmRleCAqL1xuICB2YXIgbiwgbTsgICAgICAgICAgIC8qIGl0ZXJhdGUgb3ZlciB0aGUgdHJlZSBlbGVtZW50cyAqL1xuICB2YXIgYml0czsgICAgICAgICAgIC8qIGJpdCBsZW5ndGggKi9cbiAgdmFyIHhiaXRzOyAgICAgICAgICAvKiBleHRyYSBiaXRzICovXG4gIHZhciBmOyAgICAgICAgICAgICAgLyogZnJlcXVlbmN5ICovXG4gIHZhciBvdmVyZmxvdyA9IDA7ICAgLyogbnVtYmVyIG9mIGVsZW1lbnRzIHdpdGggYml0IGxlbmd0aCB0b28gbGFyZ2UgKi9cblxuICBmb3IgKGJpdHMgPSAwOyBiaXRzIDw9IE1BWF9CSVRTOyBiaXRzKyspIHtcbiAgICBzLmJsX2NvdW50W2JpdHNdID0gMDtcbiAgfVxuXG4gIC8qIEluIGEgZmlyc3QgcGFzcywgY29tcHV0ZSB0aGUgb3B0aW1hbCBiaXQgbGVuZ3RocyAod2hpY2ggbWF5XG4gICAqIG92ZXJmbG93IGluIHRoZSBjYXNlIG9mIHRoZSBiaXQgbGVuZ3RoIHRyZWUpLlxuICAgKi9cbiAgdHJlZVtzLmhlYXBbcy5oZWFwX21heF0gKiAyICsgMV0vKi5MZW4qLyA9IDA7IC8qIHJvb3Qgb2YgdGhlIGhlYXAgKi9cblxuICBmb3IgKGggPSBzLmhlYXBfbWF4ICsgMTsgaCA8IEhFQVBfU0laRTsgaCsrKSB7XG4gICAgbiA9IHMuaGVhcFtoXTtcbiAgICBiaXRzID0gdHJlZVt0cmVlW24gKiAyICsgMV0vKi5EYWQqLyAqIDIgKyAxXS8qLkxlbiovICsgMTtcbiAgICBpZiAoYml0cyA+IG1heF9sZW5ndGgpIHtcbiAgICAgIGJpdHMgPSBtYXhfbGVuZ3RoO1xuICAgICAgb3ZlcmZsb3crKztcbiAgICB9XG4gICAgdHJlZVtuICogMiArIDFdLyouTGVuKi8gPSBiaXRzO1xuICAgIC8qIFdlIG92ZXJ3cml0ZSB0cmVlW25dLkRhZCB3aGljaCBpcyBubyBsb25nZXIgbmVlZGVkICovXG5cbiAgICBpZiAobiA+IG1heF9jb2RlKSB7IGNvbnRpbnVlOyB9IC8qIG5vdCBhIGxlYWYgbm9kZSAqL1xuXG4gICAgcy5ibF9jb3VudFtiaXRzXSsrO1xuICAgIHhiaXRzID0gMDtcbiAgICBpZiAobiA+PSBiYXNlKSB7XG4gICAgICB4Yml0cyA9IGV4dHJhW24gLSBiYXNlXTtcbiAgICB9XG4gICAgZiA9IHRyZWVbbiAqIDJdLyouRnJlcSovO1xuICAgIHMub3B0X2xlbiArPSBmICogKGJpdHMgKyB4Yml0cyk7XG4gICAgaWYgKGhhc19zdHJlZSkge1xuICAgICAgcy5zdGF0aWNfbGVuICs9IGYgKiAoc3RyZWVbbiAqIDIgKyAxXS8qLkxlbiovICsgeGJpdHMpO1xuICAgIH1cbiAgfVxuICBpZiAob3ZlcmZsb3cgPT09IDApIHsgcmV0dXJuOyB9XG5cbiAgLy8gVHJhY2UoKHN0ZGVycixcIlxcbmJpdCBsZW5ndGggb3ZlcmZsb3dcXG5cIikpO1xuICAvKiBUaGlzIGhhcHBlbnMgZm9yIGV4YW1wbGUgb24gb2JqMiBhbmQgcGljIG9mIHRoZSBDYWxnYXJ5IGNvcnB1cyAqL1xuXG4gIC8qIEZpbmQgdGhlIGZpcnN0IGJpdCBsZW5ndGggd2hpY2ggY291bGQgaW5jcmVhc2U6ICovXG4gIGRvIHtcbiAgICBiaXRzID0gbWF4X2xlbmd0aCAtIDE7XG4gICAgd2hpbGUgKHMuYmxfY291bnRbYml0c10gPT09IDApIHsgYml0cy0tOyB9XG4gICAgcy5ibF9jb3VudFtiaXRzXS0tOyAgICAgIC8qIG1vdmUgb25lIGxlYWYgZG93biB0aGUgdHJlZSAqL1xuICAgIHMuYmxfY291bnRbYml0cyArIDFdICs9IDI7IC8qIG1vdmUgb25lIG92ZXJmbG93IGl0ZW0gYXMgaXRzIGJyb3RoZXIgKi9cbiAgICBzLmJsX2NvdW50W21heF9sZW5ndGhdLS07XG4gICAgLyogVGhlIGJyb3RoZXIgb2YgdGhlIG92ZXJmbG93IGl0ZW0gYWxzbyBtb3ZlcyBvbmUgc3RlcCB1cCxcbiAgICAgKiBidXQgdGhpcyBkb2VzIG5vdCBhZmZlY3QgYmxfY291bnRbbWF4X2xlbmd0aF1cbiAgICAgKi9cbiAgICBvdmVyZmxvdyAtPSAyO1xuICB9IHdoaWxlIChvdmVyZmxvdyA+IDApO1xuXG4gIC8qIE5vdyByZWNvbXB1dGUgYWxsIGJpdCBsZW5ndGhzLCBzY2FubmluZyBpbiBpbmNyZWFzaW5nIGZyZXF1ZW5jeS5cbiAgICogaCBpcyBzdGlsbCBlcXVhbCB0byBIRUFQX1NJWkUuIChJdCBpcyBzaW1wbGVyIHRvIHJlY29uc3RydWN0IGFsbFxuICAgKiBsZW5ndGhzIGluc3RlYWQgb2YgZml4aW5nIG9ubHkgdGhlIHdyb25nIG9uZXMuIFRoaXMgaWRlYSBpcyB0YWtlblxuICAgKiBmcm9tICdhcicgd3JpdHRlbiBieSBIYXJ1aGlrbyBPa3VtdXJhLilcbiAgICovXG4gIGZvciAoYml0cyA9IG1heF9sZW5ndGg7IGJpdHMgIT09IDA7IGJpdHMtLSkge1xuICAgIG4gPSBzLmJsX2NvdW50W2JpdHNdO1xuICAgIHdoaWxlIChuICE9PSAwKSB7XG4gICAgICBtID0gcy5oZWFwWy0taF07XG4gICAgICBpZiAobSA+IG1heF9jb2RlKSB7IGNvbnRpbnVlOyB9XG4gICAgICBpZiAodHJlZVttICogMiArIDFdLyouTGVuKi8gIT09IGJpdHMpIHtcbiAgICAgICAgLy8gVHJhY2UoKHN0ZGVycixcImNvZGUgJWQgYml0cyAlZC0+JWRcXG5cIiwgbSwgdHJlZVttXS5MZW4sIGJpdHMpKTtcbiAgICAgICAgcy5vcHRfbGVuICs9IChiaXRzIC0gdHJlZVttICogMiArIDFdLyouTGVuKi8pICogdHJlZVttICogMl0vKi5GcmVxKi87XG4gICAgICAgIHRyZWVbbSAqIDIgKyAxXS8qLkxlbiovID0gYml0cztcbiAgICAgIH1cbiAgICAgIG4tLTtcbiAgICB9XG4gIH1cbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEdlbmVyYXRlIHRoZSBjb2RlcyBmb3IgYSBnaXZlbiB0cmVlIGFuZCBiaXQgY291bnRzICh3aGljaCBuZWVkIG5vdCBiZVxuICogb3B0aW1hbCkuXG4gKiBJTiBhc3NlcnRpb246IHRoZSBhcnJheSBibF9jb3VudCBjb250YWlucyB0aGUgYml0IGxlbmd0aCBzdGF0aXN0aWNzIGZvclxuICogdGhlIGdpdmVuIHRyZWUgYW5kIHRoZSBmaWVsZCBsZW4gaXMgc2V0IGZvciBhbGwgdHJlZSBlbGVtZW50cy5cbiAqIE9VVCBhc3NlcnRpb246IHRoZSBmaWVsZCBjb2RlIGlzIHNldCBmb3IgYWxsIHRyZWUgZWxlbWVudHMgb2Ygbm9uXG4gKiAgICAgemVybyBjb2RlIGxlbmd0aC5cbiAqL1xuZnVuY3Rpb24gZ2VuX2NvZGVzKHRyZWUsIG1heF9jb2RlLCBibF9jb3VudClcbi8vICAgIGN0X2RhdGEgKnRyZWU7ICAgICAgICAgICAgIC8qIHRoZSB0cmVlIHRvIGRlY29yYXRlICovXG4vLyAgICBpbnQgbWF4X2NvZGU7ICAgICAgICAgICAgICAvKiBsYXJnZXN0IGNvZGUgd2l0aCBub24gemVybyBmcmVxdWVuY3kgKi9cbi8vICAgIHVzaGYgKmJsX2NvdW50OyAgICAgICAgICAgIC8qIG51bWJlciBvZiBjb2RlcyBhdCBlYWNoIGJpdCBsZW5ndGggKi9cbntcbiAgdmFyIG5leHRfY29kZSA9IG5ldyBBcnJheShNQVhfQklUUyArIDEpOyAvKiBuZXh0IGNvZGUgdmFsdWUgZm9yIGVhY2ggYml0IGxlbmd0aCAqL1xuICB2YXIgY29kZSA9IDA7ICAgICAgICAgICAgICAvKiBydW5uaW5nIGNvZGUgdmFsdWUgKi9cbiAgdmFyIGJpdHM7ICAgICAgICAgICAgICAgICAgLyogYml0IGluZGV4ICovXG4gIHZhciBuOyAgICAgICAgICAgICAgICAgICAgIC8qIGNvZGUgaW5kZXggKi9cblxuICAvKiBUaGUgZGlzdHJpYnV0aW9uIGNvdW50cyBhcmUgZmlyc3QgdXNlZCB0byBnZW5lcmF0ZSB0aGUgY29kZSB2YWx1ZXNcbiAgICogd2l0aG91dCBiaXQgcmV2ZXJzYWwuXG4gICAqL1xuICBmb3IgKGJpdHMgPSAxOyBiaXRzIDw9IE1BWF9CSVRTOyBiaXRzKyspIHtcbiAgICBuZXh0X2NvZGVbYml0c10gPSBjb2RlID0gKGNvZGUgKyBibF9jb3VudFtiaXRzIC0gMV0pIDw8IDE7XG4gIH1cbiAgLyogQ2hlY2sgdGhhdCB0aGUgYml0IGNvdW50cyBpbiBibF9jb3VudCBhcmUgY29uc2lzdGVudC4gVGhlIGxhc3QgY29kZVxuICAgKiBtdXN0IGJlIGFsbCBvbmVzLlxuICAgKi9cbiAgLy9Bc3NlcnQgKGNvZGUgKyBibF9jb3VudFtNQVhfQklUU10tMSA9PSAoMTw8TUFYX0JJVFMpLTEsXG4gIC8vICAgICAgICBcImluY29uc2lzdGVudCBiaXQgY291bnRzXCIpO1xuICAvL1RyYWNldigoc3RkZXJyLFwiXFxuZ2VuX2NvZGVzOiBtYXhfY29kZSAlZCBcIiwgbWF4X2NvZGUpKTtcblxuICBmb3IgKG4gPSAwOyAgbiA8PSBtYXhfY29kZTsgbisrKSB7XG4gICAgdmFyIGxlbiA9IHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovO1xuICAgIGlmIChsZW4gPT09IDApIHsgY29udGludWU7IH1cbiAgICAvKiBOb3cgcmV2ZXJzZSB0aGUgYml0cyAqL1xuICAgIHRyZWVbbiAqIDJdLyouQ29kZSovID0gYmlfcmV2ZXJzZShuZXh0X2NvZGVbbGVuXSsrLCBsZW4pO1xuXG4gICAgLy9UcmFjZWN2KHRyZWUgIT0gc3RhdGljX2x0cmVlLCAoc3RkZXJyLFwiXFxubiAlM2QgJWMgbCAlMmQgYyAlNHggKCV4KSBcIixcbiAgICAvLyAgICAgbiwgKGlzZ3JhcGgobikgPyBuIDogJyAnKSwgbGVuLCB0cmVlW25dLkNvZGUsIG5leHRfY29kZVtsZW5dLTEpKTtcbiAgfVxufVxuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW5pdGlhbGl6ZSB0aGUgdmFyaW91cyAnY29uc3RhbnQnIHRhYmxlcy5cbiAqL1xuZnVuY3Rpb24gdHJfc3RhdGljX2luaXQoKSB7XG4gIHZhciBuOyAgICAgICAgLyogaXRlcmF0ZXMgb3ZlciB0cmVlIGVsZW1lbnRzICovXG4gIHZhciBiaXRzOyAgICAgLyogYml0IGNvdW50ZXIgKi9cbiAgdmFyIGxlbmd0aDsgICAvKiBsZW5ndGggdmFsdWUgKi9cbiAgdmFyIGNvZGU7ICAgICAvKiBjb2RlIHZhbHVlICovXG4gIHZhciBkaXN0OyAgICAgLyogZGlzdGFuY2UgaW5kZXggKi9cbiAgdmFyIGJsX2NvdW50ID0gbmV3IEFycmF5KE1BWF9CSVRTICsgMSk7XG4gIC8qIG51bWJlciBvZiBjb2RlcyBhdCBlYWNoIGJpdCBsZW5ndGggZm9yIGFuIG9wdGltYWwgdHJlZSAqL1xuXG4gIC8vIGRvIGNoZWNrIGluIF90cl9pbml0KClcbiAgLy9pZiAoc3RhdGljX2luaXRfZG9uZSkgcmV0dXJuO1xuXG4gIC8qIEZvciBzb21lIGVtYmVkZGVkIHRhcmdldHMsIGdsb2JhbCB2YXJpYWJsZXMgYXJlIG5vdCBpbml0aWFsaXplZDogKi9cbi8qI2lmZGVmIE5PX0lOSVRfR0xPQkFMX1BPSU5URVJTXG4gIHN0YXRpY19sX2Rlc2Muc3RhdGljX3RyZWUgPSBzdGF0aWNfbHRyZWU7XG4gIHN0YXRpY19sX2Rlc2MuZXh0cmFfYml0cyA9IGV4dHJhX2xiaXRzO1xuICBzdGF0aWNfZF9kZXNjLnN0YXRpY190cmVlID0gc3RhdGljX2R0cmVlO1xuICBzdGF0aWNfZF9kZXNjLmV4dHJhX2JpdHMgPSBleHRyYV9kYml0cztcbiAgc3RhdGljX2JsX2Rlc2MuZXh0cmFfYml0cyA9IGV4dHJhX2JsYml0cztcbiNlbmRpZiovXG5cbiAgLyogSW5pdGlhbGl6ZSB0aGUgbWFwcGluZyBsZW5ndGggKDAuLjI1NSkgLT4gbGVuZ3RoIGNvZGUgKDAuLjI4KSAqL1xuICBsZW5ndGggPSAwO1xuICBmb3IgKGNvZGUgPSAwOyBjb2RlIDwgTEVOR1RIX0NPREVTIC0gMTsgY29kZSsrKSB7XG4gICAgYmFzZV9sZW5ndGhbY29kZV0gPSBsZW5ndGg7XG4gICAgZm9yIChuID0gMDsgbiA8ICgxIDw8IGV4dHJhX2xiaXRzW2NvZGVdKTsgbisrKSB7XG4gICAgICBfbGVuZ3RoX2NvZGVbbGVuZ3RoKytdID0gY29kZTtcbiAgICB9XG4gIH1cbiAgLy9Bc3NlcnQgKGxlbmd0aCA9PSAyNTYsIFwidHJfc3RhdGljX2luaXQ6IGxlbmd0aCAhPSAyNTZcIik7XG4gIC8qIE5vdGUgdGhhdCB0aGUgbGVuZ3RoIDI1NSAobWF0Y2ggbGVuZ3RoIDI1OCkgY2FuIGJlIHJlcHJlc2VudGVkXG4gICAqIGluIHR3byBkaWZmZXJlbnQgd2F5czogY29kZSAyODQgKyA1IGJpdHMgb3IgY29kZSAyODUsIHNvIHdlXG4gICAqIG92ZXJ3cml0ZSBsZW5ndGhfY29kZVsyNTVdIHRvIHVzZSB0aGUgYmVzdCBlbmNvZGluZzpcbiAgICovXG4gIF9sZW5ndGhfY29kZVtsZW5ndGggLSAxXSA9IGNvZGU7XG5cbiAgLyogSW5pdGlhbGl6ZSB0aGUgbWFwcGluZyBkaXN0ICgwLi4zMkspIC0+IGRpc3QgY29kZSAoMC4uMjkpICovXG4gIGRpc3QgPSAwO1xuICBmb3IgKGNvZGUgPSAwOyBjb2RlIDwgMTY7IGNvZGUrKykge1xuICAgIGJhc2VfZGlzdFtjb2RlXSA9IGRpc3Q7XG4gICAgZm9yIChuID0gMDsgbiA8ICgxIDw8IGV4dHJhX2RiaXRzW2NvZGVdKTsgbisrKSB7XG4gICAgICBfZGlzdF9jb2RlW2Rpc3QrK10gPSBjb2RlO1xuICAgIH1cbiAgfVxuICAvL0Fzc2VydCAoZGlzdCA9PSAyNTYsIFwidHJfc3RhdGljX2luaXQ6IGRpc3QgIT0gMjU2XCIpO1xuICBkaXN0ID4+PSA3OyAvKiBmcm9tIG5vdyBvbiwgYWxsIGRpc3RhbmNlcyBhcmUgZGl2aWRlZCBieSAxMjggKi9cbiAgZm9yICg7IGNvZGUgPCBEX0NPREVTOyBjb2RlKyspIHtcbiAgICBiYXNlX2Rpc3RbY29kZV0gPSBkaXN0IDw8IDc7XG4gICAgZm9yIChuID0gMDsgbiA8ICgxIDw8IChleHRyYV9kYml0c1tjb2RlXSAtIDcpKTsgbisrKSB7XG4gICAgICBfZGlzdF9jb2RlWzI1NiArIGRpc3QrK10gPSBjb2RlO1xuICAgIH1cbiAgfVxuICAvL0Fzc2VydCAoZGlzdCA9PSAyNTYsIFwidHJfc3RhdGljX2luaXQ6IDI1NitkaXN0ICE9IDUxMlwiKTtcblxuICAvKiBDb25zdHJ1Y3QgdGhlIGNvZGVzIG9mIHRoZSBzdGF0aWMgbGl0ZXJhbCB0cmVlICovXG4gIGZvciAoYml0cyA9IDA7IGJpdHMgPD0gTUFYX0JJVFM7IGJpdHMrKykge1xuICAgIGJsX2NvdW50W2JpdHNdID0gMDtcbiAgfVxuXG4gIG4gPSAwO1xuICB3aGlsZSAobiA8PSAxNDMpIHtcbiAgICBzdGF0aWNfbHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gODtcbiAgICBuKys7XG4gICAgYmxfY291bnRbOF0rKztcbiAgfVxuICB3aGlsZSAobiA8PSAyNTUpIHtcbiAgICBzdGF0aWNfbHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gOTtcbiAgICBuKys7XG4gICAgYmxfY291bnRbOV0rKztcbiAgfVxuICB3aGlsZSAobiA8PSAyNzkpIHtcbiAgICBzdGF0aWNfbHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gNztcbiAgICBuKys7XG4gICAgYmxfY291bnRbN10rKztcbiAgfVxuICB3aGlsZSAobiA8PSAyODcpIHtcbiAgICBzdGF0aWNfbHRyZWVbbiAqIDIgKyAxXS8qLkxlbiovID0gODtcbiAgICBuKys7XG4gICAgYmxfY291bnRbOF0rKztcbiAgfVxuICAvKiBDb2RlcyAyODYgYW5kIDI4NyBkbyBub3QgZXhpc3QsIGJ1dCB3ZSBtdXN0IGluY2x1ZGUgdGhlbSBpbiB0aGVcbiAgICogdHJlZSBjb25zdHJ1Y3Rpb24gdG8gZ2V0IGEgY2Fub25pY2FsIEh1ZmZtYW4gdHJlZSAobG9uZ2VzdCBjb2RlXG4gICAqIGFsbCBvbmVzKVxuICAgKi9cbiAgZ2VuX2NvZGVzKHN0YXRpY19sdHJlZSwgTF9DT0RFUyArIDEsIGJsX2NvdW50KTtcblxuICAvKiBUaGUgc3RhdGljIGRpc3RhbmNlIHRyZWUgaXMgdHJpdmlhbDogKi9cbiAgZm9yIChuID0gMDsgbiA8IERfQ09ERVM7IG4rKykge1xuICAgIHN0YXRpY19kdHJlZVtuICogMiArIDFdLyouTGVuKi8gPSA1O1xuICAgIHN0YXRpY19kdHJlZVtuICogMl0vKi5Db2RlKi8gPSBiaV9yZXZlcnNlKG4sIDUpO1xuICB9XG5cbiAgLy8gTm93IGRhdGEgcmVhZHkgYW5kIHdlIGNhbiBpbml0IHN0YXRpYyB0cmVlc1xuICBzdGF0aWNfbF9kZXNjID0gbmV3IFN0YXRpY1RyZWVEZXNjKHN0YXRpY19sdHJlZSwgZXh0cmFfbGJpdHMsIExJVEVSQUxTICsgMSwgTF9DT0RFUywgTUFYX0JJVFMpO1xuICBzdGF0aWNfZF9kZXNjID0gbmV3IFN0YXRpY1RyZWVEZXNjKHN0YXRpY19kdHJlZSwgZXh0cmFfZGJpdHMsIDAsICAgICAgICAgIERfQ09ERVMsIE1BWF9CSVRTKTtcbiAgc3RhdGljX2JsX2Rlc2MgPSBuZXcgU3RhdGljVHJlZURlc2MobmV3IEFycmF5KDApLCBleHRyYV9ibGJpdHMsIDAsICAgICAgICAgQkxfQ09ERVMsIE1BWF9CTF9CSVRTKTtcblxuICAvL3N0YXRpY19pbml0X2RvbmUgPSB0cnVlO1xufVxuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW5pdGlhbGl6ZSBhIG5ldyBibG9jay5cbiAqL1xuZnVuY3Rpb24gaW5pdF9ibG9jayhzKSB7XG4gIHZhciBuOyAvKiBpdGVyYXRlcyBvdmVyIHRyZWUgZWxlbWVudHMgKi9cblxuICAvKiBJbml0aWFsaXplIHRoZSB0cmVlcy4gKi9cbiAgZm9yIChuID0gMDsgbiA8IExfQ09ERVM7ICBuKyspIHsgcy5keW5fbHRyZWVbbiAqIDJdLyouRnJlcSovID0gMDsgfVxuICBmb3IgKG4gPSAwOyBuIDwgRF9DT0RFUzsgIG4rKykgeyBzLmR5bl9kdHJlZVtuICogMl0vKi5GcmVxKi8gPSAwOyB9XG4gIGZvciAobiA9IDA7IG4gPCBCTF9DT0RFUzsgbisrKSB7IHMuYmxfdHJlZVtuICogMl0vKi5GcmVxKi8gPSAwOyB9XG5cbiAgcy5keW5fbHRyZWVbRU5EX0JMT0NLICogMl0vKi5GcmVxKi8gPSAxO1xuICBzLm9wdF9sZW4gPSBzLnN0YXRpY19sZW4gPSAwO1xuICBzLmxhc3RfbGl0ID0gcy5tYXRjaGVzID0gMDtcbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIEZsdXNoIHRoZSBiaXQgYnVmZmVyIGFuZCBhbGlnbiB0aGUgb3V0cHV0IG9uIGEgYnl0ZSBib3VuZGFyeVxuICovXG5mdW5jdGlvbiBiaV93aW5kdXAocylcbntcbiAgaWYgKHMuYmlfdmFsaWQgPiA4KSB7XG4gICAgcHV0X3Nob3J0KHMsIHMuYmlfYnVmKTtcbiAgfSBlbHNlIGlmIChzLmJpX3ZhbGlkID4gMCkge1xuICAgIC8vcHV0X2J5dGUocywgKEJ5dGUpcy0+YmlfYnVmKTtcbiAgICBzLnBlbmRpbmdfYnVmW3MucGVuZGluZysrXSA9IHMuYmlfYnVmO1xuICB9XG4gIHMuYmlfYnVmID0gMDtcbiAgcy5iaV92YWxpZCA9IDA7XG59XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ29weSBhIHN0b3JlZCBibG9jaywgc3RvcmluZyBmaXJzdCB0aGUgbGVuZ3RoIGFuZCBpdHNcbiAqIG9uZSdzIGNvbXBsZW1lbnQgaWYgcmVxdWVzdGVkLlxuICovXG5mdW5jdGlvbiBjb3B5X2Jsb2NrKHMsIGJ1ZiwgbGVuLCBoZWFkZXIpXG4vL0RlZmxhdGVTdGF0ZSAqcztcbi8vY2hhcmYgICAgKmJ1ZjsgICAgLyogdGhlIGlucHV0IGRhdGEgKi9cbi8vdW5zaWduZWQgbGVuOyAgICAgLyogaXRzIGxlbmd0aCAqL1xuLy9pbnQgICAgICBoZWFkZXI7ICAvKiB0cnVlIGlmIGJsb2NrIGhlYWRlciBtdXN0IGJlIHdyaXR0ZW4gKi9cbntcbiAgYmlfd2luZHVwKHMpOyAgICAgICAgLyogYWxpZ24gb24gYnl0ZSBib3VuZGFyeSAqL1xuXG4gIGlmIChoZWFkZXIpIHtcbiAgICBwdXRfc2hvcnQocywgbGVuKTtcbiAgICBwdXRfc2hvcnQocywgfmxlbik7XG4gIH1cbi8vICB3aGlsZSAobGVuLS0pIHtcbi8vICAgIHB1dF9ieXRlKHMsICpidWYrKyk7XG4vLyAgfVxuICB1dGlscy5hcnJheVNldChzLnBlbmRpbmdfYnVmLCBzLndpbmRvdywgYnVmLCBsZW4sIHMucGVuZGluZyk7XG4gIHMucGVuZGluZyArPSBsZW47XG59XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogQ29tcGFyZXMgdG8gc3VidHJlZXMsIHVzaW5nIHRoZSB0cmVlIGRlcHRoIGFzIHRpZSBicmVha2VyIHdoZW5cbiAqIHRoZSBzdWJ0cmVlcyBoYXZlIGVxdWFsIGZyZXF1ZW5jeS4gVGhpcyBtaW5pbWl6ZXMgdGhlIHdvcnN0IGNhc2UgbGVuZ3RoLlxuICovXG5mdW5jdGlvbiBzbWFsbGVyKHRyZWUsIG4sIG0sIGRlcHRoKSB7XG4gIHZhciBfbjIgPSBuICogMjtcbiAgdmFyIF9tMiA9IG0gKiAyO1xuICByZXR1cm4gKHRyZWVbX24yXS8qLkZyZXEqLyA8IHRyZWVbX20yXS8qLkZyZXEqLyB8fFxuICAgICAgICAgKHRyZWVbX24yXS8qLkZyZXEqLyA9PT0gdHJlZVtfbTJdLyouRnJlcSovICYmIGRlcHRoW25dIDw9IGRlcHRoW21dKSk7XG59XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogUmVzdG9yZSB0aGUgaGVhcCBwcm9wZXJ0eSBieSBtb3ZpbmcgZG93biB0aGUgdHJlZSBzdGFydGluZyBhdCBub2RlIGssXG4gKiBleGNoYW5naW5nIGEgbm9kZSB3aXRoIHRoZSBzbWFsbGVzdCBvZiBpdHMgdHdvIHNvbnMgaWYgbmVjZXNzYXJ5LCBzdG9wcGluZ1xuICogd2hlbiB0aGUgaGVhcCBwcm9wZXJ0eSBpcyByZS1lc3RhYmxpc2hlZCAoZWFjaCBmYXRoZXIgc21hbGxlciB0aGFuIGl0c1xuICogdHdvIHNvbnMpLlxuICovXG5mdW5jdGlvbiBwcWRvd25oZWFwKHMsIHRyZWUsIGspXG4vLyAgICBkZWZsYXRlX3N0YXRlICpzO1xuLy8gICAgY3RfZGF0YSAqdHJlZTsgIC8qIHRoZSB0cmVlIHRvIHJlc3RvcmUgKi9cbi8vICAgIGludCBrOyAgICAgICAgICAgICAgIC8qIG5vZGUgdG8gbW92ZSBkb3duICovXG57XG4gIHZhciB2ID0gcy5oZWFwW2tdO1xuICB2YXIgaiA9IGsgPDwgMTsgIC8qIGxlZnQgc29uIG9mIGsgKi9cbiAgd2hpbGUgKGogPD0gcy5oZWFwX2xlbikge1xuICAgIC8qIFNldCBqIHRvIHRoZSBzbWFsbGVzdCBvZiB0aGUgdHdvIHNvbnM6ICovXG4gICAgaWYgKGogPCBzLmhlYXBfbGVuICYmXG4gICAgICBzbWFsbGVyKHRyZWUsIHMuaGVhcFtqICsgMV0sIHMuaGVhcFtqXSwgcy5kZXB0aCkpIHtcbiAgICAgIGorKztcbiAgICB9XG4gICAgLyogRXhpdCBpZiB2IGlzIHNtYWxsZXIgdGhhbiBib3RoIHNvbnMgKi9cbiAgICBpZiAoc21hbGxlcih0cmVlLCB2LCBzLmhlYXBbal0sIHMuZGVwdGgpKSB7IGJyZWFrOyB9XG5cbiAgICAvKiBFeGNoYW5nZSB2IHdpdGggdGhlIHNtYWxsZXN0IHNvbiAqL1xuICAgIHMuaGVhcFtrXSA9IHMuaGVhcFtqXTtcbiAgICBrID0gajtcblxuICAgIC8qIEFuZCBjb250aW51ZSBkb3duIHRoZSB0cmVlLCBzZXR0aW5nIGogdG8gdGhlIGxlZnQgc29uIG9mIGsgKi9cbiAgICBqIDw8PSAxO1xuICB9XG4gIHMuaGVhcFtrXSA9IHY7XG59XG5cblxuLy8gaW5saW5lZCBtYW51YWxseVxuLy8gdmFyIFNNQUxMRVNUID0gMTtcblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZW5kIHRoZSBibG9jayBkYXRhIGNvbXByZXNzZWQgdXNpbmcgdGhlIGdpdmVuIEh1ZmZtYW4gdHJlZXNcbiAqL1xuZnVuY3Rpb24gY29tcHJlc3NfYmxvY2socywgbHRyZWUsIGR0cmVlKVxuLy8gICAgZGVmbGF0ZV9zdGF0ZSAqcztcbi8vICAgIGNvbnN0IGN0X2RhdGEgKmx0cmVlOyAvKiBsaXRlcmFsIHRyZWUgKi9cbi8vICAgIGNvbnN0IGN0X2RhdGEgKmR0cmVlOyAvKiBkaXN0YW5jZSB0cmVlICovXG57XG4gIHZhciBkaXN0OyAgICAgICAgICAgLyogZGlzdGFuY2Ugb2YgbWF0Y2hlZCBzdHJpbmcgKi9cbiAgdmFyIGxjOyAgICAgICAgICAgICAvKiBtYXRjaCBsZW5ndGggb3IgdW5tYXRjaGVkIGNoYXIgKGlmIGRpc3QgPT0gMCkgKi9cbiAgdmFyIGx4ID0gMDsgICAgICAgICAvKiBydW5uaW5nIGluZGV4IGluIGxfYnVmICovXG4gIHZhciBjb2RlOyAgICAgICAgICAgLyogdGhlIGNvZGUgdG8gc2VuZCAqL1xuICB2YXIgZXh0cmE7ICAgICAgICAgIC8qIG51bWJlciBvZiBleHRyYSBiaXRzIHRvIHNlbmQgKi9cblxuICBpZiAocy5sYXN0X2xpdCAhPT0gMCkge1xuICAgIGRvIHtcbiAgICAgIGRpc3QgPSAocy5wZW5kaW5nX2J1ZltzLmRfYnVmICsgbHggKiAyXSA8PCA4KSB8IChzLnBlbmRpbmdfYnVmW3MuZF9idWYgKyBseCAqIDIgKyAxXSk7XG4gICAgICBsYyA9IHMucGVuZGluZ19idWZbcy5sX2J1ZiArIGx4XTtcbiAgICAgIGx4Kys7XG5cbiAgICAgIGlmIChkaXN0ID09PSAwKSB7XG4gICAgICAgIHNlbmRfY29kZShzLCBsYywgbHRyZWUpOyAvKiBzZW5kIGEgbGl0ZXJhbCBieXRlICovXG4gICAgICAgIC8vVHJhY2Vjdihpc2dyYXBoKGxjKSwgKHN0ZGVycixcIiAnJWMnIFwiLCBsYykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLyogSGVyZSwgbGMgaXMgdGhlIG1hdGNoIGxlbmd0aCAtIE1JTl9NQVRDSCAqL1xuICAgICAgICBjb2RlID0gX2xlbmd0aF9jb2RlW2xjXTtcbiAgICAgICAgc2VuZF9jb2RlKHMsIGNvZGUgKyBMSVRFUkFMUyArIDEsIGx0cmVlKTsgLyogc2VuZCB0aGUgbGVuZ3RoIGNvZGUgKi9cbiAgICAgICAgZXh0cmEgPSBleHRyYV9sYml0c1tjb2RlXTtcbiAgICAgICAgaWYgKGV4dHJhICE9PSAwKSB7XG4gICAgICAgICAgbGMgLT0gYmFzZV9sZW5ndGhbY29kZV07XG4gICAgICAgICAgc2VuZF9iaXRzKHMsIGxjLCBleHRyYSk7ICAgICAgIC8qIHNlbmQgdGhlIGV4dHJhIGxlbmd0aCBiaXRzICovXG4gICAgICAgIH1cbiAgICAgICAgZGlzdC0tOyAvKiBkaXN0IGlzIG5vdyB0aGUgbWF0Y2ggZGlzdGFuY2UgLSAxICovXG4gICAgICAgIGNvZGUgPSBkX2NvZGUoZGlzdCk7XG4gICAgICAgIC8vQXNzZXJ0IChjb2RlIDwgRF9DT0RFUywgXCJiYWQgZF9jb2RlXCIpO1xuXG4gICAgICAgIHNlbmRfY29kZShzLCBjb2RlLCBkdHJlZSk7ICAgICAgIC8qIHNlbmQgdGhlIGRpc3RhbmNlIGNvZGUgKi9cbiAgICAgICAgZXh0cmEgPSBleHRyYV9kYml0c1tjb2RlXTtcbiAgICAgICAgaWYgKGV4dHJhICE9PSAwKSB7XG4gICAgICAgICAgZGlzdCAtPSBiYXNlX2Rpc3RbY29kZV07XG4gICAgICAgICAgc2VuZF9iaXRzKHMsIGRpc3QsIGV4dHJhKTsgICAvKiBzZW5kIHRoZSBleHRyYSBkaXN0YW5jZSBiaXRzICovXG4gICAgICAgIH1cbiAgICAgIH0gLyogbGl0ZXJhbCBvciBtYXRjaCBwYWlyID8gKi9cblxuICAgICAgLyogQ2hlY2sgdGhhdCB0aGUgb3ZlcmxheSBiZXR3ZWVuIHBlbmRpbmdfYnVmIGFuZCBkX2J1ZitsX2J1ZiBpcyBvazogKi9cbiAgICAgIC8vQXNzZXJ0KCh1SW50KShzLT5wZW5kaW5nKSA8IHMtPmxpdF9idWZzaXplICsgMipseCxcbiAgICAgIC8vICAgICAgIFwicGVuZGluZ0J1ZiBvdmVyZmxvd1wiKTtcblxuICAgIH0gd2hpbGUgKGx4IDwgcy5sYXN0X2xpdCk7XG4gIH1cblxuICBzZW5kX2NvZGUocywgRU5EX0JMT0NLLCBsdHJlZSk7XG59XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBDb25zdHJ1Y3Qgb25lIEh1ZmZtYW4gdHJlZSBhbmQgYXNzaWducyB0aGUgY29kZSBiaXQgc3RyaW5ncyBhbmQgbGVuZ3Rocy5cbiAqIFVwZGF0ZSB0aGUgdG90YWwgYml0IGxlbmd0aCBmb3IgdGhlIGN1cnJlbnQgYmxvY2suXG4gKiBJTiBhc3NlcnRpb246IHRoZSBmaWVsZCBmcmVxIGlzIHNldCBmb3IgYWxsIHRyZWUgZWxlbWVudHMuXG4gKiBPVVQgYXNzZXJ0aW9uczogdGhlIGZpZWxkcyBsZW4gYW5kIGNvZGUgYXJlIHNldCB0byB0aGUgb3B0aW1hbCBiaXQgbGVuZ3RoXG4gKiAgICAgYW5kIGNvcnJlc3BvbmRpbmcgY29kZS4gVGhlIGxlbmd0aCBvcHRfbGVuIGlzIHVwZGF0ZWQ7IHN0YXRpY19sZW4gaXNcbiAqICAgICBhbHNvIHVwZGF0ZWQgaWYgc3RyZWUgaXMgbm90IG51bGwuIFRoZSBmaWVsZCBtYXhfY29kZSBpcyBzZXQuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkX3RyZWUocywgZGVzYylcbi8vICAgIGRlZmxhdGVfc3RhdGUgKnM7XG4vLyAgICB0cmVlX2Rlc2MgKmRlc2M7IC8qIHRoZSB0cmVlIGRlc2NyaXB0b3IgKi9cbntcbiAgdmFyIHRyZWUgICAgID0gZGVzYy5keW5fdHJlZTtcbiAgdmFyIHN0cmVlICAgID0gZGVzYy5zdGF0X2Rlc2Muc3RhdGljX3RyZWU7XG4gIHZhciBoYXNfc3RyZWUgPSBkZXNjLnN0YXRfZGVzYy5oYXNfc3RyZWU7XG4gIHZhciBlbGVtcyAgICA9IGRlc2Muc3RhdF9kZXNjLmVsZW1zO1xuICB2YXIgbiwgbTsgICAgICAgICAgLyogaXRlcmF0ZSBvdmVyIGhlYXAgZWxlbWVudHMgKi9cbiAgdmFyIG1heF9jb2RlID0gLTE7IC8qIGxhcmdlc3QgY29kZSB3aXRoIG5vbiB6ZXJvIGZyZXF1ZW5jeSAqL1xuICB2YXIgbm9kZTsgICAgICAgICAgLyogbmV3IG5vZGUgYmVpbmcgY3JlYXRlZCAqL1xuXG4gIC8qIENvbnN0cnVjdCB0aGUgaW5pdGlhbCBoZWFwLCB3aXRoIGxlYXN0IGZyZXF1ZW50IGVsZW1lbnQgaW5cbiAgICogaGVhcFtTTUFMTEVTVF0uIFRoZSBzb25zIG9mIGhlYXBbbl0gYXJlIGhlYXBbMipuXSBhbmQgaGVhcFsyKm4rMV0uXG4gICAqIGhlYXBbMF0gaXMgbm90IHVzZWQuXG4gICAqL1xuICBzLmhlYXBfbGVuID0gMDtcbiAgcy5oZWFwX21heCA9IEhFQVBfU0laRTtcblxuICBmb3IgKG4gPSAwOyBuIDwgZWxlbXM7IG4rKykge1xuICAgIGlmICh0cmVlW24gKiAyXS8qLkZyZXEqLyAhPT0gMCkge1xuICAgICAgcy5oZWFwWysrcy5oZWFwX2xlbl0gPSBtYXhfY29kZSA9IG47XG4gICAgICBzLmRlcHRoW25dID0gMDtcblxuICAgIH0gZWxzZSB7XG4gICAgICB0cmVlW24gKiAyICsgMV0vKi5MZW4qLyA9IDA7XG4gICAgfVxuICB9XG5cbiAgLyogVGhlIHBremlwIGZvcm1hdCByZXF1aXJlcyB0aGF0IGF0IGxlYXN0IG9uZSBkaXN0YW5jZSBjb2RlIGV4aXN0cyxcbiAgICogYW5kIHRoYXQgYXQgbGVhc3Qgb25lIGJpdCBzaG91bGQgYmUgc2VudCBldmVuIGlmIHRoZXJlIGlzIG9ubHkgb25lXG4gICAqIHBvc3NpYmxlIGNvZGUuIFNvIHRvIGF2b2lkIHNwZWNpYWwgY2hlY2tzIGxhdGVyIG9uIHdlIGZvcmNlIGF0IGxlYXN0XG4gICAqIHR3byBjb2RlcyBvZiBub24gemVybyBmcmVxdWVuY3kuXG4gICAqL1xuICB3aGlsZSAocy5oZWFwX2xlbiA8IDIpIHtcbiAgICBub2RlID0gcy5oZWFwWysrcy5oZWFwX2xlbl0gPSAobWF4X2NvZGUgPCAyID8gKyttYXhfY29kZSA6IDApO1xuICAgIHRyZWVbbm9kZSAqIDJdLyouRnJlcSovID0gMTtcbiAgICBzLmRlcHRoW25vZGVdID0gMDtcbiAgICBzLm9wdF9sZW4tLTtcblxuICAgIGlmIChoYXNfc3RyZWUpIHtcbiAgICAgIHMuc3RhdGljX2xlbiAtPSBzdHJlZVtub2RlICogMiArIDFdLyouTGVuKi87XG4gICAgfVxuICAgIC8qIG5vZGUgaXMgMCBvciAxIHNvIGl0IGRvZXMgbm90IGhhdmUgZXh0cmEgYml0cyAqL1xuICB9XG4gIGRlc2MubWF4X2NvZGUgPSBtYXhfY29kZTtcblxuICAvKiBUaGUgZWxlbWVudHMgaGVhcFtoZWFwX2xlbi8yKzEgLi4gaGVhcF9sZW5dIGFyZSBsZWF2ZXMgb2YgdGhlIHRyZWUsXG4gICAqIGVzdGFibGlzaCBzdWItaGVhcHMgb2YgaW5jcmVhc2luZyBsZW5ndGhzOlxuICAgKi9cbiAgZm9yIChuID0gKHMuaGVhcF9sZW4gPj4gMS8qaW50IC8yKi8pOyBuID49IDE7IG4tLSkgeyBwcWRvd25oZWFwKHMsIHRyZWUsIG4pOyB9XG5cbiAgLyogQ29uc3RydWN0IHRoZSBIdWZmbWFuIHRyZWUgYnkgcmVwZWF0ZWRseSBjb21iaW5pbmcgdGhlIGxlYXN0IHR3b1xuICAgKiBmcmVxdWVudCBub2Rlcy5cbiAgICovXG4gIG5vZGUgPSBlbGVtczsgICAgICAgICAgICAgIC8qIG5leHQgaW50ZXJuYWwgbm9kZSBvZiB0aGUgdHJlZSAqL1xuICBkbyB7XG4gICAgLy9wcXJlbW92ZShzLCB0cmVlLCBuKTsgIC8qIG4gPSBub2RlIG9mIGxlYXN0IGZyZXF1ZW5jeSAqL1xuICAgIC8qKiogcHFyZW1vdmUgKioqL1xuICAgIG4gPSBzLmhlYXBbMS8qU01BTExFU1QqL107XG4gICAgcy5oZWFwWzEvKlNNQUxMRVNUKi9dID0gcy5oZWFwW3MuaGVhcF9sZW4tLV07XG4gICAgcHFkb3duaGVhcChzLCB0cmVlLCAxLypTTUFMTEVTVCovKTtcbiAgICAvKioqL1xuXG4gICAgbSA9IHMuaGVhcFsxLypTTUFMTEVTVCovXTsgLyogbSA9IG5vZGUgb2YgbmV4dCBsZWFzdCBmcmVxdWVuY3kgKi9cblxuICAgIHMuaGVhcFstLXMuaGVhcF9tYXhdID0gbjsgLyoga2VlcCB0aGUgbm9kZXMgc29ydGVkIGJ5IGZyZXF1ZW5jeSAqL1xuICAgIHMuaGVhcFstLXMuaGVhcF9tYXhdID0gbTtcblxuICAgIC8qIENyZWF0ZSBhIG5ldyBub2RlIGZhdGhlciBvZiBuIGFuZCBtICovXG4gICAgdHJlZVtub2RlICogMl0vKi5GcmVxKi8gPSB0cmVlW24gKiAyXS8qLkZyZXEqLyArIHRyZWVbbSAqIDJdLyouRnJlcSovO1xuICAgIHMuZGVwdGhbbm9kZV0gPSAocy5kZXB0aFtuXSA+PSBzLmRlcHRoW21dID8gcy5kZXB0aFtuXSA6IHMuZGVwdGhbbV0pICsgMTtcbiAgICB0cmVlW24gKiAyICsgMV0vKi5EYWQqLyA9IHRyZWVbbSAqIDIgKyAxXS8qLkRhZCovID0gbm9kZTtcblxuICAgIC8qIGFuZCBpbnNlcnQgdGhlIG5ldyBub2RlIGluIHRoZSBoZWFwICovXG4gICAgcy5oZWFwWzEvKlNNQUxMRVNUKi9dID0gbm9kZSsrO1xuICAgIHBxZG93bmhlYXAocywgdHJlZSwgMS8qU01BTExFU1QqLyk7XG5cbiAgfSB3aGlsZSAocy5oZWFwX2xlbiA+PSAyKTtcblxuICBzLmhlYXBbLS1zLmhlYXBfbWF4XSA9IHMuaGVhcFsxLypTTUFMTEVTVCovXTtcblxuICAvKiBBdCB0aGlzIHBvaW50LCB0aGUgZmllbGRzIGZyZXEgYW5kIGRhZCBhcmUgc2V0LiBXZSBjYW4gbm93XG4gICAqIGdlbmVyYXRlIHRoZSBiaXQgbGVuZ3Rocy5cbiAgICovXG4gIGdlbl9iaXRsZW4ocywgZGVzYyk7XG5cbiAgLyogVGhlIGZpZWxkIGxlbiBpcyBub3cgc2V0LCB3ZSBjYW4gZ2VuZXJhdGUgdGhlIGJpdCBjb2RlcyAqL1xuICBnZW5fY29kZXModHJlZSwgbWF4X2NvZGUsIHMuYmxfY291bnQpO1xufVxuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2NhbiBhIGxpdGVyYWwgb3IgZGlzdGFuY2UgdHJlZSB0byBkZXRlcm1pbmUgdGhlIGZyZXF1ZW5jaWVzIG9mIHRoZSBjb2Rlc1xuICogaW4gdGhlIGJpdCBsZW5ndGggdHJlZS5cbiAqL1xuZnVuY3Rpb24gc2Nhbl90cmVlKHMsIHRyZWUsIG1heF9jb2RlKVxuLy8gICAgZGVmbGF0ZV9zdGF0ZSAqcztcbi8vICAgIGN0X2RhdGEgKnRyZWU7ICAgLyogdGhlIHRyZWUgdG8gYmUgc2Nhbm5lZCAqL1xuLy8gICAgaW50IG1heF9jb2RlOyAgICAvKiBhbmQgaXRzIGxhcmdlc3QgY29kZSBvZiBub24gemVybyBmcmVxdWVuY3kgKi9cbntcbiAgdmFyIG47ICAgICAgICAgICAgICAgICAgICAgLyogaXRlcmF0ZXMgb3ZlciBhbGwgdHJlZSBlbGVtZW50cyAqL1xuICB2YXIgcHJldmxlbiA9IC0xOyAgICAgICAgICAvKiBsYXN0IGVtaXR0ZWQgbGVuZ3RoICovXG4gIHZhciBjdXJsZW47ICAgICAgICAgICAgICAgIC8qIGxlbmd0aCBvZiBjdXJyZW50IGNvZGUgKi9cblxuICB2YXIgbmV4dGxlbiA9IHRyZWVbMCAqIDIgKyAxXS8qLkxlbiovOyAvKiBsZW5ndGggb2YgbmV4dCBjb2RlICovXG5cbiAgdmFyIGNvdW50ID0gMDsgICAgICAgICAgICAgLyogcmVwZWF0IGNvdW50IG9mIHRoZSBjdXJyZW50IGNvZGUgKi9cbiAgdmFyIG1heF9jb3VudCA9IDc7ICAgICAgICAgLyogbWF4IHJlcGVhdCBjb3VudCAqL1xuICB2YXIgbWluX2NvdW50ID0gNDsgICAgICAgICAvKiBtaW4gcmVwZWF0IGNvdW50ICovXG5cbiAgaWYgKG5leHRsZW4gPT09IDApIHtcbiAgICBtYXhfY291bnQgPSAxMzg7XG4gICAgbWluX2NvdW50ID0gMztcbiAgfVxuICB0cmVlWyhtYXhfY29kZSArIDEpICogMiArIDFdLyouTGVuKi8gPSAweGZmZmY7IC8qIGd1YXJkICovXG5cbiAgZm9yIChuID0gMDsgbiA8PSBtYXhfY29kZTsgbisrKSB7XG4gICAgY3VybGVuID0gbmV4dGxlbjtcbiAgICBuZXh0bGVuID0gdHJlZVsobiArIDEpICogMiArIDFdLyouTGVuKi87XG5cbiAgICBpZiAoKytjb3VudCA8IG1heF9jb3VudCAmJiBjdXJsZW4gPT09IG5leHRsZW4pIHtcbiAgICAgIGNvbnRpbnVlO1xuXG4gICAgfSBlbHNlIGlmIChjb3VudCA8IG1pbl9jb3VudCkge1xuICAgICAgcy5ibF90cmVlW2N1cmxlbiAqIDJdLyouRnJlcSovICs9IGNvdW50O1xuXG4gICAgfSBlbHNlIGlmIChjdXJsZW4gIT09IDApIHtcblxuICAgICAgaWYgKGN1cmxlbiAhPT0gcHJldmxlbikgeyBzLmJsX3RyZWVbY3VybGVuICogMl0vKi5GcmVxKi8rKzsgfVxuICAgICAgcy5ibF90cmVlW1JFUF8zXzYgKiAyXS8qLkZyZXEqLysrO1xuXG4gICAgfSBlbHNlIGlmIChjb3VudCA8PSAxMCkge1xuICAgICAgcy5ibF90cmVlW1JFUFpfM18xMCAqIDJdLyouRnJlcSovKys7XG5cbiAgICB9IGVsc2Uge1xuICAgICAgcy5ibF90cmVlW1JFUFpfMTFfMTM4ICogMl0vKi5GcmVxKi8rKztcbiAgICB9XG5cbiAgICBjb3VudCA9IDA7XG4gICAgcHJldmxlbiA9IGN1cmxlbjtcblxuICAgIGlmIChuZXh0bGVuID09PSAwKSB7XG4gICAgICBtYXhfY291bnQgPSAxMzg7XG4gICAgICBtaW5fY291bnQgPSAzO1xuXG4gICAgfSBlbHNlIGlmIChjdXJsZW4gPT09IG5leHRsZW4pIHtcbiAgICAgIG1heF9jb3VudCA9IDY7XG4gICAgICBtaW5fY291bnQgPSAzO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIG1heF9jb3VudCA9IDc7XG4gICAgICBtaW5fY291bnQgPSA0O1xuICAgIH1cbiAgfVxufVxuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogU2VuZCBhIGxpdGVyYWwgb3IgZGlzdGFuY2UgdHJlZSBpbiBjb21wcmVzc2VkIGZvcm0sIHVzaW5nIHRoZSBjb2RlcyBpblxuICogYmxfdHJlZS5cbiAqL1xuZnVuY3Rpb24gc2VuZF90cmVlKHMsIHRyZWUsIG1heF9jb2RlKVxuLy8gICAgZGVmbGF0ZV9zdGF0ZSAqcztcbi8vICAgIGN0X2RhdGEgKnRyZWU7IC8qIHRoZSB0cmVlIHRvIGJlIHNjYW5uZWQgKi9cbi8vICAgIGludCBtYXhfY29kZTsgICAgICAgLyogYW5kIGl0cyBsYXJnZXN0IGNvZGUgb2Ygbm9uIHplcm8gZnJlcXVlbmN5ICovXG57XG4gIHZhciBuOyAgICAgICAgICAgICAgICAgICAgIC8qIGl0ZXJhdGVzIG92ZXIgYWxsIHRyZWUgZWxlbWVudHMgKi9cbiAgdmFyIHByZXZsZW4gPSAtMTsgICAgICAgICAgLyogbGFzdCBlbWl0dGVkIGxlbmd0aCAqL1xuICB2YXIgY3VybGVuOyAgICAgICAgICAgICAgICAvKiBsZW5ndGggb2YgY3VycmVudCBjb2RlICovXG5cbiAgdmFyIG5leHRsZW4gPSB0cmVlWzAgKiAyICsgMV0vKi5MZW4qLzsgLyogbGVuZ3RoIG9mIG5leHQgY29kZSAqL1xuXG4gIHZhciBjb3VudCA9IDA7ICAgICAgICAgICAgIC8qIHJlcGVhdCBjb3VudCBvZiB0aGUgY3VycmVudCBjb2RlICovXG4gIHZhciBtYXhfY291bnQgPSA3OyAgICAgICAgIC8qIG1heCByZXBlYXQgY291bnQgKi9cbiAgdmFyIG1pbl9jb3VudCA9IDQ7ICAgICAgICAgLyogbWluIHJlcGVhdCBjb3VudCAqL1xuXG4gIC8qIHRyZWVbbWF4X2NvZGUrMV0uTGVuID0gLTE7ICovICAvKiBndWFyZCBhbHJlYWR5IHNldCAqL1xuICBpZiAobmV4dGxlbiA9PT0gMCkge1xuICAgIG1heF9jb3VudCA9IDEzODtcbiAgICBtaW5fY291bnQgPSAzO1xuICB9XG5cbiAgZm9yIChuID0gMDsgbiA8PSBtYXhfY29kZTsgbisrKSB7XG4gICAgY3VybGVuID0gbmV4dGxlbjtcbiAgICBuZXh0bGVuID0gdHJlZVsobiArIDEpICogMiArIDFdLyouTGVuKi87XG5cbiAgICBpZiAoKytjb3VudCA8IG1heF9jb3VudCAmJiBjdXJsZW4gPT09IG5leHRsZW4pIHtcbiAgICAgIGNvbnRpbnVlO1xuXG4gICAgfSBlbHNlIGlmIChjb3VudCA8IG1pbl9jb3VudCkge1xuICAgICAgZG8geyBzZW5kX2NvZGUocywgY3VybGVuLCBzLmJsX3RyZWUpOyB9IHdoaWxlICgtLWNvdW50ICE9PSAwKTtcblxuICAgIH0gZWxzZSBpZiAoY3VybGVuICE9PSAwKSB7XG4gICAgICBpZiAoY3VybGVuICE9PSBwcmV2bGVuKSB7XG4gICAgICAgIHNlbmRfY29kZShzLCBjdXJsZW4sIHMuYmxfdHJlZSk7XG4gICAgICAgIGNvdW50LS07XG4gICAgICB9XG4gICAgICAvL0Fzc2VydChjb3VudCA+PSAzICYmIGNvdW50IDw9IDYsIFwiIDNfNj9cIik7XG4gICAgICBzZW5kX2NvZGUocywgUkVQXzNfNiwgcy5ibF90cmVlKTtcbiAgICAgIHNlbmRfYml0cyhzLCBjb3VudCAtIDMsIDIpO1xuXG4gICAgfSBlbHNlIGlmIChjb3VudCA8PSAxMCkge1xuICAgICAgc2VuZF9jb2RlKHMsIFJFUFpfM18xMCwgcy5ibF90cmVlKTtcbiAgICAgIHNlbmRfYml0cyhzLCBjb3VudCAtIDMsIDMpO1xuXG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbmRfY29kZShzLCBSRVBaXzExXzEzOCwgcy5ibF90cmVlKTtcbiAgICAgIHNlbmRfYml0cyhzLCBjb3VudCAtIDExLCA3KTtcbiAgICB9XG5cbiAgICBjb3VudCA9IDA7XG4gICAgcHJldmxlbiA9IGN1cmxlbjtcbiAgICBpZiAobmV4dGxlbiA9PT0gMCkge1xuICAgICAgbWF4X2NvdW50ID0gMTM4O1xuICAgICAgbWluX2NvdW50ID0gMztcblxuICAgIH0gZWxzZSBpZiAoY3VybGVuID09PSBuZXh0bGVuKSB7XG4gICAgICBtYXhfY291bnQgPSA2O1xuICAgICAgbWluX2NvdW50ID0gMztcblxuICAgIH0gZWxzZSB7XG4gICAgICBtYXhfY291bnQgPSA3O1xuICAgICAgbWluX2NvdW50ID0gNDtcbiAgICB9XG4gIH1cbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIENvbnN0cnVjdCB0aGUgSHVmZm1hbiB0cmVlIGZvciB0aGUgYml0IGxlbmd0aHMgYW5kIHJldHVybiB0aGUgaW5kZXggaW5cbiAqIGJsX29yZGVyIG9mIHRoZSBsYXN0IGJpdCBsZW5ndGggY29kZSB0byBzZW5kLlxuICovXG5mdW5jdGlvbiBidWlsZF9ibF90cmVlKHMpIHtcbiAgdmFyIG1heF9ibGluZGV4OyAgLyogaW5kZXggb2YgbGFzdCBiaXQgbGVuZ3RoIGNvZGUgb2Ygbm9uIHplcm8gZnJlcSAqL1xuXG4gIC8qIERldGVybWluZSB0aGUgYml0IGxlbmd0aCBmcmVxdWVuY2llcyBmb3IgbGl0ZXJhbCBhbmQgZGlzdGFuY2UgdHJlZXMgKi9cbiAgc2Nhbl90cmVlKHMsIHMuZHluX2x0cmVlLCBzLmxfZGVzYy5tYXhfY29kZSk7XG4gIHNjYW5fdHJlZShzLCBzLmR5bl9kdHJlZSwgcy5kX2Rlc2MubWF4X2NvZGUpO1xuXG4gIC8qIEJ1aWxkIHRoZSBiaXQgbGVuZ3RoIHRyZWU6ICovXG4gIGJ1aWxkX3RyZWUocywgcy5ibF9kZXNjKTtcbiAgLyogb3B0X2xlbiBub3cgaW5jbHVkZXMgdGhlIGxlbmd0aCBvZiB0aGUgdHJlZSByZXByZXNlbnRhdGlvbnMsIGV4Y2VwdFxuICAgKiB0aGUgbGVuZ3RocyBvZiB0aGUgYml0IGxlbmd0aHMgY29kZXMgYW5kIHRoZSA1KzUrNCBiaXRzIGZvciB0aGUgY291bnRzLlxuICAgKi9cblxuICAvKiBEZXRlcm1pbmUgdGhlIG51bWJlciBvZiBiaXQgbGVuZ3RoIGNvZGVzIHRvIHNlbmQuIFRoZSBwa3ppcCBmb3JtYXRcbiAgICogcmVxdWlyZXMgdGhhdCBhdCBsZWFzdCA0IGJpdCBsZW5ndGggY29kZXMgYmUgc2VudC4gKGFwcG5vdGUudHh0IHNheXNcbiAgICogMyBidXQgdGhlIGFjdHVhbCB2YWx1ZSB1c2VkIGlzIDQuKVxuICAgKi9cbiAgZm9yIChtYXhfYmxpbmRleCA9IEJMX0NPREVTIC0gMTsgbWF4X2JsaW5kZXggPj0gMzsgbWF4X2JsaW5kZXgtLSkge1xuICAgIGlmIChzLmJsX3RyZWVbYmxfb3JkZXJbbWF4X2JsaW5kZXhdICogMiArIDFdLyouTGVuKi8gIT09IDApIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuICAvKiBVcGRhdGUgb3B0X2xlbiB0byBpbmNsdWRlIHRoZSBiaXQgbGVuZ3RoIHRyZWUgYW5kIGNvdW50cyAqL1xuICBzLm9wdF9sZW4gKz0gMyAqIChtYXhfYmxpbmRleCArIDEpICsgNSArIDUgKyA0O1xuICAvL1RyYWNldigoc3RkZXJyLCBcIlxcbmR5biB0cmVlczogZHluICVsZCwgc3RhdCAlbGRcIixcbiAgLy8gICAgICAgIHMtPm9wdF9sZW4sIHMtPnN0YXRpY19sZW4pKTtcblxuICByZXR1cm4gbWF4X2JsaW5kZXg7XG59XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZW5kIHRoZSBoZWFkZXIgZm9yIGEgYmxvY2sgdXNpbmcgZHluYW1pYyBIdWZmbWFuIHRyZWVzOiB0aGUgY291bnRzLCB0aGVcbiAqIGxlbmd0aHMgb2YgdGhlIGJpdCBsZW5ndGggY29kZXMsIHRoZSBsaXRlcmFsIHRyZWUgYW5kIHRoZSBkaXN0YW5jZSB0cmVlLlxuICogSU4gYXNzZXJ0aW9uOiBsY29kZXMgPj0gMjU3LCBkY29kZXMgPj0gMSwgYmxjb2RlcyA+PSA0LlxuICovXG5mdW5jdGlvbiBzZW5kX2FsbF90cmVlcyhzLCBsY29kZXMsIGRjb2RlcywgYmxjb2Rlcylcbi8vICAgIGRlZmxhdGVfc3RhdGUgKnM7XG4vLyAgICBpbnQgbGNvZGVzLCBkY29kZXMsIGJsY29kZXM7IC8qIG51bWJlciBvZiBjb2RlcyBmb3IgZWFjaCB0cmVlICovXG57XG4gIHZhciByYW5rOyAgICAgICAgICAgICAgICAgICAgLyogaW5kZXggaW4gYmxfb3JkZXIgKi9cblxuICAvL0Fzc2VydCAobGNvZGVzID49IDI1NyAmJiBkY29kZXMgPj0gMSAmJiBibGNvZGVzID49IDQsIFwibm90IGVub3VnaCBjb2Rlc1wiKTtcbiAgLy9Bc3NlcnQgKGxjb2RlcyA8PSBMX0NPREVTICYmIGRjb2RlcyA8PSBEX0NPREVTICYmIGJsY29kZXMgPD0gQkxfQ09ERVMsXG4gIC8vICAgICAgICBcInRvbyBtYW55IGNvZGVzXCIpO1xuICAvL1RyYWNldigoc3RkZXJyLCBcIlxcbmJsIGNvdW50czogXCIpKTtcbiAgc2VuZF9iaXRzKHMsIGxjb2RlcyAtIDI1NywgNSk7IC8qIG5vdCArMjU1IGFzIHN0YXRlZCBpbiBhcHBub3RlLnR4dCAqL1xuICBzZW5kX2JpdHMocywgZGNvZGVzIC0gMSwgICA1KTtcbiAgc2VuZF9iaXRzKHMsIGJsY29kZXMgLSA0LCAgNCk7IC8qIG5vdCAtMyBhcyBzdGF0ZWQgaW4gYXBwbm90ZS50eHQgKi9cbiAgZm9yIChyYW5rID0gMDsgcmFuayA8IGJsY29kZXM7IHJhbmsrKykge1xuICAgIC8vVHJhY2V2KChzdGRlcnIsIFwiXFxuYmwgY29kZSAlMmQgXCIsIGJsX29yZGVyW3JhbmtdKSk7XG4gICAgc2VuZF9iaXRzKHMsIHMuYmxfdHJlZVtibF9vcmRlcltyYW5rXSAqIDIgKyAxXS8qLkxlbiovLCAzKTtcbiAgfVxuICAvL1RyYWNldigoc3RkZXJyLCBcIlxcbmJsIHRyZWU6IHNlbnQgJWxkXCIsIHMtPmJpdHNfc2VudCkpO1xuXG4gIHNlbmRfdHJlZShzLCBzLmR5bl9sdHJlZSwgbGNvZGVzIC0gMSk7IC8qIGxpdGVyYWwgdHJlZSAqL1xuICAvL1RyYWNldigoc3RkZXJyLCBcIlxcbmxpdCB0cmVlOiBzZW50ICVsZFwiLCBzLT5iaXRzX3NlbnQpKTtcblxuICBzZW5kX3RyZWUocywgcy5keW5fZHRyZWUsIGRjb2RlcyAtIDEpOyAvKiBkaXN0YW5jZSB0cmVlICovXG4gIC8vVHJhY2V2KChzdGRlcnIsIFwiXFxuZGlzdCB0cmVlOiBzZW50ICVsZFwiLCBzLT5iaXRzX3NlbnQpKTtcbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIENoZWNrIGlmIHRoZSBkYXRhIHR5cGUgaXMgVEVYVCBvciBCSU5BUlksIHVzaW5nIHRoZSBmb2xsb3dpbmcgYWxnb3JpdGhtOlxuICogLSBURVhUIGlmIHRoZSB0d28gY29uZGl0aW9ucyBiZWxvdyBhcmUgc2F0aXNmaWVkOlxuICogICAgYSkgVGhlcmUgYXJlIG5vIG5vbi1wb3J0YWJsZSBjb250cm9sIGNoYXJhY3RlcnMgYmVsb25naW5nIHRvIHRoZVxuICogICAgICAgXCJibGFjayBsaXN0XCIgKDAuLjYsIDE0Li4yNSwgMjguLjMxKS5cbiAqICAgIGIpIFRoZXJlIGlzIGF0IGxlYXN0IG9uZSBwcmludGFibGUgY2hhcmFjdGVyIGJlbG9uZ2luZyB0byB0aGVcbiAqICAgICAgIFwid2hpdGUgbGlzdFwiICg5IHtUQUJ9LCAxMCB7TEZ9LCAxMyB7Q1J9LCAzMi4uMjU1KS5cbiAqIC0gQklOQVJZIG90aGVyd2lzZS5cbiAqIC0gVGhlIGZvbGxvd2luZyBwYXJ0aWFsbHktcG9ydGFibGUgY29udHJvbCBjaGFyYWN0ZXJzIGZvcm0gYVxuICogICBcImdyYXkgbGlzdFwiIHRoYXQgaXMgaWdub3JlZCBpbiB0aGlzIGRldGVjdGlvbiBhbGdvcml0aG06XG4gKiAgICg3IHtCRUx9LCA4IHtCU30sIDExIHtWVH0sIDEyIHtGRn0sIDI2IHtTVUJ9LCAyNyB7RVNDfSkuXG4gKiBJTiBhc3NlcnRpb246IHRoZSBmaWVsZHMgRnJlcSBvZiBkeW5fbHRyZWUgYXJlIHNldC5cbiAqL1xuZnVuY3Rpb24gZGV0ZWN0X2RhdGFfdHlwZShzKSB7XG4gIC8qIGJsYWNrX21hc2sgaXMgdGhlIGJpdCBtYXNrIG9mIGJsYWNrLWxpc3RlZCBieXRlc1xuICAgKiBzZXQgYml0cyAwLi42LCAxNC4uMjUsIGFuZCAyOC4uMzFcbiAgICogMHhmM2ZmYzA3ZiA9IGJpbmFyeSAxMTExMDAxMTExMTExMTExMTEwMDAwMDAwMTExMTExMVxuICAgKi9cbiAgdmFyIGJsYWNrX21hc2sgPSAweGYzZmZjMDdmO1xuICB2YXIgbjtcblxuICAvKiBDaGVjayBmb3Igbm9uLXRleHR1YWwgKFwiYmxhY2stbGlzdGVkXCIpIGJ5dGVzLiAqL1xuICBmb3IgKG4gPSAwOyBuIDw9IDMxOyBuKyssIGJsYWNrX21hc2sgPj4+PSAxKSB7XG4gICAgaWYgKChibGFja19tYXNrICYgMSkgJiYgKHMuZHluX2x0cmVlW24gKiAyXS8qLkZyZXEqLyAhPT0gMCkpIHtcbiAgICAgIHJldHVybiBaX0JJTkFSWTtcbiAgICB9XG4gIH1cblxuICAvKiBDaGVjayBmb3IgdGV4dHVhbCAoXCJ3aGl0ZS1saXN0ZWRcIikgYnl0ZXMuICovXG4gIGlmIChzLmR5bl9sdHJlZVs5ICogMl0vKi5GcmVxKi8gIT09IDAgfHwgcy5keW5fbHRyZWVbMTAgKiAyXS8qLkZyZXEqLyAhPT0gMCB8fFxuICAgICAgcy5keW5fbHRyZWVbMTMgKiAyXS8qLkZyZXEqLyAhPT0gMCkge1xuICAgIHJldHVybiBaX1RFWFQ7XG4gIH1cbiAgZm9yIChuID0gMzI7IG4gPCBMSVRFUkFMUzsgbisrKSB7XG4gICAgaWYgKHMuZHluX2x0cmVlW24gKiAyXS8qLkZyZXEqLyAhPT0gMCkge1xuICAgICAgcmV0dXJuIFpfVEVYVDtcbiAgICB9XG4gIH1cblxuICAvKiBUaGVyZSBhcmUgbm8gXCJibGFjay1saXN0ZWRcIiBvciBcIndoaXRlLWxpc3RlZFwiIGJ5dGVzOlxuICAgKiB0aGlzIHN0cmVhbSBlaXRoZXIgaXMgZW1wdHkgb3IgaGFzIHRvbGVyYXRlZCAoXCJncmF5LWxpc3RlZFwiKSBieXRlcyBvbmx5LlxuICAgKi9cbiAgcmV0dXJuIFpfQklOQVJZO1xufVxuXG5cbnZhciBzdGF0aWNfaW5pdF9kb25lID0gZmFsc2U7XG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogSW5pdGlhbGl6ZSB0aGUgdHJlZSBkYXRhIHN0cnVjdHVyZXMgZm9yIGEgbmV3IHpsaWIgc3RyZWFtLlxuICovXG5mdW5jdGlvbiBfdHJfaW5pdChzKVxue1xuXG4gIGlmICghc3RhdGljX2luaXRfZG9uZSkge1xuICAgIHRyX3N0YXRpY19pbml0KCk7XG4gICAgc3RhdGljX2luaXRfZG9uZSA9IHRydWU7XG4gIH1cblxuICBzLmxfZGVzYyAgPSBuZXcgVHJlZURlc2Mocy5keW5fbHRyZWUsIHN0YXRpY19sX2Rlc2MpO1xuICBzLmRfZGVzYyAgPSBuZXcgVHJlZURlc2Mocy5keW5fZHRyZWUsIHN0YXRpY19kX2Rlc2MpO1xuICBzLmJsX2Rlc2MgPSBuZXcgVHJlZURlc2Mocy5ibF90cmVlLCBzdGF0aWNfYmxfZGVzYyk7XG5cbiAgcy5iaV9idWYgPSAwO1xuICBzLmJpX3ZhbGlkID0gMDtcblxuICAvKiBJbml0aWFsaXplIHRoZSBmaXJzdCBibG9jayBvZiB0aGUgZmlyc3QgZmlsZTogKi9cbiAgaW5pdF9ibG9jayhzKTtcbn1cblxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNlbmQgYSBzdG9yZWQgYmxvY2tcbiAqL1xuZnVuY3Rpb24gX3RyX3N0b3JlZF9ibG9jayhzLCBidWYsIHN0b3JlZF9sZW4sIGxhc3QpXG4vL0RlZmxhdGVTdGF0ZSAqcztcbi8vY2hhcmYgKmJ1ZjsgICAgICAgLyogaW5wdXQgYmxvY2sgKi9cbi8vdWxnIHN0b3JlZF9sZW47ICAgLyogbGVuZ3RoIG9mIGlucHV0IGJsb2NrICovXG4vL2ludCBsYXN0OyAgICAgICAgIC8qIG9uZSBpZiB0aGlzIGlzIHRoZSBsYXN0IGJsb2NrIGZvciBhIGZpbGUgKi9cbntcbiAgc2VuZF9iaXRzKHMsIChTVE9SRURfQkxPQ0sgPDwgMSkgKyAobGFzdCA/IDEgOiAwKSwgMyk7ICAgIC8qIHNlbmQgYmxvY2sgdHlwZSAqL1xuICBjb3B5X2Jsb2NrKHMsIGJ1Ziwgc3RvcmVkX2xlbiwgdHJ1ZSk7IC8qIHdpdGggaGVhZGVyICovXG59XG5cblxuLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gKiBTZW5kIG9uZSBlbXB0eSBzdGF0aWMgYmxvY2sgdG8gZ2l2ZSBlbm91Z2ggbG9va2FoZWFkIGZvciBpbmZsYXRlLlxuICogVGhpcyB0YWtlcyAxMCBiaXRzLCBvZiB3aGljaCA3IG1heSByZW1haW4gaW4gdGhlIGJpdCBidWZmZXIuXG4gKi9cbmZ1bmN0aW9uIF90cl9hbGlnbihzKSB7XG4gIHNlbmRfYml0cyhzLCBTVEFUSUNfVFJFRVMgPDwgMSwgMyk7XG4gIHNlbmRfY29kZShzLCBFTkRfQkxPQ0ssIHN0YXRpY19sdHJlZSk7XG4gIGJpX2ZsdXNoKHMpO1xufVxuXG5cbi8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICogRGV0ZXJtaW5lIHRoZSBiZXN0IGVuY29kaW5nIGZvciB0aGUgY3VycmVudCBibG9jazogZHluYW1pYyB0cmVlcywgc3RhdGljXG4gKiB0cmVlcyBvciBzdG9yZSwgYW5kIG91dHB1dCB0aGUgZW5jb2RlZCBibG9jayB0byB0aGUgemlwIGZpbGUuXG4gKi9cbmZ1bmN0aW9uIF90cl9mbHVzaF9ibG9jayhzLCBidWYsIHN0b3JlZF9sZW4sIGxhc3QpXG4vL0RlZmxhdGVTdGF0ZSAqcztcbi8vY2hhcmYgKmJ1ZjsgICAgICAgLyogaW5wdXQgYmxvY2ssIG9yIE5VTEwgaWYgdG9vIG9sZCAqL1xuLy91bGcgc3RvcmVkX2xlbjsgICAvKiBsZW5ndGggb2YgaW5wdXQgYmxvY2sgKi9cbi8vaW50IGxhc3Q7ICAgICAgICAgLyogb25lIGlmIHRoaXMgaXMgdGhlIGxhc3QgYmxvY2sgZm9yIGEgZmlsZSAqL1xue1xuICB2YXIgb3B0X2xlbmIsIHN0YXRpY19sZW5iOyAgLyogb3B0X2xlbiBhbmQgc3RhdGljX2xlbiBpbiBieXRlcyAqL1xuICB2YXIgbWF4X2JsaW5kZXggPSAwOyAgICAgICAgLyogaW5kZXggb2YgbGFzdCBiaXQgbGVuZ3RoIGNvZGUgb2Ygbm9uIHplcm8gZnJlcSAqL1xuXG4gIC8qIEJ1aWxkIHRoZSBIdWZmbWFuIHRyZWVzIHVubGVzcyBhIHN0b3JlZCBibG9jayBpcyBmb3JjZWQgKi9cbiAgaWYgKHMubGV2ZWwgPiAwKSB7XG5cbiAgICAvKiBDaGVjayBpZiB0aGUgZmlsZSBpcyBiaW5hcnkgb3IgdGV4dCAqL1xuICAgIGlmIChzLnN0cm0uZGF0YV90eXBlID09PSBaX1VOS05PV04pIHtcbiAgICAgIHMuc3RybS5kYXRhX3R5cGUgPSBkZXRlY3RfZGF0YV90eXBlKHMpO1xuICAgIH1cblxuICAgIC8qIENvbnN0cnVjdCB0aGUgbGl0ZXJhbCBhbmQgZGlzdGFuY2UgdHJlZXMgKi9cbiAgICBidWlsZF90cmVlKHMsIHMubF9kZXNjKTtcbiAgICAvLyBUcmFjZXYoKHN0ZGVyciwgXCJcXG5saXQgZGF0YTogZHluICVsZCwgc3RhdCAlbGRcIiwgcy0+b3B0X2xlbixcbiAgICAvLyAgICAgICAgcy0+c3RhdGljX2xlbikpO1xuXG4gICAgYnVpbGRfdHJlZShzLCBzLmRfZGVzYyk7XG4gICAgLy8gVHJhY2V2KChzdGRlcnIsIFwiXFxuZGlzdCBkYXRhOiBkeW4gJWxkLCBzdGF0ICVsZFwiLCBzLT5vcHRfbGVuLFxuICAgIC8vICAgICAgICBzLT5zdGF0aWNfbGVuKSk7XG4gICAgLyogQXQgdGhpcyBwb2ludCwgb3B0X2xlbiBhbmQgc3RhdGljX2xlbiBhcmUgdGhlIHRvdGFsIGJpdCBsZW5ndGhzIG9mXG4gICAgICogdGhlIGNvbXByZXNzZWQgYmxvY2sgZGF0YSwgZXhjbHVkaW5nIHRoZSB0cmVlIHJlcHJlc2VudGF0aW9ucy5cbiAgICAgKi9cblxuICAgIC8qIEJ1aWxkIHRoZSBiaXQgbGVuZ3RoIHRyZWUgZm9yIHRoZSBhYm92ZSB0d28gdHJlZXMsIGFuZCBnZXQgdGhlIGluZGV4XG4gICAgICogaW4gYmxfb3JkZXIgb2YgdGhlIGxhc3QgYml0IGxlbmd0aCBjb2RlIHRvIHNlbmQuXG4gICAgICovXG4gICAgbWF4X2JsaW5kZXggPSBidWlsZF9ibF90cmVlKHMpO1xuXG4gICAgLyogRGV0ZXJtaW5lIHRoZSBiZXN0IGVuY29kaW5nLiBDb21wdXRlIHRoZSBibG9jayBsZW5ndGhzIGluIGJ5dGVzLiAqL1xuICAgIG9wdF9sZW5iID0gKHMub3B0X2xlbiArIDMgKyA3KSA+Pj4gMztcbiAgICBzdGF0aWNfbGVuYiA9IChzLnN0YXRpY19sZW4gKyAzICsgNykgPj4+IDM7XG5cbiAgICAvLyBUcmFjZXYoKHN0ZGVyciwgXCJcXG5vcHQgJWx1KCVsdSkgc3RhdCAlbHUoJWx1KSBzdG9yZWQgJWx1IGxpdCAldSBcIixcbiAgICAvLyAgICAgICAgb3B0X2xlbmIsIHMtPm9wdF9sZW4sIHN0YXRpY19sZW5iLCBzLT5zdGF0aWNfbGVuLCBzdG9yZWRfbGVuLFxuICAgIC8vICAgICAgICBzLT5sYXN0X2xpdCkpO1xuXG4gICAgaWYgKHN0YXRpY19sZW5iIDw9IG9wdF9sZW5iKSB7IG9wdF9sZW5iID0gc3RhdGljX2xlbmI7IH1cblxuICB9IGVsc2Uge1xuICAgIC8vIEFzc2VydChidWYgIT0gKGNoYXIqKTAsIFwibG9zdCBidWZcIik7XG4gICAgb3B0X2xlbmIgPSBzdGF0aWNfbGVuYiA9IHN0b3JlZF9sZW4gKyA1OyAvKiBmb3JjZSBhIHN0b3JlZCBibG9jayAqL1xuICB9XG5cbiAgaWYgKChzdG9yZWRfbGVuICsgNCA8PSBvcHRfbGVuYikgJiYgKGJ1ZiAhPT0gLTEpKSB7XG4gICAgLyogNDogdHdvIHdvcmRzIGZvciB0aGUgbGVuZ3RocyAqL1xuXG4gICAgLyogVGhlIHRlc3QgYnVmICE9IE5VTEwgaXMgb25seSBuZWNlc3NhcnkgaWYgTElUX0JVRlNJWkUgPiBXU0laRS5cbiAgICAgKiBPdGhlcndpc2Ugd2UgY2FuJ3QgaGF2ZSBwcm9jZXNzZWQgbW9yZSB0aGFuIFdTSVpFIGlucHV0IGJ5dGVzIHNpbmNlXG4gICAgICogdGhlIGxhc3QgYmxvY2sgZmx1c2gsIGJlY2F1c2UgY29tcHJlc3Npb24gd291bGQgaGF2ZSBiZWVuXG4gICAgICogc3VjY2Vzc2Z1bC4gSWYgTElUX0JVRlNJWkUgPD0gV1NJWkUsIGl0IGlzIG5ldmVyIHRvbyBsYXRlIHRvXG4gICAgICogdHJhbnNmb3JtIGEgYmxvY2sgaW50byBhIHN0b3JlZCBibG9jay5cbiAgICAgKi9cbiAgICBfdHJfc3RvcmVkX2Jsb2NrKHMsIGJ1Ziwgc3RvcmVkX2xlbiwgbGFzdCk7XG5cbiAgfSBlbHNlIGlmIChzLnN0cmF0ZWd5ID09PSBaX0ZJWEVEIHx8IHN0YXRpY19sZW5iID09PSBvcHRfbGVuYikge1xuXG4gICAgc2VuZF9iaXRzKHMsIChTVEFUSUNfVFJFRVMgPDwgMSkgKyAobGFzdCA/IDEgOiAwKSwgMyk7XG4gICAgY29tcHJlc3NfYmxvY2socywgc3RhdGljX2x0cmVlLCBzdGF0aWNfZHRyZWUpO1xuXG4gIH0gZWxzZSB7XG4gICAgc2VuZF9iaXRzKHMsIChEWU5fVFJFRVMgPDwgMSkgKyAobGFzdCA/IDEgOiAwKSwgMyk7XG4gICAgc2VuZF9hbGxfdHJlZXMocywgcy5sX2Rlc2MubWF4X2NvZGUgKyAxLCBzLmRfZGVzYy5tYXhfY29kZSArIDEsIG1heF9ibGluZGV4ICsgMSk7XG4gICAgY29tcHJlc3NfYmxvY2socywgcy5keW5fbHRyZWUsIHMuZHluX2R0cmVlKTtcbiAgfVxuICAvLyBBc3NlcnQgKHMtPmNvbXByZXNzZWRfbGVuID09IHMtPmJpdHNfc2VudCwgXCJiYWQgY29tcHJlc3NlZCBzaXplXCIpO1xuICAvKiBUaGUgYWJvdmUgY2hlY2sgaXMgbWFkZSBtb2QgMl4zMiwgZm9yIGZpbGVzIGxhcmdlciB0aGFuIDUxMiBNQlxuICAgKiBhbmQgdUxvbmcgaW1wbGVtZW50ZWQgb24gMzIgYml0cy5cbiAgICovXG4gIGluaXRfYmxvY2socyk7XG5cbiAgaWYgKGxhc3QpIHtcbiAgICBiaV93aW5kdXAocyk7XG4gIH1cbiAgLy8gVHJhY2V2KChzdGRlcnIsXCJcXG5jb21wcmxlbiAlbHUoJWx1KSBcIiwgcy0+Y29tcHJlc3NlZF9sZW4+PjMsXG4gIC8vICAgICAgIHMtPmNvbXByZXNzZWRfbGVuLTcqbGFzdCkpO1xufVxuXG4vKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAqIFNhdmUgdGhlIG1hdGNoIGluZm8gYW5kIHRhbGx5IHRoZSBmcmVxdWVuY3kgY291bnRzLiBSZXR1cm4gdHJ1ZSBpZlxuICogdGhlIGN1cnJlbnQgYmxvY2sgbXVzdCBiZSBmbHVzaGVkLlxuICovXG5mdW5jdGlvbiBfdHJfdGFsbHkocywgZGlzdCwgbGMpXG4vLyAgICBkZWZsYXRlX3N0YXRlICpzO1xuLy8gICAgdW5zaWduZWQgZGlzdDsgIC8qIGRpc3RhbmNlIG9mIG1hdGNoZWQgc3RyaW5nICovXG4vLyAgICB1bnNpZ25lZCBsYzsgICAgLyogbWF0Y2ggbGVuZ3RoLU1JTl9NQVRDSCBvciB1bm1hdGNoZWQgY2hhciAoaWYgZGlzdD09MCkgKi9cbntcbiAgLy92YXIgb3V0X2xlbmd0aCwgaW5fbGVuZ3RoLCBkY29kZTtcblxuICBzLnBlbmRpbmdfYnVmW3MuZF9idWYgKyBzLmxhc3RfbGl0ICogMl0gICAgID0gKGRpc3QgPj4+IDgpICYgMHhmZjtcbiAgcy5wZW5kaW5nX2J1ZltzLmRfYnVmICsgcy5sYXN0X2xpdCAqIDIgKyAxXSA9IGRpc3QgJiAweGZmO1xuXG4gIHMucGVuZGluZ19idWZbcy5sX2J1ZiArIHMubGFzdF9saXRdID0gbGMgJiAweGZmO1xuICBzLmxhc3RfbGl0Kys7XG5cbiAgaWYgKGRpc3QgPT09IDApIHtcbiAgICAvKiBsYyBpcyB0aGUgdW5tYXRjaGVkIGNoYXIgKi9cbiAgICBzLmR5bl9sdHJlZVtsYyAqIDJdLyouRnJlcSovKys7XG4gIH0gZWxzZSB7XG4gICAgcy5tYXRjaGVzKys7XG4gICAgLyogSGVyZSwgbGMgaXMgdGhlIG1hdGNoIGxlbmd0aCAtIE1JTl9NQVRDSCAqL1xuICAgIGRpc3QtLTsgICAgICAgICAgICAgLyogZGlzdCA9IG1hdGNoIGRpc3RhbmNlIC0gMSAqL1xuICAgIC8vQXNzZXJ0KCh1c2gpZGlzdCA8ICh1c2gpTUFYX0RJU1QocykgJiZcbiAgICAvLyAgICAgICAodXNoKWxjIDw9ICh1c2gpKE1BWF9NQVRDSC1NSU5fTUFUQ0gpICYmXG4gICAgLy8gICAgICAgKHVzaClkX2NvZGUoZGlzdCkgPCAodXNoKURfQ09ERVMsICBcIl90cl90YWxseTogYmFkIG1hdGNoXCIpO1xuXG4gICAgcy5keW5fbHRyZWVbKF9sZW5ndGhfY29kZVtsY10gKyBMSVRFUkFMUyArIDEpICogMl0vKi5GcmVxKi8rKztcbiAgICBzLmR5bl9kdHJlZVtkX2NvZGUoZGlzdCkgKiAyXS8qLkZyZXEqLysrO1xuICB9XG5cbi8vICghKSBUaGlzIGJsb2NrIGlzIGRpc2FibGVkIGluIHpsaWIgZGVmYXVsdHMsXG4vLyBkb24ndCBlbmFibGUgaXQgZm9yIGJpbmFyeSBjb21wYXRpYmlsaXR5XG5cbi8vI2lmZGVmIFRSVU5DQVRFX0JMT0NLXG4vLyAgLyogVHJ5IHRvIGd1ZXNzIGlmIGl0IGlzIHByb2ZpdGFibGUgdG8gc3RvcCB0aGUgY3VycmVudCBibG9jayBoZXJlICovXG4vLyAgaWYgKChzLmxhc3RfbGl0ICYgMHgxZmZmKSA9PT0gMCAmJiBzLmxldmVsID4gMikge1xuLy8gICAgLyogQ29tcHV0ZSBhbiB1cHBlciBib3VuZCBmb3IgdGhlIGNvbXByZXNzZWQgbGVuZ3RoICovXG4vLyAgICBvdXRfbGVuZ3RoID0gcy5sYXN0X2xpdCo4O1xuLy8gICAgaW5fbGVuZ3RoID0gcy5zdHJzdGFydCAtIHMuYmxvY2tfc3RhcnQ7XG4vL1xuLy8gICAgZm9yIChkY29kZSA9IDA7IGRjb2RlIDwgRF9DT0RFUzsgZGNvZGUrKykge1xuLy8gICAgICBvdXRfbGVuZ3RoICs9IHMuZHluX2R0cmVlW2Rjb2RlKjJdLyouRnJlcSovICogKDUgKyBleHRyYV9kYml0c1tkY29kZV0pO1xuLy8gICAgfVxuLy8gICAgb3V0X2xlbmd0aCA+Pj49IDM7XG4vLyAgICAvL1RyYWNldigoc3RkZXJyLFwiXFxubGFzdF9saXQgJXUsIGluICVsZCwgb3V0IH4lbGQoJWxkJSUpIFwiLFxuLy8gICAgLy8gICAgICAgcy0+bGFzdF9saXQsIGluX2xlbmd0aCwgb3V0X2xlbmd0aCxcbi8vICAgIC8vICAgICAgIDEwMEwgLSBvdXRfbGVuZ3RoKjEwMEwvaW5fbGVuZ3RoKSk7XG4vLyAgICBpZiAocy5tYXRjaGVzIDwgKHMubGFzdF9saXQ+PjEpLyppbnQgLzIqLyAmJiBvdXRfbGVuZ3RoIDwgKGluX2xlbmd0aD4+MSkvKmludCAvMiovKSB7XG4vLyAgICAgIHJldHVybiB0cnVlO1xuLy8gICAgfVxuLy8gIH1cbi8vI2VuZGlmXG5cbiAgcmV0dXJuIChzLmxhc3RfbGl0ID09PSBzLmxpdF9idWZzaXplIC0gMSk7XG4gIC8qIFdlIGF2b2lkIGVxdWFsaXR5IHdpdGggbGl0X2J1ZnNpemUgYmVjYXVzZSBvZiB3cmFwYXJvdW5kIGF0IDY0S1xuICAgKiBvbiAxNiBiaXQgbWFjaGluZXMgYW5kIGJlY2F1c2Ugc3RvcmVkIGJsb2NrcyBhcmUgcmVzdHJpY3RlZCB0b1xuICAgKiA2NEstMSBieXRlcy5cbiAgICovXG59XG5cbmV4cG9ydHMuX3RyX2luaXQgID0gX3RyX2luaXQ7XG5leHBvcnRzLl90cl9zdG9yZWRfYmxvY2sgPSBfdHJfc3RvcmVkX2Jsb2NrO1xuZXhwb3J0cy5fdHJfZmx1c2hfYmxvY2sgID0gX3RyX2ZsdXNoX2Jsb2NrO1xuZXhwb3J0cy5fdHJfdGFsbHkgPSBfdHJfdGFsbHk7XG5leHBvcnRzLl90cl9hbGlnbiA9IF90cl9hbGlnbjtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gKEMpIDE5OTUtMjAxMyBKZWFuLWxvdXAgR2FpbGx5IGFuZCBNYXJrIEFkbGVyXG4vLyAoQykgMjAxNC0yMDE3IFZpdGFseSBQdXpyaW4gYW5kIEFuZHJleSBUdXBpdHNpblxuLy9cbi8vIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkXG4vLyB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXNcbi8vIGFyaXNpbmcgZnJvbSB0aGUgdXNlIG9mIHRoaXMgc29mdHdhcmUuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBncmFudGVkIHRvIGFueW9uZSB0byB1c2UgdGhpcyBzb2Z0d2FyZSBmb3IgYW55IHB1cnBvc2UsXG4vLyBpbmNsdWRpbmcgY29tbWVyY2lhbCBhcHBsaWNhdGlvbnMsIGFuZCB0byBhbHRlciBpdCBhbmQgcmVkaXN0cmlidXRlIGl0XG4vLyBmcmVlbHksIHN1YmplY3QgdG8gdGhlIGZvbGxvd2luZyByZXN0cmljdGlvbnM6XG4vL1xuLy8gMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3Rcbi8vICAgY2xhaW0gdGhhdCB5b3Ugd3JvdGUgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiBJZiB5b3UgdXNlIHRoaXMgc29mdHdhcmVcbi8vICAgaW4gYSBwcm9kdWN0LCBhbiBhY2tub3dsZWRnbWVudCBpbiB0aGUgcHJvZHVjdCBkb2N1bWVudGF0aW9uIHdvdWxkIGJlXG4vLyAgIGFwcHJlY2lhdGVkIGJ1dCBpcyBub3QgcmVxdWlyZWQuXG4vLyAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZVxuLy8gICBtaXNyZXByZXNlbnRlZCBhcyBiZWluZyB0aGUgb3JpZ2luYWwgc29mdHdhcmUuXG4vLyAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLlxuXG5mdW5jdGlvbiBaU3RyZWFtKCkge1xuICAvKiBuZXh0IGlucHV0IGJ5dGUgKi9cbiAgdGhpcy5pbnB1dCA9IG51bGw7IC8vIEpTIHNwZWNpZmljLCBiZWNhdXNlIHdlIGhhdmUgbm8gcG9pbnRlcnNcbiAgdGhpcy5uZXh0X2luID0gMDtcbiAgLyogbnVtYmVyIG9mIGJ5dGVzIGF2YWlsYWJsZSBhdCBpbnB1dCAqL1xuICB0aGlzLmF2YWlsX2luID0gMDtcbiAgLyogdG90YWwgbnVtYmVyIG9mIGlucHV0IGJ5dGVzIHJlYWQgc28gZmFyICovXG4gIHRoaXMudG90YWxfaW4gPSAwO1xuICAvKiBuZXh0IG91dHB1dCBieXRlIHNob3VsZCBiZSBwdXQgdGhlcmUgKi9cbiAgdGhpcy5vdXRwdXQgPSBudWxsOyAvLyBKUyBzcGVjaWZpYywgYmVjYXVzZSB3ZSBoYXZlIG5vIHBvaW50ZXJzXG4gIHRoaXMubmV4dF9vdXQgPSAwO1xuICAvKiByZW1haW5pbmcgZnJlZSBzcGFjZSBhdCBvdXRwdXQgKi9cbiAgdGhpcy5hdmFpbF9vdXQgPSAwO1xuICAvKiB0b3RhbCBudW1iZXIgb2YgYnl0ZXMgb3V0cHV0IHNvIGZhciAqL1xuICB0aGlzLnRvdGFsX291dCA9IDA7XG4gIC8qIGxhc3QgZXJyb3IgbWVzc2FnZSwgTlVMTCBpZiBubyBlcnJvciAqL1xuICB0aGlzLm1zZyA9ICcnLypaX05VTEwqLztcbiAgLyogbm90IHZpc2libGUgYnkgYXBwbGljYXRpb25zICovXG4gIHRoaXMuc3RhdGUgPSBudWxsO1xuICAvKiBiZXN0IGd1ZXNzIGFib3V0IHRoZSBkYXRhIHR5cGU6IGJpbmFyeSBvciB0ZXh0ICovXG4gIHRoaXMuZGF0YV90eXBlID0gMi8qWl9VTktOT1dOKi87XG4gIC8qIGFkbGVyMzIgdmFsdWUgb2YgdGhlIHVuY29tcHJlc3NlZCBkYXRhICovXG4gIHRoaXMuYWRsZXIgPSAwO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFpTdHJlYW07XG4iXX0=
