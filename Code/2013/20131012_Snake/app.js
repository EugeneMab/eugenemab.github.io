var Snake;
(function (Snake) {
    var Cell = (function () {
        function Cell(row, col, td) {
            this.row = row;
            this.col = col;
            this.td = td;
            var self = this;
            this.td.onclick = function () {
                Snake.Ctrl.onClickCell(self.row, self.col);
            };
            this.td.className = "cellNone" + ((row + col) % 2);
        }
        return Cell;
    })();
    var Board = (function () {
        function Board(contentDiv, width, height) {
            this.width = width;
            this.height = height;
            var contentHtml = "";
            contentHtml += "<table border='0' cellpadding='0' cellspacing='0'>";
            for (var row = 0; row < height; row++) {
                contentHtml += "<tr>";
                for (var col = 0; col < width; col++) {
                    contentHtml += "<td id=cell_" + row + "_" + col + "></td>";
                }
                contentHtml += "</tr>";
            }
            contentHtml += "</table>";
            contentDiv.innerHTML = contentHtml;
            this.cells = [];
            for (var row = 0; row < height; row++) {
                var line = [];
                this.cells.push(line);
                for (var col = 0; col < width; col++) {
                    var td = document.getElementById("cell_" + row + "_" + col);
                    line.push(new Cell(row, col, td));
                }
                contentHtml += "</tr>";
            }
        }
        return Board;
    })();
    (function (Program) {
        var contentDiv;
        var width = 40;
        var height = 30;
        var board;
        function reset() {
            contentDiv = document.getElementById("content");
            board = new Board(contentDiv, width, height);
        }
        Program.reset = reset;
    })(Snake.Program || (Snake.Program = {}));
    var Program = Snake.Program;
    (function (Ctrl) {
        var Program = Snake.Program;
        function onLoad() {
            Program.reset();
        }
        Ctrl.onLoad = onLoad;
        function onClickCell(row, col) {
            alert("clicked " + row + " " + col);
        }
        Ctrl.onClickCell = onClickCell;
    })(Snake.Ctrl || (Snake.Ctrl = {}));
    var Ctrl = Snake.Ctrl;
})(Snake || (Snake = {}));

window.onload = function () {
    Snake.Ctrl.onLoad();
};
//# sourceMappingURL=app.js.map
