test('Nodes test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('nodes-test').end();

    domEqual(domToArray(container), [
        {name: 'div', attr: {'class': 'some-class', aaa: 'bbb', ccc: 'ddd'}, children: [
            'Hello',
            ' ',
            {name: 'span', children: ['World']}
        ]}
    ]);

    container.innerHTML = '';
});
