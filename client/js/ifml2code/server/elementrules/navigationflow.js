// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

var templates = {
    action: require('./templates/action.event.js.ejs'),
    container: require('./templates/container.event.js.ejs'),
    details: require('./templates/details.event.js.ejs'),
    list: require('./templates/list.event.js.ejs'),
    form: require('./templates/form.event.js.ejs'),
};

exports.rules = [
    createRule( // map navigation flow related to ViewContainer
        function (flow, model) { return model.isNavigationFlow(flow) && model.isViewContainer(model.getParent(model.getSource(flow))); },
        function (flow, model) {
            var event = model.getSource(flow),
                id = model.toId(event),
                source = model.getParent(event),
                sourceTop = model.getTopLevelAncestor(source),
                currentTopLevel = sourceTop.id,
                target = model.getTarget(flow),
                targetsAction = model.isAction(target),
                targetTop = model.getTopLevelAncestor(target),
                targetTopLevel = targetTop.id,
                path = targetsAction ? target.id
                                     : model.isDefault(targetTop) ? '' : targetTopLevel,
                isSameTopLevel = currentTopLevel === targetTopLevel,
                targetActives = _.chain(model.getAncestors(target))
                    .filter(function (id) { return model.isViewContainer(id); })
                    .filter(function (id) { return model.isXOR(model.getParent(id)); })
                    .map(function (container) { return {xor: model.getParentId(container), child: id}; })
                    .value(),
                broken = _.chain(model.getDescendants(target, true))
                    .reject(function (id) { return model.isEvent(id); })
                    .value(),
                obj = {};
            obj[currentTopLevel + '-viewmodel'] = {children: id + '-viewmodel-js'};
            obj[id + '-viewmodel-js'] = {name: id + '.js', content: templates.container({
                id: id,
                path: path,
                currentTopLevel: currentTopLevel,
                isSameTopLevel: isSameTopLevel,
                targetActives: targetActives,
                targetsAction: targetsAction,
                broken: broken,
            })};
            return obj;
        }
    ),
    createRule( // map navigation flow related to ViewComponent
        function (flow, model) { return model.isNavigationFlow(flow) && model.isViewComponent(model.getParent(model.getSource(flow))); },
        function (flow, model) {
            var event = model.getSource(flow),
                id = model.toId(event),
                source = model.getParent(event),
                sourceTop = model.getTopLevelAncestor(source),
                currentTopLevel = sourceTop.id,
                target = model.getTarget(flow),
                targetsAction = model.isAction(target),
                targetTop = model.getTopLevelAncestor(target),
                targetTopLevel = targetTop.id,
                path = targetsAction ? target.id
                                     : model.isDefault(targetTop) ? '' : targetTopLevel,
                isSameTopLevel = currentTopLevel === targetTopLevel,
                isSelection = event.attributes.stereotype === 'selection',
                outcoming = _.chain(model.getOutbounds(id))
                    .filter(function (id) { return model.isNavigationFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .filter(function (flow) {
                        return flow.attributes.bindings && flow.attributes.bindings.length;
                    })
                    .map(function (flow) {
                        return {
                            target: target.id,
                            type: targetsAction ? 'action' : target.attributes.stereotype,
                            bindings: flow.attributes.bindings
                        };
                    })
                    .first()
                    .value(),
                targetActives = _.chain(model.getAncestors(target))
                    .filter(function (id) { return model.isViewContainer(id); })
                    .filter(function (id) { return model.isXOR(model.getParent(id)); })
                    .map(function (id) { return {xor: model.getParentId(id), child: id}; })
                    .value(),
                broken = _.chain(model.getDescendants(target, true))
                    .reject(function (id) { return model.isEvent(id); })
                    .value(),
                obj = {};
            obj[currentTopLevel + '-viewmodel'] = {children: id + '-viewmodel-js'};
            obj[id + '-viewmodel-js'] = {name: id + '.js', content: templates[source.attributes.stereotype]({
                id: id,
                component: source.id,
                path: path,
                currentTopLevel: currentTopLevel,
                isSameTopLevel: isSameTopLevel,
                isSelection: isSelection,
                targetActives: targetActives,
                targetsAction: targetsAction,
                broken: broken,
                outcoming: outcoming
            })};
            return obj;
        }
    ),
    createRule( // map navigation flow related to Action
        function (flow, model) { return model.isNavigationFlow(flow) && model.isAction(model.getParent(model.getSource(flow))); },
        function (flow, model) {
            var event = model.getSource(flow),
                id = model.toId(event),
                action = model.getParent(event),
                aid = model.toId(action),
                origin = model.getActionOrigin(action),
                sourceTop = model.getTopLevelAncestor(origin),
                currentTopLevel = sourceTop.id,
                target = model.getTarget(flow),
                targetTop = model.getTopLevelAncestor(target),
                targetTopLevel = targetTop.id,
                path = model.isDefault(targetTop) ? '' : targetTopLevel,
                isSameTopLevel = currentTopLevel === targetTopLevel,
                outcoming = _.chain(model.getOutbounds(id))
                    .filter(function (id) { return model.isNavigationFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .filter(function (flow) {
                        return flow.attributes.bindings && flow.attributes.bindings.length;
                    })
                    .map(function (flow) {
                        return {
                            target: target.id,
                            type: target.attributes.stereotype,
                            bindings: flow.attributes.bindings
                        };
                    })
                    .first()
                    .value(),
                targetActives = _.chain(model.getAncestors(target))
                    .filter(function (id) { return model.isViewContainer(id); })
                    .filter(function (id) { return model.isXOR(model.getParent(id)); })
                    .map(function (id) { return {xor: model.getParentId(id), child: id}; })
                    .value(),
                broken = _.chain(model.getDescendants(target, true))
                    .reject(function (id) { return model.isEvent(id); })
                    .value(),
                obj = {};
            obj[aid + '-action'] = {children: id + '-event-js'};
            obj[id + '-event-js'] = {name: id + '.js', content: templates.action({
                id: id,
                path: path,
                currentTopLevel: currentTopLevel,
                isSameTopLevel: isSameTopLevel,
                targetActives: targetActives,
                broken: broken,
                outcoming: outcoming
            })};
            return obj;
        }
    )
];
