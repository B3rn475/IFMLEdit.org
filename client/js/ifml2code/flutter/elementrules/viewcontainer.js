// Copyright (c) 2017, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

exports.rules = [
    createRule( // map View Container
        function (element, model) { return model.isViewContainer(element) && !model.isXOR(element); },
        function (element, model) {
            var id = element.id,
                name = element.attributes.name,
                children = _.chain(model.getChildren(element))
                    .reject(function (id) { return model.isEvent(id); })
                    .map(function (id) { return {id: id, name: model.toElement(id).attributes.name}; })
                    .value(),
                events = _.chain(model.getChildren(element))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (id) { return model.getOutbounds(id).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) { return { id: event.id, name: event.attributes.name}; })
                    .value(),
                obj = {
                    widgets: {children: 'w-' + id}
                };
            obj['w-' + id] = {name: id + '.dart', content: require('./templates/nonxor.dart.ejs')({id: id, name: name, children: children, events: events})};
            return obj;
        }
    ),
    createRule( // map XOR View Container
        function (element, model) { return model.isViewContainer(element) && model.isXOR(element); },
        function (element, model) {
            var id = element.id,
                name = element.attributes.name,
                children = _.chain(model.getChildren(element))
                    .filter(function (id) { return model.isViewContainer(id); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (e) { return {id: e.id, name: e.attributes.name}; })
                    .value(),
                events = _.chain(model.getChildren(element))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (id) { return model.getOutbounds(id).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) { return { id: event.id, name: event.attributes.name}; })
                    .value(),
                landmarks = _.chain(children)
                    .filter(function (c) { return model.isLandmark(c.id); })
                    .value(),
                defaultChild = _.chain(model.getChildren(element))
                    .filter(function (id) { return model.isDefault(id); })
                    .first()
                    .value(),
                obj = {
                    widgets: {children: 'w-' + id}
                };
            obj['w-' + id] = {name: id + '.dart', content: require('./templates/xor.dart.ejs')({id: id, name: name, children: children, defaultChild: defaultChild, events: events, landmarks: landmarks})};
            return obj;
        }
    )
];
