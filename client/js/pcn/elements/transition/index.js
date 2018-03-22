// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    $ = require('jquery'),
    joint = require('joint'),
    Base = require('../base').Base;

function ignore() { return undefined; }

exports.Transition = Base.extend({
    markup: require('./markup.svg'),

    defaults: joint.util.deepSupplement({
        type: 'pcn.Transition',
        size: {width: 40, height: 40},
        priority: 0,
        attrs: {
            '.': {magnet: 'passive'},
            '.pcn-transition-magnet-rect': {magnet: true, visibility: 'hidden'}
        }
    }, Base.prototype.defaults),

    magnetize: function () {
        this.attr({'.pcn-transition-magnet-rect': {visibility: 'visible'}});
    },

    demagnetize: function () {
        this.attr({'.pcn-transition-magnet-rect': {visibility: 'hidden'}});
    },

    rotatable: true,
    isContraint: true,
    fullyContained: true,
    requireEmbedding: false,
    containers: ['pcn.PlaceChart'],
    editable: function () {
        return _(Base.prototype.editable()).concat([
            {property: 'priority', name: 'Priority', type: 'number', integer: true},
        ]).value();
    },

    linkConnectionPoint: function (linkView, view, magnet, reference, targetBBox, targetAngle, defaultConnectionPoint) {
        ignore(linkView, view, magnet, reference, targetBBox, targetAngle);
        var bbox = this.getBBox({useModelGeometry: true});
        bbox = joint.g.rect(bbox.x + bbox.width * 3 / 8, bbox.y, bbox.width / 4, bbox.height);
        return defaultConnectionPoint(bbox);
    }
});
