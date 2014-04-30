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


test('BEM selectors test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('bem-selectors-test').end();

    domEqual(domToArray(container), [
        {name: 'h1', children: [{name: 'span', attr: {
            'class': 'a b-block1 b b-block1_mod1 c b-block2 d e b-block2_mod3_mmm b-block2_mod5 b-block4__elem2 b-block2_mod2_3 b-block3__elem1 b-block4__elem2_mod7'
        }, children: []}]},
        {name: 'h2', children: [{name: 'span', attr: {
            'class': 'a b-block1 b b-block1_mod1 c b-block2 d e b-block2_mod3_mmm b-block2_mod5 b-block4__elem2 b-block2_mod2_3 b-block3__elem1 b-block4__elem2_mod6'
        }, children: []}]},
        {name: 'h3', children: [{name: 'span', attr: {
            'class': 'a b-block1 b b-block1_mod1 c b-block2 d e b-block2_mod3_mmm b-block2_mod5 b-block4__elem2 b-block2_mod2_3 b-block2_mod4 b-block4__elem2_mod7'
        }, children: []}]},
        {name: 'h4', children: [{name: 'span', attr: {
            'class': 'a b-block1 b b-block1_mod1 c b-block2 d e b-block2_mod3_mmm b-block2_mod5 b-block4__elem2 b-block2_mod2_3 b-block2_mod4 b-block4__elem2_mod6'
        }, children: []}]}
    ]);

    container.innerHTML = '';
});


test('Dynamic element name test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('dynamic-element-name-test').end();

    domEqual(domToArray(container), [
        {name: 'abc', children: []},
        {name: 'blah', children: []},
        {name: 'efg', children: []},
        {name: 'ololo', attr: {'class': 'a b c'}, children: []},
        {name: 'blah2', children: []}
    ]);

    container.innerHTML = '';
});
