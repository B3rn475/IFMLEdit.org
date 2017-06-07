// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule,
    AException = require('almost').Exception;

var templates = {
    action: require('./templates/action.js.ejs'),
};

exports.rules = [
    createRule( // map action
        function (element, model) {
            return model.isAction(element);
        },
        function (action, model) {
            var id = action.id,
                source = model.getActionSourceId(action),
                vm = model.getTopLevelAncestorId(source),
                name = action.attributes.name,
                parameters = action.attributes.parameters,
                results = action.attributes.results,
                events = _.chain(model.getChildren(id))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (id) { return model.getOutbounds(id).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) { return { id: event.id, name: event.attributes.name}; })
                    .value(),
                obj = {
                    routes: {children: id + '-route'},
                    actions: {children: id + '-action'}
                };
            obj[id + '-route'] = {name: id + '.js', content: require('./templates/route.action.index.js.ejs')({ id: id, vm: vm})};
            obj[id + '-action'] = {name: id, isFolder: true, children: id + '-action-js'};
            obj[id + '-action-js'] = {name: 'index.js', content: templates.action({
                id: id,
                name: name,
                parameters: parameters,
                results: results,
                events: events
            })};
            return obj;
        }
    )
];
