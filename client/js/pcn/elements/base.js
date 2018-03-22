// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var joint = require('joint'),
    strToText = require('./strtotext').strToText;

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

exports.Base = joint.shapes.basic.Generic.extend({
    defaults: joint.util.deepSupplement({
        name: {text: '', vertical: 'bottom', horizontal: 'middle'},
    }, joint.shapes.basic.Generic.prototype.defaults),

    minsize: {width: 0, height: 0},
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
            ]},
            {name: 'Init Direction', type: 'booleanset', items: [
                {property: 'borders/top', name: 'Top'},
                {property: 'borders/left', name: 'Left'},
                {property: 'borders/bottom', name: 'Bottom'},
                {property: 'borders/right', name: 'Right'}
            ]}
        ];
    },

    initialize: function () {
        this.on('change:size', this.fixSize, this);
        this.on('change:name', this.updateName, this);
        joint.shapes.basic.Generic.prototype.initialize.apply(this, arguments);
        this.fixSize();
        this.updateName();
    },

    fixSize: function () {
        var size = this.get('size'),
            minsize = this.minsize;
        if (size.width < minsize.width || size.height < minsize.height) {
            this.resize(Math.max(size.width, minsize.width), Math.max(size.height, minsize.height));
        }
    },

    updateName: function () {
        this.attr({'.name': joint.util.deepSupplement(
            strToText(this.get('name').text),
            verticalToRef(this.get('name').vertical),
            horizontalToRef(this.get('name').horizontal)
        )});
    },
});
