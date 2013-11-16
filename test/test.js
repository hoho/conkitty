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

    domEqual(domToArray(container), [
        {name: 'div', attr: {id: 'm1'}, children: []},
        {name: 'div', attr: {id: 'm2'}, children: []}
    ])

    deepEqual(ret.m0, 'aaaaa');
    deepEqual(ret.m1.getAttribute('id'), 'm1');
    deepEqual(ret['m2-999'].node.getAttribute('id'), 'm2');
    deepEqual(ret['m2-999'].aa, 'bb');
    deepEqual(ret.mmm, undefined);

    container.innerHTML = '';

    ret = $C.tpl['mem-test']({parent: container, mem: {m0: 'ppppp', mmm: 'uuuuu'}});

    domEqual(domToArray(container), [
        {name: 'div', attr: {id: 'm1'}, children: []},
        {name: 'div', attr: {id: 'm2'}, children: []}
    ])

    deepEqual(ret.m0, 'aaaaa');
    deepEqual(ret.m1.getAttribute('id'), 'm1');
    deepEqual(ret['m2-999'].node.getAttribute('id'), 'm2');
    deepEqual(ret['m2-999'].aa, 'bb');
    deepEqual(ret.mmm, 'uuuuu');

    container.innerHTML = '';
});
