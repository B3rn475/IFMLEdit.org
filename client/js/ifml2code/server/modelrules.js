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
            var pages = _.chain(model.getTopLevels())
                    .map(function (id) { return model.toElement(id); })
                    .sortBy('attributes.default')
                    .reverse()
                    .value(),
                actions = _.chain(model.elements)
                    .filter(function (e) { return model.isAction(e); })
                    .map(function (action) { return {id: action.id}; })
                    .value(),
                vms = _.map(pages, function (page) {
                    return {id: page.id};
                }),
                routes = _.chain(pages)
                    .map(function (page) {
                        return {id: page.id, path: page.attributes.default ? '' : page.id};
                    }).concat(
                        _.map(actions, function (action) {
                            return {id: action.id, path: action.id};
                        })
                    ).value(),
                landmarks = _.chain(pages)
                    .filter(function (e) { return model.isLandmark(e); })
                    .map(function (page) { return {href: page.attributes.default ? '' : page.id, name: page.attributes.name}; })
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
                '': {isFolder: true, children: 'webexample'},
                'webexample' : { isFolder: true, name: 'webexample', children: ['gulp', 'package', 'index', 'routes', 'actions', 'views', 'viewmodels', 'repositories', 'gitignore']},
                'gulp': {name: 'gulpfile.js', content: require('./templates/gulpfile.js.ejs')()},
                'gitignore': {name: '.gitignore', content: require('./templates/gitignore.ejs')()},
                'index': {name: 'index.js', content: require('./templates/index.js.ejs')()},
                'package': {name: 'package.json', content: require('./templates/package.json.ejs')()},
                'routes': {isFolder: true, name: 'routes', children: 'routes-index'},
                'actions': {isFolder: true, name: 'actions', children: 'actions-index'},
                'views': {isFolder: true, name: 'views', children: 'views-index'},
                'viewmodels': {isFolder: true, name: 'viewmodels', children: 'viewmodels-index'},
                'repositories': {isFolder: true, name: 'repositories', children: 'repositories-index'},
                'routes-index': {name: 'index.js', content: require('./templates/routes.index.js.ejs')({routes: routes})},
                'actions-index': {name: 'index.js', content: require('./templates/actions.index.js.ejs')({actions: actions})},
                'views-index': {name: 'index.jade', content: require('./templates/views.index.jade.ejs')({landmarks: landmarks})},
                'viewmodels-index': {name: 'index.js', content: require('./templates/viewmodels.index.js.ejs')({vms: vms})},
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
                        return {name: _.first(elements).name, fields: _.chain(elements).map('fields').flatten().uniq().without('id', '_id').value() };
                    })
                    .value(),
                obj = {
                    'repositories': {children: _.map(collections, function (c) { return c.name + '-reporitory'; })},
                };
            _.each(collections, function (c) {
                obj[c.name + '-reporitory'] = {isFolder: true, name: c.name, children: [c.name + '-reporitory-index', c.name + '-reporitory-default']};
                obj[c.name + '-reporitory-index'] = {name: 'index.js', content: require('./templates/repository.js.ejs')({name: c.name})};
                obj[c.name + '-reporitory-default'] = {name: 'default.json', content: require('./templates/default.json.ejs')({fields: c.fields})};
            });
            return obj;
        }
    )
];
