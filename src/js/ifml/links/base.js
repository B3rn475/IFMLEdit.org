// Copyright (c) 2016, the webratio-web project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var joint = require('joint'),
    _ = require('lodash');

exports.Base = joint.dia.Link.extend({
    defaults: joint.util.deepSupplement({
        bindings: []
    }, joint.dia.Link.prototype.defaults),

    labelMarkup: require('./binding.svg').trim(),

    initialize: function () {
        this.on('change:bindings change:accent-in change:accent-out', this._labelChanged, this);
        this.on('change:source change:target', function () { this.reparent(); }, this);
        joint.dia.Link.prototype.initialize.apply(this, arguments);
        this._labelChanged();
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

    _labelChanged: function () {
        var labels = _.chain([]);
        if (this.get('bindings').length) {
            labels = labels.concat([{position: 0.5}]);
        }
        this.set('labels', labels.value());
    }
});
