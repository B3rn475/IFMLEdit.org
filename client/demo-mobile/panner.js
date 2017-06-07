// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var $ = require('jquery'),
    document = require('document'),
    window = require('window');

function Panner(options) {
    if (!(this instanceof Panner)) { return new Panner(options); }
    options = options || {};

    if (!options.el) { throw new Error('el option is mandatory'); }
    if ($(options.el).length === 0) { throw new Error('invalid el option'); }

    var el = $(options.el)[0],
        moved,
        removeHandlers,
        startClientX,
        startClientY,
        lastClientX,
        lastClientY;

    function mousemove(e) {
        if (e.buttons === 0) {
            document.body.style.pointerEvents = null;
            return removeHandlers();
        }
        if (!moved) {
            if (Math.abs(startClientX - e.clientX) + Math.abs(startClientY - e.clientY) > 10) {
                moved = true;
                document.body.style.pointerEvents = 'none';
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
            document.body.style.pointerEvents = null;
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
