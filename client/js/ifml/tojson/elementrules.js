// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by a MIT-style license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var almost = require('almost'),
    createRule = almost.createRule;

module.exports = [
    createRule(
        function (element) {
            return ['ifml.Event', 'ifml.Action', 'ifml.ViewComponent', 'ifml.ViewContainer'].includes(element.get('type'));
        },
        function (element) {
            var statistics = element.get('statistics');
            return {
                elements: {
                    id: element.id,
                    type: element.get('type'),
                    metadata: {
                        graphics: {
                            position: element.get('position')
                        },
                        statistics: statistics && statistics.slice()
                    }
                }
            };
        }
    ),
    createRule(
        function (element) {
            return element.get('type') === 'ifml.Event';
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    attributes: {
                        name: element.prop('name/text')
                    },
                    metadata: {
                        graphics: {
                            name: {
                                horizontal: element.prop('name/horizontal'),
                                vertical: element.prop('name/vertical')
                            }
                        }
                    }
                }
            };
        }
    ),
    createRule(
        function (element) {
            return element.get('type') === 'ifml.Action';
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    attributes: {
                        name: element.get('name'),
                        parameters: (element.get('parameters') && element.get('parameters').slice()) || [],
                        results: (element.get('results') && element.get('results').slice()) || []
                    },
                    metadata: {
                        graphics: {
                            size: element.get('size'),
                            parent: element.get('parent')
                        }
                    }
                }
            };
        }
    ),
    createRule(
        function (element) {
            return element.get('type') === 'ifml.ViewComponent';
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    attributes: {
                        name: element.get('name'),
                        stereotype: element.get('stereotype'),
                        fields: (element.get('fields') && element.get('fields').slice()) || []
                    },
                    metadata: {
                        graphics: {
                            size: element.get('size')
                        }
                    }
                }
            };
        }
    ),
    createRule(
        function (element) {
            return element.get('type') === 'ifml.ViewComponent' && ['list', 'details'].includes(element.get('stereotype'));
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    attributes: {
                        collection: element.get('collection') || ''
                    }
                }
            };
        }

    ),
    createRule(
        function (element) {
            return element.get('type') === 'ifml.ViewComponent' && element.get('stereotype') === 'list';
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    attributes: {
                        filters: (element.get('filters') && element.get('filters').slice()) || []
                    }
                }
            };
        }

    ),
    createRule(
        function (element) {
            return element.get('type') === 'ifml.ViewContainer';
        },
        function (element) {
            return {
                elements: {
                    id: element.id,
                    attributes: {
                        name: element.get('name'),
                        default: element.get('default'),
                        landmark: element.get('landmark'),
                        xor: element.get('xor')
                    },
                    metadata: {
                        graphics: {
                            size: element.get('size')
                        }
                    }
                }
            };
        }
    ),
    createRule(
        function (element) {
            return ['ifml.DataFlow', 'ifml.NavigationFlow'].includes(element.get('type'));
        },
        function (element) {
            var vertices = element.get('vertices'),
                statistics = element.get('statistics');
            return {
                elements: {
                    id: element.id,
                    type: element.get('type'),
                    attributes: {
                        bindings: element.get('bindings').slice()
                    },
                    metadata: {
                        graphics: {
                            vertices: vertices && vertices.slice()
                        },
                        statistics: statistics && statistics.slice()
                    }
                }
            };
        }
    ),
    createRule(
        function (element) {
            return ['ifml.Event', 'ifml.ViewContainer', 'ifml.ViewComponent'].includes(element.get('type')) &&
                element.get('parent');
        },
        function (element) {
            return {
                relations: {
                    type: 'hierarchy',
                    parent: element.get('parent'),
                    child: element.id
                }
            };
        }
    ),
    createRule(
        function (element) {
            return ['ifml.DataFlow', 'ifml.NavigationFlow'].includes(element.get('type'));
        },
        function (element) {
            return {
                relations: {
                    type: 'source',
                    flow: element.id,
                    source: element.get('source').id
                }
            };
        }
    ),
    createRule(
        function (element) {
            return ['ifml.DataFlow', 'ifml.NavigationFlow'].includes(element.get('type'));
        },
        function (element) {
            return {
                relations: {
                    type: 'target',
                    flow: element.id,
                    target: element.get('target').id
                }
            };
        }
    )
];
