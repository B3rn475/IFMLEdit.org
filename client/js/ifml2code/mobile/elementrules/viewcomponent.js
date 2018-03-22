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
            var id = element.id,
                name = element.attributes.name,
                collection = element.attributes.collection,
                filters = element.attributes.filters,
                fields = element.attributes.fields,
                incomings = _.chain(model.getInbounds(id))
                    .filter(function (id) { return model.isDataFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (flow) {
                        var source = model.getSource(flow);
                        return {source: source.id, bindings: flow.attributes.bindings };
                    })
                    .value(),
                outgoings = _.chain(model.getOutbounds(id))
                    .filter(function (id) { return model.isDataFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (flow) {
                        var target = model.getTarget(flow);
                        return {target: target.id, bindings: flow.attributes.bindings };
                    })
                    .value(),
                showSelection = outgoings.length !== 0,
                unfilteredevents = _.chain(model.getChildren(id))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (event) { return model.getOutbounds(event).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) { return { id: event.id, name: event.attributes.name}; })
                    .value(),
                events = _.chain(unfilteredevents)
                    .reject({name: 'selected'})
                    .value(),
                selected = _.chain(unfilteredevents)
                    .filter({name: 'selected'})
                    .first()
                    .value(),
                obj = {
                    controls: {children: 'C-' + id}
                };
            obj['C-' + id] = {isFolder: true, name: 'c-' + id, children: ['C-' + id + '-VM', 'C-' + id + '-V']};
            obj['C-' + id + '-VM'] = {name: 'index.js', content: require('./templates/list-vm.js.ejs')({id: id, selected: selected, collection: collection, filters: filters, fields: fields, incomings: incomings})};
            obj['C-' + id + '-V'] = {name: 'index.html', content: require('./templates/list-v.html.ejs')({name: name, events: events, fields: fields, showSelection: showSelection})};
            return obj;
        }
    ),
    createRule( // map details
        function (element, model) { return model.isViewComponent(element) && element.attributes.stereotype === 'details'; },
        function (element, model) {
            var id = element.id,
                name = element.attributes.name,
                collection = element.attributes.collection,
                fields = element.attributes.fields,
                incomings = _.chain(model.getInbounds(id))
                    .filter(function (id) { return model.isDataFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (flow) {
                        var source = model.getSource(flow);
                        return {source: source.id, bindings: flow.attributes.bindings };
                    })
                    .value(),
                events = _.chain(model.getChildren(id))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (id) { return model.getOutbounds(id).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) { return { id: event.id, name: event.attributes.name}; })
                    .value(),
                obj = {
                    controls: {children: 'C-' + id}
                };
            obj['C-' + id] = {isFolder: true, name: 'c-' + id, children: ['C-' + id + '-VM', 'C-' + id + '-V']};
            obj['C-' + id + '-VM'] = {name: 'index.js', content: require('./templates/details-vm.js.ejs')({id: id, collection: collection, fields: fields, incomings: incomings})};
            obj['C-' + id + '-V'] = {name: 'index.html', content: require('./templates/details-v.html.ejs')({name: name, events: events, fields: fields})};
            return obj;
        }
    ),
    createRule( // map form
        function (element, model) { return model.isViewComponent(element) && element.attributes.stereotype === 'form'; },
        function (element, model) {
            var id = element.id,
                name = element.attributes.name,
                fields = element.attributes.fields,
                incomings = _.chain(model.getInbounds(id))
                    .filter(function (id) { return model.isDataFlow(id); })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (flow) {
                        var source = model.getSource(flow);
                        return {source: source.id, bindings: flow.attributes.bindings };
                    })
                    .value(),
                events = _.chain(model.getChildren(id))
                    .filter(function (id) { return model.isEvent(id); })
                    .filter(function (id) { return model.getOutbounds(id).length; })
                    .map(function (id) { return model.toElement(id); })
                    .map(function (event) { return { id: event.id, name: event.attributes.name}; })
                    .value(),
                obj = {
                    controls: {children: 'C-' + id}
                };
            obj['C-' + id] = {isFolder: true, name: 'c-' + id, children: ['C-' + id + '-VM', 'C-' + id + '-V']};
            obj['C-' + id + '-VM'] = {name: 'index.js', content: require('./templates/form-vm.js.ejs')({id: id, fields: fields, incomings: incomings})};
            obj['C-' + id + '-V'] = {name: 'index.html', content: require('./templates/form-v.html.ejs')({id: id, name: name, events: events, fields: fields})};
            return obj;
        }
    )
];
