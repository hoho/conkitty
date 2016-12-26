QUnit.test('Nodes test', function(assert) {
    var container = document.getElementById('container');

    $C(container).callTemplate('nodes-test').end();

    domEqual(assert, domToArray(container), [
        {name: 'div', attr: {'class': 'some-class', aaa: 'bbb', ccc2: 'ddd', ccc4: 'ddd', eee1: 'fff', eee3: 'fff'}, children: [
            'Hello',
            ' ',
            {name: 'span', children: ['World']}
        ]}
    ]);

    container.innerHTML = '';
});
