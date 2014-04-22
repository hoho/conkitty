test('Selectors test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('selectors-test').end();

    domEqual(domToArray(container), [{name: 'h1', children: [
        {name: 'span', attr: {
            'class': 'something ccond2-false',
            id: 'very',
            good: 'indeed',
            'acond2-false': 'ololo'
        }, children: []}]},
        {name: 'h2', children: [{name: 'span', attr: {
            'class': 'something ccond2-false',
            id: 'very',
            good: 'indeed',
            'acond2-false': 'ololo'
        }, children: []}]},
        {name: 'h3', children: [{name: 'span', attr: {
            'class': 'something ccond2-true',
            id: 'icond2-true',
            good: 'indeed',
            'acond3-false': 'yep!'
        }, children: []}]},
        {name: 'h4', children: [{name: 'tcond3-true', attr: {
            'class': 'something ccond2-true',
            id: 'icond2-true',
            good: 'indeed'
        }, children: []}]},
        {name: 'h5', children: [{name: 'span', attr: {
            'class': 'something ccond1-true ccond2-false',
            id: 'very',
            good: 'indeed',
            'acond2-false': 'ololo'
        }, children: []}]},
        {name: 'h6', children: [{name: 'span', attr: {
            'class': 'something ccond1-true ccond2-false',
            id: 'very',
            good: 'indeed',
            'acond2-false': 'ololo'
        }, children: []}]},
        {name: 'div', children: [{name: 'span', attr: {
            'class': 'something ccond1-true ccond2-true',
            id: 'icond2-true',
            good: 'indeed',
            'acond3-false': 'yep!'
        }, children: []}]},
        {name: 'p', children: [{name: 'tcond3-true', attr: {
            'class': 'something ccond1-true ccond2-true',
            id: 'icond2-true',
            good: 'indeed'
        }, children: []}]}
    ]);

    container.innerHTML = '';
});
