// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    createExtender = require('almost').createExtender;

var config = {
    type: {
        'ViewContainer': 'ifml.ViewContainer',
        'ViewComponent': 'ifml.ViewComponent',
        'ViewElement': ['ifml.ViewContainer', 'ifml.ViewComponent'],
        'Action': 'ifml.Action',
        'Event': 'ifml.Event',
        'DataFlow': 'ifml.DataFlow',
        'NavigationFlow': 'ifml.NavigationFlow',
        'Flow': ['ifml.DataFlow', 'ifml.NavigationFlow']
    },
    relation: {
        Parent: {relation: 'hierarchy', from: 'child', to: 'parent', single: true},
        Children: {relation: 'hierarchy', from: 'parent', to: 'child'},
        Source: {relation: 'source', from: 'flow', to: 'source', single: true},
        Target: {relation: 'target', from: 'flow', to: 'target', single: true},
        Inbounds: {relation: 'target', from: 'target', to: 'flow'},
        Outbounds: {relation: 'source', from: 'source', to: 'flow'}
    },
    custom: {
        isDefault: function (id, defaultValue) {
            if (arguments.length < 2) { defaultValue = false; }
            var element = this.toElement(id);
            return element ? element.attributes.default : defaultValue;
        },
        isXOR: function (id, defaultValue) {
            if (arguments.length < 2) { defaultValue = false; }
            var element = this.toElement(id);
            return element ? element.attributes.xor : defaultValue;
        },
        isLandmark: function (id, defaultValue) {
            if (arguments.length < 2) { defaultValue = false; }
            var element = this.toElement(id);
            return element ? element.attributes.landmark : defaultValue;
        },
        isTargetOfDataFlow: function (element) {
            return _.any(this.getInbounds(element), _.bind(this.isDataFlow, this));
        },
        getTopLevels: function () {
            var self = this;
            function isViewContainer(e) { return self.isViewContainer(e); }
            function hasParent(e) { return self.getParentId(e); }
            return _.chain(this.elements)
                .filter(isViewContainer)
                .reject(hasParent)
                .map(_.bind(this.toId, this))
                .value();
        },
        getActionSourceId: function (action, defaultValue) {
            return this.getParentId(this.getSource(_.first(this.getInbounds(action, defaultValue))));
        },
        getActionSource: function (action, defaultValue) {
            return this.toElement(this.getActionSourceId(action, defaultValue));
        },
        getAncestors: function (element, inclusive) {
            var self = this;
            function _getAncestors(id) {
                if (!id) { return _.chain([]); }
                if (self.isAction(id)) {
                    return _getAncestors(self.getActionSourceId(id)).concat(id);
                }
                return _getAncestors(self.getParentId(id)).concat(id);
            }
            if (inclusive) {
                return _getAncestors(this.toId(element)).value();
            }
            return _getAncestors(this.getParentId(element)).value();
        },
        getTopLevelAncestorId: function (element, defaultValue) {
            if (this.isAction(element)) {
                return this.getTopLevelAncestorId(this.getActionSource(element));
            }
            if (!this.getParentId(element)) {
                return this.toId(element);
            }
            var top = _.first(this.getAncestors(element));
            if (this.isAction(top)) {
                return this.getTopLevelAncestorId(this.getActionSource(top));
            }
            return top || defaultValue;
        },
        getTopLevelAncestor: function (element) {
            return this.toElement(this.getTopLevelAncestorId(element));
        },
        getDescendants: function (element, inclusive) {
            var self = this,
                id = this.toId(element);
            function _getDescendants(chain, id) {
                if (!id) { return chain; }
                var children = self.getChildren(id);
                return _.reduce(children, _getDescendants, chain.concat(children));
            }
            if (inclusive) {
                return _getDescendants(_([id]), id).compact().value();
            }
            return _getDescendants(_([]), id).compact().value();
        },
        getFlowContextId: function (flow, defaultValue) {
            var event = this.getSource(flow),
                source = this.getParent(event),
                target = this.getTarget(flow),
                context;
            if (this.isAction(source)) {
                source = this.getActionSource(source);
            }
            if (this.isAction(target)) {
                target = source;
            }
            context = _.last(_.intersection(
                this.getAncestors(source, true),
                this.getAncestors(target, true)
            ));
            if (this.isViewComponent(context)) {
                context = this.getParent(context);
            }
            if (context === source || context === target) {
                if (this.isXOR(context)) {
                    context = this.getParent(context);
                }
            }
            return this.toId(context) || defaultValue;
        },
        getFlowContext: function (flow, defaultValue) {
            return this.toElement(this.getFlowContextId(flow, defaultValue));
        },
        getTopMostXORDescendants: function (element) {
            if (!this.isViewContainer(element)) { return []; }
            var self = this;
            function _getTopMostXORDescendants(chain, id) {
                if (!id) { return chain; }
                if (!self.isViewContainer(id)) { return chain; }
                if (self.isXOR(id)) { return chain.concat(id); }
                return _.reduce(self.getChildren(id), _getTopMostXORDescendants, chain);
            }
            return _getTopMostXORDescendants(_([]), this.toId(element)).compact().value();
        },
        getCoDisplayedAncestorId: function (element, ancestor, defaultValue) {
            var children = this.getChildren(ancestor, this.getTopLevels());
            return _.first(_.intersection(
                children,
                this.getAncestors(element, true)
            )) || defaultValue;
        },
        getCoDisplayedAncestor: function (element, ancestor, defaultValue) {
            return this.toElement(this.getCoDisplayedAncestorId(element, ancestor, defaultValue));
        },
        getXORTargets: function (flow, context) {
            var self = this,
                cid = this.toId(context),
                target = this.getTarget(flow),
                ancestors = this.getAncestors(target);
            return _.chain(ancestors)
                    .takeRightWhile(function (id) { return id !== cid; })
                    .filter(function (id) { return self.isViewContainer(id) && self.isXOR(id); })
                    .value();
        },
        getDisplaySet: function (flow, ancestor) {
            var self = this,
                target = this.getTarget(flow),
                XORTargets = this.getXORTargets(flow, ancestor),
                chain = _.chain(XORTargets)
                    .map(function (xid) {
                        return self.toId(self.getCoDisplayedAncestor(target, xid));
                    });
            if (this.isXOR(ancestor, true)) {
                chain = chain.concat(this.toId(this.getCoDisplayedAncestor(target, ancestor)));
            }
            return chain.value();
        },
        getHideSet: function (flow, ancestor) {
            var self = this,
                context = this.getFlowContext(flow),
                ancestors = this.getAncestors(this.getTarget(flow)),
                XORTargets = this.getXORTargets(flow, ancestor),
                chain = _.chain(XORTargets);
            if (this.isXOR(ancestor, true) && ancestor !== context) {
                chain = chain.concat(this.toId(ancestor));
            }
            return chain
                .map(function (xid) {
                    return _.difference(self.getChildren(xid), ancestors);
                })
                .flatten()
                .value();
        },
        getActionParentId: function (action, defaultValue) {
            var source = this.getActionSourceId(action);
            if (this.isViewContainer(source, true)) {
                return source;
            }
            return this.getParentId(source) || defaultValue;
        },
        getActionParent: function (action, defaultValue) {
            return this.toElement(this.getActionParentId(action, defaultValue));
        }
    }
};

exports.createModel = createExtender(config);
