// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    $ = require('jquery'),
    joint = require('joint'),
    Color = require('color');

function ignore() { return; }

function upperFirst(string) {
    if (!string || !string.length) { return string; }
    return string[0].toUpperCase() + string.substring(1).toLowerCase();
}

exports.ViewComponent = joint.shapes.basic.Generic.extend({
    markup: require('./markup.svg'),

    defaults: joint.util.deepSupplement({
        type: 'ifml.ViewComponent',
        size: {width: 150, height: 60},
        name: 'View Component',
        stereotype: 'form',
        attrs: {
            '.': {magnet: 'passive'},
            '.ifml-component-reference-rect' : {'follow-scale': 'auto'},
            '.ifml-component-background-rect': {
                'ref-x': 0,
                'ref-y': 0,
                'ref-width': 1,
                'ref-height': 1,
                ref: '.ifml-component-reference-rect'
            },
            '.ifml-component-binding-rect': {
                visibility: 'hidden',
                'ref-x': 10,
                'ref-y': 0.5,
                'ref-width': -20,
                ref: '.ifml-component-background-rect'
            },
            '.ifml-component-magnet-rect': {
                magnet: true,
                visibility: 'hidden',
                'ref-x': 0,
                'ref-y': 0,
                'ref-width': 1,
                'ref-height': 1,
                ref: '.ifml-component-background-rect'
            },
            '.ifml-component-headline': {
                'ref-x': 0.5,
                'ref-y': 0.5,
                ref: '.ifml-component-background-rect'
            },
            '.ifml-component-binding': {
                visibility: 'hidden',
                'ref-x': 0.5,
                'ref-y': 0.5,
                'ref-width': -10,
                'ref-height': 1,
                'y-alignment': 'middle',
                ref: '.ifml-component-binding-rect'
            }
        }
    }, joint.shapes.basic.Generic.prototype.defaults),

    minsize: {width: 150, height: 60},
    padding: {top: 0, right: 0, bottom: 0, left: 0},
    resizable: true,
    isContraint: true,
    requireEmbedding: true,
    fullyContained: true,
    containers: ['ifml.ViewContainer'],

    initialize: function () {
        this.on('change:size', this._sizeChanged, this);
        this.on('change:name change:stereotype', this._headlineChanged, this);
        this.on('change:collection', this._collectionChanged, this);
        this.on('change:accent', this._accentChanged, this);
        joint.shapes.basic.Generic.prototype.initialize.apply(this, arguments);
        this._alignGraphicsWithStereotype();
        this._sizeChanged();
        this._headlineChanged();
        this._collectionChanged();
        this._accentChanged();
        switch (this.get('stereotype')) {
        case 'details':
            this.on('change:fields', this._outputChanged, this);
            this._outputChanged();
            break;
        case 'list':
            this.on('change:filters', this._inputChanged, this);
            this.on('change:fields', this._outputChanged, this);
            this._inputChanged();
            this._outputChanged();
            break;
        default:
            this.on('change:fields', this._inputChanged, this);
            this.on('change:fields', this._outputChanged, this);
            this._inputChanged();
            this._outputChanged();
            break;
        }
    },

    statistics: function () {
        return this.get('statistics');
    },

    _alignGraphicsWithStereotype: function () {
        switch (this.get('stereotype')) {
        case 'details':
        case 'list':
            this.attr({'.ifml-component-headline': {'y-alignment': 'bottom'}});
            this.attr({'.ifml-component-binding-rect': {'visibility': 'visible'}});
            this.attr({'.ifml-component-binding': {'visibility': 'visible'}});
            break;
        default:
            this.attr({'.ifml-component-headline': {'y-alignment': 'middle'}});
            this.attr({'.ifml-component-binding-rect': {'visibility': 'hidden'}});
            this.attr({'.ifml-component-binding': {'visibility': 'hidden'}});
        }
    },

    _sizeChanged: function () {
        var size = this.get('size'),
            minsize = this.minsize;
        if (size.width < minsize.width || size.height < minsize.height) {
            this.resize(Math.max(size.width, minsize.width), Math.max(size.height, minsize.height));
        }
    },

    _headlineChanged: function () {
        this.attr({'.ifml-component-headline': {text: '«' + upperFirst(this.get('stereotype')) + '»\n' + this.get('name') }});
    },

    _collectionChanged: function () {
        var collection = this.get('collection');
        if (collection) {
            this.removeAttr('.binding/fill');
            this.attr({'.ifml-component-binding': {text: '«DataBinding» ' + collection }});
        } else {
            this.attr({'.ifml-component-binding': {fill: 'grey', text: '«DataBinding» none' }});
        }
    },

    _inputChanged: function (element, value, data) {
        ignore(element, value);
        data = data || {};
        if (data.undo) { return; }
        if (this.graph) {
            _.forEach(this.graph.getConnectedLinks(this, {inbound: true}), function (link) {
                link.validateBindings();
            });
        }
    },

    _outputChanged: function (element, value, data) {
        ignore(element, value);
        data = data || {};
        if (data.undo) { return; }
        var self = this;
        if (self.graph) {
            _.forEach(self.graph.getConnectedLinks(self, {outbound: true}), function (link) {
                link.validateBindings();
            });
            _(self.get('embeds') || []).map(function (child) {
                return self.graph.getCell(child);
            }).flatten().filter(function (child) {
                return child.get('type') === 'ifml.Event';
            }).map(function (child) {
                return self.graph.getConnectedLinks(child, {outbound: true});
            }).flatten().forEach(function (link) {
                link.validateBindings();
            }).value();
        }
    },

    editable: function () {
        var self = this;
        return _([{property: 'name', name: 'Name', type: 'string'}])
            .concat((function () {
                switch (self.get('stereotype')) {
                case 'list':
                    return [
                        {property: 'collection', name: 'Collection', type: 'string'},
                        {property: 'filters', name: 'Filters', type: 'stringset'},
                        {property: 'fields', name: 'Fields', type: 'stringset'}
                    ];
                case 'details':
                    return [
                        {property: 'collection', name: 'Collection', type: 'string'},
                        {property: 'fields', name: 'Fields', type: 'stringset'}
                    ];
                case 'form':
                    return [
                        {property: 'fields', name: 'Fields', type: 'stringset'}
                    ];
                default:
                    return [];
                }
            }()))
            .value();
    },

    inputs: function () {
        switch (this.get('stereotype')) {
        case 'details':
            return ['id'];
        case 'list':
            return _(this.get('filters') || []).sort().uniq(true).value();
        case 'form':
            return _(this.get('fields') || []).map(function (f) {
                return [f, f + '-error'];
            }).flatten().sort().value();
        default:
            return [];
        }
    },

    outputs: function () {
        switch (this.get('stereotype')) {
        case 'details':
            return _(['id']).concat(this.get('fields') || []).sort().uniq(true).value();
        case 'list':
            return _(['id']).concat(this.get('fields') || []).sort().uniq(true).value();
        case 'form':
            return _(this.get('fields') || []).sort().value();
        default:
            return [];
        }
    },

    magnetize: function () {
        this.attr({'.ifml-component-magnet-rect': {visibility: 'visible'}});
    },

    demagnetize: function () {
        this.attr({'.ifml-component-magnet-rect': {visibility: 'hidden'}});
    },

    _accentChanged: function () {
        var stroke = 'black',
            fill = 'lightgray',
            accent = this.get('accent');
        if (typeof accent === 'number') {
            stroke = Color.hsl(120 * accent, 100, 35).string();
            fill = Color.hsl(120 * accent, 75, 90).string();
        }
        this.attr({
            '.ifml-component-background-rect': {
                stroke: stroke,
                fill: fill
            },
            '.ifml-component-binding-rect': {
                stroke: stroke
            }
        });
    }
});
