// Copyright (c) 2016, the webratio-web project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    $ = require('jquery'),
    joint = require('joint');

function verticalToRef(position) {
    switch (position) {
    case 'top':
        return {'ref-y': -1, 'ref-dy': null, 'y-alignment': -0.99};
    case 'bottom':
        return {'ref-y': null, 'ref-dy': 1, 'y-alignment': 0};
    case 'middle':
        return {'ref-y': 0.5, 'ref-dy': null, 'y-alignment': 'middle'};
    default:
        return {'ref-y': null, 'ref-dy': 1, 'y-alignment': 'middle'};
    }
}

function horizontalToRef(position) {
    switch (position) {
    case 'left-outer':
        return {'ref-x': 0, 'ref-dx': null, 'x-alignment': -0.99};
    case 'left':
        return {'ref-x': 0, 'ref-dx': null, 'x-alignment': 0};
    case 'right':
        return {'ref-x': null, 'ref-dx': 0, 'x-alignment': -0.99};
    case 'right-outer':
        return {'ref-x': null, 'ref-dx': 0, 'x-alignment': 0};
    case 'middle':
        return {'ref-x': 0.5, 'ref-dx': null, 'x-alignment': 'middle'};
    default:
        return {'ref-x': 0.5, 'ref-dx': null, 'x-alignment': 'middle'};
    }
}

exports.Event = joint.shapes.basic.Generic.extend({
    markup: require('./markup.svg'),

    defaults: joint.util.deepSupplement({
        type: 'ifml.Event',
        size: {width: 20, height: 20},
        name: {text: 'event', vertical: 'top', horizontal: 'left-outer'},
        attrs: {
            '.': {magnet: false},
            '.ifml-event-magnet-rect': {magnet: true, visibility: 'hidden'},
            'text': {
                'ref-x': 0.5,
                'ref-y': -11,
                'x-alignment': 'middle',
                ref: '.ifml-event-magnet-rect'
            }
        }
    }, joint.shapes.basic.Generic.prototype.defaults),

    requireEmbedding: true,
    containers: ['ifml.ViewContainer', 'ifml.ViewComponent', 'ifml.Action'],

    editable: function () {
        return [
            {property: 'name/text', name: 'Name', type: 'string'},
            {property: 'name/vertical', name: 'Position Vertical', type: 'enum', values: [
                {value: 'top', name: 'Top'},
                {value: 'middle', name: 'Middle'},
                {value: 'bottom', name: 'Bottom'}
            ]},
            {property: 'name/horizontal', name: 'Position Horizontal', type: 'enum', values: [
                {value: 'left-outer', name: 'Outer Left'},
                {value: 'left', name: 'Left'},
                {value: 'middle', name: 'Middle'},
                {value: 'right', name: 'Right'},
                {value: 'right-outer', name: 'Outer Right'}
            ]}
        ];
    },

    deletable: function () { return this.get('parentLifecicle') !== true; },

    initialize: function () {
        joint.shapes.basic.Generic.prototype.initialize.apply(this, arguments);
        this._parentPositionChanged();
        this._nameChanged();
        this.on('change:parent', this._parentChanged, this);
        this.on('change:name', this._nameChanged, this);
    },

    _parentPositionChanged: function () {
        if (this.graph && this.get('parent')) {
            var parent = this.graph.getCell(this.get('parent')),
                bbox,
                ebbox,
                position;
            if (-1 !== this.containers.indexOf(parent.get('type'))) {
                bbox = parent.getBBox({useModelGeometry: true});
                ebbox = this.getBBox({useModelGeometry: true});
                position = bbox.pointNearestToPoint(ebbox.center());

                this.translate(position.x - ebbox.width / 2 - ebbox.x, position.y - ebbox.height / 2 - ebbox.y);
            }
        }
    },

    magnetize: function () {
        if (this.graph && this.graph.getConnectedLinks(this, {outbound: true}).length) { return false; }
        this.attr({'.ifml-event-magnet-rect': {visibility: 'visible'}});
    },

    demagnetize: function () {
        this.attr({'.ifml-event-magnet-rect': {visibility: 'hidden'}});
    },

    _parentChanged: function () {
        if (this.graph) {
            if (this.previous('parent')) {
                this.graph.getCell(this.previous('parent')).off('change:size', this._parentPositionChanged, this);
            }
            if (this.get('parent')) {
                this._parentPositionChanged();
                this.graph.getCell(this.get('parent')).on('change:size', this._parentPositionChanged, this);
            }
        }
    },

    _nameChanged: function () {
        this.attr({text: joint.util.deepSupplement(
            {text: this.get('name').text},
            verticalToRef(this.get('name').vertical),
            horizontalToRef(this.get('name').horizontal)
        )});
    },

    linkConnectionPoint: function (linkView, view, magnet, reference, targetBBox, targetAngle, defaultConnectionPoint) {
        _.noop(linkView, view, magnet, reference, targetBBox, targetAngle);
        var bbox = this.getBBox({useModelGeometry: true}),
            circle = joint.g.ellipse(bbox.center(), bbox.width / 2, bbox.height / 2);
        return circle.intersectionWithLineFromCenterToPoint(defaultConnectionPoint());
    }
});
