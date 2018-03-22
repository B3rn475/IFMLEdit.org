// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

exports.rules = [
    createRule( // map any to element
        function (flow, model) {
            return model.isNavigationFlow(flow) &&
                   !model.isAction(model.getTarget(flow));
        },
        function (flow, model) {
            var event = model.getSource(flow),
                id = event.id,
                target = model.getTarget(flow).id,
                targetTop = model.getTopLevelAncestor(target).id,
                targetActives = _.chain(model.getAncestors(target, true))
                    .filter(function (id) { return model.isViewContainer(id); })
                    .filter(function (id) { return model.isXOR(model.getParent(id)); })
                    .map(function (id) { return {xor: model.getParentId(id), child: id}; })
                    .value(),
                bindings = _.chain(model.getOutbounds(id))
                    .filter(function (id) { return model.isNavigationFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .filter(function (flow) {
                        return flow.attributes.bindings && flow.attributes.bindings.length;
                    })
                    .map(function (flow) {
                        return flow.attributes.bindings;
                    })
                    .first()
                    .value(),
                obj = {
                    events: {children: 'E-' + id}
                };
            obj['E-' + id] = {name: id + '.js', content: require('./templates/event.js.ejs')({id: id, target: target, targetTop: targetTop, targetActives: targetActives, bindings: bindings})};
            return obj;
        }
    ),
    createRule( // map element to action
        function (flow, model) {
            return model.isNavigationFlow(flow) &&
                   !model.isAction(model.getParent(model.getSource(flow))) &&
                   model.isAction(model.getTarget(flow));
        },
        function (flow, model) {
            var event = model.getSource(flow),
                id = event.id,
                target = model.getTarget(flow).id,
                containerId = model.getActionParentId(target),
                bindings = _.chain(model.getOutbounds(id))
                    .filter(function (id) { return model.isNavigationFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .filter(function (flow) {
                        return flow.attributes.bindings && flow.attributes.bindings.length;
                    })
                    .map(function (flow) {
                        return flow.attributes.bindings;
                    })
                    .first()
                    .value(),
                obj = {
                    events: {children: 'E-' + id}
                };
            obj['E-' + id] = {name: id + '.js', content: require('./templates/event-to-action.js.ejs')({id: id, containerId: containerId, target: target, bindings: bindings})};
            return obj;
        }
    )
];
