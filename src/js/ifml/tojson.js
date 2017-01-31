// Copyright (c) 2016, the webratio-web project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var _ = require('lodash');

function mapElement(element) {
    var statistics = element.get('statistics');
    return {
        id : element.id,
        type : element.get('type'),
        attributes : {},
        metadata : {
            graphics : {
                position : element.get('position')
            },
            statistics: statistics && statistics.slice()
        }
    };
}

function mapEvent(event) {
    var obj = mapElement(event);
    obj.attributes.name = event.prop('name/text');
    obj.metadata.graphics.name = {horizontal: event.prop('name/horizontal'), vertical: event.prop('name/vertical')};
    return obj;
}

function mapAction(action) {
    var obj = mapElement(action);
    obj.attributes.name = action.get('name');
    obj.attributes.parameters = (action.get('parameters') && action.get('parameters').slice()) || [];
    obj.attributes.results = (action.get('results') && action.get('results').slice()) || [];
    obj.metadata.graphics.size = action.get('size');
    if (action.get('parent')) {
        obj.metadata.graphics.parent = action.get('parent');
    }
    return obj;
}

function mapViewComponent(component) {
    var obj = mapElement(component);
    obj.attributes.name = component.get('name');
    obj.attributes.stereotype = component.get('stereotype');
    switch (component.get('stereotype')) {
    case 'details':
        obj.attributes.collection = component.get('collection') || '';
        obj.attributes.fields = (component.get('fields') && component.get('fields').slice()) || [];
        break;
    case 'list':
        obj.attributes.collection = component.get('collection') || '';
        obj.attributes.fields = (component.get('fields') && component.get('fields').slice()) || [];
        obj.attributes.filters = (component.get('filters') && component.get('filters').slice()) || [];
        break;
    case 'form':
        obj.attributes.fields = (component.get('fields') && component.get('fields').slice()) || [];
        break;
    }
    obj.metadata.graphics.size = component.get('size');
    return obj;
}

function mapViewContainer(container) {
    var obj = mapElement(container);
    obj.attributes.name = container.get('name');
    obj.attributes.default = container.get('default');
    obj.attributes.landmark = container.get('landmark');
    obj.attributes.xor = container.get('xor');
    obj.metadata.graphics.size = container.get('size');
    return obj;
}

function mapFlow(flow) {
    var vertices = flow.get('vertices'),
        statistics = flow.get('statistics');
    return {
        id : flow.id,
        type : flow.get('type'),
        attributes : {
            bindings: flow.get('bindings').slice()
        },
        metadata : {
            graphics: {
                vertices: vertices && vertices.slice()
            },
            statistics: statistics && statistics.slice()
        }
    };
}

var mapDataFlow = mapFlow,
    mapNavigationFlow = mapFlow;

function extractElements(cells) {
    return _.chain(cells).map(function (item) {
        switch (item.get('type')) {
        case 'ifml.ViewContainer':
            return mapViewContainer(item);
        case 'ifml.ViewComponent':
            return mapViewComponent(item);
        case 'ifml.Event':
            return mapEvent(item);
        case 'ifml.Action':
            return mapAction(item);
        case 'ifml.NavigationFlow':
            return mapNavigationFlow(item);
        case 'ifml.DataFlow':
            return mapDataFlow(item);
        }
    }).compact().value();
}

function mapElementRelations(element) {
    return _.chain(element.getEmbeddedCells())
        .filter(function (cell) {
            switch (cell.get('type')) {
            case 'ifml.ViewContainer':
            case 'ifml.ViewComponent':
            case 'ifml.Event':
                return true;
            default:
                return false;
            }
        })
        .map('id')
        .map(function (id) {
            return {type: 'hierarchy', parent: element.get('id'), child: id};
        }).value();
}

function mapActionRelations(element) {
    return _.chain(element.getEmbeddedCells())
        .filter(function (cell) {
            switch (cell.get('type')) {
            case 'ifml.Event':
                return true;
            default:
                return false;
            }
        })
        .map('id')
        .map(function (id) {
            return {type: 'hierarchy', parent: element.get('id'), child: id};
        }).value();
}

function mapFlowRelations(flow) {
    return [
        {type: 'source', flow: flow.id, source: flow.get('source').id},
        {type: 'target', flow: flow.id, target: flow.get('target').id}
    ];
}

function extractRelations(cells) {
    return _.chain(cells).map(function (item) {
        switch (item.get('type')) {
        case 'ifml.ViewContainer':
        case 'ifml.ViewComponent':
            return mapElementRelations(item);
        case 'ifml.DataFlow':
        case 'ifml.NavigationFlow':
            return mapFlowRelations(item);
        case 'ifml.Action':
            return mapActionRelations(item);
        case 'ifml.Event':
            return [];
        default:
            return [];
        }
    }).flatten().value();
}

exports.toJSON = function (graph) {
    var cells = graph.getCells(),
        elements = extractElements(cells),
        relations = extractRelations(cells);
    return { elements: elements, relations: relations };
};
