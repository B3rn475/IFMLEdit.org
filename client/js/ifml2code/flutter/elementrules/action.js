// Copyright (c) 2017, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

exports.rules = [
    createRule( // map action
        function (element, model) { return model.isAction(element); },
        function (action, model) {
            var id = model.toId(action),
                name = action.attributes.name,
                parameters = action.attributes.parameters,
                results = action.attributes.results,
                events = _.chain(model.getChildren(id))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (id) { return model.getOutbounds(id).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) { return { id: model.toId(event), name: event.attributes.name}; })
                    .value(),
                obj = {
                    actions: {children: 'a-' + id}
                };
            obj['a-' + id] = {name: id + '.dart', content: require('./templates/action.dart.ejs')({id: id, name: name, parameters: parameters, results: results, events: events})};
            return obj;
        }
    )
];
