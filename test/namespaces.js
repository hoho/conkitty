QUnit.test('Namespaces test', function(assert) {
    var container = document.getElementById('container');

    $C(container).callTemplate('namespaces-test').end();

    domEqual(assert, domToArray(container), [
        {name: 'header', children: [
            {name: 'div', attr: {'class': 'logo'}, children: [
                'Bebebe',
                {name: 'img', attr: {src: 'logo-img.png'}, children: []}
            ]}
        ]},
        {name: 'section', children: [
            {name: 'button', children: ['Hello']},
            {name: 'textarea', children: ['World']}
        ]},
        {name: 'footer', children: [
            'Cooooooo',
            '(C)'
        ]}
    ]);

    assert.deepEqual($C._tpl['ns1::'], undefined);
    assert.deepEqual($C._tpl['ns2::'], undefined);
    assert.deepEqual($C._tpl['ns100500::'], undefined);
    assert.deepEqual($C._tpl['ns1::login'], undefined);
    assert.deepEqual($C._tpl['ns2::dropdown'], undefined);
    assert.deepEqual($C._tpl['ns3::copyleft'], undefined);
    assert.deepEqual($C._tpl['ns3::button'], undefined);
    assert.deepEqual($C._tpl['ns100500::yep'], undefined);

    container.innerHTML = '';
});
