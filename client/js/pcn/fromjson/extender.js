// Copyright (c) 2018, the IFMLEdit.org project authors. Please see the
// AUTHORS file for details. All rights reserved. Use of this source code is
// governed by the MIT license that can be found in the LICENSE file.
/*jslint node: true, nomen: true */
"use strict";

var createExtender = require('almost-extend').createExtender;

exports.extend = createExtender({
    type: {
        'PlaceChart': 'pcn.PlaceChart',
        'Transition': 'pcn.Transition',
        'Link': 'pcn.Link',
        'Element': ['pcn.PlaceChart', 'pcn.Transition', 'pcn.Link'],
        'ElementWithName': ['pcn.PlaceChart', 'pcn.Transition'],
        'ElementWithPosition': ['pcn.PlaceChart', 'pcn.Transition'],
        'ElementWithSize': ['pcn.PlaceChart'],
        'ElementWithRotation': ['pcn.Transition'],
        'ElementWithPriority': ['pcn.Transition'],
        'ElementWithTokens': ['pcn.PlaceChart', 'pcn.Link'],
        'TargetRelation': 'pcn.Target',
        'SourceRelation': 'pcn.Source',
        'HierarchicalRelation' : 'pcn.Hierarchy'
    }
});
