// Copyright (c) 2017, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    almost = require('almost'),
    Rule = almost.Rule,
    createRule = almost.createRule,
    AException = almost.Exception;

exports.rules = [
    createRule(
        Rule.always,
        function (model) {
            var children = model.getTopLevels(),
                defaultChild = _.chain(children)
                    .filter(function (id) { return model.isDefault(id); })
                    .first()
                    .value(),
                landmarks = _.chain(children)
                    .filter(function (e) { return model.isLandmark(e); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (e) { return {id: e.id, name: e.attributes.name}; })
                    .value();
            return {
                '': {isFolder: true, children: 'flutterexample'},
                'flutterexample' : { isFolder: true, name: 'flutterexample', children: ['lib', 'pubspec']},
                'lib': {isFolder: true, name: 'lib', children: ['main', 'main-application', 'actions', 'widgets', 'events', 'commands', 'repositories']},
                'main': {name: 'main.dart', content: require('./templates/main.dart.ejs')()},
                'main-application': {name: 'main_application.dart', content: require('./templates/main_application.dart.ejs')({children: children, defaultChild: defaultChild, landmarks: landmarks})},
                'actions': {isFolder: true, name: 'actions'},
                'widgets': {isFolder: true, name: 'widgets'},
                'events': {isFolder: true, name: 'events'},
                'repositories': {isFolder: true, name: 'repositories'},
                'commands': {name: 'commands.dart', content: require('./templates/commands.dart.ejs')()},
                'pubspec': {name: 'pubspec.yaml', content: require('./templates/pubspec.yaml.ejs')()},
            };
        }
    ),
    createRule(
        Rule.always,
        function (model) {
            var collections = _.chain(model.elements)
                    .filter(function (e) { return model.isViewComponent(e); })
                    .reject({attributes: {stereotype: 'form'}})
                    .map(function (component) {
                        return {
                            name: component.attributes.collection,
                            fields: _.chain(component.attributes.fields).concat(component.attributes.filters).compact().value()
                        };
                    })
                    .groupBy('name')
                    .values()
                    .map(function (elements) {
                        return {name: _.first(elements).name, fields: _.chain(elements).map('fields').flatten().uniq().value() };
                    })
                    .value(),
                obj = {
                    'repositories': {children: _.map(collections, function (c) { return c.name + '-repository'; })},
                };
            _.each(collections, function (c) {
                obj[c.name + '-repository'] = {name: c.name + '.dart', content: require('./templates/repository.dart.ejs')({name: c.name, fields: c.fields})};
            });
            return obj;
        }
    )
];
