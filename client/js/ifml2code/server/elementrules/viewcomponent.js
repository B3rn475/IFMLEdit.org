// Copyright (c) 2016, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash'),
    pcn = require('../../../pcn').pcn,
    createRule = require('almost').createRule;

exports.rules = [
    createRule( // map list
        function (element, model) { return model.isViewComponent(element) && element.attributes.stereotype === 'list'; },
        function (element, model) {
            var id = model.toId(element),
                name = element.attributes.name,
                collection = element.attributes.collection,
                filters = element.attributes.filters,
                top = model.getTopLevelAncestor(element),
                tid = top.id,
                path = model.isDefault(top) ? '' : tid,
                incomings = _.chain(model.getInbounds(id))
                    .filter(function (id) { return model.isDataFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (flow) {
                        var source = model.getSource(flow);
                        return {source: source.id, type: source.attributes.stereotype, bindings: flow.attributes.bindings };
                    })
                    .value(),
                unfilteredevents = _.chain(model.getChildren(id))
                    .filter(function (id) { return model.isEvent(id); })
                    .map(function (id) { return model.toElement(id); })
                    .filter(function (event) { return model.getOutbounds(event).length; })
                    .map(function (event) {
                        var flow = model.getOutbounds(event)[0],
                            target = flow && model.getTarget(flow);
                        return { id: model.toId(event), name: event.attributes.name, stereotype: event.attributes.stereotype, targetsAction: model.isAction(target, false)};
                    })
                    .value(),
                events = _.chain(unfilteredevents)
                    .reject({stereotype: 'selection'})
                    .value(),
                selection = _.chain(unfilteredevents)
                    .filter({stereotype: 'selection'})
                    .first()
                    .value(),
                fields = element.attributes.fields,
                obj = {};
            obj[tid + '-view'] = {children: id + '-pug'};
            obj[id + '-pug'] = {name: id + '.pug', content: require('./templates/list.pug.ejs')({id: id, name: name, fields: fields, events: events, selection: selection})};
            obj[tid + '-viewmodel'] = {children: id + '-view-js'};
            obj[id + '-view-js'] = {name: id + '.js', content: require('./templates/list.js.ejs')({id: id, incomings: incomings, collection: collection, fields: fields, filters: filters, events: unfilteredevents, selection: selection, path: path, toplevel: tid})};
            return obj;
        }
    ),
    createRule( // map form
        function (element, model) { return model.isViewComponent(element) && element.attributes.stereotype === 'form'; },
        function (element, model) {
            var id = model.toId(element),
                name = element.attributes.name,
                top = model.getTopLevelAncestor(element),
                tid = top.id,
                incomings = _.chain(model.getInbounds(id))
                    .filter(function (id) { return model.isDataFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (flow) {
                        var source = model.getSource(flow);
                        return {source: source.id, type: source.attributes.stereotype, bindings: flow.attributes.bindings };
                    })
                    .value(),
                events = _.chain(model.getChildren(id))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (id) { return model.getOutbounds(id).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) {
                        var flow = model.toElement(model.getOutbounds(event)[0]),
                            target = model.getTarget(flow);
                        return {
                            id: model.toId(event),
                            name: event.attributes.name,
                            target: model.toId(target),
                            targetsAction: model.isAction(target),
                            type: model.isAction(target) ? 'action' : target.attributes.stereotype,
                            bindings: flow.attributes.bindings
                        };
                    })
                    .value(),
                fields = element.attributes.fields,
                obj = {};
            obj[tid + '-view'] = {children: id + '-pug'};
            obj[id + '-pug'] = {name: id + '.pug', content: require('./templates/form.pug.ejs')({id: id, name: name, fields: fields, events: events})};
            obj[tid + '-viewmodel'] = {children: id + '-view-js'};
            obj[id + '-view-js'] = {name: id + '.js', content: require('./templates/form.js.ejs')({id: id, incomings: incomings, fields: fields, events: events})};
            return obj;
        }
    ),
    createRule( // map details
        function (element, model) { return model.isViewComponent(element) && element.attributes.stereotype === 'details'; },
        function (element, model) {
            var id = model.toId(element),
                name = element.attributes.name,
                collection = element.attributes.collection,
                top = model.getTopLevelAncestor(element),
                tid = top.id,
                incomings = _.chain(model.getInbounds(id))
                    .filter(function (id) { return model.isDataFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (flow) {
                        var source = model.getSource(flow);
                        return {source: source.id, type: source.attributes.stereotype, bindings: flow.attributes.bindings };
                    })
                    .value(),
                events = _.chain(model.getChildren(id))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (id) { return model.getOutbounds(id).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) {
                        var flow = model.getOutbounds(event)[0],
                            target = flow && model.getTarget(flow);
                        return { id: model.toId(event), name: event.attributes.name, targetsAction: model.isAction(target)};
                    })
                    .value(),
                fields = element.attributes.fields,
                obj = {};
            obj[tid + '-view'] = {children: id + '-pug'};
            obj[id + '-pug'] = {name: id + '.pug', content: require('./templates/details.pug.ejs')({id: id, name: name, fields: fields, events: events})};
            obj[tid + '-viewmodel'] = {children: id + '-js'};
            obj[id + '-js'] = {name: id + '.js', content: require('./templates/details.js.ejs')({id: id, incomings: incomings, collection: collection, fields: fields, events: events})};
            return obj;
        }
    ),
];
