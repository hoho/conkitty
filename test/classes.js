test('Classes test', function() {
    var container = document.getElementById('container');

    $C(container).callTemplate('change-class-test').end();

    domEqual(domToArray(container), [
        {name: 'div', attr: {'class': 'hello beautiful world really'}, children: []},
        {name: 'span', attr: {'class': 'this is good'}, children: []},
        {name: 'em', attr: {'class': 'ululu ilili'}, children: []},
        {name: 'p', attr: {'class': 'b-good-block__yeah b-bad-block b-bad-block_no_3 b-bad-block_piu_arf b d'}, children: []}
    ]);

    container.innerHTML = '';
});
