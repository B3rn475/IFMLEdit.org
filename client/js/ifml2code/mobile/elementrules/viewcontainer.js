// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
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
                    controls: {children: 'C-' + id}
                };
            obj['C-' + id] = {isFolder: true, name: 'c-' + id, children: ['C-' + id + '-VM', 'C-' + id + '-V']};
            obj['C-' + id + '-VM'] = {name: 'index.js', content: require('./templates/nonxor-vm.js.ejs')({id: id, children: children})};
            obj['C-' + id + '-V'] = {name: 'index.html', content: require('./templates/nonxor-v.html.ejs')({children: children, events: events})};
            return obj;
        }
    ),
    createRule( // map XOR View Container
        function (element, model) { return model.isViewContainer(element) && model.isXOR(element); },
        function (element, model) {
            var id = element.id,
                children = _.chain(model.getChildren(element))
                    .filter(function (id) { return model.isViewContainer(id); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (e) { return {id: e.id, name: e.attributes.name}; })
                    .value(),
                defaultChild = _.chain(model.getChildren(element))
                    .filter(function (id) { return model.isDefault(id); })
                    .first()
                    .value(),
                landmarks = _.chain(children)
                    .filter(function (c) { return model.isLandmark(c.id); })
                    .value(),
                events = _.chain(model.getChildren(element))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (id) { return model.getOutbounds(id).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) { return { id: event.id, name: event.attributes.name}; })
                    .value(),
                obj = {
                    controls: {children: 'C-' + id}
                };
            obj['C-' + id] = {isFolder: true, name: 'c-' + id, children: ['C-' + id + '-VM', 'C-' + id + '-V']};
            obj['C-' + id + '-VM'] = {name: 'index.js', content: require('./templates/xor-vm.js.ejs')({id: id, defaultChild: defaultChild, landmarks: landmarks})};
            obj['C-' + id + '-V'] = {name: 'index.html', content: require('./templates/xor-v.html.ejs')({children: children, landmarks: landmarks, events: events})};
            return obj;
        }
    )
];
