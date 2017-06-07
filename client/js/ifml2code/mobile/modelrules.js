// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
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
            var controls = _.chain(model.elements)
                    .filter(function (e) { return model.isViewElement(e); })
                    .value(),
                events = _.chain(model.elements)
                    .filter(function (e) { return model.isEvent(e); })
                    .filter(function (e) { return model.getOutbounds(e).length; })
                    .value(),
                actions = _.chain(model.elements)
                    .filter(function (e) { return model.isAction(e); })
                    .filter(function (a) { return model.getInbounds(a).length; })
                    .value(),
                children = model.getTopLevels(),
                defaultChild = _.chain(children)
                    .filter(function (id) { return model.isDefault(id); })
                    .first()
                    .value(),
                landmarks = _.chain(children)
                    .filter(function (e) { return model.isLandmark(e); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (e) { return {id: e.id, name: e.attributes.name}; })
                    .value(),
                collections = _.chain(model.elements)
                    .filter(function (e) { return model.isViewComponent(e); })
                    .reject({attributes: {stereotype: 'form'}})
                    .map(function (c) {
                        if (c.attributes.collection) {
                            return c.attributes.collection;
                        }
                        throw new AException('Collection cannot be empty\n(ViewComponent id:' + c.id + ')');
                    })
                    .uniq()
                    .value();
            return {
                '': {isFolder: true, children: 'mobileexample'},
                'mobileexample' : { isFolder: true, name: 'mobileexample', children: ['src', 'package', 'config', 'gulp', 'gitignore']},
                'package': {name: 'package.json', content: require('./templates/package.json.ejs')()},
                'config': {name: 'config.xml', content: require('./templates/config.xml.ejs')()},
                'gitignore': {name: '.gitignore', content: require('./templates/gitignore.ejs')()},
                'gulp': {name: 'gulpfile.js', content: require('./templates/gulpfile.js.ejs')()},
                'src': {isFolder: true, name: 'src', children: ['js', 'index']},
                'index': {name: 'index.html', content: require('./templates/index.html.ejs')()},
                'js': {isFolder: true, name: 'js', children: ['js-index', 'controls', 'events', 'actions', 'repositories']},
                'js-index': {name: 'index.js', content: require('./templates/index.js.ejs')()},
                'controls': {isFolder: true, name: 'controls', children: ['controls-index', 'main-application']},
                'controls-index': {name: 'index.js', content: require('./templates/controls-index.js.ejs')({controls: controls})},
                'main-application': {isFolder: true, name: 'main-application', children: ['main-application-vm', 'main-application-v']},
                'main-application-vm': {name: 'index.js', content: require('./templates/main-application-vm.js.ejs')({defaultChild: defaultChild})},
                'main-application-v': {name: 'index.html', content: require('./templates/main-application-v.html.ejs')({children: children, landmarks: landmarks})},
                'events': {isFolder: true, name: 'events', children: ['events-index']},
                'events-index': {name: 'index.js', content: require('./templates/events-index.js.ejs')({events: events})},
                'actions': {isFolder: true, name: 'actions', children: ['actions-index']},
                'actions-index': {name: 'index.js', content: require('./templates/actions-index.js.ejs')({actions: actions})},
                'repositories': {isFolder: true, name: 'repositories', children: 'repositories-index'},
                'repositories-index': {name: 'index.js', content: require('./templates/repositories.index.js.ejs')({collections: collections})}
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
                obj[c.name + '-repository'] = {isFolder: true, name: c.name, children: [c.name + '-repository-index', c.name + '-repository-default']};
                obj[c.name + '-repository-index'] = {name: 'index.js', content: require('./templates/repository.js.ejs')({name: c.name})};
                obj[c.name + '-repository-default'] = {name: 'default.json', content: require('./templates/default.json.ejs')({fields: c.fields})};
            });
            return obj;
        }
    )
];
