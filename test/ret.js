test('Ret test', function() {
    var container = document.getElementById('container'),
        ret;

    ret = $C.tpl['ret-template-test'].call(container);
    deepEqual(ret, 'test1');
    deepEqual(domToArray(container), ['ololo', 'test1', 'yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-call-test'].call(container);
    deepEqual(ret, 'test2');
    deepEqual(domToArray(container), ['ololo', 'test2', 'yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-js-test'].call(container);
    deepEqual(ret, 'test3');
    deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-var-test'].call(container);
    deepEqual(ret, 'test4');
    deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-var-test2'].call(container);
    deepEqual(ret, 'test9');
    deepEqual(domToArray(container), ['ololo', 'test9', 'yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-var-test3'].call(container);
    deepEqual(ret, 'test10');
    deepEqual(domToArray(container), ['yo', 'ololo', 'test10']);
    container.innerHTML = '';

    ret = $C.tpl['ret-expr-test'].call(container);
    deepEqual(ret, 'test5');
    deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-expr-test2'].call(container);
    deepEqual(ret, 'test6');
    deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-elem-test'].call(container);
    domEqual(domToArray(ret, true), [{name: 'div', attr: {'class': 'test7'}, children: ['test7']}]);
    deepEqual(domToArray(container), ['yo', {name: 'div', attr: {'class': 'test7'}, children: ['test7']}]);
    container.innerHTML = '';

    ret = $C.tpl['ret-elem-test2'].call(container);
    domEqual(domToArray(ret, true), [{name: 'p', attr: {'class': 'test8'}, children: ['test8']}]);
    deepEqual(domToArray(container), ['yo', {name: 'p', attr: {'class': 'test8'}, children: ['test8']}]);
    container.innerHTML = '';

    ret = $C.tpl['ret-str-test'].call(container);
    deepEqual(ret, 'ololo');
    deepEqual(domToArray(container), ['yo']);
    container.innerHTML = '';

    ret = $C.tpl['ret-default-test']();
    ok(ret && (ret.nodeType === 11), 'documentFragment expected');
    deepEqual(domToArray(container), []);
    deepEqual(domToArray(ret), [
        {name: 'div', attr: {}, children: ['ahahah']},
        {name: 'p', attr: {}, children: ['ohohoh']}
    ]);

    ret = $C.tpl['ret-default-test'].call(container);
    deepEqual(ret, undefined);
    deepEqual(domToArray(container), [
        {name: 'div', attr: {}, children: ['ahahah']},
        {name: 'p', attr: {}, children: ['ohohoh']}
    ]);

    container.innerHTML = '';
});
