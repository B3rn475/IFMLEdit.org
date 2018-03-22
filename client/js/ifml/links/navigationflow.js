// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    joint = require('joint'),
    Base = require('./base').Base;

exports.NavigationFlow = Base.extend({
    defaults: joint.util.deepSupplement({
        type: 'ifml.NavigationFlow',
        attrs: { '.marker-target': { fill: 'black', stroke: 'black', d: 'M 10 0 L 0 5 L 10 10 z' } }
    }, Base.prototype.defaults),

    validSources: ['ifml.Event'],
    validTargets: ['ifml.ViewComponent', 'ifml.ViewContainer', 'ifml.Action'],
    validateConnection: function (cellViewS, magnetS, cellViewT, magnetT, end, linkView) {
        _.noop(magnetS, magnetT);
        if (cellViewS === cellViewT) { return false; }
        var valid,
            source = cellViewS.model,
            target = cellViewT.model,
            parent;
        if (end === 'source') {
            valid = -1 !== linkView.model.validSources.indexOf(source.get('type'));
        } else {
            valid = -1 !== linkView.model.validTargets.indexOf(target.get('type'));
        }
        if (valid) {
            parent = source.graph.getCell(source.get('parent'));
            valid = !(parent.get('type') === 'ifml.Action' && target.get('type') === 'ifml.Action');
        }
        return valid;
    }
});
