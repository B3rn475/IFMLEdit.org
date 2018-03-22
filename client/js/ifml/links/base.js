// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var joint = require('joint'),
    _ = require('lodash'),
    Color = require('color');

function format(s) {
    switch (s.type) {
    case "string":
        return s.value;
    case "number":
        return String(s.value);
    case "percentage":
        return s.value * 100 + '%';
    default:
        return undefined;
    }
}

exports.Base = joint.dia.Link.extend({
    defaults: joint.util.deepSupplement({
        bindings: []
    }, joint.dia.Link.prototype.defaults),

    labelMarkup: require('./binding.svg').trim(),

    initialize: function () {
        this.on('change:bindings change:accent-in change:accent-out', this._labelChanged, this);
        this.on('change:source change:target', function () { this.reparent(); }, this);
        this.on('change:accent', this._accentChanged, this);
        joint.dia.Link.prototype.initialize.apply(this, arguments);
        this._labelChanged();
        this._accentChanged();
    },

    editable: function () {
        if (this.graph) {
            var source = this.getSourceElement(),
                target = this.getTargetElement();
            if (source.get('type') === 'ifml.Event') {
                source = this.graph.getCell(source.get('parent'));
            }
            if (typeof source.outputs === 'function' && typeof target.inputs === 'function') {
                return [{property: 'bindings', name: 'Bindings', type: 'bindings'}];
            }
        }
        return [];
    },

    statistics: function () {
        return this.get('statistics');
    },

    _labelChanged: function () {
        var labels = _.chain([]),
            label_in = this.get('accent-in'),
            label_out = this.get('accent-out');
        if (this.get('bindings').length || label_in || label_out) {
            labels = labels.concat([
                {
                    position: 10,
                    attrs: {
                        'text': {text: label_in}
                    }
                },
                {
                    position: -10,
                    attrs: {
                        'text': {text: label_out}
                    }
                }
            ]);
        }
        if (this.get('bindings').length) {
            labels = labels.concat([{position: 0.5}]);
        }
        this.set('labels', labels.value());
    },

    _accentChanged: function () {
        var stroke = 'black',
            accent = this.get('accent');
        if (typeof accent === 'number') {
            stroke = Color.hsl(120 * accent, 100, 35).string();
        }
        this.attr({
            '.connection': {
                stroke: stroke
            },
            '.marker-target': {
                stroke: stroke,
                fill: stroke
            }
        });
    }
});
