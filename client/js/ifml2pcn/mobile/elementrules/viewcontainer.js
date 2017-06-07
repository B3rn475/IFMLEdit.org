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
        function (element, model) { return model.isViewContainer(element); },
        function (vcontainer, model) {
            var id = vcontainer.id,
                pid = model.getParentId(id, 'application'),
                suffix = '_{' + vcontainer.attributes.name + '}',
                obj = {};
            obj[id] = { position: { row: vcontainer.metadata.graphics.position.y / 5, col: vcontainer.metadata.graphics.position.x / 5 }};
            obj[id + '-default'] = {
                cells: [new pcn.elements.PlaceChart({id: id, name: {text: vcontainer.attributes.name}})],
                children: [id + '-view', id + '-content'],
                position: { row: 1, col: 0 }
            };
            obj[id + '-content'] = { position : {row: 0, col: 1} };
            obj[id + '-view'] = {
                cells: [
                    new pcn.elements.PlaceChart({id: id + '-view-p', name: {text: 'View' + suffix}}),
                    new pcn.elements.PlaceChart({id: id + '-view-n', name: {text: '\\overline{View}' + suffix}, position: {x: 0, y: 60}}),
                    new pcn.links.Link({id: id + '->' + id + '-view-p', source: {id: id}, target: {id: id + '-view-p'}})
                ],
                position: { row: 0, col: 0 }
            };
            obj[pid + '-content'] = {children: id};
            return obj;
        }
    ),
    createRule( // map xor
        function (element, model) { return model.isViewContainer(element) && model.isXOR(element); },
        function (vcontainer) {
            var id = vcontainer.id,
                obj = {};
            obj[id] = { children: [id + '-default', id + '-landmarks'] };
            obj[id + '-landmarks'] = {position: {row: 0, col: 0}};
            return obj;
        }
    ),
    createRule( // map non xor
        function (element, model) { return model.isViewContainer(element) && !model.isXOR(element); },
        function (vcontainer, model) {
            var id = vcontainer.id,
                actions = _.chain(model.getChildren(id))
                    .reject(function (cid) { return model.isViewContainer(cid); })
                    .map(function (cid) { return model.getDescendants(cid, true); })
                    .flatten()
                    .filter(function (did) { return model.isEvent(did) && model.getOutbounds(did).length; })
                    .map(function (eid) { return model.toId(model.getTarget(model.getOutbounds(eid)[0])); })
                    .filter(function (tid) { return model.isAction(tid); })
                    .value(),
                xorFreeChildren = _.chain(model.getChildren(id))
                    .reject(function (cid) { return model.isEvent(cid); })
                    .reject(function (cid) {
                        return model.isViewContainer(cid) && _.find(model.getDescendants(cid, true), function (did) { return model.isXOR(did); });
                    })
                    .value(),
                rings = _.chain(model.getDescendants(id, true))
                    .filter(function (did) { return model.isViewContainer(did); })
                    .filter(function (did) { return model.isXOR(did); })
                    .filter(function (did) {
                        return _.chain(model.getAncestors(did, true))
                                .dropWhile(function (aid) { return aid !== id; })
                                .find(function (aid) { return model.isXOR(aid); })
                                .value() === did;
                    })
                    .map(function (did) {
                        return {
                            id: id + '-w-' + did,
                            xor: did,
                            proxy: _.chain(model.getAncestors(did, true))
                                .dropWhile(function (aid) { return aid !== id; })
                                .drop(1)
                                .first()
                                .value(),
                            name: vcontainer.attributes.name + '/' + model.toElement(did).attributes.name
                        };
                    })
                    .value(),
                obj = {};
            obj[id] = {children: (_.first(rings) && _.first(rings).id) || (id + '-default') };
            obj[id + '-default'] = {
                cells : _.chain(model.getChildren(id))
                    .reject(function (cid) { return model.isEvent(cid); })
                    .map(function (cid) {
                        return new pcn.links.Link({id: id + '->' + cid, source: {id: id}, target: {id: cid}});
                    })
                    .concat(_.map(actions, function (aid) {
                        return new pcn.links.Link({id: id + '->' + aid + '-running-n', source: {id: id}, target: {id: aid + '-running-n'}});
                    }))
                    .value()
            };
            _.forEach(rings, function (ring, index) {
                obj[ring.id] = {
                    cells: _.chain([])
                        .concat([
                            new pcn.elements.PlaceChart({id: ring.id, name: {text: ring.name}}),
                            new pcn.links.Link({id: ring.id + '->' + id + '-view-p', source: {id: ring.id}, target: {id: id + '-view-p'}})
                        ])
                        .concat(
                            _.chain(xorFreeChildren).concat(actions).map(function (cid) {
                                return new pcn.links.Link({id: ring.id + '->' + cid, source: {id: ring.id}, target: {id: cid}});
                            }).value()
                        )
                        .concat(
                            _.chain(rings)
                                .without(ring)
                                .map(function (otherRing) {
                                    return new pcn.links.Link({id: ring.id + '->' + otherRing.proxy, source: {id: ring.id}, target: {id: otherRing.proxy}});
                                })
                                .compact()
                                .value()
                        )
                        .concat((function () {
                            if (ring.proxy !== ring.xor) {
                                return new pcn.links.Link({id: ring.id + '->' + ring.proxy + '-w-' + ring.xor, source: {id: ring.id}, target: {id: ring.proxy + '-w-' + ring.xor}});
                            }
                            return [];
                        }()))
                        .value(),
                    children: (rings[index + 1] && rings[index + 1].id) || (id + '-default'),
                    position: {row: 0, col: 0}
                };
            });
            return obj;
        }
    ),
    createRule( // map xor default child initializer
        function (element, model) { return model.isViewContainer(element) && model.isXOR(model.getParent(element), true) && model.isDefault(element); },
        function (vcontainer, model) {
            var id = vcontainer.id,
                pid = model.getParentId(id, 'application'),
                obj = {};
            obj[id + '-default'] = {cells: [
                new pcn.links.Link({id: pid + '->' + id, source: {id: pid}, target: {id: id}})
            ]};
            return obj;
        }
    ),
    createRule( // map xor non default child initializer
        function (element, model) { return model.isViewContainer(element) && model.isXOR(model.getParent(element), true) && !model.isDefault(element); },
        function (vcontainer, model) {
            var id = vcontainer.id,
                pid = model.getParentId(vcontainer, 'application'),
                obj = {};
            obj[id + '-default'] = {cells: [
                new pcn.links.Link({id: pid + '->' + id + '-view-n', source: {id: pid}, target: {id: id + '-view-n'}})
            ]};
            return obj;
        }
    ),
    createRule( // map xor landmark child
        function (element, model) { return model.isViewContainer(element) && model.isXOR(model.getParent(element), true) && model.isLandmark(element); },
        function (vcontainer, model) {
            var id = vcontainer.id,
                pid = model.getParentId(vcontainer, 'application'),
                obj = {};
            obj[id + '-landmark'] = {cells: (function () {
                return _([
                    new pcn.elements.Transition({id: id + '-landmark', name: {text: 'landmark_{' + vcontainer.attributes.name + '}', vertical: 'top'}, angle: 90}),
                    new pcn.links.Link({id: pid + '->' + id + '-landmark', source: {id: pid}, target: {id: id + '-landmark'}}),
                    new pcn.links.Link({id: pid + '-view-p->' + id + '-landmark', source: {id: pid + '-view-p'}, target: {id: id + '-landmark'}}),
                    new pcn.links.Link({id: id + '-landmark->' + pid + '-view-p', source: {id: id + '-landmark'}, target: {id: pid + '-view-p'}}),
                    new pcn.links.Link({id: id + '-landmark->' + id, source: {id: id + '-landmark'}, target: {id: id}})
                ]).concat(
                    _.chain(model.getChildren(pid, model.getTopLevels()))
                        .filter(function (tid) { return tid !== id; })
                        .map(function (tid) { return new pcn.links.Link({id: id + '-landmark->' + tid + '-view-n', source: {id: id + '-landmark'}, target: {id: tid + '-view-n'}}); })
                        .value()
                ).value();
            }()), position: { row: vcontainer.metadata.graphics.position.y / 5, col: vcontainer.metadata.graphics.position.x / 5 }};
            obj[pid + '-landmarks'] = {children: id + '-landmark'};
            return obj;
        }
    )
];
