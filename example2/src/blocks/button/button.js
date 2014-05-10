// Blocks global is declared in ../blocks.js

Blocks.Button = function(node) {
    this.node = node;
    node.addEventListener('click', function() {
        alert('Ololo!!!');
    }, false);
};
