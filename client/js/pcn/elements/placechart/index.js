// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    joint = require('joint'),
    Base = require('../base').Base;

function ignore() { return undefined; }

function fixCorners(bbox, point) {
    var left = Math.abs(bbox.origin().x - point.x) < 20,
        top = Math.abs(bbox.origin().y - point.y) < 20,
        right = Math.abs(bbox.corner().x - point.x) < 20,
        bottom = Math.abs(bbox.corner().y - point.y) < 20;
    if (top) {
        if (left) {
            return joint.g.ellipse(joint.g.point(bbox.origin().x + 20, bbox.origin().y + 20), 20, 20).intersectionWithLineFromCenterToPoint(point);
        }
        if (right) {
            return joint.g.ellipse(joint.g.point(bbox.corner().x - 20, bbox.origin().y + 20), 20, 20).intersectionWithLineFromCenterToPoint(point);
        }
    } else if (bottom) {
        if (left) {
            return joint.g.ellipse(joint.g.point(bbox.origin().x + 20, bbox.corner().y - 20), 20, 20).intersectionWithLineFromCenterToPoint(point);
        }
        if (right) {
            return joint.g.ellipse(joint.g.point(bbox.corner().x - 20, bbox.corner().y - 20), 20, 20).intersectionWithLineFromCenterToPoint(point);
        }
    }
    return point;
}

exports.PlaceChart = Base.extend({
    markup: require('./markup.svg'),

    defaults: joint.util.deepSupplement({
        type: 'pcn.PlaceChart',
        size: {width: 40, height: 40},
        tokens: 0,
        attrs: {
            '.': {marker: 'passive'},
            '.pcn-placechart-reference-rect' : {'follow-scale': 'auto'},
            '.pcn-placechart-background-rect': {
                'ref-x': 0,
                'ref-y': 0,
                'ref-width': 1,
                'ref-height': 1,
                ref: '.pcn-placechart-reference-rect'
            },
            '.pcn-placechart-magnet-rect': {
                magnet: true,
                visibility: 'hidden',
                'ref-x': 0,
                'ref-y': 0,
                'ref-width': 1,
                'ref-height': 1,
                ref: '.pcn-placechart-reference-rect'
            },
            '.tokens': {
                'ref-x': 0.5,
                'ref-y': 0.5,
                'y-alignment': 'middle',
                'x-alignment': 'middle',
                ref: '.pcn-placechart-reference-rect'
            },
            '.name': {
                ref: '.pcn-placechart-reference-rect'
            }
        }
    }, Base.prototype.defaults),

    minsize: {width: 40, height: 40},
    padding: {top: 10, right: 10, bottom: 10, left: 10},
    resizable: true,
    isContraint: true,
    fullyContained: true,
    containers: ['pcn.PlaceChart'],

    initialize: function () {
        Base.prototype.initialize.apply(this, arguments);
        this._tokensChanged();
        this.on('change:tokens', this._tokensChanged, this);
    },

    _tokensChanged: function () {
        var tokens = this.get('tokens') || 0;
        this.attr({'.tokens': {text: tokens > 0 ? tokens : ''}});
    },

    editable: function () {
        return _(Base.prototype.editable()).concat([
            {property: 'tokens', name: 'Tokens', type: 'number', integer: true, min: 0},
        ]).value();
    },

    magnetize: function () {
        this.attr({'.pcn-placechart-magnet-rect': {visibility: 'visible'}});
    },

    demagnetize: function () {
        this.attr({'.pcn-placechart-magnet-rect': {visibility: 'hidden'}});
    },

    linkConnectionPoint: function (linkView, view, magnet, reference, targetBBox, targetAngle, defaultConnectionPoint) {
        ignore(linkView, view, magnet, reference, targetBBox, targetAngle);
        return fixCorners(this.getBBox({useModelGeometry: true}), defaultConnectionPoint());
    }
});
