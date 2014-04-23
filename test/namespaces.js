test('Namespaces test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('namespaces-test').end();

    domEqual(domToArray(container), [
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

    deepEqual($C._tpl['ns1::'], undefined);
    deepEqual($C._tpl['ns2::'], undefined);
    deepEqual($C._tpl['ns100500::'], undefined);
    deepEqual($C._tpl['ns1::login'], undefined);
    deepEqual($C._tpl['ns2::dropdown'], undefined);
    deepEqual($C._tpl['ns3::copyleft'], undefined);
    deepEqual($C._tpl['ns3::button'], undefined);
    deepEqual($C._tpl['ns100500::yep'], undefined);

    container.innerHTML = '';
});
