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
        var event = cellViewS.model,
            target = cellViewT.model,
            link = linkView.model,
            source,
            inbounds;
        if (end === 'source') {
            if (!_.includes(link.validSources, event.get('type'))) {
                return false;
            }
        } else {
            if (!_.includes(link.validTargets, target.get('type'))) {
                return false;
            }
        }
        if (target.get('type') === 'ifml.Action') {
            source = event.graph.getCell(event.get('parent'));
            if (source.get('type') === 'ifml.Action') {
                return false;
            }
            inbounds = target.graph.getConnectedLinks(target, {inbound: true});
            return _.every(inbounds, function (inbound) {
                return (inbound.get('type') !== 'ifml.NavigationFlow') || inbound === link;
            });
        }
        return true;
    }
});
