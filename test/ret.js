QUnit.test('Ret test', function(assert) {
    var container = document.getElementById('container'),
        ret;

    ret = $C.tpl['ret-template-test'].call(container);
    assert.deepEqual(ret, 'test1');
    assert.deepEqual(domToArray(container), ['ololo', 'test1', 'yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-call-test'].call(container);
    assert.deepEqual(ret, 'test2');
    assert.deepEqual(domToArray(container), ['ololo', 'test2', 'yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-js-test'].call(container);
    assert.deepEqual(ret, 'test3');
    assert.deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-var-test'].call(container);
    assert.deepEqual(ret, 'test4');
    assert.deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-var-test2'].call(container);
    assert.deepEqual(ret, 'test9');
    assert.deepEqual(domToArray(container), ['ololo', 'test9', 'yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-var-test3'].call(container);
    assert.deepEqual(ret, 'test10');
    assert.deepEqual(domToArray(container), ['yo', 'ololo', 'test10']);
    container.innerHTML = '';

    ret = $C.tpl['ret-expr-test'].call(container);
    assert.deepEqual(ret, 'test5');
    assert.deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-expr-test2'].call(container);
    assert.deepEqual(ret, 'test6');
    assert.deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-elem-test'].call(container);
    domEqual(assert, domToArray(ret, true), [{name: 'div', attr: {'class': 'test7'}, children: ['test7']}]);
    assert.deepEqual(domToArray(container), ['yo', {name: 'div', attr: {'class': 'test7'}, children: ['test7']}]);
    container.innerHTML = '';

    ret = $C.tpl['ret-elem-test2'].call(container);
    domEqual(assert, domToArray(ret, true), [{name: 'p', attr: {'class': 'test8'}, children: ['test8']}]);
    assert.deepEqual(domToArray(container), ['yo', {name: 'p', attr: {'class': 'test8'}, children: ['test8']}]);
    container.innerHTML = '';

    ret = $C.tpl['ret-str-test'].call(container);
    assert.deepEqual(ret, 'ololo');
    assert.deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-default-test']();
    assert.ok(ret && (ret.nodeType === 11), 'documentFragment expected');
    assert.deepEqual(domToArray(container), []);
    assert.deepEqual(domToArray(ret), [
        {name: 'div', attr: {}, children: ['ahahah']},
        {name: 'p', attr: {}, children: ['ohohoh']}
    ]);

    ret = $C.tpl['ret-default-test'].call(container);
    assert.deepEqual(ret, undefined);
    assert.deepEqual(domToArray(container), [
        {name: 'div', attr: {}, children: ['ahahah']},
        {name: 'p', attr: {}, children: ['ohohoh']}
    ]);

    container.innerHTML = '';
});
