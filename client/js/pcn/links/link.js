// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var joint = require('joint');

function ignore() { return undefined; }

exports.Link = joint.dia.Link.extend({
    defaults: joint.util.deepSupplement({
        type: 'pcn.Link',
        tokens: 1,
        attrs: {
            '.marker-target': { fill: 'black', stroke: 'black', d: 'M 10 0 L 0 5 L 10 10 z' }
        }
    }, joint.dia.Link.prototype.defaults),

    editable: function () {
        return [{property: 'tokens', name: 'Tokens', type: 'number', integer: true, min: 1}];
    },

    initialize: function () {
        this.on('change:source', this._sourceChanged, this);
        this.on('change:target', this._targetChanged, this);
        this.on('change:parent', this._parentChanged, this);
        this.on('change:tokens', this._labelChanged, this);
        joint.dia.Link.prototype.initialize.apply(this, arguments);
    },

    validateConnection: function (cellViewS, magnetS, cellViewT, magnetT, end, linkView) {
        ignore(magnetS, magnetT, linkView, end);
        if (cellViewS === cellViewT) { return false; }
        var source = cellViewS.model,
            target = cellViewT.model;
        if (!source || !target) { return false; }
        switch (source.get('type')) {
        case 'pcn.Transition':
            return target.get('type') === 'pcn.PlaceChart';
        case 'pcn.PlaceChart':
            return target.get('type') === 'pcn.Transition' ||
                (target.get('type') === 'pcn.PlaceChart' && target.isEmbeddedIn(source));
        default:
            return false;
        }
    },

    _sourceChanged: function () {
        if (this.get('source').id) {
            this.reparent();
        }
    },

    _targetChanged: function () {
        if (this.previous('target').id && this.get('target').id) {
            this.reparent();
        }
    },

    _labelChanged: function () {
        if (this.get('tokens') > 1) {
            this.set('labels', [{position: 0.5, attrs: {text: {text: this.get('tokens')}}}]);
        } else {
            this.set('labels', []);
        }
    },

    reparent: function () {
        if (this.graph && this.get('source') && this.get('target')) {
            var source = this.graph.getCell(this.get('source').id),
                target = this.graph.getCell(this.get('target').id),
                parent;
            if (source && (!target || (target && target.isEmbeddedIn(source)))) {
                parent = this.get('parent') && this.graph.getCell(this.get('parent'));
                if (parent) {
                    parent.unembed(this);
                }
                source.embed(this);
                return this;
            }
        }
        return joint.dia.Link.prototype.reparent.apply(this, arguments);
    },

    _parentChanged: function () {
        if (this.graph && this.get('source') && this.get('target')) {
            var source = this.graph.getCell(this.get('source').id),
                target = this.graph.getCell(this.get('target').id);
            if (source && target && source.get('type') === 'pcn.PlaceChart' && target.get('type') === 'pcn.PlaceChart') {
                if (!target.isEmbeddedIn(source)) {
                    this.remove();
                }
            }
        }
    }
});
