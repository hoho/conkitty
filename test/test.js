$C.define('callTemplate', function(item, index, arr, args) {
    var name = args[0];
    args = Array.prototype.slice.call(args, 0);
    args[0] = {parent: this};
    $C.tpl[name].apply(this, args);
});

function domToArray(node) {
    var ret = [], i, j, n, attr, a, tmp;

    for (i = 0; i < node.childNodes.length; i++) {
        n = node.childNodes[i];

        if (n.nodeType === 3) {
            ret.push(n.nodeValue);
        } else {
            attr = {};
            for (j = 0; j < n.attributes.length; j++) {
                a = n.attributes[j];

                if (!a.specified) {
                    continue;
                }

                if (a.name === 'style') {
                    tmp = n.style.cssText.replace(/'|"|;$/g, '').toLowerCase().split('; ');
                    tmp.sort();
                    while (tmp.length > 0 && !tmp[0]) {
                        tmp.shift();
                    }
                    attr[a.name] = tmp.join('; ');
                } else {
                    attr[a.name] = a.value;
                }
            }

            ret.push({name: n.tagName.toLowerCase(), attr: attr, children: domToArray(n)});
        }
    }

    return ret;
}

function attrEqual(val, expected) {
    var i = 0, j = 0, name;

    for (name in val) {
        i++;
    }

    for (name in expected) {
        j++;
    }

    deepEqual(i, j, 'Same attribute count');

    for (name in val) {
        deepEqual(val[name], expected[name], 'Same attribute value');
    }
}

function domEqual(val, expected) {
    var i;

    deepEqual(val.length, expected.length, 'Same node count');

    for (i = 0; i < Math.min(val.length, expected.length); i++) {
        deepEqual(typeof val[i], typeof expected[i], 'Same node type');

        if (typeof val[i] === 'object') {
            deepEqual(val[i].name, expected[i].name, 'Same name');
            attrEqual(val[i].attr, expected[i].attr);
            domEqual(val[i].children, expected[i].children);
        } else {
            deepEqual(val[i], expected[i], 'Same text value');
        }
    }
}

test('Simple test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('page').end();

    domEqual(domToArray(container), [
        {name: 'div', attr: {'class': 'class ahah', id: 'id', 'data-ololo': '123'}, children: [
            'Hello ',
            {name: 'strong', children: ['wor', 'ld']},
            '!'
        ]}
    ]);

    container.innerHTML = '';
});

test('More complex test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('tpl1', '777', '888').end();

    domEqual(domToArray(container), [
        {name: 'div', attr: {a1: 'bebe'}, children: [
            '888888',
            {name: 'h1', children: ['777yo']},
            'aaa',
            {name: 'h3', children: [
                '1',
                {name: 'em', children: ['cool']},
                'BBBBB',
                'hihihi',
                '1'
            ]},
            {name: 'h1', children: ['test']},
            'nothing',
            'yes',
            {name: 'p', children: ['000']},
            '777',
            '!!!'
        ]}
    ]);

    container.innerHTML = '';
});

test('Each test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('eachtest', [[11, 22, 33], ['aa', 'bb']]).end();

    domEqual(domToArray(container), [
        {name: 'ul', children: [
            {name: 'li', children: [
                '11,22,33',
                '|',
                {name: 'b', children: ['11']},
                {name: 'b', children: ['22']},
                {name: 'b', children: ['33']},
                '|'
            ]},
            {name: 'li', children: [
                'aa,bb',
                '|',
                {name: 'b', children: ['aa']},
                {name: 'b', children: ['bb']},
                '|'
            ]}
        ]}
    ]);

    container.innerHTML = '';
});

test('Each test 2', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('eachtest2', [{a: 11, b: 22}, {c: 33, d: 44}]).end();

    domEqual(domToArray(container), [
        'eeee',
        'eeee',
        {name: 'ul', children: [
            {name: 'li', children: [
                '|',
                {name: 'b', children: ['a = 11']},
                {name: 'b', children: ['b = 22']},
                '|'
            ]},
            {name: 'li', children: [
                '|',
                {name: 'b', children: ['c = 33']},
                {name: 'b', children: ['d = 44']},
                '|'
            ]}
        ]}
    ]);

    container.innerHTML = '';
});

test('Unescaped test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('unescaped').end();

    domEqual(domToArray(container), [
        {name: 'div', attr: {aa: 's"<>ss', he: 'ha'}, children: []},
        {name: 'p', children: ['"hello"']},
        {name: 'a', children: ['\'world\'']},
        {name: 'div', children: ['indeed']}
    ]);

    container.innerHTML = '';
});

test('Dynamic call name test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('dynamic-call').end();

    domEqual(domToArray(container), [
        'ooooo',
        'yoyoyo'
    ]);

    container.innerHTML = '';
});

test('Memorize test', function() {
    var container = document.getElementById('container'),
        ret = $C.tpl['mem-test']({parent: container});

    deepEqual(ret, undefined);

    domEqual(domToArray(container), [
        {name: 'div', attr: {id: 'm1'}, children: []},
        {name: 'div', attr: {id: 'm2'}, children: []}
    ]);

    deepEqual($C.mem.m0, 'aaaaa');
    deepEqual($C.mem.m1.getAttribute('id'), 'm1');
    deepEqual($C.mem['m2-999'].node.getAttribute('id'), 'm2');
    deepEqual($C.mem['m2-999'].aa, 'bb');
    deepEqual($C.mem.mmm, undefined);

    container.innerHTML = '';

    $C.mem = {m0: 'ppppp', mmm: 'uuuuu'};

    ret = $C.tpl['mem-test']({parent: container});

    deepEqual(ret, undefined);

    domEqual(domToArray(container), [
        {name: 'div', attr: {id: 'm1'}, children: []},
        {name: 'div', attr: {id: 'm2'}, children: []}
    ]);

    deepEqual($C.mem.m0, 'aaaaa');
    deepEqual($C.mem.m1.getAttribute('id'), 'm1');
    deepEqual($C.mem['m2-999'].node.getAttribute('id'), 'm2');
    deepEqual($C.mem['m2-999'].aa, 'bb');
    deepEqual($C.mem.mmm, 'uuuuu');

    $C.mem = {};
    container.innerHTML = '';
});

test('ACT test', function() {
    document.actTest = undefined;
    document.actTest2 = undefined;

    $C().callTemplate('act-test').end();

    deepEqual(document.actTest, 'Yo!', 'ACT worked');
    deepEqual(document.actTest2, 'Hahaha', 'ACT worked');

    document.actTest = undefined;
    document.actTest2 = undefined;
});

test('TRIGGER test', function() {
    var expected = [
        'div|["div1",123]',
        'p|["p1",234,345]',
        'span|["span1",456]',
        'span|["span2"]'
    ];

    $C.define('trigger', function(item, index, arr, args) {
        var ret = this.tagName.toLowerCase() + '|' + JSON.stringify(Array.prototype.slice.call(args, 0));
        deepEqual(ret, expected.shift());
    });

    $C().callTemplate('trigger-test').end();
});

test('WITH test', function() {
    var container = document.getElementById('container'),
        ret = $C.tpl['with-test']({parent: container}, {ololo: {piupiu: "yo!"}});

    deepEqual(ret, undefined);
    domEqual(domToArray(container), ["yo!"]);

    container.innerHTML = '';
});

test('Lazy PAYLOAD test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('lazy-payload-test').end();

    domEqual(domToArray(container), [
        {name: 'h1', children: [
            {name: 'p', children: ['test1', {name: 'span', children: ['1']}]},
            {name: 'h6', children: ['test1', {name: 'span', children: ['2']}]},
            {name: 'div', children: ['test1', {name: 'span', children: ['3']}]}
        ]},
        {name: 'h2', children: [
            {name: 'h6', children: ['test2']},
        ]},
        {name: 'h3', children: [
            {name: 'p', children: ['test3', {name: 'em', children: ['4']}]},
            {name: 'h6', children: ['test3', {name: 'em', children: ['5']}]},
            {name: 'div', children: ['test3', {name: 'em', children: ['6']}]}
        ]}
    ]);

    container.innerHTML = '';
});
